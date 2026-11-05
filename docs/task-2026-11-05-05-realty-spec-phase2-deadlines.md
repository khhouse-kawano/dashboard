# 作業記録 2026-11-05-05　v2.2.249 不動産企画係：連動トリガー仕様書の ② のうち期限

## 依頼
- 「残りの作業をすすめる」。まず v2.2.248 でビルドし直した（`frontend/build/` は 2.2.248）
- 利用者の決定（AskUserQuestion）
  - 仕様書の ② は2つの版に分ける。v2.2.249 で期限、v2.2.250 で媒介物件
  - 休業日は、設定画面の「休業日」のカードで持つ
  - 定休日は火曜・水曜
- 計画を見せ、「進めてよい」の了承を得てから実装した

## 調べたこと
- 休業日の表は、どこにも無い。以前のアプリも、書類に「休業日を除く」と書くだけで、計算はしていなかった
- 今までの台帳の一覧
  - レインズ：期限の日付は無く、未登録なら「要登録」と出すだけ
  - 満了日：専任・専属専任だけ、契約日の3か月後の前日を毎回計算し、30日前から「期限間近」
  - 販売報告：期限は無い
- `property_db`（1,288件）は、ポータルの掲載物件（他社の物件を含む）。仕様書の「媒介物件」とは別物 → v2.2.250 で新しい表を作る

## 変えたこと
### ②（VPS）
- `backend-express/src/features/realty/state.ts`：設定の保存（`SETTINGS_FIELDS`）に `holidays` を足した
  - `weekdays` は 0〜6 の整数の集合（重複は1つにまとめる）。すべての曜日は不可
  - `dates` は 'YYYY-MM-DD' の重複なしで、400日まで
- `backend-express/src/features/realty/importer.ts`：取り込みの仕上げ（`runImportFinish`）
  - 以前のアプリの設定で置き換えるときも、Dashboard にしか無い項目（`DASHBOARD_ONLY_SETTINGS = ['holidays']`）は今の値を残す（`dashboardOnlySettings`）
  - 切り替えの日に休業日が消えるのを防ぐため。計画には無かったが、必要なので足した

### フロント
- **新規** `frontend/src/components/realty/common/deadlines.ts`：期限の計算
  - `holidaysOf`（未設定は火・水）、`addBusinessDays`（翌日から数えて n 営業日目）
  - `reinsDeadline`：専属専任は5営業日、専任は7営業日。一般は null。登録済みは done
  - `reportDeadline`：専属専任は7日、専任は14日。初回は契約日から、2回目からは直近報告日から
  - `expiryDeadline`：満了日は expiry。無ければ契約日の3か月後の前日。14日前から soon
  - `deadlineText`・`deadlineClass`
  - 媒介終了・成約完了の台帳は、期限を出さない
- `frontend/src/components/realty/common/realtyState.ts`：`RealtySettings` に `holidays` を足した
- `frontend/src/components/realty/settings/RealtySettings.tsx`：「🗓 休業日」のカード
  - 定休の曜日のチェックと、個別の日付の追加・削除。変えるとすぐ保存する
  - 未設定のときは、「初期値の火・水で数えています」と出す
- `frontend/src/components/database/DatabaseBroker.tsx`
  - 設定の休業日を読む
  - 「契約満了予定・残日数・更新状態」を `expiryDeadline` にした（一般媒介も出す。14日前から期限間近）
  - REINZ の列：未登録の専任・専属専任は「要登録 11/12（あと3日）」。過ぎたら赤で「N日超過」
  - 新しい列「販売報告」
- `frontend/src/components/database/databaseUtils.ts`：使われなくなった `getContractExpirationDate`・`getRemainingDays`・`getContractStatusInfo` を消した（計算は deadlines.ts へ）

### そのほか
- 版：2.2.249
- SQL：`backend/scripts/sql/2026-11-05_update_log_2.2.249.sql`（update_log と業務ガイド2本）。ローカルに流した（no=348）
- 業務ガイド
  - `common/screen-270.md`「設定（不動産企画係）」：「休業日」の節を足した
  - `common/screen-247.md`「反響から商談案件へのつながり（不動産企画係）」：媒介獲得台帳に「期限の見方」を足した

