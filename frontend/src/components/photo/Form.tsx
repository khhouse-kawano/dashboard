import React, { useState, useEffect, useRef, useContext } from 'react';
import { Form as BsForm, Button, Row, Col, Badge, Card } from 'react-bootstrap';
import { areaList } from './AreaList';
import axios from 'axios';
import { tagList } from './TagList';
import AuthContext from '../../context/AuthContext';

type PostData = {
    id: string,
    detail: string,
    category: string,
    plan: string,
    pref: string,
    town: string,
    brand: string,
    shop: string,
    note: string,
    tag: string[],
    image: File | null,
    url: string,
    staff: string,
    owner: string,
    staff_show: number,
    ownerLastName: string,
    ownerFirstName: string
};

type Props = {
    editId: string,
    setEditId: React.Dispatch<React.SetStateAction<string>>,
    setCategory: React.Dispatch<React.SetStateAction<string>>,
    category: string
}

const resizeImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
        const MAX_SIZE = 1920;
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > MAX_SIZE || height > MAX_SIZE) {
                    if (width > height) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    } else {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                } else {
                    resolve(file);
                    return;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);
                }
                canvas.toBlob((blob) => {
                    if (blob) {
                        const newFile = new File([blob], file.name, { type: file.type });
                        resolve(newFile);
                    } else {
                        resolve(file);
                    }
                }, file.type, 0.85);
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

