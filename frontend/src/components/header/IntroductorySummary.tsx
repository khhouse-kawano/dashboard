import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';

/**
 * 紹介キャンペーンサマリー（ヘッダー → 紹介キャンペーン → 紹介キャンペーンサマリー）。v2.2.192 新規。
 *
 * ─────────────────────────────────────────────
 * ⚠️ データは ② の `introductory_summary`（features/introductory/summary.ts）。
 *   ⚠️⚠️ **① に PHP ハンドラは無い。** ⚠️ ② が落ちるとこの画面は動かない。
 *
 * ⚠️⚠️ **対象は注文・建売・中古の顧客台帳の「紹介」**（sales_promotion_name）。
 *   ⚠️ お友達紹介の受付表（反響一覧＝InquiryIntroductory）とは別物。
 *
 * ⚠️ 絞り込み（期間・店舗・エリア）は ⚠️⚠️ **すべてサーバーで行う**（選ぶたびに取り直す）。
 *   ⚠️ 期間は反響取得日。⚠️ 店舗は親店舗（⚠️ 併売店の担当は親店舗に含まれる）。
 *
 * ⚠️ 推論の文章は出さない（AI を動かさない。数字だけ。2026-10-15 の指示）。
 * ⚠️ 見た目は GoogleReview.tsx に合わせてある。
 * ⚠️ モーダルは ⚠️⚠️ **全画面**（Header.tsx の isFullscreenMenu）。
 *   ⚠️ ⚠️ **閉じるボタンは Header.tsx 側が出すので、ここには作らないこと。**
 * ─────────────────────────────────────────────
 */

/** 歩留まり1行。⚠️ ② の FunnelRow と同じ形 */
type FunnelRow = {
    key: string;
    inquiry: number;
    meeting: number;
    next: number;
    contract: number;
    lagMedian: number | null;
};

type Cross = { rows: string[]; cells: Record<string, Record<string, FunnelRow>> };
type ShopOption = { name: string; area: string; division: string };

type Summary = {
    total: FunnelRow;
    bySource: FunnelRow[];
    byDivision: FunnelRow[];
    byBrand: FunnelRow[];
    byArea: FunnelRow[];
    byShop: FunnelRow[];
    /** 担当別（v2.2.218）。⚠️ 注文・建売だけ。反響0の担当は ② が除いて返す */
    byStaff: FunnelRow[];
    brandSource: Cross;
    areaSource: Cross;
};

/** ⚠️ ② が空のときに返す表示。⚠️ summary.ts の UNSET_LABEL / UNKNOWN_AREA と同じ */
const UNSET_SOURCE = '（未入力）';
const UNKNOWN_AREA = '（不明）';
const isUnset = (key: string) => key === UNSET_SOURCE || key === UNKNOWN_AREA;

/** マトリクスの列に出す紹介元の最低件数。⚠️ 少ない紹介元まで並べると列が20近くになる */
const MIN_SOURCE_COLUMN = 5;

/** 率。⚠️⚠️ **分母が0なら null**（⚠️ 0% と出さない。「記録が無い」と「0件」は違う） */
const rate = (count: number, denominator: number): number | null =>
    denominator === 0 ? null : Math.round((count / denominator) * 1000) / 10;
const percent = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

/**
 * 月の選択肢。⚠️ 当月から過去36ヶ月。
 * ⚠️⚠️ **`new Date(y, m, 1)` で作る。** ⚠️ 文字列から作ると UTC 解釈で月がずれることがある。
 */
