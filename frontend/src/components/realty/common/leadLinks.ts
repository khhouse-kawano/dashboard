import { loadRecords, post } from './realtyState';
import { logChange, newRecordId, saveBrokerageRecord } from './leadUtiles';

/**
 * 反響から次の台帳・案件への連携（v2.2.244 新規）。以前のアプリ v14.29 の leadToLedger / buyToDeal と同じ動き。
 *
 * ─────────────────────────────────────────────
 *   売り反響を「媒介受託」にする → 媒介獲得台帳（kind = ledger）へ1行作り、反響に ledgerNo を持たせる
 *     ⚠️ v2.2.247: 売り反響の画面の「媒介紐付」の画面（LedgerLinkModal）で台帳の値を確かめてから作る。売り反響の画面だけで作る
 *     ⚠️ v2.2.248: 連動トリガー仕様書の ①。前提条件を確かめ、台帳の作成・反響の媒介受託・変更履歴を ② の planner:ledger_link が1つのトランザクションで行う（linkLedger）
 *   買い反響を「購入申込」にする → 商談案件（kind = deals）へ「買」案件を1件作り、反響に dealId を持たせる
 *   ⚠️ v2.2.246:
 *   媒介台帳の「買付登録」     → 他社客付けは商談案件「売」を1件、自社客付けは「売」「買」の2件（registerBuyOffer）
 *   売り反響の「買取案件へ」   → 台帳の媒介種別を「買取」にし、買取再販案件（kind = resales）を1件作る（leadToResale）
 *
 * ⚠️ No. は「その種類の最大 + 1」（以前のアプリと同じ）。⚠️ 作る直前に読み直して数える（画面を開いた後に増えた分を拾う）。
 * ⚠️ 二重連携は呼び出し側で防ぐ（ledgerNo / dealId が入っていれば呼ばない）。
 * ⚠️ 媒介台帳の担当は略称（設定の staff.abbr）、反響の担当は氏名。以前のアプリと同じく読み替える。
 * ─────────────────────────────────────────────
 */

type Rec = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? '' : String(v));

const todayStr = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const nextNo = (rows: Rec[]): number =>
    Math.max(0, ...rows.map((r) => Number(r.no)).filter((n) => Number.isFinite(n))) + 1;

/** 住所の市区町村まで（以前のアプリの guessCity） */
const guessCity = (addr: string): string => addr.match(/^(.+?[市郡町村])/)?.[1] ?? '';

/** 'YYYY-MM-DD' か。⚠️ 以前のアプリと同じ形だけを受け付ける */
export const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * ⚠️ v2.2.248: 連動トリガー仕様書の ① 媒介獲得（docs/realty-trigger-spec.md）。
 *   媒介の種類は専属専任・専任・一般（「買取」は ④ で扱うので、ここでは選ばせない）
 */
export const LEDGER_BAIKAI_TYPES = ['専属専任媒介', '専任媒介', '一般媒介'];
/** 有効期間3か月の上限がある種類（宅建業法） */
const LIMITED_BAIKAI_TYPES = ['専属専任媒介', '専任媒介'];
/** 媒介獲得台帳の選択肢（database/PropertyRegister.tsx の台帳の編集画面と同じ。仕様書の「土地」は「住宅用地」など） */
export const LEDGER_CATEGORIES = ['戸建', 'マンション', '住宅用地', '賃収マンション', '賃収・事業用', 'その他'];
export const LEDGER_FREQS = ['1週間', '2週間', '1か月'];

/**
 * 有効期間の満了日の上限＝契約日の3か月後の前日（仕様書の初期値）。
 * ⚠️ 3か月後に同じ日が無いとき（11/30 → 2/30 など）は、その月の末日。
 * ⚠️ ② の features/realty/ledgerLink.ts の maxExpiryOf と同じ計算
 */
export const maxExpiryOf = (contractDate: string): string => {
    const [y, m, d] = contractDate.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m - 1 + 3 + 1, 0)).getUTCDate();
    if (d > lastDay) return new Date(Date.UTC(y, m - 1 + 3, lastDay)).toISOString().slice(0, 10);
    return new Date(Date.UTC(y, m - 1 + 3, d - 1)).toISOString().slice(0, 10);
};

