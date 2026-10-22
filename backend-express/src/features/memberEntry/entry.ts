import { timingSafeEqual } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { NOT_NULL_COLUMNS } from '../campaignForm/entry';
import { clean, cleanMultiline } from '../campaignForm/text';

/**
 * ホームページの会員登録（KH・2L・なごみ・JH）を inquiry_customer へ保存する。（v2.2.209）
 *
 * ─────────────────────────────────────────────
 * ⚠️ 送ってくるのは GAS の MEMBERtoDashboard（backend/scripts/gas/MEMBERtoDashboard.gs）。
 *   通知メールを読み取り、店舗まで決めてから送ってくる。⚠️ ここでは店舗を決め直さない。
 * ⚠️ 届かなかったとき GAS は ① の handlers/member_entry.php へ送り直す。**同じ処理を PHP にも持っている。**
 *   ⚠️ ここを変えたら member_entry.php も同じように変えること。
 * ⚠️ 移植元は ① `khg-marketing.info/api/member.php`。違うところ:
 *   - 合い言葉（MEMBER_ENTRY_KEY）が合わない送信は断る（移植元は誰でも書き込めた）
 *   - 氏名と、メールか電話のどちらかが無い送信は断る（移植元は中身が空の行も入れていた）
 *   - 既にいる人のときも response_medium は「知ったきっかけ」のまま（移植元は媒体で上書きしていた）
 *   - メールが空のときは重複を調べない（移植元は空のメール同士を重複にしていた）
 *   - NOT NULL の列をすべて埋める・応答は JSON 1つ（移植元は保存前に「受信完了」を返していた）
 * ─────────────────────────────────────────────
 */

export interface MemberEntryResult {
    httpStatus: number;
    body: { status: 'success' | 'exists' | 'error'; message: string; id?: string };
}

/** ⚠️ GAS の inquiry_id は `homepage` ＋日時＋キャンペーン名（移植元と同じ形。切り替えの前後で同じメールが二重に入らないため） */
const INQUIRY_ID_PREFIX = 'homepage';
const DATE_PATTERN = /^\d{4}\/\d{2}\/\d{2}$/;

/** ⚠️ 長さが違うと timingSafeEqual が例外を投げるので先に比べる（event/checkin.ts と同じ） */
const keyMatches = (input: string): boolean => {
    const expected = env.memberEntryKey;
    if (expected === '') return false;
    const a = Buffer.from(input, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
};

interface DuplicateRow extends RowDataPacket {
    shop: string;
    medium: string;
}

/**
 * 同じメールアドレスの既存の反響を「店舗 媒体 重複」の形で並べる（移植元と同じ形）。
 * ⚠️ 移植元は店舗ごとに1つ（同じ店舗なら後の行の媒体）。
 */
const duplicateNote =(rows: ReadonlyArray<{ shop: string; medium: string }>): string => {
    const byShop = new Map<string, string>();
    for (const row of rows) byShop.set(row.shop, row.medium);
    return [...byShop].map(([shop, medium]) => `${shop} ${medium} 重複`).join(',');
};

export const runMemberEntry = async (raw: Record<string, unknown>): Promise<MemberEntryResult> => {
    const body = raw ?? {};

    // ⚠️ 合い言葉を最初に確かめる。先に inquiry_id を調べると、応答の違いから登録の有無が漏れる
    if (!keyMatches(clean(body.key, 200))) {
        if (env.memberEntryKey === '') logger.warn('MEMBER_ENTRY_KEY が未設定のため、会員登録の取り込みを断りました。');
        return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
    }

    const inquiryId = clean(body.inquiry_id, 200);
    const inquiryDate = clean(body.inquiry_date, 10);
    const name = clean(body.name, 120);
    const mail = clean(body.mail, 190);
    const mobile = clean(body.mobile, 30);
    const brand = clean(body.brand, 30);
    const shop = clean(body.shop, 80);

    if (!inquiryId.startsWith(INQUIRY_ID_PREFIX) || !DATE_PATTERN.test(inquiryDate)
        || brand === '' || shop === '' || name === '' || (mail === '' && mobile === '')) {
        logger.warn(`member_entry: 必要な項目がありません id="${inquiryId}" brand="${brand}"`);
        return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
    }

    try {
        const existing = await query<RowDataPacket>(
            'SELECT id FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1', [inquiryId]
        );
        if (existing.length > 0) {
            return { httpStatus: 200, body: { status: 'exists', message: '登録済みです。', id: inquiryId } };
        }

        const duplicates = mail === '' ? [] : await query<DuplicateRow>(
            'SELECT shop, medium FROM inquiry_customer WHERE mail = ? ORDER BY id', [mail]
        );

        const values: Record<string, string | number> = {};
        for (const column of NOT_NULL_COLUMNS) values[column] = '';
        // ⚠️ 数値列。空文字だと INSERT ごと失敗する
        values.sync = 0;
        values.delete_flag = 0;

        values.inquiry_id = inquiryId;
        values.inquiry_date = inquiryDate;
        values.medium = 'ホームページ反響';
        values.response_medium = clean(body.response_medium, 120);
        // ⚠️ 移植元と同じく氏名・かなは分けずに first_name / first_name_kana、住所はまとめて building
        //   （一覧は pref〜building をつなげて表示するので、どこに入れても見え方は同じ）
        values.first_name = name;
        values.first_name_kana = clean(body.kana, 120);
        values.mobile = mobile;
        values.mail = mail;
        values.zip = clean(body.zip, 10);
        values.building = clean(body.address, 300);
        values.brand = brand;
        values.shop = shop;
        values.hp_campaign = clean(body.campaign, 200);
        values.remarks = cleanMultiline(body.remarks, 2000);
        values.duplicate = duplicateNote(duplicates);

        await execute(
            `INSERT INTO inquiry_customer (${NOT_NULL_COLUMNS.join(', ')})`
            + ` VALUES (${NOT_NULL_COLUMNS.map(() => '?').join(', ')})`,
            NOT_NULL_COLUMNS.map(c => values[c])
        );
    } catch (error) {
        logger.error(`member_entry: inquiry_customer への保存に失敗 id="${inquiryId}": ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: 'データの追加に失敗しました。' } };
    }

    logger.info(`member_entry を受け付けました id="${inquiryId}" brand="${brand}" shop="${shop}"`);
    return { httpStatus: 200, body: { status: 'success', message: `${name} のデータが反響一覧に追加されました。`, id: inquiryId } };
};
