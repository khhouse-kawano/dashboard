import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';

/**
 * 営業別の契約率（ヘッダー → 日報 → 営業別契約率）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ データは ② の `staff_contract`（features/staffContract.ts）。
 *   ⚠️⚠️ **① に PHP ハンドラは無い。** ⚠️ ② が落ちるとこの画面は動かない。
 *
 * ⚠️⚠️ **契約数の列が2つあるのは誤りではない。**
 *
 *   ⚠️ **契約数（商談）** … 商談顧客の中で契約済みのもの。⚠️ **契約率の分子。**
 *   ⚠️ **契約数（顧客DB）** … 顧客情報の担当営業で数えたもの。
 *     ⚠️ ⚠️ **商談ステップを入力しない営業がいる**ため、
 *       ⚠️ 商談側だけだと**その人の契約が丸ごと0に見える。**
 *
 *   ⚠️⚠️ **顧客DB側で率を出さないこと。** ⚠️ 商談顧客数と母集団が違う。
 *
 * ⚠️⚠️ **担当変更理由の8列（2026-10-02 追加）は、左の契約率とは別の集計。**
 *   ⚠️ 突合キーは ⚠️⚠️ **担当変更前の営業**（`master_data.first_interviewed_user`）。
 *     ⚠️ ⚠️ **「初回面談をした人」ではない。** ⚠️ 旧CRMから引き継いだ命名である。
 *   ⚠️ 期間は ⚠️⚠️ **反響取得日**で見る（⚠️ 左の列は商談日・契約日）。
 *   ⚠️ ⚠️ **同じ行に並んでいても足し引きできる数字ではない。** ⚠️ 画面に注記を出すこと。
 *
 * ⚠️ 見た目は GoogleReview.tsx に合わせてある（⚠️ 並べ替えは見出しクリック）。
 * ⚠️ モーダルは ⚠️⚠️ **全画面**（Header.tsx の一覧に入れてある）。
 *   ⚠️ ⚠️ **閉じるボタンは Modal.Header が出すので、ここには作らないこと。** 二重になる。
 * ─────────────────────────────────────────────
 */

type Row = {
    name: string;
    /** ⚠️ 複数ブランドに登録されている人は `/` でつながっている */
    shop: string;
    section: string;
    talk: number;
    next: number;
    /**
     * 契約数。⚠️⚠️ **顧客DBの `status = 契約済み` を現担当で数えたもの。**
     *   ⚠️ 商談ログでは数えない（⚠️ 記録が11.4%しか無いため）。
     */
    contract: number;
    /**
     * 担当変更理由ごとの件数。⚠️ キーは ② が返す `reasonLabels` の8つ。
     *
     * ⚠️⚠️ **左の契約率の列とは別物。** ⚠️ 足し引きできる数字ではない。
     *   ⚠️ ⚠️ **突合は担当変更前の営業、期間は反響取得日。**
     */
    reasons: Record<string, number>;
};

type Coverage = { sheets: number; withStaff: number };

/** 店舗の選択肢。⚠️ `section` は**課を選んだときの絞り込み**に使う */
type ShopOption = { name: string; section: string };

/**
 * 担当変更理由の列の並べ替えキー。
 *
 * ⚠️⚠️ **理由名を直接キーにしない。** ⚠️ `name` など既存のキーと衝突する恐れがある。
 *   ⚠️ `reason:失注` のように接頭辞を付けて区別する。
 */
const REASON_PREFIX = 'reason:';

type SortKey =
    | 'name' | 'shop' | 'section' | 'talk' | 'next' | 'nextRate' | 'contract' | 'contractRate'
    | `${typeof REASON_PREFIX}${string}`;
type SortOrder = 'asc' | 'desc';

/**
 * 歩留まり。
 *
 * ⚠️⚠️ **分母が0のときは null を返す。** ⚠️ `0%` と出さないこと。
 *   ⚠️ ⚠️ **「商談の記録が無い」と「商談したが契約が無い」は意味が違う。**
 */
