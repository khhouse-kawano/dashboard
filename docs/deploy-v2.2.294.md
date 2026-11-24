# デプロイ手順 v2.2.294　架電状況：期間を選んで GET で読む・インサイドセールスの対応反響数・表の見た目

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 新しい request `call_status_summary`（GET・認証あり）。事業と期間（from / to。最長12か月）を受け、その期間の数字に要る顧客・架電シートだけを返す（ローカル実測 約64MB → 約12MB） | ② VPS（features/callStatusList.ts、gateway/registry.ts） |
| 2 | 上の request を ② へ転送する（転送リストと転送専用リスト）・GET を受ける（GET_ALLOWED_REQUESTS） | ① PHP `backend/src/core/express_proxy.php`・`backend/src/core/db.php` |
| 3 | 架電状況の上に「開始月」「終了月」（新しい順。初期は今月までの6か月）。選んだ期間を GET で読む（② に届かないときは今までの callStatusList で全件を読み、画面で同じ条件で絞る）。インサイドセールス全体の「対応反響数」を、今年度のインサイドセールスの担当者が架電記録に名前を残した顧客の数にする。インサイドセールスの表を店舗ごとに区切る | Dashboard（frontend の build） |
| 4 | 更新履歴1行・業務ガイド「架電状況」（新規） | ① DB `backend/scripts/sql/2026-11-23_update_log_2.2.294.sql` |

- ⚠️ v2.2.293 までを先に済ませてください。表の変更はありません。
- ⚠️ 画面（手順5）は最後に上げてください。② と ① PHP が先に終わっていないと、画面は今までの全件読み込みに切り替わります（動きますが、速くなりません）。
- 今までの `callStatusList`（POST）はそのまま残します（② に届かないときの予備）。

## 順序
```
1. GitHub で v2.2.294 を production へマージ（PR）
2. ② VPS
3. ① PHP：backend/src/core/express_proxy.php・backend/src/core/db.php をアップロード
4. ① SQL：2026-11-23_update_log_2.2.294.sql   ← ⚠️ 1回だけ
5. Dashboard の画面を build してアップロード
```

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
- `git log` が v2.2.294 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順3　【① PHP】
`backend/src/core/express_proxy.php` と `backend/src/core/db.php` をアップロードします。

確認（トークン無しで送って 401 なら ② まで届いています。404 なら ① PHP が古いままです）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://（① のドメイン）/dashboard/api/gateway/?request=call_status_summary&category=order&from=2026-06&to=2026-11'
```

### 手順4　【① SQL】
```bash
mysql < 2026-11-23_update_log_2.2.294.sql
```

### 手順5　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/header/callStatus/CallStatusList.tsx`
  - `src/utils/version.ts`

## 終わったら（動作確認）
ヘッダーの「架電状況 → 注文営業」を開き、次を確かめます。
- 上に「開始月」「終了月」があり、今月までの6か月の列が出る。前より早く開く。
- 開始月を変えると列が変わり、アドレスに `?from=…&to=…` が出る。読み込み直しても同じ期間で開く。
- インサイドセールスの表が店舗ごとに区切られ、いちばん上の「インサイドセールス全体」が黒い札で出る。
- 「インサイドセールス全体」の対応反響数が、総反響数より小さい（担当者が対応したお客様の数）。
- 顧客DB の「架電状況集計」から開いても、期間を選べる（顧客DB のアドレスは変わらない）。

## 切り戻し
画面を前の build に戻せば、今までどおり全件を読み込む形に戻ります。② と ① PHP は request が1つ増えるだけなので、戻さなくて構いません。
