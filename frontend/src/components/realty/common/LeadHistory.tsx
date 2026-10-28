import React, { useEffect, useState } from 'react';
import Table from 'react-bootstrap/Table';
import { fetchHistory, HistoryRow } from './leadUtiles';

// ==========================================
// 💡 変更履歴パネル
//    サーバーに永続化された監査ログ（kind:'logs'）を表示する。
//    LeadEdit の「変更内容」は保存前の差分プレビューであり、こちらとは別物。
// ==========================================

/** '2026-08-26T11:00:00' → '08/26 11:00' */
const formatAt = (at: string | null): string => {
    if (!at) return '―';
    const d = new Date(at.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return at;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const orDash = (value: string | null): string =>
    value === null || value === undefined || value === '' ? '（未設定）' : value;

type Props = {
    /** brokerage_listings.id。未指定・変更時に再取得する。 */
    entityId?: string | null;
    /** パネルが実際に見えているときだけ取得したい場合に false を渡す */
    enabled?: boolean;
    maxHeight?: number;
};

const LeadHistory: React.FC<Props> = ({ entityId, enabled = true, maxHeight = 180 }) => {
    const [rows, setRows] = useState<HistoryRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled || !entityId) {
            setRows([]);
            return;
        }

        // 取得中に別の案件へ切り替わったとき、古い応答で上書きしないようにする
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const history = await fetchHistory(entityId, 100);
                if (!cancelled) setRows(history);
            } catch (e) {
                console.error('[LeadHistory] 履歴の取得に失敗しました', entityId, e);
                if (!cancelled) setError('履歴を取得できませんでした');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        load();

        return () => { cancelled = true; };
    }, [entityId, enabled]);

    if (!enabled) return null;

    return (
        <div className="mt-3 border-top pt-3">
            <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '12px' }}>
                <i className="bi bi-journal-text me-1"></i>変更履歴（保存済み）
                {rows.length > 0 && <span className="ms-2 badge bg-secondary rounded-pill">{rows.length}</span>}
            </h6>

            {isLoading && <div className="text-muted" style={{ fontSize: '10px' }}>読み込み中…</div>}
            {error && <div className="text-danger" style={{ fontSize: '10px' }}>{error}</div>}

            {!isLoading && !error && rows.length === 0 && (
                <div className="text-muted" style={{ fontSize: '10px' }}>まだ変更履歴はありません</div>
            )}

            {rows.length > 0 && (
                <div className="bg-light rounded border" style={{ maxHeight: `${maxHeight}px`, overflowY: 'auto' }}>
                    <Table size="sm" className="mb-0 align-middle" style={{ fontSize: '10px' }}>
                        <thead className="bg-light" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                            <tr>
                                <th className="text-muted border-bottom-0 py-1">日時</th>
                                <th className="text-muted border-bottom-0 py-1">実施者</th>
                                <th className="text-muted border-bottom-0 py-1">項目</th>
                                <th className="text-muted border-bottom-0 py-1">変更前</th>
                                <th className="text-muted border-bottom-0 py-1">変更後</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (
                                <tr key={row.id}>
                                    <td className="py-1 text-muted" style={{ whiteSpace: 'nowrap' }}>{formatAt(row.at)}</td>
                                    <td className="py-1 text-muted" style={{ whiteSpace: 'nowrap' }}>{row.by || '―'}</td>
                                    <td className="py-1 fw-bold text-dark" style={{ whiteSpace: 'nowrap' }}>{row.field}</td>
                                    <td className="py-1 text-muted">{orDash(row.from)}</td>
                                    <td className="py-1 text-primary fw-bold">{orDash(row.to)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default LeadHistory;
