import React from 'react';
import { monthLabel } from '../summary/kpi';

/**
 * 2軸の複合グラフ（棒＝左軸、折れ線＝右軸の％）。v2.2.225。
 * ⚠️ 移植元は以前のアプリの comboChart（niceMax・svgTextW を含む）。目盛り・色・凡例・数字の出し方を同じにしている。
 */

export type ComboBar = { name: string; vals: number[]; fill: string; stroke?: string; overlay?: { name: string; vals: number[]; fill: string } };

type Props = {
    mks: string[];
    bars: ComboBar[];
    line?: { name: string; vals: (number | null)[]; color?: string };
    W?: number;
    H?: number;
    minMax?: number;
    aria?: string;
    axisL?: string;
    axisR?: string;
    /** 左軸の目盛り */
    fmtL: (v: number) => string;
    /** 棒の上の数字 */
    fmtB: (v: number) => string;
    /** ツールチップ */
    fmtT: (v: number) => string;
};

/** 切りのよい最大値（niceMax） */
const niceMax = (v: number): number => {
    if (!(v > 0)) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v)));
    const m = v / e;
    const st = m <= 1 ? 1 : m <= 1.2 ? 1.2 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 3 ? 3 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10;
    return st * e;
};

/** 文字の幅の見積もり（svgTextW） */
const textW = (t: string): number => {
    let w = 0;
    for (const ch of t) w += ch.charCodeAt(0) < 128 ? 5.6 : 10;
    return w;
};

const mShort = (mk: string) => `${Number(mk.slice(5, 7))}月`;

