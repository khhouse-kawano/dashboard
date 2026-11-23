-- =====================================================================
-- v2.2.293 架電ステータス・架電アクションの選択肢を DB で管理（call_status）・インサイドセールスの管理店舗（staff_list.managed_shops）＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（mysql / phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- ⚠️ 表は CREATE TABLE IF NOT EXISTS・INSERT IGNORE・ADD COLUMN IF NOT EXISTS なので、表の部分は何度流しても安全。
-- ⚠️ 記事（新規「架電ステータスの設定」・「ヘッダーのメニュー」）の更新が入っている。
-- ⚠️ 戻すとき: DROP TABLE call_status; ALTER TABLE staff_list DROP COLUMN managed_shops;
--   （⚠️ 画面は ② に届かない・表が無いときは、今までの固定の選択肢を使うので、表を消しても顧客DBは動く）
--
-- call_status：1行 = 選択肢1つ。
--   kind     … 'status'（架電ステータス。顧客DBの「架電状況」の絞り込み・顧客情報の架電ステータス）
--              'action'（架電アクション。顧客情報の架電記録の「アクション内容」）
--              ⚠️ 列名は category にしない（② のゲートウェイが本文の category を振り分けの鍵に使うため）
--   division … 'order'（注文）/ 'spec'（建売）/ 'used'（中古）/ 'all'（全事業）
--   flag     … 1 = 選択肢に出す / 0 = 出さない（⚠️ すでにその値が入っている顧客では、画面はその値を残して出す）
--   sort     … 並び順（小さい順）
-- =====================================================================

