import React, { useState, useEffect, useRef, useContext } from 'react';
import { Form as BsForm, Button, Row, Col, Badge, Card } from 'react-bootstrap';
import { areaList } from './AreaList';
import axios from 'axios';
import { tagList } from './TagList';
import AuthContext from '../../context/AuthContext';
import apiClient from '../../utils/apiClient';
import { ksnapImageUrl } from '../../utils/ksnapImage';

/**
 * 画像アップロード（multipart）の送信先。
 *
 * ⚠️ apiClient は使えない。既定ヘッダの Content-Type: application/json が
 *   multipart の boundary を壊し、サーバー側で $_FILES が空になる。
 *
 * ⚠️ 2026-09-03 に k-snap/api/ から dashboard の API へ移した。
 *   apiClient と同じ baseURL を使うことで、環境ごとの向き先が1箇所で決まる。
 */
const KSNAP_API = process.env.REACT_APP_XSERVER_API ?? '';

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
    /**
     * 選択された写真。
     *
     * ⚠️ 新規登録では複数枚を指定できる。タグ以下の入力内容は共通で、
     *   1枚ごとに1レコードを作る（バックエンドが1枚ずつしか受け取れないため）。
     *
     * ⚠️ 編集時（editId あり）は1枚に固定する。1レコードの更新なので
     *   複数枚を指定しても意味が成立しない。
     */
    images: File[],
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
        brand: '', shop: '', note: '', tag: [], images: [], url: '', staff: '', owner: '', staff_show: 1,
        ownerLastName: '', ownerFirstName: ''
    });
    const [towns, setTowns] = useState<string[]>([]);
    const [shops, setShops] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropRef = useRef<HTMLDivElement>(null);
    /**
     * プレビュー用のURL。images と同じ順序で持つ。
     *
     * ⚠️ createObjectURL で作ったURLは、破棄しないとページを閉じるまで
     *   メモリを保持し続ける。取り消し時と差し替え時に revokeObjectURL する。
     */
    const [previews, setPreviews] = useState<string[]>([]);
    /** 連続送信の進捗。null なら送信していない */
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [submitError, setSubmitError] = useState<string>('');
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
            const response = await apiClient.post('', { request: 'k-snap_load', id: editId });
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
                    // ⚠️ 直後の loadImageFromServer が既存画像を入れる
                    images: [],
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
            const res = await apiClient.post<{ brand: string, shop: string }[]>('', { request: 'shop_list' });
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
        const url = ksnapImageUrl(imageName);
        const file = await urlToFile(url, imageName);
        // ⚠️ サーバー上の画像は既に縮小済みなのでリサイズしない
        await handleFiles([file], true);
    };

    const VALID_TYPES = ['image/jpeg', 'image/png'];

    /**
     * 選択された画像を追加する。
     *
     * ⚠️ 編集時は1枚に置き換える。追加ではない。
     *   1レコードの更新なので、複数枚を持つと「どれを保存するか」が決まらない。
     *
     * ⚠️ リサイズは1枚ずつ順番に行う。同時に走らせると、
     *   高解像度の写真を10枚選んだときに canvas がメモリを食い潰す。
     */
    const handleFiles = async (files: File[], skipResize: boolean = false) => {
        if (files.length === 0) return;

        const targets = editId ? files.slice(0, 1) : files;
        const processed: File[] = [];
        for (const file of targets) {
            processed.push(skipResize ? file : await resizeImage(file));
        }

        const urls = processed.map(f => URL.createObjectURL(f));

        setPreviews(prev => {
            if (editId) {
                prev.forEach(url => URL.revokeObjectURL(url));
                return urls;
            }
            return [...prev, ...urls];
        });
        setForm(prev => ({
            ...prev,
            images: editId ? processed : [...prev.images, ...processed],
        }));
    };

    /** 拡張子が対象外のものを弾く。1枚も残らなければ知らせる */
    const filterValid = (files: File[]): File[] => {
        const valid = files.filter(f => VALID_TYPES.includes(f.type));
        if (valid.length !== files.length) {
            alert(`JPGまたはPNG形式以外の${files.length - valid.length}件を除外しました。`);
        }
        return valid;
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const files = filterValid(Array.from(e.dataTransfer.files));
        void handleFiles(files);
    };

    const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = filterValid(Array.from(e.target.files ?? []));
        void handleFiles(files);
        // 同じファイルを選び直せるようにする（value が同一だと change が起きない）
        e.target.value = '';
    };

    /** 選択を1枚取り消す */
    const removeImage = (index: number) => {
        setPreviews(prev => {
            URL.revokeObjectURL(prev[index]);
            return prev.filter((_, i) => i !== index);
        });
        setForm(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
    };

    const clearImages = () => {
        previews.forEach(url => URL.revokeObjectURL(url));
        setPreviews([]);
        setForm(prev => ({ ...prev, images: [] }));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    /**
     * 登録・更新。
     *
     * ⚠️ バックエンド（k-snap_update）は**1リクエストにつき1枚**しか受け取れない。
     *   複数枚のときは1枚ずつ順番に送り、タグ以下の入力内容は全リクエストで共通にする。
     *
     * ⚠️ **途中で失敗しても巻き戻せない。** 3枚目で失敗したら1〜2枚目は登録済みで残る。
     *   どこまで成功したかを必ず利用者に伝えること。黙って止まると、
     *   同じ写真を選び直して重複が生まれる。
     *
     * ⚠️ 並列送信にしないこと。何枚目で失敗したかが分からなくなる。
     */
    const handleSubmit = async () => {
        setSubmitError('');

        if (form.images.length === 0 || !form.detail || form.tag.length === 0) {
            alert('必須項目を入力してください');
            return;
        }

        const finalOwnerName = `${form.shop || '店舗未定'}_${form.ownerLastName || ''}_${form.ownerFirstName || ''}_様邸`;
        const total = form.images.length;
        let done = 0;

        setProgress({ done: 0, total });

        try {
            for (const image of form.images) {
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
                fd.append('image', image);
                fd.append('request', 'k-snap_update');
                fd.append('staff', userName);
                fd.append('owner', finalOwnerName);
                fd.append('staff_show', String(form.staff_show));

                // ⚠️ multipart は apiClient を通さない。既定ヘッダの
                //   Content-Type: application/json が boundary を壊すため。
                //   URL は k-snap/api/ から dashboard の API へ移した。
                const response = await axios.post(KSNAP_API, fd);

                if (response.data.status !== 'success') {
                    throw new Error(response.data.message ?? 'サーバーがエラーを返しました');
                }

                done += 1;
                setProgress({ done, total });
            }
        } catch (err) {
            console.error(err);
            setProgress(null);
            setSubmitError(
                total === 1
                    ? '登録に失敗しました。時間をおいて再度お試しください。'
                    : `${done + 1}枚目の登録に失敗しました。${done}枚目までは登録済みです。`
                        + `残りの${total - done}枚だけを選び直して登録してください（同じ写真を再登録すると重複します）。`
            );
            return;
        }

        setProgress(null);
        setForm({
            id: '', detail: '', category: '', plan: '', pref: '', town: '',
            brand: '', shop: '', note: '', tag: [], images: [], url: '', staff: '', owner: '', staff_show: 1, ownerLastName: '', ownerFirstName: ''
        });
        clearImages();
        setEditId('');
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
                            {!editId && (
                                <span className="d-block text-muted fw-normal mt-1" style={{ fontSize: '11px' }}>
                                    複数まとめて選べます
                                </span>
                            )}
                        </BsForm.Label>
                        <Col sm={9}>
                            {/* ⚠️ 編集時は1枚だけ。選択済みなら領域を隠す */}
                            {(!editId || form.images.length === 0) && (
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
                                        {isMobile
                                            ? (editId ? 'タップして写真を選択' : 'タップして写真を選択（複数可）')
                                            : (editId
                                                ? 'ここに写真をドラッグ ＆ ドロップ、またはクリックして選択'
                                                : 'ここに写真をドラッグ ＆ ドロップ、またはクリックして選択（複数可）')}
                                    </span>
                                    {!editId && form.images.length > 0 && (
                                        <span className="d-block text-success fw-bold mt-2" style={{ fontSize: '12px' }}>
                                            追加で選択できます
                                        </span>
                                    )}
                                </div>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                multiple={!editId}
                                ref={fileInputRef}
                                onChange={handleSelect}
                                style={{ display: "none" }}
                            />

                            {form.images.length > 0 && (
                                <>
                                    <div className="d-flex align-items-center justify-content-between mt-2 mb-1">
                                        <span className="fw-bold text-dark" style={{ fontSize: '12px' }}>
                                            選択中 {form.images.length} 枚
                                            {!editId && form.images.length > 1 && (
                                                <span className="text-muted fw-normal ms-2">
                                                    以下の入力内容が全ての写真に反映されます
                                                </span>
                                            )}
                                        </span>
                                        <Button variant="outline-secondary" size="sm" style={{ fontSize: '11px' }} onClick={clearImages}>
                                            すべて取り消す
                                        </Button>
                                    </div>

                                    {/* 1枚のときは大きく、複数のときはサムネイルを並べる */}
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: form.images.length === 1
                                                ? '1fr'
                                                : 'repeat(auto-fill, minmax(120px, 1fr))',
                                            gap: '8px',
                                        }}
                                    >
                                        {previews.map((url, index) => (
                                            <div
                                                key={url}
                                                className="position-relative border rounded-3 overflow-hidden shadow-sm bg-light"
                                            >
                                                <Button
                                                    variant="danger" size="sm"
                                                    className="position-absolute rounded-circle d-flex justify-content-center align-items-center shadow p-0"
                                                    style={{ right: '6px', top: '6px', width: '24px', height: '24px', zIndex: 10, border: '2px solid white' }}
                                                    onClick={() => removeImage(index)}
                                                    title="この写真を取り消す"
                                                >
                                                    <i className="fa-solid fa-xmark" style={{ fontSize: '11px' }}></i>
                                                </Button>
                                                <img
                                                    src={url}
                                                    style={{
                                                        width: '100%',
                                                        maxHeight: form.images.length === 1 ? '380px' : '120px',
                                                        objectFit: form.images.length === 1 ? 'contain' : 'cover',
                                                        display: 'block',
                                                    }}
                                                    alt={`preview ${index + 1}`}
                                                />
                                                {form.images.length > 1 && (
                                                    <span
                                                        className="position-absolute bg-dark bg-opacity-75 text-white px-1"
                                                        style={{ left: '4px', bottom: '4px', fontSize: '10px', borderRadius: '3px' }}
                                                    >
                                                        {index + 1}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
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

                    {/* ⚠️ 部分成功を必ず知らせる。黙って止まると同じ写真を再登録して重複する */}
                    {submitError !== '' && (
                        <div className="alert alert-danger mt-4 mb-0" style={{ fontSize: '13px' }}>
                            <i className="fa-solid fa-triangle-exclamation me-2"></i>
                            {submitError}
                        </div>
                    )}

                    <div className="text-center mt-5">
                        <Button
                            variant="success" size="lg" className="rounded-pill px-5 fw-bold shadow-sm"
                            style={{ width: '100%', maxWidth: '340px', letterSpacing: '1px' }}
                            onClick={() => void handleSubmit()}
                            disabled={progress !== null}
                        >
                            {progress !== null
                                ? `登録中… ${progress.done} / ${progress.total} 枚`
                                : editId
                                    ? '掲載情報を更新する'
                                    : form.images.length > 1
                                        ? `${form.images.length}枚のスナップ写真を登録する`
                                        : 'スナップ写真を登録する'}
                        </Button>

                        {progress !== null && progress.total > 1 && (
                            <div className="text-muted mt-2" style={{ fontSize: '12px' }}>
                                ⚠️ 画面を閉じずにお待ちください
                            </div>
                        )}
                    </div>
                </BsForm>
            </Card>
        </div>
    );
};

export default Form;