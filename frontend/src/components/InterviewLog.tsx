import React, { useCallback, useEffect, useRef, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../utils/apiClient';
import { dateFormate } from '../utils/informationUtils';

/**
 * 商談ステップ（RankOrder / RankKaeru / RankResale から開く）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-09 に作り直した。以前は編集内容が保存されなかった。**
 *
 *   直した欠陥
 *
 *   (1) 既存行の編集・削除に**保存処理が無かった**
 *       日付・アクション・備考の onChange と削除ボタンは
 *       `add: true` を立てるだけで、送信するコードがどこにも無かった
 *       （`add` は一度も参照されていない）。新規行の「追加」を押したときに
 *       ついでに送られるだけで、編集して閉じると失われていた。
 *
 *   (2) ⚠️⚠️ **ソート後の index で未ソートの配列を書き換えていた**
 *         [...interview_log].sort(...).map((item, index) =>
 *             prev.interview_log.map((log, i) => i === index ? ... )
 *       日付順と登録順が違う顧客では、**編集した行とは別の行が壊れた**。
 *       → 元の index を持ったまま並べ替える（下の ordered）。
 *
 *   (3) 備考が onBlur でしか state に入らなかった
 *       → onChange に変更。
 *
 *   (4) 本番URL直書き（apiClient を通していなかった）
 *       → ローカル開発から本番DBを読み書きしていた。apiClient に変更。
 *
 *   (5) アクションの選択肢が注文用の固定リストだった
 *       ⚠️「オンライン面談」はどの actionMap にも無く、**選んでもKPIが
 *         保存されなかった**。建売の「申し込み」「自社契約」、
 *         中古の「売買契約」などは選べなかった。
 *       → サーバが顧客の事業に応じた選択肢を返す（response.actions）。
 * ─────────────────────────────────────────────
 *
 * ⚠️ KPI 日付（master_data / master_data_kaeru / master_data_resale）は
 *   **サーバが interview_log から導出**する。
 *   同じアクションが複数あれば最も古い日付を採り、あとから直せば上書きする。
 *   詳細は backend-express/src/features/interviewKpi.ts を参照。
 */

type InterviewAction = {
    day: string;
    action: string;
    note: string;
    /** ⚠️ 顧客詳細（TableInterview）が付ける項目。ここでは表示のみ */
    staff?: string;
};

type Customer = {
    customer: string;
    medium: string;
    register: string;
};

type Props = {
    idValue: string,
    setInterviewId: React.Dispatch<React.SetStateAction<string>>
};

/**
 * サーバが選択肢を返さなかったときの既定（注文用）。
 *
 * ⚠️ ① の PHP にフォールバックした場合、`actions` が返ってこない。
 *   そのときだけこれを使う。⚠️ 以前の固定リストにあった「オンライン面談」は
 *   入れない。どの actionMap にも無く、選んでも KPI が保存されないため。
 */
const FALLBACK_ACTIONS = [
    '資料送付',
    '0次接客',
    '初回面談',
    '2回目以降面談',
    '事前審査',
    'LINEグループ作成',
    '契約'
];

/* ---------------------------------------------------------------------------
 * 見た目
 *
 * ⚠️ Bootstrap の table-light / btn などに寄せず、TableInterview.tsx と
 *   同じ「くすんだ SaaS 系」に揃える。彩度を落とした藍とグレーで構成する。
 * ------------------------------------------------------------------------- */
const COLOR = {
    ink: '#303030',
    sub: '#6b7280',
    line: '#e5e7eb',
    surface: '#ffffff',
    surfaceAlt: '#f8f9fa',
    accent: '#4a5568',
    danger: '#b4635a',
    primary: '#4a6fa5'
};

const styles = {
    field: {
        border: `1px solid ${COLOR.line}`,
        borderRadius: '4px',
        fontSize: '12px',
        color: COLOR.ink,
        padding: '4px 6px',
        backgroundColor: COLOR.surface,
        outline: 'none',
        letterSpacing: '.4px'
    } as React.CSSProperties,
    label: {
        fontSize: '10px',
        fontWeight: 600,
        color: COLOR.sub,
        letterSpacing: '.8px',
        marginBottom: '3px'
    } as React.CSSProperties,
    card: {
        border: `1px solid ${COLOR.line}`,
        borderRadius: '6px',
        backgroundColor: COLOR.surface,
        padding: '10px 12px'
    } as React.CSSProperties,
    ghostButton: {
        border: `1px solid ${COLOR.line}`,
        borderRadius: '4px',
        backgroundColor: COLOR.surfaceAlt,
        color: COLOR.sub,
        fontSize: '11px',
        fontWeight: 600,
        padding: '5px 10px',
        cursor: 'pointer',
        letterSpacing: '.4px'
    } as React.CSSProperties,
    solidButton: {
        border: `1px solid ${COLOR.primary}`,
        borderRadius: '4px',
        backgroundColor: COLOR.primary,
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: 600,
        padding: '5px 12px',
        cursor: 'pointer',
        letterSpacing: '.4px'
    } as React.CSSProperties
};

/** 各行の左に出す縦線と丸。⚠️ 以前の「↓」の羅列より流れが読みやすい */
const Rail = ({ last, tone }: { last: boolean, tone: string }) => (
    <div style={{ width: '18px', flex: '0 0 18px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: tone, marginTop: '12px' }} />
        {/* ⚠️ 最後の行では線を伸ばさない。行が続いているように見えてしまう */}
        {!last && <div style={{ width: '1px', flex: 1, backgroundColor: COLOR.line, marginTop: '3px' }} />}
    </div>
);

const InterviewLog = ({ idValue, setInterviewId }: Props) => {
    const [logs, setLogs] = useState<InterviewAction[]>([]);
    const [shop, setShop] = useState('');
    const [name, setName] = useState('');
    const [customer, setCustomer] = useState<Customer>({ customer: '', medium: '', register: '' });
    const [actions, setActions] = useState<string[]>([]);

    const [draft, setDraft] = useState<InterviewAction>({ day: '', action: '', note: '' });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState('');
    const [savedAt, setSavedAt] = useState('');

    /**
     * 画面で削除された行。
     *
     * ⚠️⚠️ サーバはこれを見て KPI 列を空にできるか判定する。
     *   ⚠️ 無条件には空にしない（残りの商談ステップから導出できず、かつ
     *     現在のKPI値が削除した日付と一致するときだけ）。
     *   ポータル同期や顧客詳細で直接入れた日付を消さないための条件。
     *   詳細は backend-express/src/features/interviewKpi.ts の
     *   resolveClearedColumns を参照。
     */
    const removedRef = useRef<InterviewAction[]>([]);

    useEffect(() => {
        if (!idValue) return;

        // ⚠️ 顧客を切り替えたら前回の状態を捨てる。残すと別人の記録を保存しうる
        setLogs([]);
        setCustomer({ customer: '', medium: '', register: '' });
        setActions([]);
        setDraft({ day: '', action: '', note: '' });
        setDirty(false);
        setError('');
        setSavedAt('');
        removedRef.current = [];

        const fetchData = async () => {
            setLoading(true);
            try {
                // ⚠️ 本番URLの直書きに戻さないこと（冒頭の欠陥(4)）
                const response = await apiClient.post('', { id: idValue, request: 'interviewLog' });
                const interview = response.data?.interview ?? {};

                const raw = interview.interview_log;
                const parsed: InterviewAction[] =
                    typeof raw === 'string' && raw.trim() !== ''
                        ? JSON.parse(raw)
                        : Array.isArray(raw)
                            ? raw
                            : [];

                setLogs(Array.isArray(parsed) ? parsed : []);
                setShop(interview.shop ?? '');
                setName(interview.name ?? '');

                // ⚠️ PHP にフォールバックすると customer が false で返る。
                //   そのまま setCustomer すると customer.customer で落ちる
                const c = response.data?.customer;
                setCustomer(
                    c && typeof c === 'object'
                        ? { customer: c.customer ?? '', medium: c.medium ?? '', register: c.register ?? '' }
                        : { customer: '', medium: '', register: '' }
                );

                const list = response.data?.actions;
                setActions(Array.isArray(list) && list.length > 0 ? list : FALLBACK_ACTIONS);
            } catch (e) {
                console.error('商談ステップの取得に失敗しました', e);
                setError('商談ステップを取得できませんでした。');
                setActions(FALLBACK_ACTIONS);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [idValue]);

    /**
     * 保存。
     *
     * ⚠️⚠️ **編集・削除・追加のすべてがここを通る。** 以前は追加のときだけ
     *   送信していたため、編集して閉じると失われていた（冒頭の欠陥(1)）。
     */
    const save = useCallback(
        async (nextLogs: InterviewAction[]) => {
            setSaving(true);
            setError('');
            try {
                await apiClient.post('', {
                    request: 'interviewLog_update_interview',
                    id: idValue,
                    shop,
                    name: name || customer.customer,
                    interview_log: nextLogs,
                    // ⚠️ 削除された行。KPI列を空にできるかの判定に使う
                    removed: removedRef.current
                });
                // ⚠️ 送信できた分だけ消す。失敗時に消すと再保存で判定材料が無くなる
                removedRef.current = [];
                setDirty(false);
                setSavedAt(
                    new Intl.DateTimeFormat('ja-JP', {
                        timeZone: 'Asia/Tokyo',
                        hour: '2-digit',
                        minute: '2-digit'
                    }).format(new Date())
                );
            } catch (e) {
                console.error('商談ステップの保存に失敗しました', e);
                // ⚠️ 面談中に黙って失敗すると聞き取りが無駄になる。必ず知らせる
                setError('保存できませんでした。通信状況を確認して再度お試しください。');
            } finally {
                setSaving(false);
            }
        },
        [idValue, shop, name, customer.customer]
    );

    /** 既存行の編集。⚠️ 引数の index は**元の配列の index** */
    const editLog = (index: number, patch: Partial<InterviewAction>) => {
        setLogs(prev => prev.map((log, i) => (i === index ? { ...log, ...patch } : log)));
        setDirty(true);
    };

    const removeLog = (index: number) => {
        if (!window.confirm('この商談ステップを削除しますか?')) return;

        const target = logs[index];
        const next = logs.filter((_, i) => i !== index);

        // ⚠️ 削除した行を覚えておく（KPI列を空にできるかの判定に使う）
        if (target) removedRef.current = [...removedRef.current, target];

        setLogs(next);
        // ⚠️ 削除は取り消せないので即座に保存する。
        //   下書きのまま閉じられると、消したつもりが残る
        void save(next);
    };

    const addLog = () => {
        if (!draft.day || !draft.action) {
            alert('日付とアクション内容を入力してください。');
            return;
        }
        const next = [...logs, { day: draft.day, action: draft.action, note: draft.note }];
        setLogs(next);
        setDraft({ day: '', action: '', note: '' });
        void save(next);
    };

    const close = () => {
        // ⚠️⚠️ 未保存の編集があれば必ず確認する。以前は黙って失われていた
        if (dirty && !window.confirm('保存していない変更があります。閉じてよろしいですか?')) return;
        setInterviewId('');
    };

    /**
     * 表示用に日付順で並べる。
     *
     * ⚠️⚠️ **元の index を持たせる。** これが無いと、並べ替えた後の index で
     *   元の配列を書き換えてしまい、**別の行が壊れる**（冒頭の欠陥(2)）。
     * ⚠️ sort は必ずコピーに対して行う。state の配列を直接 sort すると
     *   React が変更を検知できない。
     */
    const ordered = logs
        .map((log, index) => ({ log, index }))
        .sort((a, b) => {
            const da = dateFormate(a.log.day ?? '');
            const db = dateFormate(b.log.day ?? '');
            // ⚠️ 日付が同じなら登録順を保つ（並びを安定させる）
            if (da === db) return a.index - b.index;
            // ⚠️ Date に変換しない。'YYYY-MM-DD' は文字列比較で日付順になる
            return da < db ? -1 : 1;
        });

    const actionSelect = (value: string, onChange: (v: string) => void) => (
        <select
            style={{ ...styles.field, width: '150px' }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            title={value || 'アクション内容'}
        >
            <option value="">未選択</option>
            {/* ⚠️ 保存済みの値が選択肢に無い場合（旧KPIや事業変更）に消えないよう補う */}
            {value !== '' && !actions.includes(value) && (
                <option value={value}>{value}（現在の値）</option>
            )}
            {actions.map(a => (
                <option value={a} key={a}>{a}</option>
            ))}
        </select>
    );

    return (
        <Modal show={!!idValue} onHide={close} size="lg" centered>
            <Modal.Header closeButton style={{ borderBottom: `1px solid ${COLOR.line}`, padding: '12px 16px' }}>
                <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: COLOR.ink, letterSpacing: '.4px' }}>
                        {customer.customer ? `${customer.customer} 様` : '商談ステップ'}
                    </div>
                    <div style={{ fontSize: '11px', color: COLOR.sub, marginTop: '2px' }}>
                        商談ステップ
                        {shop && <span style={{ marginLeft: '8px' }}>{shop}</span>}
                    </div>
                </div>
            </Modal.Header>

            <Modal.Body style={{ backgroundColor: COLOR.surfaceAlt, padding: '14px 16px' }}>
                {/* 状態の表示。⚠️ 保存されたかどうかが分かるようにする */}
                <div className="d-flex align-items-center justify-content-between mb-3" style={{ fontSize: '11px', minHeight: '26px' }}>
                    <div style={{ color: COLOR.sub }}>
                        {saving && <span><i className="fa-solid fa-arrows-rotate me-1" />保存中…</span>}
                        {!saving && dirty && <span style={{ color: COLOR.danger }}>未保存の変更があります</span>}
                        {!saving && !dirty && savedAt !== '' && <span>{savedAt} に保存しました</span>}
                    </div>
                    {dirty && (
                        <button type="button" style={styles.solidButton} disabled={saving} onClick={() => void save(logs)}>
                            変更を保存
                        </button>
                    )}
                </div>

                {error !== '' && (
                    <div
                        className="mb-3"
                        style={{ ...styles.card, borderColor: COLOR.danger, color: COLOR.danger, fontSize: '11px' }}
                    >
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-4" style={{ fontSize: '12px', color: COLOR.sub }}>
                        <i className="fa-solid fa-arrows-rotate me-1" />読み込み中…
                    </div>
                ) : (
                    <>
                        {/* 反響取得（起点）。⚠️ ここは編集できない */}
                        <div className="d-flex">
                            <Rail last={false} tone={COLOR.accent} />
                            <div style={{ ...styles.card, flex: 1, marginBottom: '8px', backgroundColor: COLOR.surfaceAlt }}>
                                <div className="d-flex align-items-center flex-wrap" style={{ gap: '10px', fontSize: '12px', color: COLOR.ink }}>
                                    <span style={{ fontVariantNumeric: 'tabular-nums', color: COLOR.sub }}>
                                        {customer.register ? dateFormate(customer.register).replace(/-/g, '/') : '日付未登録'}
                                    </span>
                                    <span style={{ fontWeight: 600 }}>反響取得</span>
                                    {customer.medium && <span style={{ color: COLOR.sub }}>{customer.medium}</span>}
                                </div>
                            </div>
                        </div>

                        {/* 既存の商談ステップ */}
                        {ordered.map(({ log, index }, position) => (
                            <div className="d-flex" key={index}>
                                <Rail last={false} tone={COLOR.primary} />
                                <div style={{ ...styles.card, flex: 1, marginBottom: '8px' }}>
                                    <div className="d-flex align-items-start flex-wrap" style={{ gap: '8px' }}>
                                        <div>
                                            <div style={styles.label}>日付</div>
                                            <input
                                                type="date"
                                                style={{ ...styles.field, width: '140px' }}
                                                value={dateFormate(log.day ?? '')}
                                                onChange={(e) => editLog(index, { day: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <div style={styles.label}>アクション</div>
                                            {actionSelect(log.action ?? '', (v) => editLog(index, { action: v }))}
                                        </div>
                                        <div style={{ flex: 1, minWidth: '220px' }}>
                                            <div style={styles.label}>備考</div>
                                            <textarea
                                                style={{ ...styles.field, width: '100%', resize: 'vertical' }}
                                                placeholder="面談内容を記載"
                                                value={log.note ?? ''}
                                                rows={Math.max(2, Math.ceil((log.note ?? '').length / 46))}
                                                onChange={(e) => editLog(index, { note: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between mt-2">
                                        <div style={{ fontSize: '10px', color: COLOR.sub }}>
                                            {position + 1} 件目
                                            {log.staff && <span style={{ marginLeft: '8px' }}>記録者: {log.staff}</span>}
                                        </div>
                                        <button
                                            type="button"
                                            style={{ ...styles.ghostButton, color: COLOR.danger }}
                                            onClick={() => removeLog(index)}
                                        >
                                            削除
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* 新規追加 */}
                        <div className="d-flex">
                            <Rail last={true} tone={COLOR.line} />
                            <div style={{ ...styles.card, flex: 1, borderStyle: 'dashed' }}>
                                <div className="d-flex align-items-start flex-wrap" style={{ gap: '8px' }}>
                                    <div>
                                        <div style={styles.label}>日付</div>
                                        <input
                                            type="date"
                                            style={{ ...styles.field, width: '140px' }}
                                            value={draft.day}
                                            onChange={(e) => setDraft(prev => ({ ...prev, day: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <div style={styles.label}>アクション</div>
                                        {actionSelect(draft.action, (v) => setDraft(prev => ({ ...prev, action: v })))}
                                    </div>
                                    <div style={{ flex: 1, minWidth: '220px' }}>
                                        <div style={styles.label}>備考</div>
                                        {/* ⚠️ onBlur ではなく onChange。以前はフォーカスを外さないと
                                            state に入らず、取りこぼす経路があった（冒頭の欠陥(3)） */}
                                        <textarea
                                            style={{ ...styles.field, width: '100%', resize: 'vertical' }}
                                            placeholder="面談内容を記載"
                                            rows={2}
                                            value={draft.note}
                                            onChange={(e) => setDraft(prev => ({ ...prev, note: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="d-flex justify-content-end mt-2">
                                    <button type="button" style={styles.solidButton} disabled={saving} onClick={addLog}>
                                        追加
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-3" style={{ fontSize: '10px', color: COLOR.sub, lineHeight: 1.6 }}>
                            アクションを登録すると、顧客台帳のKPI日付（初回面談・契約日など）も更新されます。
                            同じアクションが複数ある場合は<strong>最も古い日付</strong>が採用されます。
                        </div>
                    </>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default InterviewLog;
