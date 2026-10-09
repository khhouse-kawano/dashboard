# 2026-10-09 v2.2.178 フェスタ画面：同期先の台帳・当日来場のチケット・備考列

## 依頼
1. `FestaDashboard.tsx` の同期（handleSync → syncStart）で master_data に登録されない
2. status が `non-reserve`（当日来場）のときはチケット不要（予約日 2026/10/10 以降と同じ「なし」）
3. 相談内容の右に備考（remarks）列を追加
4. 新しいブランチで（v2.2.178）。LP と ② まで直してよい（承認済み）

## 原因（1）
取り込み（`request: 'list', roll: 'insert'`）の `category` に **開いている画面の category** を渡していた。
② `runListInsert` は category でテーブルを決める（order → master_data ／ spec → master_data_kaeru ／ used → master_data_resale）ため、
建売・中古の画面から開いて注文の店舗へ同期すると、**「成功」になるが master_data には入らない**。

ローカルで `runListInsert`（category: order・フェスタと同じ項目）を実行 → master_data に1件入る（show_dashboard=1）ことを確認、テスト行は削除済み。

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/header | **FestaDashboard.tsx** | 同期先を店舗の事業区分で決定／チケットの当日来場判定／備考列 |
| backend-express/src/features/event | **checkin.ts** | 受付画面へ返す項目に `status` を追加（② VPS） |
| Downloads/20260425_kokubu_ouchi_festa_LP_NK/reservation | **index.html**（LP・リポジトリ外） | `ticketOf` に当日来場の判定 |
| frontend/src/utils | version.ts | 2.2.178 |
| backend/scripts/sql | **2026-10-09_update_log_2.2.178.sql**（新規） | update_log（ローカル投入済み no=274） |

### 追加した関数・定数（FestaDashboard.tsx）
- `SYNC_CATEGORY_OF_DIVISION`（定数）
- `syncCategoryOfShop(shop, shopList)`
- `WALK_IN_STATUS`（定数）
- CSS `.fe_remarks_cell`

### 修正した関数・型
- `FestaRow` 型（`status` / `remarks` 追加）
- `ticketOf(item)`
- `syncStart()`（`category: insertCategory`）
- `COLUMN_COUNT`（11 → 12）、表の minWidth 2200 → 2440px
- checkin.ts: `ReservationRow` / `toPublicView` / `SELECT_SQL`

## 事業区分 → 取り込み先（shop_list.division）
| division | category | テーブル |
|---|---|---|
| 注文事業 | order | master_data |
| 建売分譲事業 | spec | master_data_kaeru |
| 中古リノベ | used | master_data_resale |
| それ以外（不動産企画室など）・未設定 | order | master_data |

⚠️ `sync_shop`（event_db.shop に店舗を足す）・load・update・festa は従来どおり画面の category（event_db は共通テーブルで、category はゲートウェイの振り分けだけに使う）。

## 確認
- frontend `npm run build` 成功（`main.861e9ec4.js`）、eslint（FestaDashboard.tsx）警告なし
- backend-express `tsc --noEmit` 成功
- ローカル: shop_list の division 値（注文事業／建売分譲事業／中古リノベ／不動産企画室）を確認
- ローカル: master_data への取り込み（category: order）成功を確認、テスト行削除済み
- ローカルの event_db（フェスタ116件）は status がすべて NULL のため、当日来場の表示は実データでは未確認

## 差分（全文）
```diff
diff --git a/backend-express/src/features/event/checkin.ts b/backend-express/src/features/event/checkin.ts
index bde54447..bed6f9c7 100644
--- a/backend-express/src/features/event/checkin.ts
+++ b/backend-express/src/features/event/checkin.ts
@@ -49,6 +49,8 @@ interface ReservationRow extends RowDataPacket {
   interview: string | null;
   request: string | null;
   staff: string | null;
+  /** ⚠️ v2.2.178 追加。当日来場は 'non-reserve'（⚠️ 受付画面のチケットを「なし」にする） */
+  status: string | null;
 }
 
 /**
@@ -111,6 +113,8 @@ const toPublicView = (row: ReservationRow) => ({
   interview: row.interview ?? '',
   request: row.request ?? '',
   staff: row.staff ?? '',
+  // ⚠️ v2.2.178: 当日来場（'non-reserve'）のチケット判定に使う
+  status: row.status ?? '',
 });
 
 /**
@@ -155,7 +159,7 @@ export const runEventCheckin = async (
 
   const SELECT_SQL = `
     SELECT id, name, kana, date, time, title, check_in_time, check_out_time,
