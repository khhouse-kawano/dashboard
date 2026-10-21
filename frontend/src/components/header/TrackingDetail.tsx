import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from 'react-bootstrap';
import apiClient from '../../utils/apiClient';

/**
 * アクセス解析の詳細（v2.2.203 新規）。TrackingSettings.tsx のサマリーで、着地ページ・流入元を押すと開く（size="lg"）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 開いたときに ② の tracking_detail を取りに行く（features/tracking/detail.ts）。期間は直近30日。
 * ⚠️ PV は訪問（30分以内の移動はまとめて1件）。⚠️ 着地ページでは、ページの閲覧の記録（v2.2.203〜）から閲覧回数と前後のページも出す。
 * ⚠️ Meta 広告の数字は ② が取り込んだもの（features/metaAds/）。⚠️ Meta のクリックとこちらの着地は一致しない。
 * ⚠️ 広告の画像の URL は数日で期限が切れる（② が取り込むたびに新しくする）。読めないときは隠す（場所は空けておく）。
 * ⚠️ CV の一覧は個人情報を出さない（日付・反響媒体・キャンペーン・店舗だけ）。
 * ⚠️ アクセス解析（全画面モーダル）の上に重ねるので、後ろを暗くする幕を z-index 1055 に上げる（AmbassadorList.tsx の歩留まりと同じ）。
 * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 td_）。
 * ─────────────────────────────────────────────
 */

export type DetailAxis = 'landing' | 'source';

interface Bucket { key: string; visits: number; ad: number; cv: number }
interface AdRow {
    adId: string; name: string; campaign: string; adset: string; status: string; thumbnail: string; meta: boolean;
    impressions: number; clicks: number; spend: number; landings: number; cv: number;
}
interface CvRow { day: string; medium: string; campaign: string; shop: string; source: string; landingUrl: string; adId: string }
interface Flow { url: string; views: number }

interface Detail {
    days: number;
    truncated: boolean;
    kpi: { visits: number; ad: number; visitors: number; repeaters: number; cv: number };
    daily: { day: string; visits: number; cv: number }[];
    hours: { hour: number; visits: number }[];
    breakdown: Bucket[];
    devices: Bucket[];
    ads: AdRow[];
    cvList: CvRow[];
    pageFlow: { views: number; visitors: number; next: Flow[]; prev: Flow[] } | null;
    meta: { configured: boolean; ready: boolean; isMetaSource: boolean };
}

