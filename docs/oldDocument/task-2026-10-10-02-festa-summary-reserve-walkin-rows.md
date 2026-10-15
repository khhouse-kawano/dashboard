# 2026-10-10 v2.2.182 フェスタ画面：集計表の日付ごとに事前予約／当日来場の2行

## 依頼
- 新しいブランチ（v2.2.182。⚠️ v2.2.181 が main 未マージのため v2.2.181 から切った）
- `frontend/src/components/header/FestaDashboard.tsx` の集計表で、各日の行を2行に
  - 上: 事前予約（status !== 'non-reserve'）
  - 下: 当日来場（status === 'non-reserve'）

## 変更（frontend/src/components/header/FestaDashboard.tsx）
- 集計表に **区分** 列を追加（日付の右）
- 日付ごとに「事前予約」「当日来場」の2行。日付のマスは2行ぶん縦につなぐ（rowSpan）
- 当日来場の行は薄いオレンジの背景・区分の文字をオレンジに（見分けるため）
- 予約数・来場予定時間（✓来場済み人数つき）・相談内容・検討内容は、それぞれ区分ごとに数える
- 合計行は分けず1行（全体の合計。日付と区分のマスを横につなぐ）
- status が空・NULL は事前予約に入る

### 追加した型・定数・関数
- `BookingKind`（型: 'reserve' | 'walkin'）
- `BOOKING_KINDS`（定数: 事前予約／当日来場）
- `bookingKindOf(item)`（`WALK_IN_STATUS` と比較）
- summaryTable の `lines` を `Map<日付, Record<BookingKind, Line>>` に
- CSS `.fe_sum .fe_kind` / `.fe_sum tr.fe_kind_walkin td` / `.fe_sum tr.fe_kind_walkin td.fe_kind`

## その他
- version.ts 2.2.182、`backend/scripts/sql/2026-10-10_update_log_2.2.182.sql`
- ⚠️ ローカル DB へは未投入（v2.2.181 分も）。Docker が応答しないため。復旧後に 181 → 182 の順で投入すること

## 確認
- eslint 警告なし、`npm run build` 成功 → **`main.93c987cd.js`**
- 画面での見た目は未確認

