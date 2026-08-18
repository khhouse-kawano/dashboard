import React from 'react'
import { positions } from '../list/listUtils';

type Shop = { brand: string, shop: string };
type Response = { id: number, shop: string, event: string, date: string, count: number, category: string, url: string, note: string };

type Props = {
    targetMonth: string,
    setTargetMonth: React.Dispatch<React.SetStateAction<string>>,
    setShow: React.Dispatch<React.SetStateAction<boolean>>,
    setSummary: React.Dispatch<React.SetStateAction<boolean>>
    setListShop: React.Dispatch<React.SetStateAction<string>>,
    setDisplay: React.Dispatch<React.SetStateAction<string>>,
    display: string,
    targetShop: string,
    setTargetShop: React.Dispatch<React.SetStateAction<string>>,
    shopList: Shop[],
    response: Response[]
};

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth() + 1;

const CalendarHeader = ({ targetMonth, setTargetMonth, setShow, setSummary, setListShop, setDisplay, display, targetShop, setTargetShop, shopList, response }: Props) => {
    const nextMonth = () => {
        const [year, month] = targetMonth.split('/').map(Number);
        const next = new Date(year, month, 1);
        const y = next.getFullYear();
        const m = String(next.getMonth() + 1).padStart(2, '0');
        setTargetMonth(`${y}/${m}`);
    };

    const beforeMonth = () => {
        const [year, month] = targetMonth.split('/').map(Number);
        const prev = new Date(year, month - 2, 1);
        const y = prev.getFullYear();
        const m = String(prev.getMonth() + 1).padStart(2, '0');
        setTargetMonth(`${y}/${m}`);
    };

    const menuStyle = { width: '100%', position: 'fixed' as const, top: 30, zIndex: 1006, height: 'auto', backgroundColor: '#fff', padding: '15px 0' };
    const innerMenuStyle = { width: '80%', left: '17%' }

    return (
        <>
            <div style={menuStyle}>
                <div style={innerMenuStyle} className="d-flex justify-content-between align-items-center">
                    <div onClick={beforeMonth} className='bg-primary text-white py-2 px-3 rounded-pill' style={{ cursor: 'pointer' }}>前の月</div>
                    <div className="d-flex align-items-center position-relative">
                        <div className="me-2">{targetMonth.replace('/', '年')}月</div>
                        <div className="me-2">
                            <div onClick={() => {
                                setShow(true);
                                setSummary(true);
                            }} className='bg-light text-dark border py-2 px-4 rounded-pill' style={{ cursor: 'pointer' }}>
                                反響集計
                            </div>
                        </div>
                        <div className="me-2">
                            <div onClick={() => setTargetMonth(`${year}/${String(month).padStart(2, '0')}`)}
                                className='bg-light text-dark border py-2 px-4 rounded-pill'
                                style={{ cursor: 'pointer' }}>
                                今月
                            </div>
                        </div>
                        <div className="me-2">
                            <div onClick={() => {
                                setListShop('');
                                setDisplay(display === 'list' ? 'shop' : 'list');
                            }} className='bg-light text-dark border py-2 px-4 rounded-pill' style={{ cursor: 'pointer' }}>
                                {display === 'list' && '店舗表示'}{display === 'shop' && '全体表示'}
                            </div>
                        </div>
                        <div className='me-2'>
                            <select className='target' onChange={(e) => {
                                setTargetShop(e.target.value);
                            }} disabled={display === 'list'}>
                                <option value="" selected={targetShop === ''}>店舗を選択</option>
                                <option value="iceWorld">アイスワールド</option>
                                {shopList.map((shop, index) => <option value={shop.shop} key={index} selected={targetShop === shop.shop}>{shop.shop.replace('khg', 'KHG')}</option>)}
                            </select>
                        </div>
                        {display === 'shop' && <div className="calendarResponse menu">
                            <div className="d-flex">
                                <div className="response sample register px-2">新規来場者:{response.filter(r => r.category === 'reserved').reduce((acc, cur) => acc + cur.count, 0)}名</div>
                                <div className="response sample new px-2">有効新規数:{response.filter(r => r.category === 'new').reduce((acc, cur) => acc + cur.count, 0)}名</div>
                                <div className="response sample appointment px-2">次アポ数:{response.filter(r => r.category === 'next').reduce((acc, cur) => acc + cur.count, 0)}名</div>
                                <div className="response sample listed px-2">管理客:{response.filter(r => r.category === 'registered').reduce((acc, cur) => acc + cur.count, 0)}名</div>
                            </div>
                        </div>}
                    </div>
                    <div onClick={nextMonth} className='bg-primary text-white py-2 px-3 rounded-pill' style={{ cursor: 'pointer' }}>次の月</div>
                </div>
            </div>
        </>
    )
}

export default CalendarHeader