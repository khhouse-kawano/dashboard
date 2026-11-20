import type { RowDataPacket } from 'mysql2/promise';
import { query } from '../../db/pool';
import { cvKindOf, formKindOf, parseCvPages, type CvPage } from './cvPages';
import { parseOrigins } from './touch';
import { UUID_PATTERN } from './params';

/**
 * CV と訪問の突き合わせ（v2.2.202。v2.2.287 で完了ページの数え方を追加）。
 * 使うところ：一覧の「期間のCV」（sites.ts）・サマリー（summary.ts）・詳細（detail.ts）・業者別の歩留まり（vendorFunnel.ts）。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ v2.2.287（2026-11-20 の指示）：完了ページ（tracking_sites.cv_pages）を登録したサイトは、完了ページで CV を数える。
 *   ⚠️ CV ＝ 訪問者がそのサイトの完了ページを開いたこと（tracking_pageviews）。
 *     ⚠️ 完了ページが記録されないフォーム（かえるホームの cv.js）は、tracking_conversions の時刻で補う。
 *   ⚠️ 同じ訪問者・同じ種類の完了ページは、30分以内か同じ日なら1件（再読み込み・戻る・後からの開き直しを数えない）。
 *   ⚠️ 手柄を付ける訪問は、CV の**時刻まで**の、そのサイトへの訪問（最後の訪問と、すべての訪問）。
 *   ⚠️ 反響（inquiry_customer / inquiry_customer_kaeru）とは、khg_vid と日付（前後1日）で結びつける。
 *     ⚠️ 結びつかない CV（会員登録など、流入の記録が残らないもの）も CV に数える（inquiryId は null）。
 * ⚠️ 完了ページを登録していないサイトは、今までどおり：
 *   ⚠️ CV ＝ 反響（削除を除く）のうち、landing_params の khg_vid が、問い合わせの日までにそのサイトを訪問していたもの。
 *   ⚠️ 1件の反響が複数のサイトを訪問していれば、それぞれのサイトで1件。⚠️ 反響の日付には時刻が無いので、その日の 23:59:59 までの訪問。
 * ⚠️ v2.2.253: 着地ページ別・流入元別・広告別は、一度でも来たところすべてに1件ずつ付ける（touches）。業者別と合計は最後の訪問・1件。
 * ⚠️ 反響の id は表ごとの番号なので、どちらの表の反響か（inquiryTable）と組で見ること。
 * ─────────────────────────────────────────────
 */

/** visitor_id を IN で渡す件数（⚠️ プレースホルダーが増えすぎないよう分ける） */
const CHUNK = 500;
/** 同じ訪問者・同じ種類の完了ページを1件にまとめる間（分） */
const MERGE_MINUTES = 30;

/** 反響の表（⚠️ 注文と、v2.2.205〜 かえるホーム） */
export const CV_TABLES = ['inquiry_customer', 'inquiry_customer_kaeru'] as const;
export type CvTable = (typeof CV_TABLES)[number];

interface InquiryRow extends RowDataPacket {
  inquiry_table: CvTable;
  id: number;
  inquiry_day: string | null;
  vid: string;
  pg_id: string | null;
  /** 反響で数えるサイトの対象期間に入るか（⚠️ 完了ページと結びつけるため、1日前から読んでいる） */
  in_window: number;
}

interface TouchRow extends RowDataPacket {
  site_id: number;
  visitor_id: string;
  created_at: string;
  landing_url: string | null;
  source: string | null;
  utm_content: string | null;
  utm_campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
}

/** v2.2.253 CV までの、そのサイトへの訪問1件（着地ページ・流入元・広告）。v2.2.287 utm_source・utm_medium・日時も持つ（業者別の歩留まり） */
export interface ConversionTouch {
  landingUrl: string;
  source: string;
  adId: string;
  campaign: string;
  utmSource: string;
  utmMedium: string;
  at: string;
}

