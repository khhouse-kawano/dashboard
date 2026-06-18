import React, { useEffect, useState, useContext, useRef } from 'react';
import Modal from 'react-bootstrap/Modal';
import axios from 'axios';
import { headers } from '../../utils/headers';
import Table from "react-bootstrap/Table";
import { databaseList } from '../../utils/databaseList';
import { baseURL } from '../../utils/baseURL';
import FamilyInfo from '../FamilyInfo';
import { generateULID } from '../../utils/createULID';
import AuthContext from '../../context/AuthContext';

type Staff = { name: string; shop: string; category: number, section: string };
type Customer = Record<string, string>;
type Medium = { id: number; medium: string, list_medium: number };
type InterviewLog = {
    id: string,
    shop: string,
    name: string,
    interview_log: InterviewAction[],
    add: Boolean
};
type InterviewAction = {
    day: string;
    action: string;
    note: string;
    staff: string;
};
type CallAction = {
    day: string;
    time: string;
    action: string;
    note: string;
    staff: string
};
type CallLog = {
    id: string;
    shop: string;
    staff: string;
    name: string;
    status: string;
    reserved_status: string;
    call_log: CallAction[];
    add: Boolean;
};
type Shop = {
    shop: string,
    section: string
};
type Expand = {
    interview: boolean,
    call: boolean,
    remarks: boolean,
    reason: boolean,
    trigger: boolean
};

type Props = {
    id: string,
    token: string,
    onClose: () => void,
    brand: string
};

