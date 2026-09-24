# デプロイ手順 v2.2.147

⚠️ 中身: ⚠️ **SUUMO掲載順位の保存を ② の Express へ移した。**

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ⚠️⚠️ **収集結果の保存を ② が処理する** | ⚠️ **② VPS** |
| 2 | ⚠️ 転送設定に1行追加 | ⚠️ **① PHP** |
| 3 | 更新履歴に1行増える | ① DB |
| 4 | バージョン表示 | ① フロント |

⚠️⚠️ **スクレイパー（`extensions/meta_scraper/suumo_scraper.ts`）は変更なし。**
⚠️ ⚠️ **送信先が ① のままなので、再配布も不要。**
⚠️ **MCP も変更なし。** ⚠️ **DBのテーブル定義も変更なし。**

---

## ⚠️ 順序

```
1. ② VPS（Express）      ← 先
2. ① PHP（転送設定）      ← 後
3. ① SQL / ① フロント
```

⚠️⚠️ **必ず ② を先にすること。**
⚠️ ⚠️ **先に ① の転送設定だけ入れると、まだ ② に実装が無く「ループ検知」で 502 になる。**
⚠️ ⚠️ **しかも今回はフォールバック禁止なので、① でも保存されない。**

---

## 手順1　【② VPS で実行】Express の再ビルド

⚠️ ⚠️ **`git pull` は使わないこと。** ⚠️ **必ず分岐エラーになる。**
⚠️ detached HEAD は正常である。

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
```

```bash
dcp build express-api
```

```bash
dcp up -d express-api
```

⚠️ `dcp` は alias:
`docker compose -f ~/dashboard/docker-compose.prod.yml --env-file ~/dashboard/.env.prod`

### ⚠️ 登録されたかの確認

```bash
dcp logs --tail 300 express-api | grep suumo_property
```

⚠️ ⚠️ **次の2行が出ること。**

```
property::suumo — SUUMO の掲載順位データ（全期間）
suumo_property:: — 【書き込み・フォールバック禁止】SUUMO掲載順位の収集結果を1件保存する
```

⚠️⚠️ **`dist/` を grep しないこと。** ⚠️ **キーは実行時に組み立てられるので 0 件になる**（2026-09-22 に1度やった）。

⚠️⚠️ **「401 が返れば登録済み」は誤り。** ⚠️ ② は登録確認より先に認証を見るため、⚠️ **未登録でも 401 になる。** ⚠️ **判定は必ず起動ログで行う。**

---

## 手順2　【① レンタルサーバーで実行】PHP のアップロード

| ファイル | |
|---|---|
| ⚠️ **`backend/src/core/express_proxy.php`** | ⚠️⚠️ **`expressProxyExclusive()` に `'suumo_property'` が1行** |

⚠️ ⚠️ **このファイル1つだけ。** ⚠️ **`suumo_property.php` は触らない**（切り戻し先として残す）。

---

## 手順3　【① レンタルサーバーで実行】SQL（phpMyAdmin）

```sql
INSERT INTO update_log (version, date, note) VALUES
('2.2.147', '2026-09-24', 'SUUMO掲載順位の収集結果の保存処理をExpressへ移行。');
```

⚠️ ファイル: `backend/scripts/sql/2026-09-24_update_log_2.2.147.sql`

---

## 手順4　【あなたのPC（PowerShell）】フロント → ① へアップロード

⚠️ ⚠️ **フロントの変更はバージョン表示だけ**（`version.ts` の `2.2.147`）。

```powershell
cd C:\Users\shinji-kawano\react\dashboard\frontend
npm run build
```

| ファイル | |
|---|---|
| `build/static/js/main.*.js` | ⚠️ **ビルドで出た最新のもの** |
| `build/static/css/main.*.css` | 一緒に上げてよい |
| ⚠️ **`build/index.html`** | ⚠️⚠️ **必ず差し替える** |

⚠️⚠️ **コードを直したら必ずビルドし直し、ハッシュが変わったことを確かめること。**
⚠️ ⚠️ **2026-09-22 に、直したあとビルドせず古い版を上げて本番で崩れた。**

---

## ⚠️ 手順5　動作確認

⚠️⚠️ **収集は週1回の手動実行なので、次の実行まで確かめられない。**
⚠️ ⚠️ **待たずに確かめるには、下のように1件だけ投げてみる。**

### 5-1　⚠️ 画面側（すぐできる）

| # | 画面 | 期待 |
|---|---|---|
| 1 | SUUMO掲載順位（`SuumoPropertySummary.tsx`） | ⚠️ **今までどおり表示される**（⚠️ 読み出しは前から ②） |
| 2 | バージョン表示 | ⚠️ **2.2.147** |

### 5-2　⚠️⚠️ 収集の経路（次回の実行時）

【あなたのPC（PowerShell）】

```powershell
cd C:\Users\shinji-kawano\extensions\meta_scraper
npx ts-node suumo_scraper.ts
```

| # | 見るもの | 期待 |
|---|---|---|
| 1 | ⚠️ コンソール | ⚠️⚠️ **`✅ POST成功:` が並ぶ** |
| 2 | ⚠️ **`⚠️ POST失敗(API側の問題)`** | ⚠️⚠️ **出ないこと**（出たら ② の DB権限を疑う） |
| 3 | ⚠️ **`❌ POST失敗(通信エラー)`** | ⚠️⚠️ **出ないこと**（⚠️ **502 ならこれになる。② が落ちている**） |
| 4 | ⚠️⚠️ **画面のその日の行数** | ⚠️⚠️ **1エリアあたり最大100件。⚠️ 200件になっていたら二重登録である** |

### 5-3　⚠️ ② のログ（同時に見る）

```bash
dcp logs -f express-api | grep -i suumo
```

⚠️ ⚠️ **`[suumo_property] INSERT に失敗しました` が出たら、② のDBユーザーの INSERT 権限を疑うこと。**

---

## ⚠️ 戻し方

| 何 | どう戻すか |
|---|---|
| ⚠️⚠️ **保存の経路** | ⚠️⚠️ **`express_proxy.php` の `'suumo_property'` を1行消して上げ直す** |
| ② の Express | ⚠️ **戻さなくてよい**（① が転送しなくなるだけ） |
| ① フロント | 1つ前の `main.*.js` と `index.html` |
| `update_log` の行 | ⚠️ 残しておいてよい |

⚠️⚠️ **① の `suumo_property.php` は消していない。** ⚠️ **1行消せば即座に ① の処理へ戻る。**

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`suumo_property` を `expressProxyRequests()` へ移さないこと。** ⚠️ **UNIQUE キーが無く、二重登録の経路になる** |
| 2 | ⚠️⚠️ **② が落ちている週はそのエリアが保存されない**（502）。⚠️ **掛け直すこと** |
| 3 | ⚠️ 収集は ⚠️ **1物件1リクエスト**（約3,300回）。⚠️ まとめ送りは ⚠️ **見送った**（スクレイパーの再配布が必要になるため） |
| 4 | ⚠️ `suumo_property` は ⚠️ **行が増え続ける**（現在11,991行）。⚠️ `property::suumo` は**全件返している** |
