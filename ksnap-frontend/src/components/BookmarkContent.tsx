import React, { useEffect, useState } from "react";
import { FullScreenModal } from "./FullScreenModal";
import { IMAGE_BASE_URL } from '../config';

// 型定義はそのまま
type Photo = {
    id: string,
    image: string,
    note: string,
    url: string,
    detail: string,
    plan: string,
    pref: string,
    town: string,
    brand: string,
    category: string,
    shop: string,
    created_at: string,
    tag: string[]
};
type SearchList = {
    id: string[];
    image: string;
    note: string;
    url: string;
    detail: string[];
    plan: string[];
    large: string;
    pref: string;
    town: string;
    brand: string;
    event: boolean;
    category: string[];
    shop: string;
    staff: string;
    tag: string[];
    owner: string;
};

type Props = {
    filteredPhotoList: Photo[],
    setMainCategory: React.Dispatch<React.SetStateAction<string>>,
    mainCategory: string,
    setSearchList: React.Dispatch<React.SetStateAction<SearchList>>,
    customerData: Record<string, string>,
    setCustomerData: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    handleBookmark: (id: string) => void
}

const BookmarkContent = ({
    filteredPhotoList,
    setMainCategory,
    mainCategory,
    setSearchList,
    customerData,
    setCustomerData,
    handleBookmark
}: Props) => {
    const [targetId, setTargetId] = useState('');
    const [fullImg, setFullImg] = useState('');
    const [bookmarkList, setBookmarkList] = useState<Photo[]>([]);

    useEffect(() => {
        const filtered = customerData.bookmark ? customerData.bookmark.split(',') : [];
        console.log(filteredPhotoList.filter(f => filtered.includes(f.id)))

        const found = bookmarkList.find(f => f.id === targetId);
        if (found) {
            const targetView = document.getElementById(targetId);
            if (targetView) {
                targetView.scrollIntoView({ 'behavior': 'instant', 'block': 'start' });
            }
        }

        setBookmarkList(filteredPhotoList.filter(f => filtered.includes(f.id)));
    }, [mainCategory, targetId, filteredPhotoList, customerData]);

    return (
        <div className="container mainContent">

            {/* ▼ ギャラリー表示 (mainCategory === 'bookmark') ▼ */}
            {mainCategory === 'bookmark' && (
                <div className="row g-2 g-md-3">
                    {/* ブックマークが0件の場合の親切な表示 */}
                    {bookmarkList.length === 0 && (
                        <div className="col-12 text-center py-5 text-secondary">
                            <i className="fa-regular fa-bookmark mb-3" style={{ fontSize: '3rem', color: '#dee2e6' }}></i>
                            <p>お気に入りに登録された写真はありません</p>
                        </div>
                    )}

                    {bookmarkList.map((photo) => (
                        <div className="col-4 col-sm-3 col-md-4 col-lg-3" key={photo.id}>
                            <div
                                style={{
                                    aspectRatio: '1 / 1',
                                    overflow: 'hidden',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    position: 'relative'
                                }}
                                onClick={() => {
                                    const newimageArray = customerData.image ? customerData.image.split(',') : [];
                                    newimageArray.push(photo.id);
                                    setTargetId(photo.id);
                                    setMainCategory('focus_bookmark');
                                    setCustomerData(prev => ({
                                        ...prev,
                                        image: newimageArray.join(',')
                                    }));
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                            >
                                <img
                                    src={`${IMAGE_BASE_URL}/${photo.image}`}
                                    alt={photo.note}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ▼ タイムライン表示 (mainCategory === 'focus_bookmark') ▼ */}
            {mainCategory === 'focus_bookmark' && (
                <div className="row justify-content-center">
                    <div className="col-12 col-md-8 col-lg-6">
                        {bookmarkList.map((item) => (
                            <div
                                key={item.id}
                                id={item.id}
                                className="card mb-5 border-0 shadow-sm"
                                style={{ borderRadius: '16px', overflow: 'hidden' }}
                            >
                                {/* 画像エリア */}
                                <div className="position-relative" style={{ backgroundColor: '#f8f9fa' }}>
                                    <img
                                        src={`${IMAGE_BASE_URL}/${item.image}`}
                                        alt={item.note}
                                        style={{ width: '100%', maxHeight: '600px', objectFit: 'cover', cursor: 'pointer' }}
                                        onClick={() => setFullImg(item.image)}
                                    />
                                    {item.pref && (
                                        <div
                                            className="position-absolute shadow-sm"
                                            style={{
                                                bottom: '12px', right: '12px',
                                                backgroundColor: 'rgba(255,255,255,0.9)',
                                                padding: '4px 12px',
                                                borderRadius: '50px',
                                                fontSize: '0.8rem',
                                                fontWeight: '600',
                                                color: '#2b3a55'
                                            }}
                                        >
                                            <i className="fa-solid fa-location-dot me-1 text-danger"></i>
                                            {item.pref}{item.town}
                                        </div>
                                    )}
                                </div>

                                {/* テキスト・アクションエリア */}
                                <div className="card-body p-3 p-md-4">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <h6 className="fw-bold mb-0" style={{ color: '#2b3a55', lineHeight: '1.4' }}>
                                            {item.brand} {item.category}
                                        </h6>
                                        <button
                                            className="btn btn-link p-0 text-decoration-none"
                                            onClick={() => handleBookmark(item.id)}
                                            style={{ color: (customerData.bookmark ?? '').includes(item.id) ? '#2b3a55' : '#adb5bd', fontSize: '1.4rem' }}
                                        >
                                            <i className={`${(customerData.bookmark ?? '').includes(item.id) ? 'fa-solid' : 'fa-regular'} fa-bookmark`}></i>
                                        </button>
                                    </div>

                                    {item.url && (
                                        <span
                                            className="d-inline-block mb-2"
                                            style={{ backgroundColor: '#e3f2fd', color: '#0d47a1', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '4px', fontWeight: 'bold' }}
                                        >
                                            見学可
                                        </span>
                                    )}

                                    {item.note && (
                                        <p className="card-text mb-3 text-secondary" style={{ fontSize: '0.95rem' }}>
                                            {item.note}
                                        </p>
                                    )}

                                    {item.tag && item.tag.length > 0 && (
                                        <div className="d-flex flex-wrap gap-2 mb-3">
                                            {item.tag.map((t, tIndex) => (
                                                <span
                                                    key={tIndex}
                                                    style={{ color: '#0d6efd', cursor: 'pointer', fontSize: '0.9rem' }}
                                                    onClick={() => {
                                                        setSearchList({
                                                            id: [],
                                                            image: '',
                                                            note: '',
                                                            url: '',
                                                            large: '',
                                                            pref: '',
                                                            town: '',
                                                            brand: '',
                                                            event: false,
                                                            shop: '',
                                                            staff: '',
                                                            detail: [],
                                                            plan: [],
                                                            category: [],
                                                            tag: [t],
                                                            owner: ''
                                                        });
                                                        setMainCategory('main'); // タグ検索時は通常一覧に戻す
                                                    }}
                                                >
                                                    #{t}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {item.url && (
                                        <button
                                            className="btn w-100 fw-bold py-2 mt-2"
                                            style={{ backgroundColor: '#2b3a55', color: '#fff', borderRadius: '8px' }}
                                        >
                                            見学予約をする
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <FullScreenModal fullImg={fullImg} setFullImg={setFullImg} />
        </div>
    );
};

export default BookmarkContent;