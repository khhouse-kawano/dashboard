import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, withTransaction } from '../db/pool';
import type { SqlParam } from '../db/pool';
import { logger } from '../utils/logger';

/**
 * 集客イベントの広告費入力（header/EventBudget.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ Express のみ。① に PHP ハンドラは**存在しない**。
 *   ⚠️ 逆に `backend/src/handlers/event_budget.php` を**作ってはいけない。**
 *     作った瞬間に「② が処理 → 応答が失われる → ① が再実行」の経路ができ、
 *     budget に**同じ行が2組できる**。
 *
 * ⚠️⚠️ **budget には UNIQUE キーが無い（PRIMARY KEY は id だけ）。**
 *   2026-09-09 に確認済み。つまり upsert ができず、保存は純粋な INSERT。
 *   同じ内容を2回送れば2組登録される。二重送信を防ぐのは画面側の責任
 *   （保存中はボタンを無効にする）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface EventBudgetResult {
  httpStatus: number;
  body: unknown;
}

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/**
 * 事業区分 → budget.section の値。
 *
 * ⚠️⚠️ **中古リノベは `use`。`used` ではない。**
 *   2026-09-09 に実データで確認した budget.section の分布
 *     order 25,834件 / spec 2,825件 / use 476件 / used **0件**
 *   さらに ① の PHP が `WHERE section = 'use'` で絞り込んでいる
 *   （customers.php / customer_order.php / budget_simulator.php）。
 *   `used` で登録すると**既存476件と集計されず、どの画面にも出ない**。
 *
 * ⚠️ ここに無い division（不動産企画室など）は登録を拒否する。
 *   空の section で登録すると、上記の3つの絞り込みすべてに掛からず
 *   **どこからも見えない広告費**になる。黙って捨てるより弾く。
 */
const SECTION_BY_DIVISION: Record<string, string> = {
  注文事業: 'order',
  建売分譲事業: 'spec',
  中古リノベ: 'use',
};

/** budget に固定で入れる値（要件どおり） */
const FIXED = {
  medium: 'イベント',
  /** ⚠️ 0 = 反響媒体ではない。PHP の絞り込み `response_medium = 0` に載る */
  responseMedium: 0,
  category: 'MKT',
} as const;

// ---------------------------------------------------------------------------
// 選択肢の取得
// ---------------------------------------------------------------------------

/**
 * ⚠️ 並べ替えは画面側（utils/shopSorter.ts）で行う。
 *   事業区分→ブランド→id の順で、他画面と同じ関数を使い回すため。
 */
const SHOP_SQL = `
  SELECT id, brand, shop, division, section, area, report_flag
    FROM shop_list
   WHERE report_flag = 1
   ORDER BY id
`;

/**
 * イベント名の選択肢。
 * ⚠️ 集客サマリーと同じ条件（shop = 'khg' かつ flag = 1）にする。
 *   ここだけ広げると、サマリーに出ないイベントの広告費が登録できてしまう。
 */
const EVENT_SQL = `
  SELECT id, title, startDate, endDate
    FROM event_calendar
   WHERE shop = 'khg' AND flag = 1
   ORDER BY id DESC
`;

/**
 * 登録済みの広告費（medium = 'イベント'）。
 *
 * ⚠️ id の降順（要件）。2026-09-09 時点で98件なので全件返す。
 *   件数が増えたらページングに変えること。
 */
const ENTRY_SQL = `
  SELECT id, budget_period, shop, budget_value, note, company, section, order_section
    FROM budget
   WHERE medium = ?
   ORDER BY id DESC
`;

/**
 * 'YYYY/MM/01' → 'YYYY-MM'（type=month の値）。
 *
 * ⚠️⚠️ **budget_period は月初とは限らない。**
 *   実データに '2026/03/21'（おうちづくりフェスタ）や '2026/02/18' がある。
 *   type=month にすると日が落ちるため、**月が変わっていないときは
 *   元の budget_period をそのまま残す**（下の resolvePeriod を参照）。
 *   これをしないと、他の項目を直しただけで日付が 01 に書き換わる。
 */
