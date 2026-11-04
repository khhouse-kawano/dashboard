# v2.2.238 アクセス解析の「業者別」を Google リスティング広告だけに

## 依頼（ReadMeClaude.md ＋ 2026-11-02 のチャット）
- 業者別の PURE GROWTH・Bander の比率: `_pt2` → Bander、`_pt1` を含む／`_pt1`・`_pt2` を含まない → PURE GROWTH
- ⚠️ 追加の指示：`_pt2` が付き始めた 10/22 ごろからの **Google リスティング広告だけ** を扱う
- ⚠️ 利用者の判断：クリックID（gclid）だけで utm の無い訪問は **外す**

## 判定（② features/tracking/vendors.ts に集約）
- 対象：`utm_source = google` かつ `utm_medium` が `cpc` で始まる（cpc_pt1 等を含む）かつ `created_at >= 2026-10-22 00:00:00`
- 業者：`utm_campaign` か `utm_medium` に `_pt2` → Bander（pt2）、それ以外 → PURE GROWTH（pt1）。大文字・小文字は区別しない
- ⚠️ 指示書のファイル名は TrackingDetail.tsx だったが、業者の判定は ② にあり、TrackingDetail.tsx は業者に関わらないので触っていない

## 変えたファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend-express/src/features/tracking | vendors.ts | 判定を全面的に書き換え（GOOGLE_LISTING_SQL・isGoogleListing・VENDOR_START を追加、suffix → rule、vendorLike・OTHER_VENDOR_KEY を削除） |
| 同上 | summary.ts | 業者別の訪問を Google リスティング広告に絞る。CV は最後の訪問が Google リスティング広告のものだけ |
| 同上 | vendorFunnel.ts | 最初の来訪を Google リスティング広告・業者の判定で探す |
| 同上 | conversions.ts | CV に最後の訪問の utmSource・utmMedium・touchedAt を追加（既存の項目は変えない） |
| backend-express/src/gateway | registry.ts | tracking_vendor_funnel の説明文 |
| frontend/src/components/header | TrackingSettings.tsx・TrackingVendorFunnel.tsx | suffix → rule、説明文 |
| frontend/src/utils | version.ts | 2.2.238 |
| backend/scripts/sql | 2026-11-02_update_log_2.2.238.sql（新規） | 更新履歴＋業務ガイド |
| backend/scripts/guide/articles/common | screen-200.md | 業務ガイド |

## 業務ガイド
- 記事「アクセス解析」の「業者別」の節：対象が 2026/10/22 以降の Google リスティング広告だけであること、`_pt2` → Bander・それ以外 → PURE GROWTH、CV は最後の訪問が Google リスティング広告の反響だけ、を書いた。店舗別の歩留まりの「数えるのは」も同じ範囲に直した

## 確認
- ② の型チェック・フロントの本番ビルド：成功
- ① を通したトークン無しの tracking_site_summary・tracking_vendor_funnel：401（認証が必要です）
- ② の関数を管理者として直接呼び、SQL で別に数えた件数と照合：3サイトとも一致
  - 国分ハウジング PURE GROWTH 1,999／Bander 1,386、DAY JUST HOUSE 1,035／518、かえるホーム 1,325／1,255
  - Google ディスプレイ・Yahoo に付いた _pt2 の1,125件は外れている。存在しない業者は 400
- Playwright（PC）：アクセス解析 → 国分ハウジング → 流入元 → 業者別 → PURE GROWTH。説明文・帯（59.1%／40.9%）・歩留まりの注記が出る。ページのエラー0件
  - ⚠️ 確認用の一時的な管理者（staff.id=999999）をローカルDBに作り、確認後に削除した
- update_log をローカルに1回流した（no=337）

