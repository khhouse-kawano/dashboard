# 2026-11-04 v2.2.243 広告費の「詳細」（budget.remarks）・予算テーブル

## 依頼（ReadMeClaude.md）
- 新しいブランチで作業する
- budget に remarks（メモ。TEXT・既定 NULL）を足す
  - company の `●●(△△)` を `company=●●`・`remarks=△△` に分ける（括弧は半角・全角の両方）
  - そのための SQL を用意する
- EventBudget.tsx の表で、「請求先」の右に「詳細」を足す（remarks を表示し、登録・修正で保存する）
- header/system に予算テーブルの画面を足す（budget を使う。上の操作部分は固定する）
- budget.csv を整形する（反映はオーナーが手で行う）
- 「広告費の登録」ボタンで CSV を渡すと、budget に INSERT する

## 決めたこと（2026-11-04 の回答）
- 整形の元は `budget (1).csv`。最初の budget.csv は誤り。ローカルにも反映する
- 予算テーブルを使えるのは Master と BrandAdmin
- 表の中での修正・削除は作らない（見るのと CSV での追加だけ）

## ディレクトリ・ファイル
| 区分 | ファイル | 内容 |
|---|---|---|
| 新規 | `backend/scripts/sql/2026-11-04_budget_remarks.sql` | 列の追加と、請求先の分割（何度流しても同じ） |
| 新規 | `backend/scripts/sql/2026-11-04_update_log_2.2.243.sql` | 更新履歴と業務ガイド3本 |
| 新規 | `backend-express/src/features/budgetTable.ts` | `listBudgetTable`・`uploadBudgetTable`・`BUDGET_TABLE_AUTHORITY` |
| 修正 | `backend-express/src/features/eventBudget.ts` | 追加した関数：`toRemarks`。一覧・登録・修正で remarks を読み書きする |
| 修正 | `backend-express/src/gateway/registry.ts` | `budget_table_list`・`budget_table_upload` を登録（`auth: 'staff'` のうえで権限を確かめる） |
| 修正 | `backend/src/core/express_proxy.php` | 2つの request を `expressProxyRequests()` と `expressProxyExclusive()` の両方に足した |
| 新規 | `frontend/src/components/header/system/BudgetTable.tsx` | 予算テーブルの画面（接頭辞 `bt_`） |
| 修正 | `frontend/src/components/header/event/EventBudget.tsx` | 「詳細」の列 |
| 修正 | `frontend/src/components/header/headerScreens.tsx` | 「システム管理 → 予算テーブル」（`/budgetTable`・`isAdmin`） |
| 修正 | `frontend/src/components/guide/guideScreens.ts` | `'予算テーブル'`（authority: ADMIN） |
| 修正 | `frontend/src/utils/version.ts` | 2.2.243 |
| 新規 | `backend/scripts/guide/articles/common/screen-196.md` | 記事「予算テーブル」 |
| 新規 | `backend/scripts/guide/articles/common/screen-197.md` | 記事「イベントの広告費入力」（前は記事が無かった） |
| 修正 | `backend/scripts/guide/articles/common/screen-105.md` | 記事「ヘッダーのメニュー」：管理者・ブランド管理者だけの一覧に予算テーブルを加え、関係する記事に2本を加えた |

整形した CSV はリポジトリの外に置いた：`Downloads/budget_formatted.csv`。

## 調べて分かったこと
- 最初の `budget.csv`（27,546行）には、括弧付きの請求先が0件だった。id も今の表と食い違っていた（誤りのファイル）
- `budget (1).csv`（33,074行）は、ローカルの budget と全行・全列で一致した。括弧付きの請求先は129行あり、すべて「イベント」の行（広告費入力で登録したもの）だった
- 括弧の組み合わせが混ざった値（`リビング新聞社(折込料）`）もあった
- id 1 の行は、中身が見出しの文字（`budget_period` など）になっている。前からある誤った行で、触っていない。オーナーの判断が必要

## 整形した CSV（Downloads/budget_formatted.csv）
- 元：`budget (1).csv`（phpMyAdmin の書き出し。改行は LF）
- 列は表の並びどおり。`remarks` を `company` の右に足した。id は残した（表を丸ごと入れ直すときのため）
- 請求先の括弧書きを分けた行：129
- 確認：SQL を流したあとのローカルの budget と、33,074行・全列で一致した
- 使ったスクリプトは作業用フォルダに置いた（リポジトリには入れていない）。分け方は SQL と同じ

## ローカルへの反映
- `2026-11-04_budget_remarks.sql` を流した。分けた行は129、括弧の残った請求先は0行。2回目は0行で、変化なし
- `2026-11-04_update_log_2.2.243.sql` を流した：update_log の no=342、記事 id 172・173・163

## テスト
- ② の `tsc --noEmit`、フロントの本番用ビルド：通った
- ① を通した確認（`localhost:8080`）
  - トークンなし → 401。Manager → 403。セキュリティログに「権限で拒否」が人つきで残ることも確かめた
  - BrandAdmin・Master → 一覧が出る。既定は直近3か月。媒体・キーワード・全期間（3,000行で打ち切り、合計は全体）も確かめた
  - CSV の確認：日付の0埋め・カンマ除去・MKT の大文字化・`NULL` は空・括弧の分割・同じ内容の行の検出
  - 誤りの行は7種類とも弾いた：存在しない日付・shop が空・小数・response_medium が 2・category が不正・section が used・行の形が不正。誤りがあるときは何も書かない
  - 登録 → 2回目の確認で、同じ内容の行として3行出た
  - 広告費入力：詳細を付けて登録・空に修正すると NULL になる。**remarks を送らない修正（古い画面）では、今の値が残る**
- Playwright（開発サーバー 3100）
  - BrandAdmin
    - 一覧と KPI が出る
    - 表をスクロールしても上の操作部分は動かず、見出しも固定されたまま
    - 媒体の絞り込み・金額での並べ替えができる
    - 見本の CSV を保存できる
    - CSV を選ぶと確認の結果が出る → 確認の画面 → 登録 → 選び直すと同じ内容の行が出る
  - Manager：メニューに出ない。URL を直接入れると「この画面を見る権限がありません」
  - Master：広告費入力に「詳細」の列が出る。分けた詳細（派遣スタッフなど）が表示される
  - 業務ガイド：記事「予算テーブル」「イベントの広告費入力」が表示され、「開く」のボタンも出る
- 後片付け：テストで入れた budget の12行・セキュリティログの8行・仮スタッフ3人を消した。開発サーバー（3100）を止めた

## 読み直しで直したこと
- ② を先にデプロイすると、古い画面（v2.2.242）は remarks を送らない。その画面で「修正」を押すと、詳細が NULL で消えていた
  - → remarks が送られてこないときは、今の値を残すようにした（`CURRENT_SQL` で remarks も読む）
- `keyOf` の引数の型を `UploadRow` にまとめた

## 業務ガイド
- 新規「予算テーブル」：見方、CSV での追加、見出しの説明。2重登録の注意と、要確認（MKT・PR・媒体名の社内ルール）を書いた
- 新規「イベントの広告費入力」：登録・修正のしかた。請求先と詳細の分け方（括弧書きは詳細へ移したこと）を書いた
- 更新「ヘッダーのメニュー」：管理者・ブランド管理者だけの一覧に予算テーブルを加えた。関係する記事に2本を加えた

## 気になること（利用者に確かめる）
- 左のメニューに、前からある「予算詳細」（`/budget`。管理者専用）がある。予算テーブルと役目が近いので、どちらかにまとめるかを決めてほしい
- budget の id 1 の行（中身が見出しの文字）は消してよいか

## 新規ファイルの全文

### backend/scripts/sql/2026-11-04_budget_remarks.sql
````sql
-- =====================================================================
-- v2.2.243 budget に「詳細」（remarks）を足し、請求先（company）の括弧書きを remarks へ移す
--
--   例: 'フルキャスト(派遣スタッフ)' → company = 'フルキャスト'・remarks = '派遣スタッフ'
--       'リビング新聞社(折込料）'   → company = 'リビング新聞社'・remarks = '折込料'（⚠️ 半角・全角の混在も対象）
--
-- ⚠️ 対象は「括弧より前に文字があり、末尾が閉じ括弧で終わる」値だけ。
--   ⚠️ 最初の開き括弧から最後の閉じ括弧までを remarks にする。
--   ⚠️ '(株)〇〇' のように括弧より前が空の値・括弧の後ろに文字が続く値は分けない。
-- ⚠️ 何度流しても同じ結果になる（列は IF NOT EXISTS。分割は remarks が NULL で括弧の残っている行だけ）。
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ② のデプロイより先に流すこと
--   （② の広告費入力は remarks を読み書きするので、列が無いと画面がエラーになる）
-- =====================================================================

