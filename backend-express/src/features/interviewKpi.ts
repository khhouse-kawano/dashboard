/**
 * 商談ステップ（interview_log）から master_data 系の KPI 日付を導き出す。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **ここが「KPIが保存されないことがある」の中心。**
 *
 *   従来は「入力欄を触った瞬間に setInformation でその列を書く」方式だった。
 *   そのため入力の順番で結果が変わっていた。
 *
 *     ・アクションを先に選ぶと、その時点の日付（空）が列に入る
 *     ・あとから直しても `!information[key]` の条件で無視される
 *     ・同じアクションが2件あると、消したときに列が空になる
 *     ・削除時に対応列が無くても `[undefined]: ''` を書いていた
 *
 *   本モジュールは **interview_log から毎回まとめて導出する**。
 *   入力順・後からの修正・複数同一アクション・削除のどれでも
 *   同じ結果になる。
 * ─────────────────────────────────────────────
 *
 * ⚠️⚠️ **導出できなかった列は絶対に空にしない。**
 *
 *   2026-09-09 に本番相当データで数えた結果、
 *   「interview_log に根拠が無いのに KPI 日付が入っている」セルが
 *
 *     order  1,295セル（1,032顧客）… うち契約日 647件
 *     spec     512セル（  512顧客）… うち自社契約 499件
 *     used     137セル（  124顧客）… うち初回来場 113件
 *     ────────────────────────────
 *     合計   1,944セル（1,668顧客）… うち契約日 1,147件
 *
 *   ある。さらに order は 24,133件中 **18,086件が interview_log 未登録**で、
 *   interview_log は KPI 日付の主たる出所ではない
 *   （ポータル同期・直接編集・interview_log 導入前のデータがある）。
 *
 *   「interview_log を唯一の正とする」実装にすると上記が全部消える。
 *   **導出できたものだけを上書きする。**
 */

/** 事業区分。⚠️ rank の category と同じ語（order / spec / used） */
export type InterviewCategory = 'order' | 'spec' | 'used';

/**
 * 事業ごとの顧客テーブル。
 * ⚠️ id は3テーブルで重複しない（2026-09-09 に実データで確認。交差0件）。
 *   そのため id から事業を判定してよい。
 */
export const INTERVIEW_TABLE: Record<InterviewCategory, string> = {
  order: 'master_data',
  spec: 'master_data_kaeru',
  used: 'master_data_resale',
};

/**
 * 注文（InformationEdit.tsx の actionMap）。
 *
 * ⚠️⚠️ **フロントの actionMap と同じ内容にすること。**
 *   食い違うと、顧客詳細から保存したときと商談ステップ画面から
 *   保存したときで別の列に入る。
 *
 * ⚠️ 移植元の interviewLog_update_interview.php の $actionMap には
 *   '0次接客' が無かった。InterviewLog.tsx から '0次接客' は選べないが、
 *   顧客詳細で登録された商談ステップを InterviewLog 側で保存し直したときに
 *   0次接客の日付が消えないよう、こちらには入れておく。
 */
const ORDER_MAP: Record<string, string> = {
  資料送付: 'step_migration_item_catalog',
  '0次接客': 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22',
  初回面談: 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
  '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
  事前審査: 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
  LINEグループ作成: 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
  契約: 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
};

/** 建売（InformationEditKaeru.tsx の actionMap） */
const SPEC_MAP: Record<string, string> = {
  '接触（通話・返信）': 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z',
  初回面談: 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
  '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
  申し込み: 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
  自社契約: 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
  仲介契約: 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0',
};

/**
 * 中古（InformationEditResale.tsx の actionMap）。
 *
 * ⚠️⚠️ **中古だけ `in_charge_store` で actionMap が切り替わる。**
 *   in_charge_store に店舗名ではなく取引区分が入っている
 *   （2026-09-09 の実データ: 買い:中古リノベ 1,322件 /
 *     売り:ポータル 601件 / 買い:ポータル 280件 / NULL 183件）。
 *
 * ⚠️ NULL の183件は actionMap が引けない。フロントも `?? {}` で
 *   空マップにしている。KPI 列は更新しない（挙動を合わせる）。
 *
 * ⚠️ 同じ列に別のアクションが割り当たっている組み合わせがある。
 *   例: step_migration_item_01J95TGVT725CV1Z4HTWB22DAV は
 *       買い側で「2回目以降物件案内」、売り側で「査定アポ」。
 *   区分が変わると意味も変わるため、区分ごとに引くこと。
 */
const RESALE_MAP: Record<string, Record<string, string>> = {
  '買い:中古リノベ': {
    初回来場: 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
    物件案内: 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG',
    '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
    '2回目以降物件案内': 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV',
    事前審査: 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
    リフォーム契約: 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
    売買契約: 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
  },
  '買い:ポータル': {
    初回来場: 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
    物件案内: 'step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG',
    '2回目以降面談': 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
    '2回目以降物件案内': 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV',
    事前審査: 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
    売買契約: 'step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW',
  },
  '売り:ポータル': {
    査定アポ: 'step_migration_item_01J95TGVT725CV1Z4HTWB22DAV',
    査定書提出: 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22',
    訪問査定: 'step_migration_item_01JSE75MPCGQW7V2MTY9VM4HXN',
    媒介取得: 'step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0',
  },
};

