# 作業記録 2026-11-03-01　中古リノベの「今日の架電キュー」（v2.2.239）

## 依頼（ReadMeClaude.md）
- 新しいブランチで作業開始（→ `v2.2.239`）
- `frontend/src/components/callq` を作り、`Menu.tsx` を改修。`category === used` のとき「全社報告用フォーマット」の下に**今日の架電キュー**
- UI は不動産企画係（`category = realty`）の「今日の架電キュー」を参照
- 上部にサマリー
  - **今日の架電**：`call_sheet` の shop = 買い:中古リノベ の顧客。`call_log` の day = 今日・action = 次回架電日 の数
  - **今週の架電**：同じ shop。day = 今週・action = 通電 未通電 SMS の数
  - **接触確認率**は出さない → 代わりに**今月の架電**
  - 残りのキューは使わない
- 顧客ごとのカード：顧客名・顧客情報。一言目は不要。アクションを選べるボタン・メモ欄

## 決めたこと（2026-11-03 に利用者に確認）
| 項目 | 決定 | 理由 |
|---|---|---|
| キューの対象 | **最後の次回架電日が今日以前**で、その日以降にまだ架電（通電・未通電・SMS送信）していない顧客 | 次回架電日は全期間で14件しか無く、「今日だけ」ではほぼ毎日0件になる |
| 今週の区切り | **月曜〜日曜** | |
| 数える架電 | **通電・未通電・SMS送信** | 指示書の「SMS」は記録上「SMS送信」 |

## 調べたこと（ローカル DB）
- `call_sheet` の shop = 買い:中古リノベ は 1,331行。すべて `master_data_resale` に結びつく。`call_log` はすべて JSON の配列（壊れた行 0）
- `call_log` の action：未通電 12,970・通電 3,278・メール送信 943・SMS送信 12・**次回架電日 14**・空 3
- `call_sheet` の id の重複は 0件。`master_data_resale` は同じ id が1組ある（no の小さい方を使う）
- `call_sheet.status`（架電ステータス）：空 832・未通電 186・継続 158・架電停止 86・来場済み 48・来場アポ 21

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/callq/ | **usedQueue.ts（新規）** | `runUsedQueueList`（一覧・サマリー）・`runUsedQueueMark`（記録） |
| backend-express/src/gateway/ | registry.ts | `callq_used:list`・`callq_used:mark` を登録（担当事業 used / all だけ。`USED_SHOPS`） |
| backend/src/core/ | express_proxy.php | `expressProxyRequests()` と `expressProxyExclusive()` の両方に2つを追加 |
| frontend/src/components/callq/ | **UsedCallQueue.tsx（新規）** | 画面本体 |
| frontend/src/components/ | Menu.tsx | 中古リノベだけ「全社報告用フォーマット」の下に「今日の架電キュー」（`/usedCallQueue`） |
| frontend/src/ | App.tsx | ルート `/usedCallQueue` |
| frontend/src/components/guide/ | guideScreens.ts | `'今日の架電キュー（中古リノベ）'`（⚠️ 不動産企画係の記事の「今日の架電キュー」にボタンが付かないよう名前を分けた） |
| frontend/src/utils/ | version.ts | 2.2.239 |
| backend/scripts/sql/ | **2026-11-03_update_log_2.2.239.sql（新規）** | 更新履歴＋業務ガイドの記事（ローカルに流した。no = 338） |
| backend/scripts/guide/articles/used/ | **screen-050.md（新規）** | 業務ガイド「今日の架電キュー（中古リノベ）」 |
| docs/ | deploy-v2.2.239.md（新規） | デプロイ手順 |

- 計画では `callq/usedCallqLogic.ts` も作る予定だったが、抽出と集計を ② に置いたので作っていない（画面側に計算が残らないため）。

## 仕組み
- **一覧（callq_used:list）**：`call_sheet`（shop = 買い:中古リノベ）と `master_data_resale`（show_dashboard = 1・削除済みを除く）を JS で突き合わせる（⚠️ id は照合順序が違い索引も無いので SQL で JOIN しない）。
  - 記録の day は `YYYY/MM/DD` と `YYYY-MM-DD` が混ざるのでそろえる（`dayOf`）
  - キューに並べる（`inQueue`）
    - 未記録：最後の次回架電日（`nextDay`）が今日以前、かつ今日以前の最後の次回架電日（`dueDay`）以降に架電が無い
    - 記録済：`dueDay` 以降の最後の架電が今日（⚠️ 先の次回架電日を入れ直していても、今日のあいだは残す）
    - 架電停止・契約済み・失注・重複は並べない
  - サマリー：今日＝次回架電日が今日（「自分」は顧客の担当）。今週・今月＝通電・未通電・SMS送信（「自分」は架電した人。空なら顧客の担当）
- **記録（callq_used:mark）**：`action`（通電・未通電・SMS送信・メール送信・資料郵送）・`note`・`next_day` を受ける
  - 架電は day = 今日（日本時間）・time = 今、次回架電日は day = 予定の日（顧客画面 TableCall.tsx と同じ形）
  - ⚠️ `JSON_ARRAY_APPEND` で**末尾に足す**（読んでから配列ごと書き戻すと、同時に記録した分が消えるため）。2件のときも1つの UPDATE
  - ⚠️ JSON として読めない記録には書かない（409）。空なら新しく作る
  - あわせて `master_data_resale.call_log`（架電回数＝通電・未通電の数）を顧客画面の保存と同じ数え方で直す
- **画面**：並び順は読み込んだときに固定し、記録・顧客画面を閉じたあとも保つ（新しく対象になった顧客は末尾）。「自分の担当のみ」の初期値は ON

## 業務ガイド
- 追加：「今日の架電キュー（中古リノベ）」（used/screen-050.md）。並ぶお客様・上の数字・記録のしかた・注意（詳細を開いたままの同時記録）

## テスト（ローカル）
- ② 型チェック（`npx tsc --noEmit`）・フロント `npm run build` ともに通過（新しいファイルに警告なし）
- ① 経由（`localhost:8080`）
  - トークン無し：list・mark とも **401**
  - list：今月 142件（11月の未通電113＋通電29 と一致）・キュー2件・自分の担当1件
  - mark：通電＋次回架電日 → 2件が末尾に入る。⚠️ 既存の11件は JSON.parse 後に完全一致・`\u` エスケープも残る。台帳の架電回数 8 → 9
  - 入力の誤り：知らないアクション・過去の日付・存在しない日付（2026-13-40・2026-02-30）・空 → 400、無い顧客 → 404、読めない形の記録 → 409（中身はそのまま）、空の記録 → 新しく作る
  - ⚠️ テストで書き込んだ行は退避した内容に戻した。一時スタッフ・退避用の表も消した
