import apiClient from '../../utils/apiClient';

/**
 * キャンペーンフォームの設定（`form_table`）を読み書きする。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-16。① の別API から ② Express へ移した。**
 *
 *   旧: `https://khg-marketing.info/api/` に `Authorization: form_list` 等で直接
 *   新: dashboard のゲートウェイ経由 → ② の `campaign_form:*`
 *
 *   ⚠️ 旧は**ダッシュボードの認証をまったく通っていなかった**
 *     （`Authorization` をルーティングに使っていたため、Token も送っていない）。
 *     ⚠️ URL を知っていれば誰でも全ブランドのフォーム設定を読み書きできた。
 *   ⚠️ `apiClient` を使うと Token が自動で付き、② 側で `auth: 'staff'` が効く。
 *
 * ⚠️⚠️ **`Authorization` ヘッダを自分で上書きしないこと。**
 *   ⚠️ 上書きすると apiClient の認証が壊れ、② が401を返す。
 *
 * ⚠️ 公開フォーム側（react/form_get）は**ここを通らない**。
 *   あちらは ② を直接叩き、失敗したら ① へ回す（別の経路）。
 * ─────────────────────────────────────────────
 */

/** ② が返す形。⚠️ 移植元の PHP と同じキーにしてある */
export interface CampaignApiResult<T = unknown> {
    status: 'success' | 'empty' | 'duplicate' | 'error' | 'not_found';
    data?: T;
    message?: string;
}

/** 一覧に出す1行 */
export interface CampaignListRow {
    registered_date: string;
    brand: string;
    url: string;
    tag: string;
    campaign: string;
    campaign_id: string;
}

/** `form_table` の1行。⚠️ JSON 列は文字列のまま入っている */
export type CampaignRow = Record<string, string>;

const call = async <T>(roll: string, body: Record<string, unknown>): Promise<T> => {
    const res = await apiClient.post('', { request: 'campaign_form', roll, ...body });
    return res.data as T;
};

/** ブランドのフォーム一覧 */
export const fetchList = (brand: string) =>
    call<CampaignApiResult<CampaignListRow[]>>('list', { brand });

/** 編集用に1件取る。⚠️ 移植元が `id` というキーで campaign_id を送っていたので合わせる */
export const fetchDetail = (brand: string, campaignId: string) =>
    call<CampaignApiResult<CampaignRow>>('detail', { brand, id: campaignId });

/** ブランドごとの既定値（form_database）。⚠️ 行がそのまま返る（status で包まれない） */
export const fetchMaster = (brand: string) =>
    call<CampaignRow & { status?: string; message?: string }>('master', { brand });

/** 新規登録 */
export const insertCampaign = (form: Record<string, unknown>) =>
    call<CampaignApiResult>('insert', form);

/** 更新 */
export const updateCampaign = (form: Record<string, unknown>) =>
    call<CampaignApiResult>('update', form);
