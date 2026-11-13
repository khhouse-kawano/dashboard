# 作業記録 2026-11-10-02　v2.2.259　sync の実行結果を DB に残し、システム管理で見る

## 依頼
- `projects/sync` のすべての結果を、メールではなく DB に登録する。成功も失敗も残し、失敗なら理由まで。
- 次のものを用意する：そのための表、表を作る SQL、結果を Dashboard に表示する機能。表示は `frontend/src/components/header` のシステム管理に足す。
- 利用者の決定
  - 共有の鍵（合い言葉）は、デプロイのときに知らせ直す。
  - sync は利用者が最新を push 済み。
  - メールはやめてよい。
  - 残す期間は180日。
- 途中で追加：`runIeloveProperty.ts` のエラーが気になるので、各作業の終わりに「ログイン成功」などのコンソールを出したい。

## 背景（2026-11-10 の Heroku のログ）
- ielove：3店舗とも物件一覧が「403 Forbidden」でした。ローカルでは成功するので、Heroku の接続元が弾かれている説が有力です。
  - 例外を投げないため、結果は `ok: true`「更新が完了しました」になっていた。
- 失敗のメール：Gmail が `535 Username and Password not accepted` を返し、届いていなかった。

## 作り
```
sync（Heroku）── POST（合い言葉）──► ② sync_log:write ──► sync_run_log（① DB）
                                                         ▲
Dashboard「システム管理 → 同期の実行結果」── ① ──► ② sync_log_list（Master だけ）
```
- 1回の実行の1タスクにつき1行。状態は3つ。
  - `success`：失敗なし
  - `partial`：最後まで動いたが、途中で失敗あり（`sendErrorMail` に理由が来た）
  - `failure`：例外で止まった
- portal（`/api/portal`・`/api/portal_kaeru`）は、タスクごとに1行（`runTask`）。応答をすぐ返し、裏で処理するので、入口の行は書かない。
- ほかのジョブの入口は、応答のときに1行。応答のあとに来た失敗は、別の行（partial）で送る。
  - 対象：`/api`・update・robo・before_survey・add_event・breakaway・weekday・mail_scraping・estate_info
  - 記録しない入口：AI のまとめ（summary・areasummary）・PDF→PPT・`/open`（GET）。画面から呼ぶ対話の口なので。
- 書き込みは sync から ② へ直接送る（① は通さない。① の転送リストにも入れない）。
  - 合い言葉 `SYNC_LOG_SECRET` を timingSafeEqual で確かめる。未設定なら全件 401。
  - 総当たりは、流量の上限（失敗だけを数え、20回/10分）で止める。
- 送れなくても、sync の処理は止めない（コンソールに出すだけ）。
- 180日より古い行は、② が起動の5分後と毎日消す。

## 変えたもの（Dashboard。ブランチ v2.2.259）
| 区分 | ファイル | 内容 |
|---|---|---|
| ① DB | `backend/scripts/sql/2026-11-10_sync_run_log.sql`（**新規**） | 表 `sync_run_log`（run_id・route・task・status・message・errors（JSON）・started_at・finished_at（日本時間）・duration_ms）。索引3つ |
| ① DB | `backend/scripts/sql/2026-11-10_update_log_2.2.259.sql`（**新規**） | 更新履歴＋業務ガイド2本 |
| ② | `backend-express/src/features/syncLog.ts`（**新規**） | `writeSyncLog`（合い言葉・行の確かめ・切り詰め・日本時間）、`listSyncLog`（期間・タスク・状態の行と、タスクごとの最新・最後の成功・7日の失敗）、`startSyncLogMaintenance`（180日） |
| ② | `backend-express/src/config/env.ts` | `syncLogSecret`（SYNC_LOG_SECRET） |
| ② | `backend-express/src/gateway/registry.ts` | `sync_log:write`（auth none）・`sync_log_list`（auth master） |
| ② | `backend-express/src/middlewares/publicFormRateLimit.ts` | `syncLogLimiter`（失敗だけを数える 20回/10分） |
| ② | `backend-express/src/server.ts` | `startSyncLogMaintenance()` |
| ② | `docker-compose.yml`・`docker-compose.prod.yml` | `SYNC_LOG_SECRET`（開発は `localtest`。本番は `.env.prod` の値を渡す） |
| ① | `backend/src/core/express_proxy.php` | `sync_log_list` を両方のリストに |
| 画面 | `frontend/src/components/header/system/SyncLog.tsx`（**新規**） | 「同期の実行結果」（下） |
| 画面 | `frontend/src/components/header/headerScreens.tsx` | システム管理 → 同期の実行結果（`/syncLog`。Master だけ） |
| 画面 | `frontend/src/components/guide/guideScreens.ts` | `'同期の実行結果'` |
| 画面 | `frontend/src/utils/version.ts` | 2.2.259 |
| 記事 | `common/screen-198.md`（**新規**）・`common/screen-105.md` | 下の「業務ガイド」 |

### 画面（SyncLog.tsx。接頭辞 sy_。SecurityLog.tsx と同じ形）
- 絞り込みのバー：期間（履歴。既定は直近7日）・タスク・状態・表示。
- KPI：実行（期間）・成功・一部失敗・失敗・**24時間以上成功していないタスク**。
- タスクごとの最新：期間に関係なく、180日分から出す。
  - 列：タスク（日本語の名前とキー）・最新の状態・最後の実行・**最後の成功**・7日の失敗・内容。
  - 止まっているタスク（最後の成功が24時間以上前、または記録なし）は赤で、上に並べる。
  - タスク名を押すと、履歴をそのタスクに絞る。
- 履歴：見出しで並べ替え、見出しは固定。行の「理由を見る」で理由の全文。

## 変えたもの（sync。リポジトリ projects/sync、ブランチ `sync-log`、コミット 17be3bf）
| ファイル | 内容 |
|---|---|
| `src/utils/syncLog.ts`（**新規**） | AsyncLocalStorage で、入口・タスクごとの入れ物を持つ。`recordErrors`・`recordTaskResult`・`runTask`・`syncLogMiddleware`・`post`（② へ） |
| `src/app.ts` | `app.use(syncLogMiddleware)`（ルーターより前） |
| `src/services/portalService.ts` | タスクを `runTask` で包む。partial は `ok: false` にした（以前は「更新が完了しました」）。認証情報なし・関数なしも1行 |
| `src/services/sendErrorMail.ts` | **メールをやめ**、`recordErrors` を呼んで配列を空にする（名前は、32ファイルを変えずに済むよう残した） |
| `runBeforeSurvey`・`runDataRegistration`・`runDataRegistrationBeforeInterview`・`runDataUpdateAfterInterview`・`runDataUpdateBeforeInterview`・`runDataUpdateNew`・`runMyHomeRobo` | 自前のエラーのメール（nodemailer）を、記録に置き換えた |
| `src/services/runWeekday.ts` | 反響のメール（業務）は残し、送れなかったことだけを記録する |
| `src/services/runIeloveProperty.ts` | 下の「ielove のコンソール」 |

- 配列の扱い：以前に配列を空にしていたファイルは `sendErrorMail`（空にする）、`runBeforeSurvey` は後ろで空にしているので `recordErrors`。
  - `runDataUpdateAfterInterview`・`runMyHomeRobo` は、配列がモジュールで1つなのに空にしていなかった。毎回、前回の理由まで送っていたので、`sendErrorMail` で空にするようにした。
- ⚠️ `runMyHomeRobo.ts` には、Gmail のアプリパスワードがソースにそのまま書かれていた。今回のコミットでソースからは消えたが、**git の履歴には残る**ので、利用者に無効化を依頼した（この記録には値を載せない）。

### ielove のコンソール（利用者の追加の依頼）
- `[ielove] ✅ ログイン成功（URL・画面タイトル）`
  - 送信のあとにパスワード欄がまだ見えていれば「ログイン画面のまま」として失敗にする（画面の状態を保存）。以前は確かめていなかった。
- `[ielove][店舗: X] ✅ 物件一覧を開きました（HTTP 200）`
  - **HTTP 400 以上なら、すぐ失敗**にする（以前は60秒待っていた）。画面の状態を保存し、「接続元（Heroku の IP）が弾かれている可能性」と書く。
- `[ielove][店舗: X] ✅ CSV をダウンロードしました`
- `[ielove][店舗: X] ✅ DB 登録に成功しました（N件）` か `❌ DB 登録に失敗しました`（`postToPhpApi` が成否を返すようにした）。0件のときは `⚠️ CSV に物件がありませんでした`。
- 最後に `[ielove] 店舗ごとの結果: 86679: 成功 120件 / 96031: 失敗 / …`
- あわせて、`syncLog` が各タスクの終わりに `[実行結果] property: partial（…）理由 3件` を出す。

## 業務ガイド
- 新規「同期の実行結果」（common/screen-198）：画面の見方、状態の意味、180日、失敗が続くときの連絡（要確認）、メールをやめたこと。
- 「ヘッダーのメニュー」（common/screen-105）：管理者だけの項目と、記事の一覧に足した。

## テスト
- 型チェック：② `npx tsc --noEmit` 通過。フロント `npx tsc --noEmit` 通過。sync `npx tsc --noEmit` 通過（整理のあとにも）。
- API（`scratchpad/api_259.cjs`）：**14項目 OK**
  - ① 経由・トークン無しの `sync_log_list` は 401。Master 以外は 403。
  - ② への書き込み：合い言葉なし・違いは 401。① 経由では書けない（404）。
  - 正しい合い言葉なら書ける（形の違う4行は捨てる）。理由の長い文は 4000字で切り詰める。開始は日本時間で入る。
  - ① 経由・Master で一覧が読める。タスクごとの最新（最新は失敗・最後の成功は30時間前、最後の成功なし）。
  - タスク・状態・期間で絞れる。最新の表は、期間に関係なく出る。
- sync の部品（`scratchpad/sync_log_test.ts`）：本物のタスクは動かさず、小さな Express に載せて、ローカルの ② へ送った。
  - 結果：成功・partial・failure、portal のタスクごとの行（同じ run_id）、実行関数なし、応答のあとの失敗の別の行。
  - summary・OPTIONS は記録しない。整理のあとにもう一度通した。
- 画面（Playwright・3100。`scratchpad/pw_259.cjs`）：**11項目 OK**
  - 止まっているタスクが先頭（2日前）。KPI（24時間以上・一部失敗）。理由を開くと3件。
  - タスク名で絞る。状態で絞る。メニューに出る。
  - 390px で横にはみ出さない。画面のエラーなし（1440px・390px）。
- 後片付け：テストの行（sync_run_log）0件、仮スタッフ 999999・999998 を削除、開発サーバー 3100 を停止。

## 残したこと
- ヘッダーの通知（24時間以上成功していないタスクを知らせる）は、次の版の候補（計画のときに提案）。
- ielove の 403 そのものは、接続元の IP の問題なので、コードでは直らない。いえらぶの管理者の設定の確認か、固定 IP（Heroku の追加機能、または ② の VPS で動かす）が要る。

## 新規ファイルの全文