const Form = ({ editId, setEditId, setCategory, category }: Props) => {
    const [form, setForm] = useState<PostData>({
        id: '', detail: '', category: '', plan: '', pref: '', town: '',
        brand: '', shop: '', note: '', tag: [], image: null, url: '', staff: '', owner: '', staff_show: 1,
        ownerLastName: '', ownerFirstName: ''
    });
    const [towns, setTowns] = useState<string[]>([]);
    const [shops, setShops] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const { userName } = useContext(AuthContext);
    const [ownerList, setOwnerList] = useState<{ original: string, shop: string, lastName: string, firstName: string }[]>([]);
    const [showOwnerSuggest, setShowOwnerSuggest] = useState(false);
    const headers = {
        Authorization: "4081Kokubu",
        "Content-Type": "application/json",
    };

    const isMobile = window.innerWidth <= 768;

    useEffect(() => {
        const fetchData = async () => {
            const response = await axios.post('https://khg-marketing.info/k-snap/api/', { request: 'k-snap_load', id: editId }, { headers });
            const snapData = response.data.snap;

            if (editId) {
                let initLastName = '';
                let initFirstName = '';
                if (snapData.owner) {
                    const parts = String(snapData.owner).split('_');
                    if (parts.length >= 3) {
                        initLastName = parts[1]; // 姓
                        initFirstName = parts[2]; // 名
                    } else {
                        initLastName = snapData.owner;
                    }
                }

                setForm({
                    id: snapData.id ?? '',
                    detail: snapData.detail ?? '',
                    category: snapData.category ?? '',
                    plan: snapData.plan ?? '',
                    pref: snapData.pref ?? '',
                    town: snapData.town ?? '',
                    brand: snapData.brand ?? '',
                    shop: snapData.shop ?? '',
                    note: snapData.note ?? '',
                    tag: JSON.parse(snapData.tag) ?? [],
                    image: null,
                    url: snapData.url ?? '',
                    staff: snapData.staff ?? '',
                    owner: snapData.owner ?? '',
                    ownerLastName: initLastName,
                    ownerFirstName: initFirstName,
                    staff_show: snapData.staff_show !== undefined ? Number(snapData.staff_show) : 1
                });
                loadImageFromServer(snapData.image);
            }

            // 💡 変更点: DBから取得した全オーナーリストをオブジェクト形式で作成（重複排除）
            const ownerMap = new Map();
            response.data.owner.forEach((o: any) => {
                if (o.owner && !ownerMap.has(o.owner)) {
                    const parts = String(o.owner).split('_');
                    let shop = '';
                    let lastName = '';
                    let firstName = '';

                    if (parts.length >= 3) {
                        shop = parts[0];
                        lastName = parts[1];
                        firstName = parts[2];
                    } else {
                        lastName = o.owner; // フォーマット外のものはそのまま
                    }

                    if (lastName) {
                        ownerMap.set(o.owner, {
                            original: o.owner,
                            shop: shop,
                            lastName: lastName,
                            firstName: firstName
                        });
                    }
                }
            });

            setOwnerList(Array.from(ownerMap.values()));
        };
        fetchData();
    }, [editId]);

    useEffect(() => {
        const filteredTowns = areaList[form.pref];
        form.pref ? setTowns(filteredTowns) : setTowns([]);

        const brandMapping = {
            '国分ハウジング': 'KH', 'デイジャストハウス': 'DJH', 'なごみ工務店': 'なごみ',
            'ニーエルホーム': '2L', 'ジャスフィーホーム': 'JH', 'PG HOUSE': 'PGH'
        } as const;
        const fetchData = async () => {
            const res = await axios.post<{ brand: string, shop: string }[]>("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers });
            const targetBrand = brandMapping[form.brand as keyof typeof brandMapping];
            const filteredShoos = res.data.filter(r => r.brand === targetBrand).map(r => r.shop);
            setShops(filteredShoos);
        }
        form.brand ? fetchData() : setShops([]);
    }, [form.pref, form.brand]);

    const urlToFile = async (url: string, filename: string): Promise<File> => {
        const res = await fetch(url);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type });
    };

    const loadImageFromServer = async (imageName: string) => {
        const url = `https://khg-marketing.info/k-snap/images/${imageName}`;
        const file = await urlToFile(url, imageName);
        handleFile(file, true);
    };

    const handleFile = async (file: File, skipResize: boolean = false) => {
        const targetFile = skipResize ? file : await resizeImage(file);
        const url = URL.createObjectURL(targetFile);
        setPreview(url);
        setForm(prev => ({ ...prev, image: targetFile }));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            const validTypes = ['image/jpeg', 'image/png'];
            if (!validTypes.includes(file.type)) {
                alert('JPGまたはPNG形式の画像を選択してください。');
                return;
            }
            handleFile(file);
        }
    };

    const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const validTypes = ['image/jpeg', 'image/png'];
            if (!validTypes.includes(file.type)) {
                alert('JPGまたはPNG形式の画像を選択してください。');
                e.target.value = '';
                return;
            }
            handleFile(file);
        }
    };

    const handleSubmit = async () => {
        if (!form.image || !form.detail || form.tag.length === 0) {
            alert('必須項目を入力してください');
            return;
        }
        const finalOwnerName = `${form.shop || '店舗未定'}_${form.ownerLastName || ''}_${form.ownerFirstName || ''}_様邸`;
        const fd = new FormData();
        fd.append('id', form.id);
        fd.append('detail', form.detail);
        fd.append('category', form.category);
        fd.append('plan', form.plan);
        fd.append('pref', form.pref);
        fd.append('town', form.town);
        fd.append('brand', form.brand);
        fd.append('shop', form.shop);
        fd.append('note', form.note);
        fd.append('tag', JSON.stringify(form.tag));
        fd.append('image', form.image);
        fd.append('request', 'k-snap_update');
        fd.append('staff', userName);
        fd.append('owner', finalOwnerName);
        fd.append('staff_show', String(form.staff_show)); // 追加

        try {
            const response = await axios.post('https://khg-marketing.info/k-snap/api/', fd);
            if (response.data.status === 'success') {
                setForm({
                    id: '', detail: '', category: '', plan: '', pref: '', town: '',
                    brand: '', shop: '', note: '', tag: [], image: null, url: '', staff: '', owner: '', staff_show: 1, ownerLastName: '', ownerFirstName: ''
                });
                setPreview(null);
                setEditId('');
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        } catch (err) {
            console.error(err);
        }

        setCategory('edit');
    };


    return (
        <div style={{ width: "100%", maxWidth: editId ? "100%" : "800px", margin: "0 auto", paddingTop: editId ? '0px' : '60px', paddingBottom: '60px' }}>
            {!editId && <h3 className="mb-4 fw-bold text-dark" style={{ fontSize: '20px' }}><i className="fa-solid fa-camera-retro me-2 text-success"></i>新規登録</h3>}
            <Card className="p-4 shadow-sm border-0 bg-white">
                <BsForm>
                    <BsForm.Group as={Row} className="mb-4 align-items-start">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">
                            写真を選択 <Badge bg="danger" className="ms-1" style={{ fontSize: '10px' }}>必須</Badge>
                        </BsForm.Label>
                        <Col sm={9}>
                            {!form.image && (
                                <div
                                    ref={dropRef}
                                    onDrop={handleDrop}
                                    onDragOver={(e) => e.preventDefault()}
                                    className="border border-2 border-dashed rounded-3 p-4 text-center bg-light text-muted"
                                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                                    onClick={() => fileInputRef.current?.click()}
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#198754'}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#ced4da'}
                                >
                                    <div className="fs-2 mb-2 text-secondary"><i className="fa-solid fa-cloud-arrow-up"></i></div>
                                    <span className="fw-bold" style={{ fontSize: '13px' }}>
                                        {isMobile ? 'タップして写真を選択' : 'ここに写真をドラッグ ＆ ドロップ、またはクリックして選択'}
                                    </span>
                                </div>
                            )}
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleSelect} style={{ display: "none" }} />

                            {preview && (
                                <div className="position-relative border rounded-3 overflow-hidden shadow-sm mt-2 bg-light" style={{ maxWidth: '100%' }}>
                                    <Button
                                        variant="danger" size="sm" className="position-absolute rounded-circle d-flex justify-content-center align-items-center shadow"
                                        style={{ right: '12px', top: '12px', width: '28px', height: '28px', zIndex: 10, border: '2px solid white' }}
                                        onClick={() => {
                                            setPreview(null);
                                            setForm(prev => ({ ...prev, image: null }));
                                            if (fileInputRef.current) fileInputRef.current.value = "";
                                        }}
                                    >
                                        <i className="fa-solid fa-xmark"></i>
                                    </Button>
                                    <img src={preview} style={{ width: '100%', maxHeight: '380px', objectFit: 'contain' }} alt="preview" />
                                </div>
                            )}
                        </Col>
                    </BsForm.Group>

                    {/* 💡 2. タグ: セレクトボックスに変更 */}
                    <BsForm.Group as={Row} className="mb-4 align-items-start">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">
                            タグ <Badge bg="danger" className="ms-1" style={{ fontSize: '10px' }}>必須</Badge>
                        </BsForm.Label>
                        <Col sm={9}>
                            <div className="position-relative">
                                <BsForm.Select
                                    onChange={(e) => {
                                        const selectedTag = e.target.value;
                                        if (selectedTag && !form.tag.includes(selectedTag)) {
                                            setForm(prev => ({ ...prev, tag: [...prev.tag, selectedTag] }));
                                        }
                                        // 選択後はプレースホルダーに戻す
                                        e.target.value = "";
                                    }}
                                >
                                    <option value="">タグを選択してください...</option>
                                    {tagList.map((t, index) => (
                                        <option key={index} value={t.label}>{t.label}</option>
                                    ))}
                                </BsForm.Select>
                            </div>
                            {form.tag.length > 0 && (
                                <div className="d-flex flex-wrap gap-2 mt-2">
                                    {form.tag.map((item, index) => (
                                        <Badge key={index} bg="success" className="bg-opacity-10 text-success border border-success border-opacity-25 px-2.5 py-2 fs-6 fw-normal d-flex align-items-center gap-1">
                                            #{item}
                                            <span
                                                style={{ cursor: 'pointer', fontSize: '16px', marginLeft: '4px', lineHeight: 1 }}
                                                onClick={() => setForm(prev => ({ ...prev, tag: prev.tag.filter(t => t !== item) }))}
                                            >
                                                &times;
                                            </span>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </Col>
                    </BsForm.Group>

                    <BsForm.Group as={Row} className="mb-4 align-items-center">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">
                            カテゴリー1 <Badge bg="danger" className="ms-1" style={{ fontSize: '10px' }}>必須</Badge>
                        </BsForm.Label>
                        <Col sm={9}>
                            <Row className="g-2">
                                {['内観', '外観'].map((item, index) => {
                                    const isSelected = form.detail === item;
                                    return (
                                        <Col xs={6} key={index}>
                                            <div
                                                className={`py-1 border rounded-3 text-center fw-bold text-nowrap`}
                                                style={{
                                                    cursor: 'pointer', fontSize: '14px', transition: 'all 0.15s',
                                                    backgroundColor: isSelected ? '#198754' : '#fff',
                                                    color: isSelected ? '#fff' : '#6c757d',
                                                    borderColor: isSelected ? '#198754' : '#dee2e6'
                                                }}
                                                onClick={() => setForm(prev => ({ ...prev, detail: prev.detail === item ? '' : item }))}
                                            >
                                                {item}
                                            </div>
                                        </Col>
                                    );
                                })}
                            </Row>
                        </Col>
                    </BsForm.Group>

                    <BsForm.Group as={Row} className="mb-4 align-items-center">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">カテゴリー2</BsForm.Label>
                        <Col sm={9}>
                            <Row className="g-2">
                                {['施工事例', 'オーナーズハウス', '完成見学会', 'モデルハウス'].map((item, index) => {
                                    const isSelected = form.category === item;
                                    return (
                                        <Col xs={6} sm={3} key={index}>
                                            <div
                                                className={`py-2 border rounded-3 text-center fw-bold`}
                                                style={{
                                                    cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s',
                                                    backgroundColor: isSelected ? '#198754' : '#fff',
                                                    color: isSelected ? '#fff' : '#6c757d',
                                                    borderColor: isSelected ? '#198754' : '#dee2e6'
                                                }}
                                                onClick={() => setForm(prev => ({ ...prev, category: prev.category === item ? '' : item }))}
                                            >
                                                {item}
                                            </div>
                                        </Col>
                                    );
                                })}
                            </Row>
                        </Col>
                    </BsForm.Group>

                    <BsForm.Group as={Row} className="mb-4 align-items-center">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">階数</BsForm.Label>
                        <Col sm={9}>
                            <Row className="g-2">
                                {['平屋', '2階建て', '3階建て', 'その他'].map((item, index) => {
                                    const isSelected = form.plan === item;
                                    return (
                                        <Col xs={6} sm={3} key={index}>
                                            <div
                                                className={`py-2 border rounded-3 text-center fw-bold`}
                                                style={{
                                                    cursor: 'pointer', fontSize: '13px', transition: 'all 0.15s',
                                                    backgroundColor: isSelected ? '#198754' : '#fff',
                                                    color: isSelected ? '#fff' : '#6c757d',
                                                    borderColor: isSelected ? '#198754' : '#dee2e6'
                                                }}
                                                onClick={() => setForm(prev => ({ ...prev, plan: prev.plan === item ? '' : item }))}
                                            >
                                                {item}
                                            </div>
                                        </Col>
                                    );
                                })}
                            </Row>
                        </Col>
                    </BsForm.Group>

                    <BsForm.Group as={Row} className="mb-4 align-items-center">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">都道府県</BsForm.Label>
                        <Col sm={9}>
                            <Row className="g-2">
                                {['鹿児島県', '宮崎県', '熊本県', '大分県', '佐賀県'].map((item, index) => {
                                    const isSelected = form.pref === item;
                                    return (
                                        <Col xs={4} sm key={index}>
                                            <div
                                                className={`py-2 border rounded-3 text-center fw-bold`}
                                                style={{
                                                    cursor: 'pointer', fontSize: '12px', transition: 'all 0.15s',
                                                    backgroundColor: isSelected ? '#198754' : '#fff',
                                                    color: isSelected ? '#fff' : '#6c757d',
                                                    borderColor: isSelected ? '#198754' : '#dee2e6'
                                                }}
                                                onClick={() => setForm(prev => ({ ...prev, pref: prev.pref === item ? '' : item }))}
                                            >
                                                {item.replace('県', '')}
                                            </div>
                                        </Col>
                                    );
                                })}
                            </Row>
                        </Col>
                    </BsForm.Group>

                    <BsForm.Group as={Row} className="mb-4">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">市町村</BsForm.Label>
                        <Col sm={9}>
                            <BsForm.Select
                                value={form.town}
                                onChange={(e) => setForm(prev => ({ ...prev, town: e.target.value }))}
                            >
                                <option value="">{towns.length === 0 ? "⚠️ 都道府県を先に選択してください" : "市町村を選択してください"}</option>
                                {towns.map((item, index) => <option key={index} value={item}>{item}</option>)}
                            </BsForm.Select>
                        </Col>
                    </BsForm.Group>

                    <BsForm.Group as={Row} className="mb-4 align-items-center">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">ブランド</BsForm.Label>
                        <Col sm={9}>
                            <Row className="g-2">
                                {['国分ハウジング', 'デイジャストハウス', 'なごみ工務店', 'ニーエルホーム', 'ジャスフィーホーム', 'PG HOUSE', '中古住宅専門店'].map((item, index) => {
                                    const isSelected = form.brand === item;
                                    return (
                                        <Col xs={6} sm={4} key={index}>
                                            <div
                                                className={`py-2 border rounded-3 text-center fw-bold`}
                                                style={{
                                                    cursor: 'pointer', fontSize: '11px', transition: 'all 0.15s',
                                                    backgroundColor: isSelected ? '#198754' : '#fff',
                                                    color: isSelected ? '#fff' : '#6c757d',
                                                    borderColor: isSelected ? '#198754' : '#dee2e6'
                                                }}
                                                onClick={() => setForm(prev => ({ ...prev, brand: prev.brand === item ? '' : item }))}
                                            >
                                                {item}
                                            </div>
                                        </Col>
                                    );
                                })}
                            </Row>
                        </Col>
                    </BsForm.Group>

                    <BsForm.Group as={Row} className="mb-4">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">店舗</BsForm.Label>
                        <Col sm={9}>
                            <BsForm.Select
                                value={form.shop}
                                onChange={(e) => setForm(prev => ({ ...prev, shop: e.target.value }))}
                            >
                                <option value="">{shops.length === 0 ? "⚠️ ブランドを先に選択してください" : "店舗を選択してください"}</option>
                                {shops.map((item, index) => <option key={index} value={item}>{item}</option>)}
                            </BsForm.Select>
                        </Col>
                    </BsForm.Group>

                    <BsForm.Group as={Row} className="mb-4">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">オーナー名</BsForm.Label>
                        <Col sm={9}>
                            <div className="mb-2">
                                <Button
                                    variant="outline-success"
                                    size="sm"
                                    onClick={() => setShowOwnerSuggest(!showOwnerSuggest)}
                                    className="d-flex align-items-center gap-1"
                                >
                                    <i className="fa-solid fa-list"></i> 登録済みのオーナーから選択
                                </Button>
                            </div>

                            {/*  選択リスト（ボタン押下時に展開） */}
                            {showOwnerSuggest && ownerList.length > 0 && (
                                <Card className="mb-3 shadow-sm border-success overflow-hidden">
                                    <div className="bg-success bg-opacity-10 px-3 py-2 text-success fw-bold" style={{ fontSize: '13px' }}>
                                        登録済みオーナー一覧
                                    </div>
                                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                        {ownerList.map((item, index) => (
                                            <div
                                                key={index}
                                                className="px-3 py-2 border-bottom text-dark d-flex align-items-center"
                                                style={{ cursor: 'pointer', fontSize: '14px', transition: 'background-color 0.15s' }}
                                                onClick={() => {
                                                    setForm(prev => ({
                                                        ...prev,
                                                        ownerLastName: item.lastName,
                                                        ownerFirstName: item.firstName,
                                                        shop: item.shop ? item.shop : prev.shop
                                                    }));
                                                    setShowOwnerSuggest(false);
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                {/* 同姓同名を区別しやすいように店舗名もバッジで表示 */}
                                                {item.shop && <Badge bg="secondary" className="me-2 fw-normal">{item.shop}</Badge>}
                                                {item.lastName} {item.firstName} <span className="text-muted ms-1">様邸</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            )}

                            {/* 手入力用フィールド（選択時は自動で値が入る） */}
                            <Row className="g-2">
                                <Col xs={6}>
                                    <BsForm.Control
                                        type="text"
                                        placeholder="姓 (例: 山田)"
                                        value={form.ownerLastName || ''}
                                        onChange={(e) => setForm(prev => ({ ...prev, ownerLastName: e.target.value }))}
                                    />
                                </Col>
                                <Col xs={6}>
                                    <BsForm.Control
                                        type="text"
                                        placeholder="名 (例: 太郎)"
                                        value={form.ownerFirstName || ''}
                                        onChange={(e) => setForm(prev => ({ ...prev, ownerFirstName: e.target.value }))}
                                    />
                                </Col>
                            </Row>

                            {/* 実際の登録データのプレビュー */}
                            {(form.shop || form.ownerLastName || form.ownerFirstName) && (
                                <div className="mt-2 text-muted" style={{ fontSize: '12px' }}>
                                    <span className="fw-bold">登録フォーマット: </span>
                                    {form.shop ? form.shop : '【店舗未選択】'}_{form.ownerLastName ? form.ownerLastName : '【姓】'}_{form.ownerFirstName ? form.ownerFirstName : '【名】'}_様邸
                                </div>
                            )}
                        </Col>
                    </BsForm.Group>

                    {/* 営業名の表示切り替え */}
                    <BsForm.Group as={Row} className="mb-4 align-items-center">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">営業名表示</BsForm.Label>
                        <Col sm={9}>
                            <div className="d-flex align-items-center">
                                <BsForm.Check
                                    type="switch"
                                    id="staff-show-switch"
                                    checked={form.staff_show === 1}
                                    onChange={(e) => setForm(prev => ({ ...prev, staff_show: e.target.checked ? 1 : 0 }))}
                                    className="me-2"
                                />
                                <span className={form.staff_show === 1 ? "text-dark" : "text-muted"} style={{ fontSize: '13px' }}>
                                    {form.staff_show === 1 ? "表示する" : "表示しない"}
                                </span>
                            </div>
                        </Col>
                    </BsForm.Group>

                    <BsForm.Group as={Row} className="mb-4">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">URL</BsForm.Label>
                        <Col sm={9}>
                            <BsForm.Control
                                as="textarea" rows={2} placeholder="https://..." value={form.url}
                                onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
                            />
                        </Col>
                    </BsForm.Group>

                    <BsForm.Group as={Row} className="mb-4">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">エコカラット</BsForm.Label>
                        <Col sm={9}>
                            <BsForm.Control
                                as="textarea" rows={4} placeholder="固有名詞は必ず全角カタカナで入力。例1)×LIXIL 〇リクシル 例2)×ｴｺｶﾗｯﾄ 〇エコカラット" value={form.note}
                                onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
                            />
                        </Col>
                    </BsForm.Group>

                    <div className="text-center mt-5">
                        <Button
                            variant="success" size="lg" className="rounded-pill px-5 fw-bold shadow-sm"
                            style={{ width: '100%', maxWidth: '340px', letterSpacing: '1px' }}
                            onClick={() => handleSubmit()}
                        >
                            {editId ? '掲載情報を更新する' : 'スナップ写真を登録する'}
                        </Button>
                    </div>
                </BsForm>
            </Card>
        </div>
    );
};

export default Form;