import React, { useState, useEffect, useMemo } from 'react';
import Modal from 'react-bootstrap/Modal';

// ==========================================
// 💡 1. 型定義
// ==========================================
export type ExtraRow = {
    id: string;
    label: string;
    amount: number;
    dir: 'in' | 'out'; // 収入 | 支出
};

export type ExtraState = {
    s: ExtraRow[];
    b: ExtraRow[];
};

export type PlannerInputState = {
    // 1. 取引情報
    propName: string; propZip: string; propAddr: string;
    seller: string; sellerZip: string; sellerAddr: string;
    buyer: string; contractDate: string; delivery: string;
    place: string; placeAddr: string; startTime: string;
    price: number; deposit: number; interim: number;
    // 2. 固都税精算・仲介手数料
    taxBase: '01-01' | '04-01'; taxDay: 'buyer' | 'seller';
    t1: number; t2: number; t3: number; t4: number;
    mode: 'both' | 'seller' | 'buyer'; lowPrice: '0' | '1';
    sDisc: number; sPaid: number; bDisc: number; bPaid: number;
    // 3. 売主 精算
    loanPrin: number; loanInt: number; loanFee: number;
    sJudi: number; sStamp: number;
    // 振込手数料
    rel: 'same_branch' | 'same_bank' | 'other_bank'; ch: 'counter' | 'atm' | 'online'; tfCount: number;
    // 4. 買主 精算
    bJudi: number; bArr: number; bGuar: number; bIns: number; bStamp: number; bLoan: number;
    // 5. 請求書
    billTo: 'both' | 'seller' | 'buyer'; invNoS: string; invNoB: string; invDate: string; invDue: string; invReg: string; payAcct: 'brokerage' | 'resale' | 'reform';
    // 6. 領収証
    rcOn: '1' | '0'; rcTarget: 'both' | 'balance' | 'tax' | 'custom'; rcCustom: number; rcSign: 'blank' | 'print'; rcStamp: 'free' | 'taxed';
    // 7. 売主インボイス
    sellerTaxable: '0' | '1'; sellerInvReg: string; sellerVat: number;
    sBank: string; sBranch: string; sAcctType: string; sAcctNo: string; sAcctName: string; sAcctKana: string;
};

// 💡 ユーザーの指定に基づき、オプショナルプロパティを安全に拡張
export type initialData = {
    name: string | null;
    baikaiType: '専任媒介' | '専属専任媒介' | '一般媒介';
    category?: string | null;
    phone?: string | null;
    mail?: string | null;
    addr: string | null;
    price: number | null;
    fee: number | null;
};

// ==========================================
// 💡 2. 計算ロジック・マスター
// ==========================================
const formatYen = (num: number | string | null | undefined) => {
    if (num == null || isNaN(Number(num))) return '―';
    return `¥${Number(num).toLocaleString('ja-JP')}`;
};

const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.startsWith('0000')) return '―';
    const [y, m, d] = dateStr.split('-');
    return `${y}/${Number(m)}/${Number(d)}`;
};

const CONTRACT_STAMP = [
    [1e5, 200], [5e5, 200], [1e6, 500], [5e6, 1000], [1e7, 5000], [5e7, 10000],
    [1e8, 30000], [5e8, 60000], [1e9, 160000], [5e9, 320000], [Infinity, 480000]
];

const contractStamp = (p: number) => {
    if (p < 10000) return 0;
    for (const [u, f] of CONTRACT_STAMP) {
        if (p <= u) return f;
    }
    return 480000;
};

const STAMP = [
    [1e6, 200], [2e6, 400], [3e6, 600], [5e6, 1000], [1e7, 2000], [2e7, 4000],
    [3e7, 6000], [5e7, 10000], [1e8, 20000], [2e8, 40000], [3e8, 60000], [5e8, 100000],
    [1e9, 150000], [Infinity, 200000]
];

const stampDuty = (a: number) => {
    if (a < 50000) return 0;
    for (const [u, f] of STAMP) {
        if (a <= u) return f;
    }
    return 200000;
};

const FEE_TABLE: any = {
    same_branch: { counter: [[null, 0]], atm: [[null, 0]], online: [[null, 0]] },
    same_bank: { counter: [[30000, 330], [null, 550]], atm: [[30000, 110], [null, 330]], online: [[null, 110]] },
    other_bank: { counter: [[30000, 660], [null, 880]], atm: [[30000, 330], [null, 550]], online: [[30000, 220], [null, 440]] }
};

const transferFee = (rel: string, ch: string, amt: number) => {
    const rows = (FEE_TABLE[rel] || {})[ch] || [[null, 0]];
    for (const [max, fee] of rows) {
        if (max === null || amt <= max) return fee;
    }
    return rows[rows.length - 1][1];
};

const brokerageBase = (price: number, low: boolean) => {
    let net = 0, formula = '';
    if (price > 4000000) {
        net = price * 0.03 + 60000;
        formula = '代金×3%＋60,000円';
    } else if (price > 2000000) {
        net = price * 0.04 + 20000;
        formula = '代金×4%＋20,000円';
    } else {
        net = price * 0.05;
        formula = '代金×5%';
    }
    if (low && price <= 8000000) {
        net = Math.max(net, 300000);
        formula = '低廉な空家等の特例';
    }
    return { net: Math.round(net), formula };
};

const feeFor = (baseNet: number, apply: boolean, disc: number, paid: number) => {
    if (!apply) return { net: 0, tax: 0, total: 0, paidT: 0, balance: 0 };
    const net = Math.max(0, baseNet - Math.round(disc));
    const tax = Math.round(net * 0.1);
    const total = net + tax;
    const p = Math.round(paid);
    const paidT = p + Math.round(p * 0.1);
    return { net, tax, total, paidT, balance: total - paidT };
};

const proration = (annual: number, iso: string, baseMD: string, dayOwner: string) => {
    if (!iso) return { sellerDays: 0, buyerDays: 0, buyer: 0, seller: 0, period: '―' };
    const [y, m, d] = iso.split('-').map(Number);
    const del = new Date(y, m - 1, d);
    const [bm, bd] = baseMD.split('-').map(Number);
    let st = new Date(y, bm - 1, bd);
    if (del < st) st = new Date(y - 1, bm - 1, bd);

    let sd = Math.round((del.getTime() - st.getTime()) / 86400000);
    if (dayOwner === 'seller') sd += 1;
    sd = Math.max(0, Math.min(sd, 365)); // 💡 分母は365日固定
    const bdays = 365 - sd;
    const buyer = Math.round((annual * bdays) / 365);

    const end = new Date(st.getFullYear() + 1, bm - 1, bd);
    end.setDate(end.getDate() - 1);
    const f = (x: Date) => `${x.getFullYear()}/${x.getMonth() + 1}/${x.getDate()}`;

    return { sellerDays: sd, buyerDays: bdays, buyer, seller: annual - buyer, period: `${f(st)} 〜 ${f(end)}` };
};

const PAY_ACCOUNTS = {
    brokerage: { use: '仲介手数料', bank: '鹿児島銀行', branch: '国分支店', type: '普通', no: '3142392', holder: '株式会社国分ハウジング不動産', kana: 'カ）コクブハウジングフドウサン' },
    resale: { use: '中古再販', bank: '鹿児島信用金庫', branch: '国分支店', type: '普通', no: '7587647', holder: '株式会社国分ハウジング', kana: 'カ）コクブハウジング' },
    reform: { use: 'リフォーム工事直請負', bank: '鹿児島銀行', branch: '国分支店', type: '普通', no: '3044528', holder: '株式会社国分ハウジング', kana: 'カ）コクブハウジング' }
};

