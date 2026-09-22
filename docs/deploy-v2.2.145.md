# デプロイ手順 v2.2.145

⚠️ この版には ⚠️ **7件**入っている。

| # | 中身 | 影響する場所 |
|---|---|---|
| 1 | ⚠️ **マーケ用メモ欄**を面談シートに追加 | ⚠️ **① DB（ALTER 3件）** / ① PHP / フロント |
| 2 | ⚠️ **分析APIにスタッフ軸**（`staff` / `staffCurrent`） | ② Express |
| 3 | ⚠️ **来場数・次アポ数**の指標（既定のファネルにも） | ② Express |
| 4 | ⚠️ **MCP に `staff` 軸**（⚠️ 無いと Claude Desktop から弾かれる） | ⚠️ **利用者のPC** |
| 5 | SatBaseサマリーの余白 | ① フロント |
| 6 | ⚠️ **customer / shop / rank / map を SaaS 風に** | ① フロント |
| 7 | ⚠️⚠️ **建売のホームページ反響を2画面で揃えた** | ① フロント |

⚠️ ⚠️ **v2.2.143 / v2.2.144 はマージ済み**（2026-09-22 に確認。production = PR #58）。
⚠️ **この版だけを出せばよい。**

---

## ⚠️ 利用者から見て変わること

| 画面 | 変わること |
|---|---|
| ⚠️ **面談シート（3事業）** | ⚠️ **上部にマーケ用メモ欄が出る** |
| ⚠️⚠️ **顧客分析（建売）** | ⚠️ **ホームページ反響 6,463 → 4,608**（⚠️ **2025年1月より前と反響日なしを外した**） |
| ⚠️⚠️ **反響推移（建売）** | ⚠️ **ホームページ反響計 4,415 → 4,608**（⚠️ **Web検索・Instagram を丸めた**） |
| 販促媒体別・店舗別・目標達成・地図 | ⚠️ **見た目が変わる**（⚠️ **数字は変わらない**） |
| Claude Desktop | ⚠️ **担当者別に聞けるようになる** |

⚠️⚠️ **建売の2画面は数字が変わる。** ⚠️ **事前に利用者へ伝えること。**
⚠️ ⚠️ **狙いは「2つの画面で同じ数になること」である。**

---

## ⚠️ 順序

```
1. ① SQL（ALTER 3件 → update_log）
2. ② Express の再ビルド
3. ① PHP（6ファイル）
4. ① フロント
5. 利用者のPC（MCP。⚠️ 2 のあと）
```

⚠️⚠️ **1 を飛ばすと、面談シートの保存がまるごと失敗する**（`Unknown column`）。
⚠️ ⚠️ **メモだけでなく、その画面の他の項目も保存されない。**

---

## 手順1　【① レンタルサーバーで実行】SQL（phpMyAdmin）

### ⚠️ 1-1　列の追加（⚠️ **3テーブルすべて**）

⚠️ ファイル: `backend/scripts/sql/2026-09-22_memo_marketing.sql`

```sql
ALTER TABLE master_data       ADD COLUMN memo_marketing TEXT DEFAULT NULL COMMENT 'マーケ用メモ欄。面談シートの上部から入力する（架電用メモとは別）';
ALTER TABLE master_data_kaeru ADD COLUMN memo_marketing TEXT DEFAULT NULL COMMENT 'マーケ用メモ欄。面談シートの上部から入力する（架電用メモとは別）';
ALTER TABLE master_data_resale ADD COLUMN memo_marketing TEXT DEFAULT NULL COMMENT 'マーケ用メモ欄。面談シートの上部から入力する（架電用メモとは別）';
```

⚠️ 確認（⚠️ **3つとも1行ずつ返ること**）

```sql
SHOW COLUMNS FROM master_data LIKE 'memo_marketing';
SHOW COLUMNS FROM master_data_kaeru LIKE 'memo_marketing';
SHOW COLUMNS FROM master_data_resale LIKE 'memo_marketing';
```

### 1-2　更新履歴

```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.145', '2026-09-22', '面談シートにマーケ用メモ欄を追加。分析APIにスタッフ軸と来場数・次アポ数を追加。');
```

---

## 手順2　【② VPS で実行】Express の再ビルド

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
grep -c "STAFF_SQL" backend-express/src/features/analysis/dimensions.ts
dcp build express-api
dcp up -d --force-recreate express-api
```

⚠️⚠️ **`git pull` は使わないこと**（この環境は detached HEAD が正しい）。

⚠️ 反映の確認（⚠️ **401 が返れば ② は生きている**）

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.khg-marketing.info/api/v1/analysis/meta
```

