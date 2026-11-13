# v2.2.266 画面のアクセス記録（staff_access_log）・「同期の実行結果」→「ポータル連携ログ」

日付：2026-11-13　ブランチ：v2.2.266

## 依頼
- すべての画面に URL が付いたので、アクセスの記録を残したい。新しい表にするか、staff の表で見るか、提案してほしい。必要なら新しいブランチで。
- 提案（新しい表 `staff_access_log`）への利用者の決定：
  1. 進める
  2. IP・端末（User-Agent）も残す
  3. 残す期間は **13か月**
  4. 記録を見る画面も **このブランチで作る**
- 追記：ヘッダーのメニューの名前 `同期の実行結果` → `ポータル連携ログ`

## 調べたこと（staff の表で済ませない理由）
- `heartbeat`（20秒ごと。① の heartbeat.php）が、`staff.log`（JSON の配列）に `{time, url}` を1件足して、**JSON 全体を書き戻していた**。
- ローカルの写しで合計 **272MB**、1人で最大 **9.5MB・約20万件**。消す仕組みが無く、20秒ごとに数MB を読み書きしていた。`SELECT * FROM staff` をしている処理も巻き込まれる。
- `staff.log` を表示している画面は無い。
- `get_token`（画面を移るたび）は `staff.url`・`staff.timestamp` を上書きするだけ（最後の1件しか残らない）。

## 作ったもの
### 表 `staff_access_log`（`backend/scripts/sql/2026-11-13_staff_access_log.sql`）
1行 = 画面を1回開いたこと。`staff_id`・`staff_name`・`authority`・`division`（開いた時点の写し）・`path`（? 以降は残さない）・`opened_at`・`last_seen_at`（最後の heartbeat）・`ip`・`user_agent`。索引は（日時）（担当者・日時）（画面・日時）。

### ②（`backend-express/src/features/accessLog.ts` 新規）
| request | auth | 内容 |
|---|---|---|
| `access_log:open` | staff | 画面を移ったとき。1行足して id を返す。3秒以内の同じ人・同じ画面は同じ行（開発中の React の二重実行・素早い戻る進む） |
| `heartbeat` | staff | ① の heartbeat.php から移した。`staff.heartbeat`（オンラインの表示）と、その行の `last_seen_at` を更新。**staff.log には書かない**。他の人の行は更新しない |
| `access_log_list` | master | 一覧。期間（既定は直近7日）・担当者・画面・キーワード。集計（KPI・画面ごと・担当者ごと）は全件、明細は新しい順に 2,000 行まで |
- 13か月より古い行を毎日消す（`startAccessLogMaintenance`。起動の5分後と1日ごと。server.ts）。
- 日時は ② で日本時間を作って書く（DB の NOW() は時刻帯に左右される。ローカルの DB は UTC）。
- 担当者はトークンから決める（画面から送られた名前は使わない）。IP・端末は securityLog.ts の `clientOf`（① が渡す X-Client-IP など）を使う（export に変えた）。

### ①
- `express_proxy.php`：`access_log`・`access_log_list` を両方のリストに、`heartbeat` を expressProxyRequests だけに（① に PHP があるので、② が止まったら ① が代わりに staff.heartbeat だけ更新する）。
- `heartbeat.php`（予備）：**staff.log への書き足しをやめた**。`SELECT *` もやめて id だけ読む。

### 画面
- `ActiveUser.tsx`：画面を移ったら `access_log:open`（pathname だけ）を送り、返ってきた id を heartbeat に付ける。失敗しても画面は止めない。
- `header/system/AccessLog.tsx`（新規。接頭辞 `al_`。SecurityLog.tsx と同じ形）：期間・担当者・キーワード、KPI 4つ（開いた回数・担当者・画面の種類・1人あたり）、タブ（画面ごと・担当者ごと・明細）、見出しで並べ替え、名前・画面を押すとその明細だけ（札で外す）。画面の名前は guideScreens.ts・headerScreens.tsx・RealtyMenu.tsx から URL で引く。
- `headerScreens.tsx`：「システム管理 → アクセス記録」（`/accessLog`・Master だけ）を足し、「同期の実行結果」を「ポータル連携ログ」に（URL `/syncLog` は同じ）。
- `guideScreens.ts`：`'ポータル連携ログ'`（改名）・`'アクセス記録'`（新規）。
- `SyncLog.tsx`：注記とエラーの文言の名前。

### 業務ガイドの記事（update_log の SQL の末尾。ローカルにも流した）
| 記事 | 変えた点 |
|---|---|
| ポータル連携ログ（common/screen-198。旧「同期の実行結果」） | タイトル（`UPDATE guide_article SET title …` を先に）・本文の名前・改名のお知らせ・関係する記事に「アクセス記録」 |
| ヘッダーのメニュー（common/screen-105） | 管理者だけの項目に「ポータル連携ログ」「アクセス記録」、項目ごとの記事 |
| アクセス記録（common/screen-201。新規） | 見方・画面ごと・担当者ごと・明細・滞在時間の注意・13か月 |

### 版
- version.ts 2.2.266、`2026-11-13_update_log_2.2.266.sql`（ローカル no=365）。

## テスト（`scratchpad/c266/test.cjs`。**40項目 OK**）
- ① 経由・トークン無し：access_log・access_log_list・heartbeat → 401（② まで届いている）
- open：id を返す・`?` と `#` から後ろを残さない・担当者はトークンから・権限と事業を写す・IP と端末（① が渡した値）・日本時間・3秒以内の同じ画面は同じ id・別の画面は新しい id・`/` で始まらない path は 400
- heartbeat：staff.heartbeat を更新・**staff.log に書かない**・その行の last_seen_at を更新・前の画面の行と他の人の行は更新しない・access_id なしでも 200
- access_log_list：Master 以外 403・集計・既定の期間・担当者・画面・キーワード・期間の指定
- 画面（Playwright・3100）：/company を開くと1行増える、20秒後の heartbeat で last_seen_at、ヘッダーに「ポータル連携ログ」「アクセス記録」があり「同期の実行結果」が無い、メニューから /accessLog、KPI 4つ、画面の名前（全社報告用フォーマット・システム管理 › アクセス記録）、担当者ごと、名前を押すと明細と札、権限・事業・滞在・端末、札で外れる、見出しで並べ替え、/syncLog の見出し、エラー無し、Master 以外は「この画面を見る権限がありません」
- 13か月の削除：14か月前の行は消え、12か月前の行は残った（② の起動5分後）
- 型チェック（② とフロント）エラー 0、ESLint は以前からの警告1つだけ
- リファクタリング：今回のコードに重複・使っていない import は無し
- 仮スタッフ 999999・999998、テストの記録は消した。3100 は止めた。
- ⚠️ テストの途中で「Master 以外が真っ白」に見えたのは、ログインの確認（get_token）に約21秒かかっていたため（待つと正しく「権限がありません」が出た。版の設定の問題ではない）。

## 残っていること
- `staff.log` の今のデータ（本番で数百MB の見込み）は消していない。新しい表で記録できていることを本番で確かめたあと、次の版でバックアップを取ってから空にすることを勧める（消す前に利用者に確認）。

## 追加した関数・コンポーネント（全文）

