import React, { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import axios from 'axios';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CATEGORY_COLOR,
  FUNNEL_COLOR,
  GENDER_COLOR,
  HOUSEHOLD_GROUP_COLOR,
  INK,
  axisTick,
  formatCount,
  formatShare,
  legendStyle,
  tooltipStyle,
} from './chartTheme';
import { HOUSE_KIND_LABELS, useMarketDetail } from './useMarketDetail';
import type { CategorySummary, MarketData, MarketFilter, MarketRow } from './types';

/**
 * 商圏1件の詳細。
 *
 * 旧実装からの主な変更
 *   - 6枚のグラフを縦に積んでいたのをタブで分けた。1画面に収まらず、
 *     どのグラフが何のものか分からなくなっていたため。
 *   - 円グラフ（11区分×3枚）をやめた。11色は見分けがつかず、
 *     ラベルも重なって読めなかった。3グループの横棒＋内訳表に置き換えている。
 *   - 世代別人口の3系列棒グラフを人口ピラミッドにした。
 *   - シェアの推移を独立したグラフにした。KHG着工とエリア着工は桁が違うので
 *     同じ図に重ねると片方が潰れる（2軸にするのは誤読のもとなので採らない）。
 *   - 開いていなくても AI 分析の POST が走っていたのを、押したときだけにした。
 */

const AI_ENDPOINT = 'https://sync-pg-cloud-9f739ab131ed.herokuapp.com/api/areasummary';

type Props = {
  data: MarketData;
  filter: MarketFilter;
  row: MarketRow | null;
  onClose: () => void;
};

/** 期間の見せ方。月次は '2025-01' を '2025/01'、年次は '2024' のまま。 */
const formatPeriod = (period: string): string => period.replace('-', '/');

// ---------------------------------------------------------------------------
// 小さな部品
// ---------------------------------------------------------------------------

/** 数値ひとつぶんのカード */
const StatTile: React.FC<{ label: string; value: string; accent?: string }> = ({
  label,
  value,
  accent,
}) => (
  <div className="px-3 py-2 border rounded" style={{ minWidth: '92px', flex: '1 1 92px' }}>
    <div style={{ fontSize: '10px', color: INK.muted }}>{label}</div>
    <div style={{ fontSize: '17px', fontWeight: 700, color: accent ?? INK.primary }}>{value}</div>
  </div>
);

/** 注文／建売それぞれのKPI一式 */
const SummaryTiles: React.FC<{ title: string; summary: CategorySummary; color: string }> = ({
  title,
  summary,
  color,
}) => (
  <div className="mb-3">
    <div className="d-flex align-items-center mb-2" style={{ fontSize: '12px', fontWeight: 600 }}>
      {/* 色は凡例代わりの小さな四角で示し、文字自体はインクの色のままにする */}
      <span
        className="d-inline-block me-2 rounded"
        style={{ width: '10px', height: '10px', backgroundColor: color }}
      />
      {title}
    </div>
    <div className="d-flex flex-wrap gap-2">
      <StatTile label="反響" value={formatCount(summary.register)} />
      <StatTile label="来場" value={formatCount(summary.visit)} />
      <StatTile label="契約" value={formatCount(summary.contract)} />
      <StatTile label="KHG着工" value={formatCount(summary.construction)} />
      <StatTile label="エリア着工" value={formatCount(summary.areaConstruction)} />
      <StatTile label="KHGシェア" value={formatShare(summary.share)} accent={color} />
    </div>
  </div>
);

