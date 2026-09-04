import React, { useEffect, useState, useRef, useMemo, useContext } from 'react';
import { Table, Spinner, Alert, Modal } from 'react-bootstrap';
// ⚠️ 2026-09-06 に list/ から header/ へ移動した。listUtils は list/ に残している
//   （ListOrder / ListKaeru / ListResale も使っており、こちらへ移すと影響が広い）
import { styles, positions ,formatToYYYYMMDD} from '../list/listUtils';
import apiClient from '../../utils/apiClient';
import { generateULID } from '../../utils/createULID';
import { thisYear } from '../../utils/thisYear';
import AuthContext from '../../context/AuthContext';

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
    mail: string;
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
    remarks: string;
    title: string;
    shop: string;
    sync: number | null;
};

type Staff = {
    name: string;
    shop: string;
    period: string;
    position: string;
    rank: string;
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

const brands: Record<string, string> = {
    'KH': '国分ハウジング',
    'DJ': 'デイジャストハウス',
    'なご': 'なごみ工務店',
    '2L': 'ニーエルホーム',
    'JH': 'ジャスフィーホーム',
    'FH': 'フルコミホーム',
    'PG': 'PG HOUSE'
};

// 行の配色(inline styleでは .table のセル背景に負けるため Bootstrap の配色クラスを使用)
const getRowClass = (item: CustomerData) => {
    if (item.sync === 1) return 'table-primary';
    const house = item.house || '';
    if (house.includes('賃貸')) return 'table-info';
    if (house.includes('持ち家')) return 'table-warning';
    return '';
};

// 顧客取込(insert)用のペイロードを生成
const createSyncPayload = (item: CustomerData): Record<string, string> => ({
    id: generateULID(),
    customer_contacts_name: item.name || '',
    full_address: `${item.address || ''}${item.street || ''}`,
    step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99: formatToYYYYMMDD(item.check_in_time),
    customer_contacts_mobile_phone_number: item.phone || '',
    customer_contacts_email: item.mail || '',
    postal_code: item.zip || '',
    sales_promotion_name: 'イベント',
    customized_input_01JRCT12N9X24PCQ5QZPAYKB93: item.title || '',
    status: '見込み',
    planned_construction_site: item.area || '',
    brand: brands[(item.shop || '').slice(0, 2)] || ''
});

// 極限まで高さを削るための共通スタイル
const compactInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '2px 4px',
    fontSize: '10px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    outline: 'none',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
    height: '24px',
};

const thStyle: React.CSSProperties = {
    ...styles.label,
    display: 'table-cell',
    padding: '4px 8px',
    borderBottom: '1px solid #e9ecef',
    backgroundColor: '#f6f9fc',
    color: '#8898aa',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    fontSize: '11px',
};

type Props = {
    eventSummary: boolean,
    setEventSummary: React.Dispatch<React.SetStateAction<boolean>>
}