-- 1. 列を足す（請求先の右）
ALTER TABLE budget ADD COLUMN IF NOT EXISTS remarks TEXT NULL DEFAULT NULL COMMENT '詳細（メモ）。v2.2.243' AFTER company;

-- 2. 流す前の確認（分ける行の一覧。⚠️ ここに出た行だけが変わる）
SELECT id, company,
       TRIM(REGEXP_REPLACE(company, '^(.+?)[[:space:]]*[(（](.*)[)）][[:space:]]*$', '\\1')) AS new_company,
       TRIM(REGEXP_REPLACE(company, '^(.+?)[[:space:]]*[(（](.*)[)）][[:space:]]*$', '\\2')) AS new_remarks
  FROM budget
 WHERE remarks IS NULL
   AND company REGEXP '^[^(（]*[^(（[:space:]][^(（]*[(（].*[)）][[:space:]]*$'
 ORDER BY id;

-- 3. 分ける（⚠️ remarks を先に入れる。company を先に書き換えると remarks の元が消える）
UPDATE budget
   SET remarks = TRIM(REGEXP_REPLACE(company, '^(.+?)[[:space:]]*[(（](.*)[)）][[:space:]]*$', '\\2')),
       company = TRIM(REGEXP_REPLACE(company, '^(.+?)[[:space:]]*[(（](.*)[)）][[:space:]]*$', '\\1'))
 WHERE remarks IS NULL
   AND company REGEXP '^[^(（]*[^(（[:space:]][^(（]*[(（].*[)）][[:space:]]*$';

-- 4. 確かめる（括弧の残った company が 0 行、remarks の入った行の数が 2 の行数と同じならよい）
SELECT
  (SELECT COUNT(*) FROM budget WHERE company REGEXP '[(（].*[)）][[:space:]]*$') AS company_with_paren,
  (SELECT COUNT(*) FROM budget WHERE remarks IS NOT NULL) AS rows_with_remarks;
````

### backend-express/src/features/budgetTable.ts
````ts
import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../db/pool';
import type { SqlParam } from '../db/pool';

/**
 * 予算テーブル（budget の一覧と CSV での追加）。v2.2.243 新規。
 *
 * ─────────────────────────────────────────────
 *   budget_table_list   … 期間などで絞った行・件数と金額の合計・絞り込みの選択肢
 *   budget_table_upload … CSV の行を budget へ INSERT する（mode = 'check' は確かめるだけ、'save' で登録）
 *
 *   画面: frontend/src/components/header/system/BudgetTable.tsx（ヘッダーの「システム管理 → 予算テーブル」）
 *   列  : backend/scripts/sql/2026-11-04_budget_remarks.sql（remarks を足した）
 *
 * ⚠️⚠️ **Master と BrandAdmin だけ。** registry.ts で `auth: 'staff'` のうえ BUDGET_TABLE_AUTHORITY を確かめる。
 * ⚠️⚠️ **budget には UNIQUE キーが無い**（eventBudget.ts の注記）。同じ CSV を2回登録すると2組になる。
 *   ⚠️ 防ぐのは画面の確認（mode = 'check' で「同じ内容がすでにある行」を数えて出す）。⚠️ 登録は止めない（同じ金額の伝票が実在するため）。
 * ⚠️ 表の中での修正・削除は作らない（2026-11-04 決定）。
 * ─────────────────────────────────────────────
 */

export const BUDGET_TABLE_AUTHORITY = ['Master', 'BrandAdmin'];

/** 一度に返す行の上限（⚠️ 2026-11 時点で全体 33,000 行。期間で絞って使う） */
const MAX_ROWS = 3000;
/** 一度に受ける CSV の行の上限（⚠️ 誤って表を丸ごと書き出した CSV を入れたときの歯止め） */
const MAX_UPLOAD_ROWS = 5000;
/** 1回の INSERT に入れる行数 */
const CHUNK = 200;

/** budget.section の値。⚠️ 中古は `use`（`used` ではない。eventBudget.ts の SECTION_BY_DIVISION の注記） */
const SECTIONS = ['order', 'spec', 'use'];
const CATEGORIES = ['MKT', 'PR'];

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

interface BudgetRow extends RowDataPacket {
  id: number;
  budget_period: string;
  shop: string;
  medium: string;
  budget_value: number;
  note: string;
  company: string;
  remarks: string | null;
  response_medium: number;
  category: string;
  section: string | null;
  order_section: string;
}

interface RangeRow extends RowDataPacket { from_month: string; to_month: string }
interface TotalRow extends RowDataPacket { category: string; rows_count: number; total: number | string | null }
interface ValueRow extends RowDataPacket { v: string }
interface KeyRow extends RowDataPacket { k: string }

/** 制御文字を落として前後の空白を除き、長さで切る */
const text = (value: unknown, max = 1000): string =>
  String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

/** LIKE の特殊文字を逃がす */
const likeOf = (q: string): string => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// ---------------------------------------------------------------------------
// 一覧
// ---------------------------------------------------------------------------

/**
 * ⚠️ budget_period は text（'2026/10/01'。⚠️ '2025/12/1' のように0の無い値もある）。
 *   ⚠️ 月は先頭7文字（'2026/10'）を文字列で比べる。
 * ⚠️ 期間の既定は DB の今月を含む直近3か月。
 * ⚠️ 件数・合計は絞り込み全体で数える（⚠️ 返す行が上限で切れても合計は正しい）。
 */
export const listBudgetTable = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const [range] = await query<RangeRow>(
    "SELECT DATE_FORMAT(CURDATE() - INTERVAL 2 MONTH, '%Y-%m') AS from_month, DATE_FORMAT(CURDATE(), '%Y-%m') AS to_month"
  );
  const from = MONTH.test(String(body.from ?? '')) ? String(body.from) : range.from_month;
  const to = MONTH.test(String(body.to ?? '')) ? String(body.to) : range.to_month;
  const section = SECTIONS.includes(String(body.section ?? '')) ? String(body.section) : '';
  const category = CATEGORIES.includes(String(body.category ?? '')) ? String(body.category) : '';
  const medium = text(body.medium, 200);
  const shop = text(body.shop, 200);
  const q = text(body.q, 100);

  const where = ['LEFT(budget_period, 7) >= ?', 'LEFT(budget_period, 7) <= ?'];
  const params: SqlParam[] = [from.replace('-', '/'), to.replace('-', '/')];
  if (section !== '') { where.push('section = ?'); params.push(section); }
  if (category !== '') { where.push('category = ?'); params.push(category); }
  if (medium !== '') { where.push('medium = ?'); params.push(medium); }
  if (shop !== '') { where.push('shop = ?'); params.push(shop); }
  if (q !== '') {
    where.push('(note LIKE ? OR company LIKE ? OR remarks LIKE ? OR shop LIKE ? OR medium LIKE ? OR order_section LIKE ?)');
    const like = likeOf(q);
    params.push(like, like, like, like, like, like);
  }
  const condition = where.join(' AND ');

  const rows = await query<BudgetRow>(
    `SELECT id, budget_period, shop, medium, budget_value, note, company, remarks, response_medium, category, section, order_section
       FROM budget WHERE ${condition}
      ORDER BY budget_period DESC, id DESC LIMIT ${MAX_ROWS + 1}`,
    params
  );
  const totals = await query<TotalRow>(
    `SELECT category, COUNT(*) AS rows_count, SUM(budget_value) AS total FROM budget WHERE ${condition} GROUP BY category`,
    params
  );
  // ⚠️ 選択肢は表全体から（⚠️ 期間で絞ると、選んだ値が別の月で消えて選び直せなくなる）
  const media = await query<ValueRow>("SELECT DISTINCT medium AS v FROM budget WHERE medium <> '' ORDER BY medium");
  const shops = await query<ValueRow>("SELECT DISTINCT shop AS v FROM budget WHERE shop <> '' ORDER BY shop");

  const sumOf = (cat?: string) => totals
    .filter((t) => cat === undefined || t.category === cat)
    .reduce((acc, t) => ({ rows: acc.rows + Number(t.rows_count), total: acc.total + Number(t.total ?? 0) }), { rows: 0, total: 0 });

  return {
    status: 'ok',
    from,
    to,
    totals: { all: sumOf(), mkt: sumOf('MKT'), pr: sumOf('PR') },
    rows: rows.slice(0, MAX_ROWS).map((r) => ({
      id: Number(r.id),
      period: r.budget_period,
      shop: r.shop,
      medium: r.medium,
      value: Number(r.budget_value),
      note: r.note,
      company: r.company,
      remarks: r.remarks ?? '',
      responseMedium: Number(r.response_medium),
      category: r.category,
      section: r.section ?? '',
      orderSection: r.order_section,
    })),
    truncated: rows.length > MAX_ROWS,
    maxRows: MAX_ROWS,
    options: { media: media.map((m) => m.v), shops: shops.map((s) => s.v) },
  };
};

