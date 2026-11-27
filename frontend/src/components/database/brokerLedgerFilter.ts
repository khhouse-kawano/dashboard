/**
 * v2.2.308 媒介獲得台帳（DatabaseBroker.tsx）の絞り込みと並べ替え。
 *
 * ⚠️ ふだんは ② の broker_ledger_list（GET）が絞って30件ずつ返す。これは ② に届かないとき（今までの POST の broker:list＝全件）に画面で使う。
 * ⚠️⚠️ ② の backend-express/src/features/realty/ledgerList.ts と同じ式にしてある。片方だけ直さない。
 */

export type LedgerSortKey = 'displayName' | 'displayAddress' | 'displayPrice' | 'phase' | 'staff' | 'date' | 'medium' | 'updated_at';
export const LEDGER_SORT_KEYS: LedgerSortKey[] = ['displayName', 'displayAddress', 'displayPrice', 'phase', 'staff', 'date', 'medium', 'updated_at'];

/** 絞り込みの条件（⚠️ キーは ② に送るキー・URL のキーと同じ） */
export interface LedgerConditions {
    address: string;
    customer: string;
    staff: string;
    /** 物件種別。⚠️ category で送ると ② のゲートウェイの鍵とぶつかるので propCategory */
    propCategory: string;
    /** 物件ステータス（propStatus） */
    status: string;
    /** いえらぶの状態（linked・review・unmatched・none） */
    ielove: string;
}

type LedgerRow = Record<string, any>;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const sortValueOf = (r: LedgerRow, key: LedgerSortKey): string | number => {
    switch (key) {
        case 'displayName': return str(r.seller) || str(r.name) || str(r.customer);
        case 'displayAddress': return `${str(r.addr1)} ${str(r.addr2)} ${str(r.addr)}`.trim() || str(r.property) || str(r.targetProperty);
        case 'displayPrice': return Number(r.price) || Number(r.budget) || 0;
        // ⚠️ v2.2.245: 媒介契約日（contractDate）だけで並べる。空の行は新しい順のとき最後に来る
        case 'date': return str(r.contractDate);
        case 'phase': return str(r.phase) || str(r.currentStatus);
        case 'staff': return str(r.staff);
        case 'medium': return str(r.source);
        case 'updated_at': return str(r.updated_at);
        default: return '';
    }
};

export const filterAndSortLedgers = <T extends LedgerRow>(
    rows: T[], c: LedgerConditions, sortKey: LedgerSortKey, dir: 'asc' | 'desc', ieloveStateOf: (r: T) => string,
): T[] => {
    const address = c.address.toLowerCase();
    const customer = c.customer.toLowerCase();
    const filtered = rows.filter((r) => {
        const combinedAddress = `${str(r.addr1)} ${str(r.addr2)} ${str(r.addr)} ${str(r.property)} ${str(r.targetProperty)}`.toLowerCase();
        const combinedCustomer = `${str(r.seller)} ${str(r.name)} ${str(r.customer)}`.toLowerCase();
        return (!address || combinedAddress.includes(address))
            && (!customer || combinedCustomer.includes(customer))
            && (!c.staff || r.staff === c.staff)
            && (!c.propCategory || r.category === c.propCategory)
            && (!c.status || r.propStatus === c.status)
            && (!c.ielove || ieloveStateOf(r) === c.ielove);
    });
    return filtered.sort((a, b) => {
        const av = sortValueOf(a, sortKey);
        const bv = sortValueOf(b, sortKey);
        if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av;
        if (av < bv) return dir === 'asc' ? -1 : 1;
        if (av > bv) return dir === 'asc' ? 1 : -1;
        return 0;
    });
};
