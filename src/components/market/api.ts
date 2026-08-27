/**
 * 市況分析のデータ取得。
 *
 * サーバー（PHP/PDO）は数値列も文字列で返すため、ここで一度だけ数値へ寄せる。
 * 画面側で毎回 Number() を書くと変換漏れが起きて、文字列連結による
 * 「12」+「3」= "123" のような事故につながる。
 */

import apiClient from '../../utils/apiClient';
import {
  AGE_BANDS,
  HOUSEHOLD_TYPES,
  type Building,
  type Households,
  type HouseholdsBreakdown,
  type MarketData,
  type MarketMaster,
  type OrderConstruction,
  type Population,
  type ResponseRecord,
  type SpecConstruction,
} from './types';

/**
 * 通信は apiClient 経由で行う。
 *
 * このプロジェクトにはバックエンドが2系統あり、呼び分けを間違えると
 * 「404 でも例外にならず、HTML が返ってきて JSON パースで落ちる」という
 * 分かりにくい失敗をする。
 *
 *   旧 … https://khg-marketing.info/dashboard/api/ に { demand: '...' }
 *        → api/actions/*.php。市況分析のハンドラは存在しない
 *   新 … REACT_APP_XSERVER_API に { request: '...' }
 *        → backend/src/index.php が backend/src/handlers/*.php へ振り分ける
 *
 * market_* は新しい側にあるので apiClient（= 新）を使う。
 * apiClient が Authorization ヘッダとトークンの付与も持っている。
 */

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** '0' / '' / false を false に、それ以外の真値を true にする */
const toBoolean = (value: unknown): boolean =>
  value === true || value === 1 || value === '1';

/** 空文字を null にそろえる。日付が未入力かどうかを毎回判定せずに済む。 */
const toNullableString = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
};

const post = async <T>(request: string): Promise<T> => {
  const response = await apiClient.post<T>('', { request });
  const body = response.data as unknown;

  // ルーティングを外すと index.php が JSON でエラーを返す。握りつぶさず表面化させる。
  if (body !== null && typeof body === 'object' && 'status' in body && body.status === 'error') {
    const message = 'message' in body ? String(body.message) : `${request} の取得に失敗しました。`;
    throw new Error(message);
  }

  // 404 などで HTML が返ると型だけ合って中身が違う。ここで気づけるようにする。
  if (typeof body === 'string') {
    throw new Error(
      `${request} が JSON 以外を返しました。REACT_APP_XSERVER_API の向き先を確認してください。`
    );
  }

  return response.data;
};

const parsePopulation = (raw: Record<string, unknown>): Population => {
  const bands = Object.fromEntries(
    AGE_BANDS.map((band) => [band, toNumber(raw[band])])
  ) as Record<(typeof AGE_BANDS)[number], number>;

  return {
    pref: String(raw.pref ?? ''),
    area: String(raw.area ?? ''),
    areaKey: String(raw.areaKey ?? ''),
    isDistrict: toBoolean(raw.isDistrict),
    isTotal: toBoolean(raw.isTotal),
    gender: (String(raw.gender ?? '計') as Population['gender']),
    year: String(raw.year ?? ''),
    amount: toNumber(raw.amount),
    ...bands,
  };
};

const parseHouseholds = (raw: Record<string, unknown>): Households => ({
  pref: String(raw.pref ?? ''),
  area: String(raw.area ?? ''),
  areaKey: String(raw.areaKey ?? ''),
  isDistrict: toBoolean(raw.isDistrict),
  isTotal: toBoolean(raw.isTotal),
  amount: toNumber(raw.amount),
  one_person: toNumber(raw.one_person),
  more_two_people: toNumber(raw.more_two_people),
  live_together: toNumber(raw.live_together),
});

const parseHouseholdsBreakdown = (raw: Record<string, unknown>): HouseholdsBreakdown => {
  const types = Object.fromEntries(
    HOUSEHOLD_TYPES.map((type) => [type, toNumber(raw[type])])
  ) as Record<(typeof HOUSEHOLD_TYPES)[number], number>;

  return {
    pref: String(raw.pref ?? ''),
    area: String(raw.area ?? ''),
    areaKey: String(raw.areaKey ?? ''),
    isDistrict: toBoolean(raw.isDistrict),
    isWard: toBoolean(raw.isWard),
    isTotal: toBoolean(raw.isTotal),
    type: String(raw.type ?? ''),
    amount: toNumber(raw.amount),
    one_person_under65: toNumber(raw.one_person_under65),
    ...types,
  };
};

const parseBuilding = (raw: Record<string, unknown>): Building => ({
  pref: String(raw.pref ?? ''),
  area: String(raw.area ?? ''),
  areaKey: String(raw.areaKey ?? ''),
  isDistrict: toBoolean(raw.isDistrict),
  isWard: toBoolean(raw.isWard),
  // 月次テーブルは県全域行を持たないので isTotal は常に false。
  isTotal: toBoolean(raw.isTotal),
  period: String(raw.period ?? ''),
  amount: toNumber(raw.amount),
  owner: toNumber(raw.owner),
  rent: toNumber(raw.rent),
  employer: toNumber(raw.employer),
  condominiums: toNumber(raw.condominiums),
});

const parseResponse = (raw: Record<string, unknown>): ResponseRecord => ({
  category: String(raw.category ?? '注文') as ResponseRecord['category'],
  register: toNullableString(raw.register),
  visit: toNullableString(raw.visit),
  contract: toNullableString(raw.contract),
  address: String(raw.address ?? ''),
  medium: String(raw.medium ?? ''),
  shop: String(raw.shop ?? ''),
  staff: String(raw.staff ?? ''),
});

export const fetchMarketData = async (): Promise<MarketData> => {
  // 4本は互いに依存しないので並列で取る。直列だと初期表示が体感で数秒遅くなる。
  const [master, area, responses, construction] = await Promise.all([
    post<MarketMaster>('market_master'),
    post<{
      population: Record<string, unknown>[];
      households: Record<string, unknown>[];
      householdsBreakdown: Record<string, unknown>[];
      building: Record<string, unknown>[];
      buildingYearly: Record<string, unknown>[];
    }>('market_area'),
    post<Record<string, unknown>[]>('market_response'),
    post<{
      order: Record<string, unknown>[];
      spec: Record<string, unknown>[];
    }>('market_construction'),
  ]);

  return {
    master: {
      shops: master.shops ?? [],
      sections: master.sections ?? [],
      staff: master.staff ?? [],
      mediums: master.mediums ?? [],
      prefs: master.prefs ?? [],
      periods: master.periods ?? [],
      years: master.years ?? [],
    },
    population: (area.population ?? []).map(parsePopulation),
    households: (area.households ?? []).map(parseHouseholds),
    householdsBreakdown: (area.householdsBreakdown ?? []).map(parseHouseholdsBreakdown),
    building: (area.building ?? []).map(parseBuilding),
    buildingYearly: (area.buildingYearly ?? []).map(parseBuilding),
    responses: (responses ?? []).map(parseResponse),
    orderConstruction: (construction.order ?? []) as unknown as OrderConstruction[],
    specConstruction: (construction.spec ?? []) as unknown as SpecConstruction[],
  };
};
