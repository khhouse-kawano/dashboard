import React, { useEffect, useState, useMemo } from 'react';
import Table from "react-bootstrap/Table";
import axios from "axios";
import { getYearMonthArray } from '../../utils/getYearMonthArray';

interface CampaignSummaryProps {
    activeTab: string | null;
}
type Shop = { brand: string; shop: string; section: string; area: string; };
type Campaign = { register: string, interview: string, contract: string, in_charge_store: string, appointment: string, screening: string, hp_campaign: string };

const CampaignSummary: React.FC<CampaignSummaryProps> = ({ activeTab }) => {
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [campaignList, setCampaignList] = useState<Campaign[]>([]);
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [targetBrand, setTargetBrand] = useState('');
    const [targetShop, setTargetShop] = useState('');
    const [targetCampaign, setTargetCampaign] = useState('');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const thisYear = now.getMonth() <= 4 ? year - 1 : year;

    const brandFormate = (brand: string) => {
        return brand ? brand.replace('なごみ', 'nagomi').replace('PG HOUSE', 'PGH').replace('2L', 'nieru').toLowerCase() : '';
    };

    const monthFormate = (month: string) => {
        return month ? month.replace(/-/g, '/').slice(0, 7) : '';
    };

    useEffect(() => {
        const monthArray = getYearMonthArray(2025, 6);
        setMonthArray(monthArray);
        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: 'campaignSummary' }, { headers });
                await setShopArray(response.data.shop);
                await setCampaignList(response.data.campaign);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
        setEndMonth(`${String(year).padStart(2, '0')}/${String(month).padStart(2, '0')}`);
        month <= 5 ? setStartMonth(`${thisYear - 1}/06`) : setStartMonth(`${thisYear}/06`);
    }, []);

    const uniqueBrands = useMemo(() => {
        return Array.from(new Map(shopArray.map(item => [item.brand, item])).values());
    }, [shopArray]);

    const sortedCampaignList = useMemo(() => {
        const filteredList = campaignList.filter(c => {
            const targetMonth = monthArray.slice(monthArray.indexOf(startMonth), monthArray.indexOf(endMonth) + 1);
            const brandShops = shopArray.filter(s => brandFormate(s.brand) === brandFormate(targetBrand)).map(s => s.shop);
            return targetMonth.includes(monthFormate(c.register))
                && (targetBrand ? brandShops.includes(c.in_charge_store) : true)
                && (targetShop ? targetShop === c.in_charge_store : true)
                && (targetCampaign ? c.hp_campaign.includes(targetCampaign) : true)
        });
        return filteredList;
    }, [campaignList, startMonth, endMonth, targetBrand, targetShop, targetCampaign]);

    // const data = {
    //     labels: dataLabels,
    //     datasets: [
    //         {
    //             data: dataTotal,
    //             backgroundColor: colorCodes,
    //             borderColor: colorCodes,
    //             borderWidth: 1,
    //         },
    //     ],
    // };

    // const options: ChartOptions<"bar"> = {
    //     indexAxis: "y",
    //     maintainAspectRatio: false,
    //     responsive: true,
    //     plugins: {
    //         legend: {
    //             display: false,
    //         },
    //         title: {
    //             display: true,
    //             text: ""
    //         },
    //     },
    //     scales: {
    //         y: {
    //             beginAtZero: true,
    //         },
    //     },
    // };

    return (
        <div>
            <div className='container bg-white py-3 mt-2'>
                <div className="d-flex  mb-3 align-items-center">
                    <div className="m-1">
                        <select className="target" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}>
                            {monthArray.map((item, index) =>
                                <option value={item} key={index} selected={item === startMonth}>{item}</option>)}
                        </select>
                    </div>
                    <div>~</div>
                    <div className="m-1">
                        <select className="target" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} >
                            {monthArray.map((item, index) =>
                                <option value={item} key={index} selected={item === endMonth}>{item}</option>)}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" value={targetBrand} onChange={(e) => {
                            setTargetBrand(e.target.value);
                            setTargetShop('');
                        }}>
                            <option value=''>全ブランド</option>
                            {uniqueBrands.map((item, index) =>
                                <option key={index} value={item.brand}>{item.brand}</option>)}
                        </select>
                    </div>
                    <div className="m-1">
                        <select className="target" value={targetShop} onChange={(e) => {
                            setTargetShop(e.target.value);
                            setTargetBrand('');
                        }}>
                            <option value=''>全店舗</option>
                            {shopArray.map((item, index) =>
                                <option key={index} value={item.shop}>{item.shop}</option>)}
                        </select>
                    </div>
                    <div className="m-1">
                        <input type='text' className='target' placeholder='キャンペーン名で検索'
                            onChange={(e) => setTargetCampaign(e.target.value)} />
                    </div>
                </div>
                <div className="p-2">
                    <Table striped bordered style={{ fontSize: '12px' }}>
                        <thead>
                            <tr className='align-middle sticky-header'>
                                <td>No</td>
                                <td>キャンペーン名</td>
                                <td>ブランド</td>
                                <td>反響数</td>
                                <td>来場数</td>
                                <td>次アポ数</td>
                                <td>契約数推移</td>
                                <td>商談期間</td>
                                <td>契約率</td>
                                <td>キャンセル数・未来場数</td>
                            </tr>
                        </thead>
                        <tbody>
                            {['合計', ...new Set(sortedCampaignList.map(s => s.hp_campaign))]
                                .sort((a, b) => {
                                    const baseA = sortedCampaignList.filter(s => a !== '合計' ? s.hp_campaign === a : true);
                                    const baseB = sortedCampaignList.filter(s => b !== '合計' ? s.hp_campaign === b : true);
                                    return baseB.length - baseA.length
                                })
                                .map((campaign, index) => {
                                    const brandStore = sortedCampaignList.find(s => s.hp_campaign === campaign)?.in_charge_store;
                                    const brandValue = campaign === '土地新着ネット' ? 'KHG' : index > 0 ? shopArray.find(s => s.shop === brandStore)?.brand : '-';
                                    const base = sortedCampaignList.filter(s => index > 0 ? s.hp_campaign === campaign : true);
                                    const registerLength = base.length;
                                    const interviewLength = base.filter(s => s.interview).length + base.filter(s => !s.interview && (s.appointment || s.screening || s.contract)).length;
                                    const appointmentLength = base.filter(s => s.appointment || s.screening || s.contract).length;
                                    const contractLength = base.filter(s => s.contract).length;
                                    const cancelLength = base.filter(s => !s.interview && !s.appointment && !s.contract && !s.screening).length;
                                    const contractPeriod = base
                                        .filter(s => s.contract && s.register) // 両方あるものだけ
                                        .map(s => {
                                            const contractDate = new Date(s.contract.replace(/\//g, '-'));
                                            const registerDate = new Date(s.register.replace(/\//g, '-'));
                                            const diff = registerDate.getTime() - contractDate.getTime();
                                            const days = diff / (1000 * 60 * 60 * 24);
                                            return days;
                                        });

                                    const average =
                                        contractPeriod.length > 0
                                            ? -1 * Math.ceil(contractPeriod.reduce((a, b) => a + b, 0) / contractPeriod.length * 10) / 10
                                            : 0;

                                    const perContract = Math.ceil(contractLength / interviewLength * 1000) / 10;
                                    return <tr>
                                        <td>{index + 1}</td>
                                        <td>{campaign}</td>
                                        <td style={{ textAlign: 'center' }}>{brandValue}</td>
                                        <td style={{ textAlign: 'right' }}>{registerLength}</td>
                                        <td style={{ textAlign: 'right' }}>{interviewLength}</td>
                                        <td style={{ textAlign: 'right' }}>{appointmentLength}</td>
                                        <td style={{ textAlign: 'right' }}>{contractLength}</td>
                                        <td style={{ textAlign: 'right' }}><span className='text-primary'>{average > 0 && `${average}日`}</span></td>
                                        <td style={{ textAlign: 'right' }}><span className='text-danger'>{perContract > 0 && `${perContract}%`}</span></td>
                                        <td style={{ textAlign: 'right' }}>{cancelLength}</td>
                                    </tr>
                                }
                                )}

                        </tbody>
                    </Table>
                    {/* <div className="col-5">
                        <div style={{ height: `${sortedCampaignList.length * 43 + 43}px`, width: "100%" }}>
                            <Bar data={data} options={options} />
                        </div>
                    </div> */}
                </div>

            </div>
        </div>
    )
}

export default CampaignSummary
