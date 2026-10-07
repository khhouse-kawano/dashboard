# 2026-10-07 フェスタ受付画面（QR）を受付スタッフ用に作り直し・event_db.staff 追加（v2.2.171）

## 依頼
- LP `reservation/index.html`
  - 「スタッフの方はこちら」→「**受付スタッフ用**」。視認性の良いボタンに
  - クリック → モーダル（合い言葉）→ 認証後に **全画面モーダル**で event_db の該当行を表示
    - お名前（name）・ふりがな（kana）・チケット・ストラップ
    - チェックイン前 → **チェックイン** ／ チェックイン済み → **チェックアウト** ／ 両方済み → **チェックアウト済み**
    - 閉じるボタン、右上に ×
  - `item.staff` が入っていれば担当スタッフ名も出す
  - 目的: 受付スタッフが QR を読んだらすぐ対応できるように
- `event_db` に `staff TEXT DEFAULT NULL` を追加
- `EventList.tsx` にスタッフ入力欄（input type text）

## 決定事項（2026-10-07 にユーザー確認）
| 論点 | 決定 |
|---|---|
| チケットの判定に使う日付 | **予約日（reserved_at）**（event_db.date は来場日 10/10・10/11 しか無いため） |
| 9/18〜9/27 の予約（ルール外・50件） | **2,000円** |
| 当日来場（予約日 10/10 以降） | **なし** |

### チケット（最終）
| 予約日 | 表示 |
|---|---|
| 〜 2026/09/13 | 3,000円分 |
| 2026/09/14 〜 09/27 | 2,000円 |
| 2026/09/28 〜 10/09 | medium が junko / 長原木 → 2,000円、それ以外 → 1,000円 |
| 2026/10/10 〜 | なし |
| 予約日なし（手入力の行） | － |

### ストラップ
- interview に「住宅相談 / 資金・ローン相談 / 土地探し相談 / 不動産売却相談」、または request に「注文住宅を検討している / 建売住宅を検討している / 中古住宅を検討している」のいずれか → **黄＋赤**の四角を横並び
- それ以外 → **青**の四角
- ⚠️ LP フォームの value と完全一致することを確認済み

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend/scripts/sql` | **2026-10-07_event_db_staff.sql**（新規） | `ALTER TABLE event_db ADD COLUMN staff TEXT DEFAULT NULL … AFTER remarks` |
| `backend/scripts/sql` | 2026-10-07_update_log_2.2.171.sql（新規） | update_log（ローカル no=267） |
| `backend-express/src/features/event` | **checkin.ts** | SELECT に reserved_at / medium / interview / request / staff。`reservedDate()` を追加。`toPublicView` に reservedDate / medium / interview / request / staff |
| `backend-express/src/features/list` | **event.ts** | `ALLOWED_COLUMNS` に `staff` |
| `backend/src/handlers/listAction` | **list_event.php** | `$allowed_columns` に `staff`（② と同じ） |
| `frontend/src/components/header` | **EventList.tsx** | 型に `staff`、同期対象に `staff`、「担当スタッフ」列（備考欄の左。onBlur で保存）、colSpan 16→17、minWidth 1800→1920 |
| `frontend/src/utils` | version.ts | 2.2.171 |
| ⚠️ リポジトリ外 `Downloads/20260425_kokubu_ouchi_festa_LP_NK/reservation/` | **index.html** | 受付UIを作り直し（下の差分）。バックアップ `index.html.before-staff-modal` |

- ⚠️ チケット・ストラップの判定は **LP 側**（ルールを当日直すことになっても LP の差し替えだけで済む）。② は値を返すだけ
- ⚠️ ② は合い言葉の照合後にしか予約内容を返さない（従来どおり）。電話・メール・住所は返さない
- ⚠️ Bootstrap の JS（5.3.3）を追加で読み込む。読めなかった場合は受付ボタンを無効にし、QR 表示は巻き込まない

## 確認（ローカル）
| ケース | 結果 |
|---|---|
| 合い言葉違い | 401「合い言葉が違います。」（予約内容は返らない） |
| lookup | `reservedDate: "2026/09/30"`・medium・interview・request・`staff: "山田"` が返る |
| checkin | 同じ項目＋ checkInTime |
| staff が NULL | `staff: ""`（画面では担当欄を出さない） |
| チケット境界 | 9/13→3,000円分、9/14・9/27→2,000円、9/28→1,000円、9/28 junko→2,000円、10/9 長原木→2,000円、10/9 その他→1,000円、10/10→なし、予約日なし→－ |
| ストラップ | キッチンカーのみ→青、住宅相談→黄＋赤、中古住宅を検討→黄＋赤、不動産売却相談→黄＋赤、空→青 |
- テスト行は削除済み。② tsc OK、LP script は `node --check` OK、タグの開閉数一致
- フロント build `main.9bc29f7e.js`（EventList の警告は変更前からある exhaustive-deps のみ）
- ⚠️ ブラウザ・スマホでの表示確認は未実施

---

## SQL
```sql
-- =====================================================================
-- event_db に staff（担当スタッフ）を追加する（v2.2.171）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️⚠️ **② と ① PHP を出す前に流すこと。**（② は SELECT * なので列が無くても落ちないが、
--   ⚠️ 保存時に Unknown column になる）
--
-- ⚠️ 入力は反響一覧（EventList.tsx）から。⚠️ 自由入力の TEXT。
-- =====================================================================