const toMonth = (period: unknown): string => {
  const s = asString(period).trim().replace(/\//g, '-');
  return /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : '';
};

const asDate = (value: unknown): string => {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return asString(value).slice(0, 10);
};

export const runEventBudgetOptions = async (): Promise<EventBudgetResult> => {
  const [shops, events, entries] = await Promise.all([
    query<DynamicRow>(SHOP_SQL),
    query<DynamicRow>(EVENT_SQL),
    query<DynamicRow>(ENTRY_SQL, [FIXED.medium]),
  ]);

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      shops: shops.map((r) => {
        const division = asString(r.division);
        return {
          id: Number(r.id),
          brand: asString(r.brand),
          shop: asString(r.shop),
          division,
          section: asString(r.section),
          // ⚠️ area / report_flag は使わないが**必ず返す**。
          //   画面側が既存の sortShops / filterReportShops
          //   （components/header/useAmbassadorMaster.ts）をそのまま
          //   使い回すため、MasterShop 型と同じ形にそろえている。
          //   欠けると型が合わず、並べ替え関数を複製することになる。
          area: asString(r.area),
          report_flag: Number(r.report_flag),
          /**
           * ⚠️ 登録できるかどうかを**サーバが判断して返す**。
           *   画面側でマッピングを持つと、片方だけ直したときに
           *   「選べるのに保存できない」状態になる。
           */
          budgetSection: SECTION_BY_DIVISION[division] ?? '',
        };
      }),
      events: events.map((r) => ({
        id: Number(r.id),
        title: asString(r.title).trim(),
        startDate: asDate(r.startDate),
        endDate: asDate(r.endDate),
      })),
      /**
       * 登録済みの広告費。⚠️ 1件 = budget の1行。
       *
       * ⚠️⚠️ **複数店舗を1行にまとめて返さない。**
       *   実データでは同じ（月・イベント名・請求先）の組でも金額がばらついている
       *   （2026-09-09 の実測: 154,000 / 264,000 / 513,334 など）。
       *   まとめて案分し直す作りにすると、**手で調整された金額を
       *   均等割りで上書きしてしまう**。
       */
      entries: entries.map((r) => ({
        id: Number(r.id),
        /** ⚠️ 元の値。月が変わらなければこれをそのまま保存する */
        budgetPeriod: asString(r.budget_period),
        month: toMonth(r.budget_period),
        shop: asString(r.shop),
        cost: Number(r.budget_value),
        title: asString(r.note),
        company: asString(r.company),
        section: asString(r.section),
        orderSection: asString(r.order_section),
      })),
    },
  };
};

// ---------------------------------------------------------------------------
// 保存
// ---------------------------------------------------------------------------

interface InputRow {
  /** 'YYYY-MM'（type=month の値） */
  month?: unknown;
  /** 選択された店舗名（shop_list.shop） */
  shops?: unknown;
  /** 費用の合計。⚠️ 店舗数で割って案分する */
  cost?: unknown;
  /** イベント名（event_calendar.title） */
  title?: unknown;
  /** 請求先（自由入力） */
  company?: unknown;
}

const INSERT_SQL = `
  INSERT INTO budget
    (budget_period, shop, medium, budget_value, note, company,
     response_medium, category, section, order_section)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/**
 * 'YYYY-MM' → 'YYYY/MM/01'。
 *
 * ⚠️ budget_period は text で、既存データは 'YYYY/MM/01' 形式
 *   （2026-09-09 に確認。月初以外もわずかにあるが大半は /01）。
 *   ハイフンで入れると既存の集計（文字列前方一致や比較）と揃わない。
 */
const toBudgetPeriod = (month: unknown): string | null => {
  const s = asString(month).trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return null;
  return `${s.replace(/-/g, '/')}/01`;
};

// ---------------------------------------------------------------------------
// 登録済みの1行を修正
// ---------------------------------------------------------------------------

const CURRENT_SQL = `
  SELECT budget_period, shop, section, order_section
    FROM budget WHERE id = ? AND medium = ?
