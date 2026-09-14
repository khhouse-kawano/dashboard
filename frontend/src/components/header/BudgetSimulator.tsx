import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import apiClient from '../../utils/apiClient';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import {
    DIVISION_LABEL, HP_ROW, KPI_DEFS, applyBudget, applyCount, applyUnit,
    countKpis, filterCustomers, lastYearMonth, matchesMedium, mediumRows,
    requiredBudget, sumAchievement, sumBudget, toNumber, unitPrice,
} from './budgetSimulatorUtils';
import type { Division, KpiKey, SimBudget, SimCustomer, SimMedium, SimRow, SimShop } from './budgetSimulatorUtils';

/**
 * 広告費シミュレーター。
 *
 * ─────────────────────────────────────────────
 * 2つのことを1画面でやる。
 *
 *   (1) **いくらかけて、どれだけの結果が出たのか**（実績）
 *   (2) **いくら投下したら、どれだけ得られるのか**（試算）
 *
 *   (1) を入力欄に出し、そのまま書き換えると (2) になる、という作りである。
 *   別々の画面にすると「実績がいくらだったか」を見ながら試算できない。
 *
 * ⚠️⚠️ **KPI の判定は budgetSimulatorUtils.ts に置き、
 *   shop/ShopOrder.tsx・ShopKaeru.tsx と同じにしてある。**
 *   食い違うと店舗ランキングと数字が合わず、どちらが正しいか分からなくなる。
 *
 * ⚠️ 連動の規則（`単価 = 広告費 ÷ 件数` を常に保つ）
 *     広告費を変える … 単価を保ち、4つの件数が比例して動く
 *     単価を変える   … 広告費を保ち、その件数が `広告費 ÷ 単価` になる
 *     件数を変える   … 広告費を保ち、単価が自動で変わる
 *   ⚠️ 単価は state に持たない。3つを別々に持つとすぐ辻褄が合わなくなる。
 *
 * ⚠️ 試算はこの画面の中だけで完結する。**保存もDBへの書き込みも無い。**
 *   閉じれば消える。
 * ─────────────────────────────────────────────
 */

type DivisionData = {
    shop: SimShop[];
    section: { name: string }[];
    customer: SimCustomer[];
    medium: SimMedium[];
    budget: SimBudget[];
    achievement: { name: string; period: string; value: string }[];
};

/** ⚠️ 他の画面と同じく 2025/01 から */
const monthArray = getYearMonthArray(2025, 1);