### backend-express/src/features/syncLog.ts
```ts
import { timingSafeEqual } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env';
import { execute, query } from '../db/pool';
import { logger } from '../utils/logger';

/**
 * sync（Heroku の自動取り込み。projects/sync）の実行結果（v2.2.259）。表は sync_run_log。
 *
 * ─────────────────────────────────────────────
 *   書く … sync_log:write（sync が ② へ直接送る。ログイン無し・合い言葉 SYNC_LOG_SECRET）
 *          ⚠️ 以前は失敗をメールで送っていた（sendErrorMail）。Gmail の認証が切れて届かなくなり、
 *             成功は残らず、店舗ごとの失敗は「成功」に隠れていた（2026-11-10 の ielove の 403）
 *   読む … sync_log_list（Master だけ。システム管理 →「同期の実行結果」header/system/SyncLog.tsx）
 *   消す … 180日より古い行を、起動の5分後と毎日（startSyncLogMaintenance）
 * ─────────────────────────────────────────────
 */

interface DynamicRow extends RowDataPacket {
  [key: string]: unknown;
}

export interface SyncLogResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const KEEP_DAYS = 180;
const STATUSES = ['success', 'partial', 'failure'] as const;
type SyncStatus = (typeof STATUSES)[number];
/** 1回に受ける行の上限（portal の全タスクでも 40 に届かない） */
const MAX_ROWS = 100;
/** 理由の1件・件数の上限（画面のスクリーンショットの HTML などが丸ごと来ても表を膨らませない） */
const MAX_ERROR_LEN = 4000;
const MAX_ERRORS = 50;
/** 一覧で返す行の上限 */
const LIST_LIMIT = 2000;

const fail = (httpStatus: number, message: string): SyncLogResult => ({ httpStatus, body: { status: 'error', message } });
const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const cut = (v: unknown, max: number): string => str(v).slice(0, max);

/** 合い言葉。⚠️ 未設定なら必ず false。⚠️ 長さが違うと timingSafeEqual が例外を投げるので先に比べる（meta_scrape と同じ） */
const keyMatches = (input: string): boolean => {
  const expected = env.syncLogSecret;
  if (expected === '') return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** ISO の日時（sync は UTC の toISOString で送る）→ 日本時間の 'YYYY-MM-DD HH:MM:SS'。読めなければ null */
const toJst = (v: unknown): string | null => {
  const ms = Date.parse(str(v));
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
};

type CleanRow = [string, string, string, SyncStatus, string, string | null, string, string, number];

/** 1行を確かめて、INSERT の値にする。⚠️ 形が違う行は null（その行だけ捨てる） */
const cleanRow = (raw: unknown): CleanRow | null => {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const status = str(r.status) as SyncStatus;
  const runId = cut(r.runId, 40).trim();
  const task = cut(r.task, 100).trim();
  const started = toJst(r.startedAt);
  const finished = toJst(r.finishedAt);
  if (!STATUSES.includes(status) || runId === '' || task === '' || started === null || finished === null) return null;
  const errors = Array.isArray(r.errors)
    ? r.errors.slice(0, MAX_ERRORS).map((e) => cut(e, MAX_ERROR_LEN)).filter((e) => e !== '')
    : [];
  const duration = Math.max(0, Math.min(2_147_483_647, Math.round(Date.parse(str(r.finishedAt)) - Date.parse(str(r.startedAt)))));
  return [runId, cut(r.route, 100).trim() || '(不明)', task, status, cut(r.message, 500), errors.length ? JSON.stringify(errors) : null, started, finished, duration];
};

/**
 * sync_log:write。body = { key, rows: [{ runId, route, task, status, message, errors[], startedAt, finishedAt }] }
 * 応答: { status: 'success', saved, skipped }。合い言葉が違えば 401（流量の上限は失敗だけを数える。publicFormRateLimit.ts）
 */
export const writeSyncLog = async (body: Record<string, unknown>): Promise<SyncLogResult> => {
  if (!keyMatches(str(body.key))) {
    if (env.syncLogSecret === '') logger.warn('sync_log: SYNC_LOG_SECRET が未設定のため、sync の実行結果を断りました。');
    return fail(401, '合い言葉が正しくありません');
  }
  const list = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [];
  const rows = list.map(cleanRow).filter((r): r is CleanRow => r !== null);
  if (rows.length > 0) {
    await execute(
      `INSERT INTO sync_run_log (run_id, route, task, status, message, errors, started_at, finished_at, duration_ms)
       VALUES ${rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      rows.flat()
    );
  }
  return { httpStatus: 200, body: { status: 'success', saved: rows.length, skipped: list.length - rows.length } };
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * sync_log_list。body = { from?, to?（YYYY-MM-DD。既定は直近7日）, task?, status? }
 * 応答:
 *   rows    … 期間・絞り込みの行（新しい順・最大 LIST_LIMIT 件）
 *   latest  … タスクごとの最新の結果・最後の成功（⚠️ 期間に関係なく、残っている 180日分から）
 *   tasks   … 残っているタスクの名前
 */
export const listSyncLog = async (body: Record<string, unknown>): Promise<SyncLogResult> => {
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() + 9 * 3600_000 - 6 * 86400_000).toISOString().slice(0, 10);
  const from = DATE_RE.test(str(body.from)) ? str(body.from) : weekAgo;
  const to = DATE_RE.test(str(body.to)) ? str(body.to) : today;
  const where = ['started_at >= ?', 'started_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const params: string[] = [from, to];
  const task = str(body.task).trim();
  if (task !== '') { where.push('task = ?'); params.push(task); }
  const status = str(body.status);
  if ((STATUSES as readonly string[]).includes(status)) { where.push('status = ?'); params.push(status); }

  const [rows, latestRows, successes, failures] = await Promise.all([
    query<DynamicRow>(
      `SELECT id, run_id, route, task, status, message, errors,
              DATE_FORMAT(started_at, '%Y-%m-%d %H:%i:%s') AS started_at,
              DATE_FORMAT(finished_at, '%Y-%m-%d %H:%i:%s') AS finished_at, duration_ms
         FROM sync_run_log WHERE ${where.join(' AND ')}
        ORDER BY started_at DESC, id DESC LIMIT ${LIST_LIMIT}`,
      params
    ),
    // ⚠️ タスクごとの最新の1行。⚠️ id は書き込んだ順（sync はタスクが終わったときに送る）なので、MAX(id) を最新とする
    query<DynamicRow>(
      `SELECT l.task, l.status, l.message, l.errors, l.route,
              DATE_FORMAT(l.started_at, '%Y-%m-%d %H:%i:%s') AS started_at, l.duration_ms
         FROM sync_run_log l
         JOIN (SELECT task, MAX(id) AS id FROM sync_run_log GROUP BY task) m ON m.id = l.id
        ORDER BY l.task`
    ),
    query<DynamicRow>(
      `SELECT task, DATE_FORMAT(MAX(started_at), '%Y-%m-%d %H:%i:%s') AS last_success
         FROM sync_run_log WHERE status = 'success' GROUP BY task`
    ),
    query<DynamicRow>(
      `SELECT task, COUNT(*) AS c FROM sync_run_log
        WHERE status <> 'success' AND started_at >= NOW() - INTERVAL 7 DAY GROUP BY task`
    ),
  ]);
  const lastSuccess = new Map(successes.map((r) => [str(r.task), str(r.last_success)]));
  const failures7d = new Map(failures.map((r) => [str(r.task), Number(r.c)]));
  const latest = latestRows.map((r) => ({
    ...r,
    last_success: lastSuccess.get(str(r.task)) || null,
    failures_7d: failures7d.get(str(r.task)) ?? 0,
  }));
  return {
    httpStatus: 200,
    body: { status: 'success', from, to, rows, latest, tasks: latestRows.map((r) => str(r.task)), limit: LIST_LIMIT },
  };
};

/** 180日より古い行を消す（起動の5分後と、その後1日ごと） */
export const startSyncLogMaintenance = (): void => {
  const run = (): void => {
    execute(`DELETE FROM sync_run_log WHERE started_at < NOW() - INTERVAL ${KEEP_DAYS} DAY LIMIT 10000`)
      .then((r) => { if (r.affectedRows > 0) logger.info(`sync_log: ${KEEP_DAYS}日より古い実行結果 ${r.affectedRows} 件を消しました`); })
      .catch((error: unknown) => logger.error('sync_log: 古い実行結果の削除に失敗しました', error));
  };
  setTimeout(run, 5 * 60_000).unref();
  setInterval(run, 24 * 3600_000).unref();
};
```

### frontend/src/components/header/system/SyncLog.tsx
```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../utils/apiClient';

/**
 * 同期の実行結果（v2.2.259 新規）。ヘッダーの「システム管理 → 同期の実行結果」（⚠️ Master だけ。headerScreens.tsx）。
 *
 * ─────────────────────────────────────────────
 *   ② sync_log_list（backend-express/src/features/syncLog.ts）で読む。⚠️ ② も Master だけに絞っている。
 *   書くのは sync（Heroku。projects/sync の utils/syncLog.ts）。以前は失敗だけをメールで送っていた（やめた）。
 *
 * ⚠️ 「タスクごとの最新」と「最後の成功」は期間に関係なく、残っている180日分から出す（止まっているタスクに気づくため）。
 * ⚠️ KPI と履歴は期間・タスク・状態の絞り込みで出す（新しい順に ② の上限まで）。
 * ⚠️ 見た目は GoogleReview.tsx・SecurityLog.tsx に合わせている（接頭辞 sy_）。⚠️ 閉じるボタンは無い（ページ。HeaderPage.tsx）。
 * ─────────────────────────────────────────────
 */

type SyncStatus = 'success' | 'partial' | 'failure';

interface LogRow {
    id: number;
    run_id: string;
    route: string;
    task: string;
    status: SyncStatus;
    message: string | null;
    errors: string | null;
    started_at: string;
    finished_at: string;
    duration_ms: number;
}

interface LatestRow {
    task: string;
    status: SyncStatus;
    message: string | null;
    errors: string | null;
    route: string;
    started_at: string;
    duration_ms: number;
    last_success: string | null;
    failures_7d: number;
}

interface ListResponse {
    status: string;
    from: string;
    to: string;
    rows: LogRow[];
    latest: LatestRow[];
    tasks: string[];
    limit: number;
}

const STATUS: Record<SyncStatus, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
    success: { label: '成功', tone: 'ok' },
    partial: { label: '一部失敗', tone: 'warn' },
    failure: { label: '失敗', tone: 'bad' },
};

/** タスクの説明（⚠️ 名前は sync の portalService.ts の actionMap・入口のパス。無いものは名前のまま） */
const TASK_LABEL: Record<string, string> = {
    property: 'いえらぶの物件（中古）',
    suumo_kaeru: 'SUUMO 反響（建売）',
    suumo_resale: 'SUUMO 反響（中古）',
    suumo_order: 'SUUMO 反響（注文）',
    homes_kaeru: "HOME'S 反響（建売）",
    homes_resale: "HOME'S 反響（中古）",
    homes_order: "HOME'S 反響（注文）",
    athome: 'アットホーム 反響',
    member_kaeru: '会員登録（建売）',
    member_resale: '会員登録（中古）',
    reserve_kaeru: '来場予約（建売）',
    reserve_resale: '来場予約（中古）',
    catalog_kaeru: '資料請求（建売）',
    catalog_resale: '資料請求（中古）',
    pre_kaeru: '事前登録（建売）',
    sumai_step_resale: 'すまいステップ（中古）',
    iei_resale: 'イエイ（中古）',
    ieuru_resale: 'イエウール（中古）',
    townlife_order: 'タウンライフ（注文）',
    suumo_summary: 'SUUMO 集計（建売）',
    suumo_summary_2: 'SUUMO 集計（中古）',
    athome_summary: 'アットホーム 集計（建売）',
    athome_summary_2: 'アットホーム 集計（中古）',
    homes_summary: "HOME'S 集計（建売）",
    homes_summary_2: "HOME'S 集計（中古）",
    hotlead: 'Hotlead（KH）',
    hotlead_2: 'Hotlead（DJH）',
    allgrit: 'ALLGRIT（LINE）',
    pg_mail: 'PG メール',
    kaeeru: 'かえーる',
    geoCode: '住所の緯度経度',
    google_review: 'Google クチコミ',
};
const labelOf = (task: string): string => TASK_LABEL[task] ?? task;

/** 最後の成功からこれ以上たつと「止まっている」とみなす */
const STALE_HOURS = 24;

/** 'YYYY-MM-DD HH:MM:SS'（日本時間）からの経過時間（時間）。⚠️ 画面を開いている PC の時計と比べる */
const hoursSince = (at: string | null): number | null => {
    if (!at) return null;
    const ms = Date.parse(at.replace(' ', 'T'));
    return Number.isFinite(ms) ? (Date.now() - ms) / 3600_000 : null;
};
const agoText = (at: string | null): string => {
    const h = hoursSince(at);
    if (h === null) return '';
    if (h < 1) return `${Math.max(0, Math.round(h * 60))}分前`;
    if (h < 48) return `${Math.floor(h)}時間前`;
    return `${Math.floor(h / 24)}日前`;
};
const durationText = (ms: number): string => (ms < 1000 ? `${ms}ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)}秒` : `${Math.floor(ms / 60_000)}分${Math.round((ms % 60_000) / 1000)}秒`);
const errorsOf = (raw: string | null): string[] => {
    if (!raw) return [];
    try { const v: unknown = JSON.parse(raw); return Array.isArray(v) ? v.map(String) : [String(raw)]; } catch { return [raw]; }
};

