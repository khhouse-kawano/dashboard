import { useNavigate } from 'react-router-dom';
import React, { useState, useContext, useEffect } from 'react';
import AuthContext from "../context/AuthContext";
import Logo from "../assets/images/logo.png";
import apiClient from '../utils/apiClient';
import Table from "react-bootstrap/Table";
import { useIsSp } from '../utils/isSp';
import { markCategoryChosen } from './DailyAction';
import { openGuide } from './guide/openGuide';
import { canEnterCategory } from '../utils/shopAccess';

type Log = { no: number, version: string, date: string, note: string };

const Category = () => {
    const { version, userName, setShopName } = useContext(AuthContext);
    const navigate = useNavigate();
    const { setCategory } = useContext(AuthContext);
    const [log, setLog] = useState<Log[]>([]);
    const [shopValue, setShopValue] = useState('');
    const isSp = useIsSp();

    useEffect(() => {
        const fetchData = async () => {
            const response = await apiClient.post("", { request: 'update_log', userName },);
            setLog(response.data.log);
            setShopValue(response.data.shop.shop);
            setShopName(response.data.shop.shop);
        }
        fetchData();
    }, []);

    const goToDashboard = async (categoryValue: string) => {
        // ⚠️ v2.2.227: estate（建売・中古・不動産企画係）も見る（utils/shopAccess.ts）
        if (!canEnterCategory(shopValue, categoryValue)) {
            alert('閲覧権限がありません');
            return;
        }
        const navigateMap = {
            order: '/company',
            spec: '/company',
            used: '/company',
            // ⚠️ v2.2.221: planner → realty（不動産企画係）。⚠️ v2.2.223: URL は1段（App.tsx の注記）
            realty: '/summary'
        };
        await setCategory(categoryValue);
        /**
         * ⚠️ v2.2.175 修正: 要確認は ⚠️ **ここで事業を選んでから**出す（DailyAction.tsx の markCategoryChosen）。
         *   ⚠️ navigate の前に呼ぶこと（⚠️ 遷移で DailyAction が判定するため）。
         */
        markCategoryChosen(categoryValue);
        /**
         * ⚠️ ここから遷移すると「要確認」モーダルも出る（2026-09-28）。
         *   ⚠️ ⚠️ **目印は渡していない。** `App.tsx` の `DailyAction` が
         *     ⚠️ **URL の変化そのものを見て開く**ため、この遷移でも必ず動く。
         *   ⚠️ ⚠️ **ここでモーダルを出すことはできない。**
         *     ⚠️ 直後に `navigate()` するので**出した瞬間に消える。**
         */
        await navigate(navigateMap[categoryValue] ?? '/home');
    };

    return (
        <>
            <div className="d-block w-100">
                <div className="home_logo position-relative">
                    <img src={Logo} className='w-100' />
                    <div className="position-absolute" style={{ bottom: '-10px', right: '3px' }}>ver{version}</div>
                </div>
                <div className="d-md-flex align-items-center justify-content-center home_menu">
                    <div className="bg-primary text-center text-white py-2 py-md-3 px-4 px-md-5 rounded-pill pointer my-2 me-md-2" style={{ fontWeight: isSp ? '500' : '700', letterSpacing: '1px', fontSize: isSp ? '10px' : '14px' }}
                        onClick={() => goToDashboard('order')}>注文営業</div>
                    <div className="bg-success text-center text-white py-2 py-md-3  px-4 px-md-5 rounded-pill me-md-2 my-4 pointer" style={{ fontWeight: isSp ? '500' : '700', letterSpacing: '1px', fontSize: isSp ? '10px' : '14px' }}
                        onClick={() => goToDashboard('spec')}>建売営業</div>
                    <div className="bg-info text-center text-white py-2 py-md-3  px-4 px-md-5 rounded-pill pointer me-md-2 my-4" style={{ fontWeight: isSp ? '500' : '700', letterSpacing: '1px', fontSize: isSp ? '10px' : '14px' }}
                        onClick={() => goToDashboard('realty')}>不動産企画係</div>
                    <div className="bg-warning text-center text-white py-2 py-md-3  px-4 px-md-5 rounded-pill pointer my-2" style={{ fontWeight: isSp ? '500' : '700', letterSpacing: '1px', fontSize: isSp ? '10px' : '14px' }}
                        onClick={() => goToDashboard('used')}>中古リノベ</div>
                </div>
                {/*
                  ⚠️ v2.2.194: 業務ガイド（⚠️ 4つのボタンの下・指示）。⚠️ 別ウインドウで開く（guide/openGuide.ts）。
                    ⚠️ この画面ではまだ事業を選んでいないので、⚠️ **担当事業（shopValue）が注文営業・建売営業・中古リノベ・全事業の人にだけ**出す。
                */}
                {['order', 'spec', 'used', 'estate', 'all'].includes(shopValue) && (
                    <div className="text-center mt-2">
                        <button type="button" onClick={() => openGuide()}
                            style={{ background: '#f0fdfa', border: '1px solid #99f6e4', color: '#0f766e', borderRadius: 999,
                                padding: isSp ? '4px 16px' : '6px 24px', fontSize: isSp ? 11 : 13, fontWeight: 700, letterSpacing: '1px', cursor: 'pointer' }}>
                            業務ガイド
                        </button>
                    </div>
                )}
                <div style={{ width: '90%', maxWidth: '568px', margin: '30px auto 0', height: '180px', overflowY: 'scroll' }}>
                    <Table striped>
                        <tbody style={{ fontSize: '10px' }}>
                            <tr>
                                <td>No</td>
                                <td>version</td>
                                <td>日付</td>
                                <td>詳細</td>
                            </tr>
                            {log
                                .sort((a, b) => {
                                    return b.no - a.no
                                })
                                .map((item, index) =>
                                    <tr key={`${item}_${index}`}>
                                        <td>{index + 1}</td>
                                        <td>{item.version}</td>
                                        <td>{item.date}</td>
                                        <td>{item.note.split('\n').map((line, lineIndex) =>
                                            <div key={lineIndex}>{line}</div>)}</td>
                                    </tr>)}
                        </tbody>
                    </Table>
                </div>
            </div>
        </>
    )
}

export default Category