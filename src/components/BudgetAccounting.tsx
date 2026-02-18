import { useNavigate } from "react-router-dom";
import React, { useEffect, useState, useContext } from "react";
import Table from "react-bootstrap/Table";
import axios from "axios";
import AuthContext from "../context/AuthContext";
import MenuDev from "./MenuDev";
import { getYearMonthArray } from '../utils/getYearMonthArray';

type Medium = { medium: string, category: string, sort_key: number, response_medium: number, list_medium: number, ma_medium: number, ma_category: string };
type Budget = { budget_period: string, shop: string, medium: string, budget_value: number, note: string, company: string, response_medium: number, section: string, order_section: string };
type Shop = { brand: string, shop: string, section: string, register_goal: number, reserve_goal: number };
type CheckItem = {
  name: string;
  show: boolean;
};
type CheckedState = {
  [key: string]: CheckItem;
};
type Staff = { date: string; shop: string; count: number };

const BudgetAccounting = () => {
  const { brand } = useContext(AuthContext);
  const [shopList, setShop] = useState<Shop[]>([]);
  const [mediumList, setMedium] = useState<Medium[]>([]);
  const [originalBudgetList, setOriginalBudget] = useState<Budget[]>([]);
  const [budgetList, setBudget] = useState<Budget[]>([]);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { token } = useContext(AuthContext);
  const { category } = useContext(AuthContext);
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [originalMonthArray, setOriginalMonthArray] = useState<string[]>([]);
  const [monthArray, setMonthArray] = useState<string[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  useEffect(() => {
    if (!brand || brand.trim() === "" || !token || token.trim() === "" || !category || category.trim() === "") navigate("/login");
    const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
    const fetchData = async () => {
      const [shopRes, mediumRes, budgetRes, staffRes] = await Promise.all([
        axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list_accounting" }, { headers }),
        axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list_accounting" }, { headers }),
        axios.post("https://khg-marketing.info/dashboard/api/", { demand: "budget_accounting" }, { headers }),
        axios.post("https://khg-marketing.info/dashboard/api/", { demand: "staff_count" }, { headers }),
      ]);

      setShop(shopRes.data);
      setMedium(mediumRes.data);
      setOriginalBudget(budgetRes.data);
      setStaff(staffRes.data);
    };
    setOriginalMonthArray(getYearMonthArray(2025, 6));
    fetchData();
  }, []);

  const brandArray = [
    "KH",
    "DJH",
    "なごみ",
    "2L",
    "FH",
    "PG HOUSE",
    "JH",
    "かえる",
  ];

  const showBudgetNote = (event) => {
    const budgetNote = event.currentTarget.querySelector(".budget_note");
    if (budgetNote) {
      budgetNote.classList.toggle("d-none");
    }
  };

  const closeBudgetNote = (event) => {
    event.stopPropagation();
    const budgetNote = event.currentTarget.closest(".budget_note");
    if (budgetNote) {
      budgetNote.classList.add("d-none");
    }
  };

  useEffect(() => {
    const endIndex = !endMonth ? originalMonthArray.indexOf(startMonth) : originalMonthArray.indexOf(endMonth);
    setEndMonth(originalMonthArray[endIndex]);
  }, [startMonth]);

  useEffect(() => {
    const startIndex = startMonth ? originalMonthArray.indexOf(startMonth) : 0;
    const endIndex = endMonth ? originalMonthArray.indexOf(endMonth) + 1 : originalMonthArray.length
    const filteredMonthArray = originalMonthArray.slice(startIndex, endIndex);
    setMonthArray(filteredMonthArray);
    const filteredBudget = originalBudgetList.filter(item => filteredMonthArray.includes(item.budget_period.slice(0, 7)));
    setBudget(filteredBudget);
  }, [originalBudgetList, startMonth, endMonth]);

  const [checked, setChecked] = useState<CheckedState>({
    staff: { name: '平均在籍数', show: false },
    budget: { name: '1人あたり広告費', show: false },
    average: { name: '広告費の割合', show: false },
    web: { name: 'WEB広告費', show: false }
  });

  const checkedChange = (e) => {
    const { name } = e.target;

    setChecked(prev => ({
      ...prev,
      [name]: {
        ...prev[name],
        show: !prev[name].show
      }
    }));
  };

  return (
    <>
      <div className="outer-container">
        <div className="d-flex">
          <div className='modal_menu' style={{ width: '20%' }}><MenuDev brand={brand} />
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
          {budgetList.length > 0 ?
            <div className="content bg-white p-2">
              <div className="table-wrapper">
                <div className="list_table">
                  <div className="d-flex flex-wrap mb-3 search_condition">
                    <div className="m-1">
                      <select className="target" onChange={(e) => setStartMonth(e.target.value)}>
                        <option value="" selected>開始月</option>
                        {originalMonthArray.map((month, index) => (<option key={index} value={month} selected={month === startMonth}>{month}</option>
                        ))}
                      </select>
                    </div>
                    <span className='d-flex align-items-center mx-1'>～</span>
                    <div className="m-1">
                      <select className="target" onChange={(e) => setEndMonth(e.target.value)}>
                        <option value="" selected>終了月</option>
                        {originalMonthArray.map((month, index) => (<option key={index} value={month} selected={month === endMonth}>{month}</option>
                        ))}
                      </select>
                    </div>
                    {Object.entries(checked).map(([key, value]) => {
                      return <div className="m-1">
                        <label className="target checkbox d-flex align-items-center">
                          <input type="checkbox" checked={value.show} name={key} className='me-1' onChange={checkedChange} />{value.name}を表示
                        </label>
                      </div>
                    })}
                  </div>
                  <div className="p-0 inquiry">
                    <Table striped bordered hover className="budget_table" style={{ fontSize: '12px' }}>
                      <tbody style={{ fontSize: '10px' }}>
                        <tr className="sticky-header">
                          <td className="sticky-column budget text-dark table-secondary">
                            販促媒体
                          </td>
                          <td className="text-dark table-secondary text-center medium_title">合計</td>
                          {checked.staff.show && <td className="text-success table-success text-center medium_title">平均在籍数</td>}
                          {checked.average.show && <td className="text-danger table-danger text-center medium_title">広告費割合</td>}
                          {checked.web.show && <td className="text-info table-info text-center medium_title">WEB広告費</td>}
                          {mediumList.map((medium, index) => {
                            const medium_bg =
                              medium.response_medium === 0
                                ? "table-primary text-primary medium_title"
                                : "table-success text-success medium_title";
                            return (
                              <td key={index} className={`${medium_bg} text-center`}>
                                {medium.medium}
                              </td>
                            );
                          })}
                        </tr>
                        {['グループ全体', ...brandArray, ...shopList.map(s => s.shop)].map((target, index) => {
                          const isShop = shopList.map(s => s.shop).includes(target);
                          const base = budgetList
                            .filter(item => (index > 0 && !isShop ? item.shop.slice(0, 2) === target.slice(0, 2) : true) && (isShop ? item.shop === target : true));
                          const staffLength = staff.filter(s => (index > 0 && !isShop ? s.shop.slice(0, 2) === target.slice(0, 2) : true)
                            && (isShop ? s.shop === target : true)
                            && monthArray.includes(s.date));
                          const avgStaff = staffLength.reduce((acc, cur) => acc + cur.count, 0) / monthArray.length;
                          const shopBase = budgetList
                            .filter(item => item.section !== 'spec').reduce((acc, cur) => acc + cur.budget_value, 0);
                          const avgBudget = base.reduce((sum, item) => sum + item.budget_value, 0) / staffLength.reduce((acc, cur) => acc + cur.count, 0);
                          const shopAverage = base.reduce((sum, item) => sum + item.budget_value, 0) / shopBase;
                          return (
                            <tr key={index}>
                              <td className="sticky-column">{target}{!isShop && '合計'}</td>
                              <td style={{ textAlign: 'right' }}>
                                ￥
                                {base.reduce((sum, item) => sum + item.budget_value, 0).toLocaleString()}
                                <span className="text-primary fw-bold">{(checked.budget.show && !target.includes('かえる')) && `(￥${Math.ceil(avgBudget).toLocaleString()})`}</span>
                              </td>
                              {checked.staff.show && <td className="text-success" style={{ textAlign: 'right' }}>{(checked.staff.show && !target.includes('かえる')) && `${Math.ceil(avgStaff * 10) / 10}人`}</td>}
                              {checked.average.show && <td className="text-danger" style={{ textAlign: 'right' }}>{(checked.average.show && (index !== 0 && !target.includes('かえる'))) && `${(Math.ceil(shopAverage * 1000) / 10).toLocaleString()}%`}</td>}
                              {checked.web.show && <td className="text-info" style={{ textAlign: 'right' }}>￥{base.filter(item => ['SNS広告', 'インターネット検索'].includes(item.medium)).reduce((sum, item) => sum + item.budget_value, 0).toLocaleString()}</td>}
                              {mediumList.map((medium, index) => {
                                const filtered = base.filter(item => item.medium === medium.medium);
                                return (
                                  <td key={index} className="fw-normal" style={{ textAlign: 'right' }}>
                                    ￥
                                    {filtered.reduce((sum, item) => sum + item.budget_value, 0).toLocaleString()}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </Table>
                  </div>
                </div>
              </div>
            </div> :
            <div className="text-center mt-5 w-100"><i className='fa-solid fa-arrows-rotate sticky-column pointer spinning me-1'></i>Loading...</div>
          }
        </div>
      </div></>

  );
};

export default BudgetAccounting;