export interface Conversion {
  /** 結びついた反響（⚠️ 完了ページの CV は結びつかないことがある → null） */
  inquiryTable: CvTable | null;
  inquiryId: number | null;
  /** 結びついた反響の顧客台帳の id（無ければ ''） */
  pgId: string;
  /** CV の日（YYYY-MM-DD） */
  inquiryDay: string;
  /** v2.2.287 CV の日時（YYYY-MM-DD HH:MM:SS。⚠️ 反響で数えるサイトは時刻が無いので 23:59:59） */
  at: string;
  /** v2.2.287 CV の種類（完了ページの種類。⚠️ 反響で数えるサイトは ''） */
  kind: string;
  landingUrl: string;
  source: string;
  /** v2.2.203 最後の訪問の utm_content（Meta 広告なら広告ID）・utm_campaign */
  adId: string;
  campaign: string;
  /** v2.2.238 最後の訪問の utm_source・utm_medium・日時（業者別の判定に使う。vendors.ts）。⚠️ 訪問が無ければ '' */
  utmSource: string;
  utmMedium: string;
  touchedAt: string;
  /** v2.2.253 CV までの、そのサイトへのすべての訪問（古い順。最後の1件は上の値と同じ訪問） */
  touches: ConversionTouch[];
}

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

/** CV を数える期間（YYYY-MM-DD HH:MM:SS。⚠️ 両端を含む。period.ts の Period をそのまま渡せる） */
export interface CvRange {
  since: string;
  until: string;
}

/** 完了ページの CV（結びつける前） */
interface PageEvent {
  siteId: number;
  vid: string;
  at: string;
  kind: string;
  page: string;
}

const LIKE_ESCAPE = (s: string): string => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const minutesBetween = (a: string, b: string): number => Math.abs(Date.parse(a.replace(' ', 'T')) - Date.parse(b.replace(' ', 'T'))) / 60_000;
const dayDiff = (a: string, b: string): number => Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000);

/** 完了ページを登録したサイト（完了ページと、URL の先頭に付くオリジン） */
interface CvSite {
  pages: CvPage[];
  /** ⚠️ www の有無の両方（タグはどちらのオリジンからも送られうる） */
  origins: string[];
}

/** サイトID → 完了ページ（⚠️ 列が無い＝① に SQL を流す前なら、すべて未登録として扱う） */
export const loadCvPages = async (siteId?: number): Promise<Map<number, CvSite>> => {
  const result = new Map<number, CvSite>();
  try {
    const rows = await query<RowDataPacket & { id: number; cv_pages: string | null; allowed_origins: string | string[] }>(
      `SELECT id, cv_pages, allowed_origins FROM tracking_sites${siteId === undefined ? '' : ' WHERE id = ?'}`,
      siteId === undefined ? [] : [siteId]
    );
    for (const r of rows) {
      const pages = parseCvPages(r.cv_pages);
      if (pages.length === 0) continue;
      const origins = new Set<string>();
      for (const o of parseOrigins(r.allowed_origins)) {
        origins.add(o);
        origins.add(/^https?:\/\/www\./i.test(o) ? o.replace(/^(https?:\/\/)www\./i, '$1') : o.replace(/^(https?:\/\/)/i, '$1www.'));
      }
      result.set(Number(r.id), { pages, origins: [...origins] });
    }
  } catch {
    // 列がまだ無い
  }
  return result;
};

