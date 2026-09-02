/**
 * 市況分析のグラフ共通設定。
 *
 * 色は「系列の識別」に使う categorical パレットから、固定の順番で割り当てる。
 * 実データの多寡で色を入れ替えないこと。絞り込みで系列が減ったときに
 * 残った系列の色が変わると、前後の画面を見比べられなくなる。
 *
 * このパレットは色覚特性のシミュレーションで検証済み
 * （最小 CVD ΔE 9.2 / 通常視 27.6。いずれも基準を満たす）。
 * ただし aqua と magenta は白背景に対するコントラストが 3:1 を下回るため、
 * 凡例・直接ラベル・表のいずれかを必ず併記して色だけに頼らないようにする。
 */

/** 事業区分の色。表のヘッダ（注文=青 / 建売=緑）と対応させている。 */
export const CATEGORY_COLOR = {
  注文: '#2a78d6',
  建売: '#1baf7a',
} as const;

/** 反響 → 来場 → 契約 の3段階 */
export const FUNNEL_COLOR = {
  register: '#2a78d6',
  visit: '#eb6834',
  contract: '#1baf7a',
} as const;

/** 人口ピラミッドの男女 */
export const GENDER_COLOR = {
  male: '#2a78d6',
  female: '#e87ba4',
} as const;

/** 世帯の家族類型（3グループにまとめたもの） */
export const HOUSEHOLD_GROUP_COLOR = {
  single: '#2a78d6',
  couple: '#eb6834',
  withChild: '#1baf7a',
} as const;

/** 文字は必ずインクの色にする。系列色を文字に使うと読みにくくなる。 */
export const INK = {
  primary: '#1a1a19',
  secondary: '#52514e',
  muted: '#8a8983',
  grid: '#e8e8e6',
} as const;

export const axisTick = {
  fontSize: 11,
  fill: INK.secondary,
} as const;

export const legendStyle = {
  fontSize: '11px',
  color: INK.secondary,
  paddingTop: '4px',
} as const;

export const tooltipStyle = {
  contentStyle: {
    fontSize: '12px',
    borderRadius: '6px',
    border: `1px solid ${INK.grid}`,
    boxShadow: '0 2px 8px rgba(0,0,0,.08)',
  },
  labelStyle: { color: INK.primary, fontWeight: 600 },
} as const;

const numberFormat = new Intl.NumberFormat('ja-JP');

export const formatCount = (value: number): string => numberFormat.format(value);

/** 分母が0のときに 0% と出すと「シェア0」と誤読されるため「-」にする */
export const formatShare = (share: number | null): string =>
  share === null ? '-' : `${(Math.round(share * 1000) / 10).toFixed(1)}%`;