## 変えたコード（全文・差分）
```ts
/**
 * 広告の業者（v2.2.232。v2.2.238 で判定を変更）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 画面は header/TrackingSettings.tsx（流入元タブの「業者別」）と header/TrackingVendorFunnel.tsx（歩留まり）。
 * ⚠️⚠️ v2.2.238（2026-11-02 の指示）:
 *   ⚠️ 対象は Google リスティング広告の訪問だけ（utm_source が google、utm_medium が cpc で始まる。cpc_pt1 なども含む）。
 *     ⚠️ Google ディスプレイ・Yahoo・Meta などは業者別に入れない。⚠️ クリックID（gclid）だけで utm の無い訪問も外す（検索かディスプレイか分からないため）。
 *   ⚠️ 対象は _pt が付き始めた 2026-10-22 以降の訪問だけ（VENDOR_START）。
 *   ⚠️ utm_campaign か utm_medium のどこかに _pt2 があれば Bander。それ以外（_pt1 を含む・どちらも含まない）は PURE GROWTH。
 *     ⚠️ _pt は utm_medium（cpc_pt1）に付いていることもある。⚠️ 末尾でなく「含む」で見る。⚠️ 大文字・小文字は区別しない。
 * ⚠️ 業者を足すときは、TRACKING_VENDORS と VENDOR_CASE_SQL・vendorOf の判定をそろえて直す。
 * ─────────────────────────────────────────────
 */

export interface TrackingVendor {
  /** 画面とのやり取りに使うキー */
  key: string;
  /** 画面に出す判定の説明 */
  rule: string;
  name: string;
}

export const TRACKING_VENDORS: readonly TrackingVendor[] = [
  { key: 'pt1', rule: '_pt1 を含む、または _pt1・_pt2 のどちらも含まない', name: 'PURE GROWTH' },
  { key: 'pt2', rule: '_pt2 を含む', name: 'Bander' },
];

/** 業者別の対象を始める日時（⚠️ _pt が付き始めた日。2026-11-02 の指示） */
export const VENDOR_START = '2026-10-22 00:00:00';

export const findVendor = (key: unknown): TrackingVendor | undefined => TRACKING_VENDORS.find((v) => v.key === key);

/** tracking_touches（別名 t）の行が業者別の対象（2026-10-22 以降の Google リスティング広告）か（SQL） */
export const GOOGLE_LISTING_SQL = `(LOWER(TRIM(t.utm_source)) = 'google' AND LOWER(TRIM(t.utm_medium)) LIKE 'cpc%' AND t.created_at >= '${VENDOR_START}')`;

/** tracking_touches（別名 t）の行 → 業者のキー（SQL）。⚠️ GOOGLE_LISTING_SQL で絞った行に使う。⚠️ `_` は LIKE の1文字なので逃がす */
export const VENDOR_CASE_SQL = `CASE WHEN LOWER(CONCAT(COALESCE(t.utm_campaign, ''), ' ', COALESCE(t.utm_medium, ''))) LIKE '%\\_pt2%' THEN 'pt2' ELSE 'pt1' END`;

/** 訪問1件が業者別の対象か（GOOGLE_LISTING_SQL と同じ判定）。touchedAt は 'YYYY-MM-DD HH:MM:SS' */
export const isGoogleListing = (utmSource: string | null | undefined, utmMedium: string | null | undefined, touchedAt: string): boolean =>
  String(utmSource ?? '').trim().toLowerCase() === 'google'
  && String(utmMedium ?? '').trim().toLowerCase().startsWith('cpc')
  && touchedAt >= VENDOR_START;

/** 訪問1件 → 業者のキー（VENDOR_CASE_SQL と同じ判定） */
export const vendorOf = (utmCampaign: string | null | undefined, utmMedium: string | null | undefined): string =>
  `${String(utmCampaign ?? '')} ${String(utmMedium ?? '')}`.toLowerCase().includes('_pt2') ? 'pt2' : 'pt1';
```

