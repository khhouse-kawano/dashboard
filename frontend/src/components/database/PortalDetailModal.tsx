import React from 'react';
import Modal from 'react-bootstrap/Modal';

/**
 * ポータルの掲載サマリ（SUUMO・HOME'S・at home の1物件分の掲載データ）。
 * ⚠️ v2.2.307 物件DB（DatabaseProperty.tsx）の中にあったモーダルをそのまま移した（媒介獲得台帳の「物件の状況」でも使う）。
 *   data は suumo_resale_summary / homes_summary_db / athome_summary_db の1行。
 */
export type PortalType = 'SUUMO' | "HOME'S" | 'athome';
export type PortalDetail = { type: PortalType; data: Record<string, string> };

// 💡 モーダル内の洗練されたデザイン用スタイル
const modalStyles = {
    card: { border: 'none', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', marginBottom: '16px', backgroundColor: '#fff' },
    cardHeader: { backgroundColor: '#fff', borderBottom: '1px solid #edf2f7', padding: '12px 16px', fontSize: '13px', fontWeight: 'bold', color: '#4a5568', borderRadius: '8px 8px 0 0' },
    table: { margin: 0, fontSize: '12px', borderCollapse: 'collapse' as const, width: '100%' },
    th: { backgroundColor: '#f8f9fa', color: '#718096', fontWeight: '500', width: '22%', padding: '10px 12px', borderBottom: '1px solid #edf2f7', verticalAlign: 'middle' },
    td: { color: '#2d3748', fontWeight: 'bold', padding: '10px 12px', borderBottom: '1px solid #edf2f7', verticalAlign: 'middle', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const }
};

type Props = { portal: PortalDetail | null; onClose: () => void };

const PortalDetailModal = ({ portal, onClose }: Props) => (
    <Modal show={!!portal} onHide={onClose} size="lg" centered>
            <Modal.Header closeButton className="border-0 pb-0">
                <Modal.Title style={{ color: '#495057', fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                    {portal?.type === 'SUUMO' && <i className="bi bi-phone me-2 text-success"></i>}
                    {portal?.type === "HOME'S" && <i className="bi bi-house me-2 text-danger"></i>}
                    {portal?.type === 'athome' && <i className="bi bi-geo-alt me-2 text-primary"></i>}
                    {portal?.type} 掲載サマリ
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-3 pb-4" style={{ backgroundColor: '#fafbfe' }}>

                {/* === SUUMO View === */}
                {portal?.type === 'SUUMO' && portal.data && (
                    <div className="row g-3">
                        <div className="col-12">
                            <div style={modalStyles.card}>
                                <div style={modalStyles.cardHeader}>概要・キャッチ</div>
                                <table style={modalStyles.table}>
                                    <tbody>
                                        <tr><th style={modalStyles.th}>基本情報</th><td style={modalStyles.td}>{portal.data.basic_info}</td></tr>
                                        <tr><th style={modalStyles.th}>立地・価格</th><td style={modalStyles.td}>{portal.data.location_and_price}</td></tr>
                                        <tr><th style={modalStyles.th}>サマリー</th><td style={modalStyles.td}>{portal.data.summary}</td></tr>
                                        <tr><th style={modalStyles.th}>キャッチ・PR</th><td style={modalStyles.td}>{portal.data.catch_and_layout}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div style={modalStyles.card}>
                                <div style={modalStyles.cardHeader}>ステータス・画像</div>
                                <table style={modalStyles.table}>
                                    <tbody>
                                        <tr><th style={modalStyles.th}>成約状況</th><td style={modalStyles.td}>{portal.data.contract_status}</td></tr>
                                        <tr><th style={modalStyles.th}>ネット掲載</th><td style={modalStyles.td}>{portal.data.suumo_net_status}</td></tr>
                                        <tr><th style={modalStyles.th}>総画像数</th><td style={modalStyles.td}>{portal.data.total_images} 枚</td></tr>
                                        <tr><th style={modalStyles.th}>更新日時</th><td style={modalStyles.td}>{portal.data.timestamps_info}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div style={modalStyles.card}>
                                <div style={modalStyles.cardHeader}>PV・反響</div>
                                <table style={modalStyles.table}>
                                    <tbody>
                                        <tr><th style={modalStyles.th}>累計 PV</th><td style={{ ...modalStyles.td, color: '#38a169', fontSize: '16px' }}>{portal.data.pv_total}</td></tr>
                                        <tr><th style={modalStyles.th}>直近1週 PV</th><td style={{ ...modalStyles.td, color: '#2b6cb0', fontSize: '14px' }}>{portal.data.pv_recent_week}</td></tr>
                                        <tr><th style={modalStyles.th}>オプション</th><td style={modalStyles.td}>{portal.data.suumo_net_options}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* === HOME'S View === */}
                {portal?.type === "HOME'S" && portal.data && (
                    <div className="row g-3">
                        <div className="col-12">
                            <div style={modalStyles.card}>
                                <div style={modalStyles.cardHeader}>物件情報</div>
                                <table style={modalStyles.table}>
                                    <tbody>
                                        <tr><th style={modalStyles.th}>物件名</th><td style={modalStyles.td}>{portal.data.property_name}</td></tr>
                                        <tr><th style={modalStyles.th}>住所</th><td style={modalStyles.td}>{portal.data.address}</td></tr>
                                        <tr><th style={modalStyles.th}>交通</th><td style={modalStyles.td}>{portal.data.railway_line} {portal.data.station} <span className="ms-2 text-muted">徒歩{portal.data.walk_minutes}分</span></td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div style={modalStyles.card}>
                                <div style={modalStyles.cardHeader}>価格・属性</div>
                                <table style={modalStyles.table}>
                                    <tbody>
                                        <tr><th style={modalStyles.th}>価格</th><td style={{ ...modalStyles.td, color: '#e53e3e' }}>{portal.data.price_rent}</td></tr>
                                        <tr><th style={modalStyles.th}>種別 / 築年</th><td style={modalStyles.td}>{portal.data.property_type} / {portal.data.construction_year}</td></tr>
                                        <tr><th style={modalStyles.th}>間取り</th><td style={modalStyles.td}>{portal.data.layout || '-'} <span className="ms-2 text-muted">{portal.data.exclusive_area || ''}</span></td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div style={modalStyles.card}>
                                <div style={modalStyles.cardHeader}>掲載・反響</div>
                                <table style={modalStyles.table}>
                                    <tbody>
                                        <tr><th style={modalStyles.th}>ステータス</th><td style={modalStyles.td}>{portal.data.status}</td></tr>
                                        <tr><th style={modalStyles.th}>閲覧数 (PV)</th><td style={{ ...modalStyles.td, color: '#c53030', fontSize: '16px' }}>{portal.data.detail_page_views}</td></tr>
                                        <tr><th style={modalStyles.th}>問合せ数</th><td style={modalStyles.td}>{portal.data.inquiries_count} 件 <span className="text-muted ms-2">(率: {portal.data.inquiry_rate})</span></td></tr>
                                        <tr><th style={modalStyles.th}>掲載 / 更新</th><td style={{ ...modalStyles.td, fontSize: '11px' }}>{portal.data.created_date} / {portal.data.updated_date}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* === athome View === */}
                {portal?.type === 'athome' && portal.data && (
                    <div className="row g-3">
                        <div className="col-12">
                            <div style={modalStyles.card}>
                                <div style={modalStyles.cardHeader}>物件情報</div>
                                <table style={modalStyles.table}>
                                    <tbody>
                                        <tr><th style={modalStyles.th}>住所</th><td style={modalStyles.td}>{portal.data.address}</td></tr>
                                        <tr><th style={modalStyles.th}>交通</th><td style={modalStyles.td}>{portal.data.line_station}</td></tr>
                                        <tr><th style={modalStyles.th}>種目 / 掲載日</th><td style={modalStyles.td}>{portal.data.property_type} <span className="ms-3 text-muted">公開: {portal.data.published_date}</span></td></tr>
                                        <tr><th style={modalStyles.th}>価格</th><td style={{ ...modalStyles.td, color: '#e53e3e', fontSize: '14px' }}>{portal.data.price_man_yen} 万円</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div style={modalStyles.card}>
                                <div style={modalStyles.cardHeader}>PV詳細 <span className="fw-normal text-muted ms-2" style={{ fontSize: '11px' }}>{portal.data.start_date} ~ {portal.data.end_date}</span></div>
                                <table style={modalStyles.table}>
                                    <tbody>
                                        <tr><th style={modalStyles.th}>合計 PV</th><td style={{ ...modalStyles.td, color: '#2b6cb0', fontSize: '16px' }}>{portal.data.pv_total}</td></tr>
                                        <tr><th style={modalStyles.th}>PC / SP</th><td style={modalStyles.td}>{portal.data.pv_pc} / {portal.data.pv_sp}</td></tr>
                                        <tr><th style={modalStyles.th}>お気に入り</th><td style={modalStyles.td}>{portal.data.favorite_count} 件</td></tr>
                                        <tr><th style={modalStyles.th}>画像 / ムービー</th><td style={modalStyles.td}>{portal.data.photo_count} 枚 / 再生: {portal.data.movie_play_count} 回</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div style={modalStyles.card}>
                                <div style={modalStyles.cardHeader}>反響詳細</div>
                                <table style={modalStyles.table}>
                                    <tbody>
                                        <tr><th style={modalStyles.th}>合計 反響</th><td style={{ ...modalStyles.td, color: '#d69e2e', fontSize: '16px' }}>{portal.data.inquiry_total}</td></tr>
                                        <tr><th style={modalStyles.th}>PC / SP</th><td style={modalStyles.td}>{portal.data.inquiry_pc} / {portal.data.inquiry_sp}</td></tr>
                                        <tr><th style={modalStyles.th}>通話 / LINE</th><td style={modalStyles.td}>{portal.data.inquiry_call} / {portal.data.inquiry_line}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </Modal.Body>
    </Modal>
);

export default PortalDetailModal;
