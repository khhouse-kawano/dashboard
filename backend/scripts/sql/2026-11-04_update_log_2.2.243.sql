-- =====================================================================
-- v2.2.243 広告費の「詳細」（budget.remarks）・予算テーブルの画面 ＋ update_log
--   （末尾に業務ガイドの記事を入れる）
-- ⚠️ 先に 2026-11-04_budget_remarks.sql（列の追加と請求先の分割）を流すこと
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- =====================================================================

-- 1. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
INSERT INTO update_log (version, date, note) VALUES
('2.2.243', '2026-11-04', '広告費入力に「詳細」の欄を追加した。また、広告費のデータを一覧で確かめ、CSV で登録できる「予算テーブル」の画面を追加した。');

-- ---------------------------------------------------------------
-- 業務ガイドの記事（3本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-196.md：予算テーブル
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '予算テーブル';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('予算テーブル', 'common', '画面の使い方', '登録されている広告費を一覧で確かめ、CSV で広告費をまとめて追加する画面（管理者・ブランド管理者だけ）。', 'ヘッダーの「システム管理 → 予算テーブル」（管理者・ブランド管理者だけ）。Dashboard に登録されている広告費を一覧で確かめ、CSV で広告費をまとめて追加する画面です。ここに入っている広告費が、[[販促媒体別広告費]]・[[店舗別広告費]] などの数字の元になります。

[[画面:予算テーブル]]

## 見方
1. 上の「期間」を選んで「表示」を押します（はじめは今月を含む直近3か月）
2. 「事業」「区分」「媒体」「店舗」は、選ぶとすぐに絞り込みます。「キーワード」は内容・請求先・詳細・営業課から探します。入れたら「表示」を押します
3. 上の数字は、絞り込んだ広告費の合計と、そのうちの MKT・PR の合計です
4. 表の見出しを押すと並べ替えができます。表だけがスクロールし、上の絞り込みはそのまま残ります

> 注意：一度に表に出すのは3,000行までです。それより多いときは黄色い枠が出ます。上の合計は、表に出ていない行も含めた数字です。

## 広告費を CSV で追加する
1. 右上の「広告費の登録」を押します
2. 初めてのときは「見本の CSV を保存」を押し、見本と同じ見出しで CSV を作ります
3. 「ファイルを選択」で CSV を選びます。まず中身だけを確かめ、行数・合計・期間などが出ます（この時点ではまだ登録されません）
4. 内容がよければ「登録」を押し、確認の画面で「OK」を押します

- 1行でも誤りがあると、何も登録しません。誤りのある行と理由が赤い枠に出るので、CSV を直して選び直してください
- 請求先に「フルキャスト(派遣スタッフ)」のように括弧書きがあると、括弧の中は「詳細」に分けて登録します

> 注意：**同じ CSV を2回登録すると、広告費が2重になります。** 確かめた結果の「同じ内容がすでにある行」が0でないときは、本当に追加してよいかを確かめてから登録してください。

> 注意：この画面では、登録した行の修正や削除はできません。イベントの広告費は [[イベントの広告費入力]] で直せます。

## CSV の見出し
見本の CSV と同じ見出しにします。
- **budget_period**：月（例 2026/11/01）
- **shop**：店舗
- **medium**：媒体
- **budget_value**：金額（整数。マイナスも可）
- **note**：内容
- **company**：請求先
- **remarks**：詳細（無くても可）
- **response_medium**：反響媒体なら 1、そうでなければ 0
- **category**：MKT か PR
- **section**：注文は order、建売は spec、中古は use
- **order_section**：営業課

> 要確認：どの費用を MKT・PR にするか、どの媒体名を使うかは、社内のルールを確かめてください。媒体名が今までと違うと、別の媒体として集計されます。

## 関係する記事
- [[イベントの広告費入力]]
- [[販促媒体別広告費]]
- [[店舗別広告費]]
- [[ヘッダーのメニュー]]
', 196, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- common/screen-197.md：イベントの広告費入力
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'イベントの広告費入力';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('イベントの広告費入力', 'common', '画面の使い方', '集客イベントの広告費を登録・修正する画面（請求先・詳細の入れ方）。', 'ヘッダーの「集客イベント → 広告費入力」。集客イベントの広告費を登録し、登録済みの広告費を直す画面です。集客サマリーの右上の「広告費入力」からも開けます。

[[画面:イベントの広告費入力]]

## 登録する
1. いちばん上の「新規」の行に、開催月・イベント名・費用・該当店舗・請求先・詳細を入れます
2. 右端の「登録」を押します

- 費用は、選んだ店舗の数で分けて、店舗ごとに登録します（1円未満は切り上げ）
- 登録した行は、すぐ下に追加されます

## 請求先と詳細
- **請求先**：お金を払う相手（例：フルキャスト）
- **詳細**：何の費用かのメモ（例：派遣スタッフ）。空でもかまいません

> 以前は「フルキャスト(派遣スタッフ)」のように、請求先の括弧の中にメモを書いていました。2026年11月から、括弧の中は「詳細」の欄に分けて入っています。これからは請求先に括弧を書かず、「詳細」に入れてください。

## 直す
- 2行目からが登録済みの広告費です（新しい順）。直したい欄を書き換えて、右端の「修正」を押します
- 消す機能はありません。間違えて登録したときは、費用を 0 にして「修正」を押してください

> 注意：同じ内容で「登録」を2回押すと、2組登録されます。

## 関係する記事
- [[予算テーブル]]
- [[ヘッダーのメニュー]]
', 197, 1, '開発（業務ガイド更新）')
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
- **ローン情報更新**・**広告費シミュレーター**・**セキュリティログ**：管理者だけ
- **アクセス解析**・**営業別契約率**・**予算テーブル**：管理者・ブランド管理者だけ
- **Claudeによる分析**（メニューの左のボタン）：管理者・ブランド管理者・マネージャーだけ
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
- [[予算テーブル]]
- [[イベントの広告費入力]]
', 105, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
