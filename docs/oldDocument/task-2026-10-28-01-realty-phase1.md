# 作業記録 2026-10-28-01　v2.2.221 不動産企画係アプリの移植（第1段：入口と安全）

## 指示（ReadMeClaude.md）
- https://khf-eigyokanri.netlify.app/ のアプリを Dashboard に完全移植する（セキュリティリスクの高まりのため）
- frontend/src/components/lead がこれまでの分。発展させるか作り直すかはエージェントで判断
- Dashboard に合わせず、ほぼ独立した機能。運用部署は不動産企画係。適した category 名・ディレクトリ名をエージェントで決める
- brokerage_listings を使い、アプリが返す JSON をそのまま使う（必要なら表を改修）
- イエイ・イエウール・すまいステップ・HOME'S・SUUMO のポータル反響の取り込みはこれまでどおり

## 決めたこと（2026-10-28。利用者の回答: 1=b、2〜4=OK、「この案件はエージェント側でほぼ進めてよい」）
- **作り直さず発展させる**（読み書き・データの対応づけ・ポータルの取り込みは動いているため）
- category: `realty`（表示名 不動産企画係）。ディレクトリ: `components/realty/`
- 段階: v2.2.221 入口と安全 → v2.2.222 チームサマリーを実データに → v2.2.223 設定・週報・コンプラ → 以降 本番にしか無い画面
- 元のファイルは、Supabase のキーの形（JWT・sb_publishable_ など）を sed で伏せた写しだけを読む（スクラッチパッドに置き、リポジトリに入れない）

## 調べて分かったこと
- **本番アプリ（URL）と Downloads/source.html は一致していない。本番が新しい**
  - 変更の印: source.html は V12 まで、本番は V18 まで（source.txt は source.html より古い）
  - メニュー: source.html 14項目 → 本番 18項目。本番にだけある画面は「今日の架電キュー」「架電ナビ（一括査定）」「失注・他決の分析」「売主への販売報告」。データの種類に comments が増えている
  - → 移植の手本は本番アプリ。部署は今も本番アプリ（Supabase）に入力しているので、切り替えの日に最新を取り込み直す（extId でポータル取り込み分と突き合わせる）
- brokerage_listings は Supabase の records を約120列に展開したもの（約1,270件。元の JSON は raw_data）。app_state に settings・weekly・compliance
- ポータルの取り込み（イエイ・イエウール・すまいステップ・athome・HOME'S・SUUMO）は既に brokerage_listings に入る（カエールは入らない）
- **セキュリティの穴**: ① の planner / broker / activity / addTale は**ログインしていなくても読み書きできた**。通知は画面が送る名前を信じていた。移植元の顧客データ data.json（1.2MB）・app_state.json が Git に入り、Web で読める場所（handlers/）にあった
- チームサマリーは数字が固定（作りかけ）。設定画面・週報・コンプラは無い

## したこと
### 画面（frontend）
- `components/lead` と `components/summary`・`MonthlySalesReport.tsx` を `components/realty/` に移した（git mv）
  - `sell/LeadSell` `buy/LeadBuy` `deals/LeadOpportunity` `resale/LeadResale` `summary/Summary・summaryUtiles` `report/MonthlySalesReport`
  - `common/` LeadEdit・LeadCall・LeadHeader・LeadHistory・LeadNotifications・leadUtiles、`documents/` DocumentViewer・PlannerGenerator・documentUtils
  - import の道のりを直した（中身は変えていない）。媒介獲得台帳（database/DatabaseBroker）は掲載物件一覧と部品を共有するため移していない
- **新規 `realty/RealtyRoute.tsx`**（`RealtyRoute`・`REALTY_SHOPS`）: 担当事業が realty / all の人だけ通す。ほかは /home へ
- `App.tsx`: ルートを `/realty/summary` `/realty/report` `/realty/sell` `/realty/buy` `/realty/deals` `/realty/resale` `/realty/ledger` に（RealtyRoute で包む）。旧 URL（/summary・/report・/leadSell・/leadBuy・/leadOpportunity・/leadResale・/broker）は新しい URL へ Navigate
- `Category.tsx`: `planner` → `realty`、遷移先 `/realty/summary`
- `Menu.tsx`: `planner` → `realty`、URL を新しいものに。商談案件の id が月次報告書と重複（'report'）していたのを 'deals' に
- `AuthProvider.tsx`: 保存されている category が `planner` なら `realty` に読み替える
- `EditAuth.tsx`: 担当事業の選択肢に「不動産企画係（realty）」
- `DatabaseProperty.tsx`・`PropertySummary.tsx`・`DailyAction.tsx`（コメント）: planner → realty
- `version.ts`: 2.2.221

### ②（backend-express）
- **新規 `features/realty/index.ts`**: `REALTY_SHOPS` `BROKER_SHOPS` `runPlannerLead` `runPlannerSummary` `runBrokerList` `runBrokerCustomer` `runBrokerUpdate`（UPSERT。`toSqlValue`。本文が大きいので executeLarge）`runActivityHistory` `runActivityNotice` `runActivityRead`（本人宛だけ。名前は空白を除いて突き合わせる）`shopForbidden`
- `gateway/registry.ts`: planner:lead / summary、broker:list / report / customer / update、activity:history / notice / read を auth: 'staff' で登録し、`realty()` で担当事業を確かめる
- `features/staffAdmin.ts`: `AUTH_SHOPS` に realty

### ①（backend）
- `core/authz.php`: `AUTHZ_REALTY_SHOPS` `AUTHZ_BROKER_SHOPS` `requireShop()`
- `core/express_proxy.php`: 上の9つを転送。broker:update・activity:read は ② だけ（二重書き込みを防ぐ）
- `handlers/planner.php`・`broker.php`・`activity.php`: `requireShop()`。activity は宛先を本人に差し替え。planner の roll から存在しない `detail` を外した（呼ぶと致命的エラーだった）
- `handlers/activityAction/activity_notice.php`・`activity_read.php`: 宛先を空白を除いて突き合わせる
- `handlers/addTale.php`: Web からの実行は `requireMaster()`
- `handlers/data.json`・`app_state.json` を git rm（スクラッチパッドに退避）し、.gitignore に追加

### 業務ガイド
- 新規記事 **不動産企画係の画面（入口と権限）**（common/screen-230.md）: 入れる人、入り方、担当事業の変え方、通知、旧アドレス

## テスト
- ① 経由: トークン無し 401／注文 403／中古は broker:* だけ 200／不動産企画係 200（planner・broker・activity の全 roll）。broker:update はトークン無し 401・注文 403。addTale はトークン無し 401・一般 403
- ① の PHP（X-Forwarded-By で ① 自身に処理させる）と ② の応答を突き合わせ: planner:lead・summary、broker:list・customer、activity:history・notice が**1文字も違わず一致**
- 通知: 画面が他人の名前を送っても本人宛の2件だけ（全角空白の宛先も拾う）。他人の通知の id を含めて既読にしても本人の分だけ変わる
- 保存: 新規（配列・オブジェクトは JSON 文字列、空文字は NULL、真偽値は 0/1、許可されない列は捨てる）、light、全件返す、項目なし、ID なし（400）
- ② を止める: 読み出しは ① の予備が 200（注文の人は ① でも 403）、書き込みは 502（書き込まれていない）
- Playwright: 不動産企画係の人で 7画面すべて開いてデータが出る。旧 URL（/leadSell・/broker）が新しい URL へ。保存されていた planner が realty に。事業選択 →「不動産企画係」→ /realty/summary。注文の人が /realty/sell を直接開くと /home。権限編集の担当事業に「不動産企画係」
- ② の型チェック・① の PHP の構文・フロントのビルドが通る（ビルドの警告は移動前からあるもの）
- 整理（`toSqlValue` に JSON 列の扱いをまとめた）のあと、認証・一致・保存のテストをもう一度通した
- テストのスタッフ・行は消した

## 次の段（v2.2.222 以降）
- チームサマリーを実データに（KPI・架電の集計・年間予算の進捗）
- 設定画面（担当者と目標・反響元と単価・テンプレート・会社情報）・週報・コンプライアンス（app_state）
- 本番にしか無い画面: 今日の架電キュー・架電ナビ・失注・他決の分析・売主への販売報告、comments
- 切り替えの日に Supabase の最新を取り込み直す手順（addTale / migrate-supabase.mjs）

---
# 新規ファイル（全文）

