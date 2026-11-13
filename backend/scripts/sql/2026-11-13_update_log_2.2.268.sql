-- =====================================================================
-- v2.2.268 レポートの共有（shared_report）＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- ⚠️ 表は CREATE TABLE IF NOT EXISTS なので、表の部分は何度流しても安全。
-- ⚠️ 戻すとき: DROP TABLE shared_report;（⚠️ 共有したレポートはすべて見られなくなる）
--
-- 1行 = 共有したレポート1つ。
--   共有URL は /dashboard/report?k=<share_key>。⚠️ 見るには Dashboard へのログインが必要（② が毎回確かめる）。
--   ⚠️ html は共有した時点の写し（元の分析を消しても見られる）。共有を止めると html を消す。
--   ⚠️ share_key は ② が作る推測できない乱数（128bit、base64url で22文字）。
-- =====================================================================

CREATE TABLE IF NOT EXISTS shared_report (
    id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    share_key       CHAR(22)      NOT NULL COMMENT '共有URLの k（128bit の乱数。base64url）',
    title           VARCHAR(200)  NOT NULL DEFAULT '' COMMENT '題',
    source          VARCHAR(16)   NOT NULL COMMENT '元。ai_analysis（Claudeによる分析）/ upload（HTMLを登録）',
    source_id       INT UNSIGNED  DEFAULT NULL COMMENT 'source = ai_analysis のときの ai_analysis_job.id',
    html            MEDIUMTEXT    DEFAULT NULL COMMENT 'レポートの HTML（共有した時点の写し。停止すると NULL）',
    html_bytes      INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT 'html の大きさ（バイト）',
    staff_id        INT           NOT NULL COMMENT '共有した人（staff.id）',
    staff_name      VARCHAR(100)  NOT NULL DEFAULT '' COMMENT '共有した時点の staff.name',
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '共有した日時',
    revoked_at      DATETIME      DEFAULT NULL COMMENT '共有を止めた日時（NULL なら共有中）',
    revoked_by      INT           DEFAULT NULL COMMENT '止めた人（staff.id）',
    view_count      INT UNSIGNED  NOT NULL DEFAULT 0 COMMENT '開かれた回数',
    last_viewed_at  DATETIME      DEFAULT NULL COMMENT '最後に開かれた日時',
    PRIMARY KEY (id),
    UNIQUE KEY uq_shared_report_key (share_key),
    KEY idx_shared_report_source (source, source_id),
    KEY idx_shared_report_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='共有したレポート（v2.2.268。ログインした人だけが見られる）';

-- 確認（⚠️ information_schema は ① で使えないので SHOW を使う）
SHOW TABLES LIKE 'shared_report';

INSERT INTO update_log (version, date, note) VALUES
('2.2.268', '2026-11-13', 'レポートを共有できるようにしました。「Claudeによる分析」のレポートの「共有」ボタンでURLを作れます。URLはDashboardにログインしている人だけが開けます。HTMLのレポートの登録と共有の一覧は、メニューの「共有レポート」から行えます。');

-- =====================================================================
-- 業務ガイドの記事（新規「共有レポート」、「Claudeによる分析」「ヘッダーのメニュー」に共有を追記）
-- =====================================================================
-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-202.md：共有レポート
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = '共有レポート';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('共有レポート', 'common', '画面の使い方', '分析のレポートをURLで共有する。URLはダッシュボードにログインしている人だけが開ける。共有の一覧・止め方。', 'ヘッダーの「システム管理 → 共有レポート」（管理者・ブランド管理者・マネージャー）。レポートをURLで社内に共有し、共有したURLの一覧を確かめる画面です。

[[画面:共有レポート]]

## 共有URLの開き方
- 共有URLは、**ダッシュボードにログインしている人なら、だれでも開けます**（権限や事業は問いません）
- ログインしていない人がURLを開くと、ログイン画面が出ます。ログインすると、そのままレポートが開きます
- レポートは、ヘッダーやメニューの無い画面いっぱいに出ます。上の帯の「HTMLをダウンロード」で保存でき、「Dashboard へ」でトップ画面に戻れます

> 注意：URLを知っていても、ログインしていなければ見られません。社外の人には見せられません。

## 共有のしかた
### Claudeによる分析のレポート
[[Claudeによる分析]]で、完了したレポートの題の右にある「共有」を押します。URLが作られ、コピーされます。メールやチャットに貼って渡してください。
- 共有できるのは、分析を実行した本人と管理者だけです
- 同じ分析でもう一度「共有」を押しても、URLは増えません（同じURLが出ます）

### 手元のレポート（HTMLファイル）
管理者だけが登録できます。この画面の上で、HTMLファイル（5MBまで）を選び、題を入れて「登録して共有URLを作る」を押します。ファイルを選ぶと、ファイル名が題に入ります。

## 一覧の見方
- 管理者には全員の共有が、ほかの人には自分が共有したものだけが出ます
- 上のカードに、共有中の件数・開かれた回数・止めた件数が出ます
- 「元」は、Claudeによる分析から共有したものか、HTMLを登録したものかです
- 開かれた回数・最後に開かれた日時で、URLが使われているかを確かめられます
- 見出しを押すと並べ替えられます。「止めた共有も出す」を入れると、止めたものも出ます

## 共有を止める
一覧の「止める」を押します。止めると、そのURLではだれも見られなくなります。止めた共有は元に戻せません。もう一度共有するときは、新しいURLを作ってください。
- 止められるのは、共有した本人と管理者だけです

> 注意：共有したレポートは、共有した時点の内容です。元の分析を削除しても、共有URLでは見られます。見せたくなくなったら「止める」を押してください。

> 要確認：レポートには、お客様の名前や担当者ごとの成績が入ることがあります。どこまで共有してよいかは、社内のルールに合わせてください。

## 関係する記事
- [[Claudeによる分析]]
- [[アクセス記録]]
- [[ヘッダーのメニュー]]
', 202, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-150.md：Claudeによる分析
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'Claudeによる分析';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('Claudeによる分析', 'common', '画面の使い方', '知りたいことを文章で頼むと、Claude がダッシュボードの数字を集めて深掘りし、次の打ち手まで書いたレポートを出す。', 'ヘッダーの左上「Claudeによる分析」。管理者・ブランド管理者・マネージャーだけが開けます（ほかの人にはボタンが出ません）。

[[画面:Claudeによる分析]]

知りたいことを文章で書くと、Claude がダッシュボードの数字を自分で何度も集計しながら分析し、レポートを書きます。レポートには、必ず「次の打ち手」が入ります。

> 注意：1回の分析に **5〜15分ほど**かかります。待っているあいだにほかの画面を使っても、この画面を閉じても、分析は止まりません。

## 画面の形
左に条件と一覧、右に結果が出ます。ほかの画面に移るときは、ほかのメニューを押すか、ブラウザの「戻る」を押します（[[ヘッダーのメニュー]]）。

## 分析を頼む（左の「新しい分析」）
1. **事業部**を選ぶ（注文事業／建売分譲事業）
2. 必要なら**課**と**店舗**を選ぶ（選ばなければ事業部全体）
3. **期間**（開始月・終了月）を選ぶ。最初は、締まった直近6ヶ月が入っています
4. **分析したいこと**を書く。下の例を押すと、その文が入ります
5. 「分析を始める」を押す

書き方に慣れていなくても大丈夫です。「もっと詳しく」「なんで下がったの」くらいの書き方でも、最初から深掘りして、次の打ち手まで出します。

書き方の例：
- 直近半年で契約が伸びた店舗と落ちた店舗を比べて、差がどこで生まれているか教えて
- 広告費に対して契約が取れている媒体と取れていない媒体を知りたい。来期の配分の見直し案も
- 次アポ率が低い原因を、担当者別・媒体別に深掘りして

## 数字の数え方
レポートの数字は、ダッシュボードの画面と同じ数え方です。
- **広告費に関わる歩留まり**（媒体ごとの反響・来場・契約、反響単価・契約単価など）は**反響日起算**です。「販促媒体別広告費」と同じ数字になります。
- **部署・店舗・担当者の歩留まり**（反響・来場・次アポ・契約）は**実績日起算**です。「店舗・担当別反響」と同じ数字になります。

> 注意：今月はまだ途中なので、前の月と比べる材料にはしていません。

## 結果を見る（左の「分析の一覧」）
- 実行中の分析には「実行中」、終わったものには「完了」、失敗したものには「失敗」の印が付きます
- 押すと右に出ます。実行中なら進み具合（何をしているか、何分たったか）が出ます
- 完了したレポートは、題の右の「HTMLをダウンロード」で1つのファイルとして保存できます。保存したファイルはブラウザで開け、メールで送ったり会議で配ったりできます
- その右の「共有」を押すと、レポートを開くURLが作られ、コピーされます。URLはダッシュボードにログインしている人だけが開けます。共有できるのは、実行した本人と管理者だけです（[[共有レポート]]）
- 一覧には、この画面を使える人全員の分析が並びます。ほかの人の分析も開けます（開くだけなら費用はかかりません）
- 削除できるのは、実行した本人と管理者だけです
- 失敗したときは理由が出ます。「この依頼文を左の欄に入れる」を押すと、同じ依頼文でやり直せます

「過去の定型分析」を開くと、以前のメニュー（反響推移・店舗別・媒体別）で保存した結果を読めます。

## 回数の上限
- 1人1日 **1回**まで（失敗も数えます。実行のたびに費用がかかるため）
- 自分の分析が実行中のあいだは、次の分析を始められません
- ほかの人の分析が混み合っているときは、少し待ってから実行してください

## 競合分析のレポートはどこへ行ったか
競合分析のレポートは、この画面から外しました。ヘッダーの「他社動向 → Claudeによる競合分析」で読めます（だれでも開けます）。

[[画面:Claudeによる競合分析]]

> 要確認：分析の結果は、会議資料に使う前に、もとの画面の数字と見比べてください。母数が少ない店舗・担当者の率は、たまたまの差であることがあります。
', 150, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
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
- [[予算テーブル]]
- [[イベントの広告費入力]]
', 105, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);
