import React, { useState, useEffect, useContext } from 'react'
import Table from "react-bootstrap/Table";
import axios from 'axios';
import { headers } from '../utils/headers';
import Modal from 'react-bootstrap/Modal';
import InformationEdit from './InformationEdit';
import AuthContext from '../context/AuthContext';

type Reasons = { id: string, value: string };
type Props = {
    cancelListShow: boolean,
    setCancelListShow: React.Dispatch<React.SetStateAction<boolean>>,
};
type Form = { brand: string, shop: string, age: string, mobile: string };
type Survey = { brand: string, annualIncome: string, emailAddress: string, totalBudget: string, expectedResidents: string, priorityItem: string, futurePlan: string, thingsToDo: string, housingType: string };
type MasterDataList = { id: string, customer: string, interview: string, mail: string, phone_number: string, reserved_interview: string, shop: string, staff: string, hp_campaign: string, medium: string, cancel_status: string, register: string };

const CancelList = ({ cancelListShow, setCancelListShow }: Props) => {
    const [total, setTotal] = useState(false);
    const [form, setForm] = useState<Form[]>([]);
    const [surveyList, setSurveyList] = useState<Survey[]>([]);
    const [masterDataList, setMasterDataList] = useState<MasterDataList[]>([]);
    const [reasons, setReasons] = useState({ id: '', value: '' });
    const [editId, setEditId] = useState('');
    const { token } = useContext(AuthContext);
    const { brand } = useContext(AuthContext);

    useEffect(() => {
        if (!cancelListShow) return;
        const fetchData = async () => {
            try {
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: 'cancelList' }, { headers });
                setForm(response.data.form);
                setSurveyList(response.data.survey);
                setMasterDataList(response.data.customer);
            } catch (e) {
                console.error(e);
                alert('データの取得に失敗');
            }
        };

        fetchData();
    }, [cancelListShow]);

    const formate = (value: string) => {
        return value ? value.replace(/-/g, '/') : '';
    };

    const dateFormate = (value: string) => {
        return value ? value.replace(/\//g, '-') : '';
    };

    const saveReason = async (idValue: string) => {
        if (!idValue) return;

        const reason = reasons[idValue];
        if (!reason) {
            alert('キャンセル理由を選択してください');
            return;
        }

        const postData = {
            id: idValue,
            cancel_status: reason,
            request: 'cancelList_edit_reason'
        }

        try {
            const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', postData, { headers });
            setMasterDataList(response.data.customer);
        } catch (e) {
            console.log(e);
        }

        setReasons({ id: '', value: '' });
    };

    const closeInformationEdit = async () => {
        setEditId('');
        const fetchData = async () => {
            const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: 'database_reload' }, { headers });
            await setMasterDataList(response.data.customer);
        }
        fetchData();
    };

    return (
        <>
            <Modal show={cancelListShow} onHide={() => setCancelListShow(false)} size='xl'>
                <Modal.Header closeButton>来場キャンセルリスト</Modal.Header>
                <Modal.Body>
                    <div className="d-flex justify-content-center mb-3" style={{ fontSize: '13px' }}>
                        <div className="bg-primary text-white px-3 py-1 rounded mx-2"
                            style={{ cursor: !total ? 'text' : 'pointer', opacity: !total ? '1' : '.5', transform: !total ? 'scale(1.1)' : 'scale(1)' }}
                            onClick={() => setTotal(false)}>キャンセル登録</div>
                        <div className="bg-info text-white px-3 py-1 rounded mx-2"
                            style={{ cursor: total ? 'text' : 'pointer', opacity: total ? '1' : '.5', transform: total ? 'scale(1.1)' : 'scale(1)' }}
                            onClick={() => setTotal(true)}>来場キャンセル顧客一覧</div>
                    </div>
                    {total ?
                        <Table bordered striped>
                            <tbody style={{ fontSize: '11px' }}>
                                <tr>
                                    <td>No</td>
                                    <td>店舗</td>
                                    <td>顧客名</td>
                                    <td>反響取得日</td>
                                    <td>流入経路</td>
                                    <td>販促媒体</td>
                                    <td>キャンセル理由</td>
                                    <td>年齢</td>
                                    <td>年収</td>
                                </tr>
                                {masterDataList.filter(item => {
                                    return item.cancel_status;
                                })
                                    .sort((a, b) => {
                                        return new Date(dateFormate(b.register)).getTime() - new Date(dateFormate(a.register)).getTime()
                                    })
                                    .map((item, index) => {
                                        const ageValue = form.find(f => f.mobile === item.phone_number)?.age;
                                        const targetMail = masterDataList.find(m => m.id === item.id)?.mail;
                                        const incomeValue = surveyList.find(s => s.emailAddress === targetMail)?.annualIncome;
                                        return <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td>{item.shop}</td>
                                            <td>{item.customer}</td>
                                            <td>{formate(item.register)}</td>
                                            <td>{item.hp_campaign}</td>
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
                                    <td>店舗</td>
                                    <td>担当営業</td>
                                    <td>顧客名</td>
                                    <td>来場予約日</td>
                                    <td>キャンセル理由</td>
                                    <td>編集</td>
                                </tr>
                                {masterDataList.filter(item => {
                                    const now = new Date();
                                    const today = now.getTime();
                                    const target = new Date(dateFormate(item.reserved_interview)).getTime();
                                    const start = new Date('2026-01-01');
                                    const base = start.getTime();
                                    return target < today && base < target && (!item.interview && !item.cancel_status);
                                })
                                    .sort((a, b) => {
                                        return new Date(dateFormate(b.reserved_interview)).getTime() - new Date(dateFormate(a.reserved_interview)).getTime()
                                    })
                                    .map((item, index) =>
                                        <tr key={item.id}>
                                            <td>{index + 1}</td>
                                            <td>{item.shop}</td>
                                            <td>{item.staff}</td>
                                            <td>{item.customer}</td>
                                            <td>{formate(item.reserved_interview)}</td>
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
                                                    setEditId(item.id);
                                                }}>編集</div></td>
                                        </tr>
                                    )}
                            </tbody>
                        </Table>}
                </Modal.Body>
            </Modal>
            <InformationEdit id={editId} token={token} onClose={closeInformationEdit} brand={brand} />
        </>
    )
}

export default CancelList;