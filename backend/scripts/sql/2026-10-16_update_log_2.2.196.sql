-- =====================================================================
-- update_log に v2.2.196 を追加する ＋ 業務ガイドの記事
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️ 記事の部分は backend/scripts/guide/build-guide-sql.cjs で作ったもの（⚠️ 手で直さない）。
-- =====================================================================

INSERT INTO update_log (version, date, note) VALUES
('2.2.196', '2026-10-16', '業務ガイドの記事から、説明している画面（帳票・編集画面・ヘッダーのメニューの画面）をダッシュボードの窓で開けるようにした。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（28本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
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
-- common/screen-120.md：紹介キャンペーンサマリー
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '紹介キャンペーンサマリー';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('紹介キャンペーンサマリー', 'common', '画面の使い方', '紹介で来たお客様の歩留まり。', 'ヘッダーの「紹介キャンペーン → 紹介キャンペーンサマリー」。媒体が「紹介」のお客様が、来場・次アポ・契約までどれだけ進んだかを見ます。

[[画面:紹介キャンペーンサマリー]]

- 紹介者の種類・事業・ブランド・エリア・店舗ごとに見られます
- 期間・店舗・エリアで絞れます

> 紹介の反響は、紹介された人がお客様として登録されます（紹介した人ではありません）。
', 120, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-130.md：営業別契約率
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '営業別契約率';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('営業別契約率', 'common', '画面の使い方', '営業ごとの商談顧客数・次アポ・契約と、担当変更理由。', 'ヘッダーの「活動サマリー → 営業別契約率」（マネージャー・管理者のみ）。営業ごとに、商談したお客様のうち何人が次アポ・契約まで進んだかを見ます。

[[画面:営業別契約率]]

## 絞り込み
- **部門**：注文営業／建売営業（変えると、課・店舗の選択は外れます）
- 課・店舗・開始月・終了月（はじめは全期間・全課・全店舗）

## 列の見方
- **商談顧客数**：商談シートに記録があるか、顧客情報に商談の日付が入っているお客様の人数
- **次アポ数**：そのうち第二面談・事前審査・契約まで進んだ人数
- **契約数**：顧客情報の状況が「契約済み」の人数
- **契約率** = 契約数 ÷ 商談顧客数

> 注意：誰の実績かは**今の担当営業**で決めます。担当が変わったお客様は、今の担当の実績になります。

## 担当変更理由（右側の列）
担当が変わる前の営業ごとに、どの理由で担当が変わったかを数えます。

> 注意：右側は**反響取得日**で期間を判定しています。左側（契約率）とは基準が違うので、同じ行でも足したり引いたりできる数字ではありません。

見出しを押すと並べ替えられます。
', 130, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-140.md：契約数ランキング
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '契約数ランキング';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('契約数ランキング', 'common', '画面の使い方', '個人・店舗ごとの契約数の順位。', 'ヘッダーの「活動サマリー → 契約数ランキング」。個人別・店舗別の契約数の順位を見ます。

[[画面:契約数ランキング]]

- 契約として数えるのは [[契約]] の条件を満たすお客様です
- 管理者以外には、上位10位前後だけが表示されます

> 以前は「契約率ランキング」という名前でしたが、中身は契約の数の順位なので名前を直しました。

## 関係する記事
- [[全社報告用フォーマット]]
', 140, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-150.md：Claudeによる分析
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'Claudeによる分析';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('Claudeによる分析', 'common', '画面の使い方', '保存された競合分析のレポートを読む。', 'ヘッダーの左上「Claudeによる分析」。だれでも開けます。

[[画面:Claudeによる分析]] [[画面:Claudeによる競合分析]]

## 上：競合分析のレポート
保存されている競合分析のレポートを読めます。読むだけで、登録・削除は管理者だけができます。ヘッダーの「他社動向 → Claudeによる競合分析」からも同じレポートを読めます。

> レポートを開くと、だれがいつ開いたかが記録されます（どのレポートがよく読まれているかを知るためです）。

## 下：管理者専用
「分析したい内容を選んでください」から下は、**管理者専用**の印が付いた部分です。管理者以外には表示されません。ダッシュボードの数字をもとに、Claude が新しく分析します。
', 150, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-180.md：業務ガイドの使い方
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '業務ガイドの使い方';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('業務ガイドの使い方', 'common', '画面の使い方', 'このガイドの開き方と読み方。', '## 開き方
次の3か所の「業務ガイド」ボタンから開けます（注文営業・建売営業・中古リノベの方向け）。
- ヘッダーの「マーケット情報」の右
- 右上のパネル（[[アクティブユーザー（右上のパネル）]]）
- トップ画面の4つのボタンの下

ガイドは**別のウインドウ**で開きます。作業中の画面と並べて読めます。何度押しても窓は1つで、中身が切り替わります。

## 事業の切り替え
上の「注文営業」「建売営業」「中古リノベ」で、その事業の記事に切り替わります。はじめは、いま選んでいる事業の記事が出ます。全事業に関係する記事には「全事業共通」の印が付き、どの事業にも出ます。

## 読み方
- 左：記事の一覧（分類ごと）。上の検索欄で記事を探せます
- 中央：記事
- 右：記事の中の見出し。押すとそこまで移動します
- 緑の下線の言葉は、別の記事へのリンクです
- 青い「↗ 〜を開く」ボタンは、説明している画面を開くボタンです（下の「画面を開く」）

> 窓を狭くすると右の見出しは消え、左の一覧は「☰」ボタンで開きます。

## 画面を開く
記事の中の青いボタン（例：「↗ 顧客DBを開く」）を押すと、**ダッシュボードの窓**でその画面が開きます。ガイドの窓はそのまま残るので、読みながら操作できます。本文に画面の名前が出てくるところにも、名前のすぐ後ろに小さい「↗ 開く」ボタンが付いています（働きは同じです）。
- ダッシュボードの窓で、ほかの画面（お客様の編集など）を開いているときは、開く前に確認が出ます。「開く」を押すと、いまの画面は閉じるか後ろに隠れます
- 記事の事業と、ダッシュボードで選んでいる事業が違うときは、事業を切り替えて開きます（確認が出ます）
- ダッシュボードの窓を閉じていたときは、ダッシュボードを開き直してから開きます
- 灰色のボタンは、いまは開けない画面です（管理者だけの画面、PC でしか開けない画面など）

> 注意：確認で「開く」を押すと、**保存していない入力は消えることがあります。** 入力の途中なら、先に保存してください。

> ブラウザによっては、ダッシュボードの窓が前に出てこないことがあります。そのときは「ダッシュボードの窓で開きました」と出るので、ダッシュボードの窓に切り替えてください。
', 180, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-190.md：業務ガイドの書き方（編集できる人向け）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '業務ガイドの書き方（編集できる人向け）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('業務ガイドの書き方（編集できる人向け）', 'common', '画面の使い方', '記事を作る・直すときの手順と書き方。', '記事を作ったり直したりできるのは、**マネージャーと管理者**です。

## 直す
1. 記事を開き、右上の「直す」を押す
2. 左に本文を書くと、右にでき上がりが出る
3. 「保存する」を押す

保存すると、直す前の内容は変更履歴に残ります。

## 新しく作る
- 上の「記事を作る」を押す
- または、本文に `[[新しい記事のタイトル]]` と書く → 赤いリンクになるので、押すとそのタイトルで作り始められる

## 書き方
- `## 見出し` `### 小見出し`：右の見出し一覧に出ます
- `[[記事のタイトル]]`：別の記事へのリンク
- `[[画面:顧客DB]]`：その画面を開くボタン（[[業務ガイドの使い方]] の「画面を開く」）。使える名前は、編集画面の「書き方」の一覧にある画面の名前です。名前を間違えると赤い札になります。なお、本文で `「顧客DB」` のように画面の名前をかぎかっこで書くと、書かなくても後ろに小さい「開く」ボタンが付きます
- `> 注意：〜`：黄色の枠
- `> 要確認：〜`：赤い枠（現場で確かめてほしいこと）
- `> 〜`：緑のポイント枠
- `1. 〜`：番号付きの手順、`- 〜`：箇条書き
- `**太字**`：強調

> 注意：表（｜で区切る書き方）は使えません。箇条書きか見出しで書いてください。

> 注意：画面の作りが変わったときは、開発側でも記事を直します。そのとき、手で直した内容より開発側の内容が優先されます（直す前の内容は変更履歴に残ります）。

## 公開しない
「公開する」のチェックを外して保存すると、一般の方には見えなくなります。記事は消えません。
', 190, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/screen-010.md：反響一覧
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響一覧';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響一覧', 'order', '画面の使い方', '届いた反響の確認・割り振り・取込をする画面。', '左のメニュー「反響一覧」。届いた反響を確認して、顧客DBに取り込む画面です。

[[画面:反響一覧]]

## 絞り込み
- 期間（はじめは前月〜今月）
- 店舗・課・媒体
- 取込状況（取込済み／未取込）
- 氏名・住所

## 上の集計
- **反響合計**（括弧内は未同期）
- **反響目標**：営業の人数 × 8（1か月）
- **来場合計**：初回面談の月で数える
- **来場目標**：営業の人数 × 4

## 列の見方
- **重複**：氏名・携帯・メールのうち2つ以上が同じ、別の反響があると表示されます
- **顧客タグ**：重複／ギフト券進呈済み／業者／ブラックリスト

> 注意：ひらがなのフリガナは、取込のときにカタカナへ自動で直ります。

## 関係する記事
- [[反響が来たら]]
', 10, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
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
', 30, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/screen-040.md：反響MAP
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響MAP';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響MAP', 'order', '画面の使い方', 'お客様の住所を地図で見る。', '左のメニュー「反響MAP」。お客様の住所を地図にピンで出し、地域ごとの件数を見ます。

[[画面:反響MAP]]

## 絞り込み
反響月・媒体・ブランド・店舗・年収・住まい（持家／賃貸）

## 3つの表示
- **契約者**
- **来場済み**
- **全反響**（契約者・来場済み以外）

> 注意：3つは重なりません。「全反響」に来場済みや契約者は入っていません。住所から場所が分からなかったお客様は地図に出ません。
', 40, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/screen-050.md：販促媒体別広告費
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '販促媒体別広告費';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('販促媒体別広告費', 'order', '画面の使い方', '媒体ごとの歩留まりと、1件あたりの広告費。', '左のメニュー「販促媒体別広告費」（PC のみ）。媒体ごとに、反響 → 来場 → 次アポ → 契約 の流れと、1件あたりの広告費を見ます。

[[画面:販促媒体別広告費]]

## 絞り込み
開始月〜終了月、店舗・営業課・エリア（どれか1つ）

## 数字の見方
- [[来場率・次アポ率・契約率]]：次アポ率と契約率は、どちらも**来場数**で割ります
- [[反響単価・来場単価・次アポ単価・契約単価]]：広告費 ÷ それぞれの件数
- 件数が0のときは「-」（0円で取れたわけではありません）

> 注意：数え方は [[反響日起算と実績日起算]] の「反響日起算」です。選んだ期間に反響した人が、その後どこまで進んだかを数えます。

「グラフを表示」で、単価を媒体どうしで比べられます。
', 50, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/screen-060.md：店舗別広告費
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '店舗別広告費';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('店舗別広告費', 'order', '画面の使い方', '店舗ごとの歩留まりと、1件あたりの広告費。', '左のメニュー「店舗別広告費」（PC のみ）。[[販促媒体別広告費]] と同じ計算で、行が店舗になります。

[[画面:店舗別広告費]]

- 先頭に「グループ全体」の行が出ます（絞り込み中は出ません）
- 営業の人数の列があります
- 「併売店をまとめる」で、併売店の数字を親店舗に合わせて見られます

> 要確認：媒体で絞り込んだときの広告費の扱いは、画面で確かめてから書き足してください。

## 関係する記事
- [[反響単価・来場単価・次アポ単価・契約単価]]
', 60, 1, '開発（業務ガイド更新）')
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
', 70, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/screen-080.md：カレンダー
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'カレンダー';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('カレンダー', 'order', '画面の使い方', '店舗のイベント予定と、イベントごとの来場の記録。', '左のメニュー「カレンダー」（PC のみ）。店舗ごとのイベント予定を登録します。

[[画面:カレンダー]]

- 「全店舗へ展開」で、同じ予定を全店舗に入れられます
- 日付を開くと、イベントごとの新規来場・有効新規・次アポ・管理客の人数を入力できます
- 「反響集計」では、入力した人数と、顧客情報から数えた実績（括弧内）を並べて見られます
', 80, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/screen-090.md：K-snap登録
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'K-snap登録';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('K-snap登録', 'order', '画面の使い方', '施工写真をお客様向けギャラリーに載せる。', '左のメニュー「K-snap登録」（PC のみ）。施工写真を、お客様向けのギャラリー（k-snap.jp）に載せます。

[[画面:K-snap登録]]

## 必ず入れるもの
写真（複数枚できます）・タグ・カテゴリー1

> 注意：写真は1枚ずつ登録されます。途中で失敗しても、それより前の写真は登録されたまま残ります。

> 注意：備考の固有名詞は全角カタカナで入れます（例：エコカラット）。
', 90, 1, '開発（業務ガイド更新）')
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
', 100, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/screen-160.md：AIデジタル資金計画書
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'AIデジタル資金計画書';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('AIデジタル資金計画書', 'order', '画面の使い方', 'お客様ごとの資金計画書。金利はいつも最新。', '[[顧客DB]] でお客様を開き、下のボタンから「資金計画書」を別ウインドウで開きます（PC のみ）。

[[画面:顧客DB]]

> 注意：新しいお客様は、先に顧客情報を保存してください。保存したあとで資金計画書を作れます。

## 金利について
銀行ごとの住宅ローン金利の比較は、**いつも最新の金利**で表示されます。前に保存した計画書も、開き直すと最新の金利に変わります。

> 要確認：お客様にお渡しした計画書の金利を残したいときの扱い（印刷・PDF で残すなど）は、社内で決めて書き足してください。
', 160, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-010.md：反響一覧（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響一覧（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響一覧（建売営業）', 'spec', '画面の使い方', '届いた反響の確認・割り振り・取込。', '左のメニュー「反響一覧」。届いた反響を確認して、顧客DBに取り込みます。

[[画面:反響一覧]]

## 上の集計
- 反響合計（括弧内は未同期）
- 反響目標：営業の人数 × 8（1か月）
- 来場合計：初回面談の月で数える
- 来場目標：営業の人数 × 4

## 建売営業だけの列
- **物件名**：問い合わせのあった物件
- **希望エリア**

## 関係する記事
- [[反響が来たら（建売営業）]]
', 10, 1, '開発（業務ガイド更新）')
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
', 20, 1, '開発（業務ガイド更新）')
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
', 30, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-040.md：広告費の画面（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '広告費の画面（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('広告費の画面（建売営業）', 'spec', '画面の使い方', '販促媒体別広告費・店舗別広告費の見方（建売営業）。', '左のメニュー「販促媒体別広告費」「店舗別広告費」（PC のみ）。

[[画面:販促媒体別広告費]] [[画面:店舗別広告費]]

## 流れの段階
総反響 → 接触 → 来場・案内 → 申込 → 契約

- **契約率 = 契約 ÷ 申込**（2026年9月に、接触数で割る形から変わりました）
- 単価は、どれも広告費 ÷ その段階の件数です（[[反響単価・来場単価・次アポ単価・契約単価]]）

> 注意：店舗別広告費では、解約になった契約は契約に数えません。建売営業には「併売店をまとめる」はありません。
', 40, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-050.md：物件DB
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '物件DB';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('物件DB', 'spec', '画面の使い方', '建売の物件の一覧と、ポータルへの掲載状況。', '左のメニュー「物件DB」（建売営業・PC のみ）。

[[画面:物件DB]]

- 「自社物件を表示」「契約済みの物件を表示」で絞り込めます
- 物件の詳細では、ポータルへの掲載状況や閲覧数（PV）を見られます
', 50, 1, '開発（業務ガイド更新）')
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
- 契約棟数ランキングがあります（4半期サマリーは注文営業だけ）

## 関係する記事
- [[契約したら（建売営業）]]
', 60, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- used/screen-010.md：反響一覧（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響一覧（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響一覧（中古リノベ）', 'used', '画面の使い方', '届いた反響の確認・取込（中古リノベ）。', '左のメニュー「反響一覧」。

[[画面:反響一覧]]

- 「店舗」の代わりに**カテゴリー**（[[取引区分（中古リノベ）]]）の列があります
- 上の集計は「中専全体」と「カテゴリーごと」に、反響合計・反響目標・来場合計・来場目標

## 関係する記事
- [[反響が来たら（中古リノベ）]]
', 10, 1, '開発（業務ガイド更新）')
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
', 20, 1, '開発（業務ガイド更新）')
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
', 40, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
