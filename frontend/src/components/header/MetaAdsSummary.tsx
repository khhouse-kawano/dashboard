import React from 'react';
import { Table, Badge } from 'react-bootstrap';
import { AdvertiserSummary, TitleSummary, MonthlyRow } from './metaAdsUtils';

/**
 * 他社広告ライブラリの集計表示。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **「掲載期間」は出していない。出せない。**
 *   ⚠️ `advertiser_period` は**開始日だけ**で終了日が無く、
 *     `ad_hash` が UNIQUE なので同じ広告が複数の取得日にまたがらない。
 *   ⚠️ **「いつまで出ていたか」は分からない。**
 *     期間らしき指標を足さないこと（読む人が誤解する）。
 *
 * ⚠️⚠️ **取れなかった件数を必ず画面に出す。**
 *   ⚠️ 掲載開始日は実測で**30%（1,132件）が空か壊れている**。
 *     黙って除くと「先月は少なかった」と誤読される。
 * ─────────────────────────────────────────────
 */

interface Props {
    advertisers: AdvertiserSummary[];
    titles: TitleSummary[];
    monthly: { rows: MonthlyRow[]; unknown: number; since: string; beforeSince: number };
    /** 絞り込み後の総バナー数。⚠️ 表の合計と突き合わせられるように出す */
    total: number;
}

