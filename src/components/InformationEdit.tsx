import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import axios from 'axios';
import { headers } from '../utils/headers';
import Table from "react-bootstrap/Table";
import { databaseList } from '../utils/databaseList';
import { baseURL } from '../utils/baseURL';
import FamilyInfo from './FamilyInfo';
import { generateULID } from '../utils/createULID';
import type { MasterData } from "./MasterData";

type Staff = { name: string; shop: string; rank: number, section: string };
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

type Props = {
    id: string,
    token: string,
    onClose: () => void,
    brand: string
}

const InformationEdit = ({ id, token, onClose, brand }: Props) => {
    const [shopArray, setShopArray] = useState<Shop[]>([]);
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
    const [rankPeriod, setRankPeriod] = useState('');
    const [sending, setSending] = useState(true);

    const createEmptyMasterData = (): MasterData => {
        const keys = Object.keys({} as MasterData) as (keyof MasterData)[];
        return keys.reduce((acc, key) => {
            acc[key] = '';
            return acc;
        }, {} as MasterData);
    };

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const today = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

useEffect(()=>{
    console.log(shopArray)
},[shopArray])
    useEffect(() => {
        if (!id) return;
        if (id === 'new') {
            setInformation(prev => ({
                ...createEmptyMasterData(),
                id: generateULID()
            }));

            setSending(true)
            const fetchData = async () => {
                const [shopRes, staffRes, mediumRes, nameRes] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "staff_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "get_name", api_token: token }, { headers }),
                ]);
                setShopArray(shopRes.data);
                setStaffArray(staffRes.data.filter(s => s.category === 1));
                setMediumArray(mediumRes.data);
                setInterviewer(nameRes.data.name);
            };
            fetchData();
        } else {
            setSending(true)
            const fetchData = async () => {
                const [informationRes, shopRes, staffRes, mediumRes, nameRes, callRes, interviewLogRes] = await Promise.all([
                    axios.post('https://khg-marketing.info/dashboard/api/', { demand: 'informationRoad', id: id }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "staff_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "get_name", api_token: token }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "show_customer_call_log", id: id }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "show_customer_interview_log", id: id }, { headers }),
                ]);

                setInformation(informationRes.data.master_data);

                const rawRank = informationRes.data.customers.rank_period ?? '';
                setRankPeriod(String(rawRank).replace('/', '-'));

                setShopArray(shopRes.data);
                setStaffArray(staffRes.data);
                setMediumArray(mediumRes.data);
                setInterviewer(nameRes.data.name);
                const callResData = {
                    id: callRes.data.id ?? informationRes.data.master_data.id,
                    shop: callRes.data.shop ?? informationRes.data.master_data.in_charge_store,
                    staff: interviewer,
                    name: callRes.data.name ?? informationRes.data.master_data.customer_contacts_name,
                    status: callRes.data.status === 'not_found' ? '' : callRes.data.status,
                    reserved_status: callRes.data.reserved_status ?? '',
                    call_log: typeof callRes.data.call_log === 'string' && callRes.data.call_log.trim() !== ''
                        ? JSON.parse(callRes.data.call_log)
                        : callRes.data.call_log ?? [],

                    add: false
                };
                setCallLog(callResData);
                const interviewResData: InterviewLog = {
                    id: interviewLogRes.data.id ?? informationRes.data.master_data.id,
                    shop: interviewLogRes.data.shop ?? informationRes.data.master_data.in_charge_store,
                    name: interviewLogRes.data.name ?? informationRes.data.master_data.customer_contacts_name,
                    interview_log: typeof interviewLogRes.data.interview_log === 'string' && interviewLogRes.data.interview_log.trim() !== ''
                        ? JSON.parse(interviewLogRes.data.interview_log)
                        : interviewLogRes.data.interview_log ?? [],
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

    const inquiryReasons: string[] = ['友人・知人から聞いた', 'SNS(Instagram/Facebook/youtube/その他)', '看板を見た', '親・親戚から聞いた', 'インターネット検索', '新聞を見た', 'まとめサイトを見た', 'チラシを見た', 'その他'];

    const houseHuntingMotivation: string[] = ['家賃がもったいない', '子どもが進学する', '土地をもらった', '家族が増える（減る）', '友人・知人が家を建てた', '家づくりは特に考えていない', '土地が見つかった', '親から勧められた', '工事費用が高くなる前に', '年齢的にそろそろ', '賃貸だと老後（退職後）が心配', '今の住まいが狭い', '水回り（キッチン・風呂・トイレ・洗面）が不便', '騒音が気になる', '収納が足りない', 'その他', '気密・断熱性にこだわりたい', '間取りにこだわりたい', '他人とは違った家にしたい', '耐震性にこだわりたい', 'インテリアにこだわりたい', '外観デザインにこだわりたい', '建築予定地が既にある', '収納にこだわりたい', '注文住宅にこだわりはない'];

    const toHalfWidth = (str: string) => {
        return str.replace(/[！-～]/g, (s) =>
            String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
        ).replace(/　/g, ' ');
    };

    const actionMap = {
        '初回面談': 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
        '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
        '事前審査': 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
        'LINEグループ作成': 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
        '契約': 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'
    };

    const modalClose = () => onClose();

    const familyModalClose = () => {
        setFamilyMShow(false);
    };

    const handleSave = async () => {
        const requiredList = ['customer_contacts_name', 'in_charge_store', 'in_charge_user', 'status', 'sales_promotion_name'];

        if (!information.status) information.status = '見込み';
        if (!information.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99) information.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 = today;
        for (const key of requiredList) {
            if (!information[key]) {
                const targetLabel = databaseList.find(d => d.id === key)?.value;
                alert(`必須項目が未入力です:${targetLabel}`)
                return;
            }
        }

        await setSending(false);
        let interviewData;
        const isAddInterview = interview.day && interview.action;

        information.request = id === 'new' ? 'add_customer' : 'before_interview_zero';
        information.section = shopArray.find(s => s.shop === information.in_charge_store)?.section ?? '';

        let newMasterData = {
            ...information,
        };

        if (isAddInterview) {
            const key = actionMap[interview.action];
            information[key] = interview.day;
            const reserveActions = ['2回目以降面談', '事前審査', '契約'];

            newMasterData = {
                ...information,
                [key]: interview.day,
                ...(reserveActions.includes(interview.action)
                    ? { second_reserve: '次回来場' }
                    : {})
            };
            const shopValue = information.in_charge_store;
            information.shop = shopValue;
            const newInterviewLog = {
                ...interviewLog,
                id: information.id,
                name: information.customer_contacts_name,
                shop: information.in_charge_store,
                interview_log: [
                    ...interviewLog.interview_log,
                    { day: interview.day, action: interview.action, note: interview.note }
                ]
            };
            interviewData = {
                ...newInterviewLog,
                demand: 'update_interview_log'
            }
        } else {
            interviewData = {
                ...interviewLog,
                id: information.id,
                name: information.customer_contacts_name,
                shop: information.in_charge_store,
                demand: 'update_interview_log'
            }
        }

        console.log(interviewData);

        if (isAddInterview || interviewLog.add) {
            try {
                await axios.post("https://khg-marketing.info/dashboard/api/", interviewData, { headers });
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        }

        let postData;
        let calendarAdd;
        if (call.day && call.action) {
            const newCallLog = {
                ...callLog,
                call_log: [
                    ...callLog.call_log,
                    { day: call.day, time: call.time ?? '', action: call.action, note: call.note ?? '', staff: interviewer ?? '' }
                ]
            };
            postData = {
                ...newCallLog,
                id: information.id,
                name: information.customer_contacts_name,
                shop: information.in_charge_store,
                staff: information.in_charge_user,
                demand: 'update_call_log',
            };
            calendarAdd = true;
        } else {
            postData = {
                ...callLog,
                id: information.id,
                name: information.customer_contacts_name,
                shop: information.in_charge_store,
                staff: information.in_charge_user,
                demand: 'update_call_log'
            };
            calendarAdd = callLog.add;
        }

        console.log(postData);

        if (callLog.status || (call.day && call.action && call.note) || callLog.add) {
            try {
                await axios.post("https://khg-marketing.info/dashboard/api/", postData, { headers });
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        }

        console.log(newMasterData);
        try {
            await axios.post("https://khg-marketing.info/survey/api/", newMasterData, { headers });
        } catch (error) {
            console.error("データ取得エラー:", error);
        }

        if (brand === 'insideSales' && calendarAdd && postData.call_log[postData.call_log.length - 1]['time']) {
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

            const lastLog = postData.call_log[postData.call_log.length - 1];
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
            note: ''
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

    return (
        <>
            <Modal
                show={!!id}
                size='xl'
                onHide={() => modalClose()}
            >
                <Modal.Header closeButton><div style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 'bold' }}>{id === 'new' ? <div>新規顧客登録 <span className='text-danger'>※は入力必須</span></div> : `${information.in_charge_store ?? ''} ${information.customer_contacts_name ?? ''}様`}</div></Modal.Header>
                <Modal.Body>
                    <div style={{ height: '78vh', overflowY: 'scroll' }}>
                        <Table responsive style={{ fontSize: '11px', textAlign: 'left' }} bordered striped className='list_table database'>
                            <tbody>
                                <tr>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', width: '200px' }}><span className='text-danger fw-bold'>※</span>お客様名</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='漢字' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px' }} value={information[idMapping('お客様名')]}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        [idMapping('お客様名')]: e.target.value
                                                    }
                                                ));
                                            }} />
                                        <input type='text' placeholder='ふりがな' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginLeft: '8px' }} value={information[idMapping('名前（かな）')]}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        [idMapping('名前（かな）')]: e.target.value
                                                    }
                                                ));
                                            }} />
                                    </td>
                                </tr>
                                <tr id='contact'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>連絡先</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='固定電話' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px' }} value={information.customer_contacts_phone_number}
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
                                        <input type='text' placeholder='携帯電話' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginLeft: '8px' }} value={information.customer_contacts_mobile_phone_number}
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
                                        <input type='text' placeholder='メールアドレス' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '250px', paddingLeft: '10px', marginLeft: '8px' }} value={information.customer_contacts_email}
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
                                <tr id='address'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>住所</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='郵便番号' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '100px', paddingLeft: '10px' }} value={information.postal_code}
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
                                        <input type='text' placeholder='住所' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '400px', paddingLeft: '10px', marginLeft: '8px' }} value={information.full_address}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        full_address: e.target.value
                                                    }
                                                ));
                                            }} />
                                    </td>
                                </tr>
                                <tr id={idMapping('担当店舗')}>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span className='text-danger fw-bold'>※</span>担当店舗</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <select
                                            style={{
                                                border: '1px solid #D3D3D3',
                                                borderRadius: '3px',
                                                height: '25px',
                                                width: '150px',
                                                paddingLeft: '10px'
                                            }}
                                            value={information[idMapping('担当店舗')] || ""}
                                            onChange={(e) => {
                                                const selected = staffArray.find(item => item.shop === e.target.value);
                                                setInformation(prev => ({
                                                    ...prev,
                                                    [idMapping('担当店舗')]: e.target.value,
                                                    [idMapping('担当営業')]: selected?.name || "",
                                                }));
                                            }}
                                        >
                                            <option value=''>担当店舗を選択</option>
                                            {shopArray
                                                .map((item, index) => (
                                                    <option key={index} value={item.shop}>
                                                        {item.shop}
                                                    </option>
                                                ))}
                                        </select>
                                    </td>
                                </tr>
                                <tr id={idMapping('担当営業')}>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span className='text-danger fw-bold'>※</span>担当営業</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <select
                                            style={{
                                                border: '1px solid #D3D3D3',
                                                borderRadius: '3px',
                                                height: '25px',
                                                width: '150px',
                                                paddingLeft: '10px'
                                            }}
                                            value={information[idMapping('担当営業')] || ""}
                                            onChange={(e) => {
                                                const selected = staffArray.find(item => item.name === e.target.value);
                                                setInformation(prev => ({
                                                    ...prev,
                                                    [idMapping('担当営業')]: selected?.name || "",
                                                }));
                                            }}
                                        >
                                            {staffArray
                                                .filter(item => item.shop === information.in_charge_store)
                                                .map((item, index) => (
                                                    <option key={index} value={item.name}>
                                                        {item.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </td>
                                </tr>
                                <tr id={idMapping('ステータス')}>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>ステータス</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px' }} value={information[idMapping('ステータス')]}
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
                                        </select>
                                    </td>
                                </tr>
                                <tr id={idMapping('顧客ランク')}>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>顧客ランク</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <div className="d-flex">
                                            <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px' }} value={information[idMapping('顧客ランク')]}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            [idMapping('顧客ランク')]: e.target.value
                                                        }
                                                    ));
                                                }}>
                                                <option value="">選択してください</option>
                                                <option value='Aランク'>Aランク</option>
                                                <option value='Bランク'>Bランク</option>
                                                <option value='Cランク'>Cランク</option>
                                                <option value='Dランク'>Dランク</option>
                                                <option value='Eランク'>Eランク</option>
                                            </select>
                                            <input type="month" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '100px', paddingLeft: '10px', marginLeft: '8px' }}
                                                value={rankPeriod}
                                                onChange={(e) => {
                                                    setRankPeriod(e.target.value);
                                                    const formattedMonth = e.target.value.replace(/-/g, '/');
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            rank_period: formattedMonth
                                                        }
                                                    ));
                                                }} />
                                            <div style={{ width: '450px', fontSize: '10px', fontWeight: '500' }} className='text-danger ms-2'>※契約見込みの月を指定する。例えば「来月の見込みが高い顧客」であれば「Bランク」にして1か月後を選択。当月見込みの場合は未選択で可。</div>
                                        </div>

                                    </td>
                                </tr>
                                <tr id={idMapping('反響媒体')}>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}><span className='text-danger fw-bold'>※</span>反響媒体</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '200px', paddingLeft: '10px' }} value={information[idMapping('反響媒体')]}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        [idMapping('反響媒体')]: e.target.value
                                                    }
                                                ));
                                            }}>
                                            <option value=''>反響媒体を選択</option>
                                            {mediumArray.filter(item => item.list_medium === 1 && !/(Amazonギフトカード|HOTLEAD|アポラック|システム利用料)/.test(item.medium)).map((item, index) =>
                                                <option key={index} value={item.medium}>{item.medium}</option>
                                            )}
                                        </select>
                                    </td>
                                </tr>
                                <tr id='interview_status'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>商談ステップ</td>
                                    <td>
                                        <div className="d-flex align-items-center mb-2">
                                            <div style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>顧客ランク</div>
                                            <div style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>
                                                <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px' }} value={information[idMapping('顧客ランク')]}
                                                    onChange={(e) => {
                                                        setInformation(prev => (
                                                            {
                                                                ...prev,
                                                                [idMapping('顧客ランク')]: e.target.value
                                                            }
                                                        ));
                                                    }}>
                                                    <option value="">選択してください</option>
                                                    <option value='Aランク'>Aランク</option>
                                                    <option value='Bランク'>Bランク</option>
                                                    <option value='Cランク'>Cランク</option>
                                                    <option value='Dランク'>Dランク</option>
                                                    <option value='Eランク'>Eランク</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div style={{ padding: '5px', backgroundColor: '#f1f1f1ff' }}>
                                            <div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                                <div className="">
                                                    <input type="date" value={id === 'new' ? today : information.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 ? information.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99.replace(/\//g, "-") : ''} style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', paddingLeft: '2px' }}
                                                        onChange={(e) => {
                                                            setInformation(prev => (
                                                                {
                                                                    ...prev,
                                                                    step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: id === 'new' ? today : e.target.value
                                                                }
                                                            ));
                                                        }} />
                                                </div>
                                                <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                                    <select style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }} disabled>
                                                        <option value="">反響取得</option>
                                                    </select>
                                                </div>
                                                <div className="ms-2">
                                                    {information.sales_promotion_name}からの反響取得</div>
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
                                                            <input type="date" value={item.day} style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', paddingLeft: '2px' }}
                                                                onChange={(e) => {
                                                                    setInterviewLog(prev => ({
                                                                        ...prev,
                                                                        add: true,
                                                                        interview_log: prev.interview_log.map((log, i) => i === index ?
                                                                            { ...log, day: e.target.value } : log)
                                                                    }));
                                                                    const key = actionMap[item.action];
                                                                    if (key) {
                                                                        console.log(key)
                                                                        const value = e.target.value;
                                                                        setInformation(prev => ({
                                                                            ...prev,
                                                                            [key]: value
                                                                        }));
                                                                    }

                                                                }} />
                                                        </div>
                                                        <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                                            <select style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }} value={item.action}
                                                                onChange={(e) => setInterviewLog(prev => ({
                                                                    ...prev,
                                                                    add: true,
                                                                    interview_log: prev.interview_log.map((log, i) => i === index ?
                                                                        { ...log, action: e.target.value } : log)
                                                                }))}>
                                                                <option value="">アクション内容</option>
                                                                <option value="初回面談">初回面談</option>
                                                                <option value="2回目以降面談">2回目以降面談</option>
                                                                <option value="オンライン面談">オンライン面談</option>
                                                                <option value="LINEグループ作成">LINEグループ作成</option>
                                                                <option value="事前審査">事前審査</option>
                                                                <option value="契約">契約</option>
                                                            </select>
                                                        </div>
                                                        <div className="">
                                                            <textarea style={{ border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '500px' }} placeholder='面談内容を記載' value={item.note} rows={Math.max(item.note.length / 43)}
                                                                onChange={(e) => setInterviewLog(prev => ({
                                                                    ...prev,
                                                                    add: true,
                                                                    interview_log: prev.interview_log.map((log, i) => i === index ?
                                                                        { ...log, note: e.target.value } : log)
                                                                }))}></textarea>
                                                        </div>
                                                        <div className="text-danger" style={{ backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)' }}
                                                            onClick={() => {
                                                                item.action === '初回面談' && setInformation(prev => (
                                                                    {
                                                                        ...prev,
                                                                        step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7: ''
                                                                    }
                                                                ));
                                                                item.action === '2回目以降面談' && setInformation(prev => (
                                                                    {
                                                                        ...prev,
                                                                        step_migration_item_01JSENACS2FC422ZHEZWNSXNYA: '',
                                                                        second_reserve: '次回来場'
                                                                    }
                                                                ));

                                                                item.action === '事前審査' && setInformation(prev => (
                                                                    {
                                                                        ...prev,
                                                                        step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR: '',
                                                                        second_reserve: '次回来場'
                                                                    }
                                                                ));
                                                                item.action === 'LINEグループ作成' && setInformation(prev => (
                                                                    {
                                                                        ...prev,
                                                                        step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN: ''
                                                                    }
                                                                ));
                                                                item.action === '契約' && setInformation(prev => (
                                                                    {
                                                                        ...prev,
                                                                        step_migration_item_01J82Z5F1RR18Z792C7KZS88QG: '',
                                                                        second_reserve: '次回来場'
                                                                    }
                                                                ));
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
                                                    <input type="date" style={{ height: '25px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', paddingLeft: '2px' }} value={interview.day}
                                                        onChange={(e) => setInterview(prev => ({
                                                            ...prev,
                                                            day: e.target.value
                                                        }))} />
                                                </div>
                                                <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                                    <select style={{ height: '25px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }}
                                                        onChange={(e) => setInterview(prev => ({
                                                            ...prev,
                                                            action: e.target.value,
                                                            note: e.target.value === 'LINEグループ作成' ? 'LINEグループ作成' :
                                                                e.target.value === '契約' ? '契約' : prev.note
                                                        }))}
                                                        value={interview.action}>
                                                        <option value="">アクション内容</option>
                                                        <option value="初回面談">初回面談</option>
                                                        <option value="2回目以降面談">2回目以降面談</option>
                                                        <option value="オンライン面談">オンライン面談</option>
                                                        <option value="LINEグループ作成">LINEグループ作成</option>
                                                        <option value="事前審査">事前審査</option>
                                                        <option value="契約">契約</option>
                                                    </select>
                                                </div>
                                                <div className="">
                                                    <textarea value={interview.note} style={{ height: '25px', border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '500px' }} placeholder='面談内容を記載'
                                                        onChange={(e) => setInterview(prev => ({
                                                            ...prev,
                                                            note: e.target.value
                                                        }))} ></textarea></div>
                                                <div className="text-primary" style={{ backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)' }}
                                                    onClick={() => {
                                                        if (!interview.day || !interview.action || !interview.note) {
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
                                                                { day: interview.day, action: interview.action, note: interview.note }
                                                            ],
                                                            add: true
                                                        }));

                                                        const key = actionMap[interview.action];
                                                        const reserveActions = ['2回目以降面談', '事前審査', '契約'];

                                                        if (key) {
                                                            setInformation(prev => ({
                                                                ...prev,
                                                                [key]: interview.day,
                                                                ...(reserveActions.includes(interview.action)
                                                                    ? { second_reserve: '次回来場' }
                                                                    : {})
                                                            }));
                                                        }


                                                        setInterview({
                                                            day: '', action: '', note: ''
                                                        });
                                                    }
                                                    }>追加</div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                <tr id='call_status'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>架電状況</td>
                                    <td>
                                        <div className="d-flex align-items-center mb-2">
                                            <div style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>架電ステータス</div>
                                            <div style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '10px' }}>
                                                <select style={{ height: '25px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }}
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
                                                <input type="date" style={{ height: '25px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }} value={callLog.reserved_status ? callLog.reserved_status : ''}
                                                    onChange={(e) => setCallLog(prev => ({
                                                        ...prev,
                                                        reserved_status: e.target.value
                                                    }))} />
                                            </div>
                                        </div>
                                        <div style={{ padding: '5px', backgroundColor: '#f1f1f1ff' }}>
                                            {callLog.call_log &&
                                                callLog.call_log.map((item, index) => <><div className="d-flex align-items-center" style={{ fontSize: '11px', fontWeight: '500', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>
                                                    <div className="">
                                                        <input type="date" value={item.day} style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', paddingLeft: '2px' }}
                                                            onChange={(e) => setCallLog(prev => ({
                                                                ...prev,
                                                                call_log: prev.call_log.map((log, i) => i === index ?
                                                                    { ...log, day: e.target.value, staff: interviewer } : log)
                                                            }))} />
                                                    </div>
                                                    <div className="">
                                                        <input type="time" value={item.time} style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', marginLeft: '5px', paddingLeft: '2px' }}
                                                            onChange={(e) => setCallLog(prev => ({
                                                                ...prev,
                                                                call_log: prev.call_log.map((log, i) => i === index ?
                                                                    { ...log, time: e.target.value, staff: interviewer } : log)
                                                            }))} />
                                                    </div>
                                                    <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                                        <select style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }} value={item.action}
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
                                                        </select>
                                                    </div>
                                                    <div className="">
                                                        <textarea style={{ border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '420px' }} placeholder='アクション内容・ヒアリング内容を記載' value={item.note} rows={item.note.split('\n').length}
                                                            onChange={(e) => setCallLog(prev => ({
                                                                ...prev,
                                                                call_log: prev.call_log.map((log, i) => i === index ?
                                                                    { ...log, note: e.target.value, staff: interviewer } : log)
                                                            }))}></textarea>
                                                    </div>
                                                    <div className="text-danger" style={{ backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)' }}
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
                                                    <input type="date" style={{ height: '25px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '80px', paddingLeft: '2px' }} value={call.day}
                                                        onChange={(e) => setCall(prev => ({
                                                            ...prev,
                                                            day: e.target.value, staff: interviewer
                                                        }))} />
                                                </div>
                                                <div className="">
                                                    <input type="time" step="60" style={{ height: '25px', border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '80px', paddingLeft: '2px' }} value={call.time}
                                                        onChange={(e) => setCall(prev => ({
                                                            ...prev,
                                                            time: e.target.value, staff: interviewer
                                                        }))} />
                                                </div>
                                                <div style={{ fontSize: '11px', fontWeight: '500', letterSpacing: '.6px', verticalAlign: 'middle', marginLeft: '5px' }}>
                                                    <select style={{ height: '25px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '150px' }}
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
                                                    </select>
                                                </div>
                                                <div className="">
                                                    <textarea value={call.note} style={{ height: '25px', border: '1px solid #D3D3D3', borderRadius: '3px', marginLeft: '5px', width: '420px' }} placeholder='アクション内容・ヒアリング内容を記載'
                                                        onChange={(e) => setCall(prev => ({
                                                            ...prev,
                                                            note: e.target.value, staff: interviewer
                                                        }))} ></textarea></div>
                                                <div className="text-primary" style={{ backgroundColor: '#D3D3D3', padding: '6px', marginLeft: '5px', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.39)' }}
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
                                    </td>
                                </tr>
                                <tr id='desired_area1_address'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>希望エリア</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <div className="d-flex">
                                            <input type='text' placeholder='希望エリア' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '350px', paddingLeft: '10px' }} value={information.desired_area1_address}
                                                onChange={(e) => {
                                                    setInformation(prev => (
                                                        {
                                                            ...prev,
                                                            desired_area1_address: e.target.value
                                                        }
                                                    ));
                                                }} />
                                        </div>
                                    </td>
                                </tr>
                                <tr id='customized_input_01J95TC6KEES87F0YXH29AJP7K' >
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>面談時アンケート</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <textarea placeholder='面談時アンケート' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', width: '100%', paddingLeft: '10px' }} value={information.customized_input_01J95TC6KEES87F0YXH29AJP7K}
                                            rows={information.customized_input_01J95TC6KEES87F0YXH29AJP7K ? (information.customized_input_01J95TC6KEES87F0YXH29AJP7K.match(/\n/g)?.length ?? 0) + 2 : 2}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        customized_input_01J95TC6KEES87F0YXH29AJP7K: e.target.value
                                                    }
                                                ));
                                            }} />
                                    </td>
                                </tr>
                                <tr id='remarks'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>備考</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <textarea placeholder='次回アポまでの対応内容・担当者の感覚' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', width: '100%', paddingLeft: '10px' }} value={information.remarks}
                                            rows={information.remarks ? (information.remarks.match(/\n/g)?.length ?? 0) + 2 : 2}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        remarks: e.target.value
                                                    }
                                                ));
                                            }} />
                                    </td>
                                </tr>
                                <tr id={idMapping('問い合せのきっかけ')}>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>問い合わせのきっかけ<br />該当する項目は全てチェック</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <div className="d-flex flex-wrap">{inquiryReasons.map((item, index) =>
                                            <div className="form-check me-2" style={{ fontSize: '12px', letterSpacing: '.5px' }}>
                                                <input className="form-check-input" type="checkbox" value={item} id={`check_${String(index + 1)}`} checked={information[idMapping('問い合せのきっかけ')]?.split(',').includes(item)}
                                                    onChange={(e) => {
                                                        const { checked, value } = e.target;
                                                        setInformation(prev => {
                                                            const current = prev.inquiry_reason?.split(',').filter(Boolean) ?? [];
                                                            const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                                            return {
                                                                ...prev,
                                                                [idMapping('問い合せのきっかけ')]: updated.join(','),
                                                            };
                                                        });
                                                    }} />
                                                <label className="form-check-label" htmlFor={`check_${String(index + 1)}`}>
                                                    {item}
                                                </label>
                                            </div>
                                        )}</div>
                                    </td>
                                </tr>
                                <tr id={idMapping('建築動機')}>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>建築動機<br />該当する項目は全てチェック</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <div className="d-flex flex-wrap">{houseHuntingMotivation.slice(0, 16).map((item, index) =>
                                            <div className="form-check me-2" style={{ fontSize: '12px', letterSpacing: '.5px' }}>
                                                <input className="form-check-input" type="checkbox" value={item} id={`check1_${String(index + 10)}`} checked={information[idMapping('建築動機')]?.split(',').includes(item)}
                                                    onChange={(e) => {
                                                        const { checked, value } = e.target;
                                                        setInformation(prev => {
                                                            const current = prev.house_hunting_motivation?.split(',').filter(Boolean) ?? [];
                                                            const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                                            return {
                                                                ...prev,
                                                                [idMapping('建築動機')]: updated.join(','),
                                                            };
                                                        });
                                                    }} />
                                                <label className="form-check-label" htmlFor={`check1_${String(index + 10)}`}>
                                                    {item}
                                                </label>
                                            </div>
                                        )}</div>
                                    </td>
                                </tr>
                                <tr id={idMapping('建築動機')}>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>注文住宅に興味をもったきっかけ<br />該当する項目は全てチェック</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <div className="d-flex flex-wrap">{houseHuntingMotivation.slice(16, 25).map((item, index) =>
                                            <div className="form-check me-2" style={{ fontSize: '12px', letterSpacing: '.5px' }}>
                                                <input className="form-check-input" type="checkbox" value={item} id={`check2_${String(index + 10)}`} checked={information[idMapping('建築動機')]?.split(',').includes(item)}
                                                    onChange={(e) => {
                                                        const { checked, value } = e.target;
                                                        setInformation(prev => {
                                                            const current = prev.house_hunting_motivation?.split(',').filter(Boolean) ?? [];
                                                            const updated = checked ? [...new Set([...current, value])] : current.filter(item => item !== value);
                                                            return {
                                                                ...prev,
                                                                [idMapping('建築動機')]: updated.join(','),
                                                            };
                                                        });
                                                    }} />
                                                <label className="form-check-label" htmlFor={`check2_${String(index + 10)}`}>
                                                    {item}
                                                </label>
                                            </div>
                                        )}</div>
                                    </td>
                                </tr>
                                <tr id={idMapping('新築計画')}>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>新築計画</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px' }} value={information[idMapping('新築計画')]}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        [idMapping('新築計画')]: e.target.value
                                                    }
                                                ));
                                            }}>
                                            <option value="">選択してください</option>
                                            <option value="新築平屋">新築平屋</option>
                                            <option value="新築2階建て">新築2階建て</option>
                                            <option value="建て替え平屋">建て替え平屋</option>
                                            <option value="建て替え2階建て">建て替え2階建て</option>
                                            <option value="その他">その他</option>
                                        </select>
                                    </td>
                                </tr>
                                <tr id={idMapping('入居時期')}>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>入居時期</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px' }} value={information[idMapping('入居時期')]}
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
                                </tr>
                                <tr id={idMapping('土地の状況')}>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>土地の状況</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '300px', paddingLeft: '10px' }} value={information[idMapping('土地の状況')]}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        [idMapping('土地の状況')]: e.target.value
                                                    }
                                                ));
                                            }}>
                                            <option value="">選択してください</option>
                                            <option value="自分で持っている（購入予定の土地がある）">自分で持っている（購入予定の土地がある）</option>
                                            <option value="親・親族等の土地で建築予定">親・親族等の土地で建築予定</option>
                                            <option value="土地を探している">土地を探している</option>
                                        </select>
                                    </td>
                                </tr>
                                <tr id='has_owned_land' >
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>土地の有無</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px' }} value={information.has_owned_land}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        has_owned_land: e.target.value
                                                    }
                                                ));
                                            }}>
                                            <option value="無">無</option><option value="有">有</option>
                                        </select>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>重視項目</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px' }} value={information.customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN: e.target.value
                                                    }
                                                ));
                                            }}>
                                            <option value="">選択してください</option>
                                            <option value="性能">性能</option>
                                            <option value="デザイン">デザイン</option>
                                            <option value="価格">価格</option>
                                            <option value="アフターサービス">アフターサービス</option>
                                        </select>
                                    </td>
                                </tr>
                                <tr >
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>契約スケジュール</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px' }} value={information.customized_input_01JSE7RNV3VK78YC2GYAG0554D}
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
                                </tr>
                                <tr id='budget' >
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>予算総額</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='予算総額' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                            value={information.budget ? information.budget.replace('万円', '') : ''}
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
                                <tr id='monthly_repayment_amount'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>月々支払予算</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='月々支払予算' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                            value={information.monthly_repayment_amount ? information.monthly_repayment_amount.replace('0000', '') : ''}
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
                                </tr>
                                <tr id='repayment_years' >
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>返済希望年数</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='返済希望年数' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                            value={information.repayment_years ? information.repayment_years.replace(/[年\/]/g, '') : ''}
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
                                </tr>
                                <tr id='current_rent'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>現居家賃</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='現居家賃' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                            value={information.current_rent ? information.current_rent.replace('万円', '') : ''}
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
                                <tr id='self_budget'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>自己資金</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type="text" placeholder="自己資金" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={information.self_budget ? information.self_budget.replace('0000', '') : ''}
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
                                </tr>
                                <tr id='current_utility_costs' >
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>現居光熱費</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type="text" placeholder="現居光熱費" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={information.current_utility_costs ? information.current_utility_costs.replace('万円', '') : ''}
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
                                </tr>
                                <tr id='current_loan_balance'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>負債総額</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type="text" placeholder="自己資金" style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                            value={information.current_loan_balance ? information.current_loan_balance.replace('0000', '') : ''}
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
                                <tr id='current_contract_type'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>現居契約形態</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px' }} value={information.current_contract_type}
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
                                </tr>
                                <tr id='customer_contacts_employment_type' >
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>雇用形態</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <select style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px' }} value={information.customer_contacts_employment_type}
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
                                </tr>
                                <tr id='customer_contacts_employer_name' >
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>勤務先名</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '350px', paddingLeft: '10px' }} value={information.customer_contacts_employer_name}
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
                                <tr id='customer_contacts_employer_address'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>勤務先住所</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '350px', paddingLeft: '10px' }} value={information.customer_contacts_employer_address}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        customer_contacts_employer_address: e.target.value
                                                    }
                                                ));
                                            }} />
                                    </td>
                                </tr>
                                <tr id='customer_contacts_years_of_service' >
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>勤続年数</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='勤続年数' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={information.customer_contacts_years_of_service}
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
                                </tr>
                                <tr id='customer_contacts_annual_income'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>年収</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='勤務先名' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                            value={information.customer_contacts_annual_income ? information.customer_contacts_annual_income.replace('万円', '') : ''}
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
                                <tr id='desired_land_area'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>希望土地面積</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='希望土地面積' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginRight: '5px' }} value={information.desired_land_area}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        desired_land_area: e.target.value
                                                    }
                                                ));
                                            }}
                                            onBlur={(e) => {
                                                const halfValue = toHalfWidth(e.target.value);
                                                const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        desired_land_area: numericOnly
                                                    }
                                                ));
                                            }} />坪
                                    </td>
                                </tr>
                                <tr id='land_budget' >
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>土地の予算</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' pattern="[A-Za-z0-9]*" placeholder='予算総額' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '150px', paddingLeft: '10px', marginRight: '5px' }}
                                            value={information.land_budget ? information.land_budget.replace('万円', '') : ''}
                                            onChange={(e) => {
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        land_budget: `${e.target.value}万円`
                                                    }
                                                ));

                                            }}
                                            onBlur={(e) => {
                                                const halfValue = toHalfWidth(e.target.value);
                                                const numericOnly = halfValue.replace(/[^0-9.,]/g, '');
                                                setInformation(prev => (
                                                    {
                                                        ...prev,
                                                        land_budget: `${numericOnly}万円`
                                                    }
                                                ));
                                            }} />万円
                                    </td>
                                </tr>
                                <tr id='planned_construction_site'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>建設予定地</td>
                                    <td style={{ fontSize: '12px', letterSpacing: '.6px' }}>
                                        <input type='text' placeholder='建設予定地' style={{ border: '1px solid #D3D3D3', borderRadius: '3px', height: '25px', width: '350px', paddingLeft: '10px' }} value={information.planned_construction_site}
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
                                <tr id='family_info'>
                                    <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>家族情報</td>
                                    <td><div className="bg-primary px-3 text-white py-1 rounded" style={{ width: 'fit-content', fontWeight: '500', letterSpacing: '1px', cursor: 'pointer' }}
                                        onClick={() => setFamilyMShow(true)}>入力・確認</div></td>
                                </tr>
                                {/* <tr id='gift' className={selected.remarks ? 'table-secondary' : undefined} onClick={() => handleSetSelected('remarks', 'body')}>
                            <td style={{ fontSize: '11px', fontWeight: '700', marginBottom: '4px', letterSpacing: '.6px', verticalAlign: 'middle' }}>ギフト進呈</td>
                            <td style={{ fontSize: '11px', letterSpacing: '.6px' }}>
                                <input type="date" value={newGiftDate.replace(/\//g, '-')} style={{ height: '24px', border: '1px solid #D3D3D3', borderRadius: '3px', width: '100px', paddingLeft: '2px' }}
                                    onChange={(e) => {
                                        const formattedDate = e.target.value.replace(/\//g, '-');
                                        handleGiftDate(information.id, formattedDate);
                                        setNewGiftDate(formattedDate);
                                    }} />
                            </td>
                        </tr> */}
                            </tbody>
                        </Table>
                    </div>
                    <Modal.Footer>
                        <div className='bg-primary text-white px-4 py-1 rounded-pill' style={{ fontSize: '12px', letterSpacing: '1px', cursor: 'pointer', opacity: sending ? '1' : '.5' }}
                            onClick={handleSave}>保存</div>
                    </Modal.Footer>
                </Modal.Body>
            </Modal>
            <Modal show={familyModalShow} onHide={familyModalClose} size='lg'>
                <FamilyInfo idValue={information.id} shopValue={information.in_charge_store} nameValue={information.customer_contacts_name} modalClose={familyModalClose} />
            </Modal>
        </>
    );
};

export default InformationEdit