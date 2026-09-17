import React, { useState, useEffect, useContext } from 'react'
import { Table, Modal, Button, Form, Badge, ButtonGroup } from "react-bootstrap";
import apiClient from '../utils/apiClient';
import InformationEdit from './information/InformationEdit';
import AuthContext from '../context/AuthContext';
import {
    LOST_DETAIL_KEY, LOST_REASON_KEY, LOST_REASON_OPTIONS, LOST_TO_COMPETITOR,
    missingLostFields,
} from '../utils/informationUtils';

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
    const { token, authority } = useContext(AuthContext);
    const [targetShop, setTargetShop] = useState('');
    const [targetReason, setTargetReason] = useState('');

    useEffect(() => {
        if (!loseListShow) return;
        const fetchData = async () => {
            try {
                /**
                 * ⚠️⚠️ **`apiClient` を使う。URL を直接書かない。**
                 *   ⚠️ 以前は本番のURLが直書きで、**Token を送っていなかった**
                 *     （`headers` は Authorization だけ）。
                 *   ⚠️ `apiClient` なら Token が自動で付き、② 側の認証が効く。
                 */
                const response = await apiClient.post('', { request: 'lostList' });
                const filteredLoseLength = response.data.customer.filter(item => {
                    const now = new Date();
                    const today = now.getTime();
                    const target = new Date(dateFormate(item.register)).getTime();
                    const start = new Date('2026-06-01');
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
                && targetReason ? o[LOST_REASON_KEY] === targetReason : true
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
                                {/**
                                  * ⚠️⚠️ **選択肢は informationUtils と共有する**（2026-09-17）。
                                  *   ⚠️ 以前はここに手書きされており、**`音信普通`** という
                                  *     ⚠️ **誤字**だった（正しくは `音信不通`。実データ117件）。
                                  *   ⚠️ そのため**この理由で絞ると必ず0件**になっていた。
                                  */}
                                {LOST_REASON_OPTIONS.map(reason =>
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
                                        /**
                                         * ⚠️⚠️ **こちらは「入力が済んだ顧客」の一覧である。**
                                         *   ⚠️ 未入力が1つも無いものだけを出す。
                                         *
                                         * ⚠️⚠️ **2026-09-17 に判定を `missingLostFields()` へ集約した。**
                                         *   ⚠️ 以前はここに条件が写されており、しかも
                                         *     `… !== 'null' || String(…).trim() === ''` と
                                         *     ⚠️ **「空なら入力済み」と読める向きになっていた**（`||` の向きが逆）。
                                         *   ⚠️ そのため**敗因が空の顧客がこちらに出ていた。**
                                         */
                                        return target < today && base < target && item.status === '失注' && missingLostFields(item).length === 0 && Number(item.trash) === 1;
                                    }).sort((a, b) => new Date(dateFormate(b.register)).getTime() - new Date(dateFormate(a.register)).getTime())
                                        .map((item, index) => {
                                            return (
                                                <tr key={index}>
                                                    <td className="py-2"><span className="text-muted">{index + 1}</span></td>
                                                    <td className="py-2"><Badge bg="secondary" className="fw-normal">{item.shop}</Badge></td>
                                                    <td className="py-2 fw-bold text-dark">{item.customer}</td>
                                                    <td className="py-2">{formate(item.register)}</td>
                                                    <td className="py-2 text-truncate" style={{ maxWidth: '120px' }}><Badge bg={`${item[LOST_REASON_KEY] === LOST_TO_COMPETITOR ? 'warning' : 'info'}`} className="fw-normal text-dark">{item[LOST_REASON_KEY] || '-'}</Badge></td>
                                                    <td className="py-2">{item.competitor_name ? <Badge bg="secondary" className="fw-normal text-white">{item.competitor_name}</Badge> : '-'}</td>
                                                    {/* ⚠️ 列名は informationUtils の定数を使う。⚠️ ULID を直書きしない */}
                                                    <td className="py-2">{(item[LOST_DETAIL_KEY] ?? '').split(',').filter(Boolean).map(reason => <Badge bg="danger" className="text-white fw-normal text-dark me-2" key={reason}>{reason}</Badge>)}</td>
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
                                        // ⚠️ こちらは「未入力が1つでもある顧客」の一覧（上の裏返し）
                                        return target < today && base < target && item.status === '失注' && missingLostFields(item).length > 0 && Number(item.trash) === 1;
                                    })
                                        .sort((a, b) => new Date(dateFormate(b.reserved_interview)).getTime() - new Date(dateFormate(a.reserved_interview)).getTime())
                                        .map((item, index) => {
                                            /**
                                             * ⚠️⚠️ **未入力の項目名をそのまま並べる**（2026-09-17）。
                                             *   ⚠️ 以前は3種類を手書きしており、
                                             *     ⚠️ **項目を足しても表示が増えなかった。**
                                             *   ⚠️ ここに項目名を書き足さないこと。
                                             *     ⚠️ 増やすのは `missingLostFields()` の側である。
                                             */
                                            const missing = missingLostFields(item);

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
                                                        {/* ⚠️ 項目が6つに増えたので横にも折り返す。
                                                               ⚠️ 縦一列のままだと1行がとても高くなる */}
                                                        <div className="d-flex flex-wrap gap-2">
                                                            {missing.map(label => (
                                                                <div className="text-danger fw-bold" style={{ fontSize: '11px' }} key={label}>
                                                                    <i className="fa-solid fa-triangle-exclamation me-1"></i>
                                                                    {label}未入力
                                                                </div>
                                                            ))}
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
            <InformationEdit id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
        </>
    )
}

export default LostStatusList;