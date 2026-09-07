# v2.2.121 デプロイ手順

## このリリースの内容

### A. 差し込み分（イベント同意文の追加）

| 変更 | 場所 |
|---|---|
| 個人情報の同意文に「撮影・広報活動での利用」を追記 | `kh-house.jp/festa/index.html` |
| サンクスメール・社内通知に `【個人情報の同意】チェック済み` を1行追加 | ② VPS |

### B. 同時に載るもの（Phase 1・2）

⚠️ **A だけを切り出してデプロイすることはできない。**
② VPS は `production` ブランチを丸ごと `git reset --hard` で取得するため、
コミットに含めたものはすべて反映される。以下も同時に本番へ出る。

| 変更 | 場所 |
|---|---|
| InformationEdit のフッターボタンの横幅を縮小 | ① のフロント |
| `information`（顧客詳細モーダルの読み込み × 3）を Express 化 | ② VPS ＋ ① の PHP |
| `family_info`（家族情報）を旧 `demand` API から Express へ移行 | ② VPS ＋ ① の PHP ＋ フロント |
| `version.ts` を `2.2.121` に更新 | ① のフロント |

### 今回**やらないこと**

- ⚠️ **SQL の変更は無い。** phpMyAdmin での作業は不要。
- ⚠️ **`.env.prod` の追記は無い。** 新しい環境変数は増えていない。
- ⚠️ **npm 依存の追加は無い。** そのため `--renew-anon-volumes` は不要
  （付けても害は無いが、今回は必要ない）。
- ⚠️ **`reservation/index.html` のアップロードは不要。**
  ローカルと本番でバイト単位で一致していることを確認済み（19,515 bytes）。

---

## サーバーの区別（毎回確認する）

| 呼び方 | 実体 | 役割 |
|---|---|---|
| **① レンタルサーバー** | Xserver 共用 `sv13020.xserver.jp` / `khg-marketing.info` | 本番DB・PHP・React の配置先。管理は**サーバーパネル** |
| **② VPS** | `162.43.5.127` / `api.khg-marketing.info` | Docker（express-api / caddy / ssh-tunnel）。**SSH** |
| **第3のサーバー** | Xserver ビジネス `sv11135.xbiz.ne.jp` / `kh-house.jp` | LP の配置先。`noreply@` とは別で `mkt@kh-house.jp` のメール |

⚠️ 「サーバーパネル」は ① にしか無い。② は SSH のみ。
⚠️ LP（`kh-house.jp/festa/`）は **第3のサーバー**。① ではない。

---

## ⚠️⚠️ 実行順序は変えてはいけない

```
1. コミット → push → GitHub で PR マージ
2. 【② VPS】   Express を更新       ← 最初
3. 【①】       PHP をアップロード
4. 【①】       フロントを build → アップロード
5. 【kh-house.jp】LP をアップロード   ← 最後でよい
```

**なぜこの順序なのか**

- **② を先にする理由**
  ③（① の `express_proxy.php`）を先に上げると、① は `family_info` を ② へ
  転送する。② にまだハンドラが無いので ② は 404 を返し、① は 4xx を
  そのまま素通しする（≧500 のときだけフォールバックする仕様）。
  結果 **家族情報が 404 になる**。

- **フロントを最後にする理由**
  `FamilyInfo.tsx` は旧 `demand` API をやめて `request: 'family_info'` を
  送るようになっている。① の許可リストと ② のハンドラが両方揃う前に
  フロントを上げると、**家族情報モーダルが全滅する**（① に
  `handlers/family_info.php` は存在しないため 404）。

- **LP はいつでもよい**
  ただし ② のメール文言（`チェック済み`）と対になっているため、
  ② の後に上げるのが自然。

---

## 0. 事前確認

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git branch --show-current
git status --short
```

⚠️ ブランチが `v2.2.121` であること。

**現状の確認（2026-09-07 時点で確認済み。参考値）**

```powershell
# ① で information がまだ ② へ転送されていないこと（X-Handled-By が出ない）
curl.exe -s -D - -o NUL -X POST https://khg-marketing.info/dashboard/api/gateway/ `
  -H "Content-Type: application/json" -H "Authorization: 4081Kokubu" `
  -d "{\"request\":\"information\",\"category\":\"order\",\"id\":\"new\"}"
```

| 確認項目 | デプロイ前 | デプロイ後の期待値 |
|---|---|---|
| ① `information` の `X-Handled-By` | （出ない） | `express` |
| ① `family_info` | 404「該当する処理がありません。」 | 200 |
| ② `family_info` | 404 | 200 |
| LP の「広報活動」の文字 | 無し | 有り |
| LP の `qrcode@1.5.1` | 有り（前回反映済み） | 有り（変更なし） |

