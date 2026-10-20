# v2.2.202 トラッキング設定：サイトごとのサマリー・直近30日のCV・再読み込み（2026-10-20）

## 依頼（ReadMeClaude.md）
- TrackingSettings.tsx の改修
  - リロードボタンの追加
  - サイト名をクリックできるようにし、押すとサマリーが展開（表の幅と同じ）。tracking_touches をもとにサマリーを出す
    - 上部にタブ（**着地ページ**／**流入元**）。選んだ軸で表にアクセス数を出す
    - 「直近30日の着地」の右列に「直近30日のCV」を追加（inquiry_customer の landing_params で突合）。CV はサマリーにも出す
  - 開閉は他のサイトと連動しない
  - 重ければ開いてから fetch でよい → 開いたときに取りに行く形にした
  - Downloads の tracking_sites.csv・tracking_touches.csv（実データ）をローカルに入れて検証できるようにする
- 計画の提示 → 「PG HOUSE は見学クラウド未使用なので（tracker.js の自社ドメイン一覧の miyazaki/kyusyu の違いは）気にしなくてよい。進めてください」
- ⚠️ ページビューの記録は指示書に無いので今回は対象外。

## 数え方
- 期間は直近30日（訪問は tracking_touches.created_at、反響は inquiry_customer.inquiry_date）。
- **訪問数**：tracking_touches の行数（広告・広告以外の両方。1回の訪問＝1行）。**うち広告**：広告の列のどれかが入っている行（AD_TOUCH_SQL）。
- **CV**：直近30日の反響（delete_flag = 0）のうち、landing_params の khg_vid が、問い合わせの日（その日の 23:59:59）までにそのサイトを訪問していたもの。
  - 1件の反響が複数サイトを訪問していれば、それぞれのサイトで1件。
  - 着地ページ別・流入元別は、問い合わせの日までの「そのサイトへの最後の訪問」に1件（ラストクリック）。その訪問が30日より前なら訪問数 0 の行に CV だけ出る。
- 流入元は大文字・小文字を区別しない（google と Google を1行に。DB の照合順序と同じ）。
- 一覧の「直近30日の着地」は今までどおり広告の分だけ。

## 変えたもの
| ディレクトリ | ファイル | 追加した関数など |
|---|---|---|
| backend-express/src/features/tracking | **conversions.ts**（新規） | `DAYS`・`attributeConversions`（反響と訪問の突き合わせ）・型 `Conversion` |
| 〃 | **summary.ts**（新規） | `trackingSiteSummary`・`mergeRows`・型 `SummaryRow` |
| 〃 | **sites.ts** | `listTrackingSites` が `cv30d` も返す |
| backend-express/src/gateway | **registry.ts** | request `tracking_site_summary`（auth staff。Master/BrandAdmin の判定は summary.ts） |
| backend/src/core | **express_proxy.php** | `expressProxyRequests()`・`expressProxyExclusive()` に `tracking_site_summary` |
| frontend/src/components/header | **TrackingSettings.tsx** | コンポーネント `SiteSummary`、`rateOf`・`formatRate`・`readableUrl`、`reload`・`toggleSummary`、state `openSummary`（Set）・`reloadKey`。再読み込みボタン、KPI「直近30日のCV」、一覧の列「直近30日のCV」、サイト名のボタン、サマリーの行、CSS（tk_name_btn・tk_sum_*・tk_tab・tk_th_sort など） |
| frontend/src/utils | **version.ts** | `2.2.202` |
| backend/scripts/guide/articles/common | **screen-200.md**（記事「トラッキング設定」） | 「## 一覧の見方」「## サイトのサマリー」を追加 |
| backend/scripts/sql | **2026-10-20_update_log_2.2.202.sql**（新規） | update_log 1行 ＋ 記事。ローカル DB に流した（no=301） |
| docs | **deploy-v2.2.202.md**（新規） | 手順書 |

- ⚠️ DB の構造は変えていない。tracker.js も変えていない。

## conversions.ts（全文）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { UUID_PATTERN } from './params';

/**
 * 反響（CV）と訪問の突き合わせ（v2.2.202）。一覧の「直近30日のCV」（sites.ts）とサマリー（summary.ts）で使う。
 *
 * ─────────────────────────────────────────────
 * ⚠️ CV ＝ 直近30日の反響（削除を除く）のうち、landing_params の khg_vid が、問い合わせの日までにそのサイトを訪問していたもの。
 *   ⚠️ 1件の反響が複数のサイトを訪問していれば、それぞれのサイトで1件（サイトごとに見る数字のため）。
 *   ⚠️ どの訪問の手柄にするかは、問い合わせの日までの「そのサイトへの最後の訪問」（ラストクリック）。
 * ⚠️ 反響の日付（inquiry_date）は 'YYYY/MM/DD' の文字列で時刻が無い。⚠️ その日の 23:59:59 までの訪問を「問い合わせ前」とみなす。
 * ─────────────────────────────────────────────
 */