```diff
diff --git a/backend-express/src/features/tracking/conversions.ts b/backend-express/src/features/tracking/conversions.ts
index e800cdab..4e555d4e 100644
--- a/backend-express/src/features/tracking/conversions.ts
+++ b/backend-express/src/features/tracking/conversions.ts
@@ -38,6 +38,8 @@ interface TouchRow extends RowDataPacket {
   source: string | null;
   utm_content: string | null;
   utm_campaign: string | null;
+  utm_source: string | null;
+  utm_medium: string | null;
 }
 
 export interface Conversion {
@@ -51,6 +53,10 @@ export interface Conversion {
   /** v2.2.203 最後の訪問の utm_content（Meta 広告なら広告ID）・utm_campaign */
   adId: string;
   campaign: string;
+  /** v2.2.238 最後の訪問の utm_source・utm_medium・日時（業者別の判定に使う。vendors.ts） */
+  utmSource: string;
+  utmMedium: string;
+  touchedAt: string;
 }
 
 /** サイトID → そのサイトの CV（反響1件につき、最後の訪問1つ） */
@@ -71,7 +77,7 @@ export const attributeConversions = async (siteId?: number): Promise<Map<number,
   for (let i = 0; i < vids.length; i += CHUNK) {
     const part = vids.slice(i, i + CHUNK);
     const rows = await query<TouchRow>(
-      `SELECT t.site_id, t.visitor_id, DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, t.landing_url, t.source, t.utm_content, t.utm_campaign
+      `SELECT t.site_id, t.visitor_id, DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, t.landing_url, t.source, t.utm_content, t.utm_campaign, t.utm_source, t.utm_medium
          FROM tracking_touches t
         WHERE t.visitor_id IN (${part.map(() => '?').join(', ')})${siteId === undefined ? '' : ' AND t.site_id = ?'}
         ORDER BY t.created_at, t.id`,
@@ -96,6 +102,7 @@ export const attributeConversions = async (siteId?: number): Promise<Map<number,
       list.push({
         inquiryTable: inquiry.inquiry_table, inquiryId: Number(inquiry.id), inquiryDay: inquiry.inquiry_day ?? '', landingUrl: touch.landing_url ?? '', source: touch.source ?? '',
         adId: touch.utm_content ?? '', campaign: touch.utm_campaign ?? '',
+        utmSource: touch.utm_source ?? '', utmMedium: touch.utm_medium ?? '', touchedAt: touch.created_at,
       });
       result.set(site, list);
     }
diff --git a/backend-express/src/features/tracking/summary.ts b/backend-express/src/features/tracking/summary.ts
index acb501b1..ff963d8c 100644
--- a/backend-express/src/features/tracking/summary.ts
+++ b/backend-express/src/features/tracking/summary.ts
@@ -4,7 +4,7 @@ import type { AuthenticatedStaff } from '../../types/staff';
 import { attributeConversions, DAYS } from './conversions';
 import { AD_TOUCH_SQL } from './params';
 import { canManageTracking, type TrackingResult } from './sites';
-import { TRACKING_VENDORS, VENDOR_CASE_SQL, vendorOf } from './vendors';
+import { GOOGLE_LISTING_SQL, isGoogleListing, TRACKING_VENDORS, VENDOR_CASE_SQL, vendorOf } from './vendors';
 
 /**
  * トラッキング設定のサマリーと CV（v2.2.202）。画面は header/TrackingSettings.tsx（サイト名を押すと開く）。
@@ -14,8 +14,8 @@ import { TRACKING_VENDORS, VENDOR_CASE_SQL, vendorOf } from './vendors';
  * ⚠️ 訪問数は広告・広告以外の両方（tracking_touches の行数）。⚠️ 一覧の「直近30日の着地」は広告の分だけ（sites.ts）。
  * ⚠️ CV の数え方は conversions.ts。着地ページ別・流入元別は、その CV の「最後の訪問」の着地ページ・流入元に1件を付ける。
  *   ⚠️ その訪問が30日より前なら、訪問数 0 の行として出る。
- * ⚠️ v2.2.232 業者別（vendors。utm_campaign の末尾 _pt1・_pt2。vendors.ts）。⚠️ CV も「最後の訪問」の utm_campaign で分ける。
- *   ⚠️ 業者に当たらない分は返さない（画面の割合の分母は業者の付いた分だけ）。
+ * ⚠️ v2.2.232 業者別（vendors）。⚠️ v2.2.238 から、2026-10-22 以降の Google リスティング広告の訪問だけを数える（判定は vendors.ts）。
+ *   ⚠️ CV は「最後の訪問」が Google リスティング広告のものだけ、その訪問の utm_campaign・utm_medium で分ける。
  * ─────────────────────────────────────────────
  */
 