---

## 1. コミット → push → PR マージ

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard
git add -A
git status --short
```

⚠️ 以下が並ぶこと。`mcp-server/docs/` も入る（手順書なので問題ない）。

```
M  backend-express/src/features/event/mail.ts
M  backend-express/src/features/event/reservation.ts
M  backend-express/src/gateway/registry.ts
M  backend/src/core/express_proxy.php
M  docs/deploy-event-festa2026.md
M  frontend/src/components/FamilyInfo.tsx
M  frontend/src/components/information/InformationEdit.tsx
M  frontend/src/utils/version.ts
A  backend-express/src/features/familyInfo.ts
A  backend-express/src/features/information/index.ts
A  docs/deploy-v2.2.121.md
A  mcp-server/docs/manual-install-windows.md
```

コミットして push する。

```powershell
git commit -m "add photography consent and migrate information/family_info to express"
git push origin v2.2.121
```

### ⚠️⚠️ `git push origin HEAD:production` は使わない

PR のマージで `production` にマージコミットが付くため、ローカルのブランチは
`production` の子孫にならない。**構造的に必ず reject される。**

**正しい手順**

1. `git push origin v2.2.121`（ブランチまで）
2. GitHub で `v2.2.121` → `production` の PR を作る
3. PR をマージする

---

## 2. 【② VPS】Express の更新

### 2-1. SSH で入る

```bash
ssh root@162.43.5.127
```

### 2-2. `dcp` を用意する

```bash
alias dcp='docker compose -f ~/dashboard/docker-compose.prod.yml --env-file ~/dashboard/.env.prod'
```

⚠️⚠️ **素の `docker compose` を使わないこと。** `.env.prod` を読まない
（自動で読むのは `.env` という名前だけ）。以前これで caddy が空の
`ACME_EMAIL` で作り直され、クラッシュループして 443 が落ちた。

### 2-3. コードを取得

```bash
cd ~/dashboard
git fetch --depth 1 origin production
git reset --hard FETCH_HEAD
git log --oneline -1
```

⚠️ 手順1の PR マージが**終わってから**実行する。終わっていないと古いまま
取得され、以降の確認がすべて失敗する。

⚠️ `git reset --hard` は追跡外のファイルを消さないので `.env.prod` は残る。

### 2-4. ビルドして再作成

```bash
dcp build express-api
dcp up -d --force-recreate express-api
```

⚠️ 今回は npm 依存を追加していないため `--renew-anon-volumes` は不要。
（依存を足したリリースでは必須。付け忘れると匿名ボリュームの古い
`node_modules` が残り `Cannot find module` で起動に失敗する）

### 2-5. 起動確認

```bash
dcp ps
```

⚠️ `caddy` / `express-api` / `ssh-tunnel` の3つすべてが `Up` であること。
`Restarting (1)` なら失敗。10秒待って再実行すると確実。

```bash
dcp logs --tail 400 express-api | grep -E 'information:|family_info'
```

⚠️ **5件出るのが正常。**

```
family_info::           — 家族情報の1件取得（該当なしは false を返す）
family_info:update:     — 【書き込み】家族情報の登録・更新（upsert）…
information::order      — 顧客詳細モーダルの初期データ（order）…
information::spec       — 顧客詳細モーダルの初期データ（spec）…
information::used       — 顧客詳細モーダルの初期データ（used）…
```

### 2-6. ② に直接投げて確認

```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway \
  -H 'Content-Type: application/json' -H 'Authorization: 4081Kokubu' \
  -d '{"request":"information","category":"order","id":"new"}' \
  | head -c 200; echo
