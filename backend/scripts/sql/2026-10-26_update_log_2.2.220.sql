-- =====================================================================
-- update_log に v2.2.220 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.220', '2026-10-26', '紹介キャンペーンサマリーで「紹介元」を選べるようにした。選んだ紹介元のお客様だけで、店舗別・担当別などの歩留まりが出る。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-120.md：紹介キャンペーンサマリー
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '紹介キャンペーンサマリー';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('紹介キャンペーンサマリー', 'common', '画面の使い方', '紹介で来たお客様の歩留まり。', 'ヘッダーの「紹介キャンペーン → 紹介キャンペーンサマリー」。媒体が「紹介」のお客様が、来場・次アポ・契約までどれだけ進んだかを見ます。

[[画面:紹介キャンペーンサマリー]]

- 紹介者の種類・事業・ブランド・エリア・店舗・担当ごとに見られます
- 紹介元・期間・店舗・エリアで絞れます
- **紹介元**を選ぶと、その紹介元のお客様だけで、店舗別・担当別などすべての表が出ます（例：紹介元を「オーナー様」にすると、オーナー様からの紹介だけの店舗ごと・担当ごとの歩留まり）。選択肢の（ ）の数は、ほかの絞り込みを当てたあとの反響の数です

## 担当別（いちばん下の表）
店舗別の下に、担当ごとの歩留まりが出ます。
- 対象は注文・建売の紹介のお客様です（中古は入りません）
- お客様の**担当営業**と、**商談シートに記録した人**の両方で数えます。担当が変わったお客様や、ほかの人が面談したお客様も、その人の行に入ります
- そのため1人のお客様が複数の担当に入ることがあり、**足しても全体の数とは合いません**
- 紹介のお客様がいない担当は出ていません

> 注意：担当の名前は、人事マスタ（スタッフ編集）の最新の年度に載っている人です。名前の表記が違うと数えられないことがあります。

> 紹介の反響は、紹介された人がお客様として登録されます（紹介した人ではありません）。
', 120, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
