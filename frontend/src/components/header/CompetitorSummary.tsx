import React, { useState, useMemo, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';

/**
 * 競合サマリー（ヘッダー → 他社動向 → 競合サマリー）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-18 に全画面へ変えた**（指示）。
 *   ⚠️ 7ブランド × 4列 ＝ **28列**あり、xl では大半が隠れていた。
 *   ⚠️ ⚠️ **全画面と「左上の閉じるボタン」は Header.tsx の `isFullscreenMenu`
 *     が面倒を見る。** ⚠️ ここに閉じるボタンを実装しないこと（二重になる）。
 *
 * ⚠️⚠️ **Modal.Body は p-0 かつ overflow: hidden**（Header.tsx）。
 *   ⚠️ そのため
 *     ・余白はこちらで持つ
 *     ・高さを使い切り、**表だけがスクロールする**形にする
 *   ⚠️ `height: 100%` と `min-height: 0` を外すと、表が画面外へ出て見えなくなる。
 *   ⚠️ GoogleReview.tsx と同じ作りである。
 *
 * ⚠️⚠️ **数字は「案件数」であって「延べ数」ではない。**
 *   ⚠️ 1件の案件に競合が複数いると、**それぞれの行に数えられる。**
 *   ⚠️ そのため ⚠️ **各行を縦に足しても総数行にはならない。** 画面に注記を出す。
 * ─────────────────────────────────────────────
 */

type Summary = Record<string, string>;

/** 集計の1かたまり。⚠️ 件数だけでなく**案件そのもの**を持つ（モーダルで使う） */
type Metrics = { total: Summary[]; contract: Summary[]; lose: Summary[]; follow: Summary[] };

/** ブランド列の定義。⚠️ `prefix` は `in_charge_store` の先頭に付く文字 */
const BRANDS = [
    { key: 'kh', label: 'KH', prefix: 'KH' },
    { key: 'djh', label: 'DJH', prefix: 'DJH' },
    { key: 'nagomi', label: 'なごみ', prefix: 'なごみ' },
    { key: 'nieru', label: '2L', prefix: '2L' },
    { key: 'jh', label: 'JH', prefix: 'JH' },
    { key: 'pgh', label: 'PGH', prefix: 'PG' },
] as const;

/** カードに出す項目。⚠️ 値が空のものは行ごと出さない */
type CardField = { key: string; label: string; unit?: string };

/**
 * ⚠️⚠️ **勝ちのサマリ（契約列）で出す項目**（2026-09-18 の指示）。
 *   ⚠️ 列名は master_data の `competitor_*`。② / ① の SELECT で別名を付けてある。
 */
const WIN_FIELDS: CardField[] = [
    { key: 'win_reason', label: '勝因' },
    { key: 'price_gap', label: '価格差', unit: '万円' },
    { key: 'sales_person', label: '他社営業' },
];

/**
 * ⚠️⚠️ **負けのサマリ（失注列）で出す項目**（2026-09-18 の指示）。
 *   ⚠️ `lost_reason_detail` は他決理由（複数選択・カンマ区切り）。
 *   ⚠️ `reason_detail` が**敗因**である（列名からは読めないので注意）。
 */
const LOSE_FIELDS: CardField[] = [
    { key: 'lost_reason_detail', label: '他決理由' },
    { key: 'reason_detail', label: '敗因' },
    { key: 'price_gap', label: '価格差', unit: '万円' },
    { key: 'sales_person', label: '他社営業' },
    { key: 'countermeasure', label: '今後の対策' },
    { key: 'rival_campaign', label: '他社のキャンペーン' },
];

/** ⚠️ 空とみなす値。⚠️ 文字列の `'null'` が実データに入っている */
const isBlank = (value: unknown): boolean => {
    const text = String(value ?? '').trim();
    return text === '' || text === 'null';
};

const CompetitorSummary: React.FC = () => {
    const [data, setData] = useState<Summary[]>([]);
    const [list, setList] = useState<string[]>([]);
    const [shops, setShops] = useState<Summary[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const [targetShop, setTargetShop] = useState('');
    const [targetSection, setTargetSection] = useState('');

    /**
     * 営業課の選択肢。
     *
     * ⚠️⚠️ **2026-09-22 まで画面に直書きだった。**
     *   ⚠️ ⚠️ **実在しない課（大分・佐賀営業課）が入っていて、選んでも0件だった。**
     *   ⚠️ 並び順は `section_list.no`（サーバー側で並べて返す）。
     */
    const [sections, setSections] = useState<string[]>([]);

    /**
     * 案件カードのモーダル。
     * ⚠️ 勝ちと負けで**出す項目だけが違う**ので、1つの state にまとめてある。
     */
    const [cardModal, setCardModal] = useState<{
        show: boolean; title: string; fields: CardField[]; records: Summary[];
    }>({ show: false, title: '', fields: [], records: [] });

    const itemsPerPage = 20;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'competitor' });
                setData(response.data.contract);
                setList(response.data.maker.map((m: any) => m.label));
                setShops(response.data.shop.filter(
                    (s: any) => !s.shop.includes('未設定') && !s.shop.includes('全店舗')
                ));
                // ⚠️ 注文事業の課だけを、`no` の昇順で選択肢にする。
                //   ⚠️ サーバーが `ORDER BY no` で返しているが、
                //     ⚠️ **並び順を画面側でも保証しておく**（① と ② の両方を通るため）。
                setSections(
                    (response.data.section ?? [])
                        .filter((s: any) => s.division === '注文事業')
                        .sort((a: any, b: any) => Number(a.no) - Number(b.no))
                        .map((s: any) => String(s.name))
                );
            } catch (e) {
                // ⚠️ 0件と取得失敗を見分けられるようにする（黙って空の表を出さない）
                setError('競合情報を取得できませんでした。時間をおいて再度お試しください。');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const targetData = useMemo(() => {
        const targetShops = shops.filter(s => s.section === targetSection).map(s => s.shop);
        return data.filter(d => {
            let match = true;
            if (targetShop && d.shop !== targetShop) match = false;
            if (targetSection && !targetShops.includes(d.shop)) match = false;
            return match;
        });
    }, [data, targetShop, targetSection, shops]);

    /** ブランドごとに絞った案件。⚠️ 総数行と各行で使い回す */
    const brandData = useMemo(() => {
        const out: Record<string, Summary[]> = { khg: targetData };
        for (const b of BRANDS) out[b.key] = targetData.filter(d => d.shop?.startsWith(b.prefix));
        return out;
    }, [targetData]);

    /**
     * 競合他社1社ぶんの集計。
     * ⚠️⚠️ **判定は改修前と同じにしてある。** 数字が変わると比較できなくなる。
     *   総数 … 競合に挙がっている、または失注先になっている
     *   契約 … 競合に挙がっていて契約日がある
     *   失注 … 失注先になっている
     *   追客 … 競合に挙がっていて見込み、かつその会社に負けていない
     */
    const getMetrics = (dataSet: Summary[], makerName: string): Metrics => {
        const total = dataSet.filter(d => d.competitor?.includes(makerName) || d.lost_competitor?.includes(makerName));
        const base = dataSet.filter(d => d.competitor?.includes(makerName));
        return {
            total,
            contract: base.filter(d => d.contract),
            lose: dataSet.filter(d => d.lost_competitor?.includes(makerName)),
            follow: base.filter(b => b.status === '見込み' && !b.lost_competitor?.includes(makerName)),
        };
    };

    /**
     * 総数行の集計。
     *
     * ⚠️⚠️ **「競合が記録された案件」全体を数える**（2026-09-18 に利用者が決定）。
     *   ⚠️ ⚠️ **下の行の合計ではない。**
     *     ⚠️ 1件の案件に競合が複数いると各行に数えられるため、
     *       縦に足すと**実際の案件数より大きくなる**（延べ数になる）。
     *   ⚠️ こちらは**案件を重複なく**数える。
     *
     * ⚠️ `getMetrics` に空文字を渡してはいけない。
     *   ⚠️ `''.includes('')` は真なので、⚠️ **競合が空の案件まで数えてしまう。**
     */
    const getTotals = (dataSet: Summary[]): Metrics => {
        const hasCompetitor = (d: Summary) => !isBlank(d.competitor);
        const hasLost = (d: Summary) => !isBlank(d.lost_competitor);
        const base = dataSet.filter(hasCompetitor);
        return {
            total: dataSet.filter(d => hasCompetitor(d) || hasLost(d)),
            contract: base.filter(d => d.contract),
            lose: dataSet.filter(hasLost),
            follow: base.filter(d => d.status === '見込み' && !hasLost(d)),
        };
    };

    /** 総数行の見出し。⚠️ 絞り込みに合わせて名前を変える（指示） */
    const totalLabel = targetShop
        ? `${targetShop}全体`
        : targetSection
            ? `${targetSection}全体`
            : '注文営業全体';

    const totalsRow = useMemo(() => ({
        khg: getTotals(brandData.khg),
        ...Object.fromEntries(BRANDS.map(b => [b.key, getTotals(brandData[b.key])])),
    }) as Record<string, Metrics>, [brandData]);

    const filteredList = useMemo(() => {
        return list
            .map(name => ({
                name,
                sortCount: getMetrics(brandData.khg, name).total.length,
                metrics: {
                    khg: getMetrics(brandData.khg, name),
                    ...Object.fromEntries(BRANDS.map(b => [b.key, getMetrics(brandData[b.key], name)])),
                } as Record<string, Metrics>,
            }))
            .sort((a, b) => b.sortCount - a.sortCount);
    }, [list, brandData]);

    const searchedList = useMemo(() => {
        if (!searchTerm) return filteredList;
        return filteredList.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [filteredList, searchTerm]);

    const totalPages = Math.ceil(searchedList.length / itemsPerPage) || 1;

    const paginatedList = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return searchedList.slice(startIndex, startIndex + itemsPerPage);
    }, [searchedList, currentPage, itemsPerPage]);

    const pageNumbers = useMemo(() => {
        const maxPages = 5;
        let start = Math.max(1, currentPage - 2);
        let end = start + maxPages - 1;
        if (end > totalPages) {
            end = totalPages;
            start = Math.max(1, end - maxPages + 1);
        }
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }, [currentPage, totalPages]);

    const openCards = (title: string, fields: CardField[], records: Summary[]) =>
        setCardModal({ show: true, title, fields, records });

    /**
     * 数字のセル。
     *
     * ⚠️⚠️ **押せるのは「中身があるとき」だけ**（2026-09-18 の指示）。
     *   契約 … `competitor_win_reason` が入っている案件が1件でもあるとき
     *   失注 … 失注が1件でもあるとき
     *   ⚠️ 空のモーダルを開けると「壊れている」と受け取られる。
     *
     * ⚠️ 押せるセルは**点線の下線**を付ける。⚠️ 色だけでは押せると分からない。
     */
    const renderCountCell = (
        records: Summary[], type: 'total' | 'contract' | 'lose' | 'follow', makerName: string
    ) => {
        const count = records.length;
        if (count === 0) return <span className="cs_zero">0</span>;

        if (type === 'contract') {
            // ⚠️ 勝因が入っている案件だけを見せる。⚠️ 入っていない契約は出さない
            const withReason = records.filter(r => !isBlank(r.win_reason));
            if (withReason.length === 0) return <span className="cs_num cs_contract">{count}</span>;
            return (
                <button
                    type="button"
                    className="cs_num cs_contract cs_click"
                    title={`クリックで勝因を表示（${withReason.length}件）`}
                    // ⚠️ 表記は「{競合会社名} 契約一覧」。⚠️ **失注側と揃えてある**（2026-09-18 の指示）
                    onClick={() => openCards(`${makerName} 契約一覧`, WIN_FIELDS, withReason)}
                >
                    {count}
                </button>
            );
        }

        if (type === 'lose') {
            return (
                <button
                    type="button"
                    className="cs_num cs_lose cs_click"
                    title="クリックで敗因を表示"
                    // ⚠️ 表記は「{競合会社名} 失注一覧」（2026-09-18 の指示）
                    onClick={() => openCards(`${makerName} 失注一覧`, LOSE_FIELDS, records)}
                >
                    {count}
                </button>
            );
        }

        return <span className={`cs_num ${type === 'follow' ? 'cs_follow' : 'cs_total'}`}>{count}</span>;
    };

    const brandCells = (metrics: Metrics, makerName: string, first = false) => (
        <>
            <td className={first ? '' : 'cs_sep'}>{renderCountCell(metrics.total, 'total', makerName)}</td>
            <td>{renderCountCell(metrics.contract, 'contract', makerName)}</td>
            <td>{renderCountCell(metrics.lose, 'lose', makerName)}</td>
            <td>{renderCountCell(metrics.follow, 'follow', makerName)}</td>
        </>
    );

    const subHeaders = (first = false) => (
        <>
            <th className={`cs_th cs_th_sub ${first ? '' : 'cs_sep'}`}>総数</th>
            <th className="cs_th cs_th_sub">契約</th>
            <th className="cs_th cs_th_sub">失注</th>
            <th className="cs_th cs_th_sub">追客</th>
        </>
    );

    /** ⚠️ 列の総数。⚠️ 「該当なし」の colSpan に使う（ずれると表が崩れる） */
    const columnCount = 1 + (BRANDS.length + 1) * 4;

    return (
        <div className="cs_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル。共通CSSを汚さない */}
            <style>{`
                /**
                 * ⚠️⚠️ 全画面モーダルの Modal.Body は **p-0 かつ overflow: hidden**。
                 *   ⚠️ 余白はこちらで持ち、**表だけがスクロールする**形にする。
                 *   ⚠️ height:100% と min-height:0 を外すと表が画面外へ出る。
                 */
                .cs_wrap { font-size: 13px; color: #1f2937;
                           height: 100%; display: flex; flex-direction: column;
                           padding: 16px 32px 20px; box-sizing: border-box; }
                .cs_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .cs_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .cs_note { font-size: 11px; color: #6b7280; }

                .cs_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                          background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px;
                          padding: 10px 12px; }
                .cs_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .cs_select, .cs_input {
                    border: 1px solid #d8dee6; border-radius: 8px; height: 32px;
                    color: #1f2937; font-size: 12px; background: #fff; outline: none;
                    padding: 0 8px; }
                .cs_select:focus, .cs_input:focus { border-color: #93c5fd; box-shadow: 0 0 0 3px #dbeafe; }

                /* ⚠️ 表。⚠️ 見出しと総数行と先頭列を固定する。
                      ⚠️ flex:1 と min-height:0 で「残りの高さを使い切って中だけスクロール」 */
                .cs_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto;
                                 background: #fff; flex: 1 1 auto; min-height: 0; }
                .cs_table { border-collapse: separate; border-spacing: 0; font-size: 12px;
                            min-width: 1300px; width: 100%; text-align: center; }
                .cs_th { position: sticky; top: 0; z-index: 3; background: #f8fafc;
                         border-bottom: 1px solid #e5e7eb; padding: 7px 10px;
                         font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
                /* ⚠️ 2段目の見出し。⚠️ top を1段目の高さぶん下げないと重なる */
                .cs_th_sub { top: 30px; z-index: 3; font-size: 10px; }
                /* ⚠️ 先頭列。⚠️ 横スクロールしても競合他社名が見えるようにする */
                .cs_name_th { left: 0; z-index: 5; border-right: 2px solid #e5e7eb; text-align: left; }
                .cs_name_td { position: sticky; left: 0; z-index: 2; background: #fff;
                              border-right: 2px solid #e5e7eb; text-align: left;
                              font-weight: 700; color: #111827; white-space: nowrap;
                              padding: 7px 10px; }
                .cs_td { border-bottom: 1px solid #f1f5f9; padding: 6px 10px; }
                .cs_row:hover > td { background: #f8fafc; }
                /* ⚠️ ブランドの区切り。⚠️ 無いと28列が地続きに見えて読めない */
                .cs_sep { border-left: 2px solid #e5e7eb; }

                /**
                 * ⚠️⚠️ **総数行**。⚠️ 見出しのすぐ下に固定する（2026-09-18 の指示）。
                 *   ⚠️ top は1段目＋2段目の高さ。⚠️ ずらすと見出しに重なる。
                 */
                .cs_total_row > td { position: sticky; top: 56px; z-index: 2;
                                     background: #eff6ff; border-bottom: 2px solid #bfdbfe;
                                     font-weight: 700; }
                .cs_total_row > .cs_name_td { z-index: 4; background: #eff6ff; }

                .cs_num { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 13px; }
                .cs_total { color: #2563eb; }
                .cs_contract { color: #059669; }
                .cs_lose { color: #dc2626; }
                .cs_follow { color: #d97706; }
                .cs_zero { color: #cbd5e1; font-variant-numeric: tabular-nums; }
                /* ⚠️ 押せることを下線で示す。⚠️ 色だけでは分からない */
                .cs_click { background: none; border: none; padding: 0;
                            cursor: pointer; text-decoration: underline dotted; }
                .cs_click:hover { text-decoration: underline solid; }

                /* カードのグリッド。⚠️ 幅に合わせて自動で折り返す */
                .cs_cards { display: grid; gap: 10px;
                            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
                .cs_card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px;
                           background: #fff; }
                /**
                 * ⚠️⚠️ **カードの中の文字は少しくすませる**（2026-09-18 の指示）。
                 *   ⚠️ 表の数字（青・緑・赤）と同じ濃さだと、
                 *     ⚠️ **自由記述のほうが目立って読みにくい。**
                 *   ⚠️ 見出し #6b7280 → **#8b95a1**、本文 #1f2937 → **#4b5563**、
                 *     札 #4b5563 → **#6b7280** と1段ずつ落としてある。
                 *   ⚠️ ⚠️ **これ以上薄くしないこと。** 本文が読めなくなる。
                 */
                /* ⚠️ 担当店舗と反響媒体。⚠️ 自由記述と見分けがつくよう小さな札で出す */
                .cs_meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
                .cs_chip { font-size: 10px; color: #6b7280; background: #f5f6f8;
                           border-radius: 999px; padding: 2px 8px; white-space: nowrap; }

                .cs_field { margin-bottom: 6px; }
                .cs_field_label { font-size: 10px; color: #8b95a1; font-weight: 700; }
                /* ⚠️ 改行と長い語を折り返す。⚠️ 自由記述なので1語が長いことがある */
                .cs_field_value { font-size: 12px; line-height: 1.6; white-space: pre-wrap;
                                  word-break: break-word; color: #4b5563; }
                .cs_empty { color: #9ca3af; font-size: 12px; }

                .cs_page { display: flex; justify-content: center; gap: 4px; margin-top: 10px; }
                .cs_page button { border: 1px solid #e5e7eb; background: #fff; border-radius: 8px;
                                  font-size: 12px; padding: 3px 10px; color: #374151; }
                .cs_page button:disabled { color: #cbd5e1; }
                .cs_page button.is_active { background: #2563eb; border-color: #2563eb; color: #fff;
                                            font-weight: 700; }
            `}</style>

            <div className="cs_head mb-2">
                <span className="cs_title">
                    <i className="fa-solid fa-building-columns me-2 text-primary" aria-hidden="true" />
                    競合サマリー
                </span>
                {/* ⚠️⚠️ 縦に足しても総数行にならない理由を必ず出す。
                       書かないと「集計が壊れている」と受け取られる */}
                <span className="cs_note">
                    ※ 1件の案件に競合が複数いる場合、それぞれの行に数えられます（各行の合計は総数と一致しません）
                </span>
            </div>

            {error !== '' && (
                <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>
            )}

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">読み込み中</span>
                    </div>
                </div>
            ) : (
                <>
                    <div className="cs_bar mb-3">
                        <div>
                            <div className="cs_label">営業課</div>
                            <select
                                className="cs_select" style={{ width: '180px' }}
                                value={targetSection}
                                onChange={(e) => { setTargetSection(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="">全課を表示</option>
                                {sections.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="cs_label">店舗</div>
                            <select
                                className="cs_select" style={{ width: '200px' }}
                                value={targetShop}
                                onChange={(e) => { setTargetShop(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="">全店舗を表示</option>
                                {shops.map(s => <option key={s.shop} value={s.shop}>{s.shop}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="cs_label">競合名検索</div>
                            <input
                                type="text" className="cs_input" style={{ width: '200px' }}
                                placeholder="名称を入力..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                        </div>
                        <span className="cs_note ms-auto pb-1">
                            該当 {searchedList.length} 件／
                            <span className="fw-bold">契約・失注の数字はクリックできます</span>
                        </span>
                    </div>

                    <div className="cs_table_wrap">
                        <table className="cs_table">
                            <thead>
                                <tr>
                                    <th rowSpan={2} className="cs_th cs_name_th">競合他社名</th>
                                    <th colSpan={4} className="cs_th">KHG</th>
                                    {BRANDS.map(b => (
                                        <th key={b.key} colSpan={4} className="cs_th cs_sep">{b.label}</th>
                                    ))}
                                </tr>
                                <tr>
                                    {subHeaders(true)}
                                    {BRANDS.map(b => <React.Fragment key={b.key}>{subHeaders()}</React.Fragment>)}
                                </tr>
                            </thead>
                            <tbody>
                                {/* ⚠️⚠️ **総数行は見出しのすぐ下**（2026-09-18 の指示）。
                                       ⚠️ 競合ごとの行と混ざらないよう色と太字で分ける */}
                                <tr className="cs_total_row">
                                    <td className="cs_name_td">{totalLabel}</td>
                                    {brandCells(totalsRow.khg, totalLabel, true)}
                                    {BRANDS.map(b => (
                                        <React.Fragment key={b.key}>
                                            {brandCells(totalsRow[b.key], totalLabel)}
                                        </React.Fragment>
                                    ))}
                                </tr>

                                {paginatedList.length > 0 ? paginatedList.map((row, index) => (
                                    <tr className="cs_row" key={`${row.name}-${index}`}>
                                        <td className="cs_name_td">{row.name}</td>
                                        {brandCells(row.metrics.khg, row.name, true)}
                                        {BRANDS.map(b => (
                                            <React.Fragment key={b.key}>
                                                {brandCells(row.metrics[b.key], row.name)}
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                )) : (
                                    <tr>
                                        <td className="cs_td cs_empty py-4" colSpan={columnCount}>
                                            該当するデータがありません
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="cs_page">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>前へ</button>
                            {pageNumbers.map(page => (
                                <button key={page} className={currentPage === page ? 'is_active' : ''}
                                    onClick={() => setCurrentPage(page)}>{page}</button>
                            ))}
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>次へ</button>
                        </div>
                    )}
                </>
            )}

            {/**
              * ⚠️⚠️ **案件ごとのカード**（2026-09-18 の指示）。
              *   ⚠️ 勝ち（契約列）と負け（失注列）で**出す項目だけ**が違う。
              *   ⚠️ 2026-09-18 まではここに「失注理由の件数集計表」を出していたが、
              *     ⚠️ **カードへ置き換えた**（利用者の決定）。
              */}
            <Modal
                show={cardModal.show}
                onHide={() => setCardModal(prev => ({ ...prev, show: false }))}
                size="xl"
                centered
                scrollable
            >
                <Modal.Header closeButton className="border-bottom-0 pb-0">
                    {/* ⚠️ 見出しの色も1段くすませる（#374151 → #565f6b。2026-09-18 の指示） */}
                    <Modal.Title style={{ fontSize: '15px', fontWeight: 700, color: '#565f6b' }}>
                        {cardModal.title}
                        <span className="ms-2" style={{ fontSize: '12px', fontWeight: 400, color: '#8b95a1' }}>
                            {cardModal.records.length}件
                        </span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ maxHeight: '75vh' }}>
                    {cardModal.records.length === 0 ? (
                        <div className="cs_empty py-3">データがありません</div>
                    ) : (
                        <div className="cs_cards">
                            {cardModal.records.map((record, index) => {
                                // ⚠️ 空の項目は行ごと出さない。⚠️ 空行だらけのカードは読めない
                                const filled = cardModal.fields.filter(f => !isBlank(record[f.key]));
                                return (
                                    <div className="cs_card" key={record.id || index}>
                                        {/**
                                          * ⚠️⚠️ **担当店舗と反響媒体は勝ち・負けの両方で出す**（2026-09-18 の指示）。
                                          *   ⚠️ `shop` は `in_charge_store`、`medium` は `sales_promotion_name` の別名。
                                          *   ⚠️ **自由記述の項目より上に置く。** どの店舗のどの反響かが
                                          *     先に分からないと、勝因・敗因だけ読んでも判断できない。
                                          *
                                          * ⚠️⚠️ **お客様名（customer_contacts_name）と担当営業（in_charge_user）は出さない**
                                          *   （2026-09-18 の指示）。⚠️ **個人が特定できる情報を並べない。**
                                          *   ⚠️ ここは「どう勝ったか・どう負けたか」を読む場所である。
                                          *   ⚠️ ② / ① の SELECT には `customer` と `staff` が**残してある**。
                                          *     ⚠️ 応答の形を変えると ① との差分になるため。**画面で出さないだけ。**
                                          */}
                                        <div className="cs_meta">
                                            <span className="cs_chip">
                                                <i className="fa-solid fa-shop me-1" aria-hidden="true" />
                                                {record.shop || '店舗未設定'}
                                            </span>
                                            <span className="cs_chip">
                                                <i className="fa-solid fa-bullhorn me-1" aria-hidden="true" />
                                                {isBlank(record.medium) ? '媒体未設定' : record.medium}
                                            </span>
                                        </div>
                                        {filled.length === 0 ? (
                                            <div className="cs_empty">まだ入力されていません</div>
                                        ) : filled.map(f => (
                                            <div className="cs_field" key={f.key}>
                                                <div className="cs_field_label">{f.label}</div>
                                                <div className="cs_field_value">
                                                    {record[f.key]}{f.unit ?? ''}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default CompetitorSummary;
