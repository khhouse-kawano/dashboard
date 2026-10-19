# 2026-10-16 重複反響サマリーにエリア（都道府県）・ActiveUser に右端へ隠す × ボタン（v2.2.193）

## 依頼
- 重複反響サマリーのコントロールに **エリア**（`const [targetArea, setTargetArea] = useState('')`）を追加し、都道府県で分けたサマリーを出す。full_address で判断する
- 同じブランチで ActiveUser.tsx に × ボタン。クリックしたら消さずにウインドウ右端に隠し、再び展開できるようにする
- 確認事項への回答（2026-10-16）: 1. 都道府県が分からない顧客の「不明」は選択肢に **出さない** 2. 隠した状態はページを移っても **保つ**

## 変更ファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features | **duplicateSummary.ts** | 関数 `prefectureOf`、定数 `PREFECTURES`・`CITY_PREFECTURE` を追加。型 `MonthRange` → `SummaryFilter`（area を追加）。full_address を読み、カードのブランド側の反響だけエリアで絞る。応答に `areas`（選択肢） |
| backend-express/src/gateway | **registry.ts** | `duplicate_summary` で `area` を受け取る |
| frontend/src/components/header | **DuplicateInquirySummary.tsx** | state `targetArea`・`areaOptions`、エリアの select、「絞り込みを外す」、注記 |
| frontend/src/components | **ActiveUser.tsx** | 定数 `HIDDEN_KEY`・`hiddenTabStyle`、関数 `readHidden`、state `hidden`、× ボタン、右端のつまみ |

⚠️ ① の PHP は前回（express_proxy.php に duplicate_summary）のまま。追加の変更なし。

## エリアの判定（prefectureOf）
1. 先頭の〒・郵便番号と空白を落とす（⚠️ 先頭だけ。番地の途中の7桁は消さない）
2. 先頭が都道府県名 → それ
3. 途中に都道府県名 → それ
4. 県名と同じ名前の市（`熊本市` → 熊本県。途中でも可: `本県熊本市` のような打ち間違い）
5. 九州の主な市・郡（出水市・霧島市・都城市・八代市・別府市 など。`CITY_PREFECTURE`）
6. 決まらなければ空（エリアを選ぶと出ない。選択肢にも出さない）
- 実測: 注文の「県名が先頭に無い住所」1,176件のうち、不明は 595 → 369件（3〜5 で補えた）
- 絞るのはカードのブランド側の反響だけ。相手のブランドは住所に関係なく全件と比べる
- 選択肢: カードに数える顧客の都道府県を件数の多い順（47件。絞り込みに関係なく全部）

## ActiveUser の × ボタン
- 見出しの ▾ の隣に ×。押すとパネルを `display: none` にし、右端（ヘッダーの下）に「‹ ● 人数」のつまみを出す。つまみを押すと元の位置に戻る
- ⚠️ パネルは外さずに display で消す（ドラッグの設定は最初の1回だけ付けているため、外すと動かせなくなる）
- 隠した状態は localStorage（`activeUserHidden`）に保存し、ページ移動・再読み込みでも保つ。⚠️ 読み書きは try で包む
- heartbeat・アクティブユーザーの取得は止めない

## 確認
- ②: 型チェック通過。エリア 鹿児島県 で KH 総反響 15,347 → 5,158、熊本県 2,560。期間×エリア（2026-04〜09・宮崎県）も絞れる
- ① 経由（localhost:8080/、トークン無し）で `duplicate_summary` → 401（② まで届く）
- フロント: 型チェックは既存の5件以外なし、ビルド main.05c8c0b7.js
- Playwright:
  - エリアの選択肢 47件（「不明」なし）、選ぶと `area=鹿児島県` で取り直し、KH の総反響 5,158
  - × → パネルが消えてつまみが出る → 再読み込みしても隠れたまま → つまみでパネルが戻る
  - ドラッグ: 隠す前・戻した後のどちらも 200px 動く
- ⚠️ 未確認: ログインした状態で開発環境の画面から開く確認

---

## duplicateSummary.ts（全文）
```ts
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
```

