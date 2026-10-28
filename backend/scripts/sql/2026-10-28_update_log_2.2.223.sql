-- =====================================================================
-- update_log に v2.2.223 を追加する
--
-- ⚠️ `no` は AUTO_INCREMENT なので指定しないこと。
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.223', '2026-10-28', '不動産企画係に「週次行動計画」「コンプライアンス」「設定」の画面を追加した（第3段。以前のアプリから移植）。設定では期首年月・担当者と予算・目標・反響元・買いポータル・反響単価・営業テンプレート・宅建業者情報を直せる。週次行動計画は週ごとの目標と実績を入れ、架電実績は売り反響の架電記録から自動で数える。あわせて、不動産企画係の画面を再読み込みすると真っ白になる不具合を直した（画面のアドレスを以前の形 /summary などに戻した）。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（5本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-230.md：不動産企画係の画面（入口と権限）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '不動産企画係の画面（入口と権限）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('不動産企画係の画面（入口と権限）', 'common', '画面の使い方', '不動産企画係の画面に入れる人と、入り方。', '不動産企画係の画面（チームサマリー・月次報告書・売り反響・買い反響・商談案件・買取再販案件・週次行動計画・コンプライアンス・設定・媒介獲得台帳）は、Dashboard の中の不動産企画係専用のアプリです。

## 入れる人
- 担当事業が「**不動産企画係**」の人
- 担当事業が「**全事業**」の人

ほかの担当事業（注文・建売・中古）の人は入れません。画面のアドレスを直接開いても、事業を選ぶ画面に戻ります。

> 注意：媒介獲得台帳のデータは、中古リノベの顧客DB・顧客詳細からも読み書きします。そのため中古リノベの人も、その画面からは今までどおり使えます。

## 入り方
1. Dashboard にログインする
2. 事業を選ぶ画面で「**不動産企画係**」を押す
3. チームサマリーが開く。左のメニューから各画面へ移る

## 担当事業を「不動産企画係」にする
ヘッダーの「システム管理 → 権限編集」で、その人の担当事業を「不動産企画係」に変えます（変えられるのは管理者だけです）。

> 注意：変えたあと、本人が次に画面を移ったときに反映されます。ログインし直す必要はありません。

## 通知
画面の右上のベルに出る通知は、**ログインしている本人宛のものだけ**です。

## ブックマーク
画面のアドレスは、以前と同じ形（/summary・/leadSell など）です。

