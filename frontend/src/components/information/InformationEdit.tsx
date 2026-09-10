import React, { useEffect, useState, useContext, useRef, useMemo } from 'react';
import Modal from 'react-bootstrap/Modal';
import axios from 'axios';
import { headers } from '../../utils/headers';
import Table from "react-bootstrap/Table";
import { databaseList } from '../../utils/databaseList';
import { baseURL } from '../../utils/baseURL';
import FamilyInfo from '../FamilyInfo';
import { generateULID } from '../../utils/createULID';
import AuthContext from '../../context/AuthContext';
import Estate from '../Estate';
import KSnap from './KSnap';
import IceWorld from '../IceWorld';
import { labelStyle, buttonStyle, valueStyle, inputStyle, requiredStyle, safeFormate, expandButton, safeParse, dateFormate } from '../../utils/informationUtils';
import TableInput from './TableInput';
import TableSelect from './TableSelect';
import TableInterview from './TableInterview';
import TableCall from './TableCall';
import TableStatus from './TableStatus';
import TableMedium from './TableMedium';
import TableRank from './TableRank';
import TableStaff from './TableStaff';
import TableCompetitor from './TableCompetitor';
import TableCompetitorPdf from './TableCompetitorPdf';
import TableShop from './TableShop';
import TableTextarea from './TableTextarea';
import TableCheckboxGroup from './TableCheckboxGroup';
import FundingPlan from './FundingPlan';
import { useIsSp } from '../../utils/isSp';
import apiClient from '../../utils/apiClient';
import { uploadCompetitorPdf } from '../../utils/competitorPdfUpload';

type Staff = { name: string; shop: string; category: number, section: string, period: string };
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
    authority: string
};

type Maker = {
    label: string,
    letter: string
};

const idMapping = (text: string) => {
    const targetId = databaseList.find(d => d.value === text)?.id ?? '';
    return targetId;
};

const inquiryReasons: string[] = ['オーナー様・知人から聞いた', 'SNS(Instagram/Facebook/youtube/その他)', '看板を見た', '親・親戚から聞いた', 'インターネット検索', '新聞を見た', 'まとめサイトを見た', 'チラシを見た', 'その他'];

const houseHuntingMotivation: string[] = ['家賃がもったいない', '子どもが進学する', '土地をもらった', '家族が増える（減る）', 'オーナー様・知人が家を建てた', '家づくりは特に考えていない', '土地が見つかった', '親から勧められた', '工事費用が高くなる前に', '年齢的にそろそろ', '賃貸だと老後（退職後）が心配', '今の住まいが狭い', '水回り（キッチン・風呂・トイレ・洗面）が不便', '騒音が気になる', '収納が足りない', 'その他', '気密・断熱性にこだわりたい', '間取りにこだわりたい', '他人とは違った家にしたい', '耐震性にこだわりたい', 'インテリアにこだわりたい', '外観デザインにこだわりたい', '建築予定地が既にある', '収納にこだわりたい', '注文住宅にこだわりはない'];

const actionMap = {
    '資料送付': 'step_migration_item_catalog',
    '0次接客': 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22',
    '初回面談': 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
    '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
    '事前審査': 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
    'LINEグループ作成': 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
    '契約': 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'
};

/**
 * フッターのボタン共通スタイル。
 *
 * ⚠️ 横幅は文字数で決まるため、ここでは詰められない。
 *   padding（px-2 / px-3）と letterSpacing を 0 にすることで
 *   ボタンの実寸を縮めている。文字サイズは 12px のまま維持する
 *   （小さくすると SP の zoom 0.3 で読めなくなる）。
 */
const footerButtonStyle = {
    fontSize: '12px',
    fontWeight: '500',
    letterSpacing: '0',
    whiteSpace: 'nowrap' as const
};

