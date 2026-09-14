import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import apiClient from '../../utils/apiClient';
import { getYearMonthArray } from '../../utils/getYearMonthArray';
import {
    DIVISION_LABEL, KPI_DEFS, applyBudget, applyCount, applyUnit,
    countKpis, filterCustomers, sumBudget, toNumber, unitPrice,
} from './budgetSimulatorUtils';
import type { Division, SimBudget, SimCustomer, SimRow, SimShop } from './budgetSimulatorUtils';

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
    budget: SimBudget[];
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

    /** 期間・店舗で絞った顧客 */
    const customers = useMemo(
        () => (current ? filterCustomers(current.customer, months, targetShops) : []),
        [current, months, targetShops]
    );

    /**
     * 販促媒体の一覧。
     * ⚠️ マスタではなく**実データ**（sales_promotion_name）から作る。
     *   マスタから作ると、その期間に1件も無い媒体まで並んで読みにくい。
     * ⚠️ 空文字は「その他」としてまとめる。媒体未設定の反響が消えると
     *   媒体別の合計が全体と合わなくなる。
     */
    const mediums = useMemo(() => {
        const seen = new Set<string>();
        customers.forEach(c => seen.add(c.medium || 'その他'));
        return [...seen].sort();
    }, [customers]);

    /** 実績（書き換え前の値）。キーは '' が全体、それ以外は媒体名 */
    const actual = useMemo<Record<string, SimRow>>(() => {
        if (!current) return {};
        const out: Record<string, SimRow> = {
            '': {
                budget: sumBudget(current.budget, months, targetShops),
                counts: countKpis(targetDivision, customers),
            },
        };
        mediums.forEach(m => {
            const list = customers.filter(c => (c.medium || 'その他') === m);
            out[m] = {
                // ⚠️ 「その他」に budget.medium = '' の分を寄せる。顧客側と揃えるため
                budget: sumBudget(current.budget, months, targetShops, m === 'その他' ? '' : m),
                counts: countKpis(targetDivision, list),
            };
        });
        return out;
    }, [current, months, targetShops, customers, mediums, targetDivision]);

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

    /** 1ブロック分の表。全体も媒体別も同じ形で出す */
    const renderBlock = (key: string, label: string) => {
        const row = rowOf(key);
        const base = actual[key];
        const edit = isEdited(key);

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
                            <th className="bg-light" style={{ width: '130px' }}>広告費総額</th>
                            {kpis.map(k => (
                                <th key={k.key} className="bg-light text-center" style={{ width: '150px' }}>
                                    {/* ⚠️ 色は shop/unitPriceSeries.ts と同じ。工程の進み方が読めるようにしている */}
                                    <span style={{ borderLeft: `4px solid ${k.color}`, paddingLeft: '6px' }}>{k.label}</span>
                                </th>
                            ))}
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
                                        実績 {yen(base.budget)}
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
                                            実績 {base.counts[k.key].toLocaleString()}件
                                        </div>
                                    )}
                                </td>
                            ))}
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
                                                実績 {yen(baseUnit)}
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
                    実績の数字を書き換えると試算になります（保存はされません）
                </span>
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

                    <div className="fw-bold mb-2 mt-4" style={{ fontSize: '13px' }}>
                        販促媒体別
                        <span className="text-muted ms-2" style={{ fontSize: '11px' }}>
                            {/* ⚠️ 媒体別の合計は全体と一致しないことがある。理由を書いておく */}
                            ※ 広告費が媒体に紐づいていない分は全体にのみ含まれます
                        </span>
                    </div>
                    {mediums.length === 0
                        ? <div className="text-muted" style={{ fontSize: '12px' }}>この期間に反響がありません</div>
                        : mediums.map(m => renderBlock(m, m))}
                </>
            )}
        </div>
    );
};

export default BudgetSimulator;
