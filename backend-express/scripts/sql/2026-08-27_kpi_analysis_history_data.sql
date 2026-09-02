-- ============================================================================
-- kpi_analysis_history: 開発環境で実行済みの分析結果を本番へ移行する
--
--   実行順序（このファイル単体では動きません）
--     1) 2026-08-27_kpi_analysis_history.sql   … テーブル定義
--     2) このファイル                           … データ
--
--   実行: mariadb -u<USER> -p <DB> < 2026-08-27_kpi_analysis_history_data.sql
--
-- ----------------------------------------------------------------------------
-- 設計上の判断
--
-- ■ テーブル定義をここに重複させない
--   DDL は 2026-08-27_kpi_analysis_history.sql が唯一の正とする。
--   同じ CREATE TABLE を2ファイルに置くと、片方だけ直されて必ず食い違う。
--   テーブルが無い状態で流すと INSERT が「table doesn't exist」で止まるため、
--   順序を間違えても黙って壊れることはない。
--
-- ■ usage_log_id は NULL で入れる
--   元の値（19）は **開発環境の** ai_usage_log.id である。
--   本番の ai_usage_log には、その分析に対応する行が存在しない。
--   一方で本番の id=19 には別の実行ログが入っている可能性が高く、
--   そのまま移すと「無関係な課金ログに紐付いた履歴」ができてしまう。
--   誤った紐付けより、紐付け無し（NULL）のほうが害が小さい。
--   この列は FK を張っていないため、NULL でも整合性の問題は起きない。
--
-- ■ id を指定しない
--   本番側の AUTO_INCREMENT に任せる。開発の id を持ち込むと、
--   本番で先に運用が始まっていた場合に衝突する。
--
-- ■ 二重実行しても増えない
--   (title, created_at) で既存行を確認してから挿入する。
--   ⚠️ 同じ人が同じ日に同じ範囲・同じ分析を実行すると title は重複しうるが、
--     created_at は秒精度のため、実運用で衝突することはない。
--
-- ----------------------------------------------------------------------------
-- 事前確認（本番で実行して 1 が返ることを確認してから流すこと）
--
--   SELECT COUNT(*) FROM staff WHERE id = 1;   -- 川野 慎司。FK 先が存在するか
--
--   存在しない場合、下の INSERT は外部キー制約でエラーになる。
--   その場合は staff_id を本番の該当スタッフの id に読み替えること。
-- ----------------------------------------------------------------------------
-- 対象: 1件
--   2026-08-27 08:40:34 / staff_id=1 / inquiry_trend / 注文事業 › 鹿児島営業1課
-- ============================================================================

-- 2026年8月27日 注文事業_鹿児島営業1課 反響推移の分析
INSERT INTO `kpi_analysis_history`
  (`staff_id`, `usage_log_id`, `title`, `headline`, `analysis_type`, `division`,
   `scope_section`, `scope_shop`, `scope_staff`, `scope_label`,
   `analysis_json`, `kpi_json`, `model`, `created_at`)
