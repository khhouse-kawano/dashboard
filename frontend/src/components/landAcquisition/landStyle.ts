/**
 * 土地仕入の画面で共通のスタイル（接頭辞 ld_。共通CSSを汚さない）。
 * ⚠️ 見た目は GoogleReview.tsx・SatBaseDatabase.tsx にそろえる（絞り込みバー・KPI カード・見出しで並べ替える表・注意書き）。
 */
export const LAND_CSS = `
.ld_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column; padding: 16px 40px 20px; box-sizing: border-box; overflow: auto; }
.ld_inner { width: 100%; max-width: 1600px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; min-height: 0; flex: 1; }
.ld_head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ld_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
.ld_note { font-size: 11px; color: #6b7280; }
.ld_btn { font-size: 12px; padding: 5px 12px; border: 1px solid #d1d5db; border-radius: 999px; background: #fff; color: #374151; cursor: pointer; white-space: nowrap; }
.ld_btn:hover { background: #f3f4f6; }
.ld_btn:disabled { opacity: .5; cursor: default; }
.ld_btn.is_primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.ld_btn.is_primary:hover { background: #1d4ed8; }
.ld_btn.is_danger { color: #b91c1c; border-color: #fecaca; }
.ld_btn.is_on { border-color: #93c5fd; background: #eff6ff; color: #1d4ed8; }
.ld_btn.is_sm { padding: 2px 9px; font-size: 11px; }
.ld_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
.ld_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
.ld_input, .ld_select, .ld_textarea { font-size: 12px; padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #1f2937; }
.ld_input:focus, .ld_select:focus, .ld_textarea:focus { outline: 2px solid #bfdbfe; border-color: #60a5fa; }
.ld_input.is_wide { width: 220px; }
.ld_textarea { width: 100%; min-height: 64px; resize: vertical; }
.ld_seg { display: inline-flex; border: 1px solid #d1d5db; border-radius: 999px; overflow: hidden; }
.ld_seg button { font-size: 12px; padding: 4px 12px; border: none; background: #fff; color: #374151; cursor: pointer; }
.ld_seg button.is_on { background: #2563eb; color: #fff; }
.ld_kpi { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.ld_kpi_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; min-width: 0; }
.ld_kpi_label { font-size: 11px; color: #6b7280; }
.ld_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.ld_kpi_value small { font-size: 11px; font-weight: 400; color: #6b7280; margin-left: 2px; }
.ld_kpi_sub { font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; gap: 6px; }
.ld_kpi_card.is_warn { border-color: #fecaca; background: #fef2f2; }
.ld_kpi_card.is_click { cursor: pointer; }
.ld_kpi_card.is_click:hover { border-color: #93c5fd; }
.ld_meter { height: 5px; border-radius: 999px; background: #eef2f7; margin-top: 6px; position: relative; overflow: visible; }
.ld_meter > i { display: block; height: 100%; border-radius: 999px; background: #2563eb; }
.ld_meter > i.is_mid { background: #f59e0b; }
.ld_meter > i.is_low { background: #ef4444; }
.ld_meter > i.is_hit { background: #16a34a; }
.ld_meter > u { position: absolute; top: -3px; width: 2px; height: 11px; background: #111827; opacity: .45; }
.ld_card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; }
.ld_card_head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.ld_card_title { font-weight: 700; font-size: 13px; }
.ld_badge { font-size: 10px; color: #4b5563; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.ld_badge.is_warn { background: #fee2e2; color: #b91c1c; }
.ld_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; }
.ld_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 6px 12px; }
.ld_ok { font-size: 12px; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 6px 12px; }
.ld_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; }
/* ⚠️ 30件ずつ読む一覧は、枠に高さの上限が要る（無いと表が伸びるだけでスクロールせず、全件を読んでしまう。DatabaseBroker.tsx と同じ） */
.ld_table_wrap.is_fill { max-height: calc(100vh - 200px); min-height: 240px; }
.ld_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.ld_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
.ld_th.is_sort { cursor: pointer; user-select: none; }
.ld_th.is_sort:hover { background: #eef2f7; }
.ld_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
.ld_sort_icon.is_active { color: #2563eb; }
.ld_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; }
.ld_row:hover > .ld_td { background: #f8fafc; }
.ld_row.is_click { cursor: pointer; }
.ld_row.is_due > .ld_td { background: #fff7f7; }
.ld_num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ld_nowrap { white-space: nowrap; }
.ld_sub { font-size: 10px; color: #9ca3af; }
.ld_empty { color: #9ca3af; font-size: 12px; text-align: center; padding: 24px; }
.ld_more { color: #6b7280; font-size: 11px; padding: 10px 12px; }
.ld_pill { display: inline-block; font-size: 11px; border-radius: 999px; padding: 2px 9px; background: #f3f4f6; color: #374151; white-space: nowrap; border: 1px solid transparent; }
.ld_pill.s-info { background: #eff6ff; color: #1d4ed8; }
.ld_pill.s-prop { background: #f5f3ff; color: #6d28d9; }
.ld_pill.s-offer { background: #fff7ed; color: #c2410c; }
.ld_pill.s-done { background: #f0fdf4; color: #15803d; }
.ld_pill.s-settle { background: #ecfeff; color: #0e7490; }
.ld_pill.s-drop { background: #f3f4f6; color: #6b7280; }
.ld_pill.s-ng { background: #fef2f2; color: #b91c1c; }
.ld_pill.s-wait { background: #fffbeb; color: #b45309; }
select.ld_pill { cursor: pointer; padding-right: 4px; }
.ld_due { font-size: 11px; font-weight: 700; white-space: nowrap; }
.ld_due.over { color: #b91c1c; }
.ld_due.today { color: #c2410c; }
.ld_due.soon { color: #b45309; }
.ld_due.ok { color: #15803d; }
.ld_due.unset { color: #9ca3af; font-weight: 400; }
.ld_tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.ld_grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px 14px; }
.ld_grid .is_full { grid-column: 1 / -1; }
.ld_field { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.ld_field .ld_input, .ld_field .ld_select { width: 100%; }
.ld_section { border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 12px; }
.ld_section_title { font-weight: 700; font-size: 12px; margin-bottom: 8px; color: #374151; }
.ld_two { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 12px; }
.ld_link { color: #2563eb; text-decoration: none; }
.ld_link:hover { text-decoration: underline; }
.ld_counter { display: flex; align-items: center; gap: 4px; }
.ld_counter button { width: 26px; height: 26px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; cursor: pointer; font-weight: 700; }
.ld_counter input { width: 52px; text-align: center; }
@media (max-width: 900px) { .ld_wrap { padding: 12px 16px 16px; } .ld_two { grid-template-columns: 1fr; } }
`;

/** ステータスの色（ld_pill のクラス） */
export const STATUS_CLASS: Record<string, string> = {
    情報取得: 's-info', 社長提案: 's-prop', 買付: 's-offer', 契約: 's-done', 決済完了: 's-settle', 見送り: 's-drop',
};
export const REPLY_CLASS: Record<string, string> = { 承諾: 's-done', 否決: 's-ng', '保留・再交渉': 's-wait' };

/** 達成率の色（メーターのクラス） */
export const rateClass = (p: number | null): string => (p === null ? '' : p >= 100 ? 'is_hit' : p >= 70 ? 'is_mid' : 'is_low');
