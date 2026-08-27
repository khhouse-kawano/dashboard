import React from 'react';
import {
    ResponsiveContainer, LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { CLAUDE_ORANGE } from './ClaudeIcon';

/**
 * 分析結果の描画。
 *
 * 設計方針:
 *   数値とグラフは **DBの集計値（snapshot）** から描画し、
 *   Claude が返すのは「解釈」（headline / highlights / insights / actions）のみ。
 *   これにより数値の転記ミスが構造的に起こり得ない。
 *   また文字列はすべて React が自動エスケープするため、XSS の懸念もない。
 */

/** Anthropic のブランドパレット */
const COLORS = {
    dark: '#141413',
    light: '#faf9f5',
    midGray: '#b0aea5',
    lightGray: '#e8e6dc',
    blue: '#6a9bcc',
    green: '#788c5d',
    red: '#b5533f',
};

const SERIES_COLORS = [CLAUDE_ORANGE, COLORS.blue, COLORS.green, '#c2a15a', '#8c7a9c'];

// ---------------------------------------------------------------------------
// 型
// ---------------------------------------------------------------------------

/** 反響取得月ごとのコホート。その月に獲得した顧客がどこまで進んだかを表す */
export type MonthlyRow = {
    month: string;
    count: number;
    interviewed: number;
    contracted: number;
    high_rank: number;
    interview_rate_pct: number;
    contract_rate_pct: number;
    high_rank_pct: number;
    /** 当月。取得件数がまだ増える */
    is_partial: boolean;
    /** 取得件数は確定しているが、面談・契約はこれから増える月 */
    is_maturing: boolean;
};

/** 全体値と各項目の入力率。絞り込み時は絞り込み後の値になる */
export type OverallContext = {
    total: number;
    interviewed: number;
    contracted: number;
    interview_rate_pct: number;
    contract_rate_pct: number;
    close_rate_pct: number;
    avg_days_to_interview: number | null;
    avg_days_to_contract: number | null;
    input_coverage_pct: Record<string, number>;
};

/**
 * 絞り込み時の比較基準（部門全体の値）。
 * 絞り込んでいないときはサーバーが null を返す（overall と同じ値になり冗長なため）。
 */
export type Benchmark = { label: string; context: OverallContext } | null;

export type InquiryTrendSnapshot = {
    generated_at: string;
    period_months: number;
    source: string;
    note: string;
    /** 例: 注文事業 › 鹿児島営業1課。絞り込みが無ければ部門名のみ */
    scope_label?: string;
    benchmark?: Benchmark;
    monthly: MonthlyRow[];
    by_medium: { medium: string; count: number; share_pct: number; interview_rate_pct: number; contract_rate_pct: number }[];
    medium_monthly: { medium: string; monthly: { month: string; count: number }[] }[];
    totals: {
        period_total: number;
        closed_month_avg: number;
        latest_closed_month: string | null;
        latest_closed_count: number | null;
        prev_closed_count: number | null;
        mom_change_pct: number | null;
    };
};

export type StructuredAnalysis = {
    headline: string;
    highlights: { metric: string; observation: string; assessment: 'positive' | 'negative' | 'neutral' }[];
    insights: { title: string; detail: string; basis: 'data' | 'hypothesis' }[];
    actions: { title: string; detail: string }[];
};

/** 店舗別・媒体別で共通のファネル行（グループ名の列名だけが異なる） */
export type FunnelRow = {
    shop?: string;
    medium?: string;
    /** 顧客の居住地（都道府県）。店舗の所在地ではない */
    area?: string;
    /** 顧客の居住地（市区町村） */
    city?: string;
    total: number;
    interviewed: number;
    contracted: number;
    lost: number;
    high_rank: number;
    staff_count: number;
    interview_rate_pct: number;
    contract_rate_pct: number;
    close_rate_pct: number;
    high_rank_pct: number;
    avg_days_to_interview: number | null;
    avg_days_to_contract: number | null;
};

export type FunnelSnapshot = {
    generated_at: string;
    scope: string;
    /** 例: 注文事業 › 鹿児島営業1課。絞り込みが無ければ部門名のみ */
    scope_label?: string;
    note: string;
    overall: OverallContext;
    benchmark?: Benchmark;
    shops?: FunnelRow[];
    media?: FunnelRow[];
    /** 顧客の居住地（都道府県）別。店舗別サマリーにのみ含まれる */
    areas?: FunnelRow[];
    /** 顧客の居住地（市区町村）別。店舗別サマリーにのみ含まれる */
    cities?: FunnelRow[];
};

export type AnySnapshot = InquiryTrendSnapshot | FunnelSnapshot;

export type AnalysisKind = 'inquiry_trend' | 'shop' | 'medium';

type Props = {
    /** 分析の種類。描画するグラフを切り替える */
    type: AnalysisKind;
    snapshot: AnySnapshot;
    analysis: StructuredAnalysis;
};

/** 部門平均との差。+8.2 のように符号付きで返す */
const diffText = (value: number, base: number, unit = '%'): string => {
    const d = Math.round((value - base) * 10) / 10;
    if (d === 0) return `部門平均と同じ`;
    return `部門平均 ${base}${unit}（${d > 0 ? '+' : ''}${d}${unit}）`;
};

// ---------------------------------------------------------------------------
// 共通パーツ
// ---------------------------------------------------------------------------

const StatCard: React.FC<{ label: string; value: string; sub?: string; tone?: 'up' | 'down' | 'flat' }> =
    ({ label, value, sub, tone = 'flat' }) => {
        const toneColor = tone === 'up' ? COLORS.green : tone === 'down' ? COLORS.red : COLORS.dark;
        return (
            <div
                className="h-100 px-3 py-2"
                style={{ border: `1px solid ${COLORS.lightGray}`, borderRadius: '8px', backgroundColor: '#fff' }}
            >
                <div className="text-muted" style={{ fontSize: '11px' }}>{label}</div>
                <div className="fw-bold" style={{ fontSize: '20px', color: toneColor, lineHeight: 1.3 }}>{value}</div>
                {sub !== undefined && <div className="text-muted" style={{ fontSize: '11px' }}>{sub}</div>}
            </div>
        );
    };

const SectionTitle: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
    <div className="mb-1 mt-3">
        <span className="fw-bold" style={{ fontSize: '13px' }}>{children}</span>
        {hint !== undefined && <span className="text-muted ms-2" style={{ fontSize: '11px' }}>{hint}</span>}
    </div>
);

