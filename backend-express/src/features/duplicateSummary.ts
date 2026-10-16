import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../db/pool';

/**
 * 重複反響サマリー（ヘッダー → 反響管理 → 重複反響サマリー）。v2.2.193 新規。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面: frontend/src/components/header/DuplicateInquirySummary.tsx
 *
 * ⚠️⚠️ **「重複」は status＝重複 のことではない。** ⚠️ 連絡先が他ブランドの顧客と一致すること。
 *   ⚠️ 比べる列: 電話・携帯・メール・extra_address_info（2026-10-16 の指示）。
 *   ⚠️ trim ＋ 空白（全角含む）を除いて比べる。⚠️ 電話はハイフンも除く（指示で承認済み）。
 *   ⚠️⚠️ **短すぎる値は比べない**（⚠️ 「201」「-」「0」などで別人どうしが一致するため）。
 *     電話は数字10桁以上、メールは @ を含むもの、extra_address_info は8文字以上。
 *
 * ⚠️ 対象の表（show_dashboard = 0 も含む。指示）:
 *   master_data（KH / DJH / なごみ / 2L / JH / PGH / その他）
 *   master_data_kaeru（かえる）
 *   master_data_resale のうち ⚠️⚠️ **in_charge_store＝「買い:中古リノベ」だけ**（中専。指示）
 *
 * ⚠️ カードの数字（総反響・来場・次アポ・契約）は ⚠️⚠️ **status＝重複 を除く**（ほかの画面と同じ）。
 *   ⚠️ ただし **重複の相手としては含める**（指示で承認済み）。
 *
 * ⚠️ エリア（都道府県）は full_address から決める（下の `prefectureOf`。2026-10-16 の指示）。
 *   ⚠️ 期間と同じく **カードのブランド側の反響だけ** を絞る（相手側は住所に関係なく全件と比べる）。
 *   ⚠️ 都道府県が決まらない顧客は、エリアを選んだときには出ない（⚠️「不明」は選択肢に出さない。指示）。
 *
 * ⚠️⚠️ **横棒の色分けとパネル②は「相手ブランド側での到達段階」**（案A。2026-10-16 の指示）。
 *   例: KH のカードの「DJH」の棒 … KH の反響のうち DJH にも同じ人がいるもの。
 *       色はその人が **DJH で** どこまで進んだか（資料請求のみ／来場／次アポ／契約）。
 * ─────────────────────────────────────────────
 */

/** 商談フェーズの列。⚠️ staffContract.ts と同じ列ID（⚠️ DBのコメントは当てにならない） */
const COL_INQUIRY = 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99';     // 反響取得日
const COL_INTERVIEW = 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7';   // 初回面談（＝来場）
const COL_SCREENING = 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR';   // 事前審査
const COL_APPOINTMENT = 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA'; // 第二面談
const COL_CONTRACT = 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG';    // 契約

/** カードのブランド（⚠️ 画面の並び順もこの順。KHG は画面側で先頭に足す） */
export const CARD_BRANDS = ['KH', 'DJH', 'なごみ', '2L', 'JH', 'PGH', 'かえる', '中専'] as const;
/** カードの無いブランド（フルコミホームなど）・ブランド不明 */
export const OTHER_BRAND = 'その他';

/** master_data.brand → カードの表記 */
const ORDER_BRAND: Record<string, string> = {
  国分ハウジング: 'KH',
  デイジャストハウス: 'DJH',
  なごみ工務店: 'なごみ',
  ニーエルホーム: '2L',
  ジャスフィーホーム: 'JH',
  'PG HOUSE': 'PGH',
};
/** shop_list.brand → カードの表記（⚠️ master_data.brand が空のときに担当店舗から補う） */
const SHOP_BRAND: Record<string, string> = {
  KH: 'KH', DJH: 'DJH', なごみ: 'なごみ', '2L': '2L', JH: 'JH', PGH: 'PGH',
};