- Playwright（3100）：メニューの位置・サマリー・自分の担当のみの切り替え・ボタンの選択・記録（記録済になり今週・今月が1増える）・「開く」で顧客の詳細・スマホ幅（横にはみ出さない）
  - 見つけて直したもの：選んだボタンにマウスが乗ると文字が見えない／古い記録のメモの `<br>` がそのまま出る／長いメモで枠が広がる
- 見つけて直したもの（②）：存在しない日付が通っていた（`isRealDay`）／読めない記録を `[]` に置き換えていた／2件を別の UPDATE で入れていた

## リファクタリング
- usedQueue.ts の外から使っていない export（`USED_CALL_SHOP`・`MARK_ACTIONS`・`weekRange`・`CallEntry`・`QueueCard`・`Result`）を外した。整理のあと ① 経由のテストと Playwright をもう一度通した

## 残っていること
- ⚠️ お客様の詳細（InformationEditResale.tsx）は保存のとき架電記録を丸ごと書き戻す。詳細を開いたまま別の人がキューで記録すると、その記録が消える（以前からの動き。今回は直していない。業務ガイドに注意として書いた）
- 次回架電日がほとんど使われていないので、運用で入れてもらう必要がある

---

## コード（新規ファイルは全文）

### backend-express/src/features/callq/usedQueue.ts

```tsx
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { logger } from '../../utils/logger';

/**
 * 中古リノベの今日の架電キュー（v2.2.239。② だけ）。画面は frontend/src/components/callq/UsedCallQueue.tsx。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 対象は call_sheet の shop = '買い:中古リノベ' の顧客（⚠️ 顧客台帳の店舗ではなく架電記録の店舗。2026-11-03 の指示）。
 * ⚠️ 架電記録は call_sheet.call_log（{day, time, action, note, staff, status} の JSON 配列）。顧客画面（TableCall.tsx）と同じ形で書く。
 *   callq_used:list … キューとサマリー
 *   callq_used:mark … カードの記録（1件を末尾に足す。⚠️ 配列ごと書き換えない＝同時に記録しても消し合わない）
 * ⚠️ キュー＝最後の「次回架電日」が今日以前で、その日以降にまだ架電（通電・未通電・SMS送信）していない顧客（2026-11-03 の決定）。
 *   ⚠️ 今日その予定に架電した顧客も「記録済」としてキューに残す（不動産の画面と同じく、作業中に行が消えないように）。
 * ⚠️ サマリーの架電は 通電・未通電・SMS送信（指示書の「SMS」は記録上「SMS送信」）。週は月曜〜日曜。
 * ⚠️ 日付は日本時間。⚠️ 記録の day は 'YYYY-MM-DD' と 'YYYY/MM/DD' が混ざるので、そろえてから比べる。
 * ─────────────────────────────────────────────
 */

interface Result {
  httpStatus: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown>): Result => ({ httpStatus: 200, body });
const fail = (httpStatus: number, message: string): Result => ({ httpStatus, body: { status: 'error', message } });

const USED_CALL_SHOP = '買い:中古リノベ';
const NEXT_CALL = '次回架電日';
/** サマリーに数える架電・キューを「架電済み」にする架電 */
const CALL_ACTIONS = ['通電', '未通電', 'SMS送信'];
/** カードで選べるアクション（⚠️ 顧客画面 TableCall.tsx の actions から「次回架電日」を除いたもの。次回架電日は日付の欄で入れる） */
const MARK_ACTIONS = ['通電', '未通電', 'SMS送信', 'メール送信', '資料郵送'];
/** 顧客台帳の架電回数（master_data_resale.call_log）に数えるアクション（⚠️ 顧客画面の保存と同じ数え方） */
const COUNT_ACTIONS = ['通電', '未通電'];
/** キューに出さない顧客 */
const OFF_CALL_STATUS = ['架電停止'];
const OFF_STATUS = ['契約済み', '失注', '重複'];
/** カードに出す直近の記録の数 */
const RECENT = 3;
const NOTE_MAX = 1000;

interface SheetRow extends RowDataPacket {
  id: string;
  status: string | null;
  call_log: string | null;
}

interface MasterRow extends RowDataPacket {
  id: string;
  name: string | null;
  mobile: string | null;
  phone: string | null;
  staff: string | null;
  medium: string | null;
  inquiry: string | null;
  status: string | null;
}

interface CallEntry {
  day: string;
  time: string;
  action: string;
  note: string;
  staff: string;
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** 空白を除いた名前（ログイン名と記録の名前で空白の入り方が違うことがある） */
const bare = (s: string): string => s.replace(/[\s　]/g, '');

const p2 = (n: number) => String(n).padStart(2, '0');

/** 日本時間の今日（'YYYY-MM-DD'）と時刻（'HH:MM'） */
const jstNow = (now = new Date()) => {
  const d = new Date(now.getTime() + 9 * 3600_000);
  return {
    date: `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`,
    time: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`,
  };
};

