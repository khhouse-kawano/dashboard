-- =====================================================================
-- update_log に v2.2.221 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.221', '2026-10-28', '不動産企画係の画面を Dashboard のアプリとして整えた（第1段）。担当事業に「不動産企画係」を追加し、不動産企画係の画面は不動産企画係・全事業の人だけが開けるようにした。案件・台帳・通知のデータの読み書きにログインと担当事業の確認を付け、通知は本人宛だけが見えるようにした。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-230.md：不動産企画係の画面（入口と権限）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '不動産企画係の画面（入口と権限）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('不動産企画係の画面（入口と権限）', 'common', '画面の使い方', '不動産企画係の画面に入れる人と、入り方。', '不動産企画係の画面（チームサマリー・月次報告書・売り反響・買い反響・商談案件・買取再販案件・媒介獲得台帳）は、Dashboard の中の不動産企画係専用のアプリです。

## 入れる人
- 担当事業が「**不動産企画係**」の人
- 担当事業が「**全事業**」の人

ほかの担当事業（注文・建売・中古）の人は入れません。画面のアドレスを直接開いても、事業を選ぶ画面に戻ります。

> 注意：媒介獲得台帳のデータは、中古リノベの顧客DB・顧客詳細からも読み書きします。そのため中古リノベの人も、その画面からは今までどおり使えます。

## 入り方
1. Dashboard にログインする
2. 事業を選ぶ画面で「**不動産企画係**」を押す
3. チームサマリーが開く。左のメニューから各画面へ移る

## 担当事業を「不動産企画係」にする
ヘッダーの「システム管理 → 権限編集」で、その人の担当事業を「不動産企画係」に変えます（変えられるのは管理者だけです）。

> 注意：変えたあと、本人が次に画面を移ったときに反映されます。ログインし直す必要はありません。

## 通知
画面の右上のベルに出る通知は、**ログインしている本人宛のものだけ**です。

> 要確認：以前の画面のアドレス（/leadSell など）をブックマークしている人は、新しいアドレス（/realty/sell など）に自動で移ります。ブックマークを付け直しておくと確実です。
', 230, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
