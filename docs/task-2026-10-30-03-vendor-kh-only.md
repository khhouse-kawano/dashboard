# 作業記録 2026-10-30-03　「業者別」を国分ハウジングだけに（v2.2.233）

## 依頼
- 新しいブランチで修正。業者別ボタンを表示するのは国分ハウジングのブランドのみ

## 変更
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/header | TrackingSettings.tsx | 定数 `VENDOR_BRANDS`（新規）・SiteSummary に `brand` を渡し、`showVendor` のときだけ「業者別」を出す |
| frontend/src/utils | version.ts | 2.2.233 |
| backend/scripts/sql | **2026-10-30_update_log_2.2.233.sql**（新規） | 更新履歴＋業務ガイド |
| backend/scripts/guide/articles/common | screen-200.md | 業者別の節の冒頭を「国分ハウジングのサイトの流入元のタブでは…（ほかのブランドのサイトには出ません）」に |

- 判定はサイトのブランド（tracking_sites.brand = kh）。② は変えていない（サマリーの vendors はほかのサイトでも返るが、画面で出さない）
- 業者別を選んだまま、出さないサイト・タブになったときは PV に戻して見せる（今までの着地ページのときと同じ扱い）

## 業務ガイド
- 「アクセス解析」：業者別は国分ハウジングのサイトだけに出ることを書いた

## 確認
- 型チェック（今回のファイルのエラーなし）
- Playwright：流入元タブのボタンが、国分ハウジングは PV・CV・業者別、かえるホーム・なごみ工務店・ケンガククラウド（ブランド空）は PV・CV だけ。ページのエラーなし
- ② と ① の PHP は変えていないので、① の許可リストの確認は不要（変更なし）
- テスト用の担当は削除済み。開発サーバー（3100）は停止済み

