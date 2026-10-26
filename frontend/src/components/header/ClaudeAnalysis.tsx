import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AuthContext from '../../context/AuthContext';
import apiClient from '../../utils/apiClient';
import { CLAUDE_ORANGE } from './ClaudeIcon';
import ClaudeAnalysisResult from './ClaudeAnalysisResult';
import type { AnalysisKind, AnySnapshot, StructuredAnalysis } from './ClaudeAnalysisResult';

/**
 * Claudeによる分析（v2.2.217 で作り直した。Dashboard からの自由分析）。
 *
 * 分析したいことを文章で書き、事業部・課・店舗・期間を選ぶと、Claude がダッシュボードと
 * 同じ定義の数字を ② から自分で集めて分析し、HTML のレポートを書く。
 *
 *   左: 新しい分析の条件 → 分析の一覧（全員分）→ 過去の定型分析（v2.2.216 までの保存分）
 *   右: 選んだ分析の進み具合・結果
 *
 * ⚠️ 使えるのは Master・BrandAdmin・Manager だけ（Header.tsx がボタンを出し分け、② も確かめる）。
 * ⚠️ 1回で数分〜十数分かかる。分析は ② の中で続くので、画面を閉じても止まらない。
 *   実行中の分析があるあいだ、一覧を数秒ごとに読み直して進み具合を出す。
 * ⚠️ 実行のたびに課金される。1人1日5回まで（② が数える）。
 * ⚠️ レポートは Claude が書いた HTML。必ず iframe（sandbox="allow-scripts" だけ）の中で表示する。
 *   allow-same-origin を足すと、レポートの中からダッシュボードのログイン情報を読めてしまう。
 */

type Division = 'order' | 'kaeru';

const DIVISIONS: { value: Division; label: string; shopDivision: string }[] = [
    { value: 'order', label: '注文事業', shopDivision: '注文事業' },
    { value: 'kaeru', label: '建売分譲事業', shopDivision: '建売分譲事業' },
];
const divisionLabel = (value: string): string => DIVISIONS.find((d) => d.value === value)?.label ?? value;

/** 書き出しに迷う人のための例。押すと依頼文の欄に入る */
const EXAMPLES = [
    '直近半年で契約が伸びた店舗と落ちた店舗を比べて、差がどこで生まれているか教えて',
    '広告費に対して契約が取れている媒体と取れていない媒体を知りたい。来期の配分の見直し案も',
    '次アポ率が低い原因を、担当者別・媒体別に深掘りして',
    '前年の同じ時期と比べて反響が減っている原因と、すぐ打てる手を教えて',
];

/** 実行中の分析があるとき、一覧を読み直す間隔 */
const POLL_MS = 5000;

type JobStatus = 'queued' | 'running' | 'done' | 'error';

/** ai_analysis_list が返す1件（本文は含まない） */
type Job = {
    id: number;
    staffId: number;
    staffName: string;
    status: JobStatus;
    prompt: string;
    division: Division;
    section: string;
    shop: string;
    from: string;
    to: string;
    progress: string;
    toolCalls: number;
    title: string;
    summary: string;
    model: string;
    costUsd: number | null;
    errorMessage: string;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    /** 開始からの経過秒数（② が DB の時計で数える） */
    elapsedSec: number | null;
};

/** kpi_analysis_list が返す1件（v2.2.216 までの定型分析） */
type LegacyItem = {
    id: number;
    title: string;
    headline: string;
    analysis_type: AnalysisKind;
    created_at: string;
    staff_name: string | null;
};

type ShopMaster = { division: string; section: string; shop: string };

/** 右に出しているもの */
type Selected =
    | { kind: 'job'; id: number }
    | { kind: 'legacy'; item: LegacyItem };

const isActive = (status: JobStatus): boolean => status === 'queued' || status === 'running';

const ym = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/** 既定の期間: 締まった直近6ヶ月（当月は月の途中なので入れない） */
const defaultPeriod = (): { from: string; to: string } => {
    const now = new Date();
    return {
        from: ym(new Date(now.getFullYear(), now.getMonth() - 6, 1)),
        to: ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    };
};

