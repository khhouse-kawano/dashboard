import React, { useMemo, useState, useEffect, useContext } from 'react';
import Table from 'react-bootstrap/Table';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Badge from 'react-bootstrap/Badge';
import axios from 'axios';
import { headers } from '../utils/headers';
import { staffSorter } from '../utils/staffSorter';
import { getYearMonthArray } from '../utils/getYearMonthArray';
import { thisYear } from '../utils/thisYear';
import AuthContext from '../context/AuthContext';


// --- Types ---
type shopList = { brand: string, shop: string, section: string, show_flag: number };
type staffList = { name: string; shop: string; pg_id: string; category: number; estate: number, rank: number, period: string };
type CallLogList = {
    id: string;
    shop: string;
    name: string;
    staff: string;
    status: string;
    reserved_status: string;
    call_log: string;
    add: Boolean;
};
type CustomerList = Record<string, string>;
type CallAction = {
    day: string;
    time: string;
    action: string;
    note: string;
    staff: string;
};
type Props = {
    callStatusShow: boolean,
    setCallStatusShow: React.Dispatch<React.SetStateAction<boolean>>,
    source?: string
};

const parseLogs = (raw: string | null | undefined): CallAction[] => {
    if (!raw || raw.trim() === "") return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === "object") return [parsed];
        return [];
    } catch {
        return [];
    }
};

const filteredStaffName = (value: string) => {
    if (!value) return '';
    return value.includes('牟田') ? '牟田' : value.replace(/[  ]+/g, '');
};

const dateFormate = (value: string) => (value ?? '').replace(/-/g, '/');

