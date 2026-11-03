import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import AuthContext from '../../../context/AuthContext';
import apiClient from '../../../utils/apiClient';
import LoanRateUpload, { monthLabel } from './LoanRateUpload';

/**
 * 金利データ（v2.2.240）。ヘッダーの「金利データ」（マーケット情報の右）から開く。⚠️ Market.tsx と同じく App.tsx の中に描く（/loanRates）。
 *
 * ⚠️ 中身は Claude デスクトップが毎月集める商圏内の金融機関のプラン別金利（loan_plan_rate）と、その月の分析レポート（analysis_report の category = 'loan_rate'）。
 *   読み出しは ② の loan_plan_rate_list（features/loanPlanRate.ts）、レポートの本文は analysis_report_get。
 * ⚠️ 資金計画書の金利（システム管理 → ローン情報更新。loan_rate）とは別物。
 * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 lr_）。⚠️ 前月比は CSV の prev 列（Claude デスクトップが照合した前月の値）。
 * ⚠️⚠️ レポートは iframe の sandbox に出す（allow-scripts と、出典リンク用の allow-popups 系だけ。⚠️ allow-same-origin を付けるとレポートの中からログイン情報を読める）。
 */

type PlanRow = {
    line: number; g: string; id: string; fi: string; plan: string; rtype: string; term: string; feeType: string; dan: string; cond: string;
    rate: number | null; base: number | null; prev: number | null; asof: string; url: string; conf: string;
};
type MonthInfo = { month: string; rows: number; updated: string };
type ReportInfo = { no: number; title: string; period: string; created: string };
type ListBody = { status?: string; message?: string; month: string; months: MonthInfo[]; rows: PlanRow[]; reports: ReportInfo[] };
type SortKey = 'g' | 'fi' | 'plan' | 'rtype' | 'term' | 'feeType' | 'dan' | 'rate' | 'prev' | 'diff' | 'base' | 'spread';
type Filter = { g: string; fi: string; rtype: string; term: string; feeType: string; dan: string; conf: string; q: string; changed: boolean };

const EMPTY_FILTER: Filter = { g: '', fi: '', rtype: '', term: '', feeType: '', dan: '', conf: '', q: '', changed: false };
const CONF_LABEL: Record<string, string> = { official: '公式', calc: '計算', comparison: '比較サイト' };
/** 差の表示の下限（⚠️ 0.0005 未満は「変わらない」） */
const EPS = 0.0005;

const fmt = (v: number | null): string => (v === null ? '―' : v.toFixed(3));
const diffOf = (r: PlanRow): number | null => (r.rate === null || r.prev === null ? null : r.rate - r.prev);
const spreadOf = (r: PlanRow): number | null => (r.rate === null || r.base === null ? null : r.base - r.rate);
const uniq = (list: string[]): string[] => Array.from(new Set(list.filter((v) => v !== '')));
const termLabel = (t: string): string => (t === '' ? '―' : `${t}年`);

