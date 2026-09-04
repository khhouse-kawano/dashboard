import { randomBytes } from 'node:crypto';
import type { Tx } from '../db/pool';

/**
 * 反響を顧客として取り込む処理の共通部分。
 *
 * 公式アンバサダー（features/ambassador）と
 * お友達紹介キャンペーン（features/introductory）の両方が使う。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **事業区分ごとに顧客テーブルと列の使い方が違う。**
 *
 *   注文 → master_data         in_charge_store = 店舗名（例: KH熊本店）
 *   建売 → master_data_kaeru   in_charge_store = 店舗名（例: 鹿児島1係）
 *   中古 → master_data_resale  in_charge_store = **取引区分**（買い:中古リノベ）
 *
 *   中古だけ in_charge_store に店舗名が入っていない。既存データ（本番・ローカル
 *   ともに in_charge_store は '買い:中古リノベ' / '売り:ポータル' /
 *   '買い:ポータル' の3値しか無い）と ListResale.tsx の同期処理に合わせている。
 *   ここに店舗名を入れると中古の顧客一覧で「店舗」列が別物になる。
 *
 *   分岐をこのファイル1か所に閉じ込めているのは、機能を追加するたびに
 *   同じ分岐を書き写して片方だけ直す事故を防ぐため。
 * ─────────────────────────────────────────────
 *
 * ⚠️ テーブル名は必ず DIVISIONS から取ること。
 *   リクエストの値をそのままSQLに埋めると任意のテーブルへ INSERT できる。
 */

/** 選べる事業区分。⚠️ 画面側の select もこの3つに合わせる */
export const DIVISION_KEYS = ['注文', '建売', '中古'] as const;

export type DivisionKey = (typeof DIVISION_KEYS)[number];

export interface DivisionSpec {
  /** 同期先の顧客テーブル。⚠️ ここ以外からテーブル名を組み立てないこと */
  table: string;
  /** 担当店舗の選択肢を絞るための shop_list.division の値 */
  shopDivision: string;
  /**
   * 顧客テーブルに入れる category。
   *
   * ⚠️ 既存データは事業ごとに表記が割れている
   *   （master_data は '注文' と 'order'、master_data_kaeru は '建売' と 'spec'）。
   *   顧客一覧はテーブル単位で取得しており category で絞っていないため、
   *   どちらでも一覧からは消えない。日本語表記のほうに揃えている。
   */
  category: string;
  /**
   * in_charge_store に店舗名を入れるか。
   *
   * ⚠️ 中古のみ false。代わりに `storeValue` を入れる。
   */
  storeIsShop: boolean;
  /** storeIsShop = false のときに in_charge_store と category に入れる値 */
  storeValue?: string;
  /** 担当営業が未設定のときの in_charge_user の作り方 */
  fallbackUser: (shop: string) => string;
}

export const DIVISIONS: Record<DivisionKey, DivisionSpec> = {
  // ⚠️ ListOrder（listAction/list_insert.php）と同じ規則に合わせている
  注文: {
    table: 'master_data',
    shopDivision: '注文事業',
    category: '注文',
    storeIsShop: true,
    fallbackUser: (shop) => `${shop} 管理`,
  },
  // ⚠️ ListKaeru と同じ。店舗名は '鹿児島1係' のような係名になる
  建売: {
    table: 'master_data_kaeru',
    shopDivision: '建売分譲事業',
    category: '建売',
    storeIsShop: true,
    fallbackUser: (shop) => `${shop} 管理`,
  },
  // ⚠️ ListResale と同じ。紹介・アンバサダー経由の反響は買主なので「買い」側に置く。
  //   売却（売り:ポータル）は媒介の相談であり、この導線からは来ない。
  中古: {
    table: 'master_data_resale',
    shopDivision: '中古リノベ',
    category: '買い:中古リノベ',
    storeIsShop: false,
    storeValue: '買い:中古リノベ',
    // ⚠️ ListResale は '中古住宅専門店 店舗管理' を固定で入れている。
    //   選んだ店舗（中古住宅専門店 / 不動産企画係）を活かした形にする
    fallbackUser: (shop) => `${shop} 店舗管理`,
  },
};

