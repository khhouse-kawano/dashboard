import { env } from '../../config/env';
import { execute, type SqlParam } from '../../db/pool';
import { logger } from '../../utils/logger';

/**
 * Meta 広告（自社）の一覧と日別の数字の取り込み（v2.2.203）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ .env の META_ACCESS_TOKEN と META_AD_ACCOUNTS（ブランド:キャンペーンID）を使う（config/env.ts）。
 * ⚠️ 取り込むもの
 *   - meta_ad_items：{ID}/ads の広告ID・広告名・広告セット・キャンペーン・配信状態・画像（取り込むたびに上書き）
 *   - meta_ad_daily：{ID}/insights（level=ad・1日ごと）の直近 DAYS 日の表示回数・リンクのクリック・費用
 *     ⚠️ Meta は数日あとまで数字を直すので、毎回 DAYS 日分を上書きする。
 * ⚠️⚠️ トークンはヘッダー（Authorization: Bearer）で送る。⚠️ URL・ログ・エラーの文面に出さない（mask）。
 *   ⚠️ 続きのページは paging.cursors.after で自分で URL を作る（paging.next はトークン入りの URL なので使わない）。
 * ⚠️ 2つ同時には動かさない（running）。⚠️ 自動（scheduler.ts）と画面のボタン（meta_ads_import）の両方から呼ばれる。
 * ─────────────────────────────────────────────
 */

const GRAPH = 'https://graph.facebook.com/v24.0';
export const META_IMPORT_DAYS = 35;
const PAGE_LIMIT = 200;
/** 1つの ID で読むページの上限（⚠️ 無限に続かないための安全装置） */
const MAX_PAGES = 50;
/** 1回の INSERT にまとめる行数（⚠️ 本番の DB は SSH トンネルの先。1行ずつだと遅い：2026-10-21 ローカルで 2,331 件＋13,218 行に 5 分半） */
const BATCH = 500;

/** まとめて INSERT … ON DUPLICATE KEY UPDATE（⚠️ updates は VALUES() で上書きする列） */
const upsert = async (table: string, columns: string[], updates: string[], rows: SqlParam[][]): Promise<void> => {
  for (let i = 0; i < rows.length; i += BATCH) {
    const part = rows.slice(i, i + BATCH);
    const one = `(${columns.map(() => '?').join(', ')})`;
    await execute(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${part.map(() => one).join(', ')}
       ON DUPLICATE KEY UPDATE ${updates.map((c) => `${c} = VALUES(${c})`).join(', ')}`,
      part.flat()
    );
  }
};

export const isMetaConfigured = (): boolean => env.metaAccessToken !== '' && env.metaAdAccounts.length > 0;

const mask = (text: string): string => (env.metaAccessToken ? text.split(env.metaAccessToken).join('***') : text);

interface Paged<T> {
  data?: T[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message?: string; code?: number };
}

/** 1ページずつ読み、すべての data をつなげて返す */
const fetchAll = async <T>(path: string, params: Record<string, string>): Promise<T[]> => {
  const rows: T[] = [];
  let after = '';
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${GRAPH}/${path}`);
    for (const [k, v] of Object.entries({ ...params, limit: String(PAGE_LIMIT) })) url.searchParams.set(k, v);
    if (after !== '') url.searchParams.set('after', after);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${env.metaAccessToken}` } });
    const body = (await response.json()) as Paged<T>;
    if (!response.ok || body.error) {
      throw new Error(`Meta API ${response.status} ${path.split('/').pop()}: ${mask(body.error?.message ?? 'エラー')}`);
    }
    rows.push(...(body.data ?? []));
    after = body.paging?.next ? body.paging.cursors?.after ?? '' : '';
    if (after === '') return rows;
  }
  logger.warn(`metaAds: ${path} のページが ${MAX_PAGES} を超えたため途中で止めました`);
  return rows;
};

interface AdNode {
  id: string;
  name?: string;
  effective_status?: string;
  campaign?: { id?: string; name?: string };
  adset?: { id?: string; name?: string };
  creative?: { thumbnail_url?: string; image_url?: string };
}

interface InsightRow {
  ad_id?: string;
  date_start?: string;
  impressions?: string;
  inline_link_clicks?: string;
  spend?: string;
}

/** 日本時間の YYYY-MM-DD（⚠️ コンテナの TZ に頼らない） */
const jstDay = (offsetDays: number): string =>
  new Date(Date.now() + 9 * 3600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);

const nowSql = (): string => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');

export interface MetaImportResult {
  ok: boolean;
  ads: number;
  days: number;
  errors: string[];
  startedAt: string;
  finishedAt: string;
}

let running: Promise<MetaImportResult> | null = null;

const runImport = async (): Promise<MetaImportResult> => {
  const startedAt = nowSql();
  const result: MetaImportResult = { ok: true, ads: 0, days: 0, errors: [], startedAt, finishedAt: startedAt };
  const since = jstDay(META_IMPORT_DAYS - 1);
  const until = jstDay(0);

  for (const { brand, id } of env.metaAdAccounts) {
    try {
      const ads = await fetchAll<AdNode>(`${id}/ads`, {
        fields: 'id,name,effective_status,campaign{id,name},adset{id,name},creative{thumbnail_url,image_url}',
      });
      const importedAt = nowSql();
      const itemColumns = ['ad_id', 'brand', 'campaign_id', 'campaign_name', 'adset_id', 'adset_name', 'ad_name', 'status', 'thumbnail_url', 'image_url', 'imported_at'];
      await upsert('meta_ad_items', itemColumns, itemColumns.slice(1), ads.map((ad) => [
        ad.id, brand, ad.campaign?.id ?? '', (ad.campaign?.name ?? '').slice(0, 255), ad.adset?.id ?? '', (ad.adset?.name ?? '').slice(0, 255),
        (ad.name ?? '').slice(0, 255), (ad.effective_status ?? '').slice(0, 40), ad.creative?.thumbnail_url ?? null, ad.creative?.image_url ?? null, importedAt,
      ]));
      result.ads += ads.length;

      const insights = await fetchAll<InsightRow>(`${id}/insights`, {
        level: 'ad',
        time_increment: '1',
        time_range: JSON.stringify({ since, until }),
        fields: 'ad_id,impressions,inline_link_clicks,spend',
      });
      await upsert('meta_ad_daily', ['ad_id', 'day', 'impressions', 'clicks', 'spend', 'imported_at'], ['impressions', 'clicks', 'spend', 'imported_at'],
        insights.filter((row) => row.ad_id && row.date_start).map((row) => [
          row.ad_id, row.date_start, Number(row.impressions ?? 0), Number(row.inline_link_clicks ?? 0), Number(row.spend ?? 0), importedAt,
        ]));
      result.days += insights.length;
    } catch (error) {
      result.ok = false;
      result.errors.push(`${brand}: ${mask((error as Error).message)}`);
    }
  }

  result.finishedAt = nowSql();
  const summary = `metaAds: 取り込み ${result.ok ? '完了' : '一部失敗'}（広告 ${result.ads} 件・日別 ${result.days} 行・${since}〜${until}）`;
  if (result.ok) logger.info(summary);
  else logger.error(`${summary} ${result.errors.join(' / ')}`);
  return result;
};

/** 取り込む。⚠️ 動いている最中に呼ばれたら、その結果を待って返す（2つ同時には動かさない） */
export const importMetaAds = (): Promise<MetaImportResult> => {
  if (running === null) {
    running = runImport().finally(() => { running = null; });
  }
  return running;
};
