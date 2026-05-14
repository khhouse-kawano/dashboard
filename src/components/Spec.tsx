import React, { useState, useEffect, useRef, useContext } from 'react';
import axios from 'axios';
import Table from "react-bootstrap/Table";
import AuthContext from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

type Customer = {
    no: number;
    id_action: string;
    staff: string;
    shop: string;
    id_related: string;
    name: string;
    estate_name_1: string;
    category: string;
    medium: string;
    case: string;
    id_case: string;
    status: string;
    registered: string;
    address: string;
    phone: string;
    action: Action[]
};

type Action = {
    date: string;
    method: string;
    subject: string;
    note: string;
};

type ActionDetail = {
    name: string;
    status: string;
    staff: string;
    action: Action[];
};

const Spec = () => {
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [baseCustomers, setBaseCustomers] = useState<Customer[]>([]);
    const [slice, setSlice] = useState<number>(20);
    const [start, setStart] = useState<number>(1);
    const [detail, setDetail] = useState<string>('');
    const [targetStaff, setTargetStaff] = useState<string>('');
    const [targetStatus, setTargetStatus] = useState<string>('');
    const [targetCustomer, setTargetCustomer] = useState<string>('');
    const [targetCategory, setTargetCategory] = useState<string>('');
    const [targetMonth, setTargetMonth] = useState<string>('');
    const [targetAddress, setTargetAddress] = useState<string>('');
    const [targetPhone, setTargetPhone] = useState<string>('');
    const [action, setAction] = useState({
        date: '',
        time: '',
        method: '',
        subject: '',
        note: ''
    });
    const [isUpdated, setIsUpdated] = useState<boolean>(false);
    const [actionDetail, setActionDetail] = useState<ActionDetail>({
        name: '',
        status: '',
        staff: '',
        action: []
    });
    const [topHeight, setTopHeight] = useState(500); // 初期高さ
    const containerRef = useRef<HTMLDivElement>(null);
    const isResizing = useRef(false);
    const [logList, setLogList] = useState([]);
    const { brand } = useContext(AuthContext);
    const navigate = useNavigate();

    const getYearMonthArray = (startYear: number, startMonth: number) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const yearMonthArray: string[] = [];
        let year = startYear;
        let month = startMonth;

        while (
            year < currentYear ||
            (year === currentYear && month <= currentMonth)
        ) {
            const formattedMonth = month.toString().padStart(2, "0");
            yearMonthArray.push(`${year}/${formattedMonth}`);
            month++;
            if (month > 12) {
                month = 1;
                year++;
            }
        }
        return yearMonthArray;
    };

    useEffect(() => {
        if (!brand || brand.trim() === "") navigate("/");
        setMonthArray(getYearMonthArray(2025, 1));
        const fetchData = async () => {
            const headers = {
                Authorization: "4081Kokubu",
                "Content-Type": "application/json",
            };
            const response = await axios.post("https://khg-marketing.info/dashboard/api/khf/", { demand: "kaeru_list" }, { headers });
            const normalized = response.data.map((c: any) => ({
                ...c,
                action: typeof c.action === 'string' ? JSON.parse(c.action || '[]') : (c.action || [])
            }));
            setBaseCustomers(normalized);
            setCustomers(normalized);

        };
        fetchData();


        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current || !containerRef.current) return;

            const containerTop = containerRef.current.getBoundingClientRect().top;
            const newHeight = e.clientY - containerTop;
            setTopHeight(newHeight);
        };

        const handleMouseUp = () => {
            isResizing.current = false;
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    useEffect(() => {
        const filtered = baseCustomers.filter(item =>
            (targetCategory !== '' ? item.case.includes(targetCategory) : true) &&
            (targetStaff !== '' ? item.staff === targetStaff : true) &&
            (targetStatus !== '' ? item.status.includes(targetStatus) : true) &&
            (targetCustomer !== '' ? item.name.includes(targetCustomer) : true) &&
            (targetMonth !== '' ? item.registered.includes(targetMonth) : true) &&
            (targetAddress !== '' ? item.address.includes(targetAddress) : true) &&
            (targetPhone !== '' ? item.phone.replace(/-/g, '').includes(targetPhone) : true)
        );
        setCustomers(filtered);
    }, [baseCustomers, targetStaff, targetStatus, targetCustomer, targetCategory, targetMonth, targetAddress, targetPhone]);

    useEffect(() => {
        const filtered = customers.find(item => item.id_related === detail);
        if (filtered) {
            let parsedAction: Action[] = [];

            try {
                if (filtered.action) {
                    parsedAction = typeof filtered.action === 'string'
                        ? JSON.parse(filtered.action)
                        : filtered.action;
                }
            } catch (e) {
                console.warn('🌪️ JSON parse error:', e);
            }

            setActionDetail(prev => ({
                ...prev,
                name: filtered.name ?? '',
                status: filtered.status ?? prev.status,
                staff: filtered.staff ?? prev.staff,
                action: parsedAction
            }));
        }
    }, [customers, detail]);

    const addAction = async (id: string) => {
        for (const [key, value] of Object.entries(action)) {
            if (value === '') {
                alert('未入力の項目があります');
                return;
            }
        }

        const updatedData = {
            date: `${action.date.replace(/-/g, '/')} ${action.time}:00`,
            method: action.method,
            subject: action.subject,
            note: action.note
        };

        console.log(updatedData)

        await setBaseCustomers(prev =>
            prev.map(customer =>
                customer.id_related === id
                    ? {
                        ...customer,
                        action: [...(customer.action || []), updatedData]
                    }
                    : customer
            )
        );

        await setIsUpdated(prev => !prev);

        await setAction({
            date: '',
            time: '',
            method: '',
            subject: '',
            note: ''
        });
    };


    return (
        <>
            <div className="content" ref={containerRef}>
                <div className="top_content p-3" style={{ height: topHeight }}>
                    <div className="d-flex flex-wrap mb-3">
                        <div className="m-1 m-md-2">
                            <select className='target'
                                onChange={(e) => setTargetCategory(e.target.value)}>
                                <option value="">顧客種別を選択</option>
                                <option value="売:">売</option>
                                <option value="買:">買</option>
                            </select>
                        </div>
                        <div className="m-1 m-md-2">
                            <select className='target'
                                onChange={(e) => setTargetStaff(e.target.value)}>
                                <option value="">スタッフを選択</option>
                                <option value="大坪 征也">大坪 征也</option>
                                <option value="時任 聡一朗">時任 聡一朗</option>
                                <option value="緒方 啓太">緒方 啓太</option>
                                <option value="上村 康一郎">上村 康一郎</option>
                                <option value="永田 倫也">永田 倫也</option>
                                <option value="岡崎 真夕">岡崎 真夕</option>
                            </select>
                        </div>
                        <div className="m-1 m-md-2">
                            <select className='target'
                                onChange={(e) => setTargetStatus(e.target.value)}>
                                <option value="">追客状況を選択</option>
                                <option value="追客中">追客中</option>
                                <option value="接触">接触</option>
                                <option value="来店あり">来店あり</option>
                                <option value="反応なし">反応なし</option>
                                <option value="売買契約">売買契約</option>
                                <option value="ローン事前承認済み">ローン事前承認済み</option>
                                <option value="追客終了">追客終了</option>
                            </select>
                        </div>
                        <div className="m-1 m-md-2">
                            <select className='target'
                                onChange={(e) => setTargetMonth(e.target.value)}>
                                <option value="">反響月を選択</option>
                                {monthArray.map((item, index) => <option key={index}>{item}</option>)}
                            </select>
                        </div>
                        <div className="m-1 m-md-2">
                            <input type="text" className='target'
                                placeholder='顧客名で検索' value={targetCustomer} onChange={(e) => setTargetCustomer(e.target.value)} />
                        </div>
                        <div className="m-1 m-md-2">
                            <input type="text" className='target'
                                placeholder='住所で検索' value={targetAddress} onChange={(e) => setTargetAddress(e.target.value)} />
                        </div>
                        <div className="m-1 m-md-2">
                            <input type="text" className='target'
                                placeholder='電話番号で検索' value={targetPhone} onChange={(e) => setTargetPhone(e.target.value)} />
                        </div>
                    </div>
                    <div className="mb-3 d-flex flex-wrap align-items-center" style={{ fontSize: '13px' }}>
                        <div>顧客一覧</div>
                        <div className='ms-2'><span style={{ fontSize: '15px' }}>{customers.length}</span>件</div>
                        <div className='ms-1'>表示件数</div>
                        <div className="mx-1">
                            <select style={{ border: '1px solid #D3D3D3', borderRadius: '5px', fontSize: '10px' }}
                                onChange={(e) => setSlice(Number(e.target.value))}>
                                <option value="20">20件</option>
                                <option value="50">50件</option>
                                <option value="100">100件</option>
                                <option value="300">300件</option>
                            </select>
                        </div>
                        {Array.from({ length: Math.min(Math.ceil(customers.length / slice), 10) }).map((_, index) => {
                            const pageNumber = index + 1;
                            return (
                                start === pageNumber ? (
                                    <div key={pageNumber} className="mx-1">
                                        {pageNumber}
                                    </div>
                                ) : (
                                    <div
                                        key={pageNumber}
                                        className="mx-1"
                                        style={{ textDecoration: 'underline', cursor: 'pointer' }}
                                        onClick={() => setStart(pageNumber)}
                                    >
                                        {pageNumber}
                                    </div>
                                )
                            );
                        })}
                    </div>
                    <div style={{ overflowX: 'scroll' }}>
                        <Table style={{ fontSize: '12px', textAlign: 'center' }} bordered striped className='list_table'>
                            <thead>
                                <tr>
                                    <td>No</td>
                                    <td>顧客名</td>
                                    <td>担当営業</td>
                                    <td>最終アクション日時</td>
                                    <td>架電状況</td>
                                    <td>ステータス</td>
                                    <td>顧客種別</td>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.slice(slice * (start) - slice, slice * (start)).map((item, index) =>
                                    <tr onClick={() => setDetail(item.id_related)} style={{ cursor: 'pointer' }}
                                        className={detail === item.id_related ? 'table-primary' : ''}>
                                        <td>{index + 1 + slice * (start - 1)}</td>
                                        <td style={{ letterSpacing: '1px' }}>{item.name}</td>
                                        <td>{item.staff}</td>
                                        <td>{item.action.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date}</td>
                                        <td>{item.action.map(item => item.method).includes('電話(掛)') ? '架電済み' : '未架電'}</td>
                                        <td>{item.status}</td>
                                        <td>{item.case}</td>
                                    </tr>
                                )}

                            </tbody>
                        </Table>
                    </div>
                </div>
                <div
                    className="divider"
                    onMouseDown={() => {
                        isResizing.current = true;
                    }}
                />
                <div className="p-3 bottom_content" style={{ fontSize: '13px' }}>
                    {detail === '' ? <div className='mb-3'>顧客を選択してください</div> :
                        <>
                            <div className="d-md-flex">
                                <div className="bottom_left">
                                    <div className='m-1'>{actionDetail.name} 様 応対履歴</div>
                                    <div className="d-flex flex-wrap">
                                        <div className="m-1">
                                            <input type="date" className='target'
                                                value={action.date}
                                                onChange={(e) => setAction(prev => ({ ...prev, date: e.target.value }))} />
                                        </div>
                                        <div className="m-1">
                                            <input type="time" className='target'
                                                value={action.time}
                                                onChange={(e) => setAction(prev => ({ ...prev, time: e.target.value }))} />
                                        </div>
                                        <div className="m-1">
                                            <select className='target'
                                                value={action.method}
                                                onChange={(e) => setAction(prev => ({ ...prev, method: e.target.value }))}>
                                                <option value="">アクション内容を選択</option>
                                                <option value="メール(受信)">メール(受信)</option>
                                                <option value="メール(送信)">メール(送信)</option>
                                                <option value="電話(受)">電話(受)</option>
                                                <option value="電話(掛)">電話(掛)</option>
                                                <option value="FAX(受信)">FAX(受信)</option>
                                                <option value="FAX(送信)">FAX(送信)</option>
                                                <option value="郵送">郵送</option>
                                                <option value="SMS送信">SMS送信</option>
                                            </select>
                                        </div>
                                        <div className="m-1">
                                            <input type="text" className='target'
                                                value={action.subject}
                                                onChange={(e) => setAction(prev => ({ ...prev, subject: e.target.value }))}
                                                placeholder='件名を入力' />
                                        </div>
                                        <div className="m-1">
                                            <textarea className='target textarea' rows={4}
                                                value={action.note}
                                                onChange={(e) => setAction(prev => ({ ...prev, note: e.target.value }))}
                                                placeholder='応対履歴を入力'></textarea>
                                        </div>
                                        <div className="m-1">
                                            <div className='bg-primary p-2 rounded text-white text-center' style={{ cursor: 'pointer', border: 'none', fontSize: '10px', width: '100px' }}
                                                onClick={() => addAction(detail)}>アクション追加</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bottom_right">
                                    <Table striped bordered>
                                        <tbody>
                                            {[...actionDetail.action]
                                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                                .map((item, index) => (
                                                    <tr key={index}>
                                                        <td style={{ whiteSpace: 'pre-wrap' }}>
                                                            アクション履歴{index + 1}
                                                            <br /><br />
                                                            {item.date}
                                                            <br />
                                                            {item.method}
                                                            <br />
                                                            {item.subject}
                                                            <br />
                                                            {item.note.replace(/<br>/g, '\n')}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>

                        </>}
                </div>
            </div>
        </>
    )
}

export default Spec