# デプロイ手順 v2.2.271　キャンセル集計から削除依頼の顧客を除く／顧客DB（注文・建売）を軽くする

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 顧客DB（注文・建売）が、新旧どちらの形の応答でも読めるようになる。絞り込みの総当たりをやめる | ① フロント（Dashboard） |
| 2 | 来場キャンセルリスト・メニューのキャンセル件数・毎日の確認「来場日未入力」から、個人情報の削除依頼の顧客を除く | ① PHP `backend/src/handlers/` の `cancelList.php`・`cancelList_edit_reason.php`・`menu.php`・`daily_action.php` |
| 3 | 顧客DB の応答を「列名1回＋値の並び」に・使わない列を外す・Hotlead は件数だけ・家族は名前（建売は id）だけ。menu・daily_action の除外も | ② VPS（backend-express） |
| 4 | 更新履歴・業務ガイド2本（顧客DB・毎日の確認） | ① DB `backend/scripts/sql/2026-11-16_update_log_2.2.271.sql` |

- 表の変更・`.env.prod` の変更はありません。

## ⚠️ 順序（必ずこの順）
```
0. GitHub で v2.2.271 を production へマージ（PR）
1. ① Dashboard のフロント（npm run build → アップロード）   ← ⚠️ ② より先
2. ① PHP 4ファイルのアップロード
3. ② VPS：fetch・checkout → 作り直し
4. ① SQL：2026-11-16_update_log_2.2.271.sql               ← ⚠️ 1回だけ
```
- ⚠️⚠️ **② をフロントより先に更新しないこと。** 古いフロントは新しい ② の応答（列名＋値の並び）を読めず、**顧客DB（注文・建売）が開かなくなります。** 新しいフロントは新旧どちらの形でも読めるので、フロント → ② の順なら途中で壊れません。
- 利用者のブラウザに古い画面が残っていると同じことが起きます。② の更新は、フロントを上げて版の表示が 2.2.271 になったのを確かめてからにしてください。

### 手順1　【① フロント】
いつもどおり `npm run build` してアップロードします。画面左上の版が 2.2.271 になればよいです。

### 手順2　【① PHP】
次の4ファイルを ① の同じ場所へアップロードします（上書き）。
- `backend/src/handlers/cancelList.php`
- `backend/src/handlers/cancelList_edit_reason.php`
- `backend/src/handlers/menu.php`
- `backend/src/handlers/daily_action.php`

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
- `git log` が v2.2.271 のマージのコミットならよいです。
- `STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない（VPS はブランチに付いていない形なので失敗し、古いコードのまま作り直される）。⚠️ `dcp` を使う（`docker compose -f` だけだと `.env.prod` が渡らず ② が起動しない）。

### 手順4　【① SQL】
phpMyAdmin で `2026-11-16_update_log_2.2.271.sql` を **1回だけ**流します（更新履歴1行＋業務ガイド2本）。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
SELECT title, updated_at FROM guide_article WHERE title IN ('顧客DB', '毎日の確認（要確認）');
```

## 終わったら（動作確認）
- 顧客DB（注文）：開ける。件数・名前検索・家族名検索・Hotlead の絞り込みが今までどおり。Hotlead 欄に 電話/メール/SMS の件数が出る。
- 顧客DB（建売）：開ける。ふりがな検索・家族情報の絞り込みが今までどおり。
- ブラウザの開発者ツール（Network）で `database` の応答が小さくなっている（注文 約28MB → 約10MB）。
- 「キャンセル集計」の要回答の件数と、メニューのキャンセルの件数が同じ。

## 切り戻し
- ② だけ前の版に戻せば、応答は従来の形に戻ります（新しいフロントはそのまま読めます）。
- フロントを前の版に戻すときは、**先に ② を前の版に戻してから**にしてください（逆にすると顧客DB が開かなくなります）。

## 知っておくこと
- ⚠️ **① の `database_order.php`（② が落ちたときの予備）は、今回とは関係なくもともと動いていません。** ローカルで PHP のメモリ上限（128MB）を超えて落ちることを確認しました（応答 28MB を作るため）。本番の上限 256MB でも余裕はありません。今回は触っていません（必要なら別の版で、中古の `database_used.php` と同じように軽くします）。
- 建売の予備（`database_spec.php`）は動きます。画面は従来の形でも同じ件数で出ることを確認済み。
- 読み込みの時間の大半は ② の**ギフト判定**（面談記録を全件読む処理）で、ローカルで 6〜8秒かかっています。今回の変更では短くなっていません。