/**
 * リクエストの事業区分を検証する。
 *
 * ⚠️ 既定値を返さない。不正な値を黙って '注文' にすると、
 *   建売のつもりで押した同期が注文事業の顧客を作る。
 *   呼び出し側で 400 を返すこと。
 */
export const parseDivision = (value: unknown): DivisionKey | null => {
  const text = typeof value === 'string' ? value.trim() : '';
  return (DIVISION_KEYS as readonly string[]).includes(text) ? (text as DivisionKey) : null;
};

/**
 * ULID。同期で作る顧客の id に使う。
 *
 * ⚠️ フロントの utils/createULID.ts と**同じ形式**にする（先頭 '01' ＋ 32文字）。
 *   既存データと形が違うと、ID の長さや接頭辞を前提にした処理が壊れる。
 *   本来の ULID（時刻順）ではないが、既存の採番に合わせている。
 */
const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const generateUlid = (): string => {
  const bytes = randomBytes(24);
  let out = '01';
  for (const byte of bytes) {
    out += ULID_CHARS[byte & 31];
  }
  return out;
};

/** 今日の日付。⚠️ 既存データと同じ `YYYY/MM/DD` 形式にする */
export const todaySlash = (): string => {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 顧客テーブルへ INSERT する内容。
 *
 * ⚠️ 列は3テーブルすべてに存在するものだけに絞っている。
 *   片方にしか無い列を足すと、その事業区分の同期だけが
 *   Unknown column で失敗する（画面上は「同期に失敗しました」しか出ない）。
 */
export interface CustomerDraft {
  shop: string;
  staff: string;
  name: string | null;
  kana: string | null;
  mobile: string | null;
  mail: string | null;
  zip: string | null;
  address: string | null;
  /** 販促媒体。⚠️ medium_list に同じ名前が無いと媒体別集計に出てこない */
  salesPromotionName: string;
  remarks: string | null;
  /** 反響取得日。core/kpi.php の KPI_MD_REGISTERED と同じ列に入る */
  inquiryDate: string | null;
}

/**
 * 顧客を1件作る。呼び出し側のトランザクションの中で使う。
 *
 * ⚠️ トランザクションの外で呼ばないこと。顧客だけ作られて
 *   反響側の sync が 0 のまま残ると、次に押したときに**顧客が二重に作られる。**
 *
 * ⚠️ `section`（課）の列は3テーブルいずれにも無い。
 *   店舗から課を引いて入れようとして Unknown column で失敗していた経緯がある。
 *   課は shop_list を JOIN して求める運用であり、顧客側には持たない。
 */
export const insertCustomer = async (
  tx: Tx,
  division: DivisionKey,
  draft: CustomerDraft
): Promise<string> => {
  const spec = DIVISIONS[division];
  const id = generateUlid();

  const store = spec.storeIsShop ? draft.shop : (spec.storeValue ?? draft.shop);

  const sql = `
    INSERT INTO \`${spec.table}\` (
      id,
      category,
      in_charge_user,
      in_charge_store,
      customer_contacts_name,
      customer_contacts_name_kana,
      customer_contacts_mobile_phone_number,
      customer_contacts_email,
      postal_code,
      full_address,
      sales_promotion_name,
      status,
      remarks,
      step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99,
      first_interviewed_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  await tx.execute(sql, [
    id,
    spec.category,
    // ⚠️ 担当営業が未設定でも空にしない。空にすると担当者別の集計から漏れる
    draft.staff === '' ? spec.fallbackUser(draft.shop) : draft.staff,
    store,
    draft.name,
    draft.kana,
    draft.mobile,
    draft.mail,
    draft.zip,
    draft.address,
    draft.salesPromotionName,
    '見込み',
    draft.remarks,
    draft.inquiryDate,
    todaySlash(),
  ]);

  return id;
};
