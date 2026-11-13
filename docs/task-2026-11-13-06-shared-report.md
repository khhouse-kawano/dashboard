# v2.2.268 レポートの共有（Dashboard にログインしていれば見られるURL）

日付：2026-11-13　ブランチ：v2.2.268

## 依頼
- 報告用の HTML を「Dashboard にログインしていれば」閲覧できる仕組み。HTML の登録画面と認証。
- 理想：ClaudeAnalysis.tsx の「HTMLをダウンロード」の右に「共有」→ ランダムなURL → ログイン中なら閲覧、未ログインならログイン画面のあと表示。
- 「必要なテーブルがあれば作成する」（提案への回答）。決めていただきたい4点に回答が無かったため、提案の既定で進めた：
  見られる人＝ログインできる人全員／共有＝分析は本人と Master、HTML の登録は Master／期限なし（手で止める）／共有ページはヘッダー無しの全画面。

## 作り
- 認証は localStorage の token（Cookie ではない）なので、共有ページは Dashboard の中の画面 `/report?k=…` にした。
  - 未ログイン → AuthProvider が `/dashboard/login?redirect=/report?k=…` へ移す → ログイン後に戻る（既存の仕組み）。
  - ② の shared_report_get は auth: 'staff'（トークンを毎回 DB で確かめる）。
  - 表示は iframe `sandbox="allow-scripts"`（ClaudeAnalysis.tsx と同じ）。レポートの中からトークンは読めない（ブラウザで確認）。
  - URL は1段（`/report/キー` にしない。再読み込みで真っ白になるため）。
- 共有キー：`randomBytes(16).toString('base64url')`（22文字）。
- HTML は共有した時点の写し（元の分析を消しても見られる）。止めると html を NULL にする。
- 5MB まで（① の転送・② の本文 10mb より小さく）。

## 変えたファイル
- 新規
  - `backend/scripts/sql/2026-11-13_update_log_2.2.268.sql`（表 shared_report・update_log・記事3本。ローカル no=367）
  - `backend-express/src/features/sharedReport.ts`：`createSharedReport`・`getSharedReport`・`listSharedReports`・`revokeSharedReport`・`insertReport`・`findByKey`・`toSummary`
  - `frontend/src/components/report/sharedReport.ts`：`sharedReportUrl`・`createSharedReport`・`copyText`・`errorMessageOf`・型 `SharedReportItem`
  - `frontend/src/components/report/SharedReportView.tsx`（共有URLの画面。接頭辞 srv_）
  - `frontend/src/components/header/system/SharedReports.tsx`（システム管理 → 共有レポート。接頭辞 sr_）
  - `backend/scripts/guide/articles/common/screen-202.md`（記事「共有レポート」）
  - `docs/deploy-v2.2.268.md`
- 変更
  - `backend-express/src/gateway/registry.ts`：shared_report_create / _get / _list / _revoke（すべて auth: 'staff'。権限は sharedReport.ts で見る）
  - `backend/src/core/express_proxy.php`：expressProxyRequests() と expressProxyExclusive() の両方に4つ
  - `frontend/src/App.tsx`：`/report` はヘッダー・メニュー無しで SharedReportView だけ（/guide と同じ形）
  - `frontend/src/components/header/claude/ClaudeAnalysis.tsx`：「共有」ボタン（本人か Master）・`shareJob`・結果の帯（URL・開く・閉じる）
  - `frontend/src/components/header/headerScreens.tsx`：「システム管理 → 共有レポート」（Master・BrandAdmin・Manager）
  - `frontend/src/components/guide/guideScreens.ts`：`'共有レポート'`
  - `frontend/src/utils/version.ts`：2.2.268
  - 記事 `common/screen-150.md`（Claudeによる分析）・`common/screen-105.md`（ヘッダーのメニュー）

## 業務ガイドの記事
- 新規「共有レポート」：共有URLの開き方（ログインが必要・未ログインならログイン画面のあと）・共有のしかた（分析の「共有」、HTML の登録）・一覧の見方・止め方・注意（共有した時点の内容、個人情報）。
- 「Claudeによる分析」：結果を見るの項に「共有」ボタンの説明を1行足した。
- 「ヘッダーのメニュー」：見られる人に「共有レポート」を足し、項目ごとの記事にリンクを足した。

## テスト
- 型チェック：frontend・backend-express ともエラー 0。
- ① 経由でトークン無し → 4つとも 401（② まで届いている）。
- ① 経由の API 試験（仮スタッフ Master 999999・Manager 999998・ordinary 999997）**21項目 OK**：
  権限（Manager が他人の分析を共有 403、一般が共有 403、Manager の HTML 登録 403、他人の共有を止める 403）、同じ分析の再共有で同じキー、無い分析 404、題が空・HTML でない 400、5MB 超 413（① を通っても）、一般が見る・本文が一致、無いキー・形の違うキー 404、トークン無し 401、一覧（Master 全員分・Manager 自分の分・html を含まない・閲覧回数）、止めたあと 410、止めた分析の再共有で新しいキー、created_at が日本時間。
- Playwright（3100）**15項目 OK**：未ログインでログイン画面へ（redirect が共有URL）→ ログイン後にレポートが開く、iframe の中から localStorage が読めない、ヘッダー無し、無いキーのメッセージ、「HTMLをダウンロード」の右に「共有」、URL がクリップボードに入る、HTML の登録（ファイル名が題に入る）、一覧、「開く」で別タブ、止める（確認 → 一覧から消える → 410）、Manager に登録欄が無い、画面のエラー 0。業務ガイドの記事が開き「共有レポートを開く」ボタンが出る。
- 仮スタッフ 3人・試験の shared_report の行は消した。3100 は止めた。
- 再読・整理：新しく足したコードを読み直した。ClaudeAnalysis で別名にしていた errorMessageOf を既存の関数に寄せた（試験はその後に実施）。

## 残っていること
- 本番での確認（手順書の「終わったら」）。
- 見られる人を事業で絞るか・期限を付けるかは、必要になったら変える（今は全員・無期限）。