/** レンダリング時の 'YYYY/MM'。⚠️ 期間の初期値（開始・終了とも同じ月） */
const currentMonth = (): string => {
    const now = new Date();
    return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const yen = (v: number | null): string => (v === null ? '-' : `¥${v.toLocaleString()}`);

const BudgetSimulator = () => {
    const [data, setData] = useState<Record<Division, DivisionData> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [targetDivision, setTargetDivision] = useState<Division>('order');
    const [targetSection, setTargetSection] = useState('');
    const [targetShop, setTargetShop] = useState('');

    const initialMonth = currentMonth();
    const [startMonth, setStartMonth] = useState(initialMonth);
    const [endMonth, setEndMonth] = useState(initialMonth);

    /**
     * 利用者が書き換えた値。
     * ⚠️ キーは '' が全体、それ以外は販促媒体名。
     * ⚠️ 条件（事業・期間・店舗）を変えたら**必ず捨てる。**
     *   別の条件の試算が残っていると、実績と噛み合わない数字が並ぶ。
     */
    const [edited, setEdited] = useState<Record<string, SimRow>>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiClient.post('', { request: 'budget_simulator' });
                setData({ order: res.data.order, spec: res.data.spec });
            } catch (e) {
                // ⚠️ 応答が大きい request なので、転送のタイムアウトでもここに来る
                setError('データを取得できませんでした。時間をおいて再度お試しください。');
            } finally {
                setLoading(false);
            }
        };
        void fetchData();
    }, []);

    const current = data ? data[targetDivision] : null;

    /** 表示対象の年月。⚠️ 開始 > 終了なら空になる（行も0件になる） */
    const months = useMemo(() => {
        const s = monthArray.indexOf(startMonth);
        const e = monthArray.indexOf(endMonth);
        if (s < 0 || e < 0) return [];
        return monthArray.slice(s, e + 1);
    }, [startMonth, endMonth]);

    /** 課の一覧。⚠️ section_list（マスタ）を使う。店舗の登録状況に依存させない */
    const sectionOptions = useMemo(
        () => (current?.section ?? []).map(s => s.name).filter(Boolean),
        [current]
    );

    /** 店舗の選択肢。⚠️ 管理用の擬似店舗は出さない（他画面と同じ） */
    const shopOptions = useMemo(
        () => (current?.shop ?? [])
            .filter(s => !s.shop?.includes('未設定') && !s.shop?.includes('全店舗'))
            .filter(s => !targetSection || s.section === targetSection),
        [current, targetSection]
    );

    /**
     * 集計対象の店舗名。
     * ⚠️ null は「絞らない」。空配列（該当店舗なし）と区別するため null にしている。
     */
    const targetShops = useMemo<string[] | null>(() => {
        if (targetShop) return [targetShop];
        if (targetSection) return shopOptions.map(s => s.shop);
        return null;
    }, [targetShop, targetSection, shopOptions]);

    /**
     * 広告費を見る期間。
     * ⚠️⚠️ **KPI とは1年ずれる。** 広告費は1年前、KPI は選択期間そのもの。
     *   「昨年これだけかけた → 今これだけ取れている」を並べるため（指示）。
     */
    const lastYearMonths = useMemo(() => months.map(lastYearMonth), [months]);

    /** 選択期間・店舗で絞った顧客（＝**当期の実績**。グレーで併記する） */
    const customers = useMemo(
        () => (current ? filterCustomers(current.customer, months, targetShops) : []),
        [current, months, targetShops]
    );

    /**
     * 1年前の顧客（＝**試算の出発点**）。
     *
     * ─────────────────────────────────────────────
     * ⚠️⚠️ **KPI 単価は「昨年の広告費 ÷ 昨年の件数」である**（2026-09-14 の指示）。
     *   当期の件数を分母にすると、期の途中では件数が少ないぶん
     *   **単価が跳ね上がり**、試算の基準として使えない。
     *
     * ⚠️⚠️ そのため入力欄の初期値は**広告費・件数とも昨年**で揃えてある。
     *   `単価 = 広告費 ÷ 件数` という恒等式でシミュレーションが回っており、
     *   単価だけ昨年に差し替えると**画面の3つの数字が噛み合わなくなる**
     *   （広告費 ÷ 件数 が表示中の単価と一致しない）。
     *
     * ⚠️ 当期の実績は各セルの下にグレーで併記する。入力欄には入れない。
     * ─────────────────────────────────────────────
     */
    const lastYearCustomers = useMemo(
        () => (current ? filterCustomers(current.customer, lastYearMonths, targetShops) : []),
        [current, lastYearMonths, targetShops]
    );

    /** 対象事業の店舗名。⚠️ 契約目標を事業で絞るのに使う */
    const divisionShopNames = useMemo(
        () => (current?.shop ?? []).map(s => s.shop),
        [current]
    );

    /** 契約目標（選択期間・対象店舗の合計） */
    const contractTarget = useMemo(
        () => (current ? sumAchievement(current.achievement ?? [], months, targetShops, divisionShopNames) : 0),
        [current, months, targetShops, divisionShopNames]
    );

    /**
     * 販促媒体の行。
     * ⚠️⚠️ **マスタから作る**（2026-09-14 の指示）。事業ごとに別テーブルで、
     *   建売は「ホームページ反響計」が先頭に付く（budgetSimulatorUtils.ts 参照）。
     */
    const mediums = useMemo(
        () => (current ? mediumRows(targetDivision, current.medium ?? []) : []),
        [current, targetDivision]
    );

    /**
     * 試算の出発点（書き換え前の値）。キーは '' が全体、それ以外は媒体の行。
     * ⚠️⚠️ **広告費も件数も1年前で揃える。** 単価が「昨年 ÷ 昨年」になるようにするため
     *   （lastYearCustomers のコメント参照）。
     */
    const actual = useMemo<Record<string, SimRow>>(() => {
        if (!current) return {};
        const out: Record<string, SimRow> = {
            '': {
                budget: sumBudget(current.budget, lastYearMonths, targetShops),
                counts: countKpis(targetDivision, lastYearCustomers),
            },
        };
        mediums.forEach(m => {
            const list = lastYearCustomers.filter(c => matchesMedium(targetDivision, c, m, mediums));
            out[m] = {
                budget: sumBudget(current.budget, lastYearMonths, targetShops, m, mediums),
                counts: countKpis(targetDivision, list),
            };
        });
        return out;
    }, [current, lastYearMonths, targetShops, lastYearCustomers, mediums, targetDivision]);

    /**
     * 当期の実績件数。
     * ⚠️ **表示専用。** 入力欄には入れない（入れると単価の分母が当期になり、
     *   「昨年 ÷ 昨年」という指示から外れる）。
     */
    const currentCounts = useMemo<Record<string, Record<KpiKey, number>>>(() => {
        const out: Record<string, Record<KpiKey, number>> = {
            '': countKpis(targetDivision, customers),
        };
        mediums.forEach(m => {
            out[m] = countKpis(
                targetDivision,
                customers.filter(c => matchesMedium(targetDivision, c, m, mediums))
            );
        });
        return out;
    }, [customers, mediums, targetDivision]);

    /**
     * 契約目標を達成するために必要な広告費。
     * ⚠️ 単価は「昨年の広告費 ÷ 昨年の契約数」。
     *   ⚠️ 2026-09-14 に画面の単価も同じ基準になったため、**契約単価と一致する。**
     *     以前は画面の単価だけ分母が当期で、別物だった。
     */
    const neededBudget = useMemo(() => {
        const base = actual[''];
        return requiredBudget(base?.budget ?? 0, base?.counts.contract ?? 0, contractTarget);
    }, [actual, contractTarget]);

    /**
     * 媒体の並び順。
     * ⚠️ 既定は**総反響の降順**（指示）。件数が多い媒体から見たいため。
     * ⚠️ 実績ではなく**表示中の値**（試算を含む）で並べる。
     *   書き換えた結果が並びに反映されないと、並べ替えの意味が分かりにくい。
     */
    const [sortKey, setSortKey] = useState<KpiKey>('register');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    /**
     * ⚠️ 条件が変わったら試算を捨てる。
     *   残すと、いま見えている実績とは別の条件の数字が並ぶ。
     */
    useEffect(() => {
        setEdited({});
    }, [targetDivision, targetSection, targetShop, startMonth, endMonth]);

    /** 表示する値。書き換えがあればそちら、無ければ実績 */
    const rowOf = useCallback(
        (key: string): SimRow => edited[key] ?? actual[key] ?? { budget: 0, counts: { register: 0, interview: 0, appointment: 0, contract: 0 } },
        [edited, actual]
    );

    const update = (key: string, next: SimRow) => setEdited(prev => ({ ...prev, [key]: next }));

    const isEdited = (key: string) => edited[key] !== undefined;

    const kpis = KPI_DEFS[targetDivision];

    /** 並べ替え済みの媒体 */
    const sortedMediums = useMemo(() => {
        const arr = [...mediums];
        arr.sort((a, b) => {
            // ⚠️ 「ホームページ反響計」は媒体ではなく寄せ集めの行なので常に先頭に置く
            //   （CustomerTrendKaeru.tsx と同じ並び）。並べ替えの対象にしない
            if (a === HP_ROW || b === HP_ROW) return a === HP_ROW ? -1 : 1;
            const va = rowOf(a).counts[sortKey];
            const vb = rowOf(b).counts[sortKey];
            // ⚠️ 同数なら媒体名で安定させる。並びが毎回変わると読みにくい
            if (va === vb) return a.localeCompare(b, 'ja');
            return sortOrder === 'asc' ? va - vb : vb - va;
        });
        return arr;
    }, [mediums, rowOf, sortKey, sortOrder]);

    /** 昨年の期間ラベル。⚠️ 入力欄が1年前であることを見出しに出す */
    const lastYearLabel = lastYearMonths.length > 0
        ? `${lastYearMonths[0]}～${lastYearMonths[lastYearMonths.length - 1]}`
        : '-';

    /** 選択期間のラベル。⚠️ グレーの併記がこの期間であることを示す */
    const currentLabel = months.length > 0
        ? `${months[0]}～${months[months.length - 1]}`
        : '-';

    /** 1ブロック分の表。全体も媒体別も同じ形で出す */
    const renderBlock = (key: string, label: string) => {
        const row = rowOf(key);
        const base = actual[key];
        const now = currentCounts[key];
        const edit = isEdited(key);
        /** ⚠️ 契約目標は店舗単位。媒体別には割り振れないので全体の表にだけ出す */
        const isTotal = key === '';

        return (
            <div key={key || '__total__'} className="mb-4">
                <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="fw-bold" style={{ fontSize: '13px' }}>{label}</span>
                    {edit && (
                        <>
                            <span className="badge bg-warning text-dark" style={{ fontSize: '10px' }}>試算中</span>
                            {/* ⚠️ 実績に戻せるようにする。戻せないと元の数字が分からなくなる */}
                            <Button
                                size="sm"
                                variant="outline-secondary"
                                style={{ fontSize: '10px', padding: '1px 8px' }}
                                onClick={() => setEdited(prev => {
                                    const next = { ...prev };
                                    delete next[key];
                                    return next;
                                })}
                            >実績に戻す</Button>
                        </>
                    )}
                </div>

                <Table bordered hover className="mb-0 align-middle" style={{ fontSize: '12px' }}>
                    <thead className="bg-light">
                        <tr>
                            {/* ⚠️ 入力欄は1年前。見出しに期間を出して取り違えを防ぐ */}
                            <th className="bg-light" style={{ width: '150px' }}>
                                {lastYearLabel}<br />広告費総額
                            </th>
                            {kpis.map(k => (
                                <th key={k.key} className="bg-light text-center" style={{ width: '150px' }}>
                                    {/* ⚠️ 色は shop/unitPriceSeries.ts と同じ。工程の進み方が読めるようにしている */}
                                    <span style={{ borderLeft: `4px solid ${k.color}`, paddingLeft: '6px' }}>{k.label}</span>
                                </th>
                            ))}
                            {/* ⚠️ 契約は2列。実績（左）と目標（右）を並べる。全体のときだけ出す
                                   （目標は店舗単位なので、媒体別には割り振れない） */}
                            {isTotal && (
                                <th className="bg-light text-center" style={{ width: '170px' }}>
                                    <span style={{ borderLeft: '4px solid #b07aa1', paddingLeft: '6px' }}>契約目標</span>
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td rowSpan={2} style={{ verticalAlign: 'middle' }}>
                                <Form.Control
                                    size="sm"
                                    style={{ fontSize: '12px', textAlign: 'right' }}
                                    value={row.budget.toLocaleString()}
                                    onChange={(e) => update(key, applyBudget(row, toNumber(e.target.value)))}
                                />
                                {base && (
                                    <div className="text-muted mt-1" style={{ fontSize: '10px' }}>
                                        昨年実績 {yen(base.budget)}
                                    </div>
                                )}
                            </td>
                            {kpis.map(k => (
                                <td key={k.key} className="text-center">
                                    <Form.Control
                                        size="sm"
                                        style={{ fontSize: '12px', textAlign: 'right' }}
                                        value={row.counts[k.key].toLocaleString()}
                                        onChange={(e) => update(key, applyCount(row, k.key, toNumber(e.target.value)))}
                                    />
                                    {base && (
                                        <div className="text-muted mt-1" style={{ fontSize: '10px' }}>
                                            昨年 {base.counts[k.key].toLocaleString()}件
                                        </div>
                                    )}
                                    {/* ⚠️ 当期の実績。入力欄（昨年）とは別の期間なのでラベルで分ける */}
                                    {now && (
                                        <div className="text-primary" style={{ fontSize: '10px' }}>
                                            当期 {now[k.key].toLocaleString()}件
                                        </div>
                                    )}
                                </td>
                            ))}
                            {isTotal && (
                                <td rowSpan={2} className="text-center" style={{ verticalAlign: 'middle' }}>
                                    <div className="fw-bold" style={{ fontSize: '16px' }}>
                                        {contractTarget.toLocaleString()}件
                                    </div>
                                    <div className="text-muted mt-2" style={{ fontSize: '10px' }}>
                                        達成に必要な広告費
                                    </div>
                                    <div className="fw-bold text-danger" style={{ fontSize: '13px' }}>
                                        {yen(neededBudget)}
                                    </div>
                                    <div className="text-muted mt-1" style={{ fontSize: '9px', lineHeight: 1.3 }}>
                                        ※左の契約単価 × 目標
                                    </div>
                                </td>
                            )}
                        </tr>
                        <tr>
                            {kpis.map(k => {
                                const unit = unitPrice(row.budget, row.counts[k.key]);
                                const baseUnit = base ? unitPrice(base.budget, base.counts[k.key]) : null;
                                return (
                                    <td key={k.key} className="text-center">
                                        <div className="text-muted mb-1" style={{ fontSize: '10px' }}>{k.unitLabel}</div>
                                        <Form.Control
                                            size="sm"
                                            style={{ fontSize: '12px', textAlign: 'right' }}
                                            value={unit === null ? '' : unit.toLocaleString()}
                                            placeholder="-"
                                            onChange={(e) => update(key, applyUnit(row, k.key, toNumber(e.target.value)))}
                                        />
                                        {base && (
                                            <div className="text-muted mt-1" style={{ fontSize: '10px' }}>
                                                昨年実績 {yen(baseUnit)}
                                            </div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </Table>
            </div>
        );
    };

    return (
        // ⚠️ 余白はここで付ける。Header.tsx の全画面モーダルの Modal.Body は p-0
        //   （縦を使い切るため）で、何も付けないと端に貼り付いて読みにくい。
        //   ⚠️ Header.tsx 側に足すと他の全画面メニューにも効くので触らない。
        <div className="py-3 px-5">
            <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
                <span className="fw-bold" style={{ fontSize: '14px' }}>
                    <i className="fa-solid fa-calculator me-2 text-primary" aria-hidden="true" />
                    広告費シミュレーター
                </span>
                <span className="text-muted" style={{ fontSize: '11px' }}>
                    {/* ⚠️ 保存されないことを明記する。試算を入力して閉じると消えるため */}
                    数字を書き換えると試算になります（保存はされません）
                </span>
            </div>

            {/* ⚠️⚠️ **入力欄と併記が別の期間である**ことを必ず出す。
                   これが無いと「当期の広告費」と読まれ、必ず取り違えられる */}
            <div className="d-flex align-items-start gap-2 px-3 py-2 mb-3 border rounded bg-white" style={{ fontSize: '11px' }}>
                <i className="fa-solid fa-circle-info mt-1 text-secondary" aria-hidden="true" />
                <div style={{ lineHeight: 1.6 }}>
                    <span className="fw-bold">入力欄＝昨年実績（{lastYearLabel}）</span>
                    <span className="text-muted ms-1">
                        … 試算の出発点。KPI単価は「昨年の広告費 ÷ 昨年の件数」です
                    </span>
                    <br />
                    <span className="fw-bold text-primary">当期＝{currentLabel}</span>
                    <span className="text-muted ms-1">
                        … 各件数の下に併記しています。試算には使いません
                    </span>
                </div>
            </div>

            {/* 絞り込み。⚠️ 上部にまとめて置く */}
            <div className="d-flex align-items-end gap-2 flex-wrap px-3 py-2 mb-3 bg-light border rounded">
                <div>
                    <Form.Label className="text-muted mb-1 fw-bold" style={{ fontSize: '11px' }}>事業区分</Form.Label>
                    <Form.Select
                        size="sm" value={targetDivision} style={{ width: '160px', fontSize: '12px' }}
                        onChange={(e) => {
                            // ⚠️ 事業が変われば課も店舗も別物になる。必ず外す
                            setTargetSection('');
                            setTargetShop('');
                            setTargetDivision(e.target.value as Division);
                        }}
                    >
                        {(Object.keys(DIVISION_LABEL) as Division[]).map(d =>
                            <option key={d} value={d}>{DIVISION_LABEL[d]}</option>)}
                    </Form.Select>
                </div>
                <div>
                    <Form.Label className="text-muted mb-1 fw-bold" style={{ fontSize: '11px' }}>営業課</Form.Label>
                    <Form.Select
                        size="sm" value={targetSection} style={{ width: '180px', fontSize: '12px' }}
                        onChange={(e) => { setTargetShop(''); setTargetSection(e.target.value); }}
                    >
                        <option value="">すべて</option>
                        {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </Form.Select>
                </div>
                <div>
                    <Form.Label className="text-muted mb-1 fw-bold" style={{ fontSize: '11px' }}>店舗</Form.Label>
                    <Form.Select
                        size="sm" value={targetShop} style={{ width: '180px', fontSize: '12px' }}
                        onChange={(e) => setTargetShop(e.target.value)}
                    >
                        <option value="">すべて</option>
                        {shopOptions.map(s => <option key={s.shop} value={s.shop}>{s.shop}</option>)}
                    </Form.Select>
                </div>
                <div>
                    <Form.Label className="text-muted mb-1 fw-bold" style={{ fontSize: '11px' }}>開始月</Form.Label>
                    <Form.Select
                        size="sm" value={startMonth} style={{ width: '120px', fontSize: '12px' }}
                        onChange={(e) => setStartMonth(e.target.value)}
                    >
                        {monthArray.map(m => <option key={m} value={m}>{m}</option>)}
                    </Form.Select>
                </div>
                <span className="pb-1">～</span>
                <div>
                    <Form.Label className="text-muted mb-1 fw-bold" style={{ fontSize: '11px' }}>終了月</Form.Label>
                    <Form.Select
                        size="sm" value={endMonth} style={{ width: '120px', fontSize: '12px' }}
                        onChange={(e) => setEndMonth(e.target.value)}
                    >
                        {monthArray.map(m => <option key={m} value={m}>{m}</option>)}
                    </Form.Select>
                </div>
                {Object.keys(edited).length > 0 && (
                    <Button
                        size="sm" variant="outline-secondary" className="ms-auto"
                        style={{ fontSize: '12px' }}
                        onClick={() => setEdited({})}
                    >
                        <i className="fa-solid fa-rotate-left me-1" aria-hidden="true" />すべて実績に戻す
                    </Button>
                )}
            </div>

            {error !== '' && (
                <div className="alert alert-danger d-flex align-items-start gap-2" style={{ fontSize: '13px' }}>
                    <i className="fa-solid fa-triangle-exclamation mt-1" aria-hidden="true" />
                    <span className="flex-grow-1">{error}</span>
                </div>
            )}

            {/* ⚠️ 開始 > 終了 のときは黙って0件にせず理由を出す */}
            {months.length === 0 && error === '' && !loading && (
                <div className="alert alert-warning" style={{ fontSize: '13px' }}>
                    開始月が終了月より後になっています。期間を選び直してください。
                </div>
            )}

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">読み込み中</span>
                    </div>
                </div>
            ) : (
                <>
                    {renderBlock('', `${DIVISION_LABEL[targetDivision]} 全体`)}

                    <div className="d-flex align-items-center gap-2 flex-wrap mb-2 mt-4">
                        <span className="fw-bold" style={{ fontSize: '13px' }}>販促媒体別</span>
                        {/* ⚠️ 並べ替えは媒体ブロックの順序。既定は総反響の降順（指示） */}
                        <span className="text-muted" style={{ fontSize: '11px' }}>並べ替え</span>
                        <Form.Select
                            size="sm" value={sortKey} style={{ width: '130px', fontSize: '12px' }}
                            onChange={(e) => setSortKey(e.target.value as KpiKey)}
                        >
                            {kpis.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                        </Form.Select>
                        <Form.Select
                            size="sm" value={sortOrder} style={{ width: '100px', fontSize: '12px' }}
                            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                        >
                            <option value="desc">多い順</option>
                            <option value="asc">少ない順</option>
                        </Form.Select>
                        <span className="text-muted ms-2" style={{ fontSize: '11px' }}>
                            {/* ⚠️⚠️ 媒体別の合計は全体と一致しない。マスタに載っていない媒体
                                   （注文なら list_medium = 0 のもの、未設定の反響）は
                                   どの行にも入らないため。黙って合わないと不具合に見える */}
                            ※ 媒体別の合計は全体と一致しません（マスタに登録されていない媒体は
                            {targetDivision === 'order' ? '行になりません' : 'ホームページ反響計に入ります'}）
                        </span>
                    </div>
                    {sortedMediums.length === 0
                        ? (
                            <div className="alert alert-warning" style={{ fontSize: '12px' }}>
                                {/* ⚠️ 建売で show_graph 列が無いとここに来る。原因が分かる文面にする */}
                                表示対象の販促媒体が登録されていません。
                                {targetDivision === 'order'
                                    ? '（medium_list の list_medium）'
                                    : '（medium_kaeru の show_graph）'}
                                をご確認ください。
                            </div>
                        )
                        : sortedMediums.map(m => renderBlock(m, m))}
                </>
            )}
        </div>
    );
};

export default BudgetSimulator;
