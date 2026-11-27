import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

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

export default LandRoute;
