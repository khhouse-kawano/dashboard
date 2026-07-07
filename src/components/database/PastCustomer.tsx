import React, { useEffect, useState, useMemo } from 'react';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import axios from 'axios';
import { headers } from '../../utils/headers';
import { dateFormate } from '../list/listUtils';

type Props = {
    pastCustomerShow: boolean,
    setPastCustomerShow: React.Dispatch<React.SetStateAction<boolean>>
}

export const PastCustomer = ({ pastCustomerShow, setPastCustomerShow }: Props) => {
    const [searchedStaff, setSearchedStaff] = useState('');
    const [customers, setCustomers] = useState<Record<string, string>[]>([]);
    const [activePage, setActivePage] = useState<number>(1);
    const [basicLength, setBasicLength] = useState<number>(20);
    const [editId, setEditId] = useState('');

    // 1. データ取得
    useEffect(() => {
        if (!pastCustomerShow) return;
        const fetchData = async () => {
            try {
                const response = await axios.post("https://khg-marketing.info/dashboard/api/gateway/", { request: 'past_customer' }, { headers });
                setCustomers(response.data.customer);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };

        fetchData();
    }, [pastCustomerShow]);

    // 2. 検索フィルター
    const filteredDatabase = useMemo(() => {
        return customers.filter(item => {
            const strIncludes = (val: any, sub: string) => (sub ? String(val ?? '').includes(sub) : true);
            return searchedStaff ? strIncludes(item.staff, searchedStaff.split(' ')[0]) : true;
        });
    }, [customers, searchedStaff]);

    // 3. 検索キーワードや表示件数が変わったら、ページを1ページ目にリセットする
    useEffect(() => {
        setActivePage(1);
    }, [searchedStaff, basicLength]);

    // 4. ページング用の計算
    const totalItems = filteredDatabase.length;
    const totalPages = Math.ceil(totalItems / basicLength) || 1;
    const sliceStart = (activePage - 1) * basicLength;

    const handlePageClick = (page: number) => {
        setActivePage(page);
    };

    // ★追加: 現在のページを中心に、表示するページ番号の配列（最大5個）を計算する関数
    const getPageNumbers = () => {
        let start = Math.max(1, activePage - 2);
        let end = Math.min(totalPages, start + 4);

        // 最後のページ付近にいるときの表示ズレを補正
        start = Math.max(1, end - 4);

        const pages: number[] = [];
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    return (
        <Modal show={pastCustomerShow} onHide={() => setPastCustomerShow(false)} size='xl'>
            <Modal.Header closeButton>対応済み顧客を検索</Modal.Header>
            <Modal.Body>
                <div className="m-1">
                    <input className="target" placeholder='営業名で検索' onChange={(e) => setSearchedStaff(e.target.value)} />
                </div>
                <div className="d-md-flex">
                    <div className="d-flex flex-wrap align-items-center">
                        <div className="">
                            {totalItems} <span style={{ fontSize: '12px' }}> 件中 {totalItems === 0 ? 0 : sliceStart + 1}件~{Math.min(activePage * basicLength, totalItems)}件</span>
                        </div>
                        <div className="ms-1" style={{ fontSize: '11px' }}>
                            表示件数
                            <select style={{ fontSize: '11px', borderRadius: '5px', width: '70px' }} onChange={(e) => setBasicLength(Number(e.target.value))}>
                                <option value='20'>20件</option>
                                <option value='50'>50件</option>
                                <option value='100'>100件</option>
                                <option value='500'>500件</option>
                            </select>
                        </div>
                    </div>
                    <div className="d-flex flex-wrap align-items-center mb-1">
                        <div className="m-1 pt-3">
                            <ul className="custom-pagination">
                                <li>
                                    <button onClick={() => handlePageClick(1)}>«</button>
                                </li>
                                <li>
                                    <button onClick={() => handlePageClick(Math.max(activePage - 1, 1))}>‹</button>
                                </li>

                                {/* ★復活＆進化: ページ番号を動的に5個レンダリング */}
                                {getPageNumbers().map((page) => (
                                    <li key={page} className={activePage === page ? 'active' : ''}>
                                        <button onClick={() => handlePageClick(page)}>
                                            {page}
                                        </button>
                                    </li>
                                ))}

                                <li>
                                    <button onClick={() => handlePageClick(Math.min(activePage + 1, totalPages))}>›</button>
                                </li>
                                <li>
                                    <button onClick={() => handlePageClick(totalPages)}>»</button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <Table>
                    <tbody style={{ fontSize: '12px' }}>
                        <tr>
                            <td>編集</td>
                            <td>反響取得日</td>
                            <td>顧客名</td>
                            <td>店舗</td>
                            <td>現在の担当</td>
                            <td>ランク</td>
                            <td>反響経路</td>
                        </tr>
                        {[...filteredDatabase].sort((a, b) => {
                            const tA = a.register ? Date.parse(a.register) : Number.NEGATIVE_INFINITY;
                            const tB = b.register ? Date.parse(b.register) : Number.NEGATIVE_INFINITY;
                            const timeA = Number.isNaN(tA) ? Number.NEGATIVE_INFINITY : tA;
                            const timeB = Number.isNaN(tB) ? Number.NEGATIVE_INFINITY : tB;
                            return timeB - timeA;
                        })
                            .slice(sliceStart, sliceStart + basicLength)
                            .map((item, index) => (
                                <tr key={index}>
                                    <td><div className='hover bg-danger text-white' style={{ fontSize: "12px", cursor: 'pointer', width: 'fit-content', padding: '4px 10px', borderRadius: '5px', margin: '0 auto', textDecoration: 'none' }}
                                        onClick={() => {
                                            setEditId(item.id);
                                        }}>編集</div></td>
                                    <td>{dateFormate(item.register)}</td>
                                    <td>{item.customer}</td>
                                    <td>{item.shop}</td>
                                    <td>{item.staff}</td>
                                    <td>{item.rank}</td>
                                    <td>{item.hp_campaign}</td>
                                </tr>
                            ))}
                    </tbody>
                </Table>
            </Modal.Body>
        </Modal>
    )
}