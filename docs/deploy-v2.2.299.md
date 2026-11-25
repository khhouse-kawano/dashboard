# デプロイ手順 v2.2.299　フォーム作成のイベントをイベントカレンダー（全社）と結び付ける・顧客情報の SUUMO の注意書き

| # | 何が変わるか | どこ |
|---|---|---|
| 1 | `event_form` に `calendar_id`（どのカレンダーのイベントか）を足す。更新履歴1行・業務ガイド「イベントのフォーム作成」「顧客DB」 | ① DB `backend/scripts/sql/2026-11-25_update_log_2.2.299.sql` |
| 2 | フォーム作成で選べるイベントを `event_calendar` の `shop = 'khg'`・`flag = 1` にする。「新しく追加する」は開始日・終了日・名前でカレンダーに1行入れる（url が空ならフォームの URL を入れる）。反響一覧の名前は「開始日_イベント名」。公開フォームの開催日は開始日〜終了日 | ② VPS（features/eventForm/calendar.ts（新規）・admin.ts・public.ts） |
| 3 | フォーム作成の画面（上の2に合わせる。新しいフォームの「反響の通知先（To）」の初期値を `mkt@kh-house.jp` にする）。顧客情報の SUUMO の注意書きを、注文で `portal_site` が SUUMO の顧客だけにする | Dashboard（frontend の build） |

- ⚠️ v2.2.298 までを先に済ませてください。
- ① PHP・公開フォーム（`public_html/form/`）の変更はありません。
- ⚠️ ② と画面は**続けて**上げてください。② だけ新しく画面が古いあいだは、フォーム作成の「今あるイベントから選ぶ」が空になり、保存できません（公開フォームと申し込みはそのまま動きます）。

## 順序
```
1. GitHub で v2.2.299 を production へマージ（PR）
2. ① SQL：2026-11-25_update_log_2.2.299.sql   ← ⚠️ 1回だけ（表の部分は何度流しても安全。更新履歴の行だけ増える）
3. ② VPS
4. Dashboard の画面を build してアップロード（② のすぐあとに）
```

### 手順2　【① SQL】
```bash
mysql < 2026-11-25_update_log_2.2.299.sql
```
確認：
```sql
SHOW COLUMNS FROM event_form LIKE 'calendar_id';
SELECT no, version, date FROM update_log ORDER BY no DESC LIMIT 3;
```
- `calendar_id` の1行と、`2.2.299` の行が出ればよいです。

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
- `git log` が v2.2.299 のマージのコミットならよいです。`STATUS` が `Up` のまま続けばよいです（`Restarting` なら `dcp logs --tail 60 express-api`）。
- ⚠️ `git pull` は使わない。⚠️ `dcp` を使う。

### 手順4　【Dashboard の画面】
いつもどおり build して、アップロードします。
- 変えたファイル：
  - `src/components/header/event/EventFormBuilder.tsx`
  - `src/components/information/InformationEdit.tsx`
  - `src/utils/version.ts`

## 終わったら（動作確認）
1. 「集客イベント → フォーム作成」→「新しいフォームを作る」：
   - 「イベントカレンダーから選ぶ」に、カレンダーの全社イベントが「2026-12-05〜12-06　UMK住まい博in都城」の形で、開始日の新しい順に並ぶ。
   - 「反響の通知先（To）」に最初から `mkt@kh-house.jp` が入っている。
2. v2.2.298 で作ったフォームがあれば「編集」を開き、「今のイベント名は…選び直してください」と出ることを確かめ、カレンダーのイベントを選んで保存する。
   - そのフォームの URL を開くと、開催日が「開始日〜終了日」で出る。
   - カレンダーでそのイベントの「URL」が空だったなら、フォームの URL が入っている。
3. 「新しく追加する」を試すときは、カレンダーにも全社イベントとして入ります（試したあとは、カレンダーで非表示にするか消してください）。
4. 注文の顧客DB で、「SUUMO(ポータル反響)」で絞り込んだお客様を開くと、反響媒体の下に赤い注意書きが出る。反響媒体だけ SUUMO のお客様（ポータル反響で絞り込んでも出ないお客様）には出ない。

## 確認したこと（ローカル）
- 反響一覧の「同期」で、イベント名（例：2099-04-04_テスト住まい博）が顧客DB の `customized_input_01JRCT12N9X24PCQ5QZPAYKB93` に入る（2026-11-25 に画面の同期ボタンから確認）。この列は ② の取り込みの許可リストにあり、注文・建売・中古の3つの表にある。この版では変えていない。

## 切り戻し
- 画面と ② を前の版に戻すと、フォーム作成は「反響一覧のイベント名から選ぶ」に戻ります。SUUMO の注意書きは「反響媒体が SUUMO」に戻ります。
- `calendar_id` の列は残しても構いません（前の版は読みません）。
- 「新しく追加する」で入れたカレンダーのイベントは、そのまま残ります。
