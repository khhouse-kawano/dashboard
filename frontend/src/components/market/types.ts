/**
 * 市況分析（Market）の型定義。
 *
 * サーバーは数値列も文字列で返すことがある（PDO の既定挙動）。
 * 受け取った直後に api.ts で数値へ寄せるため、ここでの型は変換後の形とする。
 */

/** 一覧の1行を成す集計単位 */
export type AreaScope = 'pref' | 'area';

/** 5歳階級の人口列。表示順に並べる。 */
export const AGE_BANDS = [
  'age_0_4', 'age_5_9', 'age_10_14', 'age_15_19', 'age_20_24',
  'age_25_29', 'age_30_34', 'age_35_39', 'age_40_44', 'age_45_49',
  'age_50_54', 'age_55_59', 'age_60_64', 'age_65_69', 'age_70_74',
  'age_75_79', 'age_80_84', 'age_85_89', 'age_90_94', 'age_95_99',
  'age_100_',
] as const;

export type AgeBand = (typeof AGE_BANDS)[number];

/** 「0~4」のような表示用ラベル */
export const ageBandLabel = (band: AgeBand): string =>
  band === 'age_100_' ? '100~' : band.replace('age_', '').replace('_', '~');

export type Gender = '計' | '男' | '女';

export type Population = {
  pref: string;
  area: string;
  /** 郡名の接頭辞を落とした突合キー（例: 三養基郡基山町 → 基山町） */
  areaKey: string;
  /** 郡そのものの行。県計を出すときは除外しないと二重計上になる */
  isDistrict: boolean;
  /** area が '-' の県全域行 */
  isTotal: boolean;
  gender: Gender;
  year: string;
  amount: number;
} & Record<AgeBand, number>;

/**
 * 世帯総数。
 *
 * 経年比較の対象外で、期間を切り替えても値は変わらない。
 * 国勢調査は5年おきのため月次・年次のどちらの軸にも素直に載らず、
 * 直近1時点のスナップショットとして扱うと決めている。
 */
export type Households = {
  pref: string;
  area: string;
  areaKey: string;
  isDistrict: boolean;
  isTotal: boolean;
  amount: number;
  one_person: number;
  more_two_people: number;
  live_together: number;
};

/** 世帯数内訳の家族類型。円グラフの系列と対応する。 */
export const HOUSEHOLD_TYPES = [
  'one_person_under30', 'one_person_30_64', 'one_person_over65',
  'wife_husband', 'wife_husband_over65',
  'wife_husband_child_under3', 'wife_husband_child_3_5', 'wife_husband_child_6_9',
  'wife_husband_child_10_17', 'wife_husband_child_18_24', 'wife_husband_child_over25',
] as const;

export type HouseholdType = (typeof HOUSEHOLD_TYPES)[number];

/** 世帯数の内訳。Households と同じく経年比較の対象外。 */
export type HouseholdsBreakdown = {
  pref: string;
  area: string;
  areaKey: string;
  isDistrict: boolean;
  isWard: boolean;
  /** area が '-' の県全域行 */
  isTotal: boolean;
  /** 総数 / 一戸建 / 長屋建 / 共同住宅 / その他 */
  type: string;
  amount: number;
  one_person_under65: number;
} & Record<HouseholdType, number>;

export type Building = {
  pref: string;
  area: string;
  areaKey: string;
  /** 郡そのものの行。配下の町村と数値が重複する */
  isDistrict: boolean;
  /** 政令市の区の行。属する市と数値が重複する（熊本市 = 中央区+東区+西区+南区+北区） */
  isWard: boolean;
  /** 月次なら 'YYYY-MM'、年次なら 'YYYY' */
  period: string;
  /**
   * 県全域の行かどうか。
   * 月次(building)には県全域行が無いため常に false。
   * 年次(building_yearly)には e-Stat の県計行があるので true になる行がある。
   */
  isTotal: boolean;
  amount: number;
  /** 持家。注文住宅のシェアの分母 */
  owner: number;
  rent: number;
  employer: number;
  /** 分譲。建売のシェアの分母 */
  condominiums: number;
};

