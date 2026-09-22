import type { RowDataPacket } from 'mysql2/promise';
import { asDate, PHASES } from './columns';
import { query } from '../../db/pool';
import type { SqlParam } from '../../db/pool';

/**
 * 競合分析用のデータ（注文事業 / 建売分譲事業）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **このファイルだけ、集計値ではなく「顧客1件ごとの行」を返す。**
 *
 *   ⚠️ 他の /analysis は集計値しか返さない。⚠️ **ここは例外である。**
 *   ⚠️ 「誰にどの理由で負けたか」は ⚠️ **自由記述（競合欄・失注理由・面談シート）
 *     の中にしかなく**、集計値では読み取れない（2026-09-21 の指示）。
 *
 *   ⚠️⚠️ **そのかわり、個人を特定できる値は1つも返さない。**
 *     ⚠️ 氏名・電話・メール・住所・物件名は列ごと外し、
 *       ⚠️ **自由記述に紛れているものは伏字に置き換える**（maskPii / maskKnownNames）。
 *     ⚠️ ⚠️ **列を足すときは必ず PII_COLUMNS を見直すこと。**
 *
 * ⚠️ 移植元: backend/src/core/kpi.php の buildCompetitorSnapshot()
 *   ⚠️ ⚠️ **PHP 側（画面からの実行）は廃止する。** ⚠️ 課金の発生源だったため。
 *   ⚠️ こちらは ⚠️ **利用者自身の Claude アカウント**から MCP 経由で呼ばれる。
 *     ⚠️ ⚠️ **社内の API キーは使わない＝会社に課金が発生しない。**
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export type CompetitorDivision = 'order' | 'kaeru';

/** 伏字の記号 */
const MASK = '****';

/**
 * 部門ごとの対象テーブル。
 *
 * ⚠️⚠️ **テーブル名はプレースホルダに渡せない。必ずこの表で解決すること。**
 *   ⚠️ リクエストの値をそのまま SQL に連結すると SQL インジェクションになる。
 */
const DIVISIONS: Record<CompetitorDivision, { table: string; label: string }> = {
  order: { table: 'master_data', label: '注文事業' },
  kaeru: { table: 'master_data_kaeru', label: '建売分譲事業' },
};

/** 1回に返す行数の上限。⚠️ 勝ち・負けで半分ずつ使う */
const MAX_ROWS = 1000;

/** 1顧客ぶんの商談メモの文字数 */
const MEMO_CHARS = 220;

/** 面談1件ぶんの note の上限。⚠️ 1件だけで全部使い切らないようにする */
const NOTE_CHARS = 90;

/**
 * 伏字にする列。
 *
 * ⚠️⚠️ **SELECT はするが、返す行には入れない。**
 *   ⚠️ 自由記述に紛れた同じ値を消すために、値そのものは必要なため取得する。
 */
const PII_COLUMNS = [
  'customer_contacts_name',
  'customer_contacts_name_kana',
  'customer_contacts_name_2',
  'customer_contacts_mobile_phone_number',
  'customer_contacts_phone_number',
  'customer_contacts_email',
  'full_address',
  'planned_construction_site',
] as const;

/**
 * 部門ごとの競合関連の列。
 *
 * ⚠️⚠️ **建売分譲事業（master_data_kaeru）には勝因・価格差・対策の列が無い。**
 *   ⚠️ ⚠️ **両方に投げると「Unknown column」で落ちる。**
 */
const EXTRA_COLUMNS: Record<CompetitorDivision, Record<string, string>> = {
  order: {
    competitor_win_reason: 'win_reason',
    competitor_price_gap: 'price_gap',
    competitor_sales_person: 'rival_sales_person',
    competitor_countermeasure: 'countermeasure',
    competitor_campaign: 'rival_campaign',
  },
  kaeru: {},
};

/**
 * 勝ち負けを決めるステータス。
 *
 * ⚠️⚠️ **ここに無いステータスの行は返さない。**
 *   ⚠️ 「見込み」「会社管理」はまだ決着していない（注文の約8割がこれ）。
 *     ⚠️ ⚠️ **負けに数えると、負けが実際の5倍以上に膨らむ。**
 *   ⚠️ 「重複」は同一顧客の二重登録なので数えない。
 *
 * ⚠️⚠️ **建売分譲事業には「失注」というステータスが無い**（2026-09-21 実測）。
 *   ⚠️ いちばん近いのが「追客終了」なので、これを負けとして扱う。
 *   ⚠️ ⚠️ **追客終了は他社に負けたとは限らない**（予算・時期の都合も含む）。
 */
