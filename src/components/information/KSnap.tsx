import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import axios from 'axios';
import { headers } from '../../utils/headers';
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
        cursor: 'pointer'
    };

    type PagingProps = {
        pages: number,
        pageLength: number,
        targetPage: number,
        setTargetPage: React.Dispatch<React.SetStateAction<number>>
    };

    const [logPage, setLogPage] = useState(1);
    const [favPage, setFavPage] = useState(1);
    const [focusPage, setFocusPage] = useState(1);

    const Paging = ({ pages, pageLength, targetPage, setTargetPage }: PagingProps) => {
        const total = Math.ceil(pages / pageLength);
        return <div className='d-flex align-items-center mb-3 flex-wrap'
        style={{fontSize: '16px'}}>
            {[...Array(total)].map((_, index) => <div className='me-2'
                style={{
                    textDecoration: index + 1 === targetPage ? '' : 'underline',
                    cursor: index + 1 === targetPage ? '' : 'pointer'
                }}
                onClick={() => setTargetPage(index + 1)}
            >{index + 1}
            </div>)}</div>
    };

    const handleSlice = (list: Record<string, string>[] | string[], page: number, targetLength: number) => {
        return list.slice(page * targetLength - targetLength, page * targetLength)
    };

    const [showPass, setShowPass] = useState(false);

    return (
        <>
            <Modal show={!!id} onHide={() => setKSnap('')} size='lg'>
                <Modal.Header closeButton></Modal.Header>
                <Modal.Body>
                    <Table>
                        <tbody style={{ fontSize: '12px' }}>
                            <tr>
                                <td style={{ width: '150px' }}>パスワード</td>
                                <td>
                                    <input value={customerData.pass ?? ''} type={showPass ? 'text' : 'password'}
                                        style={{ width: '90px', fontSize: '20px', border: 'none', height: '20px', letterSpacing: '8px' }} /><i className="fa-solid fa-eye ms-2" onClick={() => setShowPass(!showPass)} style={{ cursor: 'pointer' }}></i></td>
                            </tr>
                            <tr>
                                <td>閲覧ログ</td>
                                <td>
                                    <Paging pages={safeParseArray(customerData.log).length} pageLength={20} targetPage={logPage} setTargetPage={setLogPage} />
                                    <div className="d-flex align-items-center flex-wrap">
                                        {handleSlice(safeParseArray(customerData.log), logPage, 10)
                                            .sort((a, b) => {
                                                const timeA = new Date(a.time).getTime();
                                                const timeB = new Date(b.time).getTime();
                                                return timeB - timeA
                                            })
                                            .map((item, index) => {
                                                const imgValue = snaps.find(s => String(s.id) === item.img)?.image;
                                                return (
                                                    <div key={index}>
                                                        <div style={{ fontSize: '10px' }}>{item.time}</div>
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
                                    <Paging pages={safeFormate(customerData.bookmark).length} pageLength={10} targetPage={favPage} setTargetPage={setFavPage} />
                                    <div className="d-flex flex-wrap">
                                        {handleSlice(safeFormate(customerData.bookmark), favPage, 10).map((item, index) => {
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
                                        {[...new Set(safeFormate(customerData.tag))]
                                            .sort((a, b) => {
                                                const tagLengthA = safeFormate(customerData.tag).filter(c => c === a).length
                                                const tagLengthB = safeFormate(customerData.tag).filter(c => c === b).length
                                                return tagLengthB - tagLengthA
                                            })
                                            .map((item, index) => {
                                                const tagLength = safeFormate(customerData.tag).filter(c => c === item).length
                                                return <div key={index} className='me-2 bg-warning px-2 rounded py-1 mb-1'>{item}× {tagLength}</div>
                                            })}
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td>拡大表示</td>
                                <td>
                                    <Paging pages={safeFormate(customerData.path).length} pageLength={10} targetPage={focusPage} setTargetPage={setFocusPage} />
                                    <div className="d-flex flex-wrap">
                                        {handleSlice(safeFormate(customerData.path), focusPage, 10).map((item, index) => {
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