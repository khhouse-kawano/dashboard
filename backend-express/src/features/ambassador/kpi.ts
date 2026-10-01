import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import type { AmbassadorResult } from './index';

/**
 * アンバサダー台帳のKPI（紹介した顧客の歩留まり）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面: header/AmbassadorList.tsx
 *
 * ⚠️⚠️ **顧客1件につき1行を返すだけで、集計はしない。**
 *   ⚠️ 歩留まりの判定は**画面側**で行う（shopTrend と同じやり方に揃えるため）。
 *   ⚠️ ⚠️ **モーダルで一覧を出すのに結局その行が要る**ので、
 *     サーバーで数だけ返すと**同じものを2回取りに行くことになる。**
 *
 * ⚠️⚠️ **`ambassador_list` には足していない。**
 *   ⚠️ 台帳は1セルずつ保存するたびに一覧を引き直す画面であり、
 *     ⚠️ **保存のたびに3テーブルを舐めることになる。**
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **反響は同期先が3つに分かれる。**
 *
 *   注文 → master_data
 *   建売 → master_data_kaeru
 *   中古 → master_data_resale
 *
 *   ⚠️ 紐づけは `inquiry_ambassador.master_data_id`。
 *     ⚠️⚠️ **名前は master_data_id だが、建売・中古の id も入る**
 *       （⚠️ features/ambassador/index.ts の同期処理を参照）。
 *
 *   ⚠️ ⚠️ **初回面談・次アポ・事前審査の列は3区分で共通。**
 *     ⚠️⚠️ **違うのは契約日の列だけ**なので、そこだけ切り替える。
 * ─────────────────────────────────────────────
 */

/**
 * 契約日の列。⚠️⚠️ **区分ごとに違う。**
 *
 * ⚠️ 移植元は features/shopTrend/queries.ts。⚠️ **あちらを直したらここも直すこと。**
 *   ⚠️ ⚠️ **列を取り違えると「契約0件」が静かに出来上がる**（エラーにならない）。
 *
 * ⚠️ 中古は契約の種類が3つある（買い・売り・リフォーム）。
 *   ⚠️⚠️ **どれか1つでも入っていれば契約**として扱う。
 *   ⚠️ 建売の `contract_broker`（仲介）も同じ扱い。
 */
const CONTRACT_COLUMNS: Record<string, string[]> = {
  master_data: ['step_migration_item_01J82Z5F1RR18Z792C7KZS88QG'],
  master_data_kaeru: [
    'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
    'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0',
  ],
  master_data_resale: [
    // 買い
    'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
    // 売り
    'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0',
    // リフォーム
    'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
  ],
};

/**
 * 3区分で共通の列。
 *
 * ⚠️⚠️ **`appointment` は第二面談（01JSENACS…）である。**
 *   ⚠️ ⚠️ **DBのコメントは当てにならない。** 列IDで指定すること
 *     （⚠️ 過去に別の列を掴んで数が合わなくなった経緯がある）。
 */
const COMMON_SELECT = `
      COALESCE(m.customer_contacts_name, '')                       AS customer,
      COALESCE(m.in_charge_store, '')                              AS shop,
      COALESCE(m.in_charge_user, '')                               AS staff,
      COALESCE(m.status, '')                                       AS status,
      COALESCE(m.step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '') AS register,
      COALESCE(m.step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') AS interview,
      COALESCE(m.step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') AS appointment,
      COALESCE(m.step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR, '') AS screening`;

/**
 * 1区分ぶんのSQL。
 *
 * ⚠️⚠️ **`show_dashboard = 1` は付けない。**
 *   ⚠️ shopTrend は付けているが、あちらは**全社の集計**であり、
 *     対象外にした顧客を数えないための条件である。
 *   ⚠️ ⚠️ **こちらは「このアンバサダーが連れてきた人」の追跡**なので、
 *     ⚠️⚠️ **落とすと「同期したのに一覧から消えた」ように見える。**
 *
 * ⚠️ `i.no` を返すこと。⚠️ 画面側で反響と顧客を対応づけるのに使う。
 */