const STATUSES: Record<CompetitorDivision, { win: string[]; lost: string[] }> = {
  order: { win: ['契約済み', '解約', '解約済み'], lost: ['失注'] },
  kaeru: { win: ['契約済み', '解約', '解約済み'], lost: ['追客終了'] },
};

/**
 * 自社グループの社名。
 *
 * ⚠️⚠️ **house_maker には自社の社名も登録されている。**
 *   ⚠️ 除外しないと ⚠️ **「国分ハウジング」が最大の競合として集計される**
 *     （2026-09-21 実測: 注文71件・建売163件で1位だった）。
 *   ⚠️ ⚠️ **商談メモには自社名がいくらでも出てくるため、必ず外れる。**
 *
 * ⚠️ 消すのではなく own_group として別の欄に出す。
 *   ⚠️ **グループ内での取り合いは、それ自体が見たい情報**だからである。
 * ⚠️ ⚠️ **「ジャストホーム」は自社ではない**（シアーズホーム系の他社）。入れないこと。
 */
const OWN_GROUP_NAMES = [
  '国分ハウジング',
  'デイジャストハウス',
  'なごみ工務店',
  'PGハウス',
  'かえるホーム',
];

/** 空白を全部落とす */
const flatten = (value: string): string => value.replace(/[\s　]+/gu, '');

/** 正規表現に使えるよう escape する */
const escapeRe = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/**
 * 個人情報を伏字にする。
 *
 * ⚠️ 消すもの:
 *   ⚠️ 渡された値（その行の氏名・電話・住所など、または台帳にある氏名）
 *   ⚠️ メールアドレスの形をしたもの
 *   ⚠️ 電話番号らしい数字の並び
 *
 * ⚠️⚠️ **日付は消さないこと。**
 *   ⚠️ `2026-09-14` は区切り込みで10文字あるため、
 *     ⚠️ ⚠️ **単純な「数字が続いたら伏字」では日付が全部消える**
 *       （2026-09-21 に実際に「**** 契約: 契約」になった）。
 *   ⚠️ 商談メモの日付は ⚠️ **いつ商談が動いたかを示す大事な情報**である。
 */
export const maskPii = (text: string, secrets: readonly string[]): string => {
  if (text === '') return '';

  let out = text;

  for (const raw of secrets) {
    const secret = raw.trim();
    // ⚠️ 1〜2文字を消すと日本語の本文が虫食いになる
    if (secret.length < 3) continue;

    out = out.split(secret).join(MASK);

    /**
     * ⚠️⚠️ **文字の間に空白が入っていても消すこと。**
     *   ⚠️ 台帳が「甲斐 彩香」でも、メモには「甲斐彩香」「甲斐　彩香」と
     *     書かれていることがある。
     *   ⚠️ ⚠️ **単純な置換だけでは素通りする**（2026-09-21 に実データで1件漏れた）。
     *
     * ⚠️ ⚠️ **空白を除いて3文字未満のものにはかけない。**
     *   ⚠️ 「吉 田」のような名前で `吉田` を全部伏字にすると、
     *     ⚠️ **本文中の地名・他社名まで虫食いになる。**
     */
    const flat = flatten(secret);
    if (flat.length < 3) continue;

    const pattern = [...flat].map(escapeRe).join('[\\s\\u3000]*');
    out = out.replace(new RegExp(pattern, 'gu'), MASK);
  }

  out = out.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, MASK);

  /**
   * ⚠️⚠️ **区切り文字に `/` を入れないこと。**
   *   ⚠️ 面談シートの記録は ` / ` でつないでいるため、
   *     ⚠️ ⚠️ **「18:00 / 2026-08-25」がひとつながりの数字と見なされて伏字になった**
   *       （2026-09-21 に実データで発生）。
   *   ⚠️ 日本の電話番号はハイフン区切りなので、`/` は要らない。
   */
  out = out.replace(/[0-9０-９][0-9０-９\-－ 　]{5,}[0-9０-９]/gu, (hit) => {
    const digits = hit.replace(/[^0-9０-９]/gu, '');
    /**
     * ⚠️⚠️ **区切りが3つ以上あるものは電話番号ではない。**
     *   ⚠️ `2026-09-14 2026-08-25` のように日付が2つ並ぶと
     *     ⚠️ ⚠️ **数字が16桁つながって見え、本文が丸ごと消える。**
     *   ⚠️ 電話番号の区切りは多くても2つ（090-1234-5678 / 0995-45-8886）。
     */
    const separators = hit.length - digits.length;
    if (separators > 2) return hit;
    return digits.length >= 9 && digits.length <= 11 ? MASK : hit;
  });

  return out;
};