/** 中専として使う担当店舗。⚠️ 売り:ポータル・買い:ポータルなどは使わない（重複の相手にもしない） */
const RESALE_STORE = '買い:中古リノベ';

/** 到達段階。⚠️ 数字が大きいほど先まで進んでいる */
const STAGE = { request: 0, visit: 1, next: 2, contract: 3 } as const;
type Stage = (typeof STAGE)[keyof typeof STAGE];

interface CustomerRow extends RowDataPacket {
  brand: string | null;
  store: string | null;
  status: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  extra: string | null;
  address: string | null;
  col_inquiry: string | null;
  col_interview: string | null;
  col_screening: string | null;
  col_appointment: string | null;
  col_contract: string | null;
}

interface ShopRow extends RowDataPacket {
  shop: string;
  brand: string | null;
}

export interface SummaryFilter {
  /** `YYYY-MM`。⚠️ 空なら絞らない */
  start: string;
  end: string;
  /** 都道府県（例 鹿児島県）。⚠️ 空なら絞らない */
  area: string;
}

/** 総反響・来場・次アポ・契約。⚠️ 来場は「来場以降」、次アポは「次アポ以降」（累積） */
export interface Funnel {
  inquiry: number;
  visit: number;
  next: number;
  contract: number;
}

/** 横棒1本＋パネル②の1行（相手ブランドごと） */
export interface OtherBrandRow extends Funnel {
  brand: string;
  /** 積み上げの内訳（⚠️ 最も進んだ段階で1人1つ。合計＝inquiry） */
  stack: { request: number; visit: number; next: number; contract: number };
}

export interface DuplicateSummaryResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const hasValue = (value: unknown): boolean => String(value ?? '').trim() !== '';

/** 日付から `YYYY-MM`。読めなければ空文字（⚠️ staffContract.ts と同じ） */
const toMonth = (value: unknown): string => {
  const matched = /^(\d{4})[-/](\d{1,2})(?:[-/]|$)/.exec(String(value ?? '').trim());
  if (matched === null) return '';
  return `${matched[1]}-${matched[2].padStart(2, '0')}`;
};

/** ⚠️ 期間が空なら日付が読めない顧客も通す */
const inRange = (month: string, range: SummaryFilter): boolean => {
  if (range.start === '' && range.end === '') return true;
  if (month === '') return false;
  if (range.start !== '' && month < range.start) return false;
  if (range.end !== '' && month > range.end) return false;
  return true;
};

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県',
  '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県',
  '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

/**
 * 県名の無い住所のための、九州の市・郡 → 県（⚠️ 事業エリアのものだけ）。
 * ⚠️ 実測（2026-10-16）で県名が無い住所の先頭に多かったもの（出水市・霧島市・姶良市・薩摩川内市・都城市・八代市 など）を含む。
 * ⚠️ 町名だけ（`日之出町` など）は全国に同名があるので入れない（⚠️ 県が決まらず「不明」のまま）。
 */
const CITY_PREFECTURE: Record<string, string[]> = {
  鹿児島県: ['出水市', '霧島市', '姶良市', '薩摩川内市', '阿久根市', '伊佐市', '鹿屋市', '指宿市', '奄美市', '南さつま市',
    '南九州市', '曽於市', '志布志市', '日置市', 'いちき串木野市', '枕崎市', '垂水市', '西之表市',
    '大島郡', '熊毛郡', '肝属郡', '姶良郡', '出水郡', '薩摩郡', '曽於郡'],
  宮崎県: ['都城市', '延岡市', '日向市', '日南市', '小林市', '串間市', '西都市', 'えびの市',
    '児湯郡', '東諸県郡', '北諸県郡', '西諸県郡', '東臼杵郡', '西臼杵郡'],
  熊本県: ['八代市', '宇土市', '合志市', '水俣市', '菊池市', '玉名市', '山鹿市', '荒尾市', '人吉市', '天草市', '宇城市',
    '上天草市', '阿蘇市', '菊池郡', '阿蘇郡', '上益城郡', '下益城郡', '玉名郡', '葦北郡', '球磨郡', '八代郡'],
  大分県: ['別府市', '中津市', '日田市', '佐伯市', '臼杵市', '津久見市', '竹田市', '豊後高田市', '杵築市', '宇佐市',
    '豊後大野市', '由布市', '国東市', '速見郡', '玖珠郡'],
  佐賀県: ['唐津市', '鳥栖市', '伊万里市', '武雄市', '鹿島市', '小城市', '嬉野市', '神埼市'],
  福岡県: ['北九州市', '久留米市', '大牟田市', '筑後市', '柳川市', '八女市'],
};

