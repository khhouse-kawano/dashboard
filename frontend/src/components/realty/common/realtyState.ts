/**
 * 不動産企画係の設定・週次行動計画・コンプライアンス（v2.2.223）の読み書きと、画面どうしで使う集計。
 *
 * ⚠️ 保存先は app_state（② の features/realty/state.ts）。形は本番アプリ（khf-eigyokanri.netlify.app。V18）と同じ。
 * ⚠️ 書き込みは**項目ごと**（設定は項目単位・週次はセル単位・コンプライアンスは1か所ずつ）。
 *   同時に別の人が別の項目を直しても消し合わない。
 */
import apiClient from '../../../utils/apiClient';
import { callsOf, prevMonth } from '../summary/kpi';
import type { Row, Settings, StaffSetting } from '../summary/kpi';

export type Template = { id: string; title: string; body: string };

export type Company = {
    name: string; rep: string; dept: string; addr: string; tel: string; fax: string;
    license: string; assoc: string; agent: string; agentNo: string;
};

/** 設定のうち、設定画面で直す項目（⚠️ それ以外の項目も中にはあるが、ここでは触らない） */
export type RealtySettings = {
    fiscalStart?: string;
    staff?: StaffSetting[];
    sources?: string[];
    buyPortals?: string[];
    srcCosts?: Record<string, number>;
    portalCosts?: Record<string, number>;
    templates?: Template[];
    company?: Partial<Company>;
    /** 今日の架電キューの抽出ルール（v2.2.226。中身は callq/callqLogic.ts の CallqConf） */
    callq?: Record<string, unknown>;
    /** 今日の架電キューの一言目（v2.2.226。要件タグ → 文面） */
    callqScripts?: Record<string, string>;
};

/** 週次行動計画の1行（担当者 × 週）。g = 目標・a = 実績。c 架電・t 追客・n 内見・s 商談 */
export type WeeklyRow = {
    week: number; staff: string;
    cg: number; ca: number; tg: number; ta: number; ng: number; na: number; sg: number; sa: number;
};
export type WeeklyKey = Exclude<keyof WeeklyRow, 'week' | 'staff'>;

export type ComplianceItem = {
    id: string; no: number; item: string;
    staff: string; date: string; status: string; target: string; note: string;
};

export type RealtyState = {
    settings: RealtySettings;
    weekly: Record<string, WeeklyRow[]>;
    compliance: ComplianceItem[];
    /** 架電実績を数えるための売り反響（id・担当・架電記録だけ） */
    sellLeads: Row[];
    /** 確定済みの月の週次目標も直せる（マスター・マネージャー） */
    isWeeklyAdmin: boolean;
    /** 日本時間の今日（② の時計） */
    today: string;
};

/** ② が返す本文。⚠️ 失敗のときは status = 'error' と message */
export type ApiBody = { status?: string; message?: string; [key: string]: unknown };

/** request = planner の roll を呼ぶ。失敗のときは ② のメッセージを投げる（画面は alert で出す） */
export const post = async (roll: string, body: Record<string, unknown> = {}): Promise<ApiBody> => {
    try {
        const res = await apiClient.post<ApiBody>('', { request: 'planner', roll, ...body });
        if (res.data?.status === 'error') throw new Error(res.data.message || '保存に失敗しました');
        return res.data;
    } catch (e: unknown) {
        const message = (e as { response?: { data?: ApiBody } })?.response?.data?.message;
        if (message) throw new Error(message);
        throw e instanceof Error ? e : new Error('通信エラーが発生しました');
    }
};

export const loadRealtyState = async (): Promise<RealtyState> => {
    const d = await post('state');
    return {
        settings: (d.settings as RealtySettings) ?? {},
        weekly: (d.weekly as Record<string, WeeklyRow[]>) ?? {},
        compliance: (d.compliance as ComplianceItem[]) ?? [],
        sellLeads: (d.sellLeads as Row[]) ?? [],
        isWeeklyAdmin: d.isWeeklyAdmin === true,
        today: typeof d.today === 'string' ? d.today : '',
    };
};

export type RecordKind = 'deals' | 'ledger' | 'renewals' | 'leads' | 'buyLeads' | 'docs' | 'settlements' | 'resales'
    | 'logs' | 'notices' | 'sellerReports' | 'viewings' | 'comments';

