import React from 'react';
import Table from "react-bootstrap/Table";
import Modal from 'react-bootstrap/Modal';

type Customer = Record<string, string>;

type Props = {
    show: boolean,
    setShow: React.Dispatch<React.SetStateAction<boolean>>,
    contract: Customer[],
    setEditId: React.Dispatch<React.SetStateAction<Record<string, string>>>
};

const CustomerDetail = ({ show, setShow, contract, setEditId }: Props) => {
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
                                const idMapping = {
                                    '注文': 'order',
                                    '建売': 'kaeru',
                                    '中専': 'resale'
                                };
                                const contractDate = categoryValue === '中専' ? (c.contract_reform || c.contract_buy || c.contract_sell || '-')
                                    : c.contract || '-';
                                return <tr key={index}>
                                    <td>{contractDate}</td>
                                    <td><span onClick={() => {
                                        setEditId(prev => ({
                                            ...prev,
                                            [idMapping[c.category]]: c.id
                                        }));
                                    }
                                    }
                                        style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}>{c.customer} 様</span></td>
                                    <td>{categoryValue === '中専' ? `${c.contraction_contract_price}万円` : c.shop}</td>
                                    <td>{c.staff}</td>
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