/**
 * full_address から都道府県を決める。決まらなければ空文字。
 *
 * ⚠️⚠️ **書き方がそろっていない**（実測 2026-10-16）:
 *   `鹿児島県…`（大半）／`〒899-5105鹿児島県…`（郵便番号が先頭）／`熊本市北区…`（市から始まる）／`松橋町…`（県も市も無い）。
 *   1. 〒・郵便番号・空白を落とす → 2. 先頭の都道府県名 → 3. 途中にある都道府県名
 *   → 4. 県名と同じ名前の市（`熊本市` → 熊本県。⚠️ `京都市`→京都府、`東京`は対象外）→ 5. 決まらなければ空
 */
const prefectureOf = (address: unknown): string => {
  // ⚠️ 郵便番号は **先頭だけ** 落とす（⚠️ 番地の途中の7桁を消さない）
  const text = String(address ?? '').trim().replace(/^〒?\s*\d{3}[-－ー‐]?\d{4}/, '').replace(/\s/g, '');
  if (text === '') return '';
  const head = PREFECTURES.find((p) => text.startsWith(p));
  if (head !== undefined) return head;
  const inside = PREFECTURES.find((p) => text.includes(p));
  if (inside !== undefined) return inside;
  // ⚠️ 県名と同じ名前の市（`熊本市` → 熊本県）。⚠️ 先頭でなくても拾う（`本県熊本市`・`分県大分市` のような打ち間違いがある）
  const city = PREFECTURES.find((p) => p !== '北海道' && p !== '東京都' && text.includes(`${p.slice(0, -1)}市`));
  if (city !== undefined) return city;
  const local = Object.entries(CITY_PREFECTURE).find(([, names]) => names.some((n) => text.startsWith(n)));
  return local === undefined ? '' : local[0];
};

/** trim ＋ 空白（全角・改行を含む）を除く */
const squash = (value: unknown): string => String(value ?? '').trim().replace(/\s/g, '');

/**
 * 重複判定のキー。⚠️ 種類ごとに接頭辞を付ける（⚠️ メールと住所が偶然同じ文字列でも混ざらない）。
 * ⚠️ 電話と携帯は同じ種類として比べる（⚠️ 片方の電話欄に携帯番号を入れている顧客がいる）。
 */
const keysOf = (row: CustomerRow): string[] => {
  const keys: string[] = [];
  for (const tel of [row.phone, row.mobile]) {
    const digits = squash(tel).replace(/[-‐－―ー−]/g, '');
    if (/^\d{10,}$/.test(digits)) keys.push(`tel:${digits}`);
  }
  const mail = squash(row.email).toLowerCase();
  if (mail.includes('@')) keys.push(`mail:${mail}`);
  const extra = squash(row.extra);
  if (extra.length >= 8) keys.push(`addr:${extra}`);
  return [...new Set(keys)];
};

const stageOf = (row: CustomerRow): Stage => {
  if (row.status === '契約済み') return STAGE.contract;
  if (hasValue(row.col_screening) || hasValue(row.col_appointment) || hasValue(row.col_contract)) return STAGE.next;
  if (hasValue(row.col_interview)) return STAGE.visit;
  return STAGE.request;
};

