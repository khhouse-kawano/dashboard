import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';

/**
 * キャンペーンフォームの設定（`form_table`）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **移植元は `index 2.php`（`https://khg-marketing.info/api/`）である。**
 *   ⚠️ dashboard のゲートウェイとは**別のAPI**で、
 *     ルーティングに `request` ではなく **`Authorization` ヘッダ**を使っている
 *     （`Authorization: form_list` 等）。
 *
 * ⚠️⚠️ **移植したのはダッシュボードが使う5つだけである。**
 *
 *     form_list     → campaign_form:list    （一覧）
 *     form_edit     → campaign_form:detail  （1件取得）
 *     form_post     → campaign_form:insert  （新規登録）
 *     form_update   → campaign_form:update  （更新）
 *     form_database → campaign_form:master  （ブランド既定値）
 *
 * ⚠️⚠️ **`form_get` と `form_register` は移植してはいけない。**
 *   ⚠️ **公開済みのフォーム272件が、生成された HTML の中で
 *     `https://khg-marketing.info/api/` を直接叩いている。**
 *   ⚠️ 移植して ① の PHP を消すと、**272件すべてを作り直して
 *     差し替えるまで反響が止まる。**
 *   ⚠️ あちらは ① に残したままにすること。
 * ─────────────────────────────────────────────
 */

/**
 * ⚠️⚠️ **JSON として保存されている列。**
 *   ⚠️ 移植元は `json_encode()` した文字列を TEXT 列へ入れている。
 *     読む側（画面）は `JSON.parse` する前提なので、
 *     **ここでオブジェクトに変換してはいけない**（PHP と同じ形で返す）。
 *   ⚠️ 既存データには改行や不揃いな空白が含まれるが、そのまま返す。
 */
const JSON_COLUMNS = [
    'notice', 'name', 'kana', 'age', 'phone', 'mail',
    'address', 'question', 'shop', 'date', 'medium', 'attention',
] as const;

/** 画面から受け取る1件ぶん。⚠️ 値の検証は下の各関数で行う */
type FormBody = Record<string, unknown>;

interface FormRow extends RowDataPacket {
    [key: string]: unknown;
}

/** PHP と同じ応答の形 */
export interface FormResult {
    status: 'success' | 'empty' | 'duplicate' | 'error' | 'not_found';
    data?: unknown;
    message?: string;
}

/** ⚠️ 文字列として取り出す。undefined を SQL へ渡すとドライバが落ちる */
const str = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : String(value);
};

/**
 * JSON 列へ入れる値。
 * ⚠️ 移植元の `json_encode($data['x'], JSON_UNESCAPED_UNICODE)` に相当する。
 *   ⚠️ 画面はオブジェクトを送ってくるので、ここで文字列化する。
 *   ⚠️ 既に文字列なら二重にエンコードしない（画面が古い形で送ってきた場合）。
 */
const jsonText = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
};

