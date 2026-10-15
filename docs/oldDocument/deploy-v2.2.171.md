# デプロイ手順 v2.2.171

⚠️⚠️ **v2.2.170 を先に出してあることが前提です**（⚠️ v2.2.171 は v2.2.170 の上に積んでいる）。
⚠️ v2.2.170 がまだなら、⚠️ **v2.2.170 → v2.2.171 の順**に出すこと（`deploy-v2.2.170.md`）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ⚠️ `event_db` に ⚠️ **`staff`（担当スタッフ）列**を追加 | ⚠️ **① DB** |
| 2 | ⚠️ 反響一覧（集客イベント）に ⚠️ **「担当スタッフ」入力欄**（備考欄の左） | ① フロント |
| 3 | ⚠️ 担当スタッフの保存を許可 | ⚠️ **② VPS**（`list/event.ts`）と ⚠️ **① PHP**（`list_event.php`） |
| 4 | ⚠️ 受付 API（`event_checkin`）が ⚠️ 予約日・媒体・相談内容・ご検討・担当スタッフも返す | ⚠️ **② VPS**（`event/checkin.ts`） |
| 5 | ⚠️ 受付画面（QR）を作り直し：⚠️ **「受付スタッフ用」ボタン → 合い言葉 → 全画面**で お名前／ふりがな／担当／チケット／ストラップ／チェックイン・チェックアウト | ⚠️ **LP（kh-house.jp/festa/reservation/）** |
| 6 | 更新履歴に1行増える | ① DB |

---

## 順序

```
1. ① SQL（ALTER：event_db.staff）     ← ⚠️ 最初
2. ② Express（build）
3. ① PHP（list_event.php）
4. LP（reservation/index.html）       ← ⚠️ 2 のあと
5. ① フロント（build）
6. ① SQL（update_log）
```

- ⚠️ **1 を先に。** ② の受付 API は `staff` を SELECT するため、⚠️ 列が無いと ⚠️ **受付（QR）がエラーになる。**
- ⚠️ 4 を 2 より先に出すと、⚠️ チケットが「－」・ストラップが青のまま（⚠️ 古い ② が値を返さない）。⚠️ チェックイン自体はできる。
- ⚠️ ② は `production` から取るので、⚠️ **先に GitHub で v2.2.171 を production へマージ**しておくこと。

---

## 手順1　【① レンタルサーバー／phpMyAdmin】event_db に staff を追加

⚠️ ファイル: `backend/scripts/sql/2026-10-07_event_db_staff.sql`

```sql
ALTER TABLE event_db ADD COLUMN staff TEXT DEFAULT NULL COMMENT '担当スタッフ（反響一覧で入力）' AFTER remarks;
```

確認:
```sql
SHOW COLUMNS FROM event_db LIKE 'staff';
```
⚠️ 1行（`staff` / `text` / `YES` / `NULL`）出れば完了。

---

## 手順2　【② VPS で実行】Express の再ビルド

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "reserved_at, medium, interview, request, staff" backend-express/src/features/event/checkin.ts
```
⚠️ 1行出れば v2.2.171 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

| ファイル | |
|---|---|
| `src/features/event/checkin.ts` | ⚠️ 受付の応答に reservedDate / medium / interview / request / staff |
| `src/features/list/event.ts` | ⚠️ 更新の許可リストに `staff` |

---

## 手順3　【① レンタルサーバー】PHP

| ファイル | |
|---|---|
| ⚠️ `backend/src/handlers/listAction/list_event.php` | ⚠️ `$allowed_columns` に `staff`（⚠️ ② が落ちたときのフォールバック用。② と揃える） |

---

## 手順4　【LP】reservation/index.html を差し替え

| ファイル | |
|---|---|
| ⚠️ `Downloads/20260425_kokubu_ouchi_festa_LP_NK/reservation/index.html` | ⚠️ **https://kh-house.jp/festa/reservation/ の index.html と差し替え** |

⚠️ 変更前は同じフォルダの `index.html.before-staff-modal`（⚠️ 切り戻し用）。
⚠️ LP 本体（`festa/index.html`）は今回変えていない。

---

## 手順5　【WSL】フロントを ① へアップロード

| ファイル | |
|---|---|
| ⚠️⚠️ **`static/js/main.9bc29f7e.js`** | ⚠️ **この版の本体** |
| `static/css/main.7c10f266.css` | ⚠️ 変更なし |
| ⚠️ `index.html` | ⚠️⚠️ **必ず差し替えること** |

```
main.9bc29f7e.js   ← ⚠️⚠️ これが v2.2.171（正）
main.09d1872c.js   … v2.2.170
```

```bash
deploy-dashboard
```

---

## 手順6　【① レンタルサーバー／phpMyAdmin】更新履歴

⚠️ ファイル: `backend/scripts/sql/2026-10-07_update_log_2.2.171.sql`

```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

⚠️ 一番上が `2.2.171` なら完了。

---

## ⚠️ 出したあとの確認

| # | 見ること | 期待 |
|---|---|---|
| 1 | ⚠️ ヘッダーの版 | ⚠️ **2.2.171** |
| 2 | ⚠️ 反響一覧（集客イベント） | ⚠️ 備考欄の左に ⚠️ **「担当スタッフ」**の入力欄 |
| 3 | ⚠️ 担当スタッフに名前を入れて欄の外をクリック → 画面を開き直す | ⚠️ ⚠️ **名前が残っている** |
| 4 | ⚠️ 予約完了メールの QR をスマホで読む | ⚠️ QR の下に ⚠️ **「受付スタッフ用」**（大きな紺色のボタン） |
| 5 | ⚠️ 押す | ⚠️ 合い言葉のモーダル。⚠️ 違う合い言葉 → 「合い言葉が違います。」 |
| 6 | ⚠️ 正しい合い言葉 | ⚠️ ⚠️ **全画面**で お名前（様）／ふりがな／（担当がいれば「担当：〇〇」）／チケット／ストラップ |
| 7 | ⚠️ チケット | ⚠️ 予約日が 9/13 以前 → 3,000円分、9/14〜9/27 → 2,000円、9/28〜10/9 → 1,000円（⚠️ `?m=c`・`?m=j` 経由は 2,000円）、当日来場 → なし |
| 8 | ⚠️ ストラップ | ⚠️ 住宅相談・資金ローン相談などを選んだ人 → ⚠️ **黄＋赤**、それ以外 → ⚠️ **青** |
| 9 | ⚠️ チェックイン前 | ⚠️ **チェックイン**ボタン → 押すと ⚠️ **チェックアウト**ボタンに変わる |
| 10 | ⚠️ チェックアウト | ⚠️ 確認ダイアログ → ⚠️ **「チェックアウト済み」**の文字 |
| 11 | ⚠️ 右上の × ／ 閉じる | ⚠️ 閉じる。⚠️ もう一度開くと前の人の名前が残っていない |

---

## 切り戻し

| 対象 | 方法 |
|---|---|
| LP | `index.html.before-staff-modal` に戻す |
| ① フロント | v2.2.170 の `main.09d1872c.js` と index.html に戻す |
| ② | v2.2.170 の production で `dcp build` / `up -d` |
| ① PHP | `list_event.php` を v2.2.170 のものに戻す |
| DB | ⚠️ `staff` 列は残してよい（⚠️ 古いコードは使わないだけ）。⚠️ 消す場合は `ALTER TABLE event_db DROP COLUMN staff;`（⚠️ 入力済みの担当が消える） |
