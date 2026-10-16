import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import apiClient from '../../utils/apiClient';
import { setStyleClass } from '../../utils/setStyleClass';

/**
 * 重複反響サマリー（ヘッダー → 反響管理 → 重複反響サマリー）。v2.2.193 新規。
 *
 * ─────────────────────────────────────────────
 * ⚠️ データは ② の `duplicate_summary`（features/duplicateSummary.ts）。
 *   ⚠️⚠️ **① に PHP ハンドラは無い。** ⚠️ ① の express_proxy.php の許可リストで ② へ転送している。
 *
 * ⚠️⚠️ **「重複」は status＝重複 ではない。** 電話・携帯・メール・extra_address_info が
 *   ⚠️ **他ブランドの顧客と一致する反響**のこと（判定は ② 側）。
 *
 * ⚠️ カード: KHG（グループ全体）＋ KH / DJH / なごみ / 2L / JH / PGH / かえる / 中専。
 *   ⚠️ 横棒とパネル②は ⚠️⚠️ **相手ブランド側での到達段階**（2026-10-16 の指示・案A）。
 *
 * ⚠️ 見た目は GoogleReview.tsx の作法（CLAUDE.md のデザインポリシー）。
 * ⚠️ モーダルは ⚠️⚠️ **全画面**（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンはここに作らない。
 * ─────────────────────────────────────────────
 */

type Funnel = { inquiry: number; visit: number; next: number; contract: number };
type Stack = { request: number; visit: number; next: number; contract: number };
type OtherBrandRow = Funnel & { brand: string; stack: Stack };
type Card = { own: Funnel; duplicated: number; others: OtherBrandRow[] };
type GroupRow = { brand: string; total: number; dup: Funnel; stack: Stack };
type Summary = {
    brands: string[];
    cards: Record<string, Card>;
    group: { own: Funnel; byBrand: GroupRow[] };
};

/**
 * 積み上げの段階。⚠️ 色は資料請求 → 契約で薄 → 濃（⚠️ 進んだほど目立つ）。
 * ⚠️ IntroductorySummary.tsx の歩留まりの棒と同じ色の系統。
 */
const STAGES: { key: keyof Stack; label: string; color: string }[] = [
    { key: 'request', label: '資料請求', color: '#cbd5e1' },
    { key: 'visit', label: '来場', color: '#8fc4bd' },
    { key: 'next', label: '次アポ', color: '#3f9c92' },
    { key: 'contract', label: '契約', color: '#0f5f58' },
];

/**
 * ブランドの色。⚠️⚠️ **utils/setStyleClass.ts（反響一覧のブランド色）から借りる**（FestaDashboard.tsx と同じ）。
 *   ⚠️ ここに色を書き写さない。⚠️ setStyleClass は店舗名の先頭2文字で引くので読み替える。
 * ⚠️ 中専は setStyleClass に無いのでオレンジ（FestaDashboard.tsx と同じ #ff7f0e）。
 * ⚠️ KHG はグループ（灰ではなく濃い色にして、他のカードと区別する）。
 */
const BRAND_SHOP_PREFIX: Record<string, string> = {
    KH: 'KH', DJH: 'DJ', なごみ: 'なご', '2L': '2L', JH: 'JH', PGH: 'PG', かえる: 'かえ',
};
const brandColorOf = (brand: string): string => {
    if (brand === 'KHG') return '#334155';
    if (brand === '中専') return '#ff7f0e';
    const color = setStyleClass(BRAND_SHOP_PREFIX[brand] ?? '').backgroundColor;
    return typeof color === 'string' && color !== '' ? color : '#8898aa';
};

/** 率。⚠️ 分母0は null（⚠️ 0% と出さない） */
const rate = (count: number, denominator: number): number | null =>
    denominator === 0 ? null : Math.round((count / denominator) * 1000) / 10;
const percent = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

