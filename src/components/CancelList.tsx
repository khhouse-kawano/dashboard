import React, { useState, useEffect, useContext } from 'react'
import { Table, Modal, Button, Form, Badge, ButtonGroup } from "react-bootstrap";
import axios from 'axios';
import { headers } from '../utils/headers';
import InformationEdit from './information/InformationEdit';
import AuthContext from '../context/AuthContext';

type shopList = { brand: string, shop: string, section: string };
type Props = {
    cancelListShow: boolean,
    setCancelListShow: React.Dispatch<React.SetStateAction<boolean>>,
    onReload: () => void,
    shopArray: shopList[]
};
type FormType = { brand: string, shop: string, age: string, mobile: string };
type Survey = { brand: string, annualIncome: string, emailAddress: string, totalBudget: string, expectedResidents: string, priorityItem: string, futurePlan: string, thingsToDo: string, housingType: string };
type MasterDataList = Record<string, string>;

const CancelList = ({ cancelListShow, setCancelListShow, onReload, shopArray }: Props) => {
    const [total, setTotal] = useState(false);
    const [form, setForm] = useState<FormType[]>([]);
    const [surveyList, setSurveyList] = useState<Survey[]>([]);
    const [originalMasterDataList, setOriginalMasterDataList] = useState<MasterDataList[]>([]);
    const [masterDataList, setMasterDataList] = useState<MasterDataList[]>([]);
    const [reasons, setReasons] = useState<Record<string, string>>({});
    const [editId, setEditId] = useState('');
    const { token, brand } = useContext(AuthContext);
    const [targetShop, setTargetShop] = useState('');

    useEffect(() => {
        if (!cancelListShow) return;
        const fetchData = async () => {
            try {
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: 'cancelList' }, { headers });
                setForm(response.data.form);
                setSurveyList(response.data.survey);
                setOriginalMasterDataList(response.data.customer);
            } catch (e) {
                console.error(e);
                alert('データの取得に失敗');
            }
        };

        fetchData();
    }, [cancelListShow]);

    useEffect(() => {
        const filtered = originalMasterDataList.filter(o =>
            targetShop ? o.shop === targetShop : true
        );
        setMasterDataList(filtered);
    }, [targetShop, originalMasterDataList]);

    const formate = (value: string) => value ? value.replace(/-/g, '/') : '';
    const dateFormate = (value: string) => value ? value.replace(/\//g, '-') : '';

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

        setReasons(prev => {
            const newState = { ...prev };
            delete newState[idValue];
            return newState;
        });

        onReload();
    };

    const closeInformationEdit = async () => {
        setEditId('');
    };

    const brandMapping = {
        'KH': '',
        'DJH': '',
        'なごみ': '',
        '2L': '',
        'JH': '',
        'PGH': ''
    };

    return (
        <>
            <Modal show={cancelListShow} onHide={() => setCancelListShow(false)} size='xl'>
                {/* 💡 ヘッダーの余白(py-2)と文字サイズ(fs-6)をコンパクトに */}
                <Modal.Header closeButton className="bg-light py-2">
                    <Modal.Title className="fs-6 fw-bold text-secondary">
                        <i className="fa-solid fa-user-xmark me-2"></i>来場キャンセルリスト
                    </Modal.Title>
                </Modal.Header>

                {/* 💡 ボディ全体に 0.8rem (約80%) を適用し、余白を p-4 から p-3 に縮小 */}
                <Modal.Body className="p-3 bg-light" style={{ fontSize: '0.8rem' }}>

                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 gap-3">
                        <ButtonGroup className="shadow-sm">
                            <Button
                                variant={!total ? "primary" : "white"}
                                size="sm" // 💡 ボタンをスリム化
                                onClick={() => setTotal(false)}
                                className={!total ? "fw-bold" : "text-secondary border"}
                                style={{ width: '140px', fontSize: '0.8rem' }}
                            >
                                <i className="fa-solid fa-pen-to-square me-1"></i>キャンセル登録
                            </Button>
                            <Button
                                variant={total ? "primary" : "white"}
                                size="sm"
                                onClick={() => setTotal(true)}
                                className={total ? "fw-bold" : "text-secondary border"}
                                style={{ width: '140px', fontSize: '0.8rem' }}
                            >
                                <i className="fa-solid fa-list me-1"></i>顧客一覧
                            </Button>
                        </ButtonGroup>

                        <div style={{ width: '200px' }}>
                            <Form.Select
                                size="sm" // 💡 セレクトボックスもスリム化
                                value={targetShop}
                                onChange={(e) => setTargetShop(e.target.value)}
                                className="shadow-sm border-0"
                                style={{ fontSize: '0.8rem' }}
                            >
                                <option value="">全店舗を表示</option>
                                {shopArray.filter(s => !s.shop.includes('全店舗')).map((shop, index) =>
                                    <option value={shop.shop} key={index}>{shop.shop}</option>
                                )}
                            </Form.Select>
                        </div>
                    </div>

                    <div className="table-responsive shadow-sm rounded bg-white">
                        {total ? (
                            <Table hover className="align-middle mb-0 text-nowrap" style={{ fontSize: '0.8rem' }}>
                                <thead className="table-light text-secondary">
                                    <tr>
                                        <th className="fw-normal py-2">No</th>
                                        <th className="fw-normal py-2">店舗</th>
                                        <th className="fw-normal py-2">顧客名</th>
                                        <th className="fw-normal py-2">反響取得日</th>
                                        <th className="fw-normal py-2">流入経路</th>
                                        <th className="fw-normal py-2">販促媒体</th>
                                        <th className="fw-normal py-2">キャンセル理由</th>
                                        <th className="fw-normal py-2">年齢</th>
                                        <th className="fw-normal py-2">年収</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {masterDataList.filter(item => item.cancel_status)
                                        .sort((a, b) => new Date(dateFormate(b.register)).getTime() - new Date(dateFormate(a.register)).getTime())
                                        .map((item, index) => {
                                            const ageValue = form.find(f => f.mobile === item.phone_number)?.age;
                                            const targetMail = masterDataList.find(m => m.id === item.id)?.mail;
                                            const incomeValue = surveyList.find(s => s.emailAddress === targetMail)?.annualIncome;
                                            return (
                                                <tr key={index}>
                                                    <td className="py-2"><span className="text-muted">{index + 1}</span></td>
                                                    <td className="py-2"><Badge bg="secondary" className="fw-normal">{item.shop}</Badge></td>
                                                    <td className="py-2 fw-bold text-dark">{item.customer}</td>
                                                    <td className="py-2">{formate(item.register)}</td>
                                                    <td className="py-2 text-truncate" style={{ maxWidth: '120px' }}>{item.hp_campaign}</td>
                                                    <td className="py-2"><Badge bg="info" className="fw-normal text-dark">{item.medium}</Badge></td>
                                                    <td className="py-2"><Badge bg="danger" className="fw-normal">{item.cancel_status}</Badge></td>
                                                    <td className="py-2">{ageValue || '-'}</td>
                                                    <td className="py-2">{incomeValue || '-'}</td>
                                                </tr>
                                            )
                                        })}
                                </tbody>
                            </Table>
                        ) : (
                            <Table hover className="align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                                <thead className="table-light text-secondary text-nowrap">
                                    <tr>
                                        <th style={{ width: '4%' }} className="fw-normal py-2">No</th>
                                        <th style={{ width: '10%' }} className="fw-normal py-2">店舗</th>
                                        <th style={{ width: '10%' }} className="fw-normal py-2">担当営業</th>
                                        <th style={{ width: '14%' }} className="fw-normal py-2">顧客名</th>
                                        <th style={{ width: '12%' }} className="fw-normal py-2">来場予約日</th>
                                        <th style={{ width: '40%' }} className="fw-normal py-2">キャンセル理由</th>
                                        <th style={{ width: '10%' }} className="fw-normal text-center py-2">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {masterDataList.filter(item => {
                                        const now = new Date();
                                        const today = now.getTime();
                                        const target = new Date(dateFormate(item.reserved_interview)).getTime();
                                        const start = new Date('2026-01-01');
                                        const base = start.getTime();
                                        return target < today && base < target && (!item.interview && !item.cancel_status) && item.status !== '重複';
                                    })
                                        .sort((a, b) => new Date(dateFormate(b.reserved_interview)).getTime() - new Date(dateFormate(a.reserved_interview)).getTime())
                                        .map((item, index) => (
                                            <tr key={item.id}>
                                                <td className="py-2"><span className="text-muted">{index + 1}</span></td>
                                                <td className="py-2"><Badge bg="secondary" className="fw-normal">{item.shop}</Badge></td>
                                                <td className="py-2">{item.staff}</td>
                                                <td className="py-2 fw-bold text-dark">{item.customer}</td>
                                                <td className="py-2">{formate(item.reserved_interview)}</td>
                                                <td className="py-2">
                                                    <div className='d-flex align-items-center flex-wrap gap-2'>
                                                        {['0次面談でお断り', '怪我・病気', '急用', '他決', '計画中止', '不明'].map((r, rIndex) => (
                                                            <Form.Check
                                                                key={rIndex}
                                                                inline
                                                                type="radio"
                                                                id={`reason${item.id}-${rIndex}`}
                                                                name={`reason${item.id}`}
                                                                label={r}
                                                                value={r}
                                                                checked={reasons[item.id] === r}
                                                                onChange={() => setReasons(prev => ({ ...prev, [item.id]: r }))}
                                                                className="mb-0 text-nowrap"
                                                                // 💡 ラジオボタンの文字もさらにコンパクトに
                                                                style={{ fontSize: '0.75rem', cursor: 'pointer' }}
                                                            />
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-2">
                                                    <div className="d-flex gap-1 justify-content-center">
                                                        <Button
                                                            variant="primary"
                                                            size="sm"
                                                            className="px-2 shadow-sm"
                                                            onClick={() => saveReason(item.id)}
                                                            style={{ fontSize: '0.75rem' }}
                                                        >
                                                            登録
                                                        </Button>
                                                        <Button
                                                            variant="outline-secondary"
                                                            size="sm"
                                                            className="px-2 shadow-sm bg-white"
                                                            onClick={() => setEditId(item.id)}
                                                            style={{ fontSize: '0.75rem' }}
                                                        >
                                                            編集
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </Table>
                        )}
                    </div>
                </Modal.Body>
            </Modal>
            <InformationEdit id={editId} token={token} onClose={closeInformationEdit} brand={brand} />
        </>
    )
}

export default CancelList;