/**
 * 種類を指定して行と設定を読む（② の planner:records。v2.2.225）。以前のアプリから移す画面用。
 * ⚠️ 削除済み（show_dashboard = 0）は入っていない。⚠️ 日付は 'YYYY-MM-DD'、callDates などは JSON 文字列のまま（kpi.ts の callsOf で読む）
 */
export const loadRecords = async <K extends RecordKind>(kinds: K[]): Promise<{ records: Record<K, Row[]>; settings: RealtySettings & Settings }> => {
    const d = await post('records', { kinds });
    return { records: (d.records ?? {}) as Record<K, Row[]>, settings: (d.settings ?? {}) as RealtySettings & Settings };
};

/** 設定の項目を保存して、保存後の設定全体を返す */
export const saveRealtySettings = async (patch: Partial<RealtySettings>): Promise<RealtySettings> =>
    ((await post('settings', { patch })).settings as RealtySettings) ?? {};

export type WeeklyCell = { week: number; staff: string; key: WeeklyKey; value: number };

/** 週次行動計画のセルを保存して、その月の行を返す */
export const saveWeeklyCells = async (month: string, cells: WeeklyCell[]): Promise<WeeklyRow[]> =>
    ((await post('weekly', { month, cells })).rows as WeeklyRow[]) ?? [];

export const saveCompliance = async (body: { id: string; field: keyof ComplianceItem; value: string } | { reset: true }): Promise<ComplianceItem[]> =>
    ((await post('compliance', body)).compliance as ComplianceItem[]) ?? [];

/** 本番アプリの uid()（設定の担当者・テンプレートの id） */
export const newId = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------------------------------------------------------------------------
// 週次行動計画
// ---------------------------------------------------------------------------

/** 列（本番アプリの WCOLS）: [目標, 実績, 見出し] */
export const WCOLS: [WeeklyKey, WeeklyKey, string][] = [['cg', 'ca', '架電'], ['tg', 'ta', '追客'], ['ng', 'na', '内見'], ['sg', 'sa', '商談']];
export const GOAL_KEYS: WeeklyKey[] = WCOLS.map(c => c[0]);

/** 前月より前の月は、翌月この日を過ぎると目標を直せない（LOCK_GRACE_DAY） */
export const LOCK_GRACE_DAY = 5;

/** 目標を誰でも直せる月か（wOpenMonth）。⚠️ 判定は ② も同じことをする */
export const isOpenMonth = (mk: string, today: string): boolean => {
    const cur = today.slice(0, 7);
    if (mk >= cur) return true;
    return mk === prevMonth(cur) && Number(today.slice(8, 10)) <= LOCK_GRACE_DAY;
};

/** 1〜7日=第1週、8〜14日=第2週、15〜21日=第3週、22日〜月末=第4週（weekOfMonth） */
export const weekOfMonth = (ds: string): number => {
    const d = Number(ds.slice(8, 10)) || 0;
    return d ? Math.min(4, Math.ceil(d / 7)) : 0;
};

/**
 * 売り反響の📞架電を、担当者 × 週で数える（weeklySellCalls）。
 * ⚠️ LINE・メールと買い反響は入れない。⚠️ 数えるのは「架電した人」（記録の staff。無ければ反響の担当）
 */
export const weeklySellCalls = (sellLeads: Row[], mk: string): Record<string, Record<number, number>> => {
    const out: Record<string, Record<number, number>> = {};
    for (const l of sellLeads) {
        for (const c of callsOf(l)) {
            const obj = typeof c === 'object' && c !== null ? c : null;
            const type = obj ? String(obj.type ?? '') : '';
            if (type === 'line' || type === 'mail') continue;
            const day = (obj ? String(obj.date ?? '') : String(c)).slice(0, 10);
            if (day.slice(0, 7) !== mk) continue;
            const w = weekOfMonth(day);
            if (!w) continue;
            const nm = (obj ? String(obj.staff ?? '') : '') || String(l.staff ?? '');
            if (!nm) continue;
            const o = (out[nm] = out[nm] ?? { 1: 0, 2: 0, 3: 0, 4: 0 });
            o[w]++;
        }
    }
    return out;
};

const emptyRow = (week: number, staff: string): WeeklyRow =>
    ({ week, staff, cg: 0, ca: 0, tg: 0, ta: 0, ng: 0, na: 0, sg: 0, sa: 0 });

