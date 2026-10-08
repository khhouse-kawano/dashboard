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
 *     function = 'festa'  … event_db.festa（営業入力の JSON）の1項目を書く（v2.2.172。書き込み）
 *     function = 'sync_shop' … event_db.shop に同期した店舗を足す（v2.2.174。書き込み）
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
 *     staff               … 担当スタッフ（v2.2.171。自由入力）
 *     kana                … ふりがな（v2.2.172。フェスタ当日画面で直せるように。指示書）
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
  // ⚠️ v2.2.172 追加。ふりがな（FestaDashboard.tsx の入力欄。⚠️ EventList.tsx では表示のみ）
  'kana',
  // ⚠️ v2.2.171 追加。担当スタッフ（event_db.staff。⚠️ 先に ALTER を流すこと）
  'staff',
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
  const [summary, staff, shop] = await Promise.all([
    query<DynamicRow>('SELECT * FROM event_db'),
    query<DynamicRow>('SELECT * FROM staff_list'),
    /**
     * ⚠️⚠️ **担当店舗を選び直すために返す**（2026-09-28 追加）。
     *   ⚠️ event_db.shop が空の予約があり、⚠️ **そのままでは同期できなかった。**
     *
     * ⚠️ 絞り込み（report_flag = 1）と並び替えは**フロントがやる**
     *   （⚠️ `filterReportShops` / `sortShops`。⚠️ **規則を2箇所に置かない**）。
     * ⚠️ ⚠️ **`id` と `division` を必ず含めること。** `sortShops` が見ている。
     */
    query<DynamicRow>('SELECT id, brand, shop, section, area, division, report_flag FROM shop_list'),
  ]);

  // ⚠️ キー名は PHP と同じ。フロントは response.data.summary / .staff / .shop で読む
  //   ⚠️⚠️ **① の list_event.php と揃えること。** 片方だけ足すと、
  //     ⚠️ **どちらが応答したかで店舗が出たり出なかったりする。**
  return { httpStatus: 200, body: { summary, staff, shop } };
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

/**
 * 営業入力（event_db.festa）のキー。v2.2.172。
 *
 * ⚠️ `ブランド_interview`（面談）と `ブランド_next`（次アポ）。⚠️ 7ブランド × 2 = 14個。
 * ⚠️⚠️ **この一覧に無いキーは受け付けない**（⚠️ JSON のパスを外から自由に書かせない）。
 * ⚠️ FestaDashboard.tsx の FESTA_BRANDS と同じ並び・同じ表記にすること。
 */
export const FESTA_BRANDS = ['KH', 'DJH', 'なごみ', '2L', 'PGH', 'かえる', '中専'] as const;
const FESTA_KINDS = ['interview', 'next'] as const;
const FESTA_KEYS = new Set<string>(
  FESTA_BRANDS.flatMap((brand) => FESTA_KINDS.map((kind) => `${brand}_${kind}`))
);

/**
 * 営業入力の1項目を書く（function = 'festa'）。v2.2.172。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **JSON を丸ごと上書きしない。** ⚠️ `JSON_SET` で ⚠️ **1つのキーだけ**書き換える。
 *   ⚠️ 当日は複数の営業が同じ行のトグルを同時に押す。⚠️ 画面が持っている JSON を丸ごと送ると、
 *     ⚠️ **後から保存した人が、先に押した人の値を消してしまう。**
 *
 * ⚠️ 値は ⚠️ **トグル（反転）ではなく「true / false を指定」**。
 *   ⚠️ 同じ要求が2回届いても結果は同じ（冪等）なので、
 *     ⚠️ ① へのフォールバックで再実行されても壊れない（⚠️ expressProxyExclusive には入れない）。
 *
 * ⚠️ 列が空・壊れた JSON のときは `{}` から始める（⚠️ JSON_SET が NULL を返して値が消えるのを防ぐ）。
 * ⚠️ true / false は ⚠️ **SQL のリテラルで埋める**（⚠️ 値は boolean から作るので外部の文字は入らない）。
 *   ⚠️ プレースホルダで渡すと 1 / 0 の数値で保存される。
 * ─────────────────────────────────────────────
 */
