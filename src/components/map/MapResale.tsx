/* global google */
import React, { useEffect, useState, useRef, useContext } from "react";
import { GoogleMap } from "@react-google-maps/api";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Card, Table, Row, Col, Form, Button, Badge } from "react-bootstrap";
import AuthContext from "../../context/AuthContext";
import { GoogleMapContext } from "../../context/GoogleMapContext";
import { getYearMonthArray } from "../../utils/getYearMonthArray";
import { useIsSp } from '../../utils/isSp';

type CustomerItem = Record<string, string>;

interface MediumItem { medium: string; }
interface AreaItem { name: string; count: number; }

// フェーズの型定義
type PhaseType = "lead" | "interview" | "contract";

const isTruthy = (val: string | undefined | null) => {
    if (!val) return false;
    const trimmed = val.trim();
    return trimmed !== "" && trimmed !== "0" && trimmed.toLowerCase() !== "false" && trimmed !== "null";
};

const getPhase = (item: CustomerItem): PhaseType => {
    if (isTruthy(item.contract) || isTruthy(item.brokerage)) return "contract";
    if (isTruthy(item.tour) || isTruthy(item.interview) || isTruthy(item.contract) || isTruthy(item.assess) || isTruthy(item.brokerage)) return "interview";
    return "lead";
};

