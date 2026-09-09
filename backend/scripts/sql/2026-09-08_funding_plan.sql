-- ===========================================================
-- AIデジタル資金計画書（funding_plan）
--
-- 2026-09-08 新規
--
-- ─────────────────────────────────────────────
-- 何のテーブルか
--
--   営業が面談中に使う「AIデジタル資金計画書」の保存先。
--   元は 2,539行のバニラJSアプリ（localStorage に保存）で、
--   顧客ごとのデータをブラウザに閉じ込めていた。
--   端末を変えると消える／他の営業が見られないため、DBへ移す。
--
--   画面: frontend/public/funding-plan/index.html
--   API : backend-express/src/features/fundingPlan/
-- ─────────────────────────────────────────────
--
-- ⚠️⚠️ **列名は元HTMLの `data-k` 属性と1文字も違わない。**
--   `k_name` `d_tatemono` `x_h9n` のような素っ気ない名前だが、
--   これは意図的である。HTMLの入力欄と列が1対1で対応するため、
--   保存・復元のコードに変換表が要らない（175項目の変換表は必ず腐る）。
--   ⚠️ 列名を「分かりやすく」改名してはいけない。
--     改名するなら HTML の data-k も同時に変える必要がある。
--
-- ⚠️ 接頭辞がタブ（画面）を表す。
--     k_  ① お客様カルテ        d_  ③ デジシキ
--     s_  ④ 諸費用・借入条件    g_  ⑤ 住宅ローン控除
--     v_  ⑥ 太陽光・蓄電池      t_  ⑦ 今建てる/待つ の比較
--     x_  ⑧ 家計の内訳          f_  ⑧ FPの前提
--     w_  ⑨ 段取り              bk_ ⑩ 事前審査
--     ln_ ⑩ 金利データの基準日
--
-- ⚠️ 数値はすべて DECIMAL(14,3)。INT と使い分けていない。
--   「計画時期 0.5年後」「金利 0.875%」「面積 132.25㎡」が
--   切り捨てられるのを防ぐため、小数を持たない項目も揃えている。
--
-- ⚠️ 単位は**元HTMLの入力欄の単位のまま**である。列名からは分からない。
--     年収・自己資金・土地購入費 … 万円
--     家賃・光熱費・月々支払      … 円
--     面積                        … ㎡（s_ 系）または坪（k_tsubo / k_yuka）
--   ⚠️ master_data 側は単位が混在しているため、連携時に換算している。
--     詳細は backend-express/src/features/fundingPlan/mapping.ts
--
-- ⚠️ JSON 列は pool.ts の jsonStrings:true により**文字列**で返る。
--   受け取り側で JSON.parse すること。
--
-- ⚠️ ROW_FORMAT=DYNAMIC は必須。
--   VARCHAR(191) が29列あり、全角で満杯にすると in-page で
--   InnoDB の行サイズ上限（8,126バイト＝ページの半分）を超える。
--   DYNAMIC なら溢れた分をページ外に置くため書き込める。
--   COMPACT に変えると、長文を入れた顧客の保存だけが失敗する。
--   （ローカルで全列を最大長にした INSERT が通ることを確認済み）
-- ===========================================================

