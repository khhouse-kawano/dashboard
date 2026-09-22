import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../../db/pool';

/**
 * Claude が書いた分析レポート（HTML）の保存と取り出し。
 *
 * ─────────────────────────────────────────────
 * ⚠️⚠️ **なぜ HTML をそのまま保存するのか**
 *
 *   ⚠️ 推論は ⚠️ **利用者自身の Claude アカウント**（Claude Desktop / MCP）で行う。
 *     ⚠️ ⚠️ **社内の API キーを使わない＝会社に課金が発生しない。**
 *   ⚠️ 画面は ⚠️ **出来上がった HTML を出すだけ**なので、開くたびの費用はゼロ。
 *
 * ⚠️⚠️ **この HTML は「こちらが書いたコード」ではない。**
 *   ⚠️ 画面では ⚠️ **iframe の中に `sandbox="allow-scripts"` で出す。**
 *   ⚠️ ⚠️ **`allow-same-origin` を付けないこと。**
 *     ⚠️ 付けると、レポートの中のスクリプトから
 *       ⚠️ **ダッシュボードのログイン情報を読めてしまう。**
 *   ⚠️ サーバー側では中身を検査しない。⚠️ **検査で防ぐ設計にしない**
 *     （すり抜けを前提に、置き場所の側で閉じ込める）。
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

/** 1件あたりの HTML の上限。⚠️ 参考資料は60KB前後。余裕を見て2MB */
export const MAX_HTML_BYTES = 2 * 1024 * 1024;

export interface ReportInput {
  title: string;
  category: string;
  division: string;
  period: string;
  html: string;
  staff: string;
  dataAsOf?: string;
}

/**
 * レポートを保存する。
 *
 * ⚠️ 同じ分析を何度も作り直すため、⚠️ **上書きではなく毎回1件足す。**
 *   ⚠️ ⚠️ **過去の分析と読み比べられること自体に価値がある**
 *     （参考資料も「前期 vs 今期」で比較していた）。
 */
export const saveReport = async (input: ReportInput): Promise<number> => {
  const result = await execute(
    'INSERT INTO analysis_report (title, category, division, period, html, staff, data_as_of)' +
      ' VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      input.title.slice(0, 255),
      input.category.slice(0, 64),
      input.division.slice(0, 32),
      input.period.slice(0, 64),
      input.html,
      input.staff.slice(0, 128),
      input.dataAsOf ?? null,
    ]
  );

  return result.insertId;
};

/**
 * 一覧。
 *
 * ⚠️⚠️ **`html` を含めないこと。**
 *   ⚠️ 1件60KB あるため、一覧で返すと ⚠️ **数MBの応答になる。**
 */
export const listReports = async (category?: string): Promise<DynamicRow[]> =>
  query<DynamicRow>(
    'SELECT no, title, category, division, period, staff, data_as_of, created,' +
      ' CHAR_LENGTH(html) AS html_length' +
      ' FROM analysis_report' +
      (category === undefined || category === '' ? '' : ' WHERE category = ?') +
      ' ORDER BY created DESC, no DESC',
    category === undefined || category === '' ? [] : [category]
  );

/** 本文を1件だけ取り出す */
export const getReport = async (no: number): Promise<DynamicRow | null> => {
  const rows = await query<DynamicRow>(
    'SELECT no, title, category, division, period, staff, data_as_of, created, html' +
      ' FROM analysis_report WHERE no = ?',
    [no]
  );

  return rows[0] ?? null;
};

/** 削除。⚠️ 取り消せないので、呼ぶ側で確認すること */
export const deleteReport = async (no: number): Promise<void> => {
  await execute('DELETE FROM analysis_report WHERE no = ?', [no]);
};

/**
 * 「HTML で出力して」と言われた Claude に渡す書き方の指示。
 *
 * ⚠️⚠️ **Claude Desktop には画面の文脈が無い。**
 *   ⚠️ 何も指示しないと、⚠️ **毎回ばらばらの体裁のレポートが出来上がる。**
 *   ⚠️ ⚠️ **ここで形をそろえておくと、過去の分析と読み比べられる。**
 *
 * ⚠️ ⚠️ **1つのファイルで完結させること。**
 *   ⚠️ 画面は iframe の中に本文を流し込むだけで、外部ファイルは読めない。
 */
export const reportSpec = (): Record<string, unknown> => ({
  目的:
    'GET /analysis/competitor で取得したデータをもとに、社内で共有できる分析レポートを' +
    '1枚の HTML として書き、POST /analysis/report で保存する。',

  書き方: [
    '⚠️ HTML・CSS・JavaScript をすべて1つのファイルに収めること。' +
      '外部ファイルは読み込めない（画面は iframe に本文を流し込むだけ）。',
    '⚠️ <script src="..."> による外部の読み込みは使わないこと。' +
      'グラフが必要なら SVG か、インラインの JavaScript で描くこと。',
    '⚠️ 画像は使わないこと。使う場合は data: URI で埋め込むこと。',
    '⚠️ 文字コードは UTF-8。<meta charset="utf-8"> を必ず入れること。',
    '⚠️ 幅は 100% で、横スクロールが出ないようにすること（画面の中に埋め込まれるため）。',
    '⚠️ 印刷されることがある。@media print で背景色が飛んでも読めるようにすること。',
  ],

  構成の目安: [
    '1. 見出しと、分析の対象期間・データの時点',
    '2. 結論（何が起きているか。1〜2段落）',
    '3. 他社別の勝敗表（勝ち / 負け / 敗因の構成 / 負けが出ている店舗）',
    '4. 敗因の構造（価格・土地・性能などの内訳）',
    '5. 勝ちパターン（勝った商談のメモに共通する型）',
    '6. 次の一手（実行できるものに限る）',
  ],

  必ず書くこと: [
    '⚠️ データの時点（いつ取得したデータか）。読む人が最新だと誤解しないようにするため。',
    '⚠️ counts.truncated が true のときは「渡されたデータは全件ではない」と明記すること。' +
      '⚠️ その場合、勝率を全社の実力値として書いてはならない。',
    '⚠️ 失注理由の記録率。⚠️ 空欄が多いのは入力されていないためで、理由が無いという意味ではない。',
    '⚠️ 推測は推測と分かるように書くこと。データから数えられる事実と混ぜないこと。',
  ],

  書いてはいけないこと: [
    '⚠️⚠️ 個人を特定できる情報。データには氏名・電話・メール・住所・物件名は含まれておらず、' +
      'memo の中の **** は伏字である。⚠️ 伏字の中身を推測して書かないこと。',
    '⚠️ 渡されたデータに無い数値。',
  ],

  保存のしかた: {
    endpoint: 'POST /api/v1/analysis/report',
    body: {
      title: '一覧に出す見出し。例: 競合別 勝因・敗因分析（2026年5月期）',
      category: "いまは 'competitor' のみ",
      division: "'order'（注文事業）または 'kaeru'（建売分譲事業）",
      period: '分析の対象期間。例: 2025/06〜2026/05',
      dataAsOf: 'データの時点。YYYY-MM-DD',
      html: '書き上げた HTML の全文',
    },
  },
});