const ComboChart: React.FC<Props> = (o) => {
    const mks = o.mks;
    const n = mks.length || 1;
    const W = o.W ?? 880, H = o.H ?? 300;
    const pad = { l: 66, r: 62, t: 36, b: 34 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, bw = iw / n;
    const groups = o.bars.filter(g => g && g.vals);
    let maxL = o.minMax ?? 1;
    for (const g of groups) {
        for (const v of g.vals) if (v > maxL) maxL = v;
        if (g.overlay) for (const v of g.overlay.vals) if (v > maxL) maxL = v;
    }
    maxL = niceMax(maxL);
    const lv = o.line?.vals ?? [];
    const lc = o.line?.color ?? '#1a6b3c';
    let maxR = 100;
    for (const v of lv) if (v !== null && v > maxR) maxR = v;
    maxR = Math.ceil(maxR / 25) * 25;
    const T = 4;
    const yL = (v: number) => pad.t + ih - (ih * Math.min(v, maxL)) / maxL;
    const yR = (v: number) => pad.t + ih - (ih * Math.min(v, maxR)) / maxR;
    const gn = groups.length || 1, slot = (bw * 0.78) / gn, off = bw * 0.11;
    const hasLine = !!o.line && lv.some(v => v !== null);

    // 凡例の並び
    const legend: React.ReactNode[] = [];
    let lx = pad.l;
    const chip = (key: string, fill: string, label: string, stroke?: string) => {
        legend.push(
            <g key={key}>
                <rect x={lx} y={7} width={10} height={10} fill={fill} stroke={stroke} />
                <text x={lx + 14} y={16} fontSize={10} fill="#57534e">{label}</text>
            </g>
        );
        lx += 18 + textW(label);
    };
    groups.forEach((g, i) => { chip(`b${i}`, g.fill, g.name, g.stroke); if (g.overlay) chip(`o${i}`, g.overlay.fill, g.overlay.name); });

    return (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={o.aria ?? '複合グラフ'} style={{ maxWidth: '100%', height: 'auto' }}>
            {Array.from({ length: T + 1 }, (_, i) => {
                const y = pad.t + (ih * i) / T, a = (maxL * (T - i)) / T, b = (maxR * (T - i)) / T;
                return (
                    <g key={`t${i}`}>
                        <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#e6e4e0" />
                        <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#78716c">{o.fmtL(a)}</text>
                        <text x={W - pad.r + 6} y={y + 4} textAnchor="start" fontSize={10} fill={lc}>{Math.round(b)}%</text>
                    </g>
                );
            })}
            <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + ih} stroke="#c9c3ba" />
            <line x1={W - pad.r} y1={pad.t} x2={W - pad.r} y2={pad.t + ih} stroke={lc} opacity={0.55} />
            {mks.map((mk, i) => {
                const last = groups[groups.length - 1];
                const lvv = last ? last.vals[i] || 0 : 0;
                const lcx = pad.l + bw * i + off + slot * (gn - 1) + slot * 0.45;
                return (
                    <g key={mk}>
                        {groups.map((g, gi) => {
                            const x = pad.l + bw * i + off + slot * gi, w = slot * 0.9, v = g.vals[i] || 0;
                            const ov = g.overlay ? g.overlay.vals[i] || 0 : 0;
                            return (
                                <g key={gi}>
                                    {v > 0 && <rect x={x} y={yL(v)} width={w} height={pad.t + ih - yL(v)} fill={g.fill} stroke={g.stroke}><title>{`${mShort(mk)} ${g.name}：${o.fmtT(v)}`}</title></rect>}
                                    {ov > 0 && g.overlay && <rect x={x} y={yL(ov)} width={w} height={pad.t + ih - yL(ov)} fill={g.overlay.fill}><title>{`${mShort(mk)} ${g.overlay.name}：${o.fmtT(ov)}`}</title></rect>}
                                </g>
                            );
                        })}
                        {lvv > 0 && <text x={lcx} y={yL(lvv) - 4} textAnchor="middle" fontSize={9} fill="#44403c">{o.fmtB(lvv)}</text>}
                        <text x={pad.l + bw * i + bw / 2} y={pad.t + ih + 15} textAnchor="middle" fontSize={10} fill="#57534e">{mShort(mk)}</text>
                    </g>
                );
            })}
            {hasLine && (
                <>
                    {maxR >= 100 && <line x1={pad.l} y1={yR(100)} x2={W - pad.r} y2={yR(100)} stroke={lc} strokeDasharray="4 3" opacity={0.45}><title>年間目標 100%</title></line>}
                    {(() => {
                        const pts = lv.map((v, i) => (v === null ? null : `${pad.l + bw * i + bw / 2},${yR(v)}`)).filter(Boolean);
                        return pts.length > 1 ? <polyline fill="none" stroke={lc} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={pts.join(' ')} /> : null;
                    })()}
                    {lv.map((v, i) => v === null ? null : (
                        <g key={`p${i}`}>
                            <circle cx={pad.l + bw * i + bw / 2} cy={yR(v)} r={3.4} fill="#fff" stroke={lc} strokeWidth={1.8}><title>{`${monthLabel(mks[i])} 累計達成進捗率：${v.toFixed(1)}%`}</title></circle>
                            <text x={pad.l + bw * i + bw / 2} y={yR(v) - 8} textAnchor="middle" fontSize={9} fontWeight={600} fill={lc} stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{v.toFixed(0)}%</text>
                        </g>
                    ))}
                </>
            )}
            {legend}
            {hasLine && (
                <g>
                    <line x1={lx} y1={12} x2={lx + 16} y2={12} stroke={lc} strokeWidth={2} />
                    <circle cx={lx + 8} cy={12} r={3.2} fill="#fff" stroke={lc} strokeWidth={1.6} />
                    <text x={lx + 21} y={16} fontSize={10} fill={lc}>{o.line?.name}</text>
                </g>
            )}
            <text x={pad.l - 6} y={pad.t - 9} textAnchor="end" fontSize={9} fill="#78716c">{o.axisL ?? ''}</text>
            <text x={W - pad.r + 6} y={pad.t - 9} textAnchor="start" fontSize={9} fill={lc}>{o.axisR ?? ''}</text>
        </svg>
    );
};

export default ComboChart;
