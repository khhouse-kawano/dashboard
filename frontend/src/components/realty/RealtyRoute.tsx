import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

/**
 * 不動産企画係（category = realty）の画面の入口（v2.2.221）。
 *
 * ⚠️ 担当事業（staff.shop）が `realty`（不動産企画係）か `all`（全事業）の人だけが入れる。
 *   それ以外の人が URL を直接開いたら、事業を選ぶ画面へ戻す。
 * ⚠️ これは見た目の入口。データの読み書きは ② / ① が同じ条件で確かめている（REALTY_SHOPS）。
 */
export const REALTY_SHOPS = ['realty', 'all'];

const RealtyRoute = ({ children }: { children: React.ReactElement }) => {
    const { shopName } = useContext(AuthContext);
    if (!REALTY_SHOPS.includes(shopName)) return <Navigate to="/home" replace />;
    return children;
};

export default RealtyRoute;
