# 2026-10-10 v2.2.184 フェスタ画面：顧客の表の見出しを固定

## 依頼
- 新しいブランチ（v2.2.184。⚠️ v2.2.183 が main 未マージのため v2.2.183 から切った）
- `frontend/src/components/header/FestaDashboard.tsx` の顧客の表の見出し（同期・顧客名〜）を sticky で固定

## 方式
- 表の外枠（`.table-responsive`）は横スクロールのため overflow を持ち、見出しの sticky は外枠に対して効く → 外の画面（Modal.Body）をスクロールしても見出しは止まらない
- そこで **表の外枠に縦スクロールも持たせ**、高さを「Modal.Body の高さ − 上部の固定ブロック（操作・サマリー）の高さ − 余白16px」（下限 240px）にした
  - 上部の固定ブロックはサマリーの開閉・予約日の数で高さが変わるので、ResizeObserver（＋ window resize）で測り直す
- 見出しは3段（1段目: 同期〜担当営業・営業入力 ／ 2段目: ブランド ／ 3段目: 面談・次アポ）
  - 2段目・3段目の top は実測した位置（CSS 変数 `--fe-head1` / `--fe-head2`）
- 重なり順: 本文の固定列（z-index 2）＜ 見出し（3）＜ 見出しの固定列＝左上の角（4）
- 見出しの下端に線（border-collapse の線はスクロール時に消えるため box-shadow で描く）

## 変更（frontend/src/components/header/FestaDashboard.tsx）
### 追加
- refs: `bodyRef`（Modal.Body）/ `topRef`（.fe_top）/ `theadRef`（thead）
- state: `tableMaxHeight` / `headTops`、const `hasData`
- useEffect（measure / ResizeObserver / resize）
- 表の外枠: class `fe_tbl_wrap`、style `maxHeight` / `overflowY: 'auto'`
- Table の style に `--fe-head1` / `--fe-head2`
- CSS: `.fe_tbl thead th`（sticky）、段ごとの top、`.fe_tbl thead th.fe_stick`（z-index 4）、見出し下端の線
- 追加した関数: なし（useEffect 内の `measure`）

### 影響
- 追加読み込み（IntersectionObserver、root はビューポート）は、表の外枠の中でスクロールしても働く（祖先の切り抜きを考慮して交差を判定するため）

## その他
- version.ts 2.2.184、`backend/scripts/sql/2026-10-10_update_log_2.2.184.sql`
- ⚠️ ローカル DB へは未投入（181〜183 も）。Docker が応答しないため

## 確認
- eslint 警告なし、`npm run build` 成功 → **`main.1fd0f014.js`**
- ⚠️ 画面での動作は未確認（ローカル環境が起動できないため）。確認点は deploy-v2.2.184.md

## 差分（全文）
```diff
diff --git a/frontend/src/components/header/FestaDashboard.tsx b/frontend/src/components/header/FestaDashboard.tsx
index 5cea0647..19ed196e 100644
--- a/frontend/src/components/header/FestaDashboard.tsx
+++ b/frontend/src/components/header/FestaDashboard.tsx
@@ -565,6 +565,47 @@ const FestaDashboard = ({ show, setShow }: Props) => {
 
     const visible = useMemo(() => filtered.slice(0, displayLength), [filtered, displayLength]);
 
+    /**
+     * 顧客の表の見出し（同期・顧客名〜）を上に固定する（v2.2.184）。
+     *
+     * ⚠️ 表の外枠（.table-responsive）は横スクロールのため overflow を持つ。⚠️ そのままだと見出しの sticky は
+     *   ⚠️ **外枠に対して**効くので、外の画面をスクロールしても見出しは止まらない。
+     *   ⚠️ そこで ⚠️ **表の外枠に縦スクロールも持たせ**、高さを「画面の残り（上部の固定ブロックの下）」にする。
+     *   ⚠️ 上部の固定ブロックはサマリーの開閉・予約日の数で高さが変わるので、⚠️ ResizeObserver で測り直す。
+     * ⚠️ 見出しは3段。⚠️ 2段目・3段目の top は ⚠️ **1段目・2段目の実際の高さ**（測る。⚠️ 決め打ちすると隙間・重なりが出る）。
+     */
+    const bodyRef = useRef<HTMLDivElement>(null);
+    const topRef = useRef<HTMLDivElement>(null);
+    const theadRef = useRef<HTMLTableSectionElement>(null);
+    const [tableMaxHeight, setTableMaxHeight] = useState<number | null>(null);
+    const [headTops, setHeadTops] = useState<number[]>([0, 0, 0]);
+    const hasData = data.length > 0;
+
+    useEffect(() => {
+        if (!show) return;
+        const measure = () => {
+            const body = bodyRef.current;
+            const top = topRef.current;
+            if (body && top) {
+                // ⚠️ 16px … Modal.Body の上下の余白（p-2）。⚠️ 下限 240px（⚠️ 狭い画面でも数行は見える）
+                setTableMaxHeight(Math.max(240, body.clientHeight - top.offsetHeight - 16));
+            }
+            const rows = theadRef.current ? Array.from(theadRef.current.rows) : [];
+            if (rows.length > 0) {
+                const base = rows[0].offsetTop;
+                setHeadTops(rows.map(r => r.offsetTop - base));
+            }
+        };
+        measure();
+        const observer = new ResizeObserver(measure);
+        [bodyRef.current, topRef.current, theadRef.current].forEach(el => { if (el) observer.observe(el); });
+        window.addEventListener('resize', measure);
+        return () => {
+            observer.disconnect();
+            window.removeEventListener('resize', measure);
+        };
+    }, [show, hasData, loading]);
+
     // --- 保存 ---
 
     /** 1列の保存（⚠️ EventList.tsx の updateField と同じ要求） */
@@ -750,7 +791,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                 <Modal.Header closeButton className="py-2">
                     <Modal.Title style={{ fontSize: '14px', fontWeight: 'bold', color: '#32325d' }}>{FESTA_TITLE}</Modal.Title>
                 </Modal.Header>
-                <Modal.Body className="p-2" style={{ backgroundColor: '#f8f9fe' }}>
+                <Modal.Body ref={bodyRef} className="p-2" style={{ backgroundColor: '#f8f9fe' }}>
                     <style>{`
                         .fe_sum_wrap { overflow-x: auto; }
                         .fe_sum { border-collapse: collapse; font-size: 11px; white-space: nowrap; }
