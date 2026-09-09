/**
 * funding_plan の列定義。
 *
 * ⚠️⚠️ **このファイルは自動生成である。手で編集しないこと。**
 *   元データ: C:/Users/shinji-kawano/Downloads/AIデジタル資金計画書.html の data-k 属性
 *   生成物  : backend/scripts/sql/2026-09-08_funding_plan.sql と同じ列・同じ型
 *
 *   HTMLの入力欄を増やしたら
 *     1. SQL に ALTER TABLE で列を足す
 *     2. このファイルの配列に列名を足す
 *   の両方が必要。片方だけだと「画面では入力できるのに保存されない」状態になる。
 *
 * ⚠️ 列名は HTML の data-k と1文字も違わない。変換表を持たないための設計。
 */

/** 文字列で保存する列（text / select / textarea） */
export const TEXT_COLUMNS = [
  'k_name', 'k_kana', 'k_shop', 'k_staff', 'k_addr', 'k_tel', 'k_mail', 'k_now', 'k_h_name',
  'k_h_work', 'k_w_name', 'k_w_work', 'k_trigger_etc', 'k_area', 'k_style', 'k_landhave',
  'k_makers', 'k_landwish', 'k_worry', 'k_youbou', 'k_memo', 's_kenchikuchi', 's_m_bank',
  's_p_bank', 's_bikou', 'g_type', 'g_setai', 'g_mode', 'v_houi', 'v_tax', 'v_batUse', 'x_e1n',
  'x_e2n', 'x_e3n', 'x_h9n', 'x_h10n', 'x_w9n', 'x_w10n', 'x_c2n', 'ln_source', 'ln_feedUrl',
  'bk_incFee', 'bk_memo', 'bk_apply1', 'bk_apply2', 'bk_apply3',
] as const;

/**
 * 数値で保存する列。すべて DECIMAL(14,3)。
 *
 * ⚠️ 単位は列によって違う（万円 / 円 / ㎡ / 坪 / 年 / %）。
 *   ここでは区別していない。換算が必要なのは master_data との連携時だけで、
 *   それは mapping.ts が持つ。
 */
export const NUMBER_COLUMNS = [
  'k_h_age', 'k_w_age', 'k_inc1', 'k_inc2', 'k_jiko', 'k_enjo', 'k_chochiku', 'k_rent',
  'k_park', 'k_elec', 'k_gas', 'k_l1', 'k_l2', 'k_l3', 'k_lb', 'k_timing', 'k_tsubo', 'k_yuka',
  'k_hope', 'd_tatemono', 'd_futai', 'd_solarKw', 'd_shohi', 'd_tochi', 'd_yobi', 'd_bonus',
  'd_years', 'd_rate', 'd_danshin', 'd_kounetsuRate', 's_landM2', 's_f1', 's_f2', 's_sekou',
  's_m_kari', 's_m_bonus', 's_m_years', 's_m_rate', 's_p_kari', 's_p_bonus', 's_p_years',
  's_p_rate', 'g_income', 'g_fuyou', 'g_shotoku', 'g_juumin', 'v_panelW', 'v_koubai', 'v_keisu',
  'v_baiden', 'v_kaiden', 'v_jika', 'v_cost', 'v_years', 'v_batKwh', 'v_batCost', 'v_batHojo',
  'v_batEff', 'v_batNight', 't_wait', 't_upRate', 't_futureRate', 't_yRate', 't_y1', 't_y2',
  't_kidAge', 't_addPay', 'f_up', 'f_tedori', 'f_teinen', 'f_saikoyo', 'f_taishoku', 'f_nenkin',
  'f_seikatsu', 'f_kotei', 'f_shuzen', 'f_hoken', 'f_carCycle', 'f_carCost', 'f_other',
  'x_shokuhi', 'x_suido', 'x_water', 'x_tel', 'x_net', 'x_iryo', 'x_leisure', 'x_shinbun',
  'x_ifuku', 'x_nhk', 'x_e1', 'x_e2', 'x_e3', 'x_choSou', 'x_choTsuki', 'x_choBonus', 'x_incH',
  'x_incW', 'x_incE', 'x_h1', 'x_h2', 'x_h3', 'x_h4', 'x_h5', 'x_h6', 'x_h7', 'x_h8', 'x_h9',
  'x_h10', 'x_w1', 'x_w2', 'x_w3', 'x_w4', 'x_w5', 'x_w6', 'x_w7', 'x_w8', 'x_w9', 'x_w10',
  'x_c1', 'x_c2', 'bk_kari', 'bk_years',
] as const;

/**
 * 日付の列。
 *
 * ⚠️ 空文字は NULL で保存する。DATE 型に '' を入れると
 *   MariaDB は '0000-00-00' にするか、strict モードでエラーにする。
 */
export const DATE_COLUMNS = [
  'k_date', 'k_h_birth', 'k_w_birth', 'w_start', 'ln_asof',
] as const;

/** 真偽値（チェックボックス）の列。TINYINT(1) */
export const BOOL_COLUMNS = [
  'x_auto',
] as const;

/**
 * 配列で持つ列。JSON 型（MariaDB では LONGTEXT のエイリアス）。
 *
 * ⚠️⚠️ MariaDB の JSON は LONGTEXT なので、mysql2 は**文字列のまま**返す。
 *   （MySQL の本物の JSON 型なら自動でパースされるが、pool.ts が
 *     jsonStrings:true にしているため、どちらでも文字列で揃う）
 *   受け取り側で JSON.parse すること。
 */
export const JSON_COLUMNS = [
  'kids', 'k_trigger', 's1', 's2', 's3', 's4', 's5', 'loans', 'w_days', 'w_done',
] as const;

/** 保存対象の全列（id と管理用の列は含まない） */
export const ALL_VALUE_COLUMNS: readonly string[] = [
  ...TEXT_COLUMNS,
  ...NUMBER_COLUMNS,
  ...DATE_COLUMNS,
  ...BOOL_COLUMNS,
  ...JSON_COLUMNS,
];

export type FundingPlanColumn = (typeof ALL_VALUE_COLUMNS)[number];
