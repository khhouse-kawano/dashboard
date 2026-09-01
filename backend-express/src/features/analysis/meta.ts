import { PHASES, PHASE_KEYS, TARGET_DIVISION, UNSET_LABEL } from './columns';
import type { DimensionKey } from './dimensions';
import { DIMENSION_KEYS, dimension } from './dimensions';
import type { MetricKey, RateKey } from './metrics';
import { METRIC_KEYS, metric, RATE_KEYS, RATES } from './metrics';
import type { Basis } from './query';
import { BASES, MAX_BYTES, MAX_ROWS, UNSYNCED_DIMENSION_KEYS, unsyncedDimensionLabel } from './query';

/**
 * レスポンスに添える説明文。
 *
 * このAPIの利用者は Claude Desktop（生成AI）で、返ってきたJSONだけを手がかりに
 * 日本語で推論を行う。人間なら画面の文脈から補える前提が一切効かないため、
 * 「この数字は何の母数か」「どの列が欠損しやすいか」を毎回明文化して渡す。
 *
 * これを省くと、欠損を0件と解釈する・母数の違う数字を並べて比較する、といった
 * 誤読が起きる。meta は飾りではなく仕様の一部として必ず返すこと。
 *
 * ⚠️ 実測値を書いた箇所はデータが増えれば古くなる。桁が変わるほどずれたら
 *   更新すること（傾向を伝えるのが目的なので1件単位の正確さは不要）。
 */

/** 全エンドポイント共通のデータ品質上の注意点 */
export const caveats = (): string[] => [
  `対象は${TARGET_DIVISION}のみ。master_data.show_dashboard = 1（ダッシュボード表示対象）かつ、` +
    `shop_list.division = ${TARGET_DIVISION} / report_flag = 1 の店舗に紐づく顧客に限定している。` +
    'report_flag による絞り込みは「KH全店舗」のような集計用ダミー行と運用を終えた店舗を除くためのもので、' +
    '実際に顧客が紐づく店舗は28店舗、対象は約23,000件（2026-08時点）。' +
    '件数は日々増えるため、正確な母数を知りたいときは groupBy を空にして leads を取ること。' +
    '既存のKPI分析画面と同じ絞り込み条件。',
  'さらに「集計基準日が有効に入っている行」だけを集計する。' +
    'basis = reaction（既定）では反響取得日が空の約2,300件が母数から外れ、対象は約20,500件になる。' +
    'basis = contract では契約日が入っている約950件だけが対象になり母数が大きく変わるため、' +
    'basis の違う結果同士を件数で比較してはならない。',
  'master_data は全列が text 型。日付は同じ列に「YYYY/MM/DD」と「YYYY-MM-DD」が混在しており' +
    '（反響取得日では約97%がスラッシュ形式）、API側で区切り文字を正規化してから集計している。',
  '⚠️ 最重要: フェーズの到達件数は単調減少しない。各フェーズの日付は担当者が個別に入力する運用で、' +
    '入力率がフェーズごとに大きく違うため。実測の入力率（2026-08時点の母数22,881件に対して。比率の傾向は母数が増えても大きく変わらない）は ' +
    '0次接客 0.6% / 通電 8.0% / 初回面談 25.0% / 第二面談 8.9% / 事前審査 4.1% / 契約 4.1%。' +
    'つまり通電の件数は初回面談の件数より少ない。' +
    'これは「面談したのに通電していない」のではなく「通電の入力が省略されている」ことを意味する。' +
    '前のフェーズの件数を分母にした段階別の転換率（通電→初回面談など）を計算してはならない。' +
    'API が返す比率はすべて反響数（leads）を分母にしており、' +
    '各フェーズの「入力された件数の割合」として解釈すること。',
  '0次接客（zeroReception）は入力率0.6%でほぼ使われていない。ファネルの既定の指標には含めていない。',
  'フェーズ到達件数は step_migration_item_* 系の列を根拠にしている。' +
    'date / reaction_date / first_interviewed_date という別系統の列も存在するが、' +
    '新しいレコードでは欠損が多いため使っていない。',
  '2015-01-01 より前の日付は入力ミス（0004年などの値が実在する）として除外している。',
  'master_data.category は「注文」と「order」に表記が分裂している（同じ意味）。' +
    '事業の絞り込みは category ではなく shop_list.division で行っているため、集計結果には影響しない。',
  'ブランド軸は shop_list.brand を使っている。master_data.brand は「国分ハウジング」「KH」のように' +
    '表記が不統一なため軸として採用していない。',
  `軸の値が空欄だった行は「${UNSET_LABEL}」にまとめている。これは入力漏れを意味し、0件ではない。`,
  `顧客ランクは全体の約半数が空欄。rank を軸にすると「${UNSET_LABEL}」が最大のグループになるため、` +
    'ランク別の傾向は「入力済みの中での傾向」として解釈すること。',
  'ステータス「重複」は同一顧客の二重登録。excludeDuplicated = true で母数から外せる。既定では含んでいる。',
  'リードタイムは、面談日や契約日が反響取得日より前になっている入力ミスを除外して算出している。' +
    '平均（avgDays*）は少数の長期案件に引っ張られるため、' +
    '分布の代表値を見たいときは中央値（medianDays*）を使うこと。',
  '架電・面談の指標は call_sheet / interview_sheet のログ件数のみ。' +
    'ログ本文（note）には顧客との会話内容が含まれるため、APIからは一切返していない。' +
    'なお架電記録が存在する顧客は全体の約3割で、記録のない顧客には' +
    '「架電していない」と「記録していない」の両方が混ざっている。',
  `反響媒体（responseMedium）は inquiry_customer 由来。反響台帳に紐づかない顧客は「${UNSET_LABEL}」になり、` +
    'これが最大のグループ（約7,200件）になる。販促媒体（medium）は master_data 由来の別項目で、値の体系も異なる。' +
    'なお responseMedium には「24」「31」のような数値だけの値が各1件だけ混ざっている（入力ミス）。' +
    '件数1桁の媒体は分析対象として扱わないこと。',
  'このAPIは集計値のみを返す。氏名・住所・電話番号・メールアドレス・生年月日・年収・勤務先などの' +
    '個人情報はSQLの段階で取得していない。',
];

