import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Menu from "./Menu";
import { Bar } from "react-chartjs-2";
import './chartConfig';
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import AuthContext from "../context/AuthContext";
import Table from "react-bootstrap/Table";
import { colorCodes } from "./ColorCodes";
import MenuDev from "./MenuDev";


type MediumType = { id: number, medium: string, category: string, sort_key: number, response_medium: number };
type customerList = { id: string; shop: string; name: string; staff: string; status: string; rank: string; medium: string; reserve: string; register: string; contract: string; before_survey: number; before_interview: number; after_interview: number; call_status: string, reserved_status: string, full_address: string; phone_number: string; response_status: string };

const CustomerTrend: React.FC = () => {
    const { brand } = useContext(AuthContext);
    const [userData, setUserData] = useState<customerList[]>([]);
    const navigate = useNavigate();
    const [mediumArray, setMediumArray] = useState<string[]>([]);

    const getYearMonthArray = (startYear: number, startMonth: number): string[] => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const yearMonthArray: string[] = [];
        let year = startYear;
        let month = startMonth;

        while (year < currentYear || (year === currentYear && month <= currentMonth)) {
            const formattedMonth = month.toString().padStart(2, "0");
            yearMonthArray.push(`${year}/${formattedMonth}`);

            month++;
            if (month > 12) {
                month = 1;
                year++;
            }
        }
        return yearMonthArray;
    };

    const monthArray: string[] = getYearMonthArray(2025, 1);

    useEffect(() => {
        if (!brand || brand.trim() === "") {
            navigate("/");
            return;
        }
        const fetchData = async () => {
            try {
                const headers = {
                    Authorization: "4081Kokubu",
                    "Content-Type": "application/json",
                };
                const [customerResponse, mediumResponse] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_database" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "medium_list" }, { headers }),
                ]);
                await setUserData(customerResponse.data);
                await setMediumArray(mediumResponse.data.map((item: MediumType) => item.medium));

            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };

        fetchData();
    }, []);

    const dataSets = mediumArray.map((value, index) => {
        const dataArray: number[] = monthArray.map(month => {
            return userData.filter(item =>
                item.register.includes(month) && item.medium === value
            ).length;
        });

        return {
            label: value,
            data: dataArray,
            backgroundColor: colorCodes[index % colorCodes.length],
            stack: "Stack 0",
        };
    });

    const dataSetsReserve = mediumArray.map((value, index) => {
        const dataArray: number[] = monthArray.map(month => {
            return userData.filter(item =>
                item.reserve.includes(month) && item.medium === value
            ).length;
        });

        return {
            label: value,
            data: dataArray,
            backgroundColor: colorCodes[index % colorCodes.length],
            stack: "Stack 0",
        };
    });

    const dataSetsContract = mediumArray.map((value, index) => {
        const dataArray: number[] = monthArray.map(month => {
            return userData.filter(item =>
                item.contract.includes(month) && item.medium === value
            ).length;
        });

        return {
            label: value,
            data: dataArray,
            backgroundColor: colorCodes[index % colorCodes.length],
            stack: "Stack 0",
        };
    });

    const data = {
        labels: monthArray,
        datasets: dataSets,
    };

    const dataReserve = {
        labels: monthArray,
        datasets: dataSetsReserve,
    };

    const dataContract = {
        labels: monthArray,
        datasets: dataSetsContract,
    };

    const options = {
        responsive: true,
        scales: {
            x: {
                stacked: true as const,
            },
            y: {
                stacked: true as const,
                beginAtZero: true,
            },
        },
        plugins: {
            legend: {
                position: "top" as const,
            },
            title: {
                display: true,
                text: "総反響推移",
            },
        },
    };

    const optionsReserve = {
        responsive: true,
        scales: {
            x: {
                stacked: true as const,
            },
            y: {
                stacked: true as const,
                beginAtZero: true,
            },
        },
        plugins: {
            legend: {
                position: "top" as const,
            },
            title: {
                display: true,
                text: "来場者数推移",
            },
        },
    };

    return (
        <div className='outer-container'>
            <div className="d-flex">
                <div className='modal_menu' style={{ width: '20%' }}><MenuDev brand={brand}/></div>
                <div className='content customer bg-white p-2'>
                    <div className="table-wrapper">
                        <div className="list_table">
                            <div className='ps-2' style={{ fontSize: '13px' }}>※来場数・契約数は"反響日"起算となります。</div>
                            <Tabs
                                defaultActiveKey="home"
                                id="justify-tab-example"
                                className="mt-5 mb-3 bg-white"
                                style={{ fontSize: '13px', width: '80vw' }}
                                justify
                            >
                                <Tab eventKey="home" title="総反響推移">
                                    <Bar data={data} options={options} />
                                </Tab>
                                <Tab eventKey="profile" title="来場者推移">
                                    <Bar data={dataReserve} options={optionsReserve} />
                                </Tab>
                                <Tab eventKey="longer-tab" title="契約者推移">
                                    <Bar data={dataContract} options={optionsReserve} />
                                </Tab>
                            </Tabs>
                            <Table striped>
                                <thead style={{ fontSize: "13px" }}>
                                    <tr className="sticky-header">
                                        <td>販促媒体名</td>
                                        <td>合計</td>
                                        {monthArray.map((month, index) => (
                                            <td key={index}>
                                                {month}
                                            </td>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody style={{ fontSize: "13px" }}>
                                    <tr>
                                        <td>全販促媒体</td>
                                        <td>
                                            <span>総反響:{userData.filter(item => item.register.includes('2025')).length}</span><br />
                                            <span className="text-danger">来場数:{userData.filter(item => item.reserve?.includes('2025')).length}</span><br />
                                            <span className="text-primary">契約数:{userData.filter(item => item.contract?.includes('2025')).length}</span><br />
                                        </td>
                                        {monthArray.map((month, index) => (
                                            <td key={index}>
                                                <span>総反響:{userData.filter(item => item.register.includes(month)).length}</span><br />
                                                <span className="text-danger">来場数:{userData.filter(item => item.reserve?.includes(month)).length}</span><br />
                                                <span className="text-primary">契約数:{userData.filter(item => item.contract?.includes(month)).length}</span><br />
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td>ホームページ反響合計</td>
                                        <td>
                                            <span>総反響:{userData.filter(item => item.register.includes('2025') && item.response_status === 'ホームページ反響').length}</span><br />
                                            <span className="text-danger">来場数:{userData.filter(item => item.reserve?.includes('2025') && item.response_status === 'ホームページ反響').length}</span><br />
                                            <span className="text-primary">契約数:{userData.filter(item => item.contract?.includes('2025') && item.response_status === 'ホームページ反響').length}</span><br />
                                        </td>
                                        {monthArray.map((month, index) => (
                                            <td key={index}>
                                                <span>総反響:{userData.filter(item => item.register.includes(month) && item.response_status === 'ホームページ反響').length}</span><br />
                                                <span className="text-danger">来場数:{userData.filter(item => item.reserve?.includes(month) && item.response_status === 'ホームページ反響').length}</span><br />
                                                <span className="text-primary">契約数:{userData.filter(item => item.contract?.includes(month) && item.response_status === 'ホームページ反響').length}</span><br />
                                            </td>
                                        ))}
                                    </tr>
                                    {mediumArray.filter(item => item !== 'システム利用料' && item !== 'Amazonギフトカード').map((medium, index) =>
                                        <tr key={index}>
                                            <td>{medium}</td>
                                            <td>
                                                <span>総反響:{userData.filter(item => item.medium === medium && item.register.includes('2025')).length}</span><br />
                                                <span className="text-danger">来場数:{userData.filter(item => item.medium === medium && item.reserve?.includes('2025')).length}</span><br />
                                                <span className="text-primary">契約数:{userData.filter(item => item.medium === medium && item.contract?.includes('2025')).length}</span><br />
                                            </td>
                                            {monthArray.map((month, index) => (
                                                <td key={index}>
                                                    <span>総反響:{userData.filter(item => item.medium === medium && item.register.includes(month)).length}</span><br />
                                                    <span className="text-danger">来場数:{userData.filter(item => item.medium === medium && item.reserve?.includes(month)).length}</span><br />
                                                    <span className="text-primary">契約数:{userData.filter(item => item.medium === medium && item.contract?.includes(month)).length}</span><br />
                                                </td>
                                            ))}
                                        </tr>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerTrend;
