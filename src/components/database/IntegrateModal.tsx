import React, { useState, useEffect, useContext } from 'react';
import Table from "react-bootstrap/Table";
import Modal from "react-bootstrap/Modal";
import { dateFormate } from '../list/listUtils';
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';
import { toHalfWidth } from './databaseUtils';

type CustomerList = Record<string, string>;

type Props = {
    integrate: Record<string, string>,
    setIntegrate: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    integrateList: Record<string, string>[],
    setIntegrateList: React.Dispatch<React.SetStateAction<Record<string, string>[]>>,
    setOriginalDatabase: React.Dispatch<React.SetStateAction<CustomerList[]>>
}

const IntegrateModal = ({ integrate, setIntegrate, integrateList, setIntegrateList, setOriginalDatabase }: Props) => {
    const allCustomers = integrate?.id ? [integrate, ...integrateList] : [];
    const { category } = useContext(AuthContext);

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSamePerson, setIsSamePerson] = useState<boolean | null>(null);
    const [mainCustomerId, setMainCustomerId] = useState<string | null>(null);
    const [selectedStaff, setSelectedStaff] = useState<string>('');

    useEffect(() => {
        if (!integrate?.id) {
            setSelectedIds([]);
            setIsSamePerson(null);
            setMainCustomerId(null);
            setSelectedStaff('');
        }
    }, [integrate?.id]);

    const handleClose = () => {
        setIntegrate({});
        setIntegrateList([]);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const newIds = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
            setIsSamePerson(null);
            setMainCustomerId(null);
            setSelectedStaff('');
            return newIds;
        });
    };

    const staffOptions = Array.from(new Set(allCustomers.filter(c => selectedIds.includes(c.id)).map(c => c.staff).filter(Boolean)));

    const showStep2 = selectedIds.length >= 2;
    const showStep3 = showStep2 && isSamePerson === true;
    const showStep4 = showStep3 && mainCustomerId !== null;

    const stepHeaderStyle = { backgroundColor: '#3b455b', color: 'white', fontWeight: 'bold', fontSize: '14px' };


    const handleIntegrate = (payload: { baseId: string, targetIds: string[], staff: string }) => {
        const { baseId, targetIds, staff } = payload;

        if (!baseId || targetIds.length === 0) {
            alert('名寄せデータが正しく選択されていません。');
            return;
        }

        // バックエンドに渡すデータ
        const postData = {
            request: 'integrate',
            category,
            base_id: baseId,
            integrate_ids: targetIds.join(','),
            staff: staff
        };

        const fetchData = async () => {
            try {
                const response = await apiClient.post("", postData);
                const customers = response.data.customer.map((c: any) => ({
                    ...c,
                    search_address: (c.full_address ?? '').replace(/[\s ]+/g, ""),
                    _cleanCustomer: (c.customer || '').replace(/[\s\u3000]+/g, '')
                }));

                setOriginalDatabase(customers);
                alert("名寄せ処理が完了しました。");
            } catch (error) {
                console.error("名寄せ処理中にエラーが発生しました", error);
                alert("通信エラーが発生しました。");
            }
        };

        fetchData();

        setIntegrate({});
        setIntegrateList([]);
    };

    return (
        <Modal show={!!integrate?.id} onHide={handleClose} size='xl'>
            <Modal.Header closeButton>
                <Modal.Title style={{ fontSize: '18px', fontWeight: 'bold' }}>重複顧客リスト</Modal.Title>
            </Modal.Header>
            <Modal.Body className="bg-light">

                <div className="bg-white border rounded p-3 mb-4 text-secondary" style={{ fontSize: '12px' }}>
                    <div className="d-flex">
                        <div className="fw-bold me-3 text-dark">ご注意</div>
                        <div>
                            下記顧客は重複の可能性があります。<br />
                            顧客情報を<span className='text-danger fw-bold'>名寄せする</span>、または<span className='text-danger fw-bold'>名寄せ候補から外す</span>ことができます。<br />
                            ※1. 「顧客名（漢字）・顧客名（カナ）・電話番号・メールアドレス」のいずれかが一致<br />
                            <span className="text-danger">※2. 顧客(買・売・借・貸・建・仮)以外の属性がある場合は名寄せできません。</span>
                        </div>
                    </div>
                </div>

                {/* ==================== Step 1 ==================== */}
                <div className="mb-4 shadow-sm">
                    <div className="p-2 rounded-top" style={stepHeaderStyle}>
                        Step1. 名寄せする顧客、もしくは名寄せ候補から外す顧客を全て選択してください。
                    </div>
                    <div className="bg-white rounded-bottom border border-top-0">
                        <Table style={{ fontSize: '12px', marginBottom: 0 }} responsive hover>
                            <thead className="bg-light align-middle">
                                <tr>
                                    <th className='text-center'>選択</th>
                                    <th>反響日</th>
                                    <th>顧客名</th>
                                    <th>住所</th>
                                    <th>メールアドレス</th>
                                    <th>電話番号</th>
                                    <th>担当</th>
                                    <th>反響元</th>
                                </tr>
                            </thead>
                            <tbody className='align-middle'>
                                {allCustomers.map((item) => (
                                    <tr key={item.id} className={selectedIds.includes(item.id) ? "table-primary" : ""}>
                                        <td className="text-center">
                                            <input
                                                type="checkbox"
                                                style={{ transform: "scale(1.5)" }}
                                                checked={selectedIds.includes(item.id)}
                                                onChange={() => toggleSelect(item.id)}
                                            />
                                        </td>
                                        <td>{dateFormate(item.register)}</td>
                                        <td>{item.customer}</td>
                                        <td>{item.full_address}</td>
                                        <td>{item.mail}{item.mail_2 && ` / ${item.mail_2}`}</td>
                                        <td>{toHalfWidth(item.phone_number)}{toHalfWidth(item.phone_number_2) && ` / ${toHalfWidth(item.phone_number_2)}`}</td>
                                        <td>{item.staff}</td>
                                        <td>{item.hp_campaign}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                </div>

                {/* ==================== Step 2 ==================== */}
                {showStep2 && (
                    <div className="mb-4 shadow-sm animate__animated animate__fadeIn">
                        <div className="p-2 rounded-top" style={stepHeaderStyle}>
                            Step2. これらの顧客は同一人物ですか？
                        </div>
                        <div className="bg-white rounded-bottom border border-top-0 p-4 d-flex justify-content-center gap-4">
                            <button
                                className={`btn ${isSamePerson === true ? 'btn-primary' : 'btn-outline-primary'} px-4 py-2 fw-bold`}
                                onClick={() => setIsSamePerson(true)}
                            >
                                <i className="fa-solid fa-user-check me-2"></i> 同一人物なので名寄せする
                            </button>
                            <button
                                className={`btn ${isSamePerson === false ? 'btn-secondary' : 'btn-outline-secondary'} px-4 py-2 fw-bold`}
                                onClick={() => {
                                    setIsSamePerson(false);
                                    // 候補から外す場合のAPI処理等をここに記述（今回は割愛）
                                }}
                            >
                                <i className="fa-solid fa-user-xmark me-2"></i> 同一人物ではないので名寄せ候補から外す
                            </button>
                        </div>
                    </div>
                )}

                {/* ==================== Step 3 ==================== */}
                {showStep3 && (
                    <div className="mb-4 shadow-sm animate__animated animate__fadeIn">
                        <div className="p-2 rounded-top" style={stepHeaderStyle}>
                            Step3. 「メイン」となる顧客を選択してください。
                        </div>
                        <div className="bg-white rounded-bottom border border-top-0">
                            <div className="bg-light border-bottom p-3 text-secondary" style={{ fontSize: '12px' }}>
                                <div className="d-flex">
                                    <div className="fw-bold me-3 text-dark">ご注意</div>
                                    <div>
                                        取り込まれる情報は「メール・案件・応対履歴・送信物件」です。<br />
                                        それ以外の情報はテキスト化して、「メイン」となる顧客の応対履歴に保存されます。<br />
                                        <span className="text-danger fw-bold">※メイン以外の顧客は、名寄せすると削除されます。</span>
                                    </div>
                                </div>
                            </div>
                            <Table style={{ fontSize: '12px', marginBottom: 0 }} responsive hover>
                                <thead className="bg-light align-middle">
                                    <tr>
                                        <th className='text-center'>メイン</th>
                                        <th>反響日</th>
                                        <th>顧客名</th>
                                        <th>住所</th>
                                        <th>メールアドレス</th>
                                        <th>電話番号</th>
                                        <th>担当</th>
                                        <th>反響元</th>
                                    </tr>
                                </thead>
                                <tbody className='align-middle'>
                                    {allCustomers.filter(c => selectedIds.includes(c.id)).map((item) => (
                                        <tr key={item.id} className={mainCustomerId === item.id ? "table-info" : ""}>
                                            <td className="text-center">
                                                <input
                                                    type="radio"
                                                    name="mainCustomer"
                                                    style={{ transform: "scale(1.5)" }}
                                                    checked={mainCustomerId === item.id}
                                                    onChange={() => setMainCustomerId(item.id)}
                                                />
                                            </td>
                                            <td>{dateFormate(item.register)}</td>
                                            <td>{item.customer}</td>
                                            <td>{item.full_address}</td>
                                            <td>{item.mail}{item.mail_2 && ` / ${item.mail_2}`}</td>
                                            <td>{toHalfWidth(item.phone_number)}{toHalfWidth(item.phone_number_2) && ` / ${toHalfWidth(item.phone_number_2)}`}</td>
                                            <td>{item.staff}</td>
                                            <td>{item.hp_campaign}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                )}

                {/* ==================== Step 4 ==================== */}
                {showStep4 && (
                    <div className="mb-4 shadow-sm animate__animated animate__fadeIn">
                        <div className="p-2 rounded-top" style={stepHeaderStyle}>
                            Step4. 「担当者」を選択して、「名寄せする」ボタンを押してください。
                        </div>
                        <div className="bg-white rounded-bottom border border-top-0 p-4 text-center">
                            <div className="d-flex justify-content-center align-items-center gap-3 mb-3">
                                <span className="fw-bold" style={{ fontSize: '14px' }}>担当者:</span>
                                <select
                                    className="form-select w-auto"
                                    value={selectedStaff}
                                    onChange={(e) => setSelectedStaff(e.target.value)}
                                >
                                    <option value="">担当者を選択してください</option>
                                    {staffOptions.map(staff => (
                                        <option key={staff} value={staff}>{staff}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                className="btn text-white px-5 py-2 fw-bold rounded-pill shadow-sm"
                                style={{ backgroundColor: '#e83e8c', fontSize: '16px', letterSpacing: '2px' }}
                                disabled={!selectedStaff}
                                onClick={() => {
                                    const targetIds = selectedIds.filter(id => id !== mainCustomerId);

                                    handleIntegrate({
                                        baseId: mainCustomerId as string,
                                        targetIds: targetIds,
                                        staff: selectedStaff
                                    });
                                }}
                            >
                                名寄せする
                            </button>
                        </div>
                    </div>
                )}
            </Modal.Body>
        </Modal>
    )
}

export default IntegrateModal;