/** 設定の担当者 × 第1〜4週がそろうように足し、架電実績を数え直した行（ensureWeekly + syncWeeklyCalls） */
export const weeklyRowsOf = (saved: WeeklyRow[] | undefined, names: string[], calls: Record<string, Record<number, number>>): WeeklyRow[] => {
    const rows = (saved ?? []).map(r => ({ ...r }));
    for (let w = 1; w <= 4; w++) {
        for (const s of names) {
            if (!rows.some(r => r.week === w && r.staff === s)) rows.push(emptyRow(w, s));
        }
    }
    for (const r of rows) r.ca = calls[r.staff]?.[r.week] ?? 0;
    return rows;
};

/** 達成率の色（wRateCls）: 100%以上・80%以上・80%未満。目標が無ければ色を付けない */
export const rateClass = (actual: number, goal: number): '' | 'ok' | 'mid' | 'bad' => {
    if (!(goal > 0)) return '';
    const p = actual / goal;
    return p >= 1 ? 'ok' : p >= 0.8 ? 'mid' : 'bad';
};

export const rateTitle = (actual: number, goal: number): string =>
    goal > 0 ? `達成率 ${Math.round((actual / goal) * 100)}%` : '目標未設定';

/** 項目ごとの達成率（上限 200%）の平均。目標の無い項目は除く */
export const rateAverage = (pairs: [number, number][]): number | null => {
    const rates = pairs.filter(([, g]) => g > 0).map(([a, g]) => Math.min(2, a / g));
    return rates.length ? rates.reduce((x, y) => x + y, 0) / rates.length : null;
};

// ---------------------------------------------------------------------------
// 共通の見た目（⚠️ 接頭辞 rlt- で共通 CSS を汚さない。チームサマリーと同じ色・文字サイズ）
// ---------------------------------------------------------------------------

export const REALTY_CSS = `
.rlt-page { padding: 4px 8px 24px; }
.rlt-head h1 { font-size: 14px; font-weight: bold; color: #495057; margin: 0; }
.rlt-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; margin-bottom: 14px; }
.rlt-sub { font-size: 11px; color: #6c757d; margin: 0; }
.rlt-card { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,.05); margin-bottom: 16px; }
.rlt-card-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; padding: 12px 16px 8px; }
.rlt-card-head h3 { font-size: 13px; font-weight: bold; color: #343a40; margin: 0; }
.rlt-note { font-size: 11px; color: #6c757d; }
.rlt-body { padding: 4px 16px 14px; font-size: 12px; }
.rlt-tblwrap { overflow-x: auto; }
.rlt-tbl { border-collapse: collapse; width: 100%; font-size: 11px; }
.rlt-tbl th { position: sticky; top: 0; background: #f8f9fa; color: #495057; font-weight: bold; padding: 6px 8px; border-bottom: 1px solid #dee2e6; white-space: nowrap; z-index: 1; }
.rlt-tbl td { padding: 4px 8px; border-bottom: 1px solid #dee2e6; vertical-align: middle; }
.rlt-tbl .r { text-align: right; }
.rlt-tbl tr.total td { font-weight: bold; background: #f1f3f5; }
.rlt-input { font-size: 12px; padding: 3px 6px; border: 1px solid #ced4da; border-radius: 4px; background: #fff; }
.rlt-input:focus { outline: 2px solid #0d6efd33; border-color: #0d6efd; }
.rlt-btn { font-size: 11px; font-weight: bold; border-radius: 4px; padding: 3px 12px; border: 1px solid #0d6efd; background: #0d6efd; color: #fff; cursor: pointer; }
.rlt-btn.sec { background: #fff; color: #0d6efd; }
.rlt-btn.danger { background: #fff; color: #dc3545; border-color: #dc3545; }
.rlt-btn:disabled { opacity: .5; cursor: not-allowed; }
.rlt-icon { border: none; background: transparent; color: #6c757d; cursor: pointer; padding: 0 4px; }
.rlt-icon:hover { color: #dc3545; }
.rlt-chip { display: inline-flex; align-items: center; gap: 2px; background: #e7f1ff; color: #0a58ca; border-radius: 12px; padding: 2px 4px 2px 10px; font-size: 11px; }
.rlt-alert { border-radius: 6px; padding: 8px 12px; font-size: 11px; margin-bottom: 12px; border: 1px solid #ffe69c; background: #fff8e1; color: #664d03; }
.rlt-saved { font-size: 11px; color: #198754; }
.rlt-ok { background: #d1e7dd !important; }
.rlt-mid { background: #fff3cd !important; }
.rlt-bad { background: #f8d7da !important; }
`;
