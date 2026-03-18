import React, { useState, useEffect } from 'react'
import Table from "react-bootstrap/Table";
import axios from 'axios';
import { headers } from '../utils/headers';

type customerList = { id: string; shop: string; name: string; staff: string; status: string; rank: string; medium: string; reserve: string; register: string; before_survey: number; before_interview: number; after_interview: number; call_status: string, reserved_status: string, full_address: string; phone_number: string; trash: number, section: string, cancel_status: string, campaign: string };
type Reasons = { id: string, value: string };
type Props = {
    originalDatabase: customerList[];
    saveReason: (idValue: string) => void;
    reasons: Reasons;
    setReasons: React.Dispatch<React.SetStateAction<Reasons>>;
    setModalCategory: React.Dispatch<React.SetStateAction<string>>;
    showModal: (idValue: string, request: string, name: string, shop: string) => void;
};
type Form = { brand: string, shop: string, age: string, mobile: string };
type Survey = { brand: string, annualIncome: string, emailAddress: string, totalBudget: string, expectedResidents: string, priorityItem: string, futurePlan: string, thingsToDo: string, housingType: string };
type MasterDataList = { id: string, brand: string, mail: string, reserve: string, contract: string };
const CancelList = ({ originalDatabase, saveReason, reasons, setReasons, setModalCategory, showModal }: Props) => {
    const [total, setTotal] = useState(false);
    const [cancelCustomers, setCancelCustomers] = useState<customerList[]>([]);
    const [form, setForm] = useState<Form[]>([]);
    const [surveyList, setSurveyList] = useState<Survey[]>([]);
    const [masterDataList, setMasterDataList] = useState<MasterDataList[]>([]);

    useEffect(() => {
        if (!total) return;
        const fetchData = async () => {
            try {
                const [registerRes, surveyRes, masterRes] = await Promise.all([
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "register_form" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "show_survey_list" }, { headers }),
                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "master_data_list" }, { headers }),
                ]);

                setForm(registerRes.data);
                setSurveyList(surveyRes.data);
                setMasterDataList(masterRes.data);
            } catch (e) {
                console.error(e);
                alert('データの取得に失敗');
            }
        };

        fetchData();
        const filtered = originalDatabase.filter(o => o.cancel_status);
        setCancelCustomers(filtered);
    }, [total]);

    return (
        <>
            <div className="bg-primary text-white px-4 py-1 rounded-pill mb-3" style={{ fontSize: '12px', width: 'fit-content', cursor: 'pointer' }}
                onClick={() => setTotal(!total)}>{total ? 'キャンセル登録' : 'キャンセル集計'}</div>
            {total ?
                <Table bordered striped>
                    <tbody style={{ fontSize: '11px' }}>
                        <tr>
                            <td>No</td>
                            <td>店舗</td>
                            <td>反響取得日</td>
                            <td>流入経路</td>
                            <td>販促媒体</td>
                            <td>キャンセル理由</td>
                            <td>年齢</td>
                            <td>年収</td>
                        </tr>
                        {cancelCustomers.map((item, index) => {
                            const ageValue = form.find(f => f.mobile === item.phone_number)?.age;
                            const targetMail = masterDataList.find(m => m.id === item.id)?.mail;
                            const incomeValue = surveyList.find(s=>s.emailAddress === targetMail)?.annualIncome;
                            return <tr key={index}>
                                <td>{index + 1}</td>
                                <td>{item.shop}</td>
                                <td>{item.register}</td>
                                <td>{item.campaign}</td>
                                <td>{item.medium}</td>
                                <td>{item.cancel_status}</td>
                                <td>{ageValue}</td>
                                <td>{incomeValue}</td>
                            </tr>
                        })}
                    </tbody>
                </Table>
                : <Table bordered striped>
                    <tbody style={{ fontSize: '11px' }}>
                        <tr>
                            <td>No</td>
                            <td>課</td>
                            <td>店舗</td>
                            <td>担当営業</td>
                            <td>顧客名</td>
                            <td>来場予約日</td>
                            <td>キャンセル理由</td>
                            <td>編集</td>
                        </tr>
                        {originalDatabase.filter(item => {
                            const now = new Date();
                            const today = now.getTime();
                            const target = new Date(item.reserved_status).getTime();
                            const start = new Date('2026-01-01');
                            const base = start.getTime();
                            return target < today && base < target && (!item.reserve && !item.cancel_status);
                        }).map((item, index) =>
                            <tr key={item.id}>
                                <td>{index + 1}</td>
                                <td>{item.section}</td>
                                <td>{item.shop}</td>
                                <td>{item.staff}</td>
                                <td>{item.name}</td>
                                <td>{item.reserved_status}</td>
                                <td>
                                    <div className='d-flex align-items-center justify-content-around'>
                                        {['0次面談でお断り', '怪我・病気', '急用', '他決', '計画中止', '不明'].map((r, rIndex) =>
                                            <div className='d-flex align-items-center me-2' key={rIndex}>
                                                <input
                                                    type='radio'
                                                    id={`reason${item.id}-${rIndex}`}
                                                    name={`reason${item.id}`}
                                                    value={r}
                                                    checked={reasons[item.id] === r}
                                                    onChange={() =>
                                                        setReasons(prev => ({ ...prev, [item.id]: r }))
                                                    }
                                                />
                                                <label htmlFor={`reason${item.id}-${rIndex}`}>{r}</label>
                                            </div>
                                        )}
                                        <div
                                            className="text-white bg-primary rounded py-1 px-2"
                                            style={{ fontSize: '12px', cursor: 'pointer' }}
                                            onClick={() => saveReason(item.id)}
                                        >
                                            登録
                                        </div>
                                    </div>
                                </td>
                                <td><div className="text-white bg-danger rounded py-1 px-2 text-center" style={{ fontSize: '12px', cursor: 'pointer' }}
                                    onClick={() => {
                                        setModalCategory('database');
                                        showModal(item.id, 'information_edit', '', '');
                                    }}>編集</div></td>
                            </tr>
                        )}
                    </tbody>
                </Table>}</>
    )
}

export default CancelList;