import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { clean } from '../campaignForm/text';
import { keyMatches } from '../memberEntry/entry';

/**
 * オーナーズハウス募集（owners_house_application）。（v2.2.215）
 *
 * ─────────────────────────────────────────────
 * ⚠️ フォームからの受付は ① の handlers/owners_house_application.php（写真を含むので ① だけ）。
 * ⚠️ ここにあるのは:
 *   - 一覧（Dashboard の「反響管理 → オーナーズハウス募集」。スタッフのみ）
 *   - 過去の通知メールの取り込み（GAS OwnersHouseMailImport。合い言葉 MEMBER_ENTRY_KEY）
 *     ⚠️ メールの Gmail の ID（mail_message_id）は UNIQUE。同じメールは二度入らない
 * ─────────────────────────────────────────────
 */

interface RawRow extends RowDataPacket {
    id: number;
    received_at: string;
    source: string;
    name: string;
    zip: string;
    shop: string;
    staff: string;
    photo_mode: string;
    photos: string | null;
    title: string;
    feature1: string; feature2: string; feature3: string; feature4: string; feature5: string;
}

/** 写真のファイル名の JSON。⚠️ 壊れていても一覧は出す（空にする） */
const parsePhotos = (value: string | null): string[] => {
    if (!value) return [];
    try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string' && p !== '') : [];
    } catch {
        return [];
    }
};

/** 一覧（新しい順）。⚠️ 件数は多くない（年に数十件）ので全件返す */
export const listOwnersHouseApplications = async (): Promise<{ status: 'success'; rows: unknown[] }> => {
    const rows = await query<RawRow>(
        "SELECT id, DATE_FORMAT(received_at, '%Y/%m/%d %H:%i') AS received_at, source, name, zip, shop, staff,"
        + ' photo_mode, photos, title, feature1, feature2, feature3, feature4, feature5'
        + ' FROM owners_house_application ORDER BY received_at DESC, id DESC'
    );
    return {
        status: 'success',
        rows: rows.map(r => ({
            id: r.id,
            received_at: r.received_at,
            source: r.source,
            name: r.name,
            zip: r.zip,
            shop: r.shop,
            staff: r.staff,
            photo_mode: r.photo_mode,
            photos: parsePhotos(r.photos),
            title: r.title,
            features: [r.feature1, r.feature2, r.feature3, r.feature4, r.feature5].filter(f => f !== ''),
        })),
    };
};

export interface ImportResult {
    httpStatus: number;
    body: { status: 'success' | 'exists' | 'error'; message: string };
}

const RECEIVED_PATTERN = /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/;

/** 過去の通知メールを1通取り込む */
export const importOwnersHouseApplication = async (raw: Record<string, unknown>): Promise<ImportResult> => {
    const body = raw ?? {};
    if (!keyMatches(clean(body.key, 200))) {
        if (env.memberEntryKey === '') logger.warn('MEMBER_ENTRY_KEY が未設定のため、オーナーズハウス募集の取り込みを断りました。');
        return { httpStatus: 401, body: { status: 'error', message: '合い言葉が違います。' } };
    }

    const messageId = clean(body.message_id, 100);
    const receivedAt = clean(body.received_at, 19);
    const name = clean(body.name, 100);
    if (messageId === '' || !RECEIVED_PATTERN.test(receivedAt) || name === '') {
        logger.warn(`owners_house_application_import: 必要な項目がありません message_id="${messageId}"`);
        return { httpStatus: 400, body: { status: 'error', message: '必要な項目がありません。' } };
    }

    try {
        const existing = await query<RowDataPacket>(
            'SELECT id FROM owners_house_application WHERE mail_message_id = ? LIMIT 1', [messageId]
        );
        if (existing.length > 0) {
            return { httpStatus: 200, body: { status: 'exists', message: '取り込み済みです。' } };
        }
        await execute(
            'INSERT INTO owners_house_application'
            + ' (received_at, source, mail_message_id, name, zip, shop, staff, photo_mode, photos, title, feature1, feature2, feature3, feature4, feature5)'
            + " VALUES (STR_TO_DATE(?, '%Y/%m/%d %H:%i:%s'), 'mail', ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)",
            [
                receivedAt, messageId, name,
                clean(body.zip, 10).replace(/\D/g, ''),
                clean(body.shop, 60), clean(body.staff, 60), clean(body.photo_mode, 20), clean(body.title, 200),
                clean(body.feature1, 300), clean(body.feature2, 300), clean(body.feature3, 300),
                clean(body.feature4, 300), clean(body.feature5, 300),
            ]
        );
    } catch (error) {
        logger.error(`owners_house_application_import: 保存に失敗 message_id="${messageId}": ${(error as Error).message}`);
        return { httpStatus: 500, body: { status: 'error', message: '保存に失敗しました。' } };
    }

    logger.info(`owners_house_application_import を受け付けました message_id="${messageId}"`);
    return { httpStatus: 200, body: { status: 'success', message: `${name} 様の応募を取り込みました。` } };
};