```

⚠️ `{"staff":[{...` で始まること。`該当する処理がありません` なら手順2-3の
取得が古い。

```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway \
  -H 'Content-Type: application/json' -H 'Authorization: 4081Kokubu' \
  -d '{"request":"family_info","id":"ZZZ_NO_SUCH_ID"}'; echo
```

⚠️ **`false` が返ること。** これが正常な「該当なし」の応答。
`該当する処理がありません` なら未登録。

⚠️ **`http://localhost:3001` は使えない。** express-api はポートを公開して
いない（Docker が ufw を迂回するため意図的にそうしている）。
VPS の中からでも届かない。必ず `https://api.khg-marketing.info` を使う。

---

## 3. 【① レンタルサーバー】PHP のアップロード

サーバーパネル → ファイルマネージャ（または FTP）。
配置先は `dashboard/api/gateway/` 配下。

| ローカル | ① の配置先 |
|---|---|
| `backend/src/core/express_proxy.php` | `core/express_proxy.php` |

⚠️ **このファイル1つだけ。** 他の PHP は変更していない。

⚠️ アップロード後、① で転送が効いているか確認する。

### 【あなたのPC（PowerShell）で実行】

```powershell
curl.exe -s -D - -o NUL -X POST https://khg-marketing.info/dashboard/api/gateway/ `
  -H "Content-Type: application/json" -H "Authorization: 4081Kokubu" `
  -d "{\"request\":\"information\",\"category\":\"order\",\"id\":\"new\"}"
```

⚠️ 応答ヘッダに **`X-Handled-By: express`** が出ること。
出なければ ① がまだ自分の PHP で処理している（アップロード漏れ）。

```powershell
curl.exe -s -X POST https://khg-marketing.info/dashboard/api/gateway/ `
  -H "Content-Type: application/json" -H "Authorization: 4081Kokubu" `
  -d "{\"request\":\"family_info\",\"id\":\"ZZZ_NO_SUCH_ID\"}"
```

⚠️ **`false` が返ること。** `該当する処理がありません` なら許可リストが
未反映。

### ⚠️ 書き込み系が転送されていないことも確認する

```powershell
curl.exe -s -D - -o NUL -X POST https://khg-marketing.info/dashboard/api/gateway/ `
  -H "Content-Type: application/json" -H "Authorization: 4081Kokubu" `
  -d "{\"request\":\"information\",\"category\":\"common\",\"roll\":\"log\",\"id\":\"ZZZ\"}"
```

⚠️⚠️ **`X-Handled-By` が出ない**のが正常。出たら許可リストの書き方を
間違えている（`'information'` と request だけで書いてしまっている）。
書き込み系が転送されると、転送失敗時の自動フォールバックで
**① でも実行され二重登録になる。**

---

## 4. 【① レンタルサーバー】フロントの build

### 【あなたのPC（PowerShell）で実行】

```powershell
cd C:\Users\shinji-kawano\react\dashboard\frontend
npm run build
```

⚠️ `Compiled with warnings.` は正常（既存の警告のみ）。
`Failed to compile` なら止めて報告してほしい。

`frontend/build/` の中身を ① の公開ディレクトリへアップロードする。

⚠️ `index.html` の上書き漏れに注意。漏れると**古い JS を読み続ける**ため、
新機能が出てこない。

⚠️ 手順3（PHP）より**後**に行う。順序を逆にすると家族情報が 404 になる
（冒頭の「実行順序」参照）。

---

## 5. 【kh-house.jp】LP のアップロード

`C:\Users\shinji-kawano\Downloads\20260425_kokubu_ouchi_festa_LP_NK\` から
`kh-house.jp/festa/` へ配置する。

| ローカル | 配置先 |
|---|---|
| `index.html` | `festa/index.html` |

⚠️ **今回は `index.html` 1ファイルだけ。**

- `reservation/index.html` … 本番と一致（19,515 bytes）。上げなくてよい
- `img/` … 変更なし

⚠️ **アップロードしないもの**

- `index.html.before-privacy` / `index.html.before-post-api` / `index.html.before-map`
  （私が作ったバックアップ）
- `Links/`（psd / eps の素材）／ `*.ai` / `*.pdf` / `.DS_Store`

### 確認

```powershell
curl.exe -s https://kh-house.jp/festa/ | Select-String "広報活動"
```

⚠️ 1行ヒットすること。ヒットしなければアップロードされていない。

⚠️ ブラウザで見るときは **Ctrl+Shift+R**（キャッシュを無視して再読込）。
通常の再読込では古い HTML が残る。

---

## 6. 動作確認

### 6-1. LP の同意文（見た目）

<https://kh-house.jp/festa/> を開き、フォーム下部の小さい文字に
以下の一文があること。

> また、イベント中にお客様のご様子を撮影させていただくことがございます。
> 撮影した写真・動画は、弊社のパンフレット・ホームページ・SNS等の広報活動に
> 活用させていただく場合がございますので、あらかじめご了承ください。

### 6-2. メールに同意欄が入るか（⚠️ 本番データが1件増える）

LP から実際に1件予約する。

- 氏名: `テスト 撮影確認`
- メール: 自分の受信できるアドレス
- 同意チェックを入れる（必須なので外せない）

⚠️ 確認すること。

| 宛先 | 確認内容 |
|---|---|
| 自分（サンクスメール） | `【個人情報の同意】チェック済み` の1行がある |
| `mkt@kh-house.jp`（社内通知） | 同じ1行がある |
| 両方 | QRコードの PNG が添付されている |

### 6-3. ダッシュボードの顧客詳細（Express 化の確認）

⚠️ ここが今回いちばん壊れやすい。**3つの事業区分すべてで開く。**

| 画面 | 確認内容 |
|---|---|
| 注文の顧客一覧 → 顧客を1件開く | 担当店舗・担当営業・反響媒体のプルダウンに値が並ぶ |
| 建売（Kaeru）の顧客を1件開く | 同上。物件のプルダウンも並ぶ |
| 中古（Resale）の顧客を1件開く | 同上。⚠️ **仲介情報が表示されること** |

⚠️⚠️ **中古の「仲介情報」を必ず見ること。**
ローカルDBに `brokerage_listings.master_data_id` が入った行が0件だったため、
**該当ありのケースだけ検証できていない**。表示が消えていたら報告してほしい。

### 6-4. 家族情報（旧APIからの移行）

| 操作 | 確認内容 |
|---|---|
| 顧客詳細 → 家族情報「入力・確認」 | **既存の家族が表示される**（空なら移行失敗） |
| 家族を1人追加 → 保存 | エラーが出ない |
| モーダルを閉じて再度開く | 追加した家族が残っている |

⚠️ ここは旧 `demand` API から切り替えた箇所。**表示が空になるのが失敗の兆候。**
その場合はブラウザの開発者ツール → Network で
`family_info` のレスポンスを見る。`該当する処理がありません` なら
手順2または3が未完了。

### 6-5. フッターボタンの横幅

顧客詳細モーダルの下部。4つのボタン（K-Snap / アイスワールド / 土地
コーディネート / 保存）が以前より詰まっていること。

⚠️ スマートフォンでは非表示ではなく `zoom: 0.3` で縮小表示される。
文字サイズは変えていないので読めるはず。

### 6-6. 検証データの削除

手順6-2で作った予約を消す。① の phpMyAdmin。

```sql
SELECT no, id, name, mail, reserved_at FROM event_db
 WHERE name LIKE 'テスト%' ORDER BY no DESC;
```

⚠️ 消す行を**目視で確認してから** DELETE する。

```sql
DELETE FROM event_db WHERE no = <上で確認した no>;
```

---

## 切り戻し

### 症状別

| 症状 | 切り戻し |
|---|---|
| 顧客詳細のプルダウンが空 / 家族情報が空 | **① の `express_proxy.php`** で該当行をコメントアウトして再アップロード（数秒で戻る） |
| ② が起動しない | `dcp logs --tail 200 express-api` を見る。直前のコミットへ `git reset --hard` して再ビルド |
| LP の表示が崩れた | `index.html.before-privacy` をアップロードし直す |

### ① の許可リストを部分的に戻す

`backend/src/core/express_proxy.php` の該当行をコメントアウトする。

```php
// 'information::order',
// 'information::spec',
// 'information::used',
// 'family_info',
```

⚠️ **`family_info` を戻すときは注意。** ① に `handlers/family_info.php` は
存在しないため、戻すと家族情報が 404 になる。
フロントも旧 `demand` API 版に戻す必要がある（＝前回の build を再アップロード）。
`information` の3行はコメントアウトすれば ① の PHP に戻るだけなので安全。

---

## ⚠️ つまずきやすい点（過去に実際に起きたもの）

1. **`X-Handled-By` が出ないのに「デプロイした」と思い込む**
   ① のファイルマネージャでアップロードしたつもりが別ディレクトリだった。
   配置先は `dashboard/api/gateway/core/express_proxy.php`。

2. **Express専用の request が 404 になる → ② 到達不能のサイン**
   許可リストを疑う前に、まず ② で `dcp ps` を実行して **caddy** を見る。
   以前 caddy が `Restarting (1)` でクラッシュループしており、
   アンバサダー画面が気づかれずに壊れていた。

3. **`git push origin HEAD:production` を試して reject される**
   構造的に必ず失敗する。ブランチまで push して PR でマージする。

4. **PowerShell で VPS 用のコマンドを実行してしまう**
   PowerShell の `curl` は `Invoke-WebRequest` のエイリアス。`curl.exe` を使う。
   行継続は `\` ではなくバッククォート。JSON の `"` は `\"` でエスケープする。

5. **ブラウザのキャッシュ**
   LP もダッシュボードも **Ctrl+Shift+R**。特に LP は
   「アップロードしたのに変わらない」の原因がほぼこれ。
