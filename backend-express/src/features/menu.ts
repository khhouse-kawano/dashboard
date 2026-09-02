import { z } from 'zod';
import { defineFeature } from '../core/feature';
import { route } from '../core/route';
import { query } from '../db/pool';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * メニューの通知バッジ用データ。
 *
 * 移植元: backend/src/handlers/menu.php
 *
 * ─────────────────────────────────────────────
 * ⚠️ この機能は3つのクエリを毎回全件走らせる。
 *
 *   inquiry_customer  … 全件（数万件）から4列
 *   master_data       … show_dashboard = 1 の全件から26列
 *   estate_info       … 直近3日
 *
 *   フロント（Menu.tsx）は返ってきた配列を JavaScript で filter して
 *   「未同期」「キャンセル」「失注」の件数を数えている。
 *   つまり**数万件を転送して3つの数字を得ている**。
 *
 *   本来は SQL 側で COUNT すれば数バイトで済む。ただし移植の第一段階では
 *   「PHPと同じレスポンスを返す」ことを最優先にする。形を変えると
 *   フロントの修正が必要になり、「フロントは変更しない」制約に反する。
 *
 *   ⚠️ 改善は移行が完了してから。ここで作り込むと、
 *     差分比較で一致しなくなり移植の正しさが検証できなくなる。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/**
 * 反響一覧。未同期件数の判定に使う。
 *
 * ⚠️ 除外判定（重複・業者・ブラック）はフロント側で行っている。
 *   ここでフィルタすると Menu.tsx の isPendingSync() が二重に効いてしまう
 *   わけではないが、PHPと違う結果になるため触らない。
 */
const INQUIRY_SQL = `
  SELECT inquiry_date, sync, duplicate_flag, support_flag, black_flag
    FROM inquiry_customer
`;

/**
 * 顧客一覧。
 *
 * ⚠️ 列名・COALESCE・REPLACE・STR_TO_DATE の並びを PHP から1文字も変えていない。
 *   例えば interview は '/' を '-' に置換した生の文字列、register は
 *   2種類の日付形式を試して 'YYYY-MM-DD' に正規化している。
 *   本番データには 'YYYY/MM/DD' と 'YYYY-MM-DD' が混在しているため、
 *   どちらか一方だけにすると NULL になる行が出る。
 *
 * ⚠️ trash は show_dashboard の別名。WHERE で show_dashboard = 1 に
 *   絞っているので常に 1 になるが、フロントが参照している可能性があるため残す。
 */
const CUSTOMER_SQL = `
  SELECT
    id,
    COALESCE(customer_contacts_name, '') AS customer,
    COALESCE(in_charge_store, '') AS shop,
    COALESCE(in_charge_user, '') AS staff,
    COALESCE(customized_input_01J82Z5F366ZQ897PXWF6H5ZAM, '') AS rank,
    COALESCE(REPLACE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '/', '-'), '') AS interview,
    COALESCE(
      DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y/%m/%d'), '%Y-%m-%d'),
      DATE_FORMAT(STR_TO_DATE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '%Y-%m-%d'), '%Y-%m-%d'),
      ''
    ) AS register,
    COALESCE(sales_promotion_name, '') AS medium,
    COALESCE(status, '') AS status,
    COALESCE(rank_period, '') AS rank_period,
    COALESCE(call_status, '') AS call_status,
    COALESCE(cancel_status, '') AS cancel_status,
    COALESCE(show_dashboard, 0) AS trash,
    COALESCE(REPLACE(reserved_interview, '/', '-'), '') AS reserved_interview,
    COALESCE(full_address, '') AS full_address,
    COALESCE(hp_campaign, '') AS hp_campaign,
    COALESCE(customer_contacts_mobile_phone_number, '') AS phone_number,
    COALESCE(introduction_person_category, '') AS introduction_person_category,
    COALESCE(competitor_lost_contract_reason, '') AS competitor_lost_contract_reason,
    COALESCE(competitors_text, '') AS competitors_text,
    COALESCE(competitor_name, '') AS competitor_name,
    COALESCE(customized_input_01JRCT12N9X24PCQ5QZPAYKB93, '') AS event,
    COALESCE(customized_input_01JRF9CZSW65A151WR30NA4PB3, '') AS customized_input_01JRF9CZSW65A151WR30NA4PB3,
    COALESCE(customized_input_01JSE7H4MQES619NBWX6PQDFRH, '') AS customized_input_01JSE7H4MQES619NBWX6PQDFRH,
    COALESCE(k_snap, '') AS k_snap
  FROM master_data
  WHERE show_dashboard = 1
`;

/** 新着物件。件数だけを使う */
const ESTATE_SQL = `
  SELECT registered_at
    FROM estate_info
   WHERE registered_at >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
`;

export interface MenuResponse {
  inquiry: Record<string, unknown>[];
  customer: Record<string, unknown>[];
  estate: number;
}

/**
 * menu.php と同じレスポンスを返す。
 *
 * ⚠️ 値を文字列へ変換しないこと（toPhpRows() を通してはいけない）。
 *   ① レンタルサーバーの core/db.php は
 *
 *     PDO::ATTR_EMULATE_PREPARES => false
 *
 *   を設定しており、mysqlnd がネイティブ型で返すため
 *   **PHP側も INT を数値で返している**。
 *
 *     PHP     : { "sync": 0, "duplicate_flag": 0 }
 *     mysql2  : { "sync": 0, "duplicate_flag": 0 }   ← 一致
 *
 *   最初は「PDOは全て文字列で返す」という前提で変換していたが、
 *   差分比較（2026-09-02）で誤りだと判明した。変換すると逆に壊れる。
 */
export const runMenu = async (): Promise<MenuResponse> => {
  // ⚠️ 3クエリを並列で投げる。PHPは逐次実行だが、
  //   結果は互いに独立しているため並列でも同じレスポンスになる。
  //   コネクションプール（上限10）の範囲内。
  const [inquiry, customer, estate] = await Promise.all([
    query<DynamicRow>(INQUIRY_SQL),
    query<DynamicRow>(CUSTOMER_SQL),
    query<DynamicRow>(ESTATE_SQL),
  ]);

  return {
    inquiry,
    customer,
    estate: estate.length,
  };
};

export const menu = defineFeature({
  name: 'メニュー',
  basePath: '/menu',
  routes: {
    'GET /badges': route({
      summary: 'メニューの通知バッジ用データ（未同期・キャンセル・失注・新着物件）',
      auth: true,
      query: z.object({}).optional(),
      handler: async () => runMenu(),
    }),
  },
});
