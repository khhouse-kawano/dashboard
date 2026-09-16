import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Button, Form, Badge, ButtonGroup, InputGroup, Spinner, Pagination, Modal } from "react-bootstrap";
import apiClient from '../../utils/apiClient';
import {
    AdData, summarizeByAdvertiser, summarizeByTitle, summarizeByMonth,
} from './metaAdsUtils';
import MetaAdsSummary from './MetaAdsSummary';

// ⚠️ 型と集計は metaAdsUtils.ts に寄せた。**ここで再定義しないこと**
//   （同じ形を2か所に書くと、片方だけ列を足して食い違う）

const MetaAdsDashboard = () => {
    const [ads, setAds] = useState<AdData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    /**
     * ⚠️ 見出し（ad_title）の検索。
     *   ⚠️ 以前の検索欄は **advertiser_name しか見ていなかった**ので、
     *     「どんな訴求で出しているか」を探せなかった。
     */
    const [adTitle, setAdTitle] = useState<string>('');
    /** 表示の切り替え。⚠️ 集計は同じデータから作るので再取得しない */
    const [panel, setPanel] = useState<'banner' | 'summary'>('banner');
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
                // ⚠️ roll を付けること。移植元は1つの request で読み書きを兼ねていたため、
                //   ⚠️ ② 側は roll で分けている（許可リストも roll 込み）
                const response = await apiClient.post('', { request: "meta_ads", roll: "list" });
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
    }, [searchQuery, adTitle, viewMode, showOnlyBookmarked, selectedArea]);

    const toggleBookmark = async (id: string | number) => {
        setAds(prevAds => prevAds.map(ad =>
            ad.id === id ? { ...ad, bookmark: ad.bookmark === 1 ? 0 : 1 } : ad
        ));

        try {
            const targetAd = ads.find(ad => ad.id === id);
            const newBookmarkValue = targetAd?.bookmark === 1 ? 0 : 1;
            await apiClient.post('', {
                request: "meta_ads",
                roll: "bookmark",
                id: id,
                bookmark: newBookmarkValue
            });
        } catch (error) {
            console.error("ブックマークの保存に失敗しました", error);
        }
    };

    /**
     * 絞り込み。
     * ⚠️ 3,814件あるので、描画のたびに作り直さないよう useMemo にしている。
     * ⚠️ 依存を1つでも書き漏らすと**絞り込んだのに表示が変わらない**。
     */
    const filteredAds = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const t = adTitle.trim().toLowerCase();

        return ads.filter(ad => {
            const matchSearch = q === '' || (ad.advertiser_name ?? '').toLowerCase().includes(q);
            // ⚠️ 見出しは空の行が720件ある。空文字に対して includes は常に false になるので問題ない
            const matchTitle = t === '' || (ad.ad_title ?? '').toLowerCase().includes(t);
            const matchBookmark = showOnlyBookmarked ? ad.bookmark === 1 : true;
            const matchArea = selectedArea ? ad.advertiser_area === selectedArea : true;
            return matchSearch && matchTitle && matchBookmark && matchArea;
        });
    }, [ads, searchQuery, adTitle, showOnlyBookmarked, selectedArea]);

    // ⚠️ 集計は**絞り込んだ後**のデータから作る。絞り込みと数字が食い違うと読めない
    const advertiserRows = useMemo(() => summarizeByAdvertiser(filteredAds), [filteredAds]);
    const titleRows = useMemo(() => summarizeByTitle(filteredAds), [filteredAds]);
    const monthly = useMemo(() => summarizeByMonth(filteredAds), [filteredAds]);

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

                        {/* ⚠️ 見出し（ad_title）の検索。広告主の検索とは別に効く */}
                        <div style={{ width: '220px' }}>
                            <InputGroup size="sm" className="shadow-sm">
                                <InputGroup.Text className="bg-white border-end-0">
                                    <i className="fa-solid fa-quote-left text-muted"></i>
                                </InputGroup.Text>
                                <Form.Control
                                    type="text"
                                    placeholder="広告の見出しで検索..."
                                    value={adTitle}
                                    onChange={(e) => setAdTitle(e.target.value)}
                                    className="border-start-0 ps-0"
                                    style={{ fontSize: '0.8rem' }}
                                />
                                {!adTitle || (
                                    <Button variant="white" className="border border-start-0 text-muted"
                                        onClick={() => setAdTitle('')} title="クリア">
                                        <i className="fa-solid fa-xmark"></i>
                                    </Button>
                                )}
                            </InputGroup>
                        </div>

                        {/* ⚠️ バナーと集計の切り替え。⚠️ 同じ絞り込み結果を見ている */}
                        <ButtonGroup className="shadow-sm">
                            <Button
                                variant={panel === 'banner' ? "dark" : "white"}
                                size="sm"
                                onClick={() => setPanel('banner')}
                                className={panel === 'banner' ? "fw-bold" : "text-secondary border"}
                                style={{ width: '80px', fontSize: '0.8rem' }}
                            >
                                <i className="fa-solid fa-image me-1"></i>バナー
                            </Button>
                            <Button
                                variant={panel === 'summary' ? "dark" : "white"}
                                size="sm"
                                onClick={() => setPanel('summary')}
                                className={panel === 'summary' ? "fw-bold" : "text-secondary border"}
                                style={{ width: '80px', fontSize: '0.8rem' }}
                            >
                                <i className="fa-solid fa-chart-simple me-1"></i>集計
                            </Button>
                        </ButtonGroup>

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
                ) : panel === 'summary' ? (
                    /* ⚠️ 集計は絞り込み後のデータから作る。バナー側と数字が食い違わないため */
                    <MetaAdsSummary
                        advertisers={advertiserRows}
                        titles={titleRows}
                        monthly={monthly}
                        total={filteredAds.length}
                    />
                ) : (
                    <>
                        {viewMode === 'grid' && (
                            /**
                             * ⚠️⚠️ **カードの幅を固定して、画面幅ぶんだけ並べる。**
                             *   ⚠️ 以前は `xs=1 sm=2 md=3 lg=4` の固定列だったため、
                             *     全画面にしても**1行4枚**までしか入らず、
                             *     広い画面ほど1枚が巨大になって比較しづらかった。
                             *   ⚠️ `auto-fill` + `minmax` なら幅に応じて枚数が増える。
                             *   ⚠️ `minmax` の下限を画面幅より大きくしないこと（横スクロールが出る）。
                             */
                            <div
                                className="mb-4"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                                    gap: '1rem',
                                    alignItems: 'start',
                                }}
                            >
                                {paginatedAds.map((ad) => (
                                    <div key={ad.id}>
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
                                    </div>
                                ))}
                            </div>
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