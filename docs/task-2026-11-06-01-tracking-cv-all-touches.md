# 作業記録 v2.2.253　アクセス解析：CV を「一度でも来た着地ページ・流入元・広告すべて」に付ける

## 依頼
- 2026-11-05「30分以上あけない仕様に変更したい。つまり一度訪問があってローカルストレージから消えなければ CV に1件つける」→ 回答「訪れたすべてに付ける」
- 2026-11-06「計画通りの 253 を進めてほしい」（v2.2.252 のあと。realty の連絡先の件は利用者の勘違いで、対応なし）

## 変える前と後
例：Meta 広告で着地ページ A に来る → 離脱 → 3日後に検索で着地ページ B に来て問い合わせ

| | 前（最後の訪問だけ） | 後（一度でも来たところすべて） |
|---|---|---|
| サマリー 着地ページ A | CV 0 | **CV 1** |
| サマリー 着地ページ B | CV 1 | CV 1 |
| サマリー 流入元 meta | CV 0 | **CV 1** |
| サマリー 流入元 organic/google | CV 1 | CV 1 |
| サマリーの CV の合計（反響の数） | 1 | 1（変えない） |
| 業者別（Google リスティング） | 最後の訪問 | 最後の訪問（変えない） |
| 詳細 A を開く | CV 0 | **CV 1**（流入元別 meta・広告に1件） |

- 同じ反響が同じ着地ページ（流入元・広告）に何回来ても、そこには1件
- 行の CV を足すと、合計（反響の数）より多くなる → 画面の注記に書いた
- 訪問者と反響のつなぎ方（`khg_vid`・localStorage）・tracker.js・30分で別の訪問にする決まりは変えていない
- DB は変わらない。過去30日の分も、新しい数え方ですぐに出直す

## 変えたもの
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/tracking | **conversions.ts** | 追加：**`ConversionTouch`**・**`touchedKeys`**。`Conversion` に `touches`（問い合わせの日までの、そのサイトへのすべての訪問）。最後の訪問の値は今までどおり |
| backend-express/src/features/tracking | **summary.ts** | 着地ページ別・流入元別の CV を `touchedKeys` で（一度でも来たところすべて）。業者別・合計は変えない |
| backend-express/src/features/tracking | **detail.ts** | 追加：`hit`。この着地ページ（流入元）に一度でも来た反響を CV に。内訳・広告別は、この着地ページ（流入元）に来た訪問の流入元・着地ページ・広告すべて。CV の一覧は、この着地ページ（流入元）に来た最後の訪問の値 |
| frontend/src/components/header/inquiry | TrackingSettings.tsx | サマリーの注記（一度でも来た〜すべてに1件ずつ。行を足すと合計より多い。業者別は最後の訪問） |
| frontend/src/components/header/inquiry | TrackingDetail.tsx | 詳細の注記 |
| frontend/src/components/header/inquiry | TrackingVendorFunnel.tsx | 注記を「サマリーの業者別の CV は最後の訪問」に |
| backend/scripts/guide/articles/common | screen-200.md | 記事「アクセス解析」の CV の数え方（サマリー・業者別・詳細） |
| backend/scripts/sql | 2026-11-06_update_log_2.2.253.sql（新規） | 更新履歴＋記事の SQL |
| frontend/src/utils | version.ts | 2.2.253 |

- ⚠️ ② の新しい request は無い（express_proxy.php の変更なし）。① の PHP は変えていない

## テスト（ローカル）
- ① 経由（`localhost:8080`）。架空の訪問（サイト1：A に Meta 広告で2回 → B に自然検索）と架空の反響（今日）を入れて確かめ、最後に消した
  - トークン無し `tracking_site_summary`・`tracking_detail` → 401
  - サマリー：合計 +1、着地 A に1件（最後の訪問ではない）、B に1件、流入元 meta +1（2回来ても1件）、organic/google +1
  - 詳細 A：CV 1、流入元別 meta 1、organic/google は出ない（A には自然検索で来ていない）、広告 ad253x は CV 1・着地 2、CV の一覧は A に来た訪問（meta・A・ad253x）
  - 詳細 B：CV 1、流入元別 organic/google 1、広告なし
  - 詳細 流入元「META」（大文字）：着地ページ別 A に1件、B は出ない
