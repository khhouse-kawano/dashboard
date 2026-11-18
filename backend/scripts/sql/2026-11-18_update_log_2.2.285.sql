-- =====================================================================
-- v2.2.285 オーナーズハウスの画像を ② に引っ越し、14枚まで登録できるようにする ＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（mysql / phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- ⚠️ v2.2.284 を先に流しておくこと。⚠️ ② を上げる前に流すこと（img_6〜img_14 が無いと物件の読み込みが落ちる）。
-- ⚠️ 画像のファイルそのものの引っ越しは、② を上げたあとに VPS で引っ越しのコマンドを1回実行する（docs/deploy-v2.2.285.md）。
--
-- 画像の名前の決まり（2026-11-18 決定）：<物件ID>/<物件ID>_<枠番号2桁>_<中身から作る6文字>.<jpg|png|webp>
--   例 00000002/00000002_01_3f9a1c.jpg。置き場は ② の owners-house-img ボリューム、公開は https://api.khg-marketing.info/owners_house/img/
--   ⚠️ 列にはファイル名だけを入れる。http で始まる値は引っ越し前の kh-house.jp の URL（② がそのまま返す）。
--   ⚠️ 1〜4 がメイン（1 は一覧・地図のサムネイル）、5〜14 は物件ページの下のカルーセル。
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.285', '2026-11-18', 'オーナーズハウスの画像を、管理画面から14枚まで登録できるようにしました（メイン4枚＋カルーセル10枚）。今の画像は新しい置き場に引っ越しました。');

ALTER TABLE ownershouse
  MODIFY img_1 text NOT NULL COMMENT '画像1（メイン。一覧のサムネイル・地図の吹き出し）。ファイル名（<ID>/<ID>_01_xxxxxx.jpg）。http で始まる値は引っ越し前の URL',
  MODIFY img_2 text NOT NULL COMMENT '画像2（メイン）。ファイル名。http で始まる値は引っ越し前の URL',
  MODIFY img_3 text NOT NULL COMMENT '画像3（メイン）。ファイル名。http で始まる値は引っ越し前の URL',
  MODIFY img_4 text NOT NULL COMMENT '画像4（メイン）。ファイル名。http で始まる値は引っ越し前の URL',
  MODIFY img_5 text NOT NULL COMMENT '画像5（カルーセル）。ファイル名。http で始まる値は引っ越し前の URL',
  ADD COLUMN img_6 text NOT NULL DEFAULT '' COMMENT '画像6（カルーセル）。ファイル名' AFTER img_5,
  ADD COLUMN img_7 text NOT NULL DEFAULT '' COMMENT '画像7（カルーセル）。ファイル名' AFTER img_6,
  ADD COLUMN img_8 text NOT NULL DEFAULT '' COMMENT '画像8（カルーセル）。ファイル名' AFTER img_7,
  ADD COLUMN img_9 text NOT NULL DEFAULT '' COMMENT '画像9（カルーセル）。ファイル名' AFTER img_8,
  ADD COLUMN img_10 text NOT NULL DEFAULT '' COMMENT '画像10（カルーセル）。ファイル名' AFTER img_9,
  ADD COLUMN img_11 text NOT NULL DEFAULT '' COMMENT '画像11（カルーセル）。ファイル名' AFTER img_10,
  ADD COLUMN img_12 text NOT NULL DEFAULT '' COMMENT '画像12（カルーセル）。ファイル名' AFTER img_11,
  ADD COLUMN img_13 text NOT NULL DEFAULT '' COMMENT '画像13（カルーセル）。ファイル名' AFTER img_12,
  ADD COLUMN img_14 text NOT NULL DEFAULT '' COMMENT '画像14（カルーセル）。ファイル名' AFTER img_13;

-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- order/screen-170.md：オーナーズハウス
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'オーナーズハウス';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('オーナーズハウス', 'order', '画面の使い方', 'オーナーズハウス・モデルハウスの物件の管理（サイトに出す内容と地図の位置）。', '左のメニュー「オーナーズハウス」（注文営業・PC のみ）。オーナーズハウスのサイト（kh-house.jp/owners_house/）に出す物件を管理する画面です（2026年11月から）。

[[画面:オーナーズハウス]]

## 一覧
- 上に、物件の数・公開中・オーナーズハウス・モデルハウス・ピン未設定の数が出ます
- 種別・公開・都道府県・キーワード（ID・見出し・所在地・店舗・タグ）で絞り込めます
- 一覧は30件ずつ出ます。下までスクロールすると、続きの30件が出ます
- 地図のピンがまだない物件には「ピン未設定」と出ます

## 物件を直す
一覧の行を押すと、物件の内容を直す画面が開きます。直したら「保存する」を押します。
- **公開**：チェックを入れた物件だけがサイトに出ます。外すとサイトから消えます（物件は残ります）
- **都道府県・市区町村**：一覧から選びます。サイトには「県」「市」などを抜いた名前（例 霧島）で出て、エリアの絞り込みに使われます
- **管理店舗**：注文事業の店舗から選びます。選ぶとブランドも自動で入ります（見学予約の通知先が決まります）
- **担当**：オーナー様が書いてきた内容のままにします

- 管理店舗は「KH鹿屋店」のような名前で選びますが、サイトには「国分ハウジング鹿屋店」のような正式な名前で出ます

> 注意：以前の「出水阿久根」「加世田」「肝属」のエリアは、2026年11月に物件の所在地の市町村（出水・阿久根・長島・薩摩川内・南さつま・南大隅）に付け直しました。サイトのエリアの絞り込みも、この名前で出ます。

## 地図のピン
右の地図を押すと、その場所にピンが立ちます。ピンはつかんで動かせます。
- 上の欄に住所を入れて「探す」を押すと、その近くに地図が動きます
- 物件ページの地図も、保存したときにピンの位置で作り直されます
- 「ピンを外す」を押すと、サイトの地図に出なくなります

> 要確認：オーナーズハウスはオーナー様のお住まいです。ピンの位置をどこまで正確にするかは、社内のルールに従ってください。

## 物件を追加する
右上の「物件を追加」を押すと、空の画面が開きます。種別を選んで保存すると、新しい ID が付きます。
- はじめはサイトに出ない状態（公開のチェックなし）で作られます。内容を確かめてから公開にしてください

## 画像
物件ごとに14枚まで登録できます（2026年11月から）。
- **メイン1〜4**：物件ページの上に出る写真です。メイン1は、一覧と地図のサムネイルにも使われます
- **下1〜10**：物件ページの下に、横に送れる写真（カルーセル）で出ます
- 枠を押して写真を選ぶと、その場で保存されます（「保存する」を押さなくてもサイトに出ます）
- 写った枠の「外す」を押すと、その写真はサイトから消えます
- 選べるのは JPEG・PNG・WebP の写真です。大きな写真は、送る前に自動で小さくします
- 新しく追加した物件は、一度「保存する」を押すと写真を登録できるようになります

> 注意：オーナー様のお住まいの写真です。表札・車のナンバー・ご家族が写っていないか確かめてから登録してください。
', 170, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