const MONTHS = (() => {
    const now = new Date();
    const list: string[] = [];
    for (let i = 0; i < 36; i += 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
})();

type SortKey = 'key' | 'inquiry' | 'meetingRate' | 'nextRate' | 'contract' | 'contractRate' | 'lagMedian';

const valueOf = (row: FunnelRow, key: SortKey): number | string => {
    switch (key) {
        case 'key': return row.key;
        case 'inquiry': return row.inquiry;
        case 'meetingRate': return rate(row.meeting, row.inquiry) ?? -1;
        case 'nextRate': return rate(row.next, row.inquiry) ?? -1;
        case 'contract': return row.contract;
        case 'contractRate': return rate(row.contract, row.inquiry) ?? -1;
        case 'lagMedian': return row.lagMedian ?? -1;
        default: return 0;
    }
};

/**
 * 歩留まりの表（紹介元・事業部・ブランド・エリア・店舗で共用）。
 * ⚠️ 並べ替えは見出しクリック（GoogleReview.tsx と同じ作法）。⚠️ 表ごとに独立して並べ替える。
 */
const FunnelTable = ({ title, rows, label, note }: { title: string; rows: FunnelRow[]; label: string; note?: React.ReactNode }) => {
    /** ⚠️ 既定は反響の多い順。⚠️ **率を既定にすると分母1件で100%の行が先頭に来る** */
    const [sortKey, setSortKey] = useState<SortKey>('inquiry');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const sorted = useMemo(() => [...rows].sort((a, b) => {
        // ⚠️ 未入力・不明は並べ替えに関係なく最後（⚠️ 先頭に来ると目立ちすぎる）
        if (isUnset(a.key) !== isUnset(b.key)) return isUnset(a.key) ? 1 : -1;
        const x = valueOf(a, sortKey);
        const y = valueOf(b, sortKey);
        const diff = typeof x === 'string' || typeof y === 'string'
            ? String(x).localeCompare(String(y), 'ja')
            : x - y;
        if (diff === 0) return a.key.localeCompare(b.key, 'ja');
        return sortOrder === 'asc' ? diff : -diff;
    }), [rows, sortKey, sortOrder]);

    const Head = ({ text, keyName, align = 'right', note }: { text: string; keyName: SortKey; align?: 'left' | 'right'; note?: string }) => {
        const active = sortKey === keyName;
        return (
            <th
                className={`ics_th ics_th_sort text-${align}`}
                title={note ?? 'クリックで並べ替え'}
                onClick={() => {
                    if (active) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(keyName); setSortOrder('desc'); }
                }}
            >
                {text}
                <span className={`ics_sort_icon${active ? ' is_active' : ''}`}>
                    {active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
            </th>
        );
    };

    return (
        <section className="ics_section">
            <div className="ics_section_title">{title}</div>
            {/* ⚠️ v2.2.218: 表ごとの注記（担当別で使う） */}
            {note !== undefined && <div className="ics_note mb-1">{note}</div>}
            <div className="ics_table_wrap">
                <table className="ics_table">
                    <thead>
                        <tr>
                            <Head text={label} keyName="key" align="left" />
                            <Head text="反響" keyName="inquiry" />
                            <Head text="面談率" keyName="meetingRate" note="初回面談以降の日付がある人 ÷ 反響" />
                            <Head text="次アポ率" keyName="nextRate" note="事前審査・第二面談・契約の日付がある人 ÷ 反響" />
                            <Head text="契約" keyName="contract" />
                            <Head text="契約率" keyName="contractRate" note="契約済み ÷ 反響" />
                            <th className="ics_th text-end" title="面談した人のうち契約した割合">面談→契約</th>
                            <Head text="契約まで" keyName="lagMedian" note="反響取得日から契約日までの日数（中央値）" />
                            {/* ⚠️ 棒は列幅いっぱい（⚠️ 半分幅の表で固定幅にすると右へはみ出す） */}
                            <th className="ics_th" style={{ width: '18%' }}>歩留まり</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.length === 0 ? (
                            <tr><td className="ics_td ics_empty" colSpan={9}>該当する紹介がありません</td></tr>
                        ) : sorted.map(row => (
                            <tr key={row.key} className={`ics_row${row.inquiry < 10 ? ' is_small' : ''}`}>
                                <td className="ics_td ics_name">{row.key}</td>
                                <td className="ics_td ics_num">{row.inquiry.toLocaleString()}</td>
                                <td className="ics_td ics_num">{percent(rate(row.meeting, row.inquiry))}</td>
                                <td className="ics_td ics_num">{percent(rate(row.next, row.inquiry))}</td>
                                <td className="ics_td ics_num">{row.contract.toLocaleString()}</td>
                                <td className="ics_td ics_num ics_main">{percent(rate(row.contract, row.inquiry))}</td>
                                <td className="ics_td ics_num">{percent(rate(row.contract, row.meeting))}</td>
                                <td className="ics_td ics_num">{row.lagMedian === null ? '—' : `${row.lagMedian}日`}</td>
                                <td className="ics_td"><FunnelBar row={row} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

/** 横棒（反響＝100%）。⚠️ 面談・次アポ・契約を重ねる */
const FunnelBar = ({ row }: { row: FunnelRow }) => {
    if (row.inquiry === 0) return null;
    const w = (n: number) => `${(n / row.inquiry) * 100}%`;
    return (
        <div className="ics_bar" title={`面談 ${row.meeting} / 次アポ ${row.next} / 契約 ${row.contract}`}>
            <i className="ics_bar_meet" style={{ width: w(row.meeting) }} />
            <i className="ics_bar_next" style={{ width: w(row.next) }} />
            <i className="ics_bar_contract" style={{ width: w(row.contract) }} />
        </div>
    );
};

/**
 * 行 × 紹介元の表。セルは契約率と「契約/反響」。
 * ⚠️ 列は反響が MIN_SOURCE_COLUMN 件以上の紹介元だけ（⚠️ 未入力は常に最後に出す）。
 */
const CrossTable = ({ title, label, cross, sources }: { title: string; label: string; cross: Cross; sources: string[] }) => (
    <section className="ics_section">
        <div className="ics_section_title">{title}</div>
        <div className="ics_table_wrap">
            <table className="ics_table">
                <thead>
                    <tr>
                        <th className="ics_th">{label}</th>
                        {sources.map(s => <th key={s} className="ics_th text-end">{s}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {cross.rows.length === 0 ? (
                        <tr><td className="ics_td ics_empty" colSpan={sources.length + 1}>該当する紹介がありません</td></tr>
                    ) : cross.rows.map(row => (
                        <tr key={row} className="ics_row">
                            <td className="ics_td ics_name">{row}</td>
                            {sources.map(s => {
                                const cell = cross.cells[row]?.[s];
                                if (!cell) return <td key={s} className="ics_td ics_num ics_muted">—</td>;
                                const value = rate(cell.contract, cell.inquiry);
                                // ⚠️ 色は契約率 0〜60% を薄→濃。⚠️ 反響10件未満は色を付けない（参考値）
                                const strength = cell.inquiry < 10 || value === null ? 0 : Math.min(value / 60, 1);
                                return (
                                    <td
                                        key={s}
                                        className={`ics_td ics_num ics_cell${cell.inquiry < 10 ? ' is_small' : ''}`}
                                        style={strength > 0 ? { background: `rgba(15, 118, 110, ${(0.08 + strength * 0.5).toFixed(2)})` } : undefined}
                                        title={`面談 ${percent(rate(cell.meeting, cell.inquiry))} / 次アポ ${percent(rate(cell.next, cell.inquiry))}`}
                                    >
                                        {percent(value)}
                                        <small>{cell.contract}/{cell.inquiry}</small>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </section>
);

const IntroductorySummary = () => {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [shops, setShops] = useState<ShopOption[]>([]);
    const [areas, setAreas] = useState<string[]>([]);
    /** 紹介元の選択肢（v2.2.220）。⚠️ 件数は紹介元以外の絞り込みを当てたあとの数 */
    const [sources, setSources] = useState<{ name: string; count: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    /** ⚠️ 絞り込み。⚠️⚠️ **既定はすべて空＝全期間・全店舗・全エリア** */
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [targetShop, setTargetShop] = useState('');
    const [targetArea, setTargetArea] = useState('');
    /** 紹介元（introduction_person_category。v2.2.220）。⚠️ 空＝すべて */
    const [targetSource, setTargetSource] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', {
                request: 'introductory_summary',
                startMonth,
                endMonth,
                shop: targetShop,
                area: targetArea,
                // ⚠️ `category` という名前で送らないこと（② の振り分けのキーに入り、未登録扱いになる）
                source: targetSource,
            });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '集計を取得できませんでした。');
                return;
            }
            setSummary(res.data as Summary);
            setShops(res.data.shops ?? []);
            setAreas(res.data.areas ?? []);
            setSources(res.data.sources ?? []);
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '集計を取得できませんでした。分析サーバーが停止している可能性があります。');
        } finally {
            setLoading(false);
        }
    }, [startMonth, endMonth, targetShop, targetArea, targetSource]);

    useEffect(() => { void fetchData(); }, [fetchData]);

    /** 店舗の選択肢。⚠️ エリアを選んだらそのエリアの店舗だけ（⚠️ ② が返す shop_list の id 順のまま） */
    const shopOptions = useMemo(
        () => (targetArea === '' ? shops : shops.filter(s => s.area === targetArea)),
        [shops, targetArea]
    );

    /**
     * 紹介元の列（マトリクス用）。⚠️ 反響の多い順。⚠️ 未入力は最後。
     * ⚠️ 少数の紹介元は列にしない（⚠️ 紹介元別の表には全部出ている）。
     */
    const sourceColumns = useMemo(() => {
        const list = (summary?.bySource ?? []).filter(r => r.inquiry >= MIN_SOURCE_COLUMN && r.key !== UNSET_SOURCE).map(r => r.key);
        if ((summary?.bySource ?? []).some(r => r.key === UNSET_SOURCE)) list.push(UNSET_SOURCE);
        return list;
    }, [summary]);

    const total = summary?.total;
    const unset = summary?.bySource.find(r => r.key === UNSET_SOURCE);
    const filtered = startMonth !== '' || endMonth !== '' || targetShop !== '' || targetArea !== '' || targetSource !== '';

    /** KPI の1段。⚠️ 下の小さい数字は「前の段からの率」 */
    const Step = ({ label, count, base, baseLabel, main = false }: { label: string; count: number; base: number; baseLabel: string; main?: boolean }) => (
        <div className={`ics_kpi_card${main ? ' is_main' : ''}`}>
            <div className="ics_kpi_label">{label}</div>
            <div className="ics_kpi_value">{count.toLocaleString()}</div>
            <div className="ics_kpi_sub">
                反響の <b>{percent(rate(count, total?.inquiry ?? 0))}</b>
                {baseLabel !== '' && <span className="ms-2">{baseLabel} {percent(rate(count, base))}</span>}
            </div>
        </div>
    );

    return (
        <div className="ics_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル。共通CSSを汚さない */}
            <style>{`
                /**
                 * ⚠️⚠️ 全画面モーダルの Modal.Body は **p-0 かつ overflow: hidden**（Header.tsx）。
                 *   ⚠️ 余白はこちらで持ち、⚠️ **この外枠だけをスクロールさせる**（表が縦に5つ以上並ぶため）。
                 */
                .ics_wrap { font-size: 13px; color: #1f2937; height: 100%; overflow: auto;
                            padding: 16px 40px 28px; box-sizing: border-box; }
                .ics_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
                .ics_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .ics_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .ics_note { font-size: 11px; color: #6b7280; }
                .ics_bar_filter { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                                  background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
                .ics_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .ics_reset { font-size: 11px; font-weight: 700; color: #2563eb; cursor: pointer;
                             background: none; border: none; padding: 4px 0; white-space: nowrap; }
                .ics_reset:hover { text-decoration: underline; }
                .ics_reset:disabled { color: #cbd5e1; cursor: default; text-decoration: none; }

                /* ⚠️ KPI。⚠️ 反響 → 面談 → 次アポ → 契約 の順に横へ並べる（⚠️ 歩留まりの流れが読めるように） */
                .ics_kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
                .ics_kpi_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .ics_kpi_card.is_main { border-color: #99d5cf; background: #f2fbf9; }
                .ics_kpi_label { font-size: 11px; color: #6b7280; }
                .ics_kpi_value { font-size: 22px; font-weight: 700; line-height: 1.25; font-variant-numeric: tabular-nums; }
                .ics_kpi_card.is_main .ics_kpi_value { color: #0f766e; }
                .ics_kpi_sub { font-size: 11px; color: #6b7280; font-variant-numeric: tabular-nums; }
                .ics_kpi_sub b { color: #1f2937; }

                .ics_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb;
                               border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; }
                .ics_caution b { color: #78350f; }

                .ics_grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 620px), 1fr)); gap: 14px; }
                .ics_section_title { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
                .ics_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; }
                .ics_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .ics_th { background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 8px 10px;
                          font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
                .ics_th_sort { cursor: pointer; user-select: none; }
                .ics_th_sort:hover { background: #eef2f7; }
                .ics_sort_icon { margin-left: 5px; font-size: 10px; color: #cbd5e1; }
                .ics_sort_icon.is_active { color: #2563eb; }
                .ics_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; white-space: nowrap; }
                .ics_row:hover > .ics_td { background: #f8fafc; }
                .ics_row:last-child > .ics_td { border-bottom: none; }
                .ics_name { font-weight: 700; white-space: normal; min-width: 120px; }
                .ics_num { text-align: right; font-variant-numeric: tabular-nums; }
                .ics_main { font-weight: 700; color: #0f766e; }
                /* ⚠️ 反響10件未満は薄く出す（⚠️ 率が1件で大きく動くため参考値） */
                .ics_row.is_small > .ics_td, .ics_cell.is_small { color: #9ca3af; }
                .ics_row.is_small > .ics_main { color: #9ca3af; }
                .ics_cell small { display: block; font-size: 10px; color: inherit; opacity: .7; line-height: 1.2; }
                .ics_muted { color: #cbd5e1; }
                .ics_empty { color: #9ca3af; text-align: center; padding: 20px; }

                .ics_bar { position: relative; width: 100%; min-width: 70px; height: 12px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
                .ics_bar i { position: absolute; left: 0; top: 0; bottom: 0; }
                .ics_bar_meet { background: #cbd5e1; }
                .ics_bar_next { background: #7fb8b1; }
                .ics_bar_contract { background: #0f766e; }
                .ics_legend { display: flex; gap: 14px; font-size: 11px; color: #6b7280; }
                .ics_legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
            `}</style>

            <div className="ics_inner">
                <div className="ics_head">
                    <span className="ics_title">
                        <i className="fa-solid fa-handshake me-2" style={{ color: '#0f766e' }} aria-hidden="true" />
                        紹介キャンペーンサマリー
                    </span>
                    <span className="ics_note">注文・建売・中古の顧客台帳で、媒体が「紹介」の顧客（重複を除く）</span>
                </div>

                <div className="ics_bar_filter">
                    {/* ⚠️ v2.2.220: 紹介元（introduction_person_category）で絞る。⚠️ 画面のすべての表に効く */}
                    <div>
                        <div className="ics_label">紹介元</div>
                        <Form.Select
                            size="sm" value={targetSource} style={{ width: '180px', fontSize: '12px' }}
                            onChange={(e) => setTargetSource(e.target.value)}
                        >
                            <option value="">すべて</option>
                            {sources.map(s => <option key={s.name} value={s.name}>{s.name}（{s.count.toLocaleString()}）</option>)}
                            {/* ⚠️ 期間などで絞った結果、選んでいる紹介元が0件になっても選択を残す（黙って外さない） */}
                            {targetSource !== '' && !sources.some(s => s.name === targetSource) && (
                                <option value={targetSource}>{targetSource}（0）</option>
                            )}
                        </Form.Select>
                    </div>
                    <div>
                        <div className="ics_label">エリア</div>
                        <Form.Select
                            size="sm" value={targetArea} style={{ width: '140px', fontSize: '12px' }}
                            onChange={(e) => {
                                const area = e.target.value;
                                setTargetArea(area);
                                // ⚠️ 別エリアの店舗が選ばれたままだと0件になる。外す
                                if (targetShop !== '' && area !== '' && !shops.some(s => s.name === targetShop && s.area === area)) setTargetShop('');
                            }}
                        >
                            <option value="">すべて</option>
                            {areas.map(a => <option key={a} value={a}>{a}</option>)}
                        </Form.Select>
                    </div>
                    <div>
                        <div className="ics_label">店舗</div>
                        <Form.Select
                            size="sm" value={targetShop} style={{ width: '180px', fontSize: '12px' }}
                            onChange={(e) => setTargetShop(e.target.value)}
                        >
                            <option value="">すべて</option>
                            {shopOptions.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </Form.Select>
                    </div>
                    <div>
                        <div className="ics_label">開始月（反響取得日）</div>
                        <Form.Select
                            size="sm" value={startMonth} style={{ width: '140px', fontSize: '12px' }}
                            onChange={(e) => setStartMonth(e.target.value)}
                        >
                            <option value="">指定なし</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </Form.Select>
                    </div>
                    <div>
                        <div className="ics_label">終了月（反響取得日）</div>
                        <Form.Select
                            size="sm" value={endMonth} style={{ width: '140px', fontSize: '12px' }}
                            onChange={(e) => setEndMonth(e.target.value)}
                        >
                            <option value="">指定なし</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </Form.Select>
                    </div>
                    <button
                        type="button"
                        className="ics_reset"
                        disabled={!filtered}
                        onClick={() => { setStartMonth(''); setEndMonth(''); setTargetShop(''); setTargetArea(''); setTargetSource(''); }}
                    >
                        絞り込みを外す
                    </button>
                    {/* ⚠️ 開始が終了より後だと0件になる。⚠️ **黙って空にしない** */}
                    {startMonth !== '' && endMonth !== '' && startMonth > endMonth && (
                        <span className="ics_note text-danger">開始月が終了月より後になっています</span>
                    )}
                    {loading && summary !== null && <span className="ics_note ms-auto">更新中…</span>}
                </div>

                {error !== '' && <div className="alert alert-danger mb-0" style={{ fontSize: '13px' }}>{error}</div>}

                {summary === null || total === undefined ? (
                    loading && (
                        <div className="text-center py-5">
                            <div className="spinner-border" style={{ color: '#0f766e' }} role="status">
                                <span className="visually-hidden">読み込み中</span>
                            </div>
                        </div>
                    )
                ) : (
                    <>
                        <div className="ics_kpi">
                            <div className="ics_kpi_card">
                                <div className="ics_kpi_label">紹介の反響</div>
                                <div className="ics_kpi_value">{total.inquiry.toLocaleString()}</div>
                                <div className="ics_kpi_sub">
                                    紹介元が未入力 <b>{unset?.inquiry ?? 0}</b>（{percent(rate(unset?.inquiry ?? 0, total.inquiry))}）
                                </div>
                            </div>
                            <Step label="面談" count={total.meeting} base={total.inquiry} baseLabel="" />
                            <Step label="次アポ" count={total.next} base={total.meeting} baseLabel="面談から" />
                            <Step label="契約" count={total.contract} base={total.next} baseLabel="次アポから" main />
                            <div className="ics_kpi_card">
                                <div className="ics_kpi_label">反響から契約まで（中央値）</div>
                                <div className="ics_kpi_value">{total.lagMedian === null ? '—' : `${total.lagMedian}日`}</div>
                                <div className="ics_kpi_sub">面談した人の契約率 <b>{percent(rate(total.contract, total.meeting))}</b></div>
                            </div>
                        </div>

                        {/* ⚠️⚠️ **この注記を外さないこと。** 期間の終わりが最近だと契約が出そろっていない */}
                        <div className="ics_caution">
                            ※ 面談＝初回面談以降の日付がある人、次アポ＝事前審査・第二面談・契約の日付がある人、契約＝状況が「契約済み」の人です。
                            率はすべて<b>反響の人数</b>が分母です。
                            <br />
                            ※ 期間は<b>反響取得日</b>で絞ります。契約は反響から1〜2ヶ月後に出ることが多いため、
                            <b>直近の月を含めると契約率は低めに出ます。</b>
                            <br />
                            ※ 店舗は担当店舗で数え、<b>併売店の担当は親店舗に含めています。</b>反響10件未満の行は灰色（参考値）です。
                        </div>

                        <div className="ics_legend">
                            <span><i style={{ background: '#cbd5e1' }} />面談</span>
                            <span><i style={{ background: '#7fb8b1' }} />次アポ</span>
                            <span><i style={{ background: '#0f766e' }} />契約</span>
                            <span>（反響＝棒の全幅）</span>
                            <span className="ms-auto">見出しをクリックすると並び替わります</span>
                        </div>

                        <FunnelTable title="紹介元別" label="紹介元" rows={summary.bySource} />

                        <div className="ics_grid2">
                            <FunnelTable title="事業部別" label="事業部" rows={summary.byDivision} />
                            <FunnelTable title="エリア別" label="エリア" rows={summary.byArea} />
                        </div>

                        <FunnelTable title="ブランド別" label="ブランド" rows={summary.byBrand} />

                        <CrossTable title="ブランド × 紹介元（契約率・契約/反響）" label="ブランド" cross={summary.brandSource} sources={sourceColumns} />
                        <CrossTable title="エリア × 紹介元（契約率・契約/反響）" label="エリア" cross={summary.areaSource} sources={sourceColumns} />

                        <FunnelTable title="店舗別" label="店舗" rows={summary.byShop} />

                        {/* ⚠️ v2.2.218: 担当別。⚠️ 1人の顧客が複数の担当に入るので、足しても全体とは合わない */}
                        <FunnelTable
                            title="担当別"
                            label="担当"
                            rows={summary.byStaff ?? []}
                            note={<>
                                注文・建売の紹介の顧客を、<b>担当営業</b>と<b>商談シートに記録した人</b>の両方で数えています（中古は含みません）。
                                1人のお客様が複数の担当に入ることがあるため、<b>足しても全体の数とは合いません。</b>紹介の反響が無い担当は出していません。
                            </>}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default IntroductorySummary;