-           reserved_at, medium, interview, request, staff
+           reserved_at, medium, interview, request, staff, status
       FROM event_db
      WHERE id = ?
      LIMIT 1
diff --git a/frontend/src/components/header/FestaDashboard.tsx b/frontend/src/components/header/FestaDashboard.tsx
index d4249649..ed64ea1f 100644
--- a/frontend/src/components/header/FestaDashboard.tsx
+++ b/frontend/src/components/header/FestaDashboard.tsx
@@ -7,6 +7,7 @@ import { thisYear } from '../../utils/thisYear';
 import AuthContext from '../../context/AuthContext';
 import { filterReportShops, sortShops, MasterShop } from './useAmbassadorMaster';
 import { setStyleClass } from '../../utils/setStyleClass';
+import { SHOP_DIVISION } from './divisions';
 
 /**
  * おうちづくりフェスタ2026（v2.2.172 新規）。ヘッダー → 集客イベント → おうちづくりフェスタ2026。
@@ -58,6 +59,10 @@ type FestaRow = {
     title: string;
     shop: string;
     sync: number | null;
+    /** 予約の種別。⚠️ 当日来場は 'non-reserve'（v2.2.178：チケットの判定に使う） */
+    status: string | null;
+    /** 備考（v2.2.178：相談内容の右に出す） */
+    remarks: string | null;
 };
 
 type Staff = {
@@ -131,9 +136,12 @@ const reservedDate = (value: string | null): string => {
  * チケット。⚠️ 受付画面（reservation/index.html の ticketOf）と同じ規則。⚠️ **予約日**で決める。
  *   〜 9/13 … 3,000円分 ／ 9/14〜9/27 … 2,000円 ／
  *   9/28〜10/9 … 媒体が junko / 長原木 なら 2,000円、それ以外 1,000円 ／ 10/10〜（当日来場）… なし
+ * ⚠️ v2.2.178: status が 'non-reserve'（当日来場の受付）は ⚠️ **予約日に関係なく「なし」**（10/10〜 と同じ扱い）。
  */
 const TICKET_MEDIA = ['junko', '長原木'];
+const WALK_IN_STATUS = 'non-reserve';
 const ticketOf = (item: FestaRow): string => {
+    if ((item.status ?? '').trim() === WALK_IN_STATUS) return 'なし';
     const d = reservedDate(item.reserved_at);
     if (d === '') return '－';
     if (d <= '2026/09/13') return '3,000円分';
@@ -221,6 +229,23 @@ const createSyncPayload = (item: FestaRow, shop: string): Record<string, string>
     brand: brands[shop.slice(0, 2)] || ''
 });
 
+/**
+ * 取り込み先の顧客台帳（v2.2.178）。⚠️ **選んだ店舗の shop_list.division で決める。**
+ *   注文事業 → order（master_data）／ 建売分譲事業 → spec（master_data_kaeru）／ 中古リノベ → used（master_data_resale）
+ * ⚠️ それまでは ⚠️ **開いている画面の category** で決めていたため、建売・中古の画面から開いて
+ *   注文の店舗へ同期すると ⚠️ master_data に入らなかった（⚠️「成功」と出るので気づけない）。
+ * ⚠️ division が無い・知らない値の店舗は order（⚠️ divisions.ts の asDivision と同じく注文に寄せる）。
+ */
+const SYNC_CATEGORY_OF_DIVISION: Record<string, 'order' | 'spec' | 'used'> = {
+    [SHOP_DIVISION['注文']]: 'order',
+    [SHOP_DIVISION['建売']]: 'spec',
+    [SHOP_DIVISION['中古']]: 'used',
+};
+const syncCategoryOfShop = (shop: string, shopList: MasterShop[]): 'order' | 'spec' | 'used' => {
+    const master = shopList.find(s => (s.shop ?? '').trim() === shop);
+    return SYNC_CATEGORY_OF_DIVISION[(master?.division ?? '').trim()] ?? 'order';
+};
+
 /**
  * 同期した店舗（v2.2.174）。⚠️ event_db.shop に `,` 区切りで入っている（② の sync_shop が足す）。
  * ⚠️ 店舗が違えば何度でも同期できる。⚠️ 同じ店舗には2回同期できない。
@@ -309,8 +334,8 @@ const stickyStyle = (i: number): React.CSSProperties => ({
     left: STICKY_LEFT[i], width: STICKY_WIDTH[i], minWidth: STICKY_WIDTH[i], maxWidth: STICKY_WIDTH[i],
 });
 
-/** 表の列数（同期〜担当営業の11列（⚠️ v2.2.173 で相談内容を追加） ＋ 営業入力 7ブランド×2） */
-const COLUMN_COUNT = 11 + FESTA_BRANDS.length * FESTA_KINDS.length;
+/** 表の列数（同期〜担当営業の12列（⚠️ v2.2.173 で相談内容、v2.2.178 で備考を追加） ＋ 営業入力 7ブランド×2） */
+const COLUMN_COUNT = 12 + FESTA_BRANDS.length * FESTA_KINDS.length;
 
 type Props = {
     show: boolean;
@@ -647,6 +672,8 @@ const FestaDashboard = ({ show, setShow }: Props) => {
         }
         const target = syncTarget;
         const shop = syncShop;
+        // ⚠️ v2.2.178: 取り込み先は ⚠️ **選んだ店舗の事業区分**（⚠️ 画面の category ではない）
+        const insertCategory = syncCategoryOfShop(shop, shopList);
         try {
             const response = await apiClient.post('', {
                 ...createSyncPayload(target, shop),
@@ -654,7 +681,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                 in_charge_store: shop,
                 request: 'list',
                 roll: 'insert',
-                category,
+                category: insertCategory,
             });
             if (response.data.status !== 'success') {
                 alert('同期に失敗しました。');
@@ -738,6 +765,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         .fe_consult_cell { white-space: normal; min-width: 200px; max-width: 240px; }
                         .fe_consult { display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px; margin: 1px 3px 1px 0; border-radius: 999px; font-size: 11px; font-weight: 600; line-height: 1.5; white-space: nowrap; }
                         .fe_consult i { font-size: 10px; }
+                        .fe_remarks_cell { white-space: pre-wrap; word-break: break-all; min-width: 200px; max-width: 260px; font-size: 11px; color: #525f7f; }
                         .fe_sortbtn { border: none; background: transparent; padding: 0 0 0 4px; color: #adb5bd; cursor: pointer; line-height: 1; }
                         .fe_sortbtn[data-active="1"] { color: #5e72e4; }
                         .fe_sortbtn:focus-visible { outline: 2px solid #5e72e4; outline-offset: 1px; border-radius: 2px; }
@@ -887,7 +915,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                     {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}
 
                     <div className="bg-white rounded shadow-sm border table-responsive">
-                        <Table hover className="m-0 text-nowrap fe_tbl" style={{ minWidth: '2200px' }}>
+                        <Table hover className="m-0 text-nowrap fe_tbl" style={{ minWidth: '2440px' }}>
                             {/*
                               ⚠️ 見出しは3段。⚠️ 指示書の rowSpan / colSpan は入れ替わっていると判断した（2026-10-08 の計画で合意）。
                                 1段目: 同期〜担当営業（縦に3段ぶん）＋ 営業入力（横に14列ぶん）
@@ -901,6 +929,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                     <th rowSpan={3} className="fe_stick fe_stick_last" style={{ ...thStyle, ...stickyStyle(2) }}>ふりがな</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '70px' }}>ストラップ</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '220px' }}>相談内容</th>
+                                    <th rowSpan={3} style={{ ...thStyle, width: '240px' }}>備考</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '120px' }}>来場日{sortButton('date', '来場日')}</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '90px' }}>来場時間{sortButton('time', '来場時間')}</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '80px' }}>チケット</th>
@@ -961,6 +990,8 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                                     </span>
                                                 ))}
                                             </td>
+                                            {/* ⚠️ v2.2.178: 備考（event_db.remarks）。⚠️ 表示だけ。⚠️ 改行はそのまま出す */}
+                                            <td className="fe_remarks_cell" title={item.remarks ?? ''}>{item.remarks ?? ''}</td>
                                             <td>{item.date || ''}</td>
                                             <td>{item.time || ''}</td>
                                             <td className="text-center">
```

### LP（reservation/index.html）の変更後
```js
            var TICKET_MEDIA = ['junko', '長原木'];
            var ticketOf = function (reservation) {
                if ((reservation.status || '') === 'non-reserve') return 'なし';
                var d = reservation.reservedDate || '';
                if (d === '') return '－';
                if (d <= '2026/09/13') return '3,000円分';
                if (d <= '2026/09/27') return '2,000円';
                if (d <= '2026/10/09') {
                    return TICKET_MEDIA.indexOf(reservation.medium || '') >= 0 ? '2,000円' : '1,000円';
                }
                return 'なし';
            };
```