/**
 * 台帳にある氏名を、返す文章から一括で消す。
 *
 * ⚠️⚠️ **maskPii() は「その行自身の」氏名しか消せない。**
 *   ⚠️ 商談メモには ⚠️ **別の顧客の名前**（紹介者・同行者・過去の担当案件）が
 *     書かれていることが実際にある。
 *   ⚠️ ⚠️ **2026-09-21 の実データで1件漏れた。** ⚠️ 行ごとの処理では防げない。
 *
 * ⚠️ 手順（総当たりを避けるため2段階）:
 *   ⚠️ 1. 返す文章を全部つないで、空白を除いた1本の文字列にする
 *   ⚠️ 2. 台帳の氏名をその文字列で探し、⚠️ **実際に出てくるものだけ**を置換する
 *   ⚠️ 台帳は3万件あるが、1 の文字列は数十KBなので探すのは速い。
 *
 * ⚠️ ⚠️ **自社の営業担当の名前も、顧客として登録があれば一緒に消える。**
 *   ⚠️ 競合分析に担当者名は要らないため、消えて困らない。
 */
export const maskKnownNames = async (
  rows: Record<string, string>[],
  textKeys: readonly string[],
  makers: readonly string[] = []
): Promise<Record<string, string>[]> => {
  const blob = rows.map((row) => textKeys.map((key) => row[key] ?? '').join(' ')).join(' ');
  const flatBlob = flatten(blob);
  if (flatBlob === '') return rows;

  // ⚠️ 3事業ぶん見る。⚠️ **注文のメモに建売の顧客名が出ることがある**
  const names = await query<DynamicRow>(
    'SELECT customer_contacts_name AS name FROM master_data' +
      ' UNION SELECT customer_contacts_name FROM master_data_kaeru' +
      ' UNION SELECT customer_contacts_name FROM master_data_resale'
  );

  /**
   * ⚠️⚠️ **他社名の一部になっている氏名は消さないこと。**
   *   ⚠️ 「ヤマダ」という顧客がいるため、⚠️ **`ヤマダホームズ` が `****ホームズ` になった**
   *     （2026-09-21 に実データで6か所）。
   *   ⚠️ ⚠️ **競合分析で他社名が壊れると、分析そのものが成り立たない。**
   *   ⚠️ 他社名の中にしか出てこない語は、人名としては扱わない。
   */
  const flatMakers = makers.map(flatten);

  const hits: string[] = [];
  for (const row of names) {
    const flat = flatten(String(row.name ?? '').trim());
    // ⚠️ 2文字以下は本文の普通の語と当たる。消すと虫食いになる
    if (flat.length < 3) continue;
    if (!flatBlob.includes(flat)) continue;
    if (flatMakers.some((maker) => maker !== flat && maker.includes(flat))) continue;
    hits.push(flat);
  }
  if (hits.length === 0) return rows;

  const unique = [...new Set(hits)];
  return rows.map((row) => {
    const next = { ...row };
    for (const key of textKeys) {
      if (next[key] !== undefined && next[key] !== '') {
        next[key] = maskPii(next[key], unique);
      }
    }
    return next;
  });
};

/** 他社名を拾う */
const findMakers = (text: string, makers: readonly string[]): string[] =>
  text === '' ? [] : makers.filter((maker) => text.includes(maker));

/** 競合欄（カンマ・読点区切り）を配列にする */
const splitCompetitors = (text: string): string[] =>
  text
    .replace(/、/gu, ',')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '' && part !== 'null');

/**
 * 面談シートの interview_log から商談メモを組み立てる。
 *
 * ⚠️⚠️ **interview_log は `[{day, action, note}, ...]` の JSON である。**
 *   ⚠️ note が担当者の書いた文章で、⚠️ **勝ち負けの理由はここにしかない。**
 *
 * ⚠️ ⚠️ **master_data.remarks は使わない。**
 *   ⚠️ 中身の大半が反響フォームの定型文（「反響経路:… 検討時期:…」）で、
 *     ⚠️ **トークンを食うだけで勝敗の理由が1文字も入らなかった。**
 *
 * ⚠️ 入れる順番（無駄を出さないため）:
 *   ⚠️ 1. ⚠️ **他社名が出てくる面談を先に入れる**
 *   ⚠️ 2. 残りを新しい順に入れる
 *   ⚠️ ⚠️ **古い順に入れると、初回面談の世間話で上限を使い切る。**
 */
