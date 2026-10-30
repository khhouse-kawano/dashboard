import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from 'react-bootstrap';
import apiClient from '../../utils/apiClient';

/**
 * 業者別の歩留まり（v2.2.232 新規）。アクセス解析のサマリー → 流入元 → 業者別 → 社名を押すと開く（size="lg"）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 開いたときに ② の tracking_vendor_funnel を取りに行く（features/tracking/vendorFunnel.ts）。
 * ⚠️ 数えるのは、顧客台帳（注文・建売）の顧客のうち、問い合わせの日までにそのサイトへその業者の広告から一度でも来ていた人。
 *   ⚠️ サマリーの CV（最後の訪問で数える）とは数え方が違うので、件数は一致しない（注意書きに出す）。
 * ⚠️ 1行目はブランド（サイト）の総計。⚠️ 並べ替えは店舗の行だけ（総計は先頭のまま）。
 * ⚠️ KPI単価は、広告費を入力できるようになってから総計の行にだけ付ける（2026-10-30 の指示）。
 * ⚠️ アクセス解析（全画面モーダル）の上に重ねるので、幕を z-index 1055 に上げる（TrackingDetail.tsx と同じ）。
 * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 tv_）。
 * ─────────────────────────────────────────────
 */

interface FunnelRow {
    shop: string;
    inquiry: number;
    meeting: number;
    next: number;
    contract: number;
}

interface FunnelData {
    total: FunnelRow;
    rows: FunnelRow[];
}

type SortKey = keyof FunnelRow;

const COLUMNS: { key: Exclude<SortKey, 'shop'>; label: string }[] = [
    { key: 'inquiry', label: '総反響' },
    { key: 'meeting', label: '来場数' },
    { key: 'next', label: '次アポ数' },
    { key: 'contract', label: '契約数' },
];

const pct = (a: number, b: number): string => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : '—');

/** 業者（② の vendors.ts。サマリーの vendors の1行） */
interface Vendor {
    key: string;
    suffix: string;
    name: string;
}

