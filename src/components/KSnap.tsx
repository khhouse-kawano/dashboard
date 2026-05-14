import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import axios from 'axios';
import { headers } from '../utils/headers';
import Table from 'react-bootstrap/Table';

type Customer = Record<string, string>;
type Snap = Record<string, string>;
type Props = {
    id: string,
    setKSnap: React.Dispatch<React.SetStateAction<string>>
}

const KSnap = ({ id, setKSnap }: Props) => {
    const [customerData, setCustomerData] = useState<Customer>({});
    const [snaps, setSnaps] = useState<Snap[]>([]);
    const safeFormate = (value: string) => {
        try {
            return value ? value.split(',') : [];
        } catch (err) {
            return [];
        }
    };

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: "kSnap", id: id }, { headers });
            setCustomerData(response.data.customer);
            setSnaps(response.data.snap);
        };
        fetchData();
    }, [id]);

    useEffect(() => {
        console.log(customerData)
    }, [customerData]);

    const imgStyle = {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const
    };
    return (
        <>
            <Modal show={!!id} onHide={() => setKSnap('')} size='lg'>
                <Modal.Header closeButton></Modal.Header>
                <Modal.Body>
                    <Table>
                        <tbody style={{ fontSize: '12px' }}>
                            <tr>
                                <td style={{ width: '150px' }}>お気に入り登録</td>
                                <td>
                                    <div className="d-flex flex-wrap">
                                        {safeFormate(customerData.bookmark).map((item, index) => {
                                            const imgValue = snaps.find(s => String(s.id) === item)?.image;
                                            return <div key={index} className='m-2'
                                                style={{ height: '100px', width: '100px' }}><img src={`https://khg-marketing.info/k-snap/images/${imgValue}`} style={imgStyle} /></div>
                                        }
                                        )}</div>
                                </td>
                            </tr>
                            <tr>
                                <td>検索タグ</td>
                                <td>
                                    <div className="d-flex flex-wrap">
                                        {safeFormate(customerData.tag).map((item, index) => {
                                            return <div key={index} className='me-2 bg-warning px-2 rounded py-1 mb-1'
                                            >{item}</div>
                                        }
                                        )}</div>
                                </td>
                            </tr>
                            <tr>
                                <td>閲覧済み</td>
                                <td>
                                    <div className="d-flex flex-wrap">
                                        {safeFormate(customerData.path).map((item, index) => {
                                            const imgValue = snaps.find(s => String(s.id) === item)?.image;
                                            return <div key={index} className='m-2'
                                                style={{ height: '100px', width: '100px' }}><img src={`https://khg-marketing.info/k-snap/images/${imgValue}`} style={imgStyle} /></div>
                                        }
                                        )}</div>
                                </td>
                            </tr>
                        </tbody>
                    </Table>
                </Modal.Body>
            </Modal>
        </>
    )
}

export default KSnap