# デプロイ手順 v2.2.278　販促媒体別反響推移（注文・建売）を選んだ期間だけ読み込む

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 販促媒体別反響推移（注文・建売）が、選んだ期間の分だけ読み込む。昨年実績・広告費・名寄せした顧客は、チェックを入れたときに読み込む。期間がアドレスに残る | ① フロント（Dashboard） |
| 2 | ② が落ちたときの予備も、同じく期間で絞る。GET を受け付ける処理に販促媒体別反響推移を足す | ① PHP `backend/src/` の4ファイル |
| 3 | 販促媒体別反響推移の処理が、期間・チェックで絞る | ② VPS（backend-express） |
| 4 | 更新履歴・業務ガイド2本（反響推移の注文・建売） | ① DB `backend/scripts/sql/2026-11-18_update_log_2.2.278.sql` |

- 表の変更・`.env.prod` の変更はありません。
- ⚠️ **v2.2.277 までのデプロイを先に済ませてください**（docs/deploy-v2.2.277.md）。この版は v2.2.277 の `core/period.php` を使います。

## ⚠️ 順序
```
0. v2.2.277 までのデプロイが終わっていること
1. GitHub で v2.2.278 を production へマージ（PR）
2. ② VPS：fetch・checkout → 作り直し
3. ① PHP 4ファイル
4. ① Dashboard のフロント（npm run build → アップロード）
5. ① SQL：2026-11-18_update_log_2.2.278.sql   ← ⚠️ 1回だけ
```
- ⚠️ **フロントは ① PHP より後に上げてください。** 新しい画面は GET で送るので、`db.php` が古いままだと 400 になり、表が「読み込めませんでした」になります。
- ② と ① PHP は、期間の指定が無ければ今までどおり全件を返します。古い画面のままでも動くので、先に上げて問題ありません。

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
- `git log` が v2.2.278 のマージのコミットならよいです。
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない（VPS はブランチに付いていない形なので失敗し、古いコードのまま作り直される）。⚠️ `dcp` を使う（`docker compose -f` だけだと `.env.prod` が渡らず ② が起動しない）。

### 手順3　【① PHP】
次の4ファイルを ① の同じ場所へアップロードします（上書き）。
1. `backend/src/handlers/customerTrend.php`
2. `backend/src/handlers/customerTrendAction/customerTrend_order.php`
3. `backend/src/handlers/customerTrendAction/customerTrend_spec.php`
4. `backend/src/core/db.php`

上げたら、ログインしていないブラウザで次を開いて確かめます。
```
https://khg-marketing.info/dashboard/api/gateway/?request=customerTrend&category=order&startMonth=202610&endMonth=202611
```
- `{"status":"error","message":"認証が必要です。"}`（401）が出ればよいです。⚠️ `不正なリクエストです。`（400）なら `db.php` が古いままです。

### 手順4　【① フロント】
いつもどおり `npm run build` してアップロードします。画面左上の版が 2.2.278 になればよいです。

### 手順5　【① SQL】
phpMyAdmin で `2026-11-18_update_log_2.2.278.sql` を **1回だけ**流します（更新履歴1行＋業務ガイド2本）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
SELECT title, updated_at FROM guide_article WHERE title IN ('反響推移（販促媒体別・店舗別）', '反響推移（販促媒体別・店舗別）（建売営業）');
```

## 終わったら（動作確認）
- 販促媒体別反響推移（注文・建売）を開くと、表が今までどおり出る。開始月・終了月の欄に、11か月前〜今月が出ている。
- 開始月を変えると、アドレスの末尾に `?startMonth=…&endMonth=…` が付き、再読み込みしても同じ期間で開く。
- 広告費・昨年実績（注文）・名寄せした顧客も表示（建売）にチェックを入れると、数字が出る。

## 切り戻し
- フロントを前の版に戻すだけで、今までどおり全件を読む形に戻ります（② と ① PHP は新旧どちらの画面でも動きます）。

## 知っておくこと
- ローカルでの量（初めて開いたとき）：注文 14.2MB → 3.4MB、建売 4.8MB → 1.4MB。
- ② を通らず ① の予備で返すときは、顧客の「個人情報削除の印」の列がありません（v2.2.229 から ② だけにある列。今回の変更とは関係なく、もとからの差）。
