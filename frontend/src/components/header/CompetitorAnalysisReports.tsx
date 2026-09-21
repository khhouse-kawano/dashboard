import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';
import ClaudeIcon, { CLAUDE_ORANGE } from './ClaudeIcon';

/**
 * Claudeによる競合分析（ヘッダー → 他社動向 → Claudeによる競合分析）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **この画面は Claude を呼ばない。課金は一切発生しない。**
 *
 *   ⚠️ 推論は ⚠️ **利用者自身の Claude アカウント**（Claude Desktop / MCP）で行い、
 *     ⚠️ 出来上がった HTML を ⚠️ **保存しておいて、ここで見るだけ**である。
 *   ⚠️ ⚠️ **以前は画面から Claude を実行していたが、1回あたり数百円かかったため
 *     2026-09-21 にこの形へ変えた。**
 *
 *   ⚠️ データの口: ② の `GET /api/v1/analysis/competitor`（MCP用・個人情報は伏字）
 *   ⚠️ 書き方の指示: ② の `GET /api/v1/analysis/report/spec`
 *   ⚠️ 保存: ② の `POST /api/v1/analysis/report`、または ⚠️ **この画面からのアップロード**
 *
 * ⚠️⚠️ **レポートの HTML は「こちらが書いたコード」ではない。**
 *   ⚠️ ⚠️ **必ず iframe の `sandbox="allow-scripts"` の中に出すこと。**
 *   ⚠️ ⚠️ **`allow-same-origin` を足さないこと。**
 *     ⚠️ 足すと、レポートの中のスクリプトから
 *       ⚠️ **ダッシュボードのログイン情報を読めてしまう。**
 *
 * ⚠️ 表が広いので Header.tsx の `isFullscreenMenu` に入れてある。
 *   ⚠️ ⚠️ **閉じるボタンは Header.tsx 側が出す。ここに実装しないこと。**
 * ─────────────────────────────────────────────
 */

type ReportRow = {
    no: number;
    title: string;
    category: string;
    division: string;
    period: string;
    staff: string;
    data_as_of: string | null;
    created: string;
    html_length: number;
};

type ReportBody = ReportRow & { html: string };

const DIVISION_LABEL: Record<string, string> = {
    order: '注文事業',
    kaeru: '建売分譲事業',
    '': '全社',
};

/**
 * 開くときに出す経過。
 *
 * ⚠️⚠️ **本当に推論しているわけではない。** ⚠️ 保存済みの HTML を出しているだけである。
 *   ⚠️ 利用者の要望で、⚠️ **読み込みを段階的に見せて分析らしくしている**（2026-09-21）。
 *   ⚠️ ⚠️ **そのぶん「いつ時点のデータか」を必ず外に出すこと**（下の `dataNote`）。
 *     ⚠️ 演出のせいで ⚠️ **今まさに集計した最新の数字だと誤解される**のを防ぐため。
 */
const STEPS: string[] = [
    '商談データを読み込んでいます',
    '競合欄と面談シートから他社名を拾っています',
    '他社別に勝敗を集計しています',
    '敗因の構成を整理しています',
    'レポートを組み立てています',
];

/** 1段あたりの待ち時間（ミリ秒） */
const STEP_MS = 420;