### backend-express/src/features/accessLog.ts
```ts
import type { Request } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, type SqlParam } from '../db/pool';
import type { AuthenticatedStaff } from '../types/staff';
import { logger } from '../utils/logger';
import { clientOf } from './securityLog';

/**
 * 画面のアクセス記録（v2.2.266。表 staff_access_log）。
 *
 * ─────────────────────────────────────────────
 *   access_log:open   … 画面を移ったとき（ActiveUser.tsx）。1行足して id を返す
 *   heartbeat         … 20秒ごと（ActiveUser.tsx）。staff.heartbeat（オンラインの表示）と、その行の last_seen_at を更新する
 *   access_log_list   … 一覧（ヘッダーの「システム管理 → アクセス記録」。Master だけ）
 *
 * ⚠️⚠️ heartbeat は ① の heartbeat.php から移した。**staff.log（JSON の配列）への書き足しはやめた。**
 *   ⚠️ 以前は 20秒ごとに JSON 全体を読んで1件足して書き戻していた（ローカルの写しで1人最大 9.5MB・合計 272MB）。
 *   ⚠️ ① の heartbeat.php は ② が止まったときの予備として残してある（予備も staff.log には書かない）。
 * ⚠️ 担当者は、画面から送られた名前ではなく、トークンから決めた staff（ctx.staff）を使う。
 * ⚠️ path は ? と # から後ろを残さない（お客様の ID などが入ることがあるため）。
 * ⚠️ 日時は日本時間を ② で作って書く（⚠️ DB の NOW() は DB の時刻帯に左右される。ローカルの DB は UTC）。
 * ⚠️ 13か月より古い行は毎日消す（startAccessLogMaintenance）。
 * ⚠️ 記録に失敗しても画面は止めない（呼ぶ側の ActiveUser.tsx が失敗を無視する）。
 * ─────────────────────────────────────────────
 */

const KEEP_MONTHS = 13;
/** 一覧に返す行の上限（新しい順） */
const MAX_ROWS = 2000;
/** 同じ人が同じ画面をこの秒数の内にもう一度開いたら、同じ行とみなす（開発中の React の二重実行・素早い戻る進む） */
const SAME_OPEN_SECONDS = 3;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: unknown, max: number): string =>
  String(value ?? '').replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, max);

/** 日本時間の 'YYYY-MM-DD HH:MM:SS'（ms だけずらした時刻） */
const jst = (offsetMs = 0): string => new Date(Date.now() + offsetMs + 9 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');

/** 画面の URL（/ で始まる。? と # から後ろは捨てる）。読めなければ null */
const pathOf = (value: unknown): string | null => {
  const path = text(String(value ?? '').split(/[?#]/)[0], 255);
  return path.startsWith('/') ? path : null;
};

interface IdRow extends RowDataPacket { id: number }

/** 画面を開いた（1行足す）。⚠️ 直前に同じ画面を開いた行があれば、その id を返す */
export const openAccess = async (
  staff: AuthenticatedStaff,
  body: Record<string, unknown>,
  req: Request
): Promise<{ httpStatus: number; body: Record<string, unknown> }> => {
  const path = pathOf(body.path);
  if (path === null) return { httpStatus: 400, body: { status: 'error', message: 'path は / で始まる画面の URL を送ってください' } };

  const now = jst();
  const [recent] = await query<IdRow>(
    'SELECT id FROM staff_access_log WHERE staff_id = ? AND path = ? AND opened_at >= ? ORDER BY id DESC LIMIT 1',
    [staff.id, path, jst(-SAME_OPEN_SECONDS * 1000)]
  );
  if (recent !== undefined) return { httpStatus: 200, body: { status: 'ok', id: recent.id } };

  const client = clientOf(req);
  const result = await execute(
    `INSERT INTO staff_access_log (staff_id, staff_name, authority, division, path, opened_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [staff.id, staff.name.slice(0, 100), staff.brand.slice(0, 32), staff.shop.slice(0, 16), path, now, client.ip, client.userAgent]
  );
  return { httpStatus: 200, body: { status: 'ok', id: result.insertId } };
};

/**
 * 20秒ごと。staff.heartbeat を更新し、access_id があればその行の last_seen_at も更新する。
 * ⚠️ 他の人の行は更新しない（staff_id も条件に入れる）。
 */
export const heartbeat = async (staff: AuthenticatedStaff, body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const now = jst();
  await execute('UPDATE staff SET heartbeat = ? WHERE id = ?', [now, staff.id]);
  const accessId = Number(body.access_id);
  if (Number.isSafeInteger(accessId) && accessId > 0) {
    await execute('UPDATE staff_access_log SET last_seen_at = ? WHERE id = ? AND staff_id = ?', [now, accessId, staff.id]);
  }
  return { status: 'ok' };
};

interface LogRow extends RowDataPacket {
  id: number;
  staffId: number;
  staffName: string;
  authority: string;
  division: string;
  path: string;
  openedAt: string;
  lastSeenAt: string | null;
  seconds: number | null;
  ip: string;
  userAgent: string;
}
interface PathRow extends RowDataPacket { path: string; views: number; staffCount: number; avgSeconds: number | null; lastAt: string }
interface StaffRow extends RowDataPacket { staffId: number; staffName: string; views: number; screens: number; lastAt: string }
interface NumRow extends RowDataPacket { views: number; staffCount: number; screens: number }
interface NameRow extends RowDataPacket { staffName: string }

/**
 * 一覧（Master だけ）。
 * 本文: from / to（YYYY-MM-DD。既定は直近7日）・staff（担当者の名前。完全一致）・path（画面の URL。完全一致）・q（名前・URL・IP の一部）
 * ⚠️ 行は新しい順に MAX_ROWS まで。⚠️ 集計（KPI・画面ごと・担当者ごと）は絞り込み後の全件で数える。
 */
