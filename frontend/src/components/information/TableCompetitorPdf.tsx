import React, { memo } from 'react';
import { PDF_CATEGORIES } from '../../utils/competitorPdfUpload';
import type { CompetitorPdfItem } from '../../utils/competitorPdfUpload';

/**
 * 顧客詳細の「他社資料」欄。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-21 に他社名（company）と種別（category）の選択を足した。**
 *   ⚠️ 他社資料一覧（header/CompetitorMaterials.tsx）を
 *     ⚠️ **種別 → 他社 → PDF のフォルダ表示**にするために要る。
 *
 * ⚠️⚠️ **他社名の候補は `master_data.competitors_text` から作る。**
 *   ⚠️ 顧客ごとに「競合として登録した他社」だけを出す（指示）。
 *   ⚠️ ⚠️ **候補に無い値が入っていても消さないこと。**
 *     ⚠️ 移行時に PDF を読んで入れた値や、競合の登録を後から消した場合がある。
 *     ⚠️ その値は選択肢の先頭に「（登録外）」として出す。
 *
 * ⚠️ 保存は utils/competitorPdfUpload.ts が行う（① の competitor_pdf_upload）。
 *   ⚠️ ⚠️ **完全上書き方式**。ここに出ているものが最終状態になる。
 * ─────────────────────────────────────────────
 */

type Props = {
    userName: string;
    competitorPdfFile: CompetitorPdfItem[];
    setCompetitorPdfFile: React.Dispatch<React.SetStateAction<CompetitorPdfItem[]>>;
    /**
     * 他社名の候補。⚠️ `information.competitors_text` をそのまま渡す。
     * ⚠️ カンマ区切り。⚠️ 実データに全角読点（、）が混ざっているので両方で切る。
     */
    competitorsText?: string;
};

/**
 * 他社名の候補を作る。
 *
 * ⚠️⚠️ **全角読点（、）でも切ること。**
 *   ⚠️ 実データに `シアーズホーム、昭和建設` のように全角で入った行がある。
 *   ⚠️ 半角だけで切ると ⚠️ **2社が1つの候補**として出てしまう。
 *
 * ⚠️ `null` という文字列が入っている行がある。⚠️ **候補から外すこと。**
 */
const competitorOptions = (text: string | undefined): string[] =>
    [...new Set(
        (text ?? '')
            .replace(/、/g, ',')
            .split(',')
            .map(c => c.trim())
            .filter(c => c !== '' && c !== 'null')
    )];

const selectStyle: React.CSSProperties = {
    fontSize: '11px',
    padding: '2px 4px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    backgroundColor: '#fff',
    color: '#212529',
    maxWidth: '150px',
};

const TableCompetitorPdf = ({ userName, setCompetitorPdfFile, competitorPdfFile, competitorsText }: Props) => {
    const options = competitorOptions(competitorsText);

    /** 1件だけ差し替える。⚠️ ミューテーションを避け map で新しい配列を返す */
    const update = (index: number, patch: Partial<CompetitorPdfItem>) => {
        setCompetitorPdfFile(prev => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
    };

    return (
        <div className="d-flex flex-column gap-2 py-1">
            <input
                type="file"
                accept="application/pdf"
                multiple
                className="form-control form-control-sm border shadow-sm"
                onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                        const newFiles = files.map(file => ({
                            name: file.name,
                            file: file,
                            staff: userName,
                            // ⚠️ 他社が1社だけなら初期値にする。⚠️ 複数あるときは選ばせる
                            company: options.length === 1 ? options[0] : '',
                            category: '',
                        }));
                        setCompetitorPdfFile(prev => [...prev, ...newFiles]);
                    }
                    e.target.value = ''; // 連続で同じファイルを選択できるようにクリア
                }}
            />

            {competitorPdfFile.length > 0 && (
                <div className="d-flex flex-column gap-2 mt-1">
                    {competitorPdfFile.map((item, index) => {
                        /**
                         * ⚠️⚠️ **候補に無い値も選択肢に出す。**
                         *   ⚠️ 出さないと select が空を表示し、⚠️ **保存し直した瞬間に消える。**
                         */
                        const current = (item.company ?? '').trim();
                        const isUnlisted = current !== '' && !options.includes(current);

                        return (
                            <div key={index} className="d-flex align-items-center gap-2 flex-wrap">
                                {/* 既存ファイルの場合はPDFアイコンをリンクにする */}
                                {item.path ? (
                                    <a
                                        href={`https://khg-marketing.info/dashboard/api/gateway/handlers${item.path}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary text-decoration-none"
                                        style={{ fontSize: '12px', transition: 'opacity 0.2s', cursor: 'pointer' }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                    >
                                        <i className="fa-solid fa-file-pdf text-danger" style={{ fontSize: '1.2rem' }}></i>
                                    </a>
                                ) : (
                                    <i className="fa-solid fa-file-pdf text-secondary" style={{ fontSize: '1.2rem' }}></i>
                                )}

                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    style={{ minWidth: '160px', flex: '1 1 160px' }}
                                    value={item.name}
                                    placeholder="保存するファイル名"
                                    onChange={(e) => update(index, { name: e.target.value })}
                                />

                                {/* ⚠️ 他社名。⚠️ 候補は competitors_text（この顧客の競合）から */}
                                <select
                                    style={selectStyle}
                                    value={current}
                                    onChange={(e) => update(index, { company: e.target.value })}
                                    title="他社を選択"
                                >
                                    <option value="">他社を選択</option>
                                    {isUnlisted && <option value={current}>{current}（登録外）</option>}
                                    {options.map(c => <option value={c} key={c}>{c}</option>)}
                                </select>

                                {/* ⚠️ 種別。⚠️ PDF_CATEGORIES は ① の許可リストと同じ内容にすること */}
                                <select
                                    style={selectStyle}
                                    value={item.category ?? ''}
                                    onChange={(e) => update(index, { category: e.target.value })}
                                    title="資料の種別を選択"
                                >
                                    <option value="">種別を選択</option>
                                    {PDF_CATEGORIES.map(c => <option value={c} key={c}>{c}</option>)}
                                </select>

                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger py-0 px-2"
                                    onClick={() => {
                                        setCompetitorPdfFile(prev => prev.filter((_, i) => i !== index));
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default memo(TableCompetitorPdf, (prevProps, nextProps) => {
    return prevProps.userName === nextProps.userName &&
        prevProps.competitorPdfFile === nextProps.competitorPdfFile &&
        // ⚠️ 競合の登録を変えたら候補も変わる。⚠️ **比較に入れないと選択肢が古いまま**
        prevProps.competitorsText === nextProps.competitorsText;
});
