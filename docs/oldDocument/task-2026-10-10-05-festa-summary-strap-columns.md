# 2026-10-10 v2.2.185 フェスタ画面：集計表にストラップの色ごとの予約・来場数 ／ 面談漏れの行を薄い赤

## 依頼
- 新しいブランチ（v2.2.185。⚠️ v2.2.184 が main 未マージのため v2.2.184 から切った）
- `frontend/src/components/header/FestaDashboard.tsx`
  1. 「おうちづくりフェスタ2026」の集計表に、ストラップの色ごとの予約・来場数（来場予定時間の列の次。「黄or赤」の列と「青」の列）
  2. （追加）check_in_time が真なのに、どのブランドも面談していない顧客を薄い赤の背景色で

## 1. 集計表のストラップの列
- 来場予定時間の次に **「ストラップ」** の見出し（2列: 黄or赤 ／ 青）。見出しに色の四角
- 各マス: 予約数 ＋ 緑の「✓来場済み人数」（来場予定時間と同じ表示。来場0は灰色、予約0は薄い0）
- 日付ごとの事前予約／当日来場の行・合計行それぞれで数える
- 判定は表の「ストラップ/チケット」列と同じ `strapOf`（黄＋赤 か 青 のどちらか一方に必ず入る → 黄or赤 ＋ 青 ＝ 予約数）

## 2. 面談漏れの行
- 顧客の表の行: `check_in_time` あり **かつ** 営業入力の「面談」（`{ブランド}_interview`）が7ブランドとも OFF → **薄い赤（Bootstrap `table-danger`）**
- 同期済みの青（`table-primary`）より優先（面談漏れを見つけるため）
- `table-danger` は `--bs-table-bg` を変えるので、左の固定列（同期・顧客名・ふりがな）も同じ色になる
- 行にマウスを乗せると「来場済み・面談の記録なし」
- 面談のトグルを ON にすると、その場で色が消える（画面の値で判定）

## 追加・変更した関数など
- `STRAP_GROUPS`（定数: warm=黄or赤 ／ blue=青）
- `strapGroupOf(item)`
- summaryTable の Line に `strap` / `arrivedStrap`
- 描画内の `timeCell` を `countCell(counts, arrivedCounts, key, first)` に一般化（来場予定時間とストラップで共用。表示は同じ）
- 顧客の表の行: `notInterviewed` / `rowClass`
- CSS `.fe_sum .fe_strap_sm`

## その他
- version.ts 2.2.185、`backend/scripts/sql/2026-10-10_update_log_2.2.185.sql`
- ⚠️ ローカル DB へは未投入（181〜184 も）

## 確認
- eslint 警告なし、`npm run build` 成功 → **`main.bdbdf425.js`**
- 画面での見た目は未確認