const addDays = (ds: string, n: number): string => {
  const d = new Date(`${ds}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 今週（月曜〜日曜） */
const weekRange = (today: string): [string, string] => {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const from = addDays(today, -((dow + 6) % 7));
  return [from, addDays(from, 6)];
};

/** 記録の日付をそろえる（'2026/10/08' → '2026-10-08'）。⚠️ 読めなければ '' */
const dayOf = (v: unknown): string => {
  const s = str(v).trim().replace(/\//g, '-').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

/** 実在する日付か（⚠️ '2026-13-40' のような形だけ合った値を弾く） */
const isRealDay = (s: string): boolean => {
  const t = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === s;
};

/** call_log を読む。⚠️ 壊れた値・配列でない値は空 */
const parseLog = (raw: string | null): CallEntry[] => {
  let list: unknown;
  try {
    list = JSON.parse(str(raw) || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list
    .filter((e): e is Record<string, unknown> => e !== null && typeof e === 'object')
    .map((e) => ({ day: dayOf(e.day), time: str(e.time), action: str(e.action).split(',')[0], note: str(e.note), staff: str(e.staff) }));
};

const telOf = (m: MasterRow | undefined): string => str(m?.mobile).trim() || str(m?.phone).trim();

/** 最後の「次回架電日」。⚠️ until を渡すとその日まで（今日以前の予定＝キューに並べる理由） */
const lastNextDay = (logs: CallEntry[], until = '9999-12-31'): string =>
  logs.filter((e) => e.action === NEXT_CALL && e.day !== '' && e.day <= until).reduce((max, e) => (e.day > max ? e.day : max), '');

const byTime = (a: CallEntry, b: CallEntry): number => (a.day + a.time).localeCompare(b.day + b.time);

/** 予定の日以降の最後の架電 */
const lastCallFrom = (logs: CallEntry[], from: string): CallEntry | undefined =>
  logs.filter((e) => CALL_ACTIONS.includes(e.action) && e.day >= from).sort(byTime).pop();

const diffDays = (a: string, b: string): number =>
  Math.round((new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86400000);

const loadSheets = (id?: string): Promise<SheetRow[]> =>
  query<SheetRow>(
    `SELECT id, status, call_log FROM call_sheet WHERE shop = ?${id === undefined ? '' : ' AND id = ?'}`,
    id === undefined ? [USED_CALL_SHOP] : [USED_CALL_SHOP, id]
  );

/**
 * 顧客台帳（中古）。⚠️ id は表どうしで照合順序が違い、索引も無いので、SQL で JOIN せず JS で突き合わせる。
 * ⚠️ 同じ id が複数ある顧客は最初の行（no の小さい方）。⚠️ 表示しない顧客・削除済みの顧客は除く。
 */
const loadMasters = async (id?: string): Promise<Map<string, MasterRow>> => {
  const rows = await query<MasterRow>(
    `SELECT id, customer_contacts_name AS name, customer_contacts_mobile_phone_number AS mobile, customer_contacts_phone_number AS phone,
            in_charge_user AS staff, sales_promotion_name AS medium, step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99 AS inquiry, status
       FROM master_data_resale
      WHERE show_dashboard = 1 AND COALESCE(delete_dashboard, 0) <> 1${id === undefined ? '' : ' AND id = ?'}
      ORDER BY no`,
    id === undefined ? [] : [id]
  );
  const map = new Map<string, MasterRow>();
  for (const r of rows) if (!map.has(str(r.id))) map.set(str(r.id), r);
  return map;
};

interface QueueCard {
  id: string;
  name: string;
  tel: string;
  staff: string;
  medium: string;
  inquiryDay: string;
  status: string;
  callStatus: string;
  /** 最後の次回架電日（⚠️ 今日より先のこともある。記録したあとの次の予定） */
  nextDay: string;
  /** 今日以前の最後の次回架電日（キューに並べる理由の予定） */
  dueDay: string;
  /** dueDay を過ぎた日数（今日なら 0） */
  overdue: number;
  /** dueDay 以降の最後の架電（⚠️ あれば「記録済」） */
  done: CallEntry | null;
  calls: number;
  recent: CallEntry[];
}

const cardOf = (sheet: SheetRow, master: MasterRow, logs: CallEntry[], today: string): QueueCard => {
  const dueDay = lastNextDay(logs, today);
  return {
    id: str(sheet.id),
    name: str(master.name),
    tel: telOf(master),
    staff: str(master.staff),
    medium: str(master.medium),
    inquiryDay: dayOf(master.inquiry),
    status: str(master.status),
    callStatus: str(sheet.status),
    nextDay: lastNextDay(logs),
    dueDay,
    overdue: dueDay === '' ? 0 : diffDays(today, dueDay),
    done: dueDay === '' ? null : lastCallFrom(logs, dueDay) ?? null,
    calls: logs.filter((e) => COUNT_ACTIONS.includes(e.action)).length,
    recent: logs.filter((e) => e.action !== NEXT_CALL).sort(byTime).reverse().slice(0, RECENT),
  };
};

/**
 * キューに並べるか。
 *   未記録 … 最後の次回架電日が今日以前で、その日以降にまだ架電していない
 *   記録済 … 予定の日以降の架電が今日（⚠️ 先の次回架電日を入れ直していても、今日は「記録済」として残す）
 * ⚠️ 次回架電日だけを先へ入れ直した（架電していない）顧客は並べない。
 */
const inQueue = (card: QueueCard, today: string): boolean => {
  if (card.dueDay === '') return false;
  if (card.done === null) return card.nextDay <= today;
  return card.done.day === today;
};

const isOff = (sheet: SheetRow, master: MasterRow): boolean =>
  OFF_CALL_STATUS.includes(str(sheet.status)) || OFF_STATUS.includes(str(master.status));

interface Kpi { today: number; week: number; month: number }

/** callq_used:list */
export const runUsedQueueList = async (staff: AuthenticatedStaff): Promise<Result> => {
  try {
    const { date: today } = jstNow();
    const [weekFrom, weekTo] = weekRange(today);
    const monthFrom = `${today.slice(0, 7)}-01`;
    const monthTo = `${today.slice(0, 7)}-31`;
    const [sheets, masters] = await Promise.all([loadSheets(), loadMasters()]);

    const me = bare(staff.name);
    const kpi = { all: { today: 0, week: 0, month: 0 } as Kpi, mine: { today: 0, week: 0, month: 0 } as Kpi };
    const cards: QueueCard[] = [];
    for (const sheet of sheets) {
      const master = masters.get(str(sheet.id));
      if (master === undefined) continue;
      const logs = parseLog(sheet.call_log);
      const mineCustomer = bare(str(master.staff)) === me;
      for (const e of logs) {
        // 今日の架電＝次回架電日が今日の件数（⚠️ 担当は顧客の担当）
        if (e.action === NEXT_CALL && e.day === today) {
          kpi.all.today++;
          if (mineCustomer) kpi.mine.today++;
        }
        // 今週・今月の架電＝通電・未通電・SMS送信の件数（⚠️ 担当は架電した人。空なら顧客の担当）
        if (!CALL_ACTIONS.includes(e.action) || e.day === '') continue;
        const mineCall = bare(e.staff || str(master.staff)) === me;
        if (e.day >= weekFrom && e.day <= weekTo) {
          kpi.all.week++;
          if (mineCall) kpi.mine.week++;
        }
        if (e.day >= monthFrom && e.day <= monthTo) {
          kpi.all.month++;
          if (mineCall) kpi.mine.month++;
        }
      }
      if (isOff(sheet, master)) continue;
      const card = cardOf(sheet, master, logs, today);
      if (inQueue(card, today)) cards.push(card);
    }
    // 未記録が先。その中は期日を過ぎた日数の多い順
    cards.sort((a, b) => Number(a.done !== null) - Number(b.done !== null) || b.overdue - a.overdue || a.name.localeCompare(b.name, 'ja'));

    return ok({ status: 'ok', today, week: [weekFrom, weekTo], me: staff.name, kpi, cards, actions: MARK_ACTIONS });
  } catch (error) {
    logger.error(`callq_used:list に失敗しました: ${(error as Error).message}`);
    return fail(500, '架電キューを読み込めませんでした。');
  }
};

/**
 * callq_used:mark（【書き込み】）。
 * ⚠️ 本文: id・action（MARK_ACTIONS のどれか。空なら次回架電日だけ）・note・next_day（'YYYY-MM-DD'。今日以降。空なら入れない）。
 * ⚠️ 記録は JSON_ARRAY_APPEND で末尾に足す（⚠️ 読んでから配列ごと書き戻すと、同時に記録した分が消える）。
 * ⚠️ あわせて顧客台帳の架電回数（master_data_resale.call_log）を顧客画面の保存と同じ数え方で直す。
 */
export const runUsedQueueMark = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Result> => {
  const id = str(body.id).trim();
  const action = str(body.action).trim();
  const note = str(body.note).trim().slice(0, NOTE_MAX);
  const nextDay = str(body.next_day).trim();
  const { date: today, time } = jstNow();

  if (id === '') return fail(400, '顧客が指定されていません。');
  if (action !== '' && !MARK_ACTIONS.includes(action)) return fail(400, 'アクションの値が正しくありません。');
  if (nextDay !== '' && (dayOf(nextDay) !== nextDay || !isRealDay(nextDay) || nextDay < today)) return fail(400, '次回架電日は今日以降の日付を入れてください。');
  if (action === '' && nextDay === '') return fail(400, 'アクションか次回架電日を入れてください。');

  try {
    const [sheet] = await loadSheets(id);
    const masters = await loadMasters(id);
    const master = masters.get(id);
    if (sheet === undefined || master === undefined) return fail(404, '対象の顧客が見つかりません（画面を再読み込みしてください）。');

    const entries: (CallEntry & { status: string })[] = [];
    const status = str(master.status);
    if (action !== '') entries.push({ day: today, time, action, note, staff: staff.name, status });
    // ⚠️ 次回架電日の記録の day は予定の日（顧客画面と同じ）
    if (nextDay !== '') entries.push({ day: nextDay, time: '', action: NEXT_CALL, note: action === '' ? note : '', staff: staff.name, status });

    // ⚠️ 1つの UPDATE で全部足す（片方だけ入るのを防ぐ）。⚠️ 空の記録は [] から始める。
    // ⚠️ JSON として読めない記録には書かない（[] に置き換えると今までの記録が消える）
    const result = await execute(
      `UPDATE call_sheet
          SET call_log = JSON_ARRAY_APPEND(IF(TRIM(COALESCE(call_log, '')) = '', '[]', call_log), ${entries.map(() => `'$', JSON_EXTRACT(?, '$')`).join(', ')})
        WHERE shop = ? AND id = ?
          AND (TRIM(COALESCE(call_log, '')) = '' OR (JSON_VALID(call_log) AND JSON_TYPE(call_log) = 'ARRAY'))`,
      [...entries.map((e) => JSON.stringify(e)), USED_CALL_SHOP, id]
    );
    if (result.affectedRows === 0) return fail(409, 'このお客様の架電記録が読めない形のため記録できません。お客様の詳細から記録してください。');

    const [after] = await loadSheets(id);
    const logs = parseLog(after?.call_log ?? null);
    await execute('UPDATE master_data_resale SET call_log = ? WHERE id = ?', [String(logs.filter((e) => COUNT_ACTIONS.includes(e.action)).length), id]);

    return ok({ status: 'ok', card: cardOf(after ?? sheet, master, logs, today) });
  } catch (error) {
    logger.error(`callq_used:mark に失敗しました id=${id}: ${(error as Error).message}`);
    return fail(500, '記録できませんでした。');
  }
};
```

### frontend/src/components/callq/UsedCallQueue.tsx

```tsx
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import AuthContext from '../../context/AuthContext';
import apiClient from '../../utils/apiClient';
import InformationEditResale from '../information/InformationEditResale';

/**
 * 📞 今日の架電キュー（中古リノベ。v2.2.239）。左のメニュー「全社報告用フォーマット」の下。
 *
 * ⚠️ 見た目は不動産企画係の今日の架電キュー（realty/callq/CallQueue.tsx）に合わせている。⚠️ 一言目・接触確認率・残りのキューは出さない（2026-11-03 の指示）。
 * ⚠️ 抽出と集計は ② の callq_used:list、カードの記録は callq_used:mark（features/callq/usedQueue.ts）。
 *   キュー＝最後の「次回架電日」が今日以前で、その日以降にまだ架電（通電・未通電・SMS送信）していない顧客。
 * ⚠️ 並び順は読み込んだときに固定する（記録しても行が動かないように）。並べ直すのは「🔄 再読み込み」。
 */

type CallEntry = { day: string; time: string; action: string; note: string; staff: string };
type QueueCard = {
    id: string; name: string; tel: string; staff: string; medium: string; inquiryDay: string;
    status: string; callStatus: string; nextDay: string; dueDay: string; overdue: number; done: CallEntry | null; calls: number; recent: CallEntry[];
};
type Kpi = { today: number; week: number; month: number };
type ListBody = {
    status?: string; message?: string; today: string; week: [string, string]; me: string;
    kpi: { all: Kpi; mine: Kpi }; cards: QueueCard[]; actions: string[];
};
type Draft = { action: string; note: string; nextDay: string };

const EMPTY_DRAFT: Draft = { action: '', note: '', nextDay: '' };

const STYLE = `
.ucq-page { padding: 4px 8px 24px; }
.ucq-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; margin-bottom: 14px; }
.ucq-head h1 { font-size: 14px; font-weight: bold; color: #495057; margin: 0; }
.ucq-sub { font-size: 11px; color: #6c757d; margin: 0; }
.ucq-card-box { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,.05); margin-bottom: 16px; }
.ucq-box-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 16px 8px; }
.ucq-box-head h3 { font-size: 13px; font-weight: bold; color: #343a40; margin: 0; }
.ucq-body { padding: 4px 16px 14px; font-size: 12px; }
.ucq-label { font-size: 11px; color: #6c757d; cursor: pointer; }
.ucq-btn { font-size: 11px; font-weight: bold; border-radius: 4px; padding: 3px 12px; border: 1px solid #0d6efd; background: #0d6efd; color: #fff; cursor: pointer; }
.ucq-btn.sec { background: #fff; color: #0d6efd; }
.ucq-btn:disabled { opacity: .5; cursor: not-allowed; }
.ucq-sp { flex: 1; }
.ucq-meters { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
.ucq-meter { border: 1px solid #e9ecef; border-radius: 8px; padding: 8px 12px; background: #fff; }
.ucq-meter .t { display: flex; justify-content: space-between; font-size: 11px; color: #6c757d; }
.ucq-meter .v { font-size: 20px; font-weight: bold; color: #343a40; font-variant-numeric: tabular-nums; }
.ucq-meter .v small { font-size: 11px; font-weight: normal; color: #6c757d; }
.ucq-note { border-radius: 6px; padding: 8px 12px; font-size: 11px; margin-bottom: 12px; border: 1px solid #b6d4fe; background: #e7f1ff; color: #084298; line-height: 1.7; }
.ucq-note.done { border-color: #a3cfbb; background: #d1e7dd; color: #0f5132; }
.ucq-empty { text-align: center; color: #6c757d; padding: 24px; font-size: 12px; line-height: 1.8; }
.ucq-list { display: flex; flex-direction: column; gap: 10px; }
.ucq-card { border: 1px solid #dee2e6; border-radius: 8px; padding: 10px 14px; background: #fff; }
.ucq-card.next { border: 2px solid #0d6efd; box-shadow: 0 2px 8px rgba(13,110,253,.15); }
.ucq-card.done { background: #f8f9fa; opacity: .75; }
.ucq-r1 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ucq-no { width: 24px; height: 24px; border-radius: 50%; background: #e9ecef; color: #495057; font-size: 11px; font-weight: bold; display: inline-flex; align-items: center; justify-content: center; }
.ucq-card.next .ucq-no { background: #0d6efd; color: #fff; }
.ucq-nm { font-size: 14px; font-weight: bold; color: #212529; }
.ucq-tel { font-size: 13px; font-weight: bold; color: #0d6efd; text-decoration: none; }
.ucq-tel.no { color: #adb5bd; font-weight: normal; font-size: 11px; }
.ucq-meta { font-size: 11px; color: #495057; margin-top: 6px; line-height: 1.7; }
.ucq-recent { margin-top: 6px; border-left: 3px solid #e9ecef; padding-left: 8px; font-size: 11px; color: #6c757d; line-height: 1.6; overflow-wrap: anywhere; }
.ucq-recent b { color: #495057; }
.ucq-acts { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.ucq-acts button { border-radius: 6px; padding: 8px 4px; font-size: 12px; font-weight: bold; cursor: pointer; border: 1px solid #ced4da; background: #fff; color: #495057; }
.ucq-acts button:hover:not(:disabled):not(.on) { background: #f8f9fa; }
.ucq-acts button.on { border-color: #0d6efd; background: #0d6efd; color: #fff; }
.ucq-acts button:disabled { opacity: .5; cursor: wait; }
.ucq-form { display: flex; gap: 8px; margin-top: 8px; align-items: flex-start; flex-wrap: wrap; }
.ucq-memo { flex: 1; min-width: 220px; font-size: 12px; padding: 6px 8px; border: 1px solid #ced4da; border-radius: 6px; resize: vertical; }
.ucq-memo:focus, .ucq-date:focus { outline: 2px solid #0d6efd33; border-color: #0d6efd; }
.ucq-next { display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: #6c757d; }
.ucq-date { font-size: 12px; padding: 5px 6px; border: 1px solid #ced4da; border-radius: 6px; }
.ucq-save { align-self: stretch; padding: 0 18px; font-size: 12px; }
.ucq-badge { display: inline-block; border-radius: 10px; padding: 1px 8px; font-size: 10px; font-weight: bold; margin-left: 4px; }
.ucq-badge.red { background: #f8d7da; color: #842029; } .ucq-badge.navy { background: #cfe2ff; color: #084298; }
.ucq-badge.gray { background: #e9ecef; color: #495057; } .ucq-badge.green { background: #d1e7dd; color: #0f5132; }
.ucq-toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: #212529; color: #fff; padding: 8px 18px; border-radius: 6px; font-size: 12px; z-index: 2000; }
@media (max-width: 640px) { .ucq-acts { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
`;

const ACTION_ICON: Record<string, string> = { '通電': '🗣', '未通電': '📵', 'SMS送信': '💬', 'メール送信': '✉️', '資料郵送': '📮' };

const fmtD = (ds: string): string => {
    const [y, m, d] = ds.slice(0, 10).split('-');
    return d ? `${y}/${Number(m)}/${Number(d)}` : (ds || '―');
};
const bare = (s: string): string => s.replace(/[\s　]/g, '');
/** 記録のメモ（⚠️ 取り込んだ古い記録には改行の代わりに <br> が入っている） */
const plainNote = (s: string): string => s.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
const errorMessage = (e: unknown, fallback: string): string =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || (e instanceof Error ? e.message : fallback);

const UsedCallQueue: React.FC = () => {
    const { token, authority } = useContext(AuthContext);
    const [data, setData] = useState<ListBody | null>(null);
    const [cards, setCards] = useState<QueueCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [mine, setMine] = useState(true);
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});
    const [openId, setOpenId] = useState('');
    const [toast, setToast] = useState('');
    const toastTimer = useRef<number | undefined>(undefined);

    const showToast = (m: string) => {
        setToast(m);
        window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(''), 2200);
    };

    /** keepOrder = 今の並びを保つ（記録・顧客画面を閉じたあと）。⚠️ 新しく対象になった顧客は末尾 */
    const load = useCallback(async (keepOrder: boolean) => {
        try {
            const res = await apiClient.post<ListBody>('', { request: 'callq_used', roll: 'list' });
            const body = res.data;
            if (body?.status === 'error') throw new Error(body.message || '読み込めませんでした');
            setData(body);
            setCards(prev => {
                if (!keepOrder) return body.cards;
                const at = new Map(prev.map((c, i) => [c.id, i]));
                return [...body.cards].sort((a, b) => (at.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (at.get(b.id) ?? Number.MAX_SAFE_INTEGER));
            });
        } catch (e) {
            alert(`読み込めませんでした: ${errorMessage(e, '通信エラー')}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(false); }, [load]);

    const draftOf = (id: string): Draft => drafts[id] ?? EMPTY_DRAFT;
    const setDraft = (id: string, patch: Partial<Draft>) => setDrafts(prev => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_DRAFT), ...patch } }));

    const scrollToNext = () => window.setTimeout(() => {
        const e = document.getElementById('ucq-next');
        if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);

    const mark = async (card: QueueCard) => {
        const d = draftOf(card.id);
        if (!d.action && !d.nextDay) { showToast('アクションを選ぶか、次回架電日を入れてください'); return; }
        setBusy(true);
        try {
            const res = await apiClient.post('', { request: 'callq_used', roll: 'mark', id: card.id, action: d.action, note: d.note, next_day: d.nextDay });
            if (res.data?.status === 'error') throw new Error(res.data.message || '記録できませんでした');
            setDrafts(prev => { const { [card.id]: _, ...rest } = prev; return rest; });
            showToast(`${d.action ? `${ACTION_ICON[d.action] ?? ''} ${d.action}を記録しました` : '次回架電日を記録しました'}${d.nextDay ? `（次回 ${fmtD(d.nextDay)}）` : ''}`);
            await load(true);
            scrollToNext();
        } catch (e) {
            alert(`記録できませんでした: ${errorMessage(e, '通信エラー')}`);
        } finally {
            setBusy(false);
        }
    };

    const closeCustomer = () => {
        setOpenId('');
        void load(true);
    };

    if (loading) return <div className="ucq-page"><style>{STYLE}</style><p className="ucq-sub">読み込み中…</p></div>;
    if (data === null) return <div className="ucq-page"><style>{STYLE}</style><p className="ucq-sub">読み込めませんでした。画面を再読み込みしてください。</p></div>;

    const me = bare(data.me);
    const shown = mine ? cards.filter(c => bare(c.staff) === me) : cards;
    const kpi = mine ? data.kpi.mine : data.kpi.all;
    const nextId = shown.find(c => c.done === null)?.id ?? '';
    const doneN = shown.filter(c => c.done !== null).length;
    const [wf, wt] = data.week;

    const card = (c: QueueCard, i: number) => {
        const d = draftOf(c.id);
        const isNext = c.id === nextId;
        return (
            <div key={c.id} className={`ucq-card ${c.done ? 'done' : ''} ${isNext ? 'next' : ''}`} id={isNext ? 'ucq-next' : undefined}>
                <div className="ucq-r1">
                    <span className="ucq-no">{c.done ? '✓' : i + 1}</span>
                    <span className="ucq-nm">{c.name || '（顧客名なし）'}</span>
                    {c.tel ? <a className="ucq-tel" href={`tel:${c.tel}`}>☎ {c.tel}</a> : <span className="ucq-tel no">☎ 電話番号なし</span>}
                    <span>
                        {c.overdue > 0 ? <span className="ucq-badge red">{c.overdue}日超過</span> : <span className="ucq-badge navy">今日の予定</span>}
                        {c.callStatus && <span className="ucq-badge gray">{c.callStatus}</span>}
                    </span>
                    <span className="ucq-sp"></span>
                    <button className="ucq-btn sec" onClick={() => setOpenId(c.id)}>開く</button>
                </div>
                <div className="ucq-meta">
                    {`担当：${c.staff || '未割当'}　／　媒体：${c.medium || '―'}　／　反響 ${fmtD(c.inquiryDay)}　／　状況：${c.status || '―'}`}
                    <br />
                    {`次回架電日：${fmtD(c.dueDay)}　／　通算 📞${c.calls}`}
                </div>
                {c.recent.length > 0 && (
                    <div className="ucq-recent">
                        {c.recent.map((r, k) => (
                            <div key={k}><b>{fmtD(r.day)}{r.time ? ` ${r.time}` : ''} {r.action || '（アクションなし）'}</b>{r.staff ? `（${r.staff}）` : ''}{r.note ? `：${plainNote(r.note).slice(0, 80)}` : ''}</div>
                        ))}
                    </div>
                )}
                {c.done ? (
                    <div className="ucq-meta">
                        <b>{ACTION_ICON[c.done.action] ?? ''} {c.done.action}</b> を記録しました（{fmtD(c.done.day)}{c.done.time ? ` ${c.done.time}` : ''}）
                        {c.nextDay > data.today ? `　次回 ${fmtD(c.nextDay)}` : '　※ 次の次回架電日はまだ入っていません'}
                    </div>
                ) : (
                    <>
                        <div className="ucq-acts" role="group" aria-label="アクション内容">
                            {data.actions.map(a => (
                                <button key={a} type="button" className={d.action === a ? 'on' : ''} aria-pressed={d.action === a} disabled={busy}
                                    onClick={() => setDraft(c.id, { action: d.action === a ? '' : a })}>
                                    {ACTION_ICON[a] ?? ''} {a}
                                </button>
                            ))}
                        </div>
                        <div className="ucq-form">
                            <textarea className="ucq-memo" rows={2} placeholder="メモ（ヒアリング内容など）" value={d.note}
                                onChange={e => setDraft(c.id, { note: e.target.value })} aria-label="メモ" />
                            <label className="ucq-next">次回架電日
                                <input type="date" className="ucq-date" min={data.today} value={d.nextDay} onChange={e => setDraft(c.id, { nextDay: e.target.value })} />
                            </label>
                            <button className="ucq-btn ucq-save" disabled={busy || (!d.action && !d.nextDay)} onClick={() => void mark(c)}>記録</button>
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="ucq-page">
            <style>{STYLE}</style>
            <div className="ucq-head">
                <h1><i className="fa-solid fa-phone me-2" style={{ color: '#0d6efd' }}></i>今日の架電キュー</h1>
                <p className="ucq-sub">次回架電日が今日までのお客様に、上から順にかけていくための画面です。{fmtD(data.today)}</p>
            </div>

            <div className="ucq-card-box">
                <div className="ucq-box-head">
                    <h3>本日の対象 {shown.length}件<span className={`ucq-badge ${doneN ? 'green' : 'gray'}`}>記録済 {doneN}</span></h3>
                    <span className="ucq-sp"></span>
                    <label className="ucq-label">
                        <input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> 自分の担当のみ（{data.me}）
                    </label>
                    <button className="ucq-btn sec" disabled={busy} onClick={() => { void load(false); showToast('架電キューを読み込み直しました'); }}>🔄 再読み込み</button>
                </div>
                <div className="ucq-body">
                    <div className="ucq-meters">
                        <div className="ucq-meter">
                            <div className="t"><span>今日の架電</span><span>次回架電日が今日</span></div>
                            <div className="v">{kpi.today}<small> 件</small></div>
                        </div>
                        <div className="ucq-meter">
                            <div className="t"><span>今週の架電</span><span>{fmtD(wf)}〜{fmtD(wt).slice(5)}</span></div>
                            <div className="v">{kpi.week}<small> 件</small></div>
                        </div>
                        <div className="ucq-meter">
                            <div className="t"><span>今月の架電</span><span>{Number(data.today.slice(5, 7))}月</span></div>
                            <div className="v">{kpi.month}<small> 件</small></div>
                        </div>
                    </div>

                    <div className="ucq-note">
                        今週・今月の架電は、<b>通電・未通電・SMS送信</b>の記録の数です（{mine ? 'かけた人が自分の分' : 'チーム全員の分'}）。<br />
                        アクションを選んでメモを書き、「記録」を押すと、お客様の架電記録に今日の日付で1件足されます。次回架電日を入れると、その日のキューに並びます。
                    </div>

                    {shown.length === 0 ? (
                        <div className="ucq-empty">
                            本日かける対象はありません。<br />
                            次回架電日が今日以前で、その日以降にまだ架電（通電・未通電・SMS送信）していないお客様が並びます。<br />
                            架電停止のお客様と、契約済み・失注のお客様は並びません。
                        </div>
                    ) : (
                        <>
                            {!nextId && <div className="ucq-note done">🎉 本日ぶんはすべて記録できました（{shown.length}件）。</div>}
                            <div className="ucq-list">{shown.map((c, i) => card(c, i))}</div>
                        </>
                    )}
                </div>
            </div>

            {toast && <div className="ucq-toast" role="status">{toast}</div>}
            <InformationEditResale id={openId} token={token} onClose={closeCustomer} authority={authority} />
        </div>
    );
};

export default UsedCallQueue;
```

### backend/scripts/guide/articles/used/screen-050.md

````markdown
---
title: 今日の架電キュー（中古リノベ）
section: 画面の使い方
sort: 50
summary: 次回架電日が今日までのお客様を並べ、1件ずつ架電を記録する画面（中古リノベ）。
---
左のメニュー「全社報告用フォーマット」の下の「今日の架電キュー」。次回架電日が今日までのお客様が並びます。上から順にかけて、その場で記録していくための画面です。

[[画面:今日の架電キュー（中古リノベ）]]

## 並ぶお客様
- 架電記録の店舗が「買い:中古リノベ」のお客様です
- 最後に入れた**次回架電日が今日以前**で、その日以降にまだ**通電・未通電・SMS送信**を記録していないお客様が並びます
- 次回架電日を過ぎているお客様には「○日超過」、今日の予定のお客様には「今日の予定」の札が付きます。過ぎている日数が多いお客様ほど上に並びます
- 架電ステータスが「架電停止」のお客様と、状況が契約済み・失注のお客様は並びません
- 「自分の担当のみ」に印を付けると、自分が担当のお客様だけになります

> 注意：次回架電日を入れていないお客様は並びません。かけ直す予定のお客様には、記録のときに必ず次回架電日を入れてください。

## 上の数字
- **今日の架電**：次回架電日が今日のお客様の数です
- **今週の架電**：今週（月曜〜日曜）に記録した通電・未通電・SMS送信の数です
- **今月の架電**：今月に記録した通電・未通電・SMS送信の数です
- 「自分の担当のみ」のときは、今日の架電は自分が担当のお客様の分、今週・今月の架電は自分がかけた分です

## 記録する
1. お客様のカードで、アクション（通電・未通電・SMS送信・メール送信・資料郵送）を押して選ぶ（もう一度押すと外れます）
2. メモ欄に、聞き取った内容などを書く
3. 次にかける日が決まっていれば、「次回架電日」に日付を入れる
4. 「記録」を押す

- お客様の架電記録に、今日の日付で1件足されます。顧客DBなどで開くお客様の詳細の架電記録にも、そのまま出ます
- 次回架電日を入れると、その日のキューに並びます
- 記録したカードは「記録済」になり、今日のあいだはキューに残ります。並び順は「再読み込み」を押すまで変わりません
- 「開く」を押すと、お客様の詳細が開きます

> 注意：お客様の詳細を開いたまま、ほかの人がこの画面で同じお客様の記録をすると、詳細を保存したときにその記録が消えることがあります。詳細はこまめに閉じてください。

## 関係する記事
- [[反響が来たら（中古リノベ）]]
````

### backend/scripts/sql/2026-11-03_update_log_2.2.239.sql

```sql
-- =====================================================================
-- v2.2.239 中古リノベの「今日の架電キュー」 ＋ update_log
--   （末尾に業務ガイド「今日の架電キュー（中古リノベ）」の追加）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- ⚠️ 表の変更はない（架電記録は今までどおり call_sheet.call_log。処理は ② の features/callq/usedQueue.ts）
-- =====================================================================

-- 1. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
INSERT INTO update_log (version, date, note) VALUES
('2.2.239', '2026-11-03', '中古リノベの左のメニュー「全社報告用フォーマット」の下に「今日の架電キュー」を追加した。次回架電日が今日までで、まだ架電していないお客様をカードで並べ、アクション（通電・未通電・SMS送信・メール送信・資料郵送）とメモ・次回架電日をその場で記録できる。上には今日（次回架電日が今日）・今週・今月の架電の数を出す。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- used/screen-050.md：今日の架電キュー（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '今日の架電キュー（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('今日の架電キュー（中古リノベ）', 'used', '画面の使い方', '次回架電日が今日までのお客様を並べ、1件ずつ架電を記録する画面（中古リノベ）。', '左のメニュー「全社報告用フォーマット」の下の「今日の架電キュー」。次回架電日が今日までのお客様が並びます。上から順にかけて、その場で記録していくための画面です。

[[画面:今日の架電キュー（中古リノベ）]]

## 並ぶお客様
- 架電記録の店舗が「買い:中古リノベ」のお客様です
- 最後に入れた**次回架電日が今日以前**で、その日以降にまだ**通電・未通電・SMS送信**を記録していないお客様が並びます
- 次回架電日を過ぎているお客様には「○日超過」、今日の予定のお客様には「今日の予定」の札が付きます。過ぎている日数が多いお客様ほど上に並びます
- 架電ステータスが「架電停止」のお客様と、状況が契約済み・失注のお客様は並びません
- 「自分の担当のみ」に印を付けると、自分が担当のお客様だけになります

> 注意：次回架電日を入れていないお客様は並びません。かけ直す予定のお客様には、記録のときに必ず次回架電日を入れてください。

## 上の数字
- **今日の架電**：次回架電日が今日のお客様の数です
- **今週の架電**：今週（月曜〜日曜）に記録した通電・未通電・SMS送信の数です
- **今月の架電**：今月に記録した通電・未通電・SMS送信の数です
- 「自分の担当のみ」のときは、今日の架電は自分が担当のお客様の分、今週・今月の架電は自分がかけた分です

## 記録する
1. お客様のカードで、アクション（通電・未通電・SMS送信・メール送信・資料郵送）を押して選ぶ（もう一度押すと外れます）
2. メモ欄に、聞き取った内容などを書く
3. 次にかける日が決まっていれば、「次回架電日」に日付を入れる
4. 「記録」を押す

- お客様の架電記録に、今日の日付で1件足されます。顧客DBなどで開くお客様の詳細の架電記録にも、そのまま出ます
- 次回架電日を入れると、その日のキューに並びます
- 記録したカードは「記録済」になり、今日のあいだはキューに残ります。並び順は「再読み込み」を押すまで変わりません
- 「開く」を押すと、お客様の詳細が開きます

> 注意：お客様の詳細を開いたまま、ほかの人がこの画面で同じお客様の記録をすると、詳細を保存したときにその記録が消えることがあります。詳細はこまめに閉じてください。

## 関係する記事
- [[反響が来たら（中古リノベ）]]
', 50, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
```

## 既存ファイルの差分

```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 30df9b9b..7d5faeed 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -178,6 +178,7 @@ import type { Result as RealtyResult } from '../features/realty';
 import { runPlannerCompliance, runPlannerSettings, runPlannerState, runPlannerWeekly } from '../features/realty/state';
 import { runImportCheck, runImportFinish, runImportRecords } from '../features/realty/importer';
 import { runCallLogs, runCallLogsImport, runCallMark, runCallUndo, runNaviSave, runPracticeLogsImport } from '../features/realty/calls';
+import { runUsedQueueList, runUsedQueueMark } from '../features/callq/usedQueue';
 import { INQUIRY_CATEGORIES, MASTER_CATEGORIES, runPrivacyEraseInquiry, runPrivacyEraseMaster } from '../features/privacy';
 import type { AuthenticatedStaff } from '../types/staff';
 import type { GatewayContext, GatewayEntry, GatewayKey } from './types';
@@ -1259,6 +1260,12 @@ register({ request: 'planner', roll: 'call_logs', summary: '不動産企画係:
 register({ request: 'planner', roll: 'call_logs_import', summary: '【書き込み】不動産企画係: 以前のアプリの通話記録（CSV）を取り込む（300件まで）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'master', handler: realtyMaster(runCallLogsImport) });
 register({ request: 'planner', roll: 'practice_logs_import', summary: '【書き込み】不動産企画係: 以前のアプリの練習記録（CSV）を取り込む（300件まで）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'master', handler: realtyMaster(runPracticeLogsImport) });
 
+// ⚠️ v2.2.239 新規（② だけ）。中古リノベの今日の架電キュー。features/callq/usedQueue.ts
+//   ⚠️ 担当事業が used / all の人だけ（USED_SHOPS）。⚠️ mark は書き込み（express_proxy.php の expressProxyExclusive() にも入れてある）
+const USED_SHOPS = ['used', 'all'];
+register({ request: 'callq_used', roll: 'list', summary: '中古リノベ: 今日の架電キュー（次回架電日が今日以前の顧客と、今日・今週・今月の架電数）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(USED_SHOPS, (s) => runUsedQueueList(s)) });
+register({ request: 'callq_used', roll: 'mark', summary: '【書き込み】中古リノベ: 架電キューのカードの記録（架電記録に1件足す・次回架電日）', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(USED_SHOPS, (s, body) => runUsedQueueMark(s, body)) });
+
 // ---------------------------------------------------------------------------
 // Claudeによる分析（v2.2.217。Dashboard からの自由分析）— ② のみ（① に PHP 版は無い）
 //
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 380c9991..5dc15fef 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -166,6 +166,9 @@ function expressProxyRequests(): array
         'planner:call_logs',
         'planner:call_logs_import',
         'planner:practice_logs_import',
+        // ⚠️ v2.2.239。中古リノベの今日の架電キュー（② だけ）。expressProxyExclusive() にも入れてある
+        'callq_used:list',
+        'callq_used:mark',
         // ⚠️ v2.2.227。個人情報削除（元に戻せない・② だけ）。expressProxyExclusive() にも入れてある
         'privacy_erase:master:order',
         'privacy_erase:master:spec',
@@ -845,6 +848,9 @@ function expressProxyExclusive(): array
         'planner:call_logs',
         'planner:call_logs_import',
         'planner:practice_logs_import',
+        // v2.2.239 新規。中古リノベの今日の架電キュー（mark は書き込み）。⚠️ ① に PHP ハンドラは無い（② だけ）
+        'callq_used:list',
+        'callq_used:mark',
         // v2.2.227 新規。個人情報削除（元に戻せない）。⚠️ ① に PHP ハンドラは無い（② だけ）
         'privacy_erase:master:order',
         'privacy_erase:master:spec',
diff --git a/frontend/src/App.tsx b/frontend/src/App.tsx
index 4800a07c..bdc0030e 100644
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -50,6 +50,7 @@ import LostAnalysis from "./components/realty/lost/LostAnalysis";
 import RealtyPending from "./components/realty/RealtyPending";
 import CallQueue from "./components/realty/callq/CallQueue";
 import CallNavi from "./components/realty/navi/CallNavi";
+import UsedCallQueue from "./components/callq/UsedCallQueue";
 import Guide from "./components/guide/Guide";
 
 const GOOGLE_MAPS_LIBRARIES: ("marker")[] = ['marker'];
@@ -182,6 +183,8 @@ function AppInner() {
             <Route path="/photo" element={<Photo />} />
             <Route path="/kengakuCloud" element={<KengakuCloud />} />
             <Route path="/insideSales" element={<InsideSales/>} />
+            {/* ⚠️ v2.2.239: 中古リノベの今日の架電キュー */}
+            <Route path="/usedCallQueue" element={<UsedCallQueue />} />
             {/* ⚠️ v2.2.221: 不動産企画係の画面。⚠️ 担当事業が realty / all の人だけ（RealtyRoute）
                 ⚠️⚠️ v2.2.223: URL は**1段**に戻した（v2.2.220 までと同じ）。⚠️ `/realty/summary` のような2段にしないこと。
                   index.html が画面の部品を相対パス（./static/...）で読むため、2段の URL で再読み込みすると
diff --git a/frontend/src/components/Menu.tsx b/frontend/src/components/Menu.tsx
index c8156d74..c6eb6d28 100644
--- a/frontend/src/components/Menu.tsx
+++ b/frontend/src/components/Menu.tsx
@@ -232,6 +232,8 @@ const Menu = ({ key, onReload }: Props) => {
 
     const MENU_CONFIG: MenuItem[] = useMemo(() => [
         { id: 'company', path: '/company', icon: 'fa-rainbow', label: '全社報告用フォーマット', show: category !== 'realty', exact: true },
+        // ⚠️ v2.2.239: 中古リノベの今日の架電キュー（callq/UsedCallQueue.tsx）。⚠️ 不動産企画係の同じ名前の画面は realty/RealtyMenu.tsx
+        { id: 'callq_used', path: '/usedCallQueue', icon: 'fa-phone-volume', label: '今日の架電キュー', show: category === 'used', exact: true },
         // ⚠️ v2.2.225: 不動産企画係（category = realty）の項目は realty/RealtyMenu.tsx に移した（以前のアプリと同じ並び・見出し）
         {
             id: 'list', path: '/list', icon: 'fa-phone', label: '反響一覧', show: (category === 'order' || category === 'spec'), exact: true,
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index 06ff4ffd..6dfd8d82 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -47,6 +47,8 @@ const ADMIN = ['Master', 'BrandAdmin'];
 export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     // ── 左のメニュー（Menu.tsx の MENU_CONFIG と同じ条件）
     '全社報告用フォーマット': { route: '/company', divisions: ['order', 'spec', 'used'] },
+    // ⚠️ v2.2.239。メニューの名前は「今日の架電キュー」。⚠️ 不動産企画係の記事の「今日の架電キュー」にボタンが付かないよう、名前に（中古リノベ）を付けている
+    '今日の架電キュー（中古リノベ）': { route: '/usedCallQueue', divisions: ['used'] },
     '反響一覧': {
         route: { order: '/list', spec: '/list', used: '/list?shop=renove' },
     },
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index e7233b12..02266c45 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.238';
+export const newVersion = '2.2.239';
```
