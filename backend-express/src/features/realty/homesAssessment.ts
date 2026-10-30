import { randomBytes } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { clean, cleanMultiline } from '../campaignForm/text';
import { keyMatches } from '../memberEntry/entry';

/**
 * LIFULL HOME'S の査定依頼メール → 売り反響（brokerage_listings の kind = leads）。（v2.2.236）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送ってくるのは GAS（backend/scripts/gas/HomesSaleAssessmentToDashboard.gs）。合い言葉は MEMBER_ENTRY_KEY（会員登録の GAS と同じ値）。
 *   ⚠️ 件名「【LIFULL HOME'S】＜実名＞査定依頼がありました」を newer_than:1d で毎回読むので、同じメールが何度も届く。
 * ⚠️⚠️ 重複はスキップ（2026-10-30 の指示）:
 *   1. 外部ID（extId = 'homes:' + 査定ID）が同じ売り反響がある。⚠️ extId は UNIQUE
 *   2. 電話番号（数字だけで比べる）が同じ売り反響が、受信日の前後90日にある
 *      ⚠️ 同じメールがコールセンター（ミカタ）にも届き、あとからミカタの明細でも同じお客様が入るため
 * ⚠️ 反響元は "HOME'S"（v2.2.237 で一覧の選択肢・設定・既存の行もこの書き方にそろえた）。⚠️ フェーズは「リード受信」。担当は空（画面で割り当てる）。
 * ⚠️ id は画面（realty/common/leadUtiles.ts の newRecordId）と同じ形（'x' ＋ 時刻の36進 ＋ 乱数）。
 * ─────────────────────────────────────────────
 */

const HOMES_SOURCE = "HOME'S";
const PHASE = 'リード受信';
const EXT_PREFIX = 'homes:';
/** 電話番号で重複を見る期間（受信日の前後） */
const PHONE_DUP_DAYS = 90;
const RECEIVED_PATTERN = /^(\d{4})\/(\d{2})\/(\d{2}) \d{2}:\d{2}:\d{2}$/;

export interface HomesAssessmentResult {
  httpStatus: number;
  body: { status: 'success' | 'exists' | 'error'; message: string; id?: string };
}

/** 画面の newRecordId と同じ形 */
const newRecordId = (): string => `x${Date.now().toString(36)}${randomBytes(4).toString('hex').slice(0, 6)}`;

/** 物件種別 → 売り反響の区分（既存の値：戸建・マンション・住宅用地・その他） */
const toCategory = (type: string): string | null => {
  if (type === '') return null;
  if (/戸建/.test(type)) return '戸建';
  if (/マンション/.test(type)) return 'マンション';
  if (/土地/.test(type)) return '住宅用地';
  return 'その他';
};

/** 全角数字も数字として、数字だけを残す */
const digits = (value: string): string =>
  value.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)).replace(/\D/g, '');

