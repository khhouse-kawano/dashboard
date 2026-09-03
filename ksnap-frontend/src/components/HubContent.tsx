import { useEffect, useState, useMemo } from "react";
import { VirtuosoGrid } from 'react-virtuoso';
import { IMAGE_BASE_URL } from '../config';

// 型定義はそのまま維持
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
    handleNavigate: (value: string) => void,
    customerData: Record<string, string>,
}

type Hub = {
    [key: string]: string
};

const HubContent = ({ photoList, filteredPhotoList, setSearchList, handleNavigate, customerData }: Props) => {
    const [hubList, setHubList] = useState<string[]>([]);
    const [searchHub, setSearchHub] = useState<Hub[]>([]);

    // ⭐ 追加: 最初に1回だけシャッフルして記憶しておく
    const shuffledPhotoList = useMemo(() => {
        return [...photoList].sort(() => Math.random() - 0.5);
    }, [photoList]);

    const hubType = (key: string, array: string[]) => {
        return array.map(element => ({ [key]: element }));
    };

    const findKeysByValue = (list: Record<string, string>[], value: string) => {
        return list
            .filter(obj => Object.values(obj)[0] === value)
            .map(obj => Object.keys(obj)[0]);
    };

    useEffect(() => {
        const filtered = filteredPhotoList.filter(f => f.image && f.id);
        const categoryHub = filtered.map(f => f.category);
        const planHub = filtered.map(f => f.plan);
        const detailHub = filtered.map(f => f.detail);
        const prefHub = filtered.map(f => f.pref);
        const townHub = filtered.map(f => f.town);
        const brandHub = filtered.map(f => f.brand);
        const shopHub = filtered.map(f => f.shop);

        const filteredHub = [
            ...categoryHub,
            ...planHub,
            ...detailHub,
            ...prefHub,
            ...townHub,
            ...brandHub,
            ...shopHub,
        ];

        setHubList([...new Set(filteredHub.filter(Boolean))]);

        const filteredHubList = [
            ...hubType('category', categoryHub),
            ...hubType('plan', planHub),
            ...hubType('detail', detailHub),
            ...hubType('pref', prefHub),
            ...hubType('town', townHub),
            ...hubType('brand', brandHub),
            ...hubType('shop', shopHub)
        ];
        setSearchHub(filteredHubList);
    }, [photoList, filteredPhotoList]);


    return (
        <div className="container mainContent">
            <VirtuosoGrid
                useWindowScroll
                data={hubList}
                listClassName="row g-4"
                itemClassName="col-12 col-sm-6 col-md-4 col-lg-3 position-relative"
                itemContent={(index, hub) => {
                    // ⭐ 修正: 毎回シャッフルするのをやめ、記憶しておいたリスト（shuffledPhotoList）を使う
                    const targetList = shuffledPhotoList.filter(f =>
                        (f.image && f.id) &&
                        (f.brand === hub || f.category === hub || f.detail.includes(hub) || f.plan.includes(hub) || f.pref === hub || f.shop === hub || f.tag.includes(hub) || f.town === hub)
                    );

                    const target = targetList.slice(0, 3);
                    const searchWord = [...new Set(findKeysByValue(searchHub, hub))];

                    return (
                        <div key={index}>
                            <div
                                className="card h-100 border-0"
                                style={{
                                    borderRadius: '16px',
                                    boxShadow: '0 4px 12px rgba(43, 58, 85, 0.08)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    overflow: 'hidden'
                                }}
                                onClick={() => {
                                    handleNavigate('main');
                                    console.log(searchWord)
                                    searchWord.forEach(key => {
                                        setSearchList(prev => ({
                                            ...prev,
                                            [key]: (key === 'detail' || key === 'plan' || key === 'category') ? [hub] : hub
                                        }));
                                    });
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(43, 58, 85, 0.15)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(43, 58, 85, 0.08)';
                                }}
                            >
                                {/* ★変更: サムネイルエリアを3枚レイアウト用に更新 */}
                                <div
                                    style={{
                                        height: '200px',
                                        backgroundColor: '#f8f9fa',
                                        display: 'grid',
                                        gap: '2px', // 写真の隙間
                                        gridTemplateColumns: '2fr 1fr',
                                        gridTemplateRows: '1fr 1fr',
                                        position: 'relative'
                                    }}
                                >
                                    {/* グラデーションのオーバーレイ（見た目を引き締めるため追加） */}
                                    <div className="position-absolute w-100 h-100" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.1), transparent 30%)', zIndex: 1, pointerEvents: 'none' }}></div>

                                    {target.map((t, tIndex) => {
                                        const isFirst = tIndex === 0;

                                        // 各画像の配置スタイル
                                        let gridPlacement = {};
                                        if (tIndex === 0) {
                                            gridPlacement = { gridColumn: '1 / 2', gridRow: '1 / 3' };
                                        } else if (tIndex === 1) {
                                            gridPlacement = { gridColumn: '2 / 3', gridRow: '1 / 2' };
                                        } else if (tIndex === 2) {
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

                                <div className="card-body d-flex align-items-center justify-content-between p-3" style={{ backgroundColor: '#fff' }}>
                                    <h6 className="mb-0 fw-bold text-truncate" style={{ color: '#2b3a55', maxWidth: '70%' }}>
                                        {hub}
                                    </h6>
                                    <span
                                        className="d-inline-flex align-items-center"
                                        style={{
                                            fontSize: '0.75rem',
                                            backgroundColor: '#f0f2f5',
                                            color: '#6c757d',
                                            padding: '4px 10px',
                                            borderRadius: '50px',
                                            fontWeight: '600'
                                        }}
                                    >
                                        <i className="fa-solid fa-camera me-1"></i>一覧
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                }
                }
            />

        </div>
    );
}

export default HubContent;