/**
 * アクション → KPI 列の対応表を引く。
 *
 * @param dealType 中古のみ使う（master_data_resale.in_charge_store）
 * ⚠️ 該当が無ければ空オブジェクト。KPI 列は更新しない
 */
export const actionMapFor = (
  category: InterviewCategory,
  dealType?: string | null
): Record<string, string> => {
  if (category === 'order') return ORDER_MAP;
  if (category === 'spec') return SPEC_MAP;
  return RESALE_MAP[String(dealType ?? '')] ?? {};
};

export interface InterviewLogEntry {
  day?: unknown;
  action?: unknown;
  note?: unknown;
  staff?: unknown;
}

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

/**
 * 日付を 'YYYY-MM-DD' に揃える。
 *
 * ⚠️ 保存されている日付は 'YYYY-MM-DD' と 'YYYY/MM/DD' が混在している
 *   （実データで確認）。文字列比較で最古を選ぶため、必ず揃えてから比べる。
 *   ⚠️ 揃えずに比べると '2026/03/01' < '2026-04-02' が false になり、
 *     書式が混ざった顧客で最古の判定が壊れる。
 *
 * ⚠️ Date に変換しない。'2026-03-01' を new Date で解釈すると UTC 扱いになり、
 *   タイムゾーンで1日ずれることがある。文字列のまま比較する。
 */
export const normalizeDay = (value: unknown): string => {
  const s = asString(value).trim().replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
};

/**
 * アクション名を actionMap のキーに揃える。
 *
 * ⚠️ 建売・中古では `自社契約,物件A` のように
 *   「アクション,物件名」で保存されている。先頭だけを見る。
 */
export const baseAction = (value: unknown): string => asString(value).split(',')[0] ?? '';

/**
 * interview_log から KPI 列の値を導出する。
 *
 * ⚠️⚠️ **同じアクションが複数あるときは「最も古い日付」を採る**
 *   （2026-09-09 決定）。ファネルは「いつ到達したか」を見るものなので、
 *   最初の到達日が自然で、面談を重ねても集計が後ろへずれない。
 *
 * ⚠️ 同じ列に別のアクションが割り当たる事業（中古）があるため、
 *   列単位でも最古を採る。
 *
 * ⚠️ 日付が空の行は無視する。空を入れると既存の日付を消してしまう。
 */
export const deriveKpiColumns = (
  logs: InterviewLogEntry[],
  actionMap: Record<string, string>
): Map<string, string> => {
  const derived = new Map<string, string>();

  for (const log of logs) {
    if (log === null || typeof log !== 'object') continue;

    const column = actionMap[baseAction(log.action)];
    if (column === undefined) continue;

    const day = normalizeDay(log.day);
    if (day === '') continue;

    const current = derived.get(column);
    if (current === undefined || day < current) derived.set(column, day);
  }

  return derived;
};

/**
 * 削除された商談ステップに対応する列を空にしてよいか判定する。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **無条件に空にしてはいけない。** 冒頭のコメントのとおり、
 *   interview_log に根拠の無い KPI 日付が 1,944セルある。
 *
 *   そこで、次の**両方**を満たす列だけ空にする。
 *
 *     (1) 残った interview_log から、その列を導出できない
 *         → 他の商談ステップが根拠になっていない
 *     (2) 現在DBに入っている値が、削除された行の日付と一致する
 *         → その KPI 日付は、まさに今消した行が入れたものだと言える
 *
 *   (2) があるので、ポータル同期や直接編集で入った日付は消えない。
 * ─────────────────────────────────────────────
 *
 * @param removed 画面で削除された行（day と action）
 * @param derived 残りの log から導出した列（deriveKpiColumns の結果）
 * @param currentValues DBの現在値（列 → 値）
 */
export const resolveClearedColumns = (
  removed: InterviewLogEntry[],
  derived: Map<string, string>,
  currentValues: Record<string, unknown>,
  actionMap: Record<string, string>
): string[] => {
  const clears = new Set<string>();

  for (const entry of removed) {
    if (entry === null || typeof entry !== 'object') continue;

    const column = actionMap[baseAction(entry.action)];
    if (column === undefined) continue;

    // (1) 残りの log から導出できるなら、そちらが正しい。空にしない
    if (derived.has(column)) continue;

    const removedDay = normalizeDay(entry.day);
    if (removedDay === '') continue;

    // (2) 現在値が削除した行の日付と一致するときだけ空にする
    if (normalizeDay(currentValues[column]) !== removedDay) continue;

    clears.add(column);
  }

  return Array.from(clears);
};

/**
 * 画面に出すアクションの選択肢。
 *
 * ⚠️⚠️ **actionMap のキーをそのまま返す。**
 *   InterviewLog.tsx は従来、選択肢を自前で持っていた
 *   （資料送付・初回面談・2回目以降面談・オンライン面談・
 *     LINEグループ作成・事前審査・契約）。
 *   ⚠️ そのうち「オンライン面談」はどの actionMap にも無く、
 *     **選んでも KPI 列が更新されなかった**（2026-09-09 に検証で確認）。
 *   ⚠️ また注文用の一覧を建売・中古の顧客にも出していたため、
 *     建売の「申し込み」「自社契約」などを選べなかった。
 *   選択肢を actionMap から作れば、この2つが同時に解決する。
 */
export const actionOptionsFor = (
  category: InterviewCategory,
  dealType?: string | null
): string[] => Object.keys(actionMapFor(category, dealType));