## ActiveUser.tsx（全文）
```tsx
import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import AuthContext from '../context/AuthContext';
import { useLocation } from "react-router-dom";
import apiClient from '../utils/apiClient';
import { openDailyAction, DAILY_CATEGORIES, NO_DAILY_ACTION } from './DailyAction';

type User = { id?: string | number, name: string, heartbeat: string };

/**
 * 「要確認」ボタンの見た目。
 *
 * ⚠️ ⚠️ **この枠は position: fixed で常に浮いている。** ⚠️ 幅が狭いので**1行に収める。**
 * ⚠️ 色は DailyAction.tsx の見出しと合わせてある（⚠️ 放置＝赤）。
 */
const alertButtonStyle: React.CSSProperties = {
    width: '100%',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 8,
    whiteSpace: 'nowrap',
};

/**
 * パネルを右端に隠しているか（v2.2.193）。⚠️⚠️ **ページを移っても・再読み込みしても保つ**（2026-10-16 の指示）。
 *   ⚠️ localStorage はブラウザの設定で使えないことがあるので、⚠️ 読み書きは必ず try で包む（使えなければ表示のまま）。
 */
const HIDDEN_KEY = 'activeUserHidden';
const readHidden = (): boolean => {
    try { return localStorage.getItem(HIDDEN_KEY) === '1'; } catch { return false; }
};

/** 右端のつまみ。⚠️ ヘッダーの下に出す（⚠️ --header-h は Header.tsx が実測して入れている） */
const hiddenTabStyle: React.CSSProperties = {
    position: 'fixed',
    right: 0,
    top: 'calc(var(--header-h, 30px) + 12px)',
    zIndex: 11000,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRight: 'none',
    borderRadius: '10px 0 0 10px',
    boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
    padding: '6px 8px 6px 10px',
    fontSize: 12,
    fontWeight: 700,
    color: '#333',
    cursor: 'pointer',
};

const ActiveUser: React.FC = () => {
    const { token, userName, category } = useContext(AuthContext);
    const location = useLocation();
    const [activeUsers, setActiveUsers] = useState<User[]>([]);
    const [isInactive, setIsInactive] = useState(false);
    const [collapsed, setCollapsed] = useState(true);
    /** ⚠️ × で右端に隠す。⚠️ 消すのではない（つまみから戻せる） */
    const [hidden, setHidden] = useState<boolean>(readHidden);

    useEffect(() => {
        try { localStorage.setItem(HIDDEN_KEY, hidden ? '1' : '0'); } catch { /* ⚠️ 保存できなくても表示は切り替わる */ }
    }, [hidden]);

    // --- ドラッグ用 refs / state ---
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef(false);
    const startRef = useRef({ x: 0, y: 0 }); // pointer start
    const posRef = useRef({ x: 0, y: 0 }); // 初期は (0,0) にしておく

    const [width, setWidth] = useState(window.innerWidth);

    useEffect(() => {
        const onResize = () => setWidth(window.innerWidth);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);


    const [_, forceRerender] = useState(0); // 最小限の再描画用

    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 600) {
            setCollapsed(true);
        }
    }, []);

    useEffect(() => {
        if (!token) return;
        if (location.pathname === '/login') return;

        let timer: ReturnType<typeof setTimeout>;

        const resetTimer = () => {
            setIsInactive(false);
            clearTimeout(timer);
            timer = setTimeout(() => setIsInactive(true), 20000);
        };

        const sendHeartbeat = () => {
            apiClient.post("", { request: 'heartbeat', token, url: location.pathname }).catch(() => { }); resetTimer();
        };

        sendHeartbeat();
        const hbInterval = setInterval(sendHeartbeat, 20000);

        return () => {
            clearInterval(hbInterval);
            clearTimeout(timer);
        };
    }, [location.pathname, token]);

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            try {
                const res = await apiClient.post("", { request: 'login_log' });
                setActiveUsers(Array.isArray(res.data) ? res.data : []);
            } catch (e) {
                console.error('active users fetch error', e);
            }
        };

        fetchData();
        const interval = setInterval(() => fetchData(), 10000);

        return () => clearInterval(interval);
    }, [token]);

    const getStatus = (heartbeat: string) => {
        const now = Date.now();
        const t = new Date(heartbeat).getTime();
        const diff = now - t;
        if (diff <= 10_000) return 'online';
        if (diff <= 35_000) return 'idle';
        if (diff <= 60_000) return 'away';
        return 'offline';
    };

    const opacityByStatus = (status: string) => status === 'online' ? 1 : status === 'idle' ? 0.85 : 0.6;

    const activeList = useMemo(() => {
        return activeUsers
            .filter(u => u.name !== userName)
            .filter(u => getStatus(u.heartbeat) !== 'offline')
            .sort((a, b) => new Date(b.heartbeat).getTime() - new Date(a.heartbeat).getTime());
    }, [activeUsers, userName]);

    const activeCount = activeList.length;

    const fixedWrapperBase: React.CSSProperties = {
        position: 'fixed',
        top: 20, // ここは初期表示の目安。実際の left/top は initPos で上書きします
        right: 20, // 初期スタイルとして右上に見せるため
        zIndex: 11000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        pointerEvents: 'auto',
        touchAction: 'none'
    };

    const containerStyle: React.CSSProperties = {
        background: '#fff',
        padding: '8px 12px',
        borderRadius: 10,
        boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
        fontSize: 13,
        minWidth: 130,
        maxWidth: 220,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-start',
        cursor: 'grab',
        userSelect: 'none'
    };

    const headerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        justifyContent: 'space-between',
        gap: 8
    };

    const dotStyle = (status: string): React.CSSProperties => {
        switch (status) {
            case 'online': return { color: '#0d6efd' };
            case 'idle': return { color: '#ffc107' };
            case 'away': return { color: '#6c757d' };
            default: return { color: '#6c757d' };
        }
    };

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const initPos = () => {
            const rect = wrapper.getBoundingClientRect();

            // posRef がまだ初期値のままなら右上に配置する
            // （ユーザーが既に移動して posRef に値が入っていればそれを優先）
            if (posRef.current.x === 0 && posRef.current.y === 0) {
                const left = Math.max(0, window.innerWidth - rect.width - 20); // right:20 相当
                const top = 0; // 上から20px
                posRef.current.x = left;
                posRef.current.y = top;
                wrapper.style.left = `${left}px`;
                wrapper.style.top = `${top}px`;
                wrapper.style.right = 'auto';
                wrapper.style.bottom = 'auto';
            } else {
                wrapper.style.left = `${posRef.current.x}px`;
                wrapper.style.top = `${posRef.current.y}px`;
                wrapper.style.right = 'auto';
                wrapper.style.bottom = 'auto';
            }
        };


        initPos();

        const onPointerDown = (e: PointerEvent) => {
            // 折りたたみボタンなどのクリックを妨げないように、左ボタンのみで開始
            if (e.button !== undefined && e.button !== 0) return;
            draggingRef.current = true;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            startRef.current = { x: e.clientX, y: e.clientY };
            // 現在の位置を取得
            const left = posRef.current.x ?? wrapper.getBoundingClientRect().left;
            const top = posRef.current.y ?? wrapper.getBoundingClientRect().top;
            startRef.current = { x: e.clientX - left, y: e.clientY - top };
            wrapper.style.cursor = 'grabbing';
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!draggingRef.current) return;
            e.preventDefault();
            const newLeft = e.clientX - startRef.current.x;
            const newTop = e.clientY - startRef.current.y;

            // 画面外に出さない簡易制限
            const clampedLeft = Math.max(0, Math.min(window.innerWidth - wrapper.offsetWidth, newLeft));
            const clampedTop = Math.max(0, Math.min(window.innerHeight - wrapper.offsetHeight, newTop));

            posRef.current.x = clampedLeft;
            posRef.current.y = clampedTop;

            wrapper.style.left = `${clampedLeft}px`;
            wrapper.style.top = `${clampedTop}px`;
        };

        const onPointerUp = (e: PointerEvent) => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch { }
            wrapper.style.cursor = 'grab';
            // 最小限の再描画（必要なら UI を更新）
            forceRerender(n => n + 1);
        };

        // pointer events を使う（マウス・タッチ両対応）
        wrapper.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);

        // ウィンドウリサイズ時に位置を補正
        const onResize = () => {
            const w = wrapper.offsetWidth;
            const h = wrapper.offsetHeight;
            if (posRef.current.x !== undefined) {
                posRef.current.x = Math.min(posRef.current.x, window.innerWidth - w);
                posRef.current.y = Math.min(posRef.current.y, window.innerHeight - h);
                wrapper.style.left = `${posRef.current.x}px`;
                wrapper.style.top = `${posRef.current.y}px`;
            }
        };
        window.addEventListener('resize', onResize);

        return () => {
            wrapper.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return (
        <> {location.pathname !== '/login' && width >= 768 &&
            <div
                ref={wrapperRef}
                style={{
                    ...fixedWrapperBase,
                    left: undefined as any,
                    top: undefined as any,
                    // ⚠️⚠️ **隠すときも外さずに display で消す。**
                    //   ⚠️ 外すとドラッグの設定（上の useEffect は最初の1回だけ）が新しい要素に付かず、動かせなくなる
                    display: hidden ? 'none' : fixedWrapperBase.display,
                }}
                aria-label="Active users fixed"
            >
                <div style={containerStyle} aria-label="Active users">
                    {/*
                      ⚠️⚠️ **「要確認」ボタン（2026-09-28 の指示）。**
                        ⚠️ ⚠️ **注文・建売・中古のとき・常に出す**（⚠️ 今日もう確認していても出す）。
                          ⚠️ v2.2.175 修正: 注文だけ → ⚠️ DailyAction.tsx の DAILY_CATEGORIES（order / spec / used）。
                          ⚠️ 事業を選ぶ画面（`/`・`/home`）では出さない（⚠️ DailyAction の対象外）。
                        ⚠️ 押すと `App.tsx` に1つだけ置いた `DailyAction` が開く。
                        ⚠️ ⚠️ **確認済みなら中のボタンは「閉じる」**になり、記録はしない。
                        ⚠️ この枠自体が `width >= 768` のときしか出ないので、
                          ⚠️ **スマホでは出ない**（DailyAction 側の条件とも一致する）。
                    */}
                    {DAILY_CATEGORIES.includes(category) && !NO_DAILY_ACTION.includes(location.pathname) && (
                        <button
                            type="button"
                            style={alertButtonStyle}
                            onClick={openDailyAction}
                            aria-label="要確認の顧客を表示"
                        >
                            要確認
                        </button>
                    )}
                    <div style={headerStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: '#0d6efd' }}>●</span>
                            <strong style={{ fontSize: 13 }}>{userName}</strong>
                            {isInactive && <span style={{ color: '#dc3545', marginLeft: 8, fontWeight: 500 }}>離席</span>}
                        </div>

                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                                onClick={() => setCollapsed(prev => !prev)}
                                aria-label={collapsed ? "Show active users" : "Hide active users"}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 4,
                                    fontSize: 14,
                                    color: '#333'
                                }}
                            >
                                {collapsed ? '▾' : '▴'}
                            </button>
                            {/* ⚠️ v2.2.193: 右端に隠す（⚠️ 右端のつまみから戻せる） */}
                            <button
                                type="button"
                                onClick={() => setHidden(true)}
                                aria-label="右端に隠す"
                                title="右端に隠す"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 4,
                                    fontSize: 14,
                                    lineHeight: 1,
                                    color: '#6c757d'
                                }}
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    {collapsed && (
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ color: '#6c757d', fontSize: 13 }}>
                                アクティブ: <strong style={{ color: '#333' }}>{activeCount}</strong>人
                            </div>
                        </div>
                    )}

                    {!collapsed && (
                        <div style={{ width: '100%' }}>
                            {activeList.length === 0 ? (
                                <div style={{ color: '#6c757d', fontSize: 13 }}>アクティブなユーザーはいません</div>
                            ) : (
                                activeList.slice(0, 20).map(u => {
                                    const status = getStatus(u.heartbeat);
                                    return (
                                        <div
                                            key={u.id ?? u.name}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: opacityByStatus(status), marginBottom: 6 }}
                                            aria-label={`${u.name} is ${status}`}
                                        >
                                            <span style={{ ...dotStyle(status) }}>●</span>
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                                        </div>
                                    );
                                })
                            )}
                            {activeList.length > 20 && <div>その他{activeList.length - 20}人がアクティブ</div>}
                        </div>
                    )}
                </div>
            </div>}
            {/* 隠しているときの右端のつまみ。⚠️ 出す条件はパネルと同じ（ログイン画面・狭い画面では出さない） */}
            {location.pathname !== '/login' && width >= 768 && hidden && (
                <button
                    type="button"
                    style={hiddenTabStyle}
                    onClick={() => setHidden(false)}
                    aria-label="アクティブユーザーを表示"
                    title="アクティブユーザーを表示"
                >
                    <span style={{ color: '#6c757d' }}>‹</span>
                    <span style={{ color: '#0d6efd' }}>●</span>
                    {activeCount}
                </button>
            )}
        </>
    );
};

export default ActiveUser;
```