## 新規ファイル（全文）：`backend-express/src/features/sharedReport.ts`
```tsx
import { randomBytes } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, executeLarge, query } from '../db/pool';
import type { AuthenticatedStaff } from '../types/staff';
import { logger } from '../utils/logger';
import { AI_ANALYSIS_AUTHORITY } from './aiAnalysis';
import { getJobHtml, getJobSummary } from './aiAnalysis/job';

/**
 * レポートの共有（v2.2.268。表 shared_report）。
 *
 * ─────────────────────────────────────────────
 *   shared_report_create  … 共有URLを作る。Claudeによる分析から（実行した本人か Master）／HTML の登録から（Master）
 *   shared_report_get     … 共有URL（/report?k=…）の画面が呼ぶ。⚠️ ログインしていれば誰でも見られる
 *   shared_report_list    … 共有したレポートの一覧（Master は全員分、ほかの人は自分の分）
 *   shared_report_revoke  … 共有を止める（共有した本人か Master）
 *
 * ⚠️ 見るのにログインが必要なのは、登録の auth: 'staff'（トークンを毎回 DB で確かめる）で担保する。
 *   ⚠️ URL を知っているだけでは見られない。
 * ⚠️ share_key は 128bit の乱数（base64url で22文字）。連番の id は画面に出すが、id では見られない。
 * ⚠️ html は共有した時点の写し。元の分析を消しても見られる。共有を止めると html を消す（NULL）。
 * ⚠️ 画面は html を iframe（sandbox="allow-scripts" だけ）で表示する。レポートのスクリプトからログイン情報は読めない。
 * ⚠️ ログに html は出さない（個人情報が入ることがあるため）。
 * ⚠️ 日時は日本時間を ② で作って書く（ローカルの DB は UTC）。
 * ─────────────────────────────────────────────
 */

/** 登録できる HTML の大きさの上限（バイト）。⚠️ ① の転送・② の本文の上限（10mb）より十分小さくする */
export const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_TITLE = 200;
const KEY = /^[A-Za-z0-9_-]{22}$/;

interface Result<T> {
  httpStatus: number;
  body: T | { status: 'error'; message: string };
}

const fail = (httpStatus: number, message: string): Result<never> => ({ httpStatus, body: { status: 'error', message } });

const jst = (): string => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');

const idOf = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const titleOf = (value: unknown): string =>
  String(value ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, MAX_TITLE);

const isMaster = (staff: AuthenticatedStaff): boolean => staff.brand === 'Master';

interface Row extends RowDataPacket {
  id: number;
  share_key: string;
  title: string;
  source: string;
  source_id: number | null;
  html_bytes: number;
  staff_id: number;
  staff_name: string;
  created_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
}

export interface SharedReportSummary {
  id: number;
  key: string;
  title: string;
  source: string;
  sourceId: number | null;
  htmlBytes: number;
  staffId: number;
  staffName: string;
  createdAt: string;
  revokedAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
}

const COLUMNS = `id, share_key, title, source, source_id, html_bytes, staff_id, staff_name,
  created_at, revoked_at, view_count, last_viewed_at`;

const toSummary = (r: Row): SharedReportSummary => ({
  id: r.id,
  key: r.share_key,
  title: r.title,
  source: r.source,
  sourceId: r.source_id,
  htmlBytes: r.html_bytes,
  staffId: r.staff_id,
  staffName: r.staff_name,
  createdAt: r.created_at,
  revokedAt: r.revoked_at,
  viewCount: r.view_count,
  lastViewedAt: r.last_viewed_at,
});

/**
 * 1行足して共有キーを返す。
 * ⚠️ キーが重なる確率は事実上0だが、重なったら（一意制約の違反）作り直す。
 */
const insertReport = async (
  staff: AuthenticatedStaff,
  input: { title: string; source: 'ai_analysis' | 'upload'; sourceId: number | null; html: string; bytes: number }
): Promise<string> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const key = randomBytes(16).toString('base64url');
    try {
      // ⚠️ html は 64KB を超えうるので executeLarge（db/pool.ts の注記）
      await executeLarge(
        `INSERT INTO shared_report (share_key, title, source, source_id, html, html_bytes, staff_id, staff_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [key, input.title, input.source, input.sourceId, input.html, input.bytes, staff.id, staff.name, jst()]
      );
      return key;
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== 'ER_DUP_ENTRY') throw error;
    }
  }
  throw new Error('shared_report: 共有キーを作れませんでした');
};

const findByKey = async (key: string): Promise<Row | null> =>
  (await query<Row>(`SELECT ${COLUMNS} FROM shared_report WHERE share_key = ? LIMIT 1`, [key]))[0] ?? null;

export const createSharedReport = async (
  staff: AuthenticatedStaff,
  body: Record<string, unknown>
): Promise<Result<{ status: 'ok'; item: SharedReportSummary; reused: boolean }>> => {
  if (body.source === 'ai_analysis') {
    if (!AI_ANALYSIS_AUTHORITY.includes(staff.brand)) return fail(403, 'この操作の権限がありません。');
    const jobId = idOf(body.id);
    if (jobId === null) return fail(400, 'id が正しくありません。');
    const job = await getJobSummary(jobId);
    if (job === null) return fail(404, 'この分析は見つかりません。');
    if (job.status !== 'done') return fail(409, 'この分析はまだ終わっていません。');
    if (!isMaster(staff) && job.staffId !== staff.id) return fail(403, '共有できるのは、分析を実行した本人か Master だけです。');

    // ⚠️ 同じ分析をすでに共有していれば、そのURLを返す（押すたびに増やさない）
    const existing = await query<Row>(
      `SELECT ${COLUMNS} FROM shared_report
        WHERE source = 'ai_analysis' AND source_id = ? AND revoked_at IS NULL ORDER BY id DESC LIMIT 1`,
      [jobId]
    );
    if (existing[0] !== undefined) return { httpStatus: 200, body: { status: 'ok', item: toSummary(existing[0]), reused: true } };

    const html = (await getJobHtml(jobId)) ?? '';
    const bytes = Buffer.byteLength(html, 'utf8');
    if (bytes === 0) return fail(409, 'この分析のレポートが空です。');
    if (bytes > MAX_HTML_BYTES) return fail(413, 'レポートが大きすぎるため共有できません（5MBまで）。');

    const title = titleOf(job.title) || 'Claudeによる分析';
    const key = await insertReport(staff, { title, source: 'ai_analysis', sourceId: jobId, html, bytes });
    logger.info(`shared_report: 共有を作りました（Claudeによる分析 id=${jobId}、staff_id=${staff.id}）`);
    const row = await findByKey(key);
    return row === null ? fail(500, '共有を作れませんでした。') : { httpStatus: 200, body: { status: 'ok', item: toSummary(row), reused: false } };
  }

  if (body.source === 'upload') {
    if (!isMaster(staff)) return fail(403, 'HTML の登録は Master だけができます。');
    const title = titleOf(body.title);
    if (title === '') return fail(400, '題を入れてください。');
    const html = typeof body.html === 'string' ? body.html : '';
    const bytes = Buffer.byteLength(html, 'utf8');
    if (bytes === 0) return fail(400, 'HTML ファイルを選んでください。');
    if (bytes > MAX_HTML_BYTES) return fail(413, 'HTML が大きすぎます（5MBまで）。');
    if (!/<(html|body|div|table|main|section|h1|p)[\s>]/i.test(html)) return fail(400, 'HTML ファイルではないようです。');

    const key = await insertReport(staff, { title, source: 'upload', sourceId: null, html, bytes });
    logger.info(`shared_report: HTML を登録しました（${bytes} バイト、staff_id=${staff.id}）`);
    const row = await findByKey(key);
    return row === null ? fail(500, '登録できませんでした。') : { httpStatus: 200, body: { status: 'ok', item: toSummary(row), reused: false } };
  }

  return fail(400, '共有する元（source）が正しくありません。');
};

