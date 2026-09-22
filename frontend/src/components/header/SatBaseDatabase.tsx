import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../../utils/apiClient';

/**
 * SatBaseサマリー（ヘッダー → 土地・物件管理 → SatBaseサマリー）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 元データは SatBase の物件台帳（中間加工）。
 *   ⚠️ テーブル `satbase_property`（1,910行 / 42列）。
 *
 * ⚠️⚠️ **画面から変更できるのは2列だけ。**
 *   ⚠️ ⚠️ **広告出稿状況（`ad_posted`）と Instagram投稿状況（`instagram_posted`）。**
 *   ⚠️ 他の列は SatBase 側が正であり、⚠️ **こちらからは書き換えない。**
 *   ⚠️ サーバー側でも許可リストで弾いている（features/satbase.ts）。
 *
 * ⚠️⚠️ **全件（1,910行）を1度に受け取る。**
 *   ⚠️ 絞り込み・並べ替え・表示はすべて画面で行う。
 *   ⚠️ ⚠️ **1,910行 × 42列をそのまま描画すると重い**ので、
 *     ⚠️ **スクロールに合わせて30行ずつ描画する**（下の `visibleCount`）。
 *     ⚠️ ページ送りにしなかったのは、⚠️ **絞り込みながら上から眺める使い方**のため。
 *
 * ⚠️ 表が横に広いので Header.tsx の `isFullscreenMenu` に入れてある。
 *   ⚠️ ⚠️ **閉じるボタンは Header.tsx 側が出す。ここに実装しないこと。**
 * ─────────────────────────────────────────────
 */

type Property = Record<string, string | number | null>;

type Column = {
    key: string;
    label: string;
    /** 右寄せにする（金額・ID） */
    numeric?: boolean;
    /** 既定で表示するか */
    defaultShown: boolean;
};

/**
 * 表示できる列。
 *
 * ⚠️⚠️ **並びはこの配列の順。** ⚠️ 表の列順もここで決まる。
 *
 * ⚠️ `defaultShown: false` は ⚠️ **既定で非表示**。
 *   ⚠️ ⚠️ **決済日（仕入）/ 契約日（仕入）/ 位置情報 は実データが全件空**なので
 *     ⚠️ 既定では出さない（2026-09-22 の指示）。
 */
const COLUMNS: Column[] = [
    { key: 'property_id', label: '物件ID', numeric: true, defaultShown: true },
    { key: 'property_name', label: '物件名称', defaultShown: true },
    { key: 'progress_status', label: '工程状況', defaultShown: true },
    { key: 'sales_status', label: '販売状況', defaultShown: true },
    { key: 'prefecture', label: '県', defaultShown: true },
    { key: 'area', label: 'エリア', defaultShown: true },
    { key: 'team', label: 'チーム（係）', defaultShown: true },
    { key: 'sales_price', label: '販売価格', numeric: true, defaultShown: true },
    { key: 'land_cost', label: '内土地代', numeric: true, defaultShown: false },
    { key: 'sales_period', label: '販売期間', defaultShown: true },
    { key: 'spec', label: '仕様', defaultShown: true },
    { key: 'plan', label: 'プラン', defaultShown: false },
    { key: 'usage_type', label: '用途', numeric: true, defaultShown: false },
    { key: 'customer_name', label: 'お客様名', defaultShown: false },
    { key: 'contract_staff', label: '契約担当', defaultShown: true },
    { key: 'site_staff', label: '現場管理/営業担当', defaultShown: false },
    { key: 'design_staff', label: '設計', defaultShown: false },
    { key: 'construction_staff', label: '施工管理', defaultShown: false },
    { key: 'foundation_start_date', label: '基礎着工日', defaultShown: false },
    { key: 'desired_start_date', label: '着工希望日', defaultShown: false },
    { key: 'completion_date', label: '完工日', defaultShown: false },
    { key: 'exterior_completion_date', label: '外構完了', defaultShown: false },
    { key: 'permit_date', label: '確認許可日', defaultShown: false },
    { key: 'contract_recorded_date', label: '契約計上日', defaultShown: true },
    { key: 'payment_date', label: '入金日', defaultShown: false },
    { key: 'delivery_date', label: '引渡日', defaultShown: true },
    { key: 'portal_posted_date', label: 'ポータル掲載日', defaultShown: false },
    { key: 'kaeru_hp_posted_date', label: 'かえるHP掲載', defaultShown: false },
    { key: 'price_changed_date', label: '販売価格変更日', defaultShown: false },
    { key: 'previous_sales_price', label: '変更前販売価格', numeric: true, defaultShown: false },
    { key: 'ground_improvement', label: '地盤改良', numeric: true, defaultShown: false },
    { key: 'schedule_created', label: '工程表作成済み', numeric: true, defaultShown: false },
    { key: 'land_id', label: '土地ID', numeric: true, defaultShown: false },
    { key: 'property_id_general', label: '物件ID（一般）', numeric: true, defaultShown: false },
    { key: 'property_id_manager', label: 'ID（管理職）', numeric: true, defaultShown: false },
    // ⚠️⚠️ **実データが全件空の3列。** ⚠️ 既定では出さない（指示）
    { key: 'purchase_settlement_date', label: '決済日（仕入）', defaultShown: false },
    { key: 'purchase_contract_date', label: '契約日（仕入）', defaultShown: false },
    { key: 'lat_lng', label: '位置情報', defaultShown: false },
    { key: 'updated', label: '最終更新', defaultShown: false },
    { key: 'updated_by', label: '更新者', defaultShown: false },
];