SELECT '1',
       NULL,
       '2026年8月27日 注文事業_鹿児島営業1課 反響推移の分析',
       '鹿児島営業1課の反響量は月150件前後で安定し、締まった直近月（2026-07）も前月比-2%とほぼ横ばい。一方で反響の3分の1を占めるタウンライフが面談にほとんどつながっておらず、量ではなく「構成の偏り」が成果を抑える最大の要因になっています。',
       'inquiry_trend',
       'order',
       '鹿児島営業1課',
       NULL,
       NULL,
       '注文事業 › 鹿児島営業1課',
       '{\"headline\":\"鹿児島営業1課の反響量は月150件前後で安定し、締まった直近月（2026-07）も前月比-2%とほぼ横ばい。一方で反響の3分の1を占めるタウンライフが面談にほとんどつながっておらず、量ではなく「構成の偏り」が成果を抑える最大の要因になっています。\",\"highlights\":[{\"metric\":\"反響取得数（締まった直近月）\",\"observation\":\"2026-07は147件で前月比ほぼ横ばい。12ヶ月平均163件に対しやや下回るが、季節変動の範囲内で急減の兆候はない。\",\"assessment\":\"neutral\"},{\"metric\":\"面談化率（成熟済み月）\",\"observation\":\"2025-08〜2026-06は概ね22〜31%で推移し、部門平均27.1%と同水準。初期対応力そのものは部門標準を維持している。\",\"assessment\":\"neutral\"},{\"metric\":\"媒体構成と転換率のミスマッチ\",\"observation\":\"最大シェア（34.3%）のタウンライフは面談化率2.3%・契約率0.2%。対してSNS広告・チラシ・紹介・インターネット検索は面談化率54〜82%と大きく乖離している。\",\"assessment\":\"negative\"}],\"insights\":[{\"title\":\"直近2ヶ月の低い面談・契約率は成熟途上\",\"detail\":\"2026-07・08は is_maturing（08は is_partial）に該当し、契約まで平均約2ヶ月かかるため契約0〜1件は成績悪化の証拠にならない。この2ヶ月を除いた月次では契約率3.6〜6.1%で、部門平均3.9%と同等以上の月が多い。\",\"basis\":\"data\"},{\"title\":\"ただし7月の面談化率17.7%は要確認\",\"detail\":\"面談までの平均日数は7.8日であり、7月取得分の面談は集計時点でほぼ出揃っている可能性が高い。同月にタウンライフ比率が相対的に高かったことと合わせ、構成要因か初期対応の遅れか、入力遅延かの切り分けが必要。データだけでは断定できない。\",\"basis\":\"hypothesis\"},{\"title\":\"成果は少数の高転換媒体に集中している\",\"detail\":\"期間全体で紹介（73件で契約18件）、SNS広告（176件で15件）、インターネット検索（196件で14件）、チラシ（110件で8件）が契約の大半を生んでいる。一方でタウンライフ646件からの契約は1件にとどまる。\",\"basis\":\"data\"},{\"title\":\"低転換媒体は「見込みの質」以前に接触段階で落ちている疑い\",\"detail\":\"タウンライフ・カゴスマ・SUUMO・土地新着ネットは面談化率が0〜16%と極端に低く、一括資料請求型で連絡がつきにくい、あるいは面談・ランクの入力運用が媒体によって異なる可能性がある。部門全体の入力カバー率（面談日27.1%、ランク29%）も低く、記録漏れの影響を排除できない。\",\"basis\":\"hypothesis\"}],\"actions\":[{\"title\":\"タウンライフ流入の扱いを再設計する\",\"detail\":\"全体の3分の1を占めながら契約1件という実績を踏まえ、初期コール体制の変更（送客直後の即応・SMS併用など）を1〜2ヶ月試し、改善しなければ予算・工数の配分見直しを検討する。判断前に、面談実施の入力漏れがないかも必ず確認する。\"},{\"title\":\"高転換媒体の増量を優先課題に置く\",\"detail\":\"紹介・SNS広告・チラシ・インターネット検索は面談化率50%超。特に紹介は母数73件と小さいため率の断定は避けつつ、既契約者からの紹介創出とSNS広告の予算増を、量を増やす主軸として検討する。\"},{\"title\":\"2026-07の面談化率低下の要因を来月に再検証する\",\"detail\":\"7月・8月コホートは成熟途上のため、9月時点で同月の面談・契約数を再集計し、媒体構成の変化によるものか初期対応の問題かを切り分ける。単月の数値で担当者評価を行わない。\"}]}',
       '{\"generated_at\":\"2026-08-27 08:39\",\"period_months\":12,\"division\":\"注文事業\",\"scope_label\":\"注文事業 › 鹿児島営業1課\",\"source\":\"注文事業（master_data）の show_dashboard = 1（ダッシュボード表示対象）のみ。重複・非表示レコードは除外。 さらに「注文事業 › 鹿児島営業1課」に絞り込み済み（対象店舗: DJH加世田店\\/ KH鹿児島店\\/ KH加世田店\\/ なごみ鹿児島店\\/ なごみ加世田店）。以下の数値はすべてこの範囲のもの。 顧客個人を特定できる列は集計に使用していない。\",\"benchmark\":{\"label\":\"注文事業全体（直近12ヶ月）\",\"context\":{\"total\":13363,\"interviewed\":3628,\"contracted\":518,\"interview_rate_pct\":27.1,\"contract_rate_pct\":3.9,\"close_rate_pct\":14.3,\"avg_days_to_interview\":7.8,\"avg_days_to_contract\":49.7,\"input_coverage_pct\":{\"registered_date\":100,\"interview_date\":27.1,\"contract_date\":3.9,\"customer_rank\":29,\"customer_demand\":16.6,\"annual_income\":8.2}}},\"note\":\"当月（2026-08）は取得件数がまだ増えるため is_partial = true。is_maturing = true の月（2026-05 以降）は取得件数は確定しているが、契約まで平均約2ヶ月かかるため面談・契約の数がまだ出揃っていない。\",\"monthly\":[{\"month\":\"2025-08\",\"count\":143,\"interviewed\":45,\"contracted\":7,\"high_rank\":6,\"interview_rate_pct\":31.5,\"contract_rate_pct\":4.9,\"high_rank_pct\":4.2,\"is_partial\":false,\"is_maturing\":false},{\"month\":\"2025-09\",\"count\":236,\"interviewed\":46,\"contracted\":2,\"high_rank\":2,\"interview_rate_pct\":19.5,\"contract_rate_pct\":0.8,\"high_rank_pct\":0.8,\"is_partial\":false,\"is_maturing\":false},{\"month\":\"2025-10\",\"count\":215,\"interviewed\":50,\"contracted\":11,\"high_rank\":11,\"interview_rate_pct\":23.3,\"contract_rate_pct\":5.1,\"high_rank_pct\":5.1,\"is_partial\":false,\"is_maturing\":false},{\"month\":\"2025-11\",\"count\":166,\"interviewed\":37,\"contracted\":6,\"high_rank\":4,\"interview_rate_pct\":22.3,\"contract_rate_pct\":3.6,\"high_rank_pct\":2.4,\"is_partial\":false,\"is_maturing\":false},{\"month\":\"2025-12\",\"count\":110,\"interviewed\":27,\"contracted\":5,\"high_rank\":5,\"interview_rate_pct\":24.5,\"contract_rate_pct\":4.5,\"high_rank_pct\":4.5,\"is_partial\":false,\"is_maturing\":false},{\"month\":\"2026-01\",\"count\":148,\"interviewed\":42,\"contracted\":6,\"high_rank\":5,\"interview_rate_pct\":28.4,\"contract_rate_pct\":4.1,\"high_rank_pct\":3.4,\"is_partial\":false,\"is_maturing\":false},{\"month\":\"2026-02\",\"count\":147,\"interviewed\":38,\"contracted\":9,\"high_rank\":9,\"interview_rate_pct\":25.9,\"contract_rate_pct\":6.1,\"high_rank_pct\":6.1,\"is_partial\":false,\"is_maturing\":false},{\"month\":\"2026-03\",\"count\":152,\"interviewed\":42,\"contracted\":6,\"high_rank\":6,\"interview_rate_pct\":27.6,\"contract_rate_pct\":3.9,\"high_rank_pct\":3.9,\"is_partial\":false,\"is_maturing\":false},{\"month\":\"2026-04\",\"count\":160,\"interviewed\":50,\"contracted\":8,\"high_rank\":7,\"interview_rate_pct\":31.3,\"contract_rate_pct\":5,\"high_rank_pct\":4.4,\"is_partial\":false,\"is_maturing\":false},{\"month\":\"2026-05\",\"count\":181,\"interviewed\":51,\"contracted\":10,\"high_rank\":10,\"interview_rate_pct\":28.2,\"contract_rate_pct\":5.5,\"high_rank_pct\":5.5,\"is_partial\":false,\"is_maturing\":true},{\"month\":\"2026-06\",\"count\":150,\"interviewed\":39,\"contracted\":7,\"high_rank\":6,\"interview_rate_pct\":26,\"contract_rate_pct\":4.7,\"high_rank_pct\":4,\"is_partial\":false,\"is_maturing\":true},{\"month\":\"2026-07\",\"count\":147,\"interviewed\":26,\"contracted\":0,\"high_rank\":0,\"interview_rate_pct\":17.7,\"contract_rate_pct\":0,\"high_rank_pct\":0,\"is_partial\":false,\"is_maturing\":true},{\"month\":\"2026-08\",\"count\":125,\"interviewed\":18,\"contracted\":1,\"high_rank\":1,\"interview_rate_pct\":14.4,\"contract_rate_pct\":0.8,\"high_rank_pct\":0.8,\"is_partial\":true,\"is_maturing\":true}],\"by_medium\":[{\"medium\":\"タウンライフ\",\"count\":646,\"interviewed\":15,\"contracted\":1,\"share_pct\":34.3,\"interview_rate_pct\":2.3,\"contract_rate_pct\":0.2},{\"medium\":\"HOME\'S\",\"count\":298,\"interviewed\":15,\"contracted\":5,\"share_pct\":15.8,\"interview_rate_pct\":5,\"contract_rate_pct\":1.7},{\"medium\":\"インターネット検索\",\"count\":196,\"interviewed\":107,\"contracted\":14,\"share_pct\":10.4,\"interview_rate_pct\":54.6,\"contract_rate_pct\":7.1},{\"medium\":\"SNS広告\",\"count\":176,\"interviewed\":113,\"contracted\":15,\"share_pct\":9.4,\"interview_rate_pct\":64.2,\"contract_rate_pct\":8.5},{\"medium\":\"カゴスマ\",\"count\":135,\"interviewed\":10,\"contracted\":1,\"share_pct\":7.2,\"interview_rate_pct\":7.4,\"contract_rate_pct\":0.7},{\"medium\":\"ALLGRIT\",\"count\":132,\"interviewed\":32,\"contracted\":4,\"share_pct\":7,\"interview_rate_pct\":24.2,\"contract_rate_pct\":3},{\"medium\":\"チラシ\",\"count\":110,\"interviewed\":76,\"contracted\":8,\"share_pct\":5.8,\"interview_rate_pct\":69.1,\"contract_rate_pct\":7.3},{\"medium\":\"SUUMO\",\"count\":87,\"interviewed\":14,\"contracted\":1,\"share_pct\":4.6,\"interview_rate_pct\":16.1,\"contract_rate_pct\":1.1},{\"medium\":\"紹介\",\"count\":73,\"interviewed\":60,\"contracted\":18,\"share_pct\":3.9,\"interview_rate_pct\":82.2,\"contract_rate_pct\":24.7},{\"medium\":\"土地新着ネット\",\"count\":29,\"interviewed\":0,\"contracted\":0,\"share_pct\":1.5,\"interview_rate_pct\":0,\"contract_rate_pct\":0}],\"medium_monthly\":[{\"medium\":\"タウンライフ\",\"monthly\":[{\"month\":\"2025-08\",\"count\":41},{\"month\":\"2025-09\",\"count\":111},{\"month\":\"2025-10\",\"count\":94},{\"month\":\"2025-11\",\"count\":68},{\"month\":\"2025-12\",\"count\":45},{\"month\":\"2026-01\",\"count\":32},{\"month\":\"2026-02\",\"count\":36},{\"month\":\"2026-03\",\"count\":35},{\"month\":\"2026-04\",\"count\":38},{\"month\":\"2026-05\",\"count\":44},{\"month\":\"2026-06\",\"count\":34},{\"month\":\"2026-07\",\"count\":25},{\"month\":\"2026-08\",\"count\":43}]},{\"medium\":\"HOME\'S\",\"monthly\":[{\"month\":\"2025-08\",\"count\":16},{\"month\":\"2025-09\",\"count\":24},{\"month\":\"2025-10\",\"count\":28},{\"month\":\"2025-11\",\"count\":23},{\"month\":\"2025-12\",\"count\":11},{\"month\":\"2026-01\",\"count\":31},{\"month\":\"2026-02\",\"count\":22},{\"month\":\"2026-03\",\"count\":22},{\"month\":\"2026-04\",\"count\":21},{\"month\":\"2026-05\",\"count\":34},{\"month\":\"2026-06\",\"count\":26},{\"month\":\"2026-07\",\"count\":23},{\"month\":\"2026-08\",\"count\":17}]},{\"medium\":\"インターネット検索\",\"monthly\":[{\"month\":\"2025-08\",\"count\":12},{\"month\":\"2025-09\",\"count\":15},{\"month\":\"2025-10\",\"count\":16},{\"month\":\"2025-11\",\"count\":7},{\"month\":\"2025-12\",\"count\":4},{\"month\":\"2026-01\",\"count\":13},{\"month\":\"2026-02\",\"count\":17},{\"month\":\"2026-03\",\"count\":32},{\"month\":\"2026-04\",\"count\":23},{\"month\":\"2026-05\",\"count\":20},{\"month\":\"2026-06\",\"count\":12},{\"month\":\"2026-07\",\"count\":16},{\"month\":\"2026-08\",\"count\":9}]},{\"medium\":\"SNS広告\",\"monthly\":[{\"month\":\"2025-08\",\"count\":7},{\"month\":\"2025-09\",\"count\":13},{\"month\":\"2025-10\",\"count\":17},{\"month\":\"2025-11\",\"count\":17},{\"month\":\"2025-12\",\"count\":11},{\"month\":\"2026-01\",\"count\":20},{\"month\":\"2026-02\",\"count\":12},{\"month\":\"2026-03\",\"count\":8},{\"month\":\"2026-04\",\"count\":17},{\"month\":\"2026-05\",\"count\":16},{\"month\":\"2026-06\",\"count\":15},{\"month\":\"2026-07\",\"count\":15},{\"month\":\"2026-08\",\"count\":8}]},{\"medium\":\"カゴスマ\",\"monthly\":[{\"month\":\"2025-08\",\"count\":11},{\"month\":\"2025-09\",\"count\":14},{\"month\":\"2025-10\",\"count\":14},{\"month\":\"2025-11\",\"count\":12},{\"month\":\"2025-12\",\"count\":2},{\"month\":\"2026-01\",\"count\":8},{\"month\":\"2026-02\",\"count\":12},{\"month\":\"2026-03\",\"count\":5},{\"month\":\"2026-04\",\"count\":12},{\"month\":\"2026-05\",\"count\":9},{\"month\":\"2026-06\",\"count\":17},{\"month\":\"2026-07\",\"count\":13},{\"month\":\"2026-08\",\"count\":6}]}],\"totals\":{\"period_total\":1882,\"closed_month_avg\":163,\"latest_closed_month\":\"2026-07\",\"latest_closed_count\":147,\"prev_closed_count\":150,\"mom_change_pct\":-2}}',
       'claude-opus-5',
       '2026-08-27 08:40:34'
  FROM DUAL
 WHERE NOT EXISTS (
     SELECT 1 FROM (SELECT `title`, `created_at` FROM `kpi_analysis_history`) AS h
      WHERE h.`title` = '2026年8月27日 注文事業_鹿児島営業1課 反響推移の分析'
        AND h.`created_at` = '2026-08-27 08:40:34'
 );
