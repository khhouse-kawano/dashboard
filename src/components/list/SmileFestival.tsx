import React, { useEffect, useState, useRef } from 'react';
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

const thStyle: React.CSSProperties = {
    ...styles.label,
    display: 'table-cell',
    padding: '12px 10px',
    borderBottom: '1px solid #e9ecef',
    backgroundColor: '#f6f9fc',
    color: '#8898aa',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle'
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
            setData(response.data.summary)
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

        const fetchData = async () => {
            try {
                const response = await apiClient.post('', payload);
                console.log(response.data.status);
            } catch (e) {
                console.error(e);
            }
        }

        console.log(`Update [${id}] ${field} => ${newValue}`);

        fetchData();
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

        const fetchData = async () => {
            try {
                const response = await apiClient.post('', payload);
                console.log(response.data.status);
            } catch (e) {
                console.error(e);
            }
        }

        console.log(`Update Checkbox [${id}] interview => ${newValue}`);

        fetchData();
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
            <Modal.Header closeButton>
                <Modal.Title style={{ fontSize: '16px', fontWeight: 'bold', color: '#32325d' }}>住まいるフェスティバル予約状況</Modal.Title>
            </Modal.Header>
            <Modal.Body className="p-3" style={{ backgroundColor: '#f8f9fe' }}>

                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex gap-2">
                        <button style={styles.buttonSecondary} onClick={openUrl}>
                            <i className="fa-solid fa-arrow-up-right-from-square me-2"></i>特設URLはこちら
                        </button>
                        <button style={styles.buttonPrimary} onClick={fetchData} disabled={loading}>
                            {loading ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="fa-solid fa-rotate-right me-2"></i>}
                            リロード
                        </button>
                    </div>
                </div>

                {error && <Alert variant="danger">{error}</Alert>}

                <div className="bg-white rounded shadow-sm border table-responsive">
                    {/* ★ minWidth をしっかり広げてセルが潰れないように設定 (列追加に伴い 2500px に拡張) */}
                    <Table hover className="m-0 align-top text-nowrap" style={{ minWidth: '2500px' }}>
                        <thead>
                            <tr>
                                <th style={{ ...thStyle, minWidth: '100px' }}>来場予定</th>
                                <th style={{ ...thStyle, minWidth: '130px' }}>お名前</th>
                                <th style={{ ...thStyle, minWidth: '130px' }}>電話番号</th>
                                <th style={{ ...thStyle, minWidth: '100px' }}>郵便番号</th>
                                <th style={{ ...thStyle, minWidth: '350px' }}>住所</th>
                                <th style={{ ...thStyle, minWidth: '450px' }}>世帯情報</th>
                                <th style={{ ...thStyle, minWidth: '250px', whiteSpace: 'normal' }}>相談内容</th>
                                <th style={{ ...thStyle, minWidth: '130px' }}>きっかけ</th>
                                <th style={{ ...thStyle, minWidth: '130px' }}>希望エリア</th>
                                <th style={{ ...thStyle, minWidth: '160px' }}>チェックイン</th>
                                <th style={{ ...thStyle, minWidth: '160px' }}>チェックアウト</th>
                                <th style={{ ...thStyle, minWidth: '220px' }}>事前質問</th>
                                <th style={{ ...thStyle, minWidth: '220px' }}>備考欄</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(item => (
                                <tr key={item.id}>
                                    {/* 来場予定時間 */}
                                    <td className="p-2 align-middle">
                                        <select style={styles.input} ref={setRef(item.id, 'time')} defaultValue={item.time} onBlur={() => handleBlur(item.id, 'time')}>
                                            {OPTIONS.time.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </td>

                                    {/* お名前 */}
                                    <td className="p-2 align-middle">
                                        <input type="text" style={styles.input} ref={setRef(item.id, 'name')} defaultValue={item.name} onBlur={() => handleBlur(item.id, 'name')} />
                                    </td>

                                    {/* 電話番号 */}
                                    <td className="p-2 align-middle">
                                        <input type="text" style={styles.input} ref={setRef(item.id, 'phone')} defaultValue={item.phone} onBlur={() => handleBlur(item.id, 'phone')} />
                                    </td>

                                    {/* 郵便番号 */}
                                    <td className="p-2 align-middle">
                                        <input type="text" style={styles.input} ref={setRef(item.id, 'zip')} defaultValue={item.zip} onBlur={() => handleBlur(item.id, 'zip')} />
                                    </td>

                                    {/* 住所 (横並び) */}
                                    <td className="p-2 align-middle">
                                        <div className="d-flex gap-2">
                                            <input type="text" style={styles.input} placeholder="市区町村" ref={setRef(item.id, 'address')} defaultValue={item.address} onBlur={() => handleBlur(item.id, 'address')} />
                                            <input type="text" style={styles.input} placeholder="番地・建物" ref={setRef(item.id, 'street')} defaultValue={item.street} onBlur={() => handleBlur(item.id, 'street')} />
                                        </div>
                                    </td>

                                    {/* 世帯情報 (すべて横並び) */}
                                    <td className="p-2 align-middle">
                                        <div className="d-flex gap-2">
                                            <select style={styles.input} ref={setRef(item.id, 'age')} defaultValue={item.age} onBlur={() => handleBlur(item.id, 'age')}>
                                                {OPTIONS.age.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                            <select style={styles.input} ref={setRef(item.id, 'adult')} defaultValue={item.adult} onBlur={() => handleBlur(item.id, 'adult')}>
                                                <option value="">大人</option>
                                                {OPTIONS.adult.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                            <select style={styles.input} ref={setRef(item.id, 'child')} defaultValue={item.child} onBlur={() => handleBlur(item.id, 'child')}>
                                                <option value="">子供</option>
                                                {OPTIONS.child.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                            <select style={styles.input} ref={setRef(item.id, 'house')} defaultValue={item.house} onBlur={() => handleBlur(item.id, 'house')}>
                                                {OPTIONS.house.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </div>
                                    </td>

                                    {/* 相談内容 (Checkbox・ここだけ折り返し許可) */}
                                    <td className="p-2 align-middle" style={{ whiteSpace: 'normal' }}>
                                        <div className="d-flex flex-wrap gap-2" style={{ fontSize: '11px', color: '#303030' }}>
                                            {OPTIONS.interview.map(opt => {
                                                const isChecked = item.interview ? item.interview.split(',').includes(opt) : false;
                                                return (
                                                    <label key={opt} className="d-flex align-items-center m-0" style={{ cursor: 'pointer' }}>
                                                        <input
                                                            type="checkbox"
                                                            className="me-1"
                                                            checked={isChecked}
                                                            onChange={(e) => handleCheckboxChange(item.id, opt, e.target.checked)}
                                                        />
                                                        {opt}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </td>

                                    {/* きっかけ */}
                                    <td className="p-2 align-middle">
                                        <select style={styles.input} ref={setRef(item.id, 'medium')} defaultValue={item.medium} onBlur={() => handleBlur(item.id, 'medium')}>
                                            {OPTIONS.medium.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                    </td>

                                    {/* 建築希望エリア */}
                                    <td className="p-2 align-middle">
                                        <input type="text" style={styles.input} ref={setRef(item.id, 'area')} defaultValue={item.area} onBlur={() => handleBlur(item.id, 'area')} />
                                    </td>

                                    {/* チェックイン */}
                                    <td className="p-2 align-middle">
                                        <input type="text" style={styles.input} placeholder="例: 2026/03/21 10:05" ref={setRef(item.id, 'check_in_time')} defaultValue={item.check_in_time || ''} onBlur={() => handleBlur(item.id, 'check_in_time')} />
                                    </td>

                                    {/* チェックアウト */}
                                    <td className="p-2 align-middle">
                                        <input type="text" style={styles.input} placeholder="例: 2026/03/21 11:30" ref={setRef(item.id, 'check_out_time')} defaultValue={item.check_out_time || ''} onBlur={() => handleBlur(item.id, 'check_out_time')} />
                                    </td>

                                    {/* 事前質問 */}
                                    <td className="p-2 align-middle">
                                        <textarea style={{ ...styles.textarea, height: '80px', resize: 'none' }} ref={setRef(item.id, 'question')} defaultValue={item.question} onBlur={() => handleBlur(item.id, 'question')}></textarea>
                                    </td>

                                    {/* 備考欄 */}
                                    <td className="p-2 align-middle">
                                        <textarea
                                            style={{ ...styles.textarea, height: '80px', resize: 'none' }}
                                            placeholder="受付スタッフ用メモ..."
                                            ref={setRef(item.id, 'remarks')}
                                            defaultValue={item.remarks}
                                            onBlur={() => handleBlur(item.id, 'remarks')}
                                        ></textarea>
                                    </td>
                                </tr>
                            ))}
                            {data.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={13} className="text-center p-5 text-muted">データがありません</td>
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