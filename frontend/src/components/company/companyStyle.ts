/**
 * 全社報告用フォーマットの見た目（v2.2.264）。クラス名は `co_` で始める（共通の CSS を汚さない）。
 *
 * ⚠️ 階層の見分け方（2026-11-11 の指示：グループ・事業部・課・店舗の区切りが見にくい）
 *   グループ … 上に固定（見出し・グループ予算・グループ実績の3行）
 *   事業部   … 前に広い余白（事業部の名前の帯）＋ 太い線。名前のセルは濃い色で「事業部」の札
 *   課       … 前に余白 ＋ 中くらいの線。名前のセルは課ごとの色で「課」の札
 *   店舗     … 前に細い余白。名前のセルの左に課の色の帯
 * ⚠️ 札と余白の見出しは CSS の ::before で出す（セルの文字に混ぜない。表の文字を比べるテストのため）。
 * ⚠️ 固定する行の高さは 34px に決めてある（2行目・3行目の top がこの高さに合わせてある）。
 */

/** 課の色（名前のセルの背景・帯）。課の並びの順に使う */
export const SECTION_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#64748b', '#0891b2'];
const SECTION_TINTS = ['#eff6ff', '#ecfdf5', '#fffbeb', '#fef2f2', '#f1f5f9', '#ecfeff'];

const PAGE = '#f4f6f8';

