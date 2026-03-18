import React, { useState, useEffect, useMemo, useRef } from 'react';
import Table from "react-bootstrap/Table";
import Modal from "react-bootstrap/Modal";
import axios from "axios";
import { headers } from '../utils/headers';

type Shop = { brand: string, shop: string };
type Props = {
    shopList: Shop[],
    editId: string | null
}
type Customer = { id: string, name: string, medium: string, register: string, reserve: string, shop: string, rank: string, section: string, staff: string, ice_world: string }
const IceWorld = ({ shopList, editId }: Props) => {
    const youbi = ['日', '月', '火', '水', '木', '金', '土'];
    const today = new Date();
    const time = ['9:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']
    const [targetDate, setTargetDate] = useState(today);
    const [modalShow, setModalShow] = useState(false);
    const [reserve, setReserve] = useState<Record<string, string>>({});
    const [originalCustomerList, setOriginalCustomerList] = useState<Customer[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const debounceRef = useRef<number | null>(null);
    const [nameList, setNameList] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            const customerResponse = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_list" }, { headers });
            setOriginalCustomerList(customerResponse.data);
            setCustomerList(customerResponse.data);
        };
        fetchData();
    }, []);

    // useEffect(() => {
    //     if (!modalShow) return;
    //     if (editId) {
    //         setReserve(prev => ({
    //             ...prev,
    //             id: editId
    //         }));
    //     }
    // }, [modalShow]);

    useEffect(() => {
        if (!reserve.id) return;
        const targetCustomer = customerList.find(c => c.id === reserve.id);
        if (targetCustomer) {
            setReserve(prev => ({
                ...prev,
                name: targetCustomer?.name ?? '',
                shop: targetCustomer?.shop ?? '',
                staff: targetCustomer?.staff ?? '',
                medium: targetCustomer?.medium ?? '',
                register: targetCustomer?.register ?? '',
                reserve: targetCustomer?.reserve ?? '',
                rank: targetCustomer?.rank ?? ''
            }))
        } else {
            alert('顧客取得に失敗');
            return;
        }
        setNameList(false);
    }, [reserve.id]);

    useEffect(() => {
        if (!reserve.shop || reserve.id) return;
        const empty = {
            ...Object.fromEntries(
                Object.keys(reserve)
                    .map(key => [key, ''])
            ),
            shop: reserve.shop,
            date: reserve.date,
            time: reserve.time,
        };

        setReserve(empty);
    }, [reserve.shop]);

    const filteredCustomers = useMemo(() => {
        if (!searchQuery) return originalCustomerList;
        return originalCustomerList.filter(o =>
            (reserve.shop ? o.shop === reserve.shop : true)
            && (searchQuery ? o.name.includes(searchQuery) : true)
        );
    }, [originalCustomerList, reserve.shop, searchQuery]);

    const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setReserve(prev => ({ ...prev, name: v }));

        if (debounceRef.current) window.clearTimeout(debounceRef.current);

        debounceRef.current = window.setTimeout(() => {
            setSearchQuery(v);
            setNameList(v.trim() !== '');
        }, 300);
    };

    useEffect(() => {
        return () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
        }
    }, []);

    const moveWeek = (diff: number) => {
        setTargetDate(prev => {
            const next = new Date(prev);
            next.setDate(prev.getDate() + diff);
            return next
        });
    };

    const modalClose = () => {
        const empty = Object.fromEntries(
            Object.keys(reserve)
                .filter(key => key !== 'date')
                .map(key => [key, ''])
        );
        setReserve(empty);
        setModalShow(false);
    };

    const getDateByIndex = (baseDate, index) => {
        const diff = index - baseDate.getDay();
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + diff);
        return date;
    };

    const handleSave = async (bool: boolean) => {
        await setIsUpdating(true);
        const postData = {
            id: reserve.id,
            ice_world: bool ? `${reserve.date} ${reserve.time}` : '',
            demand: 'update_iceWorld'
        };
        try {
            const response = await axios.post("https://khg-marketing.info/dashboard/api/", postData, { headers });
            await setOriginalCustomerList(response.data);
        } catch (e) {
            alert('登録に失敗しました');
        }
        await setIsUpdating(false);
        await modalClose();
    };

    return (
        <>
            <div className="d-flex justify-content-between px-3">
                <div style={{ cursor: 'pointer' }} onClick={() => moveWeek(-7)}><i className="fa-solid fa-angle-left"></i></div>
                <div className="text-center mb-3" style={{ letterSpacing: '1px' }}>{targetDate.getFullYear()}年{targetDate.getMonth() + 1}月</div>
                <div style={{ cursor: 'pointer' }} onClick={() => moveWeek(7)}><i className="fa-solid fa-angle-right"></i></div>
            </div>
            <Table bordered>
                <tbody style={{ fontSize: '12px' }}>
                    <tr>
                        {youbi.map((day, index) => {
                            const date = getDateByIndex(targetDate, index);
                            return (
                                <td
                                    key={index}
                                    className={`text-center ${index === 0 ? 'table-danger' : index === 6 ? 'table-primary' : ''}`}
                                    style={{ fontSize: '9px', lineHeight: '25px' }}
                                >
                                    {day}
                                    <br />
                                    <span
                                        style={{ fontSize: index === targetDate.getDay() ? '20px' : '16px' }}
                                        className={index === targetDate.getDay() ? 'text-primary fw-bold' : ''}
                                    >
                                        {date.getDate()}
                                    </span>
                                </td>
                            );
                        })}
                    </tr>

                    {time.map((t, rowIndex) => (
                        <tr key={rowIndex}>
                            {youbi.map((_, colIndex) => {
                                const date = getDateByIndex(targetDate, colIndex);
                                const formattedDate = date.toLocaleDateString();
                                const reservedCustomer = originalCustomerList.find(o => o.ice_world === `${formattedDate} ${t}`);
                                const idValue = reservedCustomer ? reservedCustomer?.id : editId ? editId : '';
                                return (
                                    <td
                                        key={colIndex}
                                        onClick={() => {
                                            setReserve(prev => ({
                                                ...prev,
                                                date: formattedDate,
                                                time: t,
                                                id: idValue,
                                                reserved: reservedCustomer ? 'true' : ''
                                            }));
                                            setModalShow(true);
                                        }}
                                        className={`pt-0 pe-1 position-relative ${colIndex === 0 ? 'table-danger' : colIndex === 6 ? 'table-primary' : ''}`}
                                        style={{ fontSize: '9px', lineHeight: '25px', cursor: 'pointer', height: '60px' }}
                                    >
                                        {t}~
                                        {reservedCustomer && <div className="position-absolute bg-primary text-white rounded px-1" style={{ top: '20px', left: '5px' }}>{reservedCustomer.shop} {reservedCustomer.name}様</div>}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}

                </tbody>
            </Table>
            <Modal show={modalShow} onHide={modalClose}>
                <Modal.Header closeButton>ぶるぶるアイスワールド利用予約</Modal.Header>
                <Modal.Body>
                    {isUpdating && <div className='position-absolute bg-white rounded p-5' style={{width: '300px', left: 'calc(50% - 150px)', top: '30px'}}><i className='fa-solid fa-arrows-rotate sticky-column pointer spinning me-1'></i>処理中...</div>}
                    <div className={`${isUpdating ? 'opacity-50': ''}`}><Table bordered striped>
                        <tbody style={{ fontSize: '12px' }} className='align-middle'>
                            <tr>
                                <td style={{ width: '40%' }}>利用希望日</td>
                                <td>{reserve.date}</td>
                            </tr>
                            <tr>
                                <td>利用希望時間(60分間)</td>
                                <td>{reserve.time}~</td>
                            </tr>
                            <tr>
                                <td>担当店舗</td>
                                <td>
                                    {reserve.id ? reserve.shop : <select className='target'
                                        onChange={(e) => setReserve(prev =>
                                        ({
                                            ...prev,
                                            shop: e.target.value
                                        }))}>
                                        <option value="">利用店舗を選択</option>
                                        {shopList.filter(s => !s.shop.includes('未設定')).map((s, sIndex) =>
                                            <option key={sIndex} selected={reserve.shop === s.shop}>{s.shop}</option>)}
                                    </select>}
                                </td>
                            </tr>
                            <tr>
                                <td>お客様名</td>
                                <td className='position-relative'>
                                    {(nameList && filteredCustomers.length > 0) && <div className="position-absolute bg-white px-2"
                                        style={{ top: '40px', left: '5px', lineHeight: '25px' }}
                                        id='list'>{filteredCustomers.map(c =>
                                            <div key={c.id} style={{ cursor: 'pointer' }} className='hover'
                                                onClick={() => setReserve(prev => ({ ...prev, id: c.id }))}>{c.name}</div>)}</div>}
                                    {reserve.id ? reserve.name : <input className='target' type='text' onChange={onNameChange} value={reserve.name} />}

                                </td>
                            </tr>
                            <tr>
                                <td>担当営業</td>
                                <td>{reserve.staff ?? ''}</td>
                            </tr>
                            <tr>
                                <td>販促媒体</td>
                                <td>{reserve.medium ?? ''}</td>
                            </tr>
                            <tr>
                                <td>名簿取得日</td>
                                <td>{reserve.register ?? ''}</td>
                            </tr>
                            <tr>
                                <td>初回来場日</td>
                                <td>{reserve.reserve ?? ''}</td>
                            </tr>
                            <tr>
                                <td>ランク</td>
                                <td>{reserve.rank ?? ''}</td>
                            </tr>
                        </tbody>
                    </Table></div>
                </Modal.Body>
                <Modal.Footer>
                    <div className={`d-flex position-relative ${isUpdating ? 'opacity-25' : ''}`} style={{ fontSize: '12px' }}>
                        {!reserve.reserved && <div className="bg-primary text-white rounded-pill px-3 me-2 py-1"
                            style={{ opacity: reserve.id ? '1' : '.5', cursor: reserve.id ? 'pointer' : '' }}
                            onClick={() => (reserve.id || isUpdating) ? handleSave(true) : null}>利用予約をする</div>}
                        {reserve.reserved && <div className="bg-danger text-white rounded-pill px-3 me-2 py-1" style={{ opacity: reserve.id ? '1' : '.5', cursor: reserve.id ? 'pointer' : '' }}
                            onClick={() => handleSave(false)}>予約を取り消す</div>}
                        {(!reserve.reserved && reserve.id) && <div className="bg-info text-white rounded-pill px-3 me-2 py-1" style={{ cursor: 'pointer' }}
                            onClick={() => {
                                const empty = {
                                    ...Object.fromEntries(
                                        Object.keys(reserve).map(key => [key, ''])
                                    ),
                                    date: reserve.date,
                                    time: reserve.time,
                                };
                                setReserve(empty);
                            }
                            }>入力内容のクリア</div>}
                        <div className="bg-secondary text-white rounded-pill px-3 me-2 py-1" style={{ cursor: 'pointer' }}
                            onClick={() => modalClose()}>閉じる</div>
                    </div>
                </Modal.Footer>
            </Modal>
        </>
    )
}

export default IceWorld