## テスト
- 期限の計算（deadlines.ts を TypeScript で変換して実行）：16例すべて OK
  - 例：11/5(木) の専属専任 → 11/12、専任 → 11/14（火水を飛ばす）
  - 例：個別の休業日 11/7 を足すと → 11/13
  - 販売報告は初回・2回目・2日前の黄色、満了は expiry・3か月後の末日・14日前と15日前、媒介終了、/ の日付
- 型チェック：フロント・② とも 0。ESLint の今回の範囲の警告 0
- ① を通した確認
  - トークン無しの `planner:settings` → 401
  - 全曜日 → 400、日付の誤り → 400。どちらも保存されない
- Playwright（3100・Master）
  - 設定画面
    - 初めは火・水に印、未設定の案内が出る
    - 月を足すと DB は [1,2,3]。日付2つを足し、1つを消し、月を外すと {[2,3], ["2026-12-30"]}
  - 取り込みの仕上げ：今の設定から holidays を抜いて渡しても、holidays が残った
  - 台帳の一覧（テストの台帳4件）
    - 専属専任・今日の契約 → 満了 90日・有効、REINZ「要登録 11/12（あと7日）」、報告「11/12（あと7日）」
    - 専任・20日前の契約・直近報告が13日前 → REINZ「要登録 10/25（11日超過）」、報告「11/6（あと1日）」
    - 一般・満了10日後 → 「⚠ 期限間近」、REINZ「未登録」、報告「-」
    - 媒介終了 → 満了・報告は「-」
  - ページのエラー：0
- テストの途中で、休業日の日付の追加が保存されない誤りを見つけた。書き込みのときに正規表現の `\d` が `d` になっていたので直し、もう一度すべて通した
- 後片付け
  - テストの台帳と仮スタッフを消し、休業日を未設定に戻した（行数は 2,986）
  - 開発サーバー（3100）を止めた

## 気づいたこと（直していない）
- 媒介終了の台帳でも、REINZ の列は以前のまま「要登録」（赤）と出る。もとの `getReinsStatus` の動きで、今回は変えていない
- 本物の台帳でも、レインズ登録日が入っていない専任・専属専任の多くに「N日超過」が出る（登録日の入力漏れか、未登録）

## 新規ファイルの全文
### frontend/src/components/realty/common/deadlines.ts
```ts
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
```

