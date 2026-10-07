# 2026-10-07 フェスタLP 当日来場フォーム（?status=non-reserve）（v2.2.169）

## 依頼
- `20260425_kokubu_ouchi_festa_LP_NK/index.html`（事前予約用LP）を、`?status=non-reserve` のとき ⚠️ **当日予約なしで来場した人向けのフォームだけの LP** にする（会場の QR から開く）
  - フォームのみ表示（不要なコンテンツは見せない）
  - date / time は表示しない。⚠️ 開いた日時を自動で選ぶ。time は ⚠️ **hh 基準**（10:55 でも 10:00~）

## 確認した回答
- 開催日（10/10・10/11）以外に開いたとき: ⚠️ **案内を出してフォームを出さない**
- 事前予約と区別して記録: ⚠️ **区別して来場済みにする**（② の変更あり）
- 完了画面: ⚠️ **QR を出さず「受付完了」だけ**

## 変更したファイル

| ディレクトリ | ファイル | 内容 |
|---|---|---|
| ⚠️ リポジトリ外 `Downloads/20260425_kokubu_ouchi_festa_LP_NK/` | `index.html` | `<head>` で `is-walkin` 判定・CSS で非表示、見出し差し替え、開催日以外の案内、日時の自動選択、`status` 送信、完了表示 |
| 同上 | ⚠️ 新規 `index.html.before-walkin` | 変更前のコピー |
| `backend-express/src/features/event/` | `reservation.ts` | ⚠️ 追加 `WALK_IN_STATUS` / `walkInDateTime` / `checkInStamp`。`runEventReservation` で当日来場を来場済みとして保存 |
| `backend/scripts/sql/` | `2026-10-07_update_log_2.2.169.sql` | 文言に追記（⚠️ ローカルは UPDATE で揃え済み） |
| `docs/` | `deploy-v2.2.169.md` | ② と LP の手順、確認 15〜19 を追加 |

## 設計メモ
- 記録の形は既存データに合わせた: ⚠️ 2026-08 の住まいるフェスティバルの当日来場が `status = 'non-reserve'`・`check_in_time` 入りで 53件ある。反響一覧の「来場状況」は `check_in_time` の有無で決まる。
- ⚠️⚠️ **当日来場は日時をリクエストから受け取らない。** この受付口は認証なし。受け取ると開催日以外の日付で「来場済み」の行を作れる。⚠️ ② の時計（⚠️ Asia/Tokyo を明示）で決め、開催日以外は 400。LP も同じ計算で表示するので見た目と保存値は一致。
- `status` は ⚠️ `'non-reserve'` 以外は無視（⚠️ 任意の値で来場済みにはできない）。
- LP の非表示は ⚠️ `<head>` の script で `html.is-walkin` を付け、CSS で `.lp > :not(#form)`・`#giftPopup`・`.walkin-hide`（日時の欄）を隠す（⚠️ 本文の後で判定すると上部の画像が一瞬見える）。
- 来場時間が選択肢に無い時刻（9時台・16時台など）は option を足して選ぶ（⚠️ 保存値は ② が決める）。
- ~~メールは変更していない~~ → **追加対応（同日）**: 当日来場には ⚠️ **予約者宛の予約完了メールを送らない**。社内通知は従来どおり送る。

### 追加対応: 当日来場の予約完了メールを止める
*backend-express/src/features/event* **reservation.ts** — `runEventReservation` のメール送信部分

```ts
  // ⚠️ 当日来場には ⚠️ **顧客宛の予約完了メールを送らない**（⚠️ 受付済みなので QR の提示案内は不要）。
  //   ⚠️ 社内通知は送る（⚠️ 誰が来場したかを知るため）。
  const [confirmSent, noticeSent] = await Promise.all([
    walkIn ? Promise.resolve(false) : sendReservationConfirm(payload, qr),
    sendInternalNotice(payload, qr),
  ]);
```

- 応答の `mailSent` は当日来場では `false`（⚠️ LP は参照していない）。

## 確認（ローカル）
- ② を時計を固定してコンテナ内で直接実行:

| # | 条件 | 結果 |
|---|---|---|
| 1 | 2026/10/10 10:55 JST、当日来場（⚠️ 日時はわざと別の値を送信） | ok → `2026/10/10(土)` `10:00~` `non-reserve` `2026/10/10 10:55:30` |
| 2 | 2026/10/11 9:05 JST、当日来場 | ok → `2026/10/11(日)` `9:00~` `non-reserve` |
| 3 | 2026/10/07（開催日以外）、当日来場 | ⚠️ 400「このフォームは開催当日のみご利用いただけます。」 |
| 4 | 事前予約（status なし） | ok → 選んだ日時、status / check_in_time は NULL（従来どおり） |
| 5 | status に「来場済み」 | ok → ⚠️ 無視されて事前予約扱い（NULL） |