/** 完了ページを開いた記録（と cv.js の送信）→ 1件ずつにまとめた CV */
const loadPageEvents = async (cvPages: Map<number, CvSite>, range: CvRange): Promise<PageEvent[]> => {
  const raw: PageEvent[] = [];
  for (const [siteId, { pages, origins }] of cvPages) {
    // ⚠️ オリジン＋パスの先頭で探す（idx_tracking_pageviews_url が効く）
    const prefixes = origins.flatMap((o) => pages.map((p) => `${LIKE_ESCAPE(o + p.pattern)}%`));
    if (prefixes.length === 0) continue;
    const rows = await query<RowDataPacket & { visitor_id: string; url: string; at: string }>(
      `SELECT visitor_id, url, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS at
         FROM tracking_pageviews
        WHERE site_id = ? AND (${prefixes.map(() => 'url LIKE ?').join(' OR ')}) AND created_at BETWEEN ? AND ?`,
      [siteId, ...prefixes, range.since, range.until]
    );
    for (const r of rows) {
      const kind = cvKindOf(pages, r.url);
      if (kind !== null && UUID_PATTERN.test(r.visitor_id)) raw.push({ siteId, vid: r.visitor_id, at: r.at, kind, page: r.url });
    }
    // ⚠️ cv.js（完了ページが記録されないフォームの補い）。⚠️ 表がまだ無ければ何もしない
    const forms = await query<RowDataPacket & { visitor_id: string; form: string; page_url: string | null; at: string }>(
      `SELECT visitor_id, form, page_url, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS at
         FROM tracking_conversions WHERE site_id = ? AND created_at BETWEEN ? AND ?`,
      [siteId, range.since, range.until]
    ).catch(() => []);
    for (const r of forms) {
      const kind = formKindOf(r.form);
      if (kind !== null && UUID_PATTERN.test(r.visitor_id)) raw.push({ siteId, vid: r.visitor_id, at: r.at, kind, page: r.page_url ?? '' });
    }
  }
  // ⚠️ 同じサイト・訪問者・種類は、30分以内か同じ日なら1件（最初の1件を残す。完了ページを優先するため、同時刻なら完了ページが先）
  raw.sort((a, b) => a.at.localeCompare(b.at));
  const kept: PageEvent[] = [];
  const last = new Map<string, PageEvent>();
  for (const e of raw) {
    const key = `${e.siteId}|${e.vid}|${e.kind}`;
    const prev = last.get(key);
    if (prev !== undefined && (prev.at.slice(0, 10) === e.at.slice(0, 10) || minutesBetween(prev.at, e.at) <= MERGE_MINUTES)) continue;
    last.set(key, e);
    kept.push(e);
  }
  return kept;
};

/** 訪問者ID → 訪問（古い順） */
const loadTouches = async (vids: string[], siteId?: number): Promise<Map<string, TouchRow[]>> => {
  const result = new Map<string, TouchRow[]>();
  for (let i = 0; i < vids.length; i += CHUNK) {
    const part = vids.slice(i, i + CHUNK);
    const rows = await query<TouchRow>(
      `SELECT t.site_id, t.visitor_id, DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, t.landing_url, t.source, t.utm_content, t.utm_campaign, t.utm_source, t.utm_medium
         FROM tracking_touches t
        WHERE t.visitor_id IN (${part.map(() => '?').join(', ')})${siteId === undefined ? '' : ' AND t.site_id = ?'}
        ORDER BY t.created_at, t.id`,
      siteId === undefined ? part : [...part, siteId]
    );
    for (const row of rows) {
      const list = result.get(row.visitor_id) ?? [];
      list.push(row);
      result.set(row.visitor_id, list);
    }
  }
  return result;
};

const toConversionTouch = (t: TouchRow): ConversionTouch => ({
  landingUrl: t.landing_url ?? '', source: t.source ?? '', adId: t.utm_content ?? '', campaign: t.utm_campaign ?? '',
  utmSource: t.utm_source ?? '', utmMedium: t.utm_medium ?? '', at: t.created_at,
});

/** 訪問（古い順）から、最後の訪問とすべての訪問の項目を作る */
const touchFields = (touches: TouchRow[]): Pick<Conversion, 'landingUrl' | 'source' | 'adId' | 'campaign' | 'utmSource' | 'utmMedium' | 'touchedAt' | 'touches'> => {
  const t = touches[touches.length - 1];
  return {
    landingUrl: t?.landing_url ?? '', source: t?.source ?? '', adId: t?.utm_content ?? '', campaign: t?.utm_campaign ?? '',
    utmSource: t?.utm_source ?? '', utmMedium: t?.utm_medium ?? '', touchedAt: t?.created_at ?? '',
    touches: touches.map(toConversionTouch),
  };
};

