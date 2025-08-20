import React, { useEffect, useState, useContext, useMemo } from 'react';
import Menu from "./Menu";
import Table from "react-bootstrap/Table";
import axios from "axios";
import AuthContext from '../context/AuthContext';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import { Bar } from 'react-chartjs-2';
import { colorCodes } from "./ColorCodes";
import { ChartOptions } from "chart.js";

interface CampaignSummaryProps {
    activeTab: string | null;
}

type Summary = { period: string; name: string; brand: string };
type Shop = { brand: string; shop: string; section: string; area: string; }

const CampaignDev: React.FC<CampaignSummaryProps> = ({ activeTab }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [campaignSummary, setCampaignSummary] = useState<Summary[]>([]);
    const [campaignList, setCampaignList] = useState<Summary[]>([]);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const getYearMonthArray = (startYear: number, startMonth: number) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const yearMonthArray: string[] = [];
        let year = startYear;
        let month = startMonth;

        while (
            year < currentYear ||
            (year === currentYear && month <= currentMonth)) {
            const formattedMonth = month.toString().padStart(2, "0");
            yearMonthArray.push(`${String(year)}/${formattedMonth}`);

            month++;
            if (month > 12) {
                month = 1;
                year++;
            }
        }

        return yearMonthArray;
    };

    useEffect(() => {
        const monthArray = getYearMonthArray(2025, 1);
        setMonthArray(monthArray);
        setSelectedMonth(`${String(year)}/${month}`);
        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const response = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "campaign" }, { headers });
                const responseShop = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers });
                await setCampaignSummary(response.data);
                await setShopArray(responseShop.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, [])

    useEffect(() => {
        setCampaignList(filtered);
    }, [campaignSummary, selectedMonth, selectedBrand])

    useEffect(() => {
        const uniqueBrand = Array.from(
            new Map(shopArray.map(item => [item.brand, item])).values()
        );
        setShopArray(uniqueBrand);
    }, [campaignSummary])

    const filtered = useMemo(() => {
        const filteredArray = campaignSummary.filter(item =>
            item.period.includes(selectedMonth) && item.name && (selectedBrand === "" || item.brand === selectedBrand)
        );
        const uniqueByName = Array.from(
            new Map(filteredArray.map(item => [item.name, item])).values()
        );

        return uniqueByName;
    }, [campaignSummary, selectedMonth, selectedBrand]);

    const filteredLength = useMemo(() => {
        return campaignSummary.filter(item => item.period.includes(selectedMonth) && (selectedBrand === "" || item.brand === selectedBrand))
    }, [campaignSummary, selectedMonth, selectedBrand]);

    const sortedCampaignList = useMemo(() => {
        return [...campaignList].sort((a, b) => {
            const countA = filteredLength.filter(c => c.name === a.name).length;
            const countB = filteredLength.filter(c => c.name === b.name).length;
            return countB - countA;
        });
    }, [campaignList, filteredLength]);


    // グラフ
    const dataLabels: string[] = [];
    const dataTotal: number[] = [];
    sortedCampaignList.filter(item => (selectedBrand === "" || item.brand === selectedBrand)).forEach((value) => {
        dataLabels.push(value.name);
        dataTotal.push(filteredLength.filter(campaign => campaign.name === value.name).length);
    });
    const data = {
        labels: dataLabels,
        datasets: [
            {
                data: dataTotal,
                backgroundColor: colorCodes,
                borderColor: colorCodes,
                borderWidth: 1,
            },
        ],
    };

    const options: ChartOptions<"bar"> = {
        indexAxis: "y",
        maintainAspectRatio: false,
        responsive: true,
        plugins: {
            legend: {
                display: false,
            },
            title: {
                display: true,
                text: ""
            },
        },
        scales: {
            y: {
                beginAtZero: true,
            },
        },
    };
    return (
        <div>
            <div className='container bg-white py-3 mt-2'>
                <div className="row mb-3">
                    <div className="col-md-3">
                        <select className="form-select" onChange={(e) => setSelectedMonth(e.target.value)}>
                            <option value=''>全期間</option>
                            {monthArray.map((item, index) =>
                                <option value={item} key={index} selected={item === selectedMonth}>{item}</option>)}
                        </select>
                    </div>
                    <div className="col-md-3">
                        <select className="form-select" onChange={(e) => setSelectedBrand(e.target.value)}>
                            <option value=''>全ブランド</option>
                            {shopArray.map((item, index) =>
                                <option key={index} >{item.brand}</option>)}
                        </select>
                    </div>
                </div>
                <div className="row">
                    <div className="col-5">
                        <Table striped bordered>
                            <thead>
                                <tr style={{ fontSize: '12px' }}>
                                    <td>No</td>
                                    <td>キャンペーン名</td>
                                    <td>反響数</td>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ fontSize: '12px' }}>
                                    <td>1</td>
                                    <td>合計</td>
                                    <td>{filteredLength.length}</td>
                                </tr>
                                {sortedCampaignList.map((item, index) => (
                                    <tr key={index} style={{ fontSize: '12px' }}>
                                        <td>{index + 2}</td>
                                        <td>{item.name}</td>
                                        <td>{filteredLength.filter(campaign => campaign.name === item.name).length}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                    <div className="col-7">
                        <div style={{ height: `${sortedCampaignList.length * 43 + 43}px`, width: "100%" }}>
                            <Bar data={data} options={options} />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}

export default CampaignDev
