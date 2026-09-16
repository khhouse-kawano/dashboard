import React, { useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';
import { buildReviewShops, orderByMaster } from './googleReviewUtils';
import type { ReviewShop, SectionMaster, ShopMaster } from './googleReviewUtils';

/**
 * Google 口コミの集計（ヘッダー → Google口コミ → 口コミ集計）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ データは `google_review` テーブル。projects/sync が Places API から
 *   取得して溜めている（runGoogleReview.ts）。**この画面は表示のみ。**
 *
 * ⚠️⚠️ **クチコミ本文は Google の仕様で最大5件ずつしか取れない。**
 *   毎回5件を取り、まだ持っていないものを足して溜めている。
 *   ⚠️ そのため件数（amount）と、溜まっている本文の数は**一致しない**。
 *   例）総数74件に対して本文は13件。⚠️ 利用者が混乱しないよう画面に注記を出す。
 *
 * ⚠️ `review_history`（評価の推移）は使わない（2026-09-15 の指示）。
 *
 * ⚠️⚠️ **2026-09-15 にカード式から表に変えた**（指示）。
 *   ⚠️ 並べ替えは**見出しのアイコン**で行う。選択肢（select）ではない。
 *   ⚠️ 横に広いので Header.tsx の `isFullscreenMenu` に入れてある。
 *     **外すと表が潰れる。**
 *
 * ⚠️ 店舗名の突き合わせは googleReviewUtils.ts に切り出してある。
 * ─────────────────────────────────────────────
 */

type SortKey = 'shop' | 'division' | 'section' | 'average' | 'amount' | 'reviews';
type SortOrder = 'asc' | 'desc';

/** 本文の折りたたみ文字数。⚠️ 長文が1件で表を占有するのを防ぐ */
const PREVIEW_LENGTH = 90;

const GoogleReview = () => {
    const [shops, setShops] = useState<ReviewShop[]>([]);
    const [sections, setSections] = useState<SectionMaster[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [targetDivision, setTargetDivision] = useState('');
    const [targetSection, setTargetSection] = useState('');

    /** ⚠️ 既定は評価の高い順 */
    const [sortKey, setSortKey] = useState<SortKey>('average');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    /** 本文を開いている店舗。⚠️ 店舗ごとに独立して開く */
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiClient.post('', { request: 'google_review', roll: 'summary' });
                setShops(buildReviewShops(res.data?.reviews ?? [], (res.data?.shop ?? []) as ShopMaster[]));
                setSections((res.data?.section ?? []) as SectionMaster[]);
            } catch {
                setError('口コミを取得できませんでした。時間をおいて再度お試しください。');
            } finally {
                setLoading(false);
            }
        };
        void fetchData();
    }, []);

    /**
     * 事業区分の選択肢。
     * ⚠️ 実データにあるものだけを出し、⚠️ **section_list の no 順**に並べる（指示）。
     */
    const divisions = useMemo(
        () => orderByMaster(
            [...new Set(shops.map(s => s.division).filter(Boolean))],
            sections,
            s => s.division
        ),
        [shops, sections]
    );

    /** 営業課の選択肢。⚠️ 事業区分を選んでいればその中だけに絞る */
    const sectionOptions = useMemo(() => {
        const base = targetDivision ? shops.filter(s => s.division === targetDivision) : shops;
        return orderByMaster(
            [...new Set(base.map(s => s.section).filter(Boolean))],
            sections,
            s => s.name
        );
    }, [shops, targetDivision, sections]);

    const visible = useMemo(() => {
        const filtered = shops.filter(s =>
            (!targetDivision || s.division === targetDivision) &&
            (!targetSection || s.section === targetSection)
        );

        /** 並べ替えの値。⚠️ 文字列と数値が混ざるので型で分ける */
        const keyOf = (s: ReviewShop): string | number => {
            switch (sortKey) {
                case 'shop': return s.shop;
                case 'division': return s.division;
                case 'section': return s.section;
                case 'amount': return s.amount;
                case 'reviews': return s.reviews.length;
                case 'average':
                default: return s.average;
            }
        };

        // ⚠️ 元の配列を壊さない（sort は破壊的）
        return [...filtered].sort((a, b) => {
            const av = keyOf(a);
            const bv = keyOf(b);
            let diff: number;
            if (typeof av === 'string' || typeof bv === 'string') {
                // ⚠️ 空文字（マスタ未登録）は常に末尾へ。昇順・降順に関わらず
                if (av === '' && bv !== '') return 1;
                if (bv === '' && av !== '') return -1;
                diff = String(av).localeCompare(String(bv), 'ja');
            } else {
                diff = av - bv;
            }
            // ⚠️ 同値なら店舗名で安定させる。並びが毎回変わると読みにくい
            if (diff === 0) return a.shop.localeCompare(b.shop, 'ja');
            return sortOrder === 'asc' ? diff : -diff;
        });
    }, [shops, targetDivision, targetSection, sortKey, sortOrder]);

    /** 表示中の合計。⚠️ 平均は件数で重み付けする（単純平均だと小店舗が効きすぎる） */
    const total = useMemo(() => {
        const amount = visible.reduce((acc, s) => acc + s.amount, 0);
        const weighted = visible.reduce((acc, s) => acc + s.average * s.amount, 0);
        return {
            shops: visible.length,
            amount,
            average: amount > 0 ? weighted / amount : 0,
        };
    }, [visible]);

    /**
     * 星。
     * ⚠️⚠️ **小数第一位が分かるようにする**（指示）。
     *   4.3 なら「★★★★」＋ 3割だけ塗った星。幅を % で切るので端数が見た目に出る。
     */
    const Stars = ({ value }: { value: number }) => {
        // ⚠️ 小数2桁に丸める。丸めないと 4.9 が 98.00000000000001% になり、
        //   CSS にその桁数がそのまま出る（描画は同じだが読みにくい）
        const percent = Math.round(Math.max(0, Math.min(100, (value / 5) * 100)) * 100) / 100;
        return (
            <span className="gr_stars" aria-label={`5点中 ${value.toFixed(1)}点`}>
                <span className="gr_stars_bg">★★★★★</span>
                {/* ⚠️ 上に重ねて幅で切る。文字は同じものを使う（字形がずれないため） */}
                <span className="gr_stars_fg" style={{ width: `${percent}%` }}>★★★★★</span>
            </span>
        );
    };

    /**
     * 並べ替えの見出し。
     * ⚠️ クリックで発火する（2026-09-15 に select から変更）。
     *   ⚠️ 同じ列を押したら昇順・降順が入れ替わる。別の列なら降順から始める
     *     （評価や件数は「多い順」を先に見たいことがほとんどのため）。
     */
    const SortHead = ({ label, keyName, align = 'left', width }: {
        label: string; keyName: SortKey; align?: 'left' | 'center' | 'right'; width?: string;
    }) => {
        const active = sortKey === keyName;
        return (
            <th
                className={`gr_th gr_th_sort text-${align}`}
                style={{ width }}
                onClick={() => {
                    if (active) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(keyName); setSortOrder('desc'); }
                }}
                title="クリックで並べ替え"
            >
                {label}
                {/* ⚠️ 並べ替え中の列だけ濃く出す。どの列で並んでいるか分かるように */}
                <span className={`gr_sort_icon${active ? ' is_active' : ''}`}>
                    {active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
            </th>
        );
    };

    const toggle = (no: number) => setExpanded(prev => ({ ...prev, [no]: !prev[no] }));

    /** 本文の `<br>` を改行にして描く。⚠️ HTML としては解釈しない */
    const renderText = (text: string) => text.split('<br>').map((line, k) => (
        <React.Fragment key={k}>{line}<br /></React.Fragment>
    ));

    return (
        <div className="gr_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル。共通CSSを汚さない */}
            <style>{`
                /**
                 * ⚠️⚠️ 全画面モーダルの Modal.Body は **p-0 かつ overflow: hidden** である
                 *   （Header.tsx）。⚠️ そのため
                 *     ・余白はこちらで持つ（py-3 px-5 相当）
                 *     ・高さを使い切り、**表だけがスクロールする**形にする
                 *   ⚠️ height:100% と min-height:0 を外すと、表が画面外へ出て見えなくなる。
                 *
                 * ⚠️ Header.tsx 側に余白を足すと他の全画面メニューにも効くので触らない。
                 */
                .gr_wrap { font-size: 13px; color: #1f2937;
                           height: 100%; display: flex; flex-direction: column;
                           padding: 16px 40px 20px; box-sizing: border-box; }
                /**
                 * ⚠️ 横幅いっぱいに広げると視線の移動が大きく読みにくい（2026-09-15 の指摘）。
                 *   ⚠️ 最大幅を決めて中央に寄せる。広い画面でも行が間延びしない。
                 *   ⚠️ これを外すと全幅に戻る。
                 */
                .gr_inner { width: 100%; max-width: 1500px; margin: 0 auto;
                            display: flex; flex-direction: column; min-height: 0; flex: 1; }
                .gr_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .gr_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .gr_note { font-size: 11px; color: #6b7280; }
                .gr_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                          background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px;
                          padding: 10px 12px; }
                .gr_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .gr_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .gr_kpi_card { flex: 1 1 160px; background: #fff; border: 1px solid #e5e7eb;
                               border-radius: 10px; padding: 10px 14px; }
                .gr_kpi_label { font-size: 11px; color: #6b7280; }
                .gr_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; }

                /* ⚠️ 表の上の注意書き。⚠️ 長文なので gr_note（11px 一行）とは別にする。
                      ⚠️ flex-shrink:0 を外すと、表が伸びたときにここが潰れて読めなくなる */
                .gr_caution { font-size: 11px; color: #92400e; line-height: 1.8;
                              background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }

                /* ⚠️ 表。⚠️ 見出しは固定する（店舗が多いと見出しが流れるため）
                   ⚠️ flex:1 と min-height:0 で「残りの高さを使い切って中だけスクロール」。
                      ⚠️ min-height:0 を外すと flex の既定（auto）で縮まず、
                        表が画面外へ出る。 */
                .gr_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto;
                                 background: #fff; flex: 1 1 auto; min-height: 0; }
                .gr_table { width: 100%; border-collapse: separate; border-spacing: 0;
                            font-size: 12px; }
                .gr_th { position: sticky; top: 0; z-index: 2; background: #f8fafc;
                         border-bottom: 1px solid #e5e7eb; padding: 9px 12px;
                         font-weight: 700; font-size: 11px; color: #4b5563;
                         white-space: nowrap; }
                .gr_th_sort { cursor: pointer; user-select: none; }
                .gr_th_sort:hover { background: #eef2f7; }
                .gr_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .gr_sort_icon.is_active { color: #2563eb; }
                .gr_td { border-bottom: 1px solid #f1f5f9; padding: 9px 12px;
                         vertical-align: middle; }
                .gr_row:hover > .gr_td { background: #f8fafc; }
                .gr_shop { font-weight: 700; font-size: 13px; }
                .gr_tag { font-size: 10px; color: #4b5563; background: #f3f4f6;
                          border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
                .gr_avg { font-size: 15px; font-weight: 700; color: #b45309; }
                .gr_amount { font-variant-numeric: tabular-nums; }

                /* ⚠️ 星は重ね合わせ。position を外すと端数が出せなくなる */
                .gr_stars { position: relative; display: inline-block; white-space: nowrap;
                            letter-spacing: 1px; line-height: 1; }
                .gr_stars_bg { color: #e5e7eb; }
                .gr_stars_fg { color: #f59e0b; position: absolute; left: 0; top: 0;
                               overflow: hidden; white-space: nowrap; }

                .gr_more { font-size: 11px; font-weight: 700; color: #2563eb; cursor: pointer;
                           background: none; border: none; padding: 2px 0; white-space: nowrap; }
                .gr_more:hover { text-decoration: underline; }
                .gr_detail > .gr_td { background: #fbfdff; padding: 10px 16px 14px; }
                .gr_review { border-top: 1px dashed #e5e7eb; padding-top: 8px; margin-top: 8px; }
                .gr_review:first-child { border-top: none; margin-top: 0; padding-top: 0; }
                .gr_review_head { display: flex; align-items: center; gap: 8px; }
                .gr_date { font-size: 11px; color: #9ca3af; }
                .gr_text { margin-top: 4px; line-height: 1.7; font-size: 12px;
                           word-break: break-word; }
                .gr_empty { color: #9ca3af; font-size: 12px; }
                .gr_link { font-size: 11px; color: #2563eb; text-decoration: none;
                           white-space: nowrap; }
                .gr_link:hover { text-decoration: underline; }
            `}</style>

            {/* ⚠️ 中央寄せの内側ラッパ。⚠️ 全画面でも横に広がりすぎないようにする */}
            <div className="gr_inner">
            <div className="gr_head mb-2">
                <span className="gr_title">
                    <i className="fa-brands fa-google me-2 text-primary" aria-hidden="true" />
                    Google 口コミ集計
                </span>
                {/* ⚠️⚠️ 本文が総数より少ない理由を必ず出す。書かないと
                       「クチコミが消えている」と受け取られる */}
                <span className="gr_note">
                    ※ 評価・レビュー数は Google の全体値です。本文は取得できた分のみ表示しています
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
                    <div className="gr_bar mb-3">
                        <div>
                            <div className="gr_label">事業区分</div>
                            <Form.Select
                                size="sm" value={targetDivision} style={{ width: '180px', fontSize: '12px' }}
                                onChange={(e) => {
                                    // ⚠️ 事業を変えたら営業課を外す。残ると0件になる
                                    setTargetSection('');
                                    setTargetDivision(e.target.value);
                                }}
                            >
                                <option value="">すべて</option>
                                {divisions.map(d => <option key={d} value={d}>{d}</option>)}
                            </Form.Select>
                        </div>
                        <div>
                            <div className="gr_label">営業課</div>
                            <Form.Select
                                size="sm" value={targetSection} style={{ width: '200px', fontSize: '12px' }}
                                onChange={(e) => setTargetSection(e.target.value)}
                            >
                                <option value="">すべて</option>
                                {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </Form.Select>
                        </div>
                        {/* ⚠️ 並べ替えの select は置かない。見出しのアイコンで行う（指示） */}
                        <span className="gr_note ms-auto">
                            並べ替えは見出しをクリック
                        </span>
                    </div>

                    <div className="gr_kpi mb-3">
                        <div className="gr_kpi_card">
                            <div className="gr_kpi_label">店舗数</div>
                            <div className="gr_kpi_value">{total.shops.toLocaleString()}</div>
                        </div>
                        <div className="gr_kpi_card">
                            <div className="gr_kpi_label">レビュー総数</div>
                            <div className="gr_kpi_value">{total.amount.toLocaleString()}</div>
                        </div>
                        <div className="gr_kpi_card">
                            <div className="gr_kpi_label">
                                平均評価
                                {/* ⚠️ 単純平均ではないことを明記する */}
                                <span className="ms-1" style={{ fontSize: '10px' }}>（レビュー数で加重）</span>
                            </div>
                            <div className="gr_kpi_value" style={{ color: '#b45309' }}>
                                {total.average.toFixed(1)}
                                <span className="ms-2"><Stars value={total.average} /></span>
                            </div>
                        </div>
                    </div>

                    {/**
                      * ⚠️⚠️ **レビュー数が「減る」ことがある理由をここに書いておく**（2026-09-16 の指示）。
                      *   ⚠️ 書かないと「取り込みが壊れている」と受け取られる。
                      *     実際には Google 側で消えているだけのことがある。
                      */}
                    <div className="gr_caution mb-2">
                        レビュー数は Dashboard が取り込んだ時点の数です。
                        「ユーザー自身が過去の自分の口コミを削除した」、
                        「Google のスパムフィルターやポリシー違反（虚偽の投稿、不適切なコンテンツなど）の判定により、
                        Google 側が口コミを削除した」等のケースでレビュー数が減ることもあります。
                    </div>

                    <div className="gr_table_wrap">
                        <table className="gr_table">
                            <thead>
                                <tr>
                                    <SortHead label="店舗名" keyName="shop" width="210px" />
                                    <SortHead label="事業区分" keyName="division" width="130px" />
                                    <SortHead label="営業課" keyName="section" width="150px" />
                                    <SortHead label="評価" keyName="average" align="center" width="170px" />
                                    <SortHead label="レビュー数" keyName="amount" align="right" width="100px" />
                                    <SortHead label="取得本文" keyName="reviews" align="right" width="90px" />
                                    <th className="gr_th">最新のクチコミ</th>
                                    <th className="gr_th" style={{ width: '130px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.length === 0 ? (
                                    <tr>
                                        <td className="gr_td gr_empty text-center py-4" colSpan={8}>
                                            該当する店舗がありません
                                        </td>
                                    </tr>
                                ) : visible.map(shop => {
                                    const isOpen = expanded[shop.no] === true;
                                    const latest = shop.reviews[0];

                                    return (
                                        <React.Fragment key={shop.no}>
                                            <tr className="gr_row">
                                                <td className="gr_td">
                                                    <div className="gr_shop">{shop.shop}</div>
                                                    {/* ⚠️ shop_list と突き合わせられなかったものは印を出す。
                                                           黙って絞り込みから消えるより気づける */}
                                                    {!shop.division && (
                                                        <span className="gr_tag" style={{ background: '#fef3c7', color: '#92400e' }}>
                                                            店舗マスタ未登録
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="gr_td">{shop.division || '-'}</td>
                                                <td className="gr_td">{shop.section || '-'}</td>
                                                <td className="gr_td text-center">
                                                    <span className="d-inline-flex align-items-center gap-2">
                                                        <Stars value={shop.average} />
                                                        <span className="gr_avg">{shop.average.toFixed(1)}</span>
                                                    </span>
                                                </td>
                                                <td className="gr_td text-end gr_amount">{shop.amount.toLocaleString()}</td>
                                                <td className="gr_td text-end gr_amount">{shop.reviews.length.toLocaleString()}</td>
                                                <td className="gr_td">
                                                    {latest ? (
                                                        <span className="gr_text d-block" style={{ marginTop: 0 }}>
                                                            {latest.text.length > PREVIEW_LENGTH
                                                                ? `${latest.text.replace(/<br>/g, ' ').slice(0, PREVIEW_LENGTH)}…`
                                                                : latest.text.replace(/<br>/g, ' ')}
                                                        </span>
                                                    ) : (
                                                        <span className="gr_empty">まだ本文を取得できていません</span>
                                                    )}
                                                </td>
                                                <td className="gr_td text-end">
                                                    {shop.reviews.length > 0 && (
                                                        <button className="gr_more" onClick={() => toggle(shop.no)}>
                                                            {isOpen ? '閉じる' : `レビューを読む（${shop.reviews.length}）`}
                                                        </button>
                                                    )}
                                                    {shop.url && (
                                                        <div>
                                                            <a className="gr_link" href={shop.url} target="_blank" rel="noopener noreferrer">
                                                                Googleマップ
                                                                <i className="fa-solid fa-arrow-up-right-from-square ms-1" aria-hidden="true" />
                                                            </a>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>

                                            {/* ⚠️ 本文は行の下に広げる。全部を表に並べると読めなくなるため（指示） */}
                                            {isOpen && (
                                                <tr className="gr_detail">
                                                    <td className="gr_td" colSpan={8}>
                                                        {shop.reviews.map((r, i) => (
                                                            <div className="gr_review" key={`${shop.no}-${i}`}>
                                                                <div className="gr_review_head">
                                                                    <Stars value={r.rating} />
                                                                    <span className="gr_date">
                                                                        {/* ⚠️ ISO文字列。日付だけ出す */}
                                                                        {(r.date ?? '').slice(0, 10).replace(/-/g, '/')}
                                                                    </span>
                                                                </div>
                                                                {/* ⚠️⚠️ **dangerouslySetInnerHTML は使わない。**
                                                                       Google のクチコミは外部からの入力である */}
                                                                <div className="gr_text">{renderText(r.text)}</div>
                                                            </div>
                                                        ))}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
            </div>
        </div>
    );
};

export default GoogleReview;
