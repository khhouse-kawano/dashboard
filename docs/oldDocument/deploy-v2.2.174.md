# デプロイ手順 v2.2.174

⚠️ **v2.2.173 を先に出してあることが前提です**（⚠️ 2026-10-08 時点でデプロイ済み）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ⚠️ フェスタ：同期した店舗を記録する ⚠️ **`function: 'sync_shop'`**（`event_db.shop` に `,` 区切りで足す） | ⚠️ **② VPS**（`list/event.ts`）と ⚠️ **① PHP**（`list_event.php`） |
| 2 | ⚠️ 月次日報（`daily_report`）を ⚠️ **② で応答**（① の PHP は残す＝フォールバック） | ⚠️ **② VPS**（`dailyReport.ts`・`registry.ts`）と ⚠️ **① PHP**（`express_proxy.php`） |
| 3 | ⚠️ フェスタ画面：来場日・来場時間の並び替え ／ ブランド別の歩留まり ／ ⚠️ 店舗が違えば何度でも同期 ／ アイコンの下に同期した店舗 | ① フロント |
| 4 | 更新履歴に1行増える | ① DB |

⚠️ **DB の列追加なし。** LP の変更なし。

---

## 順序

```
1. ② Express（build）
2. ① PHP（list_event.php → express_proxy.php）
3. ① フロント（build）
4. ① SQL（update_log）
```

- ⚠️ 3 を 1・2 より先に出すと、⚠️ 同期（顧客取込）は済むのに ⚠️ **店舗が記録されず赤字が出る**（⚠️ 古いサーバーが `sync_shop` を知らない）。
- ⚠️ 2 の `express_proxy.php` を 1 より先に出すと、⚠️ 古い ② に `daily_report` が無く、⚠️ ① へフォールバックする（⚠️ 画面は動く。⚠️ 遅いまま）。
- ⚠️ ② は `production` から取るので、⚠️ **先に GitHub で v2.2.174 を production へマージ**しておくこと。

---

## 手順1　【② VPS で実行】Express の再ビルド

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "if (fn === 'sync_shop')" backend-express/src/features/list/event.ts
grep -n "request: 'daily_report'" backend-express/src/gateway/registry.ts
```
⚠️ それぞれ1行出れば v2.2.174 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

| ファイル | |
|---|---|
| `src/features/list/event.ts` | ⚠️ `runSyncShop`（店舗を `,` で足す。sync=1） |
| ⚠️ `src/features/dailyReport.ts`（新規） | ⚠️ `runDailyReport`（daily_report.php と同じ応答） |
| `src/gateway/registry.ts` | ⚠️ `daily_report` を登録 |

---

## 手順2　【① レンタルサーバー】PHP

| ファイル | |
|---|---|
| ⚠️ `backend/src/handlers/listAction/list_event.php` | ⚠️ `sync_shop`（⚠️ ② が落ちたときのフォールバック用。② と同じ） |
| ⚠️ `backend/src/core/express_proxy.php` | ⚠️ expressProxyRequests() に `daily_report`（⚠️ expressProxyExclusive には入れていない） |

---

## 手順3　【WSL】フロントを ① へアップロード

| ファイル | |
|---|---|
| ⚠️⚠️ **`static/js/main.f796d46d.js`** | ⚠️ **この版の本体** |
| `static/css/main.7c10f266.css` | ⚠️ 変更なし |
| ⚠️ `index.html` | ⚠️⚠️ **必ず差し替えること** |

```
main.f796d46d.js   ← ⚠️⚠️ これが v2.2.174（正）
main.d79bfb6d.js   … v2.2.173
```

```bash
deploy-dashboard
```

---

## 手順4　【① レンタルサーバー／phpMyAdmin】更新履歴

⚠️ ファイル: `backend/scripts/sql/2026-10-08_update_log_2.2.174.sql`

```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

⚠️ 一番上が `2.2.174` なら完了。

---

## ⚠️ 出したあとの確認

| # | 見ること | 期待 |
|---|---|---|
| 1 | ⚠️ ヘッダーの版 | ⚠️ **2.2.174** |
| 2 | ⚠️ フェスタ：来場日の見出しの ⇅ | ⚠️ 押すたびに 昇順 → 降順 → 解除（⚠️ 来場時間も同じ） |
| 3 | ⚠️ フェスタ：集計表の下 | ⚠️ **ブランド別の歩留まり**（面談数・次アポ数・次アポ率・有効名簿数） |
| 4 | ⚠️ 1人を KH の店舗へ同期 | ⚠️ アイコンの下に店舗名、⚠️ 行が青、⚠️ KH の有効名簿 +1 |
| 5 | ⚠️ 同じ人をもう一度同期 | ⚠️ 同期済みの店舗は「（同期済み）」で選べない。⚠️ 別ブランドの店舗は同期できる → 店舗が2行に |
| 6 | ⚠️ 月次日報を開く | ⚠️ 以前と同じ数字（⚠️ ② のログで `daily_report` が出ていること） |

---

## 切り戻し

| 対象 | 方法 |
|---|---|
| ① フロント | v2.2.173 の `main.d79bfb6d.js` と index.html に戻す |
| ② | v2.2.173 の production で `dcp build` / `up -d` |
| ① PHP | `list_event.php`・`express_proxy.php` を v2.2.173 のものに戻す（⚠️ `daily_report` の行を消すだけでも ① に戻る） |
| DB | ⚠️ 変更なし（⚠️ shop に足された店舗は残る。⚠️ 古い画面では「店舗名,店舗名」と1行で見える） |
