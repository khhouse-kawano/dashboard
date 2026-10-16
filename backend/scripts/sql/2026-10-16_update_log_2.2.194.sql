-- =====================================================================
-- update_log に v2.2.194 を追加する ＋ 業務ガイドの記事
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- ⚠️⚠️ **先に 2026-10-16_guide_article.sql（表の作成）を流すこと。** 表が無いと後半の記事の行で止まる。
-- ⚠️ 記事の部分は backend/scripts/guide/build-guide-sql.cjs で作り直したもの（⚠️ 手で直さない）。
-- =====================================================================

INSERT INTO update_log (version, date, note) VALUES
('2.2.194', '2026-10-16', '「業務ガイド」を追加した（注文営業・建売営業・中古リノベ）。用語・画面の使い方・業務の流れを記事で読める。ヘッダー・アクティブユーザー・トップ画面のボタンから別ウインドウで開く。Claudeによる分析のレポートを開いた記録を残すようにした。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（59本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- order/flow-010.md：反響が来たら
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響が来たら';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響が来たら', 'order', '業務の流れ', '届いた反響を確認し、店舗と担当を決めて顧客DBに取り込むまで。', '反響（お問い合わせ）は、ホームページのフォーム・ポータルサイト・イベント予約・紹介などから **[[反響一覧]]** に届きます。取り込むまでは、顧客DBにはまだ載っていません。

## やること
1. [[反響一覧]] を開き、期間を今月にして新しい反響を探す
2. 店舗と担当を決める
3. 重複・業者・いたずらなどは、顧客タグを付けて対象外にする
4. 対象の反響を「取込」して、顧客DBに載せる
5. 担当がお客様に連絡し、来場の予約を取る

> 注意：取り込むと元に戻せません。店舗が「店舗未設定」のままでは取り込めないので、先に店舗を決めてください。

> 要確認：反響が来てから最初の連絡までの目安（当日中など）は、店舗のルールに合わせて書き足してください。

## 取り込まないもの
- 同じ人の2回目の問い合わせ（**重複**のタグ）
- 業者からの営業
- ブラックリストの名簿に一致した人（行が赤く表示されます）

これらはタグを付けると、取込の対象からも、未同期の件数からも外れます。

## 関係する記事
- [[毎日の確認（要確認）]]
- [[反響]]
- [[来場予約が入ったら・来場したら]]
', 10, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/flow-020.md：来場予約が入ったら・来場したら
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '来場予約が入ったら・来場したら';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('来場予約が入ったら・来場したら', 'order', '業務の流れ', '来場予約日と初回面談日の入れ方。キャンセルのときの入力も。', '来場（初回面談）は、すべての数字の起点です。入力が抜けると、店舗の来場数・来場率・広告費の来場単価がすべて実際より悪く見えます。

## 来場予約が入ったら
1. [[顧客DB]] でお客様を開く
2. 来場予約日を入れる

## 来場したら
1. 初回面談の日付を入れる
2. 面談の内容を商談ログに残す
3. 次に会う日（次回アクション日）を決めて入れる

## 来場がキャンセルになったら
初回面談日は入れず、**キャンセル理由**を入れます。

> 注意：来場予約日を過ぎても「初回面談日」も「キャンセル理由」も空のお客様は、[[毎日の確認（要確認）]] の「来場日未入力」に毎日出続けます。

## 関係する記事
- [[来場]]
- [[次アポを取ったら]]
', 20, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/flow-030.md：次アポを取ったら
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '次アポを取ったら';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('次アポを取ったら', 'order', '業務の流れ', '2回目以降の面談・事前審査の入れ方と、ランクの付け方。', '初回面談のあと、もう一度会う約束が取れた状態を **[[次アポ]]** と呼びます。来場した人が契約まで進むかどうかは、ここで大きく分かれます。

## やること
1. 2回目以降の面談の日付を入れる
2. 住宅ローンの事前審査に進んだら、事前審査の日付を入れる
3. [[ランク]] を見直す（次回アポ済みなら少なくとも C ランク）

> 来場の当日に、次に会う日を決めてからお帰りいただくのが基本です。2回目は「資金計画」や「事前審査」など目的をはっきりさせると約束が取りやすくなります。

## 関係する記事
- [[契約したら（注文営業）]]
- [[失注したら]]
', 30, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/flow-040.md：契約したら（注文営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '契約したら（注文営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('契約したら（注文営業）', 'order', '業務の流れ', '契約の入れ方（商談ステップ・ステータス・勝因）と、全社報告用フォーマットでの数え方。', '契約は、お客様の顧客情報で入力します。全社報告用フォーマットや店舗・担当別反響には、入力した内容が自動で集計されます（報告用の画面に直接入れる場所はありません）。

## やること
1. [[顧客DB]] でお客様を開く（反響一覧の「詳細」や、全社報告用フォーマットの数字を押して出る一覧からも開けます）
2. **商談ステップに「契約」を追加**し、契約した日を入れる（この日付が契約日になります）
3. ステータスを **契約済み** にする
4. **勝因の入力**をする
   - 選ばれた理由
   - 他社との差額
   - 競合（比べていた会社）
   - 競合の営業担当者の名前
5. [[ランク]] を S にする

> 注意：契約として数えるのは「契約日が入っていて、ステータスが契約済み（または解約）」のお客様です。どちらか片方だけでは、店舗の契約数にも契約率にも入りません。

> 勝因は、次の商談で同じ競合に勝つための材料になります。失注したときの「敗因」と対で残してください（[[失注したら]]）。

## 全社報告用フォーマットでの数え方
- **契約日の月**で数えます（年度は6月はじまり）
- **契約済み（当月）**：契約日が今月のお客様
- **S/A/B/C の見込み**：ステータスが「見込み」のお客様だけ。契約見込み月が来月以降のお客様は、今月の見込みに入りません
- 予算（目標）は、店舗の行と担当の行に直接入力します

## 解約になったら
ステータスを **解約** にして保存します（契約日・ランクは変えません）。くわしくは [[解約したら]]。

> 要確認：契約したときの社内への報告先・書類の流れは、ここに書き足してください。

## 関係する記事
- [[契約]]
- [[全社報告用フォーマット]]
- [[店舗・担当別反響]]
', 40, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/flow-050.md：失注したら
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '失注したら';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('失注したら', 'order', '業務の流れ', '失注の入れ方。競合に負けたときに必ず残してほしいこと。', '## やること
1. ステータスを **失注** にする
2. **失注理由**を選ぶ
3. 失注理由が「競合負け」のときは、次の3つも入れる
   - 失注先（どの会社に決めたか）
   - 他決理由（お客様がその会社を選んだ理由）
   - 敗因（こちらに足りなかったこと）

> 注意：失注理由が空のもの、「競合負け」なのに失注先・他決理由・敗因のどれかが空のものは、顧客DBの「失注集計（要回答）」とメニューの「失注未入力」に数えられます。

## なぜ大事か
「どこに・なぜ負けたか」が残っていないと、価格・商品・提案のどこを直せばよいかが分かりません。理由を「その他」にせず、できるだけ具体的に書いてください。

## 関係する記事
- [[次アポを取ったら]]
- [[重複反響サマリー]]
', 50, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/flow-060.md：毎日の確認（要確認）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '毎日の確認（要確認）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('毎日の確認（要確認）', 'order', '業務の流れ', '画面を開くと出る「要確認」の見方と、それぞれの対応。', '事業を選んで画面を移ると、「要確認」の画面が出ます。放置を見えるようにするため、**担当に関係なく全社分**が出ます。

## 出てくる表と、やること
1. **本日要連絡**：次回アクション日・次回架電日が今日のお客様 → 連絡する
2. **未同期**：まだ取り込まれていない反響 → [[反響が来たら]]
3. **来場日未入力**：来場予約日を過ぎても入力がないお客様 → [[来場予約が入ったら・来場したら]]
4. **本日の初回面談・事前審査・2回目以降面談・契約**：今日が予定日のお客様 → 準備の確認

> 放置日数の色：2日まで＝薄い黄、3〜5日＝橙、6日以上＝赤。

## 閉じ方
- 「確認しました」を押すと、その日はもう自動では出ません
- 背景を押して閉じただけだと、画面を移るとまた出ます
- ヘッダーの「活動サマリー → アクションボード」から、いつでも開けます

> 注意：一覧は5分ごとに更新されます。入力した直後は、まだ前の件数が出ることがあります。
', 60, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/screen-010.md：反響一覧
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響一覧';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響一覧', 'order', '画面の使い方', '届いた反響の確認・割り振り・取込をする画面。', '左のメニュー「反響一覧」。届いた反響を確認して、顧客DBに取り込む画面です。

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

> 注意：新しいお客様は、先に顧客情報を保存してください。保存したあとで資金計画書を作れます。

## 金利について
銀行ごとの住宅ローン金利の比較は、**いつも最新の金利**で表示されます。前に保存した計画書も、開き直すと最新の金利に変わります。

> 要確認：お客様にお渡しした計画書の金利を残したいときの扱い（印刷・PDF で残すなど）は、社内で決めて書き足してください。
', 160, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/term-010.md：反響
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響', 'order', '用語', 'お客様からの最初の問い合わせ。', 'お客様からの最初のお問い合わせです。資料請求・来場予約・イベント予約・紹介などがあります。

- **反響日**：問い合わせが届いた日
- 届いた反響は [[反響一覧]] から顧客DBに取り込みます（[[反響が来たら]]）
', 10, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/term-020.md：来場
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '来場';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('来場', 'order', '用語', 'お客様と初めて会って面談したこと。', 'お客様と初めて会って面談したこと（初回面談）です。

> 広告費の画面（[[販促媒体別広告費]]・[[店舗別広告費]]）では、初回面談の日付がなくても、2回目以降の面談・事前審査・契約の日付があれば来場として数えます。

- 入れ方：[[来場予約が入ったら・来場したら]]
- 来場率：[[来場率・次アポ率・契約率]]
', 20, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/term-030.md：次アポ
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '次アポ';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('次アポ', 'order', '用語', '初回面談のあと、もう一度会う約束が取れたこと。', '初回面談のあと、商談が先に進んだことです。2回目以降の面談・事前審査・契約の、どれかの日付が入っているお客様を数えます。

- 入れ方：[[次アポを取ったら]]
- 次アポ率 = 次アポ ÷ 来場（[[来場率・次アポ率・契約率]]）
', 30, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/term-040.md：契約
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '契約';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('契約', 'order', '用語', '契約日が入っていて、ステータスが契約済みのお客様。', '**契約日が入っていて、ステータスが「契約済み」または「解約」**のお客様を契約として数えます。

> 注意：契約日だけ、ステータスだけでは数えられません。

- 入れ方：[[契約したら（注文営業）]]
', 40, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/term-050.md：ランク
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'ランク';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('ランク', 'order', '用語', 'S〜D の見込みの度合いと、それぞれの目安。', '見込みのお客様が、どれくらい契約に近いかを表します。顧客情報の「ランク設定」でチェックを付けると、自動で決まります。

## 目安
- **S（契約確定・95%）**：土地の内諾・契約日の決定・入金済み
- **A（契約確度が高い・90%）**：土地の買付受領・建築申込
- **B（勝算あり・60%）**：建築の意思あり・事前審査の承諾・候補地あり（プラン提案中）
- **C（見込み案件・40%）**：次回アポ済み・LINE などで連絡が取れる・事前審査の提出
- **D**：中長期で追いかけるお客様

C → B → A → S の順に、各段階の項目がすべてそろうと上がります。どれもそろわなければ D です。

> 注意：ランク別の集計は、ステータスが「見込み」のお客様だけが対象です。

> 要確認：E ランクの使い方は決まっていません。社内で決めて書き足してください。
', 50, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- order/term-060.md：来場率・次アポ率・契約率
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '来場率・次アポ率・契約率';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('来場率・次アポ率・契約率', 'order', '用語', '歩留まりの3つの率と、その割り方。', '- **来場率** = 来場 ÷ 反響
- **次アポ率** = 次アポ ÷ **来場**
- **契約率** = 契約 ÷ **来場**

> 次アポ率と契約率は、反響ではなく**来場**で割ります。来場してからの商談の強さを見るためです。

## 関係する記事
- [[来場]]・[[次アポ]]・[[契約]]
', 60, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/flow-010.md：反響が来たら（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響が来たら（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響が来たら（建売営業）', 'spec', '業務の流れ', '新しいお客様に接触できるまで、必ずやること。', '## まず確認すること
[[反響一覧（建売営業）]] で、**担当者・反響元**が正しく入っているかを確かめます。

## 接触できるまで必ずやること
[[顧客ルール（建売営業）]] に沿って、意識して新規対応をします。
- **電話**：かける回数・かけるタイミング
- **メール・ショートメール・手紙**：返事をしやすい内容になっているか
- **資料送付**：最新の情報か、内容に間違いがないか

> 注意：**1名簿に架電10回は必須**です。商談履歴などの詳細も、ダッシュボードに必ず入力してください。

> 架電の回数と帳票の入力は、やるかやらないかだけで、営業のスキルは要りません。架電や入力ができない場合は、反響の割り振りを止めることもあります。

## 取り込み
1. 店舗と担当を決める
2. 重複・業者などは顧客タグを付けて対象外にする
3. 「取込」で顧客DBに載せる（取り込むと元に戻せません）

## 関係する記事
- [[接触・来場したら（建売営業）]]
- [[ランク（建売営業）]]
', 10, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/flow-020.md：接触・来場したら（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '接触・来場したら（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('接触・来場したら（建売営業）', 'spec', '業務の流れ', '接触から申し込みまでの商談ステップとステータスの入れ方。', 'お客様とのやり取りは、顧客情報の**商談ステップ**に日付とアクションを追加して残します。

## 商談ステップのアクション
- 接触（通話・返信）
- 初回面談
- 次回アクション日
- 2回目以降面談
- 申し込み
- 自社契約・仲介契約（[[契約したら（建売営業）]]）

## ステータスの進め方
追客中 → 接触（通話・返信） → アポイント確定 → 来店あり → 申込み済み → 事前取得（現金確認含む） → 契約済み

追いかけるのをやめるときは「追客終了」、契約後に取り消しになったら「解約」にします。

> 注意：建売営業には「見込み」「失注」のステータスはありません。

> 先の段階の日付が入っていれば、手前の段階も済んだものとして数えます（例：申し込みの日付だけでも来場に数えます）。

## 関係する記事
- [[来場・次アポ・契約（建売営業）]]
- [[ランク（建売営業）]]
', 20, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/flow-030.md：契約したら（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '契約したら（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('契約したら（建売営業）', 'spec', '業務の流れ', '自社契約・仲介契約の入れ方と、全社報告用フォーマットでの数え方。', '## やること
1. 顧客情報を開く
2. **商談ステップに「自社契約(物件名)」または「仲介契約(物件名)」を追加**し、契約した日を入れる（この日付が契約日になります）
3. ステータスを **契約済み** にする
4. [[ランク（建売営業）]] を S（契約済み）にする

> 物件名は、お客様に登録されている物件から選びます。選んだ物件が契約物件として残ります。

## 全社報告用フォーマットでの数え方
- **契約日の月**で数えます（年度は6月はじまり）
- **自社契約**の日付が棟数になります。**仲介契約**の件数は緑の（ ）で別に出ます
- S/A/B/C の見込みは、ステータスに関係なくランクで数えます。S は「今月に契約した人」だけです

## 解約になったら
ステータスを **解約** にして保存します（契約日・ランクは変えません）。くわしくは [[解約したら]]。

## 関係する記事
- [[全社報告用フォーマット（建売営業）]]
', 30, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/flow-040.md：毎日の確認（要確認）（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '毎日の確認（要確認）（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('毎日の確認（要確認）（建売営業）', 'spec', '業務の流れ', '画面を開くと出る「要確認」の見方。', '事業を選んで画面を移ると「要確認」が出ます。担当に関係なく全社分が出ます。

## 出てくる表
1. **本日要連絡**：次回アクション日・次回架電日が今日のお客様
2. **未同期**：まだ取り込まれていない反響（2026年8月以降の分）→ [[反響が来たら（建売営業）]]
3. **本日の予定**：今日の接触・初回面談・2回目以降面談・申し込み・自社契約・仲介契約

「確認しました」を押すと、その日はもう自動では出ません。

> 注意：一覧は5分ごとに更新されます。入力した直後は、まだ前の件数が出ることがあります。
', 40, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/screen-010.md：反響一覧（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響一覧（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響一覧（建売営業）', 'spec', '画面の使い方', '届いた反響の確認・割り振り・取込。', '左のメニュー「反響一覧」。届いた反響を確認して、顧客DBに取り込みます。

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

- 月ごとの予算と契約実績を、事業部 → 課 → 店舗 → 担当 の順に見ます
- 自社契約が棟数、仲介契約は緑の（ ）で別に出ます
- S/A/B/C の見込みは、ランクで数えます（S は今月に契約した人だけ）
- 契約棟数ランキングがあります（4半期サマリーは注文営業だけ）

## 関係する記事
- [[契約したら（建売営業）]]
', 60, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/term-010.md：ランク（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'ランク（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('ランク（建売営業）', 'spec', '用語', 'S〜F のランクの意味（建売営業）。', '## ランクの定義
- **S**：契約済み
- **A**：契約予定（申込みあり）
- **B**：次回結論
- **C**：商談案件
- **D**：追客保有名簿
- **E**：フリー顧客（だれが架電してもよい）
- **F**：没（理由をはっきりさせ、上長の承認を得る）

S〜D は、全社報告用フォーマットや店舗・担当別反響などの一覧に出ます。

> 注意：ランクを E 以下に落とすときは、**理由を必ず入力**してください。

## 関連するルール
- [[顧客ルール（建売営業）]]
', 10, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/term-020.md：顧客ルール（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '顧客ルール（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('顧客ルール（建売営業）', 'spec', '用語', 'ランクごとのルール・保有件数の上限・新規対応で必ずやること。', '## 保有顧客の上限
- **A〜D の保有顧客は 25件まで**（時期によって、ローンが通る人は上限を超えてもかまいません）
- E ランク以下に落とすときは、理由を必ず入力する
- F（没）にするときは、理由をはっきりさせて上長の承認を得る

## 新しいお客様に接触できるまで必ずやること
1. ダッシュボードで新規の入力を確認する（担当者・反響元など確実に）
2. マニュアルに沿って、意識して対応する
   - 電話：かける回数・かけるタイミング
   - メール・ショートメール・手紙：返事をしやすい内容か
   - 資料送付：最新の情報か、間違いがないか

> 注意：**1名簿に架電10回は必須**です。商談履歴などの詳細入力も徹底してください。

> 架電・帳票の入力ができない場合は、反響の割り振りを止めることがあります。

## 関係する記事
- [[ランク（建売営業）]]
- [[反響が来たら（建売営業）]]
', 20, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- spec/term-030.md：来場・次アポ・契約（建売営業）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '来場・次アポ・契約（建売営業）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('来場・次アポ・契約（建売営業）', 'spec', '用語', '建売営業での数え方。', '- **来場**：初回面談または**物件案内**の日付がある人（物件案内は今は選べなくなっており、過去の記録だけが数えられます）
- **次アポ**：2回目以降面談の日付がある人
- **契約**：ステータスが契約済みで、**自社契約日か仲介契約日**がある人

> 先の段階の日付が入っていれば、手前の段階も済んだものとして数えます。

## 関係する記事
- [[店舗・担当別反響（建売営業）]]
', 30, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- used/flow-010.md：反響が来たら（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響が来たら（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響が来たら（中古リノベ）', 'used', '業務の流れ', '届いた反響を確認し、顧客DBに取り込むまで。', '[[反響一覧（中古リノベ）]] で新しい反響を確かめ、取り込みます。

1. **カテゴリー（取引区分）**を確かめる：買い:中古リノベ／買い:ポータル／売り:ポータル
2. 担当を決める
3. 重複・業者などは顧客タグを付けて対象外にする
4. 「取込」で顧客DBに載せる（取り込むと元に戻せません）

> 要確認：最初の連絡までの目安や、架電の回数のルールは、ここに書き足してください。

## 関係する記事
- [[取引区分（中古リノベ）]]
- [[来場・物件案内のあと（中古リノベ）]]
', 10, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- used/flow-020.md：来場・物件案内のあと（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '来場・物件案内のあと（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('来場・物件案内のあと（中古リノベ）', 'used', '業務の流れ', '商談ステップの入れ方（取引区分ごとに違います）。', 'お客様とのやり取りは、顧客情報の**商談ステップ**に日付とアクションを追加して残します。選べるアクションは[[取引区分（中古リノベ）]]で変わります。

## 買い:中古リノベ
初回来場 → 物件案内 → 2回目以降面談 → 2回目以降物件案内 → 事前審査 → ★リフォーム契約 → ★売買契約

## 買い:ポータル
初回来場 → 物件案内 → 2回目以降面談 → 2回目以降物件案内 → 事前審査 → ★売買契約（リフォーム契約はありません）

## 売り:ポータル
査定アポ → 査定書提出 → 訪問査定 → ★媒介取得

> ★の付いたものが契約のアクションです（[[契約したら（中古リノベ）]]）。

> 注意：物件案内は来場には数えません。来場は「初回来場」の日付で数えます。
', 20, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- used/flow-030.md：契約したら（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '契約したら（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('契約したら（中古リノベ）', 'used', '業務の流れ', '契約の入れ方（契約内容・粗利見込）と、全社報告用フォーマットでの数え方。', '## やること
1. 顧客情報を開く
2. **商談ステップに ★リフォーム契約・★売買契約・★媒介取得 のどれかを追加**し、契約した日を入れる
3. ステータスを **★契約済み** にする
4. **契約内容**の欄に、予算額（万円）と予算の詳細を入れる
5. **リフォーム粗利見込**・**仲介粗利見込**を入れる
6. [[ランク（中古リノベ）]] と契約見込み月を見直す

## 全社報告用フォーマットでの数え方
- 中古リノベは、棟数ではなく**金額（万円）**で数えます。契約実績は「予算額（万円）」の合計です
- **契約日の月**で数えます（3つの契約日のどれか。年度は6月はじまり）
- S/A/B/C の見込みの金額は、リフォーム粗利見込 ＋ 仲介粗利見込 の合計です（ステータスが「見込み」の人だけ）

## 解約になったら
ステータスを **解約** にして保存します（契約日・ランクは変えません）。くわしくは [[解約したら]]。

## 関係する記事
- [[全社報告用フォーマット（中古リノベ）]]
- [[店舗・担当別反響（中古リノベ）]]
', 30, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- used/flow-040.md：毎日の確認（要確認）（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '毎日の確認（要確認）（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('毎日の確認（要確認）（中古リノベ）', 'used', '業務の流れ', '画面を開くと出る「要確認」の見方。', '事業を選んで画面を移ると「要確認」が出ます。担当に関係なく全社分が出ます。

## 出てくる表
1. **本日要連絡**：次回アクション日・次回架電日が今日のお客様
2. **未同期**：まだ取り込まれていない反響（2026年8月以降の、買い:中古リノベの分）→ [[反響が来たら（中古リノベ）]]
3. **本日の予定**：今日の予定（取引区分によって、物件案内・査定アポなど表の名前が変わります）

「確認しました」を押すと、その日はもう自動では出ません。
', 40, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- used/screen-010.md：反響一覧（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響一覧（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響一覧（中古リノベ）', 'used', '画面の使い方', '届いた反響の確認・取込（中古リノベ）。', '左のメニュー「反響一覧」。

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

- 棟数ではなく**金額（万円）**で出ます
- 契約実績は、契約内容の「予算額（万円）」の合計です
- S/A/B/C の見込みは、リフォーム粗利見込 ＋ 仲介粗利見込 の合計です
- 契約棟数ランキング・4半期サマリーはありません

## 関係する記事
- [[契約したら（中古リノベ）]]
', 40, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- used/term-010.md：ランク（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'ランク（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('ランク（中古リノベ）', 'used', '用語', 'S〜E のランクの目安（中古リノベ）。', '- **S（契約確定・95%）**
- **A（確度が高い・90%）**
- **B（勝算あり・60%）**
- **C（見込み・40%）**
- **D（追客中）**

> 注意：ランク別の集計は、ステータスが「見込み」のお客様だけが対象です。

> 要確認：各ランクに上げる条件と、E ランクの使い方は、社内で決めて書き足してください。
', 10, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- used/term-020.md：取引区分（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '取引区分（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('取引区分（中古リノベ）', 'used', '用語', '買い:中古リノベ・買い:ポータル・売り:ポータルの違い。', '中古リノベのお客様は、取引の種類（取引区分）で分けます。反響一覧では「カテゴリー」の列です。

- **買い:中古リノベ**：中古住宅を買ってリノベーションするお客様
- **買い:ポータル**：ポータルサイトから物件を買いたいお客様
- **売り:ポータル**：家を売りたいお客様（査定から媒介取得まで）

取引区分によって、商談ステップで選べるアクションが変わります（[[来場・物件案内のあと（中古リノベ）]]）。
', 20, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- used/term-030.md：来場・次アポ・契約（中古リノベ）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '来場・次アポ・契約（中古リノベ）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('来場・次アポ・契約（中古リノベ）', 'used', '用語', '中古リノベでの数え方。', '- **来場**：初回来場日がある人。初回来場日が空でも、2回目以降面談・事前審査・リフォーム契約のどれかがあれば数えます
- **次アポ**：初回来場のあと、2回目以降面談・事前審査・リフォーム契約のどれかがある人
- **契約**：ステータスが契約済みで、リフォーム契約日・売買契約日・媒介取得日のどれかがある人

> 注意：物件案内は来場に数えません。
', 30, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/flow-045.md：解約したら
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '解約したら';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('解約したら', 'common', '業務の流れ', '契約したお客様が解約になったときの入れ方（全事業共通）。', '## やること
1. 左のメニュー「顧客DB」で該当のお客様を開く
2. ステータスを **解約** にする
3. 保存する

> 注意：**契約日やランクは変えなくてかまいません。** ステータスを「解約」にして保存するだけです。

> ダッシュボードには「いつ・だれが契約したか」という事実を残す必要があります。そのため、解約になっても契約日や担当は消さずにそのまま残します。

## 数字への出方
- **注文営業・建売営業**：全社報告用フォーマットでは、契約日が残っているので契約の数には入ったままです。「キャンセル数を表示」にチェックを付けると、そのうちの解約の数が赤い印で出ます。建売営業の店舗別広告費では、解約は契約に数えません。
- **中古リノベ**：「契約済み」だけを集計するので、解約は契約の数に入りません。

## 関係する記事
- [[契約したら（注文営業）]]
- [[契約したら（建売営業）]]
- [[契約したら（中古リノベ）]]
', 45, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-110.md：重複反響サマリー
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '重複反響サマリー';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('重複反響サマリー', 'common', '画面の使い方', '他ブランドにも問い合わせているお客様の数と、その先。', 'ヘッダーの「反響管理 → 重複反響サマリー」。電話・メール・住所が、グループの**他ブランド**のお客様と同じ反響を数えます。

## 見方
- ブランドごとのカードに、総反響・来場・次アポ・契約
- 横棒：どのブランドと重なっているか、相手のブランドでどこまで進んだか
- 期間とエリア（住所の都道府県）で絞れます

> 注意：ここでいう「重複」は、顧客のステータスの「重複」（同じ人の2回目の問い合わせ）とは別のものです（[[重複（2つの意味）]]）。
', 110, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-120.md：紹介キャンペーンサマリー
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '紹介キャンペーンサマリー';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('紹介キャンペーンサマリー', 'common', '画面の使い方', '紹介で来たお客様の歩留まり。', 'ヘッダーの「紹介キャンペーン → 紹介キャンペーンサマリー」。媒体が「紹介」のお客様が、来場・次アポ・契約までどれだけ進んだかを見ます。

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

## 上：競合分析のレポート
保存されている競合分析のレポートを読めます。読むだけで、登録・削除は管理者だけができます。ヘッダーの「他社動向 → Claudeによる競合分析」からも同じレポートを読めます。

> レポートを開くと、だれがいつ開いたかが記録されます（どのレポートがよく読まれているかを知るためです）。

## 下：管理者専用
「分析したい内容を選んでください」から下は、**管理者専用**の印が付いた部分です。管理者以外には表示されません。ダッシュボードの数字をもとに、Claude が新しく分析します。
', 150, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-170.md：アクティブユーザー（右上のパネル）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'アクティブユーザー（右上のパネル）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('アクティブユーザー（右上のパネル）', 'common', '画面の使い方', '右上のパネルの見方と、隠し方・戻し方。', '画面の右上に出ているパネルです（PC のみ）。

## できること
- **要確認**：その日に確認するお客様の一覧を開く
- **業務ガイド**：このガイドを別ウインドウで開く（[[業務ガイドの使い方]]）
- 自分の名前と、いま使っている人の数
- **▾**：使っている人の一覧を開く・閉じる
- **×**：パネルを右端に隠す

## 隠したパネルを戻すには
右端に残る「‹ ● 人数」のつまみを押します。隠した状態は、ほかの画面へ移っても、再読み込みしても保たれます。

> パネルはドラッグで好きな場所へ動かせます。
', 170, 1, '開発（業務ガイド更新）')
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

> 窓を狭くすると右の見出しは消え、左の一覧は「☰」ボタンで開きます。
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
-- common/term-070.md：反響単価・来場単価・次アポ単価・契約単価
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響単価・来場単価・次アポ単価・契約単価';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響単価・来場単価・次アポ単価・契約単価', 'common', '用語', '広告費を件数で割った、1件あたりの費用。', 'どれも **広告費 ÷ その段階の件数** です。分母だけが変わります。

- **反響単価**：反響1件あたり
- **来場単価**：来場1件あたり
- **次アポ単価**：次アポ1件あたり
- **契約単価**：契約1件あたり

> 反響単価が安い媒体でも、来場につながらなければ来場単価は高くなります。媒体を比べるときは、来場単価・次アポ単価まで見てください。

件数が0のときは「-」と表示します。
', 70, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/term-080.md：反響日起算と実績日起算
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '反響日起算と実績日起算';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('反響日起算と実績日起算', 'common', '用語', '同じ月でも画面によって数字が違う理由。', '画面によって、来場や契約を「どの月に数えるか」が違います。

## 反響日起算
その月に**反響した人**が、その後どこまで進んだかを数えます。
- 使う画面：[[販促媒体別広告費]]・[[店舗別広告費]]
- 媒体や店舗の「質」を比べるのに向いています

## 実績日起算
その月に**来場・契約が起きた数**を数えます。
- 使う画面：[[反響推移（販促媒体別・店舗別）]]・[[店舗・担当別反響]]
- 月の成績を見るのに向いています

> 同じ月でも数字が合わないのは、数え方が違うからです。不具合ではありません。
', 80, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/term-090.md：重複（2つの意味）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '重複（2つの意味）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('重複（2つの意味）', 'common', '用語', 'ステータスの「重複」と、重複反響サマリーの「重複」の違い。', '「重複」には2つの意味があります。

## 1. ステータス・顧客タグの「重複」
**同じ人が同じブランドに2回目の問い合わせ**をしたもの。取り込まず、数字にも入れません。

## 2. 重複反響サマリーの「重複」
電話・メール・住所が、**グループの他ブランド**のお客様と同じ反響。お客様としては有効です。

> 2つ目は「他ブランドとも比べているお客様」という意味です。[[重複反響サマリー]] で、相手のブランドでどこまで進んだかを見られます。
', 90, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
