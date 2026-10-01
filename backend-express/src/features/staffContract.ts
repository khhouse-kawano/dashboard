import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * 営業別の契約率（ヘッダー → 日報 → 営業別契約率）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面: header/StaffContractRate.tsx
 *
 * ⚠️⚠️ **商談ログ（`interview_sheet.interview_log`）に記録された担当営業**で数える。
 *   ⚠️ ⚠️ **顧客の担当営業（`master_data.in_charge_user`）ではない。**
 *     ⚠️ 商談を実際に行った人を見るのが目的であり、
 *     ⚠️ **引き継ぎ後に担当が変わっても、商談した人の実績として残る。**
 *
 * ⚠️⚠️ **担当営業が入っている商談しか数えられない。**
 *   ⚠️ 実測（2026-10-01）: ⚠️ **18,470件中 2,103件（11.4%）にしか `staff` が無い。**
 *   ⚠️ ⚠️ **この表は実力差ではなく「記録の有無」を強く反映する。**
 *     ⚠️ 画面に必ず注記を出すこと。
 *
 * ⚠️ 集計はここで行う（⚠️ 画面へ18,470行・8.1MBを送らないため）。
 *   ⚠️ 実測: ⚠️ **取得 約355ms / 集計 約20ms**。⚠️ 重いのは取得のほう。
 * ─────────────────────────────────────────────
 */

/** 商談ログ1件。⚠️ `staff` は後から足された項目で、古い記録には**入っていない** */
interface LogEntry {
  day?: string;
  action?: string;
  note?: string;
  staff?: string;
}

interface SheetRow extends RowDataPacket {
  id: string;
  interview_log: unknown;
}

interface StaffRow extends RowDataPacket {
  name: string;
  shop: string;
  section: string;
}

interface ContractRow extends RowDataPacket {
  id: string;
  in_charge_user: string | null;
}

/**
 * 空白（半角・全角）を落として突合する。
 *
 * ⚠️⚠️ **台帳と商談ログで姓名の間の空白が割れている。**
 *   ⚠️ 実測: ⚠️ **ログ側の131人中104人が空白入り**（`中川 康太`）、
 *     ⚠️ 残りは空白なし（`今村秀樹`）。⚠️ **落とさないと大半が突合できない。**
 */
const norm = (value: unknown): string => String(value ?? '').replace(/[\s　]/g, '');

/**
 * 商談ログを配列として取り出す。
 *
 * ⚠️⚠️ **mysql2 が既にパース済みのオブジェクトで返す。**
 *   ⚠️ 列の型は `longtext` だが、⚠️ **MariaDB が JSON として申告するため**。
 *   ⚠️ ⚠️ **`JSON.parse(String(v))` と書くと `"[object Object]"` になって全件壊れる。**
 *     ⚠️ 実際に踏んだ（2026-10-01）。⚠️ **文字列で来る場合にも備えて両方扱う。**
 */
const toLog = (value: unknown): LogEntry[] => {
  if (Array.isArray(value)) return value as LogEntry[];
  if (value !== null && typeof value === 'object') return [value as LogEntry];
  try {
    const parsed: unknown = JSON.parse(String(value ?? ''));
    return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
  } catch {
    return [];
  }
};

/**
 * 商談顧客とみなす action。
 *
 * ⚠️⚠️ **完全一致で見る。**
 *   ⚠️ ログには `自社契約` `仲介契約` `売買契約` `リフォーム契約` や、
 *     ⚠️ **`自社契約,物件名(公開)` のように物件名が付いた値**もある。
 *   ⚠️ ⚠️ **これらは含めない**（注文事業の商談フェーズではないため）。
 */
const TALK_ACTIONS = new Set(['初回面談', '2回目以降面談', '事前審査', '契約']);

/** 次アポ（＝初回面談のあとに進んだ）とみなす action */
const NEXT_ACTIONS = new Set(['2回目以降面談', '事前審査', '契約']);

/** 対象の事業区分。⚠️ `shop_list.division` の実際の値（⚠️ 「注文営業」という値は無い） */
const TARGET_DIVISION = '注文事業';

export interface StaffContractRow {
  name: string;
  /** ⚠️ 複数ブランドに登録されている人がいる。`/` でつないである */
  shop: string;
  section: string;
  /** 商談顧客数。⚠️⚠️ **商談の回数ではなく人数** */
  talk: number;
  next: number;
  /**
   * 契約数（商談顧客のうち）。
   *
   * ⚠️⚠️ **`talk` の部分集合。** ⚠️ **契約率の分子はこちら。**
   */
  contract: number;
  /**
   * 契約数（顧客DB）。
   *
   * ⚠️⚠️ **`master_data.in_charge_user` で数えたもの。**
   *   ⚠️ ⚠️ **商談顧客数とは無関係**なので、⚠️ **率を出してはいけない。**
   *   ⚠️ 商談ステップを入力しない営業の実績を拾うための列である。
   */
  contractDb: number;
}

export interface StaffContractResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

/**
 * 営業別の契約率を返す。
 *
 * @param period 年度。⚠️ `staff_list.period` の値（例 '2027'）
 *
 * ⚠️⚠️ **歩留まりの割り算は画面側で行う。**
 *   ⚠️ 分母が0のときに 0% と出すか伏せるかは**見せ方の判断**であり、
 *   ⚠️ サーバーが決めることではない。
 */
