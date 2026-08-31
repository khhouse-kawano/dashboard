/**
 * 商圏1件ぶんの詳細データを組み立てる。
 *
 * 一覧の集計（useMarketSummary）とは別で、選択した1行だけを対象にするため
 * 総当たりでも軽い。ここでは「グラフに渡す形」まで作り切る。
 */

import { useMemo } from 'react';
import {
  AGE_BANDS,
  ageBandLabel,
  type Gender,
  type MarketData,
  type MarketFilter,
  type MarketRow,
} from './types';

/** 住宅の建て方。「賃貸」は長屋建と共同住宅の合算。 */
const HOUSE_KINDS = [
  { label: '総数', types: ['総数'] },
  { label: '一戸建', types: ['一戸建'] },
  { label: '賃貸', types: ['長屋建', '共同住宅'] },
] as const;

/**
 * 家族類型を3つにまとめる。
 *
 * 元データは11区分あるが、11系列のグラフは色で見分けられない。
 * 「単身 / 夫婦のみ / 夫婦＋子」の3つに畳んでグラフにし、
 * 11区分の内訳は表で見せる。
 */
const HOUSEHOLD_GROUPS = [
  {
    key: 'single' as const,
    label: '単身',
    members: ['one_person_under30', 'one_person_30_64', 'one_person_over65'] as const,
  },
  {
    key: 'couple' as const,
    label: '夫婦のみ',
    members: ['wife_husband', 'wife_husband_over65'] as const,
  },
  {
    key: 'withChild' as const,
    label: '夫婦＋子',
    members: [
      'wife_husband_child_under3', 'wife_husband_child_3_5', 'wife_husband_child_6_9',
      'wife_husband_child_10_17', 'wife_husband_child_18_24', 'wife_husband_child_over25',
    ] as const,
  },
] as const;

/** 表で見せる11区分のラベル */
export const HOUSEHOLD_DETAIL_LABELS = {
  one_person_under30: '30歳未満 単身',
  one_person_30_64: '30〜64歳 単身',
  one_person_over65: '65歳以上 単身',
  wife_husband: '夫婦のみ',
  wife_husband_over65: '夫婦のみ（65歳以上）',
  wife_husband_child_under3: '夫婦＋子（0〜2歳）',
  wife_husband_child_3_5: '夫婦＋子（3〜5歳）',
  wife_husband_child_6_9: '夫婦＋子（6〜9歳）',
  wife_husband_child_10_17: '夫婦＋子（10〜17歳）',
  wife_husband_child_18_24: '夫婦＋子（18〜24歳）',
  wife_husband_child_over25: '夫婦＋子（25歳以上）',
} as const;

export type HouseholdDetailKey = keyof typeof HOUSEHOLD_DETAIL_LABELS;

export type MarketDetail = {
  /** 反響〜契約の推移。注文と建売で別系列 */
  funnelTrend: {
    period: string;
    orderRegister: number; orderVisit: number; orderContract: number;
    specRegister: number; specVisit: number; specContract: number;
  }[];
  /** エリア全体の着工推移（e-Stat） */
  areaTrend: { period: string; owner: number; condominiums: number }[];
  /** KHGシェアの推移。分母が0の期間は null にして線を切る */
  shareTrend: { period: string; order: number | null; spec: number | null }[];
  /** 人口ピラミッド。男は負値にして左へ伸ばす */
  pyramid: { age: string; male: number; female: number; total: number }[];
  /** 世帯構成（3グループ × 建て方） */
  householdGroups: { kind: string; single: number; couple: number; withChild: number }[];
  /** 世帯構成の内訳表（11区分 × 建て方） */
  householdDetail: { key: HouseholdDetailKey; label: string; values: Record<string, number> }[];
};

