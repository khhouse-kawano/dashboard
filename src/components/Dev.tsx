import React, { useState, useEffect, useContext } from 'react'
import MenuDev from "./MenuDev";
import AuthContext from "../context/AuthContext";
import { headers } from '../utils/headers';
import Table from "react-bootstrap/Table";
import axios from "axios";
import { getPeriod } from '../utils/getPeriod';
import Modal from 'react-bootstrap/Modal';
import InformationEdit from './InformationEdit';
import { order } from '@mui/system';

type Staff = { name: string, shop: string, section: string, report: number, sort: number, multi: number, status: string };
type Shop = { brand: string, shop: string, section: string, area: string, division: string, multi: number };
type Section = { no: number, name: string, division: string };
type Customer = { id: string, customer: string, contract: string, shop: string, staff: string, section: string, rank: string, status: string };
type Achievement = { category: string, name: string, period: string, value: string }

const Company = () => {
    const { brand } = useContext(AuthContext);
    const { token } = useContext(AuthContext);
    const [open, setOpen] = useState(false);
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [shopList, setShopList] = useState<Shop[]>([]);
    const [sectionList, setSectionList] = useState<Section[]>([]);
    const [orderList, setOrderList] = useState<Customer[]>([]);
    const monthPeriod = getPeriod(2025, 6);
    const [show, setShow] = useState(false);
    const [contract, setContract] = useState<Customer[]>([]);
    const [achievement, setAchievement] = useState<Achievement[]>([]);
    const [targetDivision, setTargetDivision] = useState('');
    const [editId, setEditId] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: 'company' }, { headers });
            setStaffList(response.data.staff);
            setShopList(response.data.shop);
            setSectionList(response.data.section);
            setOrderList(response.data.contract);
            setAchievement(response.data.achievement);
        };
        fetchData();
    }, []);

    useEffect(() => {
        const target = document.getElementById(targetDivision);
        if (!target) return;

        target.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    }, [targetDivision]);


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

    const informationEditClose = () => setEditId('');

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
    const thisMonth = `${today.getFullYear()}年${today.getMonth() + 1}月`;
    const formattedThisMonth = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`;
    const rankArray = ['契約済み', 'Aランク', 'Bランク', 'Cランク'];
    const divisionArray: string[] = ['注文事業', '建売分譲事業', '不動産企画室', '中古リノベ'];
    // 共通変数

    return (
        <>
            <div className="d-flex">
                <div className='modal_menu' style={{ width: '20%' }}><MenuDev brand={brand} />
                </div>
                <div className="header_sp">
                    <i className="fa-solid fa-bars hamburger" onClick={() => setOpen(true)} />
                </div>
                <div className={`modal_menu_sp ${open ? "open" : ""}`}>
                    <i className="fa-solid fa-xmark hamburger position-absolute" onClick={() => setOpen(false)} />
                    <MenuDev brand={brand} />
                </div>
                <div className='content company bg-white p-0'>
                    <div className="d-flex align-items-center sort_section">
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
                            <tr className='target-top sticky-header'>
                                <td colSpan={2} className='text-center table-danger text-danger sticky-column' style={{ letterSpacing: '1px' }}>グループ予算</td>
                                {monthPeriod.map(month => {
                                    const target = achievement.find(a => a.category === 'group' && a.name === 'all' && a.period === month)?.value ? achievement.find(a => a.category === 'group' && a.name === 'all' && a.period === month)?.value : '';
                                    return (
                                        <td className='text-center table-danger' style={{ letterSpacing: '1px' }}><input type='text' className='company_input text-danger'
                                            value={target}
                                            onChange={(e) => changeAchievement(month, 'group', 'all', e.target.value)} /></td>
                                    )
                                }
                                )}
                                {(() => {
                                    const achievementLength = achievement.filter(a => a.category === 'group' && a.name === 'all').reduce((cur, acc) => cur + Number(acc.value), 0);
                                    return <td className='text-center table-danger text-danger' colSpan={2}>{achievementLength}</td>;
                                })()}
                                <td className='table-none-border'></td>
                                <td colSpan={4} rowSpan={2} className='text-center' style={{ letterSpacing: '1px' }}>{thisMonth}</td>
                            </tr>
                            <tr className='sticky-header next_top'>
                                <td colSpan={2} className='text-center text-primary table-primary sticky-column' style={{ letterSpacing: '1px' }}>グループ実績</td>
                                {monthPeriod.map(month => {
                                    const contractOrder = orderList.filter(o => dateFormate(o.contract).includes(month.replace(/-/g, '/')));
                                    const specContract = 0;
                                    const contractValue = contractOrder.length + specContract;
                                    return (
                                        <td className='text-center text-primary table-primary company_contract' onClick={contractValue > 0 ? () => {
                                            setShow(true);
                                            setContract(contractOrder);
                                        } : undefined} >{contractValue}</td>
                                    )
                                }
                                )}
                                <td className='text-center  text-primary table-primary' style={{ letterSpacing: '1px' }} colSpan={2}></td>
                                <td className='table-none-border'></td>
                            </tr>
                            <tr className='text-center target-bottom sticky-header third_top' >
                                <td colSpan={2} style={{ letterSpacing: '1px' }} className='sticky-column'>2025/06~2026/05</td>
                                {monthPeriod.map(month =>
                                    <td className='text-center' style={{ letterSpacing: '1px' }}>{month.replace(/-/g, '/')}</td>
                                )}
                                <td>合計</td>
                                <td>個人目標</td>
                                <td className='table-none-border'></td>
                                {rankArray.map(r =>
                                    <td className='text-center'>{r}</td>
                                )}
                            </tr>
                            {/* 以下部門別 */}
                            {divisionArray.map((division, divisionIndex) => {
                                const orderContractList = orderList.filter(o => o.contract && monthPeriod.includes(monthFormate(o.contract)) && o.status === '契約済み');
                                const orderProspectList = orderList.filter(o => o.status === '見込み');
                                return <React.Fragment key={divisionIndex}>
                                    <tr className='target-top' id={division}>
                                        <td rowSpan={2} style={{ backgroundColor: '#272727ff', color: '#f7f7f7' }} className='text-center align-middle sticky-column'>{division}</td>
                                        <td className='table-danger text-danger sticky-column next'>予算</td>
                                        {monthPeriod.map(month => {
                                            const target = achievement.find(a => a.category === 'section' && a.name === division && a.period === month)?.value ? achievement.find(a => a.category === 'section' && a.name === '注文事業' && a.period === month)?.value : '';
                                            return (
                                                <td className='text-center table-danger' style={{ letterSpacing: '1px' }}><input type='text' className='company_input text-danger'
                                                    value={target}
                                                    onChange={(e) => changeAchievement(month, 'section', '注文事業', e.target.value)} /></td>
                                            )
                                        }
                                        )}
                                        {(() => {
                                            const achievementLength = achievement.filter(a => a.category === 'section' && a.name === division).reduce((cur, acc) => cur + Number(acc.value), 0);
                                            return <td className='text-center table-danger text-danger' colSpan={2}>{achievementLength}</td>;
                                        })()}
                                        <td className='table-none-border'></td>
                                        {rankArray.map(r => {
                                            let targetList;
                                            if (division === '注文事業') {
                                                targetList = r === '契約済み' ?
                                                    orderContractList.filter(o => dateFormate(o.contract).includes(formattedThisMonth)) :
                                                    orderProspectList.filter(o => o.rank.includes(r) && o.status !== '契約済み' && o.shop);
                                            } else {
                                                targetList = [];
                                            }
                                            return (
                                                <td rowSpan={2} className={targetList.length > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                    onClick={targetList.length > 0 ? () => {
                                                        setShow(true);
                                                        setContract(targetList);
                                                    } : undefined} >{targetList.length}</td>
                                            )
                                        }
                                        )}
                                    </tr>
                                    <tr className='target-bottom'>
                                        <td className='table-primary text-primary sticky-column next'>実績</td>
                                        {monthPeriod.map((month, monthIndex) => {
                                            let divisionContractList;
                                            if (division === '注文事業') {
                                                divisionContractList = orderContractList.filter(o => dateFormate(o.contract).includes(dateFormate(month)));
                                            } else {
                                                divisionContractList = [];
                                            }
                                            return (
                                                <td key={monthIndex} className={divisionContractList.length > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                    onClick={divisionContractList.length > 0 ? () => {
                                                        setShow(true);
                                                        setContract(divisionContractList);
                                                    } : undefined}>{divisionContractList.length}</td>
                                            )
                                        }
                                        )}
                                        {(() => {
                                            let divisionContractList;
                                            if (division === '注文事業') {
                                                divisionContractList = orderContractList.filter(o => {
                                                    const contractDate = monthFormate(o.contract);
                                                    return (monthPeriod.includes(contractDate))
                                                });
                                            } else {
                                                divisionContractList = [];
                                            }

                                            return <td className={divisionContractList.length > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                onClick={divisionContractList.length > 0 ? () => {
                                                    setShow(true);
                                                    setContract(divisionContractList);
                                                } : undefined} colSpan={2}>{divisionContractList.length}</td>;
                                        })()}
                                        <td className='table-none-border'></td>
                                    </tr>
                                    {/* 以下営業課別 */}
                                    {sectionList.filter(s => s.division === division).map((section, sectionIndex) => {
                                        const sectionColors = ['table-primary', 'table-success', 'table-warning', 'table-danger', 'table-secondary', 'table-info'];
                                        const sectionColor = sectionColors[sectionIndex] || '#CCCCCC';
                                        const targetShop = shopList.filter(s => s.section === section.name).map(s => s.shop);
                                        const sectionContractList = orderContractList.filter(o => targetShop.includes(o.shop));
                                        const sectionProspectList = orderProspectList.filter(o => targetShop.includes(o.shop));
                                        return (
                                            <React.Fragment key={section.name}>
                                                <tr className='target-top' key={sectionIndex} id={section.name}>
                                                    <td rowSpan={2} className={`${sectionColor} text-center align-middle sticky-column`}>{section.name}</td>
                                                    <td className='table-danger text-danger sticky-column next'>予算</td>
                                                    {monthPeriod.map(month => {
                                                        const target = achievement.find(a => a.category === 'section' && a.name === section.name && a.period === month)?.value ? achievement.find(a => a.category === 'section' && a.name === section.name && a.period === month)?.value : '';
                                                        return (
                                                            <td className='text-center table-danger' style={{ letterSpacing: '1px' }}>
                                                                <input type='text' className='company_input text-danger'
                                                                    value={target}
                                                                    onChange={(e) => changeAchievement(month, 'section', section.name, e.target.value)} /></td>
                                                        )
                                                    }
                                                    )}
                                                    {(() => {
                                                        const achievementLength = achievement.filter(a => a.category === 'section' && a.name === section.name).reduce((cur, acc) => cur + Number(acc.value), 0);
                                                        return <td className='text-center table-danger text-danger' colSpan={2}>{achievementLength}</td>;
                                                    })()}
                                                    <td className='table-none-border'></td>
                                                    {rankArray.map(r => {
                                                        const target = r === '契約済み' ?
                                                            sectionContractList.filter(o => dateFormate(o.contract).includes(formattedThisMonth)) :
                                                            sectionProspectList.filter(o => o.rank.includes(r));
                                                        return (
                                                            <td rowSpan={2} className={target.length > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                                onClick={target.length > 0 ? () => {
                                                                    setShow(true);
                                                                    setContract(target);
                                                                } : undefined} >{target.length}</td>
                                                        )
                                                    }
                                                    )}
                                                </tr>
                                                <tr className='target-bottom'>
                                                    <td className='table-primary text-primary sticky-column next'>実績</td>
                                                    {monthPeriod.map((month, monthIndex) => {
                                                        const contractList = sectionContractList.filter(o => dateFormate(o.contract).includes(month.replace(/-/g, '/')));
                                                        return (
                                                            <td key={monthIndex} className={contractList.length > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                                onClick={contractList.length > 0 ? () => {
                                                                    setShow(true);
                                                                    setContract(contractList);
                                                                } : undefined}>{contractList.length}</td>
                                                        )
                                                    }
                                                    )}
                                                    <td className={sectionContractList.length > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                        onClick={sectionContractList.length > 0 ? () => {
                                                            setShow(true);
                                                            setContract(sectionContractList);
                                                        } : undefined} colSpan={2}>{sectionContractList.length}</td>
                                                    <td className='table-none-border'></td>
                                                </tr>
                                                {/* 以下店舗・担当別 */}
                                                {shopList
                                                    .filter(shop => shop.section === section.name && !shop.shop.includes('FH'))
                                                    .map(shop => {
                                                        return [...staffList, { name: '予算', shop: shop.shop, section: section.name, report: 1, sort: 0, multi: 0 }, { name: '実績', shop: shop.shop, section: section.name, report: 1, sort: -1, multi: shop.multi }]
                                                            .sort((a, b) => b.sort - a.sort).filter(staff => staff.shop === shop.shop && staff.report === 1)
                                                            .map((staff, staffIndex) => {
                                                                const staffLength = staffList.filter(s => s.shop === shop.shop && s.report === 1).length + 2; //予算と実績で2増やす
                                                                const isShop = staffIndex === staffLength - 1;
                                                                const shopContract = sectionContractList.filter(o => {
                                                                    return ((isShop ? o.shop === shop.shop : (o.staff === staff.name && o.shop === staff.shop)))
                                                                });
                                                                const multiContract = sectionContractList.filter(o => {
                                                                    return ((isShop ? o.shop.includes(shop.shop.replace(shop.brand, '')) : o.staff === staff.name))
                                                                });
                                                                const isStaff = staffIndex < staffLength - 2;
                                                                const isAchievement = staffIndex === staffLength - 2;
                                                                const isShopMulti = shop.multi === 1;
                                                                const isStaffMulti = staff.multi === 1;
                                                                return (
                                                                    <>
                                                                        <tr key={`${shop.shop}-${staff.name}`} className={staffIndex === 0 ? 'target-top' : staffIndex === staffLength - 1 ? 'target-bottom' : ''}
                                                                            id={staffIndex === 0 ? shop.shop : ''}>
                                                                            {staffIndex === 0 && <td rowSpan={staffLength} className={`${sectionColor} text-center align-middle sticky-column`}>{shop.shop}</td>}
                                                                            <td className={staffIndex === staffLength - 2 ? 'table-danger text-danger sticky-column next' :
                                                                                staffIndex === staffLength - 1 ? 'table-primary text-primary sticky-column next' : 'sticky-column next'}>{staff.name}</td>
                                                                            {[...monthPeriod, 'total'].map((month, monthIndex) => {
                                                                                const isTotal = monthIndex === monthPeriod.length;
                                                                                const shopPeriodContract = shopContract.filter(o => dateFormate(o.contract).includes(dateFormate(month)));
                                                                                const multiPeriodContract = multiContract.filter(o => dateFormate(o.contract).includes(dateFormate(month)));
                                                                                const targetShop = achievement.find(a => a.category === 'shop' && a.name === shop.shop && a.period === month)?.value ? achievement.find(a => a.category === 'shop' && a.name === shop.shop && a.period === month)?.value : '';
                                                                                const achievementLength = achievement.filter(a => a.category === 'shop' && a.name === shop.shop).reduce((cur, acc) => cur + Number(acc.value), 0);
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
                                                                                                    (isTotal ? `${shopContract.length}${isShopMulti ? `(${multiContract.length})` : ""}` : `${shopPeriodContract.length}${isShopMulti ? `(${multiPeriodContract.length})` : ""}`)
                                                                                                    : (isTotal ? `${shopContract.length}${isStaffMulti ? `(${multiContract.length})` : ""}` : shopPeriodContract.length)
                                                                                                }</td>}
                                                                                    </>
                                                                                )
                                                                            }
                                                                            )}
                                                                            {(() => {
                                                                                const target = achievement.find(a => a.category === 'staff' && a.name === staff.name && a.period === monthPeriod[0].slice(0, 7))?.value ? achievement.find(a => a.category === 'staff' && a.name === staff.name && a.period === monthPeriod[0].slice(0, 7))?.value : '';
                                                                                return (staffIndex !== staffLength - 2 && staffIndex !== staffLength - 1) &&
                                                                                    <td className='text-danger company_contract text-center'
                                                                                    ><input
                                                                                            type="text"
                                                                                            className="company_input text-danger"
                                                                                            value={target}
                                                                                            onChange={(e) => changeAchievement(monthPeriod[0].slice(0, 7), 'staff', staff.name, e.target.value)}
                                                                                        /></td>;
                                                                            })()}
                                                                            <td className='table-none-border'></td>
                                                                            {rankArray.map(r => {
                                                                                const isStaff = staffIndex !== staffLength - 2 && staffIndex !== staffLength - 1;
                                                                                const target = r === '契約済み' ?
                                                                                    orderList.filter(o => dateFormate(o.contract).includes(formattedThisMonth) && (isStaff ? o.staff === staff.name : o.shop === shop.shop)) :
                                                                                    orderList.filter(o => o.rank.includes(r) && !o.contract && o.status !== '契約済み' && (isStaff ? o.staff === staff.name : o.shop === shop.shop));
                                                                                return (
                                                                                    staffIndex !== staffLength - 1 &&
                                                                                    <td rowSpan={staffIndex === staffLength - 2 ? 2 : 1} className={target.length > 0 ? 'text-primary company_contract text-center table-primary' : 'text-center'}
                                                                                        onClick={target.length > 0 ? () => {
                                                                                            setShow(true);
                                                                                            setContract(target);
                                                                                        } : undefined} >{target.length}</td>
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
                            {contract.map((c, index) =>
                                <tr key={index}>
                                    <td>{c.contract ? c.contract : '-'}</td>
                                    <td><span onClick={() => setEditId(c.id)} style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>{c.customer} 様</span></td>
                                    <td>{c.shop}</td>
                                    <td>{c.staff}</td>
                                </tr>)}
                        </tbody>
                    </Table>
                </Modal.Body>
            </Modal>
            <InformationEdit id={editId} token={token} onClose={informationEditClose} brand={brand} />
        </>
    )
}

export default Company