-- =====================================================================
-- v2.2.304 物件DB を表示する件数分だけ読む（② で絞り込み・並べ替え・ページ分け）＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（mysql / phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.304', '2026-11-26', '物件DBを、表示する件数分だけ読むようにして開くのを速くしました。ページ送り・表示件数・絞り込み・並べ替えを変えると、その分を読み直します。条件と表示中のページは画面のURLにも出ます。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- spec/screen-050.md：物件DB
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '物件DB';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('物件DB', 'spec', '画面の使い方', '建売の物件の一覧と、ポータルへの掲載状況。', '左のメニュー「物件DB」（建売営業・PC のみ）。いえらぶの物件に、SUUMO・HOME''S・at home の閲覧数（PV）と反響の数を並べて見ます。

[[画面:物件DB]]

## 絞り込み
上の枠で絞り込みます。
- 店舗・ランク・物件名・住所・営業名
- 「自社物件を表示」「契約済みの物件を表示」
- 絞り込みを変えると、1ページ目に戻ります。ページ数は、絞り込んだあとの件数で数えます
- 「表示件数」で、1ページに出す件数（20・50・100・500件）を選べます
- 開いたときは、1ページ分だけを読み込みます。ページを送る・表示件数や絞り込み・並べ替えを変えると、その分を読み直します
- 絞り込み・並べ替え・表示中のページは、画面のアドレス（URL）にも出ます。そのアドレスで開くと、同じ一覧が出ます（共有にも使えます）

## 見方
- 見出しの「反響数」「総PV」「SUUMO」「HOME''S」「athome」を押すと並べ替えられます（もう一度押すと逆の順）
- PV の数字を押すと、そのポータルの掲載の詳しい内容が開きます
- 「詳細」を押すと、物件の詳細（ポータルへの掲載状況・閲覧数・この物件に問い合わせたお客様）が開きます

## SUUMO掲載順位
上の枠の「SUUMO掲載順位」で開きます。SUUMO での掲載順位を、市町村ごとに並べて見ます。
- 初めは最新の取得日の順位が出ます。「取得日」で前の日を選ぶと、その日の順位を読み直します
- 順位の後ろのかっこは、前回（その日より前の取得日）の順位です
- 前の日を選んでいるあいだは、画面のアドレス（URL）にその日が出ます。そのアドレスで開くと、同じ日の順位が開きます

## 物件の情報について
物件の情報はいえらぶから取り込んでいます。SUUMO・HOME''S・at home の掲載データからも、空いている項目（住所・物件名・間取り・面積・交通・価格など）を補います。いえらぶに無い物件がポータルに載っていれば、その物件も物件DB に加わります。
- いえらぶの値が入っている項目は、ポータルの値で書き換えません
', 50, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
