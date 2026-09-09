import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * 集客サマリー（header/EventSummary.tsx）。
 *
 * ─────────────────────────────────────────────
 * イベントごとのファネル（反響→有効名簿→店舗来場→次アポ→契約）と
 * 広告費を1行にまとめて返す。
 *
 * ⚠️⚠️ **集計はSQLで行う。** master_data は約24,600行あり、
 *   ブラウザへ全件送って filter するのは現実的でない
 *   （要件は JS の filter 表記で書かれていたが、意味は同じ）。
 *
 * ⚠️ この request には ① に PHPハンドラが**存在しない**。
 *   ① が自動フォールバックしても 404 になるだけで二重実行にならない。
 * ⚠️ 逆に `backend/src/handlers/event_summary.php` を**作ってはいけない。**
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/**
 * ⚠️⚠️ **イベント名の突き合わせは「日付の接頭辞」を外して行う。**
 *
 *   event_calendar.title … 「住まいるフェスティバル2026_出水阿久根」
 *   event_db.title       … 「2026-08-23_住まいるフェスティバル2026_出水阿久根」
 *   master_data の列     … 「2026-06-21_衣食住 パパママフェスタ」
 *
 *   完全一致で突き合わせると **1件も当たらない**
 *   （2026-09-09 に実データで確認: event_db 0/97件、master_data 0/737件）。
 *   接頭辞は event_calendar.startDate と一致しており、表記ぶれではなく
 *   意図した形式である。
 *
 * ⚠️⚠️ **最初の `_` より後ろを「全部」使うこと。**
 *   `split('_')[1]` にすると2番目の要素しか取れず、
 *   `_` を含むイベント名が外れる。実データでは12件中**9件**が該当する
 *   （「住まいるフェスティバル2026_出水阿久根」「KH都城店_ヘラカブドーム」等）。
 *   ⚠️ とくに反響が最も多いイベント（89件）が丸ごと落ちる。
 *
 * ⚠️ 接頭辞が**日付のときだけ**外す。`^\d{4}-\d{2}-\d{2}_` に限定している。
 *   無条件に「最初の _ まで」を捨てると、日付が付いていないのに `_` を含む
 *   値（「KH都城店_ヘラカブドーム」そのまま）が「ヘラカブドーム」になり、
 *   かえって一致しなくなる。
 *
 * ⚠️ 接頭辞なしの値も拾えるよう、**元の値でも比較する**（下の HAVING/GROUP BY
 *   ではなく、正規化した値を1つのキーにまとめる方針）。
 *   正規化しても変わらない値はそのまま同じキーになるため、両方を兼ねる。
 */
const NORMALIZE = (column: string): string =>
  `REGEXP_REPLACE(TRIM(${column}), '^[0-9]{4}-[0-9]{2}-[0-9]{2}_', '')`;

/**
 * 対象イベント。
 * ⚠️ shop = 'khg'（全社イベント）かつ flag = 1 のみ。要件どおり。
 * ⚠️ id の降順。画面の初期表示もこの順。
 */
const EVENT_SQL = `
  SELECT id, title, startDate, endDate
    FROM event_calendar
   WHERE shop = 'khg' AND flag = 1
   ORDER BY id DESC
`;

/** 反響数（イベント予約フォームからの申し込み） */
const INQUIRY_SQL = `
  SELECT ${NORMALIZE('title')} AS t, COUNT(*) AS c
    FROM event_db
   WHERE COALESCE(title, '') <> ''
   GROUP BY t
`;

/**
 * 有効名簿数と、そこから先のファネル。
 *
 * ⚠️ 列の対応は**運用側の指定が正**。DBのカラムコメントとは食い違っている。
 *
 *   店舗来場者数 … step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7
 *                  ⚠️ DBコメントは「※初回面談」。2026-09-09 に
 *                    「このロジックで問題ない」と確認済み
 *   次アポ数     … step_migration_item_01JSENACS2FC422ZHEZWNSXNYA
 *                  （DBコメントは「※次回アポ」）
 *   契約者数     … step_migration_item_01J82Z5F1RR18Z792C7KZS88QG
 *                  （DBコメントは「※契約日」）
 *
 * ⚠️ 使ってはいけない列（過去に取り違えた）:
 *     step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0（コメントは「第二面談」）
 *     step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW（2回目以降面談）
 *     step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG（物件案内。入力率ほぼ0）
 *
 * ⚠️ フェーズ列は日付の**文字列**。入っていれば「到達した」と見なす。
 *   空文字と NULL の両方があるため COALESCE で揃える。
 *
 * ⚠️ show_dashboard = 1 のみ。削除済みの顧客を数えない
 *   （ローカルで12件確認）。
 */
