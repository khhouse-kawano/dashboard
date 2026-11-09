-- =====================================================================
-- v2.2.257 面談アンケート（survey）の API を ② へ ＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- =====================================================================

-- 1. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
INSERT INTO update_log (version, date, note) VALUES
('2.2.257', '2026-11-09', '面談アンケート（survey）の読み書きを新しい仕組みへ移しました。スタッフの画面は Dashboard のログインで入れます（未ログインなら Google ログインのあと元の画面へ戻ります）。お客様が QR から開く画面は、ログイン不要の7日間有効のリンクになりました。');

-- 2. 業務ガイドの記事（build-guide-sql.cjs の出力）
-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-205.md：面談アンケート（面談前・面談後）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '面談アンケート（面談前・面談後）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('面談アンケート（面談前・面談後）', 'common', '画面の使い方', 'khg-marketing.info/survey/ の面談前・面談後アンケート。スタッフは Dashboard のログインで入り、お客様には QR（7日間有効）で回答してもらう。', 'お客様に面談の前と後に答えていただくアンケートです。スタッフがお客様を選んで QR コードを出し、お客様が自分のスマホで読み取って回答します。答えた内容は、お客様の記録（顧客DB）に入ります。

アドレス：https://khg-marketing.info/survey/

## スタッフの入り方
- Dashboard にログインしているブラウザなら、そのまま入れます（ID・パスワードの入力はありません）
- ログインしていないときは、Dashboard のログイン画面に移ります。Google（Workspace アカウント）でログインすると、元のアンケートの画面に戻ります
- 入口で「面談前アンケート」か「面談後アンケート」を選びます

## お客様に回答してもらう
1. お客様の名前で探して選ぶ（新規のお客様は「新規お客様にアンケート実施」のタブで、店舗と担当を選ぶ）
2. 「面談前アンケート開始」（面談後は「面談後アンケート開始」）を押す
3. 出てきた QR コードを、お客様のスマホで読み取ってもらう
4. お客様が回答して送ると、お礼の画面が出ます

- お客様はログインしなくても開けます
- 面談前アンケートでは、お客様の連絡先などが最初から入った状態で開きます。お客様が直した内容で、お客様の記録が新しくなります
- QR は**7日間**使えます。後日ご自宅で回答していただくこともできます

> 注意：7日を過ぎた QR でも、アンケートは開けて、回答も保存されます。ただし、お客様の連絡先などは最初から入らず、お客様の記録も新しくなりません（回答そのものは残ります）。7日を過ぎたら、新しい QR を出してください。

> 注意：QR の画面を写真に撮って別の方に送ると、その方もそのお客様のアンケートを開けます。QR はお客様ご本人にだけ見せてください。

## うまくいかないとき
- スタッフの画面で、何度もログイン画面に戻される：Dashboard のログインの期限が切れています。もう一度 Google でログインしてください
- お客様が「送信できませんでした」と出る：電波の良いところで、もう一度「入力内容で回答する」を押してもらってください（入力した内容は消えません）
', 205, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
