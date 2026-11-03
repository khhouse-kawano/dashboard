# 作業記録 2026-10-30-04　「業者別」を DAY JUST HOUSE にも（v2.2.234）

## 依頼
- 新しいブランチで改修。アクセス解析の業者別を、国分ハウジングに加えて DAY JUST HOUSE にも出す

## 変更
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| frontend/src/components/header | TrackingSettings.tsx | `VENDOR_BRANDS` に `'djh'` を追加（コメントも） |
| frontend/src/utils | version.ts | 2.2.234 |
| backend/scripts/sql | **2026-10-30_update_log_2.2.234.sql**（新規） | 更新履歴＋業務ガイド |
| backend/scripts/guide/articles/common | screen-200.md | 業者別が出るサイトを「国分ハウジングと DAY JUST HOUSE」に |

## 業務ガイド
- 「アクセス解析」：業者別の節の冒頭に DAY JUST HOUSE を足した

## 確認
- 型チェック（今回のファイルのエラーなし）
- 更新履歴の SQL をローカルに流した（no=333 で 2.2.234）
- Playwright：流入元タブのボタンが、国分ハウジング・DAY JUST HOUSE は PV・CV・業者別、かえるホーム・なごみ工務店・PG HOUSE は PV・CV だけ。ページのエラーなし
- ② と ① の PHP は変えていない
- テスト用の担当は削除済み。開発サーバー（3100）は停止済み

## 差分
```diff
diff --git a/backend/scripts/guide/articles/common/screen-200.md b/backend/scripts/guide/articles/common/screen-200.md
index 665617d6..0e7d075e 100644
--- a/backend/scripts/guide/articles/common/screen-200.md
+++ b/backend/scripts/guide/articles/common/screen-200.md
@@ -61,7 +61,7 @@ summary: 各ブランドサイトのタグの発行と、着地ページ・流
 - 帯の下に、項目ごとの件数と割合が出ます
 
 ## 業者別（流入元のとき）
-**国分ハウジング**のサイトの「流入元」のタブでは、3つ目のボタン「**業者別**」が出ます。広告の運用を頼んでいる業者ごとの割合です（ほかのブランドのサイトには出ません）。
+**国分ハウジング**と **DAY JUST HOUSE** のサイトの「流入元」のタブでは、3つ目のボタン「**業者別**」が出ます。広告の運用を頼んでいる業者ごとの割合です（ほかのブランドのサイトには出ません）。
 - 広告のキャンペーン名の末尾が「_pt1」なら **PURE GROWTH**、「_pt2」なら **Bander** の広告として数えます
 - PV と CV の帯を2本出します。割合は、この2社の広告から来た分だけを合計にして出します（それ以外の訪問は入りません）
 - 社名を押すと、その業者の**店舗別の歩留まり**が開きます
diff --git a/frontend/src/components/header/TrackingSettings.tsx b/frontend/src/components/header/TrackingSettings.tsx
index 7039e949..cf1f3e9e 100644
--- a/frontend/src/components/header/TrackingSettings.tsx
+++ b/frontend/src/components/header/TrackingSettings.tsx
@@ -21,7 +21,7 @@ import TrackingVendorFunnel from './TrackingVendorFunnel';
  * ⚠️ v2.2.203 サマリーの着地ページ・流入元を押すと、詳細のモーダル（TrackingDetail.tsx）が開く。着地ページは右のアイコンでそのページを開く。
  *   ⚠️ 上の「Meta から取り込む」は ② の meta_ads_import（待たずに返る。終わったかは「最後の取り込み」で見る）。⚠️ ② は6時間ごとにも自動で取り込む。
  * ⚠️ v2.2.232 サマリーの表の上に帯グラフ（PV・CV の割合）。流入元タブでは「業者別」（PURE GROWTH・Bander。② の vendors.ts）も出し、
- *   社名を押すと店舗別の歩留まり（TrackingVendorFunnel.tsx）が開く。⚠️ v2.2.233 業者別は国分ハウジング（brand kh）のサイトだけ（VENDOR_BRANDS）。
+ *   社名を押すと店舗別の歩留まり（TrackingVendorFunnel.tsx）が開く。⚠️ v2.2.233 業者別は国分ハウジング（brand kh）のサイトだけ（VENDOR_BRANDS）。v2.2.234 で DAY JUST HOUSE（djh）を追加。
  * ⚠️ サイトは消さない（着地の記録が残るため）。⚠️「無効」にすると着地を保存しなくなる（タグは貼ったままでもサイトに影響なし）。
  * ⚠️ 全画面モーダル（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンは Header.tsx が出す。
  * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 tk_）。
@@ -126,8 +126,8 @@ type SummaryTab = 'landing' | 'source';
 type SummarySortKey = 'key' | 'visits' | 'ad' | 'cv' | 'rate';
 /** 帯グラフの切り替え（v2.2.232）。⚠️ 業者別は流入元タブだけ */
 type BandMode = 'visits' | 'cv' | 'vendor';
-/** 業者別を出すブランド（v2.2.233。2026-10-30 の指示で国分ハウジングだけ） */
-const VENDOR_BRANDS = ['kh'];
+/** 業者別を出すブランド（v2.2.233 国分ハウジング。v2.2.234 で DAY JUST HOUSE を追加。2026-10-30 の指示） */
+const VENDOR_BRANDS = ['kh', 'djh'];
 /** 帯グラフに出す件数。⚠️ これより後ろは「その他」にまとめる */
 const BAND_TOP = 8;
 const BAND_COLORS = ['#2563eb', '#f97316', '#10b981', '#a855f7', '#eab308', '#06b6d4', '#ef4444', '#ec4899'];
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index fabf5bf4..0de31105 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.233';
+export const newVersion = '2.2.234';
```
