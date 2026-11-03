# デプロイ手順 v2.2.234　アクセス解析の「業者別」を DAY JUST HOUSE にも

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 「業者別」ボタンを DAY JUST HOUSE（brand djh）のサイトにも出す（国分ハウジングと合わせて2ブランド） | ① フロント |
| 2 | 更新履歴・業務ガイド「アクセス解析」 | ① DB `backend/scripts/sql/2026-10-30_update_log_2.2.234.sql` |

⚠️ ② と ① の PHP の変更は**ありません**。表の変更もありません。

## 順序
```
0. GitHub で v2.2.234 を main → production へマージ
1. ① フロント（いつもの手順）
2. ① SQL（更新履歴・業務ガイド）
```

### 手順2　【① SQL】更新履歴・業務ガイド
phpMyAdmin、または ① に SSH で入って:
```bash
mysql --default-character-set=utf8mb4 -h <MySQLホスト名> -u <MySQLユーザー> -p <DB名> < ~/2026-10-30_update_log_2.2.234.sql
```
（ファイルは先に scp で ① のホームへ送り、流し終えたら消す）

## 終わったら（動作確認）
- アクセス解析 → 国分ハウジング・DAY JUST HOUSE → 流入元：「PV」「CV」「業者別」の3つ
- ほかのサイト（かえるホーム・なごみ工務店・PG HOUSE など）→ 流入元：「PV」「CV」の2つだけ
