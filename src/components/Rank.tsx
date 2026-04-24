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
import { getFiscalYearMonthsFromJune } from '../utils/getFiscalYearMonthsFromJune';
import InformationEdit from './InformationEdit';
import InterviewLog from './InterviewLog';

type Customer = { id: string, customer: string, date: string, status: string, rank: string, register: string, interview: string, shop: string, staff: string, section: string; contract: string, rank_period: string, appointment: string, screening: string };
type Achievement = { category: string, name: string, period: string, value: string }
type Expect = { date: string, shop: string, section: string, count: number };
type Target = { [key: string]: boolean };
type Shop = { brand: string, shop: string, section: string, area: string, };
type Label = { label: string, show: boolean, category: string };
type Staff = { id: number, name: string, pg_id: string, shop: string, mail: string, status: string, category: number, rank: number, sort: number };

const Rank = () => {
    const { token } = useContext(AuthContext);
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
    const [modalList, setModalList] = useState<Customer[]>([]);
    const [page, setPage] = useState(20);
    const [achievement, setAchievement] = useState<Achievement[]>([]);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const thisMonth = targetMonth === `${year}/${month}`;
    const [editId, setEditId] = useState('');
    const [interviewId, setInterviewId] = useState('');

    const thisYear = now.getMonth() <= 4 ? year : year + 1;

    useEffect(() => {
        setMonthArray(getYearMonthArray(2025, 1));
        setTargetMonth(`${year}/${month}`);

        const fetchData = async () => {
            try {
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: "rank" }, { headers });
                await setCustomerList(response.data.customer);
                await setExpectedContract(response.data.expected);
                await setShopList(response.data.shop);
                const sectionList = response.data.section.map(s => s.name).map(sectionValue => ({
                    category: 'section',
                    label: sectionValue,
                    show: false,
                }));
                await setLabelList(sectionList);
                await setStaffList(response.data.staff);
                await setAchievement(response.data.achievement);
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
        // { label: '来場率', desc: '来場者数/総反響' },
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
        // { label: 'Eランク', desc: '中長期管理' },
        // { label: 'ランクダウン', desc: 'A~CランクからD~Eランクにダウンした数' },
    ];

    const rankLabels = ['Aランク', 'Bランク', 'Cランク'];

    const background = {
        '注文営業全体': 'table-secondary ',
        '鹿児島営業1課': 'table-primary ',
        '鹿児島営業2課': 'table-success ',
        '鹿児島営業3課': 'table-warning ',
        '宮崎営業課': 'table-danger ',
        '大分・佐賀営業課': 'table-secondary ',
        '熊本営業課': 'table-info '
    };

    const dateFormate = (value: string) => {
        return (value ?? '').replace(/-/g, '/')
    };
    const ym = (value: any) => dateFormate(value).slice(0, 7);

    const expandTarget = async (target: Label) => {
        const targetIndex = labelList.findIndex(l => l.label === target.label);
        if (targetIndex === -1) return;

        const isSection = target.category === 'section';
        const targetShops = isSection
            ? shopList.filter(s => s.section === target.label).map(s => ({ label: s.shop, category: 'shop', show: false }))
            : [];

        const targetStaff = target.category === 'shop'
            ? staffList
                .filter(s => s.shop === target.label)
                .sort((a, b) => b.sort - a.sort)
                .map(s => ({ label: s.name, category: 'staff', show: false }))
            : [];

        if (isSection) {
            if (!showTarget[target.label]) {
                const newList = [
                    ...labelList.slice(0, targetIndex + 1),
                    ...targetShops,
                    ...labelList.slice(targetIndex + 1)
                ];
                setLabelList(newList);
                setShowTarget(prev => ({ ...prev, [target.label]: true }));
            } else {
                const sectionLabels = labelList.filter(l => l.category === 'section').map(l => l.label);
                const nextSection = sectionLabels[sectionLabels.indexOf(target.label) + 1];
                const removeIndex = nextSection ? labelList.findIndex(l => l.label === nextSection) : labelList.length;
                const newList = [...labelList.slice(0, targetIndex + 1), ...labelList.slice(removeIndex)];

                setLabelList(newList);
                setShowTarget(prev => {
                    const updates = Object.fromEntries(targetShops.map(s => [s.label, false]));
                    return { ...prev, [target.label]: false, ...updates };
                });
            }
        } else if (target.category === 'shop') {
            if (!showTarget[target.label]) {
                const newList = [
                    ...labelList.slice(0, targetIndex + 1),
                    ...targetStaff,
                    ...labelList.slice(targetIndex + 1)
                ];
                setLabelList(newList);
                setShowTarget(prev => ({ ...prev, [target.label]: true }));
            } else {
                const newList = [
                    ...labelList.slice(0, targetIndex + 1),
                    ...labelList.slice(targetIndex + 1 + targetStaff.length)
                ];
                setLabelList(newList);
                setShowTarget(prev => ({ ...prev, [target.label]: false }));
            }
        }
    };

    const getFiltered = useMemo(() => {
        return (
            period: string,
            category: string,
            target: string,
            index: number,
            rank: string,
            rank_period: number
        ) => {
            const targetPeriod = rank_period
                ? `${targetMonth.split('/')[0]}/${String(Number(targetMonth.split('/')[1]) + rank_period).padStart(2, '0')}`
                : '';
            let base: Customer[] = [];
            const isPeriod = targetMonth.length === 4;
            const thisYearPeriod = getFiscalYearMonthsFromJune(targetMonth);
            if (period === 'contract') {
                base = customerList.filter(c => c.status === '契約済み'
                    && isPeriod ? thisYearPeriod.includes(dateFormate(c.contract.slice(0, 7))) : dateFormate(c.contract).includes(targetMonth));
            } else if (period === 'interview') {
                const interviewCustomer = customerList.filter(c => isPeriod ? thisYearPeriod.includes(dateFormate(c.interview).slice(0, 7)) : dateFormate(c.interview).includes(targetMonth));
                const appointmentCustomer = customerList.filter(c => !c.interview &&
                    isPeriod ? (thisYearPeriod.includes(dateFormate(c.appointment).slice(0, 7)) || thisYearPeriod.includes(dateFormate(c.screening).slice(0, 7)) || thisYearPeriod.includes(dateFormate(c.contract).slice(0, 7))) :
                    !c.interview &&
                    ((dateFormate(c.appointment).includes(targetMonth)) || (dateFormate(c.screening).includes(targetMonth)) || (dateFormate(c.contract).includes(targetMonth))));
                base = [...interviewCustomer, ...appointmentCustomer];
            } else if (period === 'register') {
                base = customerList.filter(c => isPeriod ? thisYearPeriod.includes(dateFormate(c.register).slice(0, 7)) : dateFormate(c.register).includes(targetMonth));
            } else {
                base = customerList;
            }

            return base.filter(item => {
                const targetShops = category === 'section' ? shopList.filter(s => s.section === target).map(s => s.shop) : [];
                if (isPeriod) {
                    return (index > 0 && category === 'section' ? targetShops.includes(item.shop) : index > 0 ? item[category] === target : true)
                        && (rank ? item.rank === rank && item.status === '見込み' : true)
                }
                return (index > 0 && category === 'section' ? targetShops.includes(item.shop) : index > 0 ? item[category] === target : true)
                    && (rank ? item.rank === rank && item.status === '見込み' : true)
                    && (!rank ? true : (rank_period > 0 ? item.rank_period === targetPeriod : (!item.rank_period || item.rank_period <= targetMonth)))
            });
        };
    }, [customerList, targetMonth, labelList, showTarget]);



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
        setModalList([]);
        setPage(20);
    };

    const setNewRank = async (idValue: string, newRank: string, periodValue: string) => {
        if (!idValue) return;
        const postData = {
            id: idValue,
            rank: newRank ?? '',
            rank_period: periodValue ?? '',
            request: 'rank_update_rank'
        };
        try {
            const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', postData, { headers });
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
            const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: "rank_customer_info" }, { headers });
            console.log(response.data.status);
            await setCustomerList(response.data.newCustomers);
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
                                    <option value={thisYear - 1}>{thisYear - 1}年度</option>
                                    <option value={thisYear}>{thisYear}年度</option>
                                    {monthArray.map((month, index) => (
                                        <option key={index} value={month} selected={targetMonth === month}>{month}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="">
                            <Table bordered>
                                <tbody style={{ fontSize: '12px' }} className='align-middle'>
                                    <tr className="text-center">
                                        <td rowSpan={2}>店舗</td>
                                        {tooltipItems
                                            .filter(t => {
                                                const isPeriod = targetMonth.length === 4;
                                                return isPeriod ? t.label !== '当月契約確約数' : true
                                            })
                                            .map((item, i) => {
                                                const isRank = rankLabels.includes(item.label);
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
                                                    <>{!isPeriod &&
                                                        <React.Fragment key={`sub-${i}`}>
                                                            <td>{targetMonth}</td>
                                                            <td>{targetMonth.split('/')[0]}/{String(Number(targetMonth.split('/')[1]) + 1).padStart(2, '0')}</td>
                                                            <td>{targetMonth.split('/')[0]}/{String(Number(targetMonth.split('/')[1]) + 2).padStart(2, '0')}</td>
                                                        </React.Fragment>
                                                    }</>
                                                );
                                            })}
                                    </tr>
                                    {[{ label: '注文営業全体', category: 'all', show: true }, ...labelList].map((target, targetIndex) => {
                                        let bgKey;
                                        if (target.category === 'section' || target.category === 'all') {
                                            bgKey = target.label;
                                        } else if (target.category === 'shop') {
                                            bgKey = shopList.find(s => s.shop === target.label)?.section;
                                        }
                                        const isPeriod = targetMonth.length === 4;
                                        const register = getFiltered('register', target.category, target.label, targetIndex, '', 0);
                                        const interview = getFiltered('interview', target.category, target.label, targetIndex, '', 0);
                                        const contract = getFiltered('contract', target.category, target.label, targetIndex, '', 0);
                                        const rankA = getFiltered('', target.category, target.label, targetIndex, 'Aランク', 0);
                                        const goal = achievement.filter(a => {
                                            const yearPeriod = isPeriod ? getFiscalYearMonthsFromJune(targetMonth) : [];
                                            return (target.category === 'all' ? a.name === '注文事業' : a.name === target.label) &&
                                                (isPeriod ? yearPeriod.includes(a.period.replace(/-/g, '/')) : a.period.replace(/-/g, '/') === targetMonth)
                                        }).reduce((acc, cur) => acc + Number(cur.value), 0);
                                        const expectedList = expectedContract.filter(item => item.date === targetMonth
                                            && ((targetIndex > 0) ? item[target.category] === target.label : true));
                                        const expected = expectedList.reduce((acc, cur) => acc + cur.count, 0);
                                        return (
                                            <tr key={targetIndex} className={`${background[bgKey]} align-middle`} style={{ textAlign: 'center' }}>
                                                <td style={{ cursor: 'pointer', textAlign: 'left', paddingLeft: (targetIndex === 0 || target.category === 'staff') ? '34px' : '' }}
                                                    onClick={() => expandTarget(target)}>
                                                    {(targetIndex > 0 && target.category !== 'staff') && <i className={`fa-solid ${showTarget[target.label] ? 'fa-minus' : 'fa-plus'} me-2 p-1 pointer-icon rounded`} ></i>}
                                                    {target.label}</td>
                                                <td>{register.length}</td>
                                                {/* <td>{perFormate(interview.length / register.length)}%</td> */}
                                                <td>{interview.length}</td>
                                                <td>{perFormate(contract.length / interview.length)}%</td>
                                                <td>{target.category === 'staff' ? '-' : goal}</td>
                                                <td onClick={() => contract.length > 0 ? setModalList(contract) : null}
                                                    className={contract.length === 0 ? 'table-white' : ''}
                                                    style={{ textDecoration: contract.length > 0 ? 'underline' : '', cursor: contract.length > 0 ? 'pointer' : '' }}>{contract.length}(<span className='text-primary'>{contract.length + (thisMonth ? rankA.length : 0)}</span>)</td>
                                                <td>{goal ? perFormate(contract.length / Number(goal)) : 0}%(<span className='text-primary'>{goal ? perFormate((contract.length + rankA.length) / Number(goal)) : 0}%</span>)</td>
                                                {!isPeriod && <td>
                                                    {(targetIndex === 0 || target.category === 'section') && expected}
                                                    {(target.category === 'shop') && <input type='number' className='target text-center' value={expected}
                                                        style={{ width: '60px', height: '25px', margin: '0 auto' }}
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
                                                    />}</td>}
                                                {['A', 'B', 'C', 'D'].map((rank, rankIndex) => {
                                                    const targetList = getFiltered('', target.category, target.label, targetIndex, `${rank}ランク`, 0);
                                                    return <>
                                                        <td onClick={() => targetList.length > 0 ? setModalList(targetList) : null} style={{
                                                            textDecoration: targetList.length > 0 ? 'underline' : ''
                                                            , cursor: targetList.length > 0 ? 'pointer' : ''
                                                        }}
                                                            className={targetList.length === 0 ? 'table-white' : ''}
                                                            key={rankIndex}>{targetList.length}</td>
                                                        {(rankIndex < 3 && !isPeriod) && <>
                                                            {[1, 2].map(num => {
                                                                const targetList = getFiltered('', target.category, target.label, targetIndex, `${rank}ランク`, num);
                                                                return <td onClick={() => targetList.length > 0 ? setModalList(targetList) : null} style={{
                                                                    textDecoration: targetList.length > 0 ? 'underline' : ''
                                                                    , cursor: targetList.length > 0 ? 'pointer' : ''
                                                                }}
                                                                    className={targetList.length === 0 ? 'table-white' : ''}
                                                                    key={num}>{targetList.length}</td>
                                                            }
                                                            )}
                                                        </>}
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
                </div>
            </div>
            <Modal show={modalList.length > 0} onHide={modalClose} size='xl'>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '15px' }}>顧客情報詳細</Modal.Title>
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
                                        <td>契約日</td>
                                        <td>商談ステップ</td>
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
                                            <td>{dateFormate(item.register)}</td>
                                            <td>{dateFormate(item.interview)}</td>
                                            <td>{dateFormate(item.contract)}</td>
                                            <td><div className="bg-danger text-white rounded text-center px-3 py-1 mx-auto" style={{ width: 'fit-content', cursor: 'pointer' }}
                                                onClick={() => setInterviewId(item.id)}>表示</div></td>
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
            <InformationEdit id={editId} token={token} onClose={closeInformationEdit} brand={brand} />
        </>
    )
}

export default Rank;