/**
 * 今日の架電キューの抽出・集計（v2.2.226）。
 *
 * ⚠️ 移植元は以前のアプリ（khf-eigyokanri.netlify.app。V18）の V16（「📞 今日の架電キュー」）。
 *   抽出の順・要件タグ・一言目・接触確認率の数え方は**そのまま写している**（関数名の後ろの括弧は移植元の名前）。
 * ⚠️ 4つのボタンの書き込み（架電記録・フェーズ・次回連絡予定日）は ② の planner:call_mark（features/realty/calls.ts）。
 * ⚠️ 並び順は抽出した時点で固定する（作業中に行が動かないように）。並べ直すのは「🔄 再抽出」。
 *   以前のアプリと同じく、並びと「記録済」は画面を移っても残る（このモジュールの変数。再読み込みで消える）。
 */
import { callsOf, todayStr } from '../summary/kpi';
import type { Row } from '../summary/kpi';
import { weekOfMonth } from '../common/realtyState';
import type { WeeklyRow } from '../common/realtyState';

export type LeadKind = 'leads' | 'buyLeads';

/** 架電の結果（CQ_OUT）。contact = 相手の状況を確認できた（断られた場合も含めてプラス計上） */
export const CQ_OUT = {
    abs: { icon: '📵', label: '不在', contact: false },
    talk: { icon: '🗣', label: '通電・継続', contact: true },
    apo: { icon: '📅', label: 'アポ獲得', contact: true },
    end: { icon: '✅', label: '終了確定', contact: true },
} as const;
export type Outcome = keyof typeof CQ_OUT;

/** 抽出ルールの既定値（CQ_DEFAULTS） */
export type CallqConf = { size: number; staleSell: number; staleBuy: number; dailyDivisor: number; includeBuy: boolean };
const CQ_DEFAULTS = (): CallqConf => ({ size: 10, staleSell: 14, staleBuy: 10, dailyDivisor: 5, includeBuy: true });

/** 一言目のスクリプト（CQ_SCRIPTS）。{{name}}{{staff}}{{addr}}{{property}}{{company}}{{next}} が差し込まれる */
export type CallqScripts = Record<TagKey, string>;
export const CQ_SCRIPTS = (): CallqScripts => ({
    first: '{{name}}様のお電話でお間違いないでしょうか。{{company}}の{{staff}}と申します。\nこのたびは{{addr}}のご査定のご依頼をいただき、ありがとうございます。\n1〜2分だけよろしいでしょうか。まずは今のご状況だけ確認させてください。',
    firstBuy: '{{name}}様のお電話でお間違いないでしょうか。{{company}}の{{staff}}と申します。\n{{property}}のお問合せをいただき、ありがとうございます。\n1〜2分だけよろしいでしょうか。ご希望の条件を先に確認させてください。',
    redial: '{{company}}の{{staff}}です。何度かお電話しており恐れ入ります。\n{{property}}の件でご連絡しました。今お時間よろしいでしょうか。',
    report: '{{company}}の{{staff}}です。先日お渡しした査定書はご覧いただけましたでしょうか。\n金額へのご感想だけでも伺えればと思いご連絡しました。',
    newprop: '{{company}}の{{staff}}です。ご希望に近い新着の物件が出ましたのでご連絡しました。\nまず資料だけお送りしてもよろしいでしょうか。',
    overdue: '{{company}}の{{staff}}です。前回「{{next}}」のお約束でご連絡しました。\nその後、ご状況にお変わりはございませんか。',
    long: '{{company}}の{{staff}}です。しばらくご連絡できておらず失礼しました。\n{{property}}の件、その後のご検討状況はいかがでしょうか。',
    ask: '{{company}}の{{staff}}です。その後のご状況を伺えればと思いご連絡しました。\n今もご検討は続いていらっしゃいますか。',
});

/** 設定の値を既定値で埋める（以前のアプリの起動時の補完） */
export const callqConf = (raw: unknown): CallqConf => ({ ...CQ_DEFAULTS(), ...(raw && typeof raw === 'object' ? raw as Partial<CallqConf> : {}) });
export const callqScripts = (raw: unknown): CallqScripts => {
    const out = CQ_SCRIPTS();
    if (raw && typeof raw === 'object') {
        for (const k of Object.keys(out) as TagKey[]) {
            const v = (raw as Record<string, unknown>)[k];
            if (typeof v === 'string') out[k] = v;
        }
    }
    return out;
};

