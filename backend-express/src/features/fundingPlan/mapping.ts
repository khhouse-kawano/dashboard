/**
 * master_data ⇄ funding_plan の項目対応と単位換算。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ ここが本機能でいちばん壊れやすい。
 *
 *   master_data の金額カラムは**単位も形式も揃っていない**。
 *   本番データを数えた結果（2026-09-08、約19,000件）:
 *
 *     current_rent                    "6.0万円" "6万円" "6" "万円"
 *     budget                          "3,000万円" "4000万円" "0万円"
 *     customer_contacts_annual_income "500万円" "500" "万円"
 *     self_budget                     "5000000" "00000" "0000" "200000"
 *     current_utility_costs           "2.0万円" "1.5" "15"
 *     monthly_repayment_amount        "80000" "10" "8" "0000"
 *
 *   なぜこうなったか（InformationEdit.tsx / TableInput.tsx を読んで判明）
 *
 *     TableInput は **表示時にだけ**変換をかけ、保存時は入力欄の生の値を
 *     そのまま保存していた。たとえば monthly_repayment_amount は
 *
 *       表示: stored.replace('0000','')  →  "80000" は "8" と表示される
 *       保存: 入力欄の値をそのまま       →  "8" が保存される
 *
 *     つまり顧客を開いて保存し直すたび、円で入っていた値が万円に変わる。
 *     さらに `.replace('0000','')` は末尾が 0000 でない値に効かないため
 *     "85000" が 85000万円 と表示される誤りもあった。
 *
 *   2026-09-08 に Dashboard 側を直した（frontend/src/utils/moneyUtils.ts）。
 *
 *     ・読み: しきい値で円／万円を判定して**万円**に揃える
 *     ・書き: **万円のプレーンな数値**で保存する（単位も付けない）
 *
 *   本モジュールはその**同じ規則**を実装している。
 *
 * ⚠️⚠️ **frontend/src/utils/moneyUtils.ts と対になっている。**
 *   しきい値・0 の扱い・保存形式のどれかを片方だけ変えると、
 *   顧客詳細と資金計画書で違う金額が表示される。必ず両方直すこと。
 *
 * ⚠️ 既存データは編集されるたびに万円のプレーン形式へ収束する。
 *   一括の移行SQLは当てていない（backend/scripts/sql/ に置いていない）。
 * ─────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// 単位の取り出し
// ---------------------------------------------------------------------------

/**
 * 単位の判定に使うしきい値（保存されている数値がこれ以上なら「円」とみなす）。
 *
 * ⚠️⚠️ **frontend/src/utils/moneyUtils.ts と同じ値にすること。**
 *   片方だけ変えると、顧客詳細と資金計画書で違う金額が出る。
 *
 *   月額系（家賃・光熱費・月々支払）
 *     円で 30,000〜150,000 くらい。万円なら 1〜20 くらい。
 *     月に 1,000万円 払う人はいないので 1,000 で切れる。
 *
 *   総額系（年収・自己資金・負債・予算・土地予算）
 *     円で 1,000,000〜50,000,000 くらい。万円なら 100〜10,000 くらい。
 *     10万円未満の「総額」はありえないので 100,000 で切れる。
 *
 *   ⚠️ 逆にすると壊れる。総額系のしきい値 100,000 を月額に使うと
 *     "80000"（8万円）が 80,000万円 と読まれる。
 */
type MoneyScale = 'monthly' | 'total';

const YEN_THRESHOLD: Record<MoneyScale, number> = {
  monthly: 1000,
  total: 100000,
};

/**
 * master_data の金額欄から万円の数値を取り出す。
 *
 * ⚠️⚠️ **frontend/src/utils/moneyUtils.ts の storedToManYen と同じ規則。**
 *   顧客詳細の画面に出ている数字と、資金計画書に取り込まれる数字を
 *   一致させるために存在する。片方を直したらもう片方も直すこと。
 *
 * ⚠️ 0 は null（未入力）として返す。本番データは 0 相当の初期値で
 *   埋まっており（self_budget は 18,608件）、0 を返すと資金計画書に
 *   「自己資金 0円」と**印刷されてしまう**。
 */
