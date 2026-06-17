import React, { useState, useEffect, useContext } from 'react';
import Table from 'react-bootstrap/Table';
import BsForm from 'react-bootstrap/Form';
import axios from 'axios';
import { headers } from '../../utils/headers';
import AuthContext from '../../context/AuthContext';

type BlacklistData = Record<string, string>;

const BRAND_OPTIONS = ['KH', 'DJH', 'なごみ', '2L', 'PG HOUSE', 'JH', 'かえる'];

const EditBlackList = () => {
    const [blacklist, setBlacklist] = useState<BlacklistData[]>([]);
    const [originalBlacklist, setOriginalBlacklist] = useState<BlacklistData[]>([]);
    const [targetBrand, setTargetBrand] = useState('');
    const [targetStatus, setTargetStatus] = useState('');
    const [searchName, setSearchName] = useState('');
    const [newEntry, setNewEntry] = useState(false);

    const [newEntryData, setNewEntryData] = useState<BlacklistData>({
        no: '',
        name: '',
        brand: '全社',
        date: '',
        mail: '',
        mobile: '',
        zip: '',
        full_address: '',
        note: '',
        show_key: '1'
    });

    const { brand } = useContext(AuthContext);

    const safeFormat = (value: string) => {
        return value ?? '';
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', { request: "header_blacklist_edit" }, { headers });
                setOriginalBlacklist(response.data.blacklist || []);
            } catch (err) {
                console.error(err);
            }
        };

        fetchData();
    }, []);

    useEffect(() => {
        const filtered = originalBlacklist.filter(o =>
            (targetBrand ? o.brand === targetBrand : true) &&
            (targetStatus ? o.show_key === targetStatus : true) &&
            (searchName ? o.name.includes(searchName) : true)
        );
        setBlacklist(filtered);
    }, [originalBlacklist, targetBrand, targetStatus, searchName]);

    // 💡 引数を id から no に変更
    const updateLocalState = (no: string, key: string, value: string) => {
        setBlacklist(prev => prev.map(p => String(p.no) === String(no) ? { ...p, [key]: value } : p));
        setOriginalBlacklist(prev => prev.map(p => String(p.no) === String(no) ? { ...p, [key]: value } : p));
    };

    // 💡 引数と POST のキーを no に変更
    const handleChange = (no: string, key: string, value: string) => {
        const updateData = async () => {
            const postData = {
                no, // バックエンドへ no を送る
                [key]: value,
                request: "header_blacklist_update"
            };
            try {
                const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', postData, { headers });
                console.log(response.data.status);
            } catch (err) {
                console.error(err);
            }
        };

        updateData();
    };

    const handleSaveNewEntry = async () => {
        if (!newEntryData.name.trim()) {
            alert('顧客名を入力してください。');
            return;
        }

        try {
            const today = new Date();
            const currentDate = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

            const postData = {
                ...newEntryData,
                date: currentDate,
                request: "header_blacklist_insert"
            };

            const response = await axios.post('https://khg-marketing.info/dashboard/api/gateway/', postData, { headers });

            if (response.data.status === 'success') {
                // 💡 サーバーでAUTO INCREMENTされた no を受け取ってセットする
                const newNo = response.data.no ?? String(Date.now());
                const createdRecord = { ...postData, no: String(newNo) };

                setOriginalBlacklist(prev => [createdRecord, ...prev]);
                setNewEntry(false);

                setNewEntryData({
                    no: '',
                    name: '',
                    brand: '全社',
                    date: '',
                    mail: '',
                    mobile: '',
                    zip: '',
                    full_address: '',
                    note: '',
                    show_key: '1'
                });
            } else {
                alert('登録に失敗しました: ' + response.data.message);
            }
        } catch (err) {
            console.error(err);
            alert('通信エラーが発生しました。');
        }
    };

    const formattedBrand = (brand: string) => {
        return brand.replace('PGH', 'PG HOUSE') ?? ''
    }

    return (
        <>
            <div className="bg-white p-4 rounded shadow-sm border">
                <div className="d-flex align-items-center mb-3 flex-wrap">
                    <div className="m-1">
                        <select className="form-select form-select-sm text-muted" style={{ fontSize: '12px' }} onChange={(e) => setTargetBrand(formattedBrand(e.target.value))} value={targetBrand}>
                            <option value=''>ブランドを選択</option>
                            {BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div className="m-1">
                        <input
                            type="text"
                            className="form-control form-control-sm text-muted"
                            style={{ fontSize: '12px', width: '200px' }}
                            placeholder="顧客名で検索"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                        />
                    </div>

                    <div className="ms-auto m-1">
                        {newEntry ? (
                            <div className="d-flex gap-2">
                                <button className="btn btn-success btn-sm px-3" style={{ fontSize: '12px', fontWeight: 'bold' }} onClick={handleSaveNewEntry}>
                                    <i className="fa-solid fa-check me-1"></i>登録する
                                </button>
                                <button className="btn btn-secondary btn-sm px-3" style={{ fontSize: '12px' }} onClick={() => setNewEntry(false)}>
                                    キャンセル
                                </button>
                            </div>
                        ) : (
                            <button className="btn btn-dark btn-sm px-3" style={{ fontSize: '12px', fontWeight: 'bold' }}
                                onClick={() => setNewEntry(true)}>
                                <i className="fa-solid fa-user-slash me-1"></i>対象者を追加
                            </button>
                        )}
                    </div>
                </div>

                <div className="table-responsive" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <Table hover className="align-middle mb-0" style={{ minWidth: '1800px' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                            <tr className="text-secondary border-bottom" style={{ fontSize: '12px', backgroundColor: '#f8f9fa' }}>
                                <th className="py-3 text-center" style={{ width: '60px' }}>No</th>
                                <th className="py-3" style={{ width: '160px' }}>顧客名</th>
                                <th className="py-3" style={{ width: '140px' }}>ブランド</th>
                                <th className="py-3" style={{ width: '100px' }}>登録日</th>
                                <th className="py-3" style={{ width: '200px' }}>メールアドレス</th>
                                <th className="py-3" style={{ width: '140px' }}>電話番号</th>
                                <th className="py-3" style={{ width: '110px' }}>郵便番号</th>
                                <th className="py-3" style={{ width: '300px' }}>住所</th>
                                <th className="py-3" style={{ width: '300px' }}>備考</th>
                                <th className="py-3 text-center" style={{ width: '120px' }}>設定</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '13px' }}>

                            {/* 新規登録行 */}
                            {newEntry && <tr className="table-primary border-bottom" style={{ backgroundColor: '#f0f7ff' }}>
                                <td className="p-2 text-center text-muted" style={{ fontSize: '12px' }}>自動</td>
                                <td className="p-2">
                                    <BsForm.Control size="sm" type="text" placeholder="顧客名" value={newEntryData.name} onChange={(e) => setNewEntryData(prev => ({ ...prev, name: e.target.value }))} className="fw-bold" style={{ fontSize: '12px' }} />
                                </td>
                                <td className="p-2">
                                    <BsForm.Select size="sm" value={newEntryData.brand} onChange={(e) => setNewEntryData(prev => ({ ...prev, brand: e.target.value }))} style={{ fontSize: '12px', cursor: 'pointer' }} disabled={brand === 'ordinary'}>
                                        {BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                                    </BsForm.Select>
                                </td>
                                <td className="p-2 text-muted" style={{ fontSize: '12px' }}>自動生成</td>
                                <td className="p-2">
                                    <BsForm.Control size="sm" type="email" placeholder="例: info@example.com" value={newEntryData.mail} onChange={(e) => setNewEntryData(prev => ({ ...prev, mail: e.target.value }))} style={{ fontSize: '12px' }} />
                                </td>
                                <td className="p-2">
                                    <BsForm.Control size="sm" type="text" placeholder="090-0000-0000" value={newEntryData.mobile} onChange={(e) => setNewEntryData(prev => ({ ...prev, mobile: e.target.value }))} style={{ fontSize: '12px' }} />
                                </td>
                                <td className="p-2">
                                    <BsForm.Control size="sm" type="text" placeholder="000-0000" value={newEntryData.zip} onChange={(e) => setNewEntryData(prev => ({ ...prev, zip: e.target.value }))} style={{ fontSize: '12px' }} />
                                </td>
                                <td className="p-2">
                                    <BsForm.Control size="sm" type="text" placeholder="都道府県市区町村 番地" value={newEntryData.full_address} onChange={(e) => setNewEntryData(prev => ({ ...prev, full_address: e.target.value }))} style={{ fontSize: '12px' }} />
                                </td>
                                <td className="p-2">
                                    <BsForm.Control as="textarea" rows={1} size="sm" placeholder="備考を入力" value={newEntryData.note} onChange={(e) => setNewEntryData(prev => ({ ...prev, note: e.target.value }))} style={{ fontSize: '12px', resize: 'none' }} />
                                </td>
                                <td className="text-center">
                                    <div className="d-flex justify-content-center">
                                        <BsForm.Check type="switch" checked={newEntryData.show_key === "1"} onChange={(e) => setNewEntryData(prev => ({ ...prev, show_key: e.target.checked ? "1" : "0" }))} style={{ cursor: 'pointer' }} disabled={brand === 'ordinary'} />
                                    </div>
                                </td>
                            </tr>}

                            {/* 既存ブラックリスト一覧 */}
                            {blacklist.sort((a, b) => {
                                const formattedDate = (date: string) => {
                                    const formate = date ? date.replace(/\\/g, '-') : '2000-01-01';
                                    return new Date(formate).getTime();
                                }
                                return formattedDate(b.date) - formattedDate(a.date)
                            })
                                .map((item, index) => (
                                    // 💡 key も item.no ベースに変更
                                    <tr key={item.no ?? index} className="border-bottom" style={{ transition: 'background-color 0.15s ease' }}>
                                        <td className="text-center text-muted" style={{ fontSize: '12px' }}>{item.no ?? '-'}</td>

                                        <td className="p-2">
                                            <BsForm.Control
                                                size="sm" type="text" value={safeFormat(item.name)}
                                                onChange={(e) => updateLocalState(item.no, 'name', e.target.value)}
                                                onBlur={(e) => handleChange(item.no, 'name', e.target.value)}
                                                className="fw-bold" style={{ fontSize: '12px' }} disabled={brand === 'ordinary'}
                                            />
                                        </td>

                                        <td className="p-2">
                                            <BsForm.Select
                                                size="sm" value={item.brand || '全社'}
                                                onChange={(e) => {
                                                    updateLocalState(item.no, 'brand', e.target.value);
                                                    handleChange(item.no, 'brand', e.target.value);
                                                }}
                                                style={{ fontSize: '12px', cursor: 'pointer' }} disabled={brand === 'ordinary'}
                                            >
                                                {BRAND_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                                            </BsForm.Select>
                                        </td>

                                        <td className="text-muted" style={{ fontSize: '12px', paddingLeft: '8px' }}>{safeFormat(item.date)}</td>

                                        <td className="p-2">
                                            <BsForm.Control
                                                size="sm" type="text" value={safeFormat(item.mail)}
                                                onChange={(e) => updateLocalState(item.no, 'mail', e.target.value)}
                                                onBlur={(e) => handleChange(item.no, 'mail', e.target.value)}
                                                style={{ fontSize: '12px' }} disabled={brand === 'ordinary'}
                                            />
                                        </td>

                                        <td className="p-2">
                                            <BsForm.Control
                                                size="sm" type="text" value={safeFormat(item.mobile)}
                                                onChange={(e) => updateLocalState(item.no, 'mobile', e.target.value)}
                                                onBlur={(e) => handleChange(item.no, 'mobile', e.target.value)}
                                                style={{ fontSize: '12px' }} disabled={brand === 'ordinary'}
                                            />
                                        </td>

                                        <td className="p-2">
                                            <BsForm.Control
                                                size="sm" type="text" value={safeFormat(item.zip)}
                                                onChange={(e) => updateLocalState(item.no, 'zip', e.target.value)}
                                                onBlur={(e) => handleChange(item.no, 'zip', e.target.value)}
                                                style={{ fontSize: '12px' }} disabled={brand === 'ordinary'}
                                            />
                                        </td>

                                        <td className="p-2">
                                            <BsForm.Control
                                                size="sm" type="text" value={safeFormat(item.full_address)}
                                                onChange={(e) => updateLocalState(item.no, 'full_address', e.target.value)}
                                                onBlur={(e) => handleChange(item.no, 'full_address', e.target.value)}
                                                style={{ fontSize: '12px' }} disabled={brand === 'ordinary'}
                                            />
                                        </td>

                                        <td className="p-2">
                                            <BsForm.Control
                                                as="textarea" rows={1} size="sm" value={safeFormat(item.note)}
                                                onChange={(e) => updateLocalState(item.no, 'note', e.target.value)}
                                                onBlur={(e) => handleChange(item.no, 'note', e.target.value)}
                                                style={{ fontSize: '12px' }} disabled={brand === 'ordinary'}
                                            />
                                        </td>

                                        <td className="text-center">
                                            <div className="d-flex justify-content-center">
                                                <BsForm.Check
                                                    type="switch"
                                                    id={`switch-showkey-${index}`}
                                                    checked={Number(item.show_key) === 1}
                                                    onChange={() => {
                                                        const newValue = Number(item.show_key) === 1 ? "0" : "1";
                                                        updateLocalState(item.no, 'show_key', newValue);
                                                        handleChange(item.no, 'show_key', newValue);
                                                    }}
                                                    style={{ cursor: 'pointer' }}
                                                    disabled={brand === 'ordinary'}
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
    )
}

export default EditBlackList;