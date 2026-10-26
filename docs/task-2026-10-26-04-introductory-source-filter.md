# 作業記録 2026-10-26-04　v2.2.220 紹介キャンペーンサマリーを紹介元で絞る

## 指示
- IntroductorySummary.tsx の改修。master_data の introduction_person_category で選んで、店舗や担当の歩留まりを出したい。コントロール部分に introduction_person_category を選べる UI を追加

## 作り
- 絞り込みの左端に「紹介元」のプルダウン。選ぶと**画面のすべての表**（上の数字・紹介元別・事業部別・エリア別・ブランド別・マトリクス・店舗別・担当別）がその紹介元だけになる（期間・店舗・エリアと同じ扱い）
- 紹介元は `introduction_person_category`（注文・建売・中古の台帳とも同じ列。この画面は従来から3つとも「紹介元」として使っている）。未入力は「（未入力）」で選べる
- 選択肢は ② が返す（`sources`: 名前と件数。件数の多い順・未入力は最後）。件数は**紹介元以外の絞り込み（期間・店舗・エリア）を当てたあと**の反響の数。紹介元で絞る前に数えるので、選んでも他の選択肢は消えない
- 期間などで絞った結果、選んでいる紹介元が0件になっても、選択は外さずに「（0）」で残す
- ⚠️ 送る名前は `source`（`category` にすると ② の振り分けのキーに入り、未登録扱いになる）
- 「絞り込みを外す」で紹介元も外れる

## 追加・変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/introductory | summary.ts | `SummaryFilter.source`。紹介元の件数（`sourceCount`）を数えてから紹介元で絞る。応答に `sources` |
| backend-express/src/gateway | registry.ts | `introductory_summary` に `source` を渡す |
| frontend/src/components/header | IntroductorySummary.tsx | `targetSource`・`sources`。絞り込みに「紹介元」のプルダウン。`source` を送る。「絞り込みを外す」で戻す |
| frontend/src/utils | version.ts | 2.2.220 |
| backend/scripts/sql | **2026-10-26_update_log_2.2.220.sql**（新規。ガイド記事1本を含む） | |
| backend/scripts/guide/articles/common | screen-120.md（紹介キャンペーンサマリー） | 絞り込みに紹介元。選ぶとすべての表が変わること・件数の意味・例（オーナー様） |

## テスト
- ① 経由: 紹介元の選択肢17（オーナー様182・SUUMOカウンター132 … 未入力387）
  - 「オーナー様」を選ぶ → 全体の反響182・契約64 が、絞らないときの紹介元別の「オーナー様」の行と一致。紹介元別の表は1行、選択肢は減らない、店舗別30・担当別56
  - 「（未入力）」を選ぶ → 387 で一致。期間（2026-01〜06）と組み合わせ → 50 で一致し、選択肢の件数も50になる
- Playwright（一般の権限）: 絞り込みの左端に「紹介元」・件数付きの選択肢。オーナー様を選ぶと上の数字 837 → 182、店舗別 36 → 30、担当別 103 → 56。「絞り込みを外す」で「すべて」・837 に戻る。ブラウザのエラーなし
- ② の型チェック・フロントのビルドが通る（変えたファイルに警告なし）。テストのスタッフは消した

