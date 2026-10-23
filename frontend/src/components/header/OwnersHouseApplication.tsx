import React, { useEffect, useMemo, useState } from 'react';
import Form from 'react-bootstrap/Form';
import apiClient from '../../utils/apiClient';
import { ksnapImageUrl } from '../../utils/ksnapImage';

/**
 * オーナーズハウス募集の一覧（ヘッダー → 反響管理 → オーナーズハウス募集）。（v2.2.215）
 *
 * ─────────────────────────────────────────────
 * ⚠️ データは `owners_house_application`。**この画面は表示のみ。**
 *   - フォーム（kh-house.jp/owners_house/form/）からの受付 … ① handlers/owners_house_application.php
 *   - 過去の通知メールの取り込み … ② owners_house_application_import（GAS OwnersHouseMailImport）
 * ⚠️ 読み込みは ② の owners_house_application_list（スタッフのみ）。
 * ⚠️⚠️ 写真は ① の /dashboard/api/images/（k-snap と同じ置き場所。ksnapImageUrl で URL にする）。
 *   ⚠️ 過去のメールから取り込んだ行には写真が無い（メールに写真が入っていないため）。
 * ⚠️ 見た目は GoogleReview.tsx に合わせている（接頭辞 oh_）。
 * ─────────────────────────────────────────────
 */

interface Application {
    id: number;
    received_at: string;
    source: string;
    name: string;
    zip: string;
    shop: string;
    staff: string;
    photo_mode: string;
    photos: string[];
    title: string;
    features: string[];
}

type SortKey = 'received_at' | 'name' | 'shop' | 'staff' | 'photo_mode';
type SortOrder = 'asc' | 'desc';

/** 店舗名の頭 → ブランド。⚠️ フォームの選択肢が「ブランド名＋店舗」の形なので頭で分ける */
const BRANDS = ['国分ハウジング', 'デイジャストハウス', 'なごみ工務店', 'ニーエルホーム', 'フルコミホーム'];
const brandOf = (shop: string): string => BRANDS.find(b => shop.startsWith(b)) ?? 'その他';

const SOURCE_LABEL: Record<string, string> = { form: 'フォーム', mail: '過去のメール' };

const formatZip = (zip: string): string => (/^\d{7}$/.test(zip) ? `${zip.slice(0, 3)}-${zip.slice(3)}` : zip);

