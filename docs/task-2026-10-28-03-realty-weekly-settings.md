# 2026-10-28 不動産企画係アプリの移植 第3段（v2.2.223）＋ 再読み込みで真っ白になる不具合

## 依頼
- 「次の段へ」（v2.2.222 はデプロイ済み）→ 設定画面・週報・コンプライアンス
- 途中で追加: 「`Uncaught SyntaxError: Unexpected token '<' (at main.6fb9679e.js:1:1)` realty/summary で画面更新したらホワイトアウト。コメントなどの不具合などないか確認を」

## 決めたこと
- 3画面は本番アプリ（V18）の renderSettings / renderWeekly / renderComp をそのまま移す。保存先は `app_state` の3行で、**形は本番アプリと同じ**（切り替えの日にそのまま上書きで取り込む）
- 書き込みは**項目ごと**（設定は項目単位で `JSON_SET`、週次はその月だけ `JSON_SET`、コンプライアンスは15項目なので全体）。
  - settings には契約書の下書き（docDrafts）が入っていて大きくなる。全体を書き戻すと mysql2 の 64KB の不具合に当たる
  - 同時に別の人が別の項目を直しても消し合わない
- 週次の「確定済みの月の目標」を直せる人: 本番アプリは名前（時任さん）で決めていた → **権限がマスター・マネージャーの人**にした
- 架電実績（ca）は保存しない。画面が売り反響の📞架電記録から数える（架電した人。記録に名前が無ければ反響の担当）
- 設定画面で**まだ移さない**カード: 買取再販の粗利方式・経費科目／架電キュー／売主への販売報告／データ管理。それを使う画面と一緒に移す
- 週次の「接触の質」の表（V16）は、架電の結果を記録する「今日の架電キュー」と一緒に移す
- 業務ガイドの画面ボタン（GUIDE_SCREENS）は v2.2.221 と同じく不動産企画係の画面を登録しない（GuideDivision に realty が無い）

## 不具合（真っ白）の原因と直し
- `frontend/package.json` の `"homepage": "./"` で、index.html は `./static/js/main.….js` を**今の URL からの相対**で読む
- v2.2.221 で URL を `/realty/summary` の2段にしたため、再読み込みすると `/dashboard/realty/static/js/main.js` を取りに行き、サーバーが index.html（HTML）を返して `Unexpected token '<'`
- ⚠️ Guide.tsx に同じ注意（「2段の URL にしない」）が既に書いてあった。v2.2.221 で見落とした
- 直し: 不動産企画係の URL を v2.2.220 までの1段に戻した（/summary・/report・/leadSell・/leadBuy・/leadOpportunity・/leadResale・/broker）。新しい3画面も1段（/realtyWeekly・/realtyCompliance・/realtySettings）
  - `/realty/...` は画面の中から移ってきたときだけ1段へ送る（再読み込みでは届かない）
- 同じ原因の既存の不具合: `NewCampaign.tsx` の保存後・一覧へ戻るの移動先 `/campaign/?brand=…`（末尾の `/`）→ `/campaign?brand=…`
- ほかの移動先（navigate・Link・location）には2段・末尾 `/` は無かった

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/realty | **state.ts（新規）** | runPlannerState / runPlannerSettings / runPlannerWeekly / runPlannerCompliance |
| backend-express/src/gateway | registry.ts | planner:state / settings / weekly / compliance を登録 |
| backend/src/core | express_proxy.php | 上の4つを expressProxyRequests() と expressProxyExclusive() の両方に |
| frontend/src/components/realty/common | **realtyState.ts（新規）** | 読み書き・週次の集計（weeklySellCalls・weeklyRowsOf・isOpenMonth・rateClass ほか）・共通 CSS |
| frontend/src/components/realty/settings | **RealtySettings.tsx（新規）** | 設定 |
| frontend/src/components/realty/weekly | **WeeklyPlan.tsx（新規）** | 週次行動計画・実績 |
| frontend/src/components/realty/compliance | **Compliance.tsx（新規）** | コンプライアンス・法令チェックリスト |
| frontend/src | App.tsx | ルートを1段に戻す・3画面を追加 |
| frontend/src/components | Menu.tsx・Category.tsx | 1段の URL・メニュー3つ |
| frontend/src/components/campaign | NewCampaign.tsx | `/campaign/?` → `/campaign?` |
| frontend/src/utils | version.ts | 2.2.223 |
| backend/scripts/sql | 2026-10-28_update_log_2.2.223.sql（新規） | 更新履歴＋記事5本。ローカルに流した（no=323） |
| backend/scripts/guide/articles/common | screen-250/260/270.md（新規）・screen-230/240.md | 記事 |

## 業務ガイドの記事
- 新規「週次行動計画（不動産企画係）」「コンプライアンス（不動産企画係）」「設定（不動産企画係）」
- 「不動産企画係の画面（入口と権限）」: 画面の一覧に3つ追加。ブックマークの節を「アドレスは以前と同じ形。/realty/… でブックマークした人は付け直す」に
- 「チームサマリー（不動産企画係）」: 「設定画面は次の版で」→ 設定へのリンク。「以前のアプリと見比べる」→「全データを取り込んだあと」（2026-10-28 の指示）

## 確認したこと
- ① を通してトークン無しで4つとも 401（② まで届く）
- ① を通した API（テスト用の担当者3人。終わってから消した）
  - 注文の人は 403。マネージャーだけ isWeeklyAdmin = true
  - 設定: 単価の保存（0 は持たない）、docDrafts と他の項目はそのまま、docDrafts を送ると 400、期首の形違い 400、担当者11名 400
  - 週次: 今月の目標 200（16行＝4人×4週）、ca を送ると 400、文字 400、設定に無い担当 400、確定済みの月の目標は一般 403・マネージャー 200、実績は一般でも 200、他の月は残る
  - コンプライアンス: 状態 200、知らない状態 400、文言（item）400、クリアで入力が0・文言は残る
- 本番と同じ形の配信（/dashboard 配下・無いファイルは index.html）でビルドを直接開いた: 1段の URL はすべて表示、`/realty/summary` と `/campaign/?brand=kh` はいただいたものと同じ `Unexpected token '<'`（再現）
- Playwright（開発サーバー）: 3画面の表示、設定の保存（今月目標・反響元の追加と外す）、週次の保存・小数を弾く・確定済みの月の🔒と読み取り専用・テスト反響を消して再集計すると架電実績が1→0、コンプライアンスの状態・備考・クリア、ページのエラー無し
- 片付け後、app_state の3行は長さ・更新日時ともテスト前と同じ
- 型チェック（②）・本番ビルド（フロント）
- 整理: state.ts の外から使わない関数の export を外した → もう一度 API と画面のテストを通した

## コード

