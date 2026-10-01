/**
 * アンバサダー台帳のKPI（歩留まり）の判定。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **判定の仕方は shopTrend に合わせてある**
 *   （⚠️ `components/shopTrend/ShopTrendOrder.tsx` の `getValue()`）。
 *   ⚠️ ⚠️ **あちらを直したらここも直すこと。** ⚠️ 数が合わなくなっても
 *     どちらも「それらしい値」を出すため、⚠️ **ずれに気づけない。**
 *
 * ⚠️⚠️ **こちらは期間で絞らない（全期間の通算）。**
 *   ⚠️ 台帳は「誰がどれだけ貢献しているか」を見る画面であり、
 *     ⚠️ 月ごとの推移を見る画面ではないため。
 *   ⚠️ ⚠️ **そのため shopTrend の「期間」側の分岐に相当する。**
 *     ⚠️ 月指定側（実績日がその月か）ではない。
 * ─────────────────────────────────────────────
 */

/** 顧客1件。⚠️ サーバー（features/ambassador/kpi.ts）が返す形 */
export type KpiCustomer = {
    /** 反響側の no。⚠️ どの反響から作られた顧客かを示す */
    inquiry_no: number;
    ambassador_no: number;
    /** '注文' / '建売' / '中古' */
    division: string | null;
    /** master_data(_kaeru/_resale) の id。⚠️ InformationEdit に渡す */
    id: string;
    customer: string;
    shop: string;
    staff: string;
    status: string;
    /** 反響日 */
    register: string;
    /** 初回面談（来場）日 */
    interview: string;
    /** 第二面談。⚠️ **01JSENACS…**（DBのコメントは当てにならない） */
    appointment: string;
    /** 事前審査 */
    screening: string;
    /** 契約日。⚠️ 区分ごとに元の列が違う（サーバー側で吸収済み） */
    contract: string;
};

/** 反響1件。⚠️ **未同期も含む**（総反響の母数） */
export type KpiInquiry = {
    ambassador_no: number;
    inquiry_no: number;
    name: string | null;
    inquiry_date: string | null;
    sync: number;
    division: string | null;
    master_data_id: string | null;
};

/** 日付が入っているか。⚠️ 空文字・NULL・空白だけを「無し」とみなす */
const has = (value: string | null | undefined): boolean =>
    (value ?? '').trim() !== '';

/**
 * 次アポ（＝初回面談のあとに進んだ人）。
 *
 * ⚠️⚠️ **第二面談・事前審査・契約のいずれかがあれば「進んだ」とみなす。**
 *   ⚠️ 移植元と同じ。⚠️ ⚠️ **第二面談の日付を入れずに契約まで進む案件があり、**
 *     ⚠️ 第二面談だけを見ると**契約者が次アポから漏れて歩留まりが逆転する。**
 */
const movedOn = (c: KpiCustomer): boolean =>
    has(c.appointment) || has(c.screening) || has(c.contract);

/**
 * 契約。
 *
 * ⚠️⚠️ **日付だけでなく `status` も見る。**
 *   ⚠️ 契約日が入ったまま失注・保留になっている行があり、
 *     ⚠️ ⚠️ **日付だけで数えると契約数が実際より多く出る。**
 *   ⚠️ `解約` を含めるのは移植元と同じ（⚠️ **一度は契約に至った**ため）。
 */
const CONTRACT_STATUS = ['契約済み', '解約'];

const isContract = (c: KpiCustomer): boolean =>
    has(c.contract) && CONTRACT_STATUS.includes((c.status ?? '').trim());

/**
 * 初回面談。
 *
 * ⚠️⚠️ **来場日が未入力でも、その先へ進んでいれば数える。**
 *   ⚠️ 移植元の「期間」側と同じ扱い。
 *   ⚠️ ⚠️ **入れないと、来場日の入力漏れで「次アポ＞初回面談」という
 *     ありえない歩留まりが出る。**
 */
const isInterview = (c: KpiCustomer): boolean => has(c.interview) || movedOn(c);

/** KPIの1段。⚠️ 件数だけでなく**該当者そのもの**を持つ（モーダルで出すため） */
export type KpiStage = {
    key: StageKey;
    label: string;
    list: KpiCustomer[];
    /** 歩留まりの分母。⚠️ 総反響には無い */
    denominator: number | null;
};

export type StageKey = 'register' | 'interview' | 'appointment' | 'contract';

/**
 * 1人ぶんのKPIを組み立てる。
 *
 * @param total      そのアンバサダーの全反響（⚠️ **未同期を含む**）
 * @param customers  うち顧客になったもの
 *
 * ⚠️⚠️ **総反響の母数は `customers` ではなく `total`。**
 *   ⚠️ 同期していない反響も「連れてきた」ことに変わりはない。
 *   ⚠️ ⚠️ **`customers` で数えると、同期が滞っているだけで貢献が低く見える。**
 *
 * ⚠️ 分母は移植元に合わせる。
 *   ⚠️⚠️ **次アポも契約も分母は「初回面談」**（⚠️ 契約は次アポ割ではない）。
 */
export const buildStages = (total: KpiInquiry[], customers: KpiCustomer[]): KpiStage[] => {
    const interview = customers.filter(isInterview);
    const appointment = customers.filter(movedOn);
    const contract = customers.filter(isContract);

    return [
        // ⚠️ 総反響だけは顧客行を持たない（未同期は顧客が存在しない）。
        //   ⚠️⚠️ **モーダルには反響そのものを出す**ので、ここでは空にしておく
        { key: 'register', label: '総反響', list: [], denominator: null },
        { key: 'interview', label: '初回面談', list: interview, denominator: total.length },
        { key: 'appointment', label: '次アポ', list: appointment, denominator: interview.length },
        { key: 'contract', label: '契約', list: contract, denominator: interview.length },
    ];
};

/**
 * 歩留まり（%）。
 *
 * ⚠️⚠️ **分母が0のときは null を返す。** `0%` と出さないこと。
 *   ⚠️ ⚠️ **「まだ誰も来ていない」と「来たが誰も進まなかった」は意味が違う。**
 *     ⚠️ 両方を 0% にすると、前者が成績不振に見える。
 */
export const rate = (count: number, denominator: number | null): number | null => {
    if (denominator === null || denominator === 0) return null;
    return Math.floor((count / denominator) * 100);
};
