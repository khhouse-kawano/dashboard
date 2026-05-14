import React, { useState, useEffect, useRef } from 'react';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import axios from 'axios';
import { headers } from '../utils/headers';
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { useContext } from "react";
import { GoogleMapContext } from "../context/GoogleMapContext";

type Props = {
    propertyId: string,
    setPropertyId: React.Dispatch<React.SetStateAction<string>>,
};

type Property = Record<string, string>;

const EstateInfo = ({ propertyId, setPropertyId }: Props) => {
    const [targetId, setTargetId] = useState('');
    const [propertyInfo, setPropertyInfo] = useState<Property>({});

    const mapRef = useRef<google.maps.Map | null>(null);
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
    const streetViewRef = useRef<HTMLDivElement>(null); // ★ 追加: ストリートビュー用のRef
    const [zoom, setZoom] = useState(16);
    const { isLoaded } = useContext(GoogleMapContext);

    const formate = (value: string | number | null | undefined) => {
        if (typeof value === 'string' || typeof value === 'number') { // typeofのタイポ修正 (string | number)
            const formattedValue = (val: string) => {
                return val.replace('0000-00-00', '-').replace('手入力', '土地新着ネット')
            }
            return formattedValue(String(value));
        }
        return '';
    };

    useEffect(() => {
        setTargetId(propertyId);
    }, [propertyId]);

    useEffect(() => {
        if (!targetId) return;
        const fetchData = async () => {
            const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: 'estateInfo', id: targetId }, { headers });
            setPropertyInfo(response.data.estate);
        };

        fetchData();
    }, [targetId]);

    const closeModal = () => {
        setPropertyId('');
        setTargetId('');
        setPropertyInfo({});
        setZoom(16);
    };

    const fontStyle = {
        fontSize: '12px',
        letterSpacing: '1px'
    };

    const containerStyle = { width: "80%", height: "400px", margin: '0 auto' };

    return (
        <>
            {/* ★ 修正: enforceFocus={false} を追加してペグマンのドラッグを許可 */}
            <Modal show={!!targetId} onHide={closeModal} size='xl' enforceFocus={false}>
                <Modal.Header closeButton>{formate(propertyInfo.address_pref)}{formate(propertyInfo.address_city)}{formate(propertyInfo.address_town)}</Modal.Header>
                <Modal.Body>
                    <Table striped bordered>
                        <tbody style={fontStyle}>
                            <tr>
                                <td style={{ width: '13%' }}>物件名</td>
                                <td style={{ width: '37%' }}>{formate(propertyInfo.property_name)}</td>
                                <td style={{ width: '13%' }}>物件所在地</td>
                                <td style={{ width: '37%' }}>{formate(propertyInfo.address_pref)}{formate(propertyInfo.address_city)}{formate(propertyInfo.address_town)}</td>
                            </tr>
                            <tr>
                                <td>物件価格</td>
                                <td>{Number(formate(propertyInfo.price))}万円<br />
                                    (平米単価:{Number(formate(propertyInfo.unit_price_sqm)).toLocaleString()}円/坪単価:{Number(formate(propertyInfo.unit_price_tsubo)).toLocaleString()}円)</td>
                                <td>物件面積</td>
                                <td>{Number(formate(propertyInfo.land_area))}㎡
                                    ({Math.ceil(Number(formate(propertyInfo.land_area)) * 0.3025 * 100) / 100}坪)</td>
                            </tr>
                            <tr>
                                <td>建ぺい率</td>
                                <td>{Number(formate(propertyInfo.bcr1))}%</td>
                                <td>容積率</td>
                                <td>{Number(formate(propertyInfo.far1))}%</td>
                            </tr>
                            <tr>
                                <td>接道状況</td>
                                <td>{formate(propertyInfo.road_condition1)}</td>
                                <td>地勢</td>
                                <td>{formate(propertyInfo.topography)}</td>
                            </tr>
                            <tr>
                                <td>路線</td>
                                <td>{formate(propertyInfo.railway_line)}</td>
                                <td>最寄り駅</td>
                                <td>{formate(propertyInfo.nearest_station)}
                                    {formate(propertyInfo.walk_time1) && `(徒歩${formate(propertyInfo.walk_time1)}分)`}
                                </td>
                            </tr>
                            <tr>
                                <td>バス路線</td>
                                <td>{formate(propertyInfo.bus_route)}</td>
                                <td>バス停</td>
                                <td>{formate(propertyInfo.bus_stop)}
                                    {formate(propertyInfo.walk_time2) && `(徒歩${formate(propertyInfo.walk_time2)}分)`}
                                </td>
                            </tr>
                            <tr>
                                <td>登録日</td>
                                <td>{formate(propertyInfo.registered_at)}</td>
                                <td>更新日</td>
                                <td>{formate(propertyInfo.updated_at) === '0000-00-00' ? '-' : formate(propertyInfo.updated_at)}</td>
                            </tr>
                            <tr>
                                <td>取扱業者</td>
                                <td>{formate(propertyInfo.listing_company)}</td>
                                <td>電話番号</td>
                                <td>{formate(propertyInfo.listing_company_tel)}</td>
                            </tr>
                            <tr>
                                <td>掲載ポータル</td>
                                <td>{formate(propertyInfo.info_source)}</td>
                                <td>現況</td>
                                <td>{formate(propertyInfo.current_status)}</td>
                            </tr>
                            {propertyInfo.note1 && <tr>
                                <td>オススメポイント</td>
                                <td colSpan={3}>{formate(propertyInfo.note1)}</td>
                            </tr>}
                            <tr>
                                <td>用途地域</td>
                                <td>{formate(propertyInfo.zoning1)}</td>
                                <td>地目</td>
                                <td>{formate(propertyInfo.land_category)}</td>
                            </tr>
                            <tr>
                                <td>取引態様</td>
                                <td>{formate(propertyInfo.brokerage_type)}</td>
                                <td>引渡し</td>
                                <td>{formate(propertyInfo.delivery)}</td>
                            </tr>
                            <tr>
                                <td>土地権利</td>
                                <td>{formate(propertyInfo.land_right)}</td>
                                <td>都市計画</td>
                                <td>{formate(propertyInfo.city_planning)}</td>
                            </tr>
                            {propertyInfo.latitude && propertyInfo.longitude && isLoaded && (
                                <tr>
                                    <td colSpan={4}>
                                        <div>
                                            <div className="py-2">周辺地図</div>
                                            <div>
                                                <GoogleMap
                                                    mapContainerStyle={containerStyle}
                                                    center={{
                                                        lat: Number(propertyInfo.latitude),
                                                        lng: Number(propertyInfo.longitude),
                                                    }}
                                                    zoom={zoom}
                                                    onLoad={(map) => {
                                                        mapRef.current = map;

                                                        // ★ 修正: getElementByIdからuseRefに変更
                                                        if (streetViewRef.current) {
                                                            const panorama = new google.maps.StreetViewPanorama(
                                                                streetViewRef.current,
                                                                {
                                                                    position: { lat: Number(propertyInfo.latitude), lng: Number(propertyInfo.longitude) },
                                                                    pov: { heading: 0, pitch: 0 },
                                                                    visible: true,
                                                                    linksControl: true,
                                                                    addressControl: true,
                                                                }
                                                            );
                                                            map.setStreetView(panorama);
                                                        }
                                                    }}
                                                    options={{
                                                        gestureHandling: "greedy",
                                                        scrollwheel: true,
                                                        mapId: "4b6e2e3028fa3ddba1806a73",
                                                        streetViewControl: true,
                                                        mapTypeControl: true,
                                                        fullscreenControl: true,
                                                        disableDefaultUI: false,
                                                    }}
                                                />
                                                <div ref={streetViewRef} style={{ width: "80%", height: "400px", margin: '20px auto' }}></div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </Modal.Body>
            </Modal>
        </>
    )
}

export default EstateInfo