# デプロイ手順 v2.2.269　中古の顧客DBが開けない（メモリ不足）・セキュリティログが重い

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 中古の顧客DBの最初のデータを、画面が使う分だけにする（約56MB → 約2MB）。「Allowed memory size … exhausted」で落ちていたのを直す | ① PHP `backend/src/handlers/databaseAction/database_used.php` |
| 2 | セキュリティログの表を100行ずつ表示（下までスクロールすると次の100行）、版の表示 2.2.269 | ① フロント（Dashboard） |
| 3 | 更新履歴・業務ガイドの記事「セキュリティログ」 | ① DB `backend/scripts/sql/2026-11-14_update_log_2.2.269.sql` |

- ⚠️ **② VPS の変更はありません**（中古の顧客DBは ① の PHP だけが処理している）。`.env.prod` の変更もありません。
- ⚠️ 表の変更はありません。

## 順序
```
0. GitHub で v2.2.269 を production へマージ（PR）
1. ① PHP：backend/src/handlers/databaseAction/database_used.php   ← 中古の顧客DBはこれだけで直る
2. ① Dashboard のフロント（npm run build）
3. ① SQL：2026-11-14_update_log_2.2.269.sql      ← ⚠️ 1回だけ
```

### 手順1　【① PHP】
`backend/src/handlers/databaseAction/database_used.php` をアップロードします。

### 手順2　【① フロント】
いつもどおり `npm run build` してアップロードします。

### 手順3　【① SQL】
phpMyAdmin で `2026-11-14_update_log_2.2.269.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
```

## 終わったら（動作確認）
1. 中古リノベの人（または担当事業を中古にした Master）で「顧客DB」を開く → 一覧が出る。「初回通電日」「次回架電日」などが今までどおり入っている。
2. 「システム管理 → セキュリティログ」→ 表は100行。表の下までスクロールすると「200 / ○○ 行を表示中」と増える。
3. ① のエラーログに `database_used.php … Allowed memory size` が出なくなる。

## 切り戻し
- `database_used.php` を前のものに戻すと、元の（56MB の）データに戻ります（メモリ不足も戻ります）。

## 知っておくこと
- 中古の顧客DBが送っていたもの（ローカルの本番の写しで計測）
  - 架電記録：全事業の 19,165行・約41MB → 中古の顧客の 1,877行・約0.3MB（通電・架電・次回架電日の日付だけ）
  - 家族情報：全項目 約2MB → ID だけ 約0.1MB
  - 媒介：全種類 3,153行・約9MB → 画面と同じ条件（媒介台帳・表示中・顧客IDあり）だけ
  - 合計 約56MB・11秒 → 約2.2MB・1.4秒（① を通した時間）
- 画面に出る日付（初回通電日・最終架電日・次回架電日）は、全 2,767人で前と1件も変わらないことを確かめました。
