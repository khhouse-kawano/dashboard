# デプロイ手順 v2.2.168

⚠️⚠️ **v2.2.167 を先に出してあることが前提です**（⚠️ 2026-10-06 時点でデプロイ済みと確認）。

⚠️⚠️ **作業中の版です。** ⚠️ 今の時点で出せるのは ⚠️ **① DB（表の追加と初期データ）だけ**です。
⚠️ API・画面は未実装のため、⚠️ 版が完成したらこの手順書を書き足します。

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | ⚠️ 住宅ローン金利の表を2つ追加（⚠️ `loan_product` 商品 ／ `loan_rate` 金利の履歴） | ⚠️ **① DB** |
| 2 | ⚠️ 今の計画書（funding-plan）の内蔵金利 ⚠️ **33商品**を初期データとして投入 | ① DB |
| 3 | 更新履歴に1行増える | ① DB |

⚠️ ⚠️ **既存の表は変えません**（⚠️ 新規2表のみ）。⚠️ この時点では ⚠️ **どの画面も新しい表を読みません**（⚠️ 出しても動きは変わらない）。

---

## 順序

```
1. ① SQL（2026-10-06_loan_rate.sql：表を作る）
2. ① SQL（2026-10-06_loan_rate_seed.sql：初期データ）   ← ⚠️ 1 のあと
3. ① SQL（2026-10-06_update_log_2.2.168.sql）
```

---

## 手順1　【① レンタルサーバー／phpMyAdmin】表を作る

⚠️ ファイル: `backend/scripts/sql/2026-10-06_loan_rate.sql`

⚠️ 最後の `SHOW CREATE TABLE` が2つとも結果を返せば完了。
⚠️ `CREATE TABLE IF NOT EXISTS` なので ⚠️ 2回流しても壊れません。

---

## 手順2　【① レンタルサーバー／phpMyAdmin】初期データ

⚠️ ファイル: `backend/scripts/sql/2026-10-06_loan_rate_seed.sql`

⚠️ 最後の確認が ⚠️ **loan_product 33 ／ loan_rate 33** なら完了。
⚠️ `INSERT IGNORE` なので ⚠️ 2回流しても増えません。

---

## 手順3　【① レンタルサーバー／phpMyAdmin】更新履歴

⚠️ ファイル: `backend/scripts/sql/2026-10-06_update_log_2.2.168.sql`

```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```

⚠️ 一番上が `2.2.168` なら完了。
⚠️ 文言は作業の進み具合で書き換える予定です（⚠️ 版の完成時に確定）。

---

## ⚠️ 切り戻し

⚠️ どの画面も読んでいないので、⚠️ **残しておいて害はありません。**
⚠️ 消す場合は利用者に確認のうえ `DROP TABLE loan_rate; DROP TABLE loan_product;`（⚠️ 履歴も消えます）。