/**
 * その顧客テーブルに入る事業区分。
 *
 * ⚠️⚠️ **突合は `master_data_id` だけで行わない。`division` と組で見る。**
 *   ⚠️ ⚠️ **id は3つのテーブルで重複しうる**（⚠️ ULIDを別々に採番している）。
 *     ⚠️ 区分を見ないと、⚠️⚠️ **注文の反響が中古の顧客に当たって
 *       同じ反響が2回数えられる**ことがある。
 *   ⚠️ ⚠️ **同期先は区分で決まっている**（features/ambassador/index.ts）。
 *     ⚠️ 区分で絞るのが本来の姿である。
 */
const DIVISION_OF: Record<string, string> = {
  master_data: '注文',
  master_data_kaeru: '建売',
  master_data_resale: '中古',
};

const selectFor = (table: string): string => {
  const contract = CONTRACT_COLUMNS[table];

  // ⚠️ 複数ある場合は「最初に入っている値」を契約日とする。
  //   ⚠️ COALESCE は NULL しか飛ばさないため、空文字を NULL に直してから渡す
  const contractExpr =
    contract.length === 1
      ? `COALESCE(m.${contract[0]}, '')`
      : `COALESCE(${contract.map((c) => `NULLIF(m.${c}, '')`).join(', ')}, '')`;

  return `
    SELECT i.no          AS inquiry_no,
           i.ambassador_no,
           i.division,
           m.id,
           ${contractExpr} AS contract,
           ${COMMON_SELECT}
      FROM inquiry_ambassador i
      JOIN ${table} m ON m.id = i.master_data_id
     WHERE i.ambassador_no IS NOT NULL
       AND i.sync = 1
       AND COALESCE(i.master_data_id, '') <> ''
       -- ⚠️⚠️ **区分でも絞る。** ⚠️ id だけで突合すると、
       --   ⚠️ 別テーブルの同じ id に当たって**同じ反響が2回数えられる。**
       AND i.division = ?
  `;
};

interface CustomerRow extends RowDataPacket {
  inquiry_no: number;
  ambassador_no: number;
  division: string | null;
  id: string;
  customer: string;
  shop: string;
  staff: string;
  status: string;
  register: string;
  interview: string;
  appointment: string;
  screening: string;
  contract: string;
}

/** 未同期を含む反響の総数。⚠️ **総反響はこちらで数える** */
interface InquiryRow extends RowDataPacket {
  ambassador_no: number;
  inquiry_no: number;
  name: string | null;
  inquiry_date: string | null;
  sync: number;
  division: string | null;
  master_data_id: string | null;
}

const INQUIRY_SQL = `
  SELECT ambassador_no,
         \`no\` AS inquiry_no,
         name,
         inquiry_date,
         sync,
         division,
         master_data_id
    FROM inquiry_ambassador
   WHERE ambassador_no IS NOT NULL
   ORDER BY inquiry_date DESC, \`no\` DESC
`;

/**
 * アンバサダーごとのKPIの材料を返す。
 *
 * ⚠️⚠️ **集計せず、行をそのまま返す。** 画面側が数える。
 *
 * ⚠️ 3区分を別々に引いて結合している。
 *   ⚠️ ⚠️ **UNION にしないのは、契約日の列が区分ごとに違うため。**
 *     ⚠️ 無理に1本にすると、どの区分の契約を見ているのかが読めなくなる。
 *
 * ⚠️ 件数は多くない（⚠️ **反響そのものが台帳に紐づくものだけ**）。
 *   ⚠️ 将来increaseしたら、画面側の集計をサーバーへ寄せることを検討する。
 */
export const runAmbassadorKpi = async (): Promise<AmbassadorResult> => {
  // ⚠️ 区分は値なのでプレースホルダで渡す。⚠️ テーブル名だけが組み立て
  const forTable = (table: string) =>
    query<CustomerRow>(selectFor(table), [DIVISION_OF[table]]);

  const [inquiry, order, spec, used] = await Promise.all([
    query<InquiryRow>(INQUIRY_SQL),
    forTable('master_data'),
    forTable('master_data_kaeru'),
    forTable('master_data_resale'),
  ]);

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      // ⚠️ 総反響の母数。⚠️ **未同期も含む**
      inquiry,
      // ⚠️ 同期済みで顧客が実在するものだけ。⚠️ 歩留まりはこちらで数える
      customer: [...order, ...spec, ...used],
    },
  };
};
