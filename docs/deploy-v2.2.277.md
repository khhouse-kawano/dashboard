# デプロイ手順 v2.2.277　店舗別反響推移（注文・建売・中古）を選んだ期間だけ読み込む

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 店舗別反響推移の応答を、期間（startMonth / endMonth）・昨年実績（lastYear=1）・広告費（budget=1）で絞る。月の一覧の関数を共通の `utils/period.ts` に移した（反響一覧も同じものを使う） | ② VPS（backend-express） |
| 2 | ② が落ちたときの予備（① PHP）にも同じ絞り込み。`GET_ALLOWED_REQUESTS` に `shopTrend`。月の一覧の関数を `core/period.php` に移し、反響一覧（list.php・listAction/*）もそれを使う | ① PHP `backend/src/` の10ファイル |
| 3 | 3画面が GET で期間の分だけ読む。期間は URL（`?startMonth=YYYYMM&endMonth=YYYYMM`）。昨年実績・広告費はチェックを入れたときに読み直す。11か月前の開始月を日本時間で数える（0〜9時のずれを直した）。建売・中古の「昨年の広告費」が0になっていたのを直した | ① フロント（Dashboard） |
| 4 | 更新履歴・業務ガイド3本（反響推移（販促媒体別・店舗別）を直す、反響推移（販促媒体別・店舗別）（建売営業）・店舗別反響推移（中古リノベ）を新しく作る） | ① DB `backend/scripts/sql/2026-11-17_update_log_2.2.277.sql` |

- `.env.prod` の変更・ライブラリの追加・表の変更はありません。
- ⚠️ **v2.2.276 までのデプロイを先に済ませてください**（docs/deploy-v2.2.276.md）。この版は v2.2.276 の上に作っています。
- 販促媒体別反響推移（customerTrend）は変えていません（v2.2.278 の予定）。

## ⚠️ 順序
```
0. v2.2.276 までのデプロイが終わっていること
1. GitHub で v2.2.277 を production へマージ（PR）
2. ② VPS：fetch・checkout → 作り直し
3. ① PHP 10ファイル
4. ① Dashboard のフロント（npm run build → アップロード）
5. ① SQL：2026-11-17_update_log_2.2.277.sql   ← ⚠️ 1回だけ
```
- ② と ① PHP は、期間が送られてこなければ今までどおり全件を返します。古い画面（v2.2.276）のままでも数字は変わりません。
- ⚠️ **フロントは ① PHP より後に上げてください。** 新しい画面は GET で送るので、`db.php` が古いままだと 400 になり、表が「読み込めませんでした」になります。
- SQL を最後にするのは、更新履歴の1行が入ると古い画面が新しい版に読み直しを始めるためです（フロントを上げてから入れます）。

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
- `git log` が v2.2.277 のマージのコミットならよいです。
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない（VPS はブランチに付いていない形なので失敗し、古いコードのまま作り直される）。⚠️ `dcp` を使う（`docker compose -f` だけだと `.env.prod` が渡らず ② が起動しない）。

### 手順3　【① PHP】
次のファイルをアップロードします（同じ場所へ。上書き）。⚠️ 1 は新しいファイルです。**1 を最初に**上げてください（3〜10 が読み込むため、無いと反響一覧と店舗別反響推移が開きません）。
1. `backend/src/core/period.php`（新規）
2. `backend/src/core/db.php`
3. `backend/src/handlers/list.php`
4. `backend/src/handlers/listAction/list_order.php`
5. `backend/src/handlers/listAction/list_spec.php`
6. `backend/src/handlers/listAction/list_used.php`
7. `backend/src/handlers/shopTrend.php`
8. `backend/src/handlers/shopTrendAction/shopTrend_order.php`
9. `backend/src/handlers/shopTrendAction/shopTrend_spec.php`
10. `backend/src/handlers/shopTrendAction/shopTrend_used.php`

上げ終えたら確かめます（ログインしていないブラウザやターミナルから）。
```bash
curl -s 'https://khg-marketing.info/dashboard/api/gateway/?request=shopTrend&category=order&startMonth=202512&endMonth=202611'
```
- `{"status":"error","message":"認証が必要です。"}`（401）が出ればよいです。⚠️ `不正なリクエストです。`（400）なら `db.php` が古いままです。
- 反響一覧を開いて、いつもどおり表示されることも確かめます（list.php が core/period.php を読むようになったため）。

### 手順4　【① フロント】
いつもどおり `npm run build` してアップロードします。

### 手順5　【① SQL】
phpMyAdmin で `2026-11-17_update_log_2.2.277.sql` を **1回だけ**流します（更新履歴1行＋業務ガイド3本）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
SELECT title, division, updated_at FROM guide_article WHERE title IN ('反響推移（販促媒体別・店舗別）', '反響推移（販促媒体別・店舗別）（建売営業）', '店舗別反響推移（中古リノベ）');
```
- 画面左上の版が 2.2.277 になればよいです。

## 終わったら（動作確認）
- 店舗別反響推移（注文・建売・中古）を開くと「読み込み中…」のあと表が出る。開始月・終了月の欄に、いま選んでいる月（注文・建売は11か月前〜今月、中古は 2026/06〜今月）が出る。
- 期間を変えると URL の末尾に `?startMonth=…&endMonth=…` が付き、再読み込みしても同じ期間で開く。「戻る」で前の期間に戻る。
- 「昨年実績を表示」「広告費を表示」を入れると読み込み直して、昨年の数・広告費が出る。外したときは読み込み直さない。
- 課・店舗・媒体を選んだまま期間を変えても、選んだものが残る。
- 建売・中古で「昨年実績」と「広告費」を両方入れると、広告費の「昨:」に金額が出る（前は ￥0）。
- 反響一覧（注文・建売・中古）がいつもどおり開き、期間を変えて読み直せる。

## 切り戻し
- フロントだけ v2.2.276 に戻せば、古い画面は POST で全件を読むので、新しい ① PHP・② のままでも今までどおり動きます。
- ① PHP を戻すときは、`core/period.php` を消さずに残してください（v2.2.276 の list.php は使いませんが、残しても害はありません）。⚠️ 新しい list.php・listAction/* だけを残して period.php を消すと反響一覧が開きません。

## 知っておくこと
- **応答の量（ローカル・初期表示・チェックなし）**：注文 顧客 26,602 → 11,593 件・広告費 23,457 → 0 件（JSON 約13MB → 約3MB）。建売 顧客 8,881 → 3,760 件。中古 顧客 2,550 → 601 件。数字は全件のときと同じです（全事業・主な期間・チェックの組み合わせで照合済み）。
- **昨年の広告費（建売・中古）**：v2.2.276 までは前年の広告費を注文のもので探していたため、いつも ￥0 でした。この版から前年の建売・中古の広告費が出ます（昨年の単価も変わります）。
- **開始月のずれ**：11か月前の開始月を UTC で数えていたため、日本時間の0〜9時に開くと12か月前になっていました。日本時間で数えるようにしました（販促媒体別反響推移の初期の開始月も同じく直ります）。
- **ログインの確認が遅い（今回は直していません）**：① はトークンの確認で `staff` を `SELECT *` で読みます。ローカルでは `staff.log`（合計約285MB）を読むため、どの画面の通信にも約6秒かかっていました。本番の `staff.log` が大きければ同じです。別の版で列を絞ることを勧めます。