## 変更の差分（git diff）
```diff
diff --git a/backend-express/src/features/realty/importer.ts b/backend-express/src/features/realty/importer.ts
index d3291e8c8..6d9244e31 100644
--- a/backend-express/src/features/realty/importer.ts
+++ b/backend-express/src/features/realty/importer.ts
@@ -391,6 +391,22 @@ export const runImportRecords = async (body: Record<string, unknown>): Promise<R
 // 仕上げ（planner:import_finish）
 // ---------------------------------------------------------------------------
 
+/**
+ * Dashboard にしか無い設定の項目（v2.2.249〜）。以前のアプリの設定で置き換えるときも、今の値を残す。
+ *   holidays … 休業日（連動トリガー仕様書 ②。features/realty/state.ts の SETTINGS_FIELDS）
+ */
+const DASHBOARD_ONLY_SETTINGS = ['holidays'] as const;
+
+const dashboardOnlySettings = async (): Promise<Record<string, unknown>> => {
+  const rows = await query<DynamicRow>("SELECT `data` FROM app_state WHERE `key` = 'settings' LIMIT 1");
+  // ⚠️ JSON の列は、文字列でもオブジェクトでも返ることがある（index.ts の readSettings と同じく両方を受ける）
+  const raw = rows[0]?.data;
+  const cur = typeof raw === 'string' ? parseJsonText(raw) : raw;
+  const out: Record<string, unknown> = {};
+  if (isObject(cur)) for (const k of DASHBOARD_ONLY_SETTINGS) if (cur[k] !== undefined) out[k] = cur[k];
+  return out;
+};
+
 /**
  * body = { ids: ファイルの全行の id, hide: true/false, hideScope: 'all' | 'imported', settingsJson, weeklyJson, complianceJson（それぞれ文字列にした JSON。parseJsonText の注記） }
  * ⚠️ 行の書き込みが全部終わってから呼ぶ（途中で呼ぶと、まだ書いていない行を「消えた」と判断しないよう ids はファイル全体）
@@ -423,8 +439,10 @@ export const runImportFinish = async (body: Record<string, unknown>): Promise<Re
   const states: string[] = [];
   for (const [key, check] of [['settings', isObject], ['weekly', isObject], ['compliance', Array.isArray]] as const) {
     if (body[`${key}Json`] === undefined) continue;
-    const value = parseJsonText(body[`${key}Json`]);
+    let value = parseJsonText(body[`${key}Json`]);
     if (!check(value)) return fail(400, `${key} の形が正しくありません`);
+    // ⚠️ v2.2.249: Dashboard にしか無い設定の項目（以前のアプリのファイルには無い）は、今の値を残す
+    if (key === 'settings') value = { ...(value as Record<string, unknown>), ...(await dashboardOnlySettings()) };
     await executeLarge(
       'INSERT INTO app_state (`key`, `data`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `data` = VALUES(`data`)',
       [key, JSON.stringify(value)]
diff --git a/backend-express/src/features/realty/state.ts b/backend-express/src/features/realty/state.ts
index 7440bd388..9ab9ab901 100644
--- a/backend-express/src/features/realty/state.ts
+++ b/backend-express/src/features/realty/state.ts
@@ -219,6 +219,22 @@ const SETTINGS_FIELDS: Record<string, (v: unknown) => unknown> = {
       includeBuy: v.includeBuy !== false,
     };
   },
+  // ⚠️ v2.2.249: 休業日（連動トリガー仕様書 ②。レインズ登録の期限を営業日で数える）。
+  //   weekdays = 定休の曜日（0=日〜6=土）、dates = 個別の休業日（'YYYY-MM-DD'。年末年始・夏季・休む祝日など）
+  holidays: (v) => {
+    if (!isObject(v)) throw new InvalidInput('休業日の形が正しくありません');
+    const wd = (Array.isArray(v.weekdays) ? v.weekdays : []).map(Number);
+    if (wd.some((n) => !Number.isInteger(n) || n < 0 || n > 6)) throw new InvalidInput('定休の曜日の形が正しくありません');
+    const weekdays = [...new Set(wd)].sort((a, b) => a - b);
+    if (weekdays.length === 7) throw new InvalidInput('すべての曜日を定休にはできません');
+    const ds = Array.isArray(v.dates) ? v.dates : [];
+    if (ds.length > 400) throw new InvalidInput('個別の休業日は400日までです');
+    const dates = [...new Set(ds.map((d) => String(d)))].sort();
+    for (const d of dates) {
+      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(new Date(`${d}T00:00:00Z`).getTime())) throw new InvalidInput(`休業日の日付が正しくありません: ${d}`);
+    }
+    return { weekdays, dates };
+  },
   // ⚠️ v2.2.226: 今日の架電キューの一言目（要件タグごと。以前のアプリの CQ_SCRIPTS のキー）
   callqScripts: (v) => {
     if (!isObject(v)) throw new InvalidInput('一言目の形が正しくありません');
diff --git a/backend/scripts/guide/articles/common/screen-247.md b/backend/scripts/guide/articles/common/screen-247.md
index cd4e51e0a..ebf639ae1 100644
--- a/backend/scripts/guide/articles/common/screen-247.md
+++ b/backend/scripts/guide/articles/common/screen-247.md
@@ -59,6 +59,21 @@ summary: 売り反響・買い反響の登録と、媒介獲得台帳・商談
 - 媒介も、この画面では新しく作れません。必ず売り反響を「媒介受託」にして作ります。売主がどの反響から来たかを、あとで辿れるようにするためです
 - 一覧は、**媒介契約日の新しい順に、全件を1枚**で出します（ページの切り替えはありません）。媒介契約日が入っていない台帳は、いちばん下に出ます
 
+### 期限の見方
+台帳ごとに、次の3つの期限を出します。期限が近いと**黄色**、過ぎると**赤**になります。媒介終了・成約完了の台帳には出しません。
+- **レインズ（REINZ の列）**：まだ登録していない専属専任媒介・専任媒介に「要登録 11/12（あと3日）」のように出ます
+  - 期限は、媒介契約日の翌日から数えて、専属専任媒介は**5営業日目**、専任媒介は**7営業日目**です
+  - 休業日（[[設定（不動産企画係）]] の「休業日」）は数えません
+  - レインズ登録日を入れると「登録済み」になります
+- **販売報告（販売報告の列）**：次に売主へ報告する期限です
+  - 専属専任媒介は**7日**、専任媒介は**14日**ごとです
+  - 初回は媒介契約日から、2回目からは台帳の「直近報告日」から数えます。報告したら、台帳の編集画面で直近報告日を入れてください
+  - 一般媒介には出ません
+- **契約満了予定・残日数・更新状態**：有効期間の満了日です
+  - 媒介紐付で入れた満了日を使います。入っていない台帳は、媒介契約日の3か月後の前日で数えます
+  - 満了日の**14日前**から「期限間近」、過ぎると「期限切れ」です
+  - 一般媒介にも出します
+
 ### 買付が入ったら（買付登録）
 媒介獲得台帳の「客付・案件」の列の「**🤝買付登録**」を押します。編集の画面で現況を「買付有」にして保存したときも、買付登録の画面を開くか聞かれます。
 - **他社客付け**（他社のお客様が買う）：客付け会社名（必須）・担当者・連絡先を入れます。商談案件管理に「**売**」の案件が1件できます（自社は売主側の片手）
diff --git a/backend/scripts/guide/articles/common/screen-270.md b/backend/scripts/guide/articles/common/screen-270.md
index 3c7030f83..64a2f746f 100644
--- a/backend/scripts/guide/articles/common/screen-270.md
+++ b/backend/scripts/guide/articles/common/screen-270.md
@@ -2,7 +2,7 @@
 title: 設定（不動産企画係）
 section: 画面の使い方
 sort: 270
-summary: 不動産企画係の期首年月・担当者と目標・反響元・反響単価・テンプレート・宅建業者情報・架電キューを直す。以前のアプリのデータと通話記録の取り込み。
+summary: 不動産企画係の期首年月・担当者と目標・反響元・反響単価・テンプレート・宅建業者情報・休業日・架電キューを直す。以前のアプリのデータと通話記録の取り込み。
 ---
 不動産企画係の左のメニュー「設定」で開きます。ここで直した値は、[[チームサマリー（不動産企画係）]]や[[週次行動計画（不動産企画係）]]など、不動産企画係のすべての画面に反映されます。
 
@@ -36,6 +36,15 @@ summary: 不動産企画係の期首年月・担当者と目標・反響元・
 ## 宅建業者情報
 契約書の「乙」欄と記名押印欄に印字する、会社の情報です。
 
+## 休業日
+媒介獲得台帳の**レインズ登録の期限**を数えるときに、休む日を数えないための設定です。チーム全員で共通です。
+- **定休の曜日**：チェックを付けた曜日を休みにします。まだ保存していないときは、火曜・水曜で数えます
+- **個別の休業日**：年末年始・夏季休業など、曜日と関係なく休む日を、日付で1日ずつ足します。×で消せます
+- 祝日は自動では休みになりません。休む祝日は、個別の休業日に入れてください
+- 変えるとすぐ保存され、媒介獲得台帳の期限にすぐ反映されます
+
+> 注意：以前のアプリのデータを取り込んでも、休業日は消えません（以前のアプリには無い設定のため、そのまま残ります）。
+
 ## 架電キュー（抽出ルールと一言目）
 [[今日の架電キュー（不動産企画係）]]に並べるルールと、要件タグごとの一言目です。チーム全員で共通です。
 - 1日に並べる件数（1〜50件）
diff --git a/frontend/src/components/database/DatabaseBroker.tsx b/frontend/src/components/database/DatabaseBroker.tsx
index ae9012642..59d878502 100644
--- a/frontend/src/components/database/DatabaseBroker.tsx
+++ b/frontend/src/components/database/DatabaseBroker.tsx
@@ -1,7 +1,9 @@
 import React, { useState, useMemo, useEffect, useContext, useCallback } from 'react';
 import Modal from 'react-bootstrap/Modal';
 import apiClient from '../../utils/apiClient';
-import { dateFormate, parseTextWithUrl, thStyle, getReinsStatus, getPropertyStatus, getContractExpirationDate, getRemainingDays, getContractStatusInfo } from './databaseUtils';
+import { dateFormate, parseTextWithUrl, thStyle, getReinsStatus, getPropertyStatus } from './databaseUtils';
+import { deadlineClass, deadlineText, expiryDeadline, holidaysOf, reinsDeadline, reportDeadline } from '../realty/common/deadlines';
+import type { Holidays } from '../realty/common/deadlines';
 import PropertyRegister from './PropertyRegister';
 import InformationEditResale from '../information/InformationEditResale';
 import PropertySummary from './PropertySummary';
@@ -38,6 +40,9 @@ export interface BrokerData {
     keyStatus?: string | null;
     baikaiType?: string | null;
     propStatus?: string | null;
+    /** 有効期間の満了日（v2.2.248 の媒介紐付から入る）。直近の販売報告日（v2.2.249 から期限の計算に使う） */
+    expiry?: string | null;
+    lastReportDate?: string | null;
     currentStatus?: string | null;
     /** つないだ商談案件（売側）の id（v2.2.246 の買付登録。以前のアプリの l.dealId） */
     dealId?: string | null;
@@ -96,10 +101,15 @@ const DatabaseBroker = () => {
     const [offerLedger, setOfferLedger] = useState<BrokerData | null>(null);
     const [staffSettings, setStaffSettings] = useState<StaffSetting[]>([]);
     const [dealNoById, setDealNoById] = useState<Record<string, string>>({});
+    // ⚠️ v2.2.249: レインズ登録の期限を営業日で数えるための休業日（設定画面の「休業日」。common/deadlines.ts）
+    const [holidays, setHolidays] = useState<Holidays>(holidaysOf(undefined));
+    /** 今日（期限の残り日数の基準。利用者の PC の日付） */
+    const today = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }, []);
     const loadDeals = useCallback(() => {
         loadRecords(['deals'])
             .then(({ records, settings }) => {
                 setStaffSettings(settings.staff ?? []);
+                setHolidays(holidaysOf(settings.holidays));
                 setDealNoById(Object.fromEntries(records.deals.map(d => [String(d.id), String(d.no ?? '―')])));
             })
             .catch(e => console.error('[DatabaseBroker] 商談案件の読み込みに失敗しました', e));
@@ -429,6 +439,7 @@ const DatabaseBroker = () => {
                                     {/* ⚠️ v2.2.246: 買付登録（他社・自社の客付け）→ 商談案件 */}
                                     <th className="py-2">客付・案件</th>
                                     <th className="py-2">REINZ</th>
+                                    <th className="py-2">販売報告</th>
                                     <th className="py-2">物件状態</th>
                                     <th className="py-2">MAP</th>
                                     <th className="py-2">ポータル連携</th>
@@ -450,9 +461,11 @@ const DatabaseBroker = () => {
                                         const noteParsed = parseTextWithUrl(item.note);
                                         const mapUrl = addressParsed.mapUrl || noteParsed.mapUrl;
 
-                                        const expirationDateStr = getContractExpirationDate(item.contractDate, item.baikaiType);
-                                        const remainingDays = getRemainingDays(expirationDateStr);
-                                        const contractStatusInfo = getContractStatusInfo(remainingDays);
+                                        // ⚠️ v2.2.249: 期限は連動トリガー仕様書 ②（common/deadlines.ts）。満了日は expiry（無ければ契約日の3か月後の前日）。
+                                        //   以前は専任・専属専任だけ、30日前から「期限間近」だった。今は一般も出し、14日前から（仕様書）。媒介終了・成約完了は出さない
+                                        const expiry = expiryDeadline(item, today);
+                                        const reins = reinsDeadline(item, today, holidays);
+                                        const report = reportDeadline(item, today);
 
                                         return (
                                             <tr key={item.id} id={`ledger-row-${String(item.no ?? '')}`} style={focusNo !== '' && String(item.no ?? '') === focusNo ? { outline: '2px solid #fd7e14', background: '#fff3cd' } : undefined}>
@@ -470,18 +483,14 @@ const DatabaseBroker = () => {
                                                 <td>{item.staff || '-'}</td>
                                                 <td className="text-muted">{dateFormate(item.contractDate || '')}</td>
                                                 <td className="text-muted">{dateFormate(item.updated_at || '')}</td>
-                                                <td className="text-muted">{expirationDateStr}</td>
+                                                <td className="text-muted">{expiry ? expiry.date.replace(/-/g, '/') : '-'}</td>
                                                 <td className="text-end fw-bold">
-                                                    {remainingDays !== null ? (
-                                                        <span className={remainingDays < 0 ? 'text-danger' : ''}>
-                                                            {remainingDays}日
-                                                        </span>
-                                                    ) : '-'}
+                                                    {expiry ? <span className={expiry.days < 0 ? 'text-danger' : ''}>{expiry.days}日</span> : '-'}
                                                 </td>
                                                 <td>
-                                                    {remainingDays !== null ? (
-                                                        <span className={`badge ${contractStatusInfo.color}`}>
-                                                            {contractStatusInfo.label}
+                                                    {expiry ? (
+                                                        <span className={`badge ${deadlineClass(expiry.state)}`} title="満了日の14日前から「期限間近」">
+                                                            {expiry.state === 'over' ? '★ 期限切れ' : expiry.state === 'soon' ? '⚠ 期限間近' : '有効'}
                                                         </span>
                                                     ) : <span className="text-muted">-</span>}
                                                 </td>
@@ -522,9 +531,24 @@ const DatabaseBroker = () => {
                                                     )}
                                                 </td>
                                                 <td>
-                                                    <span className={`badge ${getReinsStatus(item.reinsDate, item.baikaiType).color}`}>
-                                                        {getReinsStatus(item.reinsDate, item.baikaiType).label}
-                                                    </span>
+                                                    {/* ⚠️ v2.2.249: 専属専任・専任で未登録なら、期限（契約日の翌日から5・7営業日目）と残りの日数 */}
+                                                    {reins && reins.state !== 'done' ? (
+                                                        <span className={`badge ${deadlineClass(reins.state)}`} title="レインズ登録の期限（休業日を数えない）">
+                                                            要登録 {deadlineText(reins)}
+                                                        </span>
+                                                    ) : (
+                                                        <span className={`badge ${getReinsStatus(item.reinsDate, item.baikaiType).color}`}>
+                                                            {getReinsStatus(item.reinsDate, item.baikaiType).label}
+                                                        </span>
+                                                    )}
+                                                </td>
+                                                <td>
+                                                    {/* ⚠️ v2.2.249: 次の販売報告の期限（初回は契約日から、2回目からは直近の報告日から。専属専任7日・専任14日） */}
+                                                    {report ? (
+                                                        <span className={`badge ${deadlineClass(report.state)}`} title={item.lastReportDate ? `直近の報告 ${dateFormate(item.lastReportDate)}` : '初回の販売報告'}>
+                                                            {deadlineText(report)}
+                                                        </span>
+                                                    ) : <span className="text-muted">-</span>}
                                                 </td>
                                                 <td>
                                                     <span className={`badge ${getPropertyStatus(item.propStatus ?? '').color}`}>
@@ -573,7 +597,7 @@ const DatabaseBroker = () => {
                                     })
                                 ) : (
                                     <tr>
-                                        <td colSpan={20} className="text-center py-4 text-muted">
+                                        <td colSpan={21} className="text-center py-4 text-muted">
                                             該当するデータが見つかりません。
                                         </td>
                                     </tr>
diff --git a/frontend/src/components/database/databaseUtils.ts b/frontend/src/components/database/databaseUtils.ts
index 1ca405bed..ac5b2a06b 100644
--- a/frontend/src/components/database/databaseUtils.ts
+++ b/frontend/src/components/database/databaseUtils.ts
@@ -75,51 +75,8 @@ export const getPropertyStatus = (status?: string) => {
 };
 
 
-export const getContractExpirationDate = (contractDate?: string | null, baikaiType?: string | null): string => {
-    if (!contractDate || !baikaiType) return '-';
-    if (baikaiType !== '専任媒介' && baikaiType !== '専属専任媒介') return '-';
-
-    const date = new Date(contractDate);
-
-    date.setMonth(date.getMonth() + 3);
-    date.setDate(date.getDate() - 1);
-
-    const y = date.getFullYear();
-    const m = String(date.getMonth() + 1).padStart(2, '0');
-    const d = String(date.getDate()).padStart(2, '0');
-
-    return `${y}/${m}/${d}`;
-};
-
-export const getRemainingDays = (expirationDateStr: string): number | null => {
-    if (expirationDateStr === '-') return null;
-
-    // 今日の日付を取得（時間は00:00:00にリセットして純粋な日付比較にするのがTS/JSの鉄則）
-    const today = new Date();
-    today.setHours(0, 0, 0, 0);
-
-    const expDate = new Date(expirationDateStr);
-    expDate.setHours(0, 0, 0, 0);
-
-    // 差分（ミリ秒）を日数に変換
-    const diffTime = expDate.getTime() - today.getTime();
-    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
-
-    return diffDays;
-};
-
-export const getContractStatusInfo = (remainingDays: number | null) => {
-    if (remainingDays === null) return { label: '-', color: 'bg-light text-secondary' };
-
-    if (remainingDays >= 30) {
-        return { label: '有効', color: 'bg-success' }; // OKの代わりの表現
-    } else if (remainingDays >= 0) {
-        return { label: '⚠ 期限間近', color: 'bg-warning text-dark' };
-    } else {
-        return { label: '★ 期限切れ', color: 'bg-danger' };
-    }
-};
-
+// ⚠️ v2.2.249: 満了日・残り日数・更新状態の計算（getContractExpirationDate・getRemainingDays・getContractStatusInfo）は
+//   realty/common/deadlines.ts へ移した（連動トリガー仕様書 ②。満了日は expiry を使い、14日前から警告）
 
 export const kataToHira = (str: string | null | undefined): string => {
     if (!str) return '';
diff --git a/frontend/src/components/realty/common/realtyState.ts b/frontend/src/components/realty/common/realtyState.ts
index bc6b0f4a5..2fab3b86e 100644
--- a/frontend/src/components/realty/common/realtyState.ts
+++ b/frontend/src/components/realty/common/realtyState.ts
@@ -8,6 +8,7 @@
 import apiClient from '../../../utils/apiClient';
 import { callsOf, prevMonth } from '../summary/kpi';
 import type { Row, Settings, StaffSetting } from '../summary/kpi';
+import type { Holidays } from './deadlines';
 
 export type Template = { id: string; title: string; body: string };
 
@@ -30,6 +31,8 @@ export type RealtySettings = {
     callq?: Record<string, unknown>;
     /** 今日の架電キューの一言目（v2.2.226。要件タグ → 文面） */
     callqScripts?: Record<string, string>;
+    /** 休業日（v2.2.249。定休の曜日と個別の日付。媒介獲得台帳のレインズ登録の期限を営業日で数える。common/deadlines.ts） */
+    holidays?: Holidays;
 };
 
 /** 週次行動計画の1行（担当者 × 週）。g = 目標・a = 実績。c 架電・t 追客・n 内見・s 商談 */
diff --git a/frontend/src/components/realty/settings/RealtySettings.tsx b/frontend/src/components/realty/settings/RealtySettings.tsx
index d49791194..e2fd93b8b 100644
--- a/frontend/src/components/realty/settings/RealtySettings.tsx
+++ b/frontend/src/components/realty/settings/RealtySettings.tsx
@@ -9,6 +9,7 @@ import {
 } from '../common/realtyState';
 import type { Company, RealtySettings as Settings, Template } from '../common/realtyState';
 import type { StaffSetting } from '../summary/kpi';
+import { holidaysOf } from '../common/deadlines';
 
 /**
  * 設定（不動産企画係。v2.2.223）。
@@ -18,10 +19,13 @@ import type { StaffSetting } from '../summary/kpi';
  * ⚠️ 本番アプリの次のカードはまだ移していない（それを使う画面と一緒に移す）:
  *   買取再販の粗利の計算方式・経費科目マスタ／売主への販売報告／データ管理（バックアップ・CSV）
  * ⚠️ v2.2.226: 「架電キュー（抽出ルールと一言目）」（V16.settingsCard）と、以前のアプリの通話記録・練習記録の取り込み（マスター）を足した
+ * ⚠️ v2.2.249: 「休業日」（連動トリガー仕様書 ②。媒介獲得台帳のレインズ登録の期限を営業日で数える。common/deadlines.ts）を足した。
+ *   以前のアプリには無い項目。⚠️ 以前のアプリの設定を取り込んでも消えない（② の importer.ts の DASHBOARD_ONLY_SETTINGS）
  */
 
 const MAX_STAFF = 10;
 const MAX_TEMPLATES = 30;
+const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
 
 /** 宅建業者情報の欄（本番アプリの DEFAULT_COMPANY と同じ並び） */
 const COMPANY_FIELDS: { key: keyof Company; label: string; wide?: boolean; placeholder?: string }[] = [
@@ -114,6 +118,21 @@ const RealtySettings: React.FC = () => {
     const buyPortals = settings.buyPortals ?? [];
     const templates = settings.templates ?? [];
     const company = settings.company ?? {};
+    // ⚠️ v2.2.249: 未設定のときは初期値（定休は火・水）。曜日・日付を変えたらすぐ保存する
+    const holidays = holidaysOf(settings.holidays);
+    const [newHoliday, setNewHoliday] = useState('');
+    const toggleWeekday = (d: number) => {
+        const weekdays = holidays.weekdays.includes(d) ? holidays.weekdays.filter(x => x !== d) : [...holidays.weekdays, d].sort((a, b) => a - b);
+        if (weekdays.length === 7) { alert('すべての曜日を定休にはできません'); return; }
+        editAndSave('holidays', { ...holidays, weekdays });
+    };
+    const addHoliday = () => {
+        if (!/^\d{4}-\d{2}-\d{2}$/.test(newHoliday)) return;
+        if (holidays.dates.includes(newHoliday)) { alert('既に登録されています'); return; }
+        editAndSave('holidays', { ...holidays, dates: [...holidays.dates, newHoliday].sort() });
+        setNewHoliday('');
+    };
+    const removeHoliday = (d: string) => editAndSave('holidays', { ...holidays, dates: holidays.dates.filter(x => x !== d) });
 
     const setStaff = (i: number, field: keyof StaffSetting, value: string | number) =>
         edit('staff', staff.map((s, j) => (j === i ? { ...s, [field]: value } : s)));
@@ -309,6 +328,35 @@ const RealtySettings: React.FC = () => {
                 </div>
             </div>
 
+            <div className="rlt-card">
+                <div className="rlt-card-head">
+                    <h3>🗓 休業日</h3>
+                    <span className="rlt-note">媒介獲得台帳のレインズ登録の期限（専属専任は契約日の翌日から5営業日、専任は7営業日）を数えるときに、この日を数えません。チーム全員で共有されます</span>
+                </div>
+                <div className="rlt-body">
+                    <div style={{ marginBottom: 8 }}>
+                        <span style={{ fontSize: 11, color: '#6c757d', marginRight: 8 }}>定休の曜日</span>
+                        {WEEKDAY_LABELS.map((w, d) => (
+                            <label key={w} style={{ marginRight: 10, cursor: 'pointer' }}>
+                                <input type="checkbox" checked={holidays.weekdays.includes(d)} onChange={() => toggleWeekday(d)} aria-label={`定休 ${w}曜日`} /> {w}
+                            </label>
+                        ))}
+                        {settings.holidays === undefined && <span className="rlt-note" style={{ marginLeft: 8 }}>（未設定のため、初期値の火・水で数えています）</span>}
+                    </div>
+                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
+                        <span style={{ fontSize: 11, color: '#6c757d' }}>個別の休業日（年末年始・夏季休業・休む祝日など）</span>
+                        <input type="date" className="rlt-input" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} aria-label="追加する休業日" />
+                        <button className="rlt-btn sec" disabled={!newHoliday} onClick={addHoliday}>追加</button>
+                    </div>
+                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
+                        {holidays.dates.length === 0 && <span className="rlt-note">登録されていません</span>}
+                        {holidays.dates.map(d => (
+                            <span key={d} className="rlt-chip">{d.replace(/-/g, '/')}<button className="rlt-icon" title="削除" onClick={() => removeHoliday(d)}>×</button></span>
+                        ))}
+                    </div>
+                </div>
+            </div>
+
             <div className="rlt-card">
                 <div className="rlt-card-head">
                     <h3>📞 架電キュー（抽出ルールと一言目）</h3>
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index d016f2033..a3eae3e6e 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.248';
+export const newVersion = '2.2.249';
```
