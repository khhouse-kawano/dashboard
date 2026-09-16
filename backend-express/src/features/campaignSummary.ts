import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * キャンペーン別の集計（campaign/CampaignSummary.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 移植元: `backend/src/handlers/campaignSummary.php`
 *
 * ⚠️⚠️ **列名・別名は移植元から1文字も変えないこと。**
 *   ⚠️ 画面は `register` / `interview` / `screening` / `appointment` /
 *     `contract` の5つを**日付文字列のまま**受け取り、
 *     「値があるか」で来場数・次アポ数・契約数を数えている。
 *   ⚠️ 別名を変えると集計が全部0になる（エラーは出ない）。
 *
 * ⚠️⚠️ **`step_migration_item_...` のどれがどの段階かは
 *   DB のコメントではなく、この対応表を正とすること。**
 *     01J82Z5F13B6QVM6X0TCWZHW99 … 反響日（register）
 *     01J82Z5F1GQB02S1DEBZPBFDW7 … 初回面談（interview）
 *     01JSE0CRECT96FMYTZ1ZREC3QR … 資金審査（screening）
 *     01JSENACS2FC422ZHEZWNSXNYA … 次アポ（appointment）
 *     01J82Z5F1RR18Z792C7KZS88QG … 契約（contract）
 *
 * ⚠️ 絞り込み（期間・ブランド・店舗・キャンペーン名）は**画面に残す**。
 *   ⚠️ 期間の起点が画面側の定数（getYearMonthArray(2025, 6)）で、
 *     ここに写すと**片方だけ変わって食い違う**ため。
 * ─────────────────────────────────────────────
 */

interface CampaignRow extends RowDataPacket {
    register: string;
    hp_campaign: string;
    in_charge_store: string;
}

interface ShopRow extends RowDataPacket {
    brand: string;
    shop: string;
}

/**
 * ⚠️ `hp_campaign <> ''` は移植元のまま。
 *   ⚠️ キャンペーン名の無い反響は集計の対象外（画面も使っていない）。
 */
const CAMPAIGN_SQL = `
  SELECT
    COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') AS register,
    COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') AS interview,
    COALESCE(step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') AS screening,
    COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') AS appointment,
    COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') AS contract,
    COALESCE(hp_campaign, '') AS hp_campaign,
    COALESCE(in_charge_store, '') AS in_charge_store
  FROM master_data
  WHERE hp_campaign <> ''
`;

/** ⚠️ `show_flag = 1` は移植元のまま。閉店した店舗を選択肢に出さないため */
const SHOP_SQL = `
  SELECT brand, shop, section, area
  FROM shop_list
  WHERE show_flag = 1
`;

export const runCampaignSummary = async (): Promise<{
    campaign: CampaignRow[];
    shop: ShopRow[];
}> => {
    // ⚠️ 移植元と同じく2つまとめて返す。画面が1回の通信で両方使う
    const [campaign, shop] = await Promise.all([
        query<CampaignRow>(CAMPAIGN_SQL),
        query<ShopRow>(SHOP_SQL),
    ]);
    return { campaign, shop };
};
