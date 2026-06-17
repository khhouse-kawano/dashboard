import React, { useState, useEffect, useContext } from 'react';
import Table from 'react-bootstrap/Table';
import BsForm from 'react-bootstrap/Form';
import axios from 'axios';
import { headers } from '../../utils/headers';
import AuthContext from '../../context/AuthContext';

type Shop = Record<string, string>;

const EditShop = () => {
    const [shopList, setShopList] = useState<Shop[]>([]);
    const [originalShopList, setOriginalShopList] = useState<Shop[]>([]);
    const [newShop, setNewShop] = useState(false);

    const [newShopData, setNewShopData] = useState<Shop>({
        brand: '',
        shop: '',
        division: '',
        section: '',
        area: '',
        show_flag: '1',
        report_flag: '0',
        multi: '0'
    });

    const { brand: userBrand } = useContext(AuthContext);

    const safeFormate = (value: string) => {
        return value ?? '';
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: "header_shop_edit" }, { headers });
                const shops = response.data.shop || response.data.shops || [];
                setOriginalShopList(shops);
                setShopList(shops);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    }, []);

    // 2. 既存行の自動アップデート用（テキストはonBlur、トグルはonChangeで発火）
    const handleChange = (id: string, key: string, value: string) => {
        const fetchData = async () => {
            const postData = {
                id,
                [key]: value,
                request: "header_shop_update"
            };
            try {
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', postData, { headers });
                console.log(response.data.status);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
    };

    const handleSaveNewShop = async () => {
        if (!newShopData.shop.trim()) {
            alert('店舗名を入力してください。');
            return;
        }

        try {
            const postData = {
                ...newShopData,
                request: "header_shop_insert"
            };

            const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', postData, { headers });

            if (response.data.status === 'success') {
                // 採番されたIDをマージして一覧の先頭に追加
                const newId = response.data.id ?? String(Date.now());
                const createdRecord = { ...newShopData, id: newId };

                setOriginalShopList(prev => [createdRecord, ...prev]);
                setShopList(prev => [createdRecord, ...prev]);
                setNewShop(false);

                // フォームのリセット
                setNewShopData({
                    brand: '',
                    shop: '',
                    division: '',
                    section: '',
                    area: '',
                    show_flag: '1',
                    event_modal: '0',
                    ma_flag: '0',
                    report_flag: '0',
                    multi: '0'
                });
            } else {
                alert('登録に失敗しました: ' + response.data.message);
            }
        } catch (err) {
            console.error(err);
            alert('通信エラーが発生しました。');
        }
    };

    return (
        <>
            <div className="bg-white p-4 rounded shadow-sm border">
                {/* 上部コントロールバー */}
                <div className="d-flex align-items-center mb-3">
                    <div className="text-muted fw-bold" style={{ fontSize: '14px' }}>
                        店舗一覧 ({shopList.length} 件)
                    </div>
                    <div className="ms-auto">
                        {newShop ? (
                            <div className="d-flex gap-2">
                                <button className="btn btn-success btn-sm px-3" style={{ fontSize: '12px', fontWeight: 'bold' }} onClick={handleSaveNewShop}>
                                    <i className="fa-solid fa-check me-1"></i>店舗を登録
                                </button>
                                <button className="btn btn-secondary btn-sm px-3" style={{ fontSize: '12px' }} onClick={() => setNewShop(false)}>
                                    キャンセル
                                </button>
                            </div>
                        ) : (
                            <button className="btn btn-primary btn-sm px-3" style={{ fontSize: '12px', fontWeight: 'bold' }} onClick={() => setNewShop(true)}>
                                <i className="fa-solid fa-plus me-1"></i>新規店舗追加
                            </button>
                        )}
                    </div>
                </div>

                {/* テーブル領域 */}
                <div className="table-responsive">
                    <Table hover className="align-middle mb-0" style={{ minWidth: '1300px' }}>
                        <thead>
                            <tr className="text-secondary border-bottom" style={{ fontSize: '12px', backgroundColor: '#f8f9fa' }}>
                                <th className="py-3" style={{ width: '110px' }}>ブランド</th>
                                <th className="py-3" style={{ width: '160px' }}>店舗名</th>
                                <th className="py-3" style={{ width: '130px' }}>事業部</th>
                                <th className="py-3" style={{ width: '130px' }}>セクション(課)</th>
                                <th className="py-3" style={{ width: '110px' }}>エリア</th>
                                <th className="py-3 text-center" style={{ width: '90px' }}>反響一覧</th>
                                <th className="py-3 text-center" style={{ width: '100px' }}>全社報告用フォーマット</th>
                                <th className="py-3 text-center" style={{ width: '90px' }}>併売店舗</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '13px' }}>

                            {newShop && <tr className="table-primary border-bottom" style={{ backgroundColor: '#f0f7ff' }}>
                                <td><BsForm.Control size="sm" type="text" placeholder="ブランド" value={newShopData.brand} onChange={(e) => setNewShopData(prev => ({ ...prev, brand: e.target.value }))} style={{ fontSize: '12px' }} disabled={userBrand === 'ordinary'} /></td>
                                <td><BsForm.Control size="sm" type="text" placeholder="店舗名" value={newShopData.shop} onChange={(e) => setNewShopData(prev => ({ ...prev, shop: e.target.value }))} style={{ fontSize: '12px' }} className="fw-bold" disabled={userBrand === 'ordinary'} /></td>
                                <td><BsForm.Control size="sm" type="text" placeholder="事業部" value={newShopData.division} onChange={(e) => setNewShopData(prev => ({ ...prev, division: e.target.value }))} style={{ fontSize: '12px' }} disabled={userBrand === 'ordinary'} /></td>
                                <td><BsForm.Control size="sm" type="text" placeholder="セクション" value={newShopData.section} onChange={(e) => setNewShopData(prev => ({ ...prev, section: e.target.value }))} style={{ fontSize: '12px' }} disabled={userBrand === 'ordinary'} /></td>
                                <td><BsForm.Control size="sm" type="text" placeholder="エリア" value={newShopData.area} onChange={(e) => setNewShopData(prev => ({ ...prev, area: e.target.value }))} style={{ fontSize: '12px' }} disabled={userBrand === 'ordinary'} /></td>
                                {/* 新規トグル群 */}
                                <td className="text-center"><div className="d-flex justify-content-center"><BsForm.Check type="switch" checked={newShopData.show_flag === "1"} onChange={(e) => setNewShopData(prev => ({ ...prev, show_flag: e.target.checked ? "1" : "0" }))} style={{ cursor: 'pointer' }} disabled={userBrand === 'ordinary'} /></div></td>
                                <td className="text-center"><div className="d-flex justify-content-center"><BsForm.Check type="switch" checked={newShopData.report_flag === "1"} onChange={(e) => setNewShopData(prev => ({ ...prev, report_flag: e.target.checked ? "1" : "0" }))} style={{ cursor: 'pointer' }} disabled={userBrand === 'ordinary'} /></div></td>
                                <td className="text-center"><div className="d-flex justify-content-center"><BsForm.Check type="switch" checked={newShopData.multi === "1"} onChange={(e) => setNewShopData(prev => ({ ...prev, multi: e.target.checked ? "1" : "0" }))} style={{ cursor: 'pointer' }} disabled={userBrand === 'ordinary'} /></div></td>
                            </tr>}

                            {shopList.map((item, index) => (
                                <tr key={item.id ?? index} className="border-bottom" style={{ transition: 'background-color 0.15s ease' }}>
                                    {/* テキスト編集フィールド群 (入力が終わって枠から外れた[onBlur]瞬間に自動で非同期保存されます) */}
                                    <td>
                                        <BsForm.Control
                                            size="sm" type="text" value={safeFormate(item.brand)}
                                            onChange={(e) => setShopList(prev => prev.map(p => p.id === item.id ? { ...p, brand: e.target.value } : p))}
                                            onBlur={(e) => handleChange(item.id, 'brand', e.target.value)}
                                            className="border-0 bg-transparent px-1" style={{ fontSize: '13px' }}
                                            disabled={userBrand === 'ordinary'}
                                        />
                                    </td>
                                    <td>
                                        <BsForm.Control
                                            size="sm" type="text" value={safeFormate(item.shop)}
                                            onChange={(e) => setShopList(prev => prev.map(p => p.id === item.id ? { ...p, shop: e.target.value } : p))}
                                            onBlur={(e) => handleChange(item.id, 'shop', e.target.value)}
                                            className="border-0 bg-transparent fw-bold px-1" style={{ fontSize: '13px' }}
                                            disabled={userBrand === 'ordinary'}
                                        />
                                    </td>
                                    <td>
                                        <BsForm.Control
                                            size="sm" type="text" value={safeFormate(item.division)}
                                            onChange={(e) => setShopList(prev => prev.map(p => p.id === item.id ? { ...p, division: e.target.value } : p))}
                                            onBlur={(e) => handleChange(item.id, 'division', e.target.value)}
                                            className="border-0 bg-transparent px-1" style={{ fontSize: '13px' }}
                                            disabled={userBrand === 'ordinary'}
                                        />
                                    </td>
                                    <td>
                                        <BsForm.Control
                                            size="sm" type="text" value={safeFormate(item.section)}
                                            onChange={(e) => setShopList(prev => prev.map(p => p.id === item.id ? { ...p, section: e.target.value } : p))}
                                            onBlur={(e) => handleChange(item.id, 'section', e.target.value)}
                                            className="border-0 bg-transparent px-1" style={{ fontSize: '13px' }}
                                            disabled={userBrand === 'ordinary'}
                                        />
                                    </td>
                                    <td>
                                        <BsForm.Control
                                            size="sm" type="text" value={safeFormate(item.area)}
                                            onChange={(e) => setShopList(prev => prev.map(p => p.id === item.id ? { ...p, area: e.target.value } : p))}
                                            onBlur={(e) => handleChange(item.id, 'area', e.target.value)}
                                            className="border-0 bg-transparent px-1" style={{ fontSize: '13px' }}
                                            disabled={userBrand === 'ordinary'}
                                        />
                                    </td>

                                    {/* 🔘 トグルスイッチ群 (変更された瞬間に即時、自動で非同期保存されます) */}
                                    <td className="text-center">
                                        <div className="d-flex justify-content-center">
                                            <BsForm.Check
                                                type="switch" id={`switch-show_flag-${index}`}
                                                checked={Number(item.show_flag) === 1}
                                                onChange={() => {
                                                    const newValue = Number(item.show_flag) === 1 ? "0" : "1";
                                                    setShopList(prev => prev.map(p => p.id === item.id ? { ...p, show_flag: newValue } : p));
                                                    handleChange(item.id, 'show_flag', newValue);
                                                }} style={{ cursor: 'pointer' }}
                                                disabled={userBrand === 'ordinary'}
                                            />
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="d-flex justify-content-center">
                                            <BsForm.Check
                                                type="switch" id={`switch-report_flag-${index}`}
                                                checked={Number(item.report_flag) === 1}
                                                onChange={() => {
                                                    const newValue = Number(item.report_flag) === 1 ? "0" : "1";
                                                    setShopList(prev => prev.map(p => p.id === item.id ? { ...p, report_flag: newValue } : p));
                                                    handleChange(item.id, 'report_flag', newValue);
                                                }} style={{ cursor: 'pointer' }}
                                                disabled={userBrand === 'ordinary'}
                                            />
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        <div className="d-flex justify-content-center">
                                            <BsForm.Check
                                                type="switch" id={`switch-multi-${index}`}
                                                checked={Number(item.multi) === 1}
                                                onChange={() => {
                                                    const newValue = Number(item.multi) === 1 ? "0" : "1";
                                                    setShopList(prev => prev.map(p => p.id === item.id ? { ...p, multi: newValue } : p));
                                                    handleChange(item.id, 'multi', newValue);
                                                }} style={{ cursor: 'pointer' }}
                                                disabled={userBrand === 'ordinary'}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </div>
        </>
    );
};

export default EditShop;