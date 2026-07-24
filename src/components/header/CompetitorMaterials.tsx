import React, { useState, useEffect } from 'react';
import { Table, Button, Form, Badge, InputGroup, Spinner, Pagination } from "react-bootstrap";
import axios from 'axios';
import { headers } from '../../utils/headers';
import { safeParse } from '../../utils/safeParse';

type MaterialData = {
    id: string | number;
    name: string;
    shop_name: string;
    brand: string;
    file_name: string;
    pdf_url: string;
    staff: string; // ← 型定義にstaffを追加
};
type StringList = Record<string, string>;

const CompetitorMaterials = () => {
    const [materials, setMaterials] = useState<MaterialData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [brandList, setBrandList] = useState<string[]>([]);
    const [shopList, setShopList] = useState<StringList[]>([]);
    const [customerList, setCustomerList] = useState<StringList[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;
    const [showSuggestions, setShowSuggestions] = useState(false);

    const safeValue = (value: string | undefined | null) => {
        return value ?? '';
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: "competitor_pdf" }, { headers });
                setShopList(response.data.shop.filter((s: any) => s.show_flag === 1).map((s: any) => ({ shop: s.shop, brand: s.brand })));
                const targetIdArray = response.data.pdf
                    .filter((p: any) => safeParse(p.pdf_path).length > 0)
                    .map((p: any) => p.id);
                const targetCustomer = response.data.customer.filter((c: any) => targetIdArray.includes(c.id));
                const brandArray: string[] = response.data.shop.filter((s: any) => s.show_flag === 1).map((s: any) => s.brand);
                setBrandList([...new Set(brandArray)]);
                setCustomerList(targetCustomer);

                const pdfData = response.data.pdf
                    .filter((p: any) => safeParse(p.pdf_path).length > 0)
                    .flatMap((p: any) => {
                        const pdfList = safeParse(p.pdf_path);
                        const customer = targetCustomer.find((t: any) => t.id === p.id);
                        const brandValue = response.data.shop.find((s: any) => s.shop === safeValue(customer?.in_charge_store));
                        return pdfList.map((a: any) => ({
                            id: p.id + '_' + a.path, // 重複回避のためのユニークキー生成
                            pdf_url: a.path,
                            file_name: a.name,
                            staff: a.staff ?? '', // 担当者
                            shop_name: safeValue(customer?.in_charge_store),
                            name: safeValue(customer?.customer_contacts_name),
                            brand: safeValue(brandValue?.brand)
                        }));
                    });

                console.log(pdfData);
                setMaterials(pdfData);
                setIsLoading(false);

            } catch (err) {
                console.error(err);
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // 検索フィルター（ブランド、店舗、担当者で検索可能に拡張しました）
    const filteredMaterials = materials.filter(material =>
        material.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        material.staff.toLowerCase().includes(searchQuery.toLowerCase()) // 担当者名でも検索可能に！
    );

    const totalPages = Math.ceil(filteredMaterials.length / itemsPerPage);
    const paginatedMaterials = filteredMaterials.slice(
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

    return (
        <div className="p-3 bg-light d-flex flex-column" style={{ fontSize: '0.8rem', minHeight: '100vh' }}>

            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center mb-3 gap-3">

                <h5 className="fw-bold text-secondary mb-0 text-center text-lg-start">
                    <i className="fa-solid fa-file-pdf me-2 text-danger"></i>他社資料一覧
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
                    <div style={{ width: '250px', position: 'relative' }}>
                        <InputGroup size="sm" className="shadow-sm">
                            <InputGroup.Text className="bg-white border-end-0">
                                <i className="fa-solid fa-magnifying-glass text-muted"></i>
                            </InputGroup.Text>
                            <Form.Control
                                type="text"
                                placeholder="ブランド・店舗・担当者で検索..."
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
                                {brandList
                                    .filter(b => b.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .map((brand, idx) => (
                                        <div
                                            key={idx}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                setSearchQuery(brand);
                                                setShowSuggestions(false);
                                            }}
                                            className="text-truncate text-dark"
                                            style={{ padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer', borderBottom: '1px solid #f8f9fa' }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            {brand}
                                        </div>
                                    ))
                                }
                                {brandList.filter(b => b.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                    <div className="text-muted" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
                                        該当するブランドがありません
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="d-flex justify-content-center align-items-center py-5 text-secondary flex-grow-1">
                    <Spinner animation="border" size="sm" className="me-2" /> 読み込み中...
                </div>
            ) : filteredMaterials.length === 0 ? (
                <div className="text-center py-5 text-muted bg-white shadow-sm rounded flex-grow-1">
                    該当する資料がありません
                </div>
            ) : (
                <div className="table-responsive shadow-sm rounded bg-white mb-4">
                    <Table hover className="align-middle mb-0" style={{ fontSize: '0.8rem' }}>
                        <thead className="table-light text-secondary text-nowrap">
                            <tr>
                                <th className="fw-normal py-2" style={{ width: '5%' }}>No</th>
                                <th className="fw-normal py-2 text-center" style={{ width: '5%' }}>ファイル</th>
                                <th className="fw-normal py-2" style={{ width: '10%' }}>ブランド</th>
                                <th className="fw-normal py-2" style={{ width: '15%' }}>担当者</th>
                                <th className="fw-normal py-2" style={{ width: '15%' }}>お客様名</th>
                                <th className="fw-normal py-2" style={{ width: '10%' }}>店舗名</th>
                                <th className="fw-normal py-2" style={{ width: '30%' }}>ファイル名</th>
                                <th className="fw-normal text-center py-2" style={{ width: '10%' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedMaterials.map((material, index) => (
                                <tr key={material.id}>
                                    <td className="py-2">
                                        <span className="text-muted">
                                            {(currentPage - 1) * itemsPerPage + index + 1}
                                        </span>
                                    </td>

                                    <td className="py-2 text-center">
                                        <a
                                            href={`https://khg-marketing.info/dashboard/api/gateway/handlers${String(material.pdf_url)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-decoration-none"
                                        >
                                            <i
                                                className="fa-solid fa-file-pdf text-danger"
                                                style={{ fontSize: '1.5rem', cursor: 'pointer', transition: 'opacity 0.2s' }}
                                                onMouseOver={(e) => e.currentTarget.style.opacity = '0.7'}
                                                onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                                                title="PDFを開く"
                                            ></i>
                                        </a>
                                    </td>

                                    <td className="py-2 fw-bold text-dark">
                                        {material.brand}
                                    </td>

                                    <td className="py-2">
                                        <div className="d-flex align-items-center">
                                            <i className="fa-solid fa-user-circle text-muted me-2" style={{ fontSize: '1.2em' }}></i>
                                            <span className="text-dark fw-medium">{material.staff || '-'}</span>
                                        </div>
                                    </td>

                                                                        <td className="py-2">
                                        <div className="d-flex align-items-center">
                                            <i className="fa-solid fa-user-circle text-muted me-2" style={{ fontSize: '1.2em' }}></i>
                                            <span className="text-dark fw-medium">{`${material.name} 様` || '-'}</span>
                                        </div>
                                    </td>

                                    <td className="py-2">
                                        <Badge bg="light" text="dark" className="border fw-normal">
                                            <i className="fa-solid fa-store me-1 text-muted"></i>
                                            {material.shop_name}
                                        </Badge>
                                    </td>

                                    <td className="py-2 text-truncate" style={{ maxWidth: '300px' }}>
                                        {material.file_name}
                                    </td>

                                    <td className="py-2 text-center">
                                        <Button
                                            variant="outline-danger"
                                            size="sm"
                                            href={`https://khg-marketing.info/dashboard/api/gateway/handlers${String(material.pdf_url)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-2 shadow-sm text-nowrap"
                                            style={{ fontSize: '0.75rem' }}
                                        >
                                            表示 <i className="fa-solid fa-arrow-up-right-from-square ms-1"></i>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default CompetitorMaterials;