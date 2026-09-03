import { useEffect, useState, useMemo } from "react";
import { VirtuosoGrid } from 'react-virtuoso';
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

type Props = {
    photoList: Photo[],
    filteredPhotoList: Photo[],
    setSearchList: React.Dispatch<React.SetStateAction<SearchList>>,
    customerData: Record<string, string>,
    setCustomerData: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    priorityTags: string[],
    setPriorityTags: React.Dispatch<React.SetStateAction<string[]>>,
    handleNavigate: (value: string) => void
}

const TagContent = ({ photoList, filteredPhotoList, setSearchList, customerData, setCustomerData, priorityTags, setPriorityTags, handleNavigate }: Props) => {
    const [hubList, setHubList] = useState<string[]>([]);

    const shuffledPhotoList = useMemo(() => {
        return [...photoList].sort(() => Math.random() - 0.5);
    }, [photoList]); 

    useEffect(() => {
        const filtered = filteredPhotoList.filter(f => f.image && f.id);
        if (filtered.length === 0) return;

        const tagHub = filtered
            .flatMap(f => f.tag)
            .filter(Boolean);

        const uniqueTags = [...new Set(tagHub)];

        const settingHubs = customerData.setting ? customerData.setting.split(',') : [];

        const priorityHubs = uniqueTags.filter(u => settingHubs.includes(u));
        const otherHubs = uniqueTags.filter(u => !settingHubs.includes(u));

        setPriorityTags(priorityHubs);
        setHubList([...priorityHubs, ...otherHubs]);
    }, [filteredPhotoList, customerData.setting]);

    return (
        <div className="container mainContent">
            <VirtuosoGrid
                useWindowScroll
                data={hubList}
                listClassName="row g-4"
                itemClassName="col-12 col-sm-6 col-md-4 col-lg-3 position-relative"
                itemContent={(index, hub) => {
                    // ⭐ 修正ポイント: 毎回シャッフルするのをやめ、記憶しておいたリスト（shuffledPhotoList）を使う
                    const targetList = shuffledPhotoList.filter(f => (f.image && f.id) && f.tag.includes(hub));
                    const target = targetList.slice(0, 3);
                    const isPriority = priorityTags.includes(hub);

                    return (
                        <div key={index}
                            onClick={() => {
                                const prevTag = customerData.tag ? customerData.tag.split(',') : [];
                                const newTag = [...prevTag, hub];
                                setCustomerData(prev => ({
                                    ...prev,
                                    tag: newTag.join(',')
                                }))
                            }}>
                            <div
                                className="card h-100 border-0"
                                style={{
                                    borderRadius: '16px',
                                    boxShadow: isPriority
                                        ? '0 4px 15px rgba(234, 182, 56, 0.2)'
                                        : '0 4px 12px rgba(43, 58, 85, 0.08)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    overflow: 'hidden',
                                    border: isPriority ? '2px solid #2b3a55' : '2px solid transparent'
                                }}
                                onClick={() => {
                                    handleNavigate('main');
                                    setSearchList(prev => ({
                                        ...prev,
                                        tag: [hub]
                                    }));
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = isPriority
                                        ? '0 8px 25px rgba(234, 182, 56, 0.3)'
                                        : '0 8px 24px rgba(43, 58, 85, 0.15)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = isPriority
                                        ? '0 4px 15px rgba(234, 182, 56, 0.2)'
                                        : '0 4px 12px rgba(43, 58, 85, 0.08)';
                                }}
                            >
                                {isPriority && (
                                    <div
                                        className="position-absolute"
                                        style={{
                                            top: '12px',
                                            left: '12px',
                                            zIndex: 2,
                                            backgroundColor: '#2b3a55',
                                            color: '#fff',
                                            padding: '4px 12px',
                                            borderRadius: '50px',
                                            fontSize: '0.75rem',
                                            fontWeight: 'bold',
                                            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                        }}
                                    >
                                        <i className="fa-solid fa-star me-1" style={{ color: '#eab638' }}></i>
                                        おすすめ
                                    </div>
                                )}

                                <div
                                    style={{
                                        height: '200px',
                                        backgroundColor: '#f8f9fa',
                                        display: 'grid',
                                        gap: '2px',
                                        gridTemplateColumns: '2fr 1fr',
                                        gridTemplateRows: '1fr 1fr',
                                        position: 'relative'
                                    }}
                                >
                                    <div className="position-absolute w-100 h-100" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.1), transparent 30%)', zIndex: 1, pointerEvents: 'none' }}></div>

                                    {target.map((t, tIndex) => {
                                        const isFirst = tIndex === 0;
                                        let gridPlacement = {};
                                        if (tIndex === 0) {
                                            // 1枚目: 左側全体
                                            gridPlacement = { gridColumn: '1 / 2', gridRow: '1 / 3' };
                                        } else if (tIndex === 1) {
                                            // 2枚目: 右上
                                            gridPlacement = { gridColumn: '2 / 3', gridRow: '1 / 2' };
                                        } else if (tIndex === 2) {
                                            // 3枚目: 右下
                                            gridPlacement = { gridColumn: '2 / 3', gridRow: '2 / 3' };
                                        }

                                        return (
                                            <div key={tIndex} style={{ width: '100%', height: '100%', overflow: 'hidden', ...gridPlacement }}>
                                                <img
                                                    src={`${IMAGE_BASE_URL}/${t.image}`}
                                                    alt={t.note || hub}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover',
                                                        filter: customerData.id ? 'blur(0px)' : 'blur(.5px)',
                                                        transform: isFirst ? 'scale(1)' : 'scale(1.1)',
                                                        opacity: isFirst ? '1' : '0.85',
                                                        transition: 'filter 0.3s ease'
                                                    }}
                                                    loading='lazy'
                                                    decoding='async'
                                                />
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="card-body d-flex align-items-center justify-content-between p-3" style={{ backgroundColor: isPriority ? '#fcfdfd' : '#fff' }}>
                                    <h6 className="mb-0 fw-bold text-truncate" style={{ color: '#2b3a55', maxWidth: '65%' }}>
                                        #{hub}
                                    </h6>
                                    <span
                                        className="d-inline-flex align-items-center"
                                        style={{
                                            fontSize: '0.75rem',
                                            backgroundColor: isPriority ? '#2b3a55' : '#f0f2f5',
                                            color: isPriority ? '#ffffff' : '#6c757d',
                                            padding: '5px 12px',
                                            borderRadius: '50px',
                                            fontWeight: '600'
                                        }}
                                    >
                                        <i className={`fa-solid ${isPriority ? 'fa-magnifying-glass' : 'fa-hashtag'} me-1`}></i>
                                        {isPriority ? '見る' : '一覧'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                }}
            />
        </div>
    );
}

export default TagContent;