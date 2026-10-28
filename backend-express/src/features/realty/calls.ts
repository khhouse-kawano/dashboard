import { randomBytes } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../../db/pool';
import type { Tx } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { norm } from './index';
import type { Result } from './index';

/**
 * 不動産企画係: 今日の架電キュー・架電ナビの書き込みと、通話記録（v2.2.226。② だけ）。
 *
 * ─────────────────────────────────────────────
 * 移植元: 以前のアプリ（khf-eigyokanri.netlify.app。V18）の V16.mark / V16.undo（架電キュー）と
 *         V18 の applyToLead・insertRec・loadHist（架電ナビ）。
 *   planner:call_mark   … 架電キューの4ボタン（不在・通電・アポ・終了確定）
 *   planner:call_undo   … 架電キューの「直前の記録を取消」
 *   planner:navi_save   … 架電ナビの「記録して次へ」（反響の更新と通話記録を1つのトランザクションで）
 *   planner:call_logs   … 架電ナビの「履歴・分析」（期間を指定して通話記録を読む）
 *   planner:call_logs_import / practice_logs_import … 以前のアプリの CSV の取り込み（マスターだけ）
 *
 * ⚠️ 以前のアプリは反響を画面の中で書き換えてから全体を保存していた。ここでは行を FOR UPDATE で押さえ、
 *   架電記録（callDates）への追記とフェーズなどの書き換えを② で行う（同時に2人が記録しても消し合わない）。
 * ⚠️ フェーズ・次回連絡予定日の決め方は以前のアプリと**同じ**にする（2026-10-28 の方針: 以前のアプリが最優先）。
 * ⚠️ 架電の記録の「実施者」は以前のアプリの currentUser()＝設定の担当者名。ログイン名と空白の入り方が違うことがあるので
 *   空白を除いて設定の担当者と突き合わせ、見つかれば設定の名前で記録する（resolveMe）。
 * ⚠️ 日付・時刻は日本時間（以前のアプリは利用者の PC の時計。② のサーバーの時刻帯に左右されないように）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

const ok = (body: Record<string, unknown>): Result => ({ httpStatus: 200, body });
const fail = (httpStatus: number, message: string): Result => ({ httpStatus, body: { status: 'error', message } });

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

const parseJson = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw ?? null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** 画面が文字列にして送った JSON（① を通ると {} が [] になるため。importer.ts の parseJsonText と同じ） */
const parseJsonText = (v: unknown): unknown => (typeof v === 'string' ? parseJson(v) : undefined);

// ---------------------------------------------------------------------------
// 日付（日本時間）
// ---------------------------------------------------------------------------

const p2 = (n: number) => String(n).padStart(2, '0');

/** 日本時間の今。date = 'YYYY-MM-DD'、stamp = 'YYYY-MM-DDTHH:MM'（以前のアプリの nowStamp）、sql = 'YYYY-MM-DD HH:MM:SS' */
const jstNow = (now = new Date()) => {
  const d = new Date(now.getTime() + 9 * 3600_000);
  const date = `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
  const hm = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  return { date, stamp: `${date}T${hm}`, sql: `${date} ${hm}:${p2(d.getUTCSeconds())}` };
};

/** 'YYYY-MM-DD' に n 日足す（以前のアプリの addDays） */
const addDays = (ds: string, n: number): string => {
  const d = new Date(`${ds}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 日時を日本時間の 'YYYY-MM-DD HH:MM:SS' にする。読めなければ null */
const toJstSql = (v: unknown): string | null => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const t = new Date(String(v).trim().replace(' ', 'T').replace(/\+00$/, '+00:00'));
  return Number.isNaN(t.getTime()) ? null : jstNow(t).sql;
};

/** DB の日本時間の日時（DATETIME。⚠️ db/pool.ts は dateStrings: true で文字列のまま返す）を、時刻帯つきで画面へ返す */
const jstIso = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) ? `${s.replace(' ', 'T')}+09:00` : s;
};

/** 以前のアプリの uid()（変更履歴の id） */
const uid = (): string => randomBytes(6).toString('hex') + Date.now().toString(36).slice(-4);

