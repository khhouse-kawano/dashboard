# 作業記録 v2.2.257　面談アンケート（survey）の API を ② へ

## 依頼（2026-11-06〜11-09）
- 「/Users/shinji-kawano/react/survey このプロジェクトの API も以前つくっていた /api/index.php を使っていたことがわかった。ファイルを確認して ② につくってほしい」
- 「/survey/api はサーバー上に残っていた（Downloads の index.php）」
- 「ログインは Dashboard がログイン中ならそのままページに入れる。未ログインなら Dashboard のログイン画面に遷移して Google Auth → 次の画面へ」
- 計画（お客様の画面は署名付きリンク）を出して「7日で進めてよい。お客様が開けないという事態は避けたい」
- 「survey のプロジェクトはビルドまでしてください」

## 調べたこと
- survey は2つの旧 API を呼んでいた
  - `https://khg-marketing.info/dashboard/api/`（旧 index.php。demand: survey_list・shop_list・staff_list・master_data_for_survey）
    - 実体はリポジトリに無く、git の履歴（`backup/back/20260625/api/`）にだけあった。今の ① はこの demand 形式を受けない（survey の検索などは動いていなかった）
  - `https://khg-marketing.info/survey/api/`（サーバーに残っている。request: login・before_interview・after_interview を使う）
    - ⚠️ before_interview_register は projects/sync が使う → サーバーに残す
- 旧 API の認証は、画面の JavaScript に書いた固定の合い言葉だけ。お客様全員の名前の一覧と、id を変えるだけでどのお客様の連絡先・年収なども読めた
- お客様の画面（面談前・面談後のアンケート）は、スタッフが出した QR をお客様が自分のスマホで開く（Dashboard にログインしていない）

## 作ったもの
### ②（backend-express）
- スタッフ用（auth: 'staff'。① を通して届く。Dashboard のトークン）
  - `interview_survey:customers`：検索の一覧（旧 survey_list と同じ列・並び）
  - `interview_survey:staff`：担当の一覧（旧 staff_list の、使う6列だけ）
  - `interview_survey:link`：お客様用 QR の署名（7日間）
  - 店舗の一覧は今ある `shop_list`
- お客様用（auth: 'none'。② へ直接。before_survey_entry と同じ経路）
  - `interview_survey_public:master`：署名があるときだけ、そのお客様の名前と master_data の23列（旧は全列）
  - `interview_survey_public:staff`：その店舗の担当の名前・pg_id
  - `interview_survey_public:before`・`after`：回答の保存（中身は旧 /survey/api/ と同じ表・同じ列）
- ⚠️ 「お客様が開けない」を避ける
  - 署名が無い・合わない・期限切れ・種類違いでも、画面は開ける（初期値が入らないだけ）
  - 回答の行（before_interview・after_interview）は URL の id で必ず保存する。お客様の記録（master_data・customers の印）の上書きは、署名が正しいときだけ
  - 署名の鍵（SURVEY_LINK_SECRET）が未設定でも、DB の接続情報から鍵を作って動く
  - 保存の流量の上限は 30件/10分/IP（店舗の Wi-Fi で同じ IP になるので、フォームの 5件より緩い）。読み込みは制限しない
- ⚠️ ① に `request: 'survey'`（handlers/survey.php）がすでにあるので、名前は `interview_survey` にした

### ①
- `express_proxy.php`：`interview_survey:customers`・`staff`・`link` を2つの許可リストに
- Dashboard の `Login.tsx`：`redirect` が `/survey/` で始まるときだけ、ログイン後にそのページへ（`isSurveyReturn`。'//'・'\'・制御文字は不可）。移る前にトークンを localStorage に保存する（AuthProvider の保存より先に離れるため）

### survey（react/survey。git 管理外。直す前の控え：`react/survey_backup_20261109.tgz`、以前のビルド：`react/survey_dist_before_20261109`）
- 新規 `src/api.ts`：通信をまとめた
  - スタッフ：localStorage の token で `/dashboard/api/`。無い・401 なら `/dashboard/login?redirect=<今の画面>`
  - QR の URL：以前と同じ値（id・shop・staff・name）に `t`（署名）を足す。署名を作れなくても URL は出す
  - お客様：URL の t を覚え（sessionStorage とメモリ）、② へ直接。読めなくても空欄で進む
  - 保存：② に届かない（通信の失敗・500 番台）ときは、旧 /survey/api/ へ以前と同じ形で送り直す。どちらも失敗したらお知らせして、入力はそのまま残す
- 新規 `components/RequireStaff.tsx`：スタッフの画面の入口（トークンが無ければ Dashboard のログインへ）
- `App.tsx`：入口・検索を RequireStaff で包む。'/' は種類の選択へ（以前の ID・パスワードの Home.tsx は使わない。ファイルは残した）
- `SearchBefore.tsx`・`SearchAfter.tsx`：一覧の読み込みと QR の URL
- `SurveyBefore.tsx`：お客様全員の一覧を読むのをやめ、署名でそのお客様の名前と初期値だけを読む。担当は店舗の分だけ
- `SurveyBeforeInfo.tsx`・`SurveyAfter.tsx`：初期値・担当の読み込みと保存
- ⚠️ heroku（sync-pg-cloud）への送信は変えていない
- ビルド済み：`react/survey/dist`（2026-11-09）

## テスト（ローカル）
- ② は作り直し（`docker compose up -d --build express-api`）。型チェック（②・フロント・survey）は通った
- API（`scratchpad/api_257.cjs`。29項目すべて OK）
  - ① 経由でトークン無しなら、interview_survey の3つは 401
  - customers の件数は全件、項目は5つ
  - staff は mail などを返さない
  - shop_list は ① 経由で読める
  - link の期限は7日、種類が無ければ断る
  - master
    - 署名ありなら名前と23列
    - 署名の書き換え・中身の id の書き換えは invalid
    - 期限切れ（8日前に作った署名）は expired
    - 面談後の署名では読めない
  - staff（お客様用）は、その店舗の分だけで mail なし
  - before（署名あり）
    - before_interview の区切りは ", "、家族・勤務先は JSON で、知らない項目は捨てる
    - customers.before_interview は 1
    - master_data は旧と同じ25列（区切り ","、担当の pg_id、今日の日付）
  - before（期限切れ）：回答の行は残り、master_data は変わらない
  - before（署名なし・id 無し）：id = new で保存
  - after（署名あり）：after_interview の行と customers.after_interview = 1。面談前の署名では linked にしない
- 画面（Playwright。`scratchpad/pw_257.cjs`。survey を 3100 で開き、①・② へ中継）
  - ⚠️ heroku の同期と本番の khg-marketing.info への通信は、すべて遮断して受けた
  - 未ログインで検索を開く → `/dashboard/login?redirect=%2Fsurvey%2Fsearch_before` へ
  - ログイン済み → 入口から種類の選択へ → 検索の一覧 → お客様を選ぶ → QR（① 経由で署名）。面談後も同じ
  - ログインしていない別のブラウザ（スマホ幅）で QR の URL を開く → お客様情報を読める → 必須を埋めて回答 → linked で保存 → お礼の画面。DB に行と印
  - 署名なしの URL：お客様情報は読まない（missing）→ 回答は保存（linked なし）→ お礼の画面
  - ② に届かない（送信を遮断）→ 旧 /survey/api/ へ送り直して、お礼の画面へ
  - 面談後：linked で保存、DB に行と印
  - 画面のエラー 0
- ⚠️ 確かめていないこと：Dashboard のログイン画面で Google ログインしたあと survey へ戻る動き（Google の認証はテストで通せない）。コードの再読で確かめた（`isSurveyReturn` と、移る前のトークンの保存）
- テストのお客様・回答の行・一時スタッフ（id 999999）は消した（後片付けで0件を確認）。survey のテスト用の一時設定（vite.test257.config.ts）は消した。開発サーバーは止めた
- リファクタリング
  - 署名の中身から名前・担当名を外した（QR が細かくなりすぎるため。名前は URL に別にある）
  - ログに出すのは理由だけにした（お客様の名前を出さない）
  - そのあと API と画面のテストを通し直した

## 業務ガイド
- 新しい記事「面談アンケート（面談前・面談後）」（common/screen-205.md）
  - スタッフの入り方（Dashboard のログイン・戻る）
  - お客様に回答してもらう手順
  - QR は7日間
  - 注意：期限切れの QR は開けて保存もされるが、初期値は入らず記録も新しくならない
  - 注意：QR は本人にだけ
  - うまくいかないとき
- SQL は `2026-11-09_update_log_2.2.257.sql` の末尾。ローカルに流した（update_log は no=356）

## 追加したファイル（全文）

### backend-express/src/features/survey/link.ts（新規）
```ts
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env';

/**
 * 面談アンケート（survey）のお客様用リンクの署名（v2.2.257）。
 *
 * ─────────────────────────────────────────────
 * スタッフが QR を出すとき（interview_survey:link。スタッフのトークンが要る）に、② が「どのお客様の・どちらのアンケートか・いつまで有効か」を
 * 署名して渡す。お客様の端末は Dashboard にログインしていないので、この署名だけで、そのお客様1人分を読み書きできる。
 *   ⚠️ 以前は id を書き換えるだけで、誰の個人情報でも読めた（旧 API の master_data_for_survey）。
 * 形: base64url(JSON の中身) + '.' + base64url(HMAC-SHA256)
 * ⚠️ 中身は種類・id・店舗・期限だけ（QR が細かくなりすぎて読み取りにくくならないよう、名前などは入れない。名前は URL に別にある）
 * ⚠️ 期限は7日（利用者の決定。後日、自宅で回答する場合があるため）。
 * ⚠️ 署名が無い・合わない・期限切れでも、お客様の画面は止めない（呼び出し側。public.ts）。
 * ─────────────────────────────────────────────
 */

export type SurveyKind = 'before' | 'after';

export interface SurveyLink {
  /** before = 面談前アンケート／after = 面談後アンケート */
  k: SurveyKind;
  /** customers.id・master_data.id。新規のお客様は 'new' */
  id: string;
  shop: string;
  /** 期限（UNIX 秒） */
  exp: number;
}

export const LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

const b64 = (buf: Buffer): string => buf.toString('base64url');

/**
 * 署名の鍵。⚠️ SURVEY_LINK_SECRET が無ければ DB の接続情報から作る（.env の設定忘れでお客様が開けなくならないように）。
 * ⚠️ 鍵そのものはログにも応答にも出さない。
 */
const secret = (): Buffer =>
  env.surveyLinkSecret !== ''
    ? Buffer.from(env.surveyLinkSecret, 'utf8')
    : createHash('sha256').update(`survey-link|${env.db.user}|${env.db.password}|${env.db.database}`).digest();

const sign = (body: string): string => b64(createHmac('sha256', secret()).update(body).digest());

/** リンクの署名を作る */
export const issueSurveyLink = (link: Omit<SurveyLink, 'exp'>, now = Date.now()): { token: string; exp: number } => {
  const exp = Math.floor(now / 1000) + LINK_TTL_SECONDS;
  const body = b64(Buffer.from(JSON.stringify({ ...link, exp }), 'utf8'));
  return { token: `${body}.${sign(body)}`, exp };
};

export type VerifyResult =
  | { ok: true; link: SurveyLink }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' };

/** リンクの署名を確かめる。⚠️ 比べるのは timingSafeEqual（長さが違うと例外なので先に比べる） */
export const verifySurveyLink = (token: unknown, now = Date.now()): VerifyResult => {
  if (typeof token !== 'string' || token === '') return { ok: false, reason: 'missing' };
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return { ok: false, reason: 'invalid' };
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(sign(body), 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'invalid' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const p = parsed as Partial<SurveyLink>;
  if ((p.k !== 'before' && p.k !== 'after') || typeof p.id !== 'string' || typeof p.shop !== 'string' || typeof p.exp !== 'number') {
    return { ok: false, reason: 'invalid' };
  }
  if (p.exp * 1000 < now) return { ok: false, reason: 'expired' };
  return { ok: true, link: { k: p.k, id: p.id, shop: p.shop, exp: p.exp } };
};
```

### backend-express/src/features/survey/clean.ts（新規）
```ts
/**
 * 面談アンケート（survey）の値の整え方（v2.2.257）。
 * ⚠️ お客様の端末から届く値は信用しない（features/beforeSurvey/entry.ts と同じ考え方）。長さで切り、制御文字を落とす。
 */

/** 制御文字（改行を含む） */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
/** 制御文字（改行は残す） */
const CONTROL_CHARS_KEEP_NEWLINE = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g;

const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

/** 1行の文字 */
export const cleanLine = (value: unknown, max: number): string =>
  asText(value).replace(CONTROL_CHARS, '').trim().slice(0, max);

/** 複数行の文字（自由記入） */
export const cleanText = (value: unknown, max: number): string =>
  asText(value).replace(/\r\n?/g, '\n').replace(CONTROL_CHARS_KEEP_NEWLINE, '').trim().slice(0, max);

/** 選択肢の配列を区切り文字でつなぐ（旧 PHP の implode）。配列でなければ1つの文字として扱う */
export const cleanList = (value: unknown, sep: string, max = 1000): string =>
  (Array.isArray(value) ? value.map((v) => cleanLine(v, 200)).filter((v) => v !== '') : [cleanLine(value, 200)].filter((v) => v !== ''))
    .join(sep)
    .slice(0, max);

/** 決まった項目だけを持つオブジェクト（家族・勤務先）。⚠️ 知らない項目は捨てる */
export const cleanObject = (value: unknown, keys: readonly string[], max = 200): Record<string, string> => {
  const src = value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(keys.map((k) => [k, cleanLine(src[k], max)]));
};

/** 日本時間の 'YYYY/MM/DD HH:mm:ss'（旧 PHP の date('Y/m/d H:i:s')） */
export const jstStamp = (now = new Date()): string => {
  const d = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString();
  return `${d.slice(0, 10).replace(/-/g, '/')} ${d.slice(11, 19)}`;
};
```

### backend-express/src/features/survey/staff.ts（新規）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { issueSurveyLink } from './link';
import type { SurveyKind } from './link';
import { cleanLine } from './clean';

/**
 * 面談アンケート（survey。khg-marketing.info/survey/）のスタッフの画面（v2.2.257。`interview_survey:<roll>`。auth: 'staff'）。
 *
 * ─────────────────────────────────────────────
 * 移植元: 旧 API（`/dashboard/api/` の demand 形式。backup/back/20260625/api/actions/）
 *   survey_list → interview_survey:customers ／ staff_list → interview_survey:staff ／ shop_list → 今ある `shop_list` をそのまま使う
 * ⚠️ 旧 API は画面に書いた固定の合い言葉だけで通していた（実質、誰でも読めた）。
 *   ここは Dashboard のトークンで通す（survey は Dashboard と同じ khg-marketing.info にあり、ログイン中のトークンを読める）。
 * ⚠️ 返す項目は survey が使うものだけ（旧 API は staff_list の全列だった）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** 検索の一覧（旧 survey_list と同じ列・同じ並び） */
