import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';

/**
 * 顧客詳細モーダル（InformationEdit / InformationEditKaeru / InformationEditResale）
 * の初期データ。
 *
 * 移植元:
 *   order → backend/src/handlers/informationAction/information_order.php
 *   spec  → backend/src/handlers/informationAction/information_spec.php
 *   used  → backend/src/handlers/informationAction/information_used.php
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **3つは「似ているだけの別物」である。**
 *
 *   見た目がほぼ同じなので共通化したくなるが、以下がすべて違う。
 *   揃えると本番のプルダウンの中身が変わる。
 *
 *              order              spec                    used
 *   shop       全件（絞りなし）    division+show_flag で絞る   **キー自体が無い**
 *   shop の列  multi/report_flag  あり／なし が違う          −
 *   staff の列 position なし      position なし             **position あり**
 *   medium     medium_list        medium_kaeru              medium_resale
 *   medium の列 2列だけ            SELECT *                  SELECT *
 *   property   キー無し            あり                      あり
 *   broker     キー無し            キー無し                  **あり**
 *   顧客テーブル master_data        master_data_kaeru         master_data_resale
 *
 *   ⚠️ used に shop が無いのは移植漏れではない。
 *     InformationEditResale.tsx は shop を参照していない。
 *     足すと ① の PHP と JSON のキーが変わる。
 * ─────────────────────────────────────────────
 *
 * ⚠️ この request には ① に PHP ハンドラが**実在する**（information.php）。
 *   そのため許可リスト（express_proxy.php）には
 *   **参照のみのこれら3件だけ**を書いてよい。
 *   roll 付きの書き込み系（customer_info / update_call_log /
 *   update_interview_log / log）を足すと、転送失敗時の自動フォールバックで
 *   ① でも実行され二重登録になる。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/**
 * PHP が `new stdClass()` を返す箇所。JSON では `{}` になる。
 *
 * ⚠️ `null` にしないこと。フロントは
 *   `response.data.call.id ?? response.data.customer.id` のように
 *   プロパティを直接読むため、null だと実行時エラーになる。
 */
type EmptyObject = Record<string, never>;

const EMPTY: EmptyObject = {};

// ---------------------------------------------------------------------------
// マスタのSQL
//
// ⚠️ SELECT * のものは列を書き出さない。
//   ① でテーブルに列が追加されたとき、Express だけが古い形を返してしまう。
// ---------------------------------------------------------------------------

/** ⚠️ order は shop_list を**絞っていない**。非表示店舗も含めて全件返す */
const SHOP_SQL_ORDER =
  'SELECT brand, shop, division, section, multi, report_flag FROM shop_list';

/**
 * ⚠️ spec だけ絞り込みがある。しかも列も order と違う（multi / report_flag が無い）。
 *   order と同じ SQL に揃えると、建売の店舗プルダウンに全店舗が並ぶ。
 */
const SHOP_SQL_SPEC =
  "SELECT brand, shop, division, section FROM shop_list WHERE division = '建売分譲事業' AND show_flag = 1";

const STAFF_SQL = 'SELECT name, shop, category, section, period FROM staff_list WHERE category = 1';

/** ⚠️ used だけ position を含む。列を揃えないこと */
const STAFF_SQL_USED =
  'SELECT name, shop, category, section, period, position FROM staff_list WHERE category = 1';

/**
 * ⚠️ order の medium だけ2列しか返さない（medium, list_medium）。
 *   SELECT * に変えると id 等が増えてキーの形が変わる。
 */
const MEDIUM_SQL_ORDER =
  'SELECT medium, list_medium FROM medium_list WHERE response_medium = 0';

const MEDIUM_SQL_SPEC = 'SELECT * FROM medium_kaeru';

const MEDIUM_SQL_USED = 'SELECT * FROM medium_resale';

const PROPERTY_SQL = 'SELECT * FROM property_db';

const MAKER_SQL = 'SELECT * FROM house_maker';

/**
 * ⚠️ この `introductory` は**紹介元区分マスタ**（19行）である。
 *   GAS からの反響を受ける `inquiry_introductory` とは**別のテーブル**。
 *   名前が似ているだけの別物。
 */
const INTRODUCTORY_SQL = 'SELECT * FROM introductory';