---

## 手順3　【① レンタルサーバーで実行】PHP のアップロード（⚠️ **6ファイル**）

⚠️ ⚠️ **`git diff origin/production..HEAD` で確認した全件である**（2026-09-22）。
⚠️ **① に上げる PHP はこの6つだけ。他の PHP は変えていない。**

| ファイル | 置き場所 |
|---|---|
| ⚠️ **`backend/src/core/allowed_columns.php`** | `core/` |
| `backend/src/handlers/informationAction/information_order_update.php` | `handlers/informationAction/` |
| `backend/src/handlers/informationAction/information_spec_add.php` | 同上 |
| `backend/src/handlers/informationAction/information_spec_update.php` | 同上 |
| `backend/src/handlers/informationAction/information_used_add.php` | 同上 |
| `backend/src/handlers/informationAction/information_used_update.php` | 同上 |

⚠️⚠️ **`allowed_columns.php` を忘れないこと。** ⚠️ **忘れるとメモが保存されない**（エラーは出ない）。

⚠️⚠️ **ただし、これだけでは保存されない。**
⚠️ ⚠️ **顧客情報の保存（`information:customer_info:*`）は ② が処理する**
⚠️ （`express_proxy.php` の `expressProxyExclusive()`。⚠️ **① の PHP は動かない**）。
⚠️ ⚠️ **② の許可リスト（`masterDataColumns.ts`）が古いと、`memo_marketing` は黙って捨てられる。**
⚠️ **「保存しました」と出て、その列だけ入らない。**

⚠️ 確認【② VPS で実行】

```bash
dcp exec express-api grep -c memo_marketing dist/features/information/masterDataColumns.js
```

⚠️ ⚠️ **`1` になっていること。** ⚠️ `0` なら手順2をやり直す。

⚠️ ⚠️ **① の `allowed_columns.php` も上げること。** ⚠️ ② が落ちたときに ① が処理するため。

---

## 手順4　【あなたのPC（PowerShell）】フロント → ① へアップロード

⚠️ ⚠️ **ビルド済み**（2026-09-22 18:14）。

| ファイル | 確認したこと |
|---|---|
| `build/static/js/main.ee94e56a.js` | ⚠️ **`2.2.145` と `memo_marketing` を含む** |
| `build/static/css/main.7c10f266.css` | ⚠️ **v2.2.144 から変わっていない**（⚠️ それでも一緒に上げてよい） |
| `build/index.html` | ⚠️ **上の2つを参照している** |

⚠️⚠️ **`index.html` を必ず差し替えること。** ⚠️ **古いままだと JS が読み込まれない。**

---

## ⚠️ 手順5　MCP サーバー（⚠️ **利用者のPC**）

⚠️⚠️ **手順2のあとに行うこと。** ⚠️ **② に `staff` 軸が無いと 400 で弾かれる。**

⚠️ ⚠️ **今回は `dist\index.js` の上書きだけでよい**（`apiClient.ts` は変えていない）。

⚠️⚠️ **PCによって `args` の指す先が違う。** ⚠️ **下のコマンドで必ず確かめること。**

| PC | `args` の指す先 | やること |
|---|---|---|
| ⚠️ **開発機（このPC）** | ⚠️ **`...\react\dashboard\mcp-server\dist\index.js`** | ⚠️⚠️ **コピー不要。** ⚠️ ビルド済みなら再起動だけ |
| 利用者のPC | ⚠️ `%LOCALAPPDATA%\khg-analysis-mcp\dist\index.js` | ⚠️ **そこへ `dist\index.js` を上書き** |

⚠️ ⚠️ **開発機は `セットアップ.cmd` を使っておらず、リポジトリを直に指している。**

| | |
|---|---|
| コピー元 | `...\react\dashboard\mcp-server\dist\index.js` |
| `node_modules` | ⚠️ **そのままでよい**（依存は増えていない） |

⚠️ ⚠️ **どちらの場合も、最後に Claude Desktop を通知領域から終了 → 起動。**

⚠️ 実際の場所は `args` で確認できる。

```powershell
$pkg = Get-ChildItem "$env:LOCALAPPDATA\Packages" -Filter "Claude_*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
$cfg = if ($pkg) { Join-Path $pkg.FullName "LocalCache\Roaming\Claude\claude_desktop_config.json" } else { "$env:APPDATA\Claude\claude_desktop_config.json" }
(Get-Content $cfg -Raw | ConvertFrom-Json).mcpServers.'khg-analysis'.args
```