// ---------------------------------------------------------------------------
// 共通
// ---------------------------------------------------------------------------

/** 架電の記録の「実施者」。設定の担当者と空白を除いて一致すれば設定の名前、無ければログイン名 */
const resolveMe = async (tx: Tx, staff: AuthenticatedStaff): Promise<string> => {
  const [row] = await tx.query<DynamicRow>("SELECT JSON_EXTRACT(`data`, '$.staff') AS staff FROM app_state WHERE `key` = 'settings'");
  const list = parseJson(row?.staff);
  const me = norm(staff.name);
  if (Array.isArray(list)) {
    for (const s of list) {
      const name = isObject(s) ? String(s.name ?? '') : '';
      if (name !== '' && norm(name) === me) return name;
    }
  }
  return staff.name;
};

type CallRec = { date: string; staff: string; type: string; outcome?: string; memo?: string; [key: string]: unknown };

const callsOf = (raw: unknown): unknown[] => {
  const parsed = parseJson(raw);
  return Array.isArray(parsed) ? parsed : [];
};

const LEAD_KINDS = ['leads', 'buyLeads'] as const;
type LeadKind = (typeof LEAD_KINDS)[number];

const lockLead = async (tx: Tx, kind: LeadKind, id: string): Promise<DynamicRow | null> => {
  const rows = await tx.query<DynamicRow>(
    `SELECT * FROM brokerage_listings
      WHERE \`id\` = ? AND kind = ? AND (show_dashboard IS NULL OR show_dashboard <> 0)
      FOR UPDATE`,
    [id, kind]
  );
  return rows[0] ?? null;
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const dateStr = (v: unknown): string => str(v).slice(0, 10);

/** 反響の書き換える項目（架電キュー・ナビ・取消で使う） */
type LeadPatch = {
  callDates: unknown[];
  phase: string;
  nextDate: string;
  nextNote: string;
  connectDate: string;
  endReason: string;
};

const patchOf = (l: DynamicRow, calls: unknown[]): LeadPatch => ({
  callDates: calls,
  phase: str(l.phase),
  nextDate: dateStr(l.nextDate),
  nextNote: str(l.nextNote),
  connectDate: dateStr(l.connectDate),
  endReason: str(l.endReason),
});

const writePatch = (tx: Tx, id: string, p: LeadPatch) =>
  tx.execute(
    `UPDATE brokerage_listings
        SET callDates = ?, phase = ?, nextDate = ?, nextNote = ?, connectDate = ?, endReason = ?
      WHERE \`id\` = ?`,
    [JSON.stringify(p.callDates), p.phase || null, p.nextDate || null, p.nextNote || null, p.connectDate || null, p.endReason || null, id]
  );

/** 以前のアプリの entityLabel（売り・買い反響） */
const leadLabel = (l: DynamicRow): string =>
  str(l.name) || str(l.seller) || str(l.targetProperty) || str(l.addr) || '(名称なし)';

/**
 * フェーズが変わったら変更履歴（kind = logs）を1件積む（以前のアプリの logDiff(entity, rec, {phase}, note)）。
 * ⚠️ 以前のアプリが比べるのはフェーズだけ
 */
const logPhase = async (tx: Tx, kind: LeadKind, l: DynamicRow, from: string, to: string, by: string, note: string) => {
  if (from === to) return;
  await tx.execute(
    `INSERT INTO brokerage_listings (kind, \`id\`, entity, entityId, entityNo, label, field, \`from\`, \`to\`, \`by\`, \`at\`, note)
     VALUES ('logs', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uid(), kind === 'leads' ? 'lead' : 'buy', str(l.id), l.no === null || l.no === undefined ? null : Number(l.no),
      leadLabel(l), 'フェーズ', from || '（未設定）', to || '（未設定）', by || '(不明)', new Date().toISOString(), note]
  );
};

const reread = async (tx: Tx, id: string): Promise<DynamicRow | null> =>
  (await tx.query<DynamicRow>('SELECT * FROM brokerage_listings WHERE `id` = ?', [id]))[0] ?? null;

// ---------------------------------------------------------------------------
// 今日の架電キュー（planner:call_mark / call_undo）
// ---------------------------------------------------------------------------

/** 架電の結果（以前のアプリの CQ_OUT） */
const CQ_OUTCOMES = ['abs', 'talk', 'apo', 'end'] as const;
type CqOutcome = (typeof CQ_OUTCOMES)[number];

/** 1タップ記録のあとに自動で入れる次回連絡予定日（日数）と内容（以前のアプリの V16 の NEXT） */
const CQ_NEXT: Record<CqOutcome, { d: number; n: string }> = {
  abs: { d: 1, n: '再架電（前回は不在）' },
  talk: { d: 7, n: '追客架電' },
  apo: { d: 2, n: 'アポ前の確認連絡' },
  end: { d: 0, n: '' },
};

/** 以前のアプリの V16.mark のフェーズの決め方 */
const cqPhase = (kind: LeadKind, oc: CqOutcome, phase: string): string => {
  if (kind === 'leads') {
    if (oc === 'abs') return phase === 'リード受信' ? '架電中' : phase;
    if (oc === 'talk') return ['リード受信', '架電中'].includes(phase) ? '通電済' : phase;
    if (oc === 'apo') return ['リード受信', '架電中', '通電済'].includes(phase) ? '訪問査定予定' : phase;
    return '追客終了';
  }
  if (oc === 'abs') return phase === '反響受信' ? '追客中' : phase;
  if (oc === 'talk') return ['反響受信', '追客中'].includes(phase) ? '通電済' : phase;
  if (oc === 'apo') return ['反響受信', '追客中', '通電済'].includes(phase) ? '内見予約' : phase;
  return '追客終了';
};

const readKindId = (body: Record<string, unknown>): { kind: LeadKind; id: string } | string => {
  const kind = String(body.kind ?? '');
  const id = String(body.id ?? '').trim();
  if (!(LEAD_KINDS as readonly string[]).includes(kind)) return '種類（売り反響・買い反響）が正しくありません';
  if (id === '' || id.length > 100) return 'IDがありません';
  return { kind: kind as LeadKind, id };
};

/**
 * body = { kind, id, outcome }。応答の undo は「直前の記録を取消」で送り返してもらう値。
 * ⚠️ 以前のアプリと同じく、記録の staff は記録した人（無ければ反響の担当）
 */
export const runCallMark = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Result> => {
  const key = readKindId(body);
  if (typeof key === 'string') return fail(400, key);
  const oc = String(body.outcome ?? '') as CqOutcome;
  if (!CQ_OUTCOMES.includes(oc)) return fail(400, '架電の結果が正しくありません');

  const result = await withTransaction(async (tx) => {
    const l = await lockLead(tx, key.kind, key.id);
    if (!l) return null;
    const me = await resolveMe(tx, staff);
    const now = jstNow();
    const calls = callsOf(l.callDates);
    const before = patchOf(l, calls);
    const rec: CallRec = { date: now.stamp, staff: me || str(l.staff), type: 'call', outcome: oc };
    const p: LeadPatch = { ...before, callDates: [...calls, rec] };
    if (oc !== 'abs' && !p.connectDate) p.connectDate = now.date;
    p.phase = cqPhase(key.kind, oc, before.phase);
    if (oc === 'end' && !p.endReason) p.endReason = '他決';
    if (oc === 'end') {
      p.nextDate = '';
      p.nextNote = '';
    } else {
      p.nextDate = addDays(now.date, CQ_NEXT[oc].d);
      p.nextNote = CQ_NEXT[oc].n;
    }
    await writePatch(tx, key.id, p);
    await logPhase(tx, key.kind, l, before.phase, p.phase, me, '架電キュー');
    const { callDates: _c, ...beforeFields } = before;
    return { row: await reread(tx, key.id), undo: { kind: key.kind, id: key.id, date: rec.date, outcome: oc, before: beforeFields } };
  });
  if (result === null) return fail(404, '対象の反響が見つかりません（画面を再読み込みしてください）');
  return ok({ status: 'success', ...result });
};

/**
 * body = { kind, id, date, outcome, before: { phase, nextDate, nextNote, connectDate, endReason } }（call_mark の応答の undo）。
 * 追記した架電の記録を外し、書き換えた項目を元に戻す。
 * ⚠️ 以前のアプリは反響を丸ごと記録の前に戻していた。ここでは架電キューが書き換えた項目だけを戻す
 *   （その間に別の人が直した別の項目を消さないように）。⚠️ 変更履歴は以前のアプリと同じく残す
 */
export const runCallUndo = async (body: Record<string, unknown>): Promise<Result> => {
  const key = readKindId(body);
  if (typeof key === 'string') return fail(400, key);
  const date = String(body.date ?? '');
  const oc = String(body.outcome ?? '');
  const b = body.before;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date) || !isObject(b)) return fail(400, '取り消す記録が正しくありません');
  const fields = {
    phase: str(b.phase).slice(0, 100),
    nextDate: str(b.nextDate),
    nextNote: str(b.nextNote).slice(0, 2000),
    connectDate: str(b.connectDate),
    endReason: str(b.endReason).slice(0, 2000),
  };
  for (const d of [fields.nextDate, fields.connectDate]) {
    if (d !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return fail(400, '取り消す記録が正しくありません');
  }

  const result = await withTransaction(async (tx) => {
    const l = await lockLead(tx, key.kind, key.id);
    if (!l) return 'nolead' as const;
    const calls = callsOf(l.callDates);
    let ix = -1;
    for (let i = calls.length - 1; i >= 0; i--) {
      const c = calls[i];
      if (isObject(c) && c.date === date && c.outcome === oc) {
        ix = i;
        break;
      }
    }
    if (ix < 0) return 'norec' as const;
    await writePatch(tx, key.id, { callDates: calls.filter((_, i) => i !== ix), ...fields });
    return reread(tx, key.id);
  });
  if (result === 'nolead') return fail(404, '対象が見つかりません');
  if (result === 'norec') return fail(409, '取り消す架電の記録が見つかりません（すでに取り消したか、画面が古い可能性があります）');
  return ok({ status: 'success', row: result });
};

// ---------------------------------------------------------------------------
// 架電ナビ（planner:navi_save）
// ---------------------------------------------------------------------------

/** 通話結果（以前のアプリの V18 の OUTCOMES）と、架電キューの結果への読み替え（OUT2CQ） */
const NAVI_OUT2CQ: Record<string, CqOutcome> = {
  '訪問アポ獲得': 'apo', '来店アポ獲得': 'apo', 'WEB面談アポ獲得': 'apo',
  '再架電（日時約束）': 'talk', '中長期フォロー': 'talk', '断り・終了': 'end', '不在・不通': 'abs',
};

/** 終了理由（以前のアプリの LEAD_ENDS） */
const LEAD_ENDS = ['他決', '辞退・売却中止', '連絡不能', '対象外', 'その他'];

/**
 * 以前のアプリの applyToLead のフェーズの決め方（**そのまま**）。
 *
 * ⚠️⚠️ 以前のアプリ（v14.25）で「アポ日時を残す」の if を途中に足したため、else if のつながりが切れている:
 *   ・「不在・不通」でも、受信時のフェーズがリード受信・架電中なら **通電済** になる
 *   ・「訪問アポ獲得」で日付を入れていないと、リード受信・架電中なら訪問査定予定ではなく **通電済** になる
 *   2026-10-28 の方針（以前のアプリが最優先・ルールを変えない）で同じ動きにしている。直すかは利用者の判断待ち。
 */
const naviPhase = (outcome: string, hasApptDate: boolean, phase: string): string => {
  const oc = NAVI_OUT2CQ[outcome];
  const P = phase || 'リード受信';
  let next = phase;
  if (oc === 'abs') {
    if (P === 'リード受信') next = '架電中';
  } else if (outcome === '訪問アポ獲得') {
    if (['リード受信', '架電中', '通電済'].includes(P)) next = '訪問査定予定';
  }
  if (oc === 'apo' && hasApptDate) {
    // アポ日時を残すだけ（フェーズは上で決めたまま）
  } else if (oc === 'end') {
    next = '追客終了';
  } else if (['リード受信', '架電中'].includes(P)) {
    next = '通電済';
  }
  return next;
};

/** 通話記録の列（以前のアプリの buildRecord と同じ名前）。[列, 最大文字数] */
const LOG_TEXT_COLUMNS: [string, number][] = [
  ['staff', 64], ['customer', 100], ['media', 100], ['address', 255], ['ms_name', 255], ['room', 50], ['station', 100],
  ['prop_type', 20], ['area', 50], ['built', 50], ['owner', 255], ['occupancy', 255], ['loan', 20], ['loan_amount', 50],
  ['wish_price', 100], ['wish_time', 100], ['temperature', 50], ['reason', 20], ['asker', 50], ['status', 50],
  ['outcome', 50], ['app_ver', 100],
];
const LOG_LONG_COLUMNS = ['next_action', 'memo'];
const LOG_JSON_COLUMNS = ['hearing', 'rebuttals', 'events', 'transcript'];

const cut = (v: unknown, max: number): string => str(v).slice(0, max);

/** 通話記録の1行を INSERT する値にする（Dashboard で記録した行・CSV の行で共通） */
const callLogValues = (r: Record<string, unknown>) => {
  const out: Record<string, string | number | null> = {};
  for (const [c, max] of LOG_TEXT_COLUMNS) out[c] = cut(r[c], max);
  for (const c of LOG_LONG_COLUMNS) out[c] = r[c] === null || r[c] === undefined ? null : cut(r[c], 60000);
  for (const c of LOG_JSON_COLUMNS) {
    const v = typeof r[c] === 'string' ? parseJson(r[c]) : r[c];
    out[c] = v === null || v === undefined ? null : JSON.stringify(v);
  }
  out.lead_id = r.lead_id ? cut(r.lead_id, 100) : null;
  out.lead_kind = r.lead_kind ? cut(r.lead_kind, 20) : null;
  out.appt_at = toJstSql(r.appt_at);
  out.appt_place = r.appt_place ? cut(r.appt_place, 255) : null;
  out.started_at = toJstSql(r.started_at);
  out.duration_sec = Math.max(0, Math.round(Number(r.duration_sec) || 0));
  out.max_step = Math.max(0, Math.round(Number(r.max_step) || 0));
  return out;
};

const insertCallLog = async (tx: Tx, values: Record<string, string | number | null>) => {
  const cols = Object.keys(values);
  const res = await tx.execute(
    `INSERT INTO realty_call_logs (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    cols.map((c) => values[c])
  );
  return res.insertId;
};

/**
 * 架電ナビの「記録して次へ」。body.json（文字列）= {
 *   leadId（反響を選ばずに始めたら null）, outcome, nextDate, nextNote, endReason,
 *   memo（架電記録に付ける一行。以前のアプリの summary）, appt（{date,time,place} か null）,
 *   leadReason, leadTiming（反響が空のときだけ入れる）, record（通話記録。以前のアプリの buildRecord）
 * }
 * ⚠️ 反響の更新と通話記録は1つのトランザクション（以前のアプリは別々に保存し、通話記録だけ失敗すると未送信として残していた）
 */
export const runNaviSave = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Result> => {
  const d = parseJsonText(body.json);
  if (!isObject(d) || !isObject(d.record)) return fail(400, '記録の内容が正しくありません');
  const outcome = str(d.outcome);
  const oc = NAVI_OUT2CQ[outcome];
  if (!oc) return fail(400, '通話結果を選んでください');
  const leadId = d.leadId === null || d.leadId === undefined ? '' : str(d.leadId).trim();
  const nextDate = str(d.nextDate);
  if (nextDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return fail(400, '次回連絡予定日が正しくありません');
  const endReason = str(d.endReason);
  if (endReason !== '' && !LEAD_ENDS.includes(endReason)) return fail(400, '終了理由が正しくありません');
  const appt = isObject(d.appt) && /^\d{4}-\d{2}-\d{2}$/.test(str(d.appt.date))
    ? { date: str(d.appt.date), time: cut(d.appt.time, 5), place: cut(d.appt.place, 255), kind: outcome }
    : null;
  const values = callLogValues({ ...d.record, outcome, lead_id: leadId || null, lead_kind: leadId ? 'leads' : null });

  const result = await withTransaction(async (tx) => {
    let row: DynamicRow | null = null;
    if (leadId !== '') {
      const l = await lockLead(tx, 'leads', leadId);
      if (!l) return null;
      const me = await resolveMe(tx, staff);
      const now = jstNow();
      const calls = callsOf(l.callDates);
      const before = patchOf(l, calls);
      const rec: CallRec = { date: now.stamp, staff: me || str(l.staff), type: 'call', outcome: oc, memo: cut(d.memo, 1000) };
      const p: LeadPatch = { ...before, callDates: [...calls, rec] };
      if (oc !== 'abs' && !p.connectDate) p.connectDate = now.date;
      p.phase = naviPhase(outcome, appt !== null, before.phase);
      if (oc === 'end') {
        p.endReason = endReason || before.endReason || 'その他';
        p.nextDate = '';
        p.nextNote = '';
      } else {
        p.nextDate = nextDate;
        p.nextNote = cut(d.nextNote, 2000);
      }
      await writePatch(tx, leadId, p);
      // 売却理由・希望時期は空のときだけ入れる
      const reason = cut(d.leadReason, 255);
      const timing = cut(d.leadTiming, 255);
      if (reason !== '' && str(l.reason) === '') await tx.execute('UPDATE brokerage_listings SET reason = ? WHERE `id` = ?', [reason, leadId]);
      if (timing !== '' && str(l.timing) === '') await tx.execute('UPDATE brokerage_listings SET timing = ? WHERE `id` = ?', [timing, leadId]);
      // ⚠️ アポの日時は以前のアプリでは反響の appt に持っていた（反響の画面・カレンダー用）。Dashboard に列が無いので原本（raw_data）に残す
      if (oc === 'apo' && appt !== null) {
        await tx.execute(
          "UPDATE brokerage_listings SET raw_data = JSON_SET(COALESCE(raw_data, '{}'), '$.appt', JSON_EXTRACT(?, '$')) WHERE `id` = ?",
          [JSON.stringify(appt), leadId]
        );
      }
      await logPhase(tx, 'leads', l, before.phase, p.phase, me, '架電ナビ');
      row = await reread(tx, leadId);
    }
    const logId = await insertCallLog(tx, { ...values, created_at: jstNow().sql, created_by: cut(staff.name, 64) });
    return { row, logId };
  });
  if (result === null) return fail(404, '対象の反響が見つかりません。画面を再読み込みしてください。');
  return ok({ status: 'success', ...result });
};

// ---------------------------------------------------------------------------
// 通話記録の読み出し（planner:call_logs）
// ---------------------------------------------------------------------------

const ROWS_LIMIT = 3000;

/** body = { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }（両端を含む）。⚠️ 以前のアプリと同じく 3,000 件まで・新しい順 */
export const runCallLogs = async (body: Record<string, unknown>): Promise<Result> => {
  const from = str(body.from);
  const to = str(body.to);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return fail(400, '期間が正しくありません');
  const rows = await query<DynamicRow>(
    `SELECT * FROM realty_call_logs WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC, id DESC LIMIT ${ROWS_LIMIT}`,
    [`${from} 00:00:00`, `${addDays(to, 1)} 00:00:00`]
  );
  const logs = rows.map((r) => {
    const o: Record<string, unknown> = { ...r };
    for (const c of LOG_JSON_COLUMNS) o[c] = parseJson(r[c]) ?? (c === 'hearing' ? {} : []);
    o.created_at = jstIso(r.created_at);
    o.appt_at = jstIso(r.appt_at);
    o.started_at = jstIso(r.started_at);
    return o;
  });
  return ok({ status: 'success', logs });
};

// ---------------------------------------------------------------------------
// 以前のアプリの CSV の取り込み（planner:call_logs_import / practice_logs_import。マスターだけ）
// ---------------------------------------------------------------------------

const IMPORT_MAX = 300;

type ImportTable = 'realty_call_logs' | 'realty_practice_logs';

/** 練習記録の列（以前のアプリの prSave と同じ名前）。[列, 種類] */
const PRACTICE_COLUMNS: [string, 'text' | 'int' | 'json' | 'bool'][] = [
  ['staff', 'text'], ['mode', 'text'], ['level', 'int'], ['persona', 'json'], ['total', 'int'], ['max_total', 'int'],
  ['scores', 'json'], ['checklist', 'json'], ['result', 'json'], ['judge', 'json'], ['transcript', 'json'],
  ['duration_sec', 'int'], ['max_step', 'int'], ['rebuttals', 'json'], ['appointment', 'bool'], ['app_ver', 'text'],
];

const practiceValues = (r: Record<string, unknown>) => {
  const out: Record<string, string | number | null> = {};
  for (const [c, t] of PRACTICE_COLUMNS) {
    const v = r[c];
    if (t === 'text') out[c] = cut(v, c === 'app_ver' ? 100 : 64);
    else if (t === 'int') out[c] = v === null || v === undefined || str(v).trim() === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v));
    else if (t === 'bool') out[c] = v === null || v === undefined || str(v) === '' ? null : ['true', 't', '1'].includes(str(v).toLowerCase()) ? 1 : 0;
    else {
      const j = typeof v === 'string' ? parseJson(v) : v;
      out[c] = j === null || j === undefined ? null : JSON.stringify(j);
    }
  }
  out.duration_sec = out.duration_sec ?? 0;
  return out;
};

/**
 * body.rows = [CSV の1行を JSON 文字列にしたもの, …]（300 件まで）。列名は以前のアプリ（Supabase）の表と同じ。
 * ⚠️ id（Supabase の id）で二重取り込みを防ぐ。すでにある id は飛ばす。⚠️ 日時（created_at など）は日本時間に直して入れる
 */
const runImport = async (table: ImportTable, body: Record<string, unknown>): Promise<Result> => {
  if (!Array.isArray(body.rows) || body.rows.length === 0) return fail(400, '行がありません');
  if (body.rows.length > IMPORT_MAX) return fail(400, `一度に送れるのは ${IMPORT_MAX} 件までです`);
  const items: { src: string; values: Record<string, string | number | null> }[] = [];
  for (const raw of body.rows) {
    const r = parseJsonText(raw);
    if (!isObject(r)) return fail(400, '行の形が正しくありません');
    const src = str(r.id).trim();
    if (src === '' || src.length > 64) return fail(400, 'id の無い行があります（以前のアプリから出した CSV か確かめてください）');
    const created = toJstSql(r.created_at);
    if (created === null) return fail(400, `日時（created_at）が読めない行があります: ${src}`);
    const values = table === 'realty_call_logs' ? callLogValues(r) : practiceValues(r);
    items.push({ src, values: { ...values, src_id: src, created_at: created } });
  }

  const result = await withTransaction(async (tx) => {
    const ids = items.map((i) => i.src);
    const exists = new Set(
      (await tx.query<DynamicRow>(`SELECT src_id FROM ${table} WHERE src_id IN (${ids.map(() => '?').join(', ')})`, ids)).map((r) => String(r.src_id))
    );
    let inserted = 0;
    for (const it of items) {
      if (exists.has(it.src)) continue;
      exists.add(it.src); // 同じファイルに同じ id が2回あっても1回だけ
      const cols = Object.keys(it.values);
      await tx.execute(
        `INSERT INTO ${table} (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        cols.map((c) => it.values[c])
      );
      inserted++;
    }
    return { inserted, skipped: items.length - inserted };
  });
  return ok({ status: 'success', ...result });
};

export const runCallLogsImport = (body: Record<string, unknown>): Promise<Result> => runImport('realty_call_logs', body);
export const runPracticeLogsImport = (body: Record<string, unknown>): Promise<Result> => runImport('realty_practice_logs', body);