### backend-express/src/features/realty/state.ts（新規・全文）
```tsx
import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../../db/pool';
import type { Tx } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import type { Result } from './index';

/**
 * 不動産企画係の設定・週次行動計画・コンプライアンス（v2.2.223。② だけにある）。
 *
 * ─────────────────────────────────────────────
 * 保存先は app_state の3行（本番アプリの Supabase app_state と同じ形）。
 *   settings   … 期首年月・担当者と目標・反響元・買いポータル・反響単価・テンプレート・宅建業者情報 など
 *   weekly     … { 'YYYY-MM': [{ week, staff, cg, ca, tg, ta, ng, na, sg, sa }, …] }
 *   compliance … [{ id, no, item, staff, date, status, target, note }, …]
 * ⚠️ 形を変えないこと。切り替えの日に本番アプリ（Supabase）から**そのまま上書きで取り込む**。
 *
 * ⚠️⚠️ 書き込みは**項目ごと**に JSON_SET で差し込む（全体を読んで書き戻さない）。
 *   ・settings には契約書の下書き（docDrafts）も入っていて大きくなる。全体を書き戻すと
 *     mysql2 の 64KB の不具合（db/pool.ts の executeLarge の注記）に当たる
 *   ・同時に別の人が別の項目を直しても、互いに消し合わない
 *
 * ⚠️ 週次行動計画の「架電実績（ca）」は保存しない。画面が売り反響の架電記録から数える（本番アプリと同じく手入力不可）。
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

// ---------------------------------------------------------------------------
// 日付（⚠️ 日本時間で判断する。② のサーバーの時計の時刻帯に左右されないように）
// ---------------------------------------------------------------------------

/** 日本時間の 'YYYY-MM-DD' */
const jstToday = (now = new Date()): string => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

const prevMonthKey = (mk: string): string => {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** 翌月のこの日までは、前月の目標も直せる（本番アプリの LOCK_GRACE_DAY） */
const LOCK_GRACE_DAY = 5;

/** 目標を誰でも直せる月か（本番アプリの wOpenMonth）。今月以降と、5日までの前月 */
const isOpenMonth = (mk: string, today = jstToday()): boolean => {
  const cur = today.slice(0, 7);
  if (mk >= cur) return true;
  return mk === prevMonthKey(cur) && Number(today.slice(8, 10)) <= LOCK_GRACE_DAY;
};

/**
 * 確定済みの月の目標も直せる人（本番アプリの WEEKLY_ADMINS = 時任 さん）。
 * ⚠️ Dashboard では名前ではなく権限で決める: マスター・マネージャー
 */
const WEEKLY_ADMIN_AUTHORITIES = ['Master', 'Manager'];
const isWeeklyAdmin = (staff: AuthenticatedStaff): boolean => WEEKLY_ADMIN_AUTHORITIES.includes(staff.brand);

// ---------------------------------------------------------------------------
// 読み出し
// ---------------------------------------------------------------------------

const STATE_DEFAULTS = { settings: '{}', weekly: '{}', compliance: '[]' } as const;
type StateKey = keyof typeof STATE_DEFAULTS;

/** 行が無ければ空で作る（JSON_SET は行が無いと何もしないため） */
const ensureStateRow = (tx: Tx, key: StateKey) =>
  tx.execute('INSERT IGNORE INTO app_state (`key`, `data`) VALUES (?, ?)', [key, STATE_DEFAULTS[key]]);

/**
 * 3画面の元データ。
 * ⚠️ 売り反響（kind = leads）は週次行動計画の架電実績を数えるためだけに返す（id・担当・架電記録だけ）。
 * ⚠️ 削除済み（show_dashboard = 0）は数えない（画面の isSoftDeleted と同じ）。
 */
export const runPlannerState = async (staff: AuthenticatedStaff): Promise<Result> => {
  const [states, sellLeads] = await Promise.all([
    query<DynamicRow>("SELECT `key`, `data` FROM app_state WHERE `key` IN ('settings', 'weekly', 'compliance')"),
    query<DynamicRow>(
      "SELECT `id`, `staff`, `callDates` FROM brokerage_listings WHERE kind = 'leads' AND (show_dashboard IS NULL OR show_dashboard <> 0)"
    ),
  ]);
  const byKey = (key: StateKey, fallback: unknown) => {
    const parsed = parseJson(states.find((r) => r.key === key)?.data);
    return parsed === null ? fallback : parsed;
  };
  const settings = byKey('settings', {});
  const weekly = byKey('weekly', {});
  const compliance = byKey('compliance', []);
  return ok({
    status: 'success',
    settings: isObject(settings) ? settings : {},
    weekly: isObject(weekly) ? weekly : {},
    compliance: Array.isArray(compliance) ? compliance : [],
    sellLeads,
    isWeeklyAdmin: isWeeklyAdmin(staff),
    today: jstToday(),
  });
};

// ---------------------------------------------------------------------------
// 設定（planner:settings）
// ---------------------------------------------------------------------------

class InvalidInput extends Error {}

const text = (v: unknown, max: number, label: string): string => {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'string' && typeof v !== 'number') throw new InvalidInput(`${label}が文字ではありません`);
  const s = String(v).trim();
  if (s.length > max) throw new InvalidInput(`${label}は${max}文字までです`);
  return s;
};

/** 0 以上の整数（円・件）。空は 0 */
const amount = (v: unknown, label: string): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1e12) throw new InvalidInput(`${label}は0以上の数で入力してください`);
  return Math.round(n);
};

const nameList = (v: unknown, label: string): string[] => {
  if (!Array.isArray(v) || v.length > 100) throw new InvalidInput(`${label}の形が正しくありません`);
  const out: string[] = [];
  for (const item of v) {
    const s = text(item, 50, label);
    if (s !== '' && !out.includes(s)) out.push(s);
  }
  return out;
};

const costMap = (v: unknown, label: string): Record<string, number> => {
  if (!isObject(v)) throw new InvalidInput(`${label}の形が正しくありません`);
  const out: Record<string, number> = {};
  for (const [k, raw] of Object.entries(v)) {
    const n = amount(raw, label);
    if (n > 0) out[text(k, 50, label)] = n; // ⚠️ 0 は「未設定」なので持たない（本番アプリの costSet と同じ）
  }
  return out;
};

const COMPANY_FIELDS = ['name', 'rep', 'dept', 'addr', 'tel', 'fax', 'license', 'assoc', 'agent', 'agentNo'] as const;

/**
 * 画面から直せる設定の項目と、その確かめ方。
 * ⚠️ ここに無い項目（docDrafts・resaleGpMode・resaleCostSets・mailNotify など）は受け付けない。
 *   それらを使う画面を移すときに足す。
 */
const SETTINGS_FIELDS: Record<string, (v: unknown) => unknown> = {
  fiscalStart: (v) => {
    const s = text(v, 7, '期首年月');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) throw new InvalidInput('期首年月は YYYY-MM で入力してください');
    return s;
  },
  staff: (v) => {
    if (!Array.isArray(v)) throw new InvalidInput('担当者の形が正しくありません');
    if (v.length > 10) throw new InvalidInput('担当者は10名までです');
    return v.map((raw, i) => {
      if (!isObject(raw)) throw new InvalidInput('担当者の形が正しくありません');
      const label = `担当者${i + 1}行目の`;
      return {
        id: text(raw.id, 40, `${label}ID`),
        name: text(raw.name, 30, `${label}担当者名`),
        abbr: text(raw.abbr, 10, `${label}略称`),
        budget: amount(raw.budget, `${label}年間予算`),
        monthlyGoal: amount(raw.monthlyGoal, `${label}今月目標売上`),
        baikaiTarget: amount(raw.baikaiTarget, `${label}年間媒介目標`),
      };
    });
  },
  sources: (v) => nameList(v, '反響元'),
  buyPortals: (v) => nameList(v, '買いポータル'),
  srcCosts: (v) => costMap(v, '反響単価（売り）'),
  portalCosts: (v) => costMap(v, '反響単価（買い）'),
  templates: (v) => {
    if (!Array.isArray(v)) throw new InvalidInput('テンプレートの形が正しくありません');
    if (v.length > 30) throw new InvalidInput('テンプレートは30件までです');
    return v.map((raw) => {
      if (!isObject(raw)) throw new InvalidInput('テンプレートの形が正しくありません');
      return { id: text(raw.id, 40, 'テンプレートのID'), title: text(raw.title, 100, 'テンプレート名'), body: text(raw.body, 5000, 'テンプレートの本文') };
    });
  },
  company: (v) => {
    if (!isObject(v)) throw new InvalidInput('宅建業者情報の形が正しくありません');
    const out: Record<string, string> = {};
    for (const f of COMPANY_FIELDS) out[f] = text(v[f], 200, '宅建業者情報');
    return out;
  },
};

/** body.patch = { 項目: 新しい値 }。項目ごとに確かめてから差し込む */
export const runPlannerSettings = async (body: Record<string, unknown>): Promise<Result> => {
  if (!isObject(body.patch) || Object.keys(body.patch).length === 0) return fail(400, '保存する項目がありません');
  const entries: [string, unknown][] = [];
  try {
    for (const [key, value] of Object.entries(body.patch)) {
      const check = SETTINGS_FIELDS[key];
      if (!check) return fail(400, `この項目はここでは保存できません: ${key}`);
      entries.push([key, check(value)]);
    }
  } catch (e) {
    if (e instanceof InvalidInput) return fail(400, e.message);
    throw e;
  }

  const settings = await withTransaction(async (tx) => {
    await ensureStateRow(tx, 'settings');
    for (const [key, value] of entries) {
      // ⚠️ 項目名は SETTINGS_FIELDS のキーだけ（英字のみ）なのでパスに埋め込んでよい
      await tx.execute(
        `UPDATE app_state SET \`data\` = JSON_SET(\`data\`, '$.${key}', JSON_EXTRACT(?, '$')) WHERE \`key\` = 'settings'`,
        [JSON.stringify(value)]
      );
    }
    const rows = await tx.query<DynamicRow>("SELECT `data` FROM app_state WHERE `key` = 'settings'");
    return parseJson(rows[0]?.data);
  });
  return ok({ status: 'success', settings: isObject(settings) ? settings : {} });
};

// ---------------------------------------------------------------------------
// 週次行動計画（planner:weekly）
// ---------------------------------------------------------------------------

/** 目標（黄色のセル）。確定済みの月は管理者だけ */
const GOAL_KEYS = ['cg', 'tg', 'ng', 'sg'];
/** 実績（白のセル）。⚠️ 架電実績 ca は自動集計なので受け付けない。⚠️ 本番アプリの LOCK_ACTUALS = false（実績はいつでも直せる） */
const ACTUAL_KEYS = ['ta', 'na', 'sa'];
const WEEKLY_MAX = 99999;

type WeeklyRow = { week: number; staff: string; [key: string]: unknown };

const emptyWeeklyRow = (week: number, staff: string): WeeklyRow =>
  ({ week, staff, cg: 0, ca: 0, tg: 0, ta: 0, ng: 0, na: 0, sg: 0, sa: 0 });

/**
 * 1か月の行を、設定の担当者 × 第1〜4週がそろうように足す（本番アプリの ensureWeekly）。
 * ⚠️ 設定から外した担当者の行は消さない（過去の実績を残すため）。
 */
const ensureWeeklyRows = (rows: WeeklyRow[], staffNames: string[]): WeeklyRow[] => {
  const out = rows.slice();
  for (let w = 1; w <= 4; w++) {
    for (const s of staffNames) {
      if (!out.some((r) => r.week === w && r.staff === s)) out.push(emptyWeeklyRow(w, s));
    }
  }
  return out;
};

