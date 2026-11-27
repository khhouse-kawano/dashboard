/**
 * v2.2.309 SatBaseサマリー（SatBaseDatabase.tsx）の絞り込み・並べ替え・カードの数。
 *
 * ⚠️ ふだんは ② の satbase_page（GET）が絞って30件ずつ返す。これは ② に届かないとき（今までの POST の satbase_list＝全件）に画面で使う。
 * ⚠️⚠️ ② の backend-express/src/features/satbasePage.ts と同じ式にしてある。片方だけ直さない。
 */

type Row = Record<string, string | number | null>;

/** 並べ替えられる列（画面の列と、トグルの2列） */
export const SATBASE_SORT_KEYS = [
    'ad_posted', 'instagram_posted',
    'property_id', 'property_name', 'progress_status', 'sales_status', 'prefecture', 'area', 'team', 'sales_price', 'land_cost',
    'sales_period', 'spec', 'plan', 'usage_type', 'customer_name', 'contract_staff', 'site_staff', 'design_staff', 'construction_staff',
    'foundation_start_date', 'desired_start_date', 'completion_date', 'exterior_completion_date', 'permit_date', 'contract_recorded_date',
    'payment_date', 'delivery_date', 'portal_posted_date', 'kaeru_hp_posted_date', 'price_changed_date', 'previous_sales_price',
    'ground_improvement', 'schedule_created', 'land_id', 'property_id_general', 'property_id_manager',
    'purchase_settlement_date', 'purchase_contract_date', 'lat_lng', 'updated', 'updated_by',
];
const NUMERIC_KEYS = new Set([
    'ad_posted', 'instagram_posted', 'property_id', 'sales_price', 'land_cost', 'usage_type', 'previous_sales_price',
    'ground_improvement', 'schedule_created', 'land_id', 'property_id_general', 'property_id_manager',
]);

/** 絞り込みの条件（⚠️ キーは ② に送るキー・URL のキーと同じ。⚠️ category は使わない） */
export interface SatbaseConditions {
    keyword: string;
    progress: string;
    sales: string;
    pref: string;
    team: string;
    /** 広告出稿（'' すべて / '1' 済み / '0' 未） */
    ad: string;
    /** Instagram（'' すべて / '1' 済み / '0' 未） */
    insta: string;
}

export interface SatbaseKpi {
    total: number;
    /** 今期（6月〜今日）の着工棟数（建売・キャンセル以外・基礎着工日） */
    started: number;
    /** 着工予定（基礎着工日が今日より後） */
    planned: number;
    building: number;
    selling: number;
    sellingNoAd: number;
    /** 今期の始まり（'YYYY-06-01'） */
    fyStart: string;
}

export interface SatbaseOptions {
    progress: string[];
    sales: string[];
    pref: string[];
    team: string[];
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const sortValueOf = (r: Row, key: string): string | number | null => {
    const v = r[key];
    if (v === null || v === undefined || v === '') return null;
    return NUMERIC_KEYS.has(key) ? Number(v) : String(v);
};

export const filterAndSortSatbase = (rows: Row[], c: SatbaseConditions, sort: string, dir: 'asc' | 'desc'): Row[] => {
    const word = c.keyword.trim();
    const filtered = rows.filter((r) => {
        if (word !== '' && !str(r.property_name).includes(word) && !str(r.property_id).includes(word)) return false;
        if (c.progress !== '' && str(r.progress_status) !== c.progress) return false;
        if (c.sales !== '' && str(r.sales_status) !== c.sales) return false;
        if (c.pref !== '' && str(r.prefecture) !== c.pref) return false;
        if (c.team !== '' && str(r.team) !== c.team) return false;
        if (c.ad !== '' && String(Number(r.ad_posted ?? 0)) !== c.ad) return false;
        if (c.insta !== '' && String(Number(r.instagram_posted ?? 0)) !== c.insta) return false;
        return true;
    });
    // ⚠️ 空の値は並べ方によらず最後。同じ値どうしは物件IDの新しい順
    return filtered.sort((a, b) => {
        const av = sortValueOf(a, sort);
        const bv = sortValueOf(b, sort);
        if (av === null || bv === null) {
            if (av !== bv) return av === null ? 1 : -1;
        } else {
            let d = 0;
            if (typeof av === 'number' && typeof bv === 'number') d = av - bv;
            else if (av < bv) d = -1;
            else if (av > bv) d = 1;
            if (d !== 0) return dir === 'asc' ? d : -d;
        }
        return Number(b.property_id) - Number(a.property_id);
    });
};

/** カードの数（⚠️ 絞り込んだ物件から数える。today は 'YYYY-MM-DD'） */
export const satbaseKpiOf = (rows: Row[], today: string): SatbaseKpi => {
    const year = Number(today.slice(0, 4));
    const fyStart = `${Number(today.slice(5, 7)) >= 6 ? year : year - 1}-06-01`;
    let started = 0; let planned = 0; let building = 0; let selling = 0; let sellingNoAd = 0;
    for (const r of rows) {
        const spec = r.usage_type !== null && r.usage_type !== undefined && r.usage_type !== '' && Number(r.usage_type) === 0;
        const start = str(r.foundation_start_date).slice(0, 10);
        if (spec && str(r.sales_status) !== 'キャンセル' && start > '1970-01-01') {
            if (start >= fyStart && start <= today) started++;
            else if (start > today) planned++;
        }
        if (str(r.progress_status) === '建築中') building++;
        if (str(r.sales_status) === '販売中') {
            selling++;
            if (Number(r.ad_posted ?? 0) !== 1) sellingNoAd++;
        }
    }
    return { total: rows.length, started, planned, building, selling, sellingNoAd, fyStart };
};

/** 絞り込みの選択肢（⚠️ 絞り込む前の全部の物件から） */
export const satbaseOptionsOf = (rows: Row[]): SatbaseOptions => {
    const of = (key: string) => Array.from(new Set(rows.map((r) => str(r[key])).filter((v) => v !== ''))).sort();
    return { progress: of('progress_status'), sales: of('sales_status'), pref: of('prefecture'), team: of('team') };
};
