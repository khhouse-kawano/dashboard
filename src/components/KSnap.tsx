import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import axios from 'axios';
import { headers } from '../utils/headers';
import Table from 'react-bootstrap/Table';

type Customer = Record<string, string>;
type Snap = Record<string, string>;
type Props = {
    id: string,
    setKSnap: React.Dispatch<React.SetStateAction<string>>
}

const KSnap = ({ id, setKSnap }: Props) => {
    const [customerData, setCustomerData] = useState<Customer>({});
    const [snaps, setSnaps] = useState<Snap[]>([]);

    // ▼ 追加: 拡大表示する画像を保持するステート
    const [zoomedImg, setZoomedImg] = useState<string | null>(null);

    const safeFormate = (value: string) => {
        try {
            return value ? value.split(',') : [];
        } catch (err) {
            return [];
        }
    };

    const safeParseArray = (data: any): any[] => {
        if (typeof data !== 'string' || data.trim() === '') {
            return [];
        }

        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error("JSONの解析に失敗しました。不正なデータです:", data);
            return [];
        }
    };

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: "kSnap", id: id }, { headers });
            setCustomerData(response.data.customer);
            setSnaps(response.data.snap);
        };
        fetchData();
    }, [id]);

    const imgStyle = {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
        cursor: 'pointer' // ▼ 追加: クリックできることがわかるようにカーソルを変更
    };

    return (
        <>
            {/* メインの顧客情報モーダル */}
            <Modal show={!!id} onHide={() => setKSnap('')} size='lg'>
                <Modal.Header closeButton></Modal.Header>
                <Modal.Body>
                    <Table>
                        <tbody style={{ fontSize: '12px' }}>
                            <tr>
                                <td style={{ width: '150px' }}>閲覧ログ</td>
                                <td>
                                    <div className="d-flex align-items-center flex-wrap">
                                        {safeParseArray(customerData.log)
                                            .sort((a, b) => {
                                                const timeA = new Date(a.time).getTime();
                                                const timeB = new Date(b.time).getTime();
                                                return timeB - timeA
                                            })
                                            .map((item, index) => {
                                                const imgValue = snaps.find(s => String(s.id) === item.img)?.image;
                                                return (
                                                    <div key={index}>
                                                        <div style={{ fontSize: '8px' }}>{item.time}</div>
                                                        <div className='me-1 mb-1' style={{ height: '100px', width: '100px' }}>
                                                            {imgValue && (
                                                                <img
                                                                    src={`https://khg-marketing.info/k-snap/images/${imgValue}`}
                                                                    style={imgStyle}
                                                                    onClick={() => setZoomedImg(imgValue)}
                                                                    alt="log"
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>お気に入り登録</td>
                                <td>
                                    <div className="d-flex flex-wrap">
                                        {safeFormate(customerData.bookmark).map((item, index) => {
                                            const imgValue = snaps.find(s => String(s.id) === item)?.image;
                                            return (
                                                <div key={index} className='me-1 mb-1' style={{ height: '100px', width: '100px' }}>
                                                    {imgValue && (
                                                        <img
                                                            src={`https://khg-marketing.info/k-snap/images/${imgValue}`}
                                                            style={imgStyle}
                                                            onClick={() => setZoomedImg(imgValue)}
                                                            alt="bookmark"
                                                        />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>検索タグ</td>
                                <td>
                                    <div className="d-flex flex-wrap">
                                        {safeFormate(customerData.tag).map((item, index) => {
                                            return <div key={index} className='me-2 bg-warning px-2 rounded py-1 mb-1'>{item}</div>
                                        })}
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>拡大表示</td>
                                <td>
                                    <div className="d-flex flex-wrap">
                                        {safeFormate(customerData.path).map((item, index) => {
                                            const imgValue = snaps.find(s => String(s.id) === item)?.image;
                                            return (
                                                <div key={index} className='me-1 mb-1' style={{ height: '100px', width: '100px' }}>
                                                    {imgValue && (
                                                        <img
                                                            src={`https://khg-marketing.info/k-snap/images/${imgValue}`}
                                                            style={imgStyle}
                                                            onClick={() => setZoomedImg(imgValue)}
                                                            alt="path"
                                                        />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </Table>
                </Modal.Body>
            </Modal>

            <Modal show={!!zoomedImg} onHide={() => setZoomedImg(null)} centered size="xl">
                <Modal.Header closeButton style={{ borderBottom: 'none' }}></Modal.Header>
                <Modal.Body className="text-center p-0 pb-4">
                    {zoomedImg && (
                        <img
                            onClick={() => setZoomedImg(null)}
                            src={`https://khg-marketing.info/k-snap/images/${zoomedImg}`}
                            alt="Zoomed"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '85vh',
                                objectFit: 'contain'
                            }}
                        />
                    )}
                </Modal.Body>
            </Modal>
        </>
    )
}

export default KSnap;