ALTER TABLE event_db ADD COLUMN staff TEXT DEFAULT NULL COMMENT '担当スタッフ（反響一覧で入力）' AFTER remarks;

-- 確認（⚠️ information_schema は ① で使えないため SHOW COLUMNS）
-- SHOW COLUMNS FROM event_db LIKE 'staff';
```

## リポジトリの差分（全文）
```diff
diff --git a/backend-express/src/features/event/checkin.ts b/backend-express/src/features/event/checkin.ts
index 795b48f7..bde54447 100644
--- a/backend-express/src/features/event/checkin.ts
+++ b/backend-express/src/features/event/checkin.ts
@@ -43,6 +43,12 @@ interface ReservationRow extends RowDataPacket {
   title: string | null;
   check_in_time: string | null;
   check_out_time: string | null;
+  /** ⚠️ v2.2.171 追加（受付画面のチケット・ストラップ・担当の判定に使う） */
+  reserved_at: string | null;
+  medium: string | null;
+  interview: string | null;
+  request: string | null;
+  staff: string | null;
 }
 
 /**
@@ -75,7 +81,22 @@ const stamp = (): string => {
 const asString = (value: unknown): string =>
   typeof value === 'string' ? value.trim() : '';
 
-/** 画面へ返す予約内容。⚠️ 電話番号・メールアドレスは返さない（受付に不要） */
+/**
+ * 予約日（`YYYY/MM/DD`）。⚠️ reserved_at は DATETIME（dateStrings で `YYYY-MM-DD HH:MM:SS`）。
+ * ⚠️ 受付画面のチケット判定は ⚠️ **来場日ではなく予約日**で行う（2026-10-07 の決定）。
+ * ⚠️ 本番の ② は TZ=Asia/Tokyo なので、reserved_at は日本時間で入っている。
+ */
+const reservedDate = (value: string | null): string => {
+  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
+  return m ? `${m[1]}/${m[2]}/${m[3]}` : '';
+};
+
+/**
+ * 画面へ返す予約内容。⚠️ 電話番号・メールアドレス・住所は返さない（受付に不要）。
+ *
+ * ⚠️ v2.2.171: 受付スタッフ用の全画面表示のため、予約日・媒体・相談内容・ご検討・担当スタッフを追加。
+ *   ⚠️ いずれも合い言葉を通った後にしか返らない（この関数は照合の後でしか呼ばれない）。
+ */
 const toPublicView = (row: ReservationRow) => ({
   id: row.id,
   name: row.name ?? '',
@@ -85,6 +106,11 @@ const toPublicView = (row: ReservationRow) => ({
   title: row.title ?? '',
   checkInTime: row.check_in_time ?? '',
   checkOutTime: row.check_out_time ?? '',
+  reservedDate: reservedDate(row.reserved_at),
+  medium: row.medium ?? '',
+  interview: row.interview ?? '',
+  request: row.request ?? '',
+  staff: row.staff ?? '',
 });
 
 /**
@@ -128,7 +154,8 @@ export const runEventCheckin = async (
   }
 
   const SELECT_SQL = `
-    SELECT id, name, kana, date, time, title, check_in_time, check_out_time
+    SELECT id, name, kana, date, time, title, check_in_time, check_out_time,
+           reserved_at, medium, interview, request, staff
       FROM event_db
      WHERE id = ?
      LIMIT 1
diff --git a/backend-express/src/features/list/event.ts b/backend-express/src/features/list/event.ts
index 25de5db6..48c41f38 100644
--- a/backend-express/src/features/list/event.ts
+++ b/backend-express/src/features/list/event.ts
@@ -49,6 +49,7 @@ export interface ListEventResult {
  *     check_in_time       … QRの読み取り（受付）で記録する
  *     check_out_time      … 退場時刻
  *     remarks             … 社内メモ（原本ではない）
+ *     staff               … 担当スタッフ（v2.2.171。自由入力）
  *     sync                … 顧客への取り込み済みフラグ
  *
  * ⚠️ ここに列を戻すときは EventList.tsx の入力欄と ① の PHP も合わせること。
@@ -65,6 +66,8 @@ const ALLOWED_COLUMNS = [
   'check_in_time',
   'check_out_time',
   'remarks',
+  // ⚠️ v2.2.171 追加。担当スタッフ（event_db.staff。⚠️ 先に ALTER を流すこと）
+  'staff',
   'sync',
 ] as const;
 
diff --git a/backend/src/handlers/listAction/list_event.php b/backend/src/handlers/listAction/list_event.php
index 0dc6afa8..ff11a344 100644
--- a/backend/src/handlers/listAction/list_event.php
+++ b/backend/src/handlers/listAction/list_event.php
@@ -59,13 +59,14 @@ if ($function && $function === 'update') {
     //   check_in_time       … QRの読み取り（受付）で記録するため必須
     //   check_out_time      … 退場時刻。受付運用で使う
     //   remarks             … 社内メモ。原本ではないので自由に書ける
+    //   staff               … 担当スタッフ（v2.2.171。自由入力。⚠️ 先に ALTER を流すこと）
     //   sync                … 顧客への取り込み済みフラグ
     //
     // ⚠️ ここに列を戻すときは EventList.tsx 側の入力欄も合わせること。
     //   片方だけ変えると、画面では編集できるのに保存されない（無言で消える）。
     $allowed_columns = [
         'name', 'phone', 'mail',
-        'check_in_time', 'check_out_time', 'remarks', 'sync'
+        'check_in_time', 'check_out_time', 'remarks', 'staff', 'sync'
     ];
 
     $update_fields = [];
diff --git a/frontend/src/components/header/EventList.tsx b/frontend/src/components/header/EventList.tsx
index 02baf8aa..e5ac2b06 100644
--- a/frontend/src/components/header/EventList.tsx
+++ b/frontend/src/components/header/EventList.tsx
@@ -22,6 +22,7 @@ import { filterReportShops, sortShops, MasterShop } from './useAmbassadorMaster'
  *   「本当は何と入力されたのか」が分からなくなる。
  *   サーバー側（listAction/list_event.php）でも同じ制限を掛けている。
  *   受付運用のための check_in_time / check_out_time / remarks は例外。
+ *   ⚠️ v2.2.171: 担当スタッフ（staff）も例外に追加（自由入力）。
  */
 type CustomerData = {
     no: string;
@@ -54,6 +55,8 @@ type CustomerData = {
     check_in_time: string | null;
     check_out_time: string | null;
     remarks: string;
+    /** 担当スタッフ（v2.2.171）。⚠️ 自由入力。⚠️ 列追加前の行・未入力は NULL */
+    staff: string | null;
     title: string;
     shop: string;
     sync: number | null;
@@ -324,7 +327,7 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
             //   表示のみの項目を書くと ref が無く、毎回空振りする
             const fields: (keyof CustomerData)[] = [
                 'name', 'phone', 'mail',
-                'check_in_time', 'check_out_time', 'remarks'
+                'check_in_time', 'check_out_time', 'remarks', 'staff'
             ];
 
             fields.forEach(field => {
@@ -783,7 +786,7 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
                     {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}
 
                     <div className="bg-white rounded shadow-sm border table-responsive">
-                        <Table hover className="m-0 align-top text-nowrap" style={{ minWidth: '1800px' }}>
+                        <Table hover className="m-0 align-top text-nowrap" style={{ minWidth: '1920px' }}>
                             <thead>
                                 <tr>
                                     {/* ⚠️ v2.2.166: 2行目に担当店舗を出すため 40px → 110px */}
@@ -803,6 +806,8 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
                                     <th style={{ ...thStyle, width: '130px' }}>チェックイン</th>
                                     <th style={{ ...thStyle, width: '130px' }}>チェックアウト</th>
                                     <th style={{ ...thStyle, width: '180px' }}>事前質問</th>
+                                    {/* ⚠️ v2.2.171 追加。担当スタッフ（自由入力） */}
+                                    <th style={{ ...thStyle, width: '120px' }}>担当スタッフ</th>
                                     <th style={{ ...thStyle, width: '180px' }}>備考欄</th>
                                 </tr>
                             </thead>
@@ -889,6 +894,10 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
                                                 {/* ⚠️ 事前質問も本人の入力。書き換えると原本が失われる */}
                                                 {item.question || ''}
                                             </td>
+                                            <td className="p-1 align-middle">
+                                                {/* ⚠️ v2.2.171: 担当スタッフ。⚠️ 保存は備考欄と同じ（フォーカスが外れたとき） */}
+                                                <input type="text" style={compactInputStyle} placeholder="担当スタッフ" ref={setRef(item.id, 'staff')} defaultValue={item.staff || ''} onBlur={() => handleBlur(item.id, 'staff')} />
+                                            </td>
                                             <td className="p-1 align-middle">
                                                 <textarea
                                                     style={{ ...compactInputStyle, height: '40px', resize: 'none' }}
@@ -903,7 +912,7 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
                                 })}
                                 {sortedData.length === 0 && !loading && (
                                     <tr>
-                                        <td colSpan={16} className="text-center p-4 text-muted" style={{ fontSize: '11px' }}>データがありません</td>
+                                        <td colSpan={17} className="text-center p-4 text-muted" style={{ fontSize: '11px' }}>データがありません</td>
                                     </tr>
                                 )}
 
@@ -911,7 +920,7 @@ const EventList = ({ eventSummary, setEventSummary }: Props) => {
                                     div を直接入れるとブラウザが table の外へ弾き出し、
                                     交差判定が働かずスクロールしても増えなくなる */}
                                 <tr ref={loaderRef}>
-                                    <td colSpan={16} className="text-center text-muted p-2" style={{ fontSize: '11px' }}>
+                                    <td colSpan={17} className="text-center text-muted p-2" style={{ fontSize: '11px' }}>
                                         {sortedData.length > displayLength
                                             ? `読み込み中…（${displayLength} / ${sortedData.length} 件）`
                                             : sortedData.length > 0 ? `全 ${sortedData.length} 件` : ''}
```

## LP reservation/index.html の差分（before-staff-modal → 新）
```diff
--- C:/Users/shinji-kawano/Downloads/20260425_kokubu_ouchi_festa_LP_NK/reservation/index.html.before-staff-modal	2026-10-07 17:47:42.343529400 +0900
+++ C:/Users/shinji-kawano/Downloads/20260425_kokubu_ouchi_festa_LP_NK/reservation/index.html	2026-10-07 17:50:31.806208600 +0900
@@ -104,41 +104,124 @@
             padding-top: 16px;
         }
 
-        .staff__toggle {
-            font-size: 12px;
-            color: #8898aa;
-            background: none;
-            border: none;
-            padding: 4px 0;
+        /*
+          ⚠️ v2.2.171: 「スタッフの方はこちら」（小さな文字リンク）→ ⚠️ **「受付スタッフ用」ボタン**。
+            ⚠️ 受付がQRを読んだらすぐ押せるよう、目立つ大きさ・色にする。
+        */
+        .staff__open {
+            width: 100%;
+            padding: 16px;
+            font-size: 18px;
+            font-weight: 700;
+            border-radius: 12px;
+            background-color: #332f86;
+            border-color: #332f86;
+            color: #fff;
+            box-shadow: 0 4px 14px rgba(51, 47, 134, .25);
         }
 
-        .staff__panel {
-            margin-top: 12px;
-            background-color: #f8f9fe;
-            border: 1px solid #e9ecef;
-            border-radius: 8px;
+        .staff__open:hover,
+        .staff__open:focus-visible {
+            background-color: #26236a;
+            border-color: #26236a;
+            color: #fff;
+        }
+
+        /* ⚠️ 受付は片手でスマホを持って押す。ボタンは大きくする */
+        .staff__action {
+            width: 100%;
             padding: 16px;
+            font-size: 20px;
+            font-weight: 700;
+            border-radius: 12px;
         }
 
-        .staff__name {
-            font-size: 22px;
+        /* ===== 全画面の受付モーダル ===== */
+        .rc__body {
+            display: flex;
+            flex-direction: column;
+            gap: 20px;
+            padding: 24px 20px 32px;
+            max-width: 640px;
+            width: 100%;
+            margin-inline: auto;
+        }
+
+        .rc__name {
+            font-size: 30px;
             font-weight: 700;
             color: #32325d;
-            line-height: 1.4;
+            line-height: 1.3;
+            word-break: break-all;
         }
 
-        .staff__meta {
-            font-size: 13px;
-            line-height: 1.8;
-            margin-top: 8px;
+        .rc__kana {
+            font-size: 16px;
+            color: #6c757d;
+            margin-top: 4px;
         }
 
-        /* ⚠️ 受付は片手でスマホを持って押す。ボタンは大きくする */
-        .staff__action {
-            width: 100%;
-            padding: 14px;
-            font-size: 17px;
+        .rc__row {
+            display: flex;
+            align-items: center;
+            justify-content: space-between;
+            gap: 16px;
+            padding: 16px 0;
+            border-bottom: 1px solid #e9ecef;
+        }
+
+        .rc__label {
+            font-size: 15px;
+            font-weight: 700;
+            color: #6c757d;
+        }
+
+        .rc__value {
+            font-size: 26px;
             font-weight: 700;
+            color: #212529;
+            text-align: right;
+        }
+
+        .rc__staff {
+            font-size: 15px;
+            color: #332f86;
+            background-color: #edecf4;
+            border-radius: 8px;
+            padding: 8px 12px;
+        }
+
+        /* ⚠️ ストラップの色。⚠️ 色だけで区別するので、四角は大きく・縁取りを付ける */
+        .rc__straps {
+            display: flex;
+            gap: 10px;
+        }
+
+        .rc__strap {
+            width: 56px;
+            height: 56px;
+            border-radius: 8px;
+            border: 2px solid rgba(0, 0, 0, .15);
+        }
+
+        .rc__strap--yellow { background-color: #ffd60a; }
+        .rc__strap--red { background-color: #e5383b; }
+        .rc__strap--blue { background-color: #1e6fd9; }
+
+        .rc__done {
+            font-size: 22px;
+            font-weight: 700;
+            text-align: center;
+            color: #495057;
+            background-color: #e9ecef;
+            border-radius: 12px;
+            padding: 16px;
+        }
+
+        .rc__times {
+            font-size: 13px;
+            color: #6c757d;
+            text-align: center;
         }
     </style>
 </head>
@@ -182,14 +265,34 @@
              合い言葉を入れるまでサーバーは氏名を返さない（画面側で隠すだけでは
              通信を見れば読めてしまうため、サーバー側で制御している）。 -->
         <div class="staff" id="staffSection">
-            <button type="button" class="staff__toggle" id="staffToggle">
-                スタッフの方はこちら（受付）
+            <!-- ⚠️ v2.2.171: 受付がQRを読んだら、すぐこれを押す -->
+            <button type="button" class="btn staff__open" id="staffOpen">
+                受付スタッフ用
             </button>
+        </div>
+
+        <dl class="info">
+            <dt>会場</dt>
+            <dd>オロシティーホール（鹿児島市卸本町6-12）</dd>
+            <dt>お問い合わせ</dt>
+            <dd>おうちづくりフェスタ実行委員会　tel. 099-296-8460</dd>
+        </dl>
+
+        <div class="text-center mt-4">
+            <a class="btn btn-outline-secondary btn-sm" href="../">イベントページへ戻る</a>
+        </div>
+    </main>
 
-            <div class="staff__panel d-none" id="staffPanel">
-                <!-- 合い言葉の入力 -->
-                <div id="staffLogin">
-                    <label class="form-label" for="passcode" style="font-size: 13px; font-weight: 700;">合い言葉</label>
+    <!-- ===== 合い言葉（受付スタッフ用を押したら開く） ===== -->
+    <div class="modal fade" id="passModal" tabindex="-1" aria-labelledby="passModalTitle" aria-hidden="true">
+        <div class="modal-dialog modal-dialog-centered">
+            <div class="modal-content">
+                <div class="modal-header">
+                    <h2 class="modal-title fs-5 fw-bold" id="passModalTitle">受付スタッフ用</h2>
+                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="閉じる"></button>
+                </div>
+                <div class="modal-body">
+                    <label class="form-label fw-bold" for="passcode" style="font-size: 14px;">合い言葉</label>
                     <!--
                       ⚠️ type="password" にしない。受付で入力を見ながら打つため。
                       ⚠️ inputmode="numeric" で数字キーパッドを出す（当日の入力を速くする）。
@@ -197,47 +300,67 @@
                     -->
                     <input class="form-control form-control-lg" type="text" id="passcode"
                         inputmode="numeric" autocomplete="off" enterkeyhint="go">
-                    <button type="button" class="btn btn-primary staff__action mt-2" id="lookupButton">
-                        予約を確認する
-                    </button>
                     <div class="alert alert-danger mt-2 mb-0 d-none" id="staffError" style="font-size: 13px;"></div>
-                </div>
-
-                <!-- 予約内容と受付操作 -->
-                <div id="staffResult" class="d-none">
-                    <div class="staff__name" id="resName"></div>
-                    <div class="staff__meta" id="resMeta"></div>
-
-                    <div class="alert mt-3 mb-0 d-none" id="resStatus" style="font-size: 13px;"></div>
-
-                    <button type="button" class="btn btn-success staff__action mt-3 d-none" id="checkinButton">
-                        チェックイン
-                    </button>
-                    <button type="button" class="btn btn-warning staff__action mt-3 d-none" id="checkoutButton">
-                        退場する
-                    </button>
-
-                    <button type="button" class="btn btn-outline-secondary w-100 mt-2" id="resetButton"
-                        style="font-size: 13px;">
-                        閉じる
+                    <button type="button" class="btn btn-primary staff__action mt-3" id="lookupButton">
+                        予約を確認する
                     </button>
                 </div>
             </div>
         </div>
+    </div>
 
-        <dl class="info">
-            <dt>会場</dt>
-            <dd>オロシティーホール（鹿児島市卸本町6-12）</dd>
-            <dt>お問い合わせ</dt>
-            <dd>おうちづくりフェスタ実行委員会　tel. 099-296-8460</dd>
-        </dl>
-
-        <div class="text-center mt-4">
-            <a class="btn btn-outline-secondary btn-sm" href="../">イベントページへ戻る</a>
+    <!-- ===== 予約内容と受付操作（全画面） ===== -->
+    <div class="modal fade" id="resultModal" tabindex="-1" aria-labelledby="resultModalTitle" aria-hidden="true">
+        <div class="modal-dialog modal-fullscreen">
+            <div class="modal-content">
+                <div class="modal-header">
+                    <h2 class="modal-title fs-5 fw-bold" id="resultModalTitle">受付</h2>
+                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="閉じる"></button>
+                </div>
+                <div class="modal-body p-0">
+                    <div class="rc__body">
+                        <div>
+                            <div class="rc__name" id="resName"></div>
+                            <div class="rc__kana" id="resKana"></div>
+                        </div>
+
+                        <!-- ⚠️ 担当スタッフ（反響一覧で入力）。⚠️ 入っているときだけ出す -->
+                        <div class="rc__staff d-none" id="resStaff"></div>
+
+                        <div>
+                            <div class="rc__row">
+                                <span class="rc__label">チケット</span>
+                                <span class="rc__value" id="resTicket"></span>
+                            </div>
+                            <div class="rc__row">
+                                <span class="rc__label">ストラップ</span>
+                                <span class="rc__straps" id="resStrap"></span>
+                            </div>
+                        </div>
+
+                        <div class="alert alert-danger mb-0 d-none" id="resultError" style="font-size: 14px;"></div>
+
+                        <button type="button" class="btn btn-success staff__action d-none" id="checkinButton">
+                            チェックイン
+                        </button>
+                        <button type="button" class="btn btn-warning staff__action d-none" id="checkoutButton">
+                            チェックアウト
+                        </button>
+                        <div class="rc__done d-none" id="checkedOut">チェックアウト済み</div>
+                        <div class="rc__times" id="resTimes"></div>
+
+                        <button type="button" class="btn btn-outline-secondary w-100 py-3" data-bs-dismiss="modal"
+                            style="font-size: 16px;">
+                            閉じる
+                        </button>
+                    </div>
+                </div>
+            </div>
         </div>
-    </main>
-
+    </div>
     <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
+    <!-- ⚠️ v2.2.171: モーダルのため Bootstrap の JS を読む（⚠️ CSS と同じ 5.3.3） -->
+    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
     <script>
         /**
          * ご予約QRコードの再表示 ＋ スタッフの受付。
@@ -280,13 +403,81 @@
 
             // ⚠️⚠️ **受付の初期化は QR の生成より先に行う。**
             //   QR生成で例外が飛ぶと、それ以降のコードが実行されず
-            //   「スタッフの方はこちら」が反応しなくなる（本番で実際に起きた）。
+            //   「受付スタッフ用」が反応しなくなる（本番で実際に起きた）。
             //   当日の受付は QR の表示より優先されるべき処理である。
             // ---------------------------------------------------------------
-            // スタッフ受付
+            // スタッフ受付（v2.2.171 作り直し）
+            //
+            //   「受付スタッフ用」→ 合い言葉のモーダル → ⚠️ 通ったら全画面のモーダル。
+            //   ⚠️ 目的: 受付スタッフが QR を読んだら、その場ですぐ対応できるようにする。
             // ---------------------------------------------------------------
-            el('staffToggle').addEventListener('click', function () {
-                el('staffPanel').classList.toggle('d-none');
+
+            /**
+             * チケット（⚠️ **予約日**で決める。2026-10-07 の決定）。
+             *
+             *   〜 9/13            … 3,000円分
+             *   9/14 〜 9/27       … 2,000円
+             *   9/28 〜 10/9       … 媒体が junko / 長原木 なら 2,000円、それ以外は 1,000円
+             *   10/10 〜（当日来場）… なし
+             *
+             * ⚠️ 予約日は ② が `YYYY/MM/DD` で返す（reservedDate）。⚠️ 同じ形なので文字列で比べてよい。
+             * ⚠️ 予約日が無い行（受付での手入力など）は「－」。
+             */
+            var TICKET_MEDIA = ['junko', '長原木'];
+            var ticketOf = function (reservation) {
+                var d = reservation.reservedDate || '';
+                if (d === '') return '－';
+                if (d <= '2026/09/13') return '3,000円分';
+                if (d <= '2026/09/27') return '2,000円';
+                if (d <= '2026/10/09') {
+                    return TICKET_MEDIA.indexOf(reservation.medium || '') >= 0 ? '2,000円' : '1,000円';
+                }
+                return 'なし';
+            };
+
+            /**
+             * ストラップ。
+             *   相談内容（interview）か ご検討（request）に、下のどれかが1つでもあれば
+             *   ⚠️ **黄色＋赤**（住まいの検討がある来場者）。⚠️ 無ければ **青**。
+             * ⚠️ どちらもカンマ区切りで入っている。
+             */
+            var STRAP_INTERVIEW = ['住宅相談', '資金・ローン相談', '土地探し相談', '不動産売却相談'];
+            var STRAP_REQUEST = ['注文住宅を検討している', '建売住宅を検討している', '中古住宅を検討している'];
+            var listOf = function (value) {
+                return String(value || '').split(',').map(function (v) { return v.trim(); });
+            };
+            var hasAny = function (values, keys) {
+                return values.some(function (v) { return keys.indexOf(v) >= 0; });
+            };
+            var strapOf = function (reservation) {
+                return hasAny(listOf(reservation.interview), STRAP_INTERVIEW)
+                    || hasAny(listOf(reservation.request), STRAP_REQUEST)
+                    ? ['yellow', 'red'] : ['blue'];
+            };
+            var STRAP_LABEL = { yellow: '黄', red: '赤', blue: '青' };
+
+            // ⚠️ Bootstrap の JS が読めない（CDN 障害など）と ⚠️ **ここで例外になり、QR も出なくなる。**
+            //   ⚠️ 来場者向けの QR 表示を巻き込まないよう、モーダルが作れなければ受付ボタンを無効にする。
+            var passModal = null;
+            var resultModal = null;
+            try {
+                passModal = new bootstrap.Modal(el('passModal'));
+                resultModal = new bootstrap.Modal(el('resultModal'));
+            } catch (error) {
+                console.error(error);
+                el('staffOpen').disabled = true;
+                el('staffOpen').textContent = '受付スタッフ用（読み込みに失敗しました。再読み込みしてください）';
+            }
+
+            el('staffOpen').addEventListener('click', function () {
+                if (!passModal) return;
+                clearError();
+                passModal.show();
+            });
+
+            // ⚠️ 開いたらすぐ合い言葉を打てるようにする
+            el('passModal').addEventListener('shown.bs.modal', function () {
+                el('passcode').focus();
             });
 
             var setError = function (message) {
@@ -297,6 +488,14 @@
 
             var clearError = function () {
                 el('staffError').classList.add('d-none');
+                el('resultError').classList.add('d-none');
+            };
+
+            /** 全画面を開いたあとの失敗（チェックインできなかった等）は全画面の中に出す */
+            var setResultError = function (message) {
+                var box = el('resultError');
+                box.textContent = message;
+                box.classList.remove('d-none');
             };
 
             /** サーバーを叩く。⚠️ 合い言葉は毎回送る（サーバーに状態を持たせない） */
@@ -316,44 +515,55 @@
             };
 
             /**
-             * 予約内容を画面に出す。
+             * 予約内容を全画面に出す。
              *
-             * ⚠️ 状態に応じて出すボタンを1つに絞る。両方出すと、
+             * ⚠️ 状態に応じて出すものを1つに絞る。両方出すと、
              *   受付で来場者を待たせながら押し間違える。
-             *     未チェックイン        → 「チェックイン」
-             *     チェックイン済み      → 「退場する」
-             *     退場済み              → ボタンなし
+             *     チェックイン前                 → 「チェックイン」
+             *     チェックイン済み・チェックアウト前 → 「チェックアウト」
+             *     どちらも済み                   → 「チェックアウト済み」の文字
              */
             var render = function (reservation) {
                 el('resName').textContent = (reservation.name || '（氏名未登録）') + ' 様';
+                el('resKana').textContent = reservation.kana || '';
+
+                if (reservation.staff) {
+                    el('resStaff').textContent = '担当：' + reservation.staff;
+                    show('resStaff');
+                } else {
+                    el('resStaff').textContent = '';
+                    hide('resStaff');
+                }
+
+                el('resTicket').textContent = ticketOf(reservation);
 
-                var meta = [];
-                if (reservation.kana) meta.push(reservation.kana);
-                meta.push('来場予定：' + (reservation.date || '') + ' ' + (reservation.time || ''));
-                el('resMeta').textContent = meta.join(' / ');
+                var strap = el('resStrap');
+                strap.textContent = '';
+                strapOf(reservation).forEach(function (color) {
+                    var box = document.createElement('span');
+                    box.className = 'rc__strap rc__strap--' + color;
+                    box.setAttribute('role', 'img');
+                    box.setAttribute('aria-label', STRAP_LABEL[color]);
+                    box.title = STRAP_LABEL[color];
+                    strap.appendChild(box);
+                });
 
-                var status = el('resStatus');
-                status.className = 'alert mt-3 mb-0';
                 hide('checkinButton');
                 hide('checkoutButton');
+                hide('checkedOut');
 
+                var times = [];
                 if (!reservation.checkInTime) {
-                    status.classList.add('alert-secondary');
-                    status.textContent = 'まだ受付されていません。';
                     show('checkinButton');
                 } else if (!reservation.checkOutTime) {
-                    status.classList.add('alert-success');
-                    status.textContent = reservation.checkInTime + ' にチェックイン済みです。';
                     show('checkoutButton');
+                    times.push('チェックイン ' + reservation.checkInTime);
                 } else {
-                    status.classList.add('alert-dark');
-                    status.textContent = 'チェックイン ' + reservation.checkInTime
-                        + ' ／ 退場 ' + reservation.checkOutTime;
+                    show('checkedOut');
+                    times.push('チェックイン ' + reservation.checkInTime);
+                    times.push('チェックアウト ' + reservation.checkOutTime);
                 }
-
-                status.classList.remove('d-none');
-                hide('staffLogin');
-                show('staffResult');
+                el('resTimes').textContent = times.join(' ／ ');
             };
 
             /** 押している間はボタンを止める。⚠️ 連打で二重に記録させない */
@@ -369,15 +579,23 @@
                     if (!data || data.status !== 'ok') {
                         // ⚠️ サーバーの案内文をそのまま出す。合い言葉違い・回数制限・
                         //   予約なしで文言が変わるため、固定文言にすると原因が伝わらない
-                        setError((data && data.message) || '処理に失敗しました。');
-                        show('staffLogin');
-                        hide('staffResult');
+                        var message = (data && data.message) || '処理に失敗しました。';
+                        if (roll === 'lookup') {
+                            setError(message);
+                        } else {
+                            setResultError(message);
+                        }
                         return;
                     }
                     render(data.reservation || {});
+                    if (roll === 'lookup') {
+                        passModal.hide();
+                        resultModal.show();
+                    }
                 }).catch(function (error) {
                     console.error(error);
-                    setError('通信に失敗しました。電波の良い場所で再度お試しください。');
+                    var message = '通信に失敗しました。電波の良い場所で再度お試しください。';
+                    if (roll === 'lookup') setError(message); else setResultError(message);
                 }).then(function () {
                     busy = false;
                     if (button) button.disabled = false;
@@ -405,19 +623,21 @@
             });
 
             el('checkoutButton').addEventListener('click', function () {
-                // ⚠️ 退場は取り消せない。確認を挟む
-                if (!window.confirm('退場を記録します。よろしいですか？')) return;
+                // ⚠️ チェックアウトは取り消せない。確認を挟む
+                if (!window.confirm('チェックアウトを記録します。よろしいですか？')) return;
                 run('checkout', el('checkoutButton'));
             });
 
-            el('resetButton').addEventListener('click', function () {
-                // ⚠️ 氏名を画面に残さない。次の来場者に前の人の名前が見えてしまう
-                el('resName').textContent = '';
-                el('resMeta').textContent = '';
-                el('resStatus').classList.add('d-none');
-                hide('staffResult');
-                show('staffLogin');
-                el('staffPanel').classList.add('d-none');
+            // ⚠️ 閉じたら（× / 閉じる / 背景）氏名を画面に残さない。次の来場者に前の人の名前が見えてしまう
+            el('resultModal').addEventListener('hidden.bs.modal', function () {
+                ['resName', 'resKana', 'resStaff', 'resTicket', 'resStrap', 'resTimes'].forEach(function (id) {
+                    el(id).textContent = '';
+                });
+                hide('resStaff');
+                hide('checkinButton');
+                hide('checkoutButton');
+                hide('checkedOut');
+                clearError();
             });
```
