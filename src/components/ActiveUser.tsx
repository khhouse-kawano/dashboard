import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { useLocation } from "react-router-dom";

type User = { id?: string | number, name: string, heartbeat: string };

const ActiveUser: React.FC = () => {
    const headers = {
        Authorization: "4081Kokubu",
        "Content-Type": "application/json",
    };
    const { token, userName } = useContext(AuthContext);
    const location = useLocation();
    const [activeUsers, setActiveUsers] = useState<User[]>([]);
    const [isInactive, setIsInactive] = useState(false);
    const [collapsed, setCollapsed] = useState(true);

    // --- ドラッグ用 refs / state ---
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef(false);
    const startRef = useRef({ x: 0, y: 0 }); // pointer start
    // posRef を number で初期化（TS エラー回避）
    const posRef = useRef({ x: 0, y: 0 }); // 初期は (0,0) にしておく

    const [width, setWidth] = useState(window.innerWidth);

    useEffect(() => {
        const onResize = () => setWidth(window.innerWidth);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);


    const [_, forceRerender] = useState(0); // 最小限の再描画用

    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 600) {
            setCollapsed(true);
        }
    }, []);

    useEffect(() => {
        if (!token) return;
        if (location.pathname === '/login') return;

        let timer: ReturnType<typeof setTimeout>;

        const resetTimer = () => {
            setIsInactive(false);
            clearTimeout(timer);
            timer = setTimeout(() => setIsInactive(true), 20000);
        };

        const sendHeartbeat = () => {
            axios.post("https://khg-marketing.info/dashboard/api/", { demand: 'heartbeat', token, url: location.pathname }, { headers })
                .catch(() => { });
            resetTimer();
        };

        sendHeartbeat();
        const hbInterval = setInterval(sendHeartbeat, 20000);

        return () => {
            clearInterval(hbInterval);
            clearTimeout(timer);
        };
    }, [location.pathname, token]);

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            try {
                const res = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: 'login_log' }, { headers });
                setActiveUsers(Array.isArray(res.data) ? res.data : []);
            } catch (e) {
                console.error('active users fetch error', e);
            }
        };

        fetchData();
        const interval = setInterval(() => fetchData(), 10000);

        return () => clearInterval(interval);
    }, [token]);

    const getStatus = (heartbeat: string) => {
        const now = Date.now();
        const t = new Date(heartbeat).getTime();
        const diff = now - t;
        if (diff <= 10_000) return 'online';
        if (diff <= 35_000) return 'idle';
        if (diff <= 60_000) return 'away';
        return 'offline';
    };

    const opacityByStatus = (status: string) => status === 'online' ? 1 : status === 'idle' ? 0.85 : 0.6;

    const activeList = useMemo(() => {
        return activeUsers
            .filter(u => u.name !== userName)
            .filter(u => getStatus(u.heartbeat) !== 'offline')
            .sort((a, b) => new Date(b.heartbeat).getTime() - new Date(a.heartbeat).getTime());
    }, [activeUsers, userName]);

    const activeCount = activeList.length;

    // --- 初期スタイル（固定表示） ---
    // fixedWrapperBase は右上に合わせるため alignItems を調整しておく（任意）
    const fixedWrapperBase: React.CSSProperties = {
        position: 'fixed',
        // bottom を使わない（top を使う）
        top: 20, // ここは初期表示の目安。実際の left/top は initPos で上書きします
        right: 20, // 初期スタイルとして右上に見せるため
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'auto',
        touchAction: 'none'
    };

    const containerStyle: React.CSSProperties = {
        background: '#fff',
        padding: '8px 12px',
        borderRadius: 10,
        boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
        fontSize: 13,
        minWidth: 130,
        maxWidth: 220,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-start',
        cursor: 'grab',
        userSelect: 'none'
    };

    const headerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        justifyContent: 'space-between',
        gap: 8
    };

    const dotStyle = (status: string): React.CSSProperties => {
        switch (status) {
            case 'online': return { color: '#0d6efd' };
            case 'idle': return { color: '#ffc107' };
            case 'away': return { color: '#6c757d' };
            default: return { color: '#6c757d' };
        }
    };

    // --- ドラッグ処理 ---
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        // 初期位置を posRef にセット（右/bottom を left/top に変換）
        const initPos = () => {
            const rect = wrapper.getBoundingClientRect();

            // posRef がまだ初期値のままなら右上に配置する
            // （ユーザーが既に移動して posRef に値が入っていればそれを優先）
            if (posRef.current.x === 0 && posRef.current.y === 0) {
                const left = Math.max(0, window.innerWidth - rect.width - 20); // right:20 相当
                const top = 0; // 上から20px
                posRef.current.x = left;
                posRef.current.y = top;
                wrapper.style.left = `${left}px`;
                wrapper.style.top = `${top}px`;
                wrapper.style.right = 'auto';
                wrapper.style.bottom = 'auto';
            } else {
                wrapper.style.left = `${posRef.current.x}px`;
                wrapper.style.top = `${posRef.current.y}px`;
                wrapper.style.right = 'auto';
                wrapper.style.bottom = 'auto';
            }
        };


        initPos();

        const onPointerDown = (e: PointerEvent) => {
            // 折りたたみボタンなどのクリックを妨げないように、左ボタンのみで開始
            if (e.button !== undefined && e.button !== 0) return;
            draggingRef.current = true;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            startRef.current = { x: e.clientX, y: e.clientY };
            // 現在の位置を取得
            const left = posRef.current.x ?? wrapper.getBoundingClientRect().left;
            const top = posRef.current.y ?? wrapper.getBoundingClientRect().top;
            startRef.current = { x: e.clientX - left, y: e.clientY - top };
            wrapper.style.cursor = 'grabbing';
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!draggingRef.current) return;
            e.preventDefault();
            const newLeft = e.clientX - startRef.current.x;
            const newTop = e.clientY - startRef.current.y;

            // 画面外に出さない簡易制限
            const clampedLeft = Math.max(0, Math.min(window.innerWidth - wrapper.offsetWidth, newLeft));
            const clampedTop = Math.max(0, Math.min(window.innerHeight - wrapper.offsetHeight, newTop));

            posRef.current.x = clampedLeft;
            posRef.current.y = clampedTop;

            wrapper.style.left = `${clampedLeft}px`;
            wrapper.style.top = `${clampedTop}px`;
        };

        const onPointerUp = (e: PointerEvent) => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch { }
            wrapper.style.cursor = 'grab';
            // 最小限の再描画（必要なら UI を更新）
            forceRerender(n => n + 1);
        };

        // pointer events を使う（マウス・タッチ両対応）
        wrapper.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);

        // ウィンドウリサイズ時に位置を補正
        const onResize = () => {
            const w = wrapper.offsetWidth;
            const h = wrapper.offsetHeight;
            if (posRef.current.x !== undefined) {
                posRef.current.x = Math.min(posRef.current.x, window.innerWidth - w);
                posRef.current.y = Math.min(posRef.current.y, window.innerHeight - h);
                wrapper.style.left = `${posRef.current.x}px`;
                wrapper.style.top = `${posRef.current.y}px`;
            }
        };
        window.addEventListener('resize', onResize);

        return () => {
            wrapper.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return (
        <> {location.pathname !== '/login' && width >= 768 &&
            <div
                ref={wrapperRef}
                style={{
                    ...fixedWrapperBase,
                    left: undefined as any,
                    top: undefined as any,
                }}
                aria-label="Active users fixed"
            >
                <div style={containerStyle} aria-label="Active users">
                    <div style={headerStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#0d6efd' }}>●</span>
                            <strong style={{ fontSize: 13 }}>{userName}</strong>
                            {isInactive && <span style={{ color: '#dc3545', marginLeft: 8, fontWeight: 500 }}>離席</span>}
                        </div>

                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                                onClick={() => setCollapsed(prev => !prev)}
                                aria-label={collapsed ? "Show active users" : "Hide active users"}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 4,
                                    fontSize: 14,
                                    color: '#333'
                                }}
                            >
                                {collapsed ? '▾' : '▴'}
                            </button>
                        </div>
                    </div>

                    {collapsed && (
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ color: '#6c757d', fontSize: 13 }}>
                                アクティブ: <strong style={{ color: '#333' }}>{activeCount}</strong>人
                            </div>
                        </div>
                    )}

                    {!collapsed && (
                        <div style={{ width: '100%' }}>
                            {activeList.length === 0 ? (
                                <div style={{ color: '#6c757d', fontSize: 13 }}>アクティブなユーザーはいません</div>
                            ) : (
                                activeList.slice(0, 20).map(u => {
                                    const status = getStatus(u.heartbeat);
                                    return (
                                        <div
                                            key={u.id ?? u.name}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: opacityByStatus(status), marginBottom: 6 }}
                                            aria-label={`${u.name} is ${status}`}
                                        >
                                            <span style={{ ...dotStyle(status) }}>●</span>
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                                        </div>
                                    );
                                })
                            )}
                            {activeList.length > 20 && <div>その他{activeList.length - 20}人がアクティブ</div>}
                        </div>
                    )}
                </div>
            </div>}</>
    );
};

export default ActiveUser;
