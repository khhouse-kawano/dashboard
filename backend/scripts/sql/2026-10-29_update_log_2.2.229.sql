-- =====================================================================
-- update_log に v2.2.229 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.229', '2026-10-29', '顧客DBの「個人情報削除」をした顧客は、顧客DBと顧客詳細には出さず、集計（店舗・担当別反響、店舗別反響推移、販促媒体別反響推移、全社報告用フォーマット）の数には残すようにした。集計の一覧では「削除済み顧客」と出し、開けない。店舗別反響推移の一覧を共通の部品にまとめた。ブラウザのタブの名前を「Dashboard - KHG」にした。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（10本）。backend/scripts/guide/build-guide-sql.cjs で作成
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

## 関係する記事
- [[来場予約が入ったら・来場したら]]
- [[契約したら（注文営業）]]
- [[ランク]]

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
-- used/screen-020.md：顧客DB（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '顧客DB（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('顧客DB（中古リノベ）', 'used', '画面の使い方', 'お客様の検索と編集（中古リノベ）。', '左のメニュー「顧客DB」。お客様の名前を押すと、顧客情報の編集が開きます。

[[画面:顧客DB]]

- ステータス：見込み／契約済み／失注／会社管理
- ランク：S〜E（[[ランク（中古リノベ）]]）
- 「初回通電日」「次回架電日」の列があります
- 「複製」ボタンで、同じお客様を別の取引区分で登録し直せます

## 閉じている欄（「編集」）
顧客情報の商談ステップ・架電状況の欄は、はじめは閉じています。
- 閉じている欄は、上の数行が見えて、下へ向かって薄く消えています
- 左の **編集** を押すか、薄くなっている部分を押すと開きます。閉じるときは **×閉じる**

