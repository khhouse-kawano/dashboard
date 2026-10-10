# 2026-10-10 v2.2.181 フェスタ画面：集計表に来場済みの人数

## 依頼
- `frontend/src/components/header/FestaDashboard.tsx` で来場済みの顧客を表示
- 新しいブランチ（v2.2.181）
- 来場予定時間の数の隣に、色付きで check_in_time が真の顧客数を表示

## 変更（frontend/src/components/header/FestaDashboard.tsx）
- 集計表の **来場予定時間** の各マス: 予約数の右に緑のラベル「✓来場済み人数」
  - 予約 0 のマスは従来どおり薄い 0 のみ
  - 来場 0 のマスは「✓0」を灰色で（まだ誰も来ていないとわかるように）
  - title に「来場済み ◯人 ／ 予約 ◯人」
- **予約数** の列（日付ごと・合計）にも同じラベルを付けた
- 見出しの補足に「✓来場済み の数字は check_in_time が入っている人数」
- 相談内容・検討内容の列は変更なし

### 追加した関数・CSS
- `isArrived(item)`（check_in_time に値があるか）
- `timeCell(key, first)`（集計表の描画内）
- Line 型に `arrived` / `arrivedTime`
- CSS `.fe_arrived` / `.fe_arrived i` / `.fe_arrived[data-zero="1"]`

### 別コミット
- 9528876a: v2.2.179 の作業ツリーに残っていた注意書きの文言修正（利用者の編集）をそのままコミット

## その他
- version.ts 2.2.181、`backend/scripts/sql/2026-10-10_update_log_2.2.181.sql`（ローカル投入済み）

## 確認
- eslint 警告なし、`npm run build` 成功 → **`main.79f8525f.js`**
- 画面での見た目は未確認（ローカルのフェスタ予約は check_in_time の入った行で確認していない）

