import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./chartConfig";
import Accordion from "react-bootstrap/Accordion";
import Table from "react-bootstrap/Table";
import { Line } from "react-chartjs-2";
import AuthContext from "../context/AuthContext";
import MenuDev from "./MenuDev";
import { ChartOptions } from "chart.js";

type Contract = { contractDate: string; staff: string; section: string; shop: string };
type Staff = { id: number; year: string; section: string; shop: string; staff: string };
type shopList = { section: string, shop: string };

const ContractDev = () => {
    const { brand } = useContext(AuthContext);
    const navigate = useNavigate();
    const [contractUser, setContractUser] = useState<Contract[]>([]);
    const [originalData, setOriginalData] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [shopArray, setShopArray] = useState<shopList[]>([]);
    const [staffArray, setStaffArray] = useState<Staff[]>([]);
    const [open, setOpen] = useState(false);
    const [yearArray, setYearArray] = useState<number[]>([]);
    const [targetYear, setTargetYear] = useState<string>('');
    const [targetYearArray, setTargetYearArray] = useState<string[]>([]);

    function getFiscalYearMonths(year: number): string[] {
        const months: string[] = [];
        for (let i = 0; i < 12; i++) {
            const month = ((i + 5) % 12) + 1; // 0→6月, 1→7月, …, 11→5月
            const currentYear = month >= 6 ? year - 1 : year;
            const formatted = `${currentYear}年${String(month).padStart(2, "0")}月`;
            months.push(formatted);
        }
        return months;
    }


    const monthArray = [
        "06",
        "07",
        "08",
        "09",
        "10",
        "11",
        "12",
        "01",
        "02",
        "03",
        "04",
        "05",
    ];
    const sectionArray = ["1課", "2課", "3課", "4課", "不動産課"];
    const dataArray: string[] = [];
    for (let i = 0; i < yearArray.length; i++) {
        for (let e = 0; e < monthArray.length; e++) {
            dataArray.push(`${yearArray[i]}/${monthArray[e]}`);
        }
    }

    const bgArray = ["bg-primary bg-opacity-25 ", "bg-success bg-opacity-25", "bg-warning bg-opacity-25 ", "bg-danger bg-opacity-25 ", "bg-secondary bg-opacity-25 "];
    let yearTotal = 0;
    const reverseYearArray = [...yearArray].reverse(); //タブの表示用に
    const groupedMonth = dataArray.reduce((acc, monthStr) => {
        const [year, month] = monthStr.split("/");
        const monthNum = Number(month);
        const fiscalYear = monthNum >= 6 ? year : String(Number(year) - 1);
        if (!acc[fiscalYear]) {
            acc[fiscalYear] = [];
        }
        acc[fiscalYear].push(monthStr);
        return acc;
    }, {});

    useEffect(() => {
        // if (!brand || brand.trim() === "") navigate("/");
        const fetchData = async () => {
            try {
                const headers = { Authorization: "4081Kokubu", "Content-Type": "application/json" };
                const [customerResponse, shopResponse, staffResponse] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "contract_customer" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "contract_shop" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "contract_staff" }, { headers })
                ]);
                setOriginalData(customerResponse.data);
                setShopArray(shopResponse.data)
                setStaffArray(staffResponse.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();

        const thisYear = new Date().getFullYear() + 1;
        const startYear = 2021;
        const years: number[] = []
        for (let year = startYear; year <= thisYear; year++) {
            years.push(year);
        }
        setYearArray(years);
        setTargetYear(String(thisYear));
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            const newYearArray: string[] = await getFiscalYearMonths(Number(targetYear));
            await setTargetYearArray(newYearArray);
            const lastYear = Number(targetYear) - 1;
            const filtered = await originalData.filter(item => item.contractDate.includes(targetYear) || item.contractDate.includes(String(lastYear)));
            await setContractUser(filtered);
            console.log(filtered);
            await setLoading(true);
        };
        fetchData();
    }, [targetYear, originalData]);

    // グラフ
    const section1Array: number[] = [];
    yearArray.forEach((year) => {
        let total: number = 0;
        groupedMonth[Number(year) - 1].forEach((month) => {
            total += originalData.filter(
                (item) =>
                    item.contractDate.includes(month) &&
                    item.section.includes(sectionArray[0])
            ).length;
        });
        section1Array.push(total);
    });

    const section2Array: number[] = [];
    yearArray.forEach((year) => {
        let total: number = 0;
        groupedMonth[Number(year) - 1].forEach((month) => {
            total += originalData.filter(
                (item) =>
                    item.contractDate.includes(month) &&
                    item.section.includes(sectionArray[1])
            ).length;
        });
        section2Array.push(total);
    });

    const section3Array: number[] = [];
    yearArray.forEach((year) => {
        let total: number = 0;
        groupedMonth[Number(year) - 1].forEach((month) => {
            total += originalData.filter(
                (item) =>
                    item.contractDate.includes(month) &&
                    item.section.includes(sectionArray[2])
            ).length;
        });
        section3Array.push(total);
    });

    const section4Array: number[] = [];
    yearArray.forEach((year) => {
        let total: number = 0;
        groupedMonth[Number(year) - 1].forEach((month) => {
            total += originalData.filter(
                (item) =>
                    item.contractDate.includes(month) &&
                    item.section.includes(sectionArray[3])
            ).length;
        });
        section4Array.push(total);
    });

    const section5Array: number[] = [];
    yearArray.forEach((year) => {
        let total: number = 0;
        groupedMonth[Number(year) - 1].forEach((month) => {
            total += originalData.filter(
                (item) =>
                    item.contractDate.includes(month) &&
                    item.section.includes(sectionArray[4])
            ).length;
        });
        section5Array.push(total);
    });

    const sectionTotalArray: number[] = [];
    yearArray.forEach((year) => {
        let total: number = 0;
        groupedMonth[Number(year) - 1].forEach((month) => {
            total += originalData.filter((item) =>
                item.contractDate.includes(month)
            ).length;
        });
        sectionTotalArray.push(total);
    });
    const data = {
        labels: yearArray.slice(1),
        datasets: [
            {
                label: sectionArray[0],
                data: section1Array.slice(1),
                fill: false,
                borderColor: "#082fae",
                backgroundColor: "#082fae",
                tension: 0.1,
            },
            {
                label: sectionArray[1],
                data: section2Array.slice(1),
                fill: false,
                borderColor: "#0c9e4d",
                backgroundColor: "#0c9e4d",
                tension: 0.1,
            },
            {
                label: sectionArray[2],
                data: section3Array.slice(1),
                fill: false,
                borderColor: "#f3ba00",
                backgroundColor: "#f3ba00",
                tension: 0.1,
            },
            {
                label: sectionArray[3],
                data: section4Array.slice(1),
                fill: false,
                borderColor: "#c91111",
                backgroundColor: "#c91111",
                tension: 0.1,
            },
            {
                label: sectionArray[4],
                data: section5Array.slice(1),
                fill: false,
                borderColor: "#6c757d",
                backgroundColor: "#6c757d",
                tension: 0.1,
            },
            {
                label: "グループ全体",
                data: sectionTotalArray.slice(1),
                fill: false,
                borderColor: "rgb(0, 0, 0)",
                backgroundColor: "rgb(0, 0, 0)",
                tension: 0.1,
            },
        ],
    };

    // グラフのオプション設定
    const options: ChartOptions<"line"> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "top",
            },
            title: {
                display: true,
                text: "契約数推移",
            },
        },
    };
    return (
        <div className="outer-container" style={{ width: "100vw" }}>
            <div className="d-flex">
                <div className="modal_menu">
                    <MenuDev brand={brand} />
                </div>
                <div className="header_sp">
                    <i
                        className="fa-solid fa-bars hamburger"
                        onClick={() => setOpen(true)}
                    />
                </div>
                <div className={`modal_menu_sp ${open ? "open" : ""}`}>
                    <i
                        className="fa-solid fa-xmark hamburger position-absolute"
                        onClick={() => setOpen(false)}
                    />
                    <MenuDev brand={brand} />
                </div>
                <div className="content">
                    <div className="table-wrapper">
                        <div className="list_table contract p-2">
                            <div className="bg-light">
                                <div className="lineGraph">
                                    <Line data={data} options={options} />
                                </div>
                                <div className="my-3 ms-md-4">
                                    <select className="target" onChange={(e) => setTargetYear(e.target.value)}>
                                        <option value={targetYear}>年度を選択</option>
                                        {yearArray.map((item, index) => <option key={index} value={item}>{item}年度</option>)}
                                    </select>
                                </div>
                                <div>
                                    <Table bordered className="mx-md-4 mx-1 p-0 text-center totalTable">
                                        <tbody>
                                            <tr>
                                                <td rowSpan={2} className="tableTtl total">{targetYear}年度</td>
                                                {targetYearArray.map((month, index) => <td key={index} className="thread">{month}</td>)}
                                                <td className="tableTtl total">合計</td>
                                            </tr>
                                            <tr>
                                                {targetYearArray.map((month, index) => <td key={index} className="thread">
                                                    {contractUser.filter(item => item.contractDate.includes(month.replace(/年/g, '/').replace('月', ''))).length}
                                                </td>)}
                                                <td className="tableTtl total">  {(() => {
                                                    const totalArray: number[] = targetYearArray.map((month) => {
                                                        const monthCondition = month.replace(/年/g, '/').replace('月', '');
                                                        return contractUser.filter(item =>
                                                            item.contractDate.includes(monthCondition)
                                                        ).length;
                                                    });
                                                    const total = totalArray.reduce((acc, cur) => acc + cur, 0);
                                                    return total;
                                                })()}</td>
                                            </tr>
                                        </tbody>
                                    </Table>
                                    <Accordion alwaysOpen>
                                        {sectionArray.map((section, indexSection) => (
                                            <Accordion.Item className={bgArray[indexSection]} eventKey={String(indexSection)}>
                                                <Accordion.Header>
                                                    <Table striped bordered className="me-2 my-0 text-center sectionTable">
                                                        <tbody>
                                                            <tr>
                                                                <td rowSpan={2} className="tableTtl total">{section}</td>
                                                                {targetYearArray.map((month, index) => <td key={index} className="thread">{month}</td>)}
                                                                <td className="tableTtl total">合計</td>
                                                            </tr>
                                                            <tr>
                                                                {targetYearArray.map((month, index) => <td key={index} className="thread">
                                                                    {contractUser.filter(item => item.contractDate.includes(month.replace(/年/g, '/').replace('月', ''))
                                                                        && item.section === section).length}
                                                                </td>)}
                                                                <td className="tableTtl total">  {(() => {
                                                                    const totalArray: number[] = targetYearArray.map((month) => {
                                                                        const monthCondition = month.replace(/年/g, '/').replace('月', '');
                                                                        return contractUser.filter(item =>
                                                                            item.contractDate.includes(monthCondition) && item.section === section
                                                                        ).length;
                                                                    });
                                                                    const total = totalArray.reduce((acc, cur) => acc + cur, 0);
                                                                    return total;
                                                                })()}</td>
                                                            </tr>
                                                        </tbody>
                                                    </Table>
                                                </Accordion.Header>
                                                <Accordion.Body className="p-0 m-0">
                                                    <Accordion alwaysOpen>
                                                        {shopArray.filter(shop => shop.section === section).map((shop, index) => (
                                                            <Accordion.Item className={bgArray[indexSection]} eventKey={String(index)}>
                                                                <Accordion.Header>
                                                                    <Table striped bordered className="me-2 my-0 text-center sectionTable">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td rowSpan={2} className="tableTtl total">{shop.shop}</td>
                                                                                {targetYearArray.map((month, index) => <td key={index} className="thread">{month}</td>)}
                                                                                <td className="tableTtl total">合計</td>
                                                                            </tr>
                                                                            <tr>
                                                                                {targetYearArray.map((month, index) => <td key={index} className="thread">
                                                                                    {contractUser.filter(item => item.contractDate.includes(month.replace(/年/g, '/').replace('月', ''))
                                                                                        && item.shop === shop.shop.replace('店', '')).length}
                                                                                </td>)}
                                                                                <td className="tableTtl total">  {(() => {
                                                                                    const totalArray: number[] = targetYearArray.map((month) => {
                                                                                        const monthCondition = month.replace(/年/g, '/').replace('月', '');
                                                                                        return contractUser.filter(item =>
                                                                                            item.contractDate.includes(monthCondition) && item.shop === shop.shop.replace('店', '')
                                                                                        ).length;
                                                                                    });
                                                                                    const total = totalArray.reduce((acc, cur) => acc + cur, 0);
                                                                                    return total;
                                                                                })()}</td>
                                                                            </tr>
                                                                        </tbody>
                                                                    </Table>
                                                                </Accordion.Header>
                                                                <Accordion.Body className="">
                                                                    <Table striped bordered className="me-2 my-0 text-center sectionTable">
                                                                        <tbody>
                                                                            <tr>
                                                                                <td className="tableTtl total">営業</td>
                                                                                {targetYearArray.map((month, index) => <td key={index} className="thread">{month}</td>)}
                                                                                <td className="tableTtl total">合計</td>
                                                                            </tr>
                                                                            {staffArray.filter(item => item.shop === shop.shop.replace('店', '') && item.year === targetYear).map(staff =>
                                                                                <tr>
                                                                                    <td className="tableTtl total">{staff.staff}</td>
                                                                                    {targetYearArray.map((month, index) => <td key={index} className="thread">
                                                                                        {contractUser.filter(item => item.contractDate.includes(month.replace(/年/g, '/').replace('月', ''))
                                                                                            && item.shop === shop.shop.replace('店', '') && item.staff.includes(staff.staff)).length}
                                                                                    </td>)}
                                                                                    <td className="tableTtl total">  {(() => {
                                                                                        const totalArray: number[] = targetYearArray.map((month) => {
                                                                                            const monthCondition = month.replace(/年/g, '/').replace('月', '');
                                                                                            return contractUser.filter(item =>
                                                                                                item.contractDate.includes(monthCondition) && item.shop === shop.shop.replace('店', '') && item.staff.includes(staff.staff)
                                                                                            ).length;
                                                                                        });
                                                                                        const total = totalArray.reduce((acc, cur) => acc + cur, 0);
                                                                                        return total;
                                                                                    })()}</td>
                                                                                </tr>)}
                                                                        </tbody>
                                                                    </Table>
                                                                </Accordion.Body>
                                                            </Accordion.Item>
                                                        ))}
                                                    </Accordion>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                        ))}
                                    </Accordion>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ContractDev