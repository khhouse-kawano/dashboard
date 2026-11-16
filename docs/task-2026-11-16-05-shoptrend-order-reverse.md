# 作業記録 2026-11-16-05　v2.2.273　店舗別反響推移（注文）の月の並びを新しい月から

## 依頼
ShopTrendOrder.tsx に、ShopTrendKaeru.tsx と同じ `const [isReverse, setIsReverse] = useState(true);` を足す。初期値も同じにして、該当月を左、過去を右に並べる。
- 変更案（差分）は別のエージェントが作り、利用者が版の割り振り（この版は ShopTrend）を了承した

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/shopTrend | ShopTrendOrder.tsx | state `isReverse`、useMemo `formattedMonthArray`（追加）、チェックボックス「期間を反転」、表の5か所の月の並びを formattedMonthArray に |
| frontend/src/utils | version.ts | 2.2.273 |
| backend/scripts/sql | 2026-11-16_update_log_2.2.273.sql（新規） | 更新履歴1行＋業務ガイド1本 |
| backend/scripts/guide/articles/order | screen-070.md | 「反響推移（販促媒体別・店舗別）」に「月の並び（店舗別）」を追加 |

- 並びを変えるのは表の列だけ。集計の期間（getValue の period・前年の月）とサマリのグラフ・表は monthArray のまま（ShopTrendKaeru と同じ）
- 該当月＝選んだ期間のいちばん新しい月（終了月。選んでいなければ今月）