/** 共有URLの画面が呼ぶ。⚠️ ログインしていれば誰でも見られる（auth: 'staff'） */
export const getSharedReport = async (
  body: Record<string, unknown>
): Promise<Result<{ status: 'ok'; title: string; staffName: string; createdAt: string; source: string; html: string }>> => {
  const key = String(body.key ?? '');
  if (!KEY.test(key)) return fail(404, 'このURLのレポートは見つかりません。URLをもう一度確かめてください。');

  const rows = await query<Row & { html: string | null }>(
    `SELECT ${COLUMNS}, html FROM shared_report WHERE share_key = ? LIMIT 1`,
    [key]
  );
  const row = rows[0];
  if (row === undefined) return fail(404, 'このURLのレポートは見つかりません。URLをもう一度確かめてください。');
  if (row.revoked_at !== null || row.html === null) return fail(410, 'このレポートの共有は止められました。共有した人に確かめてください。');

  // ⚠️ 閲覧回数の記録に失敗しても、レポートは見せる
  execute('UPDATE shared_report SET view_count = view_count + 1, last_viewed_at = ? WHERE id = ?', [jst(), row.id])
    .catch((error: unknown) => logger.error('shared_report: 閲覧回数を記録できませんでした', error));

  return {
    httpStatus: 200,
    body: { status: 'ok', title: row.title, staffName: row.staff_name, createdAt: row.created_at, source: row.source, html: row.html },
  };
};

/** 一覧。Master は全員分、ほかの人は自分が共有した分 */
export const listSharedReports = async (
  staff: AuthenticatedStaff
): Promise<{ status: 'ok'; items: SharedReportSummary[]; isMaster: boolean; myStaffId: number }> => {
  const master = isMaster(staff);
  const rows = await query<Row>(
    `SELECT ${COLUMNS} FROM shared_report ${master ? '' : 'WHERE staff_id = ?'} ORDER BY id DESC LIMIT 500`,
    master ? [] : [staff.id]
  );
  return { status: 'ok', items: rows.map(toSummary), isMaster: master, myStaffId: staff.id };
};

/** 共有を止める（共有した本人か Master）。⚠️ html も消す */
export const revokeSharedReport = async (
  staff: AuthenticatedStaff,
  body: Record<string, unknown>
): Promise<Result<{ status: 'ok' }>> => {
  const id = idOf(body.id);
  if (id === null) return fail(400, 'id が正しくありません。');
  const rows = await query<Row>(`SELECT ${COLUMNS} FROM shared_report WHERE id = ? LIMIT 1`, [id]);
  const row = rows[0];
  if (row === undefined) return fail(404, 'この共有は見つかりません。');
  if (!isMaster(staff) && row.staff_id !== staff.id) return fail(403, '止められるのは、共有した本人か Master だけです。');
  if (row.revoked_at !== null) return { httpStatus: 200, body: { status: 'ok' } };

  await execute('UPDATE shared_report SET revoked_at = ?, revoked_by = ?, html = NULL WHERE id = ?', [jst(), staff.id, id]);
  logger.info(`shared_report: 共有を止めました（id=${id}、staff_id=${staff.id}）`);
  return { httpStatus: 200, body: { status: 'ok' } };
};
```

## 新規ファイル（全文）：`frontend/src/components/report/sharedReport.ts`
```tsx
import apiClient from '../../utils/apiClient';

/**
 * レポートの共有（v2.2.268）の共通部品。
 *   ClaudeAnalysis.tsx の「共有」ボタン、header/system/SharedReports.tsx（登録・一覧）、SharedReportView.tsx（共有URLの画面）が使う。
 *
 * ⚠️ 共有URL は `/dashboard/report?k=<22文字>`。⚠️ `/report/<キー>` の2段にすると再読み込みで真っ白になる（Guide.tsx の注記）。
 * ⚠️ 見るには Dashboard へのログインが必要（AuthProvider が未ログインならログイン画面へ移し、ログイン後にこの URL へ戻す）。
 */

export interface SharedReportItem {
    id: number;
    key: string;
    title: string;
    source: string;
    sourceId: number | null;
    htmlBytes: number;
    staffId: number;
    staffName: string;
    createdAt: string;
    revokedAt: string | null;
    viewCount: number;
    lastViewedAt: string | null;
}

/** ② の上限（features/sharedReport.ts の MAX_HTML_BYTES）と同じ値 */
export const MAX_HTML_BYTES = 5 * 1024 * 1024;

/** 共有URL（いま開いている Dashboard と同じ場所） */
export const sharedReportUrl = (key: string): string =>
    `${window.location.origin}/dashboard/report?k=${encodeURIComponent(key)}`;

export const errorMessageOf = (e: unknown, fallback: string): string =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/** 共有URLを作る（同じ分析をすでに共有していれば、そのURLが返る） */
export const createSharedReport = async (
    body: { source: 'ai_analysis'; id: number } | { source: 'upload'; title: string; html: string }
): Promise<{ item: SharedReportItem; reused: boolean }> => {
    const res = await apiClient.post('', { request: 'shared_report_create', ...body });
    if (res.data?.status !== 'ok') throw new Error(res.data?.message ?? '共有を作れませんでした。');
    return { item: res.data.item as SharedReportItem, reused: Boolean(res.data.reused) };
};

/**
 * クリップボードへ写す。⚠️ 写せない環境（http・権限なし）もあるので、結果を返して画面で URL を見せる。
 */
export const copyText = async (text: string): Promise<boolean> => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
};
```

## 新規ファイル（全文）：`frontend/src/components/report/SharedReportView.tsx`
```tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import apiClient from '../../utils/apiClient';
import { errorMessageOf } from './sharedReport';

/**
 * 共有したレポートを見る画面（v2.2.268 新規）。URL は `/report?k=<共有キー>`。
 *
 * ─────────────────────────────────────────────
 * ⚠️ App.tsx で `/report` のときだけヘッダー・メニュー・アクティブユーザー・要確認を出さない（業務ガイドと同じ）。
 * ⚠️ ログインの確認は AuthProvider が行う。未ログインならログイン画面へ移り、ログイン後にこの URL へ戻る。
 *   ⚠️ ② の shared_report_get も auth: 'staff' でトークンを毎回確かめる（URL を知っているだけでは見られない）。
 * ⚠️⚠️ レポートは iframe（sandbox="allow-scripts" だけ）の中で表示する。ClaudeAnalysis.tsx と同じ。
 *   ⚠️ allow-same-origin を足さないこと。足すとレポートのスクリプトから localStorage のトークンが読める。
 * ─────────────────────────────────────────────
 */

