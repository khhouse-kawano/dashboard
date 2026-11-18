-- =====================================================================
-- v2.2.281 顧客台帳にポータル反響の印（portal_flag / portal_site）＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- ⚠️ ① の PHP・② を上げる**前に**流すこと（列が無いと、取り込みの最後の UPDATE と顧客DBの読み込みが落ちる）。
--
-- ポータル反響の判定（② features/list/portal.ts・① core/portal.php と同じ式。変えるときは3か所そろえる）
--   反響の medium と response_medium が同じで、
--   inquiry_id の頭がポータルの接頭辞（大文字小文字を区別）で、
--   その接頭辞のサイト名と medium が一致するとき。portal_site には medium（サイト名）を入れる。
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.281', '2026-11-18', '反響一覧から顧客DBに取り込むとき、ポータルサイト（SUUMO・HOME''S・athome など）からの反響かどうかと、どのサイトかを記録するようにしました。顧客DBの「SUUMO(ポータル反響)」は、SUUMO から来た反響のお客様だけを出すようにしました（建売にも追加）。');

-- 1) 列を足す
ALTER TABLE master_data
  ADD COLUMN portal_flag TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ポータルサイトからの反響なら1（v2.2.281）',
  ADD COLUMN portal_site VARCHAR(32) NULL DEFAULT NULL COMMENT 'ポータルサイト名（SUUMO など。v2.2.281）';
ALTER TABLE master_data_kaeru
  ADD COLUMN portal_flag TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'ポータルサイトからの反響なら1（v2.2.281）',
  ADD COLUMN portal_site VARCHAR(32) NULL DEFAULT NULL COMMENT 'ポータルサイト名（SUUMO など。v2.2.281）';

-- 2) これまでに取り込んだ分を埋める（反響の pg_id = 顧客台帳の id）
UPDATE master_data m
  JOIN inquiry_customer i ON i.pg_id = m.id
   SET m.portal_flag = 1, m.portal_site = i.medium
 WHERE i.pg_id <> '' AND i.medium = i.response_medium
   AND i.medium = CASE
     WHEN i.inquiry_id LIKE BINARY 'suumo%' THEN 'SUUMO'
     WHEN i.inquiry_id LIKE BINARY 'homes%' THEN 'HOME''S'
     WHEN i.inquiry_id LIKE BINARY 'athome%' THEN 'athome'
     WHEN i.inquiry_id LIKE BINARY 'townlife%' THEN 'タウンライフ'
     WHEN i.inquiry_id LIKE BINARY 'allgrit%' THEN 'ALLGRIT'
     WHEN i.inquiry_id LIKE BINARY 'kagosuma%' THEN 'カゴスマ'
     WHEN i.inquiry_id LIKE BINARY 'mochiie%' THEN '持ち家計画'
     WHEN i.inquiry_id LIKE BINARY 'tochishinchaku%' THEN '土地新着ネット'
     WHEN i.inquiry_id LIKE BINARY 'housingBazar%' THEN 'ハウジングバザール'
     WHEN i.inquiry_id LIKE BINARY 'metaJutaku%' THEN 'メタ住宅展示場'
   END;
UPDATE master_data_kaeru m
  JOIN inquiry_customer_kaeru i ON i.pg_id = m.id
   SET m.portal_flag = 1, m.portal_site = i.medium
 WHERE i.pg_id <> '' AND i.medium = i.response_medium
   AND i.medium = CASE
     WHEN i.inquiry_id LIKE BINARY 'suumo%' THEN 'SUUMO'
     WHEN i.inquiry_id LIKE BINARY 'homes%' THEN 'HOME''S'
     WHEN i.inquiry_id LIKE BINARY 'athome%' THEN 'athome'
     WHEN i.inquiry_id LIKE BINARY 'townlife%' THEN 'タウンライフ'
     WHEN i.inquiry_id LIKE BINARY 'allgrit%' THEN 'ALLGRIT'
     WHEN i.inquiry_id LIKE BINARY 'kagosuma%' THEN 'カゴスマ'
     WHEN i.inquiry_id LIKE BINARY 'mochiie%' THEN '持ち家計画'
     WHEN i.inquiry_id LIKE BINARY 'tochishinchaku%' THEN '土地新着ネット'
     WHEN i.inquiry_id LIKE BINARY 'housingBazar%' THEN 'ハウジングバザール'
     WHEN i.inquiry_id LIKE BINARY 'metaJutaku%' THEN 'メタ住宅展示場'
   END;

