import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

/**
 * 2行で省略しているテキストに「全て表示」を付けて、その場で展開できるようにする。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **文字数で判定しないこと。**
 *
 *   省略しているのは `-webkit-line-clamp`（2行）で、**文字数ではなく行数**である。
 *   何文字で2行を超えるかは列幅とフォント次第で、この列は `<th>` に幅指定が無く
 *   残り幅を分け合う。「◯文字を超えたらボタンを出す」にすると、
 *   幅の広い画面では切れていない行にまでボタンが出る。
 *
 *   そのため **実際に切れているか（scrollHeight > clientHeight）をDOMで測る**。
 *
 * ⚠️ after_interview の各列は `text` 型（上限65KB）である。
 *   2026-09-10 時点の実データは最長105文字（平均50文字、改行は0件）だが、
 *   長い回答が入りうる前提で作ること。
 * ─────────────────────────────────────────────
 */
type ClampedTextProps = {
    text: string;
    /** 省略するまでの行数。既定の2は元の実装のまま */
    lines?: number;
};

const ClampedText = ({ text, lines = 2 }: ClampedTextProps) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const [isClipped, setIsClipped] = useState<boolean>(false);
    const [isOpen, setIsOpen] = useState<boolean>(false);

    const measure = useCallback(() => {
        const el = ref.current;
        if (!el) return;

        /**
         * ⚠️⚠️ **展開中は測らない。**
         *   展開中は clamp を外しているので必ず scrollHeight === clientHeight になる。
         *   ここで測ると「切れていない」と誤判定し、**「折りたたむ」ボタンが消えて
         *   元に戻せなくなる**。
         */
        if (isOpen) return;

        // ⚠️ 1px 未満の差で誤判定するため、しきい値を設ける（端数の丸めやズーム対策）
        setIsClipped(el.scrollHeight - el.clientHeight > 1);
    }, [isOpen]);

    useEffect(() => {
        measure();

        const el = ref.current;
        if (!el) return;

        /**
         * 列幅の変化（モーダルのリサイズ、他列の内容による幅の取り合い）で
         * 切れるかどうかが変わるため、測り直す。
         * ⚠️ ResizeObserver が無い環境では初回の測定だけで諦める。落とさないこと。
         */
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => measure());
        observer.observe(el);
        return () => observer.disconnect();
    }, [measure, text]);

    useEffect(() => {
        /**
         * ⚠️ Webフォント（Noto Sans JP）の読み込み後に文字幅が変わる。
         *   初回の測定はフォールバックフォントでの結果になりうるので測り直す。
         *   ⚠️ 高さが変わらない場合 ResizeObserver は発火しないため、これが必要。
         */
        const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
        if (!fonts) return;
        let alive = true;
        fonts.ready.then(() => { if (alive) measure(); });
        return () => { alive = false; };
    }, [measure]);

    // ⚠️ 元の実装の style をそのまま維持し、展開時だけ clamp を外す
    const clampStyle: React.CSSProperties = isOpen
        ? {
            lineHeight: '1.4',
            // ⚠️ 展開時のみ。長い連続文字で表がはみ出すのを防ぐ
            wordBreak: 'break-word'
        }
        : {
            display: '-webkit-box',
            WebkitLineClamp: lines,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: '1.4'
        };

    return (
        <>
            <div ref={ref} className="text-dark" style={clampStyle}>
                {text || '-'}
            </div>
            {/* ⚠️ 切れている行だけに出す。2文字の回答に無意味なボタンを出さないため。
                ⚠️ isOpen も条件に入れる。展開後は isClipped を測っていないが、
                  measure() が早期 return するので isClipped は true のまま残る。
                  それでも保険として明示しておく（消えると戻せなくなる） */}
            {(isClipped || isOpen) && (
                <button
                    type="button"
                    className="btn btn-link btn-sm p-0 mt-1 shadow-none text-decoration-none"
                    style={{ fontSize: '10px', lineHeight: 1.2 }}
                    onClick={() => setIsOpen(prev => !prev)}
                    aria-expanded={isOpen}
                >
                    <i className={`fa-solid ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'} me-1`}></i>
                    {isOpen ? '折りたたむ' : '全て表示'}
                </button>
            )}
        </>
    );
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
                                        {/* ⚠️ ページ送りで同じ位置に別の行が来ても展開状態を持ち越さないよう、
                                            key に item.no を入れて作り直させる */}
                                        <ClampedText key={item.no} text={item.InterviewFeedback} />
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