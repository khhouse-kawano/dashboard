# v2.2.267 HOTLEAD の追客情報の取り込みを ② VPS から

日付：2026-11-13　ブランチ：v2.2.267

## 依頼
- sync の `src/services/runHotlead.ts` が、HOTLEAD の API の IP 制限で動かなくなる。Heroku のアドオンで IP を固定するか、② VPS から動かすか。
- 決定：② から。登録する IP は 162.43.5.127。毎日30分おき（48回 × 2アカウント）。
- 条件：「エラーでサーバーが決して落ちないようにしてほしい」。

## 調べたこと
- runHotlead.ts はブラウザを使わず、Cognito のトークン → `GET /public/api/tickets?updated_from=今日` → 1件ずつ ① の `hotlead` へ POST、だけ（約150行）。
- ② は拾い損ねた例外（uncaughtException）で自分を終了する（server.ts）。拾い損ねた Promise の失敗はログだけ。
- 以前は「今日」を Heroku の時計（UTC）で決めていた（日本時間 0〜9時は前日になっていた）。tickets_MM.json をファイルに書いていた。

## 作ったもの
- `backend-express/src/features/hotlead/importer.ts`（新規）
  - `getAccessToken`・`findTickets`・`postTicket`・`record`・`importAccount`・`importHotlead`・`startHotleadScheduler`
  - 30分ごと（:00・:30 にそろえる。起動の直後には動かさない）。KH（hotlead）→ DJH（hotlead_2）の順。
  - ① へは `env.phpGatewayUrl`（① のゲートウェイ）へ sync と同じ本文 ＋ `hotlead_brand`。① の hotlead.php はそのまま。
  - 結果を `sync_run_log` に1行（route は `② hotlead`、task は hotlead・hotlead_2。「ポータル連携ログ」に出る）。success／partial（1件でも失敗・時間切れで残り）／failure（トークン・チケットの取得で止まった）。
  - **落とさない作り**：タイマーから呼ぶのは async 関数だけで必ず .catch、通信はすべて時間切れ（トークン30秒・チケット60秒・1件30秒）、1回の上限25分（残りは次の回）、前の回が終わっていなければ飛ばす（running）、1件の失敗で止めない、記録の失敗もログだけ、認証情報や PHP_GATEWAY_URL が無ければ何もしない。
  - ログには件数とチケットの ID だけ（本文の個人情報は出さない）。ファイルには書かない。
- `config/env.ts`：`hotlead`（HOTLEAD_ID・HOTLEAD_PASS・HOTLEAD_ID_2・HOTLEAD_PASS_2。requireEnv にはしない）
- `server.ts`：`startHotleadScheduler()`
- `docker-compose.prod.yml`：HOTLEAD_* の4つを渡す（値は .env.prod）
- 版：version.ts 2.2.267、`2026-11-13_update_log_2.2.267.sql`（ローカル no=366）
- 手順書の修正（v2.2.266 のブランチで直した `git fetch --depth 1 origin production` → `git checkout FETCH_HEAD` の形）を cherry-pick（main に入っていなかったため）。
- 画面・① の PHP・DB の表は変えていない。業務ガイドの記事は無し（画面の変更なし。HOTLEAD の結果は今までどおり「ポータル連携ログ」に出る）。

## テスト（`scratchpad/c267/hl.test.ts`。ローカルの ② のコンテナの中で tsx。**13項目 OK**）
本物の HOTLEAD・① には送らず、fetch を差し替えて失敗を起こした。
- A：3件中1件が ① で 500 → KH・DJH の2行、partial、「3件（新規 1・更新 1・失敗 1）」、理由に「チケット t3: 500」、本文に hotlead_brand（KH・DJH）と request
- B：トークン 401 → failure（理由つき）
- C：チケットが JSON でない → failure
- D：fetch がその場で例外を投げる（同期の throw）→ failure
- E：data が配列でない → 0件で success ／ チケットが 500 → failure
- F：同時に2回呼ぶ → 1回分だけ（重ならない）
- G：トークンの返事が来ない → 30秒で打ち切って failure（2アカウントで約60秒）、次の回は動ける
- 拾い損ねた例外・Promise の失敗が 0（② は落ちていない）
- ローカルの ② の起動：認証情報が無いので「自動取り込みはしません」と出て、ほかは今までどおり（health 200）
- 型チェック エラー 0。試験で書いた sync_run_log の行は消した。
- ⚠️ 本物の HOTLEAD への接続は、IP の制限と認証情報のため、ローカルでは確かめていない（本番の ② で確かめる）。① 経由の 401 の確認は、新しい request が無いので対象外。

## 残っていること
- 本番で、次の :00・:30 の取り込みが成功するか（手順書の「終わったら」）。
- sync の呼び出しから hotlead・hotlead_2 を外す（利用者）。sync の runHotlead.ts は残してある（切り戻し用）。

