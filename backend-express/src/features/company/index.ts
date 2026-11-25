import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import {
  ACHIEVEMENT_SQL,
  CONTRACT_KAERU_SQL,
  CONTRACT_RESALE_SQL,
  CONTRACT_SQL,
  REALTY_DEALS_SQL,
  SECTION_SQL,
  SHOP_SQL,
  STAFF_SQL,
} from './queries';

/**
 * 会社実績（company/Company.tsx）。
 *
 * ─────────────────────────────────────────────
 * 移植元:
 *   backend/src/handlers/company.php                    （参照）
 *   backend/src/handlers/change_company_achievement.php （書き込み）
 *
 * ⚠️ 参照（company）は ① に PHP ハンドラが実在するので、
 *   転送に失敗したら ① にフォールバックしてよい。
 *
 * ⚠️⚠️ 書き込み（change_company_achievement）は**フォールバック禁止**に
 *   登録している。両方で実行されると company_achievement が二重に書かれる。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface CompanyResult {
  httpStatus: number;
  body: unknown;
}

export const runCompany = async (): Promise<CompanyResult> => {
  /**
   * ⚠️ 並列で投げる。PHP は逐次だったが結果は同じで、
   *   契約者一覧が数万行あるため待ち時間が縮む。
   *
   * ⚠️⚠️ **キー名と順序は PHP と同じにする。**
   *   フロントは response.data.staff / .shop / .section /
   *   .contract / .contract_kaeru / .contract_resale / .achievement
   *   をそのまま読む。
   */
  const [staff, shop, section, contract, contractKaeru, contractResale, achievement, realtyDeals] =
    await Promise.all([
      query<DynamicRow>(STAFF_SQL),
      query<DynamicRow>(SHOP_SQL),
      query<DynamicRow>(SECTION_SQL),
      query<DynamicRow>(CONTRACT_SQL),
      query<DynamicRow>(CONTRACT_KAERU_SQL),
      query<DynamicRow>(CONTRACT_RESALE_SQL),
      query<DynamicRow>(ACHIEVEMENT_SQL),
      // ⚠️ v2.2.264: 不動産企画係の商談案件（数字と担当だけ）。⚠️ ① の PHP には無いキー
      query<DynamicRow>(REALTY_DEALS_SQL),
    ]);

  return {
    httpStatus: 200,
    body: {
      staff,
      shop,
      section,
      contract,
      contract_kaeru: contractKaeru,
      contract_resale: contractResale,
      achievement,
      realty_deals: realtyDeals,
    },
  };
};

// ---------------------------------------------------------------------------
// v2.2.300 年度ごとに読む（company_year。画面は GET）
// ---------------------------------------------------------------------------

/** 契約者の行に入っている契約日の列（注文・建売の契約、建売の仲介、中古のリフォーム・購入・売却） */
const CONTRACT_DATE_KEYS = ['contract', 'contract_broker', 'contract_reform', 'contract_buy', 'contract_sell'] as const;

/** ランクの列で数えるランク（⚠️ 画面の companyAggregate.ts の RANKS と同じ。'契約済み' は契約日で数えるので含めない） */
const PROSPECT_RANKS = ['Sランク', 'Aランク', 'Bランク', 'Cランク'];

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * 日付の値を 'YYYY-MM' にする。⚠️ 読めなければ ''。
 * ⚠️ 列は文字（'2026/01/05'・'2026-1-5' など）のことも、DATE（mysql2 は Date で返す）のこともある。両方を読む。
 */
const monthKeyOf = (value: unknown): string => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : `${value.getFullYear()}-${pad2(value.getMonth() + 1)}`;
  if (typeof value !== 'string') return '';
  const m = /^\s*(\d{4})[/\-.年](\d{1,2})/.exec(value);
  return m ? `${m[1]}-${pad2(Number(m[2]))}` : '';
};