const MetaAdsSummary: React.FC<Props> = ({ advertisers, titles, monthly, total }) => {
    // ⚠️ グラフの縦幅を決めるための最大値。0除算を避ける
    const max = monthly.rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;

    return (
        <div className="mb-4">

            {/* ---- 月別の推移 ---- */}
            <div className="bg-white shadow-sm rounded p-3 mb-3">
                <div className="fw-bold text-secondary mb-1" style={{ fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-chart-column me-2"></i>掲載開始月ごとの新規バナー数
                </div>

                {/**
                  * ⚠️⚠️ **収集開始より前の月を出さない理由を必ず添える。**
                  *   ⚠️ 出すと右肩上がりのグラフに見えるが、実態は
                  *     「収集開始時点でまだ出ていた長期掲載の広告」が混ざっているだけ。
                  */}
                <div className="text-muted mb-3" style={{ fontSize: '0.7rem', lineHeight: 1.7 }}>
                    ⚠️ 収集を始めたのが {monthly.since.replace('-', '/')} のため、それ以前の月は
                    「収集開始時点でまだ出ていた広告」しか映りません。グラフからは外しています
                    （{monthly.beforeSince.toLocaleString()}件）。<br />
                    ⚠️ 掲載開始日が取れなかった {monthly.unknown.toLocaleString()}件 も含みません。
                </div>

                {monthly.rows.length === 0 ? (
                    <div className="text-muted py-3 text-center" style={{ fontSize: '0.8rem' }}>
                        表示できる月がありません。
                    </div>
                ) : (
                    <div className="d-flex align-items-end gap-2" style={{ height: '140px' }}>
                        {monthly.rows.map(row => (
                            <div key={row.month} className="d-flex flex-column align-items-center" style={{ flex: '1 1 0', minWidth: 0 }}>
                                <div className="text-secondary" style={{ fontSize: '0.7rem' }}>{row.count}</div>
                                <div
                                    // ⚠️ 高さは最大値との比。⚠️ 0件でも線が見えるよう下限を持たせる
                                    style={{
                                        width: '100%', backgroundColor: '#0d6efd', borderRadius: '3px 3px 0 0',
                                        height: `${Math.max(4, (row.count / max) * 100)}px`,
                                    }}
                                    title={`${row.month}：${row.count}件`}
                                />
                                <div className="text-muted text-nowrap" style={{ fontSize: '0.65rem', marginTop: '4px' }}>
                                    {row.month.slice(5)}月
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ---- 広告主ごと ---- */}
            <div className="bg-white shadow-sm rounded p-3 mb-3">
                <div className="fw-bold text-secondary mb-1" style={{ fontSize: '0.85rem' }}>
                    <i className="fa-regular fa-building me-2"></i>広告主ごと
                    <span className="text-muted fw-normal ms-2" style={{ fontSize: '0.75rem' }}>
                        {advertisers.length}社 / {total.toLocaleString()}バナー
                    </span>
                </div>
                <div className="text-muted mb-2" style={{ fontSize: '0.7rem' }}>
                    ⚠️「1見出しあたり」は、同じ見出しで画像やリンクを変えた別バナーが何本あるか。
                    大きいほど1つの訴求を作り込んでいます。
                </div>

                <div className="table-responsive">
                    <Table hover className="align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                        <thead className="table-light text-secondary text-nowrap">
                            <tr>
                                <th className="fw-normal py-2">広告主</th>
                                <th className="fw-normal py-2 text-end">バナー</th>
                                <th className="fw-normal py-2 text-end">見出し</th>
                                <th className="fw-normal py-2 text-end">1見出しあたり</th>
                                <th className="fw-normal py-2">エリア</th>
                                <th className="fw-normal py-2">最新の掲載開始</th>
                            </tr>
                        </thead>
                        <tbody>
                            {advertisers.map(row => (
                                <tr key={row.advertiser}>
                                    <td className="fw-bold text-dark">{row.advertiser}</td>
                                    <td className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.banners.toLocaleString()}</td>
                                    <td className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.titles.toLocaleString()}</td>
                                    <td className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.perTitle.toFixed(1)}</td>
                                    <td>
                                        <div className="d-flex flex-wrap gap-1">
                                            {row.areas.map(a => (
                                                <Badge key={a.area} bg="light" text="dark" className="fw-normal border">
                                                    {a.area} {a.count}
                                                </Badge>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="text-nowrap">
                                        {row.latestStart === ''
                                            // ⚠️ 空欄にせず「不明」と書く。空欄だと0件と区別できない
                                            ? <span className="text-muted">不明</span>
                                            : row.latestStart.replace(/-/g, '/')}
                                        {row.unknownStart === 0 || (
                                            <span className="text-muted ms-2" style={{ fontSize: '0.7rem' }}>
                                                （開始日不明 {row.unknownStart}）
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </div>

            {/* ---- 見出しごと ---- */}
            <div className="bg-white shadow-sm rounded p-3">
                <div className="fw-bold text-secondary mb-1" style={{ fontSize: '0.85rem' }}>
                    <i className="fa-solid fa-quote-left me-2"></i>複数バナーを展開している見出し
                    <span className="text-muted fw-normal ms-2" style={{ fontSize: '0.75rem' }}>
                        上位50件 / 全{titles.length.toLocaleString()}種
                    </span>
                </div>
                <div className="text-muted mb-2" style={{ fontSize: '0.7rem' }}>
                    ⚠️ 同じ見出しを複数の広告主が使っていることがあります（スクレイピングの取りこぼし分を含む）。
                </div>

                <div className="table-responsive">
                    <Table hover className="align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                        <thead className="table-light text-secondary text-nowrap">
                            <tr>
                                <th className="fw-normal py-2" style={{ width: '50%' }}>見出し</th>
                                <th className="fw-normal py-2">広告主</th>
                                <th className="fw-normal py-2 text-end">バナー</th>
                                <th className="fw-normal py-2">掲載開始</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* ⚠️ slice は非破壊。元の配列を並べ替えない */}
                            {titles.slice(0, 50).map(row => (
                                <tr key={row.title}>
                                    <td className="text-dark" style={{
                                        display: '-webkit-box', WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                    }}>
                                        {row.title}
                                    </td>
                                    <td>
                                        <div className="d-flex flex-wrap gap-1">
                                            {row.advertisers.map(a => (
                                                <Badge key={a} bg="secondary" className="fw-normal">{a}</Badge>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="text-end" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.banners}</td>
                                    <td className="text-nowrap text-muted" style={{ fontSize: '0.75rem' }}>
                                        {row.firstStart === ''
                                            ? '不明'
                                            : row.firstStart === row.latestStart
                                                ? row.firstStart.replace(/-/g, '/')
                                                : `${row.firstStart.replace(/-/g, '/')} 〜 ${row.latestStart.replace(/-/g, '/')}`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </div>
        </div>
    );
};

export default MetaAdsSummary;