---

## ⚠️ 手順6　動作確認

### ⚠️ 6-1　マーケ用メモ欄（⚠️ **3事業とも**）

| # | 確認 | 期待 |
|---|---|---|
| 1 | 面談シートを開く | ⚠️ **いちばん上にマーケ用メモ欄** |
| 2 | ⚠️⚠️ **文字を打つ** | ⚠️⚠️ **打った文字がその場で出る** |
| 3 | ⚠️⚠️ **保存 → 開き直す** | ⚠️ **残っている** |
| 4 | 架電シート | ⚠️ **架電用メモと混ざっていない** |

⚠️ ⚠️ **2 は `React.memo` の比較リストに列名を入れ忘れると失敗する。** ⚠️ **今回それで1度壊れた。**

### ⚠️ 6-2　建売の2画面（⚠️ **数字が変わる**）

| # | 確認 | 期待 |
|---|---|---|
| 1 | 顧客分析（建売）のホームページ反響 | ⚠️ **4,608 前後** |
| 2 | 反響推移（建売）の「全期間」ホームページ反響計 | ⚠️ **4,608 前後** |
| 3 | ⚠️⚠️ **1 と 2 が同じ数** | ⚠️ **これが今回の眼目** |
| 4 | ホームページ反響の行 | ⚠️ **文字色が青**（背景ではない） |

### 6-3　見た目（⚠️ **数字は変わらない**）

| # | 画面 | 期待 |
|---|---|---|
| 1 | 販促媒体別・店舗別（注文/建売） | ⚠️ **上部にKPIカード。見出しを押すと並べ替え** |
| 2 | 目標達成状況（rank・3事業） | ⚠️ 表の枠と色が揃っている（⚠️ **2段見出しはそのまま**） |
| 3 | 地図（3事業） | ⚠️ 絞り込みのカードと表の色が揃っている |
| 4 | ⚠️ **数字** | ⚠️⚠️ **改修前と同じ**（⚠️ 見た目だけの改修） |

### 6-4　Claude Desktop

| # | 聞くこと | 期待 |
|---|---|---|
| 1 | 「担当者別の契約実績を教えて」 | ⚠️ **人ごとに返る** |
| 2 | ⚠️ **「●●さんの実績は？」** | ⚠️ **その人だけで返る** |
| 3 | 「来場数と次アポ数を月別で」 | ⚠️ **visits / nextAppointments が返る** |

⚠️ ⚠️ **2 の氏名は台帳の表記どおり**に（姓名の間の空白を含む）。

---

## ⚠️ 戻し方

| 何 | どう戻すか |
|---|---|
| フロント | 1つ前の `main.*.js` と `index.html` |
| ① PHP | 1つ前の6ファイル |
| ② Express | 1つ前のコミットを checkout して `dcp build` |
| MCP | 1つ前の `dist\index.js` |
| ⚠️ **`memo_marketing` 列** | ⚠️⚠️ **消さないこと。** ⚠️ **入力済みのメモが消える。** 残しても害はない |

---

## ⚠️ この版で入っていないもの

| 何 | なぜ |
|---|---|
| ⚠️ `consulting` 権限の伏字 | ⚠️ 次の版 |
| ⚠️ Express `/analysis` の建売対応 | ⚠️ 同上 |
| ⚠️ 他の10ファイルの `axios` 直叩き | ⚠️ 指示の範囲外（`BudgetAccounting` ほか） |

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **担当者は `in_charge_user` をそのまま使っていない。** ⚠️ 72%が「◯◯店 管理」のため、`first_interviewed_user`（旧担当）に読み替えている |
| 2 | ⚠️ `first_interviewed_user` の運用開始は ⚠️ **2026年6月**（利用者の説明）。⚠️ **古い月ほど営業別の実績が小さく出る** |
| 3 | ⚠️⚠️ **ホームページ反響の判定は `customerKaeruUtils.ts` の1か所。** ⚠️ **2画面が読んでいる。片方だけ直さないこと** |
| 4 | ⚠️ 期間の起点 `PERIOD_START = '2025/01'` は ⚠️ **反響推移の `getYearMonthArray(2025, 1)` と同じにすること** |
| 5 | ⚠️ 見た目は `components/rankingUi.tsx` の1枚だけ。⚠️⚠️ **`<style>` の中にバッククォートを書かないこと**（2026-09-22 に壊した） |