/** 年度（Y 年5月期）の月。⚠️ 画面の getPeriod(Y - 1, 6) と同じ：前年6月〜その年の5月 */
const fiscalMonths = (year: number): string[] =>
  Array.from({ length: 12 }, (_, i) => {
    const d = new Date(year - 1, 5 + i, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  });

/**
 * その年度の画面に要る契約者か。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面（companyAggregate.ts・Ranking.tsx・QuarterSummary.tsx）が見ている範囲より**狭くしないこと**。
 *   ・契約日がその年度・前年度（「昨年実績」・前年比）・今月（ランクの「契約済み」の列）のどれかの月
 *   ・ランクが S〜C（ランクの列は年度に関係なく、今の見込みを数える）
 *   ・担当 × 店舗ごとの最初の行（ランキングの人と並び。下の narrow）
 * ⚠️ 広い分には画面が年度で絞るので数字は変わらない。⚠️ 確かめ方：年度ごとに、全件で読んだ表と GET で読んだ表を比べる。
 * ─────────────────────────────────────────────
 */
const neededFor = (months: Set<string>) => (row: DynamicRow): boolean =>
  CONTRACT_DATE_KEYS.some((key) => months.has(monthKeyOf(row[key])))
  || PROSPECT_RANKS.some((rank) => typeof row.rank === 'string' && row.rank.includes(rank));

/**
 * 1つの一覧を絞る。⚠️ 元の並び順は変えない。
 *
 * ⚠️⚠️ 担当 × 店舗ごとに、一覧で最初に出てくる行は必ず残す（2026-11-25 の比較で分かった）。
 *   ⚠️ 契約棟数ランキング（Ranking.tsx）は、その期の担当が「一覧に1行でも出てくれば」0件でも並べ、
 *     同じ件数の中の並びは「一覧に最初に出てきた順」になる。
 *   ⚠️ 年度で絞るだけだと、ほかの年度の顧客しかいない担当がランキングから消え、同着の並びも変わる（注文 2026年5月期で 101人 → 100人）。
 *   ⚠️ 最初の行は契約日・ランクで数えられないので、表・4半期サマリーの数字には入らない（全件で読んでいたときも同じ行があった）。
 */
const narrow = (rows: DynamicRow[], needed: (row: DynamicRow) => boolean): DynamicRow[] => {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${String(row.staff ?? '')}\u0000${String(row.shop ?? '')}`;
    const first = !seen.has(key);
    seen.add(key);
    return first || needed(row);
  });
};

/**
 * 年度ごとの会社実績（company_year）。⚠️ 返す形は runCompany と同じ（画面は同じ処理で読む）。
 * ⚠️ 絞るのは重い契約者の3つの一覧だけ。担当営業・店舗・課・予算・不動産企画係は全件のまま（数百件で軽い。画面が期で絞る）。
 * ⚠️ year は「Y 年5月期」の Y（例 2026 = 2025/06〜2026/05）。
 */
export const runCompanyYear = async (body: Record<string, unknown>): Promise<CompanyResult> => {
  const year = Number(body.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { httpStatus: 400, body: { status: 'error', message: '年度（year）が正しくありません。' } };
  }
  const now = new Date();
  const months = new Set([...fiscalMonths(year), ...fiscalMonths(year - 1), `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`]);
  const result = await runCompany();
  const all = result.body as Record<string, DynamicRow[]>;
  const needed = neededFor(months);
  return {
    httpStatus: 200,
    body: {
      ...all,
      contract: narrow(all.contract, needed),
      contract_kaeru: narrow(all.contract_kaeru, needed),
      contract_resale: narrow(all.contract_resale, needed),
      year,
    },
  };
};

/** 文字列として受け取る。⚠️ 数値で送られても文字列に揃える（PHP は型を見ない） */
const asString = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/**
 * 契約目標の登録・更新。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **`ON DUPLICATE KEY UPDATE` に頼っている。**
 *   company_achievement に (period, category, name) の一意キーが
 *   無いと、同じマスに何度も行が増えて合計が狂う。
 *   ⚠️ キーの有無を変える改修をするときは、この upsert も見直すこと。
 *
 * ⚠️ PHP は入力を一切検証せず、そのまま4値を渡している。
 *   ここでも同じ挙動にしている（検証を足すと、これまで通っていた
 *   空文字などが弾かれて画面の保存が失敗するようになる）。
 *   ⚠️ ただし undefined を渡すと mysql2 が例外を投げるため、
 *     空文字に落としている。
 * ─────────────────────────────────────────────
 */
export const runChangeCompanyAchievement = async (
  body: Record<string, unknown>
): Promise<CompanyResult> => {
  try {
    await execute(
      'INSERT INTO company_achievement (period, category, name, value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
      [
        asString(body.period),
        asString(body.category),
        asString(body.name),
        asString(body.value),
      ]
    );

    return { httpStatus: 200, body: { status: 'success' } };
  } catch (error) {
    // ⚠️ PHP と同じ 500 とメッセージにする。フロントは status を見ていないが、
    //   ① へ戻したときに挙動が変わらないようにしておく
    console.error('change_company_achievement failed', error);
    return {
      httpStatus: 500,
      body: { status: 'error', message: 'データの保存に失敗しました。' },
    };
  }
};