/** 止まっているタスク（最後の成功が無い・STALE_HOURS 以上前） */
const isStale = (l: LatestRow): boolean => {
    const h = hoursSince(l.last_success);
    return h === null || h >= STALE_HOURS;
};

type SortKey = 'started_at' | 'task' | 'status' | 'duration_ms' | 'route';

const SyncLog = () => {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [task, setTask] = useState('');
    const [status, setStatus] = useState('');
    const [data, setData] = useState<ListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('started_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [open, setOpen] = useState<number | null>(null);

    /** ⚠️ 期間・タスク・状態は ② で絞る（新しい順に上限まで返るため、画面で絞ると古い行が抜ける） */
    const load = useCallback(async (filter: { from: string; to: string; task: string; status: string }) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'sync_log_list', ...filter });
            const body = res.data as ListResponse;
            if (body?.status !== 'success') throw new Error('unexpected response');
            setData(body);
            setFrom(body.from);
            setTo(body.to);
        } catch (e) {
            console.error('同期の実行結果の取得に失敗しました:', e);
            setError('同期の実行結果を読み込めませんでした。時間をおいて「表示」を押してください。');
        } finally {
            setLoading(false);
        }
    }, []);

    // ⚠️ 開いたときは期間を ② に任せる（直近7日）
    useEffect(() => { void load({ from: '', to: '', task: '', status: '' }); }, [load]);

    const apply = (next: Partial<{ task: string; status: string }> = {}) =>
        void load({ from, to, task: next.task ?? task, status: next.status ?? status });

    const rows = useMemo(() => {
        const dir = sortOrder === 'asc' ? 1 : -1;
        return [...(data?.rows ?? [])].sort((a, b) => {
            const av = a[sortKey] ?? '';
            const bv = b[sortKey] ?? '';
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
            return String(av).localeCompare(String(bv), 'ja') * dir;
        });
    }, [data, sortKey, sortOrder]);

    const counts = useMemo(() => {
        const c: Record<SyncStatus, number> = { success: 0, partial: 0, failure: 0 };
        for (const r of data?.rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1;
        return c;
    }, [data]);

    const latest = useMemo(() => [...(data?.latest ?? [])].sort((a, b) =>
        Number(isStale(b)) - Number(isStale(a)) || labelOf(a.task).localeCompare(labelOf(b.task), 'ja')), [data]);
    const staleCount = latest.filter(isStale).length;

    const th = (label: string, key: SortKey, width?: number) => {
        const active = sortKey === key;
        return (
            <th className="sy_th sy_th_sort" style={{ width }} title="クリックで並べ替え"
                onClick={() => {
                    if (active) setSortOrder((p) => (p === 'asc' ? 'desc' : 'asc'));
                    else { setSortKey(key); setSortOrder(key === 'started_at' || key === 'duration_ms' ? 'desc' : 'asc'); }
                }}>
                {label}<span className={`sy_sort_icon${active ? ' is_active' : ''}`}>{active ? (sortOrder === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const kpi = (label: string, value: number, tone?: 'bad' | 'warn') => (
        <div className="sy_kpi_card">
            <div className="sy_kpi_label">{label}</div>
            <div className={`sy_kpi_value${tone && value > 0 ? ` is_${tone}` : ''}`}>{value.toLocaleString()}</div>
        </div>
    );

    const pill = (s: SyncStatus) => {
        const st = STATUS[s] ?? { label: s, tone: 'warn' as const };
        return <span className={`sy_pill is_${st.tone}`}>{st.label}</span>;
    };

    const pickTask = (t: string) => { setTask(t); apply({ task: t }); };

    return (
        <div className="sy_wrap">
            <style>{`
                .sy_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 12px 40px 20px; box-sizing: border-box; overflow: auto; }
                .sy_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
                .sy_note { font-size: 11px; color: #6b7280; }
                .sy_h { font-size: 13px; font-weight: 700; color: #374151; margin: 4px 0 0; }
                .sy_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc;
                          border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; }
                .sy_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .sy_kpi { display: flex; gap: 10px; flex-wrap: wrap; }
                .sy_kpi_card { flex: 1 1 130px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .sy_kpi_label { font-size: 11px; color: #6b7280; }
                .sy_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .sy_kpi_value.is_bad { color: #b91c1c; }
                .sy_kpi_value.is_warn { color: #b45309; }
                .sy_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; }
                .sy_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px; }
                .sy_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff; }
                .sy_table_wrap.is_history { max-height: calc(100vh - 260px); min-height: 240px; }
                .sy_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .sy_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .sy_th_sort { cursor: pointer; user-select: none; }
                .sy_th_sort:hover { background: #eef2f7; }
                .sy_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .sy_sort_icon.is_active { color: #2563eb; }
                .sy_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: top; }
                .sy_row:hover > .sy_td { background: #f8fafc; }
                .sy_row.is_stale > .sy_td:first-child { box-shadow: inset 3px 0 0 #dc2626; }
                .sy_time { white-space: nowrap; font-variant-numeric: tabular-nums; }
                .sy_num { white-space: nowrap; font-variant-numeric: tabular-nums; text-align: right; }
                .sy_sub { font-size: 11px; color: #9ca3af; }
                .sy_stale { color: #b91c1c; font-weight: 700; }
                .sy_pill { display: inline-block; border-radius: 999px; font-size: 11px; font-weight: 700; padding: 1px 8px; white-space: nowrap; }
                .sy_pill.is_ok { background: #dcfce7; color: #166534; }
                .sy_pill.is_warn { background: #fef3c7; color: #92400e; }
                .sy_pill.is_bad { background: #fee2e2; color: #991b1b; }
                .sy_link { border: none; background: none; padding: 0; color: #1d4ed8; cursor: pointer; font: inherit; text-align: left; }
                .sy_link:hover { text-decoration: underline; }
                .sy_msg { min-width: 200px; overflow-wrap: anywhere; }
                .sy_errs { margin: 6px 0 0; padding: 8px 10px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;
                           font-size: 11.5px; color: #7f1d1d; white-space: pre-wrap; overflow-wrap: anywhere; list-style: none; }
                .sy_errs li + li { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #fecaca; }
                .sy_empty { text-align: center; color: #9ca3af; padding: 32px 0; }
                @media (max-width: 900px) { .sy_wrap { padding: 12px 16px 16px; } }
            `}</style>

            <div className="sy_inner">
                <div className="sy_note">
                    ポータルの反響・集計などの自動取り込み（Heroku の sync）の実行結果です。成功も失敗も1回ずつ残り、失敗は理由まで出します（180日分）。管理者だけが見られます。
                </div>

                <div className="sy_bar">
                    <div>
                        <div className="sy_label">期間（履歴）</div>
                        <div className="d-flex align-items-center gap-1">
                            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={from}
                                onChange={(e) => setFrom(e.target.value)} aria-label="期間の始め" />
                            <span className="sy_note">〜</span>
                            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={to}
                                onChange={(e) => setTo(e.target.value)} aria-label="期間の終わり" />
                        </div>
                    </div>
                    <div>
                        <div className="sy_label">タスク</div>
                        <select className="form-select form-select-sm" style={{ width: 220 }} value={task}
                            onChange={(e) => pickTask(e.target.value)} aria-label="タスク">
                            <option value="">すべて</option>
                            {(data?.tasks ?? []).map((t) => <option key={t} value={t}>{labelOf(t)}{TASK_LABEL[t] ? `（${t}）` : ''}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="sy_label">状態</div>
                        <select className="form-select form-select-sm" style={{ width: 120 }} value={status}
                            onChange={(e) => { setStatus(e.target.value); apply({ status: e.target.value }); }} aria-label="状態">
                            <option value="">すべて</option>
                            {(Object.keys(STATUS) as SyncStatus[]).map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
                        </select>
                    </div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => apply()} disabled={loading}>
                        {loading ? '読み込み中…' : '表示'}
                    </button>
                </div>

                {error !== '' && <div className="sy_error" role="alert">{error}</div>}

                {data && (
                    <>
                        <div className="sy_kpi">
                            {kpi('実行（期間）', data.rows.length)}
                            {kpi('成功', counts.success)}
                            {kpi('一部失敗', counts.partial, 'warn')}
                            {kpi('失敗', counts.failure, 'bad')}
                            {kpi(`${STALE_HOURS}時間以上成功していないタスク`, staleCount, 'bad')}
                        </div>

                        <div className="sy_h">タスクごとの最新</div>
                        <div className="sy_table_wrap">
                            <table className="sy_table">
                                <thead>
                                    <tr>
                                        <th className="sy_th" style={{ width: 220 }}>タスク</th>
                                        <th className="sy_th" style={{ width: 90 }}>最新</th>
                                        <th className="sy_th" style={{ width: 170 }}>最後の実行</th>
                                        <th className="sy_th" style={{ width: 170 }}>最後の成功</th>
                                        <th className="sy_th" style={{ width: 90 }}>7日の失敗</th>
                                        <th className="sy_th">内容</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {latest.length === 0 && (
                                        <tr><td className="sy_td sy_empty" colSpan={6}>まだ実行結果がありません</td></tr>
                                    )}
                                    {latest.map((l) => {
                                        const stale = isStale(l);
                                        return (
                                            <tr key={l.task} className={`sy_row${stale ? ' is_stale' : ''}`}>
                                                <td className="sy_td">
                                                    <button type="button" className="sy_link" title="このタスクの履歴だけを出す" onClick={() => pickTask(l.task)}>{labelOf(l.task)}</button>
                                                    {TASK_LABEL[l.task] && <div className="sy_sub">{l.task}</div>}
                                                </td>
                                                <td className="sy_td">{pill(l.status)}</td>
                                                <td className="sy_td sy_time">{l.started_at}<div className="sy_sub">{agoText(l.started_at)}</div></td>
                                                <td className={`sy_td sy_time${stale ? ' sy_stale' : ''}`}>
                                                    {l.last_success ?? '記録なし'}
                                                    {l.last_success && <div className={stale ? '' : 'sy_sub'}>{agoText(l.last_success)}</div>}
                                                </td>
                                                <td className="sy_td sy_num">{l.failures_7d > 0 ? <span className="sy_stale">{l.failures_7d}</span> : 0}</td>
                                                <td className="sy_td sy_msg">
                                                    {l.message}
                                                    {errorsOf(l.errors).length > 0 && <div className="sy_sub">理由 {errorsOf(l.errors).length}件（下の履歴で開けます）</div>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="sy_caution">
                            「最後の成功」が{STALE_HOURS}時間以上前・記録なしのタスクは赤で出し、上に並べます。一部失敗は、最後まで動いたが途中で失敗があったもの（例：3店舗のうち1店舗が取れない）です。
                            {data.rows.length >= data.limit && <><br />⚠️ 新しい順に {data.limit.toLocaleString()} 行までを出しています。期間を短くするか、タスク・状態で絞ってください。</>}
                        </div>

                        <div className="sy_h">履歴</div>
                        <div className="sy_table_wrap is_history">
                            <table className="sy_table">
                                <thead>
                                    <tr>
                                        {th('開始', 'started_at', 160)}
                                        {th('タスク', 'task', 220)}
                                        {th('状態', 'status', 90)}
                                        {th('時間', 'duration_ms', 80)}
                                        {th('入口', 'route', 140)}
                                        <th className="sy_th">内容・理由</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 && (
                                        <tr><td className="sy_td sy_empty" colSpan={6}>{loading ? '読み込み中…' : '該当する記録はありません'}</td></tr>
                                    )}
                                    {rows.map((r) => {
                                        const errs = errorsOf(r.errors);
                                        return (
                                            <tr key={r.id} className="sy_row">
                                                <td className="sy_td sy_time">{r.started_at}</td>
                                                <td className="sy_td">{labelOf(r.task)}{TASK_LABEL[r.task] && <div className="sy_sub">{r.task}</div>}</td>
                                                <td className="sy_td">{pill(r.status)}</td>
                                                <td className="sy_td sy_num">{durationText(r.duration_ms)}</td>
                                                <td className="sy_td sy_sub">{r.route}</td>
                                                <td className="sy_td sy_msg">
                                                    {r.message}
                                                    {errs.length > 0 && (
                                                        <div>
                                                            <button type="button" className="sy_link" onClick={() => setOpen(open === r.id ? null : r.id)}>
                                                                {open === r.id ? '理由を閉じる' : `理由を見る（${errs.length}件）`}
                                                            </button>
                                                            {open === r.id && <ul className="sy_errs">{errs.map((e, i) => <li key={i}>{e}</li>)}</ul>}
                                                        </div>
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

export default SyncLog;
```

### backend/scripts/sql/2026-11-10_sync_run_log.sql
```sql
-- =====================================================================
-- v2.2.259 sync（Heroku の自動取り込み）の実行結果の表
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ ② の更新より**前に**流す（② が書き込む）
-- ⚠️ 何回流しても同じ（IF NOT EXISTS）
-- ⚠️ 180日より古い行は ② が毎日消す（features/syncLog）
-- =====================================================================

CREATE TABLE IF NOT EXISTS sync_run_log (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id       VARCHAR(40)  NOT NULL                 COMMENT '1回の呼び出しの ID（同じ呼び出しで流れたタスクは同じ値）',
  route        VARCHAR(100) NOT NULL                 COMMENT '呼ばれた入口（/api/portal_kaeru など）',
  task         VARCHAR(100) NOT NULL                 COMMENT 'タスク名（property・suumo_resale など。入口だけの処理は入口名）',
  status       VARCHAR(10)  NOT NULL                 COMMENT 'success＝成功・partial＝最後まで動いたが途中で失敗あり・failure＝止まった',
  message      VARCHAR(500) NULL                     COMMENT '一行の結果',
  errors       MEDIUMTEXT   NULL                     COMMENT '失敗の理由（JSON の文字列の配列）',
  started_at   DATETIME     NOT NULL                 COMMENT '開始（日本時間）',
  finished_at  DATETIME     NOT NULL                 COMMENT '終了（日本時間）',
  duration_ms  INT UNSIGNED NOT NULL DEFAULT 0       COMMENT 'かかった時間（ミリ秒）',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sync_run_log_task (task, started_at),
  KEY idx_sync_run_log_status (status, started_at),
  KEY idx_sync_run_log_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='sync の実行結果（v2.2.259。② の sync_log:write が書く）';

-- 確認（結果が返ればよい）
SHOW CREATE TABLE sync_run_log;
```

### projects/sync/src/utils/syncLog.ts
```ts
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import axios from 'axios';
import type { NextFunction, Request, Response } from 'express';

/**
 * sync の実行結果を Dashboard の DB（sync_run_log）に残す（2026-11-10。Dashboard v2.2.259）。
 *
 * ─────────────────────────────────────────────
 *   ⚠️ 以前は失敗だけをメールで送っていた（sendErrorMail）。
 *     ・Gmail の認証が切れて（535）届かなくなり、だれも失敗に気づけなかった
 *     ・成功はどこにも残らなかった
 *     ・店舗ごとの失敗のように例外を投げないものは「成功」に隠れていた（2026-11-10 の ielove の 403）
 *   いまは次の形で、成功も失敗も1行ずつ Dashboard の ② へ送る。画面はシステム管理 →「同期の実行結果」。
 *
 *   portal（/api/portal・/api/portal_kaeru）… portalService がタスクごとに runTask で1行
 *   ほかのジョブの入口（JOB_ROUTES）          … syncLogMiddleware が応答のときに1行（応答のあとの失敗は別の行）
 *
 *   状態 success＝失敗なし / partial＝最後まで動いたが途中で失敗あり（sendErrorMail に理由が来た）/ failure＝例外で止まった
 *
 * ⚠️ 送り先は ② へ直接（① を通さない）。合い言葉は Heroku の Config Vars SYNC_LOG_SECRET（② の .env.prod と同じ値）。
 *   未設定なら送らずにコンソールへ出すだけ。⚠️ 送れなくても、取り込みの処理は止めない。
 * ─────────────────────────────────────────────
 */

type SyncStatus = 'success' | 'partial' | 'failure';

type Scope = {
    runId: string;
    route: string;
    task: string;
    errors: string[];
    startedAt: Date;
    /** 行を送ったあと（このあとに来た失敗は、別の行で送る） */
    closed: boolean;
};

type SyncLogRow = {
    runId: string;
    route: string;
    task: string;
    status: SyncStatus;
    message: string;
    errors: string[];
    startedAt: string;
    finishedAt: string;
};

const als = new AsyncLocalStorage<Scope>();

const SYNC_LOG_URL = process.env.SYNC_LOG_URL || 'https://api.khg-marketing.info/api/gateway';

/** ② へ送る。⚠️ 失敗してもコンソールに出すだけ（取り込みの処理は止めない） */
const post = async (rows: SyncLogRow[]): Promise<void> => {
    for (const r of rows) {
        console.log(`[実行結果] ${r.task}: ${r.status}（${r.message}）${r.errors.length ? ` 理由 ${r.errors.length}件` : ''}`);
    }
    const key = process.env.SYNC_LOG_SECRET ?? '';
    if (key === '') {
        console.warn('[実行結果] SYNC_LOG_SECRET が未設定のため、Dashboard へ送りませんでした');
        return;
    }
    try {
        const res = await axios.post(SYNC_LOG_URL, { request: 'sync_log', roll: 'write', key, rows }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000,
        });
        if (res.data?.status !== 'success') console.error('[実行結果] Dashboard への送信に失敗しました:', res.data);
    } catch (err) {
        const detail = axios.isAxiosError(err) ? `${err.response?.status ?? ''} ${JSON.stringify(err.response?.data ?? err.message)}` : String(err);
        console.error(`[実行結果] Dashboard への送信に失敗しました: ${detail}`);
    }
};

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const rowOf = (scope: Scope, status: SyncStatus, message: string, extra: string[] = []): SyncLogRow => ({
    runId: scope.runId,
    route: scope.route,
    task: scope.task,
    status,
    message: message.slice(0, 500),
    errors: [...scope.errors, ...extra],
    startedAt: scope.startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
});

const newScope = (route: string, task: string, runId?: string): Scope => ({
    runId: runId ?? randomUUID(),
    route,
    task,
    errors: [],
    startedAt: new Date(),
    closed: false,
});

/**
 * 失敗の理由を、今のタスク（入口）に足す。⚠️ sendErrorMail から呼ばれる。
 * ⚠️ タスクの外・行を送ったあとに来た理由は、その場で1行（partial）にして送る（黙って捨てない）
 */
export const recordErrors = (errors: string[], project: string): void => {
    const list = errors.map(e => String(e)).filter(e => e !== '').map(e => `[${project}] ${e}`);
    if (list.length === 0) return;
    const scope = als.getStore();
    if (scope && !scope.closed) {
        scope.errors.push(...list);
        return;
    }
    const lone = newScope(scope?.route ?? '(入口の外)', scope?.task ?? project, scope?.runId);
    void post([{ ...rowOf(lone, 'partial', '処理の終わったあとに失敗が記録されました'), errors: list }]);
};

/** 結果だけを1行で残す（認証情報が無い・実行関数が無い など、実行せずに終わったとき） */
export const recordTaskResult = (task: string, status: SyncStatus, message: string): void => {
    const parent = als.getStore();
    void post([rowOf(newScope(parent?.route ?? '(直接)', task, parent?.runId), status, message)]);
};

/**
 * 1つのタスクを実行し、終わったら1行を送る。⚠️ 例外はそのまま投げ直す（呼び出し側の動きは変えない）
 *   例外 → failure、例外なしで理由あり → partial、どちらも無し → success
 * @returns 例外なしで終わったときの状態（success か partial）。理由の件数も
 */
export const runTask = async (task: string, fn: () => Promise<unknown>): Promise<{ status: 'success' | 'partial'; errorCount: number }> => {
    const parent = als.getStore();
    const scope = newScope(parent?.route ?? '(直接)', task, parent?.runId);
    try {
        await als.run(scope, fn);
        scope.closed = true;
        const errorCount = scope.errors.length;
        await post([errorCount
            ? rowOf(scope, 'partial', `${task} は最後まで動きましたが、途中で ${errorCount}件の失敗がありました`)
            : rowOf(scope, 'success', `${task} が完了しました`)]);
        return { status: errorCount ? 'partial' : 'success', errorCount };
    } catch (err) {
        scope.closed = true;
        await post([rowOf(scope, 'failure', `${task} が止まりました: ${errorText(err)}`, [`[例外] ${errorText(err)}`])]);
        throw err;
    }
};

/**
 * 記録する入口（ジョブ）。⚠️ AI のまとめ（summary・areasummary）・PDF→PPT・/open は、
 *   画面から呼ぶ対話の口なので記録しない（行が増えるだけで、取り込みの成否ではない）。
 * ⚠️ portal は portalService がタスクごとに書くので、入口の行は書かない（SELF_REPORT_ROUTES）。
 */
const JOB_ROUTES = [
    '/api/portal', '/api/portal_kaeru', '/api/update', '/api/robo', '/api/before_survey', '/api/add_event',
    '/api/breakaway', '/api/weekday', '/api/mail_scraping', '/api/estate_info',
];
const SELF_REPORT_ROUTES = ['/api/portal', '/api/portal_kaeru'];

/**
 * 記録する入口の名前。当てはまらなければ ''。
 * ⚠️ app.use('/api/', indexRoutes) は /api/update なども通るので、長い入口から順に見る。/api と /api/ は /api（indexRoutes の同期）
 */
const routeOf = (path: string): string => {
    const p = path.replace(/\/+$/, '') || '/';
    if (p === '/api') return '/api';
    return [...JOB_ROUTES].sort((a, b) => b.length - a.length).find(r => p === r || p.startsWith(`${r}/`)) ?? '';
};

/**
 * アプリ全体に1つだけ置くミドルウェア（app.ts で、ルーターより前）。
 * ⚠️ POST だけを記録する（OPTIONS・GET は記録しない）
 */
export const syncLogMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const route = routeOf(req.path);
    if (req.method !== 'POST' || route === '') {
        next();
        return;
    }
    const scope = newScope(route, route);
    if (!SELF_REPORT_ROUTES.includes(route)) {
        res.on('finish', () => {
            scope.closed = true;
            const code = res.statusCode;
            const status: SyncStatus = code >= 400 ? 'failure' : scope.errors.length ? 'partial' : 'success';
            const message = code >= 400
                ? `HTTP ${code} で応答しました`
                : scope.errors.length ? `応答しました（途中で ${scope.errors.length}件の失敗）` : `応答しました（HTTP ${code}）`;
            void post([rowOf(scope, status, message)]);
        });
    }
    als.run(scope, next);
};
```

## git diff（Dashboard の既存ファイル）
```diff
diff --git a/backend-express/src/config/env.ts b/backend-express/src/config/env.ts
index 413815cca..65530eb56 100644
--- a/backend-express/src/config/env.ts
+++ b/backend-express/src/config/env.ts
@@ -198,6 +198,14 @@ export const env = {
    */
   surveyLinkSecret: (process.env.SURVEY_LINK_SECRET ?? '').trim(),
 
+  /**
+   * sync（Heroku の自動取り込み）が実行結果を書くときの合い言葉。（v2.2.259。features/syncLog.ts）
+   *
+   * ⚠️ **未設定なら全件断る**（素通しにしない）。⚠️ 同じ値を Heroku の Config Vars `SYNC_LOG_SECRET` にも入れる。
+   * ⚠️ 設定先は ② VPS の .env.prod のみ。⚠️ **リポジトリに書かないこと。**
+   */
+  syncLogSecret: (process.env.SYNC_LOG_SECRET ?? '').trim(),
+
   /**
    * 他社広告の取り込み（meta_scrape。拡張機能 extensions/meta が送る）の合い言葉。（v2.2.230）
    *
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index 82b451131..1ab0a4b7d 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -145,6 +145,7 @@ import { runUpdateLog } from '../features/updateLog';
 import { getLatestLoanRates, uploadLoanRates } from '../features/loanRate';
 import { listLoanPlanRates, uploadLoanPlanRates } from '../features/loanPlanRate';
 import { listSecurityLog } from '../features/securityLog';
+import { listSyncLog, writeSyncLog } from '../features/syncLog';
 import { BUDGET_TABLE_AUTHORITY, listBudgetTable, uploadBudgetTable } from '../features/budgetTable';
 import { runBeforeSurveyEntry } from '../features/beforeSurvey/entry';
 import { runSurveyCustomers, runSurveyLink, runSurveyStaff } from '../features/survey/staff';
@@ -3119,6 +3120,33 @@ register({
   handler: async (ctx) => listSecurityLog(ctx.body),
 });
 
+/**
+ * sync（Heroku の自動取り込み）の実行結果（v2.2.259）。features/syncLog.ts 参照。
+ *
+ * ⚠️ write は sync が ② へ直接送る（① を通さない。① の express_proxy.php にも入れない）。ログイン無し・合い言葉（SYNC_LOG_SECRET）。
+ *   ⚠️ 合い言葉の総当たりは publicFormRateLimit.ts の syncLogLimiter（失敗だけを数える）。
+ * ⚠️ sync_log_list は Master だけ（システム管理 →「同期の実行結果」）。① の express_proxy.php の両方のリストに入れてある。
+ */
+register({
+  request: 'sync_log',
+  roll: 'write',
+  summary: '【書き込み】sync の実行結果（合い言葉で確かめる）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'none',
+  handler: async (ctx) => {
+    const result = await writeSyncLog(ctx.body);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+register({
+  request: 'sync_log_list',
+  summary: 'sync の実行結果（期間の行・タスクごとの最新と最後の成功）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'master',
+  handler: async (ctx) => (await listSyncLog(ctx.body)).body,
+});
+
 /**
  * 予算テーブル（v2.2.243）。features/budgetTable.ts 参照。
  *
diff --git a/backend-express/src/middlewares/publicFormRateLimit.ts b/backend-express/src/middlewares/publicFormRateLimit.ts
index cf49d8ab8..15d0608ef 100644
--- a/backend-express/src/middlewares/publicFormRateLimit.ts
+++ b/backend-express/src/middlewares/publicFormRateLimit.ts
@@ -120,6 +120,20 @@ const surveyLimiter = rateLimit({
   },
 });
 
+/**
+ * sync の実行結果の書き込み（sync_log:write。v2.2.259）の制限。
+ *   ⚠️ Heroku から1回の実行で何十件も届くので、**数えるのは失敗（合い言葉の違い＝401）だけ**（受付と同じ形）。
+ */
+const syncLogLimiter = rateLimit({
+  windowMs: 10 * 60_000,
+  limit: 20,
+  skipSuccessfulRequests: true,
+  keyGenerator: (req: Request): string => ipKeyGenerator(req.ip ?? 'unknown'),
+  standardHeaders: 'draft-7',
+  legacyHeaders: false,
+  message: { status: 'error', message: '合い言葉の誤りが続いたため、しばらく受け付けません。' },
+});
+
 /**
  * ゲートウェイに挟むミドルウェア。
  *
@@ -147,6 +161,12 @@ export const publicFormRateLimit = (
     return;
   }
 
+  // ⚠️ v2.2.259 sync の実行結果（認証なしの書き込み口。合い言葉の総当たりだけを止める）
+  if (request === 'sync_log') {
+    void syncLogLimiter(req, res, next);
+    return;
+  }
+
   // ⚠️ v2.2.257 面談アンケートの保存（認証なしの書き込み口）。店舗の Wi-Fi で同じ IP になるので、フォームより緩い別の制限。
   //   ⚠️ 読み込み（master・staff）は制限しない（お客様が開けない事態を避ける。master は署名で1人分に絞っている）
   if (request === 'interview_survey_public') {
diff --git a/backend-express/src/server.ts b/backend-express/src/server.ts
index c5f971697..5af14bfd8 100644
--- a/backend-express/src/server.ts
+++ b/backend-express/src/server.ts
@@ -6,6 +6,7 @@ import { startMetaAdsScheduler } from './features/metaAds/scheduler';
 import { startCvMatch } from './features/tracking/cvMatch';
 import { startTrackingMaintenance } from './features/tracking/maintenance';
 import { startIeloveMatch } from './features/realty/ieloveMatch';
+import { startSyncLogMaintenance } from './features/syncLog';
 import { gatewaySummary, logGatewayRoutes } from './gateway';
 import { logger } from './utils/logger';
 
@@ -41,6 +42,8 @@ const bootstrap = async (): Promise<void> => {
     startCvMatch();
     // 媒介獲得台帳といえらぶの物件・買い反響の突き合わせ（v2.2.258。30分ごと）
     startIeloveMatch();
+    // sync の実行結果の、180日より古い行の削除（v2.2.259。1日ごと）
+    startSyncLogMaintenance();
     // Claudeによる分析（v2.2.217）。再起動で消えた実行中の分析を失敗にする（画面が待ち続けないように）
     failInterruptedJobs()
       .then((count) => { if (count > 0) logger.warn(`ai_analysis: 再起動で中断された分析 ${count} 件を失敗にしました`); })
diff --git a/backend/scripts/guide/articles/common/screen-105.md b/backend/scripts/guide/articles/common/screen-105.md
index 379508e05..a07ad671b 100644
--- a/backend/scripts/guide/articles/common/screen-105.md
+++ b/backend/scripts/guide/articles/common/screen-105.md
@@ -18,7 +18,7 @@ summary: 画面のいちばん上のメニュー（システム管理・反響
 
 ## 見られる人
 だれでも開けますが、次の項目は見られる人が決まっています。見られない項目はメニューに出ません。
-- **ローン情報更新**・**広告費シミュレーター**・**セキュリティログ**：管理者だけ
+- **ローン情報更新**・**広告費シミュレーター**・**セキュリティログ**・**同期の実行結果**：管理者だけ
 - **アクセス解析**・**営業別契約率**・**予算テーブル**：管理者・ブランド管理者だけ
 - **Claudeによる分析**（メニューの左のボタン）：管理者・ブランド管理者・マネージャーだけ
 - **アクションボード**：注文営業だけ
@@ -35,5 +35,6 @@ summary: 画面のいちばん上のメニュー（システム管理・反響
 - [[アンバサダーの反響一覧]]
 - [[オーナーズハウス募集]]
 - [[セキュリティログ]]
+- [[同期の実行結果]]
 - [[予算テーブル]]
 - [[イベントの広告費入力]]
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 897d02b82..566064f7c 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -415,6 +415,8 @@ function expressProxyRequests(): array
         'loan_plan_rate_upload',
         // ⚠️ v2.2.242: セキュリティログの一覧（Master。features/securityLog.ts）
         'security_log_list',
+        // ⚠️ v2.2.259: sync の実行結果（② だけ。Master）。⚠️ 書き込み（sync_log:write）は sync が ② へ直接送るので入れない
+        'sync_log_list',
         // ⚠️ v2.2.243: 予算テーブル（Master / BrandAdmin。features/budgetTable.ts）。upload は書き込み（budget へ INSERT）
         'budget_table_list',
         'budget_table_upload',
@@ -915,6 +917,8 @@ function expressProxyExclusive(): array
         'loan_plan_rate_upload',
         // ⚠️ v2.2.242: セキュリティログの一覧（Master。features/securityLog.ts）
         'security_log_list',
+        // ⚠️ v2.2.259: sync の実行結果（② だけ。Master）。⚠️ 書き込み（sync_log:write）は sync が ② へ直接送るので入れない
+        'sync_log_list',
         // ⚠️ v2.2.243: 予算テーブル（Master / BrandAdmin。features/budgetTable.ts）。upload は書き込み（budget へ INSERT）
         'budget_table_list',
         'budget_table_upload',
diff --git a/docker-compose.prod.yml b/docker-compose.prod.yml
index 9bc8b677c..92e06b89d 100644
--- a/docker-compose.prod.yml
+++ b/docker-compose.prod.yml
@@ -132,6 +132,13 @@ services:
       # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。**
       - META_SCRAPER_KEY=${META_SCRAPER_KEY:-}
 
+      # sync（Heroku の自動取り込み）が実行結果を書くときの合い言葉（v2.2.259。sync_log:write）。
+      #
+      # ⚠️ 未設定だと全件 401（素通しにしない）。sync の実行結果が残らなくなる（sync の処理そのものは止まらない）。
+      # ⚠️ Heroku の Config Vars SYNC_LOG_SECRET と**同じ値**にすること。
+      # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。**
+      - SYNC_LOG_SECRET=${SYNC_LOG_SECRET:-}
+
       # 「Claudeによる分析」（v2.2.217）が使う Anthropic の API キー（Claude Console で発行したもの）。
       #
       # ⚠️ 未設定だと分析の開始が 503 になる（他の機能は動く）。
diff --git a/docker-compose.yml b/docker-compose.yml
index c6b40c660..ddca10c9c 100644
--- a/docker-compose.yml
+++ b/docker-compose.yml
@@ -78,6 +78,8 @@ services:
       - MEMBER_ENTRY_KEY=localtest
       # 他社広告の取り込み（meta_scrape）の合い言葉。⚠️ 開発用のダミー値。本番の値は ② VPS の .env.prod にのみ書く（v2.2.230）
       - META_SCRAPER_KEY=localtest
+      # sync（Heroku の自動取り込み）が実行結果を書くときの合い言葉。⚠️ 開発用のダミー値。本番の値は ② VPS の .env.prod にのみ書く（v2.2.259）
+      - SYNC_LOG_SECRET=localtest
     env_file:
       # Meta 広告 API のトークンと対象の ID（v2.2.203。META_ACCESS_TOKEN・META_AD_ACCOUNTS）。
       #
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index 8ae0a62f5..75e603449 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -104,6 +104,8 @@ export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     '権限編集': { header: 'システム管理/権限編集' },
     // ⚠️ v2.2.242。headerScreens.tsx と同じく Master だけ
     'セキュリティログ': { header: 'システム管理/セキュリティログ', authority: ['Master'] },
+    // ⚠️ v2.2.259。headerScreens.tsx と同じく Master だけ
+    '同期の実行結果': { header: 'システム管理/同期の実行結果', authority: ['Master'] },
     // ⚠️ v2.2.243。headerScreens.tsx と同じく Master / BrandAdmin
     '予算テーブル': { header: 'システム管理/予算テーブル', authority: ADMIN },
 };
diff --git a/frontend/src/components/header/headerScreens.tsx b/frontend/src/components/header/headerScreens.tsx
index 69d48e255..954ff49c3 100644
--- a/frontend/src/components/header/headerScreens.tsx
+++ b/frontend/src/components/header/headerScreens.tsx
@@ -5,6 +5,7 @@ import EditAuth from './system/EditAuth';
 import EditShop from './system/EditShop';
 import UploadLoan from './system/UploadLoan';
 import SecurityLog from './system/SecurityLog';
+import SyncLog from './system/SyncLog';
 import BudgetTable from './system/BudgetTable';
 import EditBlackList from './inquiry/EditBlackList';
 import BudgetSimulator from './inquiry/BudgetSimulator';
@@ -125,6 +126,8 @@ export const HEADER_SCREENS: HeaderScreen[] = [
     { menu: 'システム管理', item: 'ローン情報更新', path: '/uploadLoan', allow: isMaster, padded: true, render: () => <UploadLoan /> },
     // ⚠️ v2.2.242: セキュリティログは ⚠️⚠️ **Master だけ**（IP・ログインの記録が並ぶため。② の security_log_list も auth: 'master'）
     { menu: 'システム管理', item: 'セキュリティログ', path: '/securityLog', allow: isMaster, render: () => <SecurityLog /> },
+    // ⚠️ v2.2.259: 同期の実行結果は ⚠️⚠️ **Master だけ**（② の sync_log_list も auth: 'master'）
+    { menu: 'システム管理', item: '同期の実行結果', path: '/syncLog', allow: isMaster, render: () => <SyncLog /> },
     // ⚠️ v2.2.243: 予算テーブルは ⚠️⚠️ **Master と BrandAdmin**（budget へ CSV で追加できるため。② の budget_table_* も同じ2つ）
     { menu: 'システム管理', item: '予算テーブル', path: '/budgetTable', allow: isAdmin, render: () => <BudgetTable /> },
 
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 5de6a5b4b..718a6f152 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.258';
+export const newVersion = '2.2.259';
```

## git diff（sync。コミット 17be3bf。⚠️ 消した資格情報の行は伏せた）
```diff
diff --git a/src/app.ts b/src/app.ts
index 79d285f..f49e49c 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -15,6 +15,7 @@ import mailScrapingRoutes from "./routes/mailScrapingRoutes";
 import pdfToTtpRoutes from "./routes/pdfToPptRoutes";
 import estateInfoRoutes from "./routes/estateInfoRoutes";
 import portalRoutes from "./routes/portalRoutes";
+import { syncLogMiddleware } from "./utils/syncLog";
 
 process.on('uncaughtException', (err) => {
     console.error('💥 補足されなかったエラーが発生しましたが、サーバーは稼働を続けます:', err.message);
@@ -24,6 +25,8 @@ const app = express();
 app.use(cors());
 app.use(express.json({ limit: '50mb' }));
 app.use(express.text({ limit: '50mb' }));
+// ⚠️ 2026-11-10: 実行結果を Dashboard の DB に残す（メールはやめた）。⚠️ ルーターより前に置くこと（utils/syncLog.ts）
+app.use(syncLogMiddleware);
 
 app.use("/api/", indexRoutes);
 app.use("/api/update", updateRoutes);
diff --git a/src/services/portalService.ts b/src/services/portalService.ts
index 985f70f..48d015c 100644
--- a/src/services/portalService.ts
+++ b/src/services/portalService.ts
@@ -26,6 +26,7 @@ import { runHomesOrder } from "./runHomesOrder";
 import { runTownlifeOrder } from "./runTownlifeOrder";
 import { runAllGrit } from "./runAllGrit";
 import { runGoogleReview } from "./runGoogleReview";
+import { recordTaskResult, runTask } from "../utils/syncLog";
 
 export const portalService = {
   process: async (options?: { targetTasks?: string[] }) => {
@@ -176,32 +177,35 @@ export const portalService = {
 
     for (const brand of targets) {
       if (!NO_CREDENTIAL_TASKS.includes(brand.name) && (!brand.id || !brand.pass)) {
-        results.push({
-          name: brand.name,
-          ok: false,
-          message: `${brand.name} の認証情報が不足しています`
-        });
+        const message = `${brand.name} の認証情報が不足しています`;
+        results.push({ name: brand.name, ok: false, message });
+        recordTaskResult(brand.name, 'failure', message);
         continue;
       }
 
       const executeTask = actionMap[brand.name];
 
       if (!executeTask) {
-        results.push({
-          name: brand.name,
-          ok: false,
-          message: `${brand.name} に対応する実行関数がマッピングされていません`
-        });
+        const message = `${brand.name} に対応する実行関数がマッピングされていません`;
+        results.push({ name: brand.name, ok: false, message });
+        recordTaskResult(brand.name, 'failure', message);
         continue;
       }
 
       try {
-        await executeTask(brand.id ?? '', brand.pass ?? '', brand.brand);
+        /**
+         * ⚠️⚠️ 2026-11-10: タスクごとの実行結果を Dashboard の DB に残す（utils/syncLog.ts の runTask）。
+         *   ⚠️ 例外を投げずに途中で失敗したもの（sendErrorMail に理由が来たもの。例：ielove の店舗ごとの 403）は partial。
+         *     以前はそれも ok: true（「更新が完了しました」）になり、失敗が隠れていた。
+         */
+        const { status, errorCount } = await runTask(brand.name, () => executeTask(brand.id ?? '', brand.pass ?? '', brand.brand));
 
         results.push({
           name: brand.name,
-          ok: true,
-          message: `${brand.name} の更新が完了しました`
+          ok: status === 'success',
+          message: status === 'success'
+            ? `${brand.name} の更新が完了しました`
+            : `${brand.name} は最後まで動きましたが、途中で ${errorCount}件の失敗がありました`
         });
 
       } catch (err) {
diff --git a/src/services/runBeforeSurvey.ts b/src/services/runBeforeSurvey.ts
index 898cb2f..f33d550 100644
--- a/src/services/runBeforeSurvey.ts
+++ b/src/services/runBeforeSurvey.ts
@@ -1,6 +1,6 @@
+import { recordErrors } from '../utils/syncLog';
 import { chromium } from 'playwright';
 import axios from 'axios';
-import nodemailer from 'nodemailer';
 import { pgLogin } from '../utils/function';
 const errors: string[] = [];
 
@@ -59,29 +59,8 @@ export const runBeforeSurvey = async (updateData: any, pg_mail: string, pg_pass:
 
     await browser.close();
 
-    const transporter = nodemailer.createTransport({
-        service: 'gmail',
-        auth: {
-            user: process.env.GMAIL,
-            pass: process.env.GMAIL_PASS,
-        },
-    });
-
-    if (errors.length > 0) {
-        const mailOptions = {
-            from: 'error@khg-marketing.info',
-            to: process.env.GMAIL,
-            subject: "【自動送信】アンケート登録中にエラー発生",
-            text: `以下のエラーが発生しました:\n\nrunDataRegistrationBeforeInterview\n\n${errors.join("\n")}`,
-        };
-
-        try {
-            await transporter.sendMail(mailOptions);
-            console.log("エラーメールを送信しました");
-        } catch (err) {
-            console.error("メール送信に失敗しました:", err);
-        }
-    }
+    // ⚠️ 2026-11-10: エラーのメールはやめ、Dashboard の DB（同期の実行結果）に残す（utils/syncLog.ts）
+    recordErrors(errors, 'runBeforeSurvey.ts');
 
     // ⚠️⚠️ **2026-09-30、旧API（changeShop.php）からゲートウェイへ移した。**
     //   ⚠️ 旧APIは `demand` で枝分かれしていたが、⚠️ **現行は `request` + `roll`。**
diff --git a/src/services/runDataRegistration.ts b/src/services/runDataRegistration.ts
index 27c1b26..974d069 100644
--- a/src/services/runDataRegistration.ts
+++ b/src/services/runDataRegistration.ts
@@ -1,6 +1,6 @@
+import { sendErrorMail } from './sendErrorMail';
 import { chromium } from 'playwright';
 import axios from 'axios';
-import nodemailer from 'nodemailer';
 import { pgLogin, safeFill, safeSelect, safeGetValue } from '../utils/function';
 const errors: string[] = [];
 
@@ -397,33 +397,8 @@ export const runDataRegistration = async (registerData: any, brand: string, pg_m
 
     await browser.close();
 
-    const transporter = nodemailer.createTransport({
-        service: 'gmail',
-        auth: {
-            user: process.env.GMAIL,
-            pass: process.env.GMAIL_PASS,
-        },
-    });
-
-    if (errors.length > 0) {
-        const mailOptions = {
-            from: 'error@khg-marketing.info',
-            to: process.env.GMAIL,
-            subject: '【自動送信】データ登録作業中にエラー発生',
-            text: `以下のエラーが発生しました:\nrunDataRegistration\n\n${errors.join(
-                '\n'
-            )}`,
-        };
-
-        try {
-            await transporter.sendMail(mailOptions);
-            console.log('エラーメールを送信しました');
-        } catch (err) {
-            console.error('メール送信に失敗しました:', err);
-        } finally {
-            errors.length = 0;
-        }
-    }
+    // ⚠️ 2026-11-10: エラーのメールはやめ、Dashboard の DB（同期の実行結果）に残す（utils/syncLog.ts）
+    await sendErrorMail(errors, 'runDataRegistration.ts');
 
     // if (pg_id) {
     //     const now = new Date();
diff --git a/src/services/runDataRegistrationBeforeInterview.ts b/src/services/runDataRegistrationBeforeInterview.ts
index 5fc0eb9..0ba34ab 100644
--- a/src/services/runDataRegistrationBeforeInterview.ts
+++ b/src/services/runDataRegistrationBeforeInterview.ts
@@ -1,6 +1,6 @@
+import { sendErrorMail } from './sendErrorMail';
 import { chromium } from 'playwright';
 import axios from 'axios';
-import nodemailer from 'nodemailer';
 import { pgLogin, safeFill, safeGetValue, safeSelect } from '../utils/function';
 
 const errors: string[] = [];
@@ -497,31 +497,8 @@ export const runDataRegistrationBeforeInterview = async (
 
     await browser.close();
 
-    const transporter = nodemailer.createTransport({
-        service: 'gmail',
-        auth: {
-            user: process.env.GMAIL,
-            pass: process.env.GMAIL_PASS,
-        },
-    });
-
-    if (errors.length > 0) {
-        const mailOptions = {
-            from: 'error@khg-marketing.info',
-            to: process.env.GMAIL,
-            subject: "【自動送信】アンケート登録中にエラー発生",
-            text: `以下のエラーが発生しました:\n\nrunDataRegistrationBeforeInterview\n\n${errors.join("\n")}`,
-        };
-
-        try {
-            await transporter.sendMail(mailOptions);
-            console.log("エラーメールを送信しました");
-        } catch (err) {
-            console.error("メール送信に失敗しました:", err);
-        } finally {
-            errors.length = 0;
-        }
-    }
+    // ⚠️ 2026-11-10: エラーのメールはやめ、Dashboard の DB（同期の実行結果）に残す（utils/syncLog.ts）
+    await sendErrorMail(errors, 'runDataRegistrationBeforeInterview.ts');
 
     if (pg_id) {
         const now = new Date();
diff --git a/src/services/runDataUpdateAfterInterview.ts b/src/services/runDataUpdateAfterInterview.ts
index 4b7cd62..ab474c8 100644
--- a/src/services/runDataUpdateAfterInterview.ts
+++ b/src/services/runDataUpdateAfterInterview.ts
@@ -1,5 +1,5 @@
+import { sendErrorMail } from './sendErrorMail';
 import { chromium } from 'playwright';
-import nodemailer from 'nodemailer';
 import { pgLogin } from '../utils/function';
 const errors: string[] = [];
 
@@ -89,31 +89,9 @@ export const runDataUpdateAfterInterview = async (updateData: any, brand: string
         return;
     }
 
-    const transporter = nodemailer.createTransport({
-        service: 'gmail',
-        auth: {
-            user: process.env.GMAIL,
-            pass: process.env.GMAIL_PASS,
-        },
-    });
-
-    if (errors.length > 0) {
-        const mailOptions = {
-            from: 'error@khg-marketing.info',
-            to: 'shinji.kawano@kh-group.jp',
-            subject: '【自動送信】アンケート登録中にエラー発生',
-            text: `以下のエラーが発生しました:\n\nrunDataUpdateBeforeInterview\n\n${errors.join(
-                '\n'
-            )}`,
-        };
-
-        try {
-            await transporter.sendMail(mailOptions);
-            console.log('エラーメールを送信しました');
-        } catch (err) {
-            console.error('メール送信に失敗しました:', err);
-        }
-    }
+    // ⚠️ 2026-11-10: エラーのメールはやめ、Dashboard の DB（同期の実行結果）に残す（utils/syncLog.ts）
+    // ⚠️ 配列はモジュールで1つで、以前は空にしていなかった（毎回、前回の理由まで送っていた）。残したら空にする
+    await sendErrorMail(errors, 'runDataUpdateAfterInterview.ts');
 
     const now = new Date();
     const nowString = now.toDateString();
diff --git a/src/services/runDataUpdateBeforeInterview.ts b/src/services/runDataUpdateBeforeInterview.ts
index 790b352..d66c557 100644
--- a/src/services/runDataUpdateBeforeInterview.ts
+++ b/src/services/runDataUpdateBeforeInterview.ts
@@ -1,7 +1,7 @@
+import { sendErrorMail } from './sendErrorMail';
 import { chromium } from 'playwright';
 import { pgLogin, safeFill, safeSelect, safeGetValue } from '../utils/function';
 const errors: string[] = [];
-import nodemailer from 'nodemailer';
 
 export const runDataUpdateBeforeInterview = async (updateData: any, brand: string, pg_mail: string, pg_pass: string) => {
     const browser = await chromium.launch({ args: ['--no-sandbox'] });
@@ -473,31 +473,6 @@ export const runDataUpdateBeforeInterview = async (updateData: any, brand: strin
 
     await browser.close();
 
-    const transporter = nodemailer.createTransport({
-        service: 'gmail',
-        auth: {
-            user: process.env.GMAIL,
-            pass: process.env.GMAIL_PASS,
-        },
-    });
-
-    if (errors.length > 0) {
-        const mailOptions = {
-            from: 'error@khg-marketing.info',
-            to: 'shinji.kawano@kh-group.jp',
-            subject: '【自動送信】アンケート登録中にエラー発生',
-            text: `以下のエラーが発生しました:\n\nrunDataUpdateBeforeInterview\n\n${errors.join(
-                '\n'
-            )}`,
-        };
-
-        try {
-            await transporter.sendMail(mailOptions);
-            console.log('エラーメールを送信しました');
-        } catch (err) {
-            console.error('メール送信に失敗しました:', err);
-        } finally {
-            errors.length = 0;
-        }
-    }
+    // ⚠️ 2026-11-10: エラーのメールはやめ、Dashboard の DB（同期の実行結果）に残す（utils/syncLog.ts）
+    await sendErrorMail(errors, 'runDataUpdateBeforeInterview.ts');
 };
\ No newline at end of file
diff --git a/src/services/runDataUpdateNew.ts b/src/services/runDataUpdateNew.ts
index 94a3be3..da62453 100644
--- a/src/services/runDataUpdateNew.ts
+++ b/src/services/runDataUpdateNew.ts
@@ -1,5 +1,5 @@
+import { sendErrorMail } from './sendErrorMail';
 import { chromium } from 'playwright';
-import nodemailer from 'nodemailer';
 import { pgLogin, safeUpdateFill, safeGetValue, safeUpdateSelect } from '../utils/function';
 
 const errors: string[] = [];
@@ -571,31 +571,7 @@ export const runDataUpdateNew = async (postData: any, brand: string, pg_mail: st
 
     await browser.close();
 
-    const transporter = nodemailer.createTransport({
-        service: 'gmail',
-        auth: {
-            user: process.env.GMAIL,
-            pass: process.env.GMAIL_PASS,
-        },
-    });
-
-    if (errors.length > 0) {
-        const mailOptions = {
-            from: 'error@khg-marketing.info',
-            to: 'shinji.kawano@kh-group.jp',
-            subject: '【自動送信】データ更新作業中にエラー発生',
-            text: `以下のエラーが発生しました:\nrunDataUpdateNew.js\nID:${postData.id
-                }\n${errors.join('\n')}`,
-        };
-
-        try {
-            await transporter.sendMail(mailOptions);
-            console.log('エラーメールを送信しました');
-        } catch (err) {
-            console.error('メール送信に失敗しました:', err);
-        } finally{
-            errors.length = 0;
-        }
-    }
+    // ⚠️ 2026-11-10: エラーのメールはやめ、Dashboard の DB（同期の実行結果）に残す（utils/syncLog.ts）
+    await sendErrorMail(errors, 'runDataUpdateNew.ts');
 };
 
diff --git a/src/services/runIeloveProperty.ts b/src/services/runIeloveProperty.ts
index e4b5022..e22d46a 100644
--- a/src/services/runIeloveProperty.ts
+++ b/src/services/runIeloveProperty.ts
@@ -46,7 +46,8 @@ const propertyHeaderMap: Record<string, string> = {
     "社内用メモ１": "internal_note"
 };
 
-const postToPhpApi = async (data: Record<string, string>[]) => {
+/** ① の property_db_update へ送る。⚠️ 送れたら true（2026-11-10: 店舗ごとの結果をコンソールに出すため） */
+const postToPhpApi = async (data: Record<string, string>[]): Promise<boolean> => {
     const API_URL = "https://khg-marketing.info/dashboard/api/gateway/";
     const payload = {
         data: data,
@@ -55,6 +56,7 @@ const postToPhpApi = async (data: Record<string, string>[]) => {
     try {
         const response = await axios.post(API_URL, payload, { headers: { "Content-Type": "application/json" } });
         console.log("DB登録成功:", response.data);
+        return true;
     } catch (error) {
         if (axios.isAxiosError(error)) {
             console.error(`APIエラー: ${error.response?.status} ${error.response?.statusText}`);
@@ -64,6 +66,7 @@ const postToPhpApi = async (data: Record<string, string>[]) => {
             console.error("API送信中に予期せぬエラーが発生しました:", error);
             errors.push(`API予期せぬエラー`);
         }
+        return false;
     }
 };
 
@@ -194,6 +197,18 @@ export const runIeloveProperty = async (ielove_id: string, ielove_pass: string)
             console.log(`[ielove] ログイン欄: id=${idSelector} / pass=${passSelector} / submit=${submitSelector}`);
 
             await page.waitForLoadState("networkidle");
+
+            /**
+             * ⚠️⚠️ 2026-11-10: ログインが通ったかを確かめる。
+             *   以前は欄に入れて押しただけで次へ進んでいたため、通っていなくても一覧の失敗（403 など）としか出なかった。
+             *   送信のあとにパスワード欄がまだ見えていれば、ログイン画面のまま＝失敗とする。
+             */
+            const stillLogin = await page.locator(PASS_SELECTORS[0]).first().isVisible().catch(() => false);
+            if (stillLogin) {
+                await logPageState(page, 'ielove-login-result');
+                throw new Error(`ログイン画面のままです（ID・パスワードの誤り、またはログインが拒否された）。URL: ${page.url()} / 画面タイトル: ${await page.title().catch(() => '取得不可')}`);
+            }
+            console.log(`[ielove] ✅ ログイン成功（URL: ${page.url()} / 画面タイトル: ${await page.title().catch(() => '取得不可')}）`);
         } catch (err) {
             const msg = `ログイン処理に失敗${err}`;
             console.log(msg);
@@ -205,6 +220,8 @@ export const runIeloveProperty = async (ielove_id: string, ielove_pass: string)
     const propertySearch = async () => {
         // 店舗ID（value値）の配列
         const storeIds = ["86679", "96031", "150319"];
+        /** 店舗ごとの結果（最後にまとめて出す） */
+        const summary: string[] = [];
 
         for (const storeId of storeIds) {
             console.log(`=== 店舗ID: ${storeId} の処理を開始します ===`);
@@ -212,9 +229,21 @@ export const runIeloveProperty = async (ielove_id: string, ielove_pass: string)
             try {
                 const targetUrl = `https://cloud.ielove.jp/sale/index/index/num/500/search/1/scow/0/sccm/0/renmm/0/spdtm/1/kcdt/0/scld/0/grid/${storeId}/notAddBknTo/0/udcdr/1/ttcd1/0/ttcd2/0/ttcd3/0/ttcd4/0/ttcd5/0/ttcd8/0/ttcd99/0/kyzk/0/ptcm/0/exun/0/ices/2/exes/1/pbst/1/past/1/ipco/0/dluf/0/buda/0/ortgr/1/optt/1/`;
 
-                await page.goto(targetUrl);
+                const response = await page.goto(targetUrl);
                 await page.waitForLoadState("networkidle");
 
+                /**
+                 * ⚠️⚠️ 2026-11-10: 一覧の応答の HTTP ステータスを見る。
+                 *   2026-11-10 の Heroku の実行で、3店舗とも「403 Forbidden」の画面になっていた（ローカルでは成功）。
+                 *   以前は 403 の画面でもダウンロードボタンを60秒待ってから失敗していた。すぐ失敗にし、画面の状態を残す。
+                 */
+                const httpStatus = response?.status() ?? 0;
+                if (httpStatus >= 400) {
+                    await logPageState(page, `ielove-list-${storeId}`);
+                    throw new Error(`物件一覧が HTTP ${httpStatus}（画面タイトル: ${await page.title().catch(() => '取得不可')}）。接続元（Heroku の IP）が弾かれている可能性があります`);
+                }
+                console.log(`[ielove][店舗: ${storeId}] ✅ 物件一覧を開きました（HTTP ${httpStatus}）`);
+
                 await page.waitForTimeout(5000);
 
 
@@ -237,6 +266,7 @@ export const runIeloveProperty = async (ielove_id: string, ielove_pass: string)
                 if (!filePath) {
                     throw new Error(`店舗ID: ${storeId} のファイルダウンロードに失敗しました`);
                 }
+                console.log(`[ielove][店舗: ${storeId}] ✅ CSV をダウンロードしました`);
 
                 // Shift-JISからUTF-8に変換
                 const buffer = fs.readFileSync(filePath);
@@ -278,7 +308,14 @@ export const runIeloveProperty = async (ielove_id: string, ielove_pass: string)
 
                 // API送信
                 if (finalRecords.length > 0) {
-                    await postToPhpApi(finalRecords);
+                    const posted = await postToPhpApi(finalRecords);
+                    console.log(posted
+                        ? `[ielove][店舗: ${storeId}] ✅ DB 登録に成功しました（${finalRecords.length}件）`
+                        : `[ielove][店舗: ${storeId}] ❌ DB 登録に失敗しました（${finalRecords.length}件。理由は上の APIエラー）`);
+                    summary.push(`${storeId}: ${posted ? `成功 ${finalRecords.length}件` : 'DB 登録に失敗'}`);
+                } else {
+                    console.log(`[ielove][店舗: ${storeId}] ⚠️ CSV に物件がありませんでした（0件）`);
+                    summary.push(`${storeId}: 0件`);
                 }
 
             } catch (err) {
@@ -289,9 +326,11 @@ export const runIeloveProperty = async (ielove_id: string, ielove_pass: string)
                 const msg = `[店舗: ${storeId}] の処理中にエラーが発生しました: ${err}\n👉 【デバッグ】現在地URL: ${currentUrl}\n👉 【デバッグ】画面タイトル: ${pageTitle}`;
                 console.error(msg);
                 errors.push(msg);
+                summary.push(`${storeId}: 失敗`);
                 // エラーが起きても continue で次の店舗の処理へ進む
             }
         }
+        console.log(`[ielove] 店舗ごとの結果: ${summary.join(' / ')}`);
     };
 
     try {
diff --git a/src/services/runMyHomeRobo.ts b/src/services/runMyHomeRobo.ts
index 678895a..1182b08 100644
--- a/src/services/runMyHomeRobo.ts
+++ b/src/services/runMyHomeRobo.ts
@@ -1,7 +1,7 @@
+import { sendErrorMail } from './sendErrorMail';
 import { chromium } from 'playwright';
 import { myHomeRoboLogin } from '../utils/function';
 const errors: string[] = [];
-import nodemailer from 'nodemailer';
 import axios from 'axios';
 
 /** Dashboard のゲートウェイ。⚠️ 旧API（dashboard/api/）は廃止済み */
@@ -124,29 +124,9 @@ export const runMyHomeRobo = async (updateData: any, roboId: string, roboPass: s
 
     await browser.close();
 
-    const transporter = nodemailer.createTransport({
-        service: "gmail",
-        auth: {
-            user: "<伏せた>",
-            pass: "<伏せた>",
-        },
-    });
-
-    if (errors.length > 0) {
-        const mailOptions = {
-            from: "error@khg-marketing.info",
-            to: "shinji.kawano@kh-group.jp",
-            subject: "マイホームロボ登録中にエラー発生",
-            text: `以下のエラーが発生しました:\n\n${errors.join("\n")}`,
-        };
-
-        try {
-            await transporter.sendMail(mailOptions);
-            console.log("エラーメールを送信しました");
-        } catch (err) {
-            console.error("メール送信に失敗しました:", err);
-        }
-    }
+    // ⚠️ 2026-11-10: エラーのメールはやめ、Dashboard の DB（同期の実行結果）に残す（utils/syncLog.ts）
+    // ⚠️ 配列はモジュールで1つで、以前は空にしていなかった（毎回、前回の理由まで送っていた）。残したら空にする
+    await sendErrorMail(errors, 'runMyHomeRobo.ts');
 
     if (mhl_id) {
         const now = new Date();
diff --git a/src/services/runWeekday.ts b/src/services/runWeekday.ts
index 3f97b83..c99ff9c 100644
--- a/src/services/runWeekday.ts
+++ b/src/services/runWeekday.ts
@@ -1,3 +1,4 @@
+import { recordErrors } from '../utils/syncLog';
 import nodemailer from 'nodemailer';
 import { mailList } from '../utils/valueList';
 
@@ -41,17 +42,8 @@ export const runWeekday = async (postData: any) => {
         console.log("反響メールを送信しました");
     } catch (err) {
         console.error("メール送信に失敗しました:", err);
-        const errMailOptions = {
-            from: 'error@khg-marketing.info',
-            to: process.env.GMAIL,
-            subject: '【自動送信】平日来場キャンペーンのメール送信でエラー発生',
-            text: `以下のエラーが発生しました:${err}`,
-        };
-        try {
-            await transporter.sendMail(errMailOptions);
-            console.log('エラーメールを送信しました');
-        } catch (err) {
-            console.error('エラーメール送信に失敗しました:', err);
-        }
+        // ⚠️ 2026-11-10: エラーのメールはやめ、Dashboard の DB（同期の実行結果）に残す（utils/syncLog.ts）。
+        //   ⚠️ 反響のメール（上）は業務のメールなので、そのまま送る
+        recordErrors([`平日来場キャンペーンの反響メールを送れませんでした（${postData.shop}）: ${err}`], 'runWeekday.ts');
     }
 };
diff --git a/src/services/sendErrorMail.ts b/src/services/sendErrorMail.ts
index dad5aca..d4fd145 100644
--- a/src/services/sendErrorMail.ts
+++ b/src/services/sendErrorMail.ts
@@ -1,32 +1,16 @@
-import nodemailer from 'nodemailer';
+import { recordErrors } from '../utils/syncLog';
 
-export const sendErrorMail = async (errors: string[], project: string) => {
-
-    const transporter = nodemailer.createTransport({
-        service: 'gmail',
-        auth: {
-            user: process.env.GMAIL,
-            pass: process.env.GMAIL_PASS,
-        },
-    });
-
-    if (errors.length > 0) {
-        const mailOptions = {
-            from: 'error@khg-marketing.info',
-            to: process.env.GMAIL,
-            subject: '【自動送信】 Dashboard処理作業中にエラー発生',
-            text: `以下のエラーが発生しました:\n${project}\n\n${errors.join(
-                '\n'
-            )}`,
-        };
-
-        try {
-            await transporter.sendMail(mailOptions);
-            console.log('エラーメールを送信しました');
-        } catch (err) {
-            console.error('メール送信に失敗しました:', err);
-        } finally {
-            errors.length = 0;
-        }
-    }
+/**
+ * 失敗の理由を残す。
+ *
+ * ⚠️⚠️ 2026-11-10 から**メールは送らない**（利用者の決定）。名前は呼び出し元（32ファイル）を変えずに済むよう残した。
+ *   理由は、今のタスク（入口）の実行結果に足され、Dashboard の DB（sync_run_log）に残る（utils/syncLog.ts）。
+ *   画面は Dashboard のシステム管理 →「同期の実行結果」。
+ *   ⚠️ 以前は Gmail で送っていたが、認証が切れて（535）届かなくなっていた。
+ * ⚠️ 渡した配列は空にする（以前と同じ。呼び出し元がモジュールの配列を使い回しているため）
+ */
+export const sendErrorMail = async (errors: string[], project: string): Promise<void> => {
+    if (errors.length === 0) return;
+    recordErrors(errors, project);
+    errors.length = 0;
 };
diff --git a/src/utils/syncLog.ts b/src/utils/syncLog.ts
new file mode 100644
index 0000000..26806f5
--- /dev/null
+++ b/src/utils/syncLog.ts
@@ -0,0 +1,186 @@
+import { AsyncLocalStorage } from 'node:async_hooks';
+import { randomUUID } from 'node:crypto';
+import axios from 'axios';
+import type { NextFunction, Request, Response } from 'express';
+
+/**
+ * sync の実行結果を Dashboard の DB（sync_run_log）に残す（2026-11-10。Dashboard v2.2.259）。
+ *
+ * ─────────────────────────────────────────────
+ *   ⚠️ 以前は失敗だけをメールで送っていた（sendErrorMail）。
+ *     ・Gmail の認証が切れて（535）届かなくなり、だれも失敗に気づけなかった
+ *     ・成功はどこにも残らなかった
+ *     ・店舗ごとの失敗のように例外を投げないものは「成功」に隠れていた（2026-11-10 の ielove の 403）
+ *   いまは次の形で、成功も失敗も1行ずつ Dashboard の ② へ送る。画面はシステム管理 →「同期の実行結果」。
+ *
+ *   portal（/api/portal・/api/portal_kaeru）… portalService がタスクごとに runTask で1行
+ *   ほかのジョブの入口（JOB_ROUTES）          … syncLogMiddleware が応答のときに1行（応答のあとの失敗は別の行）
+ *
+ *   状態 success＝失敗なし / partial＝最後まで動いたが途中で失敗あり（sendErrorMail に理由が来た）/ failure＝例外で止まった
+ *
+ * ⚠️ 送り先は ② へ直接（① を通さない）。合い言葉は Heroku の Config Vars SYNC_LOG_SECRET（② の .env.prod と同じ値）。
+ *   未設定なら送らずにコンソールへ出すだけ。⚠️ 送れなくても、取り込みの処理は止めない。
+ * ─────────────────────────────────────────────
+ */
+
+type SyncStatus = 'success' | 'partial' | 'failure';
+
+type Scope = {
+    runId: string;
+    route: string;
+    task: string;
+    errors: string[];
+    startedAt: Date;
+    /** 行を送ったあと（このあとに来た失敗は、別の行で送る） */
+    closed: boolean;
+};
+
+type SyncLogRow = {
+    runId: string;
+    route: string;
+    task: string;
+    status: SyncStatus;
+    message: string;
+    errors: string[];
+    startedAt: string;
+    finishedAt: string;
+};
+
+const als = new AsyncLocalStorage<Scope>();
+
+const SYNC_LOG_URL = process.env.SYNC_LOG_URL || 'https://api.khg-marketing.info/api/gateway';
+
+/** ② へ送る。⚠️ 失敗してもコンソールに出すだけ（取り込みの処理は止めない） */
+const post = async (rows: SyncLogRow[]): Promise<void> => {
+    for (const r of rows) {
+        console.log(`[実行結果] ${r.task}: ${r.status}（${r.message}）${r.errors.length ? ` 理由 ${r.errors.length}件` : ''}`);
+    }
+    const key = process.env.SYNC_LOG_SECRET ?? '';
+    if (key === '') {
+        console.warn('[実行結果] SYNC_LOG_SECRET が未設定のため、Dashboard へ送りませんでした');
+        return;
+    }
+    try {
+        const res = await axios.post(SYNC_LOG_URL, { request: 'sync_log', roll: 'write', key, rows }, {
+            headers: { 'Content-Type': 'application/json' },
+            timeout: 15000,
+        });
+        if (res.data?.status !== 'success') console.error('[実行結果] Dashboard への送信に失敗しました:', res.data);
+    } catch (err) {
+        const detail = axios.isAxiosError(err) ? `${err.response?.status ?? ''} ${JSON.stringify(err.response?.data ?? err.message)}` : String(err);
+        console.error(`[実行結果] Dashboard への送信に失敗しました: ${detail}`);
+    }
+};
+
+const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));
+
+const rowOf = (scope: Scope, status: SyncStatus, message: string, extra: string[] = []): SyncLogRow => ({
+    runId: scope.runId,
+    route: scope.route,
+    task: scope.task,
+    status,
+    message: message.slice(0, 500),
+    errors: [...scope.errors, ...extra],
+    startedAt: scope.startedAt.toISOString(),
+    finishedAt: new Date().toISOString(),
+});
+
+const newScope = (route: string, task: string, runId?: string): Scope => ({
+    runId: runId ?? randomUUID(),
+    route,
+    task,
+    errors: [],
+    startedAt: new Date(),
+    closed: false,
+});
+
+/**
+ * 失敗の理由を、今のタスク（入口）に足す。⚠️ sendErrorMail から呼ばれる。
+ * ⚠️ タスクの外・行を送ったあとに来た理由は、その場で1行（partial）にして送る（黙って捨てない）
+ */
+export const recordErrors = (errors: string[], project: string): void => {
+    const list = errors.map(e => String(e)).filter(e => e !== '').map(e => `[${project}] ${e}`);
+    if (list.length === 0) return;
+    const scope = als.getStore();
+    if (scope && !scope.closed) {
+        scope.errors.push(...list);
+        return;
+    }
+    const lone = newScope(scope?.route ?? '(入口の外)', scope?.task ?? project, scope?.runId);
+    void post([{ ...rowOf(lone, 'partial', '処理の終わったあとに失敗が記録されました'), errors: list }]);
+};
+
+/** 結果だけを1行で残す（認証情報が無い・実行関数が無い など、実行せずに終わったとき） */
+export const recordTaskResult = (task: string, status: SyncStatus, message: string): void => {
+    const parent = als.getStore();
+    void post([rowOf(newScope(parent?.route ?? '(直接)', task, parent?.runId), status, message)]);
+};
+
+/**
+ * 1つのタスクを実行し、終わったら1行を送る。⚠️ 例外はそのまま投げ直す（呼び出し側の動きは変えない）
+ *   例外 → failure、例外なしで理由あり → partial、どちらも無し → success
+ * @returns 例外なしで終わったときの状態（success か partial）。理由の件数も
+ */
+export const runTask = async (task: string, fn: () => Promise<unknown>): Promise<{ status: 'success' | 'partial'; errorCount: number }> => {
+    const parent = als.getStore();
+    const scope = newScope(parent?.route ?? '(直接)', task, parent?.runId);
+    try {
+        await als.run(scope, fn);
+        scope.closed = true;
+        const errorCount = scope.errors.length;
+        await post([errorCount
+            ? rowOf(scope, 'partial', `${task} は最後まで動きましたが、途中で ${errorCount}件の失敗がありました`)
+            : rowOf(scope, 'success', `${task} が完了しました`)]);
+        return { status: errorCount ? 'partial' : 'success', errorCount };
+    } catch (err) {
+        scope.closed = true;
+        await post([rowOf(scope, 'failure', `${task} が止まりました: ${errorText(err)}`, [`[例外] ${errorText(err)}`])]);
+        throw err;
+    }
+};
+
+/**
+ * 記録する入口（ジョブ）。⚠️ AI のまとめ（summary・areasummary）・PDF→PPT・/open は、
+ *   画面から呼ぶ対話の口なので記録しない（行が増えるだけで、取り込みの成否ではない）。
+ * ⚠️ portal は portalService がタスクごとに書くので、入口の行は書かない（SELF_REPORT_ROUTES）。
+ */
+const JOB_ROUTES = [
+    '/api/portal', '/api/portal_kaeru', '/api/update', '/api/robo', '/api/before_survey', '/api/add_event',
+    '/api/breakaway', '/api/weekday', '/api/mail_scraping', '/api/estate_info',
+];
+const SELF_REPORT_ROUTES = ['/api/portal', '/api/portal_kaeru'];
+
+/**
+ * 記録する入口の名前。当てはまらなければ ''。
+ * ⚠️ app.use('/api/', indexRoutes) は /api/update なども通るので、長い入口から順に見る。/api と /api/ は /api（indexRoutes の同期）
+ */
+const routeOf = (path: string): string => {
+    const p = path.replace(/\/+$/, '') || '/';
+    if (p === '/api') return '/api';
+    return [...JOB_ROUTES].sort((a, b) => b.length - a.length).find(r => p === r || p.startsWith(`${r}/`)) ?? '';
+};
+
+/**
+ * アプリ全体に1つだけ置くミドルウェア（app.ts で、ルーターより前）。
+ * ⚠️ POST だけを記録する（OPTIONS・GET は記録しない）
+ */
+export const syncLogMiddleware = (req: Request, res: Response, next: NextFunction): void => {
+    const route = routeOf(req.path);
+    if (req.method !== 'POST' || route === '') {
+        next();
+        return;
+    }
+    const scope = newScope(route, route);
+    if (!SELF_REPORT_ROUTES.includes(route)) {
+        res.on('finish', () => {
+            scope.closed = true;
+            const code = res.statusCode;
+            const status: SyncStatus = code >= 400 ? 'failure' : scope.errors.length ? 'partial' : 'success';
+            const message = code >= 400
+                ? `HTTP ${code} で応答しました`
+                : scope.errors.length ? `応答しました（途中で ${scope.errors.length}件の失敗）` : `応答しました（HTTP ${code}）`;
+            void post([rowOf(scope, status, message)]);
+        });
+    }
+    als.run(scope, next);
+};
```
