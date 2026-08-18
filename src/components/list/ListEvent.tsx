import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Table, Spinner, Alert, Modal } from 'react-bootstrap';
import { styles } from './listUtils';
import apiClient from '../../utils/apiClient';

type CustomerData = {
    no: string;
    id: string;
    time: string;
    date: string;
    name: string;
    zip: string;
    address: string;
    street: string;
    phone: string;
    age: string;
    adult: string;
    child: string;
    house: string;
    interview: string;
    medium: string;
    area: string;
    question: string;
    status: string;
    check_in_time: string | null;
    check_out_time: string | null;
    remarks: string; // 備考欄
};

// --- セレクトボックスの選択肢 ---
const OPTIONS = {
    time: ['10:00~', '10:30~', '11:00~', '11:30~', '12:00~', '12:30~', '13:00~', '13:30~', '14:00~', '14:30~', '15:00~', '15:30~'],
    age: ['20～25歳代', '26～30歳代', '31～35歳代', '36～40歳代', '41～45歳代', '46～50歳代', '51～55歳代', '55～60歳代', '61～65歳代', '65～70歳代', '71歳以上'],
    adult: ['1人', '2人', '3人', '4人以上'],
    child: ['0人', '1人', '2人', '3人', '4人以上'],
    house: ['賃貸', '持ち家（マンション含む）', 'その他'],
    medium: ['チラシ', '紹介', 'SNS広告', 'インターネット検索'],
    interview: ['注文住宅の相談', '建売住宅の相談', '不動産売却・相続の相談', '中古住宅の相談', '資金計画・ライフプランの相談', 'ブースで遊びたい'],
};

// 💡 修正: 極限まで高さを削るための共通スタイル
const compactInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '2px 4px',
    fontSize: '10px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    outline: 'none',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
    height: '24px', // 高さを強制的に低く設定
};

const thStyle: React.CSSProperties = {
    ...styles.label,
    display: 'table-cell',
    padding: '4px 8px', // 💡 修正: パディングを最小限に
    borderBottom: '1px solid #e9ecef',
    backgroundColor: '#f6f9fc',
    color: '#8898aa',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    fontSize: '11px', // 💡 修正: フォントサイズ縮小
};

type Props = {
    eventSummary: boolean,
    setEventSummary: React.Dispatch<React.SetStateAction<boolean>>
}

