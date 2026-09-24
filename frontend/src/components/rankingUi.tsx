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
        /*
          ⚠️ 目立たせたい行（2026-09-22 の指示）。
            ⚠️⚠️ **背景ではなく文字色を変える。**
              ⚠️ 背景を変えたら ⚠️ **かえって読みづらいと利用者から指摘があった。**
            ⚠️ ⚠️ **1列目（固定列）にも効くよう、td ごとに色を当てている。**
        */
        .rk_row_accent > .rk_td { color: #2563eb; font-weight: 700; }
        .rk_row_accent > .rk_td.rk_rate { color: #60a5fa; }
        /* ⚠️ 合計・全社などのまとめ行 */
        .rk_row_total > .rk_td { background: #f8fafc; font-weight: 700; }
        .rk_row_total > .rk_td_name { background: #f8fafc; }

        /*
          ⚠️⚠️ **既存の表にそのまま被せるための一式**（rank/ と map/ 用）。
            ⚠️ あちらは ⚠️ **2段見出し（colSpan / rowSpan）** や
              ⚠️ **react-bootstrap の Table** を使っており、
              ⚠️ ⚠️ **セルの書き換えは数字のズレを招く。**
            ⚠️ そこで ⚠️ **中身には触らず、見た目だけを上書きする。**
          ⚠️ .rk_plain を表の外側に付けて使う。
          ⚠️⚠️ **この style の中にバッククォートを書かないこと。**
            ⚠️ ⚠️ **テンプレートリテラルがそこで閉じてビルドが壊れる。**
            ⚠️ 2026-09-22、⚠️ **CSSのコメントに書いて実際に壊した。**
        */
        .rk_plain { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; }
        .rk_plain table { margin-bottom: 0; font-size: 12px; }
        .rk_plain th, .rk_plain td {
            border-color: #eef2f7; padding: 7px 10px; vertical-align: middle;
            font-variant-numeric: tabular-nums;
        }
        .rk_plain thead td, .rk_plain thead th, .rk_plain tr:first-child > td {
            background: #f8fafc; font-weight: 700; font-size: 11px; color: #4b5563;
        }
        .rk_plain tbody tr:hover > td { background: #f8fafc; }

        /*
          ⚠️⚠️ **見出しが縦書きになるのを防ぐ**（2026-09-24 の指示）。

            ⚠️ 「粗利額/契約数(率)」のような長い見出しが、
              ⚠️ ⚠️ **列幅に収まらず1文字ずつ改行されて縦に伸びていた。**

            ⚠️ 直し方は ⚠️ **折り返さない ＋ はみ出したぶんは横スクロール。**
              ⚠️ ⚠️ **表の幅をピクセルで決め打ちしない。**
                ⚠️ 列の数と文字数は事業ごとに違い、⚠️ **決め打つと必ずどこかで溢れる。**
              ⚠️ width: max-content で ⚠️ **中身に合わせて伸ばし**、
                ⚠️ 外側（.rk_scroll_x）で受け止める。
              ⚠️ min-width: 100% は ⚠️ **列が少ないときに表が痩せないため。**

            ⚠️⚠️ **この style の中にバッククォートを書かないこと**（上にも同じ注意がある）。
              ⚠️ ⚠️ **2026-09-22 と 2026-09-24 に、CSSのコメントに書いて2度壊した。**
        */
        /*
          ⚠️⚠️ **画面の一番外側に付ける**（2026-09-24）。

            ⚠️ App.tsx はメニューと本文を ⚠️ **d-flex** で並べており、
              ⚠️ ⚠️ **flex の子は既定（min-width: auto）で中身より小さくならない。**
            ⚠️ ⚠️ **そのため囲みが表の幅まで広がり、スクロールが起きなかった。**
              ⚠️ 2026-09-24、⚠️ **「スクロールもできない」と実際に報告を受けた。**
            ⚠️ ⚠️ **min-width: 0 を付けて初めて中の overflow が効く。**
        */
        .rk_page { flex: 1 1 auto; min-width: 0; width: 100%; }

        .rk_scroll_x {
            width: 100%;
            overflow: auto;
            /*
              ⚠️⚠️ **高さを画面内に収めること**（2026-09-24 の追加指示）。
                ⚠️ 高さを決めないと ⚠️ **横スクロールバーが表の一番下に付く。**
                  ⚠️ ⚠️ **行が多いと画面の外に出てしまい、利用者からは見えない。**
                ⚠️ 78vh は ⚠️ **見出しと絞り込みのぶんを引いた残り**の目安。
            */
            max-height: 78vh;
        }
        .rk_scroll_x > table { width: max-content; min-width: 100%; }
        .rk_scroll_x th, .rk_scroll_x td { white-space: nowrap; }

        /*
          ⚠️⚠️ **スクロールバーを必ず見えるようにする。**
            ⚠️ Windows でも macOS でも、⚠️ **既定では触るまで出ないことがある。**
            ⚠️ ⚠️ **横に隠れている列があると気づけないのがいちばん困る。**
        */
        .rk_scroll_x { scrollbar-width: auto; scrollbar-color: #94a3b8 #eef2f7; }
        .rk_scroll_x::-webkit-scrollbar { width: 12px; height: 12px; }
        .rk_scroll_x::-webkit-scrollbar-track { background: #eef2f7; border-radius: 999px; }
        .rk_scroll_x::-webkit-scrollbar-thumb {
            background: #94a3b8; border-radius: 999px; border: 3px solid #eef2f7;
        }
        .rk_scroll_x::-webkit-scrollbar-thumb:hover { background: #64748b; }

        /*
          ⚠️⚠️ **react-bootstrap の Card / Form.Select を使っている画面用**（map/）。
            ⚠️ あちらは ⚠️ **地図と表が絡み合っており、要素の置き換えは事故になりやすい。**
            ⚠️ そこで ⚠️ **外側に .rk_screen を付けて、色と角だけを揃える。**
          ⚠️ ⚠️ **レイアウト（Row / Col）には触っていない。**
        */
        .rk_screen { color: #1f2937; }
        .rk_screen .card { border: 1px solid #e5e7eb !important; border-radius: 10px;
                           box-shadow: none !important; background: #f8fafc; }
        .rk_screen .card .card-body { padding: 10px 12px; }
        .rk_screen .form-select, .rk_screen .form-control {
            border: 1px solid #d1d5db; border-radius: 8px; font-size: 12px; background-color: #fff;
        }
        .rk_screen .form-select:focus, .rk_screen .form-control:focus {
            border-color: #2563eb; box-shadow: none;
        }
        .rk_screen .table { font-size: 12px; margin-bottom: 0; }
        .rk_screen .table th, .rk_screen .table td {
            border-color: #eef2f7; padding: 7px 10px; vertical-align: middle;
            font-variant-numeric: tabular-nums;
        }
        .rk_screen .table thead th { background: #f8fafc; font-weight: 700; font-size: 11px; color: #4b5563; }
        .rk_screen .btn-primary { background: #2563eb; border-color: #2563eb; }
        .rk_screen .btn-primary:hover { background: #1d4ed8; border-color: #1d4ed8; }
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