export const DAYS = 30;
/** visitor_id を IN で渡す件数（⚠️ プレースホルダーが増えすぎないよう分ける） */
const CHUNK = 500;

interface InquiryRow extends RowDataPacket {
  id: number;
  inquiry_day: string | null;
  vid: string;
}

interface TouchRow extends RowDataPacket {
  site_id: number;
  visitor_id: string;
  created_at: string;
  landing_url: string | null;
  source: string | null;
}

export interface Conversion {
  inquiryId: number;
  landingUrl: string;
  source: string;
}

/** サイトID → そのサイトの CV（反響1件につき、最後の訪問1つ） */
export const attributeConversions = async (siteId?: number): Promise<Map<number, Conversion[]>> => {
  const result = new Map<number, Conversion[]>();
  const inquiries = (await query<InquiryRow>(
    `SELECT id, DATE_FORMAT(STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d'), '%Y-%m-%d') AS inquiry_day,
            LOWER(SUBSTRING(landing_params, LOCATE('khg_vid=', landing_params) + 8, 36)) AS vid
       FROM inquiry_customer
      WHERE landing_params LIKE '%khg_vid=%'
        AND delete_flag = 0
        AND STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d') >= CURDATE() - INTERVAL ${DAYS} DAY`
  )).filter((r) => r.inquiry_day !== null && UUID_PATTERN.test(r.vid));
  if (inquiries.length === 0) return result;

  const vids = [...new Set(inquiries.map((r) => r.vid))];
  const touchesByVisitor = new Map<string, TouchRow[]>();
  for (let i = 0; i < vids.length; i += CHUNK) {
    const part = vids.slice(i, i + CHUNK);
    const rows = await query<TouchRow>(
      `SELECT t.site_id, t.visitor_id, DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, t.landing_url, t.source
         FROM tracking_touches t
        WHERE t.visitor_id IN (${part.map(() => '?').join(', ')})${siteId === undefined ? '' : ' AND t.site_id = ?'}
        ORDER BY t.created_at, t.id`,
      siteId === undefined ? part : [...part, siteId]
    );
    for (const row of rows) {
      const list = touchesByVisitor.get(row.visitor_id) ?? [];
      list.push(row);
      touchesByVisitor.set(row.visitor_id, list);
    }
  }

  for (const inquiry of inquiries) {
    const limit = `${inquiry.inquiry_day} 23:59:59`;
    // ⚠️ サイトごとに、問い合わせの日までの最後の訪問（⚠️ touches は古い順）
    const lastBySite = new Map<number, TouchRow>();
    for (const touch of touchesByVisitor.get(inquiry.vid) ?? []) {
      if (touch.created_at <= limit) lastBySite.set(Number(touch.site_id), touch);
    }
    for (const [site, touch] of lastBySite) {
      const list = result.get(site) ?? [];
      list.push({ inquiryId: Number(inquiry.id), landingUrl: touch.landing_url ?? '', source: touch.source ?? '' });
      result.set(site, list);
    }
  }
  return result;
};
```

## summary.ts（全文）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { attributeConversions, DAYS } from './conversions';
import { AD_TOUCH_SQL } from './params';
import { canManageTracking, type TrackingResult } from './sites';

/**
 * トラッキング設定のサマリーと CV（v2.2.202）。画面は header/TrackingSettings.tsx（サイト名を押すと開く）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 期間は直近30日（訪問は created_at、反響は inquiry_date）。
 * ⚠️ 訪問数は広告・広告以外の両方（tracking_touches の行数）。⚠️ 一覧の「直近30日の着地」は広告の分だけ（sites.ts）。
 * ⚠️ CV の数え方は conversions.ts。着地ページ別・流入元別は、その CV の「最後の訪問」の着地ページ・流入元に1件を付ける。
 *   ⚠️ その訪問が30日より前なら、訪問数 0 の行として出る。
 * ─────────────────────────────────────────────
 */

interface GroupRow extends RowDataPacket {
  k: string | null;
  visits: number;
  ad: number;
}

export interface SummaryRow {
  key: string;
  visits: number;
  ad: number;
  cv: number;
}

/** 訪問の集計に CV を足す。⚠️ 流入元は大文字・小文字を区別しない（DB の GROUP BY と同じ。google と Google を1行に） */
const mergeRows = (rows: GroupRow[], cvKeys: string[], fold: boolean): SummaryRow[] => {
  const norm = (k: string): string => (fold ? k.toLowerCase() : k);
  const map = new Map<string, SummaryRow>();
  for (const r of rows) map.set(norm(r.k ?? ''), { key: r.k ?? '', visits: Number(r.visits), ad: Number(r.ad), cv: 0 });
  for (const k of cvKeys) {
    const row = map.get(norm(k)) ?? { key: k, visits: 0, ad: 0, cv: 0 };
    row.cv += 1;
    map.set(norm(k), row);
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits || b.cv - a.cv);
};

/** サイト1つのサマリー（着地ページ別・流入元別）。⚠️ 画面でサイトを開いたときだけ呼ぶ */
export const trackingSiteSummary = async (staff: AuthenticatedStaff | null, siteIdValue: unknown): Promise<TrackingResult> => {
  if (!canManageTracking(staff)) return { httpStatus: 403, body: { status: 'error', message: 'この画面は管理者だけが使えます。' } };
  const siteId = Number(siteIdValue);
  if (!Number.isInteger(siteId) || siteId <= 0) return { httpStatus: 400, body: { status: 'error', message: 'サイトが指定されていません。' } };

  const group = (column: string): Promise<GroupRow[]> => query<GroupRow>(
    `SELECT t.${column} AS k, COUNT(*) AS visits, SUM(${AD_TOUCH_SQL}) AS ad
       FROM tracking_touches t
      WHERE t.site_id = ? AND t.created_at >= NOW() - INTERVAL ${DAYS} DAY
      GROUP BY t.${column}`,
    [siteId]
  );
  const [landingRows, sourceRows, conversions] = await Promise.all([group('landing_url'), group('source'), attributeConversions(siteId)]);
  const cv = conversions.get(siteId) ?? [];
  const landing = mergeRows(landingRows, cv.map((c) => c.landingUrl), false);
  const source = mergeRows(sourceRows, cv.map((c) => c.source), true);

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      siteId,
      days: DAYS,
      kpi: {
        visits: landing.reduce((s, r) => s + r.visits, 0),
        ad: landing.reduce((s, r) => s + r.ad, 0),
        cv: cv.length,
      },
      landing,
      source,
    },
  };
};
```