- ⚠️ コンテナの TZ が UTC でも日本時間で計算されることを確認（ログは UTC 表記）。テスト行は削除。
- `tsc --noEmit` 通過。LP の script 4つを `new Function` で構文確認 → すべて ok。日時の計算（10:55 → 10:00~、15:59 → 15:00~）も確認。
- ⚠️ ブラウザでの表示確認は ⚠️ **未実施**。

## コード

### backend-express/src/features/event/reservation.ts（差分）
```diff
diff --git a/backend-express/src/features/event/reservation.ts b/backend-express/src/features/event/reservation.ts
index 42cdcf07..c23a6a8b 100644
--- a/backend-express/src/features/event/reservation.ts
+++ b/backend-express/src/features/event/reservation.ts
@@ -20,6 +20,9 @@ import type { ReservationMailData } from './mail';
  *     ・**リクエストの値を一切信用しない**
  *     ・title / status / shop / sync / check_in_time は**受け付けない**
  *       （受け付けると別イベントへの混入や「来場済み」への偽装ができる）
+ *       ⚠️ 例外: status = 'non-reserve'（当日来場、v2.2.169）だけは受ける。
+ *         ⚠️ そのとき日時はリクエストを使わず ⚠️ **② の時計（日本時間）**で決め、
+ *         ⚠️ 開催日以外は弾く（⚠️ 開催日以外に「来場済み」を作らせない）。
  *     ・全項目に長さ上限を掛ける
  *     ・例外の内容を応答に含めない
  *     ・流量制限を掛ける（middlewares/publicFormRateLimit.ts）
@@ -54,6 +57,50 @@ const ID_PATTERN = /^festa2026_[A-Za-z0-9]{16}$/;
 /** 来場日として受け付ける値。⚠️ LPの select の option と一致させること */
 const ALLOWED_DATES = new Set(['2026/10/10(土)', '2026/10/11(日)']);
 
+/**
+ * 当日来場（予約なしで来場し、会場の QR から LP を開いた人）の印。v2.2.169。
+ *
+ * ⚠️ LP は `?status=non-reserve` のとき、送信本文に `status: 'non-reserve'` を付ける。
+ * ⚠️ event_db.status の値も同じ `non-reserve`（⚠️ 2026-08 の住まいるフェスティバルの当日来場と同じ記録の形）。
+ */
+const WALK_IN_STATUS = 'non-reserve';
+
+/**
+ * 今（⚠️ 日本時間）の来場日と来場時間。当日来場のときだけ使う。
+ *
+ * ⚠️⚠️ **当日来場は日時をリクエストから受け取らない。** ⚠️ この口は認証なしで誰でも叩けるため、
+ *   受け取ると ⚠️ **開催日以外の日付で「来場済み」の行を作れてしまう。**
+ *   ⚠️ LP も同じ計算で表示しているので、見た目と保存値は一致する。
+ * ⚠️ コンテナの TZ に依らないよう、⚠️ **Asia/Tokyo を明示して**計算する。
+ *
+ * 来場日 … `YYYY/MM/DD(曜)`（⚠️ ALLOWED_DATES と同じ形）
+ * 来場時間 … ⚠️ **時の部分だけ**（指示書。⚠️ 10:55 でも `10:00~`）
+ */
+const walkInDateTime = (): { date: string; time: string } => {
+  const parts = Object.fromEntries(
+    new Intl.DateTimeFormat('ja-JP', {
+      timeZone: 'Asia/Tokyo',
+      year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: 'numeric', hourCycle: 'h23',
+    }).formatToParts(new Date()).map((p) => [p.type, p.value])
+  );
+  return {
+    date: `${parts.year}/${parts.month}/${parts.day}(${parts.weekday})`,
+    time: `${Number(parts.hour)}:00~`,
+  };
+};
+
+/** 受付時刻（⚠️ 日本時間）。⚠️ checkin.ts の stamp() と同じ `YYYY/MM/DD HH:MM:SS` */
+const checkInStamp = (): string => {
+  const parts = Object.fromEntries(
+    new Intl.DateTimeFormat('ja-JP', {
+      timeZone: 'Asia/Tokyo',
+      year: 'numeric', month: '2-digit', day: '2-digit',
+      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
+    }).formatToParts(new Date()).map((p) => [p.type, p.value])
+  );
+  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
+};
+
 /** LPの `?m=` に対応する媒体 */
 interface Campaign {
   /** event_db.medium に保存する値 */
@@ -183,12 +230,24 @@ export const runEventReservation = async (
     };
   }
 
-  const date = clean(body.date, 32);
+  // ⚠️ 当日来場（v2.2.169）。⚠️ 'non-reserve' 以外の値は無視する（⚠️ 任意の status は受け付けない）
+  const walkIn = clean(body.status, 16) === WALK_IN_STATUS;
+
+  // ⚠️ 当日来場は日時を ② の時計で決める（walkInDateTime の注記）
+  const now = walkIn ? walkInDateTime() : null;
+
+  const date = now ? now.date : clean(body.date, 32);
   if (!ALLOWED_DATES.has(date)) {
-    return { httpStatus: 400, body: { status: 'error', message: '来場日を選択してください。' } };
+    return {
+      httpStatus: 400,
+      body: {
+        status: 'error',
+        message: walkIn ? 'このフォームは開催当日のみご利用いただけます。' : '来場日を選択してください。',
+      },
+    };
   }
 
-  const time = clean(body.time, 16);
+  const time = now ? now.time : clean(body.time, 16);
   if (time === '') {
     return { httpStatus: 400, body: { status: 'error', message: '来場時間を選択してください。' } };
   }
@@ -217,6 +276,10 @@ export const runEventReservation = async (
     // ⚠️ フォームは同意必須。'1' 以外が来たら未同意として保存する（弾かない）
     agree: clean(body.agree, 4) === '1' ? 1 : 0,
     reserved_at: nowForDb(),
+    // ⚠️ 当日来場は ⚠️ **来場済みとして保存する**（⚠️ 反響一覧の「来場状況」は check_in_time で決まる）。
+    //   ⚠️ 事前予約では空（NULL）のまま。⚠️ 受付で QR を読んだときに入る（checkin.ts）。
+    status: walkIn ? WALK_IN_STATUS : '',
+    check_in_time: walkIn ? checkInStamp() : '',
   };
 
   try {
```

