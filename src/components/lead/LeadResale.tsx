import React, { useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';
import { thisYear } from '../../utils/thisYear';
import { COMPANY } from './documentUtils';

// ==========================================
// 💡 型定義
// ==========================================
type ResaleCategory = '土地' | '戸建' | 'マンション' | 'その他';
type ResaleStatus = '仕入検討' | '仕入契約書' | '仕入決済済（保有）' | '工事中' | '販売中' | '売買契約書' | '決済完了' | '中止';
type ResaleCostCat = '仕入' | 'リフォーム' | '保有・販売';
type ResaleSellerReg = '未確認' | '登録なし' | '登録あり';
type RsGpMode = 'incl' | 'credit' | 'net';

type ResaleCostRow = {
    id: string;
    cat: ResaleCostCat;
    label: string;
    tax: 0 | 1;
    key: string;
    plan: string;   // 空文字="未入力"を区別するため文字列で保持
    actual: string;
};

type ResaleDeal = {
    id: string;
    no: number;
    property: string;
    category: ResaleCategory;
    addr: string;
    staff: string;      // 仕入担当
    sellStaff: string;  // 販売担当
    status: ResaleStatus;
    ledgerNo: number | null;

    seller: string;
    buyer: string;

    buyPrice: number;
    buyBuilding: number;
    buySellerReg: ResaleSellerReg;
    buyStockAsset: boolean;
    taxCheckDate: string;
    buyContractDate: string;
    buySettleDate: string;

    listPrice: number;
    listDate: string;
    sellPrice: number;
    sellBuilding: number;
    sellContractDate: string;
    sellSettleDate: string;
    targetGp: number;

    costs: ResaleCostRow[];
    note: string;
};

// ==========================================
// 💡 マスタ定数（source.html の RS_* 相当）
// ==========================================
const RS_PHASES: ResaleStatus[] = ['仕入検討', '仕入契約書', '仕入決済済（保有）', '工事中', '販売中', '売買契約書', '決済完了', '中止'];
const RS_HOLD: ResaleStatus[] = ['仕入決済済（保有）', '工事中', '販売中', '売買契約書'];
const RS_DONE: ResaleStatus = '決済完了';
const RS_CATS: ResaleCostCat[] = ['仕入', 'リフォーム', '保有・販売'];
const RS_CATEGORIES: ResaleCategory[] = ['土地', '戸建', 'マンション', 'その他'];
const RS_PHCOLOR: Record<string, string> = {
    '仕入検討': 'gray', '仕入契約書': 'navy', '仕入決済済（保有）': 'navy',
    '工事中': 'amber', '販売中': 'amber', '売買契約書': 'green', '決済完了': 'green', '中止': 'red',
};
const RS_REG: ResaleSellerReg[] = ['未確認', '登録なし', '登録あり'];
const RS_REG_LABEL: Record<string, string> = {
    '未確認': '未確認（要：国税庁公表サイトで確認）',
    '登録なし': '登録なし（個人・免税事業者等）',
    '登録あり': '登録あり（適格請求書発行事業者）',
};
// 自社仕入（買取再販の元付＝自社）の売主表記。会社名は documentUtils.ts の単一の情報源から取得する
const RS_OWNER = COMPANY.name;

// 💡 コスト項目マスタ（source.html の DEFAULT_RS_SETS() をカテゴリ別に移植）
type ResaleCostItemDef = { cat: ResaleCostCat; label: string; tax: 0 | 1; key: string };

const DEFAULT_RS_SETS = (): Record<string, ResaleCostItemDef[]> => ({
    '土地': [
        { cat: '仕入', label: '造成', tax: 1, key: 'f_zosei' },
        { cat: '仕入', label: '解体', tax: 1, key: 'f_kaitai' },
        { cat: '仕入', label: '水道', tax: 1, key: 'f_suido' },
        { cat: '仕入', label: '測量', tax: 1, key: 'f_sokuryo' },
        { cat: '仕入', label: '分筆', tax: 1, key: 'f_bunpitsu' },
        { cat: '仕入', label: '農地法5条', tax: 1, key: 'f_5jo' },
        { cat: '仕入', label: '開発', tax: 1, key: 'f_kaihatsu' },
        { cat: '仕入', label: '登記(登録免許税等)', tax: 0, key: 'f_touki' },
        { cat: '仕入', label: '不動産取得税', tax: 0, key: 'f_shutoku' },
        { cat: '仕入', label: '印紙税', tax: 0, key: 'f_inshi' },
        { cat: '仕入', label: '固都税精算金', tax: 0, key: 'f_kotozei' },
        { cat: '仕入', label: '仲介手数料', tax: 1, key: 'f_chukai' },
        { cat: '保有・販売', label: '保有中の固都税', tax: 0, key: 'h_kotozei' },
        { cat: '保有・販売', label: '借入金利', tax: 0, key: 'h_kinri' },
        { cat: '保有・販売', label: '売却仲介手数料', tax: 1, key: 'h_chukai' },
        { cat: '保有・販売', label: '広告・販促費', tax: 1, key: 'h_kokoku' },
        { cat: '保有・販売', label: '確定測量・境界復元', tax: 1, key: 'h_sokuryo' },
        { cat: '保有・販売', label: '各種証明書取得', tax: 0, key: 'h_shomei' },
        { cat: '保有・販売', label: '予備費', tax: 1, key: 'h_yobi' },
    ],
    '戸建': [
        { cat: '仕入', label: '仲介手数料', tax: 1, key: 'c_chukai' },
        { cat: '仕入', label: '登録免許税', tax: 0, key: 'c_touroku' },
        { cat: '仕入', label: '不動産取得税', tax: 0, key: 'c_shutoku' },
        { cat: '仕入', label: '印紙税', tax: 0, key: 'c_inshi' },
        { cat: '仕入', label: '固都税精算金', tax: 0, key: 'c_kotozei' },
        { cat: '仕入', label: '司法書士報酬', tax: 1, key: 'c_shiho' },
        { cat: 'リフォーム', label: '内装(クロス/床)', tax: 1, key: 'r_naiso' },
        { cat: 'リフォーム', label: '水回り(K/B/洗/T)', tax: 1, key: 'r_mizu' },
        { cat: 'リフォーム', label: '屋根・外壁・防水', tax: 1, key: 'r_yane' },
        { cat: 'リフォーム', label: '設備(給湯/空調/電気)', tax: 1, key: 'r_setsubi' },
        { cat: 'リフォーム', label: '耐震・シロアリ補修', tax: 1, key: 'r_taishin' },
        { cat: 'リフォーム', label: '解体・残置撤去', tax: 1, key: 'r_kaitai' },
        { cat: 'リフォーム', label: '予備費', tax: 1, key: 'r_yobi' },
        { cat: '保有・販売', label: '保有中の固都税', tax: 0, key: 'h_kotozei' },
        { cat: '保有・販売', label: '借入金利(仕入/工事)', tax: 0, key: 'h_kinri' },
        { cat: '保有・販売', label: '売却仲介手数料', tax: 1, key: 'h_chukai' },
        { cat: '保有・販売', label: '広告・販促費', tax: 1, key: 'h_kokoku' },
        { cat: '保有・販売', label: '既存住宅瑕疵保証', tax: 0, key: 'h_kashi' },
        { cat: '保有・販売', label: 'ハウスクリーニング', tax: 1, key: 'h_clean' },
        { cat: '保有・販売', label: '各種証明書取得', tax: 0, key: 'h_shomei' },
    ],
    'マンション': [
        { cat: '仕入', label: '仲介手数料', tax: 1, key: 'c_chukai' },
        { cat: '仕入', label: '登録免許税', tax: 0, key: 'c_touroku' },
        { cat: '仕入', label: '不動産取得税', tax: 0, key: 'c_shutoku' },
        { cat: '仕入', label: '印紙税', tax: 0, key: 'c_inshi' },
        { cat: '仕入', label: '固都税精算金', tax: 0, key: 'c_kotozei' },
        { cat: '仕入', label: '司法書士報酬', tax: 1, key: 'c_shiho' },
        { cat: '仕入', label: '管理費等精算金', tax: 0, key: 'c_kanri' },
        { cat: 'リフォーム', label: '内装(クロス/床)', tax: 1, key: 'r_naiso' },
        { cat: 'リフォーム', label: '水回り(K/B/洗/T)', tax: 1, key: 'r_mizu' },
        { cat: 'リフォーム', label: '給排水・電気設備', tax: 1, key: 'r_haikan' },
        { cat: 'リフォーム', label: '建具・襖・畳', tax: 1, key: 'r_tategu' },
        { cat: 'リフォーム', label: '間取り変更・造作', tax: 1, key: 'r_madori' },
        { cat: 'リフォーム', label: '残置撤去・清掃', tax: 1, key: 'r_zanchi' },
        { cat: 'リフォーム', label: '予備費', tax: 1, key: 'r_yobi' },
        { cat: '保有・販売', label: '保有中の管理費等', tax: 0, key: 'h_kanri' },
        { cat: '保有・販売', label: '保有中の固都税', tax: 0, key: 'h_kotozei' },
        { cat: '保有・販売', label: '借入金利(仕入/工事)', tax: 0, key: 'h_kinri' },
        { cat: '保有・販売', label: '売却仲介手数料', tax: 1, key: 'h_chukai' },
        { cat: '保有・販売', label: '広告・販促費', tax: 1, key: 'h_kokoku' },
        { cat: '保有・販売', label: '既存住宅瑕疵保証', tax: 0, key: 'h_kashi' },
        { cat: '保有・販売', label: '書面・証明書取得', tax: 1, key: 'h_shomei' },
    ],
});

const rsItems = (category: string): ResaleCostItemDef[] => {
    const sets = DEFAULT_RS_SETS();
    return sets[category] || sets['戸建'] || [];
};

const uid = () => `rs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const rsNewCosts = (category: string): ResaleCostRow[] =>
    rsItems(category).map(x => ({ id: uid(), cat: x.cat, label: x.label, tax: x.tax, key: x.key, plan: '', actual: '' }));

// ==========================================
// 💡 ヘルパー関数
// ==========================================
const formatYen = (v: number | null | undefined) => (v == null || isNaN(v)) ? '―' : `¥${Math.round(v).toLocaleString()}`;
const formatMan = (v: number) => `${Math.round(v / 10000).toLocaleString()}万`;
const formatDate = (v: string | null | undefined) => {
    if (!v) return '―';
    const s = String(v).slice(0, 10);
    const [y, m, d] = s.split('-');
    if (!d) return s;
    return `${y}/${Number(m)}/${Number(d)}`;
};
const pct = (v: number | null) => (v == null || !isFinite(v)) ? '―' : `${(v * 100).toFixed(1)}%`;
const todayStr = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

// ==========================================
// 💡 収支計算エンジン（source.html の rsCalc / rsBuyVat 等をそのまま移植）
// ==========================================
const rsNum = (v: any): number => {
    const n = Number(v);
    return isFinite(n) ? n : 0;
};
const rsBlank = (v: any): boolean => v === '' || v == null;

const rsPick = (c: ResaleCostRow, mode: 'plan' | 'act'): number => {
    const p = rsBlank(c.plan) ? null : rsNum(c.plan);
    const a = rsBlank(c.actual) ? null : rsNum(c.actual);
    if (mode === 'act') return a != null ? a : (p != null ? p : 0);
    return p != null ? p : (a != null ? a : 0);
};

const RS_TAXRATE = 0.10;

// 税込金額に含まれる消費税額を抽出する（円未満切り捨て）
const rsTaxIn = (v: number): number => {
    const s = v < 0 ? -1 : 1;
    const a = Math.abs(v);
    return s * Math.floor(a * RS_TAXRATE / (1 + RS_TAXRATE) + 1e-6);
};
const rsNet = (amt: number, taxable: boolean): number => (taxable ? amt - rsTaxIn(amt) : Math.round(amt));

// 経過措置税率（インボイス制度・免税事業者等からの仕入に係る経過措置。決済日で判定）
const rsKeikaRate = (d: string): number => {
    const x = d || todayStr();
    return x < '2026-10-01' ? 0.8 : (x < '2029-10-01' ? 0.5 : 0);
};

type RsVatResult = {
    bld: number; gross: number; rate: number; credit: number; lost: number;
    basis: string; warn: string; reg: string; stock: boolean; tokurei: boolean; keika: number;
};

// 仕入建物の消費税額のうち、仕入税額控除できる額の判定（宅建業者の棚卸資産特例＝消費税法施行令49条1項1号ロ）
const rsBuyVat = (r: ResaleDeal): RsVatResult => {
    const buyIncl = rsNum(r.buyPrice);
    const bld = Math.max(0, Math.min(rsNum(r.buyBuilding), buyIncl));
    const gross = rsTaxIn(bld);
    const reg = RS_REG.includes(r.buySellerReg) ? r.buySellerReg : '未確認';
    const stock = r.buyStockAsset !== false;
    const kr = rsKeikaRate(r.buySettleDate);
    let rate = 0, basis = '', warn = '', tokurei = false;

    if (!bld) {
        basis = '建物価格が未入力（土地のみ、または建物価格の按分が未設定）';
    } else if (reg === '登録あり') {
        rate = 1;
        basis = '適格請求書（インボイス）の保存による全額控除';
    } else if (stock) {
        rate = 1;
        tokurei = true;
        basis = '宅建業者の棚卸資産特例（消費税法施行令49条1項1号ロ）による全額控除';
        if (reg === '未確認') {
            warn = `売主が適格請求書発行事業者でないことを国税庁公表サイトで確認し、証跡を保存してください。確認が漏れたまま特例が使えない場合、控除額は${Math.round(kr * 100)}％（${formatYen(gross - Math.floor(gross * kr))}の減額）になります。`;
        }
    } else {
        rate = kr;
        basis = `棚卸資産（販売用不動産）に計上していないため、経過措置${Math.round(kr * 100)}％のみ控除`;
        warn = '固定資産に計上すると宅建業者特例は使えません。棚卸資産として計上できないか経理にご確認ください。';
    }

    const credit = Math.floor(gross * rate);
    return { bld, gross, rate, credit, lost: gross - credit, basis, warn, reg, stock, tokurei, keika: kr };
};

const rsGpLabel = (m: RsGpMode) =>
    m === 'net' ? 'ネット（課税仕入の経費を税抜換算・決算利益に近い）'
        : m === 'credit' ? '買取提案書＋建物の仕入税額控除を反映（実際の資金繰りに近い）'
            : '買取提案書と同じ（建物の仕入税額控除を見ない・最も保守的）';

type RsCalcResult = {
    gpMode: RsGpMode;
    sellIncl: number; sellNet: number; sellTax: number; sellBld: number;
    buyIncl: number; buyCost: number; buyTax: number; vat: RsVatResult; vatPay: number;
    costIncl: number; costUse: number; byCat: Record<string, number>;
    totalCost: number; totalCostIncl: number;
    gp: number; rate: number | null; fixed: boolean;
};

// 粗利計算（3種類のモード：incl=買取提案書と同じ／credit=建物仕入税額控除を反映／net=税抜ネット）
const rsCalc = (r: ResaleDeal, mode: 'plan' | 'act', gpMode: RsGpMode): RsCalcResult => {
    const net = gpMode === 'net';
    const useCredit = gpMode === 'net' || gpMode === 'credit';

    const sellIncl = mode === 'act' ? rsNum(r.sellPrice) : (rsNum(r.sellPrice) || rsNum(r.listPrice));
    const sellBld = Math.max(0, Math.min(rsNum(r.sellBuilding), sellIncl));
    const sellTax = rsTaxIn(sellBld);
    const sellNet = sellIncl - sellTax;

    const buyIncl = rsNum(r.buyPrice);
    const V = rsBuyVat(r);
    const buyTax = useCredit ? V.credit : 0;
    const buyCost = buyIncl - buyTax;

    const byCat: Record<string, number> = {};
    let costIncl = 0, costUse = 0;
    for (const c of r.costs || []) {
        const amt = rsPick(c, mode);
        if (!amt) continue;
        const use = net ? rsNet(amt, !!c.tax) : Math.round(amt);
        costIncl += amt;
        costUse += use;
        const k: ResaleCostCat = (RS_CATS as string[]).includes(c.cat) ? c.cat : '保有・販売';
        byCat[k] = (byCat[k] || 0) + use;
    }

    const totalCost = buyCost + costUse;
    const gp = sellNet - totalCost;

    return {
        gpMode, sellIncl, sellNet, sellTax, sellBld,
        buyIncl, buyCost, buyTax, vat: V, vatPay: sellTax - V.credit,
        costIncl, costUse, byCat, totalCost, totalCostIncl: buyIncl + costIncl,
        gp, rate: sellNet > 0 ? gp / sellNet : null, fixed: sellIncl > 0,
    };
};

// 案件のステータスが「決済完了」なら実績(act)、それ以外は見込み(plan)で表示する
const rsMode = (r: ResaleDeal): 'plan' | 'act' => (r.status === RS_DONE ? 'act' : 'plan');

const rsHoldDays = (r: ResaleDeal): number | null => {
    const st = r.buySettleDate || r.buyContractDate;
    if (!st) return null;
    const en = (r.status === RS_DONE && r.sellSettleDate) ? r.sellSettleDate : todayStr();
    const d = Math.round((new Date(`${en}T00:00:00`).getTime() - new Date(`${st}T00:00:00`).getTime()) / 86400000);
    return isFinite(d) ? d : null;
};

const rsInvested = (r: ResaleDeal): number => {
    let v = rsNum(r.buyPrice);
    for (const c of r.costs || []) if (!rsBlank(c.actual)) v += rsNum(c.actual);
    return v;
};

const rsActPending = (r: ResaleDeal): number => (r.costs || []).filter(c => rsNum(c.plan) > 0 && rsBlank(c.actual)).length;

const rsRegPending = (r: ResaleDeal): boolean => {
    const V = rsBuyVat(r);
    return V.bld > 0 && V.reg === '未確認' && V.stock;
};

const rsCliffRisk = (r: ResaleDeal): boolean => {
    const V = rsBuyVat(r);
    return V.bld > 0 && !V.stock && V.lost > 0;
};

// リフォーム費用の合計（一覧の簡易表示用）。実績があれば実績優先、なければ見込み
const rsReformTotal = (r: ResaleDeal): number =>
    (r.costs || []).filter(c => c.cat === 'リフォーム').reduce((a, c) => a + rsPick(c, rsMode(r)), 0);

// ==========================================
// 💡 台帳（媒介台帳）への名寄せリンク（source.html の rsFindLedger 相当）
// ==========================================
const rsNorm = (v: any): string => String(v == null ? '' : v).replace(/[\s　]/g, '').toLowerCase();

const rsFindLedger = (r: ResaleDeal, ledgerList: any[]): any | null => {
    const sel = rsNorm(r.seller);
    const ad = rsNorm(r.addr);
    const pr = rsNorm(r.property);
    if (!sel && !ad && !pr) return null;
    const hit = (a: string, b: string) => !!(a && b && (a === b || a.includes(b) || b.includes(a)));
    let best: any = null, bs = 0;
    for (const l of ledgerList) {
        const ls = rsNorm(l.seller);
        const la = rsNorm(`${l.addr1 || ''}${l.addr2 || ''}${l.addr || ''}`);
        let sc = 0;
        if (hit(ls, sel)) sc += 5;
        if (pr && hit(ls, pr)) sc += 4;
        if (ad && hit(la, ad)) sc += 3;
        if (pr && hit(la, pr)) sc += 2;
        if (sc > bs) { bs = sc; best = l; }
    }
    return bs >= 3 ? best : null;
};

// ==========================================
// 💡 スタイル定義（LeadBuy.tsx / LeadSell.tsx と同じコンパクトテーブルの様式を踏襲）
// ==========================================
const compactThStyle: React.CSSProperties = {
    padding: '6px 8px', fontSize: '11px', verticalAlign: 'middle', whiteSpace: 'nowrap',
    backgroundColor: '#f8f9fa', color: '#495057', borderBottom: '1px solid #dee2e6',
};
const compactTdStyle: React.CSSProperties = {
    padding: '4px 8px', fontSize: '11px', verticalAlign: 'middle', borderBottom: '1px solid #dee2e6',
};
const compactInputStyle: React.CSSProperties = {
    fontSize: '11px', padding: '2px 4px', height: '24px', border: '1px solid #dee2e6',
    backgroundColor: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box', textAlign: 'right',
};

const statusBadgeClass = (status: string) => {
    const c = RS_PHCOLOR[status] || 'gray';
    return c === 'green' ? 'bg-success bg-opacity-10 text-success border border-success'
        : c === 'navy' ? 'bg-primary bg-opacity-10 text-primary border border-primary'
        : c === 'amber' ? 'bg-warning bg-opacity-10 text-warning border border-warning'
        : c === 'red' ? 'bg-danger bg-opacity-10 text-danger border border-danger'
        : 'bg-secondary bg-opacity-10 text-secondary border';
};

const newDeal = (no: number): ResaleDeal => ({
    id: uid(),
    no,
    property: '',
    category: '戸建',
    addr: '',
    staff: '',
    sellStaff: '',
    status: '仕入検討',
    ledgerNo: null,
    seller: '',
    buyer: '',
    buyPrice: 0,
    buyBuilding: 0,
    buySellerReg: '未確認',
    buyStockAsset: true,
    taxCheckDate: '',
    buyContractDate: '',
    buySettleDate: '',
    listPrice: 0,
    listDate: '',
    sellPrice: 0,
    sellBuilding: 0,
    sellContractDate: '',
    sellSettleDate: '',
    targetGp: 0,
    costs: rsNewCosts('戸建'),
    note: '',
});

// APIレスポンス（kind:'resale'）を防御的に補完する
const normalizeResaleDeal = (r: any, idx: number): ResaleDeal => {
    const base = newDeal(rsNum(r?.no) || idx + 1);
    return {
        ...base,
        ...r,
        id: r?.id || base.id,
        costs: Array.isArray(r?.costs) && r.costs.length ? r.costs.map((c: any) => ({ id: c.id || uid(), cat: c.cat || '仕入', label: c.label || '', tax: c.tax ? 1 : 0, key: c.key || '', plan: c.plan ?? '', actual: c.actual ?? '' })) : base.costs,
    };
};

// ==========================================
// 💡 メインコンポーネント
// ==========================================
const LeadResale = () => {
    const [deals, setDeals] = useState<ResaleDeal[]>([]);
    const [ledgerList, setLedgerList] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [gpMode, setGpMode] = useState<RsGpMode>('incl');
    const [filters, setFilters] = useState({ staff: '', status: '', q: '' });

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingDeal, setEditingDeal] = useState<ResaleDeal | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null); // null = 新規登録

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.post('', { request: 'planner', roll: 'lead' });
                if (response.data) {
                    const allLeads: any[] = response.data.lead || [];
                    const resaleRecords = allLeads.filter((l: any) => l.kind === 'resale');
                    setDeals(resaleRecords.map((r: any, idx: number) => normalizeResaleDeal(r, idx)));
                    setLedgerList(allLeads.filter((l: any) => l.kind === 'ledger'));
                    if (response.data.staff) {
                        setStaffList(response.data.staff.filter((s: any) => s.period === String(thisYear)).map((s: any) => s.name));
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    // ==========================================
    // 💡 KPI・アラート集計
    // ==========================================
    const holdDeals = useMemo(() => deals.filter(d => RS_HOLD.includes(d.status)), [deals]);
    const thisMonthKey = todayStr().slice(0, 7);
    const doneMonthDeals = useMemo(
        () => deals.filter(d => d.status === RS_DONE && d.sellSettleDate && d.sellSettleDate.slice(0, 7) === thisMonthKey),
        [deals, thisMonthKey]
    );
    const invested = useMemo(() => holdDeals.reduce((s, d) => s + rsInvested(d), 0), [holdDeals]);
    const gpDoneMonth = useMemo(() => doneMonthDeals.reduce((s, d) => s + rsCalc(d, 'act', gpMode).gp, 0), [doneMonthDeals, gpMode]);
    const gpHold = useMemo(() => holdDeals.reduce((s, d) => s + rsCalc(d, 'plan', gpMode).gp, 0), [holdDeals, gpMode]);
    const holdDaysArr = useMemo(() => holdDeals.map(rsHoldDays).filter((v): v is number => v != null), [holdDeals]);
    const avgHoldDays = holdDaysArr.length ? Math.round(holdDaysArr.reduce((a, b) => a + b, 0) / holdDaysArr.length) : null;
    const longHoldCount = useMemo(() => holdDeals.filter(d => { const days = rsHoldDays(d); return days != null && days >= 180; }).length, [holdDeals]);

    const activeDeals = useMemo(() => deals.filter(d => d.status !== '中止'), [deals]);
    const regPendingCount = useMemo(() => activeDeals.filter(rsRegPending).length, [activeDeals]);
    const cliffCount = useMemo(() => activeDeals.filter(rsCliffRisk).length, [activeDeals]);
    const noBldCount = useMemo(() => activeDeals.filter(d => d.category !== '土地' && rsNum(d.sellPrice) > 0 && !rsNum(d.sellBuilding)).length, [activeDeals]);
    const unlinkedCount = useMemo(() => activeDeals.filter(d => !d.ledgerNo).length, [activeDeals]);

    const monthlyKeys = useMemo(() => {
        const set = new Set<string>();
        deals.forEach(d => { if (d.status === RS_DONE && d.sellSettleDate) set.add(d.sellSettleDate.slice(0, 7)); });
        return Array.from(set).sort();
    }, [deals]);

    // ==========================================
    // 💡 一覧フィルタ
    // ==========================================
    const filteredDeals = useMemo(() => {
        return deals.filter(d => {
            if (filters.staff && d.staff !== filters.staff) return false;
            if (filters.status === 'hold' && !RS_HOLD.includes(d.status)) return false;
            else if (filters.status && filters.status !== 'hold' && d.status !== filters.status) return false;
            if (filters.q) {
                const q = filters.q.toLowerCase();
                if (!`${d.property}${d.addr}${d.seller}${d.buyer}`.toLowerCase().includes(q)) return false;
            }
            return true;
        }).sort((a, b) => b.no - a.no);
    }, [deals, filters]);

    // ==========================================
    // 💡 案件の登録・編集
    // ==========================================
    const openNewDeal = () => {
        const no = Math.max(0, ...deals.map(d => d.no)) + 1;
        setEditingDeal(newDeal(no));
        setEditingId(null);
        setIsEditOpen(true);
    };

    const openEditDeal = (d: ResaleDeal) => {
        setEditingDeal({ ...d, costs: d.costs.map(c => ({ ...c })) });
        setEditingId(d.id);
        setIsEditOpen(true);
    };

    const handleSaveDeal = () => {
        if (!editingDeal) return;
        if (!editingDeal.property.trim()) {
            alert('物件名を入力してください');
            return;
        }
        console.log('[API UPDATE] Save Resale Deal:', editingDeal);
        if (editingId) {
            setDeals(prev => prev.map(d => d.id === editingId ? editingDeal : d));
        } else {
            setDeals(prev => [editingDeal, ...prev]);
        }
        setIsEditOpen(false);
    };

    const handleDeleteDeal = () => {
        if (!editingId) return;
        if (!window.confirm('この買取再販案件を削除しますか？（費目の明細も削除されます）')) return;
        console.log('[API UPDATE] Delete Resale Deal:', editingId);
        setDeals(prev => prev.filter(d => d.id !== editingId));
        setIsEditOpen(false);
    };

    // ==========================================
    // 💡 コスト項目の編集
    // ==========================================
    const addCostRow = (cat: ResaleCostCat) => {
        if (!editingDeal) return;
        setEditingDeal({ ...editingDeal, costs: [...editingDeal.costs, { id: uid(), cat, label: '', tax: 1, key: '', plan: '', actual: '' }] });
    };
    const updateCostRow = (rowId: string, key: keyof ResaleCostRow, val: any) => {
        if (!editingDeal) return;
        setEditingDeal({ ...editingDeal, costs: editingDeal.costs.map(c => c.id === rowId ? { ...c, [key]: val } : c) });
    };
    const deleteCostRow = (rowId: string) => {
        if (!editingDeal) return;
        setEditingDeal({ ...editingDeal, costs: editingDeal.costs.filter(c => c.id !== rowId) });
    };
    const resetCostItems = () => {
        if (!editingDeal) return;
        if (!window.confirm(`コスト項目を「${editingDeal.category}」の標準項目に入れ替えます。同じ項目のみ金額を引き継ぎます。よろしいですか？`)) return;
        const old = editingDeal.costs;
        const fresh = rsNewCosts(editingDeal.category).map(n => {
            const hitRow = old.find(o => (o.key && n.key && o.key === n.key) || o.label === n.label);
            return hitRow ? { ...n, plan: hitRow.plan, actual: hitRow.actual } : n;
        });
        setEditingDeal({ ...editingDeal, costs: fresh });
    };

    const autoCalcSellBuilding = () => {
        if (!editingDeal) return;
        const bp = rsNum(editingDeal.buyPrice), bb = rsNum(editingDeal.buyBuilding);
        const sp = rsNum(editingDeal.sellPrice) || rsNum(editingDeal.listPrice);
        if (!bp || !bb) { alert('仕入価格と「うち建物価格」を先に入力してください'); return; }
        if (!sp) { alert('成約価格または売出価格を先に入力してください'); return; }
        const v = Math.floor(sp * (bb / bp) / 1000) * 1000;
        setEditingDeal({ ...editingDeal, sellBuilding: v });
    };

    // ==========================================
    // 💡 台帳（媒介台帳）へのリンク
    // ==========================================
    const suggestedLedger = useMemo(() => (editingDeal && !editingDeal.ledgerNo) ? rsFindLedger(editingDeal, ledgerList) : null, [editingDeal, ledgerList]);
    const linkedLedger = useMemo(() => editingDeal?.ledgerNo ? ledgerList.find(l => rsNum(l.no) === rsNum(editingDeal.ledgerNo)) : null, [editingDeal, ledgerList]);

    const linkLedger = (ledgerNo: number) => {
        if (!editingDeal) return;
        setEditingDeal({ ...editingDeal, ledgerNo });
    };
    const unlinkLedger = () => {
        if (!editingDeal) return;
        setEditingDeal({ ...editingDeal, ledgerNo: null });
    };

    const handleLinkAll = () => {
        let n = 0;
        setDeals(prev => prev.map(d => {
            if (d.ledgerNo || d.status === '中止') return d;
            const found = rsFindLedger(d, ledgerList);
            if (found) { n++; return { ...d, ledgerNo: rsNum(found.no) }; }
            return d;
        }));
        alert(n ? `${n}件の案件を媒介台帳へ自動リンクしました。` : '新たにリンクできる案件はありませんでした。');
    };

    // ==========================================
    // 💡 帳簿記載事項のコピー（消費税法施行令49条の特例適用時に必要な記載事項）
    // ==========================================
    const copyBookNote = async () => {
        if (!editingDeal) return;
        const text = [
            '消費税法施行令第49条第1項第1号ロ該当（宅地建物取引業者の棚卸資産特例）',
            `相手方：${editingDeal.seller || '（売主名）'}　${editingDeal.addr || '（住所）'}`,
            `取引年月日：${editingDeal.buySettleDate || editingDeal.buyContractDate || '（取引年月日）'}`,
            '取引の内容：建物（棚卸資産・販売用不動産）',
            `支払対価の額：${formatYen(rsNum(editingDeal.buyPrice))}　うち建物 ${formatYen(rsNum(editingDeal.buyBuilding))}`,
        ].join('\n');
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                alert('帳簿記載事項をコピーしました。');
                return;
            }
        } catch (e) { /* noop */ }
        window.prompt('コピーしてください', text);
    };

    const planCalc = useMemo(() => editingDeal ? rsCalc(editingDeal, 'plan', gpMode) : null, [editingDeal, gpMode]);
    const actCalc = useMemo(() => editingDeal ? rsCalc(editingDeal, 'act', gpMode) : null, [editingDeal, gpMode]);

    return (
        <div style={{ padding: '20px', backgroundColor: '#fafbfe', minHeight: '100vh', width: '100%', overflowX: 'auto' }}>
            {/* ヘッダー */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #dee2e6', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '14px', fontWeight: 'bold', color: '#495057', letterSpacing: '0.5px', margin: 0 }}>
                        <i className="bi bi-arrow-repeat me-2" style={{ color: '#0d6efd' }}></i>買取再販案件管理
                    </h1>
                    <p style={{ fontSize: '11px', color: '#6c757d', margin: '4px 0 0' }}>
                        自社買取（仕入）〜リフォーム〜再販売までの収支と、宅建業者の棚卸資産特例に基づく消費税インボイス控除を一元管理します。
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'bold' }}>粗利の計算方式</label>
                    <select className="form-select form-select-sm" style={{ width: '260px', fontSize: '11px' }} value={gpMode} onChange={e => setGpMode(e.target.value as RsGpMode)}>
                        <option value="incl">買取提案書と同じ（控除を見ない）</option>
                        <option value="credit">建物の仕入税額控除を反映</option>
                        <option value="net">ネット（税抜換算）</option>
                    </select>
                    <button
                        className="shadow-sm"
                        style={{ backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', padding: '0 16px', fontSize: '11px', fontWeight: 'bold', height: '26px' }}
                        onClick={openNewDeal}
                    >
                        <i className="bi bi-plus-lg"></i> 案件を登録
                    </button>
                </div>
            </div>

            {!isLoading && (
                <>
                    {/* KPIタイル */}
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        {[
                            { label: '保有件数', value: String(holdDeals.length), color: '#3182ce', sub: '' },
                            { label: '投下資金（保有中）', value: formatMan(invested), color: '#38b2ac', sub: '実績入力済みの費目ベース' },
                            { label: '当月確定利益', value: formatMan(gpDoneMonth), color: '#48bb78', sub: `${doneMonthDeals.length}件・${thisMonthKey}決済分` },
                            { label: '保有中 見込利益', value: formatMan(gpHold), color: '#9f7aea', sub: rsGpLabel(gpMode) },
                            { label: '平均保有日数', value: avgHoldDays == null ? '―' : `${avgHoldDays}日`, color: longHoldCount > 0 ? '#e53e3e' : '#ed8936', sub: longHoldCount > 0 ? `⚠ 180日超過 ${longHoldCount}件` : '' },
                        ].map((item, idx) => (
                            <div key={idx} style={{ flex: '1 1 180px', backgroundColor: '#fff', borderRadius: '8px', padding: '14px 16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: `4px solid ${item.color}` }}>
                                <div style={{ fontSize: '11px', color: '#6c757d', fontWeight: 'bold', marginBottom: '4px' }}>{item.label}</div>
                                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#212529' }}>{item.value}</div>
                                {item.sub && <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '4px' }}>{item.sub}</div>}
                            </div>
                        ))}
                    </div>

                    {/* コンプライアンス注意カード */}
                    {(regPendingCount > 0 || cliffCount > 0 || noBldCount > 0 || unlinkedCount > 0) && (
                        <div className="card shadow-sm border-0 rounded-3 mb-4">
                            <div className="card-header bg-white border-bottom-0 pt-3 pb-2">
                                <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '12px' }}>⚠ 要対応</h6>
                            </div>
                            <div className="card-body pt-0" style={{ fontSize: '11px' }}>
                                {regPendingCount > 0 && (
                                    <div className="mb-2">
                                        <span className="badge bg-warning text-dark me-2">インボイス登録 未確認 {regPendingCount}件</span>
                                        売主が適格請求書発行事業者でないことを国税庁公表サイトで確認し、証跡を保存してください。
                                    </div>
                                )}
                                {cliffCount > 0 && (
                                    <div className="mb-2">
                                        <span className="badge bg-danger me-2">特例適用不可 {cliffCount}件</span>
                                        棚卸資産に計上されていないため、経過措置分のみしか仕入税額控除できていません。
                                    </div>
                                )}
                                {noBldCount > 0 && (
                                    <div className="mb-2">
                                        <span className="badge bg-danger me-2">建物価格 未入力 {noBldCount}件</span>
                                        売上から建物消費税が控除されず、粗利が過大に表示されています。
                                    </div>
                                )}
                                {unlinkedCount > 0 && (
                                    <div>
                                        <span className="badge bg-secondary me-2">媒介台帳 未リンク {unlinkedCount}件</span>
                                        <button className="btn btn-sm btn-outline-secondary py-0 px-2" style={{ fontSize: '10px' }} onClick={handleLinkAll}>🔗 一括自動リンク</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 月次確定利益テーブル */}
                    {monthlyKeys.length > 0 && (
                        <div className="card shadow-sm border-0 rounded-3 mb-4">
                            <div className="card-header bg-white border-bottom-0 pt-3 pb-2">
                                <h6 className="fw-bold text-dark mb-0" style={{ fontSize: '12px' }}>月次 確定利益（決済完了ベース）</h6>
                            </div>
                            <div className="card-body p-0">
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ ...compactThStyle, textAlign: 'left' }}>区分</th>
                                                {monthlyKeys.map(mk => <th key={mk} style={{ ...compactThStyle, textAlign: 'right' }}>{mk}</th>)}
                                                <th style={{ ...compactThStyle, textAlign: 'right' }}>合計</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td style={{ ...compactTdStyle, fontWeight: 'bold' }}>確定利益</td>
                                                {monthlyKeys.map(mk => {
                                                    const v = deals.filter(d => d.status === RS_DONE && d.sellSettleDate?.slice(0, 7) === mk).reduce((s, d) => s + rsCalc(d, 'act', gpMode).gp, 0);
                                                    return <td key={mk} style={{ ...compactTdStyle, textAlign: 'right' }}>{formatMan(v)}</td>;
                                                })}
                                                <td style={{ ...compactTdStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatMan(monthlyKeys.reduce((s, mk) => s + deals.filter(d => d.status === RS_DONE && d.sellSettleDate?.slice(0, 7) === mk).reduce((s2, d) => s2 + rsCalc(d, 'act', gpMode).gp, 0), 0))}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* フィルタバー */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                        <select className="form-select form-select-sm" style={{ width: '160px', fontSize: '11px' }} value={filters.staff} onChange={e => setFilters({ ...filters, staff: e.target.value })}>
                            <option value="">仕入担当：全員</option>
                            {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select className="form-select form-select-sm" style={{ width: '200px', fontSize: '11px' }} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                            <option value="">ステータス：すべて</option>
                            <option value="hold">保有中のみ</option>
                            {RS_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <input type="text" className="form-control form-control-sm" style={{ width: '260px', fontSize: '11px' }} placeholder="物件名・所在地・売主・買主で検索" value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} />
                        <span style={{ fontSize: '11px', color: '#6c757d' }}>{filteredDeals.length} 件 / 全{deals.length}件</span>
                    </div>

                    {/* メインテーブル */}
                    <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', minWidth: '1400px' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                    <tr>
                                        <th style={compactThStyle}>No.</th>
                                        <th style={{ ...compactThStyle, textAlign: 'left' }}>物件</th>
                                        <th style={compactThStyle}>ステータス</th>
                                        <th style={compactThStyle}>仕入担当</th>
                                        <th style={{ ...compactThStyle, textAlign: 'right' }}>仕入価格</th>
                                        <th style={{ ...compactThStyle, textAlign: 'right' }}>販売（予定/成約）</th>
                                        <th style={{ ...compactThStyle, textAlign: 'right' }}>リフォーム費用</th>
                                        <th style={{ ...compactThStyle, textAlign: 'right' }}>原価合計</th>
                                        <th style={{ ...compactThStyle, textAlign: 'right' }}>粗利</th>
                                        <th style={{ ...compactThStyle, textAlign: 'right' }}>粗利率</th>
                                        <th style={{ ...compactThStyle, textAlign: 'right' }}>保有日数</th>
                                        <th style={compactThStyle}>台帳</th>
                                        <th style={compactThStyle}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDeals.length > 0 ? filteredDeals.map(d => {
                                        const mode = rsMode(d);
                                        const c = rsCalc(d, mode, gpMode);
                                        const days = rsHoldDays(d);
                                        const alertDays = days != null && RS_HOLD.includes(d.status) && days >= 180;
                                        return (
                                            <tr key={d.id}>
                                                <td style={compactTdStyle} className="text-muted">{d.no}</td>
                                                <td style={{ ...compactTdStyle, textAlign: 'left', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.property}>
                                                    <span
                                                        style={{ color: '#3182ce', textDecoration: 'underline dotted', cursor: 'pointer', fontWeight: 'bold' }}
                                                        onClick={() => openEditDeal(d)}
                                                    >
                                                        {d.property || '(物件名未設定)'}
                                                    </span>
                                                    <div className="small text-muted">{d.category}{d.addr ? `・${d.addr}` : ''}</div>
                                                </td>
                                                <td style={compactTdStyle}>
                                                    <span className={`badge ${statusBadgeClass(d.status)}`} style={{ fontSize: '10px' }}>{d.status}</span>
                                                    {rsActPending(d) > 0 && mode === 'act' && <div className="small text-warning">実績未入力 {rsActPending(d)}件</div>}
                                                    {rsRegPending(d) && <div className="small text-danger">登録未確認</div>}
                                                </td>
                                                <td style={compactTdStyle}>{d.staff || '―'}</td>
                                                <td style={{ ...compactTdStyle, textAlign: 'right' }}>{formatYen(d.buyPrice)}</td>
                                                <td style={{ ...compactTdStyle, textAlign: 'right' }}>
                                                    {formatYen(d.sellPrice || d.listPrice)}
                                                    <div className="small text-muted">{mode === 'act' ? '確定' : '見込'}</div>
                                                </td>
                                                <td style={{ ...compactTdStyle, textAlign: 'right' }}>{formatYen(rsReformTotal(d))}</td>
                                                <td style={{ ...compactTdStyle, textAlign: 'right' }}>{formatYen(c.totalCost)}</td>
                                                <td style={{ ...compactTdStyle, textAlign: 'right', fontWeight: 'bold', color: c.gp < 0 ? '#dc3545' : '#198754' }}>{c.fixed ? formatYen(c.gp) : '―'}</td>
                                                <td style={{ ...compactTdStyle, textAlign: 'right' }}>{c.fixed ? pct(c.rate) : '―'}</td>
                                                <td style={{ ...compactTdStyle, textAlign: 'right', backgroundColor: alertDays ? '#fdf6d8' : undefined }}>{days == null ? '―' : `${days}日`}</td>
                                                <td style={compactTdStyle}>
                                                    {d.ledgerNo ? <span className="badge bg-primary bg-opacity-10 text-primary border border-primary">台帳No.{d.ledgerNo}</span> : <span className="badge bg-secondary bg-opacity-10 text-secondary border">未リンク</span>}
                                                </td>
                                                <td style={compactTdStyle}>
                                                    <button className="btn btn-light border btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => openEditDeal(d)}>編集</button>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan={13} style={{ padding: '40px', textAlign: 'center', color: '#6c757d' }}>
                                                {isLoading ? '読み込み中...' : '該当する買取再販案件が見つかりません。「＋ 案件を登録」から追加してください。'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ==========================================
                💡 編集モーダル
            ========================================== */}
            <Modal show={isEditOpen} onHide={() => setIsEditOpen(false)} centered size="xl">
                <Modal.Header closeButton className="border-bottom-0 pb-0 bg-light pt-2 px-3">
                    <Modal.Title className="fw-bold text-secondary" style={{ fontSize: '15px' }}>
                        <i className="bi bi-arrow-repeat me-2 text-primary"></i>買取再販案件 {editingId ? '編集' : '新規登録'}
                    </Modal.Title>
                </Modal.Header>
                {editingDeal && (
                    <>
                        <Modal.Body className="pt-3 pb-3 px-3 bg-light" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            {/* ① 取引情報 */}
                            <div className="bg-white rounded shadow-sm border p-3 mb-3">
                                <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '12px' }}>① 取引情報</h6>
                                <div className="row g-2">
                                    <div className="col-md-6">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>物件名 <span className="text-danger">*必須</span></label>
                                        <input type="text" className="form-control form-control-sm" value={editingDeal.property} onChange={e => setEditingDeal({ ...editingDeal, property: e.target.value })} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>種別</label>
                                        <select className="form-select form-select-sm" value={editingDeal.category} onChange={e => setEditingDeal({ ...editingDeal, category: e.target.value as ResaleCategory })}>
                                            {RS_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>ステータス</label>
                                        <select className="form-select form-select-sm" value={editingDeal.status} onChange={e => setEditingDeal({ ...editingDeal, status: e.target.value as ResaleStatus })}>
                                            {RS_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>所在地</label>
                                        <input type="text" className="form-control form-control-sm" value={editingDeal.addr} onChange={e => setEditingDeal({ ...editingDeal, addr: e.target.value })} />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>仕入担当</label>
                                        <select className="form-select form-select-sm" value={editingDeal.staff} onChange={e => setEditingDeal({ ...editingDeal, staff: e.target.value })}>
                                            <option value="">未設定</option>
                                            {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>販売担当</label>
                                        <select className="form-select form-select-sm" value={editingDeal.sellStaff} onChange={e => setEditingDeal({ ...editingDeal, sellStaff: e.target.value })}>
                                            <option value="">未設定</option>
                                            {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-2" style={{ fontSize: '11px' }}>
                                    媒介台帳：{' '}
                                    {linkedLedger ? (
                                        <>
                                            <span className="badge bg-primary bg-opacity-10 text-primary border border-primary">台帳 No.{editingDeal.ledgerNo}・{linkedLedger.seller || ''}</span>
                                            <button className="btn btn-sm btn-outline-secondary py-0 px-2 ms-2" style={{ fontSize: '10px' }} onClick={unlinkLedger}>リンク解除</button>
                                        </>
                                    ) : suggestedLedger ? (
                                        <>
                                            <span className="badge bg-secondary bg-opacity-10 text-secondary border">候補：台帳 No.{suggestedLedger.no}・{suggestedLedger.seller || ''}</span>
                                            <button className="btn btn-sm btn-outline-primary py-0 px-2 ms-2" style={{ fontSize: '10px' }} onClick={() => linkLedger(rsNum(suggestedLedger.no))}>🔗 このリンクを採用</button>
                                        </>
                                    ) : (
                                        <span className="text-muted">一致する台帳候補はありません</span>
                                    )}
                                </div>
                            </div>

                            {/* ② 仕入 */}
                            <div className="bg-white rounded shadow-sm border p-3 mb-3">
                                <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '12px' }}>② 仕入</h6>
                                <div className="row g-2">
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>売主（仕入先）</label>
                                        <input type="text" className="form-control form-control-sm" value={editingDeal.seller} onChange={e => setEditingDeal({ ...editingDeal, seller: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>仕入価格（円・税込）</label>
                                        <input type="number" className="form-control form-control-sm text-end" value={editingDeal.buyPrice || ''} onChange={e => setEditingDeal({ ...editingDeal, buyPrice: Number(e.target.value) || 0 })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>うち建物価格（円・税込）</label>
                                        <input type="number" className="form-control form-control-sm text-end" value={editingDeal.buyBuilding || ''} onChange={e => setEditingDeal({ ...editingDeal, buyBuilding: Number(e.target.value) || 0 })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>売主のインボイス登録</label>
                                        <select className="form-select form-select-sm" value={editingDeal.buySellerReg} onChange={e => setEditingDeal({ ...editingDeal, buySellerReg: e.target.value as ResaleSellerReg })}>
                                            {RS_REG.map(r => <option key={r} value={r}>{RS_REG_LABEL[r]}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>登録状況の確認日</label>
                                        <input type="date" className="form-control form-control-sm" value={editingDeal.taxCheckDate} onChange={e => setEditingDeal({ ...editingDeal, taxCheckDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-4 d-flex align-items-end">
                                        <div className="form-check">
                                            <input className="form-check-input" type="checkbox" id="rsStock" checked={editingDeal.buyStockAsset} onChange={e => setEditingDeal({ ...editingDeal, buyStockAsset: e.target.checked })} />
                                            <label className="form-check-label" htmlFor="rsStock" style={{ fontSize: '11px' }}>棚卸資産（販売用不動産）として計上する</label>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>仕入契約日</label>
                                        <input type="date" className="form-control form-control-sm" value={editingDeal.buyContractDate} onChange={e => setEditingDeal({ ...editingDeal, buyContractDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>仕入決済日</label>
                                        <input type="date" className="form-control form-control-sm" value={editingDeal.buySettleDate} onChange={e => setEditingDeal({ ...editingDeal, buySettleDate: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* ③ 販売 */}
                            <div className="bg-white rounded shadow-sm border p-3 mb-3">
                                <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '12px' }}>③ 販売</h6>
                                <div className="row g-2">
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>買主（販売先）</label>
                                        <input type="text" className="form-control form-control-sm" value={editingDeal.buyer} onChange={e => setEditingDeal({ ...editingDeal, buyer: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>売出価格（円・税込）</label>
                                        <input type="number" className="form-control form-control-sm text-end" value={editingDeal.listPrice || ''} onChange={e => setEditingDeal({ ...editingDeal, listPrice: Number(e.target.value) || 0 })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>売出開始日</label>
                                        <input type="date" className="form-control form-control-sm" value={editingDeal.listDate} onChange={e => setEditingDeal({ ...editingDeal, listDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>成約価格（円・税込）</label>
                                        <input type="number" className="form-control form-control-sm text-end" value={editingDeal.sellPrice || ''} onChange={e => setEditingDeal({ ...editingDeal, sellPrice: Number(e.target.value) || 0 })} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>うち建物価格（円・税込）</label>
                                        <div className="d-flex gap-1">
                                            <input type="number" className="form-control form-control-sm text-end" value={editingDeal.sellBuilding || ''} onChange={e => setEditingDeal({ ...editingDeal, sellBuilding: Number(e.target.value) || 0 })} />
                                            <button className="btn btn-outline-secondary btn-sm" style={{ fontSize: '10px', whiteSpace: 'nowrap' }} onClick={autoCalcSellBuilding}>仕入按分</button>
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>目標粗利（円）</label>
                                        <input type="number" className="form-control form-control-sm text-end" value={editingDeal.targetGp || ''} onChange={e => setEditingDeal({ ...editingDeal, targetGp: Number(e.target.value) || 0 })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>売買契約日</label>
                                        <input type="date" className="form-control form-control-sm" value={editingDeal.sellContractDate} onChange={e => setEditingDeal({ ...editingDeal, sellContractDate: e.target.value })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>販売決済日</label>
                                        <input type="date" className="form-control form-control-sm" value={editingDeal.sellSettleDate} onChange={e => setEditingDeal({ ...editingDeal, sellSettleDate: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* ④ コスト項目 */}
                            <div className="bg-white rounded shadow-sm border p-3 mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <h6 className="fw-bold text-secondary mb-0" style={{ fontSize: '12px' }}>④ コスト項目（計画・実績）</h6>
                                    <button className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={resetCostItems}>標準項目に入れ替え</button>
                                </div>
                                {RS_CATS.map(cat => (
                                    <div key={cat} className="mb-3">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <div className="fw-bold text-secondary" style={{ fontSize: '11px' }}>{cat}</div>
                                            <button className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={() => addCostRow(cat)}>＋行を追加</button>
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ ...compactThStyle, textAlign: 'left' }}>項目名</th>
                                                    <th style={compactThStyle}>課税</th>
                                                    <th style={{ ...compactThStyle, textAlign: 'right' }}>計画（税込）</th>
                                                    <th style={{ ...compactThStyle, textAlign: 'right' }}>実績（税込）</th>
                                                    <th style={compactThStyle}></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {editingDeal.costs.filter(c => c.cat === cat).map(c => (
                                                    <tr key={c.id}>
                                                        <td style={{ ...compactTdStyle, minWidth: '180px' }}>
                                                            <input type="text" style={{ ...compactInputStyle, textAlign: 'left' }} value={c.label} onChange={e => updateCostRow(c.id, 'label', e.target.value)} />
                                                        </td>
                                                        <td style={{ ...compactTdStyle, textAlign: 'center' }}>
                                                            <input type="checkbox" checked={!!c.tax} onChange={e => updateCostRow(c.id, 'tax', e.target.checked ? 1 : 0)} />
                                                        </td>
                                                        <td style={{ ...compactTdStyle, width: '120px' }}>
                                                            <input type="number" style={compactInputStyle} value={c.plan} onChange={e => updateCostRow(c.id, 'plan', e.target.value)} />
                                                        </td>
                                                        <td style={{ ...compactTdStyle, width: '120px' }}>
                                                            <input type="number" style={compactInputStyle} value={c.actual} onChange={e => updateCostRow(c.id, 'actual', e.target.value)} />
                                                        </td>
                                                        <td style={compactTdStyle}>
                                                            <button className="icon-btn" style={{ border: 'none', background: 'none', color: '#9aa1a9' }} onClick={() => deleteCostRow(c.id)}>✕</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {editingDeal.costs.filter(c => c.cat === cat).length === 0 && (
                                                    <tr><td colSpan={5} className="text-center text-muted py-2" style={{ fontSize: '10px' }}>項目がありません</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>

                            {/* ⑤ 収支サマリー */}
                            {planCalc && actCalc && (
                                <div className="bg-white rounded shadow-sm border p-3 mb-3">
                                    <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '12px' }}>⑤ 収支サマリー（{rsGpLabel(gpMode)}）</h6>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ ...compactThStyle, textAlign: 'left' }}>項目</th>
                                                <th style={{ ...compactThStyle, textAlign: 'right' }}>見込（計画）</th>
                                                <th style={{ ...compactThStyle, textAlign: 'right' }}>確定（実績）</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr><td style={compactTdStyle}>売上（税抜・建物消費税控除後）</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{formatYen(planCalc.sellNet)}</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{actCalc.fixed ? formatYen(actCalc.sellNet) : '―'}</td></tr>
                                            <tr><td style={compactTdStyle}>仕入原価（建物仕入税額控除後）</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{formatYen(planCalc.buyCost)}</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{formatYen(actCalc.buyCost)}</td></tr>
                                            {RS_CATS.map(cat => (
                                                <tr key={cat}><td style={compactTdStyle}>経費：{cat}</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{formatYen(planCalc.byCat[cat] || 0)}</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{formatYen(actCalc.byCat[cat] || 0)}</td></tr>
                                            ))}
                                            <tr style={{ backgroundColor: '#f8f9fa' }}><td style={{ ...compactTdStyle, fontWeight: 'bold' }}>原価合計</td><td style={{ ...compactTdStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatYen(planCalc.totalCost)}</td><td style={{ ...compactTdStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatYen(actCalc.totalCost)}</td></tr>
                                            <tr><td style={{ ...compactTdStyle, fontWeight: 'bold' }}>粗利</td><td style={{ ...compactTdStyle, textAlign: 'right', fontWeight: 'bold', color: planCalc.gp < 0 ? '#dc3545' : '#198754' }}>{formatYen(planCalc.gp)}</td><td style={{ ...compactTdStyle, textAlign: 'right', fontWeight: 'bold', color: actCalc.gp < 0 ? '#dc3545' : '#198754' }}>{actCalc.fixed ? formatYen(actCalc.gp) : '―'}</td></tr>
                                            <tr><td style={compactTdStyle}>粗利率</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{pct(planCalc.rate)}</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{actCalc.fixed ? pct(actCalc.rate) : '―'}</td></tr>
                                            {editingDeal.targetGp > 0 && (
                                                <tr><td style={compactTdStyle}>目標粗利との差</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{formatYen(planCalc.gp - editingDeal.targetGp)}</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{actCalc.fixed ? formatYen(actCalc.gp - editingDeal.targetGp) : '―'}</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* ⑥ 消費税セクション */}
                            {actCalc && (
                                <div className="bg-white rounded shadow-sm border p-3 mb-3">
                                    <h6 className="fw-bold text-secondary mb-2" style={{ fontSize: '12px' }}>⑥ 消費税（建物分）</h6>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '8px' }}>
                                        <tbody>
                                            <tr><td style={compactTdStyle}>仮受消費税（売却建物・{formatYen(actCalc.sellBld)}）</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{formatYen(actCalc.sellTax)}</td></tr>
                                            <tr><td style={compactTdStyle}>控除できる仕入消費税（仕入建物・{formatYen(actCalc.vat.bld)}）</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{formatYen(-actCalc.vat.credit)}</td></tr>
                                            {actCalc.vat.lost > 0 && <tr><td style={compactTdStyle} className="text-muted">うち控除できない額</td><td style={{ ...compactTdStyle, textAlign: 'right' }}>{formatYen(actCalc.vat.lost)}</td></tr>}
                                            <tr style={{ backgroundColor: '#f8f9fa' }}><td style={{ ...compactTdStyle, fontWeight: 'bold' }}>差引 納付／還付見込</td><td style={{ ...compactTdStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatYen(actCalc.vatPay)}</td></tr>
                                        </tbody>
                                    </table>
                                    <div className="small text-muted mb-1">判定根拠：{actCalc.vat.basis}</div>
                                    {actCalc.vat.warn && <div className="alert alert-warning py-2 px-3 mb-2" style={{ fontSize: '11px' }}>⚠ {actCalc.vat.warn}</div>}
                                    {actCalc.vat.tokurei && (
                                        <button className="btn btn-outline-secondary btn-sm py-0 px-2" style={{ fontSize: '10px' }} onClick={copyBookNote}>帳簿記載事項をコピー（消令49条特例）</button>
                                    )}
                                </div>
                            )}

                            {/* 備考 */}
                            <div className="bg-white rounded shadow-sm border p-3">
                                <label className="form-label text-muted fw-bold mb-0" style={{ fontSize: '10px' }}>備考</label>
                                <textarea className="form-control form-control-sm" style={{ height: '50px', resize: 'none' }} value={editingDeal.note} onChange={e => setEditingDeal({ ...editingDeal, note: e.target.value })} />
                            </div>
                        </Modal.Body>
                        <Modal.Footer className="bg-light border-top-0 pt-0 pb-3 d-flex justify-content-between align-items-center">
                            <div>
                                {editingId && <button className="btn btn-outline-danger btn-sm px-3 fw-bold" style={{ fontSize: '11px' }} onClick={handleDeleteDeal}>削除</button>}
                            </div>
                            <div className="d-flex gap-2">
                                <button className="btn btn-outline-secondary btn-sm px-3 fw-bold" style={{ fontSize: '11px' }} onClick={() => setIsEditOpen(false)}>キャンセル</button>
                                <button className="btn btn-primary btn-sm px-4 fw-bold shadow-sm" style={{ fontSize: '11px' }} onClick={handleSaveDeal}>保存する</button>
                            </div>
                        </Modal.Footer>
                    </>
                )}
            </Modal>
        </div>
    );
};

export default LeadResale;