/**
 * 集計の粒度。
 *
 * 月次(building)は 2025-01〜2025-10 の10か月しか無いが2025年を見られる。
 * 年次(building_yearly)は 2011〜2024 の14年分あり経年比較ができる。
 * e-Stat に「月次 × 市区町村 × 利用関係別」の統計表が存在しないため、
 * この2つを併せ持つほかない。
 */
export type PeriodType = 'month' | 'year';

export type Category = '注文' | '建売';

/** 反響 → 来場 → 契約 の3点。日付が無い段階は null。 */
export type ResponseRecord = {
  category: Category;
  register: string | null;
  visit: string | null;
  contract: string | null;
  address: string;
  medium: string;
  /** 担当店舗（master_data.in_charge_store） */
  shop: string;
  /** 担当者（master_data.in_charge_user）。課・店舗の絞り込みはこの名前で突合する */
  staff: string;
};

export type OrderConstruction = {
  category: '注文';
  constructionDate: string;
  pref: string;
  address: string;
  /** 営業担当。課・店舗の絞り込みはこの名前で突合する */
  staff: string;
  /** 事業所。staff_list の shop とは表記が違うため絞り込みには使わない */
  shop: string;
  section: string;
};

export type SpecConstruction = {
  category: '建売';
  constructionDate: string;
  pref: string;
  area: string;
  areaKey: string;
  staff: string;
  salesStatus: string;
  progressStatus: string;
};

export type Shop = { brand: string; shop: string; section: string; area: string };
export type Section = { name: string; division: string };
export type Staff = { name: string; shop: string; section: string };
export type Medium = { medium: string; ma_category: string };

export type MarketMaster = {
  shops: Shop[];
  /** 注文事業・建売分譲事業の課 */
  sections: Section[];
  /** 今年度の在籍者。課・店舗の絞り込みで担当者名の突合表として使う */
  staff: Staff[];
  mediums: Medium[];
  prefs: string[];
  /** 'YYYY-MM' の昇順。月次の着工データが存在する月だけ */
  periods: string[];
  /** 'YYYY' の昇順。年次の着工データが存在する年だけ */
  years: string[];
};

export type MarketData = {
  master: MarketMaster;
  population: Population[];
  households: Households[];
  householdsBreakdown: HouseholdsBreakdown[];
  /** 月次（2025年のみ） */
  building: Building[];
  /** 年次（2011〜2024） */
  buildingYearly: Building[];
  responses: ResponseRecord[];
  orderConstruction: OrderConstruction[];
  specConstruction: SpecConstruction[];
};

/**
 * 絞り込み条件。
 *
 * 課(section)と店舗(shop)は、どちらも「今年度その所属だった担当者」に読み替えて
 * 突合する。契約・着工のデータは店舗コードを持たず担当者名しか無いため。
 */
export type MarketFilter = {
  pref: string;
  /** 市町村名の部分一致 */
  areaQuery: string;
  /** 月次か年次か。periodFrom / periodTo の書式もこれで決まる */
  periodType: PeriodType;
  /** periodType が 'month' なら 'YYYY-MM'、'year' なら 'YYYY'。null なら制限なし */
  periodFrom: string | null;
  periodTo: string | null;
  /** section_list.name。空なら絞り込まない */
  section: string;
  /** shop_list.shop。空なら絞り込まない */
  shop: string;
  medium: string;
};

/** 一覧の人口列に使う性別。男女別は詳細の人口ピラミッドでのみ扱う。 */
export const TABLE_POPULATION_GENDER: Gender = '計';

/** 一覧の1行 */
export type MarketRow = {
  key: string;
  pref: string;
  area: string;
  areaKey: string;
  /** 表示名。県全域行は「全域」 */
  label: string;
  isTotal: boolean;
  order: CategorySummary;
  spec: CategorySummary;
  /** 選択した世代・性別で絞った人口 */
  population: number;
  /** 世帯総数。データが無ければ null */
  households: number | null;
};

export type CategorySummary = {
  register: number;
  visit: number;
  contract: number;
  /** KHG の着工棟数 */
  construction: number;
  /** エリア全体の着工棟数（e-Stat） */
  areaConstruction: number;
  /** construction / areaConstruction。分母が0なら null */
  share: number | null;
};