/** ⚠️ トグルの2列は列の選択から外している（⚠️ **常に出す**。この画面の主目的のため） */
const TOGGLES: { key: string; label: string }[] = [
    { key: 'ad_posted', label: '広告出稿' },
    { key: 'instagram_posted', label: 'Instagram' },
];

/** ⚠️ 選んだ列を憶えておく。⚠️ 40列から毎回選び直すのは現実的でない */
const STORAGE_KEY = 'satbase_visible_columns';

/** ⚠️ 1回に描画する行数。⚠️ スクロールが最後に届くたびにこれだけ増やす */
const PAGE_SIZE = 30;

const defaultVisible = (): string[] =>
    COLUMNS.filter(c => c.defaultShown).map(c => c.key);

const loadVisible = (): string[] => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return defaultVisible();
        const parsed = JSON.parse(saved) as string[];
        // ⚠️ 列を減らしたときに備えて、実在する列だけに絞る
        const known = parsed.filter(key => COLUMNS.some(c => c.key === key));
        return known.length > 0 ? known : defaultVisible();
    } catch {
        return defaultVisible();
    }
};

const formatValue = (column: Column, value: string | number | null): string => {
    if (value === null || value === undefined || value === '') return '';
    if (column.numeric && column.key !== 'property_id'
        && column.key !== 'property_id_general' && column.key !== 'property_id_manager'
        && column.key !== 'land_id' && column.key !== 'usage_type'
        && column.key !== 'schedule_created') {
        const num = Number(value);
        return isNaN(num) ? String(value) : num.toLocaleString();
    }
    // ⚠️ 日付は `2026-09-22T00:00:00.000Z` で返ることがあるので日付だけにする
    const text = String(value);
    return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text;
};