## 差分
```diff
diff --git a/backend/scripts/guide/articles/common/screen-200.md b/backend/scripts/guide/articles/common/screen-200.md
index f172de05..665617d6 100644
--- a/backend/scripts/guide/articles/common/screen-200.md
+++ b/backend/scripts/guide/articles/common/screen-200.md
@@ -61,7 +61,7 @@ summary: 各ブランドサイトのタグの発行と、着地ページ・流
 - 帯の下に、項目ごとの件数と割合が出ます
 
 ## 業者別（流入元のとき）
-「流入元」のタブでは、3つ目のボタン「**業者別**」が出ます。広告の運用を頼んでいる業者ごとの割合です。
+**国分ハウジング**のサイトの「流入元」のタブでは、3つ目のボタン「**業者別**」が出ます。広告の運用を頼んでいる業者ごとの割合です（ほかのブランドのサイトには出ません）。
 - 広告のキャンペーン名の末尾が「_pt1」なら **PURE GROWTH**、「_pt2」なら **Bander** の広告として数えます
 - PV と CV の帯を2本出します。割合は、この2社の広告から来た分だけを合計にして出します（それ以外の訪問は入りません）
 - 社名を押すと、その業者の**店舗別の歩留まり**が開きます
diff --git a/frontend/src/components/header/TrackingSettings.tsx b/frontend/src/components/header/TrackingSettings.tsx
index 0ce5afa8..7039e949 100644
--- a/frontend/src/components/header/TrackingSettings.tsx
+++ b/frontend/src/components/header/TrackingSettings.tsx
@@ -21,7 +21,7 @@ import TrackingVendorFunnel from './TrackingVendorFunnel';
  * ⚠️ v2.2.203 サマリーの着地ページ・流入元を押すと、詳細のモーダル（TrackingDetail.tsx）が開く。着地ページは右のアイコンでそのページを開く。
  *   ⚠️ 上の「Meta から取り込む」は ② の meta_ads_import（待たずに返る。終わったかは「最後の取り込み」で見る）。⚠️ ② は6時間ごとにも自動で取り込む。
  * ⚠️ v2.2.232 サマリーの表の上に帯グラフ（PV・CV の割合）。流入元タブでは「業者別」（PURE GROWTH・Bander。② の vendors.ts）も出し、
- *   社名を押すと店舗別の歩留まり（TrackingVendorFunnel.tsx）が開く。
+ *   社名を押すと店舗別の歩留まり（TrackingVendorFunnel.tsx）が開く。⚠️ v2.2.233 業者別は国分ハウジング（brand kh）のサイトだけ（VENDOR_BRANDS）。
  * ⚠️ サイトは消さない（着地の記録が残るため）。⚠️「無効」にすると着地を保存しなくなる（タグは貼ったままでもサイトに影響なし）。
  * ⚠️ 全画面モーダル（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンは Header.tsx が出す。
  * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 tk_）。
@@ -126,6 +126,8 @@ type SummaryTab = 'landing' | 'source';
 type SummarySortKey = 'key' | 'visits' | 'ad' | 'cv' | 'rate';
 /** 帯グラフの切り替え（v2.2.232）。⚠️ 業者別は流入元タブだけ */
 type BandMode = 'visits' | 'cv' | 'vendor';
+/** 業者別を出すブランド（v2.2.233。2026-10-30 の指示で国分ハウジングだけ） */
+const VENDOR_BRANDS = ['kh'];
 /** 帯グラフに出す件数。⚠️ これより後ろは「その他」にまとめる */
 const BAND_TOP = 8;
 const BAND_COLORS = ['#2563eb', '#f97316', '#10b981', '#a855f7', '#eab308', '#06b6d4', '#ef4444', '#ec4899'];
@@ -184,7 +186,7 @@ const readableUrl = (url: string): string => {
  * ⚠️ 表記は「PV」（2026-10-20 の指示）。⚠️ 中身は ② の訪問数（30分以内のページの移動はまとめて1件）で、ページが見られた回数より少ない。
  * ⚠️ reloadKey が変わったら取り直す（親の「再読み込み」）。
  */
-const SiteSummary: React.FC<{ siteId: number; siteName: string; reloadKey: number }> = ({ siteId, siteName, reloadKey }) => {
+const SiteSummary: React.FC<{ siteId: number; siteName: string; brand: string; reloadKey: number }> = ({ siteId, siteName, brand, reloadKey }) => {
     const [data, setData] = useState<Summary | null>(null);
     const [error, setError] = useState('');
     const [tab, setTab] = useState<SummaryTab>('landing');
@@ -195,8 +197,9 @@ const SiteSummary: React.FC<{ siteId: number; siteName: string; reloadKey: numbe
     const [bandMode, setBandMode] = useState<BandMode>('visits');
     /** 歩留まりを開いている業者（v2.2.232） */
     const [vendor, setVendor] = useState<VendorRow | null>(null);
-    // ⚠️ 業者別は流入元タブだけ。着地ページに切り替えたら PV に戻して見せる
-    const mode: BandMode = bandMode === 'vendor' && tab !== 'source' ? 'visits' : bandMode;
+    // ⚠️ 業者別は VENDOR_BRANDS のサイトの流入元タブだけ。着地ページに切り替えたら PV に戻して見せる
+    const showVendor = tab === 'source' && VENDOR_BRANDS.includes(brand);
+    const mode: BandMode = bandMode === 'vendor' && !showVendor ? 'visits' : bandMode;
 
     useEffect(() => {
         let alive = true;
@@ -272,7 +275,7 @@ const SiteSummary: React.FC<{ siteId: number; siteName: string; reloadKey: numbe
             </div>
             <div className="tk_band_wrap">
                 <div className="tk_band_switch" role="group" aria-label="帯グラフの切り替え">
-                    {([['visits', 'PV'], ['cv', 'CV'], ...(tab === 'source' ? [['vendor', '業者別']] : [])] as [BandMode, string][]).map(([key, label]) => (
+                    {([['visits', 'PV'], ['cv', 'CV'], ...(showVendor ? [['vendor', '業者別']] : [])] as [BandMode, string][]).map(([key, label]) => (
                         <button key={key} type="button" aria-pressed={mode === key}
                             className={`tk_tab${mode === key ? ' is_active' : ''}`} onClick={() => setBandMode(key)}>{label}</button>
                     ))}
@@ -558,7 +561,7 @@ const TrackingSettings: React.FC = () => {
                                     </tr>
                                     {openSummary.has(s.id) && (
                                         <tr className="tk_summary">
-                                            <td className="tk_td" colSpan={9}><SiteSummary siteId={s.id} siteName={s.name} reloadKey={reloadKey} /></td>
+                                            <td className="tk_td" colSpan={9}><SiteSummary siteId={s.id} siteName={s.name} brand={s.brand ?? ''} reloadKey={reloadKey} /></td>
                                         </tr>
                                     )}
                                     {openTag === s.id && (
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index b713674b..fabf5bf4 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.232';
+export const newVersion = '2.2.233';
```
