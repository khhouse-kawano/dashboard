# デプロイ手順 v2.2.248　不動産企画係：連動トリガー仕様書の ① 媒介獲得

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 新しい処理 `planner:ledger_link`（売り反響 → 台帳を1つのトランザクションで作る） | ② VPS（backend-express） |
| 2 | `planner:ledger_link` を ② へ通す（許可リスト2か所） | ① PHP `backend/src/core/express_proxy.php` |
| 3 | 媒介紐付の画面（必須・満了日・台帳を開くボタン）、台帳の一覧で行を目立たせる、架電キュー・チームサマリーで媒介受託を選べない、台帳の編集画面に専属専任媒介、版の番号 | ① フロント |
| 4 | 更新履歴・業務ガイド「反響から商談案件へのつながり（不動産企画係）」（上書き） | ① DB `backend/scripts/sql/2026-11-05_update_log_2.2.248.sql` |

- DB の列は足しません（使う `expiry`・`ledgerId` は、もとからある列です）。
- ⚠️ **順番を守ってください**：② → ① PHP → ① フロント。フロントだけ先に上げると、媒介紐付の「登録」が 404 か 502 になります。
- ⚠️ v2.2.245 → v2.2.246 → v2.2.247 → v2.2.248 の順にマージしてください。

## 順序
```
0. GitHub で v2.2.248 を production へマージ（PR）。⚠️ v2.2.247 までのマージが先
1. ② VPS（backend-express）を更新して再起動
2. ① PHP（express_proxy.php）をアップロード
3. ① フロント（いつもの手順）
4. ① SQL（更新履歴・業務ガイド）   ← ⚠️ 1回だけ
```

### 手順1　【② VPS】backend-express を更新
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
**確認A（起動ログの登録一覧）**：
```bash
dcp logs express-api | grep "planner:ledger_link" | tail -1
```
- 次のような1行が出て、先頭の時刻が今 `up -d` した時刻（UTC。日本時間 −9時間）ならよいです。
  ```
  [2026-11-xxTxx:xx:xx.xxxZ] [INFO]   🔒 planner:ledger_link:  — 【書き込み】不動産企画係: 売り反響の媒介紐付（…）
  ```
- ⚠️ ログの表記は `planner/ledger_link` ではなく **`planner:ledger_link`**（コロン区切り）です。
- ⚠️ `--tail` を付けないでください。登録一覧は約190行あり五十音順なので、`--tail 200` などでは届かないことがあります。
- 何も出ない、または時刻が古いときは、更新が入っていません（手順0のマージと、上の `git checkout` を確かめる）。

**確認B（トークンなし。② に直接）**：
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"planner","roll":"ledger_link"}'
```
- `認証が必要です。`（401）ならよいです。
- ⚠️ 404 なら、② に v2.2.248 が入っていません。

### 手順2　【① FTP】PHP 1ファイル
| ① の場所 | 元のファイル |
|---|---|
| `/dashboard/api/gateway/core/express_proxy.php` | `backend/src/core/express_proxy.php` |

確認（トークンなし。① を通す）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"planner","roll":"ledger_link"}'
```
- `認証が必要です。`（401）なら、① から ② まで届いています。
- ⚠️ 404（該当する処理がありません）なら、① の許可リストが古いままです。PHP のアップロードを確かめてください。

### 手順3　【① フロント】いつもの手順
⚠️ `frontend/build/` に v2.2.247 のビルドが残っているときは、v2.2.248 のブランチで `npm run build` をやり直してから上げてください。

### 手順4　【① SQL】
phpMyAdmin で `2026-11-05_update_log_2.2.248.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.248 で、1行だけならよいです。

## 終わったら（動作確認）
1. 「売り反響」で「🔗 媒介紐付」を押すと、満了日のある登録の画面が開く
   - 媒介の種類は専属専任媒介／専任媒介／一般媒介
   - **確かめたらキャンセルで閉じる**
2. 必須の項目を空にして「登録」を押すと、赤で項目の名前が出て止まる（何も保存されない）
3. 「今日の架電キュー」の「開く」で売り反響の編集画面を開くと、段階に「媒介受託」が無く、案内が出る
4. 版の表示が ver2.2.248

⚠️ 本番で試すときは、実際の売り反響で「登録」を押さないでください。台帳が本当に作られ、反響が媒介受託になります。

## 注意
- 媒介紐付で作った台帳を間違えたときは、次の2つを直します。
  - 媒介獲得台帳の編集画面から台帳を削除する
  - 売り反響の編集画面で、段階を戻す
- 仕様書の「取消」（作った台帳を削除せず、取消にする）は、まだありません。
- 架電キュー・チームサマリーで媒介受託を選べなくしたのは、仕様書の「段階だけが先に変わって台帳が無い状態を作らない」に合わせたためです。すでに媒介受託で台帳の無い反響（以前のデータ）は、売り反響の一覧に「未転記→台帳へ」と出ます。

## 切り戻し
- ① フロントを v2.2.247 に戻す（媒介紐付は、v2.2.247 の画面から保存する形に戻ります）
- ① PHP・② はそのままで問題ありません（新しい処理は呼ばれなくなるだけです）
