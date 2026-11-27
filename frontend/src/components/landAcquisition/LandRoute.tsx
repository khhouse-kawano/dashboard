import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import { LAND_CSS } from './landStyle';
import { landPendingLabelOf } from './LandMenu';

/**
 * 土地仕入の画面の入口（v2.2.311）。
 * ⚠️ 担当事業（staff.shop）が spec（建売）・all（全事業）の人だけ。それ以外は事業を選ぶ画面へ戻す。
 * ⚠️ これは見た目の入口。データの読み書きは ② が同じ条件で確かめている（registry.ts の LAND_SHOPS）。
 */
export const LAND_SHOPS = ['spec', 'all'];

const LandRoute = ({ children }: { children: React.ReactElement }) => {
    const { shopName } = useContext(AuthContext);
    if (!LAND_SHOPS.includes(shopName)) return <Navigate to="/home" replace />;
    return children;
};

/** 移行中の画面（まだ移していない画面は、移行元のアプリを案内する） */
const LEGACY_URL = 'https://khf-shiire-kpi.netlify.app/';
export const LandPending = () => {
    const view = new URLSearchParams(useLocation().search).get('view') ?? '';
    const label = landPendingLabelOf(view) || 'この画面';
    return (
        <div className="ld_wrap">
            <style>{LAND_CSS}</style>
            <div className="ld_inner">
                <div className="ld_head"><span className="ld_title">{label}</span><span className="ld_badge">移行中</span></div>
                <div className="ld_caution">
                    「{label}」は、まだ Dashboard に移していません（次の版で移します）。それまでは、今までの仕入KPI管理で見てください。
                </div>
                <div><a className="ld_btn is_primary" href={LEGACY_URL} target="_blank" rel="noreferrer">仕入KPI管理を開く</a></div>
            </div>
        </div>
    );
};

export default LandRoute;
