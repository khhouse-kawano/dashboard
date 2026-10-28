# 2026-10-28 不動産企画係: 今日の架電キュー・架電ナビ（一括査定）（v2.2.226）

## 依頼
- 「今日の架電キュー」「架電ナビ（一括査定）」も新たなブランチで実装を。確認箇所は？
- 確認への回答（2026-10-28）
  1. 通話記録（文字起こし）を見られる人 → **不動産企画係の全員**（以前のアプリと同じ）
  2. 自動聞き取り（ブラウザの音声認識。声は Google / Microsoft に送られる）→ **そのまま使う**
  3. AI ロープレ（練習・練習の成績）→ **移行中**
  4. 以前の通話記録・練習記録（Supabase の call_logs・practice_logs）の CSV 取り込み → **つくる**

## 決めたこと
- 以前のアプリ（V18）の V16（今日の架電キュー）・V18（架電ナビ）を、同じ画面・同じ規則で移した（2026-10-28 の方針: 以前のアプリが最優先）
- **今日の架電キュー**（`/realtyCallQueue`）: 抽出・並び・要件タグ・一言目・メーター・4ボタン・取消を React で写した（callq/callqLogic.ts・CallQueue.tsx）
  - 4ボタンの書き込みは ② の `planner:call_mark`。行を FOR UPDATE で押さえて架電記録に追記し、フェーズ・次回連絡予定日・通電日・終了理由を以前のアプリと同じ決め方で書く（同時に2人が記録しても消し合わない）。フェーズが変わったら変更履歴（logs）を積む
  - 取消は `planner:call_undo`。以前のアプリは反響を丸ごと戻していたが、ここでは**キューが書き換えた項目だけ**戻す（その間に他の人が直した別の項目を消さない）
  - 件数は画面の入力欄で変えられる（設定に保存。以前のアプリと同じ）
- **架電ナビ**（`/realtyCallNavi` と、キュー・売り反響の行・売り反響の編集画面の「🧭」）: 以前のアプリのナビ（Shadow DOM の全画面の部品）を **naviEngine.js に変換スクリプトで写した**。台本（STEPS・HEAR・HOOKS・TALK・RB・TRIG など）と動きはそのまま
  - 変えたのは: 保存先（Supabase → ② の `planner:navi_save`）、ログインの画面（Dashboard のログインに一本化）、ロープレ（ボタンを押せない「移行中」）、色・角丸（Dashboard に寄せた）、重なり順（Dashboard の上部メニュー・在席表示より上）
  - 「記録して次へ」は、反響の更新と通話記録を **1つのトランザクション**で ② が書く（以前のアプリは別々に保存していた）。通信の失敗・② の障害のときだけ端末に「未送信」として残し、送り直せる
  - アポ日時（以前のアプリの lead.appt）は Dashboard に列が無いので、反響の原本（raw_data）に残す。ポータルの反響の詳細（detail）も raw_data から読む
  - ⚠️⚠️ **以前のアプリの不具合をそのまま移した**（利用者の判断待ち）: 以前のアプリの applyToLead は、v14.25 で「アポ日時を残す」の if を途中に足したため else if のつながりが切れている
    - 「不在・不通」でも、フェーズがリード受信・架電中なら **通電済** になる
    - 日付の無い「訪問アポ獲得」は、リード受信・架電中なら訪問査定予定ではなく **通電済** になる
    - ② の naviPhase に注記。126通りの組み合わせで以前のアプリと同じことを確かめた
- **通話記録**: 新しい表 `realty_call_logs`（と `realty_practice_logs`）。文字起こし・ヒアリングは反響には入れない（以前のアプリと同じ）。読み出しは `planner:call_logs`（不動産企画係の全員）
- **CSV の取り込み**（設定画面の一番下。マスターだけ）: `planner:call_logs_import`・`practice_logs_import`。Supabase の id で二重取り込みを防ぐ。日時は日本時間に直す
- **週次行動計画**: 表の上に「📞 接触の質」（以前のアプリの V16.weeklyPanel）
- **設定**: 「📞 架電キュー（抽出ルールと一言目）」のカード（以前のアプリの V16.settingsCard）
  - ⚠️ 以前のアプリは件数だけ 1〜50 に丸め、ほかは 1 以上しか確かめない（実データに「1日の目標＝週目標÷10」がある）。同じにした（上限は桁あふれよけの 9999）
- 「自分」（以前のアプリの currentUser）は、設定の担当者名と空白を除いて突き合わせる（ログイン名と空白の入り方が違う人がいる）
- メニューの「今日の架電キュー」「架電ナビ（一括査定）」から「移行中」を外した

## 確認したこと
- ① を通して ② まで届くか（トークン無しで 401）: 新しい6つ（call_mark・call_undo・navi_save・call_logs・call_logs_import・practice_logs_import）すべて 401
- ① を通した API の試験（テスト用の担当者・テスト行だけ）: **24項目すべて OK**
  - キュー: 不在（架電中・翌日）・取消・取消の二度目は409・通電（通電済・7日後・通電日）・アポ（訪問査定予定・2日後）・終了確定（追客終了・他決）・買いのアポ（内見予約）・入力の誤り400・無い反響404
  - ナビ: 不在（架電中→通電済。以前のアプリと同じ）・アポ（追客終了の反響はフェーズそのまま・raw_data にアポ日時・売却理由と希望時期が空なら入る）・終了理由の誤り400・反響なし
  - 通話記録の読み出し（JSON の列・日本時間）・変更履歴（フェーズが変わったときだけ）
  - 取り込み: 一般は403・二重は飛ばす・日本時間・練習記録・id 無しは400
  - 設定: 架電キューの保存・件数の範囲外は400・元の値（週目標÷10）に戻せる
- ナビのフェーズの決め方: 以前のアプリの applyToLead を実際に動かし、② の naviPhase と **126通り（結果7 × アポ日付の有無 × フェーズ9）すべて一致**
- 画面（Playwright）: 架電キューの並び・タグ・一言目・全角の電話番号・不在→取消・ナビの起動（反響の詳細の表示・⑤⑥の断定・切り返しの検索）→記録→キューに「記録済」・ナビの一覧・通話履歴・分析・週次の「接触の質」の位置・設定（一般は取り込みが見えない／マスターは見える）・売り反響の行と編集画面の🧭・設定画面からの CSV 取り込み（引用符の中のカンマ・改行・JSON、二度目は二重に入らない）。**ページのエラー 0**
- 型チェック（②）・本番ビルド（フロント）・realty の画面の型チェック（tsconfig の include が効いていないため、スクラッチパッドの設定で realty だけ）
- テスト用の担当者・反響・通話記録は消した。設定の架電キューは元の値のまま

## 見つけたこと（今回は直していない）
- `sell/LeadSell.tsx` の「📞 架電」ボタン（handleQuickCall）が、定義されていない `getCurrentDateTime` を呼んでいる（今回より前から。押すとエラーになるはず）。直すか利用者の判断待ち

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/realty | **calls.ts（新規）** | runCallMark・runCallUndo・runNaviSave・runCallLogs・runCallLogsImport・runPracticeLogsImport（cqPhase・naviPhase・resolveMe・logPhase など） |
| backend-express/src/features/realty | index.ts | norm を export |
| backend-express/src/features/realty | state.ts | 設定の項目に callq・callqScripts |
| backend-express/src/gateway | registry.ts | planner の6つを登録 |
| backend/src/core | express_proxy.php | 6つを expressProxyRequests() と expressProxyExclusive() に |
| backend/scripts/sql | **2026-10-28_realty_call_logs.sql（新規）** | realty_call_logs・realty_practice_logs。ローカルに流した |
| backend/scripts/sql | **2026-10-28_update_log_2.2.226.sql（新規）** | 更新履歴＋記事5本。ローカルに流した（no=327） |
| frontend/src/components/realty/callq | **callqLogic.ts・CallQueue.tsx・ContactQualityPanel.tsx（新規）** | 今日の架電キュー・接触の質 |
| frontend/src/components/realty/navi | **naviEngine.js・naviHost.ts・CallNavi.tsx（新規）** | 架電ナビの本体・開く窓口・起動用の一覧 |
| frontend/src/components/realty/settings | **RealtyLogImport.tsx（新規）**・RealtySettings.tsx | 通話記録・練習記録の取り込み、架電キューのカード |
| frontend/src/components/realty/common | realtyState.ts・LeadEdit.tsx | 設定の型に callq・callqScripts／編集画面の「🧭 ナビで架電」（onNavi） |
| frontend/src/components/realty/sell | LeadSell.tsx | 行の🧭・編集画面の🧭・ナビで記録したあとの反映 |
| frontend/src/components/realty/weekly | WeeklyPlan.tsx | 接触の質 |
| frontend/src/components/realty | RealtyMenu.tsx | 2つの「移行中」を外した |
| frontend/src | App.tsx | /realtyCallQueue・/realtyCallNavi |
| frontend/src/utils | version.ts | 2.2.226 |
| backend/scripts/guide/articles/common | **screen-232.md・screen-233.md（新規）**・screen-230.md・screen-250.md・screen-270.md | 記事（下） |

## 業務ガイドの記事
- 新規「今日の架電キュー（不動産企画係）」: 並ぶ反響・自分の担当のみ・4つのボタン・取消・目印・メーター
- 新規「架電ナビ（一括査定）（不動産企画係）」: 始め方・使い方・自動聞き取り（声が外部に送られること）・記録して次へ・未送信・通話履歴・分析（全員が見られる）・ロープレは移行中
- 「不動産企画係の画面（入口と権限）」: 日々の行動の2つを記事へのリンクに
- 「週次行動計画（不動産企画係）」: 「接触の質」の節
- 「設定（不動産企画係）」: 「架電キュー」の節・「通話記録・練習記録の取り込み」の節。移す前のカードの一覧から架電キューを外した

## コード

### backend-express/src/features/realty/calls.ts（新規・全文）
```ts
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
```

### frontend/src/components/realty/callq/callqLogic.ts（新規・全文）
```ts
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
```