/** サイトID → そのサイトの CV（最後の訪問と、すべての訪問） */
export const attributeConversions = async (siteId: number | undefined, range: CvRange): Promise<Map<number, Conversion[]>> => {
  const result = new Map<number, Conversion[]>();
  const push = (site: number, c: Conversion): void => {
    const list = result.get(site) ?? [];
    list.push(c);
    result.set(site, list);
  };
  // ⚠️ 反響は日付しか無いので日で切る（完了ページの CV と結びつけるため、前後1日も読む）

  const cvPages = await loadCvPages(siteId);
  const inquiries = (await query<InquiryRow>(
    CV_TABLES.map((table) => `SELECT '${table}' AS inquiry_table, id, DATE_FORMAT(STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d'), '%Y-%m-%d') AS inquiry_day,
            CONVERT(LOWER(SUBSTRING(landing_params, LOCATE('khg_vid=', landing_params) + 8, 36)) USING utf8mb4) AS vid, pg_id,
            STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d') BETWEEN DATE(?) AND DATE(?) AS in_window
       FROM ${table}
      WHERE landing_params LIKE '%khg_vid=%'
        AND delete_flag = 0
        AND STR_TO_DATE(TRIM(inquiry_date), '%Y/%m/%d') BETWEEN DATE(?) - INTERVAL 1 DAY AND DATE(?) + INTERVAL 1 DAY`).join(' UNION ALL '),
    CV_TABLES.flatMap(() => [range.since, range.until, range.since, range.until])
  )).filter((r) => r.inquiry_day !== null && UUID_PATTERN.test(r.vid));
  const events = await loadPageEvents(cvPages, range);

  const vids = [...new Set([...inquiries.map((r) => r.vid), ...events.map((e) => e.vid)])];
  if (vids.length === 0) return result;
  const touchesByVisitor = await loadTouches(vids, siteId);

  // ① 完了ページを登録したサイト：完了ページの CV
  const inquiriesByVid = new Map<string, InquiryRow[]>();
  for (const r of inquiries) inquiriesByVid.set(r.vid, [...(inquiriesByVid.get(r.vid) ?? []), r]);
  const usedInquiry = new Set<string>();
  for (const e of events) {
    const touches = (touchesByVisitor.get(e.vid) ?? []).filter((t) => Number(t.site_id) === e.siteId && t.created_at <= e.at);
    const day = e.at.slice(0, 10);
    // ⚠️ 同じ訪問者の反響のうち、日付がいちばん近いもの（前後1日まで）。⚠️ 1件の反響は1件の CV にだけ
    const inquiry = (inquiriesByVid.get(e.vid) ?? [])
      .filter((r) => !usedInquiry.has(`${r.inquiry_table}:${r.id}`) && dayDiff(r.inquiry_day ?? '', day) <= 1)
      .sort((a, b) => dayDiff(a.inquiry_day ?? '', day) - dayDiff(b.inquiry_day ?? '', day))[0];
    if (inquiry !== undefined) usedInquiry.add(`${inquiry.inquiry_table}:${inquiry.id}`);
    push(e.siteId, {
      inquiryTable: inquiry?.inquiry_table ?? null, inquiryId: inquiry === undefined ? null : Number(inquiry.id), pgId: String(inquiry?.pg_id ?? '').trim(),
      inquiryDay: day, at: e.at, kind: e.kind, ...touchFields(touches),
    });
  }

  // ② 完了ページを登録していないサイト：今までどおり反響で数える
  for (const inquiry of inquiries) {
    if (Number(inquiry.in_window) !== 1) continue;
    const limit = `${inquiry.inquiry_day} 23:59:59`;
    const bySite = new Map<number, TouchRow[]>();
    for (const touch of touchesByVisitor.get(inquiry.vid) ?? []) {
      if (touch.created_at > limit || cvPages.has(Number(touch.site_id))) continue;
      bySite.set(Number(touch.site_id), [...(bySite.get(Number(touch.site_id)) ?? []), touch]);
    }
    for (const [site, touches] of bySite) {
      push(site, {
        inquiryTable: inquiry.inquiry_table, inquiryId: Number(inquiry.id), pgId: String(inquiry.pg_id ?? '').trim(),
        inquiryDay: inquiry.inquiry_day ?? '', at: limit, kind: '', ...touchFields(touches),
      });
    }
  }
  return result;
};