---
# 差分
```diff
diff --git a/backend-express/src/features/introductory/summary.ts b/backend-express/src/features/introductory/summary.ts
index 87bd943b..3de13f0f 100644
--- a/backend-express/src/features/introductory/summary.ts
+++ b/backend-express/src/features/introductory/summary.ts
@@ -86,6 +86,11 @@ export interface SummaryFilter {
   shop: string;
   /** エリア（shop_list.area。⚠️ 空の店舗は店舗名の県名で補ったもの）。⚠️ 空なら絞らない */
   area: string;
+  /**
+   * 紹介元（introduction_person_category。v2.2.220）。⚠️ 空なら絞らない。
+   *   ⚠️ 未入力の顧客は UNSET_LABEL（（未入力））で選ぶ。
+   */
+  source: string;
 }
 
 /** 歩留まり1行。⚠️ 率は画面で出す（分母0の見せ方は画面の判断） */
@@ -292,6 +297,11 @@ export const runIntroductorySummary = async (filter: SummaryFilter): Promise<Sum
   }
 
   const customers: Customer[] = [];
+  /**
+   * 紹介元の選択肢（v2.2.220）と件数。⚠️ 紹介元以外の絞り込み（期間・店舗・エリア）を当てたあとで数える。
+   *   ⚠️ 紹介元で絞る前に数えるので、選んでも他の選択肢は消えない。
+   */
+  const sourceCount = new Map<string, number>();
   for (const row of perTable.flat()) {
     if (row.status === '重複') continue;
     if (!inRange(toMonth(row.col_inquiry), filter)) continue;
@@ -302,6 +312,10 @@ export const runIntroductorySummary = async (filter: SummaryFilter): Promise<Sum
     if (filter.shop !== '' && shop !== filter.shop) continue;
     if (filter.area !== '' && area !== filter.area) continue;
 
+    const source = hasValue(row.source) ? String(row.source).trim() : UNSET_LABEL;
+    sourceCount.set(source, (sourceCount.get(source) ?? 0) + 1);
+    if (filter.source !== '' && source !== filter.source) continue;
+
     const contract = row.status === '契約済み';
     const inquiryDate = toDate(row.col_inquiry);
     const contractDate = toDate(row.col_contract);
@@ -316,7 +330,7 @@ export const runIntroductorySummary = async (filter: SummaryFilter): Promise<Sum
     customers.push({
       staff,
       division: row.division,
-      source: hasValue(row.source) ? String(row.source).trim() : UNSET_LABEL,
+      source,
       brand: hasValue(row.brand) ? String(row.brand).trim() : UNSET_LABEL,
       shop: shop === '' ? UNSET_LABEL : shop,
       area: area === '' ? UNKNOWN_AREA : area,
@@ -365,6 +379,10 @@ export const runIntroductorySummary = async (filter: SummaryFilter): Promise<Sum
       areaSource: crossFunnel(customers, (c) => c.area),
       shops: shopOptions,
       areas: areaOptions,
+      // ⚠️ v2.2.220: 紹介元の選択肢（件数の多い順・未入力は最後）
+      sources: [...sourceCount.entries()]
+        .sort((a, b) => Number(a[0] === UNSET_LABEL) - Number(b[0] === UNSET_LABEL) || b[1] - a[1])
+        .map(([name, count]) => ({ name, count })),
     },
   };
 };
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index fed435cf..6eac892a 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -930,6 +930,8 @@ register({
       endMonth: text('endMonth'),
       shop: text('shop'),
       area: text('area'),
+      // ⚠️ v2.2.220。⚠️ 名前は `source`（`category` にすると ② の振り分けのキーに入り、未登録扱いになる）
+      source: text('source'),
     });
     if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
     return result.body;
diff --git a/backend/scripts/guide/articles/common/screen-120.md b/backend/scripts/guide/articles/common/screen-120.md
index c2f730f4..64cc1cb8 100644
--- a/backend/scripts/guide/articles/common/screen-120.md
+++ b/backend/scripts/guide/articles/common/screen-120.md
@@ -9,7 +9,8 @@ summary: 紹介で来たお客様の歩留まり。
 [[画面:紹介キャンペーンサマリー]]
 
 - 紹介者の種類・事業・ブランド・エリア・店舗・担当ごとに見られます
-- 期間・店舗・エリアで絞れます
+- 紹介元・期間・店舗・エリアで絞れます
+- **紹介元**を選ぶと、その紹介元のお客様だけで、店舗別・担当別などすべての表が出ます（例：紹介元を「オーナー様」にすると、オーナー様からの紹介だけの店舗ごと・担当ごとの歩留まり）。選択肢の（ ）の数は、ほかの絞り込みを当てたあとの反響の数です
 
 ## 担当別（いちばん下の表）
 店舗別の下に、担当ごとの歩留まりが出ます。
diff --git a/frontend/src/components/header/IntroductorySummary.tsx b/frontend/src/components/header/IntroductorySummary.tsx
index e35f29f6..21ff96bf 100644
--- a/frontend/src/components/header/IntroductorySummary.tsx
+++ b/frontend/src/components/header/IntroductorySummary.tsx
@@ -238,6 +238,8 @@ const IntroductorySummary = () => {
     const [summary, setSummary] = useState<Summary | null>(null);
     const [shops, setShops] = useState<ShopOption[]>([]);
     const [areas, setAreas] = useState<string[]>([]);
+    /** 紹介元の選択肢（v2.2.220）。⚠️ 件数は紹介元以外の絞り込みを当てたあとの数 */
+    const [sources, setSources] = useState<{ name: string; count: number }[]>([]);
     const [loading, setLoading] = useState(true);
     const [error, setError] = useState('');
 
@@ -246,6 +248,8 @@ const IntroductorySummary = () => {
     const [endMonth, setEndMonth] = useState('');
     const [targetShop, setTargetShop] = useState('');
     const [targetArea, setTargetArea] = useState('');
+    /** 紹介元（introduction_person_category。v2.2.220）。⚠️ 空＝すべて */
+    const [targetSource, setTargetSource] = useState('');
 
     const fetchData = useCallback(async () => {
         setLoading(true);
@@ -257,6 +261,8 @@ const IntroductorySummary = () => {
                 endMonth,
                 shop: targetShop,
                 area: targetArea,
+                // ⚠️ `category` という名前で送らないこと（② の振り分けのキーに入り、未登録扱いになる）
+                source: targetSource,
             });
             if (res.data?.status !== 'ok') {
                 setError(res.data?.message ?? '集計を取得できませんでした。');
@@ -265,13 +271,14 @@ const IntroductorySummary = () => {
             setSummary(res.data as Summary);
             setShops(res.data.shops ?? []);
             setAreas(res.data.areas ?? []);
+            setSources(res.data.sources ?? []);
         } catch (e: unknown) {
             const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
             setError(message ?? '集計を取得できませんでした。分析サーバーが停止している可能性があります。');
         } finally {
             setLoading(false);
         }
-    }, [startMonth, endMonth, targetShop, targetArea]);
+    }, [startMonth, endMonth, targetShop, targetArea, targetSource]);
 
     useEffect(() => { void fetchData(); }, [fetchData]);
 
@@ -293,7 +300,7 @@ const IntroductorySummary = () => {
 
     const total = summary?.total;
     const unset = summary?.bySource.find(r => r.key === UNSET_SOURCE);
-    const filtered = startMonth !== '' || endMonth !== '' || targetShop !== '' || targetArea !== '';
+    const filtered = startMonth !== '' || endMonth !== '' || targetShop !== '' || targetArea !== '' || targetSource !== '';
 
     /** KPI の1段。⚠️ 下の小さい数字は「前の段からの率」 */
     const Step = ({ label, count, base, baseLabel, main = false }: { label: string; count: number; base: number; baseLabel: string; main?: boolean }) => (
@@ -385,6 +392,21 @@ const IntroductorySummary = () => {
                 </div>
 
                 <div className="ics_bar_filter">
+                    {/* ⚠️ v2.2.220: 紹介元（introduction_person_category）で絞る。⚠️ 画面のすべての表に効く */}
+                    <div>
+                        <div className="ics_label">紹介元</div>
+                        <Form.Select
+                            size="sm" value={targetSource} style={{ width: '180px', fontSize: '12px' }}
+                            onChange={(e) => setTargetSource(e.target.value)}
+                        >
+                            <option value="">すべて</option>
+                            {sources.map(s => <option key={s.name} value={s.name}>{s.name}（{s.count.toLocaleString()}）</option>)}
+                            {/* ⚠️ 期間などで絞った結果、選んでいる紹介元が0件になっても選択を残す（黙って外さない） */}
+                            {targetSource !== '' && !sources.some(s => s.name === targetSource) && (
+                                <option value={targetSource}>{targetSource}（0）</option>
+                            )}
+                        </Form.Select>
+                    </div>
                     <div>
                         <div className="ics_label">エリア</div>
                         <Form.Select
@@ -434,7 +456,7 @@ const IntroductorySummary = () => {
                         type="button"
                         className="ics_reset"
                         disabled={!filtered}
-                        onClick={() => { setStartMonth(''); setEndMonth(''); setTargetShop(''); setTargetArea(''); }}
+                        onClick={() => { setStartMonth(''); setEndMonth(''); setTargetShop(''); setTargetArea(''); setTargetSource(''); }}
                     >
                         絞り込みを外す
                     </button>
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 62394927..02ae28a9 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.219';
+export const newVersion = '2.2.220';
```