### LP index.html（差分）
```diff
--- /c/Users/shinji-kawano/Downloads/20260425_kokubu_ouchi_festa_LP_NK/index.html.before-walkin	2026-10-07 12:08:50.072225000 +0900
+++ /c/Users/shinji-kawano/Downloads/20260425_kokubu_ouchi_festa_LP_NK/index.html	2026-10-07 12:09:48.654805300 +0900
@@ -218,7 +218,37 @@
         font-size: 24px;
         line-height: 1;
       }
+
+      /* ---------------------------------------------------------------
+         当日来場（?status=non-reserve）。会場の QR から開いた人向け。
+         ⚠️ フォーム以外は出さない。⚠️ 来場日・来場時間の欄も出さない（下の script で自動で入れる）。
+         ⚠️ 判定は <head> の script で html に is-walkin を付けて行う
+           （⚠️ 本文を描く前に隠すため。⚠️ 下で判定すると上部の画像が一瞬見える）。
+         --------------------------------------------------------------- */
+      html.is-walkin .lp > :not(#form),
+      html.is-walkin #giftPopup,
+      html.is-walkin .walkin-hide {
+        display: none !important;
+      }
+      .walkin-only {
+        display: none;
+      }
+      html.is-walkin .walkin-only {
+        display: inline;
+      }
+      .walkin-closed {
+        padding: 24px 16px;
+        text-align: center;
+        font-weight: 700;
+        color: #b02a37;
+      }
     </style>
+    <script>
+      // ⚠️ 当日来場の判定。⚠️ 本文より先に html へ印を付ける（上の CSS が効くように）
+      if (new URLSearchParams(window.location.search).get("status") === "non-reserve") {
+        document.documentElement.classList.add("is-walkin");
+      }
+    </script>
   </head>
 
   <body>
@@ -337,7 +367,14 @@
       </div>
 
       <section class="form" id="form">
-        <h2 class="form__title">ご予約フォーム</h2>
+        <h2 class="form__title">
+          <span class="walkin-hide">ご予約フォーム</span><span class="walkin-only">ご来場受付フォーム</span>
+        </h2>
+
+        <!-- ⚠️ 当日来場で、開催日以外に開いたときだけ出す（下の script が hidden を外す） -->
+        <p class="walkin-closed" id="walkinClosed" hidden>
+          このフォームは開催当日（2026/10/10・10/11）のみご利用いただけます。
+        </p>
 
         <!-- ⚠️ 送信は action ではなく、下部のスクリプト（SUBMIT_ENDPOINT）から
              fetch で行う。確認モーダルを経てから送るため。 -->
@@ -349,7 +386,8 @@
         >
           <input type="hidden" id="id" name="id" value="" />
 
-          <div class="form__group">
+          <!-- ⚠️ 当日来場では来場日・来場時間を出さない（walkin-hide）。値は script が自動で選ぶ -->
+          <div class="form__group walkin-hide">
             <label class="form__label" for="date"
               >来場日<span class="badge text-bg-danger">必須</span></label
             >
@@ -366,7 +404,7 @@
             <div class="invalid-feedback">来場日を選択してください。</div>
           </div>
 
-          <div class="form__group">
+          <div class="form__group walkin-hide">
             <label class="form__label" for="time"
               >来場時間<span class="badge text-bg-danger">必須</span></label
             >
@@ -831,6 +869,45 @@
           { name: "agree", label: "個人情報の取り扱い" },
         ];
 
+        /**
+         * 当日来場（?status=non-reserve）。v2.2.169。
+         *
+         * ⚠️ 来場日・来場時間は ⚠️ **開いた時刻（日本時間）から自動で選ぶ**（欄は CSS で隠してある）。
+         *   来場日 … 今日。⚠️ select の選択肢に無い日（＝開催日以外）はフォームを出さない
+         *   来場時間 … ⚠️ **時だけ**（指示書。10:55 でも「10:00~」）。⚠️ 選択肢に無い時刻は足す
+         * ⚠️ サーバー（② reservation.ts の walkInDateTime）も ⚠️ **同じ計算で日時を決め直す**。
+         *   ⚠️ ここで選んだ値は確認画面に出すためのもの（⚠️ 保存値はサーバーが決める）。
+         */
+        const isWalkIn = document.documentElement.classList.contains("is-walkin");
+        if (isWalkIn) {
+          const parts = Object.fromEntries(
+            new Intl.DateTimeFormat("ja-JP", {
+              timeZone: "Asia/Tokyo",
+              year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
+              hour: "numeric", hourCycle: "h23",
+            }).formatToParts(new Date()).map((p) => [p.type, p.value]),
+          );
+          const today = `${parts.year}/${parts.month}/${parts.day}(${parts.weekday})`;
+          const hourLabel = `${Number(parts.hour)}:00~`;
+
+          const dateSelect = form.querySelector('select[name="date"]');
+          const timeSelect = form.querySelector('select[name="time"]');
+          const isEventDay = [...dateSelect.options].some((o) => o.value === today);
+
+          if (!isEventDay) {
+            // ⚠️ 開催日以外は入力させない（⚠️ 送ってもサーバーが 400 を返す）
+            form.hidden = true;
+            document.getElementById("walkinClosed").hidden = false;
+          } else {
+            dateSelect.value = today;
+            if (![...timeSelect.options].some((o) => o.value === hourLabel)) {
+              timeSelect.add(new Option(hourLabel, hourLabel));
+            }
+            timeSelect.value = hourLabel;
+            document.getElementById("submitButton").textContent = "この内容で受付する";
+          }
+        }
+
         const confirmBody = document.getElementById("confirmBody");
         const confirmModal = new bootstrap.Modal(
           document.getElementById("confirmModal"),
@@ -924,6 +1001,19 @@
             "ご予約ありがとうございます";
         };
 
+        /** 当日来場の完了表示（v2.2.169）。⚠️ QR は出さない */
+        const showWalkInComplete = () => {
+          document.getElementById("qrImage").style.display = "none";
+          const text = document.querySelector("#completeView .qr__text");
+          text.textContent =
+            "ご来場の受付が完了しました。おうちづくりフェスタ2026へようこそ。お手数ですが、この画面を受付スタッフにお見せください。";
+          document.getElementById("confirmView").classList.add("d-none");
+          document.getElementById("confirmFooter").classList.add("d-none");
+          document.getElementById("completeView").classList.remove("d-none");
+          document.getElementById("completeFooter").classList.remove("d-none");
+          document.getElementById("confirmModalLabel").textContent = "受付が完了しました";
+        };
+
         // ダッシュボード（② VPS）のゲートウェイ。
         //
         // ⚠️ ① レンタルサーバー（khg-marketing.info）ではなく ② を直接叩く。
@@ -948,6 +1038,8 @@
         const buildPayload = (reservationId) => {
           const formData = new FormData(form);
           return {
+            // ⚠️ 当日来場の印（v2.2.169）。⚠️ サーバーは来場済みとして保存し、日時は自分の時計で決める
+            ...(isWalkIn ? { status: "non-reserve" } : {}),
             m: campaignParam,
             request: API_REQUEST,
             id: reservationId,
@@ -1003,6 +1095,12 @@
             //   ボタンを押し直させると、新しい id で**二重に予約が入る**
             //   （id が違うため event_db の UNIQUE キーでは防げない）。
             //   QRが出せなくても、同じQRは予約完了メールに添付されている。
+            // ⚠️ 当日来場は QR を出さない（⚠️ もう会場にいて、受付も済んでいる）
+            if (isWalkIn) {
+              showWalkInComplete();
+              return;
+            }
+
             let qrDataUrl = "";
             try {
               // ⚠️ QRの生成は送信が成功してから行う。先に出すと、
```