const LoanRates: React.FC = () => {
    const { authority } = useContext(AuthContext);
    const [data, setData] = useState<ListBody | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'plans' | 'report'>('plans');
    const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
    const [sortKey, setSortKey] = useState<SortKey>('rate');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [reportNo, setReportNo] = useState<number | null>(null);
    const [reportHtml, setReportHtml] = useState('');
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState(false);

    const load = useCallback(async (month: string) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post<ListBody>('', { request: 'loan_plan_rate_list', month });
            if (res.data?.status !== 'ok') throw new Error(res.data?.message || '読み込めませんでした');
            setData(res.data);
        } catch (e) {
            console.error('金利データの読み込みに失敗しました:', e);
            setError('金利データを読み込めませんでした。時間をおいて再度お試しください。');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(''); }, [load]);

    const month = data?.month ?? '';
    const rows = useMemo(() => data?.rows ?? [], [data]);
    /** その月のレポート（新しい順）。⚠️ 同じ月を出し直したら新しい方が先 */
    const monthReports = useMemo(
        () => (data?.reports ?? []).filter((r) => r.period === month).sort((a, b) => b.no - a.no),
        [data, month]
    );

    // 月を変えたら、その月のいちばん新しいレポートを選び直す
    useEffect(() => { setReportNo(monthReports[0]?.no ?? null); }, [monthReports]);

    useEffect(() => {
        if (tab !== 'report' || reportNo === null) { setReportHtml(''); return; }
        let alive = true;
        setReportLoading(true);
        setReportError(false);
        apiClient.post('', { request: 'analysis_report_get', no: reportNo })
            .then((res) => {
                if (!alive) return;
                const html = String(res.data?.report?.html ?? '');
                setReportHtml(html);
                setReportError(html === '');
            })
            .catch((e) => { console.error('レポートの読み込みに失敗しました:', e); if (alive) { setReportHtml(''); setReportError(true); } })
            .finally(() => { if (alive) setReportLoading(false); });
        return () => { alive = false; };
    }, [tab, reportNo]);

    const options = useMemo(() => ({
        g: uniq(rows.map((r) => r.g)),
        fi: uniq(rows.filter((r) => filter.g === '' || r.g === filter.g).map((r) => r.fi)),
        rtype: uniq(rows.map((r) => r.rtype)),
        term: uniq(rows.map((r) => r.term)).sort((a, b) => Number(a) - Number(b)),
        feeType: uniq(rows.map((r) => r.feeType)),
        dan: uniq(rows.map((r) => r.dan)),
        conf: uniq(rows.map((r) => r.conf)),
    }), [rows, filter.g]);

    const filtered = useMemo(() => {
        const q = filter.q.trim().toLowerCase();
        return rows.filter((r) =>
            (filter.g === '' || r.g === filter.g) && (filter.fi === '' || r.fi === filter.fi) && (filter.rtype === '' || r.rtype === filter.rtype)
            && (filter.term === '' || r.term === filter.term) && (filter.feeType === '' || r.feeType === filter.feeType)
            && (filter.dan === '' || r.dan === filter.dan) && (filter.conf === '' || r.conf === filter.conf)
            && (!filter.changed || Math.abs(diffOf(r) ?? 0) >= EPS)
            && (q === '' || `${r.fi} ${r.plan} ${r.cond}`.toLowerCase().includes(q)));
    }, [rows, filter]);

    const sorted = useMemo(() => {
        const valueOf = (r: PlanRow): string | number | null => {
            if (sortKey === 'diff') return diffOf(r);
            if (sortKey === 'spread') return spreadOf(r);
            if (sortKey === 'term') return r.term === '' ? null : Number(r.term);
            return r[sortKey];
        };
        const dir = sortOrder === 'asc' ? 1 : -1;
        // ⚠️ 値の無い行（金利が空など）はどちらの向きでも最後
        return [...filtered].sort((a, b) => {
            const x = valueOf(a);
            const y = valueOf(b);
            if (x === null || x === '') return y === null || y === '' ? a.line - b.line : 1;
            if (y === null || y === '') return -1;
            const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ja');
            return c === 0 ? a.line - b.line : c * dir;
        });
    }, [filtered, sortKey, sortOrder]);

    /** KPI（⚠️ 絞り込み後の行で数える） */
    const kpi = useMemo(() => {
        const best = (pred: (r: PlanRow) => boolean) => filtered.filter((r) => pred(r) && r.rate !== null)
            .reduce<PlanRow | null>((min, r) => (min === null || (r.rate as number) < (min.rate as number) ? r : min), null);
        const diffs = filtered.map(diffOf).filter((d): d is number => d !== null);
        return {
            plans: filtered.length,
            fis: uniq(filtered.map((r) => r.fi)).length,
            variable: best((r) => r.rtype === '変動'),
            fixed10: best((r) => r.term === '10' && r.rtype !== '変動'),
            up: diffs.filter((d) => d >= EPS).length,
            down: diffs.filter((d) => d <= -EPS).length,
        };
    }, [filtered]);

    const setF = (patch: Partial<Filter>) => setFilter((prev) => ({ ...prev, ...patch }));

    const SortHead = ({ label, keyName, align = 'left', width }: { label: string; keyName: SortKey; align?: 'left' | 'center' | 'right'; width?: string }) => {
        const active = sortKey === keyName;
        return (
            <th className={`lr_th lr_th_sort text-${align}`} style={{ width }} title="クリックで並べ替え"
                onClick={() => {
                    if (active) setSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(keyName); setSortOrder(keyName === 'rate' || keyName === 'base' ? 'asc' : 'desc'); }
                }}>
                {label}<span className={`lr_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const select = (label: string, key: keyof Omit<Filter, 'q' | 'changed'>, list: string[], width: number, show: (v: string) => string = (v) => v) => (
        <div>
            <div className="lr_label">{label}</div>
            <Form.Select size="sm" value={filter[key]} style={{ width, fontSize: '12px' }}
                onChange={(e) => setF(key === 'g' ? { g: e.target.value, fi: '' } : { [key]: e.target.value } as Partial<Filter>)}>
                <option value="">すべて</option>
                {list.map((v) => <option key={v} value={v}>{show(v)}</option>)}
            </Form.Select>
        </div>
    );

    const bestText = (r: PlanRow | null) => (r === null ? '―' : <>{fmt(r.rate)}<small>%</small><div className="lr_kpi_sub">{r.fi}</div></>);

    return (
        <div className="content">
            <div className="lr_wrap">
                <style>{STYLE}</style>
                <div className="lr_inner">
                    <div className="lr_head mb-2">
                        <span className="lr_title"><i className="fa-solid fa-percent me-2" style={{ color: '#0891b2' }} aria-hidden="true" />金利データ</span>
                        <span className="lr_note">※ 商圏内の金融機関の住宅ローン金利（プラン別）。Claude デスクトップが毎月、各金融機関の公式サイトなどから集めたものです</span>
                    </div>

                    {authority === 'Master' && <LoanRateUpload onSaved={(m) => void load(m)} />}

                    {error !== '' && <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>}

                    <div className="lr_tabs mb-3" role="tablist">
                        <button type="button" role="tab" aria-selected={tab === 'plans'} className={`lr_tab${tab === 'plans' ? ' is_active' : ''}`} onClick={() => setTab('plans')}>
                            <i className="fa-solid fa-table-list me-1" aria-hidden="true" />プラン別金利
                        </button>
                        <button type="button" role="tab" aria-selected={tab === 'report'} className={`lr_tab${tab === 'report' ? ' is_active' : ''}`} onClick={() => setTab('report')}>
                            <i className="fa-solid fa-chart-line me-1" aria-hidden="true" />分析レポート
                        </button>
                        <div className="ms-auto d-flex align-items-center gap-2">
                            <span className="lr_label mb-0">対象月</span>
                            <Form.Select size="sm" value={month} style={{ width: 190, fontSize: '12px' }} disabled={loading || (data?.months.length ?? 0) === 0}
                                onChange={(e) => void load(e.target.value)} aria-label="対象月">
                                {(data?.months ?? []).map((m) => <option key={m.month} value={m.month}>{monthLabel(m.month)}（{m.rows}件）</option>)}
                            </Form.Select>
                        </div>
                    </div>

                    {loading && data === null ? (
                        <div className="text-center py-5"><div className="spinner-border" style={{ color: '#0891b2' }} role="status"><span className="visually-hidden">読み込み中</span></div></div>
                    ) : data !== null && data.months.length === 0 ? (
                        <div className="lr_caution">金利データがまだ登録されていません。</div>
                    ) : tab === 'plans' ? (
                        <>
                            <div className="lr_bar mb-3">
                                {select('区分', 'g', options.g, 150)}
                                {select('金融機関', 'fi', options.fi, 170)}
                                {select('金利タイプ', 'rtype', options.rtype, 130)}
                                {select('固定期間', 'term', options.term, 100, termLabel)}
                                {select('手数料の型', 'feeType', options.feeType, 130)}
                                {select('団信', 'dan', options.dan, 150)}
                                {select('確かさ', 'conf', options.conf, 110, (v) => CONF_LABEL[v] ?? v)}
                                <div>
                                    <div className="lr_label">キーワード</div>
                                    <Form.Control size="sm" value={filter.q} placeholder="金融機関・プラン・条件" style={{ width: 190, fontSize: '12px' }}
                                        onChange={(e) => setF({ q: e.target.value })} />
                                </div>
                                <label className="lr_check">
                                    <input type="checkbox" checked={filter.changed} onChange={(e) => setF({ changed: e.target.checked })} /> 前月から動いたものだけ
                                </label>
                                <button type="button" className="btn btn-sm btn-link lr_clear" onClick={() => setFilter(EMPTY_FILTER)}>絞り込みを外す</button>
                            </div>

                            <div className="lr_kpi mb-3">
                                <div className="lr_kpi_card"><div className="lr_kpi_label">プラン数</div><div className="lr_kpi_value">{kpi.plans.toLocaleString()}<small>件</small><div className="lr_kpi_sub">{kpi.fis}金融機関</div></div></div>
                                <div className="lr_kpi_card"><div className="lr_kpi_label">変動の最も低い金利</div><div className="lr_kpi_value lr_accent">{bestText(kpi.variable)}</div></div>
                                <div className="lr_kpi_card"><div className="lr_kpi_label">10年固定の最も低い金利</div><div className="lr_kpi_value lr_accent">{bestText(kpi.fixed10)}</div></div>
                                <div className="lr_kpi_card"><div className="lr_kpi_label">前月から上がったプラン</div><div className="lr_kpi_value lr_up">{kpi.up}<small>件</small></div></div>
                                <div className="lr_kpi_card"><div className="lr_kpi_label">前月から下がったプラン</div><div className="lr_kpi_value lr_down">{kpi.down}<small>件</small></div></div>
                            </div>

                            <div className="lr_caution mb-2">
                                金利は各金融機関の最も条件の良い優遇後の値です。審査・物件・団信の種類で変わるため、お客様にお伝えする前に必ず公式サイトか窓口で確かめてください。
                                「確かさ」が<b>計算</b>の行は店頭金利と引下げ幅からの計算値、<b>比較サイト</b>の行は比較サイトの値です。前月は Claude デスクトップが前月の同じプランと照合した値です。
                            </div>

                            <div className="lr_table_wrap">
                                <table className="lr_table">
                                    <thead>
                                        <tr>
                                            <SortHead label="区分" keyName="g" width="120px" />
                                            <SortHead label="金融機関" keyName="fi" width="140px" />
                                            <SortHead label="プラン" keyName="plan" />
                                            <SortHead label="タイプ" keyName="rtype" width="100px" />
                                            <SortHead label="期間" keyName="term" align="right" width="64px" />
                                            <SortHead label="手数料の型" keyName="feeType" width="96px" />
                                            <SortHead label="団信" keyName="dan" width="96px" />
                                            <SortHead label="金利" keyName="rate" align="right" width="76px" />
                                            <SortHead label="前月" keyName="prev" align="right" width="70px" />
                                            <SortHead label="差" keyName="diff" align="right" width="72px" />
                                            <SortHead label="店頭" keyName="base" align="right" width="70px" />
                                            <SortHead label="引下げ幅" keyName="spread" align="right" width="84px" />
                                            <th className="lr_th" style={{ width: '86px' }}>確かさ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sorted.length === 0 ? (
                                            <tr><td className="lr_td lr_empty text-center py-4" colSpan={13}>該当するプランがありません</td></tr>
                                        ) : sorted.map((r) => {
                                            const d = diffOf(r);
                                            const s = spreadOf(r);
                                            return (
                                                <tr key={r.line} className="lr_row">
                                                    <td className="lr_td"><span className="lr_tag">{r.g}</span></td>
                                                    <td className="lr_td lr_fi">{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="lr_link" title="出典を開く">{r.fi}</a> : r.fi}</td>
                                                    <td className="lr_td lr_plan"><div>{r.plan}</div>{r.cond && <div className="lr_cond">{r.cond}</div>}</td>
                                                    <td className="lr_td">{r.rtype}</td>
                                                    <td className="lr_td text-end lr_num">{termLabel(r.term)}</td>
                                                    <td className="lr_td">{r.feeType}</td>
                                                    <td className="lr_td">{r.dan}</td>
                                                    <td className="lr_td text-end lr_num lr_rate">{fmt(r.rate)}</td>
                                                    <td className="lr_td text-end lr_num lr_muted">{fmt(r.prev)}</td>
                                                    <td className={`lr_td text-end lr_num ${d === null || Math.abs(d) < EPS ? 'lr_muted' : d > 0 ? 'lr_up' : 'lr_down'}`}>
                                                        {d === null ? '―' : Math.abs(d) < EPS ? '±0' : `${d > 0 ? '+' : ''}${d.toFixed(3)}`}
                                                    </td>
                                                    <td className="lr_td text-end lr_num lr_muted">{fmt(r.base)}</td>
                                                    <td className="lr_td text-end lr_num">{s === null ? '―' : s.toFixed(3)}</td>
                                                    <td className="lr_td"><span className={`lr_conf lr_conf_${r.conf}`}>{CONF_LABEL[r.conf] ?? r.conf}</span>{r.asof && <div className="lr_cond">{r.asof}</div>}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="lr_note mt-1">{sorted.length.toLocaleString()}件を表示（{monthLabel(month)}・全{rows.length.toLocaleString()}件）。並べ替えは見出しをクリック。金融機関名を押すと出典が開きます</div>
                        </>
                    ) : (
                        <div className="lr_report">
                            {monthReports.length === 0 ? (
                                <div className="lr_caution">{monthLabel(month)}の分析レポートはまだ登録されていません。</div>
                            ) : (
                                <>
                                    {monthReports.length > 1 && (
                                        <div className="d-flex align-items-center gap-2 mb-2">
                                            <span className="lr_label mb-0">版</span>
                                            <Form.Select size="sm" value={reportNo ?? ''} style={{ width: 320, fontSize: '12px' }} onChange={(e) => setReportNo(Number(e.target.value))}>
                                                {monthReports.map((r, i) => <option key={r.no} value={r.no}>{r.title}（{r.created}{i === 0 ? '・最新' : ''}）</option>)}
                                            </Form.Select>
                                        </div>
                                    )}
                                    {reportError ? (
                                        <div className="lr_caution">レポートを読み込めませんでした。時間をおいて再度お試しください。</div>
                                    ) : reportLoading || reportHtml === '' ? (
                                        <div className="text-center py-5"><div className="spinner-border" style={{ color: '#0891b2' }} role="status"><span className="visually-hidden">読み込み中</span></div></div>
                                    ) : (
                                        /* ⚠️⚠️ allow-same-origin は付けないこと（付けるとレポートの中からログイン情報を読める）。
                                           ⚠️ allow-popups 系は、台帳の出典リンク（target="_blank"）を別タブで開くため。開いた先は普通のページとして開く */
                                        <iframe title={`金利分析レポート ${monthLabel(month)}`} className="lr_iframe" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcDoc={reportHtml} />
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/** ⚠️ このコンポーネント専用（接頭辞 lr_）。⚠️ 登録欄（LoanRateUpload.tsx）もこのスタイルを使う */
const STYLE = `
.lr_wrap { font-size: 13px; color: #1f2937; padding: 16px 24px 24px; box-sizing: border-box; }
.lr_inner { width: 100%; max-width: 1500px; margin: 0 auto; }
.lr_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.lr_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
.lr_note { font-size: 11px; color: #6b7280; }
.lr_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
.lr_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
.lr_check { font-size: 12px; color: #374151; display: flex; align-items: center; gap: 4px; padding-bottom: 5px; cursor: pointer; }
.lr_clear { font-size: 11px; padding-bottom: 5px; color: #0891b2; }
.lr_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
.lr_kpi_card { flex: 1 1 170px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
.lr_kpi_label { font-size: 11px; color: #6b7280; }
.lr_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.lr_kpi_value small { font-size: 11px; font-weight: 400; color: #6b7280; margin-left: 2px; }
.lr_kpi_sub { font-size: 11px; font-weight: 400; color: #6b7280; }
.lr_accent { color: #0e7490; }
.lr_up { color: #b91c1c; } .lr_down { color: #1d4ed8; }
.lr_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; }
.lr_tabs { display: flex; align-items: flex-end; gap: 4px; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
.lr_tab { border: 1px solid transparent; border-bottom: none; background: none; padding: 7px 14px; font-size: 12px; font-weight: 700; color: #6b7280; border-radius: 8px 8px 0 0; margin-bottom: -1px; }
.lr_tab:hover { color: #0e7490; }
.lr_tab.is_active { color: #0e7490; background: #fff; border-color: #e5e7eb; box-shadow: inset 0 2px 0 #0891b2; }
.lr_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; max-height: calc(100vh - 220px); min-height: 320px; }
.lr_table { width: 100%; min-width: 1280px; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.lr_plan { min-width: 260px; }
.lr_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
.lr_th_sort { cursor: pointer; user-select: none; }
.lr_th_sort:hover { background: #eef2f7; }
.lr_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
.lr_sort_icon.is_active { color: #0891b2; }
.lr_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; }
.lr_row:hover > .lr_td { background: #f8fafc; }
.lr_fi { font-weight: 700; }
.lr_num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.lr_rate { font-size: 13px; font-weight: 700; color: #0e7490; }
.lr_muted { color: #9ca3af; }
.lr_cond { font-size: 10px; color: #9ca3af; margin-top: 1px; }
.lr_tag { font-size: 10px; color: #4b5563; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.lr_conf { font-size: 10px; border-radius: 999px; padding: 1px 7px; white-space: nowrap; background: #f3f4f6; color: #4b5563; }
.lr_conf_official { background: #cffafe; color: #155e75; }
.lr_conf_comparison { background: #fef3c7; color: #92400e; }
.lr_link { color: #1f2937; text-decoration: none; }
.lr_link:hover { color: #0891b2; text-decoration: underline; }
.lr_empty { color: #9ca3af; font-size: 12px; }
.lr_iframe { width: 100%; height: calc(100vh - 190px); min-height: 480px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
.lr_upload { background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 10px; padding: 10px 12px; }
.lr_upload_head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.lr_upload_title { font-size: 12px; font-weight: 700; color: #155e75; }
.lr_badge { font-size: 9px; color: #fff; background: #0d6efd; border-radius: 4px; padding: 1px 5px; }
.lr_upload_row { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
.lr_field { display: flex; flex-direction: column; margin: 0; }
.lr_btn { background: #0891b2; border-color: #0891b2; color: #fff; font-size: 12px; font-weight: 700; padding: 4px 18px; }
.lr_btn:hover:not(:disabled) { background: #0e7490; color: #fff; }
.lr_btn:disabled { background: #94a3b8; border-color: #94a3b8; color: #fff; }
.lr_error { font-size: 11px; color: #b91c1c; }
.lr_ok { font-size: 11px; color: #047857; font-weight: 700; }
`;

export default LoanRates;