> 注意：閉じているあいだに中のボタンを押しても、欄が開くだけでボタンは動きません。開いてから押してください。

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
-- order/screen-030.md：店舗・担当別反響
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '店舗・担当別反響';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('店舗・担当別反響', 'order', '画面の使い方', '課・店舗・担当ごとの月の成績と、ランク別の見込み。', '左のメニュー「店舗・担当別反響」。課 → 店舗 → 担当の順に開いて、月ごと（または年度ごと）の成績を見ます。

[[画面:店舗・担当別反響]]

## 列の見方
- **総反響**：反響日で数える
- **来場数・次アポ数**：来場した月で数える
- **契約数（率）**：契約率 = 契約 ÷ 来場
- **当月確約数**：今月の契約 ＋ S ランクの見込み
- **達成率**：契約 ÷ 目標（括弧内は（契約 ＋ S）÷ 目標）
- **S〜D ランク**：今月・来月・再来月に見込むお客様の数

> 数字を押すと、そのお客様の一覧が開き、その場でランクと見込み月を直せます。

> 注意：担当が「〇〇店 管理」に付け替えられたお客様は、前の担当の行で数えます。

## 関係する記事
- [[ランク]]
- [[来場率・次アポ率・契約率]]

## 削除済み顧客
数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
- 来場や契約などの数には、削除する前と同じく入ります
- 名前は出ず、押してもお客様の詳細や商談ステップは開きません

> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
', 30, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/screen-070.md：反響推移（販促媒体別・店舗別）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響推移（販促媒体別・店舗別）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響推移（販促媒体別・店舗別）', 'order', '画面の使い方', '月ごとの反響・来場・次アポ・契約の推移。', '左のメニュー「販促媒体別反響推移」「店舗別反響推移」（PC のみ）。行が媒体（または店舗）、列が月です。

[[画面:販促媒体別反響推移]] [[画面:店舗別反響推移]]

## 見られるもの
- 総反響・実来場・次アポ・契約・広告費
- 昨年の実績
- グラフ
- ポータル反響だけの表示（販促媒体別）

## 数え方
[[反響日起算と実績日起算]] の「実績日起算」です。
- 実来場：その月に初回面談があった人
- 次アポ：来場した月に数える
- 契約：契約日の月に数える
- 来場予約数（店舗別）：実来場 ＋ キャンセル

> 注意：[[販促媒体別広告費]] とは数え方が違うので、同じ月でも数字が合わないことがあります。

数字を押すと、そのお客様の一覧が開きます。

## 削除済み顧客
数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
- 来場や契約などの数には、削除する前と同じく入ります
- 名前は出ず、押してもお客様の詳細や商談ステップは開きません

> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
', 70, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/screen-100.md：全社報告用フォーマット
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '全社報告用フォーマット';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('全社報告用フォーマット', 'order', '画面の使い方', '年度の予算と契約実績を、グループから担当まで。', '左のメニュー「全社報告用フォーマット」。年度（6月〜翌5月）の月ごとの予算と契約実績を、グループ → 事業部 → 課 → 店舗 → 担当 の順に見ます。

[[画面:全社報告用フォーマット]]

- 右側：個人目標・今月の契約・S/A/B/C の見込み数
- 切り替え：昨年の実績・解約の数・併売店をまとめる
- 契約棟数ランキング（個人別・店舗別）
- 4半期サマリー：契約実績と反響実績の報告

## 関係する記事
- [[契約したら（注文営業）]]
- [[ランク]]

## 削除済み顧客
数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
- 来場や契約などの数には、削除する前と同じく入ります
- 名前は出ず、押してもお客様の詳細や商談ステップは開きません

> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
', 100, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-030.md：店舗・担当別反響（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '店舗・担当別反響（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('店舗・担当別反響（建売営業）', 'spec', '画面の使い方', '課・店舗・担当ごとの月の成績と、ランク別の見込み。', '左のメニュー「店舗・担当別反響」。

[[画面:店舗・担当別反響]]

## 列の見方
- **接触数**：通話・メールの返信があった数（建売営業だけの列）
- **来場数**：初回面談または物件案内の日付が、その月の人
- **次アポ数**：2回目以降面談の日付が、その月の人
- **契約数（率）**：ステータスが契約済みで、自社契約日か仲介契約日がその月の人。契約率 = 契約 ÷ 来場
- **S〜F ランク**：契約済みの人は除いて数えます（S は今月に契約日がある人だけ）

> 数え方は、その月に起きた数で数える「実績日起算」です（[[反響日起算と実績日起算]]）。

> 注意：ランクを変えた直後、次アポ数などが一時的に0になることがあります。画面を開き直すと戻ります。

## 削除済み顧客
数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
- 来場や契約などの数には、削除する前と同じく入ります
- 名前は出ず、押してもお客様の詳細や商談ステップは開きません

> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
', 30, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
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

## 削除済み顧客
数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
- 来場や契約などの数には、削除する前と同じく入ります
- 名前は出ず、押してもお客様の詳細や商談ステップは開きません

> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
', 60, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- used/screen-030.md：店舗・担当別反響（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '店舗・担当別反響（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('店舗・担当別反響（中古リノベ）', 'used', '画面の使い方', '月の成績を粗利で見る（中古リノベ）。', '左のメニュー「店舗・担当別反響」。

[[画面:店舗・担当別反響]]

## 列の見方
- 総反響・来場数・次アポ数・契約数（率）
- **粗利額**・**目標粗利**・達成率（括弧内は見込みを含めた達成率）
- 当月確約数
- S〜D ランク（ステータスが「見込み」の人だけ）

## 数え方
- **来場**：初回来場日がその月の人（物件案内は来場に数えません）
- **契約**：ステータスが契約済みで、リフォーム契約日・売買契約日・媒介取得日のどれかがその月の人

> 店舗の行の「中古住宅専門店」は買い:中古リノベ、「不動産企画係」はポータル（買い・売り）です。

## 削除済み顧客
数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
- 来場や契約などの数には、削除する前と同じく入ります
- 名前は出ず、押してもお客様の詳細や商談ステップは開きません

> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
', 30, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- used/screen-040.md：全社報告用フォーマット（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '全社報告用フォーマット（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('全社報告用フォーマット（中古リノベ）', 'used', '画面の使い方', '年度の予算と契約実績を金額で見る（中古リノベ）。', '左のメニュー「全社報告用フォーマット」。中古リノベが先頭に並びます。

[[画面:全社報告用フォーマット]]

- 棟数ではなく**金額（万円）**で出ます
- 契約実績は、契約内容の「予算額（万円）」の合計です
- S/A/B/C の見込みは、リフォーム粗利見込 ＋ 仲介粗利見込 の合計です
- 契約棟数ランキング・4半期サマリーはありません

## 関係する記事
- [[契約したら（中古リノベ）]]

## 削除済み顧客
数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
- 来場や契約などの数には、削除する前と同じく入ります
- 名前は出ず、押してもお客様の詳細や商談ステップは開きません

> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
', 40, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