const yen = (n: number): string => `${Math.round(n).toLocaleString()}円`;
const pct = (a: number, b: number): string => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');
const readable = (url: string): string => {
    if (url === '') return '（不明）';
    try { return decodeURI(url.replace(/^https?:\/\//, '')); } catch { return url.replace(/^https?:\/\//, ''); }
};

type AdSortKey = 'spend' | 'impressions' | 'clicks' | 'landings' | 'cv' | 'cpa';

const TrackingDetail: React.FC<{ siteId: number; axis: DetailAxis; value: string; onClose: () => void }> = ({ siteId, axis, value, onClose }) => {
    const [data, setData] = useState<Detail | null>(null);
    const [error, setError] = useState('');
    const [adSort, setAdSort] = useState<AdSortKey>('spend');

    useEffect(() => {
        let alive = true;
        setData(null);
        setError('');
        apiClient.post('', { request: 'tracking_detail', site_id: siteId, axis, key: value })
            .then((response) => { if (alive) setData(response.data as Detail); })
            .catch((e) => {
                console.error('tracking_detail failed:', e);
                if (alive) setError('詳細を読み込めませんでした。閉じて開き直してください。');
            });
        return () => { alive = false; };
    }, [siteId, axis, value]);

    const ads = useMemo(() => {
        const list = [...(data?.ads ?? [])];
        const cpa = (a: AdRow): number => (a.cv > 0 ? a.spend / a.cv : Number.POSITIVE_INFINITY);
        return list.sort((a, b) => (adSort === 'cpa' ? cpa(a) - cpa(b) : b[adSort] - a[adSort]));
    }, [data, adSort]);

    const maxDaily = Math.max(1, ...(data?.daily ?? []).map((d) => d.visits));
    const maxHour = Math.max(1, ...(data?.hours ?? []).map((h) => h.visits));
    const showMeta = data !== null && (data.meta.isMetaSource || data.ads.some((a) => a.meta));
    const metaTotal = ads.filter((a) => a.meta).reduce((t, a) => ({ spend: t.spend + a.spend, imp: t.imp + a.impressions, clicks: t.clicks + a.clicks, cv: t.cv + a.cv }), { spend: 0, imp: 0, clicks: 0, cv: 0 });

    const AdHead = ({ label, k }: { label: string; k: AdSortKey }) => (
        <th className="td_th td_num td_sort" onClick={() => setAdSort(k)} title="クリックで並べ替え">
            {label}<span className={`td_sort_icon${adSort === k ? ' is_active' : ''}`}>{adSort === k ? (k === 'cpa' ? '▲' : '▼') : '⇅'}</span>
        </th>
    );

    return (
        <Modal show onHide={onClose} size="lg" centered scrollable backdropClassName="td_backdrop" contentClassName="td_content">
            <style>{CSS}</style>
            <Modal.Header closeButton className="bg-light py-2">
                <Modal.Title className="td_title">
                    <span className="td_axis">{axis === 'landing' ? '着地ページ' : '流入元'}</span>
                    {axis === 'landing' ? readable(value) : value || '（不明）'}
                    <span className="td_sub">直近{data?.days ?? 30}日</span>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="td_body">
                {error !== '' && <div className="td_error">{error}</div>}
                {data === null && error === '' && <div className="td_sub">読み込み中…</div>}
                {data !== null && (
                    <>
                        <div className="td_kpi">
                            <div className="td_card"><div className="td_label">PV（訪問）</div><div className="td_value">{data.kpi.visits.toLocaleString()}</div></div>
                            {data.pageFlow && <div className="td_card"><div className="td_label">閲覧回数</div><div className="td_value">{data.pageFlow.views.toLocaleString()}</div></div>}
                            <div className="td_card"><div className="td_label">うち広告から</div><div className="td_value">{data.kpi.ad.toLocaleString()}</div></div>
                            <div className="td_card"><div className="td_label">訪問者</div><div className="td_value">{data.kpi.visitors.toLocaleString()}<span className="td_unit">人</span></div></div>
                            <div className="td_card"><div className="td_label">2回以上来た人</div><div className="td_value">{data.kpi.repeaters.toLocaleString()}<span className="td_unit">人</span></div></div>
                            <div className="td_card"><div className="td_label">CV ／ CV率</div><div className="td_value">{data.kpi.cv.toLocaleString()}<span className="td_unit"> ／ {pct(data.kpi.cv, data.kpi.visits)}</span></div></div>
                        </div>
                        {data.truncated && <div className="td_note">※ 件数が多いため、先頭の5万件で集計しています。</div>}

                        <section className="td_section">
                            <h6 className="td_h">日別の PV と CV</h6>
                            <div className="td_chart" role="img" aria-label="日別の PV と CV">
                                {data.daily.map((d) => (
                                    <div key={d.day} className="td_bar_col" title={`${d.day}　PV ${d.visits}・CV ${d.cv}`}>
                                        <div className="td_bar" style={{ height: `${(d.visits / maxDaily) * 100}%` }} />
                                        {d.cv > 0 && <div className="td_cv_dot">{d.cv}</div>}
                                    </div>
                                ))}
                            </div>
                            <div className="td_axis_row"><span>{data.daily[0]?.day.slice(5)}</span><span>{data.daily[data.daily.length - 1]?.day.slice(5)}</span></div>
                        </section>

                        {data.pageFlow && (
                            <section className="td_section">
                                <h6 className="td_h">ページの前後（閲覧の記録から）</h6>
                                {data.pageFlow.views === 0 ? (
                                    <div className="td_sub">まだ閲覧の記録がありません（記録は v2.2.203 から始まりました）。</div>
                                ) : (
                                    <div className="td_two">
                                        <FlowTable title="前に見ていたページ" rows={data.pageFlow.prev} emptyLabel="（訪問の最初のページ）" />
                                        <FlowTable title="次に見たページ" rows={data.pageFlow.next} emptyLabel="（不明）" />
                                    </div>
                                )}
                            </section>
                        )}

                        <section className="td_section">
                            <h6 className="td_h">{axis === 'landing' ? '流入元別' : '着地ページ別'}</h6>
                            <BucketTable rows={data.breakdown} label={axis === 'landing' ? '流入元' : '着地ページ'} url={axis === 'source'} />
                        </section>

                        {(showMeta || ads.length > 0) && (
                            <section className="td_section">
                                <h6 className="td_h">{showMeta ? 'Meta 広告' : '広告別（utm_content）'}</h6>
                                {showMeta && !data.meta.configured && <div className="td_note">※ Meta 広告のトークンが設定されていないため、表示回数・費用はありません。</div>}
                                {showMeta && data.meta.configured && !data.meta.ready && <div className="td_note">※ Meta 広告の表がまだありません（データベースの準備が必要です）。</div>}
                                {showMeta && metaTotal.spend > 0 && (
                                    <div className="td_meta_sum">
                                        費用 <b>{yen(metaTotal.spend)}</b>・表示 <b>{metaTotal.imp.toLocaleString()}</b>・クリック <b>{metaTotal.clicks.toLocaleString()}</b>（CTR {pct(metaTotal.clicks, metaTotal.imp)}）・CV <b>{metaTotal.cv}</b>・CPA <b>{metaTotal.cv > 0 ? yen(metaTotal.spend / metaTotal.cv) : '—'}</b>
                                    </div>
                                )}
                                <div className="td_table_wrap">
                                    <table className="td_table">
                                        <thead>
                                            <tr>
                                                <th className="td_th">広告</th>
                                                <AdHead label="費用" k="spend" />
                                                <AdHead label="表示" k="impressions" />
                                                <AdHead label="クリック" k="clicks" />
                                                <th className="td_th td_num">CTR</th>
                                                <AdHead label="着地" k="landings" />
                                                <AdHead label="CV" k="cv" />
                                                <AdHead label="CPA" k="cpa" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ads.length === 0 ? (
                                                <tr><td className="td_td td_empty" colSpan={8}>直近30日に費用・表示・着地のある広告はありません。</td></tr>
                                            ) : ads.map((a) => (
                                                <tr key={a.adId}>
                                                    <td className="td_td">
                                                        <div className="td_ad">
                                                            {a.thumbnail ? <img className="td_thumb" src={a.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"
                                                                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} /> : <div className="td_thumb td_thumb_none" />}
                                                            <div>
                                                                <div className="td_ad_name">{a.name || a.adId}</div>
                                                                <div className="td_sub">{a.campaign}{a.adset && ` ／ ${a.adset}`}{a.status && a.status !== 'ACTIVE' && <span className="td_status">{a.status === 'PAUSED' ? '停止中' : a.status}</span>}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="td_td td_num">{a.meta ? yen(a.spend) : '—'}</td>
                                                    <td className="td_td td_num">{a.meta ? a.impressions.toLocaleString() : '—'}</td>
                                                    <td className="td_td td_num">{a.meta ? a.clicks.toLocaleString() : '—'}</td>
                                                    <td className="td_td td_num">{a.meta ? pct(a.clicks, a.impressions) : '—'}</td>
                                                    <td className="td_td td_num">{a.landings.toLocaleString()}</td>
                                                    <td className="td_td td_num">{a.cv > 0 ? <b>{a.cv}</b> : 0}</td>
                                                    <td className="td_td td_num">{a.meta && a.cv > 0 ? yen(a.spend / a.cv) : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="td_note">※ 費用・表示・クリックは Meta の数字、着地・CV はサイトの記録です。広告ブロッカーや表示前の離脱があるため、クリックと着地は一致しません。</div>
                            </section>
                        )}

                        <div className="td_two">
                            <section className="td_section">
                                <h6 className="td_h">端末</h6>
                                <BucketTable rows={data.devices} label="端末" url={false} noCv />
                            </section>
                            <section className="td_section">
                                <h6 className="td_h">時間帯（PV）</h6>
                                <div className="td_hours">
                                    {data.hours.map((h) => (
                                        <div key={h.hour} className="td_hour" title={`${h.hour}時台　${h.visits}`}>
                                            <div className="td_hour_bar" style={{ height: `${(h.visits / maxHour) * 100}%` }} />
                                            <div className="td_hour_label">{h.hour % 3 === 0 ? h.hour : ''}</div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        <section className="td_section">
                            <h6 className="td_h">CV になった反響（{data.cvList.length}件）</h6>
                            {data.cvList.length === 0 ? <div className="td_sub">直近30日の CV はありません。</div> : (
                                <div className="td_table_wrap">
                                    <table className="td_table">
                                        <thead><tr><th className="td_th">反響の日</th><th className="td_th">反響媒体</th><th className="td_th">キャンペーン</th><th className="td_th">店舗</th><th className="td_th">{axis === 'landing' ? '流入元' : '着地ページ'}</th></tr></thead>
                                        <tbody>
                                            {data.cvList.map((c, i) => (
                                                <tr key={`${c.day}-${i}`}>
                                                    <td className="td_td td_date">{c.day}</td>
                                                    <td className="td_td">{c.medium || '—'}</td>
                                                    <td className="td_td">{c.campaign || '—'}</td>
                                                    <td className="td_td">{c.shop || '—'}</td>
                                                    <td className="td_td td_url">{axis === 'landing' ? c.source || '（不明）' : readable(c.landingUrl)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                        <div className="td_note">※ PV は1回の訪問（30分以内のページの移動はまとめて1件）を1件と数えます。閲覧回数は、ページが開かれた回数です。CV は、問い合わせの日までの最後の訪問で数えます。</div>
                    </>
                )}
            </Modal.Body>
        </Modal>
    );
};

const BucketTable: React.FC<{ rows: Bucket[]; label: string; url: boolean; noCv?: boolean }> = ({ rows, label, url, noCv = false }) => (
    <div className="td_table_wrap">
        <table className="td_table">
            <thead>
                <tr>
                    <th className="td_th">{label}</th>
                    <th className="td_th td_num">PV</th>
                    <th className="td_th td_num">うち広告</th>
                    {!noCv && <th className="td_th td_num">CV</th>}
                    {!noCv && <th className="td_th td_num">CV率</th>}
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr><td className="td_td td_empty" colSpan={noCv ? 3 : 5}>記録がありません。</td></tr>
                ) : rows.map((r) => (
                    <tr key={r.key}>
                        <td className="td_td td_url" title={r.key}>
                            {url && /^https?:\/\//.test(r.key)
                                ? <a className="td_link" href={r.key} target="_blank" rel="noopener noreferrer">{readable(r.key)}</a>
                                : url ? readable(r.key) : r.key || '（不明）'}
                        </td>
                        <td className="td_td td_num">{r.visits.toLocaleString()}</td>
                        <td className="td_td td_num">{r.ad.toLocaleString()}</td>
                        {!noCv && <td className="td_td td_num">{r.cv > 0 ? <b>{r.cv}</b> : 0}</td>}
                        {!noCv && <td className="td_td td_num">{pct(r.cv, r.visits)}</td>}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const FlowTable: React.FC<{ title: string; rows: Flow[]; emptyLabel: string }> = ({ title, rows, emptyLabel }) => (
    <div className="td_table_wrap">
        <table className="td_table">
            <thead><tr><th className="td_th">{title}</th><th className="td_th td_num">回数</th></tr></thead>
            <tbody>
                {rows.length === 0 ? (
                    <tr><td className="td_td td_empty" colSpan={2}>記録がありません。</td></tr>
                ) : rows.map((r) => (
                    <tr key={r.url || '-'}>
                        <td className="td_td td_url" title={r.url}>{r.url === '' ? emptyLabel : readable(r.url)}</td>
                        <td className="td_td td_num">{r.views.toLocaleString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

/** ⚠️ GoogleReview.tsx と同じ配色・余白・角丸（接頭辞 td_） */
const CSS = `
.td_backdrop.modal-backdrop { z-index: 1055; }
.td_backdrop.modal-backdrop.show { opacity: .55; }
.td_content.modal-content { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 24px 64px rgba(15,23,42,.45), 0 2px 8px rgba(15,23,42,.2); }
.td_title { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; word-break: break-all; }
.td_axis { font-size: 10px; font-weight: 700; color: #1d4ed8; background: #eff6ff; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.td_sub { font-size: 11px; color: #6b7280; font-weight: 400; }
.td_body { font-size: 12px; color: #1f2937; display: flex; flex-direction: column; gap: 14px; }
.td_error { font-size: 12px; color: #b91c1c; font-weight: 700; }
.td_note { font-size: 11px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 10px; }
.td_kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
.td_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 10px; }
.td_label { font-size: 11px; color: #6b7280; }
.td_value { font-size: 17px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.td_unit { font-size: 11px; font-weight: 400; color: #6b7280; }
.td_section { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.td_h { font-size: 12px; font-weight: 700; color: #374151; margin: 0; }
.td_two { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
.td_chart { display: flex; align-items: flex-end; gap: 2px; height: 90px; padding: 6px 4px 0; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; }
.td_bar_col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: relative; min-width: 0; }
.td_bar { width: 100%; background: #93c5fd; border-radius: 3px 3px 0 0; min-height: 1px; }
.td_cv_dot { position: absolute; top: 0; font-size: 9px; font-weight: 700; color: #fff; background: #f97316; border-radius: 999px; min-width: 14px; height: 14px; line-height: 14px; text-align: center; padding: 0 3px; }
.td_axis_row { display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
.td_hours { display: flex; align-items: flex-end; gap: 2px; height: 90px; padding: 6px 4px 0; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; }
.td_hour { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; min-width: 0; }
.td_hour_bar { width: 100%; background: #a5b4fc; border-radius: 3px 3px 0 0; min-height: 1px; }
.td_hour_label { font-size: 9px; color: #9ca3af; height: 12px; }
.td_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; max-height: 280px; }
.td_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.td_th { position: sticky; top: 0; z-index: 1; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 7px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
.td_sort { cursor: pointer; user-select: none; }
.td_sort:hover { background: #eef2f7; }
.td_sort_icon { margin-left: 4px; font-size: 10px; color: #cbd5e1; }
.td_sort_icon.is_active { color: #2563eb; }
.td_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; }
.td_num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.td_date { white-space: nowrap; font-variant-numeric: tabular-nums; }
.td_url { word-break: break-all; }
.td_link { color: #1d4ed8; text-decoration: none; }
.td_link:hover { text-decoration: underline; }
.td_empty { color: #9ca3af; text-align: center; padding: 16px; }
.td_ad { display: flex; gap: 8px; align-items: center; min-width: 200px; }
.td_thumb { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; background: #f3f4f6; border: 1px solid #e5e7eb; }
.td_ad_name { font-weight: 700; font-size: 12px; }
.td_status { margin-left: 6px; font-size: 10px; color: #6b7280; background: #f3f4f6; border-radius: 999px; padding: 1px 6px; }
.td_meta_sum { font-size: 12px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px; }
`;

export default TrackingDetail;