const SmileFestival = ({ eventSummary, setEventSummary }: Props) => {
    const [data, setData] = useState<CustomerData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const rowRefs = useRef<{ [key: string]: { [field: string]: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null } }>({});

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.post('', { request: 'list', roll: 'smile2026', function: 'load', category: 'common' });
            setData(response.data.summary);
            setLoading(false);
        } catch (err) {
            setError("データの取得に失敗しました");
            setLoading(false);
        }
    };

    useEffect(() => {
        if (eventSummary) {
            fetchData();
        }
    }, [eventSummary]);

    // 💡 修正: NOの大きい順（降順）にソート
    const sortedData = useMemo(() => {
        return [...data].sort((a, b) => Number(b.no) - Number(a.no));
    }, [data]);

    const handleBlur = (id: string, field: keyof CustomerData) => {
        const element = rowRefs.current[id]?.[field];
        if (!element) return;

        const newValue = element.value;
        const currentData = data.find(item => item.id === id);

        if (currentData && currentData[field] === newValue) return;

        setData(prev => prev.map(item => item.id === id ? { ...item, [field]: newValue } : item));

        const payload = {
            id,
            request: 'list',
            roll: 'smile2026',
            function: 'update',
            category: 'common',
            [field]: newValue
        };

        const executeUpdate = async () => {
            try {
                const response = await apiClient.post('', payload);
                console.log(response.data.status);
            } catch (e) {
                console.error(e);
            }
        }
        executeUpdate();
    };

    const handleCheckboxChange = (id: string, option: string, isChecked: boolean) => {
        const currentData = data.find(item => item.id === id);
        if (!currentData) return;

        const currentInterviews = currentData.interview ? currentData.interview.split(',') : [];
        let newInterviews = [...currentInterviews];

        if (isChecked) {
            if (!newInterviews.includes(option)) newInterviews.push(option);
        } else {
            newInterviews = newInterviews.filter(item => item !== option);
        }

        const newValue = newInterviews.join(',');
        setData(prev => prev.map(item => item.id === id ? { ...item, interview: newValue } : item));
        
        const payload = {
            id,
            request: 'list',
            roll: 'smile2026',
            function: 'update',
            category: 'common',
            interview: newValue
        };

        const executeUpdate = async () => {
            try {
                const response = await apiClient.post('', payload);
                console.log(response.data.status);
            } catch (e) {
                console.error(e);
            }
        }
        executeUpdate();
    };

    const setRef = (id: string, field: string) => (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => {
        if (!rowRefs.current[id]) {
            rowRefs.current[id] = {};
        }
        rowRefs.current[id][field] = el;
    };

    const openUrl = () => {
        window.open('https://kh-house.jp/lp/smilefes_akune_2025/', '_blank');
    };

    return (
        <Modal show={eventSummary} onHide={() => setEventSummary(false)} size="xl">
            <Modal.Header closeButton className="py-2">
                <Modal.Title style={{ fontSize: '14px', fontWeight: 'bold', color: '#32325d' }}>住まいるフェスティバル予約状況</Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-2" style={{ backgroundColor: '#f8f9fe' }}>

                <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex gap-2">
                        <button style={{ ...styles.buttonSecondary, padding: '4px 10px', fontSize: '11px' }} onClick={openUrl}>
                            <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>特設URLはこちら
                        </button>
                        <button style={{ ...styles.buttonPrimary, padding: '4px 10px', fontSize: '11px' }} onClick={fetchData} disabled={loading}>
                            {loading ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="fa-solid fa-rotate-right me-1"></i>}
                            リロード
                        </button>
                    </div>
                </div>

                {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}

                <div className="bg-white rounded shadow-sm border table-responsive">
                    <Table hover className="m-0 align-top text-nowrap" style={{ minWidth: '1800px' }}>
                        <thead>
                            <tr>
                                {/* 💡 修正: 限界まで幅を狭めたカラム定義とインデックスの追加 */}
                                <th style={{ ...thStyle, width: '30px' }}>#</th>
                                <th style={{ ...thStyle, width: '80px' }}>来場予定</th>
                                <th style={{ ...thStyle, width: '100px' }}>お名前</th>
                                <th style={{ ...thStyle, width: '100px' }}>電話番号</th>
                                <th style={{ ...thStyle, width: '80px' }}>郵便番号</th>
                                <th style={{ ...thStyle, width: '250px' }}>住所</th>
                                <th style={{ ...thStyle, width: '180px' }}>世帯情報</th>
                                <th style={{ ...thStyle, width: '250px', whiteSpace: 'normal' }}>相談内容</th>
                                <th style={{ ...thStyle, width: '100px' }}>きっかけ</th>
                                <th style={{ ...thStyle, width: '120px' }}>希望エリア</th>
                                <th style={{ ...thStyle, width: '130px' }}>チェックイン</th>
                                <th style={{ ...thStyle, width: '130px' }}>チェックアウト</th>
                                <th style={{ ...thStyle, width: '180px' }}>事前質問</th>
                                <th style={{ ...thStyle, width: '180px' }}>備考欄</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.map((item, index) => (
                                <tr key={item.id}>
                                    {/* 💡 追加: 連番表示 */}
                                    <td className="p-1 align-middle text-center text-muted fw-bold" style={{ fontSize: '10px' }}>
                                        {index + 1}
                                    </td>
                                    <td className="p-1 align-middle">
                                        <select style={compactInputStyle} ref={setRef(item.id, 'time')} defaultValue={item.time} onBlur={() => handleBlur(item.id, 'time')}>
                                            {OPTIONS.time.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-1 align-middle">
                                        <input type="text" style={compactInputStyle} ref={setRef(item.id, 'name')} defaultValue={item.name} onBlur={() => handleBlur(item.id, 'name')} />
                                    </td>
                                    <td className="p-1 align-middle">
                                        <input type="text" style={compactInputStyle} ref={setRef(item.id, 'phone')} defaultValue={item.phone} onBlur={() => handleBlur(item.id, 'phone')} />
                                    </td>
                                    <td className="p-1 align-middle">
                                        <input type="text" style={compactInputStyle} ref={setRef(item.id, 'zip')} defaultValue={item.zip} onBlur={() => handleBlur(item.id, 'zip')} />
                                    </td>
                                    <td className="p-1 align-middle">
                                        <div className="d-flex gap-1">
                                            <input type="text" style={{...compactInputStyle, width: '40%'}} placeholder="市区町村" ref={setRef(item.id, 'address')} defaultValue={item.address} onBlur={() => handleBlur(item.id, 'address')} />
                                            <input type="text" style={{...compactInputStyle, width: '60%'}} placeholder="番地・建物" ref={setRef(item.id, 'street')} defaultValue={item.street} onBlur={() => handleBlur(item.id, 'street')} />
                                        </div>
                                    </td>
                                    <td className="p-1 align-middle">
                                        <div className="d-flex gap-1">
                                            <select style={{...compactInputStyle, padding: '0 2px'}} ref={setRef(item.id, 'age')} defaultValue={item.age} onBlur={() => handleBlur(item.id, 'age')}>
                                                {OPTIONS.age.map(opt => <option key={opt} value={opt}>{opt.replace('歳代', '代')}</option>)}
                                            </select>
                                            <select style={{...compactInputStyle, padding: '0 2px'}} ref={setRef(item.id, 'adult')} defaultValue={item.adult} onBlur={() => handleBlur(item.id, 'adult')}>
                                                <option value="">大人</option>
                                                {OPTIONS.adult.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                            <select style={{...compactInputStyle, padding: '0 2px'}} ref={setRef(item.id, 'child')} defaultValue={item.child} onBlur={() => handleBlur(item.id, 'child')}>
                                                <option value="">子</option>
                                                {OPTIONS.child.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                            <select style={{...compactInputStyle, padding: '0 2px'}} ref={setRef(item.id, 'house')} defaultValue={item.house} onBlur={() => handleBlur(item.id, 'house')}>
                                                {OPTIONS.house.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                    </td>
                                    <td className="p-1 align-middle" style={{ whiteSpace: 'normal', lineHeight: '1.2' }}>
                                        <div className="d-flex flex-wrap gap-1" style={{ fontSize: '10px', color: '#303030' }}>
                                            {OPTIONS.interview.map(opt => {
                                                const isChecked = item.interview ? item.interview.split(',').includes(opt) : false;
                                                return (
                                                    <label key={opt} className="d-flex align-items-center m-0" style={{ cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            style={{ transform: 'scale(0.8)', margin: '0 2px 0 0' }}
                                                            checked={isChecked}
                                                            onChange={(e) => handleCheckboxChange(item.id, opt, e.target.checked)}
                                                        />
                                                        {opt.replace('の相談', '')} {/* 💡 テキスト短縮 */}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </td>
                                    <td className="p-1 align-middle">
                                        <select style={compactInputStyle} ref={setRef(item.id, 'medium')} defaultValue={item.medium} onBlur={() => handleBlur(item.id, 'medium')}>
                                            {OPTIONS.medium.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-1 align-middle">
                                        <input type="text" style={compactInputStyle} ref={setRef(item.id, 'area')} defaultValue={item.area} onBlur={() => handleBlur(item.id, 'area')} />
                                    </td>
                                    <td className="p-1 align-middle">
                                        <input type="text" style={compactInputStyle} placeholder="2026/03/21 10:05" ref={setRef(item.id, 'check_in_time')} defaultValue={item.check_in_time || ''} onBlur={() => handleBlur(item.id, 'check_in_time')} />
                                    </td>
                                    <td className="p-1 align-middle">
                                        <input type="text" style={compactInputStyle} placeholder="2026/03/21 11:30" ref={setRef(item.id, 'check_out_time')} defaultValue={item.check_out_time || ''} onBlur={() => handleBlur(item.id, 'check_out_time')} />
                                    </td>
                                    <td className="p-1 align-middle">
                                        <textarea style={{ ...compactInputStyle, height: '40px', resize: 'none' }} ref={setRef(item.id, 'question')} defaultValue={item.question} onBlur={() => handleBlur(item.id, 'question')}></textarea>
                                    </td>
                                    <td className="p-1 align-middle">
                                        <textarea
                                            style={{ ...compactInputStyle, height: '40px', resize: 'none' }}
                                            placeholder="受付スタッフ用メモ..."
                                            ref={setRef(item.id, 'remarks')}
                                            defaultValue={item.remarks}
                                            onBlur={() => handleBlur(item.id, 'remarks')}
                                        ></textarea>
                                    </td>
                                </tr>
                            ))}
                            {sortedData.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={14} className="text-center p-4 text-muted" style={{ fontSize: '11px' }}>データがありません</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default SmileFestival;