/** 1件分（集計用に整えたもの） */
interface Customer {
  brand: string;
  /** カードの数字に数えるか（⚠️ status＝重複 は数えない。相手としては使う） */
  counted: boolean;
  /** 期間に入っているか */
  inPeriod: boolean;
  /** 都道府県（full_address から）。⚠️ 決まらなければ空 */
  pref: string;
  stage: Stage;
  keys: string[];
}

const emptyFunnel = (): Funnel => ({ inquiry: 0, visit: 0, next: 0, contract: 0 });
const addStage = (funnel: Funnel, stage: Stage): void => {
  funnel.inquiry += 1;
  if (stage >= STAGE.visit) funnel.visit += 1;
  if (stage >= STAGE.next) funnel.next += 1;
  if (stage >= STAGE.contract) funnel.contract += 1;
};
const STACK_KEY = ['request', 'visit', 'next', 'contract'] as const;

/** 相手ブランドごとの行を作る器 */
const otherRows = () => {
  const map = new Map<string, OtherBrandRow>();
  return {
    add(brand: string, stage: Stage) {
      const row = map.get(brand) ?? { brand, ...emptyFunnel(), stack: { request: 0, visit: 0, next: 0, contract: 0 } };
      addStage(row, stage);
      row.stack[STACK_KEY[stage]] += 1;
      map.set(brand, row);
    },
    /** ⚠️ 多い順（⚠️ 同数ならカードの並び順） */
    list(): OtherBrandRow[] {
      const order = (b: string) => { const i = (CARD_BRANDS as readonly string[]).indexOf(b); return i < 0 ? 99 : i; };
      return [...map.values()].sort((a, b) => b.inquiry - a.inquiry || order(a.brand) - order(b.brand));
    },
  };
};

/**
 * 重複反響サマリーを返す。
 *
 * ⚠️ 期間は **カードのブランド側の反響取得日** で絞る。⚠️ 相手側は期間に関係なく全件と比べる
 *   （⚠️ 先に他ブランドへ問い合わせていた人も「重複」として拾うため）。
 */