## 差分（sites.ts・registry.ts・express_proxy.php・TrackingSettings.tsx）
```diff
diff --git a/backend-express/src/features/tracking/sites.ts b/backend-express/src/features/tracking/sites.ts
index 3b2fdeed..4d9325c0 100644
--- a/backend-express/src/features/tracking/sites.ts
+++ b/backend-express/src/features/tracking/sites.ts
@@ -2,6 +2,7 @@ import { randomBytes } from 'crypto';
 import type { RowDataPacket } from 'mysql2/promise';
 import { execute, query } from '../../db/pool';
 import type { AuthenticatedStaff } from '../../types/staff';
+import { attributeConversions } from './conversions';
 import { AD_TOUCH_SQL } from './params';
 import { clearTrackingSiteCache, normalizeOrigin, parseOrigins } from './touch';
 
@@ -43,9 +44,13 @@ export interface TrackingResult {
 const ok = (body: Record<string, unknown>): TrackingResult => ({ httpStatus: 200, body: { status: 'ok', ...body } });
 const fail = (httpStatus: number, message: string): TrackingResult => ({ httpStatus, body: { status: 'error', message } });
 
-/** 一覧（⚠️ 運用の確認用に、直近30日の着地数と最後の着地も返す。⚠️ 画面の見出しが「広告からの着地」なので広告の分だけ数える） */
+/**
+ * 一覧（⚠️ 運用の確認用に、直近30日の着地数と最後の着地も返す。⚠️ 画面の見出しが「広告からの着地」なので広告の分だけ数える）。
+ * ⚠️ v2.2.202 直近30日の CV も返す（数え方は conversions.ts。⚠️ 広告以外の訪問からの CV も含む）。
+ */
 export const listTrackingSites = async (staff: AuthenticatedStaff | null): Promise<TrackingResult> => {
   if (!canManageTracking(staff)) return fail(403, 'この画面は管理者だけが使えます。');
+  const conversions = await attributeConversions();
   const rows = await query<SiteRow>(
     `SELECT s.id, s.site_key, s.name, s.brand, s.allowed_origins, s.is_active, s.memo, s.updated_by,
             DATE_FORMAT(s.updated_at, '%Y-%m-%d %H:%i') AS updated_at,
