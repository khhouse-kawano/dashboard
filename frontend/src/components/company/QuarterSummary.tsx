import React, { useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';
import { formattedThisMonth, monthFormate } from './companyUtils';

/**
 * 4半期サマリー（会社実績 → 「4半期サマリー」ボタン）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 2026-10-05（v2.2.163）新規。⚠️ 注文事業（category === 'order'）だけ。
 *
 * ⚠️ 表は2つ。⚠️ どちらも 全店舗 → 課 → 店舗 の順に並べる。
 *   契約実績報告 … 予算・実績・差異・前期実績・昨対比・契約予定
 *   反響実績報告 … 総反響・実来場・次アポ・契約（⚠️ 歩留まり付き）
 *
 * ⚠️⚠️ **データの出どころが2つある。**
 *   契約・予算・店舗・課 … ⚠️ **Company.tsx から props で受け取る**（ランキングと同じ）。
 *     ⚠️ 会社実績の画面と**同じ数字**になるよう、契約の判定も Company と揃えてある。
 *   反響 … ⚠️ 既存の `customerTrend`（注文）を**開いたときに1回だけ**取る。
 *     ⚠️ KPI の定義は customerTrend/CustomerTrendOrder.tsx の `getValue` と同じ。
 *     ⚠️⚠️ **あちらの定義を変えたら、ここ（countKpi）も直すこと。**
 *
 * ⚠️⚠️ **期は Company で選んでいる「〇〇年5月期」に合わせる。**
 *   ⚠️ 2027年5月期 = 2026/06 〜 2027/05。
 *   ⚠️ 3Q の 1月・2月は ⚠️ **翌年**（2026/12・2027/01・2027/02）。
 *     ⚠️ 指示書の `{thisYear}/01` を文字どおり読むと年度が前に戻るため、こう解釈した。
 *
 * ⚠️ 見た目は header/GoogleReview.tsx に合わせた（⚠️ 共通CSSを汚さないスコープCSS）。
 * ─────────────────────────────────────────────
 */

type Customer = Record<string, string>;
type Shop = { brand: string; shop: string; section: string; division: string };
type Section = { name: string; division: string };
type Achievement = { category: string; name: string; period: string; value: string };
/** 営業（staff_list）。⚠️ 使う列だけ。⚠️ Company で期（period）を絞ってから渡される */
type Staff = { name: string; shop: string; report: number; status: string };

/** 反響（customerTrend の customer）。⚠️ 使う列だけ */
type Lead = {
    shop: string;
    status: string;
    register: string;
    interview: string;
    appointment: string;
    screening: string;
    contract: string;
};

type Props = {
    show: boolean;
    setShow: (value: boolean) => void;
    /** ⚠️ 期（〇〇年5月期）。⚠️ Company の targetYear をそのまま渡す */
    targetYear: number | null;
    /** ⚠️ Company の customerList（注文・建売・中古が混ざっている）。⚠️ ここで注文だけに絞る */
    customerList: Customer[];
    shopList: Shop[];
    sectionList: Section[];
    achievement: Achievement[];
    /**
     * ⚠️ Company の staffList（⚠️ 選んでいる「〇〇年5月期」の period で絞り済み）。
     * ⚠️ 反響PH・来場PH の分母（営業人数）に使う（v2.2.164）。
     */
    staffList: Staff[];
};

const DIVISION = '注文事業';
/** ⚠️ Company の divisionMapping と同じ。⚠️ 顧客の category は「注文」 */
const CUSTOMER_CATEGORY = '注文';

/** ⚠️ `YYYY-MM`。⚠️ 区切りが `/` でも `-` でも、日付が付いていても揃える */
const ym = (value: string | undefined | null): string => monthFormate(String(value ?? ''));

/** 今月（`YYYY-MM`）。⚠️ これより後の月は「まだ来ていない月」 */
const THIS_MONTH = ym(formattedThisMonth);

/** 前年同月（`YYYY-MM`） */
const lastYearOf = (month: string): string => {
    const [y, m] = month.split('-');
    return `${Number(y) - 1}-${m}`;
};

/** 列の定義。⚠️ 月の列と合計の列を同じ形で扱う */
type Column = {
    key: string;
    label: string;
    kind: 'month' | 'quarter' | 'half' | 'year';
    /** ⚠️ この列が受け持つ月（`YYYY-MM`）。⚠️ 月の列なら1つ */
    months: string[];
};

/**
 * 列を作る。
 *
 * ⚠️ 並び（2026-10-05 の指示）:
 *   1Q(6,7,8月) 1Q合計 | 2Q(9,10,11月) 2Q合計 上半期合計 |
 *   3Q(12,1,2月) 3Q合計 | 4Q(3,4,5月) 4Q合計 下半期合計 〇〇年5月期合計
 */
const buildColumns = (targetYear: number): { columns: Column[]; quarters: { label: string; months: string[] }[] } => {
    const start = targetYear - 1;
    const months: string[] = [];
    for (let i = 0; i < 12; i += 1) {
        // ⚠️ new Date(y, m, 1) で作る（⚠️ 文字列から作ると UTC 解釈で月がずれることがある）
        const d = new Date(start, 5 + i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const quarters = [0, 1, 2, 3].map(q => ({ label: `${q + 1}Q`, months: months.slice(q * 3, q * 3 + 3) }));

    const columns: Column[] = [];
    quarters.forEach((q, index) => {
        q.months.forEach(m => columns.push({ key: m, label: `${Number(m.slice(5))}月`, kind: 'month', months: [m] }));
        columns.push({ key: `${q.label}-total`, label: `${q.label}合計`, kind: 'quarter', months: q.months });
        if (index === 1) columns.push({ key: 'first-half', label: '上半期合計', kind: 'half', months: months.slice(0, 6) });
        if (index === 3) {
            columns.push({ key: 'second-half', label: '下半期合計', kind: 'half', months: months.slice(6) });
            columns.push({ key: 'year', label: `${targetYear}年5月期合計`, kind: 'year', months });
        }
    });
    return { columns, quarters };
};

/** 範囲（店舗の集合）。⚠️ shops が null なら事業全体 */
type Scope = {
    id: string;
    kind: 'division' | 'section' | 'shop';
    label: string;
    sub: string;
    /** ⚠️ 契約・反響を数える店舗。⚠️ null は「注文事業のすべて」 */
    shops: Set<string> | null;
    /** ⚠️ 予算を合計する店舗 */
    budgetShops: Set<string>;
};

/**
 * 契約に数えるか。
 * ⚠️⚠️ **Company.tsx の calculateContractList と同じ判定**（契約済み と 解約）。
 *   ⚠️ 会社実績の「実績」と数字を揃えるため。⚠️ 解約を除きたくなったら両方直す。
 */
const isContracted = (c: Customer): boolean => !!c.contract && (c.status === '契約済み' || c.status === '解約');

/**
 * 反響の KPI を期間でまとめて数える。
 *
 * ⚠️⚠️ **CustomerTrendOrder.tsx の `getValue` と同じ定義。** ⚠️ 期間でまとめて数えるので、
 *   ⚠️ 合計の列でも ⚠️ **同じ顧客を二重に数えない**（月ごとの件数を足すと、
 *   次アポで「2回目面談が9月・事前審査が10月」の人が2回数えられる）。
 *
 *   総反響 … 反響日（register）が期間内
 *   実来場 … 初回面談日が期間内。⚠️ 初回面談が空なら、2回目面談・事前審査・契約のどれかが期間内
 *   次アポ … 初回面談があれば「初回面談が期間内 かつ その先に進んだ」。⚠️ 無ければ上と同じ
 *   契約   … 契約日が期間内 かつ 契約済み／解約
 */
const countKpi = (leads: Lead[], months: Set<string>) => {
    const inP = (v: string) => months.has(ym(v));
    let register = 0;
    let interview = 0;
    let appointment = 0;
    let contract = 0;
    for (const b of leads) {
        if (inP(b.register)) register += 1;
        const later = inP(b.appointment) || inP(b.screening) || inP(b.contract);
        if (b.interview) {
            if (inP(b.interview)) {
                interview += 1;
                if (b.appointment || b.screening || b.contract) appointment += 1;
            }
        } else if (later) {
            interview += 1;
            appointment += 1;
        }
        if (inP(b.contract) && (b.status === '契約済み' || b.status === '解約')) contract += 1;
    }
    return { register, interview, appointment, contract };
};

/** 歩留まり（%）。⚠️ CustomerTrendOrder と同じく**切り捨て**。⚠️ 分母0は null */
const yieldRate = (count: number, base: number): number | null => (base === 0 ? null : Math.floor((count / base) * 100));

/**
 * 1人あたり（PH = per head）。⚠️ 小数第1位まで（⚠️ 四捨五入）。⚠️ 営業0名は「-」
 * ⚠️ 合計列も「その期間の件数 ÷ 人数」（⚠️ 月ごとの PH を足したものではない）。
 */
const perHead = (count: number, staff: number): string => (staff === 0 ? '-' : (count / staff).toFixed(1));

const QuarterSummary = ({ show, setShow, targetYear, customerList, shopList, sectionList, achievement, staffList }: Props) => {
    const [tab, setTab] = useState<'contract' | 'lead'>('contract');
    const [leads, setLeads] = useState<Lead[] | null>(null);
    const [leadError, setLeadError] = useState('');
    const [jump, setJump] = useState('');
    /**
     * 店舗の行を出すか（2026-10-05 の指示）。⚠️ 既定は隠す（全店舗と課だけ）。
     *
     * ⚠️⚠️ **1つの state で全課まとめて開閉する**（⚠️ 指示どおり）。
     *   ⚠️ 課ごとに開閉したくなったら、課の id をキーにした Set に変える。
     * ⚠️ 指示書の「偽の場合は店舗をたたむ」は逆の書き違いと判断した
     *   （⚠️ 真＝店舗を出している＝「店舗をたたむ」を押せる）。
     */
    const [showShops, setShowShops] = useState(false);

    /**
     * 反響は**開いたときに1回だけ**取る。
     * ⚠️ 会社実績を開くたびに取ると、使わない人の分まで重くなる。
     */
    useEffect(() => {
        if (!show || leads !== null) return;
        const fetchData = async () => {
            try {
                const res = await apiClient.post('', { request: 'customerTrend', category: 'order' });
                setLeads((res.data?.customer ?? []) as Lead[]);
            } catch {
                setLeadError('反響を取得できませんでした。時間をおいて再度お試しください。');
                setLeads([]);
            }
        };
        void fetchData();
    }, [show, leads]);

    const year = targetYear ?? 0;
    const { columns, quarters } = useMemo(() => buildColumns(year), [year]);
    const allMonths = useMemo(() => columns.filter(c => c.kind === 'month').map(c => c.key), [columns]);

    /**
     * 範囲の一覧。⚠️ 全店舗 → 課 → その課の店舗。
     *
     * ⚠️ 店舗の行は Company と同じく ⚠️ **FH を出さない**（Company の contractTable と同じ）。
     *   ⚠️ ただし課の合計には ⚠️ **FH も含める**（Company の課の行と同じ。数字を揃えるため）。
     */
    const scopes = useMemo<Scope[]>(() => {
        const divisionShops = shopList.filter(s => s.division === DIVISION);
        const list: Scope[] = [{
            id: 'qs-all',
            kind: 'division',
            label: '全店舗',
            sub: DIVISION,
            shops: null,
            budgetShops: new Set(divisionShops.map(s => s.shop)),
        }];
        sectionList.filter(sec => sec.division === DIVISION).forEach((sec, index) => {
            const shops = divisionShops.filter(s => s.section === sec.name);
            const names = new Set(shops.map(s => s.shop));
            list.push({ id: `qs-sec-${index}`, kind: 'section', label: sec.name, sub: '課', shops: names, budgetShops: names });
            shops.filter(s => !s.shop.includes('FH')).forEach(s => {
                const one = new Set([s.shop]);
                list.push({ id: `qs-shop-${s.shop}`, kind: 'shop', label: s.shop, sub: sec.name, shops: one, budgetShops: one });
            });
        });
        return list;
    }, [shopList, sectionList]);

    /**
     * 範囲ごとの営業人数（v2.2.164）。
     *
     * ⚠️ 数えるのは `report = 1`（全社報告に出す人）かつ ⚠️ **在籍**（2026-10-05 の確認で退職は除く）。
     * ⚠️⚠️ **課・全店舗は氏名で重複を除く。**
     *   ⚠️ 併売スタッフ（例: DJH鹿屋店 と KH鹿屋店）は staff_list に店舗ごとに1行ずつある。
     *   ⚠️ 店舗の行ではその店舗の1人として数え、⚠️ 課・全店舗では1人にまとめる。
     */
    const staffCount = useMemo(() => {
        const active = staffList.filter(st => st.report === 1 && st.status !== '退職');
        const divisionShops = new Set(shopList.filter(s => s.division === DIVISION).map(s => s.shop));
        return new Map(scopes.map(scope => {
            const shops = scope.shops ?? divisionShops;
            return [scope.id, new Set(active.filter(st => shops.has(st.shop)).map(st => st.name)).size];
        }));
    }, [staffList, shopList, scopes]);

    /** ⚠️ 注文の顧客だけ */
    const orderCustomers = useMemo(
        () => customerList.filter(c => c.category === CUSTOMER_CATEGORY),
        [customerList]
    );

    /**
     * 契約実績の月ごとの数（範囲ごと）。
     * ⚠️ 月 → 件数 の形にしてから合計列を作る（⚠️ 顧客を列の数だけ舐め直さない）。
     */
    const contractStats = useMemo(() => {
        const monthSet = new Set(allMonths);
        const lastYearSet = new Set(allMonths.map(lastYearOf));
        return new Map(scopes.map(scope => {
            const inScope = (shop: string) => scope.shops === null || scope.shops.has(shop);
            const actual: Record<string, number> = {};
            const lastYear: Record<string, number> = {};
            const plan: Record<string, number> = {};
            const budget: Record<string, number> = {};

            for (const c of orderCustomers) {
                if (!inScope(c.shop)) continue;
                if (isContracted(c)) {
                    const m = ym(c.contract);
                    if (monthSet.has(m)) actual[m] = (actual[m] ?? 0) + 1;
                    if (lastYearSet.has(m)) lastYear[m] = (lastYear[m] ?? 0) + 1;
                }
                /**
                 * 契約予定。⚠️ Sランク × ランクの予定月（rank_period）。
                 * ⚠️ rank は `customized_input_01J82Z5F366ZQ897PXWF6H5ZAM`（company の SQL で別名）。
                 * ⚠️ ⚠️ **使うのは当月以降の月だけ**（当月より前は契約数を出す。下の planOf）。
                 */
                if (c.rank === 'Sランク') {
                    const m = ym(c.rank_period);
                    if (monthSet.has(m)) plan[m] = (plan[m] ?? 0) + 1;
                }
            }
            for (const a of achievement) {
                if (a.category !== 'shop' || !scope.budgetShops.has(a.name)) continue;
                const m = ym(a.period);
                if (monthSet.has(m)) budget[m] = (budget[m] ?? 0) + Number(a.value || 0);
            }
            return [scope.id, { actual, lastYear, plan, budget }];
        }));
    }, [scopes, orderCustomers, achievement, allMonths]);

    /** 反響の KPI（範囲 × 列）。⚠️ 列ごとに期間でまとめて数える（countKpi の注記参照） */
    const leadStats = useMemo(() => {
        if (leads === null) return null;
        const monthSet = new Set(allMonths);
        // ⚠️ 期のどの日付にも掛からない顧客は先に落とす（⚠️ 全件を列の数だけ舐めないため）
        const relevant = leads.filter(b =>
            [b.register, b.interview, b.appointment, b.screening, b.contract].some(v => monthSet.has(ym(v))));
        return new Map(scopes.map(scope => {
            const own = relevant.filter(b => scope.shops === null || scope.shops.has(b.shop));
            return [scope.id, new Map(columns.map(col => [col.key, countKpi(own, new Set(col.months))]))];
        }));
    }, [leads, scopes, columns, allMonths]);

    const sum = (record: Record<string, number>, months: string[]) =>
        months.reduce((acc, m) => acc + (record[m] ?? 0), 0);

    /** まだ来ていない月を除く */
    const elapsedOf = (months: string[]) => months.filter(m => m <= THIS_MONTH);

    if (targetYear === null) return null;

    const num = (value: number | null | string) => (value === null ? '-' : typeof value === 'number' ? value.toLocaleString() : value);

    // ---------------------------------------------------------------------
    // 見出し（2段）
    // ---------------------------------------------------------------------
    const head = (
        <thead>
            <tr>
                <th className="qs_th qs_th_label" rowSpan={2} colSpan={2}>項目</th>
                {quarters.map((q, index) => (
                    <React.Fragment key={q.label}>
                        <th className="qs_th qs_th_q" colSpan={3}>{q.label}</th>
                        <th className="qs_th qs_th_total" rowSpan={2}>{q.label}合計</th>
                        {index === 1 && <th className="qs_th qs_th_half" rowSpan={2}>上半期合計</th>}
                        {index === 3 && <>
                            <th className="qs_th qs_th_half" rowSpan={2}>下半期合計</th>
                            <th className="qs_th qs_th_year" rowSpan={2}>{targetYear}年5月期合計</th>
                        </>}
                    </React.Fragment>
                ))}
            </tr>
            <tr>
                {columns.filter(c => c.kind === 'month').map(c => (
                    <th key={c.key} className={`qs_th qs_th_month${c.key === THIS_MONTH ? ' is_now' : ''}`}>
                        {c.key.replace('-', '/')}
                    </th>
                ))}
            </tr>
        </thead>
    );

    const cellClass = (col: Column) => `qs_td qs_num qs_col_${col.kind}`;

    /**
     * 左端の範囲（全店舗・課・店舗）のセル。⚠️ 2つの表で共通。
     *
     * ⚠️⚠️ **課の名前の下に「店舗を表示／店舗をたたむ」ボタンを出す**（2026-10-05 の指示）。
     *   ⚠️ どの課のボタンでも ⚠️ **全課まとめて**開閉する（showShops の注記参照）。
     */
    const scopeCell = (scope: Scope, rowSpan: number, table: 'contract' | 'lead') => (
        <td className={`qs_td qs_scope qs_scope_${scope.kind}`} rowSpan={rowSpan} id={`${scope.id}-${table}`}>
            <div className="qs_scope_name">{scope.label}</div>
            <div className="qs_scope_sub">{scope.sub}</div>
            {scope.kind === 'section' && (
                <button
                    type="button"
                    className={`qs_shop_toggle${showShops ? ' is_open' : ''}`}
                    aria-expanded={showShops}
                    onClick={() => setShowShops(prev => !prev)}
                >
                    <i className={`fa-solid ${showShops ? 'fa-chevron-up' : 'fa-chevron-down'} me-1`} aria-hidden="true" />
                    {showShops ? '店舗をたたむ' : '店舗を表示'}
                </button>
            )}
        </td>
    );

    /** ⚠️ 表に出す範囲。⚠️ 店舗の行は showShops のときだけ */
    const visibleScopes = showShops ? scopes : scopes.filter(s => s.kind !== 'shop');

    // ---------------------------------------------------------------------
    // 契約実績報告
    // ---------------------------------------------------------------------
    const contractRows = (scope: Scope) => {
        const s = contractStats.get(scope.id);
        if (!s) return null;

        /**
         * ⚠️ 契約予定: ⚠️ **当月より前は契約数をそのまま**、当月以降は Sランクの数（v2.2.164）。
         * ⚠️ v2.2.163 までは当月も契約数だった（`m > THIS_MONTH`）。⚠️ 当月は月の途中なので予定（Sランク）で見る。
         */
        const planOf = (months: string[]) =>
            months.reduce((acc, m) => acc + (m < THIS_MONTH ? (s.actual[m] ?? 0) : (s.plan[m] ?? 0)), 0);

        const rows: { key: string; label: string; group?: boolean; tone: string; value: (col: Column) => React.ReactNode }[] = [
            { key: 'budget', label: '今期予算', tone: 'budget', value: col => num(sum(s.budget, col.months)) },
            { key: 'actual', label: '実績', group: true, tone: 'actual', value: col => num(sum(s.actual, col.months)) },
            {
                key: 'diff', label: '差異(達成率)', group: true, tone: 'plain',
                value: col => {
                    // ⚠️ 期間がすべて未来の月なら「-」（⚠️ 2026-10-05 の指示）
                    if (elapsedOf(col.months).length === 0) return '-';
                    const actual = sum(s.actual, col.months);
                    const budget = sum(s.budget, col.months);
                    const diff = actual - budget;
                    /**
                     * ⚠️ 達成率 = 実績 ÷ 予算（v2.2.164）。⚠️ 歩留まりと同じく**切り捨て**。⚠️ 予算0は「—」
                     * ⚠️ 分母・分子は差異と**同じ月**で取る（⚠️ 差異と達成率の向きが食い違わないように）。
                     */
                    const rate = yieldRate(actual, budget);
                    return <>
                        <span className={diff > 0 ? 'qs_pos' : diff < 0 ? 'qs_neg' : ''}>{diff > 0 ? `+${diff}` : diff}</span>
                        <div className={`qs_rate${rate === null ? '' : rate >= 100 ? ' qs_pos' : ' qs_neg'}`}>
                            {rate === null ? '—' : `${rate}%`}
                        </div>
                    </>;
                },
            },
            { key: 'last', label: '前期実績', group: true, tone: 'plain', value: col => num(sum(s.lastYear, col.months.map(lastYearOf))) },
            {
                key: 'yoy', label: '昨対比', group: true, tone: 'plain',
                value: col => {
                    /**
                     * ⚠️⚠️ **過ぎた月だけで比べる。**
                     *   ⚠️ 途中の四半期を前期の3か月分と比べると、⚠️ **実際より低く見える。**
                     */
                    const elapsed = elapsedOf(col.months);
                    if (elapsed.length === 0) return '-';
                    const now = sum(s.actual, elapsed);
                    const before = sum(s.lastYear, elapsed.map(lastYearOf));
                    if (before === 0) return '-';
                    const pct = Math.round((now / before) * 100);
                    return <span className={pct >= 100 ? 'qs_pos' : 'qs_neg'}>{pct}%</span>;
                },
            },
            { key: 'plan', label: '契約予定', tone: 'plan', value: col => num(planOf(col.months)) },
        ];

        return rows.map((row, index) => (
            <tr key={`${scope.id}-${row.key}`} className={`qs_row qs_tone_${row.tone}${index === 0 ? ' qs_block_top' : ''}`}>
                {index === 0 && scopeCell(scope, rows.length, 'contract')}
                <td className={`qs_td qs_item${row.group ? ' qs_item_group' : ''}`}>
                    {/* ⚠️ 実績〜昨対比の4行が「今期実績」のまとまり（⚠️ 指示書の rowSpan=4） */}
                    {row.key === 'actual' && <span className="qs_group_tag">今期実績</span>}
                    {row.label}
                </td>
                {columns.map(col => <td key={col.key} className={cellClass(col)}>{row.value(col)}</td>)}
            </tr>
        ));
    };

    // ---------------------------------------------------------------------
    // 反響実績報告
    // ---------------------------------------------------------------------
    const leadRows = (scope: Scope) => {
        const byCol = leadStats?.get(scope.id);
        if (!byCol) return null;
        const staff = staffCount.get(scope.id) ?? 0;

        const rate = (value: number | null) =>
            <div className="qs_rate">{value === null ? '—' : `${value}%`}</div>;

        const rows: { key: string; label: string; note?: string; group?: string; value: (col: Column) => React.ReactNode }[] = [
            { key: 'register', label: '総反響', value: col => num(byCol.get(col.key)?.register ?? 0) },
            {
                key: 'interview', label: '来場', note: '実来場 ÷ 総反響',
                value: col => {
                    const k = byCol.get(col.key);
                    return <>{num(k?.interview ?? 0)}{rate(yieldRate(k?.interview ?? 0, k?.register ?? 0))}</>;
                },
            },
            {
                key: 'appointment', label: '次アポ', note: '次アポ ÷ 実来場',
                value: col => {
                    const k = byCol.get(col.key);
                    return <>{num(k?.appointment ?? 0)}{rate(yieldRate(k?.appointment ?? 0, k?.interview ?? 0))}</>;
                },
            },
            {
                key: 'contract', label: '契約', note: '契約 ÷ 実来場',
                value: col => {
                    const k = byCol.get(col.key);
                    return <>{num(k?.contract ?? 0)}{rate(yieldRate(k?.contract ?? 0, k?.interview ?? 0))}</>;
                },
            },
            /**
             * ⚠️ 1人あたり（v2.2.164）。⚠️ 指示書の「営業 {staffLength}名 row={2}」は、
             *   ⚠️ 契約実績の「今期実績」と同じく ⚠️ **項目の列の小さな見出し**にした
             *   （⚠️ 列を足すと、左に固定している2列の位置がずれるため）。
             */
            {
                key: 'register_ph', label: '反響PH', note: '総反響 ÷ 営業人数', group: `営業 ${staff}名`,
                value: col => perHead(byCol.get(col.key)?.register ?? 0, staff),
            },
            {
                key: 'interview_ph', label: '来場PH', note: '来場 ÷ 営業人数', group: '',
                value: col => perHead(byCol.get(col.key)?.interview ?? 0, staff),
            },
        ];

        return rows.map((row, index) => (
            <tr key={`${scope.id}-${row.key}`}
                className={`qs_row${index === 0 ? ' qs_block_top' : ''}${row.group !== undefined ? ' qs_tone_ph' : ''}${row.group ? ' qs_ph_top' : ''}`}>
                {index === 0 && scopeCell(scope, rows.length, 'lead')}
                <td className={`qs_td qs_item${row.group !== undefined ? ' qs_item_group' : ''}`} title={row.note}>
                    {row.group && <span className="qs_group_tag">{row.group}</span>}
                    {row.label}
                    {row.note && <div className="qs_item_note">{row.note}</div>}
                </td>
                {columns.map(col => <td key={col.key} className={cellClass(col)}>{row.value(col)}</td>)}
            </tr>
        ));
    };

    const jumpTo = (id: string) => {
        setJump(id);
        if (!id) return;
        const scroll = () => document.getElementById(`${id}-${tab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

        /**
         * ⚠️⚠️ **店舗へ移動するときは、店舗を開いてから動く。**
         *   ⚠️ たたんだままだと移動先の行が存在せず、⚠️ **何も起きない**ように見える。
         *   ⚠️ 開いた行が描かれるのを待ってから動かす（⚠️ 同じ描画の中では見つからない）。
         */
        const target = scopes.find(s => s.id === id);
        if (target?.kind === 'shop' && !showShops) {
            setShowShops(true);
            window.setTimeout(scroll, 60);
            return;
        }
        scroll();
    };

    return (
        <Modal show={show} onHide={() => setShow(false)} fullscreen>
            <Modal.Header closeButton className="qs_modal_head">
                <Modal.Title className="qs_modal_title">
                    <i className="fa-solid fa-chart-column me-2" aria-hidden="true" />
                    4半期サマリー
                    {/*
                        ⚠️ 2026-10-05 の指示で、見出しのすぐ右にも「閉じる」を置いた。
                          ⚠️ 全画面だと右上の × が遠く、気づかれにくいため。
                          ⚠️ 右上の × も残してある（⚠️ どちらで閉じても同じ）。
                    */}
                    <button type="button" className="qs_close" onClick={() => setShow(false)}>
                        <i className="fa-solid fa-xmark me-1" aria-hidden="true" />閉じる
                    </button>
                    <span className="qs_modal_sub">{DIVISION} / {targetYear}年5月期（{targetYear - 1}/06〜{targetYear}/05）</span>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="qs_wrap">
                {/* ⚠️ このコンポーネント専用のスタイル。⚠️ 共通CSSを汚さない（GoogleReview と同じ作法） */}
                <style>{`
                    .qs_wrap { font-size: 13px; color: #1f2937; background: #f6f7f9;
                               padding: 16px clamp(16px, 3vw, 40px) 32px; }
                    .qs_modal_head { background: #fff; border-bottom: 1px solid #e5e7eb; }
                    .qs_modal_title { font-size: 16px; font-weight: 700; display: flex; align-items: baseline; gap: 4px; }
                    .qs_modal_sub { font-size: 11px; font-weight: 500; color: #6b7280; margin-left: 10px; }
                    /* ⚠️ 見出しの右の「閉じる」。⚠️ タブと同じ角丸・同じ文字の大きさ */
                    .qs_close { margin-left: 12px; align-self: center; border: 1px solid #d1d5db; background: #fff;
                                color: #374151; font-size: 12px; font-weight: 700; border-radius: 8px;
                                padding: 3px 12px; cursor: pointer; }
                    .qs_close:hover { background: #f3f4f6; }
                    .qs_close:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }

                    .qs_bar { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;
                              background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
                              padding: 10px 14px; margin-bottom: 12px; }
                    .qs_tabs { display: inline-flex; background: #f1f3f6; border-radius: 9px; padding: 3px; }
                    .qs_tab { border: none; background: transparent; padding: 6px 14px; border-radius: 7px;
                              font-size: 12px; font-weight: 700; color: #6b7280; cursor: pointer; }
                    .qs_tab.is_active { background: #fff; color: #1d4ed8; box-shadow: 0 1px 2px rgba(15,23,42,.12); }
                    .qs_tab:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
                    .qs_bar_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                    .qs_legend { margin-left: auto; font-size: 11px; color: #6b7280; display: flex; gap: 12px; flex-wrap: wrap; }
                    .qs_dot { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }

                    .qs_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
                    .qs_card_title { padding: 12px 16px; font-weight: 700; font-size: 14px; border-bottom: 1px solid #eef0f3;
                                     display: flex; align-items: center; gap: 8px; }
                    .qs_card_note { font-size: 11px; font-weight: 500; color: #6b7280; }
                    .qs_table_wrap { overflow: auto; max-height: calc(100vh - 230px); }
                    .qs_table { border-collapse: separate; border-spacing: 0; width: 100%; min-width: 1500px; font-size: 12px; }

                    /* ⚠️ 見出しは2段。⚠️ 1段目の高さを 30px に固定し、2段目を top: 30px で貼る。
                          ⚠️ 片方だけ変えると重なる。⚠️ ここにバッククォートを書かないこと */
                    .qs_th { position: sticky; top: 30px; z-index: 2; background: #f8fafc; color: #4b5563;
                             font-size: 11px; font-weight: 700; text-align: center; white-space: nowrap;
                             padding: 6px 8px; border-bottom: 1px solid #e5e7eb; border-right: 1px solid #f1f5f9; }
                    thead tr:first-child .qs_th { top: 0; height: 30px; box-sizing: border-box; }
                    .qs_th[rowspan] { top: 0; }
                    .qs_th_label { left: 0; z-index: 5; min-width: 190px; }
                    .qs_th_q { background: #eef2ff; color: #3730a3; letter-spacing: .06em; }
                    .qs_th_total { background: #e0e7ff; color: #312e81; }
                    .qs_th_half { background: #dbeafe; color: #1e3a8a; }
                    .qs_th_year { background: #1e3a8a; color: #fff; }
                    .qs_th_month.is_now { color: #1d4ed8; box-shadow: inset 0 -2px 0 #2563eb; }

                    /* ⚠️ v2.2.164: 縦に伸びすぎるため ⚠️ 上下の余白は最小限（6px → 2px、行間 1.25） */
                    .qs_td { padding: 2px 8px; line-height: 1.25; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9;
                             white-space: nowrap; vertical-align: middle; background: #fff; }
                    .qs_num { text-align: right; font-variant-numeric: tabular-nums; min-width: 58px; }
                    .qs_col_quarter { background: #f5f7ff; font-weight: 700; }
                    .qs_col_half { background: #eef4ff; font-weight: 700; }
                    .qs_col_year { background: #e8eefc; font-weight: 700; color: #1e3a8a; }

                    /* ⚠️ 左の2列は横スクロールしても残す */
                    .qs_scope { position: sticky; left: 0; z-index: 1; width: 120px; min-width: 120px; border-right: 1px solid #e5e7eb; }
                    .qs_item { position: sticky; left: 120px; z-index: 1; min-width: 92px; font-weight: 600; color: #374151;
                               border-right: 1px solid #e5e7eb; }
                    .qs_item_group { padding-left: 18px; color: #4b5563; font-weight: 500; }
                    .qs_group_tag { display: block; font-size: 9px; font-weight: 700; color: #1d4ed8; letter-spacing: .04em;
                                    margin-left: -10px; line-height: 1.1; }
                    .qs_item_note { font-size: 9px; font-weight: 500; color: #9ca3af; line-height: 1.1; }
                    .qs_scope_name { font-weight: 700; font-size: 12px; white-space: normal; line-height: 1.3; }
                    .qs_scope_sub { font-size: 10px; color: #6b7280; margin-top: 2px; white-space: normal; }
                    .qs_scope_division { background: #1f2937; color: #f9fafb; }
                    .qs_scope_division .qs_scope_sub { color: #cbd5e1; }
                    .qs_scope_section { background: #eef2ff; }
                    .qs_scope_shop { background: #fafafa; }

                    /* ⚠️ 課の名前の下の開閉ボタン（2026-10-05）。⚠️ 課のセルの地色（#eef2ff）の上に置く */
                    .qs_shop_toggle { margin-top: 6px; border: 1px solid #c7d2fe; background: #fff; color: #3730a3;
                                      font-size: 10px; font-weight: 700; border-radius: 999px; padding: 2px 9px;
                                      cursor: pointer; white-space: nowrap; }
                    .qs_shop_toggle:hover { background: #e0e7ff; }
                    .qs_shop_toggle.is_open { background: #3730a3; border-color: #3730a3; color: #fff; }
                    .qs_shop_toggle:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }

                    .qs_block_top > .qs_td { border-top: 2px solid #e5e7eb; }
                    .qs_tone_budget .qs_num { color: #b91c1c; }
                    .qs_tone_actual .qs_num { color: #1d4ed8; font-weight: 700; }
                    .qs_tone_plan .qs_num { color: #047857; }
                    .qs_pos { color: #047857; font-weight: 700; }
                    .qs_neg { color: #b91c1c; font-weight: 700; }
                    .qs_rate { font-size: 10px; color: #6b7280; line-height: 1.1; }
                    .qs_rate.qs_pos, .qs_rate.qs_neg { font-weight: 600; }
                    /* ⚠️ 反響PH・来場PH（v2.2.164）。⚠️ 件数の行と見分けるため地色を変え、上に区切り線 */
                    .qs_tone_ph > .qs_td:not(.qs_scope) { background: #fbfaf5; }
                    .qs_tone_ph .qs_num { color: #92400e; }
                    .qs_ph_top > .qs_td:not(.qs_scope) { border-top: 1px dashed #e5e7eb; }
                    .qs_row:hover > .qs_td:not(.qs_scope) { background: #f8fafc; }

                    .qs_note { font-size: 11px; color: #6b7280; line-height: 1.8; margin-top: 10px; }
                    .qs_loading { padding: 48px; text-align: center; color: #6b7280; }
                    @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
                `}</style>

                <div className="qs_bar">
                    <div className="qs_tabs" role="tablist" aria-label="表の切り替え">
                        <button type="button" role="tab" aria-selected={tab === 'contract'}
                            className={`qs_tab${tab === 'contract' ? ' is_active' : ''}`} onClick={() => setTab('contract')}>
                            契約実績報告
                        </button>
                        <button type="button" role="tab" aria-selected={tab === 'lead'}
                            className={`qs_tab${tab === 'lead' ? ' is_active' : ''}`} onClick={() => setTab('lead')}>
                            反響実績報告
                        </button>
                    </div>
                    <div>
                        <div className="qs_bar_label">移動</div>
                        <Form.Select size="sm" value={jump} style={{ width: '220px', fontSize: '12px' }}
                            onChange={(e) => jumpTo(e.target.value)}>
                            <option value="">課・店舗へ移動</option>
                            {scopes.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.kind === 'shop' ? `　${s.label}` : s.label}
                                </option>
                            ))}
                        </Form.Select>
                    </div>
                    <div className="qs_legend">
                        {tab === 'contract' ? <>
                            <span><span className="qs_dot" style={{ background: '#b91c1c' }} />予算</span>
                            <span><span className="qs_dot" style={{ background: '#1d4ed8' }} />実績</span>
                            <span><span className="qs_dot" style={{ background: '#047857' }} />契約予定</span>
                        </> : <span>下段の％は歩留まり</span>}
                    </div>
                </div>

                <div className="qs_card">
                    <div className="qs_card_title">
                        {tab === 'contract' ? '契約実績報告' : '反響実績報告'}
                        <span className="qs_card_note">
                            {tab === 'contract'
                                ? '会社実績と同じ判定（契約済み・解約）で数えています'
                                : '販促媒体別反響推移と同じ定義で数えています'}
                        </span>
                    </div>
                    <div className="qs_table_wrap">
                        {tab === 'lead' && leads === null ? (
                            <div className="qs_loading">
                                <div className="spinner-border spinner-border-sm text-primary me-2" role="status" />
                                反響を読み込んでいます…
                            </div>
                        ) : tab === 'lead' && leadError ? (
                            <div className="alert alert-danger m-3" style={{ fontSize: '13px' }}>{leadError}</div>
                        ) : (
                            <table className="qs_table">
                                {head}
                                <tbody>
                                    {visibleScopes.map(scope => (
                                        <React.Fragment key={scope.id}>
                                            {tab === 'contract' ? contractRows(scope) : leadRows(scope)}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div className="qs_note">
                    {tab === 'contract' ? <>
                        ※ 差異は「実績 − 予算」、下段の％は達成率（実績 ÷ 予算、切り捨て）です。まだ来ていない月は「-」です。合計列は期間の実績合計と予算合計から計算しています。<br />
                        ※ 昨対比は、合計列では<b>すでに過ぎた月だけ</b>で今期と前期を比べています（途中の四半期が低く見えないように）。<br />
                        ※ 契約予定は、当月より前の月は契約数をそのまま、当月以降は「Sランク × ランク予定月」の人数です。<br />
                        ※ 店舗の行に FH は出していませんが、課・全店舗の数には含まれます（会社実績と同じ）。
                    </> : <>
                        ※ 来場は実来場（初回面談、初回面談が空なら2回目以降の面談・事前審査・契約）で数えています。<br />
                        ※ 合計列は期間でまとめて数えています（同じお客様を二重に数えません）。歩留まりは合計した件数から計算しています。<br />
                        ※ 反響PH・来場PH は、総反響・来場を営業人数で割った1人あたりの数です。営業人数は {targetYear}年5月期のスタッフ一覧で全社報告に出している在籍者です（課・全店舗は併売スタッフを1人として数えます）。
                    </>}
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default QuarterSummary;