## backend-express/src/features/realty/index.ts
```
import type { RowDataPacket } from 'mysql2/promise';
import { executeLarge, query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';

/**
 * 不動産企画係（category = realty）のデータ（v2.2.221 で ① から移植）。
 *
 * ─────────────────────────────────────────────
 * 移植元: backend/src/handlers/planner.php・broker.php・activity.php と、その *Action/*.php
 *   planner:lead / planner:summary            … 案件一覧・チームサマリー（読み出し）
 *   broker:list / broker:report / broker:customer … 媒介台帳など（読み出し）
 *   broker:update                              … 1件の保存（UPSERT）
 *   activity:history / activity:notice / activity:read … 変更履歴・通知・既読
 *
 * ⚠️⚠️ v2.2.220 までは ① で**ログインしていなくても読み書きできた**。移植と同時に確かめるようにした。
 *   ・不動産企画係の画面のもの … 担当事業（staff.shop）が realty / all の人だけ
 *   ・broker:*                  … さらに used（中古リノベ）も可（中古の顧客DB・顧客詳細が broker:update で台帳を書く）
 * ⚠️ 通知（activity:notice / read）は**ログインしている本人の分だけ**。
 *   v2.2.220 までは画面が送る `to`（名前）を信じていたため、他人の通知を読めた。
 *
 * ⚠️ 応答の形は ① と同じ（画面を変えずに済むように）。値の型も ① と同じ
 *   （① は PDO::ATTR_EMULATE_PREPARES=false で数値を数値のまま返す。gateway/phpCompat.ts の注記）。
 * ─────────────────────────────────────────────
 */

/** 不動産企画係の画面を使える担当事業 */
export const REALTY_SHOPS = ['realty', 'all'];
/** 媒介台帳（broker:*）を使える担当事業。⚠️ 中古の顧客DB・顧客詳細も台帳を読み書きする */
export const BROKER_SHOPS = ['realty', 'all', 'used'];

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface Result {
  httpStatus: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown>): Result => ({ httpStatus: 200, body });
const fail = (httpStatus: number, message: string): Result => ({ httpStatus, body: { status: 'error', message } });

/** 名前の突き合わせ用。⚠️ 空白（全角を含む）を落とす（staff と staff_list で表記が揺れる） */
const norm = (value: unknown): string => String(value ?? '').replace(/[\s　]/g, '');

/** SQL の中で `to` の空白を落とす式（norm と同じ） */
const TO_NORM = "REPLACE(REPLACE(`to`, ' ', ''), '　', '')";

// ---------------------------------------------------------------------------
// planner（不動産企画係の案件・サマリー）
// ---------------------------------------------------------------------------

const realtyStaffList = (): Promise<DynamicRow[]> =>
  query<DynamicRow>("SELECT * FROM staff_list WHERE shop = '不動産企画係'");

/** 移植元: plannerAction/planner_lead.php。⚠️ kind で絞るのは画面側 */
export const runPlannerLead = async (): Promise<Result> => {
  const [lead, staff] = await Promise.all([
    query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind IN ('leads', 'buyLeads', 'ledger', 'resales')"),
    realtyStaffList(),
  ]);
  return ok({ lead, staff });
};

/** 移植元: plannerAction/planner_summary.php。⚠️ settings が無くても空のオブジェクトを返す */
export const runPlannerSummary = async (): Promise<Result> => {
  const [lead, staff, state] = await Promise.all([
    query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind IN ('leads', 'buyLeads')"),
    realtyStaffList(),
    query<DynamicRow>("SELECT `data` FROM app_state WHERE `key` = 'settings' LIMIT 1"),
  ]);
  let settings: unknown = {};
  try {
    const raw = state[0]?.data;
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed !== null && typeof parsed === 'object') settings = parsed;
  } catch {
    settings = {};
  }
  // ⚠️ PHP の json_decode(…, true) は空のオブジェクトを [] にする。画面は Object として読むので {} で返す
  return ok({ lead, staff, settings: Array.isArray(settings) && settings.length === 0 ? {} : settings });
};

// ---------------------------------------------------------------------------
// broker（媒介台帳など）
// ---------------------------------------------------------------------------

/** 移植元: brokerAction/broker_list.php・broker_report.php（中身は同じ） */
export const runBrokerList = async (): Promise<Result> => {
  const [brokerage, staff] = await Promise.all([
    query<DynamicRow>('SELECT * FROM brokerage_listings'),
    query<DynamicRow>('SELECT * FROM staff_list WHERE rank = 1'),
  ]);
  return ok({ brokerage, staff });
};

/** 移植元: brokerAction/broker_customer.php */
export const runBrokerCustomer = async (): Promise<Result> => {
  const [customer, property] = await Promise.all([
    query<DynamicRow>('SELECT * FROM master_data_resale WHERE show_dashboard = 1'),
    query<DynamicRow>('SELECT * FROM property_db'),
  ]);
  return ok({ customer, property });
};

/**
 * 保存してよい列（移植元: broker_update.php の $allowedColumns と同じ）。
 * ⚠️ ここに無いキーは黙って捨てる。列を足したらここにも足す。
 * ⚠️ 列名を SQL に直接埋め込むので、**この配列にある値以外を入れないこと**。
 */
const ALLOWED_COLUMNS = [
  'kind', 'no', 'note', 'staff', 'category', 'phase', 'show_dashboard',
  'addr', 'addr1', 'addr2', 'property', 'targetProperty', 'propName',
  'price', 'budget', 'fee', 'feeManual',
  'seller', 'buyer', 'customer', 'name', 'source', 'portal', 'contact', 'phone', 'mail',
  'freq', 'keyInfo', 'keyStatus', 'baikaiType', 'propStatus', 'currentStatus',
  'expiry', 'expiryFix', 'reinsDate', 'priceRevDate', 'lastReportDate',
  'type', 'priority', 'dealId', 'dealNo', 'ledgerId', 'ledgerNo', 'extId',
  'subStaff', 'subRatio', 'coBroker', 'delivery',
  'reason', 'timing', 'endReason', 'callDates', 'nextDate', 'nextNote',
  'receivedDate', 'connectDate', 'visitDate', 'viewDate', 'baikaiDate',
  'contactDate', 'contractDate', 'settleDate', 'followDate',
  'inputDate', 'renewDate', 'applicationDate',
  'status', 'costs', 'targetGp',
  'buyPrice', 'buyBuilding', 'buySellerReg', 'buyStockAsset',
  'taxCheckDate', 'buyContractDate', 'buySettleDate',
  'listPrice', 'listDate',
  'sellPrice', 'sellBuilding', 'sellStaff', 'sellContractDate', 'sellSettleDate',
  'at', 'to', 'from', 'field', 'label', 'entity', 'entityId', 'entityNo',
  'title', 'body', 'read', 'by', 'data', 'updatedAt',
  'deleted_at', 'deleted_by',
  'docDraft', 'docDraftAt', 'docDraftBy',
  'master_data_id', 'property_db_id', 'property_db_name',
  'raw_data',
] as const;

type SqlValue = string | number | null;

/**
 * 画面から来た値を DB に書く形にする（移植元と同じ: 空文字は NULL、真偽値は 0/1）。
 * ⚠️ 配列・オブジェクトは JSON 文字列にする（callDates・costs・coBroker・data・raw_data・docDraft。移植元の $jsonColumns）。
 *   ⚠️ 移植元はそれ以外の列のオブジェクトで PDO が落ちていた。ここでは落とさずに文字列で保存する。
 */
const toSqlValue = (value: unknown): SqlValue => {
  if (value === '' || value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

/**
 * 移植元: brokerAction/broker_update.php（UPSERT）。
 * ⚠️ 本文が 64KB を超えることがある（raw_data・docDraft）ため executeLarge で書く（db/pool.ts の注記）。
 */
export const runBrokerUpdate = async (body: Record<string, unknown>): Promise<Result> => {
  const id = typeof body.id === 'string' || typeof body.id === 'number' ? String(body.id).trim() : '';
  if (id === '') return fail(400, 'IDがありません');

  const data = body.data !== null && typeof body.data === 'object' && !Array.isArray(body.data)
    ? (body.data as Record<string, unknown>)
    : {};

  const columns = ['`id`'];
  const updates: string[] = [];
  const params: SqlValue[] = [id];
  for (const column of ALLOWED_COLUMNS) {
    if (!Object.prototype.hasOwnProperty.call(data, column)) continue;
    columns.push(`\`${column}\``);
    updates.push(`\`${column}\` = VALUES(\`${column}\`)`);
    params.push(toSqlValue(data[column]));
  }

  if (columns.length === 1) return ok({ status: 'success', message: '更新データなし' });

  await executeLarge(
    `INSERT INTO \`brokerage_listings\` (${columns.join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
    params
  );

  const rows = await query<DynamicRow>('SELECT * FROM brokerage_listings WHERE `id` = ?', [id]);
  const row = rows[0] ?? null;

  // ⚠️ light = true のときは全件を返さない（1,200行 × 100列超。セル単位の編集で毎回返すと重い）
  if (body.light === true || body.light === 1 || body.light === '1' || body.light === 'true') {
    return ok({ status: 'success', row });
  }
  const brokerage = await query<DynamicRow>('SELECT * FROM brokerage_listings');
  return ok({ status: 'success', row, brokerage });
};

// ---------------------------------------------------------------------------
// activity（変更履歴・通知）
// ---------------------------------------------------------------------------

const clampInt = (value: unknown, fallback: number, max: number): number => {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || value === undefined || value === null || value === '') return fallback;
  return Math.max(1, Math.min(max, n));
};

/** 移植元: activityAction/activity_history.php */
export const runActivityHistory = async (body: Record<string, unknown>): Promise<Result> => {
  const entityId = typeof body.entityId === 'string' ? body.entityId : '';
  // ⚠️ LIMIT はプレースホルダにしない（mysql2 の execute は LIMIT ? を受け付けない）。数値に丸めて埋め込む
  const limit = clampInt(body.limit, 50, 500);
  const history = await query<DynamicRow>(
    `SELECT \`id\`, \`at\`, \`by\`, \`entity\`, \`entityId\`, \`entityNo\`, \`label\`,
            \`field\`, \`from\`, \`to\`, \`note\`
       FROM \`brokerage_listings\`
      WHERE kind = 'logs'${entityId === '' ? '' : ' AND `entityId` = ?'}
      ORDER BY \`at\` DESC, \`internal_id\` DESC
      LIMIT ${limit}`,
    entityId === '' ? [] : [entityId]
  );
  return ok({ status: 'success', history });
};

