# デプロイ手順 v2.2.282　反響推移の「ポータル反響のみ表示」をポータル反響の印で絞る（建売にも追加）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 販促媒体別反響推移（注文・建売）の顧客に `portal_flag` を返す | ② VPS |
| 2 | ② が落ちたときの予備も同じ | ① PHP `backend/src/handlers/customerTrendAction/` の2ファイル |
| 3 | 「ポータル反響のみ表示」が、ポータル反響の印（v2.2.281）のあるお客様だけを数える。建売にもチェックを追加 | ① フロント（Dashboard） |
| 4 | 更新履歴1行・業務ガイド2本 | ① DB `backend/scripts/sql/2026-11-18_update_log_2.2.282.sql` |

- ⚠️ v2.2.281 までのデプロイ（`portal_flag` の列と埋め戻し）を先に済ませてください。表の変更はありません。

## 順序
```
0. v2.2.281 までのデプロイが終わっていること
1. GitHub で v2.2.282 を production へマージ（PR）
2. ② VPS
3. ① PHP 2ファイル
4. ① Dashboard のフロント（npm run build → アップロード）   ← ⚠️ ②・① PHP より後
5. ① SQL：2026-11-18_update_log_2.2.282.sql   ← ⚠️ 1回だけ
```
- ⚠️ フロントは ②・① PHP より後に上げてください。先に上げると `portal_flag` が届かず、チェックを入れたときに 0 件になります。

### 手順2　【② VPS】
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
- `git log` が v2.2.282 のマージのコミットならよいです。
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う（`docker compose -f` だけだと `.env.prod` が渡らず ② が起動しない）。

### 手順3　【① PHP】
次の2ファイルを ① の同じ場所へアップロードします（上書き）。
1. `backend/src/handlers/customerTrendAction/customerTrend_order.php`
2. `backend/src/handlers/customerTrendAction/customerTrend_spec.php`

### 手順4　【① フロント】
いつもどおり `npm run build` してアップロードします。画面左上の版が 2.2.282 になればよいです。

### 手順5　【① SQL】
```bash
mysql < 2026-11-18_update_log_2.2.282.sql
```
- 1回だけ流してください（更新履歴1行＋業務ガイド2本。UPDATE は無いので safe update モードでも止まりません）。

## 終わったら（動作確認）
- 販促媒体別反響推移（注文）で「ポータル反響のみ表示」を入れると、全販促媒体の総反響が減り、ホームページ反響の行が消える（ローカルでは 11,348 → 6,478）。
- 販促媒体別反響推移（建売）にも同じチェックがあり、入れると「全販促媒体」と SUUMO・HOME'S・ALLGRIT・アットホームの行だけになる（ローカルでは総反響 3,520 → 245）。
- 外すと元の数字に戻る。

## 切り戻し
フロント・②・① PHP を前の版に戻すだけです。
