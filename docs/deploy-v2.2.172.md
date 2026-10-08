# デプロイ手順 v2.2.172

⚠️⚠️ **v2.2.171 を先に出してあることが前提です**（⚠️ 2026-10-08 時点で production に入っていることを確認）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ⚠️ `event_db` に ⚠️ **`festa`（営業入力の JSON）列**を追加 | ⚠️ **① DB** |
| 2 | ⚠️ 予約一覧の更新に ⚠️ **`function: 'festa'`**（営業入力の1項目を JSON_SET で書く）と、⚠️ 更新できる列に **`kana`** | ⚠️ **② VPS**（`list/event.ts`）と ⚠️ **① PHP**（`list_event.php`） |
| 3 | ⚠️ ヘッダー → 集客イベントに ⚠️ **「おうちづくりフェスタ2026」**（当日用の全画面） | ① フロント |
| 4 | 更新履歴に1行増える | ① DB |

⚠️ LP（kh-house.jp/festa）は今回変えていません。

---

## 順序

```
1. ① SQL（ALTER：event_db.festa）     ← ⚠️ 最初
2. ② Express（build）
3. ① PHP（list_event.php）
4. ① フロント（build）
5. ① SQL（update_log）
```

- ⚠️ **1 を先に。** 列が無いと ⚠️ 営業入力のトグルが保存できない（⚠️ 画面では一瞬オンになって戻る）。
- ⚠️ 4 を 2 より先に出すと、⚠️ 古い ② が `function: 'festa'` を知らず「無効な function です」→ ⚠️ トグルが戻る。⚠️ ふりがなも保存されない。
- ⚠️ ② は `production` から取るので、⚠️ **先に GitHub で v2.2.172 を production へマージ**しておくこと。

---

## 手順1　【① レンタルサーバー／phpMyAdmin】event_db に festa を追加

⚠️ ファイル: `backend/scripts/sql/2026-10-08_event_db_festa.sql`

```sql
ALTER TABLE event_db ADD COLUMN festa LONGTEXT DEFAULT NULL COMMENT 'おうちづくりフェスタ2026 の営業入力（JSON）' AFTER staff;
```

確認:
```sql
SHOW COLUMNS FROM event_db LIKE 'festa';
```
⚠️ 1行（`festa` / `longtext` / `YES` / `NULL`）出れば完了。

---

## 手順2　【② VPS で実行】Express の再ビルド

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "if (fn === 'festa')" backend-express/src/features/list/event.ts
```
⚠️ 1行出れば v2.2.172 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

| ファイル | |
|---|---|
| `src/features/list/event.ts` | ⚠️ `runFesta`（JSON_SET で1項目）／ `ALLOWED_COLUMNS` に `kana` |

---

## 手順3　【① レンタルサーバー】PHP

| ファイル | |
|---|---|
| ⚠️ `backend/src/handlers/listAction/list_event.php` | ⚠️ `festa` の処理と `kana`（⚠️ ② が落ちたときのフォールバック用。② と同じ） |

---

## 手順4　【WSL】フロントを ① へアップロード

| ファイル | |
|---|---|
| ⚠️⚠️ **`static/js/main.f6ec89af.js`** | ⚠️ **この版の本体** |
| `static/css/main.7c10f266.css` | ⚠️ 変更なし |
| ⚠️ `index.html` | ⚠️⚠️ **必ず差し替えること** |

```
main.f6ec89af.js   ← ⚠️⚠️ これが v2.2.172（正）
main.9bc29f7e.js   … v2.2.171
```

```bash
deploy-dashboard
```

---

## 手順5　【① レンタルサーバー／phpMyAdmin】更新履歴

⚠️ ファイル: `backend/scripts/sql/2026-10-08_update_log_2.2.172.sql`

```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

⚠️ 一番上が `2.2.172` なら完了。

---

## ⚠️ 出したあとの確認

| # | 見ること | 期待 |
|---|---|---|
| 1 | ⚠️ ヘッダーの版 | ⚠️ **2.2.172** |
| 2 | ⚠️ 集客イベントのメニュー | ⚠️ 反響一覧 ／ 集客サマリー ／ 広告費入力 ／ ⚠️ **おうちづくりフェスタ2026** |
| 3 | ⚠️ おうちづくりフェスタ2026 | ⚠️ 全画面。⚠️ 上に集計表（反響一覧でフェスタを選んだときと同じ数字） |
| 4 | ⚠️ 表の見出し | ⚠️ 3段（営業入力 → KH・DJH・なごみ・2L・PGH・かえる・中専 → 面談・次アポ） |
| 5 | ⚠️ ストラップ・チケット | ⚠️ 受付画面（QR → 受付スタッフ用）と ⚠️ **同じ表示** |
| 6 | ⚠️ 営業入力のトグルを押す → リロード | ⚠️ ⚠️ **オンのまま** |
| 7 | ⚠️ 2台の端末で同じ行の別ブランドを押す → 両方リロード | ⚠️ ⚠️ **両方オン**（⚠️ 片方が消えない） |
| 8 | ⚠️ ふりがな・担当営業を書き換えて欄の外をクリック → リロード | ⚠️ 残っている |
| 9 | ⚠️ 同期（⟳） | ⚠️ 反響一覧と同じ担当営業の選択 → 「同期済み」 |

---

## 切り戻し

| 対象 | 方法 |
|---|---|
| ① フロント | v2.2.171 の `main.9bc29f7e.js` と index.html に戻す |
| ② | v2.2.171 の production で `dcp build` / `up -d` |
| ① PHP | `list_event.php` を v2.2.171 のものに戻す |
| DB | ⚠️ `festa` 列は残してよい（⚠️ 古いコードは使わない）。⚠️ 消す場合は `ALTER TABLE event_db DROP COLUMN festa;`（⚠️ 営業入力が消える） |
