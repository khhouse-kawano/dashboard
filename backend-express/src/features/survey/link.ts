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
