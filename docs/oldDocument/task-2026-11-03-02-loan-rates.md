# 作業記録 2026-11-03-02　金利データ（v2.2.240）

## 依頼（ReadMeClaude.md）
- 新しいブランチで作業開始（→ `v2.2.240`）
- Downloads/ReadMeClaud の `plan_rates_2026-10.csv`・`plan_rates_2026-11.csv`（Claude デスクトップが集めた商圏内の金融機関のプランデータ）を活用
- `frontend/src/components/header/` に適切な英名のコンポーネントを作る
  - `Header.tsx`：「マーケット情報」の右に**金利データ**のボタン（シアン系。よい案があれば提案）
  - 押したらモーダルではなく App.tsx 内に描く（Market.tsx と同じ UI・UX）
  - Menu.tsx の内容はログインユーザーの category に合わせる
  - ReadMeClaud 内の分析結果 HTML を掲載する（毎月作られる）。既存2レポートを Dashboard のトーンに合わせて改修し、上部に固定ヘッダー（各項目へのアンカー）を付ける。できた HTML は Claude デスクトップに渡して今後のベンチマークにする
  - 必要なテーブルと呼び出し用のバックエンド
- 追記（作業中）：コンポーネント上部にレポート登録用の input
- 追記（作業中）：`callq/UsedCallQueue.tsx` の mine の初期値を false に

## 決めたこと（2026-11-03 に利用者に確認）
| 項目 | 決定 |
|---|---|
| ボタンの色 | 濃いシアン **#0891b2**＋白い文字（bg-info #0dcaf0 は白い文字だとコントラストが足りない） |
| 毎月の登録 | **画面から Master が登録**（CSV と HTML。片方だけでも可） |
| 見せる範囲 | **全員**（マーケット情報と同じ） |

## 調べたこと
- `plan_rates_YYYY-MM.csv`：列 `g,id,fi,plan,rtype,term,feeType,dan,cond,rate,base,prev,asof,url,conf`。10月 1,079行・11月 1,104行（32金融機関・34商品）。rate が空の行が各月2行。数値の列に数字以外は無い
- 既存の `loan_product` / `loan_rate`（v2.2.168）は資金計画書の商品単位の金利（33商品）。今回のプラン別とは別物なので触らない
- 分析レポートは `rate_analysis_2026-10/11.html`（各約350KB）。`金利分析レポート_*.html` は同じ中身を別ツールで包んだ版
- HTML の保存先は既存の `analysis_report`（2026-09-21 追加。上限2MB・iframe の sandbox 表示）を category = 'loan_rate' で使う

## 変更したファイル
| ディレクトリ | ファイル | 内容 |
|---|---|---|
| backend/scripts/sql/ | **2026-11-03_loan_plan_rate.sql（新規）** | 表 `loan_plan_rate`（月 × CSV の15列。UNIQUE(month, line)） |
| backend/scripts/sql/ | **2026-11-03_loan_plan_rate_seed.sql（新規）** | 10月・11月の初期データ（月ごとに DELETE → INSERT。CSV から生成。約660KB） |
| backend-express/src/features/ | **loanPlanRate.ts（新規）** | `listLoanPlanRates`・`uploadLoanPlanRates` |
| backend-express/src/gateway/ | registry.ts | `loan_plan_rate_list`（staff）・`loan_plan_rate_upload`（master） |
| backend/src/core/ | express_proxy.php | 2つを `expressProxyRequests()` と `expressProxyExclusive()` の両方に |
| frontend/src/components/header/ | **LoanRates.tsx（新規）** | 画面本体（プラン別金利・分析レポートのタブ） |
| frontend/src/components/header/ | **LoanRateUpload.tsx（新規）** | 上部の「月のデータを登録」（Master だけ） |
| frontend/src/components/header/ | Header.tsx | 「マーケット情報」の右に「金利データ」 |
| frontend/src/ | App.tsx | ルート `/loanRates` |
| frontend/src/components/guide/ | guideScreens.ts | `'金利データ': { route: '/loanRates' }` |
| frontend/src/components/callq/ | UsedCallQueue.tsx | 「自分の担当のみ」の初期値を false |
| frontend/src/utils/ | version.ts | 2.2.240 |
| backend/scripts/guide/articles/common/ | **screen-185.md（新規）**・screen-180.md | 「金利データ」を追加・「業務ガイドの使い方」の開き方の記述を直した |
| backend/scripts/guide/articles/used/ | screen-050.md | 「今日の架電キュー（中古リノベ）」に、はじめは全員の分が出ることを追記 |
| backend/scripts/sql/ | **2026-11-03_update_log_2.2.240.sql（新規）** | 更新履歴＋業務ガイド3本（ローカルに流した。no = 339） |
| docs/ | deploy-v2.2.240.md（新規） | デプロイ手順 |

### リポジトリの外（Downloads/ReadMeClaud。新規作成。元ファイルは変更していない）
- `rate_analysis_2026-10_dashboard.html`（347,395 バイト）・`rate_analysis_2026-11_dashboard.html`（359,054 バイト）
  - Dashboard（GoogleReview.tsx）の色・文字・カード・表に合わせ、上部に固定ヘッダー（レポート名・対象月・各 h2 へのアンカー。今いる節を強調）
  - 内容（文章・数値・埋め込みデータ・スクリプト）は変えていない（元と新を描画して本文の文字が一致することを確認）
  - 外部読み込み（Google Fonts）をやめ、CSP の meta を入れた（iframe の中で自己完結）
- `rate_report_benchmark_instructions.txt`：Claude デスクトップに渡す、今後の月次レポートの作り方（お手本・見た目のルール・iframe の制約・ファイル名・手順・Dashboard への登録）
- ⚠️ 10月版の見出しは9個（元のファイルのとおり）。11月版は10個

## 仕組み
- **読み出し（loan_plan_rate_list）**：登録済みの月（新しい順・件数）、指定した月の行（CSV の並び）、category = 'loan_rate' のレポートの一覧（本文なし）。月の指定が無い・登録の無い月なら最新の月
- **登録（loan_plan_rate_upload）**：月（YYYY-MM）と CSV の行。全行を検査し（fi・plan 必須、rate/base/prev は空か 0〜20 の数字）、1行でも誤りがあれば何も書かない。正しければ1つのトランザクションで、その月を DELETE して 200行ずつ INSERT
- **画面**：上部に登録欄（Master だけ。対象月はファイル名の YYYY-MM から自動）→ タブ（プラン別金利／分析レポート）と対象月
  - プラン別金利：絞り込み（区分・金融機関・金利タイプ・固定期間・手数料の型・団信・確かさ・キーワード・前月から動いたものだけ）、KPI（プラン数・変動の最低・10年固定の最低・上がった／下がった件数。絞り込み後）、表（見出しで並べ替え。差は赤＝上昇・青＝下落。金融機関名で出典を開く）
  - 分析レポート：その月の最新の版を iframe で表示（同じ月に複数あれば「版」で選ぶ）。⚠️ sandbox は `allow-scripts allow-popups allow-popups-to-escape-sandbox`（台帳の出典リンクを開くため。⚠️ allow-same-origin は付けない）
  - HTML の登録は既存の `analysis_report_upload`（reportCategory = 'loan_rate'・period = 月・dataAsOf = 月の初日）

## テスト（ローカル）
- ② 型チェック・フロント `npm run build` とも通過（新しいファイルに警告なし）
- ① 経由：トークン無しで list・upload とも **401**。Manager の登録は **403**、読み出しは 200
  - list：11月 1,104行・10月 1,079行。⚠️ 11月の全行を CSV と照合して食い違い 0
  - upload：新しい月 1,104行、同じ月の再登録で 1,104行を入れ替え。誤りのある行（`1,25`・空の fi・`125`）→ 何も書かずに3行の誤りを返す。不正な月・空の行も拒否。⚠️ 試験の月（2026-12）は消した
  - KPI の数字（上がった332・下がった460・変動の最低 1.05%）は CSV から別に数えて一致
- Playwright（3100。注文・建売・中古で表示）：ヘッダーのボタンの位置と色・`/loanRates`・左のメニューが事業区分のまま・絞り込み・並べ替え・月の切り替え・登録欄から HTML 2本を登録（ローカルの analysis_report no 6・7）・レポートの表示とアンカー・スマホ幅（はみ出しなし）・コンソールエラーなし
  - 見つけて直したもの：レポートの dataAsOf に 'YYYY-MM' を送って DATE 列で 500（→ 月の初日）／プラン名の列が狭く折り返しすぎ／対象月の選択欄で件数が切れる／レポートのタブを開いた直後に「読み込めませんでした」が一瞬出る
- 架電キュー：初期表示で「自分の担当のみ」が外れ、全員の2件が出る