-- 確かめる
SELECT 'order' t, portal_site, COUNT(*) n FROM master_data WHERE portal_flag = 1 GROUP BY portal_site
UNION ALL
SELECT 'spec' t, portal_site, COUNT(*) n FROM master_data_kaeru WHERE portal_flag = 1 GROUP BY portal_site;

-- ---------------------------------------------------------------
-- 業務ガイドの記事（2本）。backend/scripts/guide/build-guide-sql.cjs で作成
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

## SUUMO(ポータル反響)
媒体の欄の一番下にある「SUUMO(ポータル反響)」を選ぶと、SUUMO のサイトから届いた反響で取り込んだお客様だけが出ます（一般スタッフには出ません）。
- 反響一覧から取り込むときに、どのポータルサイトから来た反響かを記録しています（2026年11月から）。それより前に取り込んだお客様も、反響一覧の記録から付け直してあります
- ホームページのフォームで「SUUMO を見て」と答えたお客様は入りません
- 来場予約のあるお客様も入ります（以前は来場予約のないお客様だけでした）

> 注意：反響一覧を通さずに登録したお客様は入りません。

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

## 反響媒体が SUUMO のとき
顧客情報の「反響媒体」が SUUMO のお客様は、選ぶ欄の下に赤い字で「成約時に【請負金額の5%】の課金が発生します。見積り時はご注意ください。」と出ます（2026年11月から）。
- 見積りを作るときは、この課金を忘れずに考えてください
- 注意書きが出ても、保存はそのままできます

## 閉じている欄（「編集」「閲覧」）
商談ステップ・架電状況・アンケートなどの欄は、はじめは閉じています。
- 閉じている欄は、上の数行が見えて、下へ向かって薄く消えています。開く前でも、だいたいの中身がわかります
- 左の **編集**（HP閲覧履歴は **閲覧**）を押すか、薄くなっている部分を押すと開きます
- 閉じるときは **×閉じる** を押します

> 注意：閉じているあいだに中のボタンを押しても、欄が開くだけでボタンは動きません。開いてから押してください。

## HP閲覧履歴
商談ステップのすぐ上の欄です。そのお客様が、反響を送ったブランドのサイトで**どのページを、いつ見たか**が出ます。
- 上に、訪問の回数・見たページの数・最後に見た日時が出ます
- 訪問（30分以上あくと別の訪問）ごとにまとまり、新しい訪問が上です。訪問の中は見た順に並びます
- ページの名前を押すと、そのページが別のタブで開きます
- 欄が出るのは、サイトのフォームから流入の情報つきで反響が来たお客様だけです

> 注意：記録が始まったのは 2026年10月21日 からです。それより前に見たページは出ません。また、出るのは反響を送ったサイト（ドメイン）の閲覧だけです。

> 要確認：お客様に閲覧履歴の話をそのまま伝えるかどうかは、社内のルールに従ってください。

## 上のボタン
- **キャンセル集計（要回答）**：来場予約日を過ぎても、初回面談もキャンセル理由も空のお客様
- **失注集計（要回答）**：失注理由などが抜けているお客様（[[失注したら]]）

> 注意：個人情報を削除したお客様は、キャンセル集計の件数・来場キャンセルリスト・メニューのキャンセルの件数・[[毎日の確認（要確認）]] の「来場日未入力」には入りません（2026年11月から）。

## 関係する記事
- [[来場予約が入ったら・来場したら]]
- [[契約したら（注文営業）]]
- [[ランク]]

## 個人情報削除
顧客情報の編集の上（お客様の名前の横）の「個人情報削除」を押すと、そのお客様の**氏名・ふりがな・電話番号・メールアドレス・住所**を「********」に置き換え、顧客DBから外します。
- 誰がいつ消したかは、そのお客様の変更履歴に残ります（消した値は残りません）
- 顧客DBの一覧にも、お客様の詳細にも出なくなります（詳細を開こうとすると「個人情報を削除済みのため開けません」と出ます）
- キャンセル集計・来場キャンセルリスト・「来場日未入力」にも出なくなります
- 集計の画面（店舗・担当別反響・反響推移・全社報告用フォーマットなど）の数には、そのまま入ります。数を押して出る一覧では「削除済み顧客」と出て、開けません

