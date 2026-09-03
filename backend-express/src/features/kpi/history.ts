import { query } from '../../db/pool';
import type { RowDataPacket } from 'mysql2/promise';
import { logger } from '../../utils/logger';
import { isKpiAnalysisType, isKpiDivision } from './divisions';
import type { SqlParam } from '../../db/pool';

/**
 * 保存済みKPI分析の一覧取得と1件取得。
 *
 * 移植元:
 *   backend/src/handlers/kpi_analysis_list.php
 *   backend/src/handlers/kpi_analysis_get.php
 *
 * ⚠️ どちらも参照のみ。分析の実行（kpi_analyze）と削除（kpi_analysis_delete）は
 *   ① のPHPに残している。課金と書き込みを伴うため、
 *   自動フォールバックのある転送に載せると二重実行の危険がある。
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

interface HistoryRow extends RowDataPacket {
  id: number;
  analysis_json?: unknown;
  kpi_json?: unknown;
  [key: string]: unknown;
}

/**
 * ハンドラの戻り値。PHP はステータスコードを出し分けているため、
 * 本文だけでなく返すべきHTTPステータスも一緒に持ち回る。
 */
export interface KpiHttpResult {
  httpStatus: number;
  body: unknown;
}

// ---------------------------------------------------------------------------
// 一覧
// ---------------------------------------------------------------------------

/**
 * ⚠️ analysis_json / kpi_json は SELECT しない。
 *   1件あたり数十KBあり、一覧で全部返すと無駄に重くなる。
 *   本体は kpi_analysis_get で1件ずつ取る。
 */
const listSql = (whereSql: string, limit: number, offset: number): string => `
  SELECT h.id,
         h.title,
         h.headline,
         h.analysis_type,
         h.division,
         h.scope_section,
         h.scope_shop,
         h.scope_staff,
         h.scope_label,
         h.model,
         h.created_at,
         s.name AS staff_name
    FROM kpi_analysis_history h
    LEFT JOIN staff s ON s.id = h.staff_id
   ${whereSql}
   ORDER BY h.created_at DESC, h.id DESC
   LIMIT ${limit} OFFSET ${offset}
`;

export interface KpiAnalysisListParams {
  limit?: unknown;
  offset?: unknown;
  division?: unknown;
  type?: unknown;
}

/** PHP の (int)$x と同じ挙動。数値化できなければ 0 */
const toInt = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

export const runKpiAnalysisList = async (
  params: KpiAnalysisListParams
): Promise<KpiHttpResult> => {
  // 上限を設けないと、履歴が増えたときに一覧だけで重くなる
  const limit = Math.max(1, Math.min(100, params.limit === undefined ? 20 : toInt(params.limit)));
  const offset = Math.max(0, toInt(params.offset));

  // 任意の絞り込み。未知の値は無視する（エラーにはしない）
  const where: string[] = [];
  const values: SqlParam[] = [];

  const division = typeof params.division === 'string' ? params.division : '';
  if (isKpiDivision(division)) {
    where.push('h.division = ?');
    values.push(division);
  }

  const type = typeof params.type === 'string' ? params.type : '';
  if (isKpiAnalysisType(type)) {
    where.push('h.analysis_type = ?');
    values.push(type);
  }

  const whereSql = where.length === 0 ? '' : ` WHERE ${where.join(' AND ')}`;

  // 「もっと見る」の要否を判断するため総件数も返す
  const countRows = await query<DynamicRow>(
    `SELECT COUNT(*) AS cnt FROM kpi_analysis_history h${whereSql}`,
    values
  );
  const total = toInt(countRows[0]?.cnt ?? 0);

  // ⚠️ LIMIT / OFFSET は上でクランプ済みの整数なので直接埋め込む。
  //   ① と同じ理由（プリペアドステートメントでは LIMIT に
  //   プレースホルダを使うと文字列として扱われて落ちる）。
  const items = await query<HistoryRow>(listSql(whereSql, limit, offset), values);

  return {
    httpStatus: 200,
    body: { status: 'ok', items, total, limit, offset },
  };
};

// ---------------------------------------------------------------------------
// 1件取得
// ---------------------------------------------------------------------------

const GET_SQL = `
  SELECT h.id,
         h.title,
         h.headline,
         h.analysis_type,
         h.division,
         h.scope_section,
         h.scope_shop,
         h.scope_staff,
         h.scope_label,
         h.analysis_json,
         h.kpi_json,
         h.model,
         h.created_at,
         s.name AS staff_name
    FROM kpi_analysis_history h
    LEFT JOIN staff s ON s.id = h.staff_id
   WHERE h.id = ?
`;

/**
 * ⚠️ JSON.parse が失敗しても例外を投げない。
 *   保存時点のスキーマで書かれたJSONが、その後のコード変更で読めなくなることは
 *   起こりうる。PHP は json_decode が null を返したら 422 にしているため、
 *   ここも同じく「配列/オブジェクトでなければ失敗」として扱う。
 */
const parseStoredJson = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== 'object') return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const runKpiAnalysisGet = async (rawId: unknown): Promise<KpiHttpResult> => {
  const id = toInt(rawId);

  if (id <= 0) {
    return {
      httpStatus: 400,
      body: { status: 'error', message: 'IDが指定されていません。' },
    };
  }

  const rows = await query<HistoryRow>(GET_SQL, [id]);
  const row = rows[0];

  if (row === undefined) {
    return {
      httpStatus: 404,
      body: { status: 'error', message: '指定された分析結果が見つかりません。' },
    };
  }

  const analysis = parseStoredJson(row.analysis_json);
  const kpi = parseStoredJson(row.kpi_json);

  if (analysis === null || kpi === null) {
    logger.error(`kpi_analysis_get: broken json id=${id}`);
    return {
      httpStatus: 422,
      body: { status: 'error', message: '保存された分析結果を復元できませんでした。' },
    };
  }

  // ⚠️ 本体のJSONは item から外す。PHP の unset() と同じ。
  //   残すとレスポンスが倍の大きさになり、しかも文字列として二重に入る。
  //
  //   ⚠️ delete でキーを消すと**キーの順序**が PHP と変わらないことに注意。
  //     PHP も同じ位置の2キーを unset しているため、残るキーの並びは一致する。
  const item: Record<string, unknown> = { ...row };
  delete item.analysis_json;
  delete item.kpi_json;

  return {
    httpStatus: 200,
    body: { status: 'ok', item, analysis, kpi },
  };
};