/** 未同期リード専用の注意点 */
export const unsyncedCaveats = (): string[] => [
  'inquiry_customer.sync = 0 は、反響台帳から顧客台帳（master_data）へ取り込まれていないレコード。' +
    '追客されていない可能性を示す指標として使う。',
  'sync = 0 のレコードは pg_id を持たないため master_data と結合できない。' +
    'よって pivot / funnel の集計には一切含まれていない。この2つの母数と足し合わせると二重計上になる。',
  'delete_flag = 1（削除済み）は集計から除外している。',
  `店舗は他のエンドポイントと同じ条件（shop_list.division = ${TARGET_DIVISION} かつ report_flag = 1）で絞っている。`,
  'unsyncedRatePct はパーセント表記（13.7 は 13.7% の意味）。',
  '未同期であること自体が必ず問題とは限らない（重複反響や明らかな冷やかしも含まれる）。' +
    '店舗間・媒体間の差を見る指標として使うこと。',
];

const fromEntries = <T extends string>(keys: T[], label: (key: T) => string): Record<string, string> =>
  Object.fromEntries(keys.map((key) => [key, label(key)]));

/** /meta が返すカタログ。Claude / MCP が最初に呼んで全体像を掴むための情報 */
export const buildCatalog = (): Record<string, unknown> => ({
  概要:
    `${TARGET_DIVISION}の顧客データ（master_data）を集計して返す分析API。` +
    '個人情報は含まず、集計値のみを返す。',
  エンドポイント: {
    'GET /api/v1/analysis/meta': 'このカタログを返す。軸と指標の一覧を確認するために最初に呼ぶ。',
    'GET /api/v1/analysis/pivot': 'groupBy と metrics を指定して自由に集計する。汎用。',
    'GET /api/v1/analysis/funnel':
      '反響→通電→初回面談→第二面談→事前審査→契約 のファネルと転換率を返す。既定は 月 × 営業課。',
    'GET /api/v1/analysis/unsynced': '顧客台帳に未同期の反響（追客漏れの可能性）を集計する。',
  },
  認証: 'Authorization: Bearer <APIキー> が必要。Master権限のスタッフに発行されたキーのみ有効。',
  パラメータ: {
    groupBy: '集計軸。カンマ区切りまたは繰り返し指定。最大3個。',
    metrics: '指標。カンマ区切り。pivot でのみ指定できる。',
    rates: '比率。カンマ区切り。funnel では全種類が自動で付く。',
    basis: '集計基準日。reaction（既定）または contract。',
    from: '開始月。YYYY-MM 形式。省略すると最古のデータから。',
    to: '終了月。YYYY-MM 形式。省略すると最新のデータまで。',
    excludeDuplicated: 'true にするとステータス「重複」を母数から外す。既定は false。',
    '（軸名）': '軸と同じ名前のパラメータで等値の絞り込みができる。例: section=宮崎営業課',
  },
  集計軸: fromEntries(DIMENSION_KEYS, (key) => dimension(key).label),
  指標: fromEntries(METRIC_KEYS, (key) => metric(key).label),
  比率: {
    説明:
      '件数から算出する比率。単位はパーセント（12.5 は 12.5% の意味）。' +
      '分母はすべて反響数（leads）。母数が0の場合は null。',
    一覧: fromEntries(RATE_KEYS, (key) => RATES[key].label),
  },
  集計基準日: fromEntries(
    Object.keys(BASES) as Basis[],
    (key) => `${BASES[key].label} … ${BASES[key].note}`
  ),
  フェーズの順序: PHASE_KEYS.map((key) => `${key} = ${PHASES[key].label}`),
  未同期リードの軸: fromEntries(UNSYNCED_DIMENSION_KEYS, unsyncedDimensionLabel),
  制約:
    `1レスポンスの最大行数は ${MAX_ROWS} 行、rows の最大サイズは ${Math.round(MAX_BYTES / 1024)} KB。` +
    '超える場合は 400 エラーになるので、軸を減らすか期間を絞る。' +
    '顧客単位の生データは約1,500万トークン相当になるため提供していない。',
  データ品質の注意点: caveats(),
});