/** グラフ1枚ぶんの枠。見出しと高さの指定を1か所にまとめる。 */
const ChartBlock: React.FC<{
  title: string;
  note?: string;
  height?: number;
  children: React.ReactElement;
}> = ({ title, note, height = 260, children }) => (
  <div className="mb-4">
    <div style={{ fontSize: '12px', fontWeight: 600, color: INK.primary }}>{title}</div>
    {note !== undefined && (
      <div style={{ fontSize: '10px', color: INK.muted }}>{note}</div>
    )}
    <div style={{ width: '100%', height: `${height}px`, marginTop: '6px' }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  </div>
);

/** 反響〜契約の推移。注文と建売を同じ形で並べて比べられるようにする。 */
const FunnelChart: React.FC<{
  title: string;
  data: Record<string, number | string>[];
  keys: { register: string; visit: string; contract: string };
}> = ({ title, data, keys }) => (
  <ChartBlock title={title}>
    <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
      <CartesianGrid stroke={INK.grid} vertical={false} />
      <XAxis dataKey="period" tick={axisTick} tickFormatter={formatPeriod} tickLine={false} axisLine={{ stroke: INK.grid }} />
      <YAxis tick={axisTick} allowDecimals={false} tickLine={false} axisLine={false} width={52} />
      <Tooltip
        {...tooltipStyle}
        labelFormatter={formatPeriod}
        formatter={(value: number) => formatCount(value)}
      />
      <Legend wrapperStyle={legendStyle} iconType="plainline" iconSize={14} />
      <Line type="monotone" dataKey={keys.register} name="反響" stroke={FUNNEL_COLOR.register} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      <Line type="monotone" dataKey={keys.visit} name="来場" stroke={FUNNEL_COLOR.visit} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      <Line type="monotone" dataKey={keys.contract} name="契約" stroke={FUNNEL_COLOR.contract} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
    </LineChart>
  </ChartBlock>
);

// ---------------------------------------------------------------------------
// 本体
// ---------------------------------------------------------------------------

const MarketDetailModal: React.FC<Props> = ({ data, filter, row, onClose }) => {
  const [aiState, setAiState] = useState<{
    loading: boolean;
    html: string | null;
    error: string | null;
  }>({ loading: false, html: null, error: null });

  const detail = useMarketDetail(data, filter, row);

  const close = (): void => {
    setAiState({ loading: false, html: null, error: null });
    onClose();
  };

  const title = row === null ? '' : row.isTotal ? `${row.pref}全域` : row.label;
  const periodLabel =
    filter.periodFrom === null || filter.periodTo === null
      ? '全期間'
      : `${formatPeriod(filter.periodFrom)} 〜 ${formatPeriod(filter.periodTo)}`;

  return (
    <Modal show={row !== null} onHide={close} size="xl" scrollable>
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: '15px' }}>
          {title}
          <span className="ms-2" style={{ fontSize: '11px', color: INK.muted, fontWeight: 400 }}>
            {periodLabel}（{filter.periodType === 'year' ? '年次' : '月次'}）
          </span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {row !== null && detail !== null && (
          <>
            {/* ---- KPI。タブを切り替えても常に見える位置に置く ---- */}
            <SummaryTiles title="KHG注文営業" summary={row.order} color={CATEGORY_COLOR.注文} />
            <SummaryTiles title="KHG建売営業" summary={row.spec} color={CATEGORY_COLOR.建売} />

            <div className="d-flex flex-wrap gap-2 mb-3">
              <StatTile label="人口計" value={formatCount(row.population)} />
              <StatTile
                label="世帯数"
                value={row.households === null ? '-' : formatCount(row.households)}
              />
            </div>

            {aiState.html !== null && (
              <div className="mb-4">
                <div style={{ fontSize: '12px', fontWeight: 600 }}>AIによる市場分析結果</div>
                {/* サーバーが整形済みHTMLを返す既存仕様に合わせている */}
                <div className="comment mt-2" dangerouslySetInnerHTML={{ __html: aiState.html }} />
              </div>
            )}

            <Tabs defaultActiveKey="funnel" className="mb-3" style={{ fontSize: '12px' }}>
              {/* ------------------------------------------------------- */}
              <Tab eventKey="funnel" title="反響の推移">
                <FunnelChart
                  title="注文営業"
                  data={detail.funnelTrend}
                  keys={{ register: 'orderRegister', visit: 'orderVisit', contract: 'orderContract' }}
                />
                <FunnelChart
                  title="建売営業"
                  data={detail.funnelTrend}
                  keys={{ register: 'specRegister', visit: 'specVisit', contract: 'specContract' }}
                />
              </Tab>

              {/* ------------------------------------------------------- */}
              <Tab eventKey="construction" title="着工とシェア">
                <ChartBlock
                  title="エリア全体の着工棟数（e-Stat）"
                  note="持家は注文住宅、分譲は建売のシェアの分母にあたる"
                >
                  <LineChart data={detail.areaTrend} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke={INK.grid} vertical={false} />
                    <XAxis dataKey="period" tick={axisTick} tickFormatter={formatPeriod} tickLine={false} axisLine={{ stroke: INK.grid }} />
                    <YAxis tick={axisTick} allowDecimals={false} tickLine={false} axisLine={false} width={52} />
                    <Tooltip {...tooltipStyle} labelFormatter={formatPeriod} formatter={(v: number) => formatCount(v)} />
                    <Legend wrapperStyle={legendStyle} iconType="plainline" iconSize={14} />
                    <Line type="monotone" dataKey="owner" name="持家" stroke={CATEGORY_COLOR.注文} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="condominiums" name="分譲" stroke={CATEGORY_COLOR.建売} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ChartBlock>

                <ChartBlock
                  title="KHGシェアの推移"
                  note="KHGの着工棟数 ÷ エリアの着工棟数。分母が0の期間は線が途切れる"
                >
                  <LineChart data={detail.shareTrend} margin={{ top: 4, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke={INK.grid} vertical={false} />
                    <XAxis dataKey="period" tick={axisTick} tickFormatter={formatPeriod} tickLine={false} axisLine={{ stroke: INK.grid }} />
                    <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52} unit="%" />
                    <Tooltip
                      {...tooltipStyle}
                      labelFormatter={formatPeriod}
                      formatter={(value) =>
                        // 分母が0の期間は値が null で来る。0% と出すと誤読されるため '-'。
                        typeof value === 'number' ? `${value.toFixed(1)}%` : '-'
                      }
                    />
                    <Legend wrapperStyle={legendStyle} iconType="plainline" iconSize={14} />
                    <Line type="monotone" dataKey="order" name="注文" stroke={CATEGORY_COLOR.注文} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                    <Line type="monotone" dataKey="spec" name="建売" stroke={CATEGORY_COLOR.建売} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                  </LineChart>
                </ChartBlock>
              </Tab>

              {/* ------------------------------------------------------- */}
              <Tab eventKey="demographics" title="人口・世帯">
                <div className="alert alert-light border py-2 mb-3" style={{ fontSize: '10px', color: INK.secondary }}>
                  人口・世帯数は経年比較の対象外です。期間を変えても同じ値を表示します。
                </div>

                <ChartBlock title="人口ピラミッド" note="左が男性、右が女性" height={480}>
                  <BarChart
                    data={detail.pyramid}
                    layout="vertical"
                    stackOffset="sign"
                    margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
                    barCategoryGap={2}
                  >
                    <CartesianGrid stroke={INK.grid} horizontal={false} />
                    <XAxis
                      type="number"
                      tick={axisTick}
                      tickLine={false}
                      axisLine={{ stroke: INK.grid }}
                      tickFormatter={(v: number) => formatCount(Math.abs(v))}
                    />
                    <YAxis
                      type="category"
                      dataKey="age"
                      tick={axisTick}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      interval={0}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v: number, name: string) => [formatCount(Math.abs(v)), name]}
                      labelFormatter={(label: string) => `${label}歳`}
                    />
                    <Legend wrapperStyle={legendStyle} iconType="square" iconSize={10} />
                    <Bar dataKey="male" name="男性" fill={GENDER_COLOR.male} stackId="pyramid" />
                    <Bar dataKey="female" name="女性" fill={GENDER_COLOR.female} stackId="pyramid" />
                  </BarChart>
                </ChartBlock>

                <ChartBlock
                  title="世帯構成"
                  note="賃貸は長屋建と共同住宅の合算。内訳は下表を参照"
                  height={220}
                >
                  <BarChart
                    data={detail.householdGroups}
                    layout="vertical"
                    margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
                    barGap={2}
                  >
                    <CartesianGrid stroke={INK.grid} horizontal={false} />
                    <XAxis type="number" tick={axisTick} tickLine={false} axisLine={{ stroke: INK.grid }} tickFormatter={(v: number) => formatCount(v)} />
                    <YAxis type="category" dataKey="kind" tick={axisTick} tickLine={false} axisLine={false} width={52} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => formatCount(v)} />
                    <Legend wrapperStyle={legendStyle} iconType="square" iconSize={10} />
                    <Bar dataKey="single" name="単身" fill={HOUSEHOLD_GROUP_COLOR.single} radius={[0, 3, 3, 0]} />
                    <Bar dataKey="couple" name="夫婦のみ" fill={HOUSEHOLD_GROUP_COLOR.couple} radius={[0, 3, 3, 0]} />
                    <Bar dataKey="withChild" name="夫婦＋子" fill={HOUSEHOLD_GROUP_COLOR.withChild} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ChartBlock>

                {/* グラフでは3つに畳んでいるので、11区分の実数はここで見せる */}
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                  世帯構成の内訳
                </div>
                <Table bordered striped size="sm" style={{ fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th>家族類型</th>
                      {HOUSE_KIND_LABELS.map((kind) => (
                        <th key={kind} className="text-end">{kind}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.householdDetail.map((entry) => (
                      <tr key={entry.key}>
                        <td>{entry.label}</td>
                        {HOUSE_KIND_LABELS.map((kind) => (
                          <td key={kind} className="text-end">
                            {formatCount(entry.values[kind] ?? 0)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Tab>
            </Tabs>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default MarketDetailModal;
