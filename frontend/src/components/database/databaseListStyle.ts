/**
 * 顧客DB の一覧の CSS（建売 DatabaseKaeru.tsx・注文 DatabaseOrder.tsx で共通。v2.2.291 で DatabaseKaeru.tsx から移した）。
 * ⚠️ 画面の外側に .database と .dbk_wrap を付けて使う。
 *
 * v2.2.289 左の4列（編集・店舗・顧客名・担当営業）を横に動かしても残す（接頭辞 dbk_）。
 * ⚠️ 幅と left をそろえること（1列目の幅 = 2列目の left …）。⚠️ 背景を塗らないと、後ろの列が透けて見える。
 * ⚠️ 境目の線は border で引く（box-shadow は Bootstrap がセルの色に使っている）。
 *
 * v2.2.290 見た目を rankingUi.tsx（rk_）にそろえた。⚠️ 色は rk_ と同じ値を使い、画面だけ違う色にしない。
 * ⚠️ 絞り込み欄は既存の .target（SearchBox.css・共通）をこの画面の中だけ上書きする（共通 CSS は触らない）。
 * ⚠️ この文字列の中にバッククォートを書かないこと（テンプレートリテラルが閉じてビルドが壊れる）。
 */
export const DBK_CSS = `
.database .dbk_fix { position: sticky; z-index: 2; background-color: #fff; }
.database .dbk_fix1 { left: 0; width: 70px; min-width: 70px; }
.database .dbk_fix2 { left: 70px; width: 100px; min-width: 100px; }
.database .dbk_fix3 { left: 170px; width: 170px; min-width: 170px; }
.database .dbk_fix4 { left: 340px; width: 100px; min-width: 100px; border-right: 2px solid #d1d5db; }
.database tr.sticky-header > .dbk_fix { z-index: 21; }

.dbk_bar { gap: 2px; align-items: center; }
.dbk_bar .target { height: 32px; border: 1px solid #d1d5db; border-radius: 8px; padding: 0 10px;
                   font-size: 12px; background-color: #fff; color: #1f2937; outline: none; }
.dbk_bar .target:focus { border-color: #2563eb; }
.dbk_bar .target::placeholder { color: #9ca3af; }

.dbk_count_num { font-size: 16px; font-weight: 700; color: #1f2937; font-variant-numeric: tabular-nums; }
.dbk_count_sub { font-size: 11px; color: #6b7280; }
.dbk_wrap .rk_select { padding: 3px 8px; font-size: 11px; }

.dbk_wrap .custom-pagination li button { background: #fff; color: #4b5563; border: 1px solid #d1d5db;
                                          border-radius: 8px; padding: 4px 10px; font-size: 11px; }
.dbk_wrap .custom-pagination li button:hover { background: #f3f4f6; }
.dbk_wrap .custom-pagination li.active button { background: #2563eb; color: #fff; border-color: #2563eb; font-weight: 700; }

.dbk_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
.dbk_wrap .dbk_table { margin-bottom: 0; color: #1f2937; border-style: hidden; }
.dbk_wrap .dbk_table td { border-color: #eef2f7; padding: 7px 8px; font-weight: 400;
                          font-variant-numeric: tabular-nums; }
.dbk_wrap .dbk_table tr.sticky-header > td { background-color: #f8fafc; color: #4b5563;
                                              font-weight: 700; font-size: calc(1em - 1px); }
.dbk_wrap .dbk_table tr:not(.sticky-header):hover > td { background-color: #f8fafc; }
.dbk_wrap .dbk_table tr:not(.sticky-header) > .dbk_fix3 { font-weight: 700; }

.dbk_edit { border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #2563eb;
            font-size: 11px; font-weight: 700; padding: 3px 10px; cursor: pointer; white-space: nowrap; }
.dbk_edit:hover { background: #eff6ff; border-color: #2563eb; }
`;