CREATE TABLE IF NOT EXISTS call_status (
    no          INT           NOT NULL AUTO_INCREMENT,
    kind        VARCHAR(6)    NOT NULL COMMENT 'status（架電ステータス）/ action（架電アクション）',
    name        VARCHAR(32)   NOT NULL COMMENT '画面に出す名前（⚠️ 顧客の call_status・架電記録の action にこの文字列がそのまま入る）',
    division    VARCHAR(5)    NOT NULL DEFAULT 'all' COMMENT 'order / spec / used / all',
    flag        TINYINT       NOT NULL DEFAULT 1 COMMENT '1 = 選択肢に出す / 0 = 出さない',
    sort        INT           NOT NULL DEFAULT 0 COMMENT '並び順（小さい順）',
    updated_at  TIMESTAMP     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最後に変えた日時',
    PRIMARY KEY (no),
    UNIQUE KEY uq_call_status (kind, name, division)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='架電ステータス・架電アクションの選択肢（v2.2.293）';

-- ⚠️ 今まで画面に書いてあった選択肢（全事業）と、今回足す3つ（IS対応中・IS追客終了は注文だけ、SMS返信ありは全事業）
INSERT IGNORE INTO call_status (kind, name, division, flag, sort) VALUES
('status', '未通電',     'all',   1, 10),
('status', '継続',       'all',   1, 20),
('status', '来場アポ',   'all',   1, 30),
('status', '来場済み',   'all',   1, 40),
('status', '架電停止',   'all',   1, 50),
('status', 'IS対応中',   'order', 1, 60),
('status', 'IS追客終了', 'order', 1, 70),
('action', '通電',       'all',   1, 10),
('action', '未通電',     'all',   1, 20),
('action', 'SMS送信',    'all',   1, 30),
('action', 'SMS返信あり', 'all',  1, 40),
('action', 'メール送信', 'all',   1, 50),
('action', '資料郵送',   'all',   1, 60),
('action', '次回架電日', 'all',   1, 70);

-- インサイドセールスの管理店舗（店舗名の JSON 配列。例 ["KH霧島店","KH姶良店"]。⚠️ NULL は未設定）
ALTER TABLE staff_list ADD COLUMN IF NOT EXISTS managed_shops TEXT DEFAULT NULL COMMENT 'インサイドセールスの管理店舗（店舗名の JSON 配列。v2.2.293）';

-- 確認（⚠️ information_schema は ① で使えないので SHOW を使う）
SHOW TABLES LIKE 'call_status';
SELECT kind, division, COUNT(*) FROM call_status GROUP BY kind, division;
SHOW COLUMNS FROM staff_list LIKE 'managed_shops';

INSERT INTO update_log (version, date, note) VALUES
('2.2.293', '2026-11-23', '架電ステータスに「IS対応中」「IS追客終了」（注文）、架電のアクションに「SMS返信あり」を足しました。架電ステータス・アクションの選択肢は、メニューの「システム管理 → 架電ステータス」で追加・編集・表示の切り替えができます。同じ画面で、インサイドセールスの担当者の在籍・退職と管理店舗を設定できます。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（2本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-203.md：架電ステータスの設定
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '架電ステータスの設定';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('架電ステータスの設定', 'common', '画面の使い方', '架電ステータス・架電アクションの選択肢の追加・編集・表示の切り替えと、インサイドセールスの担当者の在籍・管理店舗の設定（管理者・インサイドセールスだけ）。', 'ヘッダーの「システム管理 → 架電ステータス」（管理者・インサイドセールスだけ）。顧客情報の架電記録で選ぶ「架電ステータス」「アクション内容」の選択肢と、インサイドセールスの担当者の管理店舗を設定する画面です。

[[画面:架電ステータスの設定]]

## 選択肢が出るところ
- **架電ステータス**：顧客DBの「架電状況」の絞り込みと、顧客情報の架電記録の「架電ステータス」
- **架電アクション**：顧客情報の架電記録の「アクション内容」
- 「事業」が**全事業**の選択肢は、注文・建売・中古のすべてに出ます。注文・建売・中古を選んだものは、その事業の画面にだけ出ます
- 並び順の小さいものから上に並びます

> 2026年11月に、架電ステータスに「IS対応中」「IS追客終了」（注文だけ）、架電アクションに「SMS返信あり」（全事業）を足しました。

## 追加・編集
- 「＋ 追加」を押すと、表のいちばん上に入力の行が出ます。名前・事業・並び順・表示を入れて「保存」を押します
- 行の「編集」で名前・事業・並び順・表示を直せます。「やめる」で直す前に戻ります
- 「表示」のスイッチを外すと、その選択肢は次に開いた画面から出なくなります（灰色の取り消し線で残ります）
- 保存した選択肢は、次に顧客DB・顧客情報を開いたときから出ます。開いたままの画面には、開き直すまで出ません

> 注意：名前は、お客様の情報にそのまま入る文字です。名前を変えたり表示を外したりしても、すでに入っているお客様・架電記録の値は変わりません。そのお客様を開くと、今の値のまま出ます。

> 注意：使わなくなった選択肢は、消さずに「表示」を外してください（消すボタンはありません）。

> 要確認：選択肢を増やす・名前を変えるときは、どの事業で、どんな意味で使うかを社内で決めてから設定してください。

## インサイドセールスの担当者
画面の下に、今年度のインサイドセールスの担当者がカードで並びます。
- 出るのは、「スタッフ編集・追加」で店舗を「インサイドセールス」にし、インサイドセールスの印を付けた今年度の担当者です
- **在籍・退職**：押して切り替えます
- **管理店舗**：注文事業の店舗から、受け持つ店舗を押して選びます（いくつでも選べます。もう一度押すと外れます）
- 変えたら「保存」を押します。「元に戻す」で保存する前の状態に戻ります

> 注意：保存していない変更は、画面を移ると消えます。
', 203, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-105.md：ヘッダーのメニュー
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'ヘッダーのメニュー';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('ヘッダーのメニュー', 'common', '画面の使い方', '画面のいちばん上のメニュー（システム管理・反響管理・他社動向など）の開き方と、見られる人。', '画面のいちばん上に並んでいるメニュー（システム管理・反響管理・他社動向・活動サマリー・架電状況・公式アンバサダー・紹介キャンペーン・集客イベント・Google口コミ）です。メニューを押すと項目が出て、項目を押すとその画面が開きます。

## 開き方
- 項目を押すと、左のメニューの画面（顧客DB など）と同じように、右側にその画面が出ます。左のメニューはそのまま使えます
- 画面のいちばん上に「反響管理 › 重複反響サマリー」のように、どのメニューのどの項目かが出ます
- 前の画面に戻るときは、ブラウザの「戻る」を押すか、ほかのメニューを押します。閉じるボタンはありません
- 開いている画面のまま再読み込みしても、同じ画面が開きます

> 注意：「広告費入力」などで入力の途中にほかの画面へ移ると、まだ登録していない内容は消えます。移る前に「登録」や「修正」を押してください。

> 以前はポップアップで開いていましたが、2026年11月から画面の中に開くようになりました。中身と使い方は変わっていません。

## 見られる人
だれでも開けますが、次の項目は見られる人が決まっています。見られない項目はメニューに出ません。
- **ローン情報更新**・**広告費シミュレーター**・**セキュリティログ**・**ポータル連携ログ**・**アクセス記録**：管理者だけ
- **アクセス解析**・**営業別契約率**・**予算テーブル**：管理者・ブランド管理者だけ
- **Claudeによる分析**（メニューの左のボタン）・**共有レポート**：管理者・ブランド管理者・マネージャーだけ
- **架電ステータス**：管理者・インサイドセールスだけ
- **アクションボード**：注文営業だけ

> 見られない画面を、アドレスを直接入れて開いたときは「この画面を見る権限がありません」と出ます。

## 項目ごとの記事
- [[重複反響サマリー]]
- [[紹介キャンペーンサマリー]]
- [[営業別契約率]]
- [[契約数ランキング]]
- [[Claudeによる分析]]
- [[アクセス解析]]
- [[アンバサダーの反響一覧]]
- [[オーナーズハウス募集]]
- [[セキュリティログ]]
- [[ポータル連携ログ]]
- [[アクセス記録]]
- [[共有レポート]]
- [[架電ステータスの設定]]
- [[予算テーブル]]
- [[イベントの広告費入力]]
', 105, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
