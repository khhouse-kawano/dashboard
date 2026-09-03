import { useState, useEffect, useRef } from 'react';
import { Form as BsForm, Button, Row, Col, Badge, Card } from 'react-bootstrap';
import { areaList } from './AreaList';
import axios from 'axios';
import { tagList } from './TagList';
import { API_BASE, API_HEADERS, IMAGE_BASE_URL } from '../config';

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
    staff: string
};

type Props = {
    editId: string,
    setEditId: React.Dispatch<React.SetStateAction<string>>
}

// 画像リサイズ用のユーティリティ関数（維持）
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

const Form = ({ editId, setEditId }: Props) => {
    const [form, setForm] = useState<PostData>({
        id: '', detail: '', category: '', plan: '', pref: '', town: '',
        brand: '', shop: '', note: '', tag: [], image: null, url: '', staff: ''
    });
    const [towns, setTowns] = useState<string[]>([]);
    const [shops, setShops] = useState<string[]>([]);
    const [suggest, setSuggest] = useState<string[]>([]);
    const [suggestWord, setSuggestWord] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);
    const [preview, setPreview] = useState<string | null>(null);


    const isMobile = window.innerWidth <= 768;

    useEffect(() => {
        if (!editId) return;
        const fetchData = async () => {
            const response = await axios.post(API_BASE, { request: 'k-snap_load', id: editId }, { headers: API_HEADERS });
            const snapData = response.data.snap;
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
                staff: snapData.staff ?? ''
            });
            loadImageFromServer(snapData.image);
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
            const res = await axios.post<{ brand: string, shop: string }[]>(API_BASE, { request: 'shop_list' }, { headers: API_HEADERS });
            const targetBrand = brandMapping[form.brand as keyof typeof brandMapping];
            const filteredShoos = res.data.filter(r => r.brand === targetBrand).map(r => r.shop);
            setShops(filteredShoos);
        }
        form.brand ? fetchData() : setShops([]);
    }, [form]);

    const urlToFile = async (url: string, filename: string): Promise<File> => {
        const res = await fetch(url);
        const blob = await res.blob();
        return new File([blob], filename, { type: blob.type });
    };

    const loadImageFromServer = async (imageName: string) => {
        const url = `${IMAGE_BASE_URL}/${imageName}`;
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

    useEffect(() => {
        const suggestList = tagList.filter(t => suggestWord ? t.label.includes(suggestWord) || t.word.includes(suggestWord) : false).map(t => t.label);
        setSuggest(suggestList);
    }, [suggestWord]);

    const handleSubmit = async () => {
        if (!form.image || !form.detail || form.tag.length === 0) {
            alert('必須項目を入力してください');
            return;
        }
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

        try {
            // ⚠️ multipart なので API_HEADERS を付けない。
            //   Content-Type: application/json が boundary を壊し、
            //   サーバー側で $_FILES が空になる。
            const response = await axios.post(API_BASE, fd);
            if (response.data.status === 'success') {
                setForm({
                    id: '', detail: '', category: '', plan: '', pref: '', town: '',
                    brand: '', shop: '', note: '', tag: [], image: null, url: '', staff: ''
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
        
    };

    return (
        <div style={{ width: "100%", maxWidth: editId ? "100%" : "800px", margin: "0 auto", paddingTop: editId ? '0px' : '60px', paddingBottom: '60px' }}>

            {/* 新規登録時のみ上部に見出しを表示 */}
            {!editId && <h3 className="mb-4 fw-bold text-dark"><i className="fa-solid fa-camera-retro me-2 text-success"></i>スナップ新規登録</h3>}

            <Card className="p-4 shadow-sm border-0 bg-white">
                <BsForm>
                    {/* 1. 写真選択 */}
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

                    {/* 2. タグ */}
                    <BsForm.Group as={Row} className="mb-4 align-items-start">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">
                            タグ <Badge bg="danger" className="ms-1" style={{ fontSize: '10px' }}>必須</Badge>
                        </BsForm.Label>
                        <Col sm={9}>
                            <div className="position-relative">
                                <BsForm.Control
                                    type='text' placeholder="キーワードを入力してタグを検索..." value={suggestWord}
                                    onChange={(e) => setSuggestWord(e.target.value)}
                                />
                                {suggest.length > 0 && (
                                    <Card className="position-absolute shadow-lg border mt-1 w-100" style={{ zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
                                        <Card.Body className="p-1">
                                            {suggest.map((item, index) => (
                                                <div
                                                    key={index} className="p-2 rounded bg-hover" style={{ cursor: 'pointer', fontSize: '13px' }}
                                                    onClick={() => {
                                                        setSuggestWord('');
                                                        if (!form.tag.includes(item)) {
                                                            setForm(prev => ({ ...prev, tag: [...prev.tag, item] }));
                                                        }
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    #{item}
                                                </div>
                                            ))}
                                        </Card.Body>
                                    </Card>
                                )}
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

                    {/* 3. カテゴリー1 (内観・外観) */}
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
                                                className={`py-2.5 border rounded-3 text-center fw-bold text-nowrap`}
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

                    {/* 4. カテゴリー2 */}
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

                    {/* 5. 階数 */}
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

                    {/* 6. 都道府県 */}
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

                    {/* 7. 市町村 */}
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

                    {/* 8. ブランド */}
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

                    {/* 9. 店舗 */}
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

                    {/* 10. URL */}
                    <BsForm.Group as={Row} className="mb-4">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">URL</BsForm.Label>
                        <Col sm={9}>
                            <BsForm.Control
                                as="textarea" rows={2} placeholder="https://..." value={form.url}
                                onChange={(e) => setForm(prev => ({ ...prev, url: e.target.value }))}
                            />
                        </Col>
                    </BsForm.Group>

                    {/* 11. キャプション */}
                    <BsForm.Group as={Row} className="mb-4">
                        <BsForm.Label column sm={3} className="fw-bold text-secondary">キャプション</BsForm.Label>
                        <Col sm={9}>
                            <BsForm.Control
                                as="textarea" rows={4} placeholder="スナップの紹介文や備考を入力..." value={form.note}
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