@@ -59,7 +64,7 @@ export const listTrackingSites = async (staff: AuthenticatedStaff | null): Promi
     sites: rows.map((r) => ({
       id: Number(r.id), siteKey: r.site_key, name: r.name, brand: r.brand ?? '', origins: parseOrigins(r.allowed_origins),
       active: Number(r.is_active) === 1, memo: r.memo, updatedBy: r.updated_by, updatedAt: r.updated_at,
-      touches30d: Number(r.touches_30d), lastTouch: r.last_touch,
+      touches30d: Number(r.touches_30d), lastTouch: r.last_touch, cv30d: conversions.get(Number(r.id))?.length ?? 0,
     })),
   });
 };
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 2866a8b2..c1d64d6b 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -13,6 +13,7 @@ import { runIntroductorySummary } from '../features/introductory/summary';
 import { runDuplicateSummary } from '../features/duplicateSummary';
 import { getGuide, listGuide, saveGuide } from '../features/guide';
 import { listTrackingSites, saveTrackingSite } from '../features/tracking/sites';
+import { trackingSiteSummary } from '../features/tracking/summary';
 import { listInquiryTouches } from '../features/tracking/touches';
 import {
   runAuthAccessTimes,
@@ -826,6 +827,18 @@ register({
   },
 });
 
+register({
+  request: 'tracking_site_summary',
+  summary: 'トラッキング設定のサイト1つのサマリー（直近30日の着地ページ別・流入元別の訪問数とCV。Master / BrandAdmin のみ）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const result = await trackingSiteSummary(ctx.staff, ctx.body.site_id);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 register({
   request: 'tracking_touches',
   summary: '反響1件に結びつく広告流入の着地履歴（landing_params の khg_vid → クリックIDの順で探す）',
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 40ccf7e8..3821dfb7 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -667,9 +667,11 @@ function expressProxyRequests(): array
         //   ⚠️ ⚠️ **入れないと ① が404を返す。** ⚠️ expressProxyExclusive() にも入れてある。
         //   ⚠️ tracking_site_save は書き込み。⚠️ Master / BrandAdmin の判定は ② が行う。
         //   ⚠️ 各サイトの tracker.js・着地の記録（/t/v1/tracker.js・/api/track/touch）は ① を通らない（② へ直接）。
+        //   ⚠️ tracking_site_summary は v2.2.202 で追加（サイト名を押すと開くサマリー）。
         // -----------------------------------------------------------------
         'tracking_site_list',
         'tracking_site_save',
+        'tracking_site_summary',
         'tracking_touches',
     ];
 }
@@ -906,9 +908,10 @@ function expressProxyExclusive(): array
         'guide_list',
         'guide_article',
         'guide_save',
-        // ⚠️ 2026-10-20 新規（v2.2.199）。広告流入トラッキング。⚠️ 理由は上と同じ
+        // ⚠️ 2026-10-20 新規（v2.2.199）。広告流入トラッキング。⚠️ 理由は上と同じ（tracking_site_summary は v2.2.202）
         'tracking_site_list',
         'tracking_site_save',
+        'tracking_site_summary',
         'tracking_touches',
     ];
 }
diff --git a/frontend/src/components/header/TrackingSettings.tsx b/frontend/src/components/header/TrackingSettings.tsx
index f0073f5c..48c1d86b 100644
--- a/frontend/src/components/header/TrackingSettings.tsx
+++ b/frontend/src/components/header/TrackingSettings.tsx
@@ -10,6 +10,9 @@ import apiClient from '../../utils/apiClient';
  *   ⚠️⚠️ GTM に trackingTag をそのまま入れると動かない。GTM は <script src> を作り直すときに data-site を捨て、
  *   tracker.js がサイトを見分けられず何もしない（2026-10-20 kh-house.jp で確認）。GTM 用は要素を自分で作って data-site を付ける。
  * ⚠️ ② は features/tracking/sites.ts（⚠️ 権限は ② でも確かめる。メニューから隠すだけでは閉じない）。
+ * ⚠️ v2.2.202 サイト名を押すと、その行の下にサマリー（SiteSummary）が開く。⚠️ 開閉はサイトごと（ほかのサイトと連動しない）。
+ *   ⚠️ サマリーは開いたときに取りに行く（tracking_site_summary。② は features/tracking/summary.ts）。⚠️「再読み込み」で一覧と開いているサマリーを取り直す。
+ *   ⚠️ CV の数え方は ② の features/tracking/conversions.ts（直近30日の反響の khg_vid が、問い合わせの日までにそのサイトに来ていたもの）。
  * ⚠️ サイトは消さない（着地の記録が残るため）。⚠️「無効」にすると着地を保存しなくなる（タグは貼ったままでもサイトに影響なし）。
  * ⚠️ 全画面モーダル（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンは Header.tsx が出す。
  * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 tk_）。
@@ -54,6 +57,7 @@ interface Site {
     updatedAt: string;
     touches30d: number;
     lastTouch: string | null;
+    cv30d: number;
 }
 
 interface Draft {
@@ -77,6 +81,132 @@ const copyText = async (text: string): Promise<boolean> => {
     }
 };
 
