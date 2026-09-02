/**
 * 分析APIが参照する master_data のカラム定義。
 *
 * master_data のフェーズ日付・属性カラムは `step_migration_item_01J82Z5F…` のような
 * ULID 由来の物理名で、名前から意味が読み取れない。意味はDBのカラムコメントに
 * しか書かれていないため、ここに写して一元管理する。
 *
 * ⚠️ カラムコメントは実運用と食い違っている箇所がある。コメントだけを根拠に
 *   カラムを追加・変更しないこと。下の「第二面談」の注記を参照。
 */

/**
 * 日付として使えるようにテキストカラムを正規化するSQL式を作る。
 *
 * master_data は全カラムが text 型で、同じ列に2つの書式が混在している。
 * 実測（反響取得日）では `YYYY/MM/DD` が 20,698 件、`YYYY-MM-DD` が 727 件。
 * 正規化せずに比較すると9割以上を取りこぼす。
 *
 * 不正な値（`0004-06-…` のような入力ミスが実在する）は STR_TO_DATE が
 * NULL を返すため、後段の WHERE で自然に除外される。
 *
 * PHP 側 core/kpi.php の kpiDateExpr() と同じ式にそろえてある。
 * 片方だけ直すと既存のKPI画面と数字がずれるため、変更するときは両方直すこと。
 */
export const asDate = (column: string): string =>
  `STR_TO_DATE(NULLIF(REPLACE(${column}, '/', '-'), ''), '%Y-%m-%d')`;

/**
 * 営業プロセスのフェーズ日付。並び順は進行順。
 *
 * ⚠️ 第二面談は `01JSENACS2FC422ZHEZWNSXNYA` を使う。
 *   DBのカラムコメントではこれが「※次回アポ」、`01JV6AVXQMJY6XR4STWCHNKVE0`
 *   が「第二面談」となっているが、運用上の第二面談は前者である（運用側の指定）。
 *   コメントと実態が逆になっているため、コメントを信用してはならない。
 *   なお PHP 側 core/kpi.php の KPI_MD_NEXT_IV は後者を見ているため、
 *   第二面談の件数は既存のKPI画面とは一致しない。
 *
 * ⚠️ 次の3カラムは使用しないこと（運用側の指定）。
 *   step_migration_item_01JV6AVXQMJY6XR4STWCHNKVE0（コメント上は第二面談）
 *   step_migration_item_01JP74NGRTT95X4Z8AQZ2QK2PW（2回目以降面談）
 *   step_migration_item_01JV6AVXR4X6HW3JQ0G53Y26GG（物件案内。入力率がほぼ0）
 */
export const PHASES = {
  reaction: {
    column: 'step_migration_item_01J82Z5F13B6QVM6X0TCWZHW99',
    label: '反響取得日',
  },
  zeroReception: {
    column: 'step_migration_item_01J82Z5F1WE8SKEES6VNN37B22',
    label: '0次接客',
  },
  energized: {
    column: 'step_migration_item_01J82Z5F1990Y4G2TZ6XSCRX3Z',
    label: '通電',
  },
  firstInterview: {
    column: 'step_migration_item_01J82Z5F1GQB02S1DEBZPBFDW7',
    label: '初回面談',
  },
  secondInterview: {
    column: 'step_migration_item_01JSENACS2FC422ZHEZWNSXNYA',
    label: '第二面談',
  },
  preScreening: {
    column: 'step_migration_item_01JSE0CRECT96FMYTZ1ZREC3QR',
    label: '事前審査',
  },
  contract: {
    column: 'step_migration_item_01J82Z5F1RR18Z792C7KZS88QG',
    label: '契約日',
  },
} as const;

export type PhaseKey = keyof typeof PHASES;

export const PHASE_KEYS = Object.keys(PHASES) as PhaseKey[];

/** フェーズ日付の正規化済みSQL式 */
export const phaseDate = (phase: PhaseKey): string => asDate(PHASES[phase].column);

/** 属性カラム（DBコメント由来） */
export const ATTRIBUTES = {
  rank: { column: 'customized_input_01J82Z5F366ZQ897PXWF6H5ZAM', label: 'ランク' },
  event: { column: 'customized_input_01JRCT12N9X24PCQ5QZPAYKB93', label: '集客イベント' },
  competitorLostReason: {
    column: 'customized_input_01JRF9CZSW65A151WR30NA4PB3',
    label: '他決理由',
  },
  priorityItem: {
    column: 'customized_input_01JSE7DKY5RYY3T8T8NVR1AJMN',
    label: '重視項目',
  },
} as const;

/**
 * 集計対象を絞る条件。既存のKPI画面と完全にそろえてある。
 *
 * master_data.show_dashboard = 1 … 非表示レコードを除外（実測459件）
 * shop_list.report_flag     = 1 … 「KH全店舗」のような集計用ダミー行と
 *                                  運用を終えた店舗を除外（shop_list は注文事業で45行あるが、実際に顧客が紐づく店舗は28）
 *
 * この2条件により母数は約23,000件になる（2026-08時点。件数は日々増える）。
 * 片方でも外すと既存KPI画面と食い違う。
 */
export const TARGET_DIVISION = '注文事業';

/**
 * 明らかな入力ミスを除外する下限日。
 * 反響取得日に 0004年・0024年といった値が実在し、月次軸を壊すため足切りする。
 */
export const MIN_VALID_DATE = '2015-01-01';

/** 軸の値が空だった行に入れる表示値。0件との混同を防ぐため明示する */
export const UNSET_LABEL = '(未設定)';

/**
 * 空欄をまとめてから集計するためのSQL式。
 *
 * ⚠️ 空欄の寄せ方はSQL側で行うこと。
 *   master_data は同じ意味の欠損が NULL と空文字の2通りで入っている。
 *   GROUP BY はこの2つを別グループとして扱うため、アプリ側で表示名だけ
 *   揃えると同じ「(未設定)」の行が2行返ってしまう
 *   （実測: 反響媒体軸で 7,142件と96件に分裂していた）。
 */
export const groupExpr = (expression: string): string =>
  `COALESCE(NULLIF(TRIM(${expression}), ''), '${UNSET_LABEL}')`;

/**
 * 日数差を求める式。
 * 面談日や契約日が反響日より前になっている入力ミス（負の値）は NULL にして
 * 平均・中央値の母数から外す。PHP 側 kpiDaysBetween() と同じ考え方。
 */
export const daysBetween = (from: string, to: string): string =>
  `NULLIF(GREATEST(DATEDIFF(${to}, ${from}), -1), -1)`;
