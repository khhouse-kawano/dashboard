import React, { useState, useMemo, useEffect, useContext, useCallback } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';
import { dateFormate, parseTextWithUrl, thStyle, getReinsStatus, getPropertyStatus } from './databaseUtils';
import { deadlineClass, deadlineText, expiryDeadline, holidaysOf, reinsDeadline, reportDeadline } from '../realty/common/deadlines';
import type { Holidays } from '../realty/common/deadlines';
import PropertyRegister from './PropertyRegister';
import InformationEditResale from '../information/InformationEditResale';
import PropertySummary from './PropertySummary';
import BuyOfferModal from '../realty/common/BuyOfferModal';
import { OFFER_STATUS } from '../realty/common/leadLinks';
import { loadRecords } from '../realty/common/realtyState';
import AuthContext from '../../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import type { Row, StaffSetting } from '../realty/summary/kpi';

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
    /** 有効期間の満了日（v2.2.248 の媒介紐付から入る）。直近の販売報告日（v2.2.249 から期限の計算に使う） */
    expiry?: string | null;
    lastReportDate?: string | null;
    /** 媒介物件（v2.2.250。realty_properties.id。同じ物件の台帳は同じ値） */
    propertyId?: string | null;
    currentStatus?: string | null;
    /** つないだ商談案件（売側）の id（v2.2.246 の買付登録。以前のアプリの l.dealId） */
    dealId?: string | null;
    /** 他社客付けの内容（JSON） */
    coBroker?: unknown;
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

/** いえらぶの物件とのつながり（v2.2.258。② の features/realty/ieloveMatch.ts の IeloveState） */
type IeloveState = 'linked' | 'review' | 'unmatched' | 'none';
const IELOVE_LABEL: Record<IeloveState, string> = { linked: 'つながっている', review: '要確認', unmatched: 'いえらぶ未採番', none: '該当なし' };
const IELOVE_BADGE: Record<IeloveState, string> = {
    linked: 'bg-success bg-opacity-75', review: 'bg-warning text-dark', unmatched: 'bg-light text-secondary border', none: 'bg-secondary bg-opacity-50',
};

type SortKey ='displayName' | 'displayAddress' | 'displayPrice' | 'phase' | 'staff' | 'date' | 'medium' | 'updated_at';

