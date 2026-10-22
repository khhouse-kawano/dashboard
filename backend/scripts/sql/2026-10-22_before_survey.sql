-- =====================================================================
-- 事前アンケート（before_survey）：文字コード・列のコメント・選択肢の値の修正（v2.2.207）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。何度流しても安全。
-- ⚠️ v2.2.207 から回答は ② の before_survey_entry が直接入れる（GAS の Pre_survey は止める）。
-- ⚠️ 列のコメントは ② の features/beforeSurvey/questions.ts の質問文と同じ。
-- ⚠️ 1. 表を utf8mb4 に（絵文字が入っても保存できるように）。列の型・NOT NULL は変えない
-- ⚠️ 2. 「1年以上前から」の選択肢の値が `1年以上前から3` になっていた分を直す（フォームの value の誤り。表示は「1年以上前から」）
-- =====================================================================

ALTER TABLE before_survey
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  COMMENT = '事前アンケートの回答（khg-marketing.info/survey_<ブランド>/。v2.2.207 から ② の before_survey_entry が入れる）',
  MODIFY `sync` int(11) NOT NULL DEFAULT 0 COMMENT '0 = 未同期・1 = 同期済み（sync の inquiry_update:before_survey が 1 にする）',
  MODIFY `brand` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ブランド（KH / DJH / なごみ / FH / PGH / JH / 2L）。反響の brand と突き合わせる',
  MODIFY `dateStr` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '回答日（yyyy/MM/dd・日本時間）',
  MODIFY `name` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'お名前(漢字)',
  MODIFY `considerationStart` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '新しいお住まいについて、いつ頃からご検討を始められたか教えてください。',
  MODIFY `desiredMoveIn` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ご入居希望時期を教えてください。',
  MODIFY `visitedCompanies` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '今まで何社の住宅会社様へご訪問されたか教えてください。',
  MODIFY `reasonForConsidering` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '新しいお住まいをご検討される理由を教えてください。(複数選択可)',
  MODIFY `reasonOther` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '（ご検討の理由で「その他」を選択された方）内容をご記入ください。',
  MODIFY `futurePlan` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '今後の行動予定について教えてください。',
  MODIFY `futureOther` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '（今後の行動予定で「その他」を選択された方）内容をご記入ください。',
  MODIFY `desiredSize` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'お家の広さはどのくらいをご希望か教えてください。',
  MODIFY `desiredLayout` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ご希望の間取りを教えてください。',
  MODIFY `priorityItem` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '重視している項目を教えてください。',
  MODIFY `expectedResidents` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ご入居予定の人数を教えてください。',
  MODIFY `totalBudget` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'おうちづくりの総予算を教えてください。',
  MODIFY `monthlyRepayment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ご希望の月々の返済額を教えてください。',
  MODIFY `annualIncome` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '前年度の年収を教えてください。',
  MODIFY `yearsOfService` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '勤続年数を教えてください。',
  MODIFY `otherIncomePerson` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'その他、ご年収がある方がいらっしゃるか教えてください。(複数選択可)',
  MODIFY `otherAnnualIncome` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ご年収がある方のご年収を教えてください。',
  MODIFY `ownFunds` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '自己資金でのお支払いのご予定があるか教えてください。',
  MODIFY `otherLoans` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'その他ローンがございましたら教えてください。(複数選択可)',
  MODIFY `thingsToDo` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ご来場日は何をご希望ですか？(複数選択可)',
  MODIFY `thingsToDoOther` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '（ご来場日のご希望で「その他」を選択された方）内容をご記入ください。',
  MODIFY `housingType` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'どのような新しいお住いをご希望ですか？(複数選択可)',
  MODIFY `housingTypeOther` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '（お住まいのご希望で「その他」を選択された方）内容をご記入ください。',
  MODIFY `landArea` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ご希望の土地のエリアを教えてください。',
  MODIFY `referrerName` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'ご紹介者さま(公式アンバサダー含む)がいる場合はご紹介者さまの氏名をご記入ください。',
  MODIFY `emailAddress` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT 'メールアドレス'
;

UPDATE before_survey SET considerationStart = '1年以上前から' WHERE considerationStart = '1年以上前から3';

-- 確認（⚠️ ① では information_schema を使わない）
SHOW FULL COLUMNS FROM before_survey;
SELECT considerationStart, COUNT(*) AS n FROM before_survey GROUP BY considerationStart;
