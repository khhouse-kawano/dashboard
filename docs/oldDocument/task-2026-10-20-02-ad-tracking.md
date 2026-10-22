# v2.2.199 広告流入トラッキング（顧客ID）／ アンバサダー台帳の歩留まりモーダルの影（2026-10-20）

指示書: `C:\Users\shinji-kawano\react\ad_tracking_spec.md`（§1 の確認結果は task-2026-10-20-01-ad-tracking-proposal.md）

## 利用者の決定・追加指示
- 自社ドメインは7つ（neo-dhome.com は他社。対象外）
- form_cv・form_show は使わない。運用に合わせた新しい表を用意する → `tracking_sites`・`tracking_touches`
- ② が落ちて ① に回ったときの landing_params は不要 → form_get・① の form/api は変えない
- ダッシュボード用 API はゲートウェイの request（`tracking_site_list` / `tracking_site_save` / `tracking_touches`）
- 反響の source・utm_* の列は未使用なので不要 → 流入元・キャンペーンは landing_params から読み取って表示
- 流入履歴は注文の反響一覧だけ
- フォームのページに `?` は付けない運用
- ⚠️⚠️ **追加（大事）**：流入時に埋め込んだ JavaScript で**固有の顧客IDを振る**（MA に必要）。パラメータに付ける形でよい
  → `khg_vid`（tracking_touches.visitor_id）を**訪問者全員**に振り、`landing_params` に必ず付ける。`window.khgVisitorId` でも読める
- 追加：`header/AmbassadorList.tsx` の歩留まりを押して出るモーダルに、背景の影を付けて区別できるようにする

## 指示書と変えた点
- 顧客IDは広告で来た人だけでなく**全員**に振る（追加指示）。パラメータが無いページでも `landing_params` が空なら `khg_vid=…` を入れる
- フォームのページに広告付きで直接着地してそのまま送ると khg_vid が消える件（指示書 §5-1-8 で許容）：
  **開いている間（最大30分）1秒ごとに付け直す**ようにし、その場で送っても ID が付くようにした（Playwright で確認）
- tracking_touches に `source`（流入元）列を追加、tracking_sites に `memo`・`updated_by` を追加（運用の確認用）
- tracker.js は Dockerfile で `public/` をコピー（本番の ② は dist しか持たないため）。配信時に行頭の // コメントを落とす（3.1KB）

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend/scripts/sql | **2026-10-20_tracking_tables.sql**（新規）／ **_rollback.sql**（新規） | 表2つ（IF NOT EXISTS）／ DROP |
| backend/scripts/sql | 2026-10-20_update_log_2.2.199.sql | update_log ＋ 記事2本 |
| backend-express/public | **tracker.js**（新規） | 各サイトに貼るスクリプト |
| backend-express/src/features/tracking | **params.ts / touch.ts / publicRouter.ts / sites.ts / touches.ts**（新規） | 対象キー・着地の受付・公開ルート・サイト登録・反響の流入履歴 |
| backend-express/src | app.ts | 公開ルートを全体の CORS より前に |
| backend-express/src/config | env.ts | `trackingIpSalt`（TRACKING_IP_SALT） |
| backend-express/src/gateway | registry.ts | 3つの request |
| backend-express | Dockerfile | `COPY --from=builder /app/public ./public` |
| backend/src/core | express_proxy.php | 2つの一覧に3つ |
| frontend/src/components/header | **TrackingSettings.tsx**（新規） | トラッキング設定の画面 |
| frontend/src/components/list | **TrackingTouches.tsx**（新規） | 流入履歴のモーダル・`landingLabel` |
| frontend/src/components/header | Header.tsx | 反響管理に「トラッキング設定」（Master/BrandAdmin）・全画面 |
| frontend/src/components/list | ListOrder.tsx | 反響媒体の下に「流入：○○」の札 |
| frontend/src/components/guide | guideScreens.ts | 「トラッキング設定」 |
| frontend/src/components/header | AmbassadorList.tsx | 歩留まりモーダルの幕を全画面モーダルの上に・枠に影 |
| backend/scripts/guide/articles | common/**screen-200.md**（新規）・order/screen-010.md | 記事「トラッキング設定」・「反響一覧」に流入の札と流入履歴 |

## 業務ガイドの記事
- **トラッキング設定**（新規・全事業共通）：タグがすること（顧客ID・広告情報）、サイトの登録、タグの貼り方、止め方、プライバシーポリシーの要確認
- **反響一覧**（注文）：列の見方に「流入」の札、「## 流入履歴の見方」を追加
- AmbassadorList.tsx は見た目（影）だけの変更のため、記事の内容に影響なし

## 確認
- SQL を2回流してもエラーなし（ローカル）
- `GET /t/v1/tracker.js` 200・`Cache-Control: public, max-age=3600`・3.1KB（gzip 1.3KB 程度）・構文 OK
- `POST /api/track/touch`：正しいサイト・オリジン（text/plain・application/json とも）→ 保存。未登録オリジン・無効サイト・UUID でない・対象外キーだけ・無いサイト・JSON でない・Origin 無し → 保存しない（すべて 204、理由はログ）。プリフライトは登録オリジンだけ ACAO。35件連続 → 30件保存・5件は流量の上限
- Playwright（kh-house.jp を模擬・form_get の dist をそのまま使用・送信は受け取るだけ）
  - A LP `?gclid=test123&utm_source=google&utm_campaign=spring&page=2` → landing_params `gclid=test123&utm_source=google&utm_campaign=spring&khg_vid=…`（page は入らない）・source google・campaign spring・着地1件
  - B パラメータ無しのページ → 値は変わらず、送信もしない
  - C 別のフォームのページから送信 → landing_params（khg_vid 付き）・source・campaignName が送られる
  - D 自然検索で来た人 → `khg_vid=…` だけが送られる（顧客ID）
  - E フォームのページに `?gclid=direct1` で直接着地してそのまま送信 → `gclid=direct1&khg_vid=…`
  - F localStorage が使えない → ページのエラーなし
  - G tracker.js が読めない → 表示・送信は今まで通り
- 反響との結びつけ（② の中で直接）：khg_vid で1件・gclid で1件・landing_params 無し/顧客IDだけ → 空・無い反響 → 空・ID 空 → 400
- ① 経由：3つの request をトークン無しで ① に → 401
- 画面（Playwright）：トラッキング設定（一覧・KPI・タグ・コピー失敗時の案内・登録・オリジン空のエラー・無効化）、ordinary には出ない／BrandAdmin には出る、反響一覧の札（google / ID / Google）と流入履歴3パターン、記事2本の表示
- 歩留まりモーダル：幕が z-index 1055・不透明度 0.55 で全画面モーダルの上、モーダルに影。顧客名 → 顧客情報がいちばん上に開く
- 型チェック：② OK、フロントは既存の5件のみ
- 途中で見つけて直したもの：トラッキング設定の「サイトを登録」が右上のアクティブユーザーの枠に隠れて押せない → 見出しの隣へ
- 後片付け：ローカルの tracking_* のテスト行は削除済み

## 未確認・残り
- 本番のサイトでの動作（タグを貼ってから。手順書の手順7）
- `.env` の TRACKING_IP_SALT（こちらでは触らない）

## コード

### backend-express/public/tracker.js（新規・全文）
```js
// 広告流入トラッキング（v2.2.199）。各ブランドサイトのフッターに貼る:
//   <script src="https://api.khg-marketing.info/t/v1/tracker.js" data-site="SITE_KEY" defer></script>
// ⚠️ フォーム（form_get）は改修しない。フォームが読む localStorage のキー（landing_params / source / campaign）に書く。
// ⚠️ 訪問者ID（khg_vid）を全員に振り、landing_params に付ける。ほかのスクリプト（MA など）は window.khgVisitorId で読める。
// ⚠️ 素の JS（ES2017）。外部ライブラリに頼らない。⚠️ Cookie は使わない。
// ⚠️⚠️ 全体を try/catch で囲む。このスクリプトのエラーでサイト・フォームを止めてはいけない。
// ⚠️ 行頭が // の行は配信時に ② が取り除く（features/tracking/publicRouter.ts）。行の途中にコメントを書かないこと。
(function () {
  try {
    var script = document.currentScript;
    var siteKey = script && script.dataset ? script.dataset.site || '' : '';
    if (!siteKey || window.khgTrackingDisabled === true) return;
    var store = window.localStorage;
    if (!store) return;
    // ⚠️ 指示書 §4 の対象キー。⚠️ ② の features/tracking/params.ts と同じ並び・同じ長さ
    var KEYS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'yclid', 'gad_source', 'gad_campaignid',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'flyer'];
    var MAX = 500;
    var ENDPOINT = 'https://api.khg-marketing.info/api/track/touch';
    var uuid = function () {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
      var b = new Uint8Array(16);
      window.crypto.getRandomValues(b);
      b[6] = (b[6] & 15) | 64;
      b[8] = (b[8] & 63) | 128;
      var h = [];
      for (var i = 0; i < 16; i++) h.push((b[i] + 256).toString(16).slice(1));
      return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' + h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' + h.slice(10).join('');
    };
    var visitor = function () {
      var id = store.getItem('khg_vid');
      if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        id = uuid();
        store.setItem('khg_vid', id);
      }
      return id;
    };
    // ⚠️⚠️ 訪問者ID（khg_vid）は広告で来た人だけでなく全員に振る（2026-10-20 の追加指示。MA で顧客を識別するため）。
    // ⚠️ landing_params に必ず khg_vid を入れる → フォームがそのまま送るので、どの反響にも ID が付く。
    // ⚠️ 空なら khg_vid だけ、あれば末尾に付ける（§5-1-8 の補修。フォームのあるページはフォームが ? 以降で上書きするため）。
    // ⚠️ ID はサイト（ドメイン）ごと。localStorage はドメインをまたげない。
    var repair = function () {
      var id = visitor();
      var lp = store.getItem('landing_params') || '';
      if (lp === '') store.setItem('landing_params', 'khg_vid=' + encodeURIComponent(id));
      else if (lp.indexOf('khg_vid=') < 0) store.setItem('landing_params', lp + '&khg_vid=' + encodeURIComponent(id));
      window.khgVisitorId = id;
    };
    // ⚠️ フォームのページでは、フォーム（iframe）が後から landing_params を上書きして khg_vid を消す。
    // ⚠️ そのページから送っても ID が付くよう、開いている間（最大30分）1秒ごとに付け直す（読むだけなので軽い）。
    var keep = function () {
      var n = 0;
      var timer = window.setInterval(function () {
        try { repair(); } catch (e) { window.clearInterval(timer); }
        if (++n >= 1800) window.clearInterval(timer);
      }, 1000);
    };
    var url = new URL(window.location.href);
    var params = {};
    var found = false;
    KEYS.forEach(function (k) {
      var v = url.searchParams.get(k);
      if (v !== null && v !== '') { params[k] = v.slice(0, MAX); found = true; }
    });
    // ⚠️ 広告のパラメータが無いページ（自然検索・直接・回遊）では、前の値を消さない・送らない
    if (!found) { repair(); keep(); return; }
    var vid = visitor();
    window.khgVisitorId = vid;
    var query = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); });
    query.push('khg_vid=' + encodeURIComponent(vid));
    store.setItem('landing_params', query.join('&'));
    keep();
    // ⚠️ source の決め方はフォーム（Form.tsx の sourceMap）と同じ順
    var source = params.utm_source || (params.fbclid ? 'Facebook/Instagram' : '')
      || (params.gclid || params.wbraid || params.gbraid ? 'Google' : '') || (params.yclid ? 'Yahoo' : '') || (params.flyer ? 'Flyer' : '');
    if (source) store.setItem('source', source);
    if (params.utm_campaign) store.setItem('campaign', params.utm_campaign);
    var body = JSON.stringify({
      site_key: siteKey, visitor_id: vid, params: params,
      landing_url: (url.origin + url.pathname).slice(0, 2000),
      referrer: (document.referrer || '').slice(0, 2000),
    });
    // ⚠️ text/plain で送る（CORS のプリフライトを起こさない）。⚠️ 結果は使わない
    var sent = false;
    try {
      if (navigator.sendBeacon) sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
    } catch (e) { sent = false; }
    if (!sent && window.fetch) {
      window.fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, mode: 'cors', headers: { 'Content-Type': 'text/plain' } })
        .catch(function () { return null; });
    }
  } catch (e) {
    // 何もしない（プライベートブラウズで localStorage が使えないときなど）
  }
})();
```

### backend-express/src/features/tracking/params.ts（新規・全文）
```ts
/**
 * 広告流入トラッキング（v2.2.199）の対象パラメータ。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **public/tracker.js と同じ並び・同じ長さにすること。** 片方だけ直すと、
 *   ⚠️ ブラウザが landing_params に書いたキーを ② が捨てる（または逆）。
 * ⚠️ source の決め方はフォーム（form_get の Form.tsx の sourceMap）と同じ順。
 * ─────────────────────────────────────────────
 */