const MapResale: React.FC = () => {
    const navigate = useNavigate();
    const { brand, token, category } = useContext<any>(AuthContext);
    const { isLoaded } = useContext<any>(GoogleMapContext);

    const [originalMarkers, setOriginalMarkers] = useState<CustomerItem[]>([]);

    const advMarkersRef = useRef<any[]>([]);
    const clustererRef = useRef<MarkerClusterer | null>(null);
    const mapRef = useRef<google.maps.Map | null>(null);

    const [isMapReady, setIsMapReady] = useState<boolean>(false);

    const [medium, setMedium] = useState<MediumItem[]>([]);
    const [shop, setShop] = useState<string[]>(['買い:中古リノベ', '買い:ポータル', '売り:ポータル']);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [areaList, setAreaList] = useState<AreaItem[]>([]);
    const [slice, setSlice] = useState<number>(20);

    const [startMonth, setStartMonth] = useState<string>("");
    const [endMonth, setEndMonth] = useState<string>("");
    const [targetMedium, setTargetMedium] = useState<string>("");
    const [targetBrand, setTargetBrand] = useState<string>("");
    const [targetStatus, setTargetStatus] = useState<string>("");
    const [targetShop, setTargetShop] = useState<string>("");
    const [targetIncome, setTargetIncome] = useState<{ startIncome: number | null, endIncome: number | null }>({ startIncome: null, endIncome: null });
    const [contractType, setContractType] = useState('');
    const isSp = useIsSp();

    // 単一選択のState
    const [selectedPhase, setSelectedPhase] = useState<PhaseType>("interview");

    const initialCenter: google.maps.LatLngLiteral = { lat: 31.584172816548488, lng: 130.7938207962173 };

    const buildAreaList = (filtered: CustomerItem[]): AreaItem[] => {
        const filteredArea = filtered
            .map((item) => {
                let addressStr = item.full_address || "";

                addressStr = addressStr.replace(/〒\s*[0-9０-９\-ー]*/g, "").trim();

                const parts = addressStr.split(" ");
                const match = parts.slice(0, 3).join("");
                const regex = /[0-9０-９]/;
                const idx = match.search(regex);
                return idx === -1 ? match : match.substring(0, idx);
            })
            .filter((area) => area !== "");

        return [...new Set(filteredArea)]
            .map((name) => ({
                name,
                count: filteredArea.filter((area) => area === name).length,
            }))
            .sort((a, b) => b.count - a.count);
    };

    const createMarkers = async (filtered: CustomerItem[]) => {
        if (!window.google || !mapRef.current) return;

        const { AdvancedMarkerElement, PinElement } = await window.google.maps.importLibrary("marker") as google.maps.MarkerLibrary;

        if (clustererRef.current) {
            clustererRef.current.clearMarkers();
        }
        advMarkersRef.current.forEach((m) => {
            if (m) m.map = null;
        });
        advMarkersRef.current = [];

        const newMarkers = filtered.map((item) => {
            if (!item.lat_lng || item.lat_lng === "取得不可") return null;

            const [latStr, lngStr] = item.lat_lng.split(",");
            const lat = Number(latStr);
            const lng = Number(lngStr);

            if (isNaN(lat) || isNaN(lng)) return null;

            const phase = getPhase(item);
            let pinBg = "";
            let pinBorder = "";

            if (phase === "contract") {
                pinBg = "#ea4335";
                pinBorder = "#c5221f";
            } else if (phase === "interview") {
                pinBg = "#4285f4";
                pinBorder = "#1a73e8";
            } else {
                pinBg = "#34a853";
                pinBorder = "#1e8e3e";
            }

            const pin = new PinElement({
                background: pinBg,
                borderColor: pinBorder,
                glyphColor: "white",
            });

            return new AdvancedMarkerElement({
                position: { lat, lng },
                title: item.label || "無題",
                content: pin.element,
            });
        }).filter((m) => m !== null);

        advMarkersRef.current = newMarkers;

        // ⭐ 選択中のフェーズに合わせてクラスターの色を決定する
        let clusterColor = "#4a4a4a"; // デフォルト
        if (selectedPhase === "lead") clusterColor = "#34a853";
        else if (selectedPhase === "interview") clusterColor = "#4285f4";
        else if (selectedPhase === "contract") clusterColor = "#ea4335";

        const customRenderer = {
            render: ({ count, position }: any) => {
                // ⭐ svgの circle の fill を clusterColor に変更
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
                    <circle cx="20" cy="20" r="18" fill="${clusterColor}" stroke="white" stroke-width="2"/>
                    <text x="50%" y="50%" text-anchor="middle" fill="white" font-size="12" font-family="Arial" dy=".3em">${count}</text>
                </svg>`;
                const div = document.createElement("div");
                div.innerHTML = svg;
                return new AdvancedMarkerElement({
                    position,
                    content: div.firstElementChild as HTMLElement,
                    zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count,
                });
            }
        };

        clustererRef.current = new MarkerClusterer({
            map: mapRef.current,
            markers: newMarkers as google.maps.marker.AdvancedMarkerElement[],
            renderer: customRenderer,
        });
    };

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));

        const fetchData = async () => {
            try {
                const headers = { Authorization: "4081Kokubu", "Content-Type": "application/json" };
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: "map", category }, { headers });

                const filtered = response.data.customer.filter((item: CustomerItem) => item.lat_lng);
                setOriginalMarkers(filtered);
                setMedium(response.data.medium);
            } catch (e) {
                console.error("データ取得エラー:", e);
            }
        };

        fetchData();
    }, [isLoaded, brand, token, category, navigate]);

    useEffect(() => {
        if (!isLoaded || !isMapReady) return;

        const startDate = startMonth ? new Date(`${startMonth}/01`) : null;
        let endDate: Date | null = null;
        if (endMonth) {
            const [year, month] = endMonth.split("/").map(Number);
            endDate = new Date(year, month, 0);
        }

        const filtered = originalMarkers.filter((item) => {
            const targetDate = new Date(item.register);

            // ==========================================
            // ⭐ 修正1: 年収データを安全に数値化する
            // ==========================================
            let formattedIncome: number | null = null;
            if (item.income) {
                // 「万円」や「,（カンマ）」やスペースを全部消す
                const cleanStr = item.income.replace(/万円/g, '').replace(/,/g, '').trim();
                const num = Number(cleanStr);
                // 正しく数値化できた場合のみ代入
                if (!isNaN(num)) {
                    formattedIncome = num;
                }
            }

            // ==========================================
            // ⭐ 修正2: 年収の判定ロジック
            // ==========================================
            let isIncomeMatch = true;

            // ⭐ 変更: null だけでなく、0 以下の時も「未選択」とみなして弾く
            const hasStart = targetIncome?.startIncome != null && targetIncome.startIncome > 0;
            const hasEnd = targetIncome?.endIncome != null && targetIncome.endIncome > 0;

            // 検索条件（開始か終了）が設定されている場合のみチェック
            if (hasStart || hasEnd) {
                // 年収データが無い（未入力）の場合は弾く
                if (formattedIncome === null) {
                    isIncomeMatch = false;
                } else {
                    // ここは targetIncome の単位が「万円」などで *100 が必要な場合の設定です
                    const startVal = hasStart ? targetIncome.startIncome! * 100 : null;
                    const endVal = hasEnd ? targetIncome.endIncome! * 100 : null;

                    if (startVal !== null && formattedIncome < startVal) isIncomeMatch = false;
                    if (endVal !== null && formattedIncome > endVal) isIncomeMatch = false;
                }
            }

            const matchFilters = (
                (!startDate || targetDate >= startDate) &&
                (!endDate || targetDate <= endDate) &&
                (!targetMedium || item.medium === targetMedium) &&
                (!targetBrand || item.shop?.slice(0, 2) === targetBrand) &&
                (!targetStatus || item.status === targetStatus) &&
                (!targetShop || item.shop === targetShop) &&
                (!contractType || (item.current_contract_type ?? '').includes(contractType)) &&
                isIncomeMatch // ⭐ ここに年収の判定結果を組み込む
            );

            if (!matchFilters) return false;

            const phase = getPhase(item);
            return phase === selectedPhase;
        });

        setAreaList(buildAreaList(filtered));
        createMarkers(filtered);
    }, [
        isLoaded, isMapReady, startMonth, endMonth, originalMarkers,
        targetMedium, targetBrand, targetStatus, targetShop,
        selectedPhase, targetIncome, contractType
    ]);

    const containerStyle = { width: "100%", height: "700px", borderRadius: "8px" };

    if (!isLoaded) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid p-4" style={{ fontSize: '13px' }}>
            <Card className="shadow-sm mb-4 border-0">
                <Card.Body>
                    <Row className="g-2">
                        <Col xs={12} sm={6} md={2}>
                            <Form.Select size="sm" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} style={{ fontSize: '12px' }}>
                                <option value="">開始月</option>
                                {monthArray.map((month, index) => (
                                    <option key={`start-${index}`} value={month}>{month}</option>
                                ))}
                            </Form.Select>
                        </Col>
                        <Col xs="auto" className="d-flex align-items-center justify-content-center"><span>〜</span></Col>
                        <Col xs={12} sm={6} md={2}>
                            <Form.Select size="sm" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} style={{ fontSize: '12px' }}>
                                <option value="">終了月</option>
                                {monthArray.map((month, index) => (
                                    <option key={`end-${index}`} value={month}>{month}</option>
                                ))}
                            </Form.Select>
                        </Col>
                        {!isSp && <>
                            <Col xs={12} sm={6} md={2}>
                                <Form.Select size="sm" value={targetMedium} onChange={(e) => setTargetMedium(e.target.value)} style={{ fontSize: '12px' }}>
                                    <option value="">販促媒体を選択</option>
                                    {medium.map((item, index) => (
                                        <option key={`medium-${index}`} value={item.medium}>{item.medium}</option>
                                    ))}
                                </Form.Select>
                            </Col>
                            <Col xs={12} sm={6} md={2}>
                                <Form.Select size="sm" value={targetStatus} onChange={(e) => setTargetStatus(e.target.value)} style={{ fontSize: '12px' }}>
                                    <option value="">ステータスを選択</option>
                                    <option value="見込み">見込み</option>
                                    <option value="契約済み">契約済み</option>
                                    <option value="会社管理">会社管理</option>
                                    <option value="失注">失注</option>
                                </Form.Select>
                            </Col>
                            <Col xs={12} sm={6} md={2}>
                                <Form.Select size="sm" value={targetShop} onChange={(e) => {
                                    setTargetShop(e.target.value);
                                    setTargetBrand('');
                                }} style={{ fontSize: '12px' }}>
                                    <option value="">店舗を選択</option>
                                    {shop.map((item, index) => (
                                        <option key={`shop-${index}`} value={item}>{item}</option>
                                    ))}
                                </Form.Select>
                            </Col>
                            <Col xs={12} sm={6} md={2}>
                                <Form.Select size="sm" value={targetIncome.startIncome ?? 0} onChange={(e) => {
                                    setTargetIncome(prev => ({ ...prev, startIncome: Number(e.target.value) }));
                                }} style={{ fontSize: '12px' }}>
                                    <option value="">収入を選択(●●万円～)</option>
                                    {[...Array(20)].map((_, index) => (
                                        <option key={index} value={index + 1}>{index + 1}00万円</option>
                                    ))}
                                </Form.Select>
                            </Col>
                            <Col xs="auto" className="d-flex align-items-center justify-content-center"><span>〜</span></Col>
                            <Col xs={12} sm={6} md={2}>
                                <Form.Select size="sm" value={targetIncome.endIncome ?? 0} onChange={(e) => {
                                    setTargetIncome(prev => ({ ...prev, endIncome: Number(e.target.value) }));
                                }} style={{ fontSize: '12px' }}>
                                    <option value="">収入を選択(～●●万円)</option>
                                    {[...Array(30)].map((_, index) => (
                                        <option key={index} value={index + 1}>{index + 1}00万円</option>
                                    ))}
                                </Form.Select>
                            </Col>
                            <Col xs={12} sm={6} md={2}>
                                <Form.Select size="sm" value={contractType} onChange={(e) => {
                                    setContractType(e.target.value);
                                }} style={{ fontSize: '12px' }}>
                                    <option value="">居住形態を選択</option>
                                    <option value="持家">持家</option>
                                    <option value="賃貸">賃貸</option>
                                </Form.Select>
                            </Col></>}
                    </Row>
                </Card.Body>
            </Card>

            <Row style={{ zoom: isSp ? 0.8 : 1 }}>
                <Col lg={9} md={8} className="mb-3">
                    <Card className="shadow-sm border-0 h-100">
                        <Card.Header className="bg-white border-0 pt-3 pb-2">
                            <div className="d-flex flex-wrap gap-2">
                                <Button
                                    variant={selectedPhase === "lead" ? "success" : "outline-success"}
                                    size="sm"
                                    onClick={() => setSelectedPhase("lead")}
                                    className="d-flex align-items-center gap-2 rounded-pill px-3"
                                >
                                    <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", backgroundColor: selectedPhase === "lead" ? "white" : "#34a853", border: selectedPhase === "lead" ? "none" : "1px solid #1e8e3e" }}></span>
                                    全反響
                                </Button>
                                <Button
                                    variant={selectedPhase === "interview" ? "primary" : "outline-primary"}
                                    size="sm"
                                    onClick={() => setSelectedPhase("interview")}
                                    className="d-flex align-items-center gap-2 rounded-pill px-3"
                                >
                                    <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", backgroundColor: selectedPhase === "interview" ? "white" : "#4285f4", border: selectedPhase === "interview" ? "none" : "1px solid #1a73e8" }}></span>
                                    接触済み(店舗来場・物件案内・訪問査定)
                                </Button>
                                <Button
                                    variant={selectedPhase === "contract" ? "danger" : "outline-danger"}
                                    size="sm"
                                    onClick={() => setSelectedPhase("contract")}
                                    className="d-flex align-items-center gap-2 rounded-pill px-3"
                                >
                                    <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", backgroundColor: selectedPhase === "contract" ? "white" : "#ea4335", border: selectedPhase === "contract" ? "none" : "1px solid #c5221f" }}></span>
                                    契約者
                                </Button>
                            </div>
                        </Card.Header>
                        <Card.Body className="p-3 pt-0">
                            <div className="rounded overflow-hidden border">
                                <GoogleMap
                                    mapContainerStyle={containerStyle}
                                    onLoad={(map) => {
                                        mapRef.current = map;
                                        map.setCenter(initialCenter);
                                        map.setZoom(10);
                                        setIsMapReady(true);
                                    }}
                                    options={{
                                        gestureHandling: "greedy",
                                        scrollwheel: true,
                                        mapId: "4b6e2e3028fa3ddba1806a73",
                                        disableDefaultUI: false,
                                    }}
                                />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

                {!isSp && <>
                    <Col lg={3} md={4}>
                        <Card className="shadow-sm border-0 h-100">
                            <Card.Header className="bg-white border-0 pt-3 pb-0">
                                <h6 className="mb-0 fw-bold text-secondary">エリア別集計</h6>
                            </Card.Header>
                            <Card.Body className="d-flex flex-column">
                                <div className="flex-grow-1">
                                    <Table size="sm" hover responsive className="align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th>エリア</th>
                                                <th className="text-end">件数</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {areaList.length > 0 ? (
                                                areaList.slice(slice - 20, slice).map((item, index) => (
                                                    <tr key={index}>
                                                        <td>{item.name}</td>
                                                        <td className="text-end">
                                                            <Badge bg="secondary" pill>{item.count}</Badge>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={2} className="text-center text-muted py-3">
                                                        データがありません
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </Table>
                                </div>

                                <div className="d-flex justify-content-between mt-3 pt-2 border-top">
                                    <Button
                                        variant="outline-primary"
                                        size="sm"
                                        disabled={slice === 20}
                                        onClick={() => setSlice((prev) => Math.max(20, prev - 20))}
                                    >
                                        前へ
                                    </Button>
                                    <span className="text-muted small align-self-center">
                                        {Math.min(slice - 19, areaList.length > 0 ? areaList.length : 1)} - {Math.min(slice, areaList.length)} / {areaList.length}
                                    </span>
                                    <Button
                                        variant="outline-primary"
                                        size="sm"
                                        disabled={slice >= areaList.length}
                                        onClick={() => setSlice((prev) => prev + 20)}
                                    >
                                        次へ
                                    </Button>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col></>}
            </Row>
        </div>
    );
};

export default MapResale;