// ---------------------------------------------------------------------------
// CSV での追加
// ---------------------------------------------------------------------------

/*
 * ⚠️ CSV の見出しは budget の列名と同じ（画面の BudgetTable.tsx の REQUIRED_COLUMNS で確かめている）。
 *   ⚠️ id の列は無視する。⚠️ remarks の列は無くてもよい。
 */

/**
 * 請求先の括弧書きを詳細へ分ける（⚠️ 2026-11-04_budget_remarks.sql と同じ規則）。
 * ⚠️ 括弧より前に文字があり、末尾が閉じ括弧の値だけ。⚠️ 詳細の列に値があるときは分けない。
 */
const SPLIT = /^(.+?)\s*[(（](.*)[)）]\s*$/;
const HAS_HEAD = /^[^(（]*[^(（\s][^(（]*[(（]/;

/** '2026/10/01'・'2026-10-1' → '2026/10/01'。⚠️ 日付として正しくなければ null */
const periodOf = (value: string): string | null => {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${m[1]}/${String(mo).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
};

/** 金額。⚠️ カンマ・円記号・空白は落とす。⚠️ 負の値も認める（返金・修正の伝票が実在する）。⚠️ 整数だけ */
const valueOf = (value: string): number | null => {
  const s = value.replace(/[,，¥￥円\s]/g, '');
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Math.abs(n) <= 2147483647 ? n : null;
};

interface UploadRow {
  period: string;
  shop: string;
  medium: string;
  value: number;
  note: string;
  company: string;
  remarks: string | null;
  responseMedium: number;
  category: string;
  section: string;
  orderSection: string;
}

/** 同じ内容の行を見分ける鍵（⚠️ 期間・店舗・媒体・金額・内容・請求先） */
const keyOf = (r: UploadRow): string =>
  [r.period, r.shop, r.medium, r.value, r.note, r.company].join('\u0001');

const checkRow = (raw: unknown): { row?: UploadRow; error?: string; split?: boolean } => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { error: '行の形式が正しくありません' };
  const r = raw as Record<string, unknown>;

  const period = periodOf(text(r.budget_period, 20));
  if (period === null) return { error: `budget_period が日付ではありません（例: 2026/11/01）: ${text(r.budget_period, 20)}` };
  const shop = text(r.shop, 200);
  if (shop === '') return { error: 'shop が空です' };
  const medium = text(r.medium, 200);
  if (medium === '') return { error: 'medium が空です' };
  const value = valueOf(text(r.budget_value, 30));
  if (value === null) return { error: `budget_value が整数ではありません: ${text(r.budget_value, 30)}` };
  const responseRaw = text(r.response_medium, 5);
  if (responseRaw !== '0' && responseRaw !== '1') return { error: `response_medium は 0 か 1 です: ${responseRaw}` };
  const category = text(r.category, 10).toUpperCase();
  if (!CATEGORIES.includes(category)) return { error: `category は MKT か PR です: ${text(r.category, 10)}` };
  const section = text(r.section, 10);
  if (!SECTIONS.includes(section)) {
    return { error: `section は order・spec・use のどれかです${section === 'used' ? '（中古は use）' : ''}: ${section}` };
  }

  let company = text(r.company, 500);
  // ⚠️ phpMyAdmin で書き出した CSV は、空の詳細が引用符なしの NULL になる
  const remarksRaw = text(r.remarks, 1000);
  let remarks: string | null = remarksRaw === '' || remarksRaw === 'NULL' ? null : remarksRaw;
  let split = false;
  const m = remarks === null ? SPLIT.exec(company) : null;
  if (m && HAS_HEAD.test(company)) {
    company = m[1].trim();
    remarks = m[2].trim() || null;
    split = true;
  }

  return {
    row: {
      period, shop, medium, value, note: text(r.note, 2000), company, remarks,
      responseMedium: Number(responseRaw), category, section, orderSection: text(r.order_section, 200),
    },
    split,
  };
};

/**
 * CSV の行（見出しをキーにしたオブジェクトの配列）を確かめ、mode = 'save' なら INSERT する。
 * ⚠️ 1行でも誤りがあれば何も登録しない（⚠️ 登録は1つのトランザクション）。
 * ⚠️ 行番号は CSV の行（見出しが1行目なので、1件目は2行目）。
 */
export const uploadBudgetTable = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const mode = body.mode === 'save' ? 'save' : 'check';
  if (!Array.isArray(body.rows) || body.rows.length === 0) return { status: 'error', message: 'CSV に行がありません。' };
  if (body.rows.length > MAX_UPLOAD_ROWS) {
    return { status: 'error', message: `行が多すぎます（上限 ${MAX_UPLOAD_ROWS.toLocaleString()} 行）。月ごとなどに分けてください。` };
  }

  const errors: { line: number; message: string }[] = [];
  const rows: { line: number; row: UploadRow }[] = [];
  let splitCount = 0;
  body.rows.forEach((raw, i) => {
    const line = i + 2;
    const result = checkRow(raw);
    if (result.error !== undefined) errors.push({ line, message: result.error });
    else if (result.row !== undefined) {
      rows.push({ line, row: result.row });
      if (result.split) splitCount++;
    }
  });
  if (errors.length > 0) {
    return { status: 'error', message: `${errors.length} 行に誤りがあります。何も登録していません。`, errors: errors.slice(0, 50), errorCount: errors.length };
  }

  // 同じ内容がすでにある行（⚠️ CSV の中の重なりも数える）
  const periods = [...new Set(rows.map((r) => r.row.period))];
  const existing = new Set(
    (await query<KeyRow>(
      `SELECT CONCAT_WS(CHAR(1), budget_period, shop, medium, budget_value, note, company) AS k
         FROM budget WHERE budget_period IN (${periods.map(() => '?').join(', ')})`,
      periods
    )).map((r) => r.k)
  );
  const seen = new Set<string>();
  const duplicateLines: number[] = [];
  for (const { line, row } of rows) {
    const k = keyOf(row);
    if (existing.has(k) || seen.has(k)) duplicateLines.push(line);
    seen.add(k);
  }

  const summary = {
    rows: rows.length,
    total: rows.reduce((n, r) => n + r.row.value, 0),
    from: periods.reduce((a, b) => (a < b ? a : b)),
    to: periods.reduce((a, b) => (a > b ? a : b)),
    splitCount,
    duplicates: duplicateLines.length,
    duplicateLines: duplicateLines.slice(0, 20),
  };
  if (mode === 'check') return { status: 'ok', mode, ...summary };

  await withTransaction(async (tx) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK).map((r) => r.row);
      await tx.execute(
        `INSERT INTO budget (budget_period, shop, medium, budget_value, note, company, remarks, response_medium, category, section, order_section)
         VALUES ${part.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        part.flatMap((r): SqlParam[] => [
          r.period, r.shop, r.medium, r.value, r.note, r.company, r.remarks, r.responseMedium, r.category, r.section, r.orderSection,
        ])
      );
    }
  });
  return { status: 'ok', mode, inserted: rows.length, ...summary };
};
````

### frontend/src/components/header/system/BudgetTable.tsx
````tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../utils/apiClient';
import { csvToObjects, decodeCsv, parseCsv } from '../../../utils/csv';

/**
 * 予算テーブル（v2.2.243 新規）。ヘッダーの「システム管理 → 予算テーブル」（⚠️ Master / BrandAdmin。headerScreens.tsx）。
 *
 * ─────────────────────────────────────────────
 *   一覧 … ② budget_table_list（backend-express/src/features/budgetTable.ts）
 *   登録 … ② budget_table_upload（CSV の行を budget へ INSERT。⚠️ まず mode = 'check' で確かめ、「登録」で mode = 'save'）
 *   ⚠️ ② も Master / BrandAdmin に絞っている。
 *
 * ⚠️ 上の操作部分（絞り込み・登録・KPI）は固定し、表だけをスクロールさせる（指示書の「上部を fixed」）。
 * ⚠️ 表の中での修正・削除は無い（2026-11-04 決定）。
 * ⚠️ 見た目は GoogleReview.tsx に合わせている（接頭辞 bt_）。⚠️ 閉じるボタンは無い（ページ。HeaderPage.tsx）。
 * ─────────────────────────────────────────────
 */

interface BudgetRow {
    id: number;
    period: string;
    shop: string;
    medium: string;
    value: number;
    note: string;
    company: string;
    remarks: string;
    responseMedium: number;
    category: string;
    section: string;
    orderSection: string;
}

interface Total { rows: number; total: number }

interface ListResponse {
    status: string;
    from: string;
    to: string;
    totals: { all: Total; mkt: Total; pr: Total };
    rows: BudgetRow[];
    truncated: boolean;
    maxRows: number;
    options: { media: string[]; shops: string[] };
}

interface Filter { from: string; to: string; section: string; category: string; medium: string; shop: string; q: string }

interface CheckResult {
    rows: number;
    total: number;
    from: string;
    to: string;
    splitCount: number;
    duplicates: number;
    duplicateLines: number[];
}

type RowError = { line: number; message: string };

/** CSV に必要な見出し（⚠️ budget の列名。⚠️ remarks は無くてもよい・id は無視する。② の checkRow と揃える） */
const REQUIRED_COLUMNS = ['budget_period', 'shop', 'medium', 'budget_value', 'note', 'company', 'response_medium', 'category', 'section', 'order_section'];
const TEMPLATE_COLUMNS = ['budget_period', 'shop', 'medium', 'budget_value', 'note', 'company', 'remarks', 'response_medium', 'category', 'section', 'order_section'];

const SECTION_LABEL: Record<string, string> = { order: '注文', spec: '建売', use: '中古' };

type SortKey = 'period' | 'section' | 'orderSection' | 'shop' | 'medium' | 'category' | 'value' | 'note' | 'company' | 'remarks' | 'id';

const yen = (n: number): string => `¥${n.toLocaleString('ja-JP')}`;

const errorMessage = (e: unknown, fallback: string): string =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** 見本の CSV（見出しと1行の例）を保存させる */
const downloadTemplate = () => {
    const example = ['2026/11/01', 'KH宮崎店', 'イベント', '33000', '2026/11_住まいづくりフェア出展料', 'フルキャスト', '派遣スタッフ', '0', 'MKT', 'order', '宮崎営業課'];
    const body = `${TEMPLATE_COLUMNS.join(',')}\n${example.map((v) => `"${v}"`).join(',')}\n`;
    const url = URL.createObjectURL(new Blob(['﻿', body], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget_template.csv';
    a.click();
    URL.revokeObjectURL(url);
};

const BudgetTable = () => {
    const [filter, setFilter] = useState<Filter>({ from: '', to: '', section: '', category: '', medium: '', shop: '', q: '' });
    const [data, setData] = useState<ListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('period');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // 登録
    const [showUpload, setShowUpload] = useState(false);
    const [fileName, setFileName] = useState('');
    const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
    const [check, setCheck] = useState<CheckResult | null>(null);
    const [rowErrors, setRowErrors] = useState<RowError[]>([]);
    const [uploadError, setUploadError] = useState('');
    const [uploadDone, setUploadDone] = useState('');
    const [busy, setBusy] = useState(false);

    /** ⚠️ 絞り込みは ② で行う（⚠️ 返す行に上限があるため、画面で絞ると漏れる） */
    const load = useCallback(async (next: Filter) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'budget_table_list', ...next });
            const body = res.data as ListResponse;
            if (body?.status !== 'ok') throw new Error('unexpected response');
            setData(body);
            // ⚠️ 期間を空で送ったときは ② の既定（直近3か月）が返るので、欄に反映する
            setFilter((prev) => ({ ...prev, from: body.from, to: body.to }));
        } catch (e) {
            console.error('予算テーブルの取得に失敗しました:', e);
            setError(errorMessage(e, '予算テーブルを読み込めませんでした。時間をおいて「表示」を押してください。'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load({ from: '', to: '', section: '', category: '', medium: '', shop: '', q: '' }); }, [load]);

    const patch = (next: Partial<Filter>) => setFilter((prev) => ({ ...prev, ...next }));
    /** 選ぶだけで絞る項目（期間・キーワードは「表示」で） */
    const applyWith = (next: Partial<Filter>) => {
        const merged = { ...filter, ...next };
        setFilter(merged);
        void load(merged);
    };

    const rows = useMemo(() => {
        const list = data?.rows ?? [];
        const dir = sortOrder === 'asc' ? 1 : -1;
        return [...list].sort((a, b) => {
            const av = a[sortKey];
            const bv = b[sortKey];
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av).localeCompare(String(bv), 'ja') * dir;
        });
    }, [data, sortKey, sortOrder]);

    // -----------------------------------------------------------------------
    // CSV の登録
    // -----------------------------------------------------------------------

    const resetUpload = () => {
        setFileName('');
        setCsvRows([]);
        setCheck(null);
        setRowErrors([]);
        setUploadError('');
    };

    /** ② に送る（⚠️ mode = 'check' は確かめるだけで何も書かない） */
    const send = async (mode: 'check' | 'save', records: Record<string, string>[]) =>
        (await apiClient.post('', { request: 'budget_table_upload', mode, rows: records })).data ?? {};

    const pickCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        resetUpload();
        setUploadDone('');
        setFileName(file.name);
        setBusy(true);
        try {
            const { header, records } = csvToObjects(parseCsv(decodeCsv(await file.arrayBuffer())));
            const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
            if (missing.length > 0) { setUploadError(`CSV の見出しに ${missing.join('・')} がありません。見本の CSV と同じ見出しにしてください。`); return; }
            // ⚠️ 末尾の空行などは除く
            const filled = records.filter((r) => Object.values(r).some((v) => v !== ''));
            if (filled.length === 0) { setUploadError('CSV に行がありません。'); return; }
            const result = await send('check', filled);
            if (result.status !== 'ok') {
                setUploadError(result.message ?? 'CSV を確かめられませんでした。');
                setRowErrors(Array.isArray(result.errors) ? result.errors : []);
                return;
            }
            setCsvRows(filled);
            setCheck(result as CheckResult);
        } catch (error) {
            console.error('CSV の確認に失敗しました:', error);
            setUploadError(errorMessage(error, 'CSV を読み込めませんでした。ファイルの形式をご確認ください。'));
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
        if (check === null || csvRows.length === 0 || busy) return;
        const warn = check.duplicates > 0 ? `\n\n⚠️ 同じ内容がすでにある行が ${check.duplicates} 行あります。登録すると2重になります。` : '';
        if (!window.confirm(`${check.rows.toLocaleString()} 行（合計 ${yen(check.total)}）を予算テーブルに追加します。よろしいですか？${warn}`)) return;
        setBusy(true);
        setUploadError('');
        try {
            const result = await send('save', csvRows);
            if (result.status !== 'ok') {
                setUploadError(result.message ?? '登録できませんでした。');
                setRowErrors(Array.isArray(result.errors) ? result.errors : []);
                return;
            }
            const done = `${fileName} の ${Number(result.inserted).toLocaleString()} 行を登録しました。`;
            resetUpload();
            setUploadDone(done);
            void load(filter);
        } catch (error) {
            console.error('予算テーブルの登録に失敗しました:', error);
            setUploadError(errorMessage(error, '登録できませんでした。時間をおいてもう一度お試しください。'));
        } finally {
            setBusy(false);
        }
    };

    // -----------------------------------------------------------------------

    const th = (label: string, key: SortKey, align?: 'right') => {
        const active = sortKey === key;
        return (
            <th className={`bt_th bt_th_sort${align === 'right' ? ' is_right' : ''}`} title="クリックで並べ替え"
                onClick={() => {
                    if (active) setSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(key); setSortOrder(key === 'period' || key === 'value' || key === 'id' ? 'desc' : 'asc'); }
                }}>
                {label}<span className={`bt_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const kpi = (label: string, total: Total | undefined) => (
        <div className="bt_kpi_card">
            <div className="bt_kpi_label">{label}</div>
            <div className="bt_kpi_value">{yen(total?.total ?? 0)}</div>
            <div className="bt_kpi_sub">{(total?.rows ?? 0).toLocaleString()} 行</div>
        </div>
    );

    return (
        <div className="bt_wrap">
            <style>{`
                .bt_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 12px 40px 20px; box-sizing: border-box; }
                .bt_inner { width: 100%; max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column;
                            min-height: 0; flex: 1; gap: 10px; }
                .bt_fixed { display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; }
                .bt_note { font-size: 11px; color: #6b7280; }
                .bt_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc;
                          border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
                .bt_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .bt_spacer { flex: 1 1 auto; }
                .bt_upload_btn { border: 1px solid #2563eb; color: #2563eb; background: #fff; border-radius: 6px; font-size: 12px;
                                 font-weight: 700; padding: 4px 12px; }
                .bt_upload_btn.is_open, .bt_upload_btn:hover { background: #eff6ff; }
                .bt_upload { border: 1px solid #bfdbfe; background: #f8fbff; border-radius: 10px; padding: 10px 12px;
                             display: flex; flex-direction: column; gap: 8px; }
                .bt_upload_row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                .bt_link { border: none; background: none; padding: 0; color: #1d4ed8; font-size: 11px; cursor: pointer; }
                .bt_link:hover { text-decoration: underline; }
                .bt_check { display: flex; gap: 14px; flex-wrap: wrap; font-size: 12px; }
                .bt_check b { font-variant-numeric: tabular-nums; }
                .bt_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .bt_kpi_card { flex: 1 1 160px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .bt_kpi_label { font-size: 11px; color: #6b7280; }
                .bt_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .bt_kpi_sub { font-size: 11px; color: #9ca3af; font-variant-numeric: tabular-nums; }
                .bt_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; }
                .bt_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
                            padding: 8px 12px; white-space: pre-wrap; }
                .bt_ok { font-size: 12px; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 8px 12px; }
                .bt_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff;
                                 flex: 1 1 auto; min-height: 240px; }
                .bt_table { width: 100%; min-width: 1300px; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .bt_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .bt_th.is_right { text-align: right; }
                .bt_th_sort { cursor: pointer; user-select: none; }
                .bt_th_sort:hover { background: #eef2f7; }
                .bt_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .bt_sort_icon.is_active { color: #2563eb; }
                .bt_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: top; }
                .bt_row:hover > .bt_td { background: #f8fafc; }
                .bt_nowrap { white-space: nowrap; }
                .bt_num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
                .bt_num.is_minus { color: #b91c1c; }
                .bt_sub { font-size: 11px; color: #9ca3af; }
                .bt_pill { display: inline-block; border-radius: 999px; font-size: 11px; font-weight: 700; padding: 1px 8px; white-space: nowrap; }
                .bt_pill.is_mkt { background: #dbeafe; color: #1e40af; }
                .bt_pill.is_pr { background: #fce7f3; color: #9d174d; }
                .bt_pill.is_section { background: #f3f4f6; color: #4b5563; }
                .bt_text { min-width: 180px; overflow-wrap: anywhere; }
                .bt_empty { text-align: center; color: #9ca3af; padding: 32px 0; }
                @media (max-width: 900px) { .bt_wrap { padding: 12px 16px 16px; } }
            `}</style>

            <div className="bt_inner">
                {/* ⚠️ ここから下の .bt_fixed は動かない（表だけがスクロールする） */}
                <div className="bt_fixed">
                    <div className="bt_note">
                        広告費（予算テーブル）の一覧です。CSV で行を追加できます。管理者・ブランド管理者だけが使えます。
                    </div>

                    <div className="bt_bar">
                        <div>
                            <div className="bt_label">期間</div>
                            <div className="d-flex align-items-center gap-1">
                                <input type="month" className="form-control form-control-sm" style={{ width: 140 }} value={filter.from}
                                    onChange={(e) => patch({ from: e.target.value })} aria-label="期間の始め" />
                                <span className="bt_note">〜</span>
                                <input type="month" className="form-control form-control-sm" style={{ width: 140 }} value={filter.to}
                                    onChange={(e) => patch({ to: e.target.value })} aria-label="期間の終わり" />
                            </div>
                        </div>
                        <div>
                            <div className="bt_label">事業</div>
                            <select className="form-select form-select-sm" style={{ width: 100 }} value={filter.section}
                                onChange={(e) => applyWith({ section: e.target.value })} aria-label="事業">
                                <option value="">すべて</option>
                                {Object.entries(SECTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="bt_label">区分</div>
                            <select className="form-select form-select-sm" style={{ width: 90 }} value={filter.category}
                                onChange={(e) => applyWith({ category: e.target.value })} aria-label="区分">
                                <option value="">すべて</option>
                                <option value="MKT">MKT</option>
                                <option value="PR">PR</option>
                            </select>
                        </div>
                        <div>
                            <div className="bt_label">媒体</div>
                            <select className="form-select form-select-sm" style={{ width: 170 }} value={filter.medium}
                                onChange={(e) => applyWith({ medium: e.target.value })} aria-label="媒体">
                                <option value="">すべて</option>
                                {(data?.options.media ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="bt_label">店舗</div>
                            <select className="form-select form-select-sm" style={{ width: 170 }} value={filter.shop}
                                onChange={(e) => applyWith({ shop: e.target.value })} aria-label="店舗">
                                <option value="">すべて</option>
                                {(data?.options.shops ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <div className="bt_label">キーワード</div>
                            <input className="form-control form-control-sm" style={{ width: 200 }} value={filter.q} placeholder="内容・請求先・詳細・営業課"
                                onChange={(e) => patch({ q: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void load(filter); }}
                                aria-label="キーワード" />
                        </div>
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => void load(filter)} disabled={loading}>
                            {loading ? '読み込み中…' : '表示'}
                        </button>
                        <span className="bt_spacer" />
                        <button type="button" className={`bt_upload_btn${showUpload ? ' is_open' : ''}`} onClick={() => setShowUpload((v) => !v)}>
                            <i className="fa-solid fa-upload me-1" aria-hidden="true" />広告費の登録
                        </button>
                    </div>

                    {showUpload && (
                        <div className="bt_upload">
                            <div className="bt_upload_row">
                                <input type="file" accept=".csv,text/csv" className="form-control form-control-sm" style={{ width: 320 }}
                                    onChange={(e) => void pickCsv(e)} disabled={busy} aria-label="登録する CSV" />
                                <button type="button" className="btn btn-sm btn-primary" disabled={check === null || busy} onClick={() => void save()}>
                                    {busy ? '処理しています…' : '登録'}
                                </button>
                                <button type="button" className="bt_link" onClick={downloadTemplate}>見本の CSV を保存</button>
                            </div>
                            <div className="bt_note">
                                見出し：{TEMPLATE_COLUMNS.join(', ')}（remarks は無くても可・id の列は無視します）。
                                CSV を選ぶと、まず中身を確かめます（この時点ではまだ登録しません）。
                            </div>
                            {fileName !== '' && check !== null && (
                                <div className="bt_check" role="status">
                                    <span>{fileName}</span>
                                    <span>行数 <b>{check.rows.toLocaleString()}</b></span>
                                    <span>合計 <b>{yen(check.total)}</b></span>
                                    <span>期間 <b>{check.from}</b> 〜 <b>{check.to}</b></span>
                                    {check.splitCount > 0 && <span>請求先の括弧書きを詳細へ分ける行 <b>{check.splitCount}</b></span>}
                                    <span style={{ color: check.duplicates > 0 ? '#b91c1c' : undefined }}>
                                        同じ内容がすでにある行 <b>{check.duplicates}</b>
                                        {check.duplicates > 0 && `（${check.duplicateLines.join('・')}行目${check.duplicates > check.duplicateLines.length ? ' ほか' : ''}）`}
                                    </span>
                                </div>
                            )}
                            {uploadError !== '' && (
                                <div className="bt_error" role="alert">
                                    {uploadError}
                                    {rowErrors.length > 0 && `\n${rowErrors.slice(0, 10).map((x) => `${x.line}行目: ${x.message}`).join('\n')}${rowErrors.length > 10 ? `\nほか ${rowErrors.length - 10} 行` : ''}`}
                                </div>
                            )}
                            {uploadDone !== '' && <div className="bt_ok" role="status">{uploadDone}</div>}
                        </div>
                    )}

                    {error !== '' && <div className="bt_error" role="alert">{error}</div>}

                    {data && (
                        <div className="bt_kpi">
                            {kpi('広告費の合計', data.totals.all)}
                            {kpi('MKT', data.totals.mkt)}
                            {kpi('PR', data.totals.pr)}
                        </div>
                    )}

                    {data?.truncated && (
                        <div className="bt_caution">
                            ⚠️ 新しい順に {data.maxRows.toLocaleString()} 行までを出しています（上の合計は絞り込み全体の数字です）。期間を短くするか、事業・媒体・店舗で絞ってください。
                        </div>
                    )}
                </div>

                <div className="bt_table_wrap">
                    <table className="bt_table">
                        <thead>
                            <tr>
                                {th('期間', 'period')}
                                {th('事業', 'section')}
                                {th('営業課', 'orderSection')}
                                {th('店舗', 'shop')}
                                {th('媒体', 'medium')}
                                {th('区分', 'category')}
                                {th('金額', 'value', 'right')}
                                {th('内容', 'note')}
                                {th('請求先', 'company')}
                                {th('詳細', 'remarks')}
                                {th('ID', 'id', 'right')}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 && (
                                <tr><td className="bt_td bt_empty" colSpan={11}>{loading ? '読み込み中…' : '該当する行はありません'}</td></tr>
                            )}
                            {rows.map((r) => (
                                <tr key={r.id} className="bt_row">
                                    <td className="bt_td bt_nowrap">{r.period}</td>
                                    <td className="bt_td"><span className="bt_pill is_section">{SECTION_LABEL[r.section] ?? (r.section || '－')}</span></td>
                                    <td className="bt_td bt_nowrap">{r.orderSection}</td>
                                    <td className="bt_td bt_nowrap">{r.shop}</td>
                                    <td className="bt_td bt_nowrap">{r.medium}</td>
                                    <td className="bt_td bt_nowrap">
                                        <span className={`bt_pill ${r.category === 'PR' ? 'is_pr' : 'is_mkt'}`}>{r.category}</span>
                                        {r.responseMedium === 1 && <div className="bt_sub">反響媒体</div>}
                                    </td>
                                    <td className={`bt_td bt_num${r.value < 0 ? ' is_minus' : ''}`}>{yen(r.value)}</td>
                                    <td className="bt_td bt_text">{r.note}</td>
                                    <td className="bt_td">{r.company}</td>
                                    <td className="bt_td bt_text">{r.remarks}</td>
                                    <td className="bt_td bt_num bt_sub">{r.id}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default BudgetTable;
````

### backend/scripts/guide/articles/common/screen-196.md
````markdown
---
title: 予算テーブル
section: 画面の使い方
sort: 196
summary: 登録されている広告費を一覧で確かめ、CSV で広告費をまとめて追加する画面（管理者・ブランド管理者だけ）。
---
ヘッダーの「システム管理 → 予算テーブル」（管理者・ブランド管理者だけ）。Dashboard に登録されている広告費を一覧で確かめ、CSV で広告費をまとめて追加する画面です。ここに入っている広告費が、[[販促媒体別広告費]]・[[店舗別広告費]] などの数字の元になります。

[[画面:予算テーブル]]

## 見方
1. 上の「期間」を選んで「表示」を押します（はじめは今月を含む直近3か月）
2. 「事業」「区分」「媒体」「店舗」は、選ぶとすぐに絞り込みます。「キーワード」は内容・請求先・詳細・営業課から探します。入れたら「表示」を押します
3. 上の数字は、絞り込んだ広告費の合計と、そのうちの MKT・PR の合計です
4. 表の見出しを押すと並べ替えができます。表だけがスクロールし、上の絞り込みはそのまま残ります

> 注意：一度に表に出すのは3,000行までです。それより多いときは黄色い枠が出ます。上の合計は、表に出ていない行も含めた数字です。

## 広告費を CSV で追加する
1. 右上の「広告費の登録」を押します
2. 初めてのときは「見本の CSV を保存」を押し、見本と同じ見出しで CSV を作ります
3. 「ファイルを選択」で CSV を選びます。まず中身だけを確かめ、行数・合計・期間などが出ます（この時点ではまだ登録されません）
4. 内容がよければ「登録」を押し、確認の画面で「OK」を押します

- 1行でも誤りがあると、何も登録しません。誤りのある行と理由が赤い枠に出るので、CSV を直して選び直してください
- 請求先に「フルキャスト(派遣スタッフ)」のように括弧書きがあると、括弧の中は「詳細」に分けて登録します

> 注意：**同じ CSV を2回登録すると、広告費が2重になります。** 確かめた結果の「同じ内容がすでにある行」が0でないときは、本当に追加してよいかを確かめてから登録してください。

> 注意：この画面では、登録した行の修正や削除はできません。イベントの広告費は [[イベントの広告費入力]] で直せます。

## CSV の見出し
見本の CSV と同じ見出しにします。
- **budget_period**：月（例 2026/11/01）
- **shop**：店舗
- **medium**：媒体
- **budget_value**：金額（整数。マイナスも可）
- **note**：内容
- **company**：請求先
- **remarks**：詳細（無くても可）
- **response_medium**：反響媒体なら 1、そうでなければ 0
- **category**：MKT か PR
- **section**：注文は order、建売は spec、中古は use
- **order_section**：営業課

> 要確認：どの費用を MKT・PR にするか、どの媒体名を使うかは、社内のルールを確かめてください。媒体名が今までと違うと、別の媒体として集計されます。

## 関係する記事
- [[イベントの広告費入力]]
- [[販促媒体別広告費]]
- [[店舗別広告費]]
- [[ヘッダーのメニュー]]
````

### backend/scripts/guide/articles/common/screen-197.md
````markdown
---
title: イベントの広告費入力
section: 画面の使い方
sort: 197
summary: 集客イベントの広告費を登録・修正する画面（請求先・詳細の入れ方）。
---
ヘッダーの「集客イベント → 広告費入力」。集客イベントの広告費を登録し、登録済みの広告費を直す画面です。集客サマリーの右上の「広告費入力」からも開けます。

[[画面:イベントの広告費入力]]

## 登録する
1. いちばん上の「新規」の行に、開催月・イベント名・費用・該当店舗・請求先・詳細を入れます
2. 右端の「登録」を押します

- 費用は、選んだ店舗の数で分けて、店舗ごとに登録します（1円未満は切り上げ）
- 登録した行は、すぐ下に追加されます

## 請求先と詳細
- **請求先**：お金を払う相手（例：フルキャスト）
- **詳細**：何の費用かのメモ（例：派遣スタッフ）。空でもかまいません

> 以前は「フルキャスト(派遣スタッフ)」のように、請求先の括弧の中にメモを書いていました。2026年11月から、括弧の中は「詳細」の欄に分けて入っています。これからは請求先に括弧を書かず、「詳細」に入れてください。

## 直す
- 2行目からが登録済みの広告費です（新しい順）。直したい欄を書き換えて、右端の「修正」を押します
- 消す機能はありません。間違えて登録したときは、費用を 0 にして「修正」を押してください

> 注意：同じ内容で「登録」を2回押すと、2組登録されます。

## 関係する記事
- [[予算テーブル]]
- [[ヘッダーのメニュー]]
````

### backend/scripts/sql/2026-11-04_update_log_2.2.243.sql（更新履歴の部分。記事の部分はスクリプトの出力）
````sql
-- =====================================================================
-- v2.2.243 広告費の「詳細」（budget.remarks）・予算テーブルの画面 ＋ update_log
--   （末尾に業務ガイドの記事を入れる）
-- ⚠️ 先に 2026-11-04_budget_remarks.sql（列の追加と請求先の分割）を流すこと
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- =====================================================================

-- 1. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
INSERT INTO update_log (version, date, note) VALUES
('2.2.243', '2026-11-04', '広告費入力に「詳細」の欄を追加した。また、広告費のデータを一覧で確かめ、CSV で登録できる「予算テーブル」の画面を追加した。');

````

## 修正したファイルの差分
````diff
diff --git a/backend-express/src/features/eventBudget.ts b/backend-express/src/features/eventBudget.ts
index 1b479bdcc..85bf5efd6 100644
--- a/backend-express/src/features/eventBudget.ts
+++ b/backend-express/src/features/eventBudget.ts
@@ -96,7 +96,7 @@ const EVENT_SQL = `
  *   件数が増えたらページングに変えること。
  */
 const ENTRY_SQL = `
-  SELECT id, budget_period, shop, budget_value, note, company, section, order_section
+  SELECT id, budget_period, shop, budget_value, note, company, remarks, section, order_section
     FROM budget
    WHERE medium = ?
    ORDER BY id DESC
@@ -126,6 +126,15 @@ const asDate = (value: unknown): string => {
   return asString(value).slice(0, 10);
 };
 
+/**
+ * 詳細（budget.remarks。v2.2.243）。⚠️ 空は NULL で保存する（列の既定値と同じ。空文字と NULL を混ぜない）
+ * ⚠️ 2026-11-04 の SQL で、請求先の括弧書き（'フルキャスト(派遣スタッフ)' の '派遣スタッフ'）をここへ移した。
+ */
+const toRemarks = (value: unknown): string | null => {
+  const s = asString(value).trim();
+  return s === '' ? null : s;
+};
+
 export const runEventBudgetOptions = async (): Promise<EventBudgetResult> => {
   const [shops, events, entries] = await Promise.all([
     query<DynamicRow>(SHOP_SQL),
@@ -184,6 +193,7 @@ export const runEventBudgetOptions = async (): Promise<EventBudgetResult> => {
         cost: Number(r.budget_value),
         title: asString(r.note),
         company: asString(r.company),
+        remarks: asString(r.remarks),
         section: asString(r.section),
         orderSection: asString(r.order_section),
       })),
@@ -206,13 +216,15 @@ interface InputRow {
   title?: unknown;
   /** 請求先（自由入力） */
   company?: unknown;
+  /** 詳細（自由入力。v2.2.243） */
+  remarks?: unknown;
 }
 
 const INSERT_SQL = `
   INSERT INTO budget
-    (budget_period, shop, medium, budget_value, note, company,
+    (budget_period, shop, medium, budget_value, note, company, remarks,
      response_medium, category, section, order_section)
-  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
+  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
 `;
 
 /**
@@ -233,13 +245,13 @@ const toBudgetPeriod = (month: unknown): string | null => {
 // ---------------------------------------------------------------------------
 
 const CURRENT_SQL = `
-  SELECT budget_period, shop, section, order_section
+  SELECT budget_period, shop, remarks, section, order_section
     FROM budget WHERE id = ? AND medium = ?
 `;
 
 const UPDATE_SQL = `
   UPDATE budget
-     SET budget_period = ?, shop = ?, budget_value = ?, note = ?, company = ?,
+     SET budget_period = ?, shop = ?, budget_value = ?, note = ?, company = ?, remarks = ?,
          section = ?, order_section = ?
    WHERE id = ? AND medium = ?
 `;
@@ -369,6 +381,15 @@ export const runEventBudgetUpdate = async (body: unknown): Promise<EventBudgetRe
     orderSection = asString(info.section);
   }
 
+  /**
+   * ⚠️⚠️ **remarks が送られてこなければ今の値を残す。**
+   *   v2.2.242 までの画面は remarks を送らない。② を先にデプロイしたあと、古い画面のまま「修正」を押すと、
+   *   詳細（請求先の括弧書きから移した値）が NULL で消えてしまうため。
+   */
+  const remarks = data.remarks === undefined
+    ? (current.remarks === null || current.remarks === undefined ? null : asString(current.remarks))
+    : toRemarks(data.remarks);
+
   try {
     await execute(UPDATE_SQL, [
       period,
@@ -377,6 +398,7 @@ export const runEventBudgetUpdate = async (body: unknown): Promise<EventBudgetRe
       Math.round(cost),
       title,
       asString(data.company).trim(),
+      remarks,
       section,
       orderSection,
       id,
@@ -397,6 +419,7 @@ export const runEventBudgetUpdate = async (body: unknown): Promise<EventBudgetRe
           cost: Math.round(cost),
           title,
           company: asString(data.company).trim(),
+          remarks: remarks ?? '',
           section,
           orderSection,
         },
@@ -489,6 +512,7 @@ export const runEventBudgetSave = async (body: unknown): Promise<EventBudgetResu
     const perShop = Math.ceil(cost / shops.length);
 
     const company = asString(row.company).trim();
+    const remarks = toRemarks(row.remarks);
 
     for (const shop of shops) {
       const info = shopMap.get(shop);
@@ -516,6 +540,7 @@ export const runEventBudgetSave = async (body: unknown): Promise<EventBudgetResu
           perShop,
           title,
           company,
+          remarks,
           FIXED.responseMedium,
           FIXED.category,
           section,
@@ -530,6 +555,7 @@ export const runEventBudgetSave = async (body: unknown): Promise<EventBudgetResu
           cost: perShop,
           title,
           company,
+          remarks: remarks ?? '',
           section,
           orderSection: info.section,
         },
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 9872fe88e..e41d6778b 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -145,6 +145,7 @@ import { runUpdateLog } from '../features/updateLog';
 import { getLatestLoanRates, uploadLoanRates } from '../features/loanRate';
 import { listLoanPlanRates, uploadLoanPlanRates } from '../features/loanPlanRate';
 import { listSecurityLog } from '../features/securityLog';
+import { BUDGET_TABLE_AUTHORITY, listBudgetTable, uploadBudgetTable } from '../features/budgetTable';
 import { runBeforeSurveyEntry } from '../features/beforeSurvey/entry';
 import { runMemberEntry } from '../features/memberEntry/entry';
 import { runHousingBazarEntry } from '../features/housingBazar/entry';
@@ -3043,6 +3044,36 @@ register({
   handler: async (ctx) => listSecurityLog(ctx.body),
 });
 
+/**
+ * 予算テーブル（v2.2.243）。features/budgetTable.ts 参照。
+ *
+ * ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある。**
+ *   ⚠️ ① の express_proxy.php の ⚠️ **転送リストと転送専用リストの両方**に入れてある。
+ * ⚠️⚠️ **Master と BrandAdmin だけ。** `auth: 'master'` は Master しか通さないので、
+ *   `auth: 'staff'` のうえで BUDGET_TABLE_AUTHORITY を確かめる（staff_contract と同じ形）。
+ */
+register({
+  request: 'budget_table_list',
+  summary: '予算テーブル（budget の期間などで絞った行・件数と金額の合計。Master / BrandAdmin のみ）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    if (!BUDGET_TABLE_AUTHORITY.includes(ctx.staff?.brand ?? '')) return forbidden(ctx);
+    return listBudgetTable(ctx.body);
+  },
+});
+
+register({
+  request: 'budget_table_upload',
+  summary: '【書き込み】予算テーブル: CSV の行を budget へ INSERT（mode = check は確かめるだけ。Master / BrandAdmin のみ）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    if (!BUDGET_TABLE_AUTHORITY.includes(ctx.staff?.brand ?? '')) return forbidden(ctx);
+    return uploadBudgetTable(ctx.body);
+  },
+});
+
 // ---------------------------------------------------------------------------
 // 反響の付帯情報の更新（同期サービス projects/sync から呼ばれる）
 //
diff --git a/backend/scripts/guide/articles/common/screen-105.md b/backend/scripts/guide/articles/common/screen-105.md
index 652c81ca2..379508e05 100644
--- a/backend/scripts/guide/articles/common/screen-105.md
+++ b/backend/scripts/guide/articles/common/screen-105.md
@@ -19,7 +19,7 @@ summary: 画面のいちばん上のメニュー（システム管理・反響
 ## 見られる人
 だれでも開けますが、次の項目は見られる人が決まっています。見られない項目はメニューに出ません。
 - **ローン情報更新**・**広告費シミュレーター**・**セキュリティログ**：管理者だけ
-- **アクセス解析**・**営業別契約率**：管理者・ブランド管理者だけ
+- **アクセス解析**・**営業別契約率**・**予算テーブル**：管理者・ブランド管理者だけ
 - **Claudeによる分析**（メニューの左のボタン）：管理者・ブランド管理者・マネージャーだけ
 - **アクションボード**：注文営業だけ
 
@@ -35,3 +35,5 @@ summary: 画面のいちばん上のメニュー（システム管理・反響
 - [[アンバサダーの反響一覧]]
 - [[オーナーズハウス募集]]
 - [[セキュリティログ]]
+- [[予算テーブル]]
+- [[イベントの広告費入力]]
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index e4f38b2c7..52ceeace0 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -404,6 +404,9 @@ function expressProxyRequests(): array
         'loan_plan_rate_upload',
         // ⚠️ v2.2.242: セキュリティログの一覧（Master。features/securityLog.ts）
         'security_log_list',
+        // ⚠️ v2.2.243: 予算テーブル（Master / BrandAdmin。features/budgetTable.ts）。upload は書き込み（budget へ INSERT）
+        'budget_table_list',
+        'budget_table_upload',
 
         // -----------------------------------------------------------------
         // 2026-09-22 新規。SatBaseサマリー（物件台帳）。
@@ -891,6 +894,9 @@ function expressProxyExclusive(): array
         'loan_plan_rate_upload',
         // ⚠️ v2.2.242: セキュリティログの一覧（Master。features/securityLog.ts）
         'security_log_list',
+        // ⚠️ v2.2.243: 予算テーブル（Master / BrandAdmin。features/budgetTable.ts）。upload は書き込み（budget へ INSERT）
+        'budget_table_list',
+        'budget_table_upload',
 
         // -----------------------------------------------------------------
         // 2026-09-22 新規。SatBaseサマリー（物件台帳）。
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index 76364b277..8ae0a62f5 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -104,6 +104,8 @@ export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     '権限編集': { header: 'システム管理/権限編集' },
     // ⚠️ v2.2.242。headerScreens.tsx と同じく Master だけ
     'セキュリティログ': { header: 'システム管理/セキュリティログ', authority: ['Master'] },
+    // ⚠️ v2.2.243。headerScreens.tsx と同じく Master / BrandAdmin
+    '予算テーブル': { header: 'システム管理/予算テーブル', authority: ADMIN },
 };
 // GUIDE_SCREENS_END
 
diff --git a/frontend/src/components/header/event/EventBudget.tsx b/frontend/src/components/header/event/EventBudget.tsx
index b4e04d4d8..c34bd9a0c 100644
--- a/frontend/src/components/header/event/EventBudget.tsx
+++ b/frontend/src/components/header/event/EventBudget.tsx
@@ -57,6 +57,8 @@ type Entry = {
     cost: number;
     title: string;
     company: string;
+    /** 詳細（budget.remarks。v2.2.243）。⚠️ 未入力（NULL）は空文字で届く */
+    remarks: string;
     section: string;
     orderSection: string;
 };
@@ -74,6 +76,7 @@ type Draft = {
     title: string;
     cost: string;
     company: string;
+    remarks: string;
     shops: string[];
 };
 
@@ -168,7 +171,8 @@ const styles = {
         borderCollapse: 'separate' as const,
         borderSpacing: 0,
         width: '100%',
-        minWidth: '860px'
+        // ⚠️ v2.2.243 で「詳細」の列を足したので 860 → 1020
+        minWidth: '1020px'
     } as React.CSSProperties
 };
 
@@ -182,6 +186,7 @@ const emptyDraft = (): Draft => ({
     title: '',
     cost: '',
     company: '',
+    remarks: '',
     shops: []
 });
 
@@ -300,6 +305,7 @@ const EventBudget = () => {
                 title: next.title,
                 cost: next.cost,
                 company: next.company,
+                remarks: next.remarks,
                 shop: next.shop
             });
             // ⚠️ サーバが実際に保存した内容を返すので、それで置き換える。
@@ -370,7 +376,7 @@ const EventBudget = () => {
     };
 
     const draftHasInput = (d: Draft): boolean =>
-        d.month !== '' || d.title !== '' || d.cost !== '' || d.company !== '' || d.shops.length > 0;
+        d.month !== '' || d.title !== '' || d.cost !== '' || d.company !== '' || d.remarks !== '' || d.shops.length > 0;
 
     /**
      * 新規入力の1行を登録する。
@@ -398,6 +404,7 @@ const EventBudget = () => {
                         title: draft.title,
                         cost: draft.cost,
                         company: draft.company,
+                        remarks: draft.remarks,
                         shops: draft.shops
                     }
                 ]
@@ -546,6 +553,8 @@ const EventBudget = () => {
                                             <th style={{ ...styles.th, width: '120px' }}>費用（円）</th>
                                             <th style={{ ...styles.th, minWidth: '170px' }}>該当店舗</th>
                                             <th style={{ ...styles.th, minWidth: '130px' }}>請求先</th>
+                                            {/* ⚠️ v2.2.243: budget.remarks（以前は請求先の括弧書きに入れていた内容） */}
+                                            <th style={{ ...styles.th, minWidth: '160px' }}>詳細</th>
                                             {/* ⚠️ 右端に固定。見出しは top も固定しているため zIndex を高くする */}
                                             <th style={{ ...styles.th, ...styles.stickyRight, width: '66px', zIndex: 3 }}></th>
                                         </tr>
@@ -622,6 +631,15 @@ const EventBudget = () => {
                                                     onChange={(e) => patchDraft({ company: e.target.value })}
                                                 />
                                             </td>
+                                            <td style={styles.td}>
+                                                <input
+                                                    type="text"
+                                                    style={styles.cellInput}
+                                                    placeholder="例：派遣スタッフ"
+                                                    value={draft.remarks}
+                                                    onChange={(e) => patchDraft({ remarks: e.target.value })}
+                                                />
+                                            </td>
                                             <td style={{ ...styles.td, ...styles.stickyRight, textAlign: 'center' }}>
                                                 {/* ⚠️ 保存中は必ず無効化する。budget に UNIQUE キーが無く、
                                                     二重送信すると同じ行が2組できる */}
@@ -706,6 +724,16 @@ const EventBudget = () => {
                                                             onChange={(e) => patchEntry(entry.id, { company: e.target.value })}
                                                         />
                                                     </td>
+                                                    <td style={styles.td}>
+                                                        <input
+                                                            type="text"
+                                                            style={styles.cellInput}
+                                                            placeholder="詳細"
+                                                            value={v.remarks}
+                                                            title={v.remarks}
+                                                            onChange={(e) => patchEntry(entry.id, { remarks: e.target.value })}
+                                                        />
+                                                    </td>
                                                     <td style={{ ...styles.td, ...styles.stickyRight, textAlign: 'center' }}>
                                                         <button
                                                             type="button"
diff --git a/frontend/src/components/header/headerScreens.tsx b/frontend/src/components/header/headerScreens.tsx
index d3545b7ec..69d48e255 100644
--- a/frontend/src/components/header/headerScreens.tsx
+++ b/frontend/src/components/header/headerScreens.tsx
@@ -5,6 +5,7 @@ import EditAuth from './system/EditAuth';
 import EditShop from './system/EditShop';
 import UploadLoan from './system/UploadLoan';
 import SecurityLog from './system/SecurityLog';
+import BudgetTable from './system/BudgetTable';
 import EditBlackList from './inquiry/EditBlackList';
 import BudgetSimulator from './inquiry/BudgetSimulator';
 import AfterInterview from './inquiry/AfterInterview';
@@ -124,6 +125,8 @@ export const HEADER_SCREENS: HeaderScreen[] = [
     { menu: 'システム管理', item: 'ローン情報更新', path: '/uploadLoan', allow: isMaster, padded: true, render: () => <UploadLoan /> },
     // ⚠️ v2.2.242: セキュリティログは ⚠️⚠️ **Master だけ**（IP・ログインの記録が並ぶため。② の security_log_list も auth: 'master'）
     { menu: 'システム管理', item: 'セキュリティログ', path: '/securityLog', allow: isMaster, render: () => <SecurityLog /> },
+    // ⚠️ v2.2.243: 予算テーブルは ⚠️⚠️ **Master と BrandAdmin**（budget へ CSV で追加できるため。② の budget_table_* も同じ2つ）
+    { menu: 'システム管理', item: '予算テーブル', path: '/budgetTable', allow: isAdmin, render: () => <BudgetTable /> },
 
     // ── 反響管理
     // ⚠️ 販促媒体設定はまだ中身が無い（v2.2.240 までと同じく「準備中」を出す）
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 98941de2a..c53859532 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.242';
+export const newVersion = '2.2.243';
````
