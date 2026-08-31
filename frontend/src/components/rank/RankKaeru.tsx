import React, { useEffect, useMemo, useState, useContext, useCallback } from 'react';
import Table from "react-bootstrap/Table";
import "../SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../../context/AuthContext';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import { getFiscalYearMonthsFromJune } from '../../utils/getFiscalYearMonthsFromJune';
import InformationEditKaeru from '../information/InformationEditKaeru';
import InterviewLog from '../InterviewLog';
import StaffMemo from './StaffMemo';
import { getYears } from '../../utils/getYears';
import { staffSorter } from '../../utils/staffSorter';
import { useIsSp } from '../../utils/isSp';
import apiClient from '../../utils/apiClient';

type Customer = Record<string, string>;
type Achievement = { category: string, name: string, period: string, value: string }
type Expect = { date: string, shop: string, section: string, count: number };
type Target = { [key: string]: boolean };
type Shop = { brand: string, shop: string, section: string, area: string, division: string };
type Label = { label: string, show: boolean, category: string };
type Staff = { id: number, name: string, pg_id: string, shop: string, mail: string, status: string, category: number, rank: number, sort: number, period: string, position: string };
type Memo = Record<string, string>;

const RankOrder = () => {
    const { token, category, authority } = useContext(AuthContext);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [targetMonth, setTargetMonth] = useState('');
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [sections, setSections] = useState<string[]>([]);
    const [expectedContract, setExpectedContract] = useState<Expect[]>([]);
    const [showTarget, setShowTarget] = useState<Target>({});
    const [shopList, setShopList] = useState<Shop[]>([]);
    const [originalStaffList, setOriginalStaffList] = useState<Staff[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [newExpected, setNewExpected] = useState<Expect>({
        date: '',
        shop: '',
        section: '',
        count: 0
    });
    const [modalList, setModalList] = useState<Customer[]>([]);
    const [page, setPage] = useState(20);
    const [achievement, setAchievement] = useState<Achievement[]>([]);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const [editId, setEditId] = useState('');
    const [interviewId, setInterviewId] = useState('');
    const yearSetting = (year: number, month: number) => {
        return Number(month) <= 4 ? String(year) : String(year + 1)
    };
    const [memoList, setMemoList] = useState<Memo[]>([]);
    const isSp = useIsSp();

    const fetchCustomerData = async () => {
        return await apiClient.post('', { request: "rank", category });
    };

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));
        setTargetMonth(`${year}/${month}`);

        const fetchData = async () => {
            try {
                const response = await fetchCustomerData();
                await setCustomerList(response.data.customer);
                await setExpectedContract(response.data.expected);
                await setShopList(response.data.shop);
                const sectionNames = response.data.section.map((s: any) => s.name);
                setSections(sectionNames);
                await setOriginalStaffList(response.data.staff);
                await setAchievement(response.data.achievement);
                setMemoList(
                    response.data.staff.map(s => ({
                        staff: s.name,
                        shop: s.shop,
                        memo: s.memo,
                    }))
                );

            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();

    }, []);

    useEffect(() => {
        const [yearValue, monthValue] = targetMonth.split('/');
        const formattedYearValue = monthValue ? yearSetting(Number(yearValue), Number(monthValue)) : yearValue;
        const filtered = originalStaffList.filter(o => o.period === String(formattedYearValue));
        setStaffList(filtered);
    }, [originalStaffList, targetMonth]);

    const OverlayTriggerComponent = ({ label, desc }) => {
        return (
            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{desc}</Tooltip>}>
                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>{label}</span>
            </OverlayTrigger>)
    };

    const tooltipItems = [
        { label: '総反響', desc: (<>{targetMonth}の総反響数</>) },
        // { label: '来場率', desc: '来場者数/総反響' },
        { label: '接触数', desc: (<>{targetMonth}の通話及びメールへの返信数</>) },
        { label: '来場数', desc: (<>{targetMonth}の来場者数</>) },
        { label: '次アポ数', desc: (<>{targetMonth}の2回目以降の面談数</>) },
        { label: '契約数(率)', desc: (<>契約者数/来場者数</>) },
        // { label: '当月確約数', desc: (<>{targetMonth}の契約が確実な数</>) },
        // { label: '見込数', desc: (<>{targetMonth}の見込数</>) },
        { label: '目標数', desc: (<>{targetMonth}の目標数</>) },
        { label: '目標達成率', desc: (<>契約者数/予算</>) },
        { label: 'Sランク', desc: '契約済み' },
        { label: 'Aランク', desc: '契約予定(申込有)' },
        { label: 'Bランク', desc: '次回結論' },
        { label: 'Cランク', desc: '商談案件' },
        { label: 'Dランク', desc: '追客保有名簿' },
        { label: 'Eランク', desc: 'フリー顧客' },
        { label: 'Fランク', desc: '没' },
    ];

    const rankLabels = ['Sランク', 'Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク', 'Fランク'];

    const background = {
        '建売分譲事業': 'table-secondary ',
        '不動産営業1課': 'table-primary ',
        '不動産営業2課': 'table-success ',
    };

    const dateFormate = (value: string) => {
        return (value ?? '').replace(/-/g, '/')
    };
    const ym = (value: any) => dateFormate(value).slice(0, 7);

    const expandTarget = (target: Label) => {
        if (target.category === 'staff') return; // スタッフ行はクリックしても何もしない

        setShowTarget(prev => ({
            ...prev,
            [target.label]: !prev[target.label] // true と false を反転
        }));
    };

    const formate = (value: string) => {
        return (value ?? '').replace(/-/g, '/');
    };

    const getTargetYears = (value: string) => {
        if (value.length !== 4) return [];
        const start = Number(value) - 1;
        let monthArray: string[] = [];
        for (let i = start; i <= start + 1; i++) {
            if (i === start) monthArray.push(`${String(i)}/06`, `${String(i)}/07`, `${String(i)}/08`, `${String(i)}/09`, `${String(i)}/10`, `${String(i)}/11`, `${String(i)}/12`);
            if (i === start + 1) monthArray.push(`${String(i)}/01`, `${String(i)}/02`, `${String(i)}/03`, `${String(i)}/04`, `${String(i)}/05`);
        }
        return monthArray;
    };

    const baseData = useMemo(() => {
        const isPeriod = targetMonth.length === 4;
        const thisYearPeriod = isPeriod ? getFiscalYearMonthsFromJune(targetMonth) : [];

        const checkDate = (dateStr: string) => {
            if (!dateStr) return false;
            const fmt = dateFormate(dateStr.replace(/-/g, '/')).slice(0, 7);
            return isPeriod ? thisYearPeriod.includes(fmt) : fmt === targetMonth;
        };

        const register = customerList.filter(c => checkDate(c.register));
        const contract = customerList.filter(c => c.status === '契約済み' && checkDate(c.contract));
        const interviewBase = customerList.filter(c => checkDate(c.interview));
        const appointmentOther = customerList.filter(c =>
            !c.interview && (checkDate(c.appointment) || checkDate(c.screening) || checkDate(c.contract))
        );
        const appointmentBase = customerList.filter(c =>
            checkDate(c.interview) && (c.appointment || c.screening || c.contract)
        );
        const interview = [...interviewBase, ...appointmentOther];
        const appointment = [...appointmentBase, ...appointmentOther];

        return { register, contract, interview, appointment, all: customerList };
    }, [customerList, targetMonth, staffList]);

    const displayLabelList = useMemo<Label[]>(() => {
        const list: Label[] = [];

        sections.forEach(sectionName => {
            list.push({ category: 'section', label: sectionName, show: false });

            if (showTarget[sectionName]) {
                const shops = shopList.filter(s => s.section === sectionName);

                shops.forEach(shop => {
                    list.push({ category: 'shop', label: shop.shop, show: false });

                    if (showTarget[shop.shop]) {
                        const staffs = staffList
                            .filter(s => s.shop === shop.shop)
                            .sort(staffSorter());

                        staffs.forEach(staff => {
                            list.push({ category: 'staff', label: staff.name, show: false });
                        });
                    }
                });
            }
        });

        return list;
    }, [sections, shopList, staffList, showTarget]);

    const getFiltered = useCallback((
        period: string,
        category: string,
        target: string,
        index: number,
        rank: string,
        rank_period: number
    ) => {
        const isPeriod = targetMonth.length === 4;
        let targetPeriod = '';
        if (rank_period > 0 && !isPeriod) {
            const [yStr, mStr] = targetMonth.split('/');
            const d = new Date(Number(yStr), Number(mStr) - 1 + rank_period, 1);
            targetPeriod = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        }

        // --- 丸め込み用KPIキーの定義 ---
        const registerKeys = ['register'] as const;
        const contactKeys = ['contact'] as const;
        const interviewKeys = ['interview', 'tour'] as const;
        const appointmentKeys = ['appointment'] as const;
        const screeningKeys = ['screening', 'obtain'] as const;
        const applicationKeys = ['application'] as const;
        const contractKeys = ['contract', 'contract_broker'] as const;

        const formattedPeriod = getTargetYears(targetMonth);
        const formattedMonth = formate(targetMonth);
        console.log(formattedPeriod)

        // 月(または期間)の一致判定関数
        const hasMatchInMonth = (b: Customer, keys: readonly string[]) => {
            return keys.some(key => {
                const val = formate(b[key as keyof Customer] as string) || '';
                if (!val) return false;
                return isPeriod
                    ? formattedPeriod.includes(val.slice(0, 7))
                    : val.includes(formattedMonth);
            });
        };

        // 対象キーが全て空かどうかの判定関数
        const isAllEmpty = (b: Customer, keys: readonly string[]) => {
            return keys.every(key => !b[key as keyof Customer]);
        };

        const targetShops = category === 'section' ? shopList.filter(s => s.section === target).map(s => s.shop) : [];

        // 大元の baseData.all に対して、カテゴリ・ランク・KPI丸め込みの条件を1回のループで判定する
        return baseData.all.filter(item => {
            // --- 1. カテゴリ/店舗の判定 ---
            let matchCategory = true;
            if (index > 0) {
                if (category === 'section') {
                    matchCategory = targetShops.includes(item.shop);
                } else {
                    matchCategory = (item as any)[category] === target;
                }
            }
            if (!matchCategory) return false;

            // --- 2. ランクの判定 ---
            if (isPeriod) {
                if (rank && (item.rank !== rank || (item.status ?? '').includes('契約'))) return false;
            } else {
                if (rank) {
                    if (item.rank !== rank || (item.status ?? '').includes('契約')) return false;
                    if (rank_period > 0) {
                        if (item.rank_period !== targetPeriod) return false;
                    } else {
                        if (item.rank_period && item.rank_period > targetMonth) return false;
                    }
                    if (rank === 'Sランク' && (!formate(item.contract ?? '').includes(formate(targetMonth)) && !formate(item.contract_broker ?? '').includes(formate(targetMonth)))) return false;
                }
            }

            // --- 3. KPIと丸め込みの判定 ---
            if (period === 'register') {
                const higherKeys = [...contactKeys, ...interviewKeys, ...appointmentKeys, ...screeningKeys, ...applicationKeys, ...contractKeys];
                if (!hasMatchInMonth(item, registerKeys) && !(isAllEmpty(item, registerKeys) && hasMatchInMonth(item, higherKeys))) return false;
            }
            if (period === 'contact') {
                const higherKeys = [...interviewKeys, ...appointmentKeys, ...screeningKeys, ...applicationKeys, ...contractKeys];
                if (!hasMatchInMonth(item, contactKeys) && !(isAllEmpty(item, contactKeys) && hasMatchInMonth(item, higherKeys))) return false;
            }
            else if (period === 'interview') {
                const higherKeys = [...appointmentKeys, ...screeningKeys, ...applicationKeys, ...contractKeys];
                if (!hasMatchInMonth(item, interviewKeys) && !(isAllEmpty(item, interviewKeys) && hasMatchInMonth(item, higherKeys))) return false;
            }
            else if (period === 'appointment') {
                const higherKeys = [...screeningKeys, ...applicationKeys, ...contractKeys];
                if (!hasMatchInMonth(item, appointmentKeys) && !(isAllEmpty(item, appointmentKeys) && hasMatchInMonth(item, higherKeys))) return false;
            }
            else if (period === 'contract') {
                if (!(item.status ?? '').includes('契約済み') || !hasMatchInMonth(item, contractKeys)) return false;
            }
            else if (period) {
                // register, screening, application など上記以外の単体KPIに対するフォールバック
                if (!hasMatchInMonth(item, [period])) return false;
            }

            // 全ての条件をクリアしたデータだけを返す
            return true;
        });

    }, [baseData, shopList, targetMonth, monthArray]);



    const perFormate = (value: number) => {
        return Number.isFinite(value) ? Math.ceil(value * 1000) / 10 : 0;
    };

    useEffect(() => {
        if (!newExpected.date || !newExpected.shop || !newExpected.section) {
            return;
        }

        const postData = {
            ...newExpected,
            demand: 'contract_ex_update'
        };
        const fetchData = async () => {
            try {
                const response = await apiClient.post("", postData);
                console.log(response.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }

            await setNewExpected({
                date: '',
                section: '',
                shop: '',
                count: 0
            });
        };
        fetchData();

    }, [expectedContract]);

    const modalClose = () => {
        setModalList([]);
        setPage(20);
    };

    const setNewRank = async (idValue: string, newRank: string, periodValue: string) => {
        if (!idValue) return;
        const postData = {
            id: idValue,
            rank: newRank ?? '',
            rank_period: periodValue ?? '',
            request: 'rank',
            category
        };
        try {
            const response = await apiClient.post('', postData);
            console.log(response.data.status);
            await setCustomerList(response.data.newCustomers);
        } catch (e) {
            console.error(e);
        }

        const newList = modalList.filter(m => m.id !== idValue);
        setModalList(newList);

        if (newList.length === 0) {
            modalClose();
            return;
        }
    };

    const closeInformationEdit = async () => {
        try {
            const response = await fetchCustomerData();
            await setCustomerList(response.data.customer);
        } catch (e) {
            console.error(e);
        }

        const newList = modalList.filter(m => m.id !== editId);

        if (newList.length === 0) {
            setEditId('');
            modalClose();
            return;
        }
        setEditId('');
    };

    const handleMemoChange = (text: string, staff: string, shop: string) => {
        setMemoList(prev => {
            const exists = prev.some(item => item.staff === staff);
            if (exists) {
                return prev.map(item =>
                    (item.staff === staff && item.shop === shop)
                        ? { ...item, memo: text }
                        : item
                );
            }
            return [...prev, { staff, shop, memo: text }];
        });

        const fetchData = async () => {
            try {
                await apiClient.post('', { request: "rank", staff, memo: text, shop });
            } catch (err) {
                console.error(err);
            }
        }

        fetchData();
    };

    const TableParts = ({ list, setModalList }: { list: Customer[], setModalList: React.Dispatch<React.SetStateAction<Customer[]>> }) => {
        const hasList = list.length > 0;
        return (
            <td
                onClick={() => hasList ? setModalList(list) : null}
                style={{
                    textDecoration: hasList ? 'underline' : '',
                    cursor: hasList ? 'pointer' : ''
                }}
                className={list.length === 0 ? 'table-white' : ''}
            >
                {list.length}
            </td>
        );
    };

    const calculateGoal = (category: string, label?: string) => {
        const isPeriod = targetMonth.length === 4;
        const yearPeriod = isPeriod ? getFiscalYearMonthsFromJune(targetMonth) : [];
        const targetShopArray = category === 'all' ? shopList.filter(s => s.division === '建売分譲事業').map(s => s.shop)
            : category === 'section' ? shopList.filter(s => s.section === label).map(s => s.shop)
                : shopList.filter(s => s.shop === label).map(s => s.shop);
        if (isPeriod) {
            const goal = achievement.filter(a => targetShopArray.includes(a.name) && yearPeriod.includes(dateFormate(a.period))).reduce((acc, cur) => acc + Number(cur.value), 0);
            return goal;
        } else {
            const goal = achievement.filter(a => targetShopArray.includes(a.name) && dateFormate(a.period) === dateFormate(targetMonth)).reduce((acc, cur) => acc + Number(cur.value), 0);
            return goal;
        }
    };

    const searchParts = () => {
        return <div className='bg-white p-2' style={{ width: isSp ? '1300px' : '1800px' }}>
            <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"実績日"起算となります。</div>
            <div className="row mt-3 mb-4" >
                <div className="col d-flex">
                    <select className="target" name="startMonth" onChange={(e) => setTargetMonth(e.target.value)}>
                        {getYears().map(year => <option key={year} value={year}>{year}年度</option>)}
                        {monthArray.map((month, index) => (
                            <option key={index} value={month} selected={targetMonth === month}>{month}</option>
                        ))}
                    </select>
                </div>
            </div>
            <div>
                <Table bordered>
                    <tbody style={{ fontSize: isSp ? '8px' : '12px' }} className='align-middle'>
                        <tr className="text-center">
                            <td rowSpan={2} className='sticky-column-rank'>店舗</td>
                            {tooltipItems
                                .filter(t => {
                                    const isPeriod = targetMonth.length === 4;
                                    return isPeriod ? t.label !== '当月契約確約数' : true
                                })
                                .map((item, i) => {
                                    const isRank = rankLabels.filter(r => r !== 'Eランク' && r !== 'Fランク').includes(item.label);
                                    const isPeriod = targetMonth.length === 4;
                                    return (
                                        <td
                                            key={`head-${i}`}
                                            colSpan={(isRank && !isPeriod) ? 3 : 1}
                                            rowSpan={isRank ? 1 : 2}
                                            className="align-middle"
                                        >
                                            <OverlayTriggerComponent label={item.label} desc={item.desc} />
                                        </td>
                                    );
                                })}
                        </tr>
                        <tr className="text-center">
                            {tooltipItems
                                .map((item, i) => {
                                    const isRank = rankLabels.includes(item.label);
                                    const isPeriod = targetMonth.length === 4;
                                    if (!isRank) {
                                        return null;
                                    }
                                    return (
                                        <>{(!isPeriod && (item.label !== 'Eランク' && item.label !== 'Fランク')) &&
                                            <React.Fragment key={`sub-${i}`}>
                                                <td>{targetMonth}</td>
                                                <td>{targetMonth.split('/')[0]}/{String(Number(targetMonth.split('/')[1]) + 1).padStart(2, '0')}</td>
                                                <td>{targetMonth.split('/')[0]}/{String(Number(targetMonth.split('/')[1]) + 2).padStart(2, '0')}</td>
                                            </React.Fragment>
                                        }</>
                                    );
                                })}
                        </tr>
                        {[{ label: '建売営業全体', category: 'all', show: true }, ...displayLabelList].map((target, targetIndex) => {
                            let bgKey;
                            if (target.category === 'section' || target.category === 'all') {
                                bgKey = target.label;
                            } else if (target.category === 'shop') {
                                bgKey = shopList.find(s => s.shop === target.label)?.section;
                            }
                            const register = getFiltered('register', target.category, target.label, targetIndex, '', 0);
                            const contact = getFiltered('contact', target.category, target.label, targetIndex, '', 0);
                            const interview = getFiltered('interview', target.category, target.label, targetIndex, '', 0);
                            const appointment = getFiltered('appointment', target.category, target.label, targetIndex, '', 0);
                            const contract = getFiltered('contract', target.category, target.label, targetIndex, '', 0);
                            const rankS = getFiltered('', target.category, target.label, targetIndex, 'Sランク', 0);
                            const goal = calculateGoal(target.category, target.label);
                            return (
                                <tr key={targetIndex} className={`${background[bgKey]} align-middle`} style={{ textAlign: 'center' }}>
                                    <td style={{
                                        cursor: target.category === 'staff' ? 'text' : 'pointer',
                                        textAlign: 'left',
                                        paddingLeft: (targetIndex === 0 || target.category === 'staff') ? '34px' : '',
                                    }}
                                        onClick={() => expandTarget(target)}
                                        className='sticky-column-rank'
                                    >
                                        <div className="d-flex align-items-center">
                                            {(targetIndex > 0 && target.category !== 'staff') && <i className={`fa-solid ${showTarget[target.label] ? 'fa-minus' : 'fa-plus'} me-2 p-1 pointer-icon rounded`} ></i>}
                                            {target.label}
                                            {target.category === 'staff' && (
                                                <StaffMemo
                                                    staffName={target.label}
                                                    staffShop={memoList.find(m => m.staff === target.label)?.shop ?? ''}
                                                    initialMemo={memoList.find(m => m.staff === target.label)?.memo ?? ''}
                                                    onSave={handleMemoChange}
                                                />
                                            )}
                                        </div>
                                    </td>
                                    <TableParts key={targetIndex} list={register} setModalList={setModalList} />
                                    <TableParts key={targetIndex} list={contact} setModalList={setModalList} />
                                    <TableParts key={targetIndex} list={interview} setModalList={setModalList} />
                                    <TableParts key={targetIndex} list={appointment} setModalList={setModalList} />
                                    <td onClick={() => contract.length > 0 ? setModalList(contract) : null} style={{
                                        textDecoration: contract.length > 0 ? 'underline' : ''
                                        , cursor: contract.length > 0 ? 'pointer' : ''
                                    }}
                                        className={contract.length === 0 ? 'table-white' : ''}
                                        key={targetIndex}>{contract.length}({perFormate(contract.length / interview.length)}%)</td>
                                    <td>{target.category === 'staff' ? '-' : goal}</td>
                                    <td>{goal ? perFormate(contract.length / Number(goal)) : 0}%</td>
                                    {rankLabels.map((rank, rankIndex) => {
                                        const targetList = getFiltered('', target.category, target.label, targetIndex, `${rank}`, 0);
                                        return <>
                                            <TableParts key={rankIndex} list={targetList} setModalList={setModalList} />
                                            {(rank !== 'Eランク' && rank !== 'Fランク') && <>{[1, 2].map(num => {
                                                const targetList = getFiltered('', target.category, target.label, targetIndex, `${rank}`, num);
                                                return <>
                                                    <TableParts key={num} list={targetList} setModalList={setModalList} />
                                                </>
                                            }
                                            )}</>}
                                        </>
                                    }
                                    )}
                                </tr>)
                        }
                        )}
                    </tbody>
                </Table>
            </div>
        </div>
    };

    return (
        <div style={{ overflowX: 'scroll' }}>
            {searchParts()}
            <Modal show={modalList.length > 0} onHide={modalClose} size='xl'>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '15px' }}>案件詳細</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {modalList.length === 0
                        ? <div className="text-center mt-1 w-100"><i className='fa-solid fa-arrows-rotate sticky-column pointer spinning me-1'></i>Loading...</div>
                        :
                        <>
                            <div style={{ fontSize: '10px', fontWeight: '500' }} className='text-danger mb-2'>※「見込み月」には契約見込みの月を選択する。</div>
                            <Table bordered striped style={{ fontSize: '11px' }} className='align-middle'>
                                <tbody>
                                    <tr>
                                        <td>No</td>
                                        <td>店舗</td>
                                        <td>担当営業</td>
                                        <td>お客様名</td>
                                        <td>ランク</td>
                                        <td>見込み月</td>
                                        <td>反響日</td>
                                        <td>初回来場日</td>
                                        <td>契約日<span className='text-success'>(仲介)</span></td>
                                    </tr>
                                    {modalList.slice(page - 20, page).map((item, index) =>
                                        <tr key={index}>
                                            <td>{page - 20 + index + 1}</td>
                                            <td>{item.shop}</td>
                                            <td>{item.staff}</td>
                                            <td>
                                                <div style={{ textDecoration: 'underline dotted', cursor: 'pointer', width: 'fit-content' }}
                                                    onClick={() => setEditId(item.id)}>
                                                    {item.status === '契約済み' && <i className="fa-solid fa-crown pe-1"></i>}{item.customer}
                                                </div>
                                            </td>
                                            <td>
                                                <select className='target' style={{ width: '80px' }} value={item.rank}
                                                    onChange={(e) => {
                                                        setNewRank(item.id, e.target.value, '');
                                                    }}>
                                                    <option value=''>未設定</option>
                                                    {['Sランク', 'Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク', 'Fランク'].map(rank => {
                                                        return <option value={rank} key={rank} selected={rank === item.rank}>{rank}</option>
                                                    }
                                                    )}
                                                </select>
                                            </td>
                                            <td>
                                                <select className='target' style={{ width: '80px' }} value={item.rank_period || targetMonth}
                                                    onChange={(e) => {
                                                        setNewRank(item.id, '', e.target.value);
                                                    }}>
                                                    {[targetMonth,
                                                        `${targetMonth.split('/')[0]}/${String(Number(targetMonth.split('/')[1]) + 1).padStart(2, '0')}`,
                                                        `${targetMonth.split('/')[0]}/${String(Number(targetMonth.split('/')[1]) + 2).padStart(2, '0')}`].map(period => {
                                                            return <option value={period} key={period} selected={period === item.rank_period}>{period}</option>
                                                        }
                                                        )}
                                                </select></td>
                                            <td>{dateFormate(item.register)}</td>
                                            <td>{dateFormate(item.interview)}</td>
                                            <td>{dateFormate(item.contract) || <span className='text-success'>({dateFormate(item.contract_broker)})</span>}</td>
                                        </tr>)}
                                </tbody>
                            </Table>
                            <div className="d-flex justify-content-around" style={{ fontSize: '12px' }}>
                                <div className="text-primary" style={{ cursor: 'pointer' }}
                                    onClick={() => setPage(page - 20)}>{(modalList.length > 20 && page > 20) && '前の20件'}</div>
                                <div className="text-primary" style={{ cursor: 'pointer' }}
                                    onClick={() => setPage(page + 20)}>{(modalList.length > 20 && modalList.length > page) && '次の20件'}</div>
                            </div>
                        </>}
                </Modal.Body>
            </Modal>
            <InterviewLog idValue={interviewId} setInterviewId={setInterviewId} />
            <InformationEditKaeru id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
        </div>
    )
}

export default RankOrder;