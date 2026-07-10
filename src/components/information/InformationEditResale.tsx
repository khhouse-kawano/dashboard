import React, { useEffect, useState, useContext, useRef } from 'react';
import Modal from 'react-bootstrap/Modal';
import axios from 'axios';
import { headers } from '../../utils/headers';
import Table from "react-bootstrap/Table";
import { databaseList } from '../../utils/databaseList';
import FamilyInfo from '../FamilyInfo';
import { generateULID } from '../../utils/createULID';
import AuthContext from '../../context/AuthContext';
import { labelStyle, buttonStyle, valueStyle, inputStyle, selectStyle, requiredStyle, safeFormate, competitorsStyle } from '../../utils/informationUtils';
import TableInput from './TableInput';
import TableSelect from './TableSelect';
import TableInterview from './TableInterview';
import TableCall from './TableCall';
import TableStatus from './TableStatus';
import TableMedium from './TableMedium';
import TableCompetitor from './TableCompetitor';
import TableCompetitorPdf from './TableCompetitorPdf';
import { calculateAge } from '../../utils/informationUtils';
import { dateFormate } from '../../utils/informationUtils';
import { useIsSp } from '../../utils/isSp';

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
    staff: string;
    status: string
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

type Maker = {
    label: string,
    letter: string
};

