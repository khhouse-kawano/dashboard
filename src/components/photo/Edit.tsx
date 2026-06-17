import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Table, Modal, Form as BsForm, Row, Col, Badge, Pagination, Card } from 'react-bootstrap';
import Form from './Form';

type DisplayData = {
    id: string;
    detail: string;
    category: string;
    plan: string;
    pref: string;
    town: string;
    brand: string;
    shop: string;
    note: string;
    tag: string[];
    image: string;
    show_snap: number;
    created_at: string;
    url: string;
    staff: string;
    staff_show: number;
    owner: string;
};

type Search = Record<string, string>;

type Props = {
    editId: string;
    setEditId: React.Dispatch<React.SetStateAction<string>>;
    setCategory: React.Dispatch<React.SetStateAction<string>>,
    category: string
};

export const Edit = ({ editId, setEditId, setCategory, category }: Props) => {
    const [list, setList] = useState<DisplayData[]>([]);
    const [originalList, setOriginalList] = useState<DisplayData[]>([]);
    const [hoverId, setHoverId] = useState('');
    const [activePage, setActivePage] = useState(1);
    const [showLength, setShowLength] = useState(10);
    const [search, setSearch] = useState<Search>({});

    const headers = {
        Authorization: "4081Kokubu",
        "Content-Type": "application/json",
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.post('https://khg-marketing.info/k-snap/api/', { request: 'k-snap_edit' }, { headers });
                const safeData: DisplayData[] = (response.data.snaps || [])
                    .sort((a: any, b: any) => b.id - a.id)
                    .map((item: any) => {
                        let parsedTag: string[] = [];
                        try {
                            const tmp = JSON.parse(item.tag);
                            if (Array.isArray(tmp) && tmp.every(t => typeof t === "string")) {
                                parsedTag = tmp;
                            }
                        } catch (e) {
                            // JSON.parse エラー時は空配列
                        }

                        return {
                            id: item.id,
                            detail: item.detail,
                            category: item.category,
                            plan: item.plan,
                            pref: item.pref,
                            town: item.town,
                            brand: item.brand,
                            shop: item.shop,
                            note: item.note,
                            tag: parsedTag,
                            image: item.image,
                            show_snap: Number(item.show_snap),
                            created_at: item.created_at,
                            url: item.url,
                            staff: item.staff,
                            staff_show: Number(item.staff_show),
                            owner: item.owner
                        };
                    });
                setOriginalList(safeData);
                const ownerArray = response.data.owner;
            } catch (error) {
                console.error("データ取得に失敗しました", error);
            }
        };
        if (editId === '') {
            fetchData();
        }
    }, [editId, category]);

    useEffect(() => {
        const filtered = originalList.filter(o => {
            const matchStaff = search.staff ? o.staff.includes(search.staff) : true;
            const matchShop = search.shop ? o.shop.includes(search.shop) : true;
            return matchStaff && matchShop;
        });
        setList(filtered);
        setActivePage(1);
    }, [originalList, search]);

    const handleSlice = (array: DisplayData[], page: number) => {
        return array.slice((page - 1) * showLength, page * showLength);
    };

    const PagingLink = () => {
        const totalPage = Math.ceil(list.length / showLength);
        if (totalPage <= 1) return null;

        const maxVisiblePages = 10;

        let startPage = Math.max(1, activePage - Math.floor(maxVisiblePages / 2));
        let endPage = startPage + maxVisiblePages - 1;

        if (endPage > totalPage) {
            endPage = totalPage;
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        let items: React.ReactNode[] = [];
        for (let number = startPage; number <= endPage; number++) {
            items.push(
                <Pagination.Item
                    key={number}
                    active={number === activePage}
                    onClick={() => setActivePage(number)}
                >
                    {number}
                </Pagination.Item>
            );
        }

        return <Pagination size="sm" className="mb-0">{items}</Pagination>;
    };

    const startCount = list.length === 0 ? 0 : (activePage - 1) * showLength + 1;
    const endCount = Math.min(activePage * showLength, list.length);

    const handleShow = async (id: string, flag: number, key: string) => {
        if (!id) return;
        try {
            const fetchData = async () => {
                const response = await axios.post('https://khg-marketing.info/k-snap/api/', { request: 'k-snap_show', id, flag, key }, { headers });
                console.log(response.data.status);
            };
            fetchData();
        } catch (err) {
            alert('通信に失敗');
            setList(prev => prev.map(v => v.id === id ? { ...v, [key]: flag ? 0 : 1 } : v));
        }
    };

    return (
        <>
            <div style={{ width: "95%", maxWidth: "800px", margin: "0 auto", paddingTop: '60px', paddingBottom: '60px' }}>
                <Card className="p-3 mb-4 shadow-sm border-0 bg-light">
                    <Row className="g-2 align-items-center mb-3">
                        <Col xs={12} sm="auto" className="d-flex align-items-center">
                            <span className="text-muted me-2" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>表示件数</span>
                            <BsForm.Select
                                size="sm"
                                style={{ width: '95px' }}
                                onChange={(e) => setShowLength(Number(e.target.value))}
                            >
                                <option value="10">10件</option>
                                <option value="20">20件</option>
                                <option value="50">50件</option>
                                <option value="100">100件</option>
                            </BsForm.Select>
                        </Col>
                        <Col xs={6} sm>
                            <BsForm.Control
                                size="sm"
                                placeholder="営業名で検索"
                                onChange={(e) => setSearch(prev => ({ ...prev, staff: e.target.value }))}
                            />
                        </Col>
                        <Col xs={6} sm>
                            <BsForm.Control
                                size="sm"
                                placeholder="店舗名で検索"
                                onChange={(e) => setSearch(prev => ({ ...prev, shop: e.target.value }))}
                            />
                        </Col>
                    </Row>

                    <div className="d-flex flex-wrap justify-content-start align-items-center pt-2.5 gap-2" style={{ fontSize: '12px' }}>
                        <div className="text-muted fw-bold me-2">
                            全 {list.length} 件中 {startCount} 〜 {endCount} 件を表示
                        </div>
                        <div className="d-flex justify-content-end">
                            <PagingLink />
                        </div>
                    </div>
                </Card>

                <Table responsive borderless className="align-middle">
                    <thead>
                        <tr className="text-secondary border-bottom" style={{ fontSize: '12px' }}>
                            <th style={{ width: '140px' }} className="text-center">操作 / 状態</th>
                            <th>スナップ詳細情報</th>
                        </tr>
                    </thead>
                    {handleSlice(list, activePage).map((item) => (
                        <tbody key={item.id} className="border-bottom" style={{ transition: 'background-color 0.2s' }}>
                            <tr>
                                <td className="text-center py-3 bg-transparent">
                                    <button
                                        className="btn btn-success btn-sm rounded-pill px-3 mb-2 w-100"
                                        style={{ fontSize: '11px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(25,135,84,0.2)' }}
                                        onClick={() => setEditId(item.id)}
                                    >
                                        <i className="fa-solid fa-pen-to-square me-1"></i>編集する
                                    </button>

                                    <div className="d-flex flex-column align-items-center mt-2">
                                        <span className="text-muted mb-1" style={{ fontSize: '10px', fontWeight: 'bold' }}>
                                            {item.show_snap === 1 ? "● 表示中" : "✕ 非表示"}
                                        </span>
                                        <BsForm.Check
                                            type="switch"
                                            id={`switch-${item.id}`}
                                            checked={item.show_snap === 1}
                                            onChange={() => {
                                                const newFlag = item.show_snap === 1 ? 0 : 1;
                                                setList(prev => prev.map(v => v.id === item.id ? { ...v, show_snap: v.show_snap ? 0 : 1 } : v));
                                                handleShow(item.id, newFlag, 'show_snap');
                                            }}
                                        />
                                    </div>
                                </td>

                                <td className="py-3 bg-transparent">
                                    <Row className="g-3">
                                        <Col xs={12} md={4} className="d-flex justify-content-center align-items-start">
                                            {item.image ? (
                                                <div
                                                    className="overflow-hidden rounded-3 shadow-sm"
                                                    style={{
                                                        width: '100%',
                                                        maxWidth: '160px',
                                                        aspectRatio: '4/3',
                                                        cursor: 'pointer',
                                                        transition: 'transform 0.2s, box-shadow 0.2s',
                                                        transform: hoverId === item.id ? 'scale(1.03)' : 'scale(1)',
                                                        boxShadow: hoverId === item.id ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
                                                    }}
                                                    onClick={() => setEditId(item.id)}
                                                    onMouseEnter={() => setHoverId(item.id)}
                                                    onMouseLeave={() => setHoverId('')}
                                                >
                                                    <img
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        src={`https://khg-marketing.info/k-snap/images/${item.image.replace(/^\//, "")}`}
                                                        alt="snap"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="bg-light rounded-3 d-flex align-items-center justify-content-center text-muted" style={{ width: '100%', maxWidth: '160px', aspectRatio: '4/3', fontSize: '11px' }}>
                                                    No Image
                                                </div>
                                            )}
                                        </Col>

                                        <Col xs={12} md={8}>
                                            <div className="text-muted mb-2 d-flex flex-wrap gap-2" style={{ fontSize: '11px' }}>
                                                <span><i className="fa-solid fa-calendar-days me-1"></i>{item.created_at}</span>
                                                <span className="text-dark fw-bold"><i className="fa-solid fa-user me-1"></i>{item.staff || '未設定'}</span>
                                                <span className="text-muted mb-1" style={{ fontSize: '10px', fontWeight: 'bold' }}>
                                                    {item.staff_show === 1 ? "● 営業名表示" : "✕ 営業名非表示"}
                                                </span>
                                                <BsForm.Check
                                                    type="switch"
                                                    id={`switch-${item.id}`}
                                                    checked={item.staff_show === 1}
                                                    onChange={() => {
                                                        const newFlag = item.staff_show === 1 ? 0 : 1;
                                                        setList(prev => prev.map(v => v.id === item.id ? { ...v, staff_show: v.staff_show ? 0 : 1 } : v));
                                                        handleShow(item.id, newFlag, 'staff_show');
                                                    }}
                                                />
                                            </div>

                                            {item.tag.length > 0 && (
                                                <div className="mb-2 d-flex flex-wrap gap-1">
                                                    {item.tag.map((t, tIndex) => (
                                                        <Badge key={tIndex} bg="secondary" className="bg-opacity-10 text-secondary border border-secondary border-opacity-25" style={{ fontSize: '10px', fontWeight: 'normal' }}>
                                                            #{t}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}

                                            <p className="mb-2 text-dark" style={{ fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                                {item.detail}
                                            </p>

                                            <div className="d-flex flex-wrap gap-1 mt-2 text-secondary" style={{ fontSize: '11px' }}>
                                                {/* ▼ 追加: ownerが存在する場合に「○○様邸」と目立つバッジで表示 */}
                                                {item.owner && (
                                                    <Badge bg="primary" className="bg-opacity-10 text-primary border border-primary border-opacity-25">
                                                        <i className="fa-solid fa-house me-1"></i>{item.owner}
                                                    </Badge>
                                                )}

                                                {item.shop && <Badge bg="light" text="dark" className="border">{item.shop}</Badge>}
                                                {item.category && <Badge bg="light" text="muted" className="border">{item.category}</Badge>}
                                                {item.plan && <Badge bg="light" text="muted" className="border">{item.plan}</Badge>}
                                                {(item.pref || item.town) && <Badge bg="light" text="muted" className="border"><i className="fa-solid fa-location-dot me-1"></i>{item.pref}{item.town}</Badge>}
                                            </div>

                                            {item.note && (
                                                <div className="mt-2 p-2 bg-light rounded text-muted" style={{ fontSize: '11px', borderLeft: '3px solid #dee2e6' }}>
                                                    <strong>備考:</strong> {item.note}
                                                </div>
                                            )}
                                        </Col>
                                    </Row>
                                </td>
                            </tr>
                        </tbody>
                    ))}
                </Table>

                {list.length > showLength && (
                    <div className="d-flex flex-wrap justify-content-start align-items-center mt-4 px-2 gap-2" style={{ fontSize: '12px' }}>
                        <div className="text-muted fw-bold me-2">
                            全 {list.length} 件中 {startCount} 〜 {endCount} 件を表示
                        </div>
                        <div>
                            <PagingLink />
                        </div>
                    </div>
                )}
            </div>

            <Modal show={!!editId} onHide={() => setEditId('')} size='lg' centered>
                <Modal.Header closeButton className="border-0 pb-0"></Modal.Header>
                <Modal.Body className="pt-0">
                    <Form editId={editId} setEditId={setEditId} setCategory={setCategory} category={category} />
                </Modal.Body>
            </Modal>
        </>
    );
};

export default Edit;