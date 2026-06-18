import React, { useState, useEffect, useContext } from 'react';
import AuthContext from "../context/AuthContext";
import { headers } from '../utils/headers';
import Table from "react-bootstrap/Table";
import axios from "axios";
import { getPeriod } from '../utils/getPeriod';
import Modal from 'react-bootstrap/Modal';
import InformationEdit from './information/InformationEdit';
import InformationEditKaeru from './information/InformationEditKaeru';
import InformationEditResale from './information/InformationEditResale';
import { getYears } from '../utils/getYears';
import { staffSorter } from '../utils/staffSorter';

type Staff = { name: string, shop: string, section: string, report: number, sort: number, multi: number, status: string, period: string, position: string, khg_id: string };
type Shop = { brand: string, shop: string, section: string, area: string, division: string, multi: number };
type Section = { name: string, division: string };
type Customer = Record<string, string>;
type Achievement = { category: string, name: string, period: string, value: string }

const Company = () => {
    const { token, brand } = useContext(AuthContext);
    const [originalStaffList, setOriginalStaffList] = useState<Staff[]>([]);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [shopList, setShopList] = useState<Shop[]>([]);
    const [sectionList, setSectionList] = useState<Section[]>([]);
    const [customerList, setCustomerList] = useState<Customer[]>([]);
    const [show, setShow] = useState(false);
    const [contract, setContract] = useState<Customer[]>([]);
    const [achievement, setAchievement] = useState<Achievement[]>([]);
    const [targetDivision, setTargetDivision] = useState('');
    const [targetYear, setTargetYear] = useState<number | null>(null);
    const [editId, setEditId] = useState({
        order: '',
        kaeru: '',
        resale: ''
    });
    const now = new Date();
    const year = now.getFullYear();
    const thisYear = now.getMonth() <= 4 ? year : year + 1;

    useEffect(() => {
        const fetchData = async () => {
            const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: 'company' }, { headers });
            setOriginalStaffList(response.data.staff);
            setShopList(response.data.shop);
            setSectionList(response.data.section);
            setCustomerList([...response.data.contract, ...response.data.contract_kaeru, ...response.data.contract_resale]);
            setAchievement(response.data.achievement);
        };
        fetchData();
        setTargetYear(thisYear);
    }, []);

    useEffect(() => {
        const target = document.getElementById(targetDivision);
        if (!target) return;

        target.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    }, [targetDivision]);

    useEffect(() => {
        if (!targetYear) return;
        const filtered = originalStaffList.filter(o =>
            o.period === String(targetYear)
        );
        setStaffList(filtered);
    }, [originalStaffList, targetYear, customerList]);


    const moveToTarget = async (targetValue: string) => {
        const target = document.getElementById(targetValue);

        if (!target) {
            window.scrollTo({
                top: 0,
                behavior: "smooth",
            });
            return;
        }

        target.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    };


    const modalClose = async () => {
        setShow(false);
    };

    const informationEditClose = () => setEditId({
        order: '',
        kaeru: '',
        resale: ''
    });

    const changeAchievement = async (
        periodValue: string,
        categoryValue: string,
        nameValue: string,
        achievementValue: string
    ) => {
        const data = {
            demand: 'change_company_achievement',
            category: categoryValue,
            name: nameValue,
            period: periodValue,
            value: achievementValue
        };

        setAchievement(prev => {
            const index = prev.findIndex(
                a => a.category === categoryValue && a.period === periodValue && a.name === nameValue
            );

            if (index !== -1) {
                return prev.map(a =>
                    a.period === periodValue && a.category === categoryValue && a.name === nameValue
                        ? { ...a, value: achievementValue }
                        : a
                );
            }

            const newItem: Achievement = {
                category: categoryValue,
                period: periodValue,
                name: nameValue,
                value: achievementValue
            };
            return [...prev, newItem];
        });

        try {
            const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
            const response = await axios.post("https://khg-marketing.info/dashboard/api/", data, { headers });

            // if (Array.isArray(response.data)) {
            //   setAchievement(response.data);
            // } else {
            //   console.warn('Unexpected achievement response', response.data);
            // }
        } catch (error) {
            console.error('Error updating achievement:', error);

        }
    };

    // 共通変数
    const dateFormate = (date: string) => {
        return date ? date.replace(/-/g, '/') : ''
    };
    const monthFormate = (date: string) => {
        return date ? date.replace(/\//g, '-').slice(0, 7) : ''
    };
    const today = new Date();
    const monthArray: string[] = getPeriod(Number(targetYear) - 1, 6);
    const formattedThisMonth = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`;
    const rankArray = ['契約済み', 'Sランク', 'Aランク', 'Bランク', 'Cランク'];
    const divisionArray: string[] = ['注文事業', '建売分譲事業', '不動産企画室', '中古リノベ'];
    const divisionMapping = {
        '注文事業': '注文',
        '建売分譲事業': '建売',
        '中古リノベ': '買い:中古リノベ'
    };
    const achievementLength = (category: string, month?: string, division?: string, section?: string) => {
        if (category === 'all') {
            return achievement.filter(a => (month ? monthFormate(a.period) === monthFormate(month) : monthArray.includes(monthFormate(a.period)))
                && a.category === 'shop').reduce((cur, acc) => cur + Number(acc.value), 0);
        }
        if (category === 'division') {
            const targetShopArray = shopList.filter(s => s.division === division).map(s => s.shop);
            return achievement.filter(a => (month ? monthFormate(a.period) === monthFormate(month) : monthArray.includes(monthFormate(a.period)))
                && targetShopArray.includes(a.name)).reduce((cur, acc) => cur + Number(acc.value), 0);
        }
        if (category === 'section') {
            const targetShopArray = shopList.filter(s => s.section === section).map(s => s.shop);
            return achievement.filter(a => (month ? monthFormate(a.period) === monthFormate(month) : monthArray.includes(monthFormate(a.period)))
                && targetShopArray.includes(a.name)).reduce((cur, acc) => cur + Number(acc.value), 0);
        }
    };
    const cancelStyle = { background: 'red', color: 'white', padding: '0px 3px', fontSize: '8px', borderRadius: '50%', marginLeft: '3px' };

    type TableProps = {
        list: Customer[],
        row: number,
        col: number
    };
    const TableTd = ({ list, row, col }: TableProps) => {
        const cancelList = list.filter(o => o.status === '解約');
        return <td rowSpan={row} colSpan={col} className={list.length > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
            onClick={() => showCustomer(list)}>{list.length}{cancelList.length > 0 && <span style={cancelStyle}>{cancelList.length}</span>}</td>
    };
    const showCustomer = (list: Customer[]) => {
        if (list.length === 0) return;
        setShow(true);
        setContract(list);
        console.log(list)
    };
    // 共通変数

    return (
        <>
            <div className='content company bg-white p-0'>
                <div className="d-flex align-items-center sort_section">
                    <div className="bg-white m-1">
                        <select className='target' onChange={(e) => setTargetYear(Number(e.target.value))}
                            value={String(targetYear)}>
                            {getYears().map((year => <option value={year}>{year}年5月期</option>))}
                        </select>
                    </div>
                    <div className="bg-white m-1">
                        <select className='target' onChange={(e) => moveToTarget(e.target.value)}>
                            <option value={divisionArray[0]}>事業部を選択</option>
                            {divisionArray.map((division, index) =>
                                <option key={index} value={division}>{division}</option>
                            )}
                        </select>
                    </div>
                    <div className="bg-white m-1">
                        <select className='target' onChange={(e) => moveToTarget(e.target.value)}>
                            <option value={divisionArray[0]}>課を選択</option>
                            {sectionList.map((section, index) =>
                                <option key={index} value={section.name}>{section.name}</option>
                            )}
                        </select>
                    </div>
                    <div className="bg-white m-1">
                        <select className='target' onChange={(e) => moveToTarget(e.target.value)}>
                            <option value={divisionArray[0]}>店舗を選択</option>
                            {shopList.filter(s => s.section).map((shop, index) =>
                                <option key={index} value={shop.shop}>{shop.brand === 'KHF' && `${shop.division}_`}{shop.shop}</option>
                            )}
                        </select>
                    </div>
                </div>
                <Table bordered style={{ fontSize: '12px' }} className='company-table'>
                    <tbody className='align-middle'>
                        {/* 以下グループ */}
                        <tr className='text-center target-bottom sticky-header'>
                            <td colSpan={2} style={{ letterSpacing: '1px' }} className='sticky-column'>{Number(targetYear) - 1}/06~{Number(targetYear)}/05</td>
                            {monthArray.map(month =>
                                <td className='text-center' style={{ letterSpacing: '1px' }}>{dateFormate(month)}</td>
                            )}
                            <td>合計</td>
                            <td>個人目標</td>
                            <td className='table-none-border'></td>
                            {rankArray.map(r =>
                                <td className='text-center'>{r}</td>
                            )}
                        </tr>
                        <tr className='target-top sticky-header next_top'>
                            <td colSpan={2} className='text-center table-danger text-danger sticky-column' style={{ letterSpacing: '1px' }}>グループ予算</td>
                            {monthArray.map(month => {
                                return <td className='text-center table-danger text-danger'>{achievementLength('all', month)}</td>;
                            }
                            )}
                            <td className='text-center table-danger text-danger' colSpan={2}>{achievementLength('all')}</td>
                            <td className='table-none-border'></td>
                            {rankArray.map((r, index) => {
                                const orderContractList = customerList.filter(o => o.contract && monthArray.includes(monthFormate(o.contract)) && o.status === '契約済み');
                                const orderProspectList = customerList.filter(o => o.status === '見込み' && (o.rank_period <= formattedThisMonth || !o.rank_period));
                                const target = r === '契約済み' ?
                                    orderContractList.filter(o => dateFormate(o.contract)?.includes(formattedThisMonth)) :
                                    orderProspectList.filter(o => o.rank?.includes(r));
                                return <TableTd key={index} list={target} row={2} col={1} />
                            })}
                        </tr>
                        <tr className='sticky-header third_top'>
                            <td colSpan={2} className='text-center text-primary table-primary sticky-column' style={{ letterSpacing: '1px' }}>グループ実績</td>
                            {monthArray.map(month => {
                                const totalContract = customerList.filter(o => o.contract && dateFormate(o.contract).includes(dateFormate(month)) && (o.status === '契約済み' || o.status === '解約'));
                                return <TableTd list={totalContract} row={1} col={1} />
                            }
                            )}
                            <td className='text-center  text-primary table-primary' style={{ letterSpacing: '1px' }} colSpan={2}>
                                {customerList.filter(o => o.contract && monthArray.includes(monthFormate(o.contract)) && (o.status === '契約済み' || o.status === '解約')).length}</td>
                            <td className='table-none-border'></td>
                        </tr>
                        {/* 以下部門別 */}
                        {divisionArray.map((division, divisionIndex) => {
                            const contractList = customerList.filter(o => o.contract && monthArray.includes(monthFormate(o.contract)) && (o.status === '契約済み' || o.status === '解約') && o.category === divisionMapping[division]);
                            const prospectList = customerList.filter(o => o.status === '見込み' && (o.rank_period <= formattedThisMonth || !o.rank_period) && o.category === divisionMapping[division]);
                            return <React.Fragment key={divisionIndex}>
                                <tr className='target-top' id={division}>
                                    <td rowSpan={2} style={{ backgroundColor: '#272727ff', color: '#f7f7f7' }} className='text-center align-middle sticky-column'>{division}</td>
                                    <td className='table-danger text-danger sticky-column next'>予算</td>
                                    {monthArray.map(month => {
                                        return <td className='text-center table-danger text-danger'>{achievementLength('division', month, division)}</td>
                                    }
                                    )}
                                    <td className='text-center table-danger text-danger' colSpan={2}>{achievementLength('division', '', division)}</td>
                                    <td className='table-none-border'></td>
                                    {rankArray.map(r => {
                                        const targetList = r === '契約済み' ?
                                            contractList.filter(o => dateFormate(o.contract)?.includes(formattedThisMonth)) :
                                            prospectList.filter(o => o.rank?.includes(r));;
                                        return <TableTd list={targetList} row={2} col={1} />
                                    }
                                    )}
                                </tr>
                                <tr className='target-bottom'>
                                    <td className='table-primary text-primary sticky-column next'>実績</td>
                                    {monthArray.map((month, monthIndex) => {
                                        const divisionContractList = contractList.filter(o => dateFormate(o.contract).includes(dateFormate(month)));
                                        return <TableTd list={divisionContractList} row={1} col={1} key={monthIndex} />
                                    }
                                    )}
                                    <TableTd list={contractList.filter(o => monthArray.includes(monthFormate(o.contract)))} row={1} col={2} />
                                    <td className='table-none-border'></td>
                                </tr>
                                {/* 以下営業課別 */}
                                {sectionList.filter(s => s.division === division).map((section, sectionIndex) => {
                                    const sectionColors = ['table-primary', 'table-success', 'table-warning', 'table-danger', 'table-secondary', 'table-info'];
                                    const sectionColor = sectionColors[sectionIndex] || '#CCCCCC';
                                    const targetShop = shopList.filter(s => s.section === section.name).map(s => s.shop);
                                    const sectionContractList = contractList.filter(o => targetShop.includes(o.shop));
                                    const sectionProspectList = prospectList.filter(o => targetShop.includes(o.shop));
                                    return (
                                        <React.Fragment key={section.name}>
                                            <tr className='target-top' key={sectionIndex} id={section.name}>
                                                <td rowSpan={2} className={`${sectionColor} text-center align-middle sticky-column`}>{section.name}</td>
                                                <td className='table-danger text-danger sticky-column next'>予算</td>
                                                {monthArray.map(month => {
                                                    return <td className='text-center table-danger text-danger'>{achievementLength('section', month, '', section.name)}</td>
                                                }
                                                )}
                                                <td className='text-center table-danger text-danger' colSpan={2}>{achievementLength('section', '', '', section.name)}</td>
                                                <td className='table-none-border'></td>
                                                {rankArray.map(r => {
                                                    const target = r === '契約済み' ?
                                                        sectionContractList.filter(o => dateFormate(o.contract).includes(formattedThisMonth)) :
                                                        sectionProspectList.filter(o => o.rank.includes(r));
                                                    return <TableTd list={target} row={2} col={1} />
                                                }
                                                )}
                                            </tr>
                                            <tr className='target-bottom'>
                                                <td className='table-primary text-primary sticky-column next'>実績</td>
                                                {monthArray.map((month, monthIndex) => {
                                                    const contractList = sectionContractList.filter(o => dateFormate(o.contract).includes(month.replace(/-/g, '/')));
                                                    return <TableTd list={contractList} row={1} col={1} key={monthIndex} />
                                                }
                                                )}
                                                <TableTd list={sectionContractList} row={1} col={2} />
                                                <td className='table-none-border'></td>
                                            </tr>
                                            {/* 以下店舗・担当別 */}
                                            {shopList
                                                .filter(shop => shop.section === section.name && !shop.shop.includes('FH'))
                                                .map(shop => {
                                                    return [...staffList, { name: '予算', shop: shop.shop, section: section.name, report: 1, sort: 0, multi: 0 }, { name: '実績', shop: shop.shop, section: section.name, report: 1, sort: -1, multi: shop.multi }]
                                                        .sort(staffSorter()).filter(staff => staff.shop === shop.shop && staff.report === 1)
                                                        .map((staff, staffIndex) => {
                                                            const staffLength = staffList.filter(s => s.shop === shop.shop && s.report === 1).length + 2; //予算と実績で2増やす
                                                            const isShop = staffIndex === staffLength - 1;
                                                            const shopContract = sectionContractList.filter(o => {
                                                                return isShop ? o.shop === shop.shop : (o.staff === staff.name && o.shop === staff.shop)
                                                            });
                                                            const multiContract = contractList.filter(o => {
                                                                return isShop ? o.shop.includes(shop.shop.replace(shop.brand, '')) : o.staff === staff.name
                                                            });
                                                            const isStaff = staffIndex < staffLength - 2;
                                                            const isAchievement = staffIndex === staffLength - 2;
                                                            const isShopMulti = shop.multi === 1;
                                                            const isStaffMulti = staff.multi === 1;
                                                            const cancelList = shopContract.filter(o => o.status === '解約');
                                                            return (
                                                                <>
                                                                    <tr key={`${shop.shop}-${staff.name}`} className={staffIndex === 0 ? 'target-top' : staffIndex === staffLength - 1 ? 'target-bottom' : ''}
                                                                        id={staffIndex === 0 ? shop.shop : ''}>
                                                                        {staffIndex === 0 && <td rowSpan={staffLength} className={`${sectionColor} text-center align-middle sticky-column`}>{shop.shop}</td>}
                                                                        <td className={staffIndex === staffLength - 2 ? 'table-danger text-danger sticky-column next' :
                                                                            staffIndex === staffLength - 1 ? 'table-primary text-primary sticky-column next' : 'sticky-column next'}>{staff.name}</td>
                                                                        {[...monthArray, 'total'].map((month, monthIndex) => {
                                                                            const isTotal = monthIndex === monthArray.length;
                                                                            const shopPeriodContract = shopContract.filter(o => dateFormate(o.contract).includes(dateFormate(month)));
                                                                            const multiPeriodContract = multiContract.filter(o => dateFormate(o.contract).includes(dateFormate(month)));
                                                                            const targetShop = achievement.find(a => a.category === 'shop' && a.name === shop.shop && a.period === month)?.value ? achievement.find(a => a.category === 'shop' && a.name === shop.shop && a.period === month)?.value : '';
                                                                            const achievementLength = achievement.filter(a =>
                                                                                a.category === 'shop' &&
                                                                                a.name === shop.shop &&
                                                                                monthArray.includes(monthFormate(a.period))
                                                                            ).reduce((cur, acc) => cur + Number(acc.value), 0);
                                                                            const periodCancelList = shopPeriodContract.filter(o => o.status === '解約');
                                                                            return (
                                                                                <>{isAchievement &&
                                                                                    <td key={monthIndex} className='text-center text-danger table-danger' colSpan={isTotal ? 2 : 1}>
                                                                                        {isTotal ?
                                                                                            achievementLength
                                                                                            : <input
                                                                                                type="text"
                                                                                                className="company_input text-danger"
                                                                                                value={targetShop}
                                                                                                onChange={(e) => changeAchievement(month, 'shop', shop.shop, e.target.value)}
                                                                                            />}</td>}
                                                                                    {(isStaff || isShop) &&
                                                                                        <td key={monthIndex} className={((isTotal && shopContract.length > 0) || shopPeriodContract.length > 0) ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                                                            onClick={((isTotal && shopContract.length > 0) || shopPeriodContract.length > 0) ? () => {
                                                                                                setShow(true);
                                                                                                setContract(isTotal ? shopContract : shopPeriodContract);
                                                                                            } : undefined}
                                                                                            colSpan={(isTotal && isShop) ? 2 : 1}>
                                                                                            {isShop ?
                                                                                                (isTotal ? `${shopContract.length}${isShopMulti ? `(${multiContract.length})` : ''}` : `${shopPeriodContract.length}${isShopMulti ? `(${multiPeriodContract.length})` : ''}`)
                                                                                                : (isTotal ? `${shopContract.length}${isStaffMulti ? `(${multiContract.length})` : ''}` : shopPeriodContract.length)
                                                                                            }
                                                                                            {isTotal ?
                                                                                                (cancelList.length > 0 ? <span style={cancelStyle}>{cancelList.length}</span> : '') :
                                                                                                (periodCancelList.length > 0 ? <span style={cancelStyle}>{periodCancelList.length}</span> : '')}
                                                                                        </td>}
                                                                                </>
                                                                            )
                                                                        }
                                                                        )}
                                                                        {(() => {
                                                                            const target = achievement.find(a => a.category === 'staff' && a.name === staff.name && a.period === monthArray[0].slice(0, 7))?.value ? achievement.find(a => a.category === 'staff' && a.name === staff.name && a.period === monthArray[0].slice(0, 7))?.value : '';
                                                                            return (staffIndex !== staffLength - 2 && staffIndex !== staffLength - 1) &&
                                                                                <td className='text-danger company_contract text-center'
                                                                                ><input
                                                                                        type="text"
                                                                                        className="company_input text-danger"
                                                                                        value={target}
                                                                                        onChange={(e) => changeAchievement(monthArray[0].slice(0, 7), 'staff', staff.name, e.target.value)}
                                                                                    /></td>;
                                                                        })()}
                                                                        <td className='table-none-border'></td>
                                                                        {rankArray.map(r => {
                                                                            const isStaff = staffIndex !== staffLength - 2 && staffIndex !== staffLength - 1;
                                                                            const target = r === '契約済み' ?
                                                                                shopContract.filter(o => dateFormate(o.contract).includes(formattedThisMonth)) :
                                                                                sectionProspectList.filter(o => o.rank.includes(r) && (isStaff ? o.staff === staff.name : o.shop === shop.shop));
                                                                            return (
                                                                                staffIndex !== staffLength - 1 && <TableTd list={target} row={staffIndex === staffLength - 2 ? 2 : 1} col={1} />
                                                                            )
                                                                        }
                                                                        )}
                                                                    </tr>
                                                                </>
                                                            )
                                                        })
                                                })}
                                        </React.Fragment>
                                    )
                                })}
                                <tr>
                                    <td></td>
                                </tr>
                            </React.Fragment>
                        }
                        )}
                    </tbody>
                </Table>
            </div>
            <Modal show={show} onHide={modalClose}>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '12px' }}>顧客詳細</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Table bordered striped>
                        <tbody style={{ fontSize: '12px' }}>
                            <tr>
                                <td>契約日</td>
                                <td>お客様名</td>
                                <td>担当店舗</td>
                                <td>担当営業</td>
                            </tr>
                            {contract.map((c, index) => {
                                const idMapping = {
                                    '注文': 'order',
                                    '建売': 'kaeru',
                                    '買い:中古リノベ': 'resale',
                                    '買い:ポータル': 'resale',
                                    '売り:ポータル': 'resale'
                                };
                                return <tr key={index}>
                                    <td>{c.contract ? c.contract : '-'}</td>
                                    <td><span onClick={() => {
                                        setEditId(prev => ({
                                            ...prev,
                                            [idMapping[c.category]]: c.id
                                        }));
                                    }
                                    }
                                        style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>{c.customer} 様</span></td>
                                    <td>{idMapping[c.category] === 'resale' ? '中古住宅専門店' : c.shop}</td>
                                    <td>{c.staff}</td>
                                </tr>
                            }
                            )}
                        </tbody>
                    </Table>
                </Modal.Body>
            </Modal>
            <InformationEdit id={editId.order} token={token} onClose={informationEditClose} brand={brand} />
            <InformationEditKaeru id={editId.kaeru} token={token} onClose={informationEditClose} brand={brand} />
            <InformationEditResale id={editId.resale} token={token} onClose={informationEditClose} brand={brand} />
        </>
    )
}

export default Company