const KPI_SQL = `
  SELECT
    ${NORMALIZE('customized_input_01JRCT12N9X24PCQ5QZPAYKB93')} AS t,
    COUNT(*) AS valid_count,
    SUM(COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') <> '') AS visit_count,
    SUM(COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') <> '') AS appo_count,
    SUM(COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') <> '') AS contract_count
    FROM master_data
   WHERE COALESCE(customized_input_01JRCT12N9X24PCQ5QZPAYKB93, '') <> ''
     AND COALESCE(show_dashboard, 0) = 1
   GROUP BY t
`;

/**
 * 広告費。
 *
 * ⚠️⚠️ **note と event_calendar.title の完全一致**で集計する。
 *   ここは KPI 側と違い、**日付の接頭辞を外さない**。
 *   `title` をそのまま（「住まいるフェスティバル2026_出水阿久根」のように
 *   2026 等も含めた形で）突き合わせる。
 *
 * ⚠️ 現在 note が一致しないのは EventSummary の運用を想定していなかったため。
 *   2026-09-09 に「手動で修正するので推論は不要」と確認済み。
 *   **表記を推測して寄せる処理（LIKE や部分一致）を足さないこと。**
 *   足すと「おうちづくりフェスタ来場予約」のような別費目まで混ざり、
 *   どの支出が集計されたのか追えなくなる。
 *
 * ⚠️ budget_value には**負の伝票**がある（返金・修正。最小 -18,700）。
 *   そのまま合計する。合計が 0 以下になった場合の表示は画面側で扱う。
 *
 * ⚠️ 店舗や期間で絞らない。対象は shop = 'khg' の全社イベントであり、
 *   費用も店舗案分される前の全社分を見るため。
 */
const BUDGET_SQL = `
  SELECT TRIM(note) AS t, COALESCE(SUM(budget_value), 0) AS total
    FROM budget
   WHERE COALESCE(note, '') <> ''
   GROUP BY t
`;

export interface EventSummaryRow {
  id: number;
  title: string;
  /** 'YYYY-MM-DD'。⚠️ mysql2 は DATE を Date で返すことがあるため文字列に直す */
  startDate: string;
  endDate: string;
  /** 反響数 */
  inquiry: number;
  /** 有効名簿数 */
  valid: number;
  /** 店舗来場者数 */
  visit: number;
  /** 次アポ数 */
  appo: number;
  /** 契約者数 */
  contract: number;
  /** 広告費の合計（円）。⚠️ 0 や負もありうる */
  budget: number;
}

const asNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * DATE 列を 'YYYY-MM-DD' にする。
 *
 * ⚠️ mysql2 は DATE 型を Date オブジェクトで返す設定と文字列で返す設定があり、
 *   pool の設定に依存させたくないので両方受ける。
 * ⚠️ toISOString() は UTC に変換するため使わない。日本時間の 2026-08-23 が
 *   2026-08-22 になる。
 */
const asDate = (value: unknown): string => {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value ?? '').slice(0, 10);
};

const asString = (value: unknown): string => String(value ?? '');

export const runEventSummary = async (): Promise<{ status: 'ok'; rows: EventSummaryRow[] }> => {
  const [events, inquiries, kpis, budgets] = await Promise.all([
    query<DynamicRow>(EVENT_SQL),
    query<DynamicRow>(INQUIRY_SQL),
    query<DynamicRow>(KPI_SQL),
    query<DynamicRow>(BUDGET_SQL),
  ]);

  const inquiryBy = new Map<string, number>();
  for (const r of inquiries) inquiryBy.set(asString(r.t), asNumber(r.c));

  const kpiBy = new Map<string, DynamicRow>();
  for (const r of kpis) kpiBy.set(asString(r.t), r);

  const budgetBy = new Map<string, number>();
  for (const r of budgets) budgetBy.set(asString(r.t), asNumber(r.total));

  const rows: EventSummaryRow[] = events.map((e) => {
    const title = asString(e.title).trim();
    const kpi = kpiBy.get(title);

    return {
      id: asNumber(e.id),
      title,
      startDate: asDate(e.startDate),
      endDate: asDate(e.endDate),
      inquiry: inquiryBy.get(title) ?? 0,
      valid: asNumber(kpi?.valid_count),
      visit: asNumber(kpi?.visit_count),
      appo: asNumber(kpi?.appo_count),
      contract: asNumber(kpi?.contract_count),
      budget: budgetBy.get(title) ?? 0,
    };
  });

  return { status: 'ok', rows };
};