export const notesFromInterviewLog = (json: string, makers: readonly string[]): string => {
  let log: unknown;
  try {
    log = JSON.parse(json);
  } catch {
    return '';
  }
  if (!Array.isArray(log)) return '';

  const entries: { text: string; day: string; hit: boolean }[] = [];
  for (const item of log) {
    if (item === null || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;

    let note = String(record.note ?? '')
      .replace(/\s+/gu, ' ')
      .trim();
    if (note === '' || note === 'null') continue;
    if (note.length > NOTE_CHARS) note = `${note.slice(0, NOTE_CHARS)}…`;

    // ⚠️ アクション名には物件名が付くことがある。⚠️ **先頭だけ使う**
    const action = String(record.action ?? '').trim().split(',')[0] ?? '';
    const day = String(record.day ?? '').trim();

    entries.push({
      text: `${day} ${action}: ${note}`.trim(),
      day,
      hit: findMakers(note, makers).length > 0,
    });
  }
  if (entries.length === 0) return '';

  entries.sort((a, b) => {
    // ⚠️ 他社名のある面談を先に。同じなら新しい順
    if (a.hit !== b.hit) return a.hit ? -1 : 1;
    return b.day.localeCompare(a.day);
  });

  let out = '';
  for (const entry of entries) {
    const next = out === '' ? entry.text : `${out} / ${entry.text}`;
    if (next.length > MEMO_CHARS) break;
    out = next;
  }

  // ⚠️ 1件目だけで上限を超える場合は、その1件を切って入れる
  return out === '' ? `${entries[0].text.slice(0, MEMO_CHARS)}…` : out;
};

/**
 * 土地の有無。
 * ⚠️ 入力が「有」「無」「1」「0」と揺れているため、文字で判定する。
 */
const hasLandLabel = (value: string): string => {
  const text = value.trim();
  if (text === '' || text === 'null') return '未入力';
  if (text.includes('無') || text === '0') return 'なし';
  return 'あり';
};

/**
 * 予算を帯にまとめる。
 *
 * ⚠️⚠️ **金額そのものは返さない。**
 *   ⚠️ 帯にすれば傾向は読めるうえ、⚠️ **個人の特定に近づかない。**
 * ⚠️ 入力は「4000万」「40,000,000」などと揺れるため、数字だけを取り出して判定する。
 */
const budgetBand = (value: string): string => {
  const digits = value.replace(/[^0-9]/gu, '');
  if (digits === '') return '未入力';

  let amount = Number(digits);
  // ⚠️ 「4000」のような万円単位の入力を円に直す
  if (amount < 100000) amount *= 10000;

  if (amount < 25000000) return '2500万未満';
  if (amount < 30000000) return '2500〜3000万';
  if (amount < 35000000) return '3000〜3500万';
  if (amount < 40000000) return '3500〜4000万';
  if (amount < 45000000) return '4000〜4500万';
  if (amount < 50000000) return '4500〜5000万';
  return '5000万以上';
};

/** 失注日（テキスト）から 'YYYY-MM' を取り出す */
const lostMonth = (value: string): string => {
  const matched = /^([12][0-9]{3}-[0-9]{2})/u.exec(value.replace(/\//gu, '-').trim());
  return matched === null ? '' : matched[1];
};

export interface CompetitorOptions {
  division: CompetitorDivision;
  /** 何ヶ月分さかのぼるか */
  months: number;
}

export interface CompetitorResult {
  division: string;
  months: number;
  counts: Record<string, number | boolean>;
  columns: string[];
  /** ⚠️ タブ区切りの1行 */
  rows: string[];
}

/**
 * 競合の記録がある商談を集めて返す。
 *
 * ⚠️⚠️ **返すのはタブ区切りの表である。オブジェクトの配列ではない。**
 *   ⚠️ 1行18項目あるため、⚠️ **オブジェクトだと項目名だけで全体の7割**になる。
 *     ⚠️ 実測（注文842行）: JSON 440KB のうち ⚠️ **商談メモは28%だけ。**
 *   ⚠️ ⚠️ **情報は1つも減っていない。** 項目名を先頭で1回だけ伝える形である。
 */
export const runCompetitor = async (options: CompetitorOptions): Promise<CompetitorResult> => {
  const { table, label } = DIVISIONS[options.division];
  const extra = EXTRA_COLUMNS[options.division];
  const statuses = STATUSES[options.division];

  const makerRows = await query<DynamicRow>('SELECT label FROM house_maker');
  const makers = [
    ...new Set(
      makerRows
        .map((row) => String(row.label ?? '').trim())
        // ⚠️ 2文字以下の社名は本文の別の語に当たるため使わない
        .filter((name) => name.length >= 3)
    ),
  ];

  const contractDate = asDate(`m.${PHASES.contract.column}`);
  const reactionDate = asDate(`m.${PHASES.reaction.column}`);
  const rankColumn = 'm.customized_input_01J82Z5F366ZQ897PXWF6H5ZAM';

  const select = [
    'm.status',
    'm.in_charge_store',
    'm.brand',
    'm.sales_promotion_name',
    'm.has_owned_land',
    'm.budget',
    `${rankColumn} AS rank_value`,
    'm.competitors_text',
    'm.competitor_name',
    'm.competitor',
    'm.competitor_lost_contract_reason',
    'm.competitor_lost_contract_date',
    /**
     * ⚠️⚠️ **商談メモは面談シートから取る。**
     *   ⚠️ ⚠️ **LEFT JOIN にすること。** 面談シートが無い顧客でも、
     *     競合欄と失注理由は手がかりになるので落とさない。
     */
    'i.interview_log',
    `DATE_FORMAT(${contractDate}, '%Y-%m') AS contract_month`,
    `DATE_FORMAT(${reactionDate}, '%Y-%m') AS registered_month`,
    ...Object.keys(extra).map((column) => `m.${column}`),
    ...PII_COLUMNS.map((column) => `m.${column}`),
  ];

  const since = new Date();
  since.setMonth(since.getMonth() - options.months);
  const from = since.toISOString().slice(0, 10);

  /**
   * ⚠️⚠️ **勝ちと負けを別々に取る。**
   *   ⚠️ 1本のクエリを日付順に切ると、⚠️ **件数の多い負けばかりが残る。**
   *     ⚠️ 実測では 勝ち112 / 負け888 になり、勝敗表として成立しなかった。
   *   ⚠️ ⚠️ **半分ずつの枠を与えること。**
   */
  const quota = Math.floor(MAX_ROWS / 2);

  const fetchByStatus = async (wanted: string[]): Promise<DynamicRow[]> => {
    const sql =
      `SELECT ${select.join(', ')} FROM ${table} m` +
      // ⚠️ 面談シートは1顧客1行（実測 18,161行 / 18,160人）
      ' LEFT JOIN interview_sheet i ON i.id = m.id' +
      ' WHERE m.show_dashboard = 1' +
      ` AND m.status IN (${wanted.map(() => '?').join(',')})` +
      ` AND (${contractDate} >= ? OR ${reactionDate} >= ?` +
      " OR REPLACE(COALESCE(m.competitor_lost_contract_date, ''), '/', '-') >= ?)" +
      // ⚠️ 競合の手がかりがまったく無い行は最初から取らない
      ' AND (' +
      " COALESCE(m.competitors_text, '') NOT IN ('', 'null')" +
      " OR COALESCE(m.competitor_name, '') NOT IN ('', 'null')" +
      " OR COALESCE(m.competitor, '') NOT IN ('', 'null')" +
      " OR COALESCE(m.competitor_lost_contract_reason, '') NOT IN ('', 'null')" +
      " OR COALESCE(i.interview_log, '') NOT IN ('', 'null', '[]')" +
      ')' +
      ` ORDER BY COALESCE(${contractDate}, ${reactionDate}) DESC` +
      // ⚠️ 自社名しか出てこない行が落ちるため、多めに取ってから絞る
      ` LIMIT ${quota * 4}`;

    const params: SqlParam[] = [...wanted, from, from, from];
    return query<DynamicRow>(sql, params);
  };

  const [wonRaw, lostRaw] = await Promise.all([
    fetchByStatus(statuses.win),
    fetchByStatus(statuses.lost),
  ]);

  const kept = { win: 0, lost: 0 };
  let foundFromMemo = 0;
  let rows: Record<string, string>[] = [];

  for (const r of [...wonRaw, ...lostRaw]) {
    const secrets = PII_COLUMNS.map((column) => String(r[column] ?? ''));

    // ⚠️ 面談シートの note だけを使う。⚠️ **反響フォームの定型文は入らない**
    const memo = maskPii(notesFromInterviewLog(String(r.interview_log ?? ''), makers), secrets);

    const named = [
      ...splitCompetitors(String(r.competitors_text ?? '')),
      ...splitCompetitors(String(r.competitor_name ?? '')),
      ...splitCompetitors(String(r.competitor ?? '')),
    ];
    // ⚠️ メモからの社名。⚠️ **競合欄が空の行を救うのはここだけ**
    const inMemo = findMakers(memo, makers);
    if (named.length === 0 && inMemo.length > 0) foundFromMemo += 1;

    const all = [...new Set([...named, ...inMemo])];
    /**
     * ⚠️⚠️ **自社グループの社名を競合から外す。**
     *   ⚠️ 外さないと「国分ハウジング」が最大の競合として並ぶ。
     *   ⚠️ **捨てずに own_group として別に持つ**（社内での取り合いも見たいため）。
     */
    const ownGroup = all.filter((name) => OWN_GROUP_NAMES.includes(name));
    const competitors = all.filter((name) => !OWN_GROUP_NAMES.includes(name));

    let lostReason = String(r.competitor_lost_contract_reason ?? '').trim();
    if (lostReason === 'null') lostReason = '';

    // ⚠️ 他社名も失注理由も無い行は競合戦の証拠が無い。返さない
    //   ⚠️ **自社名しか出てこない行もここで落ちる**
    if (competitors.length === 0 && lostReason === '') continue;

    const won = statuses.win.includes(String(r.status ?? ''));
    const bucket = won ? 'win' : 'lost';
    // ⚠️ 片方だけで枠を使い切らないようにする
    if (kept[bucket] >= quota) continue;
    kept[bucket] += 1;

    const row: Record<string, string> = {
      outcome: won ? 'win' : 'lost',
      status: String(r.status ?? ''),
      month: won
        ? String(r.contract_month ?? r.registered_month ?? '')
        : lostMonth(String(r.competitor_lost_contract_date ?? '')) ||
          String(r.registered_month ?? ''),
      shop: String(r.in_charge_store ?? ''),
      brand: String(r.brand ?? ''),
      medium: String(r.sales_promotion_name ?? ''),
      has_land: hasLandLabel(String(r.has_owned_land ?? '')),
      budget: budgetBand(String(r.budget ?? '')),
      rank: String(r.rank_value ?? '').trim(),
      competitors: competitors.join('|'),
      own_group: ownGroup.join('|'),
      lost_reason: lostReason,
      // ⚠️ 面談シートで既に長さを整えてある。⚠️ **ここで切り直さないこと**
      memo,
    };

    for (const [column, key] of Object.entries(extra)) {
      const value = String(r[column] ?? '').trim();
      row[key] = value === '' || value === 'null' ? '' : maskPii(value, secrets);
    }

    rows.push(row);
    if (rows.length >= MAX_ROWS) break;
  }

  /**
   * ⚠️⚠️ **最後にもう一度、台帳の氏名を消す。**
   *   ⚠️ 上の maskPii() は行ごとの氏名しか見ていない。
   *   ⚠️ ⚠️ **ここを外すと、他の顧客の氏名がメモに残ったまま返る。**
   */
  rows = await maskKnownNames(rows, ['memo', 'lost_reason', ...Object.values(extra)], makers);

  const columns = rows.length === 0 ? [] : Object.keys(rows[0]);
  const tsv = rows.map((row) =>
    columns
      .map((column) => String(row[column] ?? '').replace(/[\t\r\n]+/gu, ' '))
      .join('\t')
  );

  return {
    division: label,
    months: options.months,
    counts: {
      rows: rows.length,
      wins: kept.win,
      losses: rows.length - kept.win,
      quotaPerSide: quota,
      candidates: wonRaw.length + lostRaw.length,
      foundFromMemo,
      // ⚠️ どちらかが枠いっぱいなら「全件ではない」。勝率の計算に使わせない
      truncated: kept.win >= quota || rows.length - kept.win >= quota,
    },
    columns,
    rows: tsv,
  };
};