// ---------------------------------------------------------------------------
// 個別データのSQL
// ---------------------------------------------------------------------------

const CALL_SQL = 'SELECT * FROM call_sheet WHERE id = ?';

const INTERVIEW_SQL = 'SELECT * FROM interview_sheet WHERE id = ?';

const PDF_SQL = 'SELECT * FROM competitor_pdf WHERE id = ?';

const BROKER_SQL = 'SELECT * FROM brokerage_listings WHERE master_data_id = ?';

/**
 * category → 顧客テーブル名。
 *
 * ⚠️ この対応表以外の値を受け付けないこと。
 *   テーブル名は SQL に直接埋め込むため、外部からの値をそのまま通すと
 *   SQL インジェクションになる。
 */
const CUSTOMER_TABLES = {
  order: 'master_data',
  spec: 'master_data_kaeru',
  used: 'master_data_resale',
} as const;

export type InformationCategory = keyof typeof CUSTOMER_TABLES;

/**
 * 個別データを引くべきか。
 *
 * ⚠️ PHP の `if ($id !== '' && $id !== 'new')` と完全に同じ条件。
 *   'new'（新規登録）のときはマスタだけを返し、顧客・架電・面談・PDF は
 *   すべて `{}` を返すのが既存の挙動。
 */
const hasIndividualData = (id: string): boolean => id !== '' && id !== 'new';

/** 1件取得。該当なしは PHP の `?: new stdClass()` と同じく `{}` */
const fetchOne = async (
  sql: string,
  id: string
): Promise<Record<string, unknown> | EmptyObject> => {
  const rows = await query<DynamicRow>(sql, [id]);
  return rows[0] ?? EMPTY;
};

/** 個別データ4点（顧客・架電・面談・競合PDF）をまとめて引く */
const fetchIndividual = async (
  tableName: string,
  id: string
): Promise<{
  customer: Record<string, unknown> | EmptyObject;
  call: Record<string, unknown> | EmptyObject;
  interview: Record<string, unknown> | EmptyObject;
  pdf: Record<string, unknown> | EmptyObject;
}> => {
  if (!hasIndividualData(id)) {
    return { customer: EMPTY, call: EMPTY, interview: EMPTY, pdf: EMPTY };
  }

  const [customer, call, interview, pdf] = await Promise.all([
    fetchOne(`SELECT * FROM ${tableName} WHERE id = ?`, id),
    fetchOne(CALL_SQL, id),
    fetchOne(INTERVIEW_SQL, id),
    fetchOne(PDF_SQL, id),
  ]);

  return { customer, call, interview, pdf };
};

// ---------------------------------------------------------------------------
// 注文（order）
// ---------------------------------------------------------------------------

export interface InformationOrderResponse {
  staff: Record<string, unknown>[];
  shop: Record<string, unknown>[];
  medium: Record<string, unknown>[];
  customer: Record<string, unknown> | EmptyObject;
  call: Record<string, unknown> | EmptyObject;
  interview: Record<string, unknown> | EmptyObject;
  maker: Record<string, unknown>[];
  introductory: Record<string, unknown>[];
  pdf: Record<string, unknown> | EmptyObject;
}

const runInformationOrder = async (id: string): Promise<InformationOrderResponse> => {
  const [staff, shop, medium, maker, introductory, individual] = await Promise.all([
    query<DynamicRow>(STAFF_SQL),
    query<DynamicRow>(SHOP_SQL_ORDER),
    query<DynamicRow>(MEDIUM_SQL_ORDER),
    query<DynamicRow>(MAKER_SQL),
    query<DynamicRow>(INTRODUCTORY_SQL),
    fetchIndividual(CUSTOMER_TABLES.order, id),
  ]);

  // ⚠️ キーの順序も PHP の $result と同じにする。
  //   JSON のキー順が変わるとバイト単位の比較で差分になる。
  return {
    staff,
    shop,
    medium,
    customer: individual.customer,
    call: individual.call,
    interview: individual.interview,
    maker,
    introductory,
    pdf: individual.pdf,
  };
};

// ---------------------------------------------------------------------------
// 建売（spec）
// ---------------------------------------------------------------------------