const rate = (count: number, denominator: number): number | null =>
    denominator === 0 ? null : Math.round((count / denominator) * 1000) / 10;

/**
 * 月の選択肢。⚠️ 当月から過去36ヶ月。
 *
 * ⚠️⚠️ **`new Date(y, m, 1)` で作る。** ⚠️ 文字列から日付を作らない
 *   （⚠️ `new Date('2026-10')` は**UTC解釈**になり、月がずれることがある）。
 */
const monthOptions = (): string[] => {
    const now = new Date();
    const list: string[] = [];
    for (let i = 0; i < 36; i += 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
};

const MONTHS = monthOptions();

/** 並べ替え用の値。⚠️ 率の null は **一番下**へ回す（-1） */
const valueOf = (row: Row, key: SortKey): number | string => {
    // ⚠️ 担当変更理由の列。⚠️⚠️ **0件の人も 0 として並べる**（除外しない）
    if (key.startsWith(REASON_PREFIX)) {
        return row.reasons?.[key.slice(REASON_PREFIX.length)] ?? 0;
    }
    switch (key) {
        case 'name': return row.name;
        case 'shop': return row.shop;
        case 'section': return row.section;
        case 'talk': return row.talk;
        case 'next': return row.next;
        case 'nextRate': return rate(row.next, row.talk) ?? -1;
        case 'contract': return row.contract;
        case 'contractRate': return rate(row.contract, row.talk) ?? -1;
        // ⚠️ 上の if で理由の列は処理済み。ここへは来ない
        default: return 0;
    }
};

const StaffContractRate = () => {
    const [rows, setRows] = useState<Row[]>([]);
    const [coverage, setCoverage] = useState<Coverage>({ sheets: 0, withStaff: 0 });
    const [period, setPeriod] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    /**
     * 選択肢。⚠️⚠️ **サーバーが返す順をそのまま使う。**
     *   ⚠️ 課は `section_list` の `no` 順、店舗は `shop_list` の `id` 順。
     *   ⚠️ ⚠️ **画面側で並べ直さないこと。** ⚠️ マスタの意図した順が崩れる。
     */
    const [sectionOptions, setSectionOptions] = useState<string[]>([]);
    const [shopMaster, setShopMaster] = useState<ShopOption[]>([]);

    /**
     * 担当変更理由の列。
     *
     * ⚠️⚠️ **② が返す順をそのまま列順にする。**
     *   ⚠️ ⚠️ **画面に8つを書き写さないこと。** ⚠️ 増減したときに食い違う。
     */
    const [reasonLabels, setReasonLabels] = useState<string[]>([]);

    /** ⚠️ 絞り込み。⚠️⚠️ **既定はすべて空＝全期間・全課・全店舗** */
    const [targetSection, setTargetSection] = useState('');
    const [targetShop, setTargetShop] = useState('');
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');

    /** ⚠️ 既定は商談顧客数の多い順。⚠️ **率を既定にすると分母1人で100%の行が先頭に来る** */
    const [sortKey, setSortKey] = useState<SortKey>('talk');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    /**
     * ⚠️⚠️ **期間だけサーバーで絞る。**
     *   ⚠️ 課・店舗は返ってきた行を画面で絞る（⚠️ **取り直さないので速い**）。
     *   ⚠️ ⚠️ **期間は日付を見ないと判定できない**ので、サーバーに任せるしかない。
     */
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', {
                request: 'staff_contract',
                startMonth,
                endMonth,
            });
            if (res.data?.status !== 'ok') {
                setError(res.data?.message ?? '集計を取得できませんでした。');
                return;
            }
            setRows(res.data.rows ?? []);
            setCoverage(res.data.coverage ?? { sheets: 0, withStaff: 0 });
            setPeriod(res.data.period ?? '');
            setSectionOptions(res.data.sections ?? []);
            setShopMaster(res.data.shops ?? []);
            setReasonLabels(res.data.reasonLabels ?? []);
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(message ?? '集計を取得できませんでした。分析サーバーが停止している可能性があります。');
        } finally {
            setLoading(false);
        }
    }, [startMonth, endMonth]);

    useEffect(() => { void fetchData(); }, [fetchData]);

    /**
     * 店舗の選択肢。⚠️⚠️ **課を選んだら、その課の店舗だけにする。**
     *
     * ⚠️ ⚠️ **課が空の店舗が15件ある**（実測）。⚠️ 課を選ぶと選択肢から消える。
     *   ⚠️ 消すのが正しい（⚠️ その課の店舗ではないため）。
     */
    const shopOptions = useMemo(
        () => (targetSection === ''
            ? shopMaster
            : shopMaster.filter(s => s.section === targetSection)),
        [shopMaster, targetSection]
    );

    /**
     * ⚠️⚠️ **選べなくなった店舗が選ばれたままにならないようにする。**
     *   ⚠️ ⚠️ **残ると0件になり、「課を変えたら消えた」と見える。**
     */
    useEffect(() => {
        if (targetShop === '') return;
        if (shopOptions.some(s => s.name === targetShop)) return;
        setTargetShop('');
    }, [shopOptions, targetShop]);

    /**
     * 課・店舗の絞り込み。
     *
     * ⚠️⚠️ **1人が複数の店舗・課に属していることがある**（`/` でつないである）。
     *   ⚠️ ⚠️ **完全一致では落ちる**ので、`/` で割ってから突き合わせる。
     */
    const filtered = useMemo(() => {
        const match = (value: string, target: string) =>
            target === '' || value.split('/').map(v => v.trim()).includes(target);

        return rows.filter(r => match(r.section, targetSection) && match(r.shop, targetShop));
    }, [rows, targetSection, targetShop]);

    const sorted = useMemo(() => {
        const list = [...filtered];
        list.sort((a, b) => {
            const x = valueOf(a, sortKey);
            const y = valueOf(b, sortKey);
            if (typeof x === 'string' || typeof y === 'string') {
                return sortOrder === 'asc'
                    ? String(x).localeCompare(String(y), 'ja')
                    : String(y).localeCompare(String(x), 'ja');
            }
            // ⚠️ 同じ値のときは名前で安定させる（⚠️ 並べ替えのたびに順が変わらないように）
            if (x === y) return a.name.localeCompare(b.name, 'ja');
            return sortOrder === 'asc' ? x - y : y - x;
        });
        return list;
    }, [filtered, sortKey, sortOrder]);

    // ⚠️⚠️ **サマリは絞り込み後の行で数える。** ⚠️ 表と数字が食い違わないように
    const total = useMemo(() => ({
        staff: filtered.length,
        talk: filtered.reduce((a, r) => a + r.talk, 0),
        next: filtered.reduce((a, r) => a + r.next, 0),
        contract: filtered.reduce((a, r) => a + r.contract, 0),
    }), [filtered]);

    const percent = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

    /** 並べ替えの見出し。⚠️ GoogleReview.tsx と同じ作法（クリックで発火） */
    const SortHead = ({ label, keyName, align = 'left', width, note, divider = false }: {
        label: string; keyName: SortKey; align?: 'left' | 'center' | 'right'; width?: string; note?: string;
        /** ⚠️ 区分の境目に線を入れる。⚠️ 担当変更理由の**先頭の列だけ** true */
        divider?: boolean;
    }) => {
        const active = sortKey === keyName;
        return (
            <th
                className={`sc_th sc_th_sort text-${align}${divider ? ' sc_divider' : ''}`}
                style={{ width }}
                title={note ?? 'クリックで並べ替え'}
                onClick={() => {
                    if (active) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    // ⚠️ 別の列は降順から始める（⚠️ 件数や率は「多い順」を先に見たい）
                    else { setSortKey(keyName); setSortOrder('desc'); }
                }}
            >
                {label}
                <span className={`sc_sort_icon${active ? ' is_active' : ''}`}>
                    {active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
            </th>
        );
    };

    return (
        <div className="sc_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル。共通CSSを汚さない */}
            <style>{`
                /**
                   ⚠️ 2026-10-02（v2.2.162）: ⚠️⚠️ **全画面にしたら端まで詰まって読みづらくなった。**
                     ⚠️ 左右と下に余白を取る。
                   ⚠️⚠️ **固定値にしないこと。** ⚠️ 狭い画面で左右48pxも空けると、
                     ⚠️ 16列ある表の見える幅がそのぶん削られる。
                     ⚠️ ⚠️ **clamp で画面幅に追従させている**（16px 〜 48px）。
                   ⚠️ 上は少なめ。⚠️ モーダルの見出しのすぐ下なので、空けすぎると間延びする。 */
                .sc_wrap { font-size: 13px; color: #1f2937;
                           padding: 4px clamp(16px, 3vw, 48px) 28px; }
                .sc_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .sc_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .sc_note { font-size: 11px; color: #6b7280; }

                /* ⚠️ 絞り込みバー。⚠️ GoogleReview の gr_bar に合わせてある */
                .sc_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                          background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px;
                          padding: 10px 12px; }
                .sc_bar_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .sc_reset { font-size: 11px; font-weight: 700; color: #2563eb; cursor: pointer;
                            background: none; border: none; padding: 4px 0; white-space: nowrap; }
                .sc_reset:hover { text-decoration: underline; }
                .sc_reset:disabled { color: #cbd5e1; cursor: default; text-decoration: none; }

                .sc_kpi { display: flex; gap: 8px; flex-wrap: wrap; }
                .sc_kpi_card { flex: 1 1 110px; background: #fff; border: 1px solid #e5e7eb;
                               border-radius: 10px; padding: 8px 12px; }
                .sc_kpi_label { font-size: 10px; color: #6b7280; white-space: nowrap; }
                .sc_kpi_value { font-size: 18px; font-weight: 700; line-height: 1.2;
                                font-variant-numeric: tabular-nums; }

                /* ⚠️ 記録の網羅率の注意書き。⚠️⚠️ **消さないこと。**
                      ⚠️ 数字だけ見せると「実力差」と受け取られる */
                .sc_caution { font-size: 11px; color: #92400e; line-height: 1.8;
                              background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; }
                .sc_caution b { color: #78350f; }

                /* ⚠️ 縦は 60vh で止めて、見出しを固定したまま中だけ流す。
                   ⚠️ min-width を外すと狭い画面で列が潰れる */
                .sc_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto;
                                 background: #fff; max-height: 60vh; }
                .sc_table { width: 100%; border-collapse: separate; border-spacing: 0;
                            font-size: 12px; min-width: 1480px; }

                /* ⚠️ 見出しは下段（列）。⚠️⚠️ **上段が 28px あるぶん下げて貼り付ける。** */
                .sc_th { position: sticky; top: 28px; z-index: 2; background: #f8fafc;
                         border-bottom: 1px solid #e5e7eb; padding: 8px 10px;
                         font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }

                /* ⚠️⚠️ **上段（区分）の高さを 28px に固定している。**
                      ⚠️ 下段の top: 28px がこの値に依存している。
                      ⚠️⚠️ **ここでバッククォートを使わないこと**（テンプレートリテラルが切れる）。
                      ⚠️ ⚠️ **片方だけ変えると見出しが重なって読めなくなる。**
                      ⚠️ padding ではなく height + line-height で決めているのは、
                        ⚠️ 高さを確実に 28px に保つため（padding だと字詰めで揺れる）。
                      ⚠️⚠️ **必ず .sc_th より後ろに置くこと。**
                        ⚠️ 同じ詳細度なので、前に置くと .sc_th の top: 28px に負けて
                        ⚠️ **上段まで 28px 下がり、見出しが重なる。** */
                .sc_th_group { top: 0; z-index: 4; height: 28px; line-height: 28px;
                               padding: 0 10px; text-align: center; background: #eef2f7;
                               color: #374151; letter-spacing: .04em; }
                /* ⚠️ 担当変更理由の区分。⚠️ 左の契約率と**別物だと一目で分かる色**にする */
                .sc_group_reason { background: #eef6ee; color: #2f5d3a; }

                /* ⚠️ 区分の境目。⚠️ 担当変更理由の**先頭の列だけ**に入る */
                .sc_divider { border-left: 2px solid #d7e3d9; }
                .sc_th_sort { cursor: pointer; user-select: none; }
                .sc_th_sort:hover { background: #eef2f7; }
                .sc_sort_icon { margin-left: 5px; font-size: 10px; color: #cbd5e1; }
                .sc_sort_icon.is_active { color: #2563eb; }
                .sc_td { border-bottom: 1px solid #f1f5f9; padding: 8px 10px;
                         vertical-align: middle; white-space: nowrap; }
                .sc_row:hover > .sc_td { background: #f8fafc; }
                .sc_name { font-weight: 700; font-size: 13px; }
                .sc_sub { font-size: 10px; color: #6b7280; }
                .sc_num { text-align: right; font-variant-numeric: tabular-nums; }
                .sc_rate { text-align: right; font-weight: 700; color: #b45309;
                           font-variant-numeric: tabular-nums; }
                /* ⚠️ 契約率だけ背景を敷く。⚠️ この画面の主役なので目で追えるように */
                .sc_main { background: #fdf2f3; color: #b02a37; }
                /* ⚠️ 顧客DB側は**率を持たない**ので、色を変えて別物だと分かるようにする */
                .sc_db { text-align: right; font-variant-numeric: tabular-nums; color: #374151;
                         background: #f8fafc; }
                /* ⚠️ 担当変更理由の数値。⚠️ 左の契約率の列と地色で分ける */
                .sc_reason { background: #fafdfa; color: #2f5d3a; }
                .sc_row:hover > .sc_reason { background: #f1f7f2; }
                .sc_zero { color: #cbd5e1; }
                .sc_empty { color: #9ca3af; font-size: 12px; padding: 24px; text-align: center; }
            `}</style>

            <div className="sc_head mb-2">
                <span className="sc_title">
                    <i className="fa-solid fa-ranking-star me-2 text-danger" aria-hidden="true" />
                    営業別 契約率
                </span>
                <span className="sc_note">
                    注文事業{period === '' ? '' : ` / ${period}年度`}（報告対象）
                </span>
            </div>

            {error !== '' && (
                <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>
            )}

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-danger" role="status">
                        <span className="visually-hidden">読み込み中</span>
                    </div>
                </div>
            ) : (
                <>
                    {/* ⚠️⚠️ **既定はすべて「すべて」＝全期間・全課・全店舗。** */}
                    <div className="sc_bar mb-2">
                        <div>
                            <div className="sc_bar_label">課</div>
                            <Form.Select
                                size="sm" value={targetSection} style={{ width: '170px', fontSize: '12px' }}
                                onChange={(e) => setTargetSection(e.target.value)}
                            >
                                <option value="">すべて</option>
                                {sectionOptions.map(v => <option key={v} value={v}>{v}</option>)}
                            </Form.Select>
                        </div>
                        <div>
                            <div className="sc_bar_label">店舗</div>
                            <Form.Select
                                size="sm" value={targetShop} style={{ width: '170px', fontSize: '12px' }}
                                onChange={(e) => setTargetShop(e.target.value)}
                            >
                                <option value="">すべて</option>
                                {shopOptions.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                            </Form.Select>
                        </div>
                        <div>
                            <div className="sc_bar_label">開始月</div>
                            <Form.Select
                                size="sm" value={startMonth} style={{ width: '120px', fontSize: '12px' }}
                                onChange={(e) => setStartMonth(e.target.value)}
                            >
                                <option value="">指定なし</option>
                                {MONTHS.map(v => <option key={v} value={v}>{v}</option>)}
                            </Form.Select>
                        </div>
                        <div>
                            <div className="sc_bar_label">終了月</div>
                            <Form.Select
                                size="sm" value={endMonth} style={{ width: '120px', fontSize: '12px' }}
                                onChange={(e) => setEndMonth(e.target.value)}
                            >
                                <option value="">指定なし</option>
                                {MONTHS.map(v => <option key={v} value={v}>{v}</option>)}
                            </Form.Select>
                        </div>
                        <button
                            type="button"
                            className="sc_reset"
                            disabled={targetSection === '' && targetShop === '' && startMonth === '' && endMonth === ''}
                            onClick={() => {
                                setTargetSection(''); setTargetShop('');
                                setStartMonth(''); setEndMonth('');
                            }}
                        >
                            絞り込みを外す
                        </button>
                        {/* ⚠️ 開始が終了より後だと0件になる。⚠️ **黙って空にしない** */}
                        {startMonth !== '' && endMonth !== '' && startMonth > endMonth && (
                            <span className="sc_note text-danger">
                                開始月が終了月より後になっています
                            </span>
                        )}
                    </div>

                    <div className="sc_kpi mb-2">
                        <div className="sc_kpi_card">
                            <div className="sc_kpi_label">対象営業</div>
                            <div className="sc_kpi_value">{total.staff}</div>
                        </div>
                        <div className="sc_kpi_card">
                            <div className="sc_kpi_label">商談顧客数</div>
                            <div className="sc_kpi_value">{total.talk.toLocaleString()}</div>
                        </div>
                        <div className="sc_kpi_card">
                            <div className="sc_kpi_label">次アポ数</div>
                            <div className="sc_kpi_value">{total.next.toLocaleString()}</div>
                        </div>
                        <div className="sc_kpi_card">
                            <div className="sc_kpi_label">契約数</div>
                            <div className="sc_kpi_value">{total.contract.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* ⚠️⚠️ **この注記を外さないこと。** 記録の有無が数字を大きく左右する */}
                    <div className="sc_caution mb-2">
                        ※ 商談顧客数は、<b>商談シートに記録がある顧客</b>と、<b>顧客情報に商談フェーズの日付が入っている顧客</b>の
                        どちらかに当てはまる人数です。次アポ数はそのうち第二面談・事前審査・契約まで進んだ人数です。
                        <br />
                        ※ <b>契約数は顧客情報の状況が「契約済み」の人数</b>です（商談ログでは数えていません）。
                        <br />
                        ※ 誰の実績かは<b>顧客の担当営業</b>で決めています。商談ログに担当営業が書かれている記録はそちらを優先します
                        （全 {coverage.sheets.toLocaleString()} 件中 <b>{coverage.withStaff.toLocaleString()} 件</b>
                        {coverage.sheets === 0 ? '' : `・${(coverage.withStaff / coverage.sheets * 100).toFixed(1)}%`}）。
                        <b>担当変更があった顧客は、現在の担当の実績になります。</b>
                        <br />
                        ※ 数えているのは商談の回数ではなく<b>顧客の人数</b>です。
                        <br />
                        {/* ⚠️⚠️ **この1行は 2026-10-02 の指示で入れたもの。消さないこと。**
                              ⚠️ 左の契約率が商談日・契約日で期間を見るのに対し、
                              ⚠️ ⚠️ **担当変更理由だけ反響取得日で見ている。**
                                ⚠️ 書いておかないと、同じ行の中で基準が違うことに気づけない。 */}
                        ※ <b>担当変更理由は反響取得日を基準に抽出</b>しています。
                        担当が変わる前の営業（変更前の担当）の件数として数えています。
                    </div>

                    <div className="sc_table_wrap">
                        <table className="sc_table">
                            <thead>
                                {/*
                                    ⚠️⚠️ **見出しは2段。** ⚠️ 上段が区分、下段が列。
                                      ⚠️ ⚠️ **下段の `top` は上段の高さぶんずらしてある**
                                        （CSS の `.sc_th_group` / `.sc_th` を参照）。
                                        ⚠️ **高さを変えるなら両方直すこと。** 重なって読めなくなる。
                                */}
                                <tr>
                                    <th className="sc_th sc_th_group" colSpan={8}>担当営業別契約率</th>
                                    <th className="sc_th sc_th_group sc_group_reason" colSpan={reasonLabels.length}>
                                        担当変更理由
                                    </th>
                                </tr>
                                <tr>
                                    <SortHead label="営業名" keyName="name" width="150px" />
                                    <SortHead label="店舗" keyName="shop" width="150px" />
                                    <SortHead label="課" keyName="section" width="120px" />
                                    <SortHead label="商談顧客数" keyName="talk" align="right" width="86px" />
                                    <SortHead label="次アポ数" keyName="next" align="right" width="78px" />
                                    <SortHead label="次アポ率" keyName="nextRate" align="right" width="80px" />
                                    <SortHead label="契約数" keyName="contract" align="right" width="80px"
                                        note="顧客情報の状況が「契約済み」の人数" />
                                    <SortHead label="契約率" keyName="contractRate" align="right" width="78px"
                                        note="契約数 ÷ 商談顧客数" />

                                    {/* ⚠️ 担当変更理由。⚠️⚠️ **並びは ② が返す順をそのまま使う** */}
                                    {reasonLabels.map((label, index) => (
                                        <SortHead
                                            key={label}
                                            label={label}
                                            keyName={`${REASON_PREFIX}${label}`}
                                            align="right"
                                            width="84px"
                                            // ⚠️ 最初の1列だけ左に区切り線を入れて、区分の境目を示す
                                            divider={index === 0}
                                            note={`この営業が担当していたときに「${label}」で止まった顧客の人数（反響取得日で期間を判定）`}
                                        />
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(row => {
                                    const nextRate = rate(row.next, row.talk);
                                    const contractRate = rate(row.contract, row.talk);
                                    return (
                                        <tr key={row.name} className="sc_row">
                                            <td className="sc_td sc_name">{row.name}</td>
                                            <td className="sc_td"><span className="sc_sub">{row.shop}</span></td>
                                            <td className="sc_td"><span className="sc_sub">{row.section}</span></td>
                                            <td className={`sc_td sc_num${row.talk === 0 ? ' sc_zero' : ''}`}>{row.talk}</td>
                                            <td className={`sc_td sc_num${row.next === 0 ? ' sc_zero' : ''}`}>{row.next}</td>
                                            <td className="sc_td sc_rate">{percent(nextRate)}</td>
                                            <td className={`sc_td sc_num${row.contract === 0 ? ' sc_zero' : ''}`}>{row.contract}</td>
                                            <td className="sc_td sc_rate sc_main">{percent(contractRate)}</td>

                                            {/* ⚠️ 担当変更理由。⚠️⚠️ **0は薄く出す**（空欄にしない。無記録と区別がつかなくなる） */}
                                            {reasonLabels.map((label, index) => {
                                                const count = row.reasons?.[label] ?? 0;
                                                return (
                                                    <td
                                                        key={label}
                                                        className={`sc_td sc_num sc_reason${count === 0 ? ' sc_zero' : ''}${index === 0 ? ' sc_divider' : ''}`}
                                                    >
                                                        {count}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}

                                {sorted.length === 0 && (
                                    <tr>
                                        {/* ⚠️ 列数は 8 ＋ 担当変更理由。⚠️ **固定値を書かない**（列が増えると崩れる） */}
                                        <td className="sc_empty" colSpan={8 + reasonLabels.length}>
                                            対象の営業がいません。
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <p className="sc_note mt-2 mb-0">
                        見出しをクリックすると並び替わります。もう一度押すと昇順・降順が入れ替わります。
                    </p>
                </>
            )}
        </div>
    );
};

export default StaffContractRate;
