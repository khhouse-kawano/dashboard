import React from 'react';
import Table from 'react-bootstrap/Table';
import type { CategorySummary, MarketRow } from './types';

/**
 * 市況分析の一覧表。
 *
 * 旧実装との違い
 *   - No を「表示している行の通し番号」にした。以前は絞り込み前の添字だったため、
 *     非表示行があると 1, 3, 7 と番号が飛んでいた。
 *   - シェアの分母が0のときは 0% ではなく「-」を出す。旧実装は 0 除算の結果が
 *     そのまま NaN% / Infinity% として画面に出ることがあった。
 */

type Props = {
  rows: MarketRow[];
  onSelect: (row: MarketRow) => void;
  selectedKey: string | null;
};

const numberFormat = new Intl.NumberFormat('ja-JP');

const formatShare = (share: number | null): string =>
  share === null ? '-' : `${(Math.ceil(share * 1000) / 10).toFixed(1)}%`;

const CategoryCells: React.FC<{ summary: CategorySummary; tone: 'primary' | 'success' }> = ({
  summary,
  tone,
}) => (
  <>
    <td className={`table-${tone} text-end`}>{numberFormat.format(summary.register)}</td>
    <td className={`table-${tone} text-end`}>{numberFormat.format(summary.visit)}</td>
    <td className={`table-${tone} text-end`}>{numberFormat.format(summary.contract)}</td>
    <td className={`table-${tone} text-end`}>{numberFormat.format(summary.construction)}</td>
    <td className={`table-light text-${tone} text-end`}>
      {numberFormat.format(summary.areaConstruction)}
    </td>
    <td className={`table-${tone} text-end`}>{formatShare(summary.share)}</td>
  </>
);

const MarketTable: React.FC<Props> = ({ rows, onSelect, selectedKey }) => {
  if (rows.length === 0) {
    return (
      <p className="text-center my-5" style={{ fontSize: '13px' }}>
        条件に一致する商圏がありません。
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <Table
        style={{ fontSize: '12px', textAlign: 'center' }}
        bordered
        striped
        className="list_table resale"
      >
        <thead>
          <tr className="align-middle">
            <td rowSpan={2}>No</td>
            <td rowSpan={2}>都道府県</td>
            <td rowSpan={2}>市町村</td>
            <td colSpan={4} className="table-primary">KHG注文営業</td>
            <td colSpan={2} className="text-primary table-light">エリア</td>
            <td colSpan={4} className="table-success">KHG建売営業</td>
            <td colSpan={2} className="text-success table-light">エリア</td>
            <td rowSpan={2}>人口計</td>
            <td rowSpan={2}>世帯数</td>
          </tr>
          <tr>
            <td className="table-primary">反響</td>
            <td className="table-primary">来場</td>
            <td className="table-primary">契約</td>
            <td className="table-primary">着工棟数</td>
            <td className="table-light text-primary">着工棟数</td>
            <td className="table-primary">KHGシェア</td>
            <td className="table-success">反響</td>
            <td className="table-success">来場</td>
            <td className="table-success">契約</td>
            <td className="table-success">着工棟数</td>
            <td className="table-light text-success">着工棟数</td>
            <td className="table-success">KHGシェア</td>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key} className={row.key === selectedKey ? 'table-warning' : undefined}>
              <td>{index + 1}</td>
              <td>{row.pref}</td>
              <td style={{ textAlign: 'left' }}>
                {row.label}
                <i
                  className={`fa-solid ${
                    row.key === selectedKey
                      ? 'fa-minus ms-2 medium_expand bg-secondary'
                      : 'fa-plus ms-2 medium_expand bg-primary'
                  } text-white p-1 rounded`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${row.label}の詳細を開く`}
                  onClick={() => onSelect(row)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelect(row);
                  }}
                />
              </td>
              <CategoryCells summary={row.order} tone="primary" />
              <CategoryCells summary={row.spec} tone="success" />
              <td className="text-end">{numberFormat.format(row.population)}</td>
              <td className="text-end">
                {row.households === null ? '-' : numberFormat.format(row.households)}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default MarketTable;
