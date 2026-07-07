import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Badge, ButtonGroup, InputGroup, Row, Col, Spinner, Pagination, Modal } from "react-bootstrap";
import axios from 'axios';
import { headers } from '../../utils/headers';

// 💡 1. 型定義に新しいデータを追加
type AdData = {
    id: string | number;
    advertiser_name: string;
    advertiser_area: string;   // 追加
    advertiser_period: string; // 追加
    ad_title: string;
    image_filename: string;
    scraped_date: string;
    lp_url: string;
    bookmark?: number;
};

const MetaAdsDashboard = () => {
    const [ads, setAds] = useState<AdData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isLoading, setIsLoading] = useState(true);
    const [companyList, setCompanyList] = useState<string[]>([]);
    
    // 💡 2. エリアのセレクトボックス用Stateを追加
    const [areaList, setAreaList] = useState<string[]>([]);
    const [selectedArea, setSelectedArea] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showBanner, setShowBanner] = useState('');
    const [imgHover, setImgHover] = useState('');

    const [showOnlyBookmarked, setShowOnlyBookmarked] = useState(false);

    const IMAGE_BASE_URL = 'https://khg-marketing.info/api/meta/images/';

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: "meta_ads" }, { headers });
                const formattedAds = response.data.ads.
                sort((a, b) => new Date(b.scraped_date).getTime() - new Date(a.scraped_date).getTime())
                .map((ad: any) => ({
                    ...ad,
                    bookmark: Number(ad.bookmark) === 1 ? 1 : 0
                }));
                setAds(formattedAds);
                setIsLoading(false);
                
                const companyArray: string[] = formattedAds.map((a: AdData) => a.advertiser_name);
                setCompanyList([...new Set(companyArray)]);

                const areas: string[] = formattedAds
                    .map((a: AdData) => a.advertiser_area)
                    .filter((area: string) => area && area !== "不明");
                setAreaList([...new Set(areas)]);

            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, viewMode, showOnlyBookmarked, selectedArea]);

    const toggleBookmark = async (id: string | number) => {
        setAds(prevAds => prevAds.map(ad =>
            ad.id === id ? { ...ad, bookmark: ad.bookmark === 1 ? 0 : 1 } : ad
        ));

        try {
            const targetAd = ads.find(ad => ad.id === id);
            const newBookmarkValue = targetAd?.bookmark === 1 ? 0 : 1;
            await axios.post('https://khg-marketing.info/dashboard/api/gateway/', {
                request: "meta_ads",
                id: id,
                bookmark: newBookmarkValue
            }, { headers });
        } catch (error) {
            console.error("ブックマークの保存に失敗しました", error);
        }
    };

    const filteredAds = ads.filter(ad => {
        const matchSearch = ad.advertiser_name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchBookmark = showOnlyBookmarked ? ad.bookmark === 1 : true;
        const matchArea = selectedArea ? ad.advertiser_area === selectedArea : true;
        return matchSearch && matchBookmark && matchArea;
    });

    const totalPages = Math.ceil(filteredAds.length / itemsPerPage);
    const paginatedAds = filteredAds.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    const paginationItems: React.ReactNode[] = [];
    for (let number = startPage; number <= endPage; number++) {
        paginationItems.push(
            <Pagination.Item
                key={number}
                active={number === currentPage}
                onClick={() => setCurrentPage(number)}
                className="shadow-sm"
            >
                {number}
            </Pagination.Item>
        );
    }

    const formateDate = (value: string) => value ? value.replace(/-/g, '/') : '';

    return (
        <>
            <div className="p-3 bg-light d-flex flex-column" style={{ fontSize: '0.8rem', minHeight: '100vh' }}>

                <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center mb-3 gap-3">

                    <h5 className="fw-bold text-secondary mb-0 text-center text-lg-start">
                        <i className="fa-solid fa-rectangle-ad me-2"></i>他社動向
                    </h5>

                    {totalPages > 1 && (
                        <div className="d-flex justify-content-center">
                            <Pagination size="sm" className="mb-0 shadow-sm">
                                <Pagination.First onClick={() => setCurrentPage(1)} disabled={currentPage === 1} />
                                <Pagination.Prev onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} />
                                {paginationItems}
                                <Pagination.Next onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} />
                                <Pagination.Last onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} />
                            </Pagination>
                        </div>
                    )}

                    <div className="d-flex gap-3 align-items-center justify-content-center justify-content-lg-end flex-wrap">
                        
                        <Button
                            variant={showOnlyBookmarked ? "warning" : "white"}
                            size="sm"
                            onClick={() => setShowOnlyBookmarked(!showOnlyBookmarked)}
                            className={`shadow-sm border ${showOnlyBookmarked ? 'text-dark fw-bold border-warning' : 'text-secondary'}`}
                            style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        >
                            <i 
                                className={`fa-${showOnlyBookmarked ? 'solid' : 'regular'} fa-bookmark me-1`} 
                                style={{ color: showOnlyBookmarked ? '#212529' : '#ffc107' }}
                            ></i>
                            保存済み
                        </Button>

                        {/* 💡 5. エリア絞り込み用のセレクトボックス */}
                        <div style={{ width: '120px' }}>
                            <Form.Select
                                size="sm"
                                value={selectedArea}
                                onChange={(e) => setSelectedArea(e.target.value)}
                                className="shadow-sm border-0 text-secondary"
                                style={{ fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                                <option value="">全エリア</option>
                                {areaList.map((area, idx) => (
                                    <option key={idx} value={area}>{area}</option>
                                ))}
                            </Form.Select>
                        </div>

                        <div style={{ width: '220px', position: 'relative' }}>
                            <InputGroup size="sm" className="shadow-sm">
                                <InputGroup.Text className="bg-white border-end-0">
                                    <i className="fa-solid fa-magnifying-glass text-muted"></i>
                                </InputGroup.Text>
                                <Form.Control
                                    type="text"
                                    placeholder="広告主名で検索..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() => setShowSuggestions(false)}
                                    className="border-start-0 ps-0"
                                    style={{ fontSize: '0.8rem' }}
                                />
                            </InputGroup>

                            {showSuggestions && searchQuery && (
                                <div
                                    className="position-absolute w-100 bg-white shadow"
                                    style={{
                                        top: '100%', left: 0, marginTop: '4px', zIndex: 1050,
                                        maxHeight: '200px', overflowY: 'auto', borderRadius: '6px',
                                        border: '1px solid #dee2e6', display: 'block'
                                    }}
                                >
                                    {companyList
                                        .filter(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
                                        .map((company, idx) => (
                                            <div
                                                key={idx}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setSearchQuery(company);
                                                    setShowSuggestions(false);
                                                }}
                                                className="text-truncate text-dark"
                                                style={{ padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer', borderBottom: '1px solid #f8f9fa' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                {company}
                                            </div>
                                        ))
                                    }
                                    {companyList.filter(c => c.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                        <div className="text-muted" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                                            該当する企業がありません
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <ButtonGroup className="shadow-sm">
                            <Button
                                variant={viewMode === 'grid' ? "primary" : "white"}
                                size="sm"
                                onClick={() => setViewMode('grid')}
                                className={viewMode === 'grid' ? "fw-bold" : "text-secondary border"}
                                style={{ width: '80px', fontSize: '0.8rem' }}
                            >
                                <i className="fa-solid fa-border-all me-1"></i>カード
                            </Button>
                            <Button
                                variant={viewMode === 'list' ? "primary" : "white"}
                                size="sm"
                                onClick={() => setViewMode('list')}
                                className={viewMode === 'list' ? "fw-bold" : "text-secondary border"}
                                style={{ width: '80px', fontSize: '0.8rem' }}
                            >
                                <i className="fa-solid fa-list me-1"></i>リスト
                            </Button>
                        </ButtonGroup>
                    </div>
                </div>

                {isLoading ? (
                    <div className="d-flex justify-content-center align-items-center py-5 text-secondary flex-grow-1">
                        <Spinner animation="border" size="sm" className="me-2" /> 読み込み中...
                    </div>
                ) : filteredAds.length === 0 ? (
                    <div className="text-center py-5 text-muted bg-white shadow-sm rounded flex-grow-1">
                        該当する広告がありません
                    </div>
                ) : (
                    <>
                        {viewMode === 'grid' && (
                            <Row xs={1} sm={2} md={3} lg={4} className="g-3 mb-4">
                                {paginatedAds.map((ad) => (
                                    <Col key={ad.id}>
                                        <Card className="shadow-sm h-100 border-0 rounded-3 overflow-hidden">
                                            <Card.Img
                                                variant="top"
                                                src={`${IMAGE_BASE_URL}${ad.image_filename}`}
                                                style={{ aspectRatio: '1 / 1', objectFit: 'cover', width: '100%', opacity: imgHover === ad.image_filename ? '.8' : '1', cursor: 'pointer' }}
                                                onClick={() => setShowBanner(`${IMAGE_BASE_URL}${ad.image_filename}`)}
                                                onMouseOver={() => setImgHover(ad.image_filename)}
                                                onMouseLeave={() => setImgHover('')}
                                            />
                                            <Card.Body className="d-flex flex-column p-3">

                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    {/* 💡 6. 企業名と並べてエリアもバッジで表示 */}
                                                    <div className="d-flex flex-wrap gap-1">
                                                        <Badge bg="secondary" className="fw-normal">
                                                            <i className="fa-regular fa-building me-1"></i>
                                                            {ad.advertiser_name}
                                                        </Badge>
                                                        {ad.advertiser_area && ad.advertiser_area !== "不明" && (
                                                            <Badge bg="info" text="dark" className="fw-normal">
                                                                <i className="fa-solid fa-location-dot me-1"></i>
                                                                {ad.advertiser_area}
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <i
                                                        className={`fa-${ad.bookmark === 1 ? 'solid text-warning' : 'regular text-muted'} fa-bookmark`}
                                                        style={{ cursor: 'pointer', fontSize: '1.2rem', transition: '0.2s', marginLeft: '8px' }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleBookmark(ad.id);
                                                        }}
                                                        title={ad.bookmark === 1 ? 'ブックマーク解除' : 'ブックマークに追加'}
                                                    ></i>
                                                </div>

                                                <Card.Text className="text-dark fw-bold mb-0" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {ad.ad_title || 'テキストなし'}
                                                </Card.Text>
                                            </Card.Body>

                                            <div className="mt-auto d-flex justify-content-between align-items-end p-3 pt-2 border-top">
                                                {/* 💡 7. 取得日の上に「掲載開始日」を追加 */}
                                                <div className="d-flex flex-column">
                                                    {ad.advertiser_period && (
                                                        <span className="text-dark fw-bold mb-1" style={{ fontSize: '0.75rem' }}>
                                                            開始: {ad.advertiser_period}
                                                        </span>
                                                    )}
                                                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                        取得: {formateDate(ad.scraped_date)}
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    href={ad.lp_url}
                                                    target="_blank"
                                                    className="py-1 px-2"
                                                    style={{ fontSize: '0.75rem' }}
                                                >
                                                    遷移先 <i className="fa-solid fa-arrow-up-right-from-square ms-1"></i>
                                                </Button>
                                            </div>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        )}

                        {viewMode === 'list' && (
                            <div className="table-responsive shadow-sm rounded bg-white mb-4">
                                <Table hover className="align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                                    <thead className="table-light text-secondary text-nowrap">
                                        <tr>
                                            <th className="fw-normal py-2" style={{ width: '4%' }}>No</th>
                                            <th className="fw-normal py-2 text-center" style={{ width: '5%' }}>保存</th>
                                            <th className="fw-normal py-2" style={{ width: '8%' }}>画像</th>
                                            <th className="fw-normal py-2" style={{ width: '16%' }}>広告主 / エリア</th>
                                            <th className="fw-normal py-2" style={{ width: '35%' }}>広告テキスト</th>
                                            <th className="fw-normal py-2" style={{ width: '17%' }}>掲載開始 / 取得日</th>
                                            <th className="fw-normal text-center py-2" style={{ width: '15%' }}>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedAds.map((ad, index) => (
                                            <tr key={ad.id}>
                                                <td className="py-2">
                                                    <span className="text-muted">
                                                        {(currentPage - 1) * itemsPerPage + index + 1}
                                                    </span>
                                                </td>
                                                <td className="py-2 text-center">
                                                    <i
                                                        className={`fa-${ad.bookmark === 1 ? 'solid text-warning' : 'regular text-muted'} fa-bookmark`}
                                                        style={{ cursor: 'pointer', fontSize: '1.2rem', transition: '0.2s' }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleBookmark(ad.id);
                                                        }}
                                                    ></i>
                                                </td>
                                                <td className="py-2">
                                                    <img
                                                        src={`${IMAGE_BASE_URL}${ad.image_filename}`}
                                                        alt="Ad"
                                                        className="rounded border"
                                                        style={{ width: '60px', aspectRatio: '1 / 1', objectFit: 'cover', opacity: imgHover === ad.image_filename ? '.8' : '1', cursor: 'pointer' }}
                                                        onClick={() => setShowBanner(`${IMAGE_BASE_URL}${ad.image_filename}`)}
                                                        onMouseOver={() => setImgHover(ad.image_filename)}
                                                        onMouseLeave={() => setImgHover('')}
                                                    />
                                                </td>
                                                {/* 💡 8. 広告主名とエリアを縦並びでスマートに */}
                                                <td className="py-2">
                                                    <div className="fw-bold text-dark mb-1">{ad.advertiser_name}</div>
                                                    {ad.advertiser_area && ad.advertiser_area !== "不明" && (
                                                        <Badge bg="info" text="dark" className="fw-normal" style={{ fontSize: '0.7rem' }}>
                                                            <i className="fa-solid fa-location-dot me-1"></i>{ad.advertiser_area}
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="py-2 text-truncate" style={{ maxWidth: '300px' }}>
                                                    {ad.ad_title || 'テキストなし'}
                                                </td>
                                                {/* 💡 9. 掲載開始と取得日を縦並びに */}
                                                <td className="py-2">
                                                    <div className="d-flex flex-column gap-1">
                                                        {ad.advertiser_period && (
                                                            <span className="fw-bold text-dark">開始: {ad.advertiser_period}</span>
                                                        )}
                                                        <span className="text-muted" style={{ fontSize: '0.7rem' }}>取得: {formateDate(ad.scraped_date)}</span>
                                                    </div>
                                                </td>
                                                <td className="py-2 text-center">
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        href={ad.lp_url}
                                                        target="_blank"
                                                        className="px-2 shadow-sm text-nowrap"
                                                        style={{ fontSize: '0.75rem' }}
                                                    >
                                                        遷移先 <i className="fa-solid fa-arrow-up-right-from-square ms-1"></i>
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                    </>
                )}
            </div>
            <Modal show={!!showBanner} onHide={() => setShowBanner('')}>
                <Modal.Header closeButton></Modal.Header>
                <Modal.Body>
                    <div onClick={() => setShowBanner('')} style={{ cursor: 'pointer' }}>
                        <img src={showBanner} alt="他社動向" className='w-100' />
                    </div>
                </Modal.Body>
            </Modal>
        </>
    );
};

export default MetaAdsDashboard;