/** '2026-10-26 14:03:11' → '10/26 14:03' */
const shortTime = (value: string | null): string => {
    if (value === null || value === '') return '';
    const m = /^\d{4}-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(value);
    return m === null ? value : `${Number(m[1])}/${Number(m[2])} ${m[3]}:${m[4]}`;
};

/**
 * 開始からの経過（分・秒）。② が返した経過秒数に、一覧を読み込んでからの秒数を足す。
 * ⚠️ 開始時刻と画面の時計を引き算しないこと（DB の時間帯が違うとずれる）。
 */
const elapsedText = (elapsedSec: number | null, fetchedAt: number, now: number): string => {
    if (elapsedSec === null) return '';
    const sec = Math.max(0, elapsedSec + Math.floor((now - fetchedAt) / 1000));
    return `${Math.floor(sec / 60)}分${String(sec % 60).padStart(2, '0')}秒`;
};

const errorMessageOf = (e: unknown, fallback: string): string =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

type Props = {
    /**
     * 左上の「閉じる」ボタンで呼ぶ（Header.tsx がモーダルを閉じる）。
     * ⚠️ 全画面モーダルの閉じるボタンは Header.tsx が右上に出すが、利用者の指示（2026-10-26）で左上にも置いた。
     */
    onClose: () => void;
};