## リファクタリング
- loanPlanRate.ts の使っていない定数（`PLAN_CSV_COLUMNS`）を消し、外から使っていない export（`LOAN_REPORT_CATEGORY`・`PlanRateRow`）を外した。整理のあと ① 経由と Playwright をもう一度通した

## 残っていること・気になること
- 11月の CSV に、前月比 +1.35% のように大きく動いたプラン（15年固定など）がある。CSV の prev（Claude デスクトップの照合）の誤りの可能性があるので、データ側の確認が要る
- 本番のレポート2本は、デプロイ後に画面から登録する（deploy-v2.2.240.md の手順6）

---

## コード（新規ファイルは全文）

### backend-express/src/features/loanPlanRate.ts

```tsx
import type { RowDataPacket } from 'mysql2/promise';
import { query, withTransaction } from '../db/pool';
import type { SqlParam } from '../db/pool';
import { listReports } from './analysis/report';

/**
 * 商圏内の金融機関のプラン別金利（loan_plan_rate）。v2.2.240 新規。
 *
 * ─────────────────────────────────────────────
 *   loan_plan_rate_list   … 登録済みの月・指定した月の行・その月までの分析レポートの一覧（⚠️ 全員が読める）
 *   loan_plan_rate_upload … plan_rates_YYYY-MM.csv の内容で、その月を丸ごと入れ替える（⚠️ Master だけ）
 *
 *   画面: frontend/src/components/header/LoanRates.tsx
 *   表  : backend/scripts/sql/2026-11-03_loan_plan_rate.sql
 *
 * ⚠️ 列名は CSV の見出しと同じ（g,id,fi,plan,rtype,term,feeType,dan,cond,rate,base,prev,asof,url,conf）。⚠️ 改名しないこと。
 * ⚠️ 資金計画書の金利（loanRate.ts。loan_product / loan_rate）とは別物。⚠️ ここから計画書の金利は書き換えない。
 * ⚠️ 分析レポート（HTML）は analysis_report（category = 'loan_rate'・period = 'YYYY-MM'）。
 *   ⚠️ 登録・本文の取得は既存の analysis_report_upload / analysis_report_get を使う。
 * ─────────────────────────────────────────────
 */

/** 分析レポートの種類（analysis_report.category） */
const LOAN_REPORT_CATEGORY = 'loan_rate';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/** ⚠️ 一度に受ける行数の上限（今は約1,100行。⚠️ 誤って巨大なファイルを送られたときの歯止め） */
const MAX_ROWS = 5000;
/** 1回の INSERT に入れる行数（⚠️ プレースホルダーが増えすぎないように） */
const CHUNK = 200;

interface PlanRateRow {
  line: number;
  g: string;
  id: string;
  fi: string;
  plan: string;
  rtype: string;
  term: string;
  feeType: string;
  dan: string;
  cond: string;
  rate: number | null;
  base: number | null;
  prev: number | null;
  asof: string;
  url: string;
  conf: string;
}

interface DbRow extends RowDataPacket {
  line: number;
  g: string; id: string; fi: string; plan: string; rtype: string; term: string; feeType: string; dan: string; cond: string;
  rate: string | null; base: string | null; prev: string | null;
  asof: string; url: string; conf: string;
}

interface MonthRow extends RowDataPacket {
  month: string;
  rows_count: number;
  updated: string;
}

/** ⚠️ DECIMAL は文字列で返るので数値に戻す。NULL はそのまま */
const toNumber = (v: string | null): number | null => (v === null ? null : Number(v));

/** 登録済みの月（新しい順） */
const loadMonths = async (): Promise<{ month: string; rows: number; updated: string }[]> =>
  (await query<MonthRow>(
    `SELECT month, COUNT(*) AS rows_count, DATE_FORMAT(MAX(created_at), '%Y-%m-%d %H:%i') AS updated
       FROM loan_plan_rate GROUP BY month ORDER BY month DESC`
  )).map((r) => ({ month: r.month, rows: Number(r.rows_count), updated: r.updated }));

/**
 * 一覧。⚠️ month が無い・登録の無い月なら、いちばん新しい月。
 * ⚠️ 前月比は CSV の prev 列をそのまま使う（Claude デスクトップが同じプランを照合して入れている。⚠️ ここで前月の行と突き合わせない）。
 */
export const listLoanPlanRates = async (body: { month?: unknown }): Promise<Record<string, unknown>> => {
  const months = await loadMonths();
  const asked = String(body.month ?? '');
  const month = months.some((m) => m.month === asked) ? asked : (months[0]?.month ?? '');
  const rows = month === ''
    ? []
    : (await query<DbRow>(
      `SELECT line, g, id, fi, plan, rtype, term, feeType, dan, cond, rate, base, prev, asof, url, conf
         FROM loan_plan_rate WHERE month = ? ORDER BY line`,
      [month]
    )).map((r): PlanRateRow => ({
      line: Number(r.line), g: r.g, id: r.id, fi: r.fi, plan: r.plan, rtype: r.rtype, term: r.term, feeType: r.feeType,
      dan: r.dan, cond: r.cond, rate: toNumber(r.rate), base: toNumber(r.base), prev: toNumber(r.prev),
      asof: r.asof, url: r.url, conf: r.conf,
    }));
  // ⚠️ 本文は含まない（一覧だけ。本文は analysis_report_get で開くときに取る）
  const reports = (await listReports(LOAN_REPORT_CATEGORY)).map((r) => ({
    no: Number(r.no), title: String(r.title ?? ''), period: String(r.period ?? ''), created: String(r.created ?? ''),
  }));
  return { status: 'ok', month, months, rows, reports };
};

// ---------------------------------------------------------------------------
// 登録
// ---------------------------------------------------------------------------

/** 文字列にして前後の空白を落とし、長さで切る（loanRate.ts と同じ） */
const text = (value: unknown, max: number): string =>
  String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

/** 金利の列。⚠️ 空は null。⚠️ 数字以外・0 以下・20 以上は誤り（undefined） */
const rateOf = (value: unknown): number | null | undefined => {
  const s = String(value ?? '').replace(/[%％\s]/g, '');
  if (s === '') return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Number(s);
  return n > 0 && n < 20 ? n : undefined;
};

export interface PlanUploadResult {
  status: 'ok' | 'error';
  message?: string;
  errors?: { line: number; message: string }[];
  rows?: number;
  replaced?: number;
}

/**
 * plan_rates_YYYY-MM.csv の内容で、その月を丸ごと入れ替える。
 * ⚠️ 全行が正しいときだけ書く（1行でも誤りがあれば何も書かない）。⚠️ 入れ替えは1つのトランザクション。
 * ⚠️ 本文: month（YYYY-MM）・rows（CSV の行のオブジェクトの配列。キーは見出し）。
 */
export const uploadLoanPlanRates = async (body: { month?: unknown; rows?: unknown }, staffName: string): Promise<PlanUploadResult> => {
  const month = text(body.month, 7);
  if (!MONTH_PATTERN.test(month)) return { status: 'error', message: '対象月を正しく指定してください（例: 2026-11）。' };
  if (!Array.isArray(body.rows) || body.rows.length === 0) return { status: 'error', message: 'CSV にプランの行がありません。' };
  if (body.rows.length > MAX_ROWS) return { status: 'error', message: `行が多すぎます（上限 ${MAX_ROWS} 行）。` };

  const errors: { line: number; message: string }[] = [];
  const values: SqlParam[][] = [];
  body.rows.forEach((raw, i) => {
    const line = i + 2;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({ line, message: '行の形式が正しくありません' });
      return;
    }
    const r = raw as Record<string, unknown>;
    const fi = text(r.fi, 191);
    const plan = text(r.plan, 255);
    if (fi === '') { errors.push({ line, message: '金融機関名（fi）が空です' }); return; }
    if (plan === '') { errors.push({ line, message: 'プラン名（plan）が空です' }); return; }
    const nums = (['rate', 'base', 'prev'] as const).map((c) => [c, rateOf(r[c])] as const);
    const bad = nums.find(([, v]) => v === undefined);
    if (bad) { errors.push({ line, message: `${bad[0]} が正しくありません（数字のみ・0より大きく20未満）: ${String(r[bad[0]] ?? '')}` }); return; }
    const [rate, base, prev] = nums.map(([, v]) => v as number | null);
    values.push([
      month, line, text(r.g, 64), text(r.id, 64), fi, plan, text(r.rtype, 32), text(r.term, 16), text(r.feeType, 32),
      text(r.dan, 64), text(r.cond, 255), rate, base, prev, text(r.asof, 16), text(r.url, 255), text(r.conf, 16), staffName || '不明',
    ]);
  });
  if (errors.length > 0) return { status: 'error', message: `${errors.length} 行に誤りがあります。何も登録していません。`, errors };

  return withTransaction(async (tx) => {
    const removed = await tx.execute('DELETE FROM loan_plan_rate WHERE month = ?', [month]);
    for (let i = 0; i < values.length; i += CHUNK) {
      const part = values.slice(i, i + CHUNK);
      await tx.execute(
        `INSERT INTO loan_plan_rate (month, line, g, id, fi, plan, rtype, term, feeType, dan, cond, rate, base, prev, asof, url, conf, created_by)
         VALUES ${part.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
        part.flat()
      );
    }
    return { status: 'ok', rows: values.length, replaced: removed.affectedRows };
  });
};
```

### frontend/src/components/header/LoanRates.tsx

```tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Form } from 'react-bootstrap';
import AuthContext from '../../context/AuthContext';
import apiClient from '../../utils/apiClient';
import LoanRateUpload, { monthLabel } from './LoanRateUpload';

