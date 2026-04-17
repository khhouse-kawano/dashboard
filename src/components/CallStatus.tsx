import { parse } from 'dotenv';
import React, { SetStateAction, useState, useEffect } from 'react'
import Table from "react-bootstrap/Table";

type shopList = { brand: string, shop: string, section: string };
type staffList = { name: string; shop: string; pg_id: string; category: number; estate: number, rank: number };
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
type customerList = { id: string; shop: string; name: string; staff: string; status: string; rank: string; medium: string; reserve: string; register: string; before_survey: number; before_interview: number; after_interview: number; call_status: string, reserved_status: string, full_address: string; phone_number: string; trash: number, section: string, cancel_status: string, campaign: string, second_reserve: string, note: string, survey: string, gift: string, rank_period: string };
type CallAction = {
    day: string;
    time: string;
    action: string;
    note: string;
    staff: string;
};
type Props = {
    shopArray: shopList[],
    monthArray: string[],
    staffArray: staffList[],
    callLogList: CallLogList[],
    originalDatabase: customerList[],
    insideSalesCategory: string,
    miniModalOpen: (list: any) => void,
    setInsideSalesCategory: React.Dispatch<SetStateAction<string>>
};


const CallStatus = ({ shopArray, monthArray, staffArray, callLogList, originalDatabase, insideSalesCategory, miniModalOpen, setInsideSalesCategory }: Props) => {
    const [targetShop, setTargetShop] = useState('');
    const [changed, setChanged] = useState<staffList[]>(staffArray);
    const now = new Date();
    const yearValue = now.getFullYear();
    const monthValue = now.getMonth() + 1;

    useEffect(() => {
        const filtered = staffArray.filter(s => s.rank === 1 &&
            (targetShop === 'estate' ? s.estate === 1 : targetShop ? s.shop === targetShop : false)
        );
        setChanged(filtered);
    }, [staffArray, targetShop]);

    const isThisMonth = (month: string) => {
        return month === `${String(yearValue).padStart(2, '0')}/${String(monthValue).padStart(2, '0')}`;
    };

    const formate = (value: number, month: string) => {
        const yearNumber = Number(month.split('/')[0]);
        const monthNumber = Number(month.split('/')[1]);
        const dayNumber = now.getDate();
        const days = new Date(yearNumber, monthNumber, 0).getDate();
        return isThisMonth(month) ? value * days / dayNumber : value;
    };

    const parseLogs = (raw: string | null | undefined) => {
        if (!raw || raw.trim() === "") return [];

        try {
            const parsed = JSON.parse(raw);

            // 配列ならそのまま返す
            if (Array.isArray(parsed)) return parsed;

            // オブジェクトなら配列に包む
            if (typeof parsed === "object") return [parsed];

            return [];
        } catch {
            return [];
        }
    };


    return (
        <>
            <div className="d-flex justify-content-center my-3" style={{ fontSize: '13px' }}>
                <div className="bg-primary text-white px-3 py-1 rounded-pill mx-2"
                    style={{ cursor: insideSalesCategory === 'kumamoto' ? 'text' : 'pointer', opacity: insideSalesCategory === 'kumamoto' ? '1' : '.5', transform: insideSalesCategory === 'kumamoto' ? 'scale(1.1)' : 'scale(1)' }}
                    onClick={() => setInsideSalesCategory('kumamoto')}>インサイドセールス</div>
                <div className="bg-info text-white px-3 py-1 rounded-pill mx-2"
                    style={{ cursor: insideSalesCategory === 'inside' ? 'text' : 'pointer', opacity: insideSalesCategory === 'tochishinchaku' ? '1' : '.5', transform: insideSalesCategory === 'tochishinchaku' ? 'scale(1.1)' : 'scale(1)' }}
                    onClick={() => setInsideSalesCategory('tochishinchaku')}>営業</div>
            </div>
            {insideSalesCategory === 'tochishinchaku' ?
                <>
                    <div className="mb-3">
                        <select className='target' onChange={(e) => setTargetShop(e.target.value)}>
                            <option value=''>店舗を選択</option>
                            <option value='estate'>土地新着ネット</option>
                            {shopArray.map((item, index) =>
                                <option key={index} value={item.shop}>{item.shop}</option>)}
                        </select>
                    </div>
                    <Table bordered striped>
                        <tbody style={{ fontSize: '11px' }} className='align-middle'>
                            <tr>
                                <td>担当</td>
                                <td>種別</td>
                                <td>合計</td>
                                {[...monthArray.slice(12)].map(month =>
                                    <td style={{ width: '120px', minWidth: '100px', maxWidth: '160px' }}>{month}</td>
                                )}
                            </tr>
                            {[{ name: '合計', shop: '', pg_id: '', category: '', estate: 1 }, ...changed].map((staff, sIndex) => {
                                const targetStaff = staffArray.filter(s =>
                                    targetShop === 'estate' ? s.estate === 1 :
                                        targetShop ? s.shop === targetShop : true
                                ).map(s => s.name);
                                const customerFilter = callLogList.filter(c => {
                                    const logs = parseLogs(c.call_log);
                                    if (sIndex > 0) {
                                        return (
                                            c.staff === staff.name ||
                                            logs.some(l => l.staff === staff.name)
                                        );
                                    }
                                    return (
                                        targetStaff.includes(c.staff) ||
                                        logs.some(l => targetStaff.includes(l.staff))
                                    );
                                });
                                const callFilter = customerFilter.filter(c => c.status && c.status !== '未通電').map(c => c.id);
                                const calledCustomer = originalDatabase.filter(o => callFilter.includes(o.id)).map(o => o.register);
                                const appointFilter = customerFilter.filter(c => c.status === '来場アポ').map(c => c.id);
                                const appointCustomer = originalDatabase.filter(o => appointFilter.includes(o.id)).map(o => o.register);
                                const interviewFilter = customerFilter.filter(c => c.status === '来場済み').map(c => c.id);
                                const interviewCustomer = originalDatabase.filter(o => interviewFilter.includes(o.id)).map(o => o.register);
                                const isEstate = targetShop === 'estate';
                                const parsed = customerFilter.map(c => {
                                    const raw = c.call_log;
                                    if (!raw || raw.trim() === "") return [];
                                    try {
                                        return JSON.parse(raw);
                                    } catch (e) {
                                        return [];
                                    }
                                }).flat();
                                console.log(parsed)
                                const response = originalDatabase.filter(o => o.medium === '土地新着ネット' &&
                                    (staff.name === '合計' ? true : o.staff === staff.name)
                                );
                                const targetCategory = [
                                    ...(targetShop === 'estate' ? ['土地新着ネット反響数'] : []),
                                    '総架電数',
                                    '通電数',
                                    'アポ取得数',
                                    '架電からの来場数',
                                ];

                                return targetCategory.map((category, cIndex) => {
                                    return (
                                        <tr key={`${sIndex}-${cIndex}`}>
                                            {cIndex === 0 && <td rowSpan={cIndex === 0 ? targetCategory.length : 1}>{sIndex === 0 ? `${targetShop.replace('estate', '土地新着ネット')}合計` : staff.name}</td>}
                                            <td>{category}{isEstate && cIndex === 1 && sIndex > 0 && '(月々目標100件)'}{isEstate && cIndex === 2 && sIndex > 0 && '(月々目標15件)'}{isEstate && cIndex === 3 && sIndex > 0 && '(月々目標2件)'}</td>
                                            {['total', ...monthArray.slice(12)].map((month, mIndex) => {
                                                let value;
                                                let classValue;
                                                if (category === '土地新着ネット反響数') {
                                                    value = response.filter(r => mIndex > 0 ? r.register.replace(/-/g, '/').includes(month) : true).length;
                                                    classValue = 'text-dark';
                                                }
                                                else if (category === '総架電数') {
                                                    value = parsed.filter(p => (mIndex > 0 ? p.day.includes(month.replace(/\//g, '-')) : true) && p.action === '架電').length;
                                                    classValue = isEstate && mIndex > 0 && sIndex > 0 ? `${formate(value, month) < 100 ? 'text-danger' : 'text-primary fw-bold'}` : '';
                                                } else if (category === '通電数') {
                                                    value = calledCustomer.filter(c => mIndex > 0 ? c.slice(0, 7) === month : true).length;
                                                    classValue = isEstate && mIndex > 0 && sIndex > 0 ? `${formate(value, month) < 15 ? 'text-danger' : 'text-primary fw-bold'}` : '';
                                                } else if (category === 'アポ取得数') {
                                                    value = appointCustomer.filter(c => mIndex > 0 ? c.slice(0, 7) === month : true).length;
                                                    classValue = isEstate && mIndex > 0 && sIndex > 0 ? `${formate(value, month) < 2 ? 'text-danger' : 'text-primary fw-bold'}` : '';
                                                } else if (category === '架電からの来場数') {
                                                    value = interviewCustomer.filter(c => mIndex > 0 ? c.slice(0, 7) === month : true).length;
                                                    classValue = 'text-dark';
                                                }
                                                return <td style={{ width: '120px', minWidth: '100px', maxWidth: '160px' }} className={classValue}>{value}</td>
                                            }
                                            )}
                                        </tr>
                                    )
                                });
                            })}
                        </tbody>
                    </Table>
                </>
                :
                <div style={{ overflowX: 'scroll' }}>
                    <div style={{ width: `${monthArray.slice(8).length * 170}px` }}>
                        <Table bordered striped>
                            <tbody style={{ fontSize: '11px' }}>
                                <tr>
                                    <td>店舗</td>
                                    {['種別', '合計', ...monthArray.slice(8)].map(month => <td style={{ width: '120px', minWidth: '100px', maxWidth: '160px' }}>{month}</td>
                                    )}
                                </tr>
                                {[{ brand: '', shop: '熊本営業課', section: '熊本営業課' }, ...shopArray].sort().filter(s => s.section === '熊本営業課').map((s, sIndex) => {
                                    const targetShop = shopArray.filter(shop => shop.section === '熊本営業課').map(shop => shop.shop);
                                    const customerFilter = callLogList.filter(c => sIndex === 0 ? targetShop.includes(c.shop) : c.shop === s.shop);
                                    const parsed = customerFilter.map(shop => {
                                        const raw = shop.call_log;
                                        if (!raw || raw.trim() === "") return [];
                                        try {
                                            return JSON.parse(raw);
                                        } catch (e) {
                                            return [];
                                        }
                                    }).flat();
                                    const registerFilter = originalDatabase.filter(o => sIndex === 0 ? o.section === '熊本営業課' : o.shop === s.shop);
                                    const callLogId = customerFilter.filter(c => targetShop.includes(c.shop)).map(c => c.id);
                                    const calledCustomer = originalDatabase.filter(o => callLogId.includes(o.id));
                                    const callFilter = parsed.filter(p => p.action === '架電');
                                    const postFilter = parsed.filter(p => p.action === '資料郵送');
                                    const mailFilter = parsed.filter(p => p.action === 'メール送信');
                                    const smsFilter = parsed.filter(p => p.action === 'SMS送信');
                                    const continueFilter = customerFilter.filter(c => c.status === '継続');
                                    const appointFilter = customerFilter.filter(c => c.status === '来場アポ');
                                    const interviewFilter = customerFilter.filter(c => c.status === '来場済み');
                                    return ['総反響数', '対応反響数', '対応中', 'アポ取得数', '対応反響数からの来場数', '総架電数', '資料郵送数', 'SMS送信数', 'メール送信数'].map((item, index) => <tr>
                                        {index === 0 && <td rowSpan={9} className='align-middle'>{s.shop}</td>}
                                        <td className={`${index === 4 ? 'fw-bold text-primary table-primary' : index === 3 ? 'fw-bold text-danger table-danger' : (index === 2 || index === 1) ? 'fw-bold' : ''}`}>{item}</td>
                                        {['total', ...monthArray.slice(8)].map((month, mIndex) => {
                                            const formattedRegisterFilter = registerFilter.filter(r => mIndex === 0 ? true : r.register.includes(month));
                                            const formattedCalledCustomer = calledCustomer.filter(c => mIndex === 0 ? true : c.register.includes(month));
                                            const formattedCallFilter = callFilter.filter(call => mIndex === 0 ? true : call.day.replace(/-/g, '/').includes(month));
                                            const formattedPostFilter = postFilter.filter(call => mIndex === 0 ? true : call.day.replace(/-/g, '/').includes(month));
                                            const formattedSmsFilter = smsFilter.filter(call => mIndex === 0 ? true : call.day.replace(/-/g, '/').includes(month));
                                            const formattedContinueFilter = continueFilter.filter(c => {
                                                const callLog: CallAction[] = JSON.parse(c.call_log);
                                                const newest: CallAction | null = callLog.length > 0 ? callLog[callLog.length - 1] : null;
                                                if (!newest) return false;
                                                return mIndex === 0 ? true : newest.day.includes(month.replace(/\//g, '-'))
                                            });
                                            const formattedAppointFilter = appointFilter.filter(interview => mIndex === 0 ? true : interview.reserved_status.replace(/-/g, '/').includes(month));
                                            const formattedMailFilter = mailFilter.filter(call => mIndex === 0 ? true : call.day.replace(/-/g, '/').includes(month));
                                            const formattedInterviewFilter = interviewFilter.filter(interview => mIndex === 0 ? true : interview.reserved_status.replace(/-/g, '/').includes(month));
                                            const perAppoint = Math.ceil((formattedAppointFilter.length + formattedInterviewFilter.length) / formattedCalledCustomer.length * 1000) / 10
                                            const perInterview = Math.ceil(formattedInterviewFilter.length / formattedCalledCustomer.length * 1000) / 10
                                            return <td style={{ textAlign: 'right' }} className={`${mIndex === 0 ? 'fw-bold ' : ''}${index === 4 ? 'fw-bold text-primary table-primary' : index === 3 ? 'fw-bold text-danger table-danger' : (index === 2 || index === 1) ? 'fw-bold' : ''}`}>
                                                {index === 0 && formattedRegisterFilter.length}
                                                {index === 1 && <div style={{ textDecoration: formattedContinueFilter.length > 0 ? 'underline' : '', cursor: 'pointer' }}
                                                    onClick={() =>
                                                        formattedCalledCustomer.length > 0 ? miniModalOpen(formattedCalledCustomer) : null}>{formattedCalledCustomer.length}</div>}
                                                {index === 2 && <div style={{ textDecoration: formattedContinueFilter.length > 0 ? 'underline' : '', cursor: 'pointer' }}
                                                    onClick={() =>
                                                        formattedInterviewFilter.length > 0 ? miniModalOpen(formattedContinueFilter) : null}>{formattedContinueFilter.length}</div>}
                                                {index === 3 && <div style={{ textDecoration: formattedAppointFilter.length + formattedInterviewFilter.length > 0 ? 'underline' : '', cursor: 'pointer' }}
                                                    onClick={() =>
                                                        formattedInterviewFilter.length > 0 ? miniModalOpen([...formattedAppointFilter, ...formattedInterviewFilter]) : null}>{formattedAppointFilter.length + formattedInterviewFilter.length}{`(${perAppoint}%)`}</div>}
                                                {index === 4 && <div style={{ textDecoration: formattedInterviewFilter.length > 0 ? 'underline' : '', cursor: 'pointer' }}
                                                    onClick={() =>
                                                        formattedInterviewFilter.length > 0 ? miniModalOpen(formattedInterviewFilter) : null}>{formattedInterviewFilter.length}</div>}
                                                {index === 5 && formattedCallFilter.length}
                                                {index === 6 && formattedPostFilter.length}
                                                {index === 7 && formattedSmsFilter.length}
                                                {index === 8 && formattedMailFilter.length}
                                            </td>
                                        })
                                        }
                                    </tr>)
                                }
                                )}
                            </tbody>
                        </Table></div></div>}

        </>
    )
}

export default CallStatus