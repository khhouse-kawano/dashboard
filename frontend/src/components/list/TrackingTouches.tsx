import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';

/**
 * 反響1件の流入履歴（v2.2.199 新規）。反響一覧（注文）の「反響媒体」の欄の「流入」から開く（ListOrder.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ ② の tracking_touches（features/tracking/touches.ts）。反響の landing_params を読んで着地の記録を探す。
 *   1. 顧客ID（khg_vid）が一致する着地  2. 無ければ gclid などのクリックIDが一致する着地
 * ⚠️ 顧客ID（khg_vid）は tracker.js が訪問者全員に振る（2026-10-20 の追加指示。MA で使う）。⚠️ サイト（ドメイン）ごとの ID。
 * ⚠️ 流入元・キャンペーンは反響に保存されていないので、landing_params から読み取って出す。
 * ─────────────────────────────────────────────
 */

/** 反響一覧の札に出す流入元。⚠️ 決め方はフォーム・tracker.js と同じ順。広告の情報が無く ID だけなら「ID」 */
export const landingLabel = (landingParams: string | null | undefined): string => {
    if (!landingParams) return '';
    let p: URLSearchParams;
    try { p = new URLSearchParams(landingParams); } catch { return ''; }
    if (p.get('utm_source')) return p.get('utm_source') ?? '';
    if (p.get('fbclid')) return 'Facebook/Instagram';
    if (p.get('gclid') || p.get('wbraid') || p.get('gbraid')) return 'Google';
    if (p.get('yclid')) return 'Yahoo';
    if (p.get('flyer')) return 'Flyer';
    return p.get('khg_vid') ? 'ID' : '';
};

/** パラメータの見出し */
const PARAM_LABEL: Record<string, string> = {
    gclid: 'gclid（Google広告）', gbraid: 'gbraid（Google広告）', wbraid: 'wbraid（Google広告）', fbclid: 'fbclid（Meta広告）', yclid: 'yclid（Yahoo!広告）',
    gad_source: 'gad_source', gad_campaignid: 'gad_campaignid（Google広告のキャンペーン）',
    utm_source: 'utm_source（流入元）', utm_medium: 'utm_medium（媒体）', utm_campaign: 'utm_campaign（キャンペーン）', utm_term: 'utm_term（キーワード）', utm_content: 'utm_content（広告）',
    flyer: 'flyer（チラシ）',
};

interface Touch {
    id: number;
    createdAt: string;
    site: string;
    source: string;
    params: Record<string, string>;
    landingUrl: string;
    referrer: string;
}

interface Result {
    found: boolean;
    landing: Record<string, string>;
    visitorId: string;
    source: string;
    campaign: string;
    matchedBy: 'khg_vid' | 'click_id' | null;
    touches: Touch[];
    limit: number;
}

interface Props {
    inquiryId: string | null;
    customerName: string;
    onClose: () => void;
}