CREATE TABLE `funding_plan` (
  `id` VARCHAR(191) NOT NULL COMMENT 'master_data.id と同じ値。1顧客につき1件'

  -- ① お客様カルテ（ヒアリング）
  ,`k_name` VARCHAR(191) COMMENT 'お客様名（様邸）'
  ,`k_kana` VARCHAR(191) COMMENT 'ふりがな'
  ,`k_date` DATE COMMENT '作成日'
  ,`k_shop` VARCHAR(64) COMMENT '担当店舗。⚠️ master_data.in_charge_store と同じ値（KH鹿児島店 等）をそのまま保存する。印刷時だけ顧客向け表記へ変換する（mapping.ts の SHOP_LABEL）'
  ,`k_staff` VARCHAR(191) COMMENT '担当者'
  ,`k_addr` VARCHAR(191) COMMENT 'ご住所（現住所）'
  ,`k_tel` VARCHAR(191) COMMENT 'お電話番号'
  ,`k_mail` VARCHAR(191) COMMENT 'メールアドレス'
  ,`k_now` VARCHAR(64) COMMENT '現在のお住まい / 選択肢: 賃貸アパート・マンション|賃貸戸建|ご実家|社宅・寮|持ち家'
  ,`k_h_name` VARCHAR(191) COMMENT 'ご主人様 お名前'
  ,`k_h_birth` DATE COMMENT 'ご主人様 生年月日'
  ,`k_h_age` DECIMAL(14,3) COMMENT 'ご主人様 年齢'
  ,`k_h_work` VARCHAR(191) COMMENT 'ご主人様 お勤め先'
  ,`k_w_name` VARCHAR(191) COMMENT '奥様 お名前'
  ,`k_w_birth` DATE COMMENT '奥様 生年月日'
  ,`k_w_age` DECIMAL(14,3) COMMENT '奥様 年齢'
  ,`k_w_work` VARCHAR(191) COMMENT '奥様 お勤め先'
  ,`k_inc1` DECIMAL(14,3) COMMENT 'ご主人様 年収'
  ,`k_inc2` DECIMAL(14,3) COMMENT '奥様 年収'
  ,`k_jiko` DECIMAL(14,3) COMMENT 'ご自己資金（頭金）'
  ,`k_enjo` DECIMAL(14,3) COMMENT 'ご援助資金'
  ,`k_chochiku` DECIMAL(14,3) COMMENT '現在の貯蓄額'
  ,`k_rent` DECIMAL(14,3) COMMENT '家賃'
  ,`k_park` DECIMAL(14,3) COMMENT '駐車場'
  ,`k_elec` DECIMAL(14,3) COMMENT '電気代'
  ,`k_gas` DECIMAL(14,3) COMMENT 'ガス代'
  ,`k_l1` DECIMAL(14,3) COMMENT 'その他お借入①（車等）'
  ,`k_l2` DECIMAL(14,3) COMMENT 'その他お借入②'
  ,`k_l3` DECIMAL(14,3) COMMENT 'その他お借入③'
  ,`k_lb` DECIMAL(14,3) COMMENT 'お借入ボーナス払い'
  ,`k_trigger_etc` VARCHAR(191) COMMENT 'お家づくりを検討されるきっかけ'
  ,`k_timing` DECIMAL(14,3) COMMENT '計画時期'
  ,`k_area` VARCHAR(191) COMMENT '建築ご希望地'
  ,`k_style` VARCHAR(64) COMMENT 'ご希望の建て方 / 選択肢: 未定|平屋建て|2階建て'
  ,`k_tsubo` DECIMAL(14,3) COMMENT '土地の目安坪数'
  ,`k_yuka` DECIMAL(14,3) COMMENT 'ご希望の延床面積'
  ,`k_hope` DECIMAL(14,3) COMMENT 'ご希望の月々お支払額'
  ,`k_landhave` VARCHAR(64) COMMENT '土地の有無 / 選択肢: 未定|土地から探す|お持ちの土地に建てる|ご実家の敷地'
  ,`k_makers` VARCHAR(191) COMMENT '気になる住宅メーカーさん'
  ,`k_landwish` TEXT COMMENT '土地選びでここだけは外せないという部分（例：お子さんの学校区・ご実家が近く・通勤時間…）'
  ,`k_worry` TEXT COMMENT 'お家づくりで心配なこと・本日聞いておきたいこと（例：建築費、住宅ローン、土地探し、賃貸との違い）'
  ,`k_youbou` TEXT COMMENT 'ご要望・こだわり（間取り／設備／デザイン等）'
  ,`k_memo` TEXT COMMENT '次回アポイント・商談メモ'

  -- ③ デジシキ（資金計画の本体）
  ,`d_tatemono` DECIMAL(14,3) COMMENT '① 建物本体価格'
  ,`d_futai` DECIMAL(14,3) COMMENT '② 付帯工事費'
  ,`d_solarKw` DECIMAL(14,3) COMMENT '③ 太陽光'
  ,`d_shohi` DECIMAL(14,3) COMMENT '④ 諸費用'
  ,`d_tochi` DECIMAL(14,3) COMMENT '⑤ 土地購入費'
  ,`d_yobi` DECIMAL(14,3) COMMENT '⑥ 予備費'
  ,`d_bonus` DECIMAL(14,3) COMMENT 'ボーナス月加算額'
  ,`d_years` DECIMAL(14,3) COMMENT '返済期間'
  ,`d_rate` DECIMAL(14,3) COMMENT '金利（年利）'
  ,`d_danshin` DECIMAL(14,3) COMMENT '団体信用生命保険による死亡保険の見直し'
  ,`d_kounetsuRate` DECIMAL(14,3) COMMENT '国分ハウジングの光熱費'

  -- ④ 諸費用・借入条件
  ,`s_kenchikuchi` VARCHAR(191) COMMENT '建築地'
  ,`s_landM2` DECIMAL(14,3) COMMENT '土地面積（㎡）'
  ,`s_f1` DECIMAL(14,3) COMMENT '延床面積 1F（㎡）'
  ,`s_f2` DECIMAL(14,3) COMMENT '延床面積 2F（㎡）'
  ,`s_sekou` DECIMAL(14,3) COMMENT '施工面積 合計（㎡）'
  ,`s_m_kari` DECIMAL(14,3)
  ,`s_m_bonus` DECIMAL(14,3)
  ,`s_m_years` DECIMAL(14,3)
  ,`s_m_rate` DECIMAL(14,3)
  ,`s_m_bank` VARCHAR(191)
  ,`s_p_kari` DECIMAL(14,3)
  ,`s_p_bonus` DECIMAL(14,3)
  ,`s_p_years` DECIMAL(14,3)
  ,`s_p_rate` DECIMAL(14,3)
  ,`s_p_bank` VARCHAR(191)
  ,`s_bikou` TEXT COMMENT '⑧ 備考'

  -- ⑤ 住宅ローン控除
  ,`g_type` VARCHAR(64) COMMENT '住宅の性能区分 / 選択肢: 認定長期優良住宅・低炭素住宅|ZEH水準省エネ住宅|省エネ基準適合住宅|その他の住宅（省エネ基準未適合）'
  ,`g_setai` VARCHAR(64) COMMENT '世帯区分 / 選択肢: 子育て世帯・若者夫婦世帯|一般世帯'
  ,`g_mode` VARCHAR(64) COMMENT '算定方法 / 選択肢: 年収から自動概算|手入力'
  ,`g_income` DECIMAL(14,3) COMMENT '控除対象の年収（世帯主）'
  ,`g_fuyou` DECIMAL(14,3) COMMENT '扶養親族の人数'
  ,`g_shotoku` DECIMAL(14,3) COMMENT '所得税額（年額）'
  ,`g_juumin` DECIMAL(14,3) COMMENT '住民税所得割額（年額）'

  -- ⑥ 太陽光・蓄電池
  ,`v_panelW` DECIMAL(14,3) COMMENT 'モジュール出力'
  ,`v_houi` VARCHAR(64) COMMENT '設置条件（方位） / 選択肢: 南|南東|南西|東|西'
  ,`v_koubai` DECIMAL(14,3) COMMENT '屋根勾配'
  ,`v_keisu` DECIMAL(14,3) COMMENT '年間発電量係数'
  ,`v_baiden` DECIMAL(14,3) COMMENT '売電単価（FIT）'
  ,`v_kaiden` DECIMAL(14,3) COMMENT '買電単価（電気料金＋基本料金）'
  ,`v_jika` DECIMAL(14,3) COMMENT '自家消費率'
  ,`v_tax` VARCHAR(64) COMMENT '売電に消費税を上乗せする / 選択肢: 上乗せする（×1.1）|上乗せしない'
  ,`v_cost` DECIMAL(14,3) COMMENT 'ソーラーパネル費用（税込）'
  ,`v_years` DECIMAL(14,3) COMMENT '住宅ローンに組込む年数'
  ,`v_batUse` VARCHAR(64) COMMENT '導入する / 選択肢: 導入する|導入しない'
  ,`v_batKwh` DECIMAL(14,3) COMMENT '蓄電池容量'
  ,`v_batCost` DECIMAL(14,3) COMMENT '導入費用（税込）'
  ,`v_batHojo` DECIMAL(14,3) COMMENT '補助金'
  ,`v_batEff` DECIMAL(14,3) COMMENT '実効利用率'
  ,`v_batNight` DECIMAL(14,3) COMMENT '夜間電力単価'

  -- ⑦ 今建てる場合と待つ場合の比較
  ,`t_wait` DECIMAL(14,3) COMMENT '何年後と比較しますか'
  ,`t_upRate` DECIMAL(14,3) COMMENT '建築費の上昇率（想定）'
  ,`t_futureRate` DECIMAL(14,3) COMMENT '◯年後の想定金利'
  ,`t_yRate` DECIMAL(14,3) COMMENT '金利'
  ,`t_y1` DECIMAL(14,3) COMMENT '短い方の期間'
  ,`t_y2` DECIMAL(14,3) COMMENT '長い方の期間'
  ,`t_kidAge` DECIMAL(14,3) COMMENT 'お子様の現在のご年齢'
  ,`t_addPay` DECIMAL(14,3) COMMENT '成人後に増額するお支払い'

  -- ⑧ FPシミュレーションの前提
  ,`f_up` DECIMAL(14,3) COMMENT '昇給率'
  ,`f_tedori` DECIMAL(14,3) COMMENT '手取り率'
  ,`f_teinen` DECIMAL(14,3) COMMENT '定年年齢'
  ,`f_saikoyo` DECIMAL(14,3) COMMENT '再雇用（65歳まで）の年収'
  ,`f_taishoku` DECIMAL(14,3) COMMENT '退職金'
  ,`f_nenkin` DECIMAL(14,3) COMMENT '65歳以降の年金（世帯計）'
  ,`f_seikatsu` DECIMAL(14,3) COMMENT '基本生活費'
  ,`f_kotei` DECIMAL(14,3) COMMENT '固定資産税'
  ,`f_shuzen` DECIMAL(14,3) COMMENT '火災保険・修繕積立'
  ,`f_hoken` DECIMAL(14,3) COMMENT '生命保険等'
  ,`f_carCycle` DECIMAL(14,3) COMMENT '自動車 買替周期'
  ,`f_carCost` DECIMAL(14,3) COMMENT '自動車 買替金額'
  ,`f_other` DECIMAL(14,3) COMMENT 'その他のご支出'

  -- ⑧ 家計の内訳
  ,`x_auto` TINYINT(1) NOT NULL DEFAULT 0
  ,`x_shokuhi` DECIMAL(14,3)
  ,`x_suido` DECIMAL(14,3)
  ,`x_water` DECIMAL(14,3)
  ,`x_tel` DECIMAL(14,3)
  ,`x_net` DECIMAL(14,3)
  ,`x_iryo` DECIMAL(14,3)
  ,`x_leisure` DECIMAL(14,3)
  ,`x_shinbun` DECIMAL(14,3)
  ,`x_ifuku` DECIMAL(14,3)
  ,`x_nhk` DECIMAL(14,3)
  ,`x_e1n` VARCHAR(191)
  ,`x_e1` DECIMAL(14,3)
  ,`x_e2n` VARCHAR(191)
  ,`x_e2` DECIMAL(14,3)
  ,`x_e3n` VARCHAR(191)
  ,`x_e3` DECIMAL(14,3)
  ,`x_choSou` DECIMAL(14,3)
  ,`x_choTsuki` DECIMAL(14,3)
  ,`x_choBonus` DECIMAL(14,3)
  ,`x_incH` DECIMAL(14,3)
  ,`x_incW` DECIMAL(14,3)
  ,`x_incE` DECIMAL(14,3)
  ,`x_h1` DECIMAL(14,3)
  ,`x_h2` DECIMAL(14,3)
  ,`x_h3` DECIMAL(14,3)
  ,`x_h4` DECIMAL(14,3)
  ,`x_h5` DECIMAL(14,3)
  ,`x_h6` DECIMAL(14,3)
  ,`x_h7` DECIMAL(14,3)
  ,`x_h8` DECIMAL(14,3)
  ,`x_h9n` VARCHAR(191)
  ,`x_h9` DECIMAL(14,3)
  ,`x_h10n` VARCHAR(191)
  ,`x_h10` DECIMAL(14,3)
  ,`x_w1` DECIMAL(14,3)
  ,`x_w2` DECIMAL(14,3)
  ,`x_w3` DECIMAL(14,3)
  ,`x_w4` DECIMAL(14,3)
  ,`x_w5` DECIMAL(14,3)
  ,`x_w6` DECIMAL(14,3)
  ,`x_w7` DECIMAL(14,3)
  ,`x_w8` DECIMAL(14,3)
  ,`x_w9n` VARCHAR(191)
  ,`x_w9` DECIMAL(14,3)
  ,`x_w10n` VARCHAR(191)
  ,`x_w10` DECIMAL(14,3)
  ,`x_c1` DECIMAL(14,3)
  ,`x_c2n` VARCHAR(191)
  ,`x_c2` DECIMAL(14,3)

  -- ⑨ 段取り
  ,`w_start` DATE COMMENT '起点日（初回ご来店日）'

  -- ⑩ 金利データの基準日・出典
  ,`ln_asof` DATE COMMENT '現在の金利データ 基準日'
  ,`ln_source` VARCHAR(191) COMMENT '出典・メモ'
  ,`ln_feedUrl` VARCHAR(191) COMMENT '金利データ配信URL（任意）'

  -- ⑩ 事前審査
  ,`bk_kari` DECIMAL(14,3) COMMENT 'お借入金額'
  ,`bk_years` DECIMAL(14,3) COMMENT '返済期間'
  ,`bk_incFee` VARCHAR(64) COMMENT '諸費用を比較に含める / 選択肢: 含める（事務手数料＋保証料）|金利のみで比較'
  ,`bk_memo` TEXT COMMENT 'ご提案する金融機関と理由'
  ,`bk_apply1` VARCHAR(191) COMMENT '事前審査の提出先①'
  ,`bk_apply2` VARCHAR(191) COMMENT '事前審査の提出先②'
  ,`bk_apply3` VARCHAR(191) COMMENT '事前審査の提出先③'

  -- 配列で持つ項目
  -- ⚠️ JSON 型だが pool.ts の jsonStrings:true により**文字列**で返る。
  --   受け取り側で JSON.parse すること。
  ,`kids` JSON COMMENT 'お子様（name/age/plan の配列）。⑧FPの教育費計算に使う'
  ,`k_trigger` JSON COMMENT 'お家づくりを検討されるきっかけ（チェックボックス。文字列の配列）'
  ,`s1` JSON COMMENT '諸費用の内訳① 土地関連（i:項目 a:金額 t:税 p:支払先 m:根拠 n:備考）'
  ,`s2` JSON COMMENT '諸費用の内訳② 建物関連'
  ,`s3` JSON COMMENT '諸費用の内訳③ 外構・地盤'
  ,`s4` JSON COMMENT '諸費用の内訳④ その他'
  ,`s5` JSON COMMENT '諸費用の内訳⑤ 金融機関'
  ,`loans` JSON COMMENT '金融機関の金利一覧。⚠️ この計画書を作った時点のスナップショット。共通マスタを参照にすると、後から金利が変わって過去の計画書の数字が動いてしまう'
  ,`w_days` JSON COMMENT '⑨段取りの各工程の所要日数（数値の配列）'
  ,`w_done` JSON COMMENT '⑨段取りの各工程の完了フラグ（真偽値の配列）'

  -- 管理用
  ,`updated_by` VARCHAR(64) DEFAULT NULL COMMENT '最後に保存したスタッフ名'
  ,`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP

  ,PRIMARY KEY (`id`)
  ,KEY `idx_funding_plan_shop` (`k_shop`)
  ,KEY `idx_funding_plan_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  ROW_FORMAT=DYNAMIC
  COMMENT='AIデジタル資金計画書。id で master_data と1対1。列名は元HTMLの data-k と同じ';