const settingsStaffNames = (raw: unknown): string[] => {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((s) => (isObject(s) ? String(s.name ?? '').trim() : ''))
    .filter((n) => n !== '');
};

/**
 * body = { month: 'YYYY-MM', cells: [{ week, staff, key, value }, …] }。
 * ⚠️ 前週コピーもこれで送る（画面が値を組み立てる）。
 */
export const runPlannerWeekly = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Result> => {
  const month = typeof body.month === 'string' ? body.month : '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return fail(400, '対象月が正しくありません');
  if (!Array.isArray(body.cells) || body.cells.length === 0 || body.cells.length > 400) return fail(400, '保存する値がありません');

  const cells: { week: number; staff: string; key: string; value: number }[] = [];
  for (const raw of body.cells) {
    if (!isObject(raw)) return fail(400, '保存する値の形が正しくありません');
    const week = Number(raw.week);
    const key = String(raw.key ?? '');
    const value = raw.value === '' || raw.value === null || raw.value === undefined ? 0 : Number(raw.value);
    if (![1, 2, 3, 4].includes(week)) return fail(400, '週が正しくありません');
    if (key === 'ca') return fail(400, '架電実績は売り反響の架電記録から自動集計されます（手入力不可）');
    if (!GOAL_KEYS.includes(key) && !ACTUAL_KEYS.includes(key)) return fail(400, '項目が正しくありません');
    if (!Number.isInteger(value) || value < 0 || value > WEEKLY_MAX) return fail(400, `半角の整数（0〜${WEEKLY_MAX}）で入力してください`);
    cells.push({ week, staff: String(raw.staff ?? ''), key, value });
  }

  if (cells.some((c) => GOAL_KEYS.includes(c.key)) && !isOpenMonth(month) && !isWeeklyAdmin(staff)) {
    return fail(403, '確定済みの月のため編集できません（管理者のみ変更可）');
  }

  const result = await withTransaction(async (tx) => {
    await ensureStateRow(tx, 'weekly');
    // ⚠️ FOR UPDATE: 同じ月を同時に保存したとき、後の人が先の人の値を消さないように
    const [state] = await tx.query<DynamicRow>(
      "SELECT JSON_EXTRACT(`data`, ?) AS month_rows FROM app_state WHERE `key` = 'weekly' FOR UPDATE",
      [`$."${month}"`]
    );
    const [settingsRow] = await tx.query<DynamicRow>(
      "SELECT JSON_EXTRACT(`data`, '$.staff') AS staff FROM app_state WHERE `key` = 'settings'"
    );
    const names = settingsStaffNames(settingsRow?.staff);
    const current = parseJson(state?.month_rows);
    const rows = ensureWeeklyRows(Array.isArray(current) ? (current as WeeklyRow[]) : [], names);

    for (const c of cells) {
      const row = rows.find((r) => r.week === c.week && r.staff === c.staff);
      if (!row) return null; // 設定に無い担当者
      row[c.key] = c.value;
    }
    await tx.execute(
      "UPDATE app_state SET `data` = JSON_SET(`data`, ?, JSON_EXTRACT(?, '$')) WHERE `key` = 'weekly'",
      [`$."${month}"`, JSON.stringify(rows)]
    );
    return rows;
  });
  if (result === null) return fail(400, '設定に無い担当者です。設定画面の担当者を確かめてください');
  return ok({ status: 'success', month, rows: result });
};

// ---------------------------------------------------------------------------
// コンプライアンス（planner:compliance）
// ---------------------------------------------------------------------------

const COMP_STATES = ['', '✅完了', '⏳確認中', '❌未対応', '➖対象外'];
const COMP_FIELDS = ['staff', 'date', 'status', 'target', 'note'];

/**
 * body = { id, field, value } で1か所を直す。body = { reset: true } で全項目の入力を消す（本番アプリの resetComp）。
 * ⚠️ チェック項目（item）と並び（no）は直せない（本番アプリにも画面が無い）。
 */