const countUnread = async (name: string): Promise<number> => {
  const rows = await query<RowDataPacket & { c: number }>(
    `SELECT COUNT(*) AS c FROM \`brokerage_listings\`
      WHERE kind = 'notices' AND ${TO_NORM} = ? AND (\`read\` IS NULL OR \`read\` = 0)`,
    [name]
  );
  return Number(rows[0]?.c ?? 0);
};

/**
 * 移植元: activityAction/activity_notice.php。
 * ⚠️ 宛先は**ログインしている本人**（画面が送る `to` は使わない）。
 */
export const runActivityNotice = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Result> => {
  const name = norm(staff.name);
  if (name === '') return fail(400, '通知先が指定されていません');
  const unreadOnly = body.unreadOnly === true || body.unreadOnly === 1 || body.unreadOnly === '1';
  const limit = clampInt(body.limit, 50, 200);
  const notices = await query<DynamicRow>(
    `SELECT \`id\`, \`at\`, \`by\`, \`to\`, \`type\`, \`title\`, \`body\`, \`entity\`, \`entityId\`, \`read\`
       FROM \`brokerage_listings\`
      WHERE kind = 'notices' AND ${TO_NORM} = ?${unreadOnly ? ' AND (`read` IS NULL OR `read` = 0)' : ''}
      ORDER BY \`at\` DESC, \`internal_id\` DESC
      LIMIT ${limit}`,
    [name]
  );
  return ok({ status: 'success', notices, unread: await countUnread(name) });
};

/**
 * 移植元: activityAction/activity_read.php。
 * ⚠️ 既読にできるのは**ログインしている本人宛の通知だけ**（他人の通知の id を渡されても変えない）。
 */
export const runActivityRead = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Result> => {
  const name = norm(staff.name);
  if (name === '') return fail(400, '通知先が指定されていません');

  let updated = 0;
  if (body.all === true || body.all === 1 || body.all === '1') {
    const result = await executeLarge(
      `UPDATE \`brokerage_listings\` SET \`read\` = 1
        WHERE kind = 'notices' AND ${TO_NORM} = ? AND (\`read\` IS NULL OR \`read\` = 0)`,
      [name]
    );
    updated = result.affectedRows;
  } else {
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((v): v is string => typeof v === 'string' && v !== '').slice(0, 500)
      : [];
    if (ids.length === 0) return ok({ status: 'success', updated: 0, message: '対象なし' });
    const result = await executeLarge(
      `UPDATE \`brokerage_listings\` SET \`read\` = 1
        WHERE kind = 'notices' AND ${TO_NORM} = ? AND \`id\` IN (${ids.map(() => '?').join(', ')})`,
      [name, ...ids]
    );
    updated = result.affectedRows;
  }
  return ok({ status: 'success', updated, unread: await countUnread(name) });
};

/** 担当事業で使えるか。⚠️ 使えなければ 403 の本文を返す */
export const shopForbidden = (
  staff: AuthenticatedStaff | null,
  allowed: string[]
): Result | null => {
  if (staff !== null && allowed.includes(staff.shop)) return null;
  return fail(403, 'この操作を行う権限がありません。');
};

```

## frontend/src/components/realty/RealtyRoute.tsx
```
import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

/**
 * 不動産企画係（category = realty）の画面の入口（v2.2.221）。
 *
 * ⚠️ 担当事業（staff.shop）が `realty`（不動産企画係）か `all`（全事業）の人だけが入れる。
 *   それ以外の人が URL を直接開いたら、事業を選ぶ画面へ戻す。
 * ⚠️ これは見た目の入口。データの読み書きは ② / ① が同じ条件で確かめている（REALTY_SHOPS）。
 */
export const REALTY_SHOPS = ['realty', 'all'];

const RealtyRoute = ({ children }: { children: React.ReactElement }) => {
    const { shopName } = useContext(AuthContext);
    if (!REALTY_SHOPS.includes(shopName)) return <Navigate to="/home" replace />;
    return children;
};

export default RealtyRoute;

```

## backend/scripts/guide/articles/common/screen-230.md
```
---
title: 不動産企画係の画面（入口と権限）
section: 画面の使い方
sort: 230
summary: 不動産企画係の画面に入れる人と、入り方。
---
不動産企画係の画面（チームサマリー・月次報告書・売り反響・買い反響・商談案件・買取再販案件・媒介獲得台帳）は、Dashboard の中の不動産企画係専用のアプリです。

## 入れる人
- 担当事業が「**不動産企画係**」の人
- 担当事業が「**全事業**」の人

ほかの担当事業（注文・建売・中古）の人は入れません。画面のアドレスを直接開いても、事業を選ぶ画面に戻ります。

> 注意：媒介獲得台帳のデータは、中古リノベの顧客DB・顧客詳細からも読み書きします。そのため中古リノベの人も、その画面からは今までどおり使えます。

## 入り方
1. Dashboard にログインする
2. 事業を選ぶ画面で「**不動産企画係**」を押す
3. チームサマリーが開く。左のメニューから各画面へ移る

## 担当事業を「不動産企画係」にする
ヘッダーの「システム管理 → 権限編集」で、その人の担当事業を「不動産企画係」に変えます（変えられるのは管理者だけです）。

> 注意：変えたあと、本人が次に画面を移ったときに反映されます。ログインし直す必要はありません。

## 通知
画面の右上のベルに出る通知は、**ログインしている本人宛のものだけ**です。

> 要確認：以前の画面のアドレス（/leadSell など）をブックマークしている人は、新しいアドレス（/realty/sell など）に自動で移ります。ブックマークを付け直しておくと確実です。

```

# 変更（差分。移動したファイルは import の行だけ）
```diff
diff --git a/.gitignore b/.gitignore
index f1281c03..b15a0803 100644
--- a/.gitignore
+++ b/.gitignore
@@ -134,3 +134,7 @@ ReadMeClaude.md
 #   ⚠️ 2026-09-22 に `MCP_修正.zip` を誤ってコミットし、同日に取り消した。
 # ---------------------------------------------------------------------------
 mcp-server/*.zip
+
+# ⚠️ v2.2.221: 不動産企画係アプリ（Supabase）の書き出し。顧客の個人情報を含むので Git にも Web 公開の場所にも置かない
+backend/src/handlers/data.json
+backend/src/handlers/app_state.json
diff --git a/backend-express/src/features/staffAdmin.ts b/backend-express/src/features/staffAdmin.ts
index 80d12bf3..ecb543b5 100644
--- a/backend-express/src/features/staffAdmin.ts
+++ b/backend-express/src/features/staffAdmin.ts
@@ -64,7 +64,8 @@ export const AUTH_BRANDS = ['Master', 'BrandAdmin', 'Manager', 'ordinary', 'Cons
  *   ⚠️ 選択肢から外すと、⚠️⚠️ **全事業を見られる人をこの画面で作れなくなる**ため加えた
  *   （2026-10-05 に利用者と確認済み）。
  */
-export const AUTH_SHOPS = ['order', 'spec', 'used', 'all'] as const;
+// ⚠️ v2.2.221: realty（不動産企画係）を追加。⚠️ realty の人は不動産企画係の画面にだけ入れる
+export const AUTH_SHOPS = ['order', 'spec', 'used', 'realty', 'all'] as const;
 
 const isAuthBrand = (value: string): boolean => (AUTH_BRANDS as readonly string[]).includes(value);
 const isAuthShop = (value: string): boolean => (AUTH_SHOPS as readonly string[]).includes(value);
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 6eac892a..515e9a12 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -157,7 +157,22 @@ import {
   listAiAnalysis,
   startAiAnalysis,
 } from '../features/aiAnalysis';
