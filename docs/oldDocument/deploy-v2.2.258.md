# デプロイ手順 v2.2.258　媒介獲得台帳 ⇔ いえらぶの物件 ⇔ 買い反響のつながり

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 台帳の列 `property_db_match`（いえらぶの物件のつなぎ方）を足す | ① DB `backend/scripts/sql/2026-11-10_realty_property_db_match.sql` |
| 2 | 突き合わせの処理（30分ごと・台帳の保存の直後）、候補・今すぐ突き合わせの口 | ② VPS（backend-express） |
| 3 | 新しい口を ② へ転送する許可リスト | ① PHP `backend/src/core/express_proxy.php` |
| 4 | 媒介獲得台帳の札・絞り込み・ボタン、台帳の編集画面（候補・外す・該当なし・コピー）、買い反響の検索欄 | ① フロント（Dashboard） |
| 5 | 更新履歴・業務ガイドの記事「反響から商談案件へのつながり（不動産企画係）」 | ① DB `backend/scripts/sql/2026-11-10_update_log_2.2.258.sql` |

- `projects/sync`・GAS・① の取り込みの PHP（`handlers/portal/*`・`property_db_update.php`）は変わりません。
- ⚠️ ② を更新すると、**1分後に、本番の台帳と買い反響の自動の紐づけが始まります**。以後は30分ごとです。
  - ローカルの例：台帳196件のうち100件と、買い反響67件がつながりました。
  - つなぐのは、台帳・買い反響の**空の欄だけ**です。すでに入っている値は変えません。

## 順序
```
0. GitHub で v2.2.258 を production へマージ（PR）
1. ① SQL：2026-11-10_realty_property_db_match.sql      ← ⚠️ いちばん先（② がこの列を使う）
2. ② VPS（backend-express）を更新して再起動
3. ① PHP：backend/src/core/express_proxy.php を上げる
4. ① Dashboard のフロント
5. ① SQL：2026-11-10_update_log_2.2.258.sql            ← ⚠️ 1回だけ
```
⚠️ 1 より先に 2 を行うと、② の突き合わせと台帳の保存が「列が無い」で失敗します。台帳の保存そのものは成功します。

### 手順1　【① SQL】列を足す
phpMyAdmin で `2026-11-10_realty_property_db_match.sql` を流します（何回流しても同じです）。
- 最後の `SHOW COLUMNS` に `property_db_match` の1行が出ればよいです。

### 手順2　【② VPS】backend-express を更新
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
確認（② に直接。トークン無し）:
```bash
curl -s -X POST https://api.khg-marketing.info/api/gateway -H 'Content-Type: application/json' -d '{"request":"broker","roll":"ielove_candidates"}'
```
- `認証が必要です。`（401）ならよいです。

1分ほど待ってから、突き合わせが動いたかをログで見ます。
```bash
dcp logs --since 5m express-api | grep いえらぶ
```
- `realty: いえらぶの突き合わせ（台帳 N 件・買い反響 N 件をつないだ）` が出ればよいです。
- 何も出ないとき：
  - つなぐものが無かった場合も、何も出ません。
  - `いえらぶの突き合わせに失敗しました` が出たら、手順1の列があるかを確かめてください。

### 手順3　【① PHP】express_proxy.php
`backend/src/core/express_proxy.php` を、サーバーの `dashboard/api/gateway/core/express_proxy.php` に上げます（上書き）。
確認（トークンなし。① 経由）:
```bash
curl -s -X POST https://khg-marketing.info/dashboard/api/gateway/ -H 'Content-Type: application/json' -d '{"request":"broker","roll":"ielove_candidates"}'
```
- `認証が必要です。`（401）ならよいです。404（該当する処理がありません）なら、express_proxy.php が古いままです。

### 手順4　【① Dashboard のフロント】いつもの手順
v2.2.258 のブランチで `npm run build` をし直してから上げてください。

### 手順5　【① SQL】更新履歴・業務ガイド
phpMyAdmin で `2026-11-10_update_log_2.2.258.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```
一番上が 2.2.258 で、1行だけならよいです。

## 終わったら（動作確認）
1. 媒介獲得台帳を開く → 右端の近くの「ポータル連携（いえらぶ）」の列に、札が出る
   - 札の種類：「No.〇〇〇〇〇〇」「要確認 N件」「いえらぶ未採番」
2. 上の「⑥ いえらぶ」で「要確認」を選ぶ → 札を押す → 編集画面に、いえらぶの物件の候補が出る
   - 確かめるだけなら「キャンセル」で閉じます。
3. 編集画面の「所在地をコピー」を押す → 「所在地をコピーしました」と出る
4. 買い反響（ポータル）を開く → ポータルの反響に「📝No.〇」の札が増えている
5. Dashboard の版の表示が ver2.2.258

## 現場へのお願い（業務ガイドに書いたルール）
- いえらぶに物件を登録するときは、台帳の編集画面の「所在地をコピー」「建物名をコピー」で、**貼り付けて**入力する。
- 「要確認」の台帳は、編集画面で候補から選んで保存する。いえらぶに載せない物件は「該当なし」にして保存する。

## 切り戻し
- ② を前の版に戻すと、自動の紐づけは止まります。それまでにつないだ値は残ります。
  - 戻したいときは、`property_db_match = 'auto'` の台帳の `property_db_id`・`property_db_name` と、記録（`logs` の by が「自動（いえらぶ突き合わせ）」）を見て判断します。
- 列 `property_db_match` は残しても害はありません。