const runFesta = async (body: Record<string, unknown>): Promise<ListEventResult> => {
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const key = typeof body.key === 'string' ? body.key : '';

  if (id === '') {
    return { httpStatus: 200, body: { status: 'error', message: 'IDが指定されていません' } };
  }
  if (!FESTA_KEYS.has(key)) {
    return { httpStatus: 200, body: { status: 'error', message: '項目が正しくありません' } };
  }
  if (typeof body.value !== 'boolean') {
    return { httpStatus: 200, body: { status: 'error', message: '値が正しくありません' } };
  }
  const literal = body.value ? 'TRUE' : 'FALSE';

  try {
    // ⚠️ パスは FESTA_KEYS を通った値だけ。⚠️ キーに日本語があるので必ず "" で囲む
    const result = await execute(
      `UPDATE event_db
          SET festa = JSON_SET(IF(JSON_VALID(festa), festa, '{}'), ?, ${literal})
        WHERE id = ?`,
      [`$."${key}"`, id]
    );
    if (result.affectedRows === 0) {
      return { httpStatus: 200, body: { status: 'error', message: '予約が見つかりませんでした' } };
    }
    return { httpStatus: 200, body: { status: 'success', message: '更新が完了しました' } };
  } catch (error) {
    // ⚠️ DB のエラー本文は返さない（runUpdate と同じ）
    console.error('list:event festa failed', { id, key, error });
    return { httpStatus: 200, body: { status: 'error', message: '更新に失敗しました' } };
  }
};

/**
 * 同期した店舗を足す（function = 'sync_shop'）。v2.2.174。
 *
 * ─────────────────────────────────────────────
 * ⚠️ フェスタ（FestaDashboard.tsx）は ⚠️ **店舗が違えば何度でも同期できる**（指示書）。
 *   ⚠️ 同期した店舗を ⚠️ **event_db.shop に `,` 区切りで足していく**（⚠️ 列の形は変えない）。
 *   ⚠️ shop は反響一覧（他のイベント）では「イベントの店舗」として使っているので、JSON にはしない。
 *
 * ⚠️⚠️ **足すのはサーバー**（⚠️ 1回の UPDATE）。⚠️ 画面が持っている shop に足して送ると、
 *   ⚠️ 2人が同時に別の店舗へ同期したとき、⚠️ **後の人が先の人の店舗を消してしまう。**
 * ⚠️ もう入っている店舗は足さない（FIND_IN_SET）。⚠️ 同じ要求が2回届いても結果は同じ（冪等）なので
 *   ⚠️ ① へのフォールバックで再実行されても壊れない（⚠️ expressProxyExclusive には入れない）。
 * ⚠️ sync も 1 にする（⚠️ 行の色・反響一覧の「同期済み」はこれを見ている）。
 * ⚠️ 店舗は ⚠️ **shop_list にある名前だけ**受ける（⚠️ `,` を含む名前・空・でたらめな値を入れない）。
 *
 * 返す: { status: 'success', shop: 足したあとの shop, added: 足したか（⚠️ 既にあれば false） }
 * ─────────────────────────────────────────────
 */
const runSyncShop = async (body: Record<string, unknown>): Promise<ListEventResult> => {
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const shop = typeof body.shop === 'string' ? body.shop.trim() : '';

  if (id === '') {
    return { httpStatus: 200, body: { status: 'error', message: 'IDが指定されていません' } };
  }
  if (shop === '' || shop.includes(',')) {
    return { httpStatus: 200, body: { status: 'error', message: '店舗が正しくありません' } };
  }

  try {
    const known = await query<DynamicRow>('SELECT 1 FROM shop_list WHERE shop = ? LIMIT 1', [shop]);
    if (known.length === 0) {
      return { httpStatus: 200, body: { status: 'error', message: '店舗が正しくありません' } };
    }

    const result = await execute(
      `UPDATE event_db
          SET shop = IF(shop IS NULL OR shop = '', ?, CONCAT(shop, ',', ?)), sync = 1
        WHERE id = ? AND FIND_IN_SET(?, IFNULL(shop, '')) = 0`,
      [shop, shop, id, shop]
    );
    const rows = await query<DynamicRow>('SELECT shop FROM event_db WHERE id = ?', [id]);
    if (rows.length === 0) {
      return { httpStatus: 200, body: { status: 'error', message: '予約が見つかりませんでした' } };
    }
    return {
      httpStatus: 200,
      body: { status: 'success', shop: rows[0].shop ?? '', added: result.affectedRows > 0 },
    };
  } catch (error) {
    // ⚠️ DB のエラー本文は返さない（runUpdate と同じ）
    console.error('list:event sync_shop failed', { id, shop, error });
    return { httpStatus: 200, body: { status: 'error', message: '更新に失敗しました' } };
  }
};

export const runListEvent = async (
  body: Record<string, unknown>
): Promise<ListEventResult> => {
  const fn = typeof body.function === 'string' ? body.function : '';

  if (fn === 'load') return runLoad();
  if (fn === 'update') return runUpdate(body);
  if (fn === 'festa') return runFesta(body);
  if (fn === 'sync_shop') return runSyncShop(body);

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