// ==========================================
// 💡 3. スタイル定義
// ==========================================
const s = {
    wrap: { width: '100%', margin: '0 auto', padding: '20px', fontFamily: '"Noto Sans JP", sans-serif', fontSize: '13px', color: '#16191d', backgroundColor: '#f4f6f8' } as React.CSSProperties,
    topBar: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '20px', padding: '12px 20px', backgroundColor: '#fff', border: '1px solid #e2e6ea', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' } as React.CSSProperties,
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '14px', alignItems: 'start' } as React.CSSProperties,
    card: { backgroundColor: '#fff', border: '1px solid #e2e6ea', borderRadius: '5px', padding: '16px 18px 18px' } as React.CSSProperties,
    cardTitle: { margin: '0 0 13px', fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.1em', color: '#1b3a6b', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px', borderBottom: '1px solid #e2e6ea' } as React.CSSProperties,
    noBadge: { fontSize: '11px', color: '#fff', backgroundColor: '#1b3a6b', borderRadius: '2px', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
    subTitle: { margin: '16px 0 7px', fontSize: '11px', letterSpacing: '0.1em', color: '#79818b', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
    fRow: { display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 0', borderBottom: '1px dotted #e2e6ea' } as React.CSSProperties,
    fLabel: { flex: 1, color: '#79818b', fontSize: '11.5px', lineHeight: 1.4 } as React.CSSProperties,
    fHint: { display: 'block', color: '#9aa1a9', fontSize: '10px' } as React.CSSProperties,
    input: { width: '150px', textAlign: 'right', padding: '4px 8px', border: '1px solid #e2e6ea', borderRadius: '3px', backgroundColor: '#fbfcfd', fontSize: '12px', outline: 'none' } as React.CSSProperties,
    inputSelect: { width: '150px', padding: '4px 8px', border: '1px solid #e2e6ea', borderRadius: '3px', backgroundColor: '#fbfcfd', fontSize: '12px', outline: 'none' } as React.CSSProperties,
    inputWide: { width: '80%', textAlign: 'left' } as React.CSSProperties,
    unit: { color: '#9aa1a9', fontSize: '11px', width: '14px', flex: 'none' } as React.CSSProperties,
    totRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0', borderBottom: '1px solid #f0f2f5' } as React.CSSProperties,
    totLabel: { color: '#79818b', fontSize: '12px' } as React.CSSProperties,
    totVal: { fontSize: '15px', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums' } as React.CSSProperties,
    totBig: { backgroundColor: '#e8eef7', borderRadius: '4px', padding: '12px 14px', marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } as React.CSSProperties,

    xrow: { display: 'flex', gap: '6px', alignItems: 'center', padding: '3px 0' } as React.CSSProperties,
    btnDel: { border: 'none', background: 'transparent', color: '#9aa1a9', cursor: 'pointer', padding: '2px 6px', fontSize: '14px' } as React.CSSProperties,
    emptyExtra: { fontSize: '11px', color: '#9aa1a9', padding: '6px 0' } as React.CSSProperties,
    alertBox: { background: '#fdf0f0', borderLeft: '3px solid #b4232a', padding: '8px 11px', fontSize: '11.5px', color: '#b4232a', marginTop: '8px', lineHeight: 1.6, borderRadius: '0 3px 3px 0' } as React.CSSProperties,
    infoBox: { background: '#e8eef7', borderLeft: '3px solid #1b3a6b', padding: '8px 11px', fontSize: '11.5px', color: '#1b3a6b', marginTop: '8px', lineHeight: 1.6, borderRadius: '0 3px 3px 0' } as React.CSSProperties,
};

// ==========================================
// 💡 4. メインコンポーネント
// ==========================================
export const PlannerGenerator = ({ plannerShow, setPlannerShow, initialData }: {
    plannerShow: boolean,
    setPlannerShow: React.Dispatch<React.SetStateAction<boolean>>,
    // 💡 追加: 呼び出し元の案件データで初期値を上書きする（未指定ならサンプルデータのまま）
    initialData?: Partial<PlannerInputState>
}) => {
    const today = new Date().toISOString().slice(0, 10);

    const [form, setForm] = useState<PlannerInputState>({
        propName: '鹿児島市上福元町5866番6 土地建物', propZip: '', propAddr: '鹿児島市上福元町5866番6',
        seller: '田原 嘉昭', sellerZip: '', sellerAddr: '',
        buyer: '中元 昭司', contractDate: today, delivery: today,
        place: '鹿児島銀行 谷山支店', placeAddr: '鹿児島市谷山中央二丁目4番3号', startTime: '10:00',
        price: 32800000, deposit: 1000000, interim: 0,
        taxBase: '01-01', taxDay: 'buyer', t1: 14487, t2: 6209, t3: 92740, t4: 19873,
        mode: 'both', lowPrice: '0', sDisc: 0, sPaid: 0, bDisc: 0, bPaid: 0,
        loanPrin: 0, loanInt: 0, loanFee: 0, sJudi: 27900, sStamp: 0,
        rel: 'other_bank', ch: 'counter', tfCount: 1,
        bJudi: 237600, bArr: 550000, bGuar: 266600, bIns: 60600, bStamp: 0, bLoan: 25000000,
        billTo: 'both', invNoS: 'KHF-2026-0087-S', invNoB: 'KHF-2026-0087-B', invDate: today, invDue: today, invReg: 'T', payAcct: 'brokerage',
        rcOn: '1', rcTarget: 'both', rcCustom: 0, rcSign: 'blank', rcStamp: 'free',
        sellerTaxable: '0', sellerInvReg: '', sellerVat: 0,
        sBank: '', sBranch: '', sAcctType: '普通', sAcctNo: '', sAcctName: '', sAcctKana: ''
    });

    const [stampAuto, setStampAuto] = useState({ s: true, b: true });
    const [extras, setExtras] = useState<ExtraState>({ s: [], b: [] });

    const [previewOpen, setPreviewOpen] = useState(false);

    // 💡 追加: モーダルを開くたびに呼び出し元の案件データを反映する（source.html の SETL.open(dealId) 相当）
    useEffect(() => {
        if (plannerShow && initialData) {
            setForm(prev => ({ ...prev, ...initialData }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plannerShow]);

    const handleChange = (key: keyof PlannerInputState, val: any) => {
        setForm(prev => ({ ...prev, [key]: val }));
    };

    const addExtraRow = (side: 's' | 'b') => {
        setExtras(prev => ({
            ...prev,
            [side]: [...prev[side], { id: `ex_${Date.now()}_${Math.random()}`, label: '', amount: 0, dir: 'out' }]
        }));
    };

    const updateExtraRow = (side: 's' | 'b', id: string, key: keyof ExtraRow, val: any) => {
        setExtras(prev => ({
            ...prev,
            [side]: prev[side].map(r => r.id === id ? { ...r, [key]: val } : r)
        }));
    };

    const deleteExtraRow = (side: 's' | 'b', id: string) => {
        setExtras(prev => ({
            ...prev,
            [side]: prev[side].filter(r => r.id !== id)
        }));
    };

    // ==========================================
    // 💡 複雑な計算ロジック（useMemoで一括最適化）
    // ==========================================
    const calc = useMemo(() => {
        const balance = form.price - form.deposit - form.interim;

        // 印紙代
        const autoStamp = contractStamp(form.price);
        const sStampAmt = stampAuto.s ? autoStamp : form.sStamp;
        const bStampAmt = stampAuto.b ? autoStamp : form.bStamp;

        // 固都税
        const annualTax = form.t1 + form.t2 + form.t3 + form.t4;
        const pr = proration(annualTax, form.delivery, form.taxBase, form.taxDay);

        // 仲介手数料
        const baseFee = brokerageBase(form.price, form.lowPrice === '1');
        const feeS = feeFor(baseFee.net, form.mode === 'both' || form.mode === 'seller', form.sDisc, form.sPaid);
        const feeB = feeFor(baseFee.net, form.mode === 'both' || form.mode === 'buyer', form.bDisc, form.bPaid);

        // 振込手数料・ローン
        const loanTotal = form.loanPrin + form.loanInt + form.loanFee;
        const tfUnit = transferFee(form.rel, form.ch, balance);
        const tfTotal = tfUnit * form.tfCount;

        // 追加費目
        const sExIn = extras.s.filter(r => r.dir === 'in').reduce((sum, r) => sum + r.amount, 0);
        const sExOut = extras.s.filter(r => r.dir === 'out').reduce((sum, r) => sum + r.amount, 0);
        const bExIn = extras.b.filter(r => r.dir === 'in').reduce((sum, r) => sum + r.amount, 0);
        const bExOut = extras.b.filter(r => r.dir === 'out').reduce((sum, r) => sum + r.amount, 0);

        // 売主収支
        const sIncome = balance + form.deposit + form.interim + pr.buyer + sExIn;
        const sExpense = feeS.balance + form.sJudi + loanTotal + tfTotal + sStampAmt + sExOut;
        const sNetTotal = sIncome - sExpense; // 最終手取額
        const sDayTotal = sNetTotal - form.deposit - form.interim; // 決済日当日の受取額

        // 買主収支
        const bCost = form.bJudi + form.bArr + form.bGuar + form.bIns + bStampAmt + bExOut - bExIn;
        const bNeed = balance + pr.buyer + feeB.balance + bCost;
        const bOwn = bNeed - form.bLoan;

        // 領収証金額
        const rcT = form.rcTarget;
        const rcAmt = rcT === 'both' ? balance + pr.buyer : rcT === 'balance' ? balance : rcT === 'tax' ? pr.buyer : form.rcCustom;
        const rcStampAmt = form.rcStamp === 'taxed' ? stampDuty(rcAmt) : 0;

        // インボイスバリデーション
        const sReg = form.sellerInvReg.trim();
        const sTaxable = form.sellerTaxable === '1';
        const isRegOk = /^[TＴ][0-9]{13}$/.test(sReg);

        let invAlerts: { type: 'warn' | 'info', msg: string }[] = [];
        if (sTaxable && !sReg) invAlerts.push({ type: 'warn', msg: '適格請求書発行事業者を選択していますが、登録番号が未入力です。買主が仕入税額控除を受けられません。' });
        if (sReg && !isRegOk) invAlerts.push({ type: 'warn', msg: '登録番号の形式が正しくありません。「T」＋数字13桁で入力してください。' });
        if (sTaxable && form.rcStamp === 'free') invAlerts.push({ type: 'warn', msg: '売主が事業者の場合、領収証は「売上代金に係る金銭の受取書」として課税文書に該当します。印紙税の扱いを「課税」に切り替えてください。' });
        if (sTaxable && isRegOk && form.sellerVat === 0) invAlerts.push({ type: 'info', msg: '適格請求書として交付する場合は、税率ごとに区分した消費税額等（建物分）の記載が必要です。上の欄に消費税額を入力してください。' });
        if (!sTaxable && sReg) invAlerts.push({ type: 'info', msg: '売主区分が「個人（免税事業者）」のままです。登録番号を印字する場合は区分を切り替えてください。' });

        return {
            balance, autoStamp, sStampAmt, bStampAmt,
            annualTax, pr, baseFee, feeS, feeB,
            loanTotal, tfUnit, tfTotal,
            sIncome, sExpense, sNetTotal, sDayTotal,
            bCost, bNeed, bOwn,
            rcAmt, rcStampAmt,
            invAlerts
        };
    }, [form, extras, stampAuto]);

    const FRow = ({ label, hint, children }: { label: React.ReactNode, hint?: string, children: React.ReactNode }) => (
        <div style={s.fRow}>
            <label style={s.fLabel}>{label} {hint && <small style={s.fHint}>{hint}</small>}</label>
            {children}
        </div>
    );

    // ==========================================
    // 💡 帳票用サブコンポーネント: 請求書 (Invoice)
    // ==========================================
    const InvoicePage = ({ isSeller }: { isSeller: boolean }) => {
        const fee = isSeller ? calc.feeS : calc.feeB;
        if (fee.total === 0) return null; // 対象外なら表示しない

        const name = isSeller ? form.seller : form.buyer;
        const no = isSeller ? form.invNoS : form.invNoB;
        const pa = PAY_ACCOUNTS[form.payAcct as keyof typeof PAY_ACCOUNTS] || PAY_ACCOUNTS.brokerage;

        return (
            <div className="page" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 16mm', backgroundColor: '#fff', color: '#000', margin: '0 auto 20px', boxShadow: '0 3px 14px rgba(0,0,0,.35)', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
                <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
                    <div style={{ fontSize: '15pt', letterSpacing: '0.5em', borderBottom: '1.5pt solid #000', display: 'inline-block', padding: '0 4mm 1mm' }}>御請求書</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '9.5pt', marginBottom: '4mm' }}>{formatDate(form.invDate)}  No. {no}</div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8mm', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '13pt', borderBottom: '1pt solid #999', padding: '0 14mm 1mm 2mm' }}>{name} 様</div>
                    <div style={{ fontSize: '9.5pt', lineHeight: 1.45 }}>
                        株式会社国分ハウジング不動産<br />
                        住所：鹿児島市谷山中央一丁目12番6号<br />
                        電話番号：099-204-0705<br />
                        インボイス登録番号：{form.invReg}<br />
                        <span style={{ display: 'inline-block', marginTop: '2mm' }}>担当：     ㊞</span>
                    </div>
                </div>

                <div style={{ fontSize: '10pt', marginBottom: '6mm' }}>下記物件の売買契約に基づく仲介手数料として、以下の通りご請求申し上げます。</div>
                <div style={{ marginBottom: '8mm' }}>
                    <span style={{ fontSize: '11pt' }}>ご請求金額：</span>
                    <span style={{ borderBottom: '2pt solid #000', fontSize: '18pt', fontWeight: 'bold', padding: '0 6mm 1mm', display: 'inline-block', marginLeft: '4mm' }}>{formatYen(fee.balance)}</span>
                </div>

                <div style={{ fontSize: '10pt', marginBottom: '2mm' }}>【内訳】</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: '6mm' }}>
                    <thead>
                        <tr>
                            <th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '0.9mm 2.5mm', fontWeight: 'normal', width: '52%' }}>摘要</th>
                            <th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '0.9mm 2.5mm', fontWeight: 'normal' }}>税抜金額</th>
                            <th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '0.9mm 2.5mm', fontWeight: 'normal' }}>消費税10%</th>
                            <th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '0.9mm 2.5mm', fontWeight: 'normal' }}>税込金額</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm' }}>
                                仲介手数料（{form.propName}）<br />
                                <span style={{ fontSize: '8pt', color: '#555' }}>{calc.baseFee.formula}</span>
                            </td>
                            <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm', textAlign: 'right' }}>{formatYen(fee.net)}</td>
                            <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm', textAlign: 'right' }}>{formatYen(fee.tax)}</td>
                            <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm', textAlign: 'right' }}>{formatYen(fee.total)}</td>
                        </tr>
                        {fee.paidT > 0 && (
                            <tr>
                                <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm' }}>契約時 受領済</td>
                                <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm' }}></td>
                                <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm' }}></td>
                                <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm', textAlign: 'right' }}>▲ {formatYen(fee.paidT).replace('¥', '¥ ')}</td>
                            </tr>
                        )}
                        <tr>
                            <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm', textAlign: 'center', background: '#f7f7f7', fontWeight: 'bold' }}>今回ご請求額</td>
                            <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm', textAlign: 'right', background: '#f7f7f7', fontWeight: 'bold' }}>{formatYen(fee.net)}</td>
                            <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm', textAlign: 'right', background: '#f7f7f7', fontWeight: 'bold' }}>{formatYen(fee.tax)}</td>
                            <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm', textAlign: 'right', background: '#f7f7f7', fontWeight: 'bold' }}>{formatYen(fee.balance)}</td>
                        </tr>
                    </tbody>
                </table>

                <div style={{ fontSize: '10pt', marginBottom: '2mm' }}>【物件明細・売買契約内容】</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: '3.5mm' }}>
                    <tbody>
                        <tr><th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '1mm 2.5mm', fontWeight: 'normal', width: '28mm' }}>物件名</th><td style={{ border: '0.5pt solid #000', padding: '1mm 2.5mm' }}>{form.propName}</td></tr>
                        <tr><th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '1mm 2.5mm', fontWeight: 'normal' }}>所在地</th><td style={{ border: '0.5pt solid #000', padding: '1mm 2.5mm' }}>{form.propAddr}</td></tr>
                        <tr><th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '1mm 2.5mm', fontWeight: 'normal' }}>売買代金総額</th><td style={{ border: '0.5pt solid #000', padding: '1mm 2.5mm' }}>{formatYen(form.price)}</td></tr>
                        <tr><th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '1mm 2.5mm', fontWeight: 'normal' }}>契約締結日</th><td style={{ border: '0.5pt solid #000', padding: '1mm 2.5mm' }}>{formatDate(form.contractDate)}</td></tr>
                        <tr><th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '1mm 2.5mm', fontWeight: 'normal' }}>取引態様</th><td style={{ border: '0.5pt solid #000', padding: '1mm 2.5mm' }}>{form.mode === 'both' ? '売主・買主 双方より受領' : '一方より受領'}</td></tr>
                    </tbody>
                </table>

                <div style={{ fontSize: '10pt', marginBottom: '2mm' }}>【お支払情報・振込先口座】</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: '3mm' }}>
                    <tbody>
                        <tr><th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '1mm 2.5mm', fontWeight: 'normal', width: '28mm' }}>お振込期日</th><td style={{ border: '0.5pt solid #000', padding: '1mm 2.5mm' }}>{formatDate(form.invDue)}</td></tr>
                        <tr><th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '1mm 2.5mm', fontWeight: 'normal' }}>金融機関</th><td style={{ border: '0.5pt solid #000', padding: '1mm 2.5mm' }}>{pa.bank} {pa.branch}</td></tr>
                        <tr><th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '1mm 2.5mm', fontWeight: 'normal' }}>口座種別・番号</th><td style={{ border: '0.5pt solid #000', padding: '1mm 2.5mm' }}>{pa.type} {pa.no}</td></tr>
                        <tr><th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '1mm 2.5mm', fontWeight: 'normal' }}>口座名義</th><td style={{ border: '0.5pt solid #000', padding: '1mm 2.5mm' }}>{pa.holder} {pa.kana}</td></tr>
                    </tbody>
                </table>
                <div style={{ fontSize: '9pt' }}>※ お振込手数料は {isSeller ? '売主' : '買主'}様のご負担にてお願いいたします。</div>
            </div>
        );
    };

    // ==========================================
    // 💡 帳票用サブコンポーネント: 領収証 (Receipt)
    // ==========================================
    const ReceiptPage = () => {
        if (form.rcOn === '0' || calc.rcAmt <= 0) return null;

        const t = form.rcTarget;
        const but = t === 'both' ? '上記物件の売買残代金及び固定資産税等精算金として' : t === 'balance' ? '上記物件の売買残代金として' : t === 'tax' ? '上記物件の固定資産税・都市計画税精算金として' : '上記物件の売買に関する金員として';
        
        const items = t === 'both' ? [['売買残代金', calc.balance], ['固定資産税等 精算金', calc.pr.buyer]] 
                    : t === 'balance' ? [['売買残代金', calc.balance]] 
                    : t === 'tax' ? [['固定資産税等 精算金', calc.pr.buyer]] 
                    : [['領収金額', calc.rcAmt]];

        const isTaxable = form.sellerTaxable === '1';
        const hasReg = form.sellerInvReg.trim() !== '';

        return (
            <div className="page" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 16mm', backgroundColor: '#fff', color: '#000', margin: '0 auto 20px', boxShadow: '0 3px 14px rgba(0,0,0,.35)', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
                <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
                    <div style={{ fontSize: '15pt', letterSpacing: '0.5em', borderBottom: '1.5pt solid #000', display: 'inline-block', padding: '0 4mm 1mm' }}>領収証</div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5mm' }}>
                    <div style={{ fontSize: '14pt', borderBottom: '1pt solid #999', padding: '0 14mm 1mm 2mm' }}>{form.buyer} 様</div>
                    <div style={{ fontSize: '9.5pt' }}>{formatDate(form.delivery)}</div>
                </div>

                <div style={{ border: '1.5pt solid #000', padding: '4mm 8mm', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4mm 0' }}>
                    <span style={{ fontSize: '13pt' }}>金</span>
                    <span style={{ fontSize: '20pt', fontWeight: 'bold' }}>{formatYen(calc.rcAmt)} －</span>
                </div>

                <div style={{ fontSize: '11pt', marginBottom: '6mm', lineHeight: 1.9 }}>
                    但し {but}<br />
                    上記正に領収いたしました。
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: '5mm' }}>
                    <thead>
                        <tr>
                            <th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '0.9mm 2.5mm', fontWeight: 'normal', width: '64%' }}>内訳</th>
                            <th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '0.9mm 2.5mm', fontWeight: 'normal' }}>金額</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(([l, a], i) => (
                            <tr key={i}>
                                <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm' }}>{l}</td>
                                <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm', textAlign: 'right' }}>{formatYen(a as number)}</td>
                            </tr>
                        ))}
                        <tr>
                            <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm', textAlign: 'center', background: '#f7f7f7', fontWeight: 'bold' }}>合 計</td>
                            <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm', textAlign: 'right', background: '#f7f7f7', fontWeight: 'bold' }}>{formatYen(calc.rcAmt)}</td>
                        </tr>
                        {isTaxable && form.sellerVat > 0 && (
                            <tr>
                                <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm' }}>うち消費税額等（10%対象・建物分）</td>
                                <td style={{ border: '0.5pt solid #000', padding: '0.9mm 2.5mm', textAlign: 'right' }}>{formatYen(form.sellerVat)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: '3.5mm' }}>
                    <tbody>
                        <tr><th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '1mm 2.5mm', fontWeight: 'normal', width: '28mm' }}>物件名</th><td style={{ border: '0.5pt solid #000', padding: '1mm 2.5mm' }}>{form.propName}</td></tr>
                        <tr><th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '1mm 2.5mm', fontWeight: 'normal' }}>所在地</th><td style={{ border: '0.5pt solid #000', padding: '1mm 2.5mm' }}>{form.propAddr}</td></tr>
                        <tr><th style={{ border: '0.5pt solid #000', background: '#f2f2f2', padding: '1mm 2.5mm', fontWeight: 'normal' }}>受領場所</th><td style={{ border: '0.5pt solid #000', padding: '1mm 2.5mm' }}>{form.place}</td></tr>
                    </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, marginRight: '6mm', marginTop: '5mm', border: '0.5pt solid #000', padding: '4mm 6mm' }}>
                        <div style={{ fontSize: '9pt', marginBottom: '3mm', color: '#333' }}>上記金額を領収した者（売主） ※ご署名・ご捺印をお願いいたします</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3mm', marginBottom: '4mm' }}>
                            <b style={{ fontSize: '9.5pt', fontWeight: 'normal', width: '14mm', flex: 'none' }}>住 所</b>
                            <div style={{ flex: 1, borderBottom: '0.5pt solid #000', height: '7mm' }}>{form.rcSign === 'print' ? <span style={{ fontSize: '10.5pt' }}>{form.sellerAddr}</span> : ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3mm' }}>
                            <b style={{ fontSize: '9.5pt', fontWeight: 'normal', width: '14mm', flex: 'none' }}>氏 名</b>
                            <div style={{ flex: 1, borderBottom: '0.5pt solid #000', height: '7mm' }}>{form.rcSign === 'print' ? <span style={{ fontSize: '11.5pt' }}>{form.seller}</span> : ''}</div>
                            <div style={{ border: '0.5pt solid #000', width: '15mm', height: '15mm', flex: 'none', textAlign: 'center', fontSize: '7.5pt', color: '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>印</div>
                        </div>
                        {isTaxable && hasReg && (
                            <div style={{ fontSize: '9.5pt', borderTop: '0.5pt solid #999', paddingTop: '2mm', marginTop: '3mm' }}>適格請求書発行事業者 登録番号 {form.sellerInvReg}</div>
                        )}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: '5mm' }}>
                        <div style={{ border: '0.5pt solid #000', width: '30mm', height: '30mm', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: '8pt', color: '#666', lineHeight: 1.5 }}>
                            {calc.rcStampAmt > 0 ? <>収入印紙<br/>{formatYen(calc.rcStampAmt)}<br/><span style={{ fontSize: '7pt' }}>要・消印</span></> : <>収入印紙<br/>不要</>}
                        </div>
                        <div style={{ fontSize: '7.5pt', color: '#666', marginTop: '1mm' }}>印紙貼付欄</div>
                    </div>
                </div>

                <div style={{ fontSize: '8.5pt', marginTop: '4mm', lineHeight: 1.7, color: '#333' }}>
                    {calc.rcStampAmt > 0 
                        ? `※ 印紙税法 第17号文書（売上代金に係る金銭の受取書）に該当し、収入印紙 ${formatYen(calc.rcStampAmt)} の貼付と消印が必要です。` 
                        : '※ 売主が営業を行わない個人であるため、印紙税法上の「営業に関しない受取書」に該当し、収入印紙は不要です。'
                    }<br />
                    {isTaxable && hasReg ? `※ 本領収証は消費税法上の適格請求書（インボイス）として交付するものです。登録番号は上記のとおりです。\n` : ''}
                    ※ 本領収証は売主から買主へ交付されるものです。当社は仲介者として作成を代行しています。
                </div>
            </div>
        );
    };

    return (
        <>
            <Modal show={plannerShow} onHide={() => setPlannerShow(false)} fullscreen>
                <Modal.Header closeButton></Modal.Header>
                <div style={s.wrap}>
                    <div style={s.topBar}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>🏢</span>
                            <span style={{ fontSize: '12px', color: '#79818b' }}>決済精算書ジェネレーター <b style={{ fontSize: '14px', color: '#16191d' }}>不動産企画課</b></span>
                        </div>
                        <div style={{ flex: 1 }}></div>
                        <button style={{ padding: '6px 12px', backgroundColor: '#1c6b4a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} onClick={() => setPreviewOpen(true)}>
                            🖨️ 印刷プレビューを開く
                        </button>
                    </div>

                    <div style={s.grid}>
                        {/* ① 取引情報 */}
                        <div style={s.card}>
                            <h2 style={s.cardTitle}><span style={s.noBadge}>1</span>取引情報</h2>
                            <FRow label="物件名"><input type="text" style={{ ...s.input, ...s.inputWide }} value={form.propName} onChange={e => handleChange('propName', e.target.value)} /></FRow>
                            <FRow label="所在地"><input type="text" style={{ ...s.input, ...s.inputWide }} value={form.propAddr} onChange={e => handleChange('propAddr', e.target.value)} /></FRow>
                            <FRow label="売主"><input type="text" style={{ ...s.input, ...s.inputWide }} value={form.seller} onChange={e => handleChange('seller', e.target.value)} /></FRow>
                            <FRow label="買主"><input type="text" style={{ ...s.input, ...s.inputWide }} value={form.buyer} onChange={e => handleChange('buyer', e.target.value)} /></FRow>
                            <FRow label="契約締結日"><input type="date" style={s.input} value={form.contractDate} onChange={e => handleChange('contractDate', e.target.value)} /></FRow>
                            <FRow label="決済（引渡）日" hint="変更するとお振込期日等も連動"><input type="date" style={s.input} value={form.delivery} onChange={e => handleChange('delivery', e.target.value)} /></FRow>
                            <FRow label="決済場所" hint="金融機関名・支店名"><input type="text" style={{ ...s.input, ...s.inputWide }} value={form.place} onChange={e => handleChange('place', e.target.value)} /></FRow>
                            <FRow label="開始時間"><input type="time" style={s.input} value={form.startTime} onChange={e => handleChange('startTime', e.target.value)} /></FRow>

                            <h3 style={s.subTitle}>売買代金</h3>
                            <FRow label="売買代金 総額"><input type="number" style={s.input} value={form.price} onChange={e => handleChange('price', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                            <FRow label="手付金（受領済）"><input type="number" style={s.input} value={form.deposit} onChange={e => handleChange('deposit', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                            <FRow label="中間金（受領済）"><input type="number" style={s.input} value={form.interim} onChange={e => handleChange('interim', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>

                            <div style={s.totRow}>
                                <span style={s.totLabel}>残代金</span>
                                <span style={{ ...s.totVal, color: '#1b3a6b' }}>{formatYen(calc.balance)}</span>
                            </div>
                        </div>

                        {/* ② 固都税精算・仲介手数料 */}
                        <div style={s.card}>
                            <h2 style={s.cardTitle}><span style={s.noBadge}>2</span>固都税精算・仲介手数料</h2>
                            <FRow label="起算日">
                                <select style={s.inputSelect} value={form.taxBase} onChange={e => handleChange('taxBase', e.target.value)}>
                                    <option value="01-01">1月1日（関東・当社基準）</option>
                                    <option value="04-01">4月1日（関西慣行）</option>
                                </select>
                            </FRow>
                            <FRow label="決済日当日の負担">
                                <select style={s.inputSelect} value={form.taxDay} onChange={e => handleChange('taxDay', e.target.value)}>
                                    <option value="buyer">買主</option>
                                    <option value="seller">売主</option>
                                </select>
                            </FRow>
                            <FRow label="土地 固定資産税 年額"><input type="number" style={s.input} value={form.t1} onChange={e => handleChange('t1', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                            <FRow label="土地 都市計画税 年額"><input type="number" style={s.input} value={form.t2} onChange={e => handleChange('t2', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                            <FRow label="建物 固定資産税 年額"><input type="number" style={s.input} value={form.t3} onChange={e => handleChange('t3', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                            <FRow label="建物 都市計画税 年額"><input type="number" style={s.input} value={form.t4} onChange={e => handleChange('t4', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>

                            <div style={s.totRow}><span style={s.totLabel}>年税額 合計</span><span style={s.totVal}>{formatYen(calc.annualTax)}</span></div>
                            <div style={s.totRow}><span style={s.totLabel}>総日数 ／ 売主 ／ 買主</span><span style={{ ...s.totVal, fontSize: '13px' }}>365日 ／ {calc.pr.sellerDays}日 ／ {calc.pr.buyerDays}日</span></div>
                            <div style={{ ...s.totRow, borderBottom: 'none' }}>
                                <span style={{ ...s.totLabel, fontWeight: 'bold', color: '#16191d' }}>買主 → 売主 精算金</span>
                                <span style={{ ...s.totVal, color: '#1c6b4a' }}>{formatYen(calc.pr.buyer)}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#9aa1a9', marginTop: '7px' }}>精算期間 {calc.pr.period}（分母365日固定）</div>

                            <h3 style={s.subTitle}>仲介手数料（取引態様）</h3>
                            <FRow label="取引態様">
                                <select style={s.inputSelect} value={form.mode} onChange={e => handleChange('mode', e.target.value)}>
                                    <option value="both">両手（双方から受領）</option>
                                    <option value="seller">片手（売主からのみ）</option>
                                    <option value="buyer">片手（買主からのみ）</option>
                                </select>
                            </FRow>
                            <FRow label="低廉な空家等の特例" hint="800万円以下・上限30万円＋税">
                                <select style={s.inputSelect} value={form.lowPrice} onChange={e => handleChange('lowPrice', e.target.value)}>
                                    <option value="0">適用しない</option>
                                    <option value="1">適用する</option>
                                </select>
                            </FRow>

                            <div style={s.totRow}>
                                <span style={s.totLabel}>基準額 税抜 <span style={{ fontSize: '11px', color: '#9aa1a9' }}>{calc.baseFee.formula}</span></span>
                                <span style={s.totVal}>{formatYen(calc.baseFee.net)}</span>
                            </div>

                            <FRow label="売主分 値引き（税抜）"><input type="number" style={s.input} value={form.sDisc} onChange={e => handleChange('sDisc', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                            <div style={s.totRow}><span style={s.totLabel}>売主へ請求（税込・決済時）</span><span style={s.totVal}>{formatYen(calc.feeS.balance)}</span></div>

                            <FRow label="買主分 値引き（税抜）"><input type="number" style={s.input} value={form.bDisc} onChange={e => handleChange('bDisc', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                            <div style={{ ...s.totRow, borderBottom: 'none' }}><span style={s.totLabel}>買主へ請求（税込・決済時）</span><span style={s.totVal}>{formatYen(calc.feeB.balance)}</span></div>
                        </div>

                        {/* ③ 売主 精算 */}
                        <div style={s.card}>
                            <h2 style={s.cardTitle}><span style={s.noBadge}>3</span>売主 精算 — 手残り額</h2>
                            <h3 style={s.subTitle}>住宅ローン残債（抵当権抹消）</h3>
                            <FRow label="残元金" hint="金融機関の完済見込額"><input type="number" style={s.input} value={form.loanPrin} onChange={e => handleChange('loanPrin', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                            <FRow label="経過利息"><input type="number" style={s.input} value={form.loanInt} onChange={e => handleChange('loanInt', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                            <FRow label="繰上返済手数料"><input type="number" style={s.input} value={form.loanFee} onChange={e => handleChange('loanFee', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                            <div style={s.totRow}><span style={s.totLabel}>一括返済額 合計</span><span style={s.totVal}>{formatYen(calc.loanTotal)}</span></div>

                            <h3 style={s.subTitle}>諸費用</h3>
                            <FRow label="司法書士登記費用"><input type="number" style={s.input} value={form.sJudi} onChange={e => handleChange('sJudi', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                            <FRow
                                label={
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        売買契約書貼付印紙代
                                        {!stampAuto.s && <button style={{ fontSize: '10px', padding: '2px 6px', border: '1px solid #e2e6ea', background: '#fff', borderRadius: '4px' }} onClick={() => setStampAuto(p => ({ ...p, s: true }))}>自動</button>}
                                    </div>
                                }
                                hint={stampAuto.s ? `自動計算（売買代金総額から算定）` : `手入力中（自動計算値 ${formatYen(calc.autoStamp)}）`}
                            >
                                <input type="number" style={s.input} value={calc.sStampAmt} onChange={e => { setStampAuto(p => ({ ...p, s: false })); handleChange('sStamp', Number(e.target.value)); }} /><span style={s.unit}>円</span>
                            </FRow>

                            <h3 style={s.subTitle}>振込手数料</h3>
                            <FRow label="送金元 → 送金先">
                                <select style={s.inputSelect} value={form.rel} onChange={e => handleChange('rel', e.target.value)}>
                                    <option value="same_branch">同一銀行・同一支店</option>
                                    <option value="same_bank">同一銀行・他支店</option>
                                    <option value="other_bank">他行あて</option>
                                </select>
                            </FRow>
                            <FRow label="送金方法">
                                <select style={s.inputSelect} value={form.ch} onChange={e => handleChange('ch', e.target.value)}>
                                    <option value="counter">窓口</option>
                                    <option value="atm">ATM</option>
                                    <option value="online">ネットバンキング</option>
                                </select>
                            </FRow>
                            <FRow label="送金件数"><input type="number" style={s.input} value={form.tfCount} onChange={e => handleChange('tfCount', Number(e.target.value))} /><span style={s.unit}>件</span></FRow>
                            <div style={s.totRow}><span style={s.totLabel}>振込手数料 <span style={{ fontSize: '11px', color: '#9aa1a9' }}>{formatYen(calc.tfUnit)} × {form.tfCount}件</span></span><span style={s.totVal}>{formatYen(calc.tfTotal)}</span></div>

                            <h3 style={s.subTitle}>
                                その他の費目
                                <button style={{ fontSize: '11px', padding: '2px 8px', border: '1px solid #e2e6ea', background: '#fff', borderRadius: '4px', cursor: 'pointer' }} onClick={() => addExtraRow('s')}>＋ 行を追加</button>
                            </h3>
                            <div>
                                {extras.s.length === 0 ? (
                                    <div style={s.emptyExtra}>行がありません。「＋ 行を追加」で自由に追加できます。</div>
                                ) : (
                                    extras.s.map((row) => (
                                        <div key={row.id} style={s.xrow}>
                                            <input type="text" style={{ ...s.input, ...s.inputWide }} placeholder="項目名" value={row.label} onChange={e => updateExtraRow('s', row.id, 'label', e.target.value)} />
                                            <input type="number" style={{ ...s.input, width: '110px' }} value={row.amount} onChange={e => updateExtraRow('s', row.id, 'amount', Number(e.target.value))} />
                                            <select style={{ ...s.inputSelect, width: '62px' }} value={row.dir} onChange={e => updateExtraRow('s', row.id, 'dir', e.target.value)}>
                                                <option value="out">支出</option>
                                                <option value="in">収入</option>
                                            </select>
                                            <button style={s.btnDel} onClick={() => deleteExtraRow('s', row.id)}>✕</button>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div style={{ ...s.totRow, marginTop: '12px' }}><span style={s.totLabel}>収入 合計</span><span style={s.totVal}>{formatYen(calc.sIncome)}</span></div>
                            <div style={s.totRow}><span style={s.totLabel}>支出 合計</span><span style={s.totVal}>{formatYen(calc.sExpense)}</span></div>

                            <div style={{ ...s.totBig, ...(calc.sNetTotal < 0 ? { backgroundColor: '#fdf0f0' } : {}) }}>
                                <span style={{ ...s.totLabel, color: calc.sNetTotal < 0 ? '#b4232a' : '#1b3a6b', fontWeight: 'bold' }}>最終手取額（手付金含む）</span>
                                <span style={{ ...s.totVal, color: calc.sNetTotal < 0 ? '#b4232a' : '#1b3a6b', fontSize: '21px' }}>{formatYen(calc.sNetTotal)}</span>
                            </div>

                            {calc.sNetTotal < 0 && (
                                <div style={s.alertBox}>⚠️ 手取額がマイナスです。オーバーローンのため決済時に不足額の持出しが必要です。</div>
                            )}
                            {calc.loanTotal > calc.sIncome && (
                                <div style={s.alertBox}>⚠️ ローン一括返済額が収入合計を上回っています。任意売却・買換え特例の検討が必要です。</div>
                            )}
                        </div>

                        {/* ④ 買主 精算 */}
                        <div style={{ ...s.card, gridColumn: 'span 2' }}>
                            <h2 style={s.cardTitle}><span style={s.noBadge}>4</span>買主 精算 — 必要資金と自己資金</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
                                <div>
                                    <h3 style={s.subTitle}>諸費用</h3>
                                    <FRow label="司法書士登記費用" hint="移転・設定"><input type="number" style={s.input} value={form.bJudi} onChange={e => handleChange('bJudi', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                                    <FRow label="融資事務手数料"><input type="number" style={s.input} value={form.bArr} onChange={e => handleChange('bArr', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                                    <FRow label="ローン保証料"><input type="number" style={s.input} value={form.bGuar} onChange={e => handleChange('bGuar', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                                    <FRow label="火災・地震保険料"><input type="number" style={s.input} value={form.bIns} onChange={e => handleChange('bIns', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                                    <FRow
                                        label={
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                売買契約書貼付印紙代
                                                {!stampAuto.b && <button style={{ fontSize: '10px', padding: '2px 6px', border: '1px solid #e2e6ea', background: '#fff', borderRadius: '4px' }} onClick={() => setStampAuto(p => ({ ...p, b: true }))}>自動</button>}
                                            </div>
                                        }
                                        hint={stampAuto.b ? `自動計算（売買代金総額から算定）` : `手入力中（自動計算値 ${formatYen(calc.autoStamp)}）`}
                                    >
                                        <input type="number" style={s.input} value={calc.bStampAmt} onChange={e => { setStampAuto(p => ({ ...p, b: false })); handleChange('bStamp', Number(e.target.value)); }} /><span style={s.unit}>円</span>
                                    </FRow>
                                    <FRow label="住宅ローン借入額"><input type="number" style={s.input} value={form.bLoan} onChange={e => handleChange('bLoan', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>

                                    <h3 style={s.subTitle}>
                                        その他の費目
                                        <button style={{ fontSize: '11px', padding: '2px 8px', border: '1px solid #e2e6ea', background: '#fff', borderRadius: '4px', cursor: 'pointer' }} onClick={() => addExtraRow('b')}>＋ 行を追加</button>
                                    </h3>
                                    <div>
                                        {extras.b.length === 0 ? (
                                            <div style={s.emptyExtra}>行がありません。「＋ 行を追加」で自由に追加できます。</div>
                                        ) : (
                                            extras.b.map((row) => (
                                                <div key={row.id} style={s.xrow}>
                                                    <input type="text" style={{ ...s.input, ...s.inputWide }} placeholder="項目名" value={row.label} onChange={e => updateExtraRow('b', row.id, 'label', e.target.value)} />
                                                    <input type="number" style={{ ...s.input, width: '110px' }} value={row.amount} onChange={e => updateExtraRow('b', row.id, 'amount', Number(e.target.value))} />
                                                    <select style={{ ...s.inputSelect, width: '62px' }} value={row.dir} onChange={e => updateExtraRow('b', row.id, 'dir', e.target.value)}>
                                                        <option value="out">支出</option>
                                                        <option value="in">収入</option>
                                                    </select>
                                                    <button style={s.btnDel} onClick={() => deleteExtraRow('b', row.id)}>✕</button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <h3 style={s.subTitle}>資金収支</h3>
                                    <div style={s.totRow}><span style={s.totLabel}>残代金</span><span style={s.totVal}>{formatYen(calc.balance)}</span></div>
                                    <div style={s.totRow}><span style={s.totLabel}>固都税精算金</span><span style={s.totVal}>{formatYen(calc.pr.buyer)}</span></div>
                                    <div style={s.totRow}><span style={s.totLabel}>仲介手数料（税込）</span><span style={s.totVal}>{formatYen(calc.feeB.balance)}</span></div>
                                    <div style={s.totRow}><span style={s.totLabel}>その他 諸費用</span><span style={s.totVal}>{formatYen(calc.bCost)}</span></div>
                                    <div style={s.totRow}><span style={s.totLabel}>必要資金 合計</span><span style={s.totVal}>{formatYen(calc.bNeed)}</span></div>
                                    <div style={s.totRow}><span style={s.totLabel}>住宅ローン借入</span><span style={{ ...s.totVal, color: '#b4232a' }}>- {formatYen(form.bLoan)}</span></div>

                                    <div style={{ ...s.totBig, ...(calc.bOwn < 0 ? { backgroundColor: '#fdf0f0' } : {}) }}>
                                        <span style={{ ...s.totLabel, color: calc.bOwn < 0 ? '#b4232a' : '#1b3a6b', fontWeight: 'bold' }}>決済時に必要な自己資金</span>
                                        <span style={{ ...s.totVal, color: calc.bOwn < 0 ? '#b4232a' : '#1b3a6b', fontSize: '21px' }}>{formatYen(calc.bOwn)}</span>
                                    </div>
                                    {calc.bOwn < 0 && (
                                        <div style={s.alertBox}>⚠️ 融希額が必要資金を上回っています。減額または余剰金の取扱いをご確認ください。</div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* ⑤ 請求書 */}
                        <div style={s.card}>
                            <h2 style={s.cardTitle}><span style={s.noBadge}>5</span>仲介手数料 請求書</h2>
                            <FRow label="発行先" hint="取引態様に応じて自動で候補が変わります">
                                <select style={s.inputSelect} value={form.billTo} onChange={e => handleChange('billTo', e.target.value)}>
                                    <option value="both">売主・買主 両方に発行</option>
                                    <option value="seller">売主のみ</option>
                                    <option value="buyer">買主のみ</option>
                                </select>
                            </FRow>
                            <FRow label="請求書番号（売主宛）"><input type="text" style={{...s.input, ...s.inputWide}} value={form.invNoS} onChange={e => handleChange('invNoS', e.target.value)} /></FRow>
                            <FRow label="請求書番号（買主宛）"><input type="text" style={{...s.input, ...s.inputWide}} value={form.invNoB} onChange={e => handleChange('invNoB', e.target.value)} /></FRow>
                            <FRow label="発行日"><input type="date" style={s.input} value={form.invDate} onChange={e => handleChange('invDate', e.target.value)} /></FRow>
                            <FRow label="お振込期日"><input type="date" style={s.input} value={form.invDue} onChange={e => handleChange('invDue', e.target.value)} /></FRow>
                            <FRow label="インボイス登録番号"><input type="text" style={{...s.input, ...s.inputWide}} value={form.invReg} onChange={e => handleChange('invReg', e.target.value)} /></FRow>
                            
                            <h3 style={s.subTitle}>自社 振込先口座（用途別）</h3>
                            <FRow label="口座の用途" hint="請求書の「お支払情報・振込先口座」に反映されます">
                                <select style={s.inputSelect} value={form.payAcct} onChange={e => handleChange('payAcct', e.target.value)}>
                                    <option value="brokerage">① 仲介手数料</option>
                                    <option value="resale">② 中古再販</option>
                                    <option value="reform">③ リフォーム工事直請負</option>
                                </select>
                            </FRow>
                        </div>
                        
                        {/* ⑥ 領収証 */}
                        <div style={s.card}>
                            <h2 style={s.cardTitle}><span style={s.noBadge}>6</span>領収証（売主 → 買主）</h2>
                            <FRow label="発行する">
                                <select style={s.inputSelect} value={form.rcOn} onChange={e => handleChange('rcOn', e.target.value)}>
                                    <option value="1">発行する</option>
                                    <option value="0">発行しない</option>
                                </select>
                            </FRow>
                            <FRow label="領収対象">
                                <select style={s.inputSelect} value={form.rcTarget} onChange={e => handleChange('rcTarget', e.target.value)}>
                                    <option value="both">残代金＋固都税精算金</option>
                                    <option value="balance">売買残代金のみ</option>
                                    <option value="tax">固都税精算金のみ</option>
                                    <option value="custom">金額を手入力</option>
                                </select>
                            </FRow>
                            <FRow label="手入力金額"><input type="number" style={s.input} value={form.rcCustom} onChange={e => handleChange('rcCustom', Number(e.target.value))} /><span style={s.unit}>円</span></FRow>
                            <FRow label="署名欄" hint="売主が自署する場合は空欄で印刷">
                                <select style={s.inputSelect} value={form.rcSign} onChange={e => handleChange('rcSign', e.target.value)}>
                                    <option value="blank">空欄（自署用）</option>
                                    <option value="print">住所・氏名を印字</option>
                                </select>
                            </FRow>
                            <FRow label="印紙税の扱い">
                                <select style={s.inputSelect} value={form.rcStamp} onChange={e => handleChange('rcStamp', e.target.value)}>
                                    <option value="free">営業に関しない受取書（非課税）</option>
                                    <option value="taxed">売上代金の受取書（課税）</option>
                                </select>
                            </FRow>
                            
                            <div style={s.totRow}><span style={s.totLabel}>領収金額</span><span style={s.totVal}>{formatYen(calc.rcAmt)}</span></div>
                            <div style={{...s.totRow, borderBottom: 'none'}}><span style={s.totLabel}>必要な収入印紙</span><span style={s.totVal}>{calc.rcStampAmt ? formatYen(calc.rcStampAmt) : '不要'}</span></div>
                        </div>

                        {/* ⑦ 売主インボイス */}
                        <div style={s.card}>
                            <h2 style={s.cardTitle}><span style={s.noBadge}>7</span>売主 インボイス・受領口座</h2>
                            <FRow label="売主の区分" hint="買主への発行書類の記載が変わります">
                                <select style={s.inputSelect} value={form.sellerTaxable} onChange={e => handleChange('sellerTaxable', e.target.value)}>
                                    <option value="0">個人（免税事業者・営業外）</option>
                                    <option value="1">適格請求書発行事業者</option>
                                </select>
                            </FRow>
                            <FRow label="インボイス登録番号" hint="T＋数字13桁">
                                <input type="text" style={{ ...s.input, ...s.inputWide }} placeholder="T1234567890123" value={form.sellerInvReg} onChange={e => handleChange('sellerInvReg', e.target.value)} />
                            </FRow>
                            <FRow label="うち消費税額（建物分・10 %）">
                                <input type="number" style={s.input} value={form.sellerVat} onChange={e => handleChange('sellerVat', Number(e.target.value))} /><span style={s.unit}>円</span>
                            </FRow>

                            {calc.invAlerts.map((al, idx) => (
                                <div key={idx} style={al.type === 'warn' ? s.alertBox : s.infoBox}>{al.type === 'warn' ? '⚠️ ' : 'ℹ️ '}{al.msg}</div>
                            ))}
                            
                            <h3 style={s.subTitle}>売買代金等の受領口座（売主名義）</h3>
                            <FRow label="金融機関名"><input type="text" style={{...s.input, ...s.inputWide}} value={form.sBank} onChange={e => handleChange('sBank', e.target.value)} /></FRow>
                            <FRow label="支店名"><input type="text" style={{...s.input, ...s.inputWide}} value={form.sBranch} onChange={e => handleChange('sBranch', e.target.value)} /></FRow>
                            <FRow label="口座種別">
                                <select style={s.inputSelect} value={form.sAcctType} onChange={e => handleChange('sAcctType', e.target.value)}>
                                    <option value="普通">普通</option>
                                    <option value="当座">当座</option>
                                    <option value="貯蓄">貯蓄</option>
                                </select>
                            </FRow>
                            <FRow label="口座番号"><input type="text" style={s.input} value={form.sAcctNo} onChange={e => handleChange('sAcctNo', e.target.value)} /></FRow>
                            <FRow label="口座名義"><input type="text" style={{...s.input, ...s.inputWide}} value={form.sAcctName} onChange={e => handleChange('sAcctName', e.target.value)} /></FRow>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* ==========================================
                💡 帳票プレビュー（モーダル）
            ========================================== */}
            <Modal show={previewOpen} onHide={() => setPreviewOpen(false)} fullscreen>
                <div style={{ backgroundColor: '#5f5f5a', paddingBottom: '40px' }} className="print-overlay">

                    {/* 印刷用CSS（全ページ表示・幅自動調整） */}
                    <style>{`
                        @media print {
                            html, body { height: auto !important; overflow: visible !important; background: transparent !important; }
                            .modal, .modal-dialog, .modal-content, .modal-body { position: static !important; height: auto !important; width: 100% !important; max-width: 100% !important; overflow: visible !important; border: none !important; background: transparent !important; display: block !important; padding: 0 !important; margin: 0 !important; }
                            body * { visibility: hidden; }
                            .print-overlay, .print-overlay * { visibility: visible; }
                            .print-overlay { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; height: auto !important; overflow: visible !important; display: block !important; background: transparent !important; }
                            .no-print { display: none !important; }
                            .page { width: 100% !important; max-width: 100% !important; min-height: auto !important; box-shadow: none !important; margin: 0 !important; padding: 5mm 10mm !important; page-break-after: always !important; break-after: page !important; page-break-inside: avoid !important; break-inside: avoid !important; box-sizing: border-box !important; }
                            .page:last-child { page-break-after: auto !important; break-after: auto !important; }
                            @page { size: A4 portrait; margin: 5mm; }
                        }
                    `}</style>

                    <div style={s.topBar} className="no-print">
                        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>🖨️ 帳票プレビュー</span>
                        <span style={{ flex: 1 }}></span>
                        <button onClick={() => window.print()} style={{ padding: '6px 16px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>PDF保存（印刷）</button>
                        <button onClick={() => setPreviewOpen(false)} style={{ padding: '6px 16px', backgroundColor: '#fff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer' }}>✕ 閉じる</button>
                    </div>

                    {/* 📄 1. 売主用 御計算書 */}
                    <div className="page" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 16mm', backgroundColor: '#fff', color: '#000', margin: '0 auto 20px', boxShadow: '0 3px 14px rgba(0,0,0,.35)', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8mm' }}>
                            <div style={{ fontSize: '13pt', borderBottom: '1px solid #999', paddingBottom: '2px', display: 'inline-block', minWidth: '150px' }}>{form.seller} 様</div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '9.5pt' }}>{formatDate(form.invDate)}</div>
                                <div style={{ marginTop: '4mm' }}><span style={{ border: '1px solid #000', padding: '2px 8px', fontSize: '10pt' }}>{formatDate(form.delivery)} 決済設定</span></div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', marginBottom: '8mm' }}><span style={{ fontSize: '15pt', letterSpacing: '0.5em', borderBottom: '2px solid #000', paddingBottom: '2px' }}>御計算書</span></div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: '6mm' }}>
                            <tbody>
                                <tr><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', width: '25%' }}>物件名</th><td style={{ border: '1px solid #000', padding: '4px' }}>{form.propName}</td></tr>
                                <tr><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px' }}>所在地</th><td style={{ border: '1px solid #000', padding: '4px' }}>{form.propAddr}</td></tr>
                            </tbody>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                            <thead>
                                <tr>
                                    <th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', width: '50%' }}>項目</th>
                                    <th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', width: '25%' }}>収入</th>
                                    <th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', width: '25%' }}>支出</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>売買残代金</td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatYen(calc.balance)}</td><td style={{ border: '1px solid #000', padding: '4px' }}></td></tr>
                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>手付金（受領済）</td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatYen(form.deposit)}</td><td style={{ border: '1px solid #000', padding: '4px' }}></td></tr>
                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>固定資産税等 日割精算金</td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatYen(calc.pr.buyer)}</td><td style={{ border: '1px solid #000', padding: '4px' }}></td></tr>

                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>仲介手数料</td><td style={{ border: '1px solid #000', padding: '4px' }}></td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatYen(calc.feeS.balance)}</td></tr>
                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>司法書士登記費用</td><td style={{ border: '1px solid #000', padding: '4px' }}></td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatYen(form.sJudi)}</td></tr>
                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>住宅ローン一括返済額</td><td style={{ border: '1px solid #000', padding: '4px' }}></td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatYen(calc.loanTotal)}</td></tr>

                                <tr><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px' }}>合計</th><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', textAlign: 'right' }}>{formatYen(calc.sIncome)}</th><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', textAlign: 'right' }}>{formatYen(calc.sExpense)}</th></tr>
                            </tbody>
                        </table>

                        <div style={{ marginTop: '6mm', width: '300px', border: '2px solid #000' }}>
                            <div style={{ background: '#f2f2f2', padding: '4px', textAlign: 'center', borderBottom: '1px solid #000', fontWeight: 'bold' }}>最終手取額（手付金含む）</div>
                            <div style={{ padding: '8px 12px', fontSize: '14pt', fontWeight: 'bold', textAlign: 'right' }}>{formatYen(calc.sNetTotal)}</div>
                        </div>
                    </div>

                    {/* 📄 2. 固都税精算書 */}
                    <div className="page" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 16mm', backgroundColor: '#fff', color: '#000', margin: '0 auto 20px', boxShadow: '0 3px 14px rgba(0,0,0,.35)', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8mm' }}>
                            <div style={{ fontSize: '13pt', borderBottom: '1px solid #999', paddingBottom: '2px', display: 'inline-block', minWidth: '150px' }}>{form.seller} 様 ／ {form.buyer} 様</div>
                            <div style={{ textAlign: 'right', fontSize: '9.5pt' }}>{formatDate(form.invDate)}</div>
                        </div>
                        <div style={{ textAlign: 'center', marginBottom: '8mm' }}><span style={{ fontSize: '15pt', letterSpacing: '0.5em', borderBottom: '2px solid #000', paddingBottom: '2px' }}>固都税精算書</span></div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: '6mm' }}>
                            <tbody>
                                <tr><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', width: '20%' }}>起算日</th><td style={{ border: '1px solid #000', padding: '4px' }}>{form.taxBase === '01-01' ? '1月1日' : '4月1日'}</td><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', width: '20%' }}>精算期間</th><td style={{ border: '1px solid #000', padding: '4px' }}>{calc.pr.period}</td></tr>
                                <tr><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px' }}>引渡日</th><td style={{ border: '1px solid #000', padding: '4px' }}>{formatDate(form.delivery)}</td><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px' }}>当日の負担</th><td style={{ border: '1px solid #000', padding: '4px' }}>{form.taxDay === 'buyer' ? '買主' : '売主'}</td></tr>
                            </tbody>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                            <thead>
                                <tr>
                                    <th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px' }}>区分</th>
                                    <th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px' }}>年税額</th>
                                    <th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px' }}>負担日数</th>
                                    <th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px' }}>負担額</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>年税額 合計</td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatYen(calc.annualTax)}</td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>365日</td><td style={{ border: '1px solid #000', padding: '4px' }}></td></tr>
                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>売主負担（起算日〜引渡日前日）</td><td style={{ border: '1px solid #000', padding: '4px' }}></td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{calc.pr.sellerDays}日</td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatYen(calc.pr.seller)}</td></tr>
                                <tr><td style={{ border: '1px solid #000', padding: '4px', fontWeight: 'bold' }}>買主負担（引渡日〜期間末日）</td><td style={{ border: '1px solid #000', padding: '4px' }}></td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{calc.pr.buyerDays}日</td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{formatYen(calc.pr.buyer)}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 📄 3. 買主用 御計算書 */}
                    <div className="page" style={{ width: '210mm', minHeight: '297mm', padding: '15mm 16mm', backgroundColor: '#fff', color: '#000', margin: '0 auto 20px', boxShadow: '0 3px 14px rgba(0,0,0,.35)', boxSizing: 'border-box', fontFamily: 'sans-serif' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8mm' }}>
                            <div style={{ fontSize: '13pt', borderBottom: '1px solid #999', paddingBottom: '2px', display: 'inline-block', minWidth: '150px' }}>{form.buyer} 様</div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '9.5pt' }}>{formatDate(form.invDate)}</div>
                                <div style={{ marginTop: '4mm' }}><span style={{ border: '1px solid #000', padding: '2px 8px', fontSize: '10pt' }}>{formatDate(form.delivery)} 決済設定</span></div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', marginBottom: '8mm' }}><span style={{ fontSize: '15pt', letterSpacing: '0.5em', borderBottom: '2px solid #000', paddingBottom: '2px' }}>御計算書</span></div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: '6mm' }}>
                            <tbody>
                                <tr><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', width: '25%' }}>物件名</th><td style={{ border: '1px solid #000', padding: '4px' }}>{form.propName}</td></tr>
                                <tr><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px' }}>所在地</th><td style={{ border: '1px solid #000', padding: '4px' }}>{form.propAddr}</td></tr>
                            </tbody>
                        </table>

                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                            <thead>
                                <tr>
                                    <th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', width: '58%' }}>項目</th>
                                    <th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', width: '22%' }}>金額</th>
                                    <th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', width: '20%' }}>備考</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>売買残代金</td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatYen(calc.balance)}</td><td style={{ border: '1px solid #000', padding: '4px' }}></td></tr>
                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>固定資産税等 日割精算金</td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatYen(calc.pr.buyer)}</td><td style={{ border: '1px solid #000', padding: '4px' }}>{calc.pr.buyerDays}日 / 365日</td></tr>
                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>仲介手数料（税込）</td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatYen(calc.feeB.balance)}</td><td style={{ border: '1px solid #000', padding: '4px' }}>{calc.baseFee.formula}</td></tr>
                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>司法書士登記費用</td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right' }}>{formatYen(form.bJudi)}</td><td style={{ border: '1px solid #000', padding: '4px' }}>所有権移転・設定</td></tr>

                                <tr><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px' }}>必要資金 合計</th><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px', textAlign: 'right' }}>{formatYen(calc.bNeed)}</th><th style={{ border: '1px solid #000', background: '#f2f2f2', padding: '4px' }}></th></tr>
                                <tr><td style={{ border: '1px solid #000', padding: '4px' }}>住宅ローン借入額</td><td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', color: '#b4232a' }}>▲ {formatYen(form.bLoan).replace('¥', '¥ ')}</td><td style={{ border: '1px solid #000', padding: '4px' }}></td></tr>
                            </tbody>
                        </table>

                        <div style={{ marginTop: '6mm', width: '300px', border: '2px solid #000' }}>
                            <div style={{ background: '#f2f2f2', padding: '4px', textAlign: 'center', borderBottom: '1px solid #000', fontWeight: 'bold' }}>決済時にご準備いただく自己資金</div>
                            <div style={{ padding: '8px 12px', fontSize: '14pt', fontWeight: 'bold', textAlign: 'right' }}>{formatYen(calc.bOwn)}</div>
                        </div>
                    </div>
                    
                    {/* 📄 4. 請求書 (InvoicePage) */}
                    <InvoicePage isSeller={true} />
                    <InvoicePage isSeller={false} />
                    
                    {/* 📄 5. 領収証 (ReceiptPage) */}
                    <ReceiptPage />
                </div>
            </Modal>
        </>
    );
};

export default PlannerGenerator;