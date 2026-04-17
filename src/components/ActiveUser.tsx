import React, { useState, useEffect, useContext, useMemo } from 'react';
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
    // 初期は折りたたみ（閉じた状態）
    const [collapsed, setCollapsed] = useState(true);

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

    // オフラインを除き、自分を除外したアクティブユーザー一覧（展開時は全件、折りたたみ時は数だけ使用）
    const activeList = useMemo(() => {
        return activeUsers
            .filter(u => u.name !== userName)
            .filter(u => getStatus(u.heartbeat) !== 'offline')
            .sort((a, b) => new Date(b.heartbeat).getTime() - new Date(a.heartbeat).getTime());
    }, [activeUsers, userName]);

    const activeCount = activeList.length;

    const fixedWrapper: React.CSSProperties = {
        position: 'fixed',
        bottom: 5,
        right: 20,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'auto'
    };

    const containerStyle: React.CSSProperties = {
        background: '#fff',
        padding: '8px 12px',
        borderRadius: 10,
        boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
        fontSize: 13,
        minWidth: 180,
        maxWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-start'
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

    return (
        <> {location.pathname !== '/login' &&
            <div style={fixedWrapper} aria-label="Active users fixed">
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

                    {/* 折りたたみ時: userName とアクティブユーザー数のみ表示 */}
                    {collapsed && (
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ color: '#6c757d', fontSize: 13 }}>
                                アクティブ: <strong style={{ color: '#333' }}>{activeCount}</strong>人
                            </div>
                        </div>
                    )}

                    {/* 展開時: 全アクティブユーザーを一覧表示 */}
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