-import type { GatewayEntry, GatewayKey } from './types';
+import {
+  BROKER_SHOPS,
+  REALTY_SHOPS,
+  runActivityHistory,
+  runActivityNotice,
+  runActivityRead,
+  runBrokerCustomer,
+  runBrokerList,
+  runBrokerUpdate,
+  runPlannerLead,
+  runPlannerSummary,
+  shopForbidden,
+} from '../features/realty';
+import type { Result as RealtyResult } from '../features/realty';
+import type { AuthenticatedStaff } from '../types/staff';
+import type { GatewayContext, GatewayEntry, GatewayKey } from './types';
 import { gatewayKey } from './types';
 
 /**
@@ -1163,6 +1178,36 @@ register({
   },
 });
 
+// ---------------------------------------------------------------------------
+// 不動産企画係（category = realty）のデータ（v2.2.221 で ① から移植）
+//
+// ⚠️⚠️ v2.2.220 までは ① で**ログインしていなくても読み書きできた**。ここで本人と担当事業を確かめる。
+//   planner:* / activity:* … 担当事業が realty / all（REALTY_SHOPS）
+//   broker:*               … realty / all / used（BROKER_SHOPS。中古の顧客DB・顧客詳細も台帳を書く）
+// ⚠️ 書き込み（broker:update・activity:read）は express_proxy.php の expressProxyExclusive() に入れてある
+//   （② で済んだ直後に応答が失われて ① でも動くと、二重に書き込むため）。
+// ---------------------------------------------------------------------------
+
+/** 担当事業を確かめてから実行し、HTTP ステータスを付けて返す */
+const realty = (allowed: string[], run: (staff: AuthenticatedStaff, body: GatewayContext['body']) => Promise<RealtyResult>) =>
+  async (ctx: GatewayContext) => {
+    const denied = shopForbidden(ctx.staff, allowed);
+    const result = denied !== null || ctx.staff === null ? denied : await run(ctx.staff, ctx.body);
+    if (result === null) return null;
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  };
+
+register({ request: 'planner', roll: 'lead', summary: '不動産企画係: 案件一覧（売り・買い反響・媒介台帳・買取再販）', phpSource: 'plannerAction/planner_lead.php', auth: 'staff', handler: realty(REALTY_SHOPS, () => runPlannerLead()) });
+register({ request: 'planner', roll: 'summary', summary: '不動産企画係: チームサマリーの元データと設定', phpSource: 'plannerAction/planner_summary.php', auth: 'staff', handler: realty(REALTY_SHOPS, () => runPlannerSummary()) });
+register({ request: 'broker', roll: 'list', summary: '媒介台帳などの全件と担当者', phpSource: 'brokerAction/broker_list.php', auth: 'staff', handler: realty(BROKER_SHOPS, () => runBrokerList()) });
+register({ request: 'broker', roll: 'report', summary: '月次報告書の元データ（broker:list と同じ）', phpSource: 'brokerAction/broker_report.php', auth: 'staff', handler: realty(BROKER_SHOPS, () => runBrokerList()) });
+register({ request: 'broker', roll: 'customer', summary: '中古の顧客と物件（台帳との紐づけ用）', phpSource: 'brokerAction/broker_customer.php', auth: 'staff', handler: realty(BROKER_SHOPS, () => runBrokerCustomer()) });
+register({ request: 'broker', roll: 'update', summary: '【書き込み】台帳などの1件を保存（UPSERT）', phpSource: 'brokerAction/broker_update.php', auth: 'staff', handler: realty(BROKER_SHOPS, (_s, body) => runBrokerUpdate(body)) });
+register({ request: 'activity', roll: 'history', summary: '不動産企画係: 変更履歴', phpSource: 'activityAction/activity_history.php', auth: 'staff', handler: realty(REALTY_SHOPS, (_s, body) => runActivityHistory(body)) });
+register({ request: 'activity', roll: 'notice', summary: '不動産企画係: 本人宛の通知', phpSource: 'activityAction/activity_notice.php', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runActivityNotice(s, body)) });
+register({ request: 'activity', roll: 'read', summary: '【書き込み】不動産企画係: 本人宛の通知を既読にする', phpSource: 'activityAction/activity_read.php', auth: 'staff', handler: realty(REALTY_SHOPS, (s, body) => runActivityRead(s, body)) });
+
 // ---------------------------------------------------------------------------
 // Claudeによる分析（v2.2.217。Dashboard からの自由分析）— ② のみ（① に PHP 版は無い）
 //
diff --git a/backend/src/core/authz.php b/backend/src/core/authz.php
index da11e3a5..d28e4852 100644
--- a/backend/src/core/authz.php
+++ b/backend/src/core/authz.php
@@ -89,6 +89,30 @@ function requireMaster(PDO $pdo, array $headers): array
  */
 const AUTHZ_KPI_ANALYSIS = ['Master', 'BrandAdmin', 'Manager'];
 