---

## 追加対応（同日）: 開催日以外も受付・社内通知の件名

### 依頼
- 当日ではなくても閲覧可・申込可とする
- 社内通知の件名を `【おうちづくりフェスタ2026／当日来場】〇〇〇〇様` とする

### 変更
*backend-express/src/features/event* **reservation.ts** — `runEventReservation`

```ts
  // ⚠️ 当日来場は ⚠️ **開催日以外でも受け付ける**（v2.2.169 追加指示）。⚠️ 日付は ② の時計の今日。
  //   ⚠️ 事前予約だけ ALLOWED_DATES で検証する。
  const date = now ? now.date : clean(body.date, 32);
  if (!walkIn && !ALLOWED_DATES.has(date)) {
    return { httpStatus: 400, body: { status: 'error', message: '来場日を選択してください。' } };
  }
```
- `payload` に `walkIn` を追加。`walkInDateTime` の注記を更新（日時はリクエストから受け取らない点は維持）

*backend-express/src/features/event* **mail.ts**
- `ReservationMailData.walkIn: boolean` を追加
- `sendInternalNotice`:

```ts
  const suffix = data.ticket === '' ? '' : `(${data.ticket})`;
  const kind = data.walkIn ? '当日来場' : '予約';

  const lines = [
    data.walkIn
      ? `${data.title} の当日来場フォームから受付が入りました（来場済みとして登録済み）。`
      : `${data.title} のLPから予約が入りました。`,
  ...
    subject: sanitizeHeader(`【${data.title}／${kind}】${customer}${suffix}`),
```
- ⚠️ `?m=c` / `?m=j` 付きの当日来場は、件名の末尾にチケット名が付く（例: `…／当日来場】〇〇様(長原木2,000円チケット)`）

