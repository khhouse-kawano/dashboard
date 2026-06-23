import React, { useState, useEffect, useMemo, useRef } from 'react';
import Table from "react-bootstrap/Table";
import Modal from "react-bootstrap/Modal";
import axios from "axios";
import { headers } from '../utils/headers';
import Badge from 'react-bootstrap/Badge';

type Shop = { brand: string, shop: string };
type Props = {
    shopList: Shop[],
    editId: string | null
}
type Customer = Record<string, string>;

const IceWorld = ({ shopList, editId }: Props) => {
    const youbi = ['日', '月', '火', '水', '木', '金', '土'];
    const today = new Date();
    const time = ['9:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']
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
            const customerResponse = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: "ice_world" }, { headers });
            setOriginalCustomerList(customerResponse.data.customer);
            setCustomerList(customerResponse.data.customer);
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (!reserve.id) return;
        const targetCustomer = customerList.find(c => c.id === reserve.id);
        if (targetCustomer) {
            setReserve(prev => ({
                ...prev,
                name: targetCustomer?.customer_contacts_name ?? '',
                shop: targetCustomer?.in_charge_store ?? '',
                staff: targetCustomer?.in_charge_user ?? '',
                medium: targetCustomer?.sales_promotion_name ?? '',
                register: targetCustomer?.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 ?? '',
                reserve: targetCustomer?.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7 ?? '',
                rank: targetCustomer?.customized_input_01J82Z5F366ZQ897PXWF6H5ZAM ?? ''
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
                Object.keys(reserve).map(key => [key, ''])
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
            (reserve.shop ? o.in_charge_store === reserve.shop : true)
            && (searchQuery ? o.customer_contacts_name?.includes(searchQuery) : true)
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

    const getDateByIndex = (baseDate: Date, index: number) => {
        const diff = index - baseDate.getDay();
        const date = new Date(baseDate);
        date.setDate(baseDate.getDate() + diff);
        return date;
    };

    const handleSave = async (bool: boolean) => {
        await setIsUpdating(true);
        const newIceWorldValue = bool ? `${reserve.date} ${reserve.time}` : '';
        const postData = {
            id: reserve.id,
            ice_world: newIceWorldValue,
            demand: 'update_iceWorld'
        };
        try {
            await axios.post("https://khg-marketing.info/dashboard/api/", postData, { headers });
            
            setOriginalCustomerList(prev => 
                prev.map(c => c.id === reserve.id ? { ...c, ice_world: newIceWorldValue } : c)
            );
            
            setCustomerList(prev => 
                prev.map(c => c.id === reserve.id ? { ...c, ice_world: newIceWorldValue } : c)
            );
        } catch (e) {
            alert('登録に失敗しました');
        }
        await setIsUpdating(false);
        await modalClose();
    };

    return (
        <div className="bg-white p-3 rounded shadow-sm border" style={{ fontSize: '12px' }}>
            {/* カレンダーヘッダー */}
            <div className="d-flex justify-content-between align-items-center mb-3 px-2">
                <button className="btn btn-light rounded-circle shadow-sm d-flex justify-content-center align-items-center p-0" style={{ width: '28px', height: '28px' }} onClick={() => moveWeek(-7)}>
                    <i className="fa-solid fa-angle-left text-secondary" style={{ fontSize: '12px' }}></i>
                </button>
                <h6 className="mb-0 fw-bold text-dark" style={{ letterSpacing: '1px' }}>
                    {targetDate.getFullYear()}年 {targetDate.getMonth() + 1}月
                </h6>
                <button className="btn btn-light rounded-circle shadow-sm d-flex justify-content-center align-items-center p-0" style={{ width: '28px', height: '28px' }} onClick={() => moveWeek(7)}>
                    <i className="fa-solid fa-angle-right text-secondary" style={{ fontSize: '12px' }}></i>
                </button>
            </div>

            {/* カレンダーテーブル */}
            <div className="table-responsive rounded border overflow-hidden">
                <Table className="mb-0 text-center align-middle" style={{ tableLayout: 'fixed', fontSize: '11px' }}>
                    <thead className="bg-light">
                        <tr>
                            <th style={{ width: '55px', backgroundColor: '#f8f9fa' }} className="border-end border-bottom-0"></th>
                            {youbi.map((day, index) => {
                                const date = getDateByIndex(targetDate, index);
                                const isToday = date.toDateString() === today.toDateString();
                                const isSunday = index === 0;
                                const isSaturday = index === 6;

                                return (
                                    <th
                                        key={index}
                                        className={`py-2 border-bottom-0 ${isSunday ? 'text-danger' : isSaturday ? 'text-primary' : 'text-secondary'}`}
                                        style={{ backgroundColor: '#f8f9fa', minWidth: '85px' }}
                                    >
                                        <div className="fw-normal mb-1" style={{ fontSize: '10px' }}>{day}</div>
                                        <div 
                                            className={`d-inline-flex justify-content-center align-items-center rounded-circle ${isToday ? 'bg-primary text-white shadow-sm' : ''}`}
                                            style={{ width: '24px', height: '24px', fontSize: '12px', fontWeight: isToday ? 'bold' : 'normal' }}
                                        >
                                            {date.getDate()}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {time.map((t, rowIndex) => (
                            <tr key={rowIndex}>
                                {/* 時間の列（Y軸） */}
                                <td className="bg-light text-muted fw-bold border-end p-1" style={{ width: '55px', fontSize: '10px' }}>
                                    {t}
                                </td>
                                {youbi.map((_, colIndex) => {
                                    const date = getDateByIndex(targetDate, colIndex);
                                    const formattedDate = date.toLocaleDateString();
                                    const reservedCustomer = originalCustomerList.find(o => o.ice_world === `${formattedDate} ${t}`);
                                    const idValue = reservedCustomer ? reservedCustomer?.id : editId ? editId : '';
                                    const isSunday = colIndex === 0;
                                    const isSaturday = colIndex === 6;

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
                                            className={`p-1 position-relative hover-bg-light ${isSunday ? 'bg-danger bg-opacity-10' : isSaturday ? 'bg-primary bg-opacity-10' : ''}`}
                                            style={{ height: '50px', cursor: 'pointer', transition: 'background-color 0.2s' }}
                                        >
                                            {reservedCustomer && (
                                                <div className="w-100 h-100 bg-primary text-white rounded d-flex flex-column justify-content-center align-items-start px-2 shadow-sm" style={{ overflow: 'hidden' }}>
                                                    <span className="text-truncate w-100 opacity-75" style={{ fontSize: '9px' }}>{reservedCustomer.in_charge_store}</span>
                                                    <span className="text-truncate w-100 fw-bold" style={{ fontSize: '11px' }}>{reservedCustomer.customer_contacts_name}</span>
                                                </div>
                                            )}
                                            {!reservedCustomer && (
                                                <div className="w-100 h-100 d-flex justify-content-center align-items-center opacity-0 hover-opacity-100 text-muted">
                                                    <i className="fa-solid fa-plus" style={{ fontSize: '10px' }}></i>
                                                </div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>

            {/* 予約用モーダル */}
            <Modal show={modalShow} onHide={modalClose} centered size="sm">
                <Modal.Header closeButton className="border-bottom-0 pb-0">
                    <Modal.Title className="fw-bold text-dark" style={{ fontSize: '14px' }}>
                        ぶるぶるアイスワールド <span className="text-primary">利用予約</span>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="position-relative pt-2" style={{ fontSize: '12px' }}>
                    {isUpdating && (
                        <div className="position-absolute w-100 h-100 top-0 start-0 bg-white bg-opacity-75 d-flex justify-content-center align-items-center" style={{ zIndex: 10, borderRadius: 'inherit' }}>
                            <div className="text-primary fw-bold shadow bg-white px-3 py-2 rounded-pill" style={{ fontSize: '12px' }}>
                                <i className="fa-solid fa-spinner fa-spin me-2"></i>処理中...
                            </div>
                        </div>
                    )}

                    <div className="bg-light p-2 rounded mb-3 d-flex align-items-center text-secondary">
                        <i className="fa-regular fa-clock fs-5 me-2 text-primary"></i>
                        <div>
                            <div className="fw-bold" style={{ fontSize: '10px' }}>利用希望日時 (60分間)</div>
                            <div className="fw-bold text-dark" style={{ fontSize: '13px' }}>{reserve.date} <span className="ms-1">{reserve.time} ~</span></div>
                        </div>
                    </div>

                    <div className="mb-2">
                        <label className="text-muted fw-bold mb-1" style={{ fontSize: '10px' }}>担当店舗</label>
                        {reserve.id ? (
                            <div className="fw-bold border-bottom pb-1" style={{ fontSize: '13px' }}>{reserve.shop}</div>
                        ) : (
                            <select className="form-select form-select-sm shadow-sm"
                                style={{ fontSize: '12px' }}
                                onChange={(e) => setReserve(prev => ({ ...prev, shop: e.target.value }))}>
                                <option value="">利用店舗を選択してください</option>
                                {shopList.filter(s => !s.shop.includes('未設定') && s.shop !== 'khg').map((s, sIndex) =>
                                    <option key={sIndex} selected={reserve.shop === s.shop} value={s.shop}>{s.shop}</option>)}
                            </select>
                        )}
                    </div>

                    <div className="mb-3 position-relative">
                        <label className="text-muted fw-bold mb-1" style={{ fontSize: '10px' }}>お客様名</label>
                        {(nameList && filteredCustomers.length > 0) && (
                            <div className="position-absolute w-100 bg-white shadow rounded border mt-1" style={{ zIndex: 5, maxHeight: '150px', overflowY: 'auto' }}>
                                {filteredCustomers.map(c =>
                                    <div key={c.id} className="p-2 border-bottom hover-bg-light" style={{ cursor: 'pointer' }}
                                        onClick={() => setReserve(prev => ({ ...prev, id: c.id }))}>
                                        <Badge bg="light" text="dark" className="me-2 fw-normal" style={{ fontSize: '9px' }}>{c.in_charge_store}</Badge>
                                        {c.customer_contacts_name} 様
                                    </div>
                                )}
                            </div>
                        )}
                        {reserve.id ? (
                            <div className="fw-bold text-primary border-bottom pb-1" style={{ fontSize: '14px' }}>{reserve.name} 様</div>
                        ) : (
                            <input className="form-control form-control-sm shadow-sm" style={{ fontSize: '12px' }} type="text" placeholder="名前を検索..." onChange={onNameChange} value={reserve.name} />
                        )}
                    </div>

                    {reserve.id && (
                        <div className="row g-2 bg-light rounded p-2 m-0">
                            <div className="col-6">
                                <div className="text-muted fw-bold" style={{ fontSize: '10px' }}>担当営業</div>
                                <div>{reserve.staff || '-'}</div>
                            </div>
                            <div className="col-6">
                                <div className="text-muted fw-bold" style={{ fontSize: '10px' }}>販促媒体</div>
                                <div className="text-truncate">{reserve.medium || '-'}</div>
                            </div>
                            <div className="col-6">
                                <div className="text-muted fw-bold" style={{ fontSize: '10px' }}>初回来場日</div>
                                <div>{reserve.reserve || '-'}</div>
                            </div>
                            <div className="col-6">
                                <div className="text-muted fw-bold" style={{ fontSize: '10px' }}>ランク</div>
                                <div>{reserve.rank ? <Badge bg="secondary" className="fw-normal">{reserve.rank}</Badge> : '-'}</div>
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer className="border-top-0 d-flex justify-content-center pb-3 pt-0">
                    {!reserve.reserved && (
                        <button className="btn btn-primary btn-sm rounded-pill px-3 py-1 fw-bold shadow-sm"
                            disabled={!reserve.id || isUpdating}
                            onClick={() => handleSave(true)}>
                            利用予約を確定
                        </button>
                    )}
                    {reserve.reserved && (
                        <button className="btn btn-outline-danger btn-sm rounded-pill px-3 py-1 fw-bold"
                            disabled={!reserve.id || isUpdating}
                            onClick={() => handleSave(false)}>
                            予約を取り消す
                        </button>
                    )}
                    {(!reserve.reserved && reserve.id) && (
                        <button className="btn btn-light btn-sm rounded-pill px-2 py-1 text-muted"
                            style={{ fontSize: '11px' }}
                            onClick={() => {
                                const empty = {
                                    ...Object.fromEntries(Object.keys(reserve).map(key => [key, ''])),
                                    date: reserve.date,
                                    time: reserve.time,
                                };
                                setReserve(empty);
                            }}>
                            入力をクリア
                        </button>
                    )}
                </Modal.Footer>
            </Modal>
        </div>
    )
}

export default IceWorld;