+/**
+ * 不動産企画係（realty）の画面を使える担当事業（v2.2.221）。② の REALTY_SHOPS / BROKER_SHOPS と同じ値にすること。
+ *   媒介台帳（broker）は中古の顧客DB・顧客詳細も読み書きするため used も可。
+ */
+const AUTHZ_REALTY_SHOPS = ['realty', 'all'];
+const AUTHZ_BROKER_SHOPS = ['realty', 'all', 'used'];
+
+/**
+ * 認証と「担当事業（staff.shop）が許されていること」の確認（v2.2.221）。
+ * ⚠️ 権限（staff.brand）ではなく担当事業で判定する。持っていなければ 403 を返して終了する。
+ */
+function requireShop(PDO $pdo, array $headers, array $allowedShops): array
+{
+    $staff = requireStaff($pdo, $headers);
+    $shop = (string)($staff['shop'] ?? '');
+    if (!in_array($shop, $allowedShops, true)) {
+        error_log(sprintf('authz denied: staff_id=%s shop=%s required=%s', $staff['id'] ?? '?', $shop === '' ? '(空)' : $shop, implode('/', $allowedShops)));
+        http_response_code(403);
+        echo json_encode(['status' => 'error', 'message' => 'この操作を行う権限がありません。'], JSON_UNESCAPED_UNICODE);
+        exit;
+    }
+    return $staff;
+}
+
 /** 認証と「Claudeによる分析を使える権限であること」の確認（保存済みの定型分析の閲覧で使う） */
 function requireKpiAnalyst(PDO $pdo, array $headers): array
 {
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 0ea2afaa..9b02063f 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -137,6 +137,17 @@ function expressProxyRequests(): array
         'ai_analysis_list',
         'ai_analysis_get',
         'ai_analysis_delete',
+        // ⚠️ v2.2.221。不動産企画係（realty）のデータ。② で本人と担当事業を確かめる
+        //   ⚠️ 読み出しは ② に届かなければ ① の PHP が代わりに処理する（① でも同じ確認をする）
+        'planner:lead',
+        'planner:summary',
+        'broker:list',
+        'broker:report',
+        'broker:customer',
+        'broker:update',
+        'activity:history',
+        'activity:notice',
+        'activity:read',
 
         // 2026-09-03 移植。旧API（dashboard/api/ の demand 形式）から
         // request 形式へ移したもの。
@@ -782,6 +793,10 @@ function expressProxyExclusive(): array
         'ai_analysis_get',
         'ai_analysis_delete',
 
+        // v2.2.221。不動産企画係の書き込み。⚠️ ② で済んだ直後に応答が失われて ① でも動くと二重に書き込むため
+        'broker:update',
+        'activity:read',
+
         // -----------------------------------------------------------------
         // v2.2.215 新規。オーナーズハウス募集（owners_house_application）の一覧と過去メールの取り込み。
         //
diff --git a/backend/src/handlers/activity.php b/backend/src/handlers/activity.php
index 933d75f1..725d6790 100644
--- a/backend/src/handlers/activity.php
+++ b/backend/src/handlers/activity.php
@@ -1,5 +1,11 @@
 <?php
 
+// ⚠️ v2.2.221: ログインと担当事業を確かめる（v2.2.220 までは誰でも読み書きできた）。② の features/realty と同じ条件
+require_once __DIR__ . '/../core/authz.php';
+$staff = requireShop($pdo, $headers, AUTHZ_REALTY_SHOPS);
+// ⚠️ 通知の宛先は画面が送る to ではなく、ログインしている本人（空白を除いた名前で突き合わせる）
+$data['to'] = preg_replace('/[\s　]/u', '', (string)($staff['name'] ?? ''));
+
 // 監査ログ（kind:'logs'）と通知（kind:'notices'）の参照・既読化。
 //
 // これらは brokerage_listings に同居しているが、案件一覧（planner）とは
diff --git a/backend/src/handlers/activityAction/activity_notice.php b/backend/src/handlers/activityAction/activity_notice.php
index 760c11ca..eda76799 100644
--- a/backend/src/handlers/activityAction/activity_notice.php
+++ b/backend/src/handlers/activityAction/activity_notice.php
@@ -22,7 +22,7 @@ $limit = isset($data['limit']) ? (int) $data['limit'] : 50;
 if ($limit < 1) $limit = 1;
 if ($limit > 200) $limit = 200;
 
-$where = "kind = 'notices' AND `to` = ?";
+$where = "kind = 'notices' AND REPLACE(REPLACE(`to`, ' ', ''), '　', '') = ?";
 $params = [$to];
 
 if ($unreadOnly) {
@@ -39,7 +39,7 @@ $sql = "SELECT `id`, `at`, `by`, `to`, `type`, `title`, `body`,
 
 // 未読バッジ用の件数。一覧の LIMIT に影響されない実数を返す。
 $countSql = "SELECT COUNT(*) FROM `brokerage_listings`
-              WHERE kind = 'notices' AND `to` = ? AND (`read` IS NULL OR `read` = 0)";
+              WHERE kind = 'notices' AND REPLACE(REPLACE(`to`, ' ', ''), '　', '') = ? AND (`read` IS NULL OR `read` = 0)";
 
 try {
     $stmt = $pdo->prepare($sql);
diff --git a/backend/src/handlers/activityAction/activity_read.php b/backend/src/handlers/activityAction/activity_read.php
index d3c7e72f..e4e7a665 100644
--- a/backend/src/handlers/activityAction/activity_read.php
+++ b/backend/src/handlers/activityAction/activity_read.php
@@ -23,7 +23,7 @@ try {
     if ($all) {
         $sql = "UPDATE `brokerage_listings`
                    SET `read` = 1
-                 WHERE kind = 'notices' AND `to` = ? AND (`read` IS NULL OR `read` = 0)";
+                 WHERE kind = 'notices' AND REPLACE(REPLACE(`to`, ' ', ''), '　', '') = ? AND (`read` IS NULL OR `read` = 0)";
         $stmt = $pdo->prepare($sql);
         $stmt->execute([$to]);
     } else {
@@ -36,7 +36,7 @@ try {
         $placeholders = implode(', ', array_fill(0, count($ids), '?'));
         $sql = "UPDATE `brokerage_listings`
                    SET `read` = 1
-                 WHERE kind = 'notices' AND `to` = ? AND `id` IN ({$placeholders})";
+                 WHERE kind = 'notices' AND REPLACE(REPLACE(`to`, ' ', ''), '　', '') = ? AND `id` IN ({$placeholders})";
         $stmt = $pdo->prepare($sql);
         $stmt->execute(array_merge([$to], array_values($ids)));
     }
@@ -46,7 +46,7 @@ try {
     // 更新後の未読件数を返し、フロントがバッジを再計算せずに済むようにする
     $countStmt = $pdo->prepare(
         "SELECT COUNT(*) FROM `brokerage_listings`
-          WHERE kind = 'notices' AND `to` = ? AND (`read` IS NULL OR `read` = 0)"
+          WHERE kind = 'notices' AND REPLACE(REPLACE(`to`, ' ', ''), '　', '') = ? AND (`read` IS NULL OR `read` = 0)"
     );
     $countStmt->execute([$to]);
     $unread = (int) $countStmt->fetchColumn();
diff --git a/backend/src/handlers/addTale.php b/backend/src/handlers/addTale.php
index abb878de..7fdfcfc8 100644
--- a/backend/src/handlers/addTale.php
+++ b/backend/src/handlers/addTale.php
@@ -21,6 +21,10 @@
 $isCli = (PHP_SAPI === 'cli');
 
 if (!$isCli) {
+    // ⚠️⚠️ v2.2.221: Web からの実行は Master だけ（v2.2.220 までは confirm さえ付ければ誰でも本番データを上書きできた）
+    require_once __DIR__ . '/../core/authz.php';
+    requireMaster($pdo, $headers);
+
     // index.php 経由の場合 $data にリクエストボディが入っている
     $confirm = $data['confirm'] ?? null;
     if ($confirm !== 'IMPORT') {
diff --git a/backend/src/handlers/broker.php b/backend/src/handlers/broker.php
index 90e2d30a..4468ee1f 100644
--- a/backend/src/handlers/broker.php
+++ b/backend/src/handlers/broker.php
@@ -1,5 +1,9 @@
 <?php
 
+// ⚠️ v2.2.221: ログインと担当事業を確かめる（v2.2.220 までは誰でも読み書きできた）。② の features/realty と同じ条件
+require_once __DIR__ . '/../core/authz.php';
+$staff = requireShop($pdo, $headers, AUTHZ_BROKER_SHOPS);
+
 $roll = $data['roll'] ?? 'list';
 $allowed_rolls = ['list', 'update', 'customer', 'report'];
 
diff --git a/backend/src/handlers/log.txt b/backend/src/handlers/log.txt
new file mode 100644
index 00000000..e6e4b0c7
Binary files /dev/null and b/backend/src/handlers/log.txt differ
diff --git a/backend/src/handlers/planner.php b/backend/src/handlers/planner.php
index f2798037..428cf957 100644
--- a/backend/src/handlers/planner.php
+++ b/backend/src/handlers/planner.php
@@ -1,7 +1,12 @@
 <?php
 
+// ⚠️ v2.2.221: ログインと担当事業を確かめる（v2.2.220 までは誰でも読み書きできた）。② の features/realty と同じ条件
+require_once __DIR__ . '/../core/authz.php';
+$staff = requireShop($pdo, $headers, AUTHZ_REALTY_SHOPS);
+
 $roll = $data['roll'] ?? 'lead';
-$allowed_rolls = ['lead', 'detail', 'summary'];
+// ⚠️ v2.2.221: 'detail' を外した（plannerAction/planner_detail.php が無く、呼ぶと PHP の致命的エラーになっていた）
+$allowed_rolls = ['lead', 'summary'];
 
 if (!in_array($roll, $allowed_rolls, true)) {
         http_response_code(400);
diff --git a/frontend/src/App.tsx b/frontend/src/App.tsx
index 539919d9..67953d3c 100644
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -1,6 +1,6 @@
 import React, { useEffect, useState } from "react";
 import { GoogleOAuthProvider } from '@react-oauth/google';
-import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
+import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
 import Calendar from "./components/calendar/Calendar";
 import Category from "./components/Category";
 import DailyAction from "./components/DailyAction";
@@ -32,13 +32,15 @@ import MapRouter from "./components/map/MapRouter";
 import { useIsSp } from './utils/isSp';
 import CampaignRouter from './components/campaign/CampaignRouter';
 import DatabaseBroker from "./components/database/DatabaseBroker";
-import MonthlySalesReport from "./components/MonthlySalesReport";
 import InsideSales from "./components/insideSales/InsideSales";
-import LeadBuy from "./components/lead/LeadBuy";
-import LeadSell from "./components/lead/LeadSell";
-import LeadOpportunity from "./components/lead/LeadOpportunity";
-import LeadResale from "./components/lead/LeadResale";
-import Summary from "./components/summary/Summary";
+// ⚠️ v2.2.221: 不動産企画係（category = realty）の画面は components/realty にまとめた
+import RealtyRoute from "./components/realty/RealtyRoute";
+import Summary from "./components/realty/summary/Summary";
+import MonthlySalesReport from "./components/realty/report/MonthlySalesReport";
+import LeadSell from "./components/realty/sell/LeadSell";
+import LeadBuy from "./components/realty/buy/LeadBuy";
+import LeadOpportunity from "./components/realty/deals/LeadOpportunity";
+import LeadResale from "./components/realty/resale/LeadResale";
 import Guide from "./components/guide/Guide";
 
 const GOOGLE_MAPS_LIBRARIES: ("marker")[] = ['marker'];
@@ -170,14 +172,23 @@ function AppInner() {
             <Route path="/property" element={<DatabaseProperty />} />
             <Route path="/photo" element={<Photo />} />
             <Route path="/kengakuCloud" element={<KengakuCloud />} />
-            <Route path="/broker" element={<DatabaseBroker />} />
-            <Route path="/report" element={<MonthlySalesReport/>} />
             <Route path="/insideSales" element={<InsideSales/>} />
-            <Route path="/leadBuy" element={<LeadBuy/>} />
-            <Route path="/leadSell" element={<LeadSell/>} />
-            <Route path="/leadOpportunity" element={<LeadOpportunity/>} />
-            <Route path="/leadResale" element={<LeadResale/>} />
-            <Route path="/summary" element={<Summary/>} />
+            {/* ⚠️ v2.2.221: 不動産企画係の画面。⚠️ 担当事業が realty / all の人だけ（RealtyRoute） */}
+            <Route path="/realty/summary" element={<RealtyRoute><Summary /></RealtyRoute>} />
+            <Route path="/realty/report" element={<RealtyRoute><MonthlySalesReport /></RealtyRoute>} />
+            <Route path="/realty/sell" element={<RealtyRoute><LeadSell /></RealtyRoute>} />
+            <Route path="/realty/buy" element={<RealtyRoute><LeadBuy /></RealtyRoute>} />
+            <Route path="/realty/deals" element={<RealtyRoute><LeadOpportunity /></RealtyRoute>} />
+            <Route path="/realty/resale" element={<RealtyRoute><LeadResale /></RealtyRoute>} />
+            <Route path="/realty/ledger" element={<RealtyRoute><DatabaseBroker /></RealtyRoute>} />
+            {/* ⚠️ v2.2.220 までの URL（ブックマーク）は新しい URL へ送る */}
+            <Route path="/summary" element={<Navigate to="/realty/summary" replace />} />
+            <Route path="/report" element={<Navigate to="/realty/report" replace />} />
+            <Route path="/leadSell" element={<Navigate to="/realty/sell" replace />} />
+            <Route path="/leadBuy" element={<Navigate to="/realty/buy" replace />} />
+            <Route path="/leadOpportunity" element={<Navigate to="/realty/deals" replace />} />
+            <Route path="/leadResale" element={<Navigate to="/realty/resale" replace />} />
+            <Route path="/broker" element={<Navigate to="/realty/ledger" replace />} />
             <Route path="*" element={<Category />} />
 
           </Routes>
diff --git a/frontend/src/components/Category.tsx b/frontend/src/components/Category.tsx
index 97f804f3..028c5ddb 100644
--- a/frontend/src/components/Category.tsx
+++ b/frontend/src/components/Category.tsx
@@ -37,7 +37,8 @@ const Category = () => {
             order: '/company',
             spec: '/company',
             used: '/company',
-            planner: '/summary'
+            // ⚠️ v2.2.221: planner → realty（不動産企画係）
+            realty: '/realty/summary'
         };
         await setCategory(categoryValue);
         /**
@@ -68,7 +69,7 @@ const Category = () => {
                     <div className="bg-success text-center text-white py-2 py-md-3  px-4 px-md-5 rounded-pill me-md-2 my-4 pointer" style={{ fontWeight: isSp ? '500' : '700', letterSpacing: '1px', fontSize: isSp ? '10px' : '14px' }}
                         onClick={() => goToDashboard('spec')}>建売営業</div>
                     <div className="bg-info text-center text-white py-2 py-md-3  px-4 px-md-5 rounded-pill pointer me-md-2 my-4" style={{ fontWeight: isSp ? '500' : '700', letterSpacing: '1px', fontSize: isSp ? '10px' : '14px' }}
-                        onClick={() => goToDashboard('planner')}>不動産企画係</div>
+                        onClick={() => goToDashboard('realty')}>不動産企画係</div>
                     <div className="bg-warning text-center text-white py-2 py-md-3  px-4 px-md-5 rounded-pill pointer my-2" style={{ fontWeight: isSp ? '500' : '700', letterSpacing: '1px', fontSize: isSp ? '10px' : '14px' }}
                         onClick={() => goToDashboard('used')}>中古リノベ</div>
                 </div>
diff --git a/frontend/src/components/DailyAction.tsx b/frontend/src/components/DailyAction.tsx
index 198e7a7e..51708198 100644
--- a/frontend/src/components/DailyAction.tsx
+++ b/frontend/src/components/DailyAction.tsx
@@ -282,7 +282,7 @@ const DailyAction = () => {
     /**
      * ⚠️ そもそも出す対象か。⚠️ **通信の前に判定する**（無駄な通信を避ける）
      * ⚠️ v2.2.175: 注文だけ → ⚠️ **注文・建売・中古**（指示書「全category表示」）。
-     *   ⚠️ planner などは対象外（⚠️ サーバーの DAILY_SOURCES に無い）。
+     *   ⚠️ realty（不動産企画係）などは対象外（⚠️ サーバーの DAILY_SOURCES に無い）。
      */
     const isTarget = !isSp && DAILY_CATEGORIES.includes(category);
     /** ⚠️ v2.2.175 修正: 事業を選ぶ画面（`/`・`/home`）とログインでは ⚠️ **自動でもボタンでも出さない** */
diff --git a/frontend/src/components/Menu.tsx b/frontend/src/components/Menu.tsx
index dd853cf2..05282c92 100644
--- a/frontend/src/components/Menu.tsx
+++ b/frontend/src/components/Menu.tsx
@@ -226,31 +226,31 @@ const Menu = ({ key, onReload }: Props) => {
         'order': { label: '注文営業', class: 'text-white bg-primary rounded px-2 py-0 ms-1' },
         'spec': { label: '建売営業', class: 'text-white bg-success rounded px-2 py-0 ms-1' },
         'used': { label: '中古リノベ', class: 'text-white bg-warning rounded px-2 py-0 ms-1' },
-        'planner': { label: '不動産企画係', class: 'text-white bg-info rounded px-2 py-0 ms-1' },
+        'realty': { label: '不動産企画係', class: 'text-white bg-info rounded px-2 py-0 ms-1' },
     };
 
     const MENU_CONFIG: MenuItem[] = useMemo(() => [
-        { id: 'company', path: '/company', icon: 'fa-rainbow', label: '全社報告用フォーマット', show: category !== 'planner', exact: true },
-        { id: 'summary', path: '/summary', icon: 'fa-chart-line', label: 'チームサマリー', show: !isSp && category === 'planner', exact: true },
-        { id: 'report', path: '/report', icon: 'fa-calendar', label: '月次報告書', show: !isSp && category === 'planner', exact: true },
-        { id: 'leadSell', path: '/leadSell', icon: 'fa-calculator', label: '売り反響(一括査定)', show: !isSp && category === 'planner', exact: true },
-        { id: 'leadBuy', path: '/leadBuy', icon: 'fa-desktop', label: '買い反響(ポータル)', show: !isSp && category === 'planner', exact: true },
-        { id: 'report', path: '/leadOpportunity', icon: 'fa-user-tie', label: '商談案件', show: !isSp && category === 'planner', exact: true },
-        { id: 'leadResale', path: '/leadResale', icon: 'fa-arrows-rotate', label: '買取再販案件', show: !isSp && category === 'planner', exact: true },
+        { id: 'company', path: '/company', icon: 'fa-rainbow', label: '全社報告用フォーマット', show: category !== 'realty', exact: true },
+        { id: 'summary', path: '/realty/summary', icon: 'fa-chart-line', label: 'チームサマリー', show: !isSp && category === 'realty', exact: true },
+        { id: 'report', path: '/realty/report', icon: 'fa-calendar', label: '月次報告書', show: !isSp && category === 'realty', exact: true },
+        { id: 'leadSell', path: '/realty/sell', icon: 'fa-calculator', label: '売り反響(一括査定)', show: !isSp && category === 'realty', exact: true },
+        { id: 'leadBuy', path: '/realty/buy', icon: 'fa-desktop', label: '買い反響(ポータル)', show: !isSp && category === 'realty', exact: true },
+        { id: 'deals', path: '/realty/deals', icon: 'fa-user-tie', label: '商談案件', show: !isSp && category === 'realty', exact: true },
+        { id: 'leadResale', path: '/realty/resale', icon: 'fa-arrows-rotate', label: '買取再販案件', show: !isSp && category === 'realty', exact: true },
         {
             id: 'list', path: '/list', icon: 'fa-phone', label: '反響一覧', show: (category === 'order' || category === 'spec'), exact: true,
             badges: (category === 'order' && sync > 0) ? [{ label: `未同期 ${sync}件`, top: '8px' }] : []
         },
         { id: 'list_renove', path: '/list?shop=renove', icon: 'fa-phone', label: '反響一覧', show: category === 'used', exact: true },
         {
-            id: 'database', path: '/database', icon: 'fa-magnifying-glass', label: '顧客DB', show: category !== 'planner', exact: true,
+            id: 'database', path: '/database', icon: 'fa-magnifying-glass', label: '顧客DB', show: category !== 'realty', exact: true,
             badges: category === 'order' ? [
                 cancel > 0 ? { label: `来場未入力 ${cancel}件`, top: '2px' } : null,
                 lost > 0 ? { label: `失注未入力 ${lost}件`, top: '16px' } : null
             ].filter(Boolean) as Badge[] : []
         },
-        { id: 'rank', path: '/rank', icon: 'fa-person', label: '店舗・担当別反響', show: category !== 'planner', exact: true },
-        { id: 'map', path: '/map', icon: 'fa-map', label: '反響MAP', show: category !== 'planner', exact: true },
+        { id: 'rank', path: '/rank', icon: 'fa-person', label: '店舗・担当別反響', show: category !== 'realty', exact: true },
+        { id: 'map', path: '/map', icon: 'fa-map', label: '反響MAP', show: category !== 'realty', exact: true },
         /**
          * ⚠️ 建売（spec）も 2026-09-16 から表示する。
          *   ⚠️ 画面（customer/CustomerKaeru.tsx）も ② の `customer:spec` も
@@ -273,10 +273,10 @@ const Menu = ({ key, onReload }: Props) => {
          *   ⚠️ **同じ名前の列で数字が違う。** 揃えるかは利用者の判断を待っている。
          */
         { id: 'shop', path: '/shop', icon: 'fa-chart-pie', label: '店舗別広告費', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
-        { id: 'property_used', path: '/property', icon: 'fa-house', label: '掲載物件一覧', show: category === 'planner', exact: false },
-        { id: 'broker', path: '/broker', icon: 'fa-house', label: '媒介獲得台帳', show: category === 'planner', exact: false },
+        { id: 'property_used', path: '/property', icon: 'fa-house', label: '掲載物件一覧', show: category === 'realty', exact: false },
+        { id: 'broker', path: '/realty/ledger', icon: 'fa-house', label: '媒介獲得台帳', show: category === 'realty', exact: false },
         { id: 'customerTrend', path: '/customerTrend', icon: 'fa-chart-bar', label: '販促媒体別反響推移', show: !isSp && (category === 'order' || category === 'spec'), exact: true },
-        { id: 'shopTrend', path: '/shopTrend', icon: 'fa-shop', label: '店舗別反響推移', show: !isSp && category !== 'planner', exact: true },
+        { id: 'shopTrend', path: '/shopTrend', icon: 'fa-shop', label: '店舗別反響推移', show: !isSp && category !== 'realty', exact: true },
         { id: 'calendar', path: '/calendar', icon: 'fa-calendar', label: 'カレンダー', show: !isSp && category === 'order', exact: true },
         { id: 'property_spec', path: '/property', icon: 'fa-house', label: '物件DB', show: !isSp && category === 'spec', exact: false },
         { id: 'campaign', path: '/campaign', activePaths: ['/campaign', '/editcampaign'], icon: 'fa-calendar-days', label: 'キャンペーン管理', show: !isSp && category === 'order' && (authority === "BrandAdmin" || authority === "Master"), isAdminOnly: true },
diff --git a/frontend/src/components/database/DatabaseProperty.tsx b/frontend/src/components/database/DatabaseProperty.tsx
index 8b6a66ac..5d401a92 100644
--- a/frontend/src/components/database/DatabaseProperty.tsx
+++ b/frontend/src/components/database/DatabaseProperty.tsx
@@ -71,7 +71,7 @@ const DatabaseProperty = () => {
     const categoryList = ['買い:ポータル', '売り:ポータル', '買い:中古リノベ'];
     const categoryMapping: Record<string, string> = {
         spec: '株式会社 国分ハウジング不動産 本店',
-        planner: '国分ハウジンググループ中古住宅専門店'
+        realty: '国分ハウジンググループ中古住宅専門店'
     };
 
     useEffect(() => {
diff --git a/frontend/src/components/database/PropertySummary.tsx b/frontend/src/components/database/PropertySummary.tsx
index 50417755..aafc5a5f 100644
--- a/frontend/src/components/database/PropertySummary.tsx
+++ b/frontend/src/components/database/PropertySummary.tsx
@@ -247,7 +247,7 @@ const PropertySummary = ({ targetId, setTargetId, setEditId }: Props) => {
                         {targetProperty?.property_name || '読込中...'}
                         {isLoading && <span className="spinner-border spinner-border-sm ms-3 text-primary"></span>}
                     </div>
-                    {category === 'planner' && !isEditingReport && (
+                    {category === 'realty' && !isEditingReport && (
                         <button className="btn btn-sm btn-primary shadow-sm rounded-pill px-4 fw-bold me-3" onClick={handleOpenEditReport} disabled={isLoading}>
                             <i className="bi bi-file-earmark-pdf-fill me-2"></i>報告書作成
                         </button>
diff --git a/frontend/src/components/header/EditAuth.tsx b/frontend/src/components/header/EditAuth.tsx
index 3c748b88..9c428428 100644
--- a/frontend/src/components/header/EditAuth.tsx
+++ b/frontend/src/components/header/EditAuth.tsx
@@ -66,6 +66,8 @@ const SHOP_OPTIONS = [
     { value: 'order', label: '注文' },
     { value: 'spec', label: '建売' },
     { value: 'used', label: '中古' },
+    // ⚠️ v2.2.221: 不動産企画係だけを見る人（入れるのは不動産企画係の画面だけ）
+    { value: 'realty', label: '不動産企画係' },
     { value: 'all', label: '全事業' },
 ] as const;
 
diff --git a/frontend/src/components/lead/LeadBuy.tsx b/frontend/src/components/realty/buy/LeadBuy.tsx
similarity index 99%
rename from frontend/src/components/lead/LeadBuy.tsx
rename to frontend/src/components/realty/buy/LeadBuy.tsx
index e5cd8f6e..ef40d1a8 100644
--- a/frontend/src/components/lead/LeadBuy.tsx
+++ b/frontend/src/components/realty/buy/LeadBuy.tsx
@@ -1,13 +1,13 @@
 import React, { useEffect, useState, useMemo, useRef, useContext } from 'react';
-import apiClient from '../../utils/apiClient';
-import { thisYear } from '../../utils/thisYear';
+import apiClient from '../../../utils/apiClient';
+import { thisYear } from '../../../utils/thisYear';
 import Table from 'react-bootstrap/Table';
-import LeadHeader from './LeadHeader';
-import AuthContext from '../../context/AuthContext';
-import { removeSpaces, safeParse, BUY_END_REASONS, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from './leadUtiles';
-import LeadEdit from './LeadEdit';
-import LeadCall, { CallLog } from './LeadCall';
-import DocumentViewer from './DocumentViewer';
+import LeadHeader from '../common/LeadHeader';
+import AuthContext from '../../../context/AuthContext';
+import { removeSpaces, safeParse, BUY_END_REASONS, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
+import LeadEdit from '../common/LeadEdit';
+import LeadCall, { CallLog } from '../common/LeadCall';
+import DocumentViewer from '../documents/DocumentViewer';
 
 // ==========================================
 // 💡 型定義
diff --git a/frontend/src/components/lead/LeadCall.tsx b/frontend/src/components/realty/common/LeadCall.tsx
similarity index 100%
rename from frontend/src/components/lead/LeadCall.tsx
rename to frontend/src/components/realty/common/LeadCall.tsx
diff --git a/frontend/src/components/lead/LeadEdit.tsx b/frontend/src/components/realty/common/LeadEdit.tsx
similarity index 99%
rename from frontend/src/components/lead/LeadEdit.tsx
rename to frontend/src/components/realty/common/LeadEdit.tsx
index d13b5337..b8cca7da 100644
--- a/frontend/src/components/lead/LeadEdit.tsx
+++ b/frontend/src/components/realty/common/LeadEdit.tsx
@@ -1,10 +1,10 @@
 import React, { useEffect, useMemo, useContext, useState } from 'react';
 import Modal from 'react-bootstrap/Modal';
 import Table from 'react-bootstrap/Table';
-import AuthContext from '../../context/AuthContext';
+import AuthContext from '../../../context/AuthContext';
 import { removeSpaces, NEXT_QUICK, addDaysISO, LEAD_END_REASONS, BUY_END_REASONS } from './leadUtiles';
 // 💡 追加: DocumentViewerをインポート
-import DocumentViewer from './DocumentViewer';
+import DocumentViewer from '../documents/DocumentViewer';
 // 💡 追加: サーバー保存済みの変更履歴
 import LeadHistory from './LeadHistory';
 
diff --git a/frontend/src/components/lead/LeadHeader.tsx b/frontend/src/components/realty/common/LeadHeader.tsx
similarity index 100%
rename from frontend/src/components/lead/LeadHeader.tsx
rename to frontend/src/components/realty/common/LeadHeader.tsx
diff --git a/frontend/src/components/lead/LeadHistory.tsx b/frontend/src/components/realty/common/LeadHistory.tsx
similarity index 100%
rename from frontend/src/components/lead/LeadHistory.tsx
rename to frontend/src/components/realty/common/LeadHistory.tsx
diff --git a/frontend/src/components/lead/LeadNotifications.tsx b/frontend/src/components/realty/common/LeadNotifications.tsx
similarity index 99%
rename from frontend/src/components/lead/LeadNotifications.tsx
rename to frontend/src/components/realty/common/LeadNotifications.tsx
index 0b94d20f..aa574dfd 100644
--- a/frontend/src/components/lead/LeadNotifications.tsx
+++ b/frontend/src/components/realty/common/LeadNotifications.tsx
@@ -1,5 +1,5 @@
 import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
-import AuthContext from '../../context/AuthContext';
+import AuthContext from '../../../context/AuthContext';
 import { fetchNotices, markNoticesRead, isUnread, NoticeRow } from './leadUtiles';
 
 // ==========================================
diff --git a/frontend/src/components/lead/leadUtiles.ts b/frontend/src/components/realty/common/leadUtiles.ts
similarity index 99%
rename from frontend/src/components/lead/leadUtiles.ts
rename to frontend/src/components/realty/common/leadUtiles.ts
index 7314f9a2..af0584fa 100644
--- a/frontend/src/components/lead/leadUtiles.ts
+++ b/frontend/src/components/realty/common/leadUtiles.ts
@@ -1,4 +1,4 @@
-import apiClient from '../../utils/apiClient';
+import apiClient from '../../../utils/apiClient';
 
 // ==========================================
 // 💡 brokerage_listings への保存
diff --git a/frontend/src/components/lead/LeadOpportunity.tsx b/frontend/src/components/realty/deals/LeadOpportunity.tsx
similarity index 98%
rename from frontend/src/components/lead/LeadOpportunity.tsx
rename to frontend/src/components/realty/deals/LeadOpportunity.tsx
index 3b660c95..e2353339 100644
--- a/frontend/src/components/lead/LeadOpportunity.tsx
+++ b/frontend/src/components/realty/deals/LeadOpportunity.tsx
@@ -1,13 +1,13 @@
 import React, { useEffect, useState, useMemo, useContext } from 'react';
-import apiClient from '../../utils/apiClient';
+import apiClient from '../../../utils/apiClient';
 import Card from 'react-bootstrap/Card';
 import Table from 'react-bootstrap/Table';
-import AuthContext from '../../context/AuthContext';
-import LeadEdit from './LeadEdit';
-import DocumentViewer from './DocumentViewer';
-import PlannerGenerator, { PlannerInputState } from './PlannerGenerator';
-import LeadNotifications from './LeadNotifications';
-import { saveBrokerageRecord, recordFieldChanges, isSoftDeleted } from './leadUtiles';
+import AuthContext from '../../../context/AuthContext';
+import LeadEdit from '../common/LeadEdit';
+import DocumentViewer from '../documents/DocumentViewer';
+import PlannerGenerator, { PlannerInputState } from '../documents/PlannerGenerator';
+import LeadNotifications from '../common/LeadNotifications';
+import { saveBrokerageRecord, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
 // ==========================================
 // 💡 型定義
 // ==========================================
diff --git a/frontend/src/components/lead/DocumentViewer.tsx b/frontend/src/components/realty/documents/DocumentViewer.tsx
similarity index 99%
rename from frontend/src/components/lead/DocumentViewer.tsx
rename to frontend/src/components/realty/documents/DocumentViewer.tsx
index cbae3107..d6e485ae 100644
--- a/frontend/src/components/lead/DocumentViewer.tsx
+++ b/frontend/src/components/realty/documents/DocumentViewer.tsx
@@ -1,8 +1,8 @@
 import React, { useState, useEffect, useContext } from 'react';
 import Modal from 'react-bootstrap/Modal';
-import AuthContext from '../../context/AuthContext';
+import AuthContext from '../../../context/AuthContext';
 import { getYK, COMPANY } from './documentUtils'; // COMPANYは内部で定義されているため除外
-import { safeParse, saveBrokerageRecord, nowDateTime } from './leadUtiles';
+import { safeParse, saveBrokerageRecord, nowDateTime } from '../common/leadUtiles';
 
 // ==========================================
 // 💡 1. ユーティリティ・定数
diff --git a/frontend/src/components/lead/PlannerGenerator.tsx b/frontend/src/components/realty/documents/PlannerGenerator.tsx
similarity index 100%
rename from frontend/src/components/lead/PlannerGenerator.tsx
rename to frontend/src/components/realty/documents/PlannerGenerator.tsx
diff --git a/frontend/src/components/lead/documentUtils.ts b/frontend/src/components/realty/documents/documentUtils.ts
similarity index 100%
rename from frontend/src/components/lead/documentUtils.ts
rename to frontend/src/components/realty/documents/documentUtils.ts
diff --git a/frontend/src/components/MonthlySalesReport.tsx b/frontend/src/components/realty/report/MonthlySalesReport.tsx
similarity index 99%
rename from frontend/src/components/MonthlySalesReport.tsx
rename to frontend/src/components/realty/report/MonthlySalesReport.tsx
index 2d73fa47..cf914f40 100644
--- a/frontend/src/components/MonthlySalesReport.tsx
+++ b/frontend/src/components/realty/report/MonthlySalesReport.tsx
@@ -2,9 +2,9 @@ import React, { useEffect, useState, useMemo, useContext } from 'react';
 import Table from 'react-bootstrap/Table';
 import Card from 'react-bootstrap/Card';
 import Modal from 'react-bootstrap/Modal';
-import AuthContext from '../context/AuthContext';
-import apiClient from '../utils/apiClient';
-import { thisYear } from '../utils/thisYear';
+import AuthContext from '../../../context/AuthContext';
+import apiClient from '../../../utils/apiClient';
+import { thisYear } from '../../../utils/thisYear';
 
 // ==========================================
 // 💡 型定義
diff --git a/frontend/src/components/lead/LeadResale.tsx b/frontend/src/components/realty/resale/LeadResale.tsx
similarity index 99%
rename from frontend/src/components/lead/LeadResale.tsx
rename to frontend/src/components/realty/resale/LeadResale.tsx
index b13f5c0f..e5b12e9d 100644
--- a/frontend/src/components/lead/LeadResale.tsx
+++ b/frontend/src/components/realty/resale/LeadResale.tsx
@@ -1,11 +1,11 @@
 import React, { useContext, useEffect, useMemo, useState } from 'react';
 import Modal from 'react-bootstrap/Modal';
-import apiClient from '../../utils/apiClient';
-import { thisYear } from '../../utils/thisYear';
-import AuthContext from '../../context/AuthContext';
-import { COMPANY } from './documentUtils';
-import LeadNotifications from './LeadNotifications';
-import { safeParse, saveBrokerageRecord, softDeleteRecord, logChange, recordFieldChanges, isSoftDeleted } from './leadUtiles';
+import apiClient from '../../../utils/apiClient';
+import { thisYear } from '../../../utils/thisYear';
+import AuthContext from '../../../context/AuthContext';
+import { COMPANY } from '../documents/documentUtils';
+import LeadNotifications from '../common/LeadNotifications';
+import { safeParse, saveBrokerageRecord, softDeleteRecord, logChange, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
 
 // ==========================================
 // 💡 型定義
diff --git a/frontend/src/components/lead/LeadSell.tsx b/frontend/src/components/realty/sell/LeadSell.tsx
similarity index 99%
rename from frontend/src/components/lead/LeadSell.tsx
rename to frontend/src/components/realty/sell/LeadSell.tsx
index a169a959..434e0de7 100644
--- a/frontend/src/components/lead/LeadSell.tsx
+++ b/frontend/src/components/realty/sell/LeadSell.tsx
@@ -1,13 +1,13 @@
 import React, { useEffect, useState, useMemo, useRef, useContext } from 'react';
-import apiClient from '../../utils/apiClient';
-import { thisYear } from '../../utils/thisYear';
+import apiClient from '../../../utils/apiClient';
+import { thisYear } from '../../../utils/thisYear';
 import Table from 'react-bootstrap/Table';
-import LeadHeader from './LeadHeader';
-import AuthContext from '../../context/AuthContext';
-import { removeSpaces, safeParse, LEAD_END_REASONS, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from './leadUtiles';
-import LeadEdit from './LeadEdit';
-import LeadCall, { CallLog } from './LeadCall';
-import DocumentViewer from './DocumentViewer';
+import LeadHeader from '../common/LeadHeader';
+import AuthContext from '../../../context/AuthContext';
+import { removeSpaces, safeParse, LEAD_END_REASONS, saveBrokerageRecord, newRecordId, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
+import LeadEdit from '../common/LeadEdit';
+import LeadCall, { CallLog } from '../common/LeadCall';
+import DocumentViewer from '../documents/DocumentViewer';
 
 export type SellLead = {
   internal_id: string;
diff --git a/frontend/src/components/summary/Summary.tsx b/frontend/src/components/realty/summary/Summary.tsx
similarity index 99%
rename from frontend/src/components/summary/Summary.tsx
rename to frontend/src/components/realty/summary/Summary.tsx
index 5d642433..c3283c28 100644
--- a/frontend/src/components/summary/Summary.tsx
+++ b/frontend/src/components/realty/summary/Summary.tsx
@@ -1,12 +1,12 @@
 import React, { useState, useEffect, useMemo, useContext } from 'react';
-import apiClient from '../../utils/apiClient';
-import LeadHeader from '../lead/LeadHeader'; // パスは環境に合わせて調整してください
-import { thisYear } from '../../utils/thisYear';
+import apiClient from '../../../utils/apiClient';
+import LeadHeader from '../common/LeadHeader'; // パスは環境に合わせて調整してください
+import { thisYear } from '../../../utils/thisYear';
 import { removeSpaces, formatDate } from './summaryUtiles'; // パスは環境に合わせて調整してください
-import AuthContext from '../../context/AuthContext';
+import AuthContext from '../../../context/AuthContext';
 // 💡 追加: タスク一覧の「開く」から顧客情報を編集する
-import LeadEdit, { LeadCategory } from '../lead/LeadEdit';
-import { saveBrokerageRecord, recordFieldChanges } from '../lead/leadUtiles';
+import LeadEdit, { LeadCategory } from '../common/LeadEdit';
+import { saveBrokerageRecord, recordFieldChanges } from '../common/leadUtiles';
 
 // ==========================================
 // 💡 型定義 (推論ベース)
diff --git a/frontend/src/components/summary/summaryUtiles.ts b/frontend/src/components/realty/summary/summaryUtiles.ts
similarity index 100%
rename from frontend/src/components/summary/summaryUtiles.ts
rename to frontend/src/components/realty/summary/summaryUtiles.ts
diff --git a/frontend/src/context/AuthProvider.tsx b/frontend/src/context/AuthProvider.tsx
index 3772095e..a4f70725 100644
--- a/frontend/src/context/AuthProvider.tsx
+++ b/frontend/src/context/AuthProvider.tsx
@@ -12,7 +12,11 @@ const AuthProvider = ({ children }: Props) => {
     const location = useLocation();
     const [authority, setAuthority] = useState(() => localStorage.getItem("authority") || "");
     const [token, setToken] = useState(() => localStorage.getItem("token") || "");
-    const [category, setCategory] = useState(() => localStorage.getItem("category") || "");
+    // ⚠️ v2.2.221: 不動産企画係の category を planner → realty に変えた。前の値を覚えているブラウザは読み替える
+    const [category, setCategory] = useState(() => {
+        const saved = localStorage.getItem("category") || "";
+        return saved === "planner" ? "realty" : saved;
+    });
     const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "");
     const [shopName, setShopName] = useState(() => localStorage.getItem("shopName") || "");
     const version = newVersion;
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 02ae28a9..5932af59 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.220';
+export const newVersion = '2.2.221';
```