/**
 * 金利データ（v2.2.240）。ヘッダーの「金利データ」（マーケット情報の右）から開く。⚠️ Market.tsx と同じく App.tsx の中に描く（/loanRates）。
 *
 * ⚠️ 中身は Claude デスクトップが毎月集める商圏内の金融機関のプラン別金利（loan_plan_rate）と、その月の分析レポート（analysis_report の category = 'loan_rate'）。
 *   読み出しは ② の loan_plan_rate_list（features/loanPlanRate.ts）、レポートの本文は analysis_report_get。
 * ⚠️ 資金計画書の金利（システム管理 → ローン情報更新。loan_rate）とは別物。
 * ⚠️ 見た目は GoogleReview.tsx に合わせる（接頭辞 lr_）。⚠️ 前月比は CSV の prev 列（Claude デスクトップが照合した前月の値）。
 * ⚠️⚠️ レポートは iframe の sandbox に出す（allow-scripts と、出典リンク用の allow-popups 系だけ。⚠️ allow-same-origin を付けるとレポートの中からログイン情報を読める）。
 */

type PlanRow = {
    line: number; g: string; id: string; fi: string; plan: string; rtype: string; term: string; feeType: string; dan: string; cond: string;
    rate: number | null; base: number | null; prev: number | null; asof: string; url: string; conf: string;
};
type MonthInfo = { month: string; rows: number; updated: string };
type ReportInfo = { no: number; title: string; period: string; created: string };
type ListBody = { status?: string; message?: string; month: string; months: MonthInfo[]; rows: PlanRow[]; reports: ReportInfo[] };
type SortKey = 'g' | 'fi' | 'plan' | 'rtype' | 'term' | 'feeType' | 'dan' | 'rate' | 'prev' | 'diff' | 'base' | 'spread';
type Filter = { g: string; fi: string; rtype: string; term: string; feeType: string; dan: string; conf: string; q: string; changed: boolean };

const EMPTY_FILTER: Filter = { g: '', fi: '', rtype: '', term: '', feeType: '', dan: '', conf: '', q: '', changed: false };
const CONF_LABEL: Record<string, string> = { official: '公式', calc: '計算', comparison: '比較サイト' };
/** 差の表示の下限（⚠️ 0.0005 未満は「変わらない」） */
const EPS = 0.0005;

const fmt = (v: number | null): string => (v === null ? '―' : v.toFixed(3));
const diffOf = (r: PlanRow): number | null => (r.rate === null || r.prev === null ? null : r.rate - r.prev);
const spreadOf = (r: PlanRow): number | null => (r.rate === null || r.base === null ? null : r.base - r.rate);
const uniq = (list: string[]): string[] => Array.from(new Set(list.filter((v) => v !== '')));
const termLabel = (t: string): string => (t === '' ? '―' : `${t}年`);