> 要確認：10月28日ごろの短い期間だけ、アドレスが /realty/summary のような形になっていました。この形をブックマークした人は、開くと画面が真っ白になります。左のメニューから開き直して、ブックマークを付け直してください。
', 230, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-240.md：チームサマリー（不動産企画係）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'チームサマリー（不動産企画係）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('チームサマリー（不動産企画係）', 'common', '画面の使い方', '不動産企画係の、今日やること・歩留まり・年間予算の進捗・担当者別の月次KPI・架電実績・朝礼用アラート。', '不動産企画係の画面の最初のページです。事業を選ぶ画面で「不動産企画係」を押すと開きます（[[不動産企画係の画面（入口と権限）]]）。

## 対象月
左上で月を選びます。選べるのは**今期の12か月**です（期首月は設定の値。いまは6月はじまり）。

## 上から順に
- **営業司令塔**：次回アクションの期日超過・本日・未設定、停滞、ホットな反響。「開く」でその反響を直せます
- **歩留まりファネル**：対象月に受信した売り反響・買い反響が、どこまで進んだか
- **年間予算進捗**：期首から対象月までの**売上計上額の累計**を、担当者の年間予算の合計で割ったもの。経過月数に比べて遅れていれば赤、先行していれば緑です
- **月次KPIサマリー**：担当者ごとの今月目標・今月見込の売上・達成率・契約件数・媒介獲得・未決の案件など
- **架電実績**：担当者ごとの本日・今週（月曜はじまり）・今月の架電の数（売り・買い）
- **一括査定KPI・買い反響KPI**：対象月に受信した反響の通電率・査定率・受託率・単価など
- **朝礼用アラート**：直近14日に商談リストへ登録された案件と、新しく獲得した媒介。14日を過ぎると自動で外れます

## 売上の数え方
- **売上計上額 ＝ 仲介手数料 ＋ リフォーム粗利**。リフォームの受注額は売上に入れず、参考として出します
- 商談案件の**契約日の月**で数えます。失注した案件は数えません
- 仲介手数料は、手数料を手で入れた案件はその金額、それ以外は売買価格から計算します（800万円以下は30万円、それより上は価格の3％＋6万円）
- 共同担当がいる案件は、売上は割合で分け、件数は0.5件ずつ数えます
- 契約率は、失注を除いた案件のうち、契約済・契約予定・決済完了の割合です

> 注意：担当者・年間予算・今月目標・媒介受託の目標・反響単価・期首月は、[[設定（不動産企画係）]]の値です。

> 要確認：以前のアプリにあとから入力された分は、まだこの画面に入っていません。以前のアプリと数字を見比べるのは、全データを取り込んだあとです。
', 240, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-250.md：週次行動計画（不動産企画係）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '週次行動計画（不動産企画係）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('週次行動計画（不動産企画係）', 'common', '画面の使い方', '担当者ごとに、週の架電・追客・内見・商談の目標と実績を入れて、達成率を見る。', '不動産企画係の左のメニュー「週次行動計画」で開きます。担当者ごと・週ごとに、架電・追客・内見・商談の目標と実績を入れて、達成率を見ます。

## 月を選ぶ
左上で月を選びます。選べるのは今期の12か月です（期首月は[[設定（不動産企画係）]]の値）。

## 入れ方
- **黄色のマス＝目標**、**白のマス＝実績**です。半角の整数（0〜99999）で入れます
- マスを離れるか Enter を押すと保存します
- 週の区切りは、1〜7日が第1週、8〜14日が第2週、15〜21日が第3週、22日から月末までが第4週です
- 「📋 前週コピー」を押すと、前の週（第1週は前の月の第4週）の目標を、その週にまとめて写します

## 架電実績は自動で数える
架電実績は手で入れません。売り反響で「📞架電」を記録した数を、**架電した人**ごと・週ごとに数えます。
- 買い反響、LINE、メールは数えません
- 数字が古いときは「🔄 架電実績を再集計」を押します

## 達成率の色
- 緑：100%以上
- 黄：80%以上
- 赤：80%未満

目標が0のマスには色を付けません。「達成率平均」は、目標が入っている項目の達成率の平均です（1項目あたり200%で頭打ち）。

## 締めた月は目標を直せない
前の月より前の月は、翌月5日を過ぎると目標を直せません（🔒が出ます）。実績はいつでも直せます。

> 注意：締めた月の目標を直せるのは、権限が「マスター」か「マネージャー」の人だけです。

## 下の表
「担当者別 月次計」は、その月の4週分を担当者ごとに足したものです。

> 注意：担当者は[[設定（不動産企画係）]]で登録した人です。担当者を追加すると、その人の行が自動で増えます。
', 250, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-260.md：コンプライアンス（不動産企画係）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'コンプライアンス（不動産企画係）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('コンプライアンス（不動産企画係）', 'common', '画面の使い方', '取引ごとに、法令・社内ルールのチェック項目を確かめて記録する。', '不動産企画係の左のメニュー「コンプライアンス」で開きます。1つの取引について、重要事項説明・契約書・広告・個人情報などのチェック項目を、上から確かめて記録します。

## 入れ方
- 項目ごとに、担当者・確認日・状態・物件・顧客名・備考を入れます
- 選んだり、入力欄を離れたりすると保存します
- 状態は「✅完了」「⏳確認中」「❌未対応」「➖対象外」から選びます

## 完了率
画面の上に、状態を入れた項目のうち「✅完了」の割合が出ます。「➖対象外」と、状態が空の項目は数えません。

## 次の取引に使う
取引が終わったら「入力内容をクリア（次の取引用）」を押します。担当者・確認日・状態・物件名・備考がすべて消えます。

> 注意：クリアは元に戻せません。記録を残したいときは、クリアの前に画面を印刷するなどして控えてください。

> 要確認：チェック項目そのもの（文言・並び）は、この画面では変えられません。変えたいときは開発に相談してください。
', 260, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-270.md：設定（不動産企画係）
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '設定（不動産企画係）';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('設定（不動産企画係）', 'common', '画面の使い方', '不動産企画係の期首年月・担当者と目標・反響元・反響単価・テンプレート・宅建業者情報を直す。', '不動産企画係の左のメニュー「設定」で開きます。ここで直した値は、[[チームサマリー（不動産企画係）]]や[[週次行動計画（不動産企画係）]]など、不動産企画係のすべての画面に反映されます。

入力欄を離れると保存します。見出しの横に「保存しました」と時刻が出れば保存できています。

> 要確認：以前のアプリから全データを取り込むとき、ここでの設定は以前のアプリの設定で上書きされます。切り替えまでは、設定を変えるときは以前のアプリでも同じように変えてください。

## 期首年月
この月から12か月を、今期として集計します。年度が変わるときだけ直します。

## 担当者（10名まで）
担当者名・略称・年間予算・今月目標売上・年間媒介目標を入れます。
- **略称**は、媒介獲得台帳の担当欄と突き合わせます。1文字でも違うと、媒介獲得の数に入りません
- 担当者を消しても、案件や台帳のデータは残ります

## 反響元マスタ・買いポータルマスタ
売り反響の反響元と、買い反響のポータルの候補です。名前を入れて「追加」、✕で外します。

## 反響単価設定
反響1件あたりの仕入れの単価（円）です。チームサマリーの反響費用と獲得単価に使います。空欄は0円として扱います。

## 営業テンプレート（定型文）
売り反響・買い反響で使う定型文です（30件まで）。本文には次の言葉を入れておくと、使うときに置き換わります。
- {{name}}：顧客名
- {{staff}}：担当者
- {{addr}}：物件所在地
- {{property}}：問合せ物件
- {{price}}：価格・予算
- {{today}}：本日

## 宅建業者情報
契約書の「乙」欄と記名押印欄に印字する、会社の情報です。

> 注意：以前のアプリにあった「買取再販の粗利の計算方式・経費科目」「架電キュー」「売主への販売報告」「データ管理」は、それを使う画面と一緒に、このあとの版で移します。
', 270, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