export const runPlannerCompliance = async (body: Record<string, unknown>): Promise<Result> => {
  const reset = body.reset === true;
  const id = typeof body.id === 'string' ? body.id : '';
  const field = typeof body.field === 'string' ? body.field : '';
  let value = '';
  if (!reset) {
    if (id === '') return fail(400, 'IDがありません');
    if (!COMP_FIELDS.includes(field)) return fail(400, '項目が正しくありません');
    try {
      value = text(body.value, 200, '入力');
    } catch (e) {
      if (e instanceof InvalidInput) return fail(400, e.message);
      throw e;
    }
    if (field === 'status' && !COMP_STATES.includes(value)) return fail(400, '状態が正しくありません');
    if (field === 'date' && value !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fail(400, '確認日が正しくありません');
  }

  const result = await withTransaction(async (tx) => {
    await ensureStateRow(tx, 'compliance');
    const [state] = await tx.query<DynamicRow>("SELECT `data` FROM app_state WHERE `key` = 'compliance' FOR UPDATE");
    const parsed = parseJson(state?.data);
    const items = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
    if (reset) {
      for (const c of items) for (const f of COMP_FIELDS) c[f] = '';
    } else {
      const item = items.find((c) => c.id === id);
      if (!item) return null;
      item[field] = value;
    }
    // ⚠️ 15項目・数KBなので全体を書き戻す
    await tx.execute("UPDATE app_state SET `data` = ? WHERE `key` = 'compliance'", [JSON.stringify(items)]);
    return items;
  });
  if (result === null) return fail(404, 'チェック項目が見つかりません');
  return ok({ status: 'success', compliance: result });
};
```

### frontend/src/components/realty/common/realtyState.ts（新規・全文）
```tsx
/**
 * 不動産企画係の設定・週次行動計画・コンプライアンス（v2.2.223）の読み書きと、画面どうしで使う集計。
 *
 * ⚠️ 保存先は app_state（② の features/realty/state.ts）。形は本番アプリ（khf-eigyokanri.netlify.app。V18）と同じ。
 * ⚠️ 書き込みは**項目ごと**（設定は項目単位・週次はセル単位・コンプライアンスは1か所ずつ）。
 *   同時に別の人が別の項目を直しても消し合わない。
 */
import apiClient from '../../../utils/apiClient';
import { callsOf, prevMonth } from '../summary/kpi';
import type { Row, StaffSetting } from '../summary/kpi';

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
type ApiBody = { status?: string; message?: string; [key: string]: unknown };

/** 失敗のときは ② のメッセージを投げる（画面は alert で出す） */
const post = async (roll: string, body: Record<string, unknown> = {}): Promise<ApiBody> => {
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
```

### frontend/src/components/realty/settings/RealtySettings.tsx（新規・全文）
```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    REALTY_CSS, loadRealtyState, newId, saveRealtySettings,
} from '../common/realtyState';
import type { Company, RealtySettings as Settings, Template } from '../common/realtyState';
import type { StaffSetting } from '../summary/kpi';

/**
 * 設定（不動産企画係。v2.2.223）。
 *
 * ⚠️ 移植元は本番アプリの「⚙ 設定・データ管理」（renderSettings）。ここを直すと、チームサマリーなど全画面に反映される。
 * ⚠️ 保存は**入力欄を離れたとき**に、その項目だけ（② の planner:settings）。
 * ⚠️ 本番アプリの次のカードはまだ移していない（それを使う画面と一緒に移す）:
 *   買取再販の粗利の計算方式・経費科目マスタ／架電キュー／売主への販売報告／データ管理（バックアップ・CSV）
 */

const MAX_STAFF = 10;
const MAX_TEMPLATES = 30;

/** 宅建業者情報の欄（本番アプリの DEFAULT_COMPANY と同じ並び） */
const COMPANY_FIELDS: { key: keyof Company; label: string; wide?: boolean; placeholder?: string }[] = [
    { key: 'name', label: '商号', wide: true },
    { key: 'rep', label: '代表者（役職・氏名）', placeholder: '代表取締役　○○ ○○' },
    { key: 'dept', label: '部署' },
    { key: 'addr', label: '所在地', wide: true, placeholder: '鹿児島県○○市○○町0-0-0' },
    { key: 'tel', label: 'TEL' },
    { key: 'fax', label: 'FAX' },
    { key: 'license', label: '免許証番号', wide: true, placeholder: '鹿児島県知事（　）第　　　号' },
    { key: 'assoc', label: '加入協会・保証協会', wide: true },
    { key: 'agent', label: '宅地建物取引士（既定）', placeholder: '氏名' },
    { key: 'agentNo', label: '取引士登録番号' },
];

const STYLE = `
.rlt-set-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px 16px; }
.rlt-set-grid .wide { grid-column: span 2; }
.rlt-set-grid label { display: block; font-size: 11px; color: #6c757d; margin-bottom: 2px; }
.rlt-set-grid input { width: 100%; }
.rlt-set-tpl { border: 1px solid #e9ecef; border-radius: 6px; padding: 8px; margin-bottom: 8px; }
.rlt-set-tpl textarea { width: 100%; margin-top: 6px; font-size: 12px; }
.rlt-set-costs { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
.rlt-set-costs .rlt-tbl { width: auto; }
@media (max-width: 600px) { .rlt-set-grid .wide { grid-column: span 1; } }
`;

type Key = keyof Settings;

const RealtySettings: React.FC = () => {
    const [settings, setSettings] = useState<Settings>({});
    const [loading, setLoading] = useState(true);
    const [savedAt, setSavedAt] = useState('');
    const [newSource, setNewSource] = useState('');
    const [newPortal, setNewPortal] = useState('');
    // ⚠️ 入力欄を離れたときに「最新の値」を送るため、描画を待たずに読める写しを持つ
    const latest = useRef<Settings>({});
    // ⚠️ 打っただけで離れていない項目。離れたときにだけ送る（打つたびに送らない）
    const dirty = useRef<Set<Key>>(new Set());

    useEffect(() => {
        loadRealtyState()
            .then(st => { latest.current = st.settings; setSettings(st.settings); })
            .catch((e: Error) => alert(`設定を読み込めませんでした: ${e.message}`))
            .finally(() => setLoading(false));
    }, []);

    /** 画面の値だけ変える（保存はしない） */
    const edit = useCallback(<K extends Key>(key: K, value: Settings[K]) => {
        latest.current = { ...latest.current, [key]: value };
        dirty.current.add(key);
        setSettings(latest.current);
    }, []);

    /** その項目を保存する。⚠️ 失敗したら保存済みの値に戻す */
    const persist = useCallback(async (key: Key) => {
        if (!dirty.current.has(key)) return;
        dirty.current.delete(key);
        try {
            const saved = await saveRealtySettings({ [key]: latest.current[key] });
            // ⚠️ 保存中に別の項目を打ち始めていたら、その項目は画面の値を残す
            const merged: Settings = { ...saved };
            dirty.current.forEach(k => { (merged as Record<string, unknown>)[k] = latest.current[k]; });
            latest.current = merged;
            setSettings(merged);
            setSavedAt(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        } catch (e) {
            alert(`保存できませんでした: ${(e as Error).message}`);
            const st = await loadRealtyState().catch(() => null);
            if (st) { latest.current = st.settings; setSettings(st.settings); }
        }
    }, []);

    /** 変えてすぐ保存する（追加・削除・選択など） */
    const editAndSave = useCallback(<K extends Key>(key: K, value: Settings[K]) => {
        edit(key, value);
        void persist(key);
    }, [edit, persist]);

    const staff = settings.staff ?? [];
    const sources = settings.sources ?? [];
    const buyPortals = settings.buyPortals ?? [];
    const templates = settings.templates ?? [];
    const company = settings.company ?? {};

    const setStaff = (i: number, field: keyof StaffSetting, value: string | number) =>
        edit('staff', staff.map((s, j) => (j === i ? { ...s, [field]: value } : s)));

    const addStaff = () => {
        if (staff.length >= MAX_STAFF) { alert(`担当者は${MAX_STAFF}名までです`); return; }
        editAndSave('staff', [...staff, { id: newId(), name: '', abbr: '', budget: 0, monthlyGoal: 0, baikaiTarget: 0 }]);
    };
    const removeStaff = (i: number) => {
        if (!window.confirm(`${staff[i].name || 'この担当者'} を削除しますか？（案件・台帳のデータは残ります）`)) return;
        editAndSave('staff', staff.filter((_, j) => j !== i));
    };

    const addName = (key: 'sources' | 'buyPortals', value: string, clear: () => void) => {
        const v = value.trim();
        if (!v) return;
        const list = key === 'sources' ? sources : buyPortals;
        if (list.includes(v)) { alert('既に登録されています'); return; }
        editAndSave(key, [...list, v]);
        clear();
    };

    const setCost = (key: 'srcCosts' | 'portalCosts', name: string, raw: string) => {
        const next = { ...(settings[key] ?? {}) };
        const n = Number(raw) || 0;
        if (n > 0) next[name] = n; else delete next[name];
        edit(key, next);
    };

    const setTemplate = (i: number, field: keyof Template, value: string) =>
        edit('templates', templates.map((t, j) => (j === i ? { ...t, [field]: value } : t)));
    const addTemplate = () => {
        if (templates.length >= MAX_TEMPLATES) { alert(`テンプレートは${MAX_TEMPLATES}件までです`); return; }
        editAndSave('templates', [...templates, { id: newId(), title: '新しいテンプレート', body: '' }]);
    };
    const removeTemplate = (i: number) => {
        if (!window.confirm(`「${templates[i].title || 'このテンプレート'}」を削除しますか？`)) return;
        editAndSave('templates', templates.filter((_, j) => j !== i));
    };

    if (loading) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const numInput = (value: number | undefined, onChange: (v: number) => void, onBlur: () => void, width: number) => (
        <input
            type="number" min={0} className="rlt-input" style={{ width, textAlign: 'right' }}
            value={value || ''} placeholder="0"
            onChange={e => onChange(Number(e.target.value) || 0)} onBlur={onBlur}
        />
    );

    return (
        <div className="rlt-page">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-gear me-2" style={{ color: '#0d6efd' }}></i>設定</h1>
                <p className="rlt-sub">担当者・反響元・期首年月はここで管理すると全画面に反映されます。入力欄を離れると保存します。</p>
                {savedAt && <span className="rlt-saved"><i className="fa-solid fa-check me-1"></i>{savedAt} 保存しました</span>}
            </div>

            <div className="rlt-alert">
                <b>切り替えまでの注意：</b>以前のアプリから全データを取り込むとき、ここでの設定は以前のアプリの設定で上書きされます。切り替えまでは、設定の変更は以前のアプリでも行ってください。
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>期首年月</h3><span className="rlt-note">この月から12か月を集計対象とします（年度切替時のみ変更）</span></div>
                <div className="rlt-body">
                    <input
                        type="month" className="rlt-input" value={settings.fiscalStart ?? ''}
                        onChange={e => e.target.value && editAndSave('fiscalStart', e.target.value)}
                    />
                </div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>担当者（{MAX_STAFF}名まで）</h3><span className="rlt-note">略称は媒介台帳の担当欄と照合します（1文字でも違うと集計されません）</span></div>
                <div className="rlt-tblwrap">
                    <table className="rlt-tbl">
                        <thead><tr>
                            <th>No.</th><th>担当者名</th><th>略称（台帳照合用）</th>
                            <th className="r">年間予算(円)</th><th className="r">今月目標売上(円)</th><th className="r">年間媒介目標(件)</th><th></th>
                        </tr></thead>
                        <tbody>
                            {staff.map((s, i) => (
                                <tr key={s.id || i}>
                                    <td>{i + 1}</td>
                                    <td><input className="rlt-input" value={s.name ?? ''} onChange={e => setStaff(i, 'name', e.target.value)} onBlur={() => persist('staff')} /></td>
                                    <td><input className="rlt-input" style={{ width: 90 }} value={s.abbr ?? ''} onChange={e => setStaff(i, 'abbr', e.target.value)} onBlur={() => persist('staff')} /></td>
                                    <td className="r">{numInput(s.budget, v => setStaff(i, 'budget', v), () => persist('staff'), 130)}</td>
                                    <td className="r">{numInput(s.monthlyGoal, v => setStaff(i, 'monthlyGoal', v), () => persist('staff'), 130)}</td>
                                    <td className="r">{numInput(s.baikaiTarget, v => setStaff(i, 'baikaiTarget', v), () => persist('staff'), 90)}</td>
                                    <td><button className="rlt-icon" title="削除" onClick={() => removeStaff(i)}><i className="fa-solid fa-trash"></i></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="rlt-body" style={{ paddingTop: 10 }}>
                    <button className="rlt-btn sec" onClick={addStaff}>＋ 担当者を追加</button>
                </div>
            </div>

            {([
                ['sources', '反響元マスタ', '売り反響・媒介台帳の反響元の候補', sources, newSource, setNewSource, '反響元名を追加'],
                ['buyPortals', '買いポータルマスタ', '買い反響の反響元の候補', buyPortals, newPortal, setNewPortal, 'ポータル名を追加'],
            ] as const).map(([key, title, note, list, value, setValue, placeholder]) => (
                <div className="rlt-card" key={key}>
                    <div className="rlt-card-head"><h3>{title}</h3><span className="rlt-note">{note}</span></div>
                    <div className="rlt-body">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {list.map(name => (
                                <span className="rlt-chip" key={name}>
                                    {name}
                                    <button className="rlt-icon" title="外す" onClick={() => editAndSave(key, list.filter(x => x !== name))}>✕</button>
                                </span>
                            ))}
                        </div>
                        <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                            <input
                                className="rlt-input" style={{ width: 180 }} placeholder={placeholder} value={value}
                                onChange={e => setValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addName(key, value, () => setValue('')); }}
                            />
                            <button className="rlt-btn sec" onClick={() => addName(key, value, () => setValue(''))}>追加</button>
                        </div>
                    </div>
                </div>
            ))}

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>反響単価設定（1件あたり）</h3><span className="rlt-note">各サイトの反響1件あたりの仕入単価（円）。チームサマリーの反響費用と獲得単価に使います。空欄＝未設定（0円扱い）</span></div>
                <div className="rlt-body rlt-set-costs">
                    {([
                        ['srcCosts', '売り：一括査定サイト等（反響元マスタ）', '反響元', sources],
                        ['portalCosts', '買い：ポータルサイト（買いポータルマスタ）', 'ポータル', buyPortals],
                    ] as const).map(([key, title, col, names]) => (
                        <div key={key}>
                            <div className="rlt-note" style={{ fontWeight: 'bold', marginBottom: 4 }}>{title}</div>
                            <table className="rlt-tbl">
                                <thead><tr><th>{col}</th><th className="r">単価(円/件)</th></tr></thead>
                                <tbody>
                                    {names.map(name => (
                                        <tr key={name}>
                                            <td>{name}</td>
                                            <td className="r">
                                                <input
                                                    type="number" min={0} className="rlt-input" style={{ width: 110, textAlign: 'right' }}
                                                    placeholder="未設定" value={settings[key]?.[name] || ''}
                                                    onChange={e => setCost(key, name, e.target.value)} onBlur={() => persist(key)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head">
                    <h3>営業テンプレート（定型文）</h3>
                    <span className="rlt-note">差込キーワード：{'{{name}}'}=顧客名／{'{{staff}}'}=担当者／{'{{addr}}'}=物件所在地／{'{{property}}'}=問合せ物件／{'{{price}}'}=価格・予算／{'{{today}}'}=本日</span>
                </div>
                <div className="rlt-body">
                    {templates.map((t, i) => (
                        <div className="rlt-set-tpl" key={t.id || i}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input className="rlt-input" style={{ flex: 1 }} placeholder="テンプレート名" value={t.title}
                                    onChange={e => setTemplate(i, 'title', e.target.value)} onBlur={() => persist('templates')} />
                                <button className="rlt-icon" title="削除" onClick={() => removeTemplate(i)}><i className="fa-solid fa-trash"></i></button>
                            </div>
                            <textarea className="rlt-input" rows={5} value={t.body}
                                onChange={e => setTemplate(i, 'body', e.target.value)} onBlur={() => persist('templates')} />
                        </div>
                    ))}
                    {templates.length === 0 && <p className="rlt-sub">テンプレートが登録されていません</p>}
                    <button className="rlt-btn sec" onClick={addTemplate}>＋ テンプレートを追加</button>
                    <p className="rlt-sub" style={{ marginTop: 6 }}>※テンプレートはチーム全員で共有されます</p>
                </div>
            </div>

            <div className="rlt-card">
                <div className="rlt-card-head"><h3>宅建業者情報（契約書の「乙」欄）</h3><span className="rlt-note">契約書の乙欄・記名押印欄に印字されます。チーム全員で共有されます</span></div>
                <div className="rlt-body rlt-set-grid">
                    {COMPANY_FIELDS.map(f => (
                        <div key={f.key} className={f.wide ? 'wide' : ''}>
                            <label>{f.label}</label>
                            <input className="rlt-input" placeholder={f.placeholder} value={company[f.key] ?? ''}
                                onChange={e => edit('company', { ...company, [f.key]: e.target.value })} onBlur={() => persist('company')} />
                        </div>
                    ))}
                </div>
            </div>

            <p className="rlt-sub">
                以前のアプリの「買取再販の粗利の計算方式・経費科目」「架電キュー」「売主への販売報告」「データ管理」は、それを使う画面と一緒に、のちの版で移します。
            </p>
        </div>
    );
};

export default RealtySettings;
```

### frontend/src/components/realty/weekly/WeeklyPlan.tsx（新規・全文）
```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    GOAL_KEYS, LOCK_GRACE_DAY, REALTY_CSS, WCOLS, isOpenMonth, loadRealtyState, rateAverage, rateClass, rateTitle,
    saveWeeklyCells, weeklyRowsOf, weeklySellCalls,
} from '../common/realtyState';
import type { RealtyState, WeeklyCell, WeeklyKey, WeeklyRow } from '../common/realtyState';
import { fiscalMonths, monthLabel, pct, prevMonth } from '../summary/kpi';

/**
 * 週次行動計画・実績（不動産企画係。v2.2.223）。
 *
 * ⚠️ 移植元は本番アプリの「📅 週次行動計画・実績」（renderWeekly）。
 *   ・黄色＝目標（手入力）／白＝実績（手入力）。⚠️ 架電実績だけは売り反響の📞架電の記録から数える（手入力不可）
 *   ・週：1〜7日／8〜14日／15〜21日／22日〜月末
 *   ・前月より前の月は、翌月5日を過ぎると目標を直せない（マスター・マネージャーは直せる）。実績はいつでも直せる
 * ⚠️ 本番アプリ V16 の「接触の質」の表は、架電の結果（不在・通電・アポ・終了）を記録する「今日の架電キュー」と一緒に移す。
 */

const STYLE = `
.rlt-wk td.goal { background: #fff8e1; }
.rlt-wk td.auto { background: #f1f3f5; }
.rlt-wk input.cell { width: 56px; text-align: right; border: none; background: transparent; font-size: 11px; }
.rlt-wk input.cell:focus { outline: 2px solid #0d6efd55; background: #fff; }
.rlt-wk input.cell[readonly] { cursor: not-allowed; opacity: .75; }
.rlt-wk td.week { font-weight: bold; vertical-align: top; white-space: nowrap; }
.rlt-lock { font-size: 11px; border-radius: 4px; padding: 2px 8px; background: #f8d7da; color: #842029; }
.rlt-lock.ok { background: #d1e7dd; color: #0f5132; }
`;

const cellKey = (w: number, staff: string, key: WeeklyKey) => `${w}\u0000${staff}\u0000${key}`;
const MAX = 99999;

const WeeklyPlan: React.FC = () => {
    const [state, setState] = useState<RealtyState | null>(null);
    const [month, setMonth] = useState('');
    // ⚠️ 打っている途中の値（離れたときに確かめて保存する）
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            const st = await loadRealtyState();
            setState(st);
            return st;
        } catch (e) {
            alert(`読み込めませんでした: ${(e as Error).message}`);
            return null;
        }
    }, []);

    useEffect(() => {
        void load().then(st => {
            if (!st) return;
            const mks = fiscalMonths(st.settings.fiscalStart);
            const cur = st.today.slice(0, 7);
            setMonth(mks.includes(cur) ? cur : mks[0]);
        });
    }, [load]);

    const months = useMemo(() => fiscalMonths(state?.settings.fiscalStart), [state?.settings.fiscalStart]);
    const names = useMemo(
        () => (state?.settings.staff ?? []).map(s => (s.name ?? '').trim()).filter(Boolean),
        [state?.settings.staff]
    );
    const rows = useMemo(() => {
        if (!state || !month) return [];
        return weeklyRowsOf(state.weekly[month], names, weeklySellCalls(state.sellLeads, month));
    }, [state, month, names]);

    if (!state || !month) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const open = isOpenMonth(month, state.today);
    const locked = !open && !state.isWeeklyAdmin;
    const rowOf = (w: number, s: string) => rows.find(r => r.week === w && r.staff === s);

    /** 保存して、返ってきたその月の行で置き換える */
    const save = async (cells: WeeklyCell[]) => {
        setBusy(true);
        try {
            const saved = await saveWeeklyCells(month, cells);
            setState(prev => (prev ? { ...prev, weekly: { ...prev.weekly, [month]: saved } } : prev));
        } catch (e) {
            alert(`保存できませんでした: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    };

    /** 入力欄を離れたとき（本番アプリの wSet）。⚠️ 半角の整数 0〜99999 だけ */
    const commit = (r: WeeklyRow, key: WeeklyKey) => {
        const k = cellKey(r.week, r.staff, key);
        if (!(k in drafts)) return;
        const t = drafts[k].trim();
        const clear = () => setDrafts(d => { const n = { ...d }; delete n[k]; return n; });
        let n = 0;
        if (t !== '') {
            if (!/^\d+$/.test(t)) { alert('半角の整数（0以上）で入力してください'); clear(); return; }
            n = Number(t);
            if (n > MAX) { alert(`入力できるのは 0〜${MAX} です`); clear(); return; }
        }
        clear();
        if (Number(r[key]) === n) return;
        void save([{ week: r.week, staff: r.staff, key, value: n }]);
    };

    /** 前週（第1週は前月の第4週）の目標をこの週へ写す（wCopyPrev） */
    const copyPrev = (w: number) => {
        const srcMonth = w === 1 ? prevMonth(month) : month;
        const srcWeek = w === 1 ? 4 : w - 1;
        const label = w === 1 ? `${monthLabel(srcMonth)} 第4週` : `第${srcWeek}週`;
        const src = state.weekly[srcMonth] ?? [];
        if (!src.length) { alert(`${label}のデータがありません`); return; }
        const cells: WeeklyCell[] = [];
        for (const s of names) {
            const so = src.find(x => x.week === srcWeek && x.staff === s);
            if (!so) continue;
            for (const key of GOAL_KEYS) cells.push({ week: w, staff: s, key, value: Number(so[key]) || 0 });
        }
        if (!cells.length) { alert(`${label}に同じ担当者の行がありません`); return; }
        const filled = rows.some(r => r.week === w && GOAL_KEYS.some(key => Number(r[key]) > 0));
        if (filled && !window.confirm(`第${w}週の目標を ${label} の値で上書きします。よろしいですか？`)) return;
        void save(cells);
    };

    const recount = async () => {
        await load();
        alert('架電実績を再集計しました（売り反響の📞架電のみ）');
    };

    const input = (r: WeeklyRow, key: WeeklyKey, readOnly: boolean, title?: string) => {
        const k = cellKey(r.week, r.staff, key);
        return (
            <input
                className="cell" type="text" inputMode="numeric" placeholder="0"
                value={k in drafts ? drafts[k] : (Number(r[key]) || '')}
                readOnly={readOnly} tabIndex={readOnly ? -1 : undefined} title={title}
                onChange={e => setDrafts(d => ({ ...d, [k]: e.target.value }))}
                onBlur={() => commit(r, key)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
        );
    };

    const total = (key: WeeklyKey, list: WeeklyRow[] = rows) => list.reduce((a, r) => a + (Number(r[key]) || 0), 0);
    const lockTitle = '確定済みの月のため編集できません（管理者のみ変更可）';

    return (
        <div className="rlt-page">
            <style>{REALTY_CSS + STYLE}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-calendar-week me-2" style={{ color: '#0d6efd' }}></i>週次行動計画・実績</h1>
                <select className="rlt-input" value={month} onChange={e => setMonth(e.target.value)} disabled={busy}>
                    {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
                <button className="rlt-btn sec" onClick={recount} disabled={busy} title="売り反響の架電記録を読み直して架電実績を再集計">🔄 架電実績を再集計</button>
                {!open && (
                    state.isWeeklyAdmin
                        ? <span className="rlt-lock ok">🔓 確定済みの月（管理者のため編集可）</span>
                        : <span className="rlt-lock">🔒 確定済みの月のため目標は編集できません（管理者のみ変更可）</span>
                )}
            </div>
            <p className="rlt-sub" style={{ marginBottom: 12 }}>
                黄色＝目標（手入力・半角整数）／白＝実績入力。<b>架電実績は売り反響の「📞架電」の記録から自動集計（手入力不可）</b>。買い反響・LINE・メールは含みません。
                週：1〜7日／8〜14日／15〜21日／22日〜月末。達成率＝<span className="rlt-ok">100%以上</span>／<span className="rlt-mid">80%以上</span>／<span className="rlt-bad">80%未満</span>。
                前月より前の月は、翌月{LOCK_GRACE_DAY}日を過ぎると管理者（マスター・マネージャー）以外は目標を編集できません。
            </p>

            {names.length === 0 ? (
                <div className="rlt-alert">担当者が登録されていません。設定画面で担当者を追加してください。</div>
            ) : (
                <>
                    <div className="rlt-card rlt-tblwrap">
                        <table className="rlt-tbl rlt-wk">
                            <thead><tr>
                                <th>週</th><th>担当者</th>
                                {WCOLS.map(([, , label]) => (
                                    <React.Fragment key={label}>
                                        <th className="r">{label}目標</th>
                                        <th className="r">{label}実績{label === '架電' ? '🔒' : ''}</th>
                                    </React.Fragment>
                                ))}
                                <th className="r">達成率平均</th>
                            </tr></thead>
                            <tbody>
                                {[1, 2, 3, 4].map(w => names.map((s, i) => {
                                    const r = rowOf(w, s);
                                    if (!r) return null;
                                    const avg = rateAverage(WCOLS.map(([g, a]) => [Number(r[a]) || 0, Number(r[g]) || 0]));
                                    return (
                                        <tr key={`${w}-${s}`}>
                                            {i === 0 && (
                                                <td className="week" rowSpan={names.length}>
                                                    第{w}週
                                                    {!locked && (
                                                        <div><button className="rlt-btn sec" style={{ marginTop: 4, padding: '1px 6px' }} disabled={busy}
                                                            title={`${w === 1 ? '前月 第4週' : `第${w - 1}週`}の各目標を第${w}週へ一括コピー`}
                                                            onClick={() => copyPrev(w)}>📋 前週コピー</button></div>
                                                    )}
                                                </td>
                                            )}
                                            <td>{s}</td>
                                            {WCOLS.map(([g, a]) => {
                                                const gv = Number(r[g]) || 0;
                                                const av = Number(r[a]) || 0;
                                                const cls = rateClass(av, gv);
                                                return (
                                                    <React.Fragment key={g}>
                                                        <td className="r goal">{input(r, g, locked, locked ? lockTitle : undefined)}</td>
                                                        <td className={`r ${a === 'ca' ? 'auto' : ''} ${cls ? `rlt-${cls}` : ''}`} title={rateTitle(av, gv)}>
                                                            {a === 'ca'
                                                                ? <span title={`売り反響の📞架電記録から自動集計（第${w}週・${s}）`}>{av}</span>
                                                                : input(r, a, false)}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                            <td className={`r ${avg === null ? '' : `rlt-${rateClass(avg, 1)}`}`}>{avg === null ? '―' : pct(avg)}</td>
                                        </tr>
                                    );
                                }))}
                                <tr className="total">
                                    <td colSpan={2}>月次合計</td>
                                    {WCOLS.map(([g, a]) => {
                                        const cls = rateClass(total(a), total(g));
                                        return (
                                            <React.Fragment key={g}>
                                                <td className="r">{total(g)}</td>
                                                <td className={`r ${cls ? `rlt-${cls}` : ''}`} title={rateTitle(total(a), total(g))}>{total(a)}</td>
                                            </React.Fragment>
                                        );
                                    })}
                                    <td className={`r ${total('cg') ? `rlt-${rateClass(total('ca'), total('cg'))}` : ''}`}>
                                        {total('cg') ? pct(total('ca') / total('cg')) : '―'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="rlt-card">
                        <div className="rlt-card-head"><h3>担当者別 月次計（自動集計）</h3></div>
                        <div className="rlt-tblwrap">
                            <table className="rlt-tbl">
                                <thead><tr>
                                    <th>担当者</th>
                                    {WCOLS.map(([, , label]) => <th key={label} className="r">{label}計</th>)}
                                    <th className="r">達成率平均</th>
                                </tr></thead>
                                <tbody>
                                    {names.map(s => {
                                        const mine = rows.filter(r => r.staff === s);
                                        const avg = rateAverage(WCOLS.map(([g, a]) => [total(a, mine), total(g, mine)]));
                                        return (
                                            <tr key={s}>
                                                <td>{s}</td>
                                                {WCOLS.map(([g, a]) => {
                                                    const cls = rateClass(total(a, mine), total(g, mine));
                                                    return (
                                                        <td key={a} className={`r ${cls ? `rlt-${cls}` : ''}`} title={rateTitle(total(a, mine), total(g, mine))}>
                                                            {total(a, mine)}
                                                        </td>
                                                    );
                                                })}
                                                <td className={`r ${avg === null ? '' : `rlt-${rateClass(avg, 1)}`}`}>{avg === null ? '―' : pct(avg)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default WeeklyPlan;
```

### frontend/src/components/realty/compliance/Compliance.tsx（新規・全文）
```tsx
import React, { useEffect, useState } from 'react';
import { REALTY_CSS, loadRealtyState, saveCompliance } from '../common/realtyState';
import type { ComplianceItem } from '../common/realtyState';

/**
 * コンプライアンス・法令チェックリスト（不動産企画係。v2.2.223）。
 *
 * ⚠️ 移植元は本番アプリの「⚠️ コンプライアンス・法令チェックリスト」（renderComp）。
 *   1つの取引ごとに上から確かめ、終わったら「入力内容をクリア」で次の取引に使う。
 * ⚠️ チェック項目そのもの（文言・並び）は直せない（本番アプリにも画面が無い）。
 */

/** 状態の選択肢（本番アプリの COMP_STATES）。⚠️ ② の state.ts と同じ */
const COMP_STATES = ['', '✅完了', '⏳確認中', '❌未対応', '➖対象外'];

type EditableField = 'staff' | 'date' | 'status' | 'target' | 'note';

const Compliance: React.FC = () => {
    const [items, setItems] = useState<ComplianceItem[]>([]);
    const [staffNames, setStaffNames] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    // ⚠️ 物件・顧客名と備考は打っている途中の値を持ち、離れたときに保存する
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    useEffect(() => {
        loadRealtyState()
            .then(st => {
                setItems(st.compliance);
                setStaffNames((st.settings.staff ?? []).map(s => (s.name ?? '').trim()).filter(Boolean));
            })
            .catch((e: Error) => alert(`読み込めませんでした: ${e.message}`))
            .finally(() => setLoading(false));
    }, []);

    const save = async (id: string, field: EditableField, value: string) => {
        const before = items;
        setItems(list => list.map(c => (c.id === id ? { ...c, [field]: value } : c)));
        try {
            setItems(await saveCompliance({ id, field, value }));
        } catch (e) {
            alert(`保存できませんでした: ${(e as Error).message}`);
            setItems(before);
        }
    };

    const commitText = (c: ComplianceItem, field: 'target' | 'note') => {
        const k = `${c.id}:${field}`;
        if (!(k in drafts)) return;
        const value = drafts[k].trim();
        setDrafts(d => { const n = { ...d }; delete n[k]; return n; });
        if (value !== (c[field] ?? '')) void save(c.id, field, value);
    };

    const reset = async () => {
        if (!window.confirm('担当者・確認日・状態・物件名・備考をすべてクリアしますか？')) return;
        try {
            setItems(await saveCompliance({ reset: true }));
            setDrafts({});
        } catch (e) {
            alert(`クリアできませんでした: ${(e as Error).message}`);
        }
    };

    if (loading) return <div className="rlt-page"><p className="rlt-sub">読み込み中…</p></div>;

    const target = items.filter(c => c.status && c.status !== '➖対象外');
    const done = target.filter(c => c.status === '✅完了').length;
    const textInput = (c: ComplianceItem, field: 'target' | 'note', width: number) => {
        const k = `${c.id}:${field}`;
        return (
            <input className="rlt-input" style={{ width }} value={k in drafts ? drafts[k] : (c[field] ?? '')}
                onChange={e => setDrafts(d => ({ ...d, [k]: e.target.value }))} onBlur={() => commitText(c, field)} />
        );
    };

    return (
        <div className="rlt-page">
            <style>{REALTY_CSS}</style>
            <div className="rlt-head">
                <h1><i className="fa-solid fa-list-check me-2" style={{ color: '#0d6efd' }}></i>コンプライアンス・法令チェックリスト</h1>
                <p className="rlt-sub">
                    完了率（対象外を除く）：<b>{done}/{target.length}件　{target.length ? `${((done / target.length) * 100).toFixed(1)}%` : '0%'}</b>
                </p>
            </div>
            <div className="rlt-card">
                <div className="rlt-tblwrap">
                    <table className="rlt-tbl">
                        <thead><tr>
                            <th>No.</th><th>チェック項目</th><th>担当者</th><th>確認日</th><th>状態</th><th>物件・顧客名</th><th>備考</th>
                        </tr></thead>
                        <tbody>
                            {items.map(c => (
                                <tr key={c.id}>
                                    <td>{c.no}</td>
                                    <td>{c.item}</td>
                                    <td>
                                        <select className="rlt-input" value={c.staff ?? ''} onChange={e => save(c.id, 'staff', e.target.value)}>
                                            <option value=""></option>
                                            {/* ⚠️ 設定から外れた担当者が入っていても消えないように選択肢に残す */}
                                            {[...staffNames, ...(c.staff && !staffNames.includes(c.staff) ? [c.staff] : [])].map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    </td>
                                    <td><input type="date" className="rlt-input" value={c.date ?? ''} onChange={e => save(c.id, 'date', e.target.value)} /></td>
                                    <td>
                                        <select className="rlt-input" value={c.status ?? ''} onChange={e => save(c.id, 'status', e.target.value)}>
                                            {COMP_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td>{textInput(c, 'target', 150)}</td>
                                    <td>{textInput(c, 'note', 170)}</td>
                                </tr>
                            ))}
                            {items.length === 0 && <tr><td colSpan={7} className="rlt-sub">チェック項目がありません（以前のアプリから取り込むと表示されます）</td></tr>}
                        </tbody>
                    </table>
                </div>
                <div className="rlt-body" style={{ paddingTop: 10 }}>
                    <button className="rlt-btn danger" onClick={reset} disabled={items.length === 0}>入力内容をクリア（次の取引用）</button>
                </div>
            </div>
        </div>
    );
};

export default Compliance;
```

### 直したファイル（差分）
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 515e9a12..267b42dc 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -171,6 +171,7 @@ import {
   shopForbidden,
 } from '../features/realty';
 import type { Result as RealtyResult } from '../features/realty';
+import { runPlannerCompliance, runPlannerSettings, runPlannerState, runPlannerWeekly } from '../features/realty/state';
 import type { AuthenticatedStaff } from '../types/staff';
 import type { GatewayContext, GatewayEntry, GatewayKey } from './types';
 import { gatewayKey } from './types';
@@ -1208,6 +1209,14 @@ register({ request: 'activity', roll: 'history', summary: '不動産企画係: 
 register({ request: 'activity', roll: 'notice', summary: '不動産企画係: 本人宛の通知', phpSource: 'activityAction/activity_notice.php', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runActivityNotice(s, body)) });
 register({ request: 'activity', roll: 'read', summary: '【書き込み】不動産企画係: 本人宛の通知を既読にする', phpSource: 'activityAction/activity_read.php', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runActivityRead(s, body)) });
 
+// ⚠️ v2.2.223 新規（② だけ）。設定・週次行動計画・コンプライアンス（app_state）。features/realty/state.ts
+//   ⚠️ 本番アプリと同じく、担当事業が realty / all の人なら誰でも直せる。
+//     ⚠️ 例外は確定済みの月の週次目標（マスター・マネージャーだけ。state.ts の isWeeklyAdmin）
+register({ request: 'planner', roll: 'state', summary: '不動産企画係: 設定・週次行動計画・コンプライアンスと、架電実績を数える売り反響', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (s) => runPlannerState(s)) });
+register({ request: 'planner', roll: 'settings', summary: '【書き込み】不動産企画係: 設定の項目を保存', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (_s, body) => runPlannerSettings(body)) });
+register({ request: 'planner', roll: 'weekly', summary: '【書き込み】不動産企画係: 週次行動計画のセルを保存', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runPlannerWeekly(s, body)) });
+register({ request: 'planner', roll: 'compliance', summary: '【書き込み】不動産企画係: コンプライアンスの入力を保存・クリア', phpSource: '(Express のみ。PHPハンドラは無い)', auth: 'staff', handler: realty(REALTY_SHOPS, (_s, body) => runPlannerCompliance(body)) });
+
 // ---------------------------------------------------------------------------
 // Claudeによる分析（v2.2.217。Dashboard からの自由分析）— ② のみ（① に PHP 版は無い）
 //
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 9b02063f..0d10b462 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -148,6 +148,11 @@ function expressProxyRequests(): array
         'activity:history',
         'activity:notice',
         'activity:read',
+        // ⚠️ v2.2.223。設定・週次行動計画・コンプライアンス。⚠️ ① に PHP は無い（② だけ）。expressProxyExclusive() にも入れてある
+        'planner:state',
+        'planner:settings',
+        'planner:weekly',
+        'planner:compliance',
 
         // 2026-09-03 移植。旧API（dashboard/api/ の demand 形式）から
         // request 形式へ移したもの。
@@ -796,6 +801,11 @@ function expressProxyExclusive(): array
         // v2.2.221。不動産企画係の書き込み。⚠️ ② で済んだ直後に応答が失われて ① でも動くと二重に書き込むため
         'broker:update',
         'activity:read',
+        // v2.2.223 新規。不動産企画係の設定・週次行動計画・コンプライアンス。⚠️ ① に PHP ハンドラは無い（② だけ）
+        'planner:state',
+        'planner:settings',
+        'planner:weekly',
+        'planner:compliance',
 
         // -----------------------------------------------------------------
         // v2.2.215 新規。オーナーズハウス募集（owners_house_application）の一覧と過去メールの取り込み。
diff --git a/frontend/src/App.tsx b/frontend/src/App.tsx
index 67953d3c..97405a00 100644
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -41,6 +41,9 @@ import LeadSell from "./components/realty/sell/LeadSell";
 import LeadBuy from "./components/realty/buy/LeadBuy";
 import LeadOpportunity from "./components/realty/deals/LeadOpportunity";
 import LeadResale from "./components/realty/resale/LeadResale";
+import WeeklyPlan from "./components/realty/weekly/WeeklyPlan";
+import Compliance from "./components/realty/compliance/Compliance";
+import RealtySettings from "./components/realty/settings/RealtySettings";
 import Guide from "./components/guide/Guide";
 
 const GOOGLE_MAPS_LIBRARIES: ("marker")[] = ['marker'];
@@ -173,22 +176,29 @@ function AppInner() {
             <Route path="/photo" element={<Photo />} />
             <Route path="/kengakuCloud" element={<KengakuCloud />} />
             <Route path="/insideSales" element={<InsideSales/>} />
-            {/* ⚠️ v2.2.221: 不動産企画係の画面。⚠️ 担当事業が realty / all の人だけ（RealtyRoute） */}
-            <Route path="/realty/summary" element={<RealtyRoute><Summary /></RealtyRoute>} />
-            <Route path="/realty/report" element={<RealtyRoute><MonthlySalesReport /></RealtyRoute>} />
-            <Route path="/realty/sell" element={<RealtyRoute><LeadSell /></RealtyRoute>} />
-            <Route path="/realty/buy" element={<RealtyRoute><LeadBuy /></RealtyRoute>} />
-            <Route path="/realty/deals" element={<RealtyRoute><LeadOpportunity /></RealtyRoute>} />
-            <Route path="/realty/resale" element={<RealtyRoute><LeadResale /></RealtyRoute>} />
-            <Route path="/realty/ledger" element={<RealtyRoute><DatabaseBroker /></RealtyRoute>} />
-            {/* ⚠️ v2.2.220 までの URL（ブックマーク）は新しい URL へ送る */}
-            <Route path="/summary" element={<Navigate to="/realty/summary" replace />} />
-            <Route path="/report" element={<Navigate to="/realty/report" replace />} />
-            <Route path="/leadSell" element={<Navigate to="/realty/sell" replace />} />
-            <Route path="/leadBuy" element={<Navigate to="/realty/buy" replace />} />
-            <Route path="/leadOpportunity" element={<Navigate to="/realty/deals" replace />} />
-            <Route path="/leadResale" element={<Navigate to="/realty/resale" replace />} />
-            <Route path="/broker" element={<Navigate to="/realty/ledger" replace />} />
+            {/* ⚠️ v2.2.221: 不動産企画係の画面。⚠️ 担当事業が realty / all の人だけ（RealtyRoute）
+                ⚠️⚠️ v2.2.223: URL は**1段**に戻した（v2.2.220 までと同じ）。⚠️ `/realty/summary` のような2段にしないこと。
+                  index.html が画面の部品を相対パス（./static/...）で読むため、2段の URL で再読み込みすると
+                  /dashboard/realty/static/... を取りに行き、HTML が返って真っ白になる（Guide.tsx の注記と同じ） */}
+            <Route path="/summary" element={<RealtyRoute><Summary /></RealtyRoute>} />
+            <Route path="/report" element={<RealtyRoute><MonthlySalesReport /></RealtyRoute>} />
+            <Route path="/leadSell" element={<RealtyRoute><LeadSell /></RealtyRoute>} />
+            <Route path="/leadBuy" element={<RealtyRoute><LeadBuy /></RealtyRoute>} />
+            <Route path="/leadOpportunity" element={<RealtyRoute><LeadOpportunity /></RealtyRoute>} />
+            <Route path="/leadResale" element={<RealtyRoute><LeadResale /></RealtyRoute>} />
+            <Route path="/broker" element={<RealtyRoute><DatabaseBroker /></RealtyRoute>} />
+            {/* ⚠️ v2.2.223: 週次行動計画・コンプライアンス・設定（本番アプリから移植） */}
+            <Route path="/realtyWeekly" element={<RealtyRoute><WeeklyPlan /></RealtyRoute>} />
+            <Route path="/realtyCompliance" element={<RealtyRoute><Compliance /></RealtyRoute>} />
+            <Route path="/realtySettings" element={<RealtyRoute><RealtySettings /></RealtyRoute>} />
+            {/* ⚠️ v2.2.221〜222 の2段の URL。⚠️ 画面の中から移ってきたときだけ効く（再読み込みは上の理由で届かない） */}
+            <Route path="/realty/summary" element={<Navigate to="/summary" replace />} />
+            <Route path="/realty/report" element={<Navigate to="/report" replace />} />
+            <Route path="/realty/sell" element={<Navigate to="/leadSell" replace />} />
+            <Route path="/realty/buy" element={<Navigate to="/leadBuy" replace />} />
+            <Route path="/realty/deals" element={<Navigate to="/leadOpportunity" replace />} />
+            <Route path="/realty/resale" element={<Navigate to="/leadResale" replace />} />
+            <Route path="/realty/ledger" element={<Navigate to="/broker" replace />} />
             <Route path="*" element={<Category />} />
 
           </Routes>
diff --git a/frontend/src/components/Category.tsx b/frontend/src/components/Category.tsx
index 028c5ddb..9628f962 100644
--- a/frontend/src/components/Category.tsx
+++ b/frontend/src/components/Category.tsx
@@ -37,8 +37,8 @@ const Category = () => {
             order: '/company',
             spec: '/company',
             used: '/company',
-            // ⚠️ v2.2.221: planner → realty（不動産企画係）
-            realty: '/realty/summary'
+            // ⚠️ v2.2.221: planner → realty（不動産企画係）。⚠️ v2.2.223: URL は1段（App.tsx の注記）
+            realty: '/summary'
         };
         await setCategory(categoryValue);
         /**
diff --git a/frontend/src/components/Menu.tsx b/frontend/src/components/Menu.tsx
index 05282c92..729ab8f8 100644
--- a/frontend/src/components/Menu.tsx
+++ b/frontend/src/components/Menu.tsx
@@ -231,12 +231,17 @@ const Menu = ({ key, onReload }: Props) => {
 
     const MENU_CONFIG: MenuItem[] = useMemo(() => [
         { id: 'company', path: '/company', icon: 'fa-rainbow', label: '全社報告用フォーマット', show: category !== 'realty', exact: true },
-        { id: 'summary', path: '/realty/summary', icon: 'fa-chart-line', label: 'チームサマリー', show: !isSp && category === 'realty', exact: true },
-        { id: 'report', path: '/realty/report', icon: 'fa-calendar', label: '月次報告書', show: !isSp && category === 'realty', exact: true },
-        { id: 'leadSell', path: '/realty/sell', icon: 'fa-calculator', label: '売り反響(一括査定)', show: !isSp && category === 'realty', exact: true },
-        { id: 'leadBuy', path: '/realty/buy', icon: 'fa-desktop', label: '買い反響(ポータル)', show: !isSp && category === 'realty', exact: true },
-        { id: 'deals', path: '/realty/deals', icon: 'fa-user-tie', label: '商談案件', show: !isSp && category === 'realty', exact: true },
-        { id: 'leadResale', path: '/realty/resale', icon: 'fa-arrows-rotate', label: '買取再販案件', show: !isSp && category === 'realty', exact: true },
+        // ⚠️ v2.2.223: 不動産企画係の URL は1段（`/realty/...` にしない。App.tsx の注記）
+        { id: 'summary', path: '/summary', icon: 'fa-chart-line', label: 'チームサマリー', show: !isSp && category === 'realty', exact: true },
+        { id: 'report', path: '/report', icon: 'fa-calendar', label: '月次報告書', show: !isSp && category === 'realty', exact: true },
+        { id: 'leadSell', path: '/leadSell', icon: 'fa-calculator', label: '売り反響(一括査定)', show: !isSp && category === 'realty', exact: true },
+        { id: 'leadBuy', path: '/leadBuy', icon: 'fa-desktop', label: '買い反響(ポータル)', show: !isSp && category === 'realty', exact: true },
+        { id: 'deals', path: '/leadOpportunity', icon: 'fa-user-tie', label: '商談案件', show: !isSp && category === 'realty', exact: true },
+        { id: 'leadResale', path: '/leadResale', icon: 'fa-arrows-rotate', label: '買取再販案件', show: !isSp && category === 'realty', exact: true },
+        // ⚠️ v2.2.223: 本番アプリから移植
+        { id: 'weekly', path: '/realtyWeekly', icon: 'fa-calendar-week', label: '週次行動計画', show: !isSp && category === 'realty', exact: true },
+        { id: 'compliance', path: '/realtyCompliance', icon: 'fa-list-check', label: 'コンプライアンス', show: !isSp && category === 'realty', exact: true },
+        { id: 'realtySettings', path: '/realtySettings', icon: 'fa-gear', label: '設定', show: !isSp && category === 'realty', exact: true },
         {
             id: 'list', path: '/list', icon: 'fa-phone', label: '反響一覧', show: (category === 'order' || category === 'spec'), exact: true,
             badges: (category === 'order' && sync > 0) ? [{ label: `未同期 ${sync}件`, top: '8px' }] : []
@@ -274,7 +279,7 @@ const Menu = ({ key, onReload }: Props) => {
          */
         { id: 'shop', path: '/shop', icon: 'fa-chart-pie', label: '店舗別広告費', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
         { id: 'property_used', path: '/property', icon: 'fa-house', label: '掲載物件一覧', show: category === 'realty', exact: false },
-        { id: 'broker', path: '/realty/ledger', icon: 'fa-house', label: '媒介獲得台帳', show: category === 'realty', exact: false },
+        { id: 'broker', path: '/broker', icon: 'fa-house', label: '媒介獲得台帳', show: category === 'realty', exact: false },
         { id: 'customerTrend', path: '/customerTrend', icon: 'fa-chart-bar', label: '販促媒体別反響推移', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
         { id: 'shopTrend', path: '/shopTrend', icon: 'fa-shop', label: '店舗別反響推移', show: !isSp && category !== 'realty', exact: true },
         { id: 'calendar', path: '/calendar', icon: 'fa-calendar', label: 'カレンダー', show: !isSp && category === 'order', exact: true },
diff --git a/frontend/src/components/campaign/NewCampaign.tsx b/frontend/src/components/campaign/NewCampaign.tsx
index 37fd812e..40cb5b96 100644
--- a/frontend/src/components/campaign/NewCampaign.tsx
+++ b/frontend/src/components/campaign/NewCampaign.tsx
@@ -509,7 +509,8 @@ const NewCampaign = () => {
         if (response?.status === 'duplicate') {
             alert('キャンペーンIDが重複しています')
         } else if (response?.status === 'success') {
-            navigate(`/campaign/?brand=${form.brand}`);
+            // ⚠️ v2.2.223: `/campaign/?…` と末尾に / を付けない（再読み込みで ./static の場所がずれて真っ白になる。App.tsx の注記）
+            navigate(`/campaign?brand=${form.brand}`);
         }
     }, [response])
 
@@ -534,7 +535,7 @@ const NewCampaign = () => {
     );
 
     const isEdit = Boolean(idValue);
-    const backToList = () => navigate(`/campaign/?brand=${brandValue ?? ''}`);
+    const backToList = () => navigate(`/campaign?brand=${brandValue ?? ''}`);
 
     return (
         <div className="nc">
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index ce7a3c47..935dec58 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.222';
+export const newVersion = '2.2.223';
```
