import React from 'react';
import Table from "react-bootstrap/Table";
import Modal from 'react-bootstrap/Modal';
import { CustomerName } from '../../utils/deletedCustomer';
import { CUSTOMER_CATEGORY } from './companyAggregate';

type Customer = Record<string, string>;

type Props = {
    show: boolean,
    setShow: React.Dispatch<React.SetStateAction<boolean>>,
    contract: Customer[],
    setEditId: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    /** ログイン中の事業（order / spec / used / realty） */
    category: string
};

const idMapping: Record<string, string> = {
    '注文': 'order',
    '建売': 'kaeru',
    '中専': 'resale'
};

const CustomerDetail = ({ show, setShow, contract, setEditId, category }: Props) => {
    const modalClose = async () => {
        setShow(false);
    };
    const categoryValue = contract[0]?.category ?? '';
    return (
        <>
            <Modal show={show} onHide={modalClose}>
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '12px' }}>顧客詳細</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Table bordered striped>
                        <tbody style={{ fontSize: '12px' }}>
                            <tr>
                                <td>契約日</td>
                                <td>お客様名</td>
                                <td>{categoryValue === '中専' ? '担当営業' : '担当店舗'}</td>
                                <td>{categoryValue === '中専' ? '粗利額' : '担当営業'}</td>
                            </tr>
                            {contract.map((c, index) => {
                                const contractDate = categoryValue === '中専' ? (c.contract_reform || c.contract_buy || c.contract_sell || '-')
                                    : c.contract || c.contract_broker || '-';
                                return <tr key={index}>
                                    <td>{contractDate}</td>
                                    {/* v2.2.229: 削除済みの顧客は「削除済み顧客」で押せない */}
                                    <td><CustomerName row={c} onClick={() => {
                                        // ⚠️ v2.2.264: ほかの事業の顧客は開かない（2026-11-11 の指示。ログイン中の事業と、顧客の事業が違うとき）
                                        //   ⚠️ 見た目の入口。編集画面のデータの権限は、それぞれの画面と ② が確かめる
                                        if (CUSTOMER_CATEGORY[c.category] !== category) {
                                            alert('閲覧権限がありません');
                                            return;
                                        }
                                        setEditId(prev => ({
                                            ...prev,
                                            [idMapping[c.category]]: c.id
                                        }));
                                    }}>{c.customer} 様</CustomerName>
                                        {c.contract_broker && <span className='bg-success text-white rounded px-1 ms-1' style={{fontSize: '9px'}}>仲介</span>}</td>
                                    <td>{categoryValue === '中専' ? c.staff || '-' : c.shop}</td>
                                    <td>{categoryValue === '中専' ? `${c.contraction_contract_price || '-'}万円` : c.staff}</td>
                                </tr>
                            }
                            )}
                        </tbody>
                    </Table>
                </Modal.Body>
            </Modal></>
    )
}

export default CustomerDetail
