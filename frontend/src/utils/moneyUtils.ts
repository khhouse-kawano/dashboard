/**
 * 顧客台帳（master_data）の金額欄の読み書き。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ なぜこのファイルが必要なのか
 *
 *   master_data の金額カラムは**単位も形式も揃っていない**。
 *   本番データ（2026-09-08、約19,000件）を数えた結果:
 *
 *     current_rent                    "6.0万円" "6万円" "6" "万円"
 *     budget                          "3,000万円" "4000万円" "0万円"
 *     customer_contacts_annual_income "500万円" "500" "万円"
 *     self_budget                     "5000000" "00000" "0000" "200000"
 *     current_utility_costs           "2.0万円" "1.5" "15"
 *     monthly_repayment_amount        "80000" "10" "8" "0000"
 *
 *   原因は TableInput の作りにある。以前は
 *
 *     表示: stored.replace('0000','')  → "80000" が "8" と表示される
 *     保存: 入力欄の値をそのまま       → "8" が保存される
 *
 *   という**非対称**な作りだった。開いて保存するだけで円が万円に変わり、
 *   さらに `.replace('0000','')` は末尾が 0000 でない値には効かないため
 *
 *     "85000" → "85000" と表示 → 8.5万円のつもりが 85000万円 に見える
 *
 *   という誤表示が起きていた。
 *
 *   ⚠️ このファイルは「読みで単位を推定し、書きで1つの形式に統一する」ことで
 *     表示と保存を対称にする。編集された行は順次きれいな形へ収束する。
 * ─────────────────────────────────────────────
 *
 * ⚠️ backend-express/src/features/fundingPlan/mapping.ts に**同じ規則**の
 *   実装がある。資金計画書との連携で数字が食い違わないよう、
 *   片方を直したらもう片方も直すこと。
 */

/**
 * 単位の判定に使うしきい値（保存されている数値がこれ以上なら「円」とみなす）。
 *
 * ⚠️⚠️ **項目ごとに違う。** 1つのしきい値では成立しない。
 *
 *   月額系（家賃・光熱費・月々支払）
 *     円で 30,000〜150,000 くらい。万円なら 1〜20 くらい。
 *     月に 1,000万円 払う人はいないので **1,000** で切れる。
 *
 *   総額系（年収・自己資金・負債・予算・土地予算）
 *     円で 1,000,000〜50,000,000 くらい。万円なら 100〜10,000 くらい。
 *     10万円未満の「総額」はありえないので **100,000** で切れる。
 *
 *   ⚠️ 逆にすると壊れる。総額系のしきい値 100,000 を月額に使うと
 *     "80000"（8万円）が 80,000万円 と読まれる。
 */
export type MoneyScale = 'monthly' | 'total';

const YEN_THRESHOLD: Record<MoneyScale, number> = {
  monthly: 1000,
  total: 100000,
};

/** 項目ID → 月額系か総額系か。⚠️ ここに無い項目は変換しない */
export const MONEY_SCALE: Record<string, MoneyScale> = {
  // 月額系
  current_rent: 'monthly',
  current_utility_costs: 'monthly',
  monthly_repayment_amount: 'monthly',
  // 総額系
  customer_contacts_annual_income: 'total',
  self_budget: 'total',
  current_loan_balance: 'total',
  budget: 'total',
  land_budget: 'total',
};

/** 小数の末尾の 0 を落とす。"6.000" → "6"、"1.50" → "1.5" */
const trimZero = (n: number): string => {
  if (!Number.isFinite(n)) return '';
  // ⚠️ toFixed(3) で丸めてから落とす。0.1+0.2 のような誤差を持ち込まない
  return String(Number.parseFloat(n.toFixed(3)));
};

/**
 * 保存されている値を「万円の数値」の文字列にする（表示用）。
 *
 * ⚠️⚠️ **0 は未入力（空文字）として扱う。**
 *
 *   本番データは 0 相当の値で埋まっている。
 *     self_budget              "0" "0000" "00000" … 18,608件
 *     current_rent             "0.0万円"            … 17,638件
 *     monthly_repayment_amount "0" "0000"           … 17,588件
 *     budget                   "0万円"              … 16,583件
 *
 *   いずれも聞き取った結果の 0 ではなく**初期値**である。
 *   0 と表示すると「自己資金 0万円」と聞き取り済みに見え、
 *   さらに印刷物にもそう出てしまう。
 *
 *   ⚠️ 旧実装も `"0000".replace('0000','')` の結果として偶然
 *     空欄になっていた。ここで 0 を表示するようにすると、
 *     18,608件の欄が突然「0」で埋まって見える（実質的な退行）。
 *
 *   ⚠️ 代償として「自己資金は 0 円だと聞き取った」を記録できない。
 *     0 は既定の想定なので実害は無いと判断している。
 */
export const storedToManYen = (raw: unknown, scale: MoneyScale): string => {
  const s = String(raw ?? '');
  // ⚠️ [0-9] ではなく [1-9]。0 だけの値を未入力として弾くため
  if (!/[1-9]/.test(s)) return '';

  // カンマと単位を落とす。⚠️ 「万円」を先に消さないと「万」が残る
  const cleaned = s.replace(/,/g, '').replace(/万円/g, '').replace(/円/g, '');
  const num = Number.parseFloat(cleaned.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(num)) return '';

  // 元の文字列に「万円」があれば、単位は確定している
  if (s.includes('万円')) return trimZero(num);

  // 単位表記が無い。しきい値で円か万円かを決める
  return trimZero(num >= YEN_THRESHOLD[scale] ? num / 10000 : num);
};

/**
 * 入力された「万円の数値」を保存する形にする。
 *
 * ⚠️⚠️ **保存形式は「万円のプレーンな数値」に統一する。**
 *   "500万円" のように単位を付けない。付けると
 *     ・「万円」付きと無しが混在し続ける
 *     ・表示のたびに文字列置換が必要になる
 *   という今までの状態に戻る。
 *
 * ⚠️ 空入力は空文字で返す。0 にしてはいけない
 *   （未入力の欄が「0万円」で埋まり、聞き取り済みと区別できなくなる）。
 */
export const manYenToStored = (input: unknown): string => {
  const s = String(input ?? '').trim();
  if (s === '') return '';

  const num = Number.parseFloat(s.replace(/,/g, '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(num)) return '';

  return trimZero(num);
};