export const runDuplicateSummary = async (range: SummaryFilter): Promise<DuplicateSummaryResult> => {
  const columns = `brand, in_charge_store AS store, status,
                   customer_contacts_phone_number AS phone,
                   customer_contacts_mobile_phone_number AS mobile,
                   customer_contacts_email AS email,
                   extra_address_info AS extra,
                   full_address AS address,
                   ${COL_INQUIRY} AS col_inquiry,
                   ${COL_INTERVIEW} AS col_interview,
                   ${COL_SCREENING} AS col_screening,
                   ${COL_APPOINTMENT} AS col_appointment,
                   ${COL_CONTRACT} AS col_contract`;

  const [shops, order, kaeru, resale] = await Promise.all([
    query<ShopRow>('SELECT shop, brand FROM shop_list'),
    query<CustomerRow>(`SELECT ${columns} FROM master_data`),
    query<CustomerRow>(`SELECT ${columns} FROM master_data_kaeru`),
    query<CustomerRow>(`SELECT ${columns} FROM master_data_resale WHERE in_charge_store = ?`, [RESALE_STORE]),
  ]);

  const shopBrand = new Map<string, string>();
  for (const s of shops) if (hasValue(s.brand)) shopBrand.set(s.shop, String(s.brand).trim());

  /** master_data のブランド。⚠️ 空なら担当店舗の shop_list.brand で補う。⚠️ 決まらなければ「その他」 */
  const orderBrandOf = (row: CustomerRow): string => {
    const named = ORDER_BRAND[String(row.brand ?? '').trim()];
    if (named !== undefined) return named;
    if (hasValue(row.brand)) return OTHER_BRAND; // フルコミホームなど
    return SHOP_BRAND[shopBrand.get(String(row.store ?? '').trim()) ?? ''] ?? OTHER_BRAND;
  };

  const toCustomer = (row: CustomerRow, brand: string): Customer => ({
    brand,
    counted: row.status !== '重複',
    inPeriod: inRange(toMonth(row.col_inquiry), range),
    pref: prefectureOf(row.address),
    stage: stageOf(row),
    keys: keysOf(row),
  });
  const customers: Customer[] = [
    ...order.map((r) => toCustomer(r, orderBrandOf(r))),
    ...kaeru.map((r) => toCustomer(r, 'かえる')),
    ...resale.map((r) => toCustomer(r, '中専')),
  ];

  /** キー → そのキーを持つ顧客 */
  const byKey = new Map<string, Customer[]>();
  for (const c of customers) {
    for (const key of c.keys) {
      const found = byKey.get(key);
      if (found === undefined) byKey.set(key, [c]);
      else found.push(c);
    }
  }

  /**
   * 相手ブランド → その人の相手ブランド側での最も進んだ段階。
   * ⚠️ 同じブランドの顧客は相手にしない（⚠️ 横軸は「カード以外のブランド」）。
   */
  const counterpartsOf = (c: Customer): Map<string, Stage> => {
    const result = new Map<string, Stage>();
    for (const key of c.keys) {
      for (const other of byKey.get(key) ?? []) {
        if (other === c || other.brand === c.brand) continue;
        const best = result.get(other.brand);
        if (best === undefined || other.stage > best) result.set(other.brand, other.stage);
      }
    }
    return result;
  };

  const brands = [...CARD_BRANDS, OTHER_BRAND];
  const cards: Record<string, { own: Funnel; duplicated: number; others: OtherBrandRow[] }> = {};
  const groupOwn = emptyFunnel();
  /** KHG カードの横棒・パネル②: ブランドごとの「他ブランドと重複した反響」 */
  const groupRows = new Map<string, { brand: string; total: number; dup: Funnel; stack: OtherBrandRow['stack'] }>();

  for (const brand of brands) {
    const own = emptyFunnel();
    const others = otherRows();
    let duplicated = 0;
    const groupRow = { brand, total: 0, dup: emptyFunnel(), stack: { request: 0, visit: 0, next: 0, contract: 0 } };

    for (const c of customers) {
      if (c.brand !== brand || !c.counted || !c.inPeriod) continue;
      if (range.area !== '' && c.pref !== range.area) continue;
      addStage(own, c.stage);
      addStage(groupOwn, c.stage);
      groupRow.total += 1;

      const counterparts = counterpartsOf(c);
      if (counterparts.size === 0) continue;
      duplicated += 1;
      for (const [otherBrand, stage] of counterparts) others.add(otherBrand, stage);

      // ⚠️ KHG は相手が複数あれば最も進んだ段階で数える
      const best = Math.max(...counterparts.values()) as Stage;
      addStage(groupRow.dup, best);
      groupRow.stack[STACK_KEY[best]] += 1;
    }
    cards[brand] = { own, duplicated, others: others.list() };
    groupRows.set(brand, groupRow);
  }

  /**
   * エリアの選択肢。⚠️ カードに数える顧客（status＝重複 以外）の都道府県を件数の多い順に。
   * ⚠️⚠️ **期間・エリアの絞り込みに関係なく全部返す**（⚠️ 選んだ瞬間に他の選択肢が消えないように）。
   * ⚠️ 都道府県が決まらない顧客（空）は出さない（指示）。
   */
  const prefCount = new Map<string, number>();
  for (const c of customers) if (c.counted && c.pref !== '') prefCount.set(c.pref, (prefCount.get(c.pref) ?? 0) + 1);
  const areas = [...prefCount.entries()].sort((a, b) => b[1] - a[1]).map(([pref]) => pref);

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      range,
      areas,
      brands: CARD_BRANDS,
      cards,
      group: {
        own: groupOwn,
        // ⚠️ 重複の多い順
        byBrand: [...groupRows.values()].filter((r) => r.total > 0).sort((a, b) => b.dup.inquiry - a.dup.inquiry),
      },
    },
  };
};