const TrackingVendorFunnel: React.FC<{ siteId: number; siteName: string; vendor: Vendor; onClose: () => void }> = ({ siteId, siteName, vendor, onClose }) => {
    const [data, setData] = useState<FunnelData | null>(null);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('inquiry');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        let alive = true;
        setData(null);
        setError('');
        apiClient.post('', { request: 'tracking_vendor_funnel', site_id: siteId, vendor: vendor.key })
            .then((response) => { if (alive) setData(response.data as FunnelData); })
            .catch((e) => {
                console.error('tracking_vendor_funnel failed:', e);
                if (alive) setError('歩留まりを読み込めませんでした。閉じて開き直してください。');
            });
        return () => { alive = false; };
    }, [siteId, vendor.key]);

    const rows = useMemo(() => {
        const dir = sortOrder === 'asc' ? 1 : -1;
        return [...(data?.rows ?? [])].sort((a, b) => (sortKey === 'shop' ? a.shop.localeCompare(b.shop, 'ja') : a[sortKey] - b[sortKey]) * dir);
    }, [data, sortKey, sortOrder]);

    const SortHead = ({ label, k, num = true }: { label: string; k: SortKey; num?: boolean }) => {
        const active = sortKey === k;
        return (
            <th className={`tv_th tv_sort${num ? ' tv_num' : ''}`} title="クリックで並べ替え"
                onClick={() => {
                    if (active) setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(k); setSortOrder('desc'); }
                }}>
                {label}<span className={`tv_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const Cells = ({ row }: { row: FunnelRow }) => (
        <>
            {COLUMNS.map(({ key }) => (
                <td key={key} className="tv_td tv_num">
                    {row[key].toLocaleString()}
                    {key !== 'inquiry' && <span className="tv_rate">{pct(row[key], row.inquiry)}</span>}
                </td>
            ))}
        </>
    );

    return (
        <Modal show onHide={onClose} size="lg" centered scrollable backdropClassName="tv_backdrop" contentClassName="tv_content">
            <style>{CSS}</style>
            <Modal.Header closeButton className="bg-light py-2">
                <Modal.Title className="tv_title">
                    <span className="tv_axis">業者別の歩留まり</span>
                    {vendor.name}
                    <span className="tv_sub">{siteName}</span>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="tv_body">
                {error !== '' && <div className="tv_error">{error}</div>}
                {data === null && error === '' && <div className="tv_sub">読み込み中…</div>}
                {data !== null && (
                    <>
                        <div className="tv_kpi">
                            <div className="tv_card"><div className="tv_label">総反響</div><div className="tv_value">{data.total.inquiry.toLocaleString()}</div></div>
                            <div className="tv_card"><div className="tv_label">来場率</div><div className="tv_value">{pct(data.total.meeting, data.total.inquiry)}</div></div>
                            <div className="tv_card"><div className="tv_label">次アポ率</div><div className="tv_value">{pct(data.total.next, data.total.inquiry)}</div></div>
                            <div className="tv_card"><div className="tv_label">契約率</div><div className="tv_value">{pct(data.total.contract, data.total.inquiry)}</div></div>
                        </div>
                        <div className="tv_table_wrap">
                            <table className="tv_table">
                                <thead>
                                    <tr>
                                        <SortHead label="店舗名" k="shop" num={false} />
                                        {COLUMNS.map((c) => <SortHead key={c.key} label={c.label} k={c.key} />)}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="tv_total">
                                        <td className="tv_td">ブランド総計</td>
                                        <Cells row={data.total} />
                                    </tr>
                                    {rows.length === 0 ? (
                                        <tr><td className="tv_td tv_empty" colSpan={5}>{vendor.name} の広告から来た反響はまだありません。</td></tr>
                                    ) : rows.map((r) => (
                                        <tr key={r.shop}>
                                            <td className="tv_td">{r.shop}</td>
                                            <Cells row={r} />
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="tv_note">
                            ※ 問い合わせの日までに、このサイトへ {vendor.name} の広告（キャンペーン名の末尾が {vendor.suffix}）から一度でも来ていた反響を数えます（記録を始めた 2026-10-20 以降）。
                            サマリーの CV は最後の訪問で数えるため、件数は一致しません。<br />
                            ※ 来場＝初回面談以降の日付あり、次アポ＝事前審査・第二面談・契約の日付あり、契約＝契約済み。重複は数えません。率は総反響に対する割合です。
                        </div>
                    </>
                )}
            </Modal.Body>
        </Modal>
    );
};

/** ⚠️ GoogleReview.tsx・TrackingDetail.tsx と同じ配色・余白・角丸（接頭辞 tv_） */
const CSS = `
.tv_backdrop.modal-backdrop { z-index: 1055; }
.tv_backdrop.modal-backdrop.show { opacity: .55; }
.tv_content.modal-content { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; box-shadow: 0 24px 64px rgba(15,23,42,.45), 0 2px 8px rgba(15,23,42,.2); }
.tv_title { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tv_axis { font-size: 10px; font-weight: 700; color: #1d4ed8; background: #eff6ff; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.tv_sub { font-size: 11px; color: #6b7280; font-weight: 400; }
.tv_body { font-size: 12px; color: #1f2937; display: flex; flex-direction: column; gap: 12px; }
.tv_error { font-size: 12px; color: #b91c1c; font-weight: 700; }
.tv_note { font-size: 11px; color: #92400e; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 6px 10px; line-height: 1.6; }
.tv_kpi { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
.tv_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 10px; }
.tv_label { font-size: 11px; color: #6b7280; }
.tv_value { font-size: 17px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.tv_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; max-height: 420px; }
.tv_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.tv_th { position: sticky; top: 0; z-index: 1; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 7px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
.tv_sort { cursor: pointer; user-select: none; }
.tv_sort:hover { background: #eef2f7; }
.tv_sort_icon { margin-left: 4px; font-size: 10px; color: #cbd5e1; }
.tv_sort_icon.is_active { color: #2563eb; }
.tv_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; }
.tv_num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tv_rate { margin-left: 6px; font-size: 10px; color: #6b7280; }
.tv_total > .tv_td { background: #eff6ff; font-weight: 700; }
.tv_empty { color: #9ca3af; text-align: center; padding: 16px; }
`;

export default TrackingVendorFunnel;