## 追加した関数（全文）
`backend-express/src/features/hotlead/importer.ts`
```ts
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { execute } from '../../db/pool';
import { logger } from '../../utils/logger';

/**
 * HOTLEAD の追客情報（チケット）の取り込み（v2.2.267。sync の runHotlead.ts から移した）。
 *
 * ─────────────────────────────────────────────
 * ⚠️ HOTLEAD の API が IP アドレスで制限されるため、固定 IP（162.43.5.127）の ② から呼ぶ。
 *   ⚠️ sync（Heroku）の portalService の hotlead・hotlead_2 は外すこと（利用者側の作業）。
 * 流れ（アカウントごと。KH・DJH）:
 *   1. Cognito でトークンを取る（client_credentials）
 *   2. 今日（日本時間）以降に更新されたチケットを取る
 *   3. 1件ずつ ① のゲートウェイの `hotlead`（backend/src/handlers/hotlead.php）へ送る（sync と同じ本文 ＋ hotlead_brand）
 *   4. 結果を sync_run_log に1行残す（task は hotlead・hotlead_2。「ポータル連携ログ」に出る）
 *
 * ⚠️⚠️ **② を絶対に落とさない**（利用者の指示）。
 *   ⚠️ ② は拾い損ねた例外（uncaughtException）で終了する（server.ts）。ここでは:
 *     ・タイマーから呼ぶのは async 関数だけで、必ず .catch を付ける（同期の throw も Promise の失敗になる）
 *     ・通信には必ず時間切れを付ける（止まったままにならない）
 *     ・前の回が終わっていなければ、次の回は飛ばす（重ならない）
 *     ・1件の失敗で止めない（数えて記録するだけ）。記録の失敗もログだけ
 *     ・認証情報が無ければ何もしない（起動は止めない）
 *   ⚠️ 以前のようにファイル（tickets_MM.json）には書かない。
 * ⚠️ 送る本文には個人情報が入る。⚠️ ログには件数とチケットの ID だけを出す。
 * ─────────────────────────────────────────────
 */

const TOKEN_URL = 'https://prd-hotlead.auth.ap-northeast-1.amazoncognito.com/oauth2/token';
const API_BASE_URL = 'https://public-api.hotlead.jp';
/** 30分ごと（:00 と :30 にそろえる）。⚠️ 以前の sync の呼び出しと同じ間隔 */
const INTERVAL_MS = 30 * 60_000;
const TOKEN_TIMEOUT_MS = 30_000;
const TICKETS_TIMEOUT_MS = 60_000;
const POST_TIMEOUT_MS = 30_000;
/** 1回の実行の最大時間（これを過ぎたら残りは次の回に回す） */
const RUN_LIMIT_MS = 25 * 60_000;
/** 記録に残す失敗の理由の数の上限 */
const MAX_ERRORS = 50;

interface Account { task: string; id: string; pass: string; brand: string }

/** 認証情報のあるアカウント（⚠️ 無いものは飛ばす） */
const accounts = (): Account[] =>
  [
    { task: 'hotlead', id: env.hotlead.id, pass: env.hotlead.pass, brand: 'KH' },
    { task: 'hotlead_2', id: env.hotlead.id2, pass: env.hotlead.pass2, brand: 'DJH' },
  ].filter((a) => a.id !== '' && a.pass !== '');

/** 日本時間の 'YYYY-MM-DD HH:MM:SS'（ms だけずらした時刻） */
const jst = (offsetMs = 0): string => new Date(Date.now() + offsetMs + 9 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');

const short = (value: unknown, max = 300): string => String(value ?? '').replace(/\s+/g, ' ').slice(0, max);

const getAccessToken = async (account: Account): Promise<string> => {
  const params = new URLSearchParams({ grant_type: 'client_credentials', client_id: account.id });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${account.id}:${account.pass}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`トークンを取れませんでした（${res.status}）: ${short(await res.text().catch(() => ''))}`);
  const data = (await res.json()) as { access_token?: unknown };
  if (typeof data.access_token !== 'string' || data.access_token === '') throw new Error('トークンが返事にありません');
  return data.access_token;
};

/** 今日（日本時間）以降に更新されたチケット */
const findTickets = async (token: string): Promise<Record<string, unknown>[]> => {
  const today = jst().slice(0, 10);
  const res = await fetch(`${API_BASE_URL}/public/api/tickets?updated_from=${today}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(TICKETS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`チケットを取れませんでした（${res.status}）: ${short(await res.text().catch(() => ''))}`);
  const data = (await res.json()) as { data?: unknown };
  return Array.isArray(data.data) ? data.data.filter((t): t is Record<string, unknown> => t !== null && typeof t === 'object') : [];
};