// ---------------------------------------------------------------------------
// KPI をクリックしたときの顧客一覧
// ---------------------------------------------------------------------------

/**
 * クリック可能な KPI。
 *
 * ⚠️ 反響数（inquiry）は含めない。反響は event_db（イベント予約フォーム）で
 *   master_data の顧客ではないため、同じ形の一覧を出せない
 *   （顧客詳細を開く導線も無い）。
 */
export type EventKpi = 'valid' | 'visit' | 'appo' | 'contract';

/**
 * KPI → 「到達した」と見なすフェーズ列。
 *
 * ⚠️⚠️ **runEventSummary の KPI_SQL と同じ列を使うこと。**
 *   ここだけ変えると、表の件数と一覧の件数が食い違う。
 *   列の対応の根拠は KPI_SQL のコメントを参照。
 */
const KPI_CONDITION: Record<EventKpi, string> = {
  // 有効名簿はイベント名が入っていること自体が条件（追加条件なし）
  valid: '1',
  visit: "COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '') <> ''",
  appo: "COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '') <> ''",
  contract: "COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') <> ''",
};

/**
 * 一覧に出す1顧客。
 *
 * ⚠️ ランクは含めない。ランクらしき列は rank_steps だけだが、中身は
 *   ["LINE等で連絡可","次回アポ済み"] のような**商談ステップの配列**で、
 *   S/A/B ランクではない（2026-09-09 に実データで確認）。
 *   「ランク」として出すと別の意味の値を見せることになる。
 *
 * ⚠️ 「rank」という列は master_data に**存在しない**。
 *   RankOrder.tsx が item.rank で受けているのは、あちらのAPIが付けた別名。
 */
export interface EventCustomerRow {
  id: string;
  customer: string;
  shop: string;
  staff: string;
  /** 反響日 */
  register: string;
  /** 店舗来場日 */
  visit: string;
  /** 次アポ日 */
  appo: string;
  /** 契約日 */
  contract: string;
  status: string;
}

export interface EventSummaryDetailResult {
  httpStatus: number;
  body: unknown;
}

/**
 * 1つの KPI に該当する顧客を返す。
 *
 * ⚠️ title は **event_calendar.title**（接頭辞なし）で受ける。
 *   照合は KPI_SQL と同じ正規化をかけた列に対して行う。
 *
 * ⚠️ 列名は固定文字列（KPI_CONDITION）からのみ組む。
 *   リクエストの値を SQL に埋めない。
 */
export const runEventSummaryDetail = async (
  body: unknown
): Promise<EventSummaryDetailResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const title = asString(data.title).trim();
  const kpi = asString(data.kpi) as EventKpi;

  if (title === '') {
    return {
      httpStatus: 400,
      body: { status: 'error', message: 'イベント名が指定されていません。' },
    };
  }

  const condition = KPI_CONDITION[kpi];
  if (condition === undefined) {
    // ⚠️ 未知の kpi はここで弾く。SQL に流さない
    return {
      httpStatus: 400,
      body: { status: 'error', message: '指定されたKPIは一覧表示に対応していません。' },
    };
  }

  const sql = `
    SELECT
      id,
      COALESCE(customer_contacts_name, '')                              AS customer,
      COALESCE(in_charge_store, '')                                     AS shop,
      COALESCE(in_charge_user, '')                                      AS staff,
      COALESCE(step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99, '')      AS register,
      COALESCE(step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7, '')      AS visit,
      COALESCE(step_migration_item_01JSENACS2FC422ZHEZWNSXNYA, '')      AS appo,
      COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '')      AS contract,
      COALESCE(status, '')                                              AS status
      FROM master_data
     WHERE ${NORMALIZE('customized_input_01JRCT12N9X24PCQ5QZPAYKB93')} = ?
       AND COALESCE(show_dashboard, 0) = 1
       AND ${condition}
     ORDER BY
       -- ⚠️ 契約済みを先頭に。面談の場で見るときに成果から確認したい
       (COALESCE(step_migration_item_01J82Z5F1RR18Z792C7KZS88QG, '') <> '') DESC,
       in_charge_store,
       customer_contacts_name
  `;

  const rows = await query<DynamicRow>(sql, [title]);

  const customers: EventCustomerRow[] = rows.map((r) => ({
    id: asString(r.id),
    customer: asString(r.customer),
    shop: asString(r.shop),
    staff: asString(r.staff),
    register: asString(r.register),
    visit: asString(r.visit),
    appo: asString(r.appo),
    contract: asString(r.contract),
    status: asString(r.status),
  }));

  return { httpStatus: 200, body: { status: 'ok', customers } };
};