interface Report {
    title: string;
    staffName: string;
    createdAt: string;
    source: string;
    html: string;
}

const safeFileName = (value: string): string =>
    value.replace(/[\\/:*?"<>|\r\n\t]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'レポート';

const download = (report: Report): void => {
    const url = URL.createObjectURL(new Blob([report.html], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileName(report.title)}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const SharedReportView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const key = searchParams.get('k') ?? '';
    const [report, setReport] = useState<Report | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setReport(null);
        setError('');
        if (key === '') {
            setError('URL に共有キーがありません。共有されたURLをそのまま開いてください。');
            return;
        }
        (async () => {
            try {
                const res = await apiClient.post('', { request: 'shared_report_get', key });
                if (cancelled) return;
                if (res.data?.status !== 'ok') throw new Error(res.data?.message ?? '');
                setReport(res.data as Report);
            } catch (e) {
                if (!cancelled) setError(errorMessageOf(e, 'レポートを読み込めませんでした。時間をおいて開き直してください。'));
            }
        })();
        return () => { cancelled = true; };
    }, [key]);

    useEffect(() => {
        document.title = report ? `${report.title}｜Dashboard` : 'レポート｜Dashboard';
    }, [report]);

    return (
        <div className="srv_wrap">
            <style>{`
                .srv_wrap { position: fixed; inset: 0; display: flex; flex-direction: column; background: #f8fafc;
                            font-size: 13px; color: #1f2937; }
                .srv_bar { flex-shrink: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 14px;
                           background: #fff; border-bottom: 1px solid #e5e7eb; }
                .srv_title { font-weight: 700; font-size: 14px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .srv_meta { font-size: 11px; color: #6b7280; white-space: nowrap; }
                .srv_btn { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #cbd5e1; background: #fff;
                           color: #334155; border-radius: 6px; font-size: 11.5px; font-weight: 700; padding: 3px 10px; cursor: pointer;
                           text-decoration: none; white-space: nowrap; }
                .srv_btn:hover { background: #f1f5f9; }
                .srv_btn:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
                .srv_frame { flex: 1 1 auto; width: 100%; border: 0; background: #fff; }
                .srv_msg { margin: 64px auto; max-width: 520px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
                           padding: 24px; line-height: 1.9; text-align: center; }
                .srv_msg.is_error { border-color: #fecaca; background: #fef2f2; color: #991b1b; }
            `}</style>

            <div className="srv_bar">
                <i className="fa-solid fa-share-nodes" style={{ color: '#64748b' }} aria-hidden="true" />
                <span className="srv_title">{report?.title ?? '共有されたレポート'}</span>
                {report && <span className="srv_meta">{report.staffName}・{report.createdAt.slice(0, 16)} に共有</span>}
                <span className="ms-auto d-flex gap-2">
                    {report && (
                        <button type="button" className="srv_btn" onClick={() => download(report)}>
                            <i className="fa-solid fa-download" aria-hidden="true" />HTMLをダウンロード
                        </button>
                    )}
                    <a className="srv_btn" href="/dashboard/home">
                        <i className="fa-solid fa-house" aria-hidden="true" />Dashboard へ
                    </a>
                </span>
            </div>

            {error !== '' && <div className="srv_msg is_error" role="alert">{error}</div>}
            {error === '' && report === null && <div className="srv_msg">読み込み中…</div>}
            {/* ⚠️ sandbox は allow-scripts だけ（上の注記） */}
            {report && <iframe className="srv_frame" title={report.title} sandbox="allow-scripts" srcDoc={report.html} />}
        </div>
    );
};

export default SharedReportView;
```

## 新規ファイル（全文）：`frontend/src/components/header/system/SharedReports.tsx`
```tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiClient from '../../../utils/apiClient';
import {
    MAX_HTML_BYTES, SharedReportItem, copyText, createSharedReport, errorMessageOf, sharedReportUrl,
} from '../../report/sharedReport';

/**
 * 共有レポート（v2.2.268 新規）。ヘッダーの「システム管理 → 共有レポート」（⚠️ Master・BrandAdmin・Manager。headerScreens.tsx）。
 *
 * ─────────────────────────────────────────────
 *   上: HTML の登録（⚠️ Master だけ。② の shared_report_create も source = upload は Master だけ）
 *   下: 共有したレポートの一覧（⚠️ Master は全員分、ほかの人は自分が共有した分。② の shared_report_list が絞る）
 *       URLをコピー・開く・共有を止める（⚠️ 止められるのは共有した本人か Master。② も確かめる）
 *
 * ⚠️ 共有URL は Dashboard にログインしている人なら誰でも開ける（SharedReportView.tsx）。
 * ⚠️ Claudeによる分析のレポートは、ClaudeAnalysis.tsx の「共有」ボタンから共有する（ここには出てくる）。
 * ⚠️ 見た目は GoogleReview.tsx・AccessLog.tsx に合わせている（接頭辞 sr_）。⚠️ 閉じるボタンは無い（ページ）。
 * ─────────────────────────────────────────────
 */

interface ListResponse {
    status: string;
    items: SharedReportItem[];
    isMaster: boolean;
    myStaffId: number;
}

type SortState = { key: keyof SharedReportItem; order: 'asc' | 'desc' };

const SOURCE: Record<string, string> = { ai_analysis: 'Claudeによる分析', upload: 'HTMLの登録' };

const sizeText = (bytes: number): string =>
    bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;

const SharedReports: React.FC = () => {
    const [data, setData] = useState<ListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState<{ text: string; url?: string } | null>(null);
    const [showRevoked, setShowRevoked] = useState(false);
    const [sort, setSort] = useState<SortState>({ key: 'createdAt', order: 'desc' });

    // 登録（Master）
    const [title, setTitle] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'shared_report_list' });
            if (res.data?.status !== 'ok') throw new Error('unexpected response');
            setData(res.data as ListResponse);
        } catch (e) {
            console.error('共有レポートの一覧の取得に失敗しました:', e);
            setError(errorMessageOf(e, '一覧を読み込めませんでした。時間をおいて開き直してください。'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const showUrl = async (key: string, lead: string) => {
        const url = sharedReportUrl(key);
        const copied = await copyText(url);
        setNotice({ text: copied ? `${lead}URLをコピーしました。` : `${lead}下のURLをコピーして渡してください。`, url });
    };

    const pickFile = (f: File | null) => {
        setFile(f);
        if (f !== null && title.trim() === '') setTitle(f.name.replace(/\.html?$/i, ''));
    };

    const upload = async () => {
        if (file === null) { setError('HTML ファイルを選んでください。'); return; }
        if (title.trim() === '') { setError('題を入れてください。'); return; }
        if (file.size > MAX_HTML_BYTES) { setError('HTML が大きすぎます（5MBまで）。'); return; }
        setUploading(true);
        setError('');
        try {
            const html = await file.text();
            const { item } = await createSharedReport({ source: 'upload', title: title.trim(), html });
            setTitle('');
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
            await showUrl(item.key, `「${item.title}」を登録しました。`);
            await load();
        } catch (e) {
            setError(errorMessageOf(e, '登録できませんでした。'));
        } finally {
            setUploading(false);
        }
    };

    const revoke = async (item: SharedReportItem) => {
        if (!window.confirm(`「${item.title}」の共有を止めますか？\n止めると、このURLでは誰も見られなくなります（元に戻せません）。`)) return;
        setError('');
        try {
            const res = await apiClient.post('', { request: 'shared_report_revoke', id: item.id });
            if (res.data?.status !== 'ok') throw new Error(res.data?.message ?? '');
            setNotice({ text: `「${item.title}」の共有を止めました。` });
            await load();
        } catch (e) {
            setError(errorMessageOf(e, '共有を止められませんでした。'));
        }
    };

    const items = useMemo(() => {
        const list = (data?.items ?? []).filter((r) => showRevoked || r.revokedAt === null);
        const dir = sort.order === 'asc' ? 1 : -1;
        return [...list].sort((a, b) => {
            const av = a[sort.key] ?? '';
            const bv = b[sort.key] ?? '';
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av).localeCompare(String(bv), 'ja') * dir;
        });
    }, [data, showRevoked, sort]);

    const active = (data?.items ?? []).filter((r) => r.revokedAt === null);
    const views = active.reduce((t, r) => t + r.viewCount, 0);
    const revokedCount = (data?.items.length ?? 0) - active.length;

    const th = (label: string, key: keyof SharedReportItem, width?: number, numeric = false) => {
        const on = sort.key === key;
        return (
            <th className={`sr_th sr_th_sort${numeric ? ' sr_num' : ''}`} style={{ width }} title="クリックで並べ替え"
                onClick={() => setSort((p) => (on ? { key, order: p.order === 'asc' ? 'desc' : 'asc' } : { key, order: numeric || String(key).endsWith('At') ? 'desc' : 'asc' }))}>
                {label}<span className={`sr_sort_icon${on ? ' is_active' : ''}`}>{on ? (sort.order === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const kpi = (label: string, value: string) => (
        <div className="sr_kpi_card"><div className="sr_kpi_label">{label}</div><div className="sr_kpi_value">{value}</div></div>
    );

    return (
        <div className="sr_wrap">
            <style>{`
                .sr_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 12px 40px 20px; box-sizing: border-box; }
                .sr_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column;
                            min-height: 0; flex: 1; gap: 10px; }
                .sr_note { font-size: 11px; color: #6b7280; }
                .sr_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc;
                          border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; flex-shrink: 0; }
                .sr_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .sr_kpi { display: flex; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }
                .sr_kpi_card { flex: 1 1 130px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .sr_kpi_label { font-size: 11px; color: #6b7280; }
                .sr_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .sr_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }
                .sr_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
                            padding: 8px 12px; flex-shrink: 0; }
                .sr_ok { font-size: 12px; color: #166534; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
                         padding: 8px 12px; flex-shrink: 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
                .sr_url { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; width: min(100%, 560px); }
                .sr_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff;
                                 flex: 1 1 auto; min-height: 240px; }
                .sr_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .sr_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .sr_th_sort { cursor: pointer; user-select: none; }
                .sr_th_sort:hover { background: #eef2f7; }
                .sr_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .sr_sort_icon.is_active { color: #2563eb; }
                .sr_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: middle; }
                .sr_row:hover > .sr_td { background: #f8fafc; }
                .sr_row.is_revoked > .sr_td { color: #9ca3af; }
                .sr_num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
                .sr_time { white-space: nowrap; font-variant-numeric: tabular-nums; }
                .sr_pill { display: inline-block; border-radius: 999px; font-size: 10px; font-weight: 700; padding: 1px 8px; white-space: nowrap; }
                .sr_pill.is_on { background: #dcfce7; color: #166534; }
                .sr_pill.is_off { background: #f3f4f6; color: #6b7280; }
                .sr_pill.is_ai { background: #fdf2ec; color: #b4532a; }
                .sr_pill.is_up { background: #eff6ff; color: #1e40af; }
                .sr_btn { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 6px; font-size: 11px;
                          font-weight: 700; padding: 2px 8px; cursor: pointer; white-space: nowrap; text-decoration: none; display: inline-block; }
                .sr_btn:hover { background: #f1f5f9; }
                .sr_btn.is_danger { color: #b91c1c; border-color: #fecaca; }
                .sr_btn.is_danger:hover { background: #fef2f2; }
                .sr_empty { text-align: center; color: #9ca3af; padding: 32px 0; }
                @media (max-width: 900px) { .sr_wrap { padding: 12px 16px 16px; } }
            `}</style>

            <div className="sr_inner">
                <div className="sr_note">
                    共有したレポートの一覧です。共有URLは、Dashboard にログインしている人なら誰でも開けます（ログインしていなければログイン画面のあとに開きます）。
                    {data && !data.isMaster && ' あなたが共有したレポートだけを出しています。'}
                </div>

                {data?.isMaster && (
                    <div className="sr_bar">
                        <div>
                            <div className="sr_label">HTML ファイル（5MBまで）</div>
                            <input ref={fileRef} type="file" accept=".html,.htm,text/html" className="form-control form-control-sm"
                                style={{ width: 300 }} onChange={(e) => pickFile(e.target.files?.[0] ?? null)} aria-label="HTML ファイル" />
                        </div>
                        <div>
                            <div className="sr_label">題</div>
                            <input className="form-control form-control-sm" style={{ width: 320 }} value={title} maxLength={200}
                                placeholder="例：新春CP期 注文反響の歩留まり" onChange={(e) => setTitle(e.target.value)} aria-label="題" />
                        </div>
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => void upload()} disabled={uploading}>
                            {uploading ? '登録中…' : '登録して共有URLを作る'}
                        </button>
                    </div>
                )}

                {error !== '' && <div className="sr_error" role="alert">{error}</div>}
                {notice && (
                    <div className="sr_ok" role="status">
                        <span>{notice.text}</span>
                        {notice.url && (
                            <>
                                <input className="form-control form-control-sm sr_url" readOnly value={notice.url}
                                    onFocus={(e) => e.target.select()} aria-label="共有URL" />
                                <a className="sr_btn" href={notice.url} target="_blank" rel="noopener noreferrer">開く</a>
                            </>
                        )}
                    </div>
                )}

                {data && (
                    <>
                        <div className="sr_kpi">
                            {kpi('共有中', `${active.length.toLocaleString()}件`)}
                            {kpi('共有中のレポートが開かれた回数', views.toLocaleString())}
                            {kpi('止めた共有', `${revokedCount.toLocaleString()}件`)}
                        </div>

                        <div className="sr_caution">
                            レポートには個人名や成績が入ることがあります。URL は社内の人だけに渡してください。必要がなくなった共有は「止める」を押してください（止めると、そのURLでは誰も見られなくなります）。
                        </div>

                        <div className="d-flex align-items-center gap-2">
                            <div className="form-check form-switch m-0">
                                <input id="sr_revoked" className="form-check-input" type="checkbox" checked={showRevoked}
                                    onChange={(e) => setShowRevoked(e.target.checked)} />
                                <label htmlFor="sr_revoked" className="form-check-label sr_note">止めた共有も出す</label>
                            </div>
                            <button type="button" className="sr_btn ms-auto" onClick={() => void load()} disabled={loading}>
                                {loading ? '読み込み中…' : '読み直す'}
                            </button>
                        </div>

                        <div className="sr_table_wrap">
                            <table className="sr_table">
                                <thead>
                                    <tr>
                                        {th('題', 'title')}
                                        {th('元', 'source', 130)}
                                        {th('共有した人', 'staffName', 130)}
                                        {th('共有した日時', 'createdAt', 140)}
                                        {th('開かれた回数', 'viewCount', 100, true)}
                                        {th('最後に開かれた', 'lastViewedAt', 140)}
                                        {th('大きさ', 'htmlBytes', 70, true)}
                                        {th('状態', 'revokedAt', 80)}
                                        <th className="sr_th" style={{ width: 210 }}>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length === 0 && (
                                        <tr><td className="sr_td sr_empty" colSpan={9}>{loading ? '読み込み中…' : '共有したレポートはありません'}</td></tr>
                                    )}
                                    {items.map((r) => {
                                        const on = r.revokedAt === null;
                                        const mine = data.isMaster || r.staffId === data.myStaffId;
                                        return (
                                            <tr key={r.id} className={`sr_row${on ? '' : ' is_revoked'}`}>
                                                <td className="sr_td">{r.title}</td>
                                                <td className="sr_td">
                                                    <span className={`sr_pill ${r.source === 'ai_analysis' ? 'is_ai' : 'is_up'}`}>{SOURCE[r.source] ?? r.source}</span>
                                                </td>
                                                <td className="sr_td">{r.staffName}</td>
                                                <td className="sr_td sr_time">{r.createdAt.slice(0, 16)}</td>
                                                <td className="sr_td sr_num">{r.viewCount.toLocaleString()}</td>
                                                <td className="sr_td sr_time">{r.lastViewedAt?.slice(0, 16) ?? '—'}</td>
                                                <td className="sr_td sr_num">{sizeText(r.htmlBytes)}</td>
                                                <td className="sr_td">
                                                    <span className={`sr_pill ${on ? 'is_on' : 'is_off'}`} title={on ? '' : `${r.revokedAt} に停止`}>{on ? '共有中' : '停止'}</span>
                                                </td>
                                                <td className="sr_td">
                                                    {on && (
                                                        <span className="d-inline-flex gap-1">
                                                            <button type="button" className="sr_btn" onClick={() => void showUrl(r.key, '')}>URLをコピー</button>
                                                            <a className="sr_btn" href={sharedReportUrl(r.key)} target="_blank" rel="noopener noreferrer">開く</a>
                                                            {mine && <button type="button" className="sr_btn is_danger" onClick={() => void revoke(r)}>止める</button>}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SharedReports;
```

## 変更（git diff）
```diff
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 1328622ff..8401035ea 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -192,6 +192,7 @@ import { runUsedQueueList, runUsedQueueMark } from '../features/callq/usedQueue'
 import { INQUIRY_CATEGORIES, MASTER_CATEGORIES, runPrivacyEraseInquiry, runPrivacyEraseMaster } from '../features/privacy';
 import type { AuthenticatedStaff } from '../types/staff';
 import { heartbeat, listAccessLog, openAccess } from '../features/accessLog';
+import { createSharedReport, getSharedReport, listSharedReports, revokeSharedReport } from '../features/sharedReport';
 import type { GatewayContext, GatewayEntry, GatewayKey } from './types';
 import { gatewayKey } from './types';
 
@@ -1342,6 +1343,45 @@ register({
   },
 });
 
+// ---------------------------------------------------------------------------
+// レポートの共有（v2.2.268。features/sharedReport.ts）
+// ⚠️ 共有URL（/report?k=…）は Dashboard にログインしていれば誰でも見られる（auth: 'staff' で毎回トークンを確かめる）。
+// ⚠️ 作る権限は sharedReport.ts の中で見る（分析は実行した本人か Master、HTML の登録は Master）。
+// ⚠️ express_proxy.php の expressProxyRequests() と expressProxyExclusive() の両方に入れてある。
+// ---------------------------------------------------------------------------
+
+register({
+  request: 'shared_report_create',
+  summary: 'レポートの共有URLを作る（Claudeによる分析から／HTML の登録から）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => (ctx.staff === null ? null : withStatus(ctx, await createSharedReport(ctx.staff, ctx.body))),
+});
+
+register({
+  request: 'shared_report_get',
+  summary: '共有したレポート（HTML 本文つき。ログインしていれば誰でも）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => withStatus(ctx, await getSharedReport(ctx.body)),
+});
+
+register({
+  request: 'shared_report_list',
+  summary: '共有したレポートの一覧（Master は全員分、ほかは自分の分）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => (ctx.staff === null ? null : listSharedReports(ctx.staff)),
+});
+
+register({
+  request: 'shared_report_revoke',
+  summary: 'レポートの共有を止める（共有した本人か Master）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => (ctx.staff === null ? null : withStatus(ctx, await revokeSharedReport(ctx.staff, ctx.body))),
+});
+
 // ---------------------------------------------------------------------------
 // 顧客詳細モーダルの初期データ（InformationEdit / Kaeru / Resale）— 参照系のみ
 //
diff --git a/backend/scripts/guide/articles/common/screen-105.md b/backend/scripts/guide/articles/common/screen-105.md
index 39cab1550..cb5843bed 100644
--- a/backend/scripts/guide/articles/common/screen-105.md
+++ b/backend/scripts/guide/articles/common/screen-105.md
@@ -20,7 +20,7 @@ summary: 画面のいちばん上のメニュー（システム管理・反響
 だれでも開けますが、次の項目は見られる人が決まっています。見られない項目はメニューに出ません。
 - **ローン情報更新**・**広告費シミュレーター**・**セキュリティログ**・**ポータル連携ログ**・**アクセス記録**：管理者だけ
 - **アクセス解析**・**営業別契約率**・**予算テーブル**：管理者・ブランド管理者だけ
-- **Claudeによる分析**（メニューの左のボタン）：管理者・ブランド管理者・マネージャーだけ
+- **Claudeによる分析**（メニューの左のボタン）・**共有レポート**：管理者・ブランド管理者・マネージャーだけ
 - **アクションボード**：注文営業だけ
 
 > 見られない画面を、アドレスを直接入れて開いたときは「この画面を見る権限がありません」と出ます。
@@ -37,5 +37,6 @@ summary: 画面のいちばん上のメニュー（システム管理・反響
 - [[セキュリティログ]]
 - [[ポータル連携ログ]]
 - [[アクセス記録]]
+- [[共有レポート]]
 - [[予算テーブル]]
 - [[イベントの広告費入力]]
diff --git a/backend/scripts/guide/articles/common/screen-150.md b/backend/scripts/guide/articles/common/screen-150.md
index 901fc0bad..72ce89032 100644
--- a/backend/scripts/guide/articles/common/screen-150.md
+++ b/backend/scripts/guide/articles/common/screen-150.md
@@ -40,6 +40,7 @@ summary: 知りたいことを文章で頼むと、Claude がダッシュボー
 - 実行中の分析には「実行中」、終わったものには「完了」、失敗したものには「失敗」の印が付きます
 - 押すと右に出ます。実行中なら進み具合（何をしているか、何分たったか）が出ます
 - 完了したレポートは、題の右の「HTMLをダウンロード」で1つのファイルとして保存できます。保存したファイルはブラウザで開け、メールで送ったり会議で配ったりできます
+- その右の「共有」を押すと、レポートを開くURLが作られ、コピーされます。URLはダッシュボードにログインしている人だけが開けます。共有できるのは、実行した本人と管理者だけです（[[共有レポート]]）
 - 一覧には、この画面を使える人全員の分析が並びます。ほかの人の分析も開けます（開くだけなら費用はかかりません）
 - 削除できるのは、実行した本人と管理者だけです
 - 失敗したときは理由が出ます。「この依頼文を左の欄に入れる」を押すと、同じ依頼文でやり直せます
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index c9c0ff1b1..bc0cd988f 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -137,6 +137,11 @@ function expressProxyRequests(): array
         'ai_analysis_list',
         'ai_analysis_get',
         'ai_analysis_delete',
+        // ⚠️ v2.2.268。レポートの共有（/report?k=…）。⚠️ ② のみ（① に PHP 版は無い）
+        'shared_report_create',
+        'shared_report_get',
+        'shared_report_list',
+        'shared_report_revoke',
         // ⚠️ v2.2.221。不動産企画係（realty）のデータ。② で本人と担当事業を確かめる
         //   ⚠️ 読み出しは ② に届かなければ ① の PHP が代わりに処理する（① でも同じ確認をする）
         'planner:lead',
@@ -861,6 +866,12 @@ function expressProxyExclusive(): array
         'ai_analysis_get',
         'ai_analysis_delete',
 
+        // v2.2.268 新規。レポートの共有。⚠️ ① に PHP 版は無い
+        'shared_report_create',
+        'shared_report_get',
+        'shared_report_list',
+        'shared_report_revoke',
+
         // v2.2.221。不動産企画係の書き込み。⚠️ ② で済んだ直後に応答が失われて ① でも動くと二重に書き込むため
         'broker:update',
         'activity:read',
diff --git a/frontend/src/App.tsx b/frontend/src/App.tsx
index 0dd7b29d9..64e8bebca 100644
--- a/frontend/src/App.tsx
+++ b/frontend/src/App.tsx
@@ -55,6 +55,7 @@ import CallQueue from "./components/realty/callq/CallQueue";
 import CallNavi from "./components/realty/navi/CallNavi";
 import UsedCallQueue from "./components/callq/UsedCallQueue";
 import Guide from "./components/guide/Guide";
+import SharedReportView from "./components/report/SharedReportView";
 
 // ⚠️ v2.2.262: 不動産企画係の営業手順書は画像が多いので、開いたときだけ読み込む
 const RealtyManual = lazy(() => import("./components/realty/manual/RealtyManual"));
@@ -110,6 +111,16 @@ function AppInner() {
     );
   }
 
+  // ⚠️ v2.2.268: 共有したレポート（`/report?k=…`）も業務ガイドと同じく、ヘッダー・メニューを出さない全画面。
+  //   ⚠️ ログイン確認（AuthProvider）は効く（未ログインならログイン画面へ移り、ログイン後に戻る）
+  if (currentPath === '/report') {
+    return (
+      <Routes>
+        <Route path="/report" element={<SharedReportView />} />
+      </Routes>
+    );
+  }
+
 
   return (
     <>
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index 00e71eab8..29f48c690 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -108,6 +108,8 @@ export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     // ⚠️ v2.2.266 で「同期の実行結果」から改名
     'ポータル連携ログ': { header: 'システム管理/ポータル連携ログ', authority: ['Master'] },
     'アクセス記録': { header: 'システム管理/アクセス記録', authority: ['Master'] },
+    // ⚠️ v2.2.268。headerScreens.tsx と同じく Master / BrandAdmin / Manager
+    '共有レポート': { header: 'システム管理/共有レポート', authority: ['Master', 'BrandAdmin', 'Manager'] },
     // ⚠️ v2.2.243。headerScreens.tsx と同じく Master / BrandAdmin
     '予算テーブル': { header: 'システム管理/予算テーブル', authority: ADMIN },
 };
diff --git a/frontend/src/components/header/claude/ClaudeAnalysis.tsx b/frontend/src/components/header/claude/ClaudeAnalysis.tsx
index 363764319..633d426a4 100644
--- a/frontend/src/components/header/claude/ClaudeAnalysis.tsx
+++ b/frontend/src/components/header/claude/ClaudeAnalysis.tsx
@@ -3,6 +3,7 @@ import AuthContext from '../../../context/AuthContext';
 import apiClient from '../../../utils/apiClient';
 import { CLAUDE_ORANGE } from './ClaudeIcon';
 import ClaudeAnalysisResult from './ClaudeAnalysisResult';
+import { copyText, createSharedReport, sharedReportUrl } from '../../report/sharedReport';
 import type { AnalysisKind, AnySnapshot, StructuredAnalysis } from './ClaudeAnalysisResult';
 
 /**
@@ -170,6 +171,9 @@ const ClaudeAnalysis: React.FC = () => {
     // 右
     const [selected, setSelected] = useState<Selected | null>(null);
     const [html, setHtml] = useState<{ id: number; html: string } | null>(null);
+    // ⚠️ v2.2.268: 共有URL（分析の id ごと。別の分析を選んだら出さない）
+    const [share, setShare] = useState<{ id: number; url: string; text: string; error: boolean } | null>(null);
+    const [sharing, setSharing] = useState(false);
     const [legacyBody, setLegacyBody] = useState<{ analysis: StructuredAnalysis; kpi: AnySnapshot } | null>(null);
 
     const [starting, setStarting] = useState(false);
@@ -257,6 +261,26 @@ const ClaudeAnalysis: React.FC = () => {
         ? '期間を選んでください。'
         : period.from > period.to ? '開始月が終了月より後になっています。' : '';
     const limitReached = usedToday >= dailyLimit;
+    /**
+     * 共有URLを作ってコピーする（v2.2.268）。⚠️ 同じ分析をすでに共有していれば、② が同じURLを返す。
+     * ⚠️ URL は Dashboard にログインしている人なら誰でも開ける（report/SharedReportView.tsx）。
+     */
+    const shareJob = async (job: Job) => {
+        setSharing(true);
+        try {
+            const { item, reused } = await createSharedReport({ source: 'ai_analysis', id: job.id });
+            const url = sharedReportUrl(item.key);
+            const copied = await copyText(url);
+            const lead = reused ? 'この分析はすでに共有しています。' : '共有URLを作りました。';
+            setShare({ id: job.id, url, error: false,
+                text: copied ? `${lead}URLをコピーしました（ログインしている人だけが開けます）。` : `${lead}下のURLをコピーして渡してください。` });
+        } catch (e) {
+            setShare({ id: job.id, url: '', error: true, text: errorMessageOf(e, '共有URLを作れませんでした。') });
+        } finally {
+            setSharing(false);
+        }
+    };
+
     const myActive = jobs.some((job) => isActive(job.status) && job.staffId === myStaffId);
     const canStart = !starting && !myActive && prompt.trim().length >= 5 && periodError === '' && !limitReached;
 
@@ -393,6 +417,12 @@ const ClaudeAnalysis: React.FC = () => {
                                 font-weight: 700; padding: 3px 10px; cursor: pointer; }
                 .cla_download:hover { background: #fdf8f6; }
                 .cla_download:focus-visible { outline: 2px solid ${CLAUDE_ORANGE}; outline-offset: 2px; }
+                .cla_download:disabled { opacity: .6; cursor: default; }
+                .cla_share { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 12px; font-size: 12px;
+                             color: #166534; background: #f0fdf4; border-bottom: 1px solid #bbf7d0; }
+                .cla_share.is_error { color: #b91c1c; background: #fef2f2; border-bottom-color: #fecaca; }
+                .cla_share_url { width: min(100%, 520px); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; }
+                .cla_share_close { border: 0; background: none; color: #6b7280; cursor: pointer; margin-left: auto; font-size: 12px; }
                 .cla_empty { padding: 48px 24px; color: #6b7280; font-size: 12.5px; line-height: 1.9; max-width: 640px; margin: 0 auto; }
                 .cla_empty h3 { font-size: 15px; color: #1f2937; margin: 0 0 8px; font-weight: 700; }
                 .cla_running { padding: 48px 24px; display: flex; flex-direction: column; align-items: center; gap: 12px;
@@ -574,12 +604,34 @@ const ClaudeAnalysis: React.FC = () => {
                                             HTMLをダウンロード
                                         </button>
                                     )}
+                                    {/* ⚠️ v2.2.268: 共有は実行した本人か Master（② の shared_report_create も確かめる） */}
+                                    {selectedJob.status === 'done' && html?.id === selectedJob.id && (isMaster || selectedJob.staffId === myStaffId) && (
+                                        <button type="button" className="cla_download" disabled={sharing}
+                                            onClick={() => void shareJob(selectedJob)}>
+                                            <i className="fa-solid fa-share-nodes" aria-hidden="true" />
+                                            {sharing ? '共有中…' : '共有'}
+                                        </button>
+                                    )}
                                     <span className="cla_note ms-auto">
                                         {selectedJob.staffName}・{shortTime(selectedJob.createdAt)}
                                         {selectedJob.status === 'done' && selectedJob.costUsd !== null && `・約 $${selectedJob.costUsd.toFixed(2)}`}
                                     </span>
                                 </div>
 
+                                {share !== null && share.id === selectedJob.id && (
+                                    <div className={`cla_share${share.error ? ' is_error' : ''}`} role="status">
+                                        <span>{share.text}</span>
+                                        {share.url !== '' && (
+                                            <>
+                                                <input className="form-control form-control-sm cla_share_url" readOnly value={share.url}
+                                                    onFocus={(e) => e.target.select()} aria-label="共有URL" />
+                                                <a className="cla_download" href={share.url} target="_blank" rel="noopener noreferrer">開く</a>
+                                            </>
+                                        )}
+                                        <button type="button" className="cla_share_close" aria-label="閉じる" onClick={() => setShare(null)}>✕</button>
+                                    </div>
+                                )}
+
                                 {isActive(selectedJob.status) && (
                                     <div className="cla_running">
                                         <div className="spinner-border" style={{ color: CLAUDE_ORANGE }} role="status">
diff --git a/frontend/src/components/header/headerScreens.tsx b/frontend/src/components/header/headerScreens.tsx
index a9042b16b..1875b2161 100644
--- a/frontend/src/components/header/headerScreens.tsx
+++ b/frontend/src/components/header/headerScreens.tsx
@@ -7,6 +7,7 @@ import UploadLoan from './system/UploadLoan';
 import SecurityLog from './system/SecurityLog';
 import SyncLog from './system/SyncLog';
 import AccessLog from './system/AccessLog';
+import SharedReports from './system/SharedReports';
 import BudgetTable from './system/BudgetTable';
 import EditBlackList from './inquiry/EditBlackList';
 import BudgetSimulator from './inquiry/BudgetSimulator';
@@ -131,6 +132,12 @@ export const HEADER_SCREENS: HeaderScreen[] = [
     { menu: 'システム管理', item: 'ポータル連携ログ', path: '/syncLog', allow: isMaster, render: () => <SyncLog /> },
     // ⚠️ v2.2.266: アクセス記録は ⚠️⚠️ **Master だけ**（② の access_log_list も auth: 'master'）
     { menu: 'システム管理', item: 'アクセス記録', path: '/accessLog', allow: isMaster, render: () => <AccessLog /> },
+    // ⚠️ v2.2.268: 共有レポートは「Claudeによる分析」と同じ3つの権限（共有ボタンがそこにあるため）。
+    //   ⚠️ 一覧は Master が全員分、ほかは自分の分。HTML の登録は Master だけ（② の shared_report_* も確かめる）
+    {
+        menu: 'システム管理', item: '共有レポート', path: '/sharedReports',
+        allow: ({ authority }) => AI_ANALYSIS_AUTHORITY.includes(authority), render: () => <SharedReports />,
+    },
     // ⚠️ v2.2.243: 予算テーブルは ⚠️⚠️ **Master と BrandAdmin**（budget へ CSV で追加できるため。② の budget_table_* も同じ2つ）
     { menu: 'システム管理', item: '予算テーブル', path: '/budgetTable', allow: isAdmin, render: () => <BudgetTable /> },
 
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index cd513e8a3..69e41e479 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.267';
+export const newVersion = '2.2.268';
```
