import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import axios from "axios";
import Table from "react-bootstrap/Table";
import "./SearchBox.css";
import "bootstrap/dist/css/bootstrap.min.css";
import Modal from 'react-bootstrap/Modal';
import AuthContext from '../context/AuthContext';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import MenuDev from "./MenuDev";
import { getYearMonthArray } from '../utils/getYearMonthArray';
import { headers } from '../utils/headers';

type Customer = { date: string, status: string, rank: string, register: string, reserve: string, shop: string, staff: string, section: string; contract: string, rank_period: string };
type CustomerList = Customer & {
    id: string, name: string, medium: string, sales_meeting: string, latest_date: string, last_meeting: string, estate: string, meeting: string, appointment: string, line_group: string, screening: string; rival: string, period: string, survey: string, importance: string, note: string, budget: string
};
type Achievement = { category: string, name: string, period: string, value: string }
type Expect = { date: string, shop: string, section: string, count: number };
type Target = { [key: string]: boolean };
type Shop = { brand: string, shop: string, section: string, area: string, };
type Label = { label: string, show: boolean, category: string };
type Staff = { id: number, name: string, pg_id: string, shop: string, mail: string, status: string, category: number, rank: number, sort: number };
type InterviewAction = {
    day: string;
    action: string;
    note: string;
};
type InterviewLog = {
    id: string,
    shop: string,
    name: string,
    interview_log: string,
};
type ModalInfo = {
    label: string,
    category: string,
    rank: string,
    rank_period: number
};
const Rank = () => {
    const { brand } = useContext(AuthContext);
    const [open, setOpen] = useState(false);
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [targetMonth, setTargetMonth] = useState('');
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [labelList, setLabelList] = useState<Label[]>([]);
    const [expectedContract, setExpectedContract] = useState<Expect[]>([]);
    const [showTarget, setShowTarget] = useState<Target>({});
    const [shopList, setShopList] = useState<Shop[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [newExpected, setNewExpected] = useState<Expect>({
        date: '',
        shop: '',
        section: '',
        count: 0
    });
    const [modalShow, setModalShow] = useState<ModalInfo>({
        label: '',
        category: '',
        rank: '',
        rank_period: 0
    });

    const [modalList, setModalList] = useState<CustomerList[]>([]);
    const [page, setPage] = useState(20);
    const [achievement, setAchievement] = useState<Achievement[]>([]);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));
        setTargetMonth(`${year}/${month}`);

        const fetchData = async () => {
            try {
                const [customerResponse, sectionResponse, expectedResponse, shopResponse, staffResponse, achievementResponse] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_detail" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "section_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "contract_expected" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "staff_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "company_achievement" }, { headers })
                ]);
                const filteredCustomer = customerResponse.data.filter(c => c.trash === 1);
                await setCustomerList(filteredCustomer);
                await setExpectedContract(expectedResponse.data);
                await setShopList(shopResponse.data);
                const sectionList = sectionResponse.data.map(s => s.name).map(sectionValue => ({
                    category: 'section',
                    label: sectionValue,
                    show: false,
                }));
                await setLabelList(sectionList);
                await setStaffList(staffResponse.data);
                await setAchievement(achievementResponse.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();

    }, []);

    const OverlayTriggerComponent = ({ label, desc }) => {
        return (
            <OverlayTrigger placement="top" overlay={<Tooltip id="tooltip-top" style={{ fontSize: "12px" }}>{desc}</Tooltip>}>
                <span style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}>{label}</span>
            </OverlayTrigger>)
    };

    const tooltipItems = [
        { label: '総反響', desc: `${targetMonth}の総反響数` },
        { label: '来場率', desc: '来場者数/総反響' },
        { label: '来場数', desc: `${targetMonth}の来場者数` },
        { label: '契約率', desc: '契約者数/来場者数' },
        { label: '目標数', desc: `${targetMonth}の目標数` },
        { label: '契約数', desc: `${targetMonth}の契約者数 ()内はAランクも含めた数` },
        { label: '達成率', desc: '契約者数/予算 ()内は見込み達成率' },
        { label: '当月契約確約数', desc: `${targetMonth}の契約が見込める数` },
        { label: 'Aランク', desc: '今月契約予定(契約日確定)' },
        { label: 'Bランク', desc: '今月見込み(確度高い)' },
        { label: 'Cランク', desc: '今月見込み(勝負案件)' },
        { label: 'Dランク', desc: '継続顧客' },
        { label: 'Eランク', desc: '中長期管理' },
        // { label: 'ランクダウン', desc: 'A~CランクからD~Eランクにダウンした数' },
    ];

    const rankLabels = ['Aランク', 'Bランク', 'Cランク'];

    const background = {
        '鹿児島営業1課': 'table-primary ',
        '鹿児島営業2課': 'table-success ',
        '鹿児島営業3課': 'table-warning ',
        '宮崎営業課': 'table-danger ',
        '大分・佐賀営業課': 'table-secondary ',
        '熊本営業課': 'table-info '
    };

    const expandTarget = async (target: Label) => {
        const targetShops = shopList.filter(s => s.section === target.label).map(s => ({
            label: s.shop,
            category: 'shop',
            show: false
        }));
        const targetStaff = staffList.filter(s => s.shop === target.label && s.rank === 1)
            .sort((a, b) => {
                return b.sort - a.sort
            })
            .map(s => ({
                label: s.name,
                category: 'staff',
                show: false
            }));
        const targetIndex = labelList.map(l => l.label).indexOf(target.label);
        let newList;
        if (target.category === 'section') {
            if (!showTarget[target.label]) {
                newList = [...labelList.slice(0, targetIndex + 1), ...targetShops, ...labelList.slice(targetIndex + 1)];
                await setLabelList(newList);
                await setShowTarget(prev => ({
                    ...prev,
                    [target.label]: true
                }));
            } else {
                const sectionList = labelList.filter(l => l.category === 'section').map(l => l.label);
                const nextSection = sectionList[sectionList.indexOf(target.label) + 1];
                const removeTargetIndex = labelList.map(l => l.label).indexOf(nextSection);
                newList = nextSection ? [...labelList.slice(0, targetIndex + 1), ...labelList.slice(removeTargetIndex)] : [...labelList.slice(0, targetIndex + 1)];
                await setLabelList(newList);
                setShowTarget(prev => {
                    const updates = Object.fromEntries(
                        targetShops.map(s => [s.label, false])
                    );
                    return {
                        ...prev,
                        [target.label]: false,
                        ...updates
                    };
                });

            }
        } else if (target.category === 'shop') {
            if (!showTarget[target.label]) {
                newList = [...labelList.slice(0, targetIndex + 1), ...targetStaff, ...labelList.slice(targetIndex + 1)];
                await setLabelList(newList);
                await setShowTarget(prev => ({
                    ...prev,
                    [target.label]: true
                }));
            } else {
                newList = [...labelList.slice(0, targetIndex + 1), ...labelList.slice(targetIndex + 1 + targetStaff.length)];
                await setLabelList(newList);
                await setShowTarget(prev => ({
                    ...prev,
                    [target.label]: false
                }));
            }
        }
    };

    const listFilter = (customerList: Customer[], period: string, category: string, target: string, index: number, rank: string, rank_period: number) => {
        const targetPeriod = rank_period ? `${targetMonth.split('/')[0]}/${String(Number(targetMonth.split('/')[1]) + rank_period).padStart(2, '0')}` : '';
        return customerList.filter(item => (period ? item[period].includes(targetMonth) : true)
            && (index > 0 ? item[category] === target : true)
            && (rank ? item.rank === rank && !item.contract && item.status !== '契約済み' : true)
            && (rank_period > 0 ? item.rank_period === targetPeriod : (!item.rank_period || item.rank_period === targetMonth)));
    };

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
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const response = await axios.post("https://khg-marketing.info/dashboard/api/", postData, { headers });
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
        setModalShow({
            label: '',
            category: '',
            rank: '',
            rank_period: 0
        });
        setModalList([]);
        setPage(20);
    };

    const [interviewLog, setInterviewLog] = useState<InterviewLog[]>([]);

    const [interviewStep, setInterviewStep] = useState<InterviewAction[]>([]);

    useEffect(() => {
        if (!modalShow) return;
        const fetchData = async () => {
            try {
                const customerResponse = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_detail" }, { headers });
                const rankList: CustomerList[] = customerResponse.data.filter(item => {
                    const targetPeriod = modalShow.rank_period ? `${targetMonth.split('/')[0]}/${String(Number(targetMonth.split('/')[1]) + modalShow.rank_period).padStart(2, '0')}` : '';
                    return (modalShow.rank === '契約者' ? ((item.rank === 'Aランク' && item.status !== '契約済み') || item.contract.includes(targetMonth)) : (item.rank === modalShow.rank && item.status !== '契約済み'))
                        && (modalShow.category === 'all' ? true : item[modalShow.category] === modalShow.label) && (modalShow.rank_period > 0 ? item.rank_period === targetPeriod : (!item.rank_period || item.rank_period === targetMonth));
                }
                );
                setModalList(rankList);
                const InterviewResponse = await axios.post('https://khg-marketing.info/dashboard/api/', { demand: 'show_customer_interview_list' }, { headers });
                setInterviewLog(InterviewResponse.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, [modalShow]);

    const [hoveredIdx, setHoveredIdx] = useState('');

    useEffect(() => {
        if (!hoveredIdx) return;
        setTimeout(() => {
            setSubModalShow(hoveredIdx);
            const target = interviewLog.find(i => i.id === hoveredIdx);
            if (target) {
                setInterviewStep(JSON.parse(target.interview_log));
            }
        }, 300
        )
    }, [hoveredIdx]);

    const [subModalShow, setSubModalShow] = useState('');

    const subModalClose = () => {
        setSubModalShow('');
        setHoveredIdx('');
    };

    const subModalList = {
        name: 'お客様名',
        shop: '店舗',
        staff: '担当営業',
        rank: 'ランク',
        medium: '販促媒体',
        importance: '重視項目',
        period: '契約スケジュール',
        estate: '土地の有無',
        budget: '予算',
        step: '商談ステップ',
        note: '備考',
        survey: 'アンケート'
    };

    const editDatabase = async (idValue: string) => {
        await window.open(`./database?id=${idValue}`, '_blank');
    };

    const setNewRank = async (idValue: string, newRank: string, periodValue: string) => {
        if (!idValue) return;
        const postData = {
            id: idValue,
            rank: newRank ?? '',
            rank_period: periodValue ?? '',
            demand: 'update_rank'
        };
        try {
            const response = await axios.post('https://khg-marketing.info/dashboard/api/', postData, { headers });
            console.log(response.data.status);
            await setCustomerList(response.data.customers);
        } catch (e) {
            console.error(e);
        }

        const newList = modalList.filter(m => m.id !== idValue);

        if (newList.length === 0) {
            modalClose();
            return;
        }
        setModalShow({
            label: modalShow.label,
            category: modalShow.category,
            rank: modalShow.rank,
            rank_period: modalShow.rank_period
        });
    };

    return (
        <>
            <div className='outer-container'>
                <div className="d-flex">
                    <div className='modal_menu' style={{ width: '20%' }}>
                        <MenuDev brand={brand} />
                    </div>
                    <div className="header_sp">
                        <i className="fa-solid fa-bars hamburger"
                            onClick={() => setOpen(true)} />
                    </div>
                    <div className={`modal_menu_sp ${open ? "open" : ""}`}>
                        <i className="fa-solid fa-xmark hamburger position-absolute"
                            onClick={() => setOpen(false)} />
                        <MenuDev brand={brand} />
                    </div>
                    <div className='content database bg-white p-2'>
                        <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"実績日"起算となります。</div>
                        <div className="row mt-3 mb-4" >
                            <div className="col d-flex">
                                <select className="target" name="startMonth" onChange={(e) => setTargetMonth(e.target.value)}>
                                    <option value="">全期間</option>
                                    {monthArray.map((month, index) => (
                                        <option key={index} value={month} selected={targetMonth === month}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            {/* <div className="col d-flex align-items-center" style={{ fontSize: '13px' }}>
                                最終更新 {
                                    (() => {
                                        const earliest = customerList.reduce<Date | null>((acc, c) => {
                                            if (!c.date) return acc;
                                            const d = new Date(String(c.date));
                                            if (isNaN(d.getTime())) return acc;
                                            if (!acc || d < acc) return d;
                                            return acc;
                                        }, null);
                                        return earliest ? earliest.toISOString().slice(0, 10) : "";
                                    })()
                                }
                            </div> */}
                        </div>
                        <div className="">
                            <Table bordered>
                                <tbody style={{ fontSize: '11px' }} className='align-middle'>
                                    <tr className="text-center">
                                        <td rowSpan={2}>店舗</td>
                                        {tooltipItems.map((item, i) => {
                                            const isRank = rankLabels.includes(item.label);
                                            return (
                                                <td
                                                    key={`head-${i}`}
                                                    colSpan={isRank ? 3 : 1}
                                                    rowSpan={isRank ? 1 : 2}
                                                    className="align-middle"
                                                >
                                                    <OverlayTriggerComponent label={item.label} desc={item.desc} />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                    <tr className="text-center">
                                        {tooltipItems.map((item, i) => {
                                            const isRank = rankLabels.includes(item.label);
                                            if (!isRank) {
                                                return null;
                                            }
                                            return (
                                                <React.Fragment key={`sub-${i}`}>
                                                    <td>{targetMonth}</td>
                                                    <td>{targetMonth.split('/')[0]}/{String(Number(targetMonth.split('/')[1]) + 1).padStart(2, '0')}</td>
                                                    <td>{targetMonth.split('/')[0]}/{String(Number(targetMonth.split('/')[1]) + 2).padStart(2, '0')}</td>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                    {[{ label: '注文営業全体', category: 'all', show: true }, ...labelList].map((target, targetIndex) => {
                                        let bgKey;
                                        if (target.category === 'section') {
                                            bgKey = target.label;
                                        } else if (target.category === 'shop') {
                                            bgKey = shopList.find(s => s.shop === target.label)?.section;
                                        }
                                        const register = listFilter(customerList, 'register', target.category, target.label, targetIndex, '', 0);
                                        const reserve = listFilter(customerList, 'reserve', target.category, target.label, targetIndex, '', 0);
                                        const contract = listFilter(customerList, 'contract', target.category, target.label, targetIndex, '', 0);
                                        const rankA = listFilter(customerList, '', target.category, target.label, targetIndex, 'Aランク', 0);
                                        const rankE = listFilter(customerList, '', target.category, target.label, targetIndex, 'Eランク', 0);
                                        const goal = achievement.find(a => (target.category === 'all' ? a.name === '注文事業' : a.name === target.label) && a.period.replace(/-/g, '/') === targetMonth)?.value;
                                        const expectedList = expectedContract.filter(item => item.date === targetMonth
                                            && ((targetIndex > 0) ? item[target.category] === target.label : true));
                                        const expected = expectedList.reduce((acc, cur) => acc + cur.count, 0);
                                        return (
                                            <tr key={targetIndex} className={`${background[bgKey]} align-middle`} style={{ textAlign: 'right' }}>
                                                <td style={{ cursor: 'pointer', textAlign: 'left', paddingLeft: (targetIndex === 0 || target.category === 'staff') ? '34px' : '' }}
                                                    onClick={() => expandTarget(target)}>
                                                    {(targetIndex > 0 && target.category !== 'staff') && <i className={`fa-solid ${showTarget[target.label] ? 'fa-minus' : 'fa-plus'} me-2 p-1 pointer-icon rounded`} ></i>}
                                                    {target.label}</td>
                                                <td>{register.length}</td>
                                                <td>{perFormate(reserve.length / register.length)}%</td>
                                                <td>{reserve.length}</td>
                                                <td>{perFormate(contract.length / reserve.length)}%</td>
                                                <td>{target.category === 'staff' ? '-' : goal}</td>
                                                <td onClick={() => contract.length + rankA.length > 0 ? setModalShow({
                                                    label: target.label,
                                                    category: target.category,
                                                    rank: '契約者',
                                                    rank_period: 0
                                                }) : null} style={{ textDecoration: contract.length + rankA.length > 0 ? 'underline' : '', cursor: contract.length + rankA.length > 0 ? 'pointer' : '' }}>{contract.length}(<span className='text-primary'>{contract.length + rankA.length}</span>)</td>
                                                <td>{goal ? perFormate(contract.length / Number(goal)) : 0}%(<span className='text-primary'>{goal ? perFormate((contract.length + rankA.length) / Number(goal)) : 0}%</span>)</td>
                                                <td className='text-center'>
                                                    {(targetIndex === 0 || target.category === 'section') && expected}
                                                    {(target.category === 'shop') && <input type='number' className='target text-center' value={expected}
                                                        style={{ fontSize: '12px', width: '60px', height: '25px', margin: '0 auto' }}
                                                        onChange={(e) => {
                                                            const sectionValue = shopList.find(s => s.shop === target.label)?.section;
                                                            setNewExpected({
                                                                date: targetMonth,
                                                                shop: target.label,
                                                                section: sectionValue ?? '',
                                                                count: Number(e.target.value)
                                                            });
                                                            setExpectedContract(
                                                                prev => expectedList.length > 0 ?
                                                                    prev.map(item =>
                                                                        item.shop === target.label
                                                                            ? {
                                                                                ...item,
                                                                                count: Number(e.target.value)
                                                                            }
                                                                            : item) : [...prev,
                                                                            {
                                                                                date: targetMonth,
                                                                                shop: target.label,
                                                                                section: sectionValue ?? '',
                                                                                count: Number(e.target.value)
                                                                            }]
                                                            );
                                                        }}
                                                    />}</td>
                                                {['A', 'B', 'C', 'D'].map((rank, rankIndex) => {
                                                    const count = listFilter(customerList, '', target.category, target.label, targetIndex, `${rank}ランク`, 0).length;
                                                    return <>
                                                        <td onClick={() => count > 0 ? setModalShow({
                                                            label: target.label,
                                                            category: target.category,
                                                            rank: `${rank}ランク`,
                                                            rank_period: 0
                                                        }) : null} style={{
                                                            textDecoration: count > 0 ? 'underline' : ''
                                                            , cursor: count > 0 ? 'pointer' : ''
                                                        }}
                                                            key={rankIndex}>{count}</td>
                                                        {rankIndex < 3 && <>
                                                            {[1, 2].map(num => {
                                                                const countValue = listFilter(customerList, '', target.category, target.label, targetIndex, `${rank}ランク`, num).length;
                                                                return <td onClick={() => countValue > 0 ? setModalShow({
                                                                    label: target.label,
                                                                    category: target.category,
                                                                    rank: `${rank}ランク`,
                                                                    rank_period: num
                                                                }) : null} style={{
                                                                    textDecoration: countValue > 0 ? 'underline' : ''
                                                                    , cursor: countValue > 0 ? 'pointer' : ''
                                                                }}
                                                                    key={num}>{countValue}</td>
                                                            }
                                                            )}
                                                        </>}
                                                    </>
                                                }
                                                )}
                                                <td>{rankE.length}</td>
                                            </tr>)
                                    }
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
            <Modal show={modalShow.label !== ''} onHide={modalClose} size='lg'>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '15px' }}>{modalShow.label}_{modalShow.rank}_顧客情報詳細{modalShow.rank === '契約者' && <div><i className="fa-solid fa-crown ps-1"></i>は契約者</div>} ({targetMonth.split('/')[0]}年{Number(targetMonth.split('/')[1]) + modalShow.rank_period}月度)</Modal.Title>
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
                                        <td>詳細編集</td>
                                    </tr>
                                    {modalList.slice(page - 20, page).map((item, index) =>
                                        <tr key={index}>
                                            <td>{page - 20 + index + 1}</td>
                                            <td>{item.shop}</td>
                                            <td>{item.staff}</td>
                                            <td>
                                                <div style={{ textDecoration: 'underline dotted', cursor: 'pointer', width: 'fit-content' }}
                                                    onMouseEnter={() => setHoveredIdx(item.id)}>
                                                    {item.status === '契約済み' && <i className="fa-solid fa-crown pe-1"></i>}{item.name}
                                                </div>
                                            </td>
                                            <td>
                                                <select className='target' style={{ width: '80px' }} value={item.rank}
                                                    onChange={(e) => {
                                                        const recentRank = modalShow.rank;
                                                        setNewRank(item.id, e.target.value, '');
                                                    }}>
                                                    {['Aランク', 'Bランク', 'Cランク', 'Dランク', 'Eランク'].map(rank => {
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
                                            <td>{item.register}</td>
                                            <td>{item.reserve}</td>
                                            <td className='text-center'><div className="bg-danger text-white rounded text-center btn" style={{ fontSize: '12px' }}
                                                onClick={() => editDatabase(item.id)}>編集</div></td>
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
            <Modal show={subModalShow !== ''} onHide={subModalClose} >
                <Modal.Header closeButton>{modalList.find(m => m.id === hoveredIdx)?.name} 様</Modal.Header>
                <Modal.Body>
                    <Table bordered striped>
                        <tbody style={{ fontSize: '12px' }} className='align-middle'>
                            {Object.entries(subModalList).map(([key, value], idx) => {
                                const target = modalList.find(m => m.id === hoveredIdx);
                                return (
                                    <tr key={idx}>
                                        <td style={{ width: '30%' }}>{value}</td>
                                        <td>{(key !== 'step' && target) && String(target[key]).split('\n').map((line, index) => (<React.Fragment key={index}>{line}<br /></React.Fragment>))}
                                            {(key === 'step' && interviewStep) &&
                                                <>
                                                    {target?.register && <>
                                                        <div>{target?.register.replace(/\//g, '-')} {target?.medium}より反響</div>
                                                        <div className='ps-5 my-1'>↓</div>
                                                    </>}
                                                    {[...interviewStep]
                                                        .sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime())
                                                        .map((i, iIndex) => <>
                                                            {iIndex > 0 && <div className='ps-5 my-1'>↓</div>}
                                                            <div>{i.day} {i.action} {i.note}</div>
                                                            <div>{i.note && i.note}</div>
                                                        </>)}
                                                </>}
                                            {(key === 'step' && !interviewStep) &&
                                                <>{target?.reserve}
                                                </>
                                            }
                                        </td>
                                    </tr>
                                );
                            })}

                        </tbody>
                    </Table>
                </Modal.Body>
            </Modal>
        </>
    )
}

export default Rank;