export const listAccessLog = async (body: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const today = jst().slice(0, 10);
  const weekAgo = jst(-6 * 24 * 3600_000).slice(0, 10);
  const from = DAY.test(String(body.from ?? '')) ? String(body.from) : weekAgo;
  const to = DAY.test(String(body.to ?? '')) ? String(body.to) : today;
  const staffName = text(body.staff, 100);
  const path = text(body.path, 255);
  const q = text(body.q, 100);

  const where = ['opened_at >= ?', 'opened_at < DATE_ADD(?, INTERVAL 1 DAY)'];
  const params: SqlParam[] = [from, to];
  if (staffName !== '') { where.push('staff_name = ?'); params.push(staffName); }
  if (path !== '') { where.push('path = ?'); params.push(path); }
  if (q !== '') {
    where.push('(staff_name LIKE ? OR path LIKE ? OR ip LIKE ?)');
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(like, like, like);
  }
  const cond = where.join(' AND ');

  const [rows, totals, byPath, byStaff, names] = await Promise.all([
    query<LogRow>(
      `SELECT id, staff_id AS staffId, staff_name AS staffName, authority, division, path,
              DATE_FORMAT(opened_at, '%Y-%m-%d %H:%i:%s') AS openedAt,
              DATE_FORMAT(last_seen_at, '%Y-%m-%d %H:%i:%s') AS lastSeenAt,
              TIMESTAMPDIFF(SECOND, opened_at, last_seen_at) AS seconds, ip, user_agent AS userAgent
         FROM staff_access_log WHERE ${cond}
        ORDER BY opened_at DESC, id DESC LIMIT ${MAX_ROWS + 1}`,
      params
    ),
    query<NumRow>(
      `SELECT COUNT(*) AS views, COUNT(DISTINCT staff_id) AS staffCount, COUNT(DISTINCT path) AS screens
         FROM staff_access_log WHERE ${cond}`,
      params
    ),
    query<PathRow>(
      `SELECT path, COUNT(*) AS views, COUNT(DISTINCT staff_id) AS staffCount,
              ROUND(AVG(TIMESTAMPDIFF(SECOND, opened_at, last_seen_at))) AS avgSeconds,
              DATE_FORMAT(MAX(opened_at), '%Y-%m-%d %H:%i') AS lastAt
         FROM staff_access_log WHERE ${cond} GROUP BY path ORDER BY views DESC, path`,
      params
    ),
    query<StaffRow>(
      `SELECT staff_id AS staffId, MAX(staff_name) AS staffName, COUNT(*) AS views, COUNT(DISTINCT path) AS screens,
              DATE_FORMAT(MAX(opened_at), '%Y-%m-%d %H:%i') AS lastAt
         FROM staff_access_log WHERE ${cond} GROUP BY staff_id ORDER BY views DESC, staffName`,
      params
    ),
    // 担当者の選択肢（⚠️ 期間だけで出す。担当者で絞っても選択肢が1人にならないように）
    query<NameRow>(
      `SELECT DISTINCT staff_name AS staffName FROM staff_access_log
        WHERE opened_at >= ? AND opened_at < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY staff_name`,
      [from, to]
    ),
  ]);

  const num = (v: unknown): number => Number(v ?? 0);
  return {
    status: 'ok',
    from,
    to,
    totals: { views: num(totals[0]?.views), staffCount: num(totals[0]?.staffCount), screens: num(totals[0]?.screens) },
    byPath: byPath.map((r) => ({ ...r, views: num(r.views), staffCount: num(r.staffCount), avgSeconds: r.avgSeconds === null ? null : num(r.avgSeconds) })),
    byStaff: byStaff.map((r) => ({ ...r, views: num(r.views), screens: num(r.screens) })),
    staffNames: names.map((r) => r.staffName),
    rows: rows.slice(0, MAX_ROWS).map((r) => ({ ...r, seconds: r.seconds === null ? null : num(r.seconds) })),
    truncated: rows.length > MAX_ROWS,
    maxRows: MAX_ROWS,
    keepMonths: KEEP_MONTHS,
  };
};

/** 13か月より古い行を消す（起動の5分後と、その後1日ごと。⚠️ 一度に消すのは5万行まで） */
export const startAccessLogMaintenance = (): void => {
  const run = (): void => {
    const limit = new Date(Date.now() + 9 * 3600_000);
    limit.setUTCMonth(limit.getUTCMonth() - KEEP_MONTHS);
    const border = limit.toISOString().slice(0, 19).replace('T', ' ');
    execute('DELETE FROM staff_access_log WHERE opened_at < ? LIMIT 50000', [border])
      .then((r) => { if (r.affectedRows > 0) logger.info(`access_log: ${KEEP_MONTHS}か月より古い記録 ${r.affectedRows} 件を消しました`); })
      .catch((error: unknown) => logger.error('access_log: 古い記録の削除に失敗しました', error));
  };
  setTimeout(run, 5 * 60_000).unref();
  setInterval(run, 24 * 3600_000).unref();
};
```

### frontend/src/components/header/system/AccessLog.tsx
```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../../utils/apiClient';
import { GUIDE_SCREENS } from '../../guide/guideScreens';
import { HEADER_SCREENS } from '../headerScreens';
import { REALTY_MENU } from '../../realty/RealtyMenu';

/**
 * アクセス記録（v2.2.266 新規）。ヘッダーの「システム管理 → アクセス記録」（⚠️ Master だけ。headerScreens.tsx）。
 *
 * ─────────────────────────────────────────────
 *   ② access_log_list（backend-express/src/features/accessLog.ts）で読む。⚠️ ② も Master だけに絞っている。
 *   書くのは ActiveUser.tsx（画面を移ったとき access_log:open、20秒ごとに heartbeat）。
 *
 * ⚠️ 滞在時間は「開いてから最後の heartbeat まで」（20秒ごと）。⚠️ タブを開いたままにしていれば、見ていなくても伸びる。
 * ⚠️ 集計（KPI・画面ごと・担当者ごと）は絞り込み後の全件。明細は新しい順に上限まで。
 * ⚠️ 画面の名前は、左のメニュー（guideScreens.ts）・ヘッダー（headerScreens.tsx）・不動産企画係（RealtyMenu.tsx）から URL で引く。
 *   ⚠️ 名前が無い URL はそのまま出す。
 *   ⚠️ headerScreens.tsx はこの画面を読み込むので、HEADER_SCREENS は描くときに読む（モジュールの最初では読まない）。
 * ⚠️ 見た目は GoogleReview.tsx・SecurityLog.tsx に合わせている（接頭辞 al_）。⚠️ 閉じるボタンは無い（ページ）。
 * ─────────────────────────────────────────────
 */

interface LogRow {
    id: number;
    staffId: number;
    staffName: string;
    authority: string;
    division: string;
    path: string;
    openedAt: string;
    lastSeenAt: string | null;
    seconds: number | null;
    ip: string;
    userAgent: string;
}
interface PathRow { path: string; views: number; staffCount: number; avgSeconds: number | null; lastAt: string }
interface StaffRow { staffId: number; staffName: string; views: number; screens: number; lastAt: string }

interface ListResponse {
    status: string;
    from: string;
    to: string;
    totals: { views: number; staffCount: number; screens: number };
    byPath: PathRow[];
    byStaff: StaffRow[];
    staffNames: string[];
    rows: LogRow[];
    truncated: boolean;
    maxRows: number;
    keepMonths: number;
}

type Tab = 'path' | 'staff' | 'rows';
type Filter = { from: string; to: string; staff: string; path: string; q: string };

const DIVISION: Record<string, string> = { order: '注文', spec: '建売', used: '中古', all: '全事業', realty: '不動産企画係' };

/** URL → 画面の名前（⚠️ 描くときに作る。上の注記） */
const buildScreenNames = (): Map<string, string> => {
    const names = new Map<string, string>();
    const add = (path: string | undefined, name: string) => {
        const p = (path ?? '').split('?')[0];
        if (p !== '' && !names.has(p)) names.set(p, name);
    };
    Object.entries(GUIDE_SCREENS).forEach(([name, s]) => {
        if (typeof s.route === 'string') add(s.route, name);
        else if (s.route) Object.values(s.route).forEach((r) => add(r, name));
    });
    HEADER_SCREENS.forEach((s) => add(s.path, s.menu ? `${s.menu} › ${s.item}` : s.item));
    REALTY_MENU.forEach((g) => g.items.forEach((i) => add(i.path, `不動産企画係 › ${i.label}`)));
    return names;
};