const ClaudeAnalysis: React.FC<Props> = ({ onClose }) => {
    const { authority } = useContext(AuthContext);
    const isMaster = authority === 'Master';

    // 条件
    const [division, setDivision] = useState<Division>('order');
    const [section, setSection] = useState('');
    const [shop, setShop] = useState('');
    const [period, setPeriod] = useState(defaultPeriod);
    const [prompt, setPrompt] = useState('');
    const [shopMaster, setShopMaster] = useState<ShopMaster[]>([]);

    // 一覧
    const [jobs, setJobs] = useState<Job[]>([]);
    const [usedToday, setUsedToday] = useState(0);
    const [dailyLimit, setDailyLimit] = useState(5);
    /** 自分の staff.id（② が一覧と一緒に返す）。自分の分析かどうかの判定に使う */
    const [myStaffId, setMyStaffId] = useState(0);
    const [legacy, setLegacy] = useState<LegacyItem[]>([]);
    const [legacyOpen, setLegacyOpen] = useState(false);

    // 右
    const [selected, setSelected] = useState<Selected | null>(null);
    const [html, setHtml] = useState<{ id: number; html: string } | null>(null);
    const [legacyBody, setLegacyBody] = useState<{ analysis: StructuredAnalysis; kpi: AnySnapshot } | null>(null);

    const [starting, setStarting] = useState(false);
    const [error, setError] = useState('');
    const [now, setNow] = useState(() => Date.now());
    /** 一覧を最後に読み込んだ時刻（経過時間の表示に使う） */
    const [fetchedAt, setFetchedAt] = useState(() => Date.now());

    // ------------------------------------------------------------------
    // 読み込み
    // ------------------------------------------------------------------
    const loadJobs = useCallback(async (): Promise<void> => {
        try {
            const res = await apiClient.post('', { request: 'ai_analysis_list', limit: 50 });
            if (res.data?.status !== 'ok') return;
            setJobs((res.data.items ?? []) as Job[]);
            setFetchedAt(Date.now());
            setUsedToday(Number(res.data.usedToday ?? 0));
            setDailyLimit(Number(res.data.dailyLimit ?? 5));
            setMyStaffId(Number(res.data.myStaffId ?? 0));
        } catch (e) {
            setError(errorMessageOf(e, '分析の一覧を読み込めませんでした。'));
        }
    }, []);

    useEffect(() => {
        void loadJobs();
        void (async () => {
            try {
                const res = await apiClient.post('', { request: 'kpi_filter_master' });
                if (res.data?.status === 'ok') setShopMaster((res.data.shops ?? []) as ShopMaster[]);
            } catch {
                // 課・店舗を選べないだけ。事業部全体の分析はできるので止めない
            }
            try {
                const res = await apiClient.post('', { request: 'kpi_analysis_list', limit: 100 });
                if (res.data?.status === 'ok') setLegacy((res.data.items ?? []) as LegacyItem[]);
            } catch {
                // 過去の定型分析が出ないだけ
            }
        })();
    }, [loadJobs]);

    // 実行中の分析があるあいだだけ、一覧を読み直す（経過時間の表示も1秒ごとに進める）
    const hasActive = jobs.some((job) => isActive(job.status));
    useEffect(() => {
        if (!hasActive) return;
        const poll = window.setInterval(() => { void loadJobs(); }, POLL_MS);
        const tick = window.setInterval(() => setNow(Date.now()), 1000);
        return () => { window.clearInterval(poll); window.clearInterval(tick); };
    }, [hasActive, loadJobs]);

    const selectedJob = selected?.kind === 'job' ? jobs.find((job) => job.id === selected.id) ?? null : null;

    // 選んだ分析が終わっていて本文が未取得なら取りに行く（実行中に選んでいた分析が終わったときも）
    useEffect(() => {
        if (selectedJob === null || selectedJob.status !== 'done' || html?.id === selectedJob.id) return;
        let cancelled = false;
        void (async () => {
            try {
                const res = await apiClient.post('', { request: 'ai_analysis_get', id: selectedJob.id });
                if (!cancelled && res.data?.status === 'ok') setHtml({ id: selectedJob.id, html: String(res.data.html ?? '') });
            } catch (e) {
                if (!cancelled) setError(errorMessageOf(e, 'レポートを開けませんでした。'));
            }
        })();
        return () => { cancelled = true; };
    }, [selectedJob, html]);

    // ------------------------------------------------------------------
    // 条件の選択肢（部門 → 課 → 店舗）
    // ------------------------------------------------------------------
    const shopDivision = DIVISIONS.find((d) => d.value === division)?.shopDivision ?? '';
    const sectionOptions = useMemo(() => {
        const seen = new Set<string>();
        shopMaster.forEach((s) => { if (s.division === shopDivision) seen.add(s.section); });
        return Array.from(seen);
    }, [shopMaster, shopDivision]);
    const shopOptions = useMemo(
        () => (section === '' ? [] : shopMaster.filter((s) => s.division === shopDivision && s.section === section).map((s) => s.shop)),
        [shopMaster, shopDivision, section]
    );

    const periodError = period.from === '' || period.to === ''
        ? '期間を選んでください。'
        : period.from > period.to ? '開始月が終了月より後になっています。' : '';
    const limitReached = usedToday >= dailyLimit;
    const myActive = jobs.some((job) => isActive(job.status) && job.staffId === myStaffId);
    const canStart = !starting && !myActive && prompt.trim().length >= 5 && periodError === '' && !limitReached;

    // ------------------------------------------------------------------
    // 操作
    // ------------------------------------------------------------------
    const start = async (): Promise<void> => {
        setError('');
        setStarting(true);
        try {
            const res = await apiClient.post('', {
                request: 'ai_analysis_start',
                prompt: prompt.trim(),
                division,
                section,
                shop,
                from: period.from,
                to: period.to,
            });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '分析を始められませんでした。');
                return;
            }
            setPrompt('');
            setSelected({ kind: 'job', id: Number(res.data.id) });
            await loadJobs();
        } catch (e) {
            setError(errorMessageOf(e, '分析を始められませんでした。時間をおいて、もう一度お試しください。'));
        } finally {
            setStarting(false);
        }
    };

    const openLegacy = async (item: LegacyItem): Promise<void> => {
        setSelected({ kind: 'legacy', item });
        setLegacyBody(null);
        try {
            const res = await apiClient.post('', { request: 'kpi_analysis_get', id: item.id });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '保存された分析を開けませんでした。');
                return;
            }
            setLegacyBody({ analysis: res.data.analysis as StructuredAnalysis, kpi: res.data.kpi as AnySnapshot });
        } catch (e) {
            setError(errorMessageOf(e, '保存された分析を開けませんでした。'));
        }
    };

    const remove = async (job: Job): Promise<void> => {
        if (!window.confirm(`「${job.title || job.prompt.slice(0, 30)}」を削除します。よろしいですか？`)) return;
        try {
            const res = await apiClient.post('', { request: 'ai_analysis_delete', id: job.id });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '削除できませんでした。');
                return;
            }
            if (selected?.kind === 'job' && selected.id === job.id) setSelected(null);
            await loadJobs();
        } catch (e) {
            setError(errorMessageOf(e, '削除できませんでした。'));
        }
    };

    const scopeText = (job: Pick<Job, 'division' | 'section' | 'shop'>): string =>
        [divisionLabel(job.division), job.section, job.shop].filter((v) => v !== '').join(' › ');

    // ------------------------------------------------------------------
    // 描画
    // ------------------------------------------------------------------
    return (
        <div className="cla_wrap">
            <style>{`
                /* ⚠️ 全画面モーダルの Modal.Body は p-0 かつ overflow: hidden（Header.tsx）。余白と高さはこちらで持つ */
                .cla_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                            padding: 12px 32px 20px; box-sizing: border-box; }
                .cla_inner { width: 100%; max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column;
                             min-height: 0; flex: 1; gap: 12px; }
                .cla_note { font-size: 11px; color: #6b7280; line-height: 1.6; }
                .cla_head { display: flex; align-items: center; gap: 12px; }
                .cla_close { flex: none; display: inline-flex; align-items: center; gap: 5px; border: 1px solid #d1d5db;
                             background: #fff; color: #4b5563; border-radius: 6px; font-size: 12px; padding: 4px 12px; cursor: pointer; }
                .cla_close:hover { border-color: #9ca3af; color: #1f2937; }
                .cla_close:focus-visible { outline: 2px solid ${CLAUDE_ORANGE}; outline-offset: 2px; }
                .cla_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca;
                             border-radius: 8px; padding: 10px 12px; display: flex; gap: 8px; align-items: flex-start; }
                .cla_error button { margin-left: auto; border: 0; background: none; color: #b91c1c; cursor: pointer; }

                /* 左にカード、右に結果（競合分析と同じ形） */
                .cla_body { display: flex; gap: 12px; flex: 1 1 auto; min-height: 0; }
                .cla_side { width: 360px; flex: none; overflow: auto; display: flex; flex-direction: column; gap: 10px;
                            padding-right: 2px; }
                .cla_card { border: 1px solid #e8e6dc; border-radius: 10px; background: #fff; padding: 12px 14px;
                            display: flex; flex-direction: column; gap: 8px; }
                .cla_card_title { font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 6px; }
                .cla_row { display: flex; gap: 8px; }
                .cla_field { display: flex; flex-direction: column; gap: 3px; flex: 1 1 0; min-width: 0; }
                .cla_label { font-size: 11px; color: #6b7280; font-weight: 700; }
                .cla_input { border: 1px solid #d1d5db; border-radius: 6px; padding: 5px 8px; font-size: 12px;
                             background: #fff; color: #1f2937; outline: none; width: 100%; }
                .cla_input:focus { border-color: ${CLAUDE_ORANGE}; }
                .cla_input:disabled { background: #f5f4f0; color: #9ca3af; }
                textarea.cla_input { resize: vertical; min-height: 110px; line-height: 1.6; }
                .cla_examples { display: flex; flex-wrap: wrap; gap: 5px; }
                .cla_example { border: 1px solid #f0d9cc; background: #fdf8f6; color: #8a4a33; border-radius: 999px;
                               font-size: 10.5px; padding: 3px 9px; cursor: pointer; text-align: left; line-height: 1.4; }
                .cla_example:hover { border-color: ${CLAUDE_ORANGE}; }
                .cla_start { border: 0; border-radius: 8px; background: ${CLAUDE_ORANGE}; color: #fff; font-size: 13px;
                             font-weight: 700; padding: 8px 14px; cursor: pointer; }
                .cla_start:disabled { background: #d1d5db; cursor: not-allowed; }
                .cla_warn { font-size: 11px; color: #8a6d3b; background: #fdf8e7; border: 1px solid #f0e2b6;
                            border-radius: 6px; padding: 6px 8px; line-height: 1.6; }

                .cla_item { border: 1px solid #e8e6dc; border-radius: 10px; background: #fff; padding: 9px 11px;
                            cursor: pointer; text-align: left; width: 100%; display: block; }
                .cla_item:hover { border-color: ${CLAUDE_ORANGE}; }
                .cla_item.is_on { border-color: ${CLAUDE_ORANGE}; background: #fdf8f6; }
                .cla_item_title { font-weight: 700; font-size: 12px; line-height: 1.45; }
                .cla_item_meta { font-size: 10px; color: #6b7280; margin-top: 4px; display: flex; gap: 5px; flex-wrap: wrap; }
                .cla_tag { background: #f3f4f6; border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
                .cla_state { display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 700;
                             border-radius: 999px; padding: 2px 7px; margin-right: 5px; vertical-align: 1px; white-space: nowrap; }
                .cla_state.is_running { background: ${CLAUDE_ORANGE}; color: #fff; }
                .cla_state.is_done { background: #dcfce7; color: #166534; }
                .cla_state.is_error { background: #fee2e2; color: #991b1b; }
                .cla_del { border: 0; background: none; color: #9ca3af; cursor: pointer; font-size: 11px; padding: 0; margin-top: 4px; }
                .cla_del:hover { color: #dc2626; }
                .cla_toggle { border: 0; background: none; padding: 0; font-size: 12px; font-weight: 700; color: #4b5563;
                              cursor: pointer; display: flex; align-items: center; gap: 6px; }

                .cla_view { flex: 1 1 auto; min-width: 0; border: 1px solid #e8e6dc; border-radius: 10px; background: #fff;
                            display: flex; flex-direction: column; overflow: hidden; }
                .cla_view_head { border-bottom: 1px solid #e8e6dc; padding: 8px 12px; display: flex; align-items: center;
                                 gap: 8px; flex-wrap: wrap; }
                .cla_view_scroll { flex: 1 1 auto; overflow: auto; padding: 14px 18px; }
                .cla_frame { flex: 1 1 auto; width: 100%; border: 0; }
                .cla_empty { padding: 48px 24px; color: #6b7280; font-size: 12.5px; line-height: 1.9; max-width: 640px; margin: 0 auto; }
                .cla_empty h3 { font-size: 15px; color: #1f2937; margin: 0 0 8px; font-weight: 700; }
                .cla_running { padding: 48px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px;
                               text-align: center; }
                .cla_progress { font-size: 14px; font-weight: 700; color: #1f2937; }
                .cla_prompt { white-space: pre-wrap; font-size: 12px; color: #4b5563; background: #faf9f5;
                              border: 1px solid #e8e6dc; border-radius: 8px; padding: 10px 12px; max-width: 640px; text-align: left; }
            `}</style>

            <div className="cla_inner">
                <div className="cla_head">
                    <button type="button" className="cla_close" onClick={onClose}>
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                        閉じる
                    </button>
                    <span className="cla_note">
                        分析したいことを文章で書くと、Claude がダッシュボードと同じ数字を集めて深掘りし、次の打ち手まで含めたレポートを書きます。
                        広告費の歩留まりは反響日起算、部署・店舗の歩留まりは実績日起算で数えます。
                    </span>
                </div>

                {error !== '' && (
                    <div className="cla_error">
                        <i className="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true" />
                        <span>{error}</span>
                        <button type="button" onClick={() => setError('')} aria-label="閉じる">×</button>
                    </div>
                )}

                <div className="cla_body">
                    {/* ───────── 左: カード ───────── */}
                    <div className="cla_side">
                        <div className="cla_card">
                            <span className="cla_card_title">
                                <i className="fa-solid fa-wand-magic-sparkles" style={{ color: CLAUDE_ORANGE }} aria-hidden="true" />
                                新しい分析
                            </span>

                            <div className="cla_row">
                                <label className="cla_field">
                                    <span className="cla_label">事業部</span>
                                    <select id="cla-division" className="cla_input" value={division}
                                        onChange={(e) => { setDivision(e.target.value as Division); setSection(''); setShop(''); }}>
                                        {DIVISIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                                    </select>
                                </label>
                                <label className="cla_field">
                                    <span className="cla_label">課</span>
                                    <select id="cla-section" className="cla_input" value={section}
                                        onChange={(e) => { setSection(e.target.value); setShop(''); }}>
                                        <option value="">事業部全体</option>
                                        {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </label>
                            </div>

                            <label className="cla_field">
                                <span className="cla_label">店舗</span>
                                <select id="cla-shop" className="cla_input" value={shop} disabled={section === ''}
                                    onChange={(e) => setShop(e.target.value)}>
                                    <option value="">{section === '' ? '課を選ぶと選べます' : '課内すべて'}</option>
                                    {shopOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </label>

                            <div className="cla_row">
                                <label className="cla_field">
                                    <span className="cla_label">期間（開始月）</span>
                                    <input id="cla-from" type="month" className="cla_input" value={period.from}
                                        onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))} />
                                </label>
                                <label className="cla_field">
                                    <span className="cla_label">期間（終了月）</span>
                                    <input id="cla-to" type="month" className="cla_input" value={period.to}
                                        onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))} />
                                </label>
                            </div>
                            {periodError !== '' && <span className="cla_note" style={{ color: '#b91c1c' }}>{periodError}</span>}

                            <label className="cla_field">
                                <span className="cla_label">分析したいこと</span>
                                <textarea id="cla-prompt" className="cla_input" value={prompt} maxLength={4000}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="例: 鹿児島の店舗で契約が減っている理由と、来月からできる対策を教えて" />
                            </label>
                            <div className="cla_examples">
                                {EXAMPLES.map((text) => (
                                    <button key={text} type="button" className="cla_example" onClick={() => setPrompt(text)}>
                                        {text}
                                    </button>
                                ))}
                            </div>
                            <span className="cla_note">
                                うまく書けなくても大丈夫です。「もっと詳しく」くらいの書き方でも、最初から深掘りして、次の打ち手まで出します。
                            </span>

                            <div className="cla_warn">
                                <i className="fa-regular fa-clock me-1" aria-hidden="true" />
                                分析には <b>5〜15分ほど</b>かかります。画面を閉じても分析は続き、終わると下の一覧に出ます。
                                <br />1人1日 {dailyLimit} 回まで（今日 {usedToday} 回）。実行のたびに費用がかかります。
                            </div>

                            <button type="button" className="cla_start" disabled={!canStart}
                                onClick={() => { void start(); }}>
                                {starting ? '受け付けています…' : myActive ? 'あなたの分析が実行中です' : limitReached ? '今日の上限に達しました' : '分析を始める'}
                            </button>
                        </div>

                        <span className="cla_card_title mt-1">分析の一覧</span>
                        {jobs.length === 0 && <span className="cla_note">まだ分析がありません。</span>}
                        {jobs.map((job) => (
                            <div key={job.id}>
                                <button type="button"
                                    className={`cla_item${selected?.kind === 'job' && selected.id === job.id ? ' is_on' : ''}`}
                                    onClick={() => setSelected({ kind: 'job', id: job.id })}>
                                    <span className="cla_item_title d-block">
                                        {isActive(job.status) && <span className="cla_state is_running"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />実行中</span>}
                                        {job.status === 'error' && <span className="cla_state is_error">失敗</span>}
                                        {job.status === 'done' && <span className="cla_state is_done">完了</span>}
                                        {job.title !== '' ? job.title : job.prompt.slice(0, 60)}
                                    </span>
                                    <span className="cla_item_meta">
                                        <span className="cla_tag">{scopeText(job)}</span>
                                        <span className="cla_tag">{job.from}〜{job.to}</span>
                                        <span className="cla_tag">{shortTime(job.createdAt)}</span>
                                        <span className="cla_tag">{job.staffName || '－'}</span>
                                    </span>
                                </button>
                                {!isActive(job.status) && (isMaster || job.staffId === myStaffId) && (
                                    <button type="button" className="cla_del" onClick={() => { void remove(job); }}>削除</button>
                                )}
                            </div>
                        ))}

                        {legacy.length > 0 && (
                            <>
                                <button type="button" className="cla_toggle mt-2" onClick={() => setLegacyOpen((v) => !v)}>
                                    <i className={`fa-solid fa-chevron-${legacyOpen ? 'down' : 'right'}`} aria-hidden="true" />
                                    過去の定型分析（{legacy.length}件）
                                </button>
                                {legacyOpen && legacy.map((item) => (
                                    <button key={item.id} type="button"
                                        className={`cla_item${selected?.kind === 'legacy' && selected.item.id === item.id ? ' is_on' : ''}`}
                                        onClick={() => { void openLegacy(item); }}>
                                        <span className="cla_item_title d-block">{item.title}</span>
                                        <span className="cla_item_meta">
                                            <span className="cla_tag">{item.created_at.slice(0, 10)}</span>
                                            <span className="cla_tag">{item.staff_name ?? '－'}</span>
                                        </span>
                                    </button>
                                ))}
                            </>
                        )}
                    </div>

                    {/* ───────── 右: 結果 ───────── */}
                    <div className="cla_view">
                        {selected === null && (
                            <div className="cla_empty">
                                <h3>Claude に分析を頼む</h3>
                                左の「新しい分析」で、事業部・課・店舗・期間を選び、知りたいことを書いて「分析を始める」を押してください。
                                <br />Claude がダッシュボードの数字を自分で何度も集計しながら、推移・内訳・比較・ファネルの順に掘り下げ、
                                最後に「次の打ち手」まで書いたレポートを出します。
                                <br /><br />
                                <b>分析には5〜15分ほどかかります。</b>待っているあいだにほかの画面を使っても、この画面を閉じても大丈夫です。
                                <br />終わった分析は、左の一覧からいつでも開けます（開くだけなら費用はかかりません）。
                            </div>
                        )}

                        {selected?.kind === 'job' && selectedJob !== null && (
                            <>
                                <div className="cla_view_head">
                                    <span className="fw-bold" style={{ fontSize: '13px' }}>
                                        {selectedJob.title !== '' ? selectedJob.title : '分析中'}
                                    </span>
                                    <span className="cla_tag">{scopeText(selectedJob)}</span>
                                    <span className="cla_tag">{selectedJob.from}〜{selectedJob.to}</span>
                                    <span className="cla_note ms-auto">
                                        {selectedJob.staffName}・{shortTime(selectedJob.createdAt)}
                                        {selectedJob.status === 'done' && selectedJob.costUsd !== null && `・約 $${selectedJob.costUsd.toFixed(2)}`}
                                    </span>
                                </div>

                                {isActive(selectedJob.status) && (
                                    <div className="cla_running">
                                        <div className="spinner-border" style={{ color: CLAUDE_ORANGE }} role="status">
                                            <span className="visually-hidden">分析中</span>
                                        </div>
                                        <span className="cla_progress">{selectedJob.progress}</span>
                                        <span className="cla_note">
                                            {elapsedText(selectedJob.elapsedSec, fetchedAt, now)} 経過・データを集めた回数 {selectedJob.toolCalls} 回
                                        </span>
                                        <span className="cla_note">
                                            5〜15分ほどかかります。画面を閉じても分析は続きます。終わると左の一覧に「完了」と出ます。
                                        </span>
                                        <div className="cla_prompt">{selectedJob.prompt}</div>
                                    </div>
                                )}

                                {selectedJob.status === 'error' && (
                                    <div className="cla_empty">
                                        <div className="cla_error mb-3">
                                            <i className="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true" />
                                            <span>{selectedJob.errorMessage || '分析に失敗しました。'}</span>
                                        </div>
                                        <div className="cla_prompt">{selectedJob.prompt}</div>
                                        <button type="button" className="cla_example mt-2"
                                            onClick={() => setPrompt(selectedJob.prompt)}>
                                            この依頼文を左の欄に入れる
                                        </button>
                                    </div>
                                )}

                                {selectedJob.status === 'done' && (
                                    html?.id === selectedJob.id ? (
                                        // ⚠️ sandbox は allow-scripts だけ（グラフのスクリプトは動かす。ログイン情報は読ませない）
                                        <iframe className="cla_frame" title={selectedJob.title} sandbox="allow-scripts" srcDoc={html.html} />
                                    ) : (
                                        <div className="cla_running"><span className="cla_note">レポートを開いています…</span></div>
                                    )
                                )}
                            </>
                        )}

                        {selected?.kind === 'legacy' && (
                            <>
                                <div className="cla_view_head">
                                    <span className="fw-bold" style={{ fontSize: '13px' }}>{selected.item.title}</span>
                                    <span className="cla_tag">過去の定型分析</span>
                                </div>
                                <div className="cla_view_scroll">
                                    {legacyBody === null
                                        ? <span className="cla_note">開いています…</span>
                                        : <ClaudeAnalysisResult type={selected.item.analysis_type} snapshot={legacyBody.kpi} analysis={legacyBody.analysis} />}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClaudeAnalysis;