const TrackingTouches: React.FC<Props> = ({ inquiryId, customerName, onClose }) => {
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (inquiryId === null) return;
        let cancelled = false;
        setResult(null);
        setError('');
        setCopied(false);
        (async () => {
            try {
                const response = await apiClient.post('', { request: 'tracking_touches', inquiry_id: inquiryId });
                if (!cancelled) setResult(response.data as Result);
            } catch (e) {
                console.error('tracking_touches failed:', e);
                if (!cancelled) setError('流入履歴を読み込めませんでした。');
            }
        })();
        return () => { cancelled = true; };
    }, [inquiryId]);

    const copyId = async () => {
        if (!result?.visitorId) return;
        try {
            await navigator.clipboard.writeText(result.visitorId);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    const landingKeys = result ? Object.keys(result.landing) : [];

    return (
        <Modal show={inquiryId !== null} onHide={onClose} size="lg" scrollable>
            <style>{CSS}</style>
            <Modal.Header closeButton>
                <Modal.Title style={{ fontSize: '15px' }}>流入履歴{customerName ? `（${customerName}）` : ''}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="tt_body">
                {error !== '' && <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>}
                {result === null && error === '' && <div className="tt_empty">読み込み中…</div>}
                {result !== null && (
                    <>
                        <div className="tt_cards">
                            <div className="tt_card">
                                <div className="tt_label">顧客ID</div>
                                {result.visitorId ? (
                                    <div className="tt_id_row">
                                        <code className="tt_id">{result.visitorId}</code>
                                        <button type="button" className="tt_btn" onClick={copyId}>{copied ? 'コピーしました' : 'コピー'}</button>
                                    </div>
                                ) : <div className="tt_none">なし（タグを貼る前の反響、またはタグの無いページからの送信）</div>}
                            </div>
                            <div className="tt_card">
                                <div className="tt_label">流入元</div>
                                <div className="tt_value">{result.source || '—'}</div>
                            </div>
                            <div className="tt_card">
                                <div className="tt_label">キャンペーン（utm_campaign）</div>
                                <div className="tt_value">{result.campaign || '—'}</div>
                            </div>
                        </div>

                        {landingKeys.length > 0 && (
                            <>
                                <div className="tt_section">反響と一緒に届いた広告の情報</div>
                                <dl className="tt_params">
                                    {landingKeys.map((k) => (
                                        <React.Fragment key={k}>
                                            <dt>{PARAM_LABEL[k] ?? k}</dt><dd>{result.landing[k]}</dd>
                                        </React.Fragment>
                                    ))}
                                </dl>
                            </>
                        )}

                        <div className="tt_section">
                            広告からの着地（新しい順）
                            {result.matchedBy === 'khg_vid' && <span className="tt_how">顧客IDで結びつけました（同じブラウザの着地）</span>}
                            {result.matchedBy === 'click_id' && <span className="tt_how is_warn">顧客IDが無いため、クリックID（gclid など）で結びつけました</span>}
                        </div>
                        {result.touches.length === 0 ? (
                            <div className="tt_empty">
                                {result.matchedBy === null ? '結びつける情報がありません。' : '広告からの着地の記録はありません（自然検索・直接の訪問など）。'}
                            </div>
                        ) : (
                            <div className="tt_table_wrap">
                                <table className="tt_table">
                                    <thead>
                                        <tr><th>日時</th><th>サイト</th><th>流入元</th><th>キャンペーン</th><th>着地したページ</th></tr>
                                    </thead>
                                    <tbody>
                                        {result.touches.map((t) => (
                                            <tr key={t.id}>
                                                <td className="tt_date">{t.createdAt}</td>
                                                <td>{t.site}</td>
                                                <td>{t.source}{t.params.utm_medium ? <div className="tt_sub">{t.params.utm_medium}</div> : null}</td>
                                                <td>{t.params.utm_campaign ?? t.params.gad_campaignid ?? ''}</td>
                                                <td className="tt_url">{t.landingUrl}{t.referrer && <div className="tt_sub">参照元：{t.referrer}</div>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {result.touches.length >= result.limit && <div className="tt_sub">新しい {result.limit} 件だけを出しています。</div>}
                            </div>
                        )}
                    </>
                )}
            </Modal.Body>
        </Modal>
    );
};

/** ⚠️ GoogleReview.tsx と同じ配色（接頭辞 tt_） */
const CSS = `
.tt_body { font-size: 13px; color: #1f2937; }
.tt_cards { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.tt_card { flex: 1 1 180px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 12px; background: #fff; min-width: 0; }
.tt_card:first-child { flex-basis: 100%; }
.tt_label { font-size: 11px; font-weight: 700; color: #6b7280; }
.tt_value { font-size: 15px; font-weight: 700; word-break: break-all; }
.tt_id_row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tt_id { font-family: ui-monospace, Consolas, monospace; font-size: 13px; color: #1f2937; background: #f3f4f6; border-radius: 6px; padding: 2px 8px; }
.tt_none { font-size: 12px; color: #9ca3af; }
.tt_btn { border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; padding: 3px 10px; font-size: 11px; font-weight: 700; cursor: pointer; color: #374151; }
.tt_btn:hover { background: #f8fafc; }
.tt_section { font-size: 12px; font-weight: 700; margin: 14px 0 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tt_how { font-size: 10px; font-weight: 700; color: #047857; background: #ecfdf5; border-radius: 999px; padding: 1px 8px; }
.tt_how.is_warn { color: #92400e; background: #fffbeb; }
.tt_params { display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; margin: 0; font-size: 12px; }
.tt_params dt { color: #6b7280; font-weight: 400; }
.tt_params dd { margin: 0; word-break: break-all; font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
.tt_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; }
.tt_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.tt_table th { position: sticky; top: 0; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 7px 10px; font-size: 11px; color: #4b5563; white-space: nowrap; }
.tt_table td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: top; }
.tt_date { white-space: nowrap; font-variant-numeric: tabular-nums; }
.tt_url { word-break: break-all; }
.tt_sub { font-size: 11px; color: #6b7280; }
.tt_empty { color: #9ca3af; font-size: 12px; padding: 8px 0; }
`;

export default TrackingTouches;
