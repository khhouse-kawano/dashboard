import React from 'react';
import type { MarketFilter, MarketMaster, PeriodType } from './types';

/**
 * 市況分析の絞り込みバー。
 *
 * 選択肢はすべてサーバーから来たマスタで組み立てる。
 * 旧実装は都道府県5件・世代21件を JSX に直接並べていたため、
 * データが増えても画面に出てこなかった。
 *
 * 課と店舗は、どちらも「今年度その所属だった担当者」に読み替えて突合する。
 * 契約・着工のデータが店舗コードを持たず担当者名しか無いため。
 */

type Props = {
  master: MarketMaster;
  filter: MarketFilter;
  onChange: (next: MarketFilter) => void;
};

/** 月次は '2025-01' を '2025/01'、年次は '2024' をそのまま見せる */
const formatPeriod = (period: string): string => period.replace('-', '/');

const MarketFilterBar: React.FC<Props> = ({ master, filter, onChange }) => {
  const update = <K extends keyof MarketFilter>(key: K, value: MarketFilter[K]): void => {
    onChange({ ...filter, [key]: value });
  };

  /** 空文字を null に読み替える（「指定なし」を表す） */
  const toNullable = (value: string): string | null => (value === '' ? null : value);

  const periodOptions = filter.periodType === 'year' ? master.years : master.periods;

  /**
   * 集計単位を切り替える。
   * 期間の書式が 'YYYY-MM' と 'YYYY' で変わるため、選択中の期間も
   * 切り替え先の全範囲に置き直す。そのままにすると比較が噛み合わず
   * 一覧が空になる。
   */
  const changePeriodType = (next: PeriodType): void => {
    const options = next === 'year' ? master.years : master.periods;
    onChange({
      ...filter,
      periodType: next,
      periodFrom: options[0] ?? null,
      periodTo: options[options.length - 1] ?? null,
    });
  };

  /**
   * 課を選んだら、その課に属さない店舗が選ばれたままにならないようにする。
   * 「熊本営業課 × KH鹿児島店」のような、該当者がいない組み合わせで
   * 表が空になるのを防ぐ。
   */
  const changeSection = (section: string): void => {
    const stillValid =
      filter.shop === '' ||
      section === '' ||
      master.staff.some((s) => s.section === section && s.shop === filter.shop);

    onChange({ ...filter, section, shop: stillValid ? filter.shop : '' });
  };

  /** 選んだ課に在籍者がいる店舗だけを出す */
  const shopOptions =
    filter.section === ''
      ? master.shops
      : master.shops.filter((shop) =>
          master.staff.some((s) => s.section === filter.section && s.shop === shop.shop)
        );

  return (
    <div className="d-flex flex-wrap mb-3 align-items-center">
      <div className="m-1 m-md-2">
        <select
          className="target"
          value={filter.pref}
          onChange={(e) => update('pref', e.target.value)}
          aria-label="都道府県"
        >
          {master.prefs.map((pref) => (
            <option key={pref} value={pref}>{pref}</option>
          ))}
        </select>
      </div>

      <div className="m-1 m-md-2">
        <input
          type="text"
          className="target"
          placeholder="市町村名で検索"
          value={filter.areaQuery}
          onChange={(e) => update('areaQuery', e.target.value)}
          aria-label="市町村名で検索"
        />
      </div>

      <div className="m-1 m-md-2">
        <select
          className="target"
          value={filter.periodType}
          onChange={(e) => changePeriodType(e.target.value as PeriodType)}
          aria-label="集計単位"
        >
          <option value="month">月次</option>
          <option value="year">年次</option>
        </select>
      </div>

      <div className="m-1 m-md-2">
        <select
          className="target"
          value={filter.periodFrom ?? ''}
          onChange={(e) => update('periodFrom', toNullable(e.target.value))}
          aria-label="期間（開始）"
        >
          <option value="">期間を選択</option>
          {periodOptions.map((period) => (
            <option key={period} value={period}>{formatPeriod(period)}</option>
          ))}
        </select>
      </div>
      ~
      <div className="m-1 m-md-2">
        <select
          className="target"
          value={filter.periodTo ?? ''}
          onChange={(e) => update('periodTo', toNullable(e.target.value))}
          aria-label="期間（終了）"
        >
          <option value="">期間を選択</option>
          {periodOptions.map((period) => (
            <option key={period} value={period}>{formatPeriod(period)}</option>
          ))}
        </select>
      </div>

      <div className="m-1 m-md-2">
        <select
          className="target"
          value={filter.section}
          onChange={(e) => changeSection(e.target.value)}
          aria-label="課"
        >
          <option value="">課を選択</option>
          {master.sections.map((section) => (
            <option key={section.name} value={section.name}>{section.name}</option>
          ))}
        </select>
      </div>

      <div className="m-1 m-md-2">
        <select
          className="target"
          value={filter.shop}
          onChange={(e) => update('shop', e.target.value)}
          aria-label="店舗"
        >
          <option value="">店舗を選択</option>
          {shopOptions.map((shop) => (
            <option key={shop.shop} value={shop.shop}>{shop.shop}</option>
          ))}
        </select>
      </div>

      <div className="m-1 m-md-2">
        <select
          className="target"
          value={filter.medium}
          onChange={(e) => update('medium', e.target.value)}
          aria-label="販促媒体"
        >
          <option value="">販促媒体を選択</option>
          {[...new Set(master.mediums.map((m) => m.ma_category))].map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default MarketFilterBar;