/** `YYYY/MM/DD`。⚠️ 移植元の `date("Y/m/d")` と同じ形 */
const today = (): string => {
    const d = new Date();
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// 一覧（form_list）
// ---------------------------------------------------------------------------

/**
 * ブランドのフォーム一覧。
 * ⚠️ 移植元と同じく `SELECT` する列を絞っている（設定の中身は返さない）。
 */
export const runCampaignFormList = async (body: FormBody): Promise<FormResult> => {
    const brand = str(body.brand);
    if (brand === '') return { status: 'empty', data: null };

    const rows = await query<FormRow>(
        `SELECT registered_date, brand, url, tag, campaign, campaign_id
           FROM form_table
          WHERE brand = ?
          ORDER BY id DESC`,
        [brand]
    );

    // ⚠️ 0件のとき data は null。移植元がそう返しており、画面がそれを見ている
    return { status: rows.length > 0 ? 'success' : 'empty', data: rows.length > 0 ? rows : null };
};

// ---------------------------------------------------------------------------
// 1件取得（form_edit）
// ---------------------------------------------------------------------------

/**
 * 編集用に1件取る。
 *
 * ⚠️ 移植元は `WHERE brand = ? AND campaign_id = ?` に **`$data['id']`** を渡している。
 *   ⚠️ キー名が `id` なのに中身は `campaign_id` である。紛らわしいが画面がそう送るので合わせる。
 */
export const runCampaignFormDetail = async (body: FormBody): Promise<FormResult> => {
    const brand = str(body.brand);
    // ⚠️ 画面は `id` で送ってくる。`campaign_id` でも受けられるようにしておく
    const campaignId = str(body.id) !== '' ? str(body.id) : str(body.campaign_id);

    if (brand === '' || campaignId === '') return { status: 'empty', data: null };

    const rows = await query<FormRow>(
        'SELECT * FROM form_table WHERE brand = ? AND campaign_id = ? LIMIT 1',
        [brand, campaignId]
    );

    return { status: rows.length > 0 ? 'success' : 'empty', data: rows[0] ?? null };
};

// ---------------------------------------------------------------------------
// 新規登録（form_post）
// ---------------------------------------------------------------------------

/**
 * 新しいフォーム設定を登録する。
 *
 * ⚠️ 既に同じ brand + campaign_id があれば `duplicate` を返して**何もしない**。
 *   移植元と同じ挙動。
 */
export const runCampaignFormInsert = async (body: FormBody): Promise<FormResult> => {
    const brand = str(body.brand);
    const campaignId = str(body.campaign_id);
    const campaign = str(body.campaign);

    if (brand === '' || campaignId === '') {
        return { status: 'error', message: 'ブランドとキャンペーンIDは必須です。' };
    }

    const exists = await query<FormRow>(
        'SELECT id FROM form_table WHERE brand = ? AND campaign_id = ? LIMIT 1',
        [brand, campaignId]
    );
    if (exists.length > 0) {
        return { status: 'duplicate', message: `${campaign}の登録に失敗しました。` };
    }

    const columns = [
        'registered_date', 'campaign', 'campaign_id', 'url', 'tag', 'brand',
        'mail_to', 'mail_cc', 'redirect', 'thanks', ...JSON_COLUMNS,
    ];

    const values = [
        today(), campaign, campaignId, str(body.url), str(body.tag), brand,
        str(body.mail_to), str(body.mail_cc), str(body.redirect),
        // ⚠️ thanks は tinyint。true/false で来るので 1/0 に直す
        body.thanks === true || body.thanks === 1 || body.thanks === '1' ? 1 : 0,
        ...JSON_COLUMNS.map(key => jsonText(body[key])),
    ];

    await execute(
        `INSERT INTO form_table (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values
    );

    return { status: 'success', message: `${campaign}の登録に成功しました。` };
};

// ---------------------------------------------------------------------------
// 更新（form_update）
// ---------------------------------------------------------------------------

/**
 * フォーム設定を更新する。
 *
 * ⚠️⚠️ **移植元は `WHERE campaign_id = :campaign_id` だけだった。**
 *   ⚠️ 登録側は `brand + campaign_id` で重複を見ているのに、
 *     更新側は brand を見ていない。
 *   ⚠️ そのため**別ブランドに同じ campaign_id があると巻き込んで更新していた**。
 *   ⚠️ ここでは brand も条件に加えている。**戻さないこと。**
 */
export const runCampaignFormUpdate = async (body: FormBody): Promise<FormResult> => {
    const brand = str(body.brand);
    const campaignId = str(body.campaign_id);
    const campaign = str(body.campaign);

    if (brand === '' || campaignId === '') {
        return { status: 'error', message: 'ブランドとキャンペーンIDは必須です。' };
    }

    const sets = [
        'registered_date = ?', 'campaign = ?', 'mail_to = ?', 'mail_cc = ?',
        'redirect = ?', 'thanks = ?', ...JSON_COLUMNS.map(key => `${key} = ?`),
    ];

    const values = [
        today(), campaign, str(body.mail_to), str(body.mail_cc), str(body.redirect),
        body.thanks === true || body.thanks === 1 || body.thanks === '1' ? 1 : 0,
        ...JSON_COLUMNS.map(key => jsonText(body[key])),
        brand, campaignId,
    ];

    const result = await execute(
        `UPDATE form_table SET ${sets.join(', ')} WHERE brand = ? AND campaign_id = ?`,
        values
    );

    /**
     * ⚠️⚠️ **更新できなかったことを黙って成功にしない。**
     *   ⚠️ 移植元は execute() が例外を投げなければ常に success を返しており、
     *     **0行更新でも「修正に成功しました」と出ていた。**
     */
    if (result.affectedRows === 0) {
        return { status: 'error', message: `${campaign}が見つかりませんでした。` };
    }

    return { status: 'success', message: `${campaign}の修正に成功しました。` };
};

// ---------------------------------------------------------------------------
// ブランド既定値（form_database）
// ---------------------------------------------------------------------------

/**
 * ブランドごとのフォーム既定値。
 *
 * ⚠️ 移植元は成功時に**行をそのまま**（status を付けずに）返している。
 *   画面がその形を見ているため、ここでも同じにする。
 */
export const runCampaignFormMaster = async (body: FormBody): Promise<unknown> => {
    const brand = str(body.brand);

    const rows = await query<FormRow>('SELECT * FROM form_database WHERE brand = ? LIMIT 1', [brand]);

    if (rows.length === 0) {
        return { status: 'not_found', message: '該当するブランドが見つかりません' };
    }

    return rows[0];
};