## 差分（v2.2.181 との差、全文）
```diff
diff --git a/frontend/src/components/header/FestaDashboard.tsx b/frontend/src/components/header/FestaDashboard.tsx
index 6645e3b8..ca617440 100644
--- a/frontend/src/components/header/FestaDashboard.tsx
+++ b/frontend/src/components/header/FestaDashboard.tsx
@@ -275,6 +275,19 @@ const UNSET_LABEL = '未設定';
 /** 来場済みか（v2.2.181）。⚠️ check_in_time に値が入っていれば来場済み（⚠️ 画面上部の「チェックイン ◯件」と同じ判定） */
 const isArrived = (item: { check_in_time: string | null }): boolean => (item.check_in_time ?? '').trim() !== '';
 
+/**
+ * 予約の区分（v2.2.182）。⚠️ 集計表の日付ごとの2行に使う。
+ *   reserve … 事前予約（status !== 'non-reserve'。⚠️ status が空・NULL も事前予約）
+ *   walkin  … 当日来場（status === 'non-reserve'。⚠️ ticketOf の WALK_IN_STATUS と同じ値）
+ */
+type BookingKind = 'reserve' | 'walkin';
+const BOOKING_KINDS: { key: BookingKind; label: string }[] = [
+    { key: 'reserve', label: '事前予約' },
+    { key: 'walkin', label: '当日来場' },
+];
+const bookingKindOf = (item: { status: string | null }): BookingKind =>
+    (item.status ?? '').trim() === WALK_IN_STATUS ? 'walkin' : 'reserve';
+
 const rankByCount = (counts: Map<string, number>): string[] =>
     [...counts.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], 'ja')).map(([key]) => key);
 
@@ -429,12 +442,16 @@ const FestaDashboard = ({ show, setShow }: Props) => {
         // ⚠️ v2.2.181: arrived / arrivedTime … 来場済み（check_in_time が入っている）の人数
         type Line = { total: number; arrived: number; time: Map<string, number>; arrivedTime: Map<string, number>; interview: Map<string, number>; request: Map<string, number> };
         const emptyLine = (): Line => ({ total: 0, arrived: 0, time: new Map(), arrivedTime: new Map(), interview: new Map(), request: new Map() });
-        const lines = new Map<string, Line>(dates.map(d => [d, emptyLine()]));
+        /**
+         * ⚠️ v2.2.182: 日付ごとに ⚠️ **事前予約（status !== 'non-reserve'）と当日来場（status === 'non-reserve'）の2行**に分ける。
+         *   ⚠️ 合計行は分けない（⚠️ 全体の合計）。
+         */
+        const lines = new Map<string, Record<BookingKind, Line>>(dates.map(d => [d, { reserve: emptyLine(), walkin: emptyLine() }]));
         const sum = emptyLine();
         const add = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
 
         data.forEach(item => {
-            const line = lines.get((item.date || '').trim() || UNSET_LABEL);
+            const line = lines.get((item.date || '').trim() || UNSET_LABEL)?.[bookingKindOf(item)];
             if (!line) return;
             const time = normalizeTime(item.time) || UNSET_LABEL;
             const arrived = isArrived(item);
@@ -740,6 +757,9 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         .fe_sum .fe_group { background: #eef2f7; color: #32325d; }
                         .fe_sum .fe_date { text-align: left; font-weight: 700; color: #32325d; background: #fff; }
                         .fe_sum .fe_total { font-weight: 700; color: #32325d; }
+                        .fe_sum .fe_kind { text-align: left; white-space: nowrap; font-size: 11px; color: #525f7f; }
+                        .fe_sum tr.fe_kind_walkin td { background: #fff8ec; }
+                        .fe_sum tr.fe_kind_walkin td.fe_kind { color: #b0590c; font-weight: 700; }
                         .fe_sum tr.fe_sumrow td { background: #f6f9fc; font-weight: 700; }
                         .fe_sum .fe_zero { color: #ced4da; }
                         .fe_arrived { display: inline-flex; align-items: center; gap: 2px; margin-left: 4px; padding: 0 5px; border-radius: 999px; background: #2dce89; color: #fff; font-size: 10px; font-weight: 700; line-height: 1.5; }
@@ -831,6 +851,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                     <thead>
                                         <tr>
                                             <th rowSpan={2}>日付</th>
+                                            <th rowSpan={2}>区分</th>
                                             <th rowSpan={2}>予約数</th>
                                             {summaryTable.times.length > 0 && <th className="fe_group fe_sep" colSpan={summaryTable.times.length}>来場予定時間</th>}
                                             {summaryTable.interviews.length > 0 && <th className="fe_group fe_sep" colSpan={summaryTable.interviews.length}>相談内容</th>}
@@ -843,8 +864,16 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                         </tr>
                                     </thead>
                                     <tbody>
-                                        {[...summaryTable.dates.map(d => ({ label: d, line: summaryTable.lines.get(d), isSum: false })),
-                                          { label: '合計', line: summaryTable.sum, isSum: true }].map(({ label, line, isSum }) => {
+                                        {/*
+                                          ⚠️ v2.2.182: 日付ごとに2行（上: 事前予約 ／ 下: 当日来場）。⚠️ 日付のマスは2行ぶん縦につなぐ。
+                                            ⚠️ 合計行は1行（⚠️ 日付と区分のマスを横につなぐ）。
+                                        */}
+                                        {[...summaryTable.dates.flatMap(d => BOOKING_KINDS.map((kind, k) => ({
+                                            key: `${d}_${kind.key}`, label: d, kind: kind.key as BookingKind | 'sum', kindLabel: kind.label,
+                                            firstOfDate: k === 0, line: summaryTable.lines.get(d)?.[kind.key], isSum: false,
+                                          }))),
+                                          { key: 'sum', label: '合計', kind: 'sum' as BookingKind | 'sum', kindLabel: '', firstOfDate: true, line: summaryTable.sum, isSum: true }]
+                                          .map(({ key: rowKey, label, kind, kindLabel, firstOfDate, line, isSum }) => {
                                             if (!line) return null;
                                             const cell = (map: Map<string, number>, key: string, first: boolean) => {
                                                 const n = map.get(key) ?? 0;
@@ -865,8 +894,13 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                                 );
                                             };
                                             return (
-                                                <tr key={label} className={isSum ? 'fe_sumrow' : ''}>
-                                                    <td className="fe_date">{label}</td>
+                                                <tr key={rowKey} className={isSum ? 'fe_sumrow' : `fe_kind_${kind}`}>
+                                                    {isSum
+                                                        ? <td className="fe_date" colSpan={2}>{label}</td>
+                                                        : <>
+                                                            {firstOfDate && <td className="fe_date" rowSpan={BOOKING_KINDS.length}>{label}</td>}
+                                                            <td className="fe_kind">{kindLabel}</td>
+                                                        </>}
                                                     <td className="fe_total">
                                                         {line.total}
                                                         {line.total > 0 && <span className="fe_arrived" data-zero={line.arrived === 0 ? '1' : '0'} title={`来場済み ${line.arrived}人 ／ 予約 ${line.total}人`}><i className="fa-solid fa-check" aria-hidden="true"></i>{line.arrived}</span>}
```