const CallStatusList = ({ callStatusShow, setCallStatusShow, source }: Props) => {
    const [insideSalesCategory, setInsideSalesCategory] = useState('');
    const [targetShop, setTargetShop] = useState('');
    const [callLogList, setCallLogList] = useState<CallLogList[]>([]);
    const [shopArray, setShopArray] = useState<shopList[]>([]);
    const [staffArray, setStaffArray] = useState<staffList[]>([]);
    const now = useMemo(() => new Date(), []);
    const yearValue = now.getFullYear();
    const monthValue = now.getMonth() + 1;
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [originalDatabase, setOriginalDatabase] = useState<CustomerList[]>([]);
    const { category } = useContext(AuthContext);
    const categoryValue = source ?? category;

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));
        if (!callStatusShow) return;
        const fetchData = async () => {
            try {
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: 'callStatusList', category: categoryValue }, { headers });
                setCallLogList(response.data.callLog);
                const divisionMapping: Record<string, string> = {
                    'order': '注文事業',
                    'spec': '建売分譲事業',
                    'used': '中古リノベ'
                };
                const filteredShopList = response.data.shop.filter((s: any) => s.division === divisionMapping[categoryValue] && s.show_flag === 1);
                setShopArray(filteredShopList);
                setOriginalDatabase(response.data.customer);
                setStaffArray(response.data.staff.filter((s: any) => Number(s.period) === thisYear));

                if (categoryValue === 'order') {
                    setInsideSalesCategory('inside_sales');
                    setTargetShop('inside_sales');
                } else {
                    setInsideSalesCategory('shopStaff');
                    setTargetShop(filteredShopList.map((f: any) => f.shop)[0]);
                }
            } catch (error) {
                alert('架電状況の取得に失敗しました');
                console.error(error);
            }
        };
        fetchData();


    }, [callStatusShow]);

    const targetShopList = useMemo(() => {
        if (categoryValue === 'order') {
            if (targetShop === 'inside_sales') {
                return shopArray.filter(s => s.section === '熊本営業課').map(s => s.shop);
            }
            return shopArray.filter(s => s.shop === targetShop).map(s => s.shop);
        }
        if (categoryValue === 'spec') {
            return shopArray.filter(s => s.shop === targetShop).map(s => s.shop);
        }
        if (categoryValue === 'used') {
            return ['買い:中古リノベ', '買い:ポータル', '売り:ポータル'];
        }
        return [];
    }, [targetShop, shopArray, categoryValue]);

    const changedStaff = useMemo(() => {
        return staffArray.sort(staffSorter()).filter(s =>
            s.rank === 1 && (targetShop === 'estate' ? s.estate === 1 : (targetShop ? s.shop === targetShop : false))
        );
    }, [staffArray, targetShop]);

    const parsedCallLogs = useMemo(() => {
        return callLogList.map(log => ({
            ...log,
            parsedActions: parseLogs(log.call_log)
        }));
    }, [callLogList]);

    const targetCallLog = useMemo(() => {
        return parsedCallLogs.filter(c => targetShop !== 'estate' ? targetShopList.includes(c.shop) : true);
    }, [parsedCallLogs, targetShop, targetShopList]);

    const targetParsedActions = useMemo(() => {
        return targetCallLog.flatMap(log => log.parsedActions);
    }, [targetCallLog]);

    const filteredCustomer = useMemo(() => {
        return originalDatabase.filter(o => (targetShop !== 'estate') ? targetShopList.includes(o.shop) : true);
    }, [originalDatabase, targetShop, targetShopList]);

    const isThisMonth = (month: string) => month === `${String(yearValue).padStart(2, '0')}/${String(monthValue).padStart(2, '0')}`;
    const formate = (value: number, month: string) => {
        const [yearStr, monthStr] = month.split('/');
        const days = new Date(Number(yearStr), Number(monthStr), 0).getDate();
        return isThisMonth(month) ? (value * days) / now.getDate() : value;
    };

    const renderInsideSalesList = () => {
        const displayShops = [{ brand: '', shop: '熊本営業課', section: '熊本営業課', show_flag: 1 }, ...shopArray]
            .sort((a, b) => a.shop.localeCompare(b.shop))
            .filter(s => s.section === '熊本営業課');
        const metrics = ['総反響数', '対応反響数', '対応中', 'アポ取得数', '対応反響数からの来場数', '総架電数', '資料郵送数', 'SMS送信数', 'メール送信数'];

        return (
            <div className="table-responsive shadow-sm rounded mb-3 border" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <Table hover className="mb-0 bg-white" style={{ minWidth: `${monthArray.slice(8).length * 110 + 220}px` }} bordered>
                    <thead className="bg-light text-muted" style={{ fontSize: '12px' }}>
                        <tr>
                            <th className="bg-light" style={{ position: 'sticky', top: 0, left: 0, width: '120px', minWidth: '120px', zIndex: 3 }}>店舗</th>
                            <th className="bg-light border-end" style={{ position: 'sticky', top: 0, left: '120px', width: '160px', minWidth: '160px', zIndex: 3 }}>種別</th>
                            <th className="bg-light text-center" style={{ position: 'sticky', top: 0, width: '80px', zIndex: 2 }}>合計</th>
                            {monthArray.slice(8).map((month, mIndex) => (
                                <th key={mIndex} className="bg-light text-center" style={{ position: 'sticky', top: 0, minWidth: '100px', zIndex: 2 }}>{month}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody style={{ fontSize: '12px' }} className="align-middle">
                        {displayShops.map((s, sIndex) => {
                            const customerFilter = sIndex === 0 ? targetCallLog : targetCallLog.filter(c => c.shop === s.shop);
                            const registerFilter = filteredCustomer.filter(o => sIndex === 0 ? targetShopList.includes(o.shop) : o.shop === s.shop);
                            const callLogIds = new Set(customerFilter.filter(c => targetShopList.includes(c.shop)).map(c => c.id));
                            const calledCustomer = filteredCustomer.filter(o => callLogIds.has(o.id));

                            const callFilter = targetParsedActions.filter(p => p.action === '架電');
                            const postFilter = targetParsedActions.filter(p => p.action === '資料郵送');
                            const mailFilter = targetParsedActions.filter(p => p.action === 'メール送信');
                            const smsFilter = targetParsedActions.filter(p => p.action === 'SMS送信');

                            const continueFilter = customerFilter.filter(c => c.status === '継続');
                            const appointFilter = customerFilter.filter(c => c.status === '来場アポ');
                            const interviewFilter = customerFilter.filter(c => c.status === '来場済み');

                            return metrics.map((metric, index) => {
                                const isImportant = index === 3 || index === 4;
                                return (
                                    <tr key={`${sIndex}-${index}`}>
                                        {index === 0 && (
                                            <td rowSpan={9} className="align-middle fw-bold bg-white" style={{ position: 'sticky', left: 0, width: '120px', minWidth: '120px', zIndex: 1 }}>
                                                {s.shop}
                                            </td>
                                        )}
                                        <td className={`border-end bg-white ${index === 4 ? 'text-primary' : index === 3 ? 'text-danger' : 'text-secondary'}`} style={{ position: 'sticky', left: '120px', zIndex: 1 }}>
                                            {isImportant ? <Badge bg={index === 3 ? 'danger' : 'primary'} className="me-1">{metric}</Badge> : metric}
                                        </td>

                                        {['total', ...monthArray.slice(8)].map((month, mIndex) => {
                                            const monthMatch = (dateStr: string) => mIndex === 0 ? true : dateFormate(dateStr).includes(month);

                                            let value: string | number = 0;
                                            if (index === 0) value = registerFilter.filter(r => monthMatch(r.register)).length;
                                            else if (index === 1) value = calledCustomer.filter(c => monthMatch(c.register)).length;
                                            else if (index === 2) {
                                                value = continueFilter.filter(c => {
                                                    const newest = c.parsedActions.length > 0 ? c.parsedActions[c.parsedActions.length - 1] : null;
                                                    return newest ? monthMatch(newest.day) : false;
                                                }).length;
                                            }
                                            else if (index === 3) {
                                                const appts = appointFilter.filter(c => monthMatch(c.reserved_status)).length;
                                                const ints = interviewFilter.filter(c => monthMatch(c.reserved_status)).length;
                                                const base = calledCustomer.filter(c => monthMatch(c.register)).length;
                                                const rate = base > 0 ? Math.ceil((appts + ints) / base * 1000) / 10 : 0;
                                                value = `${appts + ints} (${rate}%)`;
                                            }
                                            else if (index === 4) value = interviewFilter.filter(c => monthMatch(c.reserved_status)).length;
                                            else if (index === 5) value = callFilter.filter(c => monthMatch(c.day)).length;
                                            else if (index === 6) value = postFilter.filter(c => monthMatch(c.day)).length;
                                            else if (index === 7) value = smsFilter.filter(c => monthMatch(c.day)).length;
                                            else if (index === 8) value = mailFilter.filter(c => monthMatch(c.day)).length;

                                            return (
                                                <td key={mIndex} className={`text-end ${mIndex === 0 ? 'fw-bold bg-light' : ''} ${index === 4 ? 'text-primary fw-bold' : index === 3 ? 'text-danger fw-bold' : ''}`}>
                                                    {value}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            });
                        })}
                    </tbody>
                </Table>
            </div>
        );
    };

    const renderShopStaffList = () => {
        const staffListToRender = [{ name: '合計', shop: '', pg_id: '', category: 0, estate: 1 } as unknown as staffList, ...changedStaff];
        const targetCategories = targetShop === 'estate' ? ['土地新着ネット反響数', '総架電数', '通電数', 'アポ取得数', '架電からの来場数'] : ['総架電数', '通電数', 'アポ取得数', '架電からの来場数'];

        return (
            <div className="table-responsive shadow-sm rounded mb-3 border" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <Table hover className="mb-0 bg-white" style={{ minWidth: `${monthArray.slice(12).length * 100 + 470}px` }} bordered>
                    <thead className="bg-light text-muted" style={{ fontSize: '12px' }}>
                        <tr>
                            <th className="bg-light" style={{ position: 'sticky', top: 0, left: 0, width: '150px', minWidth: '150px', zIndex: 3 }}>担当</th>
                            <th className="bg-light border-end" style={{ position: 'sticky', top: 0, left: '150px', width: '240px', minWidth: '240px', zIndex: 3 }}>種別</th>
                            <th className="bg-light text-center" style={{ position: 'sticky', top: 0, width: '80px', zIndex: 2 }}>合計</th>
                            {monthArray.slice(12).map((month, idx) => (
                                <th key={idx} className="bg-light text-center" style={{ position: 'sticky', top: 0, minWidth: '100px', zIndex: 2 }}>{month}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody style={{ fontSize: '12px' }} className="align-middle">
                        {staffListToRender.map((staff, sIndex) => {
                            const fStaffName = filteredStaffName(staff.name);
                            const validStaffNames = targetShop === 'estate' ? staffArray.filter(s => s.estate === 1).map(s => filteredStaffName(s.name)) : staffArray.filter(s => targetShop ? s.shop === targetShop : true).map(s => filteredStaffName(s.name));

                            const staffLogs = targetCallLog.filter(c => {
                                if (sIndex > 0) {
                                    return filteredStaffName(c.staff) === fStaffName || c.parsedActions.some(l => filteredStaffName(l.staff) === fStaffName);
                                }
                                return validStaffNames.includes(filteredStaffName(c.staff)) || c.parsedActions.some(l => validStaffNames.includes(filteredStaffName(l.staff)));
                            });

                            const callLogIds = new Set(staffLogs.filter(c => c.status && c.status !== '未通電').map(c => c.id));
                            const calledCustomerRegs = filteredCustomer.filter(o => callLogIds.has(o.id)).map(o => o.register);

                            const appointLogIds = new Set(staffLogs.filter(c => c.status === '来場アポ').map(c => c.id));
                            const appointCustomerRegs = filteredCustomer.filter(o => appointLogIds.has(o.id)).map(o => o.register);

                            const interviewLogIds = new Set(staffLogs.filter(c => c.status === '来場済み').map(c => c.id));
                            const interviewCustomerRegs = filteredCustomer.filter(o => interviewLogIds.has(o.id)).map(o => o.register);

                            const estateResponses = filteredCustomer.filter(o => o.medium === '土地新着ネット' && (sIndex === 0 || o.staff === staff.name));

                            return targetCategories.map((category, cIndex) => {
                                const isEstate = targetShop === 'estate';
                                const subText = isEstate && sIndex > 0 ? (category === '総架電数' ? ' (目標100件)' : category === '通電数' ? ' (目標15件)' : category === 'アポ取得数' ? ' (目標2件)' : '') : '';

                                return (
                                    <tr key={`${sIndex}-${cIndex}`}>
                                        {cIndex === 0 && (
                                            <td rowSpan={targetCategories.length} className="align-middle fw-bold bg-white" style={{ position: 'sticky', left: 0, width: '150px', minWidth: '150px', zIndex: 1 }}>
                                                {sIndex === 0 ? `${targetShop.replace('estate', '土地新着ネット')}合計` : staff.name}
                                            </td>
                                        )}
                                        <td className="border-end bg-white text-secondary" style={{ position: 'sticky', left: '150px', width: '240px', minWidth: '240px', zIndex: 1 }}>
                                            {category} <span className="text-muted" style={{ fontSize: '10px' }}>{subText}</span>
                                        </td>
                                        {['total', ...monthArray.slice(12)].map((month, mIndex) => {
                                            const matchMonth = (dateStr: string) => mIndex === 0 || dateFormate(dateStr).includes(dateFormate(month));
                                            let value = 0;
                                            let textColorClass = '';

                                            if (category === '土地新着ネット反響数') {
                                                value = estateResponses.filter(r => mIndex === 0 || dateFormate(r.register).includes(month)).length;
                                            } else if (category === '総架電数') {
                                                value = targetParsedActions.filter(log => {
                                                    const isTargetStaff = sIndex > 0 ? filteredStaffName(log.staff) === fStaffName : validStaffNames.includes(filteredStaffName(log.staff));
                                                    return isTargetStaff && log.action === '架電' && matchMonth(log.day);
                                                }).length;
                                                textColorClass = isEstate && mIndex > 0 && sIndex > 0 ? (formate(value, month) < 100 ? 'text-danger' : 'text-success fw-bold') : '';
                                            } else if (category === '通電数') {
                                                value = calledCustomerRegs.filter(reg => mIndex === 0 || dateFormate(reg.slice(0, 7)) === month).length;
                                                textColorClass = isEstate && mIndex > 0 && sIndex > 0 ? (formate(value, month) < 15 ? 'text-danger' : 'text-success fw-bold') : '';
                                            } else if (category === 'アポ取得数') {
                                                value = appointCustomerRegs.filter(reg => mIndex === 0 || dateFormate(reg.slice(0, 7)) === month).length;
                                                textColorClass = isEstate && mIndex > 0 && sIndex > 0 ? (formate(value, month) < 2 ? 'text-danger' : 'text-success fw-bold') : '';
                                            } else if (category === '架電からの来場数') {
                                                value = interviewCustomerRegs.filter(reg => mIndex === 0 || dateFormate(reg.slice(0, 7)) === month).length;
                                            }

                                            return (
                                                <td key={mIndex} className={`text-end ${mIndex === 0 ? 'bg-light fw-bold' : ''} ${textColorClass}`}>
                                                    {value}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            });
                        })}
                    </tbody>
                </Table>
            </div>
        );
    };

    const selectCategory = (
        <div className="d-flex justify-content-between align-items-center mb-4 px-1">
            <div className="w-25 min-w-200">
                <Form.Label className="text-muted small fw-bold mb-1">表示カテゴリを選択</Form.Label>
                <Form.Select
                    value={targetShop}
                    onChange={(e) => {
                        setTargetShop(e.target.value);
                        setInsideSalesCategory(e.target.value === 'inside_sales' ? 'inside_sales' : 'shopStaff');
                    }}
                    style={{ fontSize: '13px' }}
                    className="shadow-sm border-0"
                >
                    {categoryValue === 'order' && <>
                        <option value="inside_sales">インサイドセールス</option>
                        <option value="estate">土地新着ネット</option>
                    </>}
                    {shopArray
                        .filter(s => !s.shop.includes('全店舗') && !s.shop.includes('未設定'))
                        .map((item, index) => (
                            <option key={index} value={item.shop}>{item.shop}</option>
                        ))}
                </Form.Select>
            </div>
        </div>
    )

    return (
        <>{source ?
            <>
                {categoryValue !== 'used' && selectCategory}
                {insideSalesCategory === 'shopStaff' ? renderShopStaffList() : renderInsideSalesList()}
            </>
            :
            <Modal show={callStatusShow} onHide={() => setCallStatusShow(false)} size="xl" dialogClassName="modal-90w">
                <Modal.Header closeButton className="bg-light">
                    <Modal.Title className="fs-5 fw-bold text-secondary">
                        <i className="bi bi-telephone-fill me-2"></i>架電状況詳細
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="bg-light pt-4">
                    {categoryValue !== 'used' && selectCategory}
                    {insideSalesCategory === 'shopStaff' ? renderShopStaffList() : renderInsideSalesList()}
                </Modal.Body>
            </Modal>}
        </>
    );
};

export default CallStatusList;