/** 要件タグ（上にあるものほど優先。表示する一言目は最優先タグのもの）（TAGS） */
export const TAGS = [
    { k: 'first', lbl: '初回架電', cls: 'navy' },
    { k: 'firstBuy', lbl: '初回架電', cls: 'navy' },
    { k: 'redial', lbl: '不通つづき', cls: 'amber' },
    { k: 'report', lbl: '査定書フォロー', cls: 'navy' },
    { k: 'newprop', lbl: '新着物件あり', cls: 'green' },
    { k: 'overdue', lbl: '期日超過', cls: 'red' },
    { k: 'long', lbl: '長期未接触', cls: 'amber' },
    { k: 'ask', lbl: '状況うかがい', cls: 'gray' },
] as const;
export type TagKey = (typeof TAGS)[number]['k'];
export const TAGL = Object.fromEntries(TAGS.map(t => [t.k, t])) as Record<TagKey, (typeof TAGS)[number]>;

/** 追客の対象外（この画面には出さない）フェーズ（OFF） */
const OFF: Record<LeadKind, string[]> = { leads: ['媒介受託', '追客終了'], buyLeads: ['成約', '追客終了'] };

// ---------------------------------------------------------------------------
// 小物
// ---------------------------------------------------------------------------

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

type CallObj = { date?: string; type?: string; staff?: string; outcome?: string; memo?: string };
const obj = (c: unknown): CallObj | null => (typeof c === 'object' && c !== null ? c as CallObj : null);

/** 架電の日（callDay） */
const callDay = (c: unknown): string => (obj(c) ? str(obj(c)!.date) : str(c)).slice(0, 10);
/** 架電の種類（callType）。⚠️ 無い・知らない値は「架電」 */
export const callType = (c: unknown): 'call' | 'line' | 'mail' => {
    const t = str(obj(c)?.type);
    return t === 'line' || t === 'mail' ? t : 'call';
};
/** 架電の結果（callOutcome）。⚠️ 4つ以外は「結果未記録」 */
export const callOutcome = (c: unknown): Outcome | '' => {
    const o = str(obj(c)?.outcome);
    return o in CQ_OUT ? o as Outcome : '';
};
/** 架電した人（callBy） */
const callBy = (c: unknown): string => str(obj(c)?.staff);

/** 📞架電だけ（calls） */
export const callsOnly = (l: Row): unknown[] => callsOf(l).filter(c => callType(c) === 'call');