export const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid', 'fbclid', 'yclid'] as const;

/** キー → 保存する最大の長さ（⚠️ 表の列の長さ） */
export const TRACKING_KEYS: Record<string, number> = {
  gclid: 500,
  gbraid: 500,
  wbraid: 500,
  fbclid: 500,
  yclid: 500,
  gad_source: 100,
  gad_campaignid: 100,
  utm_source: 500,
  utm_medium: 500,
  utm_campaign: 500,
  utm_term: 500,
  utm_content: 500,
  flyer: 100,
};

export type TrackingParams = Partial<Record<string, string>>;

/** 対象のキーだけを残し、長さを切る。⚠️ 空の値は落とす */
export const pickTrackingParams = (raw: unknown): TrackingParams => {
  const result: TrackingParams = {};
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const [key, max] of Object.entries(TRACKING_KEYS)) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim().slice(0, max);
    if (trimmed !== '') result[key] = trimmed;
  }
  return result;
};

/** 流入元。⚠️ フォームと同じ順（utm_source → fbclid → gclid/wbraid/gbraid → yclid → flyer） */
export const sourceOf = (p: TrackingParams): string | null => {
  if (p.utm_source) return p.utm_source.slice(0, 200);
  if (p.fbclid) return 'Facebook/Instagram';
  if (p.gclid || p.wbraid || p.gbraid) return 'Google';
  if (p.yclid) return 'Yahoo';
  if (p.flyer) return 'Flyer';
  return null;
};

/** landing_params（クエリ文字列）を読む。⚠️ 壊れた % を含んでも落ちない */
export const parseLandingParams = (text: string | null | undefined): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!text) return result;
  try {
    new URLSearchParams(text.replace(/^\?/, '')).forEach((value, key) => {
      if (result[key] === undefined) result[key] = value;
    });
  } catch {
    // 読めない値は空として扱う
  }
  return result;
};

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

### backend-express/src/features/tracking/touch.ts（新規・全文）
```ts
import { createHash } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../../config/env';
import { execute, query } from '../../db/pool';
import { logger } from '../../utils/logger';
import { TRACKING_KEYS, UUID_PATTERN, pickTrackingParams, sourceOf } from './params';

/**
 * 着地の受け付け（v2.2.199。`POST /api/track/touch`。⚠️ 公開・認証なし）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **社外の誰でも叩ける書き込み口。リクエストの値を信用しない。**
 *   ⚠️ 保存するのは、登録済み・有効なサイトの・許可したオリジンからの・UUID の訪問者の・対象キーがある着地だけ。
 * ⚠️ 応答は成功・失敗とも 204（publicRouter.ts）。⚠️ 理由はログにだけ出す（ブラウザは結果を使わない）。
 * ⚠️ IP は保存しない。⚠️ SHA-256（ソルト付き）だけ。ソルトは `.env` の TRACKING_IP_SALT（未設定なら ip_hash は NULL）。
 * ─────────────────────────────────────────────
 */

export interface TrackingSite {
  id: number;
  siteKey: string;
  origins: string[];
  active: boolean;
}

interface SiteRow extends RowDataPacket {
  id: number;
  site_key: string;
  allowed_origins: string | string[];
  is_active: number;
}

/** オリジンの表記をそろえる（⚠️ 末尾の / と大文字を落とす） */
export const normalizeOrigin = (value: string): string => value.trim().replace(/\/+$/, '').toLowerCase();

export const parseOrigins = (raw: unknown): string[] => {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { list = []; }
  }
  return Array.isArray(list) ? list.filter((o): o is string => typeof o === 'string').map(normalizeOrigin).filter((o) => o !== '') : [];
};

/**
 * サイトの設定。⚠️ 着地のたびに引くので、60秒だけ覚えておく（⚠️ 登録・更新したら sites.ts が消す）。
 * ⚠️ 無いキーも覚える（⚠️ でたらめなキーで DB を叩かせないため）。
 */
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; site: TrackingSite | null }>();
/** 有効なサイトの許可オリジンの全体（isKnownOrigin 用） */
let originCache: { at: number; origins: Set<string> } | null = null;
export const clearTrackingSiteCache = (): void => {
  cache.clear();
  originCache = null;
};

export const findTrackingSite = async (siteKey: string): Promise<TrackingSite | null> => {
  if (!/^s_[A-Za-z0-9]{16}$/.test(siteKey)) return null;
  const hit = cache.get(siteKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.site;
  const rows = await query<SiteRow>('SELECT id, site_key, allowed_origins, is_active FROM tracking_sites WHERE site_key = ? LIMIT 1', [siteKey]);
  const row = rows[0];
  const site = row ? { id: Number(row.id), siteKey: row.site_key, origins: parseOrigins(row.allowed_origins), active: Number(row.is_active) === 1 } : null;
  if (cache.size > 1000) cache.clear();
  cache.set(siteKey, { at: Date.now(), site });
  return site;
};

/**
 * 有効なサイトのどれかに登録されたオリジンか（⚠️ CORS の応答ヘッダ用）。
 * ⚠️ プリフライト（OPTIONS）には本文が無く site_key が分からないため、サイトをまたいで見る。
 * ⚠️ 保存してよいかは recordTouch がサイトごとに改めて確かめる。
 */
export const isKnownOrigin = async (origin: string): Promise<boolean> => {
  if (origin === '') return false;
  if (originCache === null || Date.now() - originCache.at >= CACHE_MS) {
    const rows = await query<SiteRow>('SELECT id, site_key, allowed_origins, is_active FROM tracking_sites WHERE is_active = 1');
    originCache = { at: Date.now(), origins: new Set(rows.flatMap((r) => parseOrigins(r.allowed_origins))) };
  }
  return originCache.origins.has(normalizeOrigin(origin));
};

const hashIp = (ip: string): string | null =>
  env.trackingIpSalt === '' || ip === '' ? null : createHash('sha256').update(`${env.trackingIpSalt}:${ip}`).digest('hex');

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === '' ? null : trimmed;
};

export interface TouchInput {
  body: unknown;
  origin: string;
  ip: string;
  userAgent: string;
}

/** 保存したら true。⚠️ 保存しなかった理由はログに出す */
export const recordTouch = async ({ body, origin, ip, userAgent }: TouchInput): Promise<boolean> => {
  const reject = (reason: string): false => {
    logger.info(`track/touch: 保存しません（${reason}） origin="${origin}"`);
    return false;
  };
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return reject('本文が JSON ではない');
  const b = body as Record<string, unknown>;
  const siteKey = typeof b.site_key === 'string' ? b.site_key : '';
  const site = await findTrackingSite(siteKey);
  if (site === null) return reject(`サイトが無い site_key="${siteKey.slice(0, 40)}"`);
  if (!site.active) return reject(`無効のサイト site_id=${site.id}`);
  if (origin === '' || !site.origins.includes(normalizeOrigin(origin))) return reject(`許可していないオリジン site_id=${site.id}`);
  const visitorId = typeof b.visitor_id === 'string' ? b.visitor_id.toLowerCase() : '';
  if (!UUID_PATTERN.test(visitorId)) return reject('訪問者IDが UUID ではない');
  const params = pickTrackingParams(b.params);
  if (Object.keys(params).length === 0) return reject('対象のパラメータが無い');

  const keys = Object.keys(TRACKING_KEYS);
  const columns = ['site_id', 'visitor_id', 'source', ...keys, 'landing_url', 'referrer', 'user_agent', 'ip_hash'];
  const values = [
    site.id, visitorId, sourceOf(params), ...keys.map((k) => params[k] ?? null),
    text(b.landing_url, 2000), text(b.referrer, 2000), text(userAgent, 500), hashIp(ip),
  ];
  await execute(`INSERT INTO tracking_touches (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, values);
  return true;
};
```

### backend-express/src/features/tracking/publicRouter.ts（新規・全文）
```ts
import { readFileSync } from 'fs';
import path from 'path';
import express, { type NextFunction, type Request, type Response, Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { logger } from '../../utils/logger';
import { isKnownOrigin, recordTouch } from './touch';

/**
 * 広告流入トラッキング（v2.2.199）の公開の口。⚠️ 認証なし。
 *
 *   GET  /t/v1/tracker.js    … 各ブランドサイトのフッターに貼るスクリプト（public/tracker.js）
 *   POST /api/track/touch    … 着地の記録（tracker.js が sendBeacon で送る）
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **app.ts で全体の CORS より前に置くこと。**
 *   ⚠️ 全体の CORS（.env の CORS_ORIGINS）は、許可外のオリジンのプリフライトに
 *     ACAO を付けずに 204 を返して終わる。⚠️ ここは許可するオリジンを DB（tracking_sites）から決める。
 * ⚠️ 応答は成功・失敗とも 204（指示書 §6-2）。⚠️ 理由はログだけ（touch.ts）。
 * ⚠️ 本文は text/plain の JSON（プリフライトを起こさないため）。application/json も受ける。
 * ⚠️ 本番の ② はビルド結果（dist）しか持たないので、Dockerfile で public/ もコピーしている。
 * ─────────────────────────────────────────────
 */

/**
 * 配信する中身。⚠️ 起動時に1回だけ読む。⚠️ 行頭の // の行と字下げを落として小さくする（5KB 以内の目安）。
 * ⚠️ 読めなければ 404 にする（⚠️ サイトの表示には影響しない）。
 */
const loadTracker = (): string | null => {
  try {
    const source = readFileSync(path.resolve(process.cwd(), 'public/tracker.js'), 'utf8');
    return source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '' && !line.startsWith('//')).join('\n');
  } catch (error) {
    logger.error(`tracker.js を読めません: ${(error as Error).message}`);
    return null;
  }
};

