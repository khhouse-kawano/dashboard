import React, { useEffect, useState, useMemo, useContext } from 'react';
import Table from "react-bootstrap/Table";
import AuthContext from '../../context/AuthContext';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';

type Property = Record<string, any>;
type Customer = Record<string, any>;

type Props = {
    targetId: string,
    setTargetId: React.Dispatch<React.SetStateAction<string>>,
    setEditId: React.Dispatch<React.SetStateAction<string>>,
};

const normalizePropertyName = (str?: string | null | number) => {
    if (!str) return '';
    return String(str).replace(/[（(]非?公開[）)]/g, '').replace(/[\s ]+/g, '');
};

const PropertySummary = ({ targetId, setTargetId, setEditId }: Props) => {
    const { category, userName } = useContext(AuthContext);
    const [isLoading, setIsLoading] = useState(false);
    const [targetProperty, setTargetProperty] = useState<Property | null>(null);
    const [suumoData, setSuumoData] = useState<Record<string, string> | null>(null);
    const [homesData, setHomesData] = useState<Record<string, string> | null>(null);
    const [athomeData, setAthomeData] = useState<Record<string, string> | null>(null);
    const [customerList, setCustomerList] = useState<Customer[]>([]);

    useEffect(() => {
        if (!targetId) {
            setTargetProperty(null);
            setSuumoData(null);
            setHomesData(null);
            setAthomeData(null);
            setCustomerList([]);
            return;
        }

        const fetchDetail = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.post('', { request: 'property', roll: 'detail', id: targetId });
                if (response.data.status === 'success') {
                    setTargetProperty(response.data.property || null);
                    setSuumoData(response.data.suumo || null);
                    setHomesData(response.data.homes || null);
                    setAthomeData(response.data.athome || null);
                    setCustomerList(response.data.customers || []);
                }
            } catch (error) {
                console.error("詳細データの取得に失敗しました", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDetail();
    }, [targetId]);

    const pvData = useMemo(() => {
        if (!targetProperty) return { suumo: 0, homes: 0, athome: 0, total: 0 };
        const pv_suumo = Number(suumoData?.pv_total ?? 0);
        const now = new Date();
        const today = now.getDate() || 1;
        const pv_homes_raw = Number(homesData?.detail_page_views ?? 0);
        const pv_homes = Math.ceil((pv_homes_raw / today) * 10) / 10;
        let pv_athome = 0;
        if (athomeData?.start_date && athomeData?.end_date) {
            const startDate = new Date(String(athomeData.start_date).replace(/\//g, '-'));
            const endDate = new Date(String(athomeData.end_date).replace(/\//g, '-'));
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                const diffTime = endDate.getTime() - startDate.getTime();
                const elapsedDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
                pv_athome = Math.ceil((Number(athomeData.pv_total ?? 0) / elapsedDays) * 10) / 10;
            }
        }
        return { suumo: pv_suumo, homes: pv_homes, athome: pv_athome, total: pv_suumo + pv_homes + pv_athome };
    }, [targetProperty, suumoData, homesData, athomeData]);

    const filteredCustomer = useMemo(() => {
        if (!targetProperty?.property_name) return [];
        const safeTargetProp = normalizePropertyName(targetProperty.property_name);
        return customerList.filter(f => {
            const customerPropName = normalizePropertyName(f.property_name);
            if (!customerPropName) return false;
            return customerPropName.includes(safeTargetProp);
        });
    }, [customerList, targetProperty]);

    const responseStats = useMemo(() => {
        return {
            inquiry: filteredCustomer.filter(c => c.register).length,
            interview: filteredCustomer.filter(c => c.interview).length,
            tour: filteredCustomer.filter(c => c.tour).length
        };
    }, [filteredCustomer]);

    const dateInfo = useMemo(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const d = now.getDate();
        return {
            reportDate: `${y}年${m}月${d}日`,
            targetPeriod: `${y}年${m}月1日 ~ ${y}年${m}月${d}日`
        };
    }, []);

    const handleGenerateReport = () => {
        const originalTitle = document.title;
        document.title = `販売活動状況報告書_${targetProperty?.property_name || '物件'}`;
        window.print();
        document.title = originalTitle;
    };

    const netInquiryTotal = Number(athomeData?.inquiry_total || 0) + Number(homesData?.inquiries_count || 0);
    const grandTotalInquiry = netInquiryTotal + responseStats.inquiry;

    const renderActionPlan = () => {
        const totalPv = pvData.total;
        let planText = "";
        if (totalPv >= 40) {
            planText = "多くの関心を持たれている状況だといえます。現在の状況を把握し、成約に向けた最善の手段をとってまいります。";
        } else if (totalPv >= 20) {
            planText = "一定の関心を持たれている状況ですが、さらに改善の余地がございます。反響効果の最大化を図るため、掲載内容の工夫や見直しを実施いたします。";
        } else {
            planText = "さらなる閲覧数増加が必要な状況です。価格や掲載内容が最終的な判断の妨げとなっている可能性がございますので、見直しをおこなってまいります。";
        }

        return (
            <>
                掲載媒体はSUUMO・アットホーム・LIFULL HOME'Sです。期間中、アットホームのアクセスは{athomeData?.pv_total || 0}件、LIFULL HOME'Sの詳細閲覧は{homesData?.detail_page_views || 0}件でした。SUUMOの詳細閲覧は直近1週間で1日あたり{suumoData?.pv_recent_week || 0}件です。<br />
                {planText}
            </>
        );
    };

    return (
        <Modal show={!!targetId} onHide={() => setTargetId('')} size='lg' centered backdrop="static">

            <style>
                {`
                    @media screen {
                        .print-only { display: none !important; }
                    }
                    @media print {
                        /* 💡 余計なDOMの空間を完全に消去（2ページ目生成の最大の原因） */
                        body > *:not(.modal) { display: none !important; }
                        .modal-backdrop { display: none !important; }
                        .d-print-none { display: none !important; }
                        
                        /* 💡 モーダルの表示位置をリセット */
                        .modal { position: relative !important; padding: 0 !important; overflow: visible !important; display: block !important; }
                        .modal-dialog { max-width: 100% !important; margin: 0 !important; transform: none !important; }
                        .modal-content { border: none !important; box-shadow: none !important; border-radius: 0 !important; background: transparent !important; }
                        
                        /* 💡 2ページ目（白紙）の強制カット */
                        @page { size: A4 portrait; margin: 10mm; }
                        html, body { height: 100vh; margin: 0; padding: 0; overflow: hidden !important; background-color: #fff; }
                        
                        .print-container { position: relative !important; width: 100%; padding: 0 !important; }
                        
                        /* PDFレポート用の専用スタイル */
                        .print-title { font-size: 22px; font-weight: bold; text-align: center; margin-bottom: 25px; letter-spacing: 4px; border-bottom: 2px solid #333; padding-bottom: 10px;}
                        .print-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
                        .print-table th, .print-table td { border: 1px solid #444; padding: 8px 10px; font-size: 13px; word-wrap: break-word; }
                        .print-table th { background-color: #f0f0f0 !important; text-align: left; -webkit-print-color-adjust: exact; }
                        .print-section-title { font-size: 15px; font-weight: bold; margin-bottom: 8px; border-left: 5px solid #333; padding-left: 10px; }
                    }
                `}
            </style>

            <Modal.Header closeButton className="border-0 pb-0 d-print-none">
                <Modal.Title className="w-100 d-flex justify-content-between align-items-center">
                    <div style={{ color: '#495057', fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                        <i className="bi bi-building me-2" style={{ color: '#a0aec0' }}></i>
                        {targetProperty?.property_name || '読込中...'}
                        {isLoading && <span className="spinner-border spinner-border-sm ms-3 text-primary"></span>}
                    </div>
                    {category === 'used' && <button className="btn btn-sm btn-primary shadow-sm rounded-pill px-4 fw-bold me-3" onClick={handleGenerateReport} disabled={isLoading}>
                        <i className="bi bi-file-earmark-pdf-fill me-2"></i>報告書作成
                    </button>}
                </Modal.Title>
            </Modal.Header>

            {/* ============================================================== */}
            {/* 💡 1. 印刷用レイアウト (PDF出力用) */}
            {/* ============================================================== */}
            <Modal.Body className="print-only print-container">
                <div style={{ zoom: '.84' }}>
                    <div className="print-title">販売活動状況報告書</div>

                    <div className="d-flex justify-content-between align-items-end mb-4" style={{ fontSize: '13px' }}>
                        <div>
                            <div className="fs-5 fw-bold border-bottom border-dark d-inline-block pb-1 pe-4 mb-2">
                                売主 様
                            </div>
                        </div>
                        <div className="text-end">
                            <div>報告日: {dateInfo.reportDate}</div>
                        </div>
                    </div>

                    <div className="mb-4" style={{ fontSize: '13px', lineHeight: '1.8' }}>
                        平素より格別のご高配を賜り厚く御礼申し上げます。宅地建物取引業法第34条の2第9項の規定に基づき、標記物件の販売活動状況につきまして下記のとおりご報告いたします。
                    </div>

                    <div className="print-section-title">物件の表示</div>
                    <table className="print-table">
                        <tbody>
                            <tr><th style={{ width: '25%' }}>物件名</th><td style={{ width: '75%' }}>{targetProperty?.property_name || '-'}</td></tr>
                            <tr><th>価格</th><td>{targetProperty?.price ? `${targetProperty.price}` : '-'}</td></tr>
                            <tr><th>所在地</th><td>{targetProperty?.address || '-'}</td></tr>
                            <tr><th>管理番号</th><td>{targetProperty?.property_id || '-'}</td></tr>
                            <tr><th>媒介契約の種類</th><td>{targetProperty?.baikaiType || '仲介(専任媒介)'}</td></tr>
                        </tbody>
                    </table>

                    <div className="d-flex justify-content-between align-items-end mb-1">
                        <div className="print-section-title mb-0">インターネット広告の反応状況</div>
                        <div style={{ fontSize: '12px' }}>対象期間: {dateInfo.targetPeriod}</div>
                    </div>
                    <table className="print-table text-center align-middle">
                        <thead>
                            <tr>
                                <th className="text-center" style={{ width: '25%' }}>掲載媒体</th>
                                <th className="text-center" style={{ width: '25%' }}>詳細閲覧</th>
                                <th className="text-center" style={{ width: '25%' }}>保存・お気に入り</th>
                                <th className="text-center" style={{ width: '25%' }}>お問い合わせ</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="text-start fw-bold">SUUMO</td>
                                <td>{suumoData?.pv_recent_week || '-'} / 日</td>
                                <td>-</td>
                                <td>-</td>
                            </tr>
                            <tr>
                                <td className="text-start fw-bold">アットホーム</td>
                                <td>{athomeData?.pv_total || '0'}</td>
                                <td>{athomeData?.favorite_count || '0'}</td>
                                <td>{athomeData?.inquiry_total || '0'}</td>
                            </tr>
                            <tr>
                                <td className="text-start fw-bold">LIFULL HOME'S</td>
                                <td>{homesData?.detail_page_views || '0'}</td>
                                <td>-</td>
                                <td>{homesData?.inquiries_count || '0'}</td>
                            </tr>
                            <tr className="fw-bold">
                                <td className="text-start bg-light" style={{ backgroundColor: '#f0f0f0' }}>お問い合わせ合計</td>
                                <td className="bg-light" style={{ backgroundColor: '#f0f0f0' }}></td>
                                <td className="bg-light" style={{ backgroundColor: '#f0f0f0' }}></td>
                                <td className="bg-light" style={{ backgroundColor: '#f0f0f0' }}>{netInquiryTotal}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div style={{ fontSize: '11px', marginTop: '-15px', marginBottom: '25px' }} className="text-muted">
                        ※SUUMOの詳細閲覧は直近1週間の1日あたり平均値、アットホーム・LIFULL HOME'Sは対象期間の合計値です。集計方法が媒体ごとに異なるため、閲覧数の合算は行っておりません。
                    </div>

                    <div className="print-section-title">来場・その他の反響状況</div>
                    <table className="print-table">
                        <tbody>
                            <tr><th style={{ width: '50%' }}>自社案内件数</th><td className="text-center">{responseStats.tour} 件</td></tr>
                            <tr><th>他社案内件数</th><td className="text-center">0 件</td></tr>
                            <tr><th>お問い合わせ件数(電話等)</th><td className="text-center">{responseStats.inquiry} 件</td></tr>
                            <tr><th>資料請求件数(その他)</th><td className="text-center">0 件</td></tr>
                            <tr className="fw-bold"><th style={{ backgroundColor: '#f0f0f0' }}>お問い合わせ合計 (ネット+電話等)</th><td className="text-center" style={{ backgroundColor: '#f0f0f0' }}>{grandTotalInquiry} 件</td></tr>
                        </tbody>
                    </table>

                    <div className="print-section-title">活動状況および今後の方針</div>
                    <div className="p-3 border border-dark mb-4" style={{ fontSize: '13px', height: '120px', lineHeight: '1.8' }}>
                        {renderActionPlan()}
                    </div>

                    <div className="d-flex justify-content-between align-items-end mt-4 pt-2" style={{ fontSize: '13px', lineHeight: '1.6' }}>
                        <div>
                            <img src="https://khg-marketing.info/dashboard/img/khf_logo.png" alt="国分ハウジング不動産" loading="eager" style={{ width: '280px', height: 'auto', objectFit: 'contain' }} />
                        </div>
                        <div className="text-end">
                            <div className="text-muted">国分ハウジング グループ</div>
                            <div className="fw-bold fs-5 mb-2 mt-1">株式会社国分ハウジング不動産</div>
                            <div>担当: {userName || '-'}</div>
                            <div>TEL: 099-204-0705</div>
                        </div>
                    </div>
                </div>
            </Modal.Body>

            {/* ============================================================== */}
            {/* 💡 2. 通常表示用レイアウト (画面上でのモーダル表示) */}
            {/* ============================================================== */}
            <Modal.Body className="pt-3 pb-4 d-print-none" style={{ backgroundColor: '#fafbfe' }}>
                <div className="mb-3 px-1">
                    <span className="text-muted" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>
                        <i className="bi bi-geo-alt-fill text-danger me-1"></i> {targetProperty?.address || '-'}
                    </span>
                </div>

                <div className="row g-3">
                    <div className="col-12">
                        <div className="card shadow-sm border-0 rounded-3">
                            <div className="card-header bg-white border-bottom-0 pt-3 pb-1">
                                <h6 className="fw-bold mb-0" style={{ fontSize: '13px', color: '#4a5568' }}>基本情報</h6>
                            </div>
                            <div className="card-body pt-1 pb-3 px-3">
                                <Table bordered className="mb-0 align-middle" style={{ fontSize: '12px', borderColor: '#e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                    <tbody>
                                        <tr>
                                            <th style={{ width: '15%', backgroundColor: '#f8f9fa', color: '#718096', fontWeight: '500' }}>所在地</th>
                                            <td style={{ width: '35%', color: '#2d3748', fontWeight: 'bold' }}>{targetProperty?.address}</td>
                                            <th style={{ width: '15%', backgroundColor: '#f8f9fa', color: '#718096', fontWeight: '500' }}>担当営業</th>
                                            <td style={{ width: '35%', color: '#2d3748', fontWeight: 'bold' }}>{targetProperty?.property_staff}</td>
                                        </tr>
                                        <tr>
                                            <th style={{ backgroundColor: '#f8f9fa', color: '#718096', fontWeight: '500' }}>価格</th>
                                            <td style={{ color: '#e53e3e', fontWeight: 'bold', fontSize: '13px' }}>{targetProperty?.price}</td>
                                            <th style={{ backgroundColor: '#f8f9fa', color: '#718096', fontWeight: '500' }}>取扱</th>
                                            <td style={{ color: '#2d3748', fontWeight: 'bold' }}>{targetProperty?.seller}</td>
                                        </tr>
                                        <tr>
                                            <th style={{ backgroundColor: '#f8f9fa', color: '#718096', fontWeight: '500' }}>土地面積</th>
                                            <td style={{ color: '#2d3748', fontWeight: 'bold' }}>{targetProperty?.land_area}</td>
                                            <th style={{ backgroundColor: '#f8f9fa', color: '#718096', fontWeight: '500' }}>建築面積</th>
                                            <td style={{ color: '#2d3748', fontWeight: 'bold' }}>{targetProperty?.building_area}</td>
                                        </tr>
                                        <tr>
                                            <th style={{ backgroundColor: '#f8f9fa', color: '#718096', fontWeight: '500' }}>間取り</th>
                                            <td style={{ color: '#2d3748', fontWeight: 'bold' }}>{targetProperty?.layout}</td>
                                            <th style={{ backgroundColor: '#f8f9fa', color: '#718096', fontWeight: '500' }}>建築時期</th>
                                            <td style={{ color: '#2d3748', fontWeight: 'bold' }}>{targetProperty?.building_age}</td>
                                        </tr>
                                    </tbody>
                                </Table>
                            </div>
                        </div>
                    </div>

                    <div className="col-12">
                        <div className="card shadow-sm border-0 rounded-3">
                            <div className="card-header bg-white border-bottom-0 pt-3 pb-1">
                                <h6 className="fw-bold mb-0" style={{ fontSize: '13px', color: '#4a5568' }}>PVサマリ</h6>
                            </div>
                            <div className="card-body pt-1 pb-3 px-3">
                                <Table bordered className="mb-0 text-center align-middle" style={{ fontSize: '12px', borderColor: '#e2e8f0', borderRight: '1px solid #e2e8f0' }}>
                                    <thead style={{ backgroundColor: '#f8f9fa' }}>
                                        <tr>
                                            <th style={{ color: '#718096', fontWeight: '500' }}>総PV</th>
                                            <th style={{ color: '#38a169', fontWeight: '500' }}>SUUMO</th>
                                            <th style={{ color: '#e53e3e', fontWeight: '500' }}>HOME'S</th>
                                            <th style={{ color: '#3182ce', fontWeight: '500' }}>athome</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="fw-bold" style={{ fontSize: '14px', color: '#2d3748' }}>{pvData.total.toLocaleString()}</td>
                                            <td className="fw-bold" style={{ color: '#2f855a' }}>{pvData.suumo.toLocaleString()}</td>
                                            <td className="fw-bold" style={{ color: '#c53030' }}>{pvData.homes.toLocaleString()}</td>
                                            <td className="fw-bold" style={{ color: '#2b6cb0' }}>{pvData.athome.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </Table>
                            </div>
                        </div>
                    </div>

                    <div className="col-12">
                        <div className="card shadow-sm border-0 rounded-3 bg-light">
                            <div className="card-body p-3">
                                <div className="row text-center g-2">
                                    <div className="col-4">
                                        <div className="border bg-white rounded-3 p-2 shadow-sm">
                                            <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: 'bold' }}>問い合わせ数</div>
                                            <div className="fw-bold text-primary" style={{ fontSize: '18px' }}>{responseStats.inquiry}</div>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="border bg-white rounded-3 p-2 shadow-sm">
                                            <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: 'bold' }}>面談数</div>
                                            <div className="fw-bold text-success" style={{ fontSize: '18px' }}>{responseStats.interview}</div>
                                        </div>
                                    </div>
                                    <div className="col-4">
                                        <div className="border bg-white rounded-3 p-2 shadow-sm">
                                            <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: 'bold' }}>案内数</div>
                                            <div className="fw-bold text-danger" style={{ fontSize: '18px' }}>{responseStats.tour}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {targetProperty?.lat_lng && (
                        <div className="col-12">
                            <div className="rounded-3 overflow-hidden shadow-sm" style={{ height: '250px', backgroundColor: '#e2e8f0', border: '1px solid #e2e8f0' }}>
                                <iframe
                                    width="100%"
                                    height="100%"
                                    frameBorder="0"
                                    style={{ border: 0 }}
                                    src={`https://maps.google.com/maps?q=${targetProperty.lat_lng}&hl=ja&z=16&output=embed`}
                                    allowFullScreen
                                    title="Property Location Map"
                                ></iframe>
                            </div>
                        </div>
                    )}

                    <div className="col-12 mt-2">
                        <h6 className="fw-bold mb-2 px-2" style={{ fontSize: '13px', color: '#4a5568' }}>
                            <i className="bi bi-people-fill me-2 text-primary"></i>反響・顧客一覧
                        </h6>
                        <div className="card shadow-sm border-0 rounded-3 overflow-hidden">
                            <div className="table-responsive">
                                <Table hover className="mb-0 text-center align-middle text-nowrap" style={{ fontSize: '11px' }}>
                                    <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e2e8f0' }}>
                                        <tr>
                                            <th className="py-2" style={{ color: '#718096', fontWeight: '500' }}>No</th>
                                            <th className="py-2 text-start" style={{ color: '#718096', fontWeight: '500' }}>顧客名</th>
                                            <th className="py-2" style={{ color: '#718096', fontWeight: '500' }}>ランク</th>
                                            <th className="py-2" style={{ color: '#718096', fontWeight: '500' }}>反響取得日</th>
                                            <th className="py-2" style={{ color: '#718096', fontWeight: '500' }}>初回来場日</th>
                                            <th className="py-2" style={{ color: '#718096', fontWeight: '500' }}>販促媒体</th>
                                        </tr>
                                    </thead>
                                    <tbody style={{ borderTop: 'none' }}>
                                        {filteredCustomer.length > 0 ? (
                                            filteredCustomer.map((item, index) => (
                                                <tr key={item.id || index} style={{ borderBottom: '1px solid #edf2f7' }}>
                                                    <td className="text-muted">{index + 1}</td>
                                                    <td className="text-start">
                                                        <span
                                                            className="text-primary fw-bold"
                                                            style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
                                                            onClick={() => setEditId(item.id)}
                                                        >
                                                            {item.customer}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="badge" style={{ backgroundColor: '#cbd5e0', color: '#2d3748', fontSize: '10px' }}>
                                                            {item.rank}
                                                        </span>
                                                    </td>
                                                    <td style={{ color: '#4a5568' }}>{item.register}</td>
                                                    <td style={{ color: '#4a5568' }}>{item.interview}</td>
                                                    <td style={{ color: '#4a5568' }}>{item.medium}</td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="py-4 text-muted">関連する顧客データはありません</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal.Body>
        </Modal>
    );
}

export default PropertySummary;