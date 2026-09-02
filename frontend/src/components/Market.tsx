import React, { useEffect, useMemo, useState } from 'react';
import MarketDetailModal from './market/MarketDetailModal';
import MarketFilterBar from './market/MarketFilterBar';
import MarketTable from './market/MarketTable';
import { useMarketData } from './market/useMarketData';
import { useMarketSummary } from './market/useMarketSummary';
import type { MarketFilter, MarketRow } from './market/types';

/**
 * 市況分析。
 *
 * e-Stat の統計（人口・世帯数・建築着工）と自社CRMの実績を市区町村単位で
 * 突き合わせ、商圏ごとの KHG シェアを出す画面。
 *
 * 集計は useMarketSummary に寄せてある。ここは状態の保持と組み立てだけを行う。
 */

const INITIAL_FILTER: MarketFilter = {
  pref: '',
  areaQuery: '',
  section: '',
  // 既定は月次。
  //
  // 反響・来場・契約とエリア着工が両方そろうのは 2025年だけのため。
  // 自社CRMの反響取得日は 2025年以降が実質すべて（2024年以前は305件しかない）で、
  // 一方 e-Stat の年次着工は 2024年までしか無い。年次に切り替えると
  // 着工シェアの推移は見えるが、反響の列はほぼ0のまま並ぶ。
  periodType: 'month',
  periodFrom: null,
  periodTo: null,
  shop: '',
  medium: '',
};

const Market: React.FC = () => {
  const { data, loading, error } = useMarketData();
  const [filter, setFilter] = useState<MarketFilter>(INITIAL_FILTER);
  const [selected, setSelected] = useState<MarketRow | null>(null);

  // 初期値はマスタが届いてから決める。
  //
  // 期間の既定を e-Stat の着工データがある範囲に合わせるのが要点。
  // KHG の着工実績は2017年〜将来の予定日まで入っているのに対し、
  // e-Stat 側は限られた範囲しか無い。期間を無指定にすると
  // 分子だけが全期間、分母は一部という噛み合わせになり、
  // シェアが実態の数倍に膨らんでしまう。
  useEffect(() => {
    if (data === null || filter.pref !== '') return;

    const { prefs, periods, years } = data.master;
    const options = filter.periodType === 'year' ? years : periods;

    setFilter((current) => ({
      ...current,
      pref: prefs.includes('鹿児島県') ? '鹿児島県' : (prefs[0] ?? ''),
      periodFrom: options[0] ?? null,
      periodTo: options[options.length - 1] ?? null,
    }));
  }, [data, filter.pref, filter.periodType]);

  const { rows } = useMarketSummary(data, filter);

  // 絞り込みが変わって選択中の行が消えたら、モーダルを閉じる
  const selectedKey = selected?.key ?? null;
  useEffect(() => {
    if (selectedKey === null) return;
    if (!rows.some((row) => row.key === selectedKey)) setSelected(null);
  }, [rows, selectedKey]);

  // 表示中の行は絞り込みのたびに作り直されるため、選択行も最新の集計値に差し替える
  const selectedRow = useMemo(
    () => (selectedKey === null ? null : rows.find((row) => row.key === selectedKey) ?? null),
    [rows, selectedKey]
  );

  return (
    <div className="content">
      <div className="top_content p-3">
        {data !== null && (
          <MarketFilterBar master={data.master} filter={filter} onChange={setFilter} />
        )}

        <div className="mb-4" style={{ fontSize: '11px' }}>
          ※反響数、来場数、契約数は自社CRM（master_data / master_data_kaeru）より取得<br />
          ※KHGの着工棟数は注文住宅⇒「受注完工【KHG】」、建売住宅⇒「かえるホーム工程表」より取得<br />
          ※エリアごとの着工棟数、人口、世帯数はe-Statのデータベースより取得<br />
          ※<strong>月次</strong>は2025/01〜2026/06。反響〜契約とエリア着工が両方そろうのはこの期間です<br />
          ※<strong>年次</strong>は2011〜2024年。エリア着工とKHG着工のシェア推移を長期で見る用途です。
          自社CRMの反響は2025年以降が大半のため、年次では反響・来場・契約の列がほぼ0になります<br />
          ※<strong>人口・世帯数は経年比較の対象外</strong>です。期間を変えても同じ値を表示します
        </div>

        {filter.periodType === 'year' && (
          <div className="alert alert-warning py-2 mb-3" role="status" style={{ fontSize: '11px' }}>
            年次表示です。反響・来場・契約はCRMに2025年以降のデータしか無いため、ほぼ0になります。
            着工棟数とKHGシェアの推移をご覧ください。
          </div>
        )}

        {loading && (
          <p className="text-center my-5" style={{ fontSize: '13px' }}>
            <i className="fa-solid fa-rotate spinning me-2" />市況データを読み込んでいます...
          </p>
        )}

        {error !== null && (
          <div className="alert alert-danger my-4" role="alert" style={{ fontSize: '13px' }}>
            {error}
          </div>
        )}

        {!loading && error === null && (
          <MarketTable rows={rows} onSelect={setSelected} selectedKey={selectedKey} />
        )}
      </div>

      {data !== null && (
        <MarketDetailModal
          data={data}
          filter={filter}
          row={selectedRow}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

export default Market;