/** 同じ IP から1分に30件まで（指示書 §6-2）。⚠️ 超えても 204（保存しないだけ） */
const touchLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown'),
  standardHeaders: false,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.info(`track/touch: 保存しません（流量の上限） origin="${req.get('origin') ?? ''}"`);
    res.status(204).end();
  },
});

/** 許可したオリジンにだけ ACAO を返す。⚠️ credentials は使わない */
const trackingCors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const origin = req.get('origin') ?? '';
  try {
    if (await isKnownOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  } catch (error) {
    logger.error(`track/touch: オリジンの確認に失敗: ${(error as Error).message}`);
  }
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }
  next();
};

const readBody = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const createTrackingPublicRouter = (): Router => {
  const router = Router();
  const tracker = loadTracker();

  router.get('/t/v1/tracker.js', (_req, res) => {
    if (tracker === null) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(tracker);
  });

  router.options('/api/track/touch', trackingCors);
  router.post(
    '/api/track/touch',
    trackingCors,
    touchLimiter,
    express.text({ type: () => true, limit: '16kb' }),
    async (req: Request, res: Response) => {
      try {
        await recordTouch({
          body: readBody(req.body),
          origin: req.get('origin') ?? '',
          ip: req.ip ?? '',
          userAgent: req.get('user-agent') ?? '',
        });
      } catch (error) {
        logger.error(`track/touch: 保存に失敗: ${(error as Error).message}`);
      }
      res.status(204).end();
    }
  );
  // ⚠️ 本文が大きすぎる・読めないときも 204（⚠️ 全体の errorHandler に渡すと 400/413 になる）
  router.use('/api/track/touch', (error: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.info(`track/touch: 保存しません（本文を読めない: ${error.message}）`);
    res.status(204).end();
  });

  return router;
};
```

### backend-express/src/features/tracking/sites.ts（新規・全文）
```ts
import { randomBytes } from 'crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import type { AuthenticatedStaff } from '../../types/staff';
import { clearTrackingSiteCache, normalizeOrigin, parseOrigins } from './touch';

/**
 * 広告流入トラッキング（v2.2.199）のサイト登録。画面は header/TrackingSettings.tsx（反響管理 → トラッキング設定）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 見る・登録するのは authority が Master / BrandAdmin の人だけ（⚠️ registry の auth: 'master' は BrandAdmin が入れないので、ここで判定する）。
 * ⚠️ サイトは消さない（⚠️ 着地の記録が残るため）。⚠️ is_active = 0 で止める。
 * ⚠️ site_key は登録のときに1回だけ作る（⚠️ 変えるとタグを貼り直すことになる）。
 * ─────────────────────────────────────────────
 */

const MANAGERS = ['Master', 'BrandAdmin'];
export const canManageTracking = (staff: AuthenticatedStaff | null): boolean => staff !== null && MANAGERS.includes(staff.brand);

/** ブランドキー（⚠️ form_get の gateway.ts の FALLBACK_URL と同じ） */
export const TRACKING_BRANDS = ['kh', 'djh', 'nagomi', 'fh', '2l', 'pg', 'jh', 'khf'] as const;

interface SiteRow extends RowDataPacket {
  id: number;
  site_key: string;
  name: string;
  brand: string | null;
  allowed_origins: string | string[];
  is_active: number;
  memo: string;
  updated_by: string;
  updated_at: string;
  touches_30d: number;
  last_touch: string | null;
}

export interface TrackingResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const ok = (body: Record<string, unknown>): TrackingResult => ({ httpStatus: 200, body: { status: 'ok', ...body } });
const fail = (httpStatus: number, message: string): TrackingResult => ({ httpStatus, body: { status: 'error', message } });

/** 一覧（⚠️ 運用の確認用に、直近30日の着地数と最後の着地も返す） */
export const listTrackingSites = async (staff: AuthenticatedStaff | null): Promise<TrackingResult> => {
  if (!canManageTracking(staff)) return fail(403, 'この画面は管理者だけが使えます。');
  const rows = await query<SiteRow>(
    `SELECT s.id, s.site_key, s.name, s.brand, s.allowed_origins, s.is_active, s.memo, s.updated_by,
            DATE_FORMAT(s.updated_at, '%Y-%m-%d %H:%i') AS updated_at,
            (SELECT COUNT(*) FROM tracking_touches t WHERE t.site_id = s.id AND t.created_at >= NOW() - INTERVAL 30 DAY) AS touches_30d,
            (SELECT DATE_FORMAT(MAX(t.created_at), '%Y-%m-%d %H:%i') FROM tracking_touches t WHERE t.site_id = s.id) AS last_touch
       FROM tracking_sites s
      ORDER BY s.is_active DESC, s.id`
  );
  return ok({
    brands: TRACKING_BRANDS,
    sites: rows.map((r) => ({
      id: Number(r.id), siteKey: r.site_key, name: r.name, brand: r.brand ?? '', origins: parseOrigins(r.allowed_origins),
      active: Number(r.is_active) === 1, memo: r.memo, updatedBy: r.updated_by, updatedAt: r.updated_at,
      touches30d: Number(r.touches_30d), lastTouch: r.last_touch,
    })),
  });
};

/** `https://example.jp` の形だけ受ける（⚠️ パス・クエリ・ワイルドカードは不可） */
const ORIGIN_PATTERN = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/;

export interface SaveSiteInput {
  id?: unknown;
  name?: unknown;
  brand?: unknown;
  origins?: unknown;
  active?: unknown;
  memo?: unknown;
}

const newSiteKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return `s_${Array.from(randomBytes(16), (b) => chars[b % chars.length]).join('')}`;
};

/** 登録・更新。⚠️ 無効化も is_active で行う */
export const saveTrackingSite = async (staff: AuthenticatedStaff | null, input: SaveSiteInput): Promise<TrackingResult> => {
  if (!canManageTracking(staff) || staff === null) return fail(403, 'この画面は管理者だけが使えます。');
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 255) : '';
  if (name === '') return fail(400, 'サイト名を入れてください。');
  const brand = typeof input.brand === 'string' ? input.brand.trim() : '';
  if (brand !== '' && !(TRACKING_BRANDS as readonly string[]).includes(brand)) return fail(400, 'ブランドを選び直してください。');
  const rawOrigins = Array.isArray(input.origins) ? input.origins.filter((o): o is string => typeof o === 'string') : [];
  const origins = [...new Set(rawOrigins.map(normalizeOrigin).filter((o) => o !== ''))];
  if (origins.length === 0) return fail(400, '許可するオリジン（例 https://kh-house.jp）を1つ以上入れてください。');
  const bad = origins.find((o) => !ORIGIN_PATTERN.test(o));
  if (bad !== undefined) return fail(400, `「${bad}」はオリジンの形ではありません。https://ドメイン の形で入れてください（/ 以降は不要）。`);
  const active = input.active === false || input.active === 0 ? 0 : 1;
  const memo = typeof input.memo === 'string' ? input.memo.trim().slice(0, 500) : '';
  const id = Number(input.id);

  if (Number.isInteger(id) && id > 0) {
    const result = await execute(
      'UPDATE tracking_sites SET name = ?, brand = ?, allowed_origins = ?, is_active = ?, memo = ?, updated_by = ? WHERE id = ?',
      [name, brand === '' ? null : brand, JSON.stringify(origins), active, memo, staff.name, id]
    );
    clearTrackingSiteCache();
    if (result.affectedRows === 0) return fail(404, 'サイトが見つかりません。一覧を開き直してください。');
    return ok({ id });
  }
  const siteKey = newSiteKey();
  const result = await execute(
    'INSERT INTO tracking_sites (site_key, name, brand, allowed_origins, is_active, memo, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [siteKey, name, brand === '' ? null : brand, JSON.stringify(origins), active, memo, staff.name]
  );
  clearTrackingSiteCache();
  return ok({ id: Number(result.insertId), siteKey });
};
```

### backend-express/src/features/tracking/touches.ts（新規・全文）
```ts
import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { CLICK_ID_KEYS, TRACKING_KEYS, UUID_PATTERN, parseLandingParams, sourceOf } from './params';

/**
 * 反響に結びつく着地の履歴（v2.2.199）。画面は list/TrackingTouches.tsx（反響一覧（注文）の「流入」）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ 反響の inquiry_customer.landing_params（フォームが送った値）を読んで、次の順で tracking_touches を探す。
 *   1. khg_vid があれば、visitor_id が一致する行（⚠️ 同じブラウザの着地をすべて）
 *   2. 無ければ gclid / gbraid / wbraid / fbclid / yclid のどれかが一致する行
 *     ⚠️ フォームのあるページに広告付きで着地してそのまま送ると khg_vid が付かない（tracker.js の補修は次のページから効く）
 * ⚠️ landing_params が空・見つからなければ、空の配列（⚠️ エラーにしない）。
 * ⚠️ 流入元（source）・キャンペーンは反響に保存されていないので、landing_params から読み取って返す（2026-10-20 の指示）。
 * ─────────────────────────────────────────────
 */

interface InquiryRow extends RowDataPacket {
  landing_params: string | null;
}

interface TouchRow extends RowDataPacket {
  id: number;
  created_at: string;
  site_name: string | null;
  source: string | null;
  landing_url: string | null;
  referrer: string | null;
  [key: string]: unknown;
}

const LIMIT = 100;

