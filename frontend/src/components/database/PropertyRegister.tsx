import React, { useEffect, useState, useMemo } from 'react'
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';
import { removeAllSpaces } from './databaseUtils';

const styles = {
    label: { color: '#303030', fontSize: '11px', marginBottom: '4px', letterSpacing: '.6px', fontWeight: '500', display: 'flex', alignItems: 'center' },
    input: { border: '1px solid #D3D3D3', borderRadius: '4px', height: '35px', width: '100%', paddingLeft: '10px', color: '#303030', fontSize: '12px', letterSpacing: '.6px', backgroundColor: '#fff', outline: 'none', boxSizing: 'border-box' as const },
    textarea: { border: '1px solid #D3D3D3', borderRadius: '4px', width: '100%', padding: '10px', color: '#303030', fontSize: '12px', letterSpacing: '.6px', backgroundColor: '#fff', outline: 'none', boxSizing: 'border-box' as const },
    buttonSecondary: { color: '#495057', backgroundColor: '#f8f9fa', border: '1px solid #d2d6da', borderRadius: '6px', padding: '0 16px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.6px', height: '35px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content' },
    buttonPrimary: { color: '#ffffff', backgroundColor: '#5e72e4', border: '1px solid #5e72e4', borderRadius: '6px', padding: '0 24px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.6px', height: '35px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 'fit-content' },
    suggestList: { zIndex: 9999, maxHeight: '250px', overflowY: 'auto' as const, top: 'calc(100% + 2px)', left: 0, backgroundColor: '#fff', border: '1px solid #D3D3D3', borderRadius: '4px', padding: 0, margin: 0, listStyle: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', width: '100%', position: 'absolute' as const },
    suggestItem: { cursor: 'pointer', fontSize: '12px', minHeight: '36px', padding: '8px 12px', borderBottom: '1px solid #f0f0f0', color: '#303030', letterSpacing: '.6px', display: 'flex', alignItems: 'center' },
    // 💡 連携バッジ用のスタイル
    badgeLinked: { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e6fffa', color: '#38a169', border: '1px solid #9ae6b4', marginLeft: '8px', fontWeight: 'bold' },
    badgeUnlinked: { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f8f9fa', color: '#a0aec0', border: '1px solid #e2e8f0', marginLeft: '8px', fontWeight: 'bold' },
    // v2.2.258: いえらぶの物件の候補・小さいボタン
    miniButton: { fontSize: '10px', padding: '2px 8px', border: '1px solid #ced4da', borderRadius: '4px', background: '#fff', color: '#495057', cursor: 'pointer', whiteSpace: 'nowrap' as const },
    candidateBox: { marginTop: '6px', padding: '8px 10px', border: '1px solid #fbd38d', background: '#fffaf0', borderRadius: '4px', fontSize: '11px' },
    candidateItem: { display: 'block', width: '100%', textAlign: 'left' as const, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '5px 8px', marginTop: '4px', fontSize: '11px', color: '#303030', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
};

/** いえらぶの物件の候補（② の broker:ielove_candidates。features/realty/ieloveMatch.ts の Candidate） */
type IeloveCandidate = {
    property_id: string;
    property_name: string;
    property_type: string;
    address: string;
    room_number: string;
    price: string;
    level: 'strong' | 'weak';
    reason: string;
    takenNo: string;
};

/** 探すための形（空白を除き、全角英数を半角に、「丁目」「番」「－」の揺れを「-」に、小文字に） */
const normSearch = (v: string): string => v.normalize('NFKC').replace(/\s/g, '').replace(/鹿児島県|宮崎県/g, '')
    .replace(/丁目|番地|番|[ー‐−–—―]/g, '-').replace(/号/g, '').toLowerCase();

export interface BrokerData {
    internal_id: number;
    id: string;
    kind: string | null;
    no?: number | null;
    freq?: string | null;
    note?: string | null;
    addr1?: string | null;
    addr2?: string | null;
    addr?: string | null;
    price?: number | null;
    budget?: number | null;
    fee?: number | null;
    feeManual?: number | null;
    staff?: string | null;
    portal?: string | null;
    seller?: string | null;
    customer?: string | null;
    name?: string | null;
    source?: string | null;
    contact?: string | null;
    keyInfo?: string | null;
    category?: string | null;
    keyStatus?: string | null;
    baikaiType?: string | null;
    propStatus?: string | null;
    currentStatus?: string | null;
    type?: string | null;
    phase?: string | null;
    priority?: string | null;
    property?: string | null;
    targetProperty?: string | null;
    endReason?: string | null;
    reinsDate?: string | null;
    contractDate?: string | null;
    receivedDate?: string | null;
    created_at?: string;
    updated_at?: string;
    master_data_id?: string | null;
    property_db_id?: string | null;
    property_db_name?: string | null;
    show_dashboard?: number;
    [key: string]: any;
}

type Props = {
    targetPropertyId: string,
    setTargetPropertyId: React.Dispatch<React.SetStateAction<string>>,
    editData: Partial<BrokerData>,
    setEditData: React.Dispatch<React.SetStateAction<Partial<BrokerData>>>,
    staffList: string[],
    isSaving: boolean,
    handleUpdate: () => void,
    customerId?: string,
};

const PropertyRegister = ({ targetPropertyId, setTargetPropertyId, editData, setEditData, staffList, isSaving, handleUpdate, customerId }: Props) => {
    const [customerList, setCustomerList] = useState<Record<string, string>[]>([]);
    const [propertyList, setPropertyList] = useState<Record<string, string>[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    const [searchPropertyQuery, setSearchPropertyQuery] = useState('');
    const [showPropertyDropdown, setShowPropertyDropdown] = useState(false);

    /** 担当営業の選択肢（v2.2.252）。値は空白なしの氏名、表示はスタッフ表の名前。今の値が無ければ足す */
    const staffOptions = useMemo(() => {
        const opts = staffList.map(s => ({ value: removeAllSpaces(s), label: s }));
        const cur = editData.staff || '';
        return cur && !opts.some(o => o.value === cur) ? [...opts, { value: cur, label: cur }] : opts;
    }, [staffList, editData.staff]);

    useEffect(() => {
        if (!targetPropertyId) return;
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'broker', roll: 'customer' });
                setCustomerList(response.data.customer);
                const filteredPropertyList = response.data.property.filter((p: any) => removeAllSpaces(p.store_name) === removeAllSpaces('国分ハウジンググループ中古住宅専門店'));
                setPropertyList(filteredPropertyList);
            } catch (e) {
                console.error(e);
            }
        }
        fetchData();
    }, [targetPropertyId]);

    useEffect(() => {
        setSearchQuery(editData.seller || '');
    }, [editData.seller]);

    useEffect(() => {
        setSearchPropertyQuery(editData.property_db_name || '');
    }, [editData.property_db_name]);

    const filteredCustomer = useMemo(() => {
        return customerList.map(c => ({
            id: c.id ?? '',
            name: c.customer_contacts_name ?? '',
            medium: c.sales_promotion_name ?? '',
            status: c.status ?? '',
            shop: c.in_charge_store ?? ''
        }));
    }, [customerList]);

    const filteredProperty = useMemo(() => {
        return propertyList.map(p => ({
            id: p.property_id,
            name: p.property_name ?? '',
            type: p.property_type ?? '',
            address: p.address ?? '',
            price: p.price ?? '',
            // ⚠️ v2.2.258: 番号・物件名・所在地のどれでも探せるように（空白・全角半角・「鹿児島県」を無視）
            key: normSearch(`${p.property_id} ${p.property_name ?? ''} ${p.address ?? ''}`),
        }))
    }, [propertyList]);

    /**
     * ⚠️ v2.2.258: この台帳の、いえらぶの物件の候補（② の broker:ielove_candidates。所在地・種別で探したもの）。
     *   まだ保存していない台帳（中古の画面の新規）は候補なし
     */
    const [candidates, setCandidates] = useState<IeloveCandidate[] | null>(null);
    useEffect(() => {
        if (!targetPropertyId) { setCandidates(null); return; }
        let alive = true;
        setCandidates(null);
        apiClient.post('', { request: 'broker', roll: 'ielove_candidates', ledgerId: targetPropertyId })
            .then(res => { if (alive) setCandidates(res.data?.ledgers?.[targetPropertyId]?.candidates ?? []); })
            .catch(e => { console.error('[PropertyRegister] いえらぶの物件の候補を読めませんでした', e); if (alive) setCandidates([]); });
        return () => { alive = false; };
    }, [targetPropertyId]);

    /** コピーした項目（「コピーしました」の表示） */
    const [copied, setCopied] = useState('');
    const copy = async (label: string, text: string) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(label);
            setTimeout(() => setCopied(c => (c === label ? '' : c)), 1500);
        } catch (e) {
            // ⚠️ navigator.clipboard は HTTPS か localhost でしか使えない
            console.error(e);
            window.prompt('コピーできませんでした。下の文字を選んでコピーしてください', text);
        }
    };
    /** いえらぶに貼り付ける所在地（市区町村＋番地。地図の URL は除く） */
    const copyAddress = useMemo(() => {
        const a1 = (editData.addr1 || '').trim();
        const a2 = (editData.addr2 || '').replace(/https?:\/\/\S+/g, '').trim();
        return a1 && a2.startsWith(a1) ? a2 : `${a1}${a2}`;
    }, [editData.addr1, editData.addr2]);

    const displayCustomers = useMemo(() => {
        if (!searchQuery) return [];
        return filteredCustomer.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, filteredCustomer]);

    const displayProperties = useMemo(() => {
        const words = searchPropertyQuery.split(/[\s　]+/).map(normSearch).filter(Boolean);
        if (!words.length || searchPropertyQuery === (editData.property_db_name || '')) return [];
        return filteredProperty.filter(p => words.every(w => p.key.includes(w))).slice(0, 30);
    }, [searchPropertyQuery, filteredProperty, editData.property_db_name]);

    const handleInputChange = (field: keyof BrokerData, value: string | number | null) => {
        setEditData(prev => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        if (!customerId || customerList.length === 0) return;

        const targetCustomer = customerList.find(c => String(c.id) === String(customerId));
        if (!targetCustomer) return;

        const formattedData = {
            id: targetCustomer.id ?? '',
            name: targetCustomer.customer_contacts_name ?? '',
            medium: targetCustomer.sales_promotion_name ?? '',
            status: targetCustomer.status ?? ''
        };
        handleCustomerSelect(formattedData);

    }, [customerId, customerList]);

    const handleCustomerSelect = (customer: { id: string, name: string, medium: string, status: string }) => {
        handleInputChange('master_data_id', customer.id);
        handleInputChange('seller', customer.name);
        setSearchQuery(customer.name);
        setShowDropdown(false);
    };

    /** ⚠️ v2.2.258: 人が選んだ・外した・該当なしは property_db_match に残す（② の自動の突き合わせが上書きしない） */
    const handlePropertySelect = (property: { id: string, name: string }) => {
        setEditData(prev => ({ ...prev, property_db_id: property.id, property_db_name: property.name, property_db_match: 'staff' }));
        setSearchPropertyQuery(property.name);
        setShowPropertyDropdown(false);
    };
    const handlePropertyClear = (match: 'staff' | 'none') => {
        if (match === 'none' && !window.confirm('この物件は、いえらぶに載せない（該当なし）にしますか？\n自動の突き合わせでもつながらなくなります。')) return;
        setEditData(prev => ({ ...prev, property_db_id: null, property_db_name: null, property_db_match: match }));
        setSearchPropertyQuery('');
    };

    const renderLinkBadge = (id?: string | null, match?: string | null) => {
        if (id && match === 'auto') {
            return (
                <span style={styles.badgeLinked} title="所在地・種別が一致したので自動でつなぎました">
                    <i className="bi bi-check-circle-fill me-1"></i>自動で連携
                </span>
            );
        }
        if (!id && match === 'none') {
            return (
                <span style={styles.badgeUnlinked} title="いえらぶに載せない物件（自動でもつながりません）">
                    <i className="bi bi-slash-circle me-1"></i>該当なし
                </span>
            );
        }
        if (id) {
            return (
                <span style={styles.badgeLinked}>
                    <i className="bi bi-check-circle-fill me-1"></i>連携済み
                </span>
            );
        }
        return (
            <span style={styles.badgeUnlinked}>
                <i className="bi bi-dash-circle me-1"></i>未連携
            </span>
        );
    };

    return (
        <>
            <Modal show={!!targetPropertyId} onHide={() => {
                setTargetPropertyId('');
                setEditData({});
            }} size="lg" centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title style={{ color: '#495057', fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                        <i className="bi bi-pencil-square me-2" style={{ color: '#a0aec0' }}></i>物件情報の編集
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-3 pb-4">
                    <div className="row g-3">

                        {/* 顧客連携 */}
                        <div className="col-12 position-relative">
                            <label style={styles.label}>
                                <i className="bi bi-link-45deg me-1 text-primary"></i>顧客連携
                                {renderLinkBadge(editData.master_data_id)}
                            </label>
                            <input
                                type="text"
                                style={styles.input}
                                placeholder="顧客名を入力して検索..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowDropdown(true);
                                }}
                                onFocus={() => setShowDropdown(true)}
                                onBlur={() => setShowDropdown(false)}
                            />
                            {showDropdown && displayCustomers.length > 0 && (
                                <ul style={styles.suggestList}>
                                    {displayCustomers.map(c => (
                                        <li
                                            key={c.id}
                                            style={styles.suggestItem}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleCustomerSelect(c);
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                                                <span style={{ fontWeight: 'bold', color: '#4a5568' }}>{c.name} : {c.shop}</span> <span style={{ color: '#a0aec0' }}>({c.medium}) _ {c.status}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* 掲載物件連携（いえらぶの物件）。⚠️ v2.2.258: 番号・物件名・所在地で探す、候補、外す・該当なし */}
                        <div className="col-12 position-relative mt-2">
                            <label style={styles.label}>
                                <i className="bi bi-building me-1 text-success"></i>掲載物件連携（いえらぶの物件）
                                {renderLinkBadge(editData.property_db_id, editData.property_db_match)}
                                {editData.property_db_id && <span style={{ marginLeft: '8px', color: '#718096' }}>No.{editData.property_db_id}</span>}
                                <span style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                                    {editData.property_db_id
                                        ? <button type="button" style={styles.miniButton} onClick={() => handlePropertyClear('staff')}>外す</button>
                                        : editData.property_db_match !== 'none' && <button type="button" style={styles.miniButton} onClick={() => handlePropertyClear('none')}>該当なし（いえらぶに載せない）</button>}
                                </span>
                            </label>
                            <input
                                type="text"
                                style={styles.input}
                                placeholder="いえらぶの物件番号・物件名・所在地で探す（例：274111、西伊敷 50-3）"
                                value={searchPropertyQuery}
                                onChange={(e) => {
                                    setSearchPropertyQuery(e.target.value);
                                    setShowPropertyDropdown(true);
                                }}
                                onFocus={() => setShowPropertyDropdown(true)}
                                onBlur={() => setShowPropertyDropdown(false)}
                            />
                            {showPropertyDropdown && searchPropertyQuery.trim() !== '' && propertyList.length === 0 && (
                                <ul style={{ ...styles.suggestList, zIndex: 9998 }}>
                                    <li style={{ ...styles.suggestItem, color: '#a0aec0' }}>いえらぶの物件を読み込み中…</li>
                                </ul>
                            )}
                            {showPropertyDropdown && displayProperties.length > 0 && (
                                <ul style={{ ...styles.suggestList, zIndex: 9998 }}>
                                    {displayProperties.map(p => (
                                        <li
                                            key={p.id}
                                            style={styles.suggestItem}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                handlePropertySelect(p);
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                                                <span style={{ color: '#718096' }}>No.{p.id}</span> <span style={{ fontWeight: 'bold', color: '#4a5568' }}>{p.name}</span> <span style={{ color: '#a0aec0' }}>({p.type}_{p.address}) : {p.price}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {/* 所在地・種別から探した候補（まだつながっていないとき） */}
                            {!editData.property_db_id && editData.property_db_match !== 'none' && candidates !== null && (
                                <div style={styles.candidateBox}>
                                    {candidates.length === 0 ? (
                                        <div style={{ color: '#718096' }}>所在地が同じいえらぶの物件はまだありません（いえらぶ未採番）。いえらぶに登録すると、自動でつながります。</div>
                                    ) : (
                                        <>
                                            <div style={{ color: '#975a16', fontWeight: 'bold', marginBottom: '4px' }}>
                                                <i className="bi bi-exclamation-triangle me-1"></i>要確認：所在地が近いいえらぶの物件 {candidates.length}件（押すとつなぎます）
                                            </div>
                                            {candidates.map(c => (
                                                <button type="button" key={c.property_id} style={styles.candidateItem}
                                                    onClick={() => handlePropertySelect({ id: c.property_id, name: c.property_name })}>
                                                    <span style={{ color: '#718096' }}>No.{c.property_id}</span>{' '}
                                                    <b>{c.property_name}</b>{c.room_number ? ` ${c.room_number}` : ''}
                                                    <span style={{ color: '#a0aec0' }}>（{c.property_type}_{c.address}）</span>
                                                    <span style={{ color: c.level === 'strong' ? '#2f855a' : '#c05621', marginLeft: '6px' }}>{c.reason}</span>
                                                    {c.takenNo && <span style={{ color: '#e53e3e', marginLeft: '6px' }}>台帳 No.{c.takenNo} につながっています</span>}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="col-12"><hr style={{ margin: '10px 0', borderColor: '#e2e8f0' }} /></div>

                        {/* 住所関連 */}
                        <div className="col-md-4">
                            <label style={styles.label}>市町村 (addr1)</label>
                            <input type="text" style={styles.input} value={editData.addr1 || ''} onChange={e => handleInputChange('addr1', e.target.value)} />
                        </div>
                        <div className="col-md-4">
                            <label style={styles.label}>番地 (addr2)</label>
                            <input type="text" style={styles.input} value={editData.addr2 || ''} onChange={e => handleInputChange('addr2', e.target.value)} />
                        </div>
                        <div className="col-md-4">
                            <label style={styles.label}>建物名 (addr)</label>
                            <input type="text" style={styles.input} value={editData.addr || ''} onChange={e => handleInputChange('addr', e.target.value)} />
                        </div>
                        {/* ⚠️ v2.2.258: いえらぶに登録するときは、ここからコピーして貼り付ける（表記がそろい、自動でつながる） */}
                        <div className="col-12" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', fontSize: '11px', color: '#718096' }}>
                            <span>いえらぶに登録するときは、コピーして貼り付けてください：</span>
                            <button type="button" style={styles.miniButton} disabled={!copyAddress} onClick={() => copy('所在地', copyAddress)}>
                                <i className="bi bi-clipboard me-1"></i>所在地をコピー
                            </button>
                            <button type="button" style={styles.miniButton} disabled={!editData.addr} onClick={() => copy('建物名', editData.addr || '')}>
                                <i className="bi bi-clipboard me-1"></i>建物名をコピー
                            </button>
                            {copied && <span style={{ color: '#38a169' }}><i className="bi bi-check2 me-1"></i>{copied}をコピーしました</span>}
                        </div>

                        {/* 💡 価格・手数料・担当 */}
                        <div className="col-md-4">
                            <label style={styles.label}>販売価格 (円)</label>
                            <input
                                type="number"
                                style={{ ...styles.input, color: '#e53e3e', fontWeight: 'bold' }}
                                value={editData.price || ''}
                                onChange={e => handleInputChange('price', Number(e.target.value))}
                            />
                        </div>
                        <div className="col-md-4">
                            <label style={styles.label}>仲介手数料 (円)</label>
                            <input
                                type="number"
                                style={styles.input}
                                value={editData.fee || ''}
                                onChange={e => {
                                    const val = e.target.value;
                                    handleInputChange('fee', val ? Number(val) : null);
                                }}
                            />
                        </div>
                        <div className="col-md-4">
                            <label style={styles.label}>担当営業</label>
                            {/*
                              ⚠️ v2.2.252: 値は空白なしの氏名（反響・商談・媒介紐付と同じ）。スタッフ表の名前は「時任 聡一朗」のように空白入りで、
                                以前はそのまま保存して台帳の担当が「時任」「時任聡一朗」「時任 聡一朗」と混ざっていた。
                                今の値が選択肢に無い（略称・退職者など）ときも、その値を出す（触っただけで消えないように）
                            */}
                            <select style={styles.input} value={editData.staff || ''} onChange={e => handleInputChange('staff', e.target.value)}>
                                <option value="">選択してください</option>
                                {staffOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>

                        {/* 物件属性 */}
                        <div className="col-md-4">
                            <label style={styles.label}>区分 (category)</label>
                            <select style={styles.input} value={editData.category || ''} onChange={e => handleInputChange('category', e.target.value)}>
                                <option value="">選択してください</option>
                                {['戸建', 'マンション', '住宅用地', '賃収マンション', '賃収・事業用', 'その他'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div className="col-md-4">
                            <label style={styles.label}>媒介種別 (baikaiType)</label>
                            <select style={styles.input} value={editData.baikaiType || ''} onChange={e => handleInputChange('baikaiType', e.target.value)}>
                                <option value="">選択してください</option>
                                {['専属専任媒介', '専任媒介', '一般媒介', '買取'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div className="col-md-4">
                            <label style={styles.label}>現在の状況 (currentStatus)</label>
                            <select style={styles.input} value={editData.currentStatus || ''} onChange={e => handleInputChange('currentStatus', e.target.value)}>
                                <option value="">選択してください</option>
                                {['情報整理中', '募集中', '買付有', '契約済', '売止', '掲載終了', '他決'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        {/* 💡 状況・ステータス (3カラムに変更) */}
                        <div className="col-md-4">
                            <label style={styles.label}>連絡頻度 (freq)</label>
                            <select style={styles.input} value={editData.freq || ''} onChange={e => handleInputChange('freq', e.target.value)}>
                                <option value="">選択してください</option>
                                {['1週間', '2週間', '1か月'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div className="col-md-4">
                            <label style={styles.label}>物件ステータス (propStatus)</label>
                            <select style={styles.input} value={editData.propStatus || ''} onChange={e => handleInputChange('propStatus', e.target.value)}>
                                <option value="">選択してください</option>
                                {['アクティブ', '成約完了', '媒介終了'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                        <div className="col-md-4">
                            <label style={styles.label}>フェーズ (phase)</label>
                            <select style={styles.input} value={editData.phase || ''} onChange={e => handleInputChange('phase', e.target.value)}>
                                <option value="">選択してください</option>
                                {['リード受信', '架電中', '通電済', '訪問査定予定', '訪問査定済', '媒介受託', '追客終了'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        {/* 日付関連 */}
                        <div className="col-md-4">
                            <label style={styles.label}>REINS登録日</label>
                            <input type="date" style={styles.input} value={editData.reinsDate || ''} onChange={e => handleInputChange('reinsDate', e.target.value)} />
                        </div>
                        <div className="col-md-4">
                            <label style={styles.label}>価格改定日</label>
                            <input type="date" style={styles.input} value={editData.priceRevDate || ''} onChange={e => handleInputChange('priceRevDate', e.target.value)} />
                        </div>
                        <div className="col-md-4">
                            <label style={styles.label}>直近報告日</label>
                            <input type="date" style={styles.input} value={editData.lastReportDate || ''} onChange={e => handleInputChange('lastReportDate', e.target.value)} />
                        </div>

                        {/* 鍵関連 */}
                        <div className="col-md-6">
                            <label style={styles.label}>鍵預かり状況 (keyStatus)</label>
                            <input type="text" style={styles.input} value={editData.keyStatus || ''} onChange={e => handleInputChange('keyStatus', e.target.value)} />
                        </div>
                        <div className="col-md-6">
                            <label style={styles.label}>鍵番号・保管場所 (keyInfo)</label>
                            <input type="text" style={styles.input} value={editData.keyInfo || ''} onChange={e => handleInputChange('keyInfo', e.target.value)} />
                        </div>

                        {/* 備考 */}
                        <div className="col-12">
                            <label style={styles.label}>備考 (note)</label>
                            <textarea style={styles.textarea} rows={3} value={editData.note || ''} onChange={e => handleInputChange('note', e.target.value)}></textarea>
                        </div>
                    </div>
                </Modal.Body>

                <Modal.Footer className="border-0 rounded-bottom d-flex justify-content-between pt-0 pb-3 px-3">
                    <button style={styles.buttonSecondary} onClick={() => setTargetPropertyId('')} disabled={isSaving}>
                        キャンセル
                    </button>
                    <button style={styles.buttonPrimary} onClick={handleUpdate} disabled={isSaving}>
                        {isSaving ? <span className="spinner-border spinner-border-sm me-2" style={{ width: '1rem', height: '1rem' }}></span> : null}
                        <i className="bi bi-save me-2"></i> 保存する
                    </button>
                </Modal.Footer>
            </Modal>
        </>
    )
}

export default PropertyRegister