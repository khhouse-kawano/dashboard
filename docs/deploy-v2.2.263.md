# デプロイ手順 v2.2.263　SUUMO（建売）の反響を、反響ごとに取り込む

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | 新しい表 `suumo_action_kaeru`・更新履歴・業務ガイドの記事「反響一覧（建売営業）」 | ① DB `backend/scripts/sql/2026-11-11_suumo_action_kaeru.sql` |
| 2 | 新しい取り込み口 `suumo_kaeru:actions`（sync から直接。合い言葉 `SYNC_LOG_SECRET`） | ② VPS（backend-express） |
| 3 | `suumo_db_kaeru.php`：顧客ごとの CSV から反響一覧に足すのをやめる | ① PHP |
| 4 | 版の表示 ver2.2.263 | ① フロント |
| 5 | `runSuumoKaeru.ts`：顧客 → 反響の順に2つの CSV を落とし、**過去3日の分だけ**送る | sync（Heroku。ブランチ `suumo-actions`） |

- ⚠️ **新しい鍵はありません。** v2.2.259 の `SYNC_LOG_SECRET`（② の `.env.prod` と Heroku の Config Vars）をそのまま使います。
  - まだ入れていない場合は、先に v2.2.259 の手順（`docs/deploy-v2.2.259.md`）で入れてください。未設定だと、反響は1件も入らず、「同期の実行結果」に「SYNC_LOG_SECRET が未設定です」と残ります。
- ⚠️ `docker-compose.prod.yml` は変えていません（`SYNC_LOG_SECRET` は v2.2.259 で渡してあります）。

## 順序
```
0. GitHub で v2.2.263 を production へマージ（PR）
1. ① SQL：2026-11-11_suumo_action_kaeru.sql      ← ⚠️ 1回だけ。② より先
2. ② VPS：git pull → 作り直し
3. ① PHP（backend/src）と フロント（npm run build）
4. sync：ブランチ suumo-actions をビルドして main へ → Heroku へ push
5. 過去の分を1回だけ入れる（SUUMO_KAERU_DAYS=all）
```
- どの順でも、同じ反響が2行になることはありません（② は、顧客の「初回の反響」に以前の行があれば足しません）。
- ただし 3 を上げてから 4 を上げるまでのあいだは、SUUMO の新しいお客様が反響一覧に出ません。**3 と 4 は続けて**行ってください（出なかった分は、5 か、次の実行の「過去3日」で入ります）。

### 手順1　【① SQL】
phpMyAdmin で `2026-11-11_suumo_action_kaeru.sql` を **1回だけ**流します。
```sql
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 2;
SELECT COUNT(*) FROM suumo_action_kaeru;
```
- 一番上が 2.2.263 で、1行だけならよいです。
- 2つ目は 0 が返ればよいです（表ができている）。

### 手順2　【② VPS】
```bash
cd ~/dashboard && git pull
docker compose -f docker-compose.prod.yml up -d --build express-api
docker compose -f docker-compose.prod.yml logs express-api | grep "suumo_kaeru"
```
- 起動時のルートの一覧に `suumo_kaeru:actions` が出ればよいです。
- 外から確かめる（合い言葉が違うので 401 が正しい）：
```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"request":"suumo_kaeru","roll":"actions","key":"x","rows":[]}' \
  https://api.khg-marketing.info/api/gateway
# → {"status":"error","message":"合い言葉が正しくありません"}
```

### 手順3　【① PHP・フロント】
- `backend/src/handlers/suumo_db_kaeru.php` を上げます（いつもの backend/src の上げ方）。
- フロントは `npm run build` して `build/` の中身を上げます（変わるのは版の表示だけ）。

### 手順4　【sync】
- ブランチ `suumo-actions`（`src/utils/suumoKaeruCsv.ts` の追加と `src/services/runSuumoKaeru.ts` の変更）を、いつもどおりビルドして dist ごとコミットし、Heroku へ push します。
- 環境変数（Heroku の Config Vars）
  - `SYNC_LOG_SECRET`：v2.2.259 で入れたもの（必須）
  - `SUUMO_KAERU_DAYS`：**入れない**（入れなければ 3日）

