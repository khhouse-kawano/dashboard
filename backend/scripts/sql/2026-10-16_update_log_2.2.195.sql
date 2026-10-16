-- =====================================================================
-- update_log に v2.2.195 を追加する ＋ 業務ガイドの記事
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 記事の部分は backend/scripts/guide/build-guide-sql.cjs で作ったもの（⚠️ 手で直さない）。
-- =====================================================================

INSERT INTO update_log (version, date, note) VALUES
('2.2.195', '2026-10-16', '重複反響サマリーで、他ブランドの表のブランド名を押すと、重複した反響を反響媒体ごとに見られるようにした（媒体ごとの反響・重複・重複率と、相手ブランドでの来場・次アポ・契約）。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-110.md：重複反響サマリー
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '重複反響サマリー';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('重複反響サマリー', 'common', '画面の使い方', '他ブランドにも問い合わせているお客様の数と、その先。どの反響媒体で重なっているか。', 'ヘッダーの「反響管理 → 重複反響サマリー」。電話・メール・住所が、グループの**他ブランド**のお客様と同じ反響を数えます。

## 見方
- ブランドごとのカードに、総反響・来場・次アポ・契約
- 横棒：どのブランドと重なっているか、相手のブランドでどこまで進んだか
- 期間とエリア（住所の都道府県）で絞れます

## 反響媒体ごとに見る
カードの下の表（他ブランド）の**ブランド名を押す**と、その下に反響媒体ごとの内訳が開きます。もう一度押すと閉じます。
- **反響**：そのカードのブランドに、その媒体で来た反響の数（重なっていないものも含む）
- **重複**：そのうち、押したブランドにも同じ人がいる数
- **重複率**：重複 ÷ 反響。高い媒体ほど、同じお客様がグループの複数のブランドに問い合わせています
- **来場・次アポ・契約**：重なった人が、**押したブランドで**どこまで進んだか（下の％は重複に対する割合）
- 見出しを押すと並べ替えられます

> 媒体は、**カードのブランドに来たとき**の媒体です。たとえば KH のカードで DJH を押したときは、「KH にどの媒体で来た人が、DJH にもいたか」を表します。

> 注意：ここでいう「重複」は、顧客のステータスの「重複」（同じ人の2回目の問い合わせ）とは別のものです（[[重複（2つの意味）]]）。
', 110, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
