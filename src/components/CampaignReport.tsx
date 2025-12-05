import React, { useEffect, useState, useMemo } from 'react';
import Table from "react-bootstrap/Table";
import axios from "axios";
import Modal from 'react-bootstrap/Modal';

interface CampaignSummaryProps {
    activeTab: string | null;
}

type Summary = { period: string; name: string; brand: string };
type Shop = { brand: string; shop: string; section: string; area: string; };
type Form = { time: string; brand: string; campaign: string; url: string; source: string };
type SummaryRow = { campaign: string }; // 合計用

type CampaignRow = Form | SummaryRow;
type Campaign = { campaign: string, campaign_id: string };
type Breakaway = { brand: string, campaign: string, time: string, filled: string }

const CampaignReport: React.FC<CampaignSummaryProps> = ({ activeTab }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const [monthArray, setMonthArray] = useState<string[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [campaignSummary, setCampaignSummary] = useState<Summary[]>([]);
    const [shopArray, setShopArray] = useState<Shop[]>([]);
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [form, setForm] = useState<Form[]>([]);
    const [originalForm, setOriginalForm] = useState<Form[]>([]);
    const [formList, setFormList] = useState<Campaign[]>([]);
    const [breakaway, setBreakaway] = useState<Breakaway[]>([]);
    const [sortKey, setSortKey] = useState<string>('access');
    const [sortOrder, setSortOrder] = useState<string>('asc');
    const [filteredCampaign, setFilteredCampaign] = useState<Form[]>([]);
    const [show, setShow] = useState(false);
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
        const monthArray = getYearMonthArray(2025, 11);
        setMonthArray(monthArray);
        setSelectedMonth(`${String(year)}/${month}`);
        const fetchData = async () => {
            try {
                const headers = { Authorization: '4081Kokubu', 'Content-Type': 'application/json' };
                const [campaignResponse, shopResponse, formResponse, formListResponse, breakawayResponse] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "campaign" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "form_show" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "form_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "breakaway_list" }, { headers }),
                ]);
                setCampaignSummary(campaignResponse.data);
                setShopArray(shopResponse.data);
                setOriginalForm(formResponse.data);
                setFormList(formListResponse.data);
                setBreakaway(breakawayResponse.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    const uniqueBrands = useMemo(() => {
        return Array.from(new Map(shopArray.map(item => [item.brand, item])).values());
    }, [shopArray]);

    useEffect(() => {
        const filteredForm = originalForm.filter(item => {
            const formattedTime = item.time.split(' ')[0].replace(/-/g, '/');
            return (selectedMonth === '' || formattedTime.includes(selectedMonth)) &&
                (selectedBrand === '' || item.brand.toLowerCase() === selectedBrand
                    .replace('なごみ', 'nagomi')
                    .replace('PGH', 'PG')
                    .toLowerCase());
        });

        filteredForm.forEach(item => {
            if (item.source === '' && item.url.includes('meta')) {
                item.source = 'Facebook/Instagram';
            }
        });

        setForm(filteredForm);

        const unique = [...new Map(filteredForm.map(f => [f.campaign, f])).values()];
        const add = { time: '', brand: '', url: '', campaign: '合計', source: '' };
        console.log([...unique, add])
        setFilteredCampaign([...unique, add])
    }, [originalForm, selectedMonth, selectedBrand]);


    const changeSort = (order: string, key: string) => {
        setSortKey(key);
        setSortOrder(order)
    };

    const modalClose = async()=>
        await setShow(false);

    return (
        <div>
            <div className='container bg-white py-3 mt-2'>
                <div className="d-flex  mb-3">
                    <div className="m-1">
                        <select className="target" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                            <option value=''>全期間</option>
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
                    <div className="col">
                        <Table striped bordered>
                            <thead>
                                <tr style={{ fontSize: '12px' }}>
                                    <td>No</td>
                                    <td>キャンペーン名</td>
                                    <td className='text-center table-primary' style={{ position: 'relative' }}>PV
                                        <span style={{ position: 'absolute', top: '4px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'access')}>▲</span>
                                        <span style={{ position: 'absolute', top: '14px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'access')}>▼</span>
                                    </td>
                                    <td className='text-center table-success' style={{ position: 'relative' }}>CV
                                        <span style={{ position: 'absolute', top: '4px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'cv')}>▲</span>
                                        <span style={{ position: 'absolute', top: '14px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'cv')}>▼</span>
                                    </td>
                                    <td className='text-center table-danger' style={{ position: 'relative' }}>フォーム離脱
                                        <span style={{ position: 'absolute', top: '4px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'breakaway')}>▲</span>
                                        <span style={{ position: 'absolute', top: '14px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'breakaway')}>▼</span>
                                    </td>
                                    <td className='text-center' style={{ position: 'relative' }}>Facebook/Instagram
                                        <span style={{ position: 'absolute', top: '4px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'meta')}>▲</span>
                                        <span style={{ position: 'absolute', top: '14px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'meta')}>▼</span>
                                    </td>
                                    <td className='text-center' style={{ position: 'relative' }}>Google
                                        <span style={{ position: 'absolute', top: '4px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'google')}>▲</span>
                                        <span style={{ position: 'absolute', top: '14px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'google')}>▼</span>
                                    </td>
                                    <td className='text-center' style={{ position: 'relative' }}>Yahoo
                                        <span style={{ position: 'absolute', top: '4px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'yahoo')}>▲</span>
                                        <span style={{ position: 'absolute', top: '14px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'yahoo')}>▼</span>
                                    </td>
                                    <td className='text-center' style={{ position: 'relative' }}>Flyer
                                        <span style={{ position: 'absolute', top: '4px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'flyer')}>▲</span>
                                        <span style={{ position: 'absolute', top: '14px', right: '5px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'flyer')}>▼</span>
                                    </td>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCampaign.sort((a, b) => {
                                    let countA;
                                    let countB;
                                    if (sortKey === 'access') {
                                        countA = a.campaign === '合計' ? form.length : form.filter(form => form.campaign === a.campaign).length;
                                        countB = b.campaign === '合計' ? form.length : form.filter(form => form.campaign === b.campaign).length;
                                    } else if (sortKey === 'cv') {
                                        const campaignNameA = formList.find(form => form.campaign_id === a.campaign)?.campaign;
                                        const campaignNameB = formList.find(form => form.campaign_id === b.campaign)?.campaign;
                                        countA = a.campaign === '合計' ? campaignSummary.filter(c => c.period.includes(selectedMonth)).length : campaignSummary.filter(c => c.name === campaignNameA && c.period.includes(selectedMonth)).length;
                                        countB = b.campaign === '合計' ? campaignSummary.filter(c => c.period.includes(selectedMonth)).length : campaignSummary.filter(c => c.name === campaignNameB && c.period.includes(selectedMonth)).length;
                                    } else if (sortKey === 'breakaway') {
                                        const campaignNameA = formList.find(form => form.campaign_id === a.campaign)?.campaign;
                                        const campaignNameB = formList.find(form => form.campaign_id === b.campaign)?.campaign;
                                        countA = a.campaign === '合計' ? breakaway.length : breakaway.filter(br => br.campaign === campaignNameA).length;
                                        countB = b.campaign === '合計' ? breakaway.length : breakaway.filter(br => br.campaign === campaignNameB).length;
                                    } else if (sortKey === 'meta') {
                                        countA = a.campaign === '合計' ? form.filter(form => form.source.toLowerCase() === 'facebook/instagram' || form.source.toLowerCase().includes('ig') || form.source.toLowerCase().includes('fb')).length : form.filter(form => form.campaign === a.campaign && (form.source.toLowerCase() === 'facebook/instagram' || form.source.toLowerCase().includes('fb'))).length;
                                        countB = b.campaign === '合計' ? form.filter(form => form.source.toLowerCase() === 'facebook/instagram' || form.source.toLowerCase().includes('ig') || form.source.toLowerCase().includes('fb')).length : form.filter(form => form.campaign === b.campaign && (form.source.toLowerCase() === 'facebook/instagram' || form.source.toLowerCase().includes('fb'))).length;
                                    } else if (sortKey === 'google') {
                                        countA = a.campaign === '合計' ? form.filter(form => form.source.toLowerCase() === 'google').length : form.filter(form => form.campaign === a.campaign && form.source.toLowerCase() === 'google').length;
                                        countB = b.campaign === '合計' ? form.filter(form => form.source.toLowerCase() === 'google').length : form.filter(form => form.campaign === b.campaign && form.source.toLowerCase() === 'google').length;
                                    } else if (sortKey === 'yahoo') {
                                        countA = a.campaign === '合計' ? form.filter(form => form.source.toLowerCase() === 'yahoo').length : form.filter(form => form.campaign === a.campaign && form.source.toLowerCase() === 'yahoo').length;
                                        countB = b.campaign === '合計' ? form.filter(form => form.source.toLowerCase() === 'yahoo').length : form.filter(form => form.campaign === b.campaign && form.source.toLowerCase() === 'yahoo').length;
                                    } else if (sortKey === 'flyer') {
                                        countA = a.campaign === '合計' ? form.filter(form => form.source.toLowerCase() === 'flyer').length : form.filter(form => form.campaign === a.campaign && form.source.toLowerCase() === 'flyer').length;
                                        countB = b.campaign === '合計' ? form.filter(form => form.source.toLowerCase() === 'flyer').length : form.filter(form => form.campaign === b.campaign && form.source.toLowerCase() === 'flyer').length;
                                    }
                                    return sortOrder === 'desc' ? countA - countB : countB - countA
                                }).map((f, index) => {
                                    const campaignName = f.campaign === '合計' ? '合計' : formList.find(form => form.campaign_id === f.campaign)?.campaign;
                                    const accessLength = f.campaign === '合計' ? form.length : form.filter(form => form.campaign === f.campaign).length;
                                    const breakawayLength = f.campaign === '合計' ? breakaway.length : breakaway.filter(b => b.campaign === campaignName && b.time.replace(/-/g, '/').includes(selectedMonth)).length;
                                    const campaignUrl = f.campaign === '合計' ? '' : form.find(form => form.campaign === f.campaign)?.url;
                                    const metaLength = f.campaign === '合計' ? form.filter(form => form.source.toLowerCase() === 'facebook/instagram' || form.source.toLowerCase().includes('ig') || form.source.toLowerCase().includes('fb')).length : form.filter(form => form.campaign === f.campaign && (form.source.toLowerCase() === 'facebook/instagram' || form.source.toLowerCase().includes('ig') || form.source.toLowerCase().includes('fb'))).length;
                                    const googleLength = f.campaign === '合計' ? form.filter(form => form.source.toLowerCase() === 'google').length : form.filter(form => form.campaign === f.campaign && form.source.toLowerCase() === 'google').length;
                                    const yahooLength = f.campaign === '合計' ? form.filter(form => form.source.toLowerCase() === 'yahoo').length : form.filter(form => form.campaign === f.campaign && form.source.toLowerCase() === 'yahoo').length;
                                    const flyerLength = f.campaign === '合計' ? form.filter(form => form.source.toLowerCase() === 'flyer').length : form.filter(form => form.campaign === f.campaign && form.source.toLowerCase() === 'flyer').length;
                                    const cvLength = f.campaign === '合計' ? campaignSummary.filter(c => c.period.includes(selectedMonth)).length : campaignSummary.filter(c => c.name === campaignName && c.period.includes(selectedMonth)).length;
                                    return (<tr style={{ fontSize: '12px' }}>
                                        <td>{index + 1}</td>
                                        <td>{f.campaign === '合計' ? '合計' : <a href={campaignUrl?.split('?')[0]} target='_blank'><div className="">{campaignName}</div></a>}</td>
                                        <td className='text-center table-primary'>{accessLength}</td>
                                        <td className='text-center table-success'>{cvLength}</td>
                                        <td className="text-center table-danger">{breakawayLength}</td>
                                        <td className='text-center'>{metaLength}</td>
                                        <td className='text-center'>{googleLength}</td>
                                        <td className='text-center'>{yahooLength}</td>
                                        <td className='text-center'>{flyerLength}</td>
                                    </tr>)
                                }
                                )}
                            </tbody>
                        </Table>
                    </div>
                </div>
            </div>
            <Modal show={show} onHide={modalClose} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title id="ranked-modal"></Modal.Title>
                </Modal.Header>
                <Modal.Body>


                </Modal.Body>
            </Modal>
        </div>
    )
}

export default CampaignReport
