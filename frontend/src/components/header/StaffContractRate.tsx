import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';

/**
 * 営業別の契約率（ヘッダー → 日報 → 営業別契約率）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ データは ② の `staff_contract`（features/staffContract.ts）。
 *   ⚠️⚠️ **① に PHP ハンドラは無い。** ⚠️ ② が落ちるとこの画面は動かない。
 *
 * ⚠️⚠️ **契約数の列が2つあるのは誤りではない。**
 *
 *   ⚠️ **契約数（商談）** … 商談顧客の中で契約済みのもの。⚠️ **契約率の分子。**
 *   ⚠️ **契約数（顧客DB）** … 顧客情報の担当営業で数えたもの。
 *     ⚠️ ⚠️ **商談ステップを入力しない営業がいる**ため、
 *       ⚠️ 商談側だけだと**その人の契約が丸ごと0に見える。**
 *
 *   ⚠️⚠️ **顧客DB側で率を出さないこと。** ⚠️ 商談顧客数と母集団が違う。
 *
 * ⚠️ 見た目は GoogleReview.tsx に合わせてある（⚠️ 並べ替えは見出しクリック）。
 * ⚠️ ⚠️ **モーダルは `lg`**（Header.tsx）。⚠️ 表は横スクロールする。
 * ─────────────────────────────────────────────
 */

type Row = {
    name: string;
    /** ⚠️ 複数ブランドに登録されている人は `/` でつながっている */
    shop: string;
    section: string;
    talk: number;
    next: number;
    /** ⚠️ 商談顧客のうちの契約。⚠️ **契約率の分子** */
    contract: number;
    /** ⚠️ 顧客DB上の契約。⚠️ **率は出さない** */
    contractDb: number;
};

type Coverage = { sheets: number; withStaff: number };

type SortKey = 'name' | 'shop' | 'section' | 'talk' | 'next' | 'nextRate' | 'contract' | 'contractRate' | 'contractDb';
type SortOrder = 'asc' | 'desc';

/**
 * 歩留まり。
 *
 * ⚠️⚠️ **分母が0のときは null を返す。** ⚠️ `0%` と出さないこと。
 *   ⚠️ ⚠️ **「商談の記録が無い」と「商談したが契約が無い」は意味が違う。**
 */
const rate = (count: number, denominator: number): number | null =>
    denominator === 0 ? null : Math.round((count / denominator) * 1000) / 10;

/** 並べ替え用の値。⚠️ 率の null は **一番下**へ回す（-1） */
const valueOf = (row: Row, key: SortKey): number | string => {
    switch (key) {
        case 'name': return row.name;
        case 'shop': return row.shop;
        case 'section': return row.section;
        case 'talk': return row.talk;
        case 'next': return row.next;
        case 'nextRate': return rate(row.next, row.talk) ?? -1;
        case 'contract': return row.contract;
        case 'contractRate': return rate(row.contract, row.talk) ?? -1;
        case 'contractDb': return row.contractDb;
    }
};

