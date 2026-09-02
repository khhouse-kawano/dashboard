import apiClient from '../../utils/apiClient';

// ==========================================
// 💡 brokerage_listings への保存
// ==========================================

/** ID を発行する。source.html の uid() と同じ形式（英数字の文字列 ID。UUID ではない）。 */
export const newRecordId = (): string =>
    `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * brokerage_listings の1行を UPSERT する。
 *
 * 突合キーは `id`（UNIQUE 制約）。`id` が未登録なら INSERT、登録済みなら UPDATE。
 * `light: true` を送ることでサーバーは更新後の1行だけを返す（全件返却を避ける）。
 *
 * @param id     brokerage_listings.id
 * @param fields 更新したいカラムのみを含むオブジェクト。許可カラムは broker_update.php の
 *               $allowedColumns を参照（そこに無いキーはサーバー側で黙って捨てられる）。
 * @returns      更新後の行。失敗時は例外を投げるので、呼び出し側でロールバックすること。
 */
export const saveBrokerageRecord = async (
    id: string,
    fields: Record<string, unknown>
): Promise<Record<string, any> | null> => {
    const response = await apiClient.post('', {
        request: 'broker',
        roll: 'update',
        light: true,
        id,
        data: fields,
    });
    if (response.data?.status === 'error') {
        throw new Error(response.data?.message ?? '更新に失敗しました');
    }
    return response.data?.row ?? null;
};

/**
 * \u8ad6\u7406\u524a\u9664\u3059\u308b\u3002\u884c\u305d\u306e\u3082\u306e\u306f DB \u306b\u6b8b\u3057\u3001show_dashboard = 0 \u3067\u4e00\u89a7\u304b\u3089\u96a0\u3059\u3002
 * \u8ab0\u304c\u3044\u3064\u6d88\u3057\u305f\u304b\u5206\u304b\u3089\u306a\u3044\u3068\u5fa9\u65e7\u306e\u5224\u65ad\u304c\u3067\u304d\u306a\u3044\u305f\u3081\u3001\u5b9f\u884c\u8005\u3068\u65e5\u6642\u3082\u6b8b\u3059\u3002
 */
export const softDeleteRecord = async (id: string, by: string): Promise<void> => {
    await saveBrokerageRecord(id, {
        show_dashboard: 0,
        deleted_at: nowDateTime(),
        deleted_by: by || '\u4e0d\u660e',
    });
};

/** \u8ad6\u7406\u524a\u9664\u3055\u308c\u305f\u884c\u304b\u3069\u3046\u304b\u3002\u4e00\u89a7\u306e\u7d5e\u308a\u8fbc\u307f\u306b\u4f7f\u3046\u3002 */
export const isSoftDeleted = (row: { show_dashboard?: unknown }): boolean =>
    Number(row?.show_dashboard) === 0;

// ==========================================
// \ud83d\udca1 \u76e3\u67fb\u30ed\u30b0\uff08kind:'logs'\uff09\u3068\u901a\u77e5\uff08kind:'notices'\uff09
//    source.html \u306e logChange() / notify() / onStaffChanged() \u76f8\u5f53
// ==========================================

/** \u5909\u66f4\u5c65\u6b74\u30fb\u901a\u77e5\u304c\u6307\u3059\u5bfe\u8c61\u306e\u7a2e\u5225 */
export type LogEntity = 'lead' | 'buy' | 'deal' | 'ledger' | 'resale';

export type LogChangeInput = {
    entity: LogEntity;
    entityId: string;
    /** \u7ba1\u7406\u756a\u53f7\u3002\u7121\u3044\u7a2e\u5225\uff08leads / buyLeads\uff09\u3067\u306f null */
    entityNo?: number | null;
    /** \u4e00\u89a7\u3067\u5bfe\u8c61\u3092\u7279\u5b9a\u3067\u304d\u308b\u540d\u524d\uff08\u58f2\u4e3b\u540d\u30fb\u7269\u4ef6\u540d\u306a\u3069\uff09 */
    label: string;
    field: string;
    from: unknown;
    to: unknown;
    by: string;
    note?: string;
};

export type NoticeType = 'assign' | 'unassign' | 'cobroker' | 'info';

export type NotifyInput = {
    /** \u901a\u77e5\u5148\u306e\u62c5\u5f53\u8005\u540d */
    to: string;
    type: NoticeType;
    title: string;
    body: string;
    entity: LogEntity;
    entityId: string;
    by: string;
};

/** 'YYYY-MM-DD HH:mm:ss'\u3002DB \u306e DATETIME \u306b\u305d\u306e\u307e\u307e\u5165\u308b\u5f62\u5f0f\u3002 */
export const nowDateTime = (): string => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/** 'YYYY-MM-DDTHH:mm:ss'\u3002logs / notices \u306e `at` \u306b\u5165\u308c\u308b ISO \u5f62\u5f0f\uff08source.html \u3068\u540c\u3058\uff09\u3002 */
const nowIso = (): string => nowDateTime().replace(' ', 'T');

/** \u30ed\u30b0\u30fb\u901a\u77e5\u306e\u672c\u6587\u7528\u306b\u5024\u3092\u6587\u5b57\u5217\u5316\u3059\u308b\uff08null/undefined \u306f\u7a7a\u6587\u5b57\u3001\u914d\u5217\u3084\u30aa\u30d6\u30b8\u30a7\u30af\u30c8\u306f JSON\uff09\u3002 */
const asText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

/**
 * \u5909\u66f4\u5c65\u6b74\u30921\u4ef6\u8a18\u9332\u3059\u308b\uff08kind:'logs'\uff09\u3002
 *
 * \u30ed\u30b0\u306e\u8a18\u9332\u306b\u5931\u6557\u3057\u3066\u3082\u672c\u4f53\u306e\u66f4\u65b0\u306f\u6210\u7acb\u3055\u305b\u305f\u3044\u306e\u3067\u3001\u4f8b\u5916\u306f\u6295\u3052\u305a\u306b\u63e1\u3089\u305a
 * console.error \u306b\u6b8b\u3059\u3060\u3051\u306b\u3057\u3066\u3044\u308b\uff08\u547c\u3073\u51fa\u3057\u5074\u306b\u5931\u6557\u3092\u4f1d\u64ad\u3055\u305b\u306a\u3044\uff09\u3002
 */
export const logChange = async (input: LogChangeInput): Promise<void> => {
    const id = newRecordId();
    try {
        await saveBrokerageRecord(id, {
            kind: 'logs',
            at: nowIso(),
            by: input.by || '\u4e0d\u660e',
            entity: input.entity,
            entityId: input.entityId,
            entityNo: input.entityNo ?? null,
            label: input.label ?? '',
            field: input.field,
            from: asText(input.from),
            to: asText(input.to),
            note: input.note ?? '',
            show_dashboard: 1,
        });
    } catch (e) {
        console.error('[logChange] \u5909\u66f4\u5c65\u6b74\u306e\u8a18\u9332\u306b\u5931\u6557\u3057\u307e\u3057\u305f', input, e);
    }
};

/**
 * \u901a\u77e5\u30921\u4ef6\u8a18\u9332\u3059\u308b\uff08kind:'notices'\uff09\u3002
 * logChange \u3068\u540c\u69d8\u3001\u5931\u6557\u3057\u3066\u3082\u672c\u4f53\u306e\u66f4\u65b0\u306f\u5dfb\u304d\u623b\u3055\u306a\u3044\u3002
 */
export const notify = async (input: NotifyInput): Promise<void> => {
    const id = newRecordId();
    try {
        await saveBrokerageRecord(id, {
            kind: 'notices',
            at: nowIso(),
            by: input.by || '\u4e0d\u660e',
            to: input.to,
            type: input.type,
            title: input.title,
            body: input.body,
            entity: input.entity,
            entityId: input.entityId,
            read: 0,
            show_dashboard: 1,
        });
    } catch (e) {
        console.error('[notify] \u901a\u77e5\u306e\u8a18\u9332\u306b\u5931\u6557\u3057\u307e\u3057\u305f', input, e);
    }
};

// ==========================================
// \ud83d\udca1 \u76e3\u67fb\u30ed\u30b0\u30fb\u901a\u77e5\u306e\u53c2\u7167\uff08activity \u30cf\u30f3\u30c9\u30e9\uff09
//    logs / notices \u306f\u5897\u3048\u7d9a\u3051\u308b\u305f\u3081\u3001planner \u306e\u5168\u4ef6\u8fd4\u5374\u306b\u306f\u76f8\u4e57\u308a\u3055\u305b\u305a
//    entityId \u3084\u901a\u77e5\u5148\u3067\u7d5e\u308a\u8fbc\u3080\u5c02\u7528\u30a8\u30f3\u30c9\u30dd\u30a4\u30f3\u30c8\u304b\u3089\u53d6\u5f97\u3059\u308b\u3002
// ==========================================

/** \u5909\u66f4\u5c65\u6b74\u306e1\u884c\uff08activity_history.php \u306e\u623b\u308a\u5024\uff09 */
export type HistoryRow = {
    id: string;
    at: string | null;
    by: string | null;
    entity: string | null;
    entityId: string | null;
    entityNo: number | null;
    label: string | null;
    field: string | null;
    from: string | null;
    to: string | null;
    note: string | null;
};

/** \u901a\u77e5\u306e1\u884c\uff08activity_notice.php \u306e\u623b\u308a\u5024\uff09 */
export type NoticeRow = {
    id: string;
    at: string | null;
    by: string | null;
    to: string | null;
    type: NoticeType | null;
    title: string | null;
    body: string | null;
    entity: string | null;
    entityId: string | null;
    /** MariaDB \u306e tinyint \u306f\u6587\u5b57\u5217\u3067\u8fd4\u308b\u3053\u3068\u304c\u3042\u308b\u305f\u3081 number|string \u306e\u4e21\u65b9\u3092\u8a31\u5bb9 */
    read: number | string | null;
};

/** \u901a\u77e5\u304c\u672a\u8aad\u304b\u3069\u3046\u304b\u3002`read` \u304c NULL \u306e\u53e4\u3044\u884c\u3082\u672a\u8aad\u3068\u3057\u3066\u6271\u3046\u3002 */
export const isUnread = (notice: Pick<NoticeRow, 'read'>): boolean =>
    notice.read === null || notice.read === undefined || Number(notice.read) === 0;

/**
 * 1\u4ef6\u306e\u6848\u4ef6\u306b\u7d10\u3065\u304f\u5909\u66f4\u5c65\u6b74\u3092\u65b0\u3057\u3044\u9806\u306b\u53d6\u5f97\u3059\u308b\u3002
 * @param entityId brokerage_listings.id\u3002\u7701\u7565\u3059\u308b\u3068\u5168\u4f53\u306e\u6700\u65b0\u5c65\u6b74\u3002
 */
export const fetchHistory = async (entityId?: string, limit = 50): Promise<HistoryRow[]> => {
    const response = await apiClient.post('', {
        request: 'activity',
        roll: 'history',
        entityId: entityId ?? null,
        limit,
    });
    if (response.data?.status === 'error') {
        throw new Error(response.data?.message ?? '\u5c65\u6b74\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f');
    }
    return response.data?.history ?? [];
};

/** \u30ed\u30b0\u30a4\u30f3\u4e2d\u306e\u62c5\u5f53\u8005\u5b9b\u306e\u901a\u77e5\u3068\u3001\u672a\u8aad\u4ef6\u6570\u3092\u53d6\u5f97\u3059\u308b\u3002 */
export const fetchNotices = async (
    to: string,
    options: { unreadOnly?: boolean; limit?: number } = {}
): Promise<{ notices: NoticeRow[]; unread: number }> => {
    const response = await apiClient.post('', {
        request: 'activity',
        roll: 'notice',
        to,
        unreadOnly: options.unreadOnly ?? false,
        limit: options.limit ?? 50,
    });
    if (response.data?.status === 'error') {
        throw new Error(response.data?.message ?? '\u901a\u77e5\u306e\u53d6\u5f97\u306b\u5931\u6557\u3057\u307e\u3057\u305f');
    }
    return { notices: response.data?.notices ?? [], unread: response.data?.unread ?? 0 };
};

/**
 * \u901a\u77e5\u3092\u65e2\u8aad\u306b\u3059\u308b\u3002
 * `ids` \u3092\u6e21\u305b\u3070\u305d\u306e\u901a\u77e5\u3060\u3051\u3001`all: true` \u306a\u3089\u8a72\u5f53\u62c5\u5f53\u8005\u306e\u672a\u8aad\u3092\u3059\u3079\u3066\u65e2\u8aad\u306b\u3059\u308b\u3002
 * @returns \u66f4\u65b0\u5f8c\u306e\u672a\u8aad\u4ef6\u6570
 */
export const markNoticesRead = async (
    to: string,
    params: { ids?: string[]; all?: boolean }
): Promise<number> => {
    const response = await apiClient.post('', {
        request: 'activity',
        roll: 'read',
        to,
        ids: params.ids ?? null,
        all: params.all ?? false,
    });
    if (response.data?.status === 'error') {
        throw new Error(response.data?.message ?? '\u65e2\u8aad\u51e6\u7406\u306b\u5931\u6557\u3057\u307e\u3057\u305f');
    }
    return response.data?.unread ?? 0;
};

/**
 * \u5909\u66f4\u5c65\u6b74\u306b\u6b8b\u3059\u30d5\u30a3\u30fc\u30eb\u30c9\u3068\u3001\u305d\u306e\u65e5\u672c\u8a9e\u8868\u793a\u540d\u3002
 * \u3053\u3053\u306b\u7121\u3044\u30d5\u30a3\u30fc\u30eb\u30c9\u306f\u8a18\u9332\u3055\u308c\u306a\u3044\uff08\u30e1\u30e2\u306e1\u6587\u5b57\u4fee\u6b63\u307e\u3067\u6b8b\u3059\u3068\u5c65\u6b74\u304c\u57cb\u3082\u308c\u308b\u305f\u3081\u3001
 * \u55b6\u696d\u5224\u65ad\u306b\u5f71\u97ff\u3059\u308b\u9805\u76ee\u3060\u3051\u306b\u7d5e\u3063\u3066\u3044\u308b\uff09\u3002
 */
export const LOGGED_FIELDS: Record<string, string> = {
    staff: '\u62c5\u5f53',
    subStaff: '\u5354\u540c\u62c5\u5f53',
    phase: '\u30d5\u30a7\u30fc\u30ba',
    status: '\u30b9\u30c6\u30fc\u30bf\u30b9',
    price: '\u4fa1\u683c',
    budget: '\u4e88\u7b97',
    fee: '\u4ef2\u4ecb\u624b\u6570\u6599',
    category: '\u7269\u4ef6\u533a\u5206',
    source: '\u53cd\u97ff\u5143',
    portal: '\u30dd\u30fc\u30bf\u30eb',
    baikaiType: '\u5a92\u4ecb\u7a2e\u5225',
    propStatus: '\u7269\u4ef6\u30b9\u30c6\u30fc\u30bf\u30b9',
    currentStatus: '\u73fe\u6cc1',
    endReason: '\u8ffd\u5ba2\u7d42\u4e86\u7406\u7531',
    nextDate: '\u6b21\u56de\u9023\u7d61\u65e5',
    contractDate: '\u5951\u7d04\u65e5',
    settleDate: '\u6c7a\u6e08\u65e5',
    reinsDate: 'REINS\u767b\u9332\u65e5',
    lastReportDate: '\u6700\u7d42\u5831\u544a\u65e5',
    expiry: '\u5a92\u4ecb\u6709\u52b9\u671f\u9650',
    show_dashboard: '\u8868\u793a\u72b6\u614b',
};

/**
 * \u5909\u66f4\u524d\u5f8c\u3092\u7a81\u304d\u5408\u308f\u305b\u3001LOGGED_FIELDS \u306b\u542b\u307e\u308c\u308b\u5dee\u5206\u3060\u3051\u3092\u5c65\u6b74\u306b\u6b8b\u3059\u3002
 * \u62c5\u5f53\u304c\u5909\u308f\u3063\u305f\u5834\u5408\u306f\u3001\u65b0\u65e7\u306e\u62c5\u5f53\u8005\u305d\u308c\u305e\u308c\u306b\u901a\u77e5\u3082\u9001\u308b\u3002
 *
 * \u4fdd\u5b58\u6210\u529f\u5f8c\u306b\u547c\u3076\u3053\u3068\uff08\u4fdd\u5b58\u306b\u5931\u6557\u3057\u305f\u5909\u66f4\u3092\u5c65\u6b74\u306b\u6b8b\u3055\u306a\u3044\u305f\u3081\uff09\u3002
 */
export const recordFieldChanges = async (params: {
    entity: LogEntity;
    entityId: string;
    entityNo?: number | null;
    label: string;
    before: Record<string, any>;
    after: Record<string, any>;
    by: string;
}): Promise<void> => {
    const { entity, entityId, entityNo, label, before, after, by } = params;

    for (const [field, fieldLabel] of Object.entries(LOGGED_FIELDS)) {
        if (!(field in after)) continue;

        const from = asText(before?.[field]);
        const to = asText(after?.[field]);
        if (from === to) continue;

        await logChange({ entity, entityId, entityNo, label, field: fieldLabel, from, to, by });

        // \u62c5\u5f53\u5909\u66f4\u306f\u5f53\u4e8b\u8005\u306b\u5c4a\u304b\u306a\u3044\u3068\u610f\u5473\u304c\u306a\u3044\u306e\u3067\u901a\u77e5\u3082\u51fa\u3059
        if (field === 'staff') {
            if (to) {
                await notify({
                    to, type: 'assign', by, entity, entityId,
                    title: '\u6848\u4ef6\u304c\u5272\u308a\u5f53\u3066\u3089\u308c\u307e\u3057\u305f',
                    body: `\u300c${label}\u300d\u306e\u62c5\u5f53\u304c ${from || '\u672a\u8a2d\u5b9a'} \u304b\u3089 \u3042\u306a\u305f \u306b\u5909\u66f4\u3055\u308c\u307e\u3057\u305f\u3002`,
                });
            }
            if (from) {
                await notify({
                    to: from, type: 'unassign', by, entity, entityId,
                    title: '\u62c5\u5f53\u304b\u3089\u5916\u308c\u307e\u3057\u305f',
                    body: `\u300c${label}\u300d\u306e\u62c5\u5f53\u304c \u3042\u306a\u305f \u304b\u3089 ${to || '\u672a\u8a2d\u5b9a'} \u306b\u5909\u66f4\u3055\u308c\u307e\u3057\u305f\u3002`,
                });
            }
        }
    }
};

export const removeSpaces = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.replace(/[\s\u3000]+/g, '');
};

export const safeParse = (data: any) => {
    if (typeof data !== 'string' || data.trim() === '') return data ?? [];
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error("JSONの解析に失敗しました。不正なデータです:", data);
        return [];
    }
};

// ==========================================
// 💡 次回アクション必須化・追客終了理由（source.html の NEXT_QUICK / LEAD_ENDS / BUY_ENDS 相当）
// ==========================================
export const NEXT_QUICK: { label: string; days: number }[] = [
    { label: '明日', days: 1 },
    { label: '3日後', days: 3 },
    { label: '1週間後', days: 7 },
    { label: '2週間後', days: 14 },
    { label: '1ヶ月後', days: 30 },
];

export const addDaysISO = (base: string | null | undefined, days: number): string => {
    const d = base ? new Date(`${base}T00:00:00`) : new Date();
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export const LEAD_END_REASONS = ['成約', '辞退・売側中止', '連絡不通', '対象外', 'その他'];
export const BUY_END_REASONS = ['成約', '購入見送り', '連絡不能', '対象外', 'その他'];