/** 1件を ① の hotlead へ送る。⚠️ 失敗は例外にせず理由を返す */
const postTicket = async (ticket: Record<string, unknown>, brand: string): Promise<{ ok: boolean; action?: string; error?: string }> => {
  const target = env.phpGatewayUrl;
  if (target === undefined) return { ok: false, error: 'PHP_GATEWAY_URL が未設定' };
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ticket, hotlead_brand: brand, request: 'hotlead' }),
      signal: AbortSignal.timeout(POST_TIMEOUT_MS),
    });
    const text = await res.text();
    let body: { status?: unknown; action?: unknown; message?: unknown } = {};
    try { body = JSON.parse(text) as typeof body; } catch { /* 下で失敗にする */ }
    if (res.ok && body.status === 'success') return { ok: true, action: String(body.action ?? '') };
    return { ok: false, error: `${res.status} ${short(body.message ?? text, 150)}` };
  } catch (error) {
    return { ok: false, error: short((error as Error).message, 150) };
  }
};

type Status = 'success' | 'partial' | 'failure';

/** sync_run_log に1行（⚠️ 失敗してもログだけ） */
const record = async (runId: string, task: string, status: Status, message: string, errors: string[], startedAt: string, startedMs: number): Promise<void> => {
  try {
    await execute(
      `INSERT INTO sync_run_log (run_id, route, task, status, message, errors, started_at, finished_at, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [runId, '② hotlead', task, status, message.slice(0, 500), errors.length > 0 ? JSON.stringify(errors.slice(0, MAX_ERRORS)) : null,
        startedAt, jst(), Math.min(Date.now() - startedMs, 4_294_967_295)]
    );
  } catch (error) {
    logger.error(`hotlead: 実行結果を記録できませんでした（${task}）`, error);
  }
};

/** 1アカウント分 */
const importAccount = async (account: Account, runId: string, deadline: number): Promise<void> => {
  const startedAt = jst();
  const startedMs = Date.now();
  try {
    const token = await getAccessToken(account);
    const tickets = await findTickets(token);
    let insert = 0, update = 0, failed = 0, skipped = 0;
    const errors: string[] = [];
    for (const ticket of tickets) {
      if (Date.now() > deadline) { skipped++; continue; }
      const r = await postTicket(ticket, account.brand);
      if (r.ok) {
        if (r.action === 'insert') insert++;
        else if (r.action === 'update') update++;
      } else {
        failed++;
        if (errors.length < MAX_ERRORS) errors.push(`チケット ${short(ticket.id, 40)}: ${r.error ?? ''}`);
      }
    }
    if (skipped > 0) errors.push(`時間切れで ${skipped}件を次の回に回しました`);
    const status: Status = failed === 0 && skipped === 0 ? 'success' : 'partial';
    const message = `${tickets.length}件（新規 ${insert}・更新 ${update}・失敗 ${failed}${skipped > 0 ? `・未処理 ${skipped}` : ''}）`;
    logger.info(`hotlead: ${account.task} ${message}`);
    await record(runId, account.task, status, message, errors, startedAt, startedMs);
  } catch (error) {
    const reason = short((error as Error).message);
    logger.error(`hotlead: ${account.task} の取り込みに失敗しました: ${reason}`);
    await record(runId, account.task, 'failure', reason, [reason], startedAt, startedMs);
  }
};

let running = false;

/** 1回分（KH → DJH の順）。⚠️ 前の回が終わっていなければ何もしない。⚠️ 例外を外に出さない */
export const importHotlead = async (): Promise<void> => {
  if (running) {
    logger.warn('hotlead: 前の回がまだ終わっていないので、今回は飛ばします');
    return;
  }
  running = true;
  try {
    const runId = randomUUID();
    const deadline = Date.now() + RUN_LIMIT_MS;
    for (const account of accounts()) {
      await importAccount(account, runId, deadline);
    }
  } catch (error) {
    logger.error('hotlead: 予期しないエラー', error);
  } finally {
    running = false;
  }
};

/** 次の :00 / :30 までのミリ秒 */
const untilNextSlot = (): number => INTERVAL_MS - (Date.now() % INTERVAL_MS);

/**
 * 30分ごとに取り込む（:00 と :30。⚠️ 起動の直後には動かさない＝再起動のたびに余計に呼ばない）。
 * ⚠️ 認証情報が1つも無ければ何もしない。
 */
export const startHotleadScheduler = (): void => {
  if (accounts().length === 0) {
    logger.info('hotlead: HOTLEAD_ID / HOTLEAD_PASS が無いため、自動取り込みはしません');
    return;
  }
  if (env.phpGatewayUrl === undefined) {
    logger.warn('hotlead: PHP_GATEWAY_URL が無いため、自動取り込みはしません');
    return;
  }
  const run = (): void => {
    importHotlead().catch((error: unknown) => logger.error('hotlead: 自動取り込みに失敗しました', error));
  };
  setTimeout(() => {
    run();
    setInterval(run, INTERVAL_MS).unref();
  }, untilNextSlot()).unref();
  logger.info(`hotlead: 自動取り込みを始めます（30分ごと。アカウント ${accounts().map((a) => a.task).join('・')}）`);
};
```

## git diff（既存ファイル）
```diff
diff --git a/backend-express/src/config/env.ts b/backend-express/src/config/env.ts
index 6e14fb4d6..3262c0edb 100644
--- a/backend-express/src/config/env.ts
+++ b/backend-express/src/config/env.ts
@@ -214,6 +214,18 @@ export const env = {
    */
   metaScraperKey: (process.env.META_SCRAPER_KEY ?? '').trim(),
 
+  /**
+   * HOTLEAD の API の認証情報（v2.2.267。features/hotlead/importer.ts）。KH（HOTLEAD_ID・HOTLEAD_PASS）と DJH（…_2）。
+   * ⚠️ sync（Heroku）の Config Vars と同じ値。⚠️ 無いアカウントは取り込まない（起動は止めない）。
+   * ⚠️ 設定先は ② VPS の .env.prod のみ。⚠️ **リポジトリに書かないこと。**
+   */
+  hotlead: {
+    id: (process.env.HOTLEAD_ID ?? '').trim(),
+    pass: (process.env.HOTLEAD_PASS ?? '').trim(),
+    id2: (process.env.HOTLEAD_ID_2 ?? '').trim(),
+    pass2: (process.env.HOTLEAD_PASS_2 ?? '').trim(),
+  },
+
   /**
    * 広告運用の担当者向けの読み出し API（GET /api/export/tracking/…）の鍵。（v2.2.265。features/trackingExport/router.ts）
    *
diff --git a/backend-express/src/server.ts b/backend-express/src/server.ts
index d5c61e07f..adaac3bca 100644
--- a/backend-express/src/server.ts
+++ b/backend-express/src/server.ts
@@ -7,6 +7,7 @@ import { startCvMatch } from './features/tracking/cvMatch';
 import { startTrackingMaintenance } from './features/tracking/maintenance';
 import { startIeloveMatch } from './features/realty/ieloveMatch';
 import { startSyncLogMaintenance } from './features/syncLog';
+import { startHotleadScheduler } from './features/hotlead/importer';
 import { startAccessLogMaintenance } from './features/accessLog';
 import { gatewaySummary, logGatewayRoutes } from './gateway';
 import { logger } from './utils/logger';
@@ -45,6 +46,8 @@ const bootstrap = async (): Promise<void> => {
     startIeloveMatch();
     // sync の実行結果の、180日より古い行の削除（v2.2.259。1日ごと）
     startSyncLogMaintenance();
+    // HOTLEAD の追客情報の取り込み（v2.2.267。30分ごと。⚠️ 例外を外に出さない作り）
+    startHotleadScheduler();
     // 画面のアクセス記録の、13か月より古い行の削除（v2.2.266。1日ごと）
     startAccessLogMaintenance();
     // Claudeによる分析（v2.2.217）。再起動で消えた実行中の分析を失敗にする（画面が待ち続けないように）
diff --git a/docker-compose.prod.yml b/docker-compose.prod.yml
index 08d02491a..f330ee3b9 100644
--- a/docker-compose.prod.yml
+++ b/docker-compose.prod.yml
@@ -146,6 +146,15 @@ services:
       # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。** 渡し方・入れ替え方は docs/api-tracking-export.md
       - TRACKING_EXPORT_KEYS=${TRACKING_EXPORT_KEYS:-}
 
+      # HOTLEAD の API の認証情報（v2.2.267。② が30分ごとに追客情報を取り込む）。KH と DJH（_2）。
+      #
+      # ⚠️ sync（Heroku）の Config Vars と同じ値。⚠️ 未設定のアカウントは取り込まない（起動は止めない）。
+      # ⚠️ 値は .env.prod にのみ書くこと。**リポジトリには書かない。**
+      - HOTLEAD_ID=${HOTLEAD_ID:-}
+      - HOTLEAD_PASS=${HOTLEAD_PASS:-}
+      - HOTLEAD_ID_2=${HOTLEAD_ID_2:-}
+      - HOTLEAD_PASS_2=${HOTLEAD_PASS_2:-}
+
       # 「Claudeによる分析」（v2.2.217）が使う Anthropic の API キー（Claude Console で発行したもの）。
       #
       # ⚠️ 未設定だと分析の開始が 503 になる（他の機能は動く）。
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index e971763f4..cd513e8a3 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.266';
+export const newVersion = '2.2.267';
```
