import React, { useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';
import {
    PDF_CATEGORIES,
    UNSORTED_CATEGORY,
    UNSORTED_COMPANY,
} from '../../utils/competitorPdfUpload';

/**
 * 他社資料一覧（ヘッダー → 他社動向 → 他社資料）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-21 に全面的に作り替えた**（指示）。
 *
 *   ⚠️ 旧: 12件ずつのページ送りがある1枚の表。⚠️ 種別も他社名も無かった。
 *   ⚠️ 新: ⚠️ **フォルダ（Box 風）とリストを切り替えられる。**
 *
 *       種別（4つ） → 他社ごとのフォルダ → PDF一覧
 *
 *   ⚠️ 種別は utils/competitorPdfUpload.ts の `PDF_CATEGORIES`。
 *     ⚠️ ⚠️ **① の許可リスト（competitor_pdf_upload.php）と同じ内容にすること。**
 *
 * ⚠️⚠️ **`competitor_pdf` は「1ファイル1行」である**（2026-09-21 に作り替え）。
 *   ⚠️ 以前は顧客1人につき1行で `pdf_path` に JSON 配列を持っていた。
 *   ⚠️ ⚠️ **API の応答も変わっている**（features/competitorPdf.ts）。
 *     ⚠️ 顧客名・店舗・ブランドは **SQL で結合済み**で返る。
 *     ⚠️ 画面で master_data 全件（24,000件）を突き合わせる必要は無くなった。
 *
 * ⚠️ 表が横に広く、フォルダも並べるので Header.tsx の `isFullscreenMenu` に
 *   入れてある。⚠️ **外すと潰れる。**
 *   ⚠️ ⚠️ **閉じるボタンは Header.tsx 側が出す。ここに実装しないこと。**
 * ─────────────────────────────────────────────
 */

type Material = {
    no: number;
    id: string;
    file_name: string;
    pdf_url: string;
    staff: string;
    company: string;
    category: string;
    created: string | null;
    customer_name: string;
    shop_name: string;
    in_charge_user: string;
    status: string;
    brand: string;
    division: string;
    section: string;
};

/** 表示のしかた。⚠️ 既定はフォルダ（指示） */
type ViewMode = 'folder' | 'list';

/**
 * PDF の URL。
 *
 * ⚠️⚠️ **実体は ① レンタルサーバーの `uploads/competitors/` にある。**
 *   ⚠️ ② VPS には無い。⚠️ **相対パスにしないこと。**
 * ⚠️ `pdf_url` は `/uploads/competitors/xxx.pdf` の形で入っている。
 */
const fileHref = (path: string): string =>
    `https://khg-marketing.info/dashboard/api/gateway/handlers${String(path ?? '')}`;

/** 空欄をフォルダ名に寄せる。⚠️ 空のまま束ねると「名前のないフォルダ」になる */
const categoryOf = (m: Material): string =>
    (m.category ?? '').trim() === '' ? UNSORTED_CATEGORY : m.category.trim();

const companyOf = (m: Material): string =>
    (m.company ?? '').trim() === '' ? UNSORTED_COMPANY : m.company.trim();

/**
 * 種別の並び。
 *
 * ⚠️⚠️ **`PDF_CATEGORIES` の順に出し、「未分類」は必ず最後にする。**
 *   ⚠️ 件数順にすると、⚠️ **登録のたびにフォルダの位置が動いて探しにくい。**
 */
const CATEGORY_ORDER: string[] = [...PDF_CATEGORIES, UNSORTED_CATEGORY];

const CATEGORY_ICON: Record<string, string> = {
    'カタログパンフレット': 'fa-book-open',
    '見積もり・提案書': 'fa-file-invoice-yen',
    'チラシ': 'fa-rectangle-ad',
    'その他': 'fa-folder',
    [UNSORTED_CATEGORY]: 'fa-circle-question',
};

const CompetitorMaterials = () => {
    const [materials, setMaterials] = useState<Material[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [view, setView] = useState<ViewMode>('folder');
    const [searchQuery, setSearchQuery] = useState('');
    /** 開いている種別。⚠️ null なら種別の一覧（いちばん上の階層） */
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    /** 開いている他社。⚠️ null なら他社の一覧 */
    const [openCompany, setOpenCompany] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiClient.post('', { request: 'competitor_pdf' });
                setMaterials((res.data?.pdf ?? []) as Material[]);
            } catch (err) {
                console.error(err);
                setError('他社資料を取得できませんでした。時間をおいて再度お試しください。');
            } finally {
                setLoading(false);
            }
        };
        void fetchData();
    }, []);

    /**
     * 検索。
     *
     * ⚠️⚠️ **検索中はフォルダを無視して全件から探す。**
     *   ⚠️ 「どのフォルダに入れたか忘れた」が一番多い探し方である。
     *   ⚠️ フォルダを開いたまま絞ると、⚠️ **別の種別にある資料が見つからない。**
     */
    const query = searchQuery.trim().toLowerCase();

    const searched = useMemo(() => {
        if (query === '') return materials;
        return materials.filter(m =>
            [m.file_name, m.company, m.customer_name, m.shop_name, m.brand, m.staff, m.category]
                .some(v => String(v ?? '').toLowerCase().includes(query))
        );
    }, [materials, query]);

    /** 種別 → 他社 → 件数。⚠️ フォルダの中身を数えるのに使う */
    const tree = useMemo(() => {
        const map = new Map<string, Map<string, Material[]>>();
        for (const m of searched) {
            const cat = categoryOf(m);
            const comp = companyOf(m);
            if (!map.has(cat)) map.set(cat, new Map());
            const inner = map.get(cat) as Map<string, Material[]>;
            if (!inner.has(comp)) inner.set(comp, []);
            (inner.get(comp) as Material[]).push(m);
        }
        return map;
    }, [searched]);

    /** 種別のフォルダ。⚠️ 0件の種別も出す（どこに入れるかが分かる） */
    const categoryFolders = useMemo(() => {
        const known = CATEGORY_ORDER.map(name => ({
            name,
            files: [...(tree.get(name)?.values() ?? [])].flat(),
        }));
        // ⚠️ 対応表に無い種別が DB に入っていても落とさない（末尾に足す）
        const extra = [...tree.keys()]
            .filter(name => !CATEGORY_ORDER.includes(name))
            .map(name => ({ name, files: [...(tree.get(name)?.values() ?? [])].flat() }));
        return [...known, ...extra];
    }, [tree]);

    const companyFolders = useMemo(() => {
        if (openCategory === null) return [];
        const inner = tree.get(openCategory);
        if (inner === undefined) return [];
        return [...inner.entries()]
            .map(([name, files]) => ({ name, files }))
            // ⚠️ 他社は件数順。⚠️ **「他社未設定」は必ず最後**（片付け待ちなので）
            .sort((a, b) => {
                if (a.name === UNSORTED_COMPANY) return 1;
                if (b.name === UNSORTED_COMPANY) return -1;
                return b.files.length - a.files.length;
            });
    }, [tree, openCategory]);

    /** いま表に出す資料 */
    const visible = useMemo(() => {
        if (view === 'list') return searched;
        if (openCategory === null) return [];
        if (openCompany === null) return [];
        return tree.get(openCategory)?.get(openCompany) ?? [];
    }, [view, searched, tree, openCategory, openCompany]);

    const total = materials.length;
    const unsorted = useMemo(
        () => materials.filter(m => companyOf(m) === UNSORTED_COMPANY || categoryOf(m) === UNSORTED_CATEGORY).length,
        [materials]
    );

    const openFolder = (cat: string) => { setOpenCategory(cat); setOpenCompany(null); };

    const fileRow = (m: Material) => (
        <tr className="cm_row" key={m.no}>
            <td className="cm_td cm_icon">
                <a href={fileHref(m.pdf_url)} target="_blank" rel="noopener noreferrer" title="PDFを開く">
                    <i className="fa-solid fa-file-pdf" aria-hidden="true" />
                </a>
            </td>
            <td className="cm_td">
                <a className="cm_file" href={fileHref(m.pdf_url)} target="_blank" rel="noopener noreferrer">
                    {m.file_name || '（ファイル名なし）'}
                </a>
                {/* ⚠️ リスト表示のときは、どのフォルダの資料かが分からないので札で出す */}
                {view === 'list' && (
                    <div className="cm_meta">
                        <span className="cm_tag">{categoryOf(m)}</span>
                        <span className="cm_tag">{companyOf(m)}</span>
                    </div>
                )}
            </td>
            <td className="cm_td">{m.customer_name ? `${m.customer_name} 様` : '－'}</td>
            <td className="cm_td"><span className="cm_tag">{m.shop_name || '未設定'}</span></td>
            <td className="cm_td">{m.brand || '－'}</td>
            <td className="cm_td">{m.staff || '－'}</td>
            <td className="cm_td cm_date">{String(m.created ?? '').slice(0, 10) || '－'}</td>
        </tr>
    );

    return (
        <div className="cm_wrap">
            <style>{`
                /**
                 * ⚠️⚠️ 全画面モーダルの Modal.Body は **p-0 かつ overflow: hidden** である
                 *   （header/Header.tsx）。⚠️ 余白はこちらで持ち、
                 *   高さを使い切って**中だけがスクロールする**形にする。
                 *   ⚠️ height:100% と min-height:0 を外すと画面外へ出る。
                 */
                .cm_wrap { font-size: 13px; color: #1f2937;
                           height: 100%; display: flex; flex-direction: column;
                           padding: 16px 40px 20px; box-sizing: border-box; }
                .cm_inner { width: 100%; max-width: 1500px; margin: 0 auto;
                            display: flex; flex-direction: column; min-height: 0; flex: 1; gap: 12px; }

                .cm_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .cm_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .cm_note { font-size: 11px; color: #6b7280; }

                .cm_bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
                          background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px;
                          padding: 10px 12px; }
                .cm_search { border: 1px solid #d1d5db; border-radius: 8px; padding: 6px 10px;
                             font-size: 12px; background: #fff; color: #1f2937; outline: none; width: 260px; }
                .cm_spacer { margin-left: auto; }

                /* 表示の切り替え。⚠️ 押している側を塗る */
                .cm_toggle { display: inline-flex; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; }
                .cm_toggle button { border: 0; background: #fff; color: #4b5563; font-size: 12px;
                                    font-weight: 700; padding: 6px 14px; cursor: pointer; }
                .cm_toggle button.is_on { background: #2563eb; color: #fff; }

                /* パンくず。⚠️ フォルダ表示のときだけ出す */
                .cm_crumb { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #6b7280;
                            flex-wrap: wrap; }
                .cm_crumb button { border: 0; background: none; color: #2563eb; cursor: pointer;
                                   font-size: 12px; padding: 0; font-weight: 700; }
                .cm_crumb .sep { color: #cbd5e1; }
                .cm_crumb .now { color: #1f2937; font-weight: 700; }

                /* フォルダのグリッド。⚠️ 幅に応じて折り返す */
                .cm_grid { display: grid; gap: 10px; overflow: auto; min-height: 0; flex: 1 1 auto;
                           grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); align-content: start; }
                .cm_folder { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
                             padding: 14px; cursor: pointer; text-align: left;
                             display: flex; align-items: center; gap: 12px; transition: all .15s ease; }
                .cm_folder:hover { border-color: #2563eb; box-shadow: 0 2px 8px rgba(37,99,235,.12); }
                /* ⚠️ 0件のフォルダは薄くする。⚠️ **隠さない**（入れ先が分かるように） */
                .cm_folder.is_empty { opacity: .5; }
                .cm_folder_icon { font-size: 22px; color: #64748b; width: 26px; text-align: center; }
                .cm_folder_name { font-weight: 700; font-size: 13px; line-height: 1.3; }
                .cm_folder_count { font-size: 11px; color: #6b7280; font-variant-numeric: tabular-nums; }

                /* 表 */
                .cm_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto;
                                 background: #fff; flex: 1 1 auto; min-height: 0; }
                .cm_table { width: 100%; min-width: 1000px; border-collapse: separate; border-spacing: 0;
                            font-size: 12px; }
                .cm_th { position: sticky; top: 0; z-index: 2; background: #f8fafc;
                         border-bottom: 1px solid #e5e7eb; padding: 9px 12px; text-align: left;
                         font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
                .cm_td { border-bottom: 1px solid #f1f5f9; padding: 9px 12px; vertical-align: middle; }
                .cm_row:hover > .cm_td { background: #f8fafc; }
                .cm_icon { width: 44px; text-align: center; }
                .cm_icon a { color: #dc2626; font-size: 18px; text-decoration: none; }
                .cm_icon a:hover { opacity: .7; }
                .cm_file { color: #1f2937; font-weight: 700; text-decoration: none; }
                .cm_file:hover { color: #2563eb; text-decoration: underline; }
                .cm_meta { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
                .cm_tag { font-size: 10px; color: #4b5563; background: #f3f4f6;
                          border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
                .cm_date { font-variant-numeric: tabular-nums; color: #6b7280; white-space: nowrap; }

                .cm_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .cm_kpi_card { flex: 1 1 150px; background: #fff; border: 1px solid #e5e7eb;
                               border-radius: 10px; padding: 10px 14px; }
                .cm_kpi_label { font-size: 11px; color: #6b7280; }
                .cm_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2;
                                font-variant-numeric: tabular-nums; }

                .cm_empty { padding: 28px 12px; text-align: center; color: #9ca3af; font-size: 12px; }
                .cm_error { font-size: 12px; color: #b91c1c; background: #fef2f2;
                            border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px; }
            `}</style>

            <div className="cm_inner">
                <div className="cm_head">
                    <div className="cm_title">
                        <i className="fa-solid fa-file-pdf me-2 text-danger" aria-hidden="true" />他社資料
                    </div>
                    <div className="cm_note">
                        顧客詳細の「他社資料」で登録された PDF を、種別と他社ごとにまとめて表示します。
                    </div>
                </div>

                {error !== '' && <div className="cm_error">{error}</div>}

                <div className="cm_kpi">
                    <div className="cm_kpi_card">
                        <div className="cm_kpi_label">登録件数</div>
                        <div className="cm_kpi_value">{total}</div>
                    </div>
                    <div className="cm_kpi_card">
                        <div className="cm_kpi_label">表示中</div>
                        <div className="cm_kpi_value">{searched.length}</div>
                    </div>
                    <div className="cm_kpi_card">
                        {/* ⚠️ 片付けが要るもの。⚠️ 顧客詳細から種別・他社を入れると減る */}
                        <div className="cm_kpi_label">未分類・他社未設定</div>
                        <div className="cm_kpi_value">{unsorted}</div>
                    </div>
                </div>

                <div className="cm_bar">
                    <input
                        type="text"
                        className="cm_search"
                        placeholder="ファイル名・他社・お客様名・店舗・担当で検索"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {query !== '' && view === 'folder' && (
                        <span className="cm_note">
                            ⚠️ 検索中はフォルダを開かずに全件から探しています
                        </span>
                    )}

                    <div className="cm_spacer">
                        <div className="cm_toggle">
                            <button
                                type="button"
                                className={view === 'folder' ? 'is_on' : ''}
                                onClick={() => setView('folder')}
                            >
                                <i className="fa-solid fa-folder me-1" aria-hidden="true" />フォルダ
                            </button>
                            <button
                                type="button"
                                className={view === 'list' ? 'is_on' : ''}
                                onClick={() => setView('list')}
                            >
                                <i className="fa-solid fa-list me-1" aria-hidden="true" />リスト
                            </button>
                        </div>
                    </div>
                </div>

                {view === 'folder' && (
                    <div className="cm_crumb">
                        <button type="button" onClick={() => { setOpenCategory(null); setOpenCompany(null); }}>
                            <i className="fa-solid fa-house me-1" aria-hidden="true" />すべて
                        </button>
                        {openCategory !== null && <>
                            <span className="sep">/</span>
                            {openCompany === null
                                ? <span className="now">{openCategory}</span>
                                : <button type="button" onClick={() => setOpenCompany(null)}>{openCategory}</button>}
                        </>}
                        {openCompany !== null && <>
                            <span className="sep">/</span>
                            <span className="now">{openCompany}</span>
                        </>}
                    </div>
                )}

                {loading ? (
                    <div className="cm_empty">読み込み中です…</div>
                ) : view === 'folder' && openCategory === null ? (
                    <div className="cm_grid">
                        {categoryFolders.map(f => (
                            <button
                                type="button"
                                key={f.name}
                                className={`cm_folder${f.files.length === 0 ? ' is_empty' : ''}`}
                                onClick={() => openFolder(f.name)}
                            >
                                <span className="cm_folder_icon">
                                    <i className={`fa-solid ${CATEGORY_ICON[f.name] ?? 'fa-folder'}`} aria-hidden="true" />
                                </span>
                                <span>
                                    <span className="cm_folder_name">{f.name}</span>
                                    <span className="cm_folder_count d-block">{f.files.length} 件</span>
                                </span>
                            </button>
                        ))}
                    </div>
                ) : view === 'folder' && openCompany === null ? (
                    <div className="cm_grid">
                        {companyFolders.length === 0 && (
                            <div className="cm_empty">この種別の資料はまだありません。</div>
                        )}
                        {companyFolders.map(f => (
                            <button
                                type="button"
                                key={f.name}
                                className="cm_folder"
                                onClick={() => setOpenCompany(f.name)}
                            >
                                <span className="cm_folder_icon">
                                    <i className="fa-solid fa-building" aria-hidden="true" />
                                </span>
                                <span>
                                    <span className="cm_folder_name">{f.name}</span>
                                    <span className="cm_folder_count d-block">{f.files.length} 件</span>
                                </span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="cm_table_wrap">
                        <table className="cm_table">
                            <thead>
                                <tr>
                                    <th className="cm_th" style={{ width: '44px' }} />
                                    <th className="cm_th">ファイル名</th>
                                    <th className="cm_th" style={{ width: '160px' }}>お客様名</th>
                                    <th className="cm_th" style={{ width: '140px' }}>店舗</th>
                                    <th className="cm_th" style={{ width: '90px' }}>ブランド</th>
                                    <th className="cm_th" style={{ width: '130px' }}>登録者</th>
                                    <th className="cm_th" style={{ width: '110px' }}>登録日</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map(fileRow)}
                                {visible.length === 0 && (
                                    <tr><td className="cm_empty" colSpan={7}>該当する資料がありません。</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompetitorMaterials;