const OwnersHouseApplication = () => {
    const [rows, setRows] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [targetBrand, setTargetBrand] = useState('');
    const [targetPhoto, setTargetPhoto] = useState('');
    const [keyword, setKeyword] = useState('');

    /** ⚠️ 既定は新しい順 */
    const [sortKey, setSortKey] = useState<SortKey>('received_at');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    /** 見どころ・写真を開いている行 */
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await apiClient.post('', { request: 'owners_house_application_list' });
                setRows((res.data?.rows ?? []) as Application[]);
            } catch {
                setError('オーナーズハウス募集を取得できませんでした。時間をおいて再度お試しください。');
            } finally {
                setLoading(false);
            }
        };
        void fetchData();
    }, []);

    /** ブランドの選択肢。⚠️ 実データにあるものだけを BRANDS の順に */
    const brandOptions = useMemo(() => {
        const present = new Set(rows.map(r => brandOf(r.shop)));
        return [...BRANDS, 'その他'].filter(b => present.has(b));
    }, [rows]);

    const visible = useMemo(() => {
        const word = keyword.trim();
        const filtered = rows.filter(r =>
            (!targetBrand || brandOf(r.shop) === targetBrand) &&
            (!targetPhoto || r.photo_mode === targetPhoto) &&
            (!word || [r.name, r.shop, r.staff, r.title, ...r.features].some(text => text.includes(word)))
        );
        // ⚠️ 元の配列を壊さない（sort は破壊的）。⚠️ 受付日時は「YYYY/MM/DD HH:MM」なので文字で比べてよい
        return [...filtered].sort((a, b) => {
            const diff = String(a[sortKey]).localeCompare(String(b[sortKey]), 'ja');
            if (diff === 0) return b.id - a.id;
            return sortOrder === 'asc' ? diff : -diff;
        });
    }, [rows, targetBrand, targetPhoto, keyword, sortKey, sortOrder]);

    const total = useMemo(() => ({
        all: visible.length,
        request: visible.filter(r => r.photo_mode === '撮影を依頼する').length,
        attach: visible.filter(r => r.photo_mode === '写真を添付する').length,
        mail: visible.filter(r => r.source === 'mail').length,
    }), [visible]);

    /** 並べ替えの見出し。⚠️ 同じ列なら昇順・降順を入れ替え、別の列なら降順から（GoogleReview.tsx と同じ） */
    const SortHead = ({ label, keyName, width }: { label: string; keyName: SortKey; width?: string }) => {
        const active = sortKey === keyName;
        return (
            <th
                className="oh_th oh_th_sort"
                style={{ width }}
                onClick={() => {
                    if (active) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(keyName); setSortOrder('desc'); }
                }}
                title="クリックで並べ替え"
            >
                {label}
                <span className={`oh_sort_icon${active ? ' is_active' : ''}`}>
                    {active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}
                </span>
            </th>
        );
    };

    const toggle = (id: number) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    return (
        <div className="oh_wrap">
            {/* ⚠️ このコンポーネント専用のスタイル。共通CSSを汚さない（GoogleReview.tsx と同じ形） */}
            <style>{`
                /* ⚠️ 全画面モーダルの Modal.Body は p-0 かつ overflow:hidden（Header.tsx）。
                      ⚠️ 余白はこちらで持ち、表だけがスクロールする形にする */
                .oh_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 16px 40px 20px; box-sizing: border-box; }
                .oh_inner { width: 100%; max-width: 1500px; margin: 0 auto;
                            display: flex; flex-direction: column; min-height: 0; flex: 1; }
                .oh_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
                .oh_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
                .oh_note { font-size: 11px; color: #6b7280; }
                .oh_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                          background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
                .oh_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .oh_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .oh_kpi_card { flex: 1 1 160px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .oh_kpi_label { font-size: 11px; color: #6b7280; }
                .oh_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .oh_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb;
                              border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }
                /* ⚠️ flex:1 と min-height:0 で「残りの高さを使い切って中だけスクロール」。外すと表が画面外へ出る */
                .oh_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto;
                                 background: #fff; flex: 1 1 auto; min-height: 0; }
                .oh_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .oh_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 12px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .oh_th_sort { cursor: pointer; user-select: none; }
                .oh_th_sort:hover { background: #eef2f7; }
                .oh_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .oh_sort_icon.is_active { color: #2563eb; }
                .oh_td { border-bottom: 1px solid #f1f5f9; padding: 9px 12px; vertical-align: middle; }
                .oh_row:hover > .oh_td { background: #f8fafc; }
                .oh_name { font-weight: 700; font-size: 13px; }
                .oh_tag { font-size: 10px; color: #4b5563; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
                .oh_tag_request { background: #eef2ff; color: #3730a3; }
                .oh_tag_attach { background: #ecfdf5; color: #065f46; }
                .oh_tag_mail { background: #fef3c7; color: #92400e; }
                .oh_num { font-variant-numeric: tabular-nums; white-space: nowrap; }
                .oh_more { font-size: 11px; font-weight: 700; color: #2563eb; cursor: pointer; background: none;
                           border: none; padding: 2px 0; white-space: nowrap; }
                .oh_more:hover { text-decoration: underline; }
                .oh_detail > .oh_td { background: #fbfdff; padding: 12px 16px 16px; }
                .oh_feature { line-height: 1.8; }
                .oh_photos { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
                .oh_photo { width: 120px; height: 90px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; }
                .oh_thumb { width: 44px; height: 33px; object-fit: cover; border-radius: 4px; border: 1px solid #e5e7eb; }
                .oh_empty { color: #9ca3af; font-size: 12px; }
            `}</style>

            <div className="oh_inner">
                <div className="oh_head mb-2">
                    <span className="oh_title">
                        <i className="fa-solid fa-house-chimney me-2 text-primary" aria-hidden="true" />
                        オーナーズハウス募集
                    </span>
                    <span className="oh_note">※ オーナー様が「ご自宅を見学先として登録してよい」と応募した一覧です</span>
                </div>

                {error !== '' && <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>}

                {loading ? (
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">読み込み中</span>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="oh_bar mb-3">
                            <div>
                                <div className="oh_label">ブランド</div>
                                <Form.Select size="sm" value={targetBrand} style={{ width: '180px', fontSize: '12px' }}
                                    onChange={(e) => setTargetBrand(e.target.value)}>
                                    <option value="">すべて</option>
                                    {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
                                </Form.Select>
                            </div>
                            <div>
                                <div className="oh_label">写真</div>
                                <Form.Select size="sm" value={targetPhoto} style={{ width: '160px', fontSize: '12px' }}
                                    onChange={(e) => setTargetPhoto(e.target.value)}>
                                    <option value="">すべて</option>
                                    <option value="撮影を依頼する">撮影を依頼する</option>
                                    <option value="写真を添付する">写真を添付する</option>
                                </Form.Select>
                            </div>
                            <div>
                                <div className="oh_label">検索</div>
                                <Form.Control size="sm" value={keyword} placeholder="名前・店舗・担当・タイトル" style={{ width: '220px', fontSize: '12px' }}
                                    onChange={(e) => setKeyword(e.target.value)} />
                            </div>
                            <span className="oh_note ms-auto">並べ替えは見出しをクリック</span>
                        </div>

                        <div className="oh_kpi mb-3">
                            <div className="oh_kpi_card">
                                <div className="oh_kpi_label">応募</div>
                                <div className="oh_kpi_value">{total.all.toLocaleString()}</div>
                            </div>
                            <div className="oh_kpi_card">
                                <div className="oh_kpi_label">撮影を依頼</div>
                                <div className="oh_kpi_value">{total.request.toLocaleString()}</div>
                            </div>
                            <div className="oh_kpi_card">
                                <div className="oh_kpi_label">写真を添付</div>
                                <div className="oh_kpi_value">{total.attach.toLocaleString()}</div>
                            </div>
                            <div className="oh_kpi_card">
                                <div className="oh_kpi_label">うち過去のメールから取り込み</div>
                                <div className="oh_kpi_value">{total.mail.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* ⚠️ 過去のメールの行に写真が無い理由を必ず出す。書かないと「写真が消えた」と受け取られる */}
                        <div className="oh_caution mb-2">
                            「過去のメール」の行は、以前のフォームの通知メールから取り込んだものです。メールに写真が入っていなかったため、
                            写真は表示されません（「写真を添付する」でも同じです）。お施主様への連絡は、契約店舗・担当営業から行ってください。
                        </div>

                        <div className="oh_table_wrap">
                            <table className="oh_table">
                                <thead>
                                    <tr>
                                        <SortHead label="受付日時" keyName="received_at" width="140px" />
                                        <SortHead label="お施主様" keyName="name" width="160px" />
                                        <th className="oh_th" style={{ width: '90px' }}>郵便番号</th>
                                        <SortHead label="ご契約店舗" keyName="shop" width="210px" />
                                        <SortHead label="担当営業" keyName="staff" width="120px" />
                                        <SortHead label="写真" keyName="photo_mode" width="190px" />
                                        <th className="oh_th">ご自宅のタイトル</th>
                                        <th className="oh_th" style={{ width: '120px' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.length === 0 ? (
                                        <tr>
                                            <td className="oh_td oh_empty text-center py-4" colSpan={8}>該当する応募がありません</td>
                                        </tr>
                                    ) : visible.map(r => {
                                        const isOpen = expanded[r.id] === true;
                                        return (
                                            <React.Fragment key={r.id}>
                                                <tr className="oh_row">
                                                    <td className="oh_td oh_num">
                                                        {r.received_at}
                                                        {r.source === 'mail' && <div><span className="oh_tag oh_tag_mail">{SOURCE_LABEL.mail}</span></div>}
                                                    </td>
                                                    <td className="oh_td"><span className="oh_name">{r.name}</span> 様</td>
                                                    <td className="oh_td oh_num">{formatZip(r.zip) || '-'}</td>
                                                    <td className="oh_td">{r.shop || '-'}</td>
                                                    <td className="oh_td">{r.staff || <span className="oh_empty">未入力</span>}</td>
                                                    <td className="oh_td">
                                                        <span className={`oh_tag ${r.photo_mode === '写真を添付する' ? 'oh_tag_attach' : 'oh_tag_request'}`}>
                                                            {r.photo_mode || '-'}
                                                        </span>
                                                        {r.photos.length > 0 && (
                                                            <span className="d-inline-flex gap-1 ms-2 align-middle">
                                                                {r.photos.slice(0, 3).map(p => (
                                                                    <img key={p} className="oh_thumb" src={ksnapImageUrl(p)} alt="" loading="lazy" />
                                                                ))}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="oh_td">{r.title}</td>
                                                    <td className="oh_td text-end">
                                                        <button className="oh_more" onClick={() => toggle(r.id)}>
                                                            {isOpen ? '閉じる' : '見どころ・写真'}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {/* ⚠️ 見どころと写真は行の下に広げる（表に並べると読めないため） */}
                                                {isOpen && (
                                                    <tr className="oh_detail">
                                                        <td className="oh_td" colSpan={8}>
                                                            {r.features.length === 0
                                                                ? <span className="oh_empty">見どころの入力がありません</span>
                                                                : r.features.map((f, i) => (
                                                                    <div className="oh_feature" key={i}>
                                                                        <span className="oh_tag me-2">見どころ{'①②③④⑤'[i]}</span>{f}
                                                                    </div>
                                                                ))}
                                                            {r.photos.length > 0 ? (
                                                                <div className="oh_photos">
                                                                    {r.photos.map(p => (
                                                                        <a key={p} href={ksnapImageUrl(p)} target="_blank" rel="noopener noreferrer">
                                                                            <img className="oh_photo" src={ksnapImageUrl(p)} alt="" loading="lazy" />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="oh_empty mt-2">
                                                                    {r.photo_mode === '撮影を依頼する' ? '撮影の依頼です（写真は撮影後に）' : '写真はありません'}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default OwnersHouseApplication;
