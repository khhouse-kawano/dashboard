import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { NOT_NULL_COLUMNS } from '../campaignForm/entry';
import { clean, cleanMultiline } from '../campaignForm/text';
import { duplicateNote, keyMatches } from '../memberEntry/entry';

/**
 * マイホームズ（no-reply@my-homes.jp）の新規リード通知を inquiry_customer へ保存する。（v2.2.214）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送ってくるのは GAS の MyhomestoDashboard（backend/scripts/gas/MyhomestoDashboard.gs）。
 *   通知メールを読み取り、**店舗まで決めてから**送ってくる。⚠️ ここでは店舗を決め直さない（kagosuma_entry と同じ）。
 * ⚠️ 届かなかったとき GAS は ① の handlers/myhomes_entry.php へ送り直す。**同じ処理を PHP にも持っている。**
 *   ⚠️ ここを変えたら myhomes_entry.php も同じように変えること。
 * ⚠️ 移植元は ① `khg-marketing.info/api/`（Authorization: 4081Kokubu_myhomes。⚠️ 誤って消えた）。
 * ⚠️ 合い言葉は会員登録の取り込み（member_entry）と同じ MEMBER_ENTRY_KEY。
 * ⚠️ 重複:
 *   - 同じ inquiry_id（`myhomes_`＋リードID）は二度入らない
 *   - ⚠️⚠️ 以前の php は inquiry_id に**受け取った時刻**を入れていたので作り直せない。切り替えの前後で二重に入らないよう、
 *     **マイホームズで同じ日に、同じメールか電話の人がいれば登録済み**として飛ばす（tochishinchaku_entry と同じ）
 *   - 他の媒体で同じ人（メールか電話が一致）がいれば duplicate に「店舗 媒体 重複」
 * ─────────────────────────────────────────────
 */

export interface MyhomesEntryResult {
    httpStatus: number;
    body: { status: 'success' | 'exists' | 'error'; message: string; id?: string };
}

/** ⚠️ `myhomes_`＋リードID（例 myhomes_CH-20260921-P65M） */
const INQUIRY_ID_PREFIX = 'myhomes_';
const DATE_PATTERN = /^\d{4}\/\d{2}\/\d{2}$/;
const MEDIUM = 'マイホームズ';

/** 電話の数字だけ（重複の照合用。⚠️ 保存する値はそのまま） */
const digits = (value: string): string => value.replace(/\D/g, '');
const SAME_PHONE_SQL = "REPLACE(REPLACE(mobile, '-', ''), ' ', '') = ?";

interface DuplicateRow extends RowDataPacket {
    shop: string;
    medium: string;
}

export const runMyhomesEntry = async (raw: Record<string, unknown>): Promise<MyhomesEntryResult> => {
    const body = raw ?? {};

    // ⚠️ 合い言葉を最初に確かめる（member_entry と同じ理由）
    if (!keyMatches(clean(body.key, 200))) {
        if (env.memberEntryKey === '') logger.warn('MEMBER_ENTRY_KEY が未設定のため、マイホームズの取り込みを断りました。');
        return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
    }

    const inquiryId = clean(body.inquiry_id, 200);
    const inquiryDate = clean(body.inquiry_date, 10);
    const name = clean(body.name, 120);
    const mail = clean(body.mail, 190);
    const mobile = clean(body.mobile, 30);
    const brand = clean(body.brand, 30);
    const shop = clean(body.shop, 80);

    if (inquiryId.length <= INQUIRY_ID_PREFIX.length || !inquiryId.startsWith(INQUIRY_ID_PREFIX) || !DATE_PATTERN.test(inquiryDate)
        || brand === '' || shop === '' || name === '' || (mail === '' && mobile === '')) {
        logger.warn(`myhomes_entry: 必要な項目がありません id="${inquiryId}"`);
        return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
    }

    try {
        // ⚠️ 同じ人：メールが一致、または電話の数字が一致（⚠️ 空の値どうしは照合しない）
        const phone = digits(mobile);
        const conditions: string[] = [];
        const params: string[] = [];
        if (mail !== '') { conditions.push('mail = ?'); params.push(mail); }
        if (phone.length >= 10) { conditions.push(SAME_PHONE_SQL); params.push(phone); }
        const samePerson = conditions.length === 0 ? '' : `(${conditions.join(' OR ')})`;

        const existing = await query<RowDataPacket>(
            'SELECT id FROM inquiry_customer WHERE inquiry_id = ?'
            + (samePerson ? ` OR (medium = ? AND inquiry_date = ? AND ${samePerson})` : '')
            + ' LIMIT 1',
            samePerson ? [inquiryId, MEDIUM, inquiryDate, ...params] : [inquiryId]
        );
        if (existing.length > 0) {
            return { httpStatus: 200, body: { status: 'exists', message: '登録済みです。', id: inquiryId } };
        }

        const duplicates = samePerson === '' ? [] : await query<DuplicateRow>(
            `SELECT shop, medium FROM inquiry_customer WHERE ${samePerson} ORDER BY id`, params
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
        // ⚠️ 以前と同じく氏名・かなは分けずに first_name / first_name_kana、住所はまとめて building
        values.first_name = name;
        values.first_name_kana = clean(body.kana, 120);
        values.mobile = mobile;
        values.mail = mail;
        values.zip = clean(body.zip, 10);
        values.building = clean(body.address, 300);
        // ⚠️ 希望エリア（以前と同じく area）
        values.area = clean(body.area, 200);
        values.brand = brand;
        values.shop = shop;
        values.remarks = cleanMultiline(body.remarks, 2000);
        values.duplicate = duplicateNote(duplicates);

        await execute(
            `INSERT INTO inquiry_customer (${NOT_NULL_COLUMNS.join(', ')})`
            + ` VALUES (${NOT_NULL_COLUMNS.map(() => '?').join(', ')})`,
            NOT_NULL_COLUMNS.map(c => values[c])
        );
    } catch (error) {
        logger.error(`myhomes_entry: inquiry_customer への保存に失敗 id="${inquiryId}": ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: 'データの追加に失敗しました。' } };
    }

    logger.info(`myhomes_entry を受け付けました id="${inquiryId}" brand="${brand}" shop="${shop}"`);
    return { httpStatus: 200, body: { status: 'success', message: `${name} のデータが反響一覧に追加されました。`, id: inquiryId } };
};