## 差分（全文）
```diff
diff --git a/frontend/src/components/header/FestaDashboard.tsx b/frontend/src/components/header/FestaDashboard.tsx
index 3836bc52..6645e3b8 100644
--- a/frontend/src/components/header/FestaDashboard.tsx
+++ b/frontend/src/components/header/FestaDashboard.tsx
@@ -272,6 +272,9 @@ const timeOrder = (value: string): number => {
 
 const UNSET_LABEL = '未設定';
 
+/** 来場済みか（v2.2.181）。⚠️ check_in_time に値が入っていれば来場済み（⚠️ 画面上部の「チェックイン ◯件」と同じ判定） */
+const isArrived = (item: { check_in_time: string | null }): boolean => (item.check_in_time ?? '').trim() !== '';
+
 const rankByCount = (counts: Map<string, number>): string[] =>
     [...counts.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], 'ja')).map(([key]) => key);
 
@@ -423,8 +426,9 @@ const FestaDashboard = ({ show, setShow }: Props) => {
         const interviews = rankByCount(interviewTotal);
         const requests = rankByCount(requestTotal);
 
-        type Line = { total: number; time: Map<string, number>; interview: Map<string, number>; request: Map<string, number> };
-        const emptyLine = (): Line => ({ total: 0, time: new Map(), interview: new Map(), request: new Map() });
+        // ⚠️ v2.2.181: arrived / arrivedTime … 来場済み（check_in_time が入っている）の人数
+        type Line = { total: number; arrived: number; time: Map<string, number>; arrivedTime: Map<string, number>; interview: Map<string, number>; request: Map<string, number> };
+        const emptyLine = (): Line => ({ total: 0, arrived: 0, time: new Map(), arrivedTime: new Map(), interview: new Map(), request: new Map() });
         const lines = new Map<string, Line>(dates.map(d => [d, emptyLine()]));
         const sum = emptyLine();
         const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
@@ -433,9 +437,14 @@ const FestaDashboard = ({ show, setShow }: Props) => {
             const line = lines.get((item.date || '').trim() || UNSET_LABEL);
             if (!line) return;
             const time = normalizeTime(item.time) || UNSET_LABEL;
+            const arrived = isArrived(item);
             [line, sum].forEach(target => {
                 target.total += 1;
                 add(target.time, time);
+                if (arrived) {
+                    target.arrived += 1;
+                    add(target.arrivedTime, time);
+                }
                 splitValues(item.interview).forEach(v => add(target.interview, v));
                 splitValues(item.request).forEach(v => add(target.request, v));
             });
@@ -733,6 +742,9 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         .fe_sum .fe_total { font-weight: 700; color: #32325d; }
                         .fe_sum tr.fe_sumrow td { background: #f6f9fc; font-weight: 700; }
                         .fe_sum .fe_zero { color: #ced4da; }
+                        .fe_arrived { display: inline-flex; align-items: center; gap: 2px; margin-left: 4px; padding: 0 5px; border-radius: 999px; background: #2dce89; color: #fff; font-size: 10px; font-weight: 700; line-height: 1.5; }
+                        .fe_arrived i { font-size: 8px; }
+                        .fe_arrived[data-zero="1"] { background: #e9ecef; color: #8898aa; }
                         .fe_sum .fe_sep, .fe_tbl .fe_sep { border-left: 2px solid #ced4da; }
                         .fe_tbl { font-size: 11px; }
                         .fe_tbl td { border: 1px solid #eef0f3; padding: 3px 4px; vertical-align: middle; }
@@ -811,7 +823,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                             <div style={{ fontSize: '12px', fontWeight: 700, color: '#32325d', marginBottom: '4px' }}>
                                 {FESTA_TITLE}
                                 <small style={{ fontSize: '10px', fontWeight: 400, color: '#8898aa', marginLeft: '8px' }}>
-                                    予約 {summaryTable.sum.total.toLocaleString()}件 ／ 相談内容・検討内容は複数選択のため予約数と一致しません
+                                    予約 {summaryTable.sum.total.toLocaleString()}件 ／ <span className="fe_arrived" style={{ marginLeft: 0 }}><i className="fa-solid fa-check" aria-hidden="true"></i>来場済み</span> の数字は check_in_time が入っている人数 ／ 相談内容・検討内容は複数選択のため予約数と一致しません
                                 </small>
                             </div>
                             <div className="fe_sum_wrap">
@@ -838,11 +850,28 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                                 const n = map.get(key) ?? 0;
                                                 return <td key={key} className={`${n === 0 ? 'fe_zero' : ''}${first ? ' fe_sep' : ''}`}>{n}</td>;
                                             };
+                                            /**
+                                             * 来場予定時間（v2.2.181）。⚠️ 予約数の隣に ⚠️ **来場済み（check_in_time あり）の人数**を色付きで出す。
+                                             *   ⚠️ 予約が 0 の枠は従来どおり薄い 0 だけ。⚠️ 来場 0 の枠は「✓0」を薄く出す（⚠️ まだ誰も来ていないとわかるように）。
+                                             */
+                                            const timeCell = (key: string, first: boolean) => {
+                                                const n = line.time.get(key) ?? 0;
+                                                const arrived = line.arrivedTime.get(key) ?? 0;
+                                                return (
+                                                    <td key={key} className={`${n === 0 ? 'fe_zero' : ''}${first ? ' fe_sep' : ''}`}>
+                                                        {n}
+                                                        {n > 0 && <span className="fe_arrived" data-zero={arrived === 0 ? '1' : '0'} title={`来場済み ${arrived}人 ／ 予約 ${n}人`}><i className="fa-solid fa-check" aria-hidden="true"></i>{arrived}</span>}
+                                                    </td>
+                                                );
+                                            };
                                             return (
                                                 <tr key={label} className={isSum ? 'fe_sumrow' : ''}>
                                                     <td className="fe_date">{label}</td>
-                                                    <td className="fe_total">{line.total}</td>
-                                                    {summaryTable.times.map((t, i) => cell(line.time, t, i === 0))}
+                                                    <td className="fe_total">
+                                                        {line.total}
+                                                        {line.total > 0 && <span className="fe_arrived" data-zero={line.arrived === 0 ? '1' : '0'} title={`来場済み ${line.arrived}人 ／ 予約 ${line.total}人`}><i className="fa-solid fa-check" aria-hidden="true"></i>{line.arrived}</span>}
+                                                    </td>
+                                                    {summaryTable.times.map((t, i) => timeCell(t, i === 0))}
                                                     {summaryTable.interviews.map((v, i) => cell(line.interview, v, i === 0))}
                                                     {summaryTable.requests.map((v, i) => cell(line.request, v, i === 0))}
                                                 </tr>
```