/** 備考（「見出し：値」を改行で並べる。空の項目は入れない） */
const buildNote = (body: Record<string, unknown>, assessmentId: string): string => {
  const pairs: [string, string][] = [
    ['査定ID', assessmentId],
    ['間取り', clean(body.layout, 50)],
    ['建物面積', clean(body.building_area, 50)],
    ['土地面積', clean(body.land_area, 50)],
    ['築年', clean(body.built_year, 80)],
    ['現況', clean(body.current_status, 50)],
    ['名義', clean(body.ownership, 50)],
    ['ご要望', clean(body.wish, 200)],
    ['フリガナ', clean(body.kana, 100)],
    ['ご住所', clean(body.customer_address, 200)],
    ['希望の連絡時間', clean(body.contact_time, 100)],
    ['希望の連絡方法', clean(body.contact_method, 100)],
    ['同時送信社数', clean(body.companies, 30)],
  ];
  const lines = pairs.filter(([, v]) => v !== '').map(([k, v]) => `${k}：${v}`);
  const free = cleanMultiline(body.free_text, 1000).trim();
  if (free !== '') lines.push(`お客様の記入：${free}`);
  const url = clean(body.manager_url, 300);
  if (/^https:\/\/manager\.homes\.co\.jp\//.test(url)) lines.push(`Manager：${url}`);
  return lines.join('\n');
};

interface IdRow extends RowDataPacket {
  id: string;
}

/** 査定依頼メール1通を売り反響として取り込む */
export const importHomesAssessment = async (raw: Record<string, unknown>): Promise<HomesAssessmentResult> => {
  const body = raw ?? {};
  if (!keyMatches(clean(body.key, 200))) {
    if (env.memberEntryKey === '') logger.warn("MEMBER_ENTRY_KEY が未設定のため、HOME'S 査定依頼の取り込みを断りました。");
    return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
  }

  const assessmentId = clean(body.assessment_id, 30);
  const receivedAt = clean(body.received_at, 19);
  const received = RECEIVED_PATTERN.exec(receivedAt);
  const name = clean(body.name, 100).replace(/[\s　]*様$/, '');
  const phone = digits(clean(body.phone, 30));
  const mail = clean(body.mail, 200).replace(/[\s　]/g, '');
  if (!/^\d{1,20}$/.test(assessmentId) || received === null || name === '' || (phone === '' && mail === '')) {
    logger.warn(`homes_sale_assessment_entry: 必要な項目がありません assessment_id="${assessmentId}"`);
    return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
  }
  const receivedDate = `${received[1]}-${received[2]}-${received[3]}`;
  const extId = `${EXT_PREFIX}${assessmentId}`;

  try {
    if ((await query<IdRow>('SELECT id FROM brokerage_listings WHERE extId = ? LIMIT 1', [extId])).length > 0) {
      return { httpStatus: 200, body: { status: 'exists', message: '取り込み済みです（同じ査定ID）。' } };
    }
    // ⚠️ 電話は phone 列と、以前の取り込みの連絡先（contact「電話 / メール」）の両方を数字だけで比べる
    if (phone.length >= 10) {
      const dup = await query<IdRow>(
        `SELECT id FROM brokerage_listings
          WHERE kind = 'leads'
            AND (REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '') = ?
                 OR REGEXP_REPLACE(SUBSTRING_INDEX(COALESCE(contact, ''), '/', 1), '[^0-9]', '') = ?)
            AND COALESCE(receivedDate, DATE(created_at)) BETWEEN DATE_SUB(?, INTERVAL ${PHONE_DUP_DAYS} DAY) AND DATE_ADD(?, INTERVAL ${PHONE_DUP_DAYS} DAY)
          LIMIT 1`,
        [phone, phone, receivedDate, receivedDate]
      );
      if (dup.length > 0) {
        return { httpStatus: 200, body: { status: 'exists', message: `取り込み済みです（同じ電話番号の売り反響が前後${PHONE_DUP_DAYS}日にあります）。` } };
      }
    }

    const id = newRecordId();
    const location = clean(body.location, 200).replace(/^鹿児島県/, '');
    await execute(
      `INSERT INTO brokerage_listings
         (id, kind, receivedDate, source, phase, seller, customer, name, phone, mail, contact,
          addr, category, reason, timing, note, extId, callDates, show_dashboard)
       VALUES (?, 'leads', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 1)`,
      [
        id, receivedDate, HOMES_SOURCE, PHASE, name, name, name,
        phone || null, mail || null, [phone, mail].filter((v) => v !== '').join(' / '),
        location || null, toCategory(clean(body.property_type, 50)),
        clean(body.reason, 100) || null, clean(body.timing, 100) || null,
        buildNote(body, assessmentId), extId,
      ]
    );
    logger.info(`homes_sale_assessment_entry を受け付けました extId="${extId}" id="${id}"`);
    return { httpStatus: 200, body: { status: 'success', message: '売り反響に登録しました。', id } };
  } catch (error) {
    // ⚠️ 同時に2回届いて extId の UNIQUE に当たったときは取り込み済みとして返す
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      return { httpStatus: 200, body: { status: 'exists', message: '取り込み済みです（同じ査定ID）。' } };
    }
    logger.error(`homes_sale_assessment_entry: 保存に失敗 extId="${extId}": ${(error as Error).message}`);
    return { httpStatus: 500, body: { status: 'error', message: '保存に失敗しました。' } };
  }
};