`;

const UPDATE_SQL = `
  UPDATE budget
     SET budget_period = ?, shop = ?, budget_value = ?, note = ?, company = ?,
         section = ?, order_section = ?
   WHERE id = ? AND medium = ?
`;

/**
 * 登録済みの広告費を1行だけ直す。
 *
 * ⚠️⚠️ **WHERE に medium = 'イベント' を必ず入れる。** id だけで UPDATE すると、
 *   画面から id を差し替えるだけで**イベント以外の広告費（SUUMO掲載料など
 *   28,000件超）を書き換えられる**。
 *
 * ⚠️ 案分はしない。1行 = 1店舗の金額をそのまま扱う。
 *   （まとめて案分し直すと、手で調整された金額を均等割りで壊す）
 */
export const runEventBudgetUpdate = async (body: unknown): Promise<EventBudgetResult> => {
  const data = (body ?? {}) as Record<string, unknown>;

  const id = Number(data.id);
  if (!Number.isInteger(id) || id <= 0) {
    return { httpStatus: 400, body: { status: 'error', message: '対象が指定されていません。' } };
  }

  const rows = await query<DynamicRow>(CURRENT_SQL, [id, FIXED.medium]);
  const current = rows[0];
  if (current === undefined) {
    // ⚠️ medium が「イベント」でない行は対象外。存在しない扱いにする
    return {
      httpStatus: 404,
      body: { status: 'error', message: '対象の広告費が見つかりません。' },
    };
  }

  const title = asString(data.title).trim();
  if (title === '') {
    return { httpStatus: 400, body: { status: 'error', message: 'イベント名を選択してください。' } };
  }

  const shop = asString(data.shop).trim();
  if (shop === '') {
    return { httpStatus: 400, body: { status: 'error', message: '店舗を選択してください。' } };
  }

  /**
   * 費用。
   *
   * ⚠️⚠️ **修正では 0 を認める**（2026-09-09 決定）。
   *   行を消す機能は用意しないので、**0円に直すことが「実質の取り消し」**に
   *   なる。ここで 0 を弾くと、誤登録した行を無効化する手段が無くなる。
   *   ⚠️ 新規登録（runEventBudgetSave）は 0 を認めない。0円の行を
   *     新しく作る理由が無く、費用の入力漏れと区別できないため。
   *
   * ⚠️ 負の値も認める。budget_value には返金・修正の伝票が実在する
   *   （全体の最小値 -18,700。2026-09-09 に確認）。
   *
   * ⚠️ 未指定（undefined / null / 空文字）は弾く。
   *   `Number(undefined)` は NaN だが、`Number('')` は **0** になるため、
   *   空文字を数値として通すと**項目の送信漏れで金額が0に書き換わる**。
   */
  const rawCost = data.cost;
  if (rawCost === undefined || rawCost === null || rawCost === '') {
    return { httpStatus: 400, body: { status: 'error', message: '費用を入力してください。' } };
  }
  const cost = Number(rawCost);
  if (!Number.isFinite(cost)) {
    return { httpStatus: 400, body: { status: 'error', message: '費用は数値で入力してください。' } };
  }

  /**
   * 開催月。
   *
   * ⚠️⚠️ **月が変わっていなければ元の budget_period をそのまま残す。**
   *   実データには '2026/03/21' のように月初でない値がある。
   *   画面は type=month なので日を持てず、毎回 '/01' を書くと
   *   **他の項目を直しただけで日付が 01 に変わってしまう**。
   */
  const month = asString(data.month).trim();
  const currentPeriod = asString(current.budget_period);
  const currentMonth = toMonth(currentPeriod);

  let period: string;
  if (month === '') {
    return { httpStatus: 400, body: { status: 'error', message: '開催月を選択してください。' } };
  }
  if (month === currentMonth) {
    period = currentPeriod;
  } else {
    const next = toBudgetPeriod(month);
    if (next === null) {
      return { httpStatus: 400, body: { status: 'error', message: '開催月の形式が不正です。' } };
    }
    period = next;
  }

  /**
   * 事業区分と営業課。
   *
   * ⚠️⚠️ **shop_list に無い店舗名では section を書き換えない。**
   *   既存データには shop に '買い:中古リノベ' のような取引区分が
   *   入っている行が実在する（過去の登録。2026-09-09 に確認）。
   *   ここで弾くと、その行の他の項目（金額・請求先）を直せなくなる。
   *   また section を空にすると、どの集計にも出ない行になる。
   *   → 見つからなければ**今の section / order_section を維持する**。
   */
  const shopRows = await query<DynamicRow>(
    'SELECT division, section FROM shop_list WHERE shop = ? AND report_flag = 1',
    [shop]
  );
  const info = shopRows[0];

  let section = asString(current.section);
  let orderSection = asString(current.order_section);

  if (info !== undefined) {
    const mapped = SECTION_BY_DIVISION[asString(info.division)];
    if (mapped === undefined) {
      return {
        httpStatus: 400,
        body: {
          status: 'error',
          message:
            `「${shop}」の事業区分（${asString(info.division) || '未設定'}）は` +
            '広告費の集計対象外です。別の店舗を選んでください。',
        },
      };
    }
    section = mapped;
    orderSection = asString(info.section);
  }

  try {
    await execute(UPDATE_SQL, [
      period,
      shop,
      // ⚠️ budget_value は int。小数は入れられないので丸める
      Math.round(cost),
      title,
      asString(data.company).trim(),
      section,
      orderSection,
      id,
      FIXED.medium,
    ]);

    return {
      httpStatus: 200,
      body: {
        status: 'ok',
        message: '広告費を更新しました。',
        // ⚠️ 画面が持っている値を実際の保存内容に合わせられるよう返す
        entry: {
          id,
          budgetPeriod: period,
          month: toMonth(period),
          shop,
          cost: Math.round(cost),
          title,
          company: asString(data.company).trim(),
          section,
          orderSection,
        },
      },
    };
  } catch (error) {
    logger.error(`event_budget の更新に失敗しました id=${id}: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: '更新に失敗しました。時間をおいて再度お試しください。' },
    };
  }
};