- Playwright（3100）：アクセス解析 → 国分ハウジングのサマリー（開くまで約1秒）
  - 着地 A・B の CV がそれぞれ1、注記が新しい数え方、流入元タブに「業者別は最後の訪問で数えます」、詳細の注記。画面のエラー 0
- 一時スタッフ（id 999999）・テストの訪問・反響は消した。開発サーバーは止めた
- リファクタリング：詳細の広告別の CV を2つのループから1つに。キャンペーン名は、この着地ページ（流入元）に来た訪問のもの。そのあとテストを通し直した

## 業務ガイド
- 記事「アクセス解析」（common/screen-200.md）
  - サイトのサマリー：CV は一度でも来た着地ページ・流入元すべてに1件ずつ（例つき）。表の CV を足すと合計より多くなる
  - 業者別の注意：「業者別の帯グラフの CV は最後の訪問」
  - 詳細：CV になった反響＝このページ（流入元）に一度でも来た反響。内訳・広告別の付け方
  - SQL は `2026-11-06_update_log_2.2.253.sql` の末尾。ローカルに流した

## 追加・修正した関数（全文）

### backend-express/src/features/tracking/conversions.ts
```ts
/** v2.2.253 問い合わせの日までの、そのサイトへの訪問1件（着地ページ・流入元・広告） */
export interface ConversionTouch {
  landingUrl: string;
  source: string;
  adId: string;
  campaign: string;
}

// Conversion に追加
  /** v2.2.253 問い合わせの日までの、そのサイトへのすべての訪問（古い順。最後の1件は上の値と同じ訪問） */
  touches: ConversionTouch[];

/**
 * v2.2.253 CV の訪問のうち、条件に合うものから取り出した値（重複なし）。
 * ⚠️ 1件の CV が同じ着地ページに何回来ても、そのページには1件（「訪れたすべてに1件ずつ」）。fold は大文字・小文字を区別しない（流入元）
 */
export const touchedKeys = (
  c: Conversion,
  pick: (t: ConversionTouch) => string,
  fold = false,
  where: (t: ConversionTouch) => boolean = () => true
): string[] => {
  const seen = new Map<string, string>();
  for (const t of c.touches) {
    if (!where(t)) continue;
    const v = pick(t);
    const k = fold ? v.toLowerCase() : v;
    if (!seen.has(k)) seen.set(k, v);
  }
  return [...seen.values()];
};

// attributeConversions の中（反響ごと）
    // ⚠️ サイトごとに、問い合わせの日までの訪問（⚠️ touches は古い順。最後の1件がラストクリック）
    const bySite = new Map<number, TouchRow[]>();
    for (const touch of touchesByVisitor.get(inquiry.vid) ?? []) {
      if (touch.created_at > limit) continue;
      const list = bySite.get(Number(touch.site_id)) ?? [];
      list.push(touch);
      bySite.set(Number(touch.site_id), list);
    }
    for (const [site, touches] of bySite) {
      const touch = touches[touches.length - 1];
      const list = result.get(site) ?? [];
      list.push({
        inquiryTable: inquiry.inquiry_table, inquiryId: Number(inquiry.id), inquiryDay: inquiry.inquiry_day ?? '', landingUrl: touch.landing_url ?? '', source: touch.source ?? '',
        adId: touch.utm_content ?? '', campaign: touch.utm_campaign ?? '',
        utmSource: touch.utm_source ?? '', utmMedium: touch.utm_medium ?? '', touchedAt: touch.created_at,
        touches: touches.map((t) => ({ landingUrl: t.landing_url ?? '', source: t.source ?? '', adId: t.utm_content ?? '', campaign: t.utm_campaign ?? '' })),
      });
      result.set(site, list);
    }
```

### backend-express/src/features/tracking/summary.ts（trackingSiteSummary の中）
```ts
  const landing = mergeRows(landingRows, cv.flatMap((c) => touchedKeys(c, (t) => t.landingUrl)), false);
  const source = mergeRows(sourceRows, cv.flatMap((c) => touchedKeys(c, (t) => t.source, true)), true);
```