## 差分（全文）
```diff
diff --git a/frontend/src/components/header/FestaDashboard.tsx b/frontend/src/components/header/FestaDashboard.tsx
index 19ed196e..4d06ebc9 100644
--- a/frontend/src/components/header/FestaDashboard.tsx
+++ b/frontend/src/components/header/FestaDashboard.tsx
@@ -165,6 +165,16 @@ const strapOf = (item: FestaRow): ('yellow' | 'red' | 'blue')[] =>
 const STRAP_COLOR = { yellow: '#ffd60a', red: '#e5383b', blue: '#1e6fd9' };
 const STRAP_LABEL = { yellow: '黄', red: '赤', blue: '青' };
 
+/**
+ * 集計表のストラップの列（v2.2.185）。⚠️ 判定は strapOf と同じ（⚠️ 黄＋赤 か 青 のどちらか一方に必ず入る）。
+ *   ⚠️ 見出しの色の四角も STRAP_COLOR を使う。
+ */
+const STRAP_GROUPS: { key: 'warm' | 'blue'; label: string; colors: ('yellow' | 'red' | 'blue')[] }[] = [
+    { key: 'warm', label: '黄or赤', colors: ['yellow', 'red'] },
+    { key: 'blue', label: '青', colors: ['blue'] },
+];
+const strapGroupOf = (item: FestaRow): 'warm' | 'blue' => (strapOf(item).includes('blue') ? 'blue' : 'warm');
+
 /**
  * 相談内容（v2.2.173 追加）。⚠️ 相談内容（interview）・ご検討（request）・建築予定地（area）を
  * ⚠️ **淡い色のチップ＋アイコン**で出す。⚠️ 下に無い値（キッチンカー・マルシェなど）は出さない。
@@ -442,8 +452,9 @@ const FestaDashboard = ({ show, setShow }: Props) => {
         const requests = rankByCount(requestTotal);
 
         // ⚠️ v2.2.181: arrived / arrivedTime … 来場済み（check_in_time が入っている）の人数
-        type Line = { total: number; arrived: number; time: Map<string, number>; arrivedTime: Map<string, number>; interview: Map<string, number>; request: Map<string, number> };
-        const emptyLine = (): Line => ({ total: 0, arrived: 0, time: new Map(), arrivedTime: new Map(), interview: new Map(), request: new Map() });
+        // ⚠️ v2.2.185: strap / arrivedStrap … ストラップの色（黄or赤 ／ 青）ごとの予約数・来場済みの人数（キーは STRAP_GROUPS の key）
+        type Line = { total: number; arrived: number; time: Map<string, number>; arrivedTime: Map<string, number>; strap: Map<string, number>; arrivedStrap: Map<string, number>; interview: Map<string, number>; request: Map<string, number> };
+        const emptyLine = (): Line => ({ total: 0, arrived: 0, time: new Map(), arrivedTime: new Map(), strap: new Map(), arrivedStrap: new Map(), interview: new Map(), request: new Map() });
         /**
          * ⚠️ v2.2.182: 日付ごとに ⚠️ **事前予約（status !== 'non-reserve'）と当日来場（status === 'non-reserve'）の2行**に分ける。
          *   ⚠️ 合計行は分けない（⚠️ 全体の合計）。
@@ -457,12 +468,15 @@ const FestaDashboard = ({ show, setShow }: Props) => {
             if (!line) return;
             const time = normalizeTime(item.time) || UNSET_LABEL;
             const arrived = isArrived(item);
+            const strap = strapGroupOf(item);
             [line, sum].forEach(target => {
                 target.total += 1;
                 add(target.time, time);
+                add(target.strap, strap);
                 if (arrived) {
                     target.arrived += 1;
                     add(target.arrivedTime, time);
+                    add(target.arrivedStrap, strap);
                 }
                 splitValues(item.interview).forEach(v => add(target.interview, v));
                 splitValues(item.request).forEach(v => add(target.request, v));
@@ -817,6 +831,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         .fe_notice_title { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
                         .fe_notice_list { margin: 0; padding-left: 18px; line-height: 1.7; }
                         .fe_notice_list li .fe_strap { width: 12px; height: 12px; }
+                        .fe_sum .fe_strap_sm { width: 10px; height: 10px; margin-right: 2px; }
                         .fe_notice_steps li::marker { color: #fb6340; }
                         .fe_strap_ticket { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
                         .fe_slash { color: #adb5bd; }
@@ -924,11 +939,19 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                             <th rowSpan={2}>区分</th>
                                             <th rowSpan={2}>予約数</th>
                                             {summaryTable.times.length > 0 && <th className="fe_group fe_sep" colSpan={summaryTable.times.length}>来場予定時間</th>}
+                                            {/* ⚠️ v2.2.185: ストラップの色ごと（来場予定時間の次） */}
+                                            <th className="fe_group fe_sep" colSpan={STRAP_GROUPS.length}>ストラップ</th>
                                             {summaryTable.interviews.length > 0 && <th className="fe_group fe_sep" colSpan={summaryTable.interviews.length}>相談内容</th>}
                                             {summaryTable.requests.length > 0 && <th className="fe_group fe_sep" colSpan={summaryTable.requests.length}>検討内容</th>}
                                         </tr>
                                         <tr>
                                             {summaryTable.times.map((t, i) => <th key={`t-${t}`} className={i === 0 ? 'fe_sep' : ''}>{t}</th>)}
+                                            {STRAP_GROUPS.map((g, i) => (
+                                                <th key={`s-${g.key}`} className={i === 0 ? 'fe_sep' : ''} style={{ whiteSpace: 'nowrap' }}>
+                                                    {g.colors.map(c => <span key={c} className="fe_strap fe_strap_sm" style={{ backgroundColor: STRAP_COLOR[c] }} aria-hidden="true" />)}
+                                                    {g.label}
+                                                </th>
+                                            ))}
                                             {summaryTable.interviews.map((v, i) => <th key={`i-${v}`} className={i === 0 ? 'fe_sep' : ''}>{v}</th>)}
                                             {summaryTable.requests.map((v, i) => <th key={`r-${v}`} className={i === 0 ? 'fe_sep' : ''}>{v}</th>)}
                                         </tr>
@@ -953,9 +976,10 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                              * 来場予定時間（v2.2.181）。⚠️ 予約数の隣に ⚠️ **来場済み（check_in_time あり）の人数**を色付きで出す。
                                              *   ⚠️ 予約が 0 の枠は従来どおり薄い 0 だけ。⚠️ 来場 0 の枠は「✓0」を薄く出す（⚠️ まだ誰も来ていないとわかるように）。
                                              */
-                                            const timeCell = (key: string, first: boolean) => {
-                                                const n = line.time.get(key) ?? 0;
-                                                const arrived = line.arrivedTime.get(key) ?? 0;
+                                            // ⚠️ v2.2.185: ストラップの列でも使う（⚠️ 予約数と来場済みの表を引数で渡す）
+                                            const countCell = (counts: Map<string, number>, arrivedCounts: Map<string, number>, key: string, first: boolean) => {
+                                                const n = counts.get(key) ?? 0;
+                                                const arrived = arrivedCounts.get(key) ?? 0;
                                                 return (
                                                     <td key={key} className={`${n === 0 ? 'fe_zero' : ''}${first ? ' fe_sep' : ''}`}>
                                                         {n}
@@ -975,7 +999,8 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                                                         {line.total}
                                                         {line.total > 0 && <span className="fe_arrived" data-zero={line.arrived === 0 ? '1' : '0'} title={`来場済み ${line.arrived}人 ／ 予約 ${line.total}人`}><i className="fa-solid fa-check" aria-hidden="true"></i>{line.arrived}</span>}
                                                     </td>
-                                                    {summaryTable.times.map((t, i) => timeCell(t, i === 0))}
+                                                    {summaryTable.times.map((t, i) => countCell(line.time, line.arrivedTime, t, i === 0))}
+                                                    {STRAP_GROUPS.map((g, i) => countCell(line.strap, line.arrivedStrap, g.key, i === 0))}
                                                     {summaryTable.interviews.map((v, i) => cell(line.interview, v, i === 0))}
                                                     {summaryTable.requests.map((v, i) => cell(line.request, v, i === 0))}
                                                 </tr>
@@ -1117,8 +1142,15 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                             <tbody>
                                 {visible.map((item, index) => {
                                     const festa = parseFesta(item.festa);
+                                    /**
+                                     * ⚠️ v2.2.185: 来場済み（check_in_time あり）なのに ⚠️ **どのブランドも「面談」にチェックしていない**顧客は薄い赤。
+                                     *   ⚠️ 面談漏れを見つけるため、⚠️ 同期済みの青（table-primary）より優先する。
+                                     *   ⚠️ table-danger は --bs-table-bg を変えるので、⚠️ 左の固定列（fe_stick）も同じ色になる。
+                                     */
+                                    const notInterviewed = isArrived(item) && !FESTA_BRANDS.some(brand => festa[`${brand}_interview`] === true);
+                                    const rowClass = notInterviewed ? 'table-danger' : Number(item.sync) === 1 ? 'table-primary' : '';
                                     return (
-                                        <tr key={item.id} className={Number(item.sync) === 1 ? 'table-primary' : ''}>
+                                        <tr key={item.id} className={rowClass} title={notInterviewed ? '来場済み・面談の記録なし' : undefined}>
                                             {/*
                                               ⚠️ v2.2.174: 店舗が違えば何度でも同期できるので ⚠️ 回転アイコンは常に出す（⚠️「同期済み」の文字は外した）。
                                                 ⚠️ 同期済みかは行の色（table-primary）と、⚠️ アイコンの下の店舗名でわかる。
```