export const runStaffContract = async (period: string): Promise<StaffContractResult> => {
  const target = period.trim() === '' ? '2027' : period.trim();

  const [staff, sheets, contracted] = await Promise.all([
    query<StaffRow>(
      `SELECT s.name, s.shop, s.section
         FROM staff_list s
         JOIN shop_list sl ON sl.shop = s.shop
        WHERE s.period = ? AND s.report = 1 AND sl.division = ?
        ORDER BY s.sort, s.id`,
      [target, TARGET_DIVISION]
    ),
    // ⚠️ 2列だけ引く。⚠️⚠️ **`SELECT *` にすると不要な列まで流れる**
    query<SheetRow>('SELECT id, interview_log FROM interview_sheet'),
    /**
     * 契約済みの顧客。⚠️⚠️ **2つの数え方の両方に使う。**
     *
     *   ⚠️ **契約数（商談）** … 商談顧客の中で契約済みのもの。
     *     ⚠️ ⚠️ **契約率の分子はこちら**（⚠️ 分母の商談顧客数と揃うため）。
     *
     *   ⚠️ **契約数（顧客DB）** … `in_charge_user` で数えたもの。
     *     ⚠️⚠️ **商談ステップを入力しない営業がいる**ため、
     *       ⚠️ 商談側だけだと**その人の契約が丸ごと0に見える。**
     *     ⚠️ ⚠️ **商談顧客数とは無関係**なので、率は出さない。
     */
    query<ContractRow>(
      "SELECT id, in_charge_user FROM master_data WHERE status = '契約済み'"
    ),
  ]);

  /** 契約済みの顧客id。⚠️ 突合は `interview_sheet.id` = `master_data.id` */
  const contractIds = new Set(contracted.map((row) => row.id));

  /** 営業（空白を落とした名前）→ 顧客DB上の契約数 */
  const contractByStaff = new Map<string, number>();
  for (const row of contracted) {
    const key = norm(row.in_charge_user);
    if (key === '') continue;
    contractByStaff.set(key, (contractByStaff.get(key) ?? 0) + 1);
  }

  // 営業（空白を落とした名前）→ 顧客idの集合
  const byStaff = new Map<string, { talk: Set<string>; next: Set<string> }>();
  const bucketOf = (key: string) => {
    const found = byStaff.get(key);
    if (found !== undefined) return found;
    const created = { talk: new Set<string>(), next: new Set<string>() };
    byStaff.set(key, created);
    return created;
  };

  /** 担当営業が入っている商談シートの数。⚠️ 画面の注記に出す */
  let sheetsWithStaff = 0;

  for (const sheet of sheets) {
    let had = false;
    for (const entry of toLog(sheet.interview_log)) {
      const who = norm(entry.staff);
      if (who === '') continue;
      had = true;

      const action = String(entry.action ?? '');
      if (TALK_ACTIONS.has(action)) bucketOf(who).talk.add(sheet.id);
      if (NEXT_ACTIONS.has(action)) bucketOf(who).next.add(sheet.id);
    }
    if (had) sheetsWithStaff += 1;
  }

  /**
   * 営業の名寄せ。
   *
   * ⚠️⚠️ **同じ人が複数ブランドに登録されている**（実測23名。最大3店舗）。
   *   ⚠️ ⚠️ **まとめないと、同じ実績がその人数ぶん重複して表に並ぶ。**
   */
  const people = new Map<string, { name: string; shops: string[]; sections: string[] }>();
  for (const row of staff) {
    const key = norm(row.name);
    const found = people.get(key) ?? { name: row.name, shops: [], sections: [] };
    if (!found.shops.includes(row.shop)) found.shops.push(row.shop);
    if (row.section !== '' && !found.sections.includes(row.section)) found.sections.push(row.section);
    people.set(key, found);
  }

  const rows: StaffContractRow[] = [...people.entries()].map(([key, person]) => {
    const hit = byStaff.get(key);
    const talk = hit === undefined ? new Set<string>() : hit.talk;

    return {
      name: person.name,
      shop: person.shops.join(' / '),
      section: person.sections.join(' / '),
      talk: talk.size,
      // ⚠️⚠️ **次アポは「商談顧客」の中から数える。** ⚠️ 外から混ぜない
      next: hit === undefined ? 0 : [...hit.next].filter((id) => talk.has(id)).length,
      // ⚠️⚠️ **契約率の分子。** ⚠️ 商談顧客の中だけを数える（⚠️ 分母と揃える）
      contract: [...talk].filter((id) => contractIds.has(id)).length,
      // ⚠️⚠️ **顧客DB上の契約数。** ⚠️ 商談顧客とは無関係なので**率は出さない**
      contractDb: contractByStaff.get(key) ?? 0,
    };
  });

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      period: target,
      rows,
      // ⚠️⚠️ **記録の網羅率。画面の注記に使う。** ⚠️ 数字だけ出すと実力差に見える
      coverage: { sheets: sheets.length, withStaff: sheetsWithStaff },
    },
  };
};