### backend-express/src/features/tracking/detail.ts（trackingDetail の中）
```ts
  /** この着地ページ（流入元）に来た訪問か。⚠️ 流入元は大文字・小文字を区別しない */
  const hit = (t: ConversionTouch): boolean =>
    axis === 'landing' ? t.landingUrl === key : t.source.toLowerCase() === key.toLowerCase();
  const cv = ((await attributeConversions(siteId)).get(siteId) ?? []).filter((c: Conversion) => c.touches.some(hit));
  ...
  const breakdown = axis === 'landing'
    ? bucketize(rows.map((r) => r.source ?? ''), adFlags, cv.flatMap((c) => touchedKeys(c, (t) => t.source, true, hit)), true)
    : bucketize(rows.map((r) => r.landing_url ?? ''), adFlags, cv.flatMap((c) => touchedKeys(c, (t) => t.landingUrl, false, hit)), false);
  ...
  // ⚠️ v2.2.253: この着地ページ（流入元）に来た訪問の広告すべてに1件ずつ（同じ広告は1件）
  for (const c of cv) {
    for (const adId of touchedKeys(c, (t) => t.adId, false, (t) => hit(t) && t.adId !== '')) {
      const campaign = c.touches.find((t) => hit(t) && t.adId === adId)?.campaign ?? '';
      const a = adMap.get(adId) ?? { adId, campaign, visits: 0, cv: 0, campaigns: new Map<string, number>() };
      a.cv += 1;
      adMap.set(adId, a);
    }
  }
  ...
  const cvList = cv.map((c) => {
    const r = inquiryById.get(`${c.inquiryTable}:${c.inquiryId}`);
    // ⚠️ v2.2.253: この着地ページ（流入元）に来た最後の訪問
    const t = [...c.touches].reverse().find(hit) ?? c.touches[c.touches.length - 1];
    return {
      day: c.inquiryDay,
      medium: r?.response_medium || r?.medium || '',
      campaign: r?.hp_campaign ?? '',
      shop: r?.shop ?? '',
      source: t?.source ?? c.source,
      landingUrl: t?.landingUrl ?? c.landingUrl,
      adId: t?.adId ?? c.adId,
    };
  }).sort((x, y) => y.day.localeCompare(x.day));
```

