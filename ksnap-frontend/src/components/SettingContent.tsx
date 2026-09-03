import { useState } from 'react';

type Props = {
    customerData: Record<string, string>,
    setCustomerData: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    modalClose: () => void,
    setMainCategory: React.Dispatch<React.SetStateAction<string>>,
    mainCategory: string
};

const SettingContent = ({ customerData, setCustomerData, modalClose, setMainCategory, mainCategory }: Props) => {
    const [snapStyle, setSnapStyle] = useState('plan');

    const safeParseSetting = (value: string | null | undefined): string[] => {
        if (!value) return [];
        return value.split(',').filter(Boolean); // 空文字を除外
    };

    const handleToggle = (option: string) => {
        const prevSetting = safeParseSetting(localStorage.getItem('setting') || customerData.setting);

        let newArray: string[] = [];
        if (prevSetting.includes(option)) {
            newArray = prevSetting.filter(p => p !== option);
        } else {
            newArray = [...prevSetting, option];
        }

        const newSettingString = newArray.join(',');

        localStorage.setItem('setting', newSettingString);

        setCustomerData(prev => ({
            ...prev,
            setting: newSettingString
        }));
    };

    const menuItems = [
        { id: 'plan', label: '条件', icon: 'fa-house' },
        { id: 'room', label: '間取り', icon: 'fa-couch' },
        { id: 'design', label: 'デザイン', icon: 'fa-paintbrush' },
        { id: 'suggest', label: 'おすすめ', icon: 'fa-eye' },
    ];

    const optionsData: Record<string, string[]> = {
        plan: ['平屋', '2階'],
        room: [
            "エクステリア", "LDK全景", "リビング", "ダイニングキッチン",
            "和室", "スキップフロア（ロフト）", "天井（勾配・下げ・吹き抜け）",
            "洗面所", "ランドリールーム", "トイレ", "浴槽", "フリースペース",
            "居室", "収納", "玄関・土間・ポーチ", "造作", "外観", "室内ドア"
        ],
        design: ['シンプルモダン', 'ナチュラル', 'ホテルライク', '北欧テイスト', 'インダストリアル', '和モダン'],
        suggest: ['ペットと暮らす', '趣味と暮らす', '店舗併用住宅', '二世帯住宅']
    };

    // 💡 現在選択されている設定の配列を取得
    const selectedSettings = safeParseSetting(customerData.setting);
    const hasSelection = selectedSettings.length > 0;

    return (
        <>
            <style>
                {`
                    /* スクロールバー非表示 */
                    .hide-scrollbar::-webkit-scrollbar { display: none; }
                    .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                    .scroll-menu { -webkit-overflow-scrolling: touch; }

                    /* アニメーション */
                    @keyframes fadeUp {
                        from { opacity: 0; transform: translateY(15px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    .animate-fade-up {
                        animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    }

                    /* ウェルカムテキストのグラデーション */
                    .welcome-text {
                        background: linear-gradient(135deg, #2b3a55 0%, #5c729e 100%);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        font-weight: 800;
                    }

                    /* タブメニュー */
                    .custom-tab {
                        color: #888;
                        border-bottom: 2px solid transparent !important;
                    }
                    .custom-tab.active {
                        color: #2b3a55 !important;
                        font-weight: 700 !important;
                    }

                    @media (max-width: 767px) {
                        .scroll-menu {
                            border-bottom: 1px solid #eaeaea;
                            padding-bottom: 0 !important;
                            margin-bottom: 0.5rem;
                            -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
                            mask-image: linear-gradient(to right, black 85%, transparent 100%);
                            padding-right: 40px !important;
                        }
                        .custom-tab { padding: 12px 16px !important; }
                        .custom-tab.active { border-bottom: 2px solid #2b3a55 !important; }
                    }

                    @media (min-width: 768px) {
                        .custom-tab {
                            border-radius: 8px !important;
                            margin-bottom: 4px;
                            padding: 14px 20px !important;
                        }
                        .custom-tab.active { background-color: #f4f6f9 !important; }
                        .custom-tab:hover { background-color: #f8f9fa; }
                    }

                    /* 選択ピル */
                    .custom-pill {
                        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .custom-pill:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 6px 12px rgba(0,0,0,0.06);
                    }
                    .custom-pill.selected {
                        background: linear-gradient(135deg, #2b3a55, #3b4e72);
                        color: white !important;
                        border-color: transparent !important;
                        box-shadow: 0 4px 10px rgba(43, 58, 85, 0.2);
                    }

                    /* CTAボタン */
                    .custom-cta-btn {
                        transition: all 0.3s ease;
                        background: linear-gradient(135deg, #2b3a55, #1e2a40);
                    }
                    .custom-cta-btn:hover:not(:disabled) {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 25px rgba(43, 58, 85, 0.3) !important;
                        opacity: 0.95;
                    }
                    .custom-cta-btn:disabled {
                        background: #cccccc;
                        cursor: not-allowed;
                        opacity: 0.7;
                    }
                `}
            </style>

            <div className="container animate-fade-up" style={{ maxWidth: '1000px', padding: 'min(5vw, 40px) 15px', paddingTop: mainCategory ? '100px': '' }}>

                {/* 💡 ワクワク感を演出するウェルカムヘッダー */}
                <div className="text-center mb-4 mb-md-5">
                    <h3 className="welcome-text mb-2" style={{ fontSize: '1.75rem', letterSpacing: '0.05em' }}>
                        どんなお家が理想ですか？ ✨
                    </h3>
                    <p className="text-muted" style={{ fontSize: '0.95rem' }}>
                        あなたにぴったりの建築実例をピックアップします
                    </p>
                </div>

                <div className="row g-4">
                    <div className="col-12 col-md-3">
                        <div className="d-flex justify-content-end d-md-none mb-1">
                            <span style={{ fontSize: '0.75rem', color: '#adb5bd', fontWeight: '500' }}>
                                <i className="fa-solid fa-arrows-left-right me-1"></i>スワイプで選択
                            </span>
                        </div>

                        <div
                            className="d-flex flex-row flex-md-column gap-1 gap-md-2 overflow-auto scroll-menu hide-scrollbar"
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            {menuItems.map(item => {
                                const isActive = snapStyle === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setSnapStyle(item.id)}
                                        className={`btn text-start transition-all custom-tab ${isActive ? 'active' : ''}`}
                                        style={{
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            boxShadow: 'none'
                                        }}
                                    >
                                        <i className={`fa-solid ${item.icon} me-2 me-md-3`} style={{ opacity: isActive ? 1 : 0.6 }}></i>
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="col-12 col-md-9">
                        <div
                            className="bg-white p-4 p-md-5 d-flex flex-column"
                            style={{
                                borderRadius: '20px',
                                border: '1px solid #eaeaea',
                                height: '400px',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.03)'
                            }}
                        >
                            <h5 className="mb-4 pb-3" style={{ color: '#2b3a55', fontWeight: 'bold', borderBottom: '1px solid #eaeaea', fontSize: '1.1rem', letterSpacing: '0.05em', flexShrink: 0 }}>
                                {menuItems.find(m => m.id === snapStyle)?.label}を選択
                            </h5>
                            <div className="d-flex flex-wrap gap-2 gap-md-3 hide-scrollbar" style={{ overflowY: 'auto', alignContent: 'flex-start', flex: 1, paddingBottom: '10px' }}>
                                {(optionsData[snapStyle] || []).map((item, index) => {
                                    const isSelected = selectedSettings.includes(item);
                                    return (
                                        <label
                                            key={index}
                                            className={`user-select-none custom-pill ${isSelected ? 'selected' : ''}`}
                                            style={{
                                                cursor: 'pointer',
                                                backgroundColor: '#ffffff',
                                                color: '#555555',
                                                border: '1px solid #e0e0e0',
                                                borderRadius: '50px',
                                                padding: '10px 24px',
                                                fontSize: '0.95rem',
                                                fontWeight: isSelected ? '600' : '400',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                height: 'fit-content'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                className="d-none"
                                                checked={isSelected}
                                                onChange={() => handleToggle(item)}
                                            />
                                            {isSelected && <i className="fa-solid fa-check me-2" style={{ fontSize: '0.8rem' }}></i>}
                                            {item}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-5 mb-4 position-relative">
                    {/* 💡 未選択時のアラートメッセージ */}
                    {!hasSelection && (
                        <div
                            className="mb-3 animate-fade-up"
                            style={{ color: '#e67e22', fontWeight: 'bold', fontSize: '0.95rem' }}
                        >
                            <i className="fa-regular fa-face-smile-wink me-2"></i>
                            まずは、気になる条件を1つ以上選択してください
                        </div>
                    )}

                    <button
                        className="btn custom-cta-btn text-white shadow-sm"
                        disabled={!hasSelection} /* 💡 何も選ばれていない時はボタンを非活性にする（任意） */
                        style={{
                            border: 'none',
                            borderRadius: '50px',
                            padding: '16px 50px',
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            letterSpacing: '0.1em',
                            minWidth: '280px'
                        }}
                        onClick={() => {
                            modalClose();
                            setMainCategory('tag');
                            window.history.pushState({ page: 'tag' }, '', `?page=tag${customerData.id ? `&id=${customerData.id}` : ''}`);
                        }}
                    >
                        写真を見る
                        <i className="fa-solid fa-chevron-right ms-3 position-relative" style={{ top: '1px' }}></i>
                    </button>
                </div>
            </div>
        </>
    );
}

export default SettingContent;