/**
 * 媒介獲得台帳の期限（v2.2.249 新規。連動トリガー仕様書 ②「自動で計算する期限」。docs/realty-trigger-spec.md の「3」）。
 *
 * ─────────────────────────────────────────────
 *   期限           専属専任媒介                       専任媒介                           一般媒介
 *   レインズ登録   契約日の翌日から5営業日目まで     契約日の翌日から7営業日目まで     対象外
 *   販売報告       初回は契約日から7日。2回目からは直近の報告日から7日 ／ 専任は14日     対象外
 *   有効期間の満了 満了日の14日前から警告（一般も）
 * ─────────────────────────────────────────────
 *
 * ⚠️ 営業日は、設定の休業日（settings.holidays。定休の曜日と個別の日付）を数えない日（設定画面の「休業日」カード）。
 * ⚠️ 満了日は台帳の expiry（v2.2.248 の媒介紐付から入る）。空の台帳（それより前に作ったもの）は「契約日の3か月後の前日」で計算する。
 * ⚠️ 日付は 'YYYY-MM-DD' の文字列で扱う（時刻帯に左右されないよう、計算は UTC の日付で行う）。
 */

export type Holidays = { weekdays: number[]; dates: string[] };

/** 休業日の初期値（2026-11-05 利用者の回答：定休は火・水） */
export const DEFAULT_HOLIDAYS: Holidays = { weekdays: [2, 3], dates: [] };

/** 設定の値を読む。⚠️ 未設定・形が違うときは初期値 */
export const holidaysOf = (raw: unknown): Holidays => {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_HOLIDAYS;
    const r = raw as Record<string, unknown>;
    const weekdays = Array.isArray(r.weekdays) ? r.weekdays.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6) : DEFAULT_HOLIDAYS.weekdays;
    const dates = Array.isArray(r.dates) ? r.dates.map(String).filter(isIso) : [];
    return { weekdays, dates };
};

const isIso = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** 台帳の日付（'YYYY-MM-DD'・'YYYY/MM/DD'・日時つき）を 'YYYY-MM-DD' に。読めなければ '' */
export const isoOf = (v: unknown): string => {
    const s = String(v ?? '').slice(0, 10).replace(/\//g, '-');
    return isIso(s) && !s.startsWith('0000') ? s : '';
};

const toUtc = (iso: string): Date => new Date(`${iso}T00:00:00Z`);
const fromUtc = (d: Date): string => d.toISOString().slice(0, 10);

export const addDaysIso = (iso: string, n: number): string => {
    const d = toUtc(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return fromUtc(d);
};

/** a から b まで何日か（b − a） */
export const daysBetween = (a: string, b: string): number => Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86400000);

export const isHoliday = (iso: string, h: Holidays): boolean =>
    h.weekdays.includes(toUtc(iso).getUTCDay()) || h.dates.includes(iso);

/**
 * 契約日の翌日から数えて n 営業日目（休業日を数えない）。
 * ⚠️ 休業日が続いても止まらないよう、最大 n × 7 + 31 日で打ち切る（すべての曜日を定休にはできない。② の state.ts で止めている）
 */
export const addBusinessDays = (iso: string, n: number, h: Holidays): string => {
    let d = iso;
    let count = 0;
    for (let i = 0; i < n * 7 + 31 && count < n; i++) {
        d = addDaysIso(d, 1);
        if (!isHoliday(d, h)) count++;
    }
    return d;
};

/** 専任・専属専任の有効期間の上限＝契約日の3か月後の前日（3か月後に同じ日が無ければ、その月の末日。common/leadLinks.ts の maxExpiryOf と同じ） */
const threeMonthsLess1 = (iso: string): string => {
    const [y, m, d] = iso.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m - 1 + 3 + 1, 0)).getUTCDate();
    if (d > lastDay) return fromUtc(new Date(Date.UTC(y, m - 1 + 3, lastDay)));
    return fromUtc(new Date(Date.UTC(y, m - 1 + 3, d - 1)));
};

const REINS_DAYS: Record<string, number> = { 専属専任媒介: 5, 専任媒介: 7 };
const REPORT_DAYS: Record<string, number> = { 専属専任媒介: 7, 専任媒介: 14 };

export type LedgerLike = {
    baikaiType?: string | null; contractDate?: string | null; expiry?: string | null;
    reinsDate?: string | null; lastReportDate?: string | null; propStatus?: string | null;
};

/** 期限の表示の状態。ok = 余裕あり、soon = 近い（黄）、over = 過ぎた（赤）、done = 済み */
export type DeadlineState = 'ok' | 'soon' | 'over' | 'done';
export type Deadline = { date: string; state: DeadlineState; days: number };

const stateOf = (date: string, today: string, soonDays: number): Deadline => {
    const days = daysBetween(today, date);
    return { date, days, state: days < 0 ? 'over' : days <= soonDays ? 'soon' : 'ok' };
};

/** 期限を出さない台帳（媒介が終わった・成約した）か */
export const isClosedLedger = (l: LedgerLike): boolean => l.propStatus === '媒介終了' || l.propStatus === '成約完了';

/** レインズ登録の期限。⚠️ 一般媒介・契約日なし・期限を出さない台帳は null。登録済みは state = 'done' */
export const reinsDeadline = (l: LedgerLike, today: string, h: Holidays): Deadline | null => {
    const n = REINS_DAYS[String(l.baikaiType ?? '')];
    const c = isoOf(l.contractDate);
    if (!n || !c || isClosedLedger(l)) return null;
    const date = addBusinessDays(c, n, h);
    if (isoOf(l.reinsDate)) return { date, state: 'done', days: 0 };
    return stateOf(date, today, 2);
};

/** 次の販売報告の期限（初回は契約日から、2回目からは直近の報告日から）。⚠️ 一般媒介などは null */
export const reportDeadline = (l: LedgerLike, today: string): Deadline | null => {
    const n = REPORT_DAYS[String(l.baikaiType ?? '')];
    const c = isoOf(l.contractDate);
    if (!n || !c || isClosedLedger(l)) return null;
    const last = isoOf(l.lastReportDate);
    const base = last && last >= c ? last : c;
    return stateOf(addDaysIso(base, n), today, 2);
};

/** 有効期間の満了日（expiry、無ければ契約日の3か月後の前日）。満了日の14日前から soon。⚠️ 契約日も満了日も無ければ null */
export const expiryDeadline = (l: LedgerLike, today: string): Deadline | null => {
    if (isClosedLedger(l)) return null;
    const e = isoOf(l.expiry);
    const c = isoOf(l.contractDate);
    const date = e || (c ? threeMonthsLess1(c) : '');
    if (!date) return null;
    return stateOf(date, today, 14);
};

/** 一覧のバッジの文言（「11/12（あと3日）」「2日超過」） */
export const deadlineText = (d: Deadline): string => {
    const md = `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))}`;
    if (d.state === 'over') return `${md}（${-d.days}日超過）`;
    if (d.days === 0) return `${md}（今日）`;
    return `${md}（あと${d.days}日）`;
};

/** バッジの色（Bootstrap の class） */
export const deadlineClass = (s: DeadlineState): string =>
    s === 'over' ? 'bg-danger' : s === 'soon' ? 'bg-warning text-dark' : s === 'done' ? 'bg-success' : 'bg-light text-secondary border';
