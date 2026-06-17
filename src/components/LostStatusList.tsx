import React, { useState, useEffect, useContext } from 'react'
import { Table, Modal, Button, Form, Badge, ButtonGroup } from "react-bootstrap";
import axios from 'axios';
import { headers } from '../utils/headers';
import InformationEdit from './information/InformationEdit';
import AuthContext from '../context/AuthContext';

type shopList = { brand: string, shop: string, section: string };
type Props = {
    loseListShow: boolean,
    setLoseListShow: React.Dispatch<React.SetStateAction<boolean>>,
    onReload: () => void,
    shopArray: shopList[]
};
type FormType = { brand: string, shop: string, age: string, mobile: string };
type Survey = { brand: string, annualIncome: string, emailAddress: string, totalBudget: string, expectedResidents: string, priorityItem: string, futurePlan: string, thingsToDo: string, housingType: string };
type MasterDataList = Record<string, string>;

const LostStatusList = ({ loseListShow, setLoseListShow, onReload, shopArray }: Props) => {
    const [total, setTotal] = useState(false);
    const [originalMasterDataList, setOriginalMasterDataList] = useState<MasterDataList[]>([]);
    const [masterDataList, setMasterDataList] = useState<MasterDataList[]>([]);

    const [editId, setEditId] = useState('');
    const { token, brand } = useContext(AuthContext);
    const [targetShop, setTargetShop] = useState('');
    const [targetReason, setTargetReason] = useState('');

    useEffect(() => {
        if (!loseListShow) return;
        const fetchData = async () => {
            try {
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: 'lostList' }, { headers });
                const filteredLoseLength = response.data.customer.filter(item => {
                    const now = new Date();
                    const today = now.getTime();
                    const target = new Date(dateFormate(item.register)).getTime();
                    const start = new Date('2026-01-01');
                    const base = start.getTime();
                    return item.status === '失注' && target < today && base < target
                });
                setOriginalMasterDataList(filteredLoseLength);
            } catch (e) {
                console.error(e);
                alert('データの取得に失敗');
            }
        };

        fetchData();
    }, [loseListShow]);

    useEffect(() => {
        const filtered = originalMasterDataList.filter(o =>
            targetShop ? o.shop === targetShop : true
                && targetReason ? o.competitor_lost_contract_reason === targetReason : true
        );
        setMasterDataList(filtered);
    }, [targetShop, originalMasterDataList, targetReason]);

    const formate = (value: string) => value ? value.replace(/-/g, '/') : '';
    const dateFormate = (value: string) => value ? value.replace(/\//g, '-') : '';

    const closeInformationEdit = async () => {
        setEditId('');
        onReload();
    };

    return (
        <>
            <Modal show={loseListShow} onHide={() => setLoseListShow(false)} size='xl'>
                <Modal.Header closeButton className="bg-light py-2">
                    <Modal.Title className="fs-6 fw-bold text-secondary">
                        <i className="fa-solid fa-folder-minus me-2"></i>失注リスト
                    </Modal.Title>
                </Modal.Header>

                <Modal.Body className="p-3 bg-light" style={{ fontSize: '0.8rem' }}>

                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-3 gap-3">
                        <ButtonGroup className="shadow-sm">
                            <Button
                                variant={!total ? "primary" : "white"}
                                size="sm"
                                onClick={() => setTotal(false)}
                                className={!total ? "fw-bold" : "text-secondary border"}
                                style={{ width: '140px', fontSize: '0.8rem' }}
                            >
                                <i className="fa-solid fa-pen-to-square me-1"></i>失注登録
                            </Button>
                            <Button
                                variant={total ? "primary" : "white"}
                                size="sm"
                                onClick={() => setTotal(true)}
                                className={total ? "fw-bold" : "text-secondary border"}
                                style={{ width: '140px', fontSize: '0.8rem' }}
                            >
                                <i className="fa-solid fa-list me-1"></i>失注顧客一覧
                            </Button>
                        </ButtonGroup>

                        <ButtonGroup className="shadow-sm">
                            <Form.Select
                                size="sm"
                                value={targetShop}
                                onChange={(e) => setTargetShop(e.target.value)}
                                className="shadow-sm border-0 me-2"
                                style={{ fontSize: '0.8rem' }}
                            >
                                <option value="">全店舗を表示</option>
                                {shopArray.filter(s => !s.shop.includes('全店舗')).map((shop, index) =>
                                    <option value={shop.shop} key={index}>{shop.shop}</option>
                                )}
                            </Form.Select>
                            <Form.Select
                                size="sm"
                                value={targetReason}
                                onChange={(e) => setTargetReason(e.target.value)}
                                className="shadow-sm border-0"
                                style={{ fontSize: '0.8rem' }}
                            >
                                <option value="">失注理由を選択</option>
                                {['計画中止', '競合負け', '身内の反対', '音信普通', '建築エリア外', 'その他'].map(reason =>
                                    <option value={reason} key={reason}>{reason}</option>
                                )}
                            </Form.Select>
                        </ButtonGroup>


                    </div>

                    <div className="table-responsive shadow-sm rounded bg-white">
                        {total ? (
                            <Table hover className="align-middle mb-0 text-nowrap" style={{ fontSize: '0.8rem' }}>
                                <thead className="table-light text-secondary">
                                    <tr>
                                        <th style={{ width: '5%' }} className="fw-normal py-2">No</th>
                                        <th style={{ width: '10%' }} className="fw-normal py-2">店舗</th>
                                        <th style={{ width: '15%' }} className="fw-normal py-2">顧客名</th>
                                        <th style={{ width: '10%' }} className="fw-normal py-2">反響取得日</th>
                                        <th style={{ width: '10%' }} className="fw-normal py-2">失注理由</th>
                                        <th style={{ width: '10%' }} className="fw-normal py-2">失注先</th>
                                        <th className="fw-normal py-2">他決理由</th>
                                        <th style={{ width: '5%' }} className="fw-normal py-2">詳細</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {masterDataList.filter(item => {
                                        const now = new Date();
                                        const today = now.getTime();
                                        const target = new Date(dateFormate(item.register)).getTime();
                                        const start = new Date('2026-01-01');
                                        const base = start.getTime();
                                        const isReason = item.competitor_lost_contract_reason && item.competitor_lost_contract_reason !== 'null';
                                        const isCompetitor = item.competitor_lost_contract_reason === '競合負け' ? (item.competitor_name && item.competitor_name !== 'null') : true;
                                        const isDetail = item.competitor_lost_contract_reason === '競合負け' ?
                                            (
                                                item.customized_input_01JRF9CZSW65A151WR30NA4PB3 && item.customized_input_01JRF9CZSW65A151WR30NA4PB3 !== 'null' ||
                                                item.customized_input_01JSE7H4MQES619NBWX6PQDFRH && item.customized_input_01JSE7H4MQES619NBWX6PQDFRH !== 'null' || String(item.customized_input_01JSE7H4MQES619NBWX6PQDFRH).trim() === ''
                                            ) : true;
                                        return target < today && base < target && item.status === '失注' && isReason && isCompetitor && isDetail && Number(item.trash) === 1;
                                    }).sort((a, b) => new Date(dateFormate(b.register)).getTime() - new Date(dateFormate(a.register)).getTime())
                                        .map((item, index) => {
                                            return (
                                                <tr key={index}>
                                                    <td className="py-2"><span className="text-muted">{index + 1}</span></td>
                                                    <td className="py-2"><Badge bg="secondary" className="fw-normal">{item.shop}</Badge></td>
                                                    <td className="py-2 fw-bold text-dark">{item.customer}</td>
                                                    <td className="py-2">{formate(item.register)}</td>
                                                    <td className="py-2 text-truncate" style={{ maxWidth: '120px' }}><Badge bg={`${item.competitor_lost_contract_reason === '競合負け' ? 'warning' : 'info'}`} className="fw-normal text-dark">{item.competitor_lost_contract_reason || '-'}</Badge></td>
                                                    <td className="py-2">{item.competitor_name ? <Badge bg="secondary" className="fw-normal text-white">{item.competitor_name}</Badge> : '-'}</td>
                                                    <td className="py-2">{item.customized_input_01JRF9CZSW65A151WR30NA4PB3.split(',').map(item => <Badge bg="danger" className="text-white fw-normal text-dark me-2" key={item}>{item}</Badge>) || '-'}</td>
                                                    <td className="py-2">
                                                        <div className="d-flex justify-content-center">
                                                            <Button
                                                                variant="outline-primary"
                                                                size="sm"
                                                                className="px-4 shadow-sm bg-white fw-bold"
                                                                onClick={() => setEditId(item.id)}
                                                                style={{ fontSize: '0.75rem' }}
                                                            >
                                                                詳細
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                </tbody>
                            </Table>
                        ) : (
                            <Table hover className="align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                                <thead className="table-light text-secondary text-nowrap">
                                    <tr>
                                        <th style={{ width: '5%' }} className="fw-normal py-2">No</th>
                                        <th style={{ width: '15%' }} className="fw-normal py-2">店舗</th>
                                        <th style={{ width: '20%' }} className="fw-normal py-2">担当営業</th>
                                        <th style={{ width: '20%' }} className="fw-normal py-2">顧客名</th>
                                        <th style={{ width: '10%' }} className="fw-normal py-2">ステータス</th>
                                        <th>未入力箇所</th>
                                        <th style={{ width: '15%' }} className="fw-normal text-center py-2">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {masterDataList.filter(item => {
                                        const now = new Date();
                                        const today = now.getTime();
                                        const target = new Date(dateFormate(item.register)).getTime();
                                        const start = new Date('2026-01-01');
                                        const base = start.getTime();
                                        const isReasonMissing = !item.competitor_lost_contract_reason || item.competitor_lost_contract_reason === 'null';
                                        const isCompetitorMissing = item.competitor_lost_contract_reason === '競合負け' && (!item.competitor_name || item.competitor_name === 'null');
                                        const isDetailMissing = item.competitor_lost_contract_reason === '競合負け' &&
                                            (
                                                !item.customized_input_01JRF9CZSW65A151WR30NA4PB3 || item.customized_input_01JRF9CZSW65A151WR30NA4PB3 === 'null' ||
                                                !item.customized_input_01JSE7H4MQES619NBWX6PQDFRH || item.customized_input_01JSE7H4MQES619NBWX6PQDFRH === 'null' || String(item.customized_input_01JSE7H4MQES619NBWX6PQDFRH).trim() === ''
                                            );

                                        return target < today && base < target && item.status === '失注' && (isReasonMissing || isCompetitorMissing || isDetailMissing) && Number(item.trash) === 1;
                                    })
                                        .sort((a, b) => new Date(dateFormate(b.reserved_interview)).getTime() - new Date(dateFormate(a.reserved_interview)).getTime())
                                        .map((item, index) => {
                                            const isReasonEmpty = !item.competitor_lost_contract_reason || item.competitor_lost_contract_reason === 'null';
                                            const isCompetitorEmpty = item.competitor_lost_contract_reason === '競合負け' && (!item.competitor_name || item.competitor_name === 'null');

                                            const isDetailEmpty = item.competitor_lost_contract_reason === '競合負け' &&
                                                (
                                                    !item.customized_input_01JRF9CZSW65A151WR30NA4PB3 || item.customized_input_01JRF9CZSW65A151WR30NA4PB3 === 'null' ||
                                                    !item.customized_input_01JSE7H4MQES619NBWX6PQDFRH || item.customized_input_01JSE7H4MQES619NBWX6PQDFRH === 'null' || String(item.customized_input_01JSE7H4MQES619NBWX6PQDFRH).trim() === ''
                                                );

                                            return (
                                                <tr key={item.id}>
                                                    <td className="py-2"><span className="text-muted">{index + 1}</span></td>
                                                    <td className="py-2"><Badge bg="secondary" className="fw-normal">{item.shop}</Badge></td>
                                                    <td className="py-2">{item.staff}</td>
                                                    <td className="py-2 fw-bold text-dark">{item.customer}</td>
                                                    <td className="py-2">
                                                        <Badge bg="info" className="fw-normal text-dark px-3 py-1">
                                                            {item.status || '未設定'}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-2">
                                                        <div className="d-flex flex-column gap-1">
                                                            {isReasonEmpty && (
                                                                <div className="text-danger fw-bold" style={{ fontSize: '11px' }}>
                                                                    <i className="fa-solid fa-triangle-exclamation me-1"></i>
                                                                    失注理由未入力
                                                                </div>
                                                            )}
                                                            {isCompetitorEmpty && (
                                                                <div className="text-danger fw-bold" style={{ fontSize: '11px' }}>
                                                                    <i className="fa-solid fa-triangle-exclamation me-1"></i>
                                                                    失注先未入力
                                                                </div>
                                                            )}
                                                            {isDetailEmpty && (
                                                                <div className="text-danger fw-bold" style={{ fontSize: '11px' }}>
                                                                    <i className="fa-solid fa-triangle-exclamation me-1"></i>
                                                                    他決理由未入力
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2">
                                                        <div className="d-flex justify-content-center">
                                                            <Button
                                                                variant="outline-primary"
                                                                size="sm"
                                                                className="px-4 shadow-sm bg-white fw-bold"
                                                                onClick={() => setEditId(item.id)}
                                                                style={{ fontSize: '0.75rem' }}
                                                            >
                                                                編集
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
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

export default LostStatusList;