export const COMPANY_STYLE = `
.content.company.co_page { overflow: hidden; background: ${PAGE}; }
.co_toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 4px; padding: 8px 14px; background: #fff; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
.co_toolbar > * { white-space: nowrap; flex-shrink: 0; }
.co_toolbar .target { font-size: 13px; }
.co_btn { font-size: 13px; background: #fff; color: #0d6efd; border: 1px solid #0d6efd; border-radius: 6px; padding: 3px 10px; margin: 4px; cursor: pointer; }
.co_btn:hover { background: #0d6efd; color: #fff; }
.co_btn.spec { color: #198754; border-color: #198754; }
.co_btn.spec:hover { background: #198754; color: #fff; }
.co_check { font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; margin: 4px 6px; color: #374151; }
.co_note { font-size: 11px; color: #6b7280; margin-left: auto; padding-right: 4px; }

/* ⚠️ 余白は .co_scroll ではなく中の .co_pad に付ける（.co_scroll に付けると、固定する行・列がその分だけずれて止まる） */
.co_scroll { flex: 1 1 auto; min-height: 0; overflow: auto; }
.co_pad { display: flex; justify-content: center; width: max-content; min-width: 100%; box-sizing: border-box; padding: 14px 18px 48px; }
.co_card { width: max-content; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 1px 3px rgba(16,24,40,.06); }
.co_tbl { border-collapse: separate; border-spacing: 0; font-size: 12px; font-variant-numeric: tabular-nums; color: #1f2937; margin: 0; }
.co_tbl td { padding: 4px 6px; height: 30px; text-align: center; vertical-align: middle; background: #fff; border-bottom: 1px solid #eef0f3; border-right: 1px solid #f3f4f6; white-space: nowrap; }
.co_tbl .co_m { min-width: 64px; width: 64px; max-width: 64px; }

/* 左の2列（固定） */
.co_tbl td.co_c1, .co_tbl td.co_c2 { position: sticky; z-index: 10; white-space: normal; line-height: 1.35; border-right: 1px solid #e5e7eb; }
.co_tbl td.co_c1 { left: 0; min-width: 104px; width: 104px; max-width: 104px; }
.co_tbl td.co_c2 { left: 104px; min-width: 104px; width: 104px; max-width: 104px; text-align: left; padding-left: 10px; }
.co_tbl td.co_c1[colspan="2"] { min-width: 208px; width: 208px; max-width: 208px; }

/* 上に固定する3行 */
.co_tbl tr.co_s0 > td, .co_tbl tr.co_s1 > td, .co_tbl tr.co_s2 > td { position: sticky; z-index: 20; height: 34px; }
.co_tbl tr.co_s0 > td { top: 0; background: #f8fafc; color: #475569; font-weight: 600; letter-spacing: .04em; border-bottom: 1px solid #e2e8f0; }
.co_tbl tr.co_s1 > td { top: 34px; }
.co_tbl tr.co_s2 > td { top: 68px; border-bottom: 2px solid #cbd5e1; }
.co_tbl tr.co_s0 > td.co_c1, .co_tbl tr.co_s1 > td.co_c1, .co_tbl tr.co_s2 > td.co_c1 { z-index: 30; }
.co_tbl tr.co_s1 > td.co_c1, .co_tbl tr.co_s2 > td.co_c1 { font-weight: 700; letter-spacing: .06em; text-align: center; }

/* 見出しのセル */
.co_tbl td.co_h-budget { color: #b42318; background: #fef3f2; }
.co_tbl td.co_h-result { color: #1d4ed8; background: #eff6ff; font-weight: 600; }
.co_tbl td.co_h-division { background: #111827; color: #fff; font-weight: 700; font-size: 13px; }
.co_tbl td.co_h-section { font-weight: 700; }
.co_tbl td.co_h-shop { font-weight: 600; border-left: 4px solid #cbd5e1; }
.co_tbl td.co_h-division::before, .co_tbl td.co_h-section::before { display: block; width: max-content; margin: 0 auto 3px; font-size: 9px; font-weight: 600; letter-spacing: .1em; border-radius: 3px; padding: 0 6px; line-height: 1.6; }
.co_tbl td.co_h-division::before { content: '事業部'; background: #374151; color: #e5e7eb; }
.co_tbl td.co_h-section::before { content: '課'; background: rgba(15,23,42,.08); color: #334155; }
${SECTION_COLORS.map((c, i) => `.co_tbl td.co_h-section.co_col${i} { background: ${SECTION_TINTS[i]}; border-left: 4px solid ${c}; }
.co_tbl td.co_h-shop.co_col${i} { border-left-color: ${c}; }`).join('\n')}

/* 区切り（まとまりの最初の行の上の線） */
.co_tbl tr.co_l-division.co_first > td { border-top: 3px solid #111827; }
.co_tbl tr.co_l-section.co_first > td { border-top: 2px solid #64748b; }
.co_tbl tr.co_l-shop.co_first > td { border-top: 1px solid #94a3b8; }
.co_tbl tr.co_l-division.co_k-result > td, .co_tbl tr.co_l-section.co_k-result > td { border-bottom: 1px solid #cbd5e1; }
.co_tbl tr.co_l-shop.co_k-result > td { border-bottom: 1px solid #cbd5e1; }

/* 余白の行（事業部・課・店舗の前） */
.co_tbl tr.co_gap > td { background: ${PAGE}; border: 0; padding: 0; height: 5px; }
.co_tbl tr.co_gap.co_gap2 > td { height: 14px; }
.co_tbl tr.co_gap.co_gap3 > td { height: 40px; vertical-align: bottom; text-align: left; }
.co_tbl tr.co_gap.co_gap3 > td::before { content: attr(data-label); position: sticky; left: 4px; display: inline-block; padding: 0 0 6px 2px; font-size: 14px; font-weight: 700; color: #111827; letter-spacing: .06em; }
.co_tbl td.co_sep { background: ${PAGE}; border: 0; min-width: 14px; width: 14px; max-width: 14px; padding: 0; }

/* 数字のセル */
.co_n { position: relative; }
.co_tbl td.co_on-contract { color: #1d4ed8; background: #eff6ff; font-weight: 600; }
.co_tbl td.co_on-budget { color: #b42318; background: #fef3f2; }
.co_tbl td.co_on-sales { color: #0f766e; background: #f0fdfa; font-weight: 600; }
.co_tbl td.co_click { cursor: pointer; }
.co_tbl td.co_click:hover { background: #dbeafe; text-decoration: underline; }
.co_tbl tr.co_k-staff:hover > td:not(.co_on-contract):not(.co_on-sales):not(.co_c1):not(.co_sep) { background: #fafafa; }
.co_broker { color: #198754; margin-left: 3px; }
.co_cancel { background: #ef4444; color: #fff; padding: 0 4px; font-size: 8px; border-radius: 8px; margin-left: 3px; font-weight: 600; }
.co_ly { position: absolute; top: 9px; font-size: 8px; background: #f1f5f9; min-width: 15px; height: 15px; line-height: 15px; border-radius: 8px; color: #64748b; font-weight: 400; padding: 0 2px; }

/* 予算の欄（欄を離れたときに保存する） */
.co_tbl td.co_in-shop { background: #fef3f2; }
.co_in { width: 46px; height: 22px; text-align: center; border-radius: 5px; color: #b42318; font-size: 12px; background: transparent; border: 1px solid transparent; outline: none; }
.co_in-shop .co_in:hover { border-color: #fda29b; }
.co_in-staff .co_in { border: 1px dashed #e5e7eb; }
.co_in-staff .co_in:hover { border-color: #fda29b; }
.co_in:focus { background: #fff; border: 1px solid #f97066; box-shadow: 0 0 0 2px rgba(249,112,102,.2); }

@media screen and (max-width: 768px) {
  .co_pad { padding: 6px 4px 30px; }
  .co_tbl { font-size: 9px; }
  .co_tbl .co_m { min-width: 40px; width: 40px; max-width: 40px; }
  .co_tbl td { padding: 2px 3px; }
  .co_tbl td.co_c1, .co_tbl td.co_c2 { min-width: 64px; width: 64px; max-width: 64px; }
  .co_tbl td.co_c2 { left: 64px; padding-left: 4px; }
  .co_tbl td.co_c1[colspan="2"] { min-width: 128px; width: 128px; max-width: 128px; }
  .co_in { width: 30px; font-size: 9px; }
}
`;
