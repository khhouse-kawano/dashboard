# デプロイ手順 v2.2.293　架電ステータス・架電アクションの選択肢を DB で管理・インサイドセールスの管理店舗

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 表 `call_status` を作り、今までの選択肢と、新しい「IS対応中」「IS追客終了」（注文）・「SMS返信あり」（全事業）を入れる。`staff_list` に `managed_shops`（管理店舗）を足す。更新履歴1行・業務ガイド「架電ステータスの設定」（新規）・「ヘッダーのメニュー」 | ① DB `backend/scripts/sql/2026-11-23_update_log_2.2.293.sql` |
| 2 | 新しい request を4つ足す。`call_status_options`（選択肢。全員）、`call_status_admin`・`call_status_save`・`inside_staff_save`（管理。Master / insideSales だけ） | ② VPS（features/callStatusMaster.ts、gateway/registry.ts） |
| 3 | 上の4つを ② へ転送する（転送リストと転送専用リストの両方） | ① PHP `backend/src/core/express_proxy.php` |
| 4 | 顧客DB（注文・建売・中古）の「架電状況」と、顧客情報の架電記録の選択肢を DB から読む。「システム管理 → 架電ステータス」の画面（Master・insideSales）を足す | Dashboard（frontend の build） |

- ⚠️ v2.2.292 までを先に済ませてください。
- ⚠️ SQL（手順2）を ② より先に流してください。表が無いまま ② を上げると、管理画面が開けません（顧客DB・顧客情報は今までの固定の選択肢で動きます）。
- ⚠️ 画面（手順5）は最後に上げてください。② か ① PHP が先に終わっていないと、顧客DB・顧客情報は今までの固定の選択肢を出し、IS の2つと SMS返信ありが出ません。管理画面も開けません。

## 順序
```
1. GitHub で v2.2.293 を production へマージ（PR）
2. ① SQL：2026-11-23_update_log_2.2.293.sql   ← ⚠️ 1回だけ（表の部分は何度流しても安全。更新履歴の行だけ増える）
3. ② VPS
4. ① PHP：backend/src/core/express_proxy.php をアップロード
5. Dashboard の画面を build してアップロード
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-23_update_log_2.2.293.sql
```
- 最後の確認で、`call_status` の表があり、件数が `action / all 7`・`status / all 5`・`status / order 2`、`managed_shops` の列が出ればよいです。

### 手順3　【② VPS】
```bash
cd ~/dashboard
git fetch --depth 1 origin production
git checkout FETCH_HEAD
git log -1 --oneline
```
```bash
dcp build express-api
```
```bash
dcp up -d express-api
dcp ps express-api
```
- `git log` が v2.2.293 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順4　【① PHP】
`backend/src/core/express_proxy.php` をアップロードします。

確認（トークン無しで送って 401 なら ② まで届いています。404 なら ① PHP が古いままです）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{"request":"call_status_options"}' 'https://（① のドメイン）/dashboard/api/gateway/'
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' -d '{"request":"call_status_admin"}' 'https://（① のドメイン）/dashboard/api/gateway/'
```

### 手順5　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/database/callStatusOptions.ts`（新規）
  - `src/components/header/system/CallStatusSettings.tsx`（新規）
  - `src/components/database/DatabaseOrder.tsx`
  - `src/components/database/DatabaseKaeru.tsx`
  - `src/components/database/DatabaseResale.tsx`
  - `src/components/information/TableCall.tsx`
  - `src/components/header/headerScreens.tsx`
  - `src/components/guide/guideScreens.ts`
  - `src/utils/version.ts`

## 終わったら（動作確認）
- 管理者で「システム管理 → 架電ステータス」が開き、架電ステータス7件・架電アクション7件・インサイドセールスの担当者が出る。
- 注文営業の顧客DB の「架電状況」に「IS対応中」「IS追客終了」が出る。建売・中古には出ない。
- 顧客情報の架電記録の「アクション内容」に「SMS返信あり」が出る（SMS送信の次）。
- 一般スタッフのメニューには「架電ステータス」が出ない。

## 切り戻し
- 画面を前の build に戻せば、今までどおり固定の選択肢に戻ります。
- 表と ② はそのままで構いません。消すときは `DROP TABLE call_status; ALTER TABLE staff_list DROP COLUMN managed_shops;` です。
  - ⚠️ ただし「IS対応中」などが入ったお客様の値は、そのまま残ります。