export const runSurveyCustomers = async (): Promise<Record<string, unknown>[]> =>
  query<DynamicRow>('SELECT name, id, shop, register, staff FROM customers ORDER BY register DESC');

/** 担当の一覧（旧 staff_list の、survey が使う列だけ） */
export const runSurveyStaff = async (): Promise<Record<string, unknown>[]> =>
  query<DynamicRow>('SELECT id, name, pg_id, shop, category, period FROM staff_list');

/**
 * お客様用リンクの署名を作る（QR を出すとき）。
 * body: kind（before／after）・id（お客様の id。新規は 'new'）・shop
 */
export const runSurveyLink = (body: Record<string, unknown>): Record<string, unknown> => {
  const kind = body.kind === 'before' || body.kind === 'after' ? (body.kind as SurveyKind) : null;
  const id = cleanLine(body.id, 64);
  const shop = cleanLine(body.shop, 100);
  if (!kind || id === '' || shop === '') return { status: 'error', message: 'アンケートの種類・お客様・店舗を指定してください。' };
  const { token, exp } = issueSurveyLink({ k: kind, id, shop });
  return { status: 'success', token, exp };
};
```

### backend-express/src/features/survey/public.ts（新規）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../../db/pool';
import { logger } from '../../utils/logger';
import { verifySurveyLink } from './link';
import type { SurveyKind, SurveyLink } from './link';
import { cleanLine, cleanList, cleanObject, cleanText, jstStamp } from './clean';

/**
 * 面談アンケート（survey）のお客様の画面（v2.2.257。`interview_survey_public:<roll>`。⚠️ auth: 'none'）。
 *
 * ─────────────────────────────────────────────
 * お客様は、スタッフが出した QR から自分のスマホで開く。Dashboard にはログインしていない。
 * 代わりに、QR の URL の `t`（interview_survey:link が作る署名。7日間有効。link.ts）で、そのお客様1人分だけを読み書きできる。
 *
 * ⚠️⚠️ **お客様がアンケートを開けない・送れない事態を避ける**（利用者の指示）。
 *   - 署名が無い・合わない・期限切れでも、アンケートは開け、回答は保存する。
 *   - ただしその場合は「お客様情報の読み込み」と「お客様の記録（master_data・customers）の上書き」をしない。
 *     回答の行（before_interview・after_interview）だけを、URL の id で残す（スタッフが Dashboard で見られる）。
 * ⚠️ 書き込みの中身は旧 `/survey/api/`（サーバーに残っている index.php）の before_interview・after_interview と同じ。
 *   ⚠️ `/survey/api/` は projects/sync（before_interview_register）が使うので、サーバーに残したまま。
 * ⚠️ 流量の上限は middlewares/publicFormRateLimit.ts（保存だけ。店舗の Wi-Fi で同じ IP になるので、フォームより緩い）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** お客様の画面が使う master_data の列（旧 API は全列を返していた）。⚠️ 列名を SQL に埋め込むので、ここ以外の値を入れない */
const MASTER_COLUMNS = [
  'customer_contacts_name', 'customer_contacts_name_kana', 'customer_contacts_phone_number',
  'customer_contacts_mobile_phone_number', 'customer_contacts_email', 'customer_contacts_birth_date',
  'customer_contacts_employment_type', 'customer_contacts_employer_name', 'customer_contacts_employer_address',
  'customer_contacts_years_of_service', 'customer_contacts_annual_income',
  'postal_code', 'full_address', 'current_contract_type', 'current_rent', 'budget',
  'house_hunting_motivation', 'inquiry_reason', 'planned_construction_site',
  'customer_desired_floor', 'customer_desired_period', 'customer_desired_estate', 'customer_desired_order',
] as const;

const FAMILY_KEYS = ['name', 'kana', 'attribute', 'birth'] as const;
const EMPLOYMENT_KEYS = ['name', 'type', 'address', 'years', 'income'] as const;

/** 署名が使えなかった理由（ログ用。⚠️ お客様の名前などはログに出さない） */
const linkFailure = (t: unknown): string => {
  const v = verifySurveyLink(t);
  return v.ok ? `kind:${v.link.k}` : v.reason;
};

/** そのアンケートの署名として正しいか。⚠️ 種類が違う署名（面談後の QR で面談前を送る など）は使わない */
const trustedLink = (t: unknown, kind: SurveyKind): SurveyLink | null => {
  const v = verifySurveyLink(t);
  return v.ok && v.link.k === kind ? v.link : null;
};

/**
 * お客様情報の読み込み（面談前アンケート・情報確認の初期値）。
 * 応答: { status: 'ok', name, master } ／ 新規のお客様は master: null ／
 *   署名が使えないときは { status: 'missing' | 'invalid' | 'expired' }（⚠️ 画面は止めずに空欄で進む）
 */
export const runSurveyPublicMaster = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const v = verifySurveyLink(body.t);
  if (!v.ok) return { status: v.reason };
  if (v.link.k !== 'before') return { status: 'invalid' };
  if (v.link.id === 'new') return { status: 'ok', name: '', master: null };
  const [customer] = await query<DynamicRow>('SELECT name FROM customers WHERE id = ? LIMIT 1', [v.link.id]);
  const [master] = await query<DynamicRow>(`SELECT ${MASTER_COLUMNS.join(', ')} FROM master_data WHERE id = ? LIMIT 1`, [v.link.id]);
  return { status: 'ok', name: customer ? String(customer.name ?? '') : '', master: master ?? null };
};

/**
 * 担当の一覧（面談前の新規の担当の pg_id・面談後の担当の選択肢）。⚠️ その店舗の名前だけ（署名は要らない）
 */
export const runSurveyPublicStaff = async (body: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
  const shop = cleanLine(body.shop, 100);
  if (shop === '') return [];
  return query<DynamicRow>('SELECT name, pg_id, shop, category, period FROM staff_list WHERE shop = ?', [shop]);
};

/**
 * 面談前アンケートの保存（旧 `/survey/api/` の before_interview）。
 *   1. before_interview に1行（⚠️ いつも残す）
 *   2. 署名が正しく、新規でなければ: customers の before_interview = 1、master_data の連絡先・希望を上書き（旧と同じ25列）
 */
export const runSurveyPublicBefore = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const link = trustedLink(body.t, 'before');
  const id = link ? link.id : cleanLine(body.id, 64) || 'new';
  const shop = link ? link.shop : cleanLine(body.shop, 100);
  const name = cleanLine(body.name, 100);
  const employment = cleanObject(body.employment, EMPLOYMENT_KEYS);
  const family = [1, 2, 3, 4].map((n) => JSON.stringify(cleanObject(body[`family_member_${n}`], FAMILY_KEYS)));
  const f = {
    medium: cleanList(body.medium, ', '), interest: cleanList(body.interest, ', '), opportunity: cleanList(body.opportunity, ', '),
    plan: cleanLine(body.plan, 200), period: cleanLine(body.period, 200), estate: cleanLine(body.estate, 200),
    area: cleanLine(body.area, 300), importance: cleanList(body.importance, ', '), budget: cleanLine(body.budget, 100),
    support: cleanList(body.support, ', '), demand: cleanText(body.demand, 2000), kana: cleanLine(body.kana, 100),
    phone: cleanLine(body.phone, 30), mail: cleanLine(body.mail, 200), mobile: cleanLine(body.mobile, 30),
    zip: cleanLine(body.zip, 10), address: cleanLine(body.address, 300), rent: cleanLine(body.rent, 50),
    birth: cleanLine(body.birth, 20), situation: cleanLine(body.situation, 100), staff: cleanLine(body.staff, 64),
  };

  const linked = await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO before_interview (id, name, shop, medium, interest, opportunity, plan, period, estate, area, importance, budget, support, demand,
         kana, phone, mail, mobile, zip, address, rent, birth, situation, family_member_1, family_member_2, family_member_3, family_member_4,
         employment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, shop, f.medium, f.interest, f.opportunity, f.plan, f.period, f.estate, f.area, f.importance, f.budget, f.support, f.demand,
        f.kana, f.phone, f.mail, f.mobile, f.zip, f.address, f.rent, f.birth, f.situation, ...family, JSON.stringify(employment), jstStamp()]
    );
    if (!link || id === 'new') return false;
    await tx.execute('UPDATE customers SET before_interview = 1 WHERE id = ?', [id]);
    // ⚠️ 旧と同じく、master_data は区切りに ','（before_interview は ', '）
    await tx.execute(
      `UPDATE master_data SET customer_contacts_name = ?, in_charge_user = ?, first_interviewed_date = ?, full_address = ?,
         customer_contacts_name_kana = ?, customer_contacts_phone_number = ?, customer_contacts_mobile_phone_number = ?,
         customer_contacts_email = ?, customer_contacts_birth_date = ?, customer_contacts_employment_type = ?,
         customer_contacts_employer_name = ?, customer_contacts_employer_address = ?, customer_contacts_years_of_service = ?,
         customer_contacts_annual_income = ?, postal_code = ?, current_contract_type = ?, current_rent = ?, budget = ?,
         house_hunting_motivation = ?, inquiry_reason = ?, planned_construction_site = ?, customer_desired_floor = ?,
         customer_desired_period = ?, customer_desired_estate = ?, customer_desired_order = ?
       WHERE id = ?`,
      [name, f.staff, jstStamp().slice(0, 10), f.address, f.kana, f.phone, f.mobile, f.mail, f.birth,
        employment.type, employment.name, employment.address, employment.years, employment.income,
        f.zip, f.situation, f.rent, f.budget,
        cleanList(body.opportunity, ','), cleanList(body.medium, ','), f.area, f.plan, f.period, f.estate, cleanList(body.interest, ','),
        id]
    );
    return true;
  });
  if (!linked && id !== 'new') logger.warn('[survey] 面談前アンケート: リンクの署名が使えないため、回答だけを保存しました', { id, shop, reason: linkFailure(body.t) });
  return { status: 'success', linked };
};

/**
 * 面談後アンケートの保存（旧 `/survey/api/` の after_interview）。
 *   1. after_interview に1行（⚠️ いつも残す）
 *   2. 署名が正しく、新規でなければ: customers の after_interview = 1
 */
export const runSurveyPublicAfter = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const link = trustedLink(body.t, 'after');
  const id = link ? link.id : cleanLine(body.id, 64) || 'new';
  const shop = link ? link.shop : cleanLine(body.shop, 100);
  const name = cleanLine(body.name, 100);

  const linked = await withTransaction(async (tx) => {
    await tx.execute(
      `INSERT INTO after_interview (id, dateStr, shop, name, phone, InterviewFeedback, confirmedAllItems, desireOwnership, priorityCondition,
         ourCompanyFirstChoice, otherCompaniesInterested, staffName, staffHospitality, proposalFeedback, moreInfoOrImprovements,
         nextConsultationRequests, changeStaffRequested)
       VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, jstStamp(), shop, name, cleanList(body.toldInformation, ', '), cleanLine(body.desired, 200), cleanLine(body.condition, 200),
        cleanLine(body.importance, 200), cleanLine(body.priority, 200), cleanText(body.rival, 1000), cleanLine(body.staff, 100),
        cleanLine(body.staffSatisfied, 200), cleanLine(body.interviewSatisfied, 200), cleanText(body.improvement, 2000),
        cleanText(body.demand, 2000), cleanLine(body.staffChange, 200)]
    );
    if (!link || id === 'new') return false;
    await tx.execute('UPDATE customers SET after_interview = 1 WHERE id = ?', [id]);
    return true;
  });
  if (!linked && id !== 'new') logger.warn('[survey] 面談後アンケート: リンクの署名が使えないため、回答だけを保存しました', { id, shop, reason: linkFailure(body.t) });
  return { status: 'success', linked };
};
```

### react/survey/src/api.ts
```tsx
import axios from 'axios';

/**
 * 面談アンケートの通信（2026-11-09。Dashboard v2.2.257 と組み）。
 *
 * ─────────────────────────────────────────────
 * スタッフの画面（入口・面談前／面談後の検索・QR）
 *   - Dashboard（同じ khg-marketing.info）にログインしたときのトークン（localStorage の token）で、① /dashboard/api/ を通して ② へ。
 *   - トークンが無い・期限切れ（401）なら、Dashboard のログイン画面へ。Google でログインすると、元の画面へ戻る。
 * お客様の画面（QR から開く。ログインしていない）
 *   - QR の URL の t（② が作る署名。7日間有効）を付けて、② へ直接送る（api.khg-marketing.info）。
 *   - ⚠️⚠️ お客様が開けない・送れない事態を避ける（利用者の指示）:
 *     ・署名が無い・期限切れでも、アンケートは開ける（お客様情報の初期値が入らないだけ）。② は回答を保存する。
 *     ・② に届かない（通信の失敗・500 番台）ときは、サーバーに残っている旧 /survey/api/ へ、以前と同じ形で送り直す。
 * ─────────────────────────────────────────────
 */

const DASHBOARD_API = import.meta.env.VITE_DASHBOARD_API ?? '/dashboard/api/';
const DASHBOARD_LOGIN = import.meta.env.VITE_DASHBOARD_LOGIN ?? '/dashboard/login';
const GATEWAY = import.meta.env.VITE_GATEWAY ?? 'https://api.khg-marketing.info/api/gateway';
/** ⚠️ 予備の送り先（旧）。② に届かないときだけ使う。⚠️ projects/sync も使っているのでサーバーに残っている */
const OLD_SURVEY_API = 'https://khg-marketing.info/survey/api/';
const OLD_SURVEY_KEY = '<共有キー>';
const TIMEOUT_MS = 20000;

// ---------------------------------------------------------------------------
// スタッフの画面
// ---------------------------------------------------------------------------

const readToken = (): string => {
    try {
        return localStorage.getItem('token') ?? '';
    } catch {
        return '';
    }
};

export const hasStaffToken = (): boolean => readToken() !== '';