const InformationEditResale = ({ id, token, onClose, brand }: Props) => {
    const { userName } = useContext(AuthContext);
    const [shopArray, setShopArray] = useState<string[]>([]);
    const [information, setInformation] = useState<Customer>({});
    const [staffArray, setStaffArray] = useState<Staff[]>([]);
    const [mediumArray, setMediumArray] = useState<Medium[]>([]);
    const [interviewLog, setInterviewLog] = useState<InterviewLog>({
        id: '',
        shop: '',
        name: '',
        interview_log: [],
        add: false
    });
    const [interview, setInterview] = useState<InterviewAction>({
        day: '',
        action: '',
        note: '',
        staff: ''
    });
    const [call, setCall] = useState({
        status: '',
        day: '',
        time: '',
        action: '',
        note: '',
        staff: ''
    });
    const [callLog, setCallLog] = useState<CallLog>({
        id: '',
        shop: '',
        staff: '',
        name: '',
        status: '',
        reserved_status: '',
        call_log: [],
        add: false
    });
    const [interviewer, setInterviewer] = useState('');
    const [familyModalShow, setFamilyMShow] = useState(false);
    const [sending, setSending] = useState(true);
    const [expand, setExpand] = useState<Expand>({
        interview: false,
        call: false,
        remarks: false,
        reason: false,
        trigger: false
    });
    const propertyRef = useRef<HTMLInputElement>(null);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const today = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const thisMonth = `${year}-${String(month).padStart(2, '0')}`;
    const thisYear = now.getMonth() <= 4 ? year : year + 1;
    const [propertyInput, setPropertyInput] = useState('');
    const [originalPropertyList, setOriginalPropertyList] = useState<string[]>([]);
    const [propertyList, setPropertyList] = useState<string[]>([]);
    const categoryList = ['買い:ポータル', '売り:ポータル', '買い:中古リノベ'];

    const safeParse = (data: any) => {
        if (typeof data !== 'string' || data.trim() === '') return data ?? [];
        try {
            return JSON.parse(data);
        } catch (e) {
            console.error("JSONの解析に失敗しました。不正なデータです:", data);
            return [];
        }
    };


    useEffect(() => {
        if (!id) return;

        setInterviewer(userName);
        if (id === 'new') {
            setInformation(prev => ({
                step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: today,
                id: generateULID()
            }));

            setSending(true)
            const fetchData = async () => {
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: "informationEditResale_add_customer" }, { headers });
                setShopArray(categoryList);
                await setStaffArray(response.data.staff.filter(s => s.category === 1 && s.period === String(thisYear)));
                setMediumArray(response.data.medium);
                setOriginalPropertyList(response.data.property.filter(p => p.in_charge_store = '国分ハウジンググループ中古住宅専門店').map(p => p.property_name));
            };
            fetchData();
        } else {
            setSending(true)
            const fetchData = async () => {
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: "informationEditResale_edit_customer", id: id }, { headers });
                setShopArray(categoryList);
                await setStaffArray(response.data.staff.filter(s => s.category === 1 && s.period === String(thisYear)));
                setMediumArray(response.data.medium);
                setInformation(response.data.customer);
                setOriginalPropertyList(response.data.property.filter(p => p.in_charge_store = '国分ハウジンググループ中古住宅専門店').map(p => p.property_name));

                const callResData = {
                    id: response.data.call.id ?? response.data.customer.id,
                    shop: response.data.call.shop ?? response.data.customer.in_charge_store,
                    staff: userName,
                    name: response.data.call.name ?? response.data.customer.customer_contacts_name,
                    status: response.data.call.status ?? '',
                    reserved_status: response.data.call.reserved_status ?? '',
                    call_log: safeParse(response.data.call.call_log),
                    add: false
                };
                setCallLog(callResData);
                const interviewResData: InterviewLog = {
                    id: response.data.interview.id ?? response.data.customer.id,
                    shop: response.data.interview.shop ?? response.data.customer.in_charge_store,
                    name: response.data.interview.name ?? response.data.customer.customer_contacts_name,
                    interview_log: typeof response.data.interview.interview_log === 'string' && response.data.interview.interview_log.trim() !== ''
                        ? JSON.parse(response.data.interview.interview_log)
                        : response.data.interview.interview_log ?? [],
                    add: false
                };
                setInterviewLog(interviewResData);
            };

            fetchData();
        }
    }, [id]);

    const idMapping = (text: string) => {
        const targetId = databaseList.find(d => d.value === text)?.id ?? '';
        return targetId;
    };

    const toHalfWidth = (str: string) => {
        return str.replace(/[！-～]/g, (s) =>
            String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
        ).replace(/　/g, ' ');
    };

    const actionMap = {
        '初回来場': 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
        '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
        '事前審査': 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
        '物件案内': 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG',
        'リフォーム契約': 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
        '売買契約': 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
        '訪問査定': 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
        '媒介取得': 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0',
    };

    const optionMapping = {
        '買い:中古リノベ': ['初回来場', '2回目以降面談', '物件案内', '事前審査', 'リフォーム契約', '売買契約'],
        '買い:ポータル': ['初回来場', '2回目以降面談', '物件案内', '事前審査', '売買契約'],
        '売り:ポータル': ['査定アポ', '査定書提出', '訪問査定', '媒介取得'],
    }

    const modalClose = () => onClose();

    const familyModalClose = () => {
        setFamilyMShow(false);
    };

    const handleSave = async () => {
        const requiredList = ['customer_contacts_name', 'in_charge_store', 'in_charge_user', 'status', 'sales_promotion_name'];

        if (!information.status) information.status = '見込み';
        if (!information.category) information.category = information.in_charge_store;
        if (!information.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99) information.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 = today;
        for (const key of requiredList) {
            if (!information[key]) {
                const targetLabel = databaseList.find(d => d.id === key)?.value;
                alert(`必須項目が未入力です:${targetLabel}`)
                return;
            }
        }

        await setSending(false);

        let updatedMasterData: any = {
            ...information,
            request: id === 'new' ? 'informationEditResale_add_new_customer' : 'informationEditResale_edit_registered_customer'
        };

        // 面談記録の保存
        let updatedInterviewData;

        const isAddInterview = interview.day && interview.action;

        if (isAddInterview) {
            const key = actionMap[interview.action];
            information[key] = interview.day;
            updatedMasterData = {
                ...information,
                [key]: interview.day,
                request: id === 'new' ? 'informationEditResale_add_new_customer' : 'informationEditResale_edit_registered_customer'
            };
            const newInterviewLog = {
                ...interviewLog,
                id: information.id,
                name: information.customer_contacts_name,
                shop: information.in_charge_store,
                interview_log: [
                    ...interviewLog.interview_log,
                    { day: interview.day, action: interview.action, note: interview.note, staff: userName }
                ]
            };
            updatedInterviewData = {
                ...newInterviewLog,
                request: 'informationEdit_update_interview_log'
            }
        } else {
            updatedInterviewData = {
                ...interviewLog,
                id: information.id,
                name: information.customer_contacts_name,
                shop: information.in_charge_store,
                request: 'informationEdit_update_interview_log'
            }
        }

        if (isAddInterview || interviewLog.add) {
            try {
                await axios.post("https://khg-marketing.info/dashboard/api/gateway/", updatedInterviewData, { headers });
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        }

        // 架電記録の保存
        let updatedCallData;
        let calendarAdd;
        const isAddCallLog = call.day && call.action;
        if (isAddCallLog) {
            const newCallLog = {
                ...callLog,
                call_log: [
                    ...callLog.call_log,
                    { day: call.day, time: call.time ?? '', action: call.action, note: call.note ?? '', staff: interviewer ?? '' }
                ]
            };
            updatedCallData = {
                ...newCallLog,
                id: information.id,
                name: information.customer_contacts_name,
                shop: information.in_charge_store,
                staff: information.in_charge_user,
                request: 'informationEdit_update_call_log',
            };
            calendarAdd = true;
        } else {
            updatedCallData = {
                ...callLog,
                id: information.id,
                name: information.customer_contacts_name,
                shop: information.in_charge_store,
                staff: information.in_charge_user,
                request: 'informationEdit_update_call_log'
            };
            calendarAdd = callLog.add;
        }

        if (callLog.status || isAddCallLog || callLog.add) {
            try {
                await axios.post("https://khg-marketing.info/dashboard/api/gateway/", updatedCallData, { headers });
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        }

        // 顧客情報の保存
        console.log(updatedMasterData);
        try {
            await axios.post("https://khg-marketing.info/dashboard/api/gateway/", updatedMasterData, { headers });
        } catch (error) {
            console.error("データ取得エラー:", error);
        }

        const callLogs = updatedCallData.call_log;
        const hasCallLog = callLogs && callLogs.length > 0;
        const lastLog = hasCallLog ? callLogs[callLogs.length - 1] : null;

        if (brand === 'insideSales' && calendarAdd && lastLog && lastLog.time) {
            const pad = (num: number): string => String(num).padStart(2, '0');

            const parseDateAndTime = (dateStr: string, timeStr: string): Date => {
                const [year, month, day] = dateStr.split('-').map(Number);
                const [hours, minutes] = timeStr.split(':').map(Number);
                return new Date(year, month - 1, day, hours, minutes, 0);
            };

            const formatLocalISO = (d: Date): string => {
                const year = d.getFullYear();
                const month = pad(d.getMonth() + 1);
                const day = pad(d.getDate());
                const hours = pad(d.getHours());
                const minutes = pad(d.getMinutes());
                const seconds = pad(d.getSeconds());
                return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
            };

            const lastLog = updatedCallData.call_log[updatedCallData.call_log.length - 1];
            const startDate = parseDateAndTime(lastLog.day, lastLog.time);
            const endDate = new Date(startDate.getTime() + 10 * 60000); // 10分後

            const data = {
                name: callLog.name,
                detail: `${lastLog.action}\n${lastLog.note}`,
                startTime: formatLocalISO(startDate),
                endTime: formatLocalISO(endDate)
            };

            const fetchCallData = async () => {
                try {

                    await axios.post(`${baseURL}/api/add_event`, data, { headers });
                } catch (error) {
                    console.error("データ取得エラー:", error);
                }
            };
            await fetchCallData();
        }

        setInformation(prev =>
            Object.fromEntries(
                Object.keys(prev).map(key => [key, ''])
            )
        );
        await setInterview({
            day: '',
            action: '',
            note: '',
            staff: ''
        });
        await setCall({
            status: '',
            day: '',
            time: '',
            action: '',
            note: '',
            staff: ''
        });
        modalClose();
    };

    const baseStyle = { border: '1px solid #D3D3D3', borderRadius: '4px', height: '35px', width: '150px', paddingLeft: '10px', color: '#303030' };
    const labelStyle = { color: '#303030', fontSize: '11px', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' };
    const buttonStyle = {
        color: '#495057',                  // 入力欄の文字色(#303030)より少しだけ柔らかい色に
        backgroundColor: '#f8f9fa',        // 真っ白ではなく、ごく薄いグレーにして入力欄と区別
        border: '1px solid #d2d6da',       // 枠線も少しだけトーンを変える
        borderRadius: '6px',               // 入力欄(4px)より少しだけ丸くする
        padding: '0 16px',                 // 左右の余白を少し広めに
        fontSize: '11px',
        fontWeight: '600',                 // ほんの少し太字にしてボタンらしさを強調
        letterSpacing: '0.6px',
        marginBottom: '4px',
        cursor: 'pointer',
        height: '35px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)', // 影をほんの少しだけ濃くして立体感を出す
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',          // 文字を左右中央に
        width: 'fit-content'
    };
    const valueStyle = { fontSize: '12px', letterSpacing: '.6px', verticalAlign: 'middle' };
    const inputStyle = { ...baseStyle, margin: '5px', color: '#303030' };
    const selectStyle = { ...baseStyle };
    const requiredStyle = { border: '1px solid #9b9b9b', borderRadius: '4px', color: '#303030', padding: '3px 5px', marginLeft: '5px' };
    const expandStyle = (key: string) => {
        return {
            padding: key === 'interview' || key === 'call' ? '15px' : '0',
            border: key === 'interview' || key === 'call' ? '1px solid #dddddda9' : 'transparent',
            borderRadius: '7px',
            height: expand[key] ? 'auto' : '80px',
            opacity: expand[key] ? '1' : '.3',
            overflowY: 'hidden' as const
        }
    };
    const expandButton = {
        ...buttonStyle,
        padding: '2px 10px'
    };
    const actionButton = { ...buttonStyle, padding: '6px', marginLeft: '5px' };

    const calculateAge = (birthDateString: string) => {
        if (!birthDateString) return "";

        const today = new Date();
        const birthDate = new Date(birthDateString);

        let age = today.getFullYear() - birthDate.getFullYear();

        const monthDifference = today.getMonth() - birthDate.getMonth();

        if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        return age;
    };
    const handleClose = () => {
        setInterviewLog({
            id: '',
            shop: '',
            name: '',
            interview_log: [],
            add: false
        });
        setInterview({
            day: '',
            action: '',
            note: '',
            staff: ''
        });
        setCall({
            status: '',
            day: '',
            time: '',
            action: '',
            note: '',
            staff: ''
        });
        setCallLog({
            id: '',
            shop: '',
            staff: '',
            name: '',
            status: '',
            reserved_status: '',
            call_log: [],
            add: false
        });
        setInterviewer('');

        setExpand({
            interview: false,
            call: false,
            remarks: false,
            reason: false,
            trigger: false
        });

        setInformation({});
    };

    const competitorsStyle = {
        border: 'transparent',
        minWidth: '60px',
        maxWidth: '100%',
        flex: '1',
        outline: 'none',
        boxShadow: 'none'
    };

    const handleProperty = (property?: string) => {
        if (property) {
            setInformation(prev => {
                const existing = safeFormate(prev.property_name)
                    .split(',')
                    .map(s => s.trim())
                    .filter(s => s !== '' && s !== 'null');
                const newArr = existing.concat(property);
                return {
                    ...prev,
                    property_name: newArr.length ? newArr.join(',') : ''
                }
            });
            if (propertyRef.current) propertyRef.current.value = '';
            setPropertyInput('');
            return;
        }
        const value = propertyRef.current?.value?.trim();
        if (!value) return;
        setInformation(prev => {
            const existing = (prev.competitors_text ?? '')
                .split(',')
                .map(s => s.trim())
                .filter(s => s !== '' && s !== 'null');
            const newArr = existing.concat(value);
            return {
                ...prev,
                property_name: newArr.length ? newArr.join(',') : ''
            }
        });
        setPropertyInput('');
        if (propertyRef.current) propertyRef.current.value = '';
    };

    const handlePropertyDelete = () => {
        if (propertyRef.current && propertyRef.current.value.length > 0) return;
        if (!information.property_name) return;
        setInformation(prev => {
            const existing = safeFormate(prev.property_name)
                .split(',')
                .map(s => s.trim())
                .filter(s => s !== '' && s !== 'null');
            existing.pop();
            return {
                ...prev,
                property_name: existing.length ? existing.join(',') : ''
            }
        });
    };

    useEffect(() => {
        const filtered = originalPropertyList.filter(o => o.includes(propertyInput));
        setPropertyList(filtered);
    }, [originalPropertyList, propertyInput]);

    const safeFormate = (value: string) => {
        return value ?? '';
    };

    const dateFormate = (value: string) => {
        return value ? value.replace(/\//g, '-') : '';
    };

    return (
        <>
            <Modal
                show={!!id}
                size='xl'
                onHide={() => {
                    modalClose();
                    handleClose();
                }}
            >
                <Modal.Header closeButton><div style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 'bold' }}>{id === 'new' ? <div>新規顧客登録 <span className='text-danger'>※は入力必須</span></div> : `${information.in_charge_store ?? ''} ${information.customer_contacts_name ?? ''}様`}</div></Modal.Header>
                <Modal.Body>
                    <div style={{ height: '78vh', overflowY: 'scroll', overflowX: 'scroll' }}>
                        <div style={{ minWidth: '1000px' }}>
                            <Table responsive style={{ fontSize: '11px', textAlign: 'left' }} className='list_table database'>
                                <tbody>
                                    <tr>
                                        <td style={{ ...labelStyle, width: '10%' }}>お客様名<span style={requiredStyle}>必須</span></td>
                                        <td style={{ ...valueStyle, width: '40%' }}>
                                            <input type='text' placeholder='漢字' style={inputStyle} value={safeFormate(information[idMapping('お客様名')])}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            [idMapping('お客様名')]: e.target.value
                                                        }
                                                    ));
                                                }} />
                                            <input type='text' placeholder='ふりがな' style={inputStyle} value={safeFormate(information[idMapping('名前（かな）')])}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            [idMapping('名前（かな）')]: e.target.value
                                                        }
                                                    ));
                                                }} />
                                        </td>
                                        <td style={{ ...labelStyle, width: '10%' }}>連絡先</td>
                                        <td style={{ ...valueStyle, width: '40%' }}>
                                            <input type='text' placeholder='固定電話' style={{ ...inputStyle, width: '100px' }} value={safeFormate(information.customer_contacts_phone_number)}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customer_contacts_phone_number: e.target.value
                                                        }
                                                    ));
                                                }}
                                                onBlur={(e) => {
                                                    const halfValue = toHalfWidth(e.target.value);
                                                    const numericOnly = halfValue.replace(/[^0-9-]/g, '');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customer_contacts_phone_number: numericOnly
                                                        }
                                                    ));
                                                }} />
                                            <input type='text' placeholder='携帯電話' style={{ ...inputStyle, width: '100px' }} value={safeFormate(information.customer_contacts_mobile_phone_number)}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customer_contacts_mobile_phone_number: e.target.value
                                                        }
                                                    ));
                                                }}
                                                onBlur={(e) => {
                                                    const halfValue = toHalfWidth(e.target.value);
                                                    const numericOnly = halfValue.replace(/[^0-9-]/g, '');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customer_contacts_mobile_phone_number: numericOnly
                                                        }
                                                    ));
                                                }} />
                                            <input type='text' placeholder='メールアドレス' style={inputStyle} value={safeFormate(information.customer_contacts_email)}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customer_contacts_email: e.target.value
                                                        }
                                                    ));
                                                }} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>住所</td>
                                        <td style={valueStyle}>
                                            <input type='text' placeholder='郵便番号' style={{ ...inputStyle, width: '80px' }} value={safeFormate(information.postal_code)}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            postal_code: e.target.value
                                                        }
                                                    ));
                                                }}
                                                onBlur={(e) => {
                                                    const halfValue = toHalfWidth(e.target.value);
                                                    const numericOnly = halfValue.replace(/[^0-9.,-]/g, '');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            postal_code: numericOnly
                                                        }
                                                    ));
                                                }} />
                                            <input type='text' placeholder='住所' style={{ ...inputStyle, width: '300px' }} value={safeFormate(information.full_address)}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            full_address: e.target.value
                                                        }
                                                    ));
                                                }} />
                                        </td>
                                        <td style={labelStyle}>担当店舗<span style={requiredStyle}>必須</span></td>
                                        <td style={valueStyle}>
                                            <select
                                                style={selectStyle}
                                                value={safeFormate(information[idMapping('担当店舗')])}
                                                onChange={(e) => {
                                                    const selected = staffArray.find(item => item.shop === e.target.value);
                                                    setInformation(prev => ({
                                                        ...prev,
                                                        [idMapping('担当店舗')]: e.target.value
                                                    }));
                                                }}
                                            >
                                                <option value=''>担当店舗を選択</option>
                                                {shopArray
                                                    .map((item, index) => (
                                                        <option key={index} value={item}>
                                                            {item}
                                                        </option>
                                                    ))}
                                            </select>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>担当営業<span style={requiredStyle}>必須</span></td>
                                        <td style={valueStyle}>
                                            <select
                                                style={selectStyle}
                                                value={safeFormate(information[idMapping('担当営業')])}
                                                onChange={(e) => {
                                                    setInformation(prev => ({
                                                        ...prev,
                                                        [idMapping('担当営業')]: e.target.value,
                                                    }));
                                                }}
                                            >
                                                <option value=''>担当営業を選択</option>
                                                <option value='中専鹿児島店 店舗管理'>中専鹿児島店 店舗管理</option>
                                                {staffArray
                                                    .filter(item => item.shop === '中専鹿児島店')
                                                    .map((item, index) => (
                                                        <option key={index} value={item.name}>
                                                            {item.name}
                                                        </option>
                                                    ))}
                                            </select>
                                        </td>
                                        <td style={labelStyle}>ステータス</td>
                                        <td style={valueStyle}>
                                            <select style={inputStyle} value={safeFormate(information[idMapping('ステータス')])}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            [idMapping('ステータス')]: e.target.value
                                                        }
                                                    ));
                                                }}>
                                                <option value='見込み' selected={information[idMapping('ステータス')] === ''}>見込み</option>
                                                <option value='会社管理'>会社管理</option>
                                                <option value='失注'>失注</option>
                                                <option value='重複'>重複</option>
                                                <option value='契約済み'>契約済み</option>
                                                <option value='解約'>解約</option>
                                            </select>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>顧客ランク<br />(契約見込み月)</td>
                                        <td style={valueStyle}>
                                            <div className="d-flex">
                                                <select style={inputStyle} value={safeFormate(information[idMapping('顧客ランク')])}
                                                    onChange={(e) => {
                                                        setInformation(prev => (
                                                            {
                                                                ...prev,
                                                                [idMapping('顧客ランク')]: e.target.value
                                                            }
                                                        ));
                                                    }}>
                                                    <option value="">選択してください</option>
                                                    <option value='Sランク'>Sランク</option>
                                                    <option value='Aランク'>Aランク</option>
                                                    <option value='Bランク'>Bランク</option>
                                                    <option value='Cランク'>Cランク</option>
                                                    <option value='Dランク'>Dランク</option>
                                                    <option value='Eランク'>Eランク</option>
                                                </select>
                                                <input type="month" style={{ ...inputStyle, width: '100px' }}
                                                    value={information.rank_period && information.rank_period >= thisMonth ? information.rank_period.replace(/\//g, '-') : thisMonth}
                                                    onChange={(e) => {
                                                        const formattedMonth = e.target.value.replace(/-/g, '/');
                                                        setInformation(prev => (
                                                            {
                                                                ...prev,
                                                                rank_period: formattedMonth
                                                            }
                                                        ));
                                                    }} />
                                            </div>
                                        </td>
                                        <td style={labelStyle}>反響媒体<span style={requiredStyle}>必須</span></td>
                                        <td style={valueStyle}>
                                            <select style={inputStyle} value={safeFormate(information[idMapping('反響媒体')])}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            [idMapping('反響媒体')]: e.target.value
                                                        }
                                                    ));
                                                }}>
                                                <option value=''>反響媒体を選択</option>
                                                {mediumArray.map((item, index) =>
                                                    <option key={index} value={item.medium}>{item.medium}</option>
                                                )}
                                            </select>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>家族情報</td>
                                        <td style={valueStyle}><div style={buttonStyle}
                                            onClick={() => setFamilyMShow(true)}>入力・確認</div></td>
                                        <td style={labelStyle}>生年月日</td>
                                        <td style={valueStyle}>
                                            <div className="d-flex align-items-center">
                                                <input type='date' style={inputStyle}
                                                    value={dateFormate(information.customer_contacts_birth_date)}
                                                    onChange={(e) => {
                                                        setInformation(prev => (
                                                            {
                                                                ...prev,
                                                                customer_contacts_birth_date: e.target.value
                                                            }
                                                        ));
                                                    }}
                                                />
                                                {information.customer_contacts_birth_date && <div className="ms-2">({calculateAge(information.customer_contacts_birth_date)}歳)</div>}
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>物件連携</td>
                                        <td style={valueStyle}>
                                            <div className="text-secondary" style={{ fontSize: '10px' }}>※リストをクリックして選択</div>
                                            <div className="d-flex align-items-center">
                                                <div className="d-flex flex-wrap align-items-center position-relative" style={{ ...inputStyle, width: '80%', }}>
                                                    {information.property_name &&
                                                        information.property_name.split(',')
                                                            .filter(c => c !== 'null')
                                                            .map((c, cIndex) =>
                                                                <div className='me-1 bg-warning rounded ps-2 pe-1 d-flex align-items-center' key={cIndex}>{c}
                                                                    <span className='ms-1'
                                                                        style={{ fontSize: '8px', cursor: 'pointer' }}
                                                                        onClick={() => {
                                                                            setInformation(prev => {
                                                                                const arr = safeFormate(prev.property_name)
                                                                                    .split(',')
                                                                                    .map(s => s.trim())
                                                                                    .filter(s => s !== '' && s !== 'null');

                                                                                arr.splice(cIndex, 1);
                                                                                if (!arr[0]) {
                                                                                    arr.slice(1);
                                                                                }

                                                                                return {
                                                                                    ...prev,
                                                                                    property_name: arr.length ? arr.join(',') : ''
                                                                                }
                                                                            }
                                                                            )
                                                                        }}>
                                                                        ×
                                                                    </span></div>)}
                                                    <input type='text' style={competitorsStyle} ref={propertyRef}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Backspace') {
                                                                handlePropertyDelete();
                                                            }
                                                        }}
                                                        onChange={(e) => setPropertyInput(e.target.value)} />
                                                    <div className="position-absolute bg-white"
                                                        style={{ top: '25px', zIndex: '1000' }}>
                                                        {propertyInput &&
                                                            propertyList
                                                                .map((m, mIndex) =>
                                                                    <div key={mIndex}
                                                                        style={{ cursor: 'pointer', width: 'fit-content' }}
                                                                        className='bg-warning px-2 rounded mb-1'
                                                                        onClick={() => handleProperty(m)}
                                                                    >{m}</div>)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ ...labelStyle, width: '60px' }}>予定地</td>
                                        <td style={valueStyle}>
                                            <input type='text' placeholder='予定地' style={inputStyle} value={safeFormate(information.planned_construction_site)}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            planned_construction_site: e.target.value
                                                        }
                                                    ));
                                                }} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>
                                            <div className="position-relative">
                                                商談ステップ
                                                <div className='position-absolute'
                                                    style={expandButton}
                                                    onClick={() => {
                                                        setExpand(prev =>
                                                        ({
                                                            ...prev,
                                                            interview: !prev.interview
                                                        })
                                                        );
                                                    }}>{expand.interview ? '×閉じる' : '編集'}</div>
                                            </div>
                                        </td>
                                        <td colSpan={3}>
                                            <div style={expandStyle('interview')}>
                                                <div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                                    <div className="">
                                                        <input type="date" value={dateFormate(information.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99)}
                                                            style={inputStyle}
                                                            onChange={(e) => {
                                                                setInformation(prev => (
                                                                    {
                                                                        ...prev,
                                                                        step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: e.target.value
                                                                    }
                                                                ));
                                                            }} />
                                                    </div>
                                                    <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                                        <select style={inputStyle} disabled>
                                                            <option value="">反響取得</option>
                                                        </select>
                                                    </div>
                                                    <div className="ms-2">
                                                        {information.sales_promotion_name}からの反響取得</div>
                                                    {information.reserved_interview && <div className="ms-3 d-flex align-items-center">
                                                        <div className="">来場予約日</div>
                                                        <div className="">
                                                            <input type="date" value={dateFormate(information.reserved_interview)}
                                                                style={inputStyle}
                                                                onChange={(e) => {
                                                                    setInformation(prev => (
                                                                        {
                                                                            ...prev,
                                                                            reserved_interview: e.target.value
                                                                        }
                                                                    ));
                                                                }} />
                                                        </div>
                                                    </div>}
                                                </div>
                                                <div style={{ color: '#868686ff', marginBottom: '7px' }}>
                                                    <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <i className="fa-solid fa-file-pen"></i>
                                                    </div>
                                                    <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                                </div>
                                                {interviewLog.interview_log &&
                                                    interviewLog.interview_log
                                                        .sort((a, b) => {
                                                            const dayA = new Date(a.day).getTime();
                                                            const dayB = new Date(b.day).getTime();
                                                            return dayA - dayB;
                                                        })
                                                        .map((item, index) => <><div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                                            <div className="">
                                                                <input type="date" value={dateFormate(item.day)} style={inputStyle}
                                                                    onChange={(e) => {
                                                                        setInterviewLog(prev => ({
                                                                            ...prev,
                                                                            add: true,
                                                                            interview_log: prev.interview_log.map((log, i) => i === index ?
                                                                                { ...log, day: e.target.value } : log)
                                                                        }));
                                                                        const key = actionMap[item.action];
                                                                        if (key) {
                                                                            setInformation(prev => ({
                                                                                ...prev,
                                                                                [key]: e.target.value
                                                                            }));
                                                                        }
                                                                    }} />
                                                            </div>
                                                            <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                                                <div>
                                                                    <select style={inputStyle}
                                                                        onChange={(e) => {
                                                                            const formattedValue = e.target.value.includes('物件案内') ? '物件案内' : e.target.value;
                                                                            setInterviewLog(prev => ({
                                                                                ...prev,
                                                                                add: true,
                                                                                interview_log: prev.interview_log.map((log, i) => i === index ?
                                                                                    { ...log, action: e.target.value } : log)
                                                                            }));
                                                                            const key = actionMap[formattedValue];
                                                                            if (key) {
                                                                                setInformation(prev => ({
                                                                                    ...prev,
                                                                                    [key]: item.day
                                                                                }));
                                                                            }
                                                                            if (formattedValue === '物件案内') {
                                                                                const property = e.target.value.split(',')[1];
                                                                                const newArray = information.property_tour_name ? information.property_tour_name.split(',') : []; setInformation(prev => ({
                                                                                    ...prev,
                                                                                    property_tour_name: [...newArray, property].join(',')
                                                                                }))
                                                                            }
                                                                        }}
                                                                        value={item.action.includes('物件案内') ? '物件案内' : safeFormate(item.action)}>
                                                                        <option value="">アクション内容</option>
                                                                        {(optionMapping[information.in_charge_store] || []).map(item =>
                                                                            <option value={item} key={item}>{item}</option>
                                                                        )}
                                                                        {information.property_name && information.property_name.split(',').map((property, pIndex) =>
                                                                            <option value={`物件案内,${property}`} key={pIndex}>物件案内({property})</option>)}
                                                                    </select>
                                                                </div>
                                                                {item.action.includes('物件案内') && <div className="bg-warning fw-normal px-2 rounded ms-1"
                                                                    style={{ width: 'fit-content', maxWidth: '150px' }}>{item.action.split(',')[1]}</div>}
                                                            </div>
                                                            <div className="">
                                                                <textarea style={{ ...inputStyle, width: '550px', height: 'auto' }} placeholder='面談内容を記載' value={item.note} rows={Math.max(2, item.note.length / 50)}
                                                                    onChange={(e) => setInterviewLog(prev => ({
                                                                        ...prev,
                                                                        add: true,
                                                                        interview_log: prev.interview_log.map((log, i) => i === index ?
                                                                            { ...log, note: e.target.value } : log)
                                                                    }))}></textarea>
                                                            </div>
                                                            <div className="text-danger" style={actionButton}
                                                                onClick={() => {
                                                                    const key = actionMap[item.action];
                                                                    setInformation(prev => ({
                                                                        ...prev,
                                                                        [key]: ''
                                                                    }));
                                                                    setInterviewLog(prev => ({
                                                                        ...prev,
                                                                        add: true,
                                                                        interview_log: prev.interview_log.filter((_, i) => i !== index)
                                                                    }));
                                                                }}>削除</div>
                                                        </div>
                                                            <div style={{ color: '#868686ff', marginBottom: '7px' }}>
                                                                <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <i className="fa-solid fa-file-pen"></i>
                                                                </div>
                                                                <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                                            </div>
                                                        </>)}
                                                <div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                                    <div className="">
                                                        <input type="date" style={inputStyle} value={dateFormate(interview.day)}
                                                            onChange={(e) => setInterview(prev => ({
                                                                ...prev,
                                                                day: e.target.value
                                                            }))} />
                                                    </div>
                                                    <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                                        <select style={inputStyle}
                                                            onChange={(e) => {
                                                                const formattedValue = e.target.value.includes('物件案内') ? '物件案内' : e.target.value;
                                                                setInterview(prev => ({
                                                                    ...prev,
                                                                    action: e.target.value,
                                                                    note: e.target.value === '契約' ? '契約' : prev.note
                                                                }));
                                                                const key = actionMap[formattedValue];
                                                                if (key) {
                                                                    setInformation(prev => ({
                                                                        ...prev,
                                                                        [key]: interview.day
                                                                    }));
                                                                }
                                                                if (formattedValue === '物件案内') {
                                                                    const property = e.target.value.split(',')[1];
                                                                    const newArray = information.property_tour_name ? information.property_tour_name.split(',') : [];
                                                                    setInformation(prev => ({
                                                                        ...prev,
                                                                        property_tour_name: [...newArray, property].join(',')
                                                                    }))
                                                                }
                                                            }}>
                                                            <option value="">アクション内容</option>
                                                            {(optionMapping[information.in_charge_store] || []).map(item =>
                                                                <option value={item} key={item}>{item}</option>
                                                            )}
                                                            {information.property_name && information.property_name.split(',').map((property, pIndex) =>
                                                                <option value={`物件案内,${property}`} key={pIndex}>物件案内({property})</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="">
                                                        <textarea value={interview.note} style={{ ...inputStyle, width: '550px', height: 'auto' }} placeholder='面談内容を記載'
                                                            onChange={(e) => setInterview(prev => ({
                                                                ...prev,
                                                                note: e.target.value
                                                            }))} ></textarea></div>
                                                    <div className="text-primary" style={actionButton}
                                                        onClick={() => {
                                                            if (!interview.day || !interview.action) {
                                                                alert('未入力の項目があります');
                                                                return;
                                                            };
                                                            setInterviewLog(prev => ({
                                                                ...prev,
                                                                id: information.id,
                                                                name: information.customer_contacts_name,
                                                                status: information.call_status,
                                                                interview_log: [
                                                                    ...prev.interview_log,
                                                                    { day: interview.day, action: interview.action, note: interview.note, staff: userName }
                                                                ],
                                                                add: true
                                                            }));
                                                            const key = actionMap[interview.action];
                                                            if (key && !information[key]) {
                                                                setInformation(prev => ({
                                                                    ...prev,
                                                                    [key]: interview.day
                                                                }));
                                                            }
                                                            setInterview({
                                                                day: '', action: '', note: '', staff: ''
                                                            });
                                                        }
                                                        }>追加</div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>
                                            <div className="position-relative">
                                                架電状況
                                                <div className='position-absolute'
                                                    style={expandButton}
                                                    onClick={() => {
                                                        setExpand(prev =>
                                                        ({
                                                            ...prev,
                                                            call: !prev.call
                                                        })
                                                        );
                                                    }}>{expand.call ? '×閉じる' : '編集'}</div>
                                            </div>
                                        </td>
                                        <td colSpan={3}>
                                            <div style={expandStyle('call')}>
                                                <div className="d-flex align-items-center mb-2">
                                                    <div style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>架電ステータス</div>
                                                    <div style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>
                                                        <select style={inputStyle}
                                                            onChange={(e) => {
                                                                setInformation(prev => (
                                                                    {
                                                                        ...prev,
                                                                        call_status: e.target.value
                                                                    }
                                                                ));
                                                                setCallLog(prev => ({
                                                                    ...prev,
                                                                    status: e.target.value
                                                                }));
                                                            }}
                                                            value={information.call_status}>
                                                            <option value="">架電ステータスを選択</option>
                                                            <option value="未通電">未通電</option>
                                                            <option value="継続">継続</option>
                                                            <option value="来場アポ">来場アポ</option>
                                                            <option value="来場済み">来場済み</option>
                                                            <option value="架電停止">架電停止</option>
                                                        </select>
                                                    </div>
                                                    <div style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>来場予定日</div>
                                                    <div style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>
                                                        <input type="date" style={inputStyle} value={callLog.reserved_status ? callLog.reserved_status : ''}
                                                            onChange={(e) => setCallLog(prev => ({
                                                                ...prev,
                                                                reserved_status: e.target.value
                                                            }))} />
                                                    </div>
                                                </div>
                                                <div style={{ padding: '15px', border: '1px solid #dddddda9', borderRadius: '7px' }}>
                                                    {callLog.call_log &&
                                                        callLog.call_log
                                                            .sort((a, b) => {
                                                                const dayA = new Date(a.day).getTime();
                                                                const dayB = new Date(b.day).getTime();
                                                                return dayA - dayB
                                                            })
                                                            .map((item, index) => <><div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                                                <div className="">
                                                                    <input type="date" value={item.day} style={inputStyle}
                                                                        onChange={(e) => setCallLog(prev => ({
                                                                            ...prev,
                                                                            call_log: prev.call_log.map((log, i) => i === index ?
                                                                                { ...log, day: e.target.value, staff: interviewer } : log)
                                                                        }))} />
                                                                </div>
                                                                <div className="">
                                                                    <input type="time" value={item.time} style={inputStyle}
                                                                        onChange={(e) => setCallLog(prev => ({
                                                                            ...prev,
                                                                            call_log: prev.call_log.map((log, i) => i === index ?
                                                                                { ...log, time: e.target.value, staff: interviewer } : log)
                                                                        }))} />
                                                                </div>
                                                                <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                                                    <select style={inputStyle} value={item.action}
                                                                        onChange={(e) => setCallLog(prev => ({
                                                                            ...prev,
                                                                            call_log: prev.call_log.map((log, i) => i === index ?
                                                                                { ...log, action: e.target.value, staff: interviewer } : log)
                                                                        }))}>
                                                                        <option value="">アクション内容</option>
                                                                        <option value="架電">架電</option>
                                                                        <option value="SMS送信">SMS送信</option>
                                                                        <option value="メール送信">メール送信</option>
                                                                        <option value="資料郵送">資料郵送</option>
                                                                        <option value="次回架電日">次回架電日</option>
                                                                    </select>
                                                                </div>
                                                                <div className="">
                                                                    <textarea style={{ ...inputStyle, width: '360px', height: 'auto' }} placeholder='アクション内容・ヒアリング内容を記載' value={item.note} rows={Math.max(2, item.note.length / 50)}
                                                                        onChange={(e) => setCallLog(prev => ({
                                                                            ...prev,
                                                                            call_log: prev.call_log.map((log, i) => i === index ?
                                                                                { ...log, note: e.target.value, staff: interviewer } : log)
                                                                        }))}></textarea>
                                                                </div>
                                                                <div className="text-danger" style={actionButton}
                                                                    onClick={() => {
                                                                        setCallLog(prev => ({
                                                                            ...prev,
                                                                            call_log: prev.call_log.filter((_, i) => i !== index),
                                                                            add: true
                                                                        }));
                                                                    }}>削除</div>
                                                            </div>
                                                                <div style={{ color: '#868686ff', marginBottom: '7px' }}>
                                                                    <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                                                    <div style={{ textAlign: 'center' }}>
                                                                        {callLog.call_log[index]['action'] === '架電' && <i className="fa-solid fa-phone-volume"></i>}
                                                                        {callLog.call_log[index]['action'] === 'SMS送信' && <i className="fa-solid fa-message"></i>}
                                                                        {callLog.call_log[index]['action'] === 'メール送信' && <i className="fa-solid fa-envelope"></i>}
                                                                        {callLog.call_log[index]['action'] === '資料郵送' && <i className="fa-solid fa-truck"></i>}
                                                                    </div>
                                                                    <div style={{ width: '1.5px', height: '10px', backgroundColor: '#868686ff', margin: '0 auto' }}></div>
                                                                </div>
                                                            </>)}
                                                    <div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                                        <div className="">
                                                            <input type="date" style={inputStyle} value={call.day}
                                                                onChange={(e) => setCall(prev => ({
                                                                    ...prev,
                                                                    day: e.target.value, staff: interviewer
                                                                }))} />
                                                        </div>
                                                        <div className="">
                                                            <input type="time" step="60" style={inputStyle} value={call.time}
                                                                onChange={(e) => setCall(prev => ({
                                                                    ...prev,
                                                                    time: e.target.value, staff: interviewer
                                                                }))} />
                                                        </div>
                                                        <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                                            <select style={inputStyle}
                                                                onChange={(e) => setCall(prev => ({
                                                                    ...prev,
                                                                    action: e.target.value, staff: interviewer
                                                                }))}
                                                                value={call.action}>
                                                                <option value="">アクション内容</option>
                                                                <option value="架電">架電</option>
                                                                <option value="SMS送信">SMS送信</option>
                                                                <option value="メール送信">メール送信</option>
                                                                <option value="資料郵送">資料郵送</option>
                                                                <option value="次回架電日">次回架電日</option>
                                                            </select>
                                                        </div>
                                                        <div className="">
                                                            <textarea value={call.note} style={{ ...inputStyle, width: '360px' }} placeholder='アクション内容・ヒアリング内容を記載'
                                                                onChange={(e) => setCall(prev => ({
                                                                    ...prev,
                                                                    note: e.target.value, staff: interviewer
                                                                }))} ></textarea></div>
                                                        <div className="text-primary" style={actionButton}
                                                            onClick={() => {
                                                                if (!call.day && !call.action && !call.note) {
                                                                    alert('未入力の項目があります');
                                                                    return;
                                                                };
                                                                setCallLog(prev => ({
                                                                    ...prev,
                                                                    id: information.id,
                                                                    name: information.customer_contacts_name,
                                                                    staff: interviewer,
                                                                    status: information.call_status,
                                                                    call_log: [
                                                                        ...prev.call_log,
                                                                        { day: call.day, time: call.time, action: call.action, note: call.note, staff: call.staff }
                                                                    ],
                                                                    add: true
                                                                }));
                                                                setCall({
                                                                    status: '', day: '', time: '', action: '', note: '', staff: ''
                                                                });
                                                            }
                                                            }>追加</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>
                                            <div className="position-relative">
                                                備考
                                                <div className='position-absolute'
                                                    style={{ ...expandButton, top: '30px' }}
                                                    onClick={() => {
                                                        setExpand(prev =>
                                                        ({
                                                            ...prev,
                                                            remarks: !prev.remarks
                                                        })
                                                        );
                                                    }}>{expand.remarks ? '×閉じる' : '編集'}</div>
                                            </div></td>
                                        <td style={{ ...valueStyle, verticalAlign: 'top', paddingTop: '25px' }}>
                                            <div style={expandStyle('remarks')}>
                                                <textarea placeholder='反響内容・備考' style={{ ...inputStyle, width: '90%', height: 'auto' }} value={information.remarks}
                                                    rows={information.remarks ? Math.max(2, information.remarks.length / 23) + 2 : 2}
                                                    onChange={(e) => {
                                                        setInformation(prev => (
                                                            {
                                                                ...prev,
                                                                remarks: e.target.value
                                                            }
                                                        ));
                                                    }} />
                                            </div>
                                        </td>
                                        <td></td><td></td>
                                    </tr>
                                </tbody>
                            </Table>
                            <Table>
                                <tbody>
                                    <tr>
                                        <td style={labelStyle}>入居時期</td>
                                        <td style={valueStyle}>
                                            <select style={inputStyle} value={information[idMapping('入居時期')]}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            [idMapping('入居時期')]: e.target.value
                                                        }
                                                    ));
                                                }}>
                                                <option value="">選択してください</option>
                                                <option value="すぐにでも">すぐにでも</option>
                                                <option value="半年～1年以内">半年～1年以内</option>
                                                <option value="1年～2年以内">1年～2年以内</option>
                                                <option value="2年以上後">2年以上後</option>
                                                <option value="その他">その他</option>
                                            </select>
                                        </td>
                                        <td style={labelStyle}>契約スケジュール</td>
                                        <td style={valueStyle}>
                                            <select style={inputStyle} value={information.customized_input_01JSE7RNV3VK78YC2GYAG0554D}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customized_input_01JSE7RNV3VK78YC2GYAG0554D: e.target.value
                                                        }
                                                    ));
                                                }}>
                                                <option value="">選択してください</option>
                                                <option value="半月内">半月内</option>
                                                <option value="月内">月内</option>
                                                <option value="1か月後">1か月後</option>
                                                <option value="3か月後">3か月後</option>
                                                <option value="9か月後">9か月後</option>
                                                <option value="1年以上後">1年以上後</option>
                                            </select>
                                        </td>
                                        <td style={labelStyle}>予算総額</td>
                                        <td style={valueStyle}>
                                            <input type='text' placeholder='予算総額' style={inputStyle}
                                                value={(information.budget ?? '').replace('万円', '')}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            budget: e.target.value
                                                        }
                                                    ));
                                                }}
                                                onBlur={(e) => {
                                                    const halfValue = toHalfWidth(e.target.value);
                                                    const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            budget: `${numericOnly}万円`
                                                        }
                                                    ));
                                                }} />万円
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>月々支払予算</td>
                                        <td style={valueStyle}>
                                            <input type='text' placeholder='月々支払予算' style={inputStyle}
                                                value={(information.monthly_repayment_amount ?? '').replace('0000', '')}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            monthly_repayment_amount: `${e.target.value}0000`
                                                        }
                                                    ));
                                                }}
                                                onBlur={(e) => {
                                                    const halfValue = toHalfWidth(e.target.value);
                                                    const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            monthly_repayment_amount: `${numericOnly}0000`
                                                        }
                                                    ));
                                                }} />万円
                                        </td>
                                        <td style={labelStyle}>返済希望年数</td>
                                        <td style={valueStyle}>
                                            <input type='text' placeholder='返済希望年数' style={inputStyle}
                                                value={(information.repayment_years ?? '').replace(/[年\/]/g, '')}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            repayment_years: e.target.value
                                                        }
                                                    ));
                                                }}
                                                onBlur={(e) => {
                                                    const halfValue = toHalfWidth(e.target.value);
                                                    const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            repayment_years: `${numericOnly}年`
                                                        }
                                                    ));
                                                }} />年
                                        </td>
                                        <td style={labelStyle}>現居家賃</td>
                                        <td style={valueStyle}>
                                            <input type='text' placeholder='現居家賃' style={inputStyle}
                                                value={(information.current_rent ?? '').replace('万円', '')}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            current_rent: e.target.value
                                                        }
                                                    ));
                                                }}
                                                onBlur={(e) => {
                                                    const halfValue = toHalfWidth(e.target.value);
                                                    const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            current_rent: `${numericOnly}万円`
                                                        }
                                                    ));
                                                }} />万円
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>自己資金</td>
                                        <td style={valueStyle}>
                                            <input type="text" placeholder="自己資金" style={inputStyle} value={safeFormate(information.self_budget).replace('0000', '')}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            self_budget: `${e.target.value}0000`
                                                        }
                                                    ));
                                                }}
                                                onBlur={(e) => {
                                                    const halfValue = toHalfWidth(e.target.value);
                                                    const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            self_budget: `${numericOnly}0000`
                                                        }
                                                    ));
                                                }} />万円
                                        </td>
                                        <td style={labelStyle}>現居光熱費</td>
                                        <td style={valueStyle}>
                                            <input type="text" placeholder="現居光熱費" style={inputStyle} value={safeFormate(information.current_utility_costs).replace('万円', '')}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            current_utility_costs: e.target.value
                                                        }
                                                    ));
                                                }}
                                                onBlur={(e) => {
                                                    const halfValue = toHalfWidth(e.target.value);
                                                    const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            current_utility_costs: numericOnly
                                                        }
                                                    ));
                                                }} />万円
                                        </td>
                                        <td style={labelStyle}>負債総額</td>
                                        <td style={valueStyle}>
                                            <input type="text" placeholder="自己資金" style={inputStyle}
                                                value={safeFormate(information.current_loan_balance).replace('0000', '')}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            current_loan_balance: `${e.target.value}0000`
                                                        }
                                                    ));
                                                }}
                                                onBlur={(e) => {
                                                    const halfValue = toHalfWidth(e.target.value);
                                                    const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            current_loan_balance: `${numericOnly}0000`
                                                        }
                                                    ));
                                                }} />万円
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>現居契約形態</td>
                                        <td style={valueStyle}>
                                            <select style={inputStyle} value={safeFormate(information.current_contract_type)}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            current_contract_type: e.target.value
                                                        }
                                                    ));
                                                }}>
                                                <option value="">選択してください</option>
                                                <option value="賃貸(マンション)">賃貸(マンション)</option>
                                                <option value="賃貸(戸建)">賃貸(戸建)</option>
                                                <option value="持家(マンション)">持家(マンション)</option>
                                                <option value="持家(戸建)">持家(戸建)</option>
                                                <option value="賃貸(アパート)">賃貸(アパート)</option>
                                            </select>
                                        </td>
                                        <td style={labelStyle}>雇用形態</td>
                                        <td style={valueStyle}>
                                            <select style={inputStyle} value={safeFormate(information.customer_contacts_employment_type)}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customer_contacts_employment_type: e.target.value
                                                        }
                                                    ));
                                                }}>
                                                <option value="">選択してください</option>
                                                <option value="経営者">経営者</option>
                                                <option value="正社員">正社員</option>
                                                <option value="契約社員">契約社員</option>
                                                <option value="パート・アルバイト">パート・アルバイト</option>
                                                <option value="派遣社員">派遣社員</option>
                                                <option value="専業主婦">専業主婦</option>
                                            </select>
                                        </td>
                                        <td style={labelStyle}>勤務先名</td>
                                        <td style={valueStyle}>
                                            <input type='text' placeholder='勤務先名' style={inputStyle} value={safeFormate(information.customer_contacts_employer_name)}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customer_contacts_employer_name: e.target.value
                                                        }
                                                    ));
                                                }} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>勤務先住所</td>
                                        <td style={valueStyle}>
                                            <input type='text' placeholder='勤務先名' style={inputStyle} value={safeFormate(information.customer_contacts_employer_address)}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customer_contacts_employer_address: e.target.value
                                                        }
                                                    ));
                                                }} />
                                        </td>
                                        <td style={labelStyle}>勤続年数</td>
                                        <td style={valueStyle}>
                                            <input type='text' placeholder='勤続年数' style={inputStyle} value={safeFormate(information.customer_contacts_years_of_service)}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customer_contacts_years_of_service: e.target.value
                                                        }
                                                    ));
                                                }}
                                                onBlur={(e) => {
                                                    const halfValue = toHalfWidth(e.target.value);
                                                    const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customer_contacts_years_of_service: `${numericOnly}`
                                                        }
                                                    ));
                                                }} />年
                                        </td>
                                        <td style={labelStyle}>年収</td>
                                        <td style={valueStyle}>
                                            <input type='text' placeholder='勤務先名' style={inputStyle}
                                                value={safeFormate(information.customer_contacts_annual_income).replace('万円', '')}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customer_contacts_annual_income: `${e.target.value}万円`
                                                        }
                                                    ));
                                                }}
                                                onBlur={(e) => {
                                                    const halfValue = toHalfWidth(e.target.value);
                                                    const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            customer_contacts_annual_income: `${numericOnly}万円`
                                                        }
                                                    ));
                                                }} />万円
                                        </td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>
                    </div>
                    <Modal.Footer className="bg-light border-top pb-3 pt-3">
                        <div className="d-flex justify-content-end w-100 gap-2">
                            <button
                                className="btn btn-primary btn-sm rounded-pill px-5 shadow-sm d-flex align-items-center"
                                style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', opacity: sending ? '1' : '0.5' }}
                                onClick={handleSave}
                            >
                                <i className="fa-solid fa-check me-2"></i>保存
                            </button>
                        </div>
                    </Modal.Footer>
                </Modal.Body>
            </Modal >
            <Modal show={familyModalShow} onHide={familyModalClose} size='lg'>
                <FamilyInfo idValue={information.id} shopValue={information.in_charge_store} nameValue={information.customer_contacts_name} modalClose={familyModalClose} />
            </Modal>
        </>
    );
};

export default InformationEditResale