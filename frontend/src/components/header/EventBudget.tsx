import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';
import { filterReportShops, sortShops } from './useAmbassadorMaster';
import type { MasterShop } from './useAmbassadorMaster';

/**
 * 集客イベントの広告費入力。
 *
 * ─────────────────────────────────────────────
 * **1枚のシート**にまとめている。
 *
 *   1行目      … 新規入力（右端の「登録」で登録する）
 *   2行目以降  … 登録済みの広告費（budget の medium = 'イベント'）を
 *                 id の降順で並べ、1行ずつ「修正」できる。
 *                 スクロールで15件ずつ増える。
 *
 * ⚠️⚠️ **1行目と2行目以降で「1行」の意味が違う。**
 *     新規入力   … 1行 = イベント × 選択した店舗群
 *                  （案分して**複数の budget 行**になる）
 *     登録済み   … 1行 = budget の1行（店舗1つ・金額そのまま）
 *
 *   登録済みをまとめて表示して案分し直す作りにしなかったのは、
 *   ⚠️ 実データで同じ（月・イベント名・請求先）の組でも金額がばらついている
 *     ため（2026-09-09 の実測: 154,000 / 264,000 / 513,334 など）。
 *     まとめると**手で調整された金額を均等割りで上書きしてしまう**。
 *
 * ⚠️ 左端の番号は**表示上の連番**（1から）。budget.id ではない。
 *   ⚠️ 並び替えや登録で番号は振り直される。DBの行を指す番号ではないので、
 *     問い合わせの目印には使えない。
 * ─────────────────────────────────────────────
 *
 * ⚠️ 保存先の規則（budget.section が 'use' であることなど）は
 *   backend-express/src/features/eventBudget.ts のコメントを参照。
 */

/** サーバが返す店舗。⚠️ MasterShop を満たす形にそろえてある（並べ替え関数の再利用） */
type BudgetShop = MasterShop & {
    /** budget.section に入る値（order / spec / use）。空なら集計対象外 */
    budgetSection: string;
};

type BudgetEvent = {
    id: number;
    title: string;
    startDate: string;
    endDate: string;
};

/** 登録済みの1行（= budget の1行） */
type Entry = {
    id: number;
    /** ⚠️ 元の budget_period。月が変わらなければサーバがこれを維持する */
    budgetPeriod: string;
    month: string;
    shop: string;
    cost: number;
    title: string;
    company: string;
    section: string;
    orderSection: string;
};

/**
 * 新規入力の行。⚠️ shops は shop_list.shop の配列。
 *
 * ⚠️ 2026-09-09 に**1行だけ**にした（「行を追加」を廃止）。
 *   登録済みと同じシートに並べるため、入力行が増えると
 *   「どこまでが未登録か」が分かりにくくなる。
 *   1件ずつ登録し、登録したものは下に積まれる。
 */
type Draft = {
    month: string;
    title: string;
    cost: string;
    company: string;
    shops: string[];
};

type Props = {
    show: boolean;
    setShow: React.Dispatch<React.SetStateAction<boolean>>;
};

const COLOR = {
    ink: '#303030',
    sub: '#6b7280',
    line: '#e5e7eb',
    surface: '#ffffff',
    surfaceAlt: '#f8f9fa',
    danger: '#b4635a',
    primary: '#4a6fa5'
};

