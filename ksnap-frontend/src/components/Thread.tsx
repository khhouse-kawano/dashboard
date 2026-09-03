import React, { useEffect, useState, useRef } from "react";
import { FullScreenModal } from "./FullScreenModal";
import { Virtuoso, VirtuosoGrid, type VirtuosoHandle } from 'react-virtuoso';
import { IMAGE_BASE_URL } from '../config';

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
    tag: string[],
    staff: string,
    staff_show: number,
    owner: string
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

type CustomerData = Record<string, string>;

type ThreadProps = {
    filteredPhotoList: Photo[],
    setMainCategory: React.Dispatch<React.SetStateAction<string>>,
    mainCategory: string,
    searchList: SearchList,
    setSearchList: React.Dispatch<React.SetStateAction<SearchList>>,
    customerData: CustomerData,
    setCustomerData: React.Dispatch<React.SetStateAction<CustomerData>>,
    handleBookmark: (id: string) => void,
    priorityTags: string[],
    setPriorityTags: React.Dispatch<React.SetStateAction<string[]>>,
    handleNavigate: (value: string) => void,
    viewCount: number,
    setViewCount: React.Dispatch<React.SetStateAction<number>>,
    isSp: boolean,
    initialize: () => void
}

type FocusCardProps = {
    item: Photo;
    customerData: CustomerData;
    setCustomerData: React.Dispatch<React.SetStateAction<CustomerData>>;
    handleBookmark: (id: string) => void;
    priorityTags: string[];
    searchList: SearchList;
    settingTag: (tag: string) => void;
    setFullImg: React.Dispatch<React.SetStateAction<string>>;
    viewCount: number;
    setViewCount: React.Dispatch<React.SetStateAction<number>>;
    handleNavigate: (value: string) => void;
    setSearchList: React.Dispatch<React.SetStateAction<SearchList>>;
    initialize: () => void
};