### 手順5　【過去の分を1回だけ】
過去3日より前の反響（今は入っていない、同じお客様の2回目以降の反響など）を入れます。
```bash
heroku config:set SUUMO_KAERU_DAYS=all -a <sync のアプリ名>
# suumo_kaeru のタスクを1回だけ動かす（いつもの呼び出し。targetTasks に suumo_kaeru）
heroku config:unset SUUMO_KAERU_DAYS -a <sync のアプリ名>
```
- ⚠️ **終わったら必ず unset** してください（付けたままだと、毎回すべての行を送り続けます。害はありませんが、3日の絞り込みが効きません）。
- Heroku のログに次のように出ます（数は 2026-11-11 の CSV をローカルに入れたときのもの。本番は少し違います）。
```
[SUUMO 顧客] CSV 574件 → 送る 574件（すべて）
[SUUMO 反響] CSV 731件 → 送る 731件（すべて）
[SUUMO 反響] 結果 {"received":731,"saved":731,"added":167,"alreadyListed":0,"legacyRow":538,"canceled":26,"cancelMarked":24,"unmatched":0,"invalid":0}
```
  - `added`：反響一覧に新しく足した行 / `legacyRow`：以前の行（お客様ごとの最初の1行）があるので足さなかった / `canceled`：キャンセルなので足さなかった / `cancelMarked`：以前の行の備考に「予約キャンセル」を付けた / `unmatched`：どのお客様の反響か決められなかった（足すが、「同じお客様」の印は付かない）

## 終わったら（動作確認）
1. ① SQL
```sql
SELECT COUNT(*) AS actions, SUM(customer_id IS NULL) AS unmatched FROM suumo_action_kaeru;
SELECT COUNT(*) FROM inquiry_customer_kaeru WHERE inquiry_id LIKE 'suumo\_act\_%';
-- 二重が無いこと（0 が正しい）
SELECT COUNT(*) FROM suumo_db_kaeru c
  JOIN inquiry_customer_kaeru l ON l.inquiry_id = CONCAT('suumo_', c.customer_id)
  JOIN inquiry_customer_kaeru n ON n.inquiry_id IN (CONCAT('suumo_act_', c.first_reaction_id), CONCAT('suumo_act_', c.first_reaction_reserve_id));
```
2. 事業を「建売営業」にして「反響一覧」
   - SUUMO の行が増えている（同じお客様の行が複数ある）
   - 2回目以降の行の備考（虫めがね）の先頭に「【同じお客様の反響あり】初回 …・これまで n件・顧客DBに取込済み／未取込」
3. システム管理 →「同期の実行結果」で `suumo_kaeru` が成功（失敗なら理由が出ます）
4. Dashboard の版の表示が ver2.2.263

## 切り戻し
- sync を前の版に戻し、① の `suumo_db_kaeru.php` も前の版に戻します（**両方を一緒に**）。
- ⚠️ ① だけ戻して新しい sync を残しても二重にはなりませんが、sync だけ戻して ① を残すと、SUUMO の新しいお客様が反響一覧に出なくなります。
- ⚠️ 戻したあとは、すでに `suumo_act_` の行があるお客様に、以前の形の行（`suumo_<顧客ID>`）がもう1行できることがあります。戻す前に相談してください。
- 表 `suumo_action_kaeru` と、足した行は残しておいて害はありません。

## 知っておくこと
- 送るのは「受付日時」か「キャンセル日時」が過去3日の反響と、「登録日時」「最新反響の受付日時」「追客状況の最終更新日時」のどれかが過去3日のお客様だけです。**取り込みが3日より長く止まったとき**は、手順5 と同じやり方（`SUUMO_KAERU_DAYS` を止まっていた日数より大きく）で1回動かしてください。
- 見学の予約をして、次の取り込みまでにキャンセルされた反響は、反響一覧に出ません（運用の決定）。
- ① の `suumo_db_kaeru`（顧客ごとの CSV の口）は、今回もログインの確認がありません（将来の課題）。