const EventList = ({ eventSummary, setEventSummary }: Props) => {
    const { category } = useContext(AuthContext);
    const [data, setData] = useState<CustomerData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [targetEvent, setTargetEvent] = useState('');
    const [targetShop, setTargetShop] = useState('');
    const [isVisited, setIsVisited] = useState<number | null>(null);
    const [staffArray, setStaffArray] = useState<Staff[]>([]);
    // 同期(担当者選択)モーダル用の状態
    const [syncShow, setSyncShow] = useState(false);
    const [syncTarget, setSyncTarget] = useState<CustomerData | null>(null);
    const [targetStaff, setTargetStaff] = useState('');
    const rowRefs = useRef<{ [key: string]: { [field: string]: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null } }>({});

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // キャッシュバスターを残しつつ、最新データを取得
            const payload = {
                request: 'list',
                roll: 'event',
                function: 'load',
                category,
                _t: Date.now()
            };
            const response = await apiClient.post('', payload);
            setData(response.data.summary);
            const positionIndex = (position: string) => {
                const index = positions.indexOf(position);
                return index === -1 ? positions.length : index;
            };
            const responseStaff = response.data.staff
                .filter((s: Staff) => s.period === String(thisYear) && Number(s.rank) === 1)
                .sort((a: Staff, b: Staff) => positionIndex(a.position) - positionIndex(b.position));
            setStaffArray(responseStaff);
        } catch (err) {
            setError("データの取得に失敗しました");
            console.error(err)
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (eventSummary) {
            fetchData();
        }
    }, [eventSummary]);

    // ==========================================
    // 💡 追加: 外部からデータが再取得された際に、
    // rowRefs を使って強制的に画面の DOM (value) を上書き同期する
    // ==========================================
    useEffect(() => {
        data.forEach(item => {
            const refs = rowRefs.current[item.id];
            if (!refs) return;

            const fields: (keyof CustomerData)[] = [
                'time', 'name', 'phone', 'zip', 'address', 'street',
                'age', 'adult', 'child', 'house', 'medium', 'area',
                'check_in_time', 'check_out_time', 'question', 'remarks'
            ];

            fields.forEach(field => {
                const el = refs[field];
                if (el) {
                    const newValue = item[field] || '';
                    if (el.value !== String(newValue)) {
                        el.value = String(newValue);
                    }
                }
            });
        });
    }, [data]); // dataが更新されるたびに発火

    // ==========================================
    // 取得データから絞り込み用の選択肢(ユニーク値)を生成
    // ==========================================
    const eventArray = useMemo(() => Array.from(new Set(data.map(item => item.title).filter(value => !!value))), [data]);

    const shopArray = useMemo(() => Array.from(new Set(data.map(item => item.shop).filter(value => !!value))), [data]);

    // ==========================================
    // イベント名・店舗・来場状況による絞り込み
    // ==========================================
    const filteredData = useMemo(() => {
        return data.filter(item => {
            const visited = !!item.check_in_time && item.check_in_time !== '';
            return (
                (targetEvent === '' || (item.title || '') === targetEvent) &&
                (targetShop === '' || (item.shop || '') === targetShop) &&
                (isVisited === null || (isVisited === 1 ? visited : !visited))
            );
        });
    }, [data, targetEvent, targetShop, isVisited]);

    const sortedData = useMemo(() => {
        return [...filteredData].sort((a, b) => Number(b.no) - Number(a.no));
    }, [filteredData]);

    // 1項目のみを更新するAPI呼び出し(handleBlur / チェックボックス / 同期完了で共用)
    const updateField = async (id: string, field: string, value: string | number) => {
        try {
            await apiClient.post('', {
                id,
                request: 'list',
                roll: 'event',
                function: 'update',
                category,
                [field]: value
            });
        } catch (e) {
            console.error(e);
        }
    };

    const handleBlur = (id: string, field: keyof CustomerData) => {
        const element = rowRefs.current[id]?.[field];
        if (!element) return;

        const newValue = element.value;
        const currentData = data.find(item => item.id === id);

        if (currentData && currentData[field] === newValue) return;

        setData(prev => prev.map(item => item.id === id ? { ...item, [field]: newValue } : item));
        updateField(id, field, newValue);
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
        updateField(id, 'interview', newValue);
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

    const reload = () => {
        fetchData();
    };

    // 対象行の店舗に紐づくスタッフ + 「〇〇店 管理」
    const staffOptions = useMemo(() => {
        if (!syncTarget) return [];
        return [...staffArray.filter(s => s.shop === syncTarget.shop).map(s => s.name), `${syncTarget.shop} 管理`];
    }, [staffArray, syncTarget]);

    const handleSync = (item: CustomerData) => {
        setSyncTarget(item);
        setTargetStaff('');
        setSyncShow(true);
    };

    // 同期成功(status === 'success')後のUI更新
    const syncSuccess = (id: string) => {
        setData(prev => prev.map(item => item.id === id ? { ...item, sync: 1 } : item));
        updateField(id, 'sync', 1);
        setSyncShow(false);
        setSyncTarget(null);
        setTargetStaff('');
    };

    const syncStart = async () => {
        if (!syncTarget || targetStaff === '') {
            alert('スタッフを選択してください');
            return;
        }

        const postData: Record<string, string> = {
            ...createSyncPayload(syncTarget),
            in_charge_user: targetStaff,
            in_charge_store: syncTarget.shop,
            request: 'list',
            roll: 'insert',
            category
        };

        try {
            const response = await apiClient.post('', postData);
            if (response.data.status === 'success') {
                syncSuccess(syncTarget.id);
            } else {
                alert('同期に失敗しました。');
            }
        } catch (e) {
            console.error(e);
            alert('同期に失敗しました。');
        }
    };

    return (
        <>
            <Modal show={eventSummary} onHide={() => setEventSummary(false)} fullscreen>
                <Modal.Header closeButton className="py-2">
                    <Modal.Title style={{ fontSize: '14px', fontWeight: 'bold', color: '#32325d' }}>住まいるフェスティバル予約状況</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-2" style={{ backgroundColor: '#f8f9fe' }}>

                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="d-flex gap-2">
                            <button style={{ ...styles.buttonSecondary, padding: '4px 10px', fontSize: '11px' }} onClick={openUrl}>
                                <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>特設URLはこちら
                            </button>
                            <button style={{ ...styles.buttonPrimary, padding: '4px 10px', fontSize: '11px' }} onClick={reload} disabled={loading}>
                                {loading ? <Spinner size="sm" animation="border" className="me-1" /> : <i className="fa-solid fa-rotate-right me-1"></i>}
                                リロード
                            </button>
                            <button style={{ ...styles.buttonDanger, padding: '4px 10px', fontSize: '11px' }} onClick={() => setEventSummary(false)} disabled={loading}>
                                <i className="fa-solid fa-xmark me-1"></i>閉じる
                            </button>
                        </div>

                        {/* 💡 追加: 絞り込み用セレクトタグ */}
                        <div className="d-flex gap-2 align-items-center">
                            <select style={{ ...compactInputStyle, width: 'auto' }} value={targetEvent} onChange={(e) => setTargetEvent(e.target.value)}>
                                <option value="">全イベント表示</option>
                                {eventArray.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                            <select style={{ ...compactInputStyle, width: 'auto' }} value={targetShop} onChange={(e) => setTargetShop(e.target.value)}>
                                <option value="">全店舗表示</option>
                                {shopArray.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                            <select style={{ ...compactInputStyle, width: 'auto' }} value={isVisited === null ? '' : String(isVisited)}
                                onChange={(e) => setIsVisited(e.target.value === '' ? null : Number(e.target.value))}>
                                <option value="">来場状況</option>
                                <option value="1">来場済み</option>
                                <option value="0">未来場</option>
                            </select>
                        </div>
                    </div>

                    {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}

                    <div className="bg-white rounded shadow-sm border table-responsive">
                        <Table hover className="m-0 align-top text-nowrap" style={{ minWidth: '1800px' }}>
                            <thead>
                                <tr>
                                    <th style={{ ...thStyle, width: '40px' }}>同期</th>
                                    <th style={{ ...thStyle, width: '80px' }}>来場予定</th>
                                    <th style={{ ...thStyle, width: '100px' }}>お名前</th>
                                    <th style={{ ...thStyle, width: '100px' }}>電話番号</th>
                                    <th style={{ ...thStyle, width: '80px' }}>郵便番号</th>
                                    <th style={{ ...thStyle, width: '250px' }}>住所</th>
                                    <th style={{ ...thStyle, width: '250px' }}>世帯情報</th>
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
                                {sortedData.map((item, index) => {
                                    const hasCheckIn = !!item.check_in_time && item.check_in_time !== '';
                                    const hasCheckOut = !!item.check_out_time && item.check_out_time !== '';
                                    let statusIcon;

                                    if (hasCheckIn && !hasCheckOut) {
                                        statusIcon = <i className="fa-solid fa-arrow-right-to-bracket text-success" title="チェックイン"></i>;
                                    } else if (hasCheckIn && hasCheckOut) {
                                        statusIcon = <i className="fa-solid fa-check-double text-secondary" title="チェックアウト"></i>;
                                    }

                                    return (
                                        <tr key={item.id} className={getRowClass(item)}>
                                            <td className="p-1 align-middle text-center fw-bold" style={{ fontSize: '10px' }}>
                                                <div className="d-flex align-items-center gap-1">
                                                    <span>{index + 1}</span>
                                                    {statusIcon && <span style={{ fontSize: '12px' }}>{statusIcon}</span>}
                                                    {item.sync === 1
                                                        ? <span style={{ fontSize: '9px' ,color: 'red'}}>同期済み</span>
                                                        : <i className='fa-solid fa-arrows-rotate pointer' onClick={() => handleSync(item)}></i>}
                                                </div>
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
                                                    <input type="text" style={{ ...compactInputStyle, width: '40%' }} placeholder="市区町村" ref={setRef(item.id, 'address')} defaultValue={item.address} onBlur={() => handleBlur(item.id, 'address')} />
                                                    <input type="text" style={{ ...compactInputStyle, width: '60%' }} placeholder="番地・建物" ref={setRef(item.id, 'street')} defaultValue={item.street} onBlur={() => handleBlur(item.id, 'street')} />
                                                </div>
                                            </td>
                                            <td className="p-1 align-middle">
                                                <div className="d-flex gap-1">
                                                    <select style={{ ...compactInputStyle, padding: '0 2px' }} ref={setRef(item.id, 'age')} defaultValue={item.age} onBlur={() => handleBlur(item.id, 'age')}>
                                                        {OPTIONS.age.map(opt => <option key={opt} value={opt}>{opt.replace('歳代', '代')}</option>)}
                                                    </select>
                                                    <select style={{ ...compactInputStyle, padding: '0 2px' }} ref={setRef(item.id, 'adult')} defaultValue={item.adult} onBlur={() => handleBlur(item.id, 'adult')}>
                                                        <option value="">大人</option>
                                                        {OPTIONS.adult.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                    <select style={{ ...compactInputStyle, padding: '0 2px' }} ref={setRef(item.id, 'child')} defaultValue={item.child} onBlur={() => handleBlur(item.id, 'child')}>
                                                        <option value="">子</option>
                                                        {OPTIONS.child.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                    </select>
                                                    <select style={{ ...compactInputStyle, padding: '0 2px' }} ref={setRef(item.id, 'house')} defaultValue={item.house} onBlur={() => handleBlur(item.id, 'house')}>
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
                                                                {opt.replace('の相談', '')}
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
                                    );
                                })}
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

            {/* 💡 追加: 担当者選択モーダル */}
            <Modal show={syncShow} onHide={() => setSyncShow(false)} centered size="sm">
                <Modal.Header closeButton className="py-2">
                    <Modal.Title style={{ fontSize: '13px', fontWeight: 'bold', color: '#32325d' }}>担当営業の選択</Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-3">
                    <div className="mb-2" style={{ fontSize: '11px', color: '#8898aa' }}>
                        {syncTarget ? `${syncTarget.shop} / ${syncTarget.name} 様` : ''}
                    </div>
                    <select style={{ ...compactInputStyle, height: '28px', fontSize: '12px' }} value={targetStaff} onChange={(e) => setTargetStaff(e.target.value)}>
                        <option value="">担当営業を選択</option>
                        {staffOptions.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <button className='mt-2'
                        style={{ ...styles.buttonDanger, padding: '0px 10px', fontSize: '11px' }}
                        onClick={syncStart}>
                        <i className="fa-solid fa-rotate me-1"></i>同期する
                    </button>
                </Modal.Body>
            </Modal>
        </>
    );
};

export default EventList;