# 2026-10-22 v2.2.207 事前アンケートの作り直し（7ブランド・1ファイル・回答を ② が直接登録）

## 指示（ReadMeClaude.md）
- khg-marketing.info/survey_kh・djh・jh・pg・2l のアンケートの UI を form_get に合わせる。回答項目は同じ
- 1ファイル構成：「入力内容の確認」→ 確認のモーダル →「入力内容で登録」→ ② へ
- ② に API。サンクスメールなし・通知メールあり。登録先は before_survey。列のコメントを質問に合わせる

## 決めたこと（2026-10-22 に確認）
- 対象は7ブランド（指示書の5つ ＋ survey_nagomi・survey_fh。どちらも同じアンケートが公開されていた）
- 選択肢の値の誤り「1年以上前から3」を直し、既存の298件も直す。総予算に「3500万円～4000万円」を足す
- 通知先は今と同じ（Downloads/survey の thanks.php の $to。jh・2l は後から受け取った写しで確認し、2l の宛先を2つ足した）
- before_survey を utf8mb4 に

## 調べたこと
- 5つ（7つ）の index.html の違いはタイトル・ロゴ・「〇〇が初めて」の選択肢だけ → 同じファイルにして、置いたディレクトリ名でブランドを決める
- 旧の流れ：index.html → confirm.php → thanks.php が mail() → Gmail のラベル「事前アンケート」→ GAS Pre_survey が本文を読む → khg-marketing.info/api/（Authorization: 4081Kokubu_beforeSurvey）→ before_survey
- 反響一覧（ListOrder.tsx など）は「ブランド＋メールアドレス」で before_survey を引く → brand の値（KH・DJH・なごみ・FH・PGH・JH・2L）と dateStr（yyyy/MM/dd）は同じにした
- 複数選択は半角スペースでつないで保存されていた（confirm.php の implode(" ")）→ 同じにした
- GAS は「その他」の3つの欄が同じ見出しのため、1つ目の答えを3列すべてに入れていた（440件）→ 新しい受け口は列ごとに保存
- 本番の ② は Origin: https://khg-marketing.info を許可済み（OPTIONS で確認）。.env.prod の変更不要

## 追加・変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/beforeSurvey | questions.ts（新規） | QUESTIONS（27問：列名・質問文・種類・必須・長さ）・BRANDS（7ブランドの brand の値・通知先） |
| backend-express/src/features/beforeSurvey | entry.ts（新規） | runBeforeSurveyEntry（検証・保存・通知メール）、noticeText、cleanLine・cleanMultiline・cleanChecks・todayJst・nowJst |
| backend-express/src/gateway | registry.ts | before_survey_entry の登録（auth: none） |
| backend-express/src/middlewares | publicFormRateLimit.ts | GUARDED_REQUESTS に before_survey_entry |
| backend/forms/survey | index.html（新規） | 7ブランド共通のアンケートの画面（1ファイル） |
| backend/scripts/sql | 2026-10-22_before_survey.sql（新規） | utf8mb4・列のコメント・1年以上前から3 の修正 |
| backend/scripts/sql | 2026-10-22_update_log_2.2.207.sql（新規） | update_log（ローカル no=308） |
| frontend/src/utils | version.ts | 2.2.207 |
| docs | deploy-v2.2.207.md（新規） | デプロイ手順 |

## テスト
### ② の受け口（ローカル ② に直接。⚠️ ブラウザも ② へ直接送るので、これが本番と同じ経路。① の PHP は通らない）
| 送ったもの | 結果 |
|---|---|
| 正常（kh・複数選択・改行・絵文字） | 200 ok。before_survey に KH・2026/10/22・複数選択は半角スペース・改行あり・絵文字そのまま |
| ブランド xx・__proto__ | 400 アンケートの種類が分かりません |
| 必須の未回答（総予算）・複数選択が空 | 400 未回答の必須項目があります（質問名） |
| メールの形式が違う | 400 |
| sync: 1・余計な列名を付けて pg で送る | 200。sync は 0・brand は PGH・余計な列は無視 |
| 6件目以降 | 429 送信が続けて行われました（10分で5件の上限） |
- 通知メールの本文は ts-node で組み立てて確認（件名・「■ 質問」「回答」・未回答は（未回答））。⚠️ ローカルは SMTP 未設定なので実際には送っていない
### 画面（Playwright。⚠️ ページは http://localhost:3000/survey_kh/ などに見立てて配信）
- kh（スマホ幅）：タイトル・差し色・ロゴ・「国分ハウジングが初めて」・「1年以上前から」の値・3500万円～4000万円がある
- 未入力で確認 → 20か所にエラー・最初の欄にカーソル・モーダルは開かない
- 「その他」を選んだときだけ記入欄が出る
- ⚠️ 見つけた不具合：エラーの出た文字欄を直したあと下の選択肢を押すと、欄を離れた瞬間にエラー文が消えて画面がずれ、押した選択が効かなかった → 文字欄は入力中にエラーを消すようにした（revalidate を input でも呼ぶ）。直したあと、待たずに押しても選択が効くことを確認
- ⚠️ 見つけた不具合：確認・完了のモーダルが .pf の外にあり、色・線・余白の変数が届いていなかった → 変数を :root に移した
- 確認のモーダル：24行（その他の欄は選んだものだけ）・段階が2・「修正する」で閉じて入力が残る
- 登録 → 完了（段階3・「ホームへ戻る」は https://kh-house.jp/）。before_survey に1行
- pg（PC幅）：PGハウスの色とロゴ・横にはみ出さない。「ホームへ戻る」は出さない（旧の thanks.php にも無い）
- /survey_xx/：「このページのアドレスが正しくありません」
- 失敗時：429 の文言・通信失敗の文言がモーダルに出て、ボタンが押せる状態に戻る
- テストで入れた行はすべて削除済み（before_survey は 3013 行のまま）
### 型チェック
- backend-express: tsc --noEmit 問題なし
- frontend: build 問題なし（main.c615b8f1.js）