+interface SummaryRow {
+    key: string;
+    visits: number;
+    ad: number;
+    cv: number;
+}
+
+interface Summary {
+    days: number;
+    kpi: { visits: number; ad: number; cv: number };
+    landing: SummaryRow[];
+    source: SummaryRow[];
+}
+
+type SummaryTab = 'landing' | 'source';
+type SummarySortKey = 'key' | 'visits' | 'ad' | 'cv' | 'rate';
+
+const rateOf = (cv: number, visits: number): number | null => (visits > 0 ? (cv / visits) * 100 : null);
+const formatRate = (rate: number | null): string => (rate === null ? '—' : `${rate.toFixed(1)}%`);
+
+/** 着地ページは % エンコードのまま記録されているので、読める形にして出す（⚠️ 壊れた % なら記録のまま） */
+const readableUrl = (url: string): string => {
+    if (url === '') return '（不明）';
+    try {
+        return decodeURI(url.replace(/^https?:\/\//, ''));
+    } catch {
+        return url.replace(/^https?:\/\//, '');
+    }
+};
+
+/**
+ * サイト1つのサマリー（v2.2.202）。⚠️ サイトの行の下に、表と同じ幅で開く。
+ * ⚠️ タブ（着地ページ／流入元）と並べ替えはサイトごとに持つ（ほかのサイトと連動しない）。
+ * ⚠️ reloadKey が変わったら取り直す（親の「再読み込み」）。
+ */
+const SiteSummary: React.FC<{ siteId: number; reloadKey: number }> = ({ siteId, reloadKey }) => {
+    const [data, setData] = useState<Summary | null>(null);
+    const [error, setError] = useState('');
+    const [tab, setTab] = useState<SummaryTab>('landing');
+    const [sortKey, setSortKey] = useState<SummarySortKey>('visits');
+    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
+
+    useEffect(() => {
+        let alive = true;
+        setError('');
+        apiClient.post('', { request: 'tracking_site_summary', site_id: siteId })
+            .then((response) => { if (alive) setData(response.data as Summary); })
+            .catch((e) => {
+                console.error('tracking_site_summary failed:', e);
+                if (alive) setError('サマリーを読み込めませんでした。「再読み込み」を押してください。');
+            });
+        return () => { alive = false; };
+    }, [siteId, reloadKey]);
+
+    const rows = useMemo(() => {
+        const list = data === null ? [] : [...data[tab]];
+        const dir = sortOrder === 'asc' ? 1 : -1;
+        const value = (r: SummaryRow): number | string => (sortKey === 'key' ? r.key : sortKey === 'rate' ? rateOf(r.cv, r.visits) ?? -1 : r[sortKey]);
+        return list.sort((a, b) => {
+            const x = value(a), y = value(b);
+            return (typeof x === 'string' ? x.localeCompare(String(y), 'ja') : x - Number(y)) * dir;
+        });
+    }, [data, tab, sortKey, sortOrder]);
+
+    if (error !== '') return <div className="tk_error">{error}</div>;
+    if (data === null) return <div className="tk_sub">読み込み中…</div>;
+
+    const SortHead = ({ label, keyName, num = true }: { label: string; keyName: SummarySortKey; num?: boolean }) => {
+        const active = sortKey === keyName;
+        return (
+            <th className={`tk_th tk_th_sort${num ? ' tk_num' : ''}`} title="クリックで並べ替え"
+                onClick={() => {
+                    if (active) setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
+                    else { setSortKey(keyName); setSortOrder('desc'); }
+                }}>
+                {label}
+                <span className={`tk_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
+            </th>
+        );
+    };
+
+    return (
+        <div className="tk_sum">
+            <div className="tk_sum_kpi">
+                <div className="tk_sum_card"><div className="tk_kpi_label">訪問数（直近{data.days}日）</div><div className="tk_sum_value">{data.kpi.visits.toLocaleString()}</div></div>
+                <div className="tk_sum_card"><div className="tk_kpi_label">うち広告から</div><div className="tk_sum_value">{data.kpi.ad.toLocaleString()}</div></div>
+                <div className="tk_sum_card"><div className="tk_kpi_label">CV（直近{data.days}日の反響）</div><div className="tk_sum_value">{data.kpi.cv.toLocaleString()}</div></div>
+                <div className="tk_sum_card"><div className="tk_kpi_label">CV率</div><div className="tk_sum_value">{formatRate(rateOf(data.kpi.cv, data.kpi.visits))}</div></div>
+            </div>
+            <div className="tk_tabs" role="tablist" aria-label="集計の軸">
+                {([['landing', '着地ページ'], ['source', '流入元']] as [SummaryTab, string][]).map(([key, label]) => (
+                    <button key={key} type="button" role="tab" aria-selected={tab === key}
+                        className={`tk_tab${tab === key ? ' is_active' : ''}`} onClick={() => setTab(key)}>{label}</button>
+                ))}
+                <span className="tk_sub">CV は、問い合わせの日までの最後の訪問の{tab === 'landing' ? '着地ページ' : '流入元'}で数えます</span>
+            </div>
+            <div className="tk_sum_table_wrap">
+                <table className="tk_table">
+                    <thead>
+                        <tr>
+                            <SortHead label={tab === 'landing' ? '着地ページ' : '流入元'} keyName="key" num={false} />
+                            <SortHead label="訪問数" keyName="visits" />
+                            <SortHead label="うち広告" keyName="ad" />
+                            <SortHead label="CV" keyName="cv" />
+                            <SortHead label="CV率" keyName="rate" />
+                        </tr>
+                    </thead>
+                    <tbody>
+                        {rows.length === 0 ? (
+                            <tr><td className="tk_td tk_empty" colSpan={5}>直近{data.days}日の訪問はまだありません。</td></tr>
+                        ) : rows.map((r) => (
+                            <tr key={r.key} className="tk_row">
+                                <td className="tk_td tk_sum_key" title={r.key}>{tab === 'landing' ? readableUrl(r.key) : r.key || '（不明）'}</td>
+                                <td className="tk_td tk_num">{r.visits.toLocaleString()}</td>
+                                <td className="tk_td tk_num">{r.ad.toLocaleString()}</td>
+                                <td className="tk_td tk_num">{r.cv > 0 ? <b>{r.cv.toLocaleString()}</b> : 0}</td>
+                                <td className="tk_td tk_num">{formatRate(rateOf(r.cv, r.visits))}</td>
+                            </tr>
+                        ))}
+                    </tbody>
+                </table>
+            </div>
+        </div>
+    );
+};
+
 const TrackingSettings: React.FC = () => {
     const [sites, setSites] = useState<Site[]>([]);
     const [brands, setBrands] = useState<string[]>(Object.keys(BRAND_LABEL));
@@ -88,6 +218,9 @@ const TrackingSettings: React.FC = () => {
     const [openTag, setOpenTag] = useState<number | null>(null);
     /** コピーした（`サイトID:種類`）。⚠️ 先頭が ! ならコピーに失敗した */
     const [copied, setCopied] = useState<string | null>(null);
+    /** サマリーを開いているサイト（⚠️ サイトごとに開閉。ほかのサイトと連動しない） */
+    const [openSummary, setOpenSummary] = useState<Set<number>>(new Set());
+    const [reloadKey, setReloadKey] = useState(0);
 
     const load = useCallback(async () => {
         setLoading(true);
@@ -110,8 +243,20 @@ const TrackingSettings: React.FC = () => {
         total: sites.length,
         active: sites.filter((s) => s.active).length,
         touches: sites.reduce((sum, s) => sum + s.touches30d, 0),
+        cv: sites.reduce((sum, s) => sum + s.cv30d, 0),
     }), [sites]);
 
+    const reload = () => {
+        load();
+        setReloadKey((k) => k + 1);
+    };
+
+    const toggleSummary = (id: number) => setOpenSummary((prev) => {
+        const next = new Set(prev);
+        if (next.has(id)) next.delete(id); else next.add(id);
+        return next;
+    });
+
     const startEdit = (site: Site | null) => {
         setFormError('');
         setDraft(site === null ? { ...emptyDraft } : {
@@ -164,6 +309,9 @@ const TrackingSettings: React.FC = () => {
                     <span className="tk_title"><i className="fa-solid fa-route me-2 text-primary" aria-hidden="true" />トラッキング設定</span>
                     {/* ⚠️ 右端に置かないこと（⚠️ 右上はアクティブユーザーの枠＝ActiveUser.tsx が重なって押せない） */}
                     <button type="button" className="tk_btn is_primary" onClick={() => startEdit(null)}>サイトを登録</button>
+                    <button type="button" className="tk_btn" onClick={reload} disabled={loading}>
+                        <i className="fa-solid fa-rotate-right me-1" aria-hidden="true" />{loading ? '読み込み中…' : '再読み込み'}
+                    </button>
                     <span className="tk_note">広告から来た人の流入情報と、訪問者ごとのID（顧客ID）を、各サイトのタグで記録します</span>
                 </div>
 
@@ -171,11 +319,13 @@ const TrackingSettings: React.FC = () => {
                     <div className="tk_kpi_card"><div className="tk_kpi_label">登録サイト</div><div className="tk_kpi_value">{kpi.total}</div></div>
                     <div className="tk_kpi_card"><div className="tk_kpi_label">有効</div><div className="tk_kpi_value">{kpi.active}</div></div>
                     <div className="tk_kpi_card"><div className="tk_kpi_label">直近30日の広告からの着地</div><div className="tk_kpi_value">{kpi.touches.toLocaleString()}</div></div>
+                    <div className="tk_kpi_card"><div className="tk_kpi_label">直近30日のCV</div><div className="tk_kpi_value">{kpi.cv.toLocaleString()}</div></div>
                 </div>
 
                 <div className="tk_caution">
                     ※ タグは、サイトの<b>すべてのページ</b>で1回だけ動くように入れます。GTM を使っているサイトは「GTM 用」を、使っていないサイトは「フッター用」を使ってください（GTM にフッター用を入れても動きません）。<br />
                     ※ 「許可するオリジン」は、タグを貼るサイトの <b>https://ドメイン</b> です（例：https://kh-house.jp）。ここに無いドメインからの記録は保存しません。<br />
+                    ※ サイト名を押すと、そのサイトの着地ページ別・流入元別の訪問数（広告以外も含む）と CV が開きます。CV は、直近30日の反響のうち、問い合わせの日までにそのサイトに来ていた人の数です。<br />
                     ※ 訪問者ごとのID（顧客ID）はブラウザに保存されます。リリース前に、プライバシーポリシーへ利用目的の記載が必要です。
                 </div>
 
@@ -222,24 +372,33 @@ const TrackingSettings: React.FC = () => {
                                 <th className="tk_th">許可するオリジン</th>
                                 <th className="tk_th">状態</th>
                                 <th className="tk_th tk_num">直近30日の着地</th>
+                                <th className="tk_th tk_num">直近30日のCV</th>
                                 <th className="tk_th">最後の着地</th>
                                 <th className="tk_th">更新</th>
                                 <th className="tk_th"></th>
                             </tr>
                         </thead>
                         <tbody>
-                            {loading ? (
-                                <tr><td className="tk_td tk_empty" colSpan={8}>読み込み中…</td></tr>
+                            {/* ⚠️ 再読み込みのときは表を消さない（開いているサマリーのタブ・並べ替えを残す） */}
+                            {loading && sites.length === 0 ? (
+                                <tr><td className="tk_td tk_empty" colSpan={9}>読み込み中…</td></tr>
                             ) : sites.length === 0 ? (
-                                <tr><td className="tk_td tk_empty" colSpan={8}>まだサイトがありません。「サイトを登録」から始めてください。</td></tr>
+                                <tr><td className="tk_td tk_empty" colSpan={9}>まだサイトがありません。「サイトを登録」から始めてください。</td></tr>
                             ) : sites.map((s) => (
                                 <React.Fragment key={s.id}>
                                     <tr className={`tk_row${s.active ? '' : ' is_off'}`}>
-                                        <td className="tk_td"><div className="tk_name">{s.name}</div>{s.memo && <div className="tk_sub">{s.memo}</div>}</td>
+                                        <td className="tk_td">
+                                            <button type="button" className="tk_name_btn" aria-expanded={openSummary.has(s.id)} onClick={() => toggleSummary(s.id)}
+                                                title={openSummary.has(s.id) ? 'サマリーを閉じる' : 'サマリーを開く'}>
+                                                <i className={`fa-solid fa-chevron-${openSummary.has(s.id) ? 'down' : 'right'} tk_chev`} aria-hidden="true" />{s.name}
+                                            </button>
+                                            {s.memo && <div className="tk_sub">{s.memo}</div>}
+                                        </td>
                                         <td className="tk_td">{s.brand ? <span className="tk_tag">{BRAND_LABEL[s.brand] ?? s.brand}</span> : ''}</td>
                                         <td className="tk_td">{s.origins.map((o) => <div key={o} className="tk_origin">{o}</div>)}</td>
                                         <td className="tk_td"><span className={`tk_state${s.active ? ' is_on' : ''}`}>{s.active ? '有効' : '無効'}</span></td>
                                         <td className="tk_td tk_num">{s.touches30d.toLocaleString()}</td>
+                                        <td className="tk_td tk_num">{s.cv30d.toLocaleString()}</td>
                                         <td className="tk_td tk_date">{s.lastTouch ?? '—'}</td>
                                         <td className="tk_td tk_date">{s.updatedAt}{s.updatedBy && <div className="tk_sub">{s.updatedBy}</div>}</td>
                                         <td className="tk_td tk_actions">
@@ -248,9 +407,14 @@ const TrackingSettings: React.FC = () => {
                                             <button type="button" className="tk_link" onClick={() => startEdit(s)}>直す</button>
                                         </td>
                                     </tr>
+                                    {openSummary.has(s.id) && (
+                                        <tr className="tk_summary">
+                                            <td className="tk_td" colSpan={9}><SiteSummary siteId={s.id} reloadKey={reloadKey} /></td>
+                                        </tr>
+                                    )}
                                     {openTag === s.id && (
                                         <tr className="tk_detail">
-                                            <td className="tk_td" colSpan={8}>
+                                            <td className="tk_td" colSpan={9}>
                                                 {TAG_KINDS.map(({ kind, label, make }) => {
                                                     const key = `${s.id}:${kind}`;
                                                     const text = make(s.siteKey);
@@ -316,7 +480,26 @@ const CSS = `
 .tk_row:hover > .tk_td { background: #f8fafc; }
 .tk_row.is_off > .tk_td { color: #9ca3af; }
 .tk_num { text-align: right; font-variant-numeric: tabular-nums; }
-.tk_name { font-weight: 700; font-size: 13px; }
+.tk_name_btn { font-weight: 700; font-size: 13px; color: #1d4ed8; background: none; border: none; padding: 0; cursor: pointer; text-align: left; display: inline-flex; align-items: center; gap: 6px; }
+.tk_name_btn:hover { text-decoration: underline; }
+.tk_name_btn:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; border-radius: 4px; }
+.tk_chev { font-size: 10px; color: #64748b; width: 10px; }
+.tk_summary > .tk_td { background: #f8fafc; padding: 12px 16px 16px; }
+.tk_sum { display: flex; flex-direction: column; gap: 10px; }
+.tk_sum_kpi { display: flex; gap: 8px; flex-wrap: wrap; }
+.tk_sum_card { flex: 1 1 140px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 12px; }
+.tk_sum_value { font-size: 17px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
+.tk_tabs { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
+.tk_tab { border: 1px solid #e5e7eb; background: #fff; border-radius: 999px; padding: 4px 14px; font-size: 12px; font-weight: 700; color: #4b5563; cursor: pointer; }
+.tk_tab:hover { background: #eef2f7; }
+.tk_tab.is_active { background: #2563eb; border-color: #2563eb; color: #fff; }
+.tk_tab:focus-visible { outline: 2px solid #93c5fd; outline-offset: 1px; }
+.tk_sum_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; max-height: 360px; }
+.tk_th_sort { cursor: pointer; user-select: none; }
+.tk_th_sort:hover { background: #eef2f7; }
+.tk_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
+.tk_sort_icon.is_active { color: #2563eb; }
+.tk_sum_key { max-width: 560px; word-break: break-all; font-size: 12px; }
 .tk_sub { font-size: 11px; color: #6b7280; }
 .tk_tag { font-size: 10px; color: #4b5563; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
 .tk_origin { font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
```

## 確認
- ローカルに実データを投入：tracking_sites 7件・tracking_touches 319件（Downloads の CSV。変換は scratchpad の csv2sql.cjs。⚠️ phpMyAdmin の書き出しは NULL が引用符なし、空欄は空文字）。⚠️ 検証用に残してある。
- ② 型チェック OK。① 経由でトークン無しの `tracking_site_summary` → 401。
- CV（実データの訪問者の顧客IDでテスト用の反響を6件作って確認・確認後に削除）
  - 当日の反響（kh の訪問者）→ サイト1で CV 1。着地 `kh-house.jp/`・流入元 google に付く
  - PG の訪問者2人（1件は inquiry_date の末尾に空白）→ サイト6で CV 2
  - 見学クラウドにも訪問がある人（仮の訪問を1件追加）→ サイト7でも CV 1（訪問数 0 ではなく direct の行）
  - 問い合わせが訪問より前の日・削除済み・30日より前 → 数えない
  - 権限の無い人 → 403、サイトの指定が不正 → 400
- 画面（ビルド結果を Playwright で表示。② の返答は実データで ② の関数を呼んで書き出したもの）
  - KPI に「直近30日のCV 4」、一覧の列「直近30日のCV」
  - 一覧を開いたときの通信は list だけ。サイト名を押したときに summary を取りに行く
  - サマリー：訪問数 171・うち広告 171・CV 1・CV率 0.6%、着地ページ別の表。流入元タブ・CV で並べ替え → google が先頭
  - 2つ目のサイト（PG HOUSE）を開いても、1つ目は開いたまま・タブも流入元のまま（連動しない）
  - 着地ページの % エンコードを読める形で表示（例：…/modelhouse/2026-9 オープン！【霧島市隼人町】…）
  - 再読み込み → list と開いている2サイトの summary を取り直す。開いたまま・タブもそのまま
  - PG HOUSE だけ閉じる → もう1つは開いたまま
  - 幅 390px で横にはみ出さない
- 記事「トラッキング設定」を業務ガイドの画面で表示し、追加した節が出ることを確認
- リファクタリング：conversions.ts で使っていない列（t.id）を外し、② の確認をもう一度流して同じ結果
- フロント：TrackingSettings.tsx を直接指定した型チェック OK（⚠️ frontend/tsconfig.json は include の指定がずれていてそのままでは使えない）。ビルド `main.437e6137.js`