const steps = [
    '事前審査提出',
    'LINE等で連絡可',
    '次回アポ済み',
    '候補地有(プラン提案中)',
    '事前審査承諾',
    '建築意思がある(自社他社問わず)',
    '土地買付受領',
    '建築申込',
    '土地内諾',
    '契約日決定',
    '入金済'
];
const InformationEdit = ({ id, token, onClose, authority }: Props) => {
    const { userName } = useContext(AuthContext);
    const { category } = useContext(AuthContext);
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
    const [estateId, setEstateId] = useState('');
    const competitorsRef = useRef<HTMLInputElement>(null);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const today = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const thisMonth = `${year}-${String(month).padStart(2, '0')}`;
    const thisYear = now.getMonth() <= 4 ? year : year + 1;
    const [competitorsInput, setCompetitorsInput] = useState('');
    const [originalMakerList, setOriginalMakerList] = useState<Maker[]>([]);
    const [makerList, setMakerList] = useState<Maker[]>([]);

    /**
     * 「デジシキ作成」ボタンを出すか。
     *
     * ─────────────────────────────────────────────
     * ⚠️ 2026-09-10 より、開発者権限に加えて **KH久留米店の担当者**にも開放している。
     *   店舗を増やすときは KH久留米店 の代わりに配列にすること。
     *
     * ⚠️⚠️ **`staffArray` は取得時に絞り込まれている。**
     *   `category === 1 && period === String(thisYear)`（233行目付近）。
     *   そのため period の条件はここでは実質重複だが、絞り込みの前提が
     *   変わったときに壊れないよう明示して残す。
     *   ⚠️ KH久留米店の在籍者5名は全員 category = 1 なので漏れない
     *     （2026-09-10 に staff_list で確認）。category が違う職種を
     *     対象に加えるなら、取得側の絞り込みから見直す必要がある。
     *
     * ⚠️ `staffArray` は API 取得後に埋まる。読み込み中の一瞬だけ
     *   ボタンが出ないが、他の項目も同じ挙動なので許容する。
     * ─────────────────────────────────────────────
     */
    const canUseFundingPlan = useMemo(() => {
        if (authority === 'Master') return true;
        return staffArray.some(item =>
            item.name === userName &&
            item.period === String(thisYear) &&
            item.shop === 'KH久留米店'
        );
    }, [authority, staffArray, userName, thisYear]);


    const [kSnap, setKSnap] = useState('');
    const [showDetail, setShowDetail] = useState('');
    const [introductoryList, setIntroductoryList] = useState<string[]>([]);
    const [rankSteps, setRankSteps] = useState<string[]>([]);
    const [eventList, setEventList] = useState<Record<string, string>[]>([]);
    const [showLostReason, setShowLostReason] = useState(false);
    const [competitorPdfFile, setCompetitorPdfFile] = useState<{ name: string, file: File | null, path?: string, staff?: string }[]>([]);
    const [showIceWorld, setShowIceWorld] = useState(false);
    const [editId, setEditId] = useState('');
    const isSp = useIsSp();

    useEffect(() => {
        if (!id) return;

        setInterviewer(userName);

        if (id === 'new') {
            setInformation(prev => ({
                step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: today,
                id: generateULID()
            }));
            setSending(false);
        }

        const fetchData = async () => {
            try {

                const response = await apiClient.post("", { request: "information", category, id });

                const shopData = response.data.shop.filter(s => s.division === '注文事業' && !s.shop.includes('未設定') && !s.shop.includes('全店舗'));
                setShopArray(shopData);

                setStaffArray(response.data.staff.filter(s => s.category === 1 && s.period === String(thisYear)));
                setMediumArray(response.data.medium);
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

    useEffect(() => {
        const formattedArray = safeParse(information.rank_steps);
        setRankSteps(formattedArray);
    }, [information]);



    const modalClose = () => onClose();

    const familyModalClose = () => {
        setFamilyMShow(false);
    };

    const handleSave = async () => {
        const requiredList = ['customer_contacts_name', 'in_charge_store', 'in_charge_user', 'status', 'sales_promotion_name'];

        if (!information.status) information.status = '見込み';
        if (!information.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 && id === 'new') information.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 = today;
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
            const key = actionMap[interview.action];
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
                    { day: interview.day, action: interview.action, note: interview.note, staff: userName }
                ]
            };
            updatedInterviewData = newInterviewLog;
        } else {
            updatedInterviewData = {
                ...interviewLog,
                id: information.id,
                name: information.customer_contacts_name,
                shop: information.in_charge_store,
            }
            updatedMasterData = information;
        }

        if (isAddInterview || interviewLog.add) {
            try {
                await apiClient.post("", { ...updatedInterviewData, request: 'information', roll: 'update_interview_log', category: 'common' });
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        }

        // 架電記録の保存
        let updatedCallData;
        let calendarAdd;
        let callLength;
        const isAddCallLog = call.day && call.action;

        const currentCallLogArray = Array.isArray(callLog?.call_log)
            ? callLog.call_log
            : (typeof callLog?.call_log === 'string' && (callLog.call_log as string).trim() !== ''
                ? JSON.parse(callLog.call_log as string)
                : []);

        if (isAddCallLog) {
            const newCallLog = {
                ...callLog,
                call_log: [
                    ...currentCallLogArray,
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
            callLength = currentCallLogArray.filter((c: any) => c.action === '通電' || c.action === '未通電').length;
        }

        if (callLog.status || isAddCallLog || callLog.add) {
            try {
                await apiClient.post("", { ...updatedCallData, request: 'information', roll: 'update_call_log', category: 'common' });
            } catch (error) {
                console.error("データ取得エラー:", error);
            }
        }


        console.log("送信するマスタデータ:", updatedMasterData);

        // ⚠️⚠️ **保存を2リクエストに分けている。**
        //
        //   ① 顧客情報（master_data）… JSON でゲートウェイへ → ② の Express が処理
        //   ② 競合PDF                … multipart で ① へ直接
        //
        //   PDF の実体は ① の uploads/competitors/ に置き、① の URL で配信して
        //   いる。② から ① のファイルシステムへは書けない。
        //   また multipart は core/express_proxy.php が転送しない設計である。
        //
        // ⚠️ **顧客情報を先に送る。** 新規顧客のときに master_data の行が
        //   無い状態で PDF だけ登録されるのを避けるため。
        //
        // ⚠️⚠️ 顧客情報の保存が失敗したら**利用者に見せて中断する。**
        //   以前は catch で console.error に流していたため、保存できていない
        //   のに閉じてしまい、面談で聞き取った内容が消えていた。
        //   ② が落ちている間はゲートウェイが 502 を返す（フォールバック禁止の
        //   仕組み。core/express_proxy.php の expressProxyExclusive を参照）。
        try {
            await apiClient.post("", {
                ...updatedMasterData,
                request: 'information',
                roll: 'customer_info',
                call_log: callLength,
                category,
            });
        } catch (error) {
            console.error("データ保存エラー:", error);
            alert('顧客情報の保存に失敗しました。\n通信状態を確認して、もう一度保存してください。');
            // ⚠️ 保存ボタンを押せる状態に戻す。戻さないと閉じるしかなくなる
            setSending(true);
            return;
        }

        try {
            await uploadCompetitorPdf(information.id, competitorPdfFile, token);
        } catch (error) {
            // ⚠️ PDF の失敗では中断しない。顧客情報は保存済みである。
            //   ただし黙って捨てず、何が保存できていないかを伝える。
            console.error("競合PDFの保存エラー:", error);
            alert('顧客情報は保存しました。\nただし競合資料(PDF)の保存に失敗しました。\nPDFのみ、もう一度添付して保存してください。');
        }

        const logJson = JSON.stringify(information);

        const logData = {
            id: information.id,
            customer: information.customer_contacts_name,
            staff: userName,
            log: logJson,
        };

        try {
            await apiClient.post("", { ...logData, request: 'information', category: 'common', roll: 'log' });
        } catch (err) {
            console.error("データ取得エラー:", err);
        }

        //以下インサイドセールス連携
        const callLogs = updatedCallData.call_log;
        const lastLog = callLogs && callLogs.length > 0 ? callLogs[callLogs.length - 1] : null;

        if (authority === 'insideSales' && calendarAdd && lastLog && lastLog.day && lastLog.time) {
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
            fetchCallData();
        }

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
        setCompetitorPdfFile([]);
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

    useEffect(() => {
        const filtered = originalMakerList.filter(o => o.letter.includes(competitorsInput) || o.label.includes(competitorsInput));
        setMakerList(filtered);
    }, [originalMakerList, competitorsInput]);


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

    const generateRandomId = (): string => {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < 4; i++) {
            const randomIndex = Math.floor(Math.random() * chars.length);
            result += chars.charAt(randomIndex);
        }
        return result;
    };

    const [photoPass, setPhotoPass] = useState('');

    const registerKSnap = (id: string) => {
        const fetchData = async () => {
            let isRegistered = false;
            let attempts = 0;
            const MAX_ATTEMPTS = 10;

            while (!isRegistered && attempts < MAX_ATTEMPTS) {
                attempts++;
                const pass = generateRandomId();
                try {
                    const response = await apiClient.post("", { request: "information", id, pass, category: 'common', roll: 'k-snap' });
                    if (response.data.status === 'success') {
                        isRegistered = true;
                        setShowDetail('k-snap');
                        setPhotoPass(pass);
                        setInformation(prev => ({
                            ...prev,
                            k_snap: pass
                        }));
                    }
                    else if (response.data.status === 'duplicate') {
                        console.warn(`重複が発生しました (${attempts}/${MAX_ATTEMPTS}回目)。パスワードを再生成してリトライします。`);
                    }
                    else {
                        console.error("登録エラーが発生しました:", response.data);
                        break;
                    }
                } catch (error) {
                    console.error("通信エラーが発生しました:", error);
                    break;
                }
            }
        };

        fetchData();
    };

    useEffect(() => {
        if (showDetail !== 'event') return;
        const fetchData = async () => {
            const response = await apiClient.post('', { request: 'event_list' });
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
                <Modal.Header closeButton><div style={{ fontSize: '12px', letterSpacing: '1px', fontWeight: 'bold' }}>{id === 'new' ? <div>新規顧客登録 </div> : `${information.in_charge_store ?? ''} ${information.customer_contacts_name ?? ''}様`}</div>
                    <div style={{ background: 'rgb(233, 233, 233)', fontSize: '11px' }} className='ms-1 fw-bold p-1 rounded'>※着色部分は特典進呈申請の際の必須項目</div>
                </Modal.Header>
                <Modal.Body>
                    <div style={{ height: '78vh', overflowY: 'scroll', overflowX: 'scroll', zoom: isSp ? 0.35 : 1 }}>
                        <div style={{ minWidth: '1000px' }}>
                            <Table responsive style={{ fontSize: '11px', textAlign: 'left' }} className='list_table database'>
                                <tbody>
                                    <tr>
                                        <td style={{ ...labelStyle, width: '10%' }} className='table-secondary'>お客様名<span style={requiredStyle}>必須</span></td>
                                        <td style={{ ...valueStyle, width: '40%' }} className='table-secondary'>
                                            <div>
                                                <TableInput information={information} setInformation={setInformation} itemKey={idMapping('お客様名')} defaultValue='氏名①' />
                                                <TableInput information={information} setInformation={setInformation} itemKey={idMapping('名前（かな）')} defaultValue='ふりがな①' />
                                            </div>
                                            <div>
                                                <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_name_2' defaultValue='氏名②' />
                                                <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_name_kana_2' defaultValue='ふりがな②' />
                                            </div>
                                        </td>
                                        <td style={{ ...labelStyle, width: '10%' }}>連絡先</td>
                                        <td style={{ ...valueStyle, width: '40%' }}>
                                            <div>
                                                <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_mobile_phone_number' defaultValue='電話番号①' widthValue='100px' numeric={true} />
                                                <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_phone_number' defaultValue='電話番号②' widthValue='100px' numeric={true} />
                                            </div>
                                            <div>
                                                <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_email' defaultValue='メールアドレス①' />
                                                <TableInput information={information} setInformation={setInformation} itemKey='extra_address_info' defaultValue='メールアドレス②' />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle} className='table-secondary'>住所</td>
                                        <td style={valueStyle} className='table-secondary'>
                                            <TableInput information={information} setInformation={setInformation} itemKey='postal_code' defaultValue='郵便番号' widthValue='80px' numeric={true} />
                                            <TableInput information={information} setInformation={setInformation} itemKey='full_address' defaultValue='住所' widthValue='300px' />
                                        </td>
                                        <td style={labelStyle} className='table-secondary'>担当店舗<span style={requiredStyle}>必須</span></td>
                                        <td style={valueStyle} className='table-secondary'>
                                            <TableShop
                                                information={information}
                                                setInformation={setInformation}
                                                idMapping={idMapping}
                                                staffArray={staffArray}
                                                shopArray={shopArray}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle} className='table-secondary'>担当営業<span style={requiredStyle}>必須</span></td>
                                        <td style={valueStyle} className='table-secondary'>
                                            <TableStaff
                                                information={information}
                                                setInformation={setInformation}
                                                idMapping={idMapping}
                                                staffArray={staffArray}
                                                setShowDetail={setShowDetail}
                                                id={id}
                                            />
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
                                            <TableRank
                                                information={information}
                                                setInformation={setInformation}
                                                idMapping={idMapping}
                                                thisMonth={thisMonth}
                                                setShowDetail={setShowDetail}
                                            />
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
                                        <td style={labelStyle}>生年月日</td>
                                        <td style={valueStyle}>
                                            <div className="d-flex align-items-center">
                                                <TableInput type='date' information={information} setInformation={setInformation}
                                                    itemKey='customer_contacts_birth_date' formattedValue={dateFormate(information.customer_contacts_birth_date)} />
                                                {information.customer_contacts_birth_date && <div className="ms-2">({calculateAge(information.customer_contacts_birth_date)}歳)</div>}
                                            </div>
                                        </td>
                                        <td style={labelStyle} className='table-secondary'>家族情報</td>
                                        <td style={valueStyle} className='table-secondary'><div style={buttonStyle}
                                            onClick={() => setFamilyMShow(true)}>入力・確認</div></td>
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
                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }} className='table-secondary'>
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
                                        <td colSpan={3} className='table-secondary'>
                                            <div style={expandStyle('interview')}>
                                                <TableInterview
                                                    information={information}
                                                    setInformation={setInformation}
                                                    interviewLog={interviewLog}
                                                    setInterviewLog={setInterviewLog}
                                                    actionMap={actionMap}
                                                    interview={interview}
                                                    setInterview={setInterview}
                                                    userName={userName} />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>
                                            <div className="position-relative">
                                                架電状況
                                                <div className='position-absolute'
                                                    style={{ ...expandButton, top: '21px' }}
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
                                                面談前アンケート
                                                <div className='position-absolute'
                                                    style={{ ...expandButton, top: '23px' }}
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
                                                <TableTextarea information={information} setInformation={setInformation} itemKey='customized_input_01J95TC6KEES87F0YXH29AJP7K' placeholder='面談前アンケート' />
                                            </div>
                                        </td>
                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>面談後アンケート</td>
                                        <td style={{ ...valueStyle, verticalAlign: 'top', paddingTop: '25px' }}>
                                            <div style={expandStyle('remarks')}>
                                                <TableTextarea information={information} setInformation={setInformation} itemKey='remarks' placeholder='面談後アンケート' />
                                            </div>
                                        </td>
                                    </tr>

                                    <tr>
                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>
                                            <div className="position-relative">
                                                問い合わせのきっかけ
                                                <div className='position-absolute'
                                                    style={{ ...expandButton, top: '35px' }}
                                                    onClick={() => {
                                                        setExpand(prev =>
                                                        ({
                                                            ...prev,
                                                            reason: !prev.reason
                                                        })
                                                        );
                                                    }}>{expand.reason ? '×閉じる' : '編集'}</div>
                                            </div></td>
                                        <td style={{ ...valueStyle, verticalAlign: 'top', paddingTop: '25px' }}>
                                            <div style={expandStyle('reason')}>
                                                <TableCheckboxGroup information={information} setInformation={setInformation} itemKey={idMapping('問い合せのきっかけ')} idPrefix='inquiry_reason' options={inquiryReasons} />
                                            </div>
                                        </td>
                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>建築動機</td>
                                        <td style={{ ...valueStyle, verticalAlign: 'top', paddingTop: '25px' }}>
                                            <div style={expandStyle('reason')}>
                                                <TableCheckboxGroup information={information} setInformation={setInformation} itemKey={idMapping('建築動機')} idPrefix='house_hunting_motivation' options={houseHuntingMotivation.slice(0, 25)} />
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ ...labelStyle, verticalAlign: 'top', paddingTop: '35px' }}>
                                            <div className="position-relative">
                                                注文住宅に興味をもった動機
                                                <div className='position-absolute'
                                                    style={{ ...expandButton, top: '40px' }}
                                                    onClick={() => {
                                                        setExpand(prev =>
                                                        ({
                                                            ...prev,
                                                            trigger: !prev.trigger
                                                        })
                                                        );
                                                    }}>{expand.trigger ? '×閉じる' : '編集'}</div>
                                            </div>
                                        </td>
                                        <td style={{ ...valueStyle, verticalAlign: 'top', paddingTop: '25px' }}>
                                            <div style={expandStyle('trigger')}>
                                                <TableCheckboxGroup information={information} setInformation={setInformation} itemKey={idMapping('建築動機')} idPrefix='house_hunting_motivation' options={houseHuntingMotivation.slice(16, 25)} />
                                            </div>
                                        </td>
                                        <td></td><td></td>
                                    </tr>
                                </tbody>
                            </Table>
                            <Table>
                                <tbody>
                                    <tr>
                                        <td style={{ ...labelStyle, width: '60px' }}>建設<br />予定地</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='planned_construction_site' />
                                        </td>
                                        <td style={{ ...labelStyle, width: '60px' }}>新築<br />計画</td>
                                        <td style={valueStyle}>
                                            <TableSelect information={information} setInformation={setInformation} itemKey={idMapping('新築計画')}
                                                list={['新築平屋', '新築2階建て', '建て替え平屋', '建て替え2階建て', 'その他']} defaultValue='選択してください' />
                                        </td>
                                        <td style={{ ...labelStyle, width: '60px' }}>入居<br />時期</td>
                                        <td style={valueStyle}>
                                            <TableSelect information={information} setInformation={setInformation} itemKey={idMapping('入居時期')}
                                                list={['すぐにでも', '半年～1年以内', '1年～2年以内', '2年以上後', 'その他']} defaultValue='選択してください' />
                                        </td>
                                        <td style={{ ...labelStyle, width: '60px' }}>土地の<br />状況</td>
                                        <td style={valueStyle}>
                                            <TableSelect information={information} setInformation={setInformation} itemKey={idMapping('土地の状況')}
                                                list={['自分で持っている（購入予定の土地がある）', '親・親族等の土地で建築予定', '土地を探している']} defaultValue='選択してください' />
                                        </td>
                                    </tr>
                                    <tr >
                                        <td style={labelStyle}>土地の<br />有無</td>
                                        <td style={valueStyle}>
                                            <TableSelect information={information} setInformation={setInformation} itemKey='has_owned_land'
                                                list={['無', '有']} defaultValue='選択してください' />
                                        </td>
                                        <td style={labelStyle}>重視<br />項目</td>
                                        <td style={valueStyle}>
                                            <TableSelect information={information} setInformation={setInformation} itemKey='customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN'
                                                list={['性能', 'デザイン', '価格', 'アフターサービス']} defaultValue='選択してください' />
                                        </td>
                                        <td style={labelStyle}>予算<br />総額</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='budget'
                                                defaultValue='予算総額' moneyManYen={true} />
                                            万円
                                        </td>
                                        <td style={labelStyle}>月々支<br />払予算</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='monthly_repayment_amount'
                                                defaultValue='月々支払予算' moneyManYen={true} />
                                            万円
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>返済希<br />望年数</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='repayment_years'
                                                defaultValue='返済希望年数' formattedValue={(information.repayment_years ?? '').replace(/[年\/]/g, '')} />
                                            年
                                        </td>
                                        <td style={labelStyle}>現居家賃</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='current_rent'
                                                defaultValue='現居家賃' moneyManYen={true} />
                                            万円
                                        </td>
                                        <td style={labelStyle}>自己<br />資金</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='self_budget'
                                                defaultValue='自己資金' moneyManYen={true} />
                                            万円
                                        </td>
                                        <td style={labelStyle}>現居<br />光熱費</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='current_utility_costs'
                                                defaultValue='現居光熱費' moneyManYen={true} />
                                            万円
                                        </td>
                                    </tr>
                                    <tr>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>負債<br />総額</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='current_loan_balance'
                                                defaultValue='自己資金' moneyManYen={true} />
                                            万円
                                        </td>
                                        <td style={labelStyle}>現居契<br />約形態</td>
                                        <td style={valueStyle}>
                                            <TableSelect information={information} setInformation={setInformation} itemKey='current_contract_type'
                                                list={['賃貸(マンション)', '賃貸(戸建)', '持家(マンション)', '持家(戸建)', '賃貸(アパート)']} defaultValue='選択してください' />
                                        </td>
                                        <td style={labelStyle}>雇用<br />形態</td>
                                        <td style={valueStyle}>
                                            <TableSelect information={information} setInformation={setInformation} itemKey='customer_contacts_employment_type'
                                                list={['経営者', '正社員', '契約社員', 'パート・アルバイト', '派遣社員', '専業主婦']} defaultValue='選択してください' />
                                        </td>
                                        <td style={labelStyle}>勤務<br />先名</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_employer_name'
                                                defaultValue='勤務先名' />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={labelStyle}>勤務先<br />住所</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_employer_address'
                                                defaultValue='勤務先住所' />
                                        </td>
                                        <td style={labelStyle}>勤続<br />年数</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_years_of_service'
                                                defaultValue='勤続年数' />
                                            年
                                        </td>
                                        <td style={labelStyle}>年収</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='customer_contacts_annual_income'
                                                defaultValue='年収' moneyManYen={true} />
                                            万円
                                        </td>
                                        <td style={labelStyle}>希望土<br />地面積</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='desired_land_area'
                                                defaultValue='希望土地面積' />
                                            坪
                                        </td>
                                    </tr>
                                    <tr>

                                        <td style={labelStyle}>土地の予算</td>
                                        <td style={valueStyle}>
                                            <TableInput information={information} setInformation={setInformation} itemKey='land_budget'
                                                defaultValue='土地の予算' moneyManYen={true} />
                                            万円
                                        </td>
                                        {[...Array(6)].map((_, index) => <td key={index}></td>
                                        )}
                                    </tr>
                                </tbody>
                            </Table>
                        </div>
                    </div>
                    <Modal.Footer className="bg-light border-top pb-3 pt-3" style={{ zoom: isSp ? 0.3 : 1 }}>
                        <div className="d-flex justify-content-end w-100 gap-2">
                            {/*
                              ⚠️ 並びの一番左。指示どおり isSp（スマートフォン）では表示しない。
                                別ウインドウで10タブ分の表を扱う画面なので、
                                スマートフォンでは実用にならない。
                              ⚠️ ボタン自体を出さない（disabled にしない）。
                                出すと押されて「開けません」と言われるだけになる。
                              ⚠️ 表示条件は canUseFundingPlan（宣言箇所のコメント参照）。
                            */}
                            {!isSp && canUseFundingPlan && (
                                <FundingPlan
                                    id={information.id}
                                    customerName={information.customer_contacts_name}
                                    isNew={id === 'new'}
                                />
                            )}

                            {information.k_snap ? (
                                <button
                                    className="btn btn-outline-secondary btn-sm rounded-pill px-2 d-flex align-items-center"
                                    style={footerButtonStyle}
                                    onClick={() => setKSnap(information.id)}
                                >
                                    <i className="fa-solid fa-camera me-1"></i>K-Snap閲覧ログ
                                </button>
                            ) : (
                                <button
                                    className="btn btn-outline-secondary btn-sm rounded-pill px-2 d-flex align-items-center"
                                    style={footerButtonStyle}
                                    onClick={() => registerKSnap(information.id)}
                                >
                                    <i className="fa-solid fa-user-plus me-1"></i>K-Snapアカウント発行
                                </button>
                            )}

                            <button
                                className="btn btn-outline-info btn-sm rounded-pill px-2 d-flex align-items-center"
                                style={footerButtonStyle}
                                onClick={() => {
                                    setEditId(information.id);
                                    setShowIceWorld(true);
                                }}
                            >
                                <i className="fa-regular fa-calendar-check me-1"></i>アイスワールド利用予約
                            </button>

                            <button
                                className="btn btn-outline-success btn-sm rounded-pill px-2 d-flex align-items-center"
                                style={footerButtonStyle}
                                onClick={() => setEstateId(information.id)}
                            >
                                <i className="fa-solid fa-map-location-dot me-1"></i>土地コーディネート
                            </button>

                            <button
                                className="btn btn-primary btn-sm rounded-pill px-3 shadow-sm d-flex align-items-center"
                                style={{ ...footerButtonStyle, fontWeight: 'bold', letterSpacing: '1px', opacity: sending ? '1' : '0.5' }}
                                onClick={handleSave}
                            >
                                <i className="fa-solid fa-check me-1"></i>保存
                            </button>
                        </div>
                    </Modal.Footer>
                </Modal.Body>
            </Modal >
            <Modal show={familyModalShow} onHide={familyModalClose} size='lg'>
                <FamilyInfo idValue={information.id} shopValue={information.in_charge_store} nameValue={information.customer_contacts_name} modalClose={familyModalClose} />
            </Modal>
            <Modal show={!!showDetail} centered onHide={() => setShowDetail('')}>
                <Modal.Header closeButton></Modal.Header>
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
                    {showDetail === 'rank' && <><div className="fw-bold text-center mb-3">ランク設定</div>
                        <div className="d-flex align-items-center justify-content-between pb-2 flex-wrap">
                            {steps.map((s, sIndex) =>
                                <div style={{ width: '48%', margin: '1%' }} key={sIndex}>
                                    <label style={{ fontSize: '11px', cursor: 'pointer' }} className='d-flex align-items-center'><input type="checkbox" value={s}
                                        checked={rankSteps.includes(s)}
                                        onChange={(e) => {
                                            const newArray = rankSteps.includes(e.target.value) ? rankSteps.filter(r => r !== e.target.value) : [...rankSteps, e.target.value];
                                            setRankSteps(newArray);
                                            const newRank = () => {
                                                const rankMap = {
                                                    'Cランク': ['事前審査提出', 'LINE等で連絡可', '次回アポ済み'],
                                                    'Bランク': ['候補地有(プラン提案中)', '事前審査承諾', '建築意思がある(自社他社問わず)'],
                                                    'Aランク': ['建築申込', '土地買付受領'],
                                                    'Sランク': ['土地内諾', '契約日決定', '入金済']
                                                };
                                                let currentRank = 'Dランク';
                                                for (const [rank, requiredSteps] of Object.entries(rankMap)) {
                                                    const isMatch = requiredSteps.every(step => newArray.includes(step));

                                                    if (!isMatch) {
                                                        break;
                                                    }

                                                    currentRank = rank;
                                                }
                                                return currentRank;
                                            };
                                            setInformation(prev => (
                                                {
                                                    ...prev,
                                                    [idMapping('顧客ランク')]: newRank(),
                                                    rank_steps: newArray.length > 0 ? JSON.stringify(newArray) : ''
                                                }
                                            ));
                                        }} /><span className='ps-2'>{s}</span></label>
                                </div>
                            )}
                        </div>
                        <div className="bg-danger text-white px-4 py-1 rounded-pill text-center mx-auto" style={{ fontSize: '12px', cursor: 'pointer', width: '120px' }} onClick={() => {
                            setShowDetail('');
                        }}>
                            保存
                        </div>
                    </>}
                    {showDetail === 'k-snap' &&
                        <div>
                            <div style={{ fontSize: '12px' }} className='mb-3'>K-Snapのアカウントを発行しました。以下の4文字をパスワードとしてお客様に共有してください。</div>
                            <div className='justify-content-center text-danger d-flex' style={{ fontSize: '25px' }}>{photoPass.split('').map(w =>
                                <div className='mx-2 text-center rounded'
                                    style={{ backgroundColor: '#b1b1b163', width: '30px' }}>{w}</div>)}</div>
                            <div className='text-center my-3'>https://k-snap.jp</div>
                            <div className="bg-danger text-white px-4 py-1 rounded-pill text-center mx-auto" style={{ fontSize: '12px', cursor: 'pointer', width: '120px' }} onClick={() => {
                                setShowDetail('');
                            }}>
                                閉じる
                            </div>
                        </div>}
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
                            <div className="d-flex">
                                <div className="bg-danger text-white px-4 py-1 rounded-pill" style={{ fontSize: '12px', cursor: 'pointer' }} onClick={() => {
                                    setShowDetail('');
                                }}>
                                    保存
                                </div>
                            </div>

                        </div></>}
                </Modal.Body>
            </Modal >
            <Estate estateId={estateId} setEstateId={setEstateId} />
            <KSnap id={kSnap} setKSnap={setKSnap} />
            <IceWorld shopList={shopArray.map(s => ({ brand: '', shop: s.shop }))} editId={editId} showIceWorld={showIceWorld} setShowIceWorld={setShowIceWorld} />
        </>
    );
};

export default InformationEdit