const actionMap = {
    '買い:中古リノベ': {
        '初回来場': 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
        '物件案内': 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG',
        '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
        '事前審査': 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
        'リフォーム契約': 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
        '売買契約': 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
    },
    '買い:ポータル': {
        '初回来場': 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
        '物件案内': 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG',
        '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
        '事前審査': 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
        '売買契約': 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
    },
    '売り:ポータル': {
        '査定アポ': 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV',
        '査定書提出': 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22',
        '訪問査定': 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
        '媒介取得': 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0',
    }
};
const InformationEditResale = ({ id, token, onClose, brand }: Props) => {
    const { userName } = useContext(AuthContext);
    const { category } = useContext(AuthContext);
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
    const [showDetail, setShowDetail] = useState('');
    const [showLostReason, setShowLostReason] = useState(false);
    const competitorsRef = useRef<HTMLInputElement>(null);
    const [competitorsInput, setCompetitorsInput] = useState('');
    const [originalMakerList, setOriginalMakerList] = useState<Maker[]>([]);
    const [makerList, setMakerList] = useState<Maker[]>([]);
    const [competitorPdfFile, setCompetitorPdfFile] = useState<{ name: string, file: File | null, path?: string, staff?: string }[]>([]);
    const [introductoryList, setIntroductoryList] = useState<string[]>([]);
    const [eventList, setEventList] = useState<Record<string, string>[]>([]);

    const isSp = useIsSp();

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
            setInformation({
                step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: today,
                id: generateULID()
            });
            setSending(false);
        }

        const fetchData = async () => {
            try {
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: "information", category, id }, { headers });

                setShopArray(categoryList);
                setStaffArray(response.data.staff.filter(s => s.category === 1 && Number(s.period) === thisYear));
                setMediumArray(response.data.medium.map(m => ({ ...m, list_medium: 1 })));
                setOriginalPropertyList(response.data.property.filter(p => p.store_name === '国分ハウジンググループ中古住宅専門店').map(p => p.property_name));
                setOriginalMakerList(response.data.maker);
                setIntroductoryList(response.data.introductory.map(i => i.name));

                if (id !== 'new') {
                    setInformation(response.data.customer);

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
                    setCompetitorPdfFile(safeParse(response.data.pdf.pdf_path));

                }
            } catch (error) {
                console.error("データの取得に失敗しました", error);

            } finally {
                setSending(true);
            }
        };

        fetchData();
    }, [id]);

    const idMapping = (text: string) => {
        const targetId = databaseList.find(d => d.value === text)?.id ?? '';
        return targetId;
    };

    const modalClose = () => onClose();

    const familyModalClose = () => {
        setFamilyMShow(false);
    };

    useEffect(() => {
        const filtered = originalMakerList.filter(o => o.letter.includes(competitorsInput) || o.label.includes(competitorsInput));
        setMakerList(filtered);
    }, [originalMakerList, competitorsInput]);

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

        setSending(false);

        let updatedMasterData: any = {};

        // 面談記録の保存
        let updatedInterviewData;

        const isAddInterview = interview.day && interview.action;

        if (isAddInterview) {
            const key = actionMap[information.in_charge_store][interview.action];
            information[key] = interview.day;
            updatedMasterData = {
                ...information,
                [key]: interview.day,
            };
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
            updatedInterviewData = newInterviewLog;
        } else {
            updatedInterviewData = {
                ...interviewLog,
                id: information.id,
                name: information.customer_contacts_name,
                shop: information.in_charge_store,
            };
            updatedMasterData = information;
        }

        if (isAddInterview || interviewLog.add) {
            try {
                await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { ...updatedInterviewData, request: 'information', roll: 'update_interview_log', category: 'common' }, { headers });
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        }

        // 架電記録の保存
        let updatedCallData;
        let calendarAdd;
        let callLength;

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
            };
            calendarAdd = true;
            callLength = newCallLog.call_log.filter(c => c.action === '通電' || c.action === '未通電').length;
        } else {
            updatedCallData = {
                ...callLog,
                id: information.id,
                name: information.customer_contacts_name,
                shop: information.in_charge_store,
                staff: information.in_charge_user,
            };
            calendarAdd = callLog.add;
            callLength = callLog.call_log.filter(c => c.action === '通電' || c.action === '未通電').length;
        }

        if (callLog.status || isAddCallLog || callLog.add) {
            try {
                await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { ...updatedCallData, request: 'information', roll: 'update_call_log', category: 'common' }, { headers });
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        }

        console.log("送信するマスタデータ:", updatedMasterData);

        const masterFormData = new FormData();

        const roll = id === 'new' ? 'add' : 'update';

        const postData = {
            ...updatedMasterData,
            request: 'information',
            call_log: callLength,
            category,
            roll
        };

        Object.keys(postData).forEach(key => {
            const value = postData[key];
            masterFormData.append(key, value !== null && value !== undefined ? value : '');
        });

        if (competitorPdfFile) {
            const existingFiles = competitorPdfFile
                .filter(item => !item.file && item.path)
                .map(item => ({ name: item.name, path: item.path, staff: item.staff }));

            masterFormData.append('existing_pdfs', JSON.stringify(existingFiles));

            competitorPdfFile.forEach((item) => {
                if (item.file) {
                    masterFormData.append('competitor_pdf_files[]', item.file);
                    masterFormData.append('competitor_pdf_names[]', item.name);
                    masterFormData.append('competitor_pdf_staff[]', item.staff ?? '');
                }
            });
        }

        for (let [key, value] of (masterFormData as any).entries()) {
            console.log(`FormDataの中身 - ${key}:`, value);
        }

        try {
            await axios.post("https://khg-marketing.info/dashboard/api/gateway/", masterFormData, {
                headers: {
                    ...headers,
                    'Content-Type': 'multipart/form-data'
                }
            });
        } catch (error) {
            console.error("データ保存エラー:", error);
        }

        const logJson = JSON.stringify(information);

        const logData = {
            id: information.id,
            customer: information.customer_contacts_name,
            staff: userName,
            log: logJson,
        };

        try {
            await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { ...logData, request: 'information', category: 'common', roll: 'log' }, { headers });
        } catch (err) {
            console.error("データ取得エラー:", err);
        }

        //以下インサイドセールス連携
        // const callLogs = updatedCallData.call_log;
        // const hasCallLog = callLogs && callLogs.length > 0;
        // const lastLog = hasCallLog ? callLogs[callLogs.length - 1] : null;

        // if (brand === 'insideSales' && calendarAdd && lastLog && lastLog.time) {
        //     const pad = (num: number): string => String(num).padStart(2, '0');

        //     const parseDateAndTime = (dateStr: string, timeStr: string): Date => {
        //         const [year, month, day] = dateStr.split('-').map(Number);
        //         const [hours, minutes] = timeStr.split(':').map(Number);
        //         return new Date(year, month - 1, day, hours, minutes, 0);
        //     };

        //     const formatLocalISO = (d: Date): string => {
        //         const year = d.getFullYear();
        //         const month = pad(d.getMonth() + 1);
        //         const day = pad(d.getDate());
        //         const hours = pad(d.getHours());
        //         const minutes = pad(d.getMinutes());
        //         const seconds = pad(d.getSeconds());
        //         return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        //     };

        //     const lastLog = updatedCallData.call_log[updatedCallData.call_log.length - 1];
        //     const startDate = parseDateAndTime(lastLog.day, lastLog.time);
        //     const endDate = new Date(startDate.getTime() + 10 * 60000); // 10分後

        //     const data = {
        //         name: callLog.name,
        //         detail: `${lastLog.action}\n${lastLog.note}`,
        //         startTime: formatLocalISO(startDate),
        //         endTime: formatLocalISO(endDate)
        //     };

        //     const fetchCallData = async () => {
        //         try {

        //             await axios.post(`${baseURL}/api/add_event`, data, { headers });
        //         } catch (error) {
        //             console.error("データ取得エラー:", error);
        //         }
        //     };
        //     await fetchCallData();
        // }

        setInformation(prev =>
            Object.fromEntries(
                Object.keys(prev).map(key => [key, ''])
            )
        );
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
        modalClose();
    };

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

    const handleCompetitors = (maker?: string) => {
        const value = (maker || competitorsInput || '').trim();
        if (!value) return;

        setInformation(prev => {
            const existing = (prev.competitors_text ?? '')
                .split(',')
                .map(s => s.trim())
                .filter(s => s !== '' && s !== 'null');

            if (existing.includes(value)) return prev;

            const newArr = [...existing, value];
            return {
                ...prev,
                competitors_text: newArr.join(',')
            };
        });

        setCompetitorsInput('');
        if (competitorsRef.current) {
            competitorsRef.current.value = '';
        }
    };

    const handleCompetitorsDelete = () => {
        if (competitorsRef.current && competitorsRef.current.value.length > 0) return;
        if (!information.competitors_text) return;
        setInformation(prev => {
            const existing = (prev.competitors_text ?? '')
                .split(',')
                .map(s => s.trim())
                .filter(s => s !== '' && s !== 'null');
            existing.pop();
            return {
                ...prev,
                competitors_text: existing.length ? existing.join(',') : ''
            }
        });
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

    useEffect(() => {
        if (showDetail !== 'event') return;
        const fetchData = async () => {
            const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: 'event_list' }, { headers });
            setEventList(response.data.event);
        };
        fetchData();
    }, [showDetail]);

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
                    <div style={{ height: '78vh', overflowY: 'scroll', overflowX: 'scroll', zoom: isSp ? 0.35 : 1 }}>
                        <div style={{ minWidth: '1000px' }}>
                            <Table responsive style={{ fontSize: '11px', textAlign: 'left' }} className='list_table database'>
                                <tbody>
                                    <tr>
                                        <td style={{ ...labelStyle, width: '10%' }}>お客様名<span style={requiredStyle}>必須</span></td>
                                        <td style={{ ...valueStyle, width: '40%' }}>
                                            <TableInput information={information} setInformation={setInformation} itemKey={idMapping('お客様名')} defaultValue='漢字' />
                                            <TableInput information={information} setInformation={setInformation} itemKey={idMapping('名前（かな）')} defaultValue='ふりがな' />
                                        </td>
                                        <td style={{ ...labelStyle, width: '10%' }}>連絡先</td>
                                        <td style={{ ...valueStyle, width: '40%' }}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_phone_number' defaultValue='固定電話' widthValue='100px' numeric={true} />
                                            <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_mobile_phone_number' defaultValue='携帯電話' widthValue='100px' numeric={true} />
                                            <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_email' defaultValue='メールアドレス' numeric={true} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>住所</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='postal_code' defaultValue='郵便番号' widthValue='80px' numeric={true} />
                                            <TableInput information={information} setInformation={setInformation} itemKey='full_address' defaultValue='住所' widthValue='300px' />
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
                                                        [idMapping('担当店舗')]: e.target.value,
                                                        [idMapping('担当営業')]: selected?.name || "",
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
                                                    const newStaff = e.target.value;
                                                    const listedCustomer = `${information.in_charge_store} 管理`;

                                                    const selected = staffArray.find(item => item.name === newStaff);
                                                    const nextStaffName = selected?.name || newStaff;

                                                    setInformation(prev => ({
                                                        ...prev,
                                                        [idMapping('担当営業')]: nextStaffName,
                                                        first_interviewed_user: id !== 'new' ? safeFormate(prev[idMapping('担当営業')]) : ''
                                                    }));

                                                    if (newStaff === listedCustomer && id !== 'new') {
                                                        setShowDetail('staff');
                                                    }
                                                }}
                                            >
                                                <option value=''>担当営業を選択</option>
                                                {staffArray
                                                    .filter(item => item.shop === '中専鹿児島店')
                                                    .map((item, index) => (
                                                        <option key={index} value={item.name}>
                                                            {item.name}
                                                        </option>
                                                    ))}
                                                <option value={`${information.in_charge_store} 管理`}>{information.in_charge_store} 管理</option>
                                            </select>

                                            {(information[idMapping('担当営業')] === `${information.in_charge_store} 管理` && information.first_interviewed_user)
                                                && <div className="ms-2">変更前:{safeFormate(information.first_interviewed_user)}({safeFormate(information.last_action_step_migration_item_name)})</div>}
                                        </td>
                                        <td style={labelStyle}>ステータス</td>
                                        <td style={valueStyle}>
                                            <TableStatus
                                                information={information}
                                                setInformation={setInformation}
                                                idMapping={idMapping}
                                                setShowLostReason={setShowLostReason}
                                                competitorsRef={competitorsRef}
                                                competitorsInput={competitorsInput}
                                                handleCompetitorsDelete={handleCompetitorsDelete}
                                                handleCompetitors={handleCompetitors}
                                                setCompetitorsInput={setCompetitorsInput}
                                                makerList={makerList} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>顧客ランク<br />(契約見込み月)</td>
                                        <td style={valueStyle}>
                                            <div className="d-flex">
                                                <TableSelect information={information} setInformation={setInformation} itemKey={idMapping('顧客ランク')}
                                                    list={['Sランク', 'Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク']}
                                                    defaultValue='ランクを選択' />
                                                <TableInput information={information} setInformation={setInformation} itemKey='rank_period' widthValue='100px' type='month'
                                                    formattedValue={information.rank_period && information.rank_period >= thisMonth ? information.rank_period.replace(/\//g, '-') : thisMonth} />
                                            </div>
                                        </td>
                                        <td style={labelStyle}>反響媒体<span style={requiredStyle}>必須</span></td>
                                        <td style={valueStyle}>
                                            <TableMedium
                                                information={information}
                                                setInformation={setInformation}
                                                idMapping={idMapping}
                                                setShowDetail={setShowDetail}
                                                mediumArray={mediumArray} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>家族情報</td>
                                        <td style={valueStyle}><div style={buttonStyle}
                                            onClick={() => setFamilyMShow(true)}>入力・確認</div></td>
                                        <td style={labelStyle}>物件連携</td>
                                        <td style={valueStyle}>
                                            <div className="text-secondary" style={{ fontSize: '10px' }}>※リストをクリックして選択</div>
                                            <div className="d-flex align-items-center position-relative">
                                                <div className="d-flex flex-wrap align-items-center flex-grow-1 p-1 bg-white border rounded shadow-sm position-relative" style={{ minHeight: '34px' }}>
                                                    {information.property_name &&
                                                        information.property_name.split(',')
                                                            .filter(c => c !== 'null')
                                                            .map((c, cIndex) =>
                                                                <div className='badge border d-flex align-items-center me-1 my-1 px-2 py-1 shadow-sm bg-light text-secondary border-secondary' key={cIndex}>{c}
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
                                                        style={{ top: '30px', zIndex: '1000' }}>
                                                        {propertyInput &&
                                                            propertyList
                                                                .map((m, mIndex) =>
                                                                    <div key={mIndex}
                                                                        style={{ cursor: 'pointer', width: 'fit-content' }}
                                                                        className='badge border d-flex align-items-center me-1 my-1 px-2 py-1 shadow-sm bg-light text-secondary border-secondary'
                                                                        onClick={() => handleProperty(m)}
                                                                    >{m}</div>)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>競合情報</td>
                                        <td style={valueStyle}>
                                            <TableCompetitor
                                                information={information}
                                                setInformation={setInformation}
                                                competitorsRef={competitorsRef}
                                                competitorsInput={competitorsInput}
                                                handleCompetitorsDelete={handleCompetitorsDelete}
                                                handleCompetitors={handleCompetitors}
                                                setCompetitorsInput={setCompetitorsInput}
                                                makerList={makerList}
                                            />
                                        </td>

                                        <td style={labelStyle}>競合資料 (PDF)</td>
                                        <td style={valueStyle}>
                                            <TableCompetitorPdf
                                                userName={userName}
                                                setCompetitorPdfFile={setCompetitorPdfFile}
                                                competitorPdfFile={competitorPdfFile}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>入居希望地</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='planned_construction_site'
                                                widthValue='240px' />
                                        </td>
                                        <td style={labelStyle}>生年月日</td>
                                        <td style={valueStyle}>
                                            <div className="d-flex align-items-center">
                                                <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_birth_date'
                                                    type='date' formattedValue={dateFormate(information.customer_contacts_birth_date)} />
                                                {information.customer_contacts_birth_date && <div className="ms-2">({calculateAge(information.customer_contacts_birth_date)}歳)</div>}
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>
                                            <div className="position-relative">
                                                商談ステップ
                                                <div className='position-absolute'
                                                    style={buttonStyle}
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
                                                <TableInterview
                                                    information={information}
                                                    setInformation={setInformation}
                                                    interviewLog={interviewLog}
                                                    setInterviewLog={setInterviewLog}
                                                    actionMap={actionMap[information.in_charge_store] ?? {}}
                                                    interview={interview}
                                                    setInterview={setInterview}
                                                    userName={userName

                                                    } />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>
                                            <div className="position-relative">
                                                架電状況
                                                <div className='position-absolute'
                                                    style={buttonStyle}
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
                                                <TableCall
                                                    information={information}
                                                    setInformation={setInformation}
                                                    callLog={callLog}
                                                    setCallLog={setCallLog}
                                                    interviewer={interviewer}
                                                    call={call}
                                                    setCall={setCall} />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>
                                            <div className="position-relative">
                                                備考
                                                <div className='position-absolute'
                                                    style={buttonStyle}
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
                                        <td style={labelStyle}>入居希望時期</td>
                                        <td style={valueStyle}>
                                            <TableSelect information={information} setInformation={setInformation} itemKey={idMapping('入居時期')}
                                                list={['すぐにでも', '半年～1年以内', '1年～2年以内', '2年以上後', 'その他']} defaultValue='選択してください' />
                                        </td>
                                        <td style={labelStyle}>購入可能時期</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='customized_input_01JSE7RNV3VK78YC2GYAG0554D'
                                                type='month' />
                                        </td>
                                        <td style={labelStyle}>予算総額</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='budget'
                                                defaultValue='予算総額' formattedValue={(information.budget ?? '').replace('万円', '')} numeric />
                                            万円
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>月々支払予算</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='monthly_repayment_amount'
                                                defaultValue='月々支払予算' formattedValue={(information.monthly_repayment_amount ?? '').replace('0000', '')} numeric />
                                            万円
                                        </td>
                                        <td style={labelStyle}>返済希望年数</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='repayment_years'
                                                defaultValue='返済希望年数' formattedValue={(information.repayment_years ?? '').replace(/[年\/]/g, '')} numeric />
                                            年
                                        </td>
                                        <td style={labelStyle}>現居家賃</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='current_rent'
                                                defaultValue='現居家賃' formattedValue={safeFormate(information.current_rent).replace('0000', '')} numeric />
                                            万円
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>自己資金</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='self_budget'
                                                defaultValue='自己資金' formattedValue={safeFormate(information.self_budget).replace('0000', '')} numeric />
                                            万円
                                        </td>
                                        <td style={labelStyle}>現居光熱費</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='current_utility_costs'
                                                defaultValue='現居光熱費' formattedValue={safeFormate(information.current_utility_costs).replace('万円', '')} numeric />
                                            万円
                                        </td>
                                        <td style={labelStyle}>負債総額</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='current_loan_balance'
                                                defaultValue='自己資金' formattedValue={safeFormate(information.current_loan_balance).replace('0000', '')} numeric />
                                            万円
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>現居契約形態</td>
                                        <td style={valueStyle}>
                                            <TableSelect information={information} setInformation={setInformation} itemKey='current_contract_type'
                                                list={['賃貸(マンション)', '賃貸(戸建)', '持家(マンション)', '持家(戸建)', '賃貸(アパート)']} defaultValue='選択してください' />
                                        </td>
                                        <td style={labelStyle}>雇用形態</td>
                                        <td style={valueStyle}>
                                            <TableSelect information={information} setInformation={setInformation} itemKey='customer_contacts_employment_type'
                                                list={['経営者', '正社員', '契約社員', 'パート・アルバイト', '派遣社員', '専業主婦']} defaultValue='選択してください' />
                                        </td>
                                        <td style={labelStyle}>勤務先名</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_employer_name'
                                                defaultValue='勤務先名' />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>勤務先住所</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_employer_address'
                                                defaultValue='勤務先住所' />
                                        </td>
                                        <td style={labelStyle}>勤続年数</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_years_of_service'
                                                defaultValue='勤続年数' numeric />
                                            年
                                        </td>
                                        <td style={labelStyle}>年収</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_annual_income'
                                                defaultValue='年収' numeric />
                                            万円
                                        </td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>
                    </div>
                    <Modal.Footer className="bg-light border-top pb-3 pt-3" style={{ zoom: isSp ? 0.3 : 1 }}>
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
            <Modal show={!!showDetail} centered>
                <Modal.Body>
                    {showDetail === 'staff' && <><div className="fw-bold text-center mb-3">店舗管理への変更理由</div>
                        <div className="d-flex align-items-center justify-content-around pb-2">
                            <select style={{ ...inputStyle, fontSize: '12px', width: '240px' }} value={safeFormate(information.last_action_step_migration_item_name)}
                                onChange={(e) => {
                                    setInformation(prev => (
                                        {
                                            ...prev,
                                            last_action_step_migration_item_name: e.target.value
                                        }
                                    ));
                                }}>
                                <option value="">選択してください</option>
                                {["失注", "計画中止", "計画延期", "ブラックリスト", "建築エリア外", "物貰い", "連絡不能", "その他"].map(reason => <option value={reason} key={reason}>{reason}</option>)}
                            </select>
                            <div className="bg-danger text-white px-4 py-1 rounded-pill" style={{ fontSize: '12px', cursor: 'pointer' }} onClick={() => {
                                if (information.last_action_step_migration_item_name) {
                                    setShowDetail('');
                                } else {
                                    alert('理由を選択してください');
                                }

                            }}>
                                保存
                            </div>
                        </div></>}
                    {showDetail === 'medium' && <><div className="fw-bold text-center mb-3">紹介者を選択</div>
                        <div className="d-flex align-items-center justify-content-around pb-2">
                            <select style={{ ...inputStyle, fontSize: '12px', width: '240px' }} value={safeFormate(information.introduction_person_category)}
                                onChange={(e) => {
                                    setInformation(prev => (
                                        {
                                            ...prev,
                                            introduction_person_category: e.target.value
                                        }
                                    ));
                                }}>
                                <option value="">選択してください</option>
                                {introductoryList.map((item, index) => <option key={index} value={item}>{item}</option>)}
                            </select>
                            <div className="bg-danger text-white px-4 py-1 rounded-pill" style={{ fontSize: '12px', cursor: 'pointer' }} onClick={() => {
                                setShowDetail('');
                            }}>
                                保存
                            </div>
                        </div></>}
                    {showDetail === 'event' && <><div className="fw-bold text-center mb-3">イベント名を選択</div>
                        <div className="d-flex align-items-center justify-content-around pb-2">
                            <select style={{ ...inputStyle, fontSize: '12px', width: '240px' }} value={safeFormate(information.customized_input_01JRCT12N9X24PCQ5QZPAYKB93)}
                                onChange={(e) => {
                                    setInformation(prev => (
                                        {
                                            ...prev,
                                            customized_input_01JRCT12N9X24PCQ5QZPAYKB93: e.target.value
                                        }
                                    ));
                                }}>
                                <option value="">選択してください</option>
                                {eventList.map((item, index) => <option key={index} value={`${item.startDate}_${item.title}`}>{item.startDate}_{item.title}</option>)}
                            </select>
                            <div className="bg-danger text-white px-4 py-1 rounded-pill" style={{ fontSize: '12px', cursor: 'pointer' }} onClick={() => {
                                setShowDetail('');
                            }}>
                                保存
                            </div>
                        </div></>}
                </Modal.Body>
            </Modal >
        </>
    );
};

export default InformationEditResale