export const listInquiryTouches = async (inquiryIdValue: unknown): Promise<{ httpStatus: number; body: Record<string, unknown> }> => {
  const inquiryId = typeof inquiryIdValue === 'string' ? inquiryIdValue.trim().slice(0, 100) : '';
  if (inquiryId === '') return { httpStatus: 400, body: { status: 'error', message: '反響が指定されていません。' } };

  const inquiries = await query<InquiryRow>('SELECT landing_params FROM inquiry_customer WHERE inquiry_id = ? LIMIT 1', [inquiryId]);
  const landingText = inquiries[0]?.landing_params ?? '';
  const landing = parseLandingParams(landingText);
  // ⚠️ 画面に出すのは対象のキー（と khg_vid）だけ
  const shown: Record<string, string> = {};
  for (const key of Object.keys(TRACKING_KEYS)) if (landing[key]) shown[key] = landing[key];

  let matchedBy: 'khg_vid' | 'click_id' | null = null;
  let where = '';
  let params: string[] = [];
  const visitorId = (landing.khg_vid ?? '').toLowerCase();
  const clickIds = CLICK_ID_KEYS.filter((k) => landing[k]);
  if (UUID_PATTERN.test(visitorId)) {
    matchedBy = 'khg_vid';
    where = 't.visitor_id = ?';
    params = [visitorId];
  } else if (clickIds.length > 0) {
    matchedBy = 'click_id';
    where = clickIds.map((k) => `t.${k} = ?`).join(' OR ');
    params = clickIds.map((k) => landing[k]);
  }

  let touches: Record<string, unknown>[] = [];
  if (matchedBy !== null) {
    const rows = await query<TouchRow>(
      `SELECT t.id, DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, s.name AS site_name, t.source,
              ${Object.keys(TRACKING_KEYS).map((k) => `t.${k}`).join(', ')}, t.landing_url, t.referrer
         FROM tracking_touches t LEFT JOIN tracking_sites s ON s.id = t.site_id
        WHERE ${where}
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ${LIMIT}`,
      params
    );
    touches = rows.map((r) => {
      const p: Record<string, string> = {};
      for (const key of Object.keys(TRACKING_KEYS)) if (typeof r[key] === 'string' && r[key] !== '') p[key] = r[key] as string;
      return { id: Number(r.id), createdAt: r.created_at, site: r.site_name ?? '', source: r.source ?? '', params: p, landingUrl: r.landing_url ?? '', referrer: r.referrer ?? '' };
    });
  }

  return {
    httpStatus: 200,
    body: {
      status: 'ok',
      found: inquiries.length > 0,
      landingParams: landingText,
      landing: shown,
      visitorId: matchedBy === 'khg_vid' ? visitorId : '',
      source: sourceOf(shown) ?? '',
      campaign: shown.utm_campaign ?? '',
      matchedBy,
      touches,
      limit: LIMIT,
    },
  };
};
```

### frontend/src/components/header/TrackingSettings.tsx（新規・全文）
```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../utils/apiClient';

/**
 * 広告流入トラッキングの設定（v2.2.199 新規）。ヘッダー「反響管理 → トラッキング設定」（Master / BrandAdmin）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ サイトを登録すると site_key が発行され、各サイトのフッターに貼るタグ（tracker.js）を出す。
 * ⚠️ ② は features/tracking/sites.ts（⚠️ 権限は ② でも確かめる。メニューから隠すだけでは閉じない）。
 * ⚠️ サイトは消さない（着地の記録が残るため）。⚠️「無効」にすると着地を保存しなくなる（タグは貼ったままでもサイトに影響なし）。
 * ⚠️ 全画面モーダル（Header.tsx の isFullscreenMenu）。⚠️ 閉じるボタンは Header.tsx が出す。
 * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 tk_）。
 * ─────────────────────────────────────────────
 */

export const TRACKER_URL = 'https://api.khg-marketing.info/t/v1/tracker.js';
export const trackingTag = (siteKey: string): string => `<script src="${TRACKER_URL}" data-site="${siteKey}" defer></script>`;

/** ブランドキー → 表示名（⚠️ ② の TRACKING_BRANDS と同じキー） */
const BRAND_LABEL: Record<string, string> = {
    kh: '国分ハウジング', djh: 'デイジャストハウス', nagomi: 'なごみ工務店', fh: 'フルコミホーム',
    '2l': 'ニーエルホーム', pg: 'PG HOUSE', jh: 'ジャスフィーホーム', khf: 'かえるホーム',
};

interface Site {
    id: number;
    siteKey: string;
    name: string;
    brand: string;
    origins: string[];
    active: boolean;
    memo: string;
    updatedBy: string;
    updatedAt: string;
    touches30d: number;
    lastTouch: string | null;
}

interface Draft {
    id: number | null;
    name: string;
    brand: string;
    origins: string;
    active: boolean;
    memo: string;
}

const emptyDraft: Draft = { id: null, name: '', brand: '', origins: '', active: true, memo: '' };

/** クリップボードへ。⚠️ 使えない環境では選択して Ctrl+C を促す */
const copyText = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
};

