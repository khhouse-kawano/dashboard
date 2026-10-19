-- =====================================================================
-- update_log に v2.2.197 を追加する ＋ 業務ガイドの記事
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 記事の部分は backend/scripts/guide/build-guide-sql.cjs で作ったもの（⚠️ 手で直さない）。
-- =====================================================================

INSERT INTO update_log (version, date, note) VALUES
('2.2.197', '2026-10-19', '顧客情報の担当営業の選択を、担当店舗の営業と「管理」から選び、「他店舗の営業を表示」で同じ事業の全営業から選べるようにした。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- order/screen-020.md：顧客DB
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '顧客DB';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('顧客DB', 'order', '画面の使い方', 'お客様の検索と、商談の日付・ステータス・ランクの入力。', '左のメニュー「顧客DB」。取り込んだお客様を探して、情報を直す画面です。お客様の名前を押すと、顧客情報の編集が開きます。

[[画面:顧客DB]]

## 絞り込み
- 店舗（選ぶと担当でも絞れます）
- 反響月・初回来場月（「未来場・来場キャンセル」も選べます）
- ランク・媒体・ステータス・架電状況
- 氏名・電話・メール・住所

## 名前の横の印
- **緑の点**：ギフト進呈の条件がそろっている（担当が決まっている・反響日がある・初回面談の記録がある・家族情報が入っている）
- **赤の点**：まだそろっていない
- **N**：Nexus に連携済み

## 担当営業の選び方
顧客情報の「担当営業」を押すと、一覧が開きます。
- はじめは、**担当店舗の営業**と「〇〇店 管理」だけが出ます
- 一番下の **他店舗の営業を表示** を押すと、注文営業の全店舗の営業が店舗ごとに出ます。上の欄で名前や店舗名で探せます
- 他店舗の営業を選んでも、**担当店舗は変わりません**。欄の右に「他店舗：〇〇店」と出ます
- 今の担当が一覧に無いとき（他店舗の営業・今年度の名簿にいない人）は、一番上に「現在の担当」として出ます

> 注意：「〇〇店 管理」を選ぶと、店舗管理に変える理由を入力する画面が出ます。

## 上のボタン
- **キャンセル集計（要回答）**：来場予約日を過ぎても、初回面談もキャンセル理由も空のお客様
- **失注集計（要回答）**：失注理由などが抜けているお客様（[[失注したら]]）

## 関係する記事
- [[来場予約が入ったら・来場したら]]
- [[契約したら（注文営業）]]
- [[ランク]]
', 20, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
