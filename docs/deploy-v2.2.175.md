# デプロイ手順 v2.2.175

⚠️ **v2.2.174 を先に出してあることが前提です**（⚠️ 2026-10-08 時点でデプロイ済み）。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ⚠️ 顧客マスタ3表に ⚠️ **`next_action_date`（次回アクション日）列**を追加 | ⚠️ **① DB** |
| 2 | ⚠️ 商談ステップに「次回アクション日」（⚠️ この列だけ一番新しい日付が入る）／ 保存を許す列に追加 | ⚠️ **② VPS**（`interviewKpi.ts`・`masterDataColumns.ts`）と ⚠️ **① PHP**（`allowed_columns.php`） |
| 3 | ⚠️ 要確認: ⚠️ **本日要連絡**（次回アクション日・次回架電日が今日）／ ⚠️ **建売・中古でも表示** | ⚠️ **② VPS**（`dailyAction.ts`・`registry.ts`）と ⚠️ **① PHP**（`daily_action.php`） |
| 4 | ⚠️ 要確認のカードを押すと表へ移動 ／ 顧客詳細3画面の actionMap ／ ⚠️ 要確認ボタンを建売・中古にも・事業を選んでから自動表示・/home では出さない | ① フロント |
| 5 | 更新履歴に1行増える | ① DB |

---

## 順序

```
1. ① SQL（ALTER：next_action_date ×3）   ← ⚠️ 最初
2. ② Express（build）
3. ① PHP（allowed_columns.php → daily_action.php）
4. ① フロント（build）
5. ① SQL（update_log）
```

- ⚠️⚠️ **1 を先に。** ② の保存の許可リストに `next_action_date` が入るので、⚠️ 列が無いまま次回アクション日を登録すると ⚠️ **顧客の保存がまるごと失敗する**（Unknown column）。
- ⚠️ 4 を 2 より先に出すと、⚠️ 建売・中古の要確認が古い ② で「注文の中身」になる。⚠️ 次回アクション日も ② の KPI 規則が古いまま（一番古い日付）。
- ⚠️ ② は `production` から取るので、⚠️ **先に GitHub で v2.2.175 を production へマージ**しておくこと。

---

## 手順1　【① レンタルサーバー／phpMyAdmin】列の追加

⚠️ ファイル: `backend/scripts/sql/2026-10-08_master_next_action_date.sql`

```sql
ALTER TABLE master_data        ADD COLUMN next_action_date TEXT DEFAULT NULL COMMENT '次回アクション日（商談ステップの最新の予定日）';
ALTER TABLE master_data_kaeru  ADD COLUMN next_action_date TEXT DEFAULT NULL COMMENT '次回アクション日（商談ステップの最新の予定日）';
ALTER TABLE master_data_resale ADD COLUMN next_action_date TEXT DEFAULT NULL COMMENT '次回アクション日（商談ステップの最新の予定日）';
```

確認（⚠️ 3つとも）:
```sql
SHOW COLUMNS FROM master_data LIKE 'next_action_date';
SHOW COLUMNS FROM master_data_kaeru LIKE 'next_action_date';
SHOW COLUMNS FROM master_data_resale LIKE 'next_action_date';
```
⚠️ それぞれ1行（`next_action_date` / `text` / `YES` / `NULL`）出れば完了。

---

## 手順2　【② VPS で実行】Express の再ビルド

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```
```bash
grep -n "LATEST_COLUMNS = " backend-express/src/features/interviewKpi.ts
grep -n "const fetchContacts" backend-express/src/features/dailyAction.ts
```
⚠️ それぞれ1行出れば v2.2.175 が取れている。
```bash
dcp build express-api
```
```bash
dcp up -d express-api
```

| ファイル | |
|---|---|
| `src/features/interviewKpi.ts` | ⚠️ actionMap に次回アクション日 ／ ⚠️ `LATEST_COLUMNS`（一番新しい日付） |
| `src/features/information/masterDataColumns.ts` | ⚠️ `next_action_date` |
| `src/features/dailyAction.ts` | ⚠️ 事業別（order/spec/used）・⚠️ 本日要連絡 |
| `src/gateway/registry.ts` | ⚠️ `daily_action:list` を spec / used にも登録 |

---

## 手順3　【① レンタルサーバー】PHP

| ファイル | |
|---|---|
| ⚠️ `backend/src/core/allowed_columns.php` | ⚠️ `next_action_date` |
| ⚠️ `backend/src/handlers/daily_action.php` | ⚠️ ② と同じ（⚠️ ② が落ちたときのフォールバック用） |

⚠️ `express_proxy.php` は**変更なし**。

---

## 手順4　【WSL】フロントを ① へアップロード

| ファイル | |
|---|---|
| ⚠️⚠️ **`static/js/main.79f19c9a.js`** | ⚠️ **この版の本体** |
| `static/css/main.7c10f266.css` | ⚠️ 変更なし |
| ⚠️ `index.html` | ⚠️⚠️ **必ず差し替えること** |

```
main.79f19c9a.js   ← ⚠️⚠️ これが v2.2.175（正）
main.f796d46d.js   … v2.2.174
```

```bash
deploy-dashboard
```

---

## 手順5　【① レンタルサーバー／phpMyAdmin】更新履歴

⚠️ ファイル: `backend/scripts/sql/2026-10-08_update_log_2.2.175.sql`

```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

⚠️ 一番上が `2.2.175` なら完了。

---

## ⚠️ 出したあとの確認

| # | 見ること | 期待 |
|---|---|---|
| 1 | ⚠️ ヘッダーの版 | ⚠️ **2.2.175** |
| 2 | ⚠️ 顧客詳細（注文・建売・中古）の商談ステップのアクション | ⚠️ 「初回面談」の次に ⚠️ **次回アクション日**（⚠️ 中古の売り:ポータルは先頭） |
| 3 | ⚠️ 次回アクション日を今日の日付で追加 → 保存 | ⚠️ 保存できる。⚠️ 要確認（右上のボタン）の ⚠️ **本日要連絡**に出る |
| 4 | ⚠️ 架電シートで次回架電日を今日で登録 | ⚠️ 本日要連絡に「次回架電」で出る |
| 5 | ⚠️ 要確認のカード | ⚠️ 一番左が ⚠️ **深緑の本日要連絡**。⚠️ 押すとその表へスクロール（⚠️ URL は変わらない） |
| 6 | ⚠️ 建売・中古でログイン → 事業を選ぶ | ⚠️ 右上に「要確認」ボタン。⚠️ 要確認が出る（本日要連絡 → 未同期 → 本日の予定） |
| 7 | ⚠️ 事業を選ぶ画面（/home） | ⚠️ 要確認は出ない（⚠️ ボタンも出ない） |
| 8 | ⚠️ 事業を選ばずに /company などを直接開く（新しいタブ） | ⚠️ 要確認は自動では出ない（⚠️ ボタンからは開ける） |

---

## 切り戻し

| 対象 | 方法 |
|---|---|
| ① フロント | v2.2.174 の `main.f796d46d.js` と index.html に戻す |
| ② | v2.2.174 の production で `dcp build` / `up -d` |
| ① PHP | `allowed_columns.php`・`daily_action.php` を v2.2.174 のものに戻す |
| DB | ⚠️ `next_action_date` は残してよい（⚠️ 古いコードは使わない）。⚠️ 消す場合は3表とも `ALTER TABLE … DROP COLUMN next_action_date;`（⚠️ 入っている日付が消える。⚠️ 商談ステップの記録は残る） |