/**
 * 売り反響 → 媒介獲得台帳の「媒介紐付」の画面（common/LedgerLinkModal.tsx）で確かめる値。
 * staff は氏名（台帳には略称で入る）。otherBrokers は一般媒介の他の依頼先（任意。台帳の備考に書き足す）
 */
export type LedgerForm = {
    baikaiDate: string; baikaiType: string; expiry: string; seller: string; contact: string; category: string;
    addr1: string; addr2: string; price: number | null; staff: string; freq: string; note: string; otherBrokers: string;
    /** v2.2.250: 媒介物件の項目（仕様書 ②）。すべて任意。⚠️ 種別がマンションのときは建物名が必須（同じ物件の突き合わせに使う） */
    chiban: string; buildingName: string; roomNo: string; landArea: string; buildingArea: string; builtYear: string; layout: string;
};

/**
 * 売り反響の一括査定の詳細（以前のアプリの lead.detail。取り込みで raw_data に入っている）の1項目。無ければ ''。
 * 例: msName（マンション名）・room（部屋）・land（土地面積）・area（建物面積）・built（築年）・layout（間取り）
 */
const detailOf = (lead: Rec, key: string): string => {
    const raw = lead.raw_data;
    let o: unknown = raw;
    if (typeof raw === 'string') {
        try { o = JSON.parse(raw); } catch { return ''; }
    }
    const d = o && typeof o === 'object' ? (o as Rec).detail : null;
    return d && typeof d === 'object' ? str((d as Rec)[key]).trim() : '';
};

