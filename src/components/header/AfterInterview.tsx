import React, { useState, useEffect, useMemo } from 'react';
import Table from 'react-bootstrap/Table';
import Badge from 'react-bootstrap/Badge';
import apiClient from '../../utils/apiClient';
import BsForm from 'react-bootstrap/Form';

export interface InterviewData {
    no: string;
    id: string;
    dateStr: string;
    shop: string;
    name: string;
    phone: string;
    InterviewFeedback: string;
    confirmedAllItems: string;
    desireOwnership: string;
    priorityCondition: string;
    ourCompanyFirstChoice: string;
    otherCompaniesInterested: string;
    staffName: string;
    staffHospitality: string;
    proposalFeedback: string;
    moreInfoOrImprovements: string;
    nextConsultationRequests: string;
    changeStaffRequested: string;
};

type Shop = Record<string, string>;

type Props = {
    name: string,
    staff: string,
    id: string,
    shop: string
};

const AfterInterview = ({ name, staff, shop, id }: Props) => {
    const [interviewList, setInterviewList] = useState<InterviewData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [shops, setShops] = useState<Shop[]>([]);
    const [targetShop, setTargetShop] = useState('');
    const [targetName, setTargetName] = useState('');
    const [targetStaff, setTargetStaff] = useState('');
    const [targetId, setTargetId] = useState(id ?? '');

    const ITEMS_PER_PAGE = 10;
    const MAX_PAGE_BUTTONS = 5;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: "afterInterview" });
                setInterviewList(response.data.interview);
                const filteredShop = response.data.shop.filter(s => !s.shop.includes('未設定') && !s.shop.includes('全店舗'));
                setShops(filteredShop);
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        setTargetName(name ?? '');
        setTargetShop(shop ?? '');
        setTargetStaff(staff ?? '');
        setTargetId(id ?? '');
    }, [name, staff, shop, id]);

    useEffect(() => {
        setCurrentPage(1);
    }, [targetShop]);

    const getBadgeVariant = (text: string) => {
        if (!text) return 'secondary';
        if (text.includes('満足') || text.includes('第一候補')) return 'success';
        if (text.includes('このままで良い') || text.includes('思えた')) return 'primary';
        if (text.includes('今すぐ')) return 'danger';
        return 'secondary';
    };

    const selectedCustomer = useMemo(() => {
        const formate = (date: string) => {
            return (date ?? '').replace(/\//g, '-').slice(0, 10);
        }

        return [...interviewList]
            .sort((a, b) =>
                new Date(formate(b.dateStr)).getTime() - new Date(formate(a.dateStr)).getTime()
            )
            .filter(c =>
                (targetShop ? c.shop === targetShop : true) &&
                (targetName ? c.name.includes(targetName) : true) &&
                (targetId ? c.id.includes(targetId) : true) &&
                (targetStaff ? c.staffName.includes(targetStaff) : true)
            );

    }, [interviewList, targetShop, targetName, targetStaff, targetId]);

    const totalItems = selectedCustomer.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentItems = selectedCustomer.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handlePageChange = (pageNumber: number) => {
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    const getPageNumbers = () => {
        const pages: number[] = [];
        let startPage = Math.max(1, currentPage - Math.floor(MAX_PAGE_BUTTONS / 2));
        let endPage = Math.min(totalPages, startPage + MAX_PAGE_BUTTONS - 1);

        if (endPage - startPage + 1 < MAX_PAGE_BUTTONS) {
            startPage = Math.max(1, endPage - MAX_PAGE_BUTTONS + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        return pages;
    };

    const selectStyle = { fontSize: '11px', cursor: 'pointer', width: '180px' };

    return (
        // p-4 から p-3 に変更して無駄な余白を削減
        <div className="bg-white p-3 rounded-4 shadow-sm border" style={{ fontFamily: '"Noto Sans JP", sans-serif' }}>

            {/* 上部ヘッダー領域 */}
            <div className="d-flex align-items-center justify-content-start mb-3">
                <div className='me-4'>
                    <h6 className="fw-bold mb-1" style={{ color: '#333', fontSize: '15px' }}>事後アンケート結果</h6>
                    <div className="text-muted fw-bold" style={{ fontSize: '12px' }}>
                        該当データ: {totalItems} 件
                    </div>
                </div>

                <BsForm.Select
                    size="sm"
                    className='me-2'
                    value={targetShop}
                    onChange={(e) => setTargetShop(e.target.value)}
                    style={selectStyle}
                >
                    <option value="">店舗を選択</option>
                    {shops.map(s => <option key={s.shop} value={s.shop}>{s.shop}</option>)}
                </BsForm.Select>

                <BsForm.Control
                    type='text'
                    size="sm"
                    className='me-2'
                    value={targetName}
                    onChange={(e) => setTargetName(e.target.value)}
                    style={selectStyle}
                    placeholder='顧客名で検索'
                />

                <BsForm.Control
                    type='text'
                    size="sm"
                    className='me-2'
                    value={targetStaff}
                    onChange={(e) => setTargetStaff(e.target.value)}
                    style={selectStyle}
                    placeholder='営業名で検索'
                />
            </div>

            {/* テーブル領域 */}
            <div className="table-responsive">
                {/* minWidthを 1200px -> 1000px に縮小（XLモーダル内にスクロールバー無しで収まるサイズ感） */}
                <Table hover className="align-middle mb-0" style={{ minWidth: '1000px' }}>
                    <thead>
                        {/* fontSizeを 12px -> 11px に、余白を py-3 -> py-2 に縮小 */}
                        <tr className="text-secondary border-bottom" style={{ fontSize: '11px', backgroundColor: '#f8f9fa' }}>
                            <th className="py-2 px-2" style={{ width: '150px' }}>回答日時 / 店舗</th>
                            <th className="py-2 px-2" style={{ width: '140px' }}>顧客 / 担当営業</th>
                            <th className="py-2 px-2" style={{ width: '200px' }}>温度感 / 評価</th>
                            <th className="py-2 px-2">面談内容 / フィードバック</th>
                            <th className="py-2 px-2" style={{ width: '250px' }}>次回要望 / 懸念点</th>
                        </tr>
                    </thead>
                    {/* ベースの文字サイズを 13px -> 12px に縮小 */}
                    <tbody style={{ fontSize: '12px' }}>
                        {isLoading ? (
                            <tr>
                                <td colSpan={5} className="text-center py-4 text-muted">読み込み中...</td>
                            </tr>
                        ) : currentItems.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-4 text-muted">データがありません</td>
                            </tr>
                        ) : (
                            currentItems.map((item) => (
                                <tr key={item.no} className="border-bottom" style={{ transition: 'background-color 0.2s' }}>
                                    {/* 余白を px-3 py-3 -> px-2 py-2 に変更 */}
                                    <td className="px-2 py-2">
                                        <div className="text-muted mb-1" style={{ fontSize: '10px' }}>
                                            <i className="fa-regular fa-clock me-1"></i>{item.dateStr}
                                        </div>
                                        <div className="fw-bold text-dark">
                                            <i className="fa-solid fa-store text-primary me-1 text-opacity-75"></i>{item.shop}
                                        </div>
                                    </td>
                                    <td className="px-2 py-2">
                                        {/* 名前を fs-6 -> 13px の太字に変更 */}
                                        <div className="fw-bold mb-1" style={{ fontSize: '13px' }}>{item.name} 様</div>
                                        <div className="text-muted" style={{ fontSize: '11px' }}>
                                            担当: <span className="text-dark fw-medium">{item.staffName}</span>
                                        </div>
                                    </td>
                                    <td className="px-2 py-2">
                                        <div className="d-flex flex-column gap-1 align-items-start">
                                            {/* バッジ自体のフォントも 10px に縮小 */}
                                            <Badge bg={getBadgeVariant(item.desireOwnership)} className="px-2 py-1 fw-normal shadow-sm" style={{ fontSize: '10px' }}>
                                                {item.desireOwnership || '未回答'}
                                            </Badge>
                                            <div className="d-flex gap-1 mt-1">
                                                <Badge bg={getBadgeVariant(item.ourCompanyFirstChoice)} className="fw-normal" style={{ fontSize: '10px' }}>
                                                    自社: {item.ourCompanyFirstChoice || '-'}
                                                </Badge>
                                                <Badge bg={getBadgeVariant(item.staffHospitality)} className="fw-normal" style={{ fontSize: '10px' }}>
                                                    接客: {item.staffHospitality || '-'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-2 py-2">
                                        <div className="text-secondary mb-1" style={{ fontSize: '10px', fontWeight: 'bold' }}>説明した内容:</div>
                                        <div className="text-dark" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                                            {item.InterviewFeedback || '-'}
                                        </div>
                                        {item.priorityCondition && (
                                            <div className="mt-1 text-primary" style={{ fontSize: '11px' }}>
                                                <i className="fa-solid fa-star me-1"></i>重視: {item.priorityCondition}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-2 py-2">
                                        {/* ギャップを gap-2 -> gap-1 にし、コンパクトに */}
                                        <div className="d-flex flex-column gap-1">
                                            {item.moreInfoOrImprovements && (
                                                <div className="p-2 bg-light rounded text-dark" style={{ fontSize: '11px', borderLeft: '3px solid #ffc107' }}>
                                                    <span className="text-muted fw-bold d-block mb-1" style={{ fontSize: '9px' }}>もっと知りたい事:</span>
                                                    {item.moreInfoOrImprovements}
                                                </div>
                                            )}
                                            {item.nextConsultationRequests && (
                                                <div className="p-2 bg-light rounded text-dark" style={{ fontSize: '11px', borderLeft: '3px solid #0d6efd' }}>
                                                    <span className="text-muted fw-bold d-block mb-1" style={{ fontSize: '9px' }}>次回聞きたい事:</span>
                                                    {item.nextConsultationRequests}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </Table>
            </div>

            {/* ページネーション領域 */}
            {!isLoading && totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                    {/* 件数表示を 13px -> 12px に */}
                    <div className="text-muted" style={{ fontSize: '12px' }}>
                        全 <span className="fw-bold text-dark">{totalItems}</span> 件中{' '}
                        <span className="fw-bold text-dark">{startIndex + 1}</span> 〜{' '}
                        <span className="fw-bold text-dark">{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}</span> 件目を表示
                    </div>

                    <ul className="pagination pagination-sm mb-0">
                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                            <button className="page-link shadow-none px-2" onClick={() => handlePageChange(1)} disabled={currentPage === 1} style={{ fontSize: '11px' }}>
                                <i className="fa-solid fa-angles-left"></i>
                            </button>
                        </li>
                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                            <button className="page-link shadow-none px-2" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} style={{ fontSize: '11px' }}>
                                <i className="fa-solid fa-chevron-left"></i> 前へ
                            </button>
                        </li>

                        {getPageNumbers().map(pageNum => (
                            <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                                <button className="page-link shadow-none" onClick={() => handlePageChange(pageNum)} style={{ minWidth: '32px', textAlign: 'center', fontSize: '11px' }}>
                                    {pageNum}
                                </button>
                            </li>
                        ))}

                        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                            <button className="page-link shadow-none px-2" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} style={{ fontSize: '11px' }}>
                                次へ <i className="fa-solid fa-chevron-right"></i>
                            </button>
                        </li>
                        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                            <button className="page-link shadow-none px-2" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} style={{ fontSize: '11px' }}>
                                <i className="fa-solid fa-angles-right"></i>
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AfterInterview;