export const manYenFrom = (raw: unknown, scale: MoneyScale): number | null => {
  const s = String(raw ?? '');
  // ⚠️ [0-9] ではなく [1-9]。0 だけの値を未入力として弾くため
  if (!/[1-9]/.test(s)) return null;

  const cleaned = s.replace(/,/g, '').replace(/万円/g, '').replace(/円/g, '');
  const n = Number.parseFloat(cleaned.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return null;

  // 元の文字列に「万円」があれば単位は確定している
  if (s.includes('万円')) return n;

  return n >= YEN_THRESHOLD[scale] ? n / 10000 : n;
};

/** 単位の付かない数値（坪・年など）。0 も有効な値として扱わず未入力にする */
export const plainNumber = (raw: unknown): number | null => {
  const s = String(raw ?? '');
  if (!/[1-9]/.test(s)) return null;
  const n = Number.parseFloat(s.replace(/,/g, '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** 万円 → 円。資金計画書は家賃・光熱費・月々支払を**円**で持つ */
const toYen = (manYen: number | null): number | null =>
  manYen === null ? null : Math.round(manYen * 10000);

// ---------------------------------------------------------------------------
// 店舗名
// ---------------------------------------------------------------------------

/**
 * ブランド略称 → お客様に見せる名前。
 *
 * ⚠️ KH（国分ハウジング）だけは**店名のみ**にする。会社名はロゴに入っており、
 *   「国分ハウジング 鹿児島店」だと重複するため。元HTMLの選択肢と同じ規則。
 *
 * ⚠️⚠️ KH 以外は**店名が消える**（DJH宮崎店 も DJH都城店 も
 *   「DAY JUST HOUSE」になる）。これは元HTMLの選択肢がそうだったためで、
 *   意図した挙動である。DB には in_charge_store をそのまま保存しているので
 *   情報は失われない。表示だけの変換。
 *
 * ⚠️ ここに無いブランド（KH / KHG / KHF / KHR）は接頭辞を落として店名だけにする。
 *   新しいブランドが増えたら BRAND_LABEL と BRAND_PREFIXES の両方に足すこと。
 */
const BRAND_LABEL: Record<string, string> = {
  DJH: 'DAY JUST HOUSE',
  JH: 'JUSFY HOME',
  FH: 'フルコミホーム',
  PGH: 'PGハウス',
  '2L': '2Lhome',
  なごみ: 'なごみ工務店',
};

/** ⚠️ 長い順に見ること。'JH' を先に試すと 'DJH宮崎店' が 'D' + 'JH' で誤判定する */
const BRAND_PREFIXES = ['なごみ', 'DJH', 'PGH', 'KHG', 'KHF', 'KHR', 'JH', 'KH', 'FH', '2L'];

/**
 * master_data.in_charge_store（KH鹿児島店）を、お客様に見せる表記へ変換する。
 *
 * ⚠️ この関数は**表示のためだけ**。保存する値は変換しない。
 */
export const shopLabel = (inChargeStore: unknown): string => {
  const s = String(inChargeStore ?? '').trim();
  if (s === '') return '';

  for (const prefix of BRAND_PREFIXES) {
    if (!s.startsWith(prefix)) continue;

    const brandName = BRAND_LABEL[prefix];
    if (brandName !== undefined) return brandName;

    // KH と、正式名が未登録のブランド（PGH 等）は接頭辞を落として店名だけにする
    const rest = s.slice(prefix.length);
    return rest === '' ? s : rest;
  }

  // 知らない表記はそのまま出す。⚠️ 空にすると印刷物から店舗名が消える
  return s;
};

/**
 * プルダウンに出すラベル。
 *
 * ⚠️⚠️ **印刷用の shopLabel() とは別物。** 印刷用は「DAY JUST HOUSE」だが、
 *   それを選択肢に使うと DJH の8店舗すべてが同じ文字列になり、
 *   **どれを選んでいるのか分からなくなる**（実際に32件中8件が重複した）。
 *   選択肢だけ店名を括弧で添える。
 *
 * ⚠️ 保存する値（value）は in_charge_store のまま。ラベルは表示専用。
 */
export const shopPickerLabel = (inChargeStore: unknown): string => {
  const s = String(inChargeStore ?? '').trim();
  const label = shopLabel(s);

  for (const prefix of BRAND_PREFIXES) {
    if (!s.startsWith(prefix)) continue;
    const rest = s.slice(prefix.length);
    // KH のように「接頭辞を落としただけ」なら括弧は不要
    return rest === '' || rest === label ? label : `${label}（${rest}）`;
  }
  return label;
};

// ---------------------------------------------------------------------------
// master_data → funding_plan（初回の取り込み）
// ---------------------------------------------------------------------------

/** master_data の customized_input（新築計画）→ 資金計画書の「建て方」 */
const STYLE_MAP: Record<string, string> = {
  新築平屋: '平屋建て',
  建て替え平屋: '平屋建て',
  新築2階建て: '2階建て',
  建て替え2階建て: '2階建て',
};

/** master_data の current_contract_type → 資金計画書の「現在のお住まい」 */
const NOW_MAP: Record<string, string> = {
  '賃貸(アパート)': '賃貸アパート・マンション',
  '賃貸(マンション)': '賃貸アパート・マンション',
  '賃貸(戸建)': '賃貸戸建',
  '持家(マンション)': '持ち家',
  '持家(戸建)': '持ち家',
};

/** master_data の has_owned_land → 資金計画書の「土地の有無」 */
const LAND_MAP: Record<string, string> = {
  有: 'お持ちの土地に建てる',
  無: '土地から探す',
};

/**
 * master_data の customer_desired_estate（土地の状況）→ 資金計画書の「土地の有無」。
 * ⚠️ has_owned_land が未入力のときの補助。選択肢の文言は
 *   InformationEdit.tsx の TableSelect の list と一致させること。
 */
const ESTATE_MAP: Record<string, string> = {
  '自分で持っている（購入予定の土地がある）': 'お持ちの土地に建てる',
  '親・親族等の土地で建築予定': 'ご実家の敷地',
  土地を探している: '土地から探す',
};

/** master_data の入居時期 → 資金計画書の「計画時期（◯年後）」 */
const TIMING_MAP: Record<string, number> = {
  すぐにでも: 0,
  '半年～1年以内': 1,
  '1年～2年以内': 2,
  '2年以上後': 3,
};

/** 'YYYY/MM/DD' も 'YYYY-MM-DD' も受ける。それ以外は null */
const toIsoDate = (raw: unknown): string | null => {
  const s = String(raw ?? '').trim().replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** 生年月日から満年齢。⚠️ 誕生日前なら1つ引く */
const ageFrom = (birth: string | null): number | null => {
  if (birth === null) return null;
  const b = new Date(`${birth}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;

  return age >= 0 && age < 130 ? age : null;
};

const str = (raw: unknown): string | null => {
  const s = String(raw ?? '').trim();
  return s === '' || s === 'null' ? null : s;
};

export interface FamilyMember {
  relation?: string;
  name?: string;
  kana?: string;
  birth?: string;
  employer?: string;
}

/**
 * master_data（＋family_info）から資金計画書の初期値を組み立てる。
 *
 * ⚠️ 返すのは**値が取れた項目だけ**。取れなかった項目はキー自体を含めない。
 *   呼び出し側が HTML の DEF()（既定値）とマージするため、
 *   ここで null を返すと既定値を上書きして消してしまう。
 */
export const buildInitialPlan = (
  customer: Record<string, unknown>,
  family: FamilyMember[]
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  const put = (key: string, value: unknown): void => {
    if (value !== null && value !== undefined && value !== '') out[key] = value;
  };

  // --- 顧客情報（単位換算なし） ---
  put('k_name', str(customer.customer_contacts_name));
  put('k_kana', str(customer.customer_contacts_name_kana));
  // ⚠️ in_charge_store をそのまま入れる。表示のときだけ shopLabel() を通す
  put('k_shop', str(customer.in_charge_store));
  put('k_staff', str(customer.in_charge_user));
  put('k_addr', str(customer.full_address));
  put('k_tel', str(customer.customer_contacts_mobile_phone_number));
  put('k_mail', str(customer.customer_contacts_email));
  put('k_now', NOW_MAP[String(customer.current_contract_type ?? '')]);

  // --- ご主人様（＝master_data の顧客本人として扱う） ---
  put('k_h_name', str(customer.customer_contacts_name));
  const husbandBirth = toIsoDate(customer.customer_contacts_birth_date);
  put('k_h_birth', husbandBirth);
  put('k_h_age', ageFrom(husbandBirth));
  put('k_h_work', str(customer.customer_contacts_employer_name));

  // --- 奥様・お子様（family_info から） ---
  const spouse = family.find((f) => f.relation === '配偶者');
  if (spouse) {
    put('k_w_name', str(spouse.name));
    const wifeBirth = toIsoDate(spouse.birth);
    put('k_w_birth', wifeBirth);
    put('k_w_age', ageFrom(wifeBirth));
    put('k_w_work', str(spouse.employer));
  }

  // ⚠️ 孫は含めない。⑧FPの教育費計算は「これから進学する子」を前提にしている
  const children = family.filter((f) => f.relation === '息子' || f.relation === '娘');
  if (children.length > 0) {
    out.kids = children.map((c) => ({
      name: String(c.name ?? ''),
      age: ageFrom(toIsoDate(c.birth)) ?? 0,
      // ⚠️ 進学プランは master_data に無い。HTML の既定値（1）を入れる
      plan: 1,
    }));
  }

  // --- 金額（⚠️ ここから単位換算あり） ---
  // 年収・自己資金・土地予算は資金計画書も**万円**なのでそのまま
  put('k_inc1', manYenFrom(customer.customer_contacts_annual_income, 'total'));
  put('k_jiko', manYenFrom(customer.self_budget, 'total'));
  put('d_tochi', manYenFrom(customer.land_budget, 'total'));

  // ⚠️ 家賃・光熱費・月々支払は資金計画書が**円**。×10000 が必要
  put('k_rent', toYen(manYenFrom(customer.current_rent, 'monthly')));
  // ⚠️ master_data の光熱費は電気＋ガスの合算。分けられないので電気代に入れる。
  //   ガス代（k_gas）は既定値のまま残す（0 で上書きすると比較が狂う）
  put('k_elec', toYen(manYenFrom(customer.current_utility_costs, 'monthly')));
  put('k_hope', toYen(manYenFrom(customer.monthly_repayment_amount, 'monthly')));

  // --- ヒアリング内容 ---
  put('k_area', str(customer.planned_construction_site));
  // ⚠️ 「新築計画」の列名は customer_desired_floor。
  //   customized_input_* ではない（databaseList.ts で確認）。
  put('k_style', STYLE_MAP[String(customer.customer_desired_floor ?? '')]);
  // ⚠️ has_owned_land（有/無）を優先し、無ければ「土地の状況」から補う
  put(
    'k_landhave',
    LAND_MAP[String(customer.has_owned_land ?? '')] ??
      ESTATE_MAP[String(customer.customer_desired_estate ?? '')]
  );
  put('k_tsubo', plainNumber(customer.desired_land_area));
  put('k_makers', str(customer.competitors_text));
  // ⚠️ 面談前アンケート＝「心配なこと」、面談後アンケート＝「商談メモ」に対応させる
  put('k_worry', str(customer.customized_input_01J95TC6KEES87F0YXH29AJP7K));
  put('k_memo', str(customer.remarks));

  // ⚠️ 「入居時期」の列名は customer_desired_period。
  //   0（すぐにでも）も有効な値なので put() ではなく直接入れる
  //   （put は 0 を落とさないが、値の意味が「未入力」ではないことを明示する）。
  const timing = TIMING_MAP[String(customer.customer_desired_period ?? '')];
  if (timing !== undefined) out.k_timing = timing;

  put('d_years', plainNumber(String(customer.repayment_years ?? '').replace(/[年/]/g, '')));

  return out;
};

// ---------------------------------------------------------------------------
// funding_plan → master_data（保存時の書き戻し）
// ---------------------------------------------------------------------------

/**
 * 書き戻す形式は **「万円のプレーンな数値」** に統一する。
 *
 * ⚠️⚠️ 以前は円で保存する列（self_budget など）に合わせて
 *   `万円 → 丸め → ×10000` としていた。Dashboard の表示が
 *   `.replace('0000','')` という文字列置換で、末尾が 0000 でないと
 *   正しく表示できなかったためである。
 *   その副作用で **9.5万円 が 10万円 に丸められていた。**
 *
 *   2026-09-08 に Dashboard 側（frontend/src/utils/moneyUtils.ts）で
 *   読み書きを対称にしたので、丸めは不要になった。
 *   単位も付けない。付けると「万円」付きと無しの混在に戻る。
 *
 * ⚠️ frontend の manYenToStored と同じ形にすること。
 */

/** 小数の末尾の 0 を落とす。6.500 → 6.5 */
const asManYenText = (manYen: number): string => String(Number.parseFloat(manYen.toFixed(3)));

export interface MasterDataWriteBack {
  column: string;
  value: string;
}

/**
 * 資金計画書の「お客様カルテ」で編集された項目 → master_data の列。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **ここに入れるのは1対1で戻せる項目だけ。**
 *   変換が多対一の項目（現在のお住まい・建て方・土地の有無）は
 *   入れてはいけない。理由は下記。
 *
 *     k_now      賃貸(アパート) と 賃貸(マンション) が
 *                どちらも「賃貸アパート・マンション」になる。
 *                戻すとマンションがアパートに化ける。
 *     k_style    新築平屋 と 建て替え平屋 がどちらも「平屋建て」。
 *                建て替えの区別が消える。
 *     k_landhave has_owned_land と customer_desired_estate の
 *                2列に対応しており、どちらへ戻すか決められない。
 *
 * ⚠️⚠️ **入居時期（k_timing）も入れない。** 2026-09-09 に実データで確認した
 *   3つの理由（どれか1つでも該当すれば入れられない）:
 *     ・画面は「◯年後」の数値（step 0.5）。0.5年後・1.5年後に対応する
 *       選択肢が master_data に無い
 *     ・master_data に「その他」が79件あり、計画書側に存在しない。戻すと消える
 *     ・HTML の既定値が 1 なので、未入力の顧客を保存しただけで
 *       「半年～1年以内」が入ってしまう
 *
 * ⚠️ 担当店舗（k_shop）・担当営業（k_staff）も入れない。
 *   戻すと担当が変わり、反響同期や集計の担当まで変わる。
 * ─────────────────────────────────────────────
 */
const TEXT_WRITE_BACK: { key: string; column: string }[] = [
  // --- A群（1対1で安全） ---
  { key: 'k_h_birth', column: 'customer_contacts_birth_date' },
  { key: 'k_h_work', column: 'customer_contacts_employer_name' },
  { key: 'k_area', column: 'planned_construction_site' },
  { key: 'k_makers', column: 'competitors_text' },
  // ⚠️ 面談前アンケート＝「心配なこと」。列名は buildInitialPlan と対にすること
  { key: 'k_worry', column: 'customized_input_01J95TC6KEES87F0YXH29AJP7K' },
  { key: 'k_memo', column: 'remarks' },

  // --- C群（顧客の基本情報。2026-09-09 に対象へ追加） ---
  // ⚠️ 以前は「顧客台帳が正」として除外していた。計画書側の誤字が
  //   そのまま台帳に入るため、触った項目だけに限定している（下記 touched）。
  { key: 'k_name', column: 'customer_contacts_name' },
  { key: 'k_kana', column: 'customer_contacts_name_kana' },
  // ⚠️ full_address のみ。extra_address_info（建物名）は計画書に無いので触らない
  { key: 'k_addr', column: 'full_address' },
  { key: 'k_tel', column: 'customer_contacts_mobile_phone_number' },
  { key: 'k_mail', column: 'customer_contacts_email' },
];

/**
 * 返済年数の書式。
 *
 * ⚠️ 実データ（2026-09-09、約24,000件）では
 *     "年"    14,961件 ← ⚠️ 単位だけで数値が無い壊れた値
 *     "0年"    1,976件
 *     "40年"     668件 / "35年" 252件 / "50年" 183件
 *     "40"       103件 / "50"    75件
 *   有効な値は「N年」が優勢。書き戻しはこの形式に揃える。
 *   ⚠️ 単位を付けないと "35" と "35年" の混在が増える。
 */
const asYearsText = (years: number): string => `${Math.round(years)}年`;

/**
 * 資金計画書の値から master_data へ書き戻す項目を作る。
 *
 * ⚠️⚠️ **空の項目は返さない。** 資金計画書で未入力のまま保存されたときに
 *   顧客台帳の既存の値を空で上書きしてしまうため。
 *   「消す」操作は Dashboard 側で行ってもらう。
 *   ⚠️ touched に入っていても空なら戻さない。計画書で消したつもりでも
 *     台帳から消えないが、誤って全消しするより安全側に倒している。
 *
 * @param touched 画面で**人が編集した**キー。数値7項目以外はこれに
 *   入っているものだけ書き戻す。
 *
 *   ⚠️⚠️ **touched が要る理由。** HTML は保存時に43項目すべてを送る。
 *     未入力でも DEF()（既定値）が入っているため、touched で絞らないと
 *     「顧客を開いて保存しただけ」で d_years=35 のような既定値が
 *     顧客台帳に書き込まれる。
 *
 *   ⚠️ 数値7項目（年収・自己資金など）は touched を見ない。
 *     2026-09-08 から動いている既存の挙動であり、0 を書き戻さない作りで
 *     実運用できているため変えない。
 */
export const buildMasterDataWriteBack = (
  plan: Record<string, unknown>,
  touched: ReadonlySet<string> = new Set()
): MasterDataWriteBack[] => {
  const out: MasterDataWriteBack[] = [];

  const num = (key: string): number | null => {
    const v = plan[key];
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    // ⚠️ 0 は書き戻さない。「0万円」で顧客台帳を埋めない
    return Number.isFinite(n) && n !== 0 ? n : null;
  };

  const inc1 = num('k_inc1');
  const inc2 = num('k_inc2');
  // ⚠️ 顧客台帳の年収欄は1つしかない。世帯合計を入れる
  if (inc1 !== null || inc2 !== null) {
    out.push({
      column: 'customer_contacts_annual_income',
      value: asManYenText((inc1 ?? 0) + (inc2 ?? 0)),
    });
  }

  const jiko = num('k_jiko');
  if (jiko !== null) out.push({ column: 'self_budget', value: asManYenText(jiko) });

  // ⚠️ 資金計画書は円、顧客台帳は万円表記。÷10000 して戻す
  const rent = num('k_rent');
  if (rent !== null) out.push({ column: 'current_rent', value: asManYenText(rent / 10000) });

  // ⚠️ 顧客台帳の光熱費は電気＋ガスの合算欄。足して戻す
  const elec = num('k_elec');
  const gas = num('k_gas');
  if (elec !== null || gas !== null) {
    out.push({
      column: 'current_utility_costs',
      value: asManYenText(((elec ?? 0) + (gas ?? 0)) / 10000),
    });
  }

  const hope = num('k_hope');
  if (hope !== null) {
    // ⚠️ 資金計画書は円、顧客台帳は万円。÷10000 して戻す
    out.push({ column: 'monthly_repayment_amount', value: asManYenText(hope / 10000) });
  }

  const tochi = num('d_tochi');
  if (tochi !== null) out.push({ column: 'land_budget', value: asManYenText(tochi) });

  const tsubo = num('k_tsubo');
  if (tsubo !== null) out.push({ column: 'desired_land_area', value: String(tsubo) });

  // -------------------------------------------------------------------------
  // ここから下は **touched（人が編集した項目）だけ** を書き戻す
  // -------------------------------------------------------------------------

  for (const { key, column } of TEXT_WRITE_BACK) {
    if (!touched.has(key)) continue;
    const value = String(plan[key] ?? '').trim();
    // ⚠️ 空は戻さない（関数コメント参照）
    if (value === '') continue;
    out.push({ column, value });
  }

  // ⚠️ 返済年数だけ書式変換が要るので個別に扱う
  if (touched.has('d_years')) {
    const years = num('d_years');
    if (years !== null) out.push({ column: 'repayment_years', value: asYearsText(years) });
  }

  return out;
};
