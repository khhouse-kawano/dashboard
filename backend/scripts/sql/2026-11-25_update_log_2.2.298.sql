-- =====================================================================
-- v2.2.298 集客イベント：反響一覧の見た目をカードに・イベントの予約フォームを作る「フォーム作成」 ＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（mysql / phpMyAdmin）。⚠️ 1回だけ流す（表の部分は何度流しても安全。更新履歴の行だけ増える）
-- ⚠️ ② を上げる前に流す（② は event_form の表を読む）
-- =====================================================================
-- ---------------------------------------------------------------
-- 表
-- ---------------------------------------------------------------
-- event_form … 作ったフォーム1本で1行。id がそのまま公開URLの番号になる（https://khg-marketing.info/form/<id>/）
--   title  … event_db.title に入れるイベント名（例: 2026-12-06_○○フェア）。⚠️ 申し込みのイベント名は必ずここから取る
--   mail_to / mail_cc … 反響の通知先（カンマ区切り）。⚠️ 公開フォームには返さない
--   fields … 入力欄ごとの「表示・必須」（JSON の文字列）。⚠️ 氏名・携帯電話・メールアドレスは常に表示・必須（② が決める）
--   active … 1 = 受付中、0 = 受付を止めた
-- event_db.site … 建築予定地（フォームから入る）
CREATE TABLE IF NOT EXISTS event_form (
  id INT NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  mail_to VARCHAR(1000) NOT NULL DEFAULT '',
  mail_cc VARCHAR(1000) NOT NULL DEFAULT '',
  fields TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_by VARCHAR(100) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  updated_by VARCHAR(100) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='イベントの予約フォーム（v2.2.298）';

ALTER TABLE event_db ADD COLUMN IF NOT EXISTS site TEXT NULL DEFAULT NULL COMMENT '建築予定地（v2.2.298 フォームから）' AFTER area;

-- 確認
-- SHOW COLUMNS FROM event_form;
-- SHOW COLUMNS FROM event_db LIKE 'site';

INSERT INTO update_log (version, date, note) VALUES
('2.2.298', '2026-11-25', '集客イベントに「フォーム作成」を追加しました。イベントの予約フォームを作ると番号付きのURLができ、申し込みは反響一覧に入ります。反響一覧の見た目をカードにまとめ、「建築予定地」の列を足しました。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（2本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-192.md：集客イベントの反響一覧
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '集客イベントの反響一覧';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('集客イベントの反響一覧', 'common', '画面の使い方', '集客イベントの予約・来場者を1つの一覧で見て、受付の記録を付けたり、顧客DBに取り込んだりする画面。', 'ヘッダーの「集客イベント → 反響一覧」。イベントのホームページのフォーム、[[イベントのフォーム作成]] で作ったフォーム、受付での手入力から届いた予約が、1つの一覧に並びます。

[[画面:集客イベントの反響一覧]]

## 見方
- いちばん上に、いま出ている件数と全部の件数が出ます
- その下の枠で絞り込みます。並びは「イベント・店舗・来場予定日・来場予定時間・来場状況」です。「リロード」で最新の予約を読み直します
- 下へスクロールしても、見出しと絞り込みの枠は上に残ります
- イベントを選ぶと、日付ごとの予約数・来場予定時間・相談内容・検討内容の集計が、一覧の上に出ます
- 行の色：青は顧客DBに取り込み済み、水色は賃貸、黄色は持ち家、緑は住宅相談・資金相談などの相談の意向がある方です
- 「建築予定地」の列は、フォーム作成で作ったフォームで建築予定地を聞いたときだけ入ります

## 書き換えられる欄
お名前・電話番号・メールアドレス・チェックイン・チェックアウト・担当スタッフ・備考欄だけが書き換えられます。欄の外を押すと保存されます。それ以外の欄は、お客様が入力した内容のまま残します。

## 顧客DBに取り込む
1列目の回る矢印を押し、担当店舗と担当営業を選んで「同期する」を押します。取り込むと「同期済み」になり、行が青くなります。
- 建築予定地が入っている予約は、建築予定地を顧客DBの「建築予定地」に入れます。入っていない予約は、今までどおり希望エリアを入れます

> 注意：以前あった「特設URLはこちら」のボタンはなくなりました。フォームの URL は [[イベントのフォーム作成]] で確かめてください。

## 関係する記事
- [[イベントのフォーム作成]]
- [[集客サマリー]]
', 192, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-193.md：イベントのフォーム作成
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'イベントのフォーム作成';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('イベントのフォーム作成', 'common', '画面の使い方', 'イベントの予約フォームを作り、お客様に配る URL を出す画面。申し込みは集客イベントの反響一覧に入る。', 'ヘッダーの「集客イベント → フォーム作成」。イベントの予約フォームを作ると、「https://khg-marketing.info/form/番号/」の URL ができます。この URL をチラシの QR コードや SNS などで配ると、お客様がスマホから申し込めます。

[[画面:イベントのフォーム作成]]

## 作り方
1. 「新しいフォームを作る」を押します
2. イベント名を決めます
   - 「今あるイベントから選ぶ」：反響一覧にあるイベント名から選びます
   - 「新しく追加する」：開催日とイベント名を入れます。反響一覧には「2026-12-06_完成見学会」のように、開催日の付いた名前で出ます
3. 「反響の通知先（To）」に、申し込みを知らせるメールアドレスを入れます。複数のときはカンマ（,）で区切ります。Cc も同じように入れられます
4. 「フォームで聞く項目」で、項目ごとに「聞く」「必須」を選びます
   - 氏名（漢字）・携帯電話・メールアドレスは、いつも聞きます（必須）
   - 「聞く」を外した項目は、フォームに出ません。たとえば建築予定地を聞く必要のないイベントでは外します
5. 「保存する」を押すと番号が付き、URL が出ます。「URL をコピー」でコピーできます

## フォームで聞ける項目
氏名（漢字）・氏名（ふりがな）・携帯電話・メールアドレス・郵便番号・住所（番地まで）・建物名・お申し込みのきっかけ（SNS広告・チラシ・紹介・看板・インターネット検索・YouTube）・希望エリア・参加人数（大人・お子様）・ご自宅の状況（持ち家・賃貸）・建築予定地・備考です。
- 郵便番号を入れて「住所を検索」を押すと、住所が自動で入ります

## 申し込みがあったら
- 申し込みは [[集客イベントの反響一覧]] に入ります。イベント名で絞り込むと、そのフォームの申し込みだけが出ます
- 通知先（To・Cc）に、申し込みの内容がメールで届きます
- 申し込んだお客様には、入力した内容の控えがメールで届きます

## 直す・止める
一覧の「編集」で、イベント名・通知先・聞く項目を直せます。URL（番号）は変わりません。
- 受付をやめるときは、「受付中」のチェックを外して保存します。フォームを開いても「このイベントの受付は終了しました」と出ます
- フォームは消せません（配った URL を開いた人が困らないようにするためです）

> 注意：イベント名を直すと、それより後の申し込みは新しい名前で反響一覧に入ります。すでに入った申し込みの名前は変わりません。

> 要確認：通知先のメールアドレスは、店舗・担当で決まっている宛先を使ってください。

## 関係する記事
- [[集客イベントの反響一覧]]
- [[集客サマリー]]
', 193, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
