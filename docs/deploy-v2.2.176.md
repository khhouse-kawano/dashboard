# デプロイ手順 v2.2.176

⚠️⚠️ **v2.2.175 を先に出してあることが前提です**（⚠️ v2.2.176 は v2.2.175 の上に積んでいる）。
⚠️ v2.2.175 がまだなら、⚠️ **v2.2.175 → v2.2.176 の順**に出すこと（`deploy-v2.2.175.md`）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ⚠️ 中古住宅専門店の来場予約（GAS `runReserveResale` → `reserve_resale_update`）から取り込む反響に ⚠️ **`category = 買い:中古リノベ`** を入れる | ⚠️ **① PHP**（`portal/reserve_resale.php`） |
| 2 | （任意）既に取り込まれて category が空の反響に 買い:中古リノベ を入れる | ① DB |
| 3 | 版の表示（ヘッダー） | ① フロント |
| 4 | 更新履歴に1行増える | ① DB |

⚠️ **② VPS・GAS は変更なし。** ⚠️ `reserve_resale_update` は ② へ転送していない（① だけで処理）。
⚠️ DB の列追加なし（`inquiry_customer_resale.category` は既にある）。

---

## 順序

```
1. ① PHP（handlers/portal/reserve_resale.php）
2. ① SQL（任意：既存行の category）
3. ① フロント（build）
4. ① SQL（update_log）
```

---

## 手順1　【① レンタルサーバー】PHP

| ファイル | |
|---|---|
| ⚠️ `backend/src/handlers/portal/reserve_resale.php` | ⚠️ inquiry_customer_resale への INSERT に `category`（`'買い:中古リノベ'`） |

⚠️ `reserve_resale_update.php`（受け口）は変えていない。

---

## 手順2　【① レンタルサーバー／phpMyAdmin】（任意）既存行の category

⚠️ ファイル: `backend/scripts/sql/2026-10-08_inquiry_resale_hp_category.sql`

- ⚠️ 取り込みは `INSERT IGNORE` なので、⚠️ **既に入っている行の category は手順1では埋まらない。**
- ⚠️ 対象は `inquiry_id` が `hp_resale_` で始まり、category が空の行だけ（⚠️ 手で入れた値は触らない）。
- ⚠️ ローカルでは 8件（2026/06/28〜2026/09/09・すべて未同期）。
- ⚠️ 流すと、そのうち 2026/08 以降の分が要確認（中古）の未同期に出るようになる。
- ⚠️ ファイル先頭の SELECT で件数を見てから UPDATE を流すこと。

---

## 手順3　【WSL】フロントを ① へアップロード

| ファイル | |
|---|---|
| ⚠️⚠️ **`static/js/main.8ba1a392.js`** | ⚠️ **この版の本体**（⚠️ 版の数字だけが変わる） |
| `static/css/main.7c10f266.css` | ⚠️ 変更なし |
| ⚠️ `index.html` | ⚠️⚠️ **必ず差し替えること** |

```
main.8ba1a392.js   ← ⚠️⚠️ これが v2.2.176（正）
main.79f19c9a.js   … v2.2.175
```

```bash
deploy-dashboard
```

---

## 手順4　【① レンタルサーバー／phpMyAdmin】更新履歴

⚠️ ファイル: `backend/scripts/sql/2026-10-08_update_log_2.2.176.sql`

```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

⚠️ 一番上が `2.2.176` なら完了。

---

## ⚠️ 出したあとの確認

| # | 見ること | 期待 |
|---|---|---|
| 1 | ⚠️ ヘッダーの版 | ⚠️ **2.2.176** |
| 2 | ⚠️ 次に GAS（runReserveResale）が取り込んだ予約 | ⚠️ `SELECT inquiry_id, category FROM inquiry_customer_resale WHERE inquiry_id LIKE 'hp\_resale\_%' ORDER BY id DESC LIMIT 5;` で ⚠️ **買い:中古リノベ** |
| 3 | ⚠️ 中古でログイン → 要確認 | ⚠️ その予約が（同期前・前日以前なら）未同期に出る |

---

## 切り戻し

| 対象 | 方法 |
|---|---|
| ① PHP | `portal/reserve_resale.php` を v2.2.175 のものに戻す |
| ① フロント | v2.2.175 の `main.79f19c9a.js` と index.html に戻す |
| DB | ⚠️ 入った category は残してよい |