const StaffContractRate = () => {
    const [rows, setRows] = useState<Row[]>([]);
    const [coverage, setCoverage] = useState<Coverage>({ sheets: 0, withStaff: 0 });
    const [period, setPeriod] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    /** ⚠️ 既定は商談顧客数の多い順。⚠️ **率を既定にすると分母1人で100%の行が先頭に来る** */
    const [sortKey, setSortKey] = useState<SortKey>('talk');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiClient.post('', { request: 'staff_contract' });
                if (res.data?.status !== 'ok') {
                    setError(res.data?.message ?? '集計を取得できませんでした。');
                    return;
                }
                setRows(res.data.rows ?? []);
                setCoverage(res.data.coverage ?? { sheets: 0, withStaff: 0 });
                setPeriod(res.data.period ?? '');
            } catch (e: unknown) {
                const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
                setError(message ?? '集計を取得できませんでした。分析サーバーが停止している可能性があります。');
            } finally {
                setLoading(false);
            }
        };
        void fetchData();
    }, []);

    const sorted = useMemo(() => {
        const list = [...rows];
        list.sort((a, b) => {
            const x = valueOf(a, sortKey);
            const y = valueOf(b, sortKey);
            if (typeof x === 'string' || typeof y === 'string') {
                return sortOrder === 'asc'
                    ? String(x).localeCompare(String(y), 'ja')
                    : String(y).localeCompare(String(x), 'ja');
            }
            // ⚠️ 同じ値のときは名前で安定させる（⚠️ 並べ替えのたびに順が変わらないように）
            if (x === y) return a.name.localeCompare(b.name, 'ja');
            return sortOrder === 'asc' ? x - y : y - x;
        });
        return list;
    }, [rows, sortKey, sortOrder]);

    const total = useMemo(() => ({
        staff: rows.length,
        talk: rows.reduce((a, r) => a + r.talk, 0),
        next: rows.reduce((a, r) => a + r.next, 0),
        contract: rows.reduce((a, r) => a + r.contract, 0),
        contractDb: rows.reduce((a, r) => a + r.contractDb, 0),
    }), [rows]);

    const percent = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

    /** 並べ替えの見出し。⚠️ GoogleReview.tsx と同じ作法（クリックで発火） */
    const SortHead = ({ label, keyName, align = 'left', width, note }: {
        label: string; keyName: SortKey; align?: 'left' | 'center' | 'right'; width?: string; note?: string;
    }) => {
        const active = sortKey === keyName;
        return (
            <th
                className={`sc_th sc_th_sort text-${align}`}
                style={{ width }}
                title={note ?? 'クリックで並べ替え'}
                onClick={() => {
                    if (active) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    // ⚠️ 別の列は降順から始める（⚠️ 件数や率は「多い順」を先に見たい）
                    else { setSortKey(keyName); setSortOrder('desc'); }
                }}
            >
                {label}
                <span className={`sc_sort_icon${active ? ' is_active' : ''}`}>
                    {active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
            </th>
        );
    };

    return (
        <div className="sc_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル。共通CSSを汚さない */}
            <style>{`
                .sc_wrap { font-size: 13px; color: #1f2937; }
                .sc_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .sc_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .sc_note { font-size: 11px; color: #6b7280; }

                .sc_kpi { display: flex; gap: 8px; flex-wrap: wrap; }
                .sc_kpi_card { flex: 1 1 110px; background: #fff; border: 1px solid #e5e7eb;
                               border-radius: 10px; padding: 8px 12px; }
                .sc_kpi_label { font-size: 10px; color: #6b7280; white-space: nowrap; }
                .sc_kpi_value { font-size: 18px; font-weight: 700; line-height: 1.2;
                                font-variant-numeric: tabular-nums; }

                /* ⚠️ 記録の網羅率の注意書き。⚠️⚠️ **消さないこと。**
                      ⚠️ 数字だけ見せると「実力差」と受け取られる */
                .sc_caution { font-size: 11px; color: #92400e; line-height: 1.8;
                              background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; }
                .sc_caution b { color: #78350f; }

                /* ⚠️ モーダルは lg（Header.tsx）。⚠️ 列が9つあるので**横スクロールする**。
                   ⚠️ 縦は 60vh で止めて、見出しを固定したまま中だけ流す */
                .sc_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto;
                                 background: #fff; max-height: 60vh; }
                .sc_table { width: 100%; border-collapse: separate; border-spacing: 0;
                            font-size: 12px; min-width: 760px; }
                .sc_th { position: sticky; top: 0; z-index: 2; background: #f8fafc;
                         border-bottom: 1px solid #e5e7eb; padding: 8px 10px;
                         font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
                .sc_th_sort { cursor: pointer; user-select: none; }
                .sc_th_sort:hover { background: #eef2f7; }
                .sc_sort_icon { margin-left: 5px; font-size: 10px; color: #cbd5e1; }
                .sc_sort_icon.is_active { color: #2563eb; }
                .sc_td { border-bottom: 1px solid #f1f5f9; padding: 8px 10px;
                         vertical-align: middle; white-space: nowrap; }
                .sc_row:hover > .sc_td { background: #f8fafc; }
                .sc_name { font-weight: 700; font-size: 13px; }
                .sc_sub { font-size: 10px; color: #6b7280; }
                .sc_num { text-align: right; font-variant-numeric: tabular-nums; }
                .sc_rate { text-align: right; font-weight: 700; color: #b45309;
                           font-variant-numeric: tabular-nums; }
                /* ⚠️ 契約率だけ背景を敷く。⚠️ この画面の主役なので目で追えるように */
                .sc_main { background: #fdf2f3; color: #b02a37; }
                /* ⚠️ 顧客DB側は**率を持たない**ので、色を変えて別物だと分かるようにする */
                .sc_db { text-align: right; font-variant-numeric: tabular-nums; color: #374151;
                         background: #f8fafc; }
                .sc_zero { color: #cbd5e1; }
                .sc_empty { color: #9ca3af; font-size: 12px; padding: 24px; text-align: center; }
            `}</style>

            <div className="sc_head mb-2">
                <span className="sc_title">
                    <i className="fa-solid fa-ranking-star me-2 text-danger" aria-hidden="true" />
                    営業別 契約率
                </span>
                <span className="sc_note">
                    注文事業{period === '' ? '' : ` / ${period}年度`}（報告対象）
                </span>
            </div>

            {error !== '' && (
                <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>
            )}

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-danger" role="status">
                        <span className="visually-hidden">読み込み中</span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="sc_kpi mb-2">
                        <div className="sc_kpi_card">
                            <div className="sc_kpi_label">対象営業</div>
                            <div className="sc_kpi_value">{total.staff}</div>
                        </div>
                        <div className="sc_kpi_card">
                            <div className="sc_kpi_label">商談顧客数</div>
                            <div className="sc_kpi_value">{total.talk.toLocaleString()}</div>
                        </div>
                        <div className="sc_kpi_card">
                            <div className="sc_kpi_label">次アポ数</div>
                            <div className="sc_kpi_value">{total.next.toLocaleString()}</div>
                        </div>
                        <div className="sc_kpi_card">
                            <div className="sc_kpi_label">契約数（商談）</div>
                            <div className="sc_kpi_value">{total.contract.toLocaleString()}</div>
                        </div>
                        <div className="sc_kpi_card">
                            <div className="sc_kpi_label">契約数（顧客DB）</div>
                            <div className="sc_kpi_value">{total.contractDb.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* ⚠️⚠️ **この注記を外さないこと。** 記録の有無が数字を大きく左右する */}
                    <div className="sc_caution mb-2">
                        ※ 商談顧客数・次アポ数・契約率は、<b>商談ログに担当営業が記録されているぶんだけ</b>を数えています
                        （全 {coverage.sheets.toLocaleString()} 件中 <b>{coverage.withStaff.toLocaleString()} 件</b>
                        {coverage.sheets === 0 ? '' : `・${(coverage.withStaff / coverage.sheets * 100).toFixed(1)}%`}）。
                        <br />
                        ※ <b>契約数（顧客DB）</b>は顧客情報の担当営業で数えた実数です。商談ステップを入力しない営業の実績もここに出ます。
                        <b>商談顧客数とは母集団が違うため、こちらから率は出していません。</b>
                        <br />
                        ※ 数えているのは商談の回数ではなく<b>顧客の人数</b>です。
                    </div>

                    <div className="sc_table_wrap">
                        <table className="sc_table">
                            <thead>
                                <tr>
                                    <SortHead label="営業名" keyName="name" width="150px" />
                                    <SortHead label="店舗" keyName="shop" width="150px" />
                                    <SortHead label="課" keyName="section" width="120px" />
                                    <SortHead label="商談顧客数" keyName="talk" align="right" width="86px" />
                                    <SortHead label="次アポ数" keyName="next" align="right" width="78px" />
                                    <SortHead label="次アポ率" keyName="nextRate" align="right" width="80px" />
                                    <SortHead label="契約数(商談)" keyName="contract" align="right" width="92px"
                                        note="商談顧客のうち契約済みの人数。契約率の分子" />
                                    <SortHead label="契約率" keyName="contractRate" align="right" width="78px"
                                        note="契約数(商談) ÷ 商談顧客数" />
                                    <SortHead label="契約数(顧客DB)" keyName="contractDb" align="right" width="100px"
                                        note="顧客情報の担当営業で数えた実数。商談顧客数とは母集団が違う" />
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(row => {
                                    const nextRate = rate(row.next, row.talk);
                                    const contractRate = rate(row.contract, row.talk);
                                    return (
                                        <tr key={row.name} className="sc_row">
                                            <td className="sc_td sc_name">{row.name}</td>
                                            <td className="sc_td"><span className="sc_sub">{row.shop}</span></td>
                                            <td className="sc_td"><span className="sc_sub">{row.section}</span></td>
                                            <td className={`sc_td sc_num${row.talk === 0 ? ' sc_zero' : ''}`}>{row.talk}</td>
                                            <td className={`sc_td sc_num${row.next === 0 ? ' sc_zero' : ''}`}>{row.next}</td>
                                            <td className="sc_td sc_rate">{percent(nextRate)}</td>
                                            <td className={`sc_td sc_num${row.contract === 0 ? ' sc_zero' : ''}`}>{row.contract}</td>
                                            <td className="sc_td sc_rate sc_main">{percent(contractRate)}</td>
                                            <td className={`sc_td sc_db${row.contractDb === 0 ? ' sc_zero' : ''}`}>{row.contractDb}</td>
                                        </tr>
                                    );
                                })}

                                {sorted.length === 0 && (
                                    <tr>
                                        <td className="sc_empty" colSpan={9}>対象の営業がいません。</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <p className="sc_note mt-2 mb-0">
                        見出しをクリックすると並び替わります。もう一度押すと昇順・降順が入れ替わります。
                    </p>
                </>
            )}
        </div>
    );
};

export default StaffContractRate;