@@ -51,26 +51,27 @@ export const trackingSiteSummary = async (staff: AuthenticatedStaff | null, site
   const siteId = Number(siteIdValue);
   if (!Number.isInteger(siteId) || siteId <= 0) return { httpStatus: 400, body: { status: 'error', message: 'サイトが指定されていません。' } };
 
-  /** ⚠️ expr は SQL に直接入る（列名か、VENDOR_CASE_SQL などの定数だけ） */
-  const group = (expr: string): Promise<GroupRow[]> => query<GroupRow>(
+  /** ⚠️ expr・where は SQL に直接入る（列名か、VENDOR_CASE_SQL・GOOGLE_LISTING_SQL などの定数だけ） */
+  const group = (expr: string, where = ''): Promise<GroupRow[]> => query<GroupRow>(
     `SELECT ${expr} AS k, COUNT(*) AS visits, SUM(${AD_TOUCH_SQL}) AS ad
        FROM tracking_touches t
-      WHERE t.site_id = ? AND t.created_at >= NOW() - INTERVAL ${DAYS} DAY
+      WHERE t.site_id = ? AND t.created_at >= NOW() - INTERVAL ${DAYS} DAY${where === '' ? '' : ` AND ${where}`}
       GROUP BY k`,
     [siteId]
   );
   const [landingRows, sourceRows, vendorRows, conversions] = await Promise.all([
-    group('t.landing_url'), group('t.source'), group(VENDOR_CASE_SQL), attributeConversions(siteId),
+    group('t.landing_url'), group('t.source'), group(VENDOR_CASE_SQL, GOOGLE_LISTING_SQL), attributeConversions(siteId),
   ]);
   const cv = conversions.get(siteId) ?? [];
   const landing = mergeRows(landingRows, cv.map((c) => c.landingUrl), false);
   const source = mergeRows(sourceRows, cv.map((c) => c.source), true);
   // v2.2.232 業者別。⚠️ 業者が0件でも行を出す（帯グラフの凡例をそろえる）
-  // ⚠️ どの業者にも当たらない分は返さない（割合の分母は _pt1・_pt2 の付いた分だけ。2026-10-30 の指示）
-  const byVendor = new Map(mergeRows(vendorRows, cv.map((c) => vendorOf(c.campaign)), false).map((r) => [r.key, r]));
+  // ⚠️ v2.2.238 割合の分母は 2026-10-22 以降の Google リスティング広告の分だけ（2026-11-02 の指示）
+  const listingCv = cv.filter((c) => isGoogleListing(c.utmSource, c.utmMedium, c.touchedAt));
+  const byVendor = new Map(mergeRows(vendorRows, listingCv.map((c) => vendorOf(c.campaign, c.utmMedium)), false).map((r) => [r.key, r]));
   const vendors = TRACKING_VENDORS.map((v) => {
     const row = byVendor.get(v.key);
-    return { key: v.key, suffix: v.suffix, name: v.name, visits: row?.visits ?? 0, cv: row?.cv ?? 0 };
+    return { key: v.key, rule: v.rule, name: v.name, visits: row?.visits ?? 0, cv: row?.cv ?? 0 };
   });
 
   return {
diff --git a/backend-express/src/features/tracking/vendorFunnel.ts b/backend-express/src/features/tracking/vendorFunnel.ts
index 5650ae23..a9f01970 100644
--- a/backend-express/src/features/tracking/vendorFunnel.ts
+++ b/backend-express/src/features/tracking/vendorFunnel.ts
@@ -3,17 +3,18 @@ import { query } from '../../db/pool';
 import type { AuthenticatedStaff } from '../../types/staff';
 import { UUID_PATTERN } from './params';
 import { canManageTracking, type TrackingResult } from './sites';
-import { findVendor, vendorLike } from './vendors';
+import { findVendor, GOOGLE_LISTING_SQL, VENDOR_CASE_SQL } from './vendors';
 
 /**
  * 業者別の歩留まり（v2.2.232）。画面は header/TrackingVendorFunnel.tsx（アクセス解析 → サイトのサマリー → 流入元 → 業者別 → 社名）。
  *
  * ─────────────────────────────────────────────
  * ⚠️ 対象 ＝ 顧客台帳（注文 master_data・建売 master_data_kaeru）の landing_params の khg_vid が、
- *   問い合わせの日（反響取得日）までに、そのサイトへその業者の広告（utm_campaign の末尾）から一度でも来ていた顧客（2026-10-30 の指示）。
+ *   問い合わせの日（反響取得日）までに、そのサイトへその業者の広告から一度でも来ていた顧客（2026-10-30 の指示）。
+ *   ⚠️ v2.2.238 業者の広告 ＝ 2026-10-22 以降の Google リスティング広告で、業者の判定は vendors.ts（2026-11-02 の指示）。
  *   ⚠️ 最後の訪問ではない（サマリーの CV はラストクリック。数えている顧客も反響の表も違うので、数は一致しない）。
  *   ⚠️ 反響取得日が読めない顧客は、日付で切らずに数える。
- * ⚠️ 期間で切らない（記録を始めた 2026-10-20 以降のすべて）。
+ * ⚠️ 期間で切らない（v2.2.238 から、業者別の対象が始まる 2026-10-22 以降のすべて。vendors.ts の VENDOR_START）。
  * ⚠️ 歩留まりの列は紹介キャンペーンサマリー（introductory/summary.ts）と同じ。⚠️ status＝重複は数えない。
  * ⚠️ 店舗は in_charge_store。⚠️ 併売店（shop_list.parent_shop がある店舗）は親店舗にまとめる。
  * ⚠️ KPI単価（広告費 ÷ 件数）は、広告費が入力できるようになってから総計の行にだけ付ける（2026-10-30 の指示）。
@@ -99,9 +100,9 @@ export const trackingVendorFunnel = async (staff: AuthenticatedStaff | null, sit
     const rows = await query<FirstTouchRow>(
       `SELECT t.visitor_id, DATE_FORMAT(MIN(t.created_at), '%Y-%m-%d %H:%i:%s') AS first_at
          FROM tracking_touches t
-        WHERE t.site_id = ? AND TRIM(t.utm_campaign) LIKE ? AND t.visitor_id IN (${part.map(() => '?').join(', ')})
+        WHERE t.site_id = ? AND ${GOOGLE_LISTING_SQL} AND (${VENDOR_CASE_SQL}) = ? AND t.visitor_id IN (${part.map(() => '?').join(', ')})
         GROUP BY t.visitor_id`,
-      [siteId, vendorLike(vendor), ...part]
+      [siteId, vendor.key, ...part]
     );
     for (const row of rows) firstTouch.set(row.visitor_id, row.first_at);
   }
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 3c0f5b78..30df9b9b 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -883,7 +883,7 @@ register({
 
 register({
   request: 'tracking_vendor_funnel',
-  summary: 'アクセス解析の業者別の歩留まり（サイト1つ・業者1つ。utm_campaign の末尾 _pt1/_pt2 から来た顧客の店舗別の反響・来場・次アポ・契約。Master / BrandAdmin のみ）',
+  summary: 'アクセス解析の業者別の歩留まり（サイト1つ・業者1つ。2026-10-22 以降の Google リスティング広告（_pt2 を含めば Bander、それ以外は PURE GROWTH）から来た顧客の店舗別の反響・来場・次アポ・契約。Master / BrandAdmin のみ）',
   phpSource: '（新規。PHP版なし）',
   auth: 'staff',
   handler: async (ctx) => {
diff --git a/frontend/src/components/header/TrackingSettings.tsx b/frontend/src/components/header/TrackingSettings.tsx
index 022f980b..0819f7ec 100644
--- a/frontend/src/components/header/TrackingSettings.tsx
+++ b/frontend/src/components/header/TrackingSettings.tsx
@@ -104,11 +104,11 @@ interface SummaryRow {
     cv: number;
 }
 
-/** v2.2.232 業者別（utm_campaign の末尾 _pt1・_pt2。② の vendors.ts）。⚠️ 業者の付いていない分は来ない */
+/** v2.2.232 業者別（② の vendors.ts）。⚠️ v2.2.238 から 2026-10-22 以降の Google リスティング広告の訪問だけ */
 interface VendorRow {
     key: string;
-    /** utm_campaign の末尾（例 _pt1） */
-    suffix: string;
+    /** 判定の説明（例「_pt2 を含む」） */
+    rule: string;
     name: string;
     visits: number;
     cv: number;
@@ -281,7 +281,7 @@ const SiteSummary: React.FC<{ siteId: number; siteName: string; brand: string; r
                     ))}
                     {mode === 'vendor' && (
                         <span className="tk_sub">
-                            utm_campaign の末尾が{data.vendors.map((v) => ` ${v.suffix} なら ${v.name}`).join('、')}。社名を押すと店舗別の歩留まりが開きます
+                            2026-10-22 以降の Google リスティング広告の訪問だけ。キャンペーン名か媒体（utm_campaign・utm_medium）が{data.vendors.map((v) => ` ${v.rule}なら ${v.name}`).join('、')}。社名を押すと店舗別の歩留まりが開きます
                         </span>
                     )}
                 </div>
diff --git a/frontend/src/components/header/TrackingVendorFunnel.tsx b/frontend/src/components/header/TrackingVendorFunnel.tsx
index 92d80b29..4f62e50d 100644
--- a/frontend/src/components/header/TrackingVendorFunnel.tsx
+++ b/frontend/src/components/header/TrackingVendorFunnel.tsx
@@ -43,7 +43,8 @@ const pct = (a: number, b: number): string => (b > 0 ? `${((a / b) * 100).toFixe
 /** 業者（② の vendors.ts。サマリーの vendors の1行） */
 interface Vendor {
     key: string;
-    suffix: string;
+    /** 判定の説明（例「_pt2 を含む」） */
+    rule: string;
     name: string;
 }
 
@@ -141,7 +142,7 @@ const TrackingVendorFunnel: React.FC<{ siteId: number; siteName: string; vendor:
                             </table>
                         </div>
                         <div className="tv_note">
-                            ※ 問い合わせの日までに、このサイトへ {vendor.name} の広告（キャンペーン名の末尾が {vendor.suffix}）から一度でも来ていた反響を数えます（記録を始めた 2026-10-20 以降）。
+                            ※ 問い合わせの日までに、このサイトへ {vendor.name} の Google リスティング広告（キャンペーン名か媒体が {vendor.rule}もの）から一度でも来ていた反響を数えます（2026-10-22 以降の訪問）。
                             サマリーの CV は最後の訪問で数えるため、件数は一致しません。<br />
                             ※ 来場＝初回面談以降の日付あり、次アポ＝事前審査・第二面談・契約の日付あり、契約＝契約済み。重複は数えません。率は総反響に対する割合です。
                         </div>
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index d68de8a0..e7233b12 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.237';
+export const newVersion = '2.2.238';
```