## DuplicateInquirySummary.tsx（変更部分）
```tsx
@@ -30,4 +30,6 @@ type GroupRow = { brand: string; total: number; dup: Funnel; stack: Stack };
 type Summary = {
     brands: string[];
+    /** エリアの選択肢（都道府県。件数の多い順）。⚠️ 絞り込みに関係なく全部来る */
+    areas: string[];
     cards: Record<string, Card>;
     group: { own: Funnel; byBrand: GroupRow[] };
@@ -158,4 +160,11 @@ const DuplicateInquirySummary = () => {
     const [startMonth, setStartMonth] = useState('');
     const [endMonth, setEndMonth] = useState('');
+    /**
+     * エリア（都道府県）。⚠️ ② が full_address から決める（2026-10-16 の指示）。
+     *   ⚠️ 期間と同じく **カードのブランド側の反響だけ** を絞る。⚠️ 都道府県が分からない顧客は、選ぶと出なくなる。
+     */
+    const [targetArea, setTargetArea] = useState('');
+    /** ⚠️ 選択肢は最初に取れたものを持ち続ける（⚠️ 取り直し中に select が空にならないように） */
+    const [areaOptions, setAreaOptions] = useState<string[]>([]);
 
     const fetchData = useCallback(async () => {
@@ -163,5 +172,5 @@ const DuplicateInquirySummary = () => {
         setError('');
         try {
-            const res = await apiClient.post('', { request: 'duplicate_summary', startMonth, endMonth });
+            const res = await apiClient.post('', { request: 'duplicate_summary', startMonth, endMonth, area: targetArea });
             if (res.data?.status !== 'ok') {
                 setError(res.data?.message ?? '集計を取得できませんでした。');
@@ -169,4 +178,5 @@ const DuplicateInquirySummary = () => {
             }
             setSummary(res.data as Summary);
+            setAreaOptions(res.data.areas ?? []);
         } catch (e: unknown) {
             const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
@@ -175,5 +185,5 @@ const DuplicateInquirySummary = () => {
             setLoading(false);
         }
-    }, [startMonth, endMonth]);
+    }, [startMonth, endMonth, targetArea]);
 
     useEffect(() => { void fetchData(); }, [fetchData]);
@@ -264,4 +274,12 @@ const DuplicateInquirySummary = () => {
 
                 <div className="ds_bar">
+                    <div>
+                        <div className="ds_label">エリア（住所の都道府県）</div>
+                        <Form.Select size="sm" value={targetArea} style={{ width: '150px', fontSize: '12px' }}
+                            onChange={(e) => setTargetArea(e.target.value)}>
+                            <option value="">すべて</option>
+                            {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
+                        </Form.Select>
+                    </div>
                     <div>
                         <div className="ds_label">開始月（反響取得日）</div>
@@ -280,7 +298,7 @@ const DuplicateInquirySummary = () => {
                         </Form.Select>
                     </div>
-                    <button type="button" className="ds_reset" disabled={startMonth === '' && endMonth === ''}
-                        onClick={() => { setStartMonth(''); setEndMonth(''); }}>
-                        期間を外す
+                    <button type="button" className="ds_reset" disabled={startMonth === '' && endMonth === '' && targetArea === ''}
+                        onClick={() => { setStartMonth(''); setEndMonth(''); setTargetArea(''); }}>
+                        絞り込みを外す
                     </button>
                     {/* ⚠️ 開始が終了より後だと0件になる。⚠️ **黙って空にしない** */}
@@ -299,5 +317,6 @@ const DuplicateInquirySummary = () => {
                     <br />
                     ※ 横棒とパネル②の来場・次アポ・契約は、<b>相手のブランドで</b>どこまで進んだかです。
-                    期間は<b>カードのブランドの反響取得日</b>で絞ります（相手のブランドは期間に関係なく比べます）。
+                    期間は<b>カードのブランドの反響取得日</b>、エリアは<b>カードのブランドの顧客の住所</b>で絞ります（相手のブランドは期間・住所に関係なく比べます）。
+                    住所から都道府県が分からない顧客は、エリアを選ぶと数字に入りません。
                     <br />
                     ※ 来場＝初回面談以降の日付あり、次アポ＝事前審査・第二面談・契約の日付あり、契約＝状況が「契約済み」です。
@@ -341,5 +360,5 @@ const DuplicateInquirySummary = () => {
                                             <th className="ds_th text-end">重複</th>
                                             <th className="ds_th text-end">重複率</th>
-                                            <th className="ds_th text-end" title="重複した人が他ブランドで契約した数">他で契約</th>
+                                            <th className="ds_th text-end" title="重複した人が他ブランドで契約した数">他ブランドで契約</th>
                                         </tr>
                                     </thead>
```

## registry.ts（変更部分）
```ts
 *   ⚠️ 中身は features/duplicateSummary.ts。⚠️ 期間は `YYYY-MM`（反響取得日）、エリアは都道府県。空は「絞らない」。
    const result = await runDuplicateSummary({ start: text('startMonth'), end: text('endMonth'), area: text('area') });
```
