import React from 'react';

/**
 * ランキング系の画面（customer/ と shop/）で使う共通の見た目。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **2026-09-22 の指示で SaaS 風へ作り替えた。**
 *   ⚠️ 対象は ⚠️ **customer/ と shop/ の4画面**
 *     （CustomerOrder / CustomerKaeru / ShopOrder / ShopKaeru）。
 *
 * ⚠️⚠️ **CSS をここに1つだけ置くこと。**
 *   ⚠️ 画面ごとに `<style>` を書くと、⚠️ **4枚が少しずつずれていく。**
 *   ⚠️ ⚠️ **見た目を直すときはこのファイルだけを直す。**
 *
 * ⚠️ 色は header/EditBlackList.tsx・header/SatBaseDatabase.tsx と同じ系統。
 *   ⚠️ ⚠️ **画面ごとに色を変えないこと。**
 *
 * ⚠️⚠️ **KPIの計算・並べ替え・絞り込みには一切関与しない。**
 *   ⚠️ ⚠️ **ここは見た目だけである。**
 * ─────────────────────────────────────────────
 */

export const RankingStyle = () => (
    <style>{`
        .rk_wrap { font-size: 13px; color: #1f2937; padding: 16px 20px 24px; }
        .rk_head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .rk_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
        .rk_note { font-size: 11px; color: #6b7280; }

        .rk_kpi { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .rk_kpi_card { flex: 1 1 140px; background: #fff; border: 1px solid #e5e7eb;
                       border-radius: 10px; padding: 10px 14px; }
        .rk_kpi_label { font-size: 11px; color: #6b7280; }
        .rk_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2;
                        font-variant-numeric: tabular-nums; }
        .rk_kpi_sub { font-size: 11px; color: #9ca3af; font-variant-numeric: tabular-nums; }

        .rk_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap;
                  background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px;
                  padding: 10px 12px; margin-bottom: 12px; }
        .rk_field { display: flex; flex-direction: column; }
        .rk_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
        .rk_select { border: 1px solid #d1d5db; border-radius: 8px; padding: 6px 10px;
                     font-size: 12px; background: #fff; color: #1f2937; outline: none; }
        .rk_tilde { align-self: center; color: #9ca3af; padding: 0 2px; }
        .rk_spacer { margin-left: auto; }
        .rk_btn { border-radius: 8px; padding: 7px 14px; font-size: 12px; font-weight: 700;
                  cursor: pointer; border: 1px solid transparent; white-space: nowrap;
                  background: #2563eb; color: #fff; }
        .rk_btn:hover { background: #1d4ed8; }
        .rk_btn_ghost { background: #fff; color: #4b5563; border-color: #d1d5db; }
        .rk_btn_ghost:hover { background: #f3f4f6; }

        /* ⚠️ 表。⚠️ 見出しと1列目を固定する（列が20前後あり横に長いため） */
        .rk_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto;
                         background: #fff; max-height: 70vh; }
        .rk_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
        .rk_th { position: sticky; top: 0; z-index: 2; background: #f8fafc;
                 border-bottom: 1px solid #e5e7eb; padding: 9px 12px; text-align: center;
                 font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
        .rk_th_sort { cursor: pointer; user-select: none; }
        .rk_th_sort:hover { background: #eef2f7; }
        /* ⚠️⚠️ 1列目は上にも左にも固定する。⚠️ z-index は見出しより大きくすること */
        .rk_th_name { position: sticky; left: 0; z-index: 3; text-align: left; }
        .rk_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
        .rk_sort_icon.is_active { color: #2563eb; }

        .rk_td { border-bottom: 1px solid #f1f5f9; padding: 7px 12px; text-align: center;
                 white-space: nowrap; font-variant-numeric: tabular-nums; }
        /* ⚠️⚠️ 1列目は背景を自前で持つ。⚠️ 透明にすると固定時に中身が透ける */
        .rk_td_name { position: sticky; left: 0; z-index: 1; background: #fff;
                      text-align: left; font-weight: 700; }
        .rk_row:hover > .rk_td { background: #f8fafc; }
        .rk_row:hover > .rk_td_name { background: #f8fafc; }
        /* ⚠️ 率の列は数より薄くする。⚠️ 数と率が交互に並ぶため、目で追えなくなる */
        .rk_rate { color: #6b7280; }
        /* ⚠️ 合計・全社などのまとめ行 */
        .rk_row_total > .rk_td { background: #f8fafc; font-weight: 700; }
        .rk_row_total > .rk_td_name { background: #f8fafc; }
    `}</style>
);

/**
 * 並べ替えの向きを示す記号。
 *
 * ⚠️ 押している列だけ色を付ける。⚠️ **押していない列にも `▾` を出す**
 *   （⚠️ 押せる列だと分かるようにするため）。
 */
export const SortIcon = ({ active, order }: { active: boolean; order: string }) => (
    <span className={`rk_sort_icon${active ? ' is_active' : ''}`}>
        {active ? (order === 'asc' ? '▲' : '▼') : '▾'}
    </span>
);