const DatabaseBroker = () => {
    const [originalData, setOriginalData] = useState<BrokerData[]>([]);
    const [staffList, setStaffList] = useState<string[]>([]);

    // === 検索用のState ===
    const [searchAddress, setSearchAddress] = useState<string>('');
    const [searchCustomer, setSearchCustomer] = useState<string>('');
    const [searchStaff, setSearchStaff] = useState<string>('');
    const [searchCategory, setSearchCategory] = useState<string>('');
    const [searchStatus, setSearchStatus] = useState('');

    // === テーブル制御用のState ===
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

    // === モーダル制御用のState ===
    const [targetPropertyId, setTargetPropertyId] = useState<string>('');
    const [targetCustomer, setTargetCustomer] = useState<BrokerData | null>(null);
    const [customerId, setCustomerId] = useState('');

    // === 編集(Update)用のState ===
    const [editData, setEditData] = useState<Partial<BrokerData>>({});
    const [isSaving, setIsSaving] = useState(false);

    const [targetId, setTargetId] = useState('');

    /**
     * ⚠️ v2.2.246: 買付登録（realty/common/BuyOfferModal.tsx）。
     *   担当者の設定（略称→氏名）と、つないだ商談案件の No. を出すために商談案件も読む。
     */
    const { userName } = useContext(AuthContext);
    const [offerLedger, setOfferLedger] = useState<BrokerData | null>(null);
    const [staffSettings, setStaffSettings] = useState<StaffSetting[]>([]);
    const [dealNoById, setDealNoById] = useState<Record<string, string>>({});
    // ⚠️ v2.2.249: レインズ登録の期限を営業日で数えるための休業日（設定画面の「休業日」。common/deadlines.ts）
    const [holidays, setHolidays] = useState<Holidays>(holidaysOf(undefined));
    /** 今日（期限の残り日数の基準。利用者の PC の日付） */
    const today = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, []);
    const loadDeals = useCallback(() => {
        loadRecords(['deals'])
            .then(({ records, settings }) => {
                setStaffSettings(settings.staff ?? []);
                setHolidays(holidaysOf(settings.holidays));
                setDealNoById(Object.fromEntries(records.deals.map(d => [String(d.id), String(d.no ?? '―')])));
            })
            .catch(e => console.error('[DatabaseBroker] 商談案件の読み込みに失敗しました', e));
    }, []);
    useEffect(() => { loadDeals(); }, [loadDeals]);

    /**
     * ⚠️ v2.2.258: いえらぶの物件とのつながり（② の broker:ielove_candidates。features/realty/ieloveMatch.ts）。
     *   台帳 id → 状態（linked つながっている・review 候補あり＝要確認・unmatched 候補なし＝いえらぶ未採番・none 該当なし）
     */
    const [ielove, setIelove] = useState<Record<string, { state: IeloveState; count: number }> | null>(null);
    const loadIelove = useCallback(() => {
        apiClient.post('', { request: 'broker', roll: 'ielove_candidates' })
            .then(res => setIelove(res.data?.ledgers ?? {}))
            .catch(e => console.error('[DatabaseBroker] いえらぶの物件とのつながりを読めませんでした', e));
    }, []);
    useEffect(() => { loadIelove(); }, [loadIelove]);
    const ieloveStateOf = (item: BrokerData): IeloveState | '' =>
        item.property_db_id ? 'linked' : ielove?.[item.id]?.state ?? '';
    const [searchIelove, setSearchIelove] = useState<IeloveState | ''>('');
    const [matching, setMatching] = useState(false);
    /** 「いえらぶと突き合わせ」：今すぐ ② の突き合わせを動かし、一覧を読み直す */
    const runIeloveMatch = async () => {
        setMatching(true);
        try {
            const res = await apiClient.post('', { request: 'broker', roll: 'ielove_match' });
            if (res.data?.status !== 'success') throw new Error(res.data?.message || '突き合わせに失敗しました');
            const list = await apiClient.post('', { request: 'broker', roll: 'list' });
            setOriginalData(list.data.brokerage.filter((b: BrokerData) => b.kind === 'ledger' && b.show_dashboard === 1));
            loadIelove();
            alert(`いえらぶの物件と突き合わせました。\n台帳 ${res.data.ledgers}件・買い反響 ${res.data.buyLeads}件を新しくつなぎました。`);
        } catch (e) {
            console.error(e);
            alert('いえらぶの物件との突き合わせに失敗しました。');
        } finally {
            setMatching(false);
        }
    };
    const closeOffer = useCallback(() => setOfferLedger(null), []);

    /**
     * ⚠️ v2.2.248: 売り反響の「媒介紐付」で台帳を作ったあとの「媒介獲得台帳で開く」（/broker?ledgerNo=…）。
     *   その台帳の行を黄色にし、見えるところまで動かす（連動トリガー仕様書 共通ルール 4）
     */
    const [searchParams] = useSearchParams();
    const focusNo = searchParams.get('ledgerNo') ?? '';
    /** 買付登録・解除のあと、一覧の台帳を直し、案件の No. を読み直す */
    const onOfferSaved = (ledgerId: string, fields: Row) => {
        setOriginalData(prev => prev.map(d => (d.id === ledgerId ? { ...d, ...fields } as BrokerData : d)));
        loadDeals();
    };


    // データ取得
    useEffect(() => {
        const now = new Date();
        const year = now.getFullYear();
        const thisYear = now.getMonth() <= 4 ? year : year + 1;
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'broker', roll: 'list' });
                const filtered = response.data.brokerage.filter(b => b.kind === 'ledger' && b.show_dashboard === 1);
                setOriginalData(filtered);
                const filteredStaff = response.data.staff.filter(s => (s.shop === '不動産企画係' || s.shop === '中古住宅専門店') && s.period === String(thisYear)).map(s => s.name);
                setStaffList(filteredStaff);
            } catch (e) {
                alert('通信エラーが発生しました');
                console.error(e);
            }
        };
        fetchData();
    }, []);

    // 💡 編集ボタンを押した時に、選択された行のデータをフォームの初期値としてセットする
    useEffect(() => {
        if (targetPropertyId) {
            const target = originalData.find(d => d.id === targetPropertyId);
            if (target) setEditData(target);
        } else {
            setEditData({}); // 閉じた時にリセット
        }
    }, [targetPropertyId, originalData]);



    // === 動的セレクトボックスの選択肢を生成 ===
    const uniqueStaffList = useMemo(() => {
        const staffs = originalData.map(d => d.staff).filter(Boolean) as string[];
        return Array.from(new Set(staffs)).sort();
    }, [originalData]);

    const uniqueCategoryList = useMemo(() => {
        const categories = originalData.map(d => d.category).filter(Boolean) as string[];
        return Array.from(new Set(categories)).sort();
    }, [originalData]);

    // === フィルタリング＆ソート処理 ===
    const processedData = useMemo(() => {
        // 1. まずフィルタリング（絞り込み）
        const filtered = originalData.filter(item => {
            // 住所の結合文字列を作成
            const combinedAddress = `${item.addr1 || ''} ${item.addr2 || ''} ${item.addr || ''} ${item.property || ''} ${item.targetProperty || ''}`.toLowerCase();
            const matchAddress = !searchAddress || combinedAddress.includes(searchAddress.toLowerCase());

            // 顧客名の結合文字列を作成
            const combinedCustomer = `${item.seller || ''} ${item.name || ''} ${item.customer || ''}`.toLowerCase();
            const matchCustomer = !searchCustomer || combinedCustomer.includes(searchCustomer.toLowerCase());

            // 担当と物件種別は完全一致 (未選択の場合は全て表示)
            const matchStaff = !searchStaff || item.staff === searchStaff;
            const matchCategory = !searchCategory || item.category === searchCategory;
            const matchStatus = !searchStatus || item.propStatus === searchStatus
            const matchIelove = !searchIelove || ieloveStateOf(item) === searchIelove;

            return matchAddress && matchCustomer && matchStaff && matchCategory && matchStatus && matchIelove;
        });

        // 2. 絞り込んだ結果をソート
        const getSortValue = (item: BrokerData, key: SortKey) => {
            switch (key) {
                case 'displayName': return item.seller || item.name || item.customer || '';
                case 'displayAddress': return `${item.addr1 || ''} ${item.addr2 || ''} ${item.addr || ''}`.trim() || item.property || item.targetProperty || '';
                case 'displayPrice': return item.price || item.budget || 0;
                /*
                 * ⚠️ v2.2.245: 媒介契約日（contractDate）だけで並べる。列の見出しも「媒介契約日」。
                 *   以前は受信日・登録日を先に／代わりに見ていたため、媒介契約日が空の行（6件）が登録日の位置に混ざっていた。
                 *   空の行は新しい順のとき最後に来る（台帳の行に受信日が入っているものは無い）。
                 */
                case 'date': return item.contractDate || '';
                case 'phase': return item.phase || item.currentStatus || '';
                case 'staff': return item.staff || '';
                default: return '';
            }
        };

        filtered.sort((a, b) => {
            const aValue = getSortValue(a, sortConfig.key);
            const bValue = getSortValue(b, sortConfig.key);

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
            }
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ieloveStateOf は ielove だけを読む
    }, [originalData, sortConfig, searchAddress, searchCustomer, searchStaff, searchCategory, searchStatus, searchIelove, ielove]);

    /** いえらぶの状態ごとの件数（絞り込みの選択肢に出す） */
    const ieloveCounts = useMemo(() => {
        const c: Record<string, number> = {};
        for (const d of originalData) { const s = ieloveStateOf(d); if (s) c[s] = (c[s] ?? 0) + 1; }
        return c;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- ieloveStateOf は ielove だけを読む
    }, [originalData, ielove]);

    // ⚠️ v2.2.250: 媒介物件ごとの台帳 No.（同じ物件に台帳が2件以上あるとき、一覧に「同じ物件の台帳 N件」を出す）
    const ledgerNosByProperty = useMemo(() => {
        const m: Record<string, string[]> = {};
        for (const d of originalData) {
            if (!d.propertyId) continue;
            (m[d.propertyId] = m[d.propertyId] ?? []).push(String(d.no ?? '―'));
        }
        return m;
    }, [originalData]);

    // ⚠️ v2.2.248: ?ledgerNo= の行が一覧に出たら、見えるところまで動かす（1回だけ）
    const [focusedNo, setFocusedNo] = useState('');
    useEffect(() => {
        if (focusNo === '' || focusedNo === focusNo) return;
        const el = document.getElementById(`ledger-row-${focusNo}`);
        if (!el) return;
        el.scrollIntoView({ block: 'center' });
        setFocusedNo(focusNo);
    }, [focusNo, focusedNo, processedData]);

    /*
     * ⚠️ v2.2.245: ページ割りをやめ、媒介契約日の新しい順に全件を1枚で出す（制作者の要望。以前は20件ごと）。
     *   件数が増えて重くなったら、100件ごとのページ割りに戻す（要望の第二案）。
     */

    // === UIヘルパー ===
    const requestSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
        setSortConfig({ key, direction });
    };


    const getSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) return <span className="text-muted ms-1 opacity-25" style={{ fontSize: '10px' }
        }>↕</span>;
        return sortConfig.direction === 'asc' ? <span className="text-primary ms-1" style={{ fontSize: '10px' }}>▲</span> : <span className="text-primary ms-1" style={{ fontSize: '10px' }}>▼</span >;
    };

    const handleUpdate = async () => {
        if (!targetPropertyId) return;
        setIsSaving(true);
        // ⚠️ v2.2.246: 現況を「買付有」にして保存したら買付登録へ案内する（以前のアプリの cbPromptOnStatus）
        const before = originalData.find(d => d.id === targetPropertyId);
        const toOffer = editData.currentStatus === OFFER_STATUS && before?.currentStatus !== OFFER_STATUS && !(before?.dealId && dealNoById[before.dealId]);
        try {
            const payload = {
                request: 'broker',
                roll: 'update',
                id: targetPropertyId,
                data: editData
            };
            const response = await apiClient.post('', payload);
            if (response.data.status === 'error') alert('更新に失敗しました');
            const filtered = response.data.brokerage.filter(b => b.kind === 'ledger' && b.show_dashboard === 1);
            setOriginalData(filtered);
            loadIelove(); // ⚠️ v2.2.258: 保存のあと ② がいえらぶと突き合わせるので、札を読み直す
            const saved = filtered.find((b: BrokerData) => b.id === targetPropertyId);
            if (toOffer && saved && response.data.status !== 'error'
                && window.confirm('台帳の現況を「買付有」にしました。\n商談案件管理へつなぐには、買付の内容（買主・買付金額・契約希望日）が要ります。\n買付登録の画面を開きますか？')) {
                setOfferLedger(saved);
            }
        } catch (e) {
            console.error(e);
            alert('更新に失敗しました。');
        } finally {
            setIsSaving(false);
            setTargetPropertyId('');

        }
    };


    useEffect(() => {
        if (targetPropertyId) {
            const target = originalData.find(d => d.id === targetPropertyId);
            if (target) {
                setEditData(target);
            }
        } else {
            setEditData({});
        }
    }, [targetPropertyId, originalData]);

    const onClose = () => {
        setCustomerId('');
    };

    // 💡 非表示（論理削除）処理
    const handleDelete = async (id: string) => {
        if (!window.confirm('この物件をダッシュボードから非表示にしますか？')) return;

        try {
            const payload = {
                request: 'broker',
                roll: 'update',
                id: id,
                data: { show_dashboard: 0 }
            };

            const response = await apiClient.post('', payload);

            if (response.data.status === 'error') {
                alert('非表示処理に失敗しました');
                return;
            }

            // 成功時、show_dashboard が 1 のものだけを再セットして画面から消す
            const filtered = response.data.brokerage.filter((b: BrokerData) => b.kind === 'ledger' && b.show_dashboard === 1);
            setOriginalData(filtered);

        } catch (e) {
            console.error(e);
            alert('通信エラーが発生しました。');
        }
    };

    return (
        <div className="content bg-light p-3">

            {/* === 🔍 検索フィルターエリア === */}
            <div className="card shadow-sm border-0 rounded-3 mb-3">
                <div className="card-body bg-white rounded-3">
                    <div className="row g-2">
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">① 住所で検索</label>
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="例: 鹿児島市"
                                value={searchAddress}
                                onChange={(e) => setSearchAddress(e.target.value)}
                            />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">② 顧客名で検索</label>
                            <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="例: 山田"
                                value={searchCustomer}
                                onChange={(e) => setSearchCustomer(e.target.value)}
                            />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">③ 物件ステータスで検索</label>
                            <select
                                className="form-select form-select-sm"
                                value={searchStatus}
                                onChange={(e) => setSearchStatus(e.target.value)}
                            >
                                <option value="">すべて</option>
                                <option value="アクティブ">アクティブ</option>
                                <option value="媒介終了">媒介終了</option>
                                <option value="成約完了">成約完了</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">④ 担当者</label>
                            <select
                                className="form-select form-select-sm"
                                value={searchStaff}
                                onChange={(e) => setSearchStaff(e.target.value)}
                            >
                                <option value="">すべて</option>
                                {staffList.map(staff => (
                                    <option key={staff} value={staff}>{staff}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">⑤ 物件種別</label>
                            <select
                                className="form-select form-select-sm"
                                value={searchCategory}
                                onChange={(e) => setSearchCategory(e.target.value)}
                            >
                                <option value="">すべて</option>
                                {uniqueCategoryList.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        {/* ⚠️ v2.2.258: いえらぶの物件とのつながり */}
                        <div className="col-md-2">
                            <label className="form-label text-muted small fw-bold mb-1">⑥ いえらぶ</label>
                            <select
                                className="form-select form-select-sm"
                                value={searchIelove}
                                onChange={(e) => setSearchIelove(e.target.value as IeloveState | '')}
                            >
                                <option value="">すべて</option>
                                {(Object.keys(IELOVE_LABEL) as IeloveState[]).map(s => (
                                    <option key={s} value={s}>{IELOVE_LABEL[s]}（{ieloveCounts[s] ?? 0}件）</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* === 件数表示 ＆ ページネーション（上部） === */}
            <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="d-flex align-items-center gap-3">
                    <div className="fw-bold text-secondary">
                        該当 {processedData.length} 件
                    </div>
                    {/*
                      ⚠️ v2.2.245: 「媒介追加」を消した。媒介は必ず売り反響の「媒介受託」から作る（v2.2.248 からは売り反響の「媒介紐付」→ ② の planner:ledger_link）。
                        ここで作ると、売主がどの反響から来たのか分からない物件ができてしまう（制作者の要望）。
                    */}
                    <span className="text-muted" style={{ fontSize: '11px' }}>媒介は売り反響を「媒介受託」にすると作られます</span>
                </div>
                {/* ⚠️ v2.2.258: ふだんは ② が30分ごとと台帳の保存のあとに突き合わせる。いえらぶに登録した直後に、すぐつなぎたいとき用 */}
                <button className="btn btn-sm btn-outline-success bg-white rounded-pill px-3 py-0" style={{ fontSize: '11px' }}
                    disabled={matching} onClick={runIeloveMatch}
                    title="所在地・種別が一致するいえらぶの物件が1件だけの台帳をつなぎ、ポータルの買い反響を台帳へつなぎます（30分ごとにも自動で動きます）">
                    {matching ? <span className="spinner-border spinner-border-sm me-1" style={{ width: '.8rem', height: '.8rem' }}></span> : <i className="bi bi-arrow-repeat me-1"></i>}
                    いえらぶと突き合わせ
                </button>
            </div>

            {/* === テーブルUI === */}
            <div className="card shadow-sm border-0 rounded-3">
                <div className="card-body p-0">
                    <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>
                        <table className="table table-hover align-middle mb-0 text-center text-nowrap" style={{ fontSize: '12px' }}>
                            <thead className="table-light border-bottom border-2" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <tr>
                                    <th className="py-2" style={{ width: '40px' }}>No</th>
                                    <th className="py-2">編集</th>
                                    <th className="py-2" style={thStyle} onClick={() => requestSort('medium')}>反響元 {getSortIcon('medium')}</th>
                                    <th className="py-2" style={thStyle} onClick={() => requestSort('staff')}>担当 {getSortIcon('staff')}</th>
                                    <th className="py-2" style={thStyle} onClick={() => requestSort('date')}>媒介契約日 {getSortIcon('date')}</th>
                                    <th className="py-2" style={thStyle} onClick={() => requestSort('updated_at')}>情報更新日 {getSortIcon('updated_at')}</th>
                                    <th className="py-2">契約満了予定</th>
                                    <th className="py-2">残日数</th>
                                    <th className="py-2">更新状態</th>
                                    <th className="py-2 text-start" style={thStyle} onClick={() => requestSort('displayName')}>顧客名 {getSortIcon('displayName')}</th>
                                    <th className="py-2 text-start" style={thStyle} onClick={() => requestSort('displayAddress')}>物件 / 住所 {getSortIcon('displayAddress')}</th>
                                    <th className="py-2 text-end" style={thStyle} onClick={() => requestSort('displayPrice')}>金額 / 予算 {getSortIcon('displayPrice')}</th>
                                    <th className="py-2" style={thStyle} onClick={() => requestSort('phase')}>フェーズ {getSortIcon('phase')}</th>
                                    {/* ⚠️ v2.2.246: 買付登録（他社・自社の客付け）→ 商談案件 */}
                                    <th className="py-2">客付・案件</th>
                                    <th className="py-2">REINZ</th>
                                    <th className="py-2">販売報告</th>
                                    <th className="py-2">物件状態</th>
                                    <th className="py-2">MAP</th>
                                    <th className="py-2">ポータル連携（いえらぶ）</th>
                                    {/* 💡 追加: サマリー列 */}
                                    <th className="py-2">サマリー</th>
                                    <th className="py-2">非表示</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedData.length > 0 ? (
                                    processedData.map((item, index) => {
                                        const displayPrice = item.price || 0;

                                        const rawAddress = [item.addr1, item.addr2, item.addr, item.property, item.targetProperty]
                                            .filter(Boolean)
                                            .join(' ');

                                        const addressParsed = parseTextWithUrl(rawAddress);
                                        const noteParsed = parseTextWithUrl(item.note);
                                        const mapUrl = addressParsed.mapUrl || noteParsed.mapUrl;

                                        // ⚠️ v2.2.249: 期限は連動トリガー仕様書 ②（common/deadlines.ts）。満了日は expiry（無ければ契約日の3か月後の前日）。
                                        //   以前は専任・専属専任だけ、30日前から「期限間近」だった。今は一般も出し、14日前から（仕様書）。媒介終了・成約完了は出さない
                                        const expiry = expiryDeadline(item, today);
                                        const reins = reinsDeadline(item, today, holidays);
                                        const report = reportDeadline(item, today);

                                        return (
                                            <tr key={item.id} id={`ledger-row-${String(item.no ?? '')}`} style={focusNo !== '' && String(item.no ?? '') === focusNo ? { outline: '2px solid #fd7e14', background: '#fff3cd' } : undefined}>
                                                <td className="text-muted">{index + 1}</td>
                                                <td>
                                                    <button
                                                        className="btn btn-sm btn-outline-danger rounded-pill px-3 py-0"
                                                        style={{ fontSize: "11px" }}
                                                        onClick={() => setTargetPropertyId(item.id)}
                                                    >
                                                        編集
                                                    </button>
                                                </td>
                                                <td>{item.source || '-'}</td>
                                                <td>{item.staff || '-'}</td>
                                                <td className="text-muted">{dateFormate(item.contractDate || '')}</td>
                                                <td className="text-muted">{dateFormate(item.updated_at || '')}</td>
                                                <td className="text-muted">{expiry ? expiry.date.replace(/-/g, '/') : '-'}</td>
                                                <td className="text-end fw-bold">
                                                    {expiry ? <span className={expiry.days < 0 ? 'text-danger' : ''}>{expiry.days}日</span> : '-'}
                                                </td>
                                                <td>
                                                    {expiry ? (
                                                        <span className={`badge ${deadlineClass(expiry.state)}`} title="満了日の14日前から「期限間近」">
                                                            {expiry.state === 'over' ? '★ 期限切れ' : expiry.state === 'soon' ? '⚠ 期限間近' : '有効'}
                                                        </span>
                                                    ) : <span className="text-muted">-</span>}
                                                </td>
                                                <td className="text-start">
                                                    <span
                                                        className={`${item.master_data_id ? 'text-primary' : 'text-dark'} ${item.master_data_id ? 'fw-bold' : ''}`}
                                                        style={{
                                                            cursor: item.master_data_id ? 'pointer' : '',
                                                            textDecoration: item.master_data_id ? 'underline dotted' : 'none'
                                                        }}
                                                        onClick={() => item.master_data_id ? setCustomerId(item.master_data_id) : null}
                                                    >
                                                        {item.seller || '未登録'}
                                                    </span>
                                                </td>
                                                <td className="text-start text-truncate" style={{ maxWidth: '200px' }} title={addressParsed.cleanText}>
                                                    {addressParsed.cleanText || '-'}
                                                    {(() => {
                                                        const nos = item.propertyId ? ledgerNosByProperty[item.propertyId] ?? [] : [];
                                                        if (nos.length < 2) return null;
                                                        const list = nos.map(n => `No.${n}`).join('・');
                                                        return (
                                                            <button type="button" className="badge bg-info text-dark border-0 ms-1" style={{ fontSize: '9px', cursor: 'pointer' }}
                                                                title={`同じ物件の台帳：${list}`} onClick={() => alert(`同じ物件（媒介物件）の台帳：${list}`)}>
                                                                同じ物件の台帳 {nos.length}件
                                                            </button>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="text-end fw-bold text-danger">
                                                    {displayPrice > 0 ? displayPrice.toLocaleString() : '-'}
                                                </td>
                                                <td>
                                                    <span className="badge bg-light text-dark border">{item.currentStatus || '-'}</span>
                                                </td>
                                                <td>
                                                    {item.dealId && dealNoById[item.dealId] ? (
                                                        <button className="btn btn-sm btn-success bg-opacity-75 rounded-pill px-2 py-0" style={{ fontSize: '11px' }}
                                                            title="商談案件につながっています（押すと解除の画面）" onClick={() => setOfferLedger(item)}>
                                                            案件No.{dealNoById[item.dealId]}
                                                        </button>
                                                    ) : item.propStatus === '媒介終了' ? (
                                                        <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                                                    ) : (
                                                        <button className="btn btn-sm btn-outline-secondary bg-white rounded-pill px-2 py-0" style={{ fontSize: '11px' }}
                                                            title="他社・自社の客付けの買付を登録して、商談案件管理へつなぐ" onClick={() => setOfferLedger(item)}>
                                                            🤝買付登録{item.dealId ? '（連携切れ）' : ''}
                                                        </button>
                                                    )}
                                                </td>
                                                <td>
                                                    {/* ⚠️ v2.2.249: 専属専任・専任で未登録なら、期限（契約日の翌日から5・7営業日目）と残りの日数 */}
                                                    {reins && reins.state !== 'done' ? (
                                                        <span className={`badge ${deadlineClass(reins.state)}`} title="レインズ登録の期限（休業日を数えない）">
                                                            要登録 {deadlineText(reins)}
                                                        </span>
                                                    ) : (
                                                        <span className={`badge ${getReinsStatus(item.reinsDate, item.baikaiType).color}`}>
                                                            {getReinsStatus(item.reinsDate, item.baikaiType).label}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {/* ⚠️ v2.2.249: 次の販売報告の期限（初回は契約日から、2回目からは直近の報告日から。専属専任7日・専任14日） */}
                                                    {report ? (
                                                        <span className={`badge ${deadlineClass(report.state)}`} title={item.lastReportDate ? `直近の報告 ${dateFormate(item.lastReportDate)}` : '初回の販売報告'}>
                                                            {deadlineText(report)}
                                                        </span>
                                                    ) : <span className="text-muted">-</span>}
                                                </td>
                                                <td>
                                                    <span className={`badge ${getPropertyStatus(item.propStatus ?? '').color}`}>
                                                        {getPropertyStatus(item.propStatus ?? '').label}
                                                    </span>
                                                </td>
                                                <td>
                                                    {mapUrl ? (
                                                        <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary rounded-pill px-2 py-0 shadow-sm" style={{ fontSize: '11px' }}>
                                                            <i className="bi bi-geo-alt-fill"></i> MAP
                                                        </a>
                                                    ) : <span className="text-muted" style={{ fontSize: '11px' }}>-</span>}
                                                </td>
                                                <td>
                                                    {/* ⚠️ v2.2.258: いえらぶの番号・要確認・未採番・該当なし。押すと編集画面（候補から選べる） */}
                                                    {(() => {
                                                        const s = ieloveStateOf(item);
                                                        if (!s) return <span className="text-muted" style={{ fontSize: '11px' }}>…</span>;
                                                        const text = s === 'linked' ? `No.${item.property_db_id}`
                                                            : s === 'review' ? `要確認 ${ielove?.[item.id]?.count ?? 0}件` : IELOVE_LABEL[s];
                                                        const title = s === 'linked' ? `${item.property_db_name || ''}${item.property_db_match === 'auto' ? '（自動でつないだ）' : ''}`
                                                            : s === 'review' ? '所在地が近いいえらぶの物件があります。編集画面で選んでください'
                                                            : s === 'unmatched' ? 'いえらぶにまだ登録されていません（登録されると自動でつながります）' : 'いえらぶに載せない物件';
                                                        return (
                                                            <button type="button" className={`badge border-0 ${IELOVE_BADGE[s]}`} style={{ fontSize: '10px', cursor: 'pointer' }}
                                                                title={title} onClick={() => setTargetPropertyId(item.id)}>
                                                                {text}
                                                            </button>
                                                        );
                                                    })()}
                                                </td>
                                                {/* 💡 追加: サマリーセル */}
                                                <td>
                                                    {item.property_db_id ? (
                                                        <button
                                                            className="btn btn-sm btn-outline-info rounded-pill px-3 py-0 fw-bold"
                                                            style={{ fontSize: "11px" }}
                                                            onClick={() => setTargetId(String(item.property_db_id))}
                                                        >
                                                            <i className="bi bi-bar-chart-line-fill me-1"></i>詳細
                                                        </button>
                                                    ) : (
                                                        <span className="text-muted" style={{ fontSize: '11px' }}>-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <button
                                                        className="btn btn-sm btn-link text-secondary p-0 border-0"
                                                        title="非表示にする"
                                                        onClick={() => handleDelete(item.id)}
                                                    >
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={21} className="text-center py-4 text-muted">
                                            該当するデータが見つかりません。
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <InformationEditResale id={customerId} token="" onClose={onClose} authority="" />
            <PropertyRegister
                targetPropertyId={targetPropertyId}
                setTargetPropertyId={setTargetPropertyId}
                editData={editData} setEditData={setEditData}
                staffList={staffList}
                isSaving={isSaving}
                handleUpdate={handleUpdate} />
            <BuyOfferModal
                ledger={offerLedger as Row | null}
                staffSettings={staffSettings}
                userName={userName || ''}
                onClose={closeOffer}
                onSaved={onOfferSaved}
            />
            <PropertySummary
                targetId={targetId}
                setTargetId={setTargetId}
                setEditId={setCustomerId}
            />
        </div>
    );
};

export default DatabaseBroker;