const TrackingSettings: React.FC = () => {
    const [sites, setSites] = useState<Site[]>([]);
    const [brands, setBrands] = useState<string[]>(Object.keys(BRAND_LABEL));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [openTag, setOpenTag] = useState<number | null>(null);
    const [copied, setCopied] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await apiClient.post('', { request: 'tracking_site_list' });
            setSites(response.data?.sites ?? []);
            if (Array.isArray(response.data?.brands)) setBrands(response.data.brands);
        } catch (e) {
            console.error('tracking_site_list failed:', e);
            setError('サイトの一覧を読み込めませんでした。管理者の権限が必要です。');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const kpi = useMemo(() => ({
        total: sites.length,
        active: sites.filter((s) => s.active).length,
        touches: sites.reduce((sum, s) => sum + s.touches30d, 0),
    }), [sites]);

    const startEdit = (site: Site | null) => {
        setFormError('');
        setDraft(site === null ? { ...emptyDraft } : {
            id: site.id, name: site.name, brand: site.brand, origins: site.origins.join('\n'), active: site.active, memo: site.memo,
        });
    };

    const save = async () => {
        if (draft === null) return;
        setSaving(true);
        setFormError('');
        try {
            const response = await apiClient.post('', {
                request: 'tracking_site_save',
                id: draft.id ?? undefined,
                name: draft.name,
                brand: draft.brand,
                origins: draft.origins.split(/[\s,]+/).filter((o) => o !== ''),
                active: draft.active,
                memo: draft.memo,
            });
            const newId: number | undefined = response.data?.id;
            setDraft(null);
            await load();
            // ⚠️ 新しく登録したら、そのままタグを開いておく（貼る作業へ進めるように）
            if (draft.id === null && newId !== undefined) setOpenTag(newId);
        } catch (e: unknown) {
            const message = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
            setFormError(message ?? '保存できませんでした。もう一度お試しください。');
        } finally {
            setSaving(false);
        }
    };

    const copy = async (site: Site) => {
        if (await copyText(trackingTag(site.siteKey))) {
            setCopied(site.id);
            window.setTimeout(() => setCopied((c) => (c === site.id ? null : c)), 2500);
        } else {
            setOpenTag(site.id);
            setCopied(-site.id);
        }
    };

    return (
        <div className="tk_wrap">
            <style>{CSS}</style>
            <div className="tk_inner">
                <div className="tk_head">
                    <span className="tk_title"><i className="fa-solid fa-route me-2 text-primary" aria-hidden="true" />トラッキング設定</span>
                    {/* ⚠️ 右端に置かないこと（⚠️ 右上はアクティブユーザーの枠＝ActiveUser.tsx が重なって押せない） */}
                    <button type="button" className="tk_btn is_primary" onClick={() => startEdit(null)}>サイトを登録</button>
                    <span className="tk_note">広告から来た人の流入情報と、訪問者ごとのID（顧客ID）を、各サイトのタグで記録します</span>
                </div>

                <div className="tk_kpi">
                    <div className="tk_kpi_card"><div className="tk_kpi_label">登録サイト</div><div className="tk_kpi_value">{kpi.total}</div></div>
                    <div className="tk_kpi_card"><div className="tk_kpi_label">有効</div><div className="tk_kpi_value">{kpi.active}</div></div>
                    <div className="tk_kpi_card"><div className="tk_kpi_label">直近30日の広告からの着地</div><div className="tk_kpi_value">{kpi.touches.toLocaleString()}</div></div>
                </div>

                <div className="tk_caution">
                    ※ タグは、サイトの<b>すべてのページ</b>のフッターに1回だけ貼ります。WordPress の場合は WPCode の Footer 欄、またはテーマのフッターに貼ってください。<br />
                    ※ 「許可するオリジン」は、タグを貼るサイトの <b>https://ドメイン</b> です（例：https://kh-house.jp）。ここに無いドメインからの記録は保存しません。<br />
                    ※ 訪問者ごとのID（顧客ID）はブラウザに保存されます。リリース前に、プライバシーポリシーへ利用目的の記載が必要です。
                </div>

                {draft !== null && (
                    <div className="tk_form" role="group" aria-label={draft.id === null ? 'サイトを登録' : 'サイトを直す'}>
                        <div className="tk_form_title">{draft.id === null ? 'サイトを登録' : 'サイトを直す'}</div>
                        <label className="tk_field is_wide"><span className="tk_label">サイト名</span>
                            <input className="tk_input" value={draft.name} maxLength={255} placeholder="例：国分ハウジング（kh-house.jp）"
                                onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                        </label>
                        <label className="tk_field"><span className="tk_label">ブランド</span>
                            <select className="tk_input" value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })}>
                                <option value="">（なし）</option>
                                {brands.map((b) => <option key={b} value={b}>{BRAND_LABEL[b] ?? b}</option>)}
                            </select>
                        </label>
                        <label className="tk_field is_wide"><span className="tk_label">許可するオリジン（1行に1つ）</span>
                            <textarea className="tk_input" rows={2} value={draft.origins} placeholder={'https://kh-house.jp'}
                                onChange={(e) => setDraft({ ...draft, origins: e.target.value })} />
                        </label>
                        <label className="tk_field is_wide"><span className="tk_label">メモ（設置場所など）</span>
                            <input className="tk_input" value={draft.memo} maxLength={500} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} />
                        </label>
                        <label className="tk_check">
                            <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
                            有効（外すと記録を止めます）
                        </label>
                        <div className="tk_form_actions">
                            {formError !== '' && <span className="tk_error" role="alert">{formError}</span>}
                            <button type="button" className="tk_btn" onClick={() => setDraft(null)} disabled={saving}>やめる</button>
                            <button type="button" className="tk_btn is_primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存する'}</button>
                        </div>
                    </div>
                )}

                {error !== '' && <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>}

                <div className="tk_table_wrap">
                    <table className="tk_table">
                        <thead>
                            <tr>
                                <th className="tk_th">サイト名</th>
                                <th className="tk_th">ブランド</th>
                                <th className="tk_th">許可するオリジン</th>
                                <th className="tk_th">状態</th>
                                <th className="tk_th tk_num">直近30日の着地</th>
                                <th className="tk_th">最後の着地</th>
                                <th className="tk_th">更新</th>
                                <th className="tk_th"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td className="tk_td tk_empty" colSpan={8}>読み込み中…</td></tr>
                            ) : sites.length === 0 ? (
                                <tr><td className="tk_td tk_empty" colSpan={8}>まだサイトがありません。「サイトを登録」から始めてください。</td></tr>
                            ) : sites.map((s) => (
                                <React.Fragment key={s.id}>
                                    <tr className={`tk_row${s.active ? '' : ' is_off'}`}>
                                        <td className="tk_td"><div className="tk_name">{s.name}</div>{s.memo && <div className="tk_sub">{s.memo}</div>}</td>
                                        <td className="tk_td">{s.brand ? <span className="tk_tag">{BRAND_LABEL[s.brand] ?? s.brand}</span> : ''}</td>
                                        <td className="tk_td">{s.origins.map((o) => <div key={o} className="tk_origin">{o}</div>)}</td>
                                        <td className="tk_td"><span className={`tk_state${s.active ? ' is_on' : ''}`}>{s.active ? '有効' : '無効'}</span></td>
                                        <td className="tk_td tk_num">{s.touches30d.toLocaleString()}</td>
                                        <td className="tk_td tk_date">{s.lastTouch ?? '—'}</td>
                                        <td className="tk_td tk_date">{s.updatedAt}{s.updatedBy && <div className="tk_sub">{s.updatedBy}</div>}</td>
                                        <td className="tk_td tk_actions">
                                            <button type="button" className="tk_link" aria-expanded={openTag === s.id}
                                                onClick={() => setOpenTag(openTag === s.id ? null : s.id)}>タグ</button>
                                            <button type="button" className="tk_link" onClick={() => startEdit(s)}>直す</button>
                                        </td>
                                    </tr>
                                    {openTag === s.id && (
                                        <tr className="tk_detail">
                                            <td className="tk_td" colSpan={8}>
                                                <div className="tk_label">このサイトのすべてのページのフッターに貼るタグ</div>
                                                <div className="tk_code_row">
                                                    <code className="tk_code" onClick={(e) => window.getSelection()?.selectAllChildren(e.currentTarget)}>{trackingTag(s.siteKey)}</code>
                                                    <button type="button" className="tk_btn is_primary" onClick={() => copy(s)}>
                                                        {copied === s.id ? 'コピーしました' : 'コピー'}
                                                    </button>
                                                </div>
                                                {copied === -s.id && <div className="tk_error">コピーできませんでした。タグを押して選び、Ctrl+C でコピーしてください。</div>}
                                                <div className="tk_sub">サイトキー：{s.siteKey}（公開される識別子です。パスワードではありません）</div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

/** ⚠️ GoogleReview.tsx と同じ配色・余白・角丸（接頭辞 tk_）。⚠️ 全画面で表だけ中でスクロールする */
const CSS = `
.tk_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column; padding: 16px 40px 20px; box-sizing: border-box; }
.tk_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; min-height: 0; flex: 1; }
.tk_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.tk_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
.tk_note { font-size: 11px; color: #6b7280; }
.tk_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
.tk_kpi_card { flex: 1 1 160px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
.tk_kpi_label { font-size: 11px; color: #6b7280; }
.tk_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.tk_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }
.tk_form { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; flex-shrink: 0; }
.tk_form_title { flex: 1 1 100%; font-weight: 700; font-size: 13px; }
.tk_field { display: flex; flex-direction: column; gap: 2px; margin: 0; }
.tk_field.is_wide { flex: 1 1 260px; }
.tk_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
.tk_input { border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 10px; font-size: 13px; background: #fff; font-family: inherit; }
.tk_input:focus { outline: 2px solid #bfdbfe; border-color: #3b82f6; }
.tk_check { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; padding-bottom: 6px; margin: 0; }
.tk_form_actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.tk_btn { border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; color: #374151; white-space: nowrap; }
.tk_btn:hover { background: #f8fafc; }
.tk_btn.is_primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.tk_btn.is_primary:hover { background: #1d4ed8; }
.tk_btn:disabled { opacity: .6; cursor: default; }
.tk_btn:focus-visible, .tk_link:focus-visible { outline: 2px solid #93c5fd; outline-offset: 1px; }
.tk_error { font-size: 12px; color: #b91c1c; font-weight: 700; }
.tk_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; flex: 1 1 auto; min-height: 0; }
.tk_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.tk_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 9px 12px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
.tk_td { border-bottom: 1px solid #f1f5f9; padding: 9px 12px; vertical-align: middle; }
.tk_row:hover > .tk_td { background: #f8fafc; }
.tk_row.is_off > .tk_td { color: #9ca3af; }
.tk_num { text-align: right; font-variant-numeric: tabular-nums; }
.tk_name { font-weight: 700; font-size: 13px; }
.tk_sub { font-size: 11px; color: #6b7280; }
.tk_tag { font-size: 10px; color: #4b5563; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.tk_origin { font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
.tk_state { font-size: 10px; font-weight: 700; border-radius: 999px; padding: 2px 8px; background: #f3f4f6; color: #6b7280; white-space: nowrap; }
.tk_state.is_on { background: #ecfdf5; color: #047857; }
.tk_date { font-size: 11px; color: #4b5563; white-space: nowrap; font-variant-numeric: tabular-nums; }
.tk_actions { white-space: nowrap; text-align: right; }
.tk_link { font-size: 11px; font-weight: 700; color: #2563eb; cursor: pointer; background: none; border: none; padding: 2px 6px; }
.tk_link:hover { text-decoration: underline; }
.tk_detail > .tk_td { background: #fbfdff; padding: 10px 16px 14px; }
.tk_code_row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 4px 0; }
.tk_code { flex: 1 1 480px; display: block; font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #1f2937; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; word-break: break-all; cursor: text; }
.tk_empty { color: #9ca3af; text-align: center; padding: 24px; }
`;

export default TrackingSettings;
```

### frontend/src/components/list/TrackingTouches.tsx（新規・全文）
```tsx
import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import apiClient from '../../utils/apiClient';

/**
 * 反響1件の流入履歴（v2.2.199 新規）。反響一覧（注文）の「反響媒体」の欄の「流入」から開く（ListOrder.tsx）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ ② の tracking_touches（features/tracking/touches.ts）。反響の landing_params を読んで着地の記録を探す。
 *   1. 顧客ID（khg_vid）が一致する着地  2. 無ければ gclid などのクリックIDが一致する着地
 * ⚠️ 顧客ID（khg_vid）は tracker.js が訪問者全員に振る（2026-10-20 の追加指示。MA で使う）。⚠️ サイト（ドメイン）ごとの ID。
 * ⚠️ 流入元・キャンペーンは反響に保存されていないので、landing_params から読み取って出す。
 * ─────────────────────────────────────────────
 */

/** 反響一覧の札に出す流入元。⚠️ 決め方はフォーム・tracker.js と同じ順。広告の情報が無く ID だけなら「ID」 */
export const landingLabel = (landingParams: string | null | undefined): string => {
    if (!landingParams) return '';
    let p: URLSearchParams;
    try { p = new URLSearchParams(landingParams); } catch { return ''; }
    if (p.get('utm_source')) return p.get('utm_source') ?? '';
    if (p.get('fbclid')) return 'Facebook/Instagram';
    if (p.get('gclid') || p.get('wbraid') || p.get('gbraid')) return 'Google';
    if (p.get('yclid')) return 'Yahoo';
    if (p.get('flyer')) return 'Flyer';
    return p.get('khg_vid') ? 'ID' : '';
};

/** パラメータの見出し */
const PARAM_LABEL: Record<string, string> = {
    gclid: 'gclid（Google広告）', gbraid: 'gbraid（Google広告）', wbraid: 'wbraid（Google広告）', fbclid: 'fbclid（Meta広告）', yclid: 'yclid（Yahoo!広告）',
    gad_source: 'gad_source', gad_campaignid: 'gad_campaignid（Google広告のキャンペーン）',
    utm_source: 'utm_source（流入元）', utm_medium: 'utm_medium（媒体）', utm_campaign: 'utm_campaign（キャンペーン）', utm_term: 'utm_term（キーワード）', utm_content: 'utm_content（広告）',
    flyer: 'flyer（チラシ）',
};

interface Touch {
    id: number;
    createdAt: string;
    site: string;
    source: string;
    params: Record<string, string>;
    landingUrl: string;
    referrer: string;
}

interface Result {
    found: boolean;
    landing: Record<string, string>;
    visitorId: string;
    source: string;
    campaign: string;
    matchedBy: 'khg_vid' | 'click_id' | null;
    touches: Touch[];
    limit: number;
}

interface Props {
    inquiryId: string | null;
    customerName: string;
    onClose: () => void;
}

const TrackingTouches: React.FC<Props> = ({ inquiryId, customerName, onClose }) => {
    const [result, setResult] = useState<Result | null>(null);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (inquiryId === null) return;
        let cancelled = false;
        setResult(null);
        setError('');
        setCopied(false);
        (async () => {
            try {
                const response = await apiClient.post('', { request: 'tracking_touches', inquiry_id: inquiryId });
                if (!cancelled) setResult(response.data as Result);
            } catch (e) {
                console.error('tracking_touches failed:', e);
                if (!cancelled) setError('流入履歴を読み込めませんでした。');
            }
        })();
        return () => { cancelled = true; };
    }, [inquiryId]);

    const copyId = async () => {
        if (!result?.visitorId) return;
        try {
            await navigator.clipboard.writeText(result.visitorId);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    const landingKeys = result ? Object.keys(result.landing) : [];

    return (
        <Modal show={inquiryId !== null} onHide={onClose} size="lg" scrollable>
            <style>{CSS}</style>
            <Modal.Header closeButton>
                <Modal.Title style={{ fontSize: '15px' }}>流入履歴{customerName ? `（${customerName}）` : ''}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="tt_body">
                {error !== '' && <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>}
                {result === null && error === '' && <div className="tt_empty">読み込み中…</div>}
                {result !== null && (
                    <>
                        <div className="tt_cards">
                            <div className="tt_card">
                                <div className="tt_label">顧客ID</div>
                                {result.visitorId ? (
                                    <div className="tt_id_row">
                                        <code className="tt_id">{result.visitorId}</code>
                                        <button type="button" className="tt_btn" onClick={copyId}>{copied ? 'コピーしました' : 'コピー'}</button>
                                    </div>
                                ) : <div className="tt_none">なし（タグを貼る前の反響、またはタグの無いページからの送信）</div>}
                            </div>
                            <div className="tt_card">
                                <div className="tt_label">流入元</div>
                                <div className="tt_value">{result.source || '—'}</div>
                            </div>
                            <div className="tt_card">
                                <div className="tt_label">キャンペーン（utm_campaign）</div>
                                <div className="tt_value">{result.campaign || '—'}</div>
                            </div>
                        </div>

                        {landingKeys.length > 0 && (
                            <>
                                <div className="tt_section">反響と一緒に届いた広告の情報</div>
                                <dl className="tt_params">
                                    {landingKeys.map((k) => (
                                        <React.Fragment key={k}>
                                            <dt>{PARAM_LABEL[k] ?? k}</dt><dd>{result.landing[k]}</dd>
                                        </React.Fragment>
                                    ))}
                                </dl>
                            </>
                        )}

                        <div className="tt_section">
                            広告からの着地（新しい順）
                            {result.matchedBy === 'khg_vid' && <span className="tt_how">顧客IDで結びつけました（同じブラウザの着地）</span>}
                            {result.matchedBy === 'click_id' && <span className="tt_how is_warn">顧客IDが無いため、クリックID（gclid など）で結びつけました</span>}
                        </div>
                        {result.touches.length === 0 ? (
                            <div className="tt_empty">
                                {result.matchedBy === null ? '結びつける情報がありません。' : '広告からの着地の記録はありません（自然検索・直接の訪問など）。'}
                            </div>
                        ) : (
                            <div className="tt_table_wrap">
                                <table className="tt_table">
                                    <thead>
                                        <tr><th>日時</th><th>サイト</th><th>流入元</th><th>キャンペーン</th><th>着地したページ</th></tr>
                                    </thead>
                                    <tbody>
                                        {result.touches.map((t) => (
                                            <tr key={t.id}>
                                                <td className="tt_date">{t.createdAt}</td>
                                                <td>{t.site}</td>
                                                <td>{t.source}{t.params.utm_medium ? <div className="tt_sub">{t.params.utm_medium}</div> : null}</td>
                                                <td>{t.params.utm_campaign ?? t.params.gad_campaignid ?? ''}</td>
                                                <td className="tt_url">{t.landingUrl}{t.referrer && <div className="tt_sub">参照元：{t.referrer}</div>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {result.touches.length >= result.limit && <div className="tt_sub">新しい {result.limit} 件だけを出しています。</div>}
                            </div>
                        )}
                    </>
                )}
            </Modal.Body>
        </Modal>
    );
};

/** ⚠️ GoogleReview.tsx と同じ配色（接頭辞 tt_） */
const CSS = `
.tt_body { font-size: 13px; color: #1f2937; }
.tt_cards { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.tt_card { flex: 1 1 180px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px 12px; background: #fff; min-width: 0; }
.tt_card:first-child { flex-basis: 100%; }
.tt_label { font-size: 11px; font-weight: 700; color: #6b7280; }
.tt_value { font-size: 15px; font-weight: 700; word-break: break-all; }
.tt_id_row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tt_id { font-family: ui-monospace, Consolas, monospace; font-size: 13px; color: #1f2937; background: #f3f4f6; border-radius: 6px; padding: 2px 8px; }
.tt_none { font-size: 12px; color: #9ca3af; }
.tt_btn { border: 1px solid #e5e7eb; background: #fff; border-radius: 8px; padding: 3px 10px; font-size: 11px; font-weight: 700; cursor: pointer; color: #374151; }
.tt_btn:hover { background: #f8fafc; }
.tt_section { font-size: 12px; font-weight: 700; margin: 14px 0 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tt_how { font-size: 10px; font-weight: 700; color: #047857; background: #ecfdf5; border-radius: 999px; padding: 1px 8px; }
.tt_how.is_warn { color: #92400e; background: #fffbeb; }
.tt_params { display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; margin: 0; font-size: 12px; }
.tt_params dt { color: #6b7280; font-weight: 400; }
.tt_params dd { margin: 0; word-break: break-all; font-family: ui-monospace, Consolas, monospace; font-size: 11px; }
.tt_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; }
.tt_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.tt_table th { position: sticky; top: 0; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 7px 10px; font-size: 11px; color: #4b5563; white-space: nowrap; }
.tt_table td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: top; }
.tt_date { white-space: nowrap; font-variant-numeric: tabular-nums; }
.tt_url { word-break: break-all; }
.tt_sub { font-size: 11px; color: #6b7280; }
.tt_empty { color: #9ca3af; font-size: 12px; padding: 8px 0; }
`;

export default TrackingTouches;
```

### backend/scripts/sql/2026-10-20_tracking_tables.sql（新規・全文）
```sql
-- =====================================================================
-- 広告流入トラッキング（v2.2.199）の表を2つ作る
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。ローカルは docker exec で流す。
-- ⚠️ 何度流しても安全（CREATE TABLE IF NOT EXISTS）。⚠️ 既存の表（inquiry_customer など）は変えない。
-- ⚠️ 戻すとき: 2026-10-20_tracking_tables_rollback.sql
--
-- tracking_sites  … タグを貼るサイト（ダッシュボードの「反響管理 → トラッキング設定」で登録する）
-- tracking_touches … 広告などのパラメータ付きで着地した1回 = 1行（tracker.js → ② POST /api/track/touch）
--
-- ⚠️ 反響とは inquiry_customer.landing_params の khg_vid（無ければ gclid などのクリックID）で結びつける。
--   ⚠️ 外部キーは張らない（反響の表を変えないため）。
-- =====================================================================

CREATE TABLE IF NOT EXISTS tracking_sites (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    site_key        VARCHAR(32)  NOT NULL COMMENT 'タグに埋め込むキー（s_＋16文字）。公開される識別子で、認証には使わない',
    name            VARCHAR(255) NOT NULL COMMENT 'サイト名',
    brand           VARCHAR(32)  DEFAULT NULL COMMENT 'ブランドキー（kh / djh / nagomi / fh / 2l / pg / jh / khf）',
    allowed_origins JSON         NOT NULL COMMENT '着地を受け付けるオリジン。例 ["https://kh-house.jp"]',
    is_active       TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '0 = 無効（着地を保存しない）',
    memo            VARCHAR(500) NOT NULL DEFAULT '' COMMENT '社内メモ（設置場所など）',
    updated_by      VARCHAR(100) NOT NULL DEFAULT '' COMMENT '最後に登録・更新した人',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tracking_sites_key (site_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='広告流入トラッキング：タグを貼るサイト';

CREATE TABLE IF NOT EXISTS tracking_touches (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    site_id        BIGINT        NOT NULL COMMENT 'tracking_sites.id',
    visitor_id     CHAR(36)      NOT NULL COMMENT 'ブラウザの localStorage の khg_vid（UUID）',
    source         VARCHAR(200)  DEFAULT NULL COMMENT '流入元（フォームと同じ決め方：utm_source → Facebook/Instagram → Google → Yahoo → Flyer）',
    gclid          VARCHAR(500)  DEFAULT NULL,
    gbraid         VARCHAR(500)  DEFAULT NULL,
    wbraid         VARCHAR(500)  DEFAULT NULL,
    fbclid         VARCHAR(500)  DEFAULT NULL,
    yclid          VARCHAR(500)  DEFAULT NULL,
    gad_source     VARCHAR(100)  DEFAULT NULL,
    gad_campaignid VARCHAR(100)  DEFAULT NULL,
    utm_source     VARCHAR(500)  DEFAULT NULL,
    utm_medium     VARCHAR(500)  DEFAULT NULL,
    utm_campaign   VARCHAR(500)  DEFAULT NULL,
    utm_term       VARCHAR(500)  DEFAULT NULL,
    utm_content    VARCHAR(500)  DEFAULT NULL,
    flyer          VARCHAR(100)  DEFAULT NULL,
    landing_url    VARCHAR(2000) DEFAULT NULL COMMENT '着地したページ（? 以降を除く）',
    referrer       VARCHAR(2000) DEFAULT NULL,
    user_agent     VARCHAR(500)  DEFAULT NULL,
    ip_hash        CHAR(64)      DEFAULT NULL COMMENT 'IP は保存しない。SHA-256（ソルト付き）',
    created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tracking_touches_visitor (visitor_id),
    KEY idx_tracking_touches_gclid (gclid(100)),
    KEY idx_tracking_touches_fbclid (fbclid(100)),
    KEY idx_tracking_touches_yclid (yclid(100)),
    KEY idx_tracking_touches_site_time (site_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='広告流入トラッキング：パラメータ付きの着地1回=1行';

-- 確認（⚠️ information_schema は ① で使えないので SHOW を使う）
SHOW TABLES LIKE 'tracking_%';
```

### backend/scripts/sql/2026-10-20_tracking_tables_rollback.sql（新規・全文）
```sql
-- =====================================================================
-- 広告流入トラッキング（v2.2.199）を戻す：2026-10-20_tracking_tables.sql で作った表を消す
--
-- ⚠️⚠️ **着地の記録（tracking_touches）とサイトの登録（tracking_sites）が消える。** 戻せない。
-- ⚠️ 既存の表（inquiry_customer の landing_params など）には触らない。
-- ⚠️ 先に各サイトのフッターからタグを外すこと（外さないと ② が「サイトが無い」と毎回ログに出す。表示には影響しない）。
-- =====================================================================

DROP TABLE IF EXISTS tracking_touches;
DROP TABLE IF EXISTS tracking_sites;
```

### backend/scripts/guide/articles/common/screen-200.md（新規・全文）
```markdown
---
title: トラッキング設定
section: 画面の使い方
sort: 200
summary: 各ブランドサイトに貼るタグの発行。広告から来た人の流入情報と、訪問者ごとの顧客IDを記録する。
---
ヘッダーの「反響管理 → トラッキング設定」（管理者だけ）。各ブランドサイトのフッターに貼る**タグ**を発行する画面です。

[[画面:トラッキング設定]]

## タグがすること
- サイトを見た人**全員**に、**顧客ID**を振ります（同じブラウザなら、日をまたいでも同じID）
- 広告（Google・Meta・Yahoo!）や、utm の付いたURLから来たときは、その情報を覚えます。**フォームの無いLPに着地しても**消えません
- フォームから問い合わせると、顧客IDと広告の情報が、反響と一緒に届きます
- 反響一覧（注文営業）の「流入」から、その人がいつ・どの広告から来たかを見られます（[[反響一覧]]）

> 注意：顧客IDは**サイト（ドメイン）ごと**です。kh-house.jp と day-just-house.com では別のIDになります。

## サイトを登録する
1. 「サイトを登録」を押す
2. サイト名・ブランドを入れる
3. 「許可するオリジン」に、タグを貼るサイトの **https://ドメイン** を入れる（例：https://kh-house.jp。/ 以降は不要。www の有り無しが両方あるなら2行）
4. 「保存する」→ そのサイトのタグが開きます

## タグを貼る
- 「タグ」を押し、「コピー」でタグをコピーします
- サイトの**すべてのページ**のフッターに**1回だけ**貼ります
- WordPress の場合は、WPCode の Footer 欄、またはテーマのフッターに貼ります
- 貼ったあと、広告のURL（例：?utm_source=test）でサイトを開くと、「直近30日の着地」「最後の着地」が増えます

> 注意：ここに無いドメインからの記録は保存しません。ドメインを変えたら「直す」で許可するオリジンも直してください。

## 止める
- 「直す」で「有効」を外すと、記録を止めます。タグを貼ったままでもサイトの表示やフォームには影響しません
- サイトは消せません（記録が残るため）

> 要確認：顧客IDはお客様のブラウザに保存します。公開する前に、プライバシーポリシーへ利用目的を書く必要があります。担当者に確認してください。

## 関係する記事
- [[反響一覧]]
```

### 既存ファイルの差分
```diff
diff --git a/backend-express/Dockerfile b/backend-express/Dockerfile
index 34d62dc6..e8c47f91 100644
--- a/backend-express/Dockerfile
+++ b/backend-express/Dockerfile
@@ -48,6 +48,8 @@ COPY package.json package-lock.json* ./
 RUN npm install --omit=dev && npm cache clean --force
 
 COPY --from=builder /app/dist ./dist
+# ⚠️ v2.2.199: 各ブランドサイトに配る tracker.js（features/tracking/publicRouter.ts が起動時に読む）。⚠️ dist には入らないので別にコピーする
+COPY --from=builder /app/public ./public
 
 USER node
 
diff --git a/backend-express/src/app.ts b/backend-express/src/app.ts
index 7d75dcfc..fabcfaf7 100644
--- a/backend-express/src/app.ts
+++ b/backend-express/src/app.ts
@@ -8,6 +8,7 @@ import { buildFeatureRouter } from './core/registry';
 import type { RouteSummary } from './core/registry';
 import { createSystemRouter } from './core/systemRouter';
 import { features } from './features';
+import { createTrackingPublicRouter } from './features/tracking/publicRouter';
 import { createGatewayRouter } from './gateway';
 import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
 import { requestContext } from './middlewares/requestContext';
@@ -56,6 +57,15 @@ export const createApp = (): BuiltApp => {
     })
   );
 
+  // ---------------------------------------------------------------
+  // 1-2. 広告流入トラッキングの公開の口（v2.2.199。GET /t/v1/tracker.js・POST /api/track/touch）
+  //
+  //   ⚠️⚠️ **下の CORS より前に置くこと。** 許可するオリジンを DB（tracking_sites）で決めるため。
+  //     ⚠️ 後ろに置くと、各ブランドサイトからのプリフライトを全体の CORS が先に返してしまう。
+  //   ⚠️ この2つのパス以外は素通しする（features/tracking/publicRouter.ts）。
+  // ---------------------------------------------------------------
+  app.use(createTrackingPublicRouter());
+
   // ---------------------------------------------------------------
   // 2. CORS
   //    React開発サーバー（別オリジン）から叩けるようにする。
diff --git a/backend-express/src/config/env.ts b/backend-express/src/config/env.ts
index 9a1a23b1..ae6bdc25 100644
--- a/backend-express/src/config/env.ts
+++ b/backend-express/src/config/env.ts
@@ -50,6 +50,13 @@ export const env = {
    */
   trustProxy: numberEnv('TRUST_PROXY', 0),
 
+  /**
+   * 広告流入トラッキング（v2.2.199）で IP をハッシュにするときのソルト。
+   * ⚠️ IP そのものは保存しない（features/tracking/touch.ts）。⚠️ 未設定なら ip_hash を NULL にする（着地は保存する）。
+   * ⚠️ 一度決めたら変えない（変えると同じ IP でも別のハッシュになる）。
+   */
+  trackingIpSalt: (process.env.TRACKING_IP_SALT ?? '').trim(),
+
   /** リクエストボディの上限。PDF等のアップロードを見込んで少し大きめ */
   bodyLimit: process.env.BODY_LIMIT ?? '10mb',
 
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index dda25353..2866a8b2 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -12,6 +12,8 @@ import { runStaffContract, toDepartment } from '../features/staffContract';
 import { runIntroductorySummary } from '../features/introductory/summary';
 import { runDuplicateSummary } from '../features/duplicateSummary';
 import { getGuide, listGuide, saveGuide } from '../features/guide';
+import { listTrackingSites, saveTrackingSite } from '../features/tracking/sites';
+import { listInquiryTouches } from '../features/tracking/touches';
 import {
   runAuthAccessTimes,
   runAuthInsert,
@@ -792,6 +794,50 @@ register({
   },
 });
 
+/**
+ * 広告流入トラッキング（v2.2.199）。⚠️ 中身は features/tracking/。
+ *
+ * ⚠️⚠️ **① に PHP ハンドラは無い。** ⚠️ express_proxy.php の転送リストと転送専用リストの両方に入れてある。
+ * ⚠️ サイトの一覧・登録は Master / BrandAdmin（⚠️ `auth: 'master'` だと BrandAdmin が入れないので sites.ts で判定）。
+ * ⚠️ 公開の口（tracker.js・POST /api/track/touch）はゲートウェイではない（features/tracking/publicRouter.ts）。
+ */
+register({
+  request: 'tracking_site_list',
+  summary: '広告流入トラッキングのサイト一覧（直近30日の着地数つき。Master / BrandAdmin のみ）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const result = await listTrackingSites(ctx.staff);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
+register({
+  request: 'tracking_site_save',
+  summary: '【書き込み】広告流入トラッキングのサイトを登録・更新・無効化（Master / BrandAdmin のみ）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const { id, name, brand, origins, active, memo } = ctx.body;
+    const result = await saveTrackingSite(ctx.staff, { id, name, brand, origins, active, memo });
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
+register({
+  request: 'tracking_touches',
+  summary: '反響1件に結びつく広告流入の着地履歴（landing_params の khg_vid → クリックIDの順で探す）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const result = await listInquiryTouches(ctx.body.inquiry_id);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+
 register({
   request: 'introductory_summary',
   summary: '紹介（注文・建売・中古）の紹介元・事業部・ブランド・エリア別の歩留まり',
diff --git a/backend/scripts/guide/articles/order/screen-010.md b/backend/scripts/guide/articles/order/screen-010.md
index bfb6db7d..2e078e5d 100644
--- a/backend/scripts/guide/articles/order/screen-010.md
+++ b/backend/scripts/guide/articles/order/screen-010.md
@@ -23,6 +23,15 @@ summary: 届いた反響の確認・割り振り・取込をする画面。
 ## 列の見方
 - **重複**：氏名・携帯・メールのうち2つ以上が同じ、別の反響があると表示されます
 - **顧客タグ**：重複／ギフト券進呈済み／業者／ブラックリスト
+- **流入**（反響媒体の下の青い札）：ホームページの反響で、広告などから来た情報があるときに出ます。札には流入元（Google など）が出ます。押すと、顧客IDと、その人がいつ・どの広告からサイトに来たかが見られます
+  - 灰色の「流入：ID」は、広告の情報が無く顧客IDだけがあるもの（自然検索・直接の訪問など）です
+
+## 流入履歴の見方
+- **顧客ID**：サイトがお客様ごとに振るIDです。「コピー」で写せます
+- **流入元・キャンペーン**：反響と一緒に届いた広告の情報です
+- **広告からの着地**：同じお客様が広告からサイトに来た記録（新しい順）。問い合わせの前に何回来ていたかが分かります
+
+> 注意：タグを貼る前の反響には札が出ません。タグについては [[トラッキング設定]] を見てください。
 
 > 注意：ひらがなのフリガナは、取込のときにカタカナへ自動で直ります。
 
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 64861313..40ccf7e8 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -659,6 +659,18 @@ function expressProxyRequests(): array
         'guide_list',
         'guide_article',
         'guide_save',
+
+        // -----------------------------------------------------------------
+        // 2026-10-20 新規（v2.2.199）。広告流入トラッキング（header/TrackingSettings.tsx・list/TrackingTouches.tsx）。
+        //
+        // ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある**（features/tracking/）。
+        //   ⚠️ ⚠️ **入れないと ① が404を返す。** ⚠️ expressProxyExclusive() にも入れてある。
+        //   ⚠️ tracking_site_save は書き込み。⚠️ Master / BrandAdmin の判定は ② が行う。
+        //   ⚠️ 各サイトの tracker.js・着地の記録（/t/v1/tracker.js・/api/track/touch）は ① を通らない（② へ直接）。
+        // -----------------------------------------------------------------
+        'tracking_site_list',
+        'tracking_site_save',
+        'tracking_touches',
     ];
 }
 
@@ -894,6 +906,10 @@ function expressProxyExclusive(): array
         'guide_list',
         'guide_article',
         'guide_save',
+        // ⚠️ 2026-10-20 新規（v2.2.199）。広告流入トラッキング。⚠️ 理由は上と同じ
+        'tracking_site_list',
+        'tracking_site_save',
+        'tracking_touches',
     ];
 }
 
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index 15b1ff32..d93ac656 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -68,6 +68,8 @@ export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     'ブラックリスト設定': { menu: '反響管理/ブラックリスト設定' },
     '事後アンケート': { menu: '反響管理/事後アンケート' },
     '広告費シミュレーター': { menu: '反響管理/広告費シミュレーター', authority: ['Master'] },
+    // ⚠️ v2.2.199（広告流入トラッキング）。Header.tsx の menuMapping と同じく Master / BrandAdmin
+    'トラッキング設定': { menu: '反響管理/トラッキング設定', authority: ADMIN },
     '紹介キャンペーンサマリー': { menu: '紹介キャンペーン/紹介キャンペーンサマリー' },
     '紹介キャンペーンの反響一覧': { menu: '紹介キャンペーン/反響一覧' },
     '月次日報': { menu: '活動サマリー/月次日報' },
diff --git a/frontend/src/components/header/AmbassadorList.tsx b/frontend/src/components/header/AmbassadorList.tsx
index 02277f86..563bdf06 100644
--- a/frontend/src/components/header/AmbassadorList.tsx
+++ b/frontend/src/components/header/AmbassadorList.tsx
@@ -676,7 +676,22 @@ const AmbassadorList = () => {
               ⚠️ ⚠️ **ランクや見込み月の編集は置かない。** 台帳は成果を見る画面であり、
                 ⚠️ ここで案件を触らせると、どこで直したのか分からなくなる。
             */}
-            <Modal show={kpiTarget !== null} onHide={() => setKpiTarget(null)} size="xl">
+            {/*
+              ⚠️⚠️ 2026-10-20 の指示：**後ろの画面と見分けられるよう、幕で暗くし、枠に影を付ける。**
+                ⚠️ この画面は Header.tsx の全画面モーダル（白）の上に重ねて開く。Bootstrap の幕（.modal-backdrop）は
+                  ⚠️ z-index 1050 で、全画面モーダル（1055）の**下**に描かれるため、後ろが暗くならず
+                  ⚠️ **モーダルが開いているか分からない**ほど同じ色に見えていた。
+                ⚠️ 幕だけ 1055 に上げる（⚠️ 後から出る幕は DOM の後ろにあるので全画面モーダルの上、このモーダルの下になる）。
+                ⚠️ ⚠️ **このモーダル自体の z-index は上げないこと。** 上げると、顧客名から開く顧客情報（InformationEdit。1055）が下に隠れる。
+            */}
+            <style>{`
+                .am_kpi_backdrop.modal-backdrop { z-index: 1055; }
+                .am_kpi_backdrop.modal-backdrop.show { opacity: .55; }
+                .am_kpi_content.modal-content { border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;
+                    box-shadow: 0 24px 64px rgba(15, 23, 42, .45), 0 2px 8px rgba(15, 23, 42, .2); }
+            `}</style>
+            <Modal show={kpiTarget !== null} onHide={() => setKpiTarget(null)} size="xl"
+                backdropClassName="am_kpi_backdrop" contentClassName="am_kpi_content">
                 <Modal.Header closeButton className="bg-light py-2">
                     <Modal.Title className="fw-bold" style={{ fontSize: '14px' }}>
                         {kpiTarget?.ambassador.name ?? ''}
diff --git a/frontend/src/components/header/Header.tsx b/frontend/src/components/header/Header.tsx
index 62f1ba3c..4c29798f 100644
--- a/frontend/src/components/header/Header.tsx
+++ b/frontend/src/components/header/Header.tsx
@@ -22,6 +22,7 @@ import ClaudeIcon from './ClaudeIcon';
 import CompetitorAnalysisReports from './CompetitorAnalysisReports';
 import IntroductorySummary from './IntroductorySummary';
 import DuplicateInquirySummary from './DuplicateInquirySummary';
+import TrackingSettings from './TrackingSettings';
 import SatBaseDatabase from './SatBaseDatabase';
 import AmbassadorList from './AmbassadorList';
 import { InquiryAmbassador } from './InquiryAmbassador';
@@ -157,9 +158,13 @@ const Header = ({ }) => {
             ? ['店舗編集', 'スタッフ編集・追加', '権限編集', 'ローン情報更新']
             : ['店舗編集', 'スタッフ編集・追加', '権限編集'],
         // ⚠️ v2.2.193: 「重複反響サマリー」を追加（⚠️ 全員。DuplicateInquirySummary.tsx）
-        '反響管理': authority === 'Master'
-            ? ['販促媒体設定', 'ブラックリスト設定', '広告費シミュレーター', '事後アンケート', '重複反響サマリー']
-            : ['販促媒体設定', 'ブラックリスト設定', '事後アンケート', '重複反響サマリー'],
+        // ⚠️ v2.2.199: 「トラッキング設定」を追加（⚠️ Master / BrandAdmin。TrackingSettings.tsx。⚠️ ② の tracking_site_* でも確かめる）
+        '反響管理': [
+            '販促媒体設定', 'ブラックリスト設定',
+            ...(authority === 'Master' ? ['広告費シミュレーター'] : []),
+            '事後アンケート', '重複反響サマリー',
+            ...((authority === 'Master' || authority === 'BrandAdmin') ? ['トラッキング設定'] : []),
+        ],
         // ⚠️⚠️ **2026-09-22 に土地情報同期・土地情報一覧をメニューから外した**（指示）。
         //   ⚠️ ⚠️ **コンポーネント（SyncEstate / Estate）は消していない。**
         //     ⚠️ Estate は顧客詳細からも開くため、消すとそちらが壊れる。
@@ -216,6 +221,7 @@ const Header = ({ }) => {
         'システム管理/店舗編集': <EditShop />,
         '反響管理/ブラックリスト設定': <EditBlackList />,
         '反響管理/重複反響サマリー': <DuplicateInquirySummary />,
+        '反響管理/トラッキング設定': <TrackingSettings />,
         '他社動向/他社広告ライブラリ': <MetaAdsDashboard />,
         '他社動向/他社資料': <CompetitorMaterials />,
         // ⚠️ 保存済みレポートを見るだけの画面。⚠️ **Claude は呼ばない（課金なし）**
@@ -385,6 +391,8 @@ const Header = ({ }) => {
         // ⚠️ 重複反響サマリー（v2.2.193）はカード9枚をグリッドで並べる（2026-10-16 の指示で全画面）。
         //   ⚠️ **この1行で「左上の閉じるボタン」も一緒に出る。** コンポーネント側に作らないこと。
         '反響管理/重複反響サマリー',
+        // ⚠️ トラッキング設定（v2.2.199）は表が8列＋タグの行。⚠️ この1行で「左上の閉じるボタン」も出る。コンポーネント側に作らないこと。
+        '反響管理/トラッキング設定',
     ].includes(editMenu);
 
     // 見出しには項目名だけを出す（キーの `メニュー/` は表示に使わない）
diff --git a/frontend/src/components/list/ListOrder.tsx b/frontend/src/components/list/ListOrder.tsx
index e84a0076..f0cbb3b7 100644
--- a/frontend/src/components/list/ListOrder.tsx
+++ b/frontend/src/components/list/ListOrder.tsx
@@ -14,6 +14,7 @@ import { TAG_DEFINITIONS, TAG_FIELD, isExcluded, isTagOn, notNeedSync } from './
 import type { TagKey } from './listTags';
 import { useIsSp } from '../../utils/isSp';
 import OrderModal from './OrderModal';
+import TrackingTouches, { landingLabel } from './TrackingTouches';
 import { hiraToKata } from '../../utils/nexusUtils';
 
 type Shop = { brand: string, shop: string, section: string, area: string };
@@ -136,6 +137,8 @@ const ListOrder = ({ onReload }: Props) => {
     const [modalBeforeContent, setModalBeforeContent] = useState<Survey>();
     const [show, setShow] = useState(false);
     const [editId, setEditId] = useState('');
+    /** ⚠️ v2.2.199: 流入履歴を開いている反響（TrackingTouches.tsx） */
+    const [trackingTarget, setTrackingTarget] = useState<{ id: string, name: string } | null>(null);
     const [blackList, setBlackList] = useState<Black[]>([]);
     const [sections, setSections] = useState<string[]>([]);
 
@@ -685,6 +688,12 @@ const ListOrder = ({ onReload }: Props) => {
                                      color: #fff; cursor: pointer; }
                 .lo_saas .lo_badge_sync { background: #2563eb; }
                 .lo_saas .lo_badge_survey { background: #16a34a; }
+                /* ⚠️ v2.2.199: 流入履歴（TrackingTouches.tsx）を開く札。⚠️ 媒体名の下に小さく出す */
+                .lo_saas .lo_flow { display: inline-flex; align-items: center; gap: 3px; margin-top: 3px; border: 1px solid #bfdbfe;
+                                    background: #eff6ff; color: #1d4ed8; border-radius: 999px; padding: 0 7px; font-size: 10px;
+                                    font-weight: 700; cursor: pointer; line-height: 1.6; }
+                .lo_saas .lo_flow:hover { background: #dbeafe; }
+                .lo_saas .lo_flow.is_id { border-color: #e5e7eb; background: #f9fafb; color: #6b7280; }
             `}</style>
             <div className='inquiry_table spec lo_saas p-2'>
                 <div className="lo_toolbar d-flex flex-wrap mb-2 align-items-center" style={{ paddingTop: isSp ? '30px' : '' }}>
@@ -826,6 +835,7 @@ const ListOrder = ({ onReload }: Props) => {
                                 const blacklisted = isBlack(item);
                                 const survey = rowSurvey(item);
                                 const duplicates = duplicateMap.get(item.inquiry_id);
+                                const flow = landingLabel(item.landing_params);
 
                                 return (
                                     /* ⚠️ v2.2.165: key を index から inquiry_id に（⚠️ 絞り込みで行がずれても select の状態が混ざらない） */
@@ -880,7 +890,18 @@ const ListOrder = ({ onReload }: Props) => {
                                             </select>
                                         </td>
                                         <td>{item.inquiry_date}</td>
-                                        <td>{item.response_medium || ''}{(item.medium || '') !== 'ホームページ反響' || <><br /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>（{item.hp_campaign || ''}）</span></>}</td>
+                                        <td>{item.response_medium || ''}{(item.medium || '') !== 'ホームページ反響' || <><br /><span style={{ fontSize: '10px', fontWeight: 'bold' }}>（{item.hp_campaign || ''}）</span></>}
+                                            {/* ⚠️ v2.2.199: フォームが送った流入情報（landing_params）がある反響だけ。「ID」は広告の情報が無く顧客IDだけのもの */}
+                                            {flow !== '' && (
+                                                <div>
+                                                    <button type="button" className={`lo_flow${flow === 'ID' ? ' is_id' : ''}`}
+                                                        onClick={() => setTrackingTarget({ id: item.inquiry_id, name: `${item.first_name || ''}${item.last_name || ''}` })}
+                                                        title="流入履歴を見る">
+                                                        <i className="fa-solid fa-route" aria-hidden="true" />流入：{flow}
+                                                    </button>
+                                                </div>
+                                            )}
+                                        </td>
                                         <td>{item.first_name || ''}{item.last_name || ''}</td>
                                         <td>{item.pref || ''}{item.city || ''}{item.town || ''}{item.street || ''}{item.building || ''}<br />{toHalfWidth(item.mobile || '')}{(!item.mobile && item.landline) && `/${toHalfWidth(item.landline || '')}`}</td>
                                         {/*
@@ -917,6 +938,7 @@ const ListOrder = ({ onReload }: Props) => {
                 </div>
             </div>
             <OrderModal show={show} modalClose={modalClose} modalContent={modalContent} modalBeforeContent={modalBeforeContent} />
+            <TrackingTouches inquiryId={trackingTarget?.id ?? null} customerName={trackingTarget?.name ?? ''} onClose={() => setTrackingTarget(null)} />
             <InformationEdit id={editId} token={token} onClose={closeInformationEdit} authority={authority} />
         </>
     )
```

---

## 追記（2026-10-20）：本番の構成ファイルに TRACKING_IP_SALT を渡す ／ デプロイ手順書の書き直し

### 見つかった漏れ
- 本番の ② は `docker-compose.prod.yml` の `environment:` に書いた名前だけを Express に渡す（`.env.prod` の全部が渡るわけではない）。
- `TRACKING_IP_SALT` を書いていなかったため、`.env.prod` に足しても ② に届かず、ip_hash が常に NULL になるところだった。
- 手順書に「.env」と書いていたのも誤り（本番は `.env.prod`）。

### 変えたファイル
*ルート* **docker-compose.prod.yml**（express-api の environment の末尾、`KSNAP_OWNER_IV` の下に追加）
```yaml

      # 広告流入の着地記録で IP をハッシュにするソルト（v2.2.199）。
      #
      # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。**
      # ⚠️ 一度決めたら変えない（変えると同じ IP でも別のハッシュになる）。
      # ⚠️ 未設定でも動く（ip_hash が NULL になるだけ）。
      - TRACKING_IP_SALT=${TRACKING_IP_SALT:-}
```

*docs* **deploy-v2.2.199.md**（書き直し）
- 手順2：`.env.prod` は作り直さず末尾に1行足す。値を出さずに行の有無を見る確認（`grep -c`）。
- 手順3：これまでの版と同じ形（`git fetch` → `git checkout FETCH_HEAD` → `dcp build` → `dcp up -d`）。取れたかの確認と、ソルトがコンテナに届いたかの確認（`SET`／`EMPTY` だけ出す）を追加。
- 手順7：タグを貼る場所（共通フッターに1回・外れた LP には別に・二重に貼らない・LP とフォームは同じドメイン）を追加。

### 確認
- `docker compose -f docker-compose.prod.yml config --quiet` → OK（構文に誤りなし。中身は出さない）。

## 追記（2026-10-20）：touches.ts のコメントの食い違いを直す
*backend-express/src/features/tracking* **touches.ts**（冒頭コメントのみ。処理は変えていない）
```ts
 *   2. 無ければ gclid / gbraid / wbraid / fbclid / yclid のどれかが一致する行
 *     ⚠️ タグを貼る前の反響など、khg_vid が無いとき用（⚠️ tracker.js が landing_params に khg_vid を付け直し続けるので、タグのあるページからの反響には付く）
 * ⚠️ url_params（送信したページの ? 以降）は見ない。⚠️ tracker.js は URL を書き換えないので khg_vid は入らない。
```
- 旧コメント「フォームのあるページに広告付きで着地してそのまま送ると khg_vid が付かない」は、keep()（1秒ごとの付け直し）を入れた後の実装と食い違っていた。