export interface ResponseMetaInput {
  groupBy: readonly DimensionKey[];
  metrics: readonly MetricKey[];
  rates: readonly RateKey[];
  basis: (typeof BASES)[Basis];
  from?: string;
  to?: string;
  filters: Partial<Record<DimensionKey, string>>;
  excludeDuplicated: boolean;
  rowCount: number;
}

/** 集計レスポンスに添える meta を組み立てる */
export const buildResponseMeta = (input: ResponseMetaInput): Record<string, unknown> => ({
  generatedAt: new Date().toISOString(),
  対象: `${TARGET_DIVISION}（master_data）。show_dashboard = 1 かつ report_flag = 1 の店舗に限定。既存のKPI分析画面と同じ母数。`,
  集計基準日: `${input.basis.label} … ${input.basis.note}`,
  期間: {
    from: input.from ?? '指定なし（最古のデータから）',
    to: input.to ?? '指定なし（最新のデータまで）',
  },
  集計軸: input.groupBy.map((key) => `${key} = ${dimension(key).label}`),
  指標の意味: {
    ...fromEntries([...input.metrics], (key) => metric(key).label),
    ...fromEntries([...input.rates], (key) => RATES[key].label),
  },
  絞り込み: Object.keys(input.filters).length === 0 ? 'なし' : input.filters,
  重複ステータスの扱い: input.excludeDuplicated
    ? 'ステータス「重複」の顧客を母数から除外した'
    : 'ステータス「重複」の顧客も母数に含む',
  行数: input.rowCount,
  データ品質の注意点: caveats(),
});