const LoanRates: React.FC = () => {
    const { authority } = useContext(AuthContext);
    const [data, setData] = useState<ListBody | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<'plans' | 'report'>('plans');
    const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
    const [sortKey, setSortKey] = useState<SortKey>('rate');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [reportNo, setReportNo] = useState<number | null>(null);
    const [reportHtml, setReportHtml] = useState('');
    const [reportLoading, setReportLoading] = useState(false);
    const [reportError, setReportError] = useState(false);

    const load = useCallback(async (month: string) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post<ListBody>('', { request: 'loan_plan_rate_list', month });
            if (res.data?.status !== 'ok') throw new Error(res.data?.message || '読み込めませんでした');
            setData(res.data);
        } catch (e) {
            console.error('金利データの読み込みに失敗しました:', e);
            setError('金利データを読み込めませんでした。時間をおいて再度お試しください。');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(''); }, [load]);

    const month = data?.month ?? '';
    const rows = useMemo(() => data?.rows ?? [], [data]);
    /** その月のレポート（新しい順）。⚠️ 同じ月を出し直したら新しい方が先 */
    const monthReports = useMemo(
        () => (data?.reports ?? []).filter((r) => r.period === month).sort((a, b) => b.no - a.no),
        [data, month]
    );

    // 月を変えたら、その月のいちばん新しいレポートを選び直す
    useEffect(() => { setReportNo(monthReports[0]?.no ?? null); }, [monthReports]);

    useEffect(() => {
        if (tab !== 'report' || reportNo === null) { setReportHtml(''); return; }
        let alive = true;
        setReportLoading(true);
        setReportError(false);
        apiClient.post('', { request: 'analysis_report_get', no: reportNo })
            .then((res) => {
                if (!alive) return;
                const html = String(res.data?.report?.html ?? '');
                setReportHtml(html);
                setReportError(html === '');
            })
            .catch((e) => { console.error('レポートの読み込みに失敗しました:', e); if (alive) { setReportHtml(''); setReportError(true); } })
            .finally(() => { if (alive) setReportLoading(false); });
        return () => { alive = false; };
    }, [tab, reportNo]);

    const options = useMemo(() => ({
        g: uniq(rows.map((r) => r.g)),
        fi: uniq(rows.filter((r) => filter.g === '' || r.g === filter.g).map((r) => r.fi)),
        rtype: uniq(rows.map((r) => r.rtype)),
        term: uniq(rows.map((r) => r.term)).sort((a, b) => Number(a) - Number(b)),
        feeType: uniq(rows.map((r) => r.feeType)),
        dan: uniq(rows.map((r) => r.dan)),
        conf: uniq(rows.map((r) => r.conf)),
    }), [rows, filter.g]);

    const filtered = useMemo(() => {
        const q = filter.q.trim().toLowerCase();
        return rows.filter((r) =>
            (filter.g === '' || r.g === filter.g) && (filter.fi === '' || r.fi === filter.fi) && (filter.rtype === '' || r.rtype === filter.rtype)
            && (filter.term === '' || r.term === filter.term) && (filter.feeType === '' || r.feeType === filter.feeType)
            && (filter.dan === '' || r.dan === filter.dan) && (filter.conf === '' || r.conf === filter.conf)
            && (!filter.changed || Math.abs(diffOf(r) ?? 0) >= EPS)
            && (q === '' || `${r.fi} ${r.plan} ${r.cond}`.toLowerCase().includes(q)));
    }, [rows, filter]);

    const sorted = useMemo(() => {
        const valueOf = (r: PlanRow): string | number | null => {
            if (sortKey === 'diff') return diffOf(r);
            if (sortKey === 'spread') return spreadOf(r);
            if (sortKey === 'term') return r.term === '' ? null : Number(r.term);
            return r[sortKey];
        };
        const dir = sortOrder === 'asc' ? 1 : -1;
        // ⚠️ 値の無い行（金利が空など）はどちらの向きでも最後
        return [...filtered].sort((a, b) => {
            const x = valueOf(a);
            const y = valueOf(b);
            if (x === null || x === '') return y === null || y === '' ? a.line - b.line : 1;
            if (y === null || y === '') return -1;
            const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ja');
            return c === 0 ? a.line - b.line : c * dir;
        });
    }, [filtered, sortKey, sortOrder]);

    /** KPI（⚠️ 絞り込み後の行で数える） */
    const kpi = useMemo(() => {
        const best = (pred: (r: PlanRow) => boolean) => filtered.filter((r) => pred(r) && r.rate !== null)
            .reduce<PlanRow | null>((min, r) => (min === null || (r.rate as number) < (min.rate as number) ? r : min), null);
        const diffs = filtered.map(diffOf).filter((d): d is number => d !== null);
        return {
            plans: filtered.length,
            fis: uniq(filtered.map((r) => r.fi)).length,
            variable: best((r) => r.rtype === '変動'),
            fixed10: best((r) => r.term === '10' && r.rtype !== '変動'),
            up: diffs.filter((d) => d >= EPS).length,
            down: diffs.filter((d) => d <= -EPS).length,
        };
    }, [filtered]);

    const setF = (patch: Partial<Filter>) => setFilter((prev) => ({ ...prev, ...patch }));

    const SortHead = ({ label, keyName, align = 'left', width }: { label: string; keyName: SortKey; align?: 'left' | 'center' | 'right'; width?: string }) => {
        const active = sortKey === keyName;
        return (
            <th className={`lr_th lr_th_sort text-${align}`} style={{ width }} title="クリックで並べ替え"
                onClick={() => {
                    if (active) setSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(keyName); setSortOrder(keyName === 'rate' || keyName === 'base' ? 'asc' : 'desc'); }
                }}>
                {label}<span className={`lr_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const select = (label: string, key: keyof Omit<Filter, 'q' | 'changed'>, list: string[], width: number, show: (v: string) => string = (v) => v) => (
        <div>
            <div className="lr_label">{label}</div>
            <Form.Select size="sm" value={filter[key]} style={{ width, fontSize: '12px' }}
                onChange={(e) => setF(key === 'g' ? { g: e.target.value, fi: '' } : { [key]: e.target.value } as Partial<Filter>)}>
                <option value="">すべて</option>
                {list.map((v) => <option key={v} value={v}>{show(v)}</option>)}
            </Form.Select>
        </div>
    );

    const bestText = (r: PlanRow | null) => (r === null ? '―' : <>{fmt(r.rate)}<small>%</small><div className="lr_kpi_sub">{r.fi}</div></>);

    return (
        <div className="content">
            <div className="lr_wrap">
                <style>{STYLE}</style>
                <div className="lr_inner">
                    <div className="lr_head mb-2">
                        <span className="lr_title"><i className="fa-solid fa-percent me-2" style={{ color: '#0891b2' }} aria-hidden="true" />金利データ</span>
                        <span className="lr_note">※ 商圏内の金融機関の住宅ローン金利（プラン別）。Claude デスクトップが毎月、各金融機関の公式サイトなどから集めたものです</span>
                    </div>

                    {authority === 'Master' && <LoanRateUpload onSaved={(m) => void load(m)} />}

                    {error !== '' && <div className="alert alert-danger" style={{ fontSize: '13px' }}>{error}</div>}

                    <div className="lr_tabs mb-3" role="tablist">
                        <button type="button" role="tab" aria-selected={tab === 'plans'} className={`lr_tab${tab === 'plans' ? ' is_active' : ''}`} onClick={() => setTab('plans')}>
                            <i className="fa-solid fa-table-list me-1" aria-hidden="true" />プラン別金利
                        </button>
                        <button type="button" role="tab" aria-selected={tab === 'report'} className={`lr_tab${tab === 'report' ? ' is_active' : ''}`} onClick={() => setTab('report')}>
                            <i className="fa-solid fa-chart-line me-1" aria-hidden="true" />分析レポート
                        </button>
                        <div className="ms-auto d-flex align-items-center gap-2">
                            <span className="lr_label mb-0">対象月</span>
                            <Form.Select size="sm" value={month} style={{ width: 190, fontSize: '12px' }} disabled={loading || (data?.months.length ?? 0) === 0}
                                onChange={(e) => void load(e.target.value)} aria-label="対象月">
                                {(data?.months ?? []).map((m) => <option key={m.month} value={m.month}>{monthLabel(m.month)}（{m.rows}件）</option>)}
                            </Form.Select>
                        </div>
                    </div>

                    {loading && data === null ? (
                        <div className="text-center py-5"><div className="spinner-border" style={{ color: '#0891b2' }} role="status"><span className="visually-hidden">読み込み中</span></div></div>
                    ) : data !== null && data.months.length === 0 ? (
                        <div className="lr_caution">金利データがまだ登録されていません。</div>
                    ) : tab === 'plans' ? (
                        <>
                            <div className="lr_bar mb-3">
                                {select('区分', 'g', options.g, 150)}
                                {select('金融機関', 'fi', options.fi, 170)}
                                {select('金利タイプ', 'rtype', options.rtype, 130)}
                                {select('固定期間', 'term', options.term, 100, termLabel)}
                                {select('手数料の型', 'feeType', options.feeType, 130)}
                                {select('団信', 'dan', options.dan, 150)}
                                {select('確かさ', 'conf', options.conf, 110, (v) => CONF_LABEL[v] ?? v)}
                                <div>
                                    <div className="lr_label">キーワード</div>
                                    <Form.Control size="sm" value={filter.q} placeholder="金融機関・プラン・条件" style={{ width: 190, fontSize: '12px' }}
                                        onChange={(e) => setF({ q: e.target.value })} />
                                </div>
                                <label className="lr_check">
                                    <input type="checkbox" checked={filter.changed} onChange={(e) => setF({ changed: e.target.checked })} /> 前月から動いたものだけ
                                </label>
                                <button type="button" className="btn btn-sm btn-link lr_clear" onClick={() => setFilter(EMPTY_FILTER)}>絞り込みを外す</button>
                            </div>

                            <div className="lr_kpi mb-3">
                                <div className="lr_kpi_card"><div className="lr_kpi_label">プラン数</div><div className="lr_kpi_value">{kpi.plans.toLocaleString()}<small>件</small><div className="lr_kpi_sub">{kpi.fis}金融機関</div></div></div>
                                <div className="lr_kpi_card"><div className="lr_kpi_label">変動の最も低い金利</div><div className="lr_kpi_value lr_accent">{bestText(kpi.variable)}</div></div>
                                <div className="lr_kpi_card"><div className="lr_kpi_label">10年固定の最も低い金利</div><div className="lr_kpi_value lr_accent">{bestText(kpi.fixed10)}</div></div>
                                <div className="lr_kpi_card"><div className="lr_kpi_label">前月から上がったプラン</div><div className="lr_kpi_value lr_up">{kpi.up}<small>件</small></div></div>
                                <div className="lr_kpi_card"><div className="lr_kpi_label">前月から下がったプラン</div><div className="lr_kpi_value lr_down">{kpi.down}<small>件</small></div></div>
                            </div>

                            <div className="lr_caution mb-2">
                                金利は各金融機関の最も条件の良い優遇後の値です。審査・物件・団信の種類で変わるため、お客様にお伝えする前に必ず公式サイトか窓口で確かめてください。
                                「確かさ」が<b>計算</b>の行は店頭金利と引下げ幅からの計算値、<b>比較サイト</b>の行は比較サイトの値です。前月は Claude デスクトップが前月の同じプランと照合した値です。
                            </div>

                            <div className="lr_table_wrap">
                                <table className="lr_table">
                                    <thead>
                                        <tr>
                                            <SortHead label="区分" keyName="g" width="120px" />
                                            <SortHead label="金融機関" keyName="fi" width="140px" />
                                            <SortHead label="プラン" keyName="plan" />
                                            <SortHead label="タイプ" keyName="rtype" width="100px" />
                                            <SortHead label="期間" keyName="term" align="right" width="64px" />
                                            <SortHead label="手数料の型" keyName="feeType" width="96px" />
                                            <SortHead label="団信" keyName="dan" width="96px" />
                                            <SortHead label="金利" keyName="rate" align="right" width="76px" />
                                            <SortHead label="前月" keyName="prev" align="right" width="70px" />
                                            <SortHead label="差" keyName="diff" align="right" width="72px" />
                                            <SortHead label="店頭" keyName="base" align="right" width="70px" />
                                            <SortHead label="引下げ幅" keyName="spread" align="right" width="84px" />
                                            <th className="lr_th" style={{ width: '86px' }}>確かさ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sorted.length === 0 ? (
                                            <tr><td className="lr_td lr_empty text-center py-4" colSpan={13}>該当するプランがありません</td></tr>
                                        ) : sorted.map((r) => {
                                            const d = diffOf(r);
                                            const s = spreadOf(r);
                                            return (
                                                <tr key={r.line} className="lr_row">
                                                    <td className="lr_td"><span className="lr_tag">{r.g}</span></td>
                                                    <td className="lr_td lr_fi">{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="lr_link" title="出典を開く">{r.fi}</a> : r.fi}</td>
                                                    <td className="lr_td lr_plan"><div>{r.plan}</div>{r.cond && <div className="lr_cond">{r.cond}</div>}</td>
                                                    <td className="lr_td">{r.rtype}</td>
                                                    <td className="lr_td text-end lr_num">{termLabel(r.term)}</td>
                                                    <td className="lr_td">{r.feeType}</td>
                                                    <td className="lr_td">{r.dan}</td>
                                                    <td className="lr_td text-end lr_num lr_rate">{fmt(r.rate)}</td>
                                                    <td className="lr_td text-end lr_num lr_muted">{fmt(r.prev)}</td>
                                                    <td className={`lr_td text-end lr_num ${d === null || Math.abs(d) < EPS ? 'lr_muted' : d > 0 ? 'lr_up' : 'lr_down'}`}>
                                                        {d === null ? '―' : Math.abs(d) < EPS ? '±0' : `${d > 0 ? '+' : ''}${d.toFixed(3)}`}
                                                    </td>
                                                    <td className="lr_td text-end lr_num lr_muted">{fmt(r.base)}</td>
                                                    <td className="lr_td text-end lr_num">{s === null ? '―' : s.toFixed(3)}</td>
                                                    <td className="lr_td"><span className={`lr_conf lr_conf_${r.conf}`}>{CONF_LABEL[r.conf] ?? r.conf}</span>{r.asof && <div className="lr_cond">{r.asof}</div>}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="lr_note mt-1">{sorted.length.toLocaleString()}件を表示（{monthLabel(month)}・全{rows.length.toLocaleString()}件）。並べ替えは見出しをクリック。金融機関名を押すと出典が開きます</div>
                        </>
                    ) : (
                        <div className="lr_report">
                            {monthReports.length === 0 ? (
                                <div className="lr_caution">{monthLabel(month)}の分析レポートはまだ登録されていません。</div>
                            ) : (
                                <>
                                    {monthReports.length > 1 && (
                                        <div className="d-flex align-items-center gap-2 mb-2">
                                            <span className="lr_label mb-0">版</span>
                                            <Form.Select size="sm" value={reportNo ?? ''} style={{ width: 320, fontSize: '12px' }} onChange={(e) => setReportNo(Number(e.target.value))}>
                                                {monthReports.map((r, i) => <option key={r.no} value={r.no}>{r.title}（{r.created}{i === 0 ? '・最新' : ''}）</option>)}
                                            </Form.Select>
                                        </div>
                                    )}
                                    {reportError ? (
                                        <div className="lr_caution">レポートを読み込めませんでした。時間をおいて再度お試しください。</div>
                                    ) : reportLoading || reportHtml === '' ? (
                                        <div className="text-center py-5"><div className="spinner-border" style={{ color: '#0891b2' }} role="status"><span className="visually-hidden">読み込み中</span></div></div>
                                    ) : (
                                        /* ⚠️⚠️ allow-same-origin は付けないこと（付けるとレポートの中からログイン情報を読める）。
                                           ⚠️ allow-popups 系は、台帳の出典リンク（target="_blank"）を別タブで開くため。開いた先は普通のページとして開く */
                                        <iframe title={`金利分析レポート ${monthLabel(month)}`} className="lr_iframe" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" srcDoc={reportHtml} />
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/** ⚠️ このコンポーネント専用（接頭辞 lr_）。⚠️ 登録欄（LoanRateUpload.tsx）もこのスタイルを使う */
const STYLE = `
.lr_wrap { font-size: 13px; color: #1f2937; padding: 16px 24px 24px; box-sizing: border-box; }
.lr_inner { width: 100%; max-width: 1500px; margin: 0 auto; }
.lr_head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.lr_title { font-weight: 700; font-size: 15px; letter-spacing: .02em; }
.lr_note { font-size: 11px; color: #6b7280; }
.lr_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
.lr_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
.lr_check { font-size: 12px; color: #374151; display: flex; align-items: center; gap: 4px; padding-bottom: 5px; cursor: pointer; }
.lr_clear { font-size: 11px; padding-bottom: 5px; color: #0891b2; }
.lr_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
.lr_kpi_card { flex: 1 1 170px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
.lr_kpi_label { font-size: 11px; color: #6b7280; }
.lr_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
.lr_kpi_value small { font-size: 11px; font-weight: 400; color: #6b7280; margin-left: 2px; }
.lr_kpi_sub { font-size: 11px; font-weight: 400; color: #6b7280; }
.lr_accent { color: #0e7490; }
.lr_up { color: #b91c1c; } .lr_down { color: #1d4ed8; }
.lr_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; }
.lr_tabs { display: flex; align-items: flex-end; gap: 4px; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
.lr_tab { border: 1px solid transparent; border-bottom: none; background: none; padding: 7px 14px; font-size: 12px; font-weight: 700; color: #6b7280; border-radius: 8px 8px 0 0; margin-bottom: -1px; }
.lr_tab:hover { color: #0e7490; }
.lr_tab.is_active { color: #0e7490; background: #fff; border-color: #e5e7eb; box-shadow: inset 0 2px 0 #0891b2; }
.lr_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; max-height: calc(100vh - 220px); min-height: 320px; }
.lr_table { width: 100%; min-width: 1280px; border-collapse: separate; border-spacing: 0; font-size: 12px; }
.lr_plan { min-width: 260px; }
.lr_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; }
.lr_th_sort { cursor: pointer; user-select: none; }
.lr_th_sort:hover { background: #eef2f7; }
.lr_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
.lr_sort_icon.is_active { color: #0891b2; }
.lr_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; }
.lr_row:hover > .lr_td { background: #f8fafc; }
.lr_fi { font-weight: 700; }
.lr_num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.lr_rate { font-size: 13px; font-weight: 700; color: #0e7490; }
.lr_muted { color: #9ca3af; }
.lr_cond { font-size: 10px; color: #9ca3af; margin-top: 1px; }
.lr_tag { font-size: 10px; color: #4b5563; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.lr_conf { font-size: 10px; border-radius: 999px; padding: 1px 7px; white-space: nowrap; background: #f3f4f6; color: #4b5563; }
.lr_conf_official { background: #cffafe; color: #155e75; }
.lr_conf_comparison { background: #fef3c7; color: #92400e; }
.lr_link { color: #1f2937; text-decoration: none; }
.lr_link:hover { color: #0891b2; text-decoration: underline; }
.lr_empty { color: #9ca3af; font-size: 12px; }
.lr_iframe { width: 100%; height: calc(100vh - 190px); min-height: 480px; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; }
.lr_upload { background: #ecfeff; border: 1px solid #a5f3fc; border-radius: 10px; padding: 10px 12px; }
.lr_upload_head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.lr_upload_title { font-size: 12px; font-weight: 700; color: #155e75; }
.lr_badge { font-size: 9px; color: #fff; background: #0d6efd; border-radius: 4px; padding: 1px 5px; }
.lr_upload_row { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
.lr_field { display: flex; flex-direction: column; margin: 0; }
.lr_btn { background: #0891b2; border-color: #0891b2; color: #fff; font-size: 12px; font-weight: 700; padding: 4px 18px; }
.lr_btn:hover:not(:disabled) { background: #0e7490; color: #fff; }
.lr_btn:disabled { background: #94a3b8; border-color: #94a3b8; color: #fff; }
.lr_error { font-size: 11px; color: #b91c1c; }
.lr_ok { font-size: 11px; color: #047857; font-weight: 700; }
`;

export default LoanRates;
```

### frontend/src/components/header/LoanRateUpload.tsx

```tsx
import React, { useState } from 'react';
import apiClient from '../../utils/apiClient';
import { csvToObjects, decodeCsv, parseCsv } from '../../utils/csv';

/**
 * 金利データの月の登録（v2.2.240。⚠️ Master だけ。LoanRates.tsx の上部に出す）。
 *
 * ⚠️ 1回で「プラン別金利の CSV（plan_rates_YYYY-MM.csv）」と「分析レポートの HTML（rate_analysis_YYYY-MM.html）」を登録できる。どちらか片方だけでもよい。
 *   CSV  → loan_plan_rate_upload（⚠️ その月を丸ごと入れ替える。features/loanPlanRate.ts）
 *   HTML → analysis_report_upload（reportCategory = 'loan_rate'・period = 月。features/analysis/report.ts）
 * ⚠️ 対象月はファイル名の YYYY-MM から自動で入れる（直せる）。
 * ⚠️ CSV は画面でも検査し、誤りがあれば送らない（② でも同じ検査をする）。
 */

const REQUIRED_COLUMNS = ['g', 'id', 'fi', 'plan', 'rtype', 'term', 'feeType', 'dan', 'cond', 'rate', 'base', 'prev', 'asof', 'url', 'conf'];
/** analysis_report の上限（② の MAX_HTML_BYTES と同じ） */
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MONTH_IN_NAME = /(\d{4})-(0[1-9]|1[0-2])/;

type RowError = { line: number; message: string };
type Props = { onSaved: (month: string) => void };

const isRate = (v: string): boolean => v === '' || (/^\d+(\.\d+)?$/.test(v) && Number(v) > 0 && Number(v) < 20);

const validate = (r: Record<string, string>): string => {
    if (!r.fi) return '金融機関名（fi）が空です';
    if (!r.plan) return 'プラン名（plan）が空です';
    const bad = (['rate', 'base', 'prev'] as const).find((c) => !isRate(r[c] ?? ''));
    return bad ? `${bad} が正しくありません: ${r[bad]}` : '';
};

/** 対象月の表記（2026-11 → 2026年11月） */
export const monthLabel = (month: string): string => {
    const [y, m] = month.split('-');
    return m ? `${y}年${Number(m)}月` : month;
};

const LoanRateUpload: React.FC<Props> = ({ onSaved }) => {
    const [month, setMonth] = useState('');
    const [csvName, setCsvName] = useState('');
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [errors, setErrors] = useState<RowError[]>([]);
    const [html, setHtml] = useState('');
    const [htmlName, setHtmlName] = useState('');
    const [fileError, setFileError] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

    const guessMonth = (name: string) => {
        const m = MONTH_IN_NAME.exec(name);
        if (m && month === '') setMonth(`${m[1]}-${m[2]}`);
    };

    const pickCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setCsvName(file.name);
        setRows([]);
        setErrors([]);
        setFileError('');
        setResult(null);
        guessMonth(file.name);
        try {
            const { header, records } = csvToObjects(parseCsv(decodeCsv(await file.arrayBuffer())));
            const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
            if (missing.length > 0) { setFileError(`CSV の見出しに ${missing.join('・')} がありません。plan_rates の CSV を選んでください。`); return; }
            if (records.length === 0) { setFileError('CSV にプランの行がありません。'); return; }
            setRows(records);
            setErrors(records.map((r, i) => ({ line: i + 2, message: validate(r) })).filter((x) => x.message !== ''));
        } catch (error) {
            console.error('CSV の読み込みに失敗しました:', error);
            setFileError('CSV を読み込めませんでした。ファイルの形式をご確認ください。');
        }
    };

    const pickHtml = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setHtml('');
        setHtmlName(file.name);
        setFileError('');
        setResult(null);
        guessMonth(file.name);
        if (file.size > MAX_HTML_BYTES) { setFileError(`HTML が大きすぎます（上限 ${MAX_HTML_BYTES / 1024 / 1024}MB）。`); return; }
        setHtml(await file.text());
    };

    const canSubmit = /^\d{4}-\d{2}$/.test(month) && (rows.length > 0 || html !== '') && errors.length === 0 && fileError === '' && !busy;

    const submit = async () => {
        if (!canSubmit) return;
        if (rows.length > 0 && !window.confirm(`${monthLabel(month)}のプラン別金利を、選んだ CSV（${rows.length}行）で入れ替えます。よろしいですか？`)) return;
        setBusy(true);
        setResult(null);
        const done: string[] = [];
        try {
            if (rows.length > 0) {
                const res = await apiClient.post('', { request: 'loan_plan_rate_upload', month, rows });
                const data = res.data ?? {};
                if (data.status !== 'ok') {
                    const detail = Array.isArray(data.errors) ? data.errors.slice(0, 5).map((x: RowError) => `${x.line}行目: ${x.message}`).join(' / ') : '';
                    throw new Error(`${data.message ?? 'CSV を登録できませんでした。'}${detail ? `（${detail}）` : ''}`);
                }
                done.push(`プラン別金利 ${data.rows}行`);
            }
            if (html !== '') {
                const res = await apiClient.post('', {
                    request: 'analysis_report_upload', title: `九州の住宅ローン金利 ${monthLabel(month)}`,
                    // ⚠️ data_as_of は DATE 列（'YYYY-MM' は入らない）。⚠️ 月の初日にする
                    reportCategory: 'loan_rate', period: month, html, dataAsOf: `${month}-01`,
                });
                if (res.data?.status !== 'ok') throw new Error(res.data?.message ?? 'レポートを登録できませんでした。');
                done.push('分析レポート');
            }
            setResult({ ok: true, message: `${monthLabel(month)}の${done.join('と')}を登録しました。` });
            setRows([]); setCsvName(''); setHtml(''); setHtmlName('');
            onSaved(month);
        } catch (error) {
            const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || (error as Error).message;
            setResult({ ok: false, message: `${done.length > 0 ? `${done.join('と')}は登録済みです。` : ''}${message}` });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="lr_upload mb-3">
            <div className="lr_upload_head">
                <span className="lr_upload_title"><i className="fa-solid fa-upload me-1" aria-hidden="true" />月のデータを登録</span>
                <span className="lr_badge">Master のみ</span>
                <span className="lr_note">Claude デスクトップが作った plan_rates_YYYY-MM.csv と rate_analysis_YYYY-MM.html を選んでください（片方だけでも登録できます）</span>
            </div>
            <div className="lr_upload_row">
                <label className="lr_field">
                    <span className="lr_label">対象月</span>
                    <input type="month" className="form-control form-control-sm" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 150 }} />
                </label>
                <label className="lr_field">
                    <span className="lr_label">プラン別金利（CSV）</span>
                    <input type="file" accept=".csv,text/csv" className="form-control form-control-sm" onChange={(e) => void pickCsv(e)} style={{ width: 260 }} />
                </label>
                <label className="lr_field">
                    <span className="lr_label">分析レポート（HTML）</span>
                    <input type="file" accept=".html,text/html" className="form-control form-control-sm" onChange={(e) => void pickHtml(e)} style={{ width: 260 }} />
                </label>
                <button type="button" className="btn btn-sm lr_btn" disabled={!canSubmit} onClick={() => void submit()}>
                    {busy ? '登録しています…' : '登録'}
                </button>
            </div>
            {(csvName || htmlName) && (
                <div className="lr_note mt-1">
                    {csvName && <>CSV：{csvName}（{rows.length}行{errors.length > 0 ? `・誤り ${errors.length}行` : ''}）　</>}
                    {htmlName && <>HTML：{htmlName}{html ? `（${Math.round(new Blob([html]).size / 1024)}KB）` : ''}</>}
                </div>
            )}
            {fileError && <div className="lr_error mt-1">{fileError}</div>}
            {errors.length > 0 && (
                <div className="lr_error mt-1">
                    誤りのある行があるため登録できません：{errors.slice(0, 5).map((x) => `${x.line}行目 ${x.message}`).join(' / ')}{errors.length > 5 ? ` ほか${errors.length - 5}行` : ''}
                </div>
            )}
            {result && <div className={`mt-1 ${result.ok ? 'lr_ok' : 'lr_error'}`} role="status">{result.message}</div>}
        </div>
    );
};

export default LoanRateUpload;
```

### backend/scripts/sql/2026-11-03_loan_plan_rate.sql

```sql
-- ===========================================================
-- 商圏内の金融機関のプラン別金利（loan_plan_rate）
--
-- 2026-11-03 新規（v2.2.240）
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 既存の表は変更しない（新規1表のみ）。
--
-- ─────────────────────────────────────────────
-- 何のテーブルか
--
--   Claude デスクトップが毎月集める plan_rates_YYYY-MM.csv（金融機関 × プラン × 期間 × 手数料の型 × 団信、約1,100行）。
--   画面はヘッダーの「金利データ」（frontend/src/components/header/LoanRates.tsx）。
--   ⚠️ 資金計画書の金利（loan_product / loan_rate。商品単位・33商品）とは**別物**。
--     ⚠️ ここを変えても資金計画書の金利は動かない（つなげていない）。
--
--   ⚠️ 月ごとに**丸ごと入れ替える**（同じ月をもう一度登録したら、その月の行を全部消して入れ直す）。
--   ⚠️ 列名は CSV の見出しと同じ（`g` `fi` `rtype` `feeType` …）。⚠️ 改名しないこと（CSV をそのまま入れるため）。
--   ⚠️ 毎月の分析レポート（HTML）は analysis_report に category = 'loan_rate'・period = 'YYYY-MM' で入れる（新しい表は作らない）。
-- ─────────────────────────────────────────────
-- ===========================================================

CREATE TABLE IF NOT EXISTS `loan_plan_rate` (
   `no`       INT          NOT NULL AUTO_INCREMENT
  ,`month`    CHAR(7)      NOT NULL COMMENT '対象月（YYYY-MM。CSV のファイル名の月）'
  ,`line`     INT          NOT NULL COMMENT 'CSV の行番号（見出しを1行目として数える）。⚠️ 並びを CSV と同じに保つため'
  ,`g`        VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '区分（鹿児島 / 九州の地銀 / 福岡・佐賀・長崎 / 労金・JA / ネット銀行 / メガ・フラット35）'
  ,`id`       VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '商品ID（loan_product.id と同じ体系。例: kagin）'
  ,`fi`       VARCHAR(191) NOT NULL DEFAULT '' COMMENT '金融機関名'
  ,`plan`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'プラン名'
  ,`rtype`    VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '金利タイプ（変動 / 固定期間選択 / 全期間固定）'
  ,`term`     VARCHAR(16)  NOT NULL DEFAULT '' COMMENT '固定期間（年）。変動は空'
  ,`feeType`  VARCHAR(32)  NOT NULL DEFAULT '' COMMENT '手数料・保証料の型（手数料定率 / 保証料一括 …）'
  ,`dan`      VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '団信（一般 / がん / 8大疾病 …）'
  ,`cond`     VARCHAR(255) NOT NULL DEFAULT '' COMMENT '条件（どの金利を採ったか）'
  ,`rate`     DECIMAL(6,3)     NULL COMMENT '適用金利（%）。⚠️ 空なら NULL'
  ,`base`     DECIMAL(6,3)     NULL COMMENT '店頭（基準）金利（%）'
  ,`prev`     DECIMAL(6,3)     NULL COMMENT '前月の適用金利（%）。⚠️ 前月に無いプランは NULL'
  ,`asof`     VARCHAR(16)  NOT NULL DEFAULT '' COMMENT '金融機関側の適用日（例: 2026/11/02）'
  ,`url`      VARCHAR(255) NOT NULL DEFAULT '' COMMENT '出典の URL'
  ,`conf`     VARCHAR(16)  NOT NULL DEFAULT '' COMMENT '値の確かさ（official = 公式 / calc = 計算 / comparison = 比較サイト）'
  ,`created_by` VARCHAR(64) NOT NULL DEFAULT '' COMMENT '登録した人（初期データは seed）'
  ,`created_at` DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP
  ,PRIMARY KEY (`no`)
  ,UNIQUE KEY `uq_loan_plan_rate_line` (`month`, `line`)
  ,KEY `idx_loan_plan_rate_fi` (`month`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  COMMENT='商圏内の金融機関のプラン別金利（月ごと）。画面: header/LoanRates.tsx';

-- 確認（⚠️ 0行で作られていればよい。初期データは 2026-11-03_loan_plan_rate_seed.sql）
SELECT COUNT(*) AS loan_plan_rate_rows FROM loan_plan_rate;
```

### backend/scripts/sql/2026-11-03_loan_plan_rate_seed.sql（⚠️ 先頭と末尾だけ。INSERT の本体は約660KB）

```sql
-- ===========================================================
-- loan_plan_rate の初期データ（2026年10月・11月）。v2.2.240
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 先に 2026-11-03_loan_plan_rate.sql（表の作成）を流すこと。
-- ⚠️ 元データ: Claude デスクトップが作った plan_rates_2026-10.csv（1,079行）・plan_rates_2026-11.csv（1,104行）。
-- ⚠️ 月ごとに DELETE してから入れるので、何度流しても二重にはならない。
-- ⚠️ 12月以降は画面（ヘッダーの「金利データ」→ Master の登録欄）から入れる。この SQL は作らない。
-- ===========================================================

-- 2026-10（1079行）
DELETE FROM loan_plan_rate WHERE month = '2026-10';
INSERT INTO loan_plan_rate (month, line, `g`, `id`, `fi`, `plan`, `rtype`, `term`, `feeType`, `dan`, `cond`, `rate`, `base`, `prev`, `asof`, `url`, `conf`, created_by) VALUES
-- …（2026-10 1,079行・2026-11 1,104行の INSERT。200行ずつ）…

-- 確認（2026-10 = 1079・2026-11 = 1104 ならよい）
SELECT month, COUNT(*) AS rows_count, SUM(rate IS NULL) AS no_rate FROM loan_plan_rate GROUP BY month ORDER BY month;
```

### backend/scripts/guide/articles/common/screen-185.md

````markdown
---
title: 金利データ
section: 画面の使い方
sort: 185
summary: 商圏内の金融機関の住宅ローン金利（プラン別）と、毎月の金利分析レポート。
---
ヘッダーの「マーケット情報」の右の「金利データ」（シアン色のボタン）。商圏内の金融機関の住宅ローン金利を、プランごとに見る画面です。毎月の分析レポートも読めます。

[[画面:金利データ]]

金利は毎月、各金融機関の公式サイトなどから集めたものです。資金計画書で使う金利（システム管理 → ローン情報更新）とは別のデータです。

## プラン別金利
- 右上の「対象月」で月を選びます。はじめは、いちばん新しい月が出ます
- 区分・金融機関・金利タイプ・固定期間・手数料の型・団信・確かさ・キーワードで絞り込めます。「前月から動いたものだけ」に印を付けると、金利が変わったプランだけになります
- 上の数字：プラン数、変動の最も低い金利、10年固定の最も低い金利、前月から上がった・下がったプランの数（どれも絞り込んだあとの数です）
- 表の見出しを押すと並べ替えができます。はじめは金利の低い順です
- **差**は前月からの変化です。赤は上がった、青は下がったプランです
- **引下げ幅**は、店頭金利から何%下がっているかです
- 金融機関名を押すと、出典のページが別のタブで開きます

> 注意：金利は最も条件の良い優遇後の値です。審査・物件・団信の種類で変わるため、お客様にお伝えする前に必ず公式サイトか窓口で確かめてください。

### 確かさ
- **公式**：金融機関の公式サイトの値です
- **計算**：店頭金利と引下げ幅から計算した値です
- **比較サイト**：比較サイトの値です。特に確認が必要です

## 分析レポート
「分析レポート」を押すと、選んだ月の金利分析レポートが出ます。改定で何が変わったか、変動金利のランキング、区分ごとの平均、10年固定やフラット35の動きなどがまとまっています。
- レポートの上のリンクを押すと、その項目まで移動します
- 同じ月にレポートが2つ以上あるときは「版」で選べます（はじめは最新の版です）

## 月のデータを登録する（管理者）
マスター権限の人には、画面の上に「月のデータを登録」の欄が出ます。
1. 毎月、Claude デスクトップが作った「plan_rates_年-月.csv」（プラン別金利）と「rate_analysis_年-月.html」（分析レポート）を用意する
2. 「プラン別金利（CSV）」「分析レポート（HTML）」でファイルを選ぶ（片方だけでも登録できます）。対象月はファイル名から自動で入ります
3. 「登録」を押す

- 同じ月のプラン別金利を登録し直すと、その月の分は丸ごと入れ替わります
- CSV に誤りのある行があると、何も登録しません（誤りのある行が表示されます）
- 同じ月のレポートを登録し直すと、新しい版として増えます

## 関係する記事
- [[業務ガイドの使い方]]
````

### backend/scripts/sql/2026-11-03_update_log_2.2.240.sql（⚠️ 先頭。業務ガイドの3本は記事と同じ本文）

```sql
-- =====================================================================
-- v2.2.240 金利データ（商圏内の金融機関のプラン別金利・毎月の分析レポート） ＋ update_log
--   （末尾に業務ガイド「金利データ」の追加と「業務ガイドの使い方」の上書き）
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 1回だけ流す（流すたびに更新履歴が1行増える）
-- ⚠️ 先に 2026-11-03_loan_plan_rate.sql（表の作成）と 2026-11-03_loan_plan_rate_seed.sql（10月・11月の初期データ）を流すこと
-- =====================================================================

-- 1. 更新履歴（⚠️ `no` は AUTO_INCREMENT なので指定しない）
INSERT INTO update_log (version, date, note) VALUES
('2.2.240', '2026-11-03', 'ヘッダーの「マーケット情報」の右に「金利データ」を追加した。商圏内の金融機関の住宅ローン金利をプランごとに、区分・金融機関・金利タイプ・固定期間などで絞り込み、前月からの変化と一緒に見られる。毎月の金利分析レポートも同じ画面で読める。マスター権限の人は、画面の上から月のデータ（CSV と分析レポート）を登録できる。');

```

## 既存ファイルの差分

```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 7d5faeed8..1c9a96145 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -143,6 +143,7 @@ import { runSuumoPropertyInsert } from '../features/suumoProperty';
 import { runShopList } from '../features/shopList';
 import { runUpdateLog } from '../features/updateLog';
 import { getLatestLoanRates, uploadLoanRates } from '../features/loanRate';
+import { listLoanPlanRates, uploadLoanPlanRates } from '../features/loanPlanRate';
 import { runBeforeSurveyEntry } from '../features/beforeSurvey/entry';
 import { runMemberEntry } from '../features/memberEntry/entry';
 import { runHousingBazarEntry } from '../features/housingBazar/entry';
@@ -2999,6 +3000,33 @@ register({
   ),
 });
 
+/**
+ * 商圏内の金融機関のプラン別金利（v2.2.240）。features/loanPlanRate.ts 参照。
+ *
+ * ⚠️⚠️ **① に PHP ハンドラは無い。最初から Express だけにある。**
+ *   ⚠️ ① の express_proxy.php の ⚠️ **転送リストと転送専用リストの両方**に入れてある。
+ * ⚠️ 読むのは全員（ヘッダーの「金利データ」）、⚠️ 登録は Master だけ。
+ * ⚠️ 月の分析レポート（HTML）は既存の analysis_report_upload / analysis_report_get（reportCategory = 'loan_rate'）。
+ */
+register({
+  request: 'loan_plan_rate_list',
+  summary: '金利データ（プラン別金利の月の一覧・指定月の行・分析レポートの一覧）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => listLoanPlanRates({ month: ctx.body.month }),
+});
+
+register({
+  request: 'loan_plan_rate_upload',
+  summary: '【書き込み】金利データ: plan_rates の CSV でその月を丸ごと入れ替える',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'master',
+  handler: async (ctx) => uploadLoanPlanRates(
+    { month: ctx.body.month, rows: ctx.body.rows },
+    String(ctx.staff?.name ?? '')
+  ),
+});
+
 // ---------------------------------------------------------------------------
 // 反響の付帯情報の更新（同期サービス projects/sync から呼ばれる）
 //
diff --git a/backend/scripts/guide/articles/common/screen-180.md b/backend/scripts/guide/articles/common/screen-180.md
index 679fca59b..370cfcd7c 100644
--- a/backend/scripts/guide/articles/common/screen-180.md
+++ b/backend/scripts/guide/articles/common/screen-180.md
@@ -6,7 +6,7 @@ summary: このガイドの開き方と読み方。
 ---
 ## 開き方
 次の3か所の「業務ガイド」ボタンから開けます（注文営業・建売営業・中古リノベの方向け）。
-- ヘッダーの「マーケット情報」の右
+- ヘッダーの「マーケット情報」「金利データ」の右
 - 右上のパネル（[[アクティブユーザー（右上のパネル）]]）
 - トップ画面の4つのボタンの下
 
diff --git a/backend/scripts/guide/articles/used/screen-050.md b/backend/scripts/guide/articles/used/screen-050.md
index 496969f39..256c77ec0 100644
--- a/backend/scripts/guide/articles/used/screen-050.md
+++ b/backend/scripts/guide/articles/used/screen-050.md
@@ -13,7 +13,7 @@ summary: 次回架電日が今日までのお客様を並べ、1件ずつ架電
 - 最後に入れた**次回架電日が今日以前**で、その日以降にまだ**通電・未通電・SMS送信**を記録していないお客様が並びます
 - 次回架電日を過ぎているお客様には「○日超過」、今日の予定のお客様には「今日の予定」の札が付きます。過ぎている日数が多いお客様ほど上に並びます
 - 架電ステータスが「架電停止」のお客様と、状況が契約済み・失注のお客様は並びません
-- 「自分の担当のみ」に印を付けると、自分が担当のお客様だけになります
+- はじめはチーム全員のお客様が並びます。「自分の担当のみ」に印を付けると、自分が担当のお客様だけになります
 
 > 注意：次回架電日を入れていないお客様は並びません。かけ直す予定のお客様には、記録のときに必ず次回架電日を入れてください。
 
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 5dc15fefd..62df9ab8b 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -399,6 +399,9 @@ function expressProxyRequests(): array
         // -----------------------------------------------------------------
         'loan_rate_latest',
         'loan_rate_upload',
+        // ⚠️ v2.2.240。金利データ（プラン別金利）。⚠️ ② だけ（① に PHP は無い）。upload は書き込み（Master だけ）
+        'loan_plan_rate_list',
+        'loan_plan_rate_upload',
 
         // -----------------------------------------------------------------
         // 2026-09-22 新規。SatBaseサマリー（物件台帳）。
@@ -881,6 +884,9 @@ function expressProxyExclusive(): array
         // -----------------------------------------------------------------
         'loan_rate_latest',
         'loan_rate_upload',
+        // ⚠️ v2.2.240。金利データ（プラン別金利）。⚠️ ② だけ（① に PHP は無い）。upload は書き込み（Master だけ）
+        'loan_plan_rate_list',
+        'loan_plan_rate_upload',
 
         // -----------------------------------------------------------------
         // 2026-09-22 新規。SatBaseサマリー（物件台帳）。
diff --git a/frontend/src/App.tsx b/frontend/src/App.tsx
index bdc0030e1..a0cdf1f6a 100644
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -19,6 +19,7 @@ import Photo from "./components/photo/Photo";
 import Hab from "./components/Hab";
 import BudgetKaeru from "./components/BudgetKaeru";
 import Market from "./components/Market";
+import LoanRates from "./components/header/LoanRates";
 import Login from "./components/Login";
 import KengakuCloud from "./components/KengakuCloud";
 import ActiveUser from "./components/ActiveUser";
@@ -179,6 +180,8 @@ function AppInner() {
             <Route path="/map" element={<MapRouter />} />
             <Route path="/specBudget" element={<BudgetKaeru />} />
             <Route path="/market" element={<Market />} />
+            {/* ⚠️ v2.2.240: 金利データ（ヘッダーの「金利データ」） */}
+            <Route path="/loanRates" element={<LoanRates />} />
             <Route path="/property" element={<DatabaseProperty />} />
             <Route path="/photo" element={<Photo />} />
             <Route path="/kengakuCloud" element={<KengakuCloud />} />
diff --git a/frontend/src/components/callq/UsedCallQueue.tsx b/frontend/src/components/callq/UsedCallQueue.tsx
index 6836f384d..db0806d53 100644
--- a/frontend/src/components/callq/UsedCallQueue.tsx
+++ b/frontend/src/components/callq/UsedCallQueue.tsx
@@ -97,7 +97,8 @@ const UsedCallQueue: React.FC = () => {
     const [cards, setCards] = useState<QueueCard[]>([]);
     const [loading, setLoading] = useState(true);
     const [busy, setBusy] = useState(false);
-    const [mine, setMine] = useState(true);
+    // ⚠️ v2.2.240: 初期値はチーム全体（2026-11-03 の指示で true → false）
+    const [mine, setMine] = useState(false);
     const [drafts, setDrafts] = useState<Record<string, Draft>>({});
     const [openId, setOpenId] = useState('');
     const [toast, setToast] = useState('');
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index 6dfd8d829..e7a2c60ea 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -65,6 +65,8 @@ export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     'キャンペーン管理': { route: '/campaign', divisions: ['order'], authority: ADMIN, pcOnly: true },
     '予算詳細': { route: '/budget', divisions: ['order', 'spec', 'used'], authority: ADMIN, pcOnly: true },
     'マーケット情報': { route: '/market' },
+    // ⚠️ v2.2.240。ヘッダーの「金利データ」（マーケット情報の右）
+    '金利データ': { route: '/loanRates' },
     // ── ヘッダーのメニュー（Header.tsx の menuMapping と同じ条件）
     // ⚠️ v2.2.217 から Master・BrandAdmin・Manager だけ（Header.tsx の AI_ANALYSIS_AUTHORITY と同じ）
     'Claudeによる分析': { claude: true, authority: ['Master', 'BrandAdmin', 'Manager'] },
diff --git a/frontend/src/components/header/Header.tsx b/frontend/src/components/header/Header.tsx
index 28eb4c663..405329acb 100644
--- a/frontend/src/components/header/Header.tsx
+++ b/frontend/src/components/header/Header.tsx
@@ -462,6 +462,16 @@ const Header = ({ }) => {
                 >
                     マーケット情報
                 </div>
+                {/* ⚠️ v2.2.240: 金利データ（⚠️ マーケット情報の右・指示）。⚠️ 色は濃いシアン（bg-info は白い文字が読みにくいため。2026-11-03 の決定）。header/LoanRates.tsx */}
+                <div className='rounded-pill text-white me-1 shadow-sm'
+                    role="button" tabIndex={0}
+                    style={{ padding: '2px 10px', fontSize: '10px', cursor: 'pointer', background: '#0891b2' }}
+                    onClick={() => navigate('/loanRates')}
+                    onKeyDown={(e) => { if (e.key === 'Enter') navigate('/loanRates'); }}
+                    title="商圏内の金融機関の住宅ローン金利"
+                >
+                    金利データ
+                </div>
                 {/* ⚠️ v2.2.194: 業務ガイド（⚠️ マーケット情報の右・指示）。⚠️ 別ウインドウで開く。⚠️ 注文営業・建売営業・中古リノベ */}
                 {isGuideCategory(category) && (
                     <div className='rounded-pill text-white me-1 shadow-sm'
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 02266c456..47a02ddf0 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.239';
+export const newVersion = '2.2.240';
```