## リファクタリング
- entry.ts の noticeText を export しない形に戻した（確認のためだけに export していた）。型チェックと受け口・画面のテストを再実行して通った

## 業務ガイドの記事
- 事前アンケートの記事は無く、ダッシュボードの画面の変更も無いため、記事の変更なし

## 要確認
- デプロイと同時に GAS の Pre_survey を止める（docs/deploy-v2.2.207.md の手順4）

## コード（全文）

### backend-express/src/features/beforeSurvey/questions.ts
```ts
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
```

### backend-express/src/features/beforeSurvey/entry.ts
```ts
import { execute } from '../../db/pool';
import { logger } from '../../utils/logger';
import { sanitizeHeader, sendMail } from '../../utils/mailer';
import { BRANDS, QUESTIONS } from './questions';
import type { SurveyBrand } from './questions';

/**
 * 事前アンケートの受付（v2.2.207。`before_survey_entry`。⚠️ 公開・認証なし）。
 *
 * ─────────────────────────────────────────────
 * 送信元: https://khg-marketing.info/survey_<ブランド>/（backend/forms/survey/index.html）
 * ⚠️ v2.2.206 までは confirm.php → thanks.php がメールを送り、GAS（Pre_survey）がそのメールを読んで before_survey に入れていた。
 *   ⚠️⚠️ **このデプロイと同時に GAS の Pre_survey を止める**（止めないと通知メールを読んで二重に入る）。
 * ⚠️ 社外の誰でも叩ける書き込み口。⚠️ リクエストの値を信用しない（features/ambassador/inquiry.ts と同じ考え方）。
 *   ⚠️ 列名はすべて questions.ts の定数。⚠️ 長さで切る・制御文字を落とす。⚠️ ブランドは BRANDS のキーだけ。
 *   ⚠️ 流量の上限は middlewares/publicFormRateLimit.ts。
 * ⚠️ 選択肢の値は検証しない（選択肢を変えたときにフォームと食い違っても回答を捨てないため）。必須の未入力だけ弾く。
 * ⚠️ お客様へのサンクスメールは送らない（指示書）。⚠️ 通知メールの失敗では 500 にしない（保存は済んでいる。再送で二重になる）。
 * ─────────────────────────────────────────────
 */

/** 制御文字（改行を含む） */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
/** 制御文字（改行は残す） */
const CONTROL_CHARS_KEEP_NEWLINE = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g;

const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const cleanLine = (value: unknown, max: number): string =>
  asText(value).replace(CONTROL_CHARS, '').trim().slice(0, max);

const cleanMultiline = (value: unknown, max: number): string =>
  asText(value)
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_CHARS_KEEP_NEWLINE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);

/** 複数選択。⚠️ 配列でも文字列でも受ける。半角スペースでつなぐ */
const cleanChecks = (value: unknown, max: number): string => {
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => cleanLine(item, 200).replace(/\s+/g, ' '))
    .filter((item) => item !== '')
    .join(' ')
    .slice(0, max);
};

/** 今日（日本時間）を yyyy/MM/dd。⚠️ dateStr は GAS の Utilities.formatDate(date, 'JST', 'yyyy/MM/dd') と同じ形（反響一覧が月で絞る） */
const todayJst = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts.replace(/-/g, '/');
};

const nowJst = (): string =>
  new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date());

export interface BeforeSurveyResult {
  httpStatus: number;
  body: unknown;
}

const failure = (httpStatus: number, message: string): BeforeSurveyResult => ({ httpStatus, body: { status: 'error', message } });

/** 通知メールの本文（v2.2.206 までの thanks.php のメールと同じ件名・項目の並び） */
const noticeText = (brand: SurveyBrand, answers: Record<string, string>): string =>
  [
    `【${brand.short}共通】事前アンケートへの回答がありました。`,
    '',
    `回答日時：${nowJst()}`,
    '====================',
    ...QUESTIONS.flatMap((q) => [`■ ${q.label}`, answers[q.column] === '' ? '（未回答）' : answers[q.column], '']),
    '====================',
    '※自動送信メールです。',
  ].join('\n');

export const runBeforeSurveyEntry = async (body: Record<string, unknown>): Promise<BeforeSurveyResult> => {
  const brandKey = cleanLine(body.brand, 20).toLowerCase();
  const brand = Object.prototype.hasOwnProperty.call(BRANDS, brandKey) ? BRANDS[brandKey] : undefined;
  if (brand === undefined) return failure(400, 'アンケートの種類が分かりません。ページを開き直してください。');

  const answers: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const raw = body[q.column];
    answers[q.column] =
      q.kind === 'check' ? cleanChecks(raw, q.max) : q.kind === 'textarea' ? cleanMultiline(raw, q.max) : cleanLine(raw, q.max);
  }
  const missing = QUESTIONS.filter((q) => q.required && answers[q.column] === '');
  if (missing.length > 0) return failure(400, `未回答の必須項目があります（${missing[0].label}）。`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.emailAddress)) return failure(400, 'メールアドレスの形式が正しくありません。');

  // ⚠️ 列名は questions.ts の定数だけ。⚠️ sync は 0 固定（リクエストから受け取らない）
  const row: Record<string, string | number> = { sync: 0, brand: brand.code, dateStr: todayJst(), ...answers };
  const columns = Object.keys(row);
  let id = 0;
  try {
    const result = await execute(
      `INSERT INTO before_survey (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      Object.values(row)
    );
    id = result.insertId;
  } catch (error) {
    // ⚠️ 失われた回答を復元できるのはこのログだけ
    logger.error(`before_survey_entry: 保存に失敗 brand=${brand.code} name="${answers.name}" mail="${answers.emailAddress}": ${(error as Error).message}`);
    return failure(500, '送信に失敗しました。お手数ですが時間をおいて再度お試しください。');
  }
  logger.info(`before_survey_entry: 受け付けました id=${id} brand=${brand.code}`);

  const sent = await sendMail({
    to: brand.notify,
    subject: sanitizeHeader(`【${brand.short}共通】事前アンケートへの回答がありました。`),
    text: noticeText(brand, answers),
    fromName: brand.name,
  });
  if (!sent) logger.error(`before_survey_entry: 通知メールを送れませんでした id=${id} brand=${brand.code}。反響一覧で直接確認してください。`);

  return { httpStatus: 200, body: { status: 'ok' } };
};
```

### backend/scripts/sql/2026-10-22_before_survey.sql
```sql
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
```

### backend/forms/survey/index.html
```html
<!DOCTYPE html>
<!--
  事前アンケート（v2.2.207）。https://khg-marketing.info/survey_<ブランド>/index.html
  ⚠️ 7ブランド（kh・djh・nagomi・fh・pg・jh・2l）とも**この同じファイル**を置く。ブランドは置いたディレクトリ名（survey_kh など）で決まる。
  ⚠️ 回答は ② へ直接送る（POST https://api.khg-marketing.info/api/gateway { request: 'before_survey_entry' }）。① の PHP は通らない。
  ⚠️ 質問は ② の backend-express/src/features/beforeSurvey/questions.ts と対（column がそのまま before_survey の列名）。片方だけ直さないこと。
  ⚠️ 見た目は form_get（src/components/publicForm.css）に合わせている（.pf の変数・部品名も同じ）。
  ⚠️ ローカルの確認では ?brand=kh を付ける（localhost では ② も localhost:3001 へ送る）。
