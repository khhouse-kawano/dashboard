import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import AuthContext from "../context/AuthContext";
import Table from "react-bootstrap/Table";
import MenuDev from "./MenuDev";
import Rating from "@mui/material/Rating";
import Modal from 'react-bootstrap/Modal';

type Review = { id: string, shop: string, amount: number, average: number, url: string, recently_review: string };
type Recently = { rating: number, date: string, text: string, name: string, flag: string };
const ShopReview = () => {
    const { brand } = useContext(AuthContext);
    const [review, setReview] = useState<Review[]>([]);
    const [show, setShow] = useState(false);
    const [modalContent, setModalContent] = useState<Recently[]>([]);
    const [sortKey, setSortKey] = useState<string>('');
    const [sortOrder, setSortOrder] = useState<string>('');
    const navigate = useNavigate();
    useEffect(() => {
        // if (!brand || brand.trim() === "") {
        //     navigate("/");
        //     return;
        // }
        const fetchData = async () => {
            try {
                const headers = {
                    Authorization: "4081Kokubu",
                    "Content-Type": "application/json",
                };
                const reviewResponse = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_review" }, { headers });
                setReview(reviewResponse.data);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };

        fetchData();
    }, []);

    const modalShow = async (recently_review: string) => {
        await setModalContent(JSON.parse(recently_review));
        await setShow(true);
    };

    const modalClose = () => {
        setShow(false);
    };

    const changeSort = (order: string, key: string) => {
        setSortKey(key);
        setSortOrder(order)
    };

    return (
        <div className='outer-container'>
            <div className="d-flex">
                <div className='modal_menu' style={{ width: '20%' }}><MenuDev brand={brand} /></div>
                <div className='content customer bg-white p-2'>
                    <div className="table-wrapper">
                        <div className="list_table">
                            <div className='ps-2' style={{ fontSize: '13px' }}>※2025年12月より集計開始。</div>
                            <Table striped>
                                <tbody style={{ fontSize: '12px' }}>
                                    <tr>
                                        <td>店舗名</td>
                                        <td style={{ position: 'relative' }}>レビュー数
                                            <span style={{ position: 'absolute', top: '4px', left: '75px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'amount')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', left: '75px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'amount')}>▼</span>
                                        </td>
                                        <td style={{ position: 'relative' }}>評価平均
                                            <span style={{ position: 'absolute', top: '4px', left: '65px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('desc', 'average')}>▲</span>
                                            <span style={{ position: 'absolute', top: '14px', left: '65px', cursor: 'pointer', fontSize: '10px' }} onClick={() => changeSort('asc', 'average')}>▼</span>
                                        </td>
                                        <td>直近のレビュー一覧</td>
                                        <td>URL</td>
                                    </tr>
                                    {review.sort((a, b) => b.amount - a.amount).map(r =>
                                        <>
                                            <tr>
                                                <td>{r.shop}</td>
                                                <td>{r.amount}</td>
                                                <td><div className="d-flex align-items-center">{r.average}<Rating name="simple-controlled" precision={0.1} readOnly value={r.average} /></div></td>
                                                <td><div className="resale_customer_button text-center" style={{ width: '100px' }} onClick={() => modalShow(r.recently_review)}>詳細を表示</div></td>
                                                <td><div className="resale_customer_button text-center" style={{ width: '100px' }}
                                                    onClick={() => {
                                                        window.open(r.url);
                                                    }}>Google Map</div></td>
                                            </tr>
                                            <Modal show={show} onHide={modalClose} size='xl'>
                                                <Modal.Header closeButton>
                                                    <Modal.Title style={{ fontSize: '15px' }}>直近の口コミ一覧</Modal.Title>
                                                </Modal.Header>
                                                <Modal.Body>
                                                    <Table>
                                                        <tbody style={{ fontSize: '12px' }}>
                                                            <tr>
                                                                <td>投稿日</td>
                                                                <td>評価</td>
                                                                <td>口コミ</td>
                                                            </tr>
                                                            {modalContent.map(p =>
                                                                <tr>
                                                                    <td>{new Date(p.date).toLocaleDateString()}</td>
                                                                    <td><div className="d-flex align-items-center"><Rating name="simple-controlled" precision={0.1} readOnly value={p.rating} /></div></td>
                                                                    <td>{p.text}</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </Table>
                                                </Modal.Body>
                                            </Modal>
                                        </>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default ShopReview;
