import React, { useEffect, useState, useMemo } from 'react';
import Table from "react-bootstrap/Table";
import axios from "axios";
import { Bar } from 'react-chartjs-2';
import { colorCodes } from "./ColorCodes";
import { ChartOptions } from "chart.js";
import { getYearMonthArray } from '../utils/getYearMonthArray';

interface CampaignSummaryProps {
    activeTab: string | null;
}

type Summary = { period: string; name: string; brand: string };
type Shop = { brand: string; shop: string; section: string; area: string; };
type Campaign = { register: string, reserve: string, contract: string, shop: string, campaign: string, reserved_status: string };

const CampaignDev: React.FC<CampaignSummaryProps> = ({ activeTab }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [campaignSummary, setCampaignSummary] = useState<Summary[]>([]);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [campaignList, setCampaignList] = useState<Campaign[]>([]);

    useEffect(() => {
        const monthArray = getYearMonthArray(2025, 6);
        setMonthArray(monthArray);
        setSelectedMonth(`${String(year)}/${month}`);
        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const response = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "campaign" }, { headers });
                const responseInquiry = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "campaign_inquiry" }, { headers });
                const responseShop = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers });
                const responseCustomer = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "customer_campaign" }, { headers });
                await setCampaignSummary(responseInquiry.data.filter(item => item.name));
                await setShopArray(responseShop.data);
                await setCampaignList(responseCustomer.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    const uniqueBrands = useMemo(() => {
        return Array.from(new Map(shopArray.map(item => [item.brand, item])).values());
    }, [shopArray]);

    const filtered = useMemo(() => {
        const filteredArray = campaignSummary.filter(item =>
            (selectedMonth === '' || item.period.includes(selectedMonth)) &&
            (selectedBrand === '' || item.brand.toLowerCase() === selectedBrand.toLowerCase())
        );
        return Array.from(new Map(filteredArray.map(item => [item.name, item])).values());
    }, [campaignSummary, selectedMonth, selectedBrand]);

    const filteredLength = useMemo(() => {
        return campaignSummary.filter(item =>
            (selectedMonth === '' || item.period.includes(selectedMonth)) &&
            (selectedBrand === '' || item.brand.toLowerCase() === selectedBrand.toLowerCase())
        );
    }, [campaignSummary, selectedMonth, selectedBrand]);

    const sortedCampaignList = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const countA = filteredLength.filter(c => c.name === a.name).length;
            const countB = filteredLength.filter(c => c.name === b.name).length;
            return countB - countA;
        });
    }, [filtered, filteredLength]);

    const dataLabels: string[] = [];
    const dataTotal: number[] = [];
    sortedCampaignList.filter(item => (selectedBrand === "" || item.brand.toLowerCase() === selectedBrand.toLowerCase())).forEach((value) => {
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
                <div className="d-flex  mb-3">
                    <div className="m-1">
                        <select className="target" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                            <option value=''>{monthArray[0]} ~ {monthArray[monthArray.length - 1]}</option>
                            {monthArray.map((item, index) =>
                                <option value={item} key={index}>{item}</option>)}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)}>
                            <option value=''>全ブランド</option>
                            {uniqueBrands.map((item, index) =>
                                <option key={index} value={item.brand}>{item.brand}</option>)}
                        </select>
                    </div>
                </div>
                <div className="row">
                    <div className="col-7">
                        <Table striped bordered>
                            <thead>
                                <tr style={{ fontSize: '12px' }}>
                                    <td>No</td>
                                    <td>キャンペーン名</td>
                                    <td>反響数</td>
                                    <td>来場数</td>
                                    <td>契約数</td>
                                    <td>キャンセル数</td>
                                </tr>
                            </thead>
                            <tbody>
                                {[{ period: '', name: '合計', brand: '' }, ...sortedCampaignList].map((item, index) => {
                                    const brandValue = (value: string) => {
                                        return value.slice(0, 2);
                                    }
                                    const registerLength = filteredLength.filter(f => index > 0 ? f.name === item.name : f.name);
                                    const campaignLength = campaignList.filter(c => (index > 0 ? c.campaign === item.name : c.campaign) && (selectedBrand ? brandValue(selectedBrand) === brandValue(c.shop) : true) && (selectedMonth ? c.reserve.replace(/-/g, '/').includes(selectedMonth) : c.reserve));
                                    const contractLength = campaignList.filter(c => (index > 0 ? c.campaign === item.name : c.campaign) && (selectedBrand ? brandValue(selectedBrand) === brandValue(c.shop) : true)  && (selectedMonth ? (c.register.replace(/-/g, '/').includes(selectedMonth) && c.contract) : c.contract));
                                    const cancelLength = campaignList.filter(c => (index > 0 ? c.campaign === item.name : c.campaign) && (selectedBrand ? brandValue(selectedBrand) === brandValue(c.shop) : true)  && (selectedMonth ? c.reserved_status.replace(/-/g, '/').includes(selectedMonth) && !c.reserve.includes(selectedMonth) : c.reserved_status && !c.reserve));
                                    return (
                                        <tr key={index} style={{ fontSize: '12px' }}>
                                            <td>{index + 1}</td>
                                            <td>{item.name}</td>
                                            <td style={{ textAlign: 'right' }}>{registerLength.length}</td>
                                            <td style={{ textAlign: 'right' }}>{campaignLength.length}</td>
                                            <td style={{ textAlign: 'right' }}>{contractLength.length}</td>
                                            <td style={{ textAlign: 'right' }}>{cancelLength.length}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </Table>
                    </div>
                    <div className="col-5">
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