export interface InformationSpecResponse {
  staff: Record<string, unknown>[];
  shop: Record<string, unknown>[];
  medium: Record<string, unknown>[];
  property: Record<string, unknown>[];
  customer: Record<string, unknown> | EmptyObject;
  call: Record<string, unknown> | EmptyObject;
  interview: Record<string, unknown> | EmptyObject;
  maker: Record<string, unknown>[];
  introductory: Record<string, unknown>[];
  pdf: Record<string, unknown> | EmptyObject;
}

const runInformationSpec = async (id: string): Promise<InformationSpecResponse> => {
  const [staff, shop, medium, property, maker, introductory, individual] = await Promise.all([
    query<DynamicRow>(STAFF_SQL),
    query<DynamicRow>(SHOP_SQL_SPEC),
    query<DynamicRow>(MEDIUM_SQL_SPEC),
    query<DynamicRow>(PROPERTY_SQL),
    query<DynamicRow>(MAKER_SQL),
    query<DynamicRow>(INTRODUCTORY_SQL),
    fetchIndividual(CUSTOMER_TABLES.spec, id),
  ]);

  // ⚠️ order と違い property が shop の次に入る。PHP の順序どおり
  return {
    staff,
    shop,
    medium,
    property,
    customer: individual.customer,
    call: individual.call,
    interview: individual.interview,
    maker,
    introductory,
    pdf: individual.pdf,
  };
};

// ---------------------------------------------------------------------------
// 中古（used）
// ---------------------------------------------------------------------------

export interface InformationUsedResponse {
  staff: Record<string, unknown>[];
  medium: Record<string, unknown>[];
  property: Record<string, unknown>[];
  customer: Record<string, unknown> | EmptyObject;
  call: Record<string, unknown> | EmptyObject;
  interview: Record<string, unknown> | EmptyObject;
  maker: Record<string, unknown>[];
  introductory: Record<string, unknown>[];
  pdf: Record<string, unknown> | EmptyObject;
  /**
   * ⚠️⚠️ 該当なしのとき **`false`** を返す。`{}` ではない。
   *
   *   PHP は `$stmt->fetch()` の結果をそのまま入れており、
   *   他の4点（customer / call / interview / pdf）にある
   *   `?: new stdClass()` が **broker には付いていない**。
   *   `{}` に揃えると InformationEditResale.tsx の
   *   真偽判定（`if (response.data.broker)`）の結果が変わる。
   */
  broker: Record<string, unknown> | false;
}

const runInformationUsed = async (id: string): Promise<InformationUsedResponse> => {
  const [staff, medium, property, maker, introductory, brokerRows, individual] =
    await Promise.all([
      query<DynamicRow>(STAFF_SQL_USED),
      query<DynamicRow>(MEDIUM_SQL_USED),
      query<DynamicRow>(PROPERTY_SQL),
      query<DynamicRow>(MAKER_SQL),
      query<DynamicRow>(INTRODUCTORY_SQL),
      // ⚠️ broker だけ id の判定より**前**で実行される。
      //   PHP は `if ($id !== '' && ...)` の外に書いているため、
      //   id が空でも 'new' でも問い合わせが走る（当然ヒットしない）。
      //   ブロックの中に移すと、無駄なクエリは減るが挙動は同じ。
      //   PHP と1対1に保つためここに置いている。
      query<DynamicRow>(BROKER_SQL, [id]),
      fetchIndividual(CUSTOMER_TABLES.used, id),
    ]);

  // ⚠️ shop キーは無い。足さないこと（PHP に無いため）
  return {
    staff,
    medium,
    property,
    customer: individual.customer,
    call: individual.call,
    interview: individual.interview,
    maker,
    introductory,
    pdf: individual.pdf,
    broker: brokerRows[0] ?? false,
  };
};

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

export type InformationInitResponse =
  | InformationOrderResponse
  | InformationSpecResponse
  | InformationUsedResponse;

/**
 * @param category ゲートウェイのレジストリで既知の値のみ登録しているため、
 *   未知の値がここへ来ることはない（① の PHP へ転送される）。
 * @param id 顧客ID。'' または 'new' のときはマスタのみを返す。
 */
export const runInformationInit = async (
  category: InformationCategory,
  id: string
): Promise<InformationInitResponse> => {
  switch (category) {
    case 'order':
      return runInformationOrder(id);
    case 'spec':
      return runInformationSpec(id);
    case 'used':
      return runInformationUsed(id);
  }
};
