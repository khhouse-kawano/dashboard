import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { NOT_NULL_COLUMNS } from '../campaignForm/entry';
import { clean, cleanMultiline } from '../campaignForm/text';
import { duplicateNote, keyMatches } from '../memberEntry/entry';

/**
 * ハウジングバザール（bazar@g-rexjapan.co.jp）の問い合わせを inquiry_customer へ保存する。（v2.2.210）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送ってくるのは GAS の HousingBtoDashboard（backend/scripts/gas/HousingBtoDashboard.gs）。
 *   通知メールを読み取ってから送ってくる。⚠️ 届かなかったとき GAS は ① の handlers/housing_bazar_entry.php へ送り直す。
 *   ⚠️ **同じ処理を PHP にも持っている。** ⚠️ ここを変えたら housing_bazar_entry.php も同じように変えること。
 * ⚠️ 移植元は ① `khg-marketing.info/api/portal.php`（⚠️ 誤って消えた。中身は残っていない）。
 * ⚠️ 合い言葉は会員登録の取り込み（member_entry）と同じ MEMBER_ENTRY_KEY。
 * ⚠️⚠️ **ブランド・店舗は決めない**（指示）。店舗一覧に実在する「未設定」の値（KHG・ブランド・店舗未設定）で入れる。
 *   ⚠️ 以前の GAS は「KHG店舗未設定」を入れていたが、⚠️ この店舗は店舗一覧に無い（一覧にも集計にも出ない）。
 * ⚠️ 重複：同じ inquiry_id は二度入らない。同じ人（メールか電話が一致）が既にいれば duplicate に「店舗 媒体 重複」。
 * ─────────────────────────────────────────────
 */

export interface HousingBazarResult {
    httpStatus: number;
    body: { status: 'success' | 'exists' | 'error'; message: string; id?: string };
}

/** ⚠️ 以前の GAS と同じ形（housingBazar＋日時＋KHG）。⚠️ 取り込み済みのメールが二重に入らないように */
const INQUIRY_ID_PREFIX = 'housingBazar';
const DATE_PATTERN = /^\d{4}\/\d{2}\/\d{2}$/;
const MEDIUM = 'ハウジングバザール';
/** ⚠️ shop_list に実在する「未設定」（brand = KHG） */
const BRAND = 'KHG';
const SHOP = 'ブランド・店舗未設定';

/** 電話の数字だけ（重複の照合用。⚠️ 保存する値はそのまま） */
const digits = (value: string): string => value.replace(/\D/g, '');

interface DuplicateRow extends RowDataPacket {
    shop: string;
    medium: string;
}

export const runHousingBazarEntry = async (raw: Record<string, unknown>): Promise<HousingBazarResult> => {
    const body = raw ?? {};

    // ⚠️ 合い言葉を最初に確かめる（member_entry と同じ理由）
    if (!keyMatches(clean(body.key, 200))) {
        if (env.memberEntryKey === '') logger.warn('MEMBER_ENTRY_KEY が未設定のため、ハウジングバザールの取り込みを断りました。');
        return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
    }

    const inquiryId = clean(body.inquiry_id, 200);
    const inquiryDate = clean(body.inquiry_date, 10);
    const name = clean(body.name, 120);
    const mail = clean(body.mail, 190);
    const mobile = clean(body.mobile, 30);

    if (!inquiryId.startsWith(INQUIRY_ID_PREFIX) || !DATE_PATTERN.test(inquiryDate) || name === '' || (mail === '' && mobile === '')) {
        logger.warn(`housing_bazar_entry: 必要な項目がありません id="${inquiryId}"`);
        return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
    }

    try {
        const existing = await query<RowDataPacket>('SELECT id FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1', [inquiryId]);
        if (existing.length > 0) {
            return { httpStatus: 200, body: { status: 'exists', message: '登録済みです。', id: inquiryId } };
        }

        // ⚠️ 同じ人：メールが一致、または電話の数字が一致（⚠️ 空の値どうしは照合しない）
        const tel = digits(mobile);
        const conditions: string[] = [];
        const params: string[] = [];
        if (mail !== '') { conditions.push('mail = ?'); params.push(mail); }
        if (tel.length >= 10) { conditions.push("REPLACE(REPLACE(mobile, '-', ''), ' ', '') = ?"); params.push(tel); }
        const duplicates = conditions.length === 0 ? [] : await query<DuplicateRow>(
            `SELECT shop, medium FROM inquiry_customer WHERE ${conditions.join(' OR ')} ORDER BY id`, params
        );

        const values: Record<string, string | number> = {};
        for (const column of NOT_NULL_COLUMNS) values[column] = '';
        // ⚠️ 数値列。空文字だと INSERT ごと失敗する
        values.sync = 0;
        values.delete_flag = 0;

        values.inquiry_id = inquiryId;
        values.inquiry_date = inquiryDate;
        values.medium = MEDIUM;
        values.response_medium = MEDIUM;
        // ⚠️ 他の反響と同じく氏名・かなは分けずに first_name / first_name_kana、住所はまとめて building
        values.first_name = name;
        values.first_name_kana = clean(body.kana, 120);
        values.mobile = mobile;
        values.mail = mail;
        values.zip = clean(body.zip, 10);
        values.building = clean(body.address, 300);
        // ⚠️ 建築予定地（以前の GAS と同じく area）
        values.area = clean(body.area, 200);
        values.brand = BRAND;
        values.shop = SHOP;
        values.remarks = cleanMultiline(body.remarks, 2000);
        values.duplicate = duplicateNote(duplicates);

        await execute(
            `INSERT INTO inquiry_customer (${NOT_NULL_COLUMNS.join(', ')})`
            + ` VALUES (${NOT_NULL_COLUMNS.map(() => '?').join(', ')})`,
            NOT_NULL_COLUMNS.map(c => values[c])
        );
    } catch (error) {
        logger.error(`housing_bazar_entry: inquiry_customer への保存に失敗 id="${inquiryId}": ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: 'データの追加に失敗しました。' } };
    }

    logger.info(`housing_bazar_entry を受け付けました id="${inquiryId}"`);
    return { httpStatus: 200, body: { status: 'success', message: `${name} のデータが反響一覧に追加されました。`, id: inquiryId } };
};