/** 滞在時間（⚠️ heartbeat が1回も届かなければ 20秒未満） */
const duration = (seconds: number | null): string => {
    if (seconds === null) return '20秒未満';
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分`;
    return `${Math.floor(seconds / 3600)}時間${Math.floor((seconds % 3600) / 60)}分`;
};

/** 端末（User-Agent を短く） */
const device = (ua: string): string => {
    const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : '';
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '';
    return [os, browser].filter(Boolean).join(' ・ ') || (ua === '' ? '不明' : 'その他');
};

type SortState = { key: string; order: 'asc' | 'desc' };

const sortRows = <T,>(list: T[], { key, order }: SortState): T[] => {
    const dir = order === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
        const av = (a as Record<string, unknown>)[key] ?? '';
        const bv = (b as Record<string, unknown>)[key] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv), 'ja') * dir;
    });
};

const AccessLog = () => {
    const [filter, setFilter] = useState<Filter>({ from: '', to: '', staff: '', path: '', q: '' });
    const [data, setData] = useState<ListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<Tab>('path');
    const [sort, setSort] = useState<Record<Tab, SortState>>({
        path: { key: 'views', order: 'desc' },
        staff: { key: 'views', order: 'desc' },
        rows: { key: 'openedAt', order: 'desc' },
    });

    const screenNames = useMemo(buildScreenNames, []);
    const screenName = useCallback((path: string) => screenNames.get(path) ?? '', [screenNames]);

    /** ⚠️ 期間・担当者・画面・キーワードは ② で絞る（明細は新しい順に上限まで返るため） */
    const load = useCallback(async (next: Filter) => {
        setLoading(true);
        setError('');
        try {
            const res = await apiClient.post('', { request: 'access_log_list', ...next });
            const body = res.data as ListResponse;
            if (body?.status !== 'ok') throw new Error('unexpected response');
            setData(body);
            setFilter({ ...next, from: body.from, to: body.to });
        } catch (e) {
            console.error('アクセス記録の取得に失敗しました:', e);
            setError('アクセス記録を読み込めませんでした。時間をおいて「表示」を押してください。');
        } finally {
            setLoading(false);
        }
    }, []);

    // ⚠️ 開いたときは期間を ② に任せる（直近7日）
    useEffect(() => { void load({ from: '', to: '', staff: '', path: '', q: '' }); }, [load]);

    const apply = (patch: Partial<Filter> = {}) => void load({ ...filter, ...patch });

    const th = (t: Tab, label: string, key: string, width?: number, numeric = false) => {
        const active = sort[t].key === key;
        return (
            <th className={`al_th al_th_sort${numeric ? ' al_num' : ''}`} style={{ width }} title="クリックで並べ替え"
                onClick={() => setSort((p) => ({
                    ...p,
                    [t]: active ? { key, order: p[t].order === 'asc' ? 'desc' : 'asc' } : { key, order: numeric || key.endsWith('At') ? 'desc' : 'asc' },
                }))}>
                {label}<span className={`al_sort_icon${active ? ' is_active' : ''}`}>{active ? (sort[t].order === 'asc' ? '▲' : '▼') : '⇅'}</span>
            </th>
        );
    };

    const byPath = useMemo(() => sortRows(data?.byPath ?? [], sort.path), [data, sort.path]);
    const byStaff = useMemo(() => sortRows(data?.byStaff ?? [], sort.staff), [data, sort.staff]);
    const rows = useMemo(() => sortRows(data?.rows ?? [], sort.rows), [data, sort.rows]);

    const kpi = (label: string, value: string) => (
        <div className="al_kpi_card">
            <div className="al_kpi_label">{label}</div>
            <div className="al_kpi_value">{value}</div>
        </div>
    );

    const pathCell = (path: string) => (
        <button type="button" className="al_link" title="この画面だけを出す" onClick={() => { setTab('rows'); apply({ path }); }}>
            {screenName(path) !== '' ? screenName(path) : path}
            {screenName(path) !== '' && <span className="al_sub"> {path}</span>}
        </button>
    );
    const staffCell = (name: string) => (
        <button type="button" className="al_link" title="この人だけを出す" onClick={() => { setTab('rows'); apply({ staff: name }); }}>{name}</button>
    );

    const t = data?.totals;
    const empty = (cols: number) => (
        <tr><td className="al_td al_empty" colSpan={cols}>{loading ? '読み込み中…' : '該当する記録はありません'}</td></tr>
    );

    return (
        <div className="al_wrap">
            <style>{`
                .al_wrap { font-size: 13px; color: #1f2937; height: 100%; display: flex; flex-direction: column;
                           padding: 12px 40px 20px; box-sizing: border-box; }
                .al_inner { width: 100%; max-width: 1500px; margin: 0 auto; display: flex; flex-direction: column;
                            min-height: 0; flex: 1; gap: 10px; }
                .al_note { font-size: 11px; color: #6b7280; }
                .al_bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; background: #f8fafc;
                          border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; flex-shrink: 0; }
                .al_label { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 2px; }
                .al_kpi { display: flex; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }
                .al_kpi_card { flex: 1 1 130px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 14px; }
                .al_kpi_label { font-size: 11px; color: #6b7280; }
                .al_kpi_value { font-size: 20px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
                .al_caution { font-size: 11px; color: #92400e; line-height: 1.8; background: #fffbeb; border: 1px solid #fde68a;
                              border-radius: 8px; padding: 8px 12px; flex-shrink: 0; }
                .al_error { font-size: 12px; color: #b91c1c; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;
                            padding: 8px 12px; flex-shrink: 0; }
                .al_chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
                .al_chip { border: 1px solid #bfdbfe; background: #eff6ff; color: #1e40af; border-radius: 999px; font-size: 11px;
                           padding: 2px 10px; cursor: pointer; }
                .al_chip:hover { background: #dbeafe; }
                .al_tabs { display: flex; gap: 4px; border-bottom: 1px solid #e5e7eb; flex-shrink: 0; }
                .al_tab { border: none; background: none; padding: 6px 14px; font-size: 12px; font-weight: 700; color: #6b7280;
                          border-bottom: 2px solid transparent; margin-bottom: -1px; cursor: pointer; }
                .al_tab.is_active { color: #1d4ed8; border-bottom-color: #2563eb; }
                .al_tab_count { margin-left: 4px; font-weight: 400; color: #9ca3af; }
                .al_table_wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: auto; background: #fff;
                                 flex: 1 1 auto; min-height: 240px; }
                .al_table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 12px; }
                .al_th { position: sticky; top: 0; z-index: 2; background: #f8fafc; border-bottom: 1px solid #e5e7eb;
                         padding: 9px 10px; font-weight: 700; font-size: 11px; color: #4b5563; white-space: nowrap; text-align: left; }
                .al_th_sort { cursor: pointer; user-select: none; }
                .al_th_sort:hover { background: #eef2f7; }
                .al_sort_icon { margin-left: 6px; font-size: 10px; color: #cbd5e1; }
                .al_sort_icon.is_active { color: #2563eb; }
                .al_td { border-bottom: 1px solid #f1f5f9; padding: 7px 10px; vertical-align: top; }
                .al_row:hover > .al_td { background: #f8fafc; }
                .al_num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
                .al_time { white-space: nowrap; font-variant-numeric: tabular-nums; }
                .al_sub { font-size: 11px; color: #9ca3af; }
                .al_link { border: none; background: none; padding: 0; color: #1d4ed8; cursor: pointer; font: inherit; text-align: left; }
                .al_link:hover { text-decoration: underline; }
                .al_pill { display: inline-block; border-radius: 999px; font-size: 10px; font-weight: 700; padding: 0 7px;
                           background: #f3f4f6; color: #4b5563; margin-left: 4px; white-space: nowrap; }
                .al_ip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11.5px; white-space: nowrap; }
                .al_empty { text-align: center; color: #9ca3af; padding: 32px 0; }
                @media (max-width: 900px) { .al_wrap { padding: 12px 16px 16px; } }
            `}</style>

            <div className="al_inner">
                <div className="al_note">
                    誰が・いつ・どの画面を開いたかの記録です（v2.2.266 から）。管理者だけが見られます。
                </div>

                <div className="al_bar">
                    <div>
                        <div className="al_label">期間</div>
                        <div className="d-flex align-items-center gap-1">
                            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={filter.from}
                                onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))} aria-label="期間の始め" />
                            <span className="al_note">〜</span>
                            <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={filter.to}
                                onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))} aria-label="期間の終わり" />
                        </div>
                    </div>
                    <div>
                        <div className="al_label">担当者</div>
                        <select className="form-select form-select-sm" style={{ width: 160 }} value={filter.staff}
                            onChange={(e) => apply({ staff: e.target.value })} aria-label="担当者">
                            <option value="">すべて</option>
                            {(data?.staffNames ?? []).map((n) => <option key={n} value={n}>{n}</option>)}
                            {filter.staff !== '' && !(data?.staffNames ?? []).includes(filter.staff) && <option value={filter.staff}>{filter.staff}</option>}
                        </select>
                    </div>
                    <div>
                        <div className="al_label">キーワード</div>
                        <input className="form-control form-control-sm" style={{ width: 200 }} value={filter.q} placeholder="名前・URL・IP の一部"
                            onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} aria-label="キーワード" />
                    </div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => apply()} disabled={loading}>
                        {loading ? '読み込み中…' : '表示'}
                    </button>
                </div>

                {(filter.path !== '' || filter.staff !== '') && (
                    <div className="al_chips">
                        <span className="al_note">絞り込み（押すと外す）:</span>
                        {filter.staff !== '' && <button type="button" className="al_chip" onClick={() => apply({ staff: '' })}>担当者：{filter.staff} ✕</button>}
                        {filter.path !== '' && (
                            <button type="button" className="al_chip" onClick={() => apply({ path: '' })}>
                                画面：{screenName(filter.path) || filter.path} ✕
                            </button>
                        )}
                    </div>
                )}

                {error !== '' && <div className="al_error" role="alert">{error}</div>}

                {data && t && (
                    <>
                        <div className="al_kpi">
                            {kpi('開いた回数', t.views.toLocaleString())}
                            {kpi('担当者', `${t.staffCount.toLocaleString()}人`)}
                            {kpi('画面の種類', t.screens.toLocaleString())}
                            {kpi('1人あたりの回数', t.staffCount > 0 ? (Math.round((t.views / t.staffCount) * 10) / 10).toLocaleString() : '0')}
                        </div>

                        <div className="al_caution">
                            滞在時間は、画面を開いてから最後に在席の合図（20秒ごと）が届くまでのおおよその時間です。画面を開いたまま席を離れても伸びます。
                            記録は {data.keepMonths}か月で消えます。
                            {data.truncated && <><br />⚠️ 明細は新しい順に {data.maxRows.toLocaleString()} 行までを出しています（集計はすべての行で数えています）。期間を短くするか、担当者・画面で絞ってください。</>}
                        </div>

                        <div className="al_tabs" role="tablist">
                            {([['path', '画面ごと', byPath.length], ['staff', '担当者ごと', byStaff.length], ['rows', '明細', rows.length]] as [Tab, string, number][]).map(([k, label, n]) => (
                                <button key={k} type="button" role="tab" aria-selected={tab === k} className={`al_tab${tab === k ? ' is_active' : ''}`}
                                    onClick={() => setTab(k)}>
                                    {label}<span className="al_tab_count">{n.toLocaleString()}</span>
                                </button>
                            ))}
                        </div>

                        <div className="al_table_wrap">
                            <table className="al_table">
                                {tab === 'path' && (
                                    <>
                                        <thead>
                                            <tr>
                                                {th('path', '画面', 'path')}
                                                {th('path', '開いた回数', 'views', 110, true)}
                                                {th('path', '人数', 'staffCount', 80, true)}
                                                {th('path', '平均の滞在', 'avgSeconds', 110, true)}
                                                {th('path', '最後に開いた', 'lastAt', 140)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {byPath.length === 0 && empty(5)}
                                            {byPath.map((r) => (
                                                <tr key={r.path} className="al_row">
                                                    <td className="al_td">{pathCell(r.path)}</td>
                                                    <td className="al_td al_num">{r.views.toLocaleString()}</td>
                                                    <td className="al_td al_num">{r.staffCount.toLocaleString()}</td>
                                                    <td className="al_td al_num">{duration(r.avgSeconds)}</td>
                                                    <td className="al_td al_time">{r.lastAt}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </>
                                )}
                                {tab === 'staff' && (
                                    <>
                                        <thead>
                                            <tr>
                                                {th('staff', '担当者', 'staffName')}
                                                {th('staff', '開いた回数', 'views', 110, true)}
                                                {th('staff', '画面の種類', 'screens', 110, true)}
                                                {th('staff', '最後に開いた', 'lastAt', 140)}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {byStaff.length === 0 && empty(4)}
                                            {byStaff.map((r) => (
                                                <tr key={r.staffId} className="al_row">
                                                    <td className="al_td">{staffCell(r.staffName)}</td>
                                                    <td className="al_td al_num">{r.views.toLocaleString()}</td>
                                                    <td className="al_td al_num">{r.screens.toLocaleString()}</td>
                                                    <td className="al_td al_time">{r.lastAt}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </>
                                )}
                                {tab === 'rows' && (
                                    <>
                                        <thead>
                                            <tr>
                                                {th('rows', '開いた日時', 'openedAt', 150)}
                                                {th('rows', '担当者', 'staffName', 160)}
                                                {th('rows', '画面', 'path')}
                                                {th('rows', '滞在', 'seconds', 90, true)}
                                                {th('rows', 'IP', 'ip', 130)}
                                                <th className="al_th">端末</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.length === 0 && empty(6)}
                                            {rows.map((r) => (
                                                <tr key={r.id} className="al_row">
                                                    <td className="al_td al_time">{r.openedAt}</td>
                                                    <td className="al_td">
                                                        {staffCell(r.staffName)}
                                                        <div className="al_sub">{r.authority}{r.division !== '' ? ` ・ ${DIVISION[r.division] ?? r.division}` : ''}</div>
                                                    </td>
                                                    <td className="al_td">{pathCell(r.path)}</td>
                                                    <td className="al_td al_num">{duration(r.seconds)}</td>
                                                    <td className="al_td al_ip">{r.ip}</td>
                                                    <td className="al_td" title={r.userAgent}>{device(r.userAgent)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </>
                                )}
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AccessLog;
```

### backend/src/handlers/heartbeat.php
```php
<?php
/**
 * 20秒ごとの在席（staff.heartbeat）。
 *
 * ⚠️⚠️ v2.2.266 から本体は ② の heartbeat（backend-express/src/features/accessLog.ts）。
 *   ここは ② に届かないときの予備（express_proxy.php の expressProxyRequests にだけ入れてある）。
 * ⚠️⚠️ **staff.log（JSON の配列）への書き足しはやめた。**
 *   ⚠️ 以前は 20秒ごとに JSON 全体を読んで1件足して書き戻しており、1人で数MB まで増え続けていた。
 *   ⚠️ 画面のアクセス記録は staff_access_log（② が書く）。予備のこちらは記録しない（在席の表示だけ保つ）。
 * ⚠️ 以前は `SELECT *` で大きな staff.log まで読んでいたので、読む列を絞った。
 */
try {

    $sql = "SELECT id FROM staff WHERE api_token = ? AND api_token <> ''";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$data['token'] ?? '']);
    $result = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if ($result) {
        $updateSql = "UPDATE staff SET heartbeat = ? WHERE id = ?";
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->execute([date('Y-m-d H:i:s'), $result[0]['id']]);
        http_response_code(204); // No Content
    }
} catch (PDOException $e) {
    echo json_encode(["message" => "error", "details" => "データベースエラーが発生しました: " . $e->getMessage()]);
}
```

### backend/scripts/sql/2026-11-13_staff_access_log.sql
```sql
-- =====================================================================
-- v2.2.266 画面のアクセス記録（staff_access_log）を作る
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。ローカルは docker exec で流す。
-- ⚠️ 何度流しても安全（CREATE TABLE IF NOT EXISTS）。⚠️ 既存の表は変えない（staff.log はこの版では消さない）。
-- ⚠️ 戻すとき: DROP TABLE staff_access_log;（⚠️ 記録はすべて消える）
--
-- 1行 = 担当者が画面を1回開いたこと。
--   書くのは ② の access_log（画面を移ったとき）と heartbeat（20秒ごとに last_seen_at を更新）。
--   ⚠️ 13か月より古い行は ② が毎日消す（features/accessLog.ts）。
--   ⚠️ 担当者・権限・担当事業は、開いた時点の staff の値を写す（あとで変わっても記録は変わらない）。
--   ⚠️ path は ? 以降を残さない（お客様の ID などが入ることがあるため）。
-- =====================================================================

CREATE TABLE IF NOT EXISTS staff_access_log (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    staff_id      INT             NOT NULL COMMENT 'staff.id',
    staff_name    VARCHAR(100)    NOT NULL DEFAULT '' COMMENT '開いた時点の staff.name',
    authority     VARCHAR(32)     NOT NULL DEFAULT '' COMMENT '開いた時点の権限（staff.brand。Master / BrandAdmin / ordinary など）',
    division      VARCHAR(16)     NOT NULL DEFAULT '' COMMENT '開いた時点の担当事業（staff.shop。order / spec / used / all）',
    path          VARCHAR(255)    NOT NULL COMMENT '開いた画面（/company など。? 以降は残さない）',
    opened_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '開いた日時',
    last_seen_at  DATETIME        DEFAULT NULL COMMENT '最後に heartbeat が届いた日時（無ければ 20秒以内に離れた）',
    ip            VARCHAR(45)     NOT NULL DEFAULT '' COMMENT '接続元（① を経由したときは ① が渡した値）',
    user_agent    VARCHAR(255)    NOT NULL DEFAULT '' COMMENT '端末（ブラウザ）',
    PRIMARY KEY (id),
    KEY idx_staff_access_time (opened_at),
    KEY idx_staff_access_staff (staff_id, opened_at),
    KEY idx_staff_access_path (path, opened_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='画面のアクセス記録（v2.2.266。13か月で消す）';

-- 確認（⚠️ information_schema は ① で使えないので SHOW を使う）
SHOW TABLES LIKE 'staff_access_log';
```

## git diff（既存ファイル）
```diff
diff --git a/backend-express/src/features/securityLog.ts b/backend-express/src/features/securityLog.ts
index 09bac2e7d..c8f9d3c63 100644
--- a/backend-express/src/features/securityLog.ts
+++ b/backend-express/src/features/securityLog.ts
@@ -54,8 +54,8 @@ const pathOf = (referer: string): string => {
   }
 };
 
-/** 接続元（上の注記） */
-const clientOf = (req: Request): { ip: string; viaIp: string; userAgent: string; path: string } => {
+/** 接続元（上の注記）。⚠️ v2.2.266 から accessLog.ts でも使う */
+export const clientOf =(req: Request): { ip: string; viaIp: string; userAgent: string; path: string } => {
   const direct = ipOf(req.ip);
   const fromPhp = (req.header('X-Forwarded-By') ?? '').includes('xserver-php');
   const claimed = fromPhp ? ipOf(req.header('X-Client-IP')) : '';
diff --git a/backend-express/src/gateway/registry.ts b/backend-express/src/gateway/registry.ts
index a56317f5a..1328622ff 100644
--- a/backend-express/src/gateway/registry.ts
+++ b/backend-express/src/gateway/registry.ts
@@ -191,6 +191,7 @@ import { runIeloveImport, runIeloveImportStatus } from '../features/realty/ielov
 import { runUsedQueueList, runUsedQueueMark } from '../features/callq/usedQueue';
 import { INQUIRY_CATEGORIES, MASTER_CATEGORIES, runPrivacyEraseInquiry, runPrivacyEraseMaster } from '../features/privacy';
 import type { AuthenticatedStaff } from '../types/staff';
+import { heartbeat, listAccessLog, openAccess } from '../features/accessLog';
 import type { GatewayContext, GatewayEntry, GatewayKey } from './types';
 import { gatewayKey } from './types';
 
@@ -3143,6 +3144,42 @@ register({
   handler: async (ctx) => listSecurityLog(ctx.body),
 });
 
+/**
+ * 画面のアクセス記録（v2.2.266。表 staff_access_log）。features/accessLog.ts 参照。
+ *
+ * ⚠️ access_log:open は画面を移ったとき、heartbeat は 20秒ごと（どちらも ActiveUser.tsx）。担当者はトークンで決める。
+ * ⚠️⚠️ heartbeat は ① の heartbeat.php から移した。**staff.log には書き足さない**（① の予備も同じに直した）。
+ *   ⚠️ heartbeat は ① に PHP があるので、② に届かなければ ① が代わりに staff.heartbeat だけ更新する（express_proxy.php の許可リストだけに入れてある）。
+ *   ⚠️ access_log は ① に PHP が無い書き込み（expressProxyExclusive にも入れてある）。
+ * ⚠️ access_log_list は Master だけ（ヘッダーの「システム管理 → アクセス記録」）。
+ */
+register({
+  request: 'access_log',
+  roll: 'open',
+  summary: '【書き込み】画面を開いた記録（1行足して id を返す）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'staff',
+  handler: async (ctx) => {
+    const result = await openAccess(ctx.staff as AuthenticatedStaff, ctx.body, ctx.req);
+    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
+    return result.body;
+  },
+});
+register({
+  request: 'heartbeat',
+  summary: '【書き込み】20秒ごとの在席（staff.heartbeat と、開いている画面の記録の最後の日時）',
+  phpSource: 'backend/src/handlers/heartbeat.php',
+  auth: 'staff',
+  handler: async (ctx) => heartbeat(ctx.staff as AuthenticatedStaff, ctx.body),
+});
+register({
+  request: 'access_log_list',
+  summary: '画面のアクセス記録（期間の行・画面ごと・担当者ごとの集計）',
+  phpSource: '（新規。PHP版なし）',
+  auth: 'master',
+  handler: async (ctx) => listAccessLog(ctx.body),
+});
+
 /**
  * sync（Heroku の自動取り込み）の実行結果（v2.2.259）。features/syncLog.ts 参照。
  *
diff --git a/backend-express/src/server.ts b/backend-express/src/server.ts
index 5af14bfd8..d5c61e07f 100644
--- a/backend-express/src/server.ts
+++ b/backend-express/src/server.ts
@@ -7,6 +7,7 @@ import { startCvMatch } from './features/tracking/cvMatch';
 import { startTrackingMaintenance } from './features/tracking/maintenance';
 import { startIeloveMatch } from './features/realty/ieloveMatch';
 import { startSyncLogMaintenance } from './features/syncLog';
+import { startAccessLogMaintenance } from './features/accessLog';
 import { gatewaySummary, logGatewayRoutes } from './gateway';
 import { logger } from './utils/logger';
 
@@ -44,6 +45,8 @@ const bootstrap = async (): Promise<void> => {
     startIeloveMatch();
     // sync の実行結果の、180日より古い行の削除（v2.2.259。1日ごと）
     startSyncLogMaintenance();
+    // 画面のアクセス記録の、13か月より古い行の削除（v2.2.266。1日ごと）
+    startAccessLogMaintenance();
     // Claudeによる分析（v2.2.217）。再起動で消えた実行中の分析を失敗にする（画面が待ち続けないように）
     failInterruptedJobs()
       .then((count) => { if (count > 0) logger.warn(`ai_analysis: 再起動で中断された分析 ${count} 件を失敗にしました`); })
diff --git a/backend/scripts/guide/articles/common/screen-105.md b/backend/scripts/guide/articles/common/screen-105.md
index a07ad671b..39cab1550 100644
--- a/backend/scripts/guide/articles/common/screen-105.md
+++ b/backend/scripts/guide/articles/common/screen-105.md
@@ -18,7 +18,7 @@ summary: 画面のいちばん上のメニュー（システム管理・反響
 
 ## 見られる人
 だれでも開けますが、次の項目は見られる人が決まっています。見られない項目はメニューに出ません。
-- **ローン情報更新**・**広告費シミュレーター**・**セキュリティログ**・**同期の実行結果**：管理者だけ
+- **ローン情報更新**・**広告費シミュレーター**・**セキュリティログ**・**ポータル連携ログ**・**アクセス記録**：管理者だけ
 - **アクセス解析**・**営業別契約率**・**予算テーブル**：管理者・ブランド管理者だけ
 - **Claudeによる分析**（メニューの左のボタン）：管理者・ブランド管理者・マネージャーだけ
 - **アクションボード**：注文営業だけ
@@ -35,6 +35,7 @@ summary: 画面のいちばん上のメニュー（システム管理・反響
 - [[アンバサダーの反響一覧]]
 - [[オーナーズハウス募集]]
 - [[セキュリティログ]]
-- [[同期の実行結果]]
+- [[ポータル連携ログ]]
+- [[アクセス記録]]
 - [[予算テーブル]]
 - [[イベントの広告費入力]]
diff --git a/backend/scripts/guide/articles/common/screen-198.md b/backend/scripts/guide/articles/common/screen-198.md
index 3ef2eb0bc..ac47699c1 100644
--- a/backend/scripts/guide/articles/common/screen-198.md
+++ b/backend/scripts/guide/articles/common/screen-198.md
@@ -1,12 +1,14 @@
 ---
-title: 同期の実行結果
+title: ポータル連携ログ
 section: 画面の使い方
 sort: 198
 summary: ポータルの反響・集計・いえらぶの物件などの自動取り込みが、成功したか・失敗したか（理由つき）を見る画面（管理者だけ）。
 ---
-ヘッダーの「システム管理 → 同期の実行結果」（管理者だけ）。ポータルの反響・集計、いえらぶの物件、Google クチコミなどを自動で取り込む仕組みの、実行の記録を見る画面です。取り込みが止まっていないかを確かめるために使います。
+ヘッダーの「システム管理 → ポータル連携ログ」（管理者だけ）。ポータルの反響・集計、いえらぶの物件、Google クチコミなどを自動で取り込む仕組みの、実行の記録を見る画面です。取り込みが止まっていないかを確かめるために使います。
 
-[[画面:同期の実行結果]]
+[[画面:ポータル連携ログ]]
+
+> 2026年11月13日に、名前を「同期の実行結果」から「ポータル連携ログ」に変えました。中身と使い方は変わっていません。
 
 > 2026年11月から、失敗のお知らせメールは送らなくなりました。失敗は、この画面で確かめてください。
 
@@ -33,3 +35,4 @@ summary: ポータルの反響・集計・いえらぶの物件などの自動
 
 ## 関係する記事
 - [[セキュリティログ]]
+- [[アクセス記録]]
diff --git a/backend/src/core/express_proxy.php b/backend/src/core/express_proxy.php
index 2cfbde648..c9c0ff1b1 100644
--- a/backend/src/core/express_proxy.php
+++ b/backend/src/core/express_proxy.php
@@ -420,6 +420,11 @@ function expressProxyRequests(): array
         'security_log_list',
         // ⚠️ v2.2.259: sync の実行結果（② だけ。Master）。⚠️ 書き込み（sync_log:write）は sync が ② へ直接送るので入れない
         'sync_log_list',
+        // ⚠️ v2.2.266: 画面のアクセス記録（features/accessLog.ts）。access_log は書き込み（② だけ）、access_log_list は Master
+        'access_log',
+        'access_log_list',
+        // ⚠️ v2.2.266: heartbeat を ② へ移した。⚠️ ① に heartbeat.php があるので expressProxyExclusive には入れない（② が止まったら ① が staff.heartbeat だけ更新する）
+        'heartbeat',
         // ⚠️ v2.2.243: 予算テーブル（Master / BrandAdmin。features/budgetTable.ts）。upload は書き込み（budget へ INSERT）
         'budget_table_list',
         'budget_table_upload',
@@ -925,6 +930,9 @@ function expressProxyExclusive(): array
         'security_log_list',
         // ⚠️ v2.2.259: sync の実行結果（② だけ。Master）。⚠️ 書き込み（sync_log:write）は sync が ② へ直接送るので入れない
         'sync_log_list',
+        // ⚠️ v2.2.266: 画面のアクセス記録（② だけ）。⚠️ heartbeat は ① に PHP があるので入れない
+        'access_log',
+        'access_log_list',
         // ⚠️ v2.2.243: 予算テーブル（Master / BrandAdmin。features/budgetTable.ts）。upload は書き込み（budget へ INSERT）
         'budget_table_list',
         'budget_table_upload',
diff --git a/frontend/src/components/ActiveUser.tsx b/frontend/src/components/ActiveUser.tsx
index 3c611eb22..bd4b15ca2 100644
--- a/frontend/src/components/ActiveUser.tsx
+++ b/frontend/src/components/ActiveUser.tsx
@@ -104,11 +104,18 @@ const ActiveUser: React.FC = () => {
         }
     }, []);
 
+    /**
+     * ⚠️ v2.2.266: 今開いている画面の記録（staff_access_log）の id。heartbeat に付けて送り、その行の最後の日時を更新する。
+     *   ⚠️ 画面を移ったら null に戻し、access_log:open の返事で入れ直す（返事より前の heartbeat は id なしで送る）。
+     */
+    const accessIdRef = useRef<number | null>(null);
+
     useEffect(() => {
         if (!token) return;
         if (location.pathname === '/login') return;
 
         let timer: ReturnType<typeof setTimeout>;
+        let alive = true;
 
         const resetTimer = () => {
             setIsInactive(false);
@@ -116,14 +123,25 @@ const ActiveUser: React.FC = () => {
             timer = setTimeout(() => setIsInactive(true), 20000);
         };
 
+        /**
+         * ⚠️ v2.2.266 から ② が受ける（① の heartbeat.php は予備）。⚠️ staff.log には書かなくなった（features/accessLog.ts）。
+         * ⚠️ 失敗しても画面は止めない。
+         */
         const sendHeartbeat = () => {
-            apiClient.post("", { request: 'heartbeat', token, url: location.pathname }).catch(() => { }); resetTimer();
+            apiClient.post("", { request: 'heartbeat', token, url: location.pathname, access_id: accessIdRef.current ?? undefined }).catch(() => { }); resetTimer();
         };
 
+        // ⚠️ v2.2.266: 画面を開いた記録。⚠️ ? 以降は送らない（pathname だけ）。⚠️ 失敗しても画面は止めない
+        accessIdRef.current = null;
+        apiClient.post("", { request: 'access_log', roll: 'open', path: location.pathname })
+            .then((res) => { if (alive && typeof res.data?.id === 'number') accessIdRef.current = res.data.id; })
+            .catch(() => { });
+
         sendHeartbeat();
         const hbInterval = setInterval(sendHeartbeat, 20000);
 
         return () => {
+            alive = false;
             clearInterval(hbInterval);
             clearTimeout(timer);
         };
diff --git a/frontend/src/components/guide/guideScreens.ts b/frontend/src/components/guide/guideScreens.ts
index 75e603449..00e71eab8 100644
--- a/frontend/src/components/guide/guideScreens.ts
+++ b/frontend/src/components/guide/guideScreens.ts
@@ -105,7 +105,9 @@ export const GUIDE_SCREENS: Record<string, GuideScreen> = {
     // ⚠️ v2.2.242。headerScreens.tsx と同じく Master だけ
     'セキュリティログ': { header: 'システム管理/セキュリティログ', authority: ['Master'] },
     // ⚠️ v2.2.259。headerScreens.tsx と同じく Master だけ
-    '同期の実行結果': { header: 'システム管理/同期の実行結果', authority: ['Master'] },
+    // ⚠️ v2.2.266 で「同期の実行結果」から改名
+    'ポータル連携ログ': { header: 'システム管理/ポータル連携ログ', authority: ['Master'] },
+    'アクセス記録': { header: 'システム管理/アクセス記録', authority: ['Master'] },
     // ⚠️ v2.2.243。headerScreens.tsx と同じく Master / BrandAdmin
     '予算テーブル': { header: 'システム管理/予算テーブル', authority: ADMIN },
 };
diff --git a/frontend/src/components/header/headerScreens.tsx b/frontend/src/components/header/headerScreens.tsx
index 954ff49c3..a9042b16b 100644
--- a/frontend/src/components/header/headerScreens.tsx
+++ b/frontend/src/components/header/headerScreens.tsx
@@ -6,6 +6,7 @@ import EditShop from './system/EditShop';
 import UploadLoan from './system/UploadLoan';
 import SecurityLog from './system/SecurityLog';
 import SyncLog from './system/SyncLog';
+import AccessLog from './system/AccessLog';
 import BudgetTable from './system/BudgetTable';
 import EditBlackList from './inquiry/EditBlackList';
 import BudgetSimulator from './inquiry/BudgetSimulator';
@@ -126,8 +127,10 @@ export const HEADER_SCREENS: HeaderScreen[] = [
     { menu: 'システム管理', item: 'ローン情報更新', path: '/uploadLoan', allow: isMaster, padded: true, render: () => <UploadLoan /> },
     // ⚠️ v2.2.242: セキュリティログは ⚠️⚠️ **Master だけ**（IP・ログインの記録が並ぶため。② の security_log_list も auth: 'master'）
     { menu: 'システム管理', item: 'セキュリティログ', path: '/securityLog', allow: isMaster, render: () => <SecurityLog /> },
-    // ⚠️ v2.2.259: 同期の実行結果は ⚠️⚠️ **Master だけ**（② の sync_log_list も auth: 'master'）
-    { menu: 'システム管理', item: '同期の実行結果', path: '/syncLog', allow: isMaster, render: () => <SyncLog /> },
+    // ⚠️ v2.2.259: ポータル連携ログ（v2.2.266 で「同期の実行結果」から改名）は ⚠️⚠️ **Master だけ**（② の sync_log_list も auth: 'master'）
+    { menu: 'システム管理', item: 'ポータル連携ログ', path: '/syncLog', allow: isMaster, render: () => <SyncLog /> },
+    // ⚠️ v2.2.266: アクセス記録は ⚠️⚠️ **Master だけ**（② の access_log_list も auth: 'master'）
+    { menu: 'システム管理', item: 'アクセス記録', path: '/accessLog', allow: isMaster, render: () => <AccessLog /> },
     // ⚠️ v2.2.243: 予算テーブルは ⚠️⚠️ **Master と BrandAdmin**（budget へ CSV で追加できるため。② の budget_table_* も同じ2つ）
     { menu: 'システム管理', item: '予算テーブル', path: '/budgetTable', allow: isAdmin, render: () => <BudgetTable /> },
 
diff --git a/frontend/src/components/header/system/SyncLog.tsx b/frontend/src/components/header/system/SyncLog.tsx
index 252ee2a04..9b830a0a1 100644
--- a/frontend/src/components/header/system/SyncLog.tsx
+++ b/frontend/src/components/header/system/SyncLog.tsx
@@ -2,7 +2,7 @@ import React, { useCallback, useEffect, useMemo, useState } from 'react';
 import apiClient from '../../../utils/apiClient';
 
 /**
- * 同期の実行結果（v2.2.259 新規）。ヘッダーの「システム管理 → 同期の実行結果」（⚠️ Master だけ。headerScreens.tsx）。
+ * ポータル連携ログ（v2.2.259 新規。v2.2.266 で「同期の実行結果」から改名）。ヘッダーの「システム管理 → ポータル連携ログ」（⚠️ Master だけ。headerScreens.tsx）。
  *
  * ─────────────────────────────────────────────
  *   ② sync_log_list（backend-express/src/features/syncLog.ts）で読む。⚠️ ② も Master だけに絞っている。
@@ -148,8 +148,8 @@ const SyncLog = () => {
             setFrom(body.from);
             setTo(body.to);
         } catch (e) {
-            console.error('同期の実行結果の取得に失敗しました:', e);
-            setError('同期の実行結果を読み込めませんでした。時間をおいて「表示」を押してください。');
+            console.error('ポータル連携ログの取得に失敗しました:', e);
+            setError('ポータル連携ログを読み込めませんでした。時間をおいて「表示」を押してください。');
         } finally {
             setLoading(false);
         }
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 5939b53a5..e971763f4 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.265';
+export const newVersion = '2.2.266';
```