*リポジトリ外* **LP index.html**（バックアップ `index.html.before-walkin-anyday`）
- 開催日以外でフォームを隠す処理を削除。今日の日付が選択肢に無ければ足して選ぶ
- 不要になった `#walkinClosed`（開催日以外の案内）と `.walkin-closed` の CSS を削除

```js
          // ⚠️ 開催日以外は選択肢に無いので足す（⚠️ 確認画面に今日の日付を出すため）
          if (![...dateSelect.options].some((o) => o.value === today)) {
            dateSelect.add(new Option(today, today));
          }
          dateSelect.value = today;
          if (![...timeSelect.options].some((o) => o.value === hourLabel)) {
            timeSelect.add(new Option(hourLabel, hourLabel));
          }
          timeSelect.value = hourLabel;
          document.getElementById("submitButton").textContent = "この内容で受付する";
```

### 確認（ローカル②・メールは送らず件名だけ横取り）
| ケース | 結果 |
|---|---|
| 当日来場・10/07（開催日以外）、本文に date=10/10 を混ぜる | 200。`2026/10/07(水)`・来場済みで保存（本文の日付は無視） |
| 当日来場 + m=c | 200。medium=長原木。件名 `【おうちづくりフェスタ2026／当日来場】テスト太郎様(長原木2,000円チケット)` |
| 当日来場（m なし） | 件名 `【おうちづくりフェスタ2026／当日来場】テスト太郎様`。予約者宛メールなし |
| 事前予約 10/11 | 200。件名 `／予約` と予約者宛メール（従来どおり） |
| 事前予約で開催日以外 | 400（従来どおり） |
- テスト行は削除済み。LP の script 4つは `node --check` で構文 OK