-->
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>事前アンケート</title>
<style>
/* ⚠️ 色の変数は :root に置く（確認・完了のモーダルは .pf の外にあるため）。差し色はスクリプトが :root に入れる */
:root {
    --pf-accent: #0f3675;
    --pf-ink: #1d2433;
    --pf-sub: #5b6476;
    --pf-line: #d5dbe5;
    --pf-surface: #f5f7fa;
    --pf-field: #ffffff;
    --pf-danger: #c62828;
    --pf-danger-bg: #fdecec;
    --pf-radius: 10px;
}
html, body { margin: 0; background: #ffffff; }
body {
    color: var(--pf-ink);
    font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif;
    font-size: 15px;
    line-height: 1.7;
    letter-spacing: .02em;
    -webkit-font-smoothing: antialiased;
}
*, *::before, *::after { box-sizing: border-box; }
.pf { max-width: 640px; margin: 0 auto; padding: 24px 16px 48px; background: #ffffff; }
[hidden] { display: none !important; }

.pf-logo { display: flex; justify-content: center; margin: 8px 0 20px; }
.pf-logo img { max-width: 260px; max-height: 72px; width: auto; height: auto; object-fit: contain; }

.pf-steps { display: flex; justify-content: center; gap: 6px; margin: 0 0 24px; padding: 0; list-style: none; font-size: 12px; color: var(--pf-sub); }
.pf-steps li { display: flex; align-items: center; gap: 6px; }
.pf-steps li + li::before { content: ""; width: 18px; height: 1px; background: var(--pf-line); }
.pf-steps .pf-step-num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--pf-line); background: #ffffff; font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums; }
.pf-steps li[aria-current="step"] { color: var(--pf-ink); font-weight: 700; }
.pf-steps li[aria-current="step"] .pf-step-num { border-color: var(--pf-accent); background: var(--pf-accent); color: #ffffff; }

.pf-title { margin: 0 0 6px; font-size: 20px; font-weight: 700; text-align: center; text-wrap: balance; }
.pf-lead { margin: 0 0 20px; font-size: 14px; color: var(--pf-sub); text-align: center; }

.pf-card { display: flex; flex-direction: column; gap: 22px; padding: 20px; margin: 0 0 16px; border: 1px solid var(--pf-line); border-radius: 14px; background: #ffffff; box-shadow: 0 1px 2px rgba(29, 36, 51, .04); }
.pf-card-title { margin: 0; font-size: 13px; font-weight: 700; color: var(--pf-sub); letter-spacing: .08em; }

.pf-field { display: flex; flex-direction: column; gap: 8px; min-width: 0; margin: 0; padding: 0; border: 0; }
.pf-label { display: flex; align-items: flex-start; gap: 6px; margin: 0; padding: 0; font-size: 13px; font-weight: 600; line-height: 1.5; color: var(--pf-ink); }
.pf-badge { flex: none; display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 1.6; letter-spacing: .04em; }
.pf-badge-req { background: var(--pf-danger-bg); color: var(--pf-danger); }
.pf-badge-opt { background: var(--pf-surface); color: var(--pf-sub); }
.pf-hint { margin: -2px 0 0; font-size: 12px; color: var(--pf-sub); }

.pf-input, .pf-select, .pf-textarea { width: 100%; min-height: 48px; padding: 10px 14px; border: 1px solid var(--pf-line); border-radius: var(--pf-radius); background: var(--pf-field); color: var(--pf-ink); font: inherit; font-size: 16px; line-height: 1.5; transition: border-color .15s, box-shadow .15s; appearance: none; -webkit-appearance: none; }
.pf-select { padding-right: 40px; background-image: linear-gradient(45deg, transparent 50%, var(--pf-sub) 50%), linear-gradient(135deg, var(--pf-sub) 50%, transparent 50%); background-position: calc(100% - 20px) 50%, calc(100% - 15px) 50%; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; }
.pf-select:invalid { color: #9aa3b2; }
.pf-select option { color: var(--pf-ink); }
.pf-textarea { min-height: 110px; resize: vertical; }
.pf-input:focus, .pf-select:focus, .pf-textarea:focus { outline: none; border-color: var(--pf-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-accent) 22%, transparent); }
.pf-field[data-invalid="1"] .pf-input, .pf-field[data-invalid="1"] .pf-select, .pf-field[data-invalid="1"] .pf-textarea { border-color: var(--pf-danger); }

/* 複数選択（チェックボックス）。押せる面を広くする */
.pf-choices { display: grid; grid-template-columns: 1fr; gap: 8px; }
@media (min-width: 480px) { .pf-choices { grid-template-columns: 1fr 1fr; } }
.pf-choice { position: relative; display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 10px 12px; border: 1px solid var(--pf-line); border-radius: var(--pf-radius); background: var(--pf-field); font-size: 14px; line-height: 1.45; cursor: pointer; transition: border-color .15s, background-color .15s; }
.pf-choice input { flex: none; width: 18px; height: 18px; margin: 0; accent-color: var(--pf-accent); cursor: pointer; }
.pf-choice:has(input:checked) { border-color: var(--pf-accent); background: color-mix(in srgb, var(--pf-accent) 7%, #ffffff); font-weight: 600; }
.pf-choice:has(input:focus-visible) { box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-accent) 22%, transparent); }
.pf-field[data-invalid="1"] .pf-choice { border-color: var(--pf-danger); }

.pf-error { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12px; font-weight: 600; color: var(--pf-danger); }
.pf-error::before { content: "!"; display: inline-flex; align-items: center; justify-content: center; flex: none; width: 16px; height: 16px; border-radius: 50%; background: var(--pf-danger); color: #ffffff; font-size: 11px; font-weight: 700; }

.pf-actions { display: flex; flex-direction: column; align-items: center; gap: 10px; margin: 28px 0 0; }
.pf-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 10px 18px; border-radius: var(--pf-radius); border: 1px solid var(--pf-line); background: #ffffff; color: var(--pf-ink); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; text-decoration: none; transition: filter .15s, background-color .15s; }
.pf-btn:hover { background: var(--pf-surface); }
.pf-btn:focus-visible { outline: 3px solid color-mix(in srgb, var(--pf-accent) 35%, transparent); outline-offset: 2px; }
.pf-btn-primary { width: 100%; max-width: 360px; min-height: 54px; border-color: var(--pf-accent); background: var(--pf-accent); color: #ffffff; font-size: 16px; font-weight: 700; letter-spacing: .06em; }
.pf-btn-primary:hover { background: var(--pf-accent); filter: brightness(.92); }
.pf-btn-primary[aria-busy="true"], .pf-btn-primary:disabled { filter: grayscale(.4) brightness(1.05); cursor: progress; }

.pf-note { margin: 0 0 20px; padding: 14px 16px; border-radius: var(--pf-radius); background: var(--pf-surface); color: var(--pf-sub); font-size: 13px; text-align: justify; }

/* 確認・完了のモーダル */
.pf-modal-backdrop { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(29, 36, 51, .45); }
.pf-modal { display: flex; flex-direction: column; width: 100%; max-width: 600px; max-height: calc(100vh - 32px); max-height: calc(100dvh - 32px); border-radius: 16px; background: #ffffff; box-shadow: 0 12px 32px rgba(29, 36, 51, .25); overflow: hidden; }
.pf-modal-head { padding: 20px 20px 4px; text-align: center; }
.pf-modal-body { flex: 1; overflow: auto; padding: 4px 20px 8px; overscroll-behavior: contain; }
.pf-modal-foot { display: flex; flex-direction: column-reverse; gap: 10px; align-items: center; padding: 14px 20px 20px; border-top: 1px solid var(--pf-line); }
@media (min-width: 480px) { .pf-modal-foot { flex-direction: row; justify-content: center; } .pf-modal-foot .pf-btn-primary { max-width: 300px; } }
.pf-modal-error { margin: 8px 0 0; padding: 10px 12px; border-radius: var(--pf-radius); background: var(--pf-danger-bg); color: var(--pf-danger); font-size: 13px; font-weight: 600; }

.pf-summary { margin: 0; }
.pf-summary-row { display: grid; grid-template-columns: 1fr; gap: 2px; padding: 12px 0; border-bottom: 1px solid var(--pf-line); }
.pf-summary-row:last-child { border-bottom: none; }
.pf-summary dt { font-size: 12px; font-weight: 600; color: var(--pf-sub); }
.pf-summary dd { margin: 0; font-size: 15px; font-weight: 600; color: var(--pf-ink); word-break: break-word; white-space: pre-line; }
.pf-summary dd[data-empty="1"] { color: #9aa3b2; font-weight: 400; }

.pf-done { padding: 28px 20px 8px; text-align: center; }
.pf-done-mark { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; margin: 0 0 14px; border-radius: 50%; background: color-mix(in srgb, var(--pf-accent) 12%, #ffffff); color: var(--pf-accent); }
.pf-done-text { margin: 10px 0 0; font-size: 15px; line-height: 1.9; }

.pf-state { padding: 48px 16px; text-align: center; font-size: 14px; color: var(--pf-sub); line-height: 1.9; }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
</style>
</head>
<body>
<main class="pf" id="pf">
    <div class="pf-logo"><img id="pf-logo" alt="" hidden></div>
    <ol class="pf-steps" aria-label="ご回答の流れ">
        <li data-step="1" aria-current="step"><span class="pf-step-num">1</span>入力</li>
        <li data-step="2"><span class="pf-step-num">2</span>確認</li>
        <li data-step="3"><span class="pf-step-num">3</span>完了</li>
    </ol>
    <h1 class="pf-title">事前アンケート</h1>
    <p class="pf-lead"><span class="pf-badge pf-badge-req">必須</span> の項目は必ずご回答ください。</p>
    <p class="pf-note">お客様に入力して頂いた氏名・住所・電話番号・E-mailアドレス等の個人情報は今後、弊社もしくは関係会社において、弊社が出展または主催する展示会・セミナーのご案内、弊社が提供する商品・サービスに関するご案内など各種情報のご提供、及び弊社営業部門からのご連絡などを目的として利用させて頂きます。弊社は、ご提供いただいた個人情報を、法令に基づく命令などを除いて、あらかじめお客様の同意を得ないで第三者に提供することはありません。</p>
    <form id="pf-form" novalidate></form>
    <div class="pf-state" id="pf-unknown" hidden>このページのアドレスが正しくありません。<br>お手数ですが、ご案内のURLから開き直してください。</div>
</main>

<div class="pf-modal-backdrop" id="pf-modal" hidden>
    <div class="pf-modal" role="dialog" aria-modal="true" aria-labelledby="pf-modal-title">
        <div id="pf-confirm">
            <div class="pf-modal-head">
                <h2 class="pf-title" id="pf-modal-title">入力内容をご確認ください</h2>
                <p class="pf-lead" style="margin: 0;">内容にお間違いがなければ、下のボタンで登録してください。</p>
            </div>
        </div>
        <div class="pf-modal-body" id="pf-modal-body">
            <dl class="pf-summary" id="pf-summary"></dl>
            <p class="pf-modal-error" id="pf-modal-error" role="alert" hidden></p>
        </div>
        <div class="pf-modal-foot" id="pf-modal-foot">
            <button type="button" class="pf-btn" id="pf-back">修正する</button>
            <button type="button" class="pf-btn pf-btn-primary" id="pf-submit">入力内容で登録</button>
        </div>
        <div class="pf-done" id="pf-done" hidden>
            <div class="pf-done-mark" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
            <h2 class="pf-title" id="pf-done-title">送信が完了しました</h2>
            <p class="pf-done-text">ご回答いただきありがとうございました。<br>スタッフ一同ご来場を心よりお待ちしております。</p>
            <div class="pf-actions" style="margin: 20px 0 12px;">
                <a class="pf-btn pf-btn-primary" id="pf-home" hidden>ホームへ戻る</a>
            </div>
        </div>
    </div>
</div>

<script>
(function () {
    'use strict';

    /** ⚠️ ② の features/beforeSurvey/questions.ts の BRANDS とキーをそろえる */
    var BRANDS = {
        kh: { name: '国分ハウジング', logo: 'https://khg-marketing.info/img/kokubu-housing_logo.png', accent: '#0f3675', home: 'https://kh-house.jp/' },
        djh: { name: 'デイジャストハウス', logo: 'https://khg-marketing.info/img/dayjusthouse_logo.png', accent: '#1d8a94', home: 'https://day-just-house.com/' },
        nagomi: { name: 'なごみ工務店', logo: 'https://khg-marketing.info/img/nagomi_logo.png', accent: '#956134', home: 'https://www.nagomi-koumuten.jp/' },
        fh: { name: 'フルコミホーム', logo: 'https://khg-marketing.info/img/furukomi_logo.png', accent: '#cd3c33', home: 'https://furukomi-home.com/' },
        pg: { name: 'PGハウス', logo: 'https://khg-marketing.info/img/pg_logo.webp', accent: '#1a1a1a', home: '' },
        jh: { name: 'JUSFY HOME', logo: 'https://khg-marketing.info/img/jusfyhome_logo.png', accent: '#dc4235', home: 'https://jusfy-home.com/' },
        '2l': { name: 'ニーエルホーム', logo: 'https://khg-marketing.info/img/2L_home_logo.png', accent: '#0b8659', home: 'https://2lhome.net/' }
    };

    var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    var ENDPOINT = local ? 'http://localhost:3001/api/gateway' : 'https://api.khg-marketing.info/api/gateway';

    var dirMatch = /\/survey_([a-z0-9]+)\//i.exec(location.pathname);
    var brandKey = ((dirMatch && dirMatch[1]) || (local ? new URLSearchParams(location.search).get('brand') : '') || '').toLowerCase();
    var brand = Object.prototype.hasOwnProperty.call(BRANDS, brandKey) ? BRANDS[brandKey] : null;

    /** その他の記入欄。show = 表示する条件の選択肢（親の column と値） */
    var OTHER = '「その他」を選択された方は以下に記載をお願いいたします。';

    /**
     * ⚠️ column は before_survey の列名（② の questions.ts と同じ）。⚠️ 選択肢の文字が保存される値になる。
     * ⚠️ v2.2.207：「1年以上前から」の値の誤り（1年以上前から3）を直し、総予算に「3500万円～4000万円」を足した。
     */
    var SECTIONS = function (b) {
        return [
            { title: 'ご検討の状況', items: [
                { column: 'name', label: 'お名前(漢字)', kind: 'text', required: true, hint: 'お手数ですが、再度ご入力をお願いいたします。', autocomplete: 'name' },
                { column: 'considerationStart', label: '新しいお住まいについて、いつ頃からご検討を始められたか教えてください。', kind: 'select', required: true, options: ['検討しはじめたばかり', '3か月前から', '半年前から', '1年前から', '1年以上前から'] },
                { column: 'desiredMoveIn', label: 'ご入居希望時期を教えてください。', kind: 'select', required: true, options: ['今年', '来年', 'それ以降'] },
                { column: 'visitedCompanies', label: '今まで何社の住宅会社様へご訪問されたか教えてください。', kind: 'select', required: true, options: [b.name + 'が初めて', '1社', '2社', '3社', '4社以上'] },
                { column: 'reasonForConsidering', label: '新しいお住まいをご検討される理由を教えてください。(複数選択可)', kind: 'check', required: true, options: ['家賃がもったいない', '今のお住まいが狭い', '今のお住まいが古い', '今のお住まいが通勤・通学に不便', '隣室・外の音が気になる', '親との同居・別居を機に', '老後の安心のため', '結婚を機に', '物価・金利・消費税が上がる前に', 'その他'] },
                { column: 'reasonOther', label: OTHER, kind: 'textarea', required: false, show: ['reasonForConsidering', 'その他'] },
                { column: 'futurePlan', label: '今後の行動予定について教えてください。', kind: 'select', required: true, options: ['家づくりを検討しはじめたばかりなのでいろいろと勉強したい', '住みたいエリアの土地情報が欲しい', 'ローンが不安なので相談したい', '建築プランが欲しい', '資金シミュレーションが欲しい', 'いろいろな住宅を見て回りたい', 'その他'] },
                { column: 'futureOther', label: OTHER, kind: 'text', required: false, show: ['futurePlan', 'その他'] }
            ] },
            { title: 'ご希望のお住まい', items: [
                { column: 'desiredSize', label: 'お家の広さはどのくらいをご希望か教えてください。', kind: 'text', required: true },
                { column: 'desiredLayout', label: 'ご希望の間取りを教えてください。', kind: 'text', required: false },
                { column: 'priorityItem', label: '重視している項目を教えてください。', kind: 'select', required: true, options: ['価格', 'デザイン', '性能', 'アフターサービス'] },
                { column: 'expectedResidents', label: 'ご入居予定の人数を教えてください。', kind: 'select', required: true, options: ['1人', '2人', '3人', '4人', '5人', '6人', '7人以上'] }
            ] },
            { title: '資金計画', items: [
                { column: 'totalBudget', label: 'おうちづくりの総予算を教えてください。', kind: 'select', required: true, options: ['～1000万円', '1000万円～1500万円', '1500万円～2000万円', '2000万円～2500万円', '2500万円～3000万円', '3000万円～3500万円', '3500万円～4000万円', '4000万円～4500万円', '4500万円～5000万円', '5000万円～'] },
                { column: 'monthlyRepayment', label: 'ご希望の月々の返済額を教えてください。', kind: 'select', required: true, options: ['～6万円', '～7万円', '～8万円', '～9万円', '～10万円', '～11万円', '～12万円', '13万円～'] },
                { column: 'annualIncome', label: '前年度の年収を教えてください。', kind: 'select', required: true, options: ['～299万円', '300万円～', '400万円～', '500万円～', '600万円～', '700万円～', '800万円～', '900万円～', '1000万円～', '1200万円～', '1500万円～', '2000万円～'] },
                { column: 'yearsOfService', label: '勤続年数を教えてください。', kind: 'select', required: true, options: ['～1年', '～2年', '～3年', '～4年', '～5年', '～6年', '～7年', '～8年', '～9年', '10年～'] },
                { column: 'otherIncomePerson', label: 'その他、ご年収がある方がいらっしゃるか教えてください。(複数選択可)', kind: 'check', required: true, options: ['配偶者', 'お子様', '父', '母', 'なし'] },
                { column: 'otherAnnualIncome', label: 'ご年収がある方のご年収を教えてください。', kind: 'text', required: false },
                { column: 'ownFunds', label: '自己資金でのお支払いのご予定があるか教えてください。', kind: 'select', required: true, options: ['なし', '100万円以上', '500万円以上', '1000万円以上'] },
                { column: 'otherLoans', label: 'その他ローンがございましたら教えてください。(複数選択可)', kind: 'check', required: true, options: ['車のローン', '教育ローン', 'その他ローン', 'なし'] }
            ] },
            { title: 'ご来場について', items: [
                { column: 'thingsToDo', label: 'ご来場日は何をご希望ですか？(複数選択可)', kind: 'check', required: true, options: ['今後の参考にモデルハウスが見たい', '家づくりの資料が欲しい', '探しているエリアの土地情報が欲しい', 'ローンの組み方やお金に関する相談をしたい', 'その他'] },
                { column: 'thingsToDoOther', label: OTHER, kind: 'text', required: false, show: ['thingsToDo', 'その他'] },
                { column: 'housingType', label: 'どのような新しいお住いをご希望ですか？(複数選択可)', kind: 'check', required: true, options: ['新築住宅(土地から)', '新築住宅(建替え)', '建売住宅', '中古住宅', '新築マンション', '中古マンション', 'その他'] },
                { column: 'housingTypeOther', label: OTHER, kind: 'text', required: false, show: ['housingType', 'その他'] },
                { column: 'landArea', label: 'ご希望の土地のエリアを教えてください。', kind: 'text', required: true, hint: '決まっていない場合は「未定」とご記入ください。' },
                { column: 'referrerName', label: 'ご紹介者さま(公式アンバサダー含む)がいる場合はご紹介者さまの氏名をご記入ください。', kind: 'text', required: false },
                { column: 'emailAddress', label: 'メールアドレス', kind: 'email', required: true, autocomplete: 'email' }
            ] }
        ];
    };

    var form = document.getElementById('pf-form');
    var modal = document.getElementById('pf-modal');
    var submitBtn = document.getElementById('pf-submit');
    var modalError = document.getElementById('pf-modal-error');

    if (brand === null) {
        form.hidden = true;
        document.querySelector('.pf-note').hidden = true;
        document.querySelector('.pf-lead').hidden = true;
        document.getElementById('pf-unknown').hidden = false;
        return;
    }

    document.title = '事前アンケート｜' + brand.name;
    document.documentElement.style.setProperty('--pf-accent', brand.accent);
    var logo = document.getElementById('pf-logo');
    logo.src = brand.logo;
    logo.alt = brand.name;
    logo.hidden = false;

    var sections = SECTIONS(brand);
    var questions = [];
    sections.forEach(function (s) { questions = questions.concat(s.items); });

    var el = function (tag, attrs, text) {
        var node = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
        if (text !== undefined) node.textContent = text;
        return node;
    };

    var labelNode = function (q, tag, forId) {
        var label = el(tag, tag === 'label' ? { 'class': 'pf-label', 'for': forId } : { 'class': 'pf-label' });
        label.appendChild(el('span', { 'class': 'pf-badge ' + (q.required ? 'pf-badge-req' : 'pf-badge-opt') }, q.required ? '必須' : '任意'));
        label.appendChild(el('span', {}, q.label));
        return label;
    };

    // ---- 入力欄を組み立てる ----
    sections.forEach(function (section, si) {
        var card = el('section', { 'class': 'pf-card', 'aria-labelledby': 'pf-sec-' + si });
        card.appendChild(el('h2', { 'class': 'pf-card-title', id: 'pf-sec-' + si }, section.title));
        section.items.forEach(function (q) {
            var id = 'pf-' + q.column;
            var field;
            if (q.kind === 'check') {
                field = el('fieldset', { 'class': 'pf-field', id: id + '-field' });
                field.appendChild(labelNode(q, 'legend'));
                var box = el('div', { 'class': 'pf-choices' });
                q.options.forEach(function (opt, oi) {
                    var choice = el('label', { 'class': 'pf-choice' });
                    var input = el('input', { type: 'checkbox', name: q.column, value: opt, id: id + '-' + oi });
                    choice.appendChild(input);
                    choice.appendChild(el('span', {}, opt));
                    box.appendChild(choice);
                });
                field.appendChild(box);
            } else {
                field = el('div', { 'class': 'pf-field', id: id + '-field' });
                field.appendChild(labelNode(q, 'label', id));
                var control;
                if (q.kind === 'select') {
                    control = el('select', { 'class': 'pf-select', id: id, name: q.column });
                    var ph = el('option', { value: '' }, '選択してください');
                    ph.disabled = true;
                    ph.selected = true;
                    control.appendChild(ph);
                    q.options.forEach(function (opt) { control.appendChild(el('option', { value: opt }, opt)); });
                } else if (q.kind === 'textarea') {
                    control = el('textarea', { 'class': 'pf-textarea', id: id, name: q.column, rows: '4', maxlength: '1000' });
                } else {
                    control = el('input', { 'class': 'pf-input', id: id, name: q.column, type: q.kind === 'email' ? 'email' : 'text', maxlength: '200' });
                    if (q.kind === 'email') control.setAttribute('inputmode', 'email');
                    if (q.autocomplete) control.setAttribute('autocomplete', q.autocomplete);
                }
                if (q.required) control.required = true;
                field.appendChild(control);
                if (q.hint) field.appendChild(el('p', { 'class': 'pf-hint' }, q.hint));
            }
            field.appendChild(el('p', { 'class': 'pf-error', id: id + '-error', role: 'alert', hidden: '' }));
            card.appendChild(field);
        });
        form.appendChild(card);
    });
    var actions = el('div', { 'class': 'pf-actions' });
    actions.appendChild(el('button', { type: 'submit', 'class': 'pf-btn pf-btn-primary' }, '入力内容の確認'));
    form.appendChild(actions);

    // ---- 値の読み取り ----
    var valueOf = function (q) {
        if (q.kind === 'check') {
            return Array.prototype.slice.call(form.querySelectorAll('input[name="' + q.column + '"]:checked')).map(function (i) { return i.value; });
        }
        var node = document.getElementById('pf-' + q.column);
        return node.value.trim();
    };
    var isShown = function (q) {
        if (!q.show) return true;
        var parent = questions.filter(function (p) { return p.column === q.show[0]; })[0];
        var v = valueOf(parent);
        return Array.isArray(v) ? v.indexOf(q.show[1]) >= 0 : v === q.show[1];
    };

    // 「その他」の記入欄は、その他を選んだときだけ出す
    var syncOthers = function () {
        questions.forEach(function (q) {
            if (q.show) document.getElementById('pf-' + q.column + '-field').hidden = !isShown(q);
        });
    };
    /**
     * エラーを出した欄は、直した時点で消す。
     * ⚠️ 文字の欄は input（入力中）で消すこと。change（欄を離れたとき）で消すと、下の選択肢を押した瞬間に
     *   エラー文の分だけ画面がずれ、押した指がずれて選択が効かない（v2.2.207 の確認で見つけた）。
     */
    var revalidate = function (e) {
        var field = e.target.closest('.pf-field');
        if (field && field.getAttribute('data-invalid') === '1') validateOne(questions.filter(function (q) { return 'pf-' + q.column + '-field' === field.id; })[0]);
    };
    form.addEventListener('input', revalidate);
    form.addEventListener('change', function (e) {
        syncOthers();
        revalidate(e);
    });
    syncOthers();

    // ---- 検証 ----
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var messageOf = function (q) {
        var v = valueOf(q);
        if (q.required && (Array.isArray(v) ? v.length === 0 : v === '')) {
            return q.kind === 'check' ? '1つ以上選択してください。' : q.kind === 'select' ? '選択してください。' : '入力してください。';
        }
        if (q.kind === 'email' && v !== '' && !EMAIL.test(v)) return 'メールアドレスの形式が正しくありません。';
        return '';
    };
    var validateOne = function (q) {
        if (!q) return true;
        var msg = messageOf(q);
        var field = document.getElementById('pf-' + q.column + '-field');
        var err = document.getElementById('pf-' + q.column + '-error');
        field.setAttribute('data-invalid', msg ? '1' : '0');
        err.textContent = msg;
        err.hidden = !msg;
        return !msg;
    };

    // ---- 段階の表示 ----
    var setStep = function (n) {
        document.querySelectorAll('.pf-steps li').forEach(function (li) {
            if (li.getAttribute('data-step') === String(n)) li.setAttribute('aria-current', 'step');
            else li.removeAttribute('aria-current');
        });
    };

    // ---- 確認のモーダル ----
    var answers = null;
    var openConfirm = function () {
        answers = {};
        var summary = document.getElementById('pf-summary');
        summary.textContent = '';
        questions.forEach(function (q) {
            var shown = isShown(q);
            var v = shown ? valueOf(q) : (q.kind === 'check' ? [] : '');
            answers[q.column] = v;
            if (!shown) return;
            var text = Array.isArray(v) ? v.join('、') : v;
            var row = el('div', { 'class': 'pf-summary-row' });
            row.appendChild(el('dt', {}, q.show ? '（「その他」の内容）' : q.label));
            var dd = el('dd', {}, text === '' ? '未回答' : text);
            if (text === '') dd.setAttribute('data-empty', '1');
            row.appendChild(dd);
            summary.appendChild(row);
        });
        modalError.hidden = true;
        document.getElementById('pf-modal-body').scrollTop = 0;
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        setStep(2);
        submitBtn.focus();
    };
    var closeConfirm = function () {
        modal.hidden = true;
        document.body.style.overflow = '';
        setStep(1);
    };

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var firstInvalid = null;
        questions.forEach(function (q) {
            if (!isShown(q)) return;
            if (!validateOne(q) && firstInvalid === null) firstInvalid = q;
        });
        if (firstInvalid !== null) {
            var field = document.getElementById('pf-' + firstInvalid.column + '-field');
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
            var focusable = field.querySelector('input, select, textarea');
            if (focusable) focusable.focus({ preventScroll: true });
            return;
        }
        openConfirm();
    });

    document.getElementById('pf-back').addEventListener('click', closeConfirm);
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !modal.hidden && submitBtn.getAttribute('aria-busy') !== 'true' && document.getElementById('pf-done').hidden) closeConfirm();
    });

    // ---- 登録 ----
    var sending = false;
    submitBtn.addEventListener('click', function () {
        if (sending || answers === null) return;
        sending = true;
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-busy', 'true');
        submitBtn.textContent = '送信中...';
        modalError.hidden = true;

        var payload = { request: 'before_survey_entry', brand: brandKey };
        Object.keys(answers).forEach(function (k) { payload[k] = answers[k]; });

        fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(function (res) {
                return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; });
            })
            .then(function (r) {
                if (r.ok && r.body && r.body.status === 'ok') {
                    showDone();
                    return;
                }
                fail((r.body && r.body.message) || '送信に失敗しました。お手数ですが時間をおいて再度お試しください。');
            })
            .catch(function () {
                fail('通信に失敗しました。電波の良い場所で、もう一度お試しください。');
            });
    });

    var fail = function (message) {
        sending = false;
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        submitBtn.textContent = '入力内容で登録';
        modalError.textContent = message;
        modalError.hidden = false;
        modalError.scrollIntoView({ block: 'nearest' });
    };

    var showDone = function () {
        document.getElementById('pf-confirm').hidden = true;
        document.getElementById('pf-modal-body').hidden = true;
        document.getElementById('pf-modal-foot').hidden = true;
        document.getElementById('pf-done').hidden = false;
        modal.querySelector('.pf-modal').setAttribute('aria-labelledby', 'pf-done-title');
        form.reset();
        syncOthers();
        setStep(3);
        var home = document.getElementById('pf-home');
        if (brand.home) {
            home.href = brand.home;
            home.hidden = false;
            home.focus();
        }
    };
})();
</script>
</body>
</html>
```

### 差分（registry.ts・publicFormRateLimit.ts・version.ts）
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index de5c5ac8..8b8eee0a 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -141,6 +141,7 @@ import { runSuumoPropertyInsert } from '../features/suumoProperty';
 import { runShopList } from '../features/shopList';
 import { runUpdateLog } from '../features/updateLog';
 import { getLatestLoanRates, uploadLoanRates } from '../features/loanRate';
+import { runBeforeSurveyEntry } from '../features/beforeSurvey/entry';
 import type { GatewayEntry, GatewayKey } from './types';
 import { gatewayKey } from './types';
 
@@ -2235,6 +2236,24 @@ register({
   },
 });
 
+/**
+ * ⚠️⚠️ **事前アンケート（khg-marketing.info/survey_<ブランド>/）の回答受付。認証なしの書き込み口である。**（v2.2.207）
+ *   ⚠️ 防御は campaign_form:entry と同じ（publicFormRateLimit の流量制限・全項目の長さ制限・通知先はコード内の表）。
+ *   ⚠️ ブラウザから ② へ直接送る（① の PHP を通らない）。本番の CORS_ORIGINS に https://khg-marketing.info が要る（2026-10-22 時点で許可済み）。
+ *   ⚠️ 本文に `category` を入れないこと（ゲートウェイの鍵に入る）。
+ */
+register({
+  request: 'before_survey_entry',
+  summary: '【書き込み・認証なし】事前アンケートの回答受付（before_survey）＋通知メール',
+  phpSource: '(Express のみ。旧: survey_<ブランド>/thanks.php のメール → GAS Pre_survey)',
+  auth: 'none',
+  handler: async (ctx) => {
+    const result = await runBeforeSurveyEntry(ctx.body as Record<string, unknown>);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 // ---------------------------------------------------------------------------
 // 他社広告ライブラリ（meta_ads）
 //
diff --git a/backend-express/src/middlewares/publicFormRateLimit.ts b/backend-express/src/middlewares/publicFormRateLimit.ts
index f0757159..c172e702 100644
--- a/backend-express/src/middlewares/publicFormRateLimit.ts
+++ b/backend-express/src/middlewares/publicFormRateLimit.ts
@@ -46,6 +46,8 @@ const GUARDED_REQUESTS = new Set([
     'campaign_form',
     // ⚠️ 見学クラウドの予約受付（kengaku_cloud:entry）。認証なしの書き込み口
     'kengaku_cloud',
+    // ⚠️ v2.2.207 事前アンケートの回答受付。認証なしの書き込み口
+    'before_survey_entry',
 ]);
 
 const WINDOW_MS = 10 * 60_000;
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 719b4001..313eff76 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.206';
+export const newVersion = '2.2.207';
```
