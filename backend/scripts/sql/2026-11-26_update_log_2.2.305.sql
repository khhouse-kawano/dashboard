-- =====================================================================
-- v2.2.305 ランク・SUUMO掲載順位・重複反響サマリーを必要な分だけ読む／SUUMO掲載順位をページに／鍵のアイコン ＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（mysql / phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.305', '2026-11-26', 'ランク（店舗・担当別反響）を、選んだ月の分だけ読むようにして開くのを速くしました。SUUMO掲載順位を物件DBのボタンから開くページにし、選んだ県の分だけ読むようにしました。重複反響サマリーは開いたときに直近6か月を出します。管理者専用・見られる人を限っているメニューに鍵のアイコンを付けました。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（6本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- spec/screen-050.md：物件DB
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '物件DB';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('物件DB', 'spec', '画面の使い方', '建売の物件の一覧と、ポータルへの掲載状況。', '左のメニュー「物件DB」（建売営業・PC のみ）。いえらぶの物件に、SUUMO・HOME''S・at home の閲覧数（PV）と反響の数を並べて見ます。

[[画面:物件DB]]

## 絞り込み
上の枠で絞り込みます。
- 店舗・ランク・物件名・住所・営業名
- 「自社物件を表示」「契約済みの物件を表示」
- 絞り込みを変えると、1ページ目に戻ります。ページ数は、絞り込んだあとの件数で数えます
- 「表示件数」で、1ページに出す件数（20・50・100・500件）を選べます
- 開いたときは、1ページ分だけを読み込みます。ページを送る・表示件数や絞り込み・並べ替えを変えると、その分を読み直します
- 絞り込み・並べ替え・表示中のページは、画面のアドレス（URL）にも出ます。そのアドレスで開くと、同じ一覧が出ます（共有にも使えます）

## 見方
- 見出しの「反響数」「総PV」「SUUMO」「HOME''S」「athome」を押すと並べ替えられます（もう一度押すと逆の順）
- PV の数字を押すと、そのポータルの掲載の詳しい内容が開きます
- 「詳細」を押すと、物件の詳細（ポータルへの掲載状況・閲覧数・この物件に問い合わせたお客様）が開きます

## SUUMO掲載順位
上の枠の「SUUMO掲載順位」を押すと、別のページで開きます（左のメニューにはありません）。SUUMO での掲載順位を、市町村ごとに並べて見ます。物件DB に戻るときは、左上の「物件DBへ戻る」を押します。
- 初めは最新の取得日の、鹿児島県の順位が出ます。「取得日」で前の日を選ぶと、その日の順位を読み直します
- 県を選ぶと、その県の順位を読み直します。市町村を選ぶと、その市町村だけを出します
- 順位の後ろのかっこは、前回（その日より前の取得日）の順位です
- 前の日や鹿児島県以外の県を選んでいるあいだは、画面のアドレス（URL）にその日・県が出ます。そのアドレスで開くと、同じ日・同じ県の順位が開きます

## 物件の情報について
物件の情報はいえらぶから取り込んでいます。SUUMO・HOME''S・at home の掲載データからも、空いている項目（住所・物件名・間取り・面積・交通・価格など）を補います。いえらぶに無い物件がポータルに載っていれば、その物件も物件DB に加わります。
- いえらぶの値が入っている項目は、ポータルの値で書き換えません
', 50, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-110.md：重複反響サマリー
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '重複反響サマリー';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('重複反響サマリー', 'common', '画面の使い方', '他ブランドにも問い合わせているお客様の数と、その先。どの反響媒体で重なっているか。', 'ヘッダーの「反響管理 → 重複反響サマリー」。電話・メール・住所が、グループの**他ブランド**のお客様と同じ反響を数えます。

[[画面:重複反響サマリー]]

## 見方
- ブランドごとのカードに、総反響・来場・次アポ・契約
- 横棒：どのブランドと重なっているか、相手のブランドでどこまで進んだか
- 期間とエリア（住所の都道府県）で絞れます
- 開いたときの期間は、**今月を含む直近6か月**です。開始月・終了月で「指定なし」を選ぶと、その側は区切りません（両方「指定なし」で全期間）
- 期間やエリアを変えると、その条件で数え直します。変えた条件は画面のアドレス（URL）にも出ます。そのアドレスで開くと、同じ条件で開きます

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
だれでも開けますが、次の項目は見られる人が決まっています。見られない項目はメニューに出ません。見られる人が決まっている項目には、メニューで名前の横に鍵の印が付きます（左のメニューの管理者専用の項目と同じ印です）。
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

## 対象の月
- 上の「対象」で月（または「○年5月期」）を選びます。開いたときは今月です
- 選んだ月の分だけを読み込みます。月を変えると読み直します。ランクや見込み月を直したときも、その月を読み直します
- 選んだ月は画面のアドレス（URL）にも出ます（今月のときは出ません）。そのアドレスで開くと、同じ月が開きます

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

## 対象の月
- 上の「対象」で月（または「○年5月期」）を選びます。開いたときは今月です
- 選んだ月の分だけを読み込みます。月を変えると読み直します。ランクや見込み月を直したときも、その月を読み直します
- 選んだ月は画面のアドレス（URL）にも出ます（今月のときは出ません）。そのアドレスで開くと、同じ月が開きます

## 削除済み顧客
数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
- 来場や契約などの数には、削除する前と同じく入ります
- 名前は出ず、押してもお客様の詳細や商談ステップは開きません

> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
', 30, 1, '開発（業務ガイド更新）')
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

## 対象の月
- 上の「対象」で月（または「○年5月期」）を選びます。開いたときは今月です
- 選んだ月の分だけを読み込みます。月を変えると読み直します。ランクや見込み月を直したときも、その月を読み直します
- 選んだ月は画面のアドレス（URL）にも出ます（今月のときは出ません）。そのアドレスで開くと、同じ月が開きます

## 削除済み顧客
数を押して出るお客様の一覧で「削除済み顧客」と出るのは、顧客DBで個人情報を削除したお客様です。
- 来場や契約などの数には、削除する前と同じく入ります
- 名前は出ず、押してもお客様の詳細や商談ステップは開きません

> 個人情報の削除は、顧客DBのお客様の詳細の上にある「個人情報削除」から行います。
', 30, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