/** 売り反響の値を台帳の項目に写す（媒介契約日が無ければ今日。満了日は3か月後の前日） */
export const ledgerFormOf = (lead: Rec): LedgerForm => {
    const addr = str(lead.addr || lead.addr1);
    const d = str(lead.baikaiDate).replace(/\//g, '-');
    const baikaiDate = isIsoDate(d) ? d : todayStr();
    return {
        baikaiDate,
        baikaiType: '専任媒介',
        expiry: maxExpiryOf(baikaiDate),
        seller: str(lead.seller || lead.name),
        contact: str(lead.contact) || [lead.phone, lead.mail].map(str).filter(Boolean).join(' / '),
        category: str(lead.category),
        addr1: guessCity(addr), addr2: addr,
        price: Number(lead.price) || null,
        staff: str(lead.staff),
        freq: '1か月',
        note: `反響リードより転記（${str(lead.source) || '反響元未設定'}）`,
        otherBrokers: '',
        // ⚠️ v2.2.250: 一括査定の詳細（以前のアプリの lead.detail。raw_data に入っている）にあれば入れておく
        chiban: '',
        buildingName: detailOf(lead, 'msName'),
        roomNo: detailOf(lead, 'room'),
        landArea: detailOf(lead, 'land'),
        buildingArea: detailOf(lead, 'area'),
        builtYear: detailOf(lead, 'built'),
        layout: detailOf(lead, 'layout'),
    };
};

/**
 * 前提条件（仕様書 ①。満たさなければ保存しない）。満たさない項目の説明を返す（空なら満たしている）。
 * ⚠️ ② の features/realty/ledgerLink.ts の problemsOf と同じ。⚠️ どちらかを変えたら両方を変える
 */
export const ledgerFormProblems = (f: LedgerForm, today: string = todayStr()): string[] => {
    const p: string[] = [];
    if (!LEDGER_BAIKAI_TYPES.includes(f.baikaiType)) p.push('媒介の種類');
    if (!isIsoDate(f.baikaiDate)) p.push('媒介契約日');
    else if (f.baikaiDate > today) p.push('媒介契約日（未来の日付は入れられません）');
    if (!isIsoDate(f.expiry)) p.push('有効期間の満了日');
    else if (isIsoDate(f.baikaiDate)) {
        if (f.expiry < f.baikaiDate) p.push('有効期間の満了日（媒介契約日より前です）');
        else if (LIMITED_BAIKAI_TYPES.includes(f.baikaiType) && f.expiry > maxExpiryOf(f.baikaiDate)) {
            p.push(`有効期間の満了日（${f.baikaiType}は契約日から3か月以内＝${maxExpiryOf(f.baikaiDate)}まで）`);
        }
    }
    if (!Number.isInteger(f.price) || (f.price ?? 0) < 1) p.push('売出価格（1円以上の整数）');
    if (!f.staff.trim()) p.push('担当者');
    if (!f.seller.trim()) p.push('売主');
    if (!f.addr2.trim()) p.push('物件の所在地');
    if (!f.category) p.push('物件の種別');
    if (f.category === 'マンション' && !f.buildingName.trim()) p.push('建物名（マンションのとき）');
    return p;
};

/** 一般媒介で3か月を超える満了日（仕様書：警告。保存はできる）。問題が無ければ null */
export const ledgerFormWarning = (f: LedgerForm): string | null =>
    f.baikaiType === '一般媒介' && isIsoDate(f.baikaiDate) && isIsoDate(f.expiry) && f.expiry > maxExpiryOf(f.baikaiDate)
        ? `有効期間が3か月（${maxExpiryOf(f.baikaiDate)}まで）を超えています。このまま登録しますか？`
        : null;

/** v2.2.250: 紐づけた媒介物件。isNew = 新しく作った、pastLedgers = 同じ物件の以前の台帳 No. */
export type LinkedProperty = { id: string; isNew: boolean; pastLedgers: number[] };
export type LedgerLinkResult = { status: 'success' | 'exists'; no: number; ledgerId: string | null; lead: Rec | null; property: LinkedProperty | null };

/**
 * 売り反響 → 媒介獲得台帳（② の planner:ledger_link）。
 * ⚠️ 台帳の作成・売り反響の媒介受託・変更履歴は、② が1つのトランザクションで行う（仕様書 共通ルール 3。v2.2.247 までは画面から別々に保存していた）。
 * ⚠️ すでに台帳に紐づいていれば、② は作らずに status = 'exists' と、その台帳 No. を返す。
 * ⚠️ form は JSON の文字列で送る（① を通ると {} が [] になるため）。前提条件を満たさなければ ② のメッセージで例外になる
 */
export const linkLedger = async (leadId: string, form: LedgerForm): Promise<LedgerLinkResult> => {
    const d = await post('ledger_link', { leadId, form: JSON.stringify(form) });
    return {
        status: d.status === 'exists' ? 'exists' : 'success',
        no: Number(d.no),
        ledgerId: typeof d.ledgerId === 'string' ? d.ledgerId : null,
        lead: d.lead && typeof d.lead === 'object' ? (d.lead as Rec) : null,
        property: d.property && typeof d.property === 'object' ? (d.property as LinkedProperty) : null,
    };
};

/**
 * 買い反響 → 商談案件（買）。
 * @returns 作った案件の No.・id と、反響に保存した値
 */
export const buyToDeal = async (lead: Rec): Promise<{ no: number; dealId: string; leadFields: Rec }> => {
    const { records } = await loadRecords(['deals']);
    const no = nextNo(records.deals);
    const dealId = newRecordId();
    const ledgerNo = lead.ledgerNo == null || lead.ledgerNo === '' ? null : Number(lead.ledgerNo);
    await saveBrokerageRecord(dealId, {
        kind: 'deals', no, createdAt: todayStr(), property: str(lead.targetProperty), type: '買',
        price: Number(lead.budget) || 0, fee: null, feeManual: false,
        contactDate: str(lead.receivedDate) || todayStr(), staff: str(lead.staff), customer: str(lead.name),
        phase: '購入申込', contractDate: '', settleDate: '', priority: '', followDate: '',
        ledgerId: lead.ledgerId || null, ledgerNo,
        note: `買い反響より転記（${str(lead.portal) || 'ポータル未設定'}）${ledgerNo != null ? `／📝台帳No.${ledgerNo}` : ''}`,
    });
    // ⚠️ 以前のアプリと同じく、成約済みの反響はフェーズを戻さない
    const leadFields: Rec = { dealId, ...(str(lead.phase) === '成約' ? {} : { phase: '購入申込' }) };
    await saveBrokerageRecord(str(lead.id), leadFields);
    return { no, dealId, leadFields };
};

// ---------------------------------------------------------------------------
// 媒介台帳の買付登録（v2.2.246。以前のアプリ v14.29 の openCoBroker / saveCoBroker / ledgerToDeal / ledgerToDealOwn / cbUnlink）
// ---------------------------------------------------------------------------

/** 自社の売主名（以前のアプリの RS_OWNER）。買取再販の物件は「(株)国分ハウジング（物件名）」で台帳に入る */
export const OWN_SELLER = '(株)国分ハウジング';
/** 台帳の現況。商談中の意味（以前のアプリの CB_LED_STATUS） */
export const OFFER_STATUS = '買付有';
/** 買主属性（以前のアプリの CB_ATTRS） */
export const BUYER_ATTRS = ['個人（実需）', '個人（住み替え）', '個人（投資）', '法人', '買取業者', 'その他'];

/** 他社客付けのときに台帳へ残す客付けの内容（coBroker 列。JSON） */
export type CoBroker = {
    company: string; person: string; contact: string; buyerName: string; buyerAttr: string;
    price: number; contractDate: string; deliveryDate: string; note: string; registeredAt: string; registeredBy: string;
};

export type BuyOfferInput = {
    /** out = 他社客付け（片手）／own = 自社客付け（両手。買い反響のお客様） */
    kind: 'out' | 'own';
    company: string; person: string; contact: string;
    price: number; contractDate: string; deliveryDate: string;
    buyerName: string; buyerAttr: string; property: string;
    /** 自社担当（氏名） */
    staff: string;
    /** 仲介手数料を計上しない（自社売主＝買取再販物件） */
    noFee: boolean;
    note: string;
};

/** 自社が売主（買取再販）の物件か。⚠️ 他社客付けでも自社の仲介手数料は出ない（以前のアプリの cbIsOwnStock） */
export const isOwnStock = (ledger: Rec): boolean =>
    str(ledger.baikaiType) === '買取' || str(ledger.seller).startsWith(OWN_SELLER);

/** 商談案件の物件名の候補（以前のアプリの cbGuessProperty）。自社名義なら括弧の中、無ければ所在地、無ければ「売主名邸」 */
export const guessProperty = (ledger: Rec): string => {
    const m = str(ledger.seller).match(/^\(株\)国分ハウジング（(.+)）$/);
    if (m) return m[1];
    // ⚠️ 売り反響から作った台帳は、所在地1に市、所在地2に住所全体が入る（leadLinks の ledgerFormOf / ② の planner:ledger_link）。重ねない
    const a1 = str(ledger.addr1).trim();
    const a2 = str(ledger.addr2).split('http')[0].trim();
    const base = (a1 && a2.startsWith(a1) ? a2 : `${a1}${a2}`).trim();
    if (base) return base.slice(0, 32);
    return ledger.seller ? `${str(ledger.seller)}邸` : '';
};

const addDays = (ds: string, n: number): string => {
    const d = new Date(`${ds}T00:00:00`);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 買付を登録して商談案件を作る。
 *   他社客付け … 「売」案件を1件。台帳に客付けの内容（coBroker）を残す
 *   自社客付け … 「売」「買」の2件。買い反響に「買」案件をつなぎ、台帳にも未設定ならつなぐ
 * 台帳は dealId（売側の案件）を持ち、現況を「買付有」にする（契約済のときは変えない）。
 * ⚠️ 二重の登録は呼び出し側で防ぐ（台帳の dealId が生きていれば呼ばない）。
 * @returns 作った売側の案件の No.（自社客付けのときは買側も）
 */
export const registerBuyOffer = async (
    ledger: Rec,
    inp: BuyOfferInput,
    buyLead: Rec | null,
    by: string
): Promise<{ sellNo: number; buyNo: number | null; ledgerFields: Rec; buyLeadFields: Rec | null }> => {
    const { records } = await loadRecords(['deals']);
    let no = nextNo(records.deals) - 1;
    const today = todayStr();
    const ledNo = ledger.no == null || ledger.no === '' ? null : Number(ledger.no);
    const ledLbl = `📝台帳No.${ledNo ?? '―'}`;
    const base = (): Rec => ({
        kind: 'deals', createdAt: today, price: inp.price, feeManual: inp.noFee, fee: inp.noFee ? 0 : null,
        contactDate: today, subStaff: '', subRatio: 0, phase: '購入申込',
        contractDate: inp.contractDate, settleDate: inp.deliveryDate, priority: '', followDate: '',
        nextDate: inp.contractDate || addDays(today, 3),
        reformPrice: 0, reformGp: 0, reformNote: '',
        ledgerId: str(ledger.id), ledgerNo: ledNo, property: inp.property,
    });
    const buyerNote = `${inp.buyerName || '―'}${inp.buyerAttr ? `・${inp.buyerAttr}` : ''}${inp.note ? `／${inp.note}` : ''}`;

    if (inp.kind === 'out') {
        const cb: CoBroker = {
            company: inp.company, person: inp.person, contact: inp.contact, buyerName: inp.buyerName, buyerAttr: inp.buyerAttr,
            price: inp.price, contractDate: inp.contractDate, deliveryDate: inp.deliveryDate, note: inp.note,
            registeredAt: new Date().toISOString(), registeredBy: by,
        };
        const sellNo = ++no;
        const sellId = newRecordId();
        await saveBrokerageRecord(sellId, {
            ...base(), no: sellNo, type: '売', staff: inp.staff, customer: str(ledger.seller),
            nextNote: `客付け（${inp.company}）と契約日程・必要書類の確定`,
            note: `${ledLbl}より客付け買付／客付：${inp.company}${inp.person ? `（${inp.person}）` : ''}／買主：${buyerNote}`,
            coBroker: cb,
        });
        const ledgerFields: Rec = { dealId: sellId, coBroker: cb, ...(str(ledger.currentStatus) === '契約済' ? {} : { currentStatus: OFFER_STATUS }) };
        await saveBrokerageRecord(str(ledger.id), ledgerFields);
        await logChange({ entity: 'ledger', entityId: str(ledger.id), entityNo: ledNo, label: str(ledger.seller), field: '客付け連携', from: '', to: `商談案件 No.${sellNo}`, by, note: `買付金額 ${inp.price.toLocaleString()}円（${inp.company}）` });
        return { sellNo, buyNo: null, ledgerFields, buyLeadFields: null };
    }

    // 自社客付け（両手）
    const sellNo = ++no;
    const buyNo = ++no;
    const sellId = newRecordId();
    const buyId = newRecordId();
    await saveBrokerageRecord(sellId, {
        ...base(), no: sellNo, type: '売', staff: inp.staff, customer: str(ledger.seller),
        nextNote: '売主へ買付内容の報告・契約日程の確定',
        note: `${ledLbl}より自社客付け（両手）／買主：${buyerNote}`,
    });
    await saveBrokerageRecord(buyId, {
        ...base(), no: buyNo, type: '買', staff: str(buyLead?.staff) || inp.staff, customer: inp.buyerName,
        nextNote: '買主の住宅ローン事前審査・契約書類の準備',
        note: `🏠買い反響（${str(buyLead?.portal) || '反響元未設定'}）からの自社客付け／${ledLbl}${inp.note ? `／${inp.note}` : ''}`,
    });
    const ledgerFields: Rec = { dealId: sellId, coBroker: null, ...(str(ledger.currentStatus) === '契約済' ? {} : { currentStatus: OFFER_STATUS }) };
    await saveBrokerageRecord(str(ledger.id), ledgerFields);
    let buyLeadFields: Rec | null = null;
    if (buyLead) {
        buyLeadFields = {
            dealId: buyId,
            ...(str(buyLead.ledgerId) === '' ? { ledgerId: str(ledger.id), ledgerNo: ledNo } : {}),
            ...(str(buyLead.targetProperty) === '' ? { targetProperty: inp.property } : {}),
            ...(str(buyLead.phase) === '成約' ? {} : { phase: '購入申込' }),
        };
        await saveBrokerageRecord(str(buyLead.id), buyLeadFields);
        await logChange({ entity: 'buy', entityId: str(buyLead.id), label: str(buyLead.name), field: '案件連携', from: '', to: `商談案件 No.${buyNo}`, by, note: `${ledLbl}へ買付（自社客付け）` });
    }
    await logChange({ entity: 'ledger', entityId: str(ledger.id), entityNo: ledNo, label: str(ledger.seller), field: '客付け連携', from: '', to: `商談案件 No.${sellNo}（売）・No.${buyNo}（買）`, by, note: `買付金額 ${inp.price.toLocaleString()}円（自社客付け）` });
    return { sellNo, buyNo, ledgerFields, buyLeadFields };
};

/** 連携を外す（買付が白紙・入力の誤り）。⚠️ 商談案件そのものは消さない（以前のアプリの cbUnlink） */
export const unlinkBuyOffer = async (ledger: Rec, by: string): Promise<Rec> => {
    const fields: Rec = { dealId: null };
    await saveBrokerageRecord(str(ledger.id), fields);
    await logChange({ entity: 'ledger', entityId: str(ledger.id), entityNo: ledger.no == null ? null : Number(ledger.no), label: str(ledger.seller), field: '客付け連携', from: `案件ID ${str(ledger.dealId)}`, to: '解除', by });
    return fields;
};

// ---------------------------------------------------------------------------
// 売り反響 → 買取案件（v2.2.246）
// ---------------------------------------------------------------------------

/** 売り反響の区分 → 買取再販の種別（土地・戸建・マンション・その他） */
const resaleCategoryOf = (c: string): string =>
    c.includes('マンション') ? 'マンション' : c.includes('土地') ? '土地' : c.includes('戸建') || c.includes('一戸建') ? '戸建' : 'その他';

/**
 * 売り反響を自社買取にする。
 * 媒介獲得台帳（反響の ledgerNo）の媒介種別を「買取」にし、買取再販案件を1件作って台帳 No. でつなぐ。
 * ⚠️ 台帳の無い反響は先に「媒介受託」で台帳を作ってから（呼び出し側で止める）。
 * ⚠️ その台帳につながる買取再販案件が既にあれば作らない（null を返す）。
 * ⚠️ 費目（costs）は空で作る。買取再販の画面が開いたときに、種別ごとの標準の費目で埋める（normalizeResaleDeal）。
 */
export const leadToResale = async (
    lead: Rec,
    by: string
): Promise<{ no: number; ledgerNo: number } | { exists: number } | null> => {
    const ledgerNo = Number(lead.ledgerNo);
    if (!Number.isFinite(ledgerNo) || ledgerNo <= 0) return null;
    const { records } = await loadRecords(['ledger', 'resales']);
    const ledger = records.ledger.find((l) => Number(l.no) === ledgerNo);
    if (!ledger) return null;
    const existing = records.resales.find((r) => Number(r.ledgerNo) === ledgerNo);
    if (existing) return { exists: Number(existing.no) };
    const no = nextNo(records.resales);
    const addr = str(lead.addr);
    await saveBrokerageRecord(newRecordId(), {
        kind: 'resales', no, property: guessProperty({ ...ledger, seller: '' }) || addr.slice(0, 32) || `${str(lead.name)}邸`,
        category: resaleCategoryOf(str(lead.category)), addr, staff: str(lead.staff), sellStaff: '',
        status: '仕入検討', ledgerNo, seller: str(lead.name || lead.seller), buyer: '',
        buyPrice: Number(lead.price) || 0, buyBuilding: 0, buySellerReg: '未確認', buyStockAsset: 1,
        costs: '[]', note: `売り反響より買取（${str(lead.source) || '反響元未設定'}）`, show_dashboard: 1,
    });
    if (str(ledger.baikaiType) !== '買取') await saveBrokerageRecord(str(ledger.id), { baikaiType: '買取' });
    await logChange({ entity: 'lead', entityId: str(lead.id), label: str(lead.name || lead.seller), field: '買取案件', from: '', to: `買取再販案件 No.${no}`, by, note: `台帳No.${ledgerNo} の媒介種別を買取に` });
    return { no, ledgerNo };
};
