import React, { useEffect, useState, useMemo } from 'react';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import apiClient from '../../utils/apiClient';

// ==========================================
// 💡 型定義
// ==========================================
type Props = {
    showSuumoSummary: boolean;
    setShowSuumoSummary: React.Dispatch<React.SetStateAction<boolean>>;
};

type SuumoProperty = {
    id: string;
    rank: string | number;
    area: string;
    company: string;
    name: string;
    price: string;
    plan: string;
    url: string;
    registered_at: string;
};

// 💡 都道府県と市町村のマッピングデータ
const AREA_MAPPING: Record<string, string[]> = {
    '鹿児島県': ['鹿児島市', '鹿屋市', '薩摩川内市', '日置市', '霧島市', '姶良市'],
    '宮崎県': ['宮崎市', '都城市', '延岡市', '日向市', '西都市', '北諸県郡', '東諸県郡', '児湯郡'],
    '大分県': ['大分市', '別府市', '中津市', '由布市', '速水郡'],
    '熊本県': ['熊本市中央区', '熊本市東区', '熊本市西区', '熊本市南区', '熊本市北区', '八代市', '荒尾市', '玉名市', '菊池市', '宇土市', '宇城市', '合志市', '菊池郡', '上益城郡']
};

const getPlanBadgeStyle = (plan: string) => {
    const baseStyle = { padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', display: 'inline-block', whiteSpace: 'nowrap' as const, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };

    if (plan.includes('デコレーション')) return { ...baseStyle, backgroundColor: '#f3e8ff', color: '#6b46c1', border: '1px solid #d6bcfa' };
    if (plan.includes('プレミアム')) return { ...baseStyle, backgroundColor: '#feebc8', color: '#d69e2e', border: '1px solid #fbd38d' };
    if (plan.includes('コマ')) return { ...baseStyle, backgroundColor: '#eebefa', color: '#3182ce', border: '1px solid #bee3f8' };
    if (plan.includes('レポート')) return { ...baseStyle, backgroundColor: '#c6f6d5', color: '#38a169', border: '1px solid #9ae6b4' };

    return { ...baseStyle, backgroundColor: '#edf2f7', color: '#718096', border: '1px solid #e2e8f0' };
};

const SuumoPropertySummary = ({ showSuumoSummary, setShowSuumoSummary }: Props) => {
    const [isLoading, setIsLoading] = useState(false);
    const [properties, setProperties] = useState<SuumoProperty[]>([]);

    const [selectedPrefecture, setSelectedPrefecture] = useState<string>('鹿児島県');
    const [selectedCity, setSelectedCity] = useState<string>('');

    useEffect(() => {
        if (!showSuumoSummary) return; 
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.post('', { request: 'property', roll: 'suumo' });
                if (response.data && response.data.suumo) {
                    setProperties(response.data.suumo);
                }
            } catch (error) {
                console.error("SUUMOデータの取得に失敗しました:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [showSuumoSummary]);

    useEffect(() => {
        setSelectedCity('');
    }, [selectedPrefecture]);

    const targetCities = useMemo(() => {
        return selectedCity ? [selectedCity] : (AREA_MAPPING[selectedPrefecture] || []);
    }, [selectedPrefecture, selectedCity]);

    const processedData = useMemo(() => {
        if (!properties || properties.length === 0) {
            return { latestProperties: [], historyMap: {}, latestDateString: '' };
        }

        const uniqueDates = [...new Set(properties.map(p => p.registered_at?.split(' ')[0]))].filter(Boolean);
        uniqueDates.sort((a, b) => (a < b ? 1 : -1));
        const latestDateString = uniqueDates[0];

        const sortedAllProps = [...properties].sort((a, b) => (a.registered_at < b.registered_at ? 1 : -1));
        const historyMap: Record<string, number[]> = {};
        
        sortedAllProps.forEach(p => {
            if (!historyMap[p.url]) {
                historyMap[p.url] = [];
            }
            historyMap[p.url].push(Number(p.rank));
        });

        const latestProperties = properties.filter(p => p.registered_at?.startsWith(latestDateString));

        return { latestProperties, historyMap, latestDateString };
    }, [properties]);

    const { dataMap, maxRank, totalCount, cityCounts } = useMemo(() => {
        const map: Record<string, Record<number, SuumoProperty>> = {};
        const counts: Record<string, number> = {};
        let max = 0;
        let total = 0;

        processedData.latestProperties.forEach(p => {
            if (!targetCities.includes(p.area)) return;

            total++;
            counts[p.area] = (counts[p.area] || 0) + 1;

            const r = Number(p.rank);
            if (!map[p.area]) map[p.area] = {};
            map[p.area][r] = p;
            if (r > max) max = r;
        });

        return { dataMap: map, maxRank: max, totalCount: total, cityCounts: counts };
    }, [processedData.latestProperties, targetCities]);

    const rankArray = Array.from({ length: maxRank }, (_, i) => i + 1);

    return (
        <Modal show={showSuumoSummary} onHide={() => setShowSuumoSummary(false)} fullscreen>
            <Modal.Header closeButton className="border-bottom-0 pb-2 bg-light">
                <Modal.Title className="fw-bold text-secondary d-flex align-items-center w-100" style={{ fontSize: '18px' }}>
                    
                    {processedData.latestDateString && (
                        <span className="text-muted fw-normal" style={{ fontSize: '12px' }}>
                            <i className="bi bi-clock-history me-1"></i>取得日: {processedData.latestDateString}
                        </span>
                    )}
                    <div className="bg-danger text-white rounded px-2 py-1 ms-2" style={{fontSize: '12px', cursor: 'pointer'}}
                    onClick={() => setShowSuumoSummary(false)}>
                        × 閉じる
                    </div>

                    <div className="d-flex ms-auto me-4 gap-2 align-items-center">
                        <span className="text-muted me-2" style={{ fontSize: '12px' }}>
                            該当: <strong className="text-primary fs-6">{totalCount}</strong> 件
                        </span>
                        <select
                            className="form-select form-select-sm shadow-sm border-secondary fw-bold text-secondary"
                            style={{ width: '140px', cursor: 'pointer', fontSize: '12px' }}
                            value={selectedPrefecture}
                            onChange={(e) => setSelectedPrefecture(e.target.value)}
                        >
                            <option value="">都道府県を選択</option>
                            {Object.keys(AREA_MAPPING).map(pref => (
                                <option key={pref} value={pref}>{pref}</option>
                            ))}
                        </select>
                        <select
                            className="form-select form-select-sm shadow-sm border-primary fw-bold text-primary"
                            style={{ width: '160px', cursor: 'pointer', fontSize: '12px' }}
                            value={selectedCity}
                            onChange={(e) => setSelectedCity(e.target.value)}
                            disabled={!selectedPrefecture}
                        >
                            <option value="">全ての市町村</option>
                            {selectedPrefecture && AREA_MAPPING[selectedPrefecture].map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>
                </Modal.Title>
            </Modal.Header>

            <Modal.Body className="bg-light p-2">
                <style>{`
                    .suumo-table th, .suumo-table td {
                        padding: 4px 8px !important;
                        vertical-align: middle;
                        font-size: 11px;
                    }
                    .table-responsive::-webkit-scrollbar { height: 10px; width: 10px; }
                    .table-responsive::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
                `}</style>

                {isLoading ? (
                    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                        <div className="spinner-border text-primary" role="status"></div>
                    </div>
                ) : (
                    <div className="table-responsive w-100 bg-white" style={{ maxHeight: '100vh' }}>
                        <Table bordered hover className="mb-0 text-center align-middle text-nowrap suumo-table">
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                {/* 💡 大元の行順thを削除 */}
                                <tr>
                                    {targetCities.map(city => (
                                        <th colSpan={5} key={city} className="border-start bg-light py-2 fs-6">
                                            {city} <span className="text-primary ms-1" style={{ fontSize: '12px' }}>({cityCounts[city] || 0}件)</span>
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    {targetCities.map(city => (
                                        <React.Fragment key={city}>
                                            <th className="border-start bg-white" style={{ minWidth: '60px' }}>順位</th>
                                            <th className="bg-white" style={{ minWidth: '80px' }}>枠名</th>
                                            <th className="bg-white" style={{ minWidth: '160px' }}>会社名</th>
                                            <th className="bg-white" style={{ minWidth: '220px' }}>物件名・エリア</th>
                                            <th className="bg-white" style={{ minWidth: '90px' }}>価格</th>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rankArray.map(rank => (
                                    <tr key={rank}>
                                        {/* 💡 大元の行順tdを削除 */}
                                        {targetCities.map(city => {
                                            const item = dataMap[city]?.[rank];

                                            if (!item) {
                                                return (
                                                    <React.Fragment key={city}>
                                                        <td className="border-start bg-white text-muted">-</td>
                                                        <td className="bg-white"></td>
                                                        <td className="bg-white"></td>
                                                        <td className="bg-white"></td>
                                                        <td className="bg-white"></td>
                                                    </React.Fragment>
                                                );
                                            }

                                            const isOwn = item.company.includes('国分ハウジング');
                                            const bgColor = isOwn ? '#fffbeb' : '#ffffff';
                                            
                                            const history = processedData.historyMap[item.url] || [];
                                            const prevRank = history.length > 1 ? history[1] : '-';
                                            const rankDisplay = `${rank}(${prevRank})`;

                                            return (
                                                <React.Fragment key={city}>
                                                    <td className="border-start text-center fw-bold text-secondary" style={{ backgroundColor: bgColor, fontSize: '11px' }}>
                                                        {rankDisplay}
                                                    </td>
                                                    <td style={{ backgroundColor: bgColor }}>
                                                        <span style={getPlanBadgeStyle(item.plan)}>{item.plan}</span>
                                                    </td>
                                                    <td className="text-start fw-bold text-dark" style={{ backgroundColor: bgColor, whiteSpace: 'normal', wordBreak: 'break-all' }}>
                                                        {item.company}
                                                    </td>
                                                    <td style={{ backgroundColor: bgColor }}>
                                                        <div className="d-flex justify-content-between align-items-center gap-2">
                                                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-start" style={{ textDecoration: 'underline dotted', cursor: 'pointer', color: '#3182ce', fontWeight: 'bold', whiteSpace: 'normal', wordBreak: 'break-all' }}>
                                                                {item.name}
                                                            </a>
                                                            <span className="text-muted flex-shrink-0" style={{ fontSize: '9px' }}>
                                                                <i className="bi bi-geo-alt-fill text-danger me-1"></i>{item.area}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="text-end fw-bold text-dark" style={{ backgroundColor: bgColor }}>
                                                        {item.price}
                                                    </td>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                ))}
                                {rankArray.length === 0 && (
                                    <tr>
                                        {/* 💡 colspanから+1を削除 */}
                                        <td colSpan={targetCities.length * 5} className="text-center text-muted py-5 bg-white">
                                            該当する物件データがありません。
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
};

export default SuumoPropertySummary;