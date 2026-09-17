import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';
import type { SqlParam } from '../../db/pool';

/**
 * 集客イベントの来場予約一覧（header/EventList.tsx）。
 *
 * ─────────────────────────────────────────────
 * 移植元: backend/src/handlers/listAction/list_event.php
 *
 * ⚠️⚠️ **1つの roll で参照と書き込みを兼ねている。** `function` で分かれる。
 *     function = 'load'   … event_db と staff_list を全件返す（参照）
 *     function = 'update' … event_db の1行を更新（書き込み）
 *   `rank` と同じ構造である。request 名や roll だけでは書き込みか判断できない。
 *
 * ⚠️ ① に PHP ハンドラが**実在する**（消していない）。
 *   express_proxy.php の許可リストから外せば即座に ① の処理へ戻る。
 *
 * ⚠️⚠️ **フォールバック禁止リストには入れない。**
 *   `update` は `SET 列 = 値` の単純な代入だけで、加算やトグルが無い。
 *   ② が処理済みで応答だけ失われ、① でもう一度同じ UPDATE が走っても
 *   結果は同じ（冪等）である。
 *   ⚠️ 加算・トグル・INSERT を足すときは、必ず
 *     expressProxyExclusive() への登録も同時に行うこと。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface ListEventResult {
  httpStatus: number;
  body: unknown;
}

/**
 * 更新を許可する列。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **PHP の $allowed_columns と1つも違わないこと。**
 *   backend/src/handlers/listAction/list_event.php:50
 *
 *   2026-09-07 に大幅に絞られている。来場予約がLPのフォームから直接届くため、
 *   氏名・連絡先以外は**来場者本人が入力した原本**である。
 *   社内で書き換えると「本当は何と入力されたのか」が分からなくなる。
 *
 *     name / phone / mail … 受付で誤記に気づいたときに直す
 *     check_in_time       … QRの読み取り（受付）で記録する
 *     check_out_time      … 退場時刻
 *     remarks             … 社内メモ（原本ではない）
 *     sync                … 顧客への取り込み済みフラグ
 *
 * ⚠️ ここに列を戻すときは EventList.tsx の入力欄と ① の PHP も合わせること。
 *   片方だけ変えると、画面では編集できるのに保存されない（無言で消える）。
 *
 * ⚠️⚠️ **列名をそのままSQLに埋めている。** この配列に無い名前は絶対に通らない
 *   （リクエストのキーを列名に使うとSQLインジェクションになる）。
 * ─────────────────────────────────────────────
 */
const ALLOWED_COLUMNS = [
  'name',
  'phone',
  'mail',
  'check_in_time',
  'check_out_time',
  'remarks',
  'sync',
] as const;

/**
 * リクエストの値を SQL のプレースホルダに渡せる形にする。
 *
 * ⚠️⚠️ **オブジェクトや配列は通さない。**
 *   JSON のリクエストなので `{"name": {"a":1}}` のような値も届きうる。
 *   mysql2 はオブジェクトを文字列化して入れてしまうため、
 *   `[object Object]` が保存される。受け付けない値は null にする。
 *
 * ⚠️ null / 空文字はそのまま通す。受付で誤記を消す操作に必要（PHP と同じ）。
 */
const toSqlParam = (value: unknown): SqlParam => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  return null;
};

/**
 * 参照（function = 'load'）。
 *
 * ⚠️ どちらも `SELECT *` の全件。絞り込みは一切していない（PHP のまま）。
 *   ⚠️ staff_list も全件である。report や period で絞っていない。
 *     絞ると EventList.tsx の担当営業の選択肢が減る。
 */
const runLoad = async (): Promise<ListEventResult> => {
  // ⚠️ 並列で投げる。PHP は逐次だったが結果は同じ
  const [summary, staff] = await Promise.all([
    query<DynamicRow>('SELECT * FROM event_db'),
    query<DynamicRow>('SELECT * FROM staff_list'),
  ]);

  // ⚠️ キー名は PHP と同じ。フロントは response.data.summary / .staff で読む
  return { httpStatus: 200, body: { summary, staff } };
};

/**
 * 更新（function = 'update'）。
 *
 * ⚠️⚠️ **PHP は `array_key_exists` で判定している。**
 *   値が null や空文字でも「キーがあれば更新する」。
 *   `if (body[column])` のような真偽判定にすると、
 *   **空文字で消せなくなる**（受付で誤記を消す操作ができなくなる）。
 *
 * ⚠️ PHP はエラーでも HTTP 200 を返し、本文の status で伝えている。
 *   フロント（EventList.tsx の updateField）はレスポンスを見ておらず
 *   catch だけなので、ここで 4xx を返すと**今まで無言だった失敗が
 *   コンソールエラーになる**。挙動を変えないため 200 に揃える。
 */
const runUpdate = async (body: Record<string, unknown>): Promise<ListEventResult> => {
  const rawId = body.id;
  const id =
    typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : '';

  // ⚠️ PHP は `!$id` で判定。'0' も空扱いになる点まで揃える
  if (id === '' || id === '0') {
    return {
      httpStatus: 200,
      body: { status: 'error', message: 'IDが指定されていません' },
    };
  }

  const columns: string[] = [];
  const values: SqlParam[] = [];

  for (const column of ALLOWED_COLUMNS) {
    // ⚠️ キーの有無で判定する（値が null / '' でも更新対象にする）
    if (!Object.prototype.hasOwnProperty.call(body, column)) continue;
    columns.push(column);
    values.push(toSqlParam(body[column]));
  }

  if (columns.length === 0) {
    return {
      httpStatus: 200,
      body: { status: 'error', message: '更新するデータがありません' },
    };
  }

  const setClause = columns.map((c) => `\`${c}\` = ?`).join(', ');

  try {
    await execute(`UPDATE event_db SET ${setClause} WHERE id = ?`, [...values, id]);
    return {
      httpStatus: 200,
      body: { status: 'success', message: '更新が完了しました' },
    };
  } catch (error) {
    /**
     * ⚠️⚠️ **DBのエラー本文はクライアントへ返さない。**
     *   PHP は `'DBエラー: ' . $e->getMessage()` をそのまま返しており、
     *   テーブル名や列名が外に出ていた。
     *   フロントはこの本文を表示していないため、返さなくても画面は変わらない。
     *   原因の追跡はサーバー側のログで行う。
     */
    console.error('list:event update failed', { id, columns, error });
    return {
      httpStatus: 200,
      body: { status: 'error', message: '更新に失敗しました' },
    };
  }
};

export const runListEvent = async (
  body: Record<string, unknown>
): Promise<ListEventResult> => {
  const fn = typeof body.function === 'string' ? body.function : '';

  if (fn === 'load') return runLoad();
  if (fn === 'update') return runUpdate(body);

  /**
   * ⚠️ PHP はここで**何も出力せず**終わる（空レスポンス・HTTP 200）。
   *   空文字は JSON として壊れているため、フロントが受けても使えない。
   *   ⚠️ EventList.tsx は必ず 'load' か 'update' を送るので、
   *     この経路は実際には通らない。
   *   ⚠️ それでも空を返すのは避け、原因の分かる形にしている。
   */
  return {
    httpStatus: 400,
    body: { status: 'error', message: '無効な function です' },
  };
};
