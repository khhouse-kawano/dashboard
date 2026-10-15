# v2.2.176 中古住宅専門店の来場予約（GAS）から取り込む反響に category = 買い:中古リノベ

## 依頼
- GAS（runReserveResale → `request: 'reserve_resale_update'`）から POST されたとき、inquiry_customer_resale の category に `買い:中古リノベ` を登録する
- ⚠️ 利用者の指示: バックエンド改修は v2.2.176 で（v2.2.175 はそのままデプロイ）

## 流れ（変更前から）
1. GAS → ① `handlers/reserve_resale_update.php` が `reserve_resale` に INSERT IGNORE
2. 同ファイルの最後で `handlers/portal/reserve_resale.php` を require → `reserve_resale` から `inquiry_customer_resale` へ INSERT IGNORE（inquiry_id = `hp_resale_` + no）
- ⚠️ ② への転送は無い（① だけ）。GAS 側は変更不要。

## 変更
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| `backend/src/handlers/portal/` | **reserve_resale.php** | INSERT の列に `category`、SELECT に `'買い:中古リノベ'` |
| `backend/scripts/sql/` | **2026-10-08_inquiry_resale_hp_category.sql**（新規・任意） | 既存の hp_resale_ 行で category が空のものを埋める（⚠️ ローカルでも流していない） |
| `backend/scripts/sql/` | **2026-10-08_update_log_2.2.176.sql**（新規） | 更新履歴（ローカル no=272） |
| `frontend/src/utils/` | **version.ts** | 2.2.176 |

## 確認（ローカル）
- `php -l` OK
- reserve_resale にテスト行を1件入れて portal/reserve_resale.php を実行 → `hp_resale_3097` が **category = 買い:中古リノベ**（brand 中古住宅専門店、hp_campaign TESTEVENT）。テスト行は両テーブルから削除した
- ⚠️ 既存の hp_resale_ 行（category 空 8件）は INSERT IGNORE のため変わらない → 任意の SQL で埋める
- フロント build OK（main.8ba1a392.js。版の数字だけ）

## 差分
```diff
diff --git a/backend/src/handlers/portal/reserve_resale.php b/backend/src/handlers/portal/reserve_resale.php
index 40dfd585..68e876ae 100644
--- a/backend/src/handlers/portal/reserve_resale.php
+++ b/backend/src/handlers/portal/reserve_resale.php
@@ -16,7 +16,8 @@ $sql = "INSERT IGNORE INTO inquiry_customer_resale
             reserved_time,
             brand,
             hp_campaign,
-            note
+            note,
+            category
             )
         SELECT 
             CONCAT('hp_resale_', no),                  -- 重複防止のため固有の接頭辞＋AUTO_INCREMENTのno
@@ -33,8 +34,12 @@ $sql = "INSERT IGNORE INTO inquiry_customer_resale
             `time`,                                    -- ご来店・参加希望時間
             '中古住宅専門店',
             event,                            -- 他のフォームと区別するためのキャンペーン名
-            remarks                                    -- 全項目を網羅した詳細テキスト
-        FROM 
+            remarks,                                   -- 全項目を網羅した詳細テキスト
+            -- ⚠️ v2.2.175: 取引区分。⚠️ 中古住宅専門店（ask@chuko-senmon.jp）の来場予約は 買い:中古リノベ。
+            --   ⚠️ 要確認（daily_action）の中古の未同期は category = 買い:中古リノベ だけを数えるため、
+            --   ⚠️ 空のままだと ⚠️ **未同期に出てこない**。
+            '買い:中古リノベ'
+        FROM
             reserve_resale
         WHERE
             `name` IS NOT NULL AND `name` != ''";
```