export const useMarketDetail = (
  data: MarketData,
  filter: MarketFilter,
  row: MarketRow | null
): MarketDetail | null =>
  useMemo(() => {
    if (row === null) return null;

    const isYear = filter.periodType === 'year';
    const periods = isYear ? data.master.years : data.master.periods;
    const periodLength = isYear ? 4 : 7;
    const buildingSource = isYear ? data.buildingYearly : data.building;
    const hasTotalRow = buildingSource.some((record) => record.isTotal);

    // 課・店舗の絞り込みは一覧と同じく担当者名で行う。
    // ここだけ店舗コードで絞ると、一覧の数字とグラフが食い違う。
    const staffFilter: Set<string> | null =
      filter.section === '' && filter.shop === ''
        ? null
        : new Set(
            data.master.staff
              .filter((s) => filter.section === '' || s.section === filter.section)
              .filter((s) => filter.shop === '' || s.shop === filter.shop)
              .map((s) => s.name)
          );

    const matchesStaff = (staff: string): boolean =>
      staffFilter === null || (staff !== '' && staffFilter.has(staff));

    /** この行が受け持つ e-Stat の行か */
    const inScope = (record: { areaKey: string; isTotal: boolean; isDistrict: boolean; isWard: boolean }): boolean => {
      if (!row.isTotal) return record.areaKey === row.areaKey;
      // 県全域行があるテーブルはそれだけを使う。無ければ市区町村を足し上げるが、
      // 郡（配下の町村と重複）と区（属する市と重複）は外す。
      return hasTotalRow ? record.isTotal : !record.isDistrict && !record.isWard;
    };

    // ---- エリア着工の推移 ----
    const areaByPeriod = new Map<string, { owner: number; condominiums: number }>();
    for (const record of buildingSource) {
      if (record.pref !== row.pref || !inScope(record)) continue;
      const current = areaByPeriod.get(record.period) ?? { owner: 0, condominiums: 0 };
      current.owner += record.owner;
      current.condominiums += record.condominiums;
      areaByPeriod.set(record.period, current);
    }

    // ---- KHG の着工推移 ----
    const khgByPeriod = new Map<string, { order: number; spec: number }>();
    const bumpKhg = (period: string | null, key: 'order' | 'spec'): void => {
      if (period === null) return;
      const current = khgByPeriod.get(period) ?? { order: 0, spec: 0 };
      current[key] += 1;
      khgByPeriod.set(period, current);
    };

    for (const record of data.orderConstruction) {
      if (record.pref !== row.pref) continue;
      if (!row.isTotal && !record.address.includes(row.areaKey)) continue;
      if (!matchesStaff(record.staff)) continue;
      bumpKhg(record.constructionDate.slice(0, periodLength), 'order');
    }
    for (const record of data.specConstruction) {
      if (record.pref !== row.pref) continue;
      if (!row.isTotal && record.areaKey !== row.areaKey) continue;
      if (!matchesStaff(record.staff)) continue;
      bumpKhg(record.constructionDate.slice(0, periodLength), 'spec');
    }

    // ---- 反響〜契約の推移 ----
    const funnelByPeriod = new Map(
      periods.map((period) => [
        period,
        {
          period,
          orderRegister: 0, orderVisit: 0, orderContract: 0,
          specRegister: 0, specVisit: 0, specContract: 0,
        },
      ])
    );

    for (const record of data.responses) {
      // 全域行の areaKey は '-' なので、部分一致に使うと番地のハイフンに当たる。
      // 全域は県名で判定する。
      const hit = row.isTotal
        ? record.address.includes(row.pref)
        : record.address.includes(row.areaKey);
      if (!hit) continue;
      if (!matchesStaff(record.staff)) continue;

      const prefix = record.category === '注文' ? 'order' : 'spec';
      const stages: [string | null, string][] = [
        [record.register, 'Register'],
        [record.visit, 'Visit'],
        [record.contract, 'Contract'],
      ];

      for (const [date, stage] of stages) {
        if (date === null) continue;
        const bucket = funnelByPeriod.get(date.slice(0, periodLength));
        if (bucket === undefined) continue;
        const key = `${prefix}${stage}` as keyof typeof bucket;
        (bucket[key] as number) += 1;
      }
    }

    const areaTrend = periods.map((period) => ({
      period,
      owner: areaByPeriod.get(period)?.owner ?? 0,
      condominiums: areaByPeriod.get(period)?.condominiums ?? 0,
    }));

    const shareTrend = periods.map((period) => {
      const area = areaByPeriod.get(period);
      const khg = khgByPeriod.get(period);
      // 分母が0の期間は「シェア0%」ではなく「不明」。線をつながず切る。
      const ratio = (numerator: number | undefined, denominator: number | undefined) =>
        denominator === undefined || denominator === 0 ? null : ((numerator ?? 0) / denominator) * 100;
      return {
        period,
        order: ratio(khg?.order, area?.owner),
        spec: ratio(khg?.spec, area?.condominiums),
      };
    });

    // ---- 人口ピラミッド ----
    const findPopulation = (gender: Gender) =>
      data.population.find(
        (p) =>
          p.pref === row.pref &&
          p.gender === gender &&
          (row.isTotal ? p.isTotal : p.areaKey === row.areaKey)
      );

    const male = findPopulation('男');
    const female = findPopulation('女');
    const total = findPopulation('計');

    // 上が高齢になるよう逆順にする（人口ピラミッドの慣習）
    const pyramid = [...AGE_BANDS].reverse().map((band) => ({
      age: ageBandLabel(band),
      // 男を負値にして中央から左へ伸ばす。表示時に絶対値へ戻す。
      male: -(male?.[band] ?? 0),
      female: female?.[band] ?? 0,
      total: total?.[band] ?? 0,
    }));

    // ---- 世帯構成 ----
    // 県全域行（area='-'）があるのでそれをそのまま使う。
    // 昔は無くて市区町村を足し上げていたが、郡や区を巻き込むと二重に数えてしまう。
    const hasHouseholdTotal = data.householdsBreakdown.some(
      (record) => record.pref === row.pref && record.isTotal
    );

    const breakdownFor = (types: readonly string[]) =>
      data.householdsBreakdown.filter((record) => {
        if (record.pref !== row.pref) return false;
        if (row.isTotal) {
          if (hasHouseholdTotal ? !record.isTotal : record.isDistrict || record.isWard) return false;
        } else if (record.areaKey !== row.areaKey) {
          return false;
        }
        return types.includes(record.type);
      });

    const householdGroups = HOUSE_KINDS.map((kind) => {
      const records = breakdownFor(kind.types);
      const sum = (members: readonly string[]) =>
        records.reduce(
          (acc, record) =>
            acc + members.reduce((inner, key) => inner + ((record as unknown as Record<string, number>)[key] ?? 0), 0),
          0
        );
      return {
        kind: kind.label,
        single: sum(HOUSEHOLD_GROUPS[0].members),
        couple: sum(HOUSEHOLD_GROUPS[1].members),
        withChild: sum(HOUSEHOLD_GROUPS[2].members),
      };
    });

    const householdDetail = (Object.keys(HOUSEHOLD_DETAIL_LABELS) as HouseholdDetailKey[]).map((key) => {
      const values: Record<string, number> = {};
      for (const kind of HOUSE_KINDS) {
        values[kind.label] = breakdownFor(kind.types).reduce(
          (acc, record) => acc + ((record as unknown as Record<string, number>)[key] ?? 0),
          0
        );
      }
      return { key, label: HOUSEHOLD_DETAIL_LABELS[key], values };
    });

    return {
      funnelTrend: [...funnelByPeriod.values()],
      areaTrend,
      shareTrend,
      pyramid,
      householdGroups,
      householdDetail,
    };
  }, [data, filter.periodType, filter.section, filter.shop, row]);

export const HOUSE_KIND_LABELS = HOUSE_KINDS.map((k) => k.label);
export { HOUSEHOLD_GROUPS };