/** 月の選択肢。⚠️ 当月から過去36ヶ月。⚠️ `new Date(y, m, 1)` で作る（文字列から作ると月がずれることがある） */
const MONTHS = (() => {
    const now = new Date();
    const list: string[] = [];
    for (let i = 0; i < 36; i += 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
})();

/** パネル①：総反響 → 来場 → 次アポ → 契約。⚠️ 下の小さい数字は総反響に対する率 */
const FunnelPanel = ({ funnel }: { funnel: Funnel }) => (
    <div className="ds_funnel">
        {[
            { label: '総反響', value: funnel.inquiry, sub: null },
            { label: '来場', value: funnel.visit, sub: rate(funnel.visit, funnel.inquiry) },
            { label: '次アポ', value: funnel.next, sub: rate(funnel.next, funnel.inquiry) },
            { label: '契約', value: funnel.contract, sub: rate(funnel.contract, funnel.inquiry) },
        ].map(item => (
            <div key={item.label} className="ds_funnel_cell">
                <div className="ds_funnel_label">{item.label}</div>
                <div className="ds_funnel_value">{item.value.toLocaleString()}</div>
                <div className="ds_funnel_sub">{item.sub === null ? ' ' : percent(item.sub)}</div>
            </div>
        ))}
    </div>
);

/** 横棒（積み上げ）。⚠️ 1本の長さ＝重複した反響数。⚠️ 多い順に上から */
const StackedBars = ({ rows }: { rows: { brand: string; stack: Stack }[] }) => {
    if (rows.length === 0) return <div className="ds_empty">他ブランドとの重複はありません</div>;
    const data = rows.map(r => ({ brand: r.brand, ...r.stack }));
    return (
        <div style={{ width: '100%', height: Math.max(120, rows.length * 26 + 30) }}>
            <ResponsiveContainer>
                <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }} barCategoryGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} stroke="#9ca3af" />
                    <YAxis type="category" dataKey="brand" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#9ca3af" width={52} />
                    <Tooltip contentStyle={{ fontSize: '12px' }} cursor={{ fill: '#f8fafc' }} />
                    {STAGES.map(stage => (
                        <Bar key={stage.key} dataKey={stage.key} name={stage.label} stackId="dup" fill={stage.color} />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

/** パネル②：相手ブランドごとの総反響・来場・次アポ・契約（⚠️ 相手ブランド側での到達段階） */
const OthersTable = ({ rows }: { rows: OtherBrandRow[] }) => (
    <table className="ds_table">
        <thead>
            <tr>
                <th className="ds_th">他ブランド</th>
                <th className="ds_th text-end">総反響</th>
                <th className="ds_th text-end">来場</th>
                <th className="ds_th text-end">次アポ</th>
                <th className="ds_th text-end">契約</th>
            </tr>
        </thead>
        <tbody>
            {rows.map(r => (
                <tr key={r.brand} className="ds_row">
                    <td className="ds_td"><BrandMark brand={r.brand} /></td>
                    <td className="ds_td ds_num">{r.inquiry.toLocaleString()}</td>
                    {(['visit', 'next', 'contract'] as const).map(key => (
                        <td key={key} className="ds_td ds_num">
                            {r[key].toLocaleString()}
                            <small>{percent(rate(r[key], r.inquiry))}</small>
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    </table>
);

/** ブランド名の左に色の印 */
const BrandMark = ({ brand }: { brand: string }) => (
    <span className="ds_mark"><i style={{ background: brandColorOf(brand) }} />{brand}</span>
);

const DuplicateInquirySummary = () => {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    /** ⚠️ 期間（反響取得日）。⚠️ 既定は空＝全期間 */
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'duplicate_summary', startMonth, endMonth });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '集計を取得できませんでした。');
                return;
            }
            setSummary(res.data as Summary);
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '集計を取得できませんでした。分析サーバーが停止している可能性があります。');
        } finally {
            setLoading(false);
        }
    }, [startMonth, endMonth]);

    useEffect(() => { void fetchData(); }, [fetchData]);

    /** KHG カードの横棒（ブランドごとの重複反響）とパネル② */
    const groupBars = useMemo(
        () => (summary?.group.byBrand ?? []).filter(r => r.dup.inquiry > 0).map(r => ({ brand: r.brand, stack: r.stack })),
        [summary]
    );
    /**
     * KHG の重複件数。⚠️⚠️ **延べ件数**（ブランドごとの重複反響の合計）。
     *   ⚠️ 同じ人が KH と DJH の両方に反響していれば、KH 側で1・DJH 側で1の計2と数える。
     */
    const groupDupTotal = useMemo(
        () => (summary?.group.byBrand ?? []).reduce((sum, r) => sum + r.dup.inquiry, 0),
        [summary]
    );

    return (
        <div className="ds_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル。共通CSSを汚さない */}
            <style>{`
                /**
                 * ⚠️⚠️ 全画面モーダルの Modal.Body は **p-0 かつ overflow: hidden**（Header.tsx）。
                 *   ⚠️ 余白はこちらで持ち、⚠️ **この外枠だけをスクロールさせる**（カードが縦に3段並ぶため）。
                 */
                .ds_wrap { font-size: 13px; color: #1f2937; height: 100%; overflow: auto;
                           padding: 16px 40px 28px; box-sizing: border-box; }
                .ds_inner { width: 100%; max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; }
                .ds_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .ds_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .ds_note { font-size: 11px; color: #6b7280; }
                .ds_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                          background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
                .ds_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .ds_reset { font-size: 11px; font-weight: 700; color: #2563eb; cursor: pointer;
                            background: none; border: none; padding: 4px 0; white-space: nowrap; }
                .ds_reset:hover { text-decoration: underline; }
                .ds_reset:disabled { color: #cbd5e1; cursor: default; text-decoration: none; }
                .ds_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb;
                              border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; }
                .ds_caution b { color: #78350f; }
                .ds_legend { display: flex; gap: 14px; font-size: 11px; color: #6b7280; flex-wrap: wrap; }
                .ds_legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }

                /* ⚠️ カードの並び。⚠️ 広い画面は3列、狭くなると2列・1列に落ちる */
                .ds_grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); gap: 14px; }
                /* ⚠️ ブランド色は左の縁（4px）と見出しの印。⚠️ --ds-brand で受け取る */
                .ds_card { background: #fff; border: 1px solid #e5e7eb; border-left: 5px solid var(--ds-brand);
                           border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
                .ds_card.is_group { background: #fbfcfe; }
                .ds_card_head { display: flex; align-items: center; gap: 8px; }
                .ds_card_brand { font-weight: 800; font-size: 18px; letter-spacing: .02em; color: var(--ds-brand); }
                .ds_card_sub { font-size: 11px; color: #6b7280; }
                .ds_card_dup { margin-left: auto; font-size: 11px; color: #4b5563; background: #f3f4f6;
                               border-radius: 999px; padding: 2px 10px; white-space: nowrap; }
                .ds_card_dup b { color: #1f2937; }
                .ds_section_label { font-size: 11px; font-weight: 700; color: #6b7280; }

                .ds_funnel { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
                .ds_funnel_cell { background: #f8fafc; border: 1px solid #eef2f7; border-radius: 8px; padding: 6px 8px; }
                .ds_funnel_label { font-size: 10px; color: #6b7280; }
                .ds_funnel_value { font-size: 17px; font-weight: 700; line-height: 1.25; font-variant-numeric: tabular-nums; }
                .ds_funnel_sub { font-size: 10px; color: #0f766e; font-weight: 700; font-variant-numeric: tabular-nums; }

                .ds_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .ds_th { background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 6px 8px;
                         font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
                .ds_td { border-bottom: 1px solid #f1f5f9; padding: 5px 8px; vertical-align: middle; white-space: nowrap; }
                .ds_row:hover > .ds_td { background: #f8fafc; }
                .ds_row:last-child > .ds_td { border-bottom: none; }
                .ds_num { text-align: right; font-variant-numeric: tabular-nums; }
                .ds_num small { display: block; font-size: 10px; color: #6b7280; line-height: 1.2; }
                .ds_mark { font-weight: 700; display: inline-flex; align-items: center; gap: 6px; }
                .ds_mark i { display: inline-block; width: 4px; height: 14px; border-radius: 2px; }
                .ds_table_wrap { border: 1px solid #e5e7eb; border-radius: 8px; overflow: auto; }
                .ds_empty { color: #9ca3af; font-size: 12px; text-align: center; padding: 14px; }
            `}</style>

            <div className="ds_inner">
                <div className="ds_head">
                    <span className="ds_title">
                        <i className="fa-solid fa-people-arrows me-2" style={{ color: '#0f766e' }} aria-hidden="true" />
                        重複反響サマリー
                    </span>
                    <span className="ds_note">連絡先（電話・携帯・メール・住所の補足）が他ブランドの顧客と一致する反響</span>
                </div>

                <div className="ds_bar">
                    <div>
                        <div className="ds_label">開始月（反響取得日）</div>
                        <Form.Select size="sm" value={startMonth} style={{ width: '140px', fontSize: '12px' }}
                            onChange={(e) => setStartMonth(e.target.value)}>
                            <option value="">指定なし</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </Form.Select>
                    </div>
                    <div>
                        <div className="ds_label">終了月（反響取得日）</div>
                        <Form.Select size="sm" value={endMonth} style={{ width: '140px', fontSize: '12px' }}
                            onChange={(e) => setEndMonth(e.target.value)}>
                            <option value="">指定なし</option>
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </Form.Select>
                    </div>
                    <button type="button" className="ds_reset" disabled={startMonth === '' && endMonth === ''}
                        onClick={() => { setStartMonth(''); setEndMonth(''); }}>
                        期間を外す
                    </button>
                    {/* ⚠️ 開始が終了より後だと0件になる。⚠️ **黙って空にしない** */}
                    {startMonth !== '' && endMonth !== '' && startMonth > endMonth && (
                        <span className="ds_note text-danger">開始月が終了月より後になっています</span>
                    )}
                    {loading && summary !== null && <span className="ds_note ms-auto">更新中…</span>}
                </div>

                {error !== '' && <div className="alert alert-danger mb-0" style={{ fontSize: '13px' }}>{error}</div>}

                {/* ⚠️⚠️ **この注記を外さないこと。** 「重複」の意味が status の「重複」と取り違えられやすい */}
                <div className="ds_caution">
                    ※ <b>重複</b>＝電話・携帯・メール・住所の補足（extra_address_info）のどれかが、<b>他ブランドの顧客と一致</b>する反響です
                    （空白とハイフンは除いて比べます。短すぎる値は比べません）。状況「重複」の顧客はカードの数字から除いています。
                    <br />
                    ※ 横棒とパネル②の来場・次アポ・契約は、<b>相手のブランドで</b>どこまで進んだかです。
                    期間は<b>カードのブランドの反響取得日</b>で絞ります（相手のブランドは期間に関係なく比べます）。
                    <br />
                    ※ 来場＝初回面談以降の日付あり、次アポ＝事前審査・第二面談・契約の日付あり、契約＝状況が「契約済み」です。
                    中専は担当店舗が「買い:中古リノベ」の顧客だけです。
                </div>

                <div className="ds_legend">
                    {STAGES.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
                    <span>（横棒の長さ＝重複した反響数）</span>
                </div>

                {summary === null ? (
                    loading && (
                        <div className="text-center py-5">
                            <div className="spinner-border" style={{ color: '#0f766e' }} role="status">
                                <span className="visually-hidden">読み込み中</span>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="ds_grid">
                        {/* KHG: グループ全体 */}
                        <article className="ds_card is_group" style={{ ['--ds-brand' as string]: brandColorOf('KHG') } as React.CSSProperties}>
                            <div className="ds_card_head">
                                <span className="ds_card_brand">KHG</span>
                                <span className="ds_card_sub">グループ全体</span>
                                <span className="ds_card_dup" title="ブランドごとの重複反響の合計（同じ人が2ブランドにいれば2と数える）">
                                    重複（延べ） <b>{groupDupTotal.toLocaleString()}</b>
                                </span>
                            </div>
                            <FunnelPanel funnel={summary.group.own} />
                            <div className="ds_section_label">ブランドごとの「他ブランドと重複した反響」</div>
                            <StackedBars rows={groupBars} />
                            <div className="ds_section_label">ブランドごとの重複率</div>
                            <div className="ds_table_wrap">
                                <table className="ds_table">
                                    <thead>
                                        <tr>
                                            <th className="ds_th">ブランド</th>
                                            <th className="ds_th text-end">総反響</th>
                                            <th className="ds_th text-end">重複</th>
                                            <th className="ds_th text-end">重複率</th>
                                            <th className="ds_th text-end" title="重複した人が他ブランドで契約した数">他で契約</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {summary.group.byBrand.map(r => (
                                            <tr key={r.brand} className="ds_row">
                                                <td className="ds_td"><BrandMark brand={r.brand} /></td>
                                                <td className="ds_td ds_num">{r.total.toLocaleString()}</td>
                                                <td className="ds_td ds_num">{r.dup.inquiry.toLocaleString()}</td>
                                                <td className="ds_td ds_num" style={{ fontWeight: 700 }}>{percent(rate(r.dup.inquiry, r.total))}</td>
                                                <td className="ds_td ds_num">{r.dup.contract.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </article>

                        {summary.brands.map(brand => {
                            const card = summary.cards[brand];
                            if (!card) return null;
                            return (
                                <article key={brand} className="ds_card" style={{ ['--ds-brand' as string]: brandColorOf(brand) } as React.CSSProperties}>
                                    <div className="ds_card_head">
                                        <span className="ds_card_brand">{brand}</span>
                                        <span className="ds_card_dup">
                                            重複 <b>{card.duplicated.toLocaleString()}</b>（{percent(rate(card.duplicated, card.own.inquiry))}）
                                        </span>
                                    </div>
                                    <FunnelPanel funnel={card.own} />
                                    <div className="ds_section_label">他ブランドとの重複反響（相手ブランドでの到達段階）</div>
                                    <StackedBars rows={card.others} />
                                    {card.others.length > 0 && (
                                        <div className="ds_table_wrap"><OthersTable rows={card.others} /></div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DuplicateInquirySummary;