// ---------------------------------------------------------------------------
// 反響推移のグラフ
// ---------------------------------------------------------------------------

const InquiryTrendCharts: React.FC<{ snapshot: InquiryTrendSnapshot }> = ({ snapshot }) => {
    const { totals, monthly, by_medium: byMedium, medium_monthly: mediumMonthly } = snapshot;

    const mom = totals.mom_change_pct;
    const momTone = mom === null ? 'flat' : mom > 0 ? 'up' : mom < 0 ? 'down' : 'flat';

    // 媒体別の月次推移を Recharts 用に「月ごとの1行」へ組み替える
    const months = monthly.map((m) => m.month);
    const mediumChartData = months.map((month) => {
        const row: Record<string, string | number> = { month };
        mediumMonthly.forEach((m) => {
            row[m.medium] = m.monthly.find((x) => x.month === month)?.count ?? 0;
        });
        return row;
    });

    const hasPartial  = monthly.some((m) => m.is_partial);
    const hasMaturing = monthly.some((m) => m.is_maturing);

    return (
        <>
            <div className="row g-2 mb-3">
                <div className="col-6 col-md-3">
                    <StatCard label={`期間合計（${snapshot.period_months}ヶ月）`} value={totals.period_total.toLocaleString()} sub="件" />
                </div>
                <div className="col-6 col-md-3">
                    <StatCard label="月平均（締まった月）" value={totals.closed_month_avg.toLocaleString()} sub="件/月" />
                </div>
                <div className="col-6 col-md-3">
                    <StatCard
                        label="直近の締まった月"
                        value={totals.latest_closed_count !== null ? totals.latest_closed_count.toLocaleString() : '—'}
                        sub={totals.latest_closed_month ?? ''}
                    />
                </div>
                <div className="col-6 col-md-3">
                    <StatCard
                        label="前月比"
                        value={mom !== null ? `${mom > 0 ? '+' : ''}${mom}%` : '—'}
                        sub={totals.prev_closed_count !== null ? `前月 ${totals.prev_closed_count.toLocaleString()}件` : ''}
                        tone={momTone}
                    />
                </div>
            </div>

            <SectionTitle hint="反響を取得した月ごとに、その後どこまで進んだかを追跡">
                取得月別の推移
            </SectionTitle>
            <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                    <LineChart data={monthly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.lightGray} />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke={COLORS.midGray} />
                        <YAxis tick={{ fontSize: 10 }} stroke={COLORS.midGray} />
                        <Tooltip contentStyle={{ fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="count" name="反響数" stroke={CLAUDE_ORANGE} strokeWidth={2} dot={{ r: 2 }} />
                        <Line type="monotone" dataKey="interviewed" name="面談" stroke={COLORS.blue} strokeWidth={1.5} dot={false} />
                        <Line type="monotone" dataKey="contracted" name="契約" stroke={COLORS.green} strokeWidth={1.5} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            {(hasPartial || hasMaturing) && (
                <p className="text-muted mt-1 mb-0" style={{ fontSize: '11px' }}>
                    {hasPartial && '※ 最終月は取得件数がまだ増えるため、前月比の判断には使えません。'}
                    {hasMaturing && '直近3ヶ月は契約までの期間（平均約2ヶ月）が経過していないため、面談・契約の数はこれから増えます。'}
                </p>
            )}

            <SectionTitle>上位媒体の月次推移</SectionTitle>
            <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                    <LineChart data={mediumChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.lightGray} />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke={COLORS.midGray} />
                        <YAxis tick={{ fontSize: 10 }} stroke={COLORS.midGray} />
                        <Tooltip contentStyle={{ fontSize: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        {mediumMonthly.map((m, i) => (
                            <Line key={m.medium} type="monotone" dataKey={m.medium}
                                stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={1.8} dot={false} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <SectionTitle>媒体別 構成（期間合計）</SectionTitle>
            <div style={{ width: '100%', height: Math.max(160, byMedium.length * 26) }}>
                <ResponsiveContainer>
                    <BarChart data={byMedium} layout="vertical" margin={{ top: 0, right: 30, left: 60, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.lightGray} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke={COLORS.midGray} />
                        <YAxis type="category" dataKey="medium" tick={{ fontSize: 10 }} stroke={COLORS.midGray} width={90} />
                        <Tooltip contentStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="count" name="件数" fill={CLAUDE_ORANGE} radius={[0, 3, 3, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </>
    );
};

// ---------------------------------------------------------------------------
// 店舗別・媒体別（ファネル）のグラフ
// ---------------------------------------------------------------------------

/** グラフに載せる件数。多すぎると読めなくなるため上位のみ */
const FUNNEL_DISPLAY_LIMIT = 12;

/**
 * これを下回ったら「母数が小さい」と注意書きを出す件数。
 * 契約日の入力率が2.7%しかないため、数百件あっても契約数は一桁になりうる。
 */
const SMALL_SAMPLE_THRESHOLD = 300;

const FunnelCharts: React.FC<{ snapshot: FunnelSnapshot; type: 'shop' | 'medium' }> = ({ snapshot, type }) => {
    const { overall } = snapshot;
    // 絞り込んでいるときだけ届く。部門全体との比較に使う
    const bench = snapshot.benchmark ?? null;
    const label = type === 'shop' ? '店舗' : '媒体';
    const rows = (type === 'shop' ? snapshot.shops : snapshot.media) ?? [];

    /** グラフ・表で共通に使う形へ整える */
    const toChartRow = (r: FunnelRow, name: string) => ({
        name: name === '' ? '(未設定)' : name,
        total: r.total,
        interview_rate_pct: r.interview_rate_pct,
        close_rate_pct: r.close_rate_pct,
        contract_rate_pct: r.contract_rate_pct,
        days_to_interview: r.avg_days_to_interview ?? 0,
        days_to_contract: r.avg_days_to_contract ?? 0,
        contracted: r.contracted,
        interviewed: r.interviewed,
        staff_count: r.staff_count,
    });

    const data = rows
        .slice(0, FUNNEL_DISPLAY_LIMIT)
        .map((r) => toChartRow(r, (type === 'shop' ? r.shop : r.medium) ?? ''));

    // エリア別は店舗別サマリーにのみ含まれる。
    // 市区町村のほうが粒度が細かく実務で使いやすいため、あれば優先する。
    const cityRows = snapshot.cities ?? [];
    const prefRows = snapshot.areas ?? [];
    const useCities = cityRows.length > 0;
    const areaRows = useCities ? cityRows : prefRows;
    const areaLabel = useCities ? '市区町村' : '都道府県';
    const areaData = areaRows
        .slice(0, FUNNEL_DISPLAY_LIMIT)
        .map((r) => toChartRow(r, (useCities ? r.city : r.area) ?? ''));

    return (
        <>
            <div className="row g-2 mb-3">
                <div className="col-6 col-md-3">
                    <StatCard
                        label="対象顧客数"
                        value={overall.total.toLocaleString()}
                        sub={bench !== null
                            ? `件（部門全体 ${bench.context.total.toLocaleString()}件）`
                            : '件'}
                    />
                </div>
                <div className="col-6 col-md-3">
                    <StatCard
                        label="面談化率（反響→面談）"
                        value={`${overall.interview_rate_pct}%`}
                        // 絞り込み時は件数より「部門平均とどれだけ違うか」が知りたい
                        sub={bench !== null
                            ? diffText(overall.interview_rate_pct, bench.context.interview_rate_pct)
                            : `${overall.interviewed.toLocaleString()}件`}
                        tone={bench === null ? 'flat'
                            : overall.interview_rate_pct >= bench.context.interview_rate_pct ? 'up' : 'down'}
                    />
                </div>
                <div className="col-6 col-md-3">
                    <StatCard
                        label="クロージング率（面談→契約）"
                        value={`${overall.close_rate_pct}%`}
                        sub={bench !== null
                            ? diffText(overall.close_rate_pct, bench.context.close_rate_pct)
                            : `${overall.contracted.toLocaleString()}件`}
                        tone={bench === null ? 'flat'
                            : overall.close_rate_pct >= bench.context.close_rate_pct ? 'up' : 'down'}
                    />
                </div>
                <div className="col-6 col-md-3">
                    <StatCard
                        label="平均リードタイム"
                        value={overall.avg_days_to_contract !== null ? `${overall.avg_days_to_contract}日` : '—'}
                        sub={overall.avg_days_to_interview !== null ? `面談まで ${overall.avg_days_to_interview}日` : ''}
                    />
                </div>
            </div>

            <SectionTitle hint={bench !== null
                ? '点線は絞り込み後の平均。どちらの段階でつまずいているかを見る'
                : '点線は全体平均。どちらの段階でつまずいているかを見る'}>
                {label}別 面談化率とクロージング率
            </SectionTitle>
            <div style={{ width: '100%', height: Math.max(220, data.length * 28) }}>
                <ResponsiveContainer>
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 70, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.lightGray} horizontal={false} />
                        <XAxis type="number" unit="%" tick={{ fontSize: 10 }} stroke={COLORS.midGray} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke={COLORS.midGray} width={100} />
                        <Tooltip contentStyle={{ fontSize: '12px' }} formatter={(v: number) => `${v}%`} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <ReferenceLine x={overall.interview_rate_pct} stroke={CLAUDE_ORANGE} strokeDasharray="4 3" />
                        <ReferenceLine x={overall.close_rate_pct} stroke={COLORS.blue} strokeDasharray="4 3" />
                        <Bar dataKey="interview_rate_pct" name="面談化率" fill={CLAUDE_ORANGE} radius={[0, 3, 3, 0]} />
                        <Bar dataKey="close_rate_pct" name="クロージング率" fill={COLORS.blue} radius={[0, 3, 3, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <SectionTitle hint="反響取得日からの平均日数">{label}別 リードタイム</SectionTitle>
            <div style={{ width: '100%', height: Math.max(200, data.length * 24) }}>
                <ResponsiveContainer>
                    <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 70, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.lightGray} horizontal={false} />
                        <XAxis type="number" unit="日" tick={{ fontSize: 10 }} stroke={COLORS.midGray} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke={COLORS.midGray} width={100} />
                        <Tooltip contentStyle={{ fontSize: '12px' }} formatter={(v: number) => `${v}日`} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Bar dataKey="days_to_interview" name="面談まで" fill={COLORS.green} radius={[0, 3, 3, 0]} />
                        <Bar dataKey="days_to_contract" name="契約まで" fill={COLORS.midGray} radius={[0, 3, 3, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <SectionTitle>{label}別 内訳</SectionTitle>
            <div style={{ overflowX: 'auto' }}>
                <table className="table table-sm mb-0" style={{ fontSize: '11px' }}>
                    <thead>
                        <tr style={{ backgroundColor: COLORS.light }}>
                            <th>{label}</th>
                            <th className="text-end">顧客数</th>
                            <th className="text-end">面談</th>
                            <th className="text-end">契約</th>
                            <th className="text-end">面談化率</th>
                            <th className="text-end">ｸﾛｰｼﾞﾝｸﾞ率</th>
                            <th className="text-end">担当者</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((r) => (
                            <tr key={r.name}>
                                <td>{r.name}</td>
                                <td className="text-end">{r.total.toLocaleString()}</td>
                                <td className="text-end">{r.interviewed.toLocaleString()}</td>
                                <td className="text-end">{r.contracted.toLocaleString()}</td>
                                <td className="text-end" style={{ color: r.interview_rate_pct < overall.interview_rate_pct ? COLORS.red : COLORS.dark }}>
                                    {r.interview_rate_pct}%
                                </td>
                                <td className="text-end" style={{ color: r.close_rate_pct < overall.close_rate_pct ? COLORS.red : COLORS.dark }}>
                                    {r.close_rate_pct}%
                                </td>
                                <td className="text-end">{r.staff_count}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {rows.length > FUNNEL_DISPLAY_LIMIT && (
                <p className="text-muted mt-1 mb-0" style={{ fontSize: '11px' }}>
                    ※ 顧客数の多い上位{FUNNEL_DISPLAY_LIMIT}件を表示しています（分析は全{rows.length}件を対象）。
                </p>
            )}

            {/* エリア別（店舗別サマリーにのみ含まれる） */}
            {areaRows.length > 0 && (
                <>
                    <SectionTitle hint="顧客の居住地。店舗の所在地ではない">
                        エリア別（{areaLabel}）
                    </SectionTitle>
                    <div style={{ width: '100%', height: Math.max(200, areaRows.length * 26) }}>
                        <ResponsiveContainer>
                            <BarChart data={areaData} layout="vertical" margin={{ top: 5, right: 20, left: 70, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.lightGray} horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 10 }} stroke={COLORS.midGray} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke={COLORS.midGray} width={100} />
                                <Tooltip contentStyle={{ fontSize: '12px' }} />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                                <Bar dataKey="total" name="顧客数" fill={COLORS.midGray} radius={[0, 3, 3, 0]} />
                                <Bar dataKey="contracted" name="契約" fill={CLAUDE_ORANGE} radius={[0, 3, 3, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ overflowX: 'auto' }} className="mt-2">
                        <table className="table table-sm mb-0" style={{ fontSize: '11px' }}>
                            <thead>
                                <tr style={{ backgroundColor: COLORS.light }}>
                                    <th>{areaLabel}</th>
                                    <th className="text-end">顧客数</th>
                                    <th className="text-end">面談</th>
                                    <th className="text-end">契約</th>
                                    <th className="text-end">面談化率</th>
                                    <th className="text-end">ｸﾛｰｼﾞﾝｸﾞ率</th>
                                </tr>
                            </thead>
                            <tbody>
                                {areaData.map((r) => (
                                    <tr key={r.name}>
                                        <td>{r.name}</td>
                                        <td className="text-end">{r.total.toLocaleString()}</td>
                                        <td className="text-end">{r.interviewed.toLocaleString()}</td>
                                        <td className="text-end">{r.contracted.toLocaleString()}</td>
                                        <td className="text-end" style={{ color: r.interview_rate_pct < overall.interview_rate_pct ? COLORS.red : COLORS.dark }}>
                                            {r.interview_rate_pct}%
                                        </td>
                                        <td className="text-end" style={{ color: r.close_rate_pct < overall.close_rate_pct ? COLORS.red : COLORS.dark }}>
                                            {r.close_rate_pct}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <p className="text-muted mt-2 mb-0" style={{ fontSize: '11px' }}>
                入力率：面談日 {overall.input_coverage_pct.interview_date}%／契約日 {overall.input_coverage_pct.contract_date}%／
                ランク {overall.input_coverage_pct.customer_rank}%。入力率が低い項目は傾向の参考値としてご覧ください。
            </p>

            {/* 絞り込むと母数が一桁二桁減る。率の差が偶然でも生じることを明示する */}
            {bench !== null && overall.total < SMALL_SAMPLE_THRESHOLD && (
                <p className="text-muted mt-1 mb-0" style={{ fontSize: '11px', color: COLORS.red }}>
                    <i className="fa-solid fa-triangle-exclamation me-1" aria-hidden="true" />
                    対象が{overall.total.toLocaleString()}件と少ないため、率の差は偶然の可能性があります。
                </p>
            )}
        </>
    );
};

// ---------------------------------------------------------------------------
// 本体
// ---------------------------------------------------------------------------

const ASSESSMENT_STYLE: Record<StructuredAnalysis['highlights'][number]['assessment'], { label: string; color: string; bg: string }> = {
    positive: { label: '良好', color: '#4a5c3a', bg: '#eef2e8' },
    negative: { label: '要注意', color: '#8a3a2a', bg: '#fbeeea' },
    neutral: { label: '中立', color: '#5c5a52', bg: '#f0efe9' },
};

const ClaudeAnalysisResult: React.FC<Props> = ({ type, snapshot, analysis }) => (
    <div>
        {/* 総括。どの範囲を集計した結果かを取り違えないよう、範囲を見出しに添える */}
        <div
            className="px-3 py-2 mb-3"
            style={{
                borderLeft: `3px solid ${CLAUDE_ORANGE}`,
                backgroundColor: COLORS.light,
                borderRadius: '0 6px 6px 0',
                fontSize: '13px',
                lineHeight: 1.8,
            }}
        >
            {snapshot.scope_label !== undefined && snapshot.scope_label !== '' && (
                <div className="text-muted mb-1" style={{ fontSize: '11px', lineHeight: 1.4 }}>
                    <i className="fa-solid fa-filter me-1" aria-hidden="true" />
                    {snapshot.scope_label}
                </div>
            )}
            {analysis.headline}
        </div>

        {/* グラフ（数値はすべてDBの集計値） */}
        {type === 'inquiry_trend'
            ? <InquiryTrendCharts snapshot={snapshot as InquiryTrendSnapshot} />
            : <FunnelCharts snapshot={snapshot as FunnelSnapshot} type={type} />}

        {/* 注目すべき指標 */}
        {analysis.highlights.length > 0 && (
            <>
                <SectionTitle>注目すべき指標</SectionTitle>
                <div className="row g-2">
                    {analysis.highlights.map((h, i) => {
                        const style = ASSESSMENT_STYLE[h.assessment];
                        return (
                            <div key={i} className="col-12 col-md-6">
                                <div className="h-100 px-3 py-2"
                                    style={{ border: `1px solid ${COLORS.lightGray}`, borderRadius: '8px', fontSize: '12px' }}>
                                    <div className="d-flex align-items-center gap-2 mb-1">
                                        <span className="fw-bold" style={{ fontSize: '12px' }}>{h.metric}</span>
                                        <span className="px-2 py-1"
                                            style={{ fontSize: '10px', borderRadius: '4px', backgroundColor: style.bg, color: style.color, lineHeight: 1, whiteSpace: 'nowrap' }}>
                                            {style.label}
                                        </span>
                                    </div>
                                    <div className="text-muted" style={{ lineHeight: 1.7 }}>{h.observation}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        )}

        {/* 要因の分析 */}
        {analysis.insights.length > 0 && (
            <>
                <SectionTitle hint="「事実」＝データから確認できる／「推測」＝データでは確認できない">要因の分析</SectionTitle>
                {analysis.insights.map((ins, i) => {
                    const isData = ins.basis === 'data';
                    return (
                        <div key={i} className="px-3 py-2 mb-2"
                            style={{ border: `1px solid ${COLORS.lightGray}`, borderRadius: '8px', fontSize: '12px' }}>
                            <div className="d-flex align-items-center gap-2 mb-1">
                                <span className="px-2 py-1"
                                    style={{
                                        fontSize: '10px', borderRadius: '4px', lineHeight: 1, whiteSpace: 'nowrap',
                                        backgroundColor: isData ? '#e9eff5' : '#f5f1e8',
                                        color: isData ? '#3d5a75' : '#7a6532',
                                    }}>
                                    {isData ? '事実' : '推測'}
                                </span>
                                <span className="fw-bold">{ins.title}</span>
                            </div>
                            <div className="text-muted" style={{ lineHeight: 1.8 }}>{ins.detail}</div>
                        </div>
                    );
                })}
            </>
        )}

        {/* 打ち手 */}
        {analysis.actions.length > 0 && (
            <>
                <SectionTitle>打ち手の提案</SectionTitle>
                {analysis.actions.map((a, i) => (
                    <div key={i} className="px-3 py-2 mb-2 d-flex gap-3"
                        style={{ border: `1px solid ${COLORS.lightGray}`, borderRadius: '8px', fontSize: '12px', backgroundColor: COLORS.light }}>
                        <span className="fw-bold flex-shrink-0" style={{ color: CLAUDE_ORANGE, fontSize: '15px', lineHeight: 1.4 }}>
                            {i + 1}
                        </span>
                        <span>
                            <span className="d-block fw-bold mb-1">{a.title}</span>
                            <span className="d-block text-muted" style={{ lineHeight: 1.8 }}>{a.detail}</span>
                        </span>
                    </div>
                ))}
            </>
        )}
    </div>
);

export default ClaudeAnalysisResult;