const CompetitorAnalysisReports = () => {
    const { authority, userName } = useContext(AuthContext);
    const isMaster = authority === 'Master';

    const [reports, setReports] = useState<ReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    /** 開いているレポート */
    const [opened, setOpened] = useState<ReportBody | null>(null);
    const [openingNo, setOpeningNo] = useState<number | null>(null);
    /** いま何段目まで進んだか。⚠️ STEPS.length に達したら本文を出す */
    const [step, setStep] = useState(0);
    /**
     * 一度開いたレポート。
     * ⚠️⚠️ **2回目以降は演出を飛ばす。** ⚠️ 見返すたびに待たされると資料として使えない。
     */
    const seen = useRef<Set<number>>(new Set());

    /* 登録パネル */
    const [uploadOpen, setUploadOpen] = useState(false);
    const [form, setForm] = useState({ title: '', division: 'order', period: '', dataAsOf: '' });
    const [html, setHtml] = useState('');
    const [fileName, setFileName] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveDone, setSaveDone] = useState('');

    const fetchList = useCallback(async () => {
        try {
            const res = await apiClient.post('', { request: 'analysis_report_list', category: 'competitor' });
            setReports((res.data?.reports ?? []) as ReportRow[]);
            setError('');
        } catch (err) {
            console.error(err);
            setError('分析レポートを取得できませんでした。時間をおいて再度お試しください。');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchList();
    }, [fetchList]);

    /**
     * 段階表示。
     * ⚠️ `opened` が入ってから進める。⚠️ **取得より先に終わると空白が出る。**
     */
    useEffect(() => {
        if (opened === null || step >= STEPS.length) return;
        const timer = window.setTimeout(() => setStep((n) => n + 1), STEP_MS);
        return () => window.clearTimeout(timer);
    }, [opened, step]);

    const openReport = async (row: ReportRow) => {
        setOpeningNo(row.no);
        setOpened(null);
        // ⚠️ 2回目以降は演出を飛ばす
        setStep(seen.current.has(row.no) ? STEPS.length : 0);

        try {
            const res = await apiClient.post('', { request: 'analysis_report_get', no: row.no });
            const report = res.data?.report as ReportBody | undefined;
            if (report === undefined) {
                setError(res.data?.message ?? 'レポートを開けませんでした。');
                return;
            }
            seen.current.add(row.no);
            setOpened(report);
        } catch (err) {
            console.error(err);
            setError('レポートを開けませんでした。');
        } finally {
            setOpeningNo(null);
        }
    };

    const pickFile = (file: File | null | undefined) => {
        setSaveError('');
        setSaveDone('');
        if (!file) return;

        if (!/\.html?$/i.test(file.name)) {
            setSaveError('HTMLファイルを選んでください。');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setHtml(String(reader.result ?? ''));
            setFileName(file.name);
            // ⚠️ 見出しが空ならファイル名から補う（拡張子は落とす）
            setForm((prev) => prev.title === ''
                ? { ...prev, title: file.name.replace(/\.html?$/i, '') }
                : prev);
        };
        reader.onerror = () => setSaveError('ファイルを読み込めませんでした。');
        // ⚠️ 文字化けを防ぐため UTF-8 を明示する
        reader.readAsText(file, 'utf-8');
    };

    const handleUpload = async () => {
        if (form.title.trim() === '') {
            setSaveError('見出しを入力してください。');
            return;
        }
        if (html.trim() === '') {
            setSaveError('HTMLファイルを選んでください。');
            return;
        }

        setSaving(true);
        setSaveError('');
        try {
            const res = await apiClient.post('', {
                request: 'analysis_report_upload',
                title: form.title.trim(),
                category: 'competitor',
                division: form.division,
                period: form.period.trim(),
                dataAsOf: form.dataAsOf,
                html,
            });

            if (res.data?.status !== 'ok') {
                setSaveError(res.data?.message ?? '登録に失敗しました。');
                return;
            }

            setSaveDone('分析レポートを登録しました。');
            setHtml('');
            setFileName('');
            setForm({ title: '', division: 'order', period: '', dataAsOf: '' });
            setUploadOpen(false);
            await fetchList();
        } catch (err) {
            console.error(err);
            setSaveError('登録に失敗しました。');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (row: ReportRow) => {
        if (!window.confirm(`「${row.title}」を削除します。よろしいですか。`)) return;

        try {
            await apiClient.post('', { request: 'analysis_report_delete', no: row.no });
            if (opened?.no === row.no) setOpened(null);
            await fetchList();
        } catch (err) {
            console.error(err);
            setError('削除に失敗しました。');
        }
    };

    /** ⚠️ 演出の外に常時出す。⚠️ **最新の数字だと誤解させないため** */
    const dataNote = useMemo(() => {
        if (opened === null) return '';
        const asOf = String(opened.data_as_of ?? '').slice(0, 10);
        const period = opened.period === '' ? '' : `対象期間 ${opened.period}`;
        const stamp = asOf === '' ? `登録 ${String(opened.created).slice(0, 10)}` : `${asOf} 時点のデータ`;
        return [period, stamp].filter((v) => v !== '').join(' ／ ');
    }, [opened]);

    const showBody = opened !== null && step >= STEPS.length;

    return (
        <div className="car_wrap">
            <style>{`
                /**
                 * ⚠️⚠️ 全画面モーダルの Modal.Body は **p-0 かつ overflow: hidden** である
                 *   （header/Header.tsx）。⚠️ 余白はこちらで持ち、
                 *   高さを使い切って**中だけがスクロールする**形にする。
                 */
                .car_wrap { font-size: 13px; color: #1f2937;
                            height: 100%; display: flex; flex-direction: column;
                            padding: 16px 32px 20px; box-sizing: border-box; }
                .car_inner { width: 100%; max-width: 1500px; margin: 0 auto;
                             display: flex; flex-direction: column; min-height: 0; flex: 1; gap: 12px; }

                .car_head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                .car_title { font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 3px; }
                .car_note { font-size: 11px; color: #6b7280; line-height: 1.6; }

                .car_bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
                           background: #faf9f5; border: 1px solid #e8e6dc; border-radius: 10px;
                           padding: 10px 12px; }
                .car_add { border: 0; border-radius: 8px; background: ${CLAUDE_ORANGE}; color: #fff;
                           font-size: 12px; font-weight: 700; padding: 6px 14px; cursor: pointer;
                           white-space: nowrap; margin-left: auto; }
                .car_add.is_off { background: #fff; color: #4b5563; border: 1px solid #d1d5db; }

                /* 左に一覧、右に本文 */
                .car_body { display: flex; gap: 12px; flex: 1 1 auto; min-height: 0; }
                .car_list { width: 300px; flex: none; overflow: auto; display: flex;
                            flex-direction: column; gap: 8px; }
                .car_item { border: 1px solid #e8e6dc; border-radius: 10px; background: #fff;
                            padding: 10px 12px; cursor: pointer; text-align: left; width: 100%; }
                .car_item:hover { border-color: ${CLAUDE_ORANGE}; }
                .car_item.is_on { border-color: ${CLAUDE_ORANGE}; background: #fdf8f6; }
                .car_item_title { font-weight: 700; font-size: 12px; line-height: 1.4; }
                .car_item_meta { font-size: 10px; color: #6b7280; margin-top: 4px;
                                 display: flex; gap: 6px; flex-wrap: wrap; }
                .car_tag { background: #f3f4f6; border-radius: 999px; padding: 1px 8px; white-space: nowrap; }

                .car_view { flex: 1 1 auto; min-width: 0; border: 1px solid #e8e6dc;
                            border-radius: 10px; background: #fff; display: flex;
                            flex-direction: column; overflow: hidden; }
                .car_view_head { border-bottom: 1px solid #e8e6dc; padding: 8px 12px;
                                 display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                /* ⚠️ データの時点。⚠️ **演出の外に常時出す** */
                .car_asof { font-size: 11px; color: #8a6d3b; background: #fdf8e7;
                            border: 1px solid #f0e2b6; border-radius: 6px; padding: 3px 8px; }
                .car_frame { flex: 1 1 auto; width: 100%; border: 0; }

                /* 段階表示 */
                .car_steps { padding: 28px 24px; display: flex; flex-direction: column; gap: 10px; }
                .car_step { font-size: 12px; color: #6b7280; display: flex; align-items: center; gap: 8px; }
                .car_step.is_done { color: #1f2937; }
                .car_dot { width: 6px; height: 6px; border-radius: 50%; background: ${CLAUDE_ORANGE}; flex: none; }

                .car_empty { padding: 40px 12px; text-align: center; color: #9ca3af; font-size: 12px; }
                .car_error { font-size: 12px; color: #b91c1c; background: #fef2f2;
                             border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; }
                .car_done { font-size: 12px; color: #166534; background: #f0fdf4;
                            border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px 12px; }

                .car_panel { background: #fff; border: 1px solid #f0d9cc; border-radius: 10px;
                             padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
                .car_row { display: flex; gap: 10px; flex-wrap: wrap; }
                .car_field { display: flex; flex-direction: column; gap: 4px; flex: 1 1 180px; }
                .car_label { font-size: 11px; color: #6b7280; }
                .car_input { border: 1px solid #d1d5db; border-radius: 6px; padding: 5px 8px;
                             font-size: 12px; background: #fff; color: #1f2937; outline: none; }
                .car_input:focus { border-color: ${CLAUDE_ORANGE}; }
                .car_save { border: 0; border-radius: 8px; background: #16a34a; color: #fff;
                            font-size: 12px; font-weight: 700; padding: 7px 18px; cursor: pointer; }
                .car_save:disabled { background: #d1d5db; cursor: not-allowed; }
                .car_del { border: 0; background: none; color: #9ca3af; cursor: pointer;
                           font-size: 11px; padding: 0; }
                .car_del:hover { color: #dc2626; }
            `}</style>

            <div className="car_inner">
                <div className="car_head">
                    <span className="car_title">
                        <ClaudeIcon height={16} />
                        による競合分析
                    </span>
                    <span className="car_note">
                        Claude Desktop で作成した分析レポートを保存して閲覧します。
                        {/* ⚠️ 課金が発生しないことを明記する。以前は画面から実行していた */}
                        この画面を開いても分析は実行されません。
                    </span>
                </div>

                {error !== '' && <div className="car_error">{error}</div>}
                {saveDone !== '' && <div className="car_done">{saveDone}</div>}

                {isMaster && (
                    <div className="car_bar">
                        <span className="car_note">
                            ⚠️ 分析するデータは MCP（Claude Desktop）から取得します。
                            書き方は <code>GET /analysis/report/spec</code> にあります。
                        </span>
                        <button
                            type="button"
                            className={`car_add${uploadOpen ? ' is_off' : ''}`}
                            onClick={() => { setUploadOpen(!uploadOpen); setSaveError(''); }}
                        >
                            <i className={`fa-solid ${uploadOpen ? 'fa-xmark' : 'fa-plus'} me-1`} aria-hidden="true" />
                            {uploadOpen ? '閉じる' : 'レポートを登録'}
                        </button>
                    </div>
                )}

                {uploadOpen && isMaster && (
                    <div className="car_panel">
                        <div className="car_row">
                            <span className="car_field" style={{ flex: '2 1 280px' }}>
                                <span className="car_label">見出し</span>
                                <input
                                    type="text"
                                    className="car_input"
                                    placeholder="例: 競合別 勝因・敗因分析（2026年5月期）"
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                />
                            </span>
                            <span className="car_field" style={{ flex: '0 1 160px' }}>
                                <span className="car_label">事業</span>
                                <select
                                    className="car_input"
                                    value={form.division}
                                    onChange={(e) => setForm({ ...form, division: e.target.value })}
                                >
                                    <option value="order">注文事業</option>
                                    <option value="kaeru">建売分譲事業</option>
                                    <option value="">全社</option>
                                </select>
                            </span>
                            <span className="car_field" style={{ flex: '0 1 200px' }}>
                                <span className="car_label">対象期間</span>
                                <input
                                    type="text"
                                    className="car_input"
                                    placeholder="例: 2025/06〜2026/05"
                                    value={form.period}
                                    onChange={(e) => setForm({ ...form, period: e.target.value })}
                                />
                            </span>
                            <span className="car_field" style={{ flex: '0 1 160px' }}>
                                {/* ⚠️ 画面に常時出す。⚠️ **最新だと誤解させないため** */}
                                <span className="car_label">データの時点</span>
                                <input
                                    type="date"
                                    className="car_input"
                                    value={form.dataAsOf}
                                    onChange={(e) => setForm({ ...form, dataAsOf: e.target.value })}
                                />
                            </span>
                        </div>

                        <div className="car_row align-items-center">
                            <input
                                type="file"
                                accept=".html,.htm,text/html"
                                style={{ fontSize: '12px' }}
                                onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }}
                            />
                            {fileName !== '' && (
                                <span className="car_note">
                                    {fileName}（{Math.ceil(html.length / 1024).toLocaleString()}KB）
                                </span>
                            )}
                        </div>

                        {saveError !== '' && <div className="car_error">{saveError}</div>}

                        <div className="car_row align-items-center">
                            <button
                                type="button"
                                className="car_save"
                                disabled={saving || html === ''}
                                onClick={() => { void handleUpload(); }}
                            >
                                {saving ? '登録中…' : '登録'}
                            </button>
                            <span className="car_note">登録者: {userName || '－'}</span>
                        </div>
                    </div>
                )}

                <div className="car_body">
                    <div className="car_list">
                        {loading && <div className="car_empty">読み込み中です…</div>}
                        {!loading && reports.length === 0 && (
                            <div className="car_empty">
                                まだレポートがありません。
                                {isMaster && <><br />Claude Desktop で作成して登録してください。</>}
                            </div>
                        )}
                        {reports.map((row) => (
                            <div key={row.no} className={`car_item${opened?.no === row.no ? ' is_on' : ''}`}>
                                <button
                                    type="button"
                                    className="border-0 bg-transparent p-0 text-start w-100"
                                    onClick={() => { void openReport(row); }}
                                >
                                    <span className="car_item_title d-block">{row.title}</span>
                                    <span className="car_item_meta">
                                        <span className="car_tag">{DIVISION_LABEL[row.division] ?? row.division}</span>
                                        {row.period !== '' && <span className="car_tag">{row.period}</span>}
                                        <span className="car_tag">{String(row.created).slice(0, 10)}</span>
                                        <span className="car_tag">{row.staff || '－'}</span>
                                    </span>
                                </button>
                                {isMaster && (
                                    <button
                                        type="button"
                                        className="car_del mt-1"
                                        onClick={() => { void handleDelete(row); }}
                                    >
                                        削除
                                    </button>
                                )}
                                {openingNo === row.no && <span className="car_note d-block mt-1">開いています…</span>}
                            </div>
                        ))}
                    </div>

                    <div className="car_view">
                        {opened === null ? (
                            <div className="car_empty">左の一覧からレポートを選んでください。</div>
                        ) : (
                            <>
                                <div className="car_view_head">
                                    <span className="fw-bold" style={{ fontSize: '13px' }}>{opened.title}</span>
                                    {/* ⚠️ 演出の外。⚠️ **常に出す** */}
                                    {dataNote !== '' && <span className="car_asof">{dataNote}</span>}
                                </div>

                                {showBody ? (
                                    /**
                                     * ⚠️⚠️ **sandbox は allow-scripts だけにすること。**
                                     *   ⚠️ グラフを描くスクリプトは動かす必要がある。
                                     *   ⚠️ ⚠️ **allow-same-origin を足すと、レポートの中から
                                     *     ダッシュボードのログイン情報を読めてしまう。**
                                     */
                                    <iframe
                                        className="car_frame"
                                        title={opened.title}
                                        sandbox="allow-scripts"
                                        srcDoc={opened.html}
                                    />
                                ) : (
                                    <div className="car_steps">
                                        {STEPS.map((text, index) => (
                                            <span
                                                key={text}
                                                className={`car_step${index < step ? ' is_done' : ''}`}
                                                style={{ opacity: index <= step ? 1 : 0.25 }}
                                            >
                                                <span className="car_dot" />
                                                {text}
                                                {index < step && <i className="fa-solid fa-check ms-1" aria-hidden="true" />}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompetitorAnalysisReports;