## git diff（コード）
```diff
diff --git a/backend-express/src/features/tracking/conversions.ts b/backend-express/src/features/tracking/conversions.ts
index 4e555d4e0..92e71106b 100644
--- a/backend-express/src/features/tracking/conversions.ts
+++ b/backend-express/src/features/tracking/conversions.ts
@@ -9,6 +9,9 @@ import { UUID_PATTERN } from './params';
  * ⚠️ CV ＝ 直近30日の反響（削除を除く）のうち、landing_params の khg_vid が、問い合わせの日までにそのサイトを訪問していたもの。
  *   ⚠️ 1件の反響が複数のサイトを訪問していれば、それぞれのサイトで1件（サイトごとに見る数字のため）。
  *   ⚠️ どの訪問の手柄にするかは、問い合わせの日までの「そのサイトへの最後の訪問」（ラストクリック）。
+ *   ⚠️ v2.2.253: あわせて、問い合わせの日までの「そのサイトへのすべての訪問」（touches）も持たせる。
+ *     着地ページ別・流入元別・広告別（summary.ts・detail.ts）は、一度でも来たところすべてに1件ずつ付ける（2026-11-05 の利用者の決定「訪れたすべてに付ける」）。
+ *     ⚠️ 業者別（vendors.ts）と合計（反響の数）は、今までどおり最後の訪問・1件で数える。
  * ⚠️ 反響の日付（inquiry_date）は 'YYYY/MM/DD' の文字列で時刻が無い。⚠️ その日の 23:59:59 までの訪問を「問い合わせ前」とみなす。
  * ⚠️ v2.2.205 かえるホームの反響（inquiry_customer_kaeru。landing_params は cvMatch.ts が書く）も数える。
  *   ⚠️ id は表ごとの番号なので、どちらの表の反響か（inquiryTable）と組で見ること。
@@ -42,6 +45,14 @@ interface TouchRow extends RowDataPacket {
   utm_medium: string | null;
 }
 
+/** v2.2.253 問い合わせの日までの、そのサイトへの訪問1件（着地ページ・流入元・広告） */
+export interface ConversionTouch {
+  landingUrl: string;
+  source: string;
+  adId: string;
+  campaign: string;
+}
+
 export interface Conversion {
   /** ⚠️ v2.2.205 どちらの表の反響か（inquiryId は表ごとの番号） */
   inquiryTable: CvTable;
@@ -57,9 +68,31 @@ export interface Conversion {
   utmSource: string;
   utmMedium: string;
   touchedAt: string;
+  /** v2.2.253 問い合わせの日までの、そのサイトへのすべての訪問（古い順。最後の1件は上の値と同じ訪問） */
+  touches: ConversionTouch[];
 }
 
-/** サイトID → そのサイトの CV（反響1件につき、最後の訪問1つ） */
+/**
+ * v2.2.253 CV の訪問のうち、条件に合うものから取り出した値（重複なし）。
+ * ⚠️ 1件の CV が同じ着地ページに何回来ても、そのページには1件（「訪れたすべてに1件ずつ」）。fold は大文字・小文字を区別しない（流入元）
+ */
+export const touchedKeys = (
+  c: Conversion,
+  pick: (t: ConversionTouch) => string,
+  fold = false,
+  where: (t: ConversionTouch) => boolean = () => true
+): string[] => {
+  const seen = new Map<string, string>();
+  for (const t of c.touches) {
+    if (!where(t)) continue;
+    const v = pick(t);
+    const k = fold ? v.toLowerCase() : v;
+    if (!seen.has(k)) seen.set(k, v);
+  }
+  return [...seen.values()];
+};
+
+/** サイトID → そのサイトの CV（反響1件につき1つ。最後の訪問と、すべての訪問） */
 export const attributeConversions = async (siteId?: number): Promise<Map<number, Conversion[]>> => {
   const result = new Map<number, Conversion[]>();
   const inquiries = (await query<InquiryRow>(
@@ -92,17 +125,22 @@ export const attributeConversions = async (siteId?: number): Promise<Map<number,
 
   for (const inquiry of inquiries) {
     const limit = `${inquiry.inquiry_day} 23:59:59`;
-    // ⚠️ サイトごとに、問い合わせの日までの最後の訪問（⚠️ touches は古い順）
-    const lastBySite = new Map<number, TouchRow>();
+    // ⚠️ サイトごとに、問い合わせの日までの訪問（⚠️ touches は古い順。最後の1件がラストクリック）
+    const bySite = new Map<number, TouchRow[]>();
     for (const touch of touchesByVisitor.get(inquiry.vid) ?? []) {
-      if (touch.created_at <= limit) lastBySite.set(Number(touch.site_id), touch);
+      if (touch.created_at > limit) continue;
+      const list = bySite.get(Number(touch.site_id)) ?? [];
+      list.push(touch);
+      bySite.set(Number(touch.site_id), list);
     }
-    for (const [site, touch] of lastBySite) {
+    for (const [site, touches] of bySite) {
+      const touch = touches[touches.length - 1];
       const list = result.get(site) ?? [];
       list.push({
         inquiryTable: inquiry.inquiry_table, inquiryId: Number(inquiry.id), inquiryDay: inquiry.inquiry_day ?? '', landingUrl: touch.landing_url ?? '', source: touch.source ?? '',
         adId: touch.utm_content ?? '', campaign: touch.utm_campaign ?? '',
         utmSource: touch.utm_source ?? '', utmMedium: touch.utm_medium ?? '', touchedAt: touch.created_at,
+        touches: touches.map((t) => ({ landingUrl: t.landing_url ?? '', source: t.source ?? '', adId: t.utm_content ?? '', campaign: t.utm_campaign ?? '' })),
       });
       result.set(site, list);
     }
diff --git a/backend-express/src/features/tracking/detail.ts b/backend-express/src/features/tracking/detail.ts
index 3a8046433..74a5cff75 100644
--- a/backend-express/src/features/tracking/detail.ts
+++ b/backend-express/src/features/tracking/detail.ts
@@ -2,7 +2,7 @@ import type { RowDataPacket } from 'mysql2/promise';
 import { query } from '../../db/pool';
 import type { AuthenticatedStaff } from '../../types/staff';
 import { isMetaConfigured } from '../metaAds/importer';
-import { attributeConversions, CV_TABLES, DAYS, type Conversion } from './conversions';
+import { attributeConversions, CV_TABLES, DAYS, touchedKeys, type Conversion, type ConversionTouch } from './conversions';
 import { AD_TOUCH_SQL } from './params';
 import { canManageTracking, type TrackingResult } from './sites';
 
@@ -12,7 +12,9 @@ import { canManageTracking, type TrackingResult } from './sites';
  * ─────────────────────────────────────────────
  * ⚠️ 期間は直近30日（DAYS）。⚠️ 対象はサイト1つの、着地ページ1つ（axis=landing）か流入元1つ（axis=source）。
  * ⚠️ PV は tracking_touches の行数（30分以内のページの移動はまとめて1件。ページの閲覧回数そのものではない）。
- * ⚠️ CV の数え方は conversions.ts（問い合わせの日までの最後の訪問の着地ページ・流入元・広告に1件）。
+ * ⚠️ CV の数え方は conversions.ts。⚠️ v2.2.253: 問い合わせの日までに、この着地ページ（流入元）に**一度でも来た**反響を CV にする（以前は最後の訪問だけ）。
+ *   内訳（流入元別・着地ページ別）と広告別は、その反響の訪問のうち、この着地ページ（流入元）に来た訪問の流入元・着地ページ・広告すべてに1件ずつ。
+ *   CV の一覧の流入元・着地ページ・広告は、この着地ページ（流入元）に来た最後の訪問のもの。
  * ⚠️ CV の一覧は個人情報を出さない（日付・反響媒体・キャンペーン・店舗だけ。2026-10-21 の決定）。
  * ⚠️ Meta 広告の数字（表示回数・クリック・費用）は meta_ad_items / meta_ad_daily（features/metaAds/ が取り込む）。
  *   ⚠️ 広告ID は着地の utm_content（Meta の URL パラメータ {{ad.id}}）でつなぐ。
@@ -162,11 +164,10 @@ export const trackingDetail = async (
     key === '' ? [siteId] : [siteId, key]
   );
 
-  const match = (c: Conversion): boolean => {
-    const value = axis === 'landing' ? c.landingUrl : c.source;
-    return axis === 'landing' ? value === key : value.toLowerCase() === key.toLowerCase();
-  };
-  const cv = ((await attributeConversions(siteId)).get(siteId) ?? []).filter(match);
+  /** この着地ページ（流入元）に来た訪問か。⚠️ 流入元は大文字・小文字を区別しない */
+  const hit = (t: ConversionTouch): boolean =>
+    axis === 'landing' ? t.landingUrl === key : t.source.toLowerCase() === key.toLowerCase();
+  const cv = ((await attributeConversions(siteId)).get(siteId) ?? []).filter((c: Conversion) => c.touches.some(hit));
 
   // 上の数字
   const perVisitor = new Map<string, number>();
@@ -184,8 +185,8 @@ export const trackingDetail = async (
   for (const r of rows) hours[Number(r.hour)].visits += 1;
 
   const breakdown = axis === 'landing'
-    ? bucketize(rows.map((r) => r.source ?? ''), adFlags, cv.map((c) => c.source), true)
-    : bucketize(rows.map((r) => r.landing_url ?? ''), adFlags, cv.map((c) => c.landingUrl), false);
+    ? bucketize(rows.map((r) => r.source ?? ''), adFlags, cv.flatMap((c) => touchedKeys(c, (t) => t.source, true, hit)), true)
+    : bucketize(rows.map((r) => r.landing_url ?? ''), adFlags, cv.flatMap((c) => touchedKeys(c, (t) => t.landingUrl, false, hit)), false);
   const devices = bucketize(rows.map((r) => deviceOf(r.user_agent)), adFlags, [], false);
 
   // 広告別（utm_content。⚠️ キャンペーン名は一番多く出た utm_campaign）
@@ -199,11 +200,14 @@ export const trackingDetail = async (
     a.campaigns.set(c, (a.campaigns.get(c) ?? 0) + 1);
     adMap.set(id, a);
   }
+  // ⚠️ v2.2.253: この着地ページ（流入元）に来た訪問の広告すべてに1件ずつ（同じ広告は1件）
   for (const c of cv) {
-    if (c.adId === '') continue;
-    const a = adMap.get(c.adId) ?? { adId: c.adId, campaign: c.campaign, visits: 0, cv: 0, campaigns: new Map<string, number>() };
-    a.cv += 1;
-    adMap.set(c.adId, a);
+    for (const adId of touchedKeys(c, (t) => t.adId, false, (t) => hit(t) && t.adId !== '')) {
+      const campaign = c.touches.find((t) => hit(t) && t.adId === adId)?.campaign ?? '';
+      const a = adMap.get(adId) ?? { adId, campaign, visits: 0, cv: 0, campaigns: new Map<string, number>() };
+      a.cv += 1;
+      adMap.set(adId, a);
+    }
   }
   for (const a of adMap.values()) a.campaign = [...a.campaigns.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? a.campaign;
 
@@ -247,14 +251,16 @@ export const trackingDetail = async (
   }
   const cvList = cv.map((c) => {
     const r = inquiryById.get(`${c.inquiryTable}:${c.inquiryId}`);
+    // ⚠️ v2.2.253: この着地ページ（流入元）に来た最後の訪問
+    const t = [...c.touches].reverse().find(hit) ?? c.touches[c.touches.length - 1];
     return {
       day: c.inquiryDay,
       medium: r?.response_medium || r?.medium || '',
       campaign: r?.hp_campaign ?? '',
       shop: r?.shop ?? '',
-      source: c.source,
-      landingUrl: c.landingUrl,
-      adId: c.adId,
+      source: t?.source ?? c.source,
+      landingUrl: t?.landingUrl ?? c.landingUrl,
+      adId: t?.adId ?? c.adId,
     };
   }).sort((x, y) => y.day.localeCompare(x.day));
 
diff --git a/backend-express/src/features/tracking/summary.ts b/backend-express/src/features/tracking/summary.ts
index ff963d8c7..14f57cae9 100644
--- a/backend-express/src/features/tracking/summary.ts
+++ b/backend-express/src/features/tracking/summary.ts
@@ -1,7 +1,7 @@
 import type { RowDataPacket } from 'mysql2/promise';
 import { query } from '../../db/pool';
 import type { AuthenticatedStaff } from '../../types/staff';
-import { attributeConversions, DAYS } from './conversions';
+import { attributeConversions, DAYS, touchedKeys } from './conversions';
 import { AD_TOUCH_SQL } from './params';
 import { canManageTracking, type TrackingResult } from './sites';
 import { GOOGLE_LISTING_SQL, isGoogleListing, TRACKING_VENDORS, VENDOR_CASE_SQL, vendorOf } from './vendors';
@@ -12,8 +12,8 @@ import { GOOGLE_LISTING_SQL, isGoogleListing, TRACKING_VENDORS, VENDOR_CASE_SQL,
  * ─────────────────────────────────────────────
  * ⚠️ 期間は直近30日（訪問は created_at、反響は inquiry_date）。
  * ⚠️ 訪問数は広告・広告以外の両方（tracking_touches の行数）。⚠️ 一覧の「直近30日の着地」は広告の分だけ（sites.ts）。
- * ⚠️ CV の数え方は conversions.ts。着地ページ別・流入元別は、その CV の「最後の訪問」の着地ページ・流入元に1件を付ける。
- *   ⚠️ その訪問が30日より前なら、訪問数 0 の行として出る。
+ * ⚠️ CV の数え方は conversions.ts。着地ページ別・流入元別は、問い合わせの日までに**一度でも来た**着地ページ・流入元すべてに1件ずつ付ける（v2.2.253。以前は最後の訪問だけ）。
+ *   ⚠️ 行の CV を足すと、合計（kpi.cv＝反響の数）より多くなる。⚠️ 訪問が30日より前なら、訪問数 0 の行として出る。
  * ⚠️ v2.2.232 業者別（vendors）。⚠️ v2.2.238 から、2026-10-22 以降の Google リスティング広告の訪問だけを数える（判定は vendors.ts）。
  *   ⚠️ CV は「最後の訪問」が Google リスティング広告のものだけ、その訪問の utm_campaign・utm_medium で分ける。
  * ─────────────────────────────────────────────
@@ -63,8 +63,8 @@ export const trackingSiteSummary = async (staff: AuthenticatedStaff | null, site
     group('t.landing_url'), group('t.source'), group(VENDOR_CASE_SQL, GOOGLE_LISTING_SQL), attributeConversions(siteId),
   ]);
   const cv = conversions.get(siteId) ?? [];
-  const landing = mergeRows(landingRows, cv.map((c) => c.landingUrl), false);
-  const source = mergeRows(sourceRows, cv.map((c) => c.source), true);
+  const landing = mergeRows(landingRows, cv.flatMap((c) => touchedKeys(c, (t) => t.landingUrl)), false);
+  const source = mergeRows(sourceRows, cv.flatMap((c) => touchedKeys(c, (t) => t.source, true)), true);
   // v2.2.232 業者別。⚠️ 業者が0件でも行を出す（帯グラフの凡例をそろえる）
   // ⚠️ v2.2.238 割合の分母は 2026-10-22 以降の Google リスティング広告の分だけ（2026-11-02 の指示）
   const listingCv = cv.filter((c) => isGoogleListing(c.utmSource, c.utmMedium, c.touchedAt));
diff --git a/backend/scripts/guide/articles/common/screen-200.md b/backend/scripts/guide/articles/common/screen-200.md
index fa819913d..46c3f8b9e 100644
--- a/backend/scripts/guide/articles/common/screen-200.md
+++ b/backend/scripts/guide/articles/common/screen-200.md
@@ -51,7 +51,9 @@ summary: 各ブランドサイトのタグの発行と、着地ページ・流
 - 表の見出しを押すと並べ替えができます
 - 「着地ページ」の表では、ページのアドレスを押すと、そのページが別のタブで開きます
 - 流入元は、広告の utm_source（例：meta、google）か、広告以外なら「organic/google」（自然検索）「social/instagram」（SNS）「referral/ドメイン」（他のサイト）「direct」（直接）です
-- CV は、問い合わせの日までの**最後の訪問**の着地ページ・流入元で数えます。最後の訪問が30日より前なら、PV 0 の行に CV だけが出ます
+- CV は、問い合わせの日までに**一度でも来た**着地ページ・流入元の**すべて**に1件ずつ付けます。例：広告から着地ページ A に来て離れ、3日後に検索から着地ページ B に来て問い合わせた人は、A にも B にも、広告にも検索にも1件ずつ付きます
+- そのため、表の CV を足すと、上の「CV」（反響の数）より多くなります。同じ人が同じページに何回来ても、そのページには1件です
+- 訪問が30日より前なら、PV 0 の行に CV だけが出ます
 
 > 注意：ここでの PV は、1回の訪問（30分以内のページの移動はまとめて1回）を1件と数えています。ページが見られた回数そのものではないので、Google アナリティクスの PV より少なく出ます。
 
@@ -73,7 +75,7 @@ summary: 各ブランドサイトのタグの発行と、着地ページ・流
 - 数えるのは、注文・建売の顧客のうち、問い合わせの日までに、このサイトへその業者の Google リスティング広告から**一度でも**来ていた人です（2026年10月22日以降の訪問）
 - 来場＝初回面談以降の日付あり、次アポ＝事前審査・第二面談・契約の日付あり、契約＝契約済み。重複は数えません
 
-> 注意：帯グラフの CV は「最後の訪問」で数えますが、歩留まりは「一度でも来ていれば」数えます。数え方が違うので、件数は一致しません。
+> 注意：業者別の帯グラフの CV は「最後の訪問」で数えますが、歩留まりは「一度でも来ていれば」数えます。数え方が違うので、件数は一致しません。
 
 > 注意：広告費が入力できるようになったら、総計の行に KPI 単価（1件あたりの広告費）を出す予定です。
 
@@ -84,7 +86,8 @@ summary: 各ブランドサイトのタグの発行と、着地ページ・流
 - **ページの前後**（着地ページのとき）：このページの前に見ていたページと、次に見たページです。どこから入って、どこへ進んだかが分かります
 - **流入元別**（着地ページのとき）／**着地ページ別**（流入元のとき）
 - **端末**（スマホ・PC・タブレット）と**時間帯**
-- **CV になった反響**：日付・反響媒体・キャンペーン・店舗だけを出します（お名前などは出しません）
+- **CV になった反響**：問い合わせの日までに、このページ（流入元）に一度でも来た反響です。日付・反響媒体・キャンペーン・店舗だけを出します（お名前などは出しません）
+- 流入元別・着地ページ別・広告別の CV は、その反響がこのページ（流入元）に来たときの流入元・着地ページ・広告のすべてに1件ずつ付けます
 
 > 注意：ページの前後と閲覧回数は、閲覧の記録を始めた日（v2.2.203 を出した日）からの分だけです。
 
diff --git a/frontend/src/components/header/inquiry/TrackingDetail.tsx b/frontend/src/components/header/inquiry/TrackingDetail.tsx
index 392bf1402..4f74e9a31 100644
--- a/frontend/src/components/header/inquiry/TrackingDetail.tsx
+++ b/frontend/src/components/header/inquiry/TrackingDetail.tsx
@@ -235,7 +235,7 @@ const TrackingDetail: React.FC<{ siteId: number; axis: DetailAxis; value: string
                                 </div>
                             )}
                         </section>
-                        <div className="td_note">※ PV は1回の訪問（30分以内のページの移動はまとめて1件）を1件と数えます。閲覧回数は、ページが開かれた回数です。CV は、問い合わせの日までの最後の訪問で数えます。</div>
+                        <div className="td_note">※ PV は1回の訪問（30分以内のページの移動はまとめて1件）を1件と数えます。閲覧回数は、ページが開かれた回数です。CV は、問い合わせの日までにこのページ（流入元）に一度でも来た反響です。内訳・広告別の CV は、そのとき来た流入元・着地ページ・広告すべてに1件ずつ付けます。</div>
                     </>
                 )}
             </Modal.Body>
diff --git a/frontend/src/components/header/inquiry/TrackingSettings.tsx b/frontend/src/components/header/inquiry/TrackingSettings.tsx
index 91cc77276..e3d9e2dc5 100644
--- a/frontend/src/components/header/inquiry/TrackingSettings.tsx
+++ b/frontend/src/components/header/inquiry/TrackingSettings.tsx
@@ -271,7 +271,8 @@ const SiteSummary: React.FC<{ siteId: number; siteName: string; brand: string; r
                     <button key={key} type="button" role="tab" aria-selected={tab === key}
                         className={`tk_tab${tab === key ? ' is_active' : ''}`} onClick={() => setTab(key)}>{label}</button>
                 ))}
-                <span className="tk_sub">CV は、問い合わせの日までの最後の訪問の{tab === 'landing' ? '着地ページ' : '流入元'}で数えます</span>
+                {/* ⚠️ v2.2.253: CV は一度でも来た着地ページ・流入元すべてに1件ずつ（② conversions.ts）。⚠️ 業者別の帯は今までどおり最後の訪問 */}
+                <span className="tk_sub">CV は、問い合わせの日までに一度でも来た{tab === 'landing' ? '着地ページ' : '流入元'}すべてに1件ずつ付けます（行を足すと、上の CV の合計より多くなります）{showVendor ? '。業者別は最後の訪問で数えます' : ''}</span>
             </div>
             <div className="tk_band_wrap">
                 <div className="tk_band_switch" role="group" aria-label="帯グラフの切り替え">
diff --git a/frontend/src/components/header/inquiry/TrackingVendorFunnel.tsx b/frontend/src/components/header/inquiry/TrackingVendorFunnel.tsx
index ed2e6ad64..79a94efdb 100644
--- a/frontend/src/components/header/inquiry/TrackingVendorFunnel.tsx
+++ b/frontend/src/components/header/inquiry/TrackingVendorFunnel.tsx
@@ -8,7 +8,7 @@ import apiClient from '../../../utils/apiClient';
  * ─────────────────────────────────────────────
  * ⚠️ 開いたときに ② の tracking_vendor_funnel を取りに行く（features/tracking/vendorFunnel.ts）。
  * ⚠️ 数えるのは、顧客台帳（注文・建売）の顧客のうち、問い合わせの日までにそのサイトへその業者の広告から一度でも来ていた人。
- *   ⚠️ サマリーの CV（最後の訪問で数える）とは数え方が違うので、件数は一致しない（注意書きに出す）。
+ *   ⚠️ サマリーの業者別の CV（最後の訪問で数える）とは数え方が違うので、件数は一致しない（注意書きに出す）。
  * ⚠️ 1行目はブランド（サイト）の総計。⚠️ 並べ替えは店舗の行だけ（総計は先頭のまま）。
  * ⚠️ KPI単価は、広告費を入力できるようになってから総計の行にだけ付ける（2026-10-30 の指示）。
  * ⚠️ アクセス解析（全画面モーダル）の上に重ねるので、幕を z-index 1055 に上げる（TrackingDetail.tsx と同じ）。
@@ -143,7 +143,7 @@ const TrackingVendorFunnel: React.FC<{ siteId: number; siteName: string; vendor:
                         </div>
                         <div className="tv_note">
                             ※ 問い合わせの日までに、このサイトへ {vendor.name} の Google リスティング広告（キャンペーン名か媒体が {vendor.rule}もの）から一度でも来ていた反響を数えます（2026-10-22 以降の訪問）。
-                            サマリーの CV は最後の訪問で数えるため、件数は一致しません。<br />
+                            サマリーの業者別の CV は最後の訪問で数えるため、件数は一致しません。<br />
                             ※ 来場＝初回面談以降の日付あり、次アポ＝事前審査・第二面談・契約の日付あり、契約＝契約済み。重複は数えません。率は総反響に対する割合です。
                         </div>
                     </>
```
