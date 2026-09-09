import React, { useContext, useEffect, useMemo, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Table from 'react-bootstrap/Table';
import apiClient from '../../utils/apiClient';
import AuthContext from '../../context/AuthContext';
import InformationEdit from '../information/InformationEdit';

/**
 * 集客サマリー。
 *
 * ─────────────────────────────────────────────
 * イベントごとのファネルと、KPI 1件あたりの広告費を並べる。
 *
 * ⚠️ 集計は Express（backend-express/src/features/eventSummary.ts）で行う。
 *   master_data は約24,600行あり、ブラウザへ全件持ってきて filter する作りには
 *   していない。イベント名の突き合わせ規則もサーバ側のコメントを参照。
 * ─────────────────────────────────────────────
 */

interface EventSummaryRow {
    id: number;
    title: string;
    startDate: string;
    endDate: string;
    inquiry: number;
    valid: number;
    visit: number;
    appo: number;
    contract: number;
    /** 広告費の合計（円）。⚠️ 0 や負もありうる */
    budget: number;
}

/** 顧客一覧モーダルの1行。⚠️ サーバの EventCustomerRow と揃えること */
interface EventCustomer {
    id: string;
    customer: string;
    shop: string;
    staff: string;
    register: string;
    visit: string;
    appo: string;
    contract: string;
    status: string;
}

/** 広告費を出す対象のKPI列。⚠️「反響数以下」なので反響数も含む */
type KpiKey = 'inquiry' | 'valid' | 'visit' | 'appo' | 'contract';

/**
 * 顧客一覧を開ける KPI。
 *
 * ⚠️ 反響数（inquiry）は含めない。反響は event_db（イベント予約フォーム）の
 *   申し込みで、master_data の顧客ではない。顧客詳細を開く id が無い。
 */
type DrillKey = Exclude<KpiKey, 'inquiry'>;

const DRILL_KEYS: DrillKey[] = ['valid', 'visit', 'appo', 'contract'];

const isDrillable = (key: KpiKey): key is DrillKey =>
    (DRILL_KEYS as string[]).includes(key);

const KPI_COLUMNS: { key: KpiKey; label: string }[] = [
    { key: 'inquiry', label: '反響数' },
    { key: 'valid', label: '有効名簿数' },
    { key: 'visit', label: '店舗来場者数' },
    { key: 'appo', label: '次アポ数' },
    { key: 'contract', label: '契約者数' },
];

/**
 * ソートの基準。
 *
 * ⚠️ 'id' は画面上の「No」列に対応する。No は表示上の連番だが、
 *   並べ替えの基準は event_calendar.id（イベントの登録順）である。
 */
type SortKey = 'id' | 'title' | 'startDate' | KpiKey;

/**
 * KPI 1件あたりの広告費。
 *
 * ⚠️ 「小数第一位で切り上げて整数表示」＝ Math.ceil（要件どおり）。
 *   端数を切り捨てると実際より安く見えるため、切り上げにしている。
 *
 * ⚠️ null を返す条件（画面では '-' にする）
 *   ・KPI が 0 … 0除算。Infinity になる
 *   ・広告費が未登録（0）… 「¥0/件」と出ると実績値と誤読される。
 *     ⚠️ budget.note の表記整備が済むまでは 0 円のイベントが多い。
 *       0 を数字として出すと「広告費をかけずに反響が取れた」と読めてしまう。
 *   ・広告費が負 … budget_value には返金・修正の負伝票があり、
 *     合計が負になりうる。単価として意味を持たない
 *   ・数値にならない … NaN / Infinity
 */
export const costPerUnit = (budget: number, kpi: number): number | null => {
    if (!Number.isFinite(budget) || !Number.isFinite(kpi)) return null;
    if (budget <= 0) return null;
    if (kpi <= 0) return null;

    const value = Math.ceil(budget / kpi);
    return Number.isFinite(value) ? value : null;
};

/**
 * 同じ列の中での相対的な高さ（0＝最安、1＝最高）。
 *
 * ⚠️⚠️ 固定のしきい値で色分けしない。「反響1件あたり何円までなら安い」の
 *   基準が社内に無く、勝手に決めると誤った判断材料になる。
 *   列内の順位で色を付ければ、基準を決めずに「この中では高い／安い」が分かる。
 *
 * ⚠️ 値が1種類しかない列は比較にならないので null（色を付けない）。
 */
const ratioIn = (values: number[], value: number): number | null => {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return null;
    return (value - min) / (max - min);
};

/** 安い＝緑、高い＝赤。⚠️ 文字は常に読めるよう背景を薄くする */
const costStyle = (ratio: number | null): React.CSSProperties => {
    if (ratio === null) return { color: '#6c757d' };
    // 0（安い）→ 120deg 緑 / 1（高い）→ 0deg 赤
    const hue = Math.round(120 * (1 - ratio));
    return {
        backgroundColor: `hsl(${hue}, 70%, 92%)`,
        color: `hsl(${hue}, 65%, 28%)`,
        fontWeight: 600,
    };
};

const yen = (value: number): string => `¥${value.toLocaleString('ja-JP')}`;

/** 'YYYY-MM-DD' → 'YYYY/MM/DD'。⚠️ 空文字はそのまま返す（'-' は呼び出し側で） */
const dateFormate = (date: string): string => (date ? date.replace(/-/g, '/') : '');

const styles = {
    th: {
        fontSize: '12px',
        fontWeight: 'bold' as const,
        color: '#4a5568',
        whiteSpace: 'nowrap' as const,
        cursor: 'pointer',
        userSelect: 'none' as const,
        // ⚠️ 見出しを固定するので、スクロールした文字が透けないよう背景を敷く
        backgroundColor: '#f8f9fa',
        position: 'sticky' as const,
        top: 0,
        zIndex: 1,
    },
    td: { fontSize: '12px', color: '#303030', verticalAlign: 'middle' as const },
};

/** モーダルの見出しに出すKPI名 */
const KPI_LABEL: Record<DrillKey, string> = {
    valid: '有効名簿',
    visit: '店舗来場者',
    appo: '次アポ',
    contract: '契約者',
};

const PER_PAGE = 20;

const EventSummary: React.FC = () => {
    const { token, authority } = useContext(AuthContext);

    const [rows, setRows] = useState<EventSummaryRow[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    /** ⚠️ 初期は id の降順（要件） */
    const [sortKey, setSortKey] = useState<SortKey>('id');
    const [asc, setAsc] = useState(false);

    /** 顧客一覧モーダル */
    const [drill, setDrill] = useState<{ title: string; kpi: DrillKey } | null>(null);
    const [customers, setCustomers] = useState<EventCustomer[] | null>(null);
    const [drillError, setDrillError] = useState('');
    const [page, setPage] = useState(1);

    /** 顧客詳細（一覧のお客様名クリックで開く） */
    const [editId, setEditId] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiClient.post('', { request: 'event_summary' });
                setRows(Array.isArray(response.data?.rows) ? response.data.rows : []);
            } catch (e) {
                // ⚠️ 黙って空表にしない。② が落ちているのか0件なのかを区別できなくなる
                console.error('集客サマリーの取得に失敗しました', e);
                setError('集計の取得に失敗しました。時間をおいて再度お試しください。');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    /** 列ごとの広告費の一覧。色分けの基準に使う（'-' の行は含めない） */
    const costsByColumn = useMemo(() => {
        const map = {} as Record<KpiKey, number[]>;
        for (const { key } of KPI_COLUMNS) {
            map[key] = rows
                .map((r) => costPerUnit(r.budget, r[key]))
                .filter((v): v is number => v !== null);
        }
        return map;
    }, [rows]);

    const sorted = useMemo(() => {
        const sign = asc ? 1 : -1;
        return [...rows].sort((a, b) => {
            if (sortKey === 'title') {
                // ⚠️ localeCompare は使わない。ロケールによって記号の扱いが変わる
                if (a.title === b.title) return 0;
                return a.title < b.title ? -sign : sign;
            }
            if (sortKey === 'startDate') {
                if (a.startDate === b.startDate) return 0;
                return a.startDate < b.startDate ? -sign : sign;
            }
            const av = a[sortKey];
            const bv = b[sortKey];
            if (av === bv) return 0;
            return av < bv ? -sign : sign;
        });
    }, [rows, sortKey, asc]);

    const toggleSort = (key: SortKey) => {
        if (key === sortKey) {
            setAsc(!asc);
            return;
        }
        setSortKey(key);
        // ⚠️ 数値と日付は「多い／新しい順」から見たいので降順で始める。
        //   イベント名だけは五十音順（昇順）のほうが探しやすい
        setAsc(key === 'title');
    };

    const arrow = (key: SortKey): string => (sortKey === key ? (asc ? ' ▲' : ' ▼') : '');

    const openDrill = async (title: string, kpi: DrillKey) => {
        setDrill({ title, kpi });
        // ⚠️ 前回の一覧を消してから取りに行く。残っていると別イベントの
        //   顧客が一瞬表示される
        setCustomers(null);
        setDrillError('');
        setPage(1);
        try {
            const response = await apiClient.post('', {
                request: 'event_summary',
                roll: 'detail',
                title,
                kpi,
            });
            setCustomers(Array.isArray(response.data?.customers) ? response.data.customers : []);
        } catch (e) {
            console.error('顧客一覧の取得に失敗しました', e);
            setDrillError('顧客一覧の取得に失敗しました。');
            setCustomers([]);
        }
    };

    const closeDrill = () => {
        setDrill(null);
        setCustomers(null);
        setDrillError('');
    };

    if (loading) {
        return <div className="text-muted text-center py-4" style={{ fontSize: '13px' }}>読み込み中…</div>;
    }

    if (error !== '') {
        return <div className="text-danger text-center py-4" style={{ fontSize: '13px' }}>{error}</div>;
    }

    if (rows.length === 0) {
        return (
            <div className="text-muted text-center py-4" style={{ fontSize: '13px' }}>
                対象のイベントがありません。<br />
                {/* ⚠️ 条件を書いておく。0件のとき何を確認すればよいか分かるように */}
                イベントカレンダーで「全社（khg）」かつ公開中のイベントが対象です。
            </div>
        );
    }

    const totalPage = customers === null ? 1 : Math.max(1, Math.ceil(customers.length / PER_PAGE));
    const pageRows = customers === null ? [] : customers.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    return (
        <div style={{ height: '100%', overflow: 'auto' }}>
            {/* ⚠️ モーダルの幅いっぱいに広げない。表の端が枠に張り付いて窮屈に見えるため、
                90% 幅で中央に置き、左右に余白を作る。
                ⚠️ 幅を固定値（px）にしないこと。列が増えたときに収まらなくなる */}
            <div className="mx-auto py-4" style={{ width: '90%' }}>
                <div className="pb-2 text-muted" style={{ fontSize: '11px', lineHeight: 1.6 }}>
                    各KPIの下段は<strong>KPI 1件あたりの広告費</strong>です。列の中で相対的に安いほど緑、高いほど赤で表示します。
                    <br />
                    {/* ⚠️ '-' の意味を必ず書く。0円と区別できないと誤読される */}
                    広告費が未登録・KPIが0件の場合は「-」になります。
                    <br />
                    有効名簿数・店舗来場者数・次アポ数・契約者数は、<strong>1以上の数字をクリック</strong>すると該当の顧客を一覧できます。
                </div>

                <Table bordered hover size="sm" className="mb-0" style={{ tableLayout: 'auto' }}>
                    <thead>
                        <tr>
                            {/* ⚠️ No は表示上の連番だが、並べ替えの基準は event_calendar.id */}
                            <th style={styles.th} onClick={() => toggleSort('id')}>No{arrow('id')}</th>
                            <th style={styles.th} onClick={() => toggleSort('title')}>イベント名{arrow('title')}</th>
                            <th style={styles.th} onClick={() => toggleSort('startDate')}>開催期間{arrow('startDate')}</th>
                            {KPI_COLUMNS.map(({ key, label }) => (
                                <th key={key} style={{ ...styles.th, textAlign: 'right' }} onClick={() => toggleSort(key)}>
                                    {label}{arrow(key)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((row, index) => (
                            <tr key={row.id}>
                                {/* ⚠️⚠️ No は event_calendar.id ではなく**表示上の連番**（要件）。
                                    並べ替えると 1 から振り直される */}
                                <td style={styles.td}>{index + 1}</td>
                                <td style={styles.td}>{row.title}</td>
                                <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                                    {/* ⚠️ 単日開催は同じ日付が2つ並ぶので1つにまとめる */}
                                    {row.startDate === row.endDate
                                        ? row.startDate
                                        : `${row.startDate}〜${row.endDate}`}
                                </td>
                                {KPI_COLUMNS.map(({ key }) => {
                                    const kpi = row[key];
                                    const cost = costPerUnit(row.budget, kpi);
                                    const ratio = cost === null ? null : ratioIn(costsByColumn[key], cost);
                                    // ⚠️ 0件のときはクリックできない。空の一覧を開くだけになる
                                    const canDrill = isDrillable(key) && kpi >= 1;
                                    return (
                                        <td key={key} style={{ ...styles.td, textAlign: 'right', padding: '4px 6px' }}>
                                            {canDrill ? (
                                                <div
                                                    style={{
                                                        textDecoration: 'underline dotted',
                                                        cursor: 'pointer',
                                                        fontVariantNumeric: 'tabular-nums',
                                                        // ⚠️ 右寄せのまま下線を数字の幅に収める
                                                        width: 'fit-content',
                                                        marginLeft: 'auto',
                                                    }}
                                                    onClick={() => openDrill(row.title, key)}
                                                    title={`${row.title} の${KPI_LABEL[key]} ${kpi}件を表示`}
                                                >
                                                    {kpi}
                                                </div>
                                            ) : (
                                                <div style={{ fontVariantNumeric: 'tabular-nums' }}>{kpi}</div>
                                            )}
                                            <div
                                                style={{
                                                    ...costStyle(ratio),
                                                    fontSize: '11px',
                                                    fontVariantNumeric: 'tabular-nums',
                                                    borderRadius: '3px',
                                                    marginTop: '2px',
                                                    padding: '0 3px',
                                                }}
                                            >
                                                {cost === null ? '-' : yen(cost)}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>

            {/* 顧客一覧。⚠️ RankOrder.tsx の「案件詳細」と同じ作りに寄せている */}
            <Modal show={drill !== null} onHide={closeDrill} size="xl">
                <Modal.Header closeButton>
                    <Modal.Title style={{ fontSize: '15px' }}>
                        {drill === null ? '' : `${drill.title}　${KPI_LABEL[drill.kpi]}`}
                        {customers !== null && (
                            <span className="text-muted ms-2" style={{ fontSize: '12px' }}>
                                {customers.length}件
                            </span>
                        )}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {drillError !== '' ? (
                        <div className="text-danger text-center py-3" style={{ fontSize: '13px' }}>{drillError}</div>
                    ) : customers === null ? (
                        <div className="text-center mt-1 w-100">
                            <i className="fa-solid fa-arrows-rotate pointer spinning me-1"></i>Loading...
                        </div>
                    ) : customers.length === 0 ? (
                        <div className="text-muted text-center py-3" style={{ fontSize: '13px' }}>
                            該当する顧客がありません。
                        </div>
                    ) : (
                        <>
                            <Table bordered striped style={{ fontSize: '11px' }} className="align-middle">
                                <tbody>
                                    <tr>
                                        <td>No</td>
                                        <td>店舗</td>
                                        <td>担当営業</td>
                                        <td>お客様名</td>
                                        <td>ステータス</td>
                                        <td>反響日</td>
                                        <td>店舗来場日</td>
                                        <td>次アポ日</td>
                                        <td>契約日</td>
                                    </tr>
                                    {pageRows.map((item, index) => (
                                        <tr key={item.id}>
                                            <td>{(page - 1) * PER_PAGE + index + 1}</td>
                                            <td>{item.shop}</td>
                                            <td>{item.staff}</td>
                                            <td>
                                                <div
                                                    style={{ textDecoration: 'underline dotted', cursor: 'pointer', width: 'fit-content' }}
                                                    onClick={() => setEditId(item.id)}
                                                >
                                                    {/* 契約済みは冠を付ける（RankOrder と同じ表現） */}
                                                    {item.contract !== '' && <i className="fa-solid fa-crown pe-1"></i>}
                                                    {item.customer}
                                                </div>
                                            </td>
                                            <td>{item.status}</td>
                                            <td>{dateFormate(item.register)}</td>
                                            <td>{dateFormate(item.visit)}</td>
                                            <td>{dateFormate(item.appo)}</td>
                                            <td>{dateFormate(item.contract)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                            {/* ⚠️ 1ページに収まるときはページ送りを出さない */}
                            {totalPage > 1 && (
                                <div className="d-flex justify-content-around align-items-center" style={{ fontSize: '12px' }}>
                                    <div
                                        className="text-primary"
                                        style={{ cursor: page > 1 ? 'pointer' : 'default' }}
                                        onClick={() => page > 1 && setPage(page - 1)}
                                    >
                                        {page > 1 && `前の${PER_PAGE}件`}
                                    </div>
                                    <div className="text-muted">{page} / {totalPage}</div>
                                    <div
                                        className="text-primary"
                                        style={{ cursor: page < totalPage ? 'pointer' : 'default' }}
                                        onClick={() => page < totalPage && setPage(page + 1)}
                                    >
                                        {page < totalPage && `次の${PER_PAGE}件`}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </Modal.Body>
            </Modal>

            {/* ⚠️ 顧客詳細。閉じたら id を空にするだけで、一覧は開いたままにする
                （続けて別の顧客を見たいため） */}
            <InformationEdit id={editId} token={token} onClose={() => setEditId('')} authority={authority} />
        </div>
    );
};

export default EventSummary;