const SatBaseDatabase = () => {
    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState<string>('');

    /* 絞り込み */
    const [keyword, setKeyword] = useState('');
    const [progressStatus, setProgressStatus] = useState('');
    const [salesStatus, setSalesStatus] = useState('');
    const [prefecture, setPrefecture] = useState('');
    const [team, setTeam] = useState('');
    /**
     * ⚠️ トグル2列の絞り込み。⚠️ **`'' = すべて / '1' = 済み / '0' = 未**。
     *   ⚠️⚠️ **数値ではなく文字列で持つ。** ⚠️ `0` を偽と判定して
     *     ⚠️ **「未」が「すべて」と同じ挙動になる**のを防ぐため。
     */
    const [adPosted, setAdPosted] = useState('');
    const [instagramPosted, setInstagramPosted] = useState('');

    /* 表示する列 */
    const [visible, setVisible] = useState<string[]>(loadVisible);
    const [columnPanel, setColumnPanel] = useState(false);

    /* スクロールに合わせて増やす行数 */
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const sentinel = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiClient.post('', { request: 'satbase_list' });
                const rows = (res.data?.properties ?? []) as Property[];
                /**
                 * ⚠️ サーバーも `ORDER BY property_id DESC` で返しているが、
                 *   ⚠️ **画面側でも数値として並べ直す**（指示）。
                 *   ⚠️ ⚠️ **文字列のまま並べると 999 が 1000 より後ろに来る。**
                 */
                rows.sort((a, b) => Number(b.property_id) - Number(a.property_id));
                setProperties(rows);
                setError('');
            } catch (e) {
                console.error(e);
                setError('物件データを取得できませんでした。時間をおいて再度お試しください。');
            } finally {
                setLoading(false);
            }
        };
        void fetchData();
    }, []);

    /** 絞り込みの選択肢は実データから作る（⚠️ 直書きにすると実態とずれる） */
    const optionsOf = useCallback((key: string): string[] =>
        [...new Set(properties.map(p => String(p[key] ?? '')).filter(v => v !== ''))].sort(),
        [properties]);

    const filtered = useMemo(() => {
        const word = keyword.trim();
        return properties.filter(p => {
            if (word !== '') {
                // ⚠️ 物件名称と物件IDのどちらでも引けるようにする
                const name = String(p.property_name ?? '');
                const id = String(p.property_id ?? '');
                if (!name.includes(word) && !id.includes(word)) return false;
            }
            if (progressStatus !== '' && String(p.progress_status ?? '') !== progressStatus) return false;
            if (salesStatus !== '' && String(p.sales_status ?? '') !== salesStatus) return false;
            if (prefecture !== '' && String(p.prefecture ?? '') !== prefecture) return false;
            if (team !== '' && String(p.team ?? '') !== team) return false;
            if (adPosted !== '' && String(Number(p.ad_posted ?? 0)) !== adPosted) return false;
            if (instagramPosted !== '' && String(Number(p.instagram_posted ?? 0)) !== instagramPosted) return false;
            return true;
        });
    }, [properties, keyword, progressStatus, salesStatus, prefecture, team, adPosted, instagramPosted]);

    // ⚠️ 絞り込みを変えたら先頭から描き直す（⚠️ そうしないと前の行数のまま残る）
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [keyword, progressStatus, salesStatus, prefecture, team, adPosted, instagramPosted]);

    /**
     * ⚠️⚠️ **スクロールが表の末尾に届いたら30行足す。**
     *   ⚠️ `IntersectionObserver` を使う。⚠️ **スクロールイベントを拾うより軽い。**
     *   ⚠️ ⚠️ **依存に `filtered.length` を入れること。**
     *     ⚠️ 入れないと、絞り込み後に「もう全部出した」状態のまま監視が止まる。
     */
    useEffect(() => {
        const target = sentinel.current;
        if (!target) return;

        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                setVisibleCount(current => Math.min(current + PAGE_SIZE, filtered.length));
            }
        }, { rootMargin: '200px' });

        observer.observe(target);
        return () => observer.disconnect();
    }, [filtered.length, visibleCount]);

    const shownColumns = useMemo(
        () => COLUMNS.filter(c => visible.includes(c.key)),
        [visible]
    );

    const toggleColumn = (key: string) => {
        setVisible(current => {
            const next = current.includes(key)
                ? current.filter(k => k !== key)
                : [...current, key];
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // ⚠️ プライベートウィンドウ等で保存できなくても、画面は動かす
            }
            return next;
        });
    };

    const resetColumns = () => {
        const next = defaultVisible();
        setVisible(next);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            // 同上
        }
    };

    /**
     * トグルの更新。
     *
     * ⚠️⚠️ **先に画面を書き換えてから送る**（待たせない）。
     *   ⚠️ ⚠️ **失敗したら元に戻す。** ⚠️ 戻さないと、保存できていないのに
     *     ⚠️ **保存できたように見えたまま**になる。
     */
    const toggle = async (property: Property, column: string) => {
        const propertyId = Number(property.property_id);
        const before = Number(property[column] ?? 0);
        const after = before === 1 ? 0 : 1;
        const busyKey = `${propertyId}:${column}`;

        setSaving(busyKey);
        setProperties(current => current.map(p =>
            Number(p.property_id) === propertyId ? { ...p, [column]: after } : p
        ));

        try {
            const res = await apiClient.post('', {
                request: 'satbase_update',
                propertyId,
                column,
                value: after,
            });

            if (res.data?.status !== 'ok') {
                throw new Error(res.data?.message ?? '更新できませんでした。');
            }
            setError('');
        } catch (e) {
            console.error(e);
            setProperties(current => current.map(p =>
                Number(p.property_id) === propertyId ? { ...p, [column]: before } : p
            ));
            setError('更新できませんでした。通信の状態を確認して、もう一度お試しください。');
        } finally {
            setSaving('');
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">読み込み中</span>
                </div>
            </div>
        );
    }

    const rows = filtered.slice(0, visibleCount);

    return (
        <div className="sb_wrap">
            <style>{`
                /*
                  ⚠️ 2026-09-22: モーダルの端まで表が広がって読みづらかったため、
                    ⚠️ **左右と上下に余白を取り、要素の間隔も広げた**（指示）。
                  ⚠️ ⚠️ **Bootstrap の p-5 は使っていない。**
                    ⚠️ 全画面モーダルの中で高さを 100% 使う作りなので、
                      ⚠️ **padding をクラスで付けると表の縦が足りなくなる。**
                */
                .sb_wrap {
                    display: flex; flex-direction: column; height: 100%; min-height: 0;
                    padding: 24px 32px 28px;
                    box-sizing: border-box;
                }
                .sb_bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
                .sb_input, .sb_select {
                    font-size: 12px; padding: 6px 10px; border: 1px solid #ced4da; border-radius: 4px;
                    background: #fff; color: #212529;
                }
                .sb_input { width: 220px; }
                .sb_count { font-size: 12px; color: #6c757d; margin-left: auto; }
                .sb_btn {
                    font-size: 12px; padding: 6px 14px; border: 1px solid #ced4da;
                    border-radius: 4px; background: #fff; cursor: pointer;
                }
                .sb_btn:hover { background: #f1f3f5; }
                .sb_panel {
                    border: 1px solid #dee2e6; border-radius: 6px; padding: 16px 20px;
                    margin-bottom: 16px; background: #f8f9fa;
                }
                .sb_panel_head {
                    display: flex; align-items: center; gap: 10px;
                    font-size: 12px; font-weight: 600; margin-bottom: 8px;
                }
                .sb_panel_list {
                    display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px 20px;
                }
                .sb_check { font-size: 12px; display: flex; align-items: center; gap: 6px; cursor: pointer; }
                .sb_scroll { flex: 1; min-height: 0; overflow: auto; border: 1px solid #dee2e6; border-radius: 6px; }
                .sb_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .sb_table th, .sb_table td { padding: 9px 14px; border-bottom: 1px solid #eceef0; white-space: nowrap; }
                .sb_table thead th {
                    position: sticky; top: 0; z-index: 2; background: #f8f9fa;
                    border-bottom: 1px solid #dee2e6; font-weight: 600; text-align: left;
                }
                .sb_table tbody tr:hover { background: #f8fbff; }
                .sb_num { text-align: right; font-variant-numeric: tabular-nums; }
                .sb_toggle {
                    width: 38px; height: 20px; border-radius: 999px; border: none;
                    background: #ced4da; position: relative; cursor: pointer; padding: 0;
                    transition: background 0.15s;
                }
                .sb_toggle[data-on="1"] { background: #0d6efd; }
                .sb_toggle:disabled { opacity: 0.5; cursor: wait; }
                .sb_knob {
                    position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
                    border-radius: 50%; background: #fff; transition: transform 0.15s;
                }
                .sb_toggle[data-on="1"] .sb_knob { transform: translateX(18px); }
                .sb_empty { padding: 30px; text-align: center; color: #6c757d; font-size: 13px; }
                .sb_error { font-size: 12px; color: #b02a37; margin-bottom: 6px; }
            `}</style>

            {error !== '' && <div className="sb_error">{error}</div>}

            <div className="sb_bar">
                <input
                    className="sb_input"
                    placeholder="物件名称・物件IDで検索"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                />
                <select className="sb_select" value={progressStatus} onChange={(e) => setProgressStatus(e.target.value)}>
                    <option value="">工程状況</option>
                    {optionsOf('progress_status').map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select className="sb_select" value={salesStatus} onChange={(e) => setSalesStatus(e.target.value)}>
                    <option value="">販売状況</option>
                    {optionsOf('sales_status').map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select className="sb_select" value={prefecture} onChange={(e) => setPrefecture(e.target.value)}>
                    <option value="">県</option>
                    {optionsOf('prefecture').map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select className="sb_select" value={team} onChange={(e) => setTeam(e.target.value)}>
                    <option value="">チーム（係）</option>
                    {optionsOf('team').map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select className="sb_select" value={adPosted} onChange={(e) => setAdPosted(e.target.value)}>
                    <option value="">広告出稿</option>
                    <option value="1">出稿済み</option>
                    <option value="0">未出稿</option>
                </select>
                <select className="sb_select" value={instagramPosted} onChange={(e) => setInstagramPosted(e.target.value)}>
                    <option value="">Instagram</option>
                    <option value="1">投稿済み</option>
                    <option value="0">未投稿</option>
                </select>
                <button className="sb_btn" onClick={() => setColumnPanel(v => !v)}>
                    表示項目（{shownColumns.length}/{COLUMNS.length}）
                </button>
                <span className="sb_count">{filtered.length.toLocaleString()} 件中 {rows.length.toLocaleString()} 件を表示</span>
            </div>

            {columnPanel && (
                <div className="sb_panel">
                    <div className="sb_panel_head">
                        <span>表示する項目</span>
                        <button className="sb_btn" onClick={resetColumns}>既定に戻す</button>
                    </div>
                    <div className="sb_panel_list">
                        {COLUMNS.map(c => (
                            <label key={c.key} className="sb_check">
                                <input
                                    type="checkbox"
                                    checked={visible.includes(c.key)}
                                    onChange={() => toggleColumn(c.key)}
                                />
                                {c.label}
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className="sb_scroll">
                <table className="sb_table">
                    <thead>
                        <tr>
                            {TOGGLES.map(t => <th key={t.key}>{t.label}</th>)}
                            {shownColumns.map(c => <th key={c.key}>{c.label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(p => (
                            <tr key={String(p.property_id)}>
                                {TOGGLES.map(t => (
                                    <td key={t.key}>
                                        <button
                                            className="sb_toggle"
                                            data-on={Number(p[t.key] ?? 0) === 1 ? '1' : '0'}
                                            disabled={saving === `${Number(p.property_id)}:${t.key}`}
                                            onClick={() => void toggle(p, t.key)}
                                            aria-label={`${p.property_name} の${t.label}`}
                                        >
                                            <span className="sb_knob" />
                                        </button>
                                    </td>
                                ))}
                                {shownColumns.map(c => (
                                    <td key={c.key} className={c.numeric ? 'sb_num' : undefined}>
                                        {formatValue(c, p[c.key] ?? null)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filtered.length === 0 && <div className="sb_empty">条件に合う物件がありません。</div>}

                {/* ⚠️ ここが見えたら30行足す。⚠️ 表の外に置くと監視が効かない */}
                <div ref={sentinel} style={{ height: 1 }} />
            </div>
        </div>
    );
};

export default SatBaseDatabase;