## 差分（全文）
```diff
diff --git a/frontend/src/components/shopTrend/ShopTrendOrder.tsx b/frontend/src/components/shopTrend/ShopTrendOrder.tsx
index 58afd0b10..93ed9388d 100644
--- a/frontend/src/components/shopTrend/ShopTrendOrder.tsx
+++ b/frontend/src/components/shopTrend/ShopTrendOrder.tsx
@@ -98,6 +98,7 @@ const ShopTrendOrder = () => {
     const [modalList, setModalList] = useState<Customer[]>([]);
 
     const [editId, setEditId] = useState('');
+    const [isReverse, setIsReverse] = useState(true);
 
     /**
      * 併売店をまとめるか。
@@ -215,6 +216,14 @@ const ShopTrendOrder = () => {
         setMediumChecked(checkedObject);
     }, [targetMedium]);
 
+    /**
+     * 表の列に並べる月。isReverse（既定）のときは新しい月を左にする。
+     * ⚠️ 表の列の並びだけに使う。集計の期間（getValue の period・前年の月）とサマリは monthArray のまま。
+     */
+    const formattedMonthArray = useMemo(() => {
+        return isReverse ? [...monthArray].reverse() : [...monthArray];
+    }, [monthArray, isReverse]);
+
     const showSummary = (title: string) => {
         setShow(true);
         const sectionShops = originalShopArray.filter(o => o.section === title).map(o => o.shop);
@@ -449,6 +458,11 @@ const ShopTrendOrder = () => {
                                 onChange={() => setShowMulti(prev => !prev)} />併売店をまとめる
                         </label>
                     </div>
+                    <div className="m-1">
+                        <label className="target checkbox d-flex align-items-center">
+                            <input type="checkbox" checked={isReverse === false} className='me-1' onChange={() => setIsReverse(!isReverse)} />期間を反転
+                        </label>
+                    </div>
                 </div>
                 {targetMedium === 'all' && <>
                     <div style={{ fontSize: '12px' }}>表示する販促媒体を選択</div>
@@ -473,12 +487,12 @@ const ShopTrendOrder = () => {
                                     <tbody style={{ fontSize: '12px', letterSpacing: '.5px' }}>
                                         <tr className='sticky-header text-center'>
                                             <td className='sticky-column text-center' style={{ width: '120px' }}>店舗名</td>
-                                            {['全期間', ...monthArray].map(month => <td>{month}</td>)}
+                                            {['全期間', ...formattedMonthArray].map(month => <td>{month}</td>)}
                                         </tr>
                                         {[{ name: targetShop, shop: targetShop, rank: 1 }, ...staff].filter(s => s.rank === 1 && shopNamesOf(targetShop).includes(s.shop)).map((item, staffIndex) =>
                                             <tr>
                                                 <td className='align-middle  sticky-column text-center'>{item.name}</td>
-                                                {['全期間', ...monthArray].map((month, monthIndex) => {
+                                                {['全期間', ...formattedMonthArray].map((month, monthIndex) => {
                                                     // ⚠️ まとめON かつ targetShop が親店舗のときだけ、子店舗の顧客も含める
                                                     const targetShops = shopNamesOf(targetShop);
                                                     const base = customerList.filter(c => (staffIndex >= 1 ? c.staff === item.name : targetShops.includes(c.shop)));
@@ -524,7 +538,7 @@ const ShopTrendOrder = () => {
                                     <tbody style={{ fontSize: '12px', letterSpacing: '.5px' }}>
                                         <tr className='sticky-header text-center'>
                                             <td className='sticky-column text-center' style={{ width: '120px' }}>店舗名</td>
-                                            {['全期間', ...monthArray].map((month, monthIndex) => {
+                                            {['全期間', ...formattedMonthArray].map((month, monthIndex) => {
                                                 const isDisplayLastYear = isLastYear(month) && monthIndex >= 1 && checked.comparison.show;
                                                 return <td>{month}{isDisplayLastYear && <span className='bg-white rounded text-dark px-2 ms-1'>昨年実績</span>}</td>
                                             })}
@@ -564,7 +578,7 @@ const ShopTrendOrder = () => {
                                                             onClick={() => showSummary(target.shop)}
                                                         >サマリ</div>
                                                     </td>
-                                                    {['全期間', ...monthArray].map((month, monthIndex) => {
+                                                    {['全期間', ...formattedMonthArray].map((month, monthIndex) => {
                                                         const sectionShops = originalShopArray.filter(o => o.section === target.shop).map(o => o.shop);
                                                         const base = isMerged
                                                             ? customerList.filter(c => mergeShops.includes(c.shop))
@@ -622,7 +636,7 @@ const ShopTrendOrder = () => {
                                                     })}
                                                 </tr>
                                                 {checked.budget.show && <tr>
-                                                    {['全期間', ...monthArray].map((month, monthIndex) => {
+                                                    {['全期間', ...formattedMonthArray].map((month, monthIndex) => {
                                                         const baseBudget = budgetList.filter(b =>
                                                             b.section === 'order'
                                                             && (monthIndex > 0 ? b.budget_period.includes(month) : monthArray.includes(b.budget_period.slice(0, 7)))
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index dbda84f51..bc3f11a4d 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.272';
+export const newVersion = '2.2.273';
```

## 業務ガイド
- 「反響推移（販促媒体別・店舗別）」（order/screen-070.md）に「## 月の並び（店舗別）」を足した
  - 左から全期間・新しい月の順に並ぶこと
  - 「期間を反転」で古い月からの順になること
  - サマリは古い月から順のままであること

## テスト
- 型チェック：frontend は通った
- Playwright（開発サーバー 3100、① localhost:8080 経由、一時スタッフ 999999・注文）
  - 初期表示の見出し：全期間・2026/11・2026/10・2026/09 … 2025/12（今月が左）
  - 「期間を反転」に印を付けると：全期間・2025/12・2026/01 … 2026/11（古い月が左）
  - 「全期間」の値は反転の前後で同じ（総反響 11,348 など）。月の列の数字は月と一緒に動く（2026/10 は総反響 1,212）
  - ページのエラーなし
- リファクタリング：今回の差分は state 1つ・useMemo 1つ・チェックボックス・置き換え5か所だけで、整理するものは無かった
- 後片付け：一時スタッフ 999999 を削除した。3100 番を停止した

## 未確認・残り
- サマリのグラフと表は古い月が左のまま（建売と同じ）
- 中古（ShopTrendResale）は対象外
