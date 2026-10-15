# 2026-10-09 v2.2.178 フェスタ画面：ストラップとチケットを1列にまとめる

## 依頼
`frontend/src/components/header/FestaDashboard.tsx` のストラップ列にチケットもまとめる。
見出し「ストラップ/チケット」、中身「ストラップの色のアイコン / チケット代のアイコン」。

## 変更（frontend/src/components/header/FestaDashboard.tsx）
- 見出し「ストラップ」（70px）→ **「ストラップ/チケット」**（170px）、「チケット」列（80px）を削除
- セル: ストラップの色（従来の四角）＋ `/` ＋ チケット代のラベル（`fa-ticket` アイコン付き、色は従来の TICKET_COLOR）
  - 「なし」「－」は従来どおり色なしの文字
  - title にチケット代（マウスを乗せると見える）
- CSS 追加: `.fe_strap_ticket`（横並び）、`.fe_slash`（区切りの色）
- `COLUMN_COUNT` 12 → 11、表の minWidth 2440 → 2460px
- 追加した関数: なし（`ticketOf` / `strapOf` は変更なし）

## 確認
- eslint 警告なし、`npm run build` 成功 → **`main.83511c36.js`**（deploy-v2.2.178.md を更新）

## 差分（全文）
```diff
diff --git a/frontend/src/components/header/FestaDashboard.tsx b/frontend/src/components/header/FestaDashboard.tsx
index 29e3effb..31426283 100644
--- a/frontend/src/components/header/FestaDashboard.tsx
+++ b/frontend/src/components/header/FestaDashboard.tsx
@@ -317,8 +317,8 @@ const stickyStyle = (i: number): React.CSSProperties => ({
     left: STICKY_LEFT[i], width: STICKY_WIDTH[i], minWidth: STICKY_WIDTH[i], maxWidth: STICKY_WIDTH[i],
 });
 
-/** 表の列数（同期〜担当営業の12列（⚠️ v2.2.173 で相談内容、v2.2.178 で備考を追加） ＋ 営業入力 7ブランド×2） */
-const COLUMN_COUNT = 12 + FESTA_BRANDS.length * FESTA_KINDS.length;
+/** 表の列数（同期〜担当営業の11列（⚠️ v2.2.173 で相談内容、v2.2.178 で備考を追加・ストラップとチケットを1列に） ＋ 営業入力 7ブランド×2） */
+const COLUMN_COUNT = 11 +FESTA_BRANDS.length * FESTA_KINDS.length;
 
 type Props = {
     show: boolean;
@@ -736,6 +736,8 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         .fe_sum .fe_sep, .fe_tbl .fe_sep { border-left: 2px solid #ced4da; }
                         .fe_tbl { font-size: 11px; }
                         .fe_tbl td { border: 1px solid #eef0f3; padding: 3px 4px; vertical-align: middle; }
+                        .fe_strap_ticket { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
+                        .fe_slash { color: #adb5bd; }
                         .fe_strap { display: inline-block; width: 18px; height: 18px; border-radius: 3px; border: 1px solid rgba(0,0,0,.15); margin-right: 3px; vertical-align: middle; }
                         .fe_toggle { width: 34px; height: 18px; border-radius: 999px; border: none; background: #ced4da; position: relative; cursor: pointer; padding: 0; transition: background .15s; }
                         .fe_toggle[data-on="1"] { background: #2dce89; }
@@ -898,7 +900,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                     {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}
 
                     <div className="bg-white rounded shadow-sm border table-responsive">
-                        <Table hover className="m-0 text-nowrap fe_tbl" style={{ minWidth: '2440px' }}>
+                        <Table hover className="m-0 text-nowrap fe_tbl" style={{ minWidth: '2460px' }}>
                             {/*
                               ⚠️ 見出しは3段。⚠️ 指示書の rowSpan / colSpan は入れ替わっていると判断した（2026-10-08 の計画で合意）。
                                 1段目: 同期〜担当営業（縦に3段ぶん）＋ 営業入力（横に14列ぶん）
@@ -910,12 +912,11 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                     <th rowSpan={3} className="fe_stick" style={{ ...thStyle, ...stickyStyle(0) }}>同期</th>
                                     <th rowSpan={3} className="fe_stick" style={{ ...thStyle, ...stickyStyle(1) }}>顧客名</th>
                                     <th rowSpan={3} className="fe_stick fe_stick_last" style={{ ...thStyle, ...stickyStyle(2) }}>ふりがな</th>
-                                    <th rowSpan={3} style={{ ...thStyle, width: '70px' }}>ストラップ</th>
+                                    <th rowSpan={3} style={{ ...thStyle, width: '170px' }}>ストラップ/チケット</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '220px' }}>相談内容</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '240px' }}>備考</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '120px' }}>来場日{sortButton('date', '来場日')}</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '90px' }}>来場時間{sortButton('time', '来場時間')}</th>
-                                    <th rowSpan={3} style={{ ...thStyle, width: '80px' }}>チケット</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '140px' }}>チェックイン</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '140px' }}>チェックアウト</th>
                                     <th rowSpan={3} style={{ ...thStyle, width: '120px' }}>担当営業</th>
@@ -961,10 +962,23 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                             </td>
                                             <td className="fe_stick" style={stickyStyle(1)}><input type="text" style={inputStyle} ref={setRef(item.id, 'name')} defaultValue={item.name ?? ''} onBlur={() => handleBlur(item.id, 'name')} /></td>
                                             <td className="fe_stick fe_stick_last" style={stickyStyle(2)}><input type="text" style={inputStyle} ref={setRef(item.id, 'kana')} defaultValue={item.kana ?? ''} onBlur={() => handleBlur(item.id, 'kana')} /></td>
+                                            {/* ⚠️ v2.2.178: ストラップとチケットを1列にまとめる（ストラップの色 / チケット代） */}
                                             <td className="text-center">
-                                                {strapOf(item).map(color => (
-                                                    <span key={color} className="fe_strap" style={{ backgroundColor: STRAP_COLOR[color] }} title={STRAP_LABEL[color]} aria-label={STRAP_LABEL[color]} role="img" />
-                                                ))}
+                                                <div className="fe_strap_ticket">
+                                                    <span>
+                                                        {strapOf(item).map(color => (
+                                                            <span key={color} className="fe_strap" style={{ backgroundColor: STRAP_COLOR[color] }} title={STRAP_LABEL[color]} aria-label={STRAP_LABEL[color]} role="img" />
+                                                        ))}
+                                                    </span>
+                                                    <span className="fe_slash" aria-hidden="true">/</span>
+                                                    {(() => {
+                                                        const ticket = ticketOf(item);
+                                                        const color = TICKET_COLOR[ticket];
+                                                        return color
+                                                            ? <span className="fe_ticket" style={{ backgroundColor: color }} title={`チケット：${ticket}`}><i className="fa-solid fa-ticket me-1" aria-hidden="true"></i>{ticket}</span>
+                                                            : <span className="text-muted" title={`チケット：${ticket}`}>{ticket}</span>;
+                                                    })()}
+                                                </div>
                                             </td>
                                             <td className="fe_consult_cell">
                                                 {consultOf(item).map(chip => (
@@ -977,15 +991,6 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                             <td className="fe_remarks_cell" title={item.remarks ?? ''}>{item.remarks ?? ''}</td>
                                             <td>{item.date || ''}</td>
                                             <td>{item.time || ''}</td>
-                                            <td className="text-center">
-                                                {(() => {
-                                                    const ticket = ticketOf(item);
-                                                    const color = TICKET_COLOR[ticket];
-                                                    return color
-                                                        ? <span className="fe_ticket" style={{ backgroundColor: color }}>{ticket}</span>
-                                                        : <span className="text-muted">{ticket}</span>;
-                                                })()}
-                                            </td>
                                             <td><input type="text" style={inputStyle} placeholder="2026/10/10 10:05" ref={setRef(item.id, 'check_in_time')} defaultValue={item.check_in_time ?? ''} onBlur={() => handleBlur(item.id, 'check_in_time')} /></td>
                                             <td><input type="text" style={inputStyle} placeholder="2026/10/10 11:30" ref={setRef(item.id, 'check_out_time')} defaultValue={item.check_out_time ?? ''} onBlur={() => handleBlur(item.id, 'check_out_time')} /></td>
                                             <td><input type="text" style={inputStyle} placeholder="担当営業" ref={setRef(item.id, 'staff')} defaultValue={item.staff ?? ''} onBlur={() => handleBlur(item.id, 'staff')} /></td>
```
