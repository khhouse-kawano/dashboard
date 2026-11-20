# デプロイ手順 v2.2.287　アクセス解析：CV を完了ページで数える・期間を選べるように

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | サイトの表に「完了ページ」の列を足し、国分ハウジング・DAY JUST HOUSE・かえるホームの完了ページを入れる。更新履歴1行。業務ガイド「アクセス解析」の記事 | ① DB `backend/scripts/sql/2026-11-20_update_log_2.2.287.sql` |
| 2 | 完了ページを登録したサイトは、完了ページを開いたことを CV と数える（一覧・サマリー・詳細・業者別の歩留まり）。期間（startDate / endDate）を受けて数える。既定は直近7日、最大92日 | ② VPS（features/tracking/*） |
| 3 | アクセス解析の読み取り4つ（一覧・サマリー・詳細・業者別の歩留まり）を GET で受けられるように | ① PHP `backend/src/core/db.php` |
| 4 | 画面の上に期間の欄（初期値は今日−6日〜今日）。変えたら GET で取り直す。サイトの「直す」に完了ページの欄。CV の種類別の表示 | Dashboard（frontend の build） |

- ⚠️ v2.2.286 までを先に済ませてください。
- ⚠️ 表の変更があります（tracking_sites に cv_pages）。SQL を先に流してください。
- ⚠️ 画面（手順5）は、① PHP（手順4）より後に上げてください。先に上げると、画面の GET が ① で 400 になり、アクセス解析が開けません。

## 順序
```
1. GitHub で v2.2.287 を production へマージ（PR）
2. ① SQL：2026-11-20_update_log_2.2.287.sql   ← ⚠️ 1回だけ（更新履歴が1行増える）
3. ② VPS
4. ① PHP 1ファイル（core/db.php）
5. Dashboard の画面を build してアップロード
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-20_update_log_2.2.287.sql
```
- 最後に `id / name / cv_pages` の一覧が出ます。国分ハウジング 4・DAY JUST HOUSE 4・かえるホーム 6、ほかは NULL ならよいです。
- 表の変更（ALTER）と完了ページの初期値（UPDATE）は、何度流しても同じ結果です。更新履歴の行だけは流すたびに増えます。

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
- `git log` が v2.2.287 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。
- 新しい request はありません（express_proxy.php の変更は不要です）。

### 手順4　【① PHP】
`backend/src/core/db.php` を ① の同じ場所へアップロードします（上書き）。

### 手順5　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：`src/components/header/inquiry/TrackingSettings.tsx`・`TrackingDetail.tsx`・`TrackingVendorFunnel.tsx`・`src/utils/version.ts`

## 終わったら（動作確認）
- 反響管理 → アクセス解析 を開くと、上に「期間」が出て、今日−6日〜今日になっている。
- 一覧の見出しが「期間の着地」「期間のCV」になり、国分ハウジング・DAY JUST HOUSE・かえるホームの CV の下に「完了ページで数える」と出る。
- 期間を変える（例「直近30日」）と、一覧の数字が変わる。
- 国分ハウジングのサイト名を押すと、サマリーの CV の下に「CV の種類別：来場予約 ○ 会員登録 ○ …」が出る。
- 流入元 → 業者別 → Bander を押すと、歩留まりの見出しが「CV」で、下に CV の種類別の表が出る。
- 国分ハウジングの「直す」を押すと、「完了ページ」の欄に4行（/event_ok/ 来場予約 など）が入っている。

## 切り戻し
- 画面と ② を前の版に戻せば、今までの数え方（直近30日・反響で数える）に戻ります。
- ① の db.php は戻さなくて構いません（GET を受けられるようになるだけです）。
- 表の cv_pages は残しておいて構いません（前の版の ② は読みません）。