const FocusCard = ({
    item,
    customerData,
    setCustomerData,
    handleBookmark,
    priorityTags,
    searchList,
    settingTag,
    setFullImg,
    viewCount,
    setViewCount,
    handleNavigate,
    setSearchList,
    initialize
}: FocusCardProps) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [hasCount, setHasCount] = useState(false);

    const MAX_VIEWS = 30;
    const isLimitReached = !customerData.id && viewCount >= MAX_VIEWS;
    const hasViewed = localStorage.getItem('snapLog')?.includes(item.id);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isCountedRef = useRef(false);
    const hasDeepViewedRef = useRef(false);

    const safeParseArray = (data: any): any[] => {
        if (typeof data !== 'string' || data.trim() === '') {
            return [];
        }

        try {
            const parsed = JSON.parse(data);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error("JSONの解析に失敗しました。不正なデータです:", data);
            return [];
        }
    };

    useEffect(() => {
        const prevLogStr = localStorage.getItem('snapLog');
        const prevLog = prevLogStr ? prevLogStr.split(',') : [];
        const hasViewedFromStorage = prevLog.includes(item.id);

        if (hasCount || hasViewedFromStorage) {
            isCountedRef.current = true;
        }

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {

                if (!isCountedRef.current && !isLimitReached) {
                    isCountedRef.current = true;
                    setHasCount(true);

                    const currentLogStr = localStorage.getItem('snapLog');
                    const currentLog = currentLogStr ? currentLogStr.split(',') : [];
                    if (!currentLog.includes(item.id)) {
                        currentLog.push(item.id);
                        localStorage.setItem('snapLog', currentLog.join(','));
                    }

                    setViewCount((prev: number) => {
                        const newCount = prev + 1;
                        localStorage.setItem('view', String(newCount));
                        return newCount;
                    });
                }

                if (!hasDeepViewedRef.current) {
                    timerRef.current = setTimeout(() => {
                        hasDeepViewedRef.current = true;

                        const now = new Date();
                        const pad = (n: any) => String(n).padStart(2, "0");

                        const nowData = {
                            time: `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
                            img: item.id
                        };

                        setCustomerData((prev: any) => {
                            const currentLog = safeParseArray(prev.log);
                            const newLog = [...currentLog, nowData];

                            return {
                                ...prev,
                                log: JSON.stringify(newLog)
                            };
                        });

                        if (cardRef.current) observer.unobserve(cardRef.current);
                    }, 2000);
                }

            } else {
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                }
            }
        }, { threshold: 0.5 });

        if (cardRef.current) observer.observe(cardRef.current);

        return () => {
            if (cardRef.current) observer.unobserve(cardRef.current);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [isLimitReached, setViewCount, item.id]);

    const settingOwner = (owner: string) => {
        initialize();
        setSearchList((prev: SearchList) => ({
            ...prev,
            owner
        }));
        handleNavigate('main');
    };

    return (
        <div
            ref={cardRef}
            id={item.id}
            className="card mb-5 border-0 shadow-sm"
            style={{ borderRadius: '16px', overflow: 'hidden' }}
        >
            {/* ⭐ 修正ポイント: 画像の「箱」のサイズをCSSで完全に固定化（正方形） */}
            <div 
                className="position-relative w-100" 
                style={{ 
                    backgroundColor: '#f8f9fa',
                    aspectRatio: '1 / 1',  /* 縦横比を1:1に固定（スマホでもPCでも確実に高さを確保） */
                    maxHeight: '600px',    /* PCなど大画面で大きくなりすぎるのを防ぐ */
                    overflow: 'hidden'
                }}
            >
                <img
                    src={`${IMAGE_BASE_URL}/${item.image}`}
                    alt={item.note}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover', /* 箱に合わせて画像をトリミング */
                        cursor: isLimitReached && !hasCount && !hasViewed ? 'not-allowed' : 'pointer',
                        filter: isLimitReached && !hasCount && !hasViewed ? 'blur(6px) brightness(0.9)' : 'none',
                        transform: isLimitReached && !hasCount && !hasViewed ? 'scale(1.05)' : 'scale(1)',
                        transition: 'filter 0.3s ease, transform 0.3s ease'
                    }}
                    onClick={() => {
                        if (isLimitReached && !hasCount && !hasViewed) return;

                        const prevPath = customerData.path ? customerData.path.split(',') : [];
                        const newPath = prevPath.includes(item.id) ? prevPath : [...prevPath, item.id]
                        setCustomerData((prev: any) => ({
                            ...prev,
                            path: newPath.join(',')
                        }))
                        setFullImg(item.image);
                    }}
                />
                
                {isLimitReached && !hasCount && !hasViewed && (
                    <div
                        className="position-absolute w-100 h-100 d-flex flex-column justify-content-center align-items-center"
                        style={{ top: 0, left: 0, backgroundColor: 'rgba(255,255,255,0.2)', zIndex: 10, pointerEvents: 'none' }}
                    >
                        <div
                            className="bg-dark text-white px-4 py-2 rounded-pill shadow"
                            style={{ fontWeight: 'bold', pointerEvents: 'auto', cursor: 'pointer' }}
                            onClick={() => handleNavigate('')}
                        >
                            <i className="fa-solid fa-lock me-2"></i>ログインして続きを閲覧
                        </div>
                    </div>
                )}

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
                            color: '#2b3a55',
                            zIndex: 11
                        }}
                    >
                        <i className="fa-solid fa-location-dot me-1 text-danger"></i>
                        {item.pref}{item.town}
                    </div>
                )}
            </div>

            <div className="card-body p-3 p-md-4">
                <div className="d-flex justify-content-between align-items-start mb-2">
                    <h6 className="fw-bold mb-0" style={{ color: '#2b3a55', lineHeight: '1.4' }}>
                        {item.brand} <span className="text-primary" style={{ textDecoration: 'underline', cursor: 'pointer' }}
                            onClick={() => {
                                initialize();
                                setSearchList((prev: SearchList) => ({
                                    ...prev,
                                    category: [item.category]
                                }));
                                handleNavigate('main');
                            }}
                        >{item.category}</span>
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
                    <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
                        {item.tag.map((t: string, tIndex: number) => {
                            const isPriority = priorityTags.includes(t);
                            const isSearched = searchList.tag.includes(t);
                            return (
                                <span
                                    key={tIndex}
                                    style={{
                                        color: '#0d6efd',
                                        cursor: 'pointer',
                                        fontSize: isPriority || isSearched ? '1rem' : '0.9rem',
                                        fontWeight: isPriority || isSearched ? '600' : '400'
                                    }}
                                    onClick={() => settingTag(t)}
                                >
                                    #{t}
                                </span>
                            )
                        })}
                    </div>
                )}

                {(item.shop || item.staff) && (
                    <div className="d-flex flex-wrap gap-3 mb-2 text-secondary" style={{ fontSize: '0.75rem' }}>
                        {item.shop && <span className="mb-0">{item.shop}</span>}
                        {item.staff_show === 1 && <span className="mb-0">担当営業: {item.staff}</span>}
                    </div>
                )}

                {item.url && (
                    <a href="https://www.ie-miru.jp/cms/yoyaku/khmiyazaki/events/126705" target="_blank" rel="noreferrer"
                        style={{ textDecoration: 'none', color: '#fff' }}>
                        <button
                            className="btn w-100 fw-bold py-2 mt-2"
                            style={{ backgroundColor: '#2b3a55', color: '#fff', borderRadius: '8px' }}
                        >
                            見学予約をする
                        </button>
                    </a>
                )}

                {item.owner && (
                    <button
                        className="btn w-100 fw-bold py-2 mt-2"
                        style={{
                            backgroundColor: '#fff',
                            color: '#2b3a55',
                            border: '2px solid #2b3a55',
                            borderRadius: '8px'
                        }}
                        onClick={() => {
                            settingOwner(item.owner);
                        }}
                    >
                        このご自宅を見る
                    </button>
                )}
            </div>
        </div>
    );
};

const Thread = ({
    filteredPhotoList,
    mainCategory,
    searchList,
    setSearchList,
    customerData,
    setCustomerData,
    handleBookmark,
    priorityTags,
    setPriorityTags,
    handleNavigate,
    viewCount,
    setViewCount,
    initialize
}: ThreadProps) => {
    const [targetId, setTargetId] = useState('');
    const [fullImg, setFullImg] = useState('');
    const isMember = customerData.id;

    const virtuosoRef = useRef<VirtuosoHandle>(null);

    useEffect(() => {
        const settingTags = customerData.setting ? customerData.setting.split(',') : [];
        setPriorityTags(settingTags);
    }, [customerData]);

    const targetIndex = Math.max(0, filteredPhotoList.findIndex(p => p.id === targetId));

    useEffect(() => {
        if (mainCategory === 'focus') {
            // ⭐ わずかな待機時間を設けてスクロールを確実に実行
            const timer = setTimeout(() => {
                virtuosoRef.current?.scrollToIndex({
                    index: targetIndex,
                    align: 'center',
                    behavior: 'auto'
                });
            }, 50);
            return () => clearTimeout(timer);
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }, [mainCategory, targetIndex]);

    const settingTag = (tag: string) => {
        initialize();

        setSearchList(prev => ({ ...prev, tag: [tag] }));
        handleNavigate('main');

        const prevSetting = customerData.tag ? customerData.tag.split(',') : [];
        const newSetting = [...prevSetting, tag];
        setCustomerData(prev => ({ ...prev, tag: newSetting.join(',') }));
    };

    return (
        <div className="container mainContent">
            {mainCategory === 'main' && (
                <VirtuosoGrid
                    useWindowScroll
                    data={filteredPhotoList.filter(p => p.image)}
                    listClassName="row g-2 g-md-3" 
                    itemClassName="col-4 col-sm-3 col-md-4 col-lg-3" 
                    itemContent={(index, photo) => (
                        <div
                            key={index}
                            style={{
                                aspectRatio: '1 / 1',
                                overflow: 'hidden',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                position: 'relative'
                            }}
                            onClick={() => {
                                const prevArray = customerData.path ? customerData.path.split(',') : [];
                                const newPathArray = prevArray.includes(photo.id) ? prevArray.filter(p => p !== photo.id) : [...prevArray, photo.id];
                                setTargetId(photo.id);
                                handleNavigate('focus');
                                setCustomerData(prev => ({
                                    ...prev,
                                    path: newPathArray.join(',')
                                }));
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                        >
                            <img
                                src={`${IMAGE_BASE_URL}/${photo.image}`}
                                alt={photo.note}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    filter: isMember ? 'blur(0px)' : 'blur(3px)',
                                }}
                                loading="lazy"
                                decoding="async"
                            />

                            {!isMember && <div
                                className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center text-white"
                                style={{
                                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                    zIndex: 10,
                                    pointerEvents: 'none'
                                }}
                            >
                                <i className="fa-solid fa-eye fs-2 mb-2"></i>
                                <span style={{ fontSize: 'min( 2vw, 13px)', fontWeight: 'bold' }}>
                                    タップして写真を見る
                                </span>
                            </div>}
                        </div>
                    )}
                />

            )}
            {mainCategory === 'focus' && (
                <div className="row justify-content-center">
                    <div className="col-12 col-md-8 col-lg-6">
                        <Virtuoso
                            ref={virtuosoRef}
                            useWindowScroll
                            data={filteredPhotoList}
                            itemContent={(index, item) => (
                                <FocusCard
                                    key={index}
                                    item={item}
                                    customerData={customerData}
                                    setCustomerData={setCustomerData}
                                    handleBookmark={handleBookmark}
                                    priorityTags={priorityTags}
                                    searchList={searchList}
                                    settingTag={settingTag}
                                    setFullImg={setFullImg}
                                    viewCount={viewCount}
                                    setViewCount={setViewCount}
                                    handleNavigate={handleNavigate}
                                    setSearchList={setSearchList}
                                    initialize={initialize}
                                />
                            )}
                        />

                    </div>
                </div>
            )}
            <FullScreenModal fullImg={fullImg} setFullImg={setFullImg} />
        </div>
    );
};

export default Thread;