### frontend/src/components/realty/callq/CallQueue.tsx（新規・全文）
```tsx
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AuthContext from '../../../context/AuthContext';
import { REALTY_CSS, loadRealtyState, loadRecords, post, saveRealtySettings } from '../common/realtyState';
import type { WeeklyRow } from '../common/realtyState';
import { recordFieldChanges, saveBrokerageRecord } from '../common/leadUtiles';
import LeadEdit from '../common/LeadEdit';
import { todayStr } from '../summary/kpi';
import type { Row } from '../summary/kpi';
import { openNavi } from '../navi/naviHost';
import {
    CQ_OUT, ST, TAGL, build, callOutcome, callqConf, callqScripts, callsOnly, contactKpi, diffDays, keyOf, newListings,
    sameName, scriptFor, setDone, splitKey, tagsOf, telOf, weekGoal, weekRange,
} from './callqLogic';
import type { LeadKind, Outcome, UndoToken } from './callqLogic';

/**
 * 📞 今日の架電キュー（不動産企画係。v2.2.226）。
 *
 * ⚠️ 移植元は以前のアプリの V16.paint。上から順に、考えずに1件ずつ潰すための画面。
 *   抽出・並び・要件タグ・一言目は callqLogic.ts、4つのボタンの書き込みは ② の planner:call_mark。
 * ⚠️ この画面のゴールは「成約」ではなく「相手の今の状況を確認できたか」（接触確認率）。
 */

const STYLE = `
.rlt-cq-meters { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
.rlt-cq-meter { border: 1px solid #e9ecef; border-radius: 8px; padding: 8px 12px; background: #fff; }
.rlt-cq-meter .t { display: flex; justify-content: space-between; font-size: 11px; color: #6c757d; }
.rlt-cq-meter .v { font-size: 20px; font-weight: bold; color: #343a40; font-variant-numeric: tabular-nums; }
.rlt-cq-meter .v small { font-size: 11px; font-weight: normal; color: #6c757d; }
.rlt-cq-bar { height: 6px; background: #e9ecef; border-radius: 3px; overflow: hidden; margin-top: 4px; }
.rlt-cq-bar i { display: block; height: 100%; background: #0d6efd; }
.rlt-cq-bar i.ok { background: #198754; } .rlt-cq-bar i.mid { background: #ffc107; } .rlt-cq-bar i.bad { background: #dc3545; }
.rlt-cq-note { border-radius: 6px; padding: 8px 12px; font-size: 11px; margin-bottom: 12px; border: 1px solid #b6d4fe; background: #e7f1ff; color: #084298; line-height: 1.7; }
.rlt-cq-note.done { border-color: #a3cfbb; background: #d1e7dd; color: #0f5132; }
.rlt-cq-empty { text-align: center; color: #6c757d; padding: 24px; font-size: 12px; line-height: 1.8; }
.rlt-cq-list { display: flex; flex-direction: column; gap: 10px; }
.rlt-cq-card { border: 1px solid #dee2e6; border-radius: 8px; padding: 10px 14px; background: #fff; }
.rlt-cq-card.next { border: 2px solid #0d6efd; box-shadow: 0 2px 8px rgba(13,110,253,.15); }
.rlt-cq-card.done { background: #f8f9fa; opacity: .75; }
.rlt-cq-r1 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rlt-cq-no { width: 24px; height: 24px; border-radius: 50%; background: #e9ecef; color: #495057; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; }
.rlt-cq-card.next .rlt-cq-no { background: #0d6efd; color: #fff; }
.rlt-cq-nm { font-size: 14px; font-weight: bold; color: #212529; }
.rlt-cq-tel { font-size: 13px; font-weight: bold; color: #0d6efd; text-decoration: none; }
.rlt-cq-tel.no { color: #adb5bd; font-weight: normal; font-size: 11px; }
.rlt-cq-sp { flex: 1; }
.rlt-cq-meta { font-size: 11px; color: #495057; margin-top: 6px; line-height: 1.7; }
.rlt-cq-scr { margin-top: 8px; background: #fff8e1; border: 1px solid #ffe69c; border-radius: 6px; padding: 8px 10px; font-size: 12px; white-space: pre-wrap; color: #343a40; }
.rlt-cq-scr .lb { display: block; font-size: 10px; font-weight: bold; color: #997404; margin-bottom: 2px; }
.rlt-cq-btns { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.rlt-cq-btns button { border-radius: 6px; padding: 8px 4px; font-size: 12px; font-weight: bold; cursor: pointer; border: 1px solid; background: #fff; }
.rlt-cq-btns button:disabled { opacity: .5; cursor: wait; }
.rlt-cq-btns .abs { border-color: #6c757d; color: #495057; }
.rlt-cq-btns .talk { border-color: #0d6efd; color: #0d6efd; }
.rlt-cq-btns .apo { border-color: #198754; color: #198754; }
.rlt-cq-btns .end { border-color: #6f42c1; color: #6f42c1; }
.rlt-cq-btns button:hover:not(:disabled) { filter: brightness(.95); background: #f8f9fa; }
.rlt-badge { display: inline-block; border-radius: 10px; padding: 1px 8px; font-size: 10px; font-weight: bold; margin-left: 4px; }
.rlt-badge.navy { background: #cfe2ff; color: #084298; } .rlt-badge.amber { background: #fff3cd; color: #997404; }
.rlt-badge.green { background: #d1e7dd; color: #0f5132; } .rlt-badge.red { background: #f8d7da; color: #842029; }
.rlt-badge.gray { background: #e9ecef; color: #495057; }
.rlt-cq-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #212529; color: #fff; padding: 8px 18px; border-radius: 6px; font-size: 12px; z-index: 2000; }
@media (max-width: 640px) { .rlt-cq-btns { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
`;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

const fmtD = (ds: unknown): string => {
    const s = str(ds).slice(0, 10);
    const [y, m, d] = s.split('-');
    return d ? `${y}/${Number(m)}/${Number(d)}` : (s || '―');
};
const fmtDT = (c: unknown): string => {
    const x = typeof c === 'object' && c !== null ? str((c as { date?: unknown }).date) : str(c);
    if (!x) return '―';
    return x.length > 10 ? `${fmtD(x)} ${x.slice(11, 16)}` : fmtD(x);
};

const copyText = async (t: string): Promise<boolean> => {
    try {
        if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; }
    } catch { /* 下の方法で試す */ }
    try {
        const ta = document.createElement('textarea');
        ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch {
        return false;
    }
};

const CallQueue: React.FC = () => {
    const { userName } = useContext(AuthContext);
    const [leads, setLeads] = useState<Row[]>([]);
    const [buyLeads, setBuyLeads] = useState<Row[]>([]);
    const [ledger, setLedger] = useState<Row[]>([]);
    const [settings, setSettings] = useState<Record<string, unknown>>({});
    const [weekly, setWeekly] = useState<Record<string, WeeklyRow[]>>({});
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    // ⚠️ ST（並び・記録済）はモジュールの変数。変えたら描き直すための印
    const [, setTick] = useState(0);
    const repaint = () => setTick(n => n + 1);
    const [toast, setToast] = useState('');
    const toastTimer = useRef<number | undefined>(undefined);
    const [editing, setEditing] = useState<Row | null>(null);

    const showToast = (m: string) => {
        setToast(m);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 2200);
    };

    const conf = useMemo(() => callqConf(settings.callq), [settings.callq]);
    const scripts = useMemo(() => callqScripts(settings.callqScripts), [settings.callqScripts]);
    /** 自分（以前のアプリの currentUser）。設定の担当者に空白違いで一致すれば設定の名前 */
    const me = useMemo(() => {
        const list = Array.isArray(settings.staff) ? settings.staff as { name?: string }[] : [];
        return list.find(s => s.name && sameName(s.name, userName || ''))?.name ?? (userName || '');
    }, [settings.staff, userName]);
    const company = str((settings.company as { name?: string } | undefined)?.name);

    const load = useCallback(async () => {
        try {
            const [rec, st] = await Promise.all([loadRecords(['leads', 'buyLeads', 'ledger']), loadRealtyState()]);
            setLeads(rec.records.leads);
            setBuyLeads(rec.records.buyLeads);
            setLedger(rec.records.ledger);
            setSettings(rec.settings as Record<string, unknown>);
            setWeekly(st.weekly);
        } catch (e) {
            alert(`読み込めませんでした: ${(e as Error).message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    // ⚠️ 並びは日が変わったときと「再抽出」のときだけ作る（以前のアプリと同じく、作業中に行が動かないように）
    useEffect(() => {
        if (!loading && ST.day !== todayStr()) { build(leads, buyLeads, conf, me); repaint(); }
    }, [loading, leads, buyLeads, conf, me]);

    const rebuild = (mine = ST.mine, c = conf) => {
        ST.mine = mine;
        build(leads, buyLeads, c, me);
        repaint();
    };

    /** 件数を変えて保存し、並べ直す（V16.setSize。⚠️ 設定はチーム全員で共有） */
    const setSize = async (v: string) => {
        const size = Math.max(1, Math.min(50, Math.round(Number(v) || 10)));
        const next = { ...conf, size };
        try {
            const saved = await saveRealtySettings({ callq: next });
            setSettings(prev => ({ ...prev, callq: saved.callq }));
            rebuild(ST.mine, next);
        } catch (e) {
            alert(`保存できませんでした: ${(e as Error).message}`);
        }
    };

    const rowsOf = (kind: LeadKind) => (kind === 'buyLeads' ? buyLeads : leads);
    const setRowsOf = (kind: LeadKind) => (kind === 'buyLeads' ? setBuyLeads : setLeads);
    const recOf = (key: string): { kind: LeadKind; rec: Row | undefined } => {
        const { kind, id } = splitKey(key);
        return { kind, rec: rowsOf(kind).find(x => str(x.id) === id) };
    };
    const replaceRow = (kind: LeadKind, row: Row | null) => {
        if (!row) return;
        setRowsOf(kind)(prev => prev.map(x => (str(x.id) === str(row.id) ? row : x)));
    };

    const scrollToNext = () => window.setTimeout(() => {
        const e = document.getElementById('rlt-cq-next');
        if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 60);

    /** 4つのボタン（V16.mark） */
    const mark = async (key: string, oc: Outcome) => {
        const { kind, rec } = recOf(key);
        if (!rec) { showToast('対象が見つかりません（画面を再読み込みしてください）'); return; }
        setBusy(true);
        try {
            const d = await post('call_mark', { kind, id: rec.id, outcome: oc });
            const row = (d.row as Row | null) ?? null;
            replaceRow(kind, row);
            ST.done[key] = oc;
            ST.undo = (d.undo as UndoToken) ?? null;
            repaint();
            showToast(`${CQ_OUT[oc].icon} ${CQ_OUT[oc].label}を記録しました${oc === 'end' ? '（追客終了・他決）' : `（次回 ${fmtD(row?.nextDate)}）`}`);
            scrollToNext();
        } catch (e) {
            alert(`記録できませんでした: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    };

    /** 直前の記録を取消（V16.undo） */
    const undo = async () => {
        const u = ST.undo;
        if (!u) { showToast('取消できる記録がありません'); return; }
        setBusy(true);
        try {
            const d = await post('call_undo', u);
            replaceRow(u.kind, (d.row as Row | null) ?? null);
            delete ST.done[keyOf(u.kind, u.id)];
            ST.undo = null;
            repaint();
            showToast('直前の記録を取り消しました');
        } catch (e) {
            alert(`取り消せませんでした: ${(e as Error).message}`);
            ST.undo = null;
            repaint();
        } finally {
            setBusy(false);
        }
    };

    const copy = async (l: Row, tag: keyof typeof TAGL) => {
        const ok = await copyText(scriptFor(scripts, l, tag, company, me));
        showToast(ok ? '一言目をコピーしました' : 'コピーできませんでした（ブラウザの権限をご確認ください）');
    };

    /** 「開く」→ 反響の編集（チームサマリーの「開く」と同じ保存の仕方） */
    const saveEdit = async () => {
        const cur = editing;
        setEditing(null);
        if (!cur?.id) return;
        const kind: LeadKind = cur.kind === 'buyLeads' ? 'buyLeads' : 'leads';
        const before = rowsOf(kind).find(x => str(x.id) === str(cur.id));
        const { id: _id, internal_id: _i, created_at: _c, updated_at: _u, ...fields } = cur;
        try {
            const row = await saveBrokerageRecord(str(cur.id), fields);
            replaceRow(kind, (row as Row | null) ?? { ...before, ...fields });
            if (before) {
                await recordFieldChanges({
                    entity: kind === 'buyLeads' ? 'buy' : 'lead', entityId: str(cur.id),
                    label: str(before.seller) || str(before.name) || str(before.addr) || str(cur.id),
                    before, after: fields, by: userName || '不明',
                });
            }
        } catch (e) {
            alert(`保存に失敗しました: ${(e as Error).message}`);
        }
    };

    /** 架電ナビで記録したら、返ってきた反響で置き換え、キューに並んでいれば記録済にする（V16.setDone） */
    const openNaviFor = (l: Row) => openNavi({
        lead: l, settings, me,
        onSaved: (row, oc) => {
            if (row) replaceRow('leads', row);
            if (oc) setDone(keyOf('leads', l.id), oc);
            repaint();
        },
    });

    if (loading) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const t = todayStr();
    const keys = ST.order;
    const nextKey = keys.find(k => !ST.done[k]) ?? '';
    const doneN = Object.keys(ST.done).length;
    const newProps = newListings(ledger, t).length;

    // メーター（meters）。⚠️ 目標は個人のものなので「自分の担当のみ」のときだけ使う
    const who = ST.mine ? me : '';
    const wg = ST.mine ? weekGoal(weekly, me, t) : 0;
    const dg = Math.ceil(wg / (Number(conf.dailyDivisor) || 5));
    const kd = contactKpi(leads, buyLeads, who, t, t);
    const [wf, wt] = weekRange(t);
    const kw = contactKpi(leads, buyLeads, who, wf, wt);
    const km = contactKpi(leads, buyLeads, who, `${t.slice(0, 7)}-01`, `${t.slice(0, 7)}-31`);
    const left = keys.filter(k => !ST.done[k]).length;
    const noGoal = ST.mine ? '週次行動計画に目標未入力' : 'チーム合計';
    const bar = (a: number, g: number | null) => {
        if (g === null) return null;
        const r = g > 0 ? a / g : 0;
        const cls = g <= 0 ? '' : r >= 1 ? 'ok' : r >= 0.8 ? 'mid' : 'bad';
        return <div className="rlt-cq-bar"><i className={cls} style={{ width: `${Math.min(100, Math.round(r * 100))}%` }}></i></div>;
    };

    const card = (key: string, i: number) => {
        const { kind, rec: l } = recOf(key);
        if (!l) return null;
        const done = ST.done[key];
        const tags = tagsOf(kind, l, newProps, t);
        const top = tags[0];
        const tel = telOf(l);
        const nm = str(l.name).trim() || (kind === 'leads' ? str(l.addr) || '（顧客名なし）' : str(l.targetProperty) || '（顧客名なし）');
        const cs = callsOnly(l);
        const lastc = cs.length ? cs[cs.length - 1] : null;
        const oc = lastc ? callOutcome(lastc) : '';
        const sub = kind === 'leads' ? str(l.addr) : str(l.targetProperty);
        const next = str(l.nextDate).slice(0, 10);
        const recv = str(l.receivedDate).slice(0, 10);
        const isNext = key === nextKey;
        return (
            <div key={key} className={`rlt-cq-card ${done ? 'done' : ''} ${isNext ? 'next' : ''}`} id={isNext ? 'rlt-cq-next' : undefined}>
                <div className="rlt-cq-r1">
                    <span className="rlt-cq-no">{done ? '✓' : i + 1}</span>
                    <span className="rlt-cq-nm">{nm}</span>
                    {tel ? <a className="rlt-cq-tel" href={`tel:${tel}`}>☎ {tel}</a> : <span className="rlt-cq-tel no">☎ 電話番号なし</span>}
                    <span>{tags.map(k => <span key={k} className={`rlt-badge ${TAGL[k].cls}`}>{TAGL[k].lbl}</span>)}</span>
                    <span className="rlt-cq-sp"></span>
                    {kind === 'leads' && !done && <button className="rlt-btn sec" onClick={() => openNaviFor(l)}>🧭 ナビで架電</button>}
                    <button className="rlt-btn sec" onClick={() => setEditing({ ...l })}>開く</button>
                </div>
                <div className="rlt-cq-meta">
                    {kind === 'leads' ? `📨 売り反響／${str(l.source) || '反響元なし'}` : `🏠 買い反響／${str(l.portal) || '反響元なし'}`}
                    {'　／　担当：'}{str(l.staff) || <span className="rlt-badge red">未割当</span>}
                    {`　／　受信 ${fmtD(recv)}${recv ? `（${diffDays(t, recv)}日前）` : ''}`}
                    <br />
                    {sub && `物件：${sub}　／　`}
                    {`フェーズ：${str(l.phase) || '―'}　／　前回：${lastc ? `${fmtDT(lastc)}${oc ? `（${CQ_OUT[oc].label}）` : ''}` : '記録なし'}／通算 📞${cs.length}`}
                    {next && <>{`　／　次回：${fmtD(next)}`}{next < t && <span className="rlt-badge red">{diffDays(t, next)}日超過</span>}{str(l.nextNote) && `／${str(l.nextNote)}`}</>}
                    {str(l.note) && `　／　メモ：${str(l.note).slice(0, 60)}`}
                </div>
                {done ? (
                    <div className="rlt-cq-meta">
                        <b>{CQ_OUT[done].icon} {CQ_OUT[done].label}</b> を記録しました{next ? `（次回 ${fmtD(next)}／${str(l.nextNote)}）` : ''}
                    </div>
                ) : (
                    <>
                        <div className="rlt-cq-scr">
                            <span className="lb">一言目（{TAGL[top].lbl}）</span>
                            {scriptFor(scripts, l, top, company, me)}
                            <div style={{ marginTop: 6 }}><button className="rlt-btn sec" onClick={() => void copy(l, top)}>📋 コピー</button></div>
                        </div>
                        <div className="rlt-cq-btns">
                            {(['abs', 'talk', 'apo', 'end'] as Outcome[]).map(o => (
                                <button key={o} className={o} disabled={busy} onClick={() => void mark(key, o)}>
                                    {CQ_OUT[o].icon} {o === 'talk' ? '通電・継続' : o === 'apo' ? 'アポ獲得' : o === 'end' ? '終了確定' : '不在'}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    };

    const staffNames = (Array.isArray(settings.staff) ? settings.staff as { name?: string }[] : []).map(s => str(s.name)).filter(Boolean);

    return (
        <div className="rlt-page">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-phone me-2" style={{ color: '#0d6efd' }}></i>今日の架電キュー</h1>
                <p className="rlt-sub">上から順に、考えずに1件ずつ潰すための画面です。{fmtD(t)}</p>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head" style={{ alignItems: 'center' }}>
                    <h3>本日の対象 {keys.length}件<span className={`rlt-badge ${doneN ? 'green' : 'gray'}`}>記録済 {doneN}</span></h3>
                    <span className="rlt-cq-sp"></span>
                    <label className="rlt-note" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={ST.mine} onChange={e => rebuild(e.target.checked)} /> 自分の担当のみ{me ? `（${me}）` : ''}
                    </label>
                    <label className="rlt-note">件数 <input
                        key={conf.size} type="number" min={1} max={50} defaultValue={conf.size} className="rlt-input"
                        style={{ width: 64, textAlign: 'right' }} onBlur={e => { if (Number(e.target.value) !== conf.size) void setSize(e.target.value); }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    /></label>
                    <button className="rlt-btn sec" onClick={() => { rebuild(); showToast('本日の架電キューを再抽出しました'); }} disabled={busy}>🔄 再抽出</button>
                    {ST.undo && <button className="rlt-btn sec" onClick={() => void undo()} disabled={busy}>↩ 直前の記録を取消</button>}
                </div>
                <div className="rlt-body">
                    <div className="rlt-cq-meters">
                        <div className="rlt-cq-meter">
                            <div className="t"><span>今日の架電</span><span>{dg ? `目標 ${dg}件` : noGoal}</span></div>
                            <div className="v">{kd.calls}<small> 件</small></div>{bar(kd.calls, dg || null)}
                        </div>
                        <div className="rlt-cq-meter">
                            <div className="t"><span>今週の架電</span><span>{wg ? `目標 ${wg}件` : noGoal}</span></div>
                            <div className="v">{kw.calls}<small> 件</small></div>{bar(kw.calls, wg || null)}
                        </div>
                        <div className="rlt-cq-meter">
                            <div className="t"><span>接触確認率（今月）</span><span>確認 {km.contact}／{km.known}件</span></div>
                            <div className="v">{km.rate === null ? '―' : `${Math.round(km.rate * 100)}%`}<small> 🗣{km.talk}／📅{km.apo}／✅{km.end}／📵{km.abs}</small></div>
                        </div>
                        <div className="rlt-cq-meter">
                            <div className="t"><span>残りのキュー</span><span>全{keys.length}件</span></div>
                            <div className="v">{left}<small> 件</small></div>{bar(keys.length - left, keys.length || null)}
                        </div>
                    </div>

                    <div className="rlt-cq-note">
                        🎯 <b>この画面のゴールは「成約」ではなく「相手の今の状況を確認できたか」</b>です。
                        他社で決まった・売却をやめた、と分かることも前進なので、<b>✅終了確定も接触確認としてプラス計上</b>されます。<br />
                        4つのボタンを押すと、<b>架電記録・フェーズ・次回連絡予定日</b>までまとめて更新され、次の行へ進みます（📵不在→翌日／🗣通電→7日後／📅アポ→2日後に自動設定）。
                    </div>

                    {!keys.length ? (
                        <div className="rlt-cq-empty">
                            本日かける対象はありません。<br />
                            次回連絡予定日が今日以前のもの、まだ一度も架電していないもの、
                            予定日が未設定で売り{conf.staleSell}日／買い{conf.staleBuy}日以上ふれていないものが自動で並びます。
                        </div>
                    ) : (
                        <>
                            {!nextKey && (
                                <div className="rlt-cq-note done">
                                    🎉 本日ぶんはすべて記録できました（{keys.length}件）。次回連絡予定日は自動で入っています。追加でかける場合は「🔄 再抽出」を押してください。
                                </div>
                            )}
                            <div className="rlt-cq-list">{keys.map((k, i) => card(k, i))}</div>
                        </>
                    )}
                </div>
            </div>

            {toast && <div className="rlt-cq-toast" role="status">{toast}</div>}

            <LeadEdit
                isOpen={editing !== null}
                onClose={() => setEditing(null)}
                onSave={() => void saveEdit()}
                customerInfo={editing ?? {}}
                setCustomerInfo={setEditing}
                leadCategory={editing?.kind === 'buyLeads' ? 'buy' : 'sell'}
                staffList={staffNames}
            />
        </div>
    );
};

export default CallQueue;
```

### frontend/src/components/realty/callq/ContactQualityPanel.tsx（新規・全文）
```tsx
import React, { useEffect, useState } from 'react';
import { loadRecords } from '../common/realtyState';
import type { Row } from '../summary/kpi';
import { monthLabel } from '../summary/kpi';
import { contactKpi } from './callqLogic';
import type { ContactKpi } from './callqLogic';

/**
 * 📞 接触の質（週次行動計画に差し込む表。v2.2.226）。
 *
 * ⚠️ 移植元は以前のアプリの V16.weeklyPanel。主KPIは成約ではなく**接触確認率**
 *   ＝ 架電のうち相手の状況を確認できた割合（✅終了確定＝他決の判明も前進としてプラス計上）。
 * ⚠️ 売り・買いの両方の📞架電を、架電した人ごとに数える（callqLogic.ts の contactKpi）。
 *   「結果未記録」（📞架電ボタンだけで記録した架電）は分母に入れない。
 */

type Props = { month: string; names: string[] };

const FIELDS: (keyof ContactKpi)[] = ['calls', 'contact', 'known', 'talk', 'apo', 'end', 'abs', 'none'];

const rateCls = (r: number | null) => (r === null ? '' : r >= 0.5 ? 'rlt-ok' : r >= 0.3 ? 'rlt-mid' : 'rlt-bad');
const rateTxt = (r: number | null) => (r === null ? '―' : `${Math.round(r * 100)}%`);

const ContactQualityPanel: React.FC<Props> = ({ month, names }) => {
    const [rows, setRows] = useState<{ leads: Row[]; buyLeads: Row[] } | null>(null);

    useEffect(() => {
        loadRecords(['leads', 'buyLeads'])
            .then(r => setRows({ leads: r.records.leads, buyLeads: r.records.buyLeads }))
            .catch((e: Error) => alert(`接触の質を読み込めませんでした: ${e.message}`));
    }, []);

    const from = `${month}-01`;
    const to = `${month}-31`;
    const per = rows ? names.map(n => ({ n, k: contactKpi(rows.leads, rows.buyLeads, n, from, to) })) : [];
    const tot = per.reduce<Record<string, number>>((a, { k }) => {
        for (const f of FIELDS) a[f] = (a[f] ?? 0) + (k[f] as number);
        return a;
    }, {});
    const totRate = tot.known ? tot.contact / tot.known : null;

    return (
        <div className="rlt-card">
            <div className="rlt-card-head">
                <h3>📞 接触の質（{monthLabel(month)}）</h3>
                <span className="rlt-note">主KPIは成約ではなく<b>接触確認率</b>＝架電のうち相手の状況を確認できた割合（✅終了確定＝他決の判明も前進としてプラス計上）</span>
            </div>
            <div className="rlt-tblwrap">
                <table className="rlt-tbl">
                    <thead><tr>
                        <th>担当者</th><th className="r">📞架電</th><th className="r">接触確認</th><th className="r">接触確認率</th>
                        <th className="r">🗣通電</th><th className="r">📅アポ</th><th className="r">✅終了確定</th><th className="r">📵不在</th><th className="r">結果未記録</th>
                    </tr></thead>
                    <tbody>
                        {!rows && <tr><td colSpan={9} className="rlt-sub">読み込み中…</td></tr>}
                        {per.map(({ n, k }) => (
                            <tr key={n}>
                                <td>{n}</td><td className="r">{k.calls}</td><td className="r">{k.contact}</td>
                                <td className={`r ${rateCls(k.rate)}`}>{rateTxt(k.rate)}</td>
                                <td className="r">{k.talk}</td><td className="r">{k.apo}</td><td className="r">{k.end}</td>
                                <td className="r">{k.abs}</td><td className="r">{k.none || '―'}</td>
                            </tr>
                        ))}
                        {per.length > 0 && (
                            <tr className="total">
                                <td>チーム計</td><td className="r">{tot.calls}</td><td className="r">{tot.contact}</td>
                                <td className="r">{rateTxt(totRate)}</td>
                                <td className="r">{tot.talk}</td><td className="r">{tot.apo}</td><td className="r">{tot.end}</td>
                                <td className="r">{tot.abs}</td><td className="r">{tot.none || '―'}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="rlt-body rlt-note" style={{ paddingTop: 8 }}>
                「結果未記録」は📞架電ボタンだけで記録され、結果（不在／通電／アポ／終了）が入っていない件数です。分母には含めていません。結果は<b>📞今日の架電キュー</b>の4ボタンから記録されます。
            </div>
        </div>
    );
};

export default ContactQualityPanel;
```

### frontend/src/components/realty/navi/naviHost.ts（新規・全文）
```ts
/**
 * 架電ナビ（naviEngine.js）を開く窓口（v2.2.226）。
 *
 * ⚠️ ナビは1つだけ作り、架電キュー・架電ナビの一覧・売り反響の画面から使い回す（以前のアプリの V18 と同じく、
 *   閉じても入力中の内容は残る）。保存のあとは、開いた画面の onSaved を呼ぶ。
 * ⚠️ 反響（brokerage_listings の行）を以前のアプリの形に直して渡す（toNaviLead）。
 */
import { post } from '../common/realtyState';
import type { ApiBody } from '../common/realtyState';
import apiClient from '../../../utils/apiClient';
import { callsOf } from '../summary/kpi';
import type { Row } from '../summary/kpi';
import type { Outcome } from '../callq/callqLogic';
// ⚠️ 以前のアプリの書き方のままの JS（naviEngine.js の見出し）
import { createNavi } from './naviEngine';

type Navi = { open: (lead: Row | null) => void; hist: () => void };

type Ctx = {
    settings: Record<string, unknown>;
    me: string;
    onSaved?: (row: Row | null, oc: Outcome | null) => void;
};

let navi: Navi | null = null;
let ctx: Ctx = { settings: {}, me: '' };

const parseObj = (raw: unknown): Record<string, unknown> => {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
    if (typeof raw !== 'string' || raw.trim() === '') return {};
    try {
        const v: unknown = JSON.parse(raw);
        return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
    } catch {
        return {};
    }
};

/**
 * 売り反響の行 → 以前のアプリの形。
 *   callDates … JSON 文字列 → 配列
 *   detail    … ポータルの反響の詳細（年齢・面積・希望連絡時間など）。Dashboard に列が無いので原本（raw_data）から読む
 */
export const toNaviLead = (row: Row): Row => ({
    ...row,
    callDates: callsOf(row),
    detail: parseObj(parseObj(row.raw_data).detail),
});

/** 画面に出す知らせ（ナビを閉じたあと。以前のアプリの window.toast） */
const toast = (msg: string) => {
    const el = document.createElement('div');
    el.textContent = msg;
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#212529;color:#fff;padding:8px 18px;border-radius:6px;font-size:12px;z-index:3000;max-width:90vw';
    document.body.appendChild(el);
    window.setTimeout(() => el.remove(), 2600);
};

/** 保存の失敗。⚠️ 通信の失敗・② の障害（5xx）だけ retryable（未送信として残して送り直す）。入力の誤りは残さない */
class SaveError extends Error {
    retryable: boolean;
    constructor(message: string, retryable: boolean) {
        super(message);
        this.retryable = retryable;
    }
}

const save = async (payload: Record<string, unknown>): Promise<ApiBody> => {
    try {
        // ⚠️ ① を通ると {} が [] になるため、JSON は文字列で送る（② の parseJsonText）
        const res = await apiClient.post<ApiBody>('', { request: 'planner', roll: 'navi_save', json: JSON.stringify(payload) });
        if (res.data?.status === 'error') throw new SaveError(res.data.message || '保存に失敗しました', false);
        return res.data;
    } catch (e: unknown) {
        if (e instanceof SaveError) throw e;
        const r = (e as { response?: { status?: number; data?: ApiBody } })?.response;
        if (r && r.status !== undefined && r.status < 500) throw new SaveError(r.data?.message || '保存に失敗しました', false);
        throw new SaveError('通信に失敗しました', true);
    }
};

const ensure = (): Navi => {
    if (navi) return navi;
    navi = createNavi({
        me: () => ctx.me,
        settings: () => ctx.settings,
        save,
        loadLogs: async (from: string, to: string) => ((await post('call_logs', { from, to })).logs as Row[]) ?? [],
        onSaved: (row: Row | null, oc: Outcome | null) => ctx.onSaved?.(row, oc),
        toast,
    }) as Navi;
    return navi;
};

/** 架電ナビを開く。lead が null なら「反響を選ばずに開始」 */
export const openNavi = (args: Ctx & { lead: Row | null }): void => {
    ctx = { settings: args.settings, me: args.me, onSaved: args.onSaved };
    ensure().open(args.lead ? toNaviLead(args.lead) : null);
};

/** 通話履歴・分析だけを開く */
export const openNaviHistory = (args: Ctx): void => {
    ctx = { settings: args.settings, me: args.me, onSaved: args.onSaved };
    ensure().hist();
};
```

### frontend/src/components/realty/navi/CallNavi.tsx（新規・全文）
```tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AuthContext from '../../../context/AuthContext';
import { REALTY_CSS, loadRecords } from '../common/realtyState';
import { todayStr } from '../summary/kpi';
import type { Row } from '../summary/kpi';
import { callsOnly, sameName } from '../callq/callqLogic';
import { openNavi, openNaviHistory } from './naviHost';

/**
 * 🧭 架電ナビ（一括査定）の起動用の一覧（不動産企画係。v2.2.226）。
 *
 * ⚠️ 移植元は以前のアプリの V18.paint。売り反響を選んでナビを始める。ナビ本体は naviEngine.js（全画面で重ねて出す）。
 * ⚠️ 並び順: 未架電 → 次回連絡予定日が今日以前 → その他（受信日の新しい順）。150件まで（以前のアプリと同じ）
 * ⚠️ ロープレ練習・練習の成績は移行中（2026-10-28 の利用者の判断）。ボタンは出すが押せない
 */

const STYLE = `
.rlt-nv-tbl td.c, .rlt-nv-tbl th.c { text-align: center; }
.rlt-nv-tbl td.trunc { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rlt-badge { display: inline-block; border-radius: 10px; padding: 1px 8px; font-size: 10px; font-weight: bold; }
.rlt-badge.navy { background: #cfe2ff; color: #084298; } .rlt-badge.red { background: #f8d7da; color: #842029; }
.rlt-badge.gray { background: #e9ecef; color: #6c757d; }
`;

const OFF = ['媒介受託', '追客終了'];
const LIMIT = 150;

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const fmtD = (ds: unknown): string => {
    const s = str(ds).slice(0, 10);
    const [y, m, d] = s.split('-');
    return d ? `${y}/${Number(m)}/${Number(d)}` : (s || '―');
};

const CallNavi: React.FC = () => {
    const { userName } = useContext(AuthContext);
    const [leads, setLeads] = useState<Row[]>([]);
    const [settings, setSettings] = useState<Record<string, unknown>>({});
    const [loading, setLoading] = useState(true);
    const [mine, setMine] = useState(true);
    const [q, setQ] = useState('');

    const load = useCallback(async () => {
        try {
            const rec = await loadRecords(['leads']);
            setLeads(rec.records.leads);
            setSettings(rec.settings as Record<string, unknown>);
        } catch (e) {
            alert(`読み込めませんでした: ${(e as Error).message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const me = useMemo(() => {
        const list = Array.isArray(settings.staff) ? settings.staff as { name?: string }[] : [];
        return list.find(s => s.name && sameName(s.name, userName || ''))?.name ?? (userName || '');
    }, [settings.staff, userName]);

    const t = todayStr();
    const list = useMemo(() => {
        let ls = leads.filter(l => !OFF.includes(str(l.phase)));
        if (mine && me) ls = ls.filter(l => sameName(str(l.staff), me));
        const rank = (l: Row) => {
            const n = callsOnly(l).length;
            const next = str(l.nextDate).slice(0, 10);
            return !n ? 0 : next && next <= t ? 1 : 2;
        };
        return ls.sort((a, b) => rank(a) - rank(b) || str(b.receivedDate).localeCompare(str(a.receivedDate)));
    }, [leads, mine, me, t]);

    const shown = useMemo(() => {
        const v = q.trim();
        const top = list.slice(0, LIMIT);
        return v ? top.filter(l => [l.name, l.addr, l.contact, l.source].map(str).join(' ').includes(v)) : top;
    }, [list, q]);

    const onSaved = (row: Row | null) => {
        if (row) setLeads(prev => prev.map(x => (str(x.id) === str(row.id) ? row : x)));
    };
    const start = (lead: Row | null) => openNavi({ lead, settings, me, onSaved });

    if (loading) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const pendingTitle = '移行中です。ロープレ練習は以前のアプリを使ってください';

    return (
        <div className="rlt-page">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-compass me-2" style={{ color: '#0d6efd' }}></i>架電ナビ</h1>
                <p className="rlt-sub">一括査定反響への初回架電を、トークマニュアルの①〜⑨に沿って伴走します。売り反響を選んで開始してください。</p>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head" style={{ alignItems: 'center' }}>
                    <h3>売り反響（追客中 {list.length}件）</h3>
                    <span style={{ flex: 1 }}></span>
                    <label className="rlt-note" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> 自分の担当のみ{me ? `（${me}）` : ''}
                    </label>
                    <input className="rlt-input" placeholder="氏名・住所・電話で絞り込み" value={q} onChange={e => setQ(e.target.value)} style={{ width: 220 }} />
                    <button className="rlt-btn sec" onClick={() => start(null)}>反響を選ばずに開始</button>
                    <button className="rlt-btn sec" onClick={() => openNaviHistory({ settings, me })}>📊 通話履歴・分析</button>
                    <button className="rlt-btn sec" disabled title={pendingTitle}>🎧 ロープレ練習（移行中）</button>
                    <button className="rlt-btn sec" disabled title={pendingTitle}>🎧 練習の成績（移行中）</button>
                </div>
                <div className="rlt-tblwrap">
                    <table className="rlt-tbl rlt-nv-tbl">
                        <thead><tr>
                            <th>受信日</th><th>反響元</th><th>売主候補</th><th>フェーズ</th><th className="c">架電</th>
                            <th className="c">次回連絡</th><th>物件所在地</th><th>区分</th><th></th>
                        </tr></thead>
                        <tbody>
                            {shown.length === 0 && <tr><td colSpan={9} className="rlt-sub" style={{ textAlign: 'center', padding: 16 }}>追客中の売り反響はありません。</td></tr>}
                            {shown.map(l => {
                                const n = callsOnly(l).length;
                                const next = str(l.nextDate).slice(0, 10);
                                return (
                                    <tr key={str(l.id)}>
                                        <td>{fmtD(l.receivedDate)}</td>
                                        <td>{str(l.source)}</td>
                                        <td className="trunc"><b>{str(l.name)}</b></td>
                                        <td>{str(l.phase)}</td>
                                        <td className="c">{n || <span className="rlt-badge navy">初回</span>}</td>
                                        <td className="c">{next ? (next <= t ? <span className="rlt-badge red">{fmtD(next)}</span> : fmtD(next)) : '―'}</td>
                                        <td className="trunc" title={str(l.addr)}>{str(l.addr)}</td>
                                        <td>{str(l.category)}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}><button className="rlt-btn sec" onClick={() => start(l)}>🧭 ナビで架電</button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="rlt-sub" style={{ padding: '8px 16px' }}>
                    並び順：未架電 → 次回連絡予定日が今日以前 → その他（受信日の新しい順）。「記録して次へ」で架電記録・フェーズ・次回連絡予定日が更新され、📞今日の架電キューと週次行動計画の架電実績にも反映されます。
                    文字起こしの全文は売り反響には保存せず、通話記録にだけ保存します（通話記録は不動産企画係の全員が「通話履歴・分析」で見られます）。
                </p>
            </div>
        </div>
    );
};

export default CallNavi;
```

### frontend/src/components/realty/settings/RealtyLogImport.tsx（新規・全文）
```tsx
import React, { useState } from 'react';
import { post } from '../common/realtyState';

/**
 * 以前のアプリの通話記録・練習記録（CSV）を取り込む（不動産企画係の設定画面。v2.2.226。マスターだけ）。
 *
 * ⚠️ 元のファイル: 以前のアプリの Supabase の表 call_logs（架電ナビの通話記録）・practice_logs（ロープレ練習の記録）を
 *   Supabase の画面から CSV で書き出したもの。列名はその表のまま（id・created_at・staff …）。
 * ⚠️ id で二重取り込みを防ぐ（② の features/realty/calls.ts）。同じファイルを何度流しても増えない。
 * ⚠️ 練習記録は、練習の画面（移行中）を移したときに使う。いまは取り込んで残すだけ。
 */

type Kind = 'call' | 'practice';
/** need = 無ければ別のファイルとみなす列 */
const KINDS: Record<Kind, { label: string; roll: string; need: string[] }> = {
    call: { label: '通話記録（call_logs）', roll: 'call_logs_import', need: ['id', 'created_at', 'outcome'] },
    practice: { label: '練習記録（practice_logs）', roll: 'practice_logs_import', need: ['id', 'created_at', 'mode'] },
};

const BATCH = 200;

/** CSV を読む（RFC 4180。"…" の中の , と改行と "" を扱う）。1行目は列名 */
const parseCsv = (text: string): Record<string, string>[] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    const t = text.replace(/^﻿/, '');
    for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (quoted) {
            if (ch === '"') {
                if (t[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
            } else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && t[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            if (row.some(c => c !== '')) rows.push(row);
            row = [];
        } else cell += ch;
    }
    row.push(cell);
    if (row.some(c => c !== '')) rows.push(row);
    const [head, ...body] = rows;
    if (!head) return [];
    return body.map(r => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
};

type Parsed = { kind: Kind; name: string; rows: Record<string, string>[] };

const RealtyLogImport: React.FC = () => {
    const [kind, setKind] = useState<Kind>('call');
    const [parsed, setParsed] = useState<Parsed | null>(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState('');
    const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

    const onFile = async (file: File | undefined) => {
        setParsed(null);
        setResult(null);
        setProgress('');
        if (!file) return;
        const rows = parseCsv(await file.text());
        if (!rows.length) { alert('行がありません'); return; }
        const missing = KINDS[kind].need.filter(c => !(c in rows[0]));
        if (missing.length) {
            alert(`${KINDS[kind].label}の CSV ではないようです（${missing.join('・')} の列がありません）`);
            return;
        }
        setParsed({ kind, name: file.name, rows });
    };

    const run = async () => {
        if (!parsed) return;
        if (!window.confirm(`${KINDS[parsed.kind].label}を ${parsed.rows.length.toLocaleString()} 件取り込みます。すでにある記録（同じ id）は飛ばします。よろしいですか？`)) return;
        setBusy(true);
        const total = { inserted: 0, skipped: 0 };
        try {
            for (let i = 0; i < parsed.rows.length; i += BATCH) {
                setProgress(`${Math.min(i + BATCH, parsed.rows.length).toLocaleString()} / ${parsed.rows.length.toLocaleString()} 件`);
                // ⚠️ ① を通ると {} が [] になるため、1行ずつ JSON の文字列で送る
                const d = await post(KINDS[parsed.kind].roll, { rows: parsed.rows.slice(i, i + BATCH).map(r => JSON.stringify(r)) });
                total.inserted += Number(d.inserted) || 0;
                total.skipped += Number(d.skipped) || 0;
            }
            setResult(total);
        } catch (e) {
            alert(`途中で止まりました（${total.inserted} 件まで取り込み済み。もう一度流すと続きから入ります）: ${(e as Error).message}`);
            setResult(total);
        } finally {
            setBusy(false);
            setProgress('');
        }
    };

    return (
        <div className="rlt-card">
            <div className="rlt-card-head">
                <h3>以前のアプリの通話記録・練習記録を取り込む（CSV）</h3>
                <span className="rlt-note">マスターだけ。Supabase の call_logs・practice_logs を CSV で書き出したファイル。同じ記録は二重に入りません</span>
            </div>
            <div className="rlt-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {(Object.keys(KINDS) as Kind[]).map(k => (
                        <label key={k} style={{ cursor: 'pointer' }}>
                            <input type="radio" name="rlt-log-kind" checked={kind === k} disabled={busy}
                                onChange={() => { setKind(k); setParsed(null); setResult(null); }} /> {KINDS[k].label}
                        </label>
                    ))}
                </div>
                {/* ⚠️ 選んだら空に戻す（同じファイルを選び直しても読み直すように） */}
                <input key={kind} type="file" accept=".csv,text/csv" disabled={busy}
                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void onFile(f); }} />
                {parsed && (
                    <div>
                        {parsed.name}：<b>{parsed.rows.length.toLocaleString()} 件</b>
                        <button className="rlt-btn" style={{ marginLeft: 8 }} disabled={busy} onClick={() => void run()}>取り込む</button>
                        {progress && <span className="rlt-note" style={{ marginLeft: 8 }}>{progress}</span>}
                    </div>
                )}
                {result && <div className="rlt-saved">取り込みました：新しく入れた {result.inserted.toLocaleString()} 件／すでにあった {result.skipped.toLocaleString()} 件</div>}
                <p className="rlt-sub">
                    練習記録は、ロープレ練習の画面（移行中）を移したときに使います。いまは取り込んで残すだけです。
                </p>
            </div>
        </div>
    );
};

export default RealtyLogImport;
```

### frontend/src/components/realty/navi/naviEngine.js（新規・全文。⚠️ 台本の部分は以前のアプリの V18 のまま）
```js
/* eslint-disable */
/**
 * 🧭 架電ナビ（一括査定の初回架電を伴走）の本体（v2.2.226）。
 *
 * ⚠️ 移植元は以前のアプリ（khf-eigyokanri.netlify.app。V18 / kaden-navi v6）の V18。
 *   トークの台本・切り返し・自動聞き取り・画面の作りは**そのまま写している**（以前のアプリが最優先。2026-10-28 の方針）。
 *   ⚠️ 台本を直すときは、以前のアプリと同じく STEPS・HEAR・HOOKS・TALK・RB・TRIG を直す。
 * ⚠️ 以前のアプリと同じく Shadow DOM の中に画面を作り、全画面で重ねて出す（Dashboard の CSS と混ざらない）。
 *   そのため React ではなく、以前のアプリの書き方（文字列で HTML を組む）のまま。開き方は naviHost.ts。
 * ⚠️ 以前のアプリから変えたところ:
 *   ・保存先: Supabase（別のログイン）→ ② の planner:navi_save（Dashboard のログイン）。反響の書き換えも ② が行う
 *   ・通話記録の読み出し: ② の planner:call_logs。ログイン・ログアウトの画面は無くした
 *   ・ロープレ練習（AI が売主役）: 移行中（ボタンは押せない。2026-10-28 の利用者の判断）
 *   ・色・角丸を Dashboard に寄せた（KN_CSS の最後）
 * ⚠️ 自動聞き取りはブラウザの音声認識（声は Google / Microsoft に送られて文字になる）。以前のアプリと同じ（2026-10-28 の利用者の判断）
 *
 * A（naviHost.ts が渡す）:
 *   me()            … 自分の名前（設定の担当者名）
 *   settings()      … 不動産企画係の設定（担当者の略称・会社名）
 *   save(payload)   … planner:navi_save。失敗は Error（retryable = true なら未送信として残す）
 *   loadLogs(f, t)  … planner:call_logs（'YYYY-MM-DD' 〜 'YYYY-MM-DD'）
 *   onSaved(row, oc)… 記録できたあと（row = 書き換えた売り反響。oc = 架電キューの結果）
 *   toast(msg)      … ナビを閉じたあとに出す知らせ
 */
import { CQ_OUT, callOutcome, callType, diffDays } from '../callq/callqLogic';
import { todayStr } from '../summary/kpi';

/** 終了理由（以前のアプリの LEAD_ENDS） */
const LEAD_ENDS = ['他決', '辞退・売却中止', '連絡不能', '対象外', 'その他'];

const fmtD = ds => { if (!ds) return '―'; const [y, m, d] = String(ds).slice(0, 10).split('-'); if (!d) return String(ds); return y + '/' + Number(m) + '/' + Number(d); };
const callVal = c => (c && typeof c === 'object') ? String(c.date || '') : String(c == null ? '' : c);
const fmtDT = v => { const x = callVal(v); if (!x) return '―'; return x.length > 10 ? fmtD(x) + ' ' + x.slice(11, 16) : fmtD(x); };

/* アポを Google カレンダーへ（以前のアプリの gcalUrl） */
const CAL_DEF_TIME = '10:00';
const calPad = n => String(n).padStart(2, '0');
const calStamp = d => d.getFullYear() + calPad(d.getMonth() + 1) + calPad(d.getDate()) + 'T' + calPad(d.getHours()) + calPad(d.getMinutes()) + '00';
function gcalUrl(o) {
  const ds = String(o.date || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return '';
  let tm = String(o.time || '').trim(); if (!/^\d{1,2}:\d{2}$/.test(tm)) tm = CAL_DEF_TIME;
  const s = new Date(ds + 'T' + tm.padStart(5, '0') + ':00'), e = new Date(s.getTime() + (o.min || 60) * 60000);
  const dates = calStamp(s) + '/' + calStamp(e);
  const app = /^https?:/.test(location.protocol) ? location.origin + location.pathname : '';
  const det = (o.details || []).filter(x => x && String(x).trim()).concat(app ? ['Dashboard：' + app] : []).join('\n');
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(o.title || '') +
    '&dates=' + dates + '&ctz=Asia%2FTokyo' + (det ? '&details=' + encodeURIComponent(det) : '') + (o.location ? '&location=' + encodeURIComponent(o.location) : '');
}

/** 架電ナビを作る（1つだけ作って使い回す。naviHost.ts） */
export function createNavi(A) {
const staffList = () => { const st = A.settings(); return Array.isArray(st && st.staff) ? st.staff : []; };

const KN_CSS=`
:host{
  --ink:#212529; --body:#343a40; --sub:#6c757d; --rule:#dee2e6; --panel:#f8f9fa; --paper:#fff; --accent:#0d6efd; --accent-dark:#0b5ed7;
  --mark:#fff176; --mark-soft:#fffbd1;
  --f:"Yu Gothic UI","Yu Gothic","游ゴシック","YuGothic","Hiragino Sans","Noto Sans JP",sans-serif;
}
*{box-sizing:border-box}
.kn-app{height:100%;overflow:auto;position:relative;font-family:var(--f);font-weight:500;color:var(--body);background:var(--paper);font-size:14px;line-height:1.6}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:2px solid var(--ink);outline-offset:2px}

/* header */
.top{position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:2px solid var(--ink)}
.bar{display:flex;align-items:center;gap:12px;padding:8px 14px}
.brand{font-weight:700;color:var(--ink);font-size:16px;letter-spacing:.02em;white-space:nowrap}
.brand small{font-weight:500;color:var(--sub);font-size:12px;margin-left:8px}
.spacer{flex:1}
.timer{font-variant-numeric:tabular-nums;font-weight:700;font-size:18px;color:var(--ink);min-width:62px;text-align:right}
.btn{border:1px solid var(--ink);background:var(--paper);padding:5px 12px;border-radius:3px;white-space:nowrap}
.btn:hover{background:var(--panel)}
.btn.solid{background:var(--ink);color:#fff}
.btn.solid:hover{background:#333}
.btn.sm{padding:2px 8px;font-size:12px}
.info{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px 10px;padding:0 14px 8px}
.info label{display:flex;flex-direction:column;font-size:11px;color:var(--sub)}
.info input,.info select{border:0;border-bottom:1px solid var(--rule);padding:3px 0;background:transparent;font-size:14px;color:var(--ink);min-width:0}
.info input:focus,.info select:focus{border-bottom-color:var(--ink);outline:none}
.info .w2{grid-column:span 2}
.prog{display:flex;gap:4px;padding:0 14px 8px;flex-wrap:wrap;align-items:center}
.prog span.lb{font-size:11px;color:var(--sub);margin-right:4px}
.chip{border:1px solid var(--rule);background:var(--paper);color:var(--sub);font-size:12px;padding:1px 9px;border-radius:10px}
.chip.ok{background:var(--ink);border-color:var(--ink);color:#fff}

/* layout */
.main{display:grid;grid-template-columns:210px minmax(0,1fr) 340px;min-height:calc(100vh - 150px)}
.steps{border-right:1px solid var(--rule);padding:10px 0}
.steps ol{list-style:none;margin:0;padding:0}
.steps button{display:flex;gap:8px;width:100%;text-align:left;border:0;background:none;padding:7px 14px;align-items:baseline}
.steps .no{font-weight:700;color:var(--sub);width:18px;flex:none}
.steps .nm{color:var(--body)}
.steps .nm small{display:block;font-size:11px;color:var(--sub);line-height:1.3}
.steps button:hover{background:var(--panel)}
.steps button.cur{background:var(--ink)}
.steps button.cur .no,.steps button.cur .nm,.steps button.cur small{color:#fff}
.steps button.key{box-shadow:inset 4px 0 0 var(--mark)}
.judge{margin:14px 14px 0;padding:10px 0 0;border-top:1px solid var(--rule);font-size:12px}
.judge dt{color:var(--sub)}
.judge dd{margin:0 0 6px;color:var(--ink);font-weight:700}

.stage{padding:18px 28px 80px;min-width:0}
.stage h2{margin:0 0 4px;font-size:22px;color:var(--ink);font-weight:700;display:flex;align-items:baseline;gap:10px}
.stage h2 .n{font-size:30px;line-height:1}
.goal{color:var(--sub);margin:0 0 16px;font-size:13px}
.stage h3{font-size:14px;color:var(--ink);margin:22px 0 8px;padding-bottom:3px;border-bottom:1px solid var(--rule)}
.say{font-size:17px;line-height:1.85;color:var(--ink);font-weight:600;max-width:44em;margin:0 0 10px}
.say .t{background:linear-gradient(transparent 12%,var(--mark) 12%,var(--mark) 92%,transparent 92%);box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:0 2px}
.cust{color:var(--sub);margin:0 0 10px 1.2em;max-width:42em}
.note{color:var(--body);font-size:13px;margin:0 0 10px;padding-left:12px;border-left:2px solid var(--rule);max-width:44em}
.warn{color:var(--ink);font-size:13px;font-weight:700;margin:0 0 12px;padding:6px 10px;border-left:4px solid var(--ink);background:var(--panel);max-width:44em}
.ph{border:1px dashed var(--sub);padding:0 3px;color:var(--sub);font-weight:500}
.fv{text-decoration:underline;text-underline-offset:3px}
.seg{display:inline-flex;border:1px solid var(--ink);border-radius:3px;overflow:hidden;margin:0 0 12px;flex-wrap:wrap}
.seg button{border:0;border-right:1px solid var(--ink);background:var(--paper);padding:4px 14px}
.seg button:last-child{border-right:0}
.seg button.on{background:var(--ink);color:#fff}
.seglb{font-size:12px;color:var(--sub);margin-right:8px}
.row{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;margin:0 0 10px}
.fld{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--sub)}
.fld input,.fld select{border:0;border-bottom:1px solid var(--ink);padding:2px 2px;min-width:120px;color:var(--ink);background:transparent}
.fld input:focus{outline:none;background:var(--mark-soft)}
.ck{list-style:none;margin:0 0 8px;padding:0;max-width:52em}
.ck li{display:grid;grid-template-columns:22px minmax(0,1.1fr) minmax(0,1fr);gap:8px;align-items:center;padding:4px 0;border-bottom:1px dotted var(--rule)}
.ck input[type=checkbox]{width:16px;height:16px;accent-color:#000}
.ck label{cursor:pointer}
.ck li.done label{color:var(--sub);text-decoration:line-through}
.ck input[type=text]{border:0;border-bottom:1px solid transparent;background:transparent;padding:2px;min-width:0}
.ck input[type=text]:hover{border-bottom-color:var(--rule)}
.ck input[type=text]:focus{outline:none;border-bottom-color:var(--ink);background:var(--mark-soft)}
.hooks{margin:0 0 10px;padding-left:1.3em;max-width:46em}
.hooks li{margin:0 0 4px;color:var(--ink)}
.feel{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px;max-width:52em}
.feel span{border:1px solid var(--rule);padding:1px 8px;border-radius:10px;font-size:12px}
.nav{display:flex;gap:10px;margin-top:28px}
.draft{font-size:11px;border:1px solid var(--sub);color:var(--sub);padding:0 5px;border-radius:2px;margin-left:6px;font-weight:500;vertical-align:middle}

/* rebuttal pinned */
.rb{border:2px solid var(--ink);margin:0 0 22px;padding:12px 16px 6px;position:relative;background:var(--paper)}
.rb .ttl{font-size:18px;font-weight:700;color:var(--ink);margin:0 70px 8px 0}
.rb .ttl::before{content:"切り返し";font-size:11px;background:var(--ink);color:#fff;padding:1px 6px;margin-right:8px;vertical-align:middle;font-weight:500}
.rb .x{position:absolute;right:10px;top:10px}
.rb h4{margin:12px 0 6px;font-size:13px;background:var(--panel);padding:3px 8px;color:var(--ink)}

/* side */
.side{border-left:1px solid var(--rule);display:flex;flex-direction:column;min-width:0}
.tabs{display:flex;border-bottom:1px solid var(--ink)}
.tabs button{flex:1;border:0;background:var(--panel);padding:8px;border-right:1px solid var(--rule)}
.tabs button.on{background:var(--ink);color:#fff}
.pane{padding:12px 14px;overflow:auto}
.search{width:100%;border:1px solid var(--ink);padding:7px 10px;border-radius:3px;margin-bottom:10px}
.search:focus{outline:none;background:var(--mark-soft)}
.rblist{list-style:none;margin:0;padding:0}
.rblist button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--rule);background:none;padding:9px 4px;color:var(--ink);font-weight:600}
.rblist button:hover,.rblist button.on{background:var(--panel)}
.rblist .grp{font-size:11px;color:var(--sub);font-weight:700;padding:12px 4px 3px;border-bottom:1px solid var(--ink)}
.rblist .grp:first-child{padding-top:2px}
.rblist .k{display:block;font-size:11px;color:var(--sub);font-weight:500}
.hint{font-size:11px;color:var(--sub);margin-top:12px}
kbd{border:1px solid var(--rule);border-bottom-width:2px;padding:0 4px;border-radius:3px;font-family:inherit;font-size:11px}
.memo{width:100%;min-height:360px;border:1px solid var(--rule);padding:10px;font-size:13px;line-height:1.7;resize:vertical;background:var(--panel)}
.sms{width:100%;min-height:150px;border:1px solid var(--ink);padding:10px;font-size:14px;line-height:1.7;max-width:44em}
.cnt{font-size:12px;color:var(--sub);margin:4px 0 10px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;padding:8px 18px;border-radius:3px;opacity:0;pointer-events:none;transition:opacity .15s}
.toast.on{opacity:1}

/* 自動聞き取り */
#micBtn.live{background:var(--ink);color:#fff}
#micBtn.live::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#fff;margin-right:6px;vertical-align:middle;animation:pulse 1.2s infinite}
@keyframes pulse{50%{opacity:.25}}
.lbar{position:sticky;top:var(--hh,150px);z-index:3;background:var(--paper);border:1px solid var(--ink);padding:8px 12px 10px;margin:0 0 18px}
.lbar .st{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--sub)}
.lbar .st b{color:var(--ink)}
.lbar .st .sp{flex:1}
.lbar .last{font-size:15px;color:var(--ink);margin:6px 0 8px;line-height:1.6;min-height:1.6em}
.lbar .last .im{color:var(--sub)}
.cands{display:flex;flex-wrap:wrap;gap:6px}
.cand{border:1px solid var(--ink);background:var(--mark);padding:3px 10px;border-radius:3px;font-weight:600;color:var(--ink)}
.cand small{font-weight:500;margin-right:4px}
.cand.ghost{background:var(--paper)}
.trl{list-style:none;padding:0;margin:0 0 10px;max-height:62vh;overflow:auto;font-size:13px}
.trl li{padding:5px 0;border-bottom:1px dotted var(--rule)}
.trl time{color:var(--sub);font-size:11px;margin-right:6px;font-variant-numeric:tabular-nums}
.trl mark{background:var(--mark);color:inherit}
.trl .im{color:var(--sub)}
@media (prefers-reduced-motion:reduce){#micBtn.live::before{animation:none}}
/* 記録・履歴 */
dialog{border:2px solid var(--ink);padding:18px 20px;max-width:560px;width:calc(100% - 32px);border-radius:3px}
dialog::backdrop{background:rgba(0,0,0,.35)}
dialog h3{margin:0 0 12px;font-size:17px;color:var(--ink)}
dialog .fld input,dialog .fld textarea{min-width:0;width:100%}
.stack{display:flex;flex-direction:column;gap:10px}
.stack .fld{flex-direction:column;align-items:stretch;gap:2px}
.dlgbtns{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}
.err{color:var(--ink);font-weight:700;font-size:13px;min-height:1.2em;margin:4px 0 0}
.qbadge{font-size:12px;border:1px solid var(--ink);padding:1px 8px;border-radius:10px;background:var(--mark)}
.hist{position:fixed;inset:0;z-index:20;background:var(--paper);overflow:auto}
.hbar{position:sticky;top:0;background:var(--paper);display:flex;gap:10px;align-items:center;padding:10px 16px;border-bottom:2px solid var(--ink);z-index:1}
.hbar b{font-size:16px;color:var(--ink)}
.hfil{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--rule)}
.hfil select,.hfil input{border:0;border-bottom:1px solid var(--ink);padding:3px 2px;background:transparent}
.hb{padding:14px 16px 60px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px}
.kpi{border:1px solid var(--ink);padding:10px 12px}
.kpi span{display:block;font-size:12px;color:var(--sub)}
.kpi b{font-size:26px;color:var(--ink);font-variant-numeric:tabular-nums}
.tbls{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:18px;margin-bottom:22px}
table.t{border-collapse:collapse;width:100%;font-size:13px}
table.t caption{text-align:left;font-weight:700;color:var(--ink);padding:0 0 4px}
table.t th,table.t td{border-bottom:1px solid var(--rule);padding:4px 6px;text-align:left;white-space:nowrap}
table.t th{background:var(--panel);font-weight:600;color:var(--ink)}
table.t td.n,table.t th.n{text-align:right;font-variant-numeric:tabular-nums}
.bar-in{display:inline-block;height:8px;background:var(--ink);vertical-align:middle;margin-left:6px}
.scr{overflow-x:auto}
table.list tbody tr{cursor:pointer}
table.list tbody tr:hover{background:var(--mark-soft)}
.detail pre{white-space:pre-wrap;font-family:inherit;background:var(--panel);padding:10px;font-size:13px;margin:0 0 12px}
#dlgDetail{max-width:760px}
@media (max-width:1180px){
  .main{grid-template-columns:180px minmax(0,1fr) 300px}
  .info{grid-template-columns:repeat(4,minmax(0,1fr))}
}
@media (max-width:920px){
  .main{grid-template-columns:1fr}
  .steps{border-right:0;border-bottom:1px solid var(--rule);padding:0;overflow-x:auto}
  .steps ol{display:flex}
  .steps button{flex-direction:column;gap:0;min-width:92px;padding:6px 10px}
  .steps .nm small,.judge{display:none}
  .side{border-left:0;border-top:1px solid var(--ink)}
  .stage{padding:16px 16px 40px}
}
@media (max-width:560px){
  .info{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ck li{grid-template-columns:22px 1fr}
  .ck li input[type=text]{grid-column:2}
  .brand small{display:none}
}
@media (prefers-reduced-motion:reduce){.toast{transition:none}}

/* v14.18 営業管理システム連携 */
.leadbar{display:flex;flex-wrap:wrap;gap:3px 14px;padding:0 14px 8px;font-size:12px;color:var(--body)}
.leadbar a{color:var(--ink);font-weight:700}
.lbk{background:var(--ink);color:#fff;padding:0 6px}

/* v2.2.226 Dashboard の見た目に寄せる（色・角丸だけ。並び・文字の大きさは以前のアプリのまま） */
.top{border-bottom-color:var(--accent)}
.btn,.seg,.search,.sms,dialog{border-radius:4px}
.btn{border-color:#ced4da}
.btn:disabled{opacity:.55;cursor:not-allowed}
.btn.solid,.steps button.cur,.seg button.on,.tabs button.on,#micBtn.live,.chip.ok,.lbk,.rb .ttl::before{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.solid:hover{background:var(--accent-dark)}
.tabs{border-bottom-color:var(--accent)}
.rb{border-color:var(--accent);border-radius:6px}
.lbar{border-color:var(--accent);border-radius:6px}
.hbar{border-bottom-color:var(--accent)}
.kpi{border-color:var(--rule);border-radius:6px}
.bar-in{background:var(--accent)}
.warn{border-left-color:#ffc107;background:#fff8e1}

.stack[hidden]{display:none}
`;
const KN_HTML=`
<div class="kn-app" id="app">
<header class="top">
  <div class="bar">
    <div class="brand">一括査定 架電ナビ<small>国分ハウジング不動産／社外持出禁止</small></div>
    <div class="spacer"></div>
    <button class="btn" id="pracBtn" disabled title="移行中です。ロープレ練習は以前のアプリを使ってください">🎧 練習（移行中）</button>
    <button class="btn" id="micBtn" title="M キー">自動聞き取り</button>
    <span class="timer" id="timer">00:00</span>
    <button class="btn" id="tBtn">通話開始</button>
    <span id="qInfo"></span>
    <button class="btn" id="histBtn">履歴・分析</button>
    <button class="btn solid" id="resetBtn">記録して次へ</button>
    <button class="btn" id="closeBtn" title="画面を閉じる（入力内容は残ります）">✕ 閉じる</button>
  </div>
  <div class="info" id="info">
    <label>お客様名<input data-f="name" placeholder="山田"></label>
    <label>媒体<input data-f="media" list="mediaList" placeholder="イエウール等"></label>
    <label>担当者<input data-f="staff" list="staffList" placeholder="時任"></label>
    <label class="w2">物件住所<input data-f="addr" placeholder="鹿児島市〇〇1丁目1-10"></label>
    <label>マンション名<input data-f="ms" placeholder="（MSのみ）"></label>
    <label>部屋番号<input data-f="room" placeholder="501"></label>
    <label>最寄駅・エリア<input data-f="station" placeholder="谷山駅"></label>
  </div>
  <div class="leadbar" id="leadBar"></div>
  <div class="prog" id="prog"></div>
  <datalist id="staffList"></datalist>
  <datalist id="mediaList"><option>イエウール</option><option>HOME4U</option><option>すまいValue</option><option>リビンマッチ</option><option>SUUMO売却査定</option><option>LIFULL HOME'S</option><option>自社HP</option></datalist>
</header>

<div class="main">
  <nav class="steps" aria-label="架電フロー"><ol id="stepList"></ol>
    <dl class="judge" id="judge"></dl>
  </nav>
  <main class="stage"><div id="lbar"></div><div id="stage"></div></main>
  <aside class="side">
    <div class="tabs"><button data-tab="rb" class="on">切り返し</button><button data-tab="tr">文字起こし</button><button data-tab="memo">通話メモ</button></div>
    <div class="pane" id="paneRb">
      <input class="search" id="rbSearch" placeholder="お客様の言葉を入力（例：送って）" autocomplete="off">
      <ul class="rblist" id="rbList"></ul>
      <p class="hint"><kbd>/</kbd> 検索　<kbd>Enter</kbd> 先頭を表示　<kbd>Esc</kbd> 閉じる　<kbd>←</kbd><kbd>→</kbd> ステップ移動　<kbd>1</kbd>〜<kbd>9</kbd> ステップへ　<kbd>M</kbd> 自動聞き取り</p>
    </div>
    <div class="pane" id="paneTr" hidden>
      <ul class="trl" id="trList"></ul>
      <div class="row"><button class="btn solid" data-copy="tr">文字起こしをコピー</button><button class="btn" id="trClear">クリア</button></div>
      <label class="fld"><input type="checkbox" id="trInMemo" style="min-width:0"> 通話メモに文字起こしを含める</label>
      <p class="hint">スマホをスピーカー通話にしてPCの近くに置いてください。営業と顧客の声は区別されません。音声認識はPCの既定のマイクを使います。</p>
    </div>
    <div class="pane" id="paneMemo" hidden>
      <textarea class="memo" id="memo" readonly></textarea>
      <div class="row" style="margin-top:8px"><button class="btn solid" data-copy="memo">メモをコピー</button><span class="hint" style="margin:0">営業管理システムの対応履歴に貼り付け</span></div>
    </div>
  </aside>
</div>
<div class="toast" id="toast"></div>

<dialog id="dlgSave" aria-labelledby="dsT">
  <h3 id="dsT">通話を記録して次のお客様へ</h3>
  <div class="stack">
    <div><span class="seglb">通話結果（必須）</span><div class="seg" id="outSeg" role="group"></div></div>
    <label class="fld">次回アクション・備考<textarea id="nextAct" rows="2" placeholder="例：10/3 18時に再架電、ご主人同席で"></textarea></label>
    <div id="leadSaveBox" class="stack" hidden>
      <label class="fld">次回連絡予定日<input type="date" id="nextDate"></label>
      <label class="fld" id="endWrap" hidden>終了理由<select id="endReason"></select></label>
    </div>
    <label class="fld" style="flex-direction:row;align-items:center"><input type="checkbox" id="saveTr" checked style="width:auto"> 文字起こしも保存する（通話記録へ）</label>
    <p class="hint" id="saveHint" style="margin:0"></p>
    <p class="err" id="saveErr"></p>
  </div>
  <div class="dlgbtns">
    <button class="btn" id="discardBtn">記録せずにクリア</button>
    <button class="btn" id="saveCancel">戻る</button>
    <button class="btn solid" id="saveBtn">記録して次へ</button>
  </div>
</dialog>

<dialog id="dlgDetail"><div id="dtBody" class="detail"></div><div class="dlgbtns"><button class="btn" data-copy="detail">メモをコピー</button><button class="btn solid" id="dtClose">閉じる</button></div></dialog>

<section class="hist" id="hist" hidden>
  <div class="hbar"><b>架電履歴・分析</b><span class="hint" id="who" style="margin:0"></span><span class="spacer"></span>
    <button class="btn" id="csvBtn">CSV出力</button><button class="btn solid" id="histClose">閉じる</button></div>
  <div class="hfil">
    <label class="fld">期間<input type="date" id="fFrom"> 〜 <input type="date" id="fTo"></label>
    <button class="btn sm" id="fLoad">読み込み</button>
    <label class="fld">担当<select id="fStaff"></select></label>
    <label class="fld">結果<select id="fOut"></select></label>
    <label class="fld">理由<select id="fReason"></select></label>
    <label class="fld">キーワード<input id="fKw" placeholder="文字起こし・メモを検索" style="min-width:180px"></label>
  </div>
  <div class="hb" id="hBody"></div>
</section>
</div>`;
const hostEl=document.createElement('div');hostEl.id='kn-host';
/* ⚠️ Dashboard の上部メニュー（1050）・在席表示（ActiveUser.tsx の 11000）より上に出す（以前のアプリは 900） */
hostEl.style.cssText='position:fixed;inset:0;z-index:11500;display:none';
document.body.appendChild(hostEl);
const root=hostEl.attachShadow({mode:'open'});
root.innerHTML='<style>'+KN_CSS+'</style>'+KN_HTML;
const APP=()=>root.getElementById('app');
const isOpen=()=>hostEl.style.display!=='none';
let ctx=null,histOnly=false;
function myAbbr(){const me=A.me();const s=staffList().find(x=>x.name===me||x.abbr===me);return s?(s.abbr||s.name):(me||'')}
/* ---------------- ここから架電ナビ本体 ---------------- */

/* ============ データ ============ */
const STEPS=[
 {t:'挨拶・反響お礼',g:'電話した理由を先に伝え、切られない流れを作る'},
 {t:'問合せ内容確認',g:'住所・種別・名義人・状況・残債の5点を確認'},
 {t:'物件を褒める',g:'立地と物件で褒め、査定への期待感と話せる空気を作る'},
 {t:'共有ヒアリング',g:'クローズ→クローズ→オープンで本音を話せる状態へ'},
 {t:'売却理由の確認',g:'希望金額・時期・温度感と、4つの理由のどれか',key:1},
 {t:'状況の確認と断定',g:'問合せ主×状況を断定し、理由別に追加ヒアリング',key:1},
 {t:'査定フックトーク',g:'「知らないことが多い」と気づいてもらう',key:1},
 {t:'訪問査定アポトーク',g:'ハードルを下げ、営業主導で最短日程を提案'},
 {t:'訪問日程確定',g:'日時・場所・持参資料を確定し、SMSを送る'}
];

const COMMON_HEAR=['間取り（部屋数・専有面積・バルコニーの大きさ）','駐車場の有無・台数・空き状況','居住人数・家族構成','室内の使用感（大きな補修が必要な故障・損傷）','室内での喫煙の有無','リフォーム・修繕の有無（箇所と時期）'];
const MS_HEAR=['窓の方角・日当たり','エレベーターの有無（スキップフロア）','眺望','管理体制（管理人の有無）','設備（オートロック・床暖房・宅配BOX）'];
const KD_HEAR=['土地の広さ・建物の広さ','境界（赤い杭を見たことがあるか）','前面道路の幅','庭の広さ','敷地内の倉庫の有無','外構（カーポート等）','ベランダ・バルコニーの有無と方角','近隣住民について','トイレ・洗面台の数（2階にもあるか）'];
const LAND_HEAR=['土地の広さ','境界（赤い杭を見たことがあるか）','前面道路の幅','現況（更地・古家あり・駐車場等）','近隣住民について'];

const REASONS={
 '離婚':{say:'ご離婚',askers:['名義人','名義人以外（配偶者）'],statuses:()=>['内緒（離婚前）','調停中・協議中','離婚後（居住中）']},
 '相続':{say:'ご相続',askers:['被相続人（ご本人）','相続人（ご家族）'],statuses:a=>a.startsWith('被')?['相続前（ご本人が元気）']:['被相続人ご存命・相続前','相続手続き中','相続後・空き家','相続後・居住中']},
 '住替え':{say:'お住み替え',askers:['名義人','名義人以外（共有者・家族）'],statuses:()=>['買い先行・検討初期','売り先行','ローンが厳しい・転勤']},
 '資産整理':{say:'資産整理',askers:['名義人','名義人以外（家族）'],statuses:()=>['空き家・未使用','賃貸中・収益物件']}
};

/* v14.20：練習モードの売主設定でも使うため、判定本体を keyOf に分離（中身は変更なし） */
function comboKey(){return keyOf(K.reason,K.asker,K.status)}
function keyOf(r,a,s){
 if(!r||!a||!s) return '';
 if(r==='離婚') return s.startsWith('内緒')?'rk_naisho':s.startsWith('調停')?'rk_chotei':'rk_go';
 if(r==='相続'){ if(a.startsWith('被')) return 'sz_hi';
   return {'被相続人ご存命・相続前':'sz_zonmei','相続手続き中':'sz_tetsu','相続後・空き家':'sz_akiya','相続後・居住中':'sz_kyoju'}[s]; }
 if(r==='住替え') return s.startsWith('買い')?'sk_shoki':s==='売り先行'?'sk_uri':'sk_loan';
 if(r==='資産整理') return s.startsWith('空き')?'ss_akiya':'ss_chintai';
 return '';
}

const HEAR={
 rk_naisho:['名義人の確認','持分の確認','残債の確認','お子さんの有無','離婚の原因（聞けたらでよい）','離婚の状況（確定しているか）','財産分与をどう考えているか','離婚後の家の使い道（売るのか）','後々、配偶者に連絡を取ってよいか'],
 rk_chotei:['協議・調停の段階','どういう形で進めたいか','双方の進め方','弁護士の連絡先と進め方','着地の方向性（大枠は決まっていることが多い）','次回の調停日'],
 rk_go:['離婚後、今の家に住み続ける判断をした理由','住み替え先（賃貸？購入？購入ならローン？）','売却後の財産分与の有無'],
 sz_hi:['年齢・居住人数・家族構成','今後どうするか（売却意思）','施設へ入るか、売却してお子さんの家へ移るか','相続人が住む可能性','相続人の人数・居住地・持ち家か','財産の規模（詳細は面談で）','想定より高い査定なら売るか','購入時の契約書の有無'],
 sz_zonmei:['被相続人の状況（意思能力・居住人数）','物件の状況（施設？同居？空き家？）','物件をどうしたいか（欲しい／売却）','親族関係（主導者・ご本人の意思・親族の意向）','生前贈与と相続の税金の違いを知っているか','信託・家族信託・後見・遺言を知っているか'],
 sz_tetsu:['遺産分割協議の進捗','相続登記は済んでいるか','主導者と被相続人との関係','誰が面倒を見ていたか','他の相続人の連絡先','残置物撤去の手配・見積の有無'],
 sz_akiya:['相続登記は完了しているか','現在住んでいるか','今後活用する予定はあるか','お住まいは遠方か（立会い可否）'],
 sz_kyoju:['相続登記は完了しているか','他の相続人との持分・合意','今後も住み続ける予定か','住み続けて困っていること（広さ・維持費）'],
 sk_shoki:['住み替えの理由','住み替え先のエリア・種別・予算・時期','種別を変える場合はその理由','すでに内覧済みか','購入資金（現金／売却益＋ローン／全額ローン）','現在の年齢','残債の有無と金額','返済予定表が手元にあるか','購入時価格','資金計画の有無（住み替えローンを知っているか）','今と住み替え後の居住人数'],
 sk_loan:['残債の金額と返済予定表の有無','転勤の時期・期間','次の住まいは賃貸か購入か','購入なら資金（現金／売却益＋ローン／全額ローン）','今の家は売るか、貸すか'],
 ss_akiya:['取得の経緯（相続・購入）','現況（空き家になった時期と理由）','固定資産税・管理の負担感','他に所有している不動産','売却代金の使い道'],
 ss_chintai:['賃料・入居状況・契約内容','取得の経緯と購入時価格','修繕・空室の悩み','他に所有している不動産','売却代金の使い道']
};
HEAR.sk_uri=HEAR.sk_shoki;
const DRAFT={sz_kyoju:1,ss_akiya:1,ss_chintai:1};

const HOOKS={
 rk_naisho:['対応に慣れていることを伝え、安心してもらう','配偶者側も査定を取る可能性あり。会社によって額が違うとトラブルになる','査定の出し方（成約事例・路線価）と相場の考え方を説明する'],
 rk_chotei:['売り方と実績を伝える','離婚後に売却するとトラブルが起きやすい','売却資金の分配をどうするか','離婚後に元配偶者と何度も会うことになりストレスが大きい','売却には通常3ヶ月以上の販売期間が必要'],
 rk_go:['今の生活に合った住まいに住んだ方がよい','広い家に住み続けるより、生活スタイルに合う家へ住み替える方がよい','住み続けるデメリット（掃除・固定資産税）','次の住まいは賃貸か購入か'],
 sz_hi:['生前贈与と相続で税金・手残りが変わる','信託・家族信託・後見・遺言書作成の提案','不動産のまま相続か、現金化して相続かのメリット・デメリット','現金化すると分けやすく、後々揉めにくい','価格は競合物件で変動する。定期的に状況をお伝えするため、面談で詳細を伺いたい','相続後に必要な準備と動き','司法書士を紹介できる','居住用財産の3,000万円控除か、相続空き家の3,000万円特例か（要件確認・相続人3人以上は2,000万円）'],
 sz_tetsu:['税理士・司法書士に無料相談できる（Zoom可）','税金の要点は書面でお送りできる','残置物が多ければ、訪問当日に撤去業者の見積も取れる'],
 sz_akiya:['空き家のまま置くリスク（特定空家・管理不全空家）','使っていないのに固定資産税が毎年かかる','月1回程度の管理の手間がかかる','隣地とのトラブルの可能性','売却して現金化するか、賃貸に出すか、どちらが得か'],
 sz_kyoju:['相続空き家の特例は「空き家」が要件。住んでいる場合は使えないことがある','共有のままだと将来の売却に全員の同意が必要','今の生活に合う住まいかどうか'],
 sk_shoki:['資金計画（次は購入か賃貸か）','購入資金の組み方で売り方が変わる','住み替えは「手残り価格」が大事','売り先行・買い先行のメリット・デメリット','買い替え特約付きの購入は交渉で不利になることがある','新居の住宅ローン控除と売却の3,000万円控除は併用に制限がある','住み替え先の相場・在庫件数を把握してから判断を','売却時の諸経費・税金','売却には通常3ヶ月以上かかる','会社を比較するためにも話を聞く価値がある','今は売りやすい時期'],
 sk_loan:['相場より「実際にいくらで売れるか」「手残り」が大事','使っていない物件の固定資産税はムダになる','管理に定期的な手間がかかる','売却には通常3ヶ月以上かかる'],
 ss_akiya:['使っていないのに固定資産税と管理の手間がかかり続ける','特定空家・管理不全空家のリスク','売却と賃貸、どちらが手残りが多いか'],
 ss_chintai:['賃貸中のまま売る（オーナーチェンジ）か、空いてから売るか','修繕費がかかる前に売るという判断もある','収益還元での価格の考え方を説明する']
};
HOOKS.sz_zonmei=HOOKS.sz_hi; HOOKS.sk_uri=HOOKS.sk_shoki;

const FEEL={
 '離婚':['家はいくら？','離婚が進んだらどういう流れ？','自分は損しないか','資産を相手に渡したくない','これ以上揉めたくない','財産分与はあるのか・いくらか','住み続けられるか'],
 '相続被':['終活の一歩目','5年・10年先が不安','遺族に迷惑をかけたくない','兄弟姉妹で揉めてほしくない','相続の流れは？','諸経費・税金は？','老後の資金・生活が不安','手残りはいくらか','思い入れのある家の行く末','元気なうちは住む家がなくなるのは困る'],
 '相続人':['まだ先だが、いざという時の備え','相続の流れは？','相続税はいくら？','現金ならいくらもらえる？','使っていなくてもったいない'],
 '住替え':['高く売れるらしいが、今いくら？','残債より高く売って良い家に住み替えたい','不満はないが金額次第では考えたい','転職・入学','転勤がある・可能性がある','家族構成・ライフスタイルの変化'],
 '資産整理':['使っていなくてもったいない','税金や管理の負担を減らしたい','現金にしておきたい']
};

const TALK={
 rk_naisho:()=>[
  s('{媒体}から査定のご依頼をいただいたように、配偶者の方も査定を取られる可能性があります。その際に査定額を高く出す会社もあって、お互いの査定額が違うとトラブルになることがあるんです。'),
  s('例えばですが、ご自宅を「もらってから売る」場合は低い査定の方が、「売ってから分ける」場合は高い査定の方が有利、といった具合です。'),
  s('弊社は離婚に伴う売却を数多くサポートしてきましたが、離婚後に売却するとトラブルが起きやすくなります。売却資金の分配をどうするか、離婚後に何度も元の配偶者と会うことになってストレスを感じやすい、などです。'),
  s('すぐに売却とはならないかもしれませんが、査定価格の考え方（成約事例や路線価をもとに出す方法など）や、同じエリアの成約事例、相場もあわせてご説明できればと思っています。'),
  s('売却のスケジュール感はご存知ですか？'), c('いや、知らないです'),
  s('よく勘違いされるのですが、売ろうと思ってすぐに売れるわけではないんです。物件の調査、販売活動、お客様探しや案内の調整、登記の手続きなど、実際に売れるまで通常3ヶ月以上かかります。'),
  s('今はお二人とも協力して売りましょうとなっていても、方向性がずれてしまうと大変です。一方が売りたい、一方が売りたくないとなると大きなトラブルになりかねません。'),
  s('大事なお話になりますので、一度詳しいお話だけでも聞いていただき、そのうえで売るか売らないかを考えていただければと思います。')],
 rk_go:()=>[
  s('多くのお客様が、離婚後にこのまま住み続けてよいのか悩まれています。部屋数が余っていたり、2階を使っていなかったりと、今の生活スタイルとお住まいが合っていないことが多いんです。'),
  s('このままですと、使っていないお部屋の掃除の手間が増えたり、固定資産税も余計にかかってしまいます。'),
  s('例えば500万円でも手元に資金ができたら、今後の生活がかなり楽になると思いませんか？今の生活に合ったお住まいに住み替えれば、お手元にいくらか資金も残ってくると思います。'),
  s('次のお住まいも、賃貸がよいのか、少し安めの物件を購入した方がよいのかは、お客様によって変わってくる部分です。'),
  s('大事なお話ですので、一度詳しいお話だけでも聞いていただき、そのうえで売るか売らないかを考えていただければと思います。')],
 sz_hi:()=>[
  s('通常は相続されてからご相談いただくことが多いので、{客}様がこのタイミングでお問い合わせくださって良かったです。相続前に知っておいていただきたいことが結構あるんです。'),
  s('例えばですが、物件のまま相続するのと、現金化してから相続するのと、どちらが良いと思われますか？'), c('うーん、状況によるのかな？'),
  s('おっしゃる通りです。相続税の関係で、不動産のまま相続するか現金化して相続するかで手残りが変わります。相続人が複数いらっしゃる場合は、現金化した方が揉めないということもあります。驚かれるかもしれませんが、相続人同士で揉めることは本当によくあるんです。'),
  s('また、相続された方が固定資産税の支払いに困ることもあります。{客}様の物件のように人気のエリアで資産価値が高い物件は、固定資産税もそれなりの額になります。使わない不動産だと、税金と管理の手間だけがかかる「負動産」になってしまいます。'),
  s('今すぐ本格的に売却をお考えではないかもしれませんが、相続税などの税金も、準備しておくことも多いですし、相続される側の準備もあります。一度このタイミングでお話だけでも聞いていただいた方が良いと思います。'),
  s('あわせて、同じエリアや似た物件の成約事例、今の在庫状況のデータもご紹介して、売却のタイミングもご相談できればと考えています。')],
 sz_zonmei:()=>[
  s('ご実家の今後について、家族信託という言葉は聞かれたことはありますか？'), c('いや、知らないです'),
  s('信託は、大切な財産の管理を信頼できる人に託す仕組みです。中でもご家族に託すものを家族信託といって、親御さんがお元気なうちに準備しておくと、将来判断が難しくなっても、売却などを進めやすくなります。'),
  n('ここで「知らないことが多い」と感じてもらう'),
  s('後見制度という言葉は聞かれたことはありますか？'), c('いや、知らないです'),
  s('認知症などでご本人がひとりで決めるのが難しくなったときに、契約や手続きをサポートする制度です。ただ、後見が始まると、ご自宅の売却に家庭裁判所の許可が必要になるなど、手続きが重くなることもあります。'),
  s('遺言書の制度はご存知ですか？'), c('いや、知らないです'),
  s('遺言書は、遺産の分け方を決めて、相続人同士の争いを防ぐための大切な書類です。'),
  s('今すぐ本格的に売却をお考えではないかもしれませんが、相続後の税金も、準備しておくことも多いです。一度このタイミングで、信託や後見、遺言のお話だけでも聞いていただいた方が良いと思います。')],
 sz_akiya:()=>[
  s('空き家になりますと、水回りの通水や空気の入れ替え、お掃除が少なくとも月に1回は必要になります。'),
  s('遠方にお住まいでしたら往復でかなりお時間がかかりますので、持ち続けている間、その分のお時間が取られてしまいます。'),
  s('固定資産税も、まったく使っていないのに毎年払い続けることになるので、もったいないとおっしゃる売主様も多いです。'),
  s('特定空家という言葉は聞かれたことはありますか？'), c('いや、知らないです'),
  s('管理が行き届かない空き家に対して、市区町村から指導や勧告が入る制度です。勧告を受けると、固定資産税の住宅用地の特例が外れて、税額が大きく上がる可能性があります。令和5年12月13日からは、その手前の「管理不全空家」も勧告の対象になりました。'),
  n('ここで「知らないことが多い」「リスクもある」と感じてもらう'),
  s('知っておいていただきたい大切なお話がたくさんありますので、一度詳しいお話だけでも聞いていただき、今後どうするのが一番お得かを考えてみてください。そのうえで売るか売らないかを決めていただければと思います。')],
 sk_shoki:()=>[
  s('住み替えでしたら、まず大切なのは「手残り価格」がいくらかということです。手残り価格という言葉は聞かれたことはありますか？'), c('いや、知らないです'),
  s('ご購入時にも諸経費があったと思いますが、売却の際にも諸経費がかかります。売れた金額から、登記の費用や仲介手数料などを差し引いた、実際にお手元に残る金額が手残り価格です。これが次のお住まいを買うときの元手になりますので、まず把握しておくことが大切です。'),
  s('住み替えには2種類の進め方があるのですが、お聞きになったことはありますか？'), c('いや、知らないです'),
  s('「買う前に売る」か「売る前に買う」か、という分け方です。どちらにもメリット・デメリットがあって、お客様によってどちらが良いかが変わります。'),
  s('売却には基本的に3ヶ月はかかりますし、他にも売却のポイントがいくつかありますので、一度お時間をいただいて詳しくご説明し、そのうえで売るか売らないかを考えていただければと思います。'),
  s('とても良い物件なので、弊社で探されている購入希望のお客様もいらっしゃいますし、良い物件は早めに見たいという方が多いです。住宅購入には問い合わせが増える時期があって、ちょうど今は良いタイミングです。')],
 sk_loan:()=>[
  s('{客}様の場合は、相場がどのくらいかというより、実際にいくらで売れるのかが大事になってきます。手残り価格というのはご存知でしょうか？売れた金額から、登記の費用や仲介手数料などを差し引いて、実際にお手元に残る金額のことです。'),
  s('私どももプロではありますが、実際に物件を見ないことには詳しいお話が難しいんです。実際に見させていただければ、金額ももっと出せるかもしれません。'),
  s('先ほどお伺いした良いところも、プラスに働く可能性があります。弊社は販売活動に特に力を入れていますので、{客}様の物件を高く売るための販売プランもその際にご提案します。'),
  s('売却のスケジュール感はご存知ですか？よく勘違いされるのですが、売ろうと思ってすぐに売れるわけではなく、通常3ヶ月以上かかります。'),
  s('他にも売却のポイントがいくつかありますので、一度お時間をいただいて詳しくご説明し、そのうえで売るか売らないかを考えていただければと思います。')]
};
/* v14.19 追加：マニュアル未収録の組み合わせ（追加案・要監修） */
TALK.rk_chotei=()=>[
  s('ご協議中ということで、財産分与の中でご自宅をどう扱うかは、大きなポイントになりますよね。'),
  s('ご自宅の価格が分からないと、分け方や、どちらが住み続けるのか、売って分けるのかの判断ができません。弁護士の先生とのお話でも、根拠のある査定額があると進めやすくなります。'),
  s('査定額は会社によって差が出ることもありますので、成約事例などの根拠をもとに、どういう考え方で金額を出したのかが分かる資料をお作りします。'),
  s('住宅ローンが残っている場合は、売却額でローンを完済できるかどうかでも選択肢が変わります。'),
  s('売却には通常3ヶ月以上かかりますので、協議や調停の日程から逆算して動くことも大切です。一度詳しいお話だけでも聞いていただき、そのうえで売るか売らないかを考えていただければと思います。')];
TALK.sz_tetsu=()=>[
  s('このたびはご愁傷さまでございました。お手続きでお忙しい中、ありがとうございます。'),
  s('ご相続された不動産の登記ですが、令和6年4月から相続登記が義務になったのはご存知ですか？'), c('いや、知らないです'),
  s('相続で取得したことを知った日から3年以内に登記をする必要があって、正当な理由なく放っておくと過料の対象になることがあります。売却する場合も、先に相続登記を済ませる必要があります。'),
  s('相続税の申告が必要な方ですと、申告期限から3年以内に売却すれば、払った相続税の一部を売却時の経費に加えられる特例もあります。'),
  s('ご実家が空き家になる場合は、要件を満たせば、売却益から最大3,000万円を差し引ける特例もあります（相続人が3人以上なら1人あたり2,000万円）。ただ、建物の建築時期や売却の期限など要件が細かいので、使えるかどうかを早めに確認しておくことが大切です。'),
  n('ここで「期限のある話が多い」と感じてもらう'),
  s('遺産分割のお話し合いでも、不動産の価格が分からないと分け方が決まりません。根拠のある価格を出しておくと、ご親族でのお話し合いもスムーズになります。'),
  s('残置物の片付けや、他のご相続人様とのご調整も含めて、一度詳しいお話だけでも聞いていただき、そのうえで売るか売らないかを考えていただければと思います。')];
TALK.sz_kyoju=()=>[
  s('ご相続された後もお住まいということですね。登記はもうお済みでしょうか？令和6年4月から相続登記が義務になっていますので、まだでしたら先に確認しておくと安心です。'),
  s('ご兄弟などと共有のままですと、将来売るときに全員の同意が必要になり、時間が経つほどお話がまとまりにくくなることがあります。'),
  s('相続した家の3,000万円の特例は「空き家」であることが条件のひとつなので、お住まいの場合は使えないことがあります。ご自身の住まいとして住んでいる場合は、別の居住用の特例が使えることもあり、どの特例になるかで手残りが大きく変わります。'),
  s('今のお住まいが生活に合っているか、維持費や広さの面も含めて、一度詳しいお話だけでも聞いていただき、そのうえで売るか売らないかを考えていただければと思います。')];
TALK.sk_uri=()=>[
  s('先に売ってから次のお住まいを探されるということですね。売り先行は資金計画が立てやすい反面、売れてから引き渡しまでに次のお住まいが決まらないと、仮住まいが必要になることもあります。'),
  s('引き渡しの時期を調整したり、売却と購入の日程を合わせたりと、段取りで結果が大きく変わる部分なんです。'),
  s('まず手残り価格が分かると、次のお住まいの予算も決められます。手残り価格は、売れた金額から登記の費用や仲介手数料などを差し引いて、実際にお手元に残る金額のことです。'),
  s('売却には基本的に3ヶ月はかかりますので、一度お時間をいただいて詳しくご説明し、そのうえで売るか売らないかを考えていただければと思います。')];
TALK.ss_akiya=()=>[
  s('使っていないお家でも、固定資産税は毎年かかりますし、通水や換気、お掃除など、少なくとも月に1回は管理の手間がかかります。'),
  s('建物は人が住まなくなると傷みが早くなりますので、時間が経つほど価値が下がりやすいんです。'),
  s('管理不全空家や特定空家という言葉は聞かれたことはありますか？'), c('いや、知らないです'),
  s('管理が行き届かない空き家に対して、市区町村から指導や勧告が入る制度です。勧告を受けると、固定資産税の住宅用地の特例が外れて、税額が大きく上がる可能性があります。'),
  s('売った場合の手残りと、貸した場合の家賃の目安を並べてご説明できますので、一度詳しいお話だけでも聞いていただき、そのうえで売るか売らないかを考えていただければと思います。')];
TALK.ss_chintai=()=>[
  s('入居者がいらっしゃる状態でも、そのまま「オーナーチェンジ」として売却できます。'),
  s('投資用として買われる方は、家賃から見た利回りで価格を判断されますので、お住まい用とは価格の考え方が変わります。空室にしてから売る方が高くなる物件もあれば、その逆もあります。'),
  s('賃貸借契約の内容や修繕の履歴、入居者様の状況でも価格が変わりますので、契約書を拝見しながらご説明できればと思います。'),
  s('大きな修繕が必要になる前に売るという判断もございますので、一度詳しいお話だけでも聞いていただき、そのうえで売るか売らないかを考えていただければと思います。')];
const TALK_X={rk_chotei:1,sz_tetsu:1,sz_kyoju:1,sk_uri:1,ss_akiya:1,ss_chintai:1};

const RB=[
 {id:'price',t:'価格だけ知りたいんですけど…',kw:['価格','金額','いくら','値段','相場','知りたいだけ','だけ知りたい'],b:[
  ['価格を知りたい理由・何の価格かを伺う',['今回、価格をお知りになりたいのはどうしてでしょうか？','価格にもいろいろありまして、「売れる価格」か「お手元に残る価格」か、どちらをお知りになりたいですか？','例えば、この金額ならなんとか売れるという上限のチャレンジ価格なのか、すぐ売りたい場合の固めの価格なのか、弊社が推奨する販売価格なのか、諸費用を引いた手残りなのか。売り方によっても、高く売れる方法もあれば、損してしまう方法もあります。']],
  ['机上査定のデメリットと手残りを伝える',['机上の査定ですと、実際に売れる金額と差が出ることが多く、売却まで時間がかかったり、損をしてしまう可能性もあります。','お手元に残る金額を知るには、どの販売価格で、どんな諸費用や税金がかかるのかなど、知っておいていただくことが多いんです。']],
  ['計画を立てるために正確な金額が必要と伝える',['売る・売らないにかかわらず、正確な金額と売却のポイントを知っておかれた方が良いと思います。','売却の流れや、税金・費用、手残りまで押さえていただくと、具体的に検討していただけます。']]]},
 {id:'send',t:'時間がないので査定書だけ送ってほしい',kw:['送って','郵送','メール','査定書','時間がない','会えない','ポスト'],b:[
  ['訪問査定のハードルを下げる',['訪問査定は無料です。お金や手数料がかかるものではありません。','訪問査定といっても15分から20分程度で済みます。','多くのお客様は、お仕事終わりの夜や、休日の午前中などにお会いしています。']],
  ['訪問のメリット・しないデメリットを伝える',['実際に物件を見させていただくと、販売価格が大きく変わることが多いです。','100万円以上変わることも少なくないので…。','訪問の際に、売却の流れやポイントもお伝えしています。']],
  ['売る・売らないはお客様の判断と伝える',['訪問したからといって、無理な営業をするつもりはありません。','お話を聞いていただいて、お客様にご判断いただければと思います。']],
  ['査定書を直接お届けするアポを取る',['査定書は40ページ近くありまして、内容のご説明が必要だと思います。5分だけで結構ですので、直接お届けしてご説明させてください。','皆様のご自宅にお届けしております。例えば本日の夜などはいかがでしょうか？','メールでは送れるデータが限られます。ご近所によくお伺いしますので、お持ちしますよ。','査定結果はメールではお送りしておらず、直接お渡しかポスト投函で対応しています。どちらがご都合よろしいでしょうか？']]]},
 {id:'decider',t:'決定権がないので日程は決められない',kw:['決定権','主人','夫','旦那','妻','奥さん','聞いてみ','決められない','相談して'],b:[
  ['決定権者の帰宅後にアポを取る',['では、決定権のある方は何時ごろお帰りになりますか？10分程度しかいただきませんので、お仕事帰りにお伺いすることも多いんです。']],
  ['仮アポで日程を仮決定する',['かしこまりました。休日でしたらご主人様もお休みだと思いますので、仮で結構です。土曜と日曜でしたらどちらがよろしいですか？午前と午後ではいかがでしょうか？','では仮で、○日土曜日の午前○時にお伺いします。ご主人様にご確認いただき、ご都合がよろしければ空けておいていただけますか。2、3日前にお電話しますので、ご都合が悪ければその際にお伝えください。']]],
  warn:'その場でアポを取らず「後日お電話します」はNG。必ず仮アポまで取る。'},
 {id:'family',t:'媒介はこの後家族で話して決めます',kw:['家族で','話し合','考えます','媒介','検討します'],b:[
  ['不動産のプロとして話し合いに加わる',['かしこまりました。ちなみに、どういったお話をされる予定でしょうか？','税金のお話や、分からないことがあるようでしたら、私たちがいた方がスムーズに進むと思いますので、同席いたしますよ。','（断られたら）では、専門的なことが必要になりましたら、遠慮なくお電話ください。']]]},
 {id:'far',t:'遠方に住んでいて立ち会えない',kw:['遠方','遠い','県外','立ち会','行けない','鍵','東京','福岡'],b:[
  ['立会いなしで訪問査定を進める',['鍵をお送りいただければ、弊社で拝見して結果をご報告します。','お近くにご親族がいらっしゃれば、鍵をお預けいただいて立ち会っていただく方法もあります。','まずはZoomなどのビデオ通話でお話しして、その場で訪問査定の日程を決めることもできます。']]]},
 {id:'notyet',t:'まだ売るかどうか決めていない',x:1,kw:['売るか','決めてない','まだ','売る気','売るつもり','検討中','すぐじゃない'],b:[
  ['売る・売らないは判断材料をそろえてから',['すぐに売りに出しましょうということではありません。正確な金額と売却のポイントを知っていただいて、そのうえで売るか売らないかをご判断いただければと思います。','売る・売らないにかかわらず、今いくらで、手元にいくら残るのかを知っておくと、いざという時に慌てずに済みます。']],
  ['「高ければ売る」かを確かめる',['例えばですが、想像していたより高い金額が出たら、ご売却もお考えになりますか？','どのくらいの金額でしたら、ご売却を考えてもよいと思われますか？その金額に届くかどうかも含めて、実際に拝見してお答えします。']]]},
 {id:'others',t:'他社にも査定を頼んでいる',x:1,kw:['他社','他の会社','ほかの','比較','何社','ほか'],b:[
  ['比較を肯定し、根拠と手残りで勝負する',['比較されるのは当然だと思います。ぜひ比べてみてください。','机上査定は会社ごとに差が出やすいので、実際に見て根拠をご説明できる会社で比べていただくのが一番確実です。','高めの金額を出す会社もありますが、大切なのは「その金額で売れる根拠」と「お手元に残る金額」です。']]],
  warn:'他社が入る前提で、最短の日程を提案する（⑧へ）。'},
 {id:'busy',t:'今ちょっと忙しい／かけ直して',x:1,kw:['忙しい','後で','かけ直','今ちょっと','運転','仕事中','手が離せない'],b:[
  ['1分だけもらうか、かけ直す時間を決める',['失礼いたしました。査定額に大きく関わる確認が2点だけございますので、1分だけよろしいでしょうか？','かしこまりました。では何時ごろでしたらご都合よろしいでしょうか？その時間に改めてお電話いたします。']]],
  warn:'かけ直す時刻を必ず決めてから切る。'},
 {id:'kijo',t:'机上査定で十分／訪問はいらない',x:1,kw:['机上','簡易','訪問はいい','来なくて','家に来','訪問は','結構'],b:[
  ['机上と訪問の違いを伝える',['机上査定は、周辺の成約事例や路線価などのデータだけで出す金額なので、室内の状態や日当たり、リフォームの有無は反映されていないんです。','実際に売り出す金額を決める前には、訪問査定で金額を確かめるのが一般的です。']],
  ['心配するスタンスで3回目の打診',['多くの方が、実際にお会いして金額の根拠をお聞きになってから判断されています。本当に机上の金額だけでよろしいでしょうか？少し心配になりまして…。','15分から20分ほどで終わりますので、例えば明日の午前と夕方でしたら、どちらがご都合よろしいでしょうか？']]],
  warn:'打診は切り口を変えて最大3回まで（1回目：そのまま→2回目：売却理由から会う理由→3回目：机上と訪問の違い）。3回断られたら査定書の届け方と次回連絡日を決めて終える。'},
 {id:'takai',t:'他社はもっと高い金額だった',x:1,kw:['高かった','高い金額','他社は','もっと高','安い','低い'],b:[
  ['査定額と売れる金額の違いを伝える',['査定額は「この金額で売れる」というお約束ではないので、会社によって差が出ます。大切なのは、その金額で売れる根拠があるかどうかです。','相場より高く売り出して反響がなく、値下げを繰り返すと、「売れ残っている物件」という印象がついてしまうこともあります。']],
  ['根拠を比べてもらう',['ぜひ他社様の査定書と並べて、根拠になっている成約事例を比べてみてください。実際に拝見すれば、弊社でも根拠をもって金額をご提示できます。']]],
  warn:'他社の査定や会社を悪く言わない。'},
 {id:'house',t:'家の中が散らかっている／見せたくない',x:1,kw:['散らか','片付','汚い','見せたくない','中を見','掃除','狭い'],b:[
  ['片付けは不要と伝える',['皆様そうおっしゃいますので、まったくお気になさらないでください。生活されているままの状態で大丈夫です。','拝見するのは、間取りや水回り、傷みやすい箇所の状態が中心です。']],
  ['見る範囲を絞る提案',['お部屋すべてでなくても、見せていただける範囲だけで構いません。先に外観と周辺だけ確認して、お部屋は後日という方法もあります。']]]},
 {id:'neighbor',t:'近所に売ることを知られたくない',x:1,kw:['近所','知られたく','ばれ','バレ','周り','目立'],b:[
  ['目立たない形で伺うと伝える',['ご安心ください。ご近所の方に分からないよう、目立たない形でお伺いします。','店舗でのご相談や、ビデオ通話でのご相談もできます。']],
  ['広告を出さずに売る方法もある',['売り出す場合も、インターネットやチラシに載せずに、購入希望のお客様にだけご紹介する方法や、弊社で直接買い取る方法もあります。どの方法が合うかも、お会いしてご相談させてください。']]],
  warn:'社名なしの車・服装など、具体的な配慮を約束する場合は事前に社内で可否を確認する。'},
 {id:'kaitori',t:'早く現金化したい／買い取ってほしい',x:1,kw:['買取','買い取','現金','すぐ売','早く売','急いで','業者'],b:[
  ['仲介と買取の両方で査定する',['弊社は仲介と買取の両方を行っていますので、両方の金額を並べてご提示できます。','買取は早く確実に売れる一方で、価格は仲介より低くなるのが一般的です。どちらが合うかは、時期と手残りを比べて決めましょう。']],
  ['買取こそ現地確認が必要と伝える',['買取の金額は、実際に建物の状態を拝見して決めます。最短ですと本日の夕方か、明日の午前中はいかがでしょうか？']]],
  warn:'電話で買取価格を約束しない。社内の買取判断（仕入担当）と連携する。'},
 {id:'fee',t:'費用・手数料はいくらかかる？',x:1,kw:['手数料','費用','お金','いくらかかる','無料','有料','タダ'],b:[
  ['査定は無料と伝える',['査定やご相談は無料です。お会いしたからといって費用が発生することはありません。']],
  ['仲介手数料は成約したときだけ',['仲介手数料は、売買契約が成立したときだけいただく成功報酬です。上限は法律で決まっていて、売買価格が400万円を超える場合は「売買価格×3％＋6万円」に消費税を加えた額です。','ほかにも登記や測量、税金などの費用がかかることがありますので、手残りの金額とあわせて、お会いしたときにご説明します。']]],
  warn:'800万円以下の物件は報酬の特例がある（事前の合意が必要）。個別に確認してから答える。'},
 {id:'loan',t:'ローンが残っていても売れる？',x:1,kw:['ローン','残債','残って','売れるの','返済'],b:[
  ['売れると伝え、仕組みを説明する',['はい、売却できます。ローンが残った状態で売却される方は多いです。売却代金でローンを完済して、同時に抵当権を外す流れになります。']],
  ['残債と売却額の関係を確認する',['大事なのは、売却額から諸費用を引いた金額で、ローンを完済できるかどうかです。残高のお知らせがあれば、手残りまで計算してお持ちします。','もし残債の方が多くなりそうな場合でも、自己資金で補う方法や住み替えのローンなど、いくつか方法があります。']]],
  warn:'返済の滞納・オーバーローンの場合は任意売却の可能性。深追いせず上長に相談する。'},
 {id:'tax',t:'税金はどのくらいかかる？',x:1,kw:['税金','譲渡','確定申告','控除','特例','3000万'],b:[
  ['主な特例を紹介する',['お住まいを売る場合は、売却益から最大3,000万円を差し引ける特例があります。','所有期間が、売却した年の1月1日時点で5年を超えるかどうかでも、税率が大きく変わります。']],
  ['個別の計算は訪問で',['特例が使えるかどうかは、購入時の価格や時期、住まなくなった時期などで変わります。購入時の契約書を拝見できれば、手残りと税金の目安を計算してお持ちします。','必要でしたら、提携の税理士にもご相談いただけます。']]],
  warn:'税額は断定しない。特例を使うには確定申告が必要。'},
 {id:'rent',t:'貸すか売るか迷っている',x:1,kw:['貸す','賃貸','貸した','貸そう','家賃'],b:[
  ['比べるポイントを伝える',['貸す場合は家賃収入が入る一方で、修繕費や空室のリスク、固定資産税がかかり続けます。','また、住まなくなってから一定の期間を過ぎると、売却時のマイホームの特例が使えなくなることがあります。']],
  ['両方の数字を出すと提案する',['売った場合の手残りと、貸した場合の家賃の目安を並べてお出しします。比べていただいたうえで決めていただくのが一番です。']]]},
 {id:'agent',t:'知り合いの不動産会社がある',x:1,kw:['知り合い','付き合い','親戚','友人','友達','知人'],b:[
  ['比較の材料として使ってもらう',['お知り合いがいらっしゃると心強いですね。そのうえで、比較の材料として弊社の査定もご活用いただければと思います。','不動産会社によって得意なエリアや販売の方法が違いますので、比べていただくことで納得して選べます。']]]},
 {id:'decided',t:'もう他社に決めた／媒介契約した',x:1,kw:['決めた','契約した','もう頼んだ','専任','お願いした','決まって'],b:[
  ['契約の形を確認する',['そうでしたか。差し支えなければ、専任媒介と一般媒介のどちらでご契約されましたか？','一般媒介でしたら、弊社でも並行して販売活動ができます。']],
  ['専任なら更新時期に備えてもらう',['専任媒介の契約期間は最長3ヶ月です。もし販売が思うように進まなかったときのために、セカンドオピニオンとして弊社の査定もお手元に置いておいてください。','契約期間が終わる頃に、状況を伺うお電話をしてもよろしいでしょうか？']]],
  warn:'他社の悪口は言わない。了承を得られた場合だけ次回連絡日を決める。'},
 {id:'stop',t:'もう電話しないで／迷惑',x:1,kw:['迷惑','しつこい','電話しないで','連絡しないで','もういい','結構です','二度と'],b:[
  ['お詫びし、連絡方法の希望を伺う',['大変失礼いたしました。ご不快な思いをさせてしまい申し訳ございません。','お電話がご負担でしたら、今後はショートメッセージでのご連絡に切り替えることもできます。いかがいたしましょうか？']],
  ['不要と言われたら終える',['かしこまりました。今後こちらからのご連絡は控えさせていただきます。ご売却のことで何かございましたら、国分ハウジング不動産の{担当}までいつでもご連絡ください。']]],
  warn:'はっきり断られた後に勧誘を続けるのは宅建業法（47条の2第3項・施行規則）で禁止。通話結果は「断り・終了」で記録する。'},
 {id:'mistake',t:'申し込んだ覚えがない／間違えた',x:1,kw:['覚えがない','間違','申し込んでない','頼んでない','誰が'],b:[
  ['申込み内容を確認する',['失礼いたしました。{媒体}から、物件の査定のご依頼として届いておりまして、ご家族様がお申し込みになった可能性はございますか？']],
  ['心当たりがなければ終える',['お心当たりがなければ、いただいた情報は弊社で使用しないよう対応いたします。お手数をおかけして申し訳ございませんでした。']]],
  warn:'本人・家族と確認できるまで、物件の住所や内容を話さない。'}
];

const RB_G=[['査定・訪問を渋る',['price','send','kijo','notyet','house','busy']],
 ['家族・他社・事情',['decider','family','far','others','takai','agent','decided','neighbor']],
 ['お金・税金・売り方',['fee','loan','tax','kaitori','rent']],
 ['お断り・確認',['stop','mistake']]];
/* 自動聞き取り用：会話から拾う言葉（営業側の発話でも誤反応しにくい言い回しに限定） */
const TRIG={
 price:['価格だけ','金額だけ','相場だけ','知りたいだけ','だいたいでいい','大体でいい','ざっくりでいい','目安だけ'],
 send:['送って','郵送','メールで','ポストに','査定書だけ','書面で'],
 decider:['主人に','夫に','旦那に','妻に','家内に','嫁に','相談してから','決められない','決定権','私一人では','私ひとりでは'],
 family:['家族で話','家族と相談','話し合って','検討します','考えておきます'],
 far:['遠方','県外','遠くに住','立ち会えない','立ち会いは','帰れない','帰省'],
 notyet:['売るかどうか','まだ決めて','売る気はない','売るつもりはない','まだ先','すぐには売','今すぐじゃ'],
 others:['他社','ほかの会社','他の会社','何社か','別の会社','他でも','ほかでも'],
 busy:['今忙しい','今ちょっと','後でかけ','あとでかけ','かけ直','運転中','仕事中','手が離せない','会議中'],
 kijo:['机上で','机上査定で','簡易査定で','簡易で','来なくていい','来てもらわなくて','訪問はいい','訪問は結構','訪問はいら','家には来'],
 takai:['もっと高','他社は高','よそは高','高い金額を出','安すぎ','安いね','低すぎ'],
 house:['散らかって','片付いてな','片付けてな','汚いので','見せたくない','中は見せ','人に見せ'],
 neighbor:['近所に知','知られたくない','ばれたくない','バレたくない','近所の目','周りに知'],
 kaitori:['買い取って','買取して','買取でいい','買取って','すぐ現金','早く現金','急いで売','すぐにでも売'],
 fee:['手数料はいくら','手数料って','費用はいくら','費用ってかか','お金かかる','お金がかかる','有料','タダ'],
 loan:['ローンが残って','ローン残って','ローン中でも','残債があって','残債があるけど','まだ返済中'],
 tax:['税金はいくら','税金いくら','税金はどのくらい','税金ってどのくらい','税金かかる','譲渡所得','確定申告'],
 rent:['貸そうか','貸すか','貸した方','貸したほうが','賃貸に出そう','貸しても'],
 agent:['知り合いの不動産','知り合いに頼','付き合いのある','親戚が不動産','友達が不動産','知人の不動産'],
 decided:['もう決め','他で決め','契約しました','もう契約','もう頼んで','専任で','お願いしてる','お願いしている'],
 stop:['迷惑なん','迷惑です','迷惑だから','しつこい','電話しないで','かけてこないで','連絡しないで','もう結構','二度と'],
 mistake:['覚えがない','申し込んでない','申し込みしてない','頼んでない','間違えて','間違って','誰が申し込']
};
const REASON_TRIG={
 '離婚':['離婚','別れ','調停','財産分与','元夫','元妻','元旦那','別居'],
 '相続':['相続','亡くな','他界','遺産','親の家','実家','施設に入','認知症','四十九日','葬儀'],
 '住替え':['住み替え','住替え','買い替え','買替え','転勤','引っ越し','引越し','新築','建て替え','手狭','新居'],
 '資産整理':['資産整理','貸して','賃貸に出','アパート','収益','入居者','家賃','整理したい']
};
/* [言葉, 問合せ主(空=指定しない), 状況] */
const STATUS_TRIG={
 '離婚':[['内緒','','内緒（離婚前）'],['まだ言って','','内緒（離婚前）'],['知られたくない','','内緒（離婚前）'],['調停','','調停中・協議中'],['弁護士','','調停中・協議中'],['協議中','','調停中・協議中'],['離婚した','','離婚後（居住中）'],['別れた','','離婚後（居住中）'],['元夫','','離婚後（居住中）'],['元妻','','離婚後（居住中）'],['離婚後','','離婚後（居住中）']],
 '相続':[['空き家','相続人（ご家族）','相続後・空き家'],['誰も住んで','相続人（ご家族）','相続後・空き家'],['亡くな','相続人（ご家族）','相続手続き中'],['他界','相続人（ご家族）','相続手続き中'],['四十九日','相続人（ご家族）','相続手続き中'],['遺産分割','相続人（ご家族）','相続手続き中'],['施設に','相続人（ご家族）','被相続人ご存命・相続前'],['認知症','相続人（ご家族）','被相続人ご存命・相続前'],['入院','相続人（ご家族）','被相続人ご存命・相続前'],['終活','被相続人（ご本人）','相続前（ご本人が元気）'],['子供たちに','被相続人（ご本人）','相続前（ご本人が元気）'],['子どもたちに','被相続人（ご本人）','相続前（ご本人が元気）']],
 '住替え':[['転勤','','ローンが厳しい・転勤'],['ローンがきつ','','ローンが厳しい・転勤'],['ローンが厳し','','ローンが厳しい・転勤'],['返済が','','ローンが厳しい・転勤'],['払えな','','ローンが厳しい・転勤'],['先に買','','買い先行・検討初期'],['新居が決ま','','買い先行・検討初期'],['もう買った','','買い先行・検討初期'],['建築中','','買い先行・検討初期'],['売ってから','','売り先行'],['先に売','','売り先行']],
 '資産整理':[['賃貸中','','賃貸中・収益物件'],['貸して','','賃貸中・収益物件'],['入居者','','賃貸中・収益物件'],['家賃','','賃貸中・収益物件'],['使ってない','','空き家・未使用'],['使っていない','','空き家・未使用'],['空き家','','空き家・未使用']]
};

/* ============ 状態 ============ */
const LS='kh_satei_navi_v1';
const blank=()=>({step:0,info:{name:'',media:'',staff:'',addr:'',ms:'',room:'',station:''},
 type:'',area:'',age:'',owner:'',ownerRel:'',occ:'',occNote:'',loan:'',loanAmt:'',loanDoc:'',
 price:'',when:'',temp:'',reason:'',asker:'',status:'',ck:{},nt:{},
 appt:{date:'',time:'10:00',place:'',docs:true},sms:'',rb:null,t0:0,tAcc:0,run:false,tr:[],sug:{rb:[]},ev:[],maxStep:0,startedAt:null});
let K=blank();
const pref={staff:'',tel:'099-204-0705',autoOpen:true,micOk:false,trInMemo:false};
try{Object.assign(pref,JSON.parse(localStorage.getItem(LS)||'{}'));}catch(e){}
K.info.staff=myAbbr();
const savePref=()=>{try{localStorage.setItem(LS,JSON.stringify(pref));}catch(e){}};

/* ============ ヘルパー ============ */
const $=q=>root.querySelector(q);
const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const V=v=>v?`<span class="fv">${esc(v)}</span>`:'<span class="ph">●●</span>';
function fill(t){
 const i=K.info;
 const map={'客':i.name,'媒体':i.media,'担当':i.staff,'住所':i.addr,'MS':i.ms,'部屋':i.room,'駅':i.station,
  '種別':K.type,'面積':K.area,'築年':K.age,'理由':REASONS[K.reason]?.say,'日付':fmtDate(K.appt.date),'時刻':K.appt.time,'場所':K.appt.place||i.addr,'店舗TEL':pref.tel};
 return esc(t).replace(/\{(.+?)\}/g,(m,k)=>k in map?V(map[k]):m);
}
function s(t){return `<p class="say"><span class="t">${fill(t)}</span></p>`}
function c(t){return `<p class="cust">お客様：${fill(t)}</p>`}
function n(t){return `<p class="note">${fill(t)}</p>`}
function w(t){return `<p class="warn">${fill(t)}</p>`}
function h(t){return `<h3>${t}</h3>`}
function seg(key,opts,label){
 const cur=K[key];
 return `<div>${label?`<span class="seglb">${label}</span>`:''}<div class="seg" role="group">${opts.map(o=>`<button data-set="${key}" data-v="${esc(o)}" class="${cur===o?'on':''}" aria-pressed="${cur===o}">${esc(o)}</button>`).join('')}</div></div>`;
}
function fld(key,label,ph,w){return `<label class="fld">${label}<input data-s="${key}" value="${esc(K[key])}" placeholder="${ph||''}" style="${w?'min-width:'+w+'px':''}"></label>`}
function chk(id,items){
 return `<ul class="ck">${items.map((t,i)=>{const k=id+'#'+i,on=!!K.ck[k];
  return `<li class="${on?'done':''}"><input type="checkbox" id="c_${esc(k)}" data-ck="${esc(k)}" ${on?'checked':''}><label for="c_${esc(k)}">${esc(t)}</label><input type="text" data-nt="${esc(k)}" value="${esc(K.nt[k]||'')}" placeholder="メモ"></li>`}).join('')}</ul>`;
}
function fmtDate(d){if(!d)return '';const x=new Date(d+'T00:00');return `${x.getMonth()+1}月${x.getDate()}日（${'日月火水木金土'[x.getDay()]}）`}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),1400)}
function copy(txt){(navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>toast('コピーしました')).catch(()=>{const a=document.createElement('textarea');a.value=txt;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();toast('コピーしました')})}

/* ============ ステップ本文 ============ */
const BODY=[
 ()=>[w('「お時間大丈夫でしょうか？」とは聞かない。電話した理由（査定額のご案内）を先に伝え、切られない流れを作る。'),
  s('もしもし、{客}様でしょうか？'),c('あっ、はい……（架電の早さに驚いている）'),
  s('この度は、{媒体}より物件の査定依頼をいただき、誠にありがとうございます。{客}様の物件を担当させていただきます、国分ハウジング不動産の{担当}と申します。'),
  s('お問い合わせいただいた物件の確認と、査定金額のご提案のためにご連絡いたしました。'),c('あっ、はい……'),
  h('2回目以降の架電で初めてつながったとき<span class="draft">追加案・要監修</span>'),
  s('何度かお電話してしまい失礼いたしました。{媒体}から査定のご依頼をいただいた件で、査定金額のご提案のためにご連絡いたしました。'),
  n('「何度も」を謝るのは一言だけ。すぐに本題（②の物件確認）へ入る。'),
  h('ご本人以外が出たとき<span class="draft">追加案・要監修</span>'),
  s('国分ハウジング不動産の{担当}と申します。{客}様はいらっしゃいますでしょうか？'),c('今いませんけど、どういったご用件ですか？'),
  s('{客}様からお問い合わせをいただいておりまして、そのご連絡です。何時ごろでしたらお戻りでしょうか？改めてお電話いたします。'),
  w('ご本人以外には、査定・売却の話は出さない（家族に内緒のケースがある）。戻り時間だけ確認する。'),
  h('留守番電話のとき<span class="draft">追加案・要監修</span>'),
  s('国分ハウジング不動産の{担当}と申します。{媒体}から査定のご依頼をいただき、ありがとうございます。査定金額のご案内でお電話いたしました。改めてご連絡いたします。お急ぎの場合は{店舗TEL}までご連絡ください。'),
  n('20秒以内。留守電のあとはすぐ下のSMSを送り、時間帯を変えて再架電する。'),
  h('不在時のSMS')+'<textarea class="sms" id="absSms"></textarea><div class="row"><button class="btn solid" data-copy="abs">不在SMSをコピー</button></div>'].join(''),
 ()=>{let o=seg('type',['戸建','マンション','土地'],'種別');
  o+= K.type==='マンション'
   ? s('お問い合わせいただいた物件のご住所ですが、{住所}、マンション名が{MS}、お部屋番号が{部屋}号室でお間違いないでしょうか？')
   : s('お問い合わせいただいた物件のご住所ですが、{住所}の'+(K.type||'物件')+'でお間違いないでしょうか？');
  o+=n('Googleマップのストリートビューで物件を特定。同時にレインズ・ポータルで同マンション／同エリアの在庫と成約事例を見ておく。');
  o+=`<div class="row">${fld('area','入力面積','〇〇㎡',90)}${fld('age','入力築年','平成〇年',90)}</div>`;
  o+=s('ありがとうございます。広さですが、{面積}と登録いただきましたが、契約書または登記簿に記載のある正しい広さでお間違いないでしょうか？')+c('大体で入力しました');
  o+=s('かしこまりました。築年数は{築年}とありますが、こちらは正確な築年でしょうか？')+c('多分あってると思います…');
  o+=s('ありがとうございます。「広さ」と「築年」は査定額に大きく影響しますので、弊社で登記簿を取得して、正確な広さと築年を確認させていただきます。');
  o+=h('名義人')+s('物件の名義人様ですが、{客}様ご本人様でよろしいでしょうか？')+seg('owner',['本人','本人以外']);
  if(K.owner==='本人以外') o+=s('かしこまりました。物件の名義人様はどなたになりますか？')+`<div class="row">${fld('ownerRel','名義人との関係','父・母・共有 等',160)}</div>`+w('名義人との関係と、なぜ代わりに査定依頼をしたのかを必ず聞く。');
  o+=h('物件の状況')+(K.owner==='本人以外'?s('査定いただいた物件は、どなたかお住まいでしょうか？'):s('現在の物件の状況ですが、{客}様がお住まいでお間違いないでしょうか？'))+seg('occ',['居住中','空き家','賃貸中']);
  if(K.occ==='空き家') o+=n('いつから空き家か、なぜ空き家になったのかを聞く。')+`<div class="row">${fld('occNote','いつから・なぜ','',220)}</div>`;
  o+=h('残債')+s('残債はございますか？')+seg('loan',['あり','なし','不明']);
  if(K.loan==='あり') o+=s('残債はおいくらぐらい残っていますか？')+`<div class="row">${fld('loanAmt','残債','1,500万円',120)}</div>`+s('ありがとうございます。銀行から届くローン残高のお知らせのようなものは、お手元にありますか？')+seg('loanDoc',['手元にある','探せばある','ない']);
  return o+n('ここまでで確認：住所／種別／名義人（本人以外なら関係と代理の理由）／状況（空き家ならいつから・なぜ）／残債');},
 ()=>{let o='';
  if(K.type==='マンション') o+=s('Googleマップで物件を拝見しているのですが、すごくいいマンションですね。最寄り駅は{駅}ですよね？駅からも近いですし、徒歩10分ぐらいでしょうか？')+n('マンションは「いいマンションですね」＋ロケーションで褒める。');
  else o+=s('Googleマップで物件を拝見しているのですが、カーポートがある、白い外壁の戸建てでお間違いないでしょうか？')+n('見えた特徴に言い換える。特徴がなければ駐車場・前面道路・隣家の特徴で物件を特定する。')+c('はい、そうですね')+s('ありがとうございます。とてもきれいですね。過去にリフォームはされましたか？')+c('いえ、ないですよ')+s('そうなんですね。きれいな状態ですと、より高い査定額をご案内できます。')+n('庭・駐車スペース・きれいさ・外構のデザイン・日当たりで褒める。');
  o+=h('立地で褒める')+s('最寄り駅は{駅}ですかね？駅から徒歩10分ぐらいでしょうか？')+n('小学校区・交通・道路アクセス・商業施設で利便性を褒める。')+c('あっ、そうですね。');
  o+=s('{駅}は今とても人気で、特に徒歩15分圏内で駐車場が2台以上ある物件は希少価値が高く、ファミリー層に人気があります。')+s('弊社も{駅}エリアで、高値で売却できた実績がございます。');
  o+=s('最近ちょうど、{駅}エリアで購入を希望されているお客様がご来店されまして、条件がぴったりなので、ぜひご案内できればと思っています。');
  o+=w('購入希望客・高値成約の話は、実際にある場合だけ使う。成約・在庫事例に根拠があれば、少し高めの金額をさらっと伝えて期待感を高める。');
  return o+n('ここで査定への期待値と「話せる空気」を作れるかが勝負。');},
 ()=>{let o=s('物件について、もう何点かお伺いしたいのですが、')+n('クローズ→クローズ→オープンの順で聞き、売却理由の本音を話してもらえる状態を作る。');
  o+=h('戸建・マンション共通')+chk('com',COMMON_HEAR);
  if(K.type==='マンション') o+=h('マンション')+chk('ms',MS_HEAR);
  else if(K.type==='土地') o+=h('土地')+chk('land',LAND_HEAR);
  else o+=h('戸建')+chk('kd',KD_HEAR)+(K.type?'':n('種別が未選択のため戸建の項目を表示中（②で選択）'));
  return o;},
 ()=>{let o=s('いろいろとありがとうございます。売却に関してなんですが、売却の希望金額はございますか？')+`<div class="row">${fld('price','希望金額','',140)}</div>`+c('いや、どのくらいなのかなと思って');
  o+=s('かしこまりました。売却の希望時期はございますか？')+`<div class="row">${fld('when','希望時期','',140)}</div>`+c('急いでないですよ、大体いくらぐらいかなと思っただけで…');
  o+=s('そこまでお急ぎではなくて、まずは金額が知りたいということですね。例えばですが、金額によっては売却をお考えになりますか？')+seg('temp',['すぐ売りたい','金額次第','まだ売る気はない'],'温度感')+n('すぐに動けない理由・背景も確認する。');
  o+=s('今回、査定をご依頼いただいた理由は何でしょうか？')+c('まぁ、金額が知りたくて…');
  o+=s('金額を知りたい理由、売却を検討される理由は、大きく「離婚」「相続」「住み替え」「資産整理」の4つと言われていますが、どれかに当てはまりますか？');
  o+=n('反響の備考に理由があればストレートに確認してOK。「ただ金額が知りたかった」でも、個人情報を入れてまで知りたかった本当の理由が必ずある。');
  o+=seg('reason',Object.keys(REASONS),'売却理由');
  if(K.reason) o+=s('{理由}ですね、かしこまりました。弊社は{理由}に伴う売却のサポートを何件もお手伝いしておりますので、ご安心ください。');
  return o;},
 ()=>{if(!K.reason) return w('先に⑤で売却理由を選んでください。')+`<button class="btn" data-step="4">⑤売却理由の確認へ</button>`;
  const R=REASONS[K.reason];let o=w('売却状況の確認と断定が、アポ獲得で一番大事。ここで問合せ主×状況を決め切る。');
  o+=s('{理由}ということですが、');
  o+=seg('asker',R.askers,'問合せ主');
  if(K.asker) o+=seg('status',R.statuses(K.asker),'状況');
  const k=comboKey();
  if(k){o+=h('追加ヒアリング'+(DRAFT[k]?'<span class="draft">マニュアル未収録・たたき台</span>':''))+chk(k,HEAR[k]);
   if(k==='rk_naisho') o+=n('「もらってから売る」なら低い査定、「売ってから分ける」なら高い査定の方がお客様に有利。');
   if(k==='rk_chotei') o+=w('ややこしいところに踏み込む勇気と覚悟が必要。');
   const fk=K.reason==='相続'?(K.asker.startsWith('被')?'相続被':'相続人'):K.reason;
   o+=h('この方が気にしていること（想定）')+`<div class="feel">${FEEL[fk].map(x=>`<span>${esc(x)}</span>`).join('')}</div>`;
   o+=`<div class="nav"><button class="btn solid" data-step="6">⑦フックトークへ</button></div>`;}
  return o;},
 ()=>{const k=comboKey();
  if(!k) return w('先に⑥で問合せ主と状況を断定してください。')+`<button class="btn" data-step="5">⑥状況の確認と断定へ</button>`;
  let o=`<p class="goal" style="color:var(--ink);font-weight:700">${esc(K.reason)} × ${esc(K.asker)} × ${esc(K.status)}</p>`;
  o+=h('訪問フックの要点'+(DRAFT[k]?'<span class="draft">マニュアル未収録・たたき台</span>':''))+`<ul class="hooks">${HOOKS[k].map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
  if(TALK[k]) o+=h('フックトーク'+(TALK_X[k]?'<span class="draft">追加案・要監修</span>':''))+TALK[k]().join('');
  else o+=n('この組み合わせは専用トークなし。上の要点を話し、下の締めで⑧へつなぐ。')+s('知っておいていただきたい大切なお話がたくさんありますので、一度詳しいお話だけでも聞いていただき、そのうえで売るか売らないかを考えていただければと思います。');
  if(k==='sz_akiya') o+=h('所有者が遠方で戻らない場合')+`<ul class="hooks"><li>鍵を送っていただく</li><li>近くのご親族に鍵を預け、立ち会っていただく</li><li>まずZoom等でWEB面談のアポを取り、その場で訪問査定アポを取る</li></ul>`;
  if(K.reason==='離婚') o+=w(K.status.startsWith('離婚後')?'離婚後は、すぐにでも媒介を取りたい案件。最短日程で訪問を取る。':'内緒・調停中は中長期フォロー前提。訪問を断られたら店舗へのご来店に切り替える。');
  return o;},
 ()=>{let o=s('すぐに売りに出しましょうということではなく、査定価格のご案内はもちろん、不動産の売却のポイントや売却の流れのご説明もあわせてさせていただきます。金額のご提案自体はそんなにお時間のかかるものではないので、15分から20分程度で済むかと思います。実際に売りに出すか、今後どうしていくかは、お話を聞いていただいてからのお客様のご判断です。');
  o+=s('訪問はお客様のご都合の良い時間に合わせられます。最短ですと本日の午後、もしくは明日の午前中が空いておりまして、ちょうど{駅}方面にお伺いする予定もございます。{客}様のご都合はいかがでしょうか？');
  o+=w('他社の査定が入る前提で、最短・最速で取る。日時は営業から具体的に提案する（「いつがよろしいですか」と聞かない）。');
  o+=c('明日の午前中であれば')+s('ありがとうございます。では明日の午前中、10時頃はいかがでしょうか？')+c('あっ、はい、大丈夫です');
  if(K.reason==='離婚'&&K.status&&!K.status.startsWith('離婚後')) o+=n('訪問を断られたら：「店舗でしたら、ご家族に知られずにご相談いただけます」と来店に切り替える。');
  o+=h('断られたら：切り口を変えて最大3回<span class="draft">追加案・要監修</span>');
  o+=n('2回目：売却理由から「会う理由」を伝える。')+s((K.reason?'{理由}の場合は、':'')+'お電話ではお伝えしきれない大事なお話が多いんです。売るか売らないかを決める前に知っておいていただきたいことを、直接ご説明させてください。');
  o+=s('平日と土日でしたら、どちらがご都合よろしいでしょうか？……午前と午後ではいかがですか？')+n('「いつがよろしいですか」ではなく二択で聞く。');
  o+=n('3回目：机上と訪問の違いを伝え、心配するスタンスで。')+s('机上の査定は、周辺のデータだけで出す金額なので、室内の状態や日当たり、リフォームの有無は反映されていないんです。多くの方が、実際にお会いして根拠をお聞きになってから判断されています。本当に机上の金額だけでよろしいでしょうか？');
  o+=h('訪問が取れなかったとき<span class="draft">追加案・要監修</span>');
  o+=s('かしこまりました。では、店舗でのご相談や、スマホのビデオ通話でのご相談はいかがでしょうか？15分ほどで、同じ内容をご説明できます。');
  o+=s('では、机上での査定結果をまとめて、ポストにお届けいたします。お目通しいただいた頃に、改めてお電話でご説明してもよろしいでしょうか？何日の何時ごろでしたらご都合がよろしいですか？');
  o+=s('今後のご連絡は、お電話とショートメッセージではどちらがよろしいですか？ご都合のよい時間帯もお伺いしてよろしいでしょうか？');
  o+=`<ul class="hooks"><li>次回の連絡日時を約束する（記録の「再架電」「中長期フォロー」へ）</li><li>連絡手段と時間帯の希望を聞く</li><li>他社の査定状況（何社・訪問予定）を聞く</li><li>売却を考える金額の目安を聞く（「高ければ売る」の確認）</li></ul>`;
  o+=w('はっきり「連絡不要」と言われたら追客終了。勧誘を続けるのは宅建業法で禁止されている。');
  return o+`<div class="nav"><button class="btn solid" data-step="8">⑨日程を確定する</button></div>`;},
 ()=>{const a=K.appt;let o=`<div class="row">
   <label class="fld">日付<input type="date" data-a="date" value="${esc(a.date)}"></label>
   <label class="fld">時刻<input type="time" data-a="time" value="${esc(a.time)}" step="900" style="min-width:90px"></label>
   <label class="fld">訪問先<input data-a="place" value="${esc(a.place)}" placeholder="${esc(K.info.addr||'物件住所')}" style="min-width:220px"></label>
   <label class="fld"><input type="checkbox" data-a="docs" ${a.docs?'checked':''} style="min-width:0"> 資料持参を依頼</label></div>`;
  o+=s('では、{日付}の{時刻}にご訪問させていただきます。訪問先は、お問い合わせいただいた{場所}でよろしいでしょうか？')+c('あっ、はい、大丈夫です。');
  o+=s('ありがとうございます。この後、{客}様の携帯電話に確認のショートメッセージをお送りします。何かあれば、国分ハウジング不動産の{担当}までお気軽にご連絡ください。');
  if(a.docs) o+=s('1点お願いがございまして、物件ご購入時の資料（契約書や図面など）をご準備いただけますと、当日スムーズにご案内できます。ご確認いただけますでしょうか？');
  o+=s('ありがとうございます。では{日付}の{時刻}にお伺いいたしますので、よろしくお願いいたします。');
  o+=h('確認SMS')+`<textarea class="sms" id="sms"></textarea><div class="cnt" id="smsCnt"></div>
   <div class="row"><button class="btn solid" data-copy="sms">SMSをコピー</button><button class="btn" data-cal="appt" title="Googleカレンダーに追加">📅 カレンダーに追加</button><label class="fld">店舗TEL<input id="tel" value="${esc(pref.tel)}" style="min-width:130px"></label></div>`;
  return o;}
];

function absSmsText(){
 const i=K.info;
 return [`${i.name||'●●'}様`,`国分ハウジング不動産の${i.staff||'●●'}です。${i.media?i.media+'から':''}査定のご依頼ありがとうございます。査定金額のご案内でお電話しました。`,
  `ご都合のよい時間帯をご返信いただければ、改めてお電話いたします。`,`TEL ${pref.tel||'●●'}`].join('\n');
}
function smsText(){
 const i=K.info,a=K.appt;
 const lines=[`${i.name||'●●'}様`,`本日はお電話ありがとうございました。国分ハウジング不動産の${i.staff||'●●'}です。`,
  `${fmtDate(a.date)||'●月●日'} ${a.time||'●:●●'}に、${a.place||i.addr||'ご自宅'}へ査定にお伺いいたします。`];
 if(a.docs) lines.push('お手元にあれば、ご購入時の契約書・図面をご準備ください。');
 lines.push(`ご不明点は${pref.tel||'●●'}（${i.staff||'担当'}）までお気軽にご連絡ください。`);
 return lines.join('\n');
}

/* ============ 描画 ============ */
function renderSteps(){
 $('#stepList').innerHTML=STEPS.map((x,i)=>`<li><button data-step="${i}" class="${i===K.step?'cur':''} ${x.key?'key':''}" aria-current="${i===K.step?'step':'false'}"><span class="no">${'①②③④⑤⑥⑦⑧⑨'[i]}</span><span class="nm">${x.t}<small>${x.g}</small></span></button></li>`).join('');
 const k=comboKey();
 $('#judge').innerHTML=`<dt>売却理由</dt><dd>${esc(K.reason||'—')}</dd><dt>問合せ主</dt><dd>${esc(K.asker||'—')}</dd><dt>状況</dt><dd>${esc(K.status||'—')}${k?'（断定）':''}</dd>`;
}
function renderProg(){
 const it=[['住所',K.info.addr,1],['種別',K.type,1],['名義',K.owner,1],['状況',K.occ,1],['残債',K.loan,1],['理由',K.reason,4],['断定',comboKey(),5],['アポ',K.appt.date,8]];
 $('#prog').innerHTML='<span class="lb">確認</span>'+it.map(([l,v,st])=>`<button class="chip ${v?'ok':''}" data-step="${st}">${l}</button>`).join('');
}
function renderStage(){
 const st=STEPS[K.step];
 let o='';
 if(K.rb){const r=RB.find(x=>x.id===K.rb);
  o+=`<section class="rb" aria-live="polite"><button class="btn sm x" data-rbclose>閉じる Esc</button><p class="ttl">${esc(r.t)}${r.x?'<span class="draft">追加案・要監修</span>':''}</p>`+
   r.b.map(([hd,ls],i)=>`<h4>${i+1}．${esc(hd)}</h4>`+ls.map(s).join('')).join('')+(r.warn?w(r.warn):'')+`</section>`;}
 o+=`<h2><span class="n">${'①②③④⑤⑥⑦⑧⑨'[K.step]}</span>${st.t}</h2><p class="goal">${st.g}</p>`+BODY[K.step]();
 o+=`<div class="nav">${K.step>0?`<button class="btn" data-step="${K.step-1}">← 戻る</button>`:''}${K.step<8?`<button class="btn" data-step="${K.step+1}">次へ →</button>`:''}</div>`;
 $('#stage').innerHTML=o;
 if(K.step===8){const t=$('#sms');t.value=K.sms||smsText();cnt();}
 if(K.step===0){const t=$('#absSms');if(t)t.value=absSmsText();}
}
function cnt(){const t=$('#sms');if(!t)return;const n=Array.from(t.value).length;$('#smsCnt').textContent=`${n}文字　${n<=70?'標準SMS（1通分）':'長文SMS'}`}
function renderRbList(q){
 q=(q||'').trim();
 const list=q?RB.map(r=>({r,sc:r.kw.filter(k=>q.includes(k)||k.includes(q)).length+(r.t.includes(q)?2:0)})).filter(x=>x.sc>0).sort((a,b)=>b.sc-a.sc).map(x=>x.r):RB;
 const item=r=>`<li><button data-rb="${r.id}" class="${K.rb===r.id?'on':''}">${esc(r.t)}${r.x?'<span class="draft">追加案</span>':''}<span class="k">${esc(r.b.map(b=>b[0]).join('／'))}</span></button></li>`;
 if(!q){const seen=new Set();let h=RB_G.map(([g,ids])=>`<li class="grp">${esc(g)}</li>`+ids.map(id=>RB.find(r=>r.id===id)).filter(Boolean).map(r=>{seen.add(r.id);return item(r)}).join('')).join('');
  const rest=RB.filter(r=>!seen.has(r.id));if(rest.length)h+='<li class="grp">その他</li>'+rest.map(item).join('');
  $('#rbList').innerHTML=h;return list;}
 $('#rbList').innerHTML=list.length?list.map(item).join(''):'<li class="hint">該当なし。言い換えて入力してください。</li>';
 return list;
}
function memoText(){
 const i=K.info,now=new Date(),p=v=>String(v).padStart(2,'0');
 const L=[`【一括査定 架電メモ】${now.getFullYear()}/${p(now.getMonth()+1)}/${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}　担当：${i.staff}`,
 `お客様：${i.name}様　媒体：${i.media}`,
 `物件：${K.type} ${i.addr}${K.type==='マンション'?` ${i.ms} ${i.room?i.room+'号室':''}`:''}`,
 `面積（入力値）：${K.area}　築年（入力値）：${K.age}`,
 `名義：${K.owner}${K.owner==='本人以外'?'（'+K.ownerRel+'）':''}　状況：${K.occ}${K.occNote?'（'+K.occNote+'）':''}`,
 `残債：${K.loan}${K.loanAmt?' 約'+K.loanAmt:''}${K.loanDoc?'／残高通知：'+K.loanDoc:''}`,
 `希望金額：${K.price}　希望時期：${K.when}　温度感：${K.temp}`,
 `売却理由：${K.reason}　問合せ主：${K.asker}　状況：${K.status}`];
 const all={com:COMMON_HEAR,ms:MS_HEAR,kd:KD_HEAR,land:LAND_HEAR,...HEAR};
 const hs=Object.keys(K.ck).filter(k=>K.ck[k]||K.nt[k]).map(k=>{const[g,ix]=k.split('#');return `・${all[g][ix]}${K.nt[k]?'：'+K.nt[k]:''}`});
 if(hs.length) L.push('ヒアリング：',...hs);
 L.push(`アポ：${K.appt.date?fmtDate(K.appt.date)+' '+K.appt.time+' '+(K.appt.place||i.addr):'未取得'}`);
 const sec=elapsed();if(sec) L.push(`通話時間：${fmtT(sec)}`);
 if(pref.trInMemo&&K.tr.length) L.push('―― 文字起こし（営業・顧客の区別なし）――',trText());
 return L.join('\n');
}
const renderMemo=()=>{$('#memo').value=memoText()};
function renderAll(){renderSteps();renderProg();renderStage();renderMemo();renderLbar();renderTr();}

/* ============ タイマー ============ */
const elapsed=()=>Math.floor((K.tAcc+(K.run?Date.now()-K.t0:0))/1000);
const fmtT=x=>`${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`;
setInterval(()=>{$('#timer').textContent=fmtT(elapsed())},500);
$('#tBtn').onclick=()=>{if(!K.startedAt)K.startedAt=new Date().toISOString();if(K.run){K.tAcc+=Date.now()-K.t0;K.run=false;$('#tBtn').textContent='通話再開';}else{K.t0=Date.now();K.run=true;$('#tBtn').textContent='通話終了';}renderMemo();};

/* ============ イベント ============ */
function go(i){i=Math.max(0,Math.min(8,i));if(i!==K.step){K.ev.push({t:elapsed(),k:'step',v:i});K.maxStep=Math.max(K.maxStep,i);}K.step=i;renderAll();APP().scrollTop=0;}
root.addEventListener('click',e=>{
 const b=e.target.closest('button,[data-ck]');if(!b)return;
 if(b.dataset.step!=null) return go(+b.dataset.step);
 if(b.dataset.set){const k=b.dataset.set,v=b.dataset.v;K[k]=K[k]===v?'':v;
  if(k==='reason'){K.asker='';K.status='';}
  if(k==='asker'&&K.status&&!(K.asker&&REASONS[K.reason].statuses(K.asker).includes(K.status))){K.status='';}
  renderAll();return;}
 if(b.dataset.rb){openRb(b.dataset.rb,false);return;}
 if(b.hasAttribute('data-rbclose')){K.rb=null;renderStage();renderRbList($('#rbSearch').value);return;}
 if(b.dataset.tab){root.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));$('#paneRb').hidden=b.dataset.tab!=='rb';$('#paneTr').hidden=b.dataset.tab!=='tr';$('#paneMemo').hidden=b.dataset.tab!=='memo';renderMemo();renderTr();return;}
 if(b.dataset.copy==='tr') return copy(trText());
 if(b.dataset.apply) return applySug(b.dataset.apply);
 if(b.dataset.sugrb){openRb(b.dataset.sugrb,false);return;}
 if(b.dataset.copy==='memo') return copy(memoText());
 if(b.dataset.copy==='sms') return copy($('#sms').value);
 if(b.dataset.copy==='abs') return copy($('#absSms').value);
 if(b.dataset.cal==='appt') return calAppt();   /* v14.25 */
});
/* v14.25 アポをGoogleカレンダーへ（営業管理システム本体の gcalUrl を使う） */
function calAppt(){
 const a=K.appt,i=K.info;
 if(!a.date){toast('アポの日付を入れてください');return}
 const url=(typeof gcalUrl==='function')?gcalUrl({date:a.date,time:a.time,min:60,title:'【訪問査定】'+(i.name?i.name+'様':'')+(i.addr?'　'+i.addr:''),location:a.place||i.addr,
  details:['反響元：'+(i.media||'―'),'担当：'+(i.staff||'―'),K.type?'種別：'+K.type:'',a.docs?'資料（購入時の契約書・図面など）の準備を依頼済み':'']}):'';
 if(!url){toast('カレンダーを開けませんでした');return}
 window.open(url,'_blank','noopener');
}
root.addEventListener('change',e=>{
 const t=e.target;
 if(t.dataset.ck){K.ck[t.dataset.ck]=t.checked;t.closest('li').classList.toggle('done',t.checked);renderMemo();}
 if(t.dataset.a==='docs'){K.appt.docs=t.checked;K.sms='';renderStage();renderMemo();}
});
root.addEventListener('input',e=>{
 const t=e.target;
 if(t.dataset.f){K.info[t.dataset.f]=t.value;if(t.dataset.f==='staff'){pref.staff=t.value;savePref();}renderStage();renderProg();renderMemo();return;}
 if(t.dataset.s){K[t.dataset.s]=t.value;renderProg();renderMemo();return;}
 if(t.dataset.nt){K.nt[t.dataset.nt]=t.value;renderMemo();return;}
 if(t.dataset.a&&t.dataset.a!=='docs'){K.appt[t.dataset.a]=t.value;K.sms='';$('#sms').value=smsText();cnt();renderProg();renderMemo();return;}
 if(t.id==='sms'){K.sms=t.value;cnt();return;}
 if(t.id==='tel'){pref.tel=t.value;savePref();K.sms='';$('#sms').value=smsText();cnt();return;}
 if(t.id==='rbSearch'){renderRbList(t.value);}
});
root.addEventListener('focusout',e=>{if(e.target.dataset?.a&&e.target.dataset.a!=='docs'){const y=APP().scrollTop;renderStage();APP().scrollTop=y;}});
$('#rbSearch').addEventListener('keydown',e=>{
 if(e.key==='Enter'){const l=renderRbList(e.target.value);if(l[0])openRb(l[0].id,false);}
});
document.addEventListener('keydown',e=>{
 if(!isOpen())return;
 const AE=root.activeElement||document.body;
 const typing=/INPUT|TEXTAREA|SELECT/.test(AE.tagName);
 if(e.key==='Escape'){if(K.rb){K.rb=null;renderStage();renderRbList($('#rbSearch').value);}if(AE.blur)AE.blur();return;}
 if(typing||e.ctrlKey||e.metaKey||e.altKey||!$('#hist').hidden||root.querySelector('dialog[open]')) return;
 if(e.key==='/'){e.preventDefault();$('#rbSearch').focus();$('#rbSearch').select();}
 else if(e.key==='m'||e.key==='M') toggleMic();
 else if(e.key==='ArrowRight') go(K.step+1);
 else if(e.key==='ArrowLeft') go(K.step-1);
 else if(/^[1-9]$/.test(e.key)) go(+e.key-1);
});
function clearAll(){
 micStop();K=blank();K.info.staff=myAbbr();
 root.querySelectorAll('[data-f]').forEach(x=>x.value=K.info[x.dataset.f]||'');
 $('#rbSearch').value='';$('#tBtn').textContent='通話開始';renderRbList('');renderAll();APP().scrollTop=0;
}

/* ============ 自動聞き取り ============ */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let rec=null,micOn=false,interim='',micMsg='',rbOpenedAt=0;const lastHit={};
const hms=()=>{const d=new Date(),p=v=>String(v).padStart(2,'0');return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`};
function toggleMic(){micOn?micStop():micStart()}
function micStart(){
 if(!SR){alert('このブラウザは音声認識に対応していません。PCのGoogle ChromeかMicrosoft Edgeで開いてください。');return;}
 if(!pref.micOk){
  if(!confirm('自動聞き取りを開始します。\n\n・音声はブラウザの音声認識サービス（Google／Microsoft）に送信されて文字になります。\n・通話の冒頭で「内容を記録させていただきます」とお客様に伝えてください。\n・スマホはスピーカー通話にして、PCの近くに置いてください。\n\nよろしいですか？'))return;
  pref.micOk=true;savePref();
 }
 rec=new SR();rec.lang='ja-JP';rec.continuous=true;rec.interimResults=true;
 rec.onresult=e=>{let it='';for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(r.isFinal)addLine(r[0].transcript);else it+=r[0].transcript;}interim=it;micMsg='';renderLbar();renderTr();};
 rec.onerror=e=>{
  if(e.error==='not-allowed'||e.error==='service-not-allowed'){micOn=false;micMsg='マイクの使用が許可されていません。アドレスバー左の鍵アイコンからマイクを「許可」にしてください。';}
  else if(e.error==='audio-capture'){micOn=false;micMsg='マイクが見つかりません。PCのマイク接続を確認してください。';}
  else if(e.error==='network'){micMsg='通信エラー。再接続しています…';}
  renderLbar();updMic();};
 rec.onend=()=>{if(micOn)setTimeout(()=>{if(micOn)try{rec.start()}catch(_){}},300);else{interim='';renderLbar();}};
 micOn=true;micMsg='';
 try{rec.start();}catch(_){}
 if(!K.run)$('#tBtn').click();
 updMic();renderLbar();
}
function micStop(){micOn=false;interim='';try{rec&&rec.stop()}catch(_){}updMic();renderLbar();}
function updMic(){const b=$('#micBtn');b.classList.toggle('live',micOn);b.textContent=micOn?'聞き取り中':'自動聞き取り';b.setAttribute('aria-pressed',micOn);}
function addLine(x){x=x.trim();if(!x)return;K.tr.push({t:hms(),x});detect(x);renderMemo();}
function openRb(id,auto){K.ev.push({t:elapsed(),k:'rb',v:id,auto:!!auto});K.rb=id;rbOpenedAt=Date.now();renderStage();renderRbList($('#rbSearch').value);if(!auto)APP().scrollTop=0;}
function detect(x){
 const now=Date.now();
 // 切り返し
 RB.forEach(r=>{
  if(!TRIG[r.id].some(k=>x.includes(k)))return;
  if(lastHit[r.id]&&now-lastHit[r.id]<45000)return;
  lastHit[r.id]=now;
  K.sug.rb=[r.id,...K.sug.rb.filter(i=>i!==r.id)].slice(0,3);
  if(pref.autoOpen&&K.rb!==r.id&&(!K.rb||now-rbOpenedAt>15000))openRb(r.id,true);
 });
 // 売却理由（営業が4つを読み上げた発話は無視）
 if(!K.reason){
  const hits=Object.keys(REASON_TRIG).map(r=>[r,REASON_TRIG[r].filter(k=>x.includes(k)).length]).filter(v=>v[1]>0).sort((a,b)=>b[1]-a[1]);
  if(hits.length&&hits.length<3)K.sug.reason=hits[0][0];
 }
 // 状況
 const R=K.reason||K.sug.reason;
 if(R&&!K.status&&STATUS_TRIG[R]){const m=STATUS_TRIG[R].find(v=>x.includes(v[0]));if(m)K.sug.status={reason:R,asker:m[1],status:m[2]};}
 // 残債
 if(K.loan!=='なし'&&!K.loanAmt&&/残|ローン/.test(x)){const m=x.match(/([0-9０-９][0-9０-９,，.]*)\s*(千万|万)/);if(m){let v=m[1].replace(/[０-９]/g,d=>String.fromCharCode(d.charCodeAt(0)-65248)).replace(/[,，]/g,'');if(m[2]==='千万')v=String(parseFloat(v)*1000);K.sug.loan=Number(v).toLocaleString()+'万円';}}
}
function applySug(k){
 const g=K.sug;if(!k.startsWith('x-'))K.ev.push({t:elapsed(),k:'sug',v:k});
 if(k==='reason'&&g.reason){K.reason=g.reason;K.asker='';K.status='';if(g.status&&g.status.reason!==g.reason)delete g.status;delete g.reason;}
 if(k==='status'&&g.status){K.reason=g.status.reason;if(g.status.asker)K.asker=g.status.asker;K.status=g.status.status;delete g.status;delete g.reason;}
 if(k==='loan'&&g.loan){K.loan='あり';K.loanAmt=g.loan;delete g.loan;}
 if(k.startsWith('x-')){delete g[k.slice(2)];}
 renderAll();
}
function renderLbar(){
 const el=$('#lbar');
 if(!micOn&&!K.tr.length&&!micMsg){el.innerHTML='';return;}
 const last=K.tr.length?K.tr[K.tr.length-1].x:'';
 const g=K.sug,c=[];
 g.rb.forEach(id=>{const r=RB.find(v=>v.id===id);c.push(`<button class="cand ${K.rb===id?'ghost':''}" data-sugrb="${id}"><small>切り返し</small>${esc(r.t)}</button>`)});
 if(g.reason&&!K.reason)c.push(`<button class="cand" data-apply="reason"><small>売却理由</small>${esc(g.reason)}を反映</button>`);
 if(g.status&&!K.status)c.push(`<button class="cand" data-apply="status"><small>状況</small>${esc((g.status.asker?g.status.asker+'／':'')+g.status.status)}を反映</button>`);
 if(g.loan&&!K.loanAmt)c.push(`<button class="cand" data-apply="loan"><small>残債</small>約${esc(g.loan)}を反映</button>`);
 el.innerHTML=`<section class="lbar" aria-live="polite"><div class="st">${micOn?'<b>● 聞き取り中</b>':'停止中'}${micMsg?`<b>${esc(micMsg)}</b>`:''}<span class="sp"></span>
  <label><input type="checkbox" id="autoOpen" ${pref.autoOpen?'checked':''}> 切り返しを自動で開く</label></div>
  <p class="last">${last?'「'+esc(last)+'」':''}<span class="im">${esc(interim)}</span></p>
  ${c.length?`<div class="cands">${c.join('')}</div>`:''}</section>`;
}
function allTrig(){return [...Object.values(TRIG).flat(),...Object.values(REASON_TRIG).flat()]}
function renderTr(){
 const ul=$('#trList');
 const ks=allTrig();
 const hl=t=>{let h=esc(t);ks.forEach(k=>{h=h.split(esc(k)).join('<mark>'+esc(k)+'</mark>')});return h};
 ul.innerHTML=K.tr.length||interim?K.tr.map(l=>`<li><time>${l.t}</time>${hl(l.x)}</li>`).join('')+(interim?`<li class="im">${esc(interim)}</li>`:''):'<li class="hint">「自動聞き取り」を押すと、ここに会話が表示されます。</li>';
 ul.scrollTop=ul.scrollHeight;
}
const trText=()=>K.tr.map(l=>`${l.t} ${l.x}`).join('\n');
$('#micBtn').onclick=toggleMic;
$('#trClear').onclick=()=>{if(confirm('文字起こしを消去しますか？')){K.tr=[];K.sug={rb:[]};renderAll();}};
$('#trInMemo').checked=pref.trInMemo;
root.addEventListener('change',e=>{
 if(e.target.id==='autoOpen'){pref.autoOpen=e.target.checked;savePref();}
 if(e.target.id==='trInMemo'){pref.trInMemo=e.target.checked;savePref();renderMemo();}
});
const setHH=()=>APP().style.setProperty('--hh',$('.top').offsetHeight+'px');
addEventListener('resize',()=>{if(isOpen())setHH()});

/* ============ 記録（② の planner:navi_save） ============ */
/* ⚠️ 以前のアプリは Supabase の call_logs へ別のログインで保存していた。Dashboard のログインで ② へ送る（naviHost.ts の save）。
   ⚠️ 届かなかったとき（通信の失敗・② の障害）は、この端末に「未送信」として残し、ヘッダーのボタンで送り直す（以前のアプリと同じ） */
const APP_VER='kaden-navi v6（Dashboard v2.2.226）';
const OUTCOMES=['訪問アポ獲得','来店アポ獲得','WEB面談アポ獲得','再架電（日時約束）','中長期フォロー','断り・終了','不在・不通'];
const APPO=new Set(OUTCOMES.slice(0,3));
let queue=[];try{queue=JSON.parse(localStorage.getItem(LS+'_q2')||'[]')}catch(e){}
const saveQ=()=>{try{queue.length?localStorage.setItem(LS+'_q2',JSON.stringify(queue)):localStorage.removeItem(LS+'_q2')}catch(e){};updQ();};
function updQ(){$('#qInfo').innerHTML=queue.length?`<button class="qbadge" id="qRetry" title="クリックで再送">未送信 ${queue.length}件</button>`:''}

function buildRecord(outcome,next,withTr){
 const i=K.info,a=K.appt,hear={};
 const all={com:COMMON_HEAR,ms:MS_HEAR,kd:KD_HEAR,land:LAND_HEAR,...HEAR};
 Object.keys(K.ck).forEach(k=>{if(K.ck[k]||K.nt[k]){const[g,ix]=k.split('#');hear[all[g][ix]]=K.nt[k]||'✓'}});
 const rbs=[...new Set(K.ev.filter(e=>e.k==='rb').map(e=>e.v))];
 return {lead_id:ctx?ctx.id:null,lead_kind:ctx?ctx.kind:null,staff:i.staff,customer:i.name,media:i.media,address:i.addr,ms_name:i.ms,room:i.room,station:i.station,
  prop_type:K.type,area:K.area,built:K.age,owner:K.owner+(K.ownerRel?'（'+K.ownerRel+'）':''),occupancy:K.occ+(K.occNote?'（'+K.occNote+'）':''),
  loan:K.loan,loan_amount:K.loanAmt,wish_price:K.price,wish_time:K.when,temperature:K.temp,
  reason:K.reason,asker:K.asker,status:K.status,outcome,next_action:next,
  appt_at:a.date?new Date(`${a.date}T${a.time||'00:00'}:00+09:00`).toISOString():null,appt_place:a.date?(a.place||i.addr):null,
  started_at:K.startedAt,duration_sec:elapsed(),max_step:K.maxStep+1,
  hearing:hear,rebuttals:rbs,events:K.ev,transcript:withTr?K.tr:[],memo:memoText(),app_ver:APP_VER};
}
async function flushQ(){
 if(!queue.length)return;
 const rest=[];let sent=0;
 for(const p of queue){try{const r=await A.save(p);sent++;A.onSaved(r.row||null,p.leadId?OUT2CQ[p.outcome]:null);}catch(e){if(e.retryable)rest.push(p);else A.toast('未送信の記録を1件送れませんでした（'+e.message+'）');}}
 queue=rest;saveQ();
 if(sent)A.toast(`未送信の${sent}件を記録しました`);
}
root.addEventListener('click',e=>{if(e.target.id==='qRetry')flushQ();});

let outcome='';
function openSave(){
 micStop();outcome='';$('#nextAct').value='';$('#saveErr').textContent='';$('#saveTr').checked=true;
 $('#outSeg').innerHTML=OUTCOMES.map(o=>`<button data-out="${o}">${o}</button>`).join('');
 nextEdited=false;$('#nextDate').value='';
 $('#leadSaveBox').hidden=!ctx;$('#endWrap').hidden=true;
 $('#endReason').innerHTML=LEAD_ENDS.map(x=>`<option>${esc(x)}</option>`).join('');
 $('#saveHint').textContent=ctx?'架電記録・フェーズ・次回連絡予定日を売り反響に記録し、通話記録にも保存します。':'反響を選ばずに開始したため、通話記録にのみ保存します。';
 if(K.appt.date) setOut('訪問アポ獲得');
 $('#dlgSave').showModal();
}
let nextEdited=false;
function setOut(o){outcome=o;if(ctx){$('#endWrap').hidden=o!=='断り・終了';$('#nextDate').disabled=o==='断り・終了';if(!nextEdited){const[d]=nextDefault(o);$('#nextDate').value=d;}}root.querySelectorAll('#outSeg button').forEach(b=>{const on=b.dataset.out===o;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});}
$('#nextDate').addEventListener('input',()=>{nextEdited=true});
$('#outSeg').addEventListener('click',e=>{const b=e.target.closest('[data-out]');if(b)setOut(b.dataset.out)});
$('#resetBtn').onclick=openSave;
$('#saveCancel').onclick=()=>$('#dlgSave').close();
$('#discardBtn').onclick=()=>{if(confirm('この通話を記録せずに消去して閉じます。よろしいですか？')){$('#dlgSave').close();clearAll();ctx=null;hide();}};
$('#saveBtn').onclick=async()=>{
 if(!outcome){$('#saveErr').textContent='通話結果を選んでください';return;}
 if(!K.info.staff){$('#saveErr').textContent='画面上部の担当者を入力してください';return;}
 const withTr=$('#saveTr').checked,nn0=$('#nextAct').value.trim();
 const nn=nn0||nextDefault(outcome)[1];
 const oc=OUT2CQ[outcome],a=K.appt;
 /* ⚠️ 反響の書き換え（フェーズ・次回連絡予定日・売却理由など）は ② が行う（以前のアプリの applyToLead と同じ決め方。features/realty/calls.ts） */
 const lt=K.temp==='すぐ売りたい'?'至急（今すぐ）':K.temp==='まだ売る気はない'?'未定・様子見':'';
 const payload={leadId:ctx?ctx.id:null,outcome,nextDate:$('#nextDate').value,nextNote:nn,endReason:$('#endReason').value,
  memo:summary(outcome,nn),appt:oc==='apo'&&a.date?{date:a.date,time:a.time||'',place:a.place||''}:null,
  leadReason:leadReason(),leadTiming:lt,record:buildRecord(outcome,nn,withTr)};
 const b=$('#saveBtn');b.disabled=true;b.textContent='記録中…';$('#saveErr').textContent='';
 const finish=msg=>{b.disabled=false;b.textContent='記録して次へ';if($('#dlgSave').open)$('#dlgSave').close();clearAll();ctx=null;hide();A.toast(msg);};
 try{
  const r=await A.save(payload);
  A.onSaved(r.row||null,ctx?oc:null);
  finish(ctx?'売り反響と通話記録に保存しました':'通話記録に保存しました');
 }catch(e){
  if(!e.retryable){b.disabled=false;b.textContent='記録して次へ';$('#saveErr').textContent=e.message;return;}
  queue.push(payload);saveQ();
  finish('送れなかったため、この端末に未送信として保管しました（ナビの上の「未送信」から再送できます）');
 }
};

/* ============ 履歴・分析 ============ */
let H=[],hShown=[];
const ymd=d=>{const p=v=>String(v).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
function openHist(){
 if(!$('#fFrom').value){const t=new Date(),f=new Date();f.setDate(f.getDate()-29);$('#fFrom').value=ymd(f);$('#fTo').value=ymd(t);}
 $('#hist').hidden=false;$('#who').textContent=A.me()||'';loadHist();
}
async function loadHist(){
 $('#hBody').innerHTML='<p class="hint">読み込み中…</p>';
 try{H=await A.loadLogs($('#fFrom').value,$('#fTo').value);}
 catch(e){$('#hBody').innerHTML=`<p class="err">読み込めませんでした：${esc(e.message)}</p>`;return;}
 const opt=(el,vals,all)=>{const cur=el.value;el.innerHTML=`<option value="">${all}</option>`+vals.map(v=>`<option>${esc(v)}</option>`).join('');el.value=vals.includes(cur)?cur:'';};
 const uniq=k=>[...new Set(H.map(r=>r[k]).filter(Boolean))].sort();
 opt($('#fStaff'),uniq('staff'),'全員');opt($('#fOut'),OUTCOMES,'すべて');opt($('#fReason'),Object.keys(REASONS).concat(['（未確認）']),'すべて');
 renderHist();
}
function trStr(r){return (r.transcript||[]).map(l=>l.x).join(' ')}
function renderHist(){
 const st=$('#fStaff').value,ou=$('#fOut').value,re=$('#fReason').value,kw=$('#fKw').value.trim();
 hShown=H.filter(r=>(!st||r.staff===st)&&(!ou||r.outcome===ou)&&(!re||(re==='（未確認）'?!r.reason:r.reason===re))&&(!kw||(r.memo+' '+trStr(r)).includes(kw)));
 const rows=hShown,n=rows.length,ap=rows.filter(r=>APPO.has(r.outcome)).length;
 const conn=rows.filter(r=>r.outcome!=='不在・不通'),avg=a=>a.length?Math.round(a.reduce((s,r)=>s+(r.duration_sec||0),0)/a.length):0;
 const pct=(a,b)=>b?Math.round(a/b*1000)/10+'%':'—';
 let o=`<div class="kpis">
  <div class="kpi"><span>架電数</span><b>${n}</b></div>
  <div class="kpi"><span>通電（不在・不通を除く）</span><b>${conn.length}</b></div>
  <div class="kpi"><span>アポ獲得</span><b>${ap}</b></div>
  <div class="kpi"><span>アポ率（通電ベース）</span><b>${pct(ap,conn.length)}</b></div>
  <div class="kpi"><span>平均通話時間（通電）</span><b>${fmtT(avg(conn))}</b></div></div>`;
 const grp=(title,keyFn)=>{
  const m=new Map();conn.forEach(r=>{[].concat(keyFn(r)).forEach(k=>{k=k||'（未確認）';if(!m.has(k))m.set(k,[]);m.get(k).push(r)})});
  const arr=[...m].sort((a,b)=>b[1].length-a[1].length);const mx=Math.max(1,...arr.map(v=>v[1].length));
  return `<div class="scr"><table class="t"><caption>${title}</caption><thead><tr><th>区分</th><th class="n">通電</th><th class="n">アポ</th><th class="n">アポ率</th><th class="n">平均時間</th></tr></thead><tbody>${
   arr.length?arr.map(([k,a])=>{const x=a.filter(r=>APPO.has(r.outcome)).length;return `<tr><td>${esc(k)}</td><td class="n">${a.length}<span class="bar-in" style="width:${Math.round(a.length/mx*50)}px"></span></td><td class="n">${x}</td><td class="n">${pct(x,a.length)}</td><td class="n">${fmtT(avg(a))}</td></tr>`}).join(''):'<tr><td colspan="5" class="hint">データなし</td></tr>'}</tbody></table></div>`;
 };
 const rbName=id=>(RB.find(r=>r.id===id)||{t:id}).t;
 o+=`<div class="tbls">${grp('担当者別',r=>r.staff)}${grp('媒体別',r=>r.media)}${grp('売却理由別',r=>r.reason)}${grp('売却理由×状況別',r=>r.reason?r.reason+'／'+(r.status||'—'):'')}
  ${grp('表示した切り返し別（通話中に1回以上表示）',r=>(r.rebuttals||[]).length?r.rebuttals.map(rbName):['（切り返しなし）'])}
  ${grp('到達ステップ別（どこまで進んだか）',r=>r.max_step?'①②③④⑤⑥⑦⑧⑨'[r.max_step-1]+' '+STEPS[r.max_step-1].t:'')}
  ${grp('通話結果の内訳',r=>r.outcome)}</div>`;
 o+=`<div class="scr"><table class="t list"><caption>一覧（${n}件・クリックで詳細）</caption><thead><tr><th>日時</th><th>担当</th><th>お客様</th><th>媒体</th><th>理由／状況</th><th>結果</th><th class="n">通話</th><th>次回アクション</th></tr></thead><tbody>${
  rows.map((r,ix)=>{const d=new Date(r.created_at);return `<tr data-hi="${ix}"><td>${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}</td><td>${esc(r.staff)}</td><td>${esc(r.customer)}</td><td>${esc(r.media)}</td><td>${esc([r.reason,r.status].filter(Boolean).join('／'))}</td><td>${esc(r.outcome)}</td><td class="n">${fmtT(r.duration_sec||0)}</td><td>${esc(r.next_action||'')}</td></tr>`}).join('')}</tbody></table></div>`;
 $('#hBody').innerHTML=o;
}
$('#hBody').addEventListener('click',e=>{const tr=e.target.closest('[data-hi]');if(!tr)return;const r=hShown[+tr.dataset.hi];
 const kw=$('#fKw').value.trim();const hl=t=>kw?esc(t).split(esc(kw)).join('<mark>'+esc(kw)+'</mark>'):esc(t);
 $('#dtBody').innerHTML=`<h3>${esc(r.customer||'（名前なし）')}様　${esc(r.outcome)}</h3><pre>${esc(r.memo)}${r.next_action?'\n次回アクション：'+esc(r.next_action):''}</pre>`+
  ((r.transcript||[]).length?`<h3>文字起こし</h3><ul class="trl" style="max-height:40vh">${r.transcript.map(l=>`<li><time>${l.t}</time>${hl(l.x)}</li>`).join('')}</ul>`:'<p class="hint">文字起こしは保存されていません。</p>');
 $('#dtBody').dataset.memo=r.memo;$('#dlgDetail').showModal();});
$('#dtClose').onclick=()=>$('#dlgDetail').close();
root.addEventListener('click',e=>{const b=e.target.closest('[data-copy="detail"]');if(b)copy($('#dtBody').dataset.memo||'')});
['fStaff','fOut','fReason'].forEach(id=>$('#'+id).addEventListener('change',renderHist));
$('#fKw').addEventListener('input',renderHist);
$('#fLoad').onclick=loadHist;
$('#histBtn').onclick=openHist;
$('#histClose').onclick=()=>closeHist();
$('#csvBtn').onclick=()=>{
 const cols=[['日時',r=>new Date(r.created_at).toLocaleString('ja-JP')],['担当','staff'],['お客様','customer'],['媒体','media'],['種別','prop_type'],['住所','address'],['名義','owner'],['状況(物件)','occupancy'],['残債','loan'],['残債額','loan_amount'],['希望金額','wish_price'],['希望時期','wish_time'],['温度感','temperature'],['売却理由','reason'],['問合せ主','asker'],['状況','status'],['結果','outcome'],['次回アクション','next_action'],['アポ日時',r=>r.appt_at?new Date(r.appt_at).toLocaleString('ja-JP'):''],['通話秒','duration_sec'],['到達ステップ','max_step'],['表示した切り返し',r=>(r.rebuttals||[]).map(id=>(RB.find(x=>x.id===id)||{t:id}).t).join(' / ')],['ヒアリング',r=>Object.entries(r.hearing||{}).map(([k,v])=>k+':'+v).join(' / ')],['文字起こし',r=>(r.transcript||[]).map(l=>l.t+' '+l.x).join('\n')]];
 const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const csv='\ufeff'+cols.map(c=>q(c[0])).join(',')+'\r\n'+hShown.map(r=>cols.map(([,k])=>q(typeof k==='function'?k(r):r[k])).join(',')).join('\r\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`架電履歴_${$('#fFrom').value}_${$('#fTo').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
addEventListener('keydown',e=>{if(isOpen()&&e.key==='Escape'&&!$('#hist').hidden&&!root.querySelector('dialog[open]'))closeHist();},true);
updQ();

/* 初期化 */
root.querySelectorAll('[data-f]').forEach(x=>x.value=K.info[x.dataset.f]||'');
renderRbList('');
/* ---------------- 架電ナビ本体ここまで ---------------- */

/* ===== 営業管理システムとの連携 ===== */
const OUT2CQ={'訪問アポ獲得':'apo','来店アポ獲得':'apo','WEB面談アポ獲得':'apo','再架電（日時約束）':'talk','中長期フォロー':'talk','断り・終了':'end','不在・不通':'abs'};
const leadOf=()=>ctx?ctx.lead:null;
function dPlus(n){const d=new Date();d.setDate(d.getDate()+n);return ymd(d)}
function nextDefault(o){
 const a=K.appt,at=a.date?(fmtDate(a.date)+' '+(a.time||'')):'';
 if(o==='訪問アポ獲得')return[a.date||dPlus(2),('訪問査定 '+at).trim()+(a.date&&a.place?' ＠'+a.place:'')];
 if(o==='来店アポ獲得')return[a.date||dPlus(2),('来店アポ '+at).trim()];
 if(o==='WEB面談アポ獲得')return[a.date||dPlus(2),('WEB面談 '+at).trim()];
 if(o==='再架電（日時約束）')return[dPlus(1),'再架電（お約束）'];
 if(o==='中長期フォロー')return[dPlus(30),'中長期フォロー'];
 if(o==='不在・不通')return[dPlus(1),'再架電（前回は不在）'];
 return['',''];
}
function leadReason(){
 const r=K.reason,s=K.status||'';
 if(r==='離婚')return'離婚';
 if(r==='相続')return s.includes('空き家')?'空き家':'相続';
 if(r==='住替え')return s.includes('ローン')?'住替え':'住替え';
 if(r==='資産整理')return s.startsWith('空き')?'空き家':'資金・現金化';
 return'';
}
function summary(o,nn){
 const a=K.appt;
 return '🧭ナビ｜'+o+'｜理由:'+(K.reason||'―')+'｜温度感:'+(K.temp||'―')
  +(a.date&&OUT2CQ[o]==='apo'?'｜アポ:'+fmtDate(a.date)+' '+(a.time||''):'')+(nn?'｜'+nn:'');
}
function renderLeadBar(){
 const el=$('#leadBar'),l=leadOf();
 if(!l){el.innerHTML='<span class="lbk">反響を選ばずに開始</span><span>結果は通話記録にのみ保存されます</span>';return}
 const t=todayStr(),cs=(l.callDates||[]).filter(c=>callType(c)==='call'),lc=cs.length?cs[cs.length-1]:null,oc=lc?callOutcome(lc):'';
 const m=String(l.contact||'').replace(/[０-９]/g,d=>String.fromCharCode(d.charCodeAt(0)-65248)).replace(/[－―ー−]/g,'-').match(/0\d[\d\-]{7,}/);
 const b=['<span class="lbk">📨 売り反響</span>','受信 '+fmtD(l.receivedDate)+(l.receivedDate?'（'+diffDays(t,String(l.receivedDate).slice(0,10))+'日前）':''),
  m?'<a href="tel:'+esc(m[0])+'">☎ '+esc(m[0])+'</a>':'☎ 電話番号なし','フェーズ：'+esc(l.phase||'―'),
  '架電 '+cs.length+'回'+(lc?'（前回 '+fmtDT(lc)+(oc?'・'+esc(CQ_OUT[oc].label):'')+'）':'')];
 if(l.reason)b.push('反響時の理由：'+esc(l.reason));
 {const d=l.detail||{};
  if(d.contactTime&&!/^(指定なし|希望なし|曜日指定なし 時間指定なし)$/.test(d.contactTime))b.push('希望連絡：'+esc(d.contactTime));
  if(d.age)b.push('年齢：'+esc(d.age));
  const pr=[d.area&&'建物'+d.area,d.land&&'土地'+d.land,d.layout,d.built&&(/築/.test(d.built)?d.built:d.built+'築'),d.occ].filter(Boolean).join('・');if(pr)b.push('物件：'+esc(pr));
  if(d.rel)b.push('関係：'+esc(d.rel));
  if(d.loan)b.push('残債：'+esc(d.loan));
  if(d.wishPrice)b.push('希望価格：'+esc(d.wishPrice));
  if(d.visitWish)b.push('訪問希望：'+esc(d.visitWish));
  if(d.request)b.push('要望：'+esc(String(d.request).slice(0,60)));}
 if(l.nextNote)b.push('次回予定：'+esc(l.nextNote));
 if(l.note)b.push('メモ：'+esc(String(l.note).slice(0,60)));
 el.innerHTML=b.map(x=>'<span>'+x+'</span>').join('');
}
function catToType(c){c=String(c||'');if(/マンション/.test(c))return'マンション';if(/用地|土地/.test(c))return'土地';if(/戸建/.test(c))return'戸建';return''}
function show(){hostEl.style.display='block';document.body.style.overflow='hidden';setHH();}
function hide(){micStop();hostEl.style.display='none';document.body.style.overflow='';}
/* lead は売り反響（naviHost.ts の toNaviLead で以前のアプリの形にしたもの）。反響を選ばずに始めるときは null */
function open(lead){
 const l=lead||null;
 const same=(ctx&&l&&ctx.id===l.id)||(!ctx&&!l&&(K.info.name||K.tr.length));
 const dirty=K.tr.length||K.ev.length||K.info.name||K.reason;
 if(!same&&dirty&&!confirm('前の通話の入力内容が残っています。\n記録せずに破棄して、新しい通話を始めますか？\n（キャンセルで前の通話に戻ります）')){show();renderAll();renderLeadBar();return}
 if(!same){
  clearAll();ctx=l?{kind:'leads',id:l.id,lead:l}:null;
  if(l){K.info.name=String(l.name||'').replace(/\s*様$/,'');K.info.media=l.source||'';K.info.addr=l.addr||'';K.type=catToType(l.category);
   const rm={'相続':'相続','離婚':'離婚','住替え':'住替え','買替え':'住替え','転勤':'住替え'};if(rm[l.reason])K.reason=rm[l.reason];
   const dd=l.detail||{};if(dd.area)K.area=dd.area;if(dd.built)K.age=dd.built;if(dd.msName)K.info.ms=dd.msName;if(dd.room)K.info.room=dd.room;if(dd.station)K.info.station=dd.station;}
  root.querySelectorAll('[data-f]').forEach(x=>x.value=K.info[x.dataset.f]||'');
 }
 $('#staffList').innerHTML=staffList().map(s=>'<option>'+esc(s.abbr||s.name)+'</option>').join('');
 histOnly=false;$('#hist').hidden=true;
 show();renderAll();renderLeadBar();
}
function openHistOnly(){histOnly=true;show();openHist();}
function closeHist(){$('#hist').hidden=true;if(histOnly){histOnly=false;hide();}}
$('#closeBtn').onclick=()=>{if(micOn&&!confirm('聞き取り中です。停止して閉じますか？（入力内容は残ります）'))return;hide();};

return { open, hist: openHistOnly };
}
```

### backend/scripts/sql/2026-10-28_realty_call_logs.sql（新規・全文）
```sql
-- =====================================================================
-- 不動産企画係: 架電ナビの通話記録と、ロープレ練習の記録（v2.2.226）
--
-- 以前のアプリ（Supabase）の call_logs・practice_logs と同じ中身。
--   realty_call_logs     … 架電ナビの「記録して次へ」1回 = 1行（文字起こし・ヒアリングの詳細）
--   realty_practice_logs … ロープレ練習1回 = 1行（⚠️ v2.2.226 では以前の記録の取り込みだけ。練習の画面は移行中）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ローカルにも流す
-- ⚠️ 書き込むのは ② planner:navi_save（架電ナビ）と planner:call_logs_import / practice_logs_import（CSV の取り込み。マスターだけ）
-- ⚠️ 読むのは ② planner:call_logs（架電ナビの「履歴・分析」。不動産企画係の全員）
-- ⚠️ 文字起こし・ヒアリングの詳細は反響（brokerage_listings）には入れない（以前のアプリと同じ）
-- ⚠️ 日時は日本時間。⚠️ JSON の列（hearing など）は文字列のまま持つ
-- ⚠️ 2回流しても壊れない（IF NOT EXISTS）
-- =====================================================================
CREATE TABLE IF NOT EXISTS realty_call_logs (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  src_id        VARCHAR(64)  NULL DEFAULT NULL COMMENT '以前のアプリ（Supabase）の id。CSV の取り込みの二重防止。Dashboard で記録した行は NULL',
  created_at    DATETIME     NOT NULL COMMENT '記録した日時（日本時間）',
  created_by    VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '記録した人（Dashboard のログイン名。取り込みは空）',
  lead_id       VARCHAR(100) NULL DEFAULT NULL COMMENT '売り反響の id（brokerage_listings.id）。反響を選ばずに始めた通話は NULL',
  lead_kind     VARCHAR(20)  NULL DEFAULT NULL,
  staff         VARCHAR(64)  NOT NULL DEFAULT '' COMMENT 'ナビの画面の担当者（略称）',
  customer      VARCHAR(100) NOT NULL DEFAULT '',
  media         VARCHAR(100) NOT NULL DEFAULT '',
  address       VARCHAR(255) NOT NULL DEFAULT '',
  ms_name       VARCHAR(255) NOT NULL DEFAULT '',
  room          VARCHAR(50)  NOT NULL DEFAULT '',
  station       VARCHAR(100) NOT NULL DEFAULT '',
  prop_type     VARCHAR(20)  NOT NULL DEFAULT '',
  area          VARCHAR(50)  NOT NULL DEFAULT '',
  built         VARCHAR(50)  NOT NULL DEFAULT '',
  owner         VARCHAR(255) NOT NULL DEFAULT '',
  occupancy     VARCHAR(255) NOT NULL DEFAULT '',
  loan          VARCHAR(20)  NOT NULL DEFAULT '',
  loan_amount   VARCHAR(50)  NOT NULL DEFAULT '',
  wish_price    VARCHAR(100) NOT NULL DEFAULT '',
  wish_time     VARCHAR(100) NOT NULL DEFAULT '',
  temperature   VARCHAR(50)  NOT NULL DEFAULT '',
  reason        VARCHAR(20)  NOT NULL DEFAULT '',
  asker         VARCHAR(50)  NOT NULL DEFAULT '',
  status        VARCHAR(50)  NOT NULL DEFAULT '',
  outcome       VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '通話結果（訪問アポ獲得・不在・不通 など）',
  next_action   TEXT         NULL,
  appt_at       DATETIME     NULL DEFAULT NULL COMMENT 'アポの日時（日本時間）',
  appt_place    VARCHAR(255) NULL DEFAULT NULL,
  started_at    DATETIME     NULL DEFAULT NULL COMMENT '通話開始（日本時間）',
  duration_sec  INT          NOT NULL DEFAULT 0,
  max_step      INT          NOT NULL DEFAULT 0 COMMENT 'どこまで進んだか（1〜9）',
  hearing       MEDIUMTEXT   NULL COMMENT 'ヒアリング（JSON。{項目: メモ}）',
  rebuttals     TEXT         NULL COMMENT '表示した切り返しの id（JSON 配列）',
  events        MEDIUMTEXT   NULL COMMENT '操作の記録（JSON 配列）',
  transcript    MEDIUMTEXT   NULL COMMENT '文字起こし（JSON 配列 [{t, x}]）',
  memo          TEXT         NULL COMMENT '通話メモ',
  app_ver       VARCHAR(100) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_realty_call_logs_src (src_id),
  KEY idx_realty_call_logs_created (created_at),
  KEY idx_realty_call_logs_lead (lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='不動産企画係: 架電ナビの通話記録（v2.2.226）';

CREATE TABLE IF NOT EXISTS realty_practice_logs (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  src_id        VARCHAR(64)  NULL DEFAULT NULL COMMENT '以前のアプリ（Supabase）の id。CSV の取り込みの二重防止',
  created_at    DATETIME     NOT NULL COMMENT '練習した日時（日本時間）',
  staff         VARCHAR(64)  NOT NULL DEFAULT '',
  mode          VARCHAR(10)  NOT NULL DEFAULT '' COMMENT 'full＝通し練習 / kiwa＝引き際トレーニング',
  level         INT          NULL DEFAULT NULL,
  persona       TEXT         NULL COMMENT '売主の設定（JSON）',
  total         INT          NULL DEFAULT NULL,
  max_total     INT          NULL DEFAULT NULL,
  scores        TEXT         NULL COMMENT 'JSON',
  checklist     TEXT         NULL COMMENT 'JSON',
  result        MEDIUMTEXT   NULL COMMENT '採点の結果（JSON）',
  judge         MEDIUMTEXT   NULL COMMENT 'ナビ上の動き（JSON）',
  transcript    MEDIUMTEXT   NULL COMMENT '会話（JSON）',
  duration_sec  INT          NOT NULL DEFAULT 0,
  max_step      INT          NULL DEFAULT NULL,
  rebuttals     TEXT         NULL COMMENT 'JSON',
  appointment   TINYINT(1)   NULL DEFAULT NULL,
  app_ver       VARCHAR(100) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_realty_practice_logs_src (src_id),
  KEY idx_realty_practice_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='不動産企画係: ロープレ練習の記録（v2.2.226）';

-- 確認: 2行出ればよい
SELECT 'realty_call_logs' AS 表, COUNT(*) AS 件数 FROM realty_call_logs
UNION ALL
SELECT 'realty_practice_logs', COUNT(*) FROM realty_practice_logs;
```

### backend/scripts/guide/articles/common/screen-232.md（新規・全文）
```md
---
title: 今日の架電キュー（不動産企画係）
section: 画面の使い方
sort: 232
summary: 今日かける売り反響・買い反響を上から並べ、4つのボタンで架電の結果・フェーズ・次回連絡予定日をまとめて記録する。
---
不動産企画係の左のメニュー「日々の行動」の「今日の架電キュー」で開きます。以前のアプリの「📞 今日の架電キュー」と同じ画面です。上から順に、考えずに1件ずつかけていくための画面です。

> この画面のゴールは「成約」ではなく「相手の今の状況を確認できたか」です。他社で決まった・売却をやめた、と分かることも前進なので、「✅ 終了確定」も接触確認として数えます。

## 並ぶ反響
次のどれかに当てはまる反響が、上から優先の高い順に並びます。
- まだ一度も架電していない（いちばん上）
- 次回連絡予定日が今日か、過ぎている
- 次回連絡予定日が入っておらず、売り反響は14日・買い反響は10日以上ふれていない（日数は[[設定（不動産企画係）]]で変えられます）

次の反響は並びません。
- 今日すでに架電・LINE・メールした反響
- 売り反響のフェーズが「媒介受託」「追客終了」、買い反響のフェーズが「成約」「追客終了」

並ぶ件数は画面右上の「件数」で変えます（チーム全員で共通の設定です）。

> 注意：並び順は開いたときに決まり、記録しても動きません。並べ直すときは「🔄 再抽出」を押します。

## 自分の担当のみ
はじめは自分が担当の反響だけが並びます。チェックを外すとチーム全員の反響が並びます。

## 1件ずつかける
1. 名前の横の電話番号を確かめて電話する
2. 黄色の枠の「一言目」を読む（「📋 コピー」で写せます）
3. 結果に合わせて4つのボタンのどれかを押す

ボタンを押すと、架電の記録・フェーズ・次回連絡予定日がまとめて記録され、次の反響へ進みます。
- 📵 不在：次回連絡予定日は翌日
- 🗣 通電・継続：次回連絡予定日は7日後
- 📅 アポ獲得：次回連絡予定日は2日後（アポ前の確認連絡）
- ✅ 終了確定：フェーズが「追客終了」になり、終了理由が空なら「他決」が入る

フェーズは、売り反響なら「リード受信 → 架電中 → 通電済 → 訪問査定予定」、買い反響なら「反響受信 → 追客中 → 通電済 → 内見予約」の順に進みます（先に進んでいる反響は戻しません）。

押し間違えたときは、すぐに「↩ 直前の記録を取消」を押すと元に戻ります。

## 目印（要件タグ）
反響の名前の横に、かける理由の目印が出ます。一言目は、いちばん左の目印のものが出ます。
- 初回架電：まだ一度も架電していない
- 不通つづき：不在が2回以上続いている
- 査定書フォロー：フェーズが「査定書提出」
- 新着物件あり：直近14日に媒介を受けたアクティブの物件がある（買い反響）
- 期日超過：次回連絡予定日を過ぎている
- 長期未接触：30日以上ふれていない
- 状況うかがい：上のどれでもない

一言目の文面は[[設定（不動産企画係）]]で直せます。

## 上のメーター
- 今日の架電・今週の架電：📞架電の数。目標は[[週次行動計画（不動産企画係）]]の架電目標から出します（今日の目標は週の目標を設定の数で割ったもの）
- 接触確認率（今月）：結果を記録した架電のうち、相手の状況を確認できた割合（通電・アポ・終了確定）
- 残りのキュー：まだ記録していない数

## 架電ナビで架電する
売り反響は「🧭 ナビで架電」から[[架電ナビ（一括査定）（不動産企画係）]]を開いてかけることもできます。ナビで記録すると、キューにも「記録済」と出ます。

「開く」を押すと、その反響の編集画面が開きます。
```

### backend/scripts/guide/articles/common/screen-233.md（新規・全文）
```md
---
title: 架電ナビ（一括査定）（不動産企画係）
section: 画面の使い方
sort: 233
summary: 一括査定の売り反響への初回架電を、トークの①〜⑨に沿って伴走する。切り返し・自動聞き取り・通話の記録と履歴・分析。
---
不動産企画係の左のメニュー「日々の行動」の「架電ナビ（一括査定）」で開きます。以前のアプリの「🧭 架電ナビ」と同じ画面です。一括査定の売り反響への初回架電を、トークマニュアルの①〜⑨に沿って伴走します。

## 始め方
- 一覧で売り反響の「🧭 ナビで架電」を押す（並びは、未架電 → 次回連絡予定日が今日以前 → その他。受信日の新しい順）
- [[今日の架電キュー（不動産企画係）]]の「🧭 ナビで架電」、売り反響（一括査定）の画面の行の「🧭」・編集画面の「🧭 ナビで架電」からも開けます
- 反響を選ばずに始めるときは「反響を選ばずに開始」

反響を選んで開くと、お客様名・媒体・住所・区分と、反響の詳細（希望連絡時間・年齢・広さなど）が上に出ます。

> 注意：ナビは画面いっぱいに開きます。「✕ 閉じる」で閉じても入力した内容は残り、もう一度開くと続きから使えます。別の反響を開くときは、残っている内容を消してよいか聞かれます。

## 使い方
- 左の①〜⑨を上から進めます（← → キー、1〜9 キーでも移れます）
- ⑤で売却理由、⑥で問合せ主と状況を選ぶと、その組み合わせの追加ヒアリング・フックトークが出ます
- 右の「切り返し」で、お客様の言葉を入れると合う切り返しが出ます（/ キーで検索）
- 「通話開始」で通話時間を計ります
- 「通話メモ」に、ここまでの内容がまとまります（コピーして使えます）

## 自動聞き取り
「自動聞き取り」（M キー）を押すと、パソコンのマイクで会話を文字にします。お客様の言葉から、切り返し・売却理由・残債の候補が出ます。

> 要確認：声はブラウザの音声認識（Google か Microsoft）に送られて文字になります。通話の初めに「内容を記録させていただきます」とお客様に伝えてください。

> 注意：パソコンの Google Chrome か Microsoft Edge で使ってください。スマホはスピーカー通話にしてパソコンの近くに置きます。

## 記録して次へ
1. 「記録して次へ」を押す
2. 通話結果を選ぶ（訪問アポ獲得・来店アポ獲得・WEB面談アポ獲得・再架電（日時約束）・中長期フォロー・断り・終了・不在・不通）
3. 次回連絡予定日・次回アクションを確かめる（結果に合わせて自動で入ります。「断り・終了」は終了理由を選びます）
4. 「記録して次へ」を押す

売り反響に架電の記録・フェーズ・次回連絡予定日が入り、売却理由・希望時期が空なら埋まります。通話の内容（ヒアリング・文字起こし）は売り反響には入れず、通話記録に残します。

> 注意：通信が切れて送れなかったときは、その端末に「未送信」として残ります。ナビの上の「未送信」を押すと送り直します。

## 通話履歴・分析
「履歴・分析」（一覧では「📊 通話履歴・分析」）で、期間の通話記録を見られます。担当者別・媒体別・売却理由別のアポ率や、表示した切り返し、どこまで進んだかを集計し、行を押すと文字起こしが見られます。CSV にも書き出せます。

> 注意：通話記録は不動産企画係の全員が見られます。

## ロープレ練習
以前のアプリの「🎧 練習」（AI が売主役のロープレ）と「練習の成績」は、いまは移行中です。練習は以前のアプリを使ってください。
```

### backend/scripts/sql/2026-10-28_update_log_2.2.226.sql（新規）
更新履歴の1行と、記事5本の SQL（build-guide-sql.cjs の出力）。記事の本文は上と下の .md と同じなので、ここでは更新履歴の部分だけ載せる。
```sql
-- =====================================================================
-- update_log に v2.2.226 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.226', '2026-10-28', '不動産企画係に「今日の架電キュー」と「架電ナビ（一括査定）」を以前のアプリから移した。架電キューは4つのボタン（不在・通電・アポ・終了確定）で架電記録・フェーズ・次回連絡予定日をまとめて記録する。架電ナビはトークの台本・切り返し・自動聞き取り・通話記録（履歴・分析）を以前のアプリと同じに使える（ロープレ練習は移行中）。週次行動計画に「接触の質」、設定に「架電キュー」と以前の通話記録の取り込みを足した。');
```

### 直したファイル（差分）

#### backend-express/src/features/realty/index.ts
```diff
diff --git a/backend-express/src/features/realty/index.ts b/backend-express/src/features/realty/index.ts
index c147545a..469d2b77 100644
--- a/backend-express/src/features/realty/index.ts
+++ b/backend-express/src/features/realty/index.ts
@@ -41,7 +41,7 @@ const ok = (body: Record<string, unknown>): Result => ({ httpStatus: 200, body }
 const fail = (httpStatus: number, message: string): Result => ({ httpStatus, body: { status: 'error', message } });
 
 /** 名前の突き合わせ用。⚠️ 空白（全角を含む）を落とす（staff と staff_list で表記が揺れる） */
-const norm = (value: unknown): string => String(value ?? '').replace(/[\s　]/g, '');
+export const norm = (value: unknown): string => String(value ?? '').replace(/[\s　]/g, '');
 
 /** SQL の中で `to` の空白を落とす式（norm と同じ） */
 const TO_NORM = "REPLACE(REPLACE(`to`, ' ', ''), '　', '')";
```

#### backend-express/src/features/realty/state.ts
```diff
diff --git a/backend-express/src/features/realty/state.ts b/backend-express/src/features/realty/state.ts
index ce54a068..7440bd38 100644
--- a/backend-express/src/features/realty/state.ts
+++ b/backend-express/src/features/realty/state.ts
@@ -155,6 +155,7 @@ const costMap = (v: unknown, label: string): Record<string, number> => {
 };
 
 const COMPANY_FIELDS = ['name', 'rep', 'dept', 'addr', 'tel', 'fax', 'license', 'assoc', 'agent', 'agentNo'] as const;
+const CALLQ_SCRIPT_KEYS = ['first', 'firstBuy', 'redial', 'report', 'newprop', 'overdue', 'long', 'ask'] as const;
 
 /**
  * 画面から直せる設定の項目と、その確かめ方。
@@ -201,6 +202,30 @@ const SETTINGS_FIELDS: Record<string, (v: unknown) => unknown> = {
     for (const f of COMPANY_FIELDS) out[f] = text(v[f], 200, '宅建業者情報');
     return out;
   },
+  // ⚠️ v2.2.226: 今日の架電キューの抽出ルール（以前のアプリの CQ_DEFAULTS と V16.setSize / setConf の範囲）
+  //   ⚠️ 以前のアプリは件数だけ 1〜50 に丸め、ほかは 1 以上しか確かめない（実データに「週目標÷10」がある）。上限は桁あふれよけ
+  callq: (v) => {
+    if (!isObject(v)) throw new InvalidInput('架電キューの設定の形が正しくありません');
+    const int = (raw: unknown, min: number, max: number, label: string): number => {
+      const n = Math.round(Number(raw));
+      if (!Number.isFinite(n) || n < min || n > max) throw new InvalidInput(`${label}は${min}〜${max}で入力してください`);
+      return n;
+    };
+    return {
+      size: int(v.size, 1, 50, '1日に並べる件数'),
+      staleSell: int(v.staleSell, 1, 9999, '売り反響の日数'),
+      staleBuy: int(v.staleBuy, 1, 9999, '買い反響の日数'),
+      dailyDivisor: int(v.dailyDivisor, 1, 9999, '1日の目標の割る数'),
+      includeBuy: v.includeBuy !== false,
+    };
+  },
+  // ⚠️ v2.2.226: 今日の架電キューの一言目（要件タグごと。以前のアプリの CQ_SCRIPTS のキー）
+  callqScripts: (v) => {
+    if (!isObject(v)) throw new InvalidInput('一言目の形が正しくありません');
+    const out: Record<string, string> = {};
+    for (const k of CALLQ_SCRIPT_KEYS) out[k] = text(v[k], 2000, '一言目');
+    return out;
+  },
 };
 
 /** body.patch = { 項目: 新しい値 }。項目ごとに確かめてから差し込む */
```

#### backend-express/src/gateway/registry.ts
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 1b3b238d..e978c2d5 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -174,6 +174,7 @@ import {
 import type { Result as RealtyResult } from '../features/realty';
 import { runPlannerCompliance, runPlannerSettings, runPlannerState, runPlannerWeekly } from '../features/realty/state';
 import { runImportCheck, runImportFinish, runImportRecords } from '../features/realty/importer';
+import { runCallLogs, runCallLogsImport, runCallMark, runCallUndo, runNaviSave, runPracticeLogsImport } from '../features/realty/calls';
 import type { AuthenticatedStaff } from '../types/staff';
 import type { GatewayContext, GatewayEntry, GatewayKey } from './types';
 import { gatewayKey } from './types';
@@ -1232,6 +1233,16 @@ register({ request: 'planner', roll: 'import_check', summary: '不動産企画
 register({ request: 'planner', roll: 'import_records', summary: '【書き込み】不動産企画係: 以前のアプリのバックアップの行を取り込む（300件まで）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'master', handler: realtyMaster(runImportRecords) });
 register({ request: 'planner', roll: 'import_finish', summary: '【書き込み】不動産企画係: 取り込みの仕上げ（消えた行の非表示・設定の置き換え）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'master', handler: realtyMaster(runImportFinish) });
 
+// ⚠️ v2.2.226 新規（② だけ）。今日の架電キュー・架電ナビ・通話記録。features/realty/calls.ts
+//   ⚠️ 通話記録（文字起こし）は不動産企画係の全員が読める（2026-10-28 の利用者の判断。以前のアプリと同じ）
+//   ⚠️ CSV の取り込み（以前のアプリの call_logs・practice_logs）はマスターだけ
+register({ request: 'planner', roll: 'call_mark', summary: '【書き込み】不動産企画係: 架電キューの1タップ記録（架電記録・フェーズ・次回連絡予定日）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runCallMark(s, body)) });
+register({ request: 'planner', roll: 'call_undo', summary: '【書き込み】不動産企画係: 架電キューの直前の記録を取り消す', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (_s, body) => runCallUndo(body)) });
+register({ request: 'planner', roll: 'navi_save', summary: '【書き込み】不動産企画係: 架電ナビの記録（反響の更新と通話記録）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runNaviSave(s, body)) });
+register({ request: 'planner', roll: 'call_logs', summary: '不動産企画係: 架電ナビの通話記録（期間を指定）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (_s, body) => runCallLogs(body)) });
+register({ request: 'planner', roll: 'call_logs_import', summary: '【書き込み】不動産企画係: 以前のアプリの通話記録（CSV）を取り込む（300件まで）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'master', handler: realtyMaster(runCallLogsImport) });
+register({ request: 'planner', roll: 'practice_logs_import', summary: '【書き込み】不動産企画係: 以前のアプリの練習記録（CSV）を取り込む（300件まで）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'master', handler: realtyMaster(runPracticeLogsImport) });
+
 // ---------------------------------------------------------------------------
 // Claudeによる分析（v2.2.217。Dashboard からの自由分析）— ② のみ（① に PHP 版は無い）
 //
```

#### backend/src/core/express_proxy.php
```diff
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 5ea82f32..9024b889 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -159,6 +159,13 @@ function expressProxyRequests(): array
         'planner:import_finish',
         // ⚠️ v2.2.225。以前のアプリから移す画面の読み出し（② だけ）。expressProxyExclusive() にも入れてある
         'planner:records',
+        // ⚠️ v2.2.226。今日の架電キュー・架電ナビ・通話記録（② だけ）。expressProxyExclusive() にも入れてある
+        'planner:call_mark',
+        'planner:call_undo',
+        'planner:navi_save',
+        'planner:call_logs',
+        'planner:call_logs_import',
+        'planner:practice_logs_import',
 
         // 2026-09-03 移植。旧API（dashboard/api/ の demand 形式）から
         // request 形式へ移したもの。
@@ -818,6 +825,13 @@ function expressProxyExclusive(): array
         'planner:import_finish',
         // v2.2.225 新規。以前のアプリから移す画面の読み出し。⚠️ ① に PHP ハンドラは無い（② だけ）
         'planner:records',
+        // v2.2.226 新規。今日の架電キュー・架電ナビ・通話記録。⚠️ ① に PHP ハンドラは無い（② だけ）
+        'planner:call_mark',
+        'planner:call_undo',
+        'planner:navi_save',
+        'planner:call_logs',
+        'planner:call_logs_import',
+        'planner:practice_logs_import',
 
         // -----------------------------------------------------------------
         // v2.2.215 新規。オーナーズハウス募集（owners_house_application）の一覧と過去メールの取り込み。
```

#### frontend/src/App.tsx
```diff
diff --git a/frontend/src/App.tsx b/frontend/src/App.tsx
index b77e1ded..4800a07c 100644
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -48,6 +48,8 @@ import MonthlySales from "./components/realty/sales/MonthlySales";
 import BaikaiMonthly from "./components/realty/bmonthly/BaikaiMonthly";
 import LostAnalysis from "./components/realty/lost/LostAnalysis";
 import RealtyPending from "./components/realty/RealtyPending";
+import CallQueue from "./components/realty/callq/CallQueue";
+import CallNavi from "./components/realty/navi/CallNavi";
 import Guide from "./components/guide/Guide";
 
 const GOOGLE_MAPS_LIBRARIES: ("marker")[] = ['marker'];
@@ -199,6 +201,9 @@ function AppInner() {
             <Route path="/realtySales" element={<RealtyRoute><MonthlySales /></RealtyRoute>} />
             <Route path="/realtyBaikaiMonthly" element={<RealtyRoute><BaikaiMonthly /></RealtyRoute>} />
             <Route path="/realtyLost" element={<RealtyRoute><LostAnalysis /></RealtyRoute>} />
+            {/* ⚠️ v2.2.226: 今日の架電キュー・架電ナビ（一括査定） */}
+            <Route path="/realtyCallQueue" element={<RealtyRoute><CallQueue /></RealtyRoute>} />
+            <Route path="/realtyCallNavi" element={<RealtyRoute><CallNavi /></RealtyRoute>} />
             <Route path="/realtyPending" element={<RealtyRoute><RealtyPending /></RealtyRoute>} />
             {/* ⚠️ v2.2.221〜222 の2段の URL。⚠️ 画面の中から移ってきたときだけ効く（再読み込みは上の理由で届かない） */}
             <Route path="/realty/summary" element={<Navigate to="/summary" replace />} />
```

#### frontend/src/components/realty/RealtyMenu.tsx
```diff
diff --git a/frontend/src/components/realty/RealtyMenu.tsx b/frontend/src/components/realty/RealtyMenu.tsx
index c57ede1f..9ed03106 100644
--- a/frontend/src/components/realty/RealtyMenu.tsx
+++ b/frontend/src/components/realty/RealtyMenu.tsx
@@ -16,8 +16,8 @@ type Group = { label: string; items: RealtyMenuItem[] };
 export const REALTY_MENU: Group[] = [
     {
         label: '日々の行動', items: [
-            { id: 'callq', path: '/realtyPending?view=callq', icon: 'fa-phone', label: '今日の架電キュー', pending: true },
-            { id: 'navi', path: '/realtyPending?view=navi', icon: 'fa-compass', label: '架電ナビ（一括査定）', pending: true },
+            { id: 'callq', path: '/realtyCallQueue', icon: 'fa-phone', label: '今日の架電キュー' },
+            { id: 'navi', path: '/realtyCallNavi', icon: 'fa-compass', label: '架電ナビ（一括査定）' },
         ],
     },
     {
```

#### frontend/src/components/realty/common/LeadEdit.tsx
```diff
diff --git a/frontend/src/components/realty/common/LeadEdit.tsx b/frontend/src/components/realty/common/LeadEdit.tsx
index b8cca7da..a949d40f 100644
--- a/frontend/src/components/realty/common/LeadEdit.tsx
+++ b/frontend/src/components/realty/common/LeadEdit.tsx
@@ -38,6 +38,8 @@ export type LeadEditProps = {
     setCustomerInfo: React.Dispatch<React.SetStateAction<any>>;
     leadCategory: LeadCategory;
     staffList: string[];
+    /** 架電ナビで架電する（v2.2.226。売り反響の画面だけが渡す） */
+    onNavi?: () => void;
 };
 
 // 💡 追加: DocumentViewerへ渡すデータの型定義
@@ -126,7 +128,8 @@ const LeadEdit: React.FC<LeadEditProps> = ({
     customerInfo,
     setCustomerInfo,
     leadCategory,
-    staffList
+    staffList,
+    onNavi
 }) => {
     const { userName } = useContext(AuthContext);
 
@@ -663,6 +666,10 @@ const LeadEdit: React.FC<LeadEditProps> = ({
                         </button>
                     </div>
                     <div className="d-flex gap-2">
+                        {/* ⚠️ v2.2.226: 売り反響の画面から開いたときだけ（以前のアプリの編集画面の「🧭 ナビで架電」）。⚠️ 入力中の内容は保存せずに閉じる */}
+                        {onNavi && customerInfo?.id && (
+                            <button className="btn btn-outline-primary btn-sm px-3 fw-bold" style={{ fontSize: '11px' }} onClick={onNavi}>🧭 ナビで架電</button>
+                        )}
                         <button className="btn btn-outline-secondary btn-sm px-3 fw-bold" style={{ fontSize: '11px' }} onClick={onClose}>キャンセル</button>
                         <button className="btn btn-primary btn-sm px-4 fw-bold shadow-sm" style={{ fontSize: '11px' }} onClick={handleSaveClick}>保存する</button>
                     </div>
```

#### frontend/src/components/realty/common/realtyState.ts
```diff
diff --git a/frontend/src/components/realty/common/realtyState.ts b/frontend/src/components/realty/common/realtyState.ts
index 58a5b3de..bc6b0f4a 100644
--- a/frontend/src/components/realty/common/realtyState.ts
+++ b/frontend/src/components/realty/common/realtyState.ts
@@ -26,6 +26,10 @@ export type RealtySettings = {
     portalCosts?: Record<string, number>;
     templates?: Template[];
     company?: Partial<Company>;
+    /** 今日の架電キューの抽出ルール（v2.2.226。中身は callq/callqLogic.ts の CallqConf） */
+    callq?: Record<string, unknown>;
+    /** 今日の架電キューの一言目（v2.2.226。要件タグ → 文面） */
+    callqScripts?: Record<string, string>;
 };
 
 /** 週次行動計画の1行（担当者 × 週）。g = 目標・a = 実績。c 架電・t 追客・n 内見・s 商談 */
```

#### frontend/src/components/realty/sell/LeadSell.tsx
```diff
diff --git a/frontend/src/components/realty/sell/LeadSell.tsx b/frontend/src/components/realty/sell/LeadSell.tsx
index 2717268f..7c1d99bd 100644
--- a/frontend/src/components/realty/sell/LeadSell.tsx
+++ b/frontend/src/components/realty/sell/LeadSell.tsx
@@ -11,6 +11,8 @@ import { removeSpaces, safeParse, LEAD_END_REASONS, saveBrokerageRecord, newReco
 import LeadEdit from '../common/LeadEdit';
 import LeadCall, { CallLog } from '../common/LeadCall';
 import DocumentViewer from '../documents/DocumentViewer';
+import { openNavi } from '../navi/naviHost';
+import { sameName } from '../callq/callqLogic';
 
 export type SellLead = {
   internal_id: string;
@@ -433,6 +435,31 @@ const LeadSell = () => {
     setIsCallModalOpen(true);
   };
 
+  /**
+   * ⚠️ v2.2.226: 架電ナビ（以前のアプリの「🧭」）。記録は ② が反響を書き換えるので、返ってきた行で置き換える。
+   * 「自分」は設定の担当者名（ログイン名と空白の入り方が違うことがある）
+   */
+  const openNaviFor = (lead: SellLead) => {
+    const me = (settings.staff ?? []).find(s => s.name && sameName(s.name, userName || ''))?.name ?? (userName || '');
+    openNavi({
+      lead: lead as unknown as Row, settings: settings as Record<string, unknown>, me,
+      onSaved: row => {
+        if (!row) return;
+        setLeads(prev => prev.map(l => (l.id === row.id ? {
+          ...l,
+          callDates: row.callDates as string | null,
+          phase: row.phase as string,
+          nextDate: dateFormate(row.nextDate as string | null),
+          nextNote: (row.nextNote as string) || null,
+          connectDate: dateFormate(row.connectDate as string | null),
+          endReason: row.endReason as string,
+          reason: row.reason as string,
+          timing: row.timing as string,
+        } : l)));
+      },
+    });
+  };
+
   const handleSaveCallLog = (leadId: string, updatedCallDatesJson: string, nextDate?: string, nextNote?: string) => {
     // 3項目を1リクエストにまとめる（別々に送ると途中で失敗したとき中途半端に保存される）
     void handleApiPatch(leadId, {
@@ -685,6 +712,13 @@ const LeadSell = () => {
                           >
                             📞 架電
                           </button>
+                          <button
+                            style={{ fontSize: '9px', padding: '0 6px', height: '20px', backgroundColor: '#fff', border: '1px solid #ced4da', borderRadius: '10px', cursor: 'pointer' }}
+                            onClick={() => openNaviFor(lead)}
+                            title="架電ナビ（トーク伴走・自動聞き取り）で架電"
+                          >
+                            🧭
+                          </button>
                         </div>
                       </td>
                       <td style={getTdStyle(isUnassigned)}>
@@ -773,6 +807,11 @@ const LeadSell = () => {
         setCustomerInfo={setCustomerInfo}
         leadCategory="sell"
         staffList={staffList}
+        onNavi={() => {
+          const lead = leads.find(l => l.id === customerInfo.id);
+          setIsEditModalOpen(false);
+          if (lead) openNaviFor(lead);
+        }}
       />
 
       <DocumentViewer
```

#### frontend/src/components/realty/settings/RealtySettings.tsx
```diff
diff --git a/frontend/src/components/realty/settings/RealtySettings.tsx b/frontend/src/components/realty/settings/RealtySettings.tsx
index b645c61b..d4979119 100644
--- a/frontend/src/components/realty/settings/RealtySettings.tsx
+++ b/frontend/src/components/realty/settings/RealtySettings.tsx
@@ -1,6 +1,9 @@
 import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
 import AuthContext from '../../../context/AuthContext';
 import RealtyImport from './RealtyImport';
+import RealtyLogImport from './RealtyLogImport';
+import { CQ_SCRIPTS, TAGS, callqConf, callqScripts } from '../callq/callqLogic';
+import type { CallqConf } from '../callq/callqLogic';
 import {
     REALTY_CSS, loadRealtyState, newId, saveRealtySettings,
 } from '../common/realtyState';
@@ -13,7 +16,8 @@ import type { StaffSetting } from '../summary/kpi';
  * ⚠️ 移植元は本番アプリの「⚙ 設定・データ管理」（renderSettings）。ここを直すと、チームサマリーなど全画面に反映される。
  * ⚠️ 保存は**入力欄を離れたとき**に、その項目だけ（② の planner:settings）。
  * ⚠️ 本番アプリの次のカードはまだ移していない（それを使う画面と一緒に移す）:
- *   買取再販の粗利の計算方式・経費科目マスタ／架電キュー／売主への販売報告／データ管理（バックアップ・CSV）
+ *   買取再販の粗利の計算方式・経費科目マスタ／売主への販売報告／データ管理（バックアップ・CSV）
+ * ⚠️ v2.2.226: 「架電キュー（抽出ルールと一言目）」（V16.settingsCard）と、以前のアプリの通話記録・練習記録の取り込み（マスター）を足した
  */
 
 const MAX_STAFF = 10;
@@ -102,6 +106,10 @@ const RealtySettings: React.FC = () => {
     }, [edit, persist]);
 
     const staff = settings.staff ?? [];
+    // ⚠️ v2.2.226: 架電キュー。未設定の項目は以前のアプリの既定値（CQ_DEFAULTS / CQ_SCRIPTS）
+    const callq = callqConf(settings.callq);
+    const scripts = callqScripts(settings.callqScripts);
+    const setCallq = <K extends keyof CallqConf>(key: K, value: CallqConf[K]) => edit('callq', { ...callq, [key]: value });
     const sources = settings.sources ?? [];
     const buyPortals = settings.buyPortals ?? [];
     const templates = settings.templates ?? [];
@@ -301,11 +309,70 @@ const RealtySettings: React.FC = () => {
                 </div>
             </div>
 
+            <div className="rlt-card">
+                <div className="rlt-card-head">
+                    <h3>📞 架電キュー（抽出ルールと一言目）</h3>
+                    <span className="rlt-note">チーム全員で共有されます。差込語：{'{{name}}／{{staff}}／{{company}}／{{addr}}／{{property}}／{{next}}'}</span>
+                </div>
+                <div className="rlt-body rlt-set-grid">
+                    {/* ⚠️ 以前のアプリと同じ: 件数だけ 1〜50、ほかは 1 以上（9999 は桁あふれよけ。② も同じ範囲で確かめる） */}
+                    {([
+                        ['size', '1日に並べる件数', 1, 50],
+                        ['staleSell', '売り反響：この日数ふれていなければ対象', 1, 9999],
+                        ['staleBuy', '買い反響：この日数ふれていなければ対象', 1, 9999],
+                        ['dailyDivisor', '1日の目標＝週目標÷', 1, 9999],
+                    ] as const).map(([key, label, min, max]) => (
+                        <div key={key}>
+                            <label>{label}</label>
+                            <input type="number" min={min} max={max} className="rlt-input" style={{ width: 100, textAlign: 'right' }}
+                                value={callq[key]}
+                                onChange={e => setCallq(key, Math.max(min, Math.min(max, Math.round(Number(e.target.value) || min))))}
+                                onBlur={() => persist('callq')} />
+                        </div>
+                    ))}
+                    <div className="wide">
+                        <label>買い反響もキューに含める</label>
+                        <select className="rlt-input" value={callq.includeBuy ? '1' : '0'}
+                            onChange={e => editAndSave('callq', { ...callq, includeBuy: e.target.value === '1' })}>
+                            <option value="1">含める</option>
+                            <option value="0">売り反響のみ</option>
+                        </select>
+                    </div>
+                </div>
+                <div className="rlt-tblwrap">
+                    <table className="rlt-tbl">
+                        <thead><tr><th style={{ width: 130 }}>要件タグ</th><th>一言目のスクリプト</th></tr></thead>
+                        <tbody>
+                            {TAGS.map(t => (
+                                <tr key={t.k}>
+                                    <td style={{ whiteSpace: 'nowrap' }}>
+                                        {t.lbl}
+                                        <div className="rlt-note">{t.k === 'first' ? '売り・初回' : t.k === 'firstBuy' ? '買い・初回' : ''}</div>
+                                    </td>
+                                    <td>
+                                        <textarea className="rlt-input" rows={3} style={{ width: '100%' }} value={scripts[t.k]}
+                                            onChange={e => edit('callqScripts', { ...scripts, [t.k]: e.target.value })}
+                                            onBlur={() => persist('callqScripts')} />
+                                    </td>
+                                </tr>
+                            ))}
+                        </tbody>
+                    </table>
+                </div>
+                <div className="rlt-body" style={{ paddingTop: 10 }}>
+                    <button className="rlt-btn sec" onClick={() => {
+                        if (window.confirm('一言目のスクリプトを初期値に戻しますか？')) editAndSave('callqScripts', CQ_SCRIPTS());
+                    }}>一言目を初期値に戻す</button>
+                </div>
+            </div>
+
             {/* ⚠️ v2.2.224: 以前のアプリのバックアップの取り込み。マスターだけ（② も auth: 'master' で確かめる） */}
             {authority === 'Master' && <RealtyImport onFinished={reload} />}
+            {/* ⚠️ v2.2.226: 以前のアプリの通話記録・練習記録（Supabase の CSV）。マスターだけ */}
+            {authority === 'Master' && <RealtyLogImport />}
 
             <p className="rlt-sub">
-                以前のアプリの「買取再販の粗利の計算方式・経費科目」「架電キュー」「売主への販売報告」「データ管理」は、それを使う画面と一緒に、のちの版で移します。
+                以前のアプリの「買取再販の粗利の計算方式・経費科目」「売主への販売報告」「データ管理」は、それを使う画面と一緒に、のちの版で移します。
             </p>
         </div>
     );
```

#### frontend/src/components/realty/weekly/WeeklyPlan.tsx
```diff
diff --git a/frontend/src/components/realty/weekly/WeeklyPlan.tsx b/frontend/src/components/realty/weekly/WeeklyPlan.tsx
index e5bcc54b..6a29b5c0 100644
--- a/frontend/src/components/realty/weekly/WeeklyPlan.tsx
+++ b/frontend/src/components/realty/weekly/WeeklyPlan.tsx
@@ -5,6 +5,7 @@ import {
 } from '../common/realtyState';
 import type { RealtyState, WeeklyCell, WeeklyKey, WeeklyRow } from '../common/realtyState';
 import { fiscalMonths, monthLabel, pct, prevMonth } from '../summary/kpi';
+import ContactQualityPanel from '../callq/ContactQualityPanel';
 
 /**
  * 週次行動計画・実績（不動産企画係。v2.2.223）。
@@ -13,7 +14,7 @@ import { fiscalMonths, monthLabel, pct, prevMonth } from '../summary/kpi';
  *   ・黄色＝目標（手入力）／白＝実績（手入力）。⚠️ 架電実績だけは売り反響の📞架電の記録から数える（手入力不可）
  *   ・週：1〜7日／8〜14日／15〜21日／22日〜月末
  *   ・前月より前の月は、翌月5日を過ぎると目標を直せない（マスター・マネージャーは直せる）。実績はいつでも直せる
- * ⚠️ 本番アプリ V16 の「接触の質」の表は、架電の結果（不在・通電・アポ・終了）を記録する「今日の架電キュー」と一緒に移す。
+ * ⚠️ v2.2.226: 本番アプリ V16 の「接触の質」の表を、以前のアプリと同じく表の上に出す（callq/ContactQualityPanel.tsx）。
  */
 
 const STYLE = `
@@ -169,6 +170,8 @@ const WeeklyPlan: React.FC = () => {
                 <div className="rlt-alert">担当者が登録されていません。設定画面で担当者を追加してください。</div>
             ) : (
                 <>
+                    <ContactQualityPanel month={month} names={names} />
+
                     <div className="rlt-card rlt-tblwrap">
                         <table className="rlt-tbl rlt-wk">
                             <thead><tr>
```

#### frontend/src/utils/version.ts
```diff
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 44500bf2..bb0edd87 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.225';
+export const newVersion = '2.2.226';
```

#### backend/scripts/guide/articles/common/screen-230.md
```diff
diff --git a/backend/scripts/guide/articles/common/screen-230.md b/backend/scripts/guide/articles/common/screen-230.md
index d09cd00b..7516f962 100644
--- a/backend/scripts/guide/articles/common/screen-230.md
+++ b/backend/scripts/guide/articles/common/screen-230.md
@@ -7,7 +7,7 @@ summary: 不動産企画係の画面に入れる人と、入り方。
 不動産企画係の画面は、Dashboard の中の不動産企画係専用のアプリです。以前のアプリと同じメニューを、同じ見出し・同じ順番で左に出しています。
 
 ## メニュー
-- **日々の行動**：今日の架電キュー・架電ナビ（一括査定）
+- **日々の行動**：[[今日の架電キュー（不動産企画係）]]・[[架電ナビ（一括査定）（不動産企画係）]]
 - **集計・分析**：チームサマリー（以前のアプリの「ダッシュボード」）・月次売上管理・月次媒介管理・失注・他決の分析
 - **入力・台帳**：売り反響（一括査定）・買い反響（ポータル）・商談案件管理・買取再販案件・媒介獲得台帳・売主への販売報告・媒介更新履歴・週次行動計画
 - **点検・管理**：データ品質チェック・コンプライアンス・設定・データ管理
```

#### backend/scripts/guide/articles/common/screen-250.md
```diff
diff --git a/backend/scripts/guide/articles/common/screen-250.md b/backend/scripts/guide/articles/common/screen-250.md
index 6ed293de..2c0eb18f 100644
--- a/backend/scripts/guide/articles/common/screen-250.md
+++ b/backend/scripts/guide/articles/common/screen-250.md
@@ -9,6 +9,13 @@ summary: 担当者ごとに、週の架電・追客・内見・商談の目標
 ## 月を選ぶ
 左上で月を選びます。選べるのは今期の12か月です（期首月は[[設定（不動産企画係）]]の値）。
 
+## 接触の質
+表の上に、その月の担当者ごとの「📞 接触の質」が出ます。主な指標は成約ではなく**接触確認率**（結果を記録した架電のうち、相手の状況を確認できた割合）です。
+- 通電・アポ・終了確定を「確認できた」と数えます（他決と分かったことも前進です）
+- 「結果未記録」は、📞架電ボタンだけで記録して結果が入っていない架電です。率の分母には入れません
+- 結果は[[今日の架電キュー（不動産企画係）]]の4つのボタンと、[[架電ナビ（一括査定）（不動産企画係）]]の記録で入ります
+- 売り反響・買い反響の両方を、架電した人ごとに数えます
+
 ## 入れ方
 - **黄色のマス＝目標**、**白のマス＝実績**です。半角の整数（0〜99999）で入れます
 - マスを離れるか Enter を押すと保存します
```

#### backend/scripts/guide/articles/common/screen-270.md
```diff
diff --git a/backend/scripts/guide/articles/common/screen-270.md b/backend/scripts/guide/articles/common/screen-270.md
index 80155c58..3c7030f8 100644
--- a/backend/scripts/guide/articles/common/screen-270.md
+++ b/backend/scripts/guide/articles/common/screen-270.md
@@ -2,7 +2,7 @@
 title: 設定（不動産企画係）
 section: 画面の使い方
 sort: 270
-summary: 不動産企画係の期首年月・担当者と目標・反響元・反響単価・テンプレート・宅建業者情報を直す。以前のアプリのデータの取り込み。
+summary: 不動産企画係の期首年月・担当者と目標・反響元・反響単価・テンプレート・宅建業者情報・架電キューを直す。以前のアプリのデータと通話記録の取り込み。
 ---
 不動産企画係の左のメニュー「設定」で開きます。ここで直した値は、[[チームサマリー（不動産企画係）]]や[[週次行動計画（不動産企画係）]]など、不動産企画係のすべての画面に反映されます。
 
@@ -36,6 +36,15 @@ summary: 不動産企画係の期首年月・担当者と目標・反響元・
 ## 宅建業者情報
 契約書の「乙」欄と記名押印欄に印字する、会社の情報です。
 
+## 架電キュー（抽出ルールと一言目）
+[[今日の架電キュー（不動産企画係）]]に並べるルールと、要件タグごとの一言目です。チーム全員で共通です。
+- 1日に並べる件数（1〜50件）
+- 売り反響・買い反響：何日ふれていなければ並べるか
+- 1日の目標：週次行動計画の週の架電目標を、この数で割ったもの
+- 買い反響もキューに含めるか
+
+一言目には次の言葉を入れておくと、反響に合わせて置き換わります：{{name}}（顧客名）・{{staff}}（担当者）・{{company}}（会社名）・{{addr}}（物件所在地）・{{property}}（問合せ物件）・{{next}}（前回の次回アクション）。「一言目を初期値に戻す」で以前のアプリの文面に戻せます。
+
 ## 以前のアプリのデータを取り込む（マスターだけ）
 以前のアプリの全データ（反響・商談・媒介台帳・買取再販・変更履歴など）と、設定・週次行動計画・コンプライアンスを、Dashboard に取り込んで最新にします。この節は権限が「マスター」の人にだけ表示されます。
 
@@ -54,4 +63,14 @@ summary: 不動産企画係の期首年月・担当者と目標・反響元・
 
 > 要確認：取り込みの前に、開発が本番のデータの控えを作ります。取り込む日時は開発と決めてください。
 
-> 注意：以前のアプリにあった「買取再販の粗利の計算方式・経費科目」「架電キュー」「売主への販売報告」「データ管理」は、それを使う画面と一緒に、このあとの版で移します。
+## 以前のアプリの通話記録・練習記録を取り込む（マスターだけ）
+以前のアプリの架電ナビの通話記録と、ロープレ練習の記録を取り込みます。ファイルは開発が以前のアプリのサーバーから書き出した CSV です。
+1. 「通話記録」か「練習記録」を選ぶ
+2. CSV ファイルを選ぶ（件数が出ます）
+3. 「取り込む」を押す
+
+同じ記録は二重に入りません。途中で止まったときは、同じファイルでもう一度取り込めば続きから入ります。
+
+> 注意：練習記録は、ロープレ練習の画面（移行中）を移したときに使います。
+
+> 注意：以前のアプリにあった「買取再販の粗利の計算方式・経費科目」「売主への販売報告」「データ管理」は、それを使う画面と一緒に、このあとの版で移します。
```