@@ -806,6 +847,17 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         */
                         .fe_tbl .fe_stick { position: sticky; z-index: 2; background-color: var(--bs-table-bg, #fff); }
                         .fe_tbl thead .fe_stick { z-index: 3; background-color: #f6f9fc; }
+                        /*
+                          ⚠️ v2.2.184: 見出し（3段）を上に固定。⚠️ top は段ごと（--fe-head1 / --fe-head2 は実測した2段目・3段目の位置）。
+                            ⚠️ 見出しは本文の固定列（z-index 2）より上、⚠️ 見出しの固定列（同期・顧客名・ふりがな）はさらに上（左上の角）。
+                        */
+                        .fe_tbl thead th { position: sticky; z-index: 3; }
+                        .fe_tbl thead tr:nth-child(1) th { top: 0; }
+                        .fe_tbl thead tr:nth-child(2) th { top: var(--fe-head1, 0px); }
+                        .fe_tbl thead tr:nth-child(3) th { top: var(--fe-head2, 0px); }
+                        .fe_tbl thead th.fe_stick { z-index: 4; }
+                        .fe_tbl thead tr:last-child th, .fe_tbl thead th[rowspan="3"] { box-shadow: inset 0 -1px 0 #ced4da; }
+                        .fe_tbl thead th.fe_stick_last { box-shadow: inset -2px 0 0 #ced4da, inset 0 -1px 0 #ced4da; }
                         .fe_tbl .fe_stick_last { box-shadow: inset -2px 0 0 #ced4da; }
                         .fe_top { box-shadow: 0 6px 6px -6px rgba(50, 50, 93, .25); }
                         .fe_summary_panel { max-height: 45vh; overflow-y: auto; padding-bottom: 2px; }
@@ -817,7 +869,7 @@ const FestaDashboard = ({ show, setShow }: Props) => {
                         ⚠️ サマリーは「サマリーを閉じる／開く」で畳める（⚠️ 既定は開く）。
                         ⚠️ サマリーが高いと下の表が見えなくなるので、⚠️ サマリー部分は高さの上限（画面の45%）を超えたら中でスクロールする。
                     */}
-                    <div className="fe_top" style={{ position: 'sticky', top: '-8px', zIndex: 5, backgroundColor: '#f8f9fe', padding: '8px 0 0', margin: '-8px 0 8px' }}>
+                    <div ref={topRef} className="fe_top" style={{ position: 'sticky', top: '-8px', zIndex: 5, backgroundColor: '#f8f9fe', padding: '8px 0 0', margin: '-8px 0 8px' }}>
                     {/* 上部の操作 */}
                     <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                         <button style={{ ...styles.buttonPrimary, padding: '4px 10px', fontSize: '11px' }} onClick={() => void fetchData()} disabled={loading}>
@@ -1019,15 +1071,17 @@ const FestaDashboard = ({ show, setShow }: Props) => {
 
                     {error && <Alert variant="danger" className="py-1 px-2 mb-2" style={{ fontSize: '11px' }}>{error}</Alert>}
 
-                    <div className="bg-white rounded shadow-sm border table-responsive">
-                        <Table hover className="m-0 text-nowrap fe_tbl" style={{ minWidth: '2460px' }}>
+                    {/* ⚠️ v2.2.184: 縦スクロールも持たせて見出しを固定（⚠️ 高さは画面の残り。上の useEffect 参照） */}
+                    <div className="bg-white rounded shadow-sm border table-responsive fe_tbl_wrap"
+                        style={{ maxHeight: tableMaxHeight ? `${tableMaxHeight}px` : undefined, overflowY: 'auto' }}>
+                        <Table hover className="m-0 text-nowrap fe_tbl" style={{ minWidth: '2460px', ['--fe-head1' as string]: `${headTops[1] ?? 0}px`, ['--fe-head2' as string]: `${headTops[2] ?? 0}px` } as React.CSSProperties}>
                             {/*
                               ⚠️ 見出しは3段。⚠️ 指示書の rowSpan / colSpan は入れ替わっていると判断した（2026-10-08 の計画で合意）。
                                 1段目: 同期〜担当営業（縦に3段ぶん）＋ 営業入力（横に14列ぶん）
                                 2段目: ブランド（横に2列ずつ）
                                 3段目: 面談 ／ 次アポ
                             */}
-                            <thead>
+                            <thead ref={theadRef}>
                                 <tr>
                                     <th rowSpan={3} className="fe_stick" style={{ ...thStyle, ...stickyStyle(0) }}>同期</th>
                                     <th rowSpan={3} className="fe_stick" style={{ ...thStyle, ...stickyStyle(1) }}>顧客名</th>
```
