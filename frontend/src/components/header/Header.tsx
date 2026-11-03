import React, { useState, useEffect, useContext, useRef } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import { useIsSp } from '../../utils/isSp';
import AuthContext from '../../context/AuthContext';
import apiClient from '../../utils/apiClient';
import ClaudeIcon from './claude/ClaudeIcon';
import { isGuideCategory, openGuide } from '../guide/openGuide';
import { useGuideScreenReceiver } from '../guide/useGuideScreenReceiver';
import { useNavigate } from "react-router-dom";
import { AI_ANALYSIS_AUTHORITY, MENU_KEYS, menuItemsOf } from './headerScreens';
import type { HeaderScreen } from './headerScreens';

/**
 * 画面上部のヘッダー（メニュー）。
 *
 * ⚠️ v2.2.241 から、メニューの項目は App.tsx のページへ移るだけ（⚠️ それまではここでモーダルを開いていた）。
 *   ⚠️ 項目・URL・見られる人は headerScreens.tsx にまとめてある。⚠️ ここに項目を書き足さないこと。
 */
const Header = ({ }) => {
    const { authority, category } = useContext(AuthContext);
    const [newEstate, setNewEstate] = useState<number | null>(0);

    const navigate = useNavigate();
    // Claudeによる分析（メニューとは独立した導線）
    const [claudeHover, setClaudeHover] = useState<boolean>(false);
    /**
     * ⚠️ v2.2.217 から Master・BrandAdmin・Manager だけにボタンを出す（Dashboard からの自由分析）。
     *   ⚠️ 競合分析のレポートはこの画面から外し、他社動向 →「Claudeによる競合分析」だけで読む（全員）。
     */
    const canUseClaude = AI_ANALYSIS_AUTHORITY.includes(authority);

    const isSp = useIsSp();

    /**
     * ヘッダーの実際の高さを下のレイアウトへ伝える。
     *
     * ─────────────────────────────────────────────
     * ⚠️⚠️ **メニューが折り返すと高さが変わる**（2026-09-15 に flex-wrap を付けた）。
     *   ヘッダーは `position-fixed` なので場所を取らず、下のコンテンツは
     *   App.tsx の余白で避けている。⚠️ 高さが 30px → 60px になっても
     *   余白が固定のままだと、**画面の上部がヘッダーに隠れる。**
     *
     * ⚠️ そこで実測して CSS 変数（--header-h）に入れ、App.tsx がそれを使う。
     *   ⚠️ 片方だけ直さないこと。変数名を変えるなら App.tsx も直す。
     *   ⚠️ v2.2.241: ヘッダーのメニューのページ（HeaderPage.tsx）も、この変数で本文の高さを決めている。
     *
     * ⚠️ ResizeObserver を使うのは、折り返しが**幅の変化で起きる**ため。
     *   リサイズだけを見ていると、メニューの増減に追従できない。
     * ─────────────────────────────────────────────
     */
    const headerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const el = headerRef.current;
        // ⚠️ スマホではこのヘッダーを描かない。余白も要らないので 0 に戻す
        if (!el) {
            document.documentElement.style.setProperty('--header-h', '0px');
            return;
        }

        const apply = () => {
            document.documentElement.style.setProperty('--header-h', `${el.offsetHeight}px`);
        };
        apply();

        const observer = new ResizeObserver(apply);
        observer.observe(el);
        return () => observer.disconnect();
    }, [isSp]);

    /** メニューの項目を開く。⚠️ アクションボードだけはページではなく action（DailyAction を開く） */
    const openScreen = (screen: HeaderScreen): void => {
        if (screen.action) screen.action();
        else if (screen.path) navigate(screen.path);
    };

    // ⚠️ v2.2.196: 業務ガイドの「画面を開く」を受ける（guide/useGuideScreenReceiver.ts）。⚠️ ここで1回だけ
    useGuideScreenReceiver();

    useEffect(() => {
        const fetchData = async () => {
            const response = await apiClient.post("", { request: "header" });
            setNewEstate(response.data.estate);
        };
        fetchData();

    }, []);

    const isEstate = (value: string) => {
        return newEstate !== null && newEstate > 0 && value === '土地情報一覧';
    };

    return (
        <>
            {!isSp && <div
                ref={headerRef}
                /**
                 * ⚠️⚠️ `flex-wrap` を外さないこと（2026-09-15 追加）。
                 *   メニューが11項目あり、1024px 前後の幅では**1行に収まらず
                 *   画面外へはみ出す。** 折り返して全部見えるようにしている。
                 * ⚠️ `row-gap` は折り返したときの行間。無いと2行が詰まって読みにくい。
                 */
                className="d-flex flex-wrap align-items-center bg-white border-bottom px-2 position-fixed top-0 start-0 w-100"
                style={{
                    zIndex: 1050,
                    // ⚠️⚠️ **`height` ではなく `minHeight`。**
                    //   固定すると折り返した2行目が**はみ出して見えなくなる。**
                    minHeight: '30px',
                    rowGap: '2px',
                    paddingTop: '2px',
                    paddingBottom: '2px',
                    userSelect: 'none',
                }}
            >
                {/* Claudeによる分析：メニューとは別の独立したボタン（⚠️ v2.2.217 から3つの権限だけ） */}
                {canUseClaude && (
                    <button
                        type="button"
                        onClick={() => navigate('/claudeAnalysis')}
                        onMouseEnter={() => setClaudeHover(true)}
                        onMouseLeave={() => setClaudeHover(false)}
                        className="border-0 d-flex align-items-center px-2 py-1 me-2"
                        style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            // ロゴ画像内の文字が黒のため、続く「による分析」も黒で揃える
                            color: '#000',
                            backgroundColor: claudeHover ? '#fdf8f6' : 'transparent',
                            borderRadius: '4px',
                            lineHeight: 1,
                            gap: '2px',
                        }}
                        title="Claudeによる分析"
                    >
                        <ClaudeIcon height={15} />
                        による分析
                    </button>
                )}

                <div className='bg-primary rounded-pill text-white me-1 shadow-sm'
                    style={{ padding: '2px 10px', fontSize: '10px', cursor: 'pointer' }}
                    onClick={() => navigate('/market')}
                >
                    マーケット情報
                </div>
                {/* ⚠️ v2.2.240: 金利データ（⚠️ マーケット情報の右・指示）。⚠️ 色は濃いシアン（bg-info は白い文字が読みにくいため。2026-11-03 の決定）。header/market/LoanRates.tsx */}
                <div className='rounded-pill text-white me-1 shadow-sm'
                    role="button" tabIndex={0}
                    style={{ padding: '2px 10px', fontSize: '10px', cursor: 'pointer', background: '#0891b2' }}
                    onClick={() => navigate('/loanRates')}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate('/loanRates'); }}
                    title="商圏内の金融機関の住宅ローン金利"
                >
                    金利データ
                </div>
                {/* ⚠️ v2.2.194: 業務ガイド（⚠️ マーケット情報の右・指示）。⚠️ 別ウインドウで開く。⚠️ 注文営業・建売営業・中古リノベ */}
                {isGuideCategory(category) && (
                    <div className='rounded-pill text-white me-1 shadow-sm'
                        role="button" tabIndex={0}
                        style={{ padding: '2px 10px', fontSize: '10px', cursor: 'pointer', background: '#0f766e' }}
                        onClick={() => openGuide()}
                        onKeyDown={(e) => { if (e.key === 'Enter') openGuide(); }}
                        title="業務ガイドを別ウインドウで開く"
                    >
                        業務ガイド
                    </div>
                )}
                {MENU_KEYS.map((menu) => (
                    <Dropdown key={menu} className="me-1">
                        <Dropdown.Toggle
                            variant="text"
                            size="sm"
                            className="border-0 px-2.5 py-1 text-dark d-flex align-items-center"
                            style={{
                                fontSize: '13px',
                                fontWeight: '500',
                                boxShadow: 'none',
                                borderRadius: '4px'
                            }}
                        >
                            {menu}
                        </Dropdown.Toggle>

                        <Dropdown.Menu
                            className="shadow-sm border border-light-subtle py-1"
                            style={{ fontSize: '13px', minWidth: '160px' }}
                        >
                            {menuItemsOf(menu, { authority, category }).map((screen) => (
                                <Dropdown.Item
                                    key={screen.item}
                                    className="py-2 px-3 text-dark position-relative"
                                    onClick={() => openScreen(screen)}
                                >
                                    {/* ⚠️ 競合分析はロゴ＋文言で出す（ヘッダーの「による分析」と同じ形。headerScreens.tsx の label） */}
                                    {screen.label ?? screen.item}
                                    {isEstate(screen.item) && <div className="position-absolute menu_sync" style={{ top: '12px', right: '10px' }}>新着 {newEstate}件</div>}
                                </Dropdown.Item>
                            ))}
                        </Dropdown.Menu>
                    </Dropdown>
                ))}


            </div>}
        </>
    );
};

export default Header;
