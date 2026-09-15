import React, { useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';
import { buildReviewShops } from './googleReviewUtils';
import type { ReviewShop, ShopMaster } from './googleReviewUtils';

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
 *   ⚠️ 必要になったら ② の summary に足すこと。今は転送量を増やさない。
 *
 * ⚠️ 店舗名の突き合わせは googleReviewUtils.ts に切り出してある。
 *   Google 側の登録名と shop_list の表記がまったく違うため。
 * ─────────────────────────────────────────────
 */

type SortKey = 'average' | 'amount';
type SortOrder = 'asc' | 'desc';

/** 一覧に出す本文の数。⚠️ これを超える分は「レビューを読む」で開く */
const PREVIEW_COUNT = 2;

/** 本文の折りたたみ文字数。⚠️ 長文が1件で画面を占有するのを防ぐ */
const PREVIEW_LENGTH = 120;

const GoogleReview = () => {
    const [shops, setShops] = useState<ReviewShop[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [targetDivision, setTargetDivision] = useState('');
    const [targetSection, setTargetSection] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('average');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    /** 本文を開いている店舗。⚠️ 店舗ごとに独立して開く */
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiClient.post('', { request: 'google_review', roll: 'summary' });
                setShops(buildReviewShops(res.data?.reviews ?? [], (res.data?.shop ?? []) as ShopMaster[]));
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
     * ⚠️ 実データから作る。⚠️ 空文字（突き合わせ不能）は選択肢に出さない。
     */
    const divisions = useMemo(
        () => [...new Set(shops.map(s => s.division).filter(Boolean))].sort(),
        [shops]
    );

    /** 営業課の選択肢。⚠️ 事業区分を選んでいればその中だけに絞る */
    const sections = useMemo(() => {
        const base = targetDivision ? shops.filter(s => s.division === targetDivision) : shops;
        return [...new Set(base.map(s => s.section).filter(Boolean))].sort();
    }, [shops, targetDivision]);

    const visible = useMemo(() => {
        const filtered = shops.filter(s =>
            (!targetDivision || s.division === targetDivision) &&
            (!targetSection || s.section === targetSection)
        );
        // ⚠️ 元の配列を壊さない（sort は破壊的）
        return [...filtered].sort((a, b) => {
            const av = sortKey === 'average' ? a.average : a.amount;
            const bv = sortKey === 'average' ? b.average : b.amount;
            // ⚠️ 同値なら店舗名で安定させる。並びが毎回変わると読みにくい
            if (av === bv) return a.shop.localeCompare(b.shop, 'ja');
            return sortOrder === 'asc' ? av - bv : bv - av;
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
     *   4.3 なら「★★★★」＋ 3割だけ塗った星。
     *   ⚠️ 幅を % で切るので、端数がそのまま見た目に出る。
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

    const toggle = (no: number) => setExpanded(prev => ({ ...prev, [no]: !prev[no] }));

    return (
        <div className="gr_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル。共通CSSを汚さない */}
            <style>{`
                .gr_wrap { font-size: 13px; color: #1f2937; }
                .gr_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .gr_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .gr_note { font-size: 11px; color: #6b7280; }
                .gr_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                          background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px;
                          padding: 10px 12px; }
                .gr_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .gr_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .gr_kpi_card { flex: 1 1 150px; background: #fff; border: 1px solid #e5e7eb;
                               border-radius: 10px; padding: 10px 14px; }
                .gr_kpi_label { font-size: 11px; color: #6b7280; }
                .gr_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; }
                .gr_card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px;
                           background: #fff; }
                .gr_card + .gr_card { margin-top: 10px; }
                .gr_card_head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                .gr_shop { font-weight: 700; font-size: 14px; }
                .gr_tag { font-size: 10px; color: #4b5563; background: #f3f4f6;
                          border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
                .gr_avg { font-size: 18px; font-weight: 700; color: #b45309; }
                .gr_amount { font-size: 11px; color: #6b7280; }
                /* ⚠️ 星は重ね合わせ。position を外すと端数が出せなくなる */
                .gr_stars { position: relative; display: inline-block; white-space: nowrap;
                            letter-spacing: 1px; line-height: 1; }
                .gr_stars_bg { color: #e5e7eb; }
                .gr_stars_fg { color: #f59e0b; position: absolute; left: 0; top: 0;
                               overflow: hidden; white-space: nowrap; }
                .gr_review { border-top: 1px dashed #e5e7eb; padding-top: 8px; margin-top: 8px; }
                .gr_review_head { display: flex; align-items: center; gap: 8px; }
                .gr_date { font-size: 11px; color: #9ca3af; }
                .gr_text { margin-top: 4px; line-height: 1.7; font-size: 12px;
                           word-break: break-word; }
                .gr_more { font-size: 11px; font-weight: 700; color: #2563eb; cursor: pointer;
                           background: none; border: none; padding: 4px 0; }
                .gr_more:hover { text-decoration: underline; }
                .gr_empty { color: #9ca3af; font-size: 12px; padding: 6px 0; }
                .gr_link { font-size: 11px; color: #2563eb; text-decoration: none; }
                .gr_link:hover { text-decoration: underline; }
            `}</style>

            <div className="gr_head mb-2">
                <span className="gr_title">
                    <i className="fa-brands fa-google me-2 text-primary" aria-hidden="true" />
                    Google 口コミ集計
                </span>
                {/* ⚠️⚠️ 本文が総数より少ない理由を必ず出す。書かないと
                       「クチコミが消えている」と受け取られる */}
                <span className="gr_note">
                    ※ 評価・件数は Google の全体値です。本文は取得できた分のみ表示しています
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
                                size="sm" value={targetDivision} style={{ width: '170px', fontSize: '12px' }}
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
                                size="sm" value={targetSection} style={{ width: '190px', fontSize: '12px' }}
                                onChange={(e) => setTargetSection(e.target.value)}
                            >
                                <option value="">すべて</option>
                                {sections.map(s => <option key={s} value={s}>{s}</option>)}
                            </Form.Select>
                        </div>
                        <div>
                            <div className="gr_label">並べ替え</div>
                            <Form.Select
                                size="sm" value={sortKey} style={{ width: '130px', fontSize: '12px' }}
                                onChange={(e) => setSortKey(e.target.value as SortKey)}
                            >
                                <option value="average">評価</option>
                                <option value="amount">口コミ数</option>
                            </Form.Select>
                        </div>
                        <div>
                            <Form.Select
                                size="sm" value={sortOrder} style={{ width: '110px', fontSize: '12px' }}
                                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                            >
                                <option value="desc">高い順</option>
                                <option value="asc">低い順</option>
                            </Form.Select>
                        </div>
                    </div>

                    <div className="gr_kpi mb-3">
                        <div className="gr_kpi_card">
                            <div className="gr_kpi_label">店舗数</div>
                            <div className="gr_kpi_value">{total.shops.toLocaleString()}</div>
                        </div>
                        <div className="gr_kpi_card">
                            <div className="gr_kpi_label">口コミ総数</div>
                            <div className="gr_kpi_value">{total.amount.toLocaleString()}</div>
                        </div>
                        <div className="gr_kpi_card">
                            <div className="gr_kpi_label">
                                平均評価
                                {/* ⚠️ 単純平均ではないことを明記する */}
                                <span className="ms-1" style={{ fontSize: '10px' }}>（口コミ数で加重）</span>
                            </div>
                            <div className="gr_kpi_value" style={{ color: '#b45309' }}>
                                {total.average.toFixed(1)}
                                <span className="ms-2"><Stars value={total.average} /></span>
                            </div>
                        </div>
                    </div>

                    {visible.length === 0 ? (
                        <div className="gr_empty">該当する店舗がありません</div>
                    ) : visible.map(shop => {
                        const isOpen = expanded[shop.no] === true;
                        const shown = isOpen ? shop.reviews : shop.reviews.slice(0, PREVIEW_COUNT);
                        const rest = shop.reviews.length - shown.length;

                        return (
                            <div className="gr_card" key={shop.no}>
                                <div className="gr_card_head">
                                    <span className="gr_shop">{shop.shop}</span>
                                    {shop.division && <span className="gr_tag">{shop.division}</span>}
                                    {shop.section && <span className="gr_tag">{shop.section}</span>}
                                    {/* ⚠️ shop_list と突き合わせられなかったものは印を出す。
                                           黙って絞り込みから消えるより気づける */}
                                    {!shop.division && (
                                        <span className="gr_tag" style={{ background: '#fef3c7', color: '#92400e' }}>
                                            店舗マスタ未登録
                                        </span>
                                    )}
                                    <span className="ms-auto d-flex align-items-center gap-2">
                                        <Stars value={shop.average} />
                                        <span className="gr_avg">{shop.average.toFixed(1)}</span>
                                        <span className="gr_amount">{shop.amount.toLocaleString()}件</span>
                                    </span>
                                </div>

                                {shop.reviews.length === 0 ? (
                                    <div className="gr_empty">まだ本文を取得できていません</div>
                                ) : (
                                    <>
                                        {shown.map((r, i) => (
                                            <div className="gr_review" key={`${shop.no}-${i}`}>
                                                <div className="gr_review_head">
                                                    <Stars value={r.rating} />
                                                    <span className="gr_date">
                                                        {/* ⚠️ ISO文字列。日付だけ出す */}
                                                        {(r.date ?? '').slice(0, 10).replace(/-/g, '/')}
                                                    </span>
                                                </div>
                                                {/* ⚠️⚠️ 本文は `<br>` を含む文字列だが
                                                       **dangerouslySetInnerHTML は使わない。**
                                                       Google のクチコミは外部からの入力である。
                                                       改行に置き換えて表示する */}
                                                <div className="gr_text">
                                                    {(isOpen
                                                        ? r.text
                                                        : r.text.length > PREVIEW_LENGTH
                                                            ? `${r.text.slice(0, PREVIEW_LENGTH)}…`
                                                            : r.text
                                                    ).split('<br>').map((line, k) => (
                                                        <React.Fragment key={k}>
                                                            {line}
                                                            <br />
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}

                                        {/* ⚠️ 全部出すとモーダルが読みにくくなるので畳んでおく（指示） */}
                                        {(rest > 0 || isOpen) && (
                                            <button className="gr_more" onClick={() => toggle(shop.no)}>
                                                {isOpen
                                                    ? '閉じる'
                                                    : `レビューを読む（あと ${rest} 件）`}
                                            </button>
                                        )}
                                    </>
                                )}

                                {shop.url && (
                                    <div className="mt-1">
                                        <a className="gr_link" href={shop.url} target="_blank" rel="noopener noreferrer">
                                            Google マップで見る
                                            <i className="fa-solid fa-arrow-up-right-from-square ms-1" aria-hidden="true" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
};

export default GoogleReview;
