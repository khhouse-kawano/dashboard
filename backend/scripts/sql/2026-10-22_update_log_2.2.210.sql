-- =====================================================================
-- update_log に v2.2.210 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.210', '2026-10-22', '会社実績の「4半期サマリー」を建売分譲事業でも見られるようにした。建売では、契約実績に仲介の契約を含め（内訳も表示）、契約予定は Aランクの予定月で数える。反響実績は販促媒体別反響推移（建売）と同じ定義で数える。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- spec/screen-060.md：全社報告用フォーマット（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '全社報告用フォーマット（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('全社報告用フォーマット（建売営業）', 'spec', '画面の使い方', '年度の予算と契約実績（建売営業）。', '左のメニュー「全社報告用フォーマット」。建売分譲事業が先頭に並びます。

[[画面:全社報告用フォーマット]]

- 月ごとの予算と契約実績を、事業部 → 課 → 店舗 → 担当 の順に見ます
- 自社契約が棟数、仲介契約は緑の（ ）で別に出ます
- S/A/B/C の見込みは、ランクで数えます（S は今月に契約した人だけ）
- 契約棟数ランキングと、4半期サマリーのボタンがあります

## 4半期サマリー
上の緑の「4半期サマリー」ボタンで開きます。期の12か月を、四半期・上半期・下半期・期の合計と並べて見ます。

- 契約実績報告：予算・実績・差異（達成率）・前期実績・昨対比・契約予定を、事業部 → 課 → 係 の順に出します
- 実績には仲介の契約も入ります。「うち仲介」の行がその数です（上の表の緑の（ ）と同じ）
- 契約予定は、今月より前は契約した数、今月からは Aランクで予定月が入っている人の数です
- 反響実績報告：総反響・来場・次アポ・契約と、営業1人あたりの反響・来場です。数え方は「販促媒体別反響推移」と同じです
- 課の名前の下の「店舗を表示」で、係の行を開いたり閉じたりできます

> 注意：契約予定は、顧客情報のランクの予定月が入っていないと数えられません。Aランクのお客様には予定月を入れてください。

## 関係する記事
- [[契約したら（建売営業）]]
', 60, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