const styles = {
    section: {
        fontSize: '12px',
        fontWeight: 700,
        color: COLOR.ink,
        letterSpacing: '.4px',
        marginBottom: '6px'
    } as React.CSSProperties,
    th: {
        fontSize: '11px',
        fontWeight: 'bold' as const,
        color: COLOR.sub,
        backgroundColor: COLOR.surfaceAlt,
        border: `1px solid ${COLOR.line}`,
        padding: '6px 8px',
        whiteSpace: 'nowrap' as const,
        position: 'sticky' as const,
        top: 0,
        zIndex: 2
    } as React.CSSProperties,
    td: {
        border: `1px solid ${COLOR.line}`,
        padding: '4px 6px',
        verticalAlign: 'top' as const,
        backgroundColor: COLOR.surface
    } as React.CSSProperties,
    /**
     * ⚠️⚠️ 右端の操作列は**横スクロールしても常に見える**ようにする。
     *   ⚠️ 表は `border-collapse: separate` にしてある。`collapse` だと
     *     セルの sticky が効かないブラウザがあり、実際に隠れていた。
     *   ⚠️ 背景色を必ず敷くこと。透明だと下の列の文字が透けて重なる。
     */
    stickyRight: {
        position: 'sticky' as const,
        right: 0,
        backgroundColor: COLOR.surface,
        borderLeft: `1px solid ${COLOR.line}`,
        zIndex: 1
    } as React.CSSProperties,
    // ⚠️ スプレッドシートらしく、枠線はセルに任せて入力欄からは外す
    cellInput: {
        border: 'none',
        outline: 'none',
        fontSize: '12px',
        color: COLOR.ink,
        width: '100%',
        backgroundColor: 'transparent',
        padding: '2px 0'
    } as React.CSSProperties,
    ghostButton: {
        border: `1px solid ${COLOR.line}`,
        borderRadius: '4px',
        backgroundColor: COLOR.surfaceAlt,
        color: COLOR.sub,
        fontSize: '11px',
        fontWeight: 600,
        padding: '4px 10px',
        cursor: 'pointer'
    } as React.CSSProperties,
    solidButton: {
        border: `1px solid ${COLOR.primary}`,
        borderRadius: '4px',
        backgroundColor: COLOR.primary,
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: 600,
        padding: '5px 14px',
        cursor: 'pointer'
    } as React.CSSProperties,
    /** 表を囲むスクロール枠。⚠️ 縦横どちらにもスクロールさせる */
    scroller: {
        overflow: 'auto',
        border: `1px solid ${COLOR.line}`,
        borderRadius: '6px',
        backgroundColor: COLOR.surface
    } as React.CSSProperties,
    table: {
        // ⚠️ separate にすること（stickyRight のコメント参照）
        borderCollapse: 'separate' as const,
        borderSpacing: 0,
        width: '100%',
        minWidth: '860px'
    } as React.CSSProperties
};

const yen = (value: number): string => `¥${value.toLocaleString('ja-JP')}`;

/** 一度に描画する行数。⚠️ 要件どおり15行ずつ増やす */
const PAGE = 15;

const emptyDraft = (): Draft => ({
    month: '',
    title: '',
    cost: '',
    company: '',
    shops: []
});

