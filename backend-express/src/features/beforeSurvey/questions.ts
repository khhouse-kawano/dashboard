/**
 * 事前アンケート（https://khg-marketing.info/survey_<ブランド>/）の質問とブランド（v2.2.207）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **フォーム（backend/forms/survey/index.html）の QUESTIONS と対になっている。**
 *   ⚠️ 質問を足す・変えるときは、両方と DB の列のコメント（backend/scripts/sql/2026-10-22_before_survey.sql）を直すこと。
 * ⚠️ column は before_survey の列名。⚠️ フォームはこの名前のまま送ってくる（列名・値ともに ⚠️ 外からの値として扱う）。
 * ⚠️ 複数選択は半角スペースでつないで保存する（v2.2.206 までの confirm.php の implode(" ") と同じ。反響一覧がそのまま表示する）。
 * ─────────────────────────────────────────────
 */

export type QuestionKind = 'text' | 'textarea' | 'select' | 'check';

export interface SurveyQuestion {
  column: string;
  /** 質問文（通知メールの見出し・列のコメント） */
  label: string;
  kind: QuestionKind;
  required: boolean;
  /** 保存する長さの上限（超えたら切る） */
  max: number;
}

export const QUESTIONS: readonly SurveyQuestion[] = [
  { column: 'name', label: 'お名前(漢字)', kind: 'text', required: true, max: 100 },
  { column: 'considerationStart', label: '新しいお住まいについて、いつ頃からご検討を始められたか教えてください。', kind: 'select', required: true, max: 100 },
  { column: 'desiredMoveIn', label: 'ご入居希望時期を教えてください。', kind: 'select', required: true, max: 100 },
  { column: 'visitedCompanies', label: '今まで何社の住宅会社様へご訪問されたか教えてください。', kind: 'select', required: true, max: 100 },
  { column: 'reasonForConsidering', label: '新しいお住まいをご検討される理由を教えてください。(複数選択可)', kind: 'check', required: true, max: 500 },
  { column: 'reasonOther', label: '（ご検討の理由で「その他」を選択された方）内容をご記入ください。', kind: 'textarea', required: false, max: 1000 },
  { column: 'futurePlan', label: '今後の行動予定について教えてください。', kind: 'select', required: true, max: 200 },
  { column: 'futureOther', label: '（今後の行動予定で「その他」を選択された方）内容をご記入ください。', kind: 'text', required: false, max: 500 },
  { column: 'desiredSize', label: 'お家の広さはどのくらいをご希望か教えてください。', kind: 'text', required: true, max: 200 },
  { column: 'desiredLayout', label: 'ご希望の間取りを教えてください。', kind: 'text', required: false, max: 200 },
  { column: 'priorityItem', label: '重視している項目を教えてください。', kind: 'select', required: true, max: 100 },
  { column: 'expectedResidents', label: 'ご入居予定の人数を教えてください。', kind: 'select', required: true, max: 100 },
  { column: 'totalBudget', label: 'おうちづくりの総予算を教えてください。', kind: 'select', required: true, max: 100 },
  { column: 'monthlyRepayment', label: 'ご希望の月々の返済額を教えてください。', kind: 'select', required: true, max: 100 },
  { column: 'annualIncome', label: '前年度の年収を教えてください。', kind: 'select', required: true, max: 100 },
  { column: 'yearsOfService', label: '勤続年数を教えてください。', kind: 'select', required: true, max: 100 },
  { column: 'otherIncomePerson', label: 'その他、ご年収がある方がいらっしゃるか教えてください。(複数選択可)', kind: 'check', required: true, max: 200 },
  { column: 'otherAnnualIncome', label: 'ご年収がある方のご年収を教えてください。', kind: 'text', required: false, max: 200 },
  { column: 'ownFunds', label: '自己資金でのお支払いのご予定があるか教えてください。', kind: 'select', required: true, max: 100 },
  { column: 'otherLoans', label: 'その他ローンがございましたら教えてください。(複数選択可)', kind: 'check', required: true, max: 200 },
  { column: 'thingsToDo', label: 'ご来場日は何をご希望ですか？(複数選択可)', kind: 'check', required: true, max: 500 },
  { column: 'thingsToDoOther', label: '（ご来場日のご希望で「その他」を選択された方）内容をご記入ください。', kind: 'text', required: false, max: 500 },
  { column: 'housingType', label: 'どのような新しいお住いをご希望ですか？(複数選択可)', kind: 'check', required: true, max: 500 },
  { column: 'housingTypeOther', label: '（お住まいのご希望で「その他」を選択された方）内容をご記入ください。', kind: 'text', required: false, max: 500 },
  { column: 'landArea', label: 'ご希望の土地のエリアを教えてください。', kind: 'text', required: true, max: 200 },
  { column: 'referrerName', label: 'ご紹介者さま(公式アンバサダー含む)がいる場合はご紹介者さまの氏名をご記入ください。', kind: 'text', required: false, max: 100 },
  { column: 'emailAddress', label: 'メールアドレス', kind: 'text', required: true, max: 255 },
];

export interface SurveyBrand {
  /** before_survey.brand に入れる値。⚠️ 反響一覧が反響の brand と突き合わせる（ListOrder.tsx の surveyOf）。変えないこと */
  code: string;
  /** 通知メールの件名の【】の中・差出人の表示名 */
  short: string;
  name: string;
  /** ⚠️ 通知先。v2.2.206 までの survey_<ブランド>/thanks.php の $to と同じ */
  notify: string[];
}

/**
 * フォームが送ってくるブランドのキー（survey_<キー> のディレクトリ名）→ ブランド。⚠️ ここに無いキーは受け付けない。
 */
export const BRANDS: Record<string, SurveyBrand> = {
  kh: { code: 'KH', short: 'KH', name: '国分ハウジング', notify: ['mkt@kh-house.jp', 'kh@kh-group.jp', 'lead@kh-group.jp', 'kh-t@kh-house.jp'] },
  djh: { code: 'DJH', short: 'DJH', name: 'デイジャストハウス', notify: ['mkt@kh-house.jp', 'info-djh@royalhome.co.jp', 'djh@kh-group.jp'] },
  nagomi: { code: 'なごみ', short: 'なごみ', name: 'なごみ工務店', notify: ['mkt@kh-house.jp', 'nagomi@kh-group.jp', 'nagomi@kh-group.jp.test-google-a.com', 'lead@kh-group.jp.test-google-a.com'] },
  fh: { code: 'FH', short: 'FH', name: 'フルコミホーム', notify: ['mkt@kh-house.jp', 'furukomihome@kh-group.jp', 'furukomihome@kh-group.jp.test-google-a.com', 'lead@kh-group.jp.test-google-a.com'] },
  pg: { code: 'PGH', short: 'PG', name: 'PGハウス', notify: ['mkt@kh-house.jp', 'pghouse@kh-house.jp', 'koukoku@pure-growth.net', 'pghouse@pure-growth.net', 'pgh@kh-group.jp'] },
  jh: { code: 'JH', short: 'JH', name: 'JUSFY HOME', notify: ['mkt@kh-house.jp', 'jh@kh-group.jp'] },
  '2l': { code: '2L', short: '2L', name: 'ニーエルホーム', notify: ['mkt@kh-house.jp', '2lhome@kh-group.jp', '2lhome@kh-group.jp.test-google-a.com', 'lead@kh-group.jp.test-google-a.com'] },
};