/** 'YYYY-MM-DD' の差（日）（diffDays） */
export const diffDays = (a: string, b: string): number =>
    Math.round((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86400000);

/** 最後にふれた日（lastTouchDay）。⚠️ LINE・メールも含む */
const lastTouchDay = (l: Row): string => {
    const a = callsOf(l).map(callDay).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
    return a.length ? a[a.length - 1] : '';
};

/** 連続した不在の回数（absStreak） */
const absStreak = (l: Row): number => {
    const cs = callsOnly(l);
    let n = 0;
    for (let i = cs.length - 1; i >= 0; i--) {
        if (callOutcome(cs[i]) === 'abs') n++;
        else break;
    }
    return n;
};

/** 直近14日に媒介契約したアクティブ物件＝買い反響への「新着物件」ネタ（newListings） */
export const newListings = (ledger: Row[], t = todayStr()): Row[] =>
    ledger.filter(l => str(l.propStatus) === 'アクティブ' && l.contractDate && diffDays(t, str(l.contractDate).slice(0, 10)) <= 14);

/** 電話番号（telOf）。⚠️ 全角の数字・ハイフンも読む */
export const telOf = (l: Row): string => {
    const z = str(l.contact).replace(/[０-９－―ー−]/g, c => {
        const i = '０１２３４５６７８９'.indexOf(c);
        return i >= 0 ? String(i) : '-';
    });
    const m = z.match(/0\d[\d-]{7,}/);
    return m ? m[0] : '';
};

const isOff = (kind: LeadKind, l: Row): boolean => OFF[kind].includes(str(l.phase));

/** 名前の突き合わせ（空白を除く）。⚠️ ログイン名と設定の担当者名で空白の入り方が違うことがある */
export const sameName = (a: string, b: string): boolean => a.replace(/[\s　]/g, '') === b.replace(/[\s　]/g, '');

// ---------------------------------------------------------------------------
// 抽出（tagsOf / build）
// ---------------------------------------------------------------------------

export const tagsOf = (kind: LeadKind, l: Row, newProps: number, t = todayStr()): TagKey[] => {
    const out: TagKey[] = [];
    const nc = callsOnly(l).length;
    const last = lastTouchDay(l);
    const idle = last ? diffDays(t, last) : null;
    if (!nc) out.push(kind === 'leads' ? 'first' : 'firstBuy');
    if (absStreak(l) >= 2) out.push('redial');
    if (kind === 'leads' && str(l.phase) === '査定書提出') out.push('report');
    if (kind === 'buyLeads' && newProps > 0) out.push('newprop');
    const next = str(l.nextDate).slice(0, 10);
    if (next && next < t) out.push('overdue');
    if (idle !== null && idle >= 30) out.push('long');
    if (!out.length) out.push('ask');
    return TAGS.filter(x => out.includes(x.k)).map(x => x.k);
};

type Queue = { order: string[]; day: string; mine: boolean; done: Record<string, Outcome>; undo: UndoToken | null };
export type UndoToken = { kind: LeadKind; id: string; date: string; outcome: Outcome; before: Record<string, string> };

/** 画面を移っても残す状態（以前のアプリの ST） */
export const ST: Queue = { order: [], day: '', mine: true, done: {}, undo: null };

export const keyOf = (kind: LeadKind, id: unknown) => `${kind}:${str(id)}`;
export const splitKey = (key: string): { kind: LeadKind; id: string } => {
    const i = key.indexOf(':');
    return { kind: key.slice(0, i) as LeadKind, id: key.slice(i + 1) };
};

/**
 * 今日かける対象を並べる（build）。
 *   一度も架電していない → 3000＋経過日数（最優先）
 *   次回連絡予定日が今日以前 → 2000＋超過日数
 *   予定日が無く、売り14日・買い10日（設定）以上ふれていない → 1000＋経過日数
 * ⚠️ 今日すでにふれたものと、追客の対象外のフェーズは出さない
 */
export const build = (leads: Row[], buyLeads: Row[], conf: CallqConf, me: string, t = todayStr()): void => {
    const cand: { key: string; pri: number }[] = [];
    const scan = (kind: LeadKind, rows: Row[]) => {
        for (const l of rows) {
            if (isOff(kind, l)) continue;
            if (ST.mine && me && !sameName(str(l.staff), me)) continue;
            const last = lastTouchDay(l);
            if (last === t) continue;
            const base = last || str(l.receivedDate).slice(0, 10);
            const idle = base ? diffDays(t, base) : 999;
            const nc = callsOnly(l).length;
            const next = str(l.nextDate).slice(0, 10);
            let pri: number | null = null;
            if (!nc) pri = 3000 + Math.min(365, idle);
            else if (next && next <= t) pri = 2000 + Math.min(365, diffDays(t, next));
            else if (!next) {
                const th = kind === 'leads' ? Number(conf.staleSell) || 14 : Number(conf.staleBuy) || 10;
                if (idle >= th) pri = 1000 + Math.min(365, idle);
            }
            if (pri === null) continue;
            cand.push({ key: keyOf(kind, l.id), pri });
        }
    };
    scan('leads', leads);
    if (conf.includeBuy !== false) scan('buyLeads', buyLeads);
    cand.sort((a, b) => b.pri - a.pri);
    ST.order = cand.slice(0, Math.max(1, Number(conf.size) || 10)).map(x => x.key);
    ST.day = t;
    ST.done = {};
    ST.undo = null;
};

/** 架電ナビで記録したとき、キューに並んでいれば「記録済」にする（V16.setDone） */
export const setDone = (key: string, oc: Outcome): void => {
    if (ST.order.includes(key)) ST.done[key] = oc;
};

// ---------------------------------------------------------------------------
// 集計（接触確認率）（kpi）
// ---------------------------------------------------------------------------

export type ContactKpi = { calls: number; contact: number; known: number; abs: number; talk: number; apo: number; end: number; none: number; rate: number | null };

/**
 * 期間の📞架電を数える（kpi）。who が空ならチーム全体。
 * ⚠️ 数えるのは「架電した人」（記録の staff。無ければ反響の担当）。売り・買いの両方
 * ⚠️ 接触確認率 ＝ 結果を記録した架電のうち、相手の状況を確認できた割合（「結果未記録」は分母に入れない）
 */
export const contactKpi = (leads: Row[], buyLeads: Row[], who: string, from: string, to: string): ContactKpi => {
    const o: ContactKpi = { calls: 0, contact: 0, known: 0, abs: 0, talk: 0, apo: 0, end: 0, none: 0, rate: null };
    for (const rows of [leads, buyLeads]) {
        for (const l of rows) {
            for (const c of callsOf(l)) {
                if (callType(c) !== 'call') continue;
                const d = callDay(c);
                if (!d || d < from || d > to) continue;
                if (who && !sameName(callBy(c) || str(l.staff), who)) continue;
                o.calls++;
                const oc = callOutcome(c);
                if (!oc) { o.none++; continue; }
                o.known++;
                o[oc]++;
                if (CQ_OUT[oc].contact) o.contact++;
            }
        }
    }
    o.rate = o.known ? o.contact / o.known : null;
    return o;
};

/** その担当者の今週の架電目標（週次行動計画の「架電目標」を流用）（weekGoal） */
export const weekGoal = (weekly: Record<string, WeeklyRow[]>, who: string, t = todayStr()): number => {
    const rows = weekly[t.slice(0, 7)] ?? [];
    const w = weekOfMonth(t);
    const r = rows.find(x => x.week === w && sameName(x.staff, who));
    return r ? Number(r.cg) || 0 : 0;
};

/** 今週の範囲（weekRange）。⚠️ 週次行動計画と同じ区切り（1〜7日・8〜14日・15〜21日・22日〜月末） */
export const weekRange = (t = todayStr()): [string, string] => {
    const mk = t.slice(0, 7);
    const w = weekOfMonth(t);
    const from = `${mk}-${String((w - 1) * 7 + 1).padStart(2, '0')}`;
    const to = w >= 4 ? `${mk}-31` : `${mk}-${String(w * 7).padStart(2, '0')}`;
    return [from, to];
};

// ---------------------------------------------------------------------------
// 一言目（scriptFor）
// ---------------------------------------------------------------------------

const fmtD = (ds: string): string => {
    const [y, m, d] = ds.slice(0, 10).split('-');
    return d ? `${y}/${Number(m)}/${Number(d)}` : ds;
};

/** 定型文の差し込み（fillTemplate） */
const fillTemplate = (body: string, rec: Row, me: string): string => {
    const g = (v: unknown) => str(v);
    const price = Number(rec.price || rec.budget) || 0;
    const map: Record<string, string> = {
        '{{name}}': g(rec.name),
        '{{staff}}': g(rec.staff || me),
        '{{addr}}': g(rec.addr || rec.targetProperty),
        '{{property}}': g(rec.targetProperty || rec.addr),
        '{{price}}': price ? `${price.toLocaleString()}円` : '',
        '{{today}}': fmtD(todayStr()),
    };
    let t = body;
    for (const k of Object.keys(map)) t = t.split(k).join(map[k]);
    return t;
};

export const scriptFor = (scripts: CallqScripts, l: Row, tag: TagKey, company: string, me: string): string => {
    const raw = scripts[tag] || scripts.ask || '';
    let x = fillTemplate(raw, l, me);
    x = x.split('{{company}}').join(company || '当社').split('{{next}}').join(str(l.nextNote) || '次回のご連絡');
    if (!str(l.name).trim()) x = x.split('{{name}}様').join('お客様').split('{{name}}').join('お客様');
    return x;
};