const EventBudget = ({ show, setShow }: Props) => {
    const [shops, setShops] = useState<BudgetShop[]>([]);
    const [events, setEvents] = useState<BudgetEvent[]>([]);

    /** 登録済み。⚠️ サーバが id 降順で返す。並べ替え直さない */
    const [entries, setEntries] = useState<Entry[]>([]);
    /** 編集中の値（id → 差分）。⚠️ 保存に成功したら消す */
    const [edits, setEdits] = useState<Record<number, Partial<Entry>>>({});
    /** 保存中の行 */
    const [savingId, setSavingId] = useState<number | null>(null);
    /** 描画する件数。スクロールで15ずつ増える */
    const [visible, setVisible] = useState(PAGE);

    const [draft, setDraft] = useState<Draft>(emptyDraft());

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState('');
    /** 店舗選択のモーダルを開いているか */
    const [openShopPicker, setOpenShopPicker] = useState(false);

    const listRef = useRef<HTMLDivElement | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post('', { request: 'event_budget' });
            setShops(Array.isArray(response.data?.shops) ? response.data.shops : []);
            setEvents(Array.isArray(response.data?.events) ? response.data.events : []);
            setEntries(Array.isArray(response.data?.entries) ? response.data.entries : []);
            setEdits({});
            setVisible(PAGE);
        } catch (e) {
            console.error('広告費入力の取得に失敗しました', e);
            setError('店舗・イベント・登録済みの広告費を取得できませんでした。');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!show) return;
        setDone('');
        void load();
    }, [show, load]);

    /**
     * 店舗の並び。
     *
     * ⚠️ **既存の filterReportShops / sortShops をそのまま使う**
     *   （components/header/useAmbassadorMaster.ts）。
     *   事業区分 → ブランド（KH/DJH/なごみ/2L/JH/PGH）→ id の順。
     *   ⚠️ 並べ替えの規則を複製しないこと。片方だけ直すと画面ごとに順が変わる。
     */
    const orderedShops = useMemo(
        () => sortShops(filterReportShops(shops)) as BudgetShop[],
        [shops]
    );

    /** 事業区分ごとにまとめる（チェックボックスの見出しに使う） */
    const groupedShops = useMemo(() => {
        const groups: { division: string; items: BudgetShop[] }[] = [];
        for (const s of orderedShops) {
            const division = (s.division ?? '').trim() || '(区分なし)';
            const last = groups[groups.length - 1];
            if (last !== undefined && last.division === division) last.items.push(s);
            else groups.push({ division, items: [s] });
        }
        return groups;
    }, [orderedShops]);

    /** 選択できる店舗名（集計対象外は除く） */
    const selectableShops = useMemo(
        () => orderedShops.filter(s => s.budgetSection !== '').map(s => s.shop ?? ''),
        [orderedShops]
    );

    // -----------------------------------------------------------------------
    // 登録済みの編集
    // -----------------------------------------------------------------------

    /** 編集後の値（差分を当てたもの） */
    const merged = (entry: Entry): Entry => ({ ...entry, ...(edits[entry.id] ?? {}) });

    const isDirty = (entry: Entry): boolean => {
        const patch = edits[entry.id];
        if (patch === undefined) return false;
        // ⚠️ 元の値に戻したときは「変更なし」にする（無駄な更新を投げない）
        return Object.entries(patch).some(([k, v]) => (entry as Record<string, unknown>)[k] !== v);
    };

    const patchEntry = (id: number, patch: Partial<Entry>) => {
        setEdits(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));
        setDone('');
    };

    const saveEntry = async (entry: Entry) => {
        const next = merged(entry);
        setSavingId(entry.id);
        setError('');
        setDone('');
        try {
            const response = await apiClient.post('', {
                request: 'event_budget',
                roll: 'update',
                id: entry.id,
                month: next.month,
                title: next.title,
                cost: next.cost,
                company: next.company,
                shop: next.shop
            });
            // ⚠️ サーバが実際に保存した内容を返すので、それで置き換える。
            //   月を変えなかったときは元の budget_period（月初でない値もある）が
            //   維持されるため、画面の値と食い違わないようにする
            const saved = response.data?.entry as Entry | undefined;
            if (saved !== undefined) {
                setEntries(prev => prev.map(e => (e.id === entry.id ? { ...e, ...saved } : e)));
            }
            setEdits(prev => {
                const copy = { ...prev };
                delete copy[entry.id];
                return copy;
            });
            setDone(response.data?.message ?? '更新しました。');
        } catch (e) {
            console.error('広告費の更新に失敗しました', e);
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '更新に失敗しました。');
        } finally {
            setSavingId(null);
        }
    };

    /**
     * スクロールで描画量を増やす。
     *
     * ⚠️ 要件どおり15件ずつ。⚠️ 末尾の40px手前で足す。0にすると
     *   スクロールしきったときにしか発火せず、体感で引っかかる。
     */
    const onListScroll = () => {
        const el = listRef.current;
        if (el === null) return;
        if (el.scrollTop + el.clientHeight < el.scrollHeight - 40) return;
        setVisible(prev => (prev >= entries.length ? prev : prev + PAGE));
    };

    // -----------------------------------------------------------------------
    // 新規入力
    // -----------------------------------------------------------------------

    const patchDraft = (patch: Partial<Draft>) => {
        setDraft(prev => ({ ...prev, ...patch }));
        setDone('');
    };

    const toggleShop = (shop: string) => {
        setDraft(prev => {
            const has = prev.shops.includes(shop);
            return { ...prev, shops: has ? prev.shops.filter(s => s !== shop) : [...prev.shops, shop] };
        });
        setDone('');
    };

    /** 事業区分ごとの一括選択。⚠️ 集計対象外の店舗は含めない */
    const toggleDivision = (items: BudgetShop[]) => {
        const target = items.filter(s => s.budgetSection !== '').map(s => s.shop ?? '');
        setDraft(prev => {
            const allSelected = target.every(s => prev.shops.includes(s));
            return {
                ...prev,
                shops: allSelected
                    ? prev.shops.filter(s => !target.includes(s))
                    : Array.from(new Set([...prev.shops, ...target]))
            };
        });
        setDone('');
    };

    const draftHasInput = (d: Draft): boolean =>
        d.month !== '' || d.title !== '' || d.cost !== '' || d.company !== '' || d.shops.length > 0;

    /**
     * 新規入力の1行を登録する。
     *
     * ⚠️ 登録後は**一覧を再取得しない**。サーバが登録した行を返すので、
     *   それを一覧の先頭へ差し込む。再取得すると表示件数（15件ずつ）や
     *   他の行の編集中の内容がリセットされてしまう。
     */
    const register = useCallback(async () => {
        if (!draftHasInput(draft)) {
            setError('入力された内容がありません。');
            return;
        }

        setSaving(true);
        setError('');
        setDone('');
        try {
            const response = await apiClient.post('', {
                request: 'event_budget',
                roll: 'save',
                rows: [
                    {
                        month: draft.month,
                        title: draft.title,
                        cost: draft.cost,
                        company: draft.company,
                        shops: draft.shops
                    }
                ]
            });

            const created = Array.isArray(response.data?.entries)
                ? (response.data.entries as Entry[])
                : [];
            // ⚠️ サーバは id の降順で返す。そのまま先頭へ積む
            if (created.length > 0) setEntries(prev => [...created, ...prev]);
            // ⚠️ 追加した分だけ表示枠も広げる。広げないと先頭に入れたのに
            //   末尾の行が押し出されて見えなくなる
            setVisible(prev => prev + created.length);

            setDone(response.data?.message ?? '登録しました。');
            // ⚠️ 成功したら入力を空にする。残すと二重登録の元になる
            //   （budget に UNIQUE キーが無いため、押し直すと同じ行が増える）
            setDraft(emptyDraft());
        } catch (e) {
            console.error('広告費の登録に失敗しました', e);
            // ⚠️ サーバは行番号付きの理由を返す。必ずそのまま出す
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '登録に失敗しました。');
        } finally {
            setSaving(false);
        }
    }, [draft]);

    const close = () => {
        const dirty = draftHasInput(draft) || entries.some(isDirty);
        // ⚠️ 入力途中で閉じると消える。必ず確認する
        if (dirty && !window.confirm('保存していない内容があります。閉じてよろしいですか?')) return;
        setDraft(emptyDraft());
        setEdits({});
        setOpenShopPicker(false);
        setShow(false);
    };

    /** 案分後の1店舗あたり金額。⚠️ 切り上げ（サーバと同じ） */
    const perShop = (): number | null => {
        const cost = Number(draft.cost);
        if (!Number.isFinite(cost) || cost === 0 || draft.shops.length === 0) return null;
        return Math.ceil(cost / draft.shops.length);
    };

    /**
     * イベント名の選択肢。
     *
     * ⚠️⚠️ **保存済みの値が選択肢に無いことが多い。**
     *   budget.note には「2025/03_住まいづくりフェア出展料」のような
     *   event_calendar に無い名前が入っている（2026-09-09 時点で
     *   note 32種類に対し対象イベントは12件）。
     *   現在の値を選択肢に補わないと、他の項目を直すだけで
     *   **イベント名が消える**。
     */
    const titleOptions = (current: string) => (
        <>
            <option value="">未選択</option>
            {current !== '' && !events.some(ev => ev.title === current) && (
                <option value={current}>{current}（現在の値）</option>
            )}
            {events.map(ev => (
                <option value={ev.title} key={ev.id}>
                    {ev.title}（{ev.startDate}）
                </option>
            ))}
        </>
    );

    /**
     * 店舗の選択肢（登録済みの修正用）。
     *
     * ⚠️ 既存データには shop に「買い:中古リノベ」のような取引区分が
     *   入っている行が実在する。選択肢に補わないと店舗名が消える。
     */
    const shopOptions = (current: string) => (
        <>
            <option value="">未選択</option>
            {current !== '' && !selectableShops.includes(current) && (
                <option value={current}>{current}（現在の値）</option>
            )}
            {orderedShops.map(s => (
                <option value={s.shop ?? ''} key={s.id ?? s.shop} disabled={s.budgetSection === ''}>
                    {s.shop}{s.budgetSection === '' ? '（集計対象外）' : ''}
                </option>
            ))}
        </>
    );

    return (
        <>
            <Modal show={show} onHide={close} size="xl" centered>
                <Modal.Header closeButton style={{ borderBottom: `1px solid ${COLOR.line}`, padding: '12px 16px' }}>
                    <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: COLOR.ink, letterSpacing: '.4px' }}>
                            広告費入力
                        </div>
                        <div style={{ fontSize: '11px', color: COLOR.sub, marginTop: '2px' }}>
                            集客イベントの広告費を登録・修正します。
                        </div>
                    </div>
                </Modal.Header>

                {/* ⚠️ 縦幅を確保する。行を増やすと下の「登録」ボタンまで届かなくなるため、
                    本文の高さを決めて中でスクロールさせる */}
                <Modal.Body
                    style={{
                        backgroundColor: COLOR.surfaceAlt,
                        padding: '14px 16px',
                        maxHeight: '80vh',
                        overflowY: 'auto'
                    }}
                >
                    {error !== '' && (
                        <div
                            className="mb-3"
                            style={{
                                border: `1px solid ${COLOR.danger}`,
                                borderRadius: '4px',
                                color: COLOR.danger,
                                backgroundColor: COLOR.surface,
                                fontSize: '11px',
                                padding: '8px 10px',
                                // ⚠️ サーバは複数行の理由を改行で返す
                                whiteSpace: 'pre-wrap'
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {done !== '' && (
                        <div
                            className="mb-3"
                            style={{
                                border: `1px solid ${COLOR.primary}`,
                                borderRadius: '4px',
                                color: COLOR.primary,
                                backgroundColor: COLOR.surface,
                                fontSize: '11px',
                                padding: '8px 10px'
                            }}
                        >
                            {done}
                        </div>
                    )}

                    {loading ? (
                        <div className="text-center py-4" style={{ fontSize: '12px', color: COLOR.sub }}>
                            <i className="fa-solid fa-arrows-rotate me-1" />読み込み中…
                        </div>
                    ) : (
                        <>
                            <div style={styles.section}>
                                広告費
                                <span style={{ fontWeight: 400, color: COLOR.sub, marginLeft: '8px', fontSize: '11px' }}>
                                    1行目が新規入力／2行目以降が登録済み {entries.length}件（新しい順・{Math.min(visible, entries.length)}件を表示）
                                </span>
                            </div>

                            <div
                                ref={listRef}
                                onScroll={onListScroll}
                                // ⚠️ ここに高さを与えることで、スクロール量を見て15件ずつ足せる
                                style={{ ...styles.scroller, maxHeight: '58vh' }}
                            >
                                <table style={styles.table}>
                                    <thead>
                                        <tr>
                                            <th style={{ ...styles.th, width: '46px' }}>No</th>
                                            <th style={{ ...styles.th, width: '120px' }}>開催月</th>
                                            <th style={{ ...styles.th, minWidth: '210px' }}>イベント名</th>
                                            <th style={{ ...styles.th, width: '120px' }}>費用（円）</th>
                                            <th style={{ ...styles.th, minWidth: '170px' }}>該当店舗</th>
                                            <th style={{ ...styles.th, minWidth: '130px' }}>請求先</th>
                                            {/* ⚠️ 右端に固定。見出しは top も固定しているため zIndex を高くする */}
                                            <th style={{ ...styles.th, ...styles.stickyRight, width: '66px', zIndex: 3 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* ============ 1行目: 新規入力 ============ */}
                                        <tr>
                                            {/*
                                              ⚠️ 新規入力行には番号を振らない。
                                                番号は登録済みの並び順を示すもので、
                                                まだ登録していない行に番号を付けると
                                                登録の前後で番号がずれて読みにくくなる。
                                            */}
                                            <td style={{ ...styles.td, textAlign: 'center', fontSize: '10px', color: COLOR.primary, fontWeight: 700 }}>
                                                新規
                                            </td>
                                            <td style={styles.td}>
                                                <input
                                                    type="month"
                                                    style={styles.cellInput}
                                                    value={draft.month}
                                                    onChange={(e) => patchDraft({ month: e.target.value })}
                                                />
                                            </td>
                                            <td style={styles.td}>
                                                <select
                                                    style={styles.cellInput}
                                                    value={draft.title}
                                                    title={draft.title || 'イベント名'}
                                                    onChange={(e) => patchDraft({ title: e.target.value })}
                                                >
                                                    {titleOptions(draft.title)}
                                                </select>
                                            </td>
                                            <td style={styles.td}>
                                                {/* ⚠️ 手入力を許可する（要件）。type=number なので単位は入れない */}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    style={{ ...styles.cellInput, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                                                    value={draft.cost}
                                                    placeholder="0"
                                                    onChange={(e) => patchDraft({ cost: e.target.value })}
                                                />
                                                {/* 案分後の金額。⚠️ 切り上げのため合計が入力額を上回ることがある */}
                                                {perShop() !== null && draft.shops.length > 1 && (
                                                    <div style={{ fontSize: '10px', color: COLOR.sub, textAlign: 'right', marginTop: '2px' }}>
                                                        {draft.shops.length}店舗 × {yen(perShop() as number)}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={styles.td}>
                                                <button
                                                    type="button"
                                                    style={{ ...styles.ghostButton, width: '100%', textAlign: 'left' }}
                                                    onClick={() => setOpenShopPicker(true)}
                                                >
                                                    {draft.shops.length === 0 ? '店舗を選択' : `${draft.shops.length}店舗を選択中`}
                                                    <i className="fa-solid fa-caret-down ms-2" />
                                                </button>
                                                {draft.shops.length > 0 && (
                                                    <div style={{ fontSize: '10px', color: COLOR.sub, marginTop: '3px', lineHeight: 1.5 }}>
                                                        {draft.shops.join(' / ')}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={styles.td}>
                                                <input
                                                    type="text"
                                                    style={styles.cellInput}
                                                    placeholder="請求先"
                                                    value={draft.company}
                                                    onChange={(e) => patchDraft({ company: e.target.value })}
                                                />
                                            </td>
                                            <td style={{ ...styles.td, ...styles.stickyRight, textAlign: 'center' }}>
                                                {/* ⚠️ 保存中は必ず無効化する。budget に UNIQUE キーが無く、
                                                    二重送信すると同じ行が2組できる */}
                                                <button
                                                    type="button"
                                                    style={{ ...styles.solidButton, padding: '3px 10px' }}
                                                    disabled={saving}
                                                    onClick={() => void register()}
                                                >
                                                    {saving ? '…' : '登録'}
                                                </button>
                                            </td>
                                        </tr>

                                        {/* ============ 2行目以降: 登録済み ============ */}
                                        {entries.slice(0, visible).map((entry, index) => {
                                            const v = merged(entry);
                                            const dirty = isDirty(entry);
                                            return (
                                                <tr key={entry.id}>
                                                    {/*
                                                      ⚠️⚠️ **表示上の連番（1から）。budget.id ではない。**
                                                        以前は budget.id（29146 等）を出していた。
                                                        ⚠️ 並び替えや新規登録で番号は振り直されるため、
                                                          DBの行を指す目印には使えない。
                                                    */}
                                                    <td style={{ ...styles.td, fontSize: '11px', color: COLOR.sub, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                                        {index + 1}
                                                    </td>
                                                    <td style={styles.td}>
                                                        <input
                                                            type="month"
                                                            style={styles.cellInput}
                                                            value={v.month}
                                                            onChange={(e) => patchEntry(entry.id, { month: e.target.value })}
                                                        />
                                                    </td>
                                                    <td style={styles.td}>
                                                        <select
                                                            style={styles.cellInput}
                                                            value={v.title}
                                                            title={v.title}
                                                            onChange={(e) => patchEntry(entry.id, { title: e.target.value })}
                                                        >
                                                            {titleOptions(v.title)}
                                                        </select>
                                                    </td>
                                                    <td style={styles.td}>
                                                        {/*
                                                          ⚠️⚠️ **min を付けない。**
                                                            ・0 を入れられるようにする。行を消す機能が無いので、
                                                              **0円に直すのが実質の取り消し**になる（2026-09-09 決定）。
                                                            ・負の値も実データに存在する（返金・修正の伝票。
                                                              budget_value の最小値 -18,700）。min="0" を付けると
                                                              その行が入力不正として扱われる。
                                                          ⚠️ 新規入力の欄（1行目）は 0 を認めないので min="0" のままにしている。
                                                        */}
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            style={{ ...styles.cellInput, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                                                            value={String(v.cost)}
                                                            onChange={(e) => patchEntry(entry.id, { cost: Number(e.target.value) })}
                                                        />
                                                    </td>
                                                    <td style={styles.td}>
                                                        <select
                                                            style={styles.cellInput}
                                                            value={v.shop}
                                                            title={`${v.section || '区分なし'} / ${v.orderSection || '課なし'}`}
                                                            onChange={(e) => patchEntry(entry.id, { shop: e.target.value })}
                                                        >
                                                            {shopOptions(v.shop)}
                                                        </select>
                                                    </td>
                                                    <td style={styles.td}>
                                                        <input
                                                            type="text"
                                                            style={styles.cellInput}
                                                            placeholder="請求先"
                                                            value={v.company}
                                                            onChange={(e) => patchEntry(entry.id, { company: e.target.value })}
                                                        />
                                                    </td>
                                                    <td style={{ ...styles.td, ...styles.stickyRight, textAlign: 'center' }}>
                                                        <button
                                                            type="button"
                                                            style={{
                                                                ...styles.ghostButton,
                                                                padding: '3px 8px',
                                                                // ⚠️ 変更が無い行は押せないようにする（無駄な更新を避ける）
                                                                color: dirty ? COLOR.primary : COLOR.sub,
                                                                borderColor: dirty ? COLOR.primary : COLOR.line,
                                                                cursor: dirty ? 'pointer' : 'default'
                                                            }}
                                                            disabled={!dirty || savingId === entry.id}
                                                            onClick={() => void saveEntry(entry)}
                                                        >
                                                            {savingId === entry.id ? '…' : '修正'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {visible < entries.length && (
                                    <div className="text-center py-2" style={{ fontSize: '10px', color: COLOR.sub }}>
                                        スクロールするとさらに{PAGE}件表示 ─ 残り {entries.length - visible} 件
                                    </div>
                                )}
                            </div>

                            <div className="mt-3" style={{ fontSize: '10px', color: COLOR.sub, lineHeight: 1.6 }}>
                                費用は選択した店舗数で案分し、<strong>1円未満は切り上げ</strong>て登録します。
                                そのため店舗ごとの合計が入力額をわずかに上回ることがあります。
                                <br />
                                ⚠️ 登録は取り消せません（同じ内容を2回押すと2組登録されます）。
                                登録した行はすぐ下に追加され、そのまま修正できます。
                                <br />
                                ⚠️ 行を削除する機能はありません。誤登録は<strong>費用を 0 に直して「修正」</strong>してください
                                （新規登録では 0 は登録できません）。
                                <br />
                                ⚠️ 左端の番号は表示上の連番です（データベースのIDではありません）。
                            </div>
                        </>
                    )}
                </Modal.Body>
            </Modal>

            {/*
              店舗選択。
              ⚠️⚠️ **表の中に絶対配置で置かない。** 表は overflow でスクロール
                させており、スクロール領域は絶対配置の子要素を切り取る。
                z-index を上げても外には出られないため、別モーダルにしている。
              ⚠️ 44店舗あるので縦を広く取る（modal-lg ＋ 本文スクロール）。
            */}
            <Modal
                show={openShopPicker}
                onHide={() => setOpenShopPicker(false)}
                size="lg"
                centered
                // ⚠️ 親（広告費入力）より前面に出す
                style={{ zIndex: 2000 }}
            >
                <Modal.Header closeButton style={{ borderBottom: `1px solid ${COLOR.line}`, padding: '10px 14px' }}>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: COLOR.ink }}>該当店舗の選択</div>
                        <div style={{ fontSize: '11px', color: COLOR.sub, marginTop: '2px' }}>
                            新規入力
                            {draft.shops.length > 0 && (
                                <span className="ms-2">{draft.shops.length}店舗を選択中</span>
                            )}
                        </div>
                    </div>
                </Modal.Header>
                <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto', padding: '12px 14px' }}>
                    {groupedShops.map(group => (
                        <div key={group.division} className="mb-3">
                            <div
                                className="d-flex align-items-center justify-content-between"
                                style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: COLOR.sub,
                                    borderBottom: `1px solid ${COLOR.line}`,
                                    paddingBottom: '3px',
                                    marginBottom: '5px'
                                }}
                            >
                                <span>{group.division}</span>
                                {group.items.some(sh => sh.budgetSection !== '') && (
                                    <span
                                        style={{ cursor: 'pointer', color: COLOR.primary, fontWeight: 600 }}
                                        onClick={() => toggleDivision(group.items)}
                                    >
                                        一括選択 / 解除
                                    </span>
                                )}
                            </div>
                            {/* ⚠️ 店舗数が多いので複数列に流す */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '2px 12px' }}>
                                {group.items.map(sh => {
                                    const shop = sh.shop ?? '';
                                    // ⚠️⚠️ 事業区分が集計対象外の店舗は選ばせない。
                                    //   section を空で登録すると、広告費の絞り込み
                                    //   （order / spec / use）すべてに掛からず
                                    //   **どこからも見えない行**になる
                                    const disabled = sh.budgetSection === '';
                                    return (
                                        <label
                                            key={sh.id ?? shop}
                                            className="d-flex align-items-center"
                                            style={{
                                                fontSize: '12px',
                                                color: disabled ? COLOR.sub : COLOR.ink,
                                                padding: '2px 0',
                                                cursor: disabled ? 'not-allowed' : 'pointer'
                                            }}
                                            title={
                                                disabled
                                                    ? `事業区分（${sh.division || '未設定'}）が広告費の集計対象外のため選択できません`
                                                    : `${sh.division} / ${sh.section}`
                                            }
                                        >
                                            <input
                                                type="checkbox"
                                                className="me-2"
                                                disabled={disabled}
                                                checked={draft.shops.includes(shop)}
                                                onChange={() => toggleShop(shop)}
                                            />
                                            {shop}
                                            {disabled && <span style={{ fontSize: '10px', marginLeft: '4px' }}>（集計対象外）</span>}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </Modal.Body>
                <Modal.Footer style={{ borderTop: `1px solid ${COLOR.line}`, padding: '8px 14px' }}>
                    <button type="button" style={styles.solidButton} onClick={() => setOpenShopPicker(false)}>
                        決定
                    </button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default EventBudget;