/** Dashboard のログイン画面へ（ログイン後、今の画面に戻る） */
export const goDashboardLogin = (): void => {
    window.location.assign(`${DASHBOARD_LOGIN}?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
};

const isStatus = (e: unknown, code: number): boolean => axios.isAxiosError(e) && e.response?.status === code;

/** ① /dashboard/api/ へ（Dashboard のトークン付き）。⚠️ 401 ならログイン画面へ移り、例外を投げる */
const dashboardPost = async <T>(body: Record<string, unknown>): Promise<T> => {
    const token = readToken();
    if (token === '') {
        goDashboardLogin();
        throw new Error('Dashboard にログインしていません');
    }
    try {
        const res = await axios.post(DASHBOARD_API, body, { headers: { 'Content-Type': 'application/json', Token: token }, timeout: TIMEOUT_MS });
        return res.data as T;
    } catch (e) {
        if (isStatus(e, 401)) goDashboardLogin();
        throw e;
    }
};

export type SurveyCustomer = { id: string; name: string; register: string; shop: string; staff: string };
export type SurveyStaff = { id?: number; name: string; pg_id: string; shop: string; category: number; period?: string | number };
export type SurveyShop = { brand: string; shop: string; section: string; area: string; division?: string };

export const fetchCustomers = () => dashboardPost<SurveyCustomer[]>({ request: 'interview_survey', roll: 'customers' });
export const fetchStaff = () => dashboardPost<SurveyStaff[]>({ request: 'interview_survey', roll: 'staff' });
export const fetchShops = () => dashboardPost<SurveyShop[]>({ request: 'shop_list' });

/**
 * お客様用 QR の URL。⚠️ 署名（t）を足す。署名を作れなくても、t の無い URL を返す（お客様は開ける。回答は保存される）。
 * kind: before＝面談前／after＝面談後。params は以前の URL と同じ値（id・shop・staff・name）
 */
export const surveyUrl = async (kind: 'before' | 'after', params: { id: string; shop: string; staff?: string; name?: string }): Promise<string> => {
    const q = new URLSearchParams({ id: params.id, shop: params.shop });
    if (params.staff) q.set('staff', params.staff);
    if (params.name !== undefined) q.set('name', params.name);
    try {
        const r = await dashboardPost<{ status: string; token?: string }>({ request: 'interview_survey', roll: 'link', kind, id: params.id, shop: params.shop });
        if (r.status === 'success' && r.token) q.set('t', r.token);
        else console.error('[survey] QR の署名を作れませんでした（署名なしの URL を出します）', r);
    } catch (e) {
        console.error('[survey] QR の署名を作れませんでした（署名なしの URL を出します）', e);
    }
    return `https://khg-marketing.info/survey/survey_${kind}?${q.toString()}`;
};

// ---------------------------------------------------------------------------
// お客様の画面
// ---------------------------------------------------------------------------

const LINK_KEY = 'survey_link_t';
let memoryLink = '';

/** URL の t を覚える（面談前 → 情報確認は画面を移っても URL が変わるので、ここで持つ）。⚠️ 保存できない端末でもメモリに持つ */
export const rememberLink = (search: string): void => {
    const t = new URLSearchParams(search).get('t') ?? '';
    memoryLink = t;
    try {
        sessionStorage.setItem(LINK_KEY, t);
    } catch {
        // 保存できなくても続ける
    }
};

const currentLink = (): string => {
    if (memoryLink) return memoryLink;
    try {
        return sessionStorage.getItem(LINK_KEY) ?? '';
    } catch {
        return '';
    }
};

const publicPost = async <T>(roll: string, body: Record<string, unknown>): Promise<T> => {
    const res = await axios.post(GATEWAY, { ...body, request: 'interview_survey_public', roll, t: currentLink() },
        { headers: { 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS });
    return res.data as T;
};

/**
 * お客様情報の初期値。⚠️ 失敗・署名なし・期限切れでも null を返すだけ（画面は空欄で進む）
 */
export const fetchCustomerMaster = async (): Promise<{ name: string; master: Record<string, string> | null } | null> => {
    try {
        const r = await publicPost<{ status: string; name?: string; master?: Record<string, string> | null }>('master', {});
        if (r.status !== 'ok') {
            console.warn('[survey] お客様情報を読めませんでした（空欄で進みます）', r.status);
            return null;
        }
        return { name: r.name ?? '', master: r.master ?? null };
    } catch (e) {
        console.error('[survey] お客様情報を読めませんでした（空欄で進みます）', e);
        return null;
    }
};

/** その店舗の担当。⚠️ 失敗しても空の配列（画面は止めない） */
export const fetchShopStaff = async (shop: string): Promise<SurveyStaff[]> => {
    try {
        const r = await publicPost<SurveyStaff[]>('staff', { shop });
        return Array.isArray(r) ? r : [];
    } catch (e) {
        console.error('[survey] 担当の一覧を読めませんでした', e);
        return [];
    }
};

/** ② に届かなかったか（通信の失敗・時間切れ・500 番台）。⚠️ 429（送りすぎ）・400 番台は予備へ回さない */
const unreachable = (e: unknown): boolean =>
    !axios.isAxiosError(e) || !e.response || e.response.status >= 500;

/**
 * 回答の保存。② へ送り、届かなければ旧 /survey/api/ へ同じ内容で送り直す。
 * 戻り値: true＝保存できた／false＝保存できなかった（呼び出し側でお知らせする）
 */
const saveAnswer = async (roll: 'before' | 'after', oldRequest: string, form: Record<string, unknown>): Promise<boolean> => {
    try {
        const r = await publicPost<{ status?: string; message?: string }>(roll, form);
        if (r.status === 'success') return true;
        console.error('[survey] 回答を保存できませんでした', r);
    } catch (e) {
        if (!unreachable(e)) {
            console.error('[survey] 回答を保存できませんでした', e);
            if (isStatus(e, 429)) {
                alert('送信が続けて行われました。お手数ですが時間をおいて、もう一度「送信」を押してください。');
                return false;
            }
        } else {
            console.error('[survey] 新しい送り先に届かないため、以前の送り先へ送ります', e);
        }
    }
    try {
        await axios.post(OLD_SURVEY_API, { ...form, request: oldRequest },
            { headers: { Authorization: OLD_SURVEY_KEY, 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS });
        return true;
    } catch (e) {
        console.error('[survey] 以前の送り先にも保存できませんでした', e);
        return false;
    }
};

export const saveBeforeAnswer = (form: Record<string, unknown>) => saveAnswer('before', 'before_interview', form);
export const saveAfterAnswer = (form: Record<string, unknown>) => saveAnswer('after', 'after_interview', form);
```

### react/survey/src/components/RequireStaff.tsx
```tsx
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { goDashboardLogin, hasStaffToken } from '../api';

/**
 * スタッフの画面の入口（2026-11-09）。
 * Dashboard にログインしていれば（同じサイトのトークンがあれば）そのまま入る。無ければ Dashboard のログイン画面へ移り、
 * Google でログインすると、この画面へ戻る。⚠️ トークンの期限切れは、通信の 401 で同じくログイン画面へ（api.ts）。
 * ⚠️ お客様の画面（QR から開く survey_before・survey_before_info・survey_after・thanks）には使わない。
 */
const RequireStaff = ({ children }: { children: ReactNode }) => {
    const ok = hasStaffToken();
    useEffect(() => {
        if (!ok) goDashboardLogin();
    }, [ok]);
    if (!ok) return <div className="text-center p-5 text-muted">Dashboard のログイン画面へ移動しています…</div>;
    return <>{children}</>;
};

export default RequireStaff;
```

### react/survey/src/App.tsx
```tsx

import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import SearchAfter from './components/SearchAfter';
import SearchBefore from './components/SearchBefore';
import SurveyAfter from './components/SurveyAfter';
import SurveyBefore from './components/SurveyBefore';
import SurveyBeforeInfo from './components/SurveyBeforeInfo';
import Thanks from './components/Thanks';
import Category from './components/Category';
import RequireStaff from './components/RequireStaff';
import "bootstrap/dist/css/bootstrap.min.css";

/**
 * 2026-11-09: スタッフの画面（入口・検索）は Dashboard のログインで入る（RequireStaff）。
 *   以前の ID・パスワードの入口（Home.tsx）は使わない。'/' は種類の選択へ。
 * ⚠️ お客様の画面（survey_before・survey_before_info・survey_after・thanks）は QR から開くので、ログインを求めない。
 */
function App() {

  return (
    <Router basename="/survey">
      <Routes>
        <Route path='/' element={<RequireStaff><Navigate to="/category" replace /></RequireStaff>} />
        <Route path='/category' element={<RequireStaff><Category /></RequireStaff>}/>
        <Route path='/search_after' element={<RequireStaff><SearchAfter /></RequireStaff>} />
        <Route path='/search_before' element={<RequireStaff><SearchBefore /></RequireStaff>} />
        <Route path='/survey_after' element={<SurveyAfter />} />
        <Route path='/survey_before' element={<SurveyBefore />} />
        <Route path='/survey_before_info' element={<SurveyBeforeInfo />} />
        <Route path='/thanks' element={< Thanks />} />
      </Routes>
    </Router>
  )
}

export default App
```

## git diff（Dashboard の既存ファイル）
```diff
diff --git a/backend-express/src/config/env.ts b/backend-express/src/config/env.ts
index 18b5f0768..413815cca 100644
--- a/backend-express/src/config/env.ts
+++ b/backend-express/src/config/env.ts
@@ -187,6 +187,17 @@ export const env = {
    */
   memberEntryKey: (process.env.MEMBER_ENTRY_KEY ?? '').trim(),
 
+  /**
+   * 面談アンケート（survey）のお客様用リンクの署名の鍵。（v2.2.257。features/survey/link.ts）
+   *
+   * ⚠️ **未設定でも止めない**（お客様がアンケートを開けない事態を避けるため。利用者の指示）。
+   *   未設定なら link.ts が DB の接続情報から鍵を作る（DB のパスワードを変えると、それまでのリンクは
+   *   「期限切れ」と同じ扱いになり、回答は保存されるがお客様情報の読み込みと上書きはされない）。
+   * ⚠️ 設定するなら ② VPS の .env.prod のみ。⚠️ **リポジトリに書かないこと。**
+   *   ⚠️ 値を変えると、発行済みのリンクは同じく「期限切れ」の扱いになる。
+   */
+  surveyLinkSecret: (process.env.SURVEY_LINK_SECRET ?? '').trim(),
+
   /**
    * 他社広告の取り込み（meta_scrape。拡張機能 extensions/meta が送る）の合い言葉。（v2.2.230）
    *
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 01ec6d935..be199a508 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -147,6 +147,8 @@ import { listLoanPlanRates, uploadLoanPlanRates } from '../features/loanPlanRate
 import { listSecurityLog } from '../features/securityLog';
 import { BUDGET_TABLE_AUTHORITY, listBudgetTable, uploadBudgetTable } from '../features/budgetTable';
 import { runBeforeSurveyEntry } from '../features/beforeSurvey/entry';
+import { runSurveyCustomers, runSurveyLink, runSurveyStaff } from '../features/survey/staff';
+import { runSurveyPublicAfter, runSurveyPublicBefore, runSurveyPublicMaster, runSurveyPublicStaff } from '../features/survey/public';
 import { runMemberEntry } from '../features/memberEntry/entry';
 import { runHousingBazarEntry } from '../features/housingBazar/entry';
 import { runKagosumaEntry } from '../features/kagosuma/entry';
@@ -2487,6 +2489,71 @@ register({
   },
 });
 
+/**
+ * 面談アンケート（survey。khg-marketing.info/survey/）のスタッフの画面（v2.2.257。features/survey/staff.ts）。
+ *   ⚠️ 移植元は旧 API（`/dashboard/api/` の demand: survey_list・staff_list）。旧 API は固定の合い言葉だけで通していた。
+ *   ⚠️ auth: 'staff'。survey は Dashboard と同じ khg-marketing.info にあり、Dashboard のトークンで ① を通して届く
+ *     （⚠️ express_proxy.php の expressProxyRequests() と expressProxyExclusive() の両方に入れてある）。
+ *   ⚠️ 店舗の一覧は今ある `shop_list` を使う。
+ */
+register({
+  request: 'interview_survey', roll: 'customers',
+  summary: '面談アンケート：検索の一覧（customers の name・id・shop・register・staff）',
+  phpSource: '(Express のみ。旧 API demand: survey_list。現行 backend/ に PHP ハンドラは無い)',
+  auth: 'staff',
+  handler: async () => runSurveyCustomers(),
+});
+register({
+  request: 'interview_survey', roll: 'staff',
+  summary: '面談アンケート：担当の一覧（staff_list の id・name・pg_id・shop・category・period）',
+  phpSource: '(Express のみ。旧 API demand: staff_list。現行 backend/ に PHP ハンドラは無い)',
+  auth: 'staff',
+  handler: async () => runSurveyStaff(),
+});
+register({
+  request: 'interview_survey', roll: 'link',
+  summary: '面談アンケート：お客様用 QR のリンクの署名（7日間有効）',
+  phpSource: '(Express のみ。v2.2.257 新規)',
+  auth: 'staff',
+  handler: async (ctx) => runSurveyLink(ctx.body as Record<string, unknown>),
+});
+
+/**
+ * ⚠️⚠️ **面談アンケートのお客様の画面（QR から開く）。認証なしの読み書き口である。**（v2.2.257。features/survey/public.ts）
+ *   ⚠️ お客様の情報の読み込みと、お客様の記録の上書きは、QR の URL の署名（interview_survey:link が作る。7日間）があるときだけ。
+ *   ⚠️ 署名が使えなくても回答の行は保存する（お客様が送れない事態を避ける。利用者の指示）。
+ *   ⚠️ ブラウザから ② へ直接送る（before_survey_entry と同じ。本番の CORS_ORIGINS に https://khg-marketing.info が要る。許可済み）。
+ *   ⚠️ 保存（before・after）の流量の上限は publicFormRateLimit.ts。⚠️ 本文に `category` を入れないこと（ゲートウェイの鍵に入る）。
+ */
+register({
+  request: 'interview_survey_public', roll: 'master',
+  summary: '【認証なし・署名で絞る】面談アンケート：お客様情報の初期値（master_data の23列）',
+  phpSource: '(Express のみ。旧 API demand: master_data_for_survey は全列・誰でも読めた)',
+  auth: 'none',
+  handler: async (ctx) => runSurveyPublicMaster(ctx.body as Record<string, unknown>),
+});
+register({
+  request: 'interview_survey_public', roll: 'staff',
+  summary: '【認証なし】面談アンケート：その店舗の担当の名前',
+  phpSource: '(Express のみ。旧 API demand: staff_list)',
+  auth: 'none',
+  handler: async (ctx) => runSurveyPublicStaff(ctx.body as Record<string, unknown>),
+});
+register({
+  request: 'interview_survey_public', roll: 'before',
+  summary: '【書き込み・認証なし】面談前アンケートの保存（before_interview。署名があれば customers・master_data も）',
+  phpSource: '(Express のみ。旧: survey/api/ の before_interview。⚠️ survey/api/ は sync が使うので残す)',
+  auth: 'none',
+  handler: async (ctx) => runSurveyPublicBefore(ctx.body as Record<string, unknown>),
+});
+register({
+  request: 'interview_survey_public', roll: 'after',
+  summary: '【書き込み・認証なし】面談後アンケートの保存（after_interview。署名があれば customers も）',
+  phpSource: '(Express のみ。旧: survey/api/ の after_interview)',
+  auth: 'none',
+  handler: async (ctx) => runSurveyPublicAfter(ctx.body as Record<string, unknown>),
+});
+
 /**
  * ⚠️⚠️ **ホームページの会員登録（KH・2L・なごみ・JH）の取り込み。書き込み口である。**（v2.2.209）
  *   ⚠️ 送ってくるのは GAS（MEMBERtoDashboard）。スタッフのトークンは無いので auth は none、
diff --git a/backend-express/src/middlewares/publicFormRateLimit.ts b/backend-express/src/middlewares/publicFormRateLimit.ts
index 453681556..cf49d8ab8 100644
--- a/backend-express/src/middlewares/publicFormRateLimit.ts
+++ b/backend-express/src/middlewares/publicFormRateLimit.ts
@@ -104,6 +104,22 @@ const checkinLimiter = rateLimit({
   },
 });
 
+/**
+ * 面談アンケートの保存（interview_survey_public:before・after）の制限（v2.2.257）。
+ *   ⚠️ 店舗でお客様が同じ Wi-Fi から次々に送るので、フォームの 5件/10分 では止まる。30件/10分にする。
+ */
+const surveyLimiter = rateLimit({
+  windowMs: 10 * 60_000,
+  limit: 30,
+  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown'),
+  standardHeaders: 'draft-7',
+  legacyHeaders: false,
+  message: {
+    status: 'error',
+    message: '送信が続けて行われました。お手数ですが時間をおいて再度お試しください。',
+  },
+});
+
 /**
  * ゲートウェイに挟むミドルウェア。
  *
@@ -131,6 +147,18 @@ export const publicFormRateLimit = (
     return;
   }
 
+  // ⚠️ v2.2.257 面談アンケートの保存（認証なしの書き込み口）。店舗の Wi-Fi で同じ IP になるので、フォームより緩い別の制限。
+  //   ⚠️ 読み込み（master・staff）は制限しない（お客様が開けない事態を避ける。master は署名で1人分に絞っている）
+  if (request === 'interview_survey_public') {
+    const roll = (req.body as { roll?: unknown } | undefined)?.roll;
+    if (roll === 'before' || roll === 'after') {
+      void surveyLimiter(req, res, next);
+      return;
+    }
+    next();
+    return;
+  }
+
   if (!GUARDED_REQUESTS.has(request)) {
     next();
     return;
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 98714f2b9..3967a2bda 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -178,6 +178,12 @@ function expressProxyRequests(): array
         'privacy_erase:inquiry:order',
         'privacy_erase:inquiry:spec',
         'privacy_erase:inquiry:used',
+        // ⚠️ v2.2.257。面談アンケート（survey）のスタッフの画面（② だけ。旧 API の demand: survey_list・staff_list の置き換え）。
+        //   expressProxyExclusive() にも入れてある。⚠️ ① の handlers/survey.php（request: 'survey'）とは別物
+        //   ⚠️ お客様の画面（interview_survey_public）は ① を通らず ② へ直接送る（before_survey_entry と同じ）
+        'interview_survey:customers',
+        'interview_survey:staff',
+        'interview_survey:link',
 
         // 2026-09-03 移植。旧API（dashboard/api/ の demand 形式）から
         // request 形式へ移したもの。
@@ -831,6 +837,11 @@ function expressProxyExclusive(): array
         'analysis_report_upload',
         'analysis_report_delete',
 
+        // v2.2.257 新規。面談アンケート（survey）のスタッフの画面。⚠️ ① に PHP ハンドラが無い
+        'interview_survey:customers',
+        'interview_survey:staff',
+        'interview_survey:link',
+
         // v2.2.217 新規。Claudeによる分析。⚠️ 分析は ② の中で数分かけて続くため、① では代われない
         'ai_analysis_start',
         'ai_analysis_list',
diff --git a/frontend/src/components/Login.tsx b/frontend/src/components/Login.tsx
index e2683bae7..56eea7c76 100644
--- a/frontend/src/components/Login.tsx
+++ b/frontend/src/components/Login.tsx
@@ -11,6 +11,13 @@ import { JUST_LOGGED_OUT } from '../utils/logout';
 
 type Value = { mail: string, password: string, error: string };
 
+/**
+ * ⚠️ v2.2.257: ログイン後に戻ってよい面談アンケート（survey）の道か。
+ *   '/survey/' で始まり、'//'・'\'・制御文字を含まないものだけ（ほかのサイトへ飛ばす罠のリンクを防ぐ）
+ */
+export const isSurveyReturn = (path: string): boolean =>
+  path.startsWith('/survey/') && !path.includes('//') && !path.includes('\\') && !/[\u0000-\u001F]/.test(path);
+
 const Login = () => {
   const [validationMessage, setValidationMessage] = useState<Value>({
     mail: "",
@@ -59,6 +66,21 @@ const Login = () => {
           const searchParams = new URLSearchParams(location.search);
           const redirectUrl = searchParams.get('redirect');
 
+          // ⚠️ v2.2.257: 面談アンケート（survey。同じ khg-marketing.info の別アプリ）から来たときは、ログイン後に元の画面へ戻す。
+          //   ⚠️ '/survey/' で始まる同じサイトの道だけ（'//' や 'http' で始まる値でほかのサイトへ飛ばされないように）
+          if (redirectUrl && isSurveyReturn(redirectUrl)) {
+            // ⚠️ AuthProvider の保存（useEffect）より先にページを離れるので、ここで保存してから移る
+            try {
+              localStorage.setItem('token', response.data.token);
+              localStorage.setItem('authority', response.data.authority);
+              localStorage.setItem('userName', response.data.userName);
+            } catch {
+              // ⚠️ 保存できない端末でも移る（survey 側がもう一度ログインへ案内する）
+            }
+            window.location.assign(redirectUrl);
+            return;
+          }
+
           // 💡 リダイレクト先があればそこに、無ければデフォルトの /home へ飛ばす
           if (redirectUrl) {
             navigate(redirectUrl, {
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 7f3e8818f..917008452 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.256';
+export const newVersion = '2.2.257';
```

## survey の差分（直す前の控えとの比較）
```diff
--- (控え) survey/src/components/SearchBefore.tsx	2025-09-17 16:38:21.000000000 +0900
+++ survey/src/components/SearchBefore.tsx	2026-11-09 17:30:31.567099500 +0900
@@ -1,6 +1,6 @@
 import khgLogo from '../assets/images/khgLogo.png';
 import { useEffect, useState, useMemo } from 'react';
-import axios from 'axios';
+import { fetchCustomers, fetchShops, fetchStaff, surveyUrl } from '../api';
 import { Table } from 'react-bootstrap';
 import Modal from 'react-bootstrap/Modal';
 import QRCode from 'react-qr-code';
@@ -35,15 +35,11 @@
     useEffect(() => {
         const fetchData = async () => {
             try {
-                const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                const [customerRes, shopRes, staffRes] = await Promise.all([
-                    axios.post("https://khg-marketing.info//dashboard/api/", { demand: "survey_list" }, { headers }),
-                    axios.post("https://khg-marketing.info//dashboard/api/", { demand: "shop_list" }, { headers }),
-                    axios.post("https://khg-marketing.info//dashboard/api/", { demand: "staff_list" }, { headers })
-                ]);
-                await setOriginalList(customerRes.data);
-                await setShopList(shopRes.data);
-                await setStaffList(staffRes.data);
+                // ⚠️ 2026-11-09: 旧 API（demand）から ② へ（Dashboard のトークンで。api.ts）
+                const [customers, shops, staff] = await Promise.all([fetchCustomers(), fetchShops(), fetchStaff()]);
+                await setOriginalList(customers);
+                await setShopList(shops);
+                await setStaffList(staff as unknown as Staff[]);
             } catch (error) {
                 console.error("データ取得エラー:", error);
             }
@@ -80,7 +76,8 @@
                 return;
             }
             if (window.confirm(`${targetShop}_新規お客様の来場前アンケートを開始しますか?`)) {
-                await setUrl(`https://khg-marketing.info/survey/survey_before?id=new&shop=${encodeURIComponent(targetShop)}&staff=${encodeURIComponent(targetStaff)}`);
+                // ⚠️ 2026-11-09: QR の URL に署名（7日間有効）を付ける（api.ts の surveyUrl。作れなくても URL は出す）
+                await setUrl(await surveyUrl('before', { id: 'new', shop: targetShop, staff: targetStaff }));
                 await setShow(true);
             }
         } else {
@@ -91,7 +88,7 @@
             const filteredCustomer = customerList.find(item => item.id === registerName.id);
             const nameValue = filteredCustomer?.name ? filteredCustomer.name : '';
             if (window.confirm(`${filteredCustomer?.shop} ${filteredCustomer?.name}様の来場前アンケートを開始しますか?`)) {
-                await setUrl(`https://khg-marketing.info/survey/survey_before?id=${encodeURIComponent(registerName.id)}&shop=${encodeURIComponent(registerName.shop)}&name=${encodeURIComponent(nameValue)}`);
+                await setUrl(await surveyUrl('before', { id: registerName.id, shop: registerName.shop, name: nameValue }));
                 await setShow(true);
             }
             console.log(registerName);
--- (控え) survey/src/components/SearchAfter.tsx	2026-07-10 17:48:42.000000000 +0900
+++ survey/src/components/SearchAfter.tsx	2026-11-09 17:30:31.569679600 +0900
@@ -1,6 +1,6 @@
 import khgLogo from '../assets/images/khgLogo.png';
 import { useEffect, useState, useMemo } from 'react';
-import axios from 'axios';
+import { fetchCustomers, fetchShops, surveyUrl } from '../api';
 import { Table } from 'react-bootstrap';
 import { Modal, Button } from 'react-bootstrap';
 import QRCode from 'react-qr-code';
@@ -28,13 +28,10 @@
     useEffect(() => {
         const fetchData = async () => {
             try {
-                const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                const [customerRes, shopRes] = await Promise.all([
-                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "survey_list" }, { headers }),
-                    axios.post("https://khg-marketing.info/dashboard/api/", { demand: "shop_list" }, { headers }),
-                ]);
-                await setOriginalList(customerRes.data);
-                await setShopList(shopRes.data);
+                // ⚠️ 2026-11-09: 旧 API（demand）から ② へ（Dashboard のトークンで。api.ts）
+                const [customers, shops] = await Promise.all([fetchCustomers(), fetchShops()]);
+                await setOriginalList(customers);
+                await setShopList(shops);
             } catch (error) {
                 console.error("データ取得エラー:", error);
             }
@@ -78,7 +75,8 @@
                 return;
             }
             if (window.confirm(`${registerName?.name}様の来場後アンケートを開始しますか?`)) {
-                await setUrl(`https://khg-marketing.info/survey/survey_after?id=new&shop=${encodeURIComponent(registerName.shop)}&name=${encodeURIComponent(registerName.name)}`);
+                // ⚠️ 2026-11-09: QR の URL に署名（7日間有効）を付ける（api.ts の surveyUrl。作れなくても URL は出す）
+                await setUrl(await surveyUrl('after', { id: 'new', shop: registerName.shop, name: registerName.name }));
                 await setShow(true);
             }
         } else {
@@ -89,7 +87,7 @@
             const filteredCustomer = customerList.find(item => item.id === registerName.id);
             const nameValue = filteredCustomer?.name ? filteredCustomer.name : '';
             if (window.confirm(`${filteredCustomer?.shop} ${filteredCustomer?.name}様の来場後アンケートを開始しますか?`)) {
-                await setUrl(`https://khg-marketing.info/survey/survey_after?id=${encodeURIComponent(registerName.id)}&shop=${encodeURIComponent(registerName.shop)}&name=${encodeURIComponent(nameValue)}`);
+                await setUrl(await surveyUrl('after', { id: registerName.id, shop: registerName.shop, name: nameValue }));
                 await setShow(true);
             }
         }
--- (控え) survey/src/components/SurveyBefore.tsx	2025-09-24 17:39:14.000000000 +0900
+++ survey/src/components/SurveyBefore.tsx	2026-11-09 17:31:33.477085900 +0900
@@ -1,6 +1,6 @@
 import { useState, useEffect } from "react";
 import { useLocation, useNavigate } from "react-router-dom";
-import axios from "axios";
+import { fetchCustomerMaster, fetchShopStaff, rememberLink } from "../api";
 import khLogo from '../assets/images/khLogo.png';
 import djhLogo from '../assets/images/djhLogo.png';
 import nieruLogo from '../assets/images/2lLogo.png';
@@ -11,7 +11,6 @@
 import type { MasterData } from "./MasterData";
 
 type Form = { id: string | undefined; name: string; kana: string; shop: string; staff: string; medium: string[]; interest: string[]; opportunity: string[]; plan: string; period: string; estate: string; area: string; importance: string[]; budget: string; support: string[]; demand: string }
-type Original = { name: string; id: string; shop: string; register: string; staff: string };
 type Staff = { id: number; name: string; pg_id: string; shop: string; mail: string; status: string; category: number };
 
 const Input = () => {
@@ -21,7 +20,8 @@
     const shopValue = params.get('shop');
     const staffValue = params.get('staff');
     const [staffList, setStaffList] = useState<Staff[]>([]);
-    const [originalList, setOriginalList] = useState<Original[]>([]);
+    // ⚠️ 2026-11-09: お客様の名前（以前はお客様全員の一覧を読んで探していた）
+    const [customerName, setCustomerName] = useState<string>('');
     const [form, setForm] = useState<Form>({
         name: '',
         kana: '',
@@ -51,30 +51,16 @@
     const [masterData, setMasterData] = useState<MasterData>(createEmptyMasterData());
 
     useEffect(() => {
-        const fetchData = async () => {
-            try {
-                const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                const customerRes = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "survey_list" }, { headers });
-                const staffRes = await axios.post("https://khg-marketing.info//dashboard/api/", { demand: "staff_list" }, { headers });
-                await setOriginalList(customerRes.data);
-                await setStaffList(staffRes.data);
-            } catch (error) {
-                console.error("データ取得エラー:", error);
-            }
-        };
-        fetchData();
+        // ⚠️ 2026-11-09: QR の URL の署名（t）を覚えてから読む（api.ts）。⚠️ 読めなくても空欄でアンケートは進められる
+        rememberLink(location.search);
+        fetchShopStaff(shopValue ?? '').then(list => setStaffList(list as unknown as Staff[]));
 
         if (idValue !== 'new') {
-            const fetchMasterData = async () => {
-                try {
-                    const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                    const customerRes = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "master_data_for_survey", id: idValue }, { headers });
-                    await setMasterData(customerRes.data);
-                } catch (error) {
-                    console.error("データ取得エラー:", error);
-                }
-            };
-            fetchMasterData();
+            fetchCustomerMaster().then(r => {
+                if (!r) return;
+                setCustomerName(r.name);
+                if (r.master) setMasterData(r.master as unknown as MasterData);
+            });
         }
 
         setForm(prev => ({
@@ -88,11 +74,11 @@
         const staffId = staffList.find(item => item.name === staffValue)?.pg_id;
         setForm(prev => ({
             ...prev,
-            name: originalList.find(item => item.id === form.id)?.name ?? '',
-            kana: originalList.find(item => item.id === form.id)?.name ?? '',
+            name: customerName,
+            kana: customerName,
             staff: staffId ?? ''
         }));
-    }, [originalList]);
+    }, [customerName, staffList]);
 
     useEffect(()=>{
         setForm(prev=>({
--- (控え) survey/src/components/SurveyBeforeInfo.tsx	2026-02-04 20:04:35.000000000 +0900
+++ survey/src/components/SurveyBeforeInfo.tsx	2026-11-09 17:31:33.480085300 +0900
@@ -1,6 +1,6 @@
 import { useLocation, useNavigate } from "react-router-dom";
 import { useState, useEffect } from "react";
-import axios from "axios";
+import { fetchCustomerMaster, saveBeforeAnswer } from "../api";
 import khLogo from '../assets/images/khLogo.png';
 import djhLogo from '../assets/images/djhLogo.png';
 import nieruLogo from '../assets/images/2lLogo.png';
@@ -141,14 +141,10 @@
     const [isSubmitting, setIsSubmitting] = useState<Boolean>(false);
 
     useEffect(() => {
+        // ⚠️ 2026-11-09: QR の署名で読む（api.ts）。⚠️ 読めなくても空欄で進められる
         const fetchData = async () => {
-            try {
-                const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                const customerRes = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "master_data_for_survey", id: data.id }, { headers });
-                await setMasterData(customerRes.data);
-            } catch (error) {
-                console.error("データ取得エラー:", error);
-            }
+            const r = await fetchCustomerMaster();
+            if (r?.master) setMasterData(r.master as unknown as MasterData);
         };
         if (data.id !== 'new') {
             fetchData();
@@ -215,16 +211,11 @@
             return;
         }
         if (form.id === 'new') {
-            const data = {
-                ...form,
-                request: 'before_interview'
-            };
-
-            try {
-                const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                await axios.post("https://khg-marketing.info/survey/api/", data, { headers });
-            } catch (error) {
-                console.error("データ取得エラー:", error);
+            // ⚠️ 2026-11-09: ② へ保存（届かなければ以前の /survey/api/ へ。api.ts）
+            if (!(await saveBeforeAnswer({ ...form }))) {
+                alert('送信できませんでした。通信状況をご確認のうえ、もう一度「送信」を押してください。');
+                setIsSubmitting(false);
+                return;
             }
 
             const postData = {
@@ -258,16 +249,11 @@
             }
             await navigate('/thanks');
         } else {
-            const data = {
-                ...form,
-                request: 'before_interview'
-            };
-
-            try {
-                const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                await axios.post("https://khg-marketing.info/survey/api/", data, { headers });
-            } catch (error) {
-                console.error("データ取得エラー:", error);
+            // ⚠️ 2026-11-09: ② へ保存（届かなければ以前の /survey/api/ へ。api.ts）
+            if (!(await saveBeforeAnswer({ ...form }))) {
+                alert('送信できませんでした。通信状況をご確認のうえ、もう一度「送信」を押してください。');
+                setIsSubmitting(false);
+                return;
             }
 
             const postData = {
--- (控え) survey/src/components/SurveyAfter.tsx	2026-07-17 10:07:46.000000000 +0900
+++ survey/src/components/SurveyAfter.tsx	2026-11-09 17:31:33.482743000 +0900
@@ -1,6 +1,6 @@
 import { useState, useEffect } from "react";
 import { useLocation, useNavigate } from "react-router-dom";
-import axios from "axios";
+import { fetchShopStaff, rememberLink, saveAfterAnswer } from "../api";
 import khLogo from '../assets/images/khLogo.png';
 import djhLogo from '../assets/images/djhLogo.png';
 import nieruLogo from '../assets/images/2lLogo.png';
@@ -43,19 +43,9 @@
     const [isSubmitting, setIsSubmitting] = useState<Boolean>(false);
 
     useEffect(() => {
-        const fetchData = async () => {
-            try {
-                const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                const [staffRes] = await Promise.all([
-                    axios.post("/dashboard/api/", { demand: "staff_list" }, { headers }),
-                ]);
-                await setStaffList(staffRes.data);
-            } catch (error) {
-                console.error("データ取得エラー:", error);
-            }
-        };
-
-        fetchData();
+        // ⚠️ 2026-11-09: QR の URL の署名（t）を覚え、その店舗の担当を読む（api.ts）。⚠️ 読めなくてもアンケートは進められる
+        rememberLink(location.search);
+        fetchShopStaff(shopValue ?? '').then(list => setStaffList(list as unknown as Staff[]));
         setForm(prev => ({
             ...prev,
             id: idValue as string,
@@ -86,17 +76,11 @@
             setIsSubmitting(false);
         } else {
             if (idValue === 'new') {
-                const data = {
-                    ...form,
-                    name: nameValue,
-                    request: 'after_interview'
-                };
-
-                try {
-                    const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                    await axios.post("https://khg-marketing.info/survey/api/", data, { headers });
-                } catch (error) {
-                    console.error("データ取得エラー:", error);
+                // ⚠️ 2026-11-09: ② へ保存（届かなければ以前の /survey/api/ へ。api.ts）
+                if (!(await saveAfterAnswer({ ...form, name: nameValue }))) {
+                    alert('送信できませんでした。通信状況をご確認のうえ、もう一度「送信」を押してください。');
+                    setIsSubmitting(false);
+                    return;
                 }
 
                 // const postData = {
@@ -122,17 +106,11 @@
                 // }
                 await navigate('/thanks');
             } else {
-                const data = {
-                    ...form,
-                    name: nameValue,
-                    request: 'after_interview'
-                };
-
-                try {
-                    const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                    await axios.post("https://khg-marketing.info/survey/api/", data, { headers });
-                } catch (error) {
-                    console.error("データ取得エラー:", error);
+                // ⚠️ 2026-11-09: ② へ保存（届かなければ以前の /survey/api/ へ。api.ts）
+                if (!(await saveAfterAnswer({ ...form, name: nameValue }))) {
+                    alert('送信できませんでした。通信状況をご確認のうえ、もう一度「送信」を押してください。');
+                    setIsSubmitting(false);
+                    return;
                 }
 
                 const postData = {
```

---

## 見直し（2026-11-09。利用者「大きな改修だったので、ログイン機能・バックエンド・画面の崩れを再度リファクタリング、評価、必要であれば修正」）
別のエージェントに先入観なしでコードを読んでもらい（読むだけ）、私は3つの幅（390・820・1280px）で全画面を撮って確かめた。

### 直したこと
| 重要度 | 指摘 | 直し方 |
|---|---|---|
| 高 | 既存のお客様の面談前アンケートを送るたびに、担当（in_charge_user）が空で上書きされる（既存のお客様の QR には担当が付かない。旧 PHP から引き継いだ不具合） | ② の master_data の更新で、担当・連絡先・勤務先などの任意の列は「空なら今の値を残す」（`COALESCE(NULLIF(?, ''), 列)`。public.ts の `keep`） |
| 高 | 「きっかけ」と「注文住宅に興味を持った理由」が、送るたびに入れ替わる（初期値の読み込みだけが逆。以前からの不具合） | SurveyBefore.tsx の読み込みを、表示・保存と同じ対応に（きっかけ＝house_hunting_motivation、理由＝customer_desired_order） |
| 中 | ② が保存したのに応答が届かないと、予備の旧 /survey/api/ にも送られて二重になる | ② で「同じ回答が30分以内にあれば2行目を入れない」（duplicate: true を返す）。survey は応答が無ければまず ② へもう一度送り、それでもだめなときだけ旧へ |
| 中 | 送りすぎ（429）のときだけ、お客様が送れない（お知らせも2回） | 429 でも旧へ回す（利用者の「送れない事態を避けたい」を優先）。お知らせは呼び出し側の1回だけ |
| 中 | 初期値を読めなかったとき、空欄のまま送ると連絡先が消える | 上の「空なら今の値を残す」で防ぐ |
| 中 | 新規のお客様の名前の前後の空白を消していた（あとで sync が name・shop で探す） | 名前は制御文字だけ落とし、空白は残す（clean.ts の `cleanRaw`） |
| 低 | 情報確認の画面を開き直すと、署名を失うことがある（sessionStorage が使えない端末） | 画面の受け渡し（navigate の state）にも署名を入れる（`linkToken`・`rememberLinkToken`） |
| 低 | 署名が使えないとき名前が空 | 以前の QR の URL にある name を使う |
| 低 | 情報確認の画面を直接開くと真っ白（以前から） | 「QR コードからもう一度開いてください」と出す |
| 低 | ボタンの連打で二重送信（以前から） | useRef で同じ描画の2回目を止める（② の重複の判定もある） |
| 低 | `/survey`（末尾の / 無し）からはログイン後に戻れない | `isSurveyReturn` を `/survey`・`/survey/…`・`/survey?…` に |
| 低 | 鍵（SURVEY_LINK_SECRET）が未設定でも気づけない | ② の起動時に1回だけ警告（値は出さない） |
| 低 | コメントと実装の食い違い（予備へ回す条件） | コメントを実装に合わせた |
| 画面 | QR の URL が 286 文字で、QR が細かい（スマホの面談後では 180px） | 署名の中身を種類・id・期限だけにし、署名は HMAC の先頭16バイトに。面談前の URL から使っていない name を外した → 183 文字（署名 86 文字） |
| 整理 | 署名の確かめを2回していた・日時を2回取っていた・選択肢を2回整えていた・型の重複 | `trustedLink` が理由も返す、`now` を1回、`cleanItems` を1回、`DynamicRow` を clean.ts に1つ |

### 直さずに残したこと（割り切り）
- ⚠️ 予備の送り先（旧 /survey/api/）は、画面に書いた合い言葉だけで書き込める（旧からそのまま。sync も使うので残す）。利用者の「お客様が送れない事態を避ける」を優先して、② に保存できないときの予備にしている。予備の経路では「署名が無ければ記録を上書きしない」が効かない
  - 将来の案：旧 /survey/api/ の before_interview で master_data の更新をやめる（サーバーの PHP の変更）
- スタッフの画面は、② がトークンの期限を見ていない（Dashboard 全体の方針と同じ。別の作業）
- after_interview の phone は '' を入れる（ローカルの表は既定値なしの NOT NULL。旧は列に書いていない）

### 確かめたこと（見直しのあと）
- API（`scratchpad/api_257.cjs`）：38項目すべて OK。足した確認は次のとおり
  - 同じ回答の2回目は duplicate で行が増えない（面談前・面談後）
  - 担当・電話が空でも今の値を残す
  - 名前の前後の空白を残す
  - 署名は100文字未満
- 画面（`scratchpad/pw_257.cjs`）：20項目すべて OK。足した確認は次のとおり
  - きっかけの初期値のチェックが house_hunting_motivation から付く
  - 送る値が入れ替わらない
  - 情報確認の画面を直接開くと案内が出る
  - 署名が短い
- 崩れ（`scratchpad/pw_257_layout.cjs`）：390・820・1280px で入口・面談前／面談後の検索・QR・お客様の面談前・面談後・お礼を撮った。横はみ出しなし・画面のエラー 0
- ⚠️ テストを続けて流すと、保存の流量の上限（30件/10分/IP）に掛かった。その状態でも、お客様の画面は予備へ回ってお礼の画面まで進んだ（429 でも送れることの確認になった）。数え直しのため ② を再起動して流し直した
- テストの行・一時スタッフは消した（0件）。survey のテスト用の一時設定は消した。開発サーバーは止めた
- survey をビルドし直した（`react/survey/dist`。2026-11-09 18:33）

### 見直しで変えたファイルの全文

#### backend-express/src/features/survey/public.ts
```ts
import { query, withTransaction } from '../../db/pool';
import { logger } from '../../utils/logger';
import { verifySurveyLink } from './link';
import type { SurveyKind, SurveyLink } from './link';
import { cleanItems, cleanLine, cleanObject, cleanRaw, cleanText, jstStamp } from './clean';
import type { DynamicRow } from './clean';

/**
 * 面談アンケート（survey）のお客様の画面（v2.2.257。`interview_survey_public:<roll>`。⚠️ auth: 'none'）。
 *
 * ─────────────────────────────────────────────
 * お客様は、スタッフが出した QR から自分のスマホで開く。Dashboard にはログインしていない。
 * 代わりに、QR の URL の `t`（interview_survey:link が作る署名。7日間有効。link.ts）で、そのお客様1人分だけを読み書きできる。
 *
 * ⚠️⚠️ **お客様がアンケートを開けない・送れない事態を避ける**（利用者の指示）。
 *   - 署名が無い・合わない・期限切れでも、アンケートは開け、回答は保存する。
 *   - ただしその場合は「お客様情報の読み込み」と「お客様の記録（master_data・customers）の更新」をしない。
 *     回答の行（before_interview・after_interview）だけを、URL の id で残す（スタッフが Dashboard で見られる）。
 *   - survey は ② に届かないとき、もう一度 ② へ送り、それでも届かなければ旧 /survey/api/ へ送る（survey の api.ts）。
 *     ⚠️ ② が保存したのに応答が届かなかった場合に備え、同じ回答が30分以内にあれば2行目は入れない。
 * ⚠️ 書き込みの中身は旧 `/survey/api/`（サーバーに残っている index.php）の before_interview・after_interview と同じ。
 *   ⚠️ `/survey/api/` は projects/sync（before_interview_register）が使うので、サーバーに残したまま。
 * ⚠️ 流量の上限は middlewares/publicFormRateLimit.ts（保存だけ。店舗の Wi-Fi で同じ IP になるので、フォームより緩い）。
 * ─────────────────────────────────────────────
 */

/** お客様の画面が使う master_data の列（旧 API は全列を返していた）。⚠️ 列名を SQL に埋め込むので、ここ以外の値を入れない */
const MASTER_COLUMNS = [
  'customer_contacts_name', 'customer_contacts_name_kana', 'customer_contacts_phone_number',
  'customer_contacts_mobile_phone_number', 'customer_contacts_email', 'customer_contacts_birth_date',
  'customer_contacts_employment_type', 'customer_contacts_employer_name', 'customer_contacts_employer_address',
  'customer_contacts_years_of_service', 'customer_contacts_annual_income',
  'postal_code', 'full_address', 'current_contract_type', 'current_rent', 'budget',
  'house_hunting_motivation', 'inquiry_reason', 'planned_construction_site',
  'customer_desired_floor', 'customer_desired_period', 'customer_desired_estate', 'customer_desired_order',
] as const;

const FAMILY_KEYS = ['name', 'kana', 'attribute', 'birth'] as const;
const EMPLOYMENT_KEYS = ['name', 'type', 'address', 'years', 'income'] as const;

/** 同じ回答の二重保存とみなす時間（survey の再送・予備への送信・ボタンの連打） */
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

/**
 * そのアンケートの署名として正しいか。⚠️ 種類が違う署名（面談後の QR で面談前を送る など）は使わない。
 * 使えないときの理由も返す（ログ用。⚠️ お客様の名前などはログに出さない）
 */
const trustedLink = (t: unknown, kind: SurveyKind): { link: SurveyLink | null; reason: string } => {
  const v = verifySurveyLink(t);
  if (!v.ok) return { link: null, reason: v.reason };
  return v.link.k === kind ? { link: v.link, reason: '' } : { link: null, reason: `kind:${v.link.k}` };
};

/**
 * お客様情報の読み込み（面談前アンケート・情報確認の初期値）。
 * 応答: { status: 'ok', name, master } ／ 新規のお客様は master: null ／
 *   署名が使えないときは { status: 'missing' | 'invalid' | 'expired' }（⚠️ 画面は止めずに空欄で進む）
 */
export const runSurveyPublicMaster = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const v = verifySurveyLink(body.t);
  if (!v.ok) return { status: v.reason };
  if (v.link.k !== 'before') return { status: 'invalid' };
  if (v.link.id === 'new') return { status: 'ok', name: '', master: null };
  const [customer] = await query<DynamicRow>('SELECT name FROM customers WHERE id = ? LIMIT 1', [v.link.id]);
  const [master] = await query<DynamicRow>(`SELECT ${MASTER_COLUMNS.join(', ')} FROM master_data WHERE id = ? LIMIT 1`, [v.link.id]);
  return { status: 'ok', name: customer ? String(customer.name ?? '') : '', master: master ?? null };
};

/**
 * 担当の一覧（面談前の新規の担当の pg_id・面談後の担当の選択肢）。⚠️ その店舗の名前だけ（署名は要らない）
 */
export const runSurveyPublicStaff = async (body: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
  const shop = cleanLine(body.shop, 100);
  if (shop === '') return [];
  return query<DynamicRow>('SELECT name, pg_id, shop, category, period FROM staff_list WHERE shop = ?', [shop]);
};

/** 空なら今の値を残す（master_data の任意の列。⚠️ 列名は下の SQL に書いた決まった名前だけ） */
const keep = (column: string): string => `${column} = COALESCE(NULLIF(?, ''), ${column})`;

/**
 * 面談前アンケートの保存（旧 `/survey/api/` の before_interview）。
 *   1. before_interview に1行（⚠️ いつも残す。⚠️ 同じ回答が30分以内にあれば2行目は入れない）
 *   2. 署名が正しく、新規でなければ: customers の before_interview = 1、master_data の連絡先・希望を更新（旧と同じ25列）
 *      ⚠️ 担当・連絡先・勤務先などの任意の列は、空なら今の値を残す
 *        （旧は空で上書きしていた。既存のお客様の QR には担当が付かず、初期値を読めなかったときは連絡先も空になるため）
 */
export const runSurveyPublicBefore = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const { link, reason } = trustedLink(body.t, 'before');
  const id = link ? link.id : cleanLine(body.id, 64) || 'new';
  const shop = cleanLine(body.shop, 100);
  // ⚠️ 名前は前後の空白も旧と同じに残す（新規のお客様を、あとで sync が name・shop で探すため）
  const name = cleanRaw(body.name, 100);
  const now = new Date();
  const employment = cleanObject(body.employment, EMPLOYMENT_KEYS);
  const family = [1, 2, 3, 4].map((n) => JSON.stringify(cleanObject(body[`family_member_${n}`], FAMILY_KEYS)));
  const medium = cleanItems(body.medium);
  const interest = cleanItems(body.interest);
  const opportunity = cleanItems(body.opportunity);
  const f = {
    plan: cleanLine(body.plan, 200), period: cleanLine(body.period, 200), estate: cleanLine(body.estate, 200),
    area: cleanLine(body.area, 300), importance: cleanItems(body.importance).join(', '), budget: cleanLine(body.budget, 100),
    support: cleanItems(body.support).join(', '), demand: cleanText(body.demand, 2000), kana: cleanLine(body.kana, 100),
    phone: cleanLine(body.phone, 30), mail: cleanLine(body.mail, 200), mobile: cleanLine(body.mobile, 30),
    zip: cleanLine(body.zip, 10), address: cleanLine(body.address, 300), rent: cleanLine(body.rent, 50),
    birth: cleanLine(body.birth, 20), situation: cleanLine(body.situation, 100), staff: cleanLine(body.staff, 64),
  };

  const result = await withTransaction(async (tx) => {
    const [dup] = await tx.query<DynamicRow>(
      'SELECT no FROM before_interview WHERE id = ? AND shop = ? AND name = ? AND medium = ? AND demand = ? AND created_at >= ? LIMIT 1',
      [id, shop, name, medium.join(', '), f.demand, jstStamp(new Date(now.getTime() - DUPLICATE_WINDOW_MS))]
    );
    if (dup) return { linked: !!link && id !== 'new', duplicate: true };
    await tx.execute(
      `INSERT INTO before_interview (id, name, shop, medium, interest, opportunity, plan, period, estate, area, importance, budget, support, demand,
         kana, phone, mail, mobile, zip, address, rent, birth, situation, family_member_1, family_member_2, family_member_3, family_member_4,
         employment, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, shop, medium.join(', '), interest.join(', '), opportunity.join(', '), f.plan, f.period, f.estate, f.area, f.importance,
        f.budget, f.support, f.demand, f.kana, f.phone, f.mail, f.mobile, f.zip, f.address, f.rent, f.birth, f.situation, ...family,
        JSON.stringify(employment), jstStamp(now)]
    );
    if (!link || id === 'new') return { linked: false, duplicate: false };
    await tx.execute('UPDATE customers SET before_interview = 1 WHERE id = ?', [id]);
    // ⚠️ 旧と同じく、master_data は区切りに ','（before_interview は ', '）。
    // ⚠️ きっかけ（opportunity）→ house_hunting_motivation、興味を持った理由（interest）→ customer_desired_order（旧と同じ。画面の初期値もこの対応）
    await tx.execute(
      `UPDATE master_data SET customer_contacts_name = ?, ${keep('in_charge_user')}, first_interviewed_date = ?, ${keep('full_address')},
         ${keep('customer_contacts_name_kana')}, ${keep('customer_contacts_phone_number')}, ${keep('customer_contacts_mobile_phone_number')},
         ${keep('customer_contacts_email')}, ${keep('customer_contacts_birth_date')}, ${keep('customer_contacts_employment_type')},
         ${keep('customer_contacts_employer_name')}, ${keep('customer_contacts_employer_address')}, ${keep('customer_contacts_years_of_service')},
         ${keep('customer_contacts_annual_income')}, ${keep('postal_code')}, ${keep('current_contract_type')}, ${keep('current_rent')}, budget = ?,
         house_hunting_motivation = ?, inquiry_reason = ?, planned_construction_site = ?, customer_desired_floor = ?,
         customer_desired_period = ?, customer_desired_estate = ?, customer_desired_order = ?
       WHERE id = ?`,
      [name, f.staff, jstStamp(now).slice(0, 10), f.address, f.kana, f.phone, f.mobile, f.mail, f.birth,
        employment.type, employment.name, employment.address, employment.years, employment.income,
        f.zip, f.situation, f.rent, f.budget,
        opportunity.join(','), medium.join(','), f.area, f.plan, f.period, f.estate, interest.join(','),
        id]
    );
    return { linked: true, duplicate: false };
  });
  if (!result.linked && id !== 'new') logger.warn('[survey] 面談前アンケート: リンクの署名が使えないため、回答だけを保存しました', { id, shop, reason });
  return { status: 'success', ...result };
};

/**
 * 面談後アンケートの保存（旧 `/survey/api/` の after_interview）。
 *   1. after_interview に1行（⚠️ いつも残す。⚠️ 同じ回答が30分以内にあれば2行目は入れない）
 *   2. 署名が正しく、新規でなければ: customers の after_interview = 1
 */
export const runSurveyPublicAfter = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const { link, reason } = trustedLink(body.t, 'after');
  const id = link ? link.id : cleanLine(body.id, 64) || 'new';
  const shop = cleanLine(body.shop, 100);
  const name = cleanRaw(body.name, 100);
  const now = new Date();
  const told = cleanItems(body.toldInformation).join(', ');
  const demand = cleanText(body.demand, 2000);

  const result = await withTransaction(async (tx) => {
    // ⚠️ dateStr は 'YYYY/MM/DD HH:mm:ss' の文字（旧と同じ）なので、文字のまま比べられる
    const [dup] = await tx.query<DynamicRow>(
      'SELECT no FROM after_interview WHERE id = ? AND shop = ? AND name = ? AND interviewFeedback = ? AND nextConsultationRequests = ? AND dateStr >= ? LIMIT 1',
      [id, shop, name, told, demand, jstStamp(new Date(now.getTime() - DUPLICATE_WINDOW_MS))]
    );
    if (dup) return { linked: !!link && id !== 'new', duplicate: true };
    // ⚠️ phone は旧では書いていない列（ローカルの表は既定値なしの NOT NULL なので '' を入れる）
    await tx.execute(
      `INSERT INTO after_interview (id, dateStr, shop, name, phone, interviewFeedback, confirmedAllItems, desireOwnership, priorityCondition,
         ourCompanyFirstChoice, otherCompaniesInterested, staffName, staffHospitality, proposalFeedback, moreInfoOrImprovements,
         nextConsultationRequests, changeStaffRequested)
       VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, jstStamp(now), shop, name, told, cleanLine(body.desired, 200), cleanLine(body.condition, 200),
        cleanLine(body.importance, 200), cleanLine(body.priority, 200), cleanText(body.rival, 1000), cleanLine(body.staff, 100),
        cleanLine(body.staffSatisfied, 200), cleanLine(body.interviewSatisfied, 200), cleanText(body.improvement, 2000),
        demand, cleanLine(body.staffChange, 200)]
    );
    if (!link || id === 'new') return { linked: false, duplicate: false };
    await tx.execute('UPDATE customers SET after_interview = 1 WHERE id = ?', [id]);
    return { linked: true, duplicate: false };
  });
  if (!result.linked && id !== 'new') logger.warn('[survey] 面談後アンケート: リンクの署名が使えないため、回答だけを保存しました', { id, shop, reason });
  return { status: 'success', ...result };
};
```

#### backend-express/src/features/survey/clean.ts
```ts
import type { RowDataPacket } from 'mysql2/promise';

/**
 * 面談アンケート（survey）の値の整え方（v2.2.257）。
 * ⚠️ お客様の端末から届く値は信用しない（features/beforeSurvey/entry.ts と同じ考え方）。長さで切り、制御文字を落とす。
 */

/** SELECT の1行（staff.ts・public.ts） */
export interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** 制御文字（改行を含む） */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
/** 制御文字（改行は残す） */
const CONTROL_CHARS_KEEP_NEWLINE = /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g;

const asText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';

/** 1行の文字 */
export const cleanLine = (value: unknown, max: number): string =>
  asText(value).replace(CONTROL_CHARS, '').trim().slice(0, max);

/**
 * 1行の文字（⚠️ 前後の空白を残す）。お客様の名前用。
 *   ⚠️ 新規のお客様は、あとで projects/sync が before_interview を name・shop で探す。heroku へは加工しない名前が届くので、そろえる
 */
export const cleanRaw = (value: unknown, max: number): string =>
  asText(value).replace(CONTROL_CHARS, '').slice(0, max);

/** 複数行の文字（自由記入） */
export const cleanText = (value: unknown, max: number): string =>
  asText(value).replace(/\r\n?/g, '\n').replace(CONTROL_CHARS_KEEP_NEWLINE, '').trim().slice(0, max);

/** 選択肢の配列（空を除く）。配列でなければ1つの文字として扱う。区切り（', ' か ','）は呼び出し側で join する（旧 PHP の implode） */
export const cleanItems = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).map((v) => cleanLine(v, 200)).filter((v) => v !== '').slice(0, 30);

/** 決まった項目だけを持つオブジェクト（家族・勤務先）。⚠️ 知らない項目は捨てる */
export const cleanObject = (value: unknown, keys: readonly string[], max = 200): Record<string, string> => {
  const src = value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(keys.map((k) => [k, cleanLine(src[k], max)]));
};

/** 日本時間の 'YYYY/MM/DD HH:mm:ss'（旧 PHP の date('Y/m/d H:i:s')） */
export const jstStamp = (now = new Date()): string => {
  const d = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString();
  return `${d.slice(0, 10).replace(/-/g, '/')} ${d.slice(11, 19)}`;
};
```

#### backend-express/src/features/survey/link.ts
```ts
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * 面談アンケート（survey）のお客様用リンクの署名（v2.2.257）。
 *
 * ─────────────────────────────────────────────
 * スタッフが QR を出すとき（interview_survey:link。スタッフのトークンが要る）に、② が「どのお客様の・どちらのアンケートか・いつまで有効か」を
 * 署名して渡す。お客様の端末は Dashboard にログインしていないので、この署名だけで、そのお客様1人分を読み書きできる。
 *   ⚠️ 以前は id を書き換えるだけで、誰の個人情報でも読めた（旧 API の master_data_for_survey）。
 * 形: base64url(JSON の中身) + '.' + base64url(HMAC-SHA256)
 * ⚠️ 中身は種類・id・期限だけ。署名は HMAC の先頭 16 バイト（128 ビット）。
 *   QR が細かくなりすぎて読み取りにくくならないよう、短くしている（店舗・名前は URL に別にある。どちらも秘密ではない）
 * ⚠️ 期限は7日（利用者の決定。後日、自宅で回答する場合があるため）。
 * ⚠️ 署名が無い・合わない・期限切れでも、お客様の画面は止めない（呼び出し側。public.ts）。
 * ─────────────────────────────────────────────
 */

export type SurveyKind = 'before' | 'after';

export interface SurveyLink {
  /** before = 面談前アンケート／after = 面談後アンケート */
  k: SurveyKind;
  /** customers.id・master_data.id。新規のお客様は 'new' */
  id: string;
  /** 期限（UNIX 秒） */
  exp: number;
}

export const LINK_TTL_SECONDS = 7 * 24 * 60 * 60;

const b64 = (buf: Buffer): string => buf.toString('base64url');

/**
 * 署名の鍵。⚠️ SURVEY_LINK_SECRET が無ければ DB の接続情報から作る（.env の設定忘れでお客様が開けなくならないように）。
 * ⚠️ 鍵そのものはログにも応答にも出さない。
 */
const secret = (): Buffer =>
  env.surveyLinkSecret !== ''
    ? Buffer.from(env.surveyLinkSecret, 'utf8')
    : createHash('sha256').update(`survey-link|${env.db.user}|${env.db.password}|${env.db.database}`).digest();

// ⚠️ 鍵の設定忘れに気づけるよう、起動時に1回だけ知らせる（⚠️ 値は出さない）
if (env.surveyLinkSecret === '') logger.warn('[survey] SURVEY_LINK_SECRET が未設定のため、DB の接続情報から作った鍵で QR に署名します');

const sign = (body: string): string => b64(createHmac('sha256', secret()).update(body).digest().subarray(0, 16));

/** リンクの署名を作る */
export const issueSurveyLink = (link: Omit<SurveyLink, 'exp'>, now = Date.now()): { token: string; exp: number } => {
  const exp = Math.floor(now / 1000) + LINK_TTL_SECONDS;
  const body = b64(Buffer.from(JSON.stringify({ ...link, exp }), 'utf8'));
  return { token: `${body}.${sign(body)}`, exp };
};

export type VerifyResult =
  | { ok: true; link: SurveyLink }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' };

/** リンクの署名を確かめる。⚠️ 比べるのは timingSafeEqual（長さが違うと例外なので先に比べる） */
export const verifySurveyLink = (token: unknown, now = Date.now()): VerifyResult => {
  if (typeof token !== 'string' || token === '') return { ok: false, reason: 'missing' };
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return { ok: false, reason: 'invalid' };
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(sign(body), 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'invalid' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const p = parsed as Partial<SurveyLink>;
  if ((p.k !== 'before' && p.k !== 'after') || typeof p.id !== 'string' || typeof p.exp !== 'number') {
    return { ok: false, reason: 'invalid' };
  }
  if (p.exp * 1000 < now) return { ok: false, reason: 'expired' };
  return { ok: true, link: { k: p.k, id: p.id, exp: p.exp } };
};
```

#### react/survey/src/api.ts
```ts
import axios from 'axios';

/**
 * 面談アンケートの通信（2026-11-09。Dashboard v2.2.257 と組み）。
 *
 * ─────────────────────────────────────────────
 * スタッフの画面（入口・面談前／面談後の検索・QR）
 *   - Dashboard（同じ khg-marketing.info）にログインしたときのトークン（localStorage の token）で、① /dashboard/api/ を通して ② へ。
 *   - トークンが無い・期限切れ（401）なら、Dashboard のログイン画面へ。Google でログインすると、元の画面へ戻る。
 * お客様の画面（QR から開く。ログインしていない）
 *   - QR の URL の t（② が作る署名。7日間有効）を付けて、② へ直接送る（api.khg-marketing.info）。
 *   - ⚠️⚠️ お客様が開けない・送れない事態を避ける（利用者の指示）:
 *     ・署名が無い・期限切れでも、アンケートは開ける（お客様情報の初期値が入らないだけ）。② は回答を保存する。
 *     ・保存は ② へ送り、応答が無ければもう一度送る。それでも保存できなければ（送りすぎで断られたときも）、
 *       サーバーに残っている旧 /survey/api/ へ、以前と同じ形で送り直す（saveAnswer）。
 * ─────────────────────────────────────────────
 */

const DASHBOARD_API = import.meta.env.VITE_DASHBOARD_API ?? '/dashboard/api/';
const DASHBOARD_LOGIN = import.meta.env.VITE_DASHBOARD_LOGIN ?? '/dashboard/login';
const GATEWAY = import.meta.env.VITE_GATEWAY ?? 'https://api.khg-marketing.info/api/gateway';
/** ⚠️ 予備の送り先（旧）。② に届かないときだけ使う。⚠️ projects/sync も使っているのでサーバーに残っている */
const OLD_SURVEY_API = 'https://khg-marketing.info/survey/api/';
const OLD_SURVEY_KEY = '<共有キー>';
const TIMEOUT_MS = 20000;

// ---------------------------------------------------------------------------
// スタッフの画面
// ---------------------------------------------------------------------------

const readToken = (): string => {
    try {
        return localStorage.getItem('token') ?? '';
    } catch {
        return '';
    }
};

export const hasStaffToken = (): boolean => readToken() !== '';

/** Dashboard のログイン画面へ（ログイン後、今の画面に戻る） */
export const goDashboardLogin = (): void => {
    window.location.assign(`${DASHBOARD_LOGIN}?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
};

const isStatus = (e: unknown, code: number): boolean => axios.isAxiosError(e) && e.response?.status === code;

/** ① /dashboard/api/ へ（Dashboard のトークン付き）。⚠️ 401 ならログイン画面へ移り、例外を投げる */
const dashboardPost = async <T>(body: Record<string, unknown>): Promise<T> => {
    const token = readToken();
    if (token === '') {
        goDashboardLogin();
        throw new Error('Dashboard にログインしていません');
    }
    try {
        const res = await axios.post(DASHBOARD_API, body, { headers: { 'Content-Type': 'application/json', Token: token }, timeout: TIMEOUT_MS });
        return res.data as T;
    } catch (e) {
        if (isStatus(e, 401)) goDashboardLogin();
        throw e;
    }
};

export type SurveyCustomer = { id: string; name: string; register: string; shop: string; staff: string };
export type SurveyStaff = { id?: number; name: string; pg_id: string; shop: string; category: number; period?: string | number };
export type SurveyShop = { brand: string; shop: string; section: string; area: string; division?: string };

export const fetchCustomers = () => dashboardPost<SurveyCustomer[]>({ request: 'interview_survey', roll: 'customers' });
export const fetchStaff = () => dashboardPost<SurveyStaff[]>({ request: 'interview_survey', roll: 'staff' });
export const fetchShops = () => dashboardPost<SurveyShop[]>({ request: 'shop_list' });

/**
 * お客様用 QR の URL。⚠️ 署名（t）を足す。署名を作れなくても、t の無い URL を返す（お客様は開ける。回答は保存される）。
 * kind: before＝面談前／after＝面談後。params は以前の URL と同じ値（id・shop・staff・name）
 */
export const surveyUrl = async (kind: 'before' | 'after', params: { id: string; shop: string; staff?: string; name?: string }): Promise<string> => {
    const q = new URLSearchParams({ id: params.id, shop: params.shop });
    if (params.staff) q.set('staff', params.staff);
    // ⚠️ name は面談後だけ（面談前の画面は URL の name を使わない。QR が細かくなりすぎないよう、要らない値は入れない）
    if (kind === 'after' && params.name !== undefined) q.set('name', params.name);
    try {
        const r = await dashboardPost<{ status: string; token?: string }>({ request: 'interview_survey', roll: 'link', kind, id: params.id, shop: params.shop });
        if (r.status === 'success' && r.token) q.set('t', r.token);
        else console.error('[survey] QR の署名を作れませんでした（署名なしの URL を出します）', r);
    } catch (e) {
        console.error('[survey] QR の署名を作れませんでした（署名なしの URL を出します）', e);
    }
    return `https://khg-marketing.info/survey/survey_${kind}?${q.toString()}`;
};

// ---------------------------------------------------------------------------
// お客様の画面
// ---------------------------------------------------------------------------

const LINK_KEY = 'survey_link_t';
let memoryLink = '';

/**
 * 署名（t）を覚える（面談前 → 情報確認は画面を移ると URL から消えるので、ここで持つ）。⚠️ 保存できない端末でもメモリに持つ。
 * ⚠️ 情報確認の画面へは、画面の受け渡し（navigate の state）にも linkToken() を入れて渡す（開き直したときのため）
 */
export const rememberLinkToken = (t: string): void => {
    memoryLink = t;
    try {
        sessionStorage.setItem(LINK_KEY, t);
    } catch {
        // 保存できなくても続ける
    }
};

/** URL の t を覚える（お客様の画面を開いたとき） */
export const rememberLink = (search: string): void => rememberLinkToken(new URLSearchParams(search).get('t') ?? '');

/** 今の署名 */
export const linkToken = (): string => {
    if (memoryLink) return memoryLink;
    try {
        return sessionStorage.getItem(LINK_KEY) ?? '';
    } catch {
        return '';
    }
};

const publicPost = async <T>(roll: string, body: Record<string, unknown>): Promise<T> => {
    const res = await axios.post(GATEWAY, { ...body, request: 'interview_survey_public', roll, t: linkToken() },
        { headers: { 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS });
    return res.data as T;
};

/**
 * お客様情報の初期値。⚠️ 失敗・署名なし・期限切れでも null を返すだけ（画面は空欄で進む）
 */
export const fetchCustomerMaster = async (): Promise<{ name: string; master: Record<string, string> | null } | null> => {
    try {
        const r = await publicPost<{ status: string; name?: string; master?: Record<string, string> | null }>('master', {});
        if (r.status !== 'ok') {
            console.warn('[survey] お客様情報を読めませんでした（空欄で進みます）', r.status);
            return null;
        }
        return { name: r.name ?? '', master: r.master ?? null };
    } catch (e) {
        console.error('[survey] お客様情報を読めませんでした（空欄で進みます）', e);
        return null;
    }
};

/** その店舗の担当。⚠️ 失敗しても空の配列（画面は止めない） */
export const fetchShopStaff = async (shop: string): Promise<SurveyStaff[]> => {
    try {
        const r = await publicPost<SurveyStaff[]>('staff', { shop });
        return Array.isArray(r) ? r : [];
    } catch (e) {
        console.error('[survey] 担当の一覧を読めませんでした', e);
        return [];
    }
};

/** ② から応答が無かったか（通信の失敗・時間切れ・500 番台）。⚠️ 保存できていて応答だけが届かなかった場合もある */
const noAnswer = (e: unknown): boolean =>
    !axios.isAxiosError(e) || !e.response || e.response.status >= 500;

/** ② へ送る。保存できたら true。⚠️ 応答が無ければもう一度だけ送る（② は同じ回答が30分以内にあれば2行目を入れないので、二重にならない） */
const saveToGateway = async (roll: 'before' | 'after', form: Record<string, unknown>): Promise<boolean> => {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const r = await publicPost<{ status?: string }>(roll, form);
            if (r.status === 'success') return true;
            console.error('[survey] 回答を保存できませんでした', r);
            return false;
        } catch (e) {
            console.error(`[survey] 回答を保存できませんでした（${attempt}回目）`, e);
            if (!noAnswer(e)) return false;
        }
    }
    return false;
};

/**
 * 回答の保存。② へ送り（応答が無ければもう一度）、それでも保存できなければ旧 /survey/api/ へ同じ内容で送り直す。
 * ⚠️⚠️ お客様が送れない事態を避けるため、送りすぎ（429）など ② が断ったときも旧へ送る（利用者の指示）。
 * 戻り値: true＝保存できた／false＝どちらにも保存できなかった（呼び出し側でお知らせする。⚠️ ここではお知らせを出さない）
 */
const saveAnswer = async (roll: 'before' | 'after', oldRequest: string, form: Record<string, unknown>): Promise<boolean> => {
    if (await saveToGateway(roll, form)) return true;
    console.error('[survey] 新しい送り先に保存できないため、以前の送り先へ送ります');
    try {
        await axios.post(OLD_SURVEY_API, { ...form, request: oldRequest },
            { headers: { Authorization: OLD_SURVEY_KEY, 'Content-Type': 'application/json' }, timeout: TIMEOUT_MS });
        return true;
    } catch (e) {
        console.error('[survey] 以前の送り先にも保存できませんでした', e);
        return false;
    }
};

export const saveBeforeAnswer = (form: Record<string, unknown>) => saveAnswer('before', 'before_interview', form);
export const saveAfterAnswer = (form: Record<string, unknown>) => saveAnswer('after', 'after_interview', form);
```

### 見直しの git diff（Dashboard。push 済みの 0522685b9 との差）
```diff
diff --git a/backend-express/src/features/survey/staff.ts b/backend-express/src/features/survey/staff.ts
index 4279c781b..a1b9ff42b 100644
--- a/backend-express/src/features/survey/staff.ts
+++ b/backend-express/src/features/survey/staff.ts
@@ -1,8 +1,8 @@
-import type { RowDataPacket } from 'mysql2/promise';
 import { query } from '../../db/pool';
 import { issueSurveyLink } from './link';
 import type { SurveyKind } from './link';
 import { cleanLine } from './clean';
+import type { DynamicRow } from './clean';
 
 /**
  * 面談アンケート（survey。khg-marketing.info/survey/）のスタッフの画面（v2.2.257。`interview_survey:<roll>`。auth: 'staff'）。
@@ -16,10 +16,6 @@ import { cleanLine } from './clean';
  * ─────────────────────────────────────────────
  */
 
-interface DynamicRow extends RowDataPacket {
-  [key: string]: unknown;
-}
-
 /** 検索の一覧（旧 survey_list と同じ列・同じ並び） */
 export const runSurveyCustomers = async (): Promise<Record<string, unknown>[]> =>
   query<DynamicRow>('SELECT name, id, shop, register, staff FROM customers ORDER BY register DESC');
@@ -37,6 +33,6 @@ export const runSurveyLink = (body: Record<string, unknown>): Record<string, unk
   const id = cleanLine(body.id, 64);
   const shop = cleanLine(body.shop, 100);
   if (!kind || id === '' || shop === '') return { status: 'error', message: 'アンケートの種類・お客様・店舗を指定してください。' };
-  const { token, exp } = issueSurveyLink({ k: kind, id, shop });
+  const { token, exp } = issueSurveyLink({ k: kind, id });
   return { status: 'success', token, exp };
 };
diff --git a/frontend/src/components/Login.tsx b/frontend/src/components/Login.tsx
index 56eea7c76..b73d5de02 100644
--- a/frontend/src/components/Login.tsx
+++ b/frontend/src/components/Login.tsx
@@ -13,10 +13,10 @@ type Value = { mail: string, password: string, error: string };
 
 /**
  * ⚠️ v2.2.257: ログイン後に戻ってよい面談アンケート（survey）の道か。
- *   '/survey/' で始まり、'//'・'\'・制御文字を含まないものだけ（ほかのサイトへ飛ばす罠のリンクを防ぐ）
+ *   '/survey'・'/survey/…'・'/survey?…' で、'//'・'\'・制御文字を含まないものだけ（ほかのサイトへ飛ばす罠のリンクを防ぐ）
  */
 export const isSurveyReturn = (path: string): boolean =>
-  path.startsWith('/survey/') && !path.includes('//') && !path.includes('\\') && !/[\u0000-\u001F]/.test(path);
+  /^\/survey(\/|\?|$)/.test(path) && !path.includes('//') && !path.includes('\\') && !/[\u0000-\u001F]/.test(path);
 
 const Login = () => {
   const [validationMessage, setValidationMessage] = useState<Value>({
@@ -67,7 +67,7 @@ const Login = () => {
           const redirectUrl = searchParams.get('redirect');
 
           // ⚠️ v2.2.257: 面談アンケート（survey。同じ khg-marketing.info の別アプリ）から来たときは、ログイン後に元の画面へ戻す。
-          //   ⚠️ '/survey/' で始まる同じサイトの道だけ（'//' や 'http' で始まる値でほかのサイトへ飛ばされないように）
+          //   ⚠️ '/survey' で始まる同じサイトの道だけ（'//' や 'http' で始まる値でほかのサイトへ飛ばされないように。isSurveyReturn）
           if (redirectUrl && isSurveyReturn(redirectUrl)) {
             // ⚠️ AuthProvider の保存（useEffect）より先にページを離れるので、ここで保存してから移る
             try {
```

### 見直しの survey の差分（直す前の控えとの比較。画面のファイル）
```diff
--- (控え) survey/src/components/SurveyBefore.tsx	2025-09-24 17:39:14.000000000 +0900
+++ /c/Users/shinji-kawano/react/survey/src/components/SurveyBefore.tsx	2026-11-09 18:20:59.126562800 +0900
@@ -1,6 +1,6 @@
 import { useState, useEffect } from "react";
 import { useLocation, useNavigate } from "react-router-dom";
-import axios from "axios";
+import { fetchCustomerMaster, fetchShopStaff, linkToken, rememberLink } from "../api";
 import khLogo from '../assets/images/khLogo.png';
 import djhLogo from '../assets/images/djhLogo.png';
 import nieruLogo from '../assets/images/2lLogo.png';
@@ -11,7 +11,6 @@
 import type { MasterData } from "./MasterData";
 
 type Form = { id: string | undefined; name: string; kana: string; shop: string; staff: string; medium: string[]; interest: string[]; opportunity: string[]; plan: string; period: string; estate: string; area: string; importance: string[]; budget: string; support: string[]; demand: string }
-type Original = { name: string; id: string; shop: string; register: string; staff: string };
 type Staff = { id: number; name: string; pg_id: string; shop: string; mail: string; status: string; category: number };
 
 const Input = () => {
@@ -21,7 +20,8 @@
     const shopValue = params.get('shop');
     const staffValue = params.get('staff');
     const [staffList, setStaffList] = useState<Staff[]>([]);
-    const [originalList, setOriginalList] = useState<Original[]>([]);
+    // ⚠️ 2026-11-09: お客様の名前（以前はお客様全員の一覧を読んで探していた）
+    const [customerName, setCustomerName] = useState<string>('');
     const [form, setForm] = useState<Form>({
         name: '',
         kana: '',
@@ -51,30 +51,17 @@
     const [masterData, setMasterData] = useState<MasterData>(createEmptyMasterData());
 
     useEffect(() => {
-        const fetchData = async () => {
-            try {
-                const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                const customerRes = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "survey_list" }, { headers });
-                const staffRes = await axios.post("https://khg-marketing.info//dashboard/api/", { demand: "staff_list" }, { headers });
-                await setOriginalList(customerRes.data);
-                await setStaffList(staffRes.data);
-            } catch (error) {
-                console.error("データ取得エラー:", error);
-            }
-        };
-        fetchData();
+        // ⚠️ 2026-11-09: QR の URL の署名（t）を覚えてから読む（api.ts）。⚠️ 読めなくても空欄でアンケートは進められる
+        rememberLink(location.search);
+        fetchShopStaff(shopValue ?? '').then(list => setStaffList(list as unknown as Staff[]));
 
         if (idValue !== 'new') {
-            const fetchMasterData = async () => {
-                try {
-                    const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                    const customerRes = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "master_data_for_survey", id: idValue }, { headers });
-                    await setMasterData(customerRes.data);
-                } catch (error) {
-                    console.error("データ取得エラー:", error);
-                }
-            };
-            fetchMasterData();
+            fetchCustomerMaster().then(r => {
+                // ⚠️ 読めないとき（署名なし・期限切れ）は、以前の QR の URL にある name を使う（無ければ情報確認の画面で入力する）
+                if (!r) { setCustomerName(params.get('name') ?? ''); return; }
+                setCustomerName(r.name);
+                if (r.master) setMasterData(r.master as unknown as MasterData);
+            });
         }
 
         setForm(prev => ({
@@ -88,18 +75,20 @@
         const staffId = staffList.find(item => item.name === staffValue)?.pg_id;
         setForm(prev => ({
             ...prev,
-            name: originalList.find(item => item.id === form.id)?.name ?? '',
-            kana: originalList.find(item => item.id === form.id)?.name ?? '',
+            name: customerName,
+            kana: customerName,
             staff: staffId ?? ''
         }));
-    }, [originalList]);
+    }, [customerName, staffList]);
 
     useEffect(()=>{
         setForm(prev=>({
             ...prev,
             medium: masterData.inquiry_reason ? masterData.inquiry_reason.split(',') : [], 
-            opportunity: masterData.customer_desired_order ? masterData.customer_desired_order.split(',') : [], 
-            interest: masterData.house_hunting_motivation ? masterData.house_hunting_motivation.split(',') : [],
+            // ⚠️ 2026-11-09: きっかけ（opportunity）は house_hunting_motivation、興味を持った理由（interest）は customer_desired_order。
+            //   チェックの表示と保存（② の public.ts・旧 /survey/api/）はこの対応。以前は読み込みだけが逆で、送るたびに2つが入れ替わっていた
+            opportunity: masterData.house_hunting_motivation ? masterData.house_hunting_motivation.split(',') : [], 
+            interest: masterData.customer_desired_order ? masterData.customer_desired_order.split(',') : [],
             plan: masterData.customer_desired_floor ? masterData.customer_desired_floor : '',
             period: masterData.customer_desired_period ? masterData.customer_desired_period : '',
             estate: masterData.customer_desired_estate ? masterData.customer_desired_estate : '',
@@ -130,7 +119,8 @@
             await alert(`必須項目のうち${emptyKeys.length}項目が未回答です`);
             return;
         }
-        navigate('/survey_before_info', { state: form });
+        // ⚠️ 2026-11-09: 署名も渡す（情報確認の画面を開き直したときに、署名を失わないように）
+        navigate('/survey_before_info', { state: { ...form, t: linkToken() } });
     };
 
     return (
--- (控え) survey/src/components/SurveyBeforeInfo.tsx	2026-02-04 20:04:35.000000000 +0900
+++ /c/Users/shinji-kawano/react/survey/src/components/SurveyBeforeInfo.tsx	2026-11-09 18:23:47.028070800 +0900
@@ -1,6 +1,6 @@
 import { useLocation, useNavigate } from "react-router-dom";
-import { useState, useEffect } from "react";
-import axios from "axios";
+import { useState, useEffect, useRef } from "react";
+import { fetchCustomerMaster, rememberLinkToken, saveBeforeAnswer } from "../api";
 import khLogo from '../assets/images/khLogo.png';
 import djhLogo from '../assets/images/djhLogo.png';
 import nieruLogo from '../assets/images/2lLogo.png';
@@ -71,7 +71,8 @@
 
 const SurveyBeforeInfo = () => {
     const location = useLocation();
-    const data: Form = location.state;
+    // ⚠️ 2026-11-09: 直接開いたとき（面談前アンケートから来ていない）は state が無い。以前は data.id で真っ白になっていた
+    const data: (Form & { t?: string }) | null = location.state ?? null;
     const createEmptyMasterData = (): MasterData => {
         const keys = Object.keys({} as MasterData) as (keyof MasterData)[];
         return keys.reduce((acc, key) => {
@@ -139,17 +140,18 @@
     });
     const navigate = useNavigate();
     const [isSubmitting, setIsSubmitting] = useState<Boolean>(false);
+    // ⚠️ 2026-11-09: 連打の二重送信を防ぐ（state は次の描画まで変わらないので、同じ描画のうちの2回目を止められない）
+    const submitting = useRef(false);
 
     useEffect(() => {
+        // ⚠️ 2026-11-09: QR の署名で読む（api.ts）。⚠️ 読めなくても空欄で進められる
         const fetchData = async () => {
-            try {
-                const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                const customerRes = await axios.post("https://khg-marketing.info/dashboard/api/", { demand: "master_data_for_survey", id: data.id }, { headers });
-                await setMasterData(customerRes.data);
-            } catch (error) {
-                console.error("データ取得エラー:", error);
-            }
+            const r = await fetchCustomerMaster();
+            if (r?.master) setMasterData(r.master as unknown as MasterData);
         };
+        if (!data) return;
+        // ⚠️ 面談前アンケートから渡された署名を使う（この画面を開き直したときも失わない）
+        if (data.t) rememberLinkToken(data.t);
         if (data.id !== 'new') {
             fetchData();
             setForm(prev => ({
@@ -207,24 +209,20 @@
     }, [masterData]);
 
     const update = async () => {
-        if (isSubmitting) return;
+        if (isSubmitting || submitting.current) return;
+        submitting.current = true;
         setIsSubmitting(true);
         if (form.name === '') {
             alert('お名前を入力してください');
-            setIsSubmitting(false);
+            setIsSubmitting(false); submitting.current = false;
             return;
         }
         if (form.id === 'new') {
-            const data = {
-                ...form,
-                request: 'before_interview'
-            };
-
-            try {
-                const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                await axios.post("https://khg-marketing.info/survey/api/", data, { headers });
-            } catch (error) {
-                console.error("データ取得エラー:", error);
+            // ⚠️ 2026-11-09: ② へ保存（届かなければ以前の /survey/api/ へ。api.ts）
+            if (!(await saveBeforeAnswer({ ...form }))) {
+                alert('送信できませんでした。通信状況をご確認のうえ、もう一度「送信」を押してください。');
+                setIsSubmitting(false); submitting.current = false;
+                return;
             }
 
             const postData = {
@@ -258,16 +256,11 @@
             }
             await navigate('/thanks');
         } else {
-            const data = {
-                ...form,
-                request: 'before_interview'
-            };
-
-            try {
-                const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                await axios.post("https://khg-marketing.info/survey/api/", data, { headers });
-            } catch (error) {
-                console.error("データ取得エラー:", error);
+            // ⚠️ 2026-11-09: ② へ保存（届かなければ以前の /survey/api/ へ。api.ts）
+            if (!(await saveBeforeAnswer({ ...form }))) {
+                alert('送信できませんでした。通信状況をご確認のうえ、もう一度「送信」を押してください。');
+                setIsSubmitting(false); submitting.current = false;
+                return;
             }
 
             const postData = {
@@ -324,6 +317,17 @@
         }
     };
 
+    // ⚠️ 2026-11-09: 面談前アンケートから来ていない（この画面を直接開いた）ときは案内だけを出す
+    if (!data) {
+        return (
+            <div className="w-100" style={{ backgroundColor: '#D3D3D3', padding: '2vw 0', minHeight: '100vh' }}>
+                <div className="bg-white rounded text-center" style={{ width: '93%', maxWidth: '768px', margin: '0 auto', padding: '60px 20px' }}>
+                    お手数ですが、お渡しした QR コードからもう一度開いてください。
+                </div>
+            </div>
+        );
+    }
+
     return (
         <div className="w-100" style={{ backgroundColor: '#D3D3D3', padding: '2vw 0', height: 'auto', minHeight: '100vh' }}>
             <div className="bg-white rounded" style={{ width: '93%', maxWidth: '768px', margin: '0 auto', paddingBottom: '150px' }}>
--- (控え) survey/src/components/SurveyAfter.tsx	2026-07-17 10:07:46.000000000 +0900
+++ /c/Users/shinji-kawano/react/survey/src/components/SurveyAfter.tsx	2026-11-09 18:20:59.131561500 +0900
@@ -1,6 +1,6 @@
-import { useState, useEffect } from "react";
+import { useState, useEffect, useRef } from "react";
 import { useLocation, useNavigate } from "react-router-dom";
-import axios from "axios";
+import { fetchShopStaff, rememberLink, saveAfterAnswer } from "../api";
 import khLogo from '../assets/images/khLogo.png';
 import djhLogo from '../assets/images/djhLogo.png';
 import nieruLogo from '../assets/images/2lLogo.png';
@@ -41,21 +41,13 @@
     const [staffList, setStaffList] = useState<Staff[]>([]);
     const navigate = useNavigate();
     const [isSubmitting, setIsSubmitting] = useState<Boolean>(false);
+    // ⚠️ 2026-11-09: 連打の二重送信を防ぐ（state は次の描画まで変わらないので、同じ描画のうちの2回目を止められない）
+    const submitting = useRef(false);
 
     useEffect(() => {
-        const fetchData = async () => {
-            try {
-                const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                const [staffRes] = await Promise.all([
-                    axios.post("/dashboard/api/", { demand: "staff_list" }, { headers }),
-                ]);
-                await setStaffList(staffRes.data);
-            } catch (error) {
-                console.error("データ取得エラー:", error);
-            }
-        };
-
-        fetchData();
+        // ⚠️ 2026-11-09: QR の URL の署名（t）を覚え、その店舗の担当を読む（api.ts）。⚠️ 読めなくてもアンケートは進められる
+        rememberLink(location.search);
+        fetchShopStaff(shopValue ?? '').then(list => setStaffList(list as unknown as Staff[]));
         setForm(prev => ({
             ...prev,
             id: idValue as string,
@@ -64,7 +56,8 @@
     }, [])
 
     const update = async () => {
-        if (isSubmitting) return;
+        if (isSubmitting || submitting.current) return;
+        submitting.current = true;
         setIsSubmitting(true);
         const excludeKeys = ['rival', 'staff', 'improvement', 'demand'];
         const emptyKeys = Object.entries(form)
@@ -83,20 +76,14 @@
             const target = document.getElementById(emptyKeys[0]);
             await target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
             await alert(`必須項目のうち${emptyKeys.length}項目が未回答です`);
-            setIsSubmitting(false);
+            setIsSubmitting(false); submitting.current = false;
         } else {
             if (idValue === 'new') {
-                const data = {
-                    ...form,
-                    name: nameValue,
-                    request: 'after_interview'
-                };
-
-                try {
-                    const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                    await axios.post("https://khg-marketing.info/survey/api/", data, { headers });
-                } catch (error) {
-                    console.error("データ取得エラー:", error);
+                // ⚠️ 2026-11-09: ② へ保存（届かなければ以前の /survey/api/ へ。api.ts）
+                if (!(await saveAfterAnswer({ ...form, name: nameValue }))) {
+                    alert('送信できませんでした。通信状況をご確認のうえ、もう一度「送信」を押してください。');
+                    setIsSubmitting(false); submitting.current = false;
+                    return;
                 }
 
                 // const postData = {
@@ -122,17 +109,11 @@
                 // }
                 await navigate('/thanks');
             } else {
-                const data = {
-                    ...form,
-                    name: nameValue,
-                    request: 'after_interview'
-                };
-
-                try {
-                    const headers = { Authorization: '<共有キー>', 'Content-Type': 'application/json' };
-                    await axios.post("https://khg-marketing.info/survey/api/", data, { headers });
-                } catch (error) {
-                    console.error("データ取得エラー:", error);
+                // ⚠️ 2026-11-09: ② へ保存（届かなければ以前の /survey/api/ へ。api.ts）
+                if (!(await saveAfterAnswer({ ...form, name: nameValue }))) {
+                    alert('送信できませんでした。通信状況をご確認のうえ、もう一度「送信」を押してください。');
+                    setIsSubmitting(false); submitting.current = false;
+                    return;
                 }
 
                 const postData = {
```
