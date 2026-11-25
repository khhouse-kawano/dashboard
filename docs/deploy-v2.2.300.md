# デプロイ手順 v2.2.300　全社報告用フォーマットを年度ごとに読む（GET）

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 更新履歴1行・業務ガイド「全社報告用フォーマット」「同（建売営業）」「同（中古リノベ）」（期を選ぶ） | ① DB `backend/scripts/sql/2026-11-25_update_log_2.2.300.sql` |
| 2 | 新しい request `company_year`（GET。引数 `year`）。返す形は `company` と同じで、契約者の3つの一覧だけを年度（＋前年度・今月・S〜C ランク・担当×店舗ごとの最初の行）で絞る。⚠️ 最初の行は契約棟数ランキングの「0件の担当」と同着の並びを今までと同じにするため | ② VPS（features/company/index.ts、gateway/registry.ts） |
| 3 | `company_year` を GET で受け、② へ転送する（GET の許可リスト・転送リスト・転送専用リスト） | ① PHP `backend/src/core/db.php`・`backend/src/core/express_proxy.php` |
| 4 | 全社報告用フォーマット：開いたとき・期を変えたときに、その年度を GET で読む。期を URL（`?year=2025`）にも出す。読み込み中は「読み込み中…」と表を薄く。② に届かないときは今までの `company`（POST）で全年度を読む | Dashboard（frontend の build） |

- ⚠️ v2.2.299 までを先に済ませてください。表の変更はありません。
- ⚠️ ① PHP（手順4）は ② のあとに上げてください。先に上げると ② に無い request を転送して 502 になります（画面は今までの全年度の読み込みに切り替わるので、表は出ます）。
- 画面を先に上げても、② か ① PHP が古いあいだは今までどおり全年度で読みます（表の数字は同じ）。

## 順序
```
1. GitHub で v2.2.300 を production へマージ（PR）
2. ① SQL：2026-11-25_update_log_2.2.300.sql   ← ⚠️ 1回だけ
3. ② VPS
4. ① PHP：backend/src/core/db.php と backend/src/core/express_proxy.php をアップロード
5. Dashboard の画面を build してアップロード
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-25_update_log_2.2.300.sql
```

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
- `git log` が v2.2.300 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順4　【① PHP】
`backend/src/core/db.php` と `backend/src/core/express_proxy.php` をアップロードします。

確認（トークン無しで送って 401 なら ② まで届いています。400 なら db.php、404 なら express_proxy.php が古いままです）：
```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://khg-marketing.info/dashboard/api/gateway/?request=company_year&year=2026'
```

### 手順5　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/company/Company.tsx`
  - `src/components/company/CompanyToolbar.tsx`
  - `src/components/company/companyStyle.ts`
  - `src/utils/version.ts`

## 終わったら（動作確認）
1. 左のメニュー「全社報告用フォーマット」を開く。一瞬「読み込み中…」が出て表が薄くなり、表が出る。
2. ブラウザの開発者ツールの「ネットワーク」で、`request=company_year&year=…` の GET が1回だけ出ている（`company` の POST は出ない）。
3. 期を前の期に変えると、GET がもう1回出て、アドレスの最後に `?year=2025` のように付く。そのアドレスを開き直すと、同じ期の表が出る。今の期に戻すと `?year=` が消える。
4. 「昨年実績を表示」「キャンセル数を表示」「併売店をまとめる」を切り替えても、GET は出ない。
5. 契約棟数ランキング・4半期サマリーが今までどおり出る。

## 切り戻し
- 画面を前の build に戻せば、今までどおり `company` の POST で全年度を読みます。
- ② と ① PHP はそのままで構いません。
