-- =====================================================================
-- v2.2.301 物件DB・SUUMO物件サマリーを GET で読む（②）・物件DB をポータルのデータで補う ＋ update_log
--
-- ⚠️ 実行環境: ① レンタルサーバー（mysql / phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- =====================================================================
INSERT INTO update_log (version, date, note) VALUES
('2.2.301', '2026-11-25', '物件DBとSUUMO物件サマリーを、必要な分だけ読むようにして開くのを速くしました。見た目を顧客DBにそろえ、絞り込みのあとのページ数が正しく出るようにしました。SUUMO物件サマリーで選んだ取得日は画面のURLにも出ます。システム管理に「テーブル定義書」を足しました（Master のみ。閲覧だけ）。');

-- ---------------------------------------------------------------
-- テーブル定義書の表（v2.2.301）。中身は末尾の build-tabledef-sql.cjs の出力で入れる
-- ⚠️ 原稿は backend/scripts/tabledef/tables/<テーブル名>.md。⚠️ 画面からは書き換えない（閲覧のみ）
-- ⚠️ 型・NULL・既定値は持たない（画面を開いたときに ② が SHOW FULL COLUMNS で実物から読む）
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS table_definition (
  table_name VARCHAR(64) NOT NULL COMMENT 'テーブル名',
  title VARCHAR(200) NOT NULL DEFAULT '' COMMENT '日本語の名前',
  business VARCHAR(16) NOT NULL DEFAULT 'common' COMMENT 'order / spec / used / realty / common',
  description TEXT NULL COMMENT 'テーブルの説明',
  source VARCHAR(8) NOT NULL DEFAULT '推論' COMMENT '改修（これまでの改修で扱った） / 推論（登録値から推した）',
  updated_version VARCHAR(32) NOT NULL DEFAULT '' COMMENT '説明を最後に直した版',
  updated_at DATETIME NULL COMMENT '説明を最後に直した日時',
  PRIMARY KEY (table_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='テーブル定義書：テーブルの説明（v2.2.301）';

CREATE TABLE IF NOT EXISTS column_definition (
  table_name VARCHAR(64) NOT NULL COMMENT 'テーブル名',
  column_name VARCHAR(64) NOT NULL COMMENT '列名',
  description TEXT NULL COMMENT '列の説明',
  source VARCHAR(8) NOT NULL DEFAULT '推論' COMMENT '改修 / 推論',
  updated_version VARCHAR(32) NOT NULL DEFAULT '' COMMENT '説明を最後に直した版',
  updated_at DATETIME NULL COMMENT '説明を最後に直した日時',
  PRIMARY KEY (table_name, column_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='テーブル定義書：列の説明（v2.2.301）';

-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
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

## 見方
- 見出しの「反響数」「総PV」「SUUMO」「HOME''S」「athome」を押すと並べ替えられます（もう一度押すと逆の順）
- PV の数字を押すと、そのポータルの掲載の詳しい内容が開きます
- 「詳細」を押すと、物件の詳細（ポータルへの掲載状況・閲覧数・この物件に問い合わせたお客様）が開きます

## SUUMO掲載順位
上の枠の「SUUMO掲載順位」で開きます。SUUMO での掲載順位を、市町村ごとに並べて見ます。
- 初めは最新の取得日の順位が出ます。「取得日」で前の日を選ぶと、その日の順位を読み直します
- 順位の後ろのかっこは、前回（その日より前の取得日）の順位です
- 前の日を選んでいるあいだは、画面のアドレス（URL）にその日が出ます。そのアドレスで開くと、同じ日の順位が開きます

## 物件の情報について
物件の情報はいえらぶから取り込んでいます。SUUMO・HOME''S・at home の掲載データからも、空いている項目（住所・物件名・間取り・面積・交通・価格など）を補います。いえらぶに無い物件がポータルに載っていれば、その物件も物件DB に加わります。
- いえらぶの値が入っている項目は、ポータルの値で書き換えません
', 50, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);

-- >>> テーブル定義書と記事（v2.2.301 追記）
-- ---------------------------------------------------------------
-- 業務ガイドの記事（1本）。backend/scripts/guide/build-guide-sql.cjs で作成
-- ⚠️ 先に guide_article / guide_history の表があること（2026-10-16_guide_article.sql）
-- ⚠️ 同じタイトルの記事は上書きする（⚠️ 手で直された記事でも開発側を優先）。⚠️ 直前の内容は guide_history に残す
-- ---------------------------------------------------------------
-- common/screen-204.md：テーブル定義書
INSERT INTO guide_history (article_id, title, section, summary, body, published, edited_by, edited_at)
  SELECT id, title, section, summary, body, published, updated_by, updated_at FROM guide_article WHERE title = 'テーブル定義書';
INSERT INTO guide_article (title, division, section, summary, body, sort, published, updated_by)
  VALUES ('テーブル定義書', 'common', '画面の使い方', 'Dashboard のデータの入れ物（テーブル）と、その項目の意味を調べる画面（管理者だけ・見るだけ）。', 'ヘッダーの「システム管理 → テーブル定義書」（管理者だけ）。Dashboard がデータをしまっている入れ物（テーブル）ごとに、何が入っているか、それぞれの項目が何を表すかを調べる画面です。見るだけの画面で、ここから直すことはできません。

[[画面:テーブル定義書]]

> 注意：データの集計を頼むときや、外部の会社とデータの受け渡しを相談するときに、項目の意味を確かめるために使います。お客様の情報そのものは出ません。

## 見方
1. 上の「検索」に言葉を入れると、名前・説明・項目の名前に当たる入れ物だけになります。項目で当たったときは、名前の下に当たった項目が黄色の文字で出ます
2. 「事業」（注文住宅・建売・中古リノベ・不動産企画・共通）と「出典」で絞り込めます
3. 左の表で入れ物を押すと、右に項目の一覧が出ます。検索で当たった項目は黄色になります
4. 左の表の見出しを押すと並べ替えられます（もう一度押すと逆の順）

選んだ入れ物と絞り込みは、画面のアドレスにも出ます。そのアドレスを開くと、同じ状態で開きます。

## 出典
- **改修**：これまでの開発で扱った入れ物・項目です。説明は開発の記録をもとにしています
- **推論**：開発で扱ったことがなく、入っている値の傾向から推した説明です。「（推定）」と付いた説明は、使う前に確かめてください
- **未記載**：まだ説明がありません

> 注意：説明は、入れ物を作ったり項目を足したりするたびに、開発の担当が更新します。説明が違っていると気づいたら、開発の担当に知らせてください。

上の数字は、入れ物の数・説明のある数・推論で書いた数・まだ説明の無い数です。左の表の「行数」は、だいたいの件数（目安）です。
', 204, 1, '開発（業務ガイド更新）')
  ON DUPLICATE KEY UPDATE division = VALUES(division), section = VALUES(section), summary = VALUES(summary),
    body = VALUES(body), sort = VALUES(sort), published = 1, updated_by = VALUES(updated_by);

-- ---------------------------------------------------------------
-- テーブル定義書（170 テーブル）。backend/scripts/tabledef/build-tabledef-sql.cjs で作成（2.2.301）
-- ⚠️ 先に table_definition / column_definition の表があること（2026-11-25_update_log_2.2.301.sql）
-- ⚠️ 原稿に無い列の説明は消す（原稿が正）
-- ---------------------------------------------------------------
-- achievement：反響・来場の目標（店舗・月別。旧）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('achievement', '反響・来場の目標（店舗・月別。旧）', 'order', 'コードからの使用箇所なし（推定：店舗ごと・月ごとの反響数（register）と来場予約数（reserve）の目標。2025/06〜2026/05 の1年分だけ入っている）。
1行＝1か月×1店舗×1区分。⚠️ 画面・処理からは使っていない（推定）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'achievement' AND column_name NOT IN ('id', 'date', 'shop', 'category', 'goal');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('achievement', 'id', '連番', '推論', '2.2.301', NOW()),
  ('achievement', 'date', '年月（YYYY/MM）', '推論', '2.2.301', NOW()),
  ('achievement', 'shop', '店舗', '推論', '2.2.301', NOW()),
  ('achievement', 'category', '区分（register = 反響 / reserve = 来場予約）', '推論', '2.2.301', NOW()),
  ('achievement', 'goal', '目標件数', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- after_interview：面談後アンケートの回答
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('after_interview', '面談後アンケートの回答', 'order', '面談のあとにお客様が答えるアンケート（survey の面談後）。1行＝1回答。
書くのは ② survey/public.ts の面談後の保存（認証なし。旧 /survey/api/ の after_interview を移したもの）。同じ回答が30分以内にあれば2行目は入れない。署名が正しく既存のお客様なら customers.after_interview = 1 にする。
読むのは面談後アンケートの一覧（header/inquiry/AfterInterview.tsx、① afterInterview.php）。
⚠️ 列名とフォームの項目名が一致しない（例 confirmedAllItems にフォームの desired が入る）。対応は survey/public.ts の INSERT を見る。
⚠️ 回答の行はいつも残す（上書きしない）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'after_interview' AND column_name NOT IN ('no', 'id', 'dateStr', 'shop', 'name', 'phone', 'InterviewFeedback', 'confirmedAllItems', 'desireOwnership', 'priorityCondition', 'ourCompanyFirstChoice', 'otherCompaniesInterested', 'staffName', 'staffHospitality', 'proposalFeedback', 'moreInfoOrImprovements', 'nextConsultationRequests', 'changeStaffRequested');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('after_interview', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('after_interview', 'id', '顧客ID（master_data.id）。新規のお客様は ''new''', '改修', '2.2.301', NOW()),
  ('after_interview', 'dateStr', '回答日時（''YYYY/MM/DD HH:mm:ss''・日本時間の文字列）', '改修', '2.2.301', NOW()),
  ('after_interview', 'shop', '店舗', '改修', '2.2.301', NOW()),
  ('after_interview', 'name', 'お名前', '改修', '2.2.301', NOW()),
  ('after_interview', 'phone', '電話番号。⚠️ 今は書いていない（いつも空文字）', '改修', '2.2.301', NOW()),
  ('after_interview', 'InterviewFeedback', '面談で聞けたこと（フォームの toldInformation。複数選択を「, 」区切り）', '改修', '2.2.301', NOW()),
  ('after_interview', 'confirmedAllItems', 'フォームの desired の回答（列名は「全項目を確認できたか」）', '改修', '2.2.301', NOW()),
  ('after_interview', 'desireOwnership', 'フォームの condition の回答（列名は「家を持ちたい気持ち」）', '改修', '2.2.301', NOW()),
  ('after_interview', 'priorityCondition', 'フォームの importance の回答（重視する条件）', '改修', '2.2.301', NOW()),
  ('after_interview', 'ourCompanyFirstChoice', 'フォームの priority の回答（当社が第一候補か）', '改修', '2.2.301', NOW()),
  ('after_interview', 'otherCompaniesInterested', '気になっている他社（フォームの rival）', '改修', '2.2.301', NOW()),
  ('after_interview', 'staffName', '担当した営業の名前', '改修', '2.2.301', NOW()),
  ('after_interview', 'staffHospitality', '担当の対応の満足度（フォームの staffSatisfied）', '改修', '2.2.301', NOW()),
  ('after_interview', 'proposalFeedback', '面談・提案の満足度（フォームの interviewSatisfied）', '改修', '2.2.301', NOW()),
  ('after_interview', 'moreInfoOrImprovements', 'もっと知りたいこと・改善点（自由記述）', '改修', '2.2.301', NOW()),
  ('after_interview', 'nextConsultationRequests', '次回に相談したいこと（自由記述）', '改修', '2.2.301', NOW()),
  ('after_interview', 'changeStaffRequested', '担当の変更の希望', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- ai_analysis_job：Claudeによる分析の実行記録
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('ai_analysis_job', 'Claudeによる分析の実行記録', 'common', '「Claudeによる分析」（v2.2.217〜。画面 header/claude/ClaudeAnalysis.tsx）の1回の実行が1行。依頼文・対象・進み具合・結果のレポート（HTML）・費用を持つ。
② の features/aiAnalysis/job.ts が書く（ai_analysis_start で queued → running → done / error）。画面は ai_analysis_list を数秒ごとに読み、ai_analysis_get で本文を開く。
共有するときは shared_report に HTML の写しを作る（source = ai_analysis）。
⚠️ 削除は行を消さず deleted_at を付けて html を消す（1日の実行回数の上限を数えるため）。
⚠️ html は Claude が書いた HTML。画面では iframe（sandbox）の中でしか出さない。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'ai_analysis_job' AND column_name NOT IN ('id', 'staff_id', 'staff_name', 'status', 'prompt', 'division', 'section', 'shop', 'period_from', 'period_to', 'progress', 'tool_calls', 'title', 'summary', 'html', 'model', 'input_tokens', 'output_tokens', 'cost_usd', 'error_message', 'created_at', 'started_at', 'finished_at', 'deleted_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('ai_analysis_job', 'id', '連番（自動採番）。shared_report.source_id から参照される', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'staff_id', '実行した人（staff.id）', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'staff_name', '実行した人の名前（staff.name の写し）', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'status', 'queued＝受付 / running＝実行中 / done＝完了 / error＝失敗。② の再起動時に queued・running は error にする', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'prompt', '利用者が書いた依頼文', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'division', 'order（注文）/ kaeru（建売）', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'section', '課。空は事業部全体', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'shop', '店舗。空は課（または事業部）全体', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'period_from', '対象期間の始め（YYYY-MM）', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'period_to', '対象期間の終わり（YYYY-MM）', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'progress', '画面に出す途中経過（例: 店舗別の実績を集計中）', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'tool_calls', 'Claude がデータを取りに行った回数', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'title', 'レポートの題（完了時に入る）', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'summary', '一覧に出す要約（1〜3文）', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'html', 'レポート本文（HTML）。削除すると NULL', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'model', '使った Claude のモデル名', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'input_tokens', '入力のトークン数', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'output_tokens', '出力のトークン数', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'cost_usd', 'かかった費用（ドル）', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'error_message', '失敗の理由', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'created_at', '受け付けた日時。1日の実行回数はこれで数える', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'started_at', '分析を始めた日時', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'finished_at', '終わった（完了・失敗）日時', '改修', '2.2.301', NOW()),
  ('ai_analysis_job', 'deleted_at', '削除した日時。⚠️ 行は消さない（消すと1日の実行回数が減り、上限をすり抜けられる）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- ai_usage_log：Claude APIの利用記録（旧KPI分析）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('ai_usage_log', 'Claude APIの利用記録（旧KPI分析）', 'common', 'Claude API を呼んだ1回が1行。どのキー（api_credential）に課金され、誰が・何の機能で・いくらかかったかを残す。
① の kpi_analyze.php（KPI分析の実行。1人1日20回の上限をここで数える）と credential_verify.php（キーの疎通確認）が書く。kpi_analysis_history.usage_log_id から参照される。
⚠️ 旧「KPI分析」の仕組み。今の「Claudeによる分析」は ai_analysis_job に費用を持ち、この表には書かない。kpi_analyze・credential_* は画面から呼ばれていない（2026-10 以降の行が無い）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'ai_usage_log' AND column_name NOT IN ('id', 'credential_id', 'staff_id', 'feature', 'model', 'input_tokens', 'output_tokens', 'cost_usd', 'duration_ms', 'status', 'error_message', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('ai_usage_log', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('ai_usage_log', 'credential_id', 'どのキーに課金されたか（api_credential.id）', '改修', '2.2.301', NOW()),
  ('ai_usage_log', 'staff_id', '誰が実行したか（staff.id）', '改修', '2.2.301', NOW()),
  ('ai_usage_log', 'feature', '機能。kpi_analyze / kpi_analyze:order / kpi_analyze:kaeru / credential_verify。⚠️ ''kpi_analyze:order'' などの値は変えない（core/kpi.php の注記）', '改修', '2.2.301', NOW()),
  ('ai_usage_log', 'model', '使ったモデル（例: claude-opus-5）。疎通確認は ''-''', '改修', '2.2.301', NOW()),
  ('ai_usage_log', 'input_tokens', '入力のトークン数。疎通確認は NULL', '改修', '2.2.301', NOW()),
  ('ai_usage_log', 'output_tokens', '出力のトークン数。疎通確認は NULL', '改修', '2.2.301', NOW()),
  ('ai_usage_log', 'cost_usd', '算出したドル金額', '改修', '2.2.301', NOW()),
  ('ai_usage_log', 'duration_ms', '所要時間（ミリ秒）', '改修', '2.2.301', NOW()),
  ('ai_usage_log', 'status', 'ok＝成功 / error＝失敗 / rate_limited＝API の回数制限', '改修', '2.2.301', NOW()),
  ('ai_usage_log', 'error_message', '失敗の理由', '改修', '2.2.301', NOW()),
  ('ai_usage_log', 'created_at', '実行した日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- allGrit_db：ALLGRIT 反響の取り込み元（注文住宅）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('allGrit_db', 'ALLGRIT 反響の取り込み元（注文住宅）', 'order', 'ALLGRIT（LINE の顧客管理。注文住宅の KH・DJH の LINE アカウント）の顧客一覧の生データ。1行が1件の LINE の友だち（リード）。
sync の runAllGrit.ts（注文と建売をまとめた処理。旧 runAllgritOrder.ts）が CSV を落とし、来店予約・資料郵送後で姓のある行だけを ① の request allgrit_db_order（handlers/allgrit_db_order.php）へ500件ずつ送る。
同じ処理で反響一覧（inquiry_customer）に `allgrit<id_allGrit>` の行を足す（portal/allgrit_order.php。媒体 ALLGRIT）。
⚠️ 鍵は id_allGrit だが UNIQUE キーは無い。PHP が既にある ID を SELECT してから入れる（core/bulk_upsert.php）。
⚠️ city_allGrit2・city_allGrit3・shop_allGrit は NOT NULL で既定値が無い（列を省いた INSERT は厳密モードで落ちる）。
⚠️ 建売（かえる）の ALLGRIT はこの表ではなく request allGrit_kaeru で別に送る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'allGrit_db' AND column_name NOT IN ('id', 'id_allGrit', 'date_allGrit', 'status_allGrit', 'sei_allGrit', 'mei_allGrit', 'mail_allGrit', 'phone_allGrit', 'zip_allGrit', 'address1_allGrit', 'budget_allGrit', 'pref_allGrit', 'city_allGrit', 'city_allGrit2', 'city_allGrit3', 'place_allGrit', 'shop_allGrit');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('allGrit_db', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'id_allGrit', 'お客様の LINE UID。DJH のアカウントの行は末尾に `DJH` を付ける（同じ人が KH・DJH の両方にいると重なるため）', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'date_allGrit', 'LINE 登録日（YYYY/MM/DD）。⚠️ sync が取り込んだ日の日付で上書きする', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'status_allGrit', 'リードステータス（例 来店前・来店後・資料郵送後・商談中・成約済み）', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'sei_allGrit', '姓', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'mei_allGrit', '名', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'mail_allGrit', '連絡先メールアドレス', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'phone_allGrit', '電話番号', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'zip_allGrit', '郵便番号', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'address1_allGrit', '住所（反響一覧の building に入る）。店舗判定の第3優先', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'budget_allGrit', '予算', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'pref_allGrit', '希望エリアの都道府県', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'city_allGrit', '希望エリアの市区町村 第1希望。店舗判定の第2優先', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'city_allGrit2', '希望エリアの市区町村 第2希望', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'city_allGrit3', '希望エリアの市区町村 第3希望', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'place_allGrit', '建築予定地（市区町村）。店舗判定の第1優先。⚠️ 希望エリア第1希望（city_allGrit）とは別物（2026-09-08 に追加）', '改修', '2.2.301', NOW()),
  ('allGrit_db', 'shop_allGrit', '取り込んだアカウントのブランド（KH / DJH。以前の行には KHF・KHG もある）。店舗名ではない', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- allGrit_kaeru：ALLGRIT（公式LINE）の顧客
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('allGrit_kaeru', 'ALLGRIT（公式LINE）の顧客', 'spec', 'かえるホームの公式LINE（ALLGRIT）の顧客一覧の書き出しを取り込んだ表。1行＝LINE の友だち1人。
書くもの：sync（Node.js）が ALLGRIT の書き出しを読み、① の request allGrit_kaeru で送る（allGrit_kaeru.php。INSERT … ON DUPLICATE KEY UPDATE で上書き。列は sync の headerMap に合わせてある）。
続けて ① handlers/portal/allgrit_kaeru.php が反響一覧（inquiry_customer_kaeru）へ `allgrit_<line_uid>` で写す（medium・response_medium＝ALLGRIT）。
⚠️ 反響一覧へ写すかどうか・重複の判定は line_uid。line_uid が空の行は写さない。
⚠️ 建売の販促媒体（medium_kaeru）では「公式LINE」。画面の表示だけ ALLGRIT に差し替えている（CustomerTrendKaeru.tsx）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'allGrit_kaeru' AND column_name NOT IN ('no', 'customer_id', 'line_uid', 'line_registered_at', 'customer_type', 'company_name', 'lead_status', 'delivery_date', 'line_display_name', 'last_name', 'first_name', 'name_kana', 'birth_date', 'gender', 'email', 'phone', 'zip_code', 'address', 'budget', 'available_time', 'land_search_status', 'motivation', 'desired_pref', 'desired_city_1', 'desired_city_2', 'desired_city_3', 'document_request_status', 'other_conditions', 'friend_add_status', 'friend_add_route', 'staff', 'visit_reservation', 'message_received', 'owner_id', 'source_campaign', 'source_media', 'source_site', 'gclid', 'tags', 'desired_pref_alt', 'desired_area_detail', 'desired_area_1', 'desired_area_2', 'desired_area_3', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('allGrit_kaeru', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'customer_id', 'ALLGRIT の顧客ID', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'line_uid', 'LINE のユーザーID。⚠️ 反響ID（allgrit_<line_uid>）の元。同じ人の判定に使う', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'line_registered_at', '友だち登録日時（反響一覧の inquiry_date）', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'customer_type', '顧客の種類', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'company_name', '会社名', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'lead_status', '見込みの状況', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'delivery_date', '（推定）配信日', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'line_display_name', 'LINE の表示名', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'last_name', '姓（反響一覧の first_name に姓名をつないで入れる）', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'first_name', '名', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'name_kana', 'フリガナ', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'birth_date', '生年月日', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'gender', '性別', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'email', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'phone', '電話番号（反響一覧の mobile に入る）', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'zip_code', '郵便番号', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'address', '住所（反響一覧の building に入る）', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'budget', '予算', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'available_time', '連絡のつく時間帯', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'land_search_status', '土地探しの状況', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'motivation', '住まい探しの動機', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'desired_pref', '希望の県', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'desired_city_1', '希望の市区町村①', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'desired_city_2', '希望の市区町村②', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'desired_city_3', '希望の市区町村③', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'document_request_status', '資料請求の状況', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'other_conditions', 'その他の希望条件', '改修', '2.2.301', NOW()),
  ('allGrit_kaeru', 'friend_add_status', '友だち追加の状況', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'friend_add_route', '友だち追加の経路', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'staff', 'ALLGRIT 上の担当', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'visit_reservation', '来場予約', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'message_received', '受け取ったメッセージ', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'owner_id', 'ALLGRIT 上の担当者の ID', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'source_campaign', '流入のキャンペーン', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'source_media', '流入の媒体', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'source_site', '流入のサイト', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'gclid', 'Google 広告のクリック ID', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'tags', 'ALLGRIT のタグ', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'desired_pref_alt', '希望の県（別の項目）', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'desired_area_detail', '希望エリアの詳細', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'desired_area_1', '希望エリア①', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'desired_area_2', '希望エリア②', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'desired_area_3', '希望エリア③', '推論', '2.2.301', NOW()),
  ('allGrit_kaeru', 'remarks', '全項目をつないだ文（反響一覧の note）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- ambassador_list：Instagram アンバサダーの台帳
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('ambassador_list', 'Instagram アンバサダーの台帳', 'order', 'Instagram 公式アンバサダー（紹介してくれるお施主様など）の台帳。1人＝1行。
登録・更新・一覧は画面「アンバサダー」（header/ambassador/AmbassadorList.tsx。request ambassador_list・ambassador_kpi。② features/ambassador/）。① に PHP の処理は無い。
アンバサダー経由の反響は inquiry_ambassador（ambassador_no でこの表の no を指す）。反響数は列に持たず、inquiry_ambassador を数えて返す。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'ambassador_list' AND column_name NOT IN ('no', 'name', 'kana', 'address', 'mobile', 'mail', 'account', 'shop', 'staff', 'remarks', 'registered_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('ambassador_list', 'no', '連番（inquiry_ambassador.ambassador_no から指す。⚠️ アカウント名ではなくこれで結ぶ）', '改修', '2.2.301', NOW()),
  ('ambassador_list', 'name', '氏名', '改修', '2.2.301', NOW()),
  ('ambassador_list', 'kana', 'ふりがな', '改修', '2.2.301', NOW()),
  ('ambassador_list', 'address', '住所', '改修', '2.2.301', NOW()),
  ('ambassador_list', 'mobile', '電話番号', '改修', '2.2.301', NOW()),
  ('ambassador_list', 'mail', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('ambassador_list', 'account', 'インスタグラムアカウント', '改修', '2.2.301', NOW()),
  ('ambassador_list', 'shop', '担当店舗（KH出水阿久根店 など）', '改修', '2.2.301', NOW()),
  ('ambassador_list', 'staff', '担当営業', '改修', '2.2.301', NOW()),
  ('ambassador_list', 'remarks', '備考。[{date, note}] のJSON配列', '改修', '2.2.301', NOW()),
  ('ambassador_list', 'registered_at', '登録日', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- analysis_api_key：分析APIのキー
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('analysis_api_key', '分析APIのキー', 'common', '分析API（② の /api/v1/analysis/…。Claude デスクトップから MCP 経由で叩く）を使うための受信用キー。1行がキー1本。
発行は ② の CLI（src/cli/issueAnalysisKey.ts）だけで、画面は無い。照合は ② の middlewares/apiKeyAuth.ts（Authorization: Bearer）。
⚠️ キー本体は発行時にしか表示せず、DB には SHA-256 のハッシュだけを持つ。値は画面・資料に出さない。
⚠️ 止めるときは revoked_at を入れる（行は消さない。analysis_query_log が参照する）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'analysis_api_key' AND column_name NOT IN ('id', 'staff_id', 'label', 'key_hash', 'key_prefix', 'expires_at', 'revoked_at', 'last_used_at', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('analysis_api_key', 'id', '連番（自動採番）。analysis_query_log.api_key_id から参照される', '改修', '2.2.301', NOW()),
  ('analysis_api_key', 'staff_id', '所有者。staff.id。Master権限のみ', '改修', '2.2.301', NOW()),
  ('analysis_api_key', 'label', '用途がわかる名前（例: だれの何の端末か）', '改修', '2.2.301', NOW()),
  ('analysis_api_key', 'key_hash', 'SHA-256(キー本体)。16進64文字。⚠️ 秘密。一意', '改修', '2.2.301', NOW()),
  ('analysis_api_key', 'key_prefix', '画面表示用の先頭部分（キーの見分け用）', '改修', '2.2.301', NOW()),
  ('analysis_api_key', 'expires_at', '有効期限。NULLなら無期限', '改修', '2.2.301', NOW()),
  ('analysis_api_key', 'revoked_at', '失効させた時刻。入っていたら即座に拒否', '改修', '2.2.301', NOW()),
  ('analysis_api_key', 'last_used_at', '最後に使われた時刻（認証のたびに更新）。棚卸しに使う', '改修', '2.2.301', NOW()),
  ('analysis_api_key', 'created_at', '発行した日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- analysis_query_log：分析APIの監査ログ
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('analysis_query_log', '分析APIの監査ログ', 'common', '分析API（Claude デスクトップから MCP 経由）への1回の問い合わせが1行。いつ・だれのキーで・どの範囲を集計したかを追うための監査ログ。
② の features/analysis/audit.ts（recordAnalysisQuery）が書く。画面からは読まない。
⚠️ 返した結果の本体は残さない（条件と件数だけ）。⚠️ 書けなくても集計は止めない。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'analysis_query_log' AND column_name NOT IN ('id', 'api_key_id', 'staff_id', 'endpoint', 'group_by', 'metrics', 'basis', 'period_from', 'period_to', 'filters', 'row_count', 'duration_ms', 'status', 'error_message', 'client_ip', 'request_id', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('analysis_query_log', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'api_key_id', '使われたキー（analysis_api_key.id）。認証前に落ちた場合は NULL', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'staff_id', 'キーの所有者（staff.id）', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'endpoint', '呼ばれた口（pivot / funnel / unsynced / meta / adspend / competitor / report/list / report/spec など）', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'group_by', '集計軸。カンマ区切り', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'metrics', '指標。カンマ区切り', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'basis', '集計の基準（reaction＝反響 / contract＝契約 / actual など）。無い口は NULL', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'period_from', '対象期間の始め（YYYY-MM）', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'period_to', '対象期間の終わり（YYYY-MM）', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'filters', '絞り込み条件の JSON（512字で切る）', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'row_count', '返した行数', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'duration_ms', '所要時間（ミリ秒）', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'status', 'ok / bad_request＝条件の誤り / unauthorized＝認証失敗 / rate_limited＝回数制限 / error＝失敗', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'error_message', '失敗の理由', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'client_ip', '接続元の IP（IPv6 も入るので45文字）', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'request_id', 'X-Request-Id。② のアクセスログとの突き合わせ用', '改修', '2.2.301', NOW()),
  ('analysis_query_log', 'created_at', '問い合わせの日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- analysis_report：分析レポート（HTML）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('analysis_report', '分析レポート（HTML）', 'common', 'Claude が書いた分析レポート（HTML）が1行1本。本文を丸ごと html に持つ。
入口は2つ。② の POST /api/v1/analysis/report（MCP から。分析APIのキーで認証）と、画面からの手動アップロード（analysis_report_upload）。
読む画面：他社動向 →「Claudeによる競合分析」（header/competitor/CompetitorAnalysisReports.tsx。category = competitor）、金利の画面（header/market/LoanRates.tsx。category = loan_rate）。処理は ② の features/analysis/report.ts。
開いた人は analysis_report_view_log に残る。
⚠️ html は iframe（sandbox="allow-scripts"）の中でだけ出す。allow-same-origin は付けない。⚠️ 1件60KB前後になる。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'analysis_report' AND column_name NOT IN ('no', 'title', 'category', 'division', 'period', 'html', 'staff', 'data_as_of', 'created');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('analysis_report', 'no', '連番（自動採番）。analysis_report_view_log.report_no から参照される', '改修', '2.2.301', NOW()),
  ('analysis_report', 'title', '画面の一覧に出す見出し（例: 競合別 勝因・敗因分析（前期））', '改修', '2.2.301', NOW()),
  ('analysis_report', 'category', '分析の種類。competitor＝競合分析 / loan_rate＝金融機関の金利（period は YYYY-MM）', '改修', '2.2.301', NOW()),
  ('analysis_report', 'division', 'order（注文事業）/ kaeru（建売分譲事業）/ 空＝全社', '改修', '2.2.301', NOW()),
  ('analysis_report', 'period', '分析の対象期間。⚠️ 自由記述（例: 2025/06〜2026/05）', '改修', '2.2.301', NOW()),
  ('analysis_report', 'html', 'レポートの HTML 本文そのもの', '改修', '2.2.301', NOW()),
  ('analysis_report', 'staff', '登録者（スタッフ名、または ''MCP''）', '改修', '2.2.301', NOW()),
  ('analysis_report', 'data_as_of', '分析に使ったデータの時点。⚠️ 画面に必ず出す（最新だと誤解させないため）', '改修', '2.2.301', NOW()),
  ('analysis_report', 'created', '登録した日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- analysis_report_view_log：分析レポートの閲覧記録
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('analysis_report_view_log', '分析レポートの閲覧記録', 'common', '分析レポート（analysis_report）を開いた1回が1行（v2.2.194〜）。② の features/analysis/report.ts が analysis_report_get で本文を返すたびに書く。
⚠️ Master が開いたときは記録しない。⚠️ 画面には出さない（指示）。見方は backend/scripts/sql/2026-10-16_analysis_report_view_log.sql の先頭。
⚠️ 書けなくてもレポートは開ける（失敗は ② のログだけ）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'analysis_report_view_log' AND column_name NOT IN ('no', 'report_no', 'staff_id', 'staff_name', 'authority', 'division', 'viewed_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('analysis_report_view_log', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('analysis_report_view_log', 'report_no', '開いたレポート（analysis_report.no）', '改修', '2.2.301', NOW()),
  ('analysis_report_view_log', 'staff_id', '開いた人（staff.id）', '改修', '2.2.301', NOW()),
  ('analysis_report_view_log', 'staff_name', '開いた時点の staff.name', '改修', '2.2.301', NOW()),
  ('analysis_report_view_log', 'authority', '開いた時点の権限（staff.brand。BrandAdmin / ordinary など）', '改修', '2.2.301', NOW()),
  ('analysis_report_view_log', 'division', '開いた時点の担当事業（staff.shop。order / spec / used / all）', '改修', '2.2.301', NOW()),
  ('analysis_report_view_log', 'viewed_at', '開いた日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- api_credential：Claude APIキー（暗号化保存）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('api_credential', 'Claude APIキー（暗号化保存）', 'common', 'Anthropic（Claude API）へ送る側の API キーを暗号化（AES-GCM）して持つ表。1行がキー1本。
① の credential_insert.php（登録）・credential_list.php（一覧）・credential_verify.php（疎通確認）と、kpi_analyze.php（使うキーを選んで復号）が使う。課金の記録は ai_usage_log.credential_id。
⚠️ 旧「KPI分析」の仕組み。credential_*・kpi_analyze は画面から呼ばれていない。
⚠️ 秘密の表。key_ciphertext・key_iv・key_tag・key_fingerprint の値は見ない・資料に出さない。復号の鍵（マスターキー）は DB の外（環境変数）にある。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'api_credential' AND column_name NOT IN ('id', 'staff_id', 'provider', 'label', 'key_ciphertext', 'key_iv', 'key_tag', 'key_version', 'key_hint', 'key_fingerprint', 'status', 'last_verified_at', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('api_credential', 'id', '連番（自動採番）。ai_usage_log.credential_id から参照される', '改修', '2.2.301', NOW()),
  ('api_credential', 'staff_id', '所有者。staff.id', '改修', '2.2.301', NOW()),
  ('api_credential', 'provider', 'どの会社の API か。いまは anthropic のみ（将来他社APIも扱えるように）', '改修', '2.2.301', NOW()),
  ('api_credential', 'label', '用途がわかる名前（例: だれの個人アカウントか）', '改修', '2.2.301', NOW()),
  ('api_credential', 'key_ciphertext', 'キーの暗号文。⚠️ 秘密', '改修', '2.2.301', NOW()),
  ('api_credential', 'key_iv', '初期化ベクトル(12byte)。⚠️ 秘密', '改修', '2.2.301', NOW()),
  ('api_credential', 'key_tag', '認証タグ(16byte)。⚠️ 秘密', '改修', '2.2.301', NOW()),
  ('api_credential', 'key_version', 'マスターキーの世代（鍵を替えたときに見分ける）', '改修', '2.2.301', NOW()),
  ('api_credential', 'key_hint', '画面表示用の末尾数文字（例: ...a3f9）', '改修', '2.2.301', NOW()),
  ('api_credential', 'key_fingerprint', 'HMAC-SHA256。重複登録の検出用。⚠️ 秘密', '改修', '2.2.301', NOW()),
  ('api_credential', 'status', 'active＝使える / revoked＝止めた / invalid＝疎通確認で無効と分かった。kpi_analyze は active だけを使う', '改修', '2.2.301', NOW()),
  ('api_credential', 'last_verified_at', '最後に疎通確認できた時刻', '改修', '2.2.301', NOW()),
  ('api_credential', 'created_at', '登録した日時', '改修', '2.2.301', NOW()),
  ('api_credential', 'updated_at', '最後に更新した日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- app_state：不動産企画係の設定と週次計画
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('app_state', '不動産企画係の設定と週次計画', 'realty', '不動産企画係（realty）の設定・週次行動計画・コンプライアンスを JSON で持つ表。key ごとに1行で、いまは settings / weekly / compliance の3行。
形は以前の本番アプリ（Supabase の app_state）と同じ。② の features/realty/state.ts が読み書きし、画面は frontend/src/components/realty/（realtyState.ts）。importer.ts（以前のアプリからの取り込み）・calls.ts・ledgerLink.ts は settings の担当者（$.staff）を読む。
⚠️ 書き込みは項目ごとに JSON_SET で差し込む（全体を書き戻さない。64KB の不具合と、同時編集で消し合うのを避ける）。
⚠️ JSON の形を変えない。⚠️ 取り込みの前の控えは app_state_bk_import。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'app_state' AND column_name NOT IN ('key', 'data', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('app_state', 'key', 'settings＝期首年月・担当者と目標・反響元・買いポータル・反響単価・テンプレート・宅建業者情報・契約書の下書き など / weekly＝{ ''YYYY-MM'': [週ごとの計画と実績] } / compliance＝コンプライアンスの項目の配列', '改修', '2.2.301', NOW()),
  ('app_state', 'data', '設定値の JSON', '改修', '2.2.301', NOW()),
  ('app_state', 'updated_at', '更新日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- app_state_bk_import：不動産企画係の設定の控え（取り込み前）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('app_state_bk_import', '不動産企画係の設定の控え（取り込み前）', 'realty', 'app_state（元の表）の、以前のアプリのデータを取り込む前の控え（2026-10-28 の realty の取り込み。最後に作り直したのは 2026-08-28 の内容）。
backend/scripts/sql/2026-10-28_realty_import_1_backup.sql が取り込みのたびに消して作り直し、2026-10-28_realty_import_3_restore.sql で app_state に戻す。
⚠️ 画面・処理からは使っていない（推定）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'app_state_bk_import' AND column_name NOT IN ('key', 'data', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('app_state_bk_import', 'key', 'settings＝期首年月・担当者と目標・反響元・買いポータル・反響単価・テンプレート・宅建業者情報・契約書の下書き など / weekly＝{ ''YYYY-MM'': [週ごとの計画と実績] } / compliance＝コンプライアンスの項目の配列', '改修', '2.2.301', NOW()),
  ('app_state_bk_import', 'data', '設定値の JSON', '改修', '2.2.301', NOW()),
  ('app_state_bk_import', 'updated_at', '更新日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- athome_db_kaeru：at home 反響の取り込み元（建売）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('athome_db_kaeru', 'at home 反響の取り込み元（建売）', 'spec', 'at home（建売。国分ハウジング不動産＝かえるホーム）の問合せメールの内容。1行が1人（メールアドレスで見分ける）。
sync の runAtHomeKaeru.ts（Gmail を IMAP で読む）が、本文に「国分ハウジング不動産」とあるメールを ① の request athome_kaeru_update（handlers/athome_kaeru_update.php）へ1件ずつ送る。
同じメールアドレスの行があれば UPDATE、無ければ INSERT。そのあと portal/athome_kaeru.php が表全体を反響一覧（inquiry_customer_kaeru。`athome_<id>`・媒体 athome・ブランド かえる）へ INSERT IGNORE する。
⚠️ 同じ人が別の物件に問い合わせると、同じ行が上書きされる（1人1行）。反響一覧にも2件目は増えない。
⚠️ メール本文から取り出すので、空の項目に次の見出しが混ざることがある。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'athome_db_kaeru' AND column_name NOT IN ('no', 'id', 'inquiry_date', 'property_type', 'building_name', 'transportation', 'station', 'walk_minutes', 'bus_stop', 'bus_ride_minutes', 'bus_walk_minutes', 'property_address', 'price', 'floor_plan', 'building_area', 'land_area', 'athome_property_id', 'company_property_id', 'name', 'email', 'zip', 'address', 'tel', 'contact_time', 'other_contact_method', 'gender', 'move_in_timing', 'tour_date_1', 'registered_at', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('athome_db_kaeru', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'id', '行の ID（`ak_`＋uniqid。PHP が作る）。反響一覧の inquiry_id は `athome_` ＋この値', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'inquiry_date', 'お問合わせ日時（例 2026年11月21日19時11分。本文のまま）', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'property_type', '物件種目', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'building_name', '建物名（反響一覧の property に入る）', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'transportation', '交通', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'station', '駅名', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'walk_minutes', '徒歩（分）', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'bus_stop', 'バス停名', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'bus_ride_minutes', 'バス乗車分', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'bus_walk_minutes', 'バス停歩分', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'property_address', '所在地（物件。反響一覧の area に入る）', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'price', '価格', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'floor_plan', '間取り', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'building_area', '専有・建物面積', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'land_area', '土地面積', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'athome_property_id', 'at home 物件番号', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'company_property_id', '貴社物件管理番号', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'name', 'お名前', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'email', 'メールアドレス。同じ人かどうかの鍵', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'address', '住所（お客様。反響一覧の building に入る）', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'tel', '電話番号', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'contact_time', '連絡希望の時間帯', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'other_contact_method', 'その他の連絡方法', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'gender', '性別', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'move_in_timing', '入居希望時期', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'tour_date_1', '第一希望日時（見学）', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'registered_at', 'システム受付日時（メールの受信日時。YYYY-MM-DD HH:MM:SS）。反響一覧の反響日になる', '改修', '2.2.301', NOW()),
  ('athome_db_kaeru', 'remarks', 'メールの全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- athome_db_resale：at home 反響の取り込み元（中古）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('athome_db_resale', 'at home 反響の取り込み元（中古）', 'used', 'at home（中古住宅専門店）の問合せメールの内容。1行が1人（メールアドレスで見分ける）。形は athome_db_kaeru と同じ。
sync の runAtHomeKaeru.ts（Gmail を IMAP で読む）が、本文に「中古住宅専門店」とあるメールを ① の request athome_resale_update（handlers/athome_resale_update.php）へ1件ずつ送る。
同じメールアドレスの行があれば UPDATE、無ければ INSERT。そのあと portal/athome_resale.php が、その行を反響一覧（inquiry_customer_resale。`athome_<id>`・区分「買い:ポータル」）と
不動産CRMの買いリード（brokerage_listings。extId `athome:<物件番号>:<受付日>:<氏名>`）へ足す（どちらも INSERT だけ）。
② の realty/ieloveMatch.ts が、買いリードをいえらぶの台帳に結ぶのに company_property_id を読む。
⚠️ 同じ人が別の物件に問い合わせると、同じ行（同じ id）が上書きされる。買いリードは extId で見分けるので2件目も作られる。
⚠️ 照合順序が brokerage_listings（utf8mb4_unicode_ci）と違う。比べるときは COLLATE を付ける。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'athome_db_resale' AND column_name NOT IN ('no', 'id', 'inquiry_date', 'property_type', 'building_name', 'transportation', 'station', 'walk_minutes', 'bus_stop', 'bus_ride_minutes', 'bus_walk_minutes', 'property_address', 'price', 'floor_plan', 'building_area', 'land_area', 'athome_property_id', 'company_property_id', 'name', 'email', 'zip', 'address', 'tel', 'contact_time', 'other_contact_method', 'gender', 'move_in_timing', 'tour_date_1', 'registered_at', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('athome_db_resale', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'id', '行の ID（`ak_`＋uniqid。PHP が作る。建売と同じ接頭辞）。反響一覧の inquiry_id は `athome_` ＋この値', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'inquiry_date', 'お問合わせ日時（例 2026年11月24日13時37分。本文のまま）', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'property_type', '物件種目', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'building_name', '建物名（反響一覧の property・買いリードの対象物件に入る）', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'transportation', '交通', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'station', '駅名', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'walk_minutes', '徒歩（分）', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'bus_stop', 'バス停名', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'bus_ride_minutes', 'バス乗車分', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'bus_walk_minutes', 'バス停歩分', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'property_address', '所在地（物件。反響一覧の area に入る）', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'price', '価格（例 1,600万円。買いリードの budget に直す）', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'floor_plan', '間取り', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'building_area', '専有・建物面積', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'land_area', '土地面積', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'athome_property_id', 'at home 物件番号。買いリードの extId に入る', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'company_property_id', '貴社物件管理番号（355050000＋いえらぶの6桁）。ieloveMatch.ts が台帳に結ぶのに使う', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'name', 'お名前。空なら買いリードは作らない', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'email', 'メールアドレス。同じ人かどうかの鍵', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'address', '住所（お客様。反響一覧の building に入る）', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'tel', '電話番号', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'contact_time', '連絡希望の時間帯', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'other_contact_method', 'その他の連絡方法', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'gender', '性別', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'move_in_timing', '入居希望時期', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'tour_date_1', '第一希望日時（見学）。入っていれば買いリードの段階を「内見予約」にする', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'registered_at', 'システム受付日時（メールの受信日時。YYYY-MM-DD HH:MM:SS）。反響日・買いリードの受付日になる', '改修', '2.2.301', NOW()),
  ('athome_db_resale', 'remarks', 'メールの全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- athome_summary_db：at home 掲載物件のサマリー
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('athome_summary_db', 'at home 掲載物件のサマリー', 'common', 'at home に掲載している自社物件の集計（PV・反響数など）。1行が1物件（management_no）。
sync の summary の処理（runAtHomeSummary）が ① の request athome_db_summary（handlers/athome_db_summary.php）へ、集計期間（start_date・end_date）を付けて送り、management_no で上書き（ON DUPLICATE KEY UPDATE）する。
同じ行を ② の property_db_portal（features/propertyPortal.ts）にも送り、物件DB（property_db）の空の列を埋める（docs/property-db-portal.md）。
画面は物件DB（DatabaseProperty.tsx）・物件のサマリー（PropertySummary.tsx）。② の property_list / property_detail が management_no の末尾6桁 ＝ property_db.property_id で結ぶ。
⚠️ 期間ごとに積み上げず、最後に送った期間の値で上書きする。⚠️ アカウントの列が無い。建売と中古の物件が1つの表に混ざる。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'athome_summary_db' AND column_name NOT IN ('id', 'management_no', 'property_no', 'property_type', 'building_name', 'address', 'line_station', 'price_man_yen', 'published_date', 'floor_plan_flg', 'photo_count', 'pv_pc', 'pv_sp', 'pv_mobile', 'pv_total', 'inquiry_pc', 'inquiry_sp', 'inquiry_mobile', 'inquiry_call', 'inquiry_line', 'inquiry_total', 'favorite_count', 'movie_play_count', 'secondary_ad_auto', 'created_at', 'updated_at', 'start_date', 'end_date');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('athome_summary_db', 'id', 'システム用主キー', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'management_no', '管理番号（355050000＋いえらぶの6桁の物件番号）。上書きの鍵', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'property_no', '物件番号（at home の番号。いえらぶの番号とは関係しない）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'property_type', '物件種目（例 新築売戸建住宅・中古売戸建住宅・売地）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'building_name', '建物名', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'address', '所在地', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'line_station', '沿線／駅', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'price_man_yen', '金額（万円）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'published_date', '公開日', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'floor_plan_flg', '間取図有無', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'photo_count', '物件写真数', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'pv_pc', '詳細PV（ATPC）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'pv_sp', '詳細PV（ATスマートフォン）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'pv_mobile', '詳細PV（ATケータイ）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'pv_total', '詳細PV（合計）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'inquiry_pc', '反響（ATPC）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'inquiry_sp', '反響（ATスマートフォン）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'inquiry_mobile', '反響（ATケータイ）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'inquiry_call', '反響（無料通話）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'inquiry_line', '反響（LINE）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'inquiry_total', '反響（合計）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'favorite_count', 'お気に入り登録', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'movie_play_count', 'パノラマ・フォトムービー再生回数', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'secondary_ad_auto', '2次広告自動公開物件', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'created_at', 'レコード作成日時', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'updated_at', 'レコード更新日時', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'start_date', '集計開始日（sync が送る）', '改修', '2.2.301', NOW()),
  ('athome_summary_db', 'end_date', '集計終了日（sync が送る）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- before_interview：面談前アンケートの回答
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('before_interview', '面談前アンケートの回答', 'order', '来場したお客様が面談の前に答えるアンケート（survey の面談前）。1行＝1回答。
書くのは ② survey/public.ts の面談前の保存（認証なし。旧 /survey/api/ の before_interview を移したもの）。同じ回答が30分以内にあれば2行目は入れない。
リンクの署名が正しく既存のお客様なら、あわせて customers.before_interview = 1 にし、master_data の連絡先・希望（25列）を更新する。新規のお客様（id = ''new''）は、あとで同期サービス（projects/sync）が name・shop で探す。
⚠️ 回答の行はいつも残す（上書きしない）。⚠️ 複数選択の値は「, 」区切り（master_data へは「,」区切りで写す）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'before_interview' AND column_name NOT IN ('no', 'id', 'name', 'shop', 'medium', 'interest', 'opportunity', 'plan', 'period', 'estate', 'area', 'importance', 'budget', 'support', 'demand', 'kana', 'phone', 'mail', 'mobile', 'zip', 'address', 'rent', 'birth', 'situation', 'family_member_1', 'family_member_2', 'family_member_3', 'family_member_4', 'employment', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('before_interview', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('before_interview', 'id', '顧客ID（master_data.id）。新規のお客様は ''new''', '改修', '2.2.301', NOW()),
  ('before_interview', 'name', 'お名前（前後の空白もそのまま。sync が名前で探すため）', '改修', '2.2.301', NOW()),
  ('before_interview', 'shop', '来場した店舗', '改修', '2.2.301', NOW()),
  ('before_interview', 'medium', '何でお知りになったか（複数選択。master_data.inquiry_reason へ写す）', '改修', '2.2.301', NOW()),
  ('before_interview', 'interest', '興味を持った理由（複数選択。master_data.customer_desired_order へ写す）', '改修', '2.2.301', NOW()),
  ('before_interview', 'opportunity', '検討のきっかけ（複数選択。master_data.house_hunting_motivation へ写す）', '改修', '2.2.301', NOW()),
  ('before_interview', 'plan', '新築計画（master_data.customer_desired_floor へ写す）', '改修', '2.2.301', NOW()),
  ('before_interview', 'period', '入居希望時期（master_data.customer_desired_period へ写す）', '改修', '2.2.301', NOW()),
  ('before_interview', 'estate', '土地の状況（master_data.customer_desired_estate へ写す）', '改修', '2.2.301', NOW()),
  ('before_interview', 'area', '建築希望地（master_data.planned_construction_site へ写す）', '改修', '2.2.301', NOW()),
  ('before_interview', 'importance', '重視すること（複数選択）', '改修', '2.2.301', NOW()),
  ('before_interview', 'budget', '予算（master_data.budget へ写す）', '改修', '2.2.301', NOW()),
  ('before_interview', 'support', '（推定）相談したいこと・希望するサポート（複数選択）', '推論', '2.2.301', NOW()),
  ('before_interview', 'demand', 'ご要望（自由記述）', '改修', '2.2.301', NOW()),
  ('before_interview', 'kana', 'ふりがな', '改修', '2.2.301', NOW()),
  ('before_interview', 'phone', '電話番号', '改修', '2.2.301', NOW()),
  ('before_interview', 'mail', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('before_interview', 'mobile', '携帯電話番号', '改修', '2.2.301', NOW()),
  ('before_interview', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('before_interview', 'address', '住所', '改修', '2.2.301', NOW()),
  ('before_interview', 'rent', '現在の家賃', '改修', '2.2.301', NOW()),
  ('before_interview', 'birth', '生年月日', '改修', '2.2.301', NOW()),
  ('before_interview', 'situation', '現在のお住まい（master_data.current_contract_type へ写す）', '改修', '2.2.301', NOW()),
  ('before_interview', 'family_member_1', '家族①（JSON の文字列）', '改修', '2.2.301', NOW()),
  ('before_interview', 'family_member_2', '家族②（JSON の文字列）', '改修', '2.2.301', NOW()),
  ('before_interview', 'family_member_3', '家族③（JSON の文字列）', '改修', '2.2.301', NOW()),
  ('before_interview', 'family_member_4', '家族④（JSON の文字列）', '改修', '2.2.301', NOW()),
  ('before_interview', 'employment', '勤務先（type・name・address・years・income を持つ JSON の文字列。master_data の勤務先・年収の列へ写す）', '改修', '2.2.301', NOW()),
  ('before_interview', 'created_at', '回答日時（日本時間）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- before_survey：事前アンケートの回答
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('before_survey', '事前アンケートの回答', 'order', '来場予約のあとにお客様が答える事前アンケート（khg-marketing.info/survey_<ブランド>/）。1行＝1回答。
書くのは ② before_survey_entry（v2.2.207〜。認証なし。ブラウザから ② へ直接送り、あわせて通知メールを出す）。同期サービス（projects/sync）が反響と突き合わせて顧客へ取り込み、inquiry_update:before_survey で sync = 1 にする。
⚠️ 列のコメントはアンケートの設問の文そのもの。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'before_survey' AND column_name NOT IN ('id', 'sync', 'brand', 'dateStr', 'name', 'considerationStart', 'desiredMoveIn', 'visitedCompanies', 'reasonForConsidering', 'reasonOther', 'futurePlan', 'futureOther', 'desiredSize', 'desiredLayout', 'priorityItem', 'expectedResidents', 'totalBudget', 'monthlyRepayment', 'annualIncome', 'yearsOfService', 'otherIncomePerson', 'otherAnnualIncome', 'ownFunds', 'otherLoans', 'thingsToDo', 'thingsToDoOther', 'housingType', 'housingTypeOther', 'landArea', 'referrerName', 'emailAddress');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('before_survey', 'id', '連番（自動採番）。sync からは sbid という名前で届く', '改修', '2.2.301', NOW()),
  ('before_survey', 'sync', '0 = 未同期・1 = 同期済み（sync の inquiry_update:before_survey が 1 にする）', '改修', '2.2.301', NOW()),
  ('before_survey', 'brand', 'ブランド（KH / DJH / なごみ / FH / PGH / JH / 2L）。反響の brand と突き合わせる', '改修', '2.2.301', NOW()),
  ('before_survey', 'dateStr', '回答日（yyyy/MM/dd・日本時間）', '改修', '2.2.301', NOW()),
  ('before_survey', 'name', 'お名前(漢字)', '改修', '2.2.301', NOW()),
  ('before_survey', 'considerationStart', '新しいお住まいについて、いつ頃からご検討を始められたか教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'desiredMoveIn', 'ご入居希望時期を教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'visitedCompanies', '今まで何社の住宅会社様へご訪問されたか教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'reasonForConsidering', '新しいお住まいをご検討される理由を教えてください。(複数選択可)', '改修', '2.2.301', NOW()),
  ('before_survey', 'reasonOther', '（ご検討の理由で「その他」を選択された方）内容をご記入ください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'futurePlan', '今後の行動予定について教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'futureOther', '（今後の行動予定で「その他」を選択された方）内容をご記入ください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'desiredSize', 'お家の広さはどのくらいをご希望か教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'desiredLayout', 'ご希望の間取りを教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'priorityItem', '重視している項目を教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'expectedResidents', 'ご入居予定の人数を教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'totalBudget', 'おうちづくりの総予算を教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'monthlyRepayment', 'ご希望の月々の返済額を教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'annualIncome', '前年度の年収を教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'yearsOfService', '勤続年数を教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'otherIncomePerson', 'その他、ご年収がある方がいらっしゃるか教えてください。(複数選択可)', '改修', '2.2.301', NOW()),
  ('before_survey', 'otherAnnualIncome', 'ご年収がある方のご年収を教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'ownFunds', '自己資金でのお支払いのご予定があるか教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'otherLoans', 'その他ローンがございましたら教えてください。(複数選択可)', '改修', '2.2.301', NOW()),
  ('before_survey', 'thingsToDo', 'ご来場日は何をご希望ですか？(複数選択可)', '改修', '2.2.301', NOW()),
  ('before_survey', 'thingsToDoOther', '（ご来場日のご希望で「その他」を選択された方）内容をご記入ください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'housingType', 'どのような新しいお住いをご希望ですか？(複数選択可)', '改修', '2.2.301', NOW()),
  ('before_survey', 'housingTypeOther', '（お住まいのご希望で「その他」を選択された方）内容をご記入ください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'landArea', 'ご希望の土地のエリアを教えてください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'referrerName', 'ご紹介者さま(公式アンバサダー含む)がいる場合はご紹介者さまの氏名をご記入ください。', '改修', '2.2.301', NOW()),
  ('before_survey', 'emailAddress', 'メールアドレス', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- black_list：ブラックリスト名簿
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('black_list', 'ブラックリスト名簿', 'common', '反響を受けたくないお客様の名簿。1行＝1人。反響一覧で、携帯番号かメールが一致する反響にブラックの印を付けるのに使う。
書くのは ② blacklist.ts（ブラックリストの編集 header/inquiry/EditBlackList.tsx。一覧・追加・1列ずつ更新）と、反響一覧でブラックを付け外ししたとき（list/save.ts。一致する行の show_key を 0/1 にし、理由を note に足す。無ければ行を作る）。読むのは反響一覧（show_key = 1 の mail・mobile）。
⚠️ 主キーは no。id は飾り（''bl_…'' のダミー値）なので WHERE に使わない。
⚠️ 反響の black タグ（inquiry_customer のフラグ列）とは別物。
⚠️ note は NOT NULL で既定値が無い。空文字を必ず入れる。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'black_list' AND column_name NOT IN ('no', 'id', 'name', 'brand', 'date', 'mail', 'mobile', 'zip', 'full_address', 'show_key', 'note');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('black_list', 'no', '連番（自動採番）。画面はこの値で行を更新する', '改修', '2.2.301', NOW()),
  ('black_list', 'id', 'ダミーの ID（''bl_'' で始まる）。どこでも使わない', '改修', '2.2.301', NOW()),
  ('black_list', 'name', '顧客名', '改修', '2.2.301', NOW()),
  ('black_list', 'brand', 'ブランド（KH / DJH / 2L / 中古住宅専門店 / 全社 など。無いときは全社）', '改修', '2.2.301', NOW()),
  ('black_list', 'date', '登録日（YYYY/MM/DD）', '改修', '2.2.301', NOW()),
  ('black_list', 'mail', 'メールアドレス（反響との突き合わせに使う）', '改修', '2.2.301', NOW()),
  ('black_list', 'mobile', '携帯番号（反響との突き合わせに使う）', '改修', '2.2.301', NOW()),
  ('black_list', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('black_list', 'full_address', '住所', '改修', '2.2.301', NOW()),
  ('black_list', 'show_key', '1 = 有効 / 0 = 解除', '改修', '2.2.301', NOW()),
  ('black_list', 'note', '理由・経緯のメモ（反響一覧から付けた理由を追記する）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- breakaway：フォームの離脱記録
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('breakaway', 'フォームの離脱記録', 'order', 'コードからの使用箇所なし（推定：キャンペーン・来場予約・資料請求のフォームで、途中まで入力して送らずに離れた記録。この repo の外（khg-marketing.info のフォームなど）が書いている）。
1行＝1回の離脱。2025-11〜 の記録がある。⚠️ Dashboard の画面・処理からは使っていない（推定）。入力した値そのものは持たず、入力済みの項目名だけを持つ。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'breakaway' AND column_name NOT IN ('no', 'brand', 'campaign', 'time', 'filled');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('breakaway', 'no', '連番（自動採番）', '推論', '2.2.301', NOW()),
  ('breakaway', 'brand', 'ブランド（kh / djh / pg / nagomi / jh / 2l など。小文字）', '推論', '2.2.301', NOW()),
  ('breakaway', 'campaign', 'キャンペーン・フォーム名（例「【KH共通】来場予約」）', '推論', '2.2.301', NOW()),
  ('breakaway', 'time', '離脱した日時（ISO 8601・UTC）', '推論', '2.2.301', NOW()),
  ('breakaway', 'filled', '入力済みだった項目名のカンマ区切り（shop・sei・mei・phone・mail など）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- brokerage_listings：不動産企画係のレコード
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('brokerage_listings', '不動産企画係のレコード', 'realty', '不動産企画係アプリ（realty）の全レコードを1つの表に入れたもの。1行が1レコードで、kind で種別を分ける。
種別：leads 売り反響 / buyLeads 買い反響 / ledger 媒介獲得台帳 / deals 商談案件 / resales 買取再販 / renewals 媒介更新 / settlements 精算書 / logs 変更履歴 / notices 通知 / sellerReports 販売報告 / comments コメント（viewings も受け付ける）。
種別ごとに使う列が違い、使わない列は NULL。列名は以前のアプリ（Supabase の records.data）のキーをそのまま使っている（camelCase）。
書くのは ② features/realty/（planner・broker・activity の request、架電ナビ navi_save、媒介紐付 ledger_link、いえらぶ突き合わせ、取り込み importer.ts、HOME''S 査定メール homesAssessment.ts）と ① handlers/portal/*_resale.php・sumai_step.php（sync のポータル反響。INSERT のみ）。① の brokerAction・plannerAction・activityAction は ② の予備。
読むのは frontend/src/components/realty/ の各画面と、中古の顧客DB・顧客詳細（master_data_id で中古の顧客とつなぐ）・会社レポート。
⚠️ 削除は論理削除（show_dashboard = 0・deleted_at）。⚠️ id は ① core/brokerage_id.php・② が採番する文字列で、行どうしの参照（ledgerId・dealId・entityId）はこの id を使う。
⚠️ 照合順序は utf8mb4_unicode_ci（realty_properties と同じ）。⚠️ 電話・メール・名前などの個人情報を含む。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'brokerage_listings' AND column_name NOT IN ('internal_id', 'kind', 'id', 'no', 'freq', 'note', 'staff', 'category', 'phase', 'priority', 'type', 'addr1', 'addr2', 'addr', 'property', 'targetProperty', 'propName', 'price', 'budget', 'fee', 'feeManual', 'portal', 'seller', 'buyer', 'customer', 'name', 'source', 'contact', 'phone', 'mail', 'keyInfo', 'keyStatus', 'baikaiType', 'propStatus', 'currentStatus', 'expiry', 'expiryFix', 'reinsDate', 'priceRevDate', 'lastReportDate', 'endReason', 'ledgerNo', 'ledgerId', 'extId', 'dealId', 'dealNo', 'subStaff', 'subRatio', 'coBroker', 'delivery', 'reformPrice', 'reformGp', 'reformNote', 'lostReason', 'lostDate', 'lostNote', 'createdAt', 'receivedDate', 'connectDate', 'contactDate', 'visitDate', 'viewDate', 'baikaiDate', 'contractDate', 'settleDate', 'followDate', 'inputDate', 'renewDate', 'applicationDate', 'nextDate', 'nextNote', 'callDates', 'reason', 'timing', 'status', 'buyPrice', 'buyBuilding', 'buySellerReg', 'buyStockAsset', 'taxCheckDate', 'buyContractDate', 'buySettleDate', 'listPrice', 'listDate', 'sellPrice', 'sellBuilding', 'sellStaff', 'sellContractDate', 'sellSettleDate', 'targetGp', 'costs', 'at', 'to', 'from', 'field', 'label', 'entity', 'entityId', 'entityNo', 'title', 'body', 'read', 'by', 'data', 'updatedAt', 'docDraft', 'docDraftAt', 'docDraftBy', 'master_data_id', 'property_db_id', 'property_db_name', 'property_db_match', 'show_dashboard', 'deleted_at', 'deleted_by', 'raw_data', 'created_at', 'updated_at', 'propertyId');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('brokerage_listings', 'internal_id', '内部の連番（主キー。自動採番）。控えの表（_bk_）との突き合わせに使う', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'kind', 'レコード種別 leads/buyLeads/ledger/deals/resales/renewals/settlements/logs/notices/sellerReports/comments。⚠️ NULL の行が1件ある（2026-11 時点のローカル）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'id', 'システムID（例: xmsbtyw0p36）。UUIDではない。⚠️ 行どうしの参照はこの値', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'no', '管理番号（台帳 No. など。台帳は ledger の最大値 + 1 で採番）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'freq', '報告周期（ledger。1か月 / 2週間）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'note', '備考', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'staff', '担当（v2.2.252 から空白なしの氏名にそろえた）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'category', '物件区分（戸建・マンション・住宅用地 など）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'phase', 'フェーズ', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'priority', '優先度（deals。（推定）以前のアプリの項目。Dashboard から作る商談は空）', '推論', '2.2.301', NOW()),
  ('brokerage_listings', 'type', '売/買/買取（deals）。notices では通知の種類（assign・unassign・cobroker・mention）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'addr1', '所在地の市区町村（ledger。台帳の編集画面）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'addr2', '所在地の番地まで（ledger）。⚠️ 売り反響から作った台帳は住所全体が入る。⚠️ 後ろに URL が付くことがある', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'addr', '住所（leads・resales。売り反響の物件の所在地）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'property', '物件名', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'targetProperty', '希望物件（buyLeads）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'propName', '物件名（settlements）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'price', '価格', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'budget', '予算', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'fee', '仲介手数料', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'feeManual', '手数料を手入力したか 0:false, 1:true', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'portal', '買い反響の反響元のポータル（buyLeads）。⚠️ ledger では以前のアプリが担当と同じ略称を入れていた列で、Dashboard の画面は読まない', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'seller', '売主', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'buyer', '買主', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'customer', '顧客名（deals・HOME''S 査定メールの売り反響）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'name', '顧客名（leads・buyLeads）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'source', '反響元（leads）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'contact', '連絡先（「電話 / メール」の形。以前のアプリの1欄。v2.2.251・252 で phone・mail と相互に埋めた）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'phone', '電話番号', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'mail', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'keyInfo', '鍵情報', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'keyStatus', '鍵の保管場所・状況（ledger。自由入力）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'baikaiType', '専任媒介/一般媒介/買取', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'propStatus', 'アクティブ/成約完了/媒介終了', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'currentStatus', '現況', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'expiry', '媒介有効期限(ledger)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'expiryFix', '有効期限を手入力で固定 0:false 1:true(ledger)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'reinsDate', 'REINS登録日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'priceRevDate', '価格改定日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'lastReportDate', '最終報告日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'endReason', '追客終了理由', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'ledgerNo', '媒介台帳の管理番号', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'ledgerId', '媒介台帳のid(deals・leads・buyLeads)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'extId', 'CSV取込・sync の重複判定キー (例: ieul:123)。⚠️ 取り込みで消えた行は NULL にする', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'dealId', '商談案件の id（buyLeads・ledger などから商談に連携したとき。入っていれば「案件連携済」）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'dealNo', '商談案件の管理番号（settlements）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'subStaff', '協同担当(deals)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'subRatio', '協同担当の取り分 0-100(deals)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'coBroker', '協力会社情報 JSON(deals/ledger)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'delivery', '引渡(settlements)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'reformPrice', 'リフォーム受注額（円・参考値）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'reformGp', 'リフォーム粗利（円）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'reformNote', 'リフォームの内容・備考', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'lostReason', '商談の失注理由（v2.2.244）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'lostDate', '商談の失注日（v2.2.244）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'lostNote', '商談の失注の詳細（v2.2.244）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'createdAt', '商談リストへの登録日（YYYY-MM-DD）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'receivedDate', '受信日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'connectDate', '通電日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'contactDate', '接触日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'visitDate', '訪問査定日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'viewDate', '内見日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'baikaiDate', '媒介契約日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'contractDate', '契約日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'settleDate', '決済日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'followDate', 'フォロー日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'inputDate', '入力日(renewals)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'renewDate', '更新日(renewals)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'applicationDate', '物件の申込日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'nextDate', '次回連絡日', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'nextNote', '次回アクションのメモ（自由テキスト）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'callDates', '架電/LINE/メールの履歴 JSON [{date,type,staff}]。架電キュー・架電ナビが足す。⚠️ 架電実績はこの列から数える', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'reason', '売却理由(leads)。架電ナビが空のときだけ入れる', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'timing', '売却希望時期(leads)。架電ナビが空のときだけ入れる', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'status', '進捗ステータス(resales。販売中・決済完了 など)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'buyPrice', '仕入価格(税込)(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'buyBuilding', '仕入のうち建物価格(税込)(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'buySellerReg', '仕入先のインボイス登録有無(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'buyStockAsset', '棚卸資産(宅建業者特例の対象) 0:false 1:true(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'taxCheckDate', '消費税確認日(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'buyContractDate', '仕入契約日(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'buySettleDate', '仕入決済日(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'listPrice', '売出価格(税込)(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'listDate', '売出日(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'sellPrice', '成約価格(税込)(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'sellBuilding', '成約のうち建物価格(税込)(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'sellStaff', '販売担当(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'sellContractDate', '売買契約日(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'sellSettleDate', '売買決済日(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'targetGp', '目標粗利(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'costs', '原価明細の配列 JSON [{cat,label,key,tax,plan,actual}](resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'at', '発生日時 ISO8601(logs/notices)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'to', '通知先/変更後の担当・値(logs/notices)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'from', '変更前の値(logs)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'field', '変更したフィールド名(logs)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'label', '変更対象の表示名(logs)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'entity', '対象種別 lead/buy/deal/ledger/resale(logs/notices)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'entityId', '対象のid(logs/notices)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'entityNo', '対象の管理番号(logs)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'title', '通知タイトル(notices)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'body', '通知本文(notices)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'read', '既読 0:false 1:true(notices)。activity:read で本人宛を既読にする', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'by', '実施者', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'data', '精算書のフォーム値 JSON(settlements)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'updatedAt', '更新日時(settlements。アプリ側が入れる文字列)', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'docDraft', '契約書フォームの下書き JSON（DocumentFormData）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'docDraftAt', '下書きを保存した日時', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'docDraftBy', '下書きを保存した担当者', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'master_data_id', '※master_data_resale と連携しているid（中古の顧客DB・顧客詳細が読む）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'property_db_id', '※property_dbと連携するid（いえらぶの物件）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'property_db_name', '※property_dbと連携する物件名', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'property_db_match', 'いえらぶの物件のつなぎ方（auto＝自動の突き合わせ・staff＝担当が選んだ・none。v2.2.258）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'show_dashboard', '一覧への表示 1:表示 0:非表示(論理削除)。⚠️ NULL も表示扱い', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'deleted_at', '論理削除した日時（NULL なら未削除）', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'deleted_by', '論理削除した担当者', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'raw_data', 'Supabase records.data の原本 JSON（無損失保持）。⚠️ 列に無いキー（アポの appt など）もここに入る', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'created_at', '作成日時', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'updated_at', '更新日時', '改修', '2.2.301', NOW()),
  ('brokerage_listings', 'propertyId', '媒介物件（realty_properties.id。v2.2.250）。台帳・売り反響・買い反響から物件へのつなぎ', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- brokerage_listings_bk_20261105_contact：反響の電話・メールの控え（v2.2.251）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('brokerage_listings_bk_20261105_contact', '反響の電話・メールの控え（v2.2.251）', 'realty', 'brokerage_listings（元の表）の、売り反響・買い反響（kind が leads・buyLeads）の phone・mail を連絡先（contact）から埋める前の写し（2026-11-05。v2.2.251）。
backend/scripts/sql/2026-11-05_realty_lead_contact_split.sql で作る。戻すときは同じファイルの末尾のコメントの UPDATE で internal_id を突き合わせる。
⚠️ 画面・処理からは使っていない（推定）。⚠️ 電話番号・メールアドレスを含む。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'brokerage_listings_bk_20261105_contact' AND column_name NOT IN ('internal_id', 'id', 'kind', 'phone', 'mail');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('brokerage_listings_bk_20261105_contact', 'internal_id', '元の表の internal_id（戻すときの突き合わせ）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_contact', 'id', 'システムID（例: xmsbtyw0p36）。UUIDではない。⚠️ 行どうしの参照はこの値', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_contact', 'kind', 'レコード種別 leads/buyLeads/ledger/deals/resales/renewals/settlements/logs/notices/sellerReports/comments。⚠️ NULL の行が1件ある（2026-11 時点のローカル）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_contact', 'phone', '埋める前の電話番号', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_contact', 'mail', '埋める前のメールアドレス', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- brokerage_listings_bk_20261105_contact_fill：反響の連絡先の控え（v2.2.252）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('brokerage_listings_bk_20261105_contact_fill', '反響の連絡先の控え（v2.2.252）', 'realty', 'brokerage_listings（元の表）の、売り反響・買い反響の空の連絡先（contact）を「電話 / メール」で埋める前の写し（2026-11-05。v2.2.252）。直した行だけが入る。
backend/scripts/sql/2026-11-05_realty_lead_contact_fill.sql で作る。
⚠️ 画面・処理からは使っていない（推定）。⚠️ ローカルでは 0 件（埋める行が無かった）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'brokerage_listings_bk_20261105_contact_fill' AND column_name NOT IN ('internal_id', 'id', 'kind', 'contact');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('brokerage_listings_bk_20261105_contact_fill', 'internal_id', '元の表の internal_id（戻すときの突き合わせ）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_contact_fill', 'id', 'システムID（例: xmsbtyw0p36）。UUIDではない。⚠️ 行どうしの参照はこの値', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_contact_fill', 'kind', 'レコード種別 leads/buyLeads/ledger/deals/resales/renewals/settlements/logs/notices/sellerReports/comments。⚠️ NULL の行が1件ある（2026-11 時点のローカル）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_contact_fill', 'contact', '埋める前の連絡先（空）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- brokerage_listings_bk_20261105_staff：担当者の表記そろえの控え（v2.2.252）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('brokerage_listings_bk_20261105_staff', '担当者の表記そろえの控え（v2.2.252）', 'realty', 'brokerage_listings（元の表）の担当者の表記を「空白なしの氏名」にそろえたときの、直した行の直す前・後の値（2026-11-05。v2.2.252）。
backend/scripts/sql/2026-11-05_realty_staff_name_unify.sql で作り、この表の _new の値で元の表を直した。戻すときは同じファイルの末尾のコメントの UPDATE で _old に戻す。
⚠️ 画面・処理からは使っていない（推定）。⚠️ SQL のコメントに「消さない」とある。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'brokerage_listings_bk_20261105_staff' AND column_name NOT IN ('internal_id', 'kind', 'staff_old', 'staff_new', 'sub_old', 'sub_new', 'sell_old', 'sell_new');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('brokerage_listings_bk_20261105_staff', 'internal_id', '元の表の internal_id（主キー）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_staff', 'kind', '元の表の kind（ローカルでは ledger だけ）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_staff', 'staff_old', '直す前の担当（staff）。略称や空白入りの氏名', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_staff', 'staff_new', '直した後の担当', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_staff', 'sub_old', '直す前の協同担当（subStaff）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_staff', 'sub_new', '直した後の協同担当', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_staff', 'sell_old', '直す前の販売担当（sellStaff）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_20261105_staff', 'sell_new', '直した後の販売担当', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- brokerage_listings_bk_import：不動産企画係のレコード（取り込み前の控え）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('brokerage_listings_bk_import', '不動産企画係のレコード（取り込み前の控え）', 'realty', 'brokerage_listings（元の表）の、以前のアプリのバックアップを取り込む前の写し（2026-10-28。v2.2.224）。
backend/scripts/sql/2026-10-28_realty_import_1_backup.sql で作り、_2_check.sql で取り込み後と比べ、_3_restore.sql で戻す。⚠️ 流し直すと作り直される（前の控えは消える）。
⚠️ 画面・処理からは使っていない（推定）。⚠️ 控えた後に足した列（lostReason・lostDate・lostNote・property_db_match・propertyId）は無い。
⚠️ 元の表と同じく個人情報を含む。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'brokerage_listings_bk_import' AND column_name NOT IN ('internal_id', 'kind', 'id', 'no', 'freq', 'note', 'staff', 'category', 'phase', 'priority', 'type', 'addr1', 'addr2', 'addr', 'property', 'targetProperty', 'propName', 'price', 'budget', 'fee', 'feeManual', 'portal', 'seller', 'buyer', 'customer', 'name', 'source', 'contact', 'phone', 'mail', 'keyInfo', 'keyStatus', 'baikaiType', 'propStatus', 'currentStatus', 'expiry', 'expiryFix', 'reinsDate', 'priceRevDate', 'lastReportDate', 'endReason', 'ledgerNo', 'ledgerId', 'extId', 'dealId', 'dealNo', 'subStaff', 'subRatio', 'coBroker', 'delivery', 'reformPrice', 'reformGp', 'reformNote', 'createdAt', 'receivedDate', 'connectDate', 'contactDate', 'visitDate', 'viewDate', 'baikaiDate', 'contractDate', 'settleDate', 'followDate', 'inputDate', 'renewDate', 'applicationDate', 'nextDate', 'nextNote', 'callDates', 'reason', 'timing', 'status', 'buyPrice', 'buyBuilding', 'buySellerReg', 'buyStockAsset', 'taxCheckDate', 'buyContractDate', 'buySettleDate', 'listPrice', 'listDate', 'sellPrice', 'sellBuilding', 'sellStaff', 'sellContractDate', 'sellSettleDate', 'targetGp', 'costs', 'at', 'to', 'from', 'field', 'label', 'entity', 'entityId', 'entityNo', 'title', 'body', 'read', 'by', 'data', 'updatedAt', 'docDraft', 'docDraftAt', 'docDraftBy', 'master_data_id', 'property_db_id', 'property_db_name', 'show_dashboard', 'deleted_at', 'deleted_by', 'raw_data', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('brokerage_listings_bk_import', 'internal_id', '内部の連番（主キー。自動採番）。控えの表（_bk_）との突き合わせに使う', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'kind', 'レコード種別 leads/buyLeads/ledger/deals/resales/renewals/settlements/logs/notices/sellerReports/comments。⚠️ NULL の行が1件ある（2026-11 時点のローカル）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'id', 'システムID（例: xmsbtyw0p36）。UUIDではない。⚠️ 行どうしの参照はこの値', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'no', '管理番号（台帳 No. など。台帳は ledger の最大値 + 1 で採番）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'freq', '報告周期（ledger。1か月 / 2週間）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'note', '備考', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'staff', '担当（v2.2.252 から空白なしの氏名にそろえた）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'category', '物件区分（戸建・マンション・住宅用地 など）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'phase', 'フェーズ', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'priority', '優先度（deals。（推定）以前のアプリの項目。Dashboard から作る商談は空）', '推論', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'type', '売/買/買取（deals）。notices では通知の種類（assign・unassign・cobroker・mention）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'addr1', '所在地の市区町村（ledger。台帳の編集画面）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'addr2', '所在地の番地まで（ledger）。⚠️ 売り反響から作った台帳は住所全体が入る。⚠️ 後ろに URL が付くことがある', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'addr', '住所（leads・resales。売り反響の物件の所在地）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'property', '物件名', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'targetProperty', '希望物件（buyLeads）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'propName', '物件名（settlements）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'price', '価格', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'budget', '予算', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'fee', '仲介手数料', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'feeManual', '手数料を手入力したか 0:false, 1:true', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'portal', '買い反響の反響元のポータル（buyLeads）。⚠️ ledger では以前のアプリが担当と同じ略称を入れていた列で、Dashboard の画面は読まない', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'seller', '売主', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'buyer', '買主', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'customer', '顧客名（deals・HOME''S 査定メールの売り反響）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'name', '顧客名（leads・buyLeads）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'source', '反響元（leads）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'contact', '連絡先（「電話 / メール」の形。以前のアプリの1欄。v2.2.251・252 で phone・mail と相互に埋めた）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'phone', '電話番号', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'mail', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'keyInfo', '鍵情報', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'keyStatus', '鍵の保管場所・状況（ledger。自由入力）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'baikaiType', '専任媒介/一般媒介/買取', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'propStatus', 'アクティブ/成約完了/媒介終了', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'currentStatus', '現況', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'expiry', '媒介有効期限(ledger)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'expiryFix', '有効期限を手入力で固定 0:false 1:true(ledger)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'reinsDate', 'REINS登録日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'priceRevDate', '価格改定日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'lastReportDate', '最終報告日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'endReason', '追客終了理由', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'ledgerNo', '媒介台帳の管理番号', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'ledgerId', '媒介台帳のid(deals・leads・buyLeads)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'extId', 'CSV取込・sync の重複判定キー (例: ieul:123)。⚠️ 取り込みで消えた行は NULL にする', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'dealId', '商談案件の id（buyLeads・ledger などから商談に連携したとき。入っていれば「案件連携済」）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'dealNo', '商談案件の管理番号（settlements）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'subStaff', '協同担当(deals)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'subRatio', '協同担当の取り分 0-100(deals)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'coBroker', '協力会社情報 JSON(deals/ledger)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'delivery', '引渡(settlements)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'reformPrice', 'リフォーム受注額（円・参考値）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'reformGp', 'リフォーム粗利（円）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'reformNote', 'リフォームの内容・備考', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'createdAt', '商談リストへの登録日（YYYY-MM-DD）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'receivedDate', '受信日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'connectDate', '通電日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'contactDate', '接触日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'visitDate', '訪問査定日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'viewDate', '内見日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'baikaiDate', '媒介契約日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'contractDate', '契約日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'settleDate', '決済日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'followDate', 'フォロー日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'inputDate', '入力日(renewals)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'renewDate', '更新日(renewals)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'applicationDate', '物件の申込日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'nextDate', '次回連絡日', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'nextNote', '次回アクションのメモ（自由テキスト）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'callDates', '架電/LINE/メールの履歴 JSON [{date,type,staff}]。架電キュー・架電ナビが足す。⚠️ 架電実績はこの列から数える', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'reason', '売却理由(leads)。架電ナビが空のときだけ入れる', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'timing', '売却希望時期(leads)。架電ナビが空のときだけ入れる', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'status', '進捗ステータス(resales。販売中・決済完了 など)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'buyPrice', '仕入価格(税込)(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'buyBuilding', '仕入のうち建物価格(税込)(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'buySellerReg', '仕入先のインボイス登録有無(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'buyStockAsset', '棚卸資産(宅建業者特例の対象) 0:false 1:true(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'taxCheckDate', '消費税確認日(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'buyContractDate', '仕入契約日(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'buySettleDate', '仕入決済日(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'listPrice', '売出価格(税込)(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'listDate', '売出日(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'sellPrice', '成約価格(税込)(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'sellBuilding', '成約のうち建物価格(税込)(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'sellStaff', '販売担当(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'sellContractDate', '売買契約日(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'sellSettleDate', '売買決済日(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'targetGp', '目標粗利(resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'costs', '原価明細の配列 JSON [{cat,label,key,tax,plan,actual}](resales)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'at', '発生日時 ISO8601(logs/notices)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'to', '通知先/変更後の担当・値(logs/notices)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'from', '変更前の値(logs)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'field', '変更したフィールド名(logs)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'label', '変更対象の表示名(logs)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'entity', '対象種別 lead/buy/deal/ledger/resale(logs/notices)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'entityId', '対象のid(logs/notices)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'entityNo', '対象の管理番号(logs)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'title', '通知タイトル(notices)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'body', '通知本文(notices)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'read', '既読 0:false 1:true(notices)。activity:read で本人宛を既読にする', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'by', '実施者', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'data', '精算書のフォーム値 JSON(settlements)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'updatedAt', '更新日時(settlements。アプリ側が入れる文字列)', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'docDraft', '契約書フォームの下書き JSON（DocumentFormData）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'docDraftAt', '下書きを保存した日時', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'docDraftBy', '下書きを保存した担当者', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'master_data_id', '※master_data_resale と連携しているid（中古の顧客DB・顧客詳細が読む）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'property_db_id', '※property_dbと連携するid（いえらぶの物件）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'property_db_name', '※property_dbと連携する物件名', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'show_dashboard', '一覧への表示 1:表示 0:非表示(論理削除)。⚠️ NULL も表示扱い', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'deleted_at', '論理削除した日時（NULL なら未削除）', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'deleted_by', '論理削除した担当者', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'raw_data', 'Supabase records.data の原本 JSON（無損失保持）。⚠️ 列に無いキー（アポの appt など）もここに入る', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'created_at', '作成日時', '改修', '2.2.301', NOW()),
  ('brokerage_listings_bk_import', 'updated_at', '更新日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- budget：販促費・広告費
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('budget', '販促費・広告費', 'common', '販促費・広告費の明細。1行が「1か月 × 1店舗 × 1媒体」の1伝票（同じ組み合わせが複数行あってよい）。
書くのは ② budgetTable.ts（ヘッダー「システム管理 → 予算テーブル」の CSV 追加。Master・BrandAdmin）と ② eventBudget.ts（イベント費用の入力。medium = ''イベント''）。
読むのは顧客・店舗別反響推移・反響推移・予算シミュレーター・イベント集計・Claudeによる分析（adspend）・経理の予算画面（① budget_accounting.php）など。広告費の集計はほぼ `response_medium = 0 AND section = ?` で絞る。
⚠️ UNIQUE キーが無い。同じ CSV を2回入れると2組になる（画面の確認で数を出すだけで、登録は止めない）。
⚠️ 「販管・広告費」は category の MKT（広告費）と PR（販促費）の合計。画面の「販促媒体別広告費」は MKT だけ。⚠️ 当月分は登録が遅れる。
⚠️ 見出しの文字（category・company・section など）がそのまま値に入った行が1行ある（CSV の見出しを取り込んだもの。推定）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'budget' AND column_name NOT IN ('id', 'budget_period', 'shop', 'medium', 'budget_value', 'note', 'company', 'remarks', 'response_medium', 'category', 'section', 'order_section');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('budget', 'id', '連番', '改修', '2.2.301', NOW()),
  ('budget', 'budget_period', '計上月（text。''2026/10/01'' の形。⚠️ ''2025/12/1'' のように0の無い値もある）。月は先頭7文字で比べる', '改修', '2.2.301', NOW()),
  ('budget', 'shop', '店舗名（shop_list.shop）。建売は課の単位（宮崎係 など）で入っている行がある', '改修', '2.2.301', NOW()),
  ('budget', 'medium', '販促媒体（medium_list.medium。例 SUUMO・イベント）。⚠️ 建売は medium_list に無い名前（ネット など）が多い', '改修', '2.2.301', NOW()),
  ('budget', 'budget_value', '金額（円）。⚠️ 返金・修正の負の値もある', '改修', '2.2.301', NOW()),
  ('budget', 'note', '件名（イベント費用入力の「タイトル」）', '改修', '2.2.301', NOW()),
  ('budget', 'company', '請求先（取引先の会社名）', '改修', '2.2.301', NOW()),
  ('budget', 'remarks', '詳細（メモ）。v2.2.243 で company の括弧書きをここへ移した', '改修', '2.2.301', NOW()),
  ('budget', 'response_medium', '1 = 反響媒体（看板・CM/ラジオなど、反響の経路として数えるもの）。広告費の集計は 0 の行だけを使う', '改修', '2.2.301', NOW()),
  ('budget', 'category', 'MKT = 広告費（ポータル・チラシ・SNS広告・来場特典など） / PR = 販促費（CM/ラジオ・看板・販促物・システム利用料など）', '改修', '2.2.301', NOW()),
  ('budget', 'section', '事業。order 注文 / spec 建売 / use 中古（⚠️ used ではなく use）。空の行はどの集計にも出ない', '改修', '2.2.301', NOW()),
  ('budget', 'order_section', '課（section_list.name。例 鹿児島営業1課・不動産営業1課）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- building：建築着工（月次）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('building', '建築着工（月次）', 'common', '国の建築着工統計の新設住宅の戸数（月次）。1行が「1市区町村 × 1か月」。全都道府県。
市況分析（① core/market.php・market_area.php。画面は frontend/src/components/market/）が、注文（持家）・建売（分譲住宅）のシェアの分母に使う。
作り直しは backend-express/scripts/sql/2026-08-27_building_monthly.sql（旧の表は building_backup_20260827 に退避）。
⚠️ e-Stat の API に月次 × 市区町村 × 利用関係別の表が無いので、受け取った CSV で入れ替える。
⚠️ (pref, area, year) は一意にならない（政令市の同名の区があるため、UNIQUE を張らない）。経年比較は年次の building_yearly を使う。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'building' AND column_name NOT IN ('no', 'pref', 'area', 'year', 'amount', 'owner', 'rent', 'employer', 'condominiums');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('building', 'no', '連番', '改修', '2.2.301', NOW()),
  ('building', 'pref', '都道府県名', '改修', '2.2.301', NOW()),
  ('building', 'area', '市区町村名。郡・区の行も含む', '改修', '2.2.301', NOW()),
  ('building', 'year', '"YYYY/MM"（列名は year だが月）。API は ''YYYY-MM'' に直して返す', '改修', '2.2.301', NOW()),
  ('building', 'amount', '新設住宅 合計戸数', '改修', '2.2.301', NOW()),
  ('building', 'owner', '持家。注文住宅のシェアの分母', '改修', '2.2.301', NOW()),
  ('building', 'rent', '貸家', '改修', '2.2.301', NOW()),
  ('building', 'employer', '給与住宅', '改修', '2.2.301', NOW()),
  ('building', 'condominiums', '分譲住宅。建売のシェアの分母', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- building_backup_20260827：建築着工（月次）の旧版
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('building_backup_20260827', '建築着工（月次）の旧版', 'common', 'building（建築着工・月次）を作り直したときに退避した旧の表（2026-08-27。backend-express/scripts/sql/2026-08-27_building_monthly.sql の RENAME）。列は今の building と同じで、型が text のまま。
⚠️ 画面・処理からは使っていない（推定）。
⚠️ SQL のコメントでは旧の表は5県・1,483行とあるが、ローカルの写しには全都道府県の 2025/01〜2026/06 が入っている（作り直しの前後で中身が入れ替わった可能性。推定）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'building_backup_20260827' AND column_name NOT IN ('no', 'pref', 'area', 'year', 'amount', 'owner', 'rent', 'employer', 'condominiums');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('building_backup_20260827', 'no', '連番', '改修', '2.2.301', NOW()),
  ('building_backup_20260827', 'pref', '都道府県名', '改修', '2.2.301', NOW()),
  ('building_backup_20260827', 'area', '市区町村名。郡・区の行も含む', '改修', '2.2.301', NOW()),
  ('building_backup_20260827', 'year', '"YYYY/MM"（列名は year だが月）。API は ''YYYY-MM'' に直して返す', '改修', '2.2.301', NOW()),
  ('building_backup_20260827', 'amount', '新設住宅 合計戸数', '改修', '2.2.301', NOW()),
  ('building_backup_20260827', 'owner', '持家。注文住宅のシェアの分母', '改修', '2.2.301', NOW()),
  ('building_backup_20260827', 'rent', '貸家', '改修', '2.2.301', NOW()),
  ('building_backup_20260827', 'employer', '給与住宅', '改修', '2.2.301', NOW()),
  ('building_backup_20260827', 'condominiums', '分譲住宅。建売のシェアの分母', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- building_yearly：建築着工（年次）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('building_yearly', '建築着工（年次）', 'common', '国の建築着工統計の新設住宅の戸数（年次）。1行が「1市区町村（または県全域）× 1年」。e-Stat の統計表 0003114522（2011〜）から取り込む（backend-express/scripts/import-estat-building-yearly.mjs。表は 2026-08-27_building_yearly.sql）。
市況分析の「月次／年次」の切り替えの年次側と、経年比較に使う。
⚠️ (areaCode, year) が一意。再取り込みは UPSERT。⚠️ ローカルの写しは 6県・2011〜2024 年。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'building_yearly' AND column_name NOT IN ('id', 'pref', 'area', 'areaCode', 'year', 'amount', 'owner', 'rent', 'employer', 'condominiums');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('building_yearly', 'id', '連番', '改修', '2.2.301', NOW()),
  ('building_yearly', 'pref', '都道府県名', '改修', '2.2.301', NOW()),
  ('building_yearly', 'area', '市区町村名。県全域は building と同じく "-"', '改修', '2.2.301', NOW()),
  ('building_yearly', 'areaCode', 'e-Stat の地域コード（例 46201=鹿児島市）。市町村合併があっても追える', '改修', '2.2.301', NOW()),
  ('building_yearly', 'year', '西暦', '改修', '2.2.301', NOW()),
  ('building_yearly', 'amount', '新設住宅 合計戸数', '改修', '2.2.301', NOW()),
  ('building_yearly', 'owner', '持家。注文住宅のシェアの分母', '改修', '2.2.301', NOW()),
  ('building_yearly', 'rent', '貸家', '改修', '2.2.301', NOW()),
  ('building_yearly', 'employer', '給与住宅', '改修', '2.2.301', NOW()),
  ('building_yearly', 'condominiums', '分譲住宅。建売のシェアの分母', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- call_achievement：架電実績（中古・月別）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('call_achievement', '架電実績（中古・月別）', 'used', 'コードからの使用箇所なし（推定：中専鹿児島店（中古）のスタッフごと・月ごとの架電件数とアポ件数。2025/01〜2026/04 の約100行で、それ以後は入っていない）。
1行＝1スタッフ×1か月。⚠️ 画面・処理からは使っていない（推定）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'call_achievement' AND column_name NOT IN ('no', 'name', 'shop', 'period', 'total', 'appointment');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('call_achievement', 'no', '連番（自動採番）', '推論', '2.2.301', NOW()),
  ('call_achievement', 'name', 'スタッフ名', '推論', '2.2.301', NOW()),
  ('call_achievement', 'shop', '店舗（すべて中専鹿児島店）', '推論', '2.2.301', NOW()),
  ('call_achievement', 'period', '年月（YYYY/MM）', '推論', '2.2.301', NOW()),
  ('call_achievement', 'total', '（推定）その月の架電件数（text）', '推論', '2.2.301', NOW()),
  ('call_achievement', 'appointment', '（推定）その月のアポ獲得件数（text）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- call_sheet：架電記録
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('call_sheet', '架電記録', 'common', '顧客ごとの架電（電話・連絡）の記録。1行＝1顧客（id は顧客台帳の id）。記録の中身は call_log に JSON 配列で持つ。
書くのは ② information の update_call_log（顧客の編集画面。有れば UPDATE・無ければ INSERT）と、中古の架電キュー（callq/usedQueue.ts。shop = ''買い:中古リノベ'' の顧客）。
読むのは顧客DB（初回通電日・次回架電日。ページの顧客の分だけ）、架電一覧（callStatusList.ts）、日報、毎日の行動（次回架電日）、記録の本文検索、分析 API など。
⚠️ text 列は NOT NULL で既定値が無い。INSERT では全列に値（空文字）を入れる。
⚠️ UPDATE では name を変えない（INSERT のときだけ入れる）。
⚠️ call_log の日本語は、生の UTF-8 と \\uXXXX にエスケープしたものが混在する（① と ② で保存の形が違う）。検索は JSON_SEARCH を使う。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'call_sheet' AND column_name NOT IN ('no', 'id', 'shop', 'staff', 'name', 'status', 'reserved_status', 'call_log');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('call_sheet', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('call_sheet', 'id', '顧客ID', '改修', '2.2.301', NOW()),
  ('call_sheet', 'shop', '顧客の担当店舗（中古は取引区分。例 買い:中古リノベ）', '改修', '2.2.301', NOW()),
  ('call_sheet', 'staff', '担当営業', '改修', '2.2.301', NOW()),
  ('call_sheet', 'name', '顧客名（作ったときの値）', '改修', '2.2.301', NOW()),
  ('call_sheet', 'status', '架電状況（call_status 表の status。未通電 / 継続 / 架電停止 / 来場済み / 来場アポ など）', '改修', '2.2.301', NOW()),
  ('call_sheet', 'reserved_status', '（推定）来場予約日（YYYY-MM-DD）', '推論', '2.2.301', NOW()),
  ('call_sheet', 'call_log', '架電の JSON 配列。1件は day・time・action（通電・不通 など。call_status 表の action）・note・staff・status', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- call_status：架電ステータス・アクションの選択肢
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('call_status', '架電ステータス・アクションの選択肢', 'common', '架電の記録で選ぶ「架電ステータス」と「架電アクション」の選択肢（v2.2.293〜）。1行＝1つの選択肢。
書くのは ② callStatusMaster.ts（管理画面で追加・変更）。読むのは顧客の編集画面などの選択肢（flag = 1 で、ログイン中の事業か all のものを sort 順に出す）。
⚠️ 選んだ文字列がそのまま顧客の call_status・call_sheet の status・架電記録の action に入る。名前を変えても過去の記録は変わらない（集計で旧名と新名が分かれる）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'call_status' AND column_name NOT IN ('no', 'kind', 'name', 'division', 'flag', 'sort', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('call_status', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('call_status', 'kind', 'status（架電ステータス）/ action（架電アクション）', '改修', '2.2.301', NOW()),
  ('call_status', 'name', '画面に出す名前（⚠️ 顧客の call_status・架電記録の action にこの文字列がそのまま入る）', '改修', '2.2.301', NOW()),
  ('call_status', 'division', 'order / spec / used / all', '改修', '2.2.301', NOW()),
  ('call_status', 'flag', '1 = 選択肢に出す / 0 = 出さない', '改修', '2.2.301', NOW()),
  ('call_status', 'sort', '並び順（小さい順）', '改修', '2.2.301', NOW()),
  ('call_status', 'updated_at', '最後に変えた日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- catalog_kaeru：建売のホームページ資料請求
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('catalog_kaeru', '建売のホームページ資料請求', 'spec', 'かえるホームのホームページの資料請求メールを取り込んだ元の表。1行＝資料請求メール1通。
書くもの：メールの取り込み（sync）が ① の request catalog_kaeru_update で送る（catalog_kaeru_update.php。INSERT IGNORE）。
続けて ① handlers/portal/catalog_kaeru.php が反響一覧（inquiry_customer_kaeru）へ `hp_catalog_kaeru_<no>` で写す（medium＝ホームページ反響・hp_campaign＝資料請求）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'catalog_kaeru' AND column_name NOT IN ('no', 'property', 'note', 'date', 'time', 'name', 'nameKana', 'email', 'zip', 'address', 'age', 'tel', 'source', 'registered', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('catalog_kaeru', 'no', '連番（自動採番）。反響ID の末尾になる', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'property', '物件情報（資料を請求した物件）', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'note', 'お問い合わせ内容', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'date', 'ご希望日（反響一覧の reserved_date）', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'time', 'ご希望時間（反響一覧の reserved_time）', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'name', 'お名前。⚠️ 空の行は反響一覧に写さない', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'nameKana', 'フリガナ', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'email', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'address', 'ご住所（反響一覧の building に入る）', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'age', 'ご年齢', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'tel', '電話番号（反響一覧の mobile に入る）', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'source', '何を見てかえるホームをお知りになりましたか？（反響一覧の response_medium）', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'registered', 'メール受信日時', '改修', '2.2.301', NOW()),
  ('catalog_kaeru', 'remarks', '詳細メモ（メールの全項目をつないだ文。反響一覧の note）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- catalog_resale：中古リノベのホームページ資料請求
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('catalog_resale', '中古リノベのホームページ資料請求', 'used', '中古住宅専門店（chuko-senmon.jp）の資料請求メールを取り込んだ元の表。1行＝資料請求メール1通。
書くもの：GAS（backend/scripts/gas/runCatalogResale.gs）がメールを読み、① の request catalog_resale_update で送る（catalog_resale_update.php。INSERT IGNORE）。
続けて ① handlers/portal/catalog_resale.php が反響一覧（inquiry_customer_resale）へ `hp_catalog_<no>` で写す（medium＝ホームページ反響・hp_campaign＝資料請求）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'catalog_resale' AND column_name NOT IN ('no', 'catalog_request', 'visit_reservation', 'name', 'nameKana', 'email', 'tel', 'zip', 'address', 'property', 'registered', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('catalog_resale', 'no', '連番（自動採番）。反響ID の末尾になる', '改修', '2.2.301', NOW()),
  ('catalog_resale', 'catalog_request', '資料請求（まとめて資料請求のメールは「まとめて資料請求」）', '改修', '2.2.301', NOW()),
  ('catalog_resale', 'visit_reservation', '見学予約', '改修', '2.2.301', NOW()),
  ('catalog_resale', 'name', 'お名前。⚠️ 空の行は反響一覧に写さない', '改修', '2.2.301', NOW()),
  ('catalog_resale', 'nameKana', 'フリガナ', '改修', '2.2.301', NOW()),
  ('catalog_resale', 'email', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('catalog_resale', 'tel', 'ご連絡先お電話番号（反響一覧の mobile に入る）', '改修', '2.2.301', NOW()),
  ('catalog_resale', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('catalog_resale', 'address', 'ご住所（反響一覧の building に入る）', '改修', '2.2.301', NOW()),
  ('catalog_resale', 'property', '資料請求対象不動産（住所・URL など）。⚠️ 反響一覧には remarks を通してだけ入る', '改修', '2.2.301', NOW()),
  ('catalog_resale', 'registered', 'メール受信日時', '改修', '2.2.301', NOW()),
  ('catalog_resale', 'remarks', '詳細メモ（メールの全項目をつないだ文。反響一覧の note）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- column_definition：テーブル定義書（列）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('column_definition', 'テーブル定義書（列）', 'common', 'テーブル定義書の列ごとの説明（v2.2.301）。1列＝1行（テーブル名＋列名）。
原稿は table_definition と同じ（tables/<テーブル名>.md の「## 列」）。⚠️ 原稿に無い列の説明は、SQL を流すと消える（原稿が正）。
⚠️ 列の説明に、お客様の名前・電話・住所などの実際の値を書かない。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'column_definition' AND column_name NOT IN ('table_name', 'column_name', 'description', 'source', 'updated_version', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('column_definition', 'table_name', 'テーブル名', '改修', '2.2.301', NOW()),
  ('column_definition', 'column_name', '列名（テーブル名と合わせて主キー）', '改修', '2.2.301', NOW()),
  ('column_definition', 'description', '列の説明', '改修', '2.2.301', NOW()),
  ('column_definition', 'source', '出典（改修 / 推論）', '改修', '2.2.301', NOW()),
  ('column_definition', 'updated_version', '説明を最後に直した版（説明・出典が変わったときだけ上がる）', '改修', '2.2.301', NOW()),
  ('column_definition', 'updated_at', '説明を最後に直した日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- company_achievement：契約目標（会社実績）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('company_achievement', '契約目標（会社実績）', 'common', '会社実績の画面で入れる契約目標。1行＝1か月×区分×名前（period・category・name の UNIQUE キー）。
書くのは ② change_company_achievement（company/index.ts。① change_company_achievement.php から移したもの）。読むのは会社実績（Company.tsx・QuarterSummary.tsx）、ランク画面、予算シミュレーター（category = ''shop'' の目標）。
⚠️ ON DUPLICATE KEY UPDATE で上書きする。UNIQUE キーが無いと同じマスに行が増えて合計が狂う。⚠️ 書き込みは ① へのフォールバック禁止。
⚠️ 入力を検証していない（空文字もそのまま入る。PHP からの挙動）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'company_achievement' AND column_name NOT IN ('no', 'category', 'name', 'period', 'value');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('company_achievement', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('company_achievement', 'category', '区分（shop = 店舗の目標 / staff = 営業の目標 / 中古リノベ = 中古の目標）', '改修', '2.2.301', NOW()),
  ('company_achievement', 'name', '店舗名または営業の名前（category による）', '改修', '2.2.301', NOW()),
  ('company_achievement', 'period', '年月（YYYY-MM）。中古リノベは空や「期間計」も入る', '改修', '2.2.301', NOW()),
  ('company_achievement', 'value', '目標の値（契約棟数など。text）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- competitor_pdf：他社資料（PDF）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('competitor_pdf', '他社資料（PDF）', 'common', 'お客様からもらった他社の資料（カタログ・見積もり・チラシなど）の PDF。1ファイル＝1行（v2.2.140 で「顧客1人1行・JSON 配列」から作り替えた）。
登録は顧客情報の他社資料と他社資料一覧（frontend utils/competitorPdfUpload.ts → ① handlers/competitor_pdf_upload.php。ファイルは ① の /uploads/competitors/）。
読むのは顧客情報（information/TableCompetitorPdf.tsx。id で引く）と「他社動向 → 他社資料」（CompetitorMaterials.tsx。request competitor_pdf。カテゴリ → 他社 → PDF のフォルダ表示）。
⚠️ id は顧客ごとに重複する（主キーは no）。⚠️ 移行した古いファイルは company・category が空（画面では「未分類」）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'competitor_pdf' AND column_name NOT IN ('no', 'id', 'name', 'path', 'staff', 'company', 'category', 'created');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('competitor_pdf', 'no', '連番（主キー）', '改修', '2.2.301', NOW()),
  ('competitor_pdf', 'id', 'master_data.id（どの顧客の資料か）', '改修', '2.2.301', NOW()),
  ('competitor_pdf', 'name', '画面に出す表示名', '改修', '2.2.301', NOW()),
  ('competitor_pdf', 'path', '/uploads/competitors/xxx.pdf', '改修', '2.2.301', NOW()),
  ('competitor_pdf', 'staff', '登録した営業', '改修', '2.2.301', NOW()),
  ('competitor_pdf', 'company', '他社名。master_data.competitors_text から選ぶ（house_maker の候補も出す）', '改修', '2.2.301', NOW()),
  ('competitor_pdf', 'category', 'カタログパンフレット/見積もり・提案書/チラシ/その他', '改修', '2.2.301', NOW()),
  ('competitor_pdf', 'created', '登録日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- competitor_pdf_old_20260921：他社資料の旧形式の控え（2026-09-21）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('competitor_pdf_old_20260921', '他社資料の旧形式の控え（2026-09-21）', 'common', 'competitor_pdf（元の表）を1ファイル1行に作り替える前の、旧形式（顧客1人1行）の写し（2026-09-21。backend/scripts/sql/2026-09-21_competitor_pdf_one_row_per_file.sql）。戻すときはこの表を rename する。
⚠️ 画面・処理からは使っていない（推定）。⚠️ 列の形が元の表と違う。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'competitor_pdf_old_20260921' AND column_name NOT IN ('no', 'id', 'pdf_path');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('competitor_pdf_old_20260921', 'no', '連番', '改修', '2.2.301', NOW()),
  ('competitor_pdf_old_20260921', 'id', 'master_data.id（顧客ごとに1行。PDF の無い空の行がほとんど）', '改修', '2.2.301', NOW()),
  ('competitor_pdf_old_20260921', 'pdf_path', 'その顧客の PDF の JSON 配列 [{"name","path","staff"}]', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- contract：契約・工程の一覧（旧）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('contract', '契約・工程の一覧（旧）', 'order', 'コードからの使用箇所なし（推定：注文住宅の契約ごとの工程（確認申請・着工・完工・引渡）と手数料を持つ旧い表。0行で、契約者の一覧は contract_customer に移っている）。
1行＝1契約（推定）。⚠️ 画面・処理からは使っていない（推定）。⚠️ 列名に綴りの誤りがある（Constraction・competion・commition）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'contract' AND column_name NOT IN ('id', 'idSearch', 'number', 'projectNumber', 'customerName', 'contractDate', 'confirmation', 'startConstraction', 'competionConstruction', 'handover', 'confirmation_2', 'startConstraction_2', 'competionConstruction_2', 'search', 'handover_2', 'handoverStatus', 'commitionIC', 'commitionArchitect', 'commitionControl', 'staff', 'section', 'shop', 'company');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('contract', 'id', '連番', '推論', '2.2.301', NOW()),
  ('contract', 'idSearch', '（推定）検索用の番号', '推論', '2.2.301', NOW()),
  ('contract', 'number', '（推定）契約の番号', '推論', '2.2.301', NOW()),
  ('contract', 'projectNumber', '工事番号', '推論', '2.2.301', NOW()),
  ('contract', 'customerName', '顧客名（邸名）', '推論', '2.2.301', NOW()),
  ('contract', 'contractDate', '契約日', '推論', '2.2.301', NOW()),
  ('contract', 'confirmation', '（推定）確認申請日（予定）', '推論', '2.2.301', NOW()),
  ('contract', 'startConstraction', '着工日（予定）', '推論', '2.2.301', NOW()),
  ('contract', 'competionConstruction', '完工日（予定）', '推論', '2.2.301', NOW()),
  ('contract', 'handover', '引渡日（予定）', '推論', '2.2.301', NOW()),
  ('contract', 'confirmation_2', '（推定）確認申請日（実績）', '推論', '2.2.301', NOW()),
  ('contract', 'startConstraction_2', '（推定）着工日（実績）', '推論', '2.2.301', NOW()),
  ('contract', 'competionConstruction_2', '（推定）完工日（実績）', '推論', '2.2.301', NOW()),
  ('contract', 'search', '（推定）検索用の文字列', '推論', '2.2.301', NOW()),
  ('contract', 'handover_2', '（推定）引渡日（実績）', '推論', '2.2.301', NOW()),
  ('contract', 'handoverStatus', '引渡の状態', '推論', '2.2.301', NOW()),
  ('contract', 'commitionIC', '（推定）IC（インテリアコーディネーター）の手数料・担当', '推論', '2.2.301', NOW()),
  ('contract', 'commitionArchitect', '（推定）設計の手数料・担当', '推論', '2.2.301', NOW()),
  ('contract', 'commitionControl', '（推定）工事管理の手数料・担当', '推論', '2.2.301', NOW()),
  ('contract', 'staff', '営業担当', '推論', '2.2.301', NOW()),
  ('contract', 'section', '営業課', '推論', '2.2.301', NOW()),
  ('contract', 'shop', '店舗', '推論', '2.2.301', NOW()),
  ('contract', 'company', '会社（ブランド）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- contract_customer：契約者一覧（受注完工）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('contract_customer', '契約者一覧（受注完工）', 'common', '注文住宅（と一部の建売）の契約者一覧。スプレッドシート「受注完工【KHG】」の CSV から取り込む。1行＝1契約者（CSV の1行）。
取り込みは backend-express/scripts/import-construction-csv.mjs。読むのは市況分析（Market）の「KHGの着工棟数」（① market_construction.php）。
2026-08-26 に作り直した（backend-express/scripts/sql/2026-08-26_market_construction.sql）。日付列は date 型にし、日付でない値（解約・未定・未入力・工程表無し）は status に逃がしている。
⚠️ 建売の着工は物件単位の kaeru_building で数える（契約者一覧には未販売の着工物件が載らないため）。⚠️ 氏名にサロゲートペアがあるので utf8mb4 のまま扱う。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'contract_customer' AND column_name NOT IN ('id', 'name', 'contractDate', 'constructionDate', 'completionDate', 'handoverDate', 'status', 'staff', 'section', 'shop', 'category', 'address', 'pref', 'sourceRow');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('contract_customer', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('contract_customer', 'name', '邸名（契約者名）', '改修', '2.2.301', NOW()),
  ('contract_customer', 'contractDate', '契約計上年月日', '改修', '2.2.301', NOW()),
  ('contract_customer', 'constructionDate', '着工予定日（済は実績）', '改修', '2.2.301', NOW()),
  ('contract_customer', 'completionDate', '完工予定日（済は実績）', '改修', '2.2.301', NOW()),
  ('contract_customer', 'handoverDate', '引渡年月日（済は実績）', '改修', '2.2.301', NOW()),
  ('contract_customer', 'status', '日付列に入っていた非日付値（解約/未定/未入力/工程表無し）', '改修', '2.2.301', NOW()),
  ('contract_customer', 'staff', '営業担当', '改修', '2.2.301', NOW()),
  ('contract_customer', 'section', '営業所属課', '改修', '2.2.301', NOW()),
  ('contract_customer', 'shop', '事業所', '改修', '2.2.301', NOW()),
  ('contract_customer', 'category', '注文 / 建売。事業所に「かえる」を含むかで判定', '改修', '2.2.301', NOW()),
  ('contract_customer', 'address', '建築地', '改修', '2.2.301', NOW()),
  ('contract_customer', 'pref', '県', '改修', '2.2.301', NOW()),
  ('contract_customer', 'sourceRow', '元CSVの行番号（差し戻し調査用）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- contract_customer_backup_20260827：契約者一覧の退避（2026-08-27）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('contract_customer_backup_20260827', '契約者一覧の退避（2026-08-27）', 'common', 'contract_customer（契約者一覧）を作り直す前の写し（2026-08 下旬）。全列が text で、status・sourceRow の列が無い旧い形。
作り直しの SQL（2026-08-26_market_construction.sql）は _backup_20260826 の名前で退避する書き方だが、実物はこの名前で残っている（推定：実行日が27日だった）。
⚠️ 画面・処理からは使っていない（推定）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'contract_customer_backup_20260827' AND column_name NOT IN ('id', 'name', 'contractDate', 'constructionDate', 'completionDate', 'handoverDate', 'staff', 'section', 'shop', 'category', 'address', 'pref');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('contract_customer_backup_20260827', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('contract_customer_backup_20260827', 'name', '邸名（契約者名）', '改修', '2.2.301', NOW()),
  ('contract_customer_backup_20260827', 'contractDate', '契約計上日（text。日付以外の値も混ざる）', '推論', '2.2.301', NOW()),
  ('contract_customer_backup_20260827', 'constructionDate', '着工日（text。日付以外の値も混ざる）', '推論', '2.2.301', NOW()),
  ('contract_customer_backup_20260827', 'completionDate', '完工日（text。日付以外の値も混ざる）', '推論', '2.2.301', NOW()),
  ('contract_customer_backup_20260827', 'handoverDate', '引渡日（text。日付以外の値も混ざる）', '推論', '2.2.301', NOW()),
  ('contract_customer_backup_20260827', 'staff', '営業担当', '改修', '2.2.301', NOW()),
  ('contract_customer_backup_20260827', 'section', '営業所属課', '改修', '2.2.301', NOW()),
  ('contract_customer_backup_20260827', 'shop', '事業所', '改修', '2.2.301', NOW()),
  ('contract_customer_backup_20260827', 'category', '注文 / 建売。事業所に「かえる」を含むかで判定', '改修', '2.2.301', NOW()),
  ('contract_customer_backup_20260827', 'address', '建築地', '改修', '2.2.301', NOW()),
  ('contract_customer_backup_20260827', 'pref', '県', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- contract_expected：契約見込み数（当月確約数）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('contract_expected', '契約見込み数（当月確約数）', 'common', '店舗ごと・月ごとの契約見込み数（ランク画面の「当月確約数」など）。1行＝1か月×1営業課×1店舗（date・section・shop の UNIQUE キー）。
書くのは ② contract_ex_update（interviewLog.ts の runContractExpectedUpdate。① contract_ex_update.php から移したもの）。読むのはランク画面（RankOrder・RankKaeru・RankResale。rank の EXPECTED_SQL）。
⚠️ ON DUPLICATE KEY UPDATE で上書きする。UNIQUE キーを外すと同じ組み合わせの行が増え続ける。⚠️ 書き込みは ① へのフォールバック禁止。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'contract_expected' AND column_name NOT IN ('id', 'date', 'section', 'shop', 'count');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('contract_expected', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('contract_expected', 'date', '年月（YYYY/MM）', '改修', '2.2.301', NOW()),
  ('contract_expected', 'section', '営業課', '改修', '2.2.301', NOW()),
  ('contract_expected', 'shop', '店舗', '改修', '2.2.301', NOW()),
  ('contract_expected', 'count', '契約見込み数（空なら 0）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- contract_goal：契約目標（店舗・月別。旧）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('contract_goal', '契約目標（店舗・月別。旧）', 'common', 'コードからの使用箇所なし（推定：店舗ごと・月ごとの契約棟数の目標。2025/06〜2026/05 の1年分だけ入っている。今の契約目標は company_achievement で持つ）。
1行＝1か月×1店舗。⚠️ 画面・処理からは使っていない（推定）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'contract_goal' AND column_name NOT IN ('id', 'period', 'shop', 'section', 'goal');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('contract_goal', 'id', '連番', '推論', '2.2.301', NOW()),
  ('contract_goal', 'period', '年月（YYYY/MM）', '推論', '2.2.301', NOW()),
  ('contract_goal', 'shop', '店舗', '推論', '2.2.301', NOW()),
  ('contract_goal', 'section', '営業課', '推論', '2.2.301', NOW()),
  ('contract_goal', 'goal', '契約目標（棟数）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- customers：旧顧客一覧（注文）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('customers', '旧顧客一覧（注文）', 'order', '注文住宅の顧客の旧い一覧（スプレッドシート時代の形と推定）。1行＝1顧客。id は master_data.id と同じ値。
⚠️ 2026-07-22 を最後に中身が更新されていない（docs/deploy-v2.2.270.md）。顧客の正は master_data。v2.2.270 で面談アンケートのお客様検索も master_data に切り替えた。
今も書くのは2か所だけ。反響の取り込み（sync → inquiry_update:new_customer。無いときだけ master_data と一緒に1行入れる）と、面談前・面談後アンケートの回答（survey/public.ts が before_interview・after_interview を 1 にする）。
⚠️ trash 以外の列は NOT NULL で既定値が無い。行を入れるときは全列を書く（inquiryUpdate.ts の CUSTOMERS_COLUMNS。① inquiry_update.php と同じ内容にそろえる）。
多くの列はコードで読んでいないので、意味は列名と値から推している。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'customers' AND column_name NOT IN ('no', 'id', 'name', 'date', 'status', 'rank', 'rank_period', 'register', 'reserve', 'shop', 'staff', 'medium', 'estate', 'place', 'budget', 'loan', 'repayment', 'contract', 'meeting', 'rank_history', 'section', 'appointment', 'second_reserve', 'line_group', 'screening', 'rival', 'period', 'survey', 'importance', 'note', 'sales_meeting', 'before_survey', 'before_interview', 'after_interview', 'call_status', 'reserved_status', 'phone_number', 'full_address', 'zip', 'lat_lng', 'response_status', 'campaign', 'trash', 'cancel_status', 'ice_world', 'gift');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('customers', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('customers', 'id', '顧客ID（master_data.id と同じ）', '改修', '2.2.301', NOW()),
  ('customers', 'name', '顧客名', '改修', '2.2.301', NOW()),
  ('customers', 'date', '（推定）反響・登録の日時', '推論', '2.2.301', NOW()),
  ('customers', 'status', '顧客の状態（見込み / 会社管理 / 失注 / 重複 / 契約済み）', '改修', '2.2.301', NOW()),
  ('customers', 'rank', 'ランク（Aランク〜Eランク）', '推論', '2.2.301', NOW()),
  ('customers', 'rank_period', 'ランクの見込み時期', '推論', '2.2.301', NOW()),
  ('customers', 'register', '（推定）反響日', '推論', '2.2.301', NOW()),
  ('customers', 'reserve', '（推定）来場予約日', '推論', '2.2.301', NOW()),
  ('customers', 'shop', '担当店舗', '改修', '2.2.301', NOW()),
  ('customers', 'staff', '担当営業', '改修', '2.2.301', NOW()),
  ('customers', 'medium', '反響媒体', '推論', '2.2.301', NOW()),
  ('customers', 'estate', '土地の有無（有 / 無）', '推論', '2.2.301', NOW()),
  ('customers', 'place', '（推定）建築予定地・希望地', '推論', '2.2.301', NOW()),
  ('customers', 'budget', '予算', '推論', '2.2.301', NOW()),
  ('customers', 'loan', '（推定）借入・ローンの状況', '推論', '2.2.301', NOW()),
  ('customers', 'repayment', '（推定）月々の返済額。全件空', '推論', '2.2.301', NOW()),
  ('customers', 'contract', '（推定）契約日', '推論', '2.2.301', NOW()),
  ('customers', 'meeting', '（推定）面談日。全件空', '推論', '2.2.301', NOW()),
  ('customers', 'rank_history', 'ランクの履歴（「日付:ランク」の連なり）', '推論', '2.2.301', NOW()),
  ('customers', 'section', '担当の営業課', '改修', '2.2.301', NOW()),
  ('customers', 'appointment', '（推定）次回アポの日付', '推論', '2.2.301', NOW()),
  ('customers', 'second_reserve', '（推定）2回目の来場予約日', '推論', '2.2.301', NOW()),
  ('customers', 'line_group', '（推定）LINEグループ作成日', '推論', '2.2.301', NOW()),
  ('customers', 'screening', '（推定）事前審査日', '推論', '2.2.301', NOW()),
  ('customers', 'rival', '（推定）競合', '推論', '2.2.301', NOW()),
  ('customers', 'period', '（推定）入居希望時期', '推論', '2.2.301', NOW()),
  ('customers', 'survey', '（推定）面談時のヒアリングメモ', '推論', '2.2.301', NOW()),
  ('customers', 'importance', '（推定）重視項目', '推論', '2.2.301', NOW()),
  ('customers', 'note', '備考', '推論', '2.2.301', NOW()),
  ('customers', 'sales_meeting', '（推定）営業会議でのランク・状態の記録（「日付 ランク」など）', '推論', '2.2.301', NOW()),
  ('customers', 'before_survey', '1 = 事前アンケートの回答あり', '改修', '2.2.301', NOW()),
  ('customers', 'before_interview', '1 = 面談前アンケートの回答あり（survey/public.ts が入れる）', '改修', '2.2.301', NOW()),
  ('customers', 'after_interview', '1 = 面談後アンケートの回答あり（survey/public.ts が入れる）', '改修', '2.2.301', NOW()),
  ('customers', 'call_status', '架電状況', '推論', '2.2.301', NOW()),
  ('customers', 'reserved_status', '（推定）来場予約の日付（YYYY-MM-DD）', '推論', '2.2.301', NOW()),
  ('customers', 'phone_number', '電話番号', '改修', '2.2.301', NOW()),
  ('customers', 'full_address', '住所', '改修', '2.2.301', NOW()),
  ('customers', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('customers', 'lat_lng', '住所の緯度経度', '推論', '2.2.301', NOW()),
  ('customers', 'response_status', '（推定）反響の種類・媒体（ホームページ反響 / タウンライフ / HOME''S など）', '推論', '2.2.301', NOW()),
  ('customers', 'campaign', '（推定）HP のキャンペーン名', '推論', '2.2.301', NOW()),
  ('customers', 'trash', '（推定）表示の印。ほぼ全件 1（master_data.show_dashboard と同じく 1 = 表示と推定）', '推論', '2.2.301', NOW()),
  ('customers', 'cancel_status', '来場キャンセルの理由', '推論', '2.2.301', NOW()),
  ('customers', 'ice_world', 'ぶるぶるアイスワールドの利用予約日時', '推論', '2.2.301', NOW()),
  ('customers', 'gift', '（推定）ギフト進呈の印。全件空', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- customers_estate：顧客の希望土地条件
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('customers_estate', '顧客の希望土地条件', 'order', '顧客ごとの土地探しの条件。1行＝1顧客（id は master_data.id）。土地の一覧（Estate.tsx）で条件を保存し、次に開いたときにその条件で物件を絞る。
書くのは ① estate_area.php（有れば UPDATE・無ければ INSERT）、読むのは ① estate.php（request: estate）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'customers_estate' AND column_name NOT IN ('no', 'id', 'budget', 'pref', 'town', 'area', 'land_area', 'walk', 'for_house');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('customers_estate', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('customers_estate', 'id', '顧客ID（master_data.id）', '改修', '2.2.301', NOW()),
  ('customers_estate', 'budget', '土地の予算の上限（万円）。物件の価格が「予算−499〜予算」に入るものを出す', '改修', '2.2.301', NOW()),
  ('customers_estate', 'pref', '県', '改修', '2.2.301', NOW()),
  ('customers_estate', 'town', '市区町村・町名（住所に含むかで絞る）', '改修', '2.2.301', NOW()),
  ('customers_estate', 'area', '希望エリアの語の配列（JSON 文字列。どれかを住所に含めば出す）', '改修', '2.2.301', NOW()),
  ('customers_estate', 'land_area', '必要な土地面積の下限', '改修', '2.2.301', NOW()),
  ('customers_estate', 'walk', '駅徒歩の上限（分）', '改修', '2.2.301', NOW()),
  ('customers_estate', 'for_house', '1 = 住宅用地だけ出す', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- estate_info：土地情報（売地の在庫）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('estate_info', '土地情報（売地の在庫）', 'common', '外部の物件情報（アットホーム・スーモ・ホームズ・レインズ・手入力）から集めた売地の情報。1物件 = 1行（property_id で一意）。ローカルでは約5.5万件で、すべて 土地 / 売地 / 在庫有。
書くのは ① handlers/estate_update.php（request: estate_update。行の配列を property_id で追加・更新。⚠️ 呼び出し元は Dashboard の中に無く、外部の同期処理とみられる。以前は header/unused/SyncEstate.tsx から外部の同期サーバーを呼んでいた）。
読むのは ① estate.php（Estate.tsx。顧客の希望エリア customers_estate と合わせて直近1年の土地を出す）・estateInfo.php（EstateInfo.tsx。1件の詳細）と、ヘッダー・メニューの新着件数（① header.php・menu.php／② header.ts・menu.ts。登録が直近3日の件数）。
⚠️ Estate.tsx を開く入口（setEstateId）が Menu.tsx の中に見当たらず、画面からは開けない可能性がある（推定）。⚠️ ローカルの registered_at は 2026-06-30 が最後で、取り込みが止まっている可能性がある。
列の説明は列名と登録値からの推定（元のシステムの項目名を英語にしたもの）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'estate_info' AND column_name NOT IN ('id', 'property_id', 'property_type', 'property_category', 'reins_property_id', 'sales_status', 'transaction_status', 'price', 'address_pref', 'address_city', 'address_town', 'property_name', 'room_number', 'latitude', 'longitude', 'railway_line', 'nearest_station', 'walk_time1', 'bus_time', 'bus_route', 'bus_stop', 'walk_time2', 'unit_price_sqm', 'unit_price_tsubo', 'yield_percent', 'land_right', 'zoning1', 'zoning2', 'current_status', 'special_note_flag', 'delivery', 'delivery_condition', 'note1', 'note2', 'sales_point', 'brokerage_type', 'equipment_free', 'feature_free', 'condition_free', 'free_memo', 'registered_at', 'updated_at', 'contracted_at', 'contracted_year_month', 'info_source', 'register_method', 'display_flag', 'image_exists_flag', 'latlng_set_flag', 'listing_company', 'listing_company_tel', 'construction_company', 'permission_type', 'photo_permission_type', 'permission_date', 'permission_fax_id', 'permission_fax_sent_flag', 'permission_fax_sent_date', 'floor_plan', 'floor_plan_code', 'floor_plan_detail', 'built_year_month', 'exclusive_area', 'balcony_area', 'direction', 'floors_above', 'floors_below', 'floor_number', 'total_units', 'parking_flag', 'parking_fee', 'parking_count', 'parking_deposit', 'parking_note', 'management_fee', 'reserve_fund', 'management_type', 'management_method', 'land_area', 'private_road_area', 'building_area', 'building_structure', 'national_land_law', 'city_planning', 'land_category', 'topography', 'bcr1', 'far1', 'bcr2', 'far2', 'corner_flag', 'road_condition1', 'road_condition2', 'road_condition3', 'best_use', 'legal_restrictions', 'movie_url1', 'movie_url2', 'no_brokerage_fee_flag', 'admin_memo', 'reins_no_image_flag', 'reins_image_import_flag');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('estate_info', 'id', '連番（主キー）', '推論', '2.2.301', NOW()),
  ('estate_info', 'property_id', '元のシステムの物件番号。⚠️ 取り込みの突き合わせのキー', '推論', '2.2.301', NOW()),
  ('estate_info', 'property_type', '物件種別（ローカルは「土地」だけ）', '推論', '2.2.301', NOW()),
  ('estate_info', 'property_category', '物件種目（ローカルは「売地」だけ）', '推論', '2.2.301', NOW()),
  ('estate_info', 'reins_property_id', 'レインズの物件番号', '推論', '2.2.301', NOW()),
  ('estate_info', 'sales_status', '販売状況（ローカルは「在庫有」だけ）', '推論', '2.2.301', NOW()),
  ('estate_info', 'transaction_status', '取引状況（公開中・書面による購入申し込みあり・売主都合で一時紹介停止中 など）', '推論', '2.2.301', NOW()),
  ('estate_info', 'price', '価格（円）', '推論', '2.2.301', NOW()),
  ('estate_info', 'address_pref', '所在地の都道府県', '推論', '2.2.301', NOW()),
  ('estate_info', 'address_city', '所在地の市区町村', '推論', '2.2.301', NOW()),
  ('estate_info', 'address_town', '所在地の町名', '推論', '2.2.301', NOW()),
  ('estate_info', 'property_name', '物件名', '推論', '2.2.301', NOW()),
  ('estate_info', 'room_number', '部屋番号', '推論', '2.2.301', NOW()),
  ('estate_info', 'latitude', '緯度', '推論', '2.2.301', NOW()),
  ('estate_info', 'longitude', '経度', '推論', '2.2.301', NOW()),
  ('estate_info', 'railway_line', '沿線', '推論', '2.2.301', NOW()),
  ('estate_info', 'nearest_station', '最寄り駅', '推論', '2.2.301', NOW()),
  ('estate_info', 'walk_time1', '駅からの徒歩（分）', '推論', '2.2.301', NOW()),
  ('estate_info', 'bus_time', 'バスの乗車時間（分）', '推論', '2.2.301', NOW()),
  ('estate_info', 'bus_route', 'バスの路線', '推論', '2.2.301', NOW()),
  ('estate_info', 'bus_stop', 'バス停', '推論', '2.2.301', NOW()),
  ('estate_info', 'walk_time2', 'バス停からの徒歩（分）', '推論', '2.2.301', NOW()),
  ('estate_info', 'unit_price_sqm', '㎡単価', '推論', '2.2.301', NOW()),
  ('estate_info', 'unit_price_tsubo', '坪単価', '推論', '2.2.301', NOW()),
  ('estate_info', 'yield_percent', '利回り（%）', '推論', '2.2.301', NOW()),
  ('estate_info', 'land_right', '土地の権利（所有権 など）', '推論', '2.2.301', NOW()),
  ('estate_info', 'zoning1', '用途地域1', '推論', '2.2.301', NOW()),
  ('estate_info', 'zoning2', '用途地域2', '推論', '2.2.301', NOW()),
  ('estate_info', 'current_status', '現況（更地・古家あり など）', '推論', '2.2.301', NOW()),
  ('estate_info', 'special_note_flag', '特記事項の有無（0 / 1）', '推論', '2.2.301', NOW()),
  ('estate_info', 'delivery', '引渡時期', '推論', '2.2.301', NOW()),
  ('estate_info', 'delivery_condition', '引渡条件', '推論', '2.2.301', NOW()),
  ('estate_info', 'note1', '備考1', '推論', '2.2.301', NOW()),
  ('estate_info', 'note2', '備考2', '推論', '2.2.301', NOW()),
  ('estate_info', 'sales_point', 'セールスポイント', '推論', '2.2.301', NOW()),
  ('estate_info', 'brokerage_type', '取引態様（売主・代理・専任媒介・一般媒介 など。表記がそろっていない）', '推論', '2.2.301', NOW()),
  ('estate_info', 'equipment_free', '設備（自由記述）', '推論', '2.2.301', NOW()),
  ('estate_info', 'feature_free', '特徴（自由記述）', '推論', '2.2.301', NOW()),
  ('estate_info', 'condition_free', '条件（自由記述）', '推論', '2.2.301', NOW()),
  ('estate_info', 'free_memo', 'メモ（自由記述）', '推論', '2.2.301', NOW()),
  ('estate_info', 'registered_at', '情報の登録日。⚠️ 新着件数・直近1年の絞り込みに使う', '推論', '2.2.301', NOW()),
  ('estate_info', 'updated_at', '情報の更新日（取り込みで更新したときは取り込んだ日）', '推論', '2.2.301', NOW()),
  ('estate_info', 'contracted_at', '成約日', '推論', '2.2.301', NOW()),
  ('estate_info', 'contracted_year_month', '成約年月', '推論', '2.2.301', NOW()),
  ('estate_info', 'info_source', '情報の出どころ（アットホーム・スーモ・ホームズ・レインズ・手入力）', '推論', '2.2.301', NOW()),
  ('estate_info', 'register_method', '登録方法（0 / 1）', '推論', '2.2.301', NOW()),
  ('estate_info', 'display_flag', '表示の区分（0 / 1 / 2）', '推論', '2.2.301', NOW()),
  ('estate_info', 'image_exists_flag', '画像の有無（0 / 1）', '推論', '2.2.301', NOW()),
  ('estate_info', 'latlng_set_flag', '緯度経度を設定済みか（0 / 1）', '推論', '2.2.301', NOW()),
  ('estate_info', 'listing_company', '元付け（情報を出している不動産会社）', '推論', '2.2.301', NOW()),
  ('estate_info', 'listing_company_tel', '元付けの電話番号', '推論', '2.2.301', NOW()),
  ('estate_info', 'construction_company', '施工会社（建築条件付きの指定業者）', '推論', '2.2.301', NOW()),
  ('estate_info', 'permission_type', '広告の掲載許可の区分', '推論', '2.2.301', NOW()),
  ('estate_info', 'photo_permission_type', '写真の掲載許可の区分', '推論', '2.2.301', NOW()),
  ('estate_info', 'permission_date', '掲載許可の日', '推論', '2.2.301', NOW()),
  ('estate_info', 'permission_fax_id', '掲載許可の FAX の番号', '推論', '2.2.301', NOW()),
  ('estate_info', 'permission_fax_sent_flag', '掲載許可の FAX を送ったか（0 / 1）', '推論', '2.2.301', NOW()),
  ('estate_info', 'permission_fax_sent_date', '掲載許可の FAX を送った日', '推論', '2.2.301', NOW()),
  ('estate_info', 'floor_plan', '間取り', '推論', '2.2.301', NOW()),
  ('estate_info', 'floor_plan_code', '間取りのコード', '推論', '2.2.301', NOW()),
  ('estate_info', 'floor_plan_detail', '間取りの内訳', '推論', '2.2.301', NOW()),
  ('estate_info', 'built_year_month', '築年月', '推論', '2.2.301', NOW()),
  ('estate_info', 'exclusive_area', '専有面積（㎡）', '推論', '2.2.301', NOW()),
  ('estate_info', 'balcony_area', 'バルコニー面積（㎡）', '推論', '2.2.301', NOW()),
  ('estate_info', 'direction', '向き', '推論', '2.2.301', NOW()),
  ('estate_info', 'floors_above', '地上階数', '推論', '2.2.301', NOW()),
  ('estate_info', 'floors_below', '地下階数', '推論', '2.2.301', NOW()),
  ('estate_info', 'floor_number', '所在階', '推論', '2.2.301', NOW()),
  ('estate_info', 'total_units', '総戸数', '推論', '2.2.301', NOW()),
  ('estate_info', 'parking_flag', '駐車場の有無（0 / 1）', '推論', '2.2.301', NOW()),
  ('estate_info', 'parking_fee', '駐車場の料金', '推論', '2.2.301', NOW()),
  ('estate_info', 'parking_count', '駐車場の台数', '推論', '2.2.301', NOW()),
  ('estate_info', 'parking_deposit', '駐車場の敷金', '推論', '2.2.301', NOW()),
  ('estate_info', 'parking_note', '駐車場の備考', '推論', '2.2.301', NOW()),
  ('estate_info', 'management_fee', '管理費', '推論', '2.2.301', NOW()),
  ('estate_info', 'reserve_fund', '修繕積立金', '推論', '2.2.301', NOW()),
  ('estate_info', 'management_type', '管理形態', '推論', '2.2.301', NOW()),
  ('estate_info', 'management_method', '管理方式', '推論', '2.2.301', NOW()),
  ('estate_info', 'land_area', '土地面積（㎡）', '推論', '2.2.301', NOW()),
  ('estate_info', 'private_road_area', '私道負担面積（㎡）', '推論', '2.2.301', NOW()),
  ('estate_info', 'building_area', '建物面積（㎡）', '推論', '2.2.301', NOW()),
  ('estate_info', 'building_structure', '建物の構造', '推論', '2.2.301', NOW()),
  ('estate_info', 'national_land_law', '国土法の届出', '推論', '2.2.301', NOW()),
  ('estate_info', 'city_planning', '都市計画（市街化区域 など）', '推論', '2.2.301', NOW()),
  ('estate_info', 'land_category', '地目', '推論', '2.2.301', NOW()),
  ('estate_info', 'topography', '地勢', '推論', '2.2.301', NOW()),
  ('estate_info', 'bcr1', '建ぺい率1（%）', '推論', '2.2.301', NOW()),
  ('estate_info', 'far1', '容積率1（%）', '推論', '2.2.301', NOW()),
  ('estate_info', 'bcr2', '建ぺい率2（%）', '推論', '2.2.301', NOW()),
  ('estate_info', 'far2', '容積率2（%）', '推論', '2.2.301', NOW()),
  ('estate_info', 'corner_flag', '角地か（0 / 1）', '推論', '2.2.301', NOW()),
  ('estate_info', 'road_condition1', '接道の状況1', '推論', '2.2.301', NOW()),
  ('estate_info', 'road_condition2', '接道の状況2', '推論', '2.2.301', NOW()),
  ('estate_info', 'road_condition3', '接道の状況3', '推論', '2.2.301', NOW()),
  ('estate_info', 'best_use', '最適用途', '推論', '2.2.301', NOW()),
  ('estate_info', 'legal_restrictions', '法令上の制限', '推論', '2.2.301', NOW()),
  ('estate_info', 'movie_url1', '動画の URL 1', '推論', '2.2.301', NOW()),
  ('estate_info', 'movie_url2', '動画の URL 2', '推論', '2.2.301', NOW()),
  ('estate_info', 'no_brokerage_fee_flag', '仲介手数料なしか（0 / 1）', '推論', '2.2.301', NOW()),
  ('estate_info', 'admin_memo', '管理者のメモ', '推論', '2.2.301', NOW()),
  ('estate_info', 'reins_no_image_flag', 'レインズの画像なし（0 / 1）', '推論', '2.2.301', NOW()),
  ('estate_info', 'reins_image_import_flag', 'レインズの画像を取り込んだか（0 / 1）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- event_calendar：イベントカレンダー
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('event_calendar', 'イベントカレンダー', 'order', '集客イベント（見学会・フェアなど）の予定。1イベント＝1行。店舗ごとのイベントと、全社のイベント（shop = ''khg''）がある。
登録・変更は画面「イベントカレンダー」（calendar/Calendar.tsx。① handlers/calendar.php・calendar_add.php・calendar_change.php）。v2.2.299 からはフォーム作成（EventFormBuilder.tsx・② eventForm/admin.ts）でも全社のイベントを1行足す。
読むのはイベントカレンダー、フォーム作成（shop = ''khg'' AND flag = 1）、顧客DB・架電状況（全社のイベントの一覧）、集客イベントの集計（eventSummary.ts・eventBudget.ts。title で予算・反響と突き合わせる）。
⚠️ 削除は行を消さず flag = 0 にする。一覧は flag = 1 だけ読む。
⚠️ 実績の人数は reserved_calendar に入る。この表の new・reserved・registered・next は使っていない（新しい行は 0）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'event_calendar' AND column_name NOT IN ('id', 'startDate', 'endDate', 'category', 'title', 'shop', 'flag', 'new', 'reserved', 'registered', 'next', 'note', 'url');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('event_calendar', 'id', '連番（reserved_calendar.event_id・event_form.calendar_id から指す）', '改修', '2.2.301', NOW()),
  ('event_calendar', 'startDate', '開始日', '改修', '2.2.301', NOW()),
  ('event_calendar', 'endDate', '終了日', '改修', '2.2.301', NOW()),
  ('event_calendar', 'category', '（推定）イベントの種類（event・event_even・openhouse・medium）。⚠️ 今の画面は空で登録する', '推論', '2.2.301', NOW()),
  ('event_calendar', 'title', 'イベント名（例「住まいるフェスティバル2026_出水阿久根」）。集客イベントの集計は予算の note・反響の名前とこの値の完全一致で結ぶ', '改修', '2.2.301', NOW()),
  ('event_calendar', 'shop', '店舗名（KH霧島店 など）。全社のイベントは khg。係（鹿児島1係 など）の行もある', '改修', '2.2.301', NOW()),
  ('event_calendar', 'flag', '1 = 表示、0 = 削除済み', '改修', '2.2.301', NOW()),
  ('event_calendar', 'new', '（推定）旧版の実績「有効新規数」。今は reserved_calendar に入るので使っていない', '推論', '2.2.301', NOW()),
  ('event_calendar', 'reserved', '（推定）旧版の実績「新規来場者」。今は使っていない', '推論', '2.2.301', NOW()),
  ('event_calendar', 'registered', '（推定）旧版の実績「管理客」。今は使っていない', '推論', '2.2.301', NOW()),
  ('event_calendar', 'next', '（推定）旧版の実績「次アポ数」。今は使っていない', '推論', '2.2.301', NOW()),
  ('event_calendar', 'note', 'メモ', '改修', '2.2.301', NOW()),
  ('event_calendar', 'url', 'イベントのページの URL。フォーム作成で作ったときは、空ならフォームの URL を入れる', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- event_db：集客イベントの来場予約
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('event_db', '集客イベントの来場予約', 'order', '集客イベントの来場予約（反響）。1予約＝1行。イベントは title で分ける（住まいるフェスティバル・おうちづくりフェスタ2026・フォーム作成のイベントなど）。
書くのは公開の予約フォーム：フェスタの LP（② features/event/reservation.ts。id = festa2026_＋16文字をブラウザが採番）、フォーム作成のフォーム（eventForm/public.ts。id = ef<フォーム番号>_＋16桁）。
読む・直すのは「集客イベント」の反響一覧（EventList.tsx・FestaDashboard.tsx。request list の event。② list/event.ts）、受付の QR 読み取り（event/checkin.ts）、集客イベントの集計（eventSummary.ts）。
⚠️ 氏名・連絡先以外は来場者本人が入力した原本。社内で直せるのは name・phone・mail・kana・check_in_time・check_out_time・remarks・staff・sync だけ（list/event.ts の ALLOWED_COLUMNS）。
⚠️ id は UNIQUE（uk_event_db_id）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'event_db' AND column_name NOT IN ('no', 'id', 'time', 'date', 'name', 'kana', 'zip', 'address', 'street', 'phone', 'age', 'adult', 'child', 'house', 'interview', 'request', 'medium', 'area', 'site', 'question', 'agree', 'reserved_at', 'status', 'check_in_time', 'check_out_time', 'remarks', 'staff', 'festa', 'shop', 'title', 'sync', 'mail');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('event_db', 'no', 'ユニークNo（連番）', '改修', '2.2.301', NOW()),
  ('event_db', 'id', '予約ID（festa2026_… / ef<番号>_… / 古いイベントは接頭辞なしの16文字）。受付の QR に入る', '改修', '2.2.301', NOW()),
  ('event_db', 'time', '来場希望時間', '改修', '2.2.301', NOW()),
  ('event_db', 'date', '来場希望日', '改修', '2.2.301', NOW()),
  ('event_db', 'name', 'お名前', '改修', '2.2.301', NOW()),
  ('event_db', 'kana', 'ふりがな（2026-09-07 追加。古い予約は NULL）', '改修', '2.2.301', NOW()),
  ('event_db', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('event_db', 'address', '住所（都道府県・市区・町村）', '改修', '2.2.301', NOW()),
  ('event_db', 'street', '住所（番地・建物名）', '改修', '2.2.301', NOW()),
  ('event_db', 'phone', '携帯電話', '改修', '2.2.301', NOW()),
  ('event_db', 'age', '年代（26～30歳代 などの選択肢）', '改修', '2.2.301', NOW()),
  ('event_db', 'adult', '来場人数（大人）', '改修', '2.2.301', NOW()),
  ('event_db', 'child', '来場人数（子ども）', '改修', '2.2.301', NOW()),
  ('event_db', 'house', '現在のお住まい', '改修', '2.2.301', NOW()),
  ('event_db', 'interview', '相談内容（カンマ区切り）', '改修', '2.2.301', NOW()),
  ('event_db', 'request', 'マイホームのご検討。⚠️ interview と同じくカンマ区切りで複数保存する', '改修', '2.2.301', NOW()),
  ('event_db', 'medium', 'ご予約のきっかけ', '改修', '2.2.301', NOW()),
  ('event_db', 'area', '建築希望エリア', '改修', '2.2.301', NOW()),
  ('event_db', 'site', '建築予定地（v2.2.298 フォームから）', '改修', '2.2.301', NOW()),
  ('event_db', 'question', '事前にお聞きしたいこと', '改修', '2.2.301', NOW()),
  ('event_db', 'agree', '個人情報の取り扱いへの同意。1=同意。⚠️ NULL は同意欄が無かった頃の予約', '改修', '2.2.301', NOW()),
  ('event_db', 'reserved_at', '予約を受け付けた日時。⚠️ 公開フォーム経由の反響を時系列で追うために使う', '改修', '2.2.301', NOW()),
  ('event_db', 'status', 'ステータス。non-reserve＝当日来場（予約なし。来場済みとして保存）。それ以外は空・NULL', '改修', '2.2.301', NOW()),
  ('event_db', 'check_in_time', 'チェックイン時間（YYYY/MM/DD HH:MM:SS の文字列）。受付の QR 読み取りで入る。反響一覧の「来場状況」はこれで決まる', '改修', '2.2.301', NOW()),
  ('event_db', 'check_out_time', 'チェックアウト時間', '改修', '2.2.301', NOW()),
  ('event_db', 'remarks', '※備考欄（社内メモ）', '改修', '2.2.301', NOW()),
  ('event_db', 'staff', '担当スタッフ（反響一覧で入力。v2.2.171）', '改修', '2.2.301', NOW()),
  ('event_db', 'festa', 'おうちづくりフェスタ2026 の営業入力（JSON。キーごとに JSON_SET で書く）', '改修', '2.2.301', NOW()),
  ('event_db', 'shop', '店舗名。⚠️ フェスタでは顧客に同期した店舗をカンマ区切りで足していく（sync_shop）。他のイベントでは「イベントの店舗」', '改修', '2.2.301', NOW()),
  ('event_db', 'title', 'イベント名（フォーム作成のイベントは「開始日_イベント名」）', '改修', '2.2.301', NOW()),
  ('event_db', 'sync', '同期。1 = 顧客に取り込み済み（行の色・反響一覧の「同期済み」）', '改修', '2.2.301', NOW()),
  ('event_db', 'mail', 'メールアドレス', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- event_form：イベントの予約フォーム
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('event_form', 'イベントの予約フォーム', 'order', '「集客イベント → フォーム作成」で作ったイベントの予約フォーム（v2.2.298）。1フォーム＝1行。id がそのまま公開 URL の番号（https://khg-marketing.info/form/<id>/）。
登録・更新は EventFormBuilder.tsx（request event_form の list・save。② features/eventForm/admin.ts）。
公開フォームは request event_form_public（表示）・event_form_entry（申し込み。event_db に id = ef<番号>_… で1行入れ、メールを2通送る。eventForm/public.ts）。
⚠️ 申し込みのイベント名と通知先は必ずこの表から取る（送られてきた値は使わない）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'event_form' AND column_name NOT IN ('id', 'title', 'calendar_id', 'mail_to', 'mail_cc', 'fields', 'active', 'created_by', 'created_at', 'updated_by', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('event_form', 'id', 'フォームの番号（公開 URL の番号）', '改修', '2.2.301', NOW()),
  ('event_form', 'title', 'event_db.title に入れるイベント名（「開始日_イベント名」例 2026-12-06_○○フェア）。⚠️ 作ったときの写しなので、あとでカレンダー側を直してもここは変わらない', '改修', '2.2.301', NOW()),
  ('event_form', 'calendar_id', 'event_calendar.id（v2.2.299）。⚠️ v2.2.298 で作ったフォームは NULL', '改修', '2.2.301', NOW()),
  ('event_form', 'mail_to', '反響の通知先（カンマ区切り）。⚠️ 公開フォームには返さない', '改修', '2.2.301', NOW()),
  ('event_form', 'mail_cc', '反響の通知の Cc（カンマ区切り）', '改修', '2.2.301', NOW()),
  ('event_form', 'fields', '入力欄ごとの「表示・必須」（JSON の文字列。eventForm/fields.ts）。⚠️ 氏名・携帯電話・メールアドレスは常に表示・必須（② が決める）', '改修', '2.2.301', NOW()),
  ('event_form', 'active', '1 = 受付中、0 = 受付を止めた', '改修', '2.2.301', NOW()),
  ('event_form', 'created_by', '作ったスタッフ', '改修', '2.2.301', NOW()),
  ('event_form', 'created_at', '作った日時', '改修', '2.2.301', NOW()),
  ('event_form', 'updated_by', '最後に保存したスタッフ', '改修', '2.2.301', NOW()),
  ('event_form', 'updated_at', '最後に保存した日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- family_info：顧客の家族情報
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('family_info', '顧客の家族情報', 'common', '顧客の家族（ご主人・奥様・お子様など）。1行＝1顧客（id は master_data・master_data_kaeru などの id）。家族の中身は family_info 列に JSON 配列で持つ。
書くのは ② familyInfo.ts（request: family_info。家族情報モーダル FamilyInfo.tsx）と資金計画書の保存（fundingPlan/familyInfoWriteBack.ts が奥様・お子様の名前などを差分だけ書き戻す）。読むのは家族情報モーダル、顧客DB（家族の名前で検索）、ギフトの判定、架電一覧、資金計画書の初期値。
⚠️ テーブル名と列名が同じ（family_info.family_info）。読み違えに注意。
⚠️ ① に family_info.php を作らない（familyInfo.ts の冒頭）。
⚠️ id が空の行が実在する。空の id で検索すると他人の家族が返るので、空では引かない。
⚠️ 家族の JSON は ② も ① と同じく文字列のまま返す（pool.ts の jsonStrings）。画面は JSON.parse して使う。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'family_info' AND column_name NOT IN ('no', 'id', 'shop', 'name', 'family_info');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('family_info', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('family_info', 'id', '顧客ID', '改修', '2.2.301', NOW()),
  ('family_info', 'shop', '顧客の担当店舗（保存したときの値）', '改修', '2.2.301', NOW()),
  ('family_info', 'name', '顧客名（保存したときの値）', '改修', '2.2.301', NOW()),
  ('family_info', 'family_info', '家族の JSON 配列。1人分は relation（続柄）・name・kana・birth・mail・mobile・employmentType・employer・employmentYears の9項目', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- form_cv：キャンペーンフォームの送信記録
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('form_cv', 'キャンペーンフォームの送信記録', 'common', 'キャンペーンフォームが送信された1回＝1行（コンバージョンの記録）。
書くのは公開フォームの送信の処理（② features/campaignForm/entry.ts・estimate/entry.ts、① handlers/campaign_form.php・estimate_entry.php）。失敗しても反響の保存は止めない。
⚠️ このリポジトリで読む処理は無い（推定：外部の集計用）。お客様の情報は持たない。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'form_cv' AND column_name NOT IN ('no', 'brand', 'time', 'campaignName', 'campaignId', 'url', 'source');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('form_cv', 'no', '連番', '改修', '2.2.301', NOW()),
  ('form_cv', 'brand', '送られてきたブランド（kh・djh・pg・jh・2l・khg・なごみ など。⚠️ 公開フォームが送る値のままで、form_table.brand と違うことがある）', '改修', '2.2.301', NOW()),
  ('form_cv', 'time', '送信日時（文字列）', '改修', '2.2.301', NOW()),
  ('form_cv', 'campaignName', 'キャンペーン名', '改修', '2.2.301', NOW()),
  ('form_cv', 'campaignId', 'キャンペーンID（form_table.campaign_id）', '改修', '2.2.301', NOW()),
  ('form_cv', 'url', 'フォームのあったページの URL', '改修', '2.2.301', NOW()),
  ('form_cv', 'source', '流入元（meta・google・flyer・ig・yahoo など。空も多い）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- form_database：キャンペーンフォームのブランド既定値
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('form_database', 'キャンペーンフォームのブランド既定値', 'common', 'キャンペーンフォームのブランドごとの既定値。1ブランド＝1行（nagomi・kh・djh・2l・fh・pg・jh・khg）。
画面「キャンペーン」で新しいフォームを作るとき、この行の値をひな型にする（request campaign_form の master。② features/campaignForm/index.ts）。
項目の列の形は form_table と同じ（JSON の文字列）。
⚠️ メール文面（thanks_subject など）の列は無い。新規は常に空＝既定の文面。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'form_database' AND column_name NOT IN ('id', 'brand', 'mail_to', 'mail_cc', 'thanks', 'redirect', 'notice', 'shop', 'date', 'name', 'kana', 'age', 'phone', 'mail', 'line_id', 'address', 'medium', 'question', 'attention', 'color_code', 'img_code');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('form_database', 'id', '連番', '改修', '2.2.301', NOW()),
  ('form_database', 'brand', 'ブランドキー（form_table.brand と同じ）', '改修', '2.2.301', NOW()),
  ('form_database', 'mail_to', '社内通知メールの宛先の既定', '改修', '2.2.301', NOW()),
  ('form_database', 'mail_cc', '社内通知メールの Cc の既定', '改修', '2.2.301', NOW()),
  ('form_database', 'thanks', 'サンクスメールを送るかの既定（1＝送る）', '改修', '2.2.301', NOW()),
  ('form_database', 'redirect', '送信後の完了ページの既定', '改修', '2.2.301', NOW()),
  ('form_database', 'notice', 'フォーム画面の「注意書き」の既定（JSON）', '改修', '2.2.301', NOW()),
  ('form_database', 'shop', '項目「店舗」の設定と選択肢の既定（JSON）', '改修', '2.2.301', NOW()),
  ('form_database', 'date', '項目「来場希望日・時間」の既定（JSON）', '改修', '2.2.301', NOW()),
  ('form_database', 'name', '項目「お名前」の既定（JSON）', '改修', '2.2.301', NOW()),
  ('form_database', 'kana', '項目「ふりがな」の既定（JSON）', '改修', '2.2.301', NOW()),
  ('form_database', 'age', '項目「年代」の既定（JSON）', '改修', '2.2.301', NOW()),
  ('form_database', 'phone', '項目「電話番号」の既定（JSON）', '改修', '2.2.301', NOW()),
  ('form_database', 'mail', '項目「メールアドレス」の既定（JSON）', '改修', '2.2.301', NOW()),
  ('form_database', 'line_id', '項目「LINE ID」の既定（JSON。2026-10-12 追加）', '改修', '2.2.301', NOW()),
  ('form_database', 'address', '項目「住所」の既定（JSON）', '改修', '2.2.301', NOW()),
  ('form_database', 'medium', '項目「お問い合わせのきっかけ」の既定（JSON）', '改修', '2.2.301', NOW()),
  ('form_database', 'question', '項目「ご要望・ご質問」の既定（JSON）', '改修', '2.2.301', NOW()),
  ('form_database', 'attention', '注意事項の既定（JSON）', '改修', '2.2.301', NOW()),
  ('form_database', 'color_code', '（推定）フォームの色（例 #956134）。⚠️ 今はどのブランドも同じ値', '推論', '2.2.301', NOW()),
  ('form_database', 'img_code', '（推定）フォームに出すロゴ画像の URL。⚠️ form_table に列が無いので新規フォームには引き継がれない', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- form_list：旧キャンペーンフォームの一覧
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('form_list', '旧キャンペーンフォームの一覧', 'common', '（推定）form_table より前のキャンペーンフォームの登録の一覧。1フォーム＝1行。登録日は 2024-11 〜 2025-09 で止まっている。
コードからの使用箇所なし（推定：旧版のフォーム管理の表。form_table に移った）。
⚠️ コードの「form_list」は ① の旧 API の Authorization の名前（一覧の処理）で、この表ではない。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'form_list' AND column_name NOT IN ('id', 'campaign_name', 'campaign_id', 'day', 'url', 'brand', 'campaign_to', 'campaign_cc', 'thanks', 'redirect', 'sns', 'flyer', 'landing');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('form_list', 'id', '連番', '推論', '2.2.301', NOW()),
  ('form_list', 'campaign_name', 'キャンペーン名', '推論', '2.2.301', NOW()),
  ('form_list', 'campaign_id', 'キャンペーンID', '推論', '2.2.301', NOW()),
  ('form_list', 'day', '登録日（YYYY-MM-DD の文字列）', '推論', '2.2.301', NOW()),
  ('form_list', 'url', 'フォームを置くページの URL', '推論', '2.2.301', NOW()),
  ('form_list', 'brand', 'ブランドキー（kh・djh・nagomi・2l・fh・jh・pgh）', '推論', '2.2.301', NOW()),
  ('form_list', 'campaign_to', '（推定）社内通知メールの宛先', '推論', '2.2.301', NOW()),
  ('form_list', 'campaign_cc', '（推定）社内通知メールの Cc', '推論', '2.2.301', NOW()),
  ('form_list', 'thanks', '（推定）サンクスメールを送るか（1＝送る）', '推論', '2.2.301', NOW()),
  ('form_list', 'redirect', '（推定）送信後の完了ページの URL', '推論', '2.2.301', NOW()),
  ('form_list', 'sns', '（推定）SNS 用のバナー画像のパス（./banner/…）', '推論', '2.2.301', NOW()),
  ('form_list', 'flyer', '（推定）チラシ画像のパス（./flyer/…）', '推論', '2.2.301', NOW()),
  ('form_list', 'landing', '（推定）イベントの LP の URL', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- form_show：キャンペーンフォームの表示記録
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('form_show', 'キャンペーンフォームの表示記録', 'common', '公開のキャンペーンフォームが表示された1回＝1行。数十万行ある。
書くのはフォームの初期表示（form_get。② features/campaignForm/entry.ts の runCampaignFormPublic、① handlers/campaign_form.php）。失敗してもフォームは出す。
⚠️ このリポジトリで読む処理は無い（推定：form_cv と合わせて表示→送信の率を見る外部の集計用）。
⚠️ brand・campaign には外から送られた値がそのまま入るので、脆弱性スキャンの文字列（SQL インジェクションの試しなど）の行が混じっている。集計するときは form_table の brand で絞る。
⚠️ time の形が古い行（YYYY-MM-DD）と新しい行（YYYY/MM/DD）で違う。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'form_show' AND column_name NOT IN ('no', 'time', 'brand', 'campaign', 'url', 'source', 'campaign_name');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('form_show', 'no', '連番', '改修', '2.2.301', NOW()),
  ('form_show', 'time', '表示日時（文字列）', '改修', '2.2.301', NOW()),
  ('form_show', 'brand', '送られてきたブランド（kh・djh・pg・nagomi・jh・2l・khg など）', '改修', '2.2.301', NOW()),
  ('form_show', 'campaign', 'キャンペーンID（form_table.campaign_id）', '改修', '2.2.301', NOW()),
  ('form_show', 'url', 'フォームのあったページの URL', '改修', '2.2.301', NOW()),
  ('form_show', 'source', '流入元', '改修', '2.2.301', NOW()),
  ('form_show', 'campaign_name', 'キャンペーン名', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- form_table：キャンペーンフォームの設定
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('form_table', 'キャンペーンフォームの設定', 'common', 'キャンペーンフォーム（イベント予約・資料請求などの公開フォーム）の設定。1フォーム＝1行（brand＋campaign_id で引く）。
登録・更新は画面「キャンペーン」（NewCampaign.tsx・FormBuilder.tsx。request campaign_form の list / detail / insert / update。② features/campaignForm/index.ts）。
公開フォームの表示（form_get）と送信（form_register）は ① の khg-marketing.info/api/ と ② campaignForm/entry.ts が brand＋campaign_id でこの表を読み、通知先・サンクスメールの可否・文面もここから決める（送られてきた値は使わない）。
⚠️ brand はローマ字（nagomi など）。公開フォームが送る brand（かな・khg など）とは違うので、brands.ts で読み替える。
⚠️ 項目の列（notice〜medium・line_id）は JSON の文字列（CHECK json_valid 付き）。{bool: 聞くか, required: 必須か, …} の形。空文字を入れると保存ごと失敗する。
⚠️ 公開済みのフォームが ① の API を直接呼んでいるので、行を消したり brand・campaign_id を変えたりすると反響が止まる。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'form_table' AND column_name NOT IN ('id', 'registered_date', 'campaign', 'campaign_id', 'url', 'tag', 'brand', 'mail_to', 'mail_cc', 'redirect', 'thanks', 'notice', 'name', 'kana', 'age', 'phone', 'mail', 'line_id', 'address', 'question', 'attention', 'shop', 'date', 'medium', 'thanks_subject', 'thanks_body', 'internal_subject', 'internal_body');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('form_table', 'id', '連番', '改修', '2.2.301', NOW()),
  ('form_table', 'registered_date', '登録日（YYYY/MM/DD の文字列）', '改修', '2.2.301', NOW()),
  ('form_table', 'campaign', 'キャンペーン名（フォームの見出し・反響のキャンペーン名）', '改修', '2.2.301', NOW()),
  ('form_table', 'campaign_id', 'キャンペーンID（brand と組で1フォームを決める）', '改修', '2.2.301', NOW()),
  ('form_table', 'url', 'フォームを置くページの URL', '改修', '2.2.301', NOW()),
  ('form_table', 'tag', '埋め込み用のタグ（iframe）。⚠️ フォーム作成画面が作る HTML 版とは別物', '改修', '2.2.301', NOW()),
  ('form_table', 'brand', 'ブランドキー（kh・djh・nagomi・2l・fh・pg・jh・khg）', '改修', '2.2.301', NOW()),
  ('form_table', 'mail_to', '社内通知メールの宛先', '改修', '2.2.301', NOW()),
  ('form_table', 'mail_cc', '社内通知メールの Cc（khg の共通フォームは店舗別の Cc で上書き。entry.ts の KHG_CC）', '改修', '2.2.301', NOW()),
  ('form_table', 'redirect', '送信後に移る完了ページの URL', '改修', '2.2.301', NOW()),
  ('form_table', 'thanks', 'お客様へのサンクスメールを送るか（1＝送る）', '改修', '2.2.301', NOW()),
  ('form_table', 'notice', 'フォーム画面の「注意書き」（JSON）。⚠️ 社内通知メールではない', '改修', '2.2.301', NOW()),
  ('form_table', 'name', '項目「お名前」の設定（JSON。姓・名をまとめる）', '改修', '2.2.301', NOW()),
  ('form_table', 'kana', '項目「ふりがな」の設定（JSON。せい・めいをまとめる）', '改修', '2.2.301', NOW()),
  ('form_table', 'age', '項目「年代」の設定（JSON）', '改修', '2.2.301', NOW()),
  ('form_table', 'phone', '項目「電話番号」の設定（JSON）', '改修', '2.2.301', NOW()),
  ('form_table', 'mail', '項目「メールアドレス」の設定（JSON）', '改修', '2.2.301', NOW()),
  ('form_table', 'line_id', '項目「LINE ID」の設定（JSON。2026-10-12 追加）。送られてこなければ今の値のまま', '改修', '2.2.301', NOW()),
  ('form_table', 'address', '項目「住所」の設定（JSON。郵便番号〜番地をまとめる）', '改修', '2.2.301', NOW()),
  ('form_table', 'question', '項目「ご要望・ご質問」の設定（JSON）', '改修', '2.2.301', NOW()),
  ('form_table', 'attention', 'フォームの注意事項（JSON。text_red などに改行区切りの文言）', '改修', '2.2.301', NOW()),
  ('form_table', 'shop', '項目「店舗」の設定と選択肢（JSON）', '改修', '2.2.301', NOW()),
  ('form_table', 'date', '項目「来場希望日・時間」の設定と選択肢（JSON）', '改修', '2.2.301', NOW()),
  ('form_table', 'medium', '項目「お問い合わせのきっかけ」の設定と選択肢（JSON。YouTube を足したのは 2026-10-05）', '改修', '2.2.301', NOW()),
  ('form_table', 'thanks_subject', 'サンクスメールの件名。空なら既定（mailTemplate.ts）', '改修', '2.2.301', NOW()),
  ('form_table', 'thanks_body', 'サンクスメールの本文。空なら既定', '改修', '2.2.301', NOW()),
  ('form_table', 'internal_subject', '社内通知メールの件名。空なら既定', '改修', '2.2.301', NOW()),
  ('form_table', 'internal_body', '社内通知メールの本文。空なら既定', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- form_table_bk_20261105_attention：キャンペーンフォームの注意事項の控え（2026-11-05）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('form_table_bk_20261105_attention', 'キャンペーンフォームの注意事項の控え（2026-11-05）', 'common', 'form_table（元の表）の brand = ''kh'' の attention を、佐賀店の特典の注記を消す前に控えた写し（2026-11-05。backend/scripts/sql/2026-11-05_form_table_kh_remove_saga_note.sql）。
戻すときは id で form_table と結んで attention を書き戻す（SQL ファイルの末尾）。
⚠️ 画面・処理からは使っていない（推定）。戻す必要が無くなったら消してよい。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'form_table_bk_20261105_attention' AND column_name NOT IN ('id', 'brand', 'attention');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('form_table_bk_20261105_attention', 'id', '連番', '改修', '2.2.301', NOW()),
  ('form_table_bk_20261105_attention', 'brand', 'ブランドキー（kh・djh・nagomi・2l・fh・pg・jh・khg）', '改修', '2.2.301', NOW()),
  ('form_table_bk_20261105_attention', 'attention', 'フォームの注意事項（JSON。text_red などに改行区切りの文言）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- funding_plan：AIデジタル資金計画書
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('funding_plan', 'AIデジタル資金計画書', 'order', '注文住宅の資金計画書（frontend/public/funding-plan/index.html）の保存先。1行＝1顧客の計画書（id は master_data.id と同じで1対1）。
列名は計画書の入力欄の data-k と同じ。頭の文字で欄が分かれる（k_ カルテ、d_ 資金計画、s_ 諸費用・ローン、g_ 住宅ローン控除、v_ 太陽光・蓄電池、t_ 比較・土地探し、f_ ライフプラン（FP）、x_ 支出算出シート、bk_ 金融機関の比較、w_ 段取り表、ln_ 金利データ）。
書くのは ② features/fundingPlan（保存のたびに変更を master_data_log に積み、奥様・お子様の名前などを family_info へ差分だけ書き戻す）。未作成の顧客を開いたときは master_data と family_info から初期値を組み立てて返す（mapping.ts）。
⚠️ 金額は小数（decimal）で、単位は欄による（万円・円・％）。⚠️ 配列の欄（kids・s1〜s5・loans・lands・w_* など）は JSON の文字列。
⚠️ loans はその時点の金利の写し。共通の金利マスタに置き換えない（過去の計画書の数字が動く）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'funding_plan' AND column_name NOT IN ('id', 'k_name', 'k_kana', 'k_date', 'k_shop', 'k_staff', 'k_addr', 'k_tel', 'k_mail', 'k_now', 'k_h_name', 'k_h_birth', 'k_h_age', 'k_h_work', 'k_w_name', 'k_w_birth', 'k_w_age', 'k_w_work', 'k_inc1', 'k_inc2', 'k_jiko', 'k_enjo', 'k_chochiku', 'k_rent', 'k_park', 'k_elec', 'k_gas', 'k_l1', 'k_l2', 'k_l3', 'k_lb', 'k_trigger_etc', 'k_timing', 'k_area', 'k_style', 'k_tsubo', 'k_yuka', 'k_hope', 'k_landhave', 'k_makers', 'k_landwish', 'k_worry', 'k_youbou', 'k_memo', 'd_tatemono', 'd_futai', 'd_solarKw', 'd_shohi', 'd_tochi', 'd_yobi', 'd_bonus', 'd_years', 'd_rate', 'd_danshin', 'd_kounetsuRate', 's_kenchikuchi', 's_landM2', 's_f1', 's_f2', 's_sekou', 's_m_kari', 's_m_bonus', 's_m_years', 's_m_rate', 's_m_bank', 's_p_kari', 's_p_bonus', 's_p_years', 's_p_rate', 's_p_bank', 's_bikou', 'g_type', 'g_setai', 'g_mode', 'g_income', 'g_fuyou', 'g_shotoku', 'g_juumin', 'v_panelW', 'v_houi', 'v_koubai', 'v_keisu', 'v_baiden', 'v_kaiden', 'v_jika', 'v_tax', 'v_cost', 'v_years', 'v_batUse', 'v_batKwh', 'v_batCost', 'v_batHojo', 'v_batEff', 'v_batNight', 't_wait', 't_upRate', 't_futureRate', 't_yRate', 't_y1', 't_y2', 't_kidAge', 't_addPay', 'f_up', 'f_tedori', 'f_teinen', 'f_saikoyo', 'f_taishoku', 'f_nenkin', 'f_seikatsu', 'f_kotei', 'f_shuzen', 'f_hoken', 'f_carCycle', 'f_carCost', 'f_other', 'x_auto', 'x_shokuhi', 'x_suido', 'x_water', 'x_tel', 'x_net', 'x_iryo', 'x_leisure', 'x_shinbun', 'x_ifuku', 'x_nhk', 'x_e1n', 'x_e1', 'x_e2n', 'x_e2', 'x_e3n', 'x_e3', 'x_choSou', 'x_choTsuki', 'x_choBonus', 'x_incH', 'x_incW', 'x_incE', 'x_h1', 'x_h2', 'x_h3', 'x_h4', 'x_h5', 'x_h6', 'x_h7', 'x_h8', 'x_h9n', 'x_h9', 'x_h10n', 'x_h10', 'x_w1', 'x_w2', 'x_w3', 'x_w4', 'x_w5', 'x_w6', 'x_w7', 'x_w8', 'x_w9n', 'x_w9', 'x_w10n', 'x_w10', 'x_c1', 'x_c2n', 'x_c2', 'w_start', 'ln_asof', 'ln_source', 'ln_feedUrl', 'bk_kari', 'bk_years', 'bk_incFee', 'bk_memo', 'bk_apply1', 'bk_apply2', 'bk_apply3', 'kids', 'k_trigger', 's1', 's2', 's3', 's4', 's5', 'loans', 'w_days', 'w_done', 'updated_by', 'created_at', 'updated_at', 't_pref', 't_city', 't_station', 't_budget', 't_needTsubo', 't_radius', 't_lat', 't_lng', 't_addr', 't_muni', 't_area', 't_dist', 'lands', 'w_dates');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('funding_plan', 'id', 'master_data.id と同じ値。1顧客につき1件（主キー）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_name', 'お客様名（様邸）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_kana', 'ふりがな', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_date', '作成日', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_shop', '担当店舗。⚠️ master_data.in_charge_store と同じ値（KH鹿児島店 等）をそのまま保存する。印刷時だけ顧客向け表記へ変換する（mapping.ts の SHOP_LABEL）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_staff', '担当者', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_addr', 'ご住所（現住所）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_tel', 'お電話番号', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_mail', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_now', '現在のお住まい / 選択肢: 賃貸アパート・マンション|賃貸戸建|ご実家|社宅・寮|持ち家', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_h_name', 'ご主人様 お名前', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_h_birth', 'ご主人様 生年月日', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_h_age', 'ご主人様 年齢（生年月日からの計算値を保存）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_h_work', 'ご主人様 お勤め先', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_w_name', '奥様 お名前', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_w_birth', '奥様 生年月日', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_w_age', '奥様 年齢（生年月日からの計算値を保存）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_w_work', '奥様 お勤め先', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_inc1', 'ご主人様 年収', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_inc2', '奥様 年収', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_jiko', 'ご自己資金（頭金）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_enjo', 'ご援助資金', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_chochiku', '現在の貯蓄額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_rent', '家賃', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_park', '駐車場', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_elec', '電気代', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_gas', 'ガス代', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_l1', 'その他お借入①（車等）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_l2', 'その他お借入②', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_l3', 'その他お借入③', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_lb', 'お借入ボーナス払い', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_trigger_etc', 'お家づくりを検討されるきっかけ', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_timing', '計画時期', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_area', '建築ご希望地', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_style', 'ご希望の建て方 / 選択肢: 未定|平屋建て|2階建て', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_tsubo', '土地の目安坪数', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_yuka', 'ご希望の延床面積', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_hope', 'ご希望の月々お支払額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_landhave', '土地の有無 / 選択肢: 未定|土地から探す|お持ちの土地に建てる|ご実家の敷地', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_makers', '気になる住宅メーカーさん', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_landwish', '土地選びでここだけは外せないという部分（例：お子さんの学校区・ご実家が近く・通勤時間…）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_worry', 'お家づくりで心配なこと・本日聞いておきたいこと（例：建築費、住宅ローン、土地探し、賃貸との違い）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_youbou', 'ご要望・こだわり（間取り／設備／デザイン等）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_memo', '次回アポイント・商談メモ', '改修', '2.2.301', NOW()),
  ('funding_plan', 'd_tatemono', '① 建物本体価格', '改修', '2.2.301', NOW()),
  ('funding_plan', 'd_futai', '② 付帯工事費', '改修', '2.2.301', NOW()),
  ('funding_plan', 'd_solarKw', '③ 太陽光', '改修', '2.2.301', NOW()),
  ('funding_plan', 'd_shohi', '④ 諸費用', '改修', '2.2.301', NOW()),
  ('funding_plan', 'd_tochi', '⑤ 土地購入費', '改修', '2.2.301', NOW()),
  ('funding_plan', 'd_yobi', '⑥ 予備費', '改修', '2.2.301', NOW()),
  ('funding_plan', 'd_bonus', 'ボーナス月加算額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'd_years', '返済期間', '改修', '2.2.301', NOW()),
  ('funding_plan', 'd_rate', '金利（年利）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'd_danshin', '団体信用生命保険による死亡保険の見直し', '改修', '2.2.301', NOW()),
  ('funding_plan', 'd_kounetsuRate', '国分ハウジングの光熱費', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_kenchikuchi', '建築地', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_landM2', '土地面積（㎡）', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_f1', '延床面積 1F（㎡）', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_f2', '延床面積 2F（㎡）', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_sekou', '施工面積 合計（㎡）', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_m_kari', '⑥住宅ローン 借入金額（メイン）', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_m_bonus', '⑥住宅ローン メインのうちボーナス充当額', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_m_years', '⑥住宅ローン メインの期間（年）', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_m_rate', '⑥住宅ローン メインの金利（％）', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_m_bank', '⑥住宅ローン メインの金融機関', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_p_kari', '⑥住宅ローン プラスワンの借入金額', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_p_bonus', '⑥住宅ローン プラスワンのうちボーナス充当額', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_p_years', '⑥住宅ローン プラスワンの期間（年）', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_p_rate', '⑥住宅ローン プラスワンの金利（％）', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_p_bank', '⑥住宅ローン プラスワンの金融機関', '改修', '2.2.301', NOW()),
  ('funding_plan', 's_bikou', '⑧ 備考', '改修', '2.2.301', NOW()),
  ('funding_plan', 'g_type', '住宅の性能区分 / 選択肢: 認定長期優良住宅・低炭素住宅|ZEH水準省エネ住宅|省エネ基準適合住宅|その他の住宅（省エネ基準未適合）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'g_setai', '世帯区分 / 選択肢: 子育て世帯・若者夫婦世帯|一般世帯', '改修', '2.2.301', NOW()),
  ('funding_plan', 'g_mode', '算定方法 / 選択肢: 年収から自動概算|手入力', '改修', '2.2.301', NOW()),
  ('funding_plan', 'g_income', '控除対象の年収（世帯主）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'g_fuyou', '扶養親族の人数', '改修', '2.2.301', NOW()),
  ('funding_plan', 'g_shotoku', '所得税額（年額）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'g_juumin', '住民税所得割額（年額）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_panelW', 'モジュール出力', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_houi', '設置条件（方位） / 選択肢: 南|南東|南西|東|西', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_koubai', '屋根勾配', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_keisu', '年間発電量係数', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_baiden', '売電単価（FIT）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_kaiden', '買電単価（電気料金＋基本料金）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_jika', '自家消費率', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_tax', '売電に消費税を上乗せする / 選択肢: 上乗せする（×1.1）|上乗せしない', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_cost', 'ソーラーパネル費用（税込）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_years', '住宅ローンに組込む年数', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_batUse', '導入する / 選択肢: 導入する|導入しない', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_batKwh', '蓄電池容量', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_batCost', '導入費用（税込）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_batHojo', '補助金', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_batEff', '実効利用率', '改修', '2.2.301', NOW()),
  ('funding_plan', 'v_batNight', '夜間電力単価', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_wait', '何年後と比較しますか', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_upRate', '建築費の上昇率（想定）', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_futureRate', '◯年後の想定金利', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_yRate', '金利', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_y1', '短い方の期間', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_y2', '長い方の期間', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_kidAge', 'お子様の現在のご年齢', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_addPay', '成人後に増額するお支払い', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_up', '昇給率', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_tedori', '手取り率', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_teinen', '定年年齢', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_saikoyo', '再雇用（65歳まで）の年収', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_taishoku', '退職金', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_nenkin', '65歳以降の年金（世帯計）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_seikatsu', '基本生活費', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_kotei', '固定資産税', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_shuzen', '火災保険・修繕積立', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_hoken', '生命保険等', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_carCycle', '自動車 買替周期', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_carCost', '自動車 買替金額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'f_other', 'その他のご支出', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_auto', '支出算出シート：1 = シートの合計を「基本生活費」「生命保険等」へ自動反映する', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_shokuhi', '支出算出シート（円・月額）：食費・日用雑貨', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_suido', '支出算出シート：水道', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_water', '支出算出シート：ウォーターサーバー等', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_tel', '支出算出シート：固定電話', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_net', '支出算出シート：インターネット等', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_iryo', '支出算出シート：医療費等', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_leisure', '支出算出シート：レジャー・旅行', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_shinbun', '支出算出シート：新聞・定期購読', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_ifuku', '支出算出シート：衣料品', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_nhk', '支出算出シート：NHK等', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_e1n', '支出算出シート：その他①の項目名', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_e1', '支出算出シート：その他①の金額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_e2n', '支出算出シート：その他②の項目名', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_e2', '支出算出シート：その他②の金額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_e3n', '支出算出シート：その他③の項目名', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_e3', '支出算出シート：その他③の金額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_choSou', '支出算出シート：現在の貯蓄総額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_choTsuki', '支出算出シート：月々の貯蓄額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_choBonus', '支出算出シート：ボーナスの貯蓄額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_incH', '支出算出シート：旦那様の収入', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_incW', '支出算出シート：奥様の収入', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_incE', '支出算出シート：その他の収入', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_h1', '支出算出シート：旦那様 お小遣い', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_h2', '支出算出シート：旦那様 携帯電話', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_h3', '支出算出シート：旦那様 趣味', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_h4', '支出算出シート：旦那様 美容代', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_h5', '支出算出シート：旦那様 生命保険', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_h6', '支出算出シート：旦那様 自動車税（年額）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_h7', '支出算出シート：旦那様 自動車保険', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_h8', '支出算出シート：旦那様 ガソリン代', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_h9n', '支出算出シート：旦那様 その他①の項目名', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_h9', '支出算出シート：旦那様 その他①の金額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_h10n', '支出算出シート：旦那様 その他②の項目名', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_h10', '支出算出シート：旦那様 その他②の金額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_w1', '支出算出シート：奥様 お小遣い', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_w2', '支出算出シート：奥様 携帯電話', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_w3', '支出算出シート：奥様 趣味', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_w4', '支出算出シート：奥様 美容室・化粧品', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_w5', '支出算出シート：奥様 生命保険', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_w6', '支出算出シート：奥様 自動車税（年額）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_w7', '支出算出シート：奥様 自動車保険', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_w8', '支出算出シート：奥様 ガソリン代', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_w9n', '支出算出シート：奥様 その他①の項目名', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_w9', '支出算出シート：奥様 その他①の金額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_w10n', '支出算出シート：奥様 その他②の項目名', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_w10', '支出算出シート：奥様 その他②の金額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_c1', '支出算出シート：お子様 塾・習い事など', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_c2n', '支出算出シート：お子様 その他の項目名', '改修', '2.2.301', NOW()),
  ('funding_plan', 'x_c2', '支出算出シート：お子様 その他の金額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'w_start', '起点日（初回ご来店日）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'ln_asof', '現在の金利データ 基準日', '改修', '2.2.301', NOW()),
  ('funding_plan', 'ln_source', '出典・メモ', '改修', '2.2.301', NOW()),
  ('funding_plan', 'ln_feedUrl', '金利データ配信URL（任意）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'bk_kari', 'お借入金額', '改修', '2.2.301', NOW()),
  ('funding_plan', 'bk_years', '返済期間', '改修', '2.2.301', NOW()),
  ('funding_plan', 'bk_incFee', '諸費用を比較に含める / 選択肢: 含める（事務手数料＋保証料）|金利のみで比較', '改修', '2.2.301', NOW()),
  ('funding_plan', 'bk_memo', 'ご提案する金融機関と理由', '改修', '2.2.301', NOW()),
  ('funding_plan', 'bk_apply1', '事前審査の提出先①', '改修', '2.2.301', NOW()),
  ('funding_plan', 'bk_apply2', '事前審査の提出先②', '改修', '2.2.301', NOW()),
  ('funding_plan', 'bk_apply3', '事前審査の提出先③', '改修', '2.2.301', NOW()),
  ('funding_plan', 'kids', 'お子様（name/age/plan の配列）。⑧FPの教育費計算に使う', '改修', '2.2.301', NOW()),
  ('funding_plan', 'k_trigger', 'お家づくりを検討されるきっかけ（チェックボックス。文字列の配列）', '改修', '2.2.301', NOW()),
  ('funding_plan', 's1', '諸費用の内訳① 土地関連（i:項目 a:金額 t:税 p:支払先 m:根拠 n:備考）', '改修', '2.2.301', NOW()),
  ('funding_plan', 's2', '諸費用の内訳② 建物関連', '改修', '2.2.301', NOW()),
  ('funding_plan', 's3', '諸費用の内訳③ 外構・地盤', '改修', '2.2.301', NOW()),
  ('funding_plan', 's4', '諸費用の内訳④ その他', '改修', '2.2.301', NOW()),
  ('funding_plan', 's5', '諸費用の内訳⑤ 金融機関', '改修', '2.2.301', NOW()),
  ('funding_plan', 'loans', '金融機関の金利一覧。⚠️ この計画書を作った時点のスナップショット。共通マスタを参照にすると、後から金利が変わって過去の計画書の数字が動いてしまう', '改修', '2.2.301', NOW()),
  ('funding_plan', 'w_days', '⑨段取りの各工程の所要日数（数値の配列）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'w_done', '⑨段取りの各工程の完了フラグ（真偽値の配列）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'updated_by', '最後に保存したスタッフ名', '改修', '2.2.301', NOW()),
  ('funding_plan', 'created_at', '最初に保存した日時', '改修', '2.2.301', NOW()),
  ('funding_plan', 'updated_at', '最後に保存した日時', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_pref', '検索する県（kagoshima 等の内部値）', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_city', '検索する市区町村', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_station', '最寄り駅（任意）', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_budget', '土地の予算（万円）', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_needTsubo', '必要な坪数', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_radius', '周辺施設を探す半径（m）', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_lat', '選んだ地点の緯度。⚠️ 文字列で持つ（未選択は空文字）', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_lng', '選んだ地点の経度。⚠️ 文字列で持つ（未選択は空文字）', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_addr', '選んだ地点の住所（国土地理院の逆ジオコーディング結果）', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_muni', '選んだ地点の市区町村コード由来の表記', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_area', '選んだ範囲の面積', '改修', '2.2.301', NOW()),
  ('funding_plan', 't_dist', '基準地点からの距離', '改修', '2.2.301', NOW()),
  ('funding_plan', 'lands', '候補地のメモ（n:名称 ad:住所 ts:坪数 tk:坪単価 pr:価格 yt:用途地域 bk:建蔽/容積 hz:災害情報 me:備考 の配列）', '改修', '2.2.301', NOW()),
  ('funding_plan', 'w_dates', '⑨段取り表 STEP2〜7の予定日。FLOWと同じ長さの配列。空文字なら日数から自動計算', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- google_review：Google クチコミ
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('google_review', 'Google クチコミ', 'common', '店舗ごとの Google クチコミの評価と本文。1店舗（Google マップの店舗）＝1行（約31行）。
取得は projects/sync（Places API）→ ② request google_review の save（features/googleReview.ts）。新しいクチコミだけを足し、評価が変わったときだけ推移に1点足す。
読むのは画面「口コミ集計」（header/review/GoogleReview.tsx。request google_review の summary）。sync は list で店舗と Place ID を取る。
⚠️ 行の追加は手作業（Place ID が分からないと取得できない）。save は INSERT しない。
⚠️ Places API は1回に最大5件しか返さないので、全件は持っていない（溜まった分だけ）。
⚠️ ① に PHP の処理は無い（転送に失敗したら 502）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'google_review' AND column_name NOT IN ('no', 'shop', 'id', 'address', 'average', 'amount', 'recently_review', 'review_history', 'url');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('google_review', 'no', '連番（画面・sync の並び順）', '改修', '2.2.301', NOW()),
  ('google_review', 'shop', 'Google 上の店舗名（例「国分ハウジング 霧島店」）。画面で shop_list の表記に読み替える（googleReviewUtils.ts）', '改修', '2.2.301', NOW()),
  ('google_review', 'id', 'Google の Place ID（save はこれで行を探す）', '改修', '2.2.301', NOW()),
  ('google_review', 'address', '店舗の住所', '改修', '2.2.301', NOW()),
  ('google_review', 'average', '平均評価（文字列）', '改修', '2.2.301', NOW()),
  ('google_review', 'amount', 'クチコミの件数（文字列）', '改修', '2.2.301', NOW()),
  ('google_review', 'recently_review', 'ためたクチコミ（JSON 配列 [{rating, date, text, name}]）。新しいものを後ろに足す。⚠️ 古い要素は name が無く、本文の改行が <br>', '改修', '2.2.301', NOW()),
  ('google_review', 'review_history', '評価の推移（JSON 配列 [{date, amount, average}]）。画面では使っていない', '改修', '2.2.301', NOW()),
  ('google_review', 'url', 'Google マップの店舗ページの URL', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- guide_article：業務ガイドの記事
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('guide_article', '業務ガイドの記事', 'common', '業務ガイド（v2.2.194〜。画面 frontend/src/components/guide/Guide.tsx、別ウインドウの /guide）の記事が1行1本。
② の features/guide.ts が読み書きする（guide_list・guide_article・guide_save。① に PHP は無い）。読むのはログインした全員、書くのは Master / BrandAdmin だけ。
エージェントは原稿 backend/scripts/guide/articles/ から build-guide-sql.cjs で SQL を作って入れる（CLAUDE.md「業務ガイドの記事」）。
⚠️ 記事は消さない（published = 0 で隠す）。⚠️ 保存のたびに直前の内容を guide_history に積む。
⚠️ タイトルを変えると [[ ]] のリンクが切れる。事業が違ってもタイトルは重複できない。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'guide_article' AND column_name NOT IN ('id', 'title', 'division', 'section', 'summary', 'body', 'sort', 'published', 'updated_by', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('guide_article', 'id', '連番（自動採番）。guide_history.article_id から参照される', '改修', '2.2.301', NOW()),
  ('guide_article', 'title', '記事のタイトル（例: 契約したら（注文営業））。⚠️ [[ ]] リンクの照合キー。一意', '改修', '2.2.301', NOW()),
  ('guide_article', 'division', '事業区分（order 注文営業 / spec 建売営業 / used 中古リノベ / common 共通）', '改修', '2.2.301', NOW()),
  ('guide_article', 'section', '分類（用語 / 画面の使い方 / 業務の流れ）', '改修', '2.2.301', NOW()),
  ('guide_article', 'summary', '一覧に出す1行の説明', '改修', '2.2.301', NOW()),
  ('guide_article', 'body', '本文（Markdown）。⚠️ 60,000 バイトまで（② で検査）', '改修', '2.2.301', NOW()),
  ('guide_article', 'sort', '分類の中の並び順（小さいほど上）', '改修', '2.2.301', NOW()),
  ('guide_article', 'published', '1 = 出す / 0 = 隠す', '改修', '2.2.301', NOW()),
  ('guide_article', 'updated_by', '最後に保存した人（staff.name）', '改修', '2.2.301', NOW()),
  ('guide_article', 'created_at', '作った日時', '改修', '2.2.301', NOW()),
  ('guide_article', 'updated_at', '最後に保存した日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- guide_history：業務ガイドの記事の履歴
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('guide_history', '業務ガイドの記事の履歴', 'common', '業務ガイドの記事（guide_article）を上書きする直前の内容が1行。② の features/guide.ts（guide_save）が更新と同じトランザクションで積む。build-guide-sql.cjs の SQL も上書きの前に積む。
⚠️ 上書きせず積み上げる。消さない。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'guide_history' AND column_name NOT IN ('no', 'article_id', 'title', 'section', 'summary', 'body', 'published', 'edited_by', 'edited_at', 'saved_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('guide_history', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('guide_history', 'article_id', 'どの記事の履歴か（guide_article.id）', '改修', '2.2.301', NOW()),
  ('guide_history', 'title', '上書き前のタイトル', '改修', '2.2.301', NOW()),
  ('guide_history', 'section', '上書き前の分類', '改修', '2.2.301', NOW()),
  ('guide_history', 'summary', '上書き前の1行の説明', '改修', '2.2.301', NOW()),
  ('guide_history', 'body', '上書き前の本文（Markdown）', '改修', '2.2.301', NOW()),
  ('guide_history', 'published', '上書き前の公開（1 = 出す / 0 = 隠す）', '改修', '2.2.301', NOW()),
  ('guide_history', 'edited_by', 'この内容を保存した人（＝上書きされる前の版を書いた人）', '改修', '2.2.301', NOW()),
  ('guide_history', 'edited_at', 'この内容が保存された日時（guide_article.updated_at の写し）', '改修', '2.2.301', NOW()),
  ('guide_history', 'saved_at', '履歴に積んだ日時（＝上書きされた日時）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- homes_db：HOME'S 反響の取り込み元（注文住宅）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('homes_db', 'HOME''S 反響の取り込み元（注文住宅）', 'order', 'LIFULL HOME''S（注文住宅。KH・DJH・JH・PG HOUSE）の反響の生データ。1行が1件の問合せ、または1件の来場予約。
sync の runHomesOrder.ts が「問合せメール一覧」と「来場予約一覧」の CSV を落とし、① の request homes_db_order（handlers/homes_db_order.php）へ500件ずつ送る。
同じ処理で反響一覧（inquiry_customer）に行を足す（portal/homes_order.php。媒体 HOME''S）。inquiry_id は問合せが `homes<番号>`、来場予約が `homes_reserve<番号>`。
⚠️ 鍵は id_homes だが UNIQUE キーは無い。PHP が既にある番号を SELECT してから入れる（core/bulk_upsert.php）。
⚠️ 来場予約の行は、問合せと同じ列に違う意味の値が入る（income_homes＝来場先、age_homes＝問合せ種別）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'homes_db' AND column_name NOT IN ('id', 'id_homes', 'name_homes', 'kana_homes', 'zip_homes', 'address_homes', 'mail_homes', 'phone_homes', 'period_homes', 'estate_homes', 'status_homes', 'budget_detail_homes', 'income_homes', 'age_homes', 'place_homes', 'shop_homes', 'date_homes');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('homes_db', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('homes_db', 'id_homes', '問合せ番号。来場予約は `reserve_` ＋来場予約問合せ番号（問合せと番号が重なるため）', '改修', '2.2.301', NOW()),
  ('homes_db', 'name_homes', '氏名（半角スペースで姓と名に分けて反響一覧に入れる）', '改修', '2.2.301', NOW()),
  ('homes_db', 'kana_homes', 'シメイ（カナ）。来場予約には無い', '改修', '2.2.301', NOW()),
  ('homes_db', 'zip_homes', '郵便番号', '改修', '2.2.301', NOW()),
  ('homes_db', 'address_homes', '住所', '改修', '2.2.301', NOW()),
  ('homes_db', 'mail_homes', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('homes_db', 'phone_homes', '電話番号', '改修', '2.2.301', NOW()),
  ('homes_db', 'period_homes', '建設予定時期。来場予約には無い', '改修', '2.2.301', NOW()),
  ('homes_db', 'estate_homes', '土地所有の有無', '改修', '2.2.301', NOW()),
  ('homes_db', 'status_homes', '現在の検討状況', '改修', '2.2.301', NOW()),
  ('homes_db', 'budget_detail_homes', '建築予算', '改修', '2.2.301', NOW()),
  ('homes_db', 'income_homes', '世帯年収。⚠️ 来場予約の行では「来場先」', '改修', '2.2.301', NOW()),
  ('homes_db', 'age_homes', '年齢。⚠️ 来場予約の行では「問合せ種別」', '改修', '2.2.301', NOW()),
  ('homes_db', 'place_homes', '建築予定地（市区町村）。店舗判定の第1優先。反響一覧の area に入る', '改修', '2.2.301', NOW()),
  ('homes_db', 'shop_homes', '取り込んだアカウントのブランド（KH / DJH / JH / PG HOUSE）。店舗名ではない', '改修', '2.2.301', NOW()),
  ('homes_db', 'date_homes', '問合せ日時（反響一覧の inquiry_date は空白の前の日付だけ）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- homes_db_kaeru：HOME'S 反響の取り込み元（建売）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('homes_db_kaeru', 'HOME''S 反響の取り込み元（建売）', 'spec', 'LIFULL HOME''S（建売。かえるホーム）の問合せメールの内容。1行が1人の問合せ（userId＝問合せ番号）。
GAS（backend/scripts/gas/runHomesKaeru.gs。問合せメールと新築一戸建て見学予約メール）と sync の runHomesKaeru.ts（IMAP）が、1件ずつ ① の request homes_db_kaeru（handlers/homes_db_kaeru.php）へ送る。
userId が既にあれば UPDATE、無ければ INSERT。そのあと portal/homes_kaeru.php が、表全体を反響一覧（inquiry_customer_kaeru。`homes_<userId>`・媒体 HOME''S・ブランド かえる）へ INSERT IGNORE する。
⚠️ 見学予約メールにしか無い項目（フリガナ・見学希望日・連絡時間帯）は remarks にだけ入る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'homes_db_kaeru' AND column_name NOT IN ('no', 'userUrl', 'registered', 'propertyUrl', 'category', 'propertyName', 'price', 'area', 'railway', 'large', 'plan', 'propertyId', 'companyId', 'userId', 'name', 'mail', 'mobile', 'note', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('homes_db_kaeru', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'userUrl', 'ユーザー詳細URL（HOME''S の管理画面）', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'registered', 'システム受付日時（メールの受信日時。YYYY-MM-DD HH:MM:SS）。反響一覧の反響日になる', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'propertyUrl', '物件詳細URL（反響一覧の url に入る）', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'category', '物件種別（例 売買 一戸建て・新築一戸建て見学予約）', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'propertyName', '物件名（反響一覧の property に入る）', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'price', '価格', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'area', '所在地（物件。反響一覧の area に入る）', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'railway', '交通', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'large', '面積', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'plan', '間取', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'propertyId', '物件番号（HOME''S の番号）', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'companyId', '自社管理番号', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'userId', '問合せ番号。上書きの鍵', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'name', '名前', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'mail', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'mobile', '電話番号', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'note', 'お問合せ内容（反響一覧の remarks に入る）', '改修', '2.2.301', NOW()),
  ('homes_db_kaeru', 'remarks', 'メールの全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- homes_db_resale：HOME'S 反響の取り込み元（中古）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('homes_db_resale', 'HOME''S 反響の取り込み元（中古）', 'used', 'LIFULL HOME''S（中古住宅専門店）の問合せメールの内容。1行が1人の問合せ（userId＝問合せ番号）。形は homes_db_kaeru と同じ。
sync の runHomesResale.ts（メール）が1件ずつ ① の request homes_db_resale（handlers/homes_db_resale.php）へ送り、userId が既にあれば UPDATE、無ければ INSERT する。
そのあと portal/homes_resale.php が、その userId の最新の1行を反響一覧（inquiry_customer_resale。`homes_<userId>`・区分「買い:ポータル」）と
不動産CRMの買いリード（brokerage_listings。extId `homes:<userId>`）へ足す（どちらも INSERT だけ。上書きしない）。
② の realty/ieloveMatch.ts が、買いリードをいえらぶの台帳に結ぶのに companyId を読む。
⚠️ 以前は存在確認が homes_db_kaeru を見ていたため、同じ userId の行が積み上がっていた（今は直してある。下流は userId ごとに最新の1行だけを使う）。
⚠️ 照合順序が brokerage_listings（utf8mb4_unicode_ci）と違う。比べるときは COLLATE を付ける。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'homes_db_resale' AND column_name NOT IN ('no', 'registered', 'userUrl', 'propertyUrl', 'category', 'propertyName', 'price', 'area', 'railway', 'large', 'plan', 'propertyId', 'companyId', 'userId', 'name', 'mail', 'mobile', 'note', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('homes_db_resale', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'registered', 'システム受付日時（メールの受信日時。YYYY-MM-DD HH:MM:SS）。反響一覧の反響日・買いリードの受付日になる', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'userUrl', 'ユーザー詳細URL（HOME''S の管理画面）', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'propertyUrl', '物件詳細URL（反響一覧の url に入る）', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'category', '物件種別（例 売買 一戸建て。買いリードでは 戸建／マンション／土地 に直す）', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'propertyName', '物件名', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'price', '価格（例 1,500万円。買いリードの budget に直す）', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'area', '所在地（物件）', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'railway', '交通', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'large', '面積', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'plan', '間取', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'propertyId', '物件番号（HOME''S の番号）', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'companyId', '自社管理番号（いえらぶの6桁の物件番号）。ieloveMatch.ts が台帳に結ぶのに使う', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'userId', '問合せ番号。上書きの鍵', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'name', '名前', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'mail', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'mobile', '電話番号', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'note', 'お問合せ内容', '改修', '2.2.301', NOW()),
  ('homes_db_resale', 'remarks', 'メールの全項目を「見出し：値」で改行区切りにした文', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- homes_summary_db：HOME'S 掲載物件のサマリー
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('homes_summary_db', 'HOME''S 掲載物件のサマリー', 'common', 'LIFULL HOME''S に掲載している自社物件の一覧（掲載状況・閲覧数・問合せ数）。1行が1物件（company_management_number）。
sync の summary の処理（runHomesSummary.ts）が ① の request homes_summary_db（handlers/homes_summary_db.php）へ送り、company_management_number で上書き（ON DUPLICATE KEY UPDATE）する。
同じ行を ② の property_db_portal（features/propertyPortal.ts）にも送り、物件DB（property_db）の空の列を埋める（docs/property-db-portal.md）。
画面は物件DB（DatabaseProperty.tsx）・物件のサマリー（PropertySummary.tsx）。② の property_list / property_detail が company_management_number ＝ property_db.property_id で結ぶ。
⚠️ アカウントの列が無い。建売と中古の物件が1つの表に混ざる。⚠️ 列はすべて文字列。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'homes_summary_db' AND column_name NOT IN ('no', 'property_id', 'company_management_number', 'property_name', 'room_section', 'address', 'railway_line', 'station', 'walk_minutes', 'bus_minutes', 'price_rent', 'common_service_fee', 'layout', 'exclusive_area', 'property_type', 'construction_year', 'created_date', 'updated_date', 'status', 'floor_plan_image', 'exterior_image', 'lifull_homes_published', 'special_ad_impressions', 'special_ad_clicks', 'detail_page_views', 'inquiries_count', 'inquiry_rate');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('homes_summary_db', 'no', '連番', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'property_id', '物件ID（HOME''S の番号。いえらぶの番号とは関係しない）', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'company_management_number', '自社管理番号（いえらぶの6桁の物件番号）。上書きの鍵・物件DB と結ぶ鍵', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'property_name', '物件名', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'room_section', '部屋／区画', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'address', '物件所在地', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'railway_line', '路線', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'station', '駅', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'walk_minutes', '徒歩分', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'bus_minutes', 'バス乗車分', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'price_rent', '価格/賃料（例 900万）', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'common_service_fee', '共益費', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'layout', '間取り', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'exclusive_area', '専有面積', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'property_type', '物件種別（例 一戸建て・マンション・土地）', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'construction_year', '築年（例「48年」。築年数で、建築年月ではない）', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'created_date', '物件作成日', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'updated_date', '情報更新日', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'status', '状態', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'floor_plan_image', '間取図', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'exterior_image', '外観図', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'lifull_homes_published', 'LIFULL HOME''S掲載', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'special_ad_impressions', '特別広告表示回数', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'special_ad_clicks', '特別広告クリック数', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'detail_page_views', '物件詳細閲覧数', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'inquiries_count', '物件問合せ数', '改修', '2.2.301', NOW()),
  ('homes_summary_db', 'inquiry_rate', '物件問合せ率', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- hotlead_db：HOTLEAD のチケット（注文住宅）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('hotlead_db', 'HOTLEAD のチケット（注文住宅）', 'order', 'HOTLEAD（反響の一次対応・来場予約の代行サービス）のチケット。1行が1件のチケット（id）。列は HOTLEAD から届く項目名そのまま。
sync の runHotlead.ts が HOTLEAD から取った行を1件ずつ ① の request hotlead（handlers/hotlead.php）へ送り、id があれば UPDATE、無ければ INSERT する。
同じ処理で、顧客DB（master_data）の同じ人（店舗・氏名・電話・メールが一致し、hotlead_id が空）に hotlead_id を入れる。店舗名の頭は送り元のアカウント（hotlead → KH／hotlead_2 → DJH。hotlead_brand。この表には保存しない）。
画面は顧客DB（注文。DatabaseOrder.tsx）。② の database（features/database/queries.ts）が id・status・hotlead_url・ticket_stop_reason_type と、行動履歴の架電・メール・SMS の回数だけを返す。
⚠️ 列はすべて text。日時は ISO 形式（例 2026-01-01T09:16:08+09:00）。
⚠️ 下の列のうち [推論] は、HOTLEAD の項目名から推した説明（コードでは読んでいない）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'hotlead_db' AND column_name NOT IN ('no', 'id', 'status', 'ticket_stop_reason_type', 'ticket_stop_reason', 'ticket_at', 'updated_at', 'hotlead_url', 'store_id', 'store_name', 'unit_id', 'unit_name', 'client_user_name', 'appointment_status', 'appointment_start_at', 'appointment_start_at2', 'appointment_place_type', 'appointment_place', 'appointment_adult_count', 'appointment_adult_count_note', 'appointment_child_count', 'appointment_child_count_note', 'appointment_transportation', 'appointment_guidance_types', 'appointment_guidance', 'appointment_cancel_reason_type', 'appointment_cancel_reason', 'name', 'name_kana', 'age', 'gender', 'phone', 'phone_note', 'email', 'zip_code', 'address', 'desired_contact_method', 'inquiry_detail', 'appointment_desired_date1_note', 'appointment_desired_date2_note', 'family_adult_count', 'family_child_count', 'family_pet_count', 'family_pet_count_note', 'holidays', 'interests', 'employment_status', 'employment_company_name', 'years_of_service', 'salary', 'fund', 'cashing', 'cashing_note', 'has_scheduled_loan', 'property_find_duration', 'property_find_duration_note', 'done_loan_simulate', 'done_loan_simulate_note', 'social_style', 'social_style_note', 'interest_other_property_or_company', 'visited_property_experience', 'inquiry_competitor_status', 'residence_type', 'monthly_house_payment', 'housing_loan_balance', 'car_name', 'car_count', 'monthly_parking_fee', 'current_floor_plan', 'demand_house_floors_count', 'demand_property_types', 'demand_higher_price', 'demand_higher_price_note', 'demand_parking_capacity', 'demand_other_condition', 'demand_area', 'demand_train_station', 'demand_walking_time', 'demand_walking_time_note', 'demand_time_to_relocate', 'demand_time_to_relocate_note', 'purchasing_reason', 'inquiry_reasons', 'demand_building_site', 'has_building_site', 'has_building_site_note', 'demand_time_to_build', 'visited_exhibition_experience', 'relation_with_property', 'demand_selling_price', 'demand_selling_price_note', 'selling_property_type', 'selling_address', 'selling_address_kana', 'selling_land_area', 'selling_building_area', 'selling_occupied_area', 'selling_built_at', 'selling_resident', 'selling_property_purchased_price', 'selling_remodeling_history', 'selling_purchased_time', 'selling_floor_plan', 'selling_management_fee', 'selling_repair_reserve_fund', 'selling_property_right', 'property_name1', 'property_URL1', 'property_type1', 'property_address1', 'property_price1', 'property_building_area1', 'property_land_area1', 'property_floor_plan1', 'property_code1', 'lead_at1', 'property_name2', 'property_URL2', 'property_type2', 'property_address2', 'property_price2', 'property_building_area2', 'property_land_area2', 'property_floor_plan2', 'property_code2', 'lead_at2', 'property_name3', 'property_URL3', 'property_type3', 'property_address3', 'property_price3', 'property_building_area3', 'property_land_area3', 'property_floor_plan3', 'property_code3', 'lead_at3', 'request_material_file_name1', 'request_material_file_name2', 'request_material_file_name3', 'media_name1', 'media_name2', 'media_name3', 'action_history');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('hotlead_db', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('hotlead_db', 'id', 'HOTLEAD のチケットID。上書きの鍵。顧客DB の hotlead_id に入る', '改修', '2.2.301', NOW()),
  ('hotlead_db', 'status', 'チケットのステータス（顧客DB の画面に出る）', '改修', '2.2.301', NOW()),
  ('hotlead_db', 'ticket_stop_reason_type', 'チケット停止理由の区分（顧客DB の画面に出る）', '改修', '2.2.301', NOW()),
  ('hotlead_db', 'ticket_stop_reason', 'チケット停止理由（自由記述）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'ticket_at', 'チケットの発生日時', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'updated_at', 'HOTLEAD 側の更新日時', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'hotlead_url', 'HOTLEAD の管理画面でのチケットの URL（顧客DB の画面から開く）', '改修', '2.2.301', NOW()),
  ('hotlead_db', 'store_id', 'HOTLEAD 上の店舗ID', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'store_name', 'HOTLEAD 上の店舗名（例 霧島店。ブランドは付かない）。顧客DB との突き合わせに使う', '改修', '2.2.301', NOW()),
  ('hotlead_db', 'unit_id', 'HOTLEAD 上のユニット（部署）ID', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'unit_name', 'HOTLEAD 上のユニット（部署）名', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'client_user_name', '担当者名（自社側）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_status', 'アポイントのステータス', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_start_at', 'アポイントの日時', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_start_at2', 'アポイントの日時（第2）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_place_type', 'アポイントの場所の種類', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_place', 'アポイントの場所', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_adult_count', '来場予定の大人の人数', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_adult_count_note', '来場予定の大人の人数（補足）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_child_count', '来場予定の子どもの人数', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_child_count_note', '来場予定の子どもの人数（補足）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_transportation', '来場の交通手段', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_guidance_types', '案内の種類', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_guidance', '案内の内容', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_cancel_reason_type', 'アポイントのキャンセル理由の区分', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_cancel_reason', 'アポイントのキャンセル理由', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'name', '氏名。顧客DB との突き合わせに使う', '改修', '2.2.301', NOW()),
  ('hotlead_db', 'name_kana', '氏名カナ', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'age', '年齢', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'gender', '性別', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'phone', '電話番号。顧客DB との突き合わせに使う', '改修', '2.2.301', NOW()),
  ('hotlead_db', 'phone_note', '電話の補足', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'email', 'メールアドレス。顧客DB との突き合わせに使う', '改修', '2.2.301', NOW()),
  ('hotlead_db', 'zip_code', '郵便番号', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'address', '住所', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'desired_contact_method', '希望の連絡方法', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'inquiry_detail', '問い合わせ内容', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_desired_date1_note', '来場希望日 第1（補足）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'appointment_desired_date2_note', '来場希望日 第2（補足）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'family_adult_count', '家族の大人の人数', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'family_child_count', '家族の子どもの人数', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'family_pet_count', 'ペットの数', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'family_pet_count_note', 'ペットの補足', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'holidays', '休日', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'interests', '興味・関心', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'employment_status', '勤務形態', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'employment_company_name', '勤務先', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'years_of_service', '勤続年数', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'salary', '年収', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'fund', '自己資金', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'cashing', '（推定）借入・キャッシングの有無', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'cashing_note', '（推定）借入の補足', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'has_scheduled_loan', '予定しているローンの有無', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_find_duration', '物件を探している期間', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_find_duration_note', '物件を探している期間（補足）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'done_loan_simulate', 'ローンの試算をしたか', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'done_loan_simulate_note', 'ローンの試算（補足）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'social_style', 'ソーシャルスタイル（人柄の分類）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'social_style_note', 'ソーシャルスタイル（補足）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'interest_other_property_or_company', 'ほかの物件・会社への関心', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'visited_property_experience', '物件見学の経験', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'inquiry_competitor_status', '他社への問い合わせ状況', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'residence_type', '今の住まいの形態', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'monthly_house_payment', '今の住居費（月）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'housing_loan_balance', '住宅ローンの残高', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'car_name', '車種', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'car_count', '車の台数', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'monthly_parking_fee', '駐車場代（月）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'current_floor_plan', '今の住まいの間取り', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_house_floors_count', '希望の階数', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_property_types', '希望の物件種別', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_higher_price', '予算の上限', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_higher_price_note', '予算の上限（補足）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_parking_capacity', '希望の駐車台数', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_other_condition', 'その他の希望条件', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_area', '希望エリア', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_train_station', '希望の駅', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_walking_time', '駅からの徒歩の希望', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_walking_time_note', '駅からの徒歩の希望（補足）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_time_to_relocate', '住み替えの希望時期', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_time_to_relocate_note', '住み替えの希望時期（補足）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'purchasing_reason', '購入の理由', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'inquiry_reasons', '問い合わせの理由', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_building_site', '建築地の希望', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'has_building_site', '建築地（土地）の有無', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'has_building_site_note', '建築地の有無（補足）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_time_to_build', '建築の希望時期', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'visited_exhibition_experience', '住宅展示場の来場経験', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'relation_with_property', '物件との関係（売却）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_selling_price', '売却の希望価格', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'demand_selling_price_note', '売却の希望価格（補足）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_property_type', '売却物件の種別', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_address', '売却物件の住所', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_address_kana', '売却物件の住所（カナ）', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_land_area', '売却物件の土地面積', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_building_area', '売却物件の建物面積', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_occupied_area', '売却物件の専有面積', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_built_at', '売却物件の建築年', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_resident', '売却物件の居住状況', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_property_purchased_price', '売却物件の購入価格', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_remodeling_history', '売却物件のリフォーム歴', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_purchased_time', '売却物件の購入時期', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_floor_plan', '売却物件の間取り', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_management_fee', '売却物件の管理費', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_repair_reserve_fund', '売却物件の修繕積立金', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'selling_property_right', '売却物件の権利', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_name1', '反響した物件1の物件名', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_URL1', '反響した物件1の URL', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_type1', '反響した物件1の種別', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_address1', '反響した物件1の住所', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_price1', '反響した物件1の価格', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_building_area1', '反響した物件1の建物面積', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_land_area1', '反響した物件1の土地面積', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_floor_plan1', '反響した物件1の間取り', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_code1', '反響した物件1の物件コード', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'lead_at1', '反響した物件1の反響日時', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_name2', '反響した物件2の物件名', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_URL2', '反響した物件2の URL', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_type2', '反響した物件2の種別', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_address2', '反響した物件2の住所', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_price2', '反響した物件2の価格', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_building_area2', '反響した物件2の建物面積', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_land_area2', '反響した物件2の土地面積', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_floor_plan2', '反響した物件2の間取り', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_code2', '反響した物件2の物件コード', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'lead_at2', '反響した物件2の反響日時', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_name3', '反響した物件3の物件名', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_URL3', '反響した物件3の URL', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_type3', '反響した物件3の種別', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_address3', '反響した物件3の住所', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_price3', '反響した物件3の価格', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_building_area3', '反響した物件3の建物面積', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_land_area3', '反響した物件3の土地面積', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_floor_plan3', '反響した物件3の間取り', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'property_code3', '反響した物件3の物件コード', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'lead_at3', '反響した物件3の反響日時', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'request_material_file_name1', '資料請求の資料名1', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'request_material_file_name2', '資料請求の資料名2', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'request_material_file_name3', '資料請求の資料名3', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'media_name1', '反響元の媒体名1', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'media_name2', '反響元の媒体名2', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'media_name3', '反響元の媒体名3', '推論', '2.2.301', NOW()),
  ('hotlead_db', 'action_history', '行動履歴（架電・メール・SMS などの記録の文）。顧客DB の画面は「架電」「メール」「SMS」の回数だけを使う', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- house_maker：住宅会社（他社）の名簿
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('house_maker', '住宅会社（他社）の名簿', 'common', '競合の住宅会社の名前の一覧（約380社）。顧客情報の「競合他社」の入力や他社資料の社名のサジェストに使う。
読むのは顧客情報（information の order・spec・used。SELECT *）、競合の集計（competitor.ts・analysis/competitor.ts）、他社資料（competitorPdf.ts）。書き込む処理は無い（手で足す）。
⚠️ 自社グループの社名（国分ハウジングなど）も入っている。競合の集計では外して別の欄に出す（analysis/competitor.ts の OWN_GROUP_NAMES）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'house_maker' AND column_name NOT IN ('no', 'label', 'letter');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('house_maker', 'no', '連番', '改修', '2.2.301', NOW()),
  ('house_maker', 'label', '社名（表示名）', '改修', '2.2.301', NOW()),
  ('house_maker', 'letter', '検索用の読み（ひらがな・カタカナ・ローマ字をつなげた文字列）。サジェストの並び順にも使う', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- households：市区町村別の世帯数
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('households', '市区町村別の世帯数', 'common', '国勢調査の一般世帯数（全国の市区町村）。1行＝1地域（pref・area の組で一意）。市況分析（Market）のエリア詳細で使う。
取り込みは backend-express/scripts/import-households-csv.mjs（households_all.csv）。読むのは ① market_area.php、建売の取り込み（import-kaeru-csv.mjs）が市区町村名の照合に使う。
2026-08-27 に全国版へ作り直した（backend-express/scripts/sql/2026-08-27_households.sql。前の表は households_backup_20260827）。
⚠️ 市区町村名の書き方が表ごとに違う（政令市の区など。① core/market.php の冒頭）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'households' AND column_name NOT IN ('no', 'pref', 'area', 'year', 'amount', 'one_person', 'more_two_people', 'live_together');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('households', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('households', 'pref', '都道府県名', '改修', '2.2.301', NOW()),
  ('households', 'area', '市区町村名。県全域は "-"', '改修', '2.2.301', NOW()),
  ('households', 'year', '調査年。元データに無いため空', '改修', '2.2.301', NOW()),
  ('households', 'amount', '一般世帯総数', '改修', '2.2.301', NOW()),
  ('households', 'one_person', '単独世帯', '改修', '2.2.301', NOW()),
  ('households', 'more_two_people', '2人以上の世帯', '改修', '2.2.301', NOW()),
  ('households', 'live_together', '間借り・同居など', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- households_backup_20260827：世帯数の退避（2026-08-27）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('households_backup_20260827', '世帯数の退避（2026-08-27）', 'common', 'households（市区町村別の世帯数）を全国版に作り直す前の写し（2026-08-27）。5県分で、同じ地域が新旧2世代入っていた（year が空のまま積まれていた）。
作ったのは backend-express/scripts/sql/2026-08-27_households.sql（RENAME で退避）。
⚠️ 画面・処理からは使っていない（推定）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'households_backup_20260827' AND column_name NOT IN ('no', 'pref', 'area', 'year', 'amount', 'one_person', 'more_two_people', 'live_together');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('households_backup_20260827', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('households_backup_20260827', 'pref', '都道府県名', '改修', '2.2.301', NOW()),
  ('households_backup_20260827', 'area', '市区町村名。⚠️ 古い世代は県全域の行が「-」ではなく県名', '改修', '2.2.301', NOW()),
  ('households_backup_20260827', 'year', '調査年。元データに無いため空', '改修', '2.2.301', NOW()),
  ('households_backup_20260827', 'amount', '一般世帯総数', '改修', '2.2.301', NOW()),
  ('households_backup_20260827', 'one_person', '単独世帯', '改修', '2.2.301', NOW()),
  ('households_backup_20260827', 'more_two_people', '2人以上の世帯', '改修', '2.2.301', NOW()),
  ('households_backup_20260827', 'live_together', '間借り・同居など', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- households_c：世帯数の内訳（建て方・家族類型）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('households_c', '世帯数の内訳（建て方・家族類型）', 'common', '国勢調査の一般世帯数を、住宅の建て方と家族類型で分けたもの（全国の市区町村）。1行＝1地域×1建て方（pref・area・type の組で一意）。市況分析（Market）の世帯構成のグラフで使う。
取り込みは backend-express/scripts/import-households-c-csv.mjs（households_c_all.csv）。読むのは ① market_area.php。
2026-08-27 に全国版へ作り直した（backend-express/scripts/sql/2026-08-27_households_c.sql。前の表は households_c_backup_20260827）。
⚠️ 同じ地域・建て方が二重に入るとグラフが倍になる。UNIQUE キーで止めている。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'households_c' AND column_name NOT IN ('no', 'pref', 'area', 'type', 'amount', 'one_person_under65', 'one_person_under30', 'one_person_30_64', 'one_person_over65', 'wife_husband', 'wife_husband_over65', 'wife_husband_child_under3', 'wife_husband_child_3_5', 'wife_husband_child_6_9', 'wife_husband_child_10_17', 'wife_husband_child_18_24', 'wife_husband_child_over25');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('households_c', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('households_c', 'pref', '都道府県名', '改修', '2.2.301', NOW()),
  ('households_c', 'area', '市区町村名。県全域は households と同じく "-"', '改修', '2.2.301', NOW()),
  ('households_c', 'type', '住宅の建て方（総数/一戸建/長屋建/共同住宅/その他）', '改修', '2.2.301', NOW()),
  ('households_c', 'amount', '一般世帯数', '改修', '2.2.301', NOW()),
  ('households_c', 'one_person_under65', '（推定）65歳未満の単身（30歳未満＋30〜64歳の合計）。⚠️ 画面のグラフでは使わない（足すと二重に数える）', '推論', '2.2.301', NOW()),
  ('households_c', 'one_person_under30', '30歳未満 単身', '改修', '2.2.301', NOW()),
  ('households_c', 'one_person_30_64', '30〜64歳 単身', '改修', '2.2.301', NOW()),
  ('households_c', 'one_person_over65', '65歳以上 単身', '改修', '2.2.301', NOW()),
  ('households_c', 'wife_husband', '夫婦のみ', '改修', '2.2.301', NOW()),
  ('households_c', 'wife_husband_over65', '夫婦のみ（65歳以上）', '改修', '2.2.301', NOW()),
  ('households_c', 'wife_husband_child_under3', '夫婦＋子（0〜2歳）', '改修', '2.2.301', NOW()),
  ('households_c', 'wife_husband_child_3_5', '夫婦＋子（3〜5歳）', '改修', '2.2.301', NOW()),
  ('households_c', 'wife_husband_child_6_9', '夫婦＋子（6〜9歳）', '改修', '2.2.301', NOW()),
  ('households_c', 'wife_husband_child_10_17', '夫婦＋子（10〜17歳）', '改修', '2.2.301', NOW()),
  ('households_c', 'wife_husband_child_18_24', '夫婦＋子（18〜24歳）', '改修', '2.2.301', NOW()),
  ('households_c', 'wife_husband_child_over25', '夫婦＋子（25歳以上）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- households_c_backup_20260827：世帯数内訳の退避（2026-08-27）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('households_c_backup_20260827', '世帯数内訳の退避（2026-08-27）', 'common', 'households_c（世帯数の内訳）を全国版に作り直す前の写し（2026-08-27）。5県分。
作ったのは backend-express/scripts/sql/2026-08-27_households_c.sql（RENAME で退避）。
⚠️ 画面・処理からは使っていない（推定）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'households_c_backup_20260827' AND column_name NOT IN ('no', 'pref', 'area', 'type', 'delete_key', 'amount', 'one_person_under65', 'one_person_under30', 'one_person_30_64', 'one_person_over65', 'wife_husband', 'wife_husband_over65', 'wife_husband_child_under3', 'wife_husband_child_3_5', 'wife_husband_child_6_9', 'wife_husband_child_10_17', 'wife_husband_child_18_24', 'wife_husband_child_over25');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('households_c_backup_20260827', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'pref', '都道府県名', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'area', '市区町村名。県全域は households と同じく "-"', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'type', '住宅の建て方（総数/一戸建/長屋建/共同住宅/その他）', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'delete_key', '全行 ''00_総数'' で意味を持っていなかった列（作り直しで落とした）', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'amount', '一般世帯数', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'one_person_under65', '（推定）65歳未満の単身（30歳未満＋30〜64歳の合計）。⚠️ 画面のグラフでは使わない（足すと二重に数える）', '推論', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'one_person_under30', '30歳未満 単身', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'one_person_30_64', '30〜64歳 単身', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'one_person_over65', '65歳以上 単身', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'wife_husband', '夫婦のみ', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'wife_husband_over65', '夫婦のみ（65歳以上）', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'wife_husband_child_under3', '夫婦＋子（0〜2歳）', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'wife_husband_child_3_5', '夫婦＋子（3〜5歳）', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'wife_husband_child_6_9', '夫婦＋子（6〜9歳）', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'wife_husband_child_10_17', '夫婦＋子（10〜17歳）', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'wife_husband_child_18_24', '夫婦＋子（18〜24歳）', '改修', '2.2.301', NOW()),
  ('households_c_backup_20260827', 'wife_husband_child_over25', '夫婦＋子（25歳以上）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- iei_db：イエイ 査定依頼の取り込み元
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('iei_db', 'イエイ 査定依頼の取り込み元', 'used', 'イエイ（売却査定サイト。中古住宅専門店）の査定依頼メールの内容。1行が1人（メールアドレスで見分ける）。
sync の runIei.ts（Gmail を IMAP で読む）が、1件ずつ ① の request iei_resale_update（handlers/iei_resale_update.php）へ送る。同じメールアドレスの行があれば UPDATE、無ければ INSERT。
そのあと portal/iei_resale.php が、その行を反響一覧（inquiry_customer_resale。`iei_<id>`・区分「売り:ポータル」）と
不動産CRMの売却リード（brokerage_listings。extId `iei:<受付日>:<氏名>`。以前の `anken:` の行とも氏名＋受付日で重複を見る）へ足す（どちらも INSERT だけ）。
⚠️ メール本文から取り出すので、空の項目に次の見出しが混ざる列がある（rent・requests はほぼ全行）。下流では混ざらない列だけを使う。
⚠️ イエイの案件番号は取り出していない。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'iei_db' AND column_name NOT IN ('no', 'id', 'assessment_method', 'assessment_type', 'property_type', 'property_address', 'building_area', 'land_area', 'floor_plan', 'built_year', 'current_status', 'rent', 'ownership', 'reason', 'sale_timing', 'contact_date', 'contact_time', 'hopes', 'requests', 'name', 'name_kana', 'age', 'address', 'tel1', 'tel2', 'email', 'registered_at', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('iei_db', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('iei_db', 'id', '行の ID（`iei_`＋uniqid。PHP が作る）。反響一覧の inquiry_id は `iei_` ＋この値', '改修', '2.2.301', NOW()),
  ('iei_db', 'assessment_method', '査定方法', '改修', '2.2.301', NOW()),
  ('iei_db', 'assessment_type', '査定種別', '改修', '2.2.301', NOW()),
  ('iei_db', 'property_type', '物件種別（反響一覧の property に入る。売却リードでは 戸建／マンション／土地 に直す）', '改修', '2.2.301', NOW()),
  ('iei_db', 'property_address', '物件所在地（反響一覧の area・売却リードの所在地に入る）', '改修', '2.2.301', NOW()),
  ('iei_db', 'building_area', '建物（専有）面積', '改修', '2.2.301', NOW()),
  ('iei_db', 'land_area', '土地面積', '改修', '2.2.301', NOW()),
  ('iei_db', 'floor_plan', '間取り', '改修', '2.2.301', NOW()),
  ('iei_db', 'built_year', '築年', '改修', '2.2.301', NOW()),
  ('iei_db', 'current_status', '現況', '改修', '2.2.301', NOW()),
  ('iei_db', 'rent', '賃料。⚠️ 次の見出しが混ざる', '改修', '2.2.301', NOW()),
  ('iei_db', 'ownership', 'ご名義', '改修', '2.2.301', NOW()),
  ('iei_db', 'reason', 'ご依頼理由（売却リードの reason に入る）', '改修', '2.2.301', NOW()),
  ('iei_db', 'sale_timing', '売却時期（売却リードの timing に入る）', '改修', '2.2.301', NOW()),
  ('iei_db', 'contact_date', '連絡希望日', '改修', '2.2.301', NOW()),
  ('iei_db', 'contact_time', '希望連絡時間', '改修', '2.2.301', NOW()),
  ('iei_db', 'hopes', '希望など', '改修', '2.2.301', NOW()),
  ('iei_db', 'requests', 'ご要望など。⚠️ 次の見出しが混ざる', '改修', '2.2.301', NOW()),
  ('iei_db', 'name', '姓名', '改修', '2.2.301', NOW()),
  ('iei_db', 'name_kana', '姓名（カナ）', '改修', '2.2.301', NOW()),
  ('iei_db', 'age', '年齢', '改修', '2.2.301', NOW()),
  ('iei_db', 'address', '住所（お客様。反響一覧の building に入る）', '改修', '2.2.301', NOW()),
  ('iei_db', 'tel1', '電話番号1（反響一覧の mobile に入る）', '改修', '2.2.301', NOW()),
  ('iei_db', 'tel2', '電話番号2（反響一覧の landline に入る）', '改修', '2.2.301', NOW()),
  ('iei_db', 'email', 'E-mailアドレス。同じ人かどうかの鍵', '改修', '2.2.301', NOW()),
  ('iei_db', 'registered_at', 'システム受付日時（メールの受信日時）。反響日・売却リードの受付日になる', '改修', '2.2.301', NOW()),
  ('iei_db', 'remarks', 'メールの全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- ieuru_resale：イエウール 査定依頼の取り込み元
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('ieuru_resale', 'イエウール 査定依頼の取り込み元', 'used', 'イエウール（売却査定サイト。中古住宅専門店）の査定依頼メールの内容。1行が1人（メールアドレスで見分ける）。
sync の runIeuru.ts（Gmail を IMAP で読む）が、1件ずつ ① の request ieuru_resale_update（handlers/ieuru_resale_update.php）へ送る。同じメールアドレスの行があれば UPDATE、無ければ INSERT。
そのあと portal/ieuru_resale.php が、その行を反響一覧（inquiry_customer_resale。`ieuru_<id>`・区分「売り:ポータル」）と
不動産CRMの売却リード（brokerage_listings。extId `ieul:<依頼日>:<氏名>`。氏名＋依頼日で重複を見る）へ足す（どちらも INSERT だけ）。
実行結果の画面（header/system/SyncLog.tsx）に名前が出る。
⚠️ メール本文から取り出すので、空の項目に次の見出しが混ざる列がある（requestsToCompany・replacementFlag・buildingName・totalFloorArea はほぼ全行、comment・mansionName など）。下流では混ざらない列だけを使う。
⚠️ イエウールの依頼番号は取り出していない（以前の売却リードの extId `ieul:<番号>` とは結べない）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'ieuru_resale' AND column_name NOT IN ('no', 'id', 'email', 'name', 'nameKana', 'age', 'address', 'mobile', 'preferredContactTime', 'reasonForAssessment', 'requestsToCompany', 'replacementFlag', 'assessmentMethod', 'comment', 'requestDate', 'concurrentAssessments', 'propertyType', 'propertyAddress', 'mansionName', 'roomNumber', 'buildingName', 'exclusiveArea', 'buildingArea', 'landArea', 'totalFloorArea', 'floorPlan', 'buildingAge', 'propertyStatus', 'relationshipToProperty', 'ownershipPeriod', 'surroundingEnvironment', 'buildingStructure', 'roadFrontage', 'propertyAppeal', 'purchaseAssessment', 'assessmentAmountHighAndFast', 'priceMovement', 'amountAfterTaxes', 'concerns', 'whatToDoIfSoldHigher', 'registered', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('ieuru_resale', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'id', '行の ID（`ie_`＋uniqid。PHP が作る）。反響一覧の inquiry_id は `ieuru_` ＋この値', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'email', 'メールアドレス。同じ人かどうかの鍵', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'name', 'お名前', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'nameKana', 'フリガナ', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'age', '年齢', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'address', '住所（お客様）', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'mobile', '電話番号', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'preferredContactTime', '希望連絡時間', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'reasonForAssessment', '査定理由（売却リードの reason に入る）', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'requestsToCompany', '査定会社への要望。⚠️ 次の見出しが混ざる', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'replacementFlag', '買い替え有無。⚠️ 次の見出しが混ざる', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'assessmentMethod', '査定方法', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'comment', 'コメント', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'requestDate', '依頼日時。売却リードの受付日・重複判定に使う', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'concurrentAssessments', '同時査定社数', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'propertyType', '物件種別（反響一覧の property に入る。売却リードでは 戸建／マンション／土地 に直す）', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'propertyAddress', '物件住所（反響一覧の area・売却リードの所在地に入る）', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'mansionName', 'マンション名', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'roomNumber', '部屋番号', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'buildingName', '建物名。⚠️ 次の見出しが混ざる', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'exclusiveArea', '専有面積', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'buildingArea', '建物面積', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'landArea', '土地面積', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'totalFloorArea', '延べ床面積。⚠️ 次の見出しが混ざる', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'floorPlan', '間取り', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'buildingAge', '築年数', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'propertyStatus', '物件の状況', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'relationshipToProperty', '物件との関係', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'ownershipPeriod', '所有年数', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'surroundingEnvironment', '周辺環境', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'buildingStructure', '建物構造', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'roadFrontage', '接面状況', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'propertyAppeal', 'おうちの魅力', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'purchaseAssessment', '買取査定', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'assessmentAmountHighAndFast', '「高く売った場合」と「早く売った場合」の査定額', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'priceMovement', '過去〜将来の値動き', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'amountAfterTaxes', '査定額から税金を引いた手元に残る金額', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'concerns', '気になること', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'whatToDoIfSoldHigher', '予想より高く売れたら何がしたいか', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'registered', 'システム受付日時（メールの受信日時）。反響一覧の反響日になる', '改修', '2.2.301', NOW()),
  ('ieuru_resale', 'remarks', 'メールの全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- information：旧お知らせ
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('information', '旧お知らせ', 'common', '（推定）旧版のお知らせ（社内向けの掲示）。1件＝1行。登録は 2025-03 〜 2025-05 の12件で、半分ほどはテストの行。
コードからの使用箇所なし（推定：home/informaiton.php が SELECT * で読むが、接続先は別の DB（owners_house）で dashboard の画面からは使っていない）。
⚠️ コードの request information（顧客情報）はこの表とは関係ない。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'information' AND column_name NOT IN ('id', 'date', 'title', 'content', 'poster', 'img_1', 'img_2', 'img_3', 'img_4', 'list');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('information', 'id', '連番', '推論', '2.2.301', NOW()),
  ('information', 'date', '（推定）掲示日（YYYY/MM/DD の文字列）', '推論', '2.2.301', NOW()),
  ('information', 'title', '（推定）お知らせの見出し', '推論', '2.2.301', NOW()),
  ('information', 'content', '（推定）お知らせの本文', '推論', '2.2.301', NOW()),
  ('information', 'poster', '（推定）投稿者（部署・名前）', '推論', '2.2.301', NOW()),
  ('information', 'img_1', '（推定）画像1', '推論', '2.2.301', NOW()),
  ('information', 'img_2', '（推定）画像2', '推論', '2.2.301', NOW()),
  ('information', 'img_3', '（推定）画像3', '推論', '2.2.301', NOW()),
  ('information', 'img_4', '（推定）画像4', '推論', '2.2.301', NOW()),
  ('information', 'list', '（推定）一覧に出すか（1＝出す）。⚠️ 今は全行 0', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- inquiry_ambassador：アンバサダー経由の反響
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('inquiry_ambassador', 'アンバサダー経由の反響', 'common', 'Instagram 公式アンバサダーの紹介ページ（kh-house.jp/ambassador/?id=<アンバサダーの no>）から届いた反響。1行が1件の反響。
受付：公開フォームが ② の request ambassador_inquiry（features/ambassador/inquiry.ts）へ直接送る。ログイン無しの書き込み口なので、値は信用せず長さを切り、流量を制限する（middlewares/publicFormRateLimit.ts）。保存のあとお客様へのお礼と社内への通知のメールを送る。
画面：アンバサダーの反響（header/ambassador/InquiryAmbassador.tsx）。② の ambassador（features/ambassador/index.ts）が一覧・担当の割り当て・顧客DB への取り込み（同期）を扱い、kpi.ts が集計する。
取り込み先は division で決まる（注文 master_data／建売 master_data_kaeru／中古 master_data_resale）。
⚠️ ② だけの機能（① に PHP は無い）。② が止まると画面も受付も動かない。
⚠️ 受付では shop・staff・sync・master_data_id を受け取らない（同期済みに偽装されないように）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'inquiry_ambassador' AND column_name NOT IN ('no', 'ambassador_no', 'ambassador_id', 'name', 'kana', 'zip', 'address', 'build_area', 'message', 'mobile', 'mail', 'account', 'shop', 'staff', 'inquiry_date', 'sync', 'division', 'agreed', 'mail_sent', 'notify_sent', 'master_data_id');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('inquiry_ambassador', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'ambassador_no', '紹介したアンバサダー（ambassador_list.no）', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'ambassador_id', 'アンバサダーの id', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'name', '氏名', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'kana', 'ふりがな', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'address', '住所', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'build_area', '建築希望地', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'message', 'ご質問やご要望（任意入力。顧客本人が記入）', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'mobile', '電話番号', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'mail', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'account', 'インスタグラムアカウント（反響時点の値）', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'shop', '担当店舗（社内で割り振る）', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'staff', '担当営業（社内で割り振る）', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'inquiry_date', '反響日', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'sync', '同期状況。0=未同期 1=同期済み', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'division', '事業区分。注文／建売／中古。同期先のテーブルが変わる', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'agreed', '進呈条件への同意。1=同意 0=未同意', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'mail_sent', '顧客宛サンクスメール。1=成功 0=失敗 NULL=未送信', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'notify_sent', '社内宛通知メール。1=成功 0=失敗 NULL=未送信', '改修', '2.2.301', NOW()),
  ('inquiry_ambassador', 'master_data_id', '同期で作成した顧客の id（ULID。どの表かは division を見る）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- inquiry_customer：反響一覧（注文住宅）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('inquiry_customer', '反響一覧（注文住宅）', 'order', '注文住宅の反響（問い合わせ・資料請求・来場予約）。1行が1件の反響。顧客DB（master_data）に取り込む前の受け皿。
書くところ（約40経路）
- ホームページのフォーム：② の campaign_form:entry・estimate・owners_house_reservation・kagosuma・kengakuCloud・housingBazar・memberEntry・myhomes・tochishinchaku（① に同名の予備）
- ポータル：① の portal/suumo_order.php・homes_order.php・townlife_order.php・allgrit_order.php（sync から）、pgh_order.php（GAS の資料請求メール）
- 更新：sync が inquiry_update（マイホームロボの ID・同期済み）、反響一覧の画面が list（担当店舗・担当営業・タグ・ブラックリスト・顧客DB への取り込み。features/list/save.ts）
読むところ：反響一覧（ListOrder.tsx。② の list）、分析（features/analysis）、日々の行動（dailyAction）、重複判定（inquiryDup。inquiry_dup_key を作る）、トラッキング（landing_params）など。
inquiry_id は媒体ごとの接頭辞＋元の ID（例 `suumo…`・`homes…`・`homes_reserve…`・`townlife…`・`allgrit…`・`form<日時>_<キャンペーンID>`・`pgh_hp_…`）。
⚠️ inquiry_id に UNIQUE キーが無い。書く側が既にあるかを SELECT してから入れる（INSERT IGNORE では防げない）。
⚠️ 既定値の無い NOT NULL の列が42列ある。INSERT では全部埋める（campaignForm/entry.ts の NOT_NULL_COLUMNS）。sync・delete_flag は数（空文字は不可）。
⚠️ 反響日（inquiry_date）は `YYYY/MM/DD`。ハイフンで入れるとメニューの未同期の数に出ない。
建売は inquiry_customer_kaeru、中古は inquiry_customer_resale（形はほぼ同じ）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'inquiry_customer' AND column_name NOT IN ('id', 'inquiry_id', 'pg_id', 'mhl_id', 'mhl_url', 'mhl_mail', 'inquiry_date', 'medium', 'response_medium', 'first_name', 'last_name', 'first_name_kana', 'last_name_kana', 'mobile', 'landline', 'mail', 'line_id', 'zip', 'pref', 'city', 'town', 'street', 'building', 'brand', 'shop', 'sync', 'staff', 'area', 'reserved_date', 'reserved_time', 'black_list', 'hp_campaign', 'delete_flag', 'duplicate', 'note', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referrer', 'first_visit', 'hotlead_url', 'url_params', 'landing_params', 'remarks', 'category', 'property', 'duplicate_flag', 'gift_flag', 'support_flag', 'black_flag');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('inquiry_customer', 'id', '連番（自動採番）。inquiry_dup_key.src_id が指す', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'inquiry_id', '反響の ID（媒体の接頭辞＋元の ID）。取り込み・更新の鍵', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'pg_id', '取り込んだ顧客の id（master_data.id）。顧客DB に取り込むと入る', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'mhl_id', 'マイホームロボの ID（sync の inquiry_update が入れる）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'mhl_url', 'マイホームロボの URL（sync の inquiry_update が入れる）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'mhl_mail', 'マイホームロボへ送ったメールの記録（推定。反響一覧が読むだけで、書く処理は見当たらない）', '推論', '2.2.301', NOW()),
  ('inquiry_customer', 'inquiry_date', '反響日（YYYY/MM/DD）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'medium', '媒体（例 ホームページ反響・タウンライフ・HOME''S・ALLGRIT・SUUMO・カゴスマ・持ち家計画）。販促媒体別の集計に使う', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'response_medium', '反響元の詳細（フォームの「ご予約のきっかけ」など。ポータルは媒体と同じ）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'first_name', '姓。⚠️ 名前の列名と逆（first_name に姓、last_name に名）。過去の行がすべてこの形なので入れ替えない', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'last_name', '名（ポータルの一部は空で、first_name に氏名まとめて入る）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'first_name_kana', '姓（カナ）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'last_name_kana', '名（カナ）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'mobile', '携帯番号（電話の種別が分からない取り込みもここに入れる）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'landline', '固定電話', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'mail', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'line_id', 'LINE ID', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'pref', '都道府県', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'city', '市区', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'town', '町村', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'street', '番地', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'building', '建物名（ポータルの多くは住所をまとめてここに入れる）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'brand', 'ブランド（例 KH・DJH・JH・Nagomi・PG HOUSE・PGH・2L・KHG）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'shop', '担当店舗（ブランドの接頭辞＋店舗名。決まらないときは「<ブランド>店舗未設定」）。反響一覧で変えられる', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'sync', '顧客DB に取り込んだか（0=未同期 1=取り込み済み）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'staff', '担当営業。反響一覧で変えられる', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'area', '建築予定地・希望エリア（ポータルの建設予定地など）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'reserved_date', '来場希望日', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'reserved_time', '来場希望時間', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'black_list', '旧タグ（空白区切りの文字列）。⚠️ 2026-09-02 からは書かない（*_flag の列へ移した。元データとして残している）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'hp_campaign', 'ホームページのキャンペーン名（PG HOUSE 九州の資料請求は「資料請求」）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'delete_flag', '削除の印（1=削除済み。集計から外す）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'duplicate', '重複の印（以前の「<店舗> <媒体> 重複」の文。⚠️ 2026-09-02 の duplicate_flag とは別物）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'note', '社内の申し送り（ポータルの全項目の文が入る取り込みもある）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'utm_source', 'UTM パラメータ（source）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'utm_medium', 'UTM パラメータ（medium）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'utm_campaign', 'UTM パラメータ（campaign）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'utm_term', 'UTM パラメータ（term）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'utm_content', 'UTM パラメータ（content）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'referrer', '参照元（推定。今の受付は空で入れる）', '推論', '2.2.301', NOW()),
  ('inquiry_customer', 'first_visit', '初回訪問（推定。今の受付は空で入れる）', '推論', '2.2.301', NOW()),
  ('inquiry_customer', 'hotlead_url', 'HOTLEAD の管理画面の URL（推定。反響一覧が読む。今のコードに書く処理は見当たらない）', '推論', '2.2.301', NOW()),
  ('inquiry_customer', 'url_params', 'フォームを送信したページの URL パラメータ（?以降）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'landing_params', '最後に見たパラメータ付きページの URL パラメータ（?以降）。トラッキング（khg_vid・gclid など）で広告の着地と結ぶ', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'remarks', 'お客様の自由記述（フォームのご質問など）・メール本文', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'category', '区分。※注文事業では使用しない（全行 NULL）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'property', '物件。※建売分譲事業では使用しない（注文では全行 NULL）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'duplicate_flag', '重複クリック（反響一覧のタグ）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'gift_flag', 'ギフト券進呈済み（反響一覧のタグ）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'support_flag', '業者（反響一覧のタグ）', '改修', '2.2.301', NOW()),
  ('inquiry_customer', 'black_flag', 'ブラックリスト（反響一覧のタグ）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- inquiry_customer_kaeru：建売の反響
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('inquiry_customer_kaeru', '建売の反響', 'spec', '建売（かえるホーム）の反響一覧。1行＝反響1件（同じお客様でも反響ごとに行がある）。注文の inquiry_customer・中古の inquiry_customer_resale と同じ形。
書くもの：ポータル・ホームページの取り込み（① handlers/portal/*.php が元の表から INSERT IGNORE。資料請求 catalog_kaeru・来場予約 reserve_kaeru・会員登録 member_kaeru・先取物件 pre_kaeru・ALLGRIT allGrit_kaeru・HOME''S・at home）、SUUMO は ② features/suumoKaeru.ts（v2.2.263〜反響ごとに1行）、紹介・アンバサダー・キャンペーンのフォーム（② campaignForm など）。
読む・直すもの：反響一覧（ListKaeru.tsx・② features/list）。店舗・担当の割り振り、顧客タグ、顧客DBへの取り込み（sync＝1・pg_id）、個人情報削除（privacy.ts）。
⚠️ 取り込み先は PG CLOUD ではなく Dashboard の顧客台帳（master_data_kaeru）。pg_id は列名が残っているだけ。
⚠️ inquiry_id が一意（INSERT IGNORE の重複防止）。⚠️ inquiry_date は text で「YYYY/MM/DD」と「YYYY-MM-DD」が混在する。
⚠️ 事業をまたいだ重複の件数は inquiry_dup_key（brand = spec・src_id = id）にある。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'inquiry_customer_kaeru' AND column_name NOT IN ('id', 'inquiry_id', 'pg_id', 'mhl_id', 'mhl_url', 'mhl_mail', 'inquiry_date', 'medium', 'response_medium', 'first_name', 'last_name', 'first_name_kana', 'last_name_kana', 'mobile', 'landline', 'mail', 'line_id', 'zip', 'pref', 'city', 'town', 'street', 'building', 'brand', 'shop', 'sync', 'staff', 'property', 'area', 'area_2', 'area_3', 'school_area', 'other_condition', 'reserved_date', 'reserved_time', 'black_list', 'hp_campaign', 'delete_flag', 'duplicate', 'note', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referrer', 'first_visit', 'hotlead_url', 'remarks', 'url', 'category', 'duplicate_flag', 'gift_flag', 'support_flag', 'black_flag', 'landing_params');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('inquiry_customer_kaeru', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'inquiry_id', '反響ID。接頭辞で出どころが分かる（hp_member_・hp_reserve_・hp_catalog_kaeru_・hp_pre_＝ホームページ、suumo_act_＝SUUMO の反響ごと、suumo_＝SUUMO の顧客ごと（v2.2.263 より前）、allgrit_・athome_・homes_）。⚠️ 一意', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'pg_id', '取り込んだ顧客の ID（master_data_kaeru.id）。取り込み前は空', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'mhl_id', '（推定）注文の反響サービスの ID。建売では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'mhl_url', '（推定）注文の反響サービスの URL。建売では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'mhl_mail', '（推定）注文の反響サービスのメール。建売では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'inquiry_date', '反響日（text。「/」と「-」の書式が混在）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'medium', '反響元（例 ホームページ反響・SUUMO・ALLGRIT・athome・HOME''S）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'response_medium', '反響媒体（何を見て知ったか。例 Instagram・Web検索・SUUMO）。⚠️ medium と同じでポータルの接頭辞なら顧客台帳の portal_flag を立てる（② list/portal.ts）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'first_name', '氏名（ホームページ・ポータルの取り込みは姓名をまとめてここに入れる）。⚠️ 空の行は反響一覧に出ない', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'last_name', '姓（取り込みによっては空）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'first_name_kana', 'ふりがな', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'last_name_kana', 'ふりがな（姓。取り込みによっては空）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'mobile', '電話番号（携帯。電話の項目が1つのフォームはここに入れる）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'landline', '電話番号（固定）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'mail', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'line_id', 'LINE ID', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'pref', '都道府県', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'city', '市区町村', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'town', '町名', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'street', '番地', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'building', '建物名。⚠️ ホームページ・ポータルの取り込みは住所全体をここに入れる', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'brand', 'ブランド。「かえる」', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'shop', '担当店舗（係名）。反響一覧で割り振る', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'sync', '顧客DBに取り込んだか。1＝取り込み済み（個人情報削除でも 1 になる）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'staff', '担当営業。反響一覧で割り振る', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'property', '問い合わせ物件', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'area', '希望エリア①（来場予約・会員登録・ポータル）。先取物件では先取物件の名前', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'area_2', '希望エリア②（会員登録）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'area_3', '希望エリア③（会員登録）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'school_area', 'エリアの補足（会員登録の area_notes）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'other_condition', 'その他の希望条件（会員登録）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'reserved_date', '来場予約・希望日', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'reserved_time', '来場予約・希望時間', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'black_list', '旧・顧客タグ（空白区切りの文字列。出現回数の偶奇で ON/OFF）。⚠️ 2026-09-02 から書かない。下の *_flag が正', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'hp_campaign', 'ホームページのキャンペーン名（例 資料請求・会員登録・先取物件、来場予約はイベント名）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'delete_flag', '削除の印（1＝削除）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'duplicate', '反響一覧で #タグ として出す文字列（重複など）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'note', '反響の内容（フォームの全項目をつないだ文。SUUMO は先頭に「同じお客様の反響あり」「予約キャンセル」の印が付く）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'utm_source', '流入の utm_source。建売では空（注文のフォーム用）', '推論', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'utm_medium', '流入の utm_medium。建売では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'utm_campaign', '流入の utm_campaign。建売では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'utm_term', '流入の utm_term。建売では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'utm_content', '流入の utm_content。建売では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'referrer', '参照元。建売では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'first_visit', '初回訪問の日時。建売では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'hotlead_url', '注文のホットリードの URL。建売では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'remarks', 'ポータルの取り込みの備考（HOME''S・at home などの全項目）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'url', '問い合わせ物件の URL（HOME''S の取り込み）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'category', '取引区分。⚠️ 建売分譲事業では使わない（空）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'duplicate_flag', '顧客タグ「重複」（1＝ON）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'gift_flag', '顧客タグ「ギフト券進呈済み」', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'support_flag', '顧客タグ「業者」', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'black_flag', '顧客タグ「ブラックリスト」（登録の理由は black_list テーブルの備考に残る）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_kaeru', 'landing_params', 'サイトでの閲覧と結びついた流入の情報（khg_vid など。v2.2.205）。取り込みで顧客台帳へ引き継ぐ', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- inquiry_customer_resale：中古リノベの反響
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('inquiry_customer_resale', '中古リノベの反響', 'used', '中古リノベ（国分ハウジンググループ中古住宅専門店）の反響一覧。1行＝反響1件。注文の inquiry_customer・建売の inquiry_customer_kaeru と同じ形に category（取引区分）がある。
書くもの：ポータル・ホームページの取り込み（① handlers/portal/*.php が元の表から INSERT IGNORE。資料請求 catalog_resale・来場予約 reserve_resale・会員登録 member_resale・カエール kaeeru_db・すまいステップ・イエウール・イエイ・SUUMO・HOME''S・at home）、紹介・アンバサダー（② inquirySync.ts）。
読む・直すもの：反響一覧（ListResale.tsx・② features/list）。店舗・担当の割り振り、顧客タグ、顧客DBへの取り込み（master_data_resale。sync＝1・pg_id）、個人情報削除、要確認（dailyAction.ts の中古の未同期は category = 買い:中古リノベ だけ数える）。
⚠️ inquiry_id が一意（INSERT IGNORE の重複防止）。⚠️ inquiry_date は text。
⚠️ 事業をまたいだ重複の件数は inquiry_dup_key（brand = used・src_id = id）にある。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'inquiry_customer_resale' AND column_name NOT IN ('id', 'inquiry_id', 'category', 'pg_id', 'mhl_id', 'mhl_url', 'mhl_mail', 'inquiry_date', 'medium', 'response_medium', 'first_name', 'last_name', 'first_name_kana', 'last_name_kana', 'mobile', 'landline', 'mail', 'line_id', 'zip', 'pref', 'city', 'town', 'street', 'building', 'brand', 'shop', 'sync', 'staff', 'property', 'area', 'reserved_date', 'reserved_time', 'black_list', 'hp_campaign', 'delete_flag', 'duplicate', 'note', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'referrer', 'first_visit', 'hotlead_url', 'remarks', 'url', 'duplicate_flag', 'gift_flag', 'support_flag', 'black_flag');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('inquiry_customer_resale', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'inquiry_id', '反響ID。接頭辞で出どころが分かる（hp_catalog_・hp_member_・hp_resale_＝ホームページ、kaeeru_assess_＝カエール、sumai・ieuru・iei・athome・suumo・homes＝各ポータル）。⚠️ 一意', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'category', '取引区分（買い:中古リノベ／売り:ポータル／買い:ポータル）。取り込みで顧客台帳の in_charge_store・category に入る。⚠️ ホームページの反響は 買い:中古リノベ、査定サイト（カエールなど）は 売り:ポータル', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'pg_id', '取り込んだ顧客の ID（master_data_resale.id）。取り込み前は空', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'mhl_id', '（推定）注文の反響サービスの ID。中古では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'mhl_url', '（推定）注文の反響サービスの URL。中古では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'mhl_mail', '（推定）注文の反響サービスのメール。中古では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'inquiry_date', '反響日（text）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'medium', '反響元（例 ホームページ反響・すまいステップ・イエウール・athome・SUUMO・HOME''S・イエイ・カエール）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'response_medium', '反響媒体（何を見て知ったか。ご予約のきっかけ など）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'first_name', '氏名（取り込みは姓名をまとめてここに入れる）。⚠️ 空の行は反響一覧に出ない', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'last_name', '姓（取り込みによっては空）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'first_name_kana', 'ふりがな', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'last_name_kana', 'ふりがな（姓。取り込みによっては空）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'mobile', '電話番号（携帯。電話の項目が1つのフォームはここに入れる）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'landline', '電話番号（固定）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'mail', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'line_id', 'LINE ID', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'pref', '都道府県', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'city', '市区町村', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'town', '町名', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'street', '番地', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'building', '建物名。⚠️ ホームページ・ポータルの取り込みは住所全体をここに入れる', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'brand', 'ブランド。「中古住宅専門店」', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'shop', '担当店舗。反響一覧で割り振る', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'sync', '顧客DBに取り込んだか。1＝取り込み済み', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'staff', '担当営業。反響一覧で割り振る', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'property', '問い合わせ物件', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'area', 'エリア（カエールは査定物件の所在地）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'reserved_date', '来場予約・希望日', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'reserved_time', '来場予約・希望時間', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'black_list', '旧・顧客タグ（空白区切りの文字列）。⚠️ 2026-09-02 から書かない。下の *_flag が正', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'hp_campaign', 'キャンペーン名（例 資料請求・会員登録・カエール、来場予約はイベント名）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'delete_flag', '削除の印（1＝削除）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'duplicate', '反響一覧で #タグ として出す文字列（重複など）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'note', '反響の内容（フォームの全項目をつないだ文。カエールは査定の種別・面積・現況などをつないだ文）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'utm_source', '流入の utm_source。中古では空（注文のフォーム用）', '推論', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'utm_medium', '流入の utm_medium。中古では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'utm_campaign', '流入の utm_campaign。中古では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'utm_term', '流入の utm_term。中古では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'utm_content', '流入の utm_content。中古では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'referrer', '参照元。中古では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'first_visit', '初回訪問の日時。中古では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'hotlead_url', '注文のホットリードの URL。中古では空', '推論', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'remarks', 'ポータルの取り込みの備考（全項目）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'url', '問い合わせ物件の URL（ポータルの取り込み）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'duplicate_flag', '顧客タグ「重複」（1＝ON）', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'gift_flag', '顧客タグ「ギフト券進呈済み」', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'support_flag', '顧客タグ「業者」', '改修', '2.2.301', NOW()),
  ('inquiry_customer_resale', 'black_flag', '顧客タグ「ブラックリスト」', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- inquiry_dup_exclude：重複反響の除外の名簿
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('inquiry_dup_exclude', '重複反響の除外の名簿', 'common', '事業をまたいだ重複反響の判定（v2.2.276）から外す値の名簿。社員のテストに使ったメール・携帯など。1行が1つの値。
② の inquiryDup/refresh.ts が読み、名簿の値を持つ反響は inquiry_dup_key の鍵を NULL にする（重複の相手にしない）。
⚠️ 値そのものは持たず、正規化した値のハッシュだけを持つ。⚠️ 名簿のメールを持つ行の携帯も除外する（逆も）。
⚠️ 画面は無い。足すときは SQL で入れる（backend/scripts/sql/2026-11-17_update_log_2.2.276.sql を手本に）。足すと次に読んだときに inquiry_dup_key が作り直される。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'inquiry_dup_exclude' AND column_name NOT IN ('id', 'kind', 'key_hash', 'note', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('inquiry_dup_exclude', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('inquiry_dup_exclude', 'kind', '値の種類。mail / mobile / domain（メールの @ の後ろ）', '改修', '2.2.301', NOW()),
  ('inquiry_dup_exclude', 'key_hash', 'SHA2(正規化した値, 256)。正規化は inquiryDup/keys.ts と同じ（NFKC・空白除去・小文字など）', '改修', '2.2.301', NOW()),
  ('inquiry_dup_exclude', 'note', '誰の・なぜ（例 社員のテスト）', '改修', '2.2.301', NOW()),
  ('inquiry_dup_exclude', 'created_at', '登録日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- inquiry_dup_key：重複反響の判定の鍵
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('inquiry_dup_key', '重複反響の判定の鍵', 'common', '事業をまたいだ重複反響の判定用の表（v2.2.276）。1行が1件の反響（注文・建売・中古の反響の表の1行）。
「正規化したメール」か「携帯（070/080/090/050 で始まる11桁）」が同じ、ほかの反響の数を持つ。氏名は使わない。
② の inquiryDup/refresh.ts だけが書く。3つの反響の表と除外の名簿（inquiry_dup_exclude）の指紋（件数・最大 id・CRC の XOR）を比べ、変わっていたら全件を計算し直して変わった行だけ書く。
呼ぶのは反響一覧（list）と重複の詳細（request inquiryDup）の冒頭、10分ごとの安全網。
反響一覧（② の list/queries.ts、① の予備 list_order.php・list_spec.php・list_used.php）が dup_count を読み、件数のアイコンを出す。
⚠️ 反響の経路ごとには更新しない（約40経路あり漏れるため）。⚠️ 手で直さない（次の計算で上書きされる）。
⚠️ ② が止まっている間は ① の予備が止まった時点の件数を出す。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'inquiry_dup_key' AND column_name NOT IN ('brand', 'src_id', 'mail_key', 'mobile_key', 'dup_count', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('inquiry_dup_key', 'brand', '事業。order（inquiry_customer）/ spec（inquiry_customer_kaeru）/ used（inquiry_customer_resale）', '改修', '2.2.301', NOW()),
  ('inquiry_dup_key', 'src_id', '反響の表の id（brand で表が決まる）。brand と合わせて主キー', '改修', '2.2.301', NOW()),
  ('inquiry_dup_key', 'mail_key', 'NFKC・空白除去・小文字にしたメール。メールの形でない・除外の名簿にあるなら NULL', '改修', '2.2.301', NOW()),
  ('inquiry_dup_key', 'mobile_key', '070/080/090/050 で始まる11桁の携帯。それ以外・除外なら NULL', '改修', '2.2.301', NOW()),
  ('inquiry_dup_key', 'dup_count', 'メールか携帯が同じ、ほかの反響の数（3事業をまたぐ。自分は除く）', '改修', '2.2.301', NOW()),
  ('inquiry_dup_key', 'updated_at', 'この行を書いた日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- inquiry_introductory：お友達紹介キャンペーンの反響
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('inquiry_introductory', 'お友達紹介キャンペーンの反響', 'common', 'お友達紹介キャンペーン（オーナー様・社員・業者様からの紹介）の反響。1行が1件の紹介の届け出。
受付：GAS（Gmail を監視）が通知メールを読み、① の request introductory（handlers/introductory.php）へ送る。重複は dedupKey の UNIQUE キーで弾く。
画面：紹介の反響（header/introductory/InquiryIntroductory.tsx）。② の inquiry_introductory（features/introductory/index.ts）が一覧・担当の割り当て・顧客DB への取り込み（同期）・重複／ブラックリストのタグを扱う。② が止まるとこの画面は動かない（① の予備は無い）。
取り込み先は division で決まる（注文 master_data／建売 master_data_kaeru／中古 master_data_resale）。お知らせ（information）・店舗の集計（shop/queries.ts）・紹介の集計（introductory/summary.ts）も読む。
⚠️ 受付は ① に置いている（GAS は送り直さないので、② が止まっている間の反響を失わないため）。
⚠️ 列名は GAS の key 名そのまま（キャメルケース）。
⚠️ 本当に取り込み済みか は sync = 1 かつ master_data_id あり で見る。タグを付けた行も sync = 1 になるが master_data_id は NULL（同期不要）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'inquiry_introductory' AND column_name NOT IN ('no', 'dedupKey', 'campaignName', 'referrerType', 'division', 'brand', 'registrantName', 'registrantKana', 'mail', 'companyName', 'postalCode', 'area', 'tel', 'fax', 'mobile', 'mailPermission', 'salesStaff', 'friendName', 'friendKana', 'friendTel', 'friendLineId', 'note', 'guideStaff', 'shop', 'staff', 'sync', 'master_data_id', 'registered', 'remarks', 'createdAt', 'duplicate_tag', 'blacklist_tag');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('inquiry_introductory', 'no', '連番', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'dedupKey', '重複判定キー（SHA-256）。同じメールが複数通届くため。UNIQUE', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'campaignName', 'キャンペーン名', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'referrerType', '紹介者区分。owner=オーナー様 employee=社員 partner=業者様', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'division', '事業区分。注文／建売／中古。同期先のテーブルが変わる', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'brand', 'ブランド', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'registrantName', '名前（紹介者）', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'registrantKana', 'ふりがな（紹介者）', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'mail', 'メールアドレス（紹介者）', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'companyName', '会社情報（業者様のとき）', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'postalCode', '郵便番号', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'area', '住所', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'tel', '電話番号', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'fax', 'FAX番号', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'mobile', '携帯番号', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'mailPermission', 'メール配信可否', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'salesStaff', '担当営業。キャンペーンによって設問名が「担当希望営業」の場合もある', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'friendName', '【お友達】氏名（漢字）', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'friendKana', '【お友達】氏名（かな）', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'friendTel', '【お友達】電話番号', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'friendLineId', '【お友達】LINE ID', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'note', 'ご希望内容。複数行になり得る', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'guideStaff', 'ご案内担当者', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'shop', '担当店舗。⚠️ 反響時点では必ず未設定。社内で割り振る', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'staff', '担当営業。空なら同期時に「<店舗> 管理」になる', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'sync', '顧客として取り込んだか。1=取り込み済み（タグを付けた行も 1）。⚠️ 1 の行は担当変更も同期も拒否する', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'master_data_id', '作成した顧客の id。⚠️ どのテーブルの id かは division を見る', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'registered', 'システム受付日時。GAS が通知メールの受信日時から生成する。一覧はこの順に並べる', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'remarks', 'GAS が生成した「ラベル：値」形式の全項目テキスト', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'createdAt', '当システムへの登録日時', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'duplicate_tag', '重複客（1 にすると sync も 1。顧客は作らない）', '改修', '2.2.301', NOW()),
  ('inquiry_introductory', 'blacklist_tag', 'ブラックリスト客（1 にすると sync も 1。顧客は作らない）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- interview_sheet：商談ステップ（面談の記録）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('interview_sheet', '商談ステップ（面談の記録）', 'common', '顧客ごとの商談ステップ（面談・アクションの記録）。1行＝1顧客（id は master_data・master_data_kaeru・master_data_resale の id）。記録の中身は interview_log に JSON 配列で持つ。
書くのは ② information の update_interview_log（顧客の編集画面）と interviewLog（商談ステップ画面。保存と同じトランザクションで顧客台帳の工程の日付も更新する。interviewKpi.ts）。
読むのは顧客の編集画面、日報（dailyReport.ts）、毎日の行動（次回アクション日）、記録の本文検索（recordSearch.ts）、担当営業の契約率（staffContract.ts）、分析 API、ギフトの判定、紹介集計など。
⚠️ PRIMARY は no だけで id に索引が無い。⚠️ id が空の行がある。空の id で検索しない（他人の記録が返る）。
⚠️ 顧客が3事業のどこにも居なくても保存する。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'interview_sheet' AND column_name NOT IN ('no', 'name', 'id', 'shop', 'interview_log');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('interview_sheet', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('interview_sheet', 'name', '顧客名（作ったときの値）', '改修', '2.2.301', NOW()),
  ('interview_sheet', 'id', '顧客ID', '改修', '2.2.301', NOW()),
  ('interview_sheet', 'shop', '顧客の担当店舗（保存のたびに更新）', '改修', '2.2.301', NOW()),
  ('interview_sheet', 'interview_log', '記録の JSON 配列。1件は day（日付）・action（初回面談・2回目以降面談・契約 などのアクション）・note（本文）・staff（実施した担当）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- introductory：紹介元の選択肢
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('introductory', '紹介元の選択肢', 'common', '顧客の「紹介元」の選択肢の一覧。1行が1つの選択肢（例 オーナー様・社員・家づくりヒーロー・SUUMOカウンター）。
読むところ：顧客情報の編集（InformationEdit.tsx・InformationEditKaeru.tsx・InformationEditResale.tsx）の紹介元の選択欄、顧客DB（注文。DatabaseOrder.tsx）の紹介元の絞り込み、架電状況の一覧（callStatusList）。② の information・database・callStatusList と ① の同名の PHP が `SELECT * FROM introductory` で返す。
⚠️ 画面からは足せない。選択肢を増やすときは DB に直接入れる（推定）。⚠️ 名前を変えると、すでに顧客に入っている値と合わなくなる。
お友達紹介キャンペーンの反響（inquiry_introductory）とは別物。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'introductory' AND column_name NOT IN ('no', 'name');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('introductory', 'no', '連番', '改修', '2.2.301', NOW()),
  ('introductory', 'name', '選択肢の名前（画面にそのまま出る）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- k-snap：K-SNAP の写真
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('k-snap', 'K-SNAP の写真', 'order', 'K-SNAP（お客様向けの施工写真ギャラリー https://k-snap.jp）の写真。1枚＝1行。
登録・編集はスタッフの画面（photo/Form.tsx・Edit.tsx。① handlers/k-snap_update.php。画像は ① に保存するので ② には移していない）。表示の切り替えは k-snap_show（show_snap・staff_show だけ）。
読むのは公開ギャラリー（request k-snap。show_snap = 1 だけ、owner は暗号化して返す）とスタッフの一覧（k-snap_edit・k-snap_load）。② features/ksnap/index.ts。
⚠️ 表の名前にハイフンがあるので SQL では `k-snap` と囲む。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'k-snap' AND column_name NOT IN ('id', 'detail', 'category', 'plan', 'pref', 'town', 'brand', 'shop', 'note', 'tag', 'image', 'staff', 'created_at', 'show_snap', 'url', 'staff_show', 'owner');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('k-snap', 'id', '連番', '改修', '2.2.301', NOW()),
  ('k-snap', 'detail', '写真の場所（内観・外観）', '改修', '2.2.301', NOW()),
  ('k-snap', 'category', '種別（施工事例・オーナーズハウス・モデルハウス・完成見学会）', '改修', '2.2.301', NOW()),
  ('k-snap', 'plan', '建物（平屋・2階建て）', '改修', '2.2.301', NOW()),
  ('k-snap', 'pref', '都道府県', '改修', '2.2.301', NOW()),
  ('k-snap', 'town', '市区町村', '改修', '2.2.301', NOW()),
  ('k-snap', 'brand', 'ブランド名（国分ハウジング・デイジャストハウス・なごみ工務店・ニーエルホーム）', '改修', '2.2.301', NOW()),
  ('k-snap', 'shop', '店舗', '改修', '2.2.301', NOW()),
  ('k-snap', 'note', '（推定）写真の説明', '推論', '2.2.301', NOW()),
  ('k-snap', 'tag', 'タグ（JSON 配列の文字列）。公開ギャラリーの絞り込み', '改修', '2.2.301', NOW()),
  ('k-snap', 'image', '画像のファイル名（① に保存）', '改修', '2.2.301', NOW()),
  ('k-snap', 'staff', '登録したスタッフ', '改修', '2.2.301', NOW()),
  ('k-snap', 'created_at', '登録日時', '改修', '2.2.301', NOW()),
  ('k-snap', 'show_snap', '公開ギャラリーに出すか（1＝表示中）', '改修', '2.2.301', NOW()),
  ('k-snap', 'url', '（推定）関連ページ（物件・施工事例のページなど）の URL', '推論', '2.2.301', NOW()),
  ('k-snap', 'staff_show', '公開ギャラリーに営業名を出すか（1＝表示）', '改修', '2.2.301', NOW()),
  ('k-snap', 'owner', 'お施主様名（「○○様邸」の表示に使う）。⚠️ 公開ギャラリーには暗号化して返す（core/ksnap.php・ksnap/owner.ts。同じ名前は同じ暗号文）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- k-snap_customer：K-SNAP のお客様アカウント
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('k-snap_customer', 'K-SNAP のお客様アカウント', 'order', 'K-SNAP の公開ギャラリーにログインするお客様のアカウント。1顧客＝1行。
発行は顧客情報の画面（InformationEdit.tsx の K-SNAP のボタン → request information の roll k-snap。① informationAction/information_k-snap.php）。4文字のパスワードを作ってお客様に伝える。
読み書きは公開ギャラリー（request k-snap_login・k-snap_customer・k-snap_customer_update。② features/ksnap/index.ts）。
⚠️ pass は平文で、ログインの試行回数の制限も無い。⚠️ k-snap_customer は SELECT * なので pass も返る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'k-snap_customer' AND column_name NOT IN ('no', 'pass', 'id', 'tag', 'setting', 'log', 'bookmark', 'path');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('k-snap_customer', 'no', '連番', '改修', '2.2.301', NOW()),
  ('k-snap_customer', 'pass', 'ログインのパスワード（4文字）。⚠️ 秘密の値。見ない・書かない', '改修', '2.2.301', NOW()),
  ('k-snap_customer', 'id', '顧客ID（master_data.id）', '改修', '2.2.301', NOW()),
  ('k-snap_customer', 'tag', '（推定）お客様が選んだタグ。公開ギャラリーが k-snap_customer_update で書く', '推論', '2.2.301', NOW()),
  ('k-snap_customer', 'setting', '（推定）お客様の表示の設定', '推論', '2.2.301', NOW()),
  ('k-snap_customer', 'log', '（推定）お客様の閲覧の記録', '推論', '2.2.301', NOW()),
  ('k-snap_customer', 'bookmark', '（推定）お客様のブックマーク（お気に入りの写真）', '推論', '2.2.301', NOW()),
  ('k-snap_customer', 'path', '（推定）お客様が最後に見ていた画面の位置', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- kaeeru_db：カエールの査定依頼
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('kaeeru_db', 'カエールの査定依頼', 'used', '不動産査定サイト「カエール」からの査定依頼メールを取り込んだ元の表。1行＝依頼者1人（メールアドレスで1行）。
書くもの：メールの取り込みが ① の request kaeeru_update で送る（kaeeru_update.php）。同じメールアドレスがあれば上書き、無ければ INSERT。
続けて ① handlers/portal/kaeeru.php が中古の反響一覧（inquiry_customer_resale）へ `kaeeru_assess_<id>` で写す（medium・response_medium・hp_campaign＝カエール、category＝売り:ポータル、査定の項目は note につなぐ）。
⚠️ 表の名前は「かえる」ではなく「カエール」。建売ではなく中古（売却の相談）の反響。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'kaeeru_db' AND column_name NOT IN ('id', 'type', 'location', 'area', 'status', 'schedule', 'relation', 'price', 'name', 'name_kana', 'email', 'address', 'tel', 'registered', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('kaeeru_db', 'id', 'ID（自動採番）。反響ID の末尾になる', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'type', '種別（査定する不動産の種別）', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'location', '所在地（査定する不動産。反響一覧の area に入る）', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'area', '土地面積', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'status', '現況', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'schedule', '売却予定', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'relation', '査定対象不動産とご自身の関係', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'price', '査定額', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'name', 'お名前', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'name_kana', 'フリガナ', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'email', 'メールアドレス。⚠️ 同じ人かどうかはこれで決める', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'address', '住所（依頼者の住所。反響一覧の building に入る）', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'tel', 'ご連絡先（反響一覧の mobile に入る）', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'registered', 'メール受信日時', '改修', '2.2.301', NOW()),
  ('kaeeru_db', 'remarks', '反響内容のまとめ（メールの全項目をつないだ文）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- kaeru_building：建売の物件（工程表）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('kaeru_building', '建売の物件（工程表）', 'spec', '建売（かえるホーム）の物件一覧。スプレッドシート「かえるホーム工程表」の CSV から作る。1行＝物件1つ（property_id が主キー）。
書くもの：backend-express/scripts/import-kaeru-csv.mjs（⚠️ TRUNCATE してから全件を入れ直す）。2026-08-26_market_construction.sql で今の形に作り替えた。
読むもの：市況表（Market。① market_construction.php）の建売の着工・契約。注文の着工は contract_customer。
⚠️ 店舗コードを持たない。課・店舗で絞るときは staff（担当者名）を staff_list で読み替える。
⚠️ use_code の 4（中古再販）は新設着工ではないので着工から外す（frontend/src/components/market/README.md）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'kaeru_building' AND column_name NOT IN ('property_id', 'name', 'use_code', 'category', 'progress_status', 'sales_status', 'area', 'pref', 'constructionDate', 'completionDate', 'handoverDate', 'contractDate', 'staff');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('kaeru_building', 'property_id', '物件ID（CSV の列0）。主キー', '改修', '2.2.301', NOW()),
  ('kaeru_building', 'name', '物件名称。⚠️ 同じ名前の物件があるのでキーに使わない', '改修', '2.2.301', NOW()),
  ('kaeru_building', 'use_code', '用途コード 0〜5（凡例が無いので生の値を残す。0・1・2・5＝建売、3＝注文系モデルハウス、4＝中古再販）', '改修', '2.2.301', NOW()),
  ('kaeru_building', 'category', 'use_code から作る区分。建売／中古', '改修', '2.2.301', NOW()),
  ('kaeru_building', 'progress_status', '工程状況（完成済・着工前・建築中・その他）', '改修', '2.2.301', NOW()),
  ('kaeru_building', 'sales_status', '販売状況（引渡済・販売中・契約済・キャンセル など）', '改修', '2.2.301', NOW()),
  ('kaeru_building', 'area', '市区町村', '改修', '2.2.301', NOW()),
  ('kaeru_building', 'pref', '県（取り込みで population の (pref, area) と突き合わせて補う）', '改修', '2.2.301', NOW()),
  ('kaeru_building', 'constructionDate', '基礎着工日。1970-01-01 は未入力として NULL', '改修', '2.2.301', NOW()),
  ('kaeru_building', 'completionDate', '完工日', '改修', '2.2.301', NOW()),
  ('kaeru_building', 'handoverDate', '引渡日（旧 finishedDate）', '改修', '2.2.301', NOW()),
  ('kaeru_building', 'contractDate', '契約計上日', '改修', '2.2.301', NOW()),
  ('kaeru_building', 'staff', '契約担当（staff_list の name と突き合わせる）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- kaeru_building_backup_20260827：建売の物件（旧形式の写し）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('kaeru_building_backup_20260827', '建売の物件（旧形式の写し）', 'spec', 'kaeru_building（元の表）を今の形に作り替える前の、旧形式の写し（2026-08-27）。⚠️ 画面・処理からは使っていない（推定）。
旧形式は物件IDを持たず（name・status・address・category・日付3列）、差分更新ができなかったため作り替えた（2026-08-26_market_construction.sql。SQL の退避先の名前は _20260826 だが、実物はこの _20260827）。
⚠️ 列の形が元の表と違う。同じ名前の列も型は text。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'kaeru_building_backup_20260827' AND column_name NOT IN ('no', 'name', 'status', 'address', 'category', 'constructionDate', 'completionDate', 'finishedDate');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('kaeru_building_backup_20260827', 'no', '連番（旧形式の行番号）', '改修', '2.2.301', NOW()),
  ('kaeru_building_backup_20260827', 'name', '物件名称。⚠️ 同じ名前の物件があるのでキーに使わない', '改修', '2.2.301', NOW()),
  ('kaeru_building_backup_20260827', 'status', '旧形式の工程の状況（例 着工前・着工～引渡し・完成済・引渡し・解約。今の progress_status・sales_status に分かれる前の値）', '改修', '2.2.301', NOW()),
  ('kaeru_building_backup_20260827', 'address', '所在地（今は area・pref に分かれる）', '改修', '2.2.301', NOW()),
  ('kaeru_building_backup_20260827', 'category', '区分（旧形式の値。text）', '改修', '2.2.301', NOW()),
  ('kaeru_building_backup_20260827', 'constructionDate', '着工日（text）', '改修', '2.2.301', NOW()),
  ('kaeru_building_backup_20260827', 'completionDate', '完工日（text）', '改修', '2.2.301', NOW()),
  ('kaeru_building_backup_20260827', 'finishedDate', '引渡日（今の handoverDate）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- khf_customers：不動産（KHF）の顧客の写し
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('khf_customers', '不動産（KHF）の顧客の写し', 'spec', 'コードからの使用箇所なし（推定：国分ハウジング不動産 本店の顧客を、不動産の顧客管理システムから書き出して取り込んだ写し。媒体に「かえるHP」「SUUMO」などがあり、建売・中古の買い／売りの反響が混ざる）。
1行＝1顧客（の1案件）。登録日の最大は 2026-04 ごろで、それ以後は更新されていない（推定）。
⚠️ 画面・処理からは使っていない（推定）。開発用の個人情報マスク（mask_personal_info.sql）の対象には入っている。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'khf_customers' AND column_name NOT IN ('no', 'id_action', 'staff', 'shop', 'id_related', 'name', 'kana', 'estate_name_1', 'category', 'medium', 'case', 'id_case', 'status', 'mail', 'zip', 'address', 'phone', 'registered', 'reserved', 'contract', 'action', 'rank');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('khf_customers', 'no', '連番（自動採番）', '推論', '2.2.301', NOW()),
  ('khf_customers', 'id_action', '（推定）元システムの顧客（追客）ID', '推論', '2.2.301', NOW()),
  ('khf_customers', 'staff', '担当者', '推論', '2.2.301', NOW()),
  ('khf_customers', 'shop', '店舗（ほぼ「株式会社　国分ハウジング不動産　本店」）', '推論', '2.2.301', NOW()),
  ('khf_customers', 'id_related', '（推定）元システムの関連ID', '推論', '2.2.301', NOW()),
  ('khf_customers', 'name', '顧客名', '推論', '2.2.301', NOW()),
  ('khf_customers', 'kana', '顧客名のかな', '推論', '2.2.301', NOW()),
  ('khf_customers', 'estate_name_1', '（推定）問い合わせた物件名', '推論', '2.2.301', NOW()),
  ('khf_customers', 'category', '（推定）希望の種別など。JSON 配列の文字列（多くは空文字の配列）', '推論', '2.2.301', NOW()),
  ('khf_customers', 'medium', '反響媒体（かえるHP(会員登録） / SUUMO / アットホーム など）', '推論', '2.2.301', NOW()),
  ('khf_customers', 'case', '案件の区分（「買:」「売:」＋物件種別）', '推論', '2.2.301', NOW()),
  ('khf_customers', 'id_case', '（推定）元システムの案件ID', '推論', '2.2.301', NOW()),
  ('khf_customers', 'status', '追客の状態（追客中 / 接触（通話・返信） / 来店あり / 契約 / 追客終了 など）', '推論', '2.2.301', NOW()),
  ('khf_customers', 'mail', 'メールアドレス', '推論', '2.2.301', NOW()),
  ('khf_customers', 'zip', '郵便番号', '推論', '2.2.301', NOW()),
  ('khf_customers', 'address', '住所', '推論', '2.2.301', NOW()),
  ('khf_customers', 'phone', '電話番号', '推論', '2.2.301', NOW()),
  ('khf_customers', 'registered', '登録日時', '推論', '2.2.301', NOW()),
  ('khf_customers', 'reserved', '（推定）来店予約日', '推論', '2.2.301', NOW()),
  ('khf_customers', 'contract', '（推定）契約日・契約番号（形がそろっていない）', '推論', '2.2.301', NOW()),
  ('khf_customers', 'action', '対応履歴（date・method などを持つ JSON 配列の文字列）', '推論', '2.2.301', NOW()),
  ('khf_customers', 'rank', 'ランク（S / C / D / E / F）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- kpi_analysis_history：旧KPI分析の結果
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('kpi_analysis_history', '旧KPI分析の結果', 'common', '旧「KPI分析」（Claude による定型分析。① の kpi_analyze.php）の1回の結果が1行。Claude の解釈（analysis_json）と集計値（kpi_json）を JSON のまま持ち、画面で同じ結果を復元する。
読むのは ② の features/kpi/history.ts（kpi_analysis_list・kpi_analysis_get。Master のみ）で、画面は「Claudeによる分析」（header/claude/ClaudeAnalysis.tsx）の過去の定型分析。削除は ① の kpi_analysis_delete.php。
⚠️ kpi_analyze は画面から呼ばれなくなった（2026-10 以降の行が無い）。今の分析は ai_analysis_job。
⚠️ kpi_json は集計値だけで、お客様の個人情報は入らない（住所は市区町村まで）。⚠️ 一覧で analysis_json・kpi_json を SELECT しない（重い）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'kpi_analysis_history' AND column_name NOT IN ('id', 'staff_id', 'usage_log_id', 'title', 'headline', 'analysis_type', 'division', 'scope_section', 'scope_shop', 'scope_staff', 'scope_label', 'analysis_json', 'kpi_json', 'model', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('kpi_analysis_history', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'staff_id', '実行者。staff.id（外部キー）', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'usage_log_id', 'ai_usage_log.id。コスト追跡用', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'title', '一覧に出す見出し（例: 日付＋事業＋課＋分析の種類）', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'headline', 'Claudeの総括1〜2文。一覧のサブテキスト', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'analysis_type', 'inquiry_trend＝反響推移 / shop＝店舗別 / medium＝媒体別', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'division', 'order / kaeru', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'scope_section', '対象の課（shop_list.section）。空は事業全体', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'scope_shop', '対象の店舗（shop_list.shop）', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'scope_staff', '対象の担当者（staff_list.name）', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'scope_label', '対象の表示名（例: 注文事業 › 鹿児島営業1課）', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'analysis_json', 'Claude の解釈（StructuredAnalysis）', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'kpi_json', '集計値（AnySnapshot）。グラフの元データ', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'model', '使ったモデル（例: claude-opus-5）', '改修', '2.2.301', NOW()),
  ('kpi_analysis_history', 'created_at', '実行した日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- lg_code：地方公共団体コード
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('lg_code', '地方公共団体コード', 'common', '総務省の全国地方公共団体コードの一覧（R6.1.1 現在・1,794件）。1行が1つの都道府県または市区町村。v2.2.284 で作った（backend/scripts/sql/2026-11-18_update_log_2.2.284.sql）。
オーナーズハウスの管理画面（② ownersHouse/admin.ts）が市区町村の選択肢に読み、選んだ code を ownershouse.lg_code に入れる。
⚠️ 書き込む画面は無い。市町村の合併などで変わったら SQL で入れ直す。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'lg_code' AND column_name NOT IN ('code', 'pref_name', 'city_name', 'pref_short', 'city_short');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('lg_code', 'code', '団体コード（6桁。末尾は検査数字）', '改修', '2.2.301', NOW()),
  ('lg_code', 'pref_name', '都道府県名（例 鹿児島県）', '改修', '2.2.301', NOW()),
  ('lg_code', 'city_name', '市区町村名（例 霧島市）。都道府県そのものの行は空', '改修', '2.2.301', NOW()),
  ('lg_code', 'pref_short', '都道府県名から「都府県」を抜いた形（例 鹿児島。北海道はそのまま）。ownershouse.pref と同じ形', '改修', '2.2.301', NOW()),
  ('lg_code', 'city_short', '市区町村名から末尾の「市区町村」を抜いた形（例 霧島）。ownershouse.area と同じ形', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- loan_plan_rate：金融機関のプラン別金利（月次）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('loan_plan_rate', '金融機関のプラン別金利（月次）', 'common', '商圏内の金融機関の住宅ローンのプラン別金利。1行が「1か月 × 1プラン」。v2.2.240（backend/scripts/sql/2026-11-03_loan_plan_rate.sql）。
② loanPlanRate.ts：loan_plan_rate_upload（Master だけ）が plan_rates_YYYY-MM.csv の内容でその月を丸ごと入れ替え、loan_plan_rate_list（全員）が画面 header/market/LoanRates.tsx に返す。
⚠️ 資金計画書の金利（loan_product / loan_rate）とは別物。ここから計画書の金利は書き換えない。
⚠️ 列名は CSV の見出しと同じ。改名しない。月ごとの分析レポートは analysis_report（category = ''loan_rate''）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'loan_plan_rate' AND column_name NOT IN ('no', 'month', 'line', 'g', 'id', 'fi', 'plan', 'rtype', 'term', 'feeType', 'dan', 'cond', 'rate', 'base', 'prev', 'asof', 'url', 'conf', 'created_by', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('loan_plan_rate', 'no', '連番', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'month', '対象月（YYYY-MM。CSV のファイル名の月）', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'line', 'CSV の行番号（見出しを1行目として数える）。⚠️ 並びを CSV と同じに保つため', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'g', '区分（鹿児島 / 九州の地銀 / 福岡・佐賀・長崎 / 労金・JA / ネット銀行 / メガ・フラット35）', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'id', '商品ID（loan_product.id と同じ体系。例: kagin）', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'fi', '金融機関名', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'plan', 'プラン名', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'rtype', '金利タイプ（変動 / 固定期間選択 / 全期間固定）', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'term', '固定期間（年）。変動は空', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'feeType', '手数料・保証料の型（手数料定率 / 保証料一括 …）', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'dan', '団信（一般 / がん / 8大疾病 …）', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'cond', '条件（どの金利を採ったか）', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'rate', '適用金利（%）。⚠️ 空なら NULL', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'base', '店頭（基準）金利（%）', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'prev', '前月の適用金利（%）。⚠️ 前月に無いプランは NULL', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'asof', '金融機関側の適用日（例: 2026/11/02）', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'url', '出典の URL', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'conf', '値の確かさ（official = 公式 / calc = 計算 / comparison = 比較サイト）', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'created_by', '登録した人（初期データは seed）', '改修', '2.2.301', NOW()),
  ('loan_plan_rate', 'created_at', '登録日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- loan_product：住宅ローン商品（資金計画書）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('loan_product', '住宅ローン商品（資金計画書）', 'common', '資金計画書の比較表に出す住宅ローン商品。1行が1商品。v2.2.168（backend/scripts/sql/2026-10-06_loan_rate.sql）。金利そのものは loan_rate に持つ。
② loanRate.ts：loan_rate_upload（Master だけ。画面 header/system/UploadLoan.tsx の CSV）が登録・更新し、loan_rate_latest（全員）が計画書に返す。
⚠️ 列名・キー名は資金計画書の LOANS と同じ（fi・pn など）。改名しない。
⚠️ 行は消さない（過去の金利の参照元）。出さないときは active = 0。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'loan_product' AND column_name NOT IN ('id', 'g', 'fi', 'pn', 'type', 'url', 'sort', 'active', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('loan_product', 'id', '商品ID（LOANS の id。例: kagin / flat35）。⚠️ 変えると計画書の比較表と照合できなくなる', '改修', '2.2.301', NOW()),
  ('loan_product', 'g', '区分（鹿児島 / 九州の地銀 / 福岡・佐賀・長崎 / 労金・JA / ネット銀行 / メガ・フラット35）', '改修', '2.2.301', NOW()),
  ('loan_product', 'fi', '金融機関名（例: 鹿児島銀行）。⚠️ 一括更新（金融機関名=金利）の照合キーにもなる', '改修', '2.2.301', NOW()),
  ('loan_product', 'pn', '商品名（例: 住宅ローン（変動））', '改修', '2.2.301', NOW()),
  ('loan_product', 'type', '金利タイプ。v = 変動 / f = 固定', '改修', '2.2.301', NOW()),
  ('loan_product', 'url', '公式サイト', '改修', '2.2.301', NOW()),
  ('loan_product', 'sort', '並び順（小さいほど上）', '改修', '2.2.301', NOW()),
  ('loan_product', 'active', '1 = 計画書に出す / 0 = 出さない（⚠️ 行は消さない。過去の金利の参照元になるため）', '改修', '2.2.301', NOW()),
  ('loan_product', 'created_at', '登録日時', '改修', '2.2.301', NOW()),
  ('loan_product', 'updated_at', '更新日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- loan_rate：住宅ローン金利（資金計画書）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('loan_rate', '住宅ローン金利（資金計画書）', 'common', '資金計画書で使う住宅ローン商品ごとの金利と手数料。1行が「1商品 × 1基準日」の登録。v2.2.168（backend/scripts/sql/2026-10-06_loan_rate.sql）。
② loanRate.ts：loan_rate_upload（Master だけ。UploadLoan.tsx の CSV）が登録して確定し、loan_rate_latest が商品ごとの最新の確定済みの行を返す。
⚠️ 確定（confirmed_at）していない行は下書きで、計画書には出さない。
⚠️ 顧客の計画書（funding_plan.loans）は保存時点の金利を持つ。ここを直しても過去の計画書の数字は動かない。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'loan_rate' AND column_name NOT IN ('no', 'id', 'base_date', 'rate', 'asof', 'fee', 'feeMode', 'feeVal', 'hosho', 'hoshoVal', 'dan', 'note', 'warn', 'source', 'confirmed_at', 'confirmed_by', 'created_by', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('loan_rate', 'no', '連番', '改修', '2.2.301', NOW()),
  ('loan_rate', 'id', '商品ID（loan_product.id）', '改修', '2.2.301', NOW()),
  ('loan_rate', 'base_date', '基準日（この金利をいつ時点のものとして登録したか）。⚠️ HTML の ln_asof にあたる', '改修', '2.2.301', NOW()),
  ('loan_rate', 'rate', '金利（%）。例: 0.875', '改修', '2.2.301', NOW()),
  ('loan_rate', 'asof', '金融機関側の適用月の表記（LOANS の asof。例: 2026/8）', '改修', '2.2.301', NOW()),
  ('loan_rate', 'fee', '事務手数料の表記（例: 借入額×2.2%）', '改修', '2.2.301', NOW()),
  ('loan_rate', 'feeMode', 'rate = 借入額×feeVal% / fixed = feeVal 円', '改修', '2.2.301', NOW()),
  ('loan_rate', 'feeVal', '事務手数料の値（feeMode による。% または 円）', '改修', '2.2.301', NOW()),
  ('loan_rate', 'hosho', '保証料の表記', '改修', '2.2.301', NOW()),
  ('loan_rate', 'hoshoVal', '保証料（円）。⚠️ 試算では事務手数料に足される', '改修', '2.2.301', NOW()),
  ('loan_rate', 'dan', '団信の表記', '改修', '2.2.301', NOW()),
  ('loan_rate', 'note', '備考（優遇条件など）', '改修', '2.2.301', NOW()),
  ('loan_rate', 'warn', '注意書き（画面で目立たせる）', '改修', '2.2.301', NOW()),
  ('loan_rate', 'source', '出典（例: 各金融機関公式サイト（2026年8月時点））。⚠️ HTML の ln_source にあたる', '改修', '2.2.301', NOW()),
  ('loan_rate', 'confirmed_at', '確定日時。⚠️ NULL の行は下書きで、計画書には出さない', '改修', '2.2.301', NOW()),
  ('loan_rate', 'confirmed_by', '確定した人（staff の名前）', '改修', '2.2.301', NOW()),
  ('loan_rate', 'created_by', '登録した人（staff の名前。初期投入は system）', '改修', '2.2.301', NOW()),
  ('loan_rate', 'created_at', '登録日時', '改修', '2.2.301', NOW()),
  ('loan_rate', 'updated_at', '更新日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- login_log：ログインの記録（旧）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('login_log', 'ログインの記録（旧）', 'common', 'Dashboard にログインした1回が1行。① の handlers/login.php がログインのたびに書く（2025-05 から）。
⚠️ 書くだけで、読む画面・処理は無い。request ''login_log''（ActiveUser.tsx）の名前は同じだが、読むのは staff.heartbeat で、この表ではない。
⚠️ 列がすべて text で、日時も文字列。ログインの記録を見るなら security_log（event = login。v2.2.242〜）のほうが詳しい。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'login_log' AND column_name NOT IN ('id', 'timestamp', 'staff');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('login_log', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('login_log', 'timestamp', 'ログインした日時の文字列（''YYYY/MM/DD HH:MM''。① のサーバーの時刻）', '改修', '2.2.301', NOW()),
  ('login_log', 'staff', 'ログインした人の名前（staff.name）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- maillist：顧客のメール配信先の写し
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('maillist', '顧客のメール配信先の写し', 'order', '（推定）注文住宅の顧客のメールアドレスの一覧（メール配信用に書き出した写し）。1行が1人。
コードからの使用箇所なし（推定：2025/03 ごろに顧客DB から書き出した）。
2236件のうち2184件は id が顧客DB（master_data）の id と一致する。日付は 2025年03月06日まで。
⚠️ 個人情報を含む。使わないなら整理の対象（推定）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'maillist' AND column_name NOT IN ('name', 'id', 'date', 'shop', 'staff', 'mail');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('maillist', 'name', '顧客名', '推論', '2.2.301', NOW()),
  ('maillist', 'id', '顧客の id（master_data.id と同じ ULID）', '推論', '2.2.301', NOW()),
  ('maillist', 'date', '（推定）登録日（例 2025年03月06日）', '推論', '2.2.301', NOW()),
  ('maillist', 'shop', '担当店舗（例 DJH霧島店）', '推論', '2.2.301', NOW()),
  ('maillist', 'staff', '担当営業', '推論', '2.2.301', NOW()),
  ('maillist', 'mail', 'メールアドレス', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- master_data：注文住宅の顧客
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('master_data', '注文住宅の顧客', 'order', '注文住宅事業の顧客台帳。1行＝1顧客（id は ULID 形式の文字列で、建売 master_data_kaeru・中古 master_data_resale と重複しない）。
もとは PGクラウド（顧客管理）から取り込んだ表で、列名はその書き出しの名前のまま。customized_input_01J…・step_migration_item_01J… の意味は DB のコメントか、コードの別名（analysis/columns.ts・interviewKpi.ts）で見る。
書くのは顧客の編集（InformationEdit.tsx → ② information の customer_info、① information_order_update.php）、商談ステップの保存（interviewLog・interviewKpi.ts が工程の日付を入れる）、反響の取り込み（sync → inquiry_update:new_customer）、面談前アンケート（survey/public.ts）、資金計画書など。読むのは顧客DB（DatabaseOrder.tsx）・店舗別／顧客推移・ランク・会社実績・分析 API など多数。
⚠️ 全列が text で、日付は「YYYY/MM/DD」と「YYYY-MM-DD」が混在する（集計は analysis/columns.ts の asDate で正規化する）。
⚠️ step_migration_item_* は DB のコメントと運用が食い違う。第二面談は 01JSENACS…（コメントは「※次回アポ」）。注文では 01JV6AVXQ…・01JP74NG…・01JV6AVXR4… を使わない（記憶メモ master-data-step-columns-to-avoid.md）。
⚠️ 同じ列名でも建売・中古の表では意味が違う（例 01J82Z5F1RR18… は注文＝契約日、建売＝申込日）。
⚠️ 変更の履歴は master_data_log に積む。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'master_data' AND column_name NOT IN ('no', 'id', 'date', 'customer_contacts_name', 'in_charge_store', 'in_charge_user', 'reaction_date', 'first_interviewed_date', 'full_address', 'sales_promotion_name', 'status', 'category', 'has_owned_land', 'customer_contacts_name_kana', 'customer_tags', 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', 'customized_input_01J95TC6KEES87F0YXH29AJP7K', 'customized_input_01JRCT12N9X24PCQ5QZPAYKB93', 'customized_input_01JRF9CZSW65A151WR30NA4PB3', 'customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', 'customized_input_01JSE7H4MQES619NBWX6PQDFRH', 'customized_input_01JSE7RNV3VK78YC2GYAG0554D', 'customer_contacts_phone_number', 'customer_contacts_mobile_phone_number', 'customer_contacts_email', 'line_id', 'url_params', 'landing_params', 'customer_contacts_gender', 'customer_contacts_birth_date', 'customer_contacts_employment_type', 'customer_contacts_employer_name', 'customer_contacts_employer_address', 'customer_contacts_years_of_service', 'customer_contacts_annual_income', 'customer_contacts_count', 'elementary_school_id', 'junior_high_school_id', 'postal_code', 'extra_address_info', 'current_contract_type', 'current_utility_costs', 'current_rent', 'budget', 'land_budget', 'desired_purchase_date', 'repayment_years', 'bonus_repayment_amount', 'current_loan_status', 'remarks', 'brand', 'first_interviewed_user', 'last_action_step_migration_item_name', 'last_action_step_migration_item_date', 'upcoming_date', 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV', 'introduction_person_name', 'introduction_person_category', 'introduction_date', 'created_by_name', 'updated_by_name', 'created_at', 'updated_at', 'customer_contacts_preferred_method_of_contact', 'customer_contacts_preferred_contact_time', 'customer_contacts_holiday_list', 'customer_contacts_commute', 'customer_contacts_homecoming_time', 'customer_contacts_parents_place_info', 'email_subscription_status', 'monthly_repayment_amount', 'self_budget', 'budget_reason', 'desired_purchase_date_reason', 'current_loan_balance', 'current_monthly_repayment_amount', 'house_hunting_motivation', 'discovered_reason_name', 'inquiry_reason', 'desired_property_category2', 'desired_elementary_school1', 'desired_elementary_school2', 'desired_elementary_school3', 'desired_junior_high_school1', 'desired_junior_high_school2', 'desired_junior_high_school3', 'desired_land_area', 'desired_occupancy_area', 'desired_area1_postal_code', 'desired_area1_address', 'desired_area2_postal_code', 'desired_area2_address', 'desired_area3_postal_code', 'desired_area3_address', 'desired_nearby_station1_line_name', 'desired_nearby_station1_name', 'desired_nearby_station1_distance', 'desired_nearby_station2_line_name', 'desired_nearby_station2_name', 'desired_nearby_station2_distance', 'desired_nearby_station3_line_name', 'desired_nearby_station3_name', 'desired_nearby_station3_distance', 'desired_area_reason', 'desired_floor', 'desired_layout_rooms_number', 'desired_layout_rooms_arrangement', 'desired_parking_number', 'desired_age_of_construction_max', 'desired_has_solar_power', 'planned_construction_site', 'contracted_property_id', 'contract_land_application_date', 'contract_building_application_date', 'contract_planned_date', 'contract_land_agreement_date', 'contract_building_agreement_date', 'contract_application_fee_planned_date', 'contract_payment_planned_date', 'contraction_contract_price', 'contraction_estimate_number', 'contraction_funding_plan_number', 'contraction_purchase_order_issued_date', 'additional_contraction_contract_price', 'additional_contraction_estimate_number', 'additional_contraction_funding_plan_number', 'additional_contraction_purchase_order_issued_date', 'handover_contract_price', 'handover_estimate_number', 'handover_funding_plan_number', 'handover_purchase_order_issued_date', 'customer_mortgage_examinations_status', 'customer_mortgage_examinations_application_date', 'customer_mortgage_examinations_proposal_date', 'customer_mortgage_examinations_bank_name', 'customer_mortgage_examinations_desired_loan_amount', 'memo_developer_application_company', 'memo_lawyer', 'memo_fire_insurance', 'memo_site_survey', 'memo_ground_survey', 'memo_other_related_person', 'competitor_lost_contract_date', 'competitors_text', 'competitor_name', 'competitor', 'competitor_lost_contract_reason', 'customer_desired_floor', 'customer_desired_period', 'customer_desired_estate', 'customer_desired_order', 'call_status', 'khg_id', 'desired_pref', 'show_dashboard', 'rank_period', 'step_migration_item_catalog', 'hp_campaign', 'reserved_interview', 'cancel_status', 'k_snap', 'rank_steps', 'lat_lng', 'ice_world', 'call_log', 'customer_contacts_name_2', 'customer_contacts_name_kana_2', 'planned_construction_site_2', 'planned_construction_site_3', 'sales_promotion_name_2', 'step_migration_item_01J95TGVT725FT1OLHTWBLP96Y', 'hotlead_id', 'competitor_win_reason', 'competitor_price_gap', 'competitor_sales_person', 'competitor_countermeasure', 'competitor_campaign', 'memo_marketing', 'next_action_date', 'delete_dashboard', 'portal_flag', 'portal_site');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('master_data', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('master_data', 'id', '顧客ID（ULID）。interview_sheet・call_sheet・family_info・funding_plan などの id と同じ値', '改修', '2.2.301', NOW()),
  ('master_data', 'date', '（推定）PGクラウドでの登録日時。取り込み以前の行だけ入っている', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_name', '氏名①（顧客DB では customer）', '改修', '2.2.301', NOW()),
  ('master_data', 'in_charge_store', '担当店舗（shop_list.shop と同じ表記。例 KH鹿児島店）', '改修', '2.2.301', NOW()),
  ('master_data', 'in_charge_user', '担当営業（staff_list.name）', '改修', '2.2.301', NOW()),
  ('master_data', 'reaction_date', '（推定）PGクラウドの反響日。⚠️ 集計の反響日は step_migration_item_01J82Z5F13B6… を使う', '推論', '2.2.301', NOW()),
  ('master_data', 'first_interviewed_date', '初回面談日として PGクラウドから来た列。⚠️ ① の information_order_update.php は保存のたびに今日の日付を入れている。集計には使わない', '改修', '2.2.301', NOW()),
  ('master_data', 'full_address', '住所①', '改修', '2.2.301', NOW()),
  ('master_data', 'sales_promotion_name', '反響媒体（medium_list の medium。例 SUUMO・HOME''S）', '改修', '2.2.301', NOW()),
  ('master_data', 'status', '顧客の状態（見込み / 会社管理 / 失注 / 重複 / 契約済み / 解約 など）', '改修', '2.2.301', NOW()),
  ('master_data', 'category', '事業区分。「注文」と「order」の2通りが入っている（どちらも注文）', '改修', '2.2.301', NOW()),
  ('master_data', 'has_owned_land', '土地の有無（有 / 無）', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_name_kana', 'ふりがな①。⚠️ 2026-09-25 からカタカナにそろえた（Nexus 移行のため。退避は master_data_kana_backup_20260925）', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_tags', '（推定）PGクラウドのタグ（ブランド・有効などの文字列）。取り込み以後は使っていない', '推論', '2.2.301', NOW()),
  ('master_data', 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', 'ランク（Sランク〜Eランク）。顧客DB・ランク・会社実績の rank', '改修', '2.2.301', NOW()),
  ('master_data', 'customized_input_01J95TC6KEES87F0YXH29AJP7K', '面談前アンケート（面談時アンケートのメモ）', '改修', '2.2.301', NOW()),
  ('master_data', 'customized_input_01JRCT12N9X24PCQ5QZPAYKB93', '集客イベント（分析・架電一覧の event）', '改修', '2.2.301', NOW()),
  ('master_data', 'customized_input_01JRF9CZSW65A151WR30NA4PB3', '他決理由（競合負け・失注の理由）', '改修', '2.2.301', NOW()),
  ('master_data', 'customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', '重視項目', '改修', '2.2.301', NOW()),
  ('master_data', 'customized_input_01JSE7H4MQES619NBWX6PQDFRH', '他決理由メモ欄（reason_detail）', '改修', '2.2.301', NOW()),
  ('master_data', 'customized_input_01JSE7RNV3VK78YC2GYAG0554D', '契約スケジュール（月内 / 1か月後 / 3か月後 / 1年以上後 など。databaseList.ts）', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_phone_number', '電話番号②（固定電話など）', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_mobile_phone_number', '電話番号①（携帯。顧客DB の phone_number）', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_email', 'メールアドレス①', '改修', '2.2.301', NOW()),
  ('master_data', 'line_id', 'LINE ID', '改修', '2.2.301', NOW()),
  ('master_data', 'url_params', 'フォームを送信したページのURLパラメータ（?以降）', '改修', '2.2.301', NOW()),
  ('master_data', 'landing_params', '最後に見たパラメータ付きページのURLパラメータ（?以降）。広告運用 API の customers に出す', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_gender', '性別（PGクラウド由来）', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_birth_date', '生年月日', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_employment_type', '雇用形態', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_employer_name', '勤務先名', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_employer_address', '勤務先住所', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_years_of_service', '勤続年数', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_annual_income', '年収', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_count', '（推定）PGクラウドの家族人数（「0人」「1人」…）。家族は family_info を使う', '推論', '2.2.301', NOW()),
  ('master_data', 'elementary_school_id', '（推定）PGクラウドの小学校区ID', '推論', '2.2.301', NOW()),
  ('master_data', 'junior_high_school_id', '（推定）PGクラウドの中学校区ID', '推論', '2.2.301', NOW()),
  ('master_data', 'postal_code', '郵便番号', '改修', '2.2.301', NOW()),
  ('master_data', 'extra_address_info', 'メールアドレス②（列名は住所の補足だが、メール②として使っている）', '改修', '2.2.301', NOW()),
  ('master_data', 'current_contract_type', '現居契約形態（賃貸(アパート) / 持家(戸建) など）', '改修', '2.2.301', NOW()),
  ('master_data', 'current_utility_costs', '現居光熱費（資金計画書の電気代の初期値）', '改修', '2.2.301', NOW()),
  ('master_data', 'current_rent', '現居家賃', '改修', '2.2.301', NOW()),
  ('master_data', 'budget', '予算総額', '改修', '2.2.301', NOW()),
  ('master_data', 'land_budget', '土地予算', '改修', '2.2.301', NOW()),
  ('master_data', 'desired_purchase_date', '購入希望時期（PGクラウド由来）', '推論', '2.2.301', NOW()),
  ('master_data', 'repayment_years', '返済年数', '改修', '2.2.301', NOW()),
  ('master_data', 'bonus_repayment_amount', 'ボーナス返済額（PGクラウド由来）', '推論', '2.2.301', NOW()),
  ('master_data', 'current_loan_status', '現在の借入状況（PGクラウド由来）', '推論', '2.2.301', NOW()),
  ('master_data', 'remarks', '備考', '改修', '2.2.301', NOW()),
  ('master_data', 'brand', 'ブランド（国分ハウジング / デイジャストハウス / PG HOUSE / なごみ工務店 など）', '改修', '2.2.301', NOW()),
  ('master_data', 'first_interviewed_user', '旧担当（担当を変えたときの前の担当営業）', '改修', '2.2.301', NOW()),
  ('master_data', 'last_action_step_migration_item_name', '担当変更理由（DB コメント）。⚠️ PGクラウドから来た行は最終アクション名（反響(名簿取得)・初回面談 など）が入っている', '改修', '2.2.301', NOW()),
  ('master_data', 'last_action_step_migration_item_date', 'PGクラウドの最終アクション日', '推論', '2.2.301', NOW()),
  ('master_data', 'upcoming_date', '（推定）PGクラウドの次回予定日', '推論', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', '反響取得日（集計の反響日・顧客DB の register）', '改修', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z', '通電日', '改修', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', '初回面談日（来場日。顧客DB の interview）', '改修', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', 'LINEグループ作成日', '改修', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0', 'DB コメントは「第二面談」。⚠️ 注文では使わない（第二面談は 01JSENACS…）。① core/kpi.php の KPI_MD_NEXT_IV だけがこれを見ている', '改修', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', '事前審査日', '改修', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG', '物件案内日。⚠️ 注文では使わない（入力ほぼ無し）', '改修', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW', '2回目以降面談（PGクラウドの項目）。⚠️ 注文では使わない', '改修', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', '第二面談日（商談ステップの「2回目以降面談」）。⚠️ DB コメントは「※次回アポ」だが運用は第二面談', '改修', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', '契約日', '改修', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22', '0次接客日', '改修', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV', '（推定）PGクラウドの工程の日付。注文ではほぼ空で使っていない（建売では現金確認、中古では2回目以降物件案内／査定アポ）', '推論', '2.2.301', NOW()),
  ('master_data', 'introduction_person_name', '紹介者の名前', '推論', '2.2.301', NOW()),
  ('master_data', 'introduction_person_category', '紹介者の区分（オーナー様 / SUUMOカウンター / 社員 / 協力業者 など）', '改修', '2.2.301', NOW()),
  ('master_data', 'introduction_date', '紹介日', '推論', '2.2.301', NOW()),
  ('master_data', 'created_by_name', 'PGクラウドでの作成者', '推論', '2.2.301', NOW()),
  ('master_data', 'updated_by_name', 'PGクラウドでの最終更新者', '推論', '2.2.301', NOW()),
  ('master_data', 'created_at', 'PGクラウドでの作成日時', '推論', '2.2.301', NOW()),
  ('master_data', 'updated_at', 'PGクラウドでの最終更新日時。⚠️ Dashboard で直しても変わらない', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_preferred_method_of_contact', '希望の連絡方法', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_preferred_contact_time', '希望の連絡時間帯', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_holiday_list', '休日', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_commute', '通勤手段・時間', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_homecoming_time', '帰宅時間', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_parents_place_info', '実家の場所', '推論', '2.2.301', NOW()),
  ('master_data', 'email_subscription_status', 'メール配信の状態（購読中 / 購読停止 / 契約後購読）。PGクラウド由来', '推論', '2.2.301', NOW()),
  ('master_data', 'monthly_repayment_amount', '月々支払予算', '改修', '2.2.301', NOW()),
  ('master_data', 'self_budget', '自己資金', '改修', '2.2.301', NOW()),
  ('master_data', 'budget_reason', '予算の根拠', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_purchase_date_reason', '購入希望時期の理由', '推論', '2.2.301', NOW()),
  ('master_data', 'current_loan_balance', '負債総額（現在の借入残高）', '改修', '2.2.301', NOW()),
  ('master_data', 'current_monthly_repayment_amount', '現在の月々返済額', '推論', '2.2.301', NOW()),
  ('master_data', 'house_hunting_motivation', '建築動機（チェックボックスの値をカンマ区切り）', '改修', '2.2.301', NOW()),
  ('master_data', 'discovered_reason_name', '当社を知ったきっかけ（PGクラウド由来）', '推論', '2.2.301', NOW()),
  ('master_data', 'inquiry_reason', '問い合せのきっかけ（チェックボックスの値をカンマ区切り）', '改修', '2.2.301', NOW()),
  ('master_data', 'desired_property_category2', '希望物件種別②', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_elementary_school1', '希望小学校区①', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_elementary_school2', '希望小学校区②', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_elementary_school3', '希望小学校区③', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_junior_high_school1', '希望中学校区①', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_junior_high_school2', '希望中学校区②', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_junior_high_school3', '希望中学校区③', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_land_area', '希望土地面積', '改修', '2.2.301', NOW()),
  ('master_data', 'desired_occupancy_area', '希望延床面積', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_area1_postal_code', '希望エリア①の郵便番号', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_area1_address', '希望エリア①', '改修', '2.2.301', NOW()),
  ('master_data', 'desired_area2_postal_code', '希望エリア②の郵便番号', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_area2_address', '希望エリア②', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_area3_postal_code', '希望エリア③の郵便番号', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_area3_address', '希望エリア③', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_nearby_station1_line_name', '希望最寄り駅①の路線', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_nearby_station1_name', '希望最寄り駅①', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_nearby_station1_distance', '希望最寄り駅①からの距離', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_nearby_station2_line_name', '希望最寄り駅②の路線', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_nearby_station2_name', '希望最寄り駅②', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_nearby_station2_distance', '希望最寄り駅②からの距離', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_nearby_station3_line_name', '希望最寄り駅③の路線', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_nearby_station3_name', '希望最寄り駅③', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_nearby_station3_distance', '希望最寄り駅③からの距離', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_area_reason', '希望エリアの理由', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_floor', '希望の階数', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_layout_rooms_number', '希望の部屋数', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_layout_rooms_arrangement', '希望の間取り', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_parking_number', '希望の駐車台数', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_age_of_construction_max', '希望の築年数の上限', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_has_solar_power', '太陽光の希望（有 / 無）', '改修', '2.2.301', NOW()),
  ('master_data', 'planned_construction_site', '建設予定地（入居希望地①）', '改修', '2.2.301', NOW()),
  ('master_data', 'contracted_property_id', '（推定）契約した物件のID。ほぼ空', '推論', '2.2.301', NOW()),
  ('master_data', 'contract_land_application_date', 'DB コメントは「※リフォーム粗利見込」（中古の表と共通のコメント）。（推定）注文では土地申込日。ほぼ空', '改修', '2.2.301', NOW()),
  ('master_data', 'contract_building_application_date', 'DB コメントは「※仲介粗利見込」（中古の表と共通のコメント）。（推定）注文では建物申込日。ほぼ空', '改修', '2.2.301', NOW()),
  ('master_data', 'contract_planned_date', '（推定）契約予定日。⚠️ 文字列 "undefined" が多数入っている（画面の不具合の名残）', '推論', '2.2.301', NOW()),
  ('master_data', 'contract_land_agreement_date', '土地の契約日', '推論', '2.2.301', NOW()),
  ('master_data', 'contract_building_agreement_date', '建物の契約日', '推論', '2.2.301', NOW()),
  ('master_data', 'contract_application_fee_planned_date', '申込金の入金予定日', '推論', '2.2.301', NOW()),
  ('master_data', 'contract_payment_planned_date', '入金予定日', '推論', '2.2.301', NOW()),
  ('master_data', 'contraction_contract_price', '契約金額（会社実績の中古では粗利額として読む）', '改修', '2.2.301', NOW()),
  ('master_data', 'contraction_estimate_number', '契約時の見積番号', '推論', '2.2.301', NOW()),
  ('master_data', 'contraction_funding_plan_number', '契約時の資金計画番号', '推論', '2.2.301', NOW()),
  ('master_data', 'contraction_purchase_order_issued_date', '契約時の発注日', '推論', '2.2.301', NOW()),
  ('master_data', 'additional_contraction_contract_price', '追加契約の金額', '推論', '2.2.301', NOW()),
  ('master_data', 'additional_contraction_estimate_number', '追加契約の見積番号', '推論', '2.2.301', NOW()),
  ('master_data', 'additional_contraction_funding_plan_number', '追加契約の資金計画番号', '推論', '2.2.301', NOW()),
  ('master_data', 'additional_contraction_purchase_order_issued_date', '追加契約の発注日', '推論', '2.2.301', NOW()),
  ('master_data', 'handover_contract_price', '引渡時の金額', '推論', '2.2.301', NOW()),
  ('master_data', 'handover_estimate_number', '引渡時の見積番号', '推論', '2.2.301', NOW()),
  ('master_data', 'handover_funding_plan_number', '引渡時の資金計画番号', '推論', '2.2.301', NOW()),
  ('master_data', 'handover_purchase_order_issued_date', '引渡時の発注日', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_mortgage_examinations_status', '住宅ローン審査の状態', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_mortgage_examinations_application_date', '住宅ローン審査の申込日', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_mortgage_examinations_proposal_date', '住宅ローン審査の提案日', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_mortgage_examinations_bank_name', '審査の金融機関', '推論', '2.2.301', NOW()),
  ('master_data', 'customer_mortgage_examinations_desired_loan_amount', '希望借入額', '推論', '2.2.301', NOW()),
  ('master_data', 'memo_developer_application_company', 'メモ（開発申請の会社）', '推論', '2.2.301', NOW()),
  ('master_data', 'memo_lawyer', 'メモ（司法書士）', '推論', '2.2.301', NOW()),
  ('master_data', 'memo_fire_insurance', 'メモ（火災保険）', '推論', '2.2.301', NOW()),
  ('master_data', 'memo_site_survey', 'メモ（現地調査）', '推論', '2.2.301', NOW()),
  ('master_data', 'memo_ground_survey', 'メモ（地盤調査）', '推論', '2.2.301', NOW()),
  ('master_data', 'memo_other_related_person', '架電用メモ（列名は「その他関係者メモ」だが架電のメモとして使う）', '改修', '2.2.301', NOW()),
  ('master_data', 'competitor_lost_contract_date', '解約発生日', '改修', '2.2.301', NOW()),
  ('master_data', 'competitors_text', '競合リスト（検討中の他社）', '改修', '2.2.301', NOW()),
  ('master_data', 'competitor_name', '競合負けの相手（契約した他社）', '改修', '2.2.301', NOW()),
  ('master_data', 'competitor', '（推定）PGクラウドの競合。ほぼ空', '推論', '2.2.301', NOW()),
  ('master_data', 'competitor_lost_contract_reason', '失注（競合負け）の理由', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_desired_floor', '新築計画（新築平屋 / 新築2階建て / 建て替え… など）', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_desired_period', '入居時期', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_desired_estate', '土地の状況', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_desired_order', '（推定）注文住宅を選ぶ理由など。ほぼ空（建築動機と同じ選択肢の値が少し入っている）', '推論', '2.2.301', NOW()),
  ('master_data', 'call_status', '架電状況（call_status 表の status。未通電 / 継続 / 架電停止 / 来場アポ など）', '改修', '2.2.301', NOW()),
  ('master_data', 'khg_id', '（推定）KHG の会員・反響の番号。4〜6桁の数字が入る', '推論', '2.2.301', NOW()),
  ('master_data', 'desired_pref', '希望の県。全件空', '推論', '2.2.301', NOW()),
  ('master_data', 'show_dashboard', '1 = 表示 / 0 = ゴミ箱（顧客DB の trash）。集計は 1 だけを数える', '改修', '2.2.301', NOW()),
  ('master_data', 'rank_period', 'ランクの見込み時期（契約見込み月。例 2026/12）', '改修', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_catalog', '資料送付日（商談ステップ「資料送付」）', '改修', '2.2.301', NOW()),
  ('master_data', 'hp_campaign', 'HP のキャンペーン名（キャンペーンフォームからの反響。入っていれば HP 反響として数える）', '改修', '2.2.301', NOW()),
  ('master_data', 'reserved_interview', '来場予約日（未来場・来場キャンセルの判定に使う）', '改修', '2.2.301', NOW()),
  ('master_data', 'cancel_status', '来場キャンセルの理由（不明 / 0次面談でお断り / 急用 など）', '改修', '2.2.301', NOW()),
  ('master_data', 'k_snap', 'K-SNAP の登録コード（information_k-snap.php が k-snap_customer と一緒に入れる）。⚠️ 値を外に出さない', '改修', '2.2.301', NOW()),
  ('master_data', 'rank_steps', 'ランクの判定項目（事前審査提出・LINE等で連絡可 などのチェック。JSON 配列の文字列）', '改修', '2.2.301', NOW()),
  ('master_data', 'lat_lng', '住所から取った緯度経度（customer_address.php が入れる。取れないときは「取得不可」）。地図画面で使う', '改修', '2.2.301', NOW()),
  ('master_data', 'ice_world', 'ぶるぶるアイスワールドの利用予約日時（calendar/IceWorld.tsx、① ice_world.php）', '改修', '2.2.301', NOW()),
  ('master_data', 'call_log', '架電回数（数値の文字列）。⚠️ 架電の記録そのものは call_sheet.call_log', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_name_2', '氏名②', '改修', '2.2.301', NOW()),
  ('master_data', 'customer_contacts_name_kana_2', 'ふりがな②', '改修', '2.2.301', NOW()),
  ('master_data', 'planned_construction_site_2', '入居希望地②。注文では全件 NULL（建売・中古の表と同じ形にするための列）', '推論', '2.2.301', NOW()),
  ('master_data', 'planned_construction_site_3', '入居希望地③。注文では全件 NULL', '推論', '2.2.301', NOW()),
  ('master_data', 'sales_promotion_name_2', '販促媒体②。注文では全件 NULL', '推論', '2.2.301', NOW()),
  ('master_data', 'step_migration_item_01J95TGVT725FT1OLHTWBLP96Y', 'DB コメントは中古の「2回目以降物件案内」。注文では全件 NULL', '推論', '2.2.301', NOW()),
  ('master_data', 'hotlead_id', 'ホットロード用ID', '改修', '2.2.301', NOW()),
  ('master_data', 'competitor_win_reason', '勝因。契約済みのとき必須', '改修', '2.2.301', NOW()),
  ('master_data', 'competitor_price_gap', '競合との価格差（万円）。入力値そのまま。契約済み=任意／失注=必須', '改修', '2.2.301', NOW()),
  ('master_data', 'competitor_sales_person', '競合の営業担当。任意', '改修', '2.2.301', NOW()),
  ('master_data', 'competitor_countermeasure', '今後の対策。競合負けのとき必須', '改修', '2.2.301', NOW()),
  ('master_data', 'competitor_campaign', '他社のキャンペーン。任意', '改修', '2.2.301', NOW()),
  ('master_data', 'memo_marketing', 'マーケ用メモ欄。面談シートの上部から入力する（架電用メモとは別）', '改修', '2.2.301', NOW()),
  ('master_data', 'next_action_date', '次回アクション日（商談ステップの最新の予定日。v2.2.175〜。毎日の行動で使う）', '改修', '2.2.301', NOW()),
  ('master_data', 'delete_dashboard', '1 = 個人情報削除で削除済み（v2.2.229）。顧客DB に出さない。⚠️ show_dashboard（ゴミ箱）とは別', '改修', '2.2.301', NOW()),
  ('master_data', 'portal_flag', 'ポータルサイトからの反響なら1（v2.2.281）', '改修', '2.2.301', NOW()),
  ('master_data', 'portal_site', 'ポータルサイト名（SUUMO など。v2.2.281）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- master_data_kaeru：建売の顧客
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('master_data_kaeru', '建売の顧客', 'spec', '建売（かえるホーム）の顧客台帳。1行＝顧客1人（id が顧客ID）。注文の master_data と同じ系統の列（元は PG CLOUD の書き出しの列名）。
書くもの：反響一覧（ListKaeru.tsx）の取り込み（① list_kaeru_sync.php・② features/list/save.ts）、顧客の編集（InformationEditKaeru.tsx → information_spec_add／update・② information/save.ts）、商談ステップ（② interviewKpi.ts の SPEC_MAP）、ランク・名寄せ・個人情報削除（privacy.ts）、紹介・アンバサダーの取り込み（inquirySync.ts）、住所の経緯度（customer_address.php）。
読むもの：顧客DB（DatabaseKaeru.tsx・database/list.ts）、販促媒体別・店舗別の集計（CustomerKaeru・ShopKaeru・customerTrend・shopTrend）、地図、物件DB、要確認（dailyAction.ts）、日報など。
⚠️ 同じ step_migration_item_* でも注文と意味が違う列がある（01J82Z5F1RR18… は注文＝契約日／建売＝申込日。建売の契約は 01JP74NGRTT95…）。⚠️ DB のコメントより interviewKpi.ts の対応表が正。
⚠️ 書ける列は information/masterDataColumns.ts（元は ① core/allowed_columns.php）で絞る。注文にしか無い列（勝因・敗因の5列・url_params など）を送ると保存が失敗する。
⚠️ in_charge_store は「鹿児島1係」のような係名。category は「建売」と「spec」の表記が混在する（一覧はテーブル単位なので絞りに使わない）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'master_data_kaeru' AND column_name NOT IN ('no', 'id', 'date', 'customer_contacts_name', 'in_charge_store', 'in_charge_user', 'reaction_date', 'first_interviewed_date', 'full_address', 'sales_promotion_name', 'status', 'category', 'has_owned_land', 'customer_contacts_name_kana', 'customer_tags', 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', 'customized_input_01J95TC6KEES87F0YXH29AJP7K', 'customized_input_01JRCT12N9X24PCQ5QZPAYKB93', 'customized_input_01JRF9CZSW65A151WR30NA4PB3', 'customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', 'customized_input_01JSE7H4MQES619NBWX6PQDFRH', 'customized_input_01JSE7RNV3VK78YC2GYAG0554D', 'customer_contacts_phone_number', 'customer_contacts_mobile_phone_number', 'customer_contacts_email', 'line_id', 'customer_contacts_gender', 'customer_contacts_birth_date', 'customer_contacts_employment_type', 'customer_contacts_employer_name', 'customer_contacts_employer_address', 'customer_contacts_years_of_service', 'customer_contacts_annual_income', 'customer_contacts_count', 'elementary_school_id', 'junior_high_school_id', 'postal_code', 'extra_address_info', 'current_contract_type', 'current_utility_costs', 'current_rent', 'budget', 'land_budget', 'desired_purchase_date', 'repayment_years', 'bonus_repayment_amount', 'current_loan_status', 'remarks', 'brand', 'first_interviewed_user', 'last_action_step_migration_item_name', 'last_action_step_migration_item_date', 'upcoming_date', 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV', 'introduction_person_name', 'introduction_person_category', 'introduction_date', 'created_by_name', 'updated_by_name', 'created_at', 'updated_at', 'customer_contacts_preferred_method_of_contact', 'customer_contacts_preferred_contact_time', 'customer_contacts_holiday_list', 'customer_contacts_commute', 'customer_contacts_homecoming_time', 'customer_contacts_parents_place_info', 'email_subscription_status', 'monthly_repayment_amount', 'self_budget', 'budget_reason', 'desired_purchase_date_reason', 'current_loan_balance', 'current_monthly_repayment_amount', 'house_hunting_motivation', 'discovered_reason_name', 'inquiry_reason', 'desired_property_category2', 'desired_elementary_school1', 'desired_elementary_school2', 'desired_elementary_school3', 'desired_junior_high_school1', 'desired_junior_high_school2', 'desired_junior_high_school3', 'desired_land_area', 'desired_occupancy_area', 'desired_area1_postal_code', 'desired_area1_address', 'desired_area2_postal_code', 'desired_area2_address', 'desired_area3_postal_code', 'desired_area3_address', 'desired_nearby_station1_line_name', 'desired_nearby_station1_name', 'desired_nearby_station1_distance', 'desired_nearby_station2_line_name', 'desired_nearby_station2_name', 'desired_nearby_station2_distance', 'desired_nearby_station3_line_name', 'desired_nearby_station3_name', 'desired_nearby_station3_distance', 'desired_area_reason', 'desired_floor', 'desired_layout_rooms_number', 'desired_layout_rooms_arrangement', 'desired_parking_number', 'desired_age_of_construction_max', 'desired_has_solar_power', 'planned_construction_site', 'contracted_property_id', 'contract_land_application_date', 'contract_building_application_date', 'contract_planned_date', 'contract_land_agreement_date', 'contract_building_agreement_date', 'contract_application_fee_planned_date', 'contract_payment_planned_date', 'contraction_contract_price', 'contraction_estimate_number', 'contraction_funding_plan_number', 'contraction_purchase_order_issued_date', 'additional_contraction_contract_price', 'additional_contraction_estimate_number', 'additional_contraction_funding_plan_number', 'additional_contraction_purchase_order_issued_date', 'handover_contract_price', 'handover_estimate_number', 'handover_funding_plan_number', 'handover_purchase_order_issued_date', 'customer_mortgage_examinations_status', 'customer_mortgage_examinations_application_date', 'customer_mortgage_examinations_proposal_date', 'customer_mortgage_examinations_bank_name', 'customer_mortgage_examinations_desired_loan_amount', 'memo_developer_application_company', 'memo_lawyer', 'memo_fire_insurance', 'memo_site_survey', 'memo_ground_survey', 'memo_other_related_person', 'competitor_lost_contract_date', 'competitors_text', 'competitor_name', 'competitor', 'competitor_lost_contract_reason', 'customer_desired_floor', 'customer_desired_period', 'customer_desired_estate', 'customer_desired_order', 'call_status', 'khg_id', 'desired_pref', 'show_dashboard', 'rank_period', 'step_migration_item_catalog', 'hp_campaign', 'reserved_interview', 'cancel_status', 'property_name', 'property_tour_name', 'property_contract_name', 'lat_lng', 'integration', 'call_log', 'customer_contacts_name_2', 'customer_contacts_name_kana_2', 'planned_construction_site_2', 'planned_construction_site_3', 'sales_promotion_name_2', 'step_migration_item_01J95TGVT725FT1OLHTWBLP96Y', 'memo_marketing', 'next_action_date', 'landing_params', 'delete_dashboard', 'portal_flag', 'portal_site');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('master_data_kaeru', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'id', '顧客ID。反響の取り込みで作る。⚠️ 反響（inquiry_customer_kaeru.pg_id）・call_sheet・interview_sheet・master_data_log がこの値で結ぶ', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'date', '（推定）PG CLOUD 時代の登録日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_name', '氏名①（お客様名）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'in_charge_store', '担当店舗（係名。例 鹿児島1係・宮崎係）。shop_list の division = 建売分譲事業 の shop', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'in_charge_user', '担当営業。未設定のときは「<店舗> 管理」', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'reaction_date', '（推定）PG CLOUD 時代の反響日。⚠️ いまの集計は反響取得日（step_migration_item_01J82Z5F13B6…）を使う', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'first_interviewed_date', '（推定）PG CLOUD 時代の初回面談日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'full_address', '住所①', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'sales_promotion_name', '販促媒体①（反響媒体）。⚠️ medium_kaeru の媒体名が正（別名は customerKaeruUtils.ts の normalizeMedium が寄せる）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'status', '追客の状況（例 追客中・追客終了・接触（通話・返信）・来店あり・契約済み・未設定）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'category', '事業区分。「建売」と「spec」が混在', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'has_owned_land', '土地の有無', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_name_kana', 'ふりがな①', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_tags', '顧客タグ', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', '顧客ランク（Sランク〜Hランク）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customized_input_01J95TC6KEES87F0YXH29AJP7K', 'DB のコメントは「購入可能時期」。⚠️ 建売の画面は購入可能時期に 01JSE7RNV3… を使う。注文では面談時アンケート（fundingPlan の k_worry）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customized_input_01JRCT12N9X24PCQ5QZPAYKB93', '集客イベント（analysis/columns.ts）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customized_input_01JRF9CZSW65A151WR30NA4PB3', '他決理由（詳細な失注理由。lostList.ts・competitor.ts）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', '重視項目', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customized_input_01JSE7H4MQES619NBWX6PQDFRH', '敗因（負けた理由の自由記述。informationUtils.ts の LOSE_REASON_KEY）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customized_input_01JSE7RNV3VK78YC2GYAG0554D', '購入可能時期（建売の顧客の編集の欄。注文では契約スケジュール）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_phone_number', '電話番号①', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_mobile_phone_number', '電話番号②（携帯）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_email', 'メールアドレス①', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'line_id', 'LINE ID', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_gender', '性別', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_birth_date', '生年月日', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_employment_type', '雇用形態', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_employer_name', '勤務先名', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_employer_address', '勤務先住所', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_years_of_service', '勤続年数', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_annual_income', '年収', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_count', '（推定）家族の人数', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'elementary_school_id', '（推定）小学校区', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'junior_high_school_id', '（推定）中学校区', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'postal_code', '郵便番号', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'extra_address_info', 'メールアドレス②（⚠️ 列名は住所の補足だが、メールの2つ目に使っている）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'current_contract_type', '現居契約形態', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'current_utility_costs', '現居光熱費', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'current_rent', '現居家賃', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'budget', '予算総額', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'land_budget', '土地予算', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_purchase_date', '希望購入時期', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'repayment_years', '返済希望年数', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'bonus_repayment_amount', 'ボーナス返済額', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'current_loan_status', '今の借入の状況', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'remarks', '備考。反響の取り込みで反響の内容が入る', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'brand', 'ブランド（例 国分ハウジング。ほとんど空）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'first_interviewed_user', '担当営業を変えたときの変更前の担当（顧客の編集が入れる）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'last_action_step_migration_item_name', '店舗管理への変更理由（担当を「<店舗> 管理」に変えたときに選ぶ。失注・計画中止・連絡不能など）。⚠️ 列名と中身が違う', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'last_action_step_migration_item_date', '（推定）PG CLOUD 時代の最後の商談ステップの日付', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'upcoming_date', '（推定）PG CLOUD 時代の次の予定日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', '反響取得日（登録日）。反響一覧・集計の「反響」の月はこの日付', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z', '接触（通話・返信）の日', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', '初回面談（来場）の日', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', 'DB のコメントは「LINEグループ作成」。⚠️ 建売の商談ステップからは入らない（ほぼ空）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0', '仲介契約の日', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', '事前審査（顧客の編集では「ローン事前承認済み」）の日', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG', '物件案内の日（反響一覧の上の集計の tour）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW', '自社契約の日。⚠️ 建売の「契約」はこれ（注文では使わない列）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', '2回目以降面談の日', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', '申し込みの日。⚠️ 注文では契約日。建売で契約として数えない', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22', 'DB のコメントは「次回アクション予定」。⚠️ 建売の商談ステップからは入らない', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV', '事前取得（現金確認含む）の日（顧客の編集の欄）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'introduction_person_name', '紹介者の名前（お友達紹介）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'introduction_person_category', '紹介者の区分', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'introduction_date', '紹介日', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'created_by_name', '作成者', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'updated_by_name', '最終更新者', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'created_at', '作成日時（text）', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'updated_at', '更新日時（text）', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_preferred_method_of_contact', '希望の連絡方法', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_preferred_contact_time', '希望の連絡時間帯', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_holiday_list', '休日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_commute', '通勤', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_homecoming_time', '帰宅時間', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_parents_place_info', '実家の情報', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'email_subscription_status', 'メール配信の可否', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'monthly_repayment_amount', '月々支払予算', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'self_budget', '自己資金', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'budget_reason', '予算の理由', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_purchase_date_reason', '購入時期の理由', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'current_loan_balance', '負債総額', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'current_monthly_repayment_amount', '今の借入の月々返済額', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'house_hunting_motivation', '住まい探しの動機', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'discovered_reason_name', '知ったきっかけ', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'inquiry_reason', '問い合わせのきっかけ', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_property_category2', '希望の物件種別', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_elementary_school1', '希望の小学校①', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_elementary_school2', '希望の小学校②', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_elementary_school3', '希望の小学校③', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_junior_high_school1', '希望の中学校①', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_junior_high_school2', '希望の中学校②', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_junior_high_school3', '希望の中学校③', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_land_area', '希望土地面積', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_occupancy_area', '希望の居住面積', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_area1_postal_code', '希望エリア①の郵便番号', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_area1_address', '希望エリア①', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_area2_postal_code', '希望エリア②の郵便番号', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_area2_address', '希望エリア②', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_area3_postal_code', '希望エリア③の郵便番号', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_area3_address', '希望エリア③', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_nearby_station1_line_name', '希望の最寄り駅①の路線', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_nearby_station1_name', '希望の最寄り駅①', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_nearby_station1_distance', '希望の最寄り駅①までの距離', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_nearby_station2_line_name', '希望の最寄り駅②の路線', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_nearby_station2_name', '希望の最寄り駅②', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_nearby_station2_distance', '希望の最寄り駅②までの距離', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_nearby_station3_line_name', '希望の最寄り駅③の路線', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_nearby_station3_name', '希望の最寄り駅③', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_nearby_station3_distance', '希望の最寄り駅③までの距離', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_area_reason', '希望エリアの理由', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_floor', '希望の階数', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_layout_rooms_number', '希望の部屋数', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_layout_rooms_arrangement', '希望の間取り', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_parking_number', '希望の駐車台数', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_age_of_construction_max', '許容する築年数の上限', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_has_solar_power', '太陽光の希望', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'planned_construction_site', '入居希望地①（物件マッチングメールの条件）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'contracted_property_id', '（推定）契約した物件の ID', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'contract_land_application_date', 'DB のコメントは「リフォーム粗利見込」。⚠️ 建売では空（中古と同じコメントが付いている）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'contract_building_application_date', 'DB のコメントは「仲介粗利見込」。⚠️ 建売ではほぼ使っていない（推定）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'contract_planned_date', '契約予定日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'contract_land_agreement_date', '土地の契約日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'contract_building_agreement_date', '建物の契約日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'contract_application_fee_planned_date', '申込金の予定日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'contract_payment_planned_date', '支払いの予定日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'contraction_contract_price', '契約金額', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'contraction_estimate_number', '契約時の見積番号', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'contraction_funding_plan_number', '契約時の資金計画番号', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'contraction_purchase_order_issued_date', '契約時の発注日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'additional_contraction_contract_price', '追加契約の金額', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'additional_contraction_estimate_number', '追加契約の見積番号', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'additional_contraction_funding_plan_number', '追加契約の資金計画番号', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'additional_contraction_purchase_order_issued_date', '追加契約の発注日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'handover_contract_price', '引渡時の金額', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'handover_estimate_number', '引渡時の見積番号', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'handover_funding_plan_number', '引渡時の資金計画番号', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'handover_purchase_order_issued_date', '引渡時の発注日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_mortgage_examinations_status', '住宅ローン審査の状況', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_mortgage_examinations_application_date', '住宅ローン審査の申込日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_mortgage_examinations_proposal_date', '住宅ローンの提案日', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_mortgage_examinations_bank_name', '住宅ローンの銀行', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_mortgage_examinations_desired_loan_amount', '希望借入額', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'memo_developer_application_company', 'メモ（開発申請の会社）', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'memo_lawyer', 'メモ（司法書士）', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'memo_fire_insurance', 'メモ（火災保険）', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'memo_site_survey', 'メモ（現地調査）', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'memo_ground_survey', 'メモ（地盤調査）', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'memo_other_related_person', 'メモ（その他の関係者）', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'competitor_lost_contract_date', '解約発生日（ステータスが「解約」のときに入れる。TableStatus.tsx）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'competitors_text', '競合の会社（顧客の編集の「競合情報」。カンマ区切り）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'competitor_name', '他決した会社', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'competitor', '競合の有無・内容', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'competitor_lost_contract_reason', 'DB のコメントは「解約発生日」。⚠️ 画面の解約発生日は competitor_lost_contract_date に入る。この列の今の使い道は（推定）他決・解約の理由', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_desired_floor', '新築計画', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_desired_period', '入居希望時期', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_desired_estate', '土地の状況', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_desired_order', '（推定）注文住宅の希望', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'call_status', '架電状況（例 架電停止・未通電・継続・来場済み）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'khg_id', '（推定）グループ共通の顧客ID。ほぼ空', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'desired_pref', '希望の県', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'show_dashboard', '集計に数えるか。1＝表示・0＝非表示（ゴミ箱）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'rank_period', '契約見込み月（顧客ランクの横の年月）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_catalog', '資料送付の日（建売では空）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'hp_campaign', 'ホームページのキャンペーン名（反響から引き継ぐ。例 資料請求・会員登録・先取物件）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'reserved_interview', '来場予約の日（反響から引き継ぐ）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'cancel_status', 'キャンセルの扱い（要確認の「キャンセル」に出すか。空でないと出さない）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'property_name', '問い合わせ物件（カンマ区切り。物件DB の物件名）。物件DB の反響状況がこれで結ぶ', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'property_tour_name', '案内した物件', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'property_contract_name', '契約した物件', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'lat_lng', '住所の経緯度（「緯度,経度」か「取得不可」）。customer_address.php が入れる。地図が読む', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'integration', '名寄せ済みの印（1＝名寄せした）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'call_log', '架電回数（顧客の編集の保存で数を入れる）。⚠️ 架電の記録の本体は call_sheet.call_log（JSON 配列）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_name_2', '氏名②', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'customer_contacts_name_kana_2', 'ふりがな②', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'planned_construction_site_2', '入居希望地②', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'planned_construction_site_3', '入居希望地③', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'sales_promotion_name_2', '販促媒体②', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'step_migration_item_01J95TGVT725FT1OLHTWBLP96Y', '（推定）建売では使っていない（中古では2回目以降物件案内）', '推論', '2.2.301', NOW()),
  ('master_data_kaeru', 'memo_marketing', 'マーケ用メモ。面談シートの上部から入力する（架電用メモとは別）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'next_action_date', '次回アクション日（商談ステップの最新の予定日。⚠️ この列だけ一番新しい日付が入る）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'landing_params', '反響から引き継いだ流入の情報（khg_vid など。v2.2.205）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'delete_dashboard', '個人情報削除の印。1＝削除済み（伏せ字にした顧客。集計には数える。v2.2.229）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'portal_flag', 'ポータルサイトからの反響なら1（v2.2.281。② list/portal.ts が取り込みのときに立てる）', '改修', '2.2.301', NOW()),
  ('master_data_kaeru', 'portal_site', 'ポータルサイト名（SUUMO・HOME''S・athome・ALLGRIT。v2.2.281）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- master_data_kana_backup_20260925：顧客ふりがなの退避
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('master_data_kana_backup_20260925', '顧客ふりがなの退避', 'order', 'master_data（注文住宅の顧客）のふりがなをカタカナにそろえる前の写し（2026-09-25）。ひらがなを含んでいた顧客だけを id とふりがな①②で退避した。
作ったのは backend/scripts/sql/2026-09-25_kana_to_katakana.sql の手順2（Nexus へ移行するため、ふりがなをカタカナにした）。戻すときは同じファイルの戻し方の SQL で id を突き合わせる。
⚠️ 画面・処理からは使っていない（推定）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'master_data_kana_backup_20260925' AND column_name NOT IN ('id', 'customer_contacts_name_kana', 'customer_contacts_name_kana_2');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('master_data_kana_backup_20260925', 'id', '顧客ID（ULID）。interview_sheet・call_sheet・family_info・funding_plan などの id と同じ値', '改修', '2.2.301', NOW()),
  ('master_data_kana_backup_20260925', 'customer_contacts_name_kana', '変換前のふりがな①（ひらがなのまま）', '改修', '2.2.301', NOW()),
  ('master_data_kana_backup_20260925', 'customer_contacts_name_kana_2', '変換前のふりがな②（ひらがなのまま）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- master_data_log：顧客の変更履歴
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('master_data_log', '顧客の変更履歴', 'common', '顧客（注文 master_data・建売 master_data_kaeru・中古 master_data_resale）を直したときの履歴。1行＝1回の保存（または1件の変更）。
書くのは ② information の log（顧客の編集画面が保存のたびに送る）、資金計画書の保存（fundingPlan）、個人情報削除（privacy.ts。誰がいつ消したか）。① の information_log.php も同じ形で入れる。
⚠️ 上書きせず積み上げる。UNIQUE キーが無いので、同じ書き込みを2回送ると2行になる（log は ① へのフォールバック禁止に登録してある）。
⚠️ log 列の本文には "funding_plan" という語が大量に入るので、LIKE で消すと監査ログを壊す（記憶メモ master-data-log-contains-funding-plan.md）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'master_data_log' AND column_name NOT IN ('no', 'id', 'customer', 'staff', 'updated_at', 'log');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('master_data_log', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('master_data_log', 'id', '顧客ID（master_data などの id）', '改修', '2.2.301', NOW()),
  ('master_data_log', 'customer', 'そのときの顧客名', '改修', '2.2.301', NOW()),
  ('master_data_log', 'staff', '保存したスタッフ名', '改修', '2.2.301', NOW()),
  ('master_data_log', 'updated_at', '保存日時（''YYYY/MM/DD HH:mm''・日本時間。text）', '改修', '2.2.301', NOW()),
  ('master_data_log', 'log', '変更内容の説明（どの項目を何から何へ変えたか）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- master_data_planner：中古リノベ顧客の古い写し
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('master_data_planner', '中古リノベ顧客の古い写し', 'used', 'コードからの使用箇所なし（推定：中古リノベの顧客台帳 master_data_resale の古い写し。2026-08 ごろまでの約2,500行で、id はほぼすべて master_data_resale と一致し、master_data とは重ならない）。
列は master_data・master_data_resale と同じ PGクラウド由来の形で、工程の列（step_migration_item_*）の DB コメントは中古の意味（訪問査定・媒介取得・売買契約・リフォーム契約など）になっている。
名前の「planner」の由来は不明。⚠️ 画面・処理からは使っていない（推定）。開発用の個人情報マスク（backend/scripts/sql/dev/mask_personal_info.sql）の対象には入っている。
⚠️ 今の中古の顧客は master_data_resale を見る。この表を直しても画面には出ない。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'master_data_planner' AND column_name NOT IN ('no', 'id', 'date', 'customer_contacts_name', 'in_charge_store', 'in_charge_user', 'reaction_date', 'first_interviewed_date', 'full_address', 'sales_promotion_name', 'status', 'category', 'has_owned_land', 'customer_contacts_name_kana', 'customer_tags', 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', 'customized_input_01J95TC6KEES87F0YXH29AJP7K', 'customized_input_01JRCT12N9X24PCQ5QZPAYKB93', 'customized_input_01JRF9CZSW65A151WR30NA4PB3', 'customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', 'customized_input_01JSE7H4MQES619NBWX6PQDFRH', 'customized_input_01JSE7RNV3VK78YC2GYAG0554D', 'customer_contacts_phone_number', 'customer_contacts_mobile_phone_number', 'customer_contacts_email', 'customer_contacts_gender', 'customer_contacts_birth_date', 'customer_contacts_employment_type', 'customer_contacts_employer_name', 'customer_contacts_employer_address', 'customer_contacts_years_of_service', 'customer_contacts_annual_income', 'customer_contacts_count', 'elementary_school_id', 'junior_high_school_id', 'postal_code', 'extra_address_info', 'current_contract_type', 'current_utility_costs', 'current_rent', 'budget', 'land_budget', 'desired_purchase_date', 'repayment_years', 'bonus_repayment_amount', 'current_loan_status', 'remarks', 'brand', 'first_interviewed_user', 'last_action_step_migration_item_name', 'last_action_step_migration_item_date', 'upcoming_date', 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV', 'introduction_person_name', 'introduction_person_category', 'introduction_date', 'created_by_name', 'updated_by_name', 'created_at', 'updated_at', 'customer_contacts_preferred_method_of_contact', 'customer_contacts_preferred_contact_time', 'customer_contacts_holiday_list', 'customer_contacts_commute', 'customer_contacts_homecoming_time', 'customer_contacts_parents_place_info', 'email_subscription_status', 'monthly_repayment_amount', 'self_budget', 'budget_reason', 'desired_purchase_date_reason', 'current_loan_balance', 'current_monthly_repayment_amount', 'house_hunting_motivation', 'discovered_reason_name', 'inquiry_reason', 'desired_property_category2', 'desired_elementary_school1', 'desired_elementary_school2', 'desired_elementary_school3', 'desired_junior_high_school1', 'desired_junior_high_school2', 'desired_junior_high_school3', 'desired_land_area', 'desired_occupancy_area', 'desired_area1_postal_code', 'desired_area1_address', 'desired_area2_postal_code', 'desired_area2_address', 'desired_area3_postal_code', 'desired_area3_address', 'desired_nearby_station1_line_name', 'desired_nearby_station1_name', 'desired_nearby_station1_distance', 'desired_nearby_station2_line_name', 'desired_nearby_station2_name', 'desired_nearby_station2_distance', 'desired_nearby_station3_line_name', 'desired_nearby_station3_name', 'desired_nearby_station3_distance', 'desired_area_reason', 'desired_floor', 'desired_layout_rooms_number', 'desired_layout_rooms_arrangement', 'desired_parking_number', 'desired_age_of_construction_max', 'desired_has_solar_power', 'planned_construction_site', 'contracted_property_id', 'contract_land_application_date', 'contract_building_application_date', 'contract_planned_date', 'contract_land_agreement_date', 'contract_building_agreement_date', 'contract_application_fee_planned_date', 'contract_payment_planned_date', 'contraction_contract_price', 'contraction_estimate_number', 'contraction_funding_plan_number', 'contraction_purchase_order_issued_date', 'additional_contraction_contract_price', 'additional_contraction_estimate_number', 'additional_contraction_funding_plan_number', 'additional_contraction_purchase_order_issued_date', 'handover_contract_price', 'handover_estimate_number', 'handover_funding_plan_number', 'handover_purchase_order_issued_date', 'customer_mortgage_examinations_status', 'customer_mortgage_examinations_application_date', 'customer_mortgage_examinations_proposal_date', 'customer_mortgage_examinations_bank_name', 'customer_mortgage_examinations_desired_loan_amount', 'memo_developer_application_company', 'memo_lawyer', 'memo_fire_insurance', 'memo_site_survey', 'memo_ground_survey', 'memo_other_related_person', 'competitor_lost_contract_date', 'competitors_text', 'competitor_name', 'competitor', 'competitor_lost_contract_reason', 'customer_desired_floor', 'customer_desired_period', 'customer_desired_estate', 'customer_desired_order', 'call_status', 'khg_id', 'desired_pref', 'show_dashboard', 'rank_period', 'step_migration_item_catalog', 'hp_campaign', 'reserved_interview', 'cancel_status', 'property_name', 'property_tour_name', 'lat_lng', 'integration', 'call_log', 'property_contract_name', 'customer_contacts_name_2', 'customer_contacts_name_kana_2', 'planned_construction_site_2', 'planned_construction_site_3', 'sales_promotion_name_2', 'step_migration_item_01J95TGVT725FT1OLHTWBLP96Y');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('master_data_planner', 'no', '連番（自動採番）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'id', '顧客ID（ULID）。interview_sheet・call_sheet・family_info・funding_plan などの id と同じ値', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'date', '（推定）PGクラウドでの登録日時。取り込み以前の行だけ入っている', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_name', '氏名①（顧客DB では customer）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'in_charge_store', '取引区分（買い:中古リノベ / 売り:ポータル / 買い:ポータル）。中古の表と同じく店舗名ではない', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'in_charge_user', '担当営業（staff_list.name）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'reaction_date', '（推定）PGクラウドの反響日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'first_interviewed_date', '初回面談日として PGクラウドから来た列', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'full_address', '住所①', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'sales_promotion_name', '反響媒体（medium_list の medium。例 SUUMO・HOME''S）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'status', '顧客の状態（見込み / 会社管理 / 失注 / 重複 / 契約済み / 解約 など）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'category', '事業・取引区分（used / 買い:中古リノベ / 売り:ポータル など）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'has_owned_land', '土地の有無（有 / 無）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_name_kana', 'ふりがな①', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_tags', '（推定）PGクラウドのタグ（ブランド・有効などの文字列）。取り込み以後は使っていない', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', 'ランク（Sランク〜Eランク）。顧客DB・ランク・会社実績の rank', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customized_input_01J95TC6KEES87F0YXH29AJP7K', '面談前アンケート（面談時アンケートのメモ）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customized_input_01JRCT12N9X24PCQ5QZPAYKB93', '集客イベント（分析・架電一覧の event）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customized_input_01JRF9CZSW65A151WR30NA4PB3', '他決理由（競合負け・失注の理由）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', '重視項目', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customized_input_01JSE7H4MQES619NBWX6PQDFRH', '他決理由メモ欄（reason_detail）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customized_input_01JSE7RNV3VK78YC2GYAG0554D', '契約スケジュール（月内 / 1か月後 / 3か月後 / 1年以上後 など。databaseList.ts）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_phone_number', 'DB コメントは「※電話番号①」（注文の表と①②が逆）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_mobile_phone_number', 'DB コメントは「※電話番号②」', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_email', 'メールアドレス①', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_gender', '性別（PGクラウド由来）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_birth_date', '生年月日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_employment_type', '雇用形態', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_employer_name', '勤務先名', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_employer_address', '勤務先住所', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_years_of_service', '勤続年数', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_annual_income', '年収', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_count', '（推定）PGクラウドの家族人数（「0人」「1人」…）。家族は family_info を使う', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'elementary_school_id', '（推定）PGクラウドの小学校区ID', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'junior_high_school_id', '（推定）PGクラウドの中学校区ID', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'postal_code', '郵便番号', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'extra_address_info', 'メールアドレス②（列名は住所の補足だが、メール②として使っている）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'current_contract_type', '現居契約形態（賃貸(アパート) / 持家(戸建) など）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'current_utility_costs', '現居光熱費（資金計画書の電気代の初期値）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'current_rent', '現居家賃', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'budget', '予算総額', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'land_budget', '土地予算', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_purchase_date', '購入希望時期（PGクラウド由来）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'repayment_years', '返済年数', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'bonus_repayment_amount', 'ボーナス返済額（PGクラウド由来）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'current_loan_status', '現在の借入状況（PGクラウド由来）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'remarks', '備考', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'brand', 'ブランド（国分ハウジング / デイジャストハウス / PG HOUSE / なごみ工務店 など）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'first_interviewed_user', '旧担当（担当を変えたときの前の担当営業）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'last_action_step_migration_item_name', '担当変更理由（DB コメント）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'last_action_step_migration_item_date', 'PGクラウドの最終アクション日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'upcoming_date', '（推定）PGクラウドの次回予定日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', '反響取得日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z', '通電日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', '初回面談（初回来場）日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', '訪問査定日（売り）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0', '媒介取得日（売り）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', '事前審査日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG', '物件案内日（買い）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW', '売買契約日（買い）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', 'DB コメントは「※次回アポ」。中古では2回目以降面談', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', 'リフォーム契約日（買い:中古リノベ）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22', '査定書提出日（売り）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV', '査定アポ（売り）／2回目以降物件案内（買い）。取引区分で意味が変わる', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'introduction_person_name', '紹介者の名前', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'introduction_person_category', '紹介者の区分（オーナー様 / SUUMOカウンター / 社員 / 協力業者 など）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'introduction_date', '紹介日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'created_by_name', 'PGクラウドでの作成者', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'updated_by_name', 'PGクラウドでの最終更新者', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'created_at', 'PGクラウドでの作成日時', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'updated_at', 'PGクラウドでの最終更新日時', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_preferred_method_of_contact', '希望の連絡方法', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_preferred_contact_time', '希望の連絡時間帯', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_holiday_list', '休日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_commute', '通勤手段・時間', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_homecoming_time', '帰宅時間', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_parents_place_info', '実家の場所', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'email_subscription_status', 'メール配信の状態（購読中 / 購読停止 / 契約後購読）。PGクラウド由来', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'monthly_repayment_amount', '月々支払予算', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'self_budget', '自己資金', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'budget_reason', '予算の根拠', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_purchase_date_reason', '購入希望時期の理由', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'current_loan_balance', '負債総額（現在の借入残高）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'current_monthly_repayment_amount', '現在の月々返済額', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'house_hunting_motivation', '建築動機（チェックボックスの値をカンマ区切り）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'discovered_reason_name', '当社を知ったきっかけ（PGクラウド由来）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'inquiry_reason', '問い合せのきっかけ（チェックボックスの値をカンマ区切り）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_property_category2', '希望物件種別②', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_elementary_school1', '希望小学校区①', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_elementary_school2', '希望小学校区②', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_elementary_school3', '希望小学校区③', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_junior_high_school1', '希望中学校区①', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_junior_high_school2', '希望中学校区②', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_junior_high_school3', '希望中学校区③', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_land_area', '希望土地面積', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_occupancy_area', '希望延床面積', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_area1_postal_code', '希望エリア①の郵便番号', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_area1_address', '希望エリア①', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_area2_postal_code', '希望エリア②の郵便番号', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_area2_address', '希望エリア②', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_area3_postal_code', '希望エリア③の郵便番号', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_area3_address', '希望エリア③', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_nearby_station1_line_name', '希望最寄り駅①の路線', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_nearby_station1_name', '希望最寄り駅①', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_nearby_station1_distance', '希望最寄り駅①からの距離', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_nearby_station2_line_name', '希望最寄り駅②の路線', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_nearby_station2_name', '希望最寄り駅②', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_nearby_station2_distance', '希望最寄り駅②からの距離', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_nearby_station3_line_name', '希望最寄り駅③の路線', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_nearby_station3_name', '希望最寄り駅③', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_nearby_station3_distance', '希望最寄り駅③からの距離', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_area_reason', '希望エリアの理由', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_floor', '希望の階数', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_layout_rooms_number', '希望の部屋数', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_layout_rooms_arrangement', '希望の間取り', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_parking_number', '希望の駐車台数', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_age_of_construction_max', '希望の築年数の上限', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_has_solar_power', '太陽光の希望（有 / 無）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'planned_construction_site', '建設予定地（入居希望地①）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'contracted_property_id', '（推定）契約した物件のID。ほぼ空', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'contract_land_application_date', 'リフォーム粗利見込', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'contract_building_application_date', '仲介粗利見込', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'contract_planned_date', '（推定）契約予定日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'contract_land_agreement_date', '土地の契約日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'contract_building_agreement_date', '建物の契約日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'contract_application_fee_planned_date', '申込金の入金予定日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'contract_payment_planned_date', '入金予定日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'contraction_contract_price', '予算（DB コメント）。中古の会社実績では粗利額として読む', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'contraction_estimate_number', '契約時の見積番号', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'contraction_funding_plan_number', '契約時の資金計画番号', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'contraction_purchase_order_issued_date', '契約時の発注日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'additional_contraction_contract_price', '予算詳細（DB コメント）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'additional_contraction_estimate_number', '追加契約の見積番号', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'additional_contraction_funding_plan_number', '追加契約の資金計画番号', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'additional_contraction_purchase_order_issued_date', '追加契約の発注日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'handover_contract_price', '引渡時の金額', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'handover_estimate_number', '引渡時の見積番号', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'handover_funding_plan_number', '引渡時の資金計画番号', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'handover_purchase_order_issued_date', '引渡時の発注日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_mortgage_examinations_status', '住宅ローン審査の状態', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_mortgage_examinations_application_date', '住宅ローン審査の申込日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_mortgage_examinations_proposal_date', '住宅ローン審査の提案日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_mortgage_examinations_bank_name', '審査の金融機関', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_mortgage_examinations_desired_loan_amount', '希望借入額', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'memo_developer_application_company', 'メモ（開発申請の会社）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'memo_lawyer', 'メモ（司法書士）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'memo_fire_insurance', 'メモ（火災保険）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'memo_site_survey', 'メモ（現地調査）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'memo_ground_survey', 'メモ（地盤調査）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'memo_other_related_person', '架電用メモ（列名は「その他関係者メモ」だが架電のメモとして使う）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'competitor_lost_contract_date', '解約発生日', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'competitors_text', '競合リスト（検討中の他社）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'competitor_name', '競合負けの相手（契約した他社）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'competitor', '（推定）PGクラウドの競合。ほぼ空', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'competitor_lost_contract_reason', '失注（競合負け）の理由', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_desired_floor', '新築計画（新築平屋 / 新築2階建て / 建て替え… など）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_desired_period', '入居時期', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_desired_estate', '土地の状況', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_desired_order', '（推定）注文住宅を選ぶ理由など。ほぼ空（建築動機と同じ選択肢の値が少し入っている）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'call_status', '架電状況（call_status 表の status。未通電 / 継続 / 架電停止 / 来場アポ など）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'khg_id', '（推定）KHG の会員・反響の番号。4〜6桁の数字が入る', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'desired_pref', '希望の県。全件空', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'show_dashboard', '1 = 表示 / 0 = ゴミ箱（顧客DB の trash）。集計は 1 だけを数える', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'rank_period', 'ランクの見込み時期（契約見込み月。例 2026/12）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_catalog', '資料送付日（商談ステップ「資料送付」）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'hp_campaign', 'HP のキャンペーン名（キャンペーンフォームからの反響。入っていれば HP 反響として数える）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'reserved_interview', '来場予約日（未来場・来場キャンセルの判定に使う）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'cancel_status', '来場キャンセルの理由（不明 / 0次面談でお断り / 急用 など）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'property_name', '（推定）問い合わせ・検討中の物件名', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'property_tour_name', '（推定）案内した物件名', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'lat_lng', '住所から取った緯度経度（customer_address.php が入れる。取れないときは「取得不可」）。地図画面で使う', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'integration', '（推定）1 = 顧客の統合で残した側の印（master_data_resale では integrate_used.php が入れる）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'call_log', '架電回数（数値の文字列）', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'property_contract_name', '（推定）契約した物件名。全件空', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_name_2', '氏名②', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'customer_contacts_name_kana_2', 'ふりがな②', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'planned_construction_site_2', '入居希望地②', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'planned_construction_site_3', '入居希望地③', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'sales_promotion_name_2', '販促媒体②', '推論', '2.2.301', NOW()),
  ('master_data_planner', 'step_migration_item_01J95TGVT725FT1OLHTWBLP96Y', '2回目以降物件案内', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- master_data_resale：中古リノベの顧客
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('master_data_resale', '中古リノベの顧客', 'used', '中古リノベ（国分ハウジンググループ中古住宅専門店）の顧客台帳。1行＝顧客1人（id が顧客ID）。注文の master_data・建売の master_data_kaeru と同じ系統の列。
書くもの：反響一覧（ListResale.tsx）の取り込み（① list_resale_sync.php・② features/list/save.ts）、顧客の編集（InformationEditResale.tsx → information_used_add／update・② information/save.ts）、商談ステップ（② interviewKpi.ts の RESALE_MAP）、架電キュー（② callq/usedQueue.ts）、名寄せ・個人情報削除、紹介・アンバサダーの取り込み（inquirySync.ts）、住所の経緯度（customer_address.php）。
読むもの：顧客DB（DatabaseResale.tsx）、店舗別の集計（shopTrend）、地図、物件DB（中古住宅専門店の物件）、要確認（dailyAction.ts）、日報など。
⚠️⚠️ in_charge_store に店舗名ではなく取引区分（買い:中古リノベ／売り:ポータル／買い:ポータル）が入る。商談ステップの列の意味も取引区分で変わる（下の列の説明）。
⚠️ 同じ列名でも注文・建売と中身が違う列がある（contract_land_application_date＝リフォーム粗利見込 など）。⚠️ DB のコメントより interviewKpi.ts の対応表が正。
⚠️ landing_params・portal_flag・portal_site は中古には無い（建売と注文だけ）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'master_data_resale' AND column_name NOT IN ('no', 'id', 'date', 'customer_contacts_name', 'in_charge_store', 'in_charge_user', 'reaction_date', 'first_interviewed_date', 'full_address', 'sales_promotion_name', 'status', 'category', 'has_owned_land', 'customer_contacts_name_kana', 'customer_tags', 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', 'customized_input_01J95TC6KEES87F0YXH29AJP7K', 'customized_input_01JRCT12N9X24PCQ5QZPAYKB93', 'customized_input_01JRF9CZSW65A151WR30NA4PB3', 'customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', 'customized_input_01JSE7H4MQES619NBWX6PQDFRH', 'customized_input_01JSE7RNV3VK78YC2GYAG0554D', 'customer_contacts_phone_number', 'customer_contacts_mobile_phone_number', 'customer_contacts_email', 'line_id', 'customer_contacts_gender', 'customer_contacts_birth_date', 'customer_contacts_employment_type', 'customer_contacts_employer_name', 'customer_contacts_employer_address', 'customer_contacts_years_of_service', 'customer_contacts_annual_income', 'customer_contacts_count', 'elementary_school_id', 'junior_high_school_id', 'postal_code', 'extra_address_info', 'current_contract_type', 'current_utility_costs', 'current_rent', 'budget', 'land_budget', 'desired_purchase_date', 'repayment_years', 'bonus_repayment_amount', 'current_loan_status', 'remarks', 'brand', 'first_interviewed_user', 'last_action_step_migration_item_name', 'last_action_step_migration_item_date', 'upcoming_date', 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV', 'introduction_person_name', 'introduction_person_category', 'introduction_date', 'created_by_name', 'updated_by_name', 'created_at', 'updated_at', 'customer_contacts_preferred_method_of_contact', 'customer_contacts_preferred_contact_time', 'customer_contacts_holiday_list', 'customer_contacts_commute', 'customer_contacts_homecoming_time', 'customer_contacts_parents_place_info', 'email_subscription_status', 'monthly_repayment_amount', 'self_budget', 'budget_reason', 'desired_purchase_date_reason', 'current_loan_balance', 'current_monthly_repayment_amount', 'house_hunting_motivation', 'discovered_reason_name', 'inquiry_reason', 'desired_property_category2', 'desired_elementary_school1', 'desired_elementary_school2', 'desired_elementary_school3', 'desired_junior_high_school1', 'desired_junior_high_school2', 'desired_junior_high_school3', 'desired_land_area', 'desired_occupancy_area', 'desired_area1_postal_code', 'desired_area1_address', 'desired_area2_postal_code', 'desired_area2_address', 'desired_area3_postal_code', 'desired_area3_address', 'desired_nearby_station1_line_name', 'desired_nearby_station1_name', 'desired_nearby_station1_distance', 'desired_nearby_station2_line_name', 'desired_nearby_station2_name', 'desired_nearby_station2_distance', 'desired_nearby_station3_line_name', 'desired_nearby_station3_name', 'desired_nearby_station3_distance', 'desired_area_reason', 'desired_floor', 'desired_layout_rooms_number', 'desired_layout_rooms_arrangement', 'desired_parking_number', 'desired_age_of_construction_max', 'desired_has_solar_power', 'planned_construction_site', 'contracted_property_id', 'contract_land_application_date', 'contract_building_application_date', 'contract_planned_date', 'contract_land_agreement_date', 'contract_building_agreement_date', 'contract_application_fee_planned_date', 'contract_payment_planned_date', 'contraction_contract_price', 'contraction_estimate_number', 'contraction_funding_plan_number', 'contraction_purchase_order_issued_date', 'additional_contraction_contract_price', 'additional_contraction_estimate_number', 'additional_contraction_funding_plan_number', 'additional_contraction_purchase_order_issued_date', 'handover_contract_price', 'handover_estimate_number', 'handover_funding_plan_number', 'handover_purchase_order_issued_date', 'customer_mortgage_examinations_status', 'customer_mortgage_examinations_application_date', 'customer_mortgage_examinations_proposal_date', 'customer_mortgage_examinations_bank_name', 'customer_mortgage_examinations_desired_loan_amount', 'memo_developer_application_company', 'memo_lawyer', 'memo_fire_insurance', 'memo_site_survey', 'memo_ground_survey', 'memo_other_related_person', 'competitor_lost_contract_date', 'competitors_text', 'competitor_name', 'competitor', 'competitor_lost_contract_reason', 'customer_desired_floor', 'customer_desired_period', 'customer_desired_estate', 'customer_desired_order', 'call_status', 'khg_id', 'desired_pref', 'show_dashboard', 'rank_period', 'step_migration_item_catalog', 'hp_campaign', 'reserved_interview', 'cancel_status', 'property_name', 'property_tour_name', 'lat_lng', 'integration', 'call_log', 'property_contract_name', 'customer_contacts_name_2', 'customer_contacts_name_kana_2', 'planned_construction_site_2', 'planned_construction_site_3', 'sales_promotion_name_2', 'step_migration_item_01J95TGVT725FT1OLHTWBLP96Y', 'memo_marketing', 'next_action_date', 'delete_dashboard');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('master_data_resale', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'id', '顧客ID。反響の取り込みで作る。⚠️ 反響（inquiry_customer_kaeru.pg_id）・call_sheet・interview_sheet・master_data_log がこの値で結ぶ', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'date', '（推定）PG CLOUD 時代の登録日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_name', '氏名①（お客様名）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'in_charge_store', '⚠️ 店舗名ではなく取引区分（買い:中古リノベ／売り:ポータル／買い:ポータル）。商談ステップの対応表（interviewKpi.ts の RESALE_MAP）がこれで切り替わる。空の行は商談ステップの日付が入らない', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'in_charge_user', '担当営業。未設定のときは「<取引区分> 管理」', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'reaction_date', '（推定）PG CLOUD 時代の反響日。⚠️ いまの集計は反響取得日（step_migration_item_01J82Z5F13B6…）を使う', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'first_interviewed_date', '（推定）PG CLOUD 時代の初回面談日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'full_address', '住所①', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'sales_promotion_name', '販促媒体①（反響媒体）。medium_resale の媒体名', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'status', '顧客の状況（例 見込み・契約済み・失注・会社管理・重複）。新規の既定は「見込み」', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'category', '取引区分（買い:中古リノベ／売り:ポータル／買い:ポータル）。古い行は「used」や「売：-」「買：-」のような旧システムの区分のまま', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'has_owned_land', '土地の有無', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_name_kana', 'ふりがな①', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_tags', '顧客タグ', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', '顧客ランク（Sランク〜Hランク）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customized_input_01J95TC6KEES87F0YXH29AJP7K', '自由記載（中古の顧客の編集の欄）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customized_input_01JRCT12N9X24PCQ5QZPAYKB93', '集客イベント（analysis/columns.ts）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customized_input_01JRF9CZSW65A151WR30NA4PB3', '他決理由（詳細な失注理由。lostList.ts・competitor.ts）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN', '重視項目', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customized_input_01JSE7H4MQES619NBWX6PQDFRH', '敗因（負けた理由の自由記述。informationUtils.ts の LOSE_REASON_KEY）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customized_input_01JSE7RNV3VK78YC2GYAG0554D', '購入可能時期（中古の顧客の編集の欄）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_phone_number', '電話番号①', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_mobile_phone_number', '電話番号②（携帯）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_email', 'メールアドレス①', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'line_id', 'LINE ID', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_gender', '性別', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_birth_date', '生年月日', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_employment_type', '雇用形態', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_employer_name', '勤務先名', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_employer_address', '勤務先住所', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_years_of_service', '勤続年数', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_annual_income', '年収', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_count', '（推定）家族の人数', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'elementary_school_id', '（推定）小学校区', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'junior_high_school_id', '（推定）中学校区', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'postal_code', '郵便番号', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'extra_address_info', 'メールアドレス②（⚠️ 列名は住所の補足だが、メールの2つ目に使っている）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'current_contract_type', '現居契約形態', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'current_utility_costs', '現居光熱費', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'current_rent', '現居家賃', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'budget', '予算総額', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'land_budget', '土地予算', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'desired_purchase_date', '希望購入時期', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'repayment_years', '返済希望年数', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'bonus_repayment_amount', 'ボーナス返済額', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'current_loan_status', '今の借入の状況', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'remarks', '備考。反響の取り込みで反響の内容が入る', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'brand', 'ブランド（ほとんど空）', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'first_interviewed_user', '担当営業を変えたときの変更前の担当（顧客の編集が入れる）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'last_action_step_migration_item_name', '店舗管理への変更理由（担当を「<店舗> 管理」に変えたときに選ぶ。失注・計画中止・連絡不能など）。⚠️ 列名と中身が違う', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'last_action_step_migration_item_date', '（推定）PG CLOUD 時代の最後の商談ステップの日付', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'upcoming_date', '（推定）PG CLOUD 時代の次の予定日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99', '反響取得日（登録日）。反響一覧・集計の「反響」の月はこの日付', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z', 'DB のコメントは「通電」。⚠️ 中古の商談ステップからは入らない', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7', '初回来場（初回面談）の日。買い側', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN', '訪問査定の日。売り:ポータル（要確認・日報の appointment・地図の assess）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0', '媒介取得の日。売り:ポータル', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR', '事前審査の日。買い側', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG', '物件案内の日。買い側', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW', '売買契約の日。買い側', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA', '2回目以降面談の日。買い側（DB のコメントは「次回アポ」）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG', 'リフォーム契約の日。買い:中古リノベだけ', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22', '査定書提出の日。売り:ポータル', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV', '⚠️ 取引区分で意味が違う。買い側＝2回目以降物件案内／売り:ポータル＝査定アポの日', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'introduction_person_name', '紹介者の名前（お友達紹介）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'introduction_person_category', '紹介者の区分', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'introduction_date', '紹介日', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'created_by_name', '作成者', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'updated_by_name', '最終更新者', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'created_at', '作成日時（text）', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'updated_at', '更新日時（text）', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_preferred_method_of_contact', '希望の連絡方法', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_preferred_contact_time', '希望の連絡時間帯', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_holiday_list', '休日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_commute', '通勤', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_homecoming_time', '帰宅時間', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_parents_place_info', '実家の情報', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'email_subscription_status', 'メール配信の可否', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'monthly_repayment_amount', '月々支払予算', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'self_budget', '自己資金', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'budget_reason', '予算の理由', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_purchase_date_reason', '購入時期の理由', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'current_loan_balance', '負債総額', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'current_monthly_repayment_amount', '今の借入の月々返済額', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'house_hunting_motivation', '住まい探しの動機', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'discovered_reason_name', '知ったきっかけ', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'inquiry_reason', '問い合わせのきっかけ', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'desired_property_category2', '希望の物件種別', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_elementary_school1', '希望の小学校①', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_elementary_school2', '希望の小学校②', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_elementary_school3', '希望の小学校③', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_junior_high_school1', '希望の中学校①', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_junior_high_school2', '希望の中学校②', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_junior_high_school3', '希望の中学校③', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_land_area', '希望土地面積', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'desired_occupancy_area', '希望の居住面積', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_area1_postal_code', '希望エリア①の郵便番号', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_area1_address', '希望エリア①', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'desired_area2_postal_code', '希望エリア②の郵便番号', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_area2_address', '希望エリア②', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_area3_postal_code', '希望エリア③の郵便番号', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_area3_address', '希望エリア③', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_nearby_station1_line_name', '希望の最寄り駅①の路線', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_nearby_station1_name', '希望の最寄り駅①', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_nearby_station1_distance', '希望の最寄り駅①までの距離', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_nearby_station2_line_name', '希望の最寄り駅②の路線', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_nearby_station2_name', '希望の最寄り駅②', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_nearby_station2_distance', '希望の最寄り駅②までの距離', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_nearby_station3_line_name', '希望の最寄り駅③の路線', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_nearby_station3_name', '希望の最寄り駅③', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_nearby_station3_distance', '希望の最寄り駅③までの距離', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_area_reason', '希望エリアの理由', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_floor', '希望の階数', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_layout_rooms_number', '希望の部屋数', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_layout_rooms_arrangement', '希望の間取り', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_parking_number', '希望の駐車台数', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_age_of_construction_max', '許容する築年数の上限', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_has_solar_power', '太陽光の希望', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'planned_construction_site', '入居希望地①', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'contracted_property_id', '（推定）契約した物件の ID', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'contract_land_application_date', 'リフォーム粗利見込（⚠️ 列名は土地の申込日だが中身は違う）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'contract_building_application_date', '仲介粗利見込（⚠️ 列名は建物の申込日だが中身は違う）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'contract_planned_date', '契約予定日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'contract_land_agreement_date', '土地の契約日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'contract_building_agreement_date', '建物の契約日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'contract_application_fee_planned_date', '申込金の予定日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'contract_payment_planned_date', '支払いの予定日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'contraction_contract_price', '予算（⚠️ 列名は契約金額だが中身は違う）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'contraction_estimate_number', '契約時の見積番号', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'contraction_funding_plan_number', '契約時の資金計画番号', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'contraction_purchase_order_issued_date', '契約時の発注日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'additional_contraction_contract_price', '予算詳細', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'additional_contraction_estimate_number', '追加契約の見積番号', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'additional_contraction_funding_plan_number', '追加契約の資金計画番号', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'additional_contraction_purchase_order_issued_date', '追加契約の発注日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'handover_contract_price', '引渡時の金額', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'handover_estimate_number', '引渡時の見積番号', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'handover_funding_plan_number', '引渡時の資金計画番号', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'handover_purchase_order_issued_date', '引渡時の発注日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_mortgage_examinations_status', '住宅ローン審査の状況', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_mortgage_examinations_application_date', '住宅ローン審査の申込日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_mortgage_examinations_proposal_date', '住宅ローンの提案日', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_mortgage_examinations_bank_name', '住宅ローンの銀行', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'customer_mortgage_examinations_desired_loan_amount', '希望借入額', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'memo_developer_application_company', 'メモ（開発申請の会社）', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'memo_lawyer', 'メモ（司法書士）', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'memo_fire_insurance', 'メモ（火災保険）', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'memo_site_survey', 'メモ（現地調査）', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'memo_ground_survey', 'メモ（地盤調査）', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'memo_other_related_person', 'メモ（その他の関係者）', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'competitor_lost_contract_date', '解約発生日（ステータスが「解約」のときに入れる。TableStatus.tsx）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'competitors_text', '競合の会社（顧客の編集の「競合情報」。カンマ区切り）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'competitor_name', '他決した会社', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'competitor', '競合の有無・内容', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'competitor_lost_contract_reason', 'DB のコメントは「解約発生日」。⚠️ 画面の解約発生日は competitor_lost_contract_date に入る。この列の今の使い道は（推定）他決・解約の理由', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_desired_floor', '新築計画', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_desired_period', '入居希望時期', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_desired_estate', '土地の状況', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_desired_order', '（推定）注文住宅の希望', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'call_status', '架電状況（例 架電停止・未通電・継続・来場済み）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'khg_id', '（推定）グループ共通の顧客ID。ほぼ空', '推論', '2.2.301', NOW()),
  ('master_data_resale', 'desired_pref', '希望の県', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'show_dashboard', '集計に数えるか。1＝表示・0＝非表示（ゴミ箱）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'rank_period', '契約見込み月（顧客ランクの横の年月）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_catalog', '資料送付の日（中古では空）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'hp_campaign', 'ホームページのキャンペーン名（反響から引き継ぐ。例 資料請求・会員登録・カエール）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'reserved_interview', '来場予約の日（反響から引き継ぐ）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'cancel_status', 'キャンセルの扱い（要確認の「キャンセル」に出すか。空でないと出さない）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'property_name', '問い合わせ物件（カンマ区切り。物件DB の中古住宅専門店の物件名）。物件DB の反響状況がこれで結ぶ', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'property_tour_name', '案内した物件', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'lat_lng', '住所の経緯度（「緯度,経度」か「取得不可」）。customer_address.php が入れる。地図が読む', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'integration', '名寄せ済みの印（1＝名寄せした）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'call_log', '架電回数（顧客の編集の保存と、② callq/usedQueue.ts が数を入れる）。⚠️ 架電の記録の本体は call_sheet.call_log（JSON 配列）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'property_contract_name', '契約した物件', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_name_2', '氏名②', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'customer_contacts_name_kana_2', 'ふりがな②', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'planned_construction_site_2', '入居希望地②', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'planned_construction_site_3', '入居希望地③', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'sales_promotion_name_2', '販促媒体②', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'step_migration_item_01J95TGVT725FT1OLHTWBLP96Y', 'DB のコメントは「2回目以降物件案内」。⚠️ 画面は 01J95TGVT725CV… に入れるので、この列は空（使っていない）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'memo_marketing', 'マーケ用メモ。面談シートの上部から入力する（架電用メモとは別）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'next_action_date', '次回アクション日（商談ステップの最新の予定日。⚠️ この列だけ一番新しい日付が入る）', '改修', '2.2.301', NOW()),
  ('master_data_resale', 'delete_dashboard', '個人情報削除の印。1＝削除済み（伏せ字にした顧客。集計には数える。v2.2.229）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- medium_kaeru：建売の販促媒体
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('medium_kaeru', '建売の販促媒体', 'spec', '建売の販促媒体（反響媒体）の選択肢。1行＝媒体1つ（例 SUUMO・HOME''S・Instagram・Web検索・アットホーム・公式LINE・その他）。
読むもの：建売の反響一覧・顧客の編集・顧客DB・販促媒体別動向（CustomerKaeru・CustomerTrendKaeru）・店舗別（ShopKaeru）・地図・予算シミュレーター・② analysis/trendMedium.ts など（多くは SELECT * の全件）。
⚠️ 建売の顧客の販促媒体（master_data_kaeru.sales_promotion_name）はこの表の名前が正。別名（Youtube→YouTube など）は customerKaeruUtils.ts の normalizeMedium が寄せる。
⚠️ 注文の medium_list と違い list_medium・response_medium の列は無い（画面で絞らない）。
⚠️ 画面からの追加・編集は無い（推定）。媒体を増やすときは SQL で入れる。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'medium_kaeru' AND column_name NOT IN ('no', 'medium', 'show_graph');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('medium_kaeru', 'no', '連番（自動採番）。並び順にも使う', '改修', '2.2.301', NOW()),
  ('medium_kaeru', 'medium', '媒体名。⚠️ ALLGRIT は「公式LINE」、at home は「アットホーム」で登録されている（画面の表示だけ差し替える）', '改修', '2.2.301', NOW()),
  ('medium_kaeru', 'show_graph', 'グラフ表示。1＝販促媒体別動向の表の行・グラフの系列と予算シミュレーターに単独で出す（2026-09-11 追加。SUUMO・HOME''S・アットホーム・公式LINE など）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- medium_list：販促媒体マスタ
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('medium_list', '販促媒体マスタ', 'common', '反響の媒体・販促媒体の一覧。1行が1媒体（SUUMO・HOME''S・かえる-資料請求 など）。
反響一覧・顧客・反響推移・予算シミュレーター・架電状況・経理の予算画面（① budget_accounting.php）・市況分析（① market_master.php）が、媒体の選択肢と表の行の並びに読む。注文の行の並びは `response_medium = 0 AND list_medium = 1` を sort_key 順。
⚠️ 書き込む画面は無い（手で入れている。推定）。
⚠️ 建売の反響の媒体名はこの表とほとんど一致しない（建売は medium_kaeru 側）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'medium_list' AND column_name NOT IN ('id', 'medium', 'category', 'sort_key', 'response_medium', 'list_medium', 'ma_medium', 'resale_portal_medium', 'resale_medium', 'sell_portal_medium', 'ma_category');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('medium_list', 'id', '連番', '改修', '2.2.301', NOW()),
  ('medium_list', 'medium', '媒体名。budget.medium・反響の medium と同じ表記', '改修', '2.2.301', NOW()),
  ('medium_list', 'category', '分類（ポータル / 印刷物 / CM/ラジオ / 看板 / 紹介 など）。空の行が多い', '改修', '2.2.301', NOW()),
  ('medium_list', 'sort_key', '並び順（小さいほど上）', '改修', '2.2.301', NOW()),
  ('medium_list', 'response_medium', '1 = 反響媒体（看板・建築現場を見て など）。広告費の表は 0 の行を使う', '改修', '2.2.301', NOW()),
  ('medium_list', 'list_medium', '1 = 注文の反響推移などの表に行として出す', '改修', '2.2.301', NOW()),
  ('medium_list', 'ma_medium', '1 = 市況分析（market_master）の媒体の選択肢に出す。経理の予算画面も振り分けに使う', '改修', '2.2.301', NOW()),
  ('medium_list', 'resale_portal_medium', '（推定）中古（リセール）のポータル媒体の印。読む処理なし', '推論', '2.2.301', NOW()),
  ('medium_list', 'resale_medium', '（推定）中古（リセール）の媒体の印。読む処理なし', '推論', '2.2.301', NOW()),
  ('medium_list', 'sell_portal_medium', '（推定）売却のポータル媒体の印。読む処理なし', '推論', '2.2.301', NOW()),
  ('medium_list', 'ma_category', '市況分析での分類（ポータル / SNS/WEB / チラシ/DM / 看板 など）。medium をまとめた単位', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- medium_resale：中古リノベの販促媒体
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('medium_resale', '中古リノベの販促媒体', 'used', '中古リノベの販促媒体（反響媒体）の選択肢。1行＝媒体1つ（例 SUUMO・すまいステップ・HOME''S・イエイ・ネット検索・カエール・イエウール・athome）。
読むもの：中古の反響一覧・顧客の編集・顧客DB・店舗別（shopTrend）・地図（SELECT * の全件）。
⚠️ 注文の medium_list と違い list_medium などの列は無い。顧客の編集は全件を list_medium = 1 として扱う（InformationEditResale.tsx）。
⚠️ 建売は「Web検索」、中古は「ネット検索」（どちらの表にももう片方の言い方は無い）。
⚠️ 画面からの追加・編集は無い（推定）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'medium_resale' AND column_name NOT IN ('no', 'medium');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('medium_resale', 'no', '連番（自動採番）。並び順にも使う', '改修', '2.2.301', NOW()),
  ('medium_resale', 'medium', '媒体名', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- member_kaeru：建売のホームページ会員登録
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('member_kaeru', '建売のホームページ会員登録', 'spec', 'かえるホームのホームページの会員登録メールを取り込んだ元の表。1行＝会員1人（メールアドレスで1行）。
書くもの：メールの取り込み（sync）が ① の request member_kaeru_update で送る（member_kaeru_update.php）。同じメールアドレスがあれば上書き（UPDATE）、無ければ `mk_` で始まる ID を作って INSERT。
続けて ① handlers/portal/member_kaeru.php が反響一覧（inquiry_customer_kaeru）へ `hp_member_<id>` で写す（medium＝ホームページ反響・hp_campaign＝会員登録）。⚠️ 反響一覧へは INSERT IGNORE なので、会員の情報を上書きしても反響一覧は変わらない。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'member_kaeru' AND column_name NOT IN ('no', 'id', 'email', 'name', 'name_kana', 'zip', 'address', 'age', 'tel', 'mobile', 'source', 'desired_area_1', 'desired_area_2', 'desired_area_3', 'area_notes', 'other_conditions', 'registered_at', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('member_kaeru', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'id', '会員の ID（`mk_` で始まる）。反響ID の末尾になる', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'email', 'メールアドレス。⚠️ 同じ会員かどうかはこれで決める', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'name', 'お名前', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'name_kana', 'フリガナ', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'address', 'ご住所（反響一覧の building に入る）', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'age', 'ご年齢', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'tel', '電話番号（反響一覧の landline に入る）', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'mobile', '携帯電話（反響一覧の mobile に入る）', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'source', '何で知ったか（反響一覧の response_medium）', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'desired_area_1', '希望エリア①（反響一覧の area）', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'desired_area_2', '希望エリア②（反響一覧の area_2）', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'desired_area_3', '希望エリア③（反響一覧の area_3）', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'area_notes', 'エリアの補足（反響一覧の school_area）', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'other_conditions', 'その他の希望条件（反響一覧の other_condition）', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'registered_at', '登録日時（メール受信日時）', '改修', '2.2.301', NOW()),
  ('member_kaeru', 'remarks', '詳細メモ（メールの全項目をつないだ文。反響一覧の note）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- member_resale：中古リノベのホームページ会員登録
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('member_resale', '中古リノベのホームページ会員登録', 'used', '中古住宅専門店（chuko-senmon.jp）の会員登録メールを取り込んだ元の表。1行＝会員1人（メールアドレスで1行）。
書くもの：GAS（backend/scripts/gas/runMemberResale.gs）がメールを読み、① の request member_resale_update で送る（member_resale_update.php）。同じメールアドレスがあれば上書き、無ければ `rm_` で始まる ID を作って INSERT。
続けて ① handlers/portal/member_resale.php が反響一覧（inquiry_customer_resale）へ `hp_member_<id>` で写す（category＝買い:中古リノベ・hp_campaign＝会員登録）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'member_resale' AND column_name NOT IN ('no', 'id', 'email', 'name', 'name_kana', 'address', 'tel', 'mobile', 'email_send_flag', 'source', 'registered_at', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('member_resale', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('member_resale', 'id', '会員の ID（`rm_` で始まる）。反響ID の末尾になる', '改修', '2.2.301', NOW()),
  ('member_resale', 'email', 'メールアドレス。⚠️ 同じ会員かどうかはこれで決める', '改修', '2.2.301', NOW()),
  ('member_resale', 'name', 'お名前', '改修', '2.2.301', NOW()),
  ('member_resale', 'name_kana', 'フリガナ', '改修', '2.2.301', NOW()),
  ('member_resale', 'address', 'ご住所（反響一覧の building に入る）', '改修', '2.2.301', NOW()),
  ('member_resale', 'tel', '電話番号（反響一覧の landline に入る）', '改修', '2.2.301', NOW()),
  ('member_resale', 'mobile', '携帯電話（反響一覧の mobile に入る）', '改修', '2.2.301', NOW()),
  ('member_resale', 'email_send_flag', 'メール配信の希望（メールの項目のまま）', '改修', '2.2.301', NOW()),
  ('member_resale', 'source', '何で知ったか（反響一覧の response_medium）', '改修', '2.2.301', NOW()),
  ('member_resale', 'registered_at', '登録日時（メール受信日時）', '改修', '2.2.301', NOW()),
  ('member_resale', 'remarks', '詳細メモ（メールの全項目をつないだ文。反響一覧の note）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- meta_ad_daily：Meta 広告（自社）の日別の数字
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('meta_ad_daily', 'Meta 広告（自社）の日別の数字', 'common', '自社の Meta 広告の日別の表示回数・クリック・費用（v2.2.203）。1広告×1日＝1行（主キー ad_id, day）。
書くのは ② features/metaAds/importer.ts（insights level=ad・1日ごと）。取り込むたびに直近の日数分を上書きする。
読むのは「反響管理 → アクセス解析」の詳細（features/tracking/detail.ts。meta_ad_items と ad_id で結ぶ）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'meta_ad_daily' AND column_name NOT IN ('ad_id', 'day', 'impressions', 'clicks', 'spend', 'imported_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('meta_ad_daily', 'ad_id', 'Meta の広告ID（meta_ad_items.ad_id）', '改修', '2.2.301', NOW()),
  ('meta_ad_daily', 'day', '日付', '改修', '2.2.301', NOW()),
  ('meta_ad_daily', 'impressions', '表示回数', '改修', '2.2.301', NOW()),
  ('meta_ad_daily', 'clicks', 'リンクのクリック（inline_link_clicks）', '改修', '2.2.301', NOW()),
  ('meta_ad_daily', 'spend', '費用（円）', '改修', '2.2.301', NOW()),
  ('meta_ad_daily', 'imported_at', '取り込んだ日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- meta_ad_items：Meta 広告（自社）の一覧
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('meta_ad_items', 'Meta 広告（自社）の一覧', 'common', '自社の Meta 広告の一覧（v2.2.203）。1広告＝1行（主キー ad_id）。
書くのは ② features/metaAds/importer.ts（Graph API の {アカウント}/ads。自動の scheduler.ts と画面のボタン request meta_ads_import）。取り込むたびに上書きする。
読むのは「反響管理 → アクセス解析」の詳細（features/tracking/detail.ts。日別の数字は meta_ad_daily と ad_id で結ぶ）。
⚠️ ad_id は tracking_touches.utm_content（URL パラメータ {{ad.id}}）と同じ値。
⚠️ 他社広告ライブラリ（meta_ads）とは別物。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'meta_ad_items' AND column_name NOT IN ('ad_id', 'brand', 'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_name', 'status', 'thumbnail_url', 'image_url', 'imported_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('meta_ad_items', 'ad_id', 'Meta の広告ID（主キー）', '改修', '2.2.301', NOW()),
  ('meta_ad_items', 'brand', 'ブランドキー（META_AD_ACCOUNTS の左側。tracking_sites.brand と同じ。kh・djh・nagomi・pg・khf など）', '改修', '2.2.301', NOW()),
  ('meta_ad_items', 'campaign_id', 'キャンペーンID', '改修', '2.2.301', NOW()),
  ('meta_ad_items', 'campaign_name', 'キャンペーン名', '改修', '2.2.301', NOW()),
  ('meta_ad_items', 'adset_id', '広告セットID', '改修', '2.2.301', NOW()),
  ('meta_ad_items', 'adset_name', '広告セット名', '改修', '2.2.301', NOW()),
  ('meta_ad_items', 'ad_name', '広告名', '改修', '2.2.301', NOW()),
  ('meta_ad_items', 'status', 'effective_status（ACTIVE・PAUSED・ADSET_PAUSED・WITH_ISSUES など）', '改修', '2.2.301', NOW()),
  ('meta_ad_items', 'thumbnail_url', 'サムネイルの URL。⚠️ 数日で期限が切れる。取り込みのたびに上書き', '改修', '2.2.301', NOW()),
  ('meta_ad_items', 'image_url', '画像の URL（creative.image_url）', '改修', '2.2.301', NOW()),
  ('meta_ad_items', 'imported_at', '最後に取り込んだ日時（アクセス解析の設定画面に「最終取り込み」として出す）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- meta_ads：他社広告ライブラリ
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('meta_ads', '他社広告ライブラリ', 'common', 'Meta 広告ライブラリから集めた他社（と自社）のバナー広告。1広告＝1行（ad_hash が UNIQUE）。
書くのは拡張機能（広告ライブラリで「自社DBに保存」）→ ② request meta_scrape（届かなければ ① handlers/meta_scrape.php）。画像は ① の dashboard/img/meta/ に置く。
読むのは画面「他社動向 → 他社広告ライブラリ」（MetaAdsDashboard.tsx。request meta_ads、ブックマークは roll: bookmark）。
⚠️ 自社の Meta 広告の成果（meta_ad_items・meta_ad_daily）とは別物。
⚠️ 同じ広告は2回目以降の取得で行が増えないので、「いつまで出ていたか」は分からない。
⚠️ ad_hash の作り方（features/metaAds/scrape.ts の metaAdHash）を変えると重複判定が効かなくなる。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'meta_ads' AND column_name NOT IN ('id', 'advertiser_name', 'ad_title', 'image_filename', 'lp_url', 'ad_hash', 'scraped_date', 'created_at', 'bookmark', 'advertiser_area', 'advertiser_period');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('meta_ads', 'id', '連番', '改修', '2.2.301', NOW()),
  ('meta_ads', 'advertiser_name', '広告主（他社のページ名）', '改修', '2.2.301', NOW()),
  ('meta_ads', 'ad_title', '広告の本文・見出し（空白を詰めた形でハッシュに使う）', '改修', '2.2.301', NOW()),
  ('meta_ads', 'image_filename', '画像のファイル名（ad_xxxxxxxxxxxxxxxx.jpg など）。① の dashboard/img/meta/ に置く', '改修', '2.2.301', NOW()),
  ('meta_ads', 'lp_url', '広告のリンク先（? 以降も含めて生のまま。画面で押して開く）', '改修', '2.2.301', NOW()),
  ('meta_ads', 'ad_hash', '重複判定のキー。sha256(広告主＋本文＋? 以降を除いた URL＋md5(画像の data URL))。UNIQUE', '改修', '2.2.301', NOW()),
  ('meta_ads', 'scraped_date', '取得した日', '改修', '2.2.301', NOW()),
  ('meta_ads', 'created_at', '登録日時', '改修', '2.2.301', NOW()),
  ('meta_ads', 'bookmark', 'ブックマーク（1＝あり）。画面の☆で切り替える', '改修', '2.2.301', NOW()),
  ('meta_ads', 'advertiser_area', '広告主の地域（全国・鹿児島県・熊本県・大分県・宮崎県・自社 など。空もある）。画面の地域の絞り込み', '改修', '2.2.301', NOW()),
  ('meta_ads', 'advertiser_period', '掲載の開始日（画面に「開始:」で出す。例 2026/07/05 の形の文字列）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- mhr_db：MHR 反響の取り込み元（媒体不明）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('mhr_db', 'MHR 反響の取り込み元（媒体不明）', 'common', '（推定）「MHR」という媒体からの反響（会員登録・資料請求など）の生データ。1行が1件。媒体の正式名は分からない。
コードからの使用箇所なし（推定：Dashboard・sync の外の古い取り込みが書いていた）。
登録は 2025/03/28〜2025/07/17 の266件で止まっている。住所は九州以外も含む。反響一覧（inquiry_customer）に対応する接頭辞の行は見つからない。
⚠️ 個人情報を含む。使わないなら整理の対象（推定）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'mhr_db' AND column_name NOT IN ('id', 'id_mhr', 'sei_mhr', 'mei_mhr', 'sei_kana_mhr', 'mei_kana_mhr', 'zip_mhr', 'pref_mhr', 'address_mhr', 'phone_mhr', 'mail_mhr', 'register_mhr');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('mhr_db', 'id', '連番（自動採番）', '推論', '2.2.301', NOW()),
  ('mhr_db', 'id_mhr', '（推定）媒体側の ID（5桁）', '推論', '2.2.301', NOW()),
  ('mhr_db', 'sei_mhr', '氏名の姓', '推論', '2.2.301', NOW()),
  ('mhr_db', 'mei_mhr', '氏名の名', '推論', '2.2.301', NOW()),
  ('mhr_db', 'sei_kana_mhr', '氏名の姓（カナ）', '推論', '2.2.301', NOW()),
  ('mhr_db', 'mei_kana_mhr', '氏名の名（カナ）', '推論', '2.2.301', NOW()),
  ('mhr_db', 'zip_mhr', '郵便番号', '推論', '2.2.301', NOW()),
  ('mhr_db', 'pref_mhr', '都道府県', '推論', '2.2.301', NOW()),
  ('mhr_db', 'address_mhr', '住所（都道府県より後）', '推論', '2.2.301', NOW()),
  ('mhr_db', 'phone_mhr', '電話番号', '推論', '2.2.301', NOW()),
  ('mhr_db', 'mail_mhr', 'メールアドレス', '推論', '2.2.301', NOW()),
  ('mhr_db', 'register_mhr', '登録日（YYYY/MM/DD）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- mochiie_db：持ち家計画 反響の取り込み元
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('mochiie_db', '持ち家計画 反響の取り込み元', 'order', '（推定）持ち家計画（注文住宅のポータル。DJH・Nagomi）の反響の生データ。1行が1件の反響。
コードからの使用箇所なし（推定：以前の取り込みスクリプト portal-app の reloadMochiie.js が書き、反響一覧 inquiry_customer に `mochiie<ID>` の行を足していた。docs/oldDocument/handover-portal-order.md では移植の対象外）。
登録は 2023/11〜2026/09/04 の457件。反響一覧には媒体「持ち家計画」の行が残っている。
⚠️ 取り込みが Dashboard・sync の外にある（推定）。止まっているかどうかは要確認。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'mochiie_db' AND column_name NOT IN ('id', 'id_mochiie', 'sei_mochiie', 'mei_mochiie', 'sei_kana_mochiie', 'mei_kana_mochiie', 'gender_mochiie', 'birth_mochiie', 'age_mochiie', 'address_mochiie', 'phone_mochiie', 'mail_mochiie', 'job_mochiie', 'estate_mochiie', 'area_pref_mochiie', 'area_city_mochiie', 'family_mochiie', 'structure_mochiie', 'member_mochiie', 'plan_mochiie', 'large_mochiie', 'budget_mochiie', 'demand_mochiie', 'date_mochiie', 'search_mochiie', 'reserve_mochiie', 'note_mochiie', 'shop_mochiie');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('mochiie_db', 'id', '連番（自動採番）', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'id_mochiie', '持ち家計画の反響ID。反響一覧の inquiry_id は `mochiie` ＋この値', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'sei_mochiie', '氏名の姓', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'mei_mochiie', '氏名の名', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'sei_kana_mochiie', '氏名の姓（カナ）', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'mei_kana_mochiie', '氏名の名（カナ）', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'gender_mochiie', '性別', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'birth_mochiie', '生年月日', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'age_mochiie', '年齢', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'address_mochiie', '住所', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'phone_mochiie', '電話番号', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'mail_mochiie', 'メールアドレス', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'job_mochiie', '職業', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'estate_mochiie', '（推定）土地の有無', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'area_pref_mochiie', '建築予定地の都道府県', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'area_city_mochiie', '建築予定地の市区町村', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'family_mochiie', '（推定）家族構成', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'structure_mochiie', '（推定）希望の構造・工法', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'member_mochiie', '（推定）入居予定人数', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'plan_mochiie', '（推定）希望間取り', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'large_mochiie', '（推定）希望の広さ', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'budget_mochiie', '予算', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'demand_mochiie', '（推定）ご要望', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'date_mochiie', '反響日（YYYY/MM/DD）', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'search_mochiie', '（推定）検索条件・きっかけ', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'reserve_mochiie', '（推定）来場予約の内容', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'note_mochiie', '（推定）備考', '推論', '2.2.301', NOW()),
  ('mochiie_db', 'shop_mochiie', '取り込んだアカウントのブランド（DJH / Nagomi）。店舗名ではない', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- nexus：Nexus 連携の顧客の写し
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('nexus', 'Nexus 連携の顧客の写し', 'order', '（推定）Nexus（自社の別システム）へ連携・移行した注文住宅の顧客の一覧。1行が1人。列名は顧客DB（master_data）と同じ。
コードからの使用箇所なし（推定：2025/7/14 に一度だけ顧客DB から書き出した写し。画面の「Nexus」の印は frontend/src/utils/nexusUtils.ts が顧客DB の値から判定しており、この表は読まない）。
144件すべてが同じ日時で、141件は顧客DB の id と一致する。
⚠️ 個人情報を含む。使わないなら整理の対象（推定）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'nexus' AND column_name NOT IN ('id', 'date', 'customer_contacts_name', 'in_charge_store', 'in_charge_user', 'reaction_date', 'first_interviewed_date', 'full_address', 'sales_promotion_name', 'status', 'category', 'has_owned_land', 'customer_contacts_name_kana', 'customer_tags', 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', 'customer_contacts_phone_number', 'customer_contacts_mobile_phone_number', 'customer_contacts_email', 'customer_contacts_gender', 'customer_contacts_count', 'brand');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('nexus', 'id', '顧客の id（master_data.id と同じ ULID）', '推論', '2.2.301', NOW()),
  ('nexus', 'date', '書き出した日時（全行 2025/7/14）', '推論', '2.2.301', NOW()),
  ('nexus', 'customer_contacts_name', '顧客名', '推論', '2.2.301', NOW()),
  ('nexus', 'in_charge_store', '担当店舗', '推論', '2.2.301', NOW()),
  ('nexus', 'in_charge_user', '担当営業', '推論', '2.2.301', NOW()),
  ('nexus', 'reaction_date', '反響日', '推論', '2.2.301', NOW()),
  ('nexus', 'first_interviewed_date', '初回面談日', '推論', '2.2.301', NOW()),
  ('nexus', 'full_address', '住所', '推論', '2.2.301', NOW()),
  ('nexus', 'sales_promotion_name', '販促媒体', '推論', '2.2.301', NOW()),
  ('nexus', 'status', '状況（例 見込み・重複・失注）', '推論', '2.2.301', NOW()),
  ('nexus', 'category', '事業（全行「注文」）', '推論', '2.2.301', NOW()),
  ('nexus', 'has_owned_land', '土地の有無', '推論', '2.2.301', NOW()),
  ('nexus', 'customer_contacts_name_kana', '顧客名のフリガナ', '推論', '2.2.301', NOW()),
  ('nexus', 'customer_tags', '顧客のタグ', '推論', '2.2.301', NOW()),
  ('nexus', 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', '顧客ランク（master_data の同じ列。② の顧客DB では rank の別名で読む）', '推論', '2.2.301', NOW()),
  ('nexus', 'customer_contacts_phone_number', '電話番号（固定）', '推論', '2.2.301', NOW()),
  ('nexus', 'customer_contacts_mobile_phone_number', '携帯番号', '推論', '2.2.301', NOW()),
  ('nexus', 'customer_contacts_email', 'メールアドレス', '推論', '2.2.301', NOW()),
  ('nexus', 'customer_contacts_gender', '性別', '推論', '2.2.301', NOW()),
  ('nexus', 'customer_contacts_count', '（推定）連絡先の数', '推論', '2.2.301', NOW()),
  ('nexus', 'brand', 'ブランド（例 国分ハウジング・デイジャストハウス・なごみ工務店・PG HOUSE・ニーエルホーム）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- owners_house_application：オーナーズハウス募集の受付
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('owners_house_application', 'オーナーズハウス募集の受付', 'order', 'オーナーズハウス募集（お施主様が自宅を見学先として登録するフォーム）の受付（v2.2.215）。1受付＝1行。
書くのは ① handlers/owners_house_application.php（フォームからの受付。写真は /dashboard/api/images/）と、② request owners_house_application_import（過去の通知メールの取り込み。GAS OwnersHouseMailImport.gs）。
読むのは「反響管理 → オーナーズハウス募集」（header/inquiry/OwnersHouseApplication.tsx。request owners_house_application_list）。
⚠️ 物件として公開するのは ownershouse（管理画面で別に登録する）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'owners_house_application' AND column_name NOT IN ('id', 'received_at', 'source', 'mail_message_id', 'name', 'zip', 'shop', 'staff', 'photo_mode', 'photos', 'title', 'feature1', 'feature2', 'feature3', 'feature4', 'feature5', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('owners_house_application', 'id', '連番', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'received_at', '受付日時（日本時間）', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'source', 'form＝フォーム / mail＝過去の通知メールから取り込み', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'mail_message_id', '取り込んだ通知メールの Gmail の ID（二重取り込みの防止。UNIQUE）', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'name', 'お施主様名', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'shop', 'ご契約店舗（フォームの選択肢の文字のまま。例 国分ハウジング霧島店）', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'staff', '担当営業（自由入力）', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'photo_mode', '撮影を依頼する / 写真を添付する', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'photos', '添付写真のファイル名の JSON 配列（/dashboard/api/images/ の中）', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'title', 'ご自宅のタイトル', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'feature1', 'ご自宅の見どころ①', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'feature2', 'ご自宅の見どころ②', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'feature3', 'ご自宅の見どころ③', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'feature4', 'ご自宅の見どころ④', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'feature5', 'ご自宅の見どころ⑤', '改修', '2.2.301', NOW()),
  ('owners_house_application', 'created_at', '行を作った日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- ownershouse：オーナーズハウス・モデルハウスの物件
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('ownershouse', 'オーナーズハウス・モデルハウスの物件', 'order', 'kh-house.jp/owners_house/ に出す見学先（オーナーズハウス・モデルハウス・完成見学会）の物件。1物件＝1行（v2.2.283 から ① の DB のこの表が元）。
登録・編集は Dashboard の「オーナーズハウス」（ownershouse/OwnersHouseAdmin.tsx・OwnersHouseEditModal.tsx・OwnersHouseImages.tsx。request owners_house_admin_list・owners_house_admin_save・owners_house_admin_image。② features/ownersHouse/admin.ts・images.ts）。
読むのは公開サイト（request owners_house_list・owners_house_detail。flag = ''1'' だけ。認証なし）と見学予約（owners_house_reservation。id で物件を引き、店舗・ブランドを決める）。
⚠️ no = 1 は列名が入った見出しの行。管理画面は読まない・直させない。
⚠️ 個人情報は持たない（公開してよい物件情報だけ）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'ownershouse' AND column_name NOT IN ('no', 'id', 'category', 'pref', 'area', 'lg_code', 'name', 'title', 'brand', 'shop', 'shop_zip', 'shop_address', 'staff', 'tag', 'feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5', 'img_1', 'img_2', 'img_3', 'img_4', 'img_5', 'img_6', 'img_7', 'img_8', 'img_9', 'img_10', 'img_11', 'img_12', 'img_13', 'img_14', 'map_address', 'lat_and_long', 'structure', 'large', 'plan', 'flag', 'updated_at', 'updated_by');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('ownershouse', 'no', '連番（主キー）。⚠️ no = 1 は列名が入った見出しの行（category = ''category''）。サイトも管理画面も出さない', '改修', '2.2.301', NOW()),
  ('ownershouse', 'id', '物件ID（8桁の数字の文字列。例 00000002）。サイトの物件ページの URL（owners?id=）に使う。新しい物件は最大＋1', '改修', '2.2.301', NOW()),
  ('ownershouse', 'category', '種別：オーナーズハウス／モデルハウス／完成見学会。地図のピンの色・見出しの出し分けに使う', '改修', '2.2.301', NOW()),
  ('ownershouse', 'pref', '都道府県（「都府県」を抜いた形。例 鹿児島）。サイトの県の絞り込み。lg_code.pref_short', '改修', '2.2.301', NOW()),
  ('ownershouse', 'area', '市区町村（「市区町村」を抜いた形。例 霧島）。サイトのエリアの絞り込み。lg_code.city_short（一覧に無い呼び名もある：出水阿久根・加世田・肝属）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'lg_code', '地方公共団体コード（lg_code.code）。管理画面で市区町村を選ぶと入る', '改修', '2.2.301', NOW()),
  ('ownershouse', 'name', '所在地の表示（番地なし。例 鹿児島県霧島市国分府中町）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'title', '物件の見出し（オーナーズハウスのとき、一覧・物件ページ・地図の吹き出しに出す）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'brand', 'ブランド略称（KH / DJH / Nagomi / 2L / FH / PGH / JH）。見学予約の通知先を決める（② ownersHouse/reservation.ts の BRANDS）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'shop', '管理店舗（shop_list の division = 注文事業 の店舗名）。物件ページの「管理店舗」・見学予約の店舗', '改修', '2.2.301', NOW()),
  ('ownershouse', 'shop_zip', '管理店舗の郵便番号', '改修', '2.2.301', NOW()),
  ('ownershouse', 'shop_address', '管理店舗の住所', '改修', '2.2.301', NOW()),
  ('ownershouse', 'staff', '担当（オーナー様が書いてきた内容のまま）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'tag', 'タグ（カンマ区切り）。サイトの #タグ の絞り込み', '改修', '2.2.301', NOW()),
  ('ownershouse', 'feature_1', '特徴1（物件ページの箱）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'feature_2', '特徴2（物件ページの箱）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'feature_3', '特徴3（物件ページの箱）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'feature_4', '特徴4（物件ページの箱）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'feature_5', '特徴5（⚠️ いまのサイトは出していない）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_1', '画像1（メイン。一覧のサムネイル・地図の吹き出し）。ファイル名（<ID>/<ID>_01_xxxxxx.jpg）。http で始まる値は引っ越し前の URL', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_2', '画像2（メイン）。ファイル名。http で始まる値は引っ越し前の URL', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_3', '画像3（メイン）。ファイル名。http で始まる値は引っ越し前の URL', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_4', '画像4（メイン）。ファイル名。http で始まる値は引っ越し前の URL', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_5', '画像5（カルーセル）。ファイル名。http で始まる値は引っ越し前の URL', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_6', '画像6（カルーセル）。ファイル名', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_7', '画像7（カルーセル）。ファイル名', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_8', '画像8（カルーセル）。ファイル名', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_9', '画像9（カルーセル）。ファイル名', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_10', '画像10（カルーセル）。ファイル名', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_11', '画像11（カルーセル）。ファイル名', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_12', '画像12（カルーセル）。ファイル名', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_13', '画像13（カルーセル）。ファイル名', '改修', '2.2.301', NOW()),
  ('ownershouse', 'img_14', '画像14（カルーセル）。ファイル名', '改修', '2.2.301', NOW()),
  ('ownershouse', 'map_address', '物件ページの地図（Google マップ埋め込みの iframe）。管理画面で保存すると lat_and_long から作り直す', '改修', '2.2.301', NOW()),
  ('ownershouse', 'lat_and_long', '緯度, 経度（「31.36, 130.81」の形）。サイトの地図のピン。管理画面の地図で決める', '改修', '2.2.301', NOW()),
  ('ownershouse', 'structure', '構造（平屋・2階建てなど）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'large', '延床面積（例 110.96㎡）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'plan', '間取り（例 4LDK）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'flag', '公開（''1'' = サイトに出す。それ以外は出さない）', '改修', '2.2.301', NOW()),
  ('ownershouse', 'updated_at', '管理画面で最後に保存した日時', '改修', '2.2.301', NOW()),
  ('ownershouse', 'updated_by', '管理画面で最後に保存したスタッフ名', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- pg_estate_info：PG CLOUD の物件情報（未使用）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('pg_estate_info', 'PG CLOUD の物件情報（未使用）', 'common', '（推定）PG CLOUD から書き出した物件情報（土地・建売など）を入れるための表。1物件 = 1行。列はすべて文字列で、CSV をそのまま入れる形。
コードからの使用箇所なし（推定：estate_info の前に PG CLOUD の物件を取り込もうとした名残）。⚠️ ローカルは 0 件。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'pg_estate_info' AND column_name NOT IN ('id', 'portal', 'property_type', 'property_name', 'price', 'address', 'property_rank', 'land_tsubo', 'land_tsubo_unit_price', 'land_area', 'real_estate_company', 'nearest_station', 'station_walk_minutes', 'info_registered_at', 'info_updated_at', 'data_acquirer', 'csv_id', 'status', 'school_elementary', 'school_junior', 'brand', 'shop_name', 'staff_name', 'seller', 'parking', 'parking_spaces', 'built_year_month', 'city_planning', 'building_conditions', 'transaction_type', 'property_name_public', 'external_import', 'total_floor_area', 'exclusive_area', 'management_number', 'website_publication', 'info_registrant', 'info_updater');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('pg_estate_info', 'id', '連番（主キー）', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'portal', '（推定）掲載しているポータル', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'property_type', '物件種別', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'property_name', '物件名', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'price', '価格（文字列）', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'address', '所在地', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'property_rank', '（推定）物件のランク', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'land_tsubo', '土地の坪数', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'land_tsubo_unit_price', '土地の坪単価', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'land_area', '土地面積', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'real_estate_company', '不動産会社（元付け）', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'nearest_station', '最寄り駅', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'station_walk_minutes', '駅からの徒歩（分）', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'info_registered_at', '情報の登録日（文字列）', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'info_updated_at', '情報の更新日（文字列）', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'data_acquirer', '（推定）情報を取得した担当者', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'csv_id', '（推定）書き出し元の物件番号', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'status', '状況', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'school_elementary', '小学校区', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'school_junior', '中学校区', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'brand', '（推定）PG CLOUD のブランド', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'shop_name', '担当の店舗', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'staff_name', '担当者', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'seller', '売主', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'parking', '駐車場', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'parking_spaces', '駐車場の台数', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'built_year_month', '築年月', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'city_planning', '都市計画', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'building_conditions', '建築条件の有無', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'transaction_type', '取引態様', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'property_name_public', '（推定）物件名を公開するか', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'external_import', '（推定）外部から取り込んだ物件か', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'total_floor_area', '延床面積', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'exclusive_area', '専有面積', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'management_number', '管理番号', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'website_publication', '（推定）自社サイトへの掲載の有無', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'info_registrant', '情報を登録した人', '推論', '2.2.301', NOW()),
  ('pg_estate_info', 'info_updater', '情報を更新した人', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- pgcloud：来場予約フォームの控え
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('pgcloud', '来場予約フォームの控え', 'order', 'ホームページのキャンペーンフォーム（来場予約・見積もり・オーナー様邸見学など）の受付の控え。1行が1件の送信。列名が日本語。
② の campaign_form:entry（features/campaignForm/entry.ts）・estimate（features/estimate/entry.ts）・owners_house_reservation（features/ownersHouse/reservation.ts）が、反響一覧（inquiry_customer）に保存したあとに同じ内容を INSERT する。② に届かないときは ① の同じ名前の PHP が書く。
読むのは ① の cancelList.php・survey.php（ブランド・店舗・年齢・携帯番号・きっかけだけ。来場フォームの集計）。
⚠️ 失敗しても反響は保存済みなので、受付は止めない（ログだけ残す）。⚠️ INSERT では21列すべてを埋める（既定値が無い列があるため）。
⚠️ 列名に「・」を含むものは SQL でバッククォートで囲む。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'pgcloud' AND column_name NOT IN ('id', 'タイムスタンプ', 'ブランド', '店舗', '姓', '名', 'セイ', 'メイ', '郵便番号', '都道府県', '市・区', '町村・番地', 'ビル名・建物名', 'ご予約のきっかけ', 'その他質問', '希望日', '希望時間', '携帯番号', 'メールアドレス', '年齢', 'キャンペーン名', 'キャンペーンID');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('pgcloud', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('pgcloud', 'タイムスタンプ', '受付日時（YYYY/MM/DD HH:MM:SS）', '改修', '2.2.301', NOW()),
  ('pgcloud', 'ブランド', 'ブランド（例 KH・DJH・JH・PG HOUSE・PGH・なごみ・2L）', '改修', '2.2.301', NOW()),
  ('pgcloud', '店舗', '店舗（ブランドの接頭辞＋来場希望の店舗。空なら「<ブランド>店舗未設定」）', '改修', '2.2.301', NOW()),
  ('pgcloud', '姓', '姓', '改修', '2.2.301', NOW()),
  ('pgcloud', '名', '名', '改修', '2.2.301', NOW()),
  ('pgcloud', 'セイ', '姓（カナ）', '改修', '2.2.301', NOW()),
  ('pgcloud', 'メイ', '名（カナ）', '改修', '2.2.301', NOW()),
  ('pgcloud', '郵便番号', '郵便番号', '改修', '2.2.301', NOW()),
  ('pgcloud', '都道府県', '都道府県', '改修', '2.2.301', NOW()),
  ('pgcloud', '市・区', '市・区', '改修', '2.2.301', NOW()),
  ('pgcloud', '町村・番地', '町村・番地', '改修', '2.2.301', NOW()),
  ('pgcloud', 'ビル名・建物名', 'ビル名・建物名', '改修', '2.2.301', NOW()),
  ('pgcloud', 'ご予約のきっかけ', 'ご予約のきっかけ（反響一覧の response_medium と同じ）', '改修', '2.2.301', NOW()),
  ('pgcloud', 'その他質問', 'その他・ご質問', '改修', '2.2.301', NOW()),
  ('pgcloud', '希望日', '来場希望日', '改修', '2.2.301', NOW()),
  ('pgcloud', '希望時間', '来場希望時間', '改修', '2.2.301', NOW()),
  ('pgcloud', '携帯番号', '携帯番号', '改修', '2.2.301', NOW()),
  ('pgcloud', 'メールアドレス', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('pgcloud', '年齢', '年齢', '改修', '2.2.301', NOW()),
  ('pgcloud', 'キャンペーン名', 'キャンペーン名（反響一覧の hp_campaign と同じ）', '改修', '2.2.301', NOW()),
  ('pgcloud', 'キャンペーンID', 'キャンペーンID（form_table の campaign_id）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- pgcloud_data：PG CLOUD の顧客データの写し
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('pgcloud_data', 'PG CLOUD の顧客データの写し', 'order', '（推定）以前の顧客管理システム PG CLOUD から書き出した注文住宅の顧客データ。1行が1人。
コードからの使用箇所なし（推定：顧客DB を Dashboard に移す前後に取り込んだ写し）。
登録日は 2025/01/20 までで止まっている（700件）。username は顧客DB（master_data）の id とは一致しない。
⚠️ 年収・家族・借入など機微な個人情報を含む。使わないなら整理の対象（推定）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'pgcloud_data' AND column_name NOT IN ('username', 'shop', 'staff', 'register', 'interview', 'tag', 'address', 'situation', 'label', 'estate', 'furigana', 'rank', 'landline', 'mobile', 'mail', 'sex', 'birthday', 'employment', 'company', 'companyAddress', 'companyTerm', 'income', 'family', 'primarySchool', 'juniorHighSchool', 'zip', 'anotherAddress', 'house', 'utilityExpenses', 'rent', 'budget', 'estateBudget', 'contractDate', 'repayment', 'bonus', 'debt', 'note', 'brand', 'firstInterviewer', 'lastAction', 'lastActionDate', 'recentPlan', 'registerDate', 'telephone', 'firstInterview', 'contract', 'cancel', 'transfer', 'introductionName', 'introduction', 'introductionDate', 'registerName', 'updateName');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('pgcloud_data', 'username', '（推定）PG CLOUD 上の顧客の ID・ログイン名', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'shop', '担当店舗（例 DJH霧島店）', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'staff', '担当営業', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'register', '（推定）登録日・登録区分', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'interview', '（推定）面談日', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'tag', 'タグ', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'address', '住所', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'situation', '状況（例 見込み・重複・失注）', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'label', '（推定）ラベル', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'estate', '（推定）土地の有無', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'furigana', 'フリガナ', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'rank', '顧客ランク（例 Aランク〜Eランク）', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'landline', '固定電話', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'mobile', '携帯番号', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'mail', 'メールアドレス', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'sex', '性別', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'birthday', '生年月日', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'employment', '勤務形態', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'company', '勤務先', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'companyAddress', '勤務先の住所', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'companyTerm', '勤続年数', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'income', '年収', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'family', '家族', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'primarySchool', '小学校区', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'juniorHighSchool', '中学校区', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'zip', '郵便番号', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'anotherAddress', '（推定）別の住所', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'house', '（推定）今の住まいの形態', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'utilityExpenses', '（推定）光熱費', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'rent', '家賃', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'budget', '予算', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'estateBudget', '土地の予算', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'contractDate', '契約日', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'repayment', '（推定）希望の返済額', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'bonus', '（推定）ボーナス払い', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'debt', '借入', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'note', '備考', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'brand', 'ブランド（例 国分ハウジング・デイジャストハウス・なごみ工務店）', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'firstInterviewer', '初回面談の担当', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'lastAction', '最終アクション', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'lastActionDate', '最終アクションの日', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'recentPlan', '（推定）直近の予定', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'registerDate', '登録日（例 2025年01月20日）', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'telephone', '（推定）電話の記録', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'firstInterview', '（推定）初回面談日', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'contract', '（推定）契約', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'cancel', '（推定）キャンセル', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'transfer', '（推定）引き継ぎ', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'introductionName', '紹介者名', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'introduction', '紹介の区分', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'introductionDate', '紹介日', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'registerName', '登録した人', '推論', '2.2.301', NOW()),
  ('pgcloud_data', 'updateName', '更新した人', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- population：人口（年齢別）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('population', '人口（年齢別）', 'common', '国勢調査の人口（5歳きざみ）。1行が「1市区町村（または県全域）× 性別 × 調査年」。全国版 CSV から対象県ぶんを取り込む（backend-express/scripts/import-population-csv.mjs。表は 2026-08-27_population.sql）。
市況分析の表の「行」を決める土台（都道府県の選択肢・他の表の絞り込みもここが基準）。
⚠️ 対象の県を増やすときは、まずここへ入れる。⚠️ (pref, area, gender, year) が一意。
⚠️ ローカルの写しは 6県・2025 年のみ。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'population' AND column_name NOT IN ('no', 'pref', 'area', 'gender', 'year', 'amount', 'age_0_4', 'age_5_9', 'age_10_14', 'age_15_19', 'age_20_24', 'age_25_29', 'age_30_34', 'age_35_39', 'age_40_44', 'age_45_49', 'age_50_54', 'age_55_59', 'age_60_64', 'age_65_69', 'age_70_74', 'age_75_79', 'age_80_84', 'age_85_89', 'age_90_94', 'age_95_99', 'age_100_');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('population', 'no', '連番', '改修', '2.2.301', NOW()),
  ('population', 'pref', '都道府県名', '改修', '2.2.301', NOW()),
  ('population', 'area', '市区町村名。県全域は "-"', '改修', '2.2.301', NOW()),
  ('population', 'gender', '計 / 男 / 女', '改修', '2.2.301', NOW()),
  ('population', 'year', '調査年', '改修', '2.2.301', NOW()),
  ('population', 'amount', '総人口。年齢不詳を含むため世代の合計とは一致しない', '改修', '2.2.301', NOW()),
  ('population', 'age_0_4', '0〜4歳', '改修', '2.2.301', NOW()),
  ('population', 'age_5_9', '5〜9歳', '改修', '2.2.301', NOW()),
  ('population', 'age_10_14', '10〜14歳', '改修', '2.2.301', NOW()),
  ('population', 'age_15_19', '15〜19歳', '改修', '2.2.301', NOW()),
  ('population', 'age_20_24', '20〜24歳', '改修', '2.2.301', NOW()),
  ('population', 'age_25_29', '25〜29歳', '改修', '2.2.301', NOW()),
  ('population', 'age_30_34', '30〜34歳', '改修', '2.2.301', NOW()),
  ('population', 'age_35_39', '35〜39歳', '改修', '2.2.301', NOW()),
  ('population', 'age_40_44', '40〜44歳', '改修', '2.2.301', NOW()),
  ('population', 'age_45_49', '45〜49歳', '改修', '2.2.301', NOW()),
  ('population', 'age_50_54', '50〜54歳', '改修', '2.2.301', NOW()),
  ('population', 'age_55_59', '55〜59歳', '改修', '2.2.301', NOW()),
  ('population', 'age_60_64', '60〜64歳', '改修', '2.2.301', NOW()),
  ('population', 'age_65_69', '65〜69歳', '改修', '2.2.301', NOW()),
  ('population', 'age_70_74', '70〜74歳', '改修', '2.2.301', NOW()),
  ('population', 'age_75_79', '75〜79歳', '改修', '2.2.301', NOW()),
  ('population', 'age_80_84', '80〜84歳', '改修', '2.2.301', NOW()),
  ('population', 'age_85_89', '85〜89歳', '改修', '2.2.301', NOW()),
  ('population', 'age_90_94', '90〜94歳', '改修', '2.2.301', NOW()),
  ('population', 'age_95_99', '95〜99歳', '改修', '2.2.301', NOW()),
  ('population', 'age_100_', '100歳以上', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- population_backup_20260827：人口（年齢別）の旧版
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('population_backup_20260827', '人口（年齢別）の旧版', 'common', 'population（人口）を作り直したときに退避した旧の表（2026-08-27。backend-express/scripts/sql/2026-08-27_population.sql の RENAME）。列は今の population と同じで、型が text のまま。
⚠️ 画面・処理からは使っていない（推定）。
⚠️ SQL のコメントでは旧の表は5県・582行とあるが、ローカルの写しには全都道府県ぶんが入っている（推定：入れ替えの前後で中身が変わった）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'population_backup_20260827' AND column_name NOT IN ('no', 'pref', 'area', 'gender', 'year', 'amount', 'age_0_4', 'age_5_9', 'age_10_14', 'age_15_19', 'age_20_24', 'age_25_29', 'age_30_34', 'age_35_39', 'age_40_44', 'age_45_49', 'age_50_54', 'age_55_59', 'age_60_64', 'age_65_69', 'age_70_74', 'age_75_79', 'age_80_84', 'age_85_89', 'age_90_94', 'age_95_99', 'age_100_');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('population_backup_20260827', 'no', '連番', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'pref', '都道府県名', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'area', '市区町村名。県全域は "-"', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'gender', '計 / 男 / 女', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'year', '調査年', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'amount', '総人口。年齢不詳を含むため世代の合計とは一致しない', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_0_4', '0〜4歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_5_9', '5〜9歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_10_14', '10〜14歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_15_19', '15〜19歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_20_24', '20〜24歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_25_29', '25〜29歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_30_34', '30〜34歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_35_39', '35〜39歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_40_44', '40〜44歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_45_49', '45〜49歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_50_54', '50〜54歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_55_59', '55〜59歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_60_64', '60〜64歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_65_69', '65〜69歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_70_74', '70〜74歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_75_79', '75〜79歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_80_84', '80〜84歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_85_89', '85〜89歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_90_94', '90〜94歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_95_99', '95〜99歳', '改修', '2.2.301', NOW()),
  ('population_backup_20260827', 'age_100_', '100歳以上', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- pre_kaeru：建売の先取物件の申し込み
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('pre_kaeru', '建売の先取物件の申し込み', 'spec', 'かえるホームのホームページの「先取物件」（公開前の物件情報）の申し込みメールを取り込んだ元の表。1行＝申し込み1人（メールアドレスで1行）。
書くもの：メールの取り込み（sync）が ① の request pre_kaeru_update で送る（pre_kaeru_update.php）。同じメールアドレスがあれば上書き、無ければ `pk_` で始まる ID を作って INSERT。
続けて ① handlers/portal/pre_kaeru.php が反響一覧（inquiry_customer_kaeru）へ `hp_pre_<id>` で写す（medium＝ホームページ反響・response_medium＝Web検索・hp_campaign＝先取物件）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'pre_kaeru' AND column_name NOT IN ('id', 'email', 'name', 'name_kana', 'tel', 'zip', 'address', 'pre_properties', 'questions', 'registered_at', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('pre_kaeru', 'id', '申し込みの ID（`pk_` で始まる）。反響ID の末尾になる', '改修', '2.2.301', NOW()),
  ('pre_kaeru', 'email', 'メールアドレス。⚠️ 同じ人かどうかはこれで決める', '改修', '2.2.301', NOW()),
  ('pre_kaeru', 'name', 'お名前', '改修', '2.2.301', NOW()),
  ('pre_kaeru', 'name_kana', 'フリガナ', '改修', '2.2.301', NOW()),
  ('pre_kaeru', 'tel', '電話番号（反響一覧の mobile に入る）', '改修', '2.2.301', NOW()),
  ('pre_kaeru', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('pre_kaeru', 'address', 'ご住所（反響一覧の building に入る）', '改修', '2.2.301', NOW()),
  ('pre_kaeru', 'pre_properties', '申し込んだ先取物件（反響一覧の area に入る）', '改修', '2.2.301', NOW()),
  ('pre_kaeru', 'questions', 'ご質問など', '改修', '2.2.301', NOW()),
  ('pre_kaeru', 'registered_at', '受付日時', '改修', '2.2.301', NOW()),
  ('pre_kaeru', 'remarks', 'メモ（メールの全項目をつないだ文。反響一覧の note）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- property_db：物件DB（いえらぶの物件）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('property_db', '物件DB（いえらぶの物件）', 'common', 'いえらぶ（物件管理システム）の物件一覧の写し。1行＝物件1つ（property_id＝いえらぶの6桁の物件番号。UNIQUE）。建売（株式会社 国分ハウジング不動産 本店）と中古（国分ハウジンググループ中古住宅専門店）の物件が1つの表に入る（store_name で分ける）。
書くもの：
- いえらぶの CSV の取り込み（② realty/ieloveImport.ts。不動産企画係の「設定・データ管理」。v2.2.260〜）。物件番号で上書きし、価格が変わったら price_raw に足す。以前は sync が毎日 ① property_db_update.php へ送っていた（PHP は残っている）。
- ポータルのデータで補う（② propertyPortal.ts。request property_db_portal。v2.2.301）。⚠️ 空の列だけ埋め、無い物件は作る（docs/property-db-portal.md）。
- 経緯度（① customer_address.php が lat_lng を入れる）。
読むもの：物件DB（DatabaseProperty.tsx）・物件の詳細（PropertySummary.tsx）・SUUMO物件サマリー（② propertyGet.ts。v2.2.301 から GET）、顧客の編集の物件の選択肢（② information/index.ts）、媒介獲得台帳とのつなぎ（② realty/ieloveMatch.ts）。
⚠️ 「契約済み」の物件は「その店舗の最新の取得日（registered）でない物件」（最新の取り込みで無くなった物件）。⚠️ registered を今日にして行を作ると、ほかの物件がすべて契約済みに見える。
⚠️ いえらぶの番号が無い行を作らない（取り込みが property_id で上書きするので二重になる）。
⚠️ store_name は全角の空白を含めて1文字も違わないこと（画面は空白を消して比べる）。ローカルには「株式会社国分ハウジング不動産」（本店の付かない古い表記）の行もあり、建売・中古のどちらの画面にも出ない（推定）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'property_db' AND column_name NOT IN ('no', 'property_id', 'management_code', 'store_name', 'property_staff', 'transaction_type', 'property_type', 'address', 'property_name', 'room_number', 'land_area', 'building_area', 'layout', 'building_age', 'price', 'gross_yield', 'transportation', 'agency', 'staff_in_charge', 'tel', 'report_date', 'next_report_date', 'expected_yield', 'total_units', 'structure', 'zoning', 'zoning_2', 'seller', 'owner', 'price_raw', 'investment_type', 'expiry_date', 'publishing_instruction', 'internal_note', 'registered', 'lat_lng');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('property_db', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('property_db', 'property_id', '物件番号（いえらぶの6桁）。⚠️ UNIQUE。ポータルの管理番号（SUUMO の management_no・HOME''S の company_management_number・at home の management_no の下6桁）と結ぶ', '改修', '2.2.301', NOW()),
  ('property_db', 'management_code', '管理コード', '改修', '2.2.301', NOW()),
  ('property_db', 'store_name', '担当店舗名（株式会社　国分ハウジング不動産　本店＝建売／国分ハウジンググループ中古住宅専門店＝中古）', '改修', '2.2.301', NOW()),
  ('property_db', 'property_staff', '物件担当者。画面の「担当」の絞り込み', '改修', '2.2.301', NOW()),
  ('property_db', 'transaction_type', '取引態様（例 仲介・専属専任媒介・専任媒介・一般媒介）', '改修', '2.2.301', NOW()),
  ('property_db', 'property_type', '物件種別（例 新築一戸建て・中古一戸建て・売地・中古マンション）', '改修', '2.2.301', NOW()),
  ('property_db', 'address', '所在地', '改修', '2.2.301', NOW()),
  ('property_db', 'property_name', '物件名（「(公開)」などが付く。顧客の問い合わせ物件 property_name と突き合わせる）', '改修', '2.2.301', NOW()),
  ('property_db', 'room_number', '空き物件内容（部屋番号）', '改修', '2.2.301', NOW()),
  ('property_db', 'land_area', '土地面積', '改修', '2.2.301', NOW()),
  ('property_db', 'building_area', '建物面積（例「壁芯67.99㎡」）', '改修', '2.2.301', NOW()),
  ('property_db', 'layout', '間取り', '改修', '2.2.301', NOW()),
  ('property_db', 'building_age', '築年数（いえらぶは「1978年12月」のような建築年月）', '改修', '2.2.301', NOW()),
  ('property_db', 'price', '価格（例「900万円」）', '改修', '2.2.301', NOW()),
  ('property_db', 'gross_yield', '表面利回り', '改修', '2.2.301', NOW()),
  ('property_db', 'transportation', '交通1（例「路線「駅」駅 徒歩5分」）', '改修', '2.2.301', NOW()),
  ('property_db', 'agency', '取扱業者。画面の「取扱」「自社物件を表示」の絞り込み', '改修', '2.2.301', NOW()),
  ('property_db', 'staff_in_charge', '担当者（取扱業者の担当）', '改修', '2.2.301', NOW()),
  ('property_db', 'tel', '電話番号（取扱業者）', '改修', '2.2.301', NOW()),
  ('property_db', 'report_date', '活動報告日', '改修', '2.2.301', NOW()),
  ('property_db', 'next_report_date', '活動報告予定日', '改修', '2.2.301', NOW()),
  ('property_db', 'expected_yield', '想定利回り', '改修', '2.2.301', NOW()),
  ('property_db', 'total_units', '総戸数・総区画数', '改修', '2.2.301', NOW()),
  ('property_db', 'structure', '建物構造', '改修', '2.2.301', NOW()),
  ('property_db', 'zoning', '用途地域', '改修', '2.2.301', NOW()),
  ('property_db', 'zoning_2', '用途地域2', '改修', '2.2.301', NOW()),
  ('property_db', 'seller', '売主', '改修', '2.2.301', NOW()),
  ('property_db', 'owner', '所有者', '改修', '2.2.301', NOW()),
  ('property_db', 'price_raw', '価格の履歴（JSON 配列 [{"date":"YYYY/MM/DD","value":"円"}]）。取り込みで価格が変わったときだけ足す', '改修', '2.2.301', NOW()),
  ('property_db', 'investment_type', '実需・投資', '改修', '2.2.301', NOW()),
  ('property_db', 'expiry_date', '掲載期限', '改修', '2.2.301', NOW()),
  ('property_db', 'publishing_instruction', '物件掲載指示（掲載先。例「HOME''S/SUUMO/アットホーム/いえらぶポータル/汎用連動」）', '改修', '2.2.301', NOW()),
  ('property_db', 'internal_note', '社内用メモ１', '改修', '2.2.301', NOW()),
  ('property_db', 'registered', '取得日（yyyy/mm/dd。取り込んだ日）。⚠️ 契約済みの判定に使う', '改修', '2.2.301', NOW()),
  ('property_db', 'lat_lng', '経緯度（「緯度,経度」）。① customer_address.php が入れる。物件の詳細の地図', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- property_list_kaeru：物件一覧（旧）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('property_list_kaeru', '物件一覧（旧）', 'spec', '（推定）いえらぶの物件一覧を取り込んでいた古い表。property_db と同じ項目を別の列名で持つ（約500件）。今の物件DB は property_db。
コードからの使用箇所なし（推定：property_db に置き換わった旧表）。① geoCode.php だけが latitude・longitude を書くが、2026-09-15 以降は呼ばれていない（以前は物件番号の取り違えで常に 0 行更新だった）。
⚠️ geoCode.php を復活させない（Geocoding の二重取得に戻る。物件の経緯度は property_db.lat_lng）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'property_list_kaeru' AND column_name NOT IN ('no', 'property_number', 'management_code', 'in_charge_store', 'property_staff', 'transaction_type', 'property_type', 'address', 'property_name', 'room_number', 'land_area', 'building_area', 'floor_plan', 'building_age', 'price', 'gross_yield', 'transport_1', 'handling_company', 'staff_in_charge', 'phone_number', 'activity_report_date', 'scheduled_activity_report_date', 'assumed_yield', 'total_units', 'building_structure', 'zoning', 'zoning_2', 'seller', 'owner', 'original_item_1', 'price_unitless', 'latitude', 'longitude');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('property_list_kaeru', 'no', '連番（自動採番）', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'property_number', '物件番号（いえらぶ。property_db.property_id にあたる）', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'management_code', '管理コード', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'in_charge_store', '担当店舗名', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'property_staff', '物件担当者', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'transaction_type', '取引態様', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'property_type', '物件種別', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'address', '所在地', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'property_name', '物件名', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'room_number', '空き物件内容（部屋番号）', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'land_area', '土地面積', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'building_area', '建物面積', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'floor_plan', '間取り', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'building_age', '築年数', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'price', '価格', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'gross_yield', '表面利回り', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'transport_1', '交通1', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'handling_company', '取扱業者', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'staff_in_charge', '担当者', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'phone_number', '電話番号', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'activity_report_date', '活動報告日', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'scheduled_activity_report_date', '活動報告予定日', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'assumed_yield', '想定利回り', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'total_units', '総戸数・総区画数', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'building_structure', '建物構造', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'zoning', '用途地域', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'zoning_2', '用途地域2', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'seller', '売主', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'owner', '所有者', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'original_item_1', '（推定）いえらぶの独自項目1', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'price_unitless', '価格（単位なし）', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'latitude', '緯度（geoCode.php が書くはずだった。読む処理は無い）', '推論', '2.2.301', NOW()),
  ('property_list_kaeru', 'longitude', '経度（同上）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- proposal_images：提案資料のページ画像
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('proposal_images', '提案資料のページ画像', 'common', '（推定）提案資料などの PDF をページごとの画像にしたもの。1ページ＝1行。2026-02-09 に2つの PDF（98ページ）を入れたきり。
コードからの使用箇所なし（推定：勉強会の資料をスライドのように見せる試作の表）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'proposal_images' AND column_name NOT IN ('no', 'pdf_id', 'page_number', 'file_path', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('proposal_images', 'no', '連番', '推論', '2.2.301', NOW()),
  ('proposal_images', 'pdf_id', '（推定）元の PDF の番号', '推論', '2.2.301', NOW()),
  ('proposal_images', 'page_number', '（推定）ページ番号', '推論', '2.2.301', NOW()),
  ('proposal_images', 'file_path', '（推定）ページの画像のパス（/exports/images/…）', '推論', '2.2.301', NOW()),
  ('proposal_images', 'created_at', '（推定）作った日', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- raclear_djh：旧顧客管理の顧客（DJH（デイジャストハウス））
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('raclear_djh', '旧顧客管理の顧客（DJH（デイジャストハウス））', 'order', '（推定）以前使っていた顧客管理システム（ラクリア）から書き出した DJH（デイジャストハウス） の顧客の一覧を、CSV のまま取り込んだ表。1行が1顧客。約7,700件。
列名は CSV の日本語の見出しのまま、すべて text。主キーは無い。問い合わせ日は 2024-09-30 までで、それより新しい行は無い。
コードからの使用箇所なし（推定：顧客DB へ移す前の旧データの控え。開発用の写しの個人情報を伏せる backend/scripts/sql/dev/mask_personal_info.sql だけが触る）。
⚠️ お客様の個人情報（氏名・連絡先・住所・生年月日）がそのまま入っている。値を画面やドキュメントに写さない。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'raclear_djh' AND column_name NOT IN ('名前(漢字)', '名前(かな)', 'ニックネーム', 'メールアドレス', '電話番号', 'FAX番号', '携帯電話番号', '郵便番号', '都道府県', '市・区', '町村・番地', 'ビル名・建物名・番号', '生年月日', 'メール配信可否', '担当ユーザ', 'ランク', '種別', '引渡し年月日', '状態', '備考', 'タグ', 'お問い合わせ日', '初回来場予定日', '初回来場予定時間', '初回来場場所', '初回来場日', 'イベント', '販促媒体', '販促媒体店舗', '認知媒体', 'ネック', 'ブランド');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('raclear_djh', '名前(漢字)', 'お客様の氏名（漢字）', '推論', '2.2.301', NOW()),
  ('raclear_djh', '名前(かな)', 'お客様の氏名（かな）', '推論', '2.2.301', NOW()),
  ('raclear_djh', 'ニックネーム', 'ニックネーム', '推論', '2.2.301', NOW()),
  ('raclear_djh', 'メールアドレス', 'メールアドレス', '推論', '2.2.301', NOW()),
  ('raclear_djh', '電話番号', '固定電話', '推論', '2.2.301', NOW()),
  ('raclear_djh', 'FAX番号', 'FAX', '推論', '2.2.301', NOW()),
  ('raclear_djh', '携帯電話番号', '携帯電話', '推論', '2.2.301', NOW()),
  ('raclear_djh', '郵便番号', '郵便番号', '推論', '2.2.301', NOW()),
  ('raclear_djh', '都道府県', '住所（都道府県）', '推論', '2.2.301', NOW()),
  ('raclear_djh', '市・区', '住所（市区）', '推論', '2.2.301', NOW()),
  ('raclear_djh', '町村・番地', '住所（町村・番地）', '推論', '2.2.301', NOW()),
  ('raclear_djh', 'ビル名・建物名・番号', '住所（建物名）', '推論', '2.2.301', NOW()),
  ('raclear_djh', '生年月日', '生年月日', '推論', '2.2.301', NOW()),
  ('raclear_djh', 'メール配信可否', 'メール配信の可否', '推論', '2.2.301', NOW()),
  ('raclear_djh', '担当ユーザ', '（推定）担当営業の名前', '推論', '2.2.301', NOW()),
  ('raclear_djh', 'ランク', '（推定）見込みのランク（S / A〜G）', '推論', '2.2.301', NOW()),
  ('raclear_djh', '種別', '（推定）店舗（KH の表では霧島店・鹿児島店 など。列名と中身が合っていない）', '推論', '2.2.301', NOW()),
  ('raclear_djh', '引渡し年月日', '引渡しの日', '推論', '2.2.301', NOW()),
  ('raclear_djh', '状態', '（推定）顧客の状態（有効 / 中長期管理 / 自社契約 / 他社契約 / 没 / 無効）', '推論', '2.2.301', NOW()),
  ('raclear_djh', '備考', '備考（自由記述）', '推論', '2.2.301', NOW()),
  ('raclear_djh', 'タグ', 'タグ', '推論', '2.2.301', NOW()),
  ('raclear_djh', 'お問い合わせ日', '問い合わせの日（文字列）', '推論', '2.2.301', NOW()),
  ('raclear_djh', '初回来場予定日', '初回来場の予定日', '推論', '2.2.301', NOW()),
  ('raclear_djh', '初回来場予定時間', '初回来場の予定時刻', '推論', '2.2.301', NOW()),
  ('raclear_djh', '初回来場場所', '初回来場の場所', '推論', '2.2.301', NOW()),
  ('raclear_djh', '初回来場日', '初回来場の日', '推論', '2.2.301', NOW()),
  ('raclear_djh', 'イベント', '（推定）来場したイベント', '推論', '2.2.301', NOW()),
  ('raclear_djh', '販促媒体', '反響の媒体', '推論', '2.2.301', NOW()),
  ('raclear_djh', '販促媒体店舗', '（推定）媒体の店舗', '推論', '2.2.301', NOW()),
  ('raclear_djh', '認知媒体', '（推定）知ったきっかけの媒体', '推論', '2.2.301', NOW()),
  ('raclear_djh', 'ネック', '（推定）検討のネック（自由記述）', '推論', '2.2.301', NOW()),
  ('raclear_djh', 'ブランド', 'ブランド（全行 DJH）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- raclear_furukomi：旧顧客管理の顧客（FH（フルコミホーム））
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('raclear_furukomi', '旧顧客管理の顧客（FH（フルコミホーム））', 'order', '（推定）以前使っていた顧客管理システム（ラクリア）から書き出した FH（フルコミホーム） の顧客の一覧を、CSV のまま取り込んだ表。1行が1顧客。約1,600件。⚠️ raclear_nieru と件数が同じで、中身も多くが重なる（推定：同じデータを2つの表に入れた）。
列名は CSV の日本語の見出しのまま、すべて text。主キーは無い。問い合わせ日は 2024-09-30 までで、それより新しい行は無い。
コードからの使用箇所なし（推定：顧客DB へ移す前の旧データの控え。開発用の写しの個人情報を伏せる backend/scripts/sql/dev/mask_personal_info.sql だけが触る）。
⚠️ お客様の個人情報（氏名・連絡先・住所・生年月日）がそのまま入っている。値を画面やドキュメントに写さない。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'raclear_furukomi' AND column_name NOT IN ('名前(漢字)', '名前(かな)', 'ニックネーム', 'メールアドレス', '電話番号', 'FAX番号', '携帯電話番号', '郵便番号', '都道府県', '市・区', '町村・番地', 'ビル名・建物名・番号', '生年月日', 'メール配信可否', '担当ユーザ', 'ランク', '種別', '引渡し年月日', '状態', '備考', 'タグ', 'お問い合わせ日', '初回来場予定日', '初回来場予定時間', '初回来場場所', '初回来場日', 'イベント', '販促媒体', '販促媒体店舗', '認知媒体', 'ネック', 'ブランド');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('raclear_furukomi', '名前(漢字)', 'お客様の氏名（漢字）', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '名前(かな)', 'お客様の氏名（かな）', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', 'ニックネーム', 'ニックネーム', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', 'メールアドレス', 'メールアドレス', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '電話番号', '固定電話', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', 'FAX番号', 'FAX', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '携帯電話番号', '携帯電話', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '郵便番号', '郵便番号', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '都道府県', '住所（都道府県）', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '市・区', '住所（市区）', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '町村・番地', '住所（町村・番地）', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', 'ビル名・建物名・番号', '住所（建物名）', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '生年月日', '生年月日', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', 'メール配信可否', 'メール配信の可否', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '担当ユーザ', '（推定）担当営業の名前', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', 'ランク', '（推定）見込みのランク（S / A〜G）', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '種別', '（推定）店舗（KH の表では霧島店・鹿児島店 など。列名と中身が合っていない）', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '引渡し年月日', '引渡しの日', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '状態', '（推定）顧客の状態（有効 / 中長期管理 / 自社契約 / 他社契約 / 没 / 無効）', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '備考', '備考（自由記述）', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', 'タグ', 'タグ', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', 'お問い合わせ日', '問い合わせの日（文字列）', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '初回来場予定日', '初回来場の予定日', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '初回来場予定時間', '初回来場の予定時刻', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '初回来場場所', '初回来場の場所', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '初回来場日', '初回来場の日', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', 'イベント', '（推定）来場したイベント', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '販促媒体', '反響の媒体', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '販促媒体店舗', '（推定）媒体の店舗', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', '認知媒体', '（推定）知ったきっかけの媒体', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', 'ネック', '（推定）検討のネック（自由記述）', '推論', '2.2.301', NOW()),
  ('raclear_furukomi', 'ブランド', 'ブランド（全行 FH）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- raclear_kh：旧顧客管理の顧客（KH）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('raclear_kh', '旧顧客管理の顧客（KH）', 'order', '（推定）以前使っていた顧客管理システム（ラクリア）から書き出した KH の顧客の一覧を、CSV のまま取り込んだ表。1行が1顧客。約15,800件。
列名は CSV の日本語の見出しのまま、すべて text。主キーは無い。問い合わせ日は 2024-09-30 までで、それより新しい行は無い。
コードからの使用箇所なし（推定：顧客DB へ移す前の旧データの控え。開発用の写しの個人情報を伏せる backend/scripts/sql/dev/mask_personal_info.sql だけが触る）。
⚠️ お客様の個人情報（氏名・連絡先・住所・生年月日）がそのまま入っている。値を画面やドキュメントに写さない。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'raclear_kh' AND column_name NOT IN ('名前(漢字)', '名前(かな)', 'ニックネーム', 'メールアドレス', '電話番号', 'FAX番号', '携帯電話番号', '郵便番号', '都道府県', '市・区', '町村・番地', 'ビル名・建物名・番号', '生年月日', 'メール配信可否', '担当ユーザ', 'ランク', '種別', '引渡し年月日', '状態', '備考', 'タグ', 'お問い合わせ日', '初回来場予定日', '初回来場予定時間', '初回来場場所', '初回来場日', 'イベント', '販促媒体', '販促媒体店舗', '認知媒体', 'ネック', 'ブランド');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('raclear_kh', '名前(漢字)', 'お客様の氏名（漢字）', '推論', '2.2.301', NOW()),
  ('raclear_kh', '名前(かな)', 'お客様の氏名（かな）', '推論', '2.2.301', NOW()),
  ('raclear_kh', 'ニックネーム', 'ニックネーム', '推論', '2.2.301', NOW()),
  ('raclear_kh', 'メールアドレス', 'メールアドレス', '推論', '2.2.301', NOW()),
  ('raclear_kh', '電話番号', '固定電話', '推論', '2.2.301', NOW()),
  ('raclear_kh', 'FAX番号', 'FAX', '推論', '2.2.301', NOW()),
  ('raclear_kh', '携帯電話番号', '携帯電話', '推論', '2.2.301', NOW()),
  ('raclear_kh', '郵便番号', '郵便番号', '推論', '2.2.301', NOW()),
  ('raclear_kh', '都道府県', '住所（都道府県）', '推論', '2.2.301', NOW()),
  ('raclear_kh', '市・区', '住所（市区）', '推論', '2.2.301', NOW()),
  ('raclear_kh', '町村・番地', '住所（町村・番地）', '推論', '2.2.301', NOW()),
  ('raclear_kh', 'ビル名・建物名・番号', '住所（建物名）', '推論', '2.2.301', NOW()),
  ('raclear_kh', '生年月日', '生年月日', '推論', '2.2.301', NOW()),
  ('raclear_kh', 'メール配信可否', 'メール配信の可否', '推論', '2.2.301', NOW()),
  ('raclear_kh', '担当ユーザ', '（推定）担当営業の名前', '推論', '2.2.301', NOW()),
  ('raclear_kh', 'ランク', '（推定）見込みのランク（S / A〜G）', '推論', '2.2.301', NOW()),
  ('raclear_kh', '種別', '（推定）店舗（KH の表では霧島店・鹿児島店 など。列名と中身が合っていない）', '推論', '2.2.301', NOW()),
  ('raclear_kh', '引渡し年月日', '引渡しの日', '推論', '2.2.301', NOW()),
  ('raclear_kh', '状態', '（推定）顧客の状態（有効 / 中長期管理 / 自社契約 / 他社契約 / 没 / 無効）', '推論', '2.2.301', NOW()),
  ('raclear_kh', '備考', '備考（自由記述）', '推論', '2.2.301', NOW()),
  ('raclear_kh', 'タグ', 'タグ', '推論', '2.2.301', NOW()),
  ('raclear_kh', 'お問い合わせ日', '問い合わせの日（文字列）', '推論', '2.2.301', NOW()),
  ('raclear_kh', '初回来場予定日', '初回来場の予定日', '推論', '2.2.301', NOW()),
  ('raclear_kh', '初回来場予定時間', '初回来場の予定時刻', '推論', '2.2.301', NOW()),
  ('raclear_kh', '初回来場場所', '初回来場の場所', '推論', '2.2.301', NOW()),
  ('raclear_kh', '初回来場日', '初回来場の日', '推論', '2.2.301', NOW()),
  ('raclear_kh', 'イベント', '（推定）来場したイベント', '推論', '2.2.301', NOW()),
  ('raclear_kh', '販促媒体', '反響の媒体', '推論', '2.2.301', NOW()),
  ('raclear_kh', '販促媒体店舗', '（推定）媒体の店舗', '推論', '2.2.301', NOW()),
  ('raclear_kh', '認知媒体', '（推定）知ったきっかけの媒体', '推論', '2.2.301', NOW()),
  ('raclear_kh', 'ネック', '（推定）検討のネック（自由記述）', '推論', '2.2.301', NOW()),
  ('raclear_kh', 'ブランド', 'ブランド（全行 KH）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- raclear_nagomi：旧顧客管理の顧客（なごみ）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('raclear_nagomi', '旧顧客管理の顧客（なごみ）', 'order', '（推定）以前使っていた顧客管理システム（ラクリア）から書き出した なごみ の顧客の一覧を、CSV のまま取り込んだ表。1行が1顧客。約1,400件。
列名は CSV の日本語の見出しのまま、すべて text。主キーは無い。問い合わせ日は 2024-09-30 までで、それより新しい行は無い。
コードからの使用箇所なし（推定：顧客DB へ移す前の旧データの控え。開発用の写しの個人情報を伏せる backend/scripts/sql/dev/mask_personal_info.sql だけが触る）。
⚠️ お客様の個人情報（氏名・連絡先・住所・生年月日）がそのまま入っている。値を画面やドキュメントに写さない。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'raclear_nagomi' AND column_name NOT IN ('名前(漢字)', '名前(かな)', 'ニックネーム', 'メールアドレス', '電話番号', 'FAX番号', '携帯電話番号', '郵便番号', '都道府県', '市・区', '町村・番地', 'ビル名・建物名・番号', '生年月日', 'メール配信可否', '担当ユーザ', 'ランク', '種別', '引渡し年月日', '状態', '備考', 'タグ', 'お問い合わせ日', '初回来場予定日', '初回来場予定時間', '初回来場場所', '初回来場日', 'イベント', '販促媒体', '販促媒体店舗', '認知媒体', 'ネック', 'ブランド');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('raclear_nagomi', '名前(漢字)', 'お客様の氏名（漢字）', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '名前(かな)', 'お客様の氏名（かな）', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', 'ニックネーム', 'ニックネーム', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', 'メールアドレス', 'メールアドレス', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '電話番号', '固定電話', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', 'FAX番号', 'FAX', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '携帯電話番号', '携帯電話', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '郵便番号', '郵便番号', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '都道府県', '住所（都道府県）', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '市・区', '住所（市区）', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '町村・番地', '住所（町村・番地）', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', 'ビル名・建物名・番号', '住所（建物名）', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '生年月日', '生年月日', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', 'メール配信可否', 'メール配信の可否', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '担当ユーザ', '（推定）担当営業の名前', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', 'ランク', '（推定）見込みのランク（S / A〜G）', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '種別', '（推定）店舗（KH の表では霧島店・鹿児島店 など。列名と中身が合っていない）', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '引渡し年月日', '引渡しの日', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '状態', '（推定）顧客の状態（有効 / 中長期管理 / 自社契約 / 他社契約 / 没 / 無効）', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '備考', '備考（自由記述）', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', 'タグ', 'タグ', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', 'お問い合わせ日', '問い合わせの日（文字列）', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '初回来場予定日', '初回来場の予定日', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '初回来場予定時間', '初回来場の予定時刻', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '初回来場場所', '初回来場の場所', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '初回来場日', '初回来場の日', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', 'イベント', '（推定）来場したイベント', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '販促媒体', '反響の媒体', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '販促媒体店舗', '（推定）媒体の店舗', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', '認知媒体', '（推定）知ったきっかけの媒体', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', 'ネック', '（推定）検討のネック（自由記述）', '推論', '2.2.301', NOW()),
  ('raclear_nagomi', 'ブランド', 'ブランド（全行 nagomi）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- raclear_nieru：旧顧客管理の顧客（2L（ニーエルホーム））
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('raclear_nieru', '旧顧客管理の顧客（2L（ニーエルホーム））', 'order', '（推定）以前使っていた顧客管理システム（ラクリア）から書き出した 2L（ニーエルホーム） の顧客の一覧を、CSV のまま取り込んだ表。1行が1顧客。約1,600件。⚠️ raclear_furukomi と件数が同じで、中身も多くが重なる（推定：同じデータを2つの表に入れた）。
列名は CSV の日本語の見出しのまま、すべて text。主キーは無い。問い合わせ日は 2024-09-30 までで、それより新しい行は無い。
コードからの使用箇所なし（推定：顧客DB へ移す前の旧データの控え。開発用の写しの個人情報を伏せる backend/scripts/sql/dev/mask_personal_info.sql だけが触る）。
⚠️ お客様の個人情報（氏名・連絡先・住所・生年月日）がそのまま入っている。値を画面やドキュメントに写さない。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'raclear_nieru' AND column_name NOT IN ('名前(漢字)', '名前(かな)', 'ニックネーム', 'メールアドレス', '電話番号', 'FAX番号', '携帯電話番号', '郵便番号', '都道府県', '市・区', '町村・番地', 'ビル名・建物名・番号', '生年月日', 'メール配信可否', '担当ユーザ', 'ランク', '種別', '引渡し年月日', '状態', '備考', 'タグ', 'お問い合わせ日', '初回来場予定日', '初回来場予定時間', '初回来場場所', '初回来場日', 'イベント', '販促媒体', '販促媒体店舗', '認知媒体', 'ネック', 'ブランド');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('raclear_nieru', '名前(漢字)', 'お客様の氏名（漢字）', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '名前(かな)', 'お客様の氏名（かな）', '推論', '2.2.301', NOW()),
  ('raclear_nieru', 'ニックネーム', 'ニックネーム', '推論', '2.2.301', NOW()),
  ('raclear_nieru', 'メールアドレス', 'メールアドレス', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '電話番号', '固定電話', '推論', '2.2.301', NOW()),
  ('raclear_nieru', 'FAX番号', 'FAX', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '携帯電話番号', '携帯電話', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '郵便番号', '郵便番号', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '都道府県', '住所（都道府県）', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '市・区', '住所（市区）', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '町村・番地', '住所（町村・番地）', '推論', '2.2.301', NOW()),
  ('raclear_nieru', 'ビル名・建物名・番号', '住所（建物名）', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '生年月日', '生年月日', '推論', '2.2.301', NOW()),
  ('raclear_nieru', 'メール配信可否', 'メール配信の可否', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '担当ユーザ', '（推定）担当営業の名前', '推論', '2.2.301', NOW()),
  ('raclear_nieru', 'ランク', '（推定）見込みのランク（S / A〜G）', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '種別', '（推定）店舗（KH の表では霧島店・鹿児島店 など。列名と中身が合っていない）', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '引渡し年月日', '引渡しの日', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '状態', '（推定）顧客の状態（有効 / 中長期管理 / 自社契約 / 他社契約 / 没 / 無効）', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '備考', '備考（自由記述）', '推論', '2.2.301', NOW()),
  ('raclear_nieru', 'タグ', 'タグ', '推論', '2.2.301', NOW()),
  ('raclear_nieru', 'お問い合わせ日', '問い合わせの日（文字列）', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '初回来場予定日', '初回来場の予定日', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '初回来場予定時間', '初回来場の予定時刻', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '初回来場場所', '初回来場の場所', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '初回来場日', '初回来場の日', '推論', '2.2.301', NOW()),
  ('raclear_nieru', 'イベント', '（推定）来場したイベント', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '販促媒体', '反響の媒体', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '販促媒体店舗', '（推定）媒体の店舗', '推論', '2.2.301', NOW()),
  ('raclear_nieru', '認知媒体', '（推定）知ったきっかけの媒体', '推論', '2.2.301', NOW()),
  ('raclear_nieru', 'ネック', '（推定）検討のネック（自由記述）', '推論', '2.2.301', NOW()),
  ('raclear_nieru', 'ブランド', 'ブランド（全行 2L）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- realty_call_logs：架電ナビの通話記録
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('realty_call_logs', '架電ナビの通話記録', 'realty', '不動産企画係の架電ナビの「記録して次へ」1回 = 1行（v2.2.226）。以前のアプリ（Supabase）の call_logs と同じ中身。
書くのは ② planner:navi_save（架電ナビ。反響の更新と同じトランザクション）と planner:call_logs_import（以前のアプリの CSV の取り込み。マスターだけ）。読むのは ② planner:call_logs（架電ナビの「履歴・分析」）。
⚠️ 文字起こし・ヒアリングの詳細は反響（brokerage_listings）には入れず、この表だけに持つ。⚠️ 日時は日本時間。⚠️ JSON の列は文字列のまま持つ。
⚠️ 売主の名前・住所などの個人情報を含む。⚠️ ローカルは 0 件。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'realty_call_logs' AND column_name NOT IN ('id', 'src_id', 'created_at', 'created_by', 'lead_id', 'lead_kind', 'staff', 'customer', 'media', 'address', 'ms_name', 'room', 'station', 'prop_type', 'area', 'built', 'owner', 'occupancy', 'loan', 'loan_amount', 'wish_price', 'wish_time', 'temperature', 'reason', 'asker', 'status', 'outcome', 'next_action', 'appt_at', 'appt_place', 'started_at', 'duration_sec', 'max_step', 'hearing', 'rebuttals', 'events', 'transcript', 'memo', 'app_ver');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('realty_call_logs', 'id', '連番（主キー）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'src_id', '以前のアプリ（Supabase）の id。CSV の取り込みの二重防止。Dashboard で記録した行は NULL', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'created_at', '記録した日時（日本時間）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'created_by', '記録した人（Dashboard のログイン名。取り込みは空）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'lead_id', '売り反響の id（brokerage_listings.id）。反響を選ばずに始めた通話は NULL', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'lead_kind', '反響の種別（brokerage_listings.kind。navi_save は leads を入れる）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'staff', 'ナビの画面の担当者（略称）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'customer', '売主の名前（ナビの入力）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'media', '反響の媒体', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'address', '物件の住所', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'ms_name', 'マンション名', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'room', '部屋番号', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'station', '最寄り駅', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'prop_type', '物件の種別', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'area', '面積', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'built', '築年', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'owner', '名義人（続柄を括弧で付ける）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'occupancy', '居住の状況（補足を括弧で付ける）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'loan', 'ローンの有無', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'loan_amount', 'ローンの残高', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'wish_price', '希望価格', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'wish_time', '売却の希望時期', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'temperature', '売却の温度感', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'reason', '売却理由（離婚・相続・住替え・資産整理）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'asker', '問合せ主（名義人・名義人以外 など。売却理由ごとの選択肢）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'status', '状況（売却理由と問合せ主ごとの選択肢。例「相続手続き中」）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'outcome', '通話結果（訪問アポ獲得・不在・不通 など）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'next_action', '次のアクション', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'appt_at', 'アポの日時（日本時間）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'appt_place', 'アポの場所', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'started_at', '通話開始（日本時間）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'duration_sec', '通話の秒数', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'max_step', 'どこまで進んだか（1〜9）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'hearing', 'ヒアリング（JSON。{項目: メモ}）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'rebuttals', '表示した切り返しの id（JSON 配列）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'events', '操作の記録（JSON 配列）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'transcript', '文字起こし（JSON 配列 [{t, x}]）', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'memo', '通話メモ', '改修', '2.2.301', NOW()),
  ('realty_call_logs', 'app_ver', '記録したときのアプリの版', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- realty_practice_logs：ロープレ練習の記録
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('realty_practice_logs', 'ロープレ練習の記録', 'realty', '不動産企画係のロープレ練習1回 = 1行（v2.2.226）。以前のアプリ（Supabase）の practice_logs と同じ中身。
書くのは ② planner:practice_logs_import（以前のアプリの CSV の取り込み。マスターだけ）だけ。⚠️ 練習の画面は移行中で、Dashboard から書く処理・読む画面はまだ無い（推定）。
⚠️ 日時は日本時間。⚠️ JSON の列は文字列のまま持つ。⚠️ ローカルは 0 件。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'realty_practice_logs' AND column_name NOT IN ('id', 'src_id', 'created_at', 'staff', 'mode', 'level', 'persona', 'total', 'max_total', 'scores', 'checklist', 'result', 'judge', 'transcript', 'duration_sec', 'max_step', 'rebuttals', 'appointment', 'app_ver');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('realty_practice_logs', 'id', '連番（主キー）', '改修', '2.2.301', NOW()),
  ('realty_practice_logs', 'src_id', '以前のアプリ（Supabase）の id。CSV の取り込みの二重防止', '改修', '2.2.301', NOW()),
  ('realty_practice_logs', 'created_at', '練習した日時（日本時間）', '改修', '2.2.301', NOW()),
  ('realty_practice_logs', 'staff', '練習した担当者', '改修', '2.2.301', NOW()),
  ('realty_practice_logs', 'mode', 'full＝通し練習 / kiwa＝引き際トレーニング', '改修', '2.2.301', NOW()),
  ('realty_practice_logs', 'level', '難易度', '推論', '2.2.301', NOW()),
  ('realty_practice_logs', 'persona', '売主の設定（JSON）', '改修', '2.2.301', NOW()),
  ('realty_practice_logs', 'total', '採点の合計点', '推論', '2.2.301', NOW()),
  ('realty_practice_logs', 'max_total', '採点の満点', '推論', '2.2.301', NOW()),
  ('realty_practice_logs', 'scores', '項目ごとの点数（JSON）', '推論', '2.2.301', NOW()),
  ('realty_practice_logs', 'checklist', 'チェック項目の達成状況（JSON）', '推論', '2.2.301', NOW()),
  ('realty_practice_logs', 'result', '採点の結果（JSON）', '改修', '2.2.301', NOW()),
  ('realty_practice_logs', 'judge', 'ナビ上の動き（JSON）', '改修', '2.2.301', NOW()),
  ('realty_practice_logs', 'transcript', '会話（JSON）', '改修', '2.2.301', NOW()),
  ('realty_practice_logs', 'duration_sec', '練習の秒数', '改修', '2.2.301', NOW()),
  ('realty_practice_logs', 'max_step', 'どこまで進んだか', '改修', '2.2.301', NOW()),
  ('realty_practice_logs', 'rebuttals', '表示した切り返しの id（JSON 配列）', '改修', '2.2.301', NOW()),
  ('realty_practice_logs', 'appointment', 'アポを取れたか（0 / 1）', '推論', '2.2.301', NOW()),
  ('realty_practice_logs', 'app_ver', '練習したときのアプリの版', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- realty_properties：媒介物件
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('realty_properties', '媒介物件', 'realty', '不動産企画係が媒介・買取した物件そのもの。1物件 = 1行（v2.2.250）。⚠️ property_db（ポータルの掲載物件）とは別物。
台帳・売り反響・買い反響は brokerage_listings.propertyId でこの表の id を指す。
作るのは ② planner:ledger_link（売り反響の媒介紐付。features/realty/ledgerLink.ts）で、種別＋住所（地番・マンションは建物名＋部屋番号）の match_key で探し、無ければ足す。既存の台帳からの移し替えは backend/scripts/realty/build-property-sql.cjs と 2026-11-05_realty_properties_2_migrate.sql。
読むのは ② いえらぶの物件の突き合わせ（ieloveMatch.ts）。
⚠️ match_key は一意（utf8mb4_bin）。作り方は ② の propertyKey.ts と同じにする。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'realty_properties' AND column_name NOT IN ('id', 'match_key', 'category', 'addr', 'chiban', 'building_name', 'room_no', 'land_area', 'building_area', 'built_year', 'layout', 'created_at', 'created_by', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('realty_properties', 'id', '物件 ID（移し替えは p + MD5 の先頭16桁、② は uid）', '改修', '2.2.301', NOW()),
  ('realty_properties', 'match_key', '突き合わせ用（種別|c:地番 か 種別|a:住所[|建物名|部屋番号]。② の propertyKey.ts）。⚠️ 一意', '改修', '2.2.301', NOW()),
  ('realty_properties', 'category', '種別（台帳の区分と同じ値。戸建・マンション・住宅用地・賃収・事業用 など）', '改修', '2.2.301', NOW()),
  ('realty_properties', 'addr', '所在地（住居表示）', '改修', '2.2.301', NOW()),
  ('realty_properties', 'chiban', '地番（任意）', '改修', '2.2.301', NOW()),
  ('realty_properties', 'building_name', '建物名（マンション）', '改修', '2.2.301', NOW()),
  ('realty_properties', 'room_no', '部屋番号（マンション）', '改修', '2.2.301', NOW()),
  ('realty_properties', 'land_area', '土地面積（㎡）', '改修', '2.2.301', NOW()),
  ('realty_properties', 'building_area', '建物面積（㎡）', '改修', '2.2.301', NOW()),
  ('realty_properties', 'built_year', '築年（例: 1998・平成10年）', '改修', '2.2.301', NOW()),
  ('realty_properties', 'layout', '間取り', '改修', '2.2.301', NOW()),
  ('realty_properties', 'created_at', '作成日時', '改修', '2.2.301', NOW()),
  ('realty_properties', 'created_by', '作成した担当者', '改修', '2.2.301', NOW()),
  ('realty_properties', 'updated_at', '更新日時（行を更新すると自動で入る）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- registered_estate：スタッフ別の物件取得件数
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('registered_estate', 'スタッフ別の物件取得件数', 'common', '（推定）PG CLOUD の「物件取得者履歴」のレポートを、スタッフ × 月で数えたもの。1行 = 1スタッフの1か月。ローカルでは 2025/01〜2026/04 の 82 行。
コードからの使用箇所なし（推定：外部の同期処理か手作業で入れ、Dashboard の画面では使っていない）。
⚠️ name はスタッフ名（staff の名前とほぼ一致）。dev の個人情報マスク（mask_personal_info.sql）では判定できず対象外にしている。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'registered_estate' AND column_name NOT IN ('no', 'name', 'period', 'value', 'url');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('registered_estate', 'no', '連番（主キー）', '推論', '2.2.301', NOW()),
  ('registered_estate', 'name', '（推定）物件を取得したスタッフの名前', '推論', '2.2.301', NOW()),
  ('registered_estate', 'period', '年月（YYYY/MM）', '推論', '2.2.301', NOW()),
  ('registered_estate', 'value', '（推定）その月に取得した物件の件数', '推論', '2.2.301', NOW()),
  ('registered_estate', 'url', '（推定）PG CLOUD のレポートの絞り込み済みの一覧へのパス（/properties?… の相対パス）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- resale_customers：中古リノベの旧顧客一覧
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('resale_customers', '中古リノベの旧顧客一覧', 'used', '（推定）中古住宅専門店が以前使っていた顧客管理（Dashboard より前のシステム）から取り込んだ顧客一覧。1行＝顧客1人（約3,500件。登録日は 2022-07〜2026-04）。shop はほぼすべて「国分ハウジンググループ中古住宅専門店」。
コードからの使用箇所なし（推定：master_data_resale へ移す前の元データ。開発用の個人情報の伏せ字 SQL（backend/scripts/sql/dev/mask_personal_info.sql）だけが触る）。
⚠️ category・action・budget は JSON（配列やオブジェクト）の文字列。⚠️ 2026-04 で更新が止まっている（推定）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'resale_customers' AND column_name NOT IN ('no', 'id_action', 'staff', 'shop', 'id_related', 'name', 'kana', 'estate_name_1', 'category', 'response', 'medium', 'case', 'id_case', 'status', 'mail', 'zip', 'address', 'phone', 'registered', 'reserved', 'contract', 'action', 'budget', 'total', 'property', 'broker', 'renovation', 'profit', 'other', 'rank', 'flag');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('resale_customers', 'no', '連番（自動採番）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'id_action', '（推定）旧システムの対応履歴の ID', '推論', '2.2.301', NOW()),
  ('resale_customers', 'staff', '担当営業', '推論', '2.2.301', NOW()),
  ('resale_customers', 'shop', '担当店舗（ほぼ「国分ハウジンググループ中古住宅専門店」）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'id_related', '（推定）旧システムの関連 ID', '推論', '2.2.301', NOW()),
  ('resale_customers', 'name', 'お名前', '推論', '2.2.301', NOW()),
  ('resale_customers', 'kana', 'フリガナ', '推論', '2.2.301', NOW()),
  ('resale_customers', 'estate_name_1', '（推定）関係する物件名①', '推論', '2.2.301', NOW()),
  ('resale_customers', 'category', '（推定）区分の一覧（JSON 配列）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'response', '反響の手段（例 ネット・メール・電話・来店・チラシ）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'medium', '反響媒体（例 中専HP(会員登録/ネット検索)・イエウール・SUUMO・折込チラシ）。「中専HP」は中古住宅専門店のホームページ', '推論', '2.2.301', NOW()),
  ('resale_customers', 'case', '取引の区分（例「買:-」「売：中古一戸建」「仮:-」。書式の揺れがある）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'id_case', '（推定）旧システムの案件 ID', '推論', '2.2.301', NOW()),
  ('resale_customers', 'status', '追客の状況（例 追客終了・追客中・接触（通電・訪問）・来店あり・買付・リフォーム契約）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'mail', 'メールアドレス', '推論', '2.2.301', NOW()),
  ('resale_customers', 'zip', '郵便番号', '推論', '2.2.301', NOW()),
  ('resale_customers', 'address', '住所', '推論', '2.2.301', NOW()),
  ('resale_customers', 'phone', '電話番号', '推論', '2.2.301', NOW()),
  ('resale_customers', 'registered', '登録日時（YYYY/MM/DD HH:MM）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'reserved', '（推定）来場予約・来店の日', '推論', '2.2.301', NOW()),
  ('resale_customers', 'contract', '（推定）契約日', '推論', '2.2.301', NOW()),
  ('resale_customers', 'action', '（推定）対応履歴（JSON 配列）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'budget', '（推定）予算・資金の内訳（JSON）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'total', '（推定）総額（万円）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'property', '（推定）物件価格（万円）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'broker', '（推定）仲介手数料（万円）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'renovation', '（推定）リフォーム費用（万円）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'profit', '（推定）粗利（万円）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'other', '（推定）その他の費用（すべて 0）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'rank', '顧客ランク（S・A〜G。ほとんど空）', '推論', '2.2.301', NOW()),
  ('resale_customers', 'flag', '（推定）旧システムで「存在する」の印（exist か空）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- reserve_kaeru：建売のホームページ来場予約
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('reserve_kaeru', '建売のホームページ来場予約', 'spec', 'かえるホームのホームページの来場予約メールを取り込んだ元の表。1行＝予約メール1通。
書くもの：メールの取り込み（sync）が ① の request reserve_kaeru_update で送る（reserve_kaeru_update.php。INSERT IGNORE で、同じメールアドレス・受信日時の2通目は入らない）。
続けて ① handlers/portal/reserve_kaeru.php が反響一覧（inquiry_customer_kaeru）へ `hp_reserve_<no>` で写す（medium＝ホームページ反響・hp_campaign＝イベント名）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'reserve_kaeru' AND column_name NOT IN ('no', 'area', 'date', 'time', 'name', 'nameKana', 'age', 'email', 'tel', 'zip', 'address', 'event', 'source', 'purpose', 'note', 'registered', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('reserve_kaeru', 'no', '連番（自動採番）。反響ID の末尾になる', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'area', '希望エリア（反響一覧の area）', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'date', 'ご来場希望日（反響一覧の reserved_date）', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'time', 'ご来場希望時間（反響一覧の reserved_time）', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'name', 'お名前。⚠️ 空の行は反響一覧に写さない', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'nameKana', 'フリガナ', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'age', 'ご年齢', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'email', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'tel', '電話番号（反響一覧の mobile に入る）', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'address', 'ご住所（反響一覧の building に入る）', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'event', '予約したイベント（反響一覧の hp_campaign）', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'source', '何で知ったか（反響一覧の response_medium）', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'purpose', '来場の目的', '推論', '2.2.301', NOW()),
  ('reserve_kaeru', 'note', 'その他お問い合わせ', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'registered', 'メール受信日時', '改修', '2.2.301', NOW()),
  ('reserve_kaeru', 'remarks', '詳細メモ（メールの全項目をつないだ文。反響一覧の note）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- reserve_resale：中古リノベのホームページ来場予約
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('reserve_resale', '中古リノベのホームページ来場予約', 'used', '中古住宅専門店のホームページのイベント・物件の予約メールを取り込んだ元の表。1行＝予約メール1通。
書くもの：メールの取り込みが ① の request reserve_resale_update で送る（reserve_resale_update.php。INSERT IGNORE）。
続けて ① handlers/portal/reserve_resale.php が反響一覧（inquiry_customer_resale）へ `hp_resale_<no>` で写す（medium＝ホームページ反響・category＝買い:中古リノベ・hp_campaign＝イベント名）。
⚠️ category を 買い:中古リノベ にしないと、要確認の中古の未同期に出ない（v2.2.175）。
⚠️ 画面はこの表を直接読まない。反響一覧を見る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'reserve_resale' AND column_name NOT IN ('no', 'event', 'date', 'time', 'name', 'nameKana', 'email', 'tel', 'zip', 'address', 'source', 'note', 'registered', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('reserve_resale', 'no', '連番（自動採番）。反響ID の末尾になる', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'event', 'ご希望イベント／物件番号（反響一覧の hp_campaign）', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'date', 'ご来店・参加希望日（反響一覧の reserved_date）', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'time', 'ご来店・参加希望時間（反響一覧の reserved_time）', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'name', 'お名前。⚠️ 空の行は反響一覧に写さない', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'nameKana', 'フリガナ', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'email', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'tel', 'お電話番号（反響一覧の mobile に入る）', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'address', 'ご住所（反響一覧の building に入る）', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'source', 'ご予約のきっかけ（反響一覧の response_medium）', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'note', 'その他お問い合わせ', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'registered', 'メール受信日時', '改修', '2.2.301', NOW()),
  ('reserve_resale', 'remarks', '詳細メモ（メールの全項目をつないだ文。反響一覧の note）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- reserved_calendar：イベントカレンダーの実績
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('reserved_calendar', 'イベントカレンダーの実績', 'order', 'イベントカレンダーで入れる実績の人数。店舗×イベント×日×区分＝1行。
書くのはイベントカレンダーの実績の入力（calendar/Calendar.tsx → ① handlers/calendar_change.php の roll response_change。core/calendar.php の calendarSaveReserved）。読むのも同じ画面（店舗表示の合計など）。
⚠️ 一意キーが無い。書くときは shop・event・date・category で先に探し、あれば UPDATE・無ければ INSERT（影響行数で判断すると二重になる）。
⚠️ event_id はほとんど 0。イベントとの突き合わせは店舗・イベント名・日付で行う。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'reserved_calendar' AND column_name NOT IN ('id', 'event_id', 'shop', 'event', 'date', 'count', 'category');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('reserved_calendar', 'id', '連番', '改修', '2.2.301', NOW()),
  ('reserved_calendar', 'event_id', 'event_calendar.id。⚠️ ほとんど 0（常設イベントなどカレンダーに無い行もある）', '改修', '2.2.301', NOW()),
  ('reserved_calendar', 'shop', '店舗名', '改修', '2.2.301', NOW()),
  ('reserved_calendar', 'event', 'イベント名（event_calendar.title。常設の「常設EV・モデル見学」もある）', '改修', '2.2.301', NOW()),
  ('reserved_calendar', 'date', '実績の日。⚠️ 0000-00-00 の行がある', '改修', '2.2.301', NOW()),
  ('reserved_calendar', 'count', '人数', '改修', '2.2.301', NOW()),
  ('reserved_calendar', 'category', '区分。reserved＝新規来場者、new＝有効新規数、next＝次アポ数、registered＝管理客（title・空の行も少しある）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- satbase_property：SatBase物件（建売の物件台帳の写し）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('satbase_property', 'SatBase物件（建売の物件台帳の写し）', 'spec', 'SatBase の物件台帳（「KHF物件管理【KHG】 - 中間加工（物件）」）の写し。1物件 = 1行（backend/scripts/sql/2026-09-22_satbase_property.sql で作成）。ローカルは約1,900件。
書くのは ② satbase_import（SatBaseサマリーの CSV 取り込み。マスターだけ。property_id で突き合わせて追加・更新し、CSV に無い物件は消さない。空欄は NULL で上書き）。以前は backend/scripts/sql/2026-09-29_satbase_property_reload.sql で丸ごと入れ替えていた。
読むのは ② satbase_list（SatBaseサマリー header/SatBaseDatabase.tsx。satbase_property_flag を LEFT JOIN し、全件を返して画面で絞る）。① に PHP ハンドラは無い。
⚠️ SatBase 側が正。画面から書き換えない（画面のトグルは satbase_property_flag）。⚠️ CSV は位置で読む（列の並びは satbase.ts の IMPORT_COLUMNS）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'satbase_property' AND column_name NOT IN ('property_id', 'property_name', 'usage_type', 'customer_name', 'contract_staff', 'progress_status', 'sales_status', 'area', 'site_staff', 'design_staff', 'construction_staff', 'foundation_start_date', 'completion_date', 'exterior_completion_date', 'payment_date', 'delivery_date', 'land_cost', 'sales_price', 'contract_recorded_date', 'land_id', 'permit_date', 'property_id_general', 'plan', 'ground_improvement', 'price_changed_date', 'previous_sales_price', 'desired_start_date', 'purchase_settlement_date', 'purchase_contract_date', 'lat_lng', 'property_id_manager', 'spec', 'prefecture', 'sales_period', 'portal_posted_date', 'kaeru_hp_posted_date', 'schedule_created', 'team');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('satbase_property', 'property_id', '物件ID。⚠️ 主キー。画面はこの値の降順で並べる', '改修', '2.2.301', NOW()),
  ('satbase_property', 'property_name', '物件名称。例: 2L国分重久ⅡG 2F', '改修', '2.2.301', NOW()),
  ('satbase_property', 'usage_type', '用途の区分（0〜5の数値。意味は SatBase 側の定義）', '改修', '2.2.301', NOW()),
  ('satbase_property', 'customer_name', 'お客様名。⚠️ 個人情報。契約済みの物件のみ入る', '改修', '2.2.301', NOW()),
  ('satbase_property', 'contract_staff', '契約担当者名', '改修', '2.2.301', NOW()),
  ('satbase_property', 'progress_status', '工程状況（着工前 / 建築中 / 完成済 / その他）', '改修', '2.2.301', NOW()),
  ('satbase_property', 'sales_status', '販売状況（契約済 / 引渡済 / モデルハウス / キャンセル 等）', '改修', '2.2.301', NOW()),
  ('satbase_property', 'area', 'エリア（市区町村）', '改修', '2.2.301', NOW()),
  ('satbase_property', 'site_staff', '現場管理・営業担当者名', '改修', '2.2.301', NOW()),
  ('satbase_property', 'design_staff', '設計担当者名', '改修', '2.2.301', NOW()),
  ('satbase_property', 'construction_staff', '施工管理担当者名', '改修', '2.2.301', NOW()),
  ('satbase_property', 'foundation_start_date', '基礎着工日。⚠️ 実データに 1970-01-01 が混ざっている（未入力の代わり）', '改修', '2.2.301', NOW()),
  ('satbase_property', 'completion_date', '完工日', '改修', '2.2.301', NOW()),
  ('satbase_property', 'exterior_completion_date', '外構完了日', '改修', '2.2.301', NOW()),
  ('satbase_property', 'payment_date', '入金日。⚠️ 実データに 1970-01-01 が混ざっている', '改修', '2.2.301', NOW()),
  ('satbase_property', 'delivery_date', '引渡日', '改修', '2.2.301', NOW()),
  ('satbase_property', 'land_cost', '販売価格のうちの土地代（円）', '改修', '2.2.301', NOW()),
  ('satbase_property', 'sales_price', '販売価格（円）', '改修', '2.2.301', NOW()),
  ('satbase_property', 'contract_recorded_date', '契約計上日', '改修', '2.2.301', NOW()),
  ('satbase_property', 'land_id', '土地ID（SatBase の土地台帳）', '改修', '2.2.301', NOW()),
  ('satbase_property', 'permit_date', '確認済証の許可日', '改修', '2.2.301', NOW()),
  ('satbase_property', 'property_id_general', '物件ID（一般）。⚠️ 実データでは property_id と同じ値', '改修', '2.2.301', NOW()),
  ('satbase_property', 'plan', 'プラン名。例: 2A-5', '改修', '2.2.301', NOW()),
  ('satbase_property', 'ground_improvement', '地盤改良の費用（円）。0 は改良なし', '改修', '2.2.301', NOW()),
  ('satbase_property', 'price_changed_date', '販売価格を変更した日', '改修', '2.2.301', NOW()),
  ('satbase_property', 'previous_sales_price', '変更前の販売価格（円）', '改修', '2.2.301', NOW()),
  ('satbase_property', 'desired_start_date', '着工希望日', '改修', '2.2.301', NOW()),
  ('satbase_property', 'purchase_settlement_date', '仕入の決済日。⚠️ 2026-09-22 時点で全件空', '改修', '2.2.301', NOW()),
  ('satbase_property', 'purchase_contract_date', '仕入の契約日。⚠️ 2026-09-22 時点で全件空', '改修', '2.2.301', NOW()),
  ('satbase_property', 'lat_lng', '位置情報（緯度,経度）。⚠️ 2026-09-22 時点で全件空', '改修', '2.2.301', NOW()),
  ('satbase_property', 'property_id_manager', 'ID（管理職）。⚠️ 実データでは property_id と同じ値', '改修', '2.2.301', NOW()),
  ('satbase_property', 'spec', '仕様（ZEH水準 / 省エネ / その他）', '改修', '2.2.301', NOW()),
  ('satbase_property', 'prefecture', '県。⚠️ 実データに #N/A が混ざっている', '改修', '2.2.301', NOW()),
  ('satbase_property', 'sales_period', '販売期間。⚠️ 「+0」「+12」のような符号付きの文字列で入っている', '改修', '2.2.301', NOW()),
  ('satbase_property', 'portal_posted_date', 'ポータルサイトへの掲載日', '改修', '2.2.301', NOW()),
  ('satbase_property', 'kaeru_hp_posted_date', 'かえるホームページへの掲載日', '改修', '2.2.301', NOW()),
  ('satbase_property', 'schedule_created', '工程表を作成済みか（0 / 1）', '改修', '2.2.301', NOW()),
  ('satbase_property', 'team', 'チーム（係）。例: 鹿児島係 / 大分係 / 土地仕入', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- satbase_property_flag：SatBase物件の画面入力値
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('satbase_property_flag', 'SatBase物件の画面入力値', 'spec', 'SatBaseサマリー（header/SatBaseDatabase.tsx）で画面から入れる値（広告出稿・Instagram投稿のトグル）。1物件 = 1行（v2.2.152）。
satbase_property（SatBase の写し）と分けたのは、CSV で写しを入れ替えてもトグルが消えないようにするため。
書くのは ② satbase_update（追加と更新を兼ねる。先に satbase_property に物件があるかを確かめる）。読むのは ② satbase_list（satbase_property に LEFT JOIN し、無い行は 0）。① に PHP ハンドラは無い。
⚠️ 一度でも触った物件だけ行がある。⚠️ CSV の取り込み（satbase_import・入れ替えの SQL）でこの表に触らない。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'satbase_property_flag' AND column_name NOT IN ('property_id', 'ad_posted', 'instagram_posted', 'updated', 'updated_by');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('satbase_property_flag', 'property_id', '物件ID（主キー）。⚠️ satbase_property.property_id と対応する', '改修', '2.2.301', NOW()),
  ('satbase_property_flag', 'ad_posted', '広告出稿状況。⚠️ 画面のトグル（0=未出稿 / 1=出稿済み）', '改修', '2.2.301', NOW()),
  ('satbase_property_flag', 'instagram_posted', 'Instagram投稿状況。⚠️ 画面のトグル（0=未投稿 / 1=投稿済み）', '改修', '2.2.301', NOW()),
  ('satbase_property_flag', 'updated', '画面から最後に更新した日時', '改修', '2.2.301', NOW()),
  ('satbase_property_flag', 'updated_by', '画面から最後に更新したスタッフ名', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- satbase_property_old：SatBase物件（入れ替え前の写し）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('satbase_property_old', 'SatBase物件（入れ替え前の写し）', 'spec', 'satbase_property（元の表）を CSV で丸ごと入れ替えたときの、入れ替え前の表（2026-09-29。v2.2.152）。
backend/scripts/sql/2026-09-29_satbase_property_reload.sql の RENAME で残る。画面を確かめてから DROP する手順だったが、消されずに残っている。
⚠️ 画面・処理からは使っていない（推定）。⚠️ customer_name に個人情報を含む（dev の個人情報マスクの対象）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'satbase_property_old' AND column_name NOT IN ('property_id', 'property_name', 'usage_type', 'customer_name', 'contract_staff', 'progress_status', 'sales_status', 'area', 'site_staff', 'design_staff', 'construction_staff', 'foundation_start_date', 'completion_date', 'exterior_completion_date', 'payment_date', 'delivery_date', 'land_cost', 'sales_price', 'contract_recorded_date', 'land_id', 'permit_date', 'property_id_general', 'plan', 'ground_improvement', 'price_changed_date', 'previous_sales_price', 'desired_start_date', 'purchase_settlement_date', 'purchase_contract_date', 'lat_lng', 'property_id_manager', 'spec', 'prefecture', 'sales_period', 'portal_posted_date', 'kaeru_hp_posted_date', 'schedule_created', 'team');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('satbase_property_old', 'property_id', '物件ID。⚠️ 主キー。画面はこの値の降順で並べる', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'property_name', '物件名称。例: 2L国分重久ⅡG 2F', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'usage_type', '用途の区分（0〜5の数値。意味は SatBase 側の定義）', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'customer_name', 'お客様名。⚠️ 個人情報。契約済みの物件のみ入る', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'contract_staff', '契約担当者名', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'progress_status', '工程状況（着工前 / 建築中 / 完成済 / その他）', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'sales_status', '販売状況（契約済 / 引渡済 / モデルハウス / キャンセル 等）', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'area', 'エリア（市区町村）', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'site_staff', '現場管理・営業担当者名', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'design_staff', '設計担当者名', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'construction_staff', '施工管理担当者名', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'foundation_start_date', '基礎着工日。⚠️ 実データに 1970-01-01 が混ざっている（未入力の代わり）', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'completion_date', '完工日', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'exterior_completion_date', '外構完了日', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'payment_date', '入金日。⚠️ 実データに 1970-01-01 が混ざっている', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'delivery_date', '引渡日', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'land_cost', '販売価格のうちの土地代（円）', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'sales_price', '販売価格（円）', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'contract_recorded_date', '契約計上日', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'land_id', '土地ID（SatBase の土地台帳）', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'permit_date', '確認済証の許可日', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'property_id_general', '物件ID（一般）。⚠️ 実データでは property_id と同じ値', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'plan', 'プラン名。例: 2A-5', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'ground_improvement', '地盤改良の費用（円）。0 は改良なし', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'price_changed_date', '販売価格を変更した日', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'previous_sales_price', '変更前の販売価格（円）', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'desired_start_date', '着工希望日', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'purchase_settlement_date', '仕入の決済日。⚠️ 2026-09-22 時点で全件空', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'purchase_contract_date', '仕入の契約日。⚠️ 2026-09-22 時点で全件空', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'lat_lng', '位置情報（緯度,経度）。⚠️ 2026-09-22 時点で全件空', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'property_id_manager', 'ID（管理職）。⚠️ 実データでは property_id と同じ値', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'spec', '仕様（ZEH水準 / 省エネ / その他）', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'prefecture', '県。⚠️ 実データに #N/A が混ざっている', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'sales_period', '販売期間。⚠️ 「+0」「+12」のような符号付きの文字列で入っている', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'portal_posted_date', 'ポータルサイトへの掲載日', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'kaeru_hp_posted_date', 'かえるホームページへの掲載日', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'schedule_created', '工程表を作成済みか（0 / 1）', '改修', '2.2.301', NOW()),
  ('satbase_property_old', 'team', 'チーム（係）。例: 鹿児島係 / 大分係 / 土地仕入', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- section_list：課マスタ
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('section_list', '課マスタ', 'common', '営業の課の一覧。1行が1つの課（鹿児島営業1課・不動産営業1課・中古住宅専門店 など）。
集計画面の課の選択肢と並び（no 順）に使う（顧客・店舗別反響推移・地図・全社報告・競合・Googleレビュー・営業別契約率・予算シミュレーターなど）。スタッフ・店舗の管理画面も選択肢として読む。
⚠️ 書き込む画面は無い（手で入れている。推定）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'section_list' AND column_name NOT IN ('no', 'division', 'name', 'order_flag', 'report_flag');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('section_list', 'no', '連番。並び順にも使う', '改修', '2.2.301', NOW()),
  ('section_list', 'division', '事業（注文事業 / 建売分譲事業 / 中古リノベ / 不動産企画室）。shop_list.division と同じ値', '改修', '2.2.301', NOW()),
  ('section_list', 'name', '課の名前。shop_list.section・staff_list.section と同じ表記', '改修', '2.2.301', NOW()),
  ('section_list', 'order_flag', '担当別一覧（注文営業）の表示の有無', '改修', '2.2.301', NOW()),
  ('section_list', 'report_flag', '全社報告用フォーマットの表示の有無', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- security_log：セキュリティログ
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('security_log', 'セキュリティログ', 'common', 'ログイン・ログアウト・認証の失敗・権限の不足・存在しない request・500/502 などの出来事が1行（v2.2.242〜）。
書くのは ① backend/src/core/security_log.php と ② backend-express/src/features/securityLog.ts。読むのは ② security_log_list（Master だけ）→ 画面「システム管理 → セキュリティログ」（header/system/SecurityLog.tsx）。
⚠️ 失敗の連打（auth_failed・forbidden・bad_request・unknown_request・auth_missing）は「同じ種類・同じ IP・同じ request・同じ人・同じ1分」を1行にまとめ、count を数える。ログイン・500・502 などはまとめない。
⚠️ 180日より古い行は、書くとき（ときどき）と一覧を開いたときに消す。⚠️ message にパスワード・トークン・メールアドレス・お客様の情報を入れない。⚠️ ① と ② でまとめ方・列の長さを揃える。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'security_log' AND column_name NOT IN ('id', 'occurred_at', 'last_at', 'count', 'server', 'event', 'status', 'request', 'roll', 'staff_id', 'staff_name', 'ip', 'via_ip', 'user_agent', 'path', 'message', 'bucket');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('security_log', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('security_log', 'occurred_at', '最初に起きた日時（まとめた行は、その1分の最初）', '改修', '2.2.301', NOW()),
  ('security_log', 'last_at', '最後に起きた日時（まとめた行で count が増えると更新）', '改修', '2.2.301', NOW()),
  ('security_log', 'count', 'まとめた件数', '改修', '2.2.301', NOW()),
  ('security_log', 'server', 'php（①）/ express（②）', '改修', '2.2.301', NOW()),
  ('security_log', 'event', 'login / login_failed / logout / auth_failed / forbidden / bad_request / unknown_request / server_error / proxy_error / auth_missing（v2.2.272〜。① だけ。トークン無しで通した）', '改修', '2.2.301', NOW()),
  ('security_log', 'status', '返した HTTP ステータス', '改修', '2.2.301', NOW()),
  ('security_log', 'request', 'request（② の存在しないパスはパス）', '改修', '2.2.301', NOW()),
  ('security_log', 'roll', 'request の roll（処理の種類）', '改修', '2.2.301', NOW()),
  ('security_log', 'staff_id', '操作した人（staff.id）。分からなければ NULL', '改修', '2.2.301', NOW()),
  ('security_log', 'staff_name', '操作した人の名前', '改修', '2.2.301', NOW()),
  ('security_log', 'ip', '接続元（② では ① から渡された値）', '改修', '2.2.301', NOW()),
  ('security_log', 'via_ip', '直接つないできた相手（① を経由したとき ① の IP。ip と違えば中継されている）', '改修', '2.2.301', NOW()),
  ('security_log', 'user_agent', 'ブラウザなどの User-Agent', '改修', '2.2.301', NOW()),
  ('security_log', 'path', 'どの画面から（Referer のパス）', '改修', '2.2.301', NOW()),
  ('security_log', 'message', '補足の一行（例: ログインの失敗の理由）', '改修', '2.2.301', NOW()),
  ('security_log', 'bucket', 'まとめる行の鍵（SHA1）。まとめない行は NULL。一意', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- shared_report：共有したレポート
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('shared_report', '共有したレポート', 'common', 'レポートの共有URL（/report?k=…）が1行1本（v2.2.268〜）。② の features/sharedReport.ts が読み書きする。
shared_report_create（Claudeによる分析から＝実行した本人か Master／HTML の登録＝Master）、shared_report_get（共有URLの画面 report/SharedReportView.tsx。ログインしていれば誰でも見られる）、shared_report_list・shared_report_revoke（画面「システム管理 → 共有したレポート」header/system/SharedReports.tsx）。
⚠️ html は共有した時点の写し。元の分析を消しても見られる。共有を止めると html を消す（NULL）。⚠️ html は iframe（sandbox="allow-scripts" だけ）で出す。
⚠️ 日時は ② が日本時間で書く。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'shared_report' AND column_name NOT IN ('id', 'share_key', 'title', 'source', 'source_id', 'html', 'html_bytes', 'staff_id', 'staff_name', 'created_at', 'revoked_at', 'revoked_by', 'view_count', 'last_viewed_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('shared_report', 'id', '連番（自動採番）。画面に出すが、id では見られない', '改修', '2.2.301', NOW()),
  ('shared_report', 'share_key', '共有URLの k（128bit の乱数。base64url の22文字）。⚠️ 知っていてもログインが要る', '改修', '2.2.301', NOW()),
  ('shared_report', 'title', '題', '改修', '2.2.301', NOW()),
  ('shared_report', 'source', '元。ai_analysis（Claudeによる分析）/ upload（HTMLを登録）', '改修', '2.2.301', NOW()),
  ('shared_report', 'source_id', 'source = ai_analysis のときの ai_analysis_job.id', '改修', '2.2.301', NOW()),
  ('shared_report', 'html', 'レポートの HTML（共有した時点の写し。停止すると NULL）', '改修', '2.2.301', NOW()),
  ('shared_report', 'html_bytes', 'html の大きさ（バイト）。上限は 5MB', '改修', '2.2.301', NOW()),
  ('shared_report', 'staff_id', '共有した人（staff.id）', '改修', '2.2.301', NOW()),
  ('shared_report', 'staff_name', '共有した時点の staff.name', '改修', '2.2.301', NOW()),
  ('shared_report', 'created_at', '共有した日時', '改修', '2.2.301', NOW()),
  ('shared_report', 'revoked_at', '共有を止めた日時（NULL なら共有中）', '改修', '2.2.301', NOW()),
  ('shared_report', 'revoked_by', '止めた人（staff.id）', '改修', '2.2.301', NOW()),
  ('shared_report', 'view_count', '開かれた回数', '改修', '2.2.301', NOW()),
  ('shared_report', 'last_viewed_at', '最後に開かれた日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- shop_list：店舗マスタ
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('shop_list', '店舗マスタ', 'common', '店舗の一覧。1行が1店舗（管理用の擬似店舗・インサイドセールスなども含む）。
画面はヘッダーの「システム管理 → 店舗」（header/system/EditShop.tsx。① header_shop_edit / header_shop_update）。
ほぼすべての集計画面（反響一覧・顧客DB・店舗別反響推移・全社報告・市況分析・紹介・アンバサダーなど）が、店舗の選択肢と事業・課への振り分けに読む。
⚠️ 画面ごとに絞り方が違う（show_flag = 1 の画面と report_flag = 1 の画面がある）。
⚠️ 経理の予算画面は別の表 shop_list_accounting を使う。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'shop_list' AND column_name NOT IN ('id', 'brand', 'shop', 'division', 'section', 'area', 'resister_goal', 'reserve_goal', 'show_flag', 'brand_sort', 'event_modal', 'ma_flag', 'report_flag', 'multi', 'parent_shop');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('shop_list', 'id', '連番。並びにも使う', '改修', '2.2.301', NOW()),
  ('shop_list', 'brand', 'ブランド（KH / DJH / なごみ / KHF / FH / JH / PGH / 2L など）', '改修', '2.2.301', NOW()),
  ('shop_list', 'shop', '店舗名（例 KH鹿児島店）。staff_list.shop・budget.shop など各表の店舗名と同じ表記', '改修', '2.2.301', NOW()),
  ('shop_list', 'division', '事業（注文事業 / 建売分譲事業 / 中古リノベ / 不動産企画室）。section_list.division と同じ値', '改修', '2.2.301', NOW()),
  ('shop_list', 'section', '所属の課（section_list.name）', '改修', '2.2.301', NOW()),
  ('shop_list', 'area', '県（鹿児島県 / 宮崎県 など）。空の店舗も多い', '改修', '2.2.301', NOW()),
  ('shop_list', 'resister_goal', '（推定）登録数の目標。⚠️ 綴りは resister。読む処理なし', '推論', '2.2.301', NOW()),
  ('shop_list', 'reserve_goal', '（推定）来場予約数の目標。読む処理なし', '推論', '2.2.301', NOW()),
  ('shop_list', 'show_flag', '1 = 反響一覧などの店舗の選択肢に出す', '改修', '2.2.301', NOW()),
  ('shop_list', 'brand_sort', 'ブランドの並び順（KPI・市況分析・資金計画書・アンバサダーが ORDER BY brand_sort, id）', '改修', '2.2.301', NOW()),
  ('shop_list', 'event_modal', '（推定）イベントの入力モーダルに出す店舗。店舗画面で切り替えられるが読む処理は見当たらない', '推論', '2.2.301', NOW()),
  ('shop_list', 'ma_flag', '（推定）MA（マーケティング）の対象店舗。店舗画面で切り替えられるが読む処理は見当たらない', '推論', '2.2.301', NOW()),
  ('shop_list', 'report_flag', '1 = 全社報告用フォーマット・市況分析・紹介・日報などの対象店舗（管理用の擬似店舗を外す）', '改修', '2.2.301', NOW()),
  ('shop_list', 'multi', '1 = 併売店（2つのブランドを同じ店で売る）。親か子かは parent_shop で見る', '改修', '2.2.301', NOW()),
  ('shop_list', 'parent_shop', '親店舗（併売店の子にだけ親の shop を入れる。例 DJH加世田店 → KH加世田店）。集計で親にまとめる。⚠️ 親自身は NULL（backend/scripts/sql/2026-09-10_shop_list_parent_shop.sql）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- shop_list_accounting：店舗マスタ（経理）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('shop_list_accounting', '店舗マスタ（経理）', 'common', '経理の予算画面（BudgetAccounting.tsx）用の店舗の一覧。1行が1店舗。shop_list とは別の表で、課の表記も違う（1課〜4課・不動産）。
① budget_accounting.php が全件をそのまま返す（旧APIの shop_list_accounting を移植したもの）。
⚠️ 書き込む処理はコードに無い（手で入れている。推定）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'shop_list_accounting' AND column_name NOT IN ('id', 'brand', 'shop', 'section', 'resister_goal', 'reserve_goal');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('shop_list_accounting', 'id', '連番', '改修', '2.2.301', NOW()),
  ('shop_list_accounting', 'brand', 'ブランド（KH / DJH / なごみ / かえる など）', '改修', '2.2.301', NOW()),
  ('shop_list_accounting', 'shop', '店舗名', '改修', '2.2.301', NOW()),
  ('shop_list_accounting', 'section', '経理上の課（1課〜4課・不動産）。⚠️ section_list の課名とは違う', '改修', '2.2.301', NOW()),
  ('shop_list_accounting', 'resister_goal', '（推定）登録数の目標。⚠️ 綴りは resister。画面の型は register_goal と書いてあり読んでいない', '推論', '2.2.301', NOW()),
  ('shop_list_accounting', 'reserve_goal', '（推定）来場予約数の目標', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- smile_fes：住まいるフェスティバル（2025）の予約
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('smile_fes', '住まいるフェスティバル（2025）の予約', 'order', '（推定）2025年8月の住まいるフェスティバルの来場予約。1予約＝1行（受付は 2025-08-14 〜 08-24 の61件）。
コードからの使用箇所なし（推定：event_db を使う前の、イベント専用の受付の表。開発用の個人情報の伏せ字 SQL だけが触る）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'smile_fes' AND column_name NOT IN ('id', 'timestamp', 'name', 'zip', 'address', 'phone', 'age', 'reserve', 'house', 'interview', 'area', 'question', 'medium', 'check_in', 'check_out');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('smile_fes', 'id', '連番', '推論', '2.2.301', NOW()),
  ('smile_fes', 'timestamp', '（推定）受け付けた日時（YYYYMMDDHHMMSS の文字列）', '推論', '2.2.301', NOW()),
  ('smile_fes', 'name', 'お名前', '推論', '2.2.301', NOW()),
  ('smile_fes', 'zip', '郵便番号', '推論', '2.2.301', NOW()),
  ('smile_fes', 'address', '住所', '推論', '2.2.301', NOW()),
  ('smile_fes', 'phone', '電話番号', '推論', '2.2.301', NOW()),
  ('smile_fes', 'age', '年代', '推論', '2.2.301', NOW()),
  ('smile_fes', 'reserve', '（推定）来場希望の日時', '推論', '2.2.301', NOW()),
  ('smile_fes', 'house', '現在のお住まい', '推論', '2.2.301', NOW()),
  ('smile_fes', 'interview', '相談内容', '推論', '2.2.301', NOW()),
  ('smile_fes', 'area', '建築希望エリア', '推論', '2.2.301', NOW()),
  ('smile_fes', 'question', '事前にお聞きしたいこと', '推論', '2.2.301', NOW()),
  ('smile_fes', 'medium', 'ご予約のきっかけ', '推論', '2.2.301', NOW()),
  ('smile_fes', 'check_in', '（推定）チェックイン時間', '推論', '2.2.301', NOW()),
  ('smile_fes', 'check_out', '（推定）チェックアウト時間', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- spreadSheet：スプレッドシートのリンク集
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('spreadSheet', 'スプレッドシートのリンク集', 'common', '社内で使う Google スプレッドシートの登録簿。1行が1シート（名前・URL・説明・分類）。
① の spreadSheet.php（全件を返す）と spreadSheet_update.php（URL で重複を確かめて登録・修正）が読み書きする。
⚠️ Dashboard の画面（frontend/src）からの呼び出しは見当たらない。khg-marketing.info/api/ の別アプリ（spreadSheet）が使っている（推定。docs/oldDocument/plan-2026-10-21-php-to-express.md）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'spreadSheet' AND column_name NOT IN ('no', 'name', 'url', 'description', 'category', 'tag', 'display');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('spreadSheet', 'no', '連番（修正のキー）', '改修', '2.2.301', NOW()),
  ('spreadSheet', 'name', 'シート名', '改修', '2.2.301', NOW()),
  ('spreadSheet', 'url', 'シートの URL。⚠️ 同じ URL は2行にできない（spreadSheet_update.php が弾く）', '改修', '2.2.301', NOW()),
  ('spreadSheet', 'description', '説明', '改修', '2.2.301', NOW()),
  ('spreadSheet', 'category', '分類（共通 / 注文住宅営業 / 広報・マーケティング / 生産部関係 / 中古住宅専門店 / 重要会議体）', '改修', '2.2.301', NOW()),
  ('spreadSheet', 'tag', 'タグ（自由入力）', '改修', '2.2.301', NOW()),
  ('spreadSheet', 'display', '（推定）1 = 一覧に出す。登録の処理は書かない（既定値のまま）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- staff：ログイン権限（アカウント）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('staff', 'ログイン権限（アカウント）', 'common', 'Dashboard にログインする人のアカウント。1行が1人。ログイン（login.php・Google 認証）、トークンの確認（② gateway/auth.ts・middlewares/auth.ts、① token.php）、権限・担当事業の判定に使う。
画面はヘッダーの「システム管理 → ログイン権限」（header/system/EditAuth.tsx。② staffAdmin.ts の header_edit_auth / header_auth_insert / header_auth_update）。
⚠️ 人事マスタの staff_list とは別の表で、連携していない（片方に登録してももう片方には入らない）。
⚠️ password・api_token の値は SELECT で返さない・画面に出さない（列を明示して読む。`SELECT *` 禁止）。
⚠️ 入場できない相談は、まず shop（担当事業）が空・想定外の値でないかを見る。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'staff' AND column_name NOT IN ('id', 'name', 'brand', 'shop', 'mail', 'password', 'api_token', 'timestamp', 'url', 'heartbeat', 'log', 'flag', 'check_daily_action', 'last_login_at', 'last_logout_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('staff', 'id', '連番。staff_access_log.staff_id・kpi_analysis_history.staff_id などから参照される', '改修', '2.2.301', NOW()),
  ('staff', 'name', '氏名。⚠️ staff_list.name とは表記（空白の有無）が揃っていないことがある', '改修', '2.2.301', NOW()),
  ('staff', 'brand', '権限（店舗のブランドではない）。Master / BrandAdmin / Manager / ordinary / Consulting。ほかに insideSales（ISカレンダーの判定）・綴り違いの BrandAdimn・空が実データに残る。⚠️ 画面からは AUTH_BRANDS の値だけ保存できる', '改修', '2.2.301', NOW()),
  ('staff', 'shop', '担当事業（店舗名ではない）。order 注文 / spec 建売 / used 中古 / realty 不動産企画係 / all 全事業。⚠️ 空だとどの事業にも入れない（Category.tsx）。実データに construction もある', '改修', '2.2.301', NOW()),
  ('staff', 'mail', 'ログインのメールアドレス。⚠️ 重複させない（login.php がメールだけで本人を決める）', '改修', '2.2.301', NOW()),
  ('staff', 'password', 'パスワード。⚠️ 値は見ない。Google 認証へ移行後は読む処理なし。新しく書くときは bcrypt のハッシュ（古い行は平文のまま残る）', '改修', '2.2.301', NOW()),
  ('staff', 'api_token', 'ログイン中のトークン。⚠️ 値は見ない・返さない。ログインで発行、ログアウトで空にする（logout.php）', '改修', '2.2.301', NOW()),
  ('staff', 'timestamp', '最後にトークンを確かめた日時（get_token。画面を移るたびに書く）', '改修', '2.2.301', NOW()),
  ('staff', 'url', 'get_token のときに開いていた画面の URL', '改修', '2.2.301', NOW()),
  ('staff', 'heartbeat', '最後に在席の合図が届いた日時（20秒ごと。② accessLog.ts の heartbeat、予備は ① heartbeat.php）。オンラインの表示に使う', '改修', '2.2.301', NOW()),
  ('staff', 'log', '以前のアクセス記録（JSON の配列。{time,…}）。⚠️ v2.2.266 から書き足していない（今の記録は staff_access_log）。合計で数百MB あるので一覧で読まない。総アクセス時間の計算（header_auth_access_time）だけが1人ずつ読む', '改修', '2.2.301', NOW()),
  ('staff', 'flag', '1 = 有効。② staff.ts の一覧は flag = 1 だけを返す。画面から作ると 1', '改修', '2.2.301', NOW()),
  ('staff', 'check_daily_action', '注文営業の「要確認」モーダルで「確認しました」を押した日。今日なら出さない。NULL は一度も押していない（daily_action）', '改修', '2.2.301', NOW()),
  ('staff', 'last_login_at', '最後にログインした日時（v2.2.242）', '改修', '2.2.301', NOW()),
  ('staff', 'last_logout_at', '最後にログアウトした日時（v2.2.242）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- staff_access_log：画面のアクセス記録
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('staff_access_log', '画面のアクセス記録', 'common', 'だれがどの画面をいつ開いたかの記録（v2.2.266。backend/scripts/sql/2026-11-13_staff_access_log.sql）。1行が「1人が1つの画面を開いた1回」。
② accessLog.ts が書く：画面を移ったとき access_log:open で1行足し、20秒ごとの heartbeat で last_seen_at を進める（呼ぶのは ActiveUser.tsx）。
画面はヘッダーの「システム管理 → アクセス記録」（access_log_list。Master だけ）。
⚠️ 同じ人が同じ画面を3秒以内にもう一度開いたら同じ行とみなす。⚠️ 13か月より古い行は ② が毎日消す。
⚠️ 日時は日本時間を ② で作って書く（DB の NOW() は使わない）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'staff_access_log' AND column_name NOT IN ('id', 'staff_id', 'staff_name', 'authority', 'division', 'path', 'opened_at', 'last_seen_at', 'ip', 'user_agent');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('staff_access_log', 'id', '連番（heartbeat の access_id）', '改修', '2.2.301', NOW()),
  ('staff_access_log', 'staff_id', 'staff.id', '改修', '2.2.301', NOW()),
  ('staff_access_log', 'staff_name', '開いた時点の staff.name', '改修', '2.2.301', NOW()),
  ('staff_access_log', 'authority', '開いた時点の権限（staff.brand。Master / BrandAdmin / ordinary など）', '改修', '2.2.301', NOW()),
  ('staff_access_log', 'division', '開いた時点の担当事業（staff.shop。order / spec / used / all）', '改修', '2.2.301', NOW()),
  ('staff_access_log', 'path', '開いた画面（/company など）。⚠️ ? と # から後ろは残さない（お客様の ID が入ることがあるため）', '改修', '2.2.301', NOW()),
  ('staff_access_log', 'opened_at', '開いた日時', '改修', '2.2.301', NOW()),
  ('staff_access_log', 'last_seen_at', '最後に heartbeat が届いた日時。NULL は 20秒以内に離れた', '改修', '2.2.301', NOW()),
  ('staff_access_log', 'ip', '接続元（① を経由したときは ① が渡した値）', '改修', '2.2.301', NOW()),
  ('staff_access_log', 'user_agent', '端末（ブラウザ）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- staff_count：店舗ごとの人員数（経理）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('staff_count', '店舗ごとの人員数（経理）', 'common', '店舗ごと・月ごとの人員数。1行が「1店舗 × 1か月」。
① budget_accounting.php がそのまま全件を返し、経理の予算画面（BudgetAccounting.tsx）が人員あたりの費用などに使う。
⚠️ 書き込む処理はコードに無い（手で入れている。推定）。ローカルの写しでは 2025/06〜2026/02 だけで、それより後の月は入っていない。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'staff_count' AND column_name NOT IN ('id', 'date', 'shop', 'count');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('staff_count', 'id', '連番', '改修', '2.2.301', NOW()),
  ('staff_count', 'date', '対象月（text。''YYYY/MM''）', '改修', '2.2.301', NOW()),
  ('staff_count', 'shop', '店舗名（例 KH鹿児島店。shop_list_accounting.shop と同じ表記）', '改修', '2.2.301', NOW()),
  ('staff_count', 'count', '人員数', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- staff_list：人事マスタ（担当営業）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('staff_list', '人事マスタ（担当営業）', 'common', '担当営業の登録簿。1行が「1人 × 年度（period）」で、年度が変わると同じ人の行が増える。
画面はヘッダーの「システム管理 → スタッフ」（header/system/EditStaff.tsx。② staffAdmin.ts の header_staff_edit / header_staff_insert / header_staff_update）。インサイドセールスの管理店舗は架電ステータスの設定（② callStatusMaster.ts）が書く。
反響一覧・顧客DB・案件一覧・全社報告・営業別契約率・KPI など多くの画面が、担当営業の選択肢や担当別の集計に読む（各画面で category / rank / report / inside などで絞る）。
⚠️ ログイン用の staff とは別の表で、連携していない。
⚠️ 同じ人が年度ごとに複数行あるので、名前で数えるときは period で絞るか GROUP BY name で畳む。
⚠️ id と inside・managed_shops を除き NOT NULL・既定値なし。INSERT では全列を埋める。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'staff_list' AND column_name NOT IN ('id', 'name', 'pg_id', 'shop', 'section', 'mail', 'robo_id', 'status', 'category', 'rank', 'multi', 'khg_id', 'sort', 'report', 'estate', 'memo', 'period', 'position', 'inside', 'managed_shops');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('staff_list', 'id', '連番', '改修', '2.2.301', NOW()),
  ('staff_list', 'name', '氏名。⚠️ 「姓 名」と「姓名」が混在する（突き合わせは空白を除いて行う）', '改修', '2.2.301', NOW()),
  ('staff_list', 'pg_id', 'PG CLOUD（顧客管理）での担当者ID。反響一覧（注文）・面談アンケートが使う', '改修', '2.2.301', NOW()),
  ('staff_list', 'shop', '所属店舗（shop_list.shop。例 KH鹿児島店・インサイドセールス）。⚠️ staff.shop（担当事業）とは意味が違う', '改修', '2.2.301', NOW()),
  ('staff_list', 'section', '所属の課（section_list.name）', '改修', '2.2.301', NOW()),
  ('staff_list', 'mail', 'メールアドレス。⚠️ 画面には返さない', '改修', '2.2.301', NOW()),
  ('staff_list', 'robo_id', '（推定）外部の連携ツールでの担当者ID。読む処理なし', '推論', '2.2.301', NOW()),
  ('staff_list', 'status', '在籍 / 退職', '改修', '2.2.301', NOW()),
  ('staff_list', 'category', '1 = 反響一覧に出す（担当営業の選択肢）', '改修', '2.2.301', NOW()),
  ('staff_list', 'rank', '1 = 案件一覧（ランク）・店舗担当別反響・顧客DB の担当営業に出す', '改修', '2.2.301', NOW()),
  ('staff_list', 'multi', '1 = 併売店舗のスタッフ', '改修', '2.2.301', NOW()),
  ('staff_list', 'khg_id', '社員番号（スタッフ画面の「No (ID)」。並びに使う）', '改修', '2.2.301', NOW()),
  ('staff_list', 'sort', '並び順（小さいほど上）', '改修', '2.2.301', NOW()),
  ('staff_list', 'report', '1 = 全社報告用フォーマット・営業別契約率・紹介の担当別に出す', '改修', '2.2.301', NOW()),
  ('staff_list', 'estate', '1 = 土地新着ネット（スタッフ画面のスイッチ）', '改修', '2.2.301', NOW()),
  ('staff_list', 'memo', '担当営業メモ（案件一覧で書く。rank の memo）', '改修', '2.2.301', NOW()),
  ('staff_list', 'period', '年度（文字列 ''2026'' など）。6月始まり（1〜5月はその年、6月以降は翌年）', '改修', '2.2.301', NOW()),
  ('staff_list', 'position', '役職（一般 / 店長 / 店長代理 / 課長 / IC / 管理用 など）。新規登録の既定は 一般', '改修', '2.2.301', NOW()),
  ('staff_list', 'inside', '1 = インサイドセールスの担当（ISの担当者はこれで引く。staff.brand = insideSales ではない）', '改修', '2.2.301', NOW()),
  ('staff_list', 'managed_shops', 'インサイドセールスの管理店舗（店舗名の JSON 配列。v2.2.293）。NULL は未設定', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- staff_shop_bk_227：担当事業の控え（v2.2.227）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('staff_shop_bk_227', '担当事業の控え（v2.2.227）', 'common', 'staff（ログイン権限）の担当事業（shop）を estate に差し替えたときの控え（v2.2.227・2026-10-29。backend/scripts/sql/2026-10-29_staff_shop_estate.sql）。対象の人の id・氏名・差し替え前の担当事業だけを持つ。
v2.2.228 で estate をやめ、2026-10-29_staff_shop_estate_cleanup.sql がこの控えから元の担当事業へ戻した。
⚠️ 画面・処理からは使っていない（推定）。戻し用の SQL（_restore / _cleanup）だけが読む。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'staff_shop_bk_227' AND column_name NOT IN ('id', 'name', 'shop');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('staff_shop_bk_227', 'id', 'staff.id', '改修', '2.2.301', NOW()),
  ('staff_shop_bk_227', 'name', '氏名。⚠️ staff_list.name とは表記（空白の有無）が揃っていないことがある', '改修', '2.2.301', NOW()),
  ('staff_shop_bk_227', 'shop', '差し替える前の担当事業（spec / used など）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- staffcontract：営業の所属履歴（年別。旧）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('staffcontract', '営業の所属履歴（年別。旧）', 'order', 'コードからの使用箇所なし（推定：営業担当ごとに、どの年にどの店舗・課にいたかを持つ表。2022〜2026 の約500行。店舗・課の書き方が今の shop_list と違う（例「DJH宮崎」「4課」）。担当営業の契約率の画面（staffContract.ts）はこの表を使っていない）。
1行＝1年×1営業。⚠️ 画面・処理からは使っていない（推定）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'staffcontract' AND column_name NOT IN ('id', 'year', 'section', 'shop', 'staff');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('staffcontract', 'id', '連番', '推論', '2.2.301', NOW()),
  ('staffcontract', 'year', '年（YYYY）', '推論', '2.2.301', NOW()),
  ('staffcontract', 'section', '営業課（「2課」などの短い書き方）', '推論', '2.2.301', NOW()),
  ('staffcontract', 'shop', '店舗（「DJH宮崎」などの短い書き方）', '推論', '2.2.301', NOW()),
  ('staffcontract', 'staff', '営業担当の名前', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- sumai_step_db：すまいステップ 査定依頼の取り込み元
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('sumai_step_db', 'すまいステップ 査定依頼の取り込み元', 'used', 'すまいステップ（売却査定サイト。中古住宅専門店）の査定依頼 CSV の生データ。1行が1件の依頼（管理番号 id）。
sync の runSumaiStep.ts が CSV を読み、1行ずつ ① の request sumai_step_update（handlers/sumai_step_update.php）へ送る。INSERT IGNORE なので、既にある管理番号は上書きしない。
そのあと portal/sumai_step.php が、その行を反響一覧（inquiry_customer_resale。`sumai_step_<id>`・区分「売り:ポータル」）と
不動産CRMの売却リード（brokerage_listings。extId `sumai:<管理番号>`）へ足す（どちらも INSERT だけ）。
⚠️ CSV の改行入りの欄で読み崩れた行が混ざることがある（id・date が欠けた行は下流に流さない）。
⚠️ 照合順序が brokerage_listings（utf8mb4_unicode_ci）と違う。比べるときは COLLATE を付ける。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'sumai_step_db' AND column_name NOT IN ('no', 'id', 'date', 'status', 'shop', 'estate', 'category', 'estate_pref', 'estate_city', 'estate_town', 'estate_street', 'estate_building', 'estate_room', 'estate_situation', 'large_1', 'large_2', 'large_3', 'large_4', 'land_large_1', 'land_large_2', 'land_large_3', 'plan', 'situation', 'relationship', 'rent', 'floor', 'room', 'reason', 'reason_other', 'method', 'period', 'opinion', 'sei', 'mei', 'sei_kana', 'mei_kana', 'age', 'phone', 'mail', 'zip', 'address_1', 'address_2', 'address_3', 'phone_call', 'visit', 'medium', 'report', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('sumai_step_db', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'id', '管理番号（すまいステップ側の番号）。重複を防ぐ鍵', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'date', '反響日時（YYYY-MM-DD HH:MM:SS）。反響日・売却リードの受付日になる', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'status', '状態（すまいステップ上の対応状況）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'shop', '担当店舗（すまいステップ上の値）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'estate', '物件種別（反響一覧の property に入る。売却リードでは 戸建／マンション／土地 に直す）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'category', '物件種別：その他', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'estate_pref', '物件住所：都道府県', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'estate_city', '物件住所：市区町村', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'estate_town', '物件住所：町名', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'estate_street', '物件住所：字/丁目以降', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'estate_building', '物件住所：建物名', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'estate_room', '物件住所：号室', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'estate_situation', '物件にお住まい', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'large_1', '専有面積', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'large_2', '専有面積（単位）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'large_3', '延べ床面積', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'large_4', '延べ床面積（単位）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'land_large_1', '土地面積', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'land_large_2', '土地面積（単位）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'land_large_3', '築年', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'plan', '間取り', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'situation', '現在の状況', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'relationship', '物件の関係', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'rent', '賃料', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'floor', '階数', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'room', '戸数（部屋数）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'reason', '査定の理由（複数選択が区切り無しでつながる）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'reason_other', '査定の理由：その他', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'method', '査定の方法', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'period', '売却の希望時期（売却リードの timing に入る）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'opinion', 'ご要望・ご質問', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'sei', '氏名 姓', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'mei', '氏名 名（先頭に空白が入る行がある）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'sei_kana', 'フリガナ 姓', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'mei_kana', 'フリガナ 名', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'age', '年齢', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'phone', '電話番号', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'mail', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'zip', '郵便番号', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'address_1', 'お住まいの住所：都道府県、市区町村、町名', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'address_2', 'お住まいの住所：字/丁目以降', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'address_3', 'お住まいの住所：建物名、号室', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'phone_call', '通電（すまいステップ上の記録）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'visit', '訪問（すまいステップ上の記録）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'medium', '媒介（すまいステップ上の記録）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'report', '査定書（売却リードの note に「査定書:」で入る）', '改修', '2.2.301', NOW()),
  ('sumai_step_db', 'remarks', 'CSV の全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- suumo_action_kaeru：SUUMO（建売）の反響ごとの記録
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('suumo_action_kaeru', 'SUUMO（建売）の反響ごとの記録', 'spec', 'SUUMO（建売。かえるホーム）の管理画面「反響」の CSV を取り込んだ表。1行＝反響1件（予約ID か 反響ID で1行。v2.2.263）。
書くもの：sync が CSV を ② の suumo_kaeru:actions へ直接送る（features/suumoKaeru.ts。① を通さない。合い言葉 SYNC_LOG_SECRET）。action_id で上書き。
同じ処理が反響一覧（inquiry_customer_kaeru）へ `suumo_act_<action_id>` で1反響1行を足す。キャンセルの予約は足さない（すでにある行は備考の先頭に「予約キャンセル」を付ける）。
⚠️ 顧客ごとの CSV は今までどおり ① が suumo_db_kaeru に入れる（顧客ID・追客状況・成約はそちらにしか無い）。
⚠️ 以前の `suumo_<顧客ID>` の行と同じ反響（初回の予約ID・反響ID が同じ）は反響一覧に足さない。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'suumo_action_kaeru' AND column_name NOT IN ('no', 'action_id', 'action_kind', 'received_at', 'reaction_type', 'name', 'name_kana', 'address', 'email', 'phone', 'fax', 'staff', 'reserve_status', 'guide_at', 'other_wish', 'meeting_place', 'message', 'canceled_at', 'cancel_route', 'cancel_reason', 'property_type', 'property_code', 'project_code', 'property_name', 'property_price', 'property_address', 'listing_plan', 'company_property_code', 'transaction_type', 'origin_company', 'company_staff', 'traffic', 'layout', 'exclusive_area', 'building_area', 'land_area', 'customer_id', 'customer_match', 'remarks', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('suumo_action_kaeru', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'action_id', '予約ID または 反響ID（予約ID は英数8桁・反響ID は数字10桁。どちらか一方）。⚠️ 一意', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'action_kind', 'reserve（予約ID）／ inquiry（反響ID）', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'received_at', '受付日時（YYYY/MM/DD HH:MM:SS）', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'reaction_type', '反響種別（例 資料請求・即時予約）', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'name', 'お名前', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'name_kana', 'フリガナ', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'address', 'ご住所', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'email', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'phone', '電話番号', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'fax', 'FAX', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'staff', 'お客様担当', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'reserve_status', '予約ステータス（確定・キャンセル）', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'guide_at', '案内日時（反響一覧の来場予約の日・時間）', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'other_wish', 'その他のご希望日時', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'meeting_place', '集合場所', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'message', '連絡事項', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'canceled_at', 'キャンセル日時', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'cancel_route', 'キャンセル経路', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'cancel_reason', 'キャンセル理由', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'property_type', '物件種別', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'property_code', 'SUUMO の物件コード', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'project_code', 'SUUMO のプロジェクトコード', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'property_name', '物件名（反響一覧の property）', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'property_price', '価格', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'property_address', '物件の所在地（反響一覧の area）', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'listing_plan', '掲載企画', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'company_property_code', '貴社物件コード', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'transaction_type', '取引態様', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'origin_company', '元付会社', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'company_staff', '貴社ご担当', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'traffic', '交通', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'layout', '間取り', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'exclusive_area', '専有面積', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'building_area', '建物面積', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'land_area', '土地面積', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'customer_id', 'suumo_db_kaeru の顧客ID（② が結ぶ。候補が1人のときだけ。結べなければ NULL）', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'customer_match', '結び方（id ／ name ／ mail ／ phone）', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'remarks', 'CSV の全項目をつないだ文（反響一覧の note）', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'created_at', '作成日時', '改修', '2.2.301', NOW()),
  ('suumo_action_kaeru', 'updated_at', '更新日時（上書きで変わる）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- suumo_db：SUUMO 反響の取り込み元（注文住宅）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('suumo_db', 'SUUMO 反響の取り込み元（注文住宅）', 'order', 'SUUMO（注文住宅。KH・DJH・Nagomi）の資料請求の生データ。1行が1件の資料請求（依頼番号）。
sync の runSuumoOrder.ts が SUUMO の管理画面から CSV を落とし、① の request suumo_db_order（handlers/suumo_db_order.php）へ500件ずつ送る。
同じ処理で反響一覧（inquiry_customer）に `suumo<依頼番号>` の行を足す（portal/suumo_order.php。媒体 SUUMO）。
⚠️ 鍵は id_suumo だが UNIQUE キーは無い。PHP が既にある依頼番号を SELECT してから入れる（core/bulk_upsert.php）。
⚠️ 毎回「前月1日から」の全件が送られてくるので、平常時は skipped が多いのが正常。
画面から直接は読まない（反響一覧は inquiry_customer を読む）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'suumo_db' AND column_name NOT IN ('id', 'date_suumo', 'id_suumo', 'sei_suumo', 'mei_suumo', 'sei_kana_suumo', 'mei_kana_suumo', 'age_suumo', 'zip_suumo', 'address1_suumo', 'address2_suumo', 'address3_suumo', 'mail_suumo', 'phone_suumo', 'period_suumo', 'budget_suumo', 'shop_suumo', 'place_suumo', 'duplicate_suumo', 'result');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('suumo_db', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('suumo_db', 'date_suumo', '資料請求日（YYYY/MM/DD。CSV の「.」を「/」に直して入れる）', '改修', '2.2.301', NOW()),
  ('suumo_db', 'id_suumo', '依頼番号（SUUMO 側の番号）。反響一覧の inquiry_id は `suumo` ＋この値', '改修', '2.2.301', NOW()),
  ('suumo_db', 'sei_suumo', '氏名の姓（漢字）', '改修', '2.2.301', NOW()),
  ('suumo_db', 'mei_suumo', '氏名の名（漢字）', '改修', '2.2.301', NOW()),
  ('suumo_db', 'sei_kana_suumo', '氏名の姓（フリガナ）', '改修', '2.2.301', NOW()),
  ('suumo_db', 'mei_kana_suumo', '氏名の名（フリガナ）', '改修', '2.2.301', NOW()),
  ('suumo_db', 'age_suumo', '年齢', '改修', '2.2.301', NOW()),
  ('suumo_db', 'zip_suumo', '郵便番号（反響一覧には入れない）', '改修', '2.2.301', NOW()),
  ('suumo_db', 'address1_suumo', '住所1', '改修', '2.2.301', NOW()),
  ('suumo_db', 'address2_suumo', '住所2（反響一覧には使わない）', '改修', '2.2.301', NOW()),
  ('suumo_db', 'address3_suumo', '住所3。建設予定地で店舗が決まらないとき、店舗判定に使う', '改修', '2.2.301', NOW()),
  ('suumo_db', 'mail_suumo', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('suumo_db', 'phone_suumo', '電話番号', '改修', '2.2.301', NOW()),
  ('suumo_db', 'period_suumo', '建築予定時期', '改修', '2.2.301', NOW()),
  ('suumo_db', 'budget_suumo', '予算（土地予算を除く）', '改修', '2.2.301', NOW()),
  ('suumo_db', 'shop_suumo', '取り込んだアカウントのブランド（KH / DJH / Nagomi）。店舗名ではない', '改修', '2.2.301', NOW()),
  ('suumo_db', 'place_suumo', '建設予定地（名称）。店舗判定の第1優先。反響一覧の area に入る', '改修', '2.2.301', NOW()),
  ('suumo_db', 'duplicate_suumo', '重複の印（運用側で更新。取り込みでは触らない）', '改修', '2.2.301', NOW()),
  ('suumo_db', 'result', '結果（例「来場済み」。運用側で更新。取り込みでは触らない）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- suumo_db_kaeru：SUUMO 顧客の取り込み元（建売）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('suumo_db_kaeru', 'SUUMO 顧客の取り込み元（建売）', 'spec', 'SUUMO（建売。かえるホーム。kr-hometour.suumo.jp）の「お客様」画面の CSV。1行が SUUMO 上の顧客1人（customer_id）。
sync（suumoKaeruCsv.ts）が過去3日に動きのあった顧客だけを ① の request suumo_db_kaeru（handlers/suumo_db_kaeru.php）へ送り、customer_id で上書き（ON DUPLICATE KEY UPDATE）する。
② の suumo_kaeru:actions（features/suumoKaeru.ts）が、反響ごとの CSV（suumo_action_kaeru）をどの顧客の反響か結ぶのに読む（初回・最新の予約ID/反響ID、氏名・電話・メール）。
⚠️ v2.2.263 から、この表からは反響一覧（inquiry_customer_kaeru）に行を足さない。反響一覧の行は suumo_action_kaeru から作る。以前の行は `suumo_<顧客ID>`。
⚠️ 日時の列はすべて文字列（YYYY/MM/DD HH:MM:SS）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'suumo_db_kaeru' AND column_name NOT IN ('no', 'customer_id', 'registered_at', 'name', 'name_kana', 'email', 'phone', 'fax', 'address', 'staff', 'follow_status', 'first_reaction_date', 'first_reaction_method', 'first_reaction_media', 'memo', 'first_reaction_reserve_id', 'first_reaction_id', 'first_reaction_received_at', 'first_reaction_type', 'first_reaction_property_type', 'first_reaction_property_code', 'first_reaction_property_name', 'first_reaction_property_price', 'first_reaction_property_address', 'latest_reaction_reserve_id', 'latest_reaction_id', 'latest_reaction_received_at', 'latest_reaction_type', 'latest_reaction_property_type', 'latest_reaction_property_code', 'latest_reaction_property_name', 'latest_reaction_property_price', 'latest_reaction_property_address', 'first_visit_datetime', 'first_visit_input_method', 'first_visit_schedule_type', 'first_visit_property_type', 'first_visit_property_code', 'first_visit_property_name', 'first_visit_property_price', 'first_visit_property_address', 'latest_visit_datetime', 'latest_visit_input_method', 'latest_visit_schedule_type', 'latest_visit_property_type', 'latest_visit_property_code', 'latest_visit_property_name', 'latest_visit_property_price', 'latest_visit_property_address', 'contract_date', 'contract_price', 'contract_fee_status', 'contract_fee_amount', 'contract_additional_status', 'contract_additional_amount', 'contract_property_type', 'contract_property_code', 'contract_property_name', 'contract_property_price', 'contract_property_address', 'contract_status', 'reaction_count', 'visit_count', 'contract_flag', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('suumo_db_kaeru', 'no', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'customer_id', 'SUUMO の顧客ID。上書きの鍵', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'registered_at', '登録日時', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'name', '氏名', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'name_kana', '氏名カナ', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'email', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'phone', '電話', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'fax', 'FAX', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'address', '住所', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'staff', 'お客様担当（SUUMO 上の担当）', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'follow_status', '追客状況', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_reaction_date', '初回反響日', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_reaction_method', '初回反響方法', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_reaction_media', '初回反響媒体', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'memo', 'メモ（SUUMO 上のメモ）', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_reaction_reserve_id', '初回反響の予約ID。反響を顧客に結ぶのに使う', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_reaction_id', '初回反響の反響ID。反響を顧客に結ぶのに使う', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_reaction_received_at', '初回反響の受付日時', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_reaction_type', '初回反響の反響種別', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_reaction_property_type', '初回反響の物件種別', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_reaction_property_code', '初回反響の物件コード', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_reaction_property_name', '初回反響の物件名', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_reaction_property_price', '初回反響の物件価格', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_reaction_property_address', '初回反響の物件所在地', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_reaction_reserve_id', '最新反響の予約ID', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_reaction_id', '最新反響の反響ID', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_reaction_received_at', '最新反響の受付日時', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_reaction_type', '最新反響の反響種別', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_reaction_property_type', '最新反響の物件種別', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_reaction_property_code', '最新反響の物件コード', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_reaction_property_name', '最新反響の物件名', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_reaction_property_price', '最新反響の物件価格', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_reaction_property_address', '最新反響の物件所在地', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_visit_datetime', '初回来場の来場日時', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_visit_input_method', '初回来場の入力方法', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_visit_schedule_type', '初回来場の予定種別', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_visit_property_type', '初回来場の物件種別', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_visit_property_code', '初回来場の物件コード', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_visit_property_name', '初回来場の物件名', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_visit_property_price', '初回来場の物件価格', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'first_visit_property_address', '初回来場の物件所在地', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_visit_datetime', '最新来場の来場日時', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_visit_input_method', '最新来場の入力方法', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_visit_schedule_type', '最新来場の予定種別', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_visit_property_type', '最新来場の物件種別', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_visit_property_code', '最新来場の物件コード', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_visit_property_name', '最新来場の物件名', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_visit_property_price', '最新来場の物件価格', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'latest_visit_property_address', '最新来場の物件所在地', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_date', '成約日', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_price', '成約価格', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_fee_status', '仲介手数料ステータス', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_fee_amount', '仲介手数料（万円。数に直して入れる）', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_additional_status', '付帯工事額・紹介料収入ステータス', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_additional_amount', '付帯工事額・紹介料収入（万円。数に直して入れる）', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_property_type', '成約の物件種別', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_property_code', '成約の物件コード', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_property_name', '成約の物件名', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_property_price', '成約の物件価格', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_property_address', '成約の物件所在地', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_status', '成約ステータス', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'reaction_count', '反響回数', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'visit_count', '来場回数', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'contract_flag', '成約フラグ', '改修', '2.2.301', NOW()),
  ('suumo_db_kaeru', 'remarks', 'CSV の全項目を「見出し：値」で改行区切りにした文', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- suumo_db_resale：SUUMO 反響の取り込み元（中古）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('suumo_db_resale', 'SUUMO 反響の取り込み元（中古）', 'used', 'SUUMO（中古住宅専門店）の反響 CSV の生データ。1行が1件の反響（連番 sequence_no）。列は CSV の見出しそのまま。
sync の runSuumoResale.ts が CSV 全件を ① の request suumo_db_resale（handlers/suumo_db_resale.php）へ500件ずつ送り、上書き（ON DUPLICATE KEY UPDATE）する。
書き込みのあとに portal/suumo_resale.php が、表全体から未取込の行を
反響一覧（inquiry_customer_resale。`suumo_<連番>`・区分「買い:ポータル」）と不動産CRMの買いリード（brokerage_listings。extId `suumo:<連番>`）へ足す。
② の realty/ieloveMatch.ts が、買いリードをいえらぶの台帳に結ぶのに company_property_code を読む。
⚠️ received_at は `2026/7/02 12:06:19` のように月が0埋めされない。⚠️ 氏名が姓の列にまとめて入る行、電話が phone_1 に全部入る行がある。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'suumo_db_resale' AND column_name NOT IN ('id', 'received_at', 'sequence_no', 'source_campaign', 'recipient_type', 'recipient_code', 'spare_1', 'spare_2', 'spare_3', 'spare_4', 'spare_5', 'last_name_kanji', 'first_name_kanji', 'last_name_kana', 'first_name_kana', 'zip_code_1', 'zip_code_2', 'address_1', 'address_2', 'address_3', 'email', 'phone_1', 'phone_2', 'phone_3', 'fax_1', 'fax_2', 'fax_3', 'current_residence', 'planned_occupants', 'eldest_child_lifestage', 'parking_available', 'annual_income', 'birth_date', 'age', 'desired_move_in', 'preferred_area_1', 'preferred_area_2', 'preferred_area_3', 'budget_rent', 'preferred_layout_1', 'preferred_layout_2', 'preferred_layout_3', 'preferred_layout_4', 'preferred_layout_5', 'preferred_layout_6', 'preferred_living_area', 'other_property_type_1', 'other_property_type_2', 'other_property_type_3', 'other_property_type_4', 'inquiry_unit', 'other', 'preferred_contact_method', 'preferred_contact_time', 'inquiry_content_1', 'inquiry_content_2', 'inquiry_content_3', 'inquiry_content_4', 'inquiry_content_5', 'inquiry_comment', 'inquiry_other', 'reserve_1', 'reserve_2', 'reserve_3', 'reserve_4', 'reserve_5', 'customer_notes', 'sale_assessment_info', 'commercial_info', 'company_name', 'branch_name', 'company_location', 'company_tel', 'media_name', 'media_type', 'issue', 'page', 'property_type', 'status', 'property_code', 'property_name_1', 'property_name_2', 'company_property_code', 'contact_person', 'inquiry_unit_detail', 'line_name', 'nearest_station', 'bus_or_walk', 'property_location', 'price_or_rent', 'layout', 'area_building_area', 'land_area', 'free_1', 'free_2', 'created_at', 'remarks');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('suumo_db_resale', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'received_at', '受付日時（文字列。月が0埋めされない）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'sequence_no', '連番（SUUMO 側の反響の番号）。反響一覧・買いリードの鍵', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'source_campaign', '発生元キャンペーン', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'recipient_type', '宛先種別', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'recipient_code', '宛先コード', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'spare_1', '予備1', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'spare_2', '予備2', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'spare_3', '予備3', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'spare_4', '予備4', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'spare_5', '予備5', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'last_name_kanji', '氏名（漢字）姓。⚠️ 姓名まとめて入る行がある', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'first_name_kanji', '氏名（漢字）名', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'last_name_kana', '氏名（カナ）姓', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'first_name_kana', '氏名（カナ）名', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'zip_code_1', '郵便番号1（上3桁）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'zip_code_2', '郵便番号2（下4桁）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'address_1', '住所1（反響一覧の pref に入る）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'address_2', '住所2（反響一覧の city に入る）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'address_3', '住所3（反響一覧の street に入る）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'email', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'phone_1', '電話番号1。⚠️ 全部入る行がある', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'phone_2', '電話番号2', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'phone_3', '電話番号3', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'fax_1', 'FAX1', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'fax_2', 'FAX2', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'fax_3', 'FAX3', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'current_residence', '現住居形態', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'planned_occupants', '入居予定人数', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'eldest_child_lifestage', '第一子ライフステージ', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'parking_available', '駐車場の有無', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'annual_income', '年収', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'birth_date', '生年月日', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'age', '年齢', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'desired_move_in', '入居希望時期', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'preferred_area_1', '希望エリア1', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'preferred_area_2', '希望エリア2', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'preferred_area_3', '希望エリア3', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'budget_rent', '予算/賃料', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'preferred_layout_1', '希望間取り1', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'preferred_layout_2', '希望間取り2', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'preferred_layout_3', '希望間取り3', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'preferred_layout_4', '希望間取り4', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'preferred_layout_5', '希望間取り5', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'preferred_layout_6', '希望間取り6', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'preferred_living_area', '希望専有面積', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'other_property_type_1', 'その他希望物件種別1', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'other_property_type_2', 'その他希望物件種別2', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'other_property_type_3', 'その他希望物件種別3', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'other_property_type_4', 'その他希望物件種別4', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'inquiry_unit', '反響単位', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'other', 'その他', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'preferred_contact_method', '希望連絡方法', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'preferred_contact_time', '希望連絡時間帯', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'inquiry_content_1', 'お問い合わせ内容1', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'inquiry_content_2', 'お問い合わせ内容2', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'inquiry_content_3', 'お問い合わせ内容3', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'inquiry_content_4', 'お問い合わせ内容4', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'inquiry_content_5', 'お問い合わせ内容5', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'inquiry_comment', 'お問い合わせコメント（買いリードの note に入る）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'inquiry_other', 'その他のお問い合わせ', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'reserve_1', '予約1', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'reserve_2', '予約2', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'reserve_3', '予約3', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'reserve_4', '予約4', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'reserve_5', '予約5', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'customer_notes', '顧客メモ', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'sale_assessment_info', '売却査定情報', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'commercial_info', '事業用情報', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'company_name', '会社名（自社）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'branch_name', '支店名', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'company_location', '会社所在地', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'company_tel', '会社電話番号', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'media_name', '媒体名', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'media_type', '媒体種別', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'issue', '発行', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'page', 'ページ', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'property_type', '物件種別', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'status', 'ステータス', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'property_code', '物件コード（SUUMO の番号）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'property_name_1', '物件名1（反響一覧の property に入る）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'property_name_2', '物件名2', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'company_property_code', '自社物件コード（いえらぶの6桁の物件番号）。ieloveMatch.ts が台帳に結ぶのに使う', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'contact_person', '担当者', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'inquiry_unit_detail', '反響単位詳細', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'line_name', '沿線名', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'nearest_station', '最寄り駅', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'bus_or_walk', 'バス・徒歩', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'property_location', '物件所在地（反響一覧の area に入る）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'price_or_rent', '価格/賃料（例 3490万円。買いリードの budget に直す）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'layout', '間取り', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'area_building_area', '専有面積/建物面積', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'land_area', '土地面積', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'free_1', 'フリー項目1（反響一覧の url に入る）', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'free_2', 'フリー項目2', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'created_at', '行を作った日時', '改修', '2.2.301', NOW()),
  ('suumo_db_resale', 'remarks', 'CSV の全項目を「見出し：値」で改行区切りにした文（反響一覧の note に入る）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- suumo_property：SUUMO 掲載順位
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('suumo_property', 'SUUMO 掲載順位', 'spec', 'SUUMO の新築一戸建ての一覧（エリアごと）の掲載順位を、取得した日ごとに積み上げた表。1行が「ある取得日時の、あるエリアの、ある物件」。
オーナーの PC で週1回動くスクレイパー（extensions/meta_scraper/suumo_scraper.ts）が1件ずつ ① のゲートウェイへ送り、① が ② の features/suumoProperty.ts へ転送して INSERT する。
画面は SUUMO 掲載順位（database/SuumoPropertySummary.tsx）。② の property_suumo_latest（features/propertyGet.ts）が、選んだ取得日の行と、物件ごとの前回の行を返す。
⚠️ UNIQUE キーが無い。二重に送ると同じ物件が2行になる（そのため ① の expressProxyExclusive に入れ、① の予備では書かない）。
⚠️ 上書きせず積み上げる。行数は増え続ける。⚠️ 列はすべて text（数値も文字列）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'suumo_property' AND column_name NOT IN ('id', 'rank', 'area', 'company', 'name', 'price', 'plan', 'url', 'registered_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('suumo_property', 'id', '主キー', '改修', '2.2.301', NOW()),
  ('suumo_property', 'rank', '掲載順位（文字列）。⚠️ 予約語なので SQL ではバッククォートで囲む', '改修', '2.2.301', NOW()),
  ('suumo_property', 'area', 'エリア（市区町村。例 姶良市）', '改修', '2.2.301', NOW()),
  ('suumo_property', 'company', '会社名（掲載している会社）', '改修', '2.2.301', NOW()),
  ('suumo_property', 'name', '物件名', '改修', '2.2.301', NOW()),
  ('suumo_property', 'price', '販売価格', '改修', '2.2.301', NOW()),
  ('suumo_property', 'plan', '物件プラン（掲載枠。例 レポート枠・コマ枠・デコレーション枠・プレミアム枠）', '改修', '2.2.301', NOW()),
  ('suumo_property', 'url', '詳細ページURL。前回順位を出すときに物件を見分ける鍵', '改修', '2.2.301', NOW()),
  ('suumo_property', 'registered_at', '取得日時（YYYY-MM-DD HH:MM:SS）。画面の「取得日」は先頭10文字', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- suumo_resale_summary：SUUMO 掲載物件のサマリー
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('suumo_resale_summary', 'SUUMO 掲載物件のサマリー', 'common', 'SUUMO に掲載している自社物件の一覧（掲載状況・PV など）。1行が1物件（management_no）。
sync の summary の処理（suumo_summary）が ① の request suumo_db_resale_summary（handlers/suumo_db_resale_summary.php）へ送り、management_no で上書き（ON DUPLICATE KEY UPDATE）する。management_no が空の行は捨てる。
同じ行を ② の property_db_portal（features/propertyPortal.ts）にも送り、物件DB（property_db）の空の列を埋める（docs/property-db-portal.md）。
画面は物件DB（DatabaseProperty.tsx）・物件のサマリー（PropertySummary.tsx）。② の property_list / property_detail（features/propertyGet.ts）が management_no ＝ property_db.property_id で結ぶ。
⚠️ アカウントの列が無い。建売（かえる）と中古の物件が1つの表に混ざる。
⚠️ basic_info などの列は、SUUMO の画面の複数の欄を1つにまとめた文（列のコメントの見出しの並び）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'suumo_resale_summary' AND column_name NOT IN ('id', 'basic_info', 'location_and_price', 'registered_images', 'contract_status', 'suumo_net_status', 'suumo_net_options', 'hp_service', 'suumo_magazine_past', 'suumo_magazine_current', 'timestamps_info', 'summary', 'catch_and_layout', 'trade_company_info', 'internal_info', 'company_code', 'property_type_detail', 'station_detail', 'address', 'min_price', 'max_price', 'original_company', 'original_staff', 'bulk_upload_code', 'management_no', 'staff_in_charge', 'property_category', 'publication_plan', 'pv_total', 'pv_recent_week', 'total_images', 'highlight_detail', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('suumo_resale_summary', 'id', 'システム用主キー', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'basic_info', '種別・物件名・号棟名/区画名・部屋番号・販売戸数/総戸数・会社間コピー物件・相互リンク・物件コード・販売状況をまとめた文', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'location_and_price', '沿線名・駅名・交通・バス停名・価格をまとめた文', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'registered_images', '登録画像（SUUMOマガジン用優先画像）（ハイライト）', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'contract_status', '成約状況', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'suumo_net_status', 'SUUMOネットのコマ掲載・レポート掲載（該当あり）・最終掲載', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'suumo_net_options', 'SUUMOネットのオプション商品（現在指示あり）', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'hp_service', 'HPサービス掲載（現在指示あり）', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'suumo_magazine_past', 'SUUMOマガジンの過去掲載', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'suumo_magazine_current', 'SUUMOマガジンの今回掲載（掲載指示あり）・掲載企画・最終掲載', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'timestamps_info', '物件登録日時・物件最終更新日時', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'summary', '概要', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'catch_and_layout', 'ネット用メインキャッチ・サブキャッチ・レイアウト・キャプション（間取りはこの文の中にしか無い）', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'trade_company_info', '取引態様・元付情報・会社情報', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'internal_info', '★マーク・問合先担当者・貴社御担当・貴社物件コード・社内コメント1/2・問合せ先（現場型）', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'company_code', '会社コード', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'property_type_detail', '物件種別', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'station_detail', '沿線駅', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'address', '住所（物件DB の address を埋めるのに使う）', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'min_price', '最低価格（円。物件DB の価格を埋めるのに使う）', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'max_price', '最高価格', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'original_company', '元付け会社名', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'original_staff', '元付け担当', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'bulk_upload_code', '一括入稿物件コード（末尾6桁がいえらぶの物件番号。使っていない）', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'management_no', '貴社物件管理NO（いえらぶの6桁の物件番号）。上書きの鍵・物件DB と結ぶ鍵', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'staff_in_charge', '貴社御担当', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'property_category', '物件区分（例 居住用）', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'publication_plan', '掲載企画', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'pv_total', '詳細PV数（全期間）', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'pv_recent_week', '詳細PV数（直近1週間）', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'total_images', '総画像数', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'highlight_detail', 'ハイライト', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'created_at', 'レコード作成日時', '改修', '2.2.301', NOW()),
  ('suumo_resale_summary', 'updated_at', 'レコード更新日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- sync_run_log：自動取り込みの実行結果
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('sync_run_log', '自動取り込みの実行結果', 'common', 'sync（Heroku の自動取り込み。projects/sync）や ② の取り込みの、1回の呼び出しの1タスクが1行（v2.2.259〜）。
書くのは ② の features/syncLog.ts（sync_log:write。sync が ② へ直接送る。ログイン無し・合い言葉 SYNC_LOG_SECRET）と、② の中の取り込み（hotlead など。route = ''② hotlead''）。
読むのは ② sync_log_list（Master だけ）→ 画面「システム管理 → 同期の実行結果」（header/system/SyncLog.tsx）。
⚠️ 180日より古い行は ② が起動の5分後と毎日消す。⚠️ 以前は失敗をメールで送っていたが届かなくなったため、この表に移した。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'sync_run_log' AND column_name NOT IN ('id', 'run_id', 'route', 'task', 'status', 'message', 'errors', 'started_at', 'finished_at', 'duration_ms', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('sync_run_log', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('sync_run_log', 'run_id', '1回の呼び出しの ID（同じ呼び出しで流れたタスクは同じ値）', '改修', '2.2.301', NOW()),
  ('sync_run_log', 'route', '呼ばれた入口（/api/portal_kaeru・/api/add_event・/api/breakaway・/api/update・② hotlead など）', '改修', '2.2.301', NOW()),
  ('sync_run_log', 'task', 'タスク名（property・suumo_resale など。入口だけの処理は入口名）', '改修', '2.2.301', NOW()),
  ('sync_run_log', 'status', 'success＝成功・partial＝最後まで動いたが途中で失敗あり・failure＝止まった', '改修', '2.2.301', NOW()),
  ('sync_run_log', 'message', '一行の結果', '改修', '2.2.301', NOW()),
  ('sync_run_log', 'errors', '失敗の理由（JSON の文字列の配列。1件4000字・50件まで）', '改修', '2.2.301', NOW()),
  ('sync_run_log', 'started_at', '開始（日本時間）', '改修', '2.2.301', NOW()),
  ('sync_run_log', 'finished_at', '終了（日本時間）', '改修', '2.2.301', NOW()),
  ('sync_run_log', 'duration_ms', 'かかった時間（ミリ秒）', '改修', '2.2.301', NOW()),
  ('sync_run_log', 'created_at', '行を書いた日時（DB の時刻）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- table_definition：テーブル定義書（テーブル）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('table_definition', 'テーブル定義書（テーブル）', 'common', 'テーブル定義書のテーブルごとの説明（v2.2.301）。1テーブル＝1行。
原稿は backend/scripts/tabledef/tables/<テーブル名>.md で、build-tabledef-sql.cjs が出す SQL で入れる。画面「システム管理 → テーブル定義書」（header/TableDefinition.tsx・Master だけ）が ② の table_definition で読む。
⚠️ 画面からは書き換えない（閲覧のみ）。⚠️ 型・NULL・既定値は持たない（② が SHOW FULL COLUMNS で実物から読む）。
⚠️ テーブルを作る・列を足す・意味を変えたら、原稿を直して SQL をその版の update_log の SQL に入れる（CLAUDE.md「テーブル定義書」）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'table_definition' AND column_name NOT IN ('table_name', 'title', 'business', 'description', 'source', 'updated_version', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('table_definition', 'table_name', 'テーブル名（主キー）', '改修', '2.2.301', NOW()),
  ('table_definition', 'title', '日本語の名前', '改修', '2.2.301', NOW()),
  ('table_definition', 'business', '事業（order 注文住宅 / spec 建売 / used 中古リノベ / realty 不動産企画係 / common 共通）', '改修', '2.2.301', NOW()),
  ('table_definition', 'description', 'テーブルの説明', '改修', '2.2.301', NOW()),
  ('table_definition', 'source', '出典（改修＝これまでの改修で扱った / 推論＝登録値から推した）', '改修', '2.2.301', NOW()),
  ('table_definition', 'updated_version', '説明を最後に直した版（説明・出典が変わったときだけ上がる）', '改修', '2.2.301', NOW()),
  ('table_definition', 'updated_at', '説明を最後に直した日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- townlife_db：タウンライフ 反響の取り込み元（注文住宅）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('townlife_db', 'タウンライフ 反響の取り込み元（注文住宅）', 'order', 'タウンライフ家づくり（注文住宅。KH・DJH・Nagomi・PG HOUSE・JH）の反響の生データ。1行が1件の問い合わせ（問い合わせID）。
sync の runTownlifeOrder.ts が管理画面の CSV を落とし（「取消処理されました」の行は除く）、① の request townlife_db_order（handlers/townlife_db_order.php）へ500件ずつ送る。
同じ処理で反響一覧（inquiry_customer）に `townlife<問い合わせID>` の行を足す（portal/townlife_order.php。媒体 タウンライフ）。
⚠️ 鍵は id_townlife だが UNIQUE キーは無い。PHP が既にある ID を SELECT してから入れる（core/bulk_upsert.php）。
⚠️ 列はすべて text。⚠️ 住所・電話・郵便番号は CSV の Excel の数式記号（="…"）を外してから入れる。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'townlife_db' AND column_name NOT IN ('id', 'id_townlife', 'name_townlife', 'kana_townlife', 'age_townlife', 'zip_townlife', 'pref_townlife', 'city_townlife', 'address_townlife', 'mail_townlife', 'phone_townlife', 'place_townlife', 'place_detail_townlife', 'floor_townlife', 'adult_townlife', 'child_townlife', 'ldk_townlife', 'budget_townlife', 'large_townlife', 'budget_estate_townlife', 'demand_estate_townlife', 'image_townlife', 'demand_house_townlife', 'note_townlife', 'response_date_townlife', 'shop_townlife', 'status_townlife', 'duplicate');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('townlife_db', 'id', '連番（自動採番）', '改修', '2.2.301', NOW()),
  ('townlife_db', 'id_townlife', '問い合わせID。反響一覧の inquiry_id は `townlife` ＋この値', '改修', '2.2.301', NOW()),
  ('townlife_db', 'name_townlife', '顧客氏名（全角スペースで姓と名に分けて反響一覧に入れる）', '改修', '2.2.301', NOW()),
  ('townlife_db', 'kana_townlife', 'ふりがな', '改修', '2.2.301', NOW()),
  ('townlife_db', 'age_townlife', '年齢', '改修', '2.2.301', NOW()),
  ('townlife_db', 'zip_townlife', '郵便番号', '改修', '2.2.301', NOW()),
  ('townlife_db', 'pref_townlife', '住所都道府県', '改修', '2.2.301', NOW()),
  ('townlife_db', 'city_townlife', '住所市区町村。建設予定地詳細で店舗が決まらないとき、店舗判定に使う', '改修', '2.2.301', NOW()),
  ('townlife_db', 'address_townlife', '住所詳細', '改修', '2.2.301', NOW()),
  ('townlife_db', 'mail_townlife', 'メールアドレス', '改修', '2.2.301', NOW()),
  ('townlife_db', 'phone_townlife', '電話番号', '改修', '2.2.301', NOW()),
  ('townlife_db', 'place_townlife', '建設予定地', '改修', '2.2.301', NOW()),
  ('townlife_db', 'place_detail_townlife', '建設予定地詳細。店舗判定の第1優先。反響一覧の area に入る', '改修', '2.2.301', NOW()),
  ('townlife_db', 'floor_townlife', '希望階数', '改修', '2.2.301', NOW()),
  ('townlife_db', 'adult_townlife', '予定人数（大人）', '改修', '2.2.301', NOW()),
  ('townlife_db', 'child_townlife', '予定人数（子ども）', '改修', '2.2.301', NOW()),
  ('townlife_db', 'ldk_townlife', '間取り（LDK）', '改修', '2.2.301', NOW()),
  ('townlife_db', 'budget_townlife', '建物予算', '改修', '2.2.301', NOW()),
  ('townlife_db', 'large_townlife', '土地の大きさ', '改修', '2.2.301', NOW()),
  ('townlife_db', 'budget_estate_townlife', '土地予算', '改修', '2.2.301', NOW()),
  ('townlife_db', 'demand_estate_townlife', '土地に関するご希望', '改修', '2.2.301', NOW()),
  ('townlife_db', 'image_townlife', '敷地図・土地図面等の添付', '改修', '2.2.301', NOW()),
  ('townlife_db', 'demand_house_townlife', '家のこだわり', '改修', '2.2.301', NOW()),
  ('townlife_db', 'note_townlife', 'その他', '改修', '2.2.301', NOW()),
  ('townlife_db', 'response_date_townlife', 'お問合せ日時（反響一覧の反響日になる）', '改修', '2.2.301', NOW()),
  ('townlife_db', 'shop_townlife', '取り込んだアカウントのブランド（KH / DJH / Nagomi / PG HOUSE / JH など）。店舗名ではない', '改修', '2.2.301', NOW()),
  ('townlife_db', 'status_townlife', '状況（タウンライフ上の確認状況。例「未読」「<日時>確認済み」）', '改修', '2.2.301', NOW()),
  ('townlife_db', 'duplicate', '他の媒体からの重複の印。同じメール・同じブランドでタウンライフ以外の反響が反響一覧にあると、取り込みのときに記録する（portalTownlifeMarkDuplicates）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- townlife_db_khf：タウンライフ 反響の取り込み元（国分ハウジング不動産）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('townlife_db_khf', 'タウンライフ 反響の取り込み元（国分ハウジング不動産）', 'spec', '（推定）タウンライフ不動産売買（国分ハウジング不動産。ブランド KHF）の反響の生データ。1行が1件の問い合わせ。
コードからの使用箇所なし（推定：以前の取り込みスクリプト portal-app の reloadTownlifeKhf.js が書いていた。注文の townlife_db とは別。docs/oldDocument/handover-portal-order.md では移植の対象外）。
登録は 2025/10/31〜2026/03/04 の227件で止まっている。反響一覧（inquiry_customer_kaeru・_resale）との結び付きは見つからない。
⚠️ 個人情報を含む。使わないなら整理の対象（推定）。', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'townlife_db_khf' AND column_name NOT IN ('no', 'id', 'name', 'kana', 'zip', 'address', 'mail', 'phone', 'category', 'area', 'plan', 'estate', 'price', 'demand', 'note', 'date', 'shop', 'situation', 'brand');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('townlife_db_khf', 'no', '連番（自動採番）', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'id', '（推定）タウンライフの問い合わせID（7桁）', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'name', '氏名', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'kana', 'ふりがな', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'zip', '郵便番号', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'address', '住所', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'mail', 'メールアドレス', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'phone', '電話番号', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'category', '希望物件種別（例 戸建て・マンション・土地。複数は「，」区切り）', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'area', '（推定）希望エリア', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'plan', '（推定）希望間取り', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'estate', '（推定）土地・物件に関する希望', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'price', '（推定）予算', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'demand', '（推定）ご希望・こだわり', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'note', '（推定）その他', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'date', '問い合わせ日（YYYY/MM/DD）', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'shop', '店舗（すべて「国分ハウジング不動産」）', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'situation', '状況（タウンライフ上の確認状況。例「<日時>確認済み」）', '推論', '2.2.301', NOW()),
  ('townlife_db_khf', 'brand', 'ブランド（すべて KHF）', '推論', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- tracking_conversions：アクセス解析の CV（自社フォーム以外）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('tracking_conversions', 'アクセス解析の CV（自社フォーム以外）', 'common', '自社のフォームでないサイト（まずはかえるホーム）でフォームを送った記録（v2.2.205）。サイト×顧客ID×メール×電話で1行（UNIQUE）。
書くのは ② の公開の受け口（GTM で入れた cv.js →「確認画面へ」で POST /api/track/cv。features/tracking/conversion.ts）。
② が5分ごとに反響（inquiry_customer_kaeru）のメール・電話を同じ方法でハッシュにして突き合わせ、一致したら反響の landing_params に khg_vid と流入の情報を書く（cvMatch.ts）。
アクセス解析の CV の数にも使う（完了ページが記録されないフォームの補い。conversions.ts・sites.ts）。
⚠️ メール・電話は保存しない（SHA-256 だけ）。⚠️ 14日たっても結びつかない行は ② が消す。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'tracking_conversions' AND column_name NOT IN ('id', 'site_id', 'visitor_id', 'form', 'email_hash', 'tel_hash', 'landing_params', 'page_url', 'created_at', 'matched_inquiry_id', 'matched_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('tracking_conversions', 'id', '連番', '改修', '2.2.301', NOW()),
  ('tracking_conversions', 'site_id', 'tracking_sites.id', '改修', '2.2.301', NOW()),
  ('tracking_conversions', 'visitor_id', '顧客ID（khg_vid）', '改修', '2.2.301', NOW()),
  ('tracking_conversions', 'form', 'フォームの種類（ページのパスの1段目。member・shop_reserve・search・contact など）', '改修', '2.2.301', NOW()),
  ('tracking_conversions', 'email_hash', 'メールアドレス（小文字・前後の空白なし）の SHA-256。無ければ空', '改修', '2.2.301', NOW()),
  ('tracking_conversions', 'tel_hash', '電話番号（数字だけ）の SHA-256。無ければ空', '改修', '2.2.301', NOW()),
  ('tracking_conversions', 'landing_params', '送ったときにブラウザが覚えていた流入の情報（対象のキーと khg_vid だけ）', '改修', '2.2.301', NOW()),
  ('tracking_conversions', 'page_url', 'フォームのページ（? 以降を除く）', '改修', '2.2.301', NOW()),
  ('tracking_conversions', 'created_at', '最後に送った日時', '改修', '2.2.301', NOW()),
  ('tracking_conversions', 'matched_inquiry_id', '結びついた反響の inquiry_id', '改修', '2.2.301', NOW()),
  ('tracking_conversions', 'matched_at', '結びついた日時（NULL は未突き合わせ）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- tracking_keep_visitors：閲覧の記録を消さない顧客ID
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('tracking_keep_visitors', '閲覧の記録を消さない顧客ID', 'common', 'tracking_pageviews の整理で消さない顧客ID（khg_vid）の一覧（v2.2.203）。1顧客ID＝1行。
書くのは ② features/tracking/maintenance.ts（起動の少しあとと6時間ごと）。反響（inquiry_customer・inquiry_customer_kaeru）と有効名簿（master_data・master_data_kaeru）の landing_params から khg_vid を拾って INSERT IGNORE する（MA 用）。
⚠️ 足すだけで消さない。⚠️ 手で直さない。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'tracking_keep_visitors' AND column_name NOT IN ('visitor_id', 'reason', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('tracking_keep_visitors', 'visitor_id', '顧客ID（khg_vid。主キー）', '改修', '2.2.301', NOW()),
  ('tracking_keep_visitors', 'reason', 'cv（反響あり）／ master（有効名簿）。最初に入ったときの理由', '改修', '2.2.301', NOW()),
  ('tracking_keep_visitors', 'created_at', '登録日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- tracking_pageviews：アクセス解析のページ閲覧
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('tracking_pageviews', 'アクセス解析のページ閲覧', 'common', 'タグを貼ったサイトのページ閲覧1回＝1行（v2.2.203）。約50万行。
書くのは ② の公開の受け口（tracker.js がページを開くたびに POST /api/track/pv。features/tracking/pageview.ts）。
読むのは「反響管理 → アクセス解析」と、顧客情報の「HP閲覧履歴」（request customer_pageviews。information/CustomerPageviews.tsx）。
⚠️ 上限 50万行（maintenance.ts の PAGEVIEW_CAP）を超えると、6時間ごとの整理で tracking_keep_visitors に無い顧客の古い行から消す。
⚠️ URL は ? 以降を保存しない（個人を特定できる値が入ることがあるため）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'tracking_pageviews' AND column_name NOT IN ('id', 'site_id', 'visitor_id', 'visit_id', 'url', 'title', 'prev_url', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('tracking_pageviews', 'id', '連番', '改修', '2.2.301', NOW()),
  ('tracking_pageviews', 'site_id', 'tracking_sites.id', '改修', '2.2.301', NOW()),
  ('tracking_pageviews', 'visitor_id', '顧客ID（khg_vid）', '改修', '2.2.301', NOW()),
  ('tracking_pageviews', 'visit_id', '訪問ID（30分以内の移動は同じ）', '改修', '2.2.301', NOW()),
  ('tracking_pageviews', 'url', '見たページ（? 以降を除く）', '改修', '2.2.301', NOW()),
  ('tracking_pageviews', 'title', 'ページのタイトル', '改修', '2.2.301', NOW()),
  ('tracking_pageviews', 'prev_url', '同じ訪問のひとつ前のページ（訪問の最初のページは NULL）', '改修', '2.2.301', NOW()),
  ('tracking_pageviews', 'created_at', '閲覧した日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- tracking_sites：アクセス解析のサイト
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('tracking_sites', 'アクセス解析のサイト', 'common', 'アクセス解析（広告流入トラッキング、v2.2.199）のタグを貼るサイト。1サイト＝1行（国分ハウジング・DAY JUST HOUSE・かえるホーム など）。
登録・更新は「反響管理 → アクセス解析」のサイトの設定（request tracking_site_list・tracking_site_save。features/tracking/sites.ts）。
公開の受け口（tracker.js → ② /api/track/…）が site_key でサイトを決め、tracking_touches・tracking_pageviews・tracking_conversions の site_id に入れる。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'tracking_sites' AND column_name NOT IN ('id', 'site_key', 'name', 'brand', 'allowed_origins', 'is_active', 'memo', 'cv_pages', 'updated_by', 'created_at', 'updated_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('tracking_sites', 'id', '連番（各 tracking_ 表の site_id）', '改修', '2.2.301', NOW()),
  ('tracking_sites', 'site_key', 'タグに埋め込むキー（s_＋16文字）。公開される識別子で、認証には使わない', '改修', '2.2.301', NOW()),
  ('tracking_sites', 'name', 'サイト名', '改修', '2.2.301', NOW()),
  ('tracking_sites', 'brand', 'ブランドキー（kh / djh / nagomi / fh / 2l / pg / jh / khf）。meta_ad_items.brand と同じ。NULL のサイトもある', '改修', '2.2.301', NOW()),
  ('tracking_sites', 'allowed_origins', '着地を受け付けるオリジン（JSON 配列）。例 ["https://kh-house.jp"]', '改修', '2.2.301', NOW()),
  ('tracking_sites', 'is_active', '0 = 無効（着地を保存しない）', '改修', '2.2.301', NOW()),
  ('tracking_sites', 'memo', '社内メモ（設置場所など）', '改修', '2.2.301', NOW()),
  ('tracking_sites', 'cv_pages', '完了ページ（CV にするページ。v2.2.287）。[{"pattern":"パスの先頭","kind":"CV の種類"}]。上から順に見て最初に当てはまったもの。NULL・[] なら反響の流入の記録（khg_vid）で数える', '改修', '2.2.301', NOW()),
  ('tracking_sites', 'updated_by', '最後に登録・更新した人', '改修', '2.2.301', NOW()),
  ('tracking_sites', 'created_at', '登録日時', '改修', '2.2.301', NOW()),
  ('tracking_sites', 'updated_at', '更新日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- tracking_touches：アクセス解析の着地（広告流入）
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('tracking_touches', 'アクセス解析の着地（広告流入）', 'common', '広告などのパラメータ付きでサイトに着地した1回＝1行（v2.2.199）。数十万行ある。
書くのは ② の公開の受け口（tracker.js → POST /api/track/touch。features/tracking/touch.ts）。
読むのは「反響管理 → アクセス解析」（summary・detail・vendors など）と、反響ごとの流入の一覧（request tracking_touches。list/TrackingTouches.tsx）。
反響とは inquiry_customer.landing_params の khg_vid（無ければ gclid などのクリックID）で結ぶ。外部キーは無い。
⚠️ 整理の処理（maintenance.ts）は、この表は消さない。
⚠️ IP は保存しない（ip_hash だけ）。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'tracking_touches' AND column_name NOT IN ('id', 'site_id', 'visitor_id', 'source', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'yclid', 'gad_source', 'gad_campaignid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'flyer', 'landing_url', 'referrer', 'user_agent', 'ip_hash', 'created_at');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('tracking_touches', 'id', '連番', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'site_id', 'tracking_sites.id', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'visitor_id', 'ブラウザの localStorage の khg_vid（UUID）', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'source', '流入元（フォームと同じ決め方：utm_source → Facebook/Instagram → Google → Yahoo → Flyer）', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'gclid', 'Google 広告のクリックID', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'gbraid', 'Google 広告のクリックID（iOS アプリ向け）', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'wbraid', 'Google 広告のクリックID（iOS ウェブ向け）', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'fbclid', 'Meta（Facebook・Instagram）のクリックID', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'yclid', 'Yahoo! 広告のクリックID', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'gad_source', 'Google 広告が付けるパラメータ gad_source', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'gad_campaignid', 'Google 広告のキャンペーンID（gad_campaignid）', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'utm_source', 'utm_source', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'utm_medium', 'utm_medium', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'utm_campaign', 'utm_campaign', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'utm_term', 'utm_term', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'utm_content', 'utm_content。⚠️ Meta 広告では広告ID（meta_ad_items.ad_id）が入る', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'flyer', 'チラシの識別（URL パラメータ flyer）', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'landing_url', '着地したページ（? 以降を除く）', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'referrer', '参照元', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'user_agent', 'ブラウザの User-Agent', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'ip_hash', 'IP は保存しない。SHA-256（ソルト付き）', '改修', '2.2.301', NOW()),
  ('tracking_touches', 'created_at', '着地した日時', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- update_log：更新履歴
INSERT INTO table_definition (table_name, title, business, description, source, updated_version, updated_at)
  VALUES ('update_log', '更新履歴', 'common', 'Dashboard の版ごとの更新内容。画面右上の版の表示と「更新履歴」に出る。
版を上げるたびに backend/scripts/sql/ の update_log の SQL で1行足す（CLAUDE.md「版を上げるとき」）。
⚠️ 最新の版の行が無いと画面が真っ白になる。', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(title <=> VALUES(title) AND business <=> VALUES(business) AND description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    title = VALUES(title), business = VALUES(business), description = VALUES(description), source = VALUES(source);
DELETE FROM column_definition WHERE table_name = 'update_log' AND column_name NOT IN ('no', 'version', 'date', 'note');
INSERT INTO column_definition (table_name, column_name, description, source, updated_version, updated_at) VALUES
  ('update_log', 'no', '連番（自動採番。SQL では書かない）', '改修', '2.2.301', NOW()),
  ('update_log', 'version', '版（例 2.2.301）。⚠️ frontend/src/utils/version.ts の newVersion・ブランチ名と同じ', '改修', '2.2.301', NOW()),
  ('update_log', 'date', '公開日', '改修', '2.2.301', NOW()),
  ('update_log', 'note', '更新内容の本文（画面の更新履歴にそのまま出る）', '改修', '2.2.301', NOW())
  ON DUPLICATE KEY UPDATE updated_version = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_version, VALUES(updated_version)),
    updated_at = IF(description <=> VALUES(description) AND source <=> VALUES(source), updated_at, VALUES(updated_at)),
    description = VALUES(description), source = VALUES(source);
-- <<< テーブル定義書と記事（v2.2.301 追記）