export const runEventBudgetSave = async (body: unknown): Promise<EventBudgetResult> => {
  const data = (body ?? {}) as Record<string, unknown>;
  const rows: InputRow[] = Array.isArray(data.rows) ? (data.rows as InputRow[]) : [];

  if (rows.length === 0) {
    return {
      httpStatus: 400,
      body: { status: 'error', message: '登録する行がありません。' },
    };
  }

  // ⚠️⚠️ 店舗の事業区分と営業課は**DBから引く**。リクエストの値を信用しない。
  //   画面が古いまま（区分の変更前）でも、保存されるのは今の shop_list の内容になる。
  const shopRows = await query<DynamicRow>(SHOP_SQL);
  const shopMap = new Map<string, { division: string; section: string }>();
  for (const r of shopRows) {
    shopMap.set(asString(r.shop), {
      division: asString(r.division),
      section: asString(r.section),
    });
  }

  /**
   * 登録する行。
   * ⚠️ SQLのパラメータだけでなく、画面へ返す用の内容も一緒に持つ。
   *   登録直後に一覧の先頭へ差し込めるようにするため（再取得すると
   *   表示件数や編集中の内容がリセットされる）。
   */
  const values: { params: SqlParam[]; entry: Record<string, unknown> }[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const line = index + 1;

    const period = toBudgetPeriod(row.month);
    if (period === null) {
      errors.push(`${line}行目: 開催月を選択してください。`);
      return;
    }

    const title = asString(row.title).trim();
    if (title === '') {
      errors.push(`${line}行目: イベント名を選択してください。`);
      return;
    }

    const shops = (Array.isArray(row.shops) ? row.shops : [])
      .map((s) => asString(s).trim())
      .filter((s) => s !== '');
    if (shops.length === 0) {
      errors.push(`${line}行目: 該当店舗を1つ以上選択してください。`);
      return;
    }

    /**
     * ⚠️⚠️ **新規登録では 0 を認めない**（2026-09-09 決定）。
     *   0円の行を新しく作る理由が無く、`Number('')` が 0 になるため
     *   **入力漏れと区別できない**。
     *   ⚠️ 一方、登録済みの修正（runEventBudgetUpdate）では 0 を認める。
     *     行を消す機能が無いので、0円に直すのが実質の取り消しになる。
     */
    const cost = Number(row.cost);
    if (!Number.isFinite(cost) || cost === 0) {
      errors.push(`${line}行目: 費用を入力してください（0は登録できません）。`);
      return;
    }

    /**
     * ⚠️⚠️ **案分は切り上げ**（要件どおり）。
     *   そのため店舗ごとの合計は入力額を**上回ることがある**
     *   （例: 100,000円を3店舗 → 33,334 × 3 = 100,002円）。
     *   ⚠️ budget_value は int(11) なので小数は入れられない。
     *     切り捨てると合計が入力額を下回り、予算が消えたように見える。
     *     上回る側に倒すのが要件。
     */
    const perShop = Math.ceil(cost / shops.length);

    const company = asString(row.company).trim();

    for (const shop of shops) {
      const info = shopMap.get(shop);
      if (info === undefined) {
        // ⚠️ report_flag = 1 でない店舗は選べないはずだが、念のため弾く
        errors.push(`${line}行目: 「${shop}」は登録対象の店舗ではありません。`);
        return;
      }

      const section = SECTION_BY_DIVISION[info.division];
      if (section === undefined) {
        // ⚠️ どの集計にも出ない行を作らないため弾く（冒頭のコメント参照）
        errors.push(
          `${line}行目: 「${shop}」の事業区分（${info.division || '未設定'}）は` +
            '広告費の集計対象外です。選択を外してください。'
        );
        return;
      }

      values.push({
        params: [
          period,
          shop,
          FIXED.medium,
          perShop,
          title,
          company,
          FIXED.responseMedium,
          FIXED.category,
          section,
          // ⚠️ order_section は shop_list.section（営業課名）。
          //   section（order/spec/use）とは別物。取り違えると集計が壊れる
          info.section,
        ],
        entry: {
          budgetPeriod: period,
          month: toMonth(period),
          shop,
          cost: perShop,
          title,
          company,
          section,
          orderSection: info.section,
        },
      });
    }
  });

  if (errors.length > 0) {
    // ⚠️ 1行でも不備があれば**何も登録しない**。
    //   一部だけ入ると、どこまで登録されたか分からなくなる
    return {
      httpStatus: 400,
      body: { status: 'error', message: errors.join('\n') },
    };
  }

  try {
    const inserted = await withTransaction(async (tx) => {
      const created: Record<string, unknown>[] = [];
      for (const v of values) {
        const result = await tx.execute(INSERT_SQL, v.params);
        // ⚠️ 採番された id を拾って返す。画面が一覧の先頭に差し込むために必要
        created.push({ id: result.insertId, ...v.entry });
      }
      return created;
    });

    return {
      httpStatus: 200,
      body: {
        status: 'ok',
        inserted: inserted.length,
        message: `広告費を${inserted.length}件登録しました。`,
        /**
         * 登録した行。⚠️ **id の降順**で返す（画面の並びと同じ）。
         *   INSERT は id の昇順で走るので反転させる。
         */
        entries: [...inserted].reverse(),
      },
    };
  } catch (error) {
    logger.error(`event_budget の登録に失敗しました: ${(error as Error).message}`);
    return {
      httpStatus: 500,
      body: { status: 'error', message: '登録に失敗しました。時間をおいて再度お試しください。' },
    };
  }
};