> 注意：元に戻せません。押すと確認が出るので、お客様の名前を確かめてから「OK」を押してください。

> 要確認：個人情報を消してよいか（お客様からの削除の依頼など）は、社内のルールに従ってください。
', 20, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-020.md：顧客DB（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '顧客DB（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('顧客DB（建売営業）', 'spec', '画面の使い方', 'お客様の検索と、商談ステップ・ステータス・ランクの入力。', '左のメニュー「顧客DB」。お客様の名前を押すと、顧客情報の編集が開きます。

[[画面:顧客DB]]

## 絞り込み
- ステータス（建売営業の9種類。[[接触・来場したら（建売営業）]]）
- ランク（S〜F。[[ランク（建売営業）]]）
- **追客状況**：追客中（A〜D）／追客終了（E〜H）
- 店舗・担当・反響月・媒体・氏名・電話など

## SUUMO(ポータル反響)
媒体の欄の一番下にある「SUUMO(ポータル反響)」を選ぶと、SUUMO のサイトから届いた反響で取り込んだお客様だけが出ます（2026年11月から。一般スタッフには出ません）。
- 反響一覧から取り込むときに、どのポータルサイトから来た反響かを記録しています。それより前に取り込んだお客様も、反響一覧の記録から付け直してあります
- ホームページのフォームで「SUUMO を見て」と答えたお客様は入りません

> 注意：反響一覧を通さずに登録したお客様は入りません。

## 閉じている欄（「編集」「閲覧」）
顧客情報の架電状況・商談ステップ・備考・HP閲覧履歴の欄は、はじめは閉じています。
- 閉じている欄は、上の数行が見えて、下へ向かって薄く消えています
- 左の **編集**（HP閲覧履歴は **閲覧**）を押すか、薄くなっている部分を押すと開きます。閉じるときは **×閉じる**

> 注意：閉じているあいだに中のボタンを押しても、欄が開くだけでボタンは動きません。開いてから押してください。

## HP閲覧履歴
備考のすぐ下の欄です。そのお客様が、かえるホームのサイトで**どのページを、いつ見たか**が出ます。
- 上に、訪問の回数・見たページの数・最後に見た日時が出ます
- 訪問（30分以上あくと別の訪問）ごとにまとまり、新しい訪問が上です。訪問の中は見た順に並びます
- ページの名前を押すと、そのページが別のタブで開きます
- 欄が出るのは、サイトの問い合わせ（会員登録・来場予約など）と結びついたお客様だけです。結びつけ方は [[アクセス解析]] の「自社のフォームでないサイト」を見てください

> 注意：結びつくのは、サイトのフォームに入力したメールアドレスか電話番号が、反響と同じだったときだけです。また、出るのはタグを入れた日からの閲覧だけです。

> 注意：反響一覧で取り込む前に結びついた反響は、取り込むと顧客にも引き継がれます。取り込んだあとに結びついた場合も、自動で顧客に書き込みます。

> 要確認：お客様に閲覧履歴の話をそのまま伝えるかどうかは、社内のルールに従ってください。

## 個人情報削除
顧客情報の編集の上（お客様の名前の横）の「個人情報削除」を押すと、そのお客様の**氏名・ふりがな・電話番号・メールアドレス・住所**を「********」に置き換え、顧客DBから外します。
- 誰がいつ消したかは、そのお客様の変更履歴に残ります（消した値は残りません）
- 顧客DBの一覧にも、お客様の詳細にも出なくなります（詳細を開こうとすると「個人情報を削除済みのため開けません」と出ます）
- 集計の画面（店舗・担当別反響・反響推移・全社報告用フォーマットなど）の数には、そのまま入ります。数を押して出る一覧では「削除済み顧客」と出て、開けません

> 注意：元に戻せません。押すと確認が出るので、お客様の名前を確かめてから「OK」を押してください。

> 要確認：個人情報を消してよいか（お客様からの削除の依頼など）は、社内のルールに従ってください。
', 20, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
