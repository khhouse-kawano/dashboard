import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { NOT_NULL_COLUMNS } from '../campaignForm/entry';
import { clean, cleanMultiline } from '../campaignForm/text';
import { duplicateNote, keyMatches } from '../memberEntry/entry';

/**
 * 土地新着ネット（ask@tochi-shinchaku.net）の新規会員登録を inquiry_customer へ保存する。（v2.2.212）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送ってくるのは GAS の TochishinchakuToDashboard（backend/scripts/gas/TochishinchakuToDashboard.gs）。
 *   ⚠️ 届かなかったとき GAS は ① の handlers/tochishinchaku_entry.php へ送り直す。**同じ処理を PHP にも持っている。**
 *   ⚠️ ここを変えたら tochishinchaku_entry.php も同じように変えること。
 * ⚠️ 移植元は ① `khg-marketing.info/api/`（⚠️ 誤って消えた。中身は残っていない）。
 * ⚠️ 合い言葉は会員登録の取り込み（member_entry）と同じ MEMBER_ENTRY_KEY。
 *   ⚠️ 以前の GAS が Authorization ヘッダーに直書きしていた合い言葉は使わない。
 * ⚠️⚠️ **ブランド・店舗は決めない**（指示）。shop_list に実在する「KHG・ブランド・店舗未設定」で入れる。
 *   ⚠️ 以前は「KHG店舗未設定」が入っていたが、⚠️ この店舗は店舗一覧に無い。
 * ⚠️ 重複:
 *   - 同じ inquiry_id は二度入らない
 *   - ⚠️⚠️ 以前の php の inquiry_id の作り方は確かめられない（中身が残っていない）。切り替えの前後で二重に入らないよう、
 *     **土地新着ネットで同じ日に、同じメールか電話の人がいれば登録済み**として飛ばす
 *   - 他の媒体で同じ人（メールか電話が一致）がいれば duplicate に「店舗 媒体 重複」
 * ─────────────────────────────────────────────
 */

export interface TochishinchakuEntryResult {
    httpStatus: number;
    body: { status: 'success' | 'exists' | 'error'; message: string; id?: string };
}

/** ⚠️ 以前と同じ形（tochishinchaku_＋受信日＋受信日時） */
const INQUIRY_ID_PREFIX = 'tochishinchaku_';
const DATE_PATTERN = /^\d{4}\/\d{2}\/\d{2}$/;
const MEDIUM = '土地新着ネット';
/** ⚠️ shop_list に実在する「未設定」（brand = KHG） */
const BRAND = 'KHG';
const SHOP = 'ブランド・店舗未設定';

/** 電話の数字だけ（重複の照合用。⚠️ 保存する値はそのまま） */
const digits = (value: string): string => value.replace(/\D/g, '');
/** ⚠️ 土地新着ネットは電話番号（landline）だけの人もいるので、携帯と電話の両方の列と比べる */
const SAME_PHONE_SQL = "(REPLACE(REPLACE(mobile, '-', ''), ' ', '') = ? OR REPLACE(REPLACE(landline, '-', ''), ' ', '') = ?)";

interface DuplicateRow extends RowDataPacket {
    shop: string;
    medium: string;
}

export const runTochishinchakuEntry = async (raw: Record<string, unknown>): Promise<TochishinchakuEntryResult> => {
    const body = raw ?? {};

    // ⚠️ 合い言葉を最初に確かめる（member_entry と同じ理由）
    if (!keyMatches(clean(body.key, 200))) {
        if (env.memberEntryKey === '') logger.warn('MEMBER_ENTRY_KEY が未設定のため、土地新着ネットの取り込みを断りました。');
        return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
    }

    const inquiryId = clean(body.inquiry_id, 200);
    const inquiryDate = clean(body.inquiry_date, 10);
    const name = clean(body.name, 120);
    const mail = clean(body.mail, 190);
    const mobile = clean(body.mobile, 30);
    const tel = clean(body.tel, 30);

    if (!inquiryId.startsWith(INQUIRY_ID_PREFIX) || !DATE_PATTERN.test(inquiryDate) || name === '' || (mail === '' && mobile === '' && tel === '')) {
        logger.warn(`tochishinchaku_entry: 必要な項目がありません id="${inquiryId}"`);
        return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
    }

    try {
        // ⚠️ 同じ人：メールが一致、または電話の数字が一致（⚠️ 空の値どうしは照合しない）。⚠️ 携帯が無ければ電話で照合する
        const phone = digits(mobile) || digits(tel);
        const conditions: string[] = [];
        const params: string[] = [];
        if (mail !== '') { conditions.push('mail = ?'); params.push(mail); }
        if (phone.length >= 10) { conditions.push(SAME_PHONE_SQL); params.push(phone, phone); }
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
        // ⚠️ メールの「電話番号」（以前は保存していなかった）
        values.landline = tel;
        values.mail = mail;
        values.zip = clean(body.zip, 10);
        values.building = clean(body.address, 300);
        // ⚠️ 希望エリアの1行目（以前と同じ）。⚠️ 全部の希望エリアは備考に入る
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
        logger.error(`tochishinchaku_entry: inquiry_customer への保存に失敗 id="${inquiryId}": ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: 'データの追加に失敗しました。' } };
    }

    logger.info(`tochishinchaku_entry を受け付けました id="${inquiryId}"`);
    return { httpStatus: 200, body: { status: 'success', message: `${name} のデータが反響一覧に追加されました。`, id: inquiryId } };
};
