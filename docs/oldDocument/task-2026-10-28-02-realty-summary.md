# 作業記録 2026-10-28-02　v2.2.222 不動産企画係アプリの移植（第2段：チームサマリーを実データに）

## 指示
- v2.2.221 デプロイ済み。「次の段へ」（計画の v2.2.222: チームサマリーを実データに）

## 調べたこと（本番アプリ V18 の renderDash。キーを伏せた写しで読んだ）
- ダッシュボードの中身: 歩留まりファネル → 年間予算進捗 → 月次KPIサマリー（担当者別）→ 架電実績 → 一括査定KPI → 買い反響KPI → 朝礼用アラート（＋買取再販の期限・営業司令塔）
- **売上計上額＝仲介手数料＋リフォーム粗利**（V14.13）。仲介手数料は手入力ならその値、無ければ stdFee（800万以下30万、超は3%＋6万）。共同担当は売上を割合で、件数を0.5件ずつ按分（dealShares）。契約日の月で数え、失注は除く
- 本番アプリの商談には **reformPrice・reformGp・reformNote・createdAt** が増えていた（V14.11〜）。DB に列が無かった → 追加
- 今の Summary.tsx は 営業司令塔・歩留まりファネル・反響KPI は実データ、**年間予算進捗・月次KPI・架電実績が固定値**、朝礼用アラートは無し。対象月は 2026-07 で固定だった

## したこと
### 画面
- **新規 `realty/summary/kpi.ts`**: 本番アプリの関数をそのまま写した集計（`fiscalMonths` `prevMonth` `monthLabel` `callsOf` `leadKpi` `buyKpi` `leadCost` `CONFIRMED` `salesByStaffMonth` `feeByStaffMonth` `reformByStaffMonth` `reformGpByStaffMonth` `dealCountByStaffMonth` `ledgerCountByStaffMonth` `sumRow` `fmtCnt` `callStats` `emptyCallCell` `ALERT_DAYS` `dealRegDate` `alertWindow` `inWindow` `daysAgoLabel` `fmtYen` `fmtYen0` `pct` `todayStr`）
- `realty/summary/Summary.tsx`
  - 商談案件・媒介台帳を受け取る（削除済みは除く）。反響も削除済みを除くようにした
  - 対象月の既定を今月に。選択肢を今期の12か月に（期外なら期首月へ寄せる）
  - `kpi`（年間予算進捗・月次KPI）、`calls`（架電実績）、`alerts`（朝礼用アラート）を useMemo で計算
  - 年間予算進捗（累計・予算・遅れ／先行・内訳）、月次KPIサマリー（本番と同じ13列）、架電実績（担当者別・チーム内訳）を実データに。朝礼用アラートのカードを追加（表示・非表示の切り替え）
- `realty/common/LeadHeader.tsx`: `allowAllPeriod`（既定 true）・`monthSuffix`（既定「 受信分」）を追加。サマリーは「全期間」を出さず、「受信分」を付けない
- `version.ts`: 2.2.222

### ② / ①
- `features/realty/index.ts` `runPlannerSummary`: deals・ledger も返す。`ALLOWED_COLUMNS` に reformPrice・reformGp・reformNote・createdAt
- ① `plannerAction/planner_summary.php`・`brokerAction/broker_update.php`: 同じ変更
- SQL `2026-10-28_brokerage_listings_reform.sql`: 列を4つ追加（IF NOT EXISTS）

### 業務ガイド
- 新規記事 **チームサマリー（不動産企画係）**（common/screen-240.md）: 対象月、各カード、売上の数え方、設定の注意、見比べのお願い

## テスト
- ② の型チェック・① の PHP の構文・フロントのビルド（変えたファイルの警告は既存の formatMan だけ）
- ① と ② の応答の突き合わせ: planner:lead・planner:summary・broker:list が一致（summary は deals・ledger を含めて一致）
- **SQL で数え直して画面と一致**（2026年6月）: 売上 時任 ¥4,230,000・宮城 ¥2,916,000・永田 ¥1,503,000、契約件数 各3、媒介獲得 時任3・宮城4・岡崎3（台帳の略称を名前に直して）
- 今日付けのテストデータで: 共同担当60/40の按分（手数料 ¥660,000 → ¥396,000／¥264,000、リフォーム粗利 ¥300,000 → ¥180,000／¥120,000、件数 0.5ずつ）、朝礼用アラートに新規商談・新規媒介（addr2 の URL は消える）、架電実績（type 無しは架電、LINE は内訳）
- 対象月の選択肢が今期の12か月（全期間なし）。ブラウザのエラーなし
- テストのデータ・スタッフは消した

## 残したもの（次の段以降）
- 朝礼用アラートの「買取再販の期限」と、営業司令塔の詳細（本番の V12.card）は、買取再販・商談案件の移植のときに足す
- 担当者・予算・目標の設定画面は v2.2.223

---
# 新規ファイル（全文）

## frontend/src/components/realty/summary/kpi.ts
```
/**
 * チームサマリーの集計（v2.2.222）。
 *
 * ⚠️ 移植元は本番の不動産企画係アプリ（khf-eigyokanri.netlify.app。V18）の renderDash と、その下で使う関数。
 *   数字が本番と一致するよう、**定義をそのまま写している**（関数名の後ろの括弧は移植元の名前）。
 *   ⚠️ 移植元を直したら、ここも同じように直すこと（切り替えまでは本番と並べて見比べるため）。
 *
 * 入力は brokerage_listings の行（planner:summary が返す lead・deals・ledger）と app_state の settings。
 */

export type Row = Record<string, unknown>;

export type StaffSetting = {
    id?: string;
    abbr?: string;
    name?: string;
    /** 年間予算（売上計上額・円） */
    budget?: number;
    /** 今月目標（売上計上額・円） */
    monthlyGoal?: number;
    /** 年間の媒介受託目標（件） */
    baikaiTarget?: number;
};

export type Settings = {
    staff?: StaffSetting[];
    srcCosts?: Record<string, number>;
    portalCosts?: Record<string, number>;
    /** 期首月（YYYY-MM） */
    fiscalStart?: string;
    showDashAlerts?: boolean;
};

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const num = (v: unknown): number => Number(v) || 0;

/** 'YYYY-MM-DD'（ローカル日付） */
export const todayStr = (now = new Date()): string =>
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const addDays = (ds: string, n: number): string => {
    const d = new Date(`${ds}T00:00:00`);
    d.setDate(d.getDate() + n);
    return todayStr(d);
};

/** 期首から12か月（months） */
export const fiscalMonths = (fiscalStart: string | undefined): string[] => {
    const [y, m] = (fiscalStart && /^\d{4}-\d{2}$/.test(fiscalStart) ? fiscalStart : `${new Date().getFullYear()}-01`)
        .split('-').map(Number);
    return Array.from({ length: 12 }, (_, i) => {
        const mm = ((m - 1 + i) % 12) + 1;
        const yy = y + Math.floor((m - 1 + i) / 12);
        return `${yy}-${String(mm).padStart(2, '0')}`;
    });
};

/** 前月（prevMonth） */
export const prevMonth = (mk: string): string => {
    const [y, m] = mk.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** 'YYYY年M月'（mLabelFull） */
export const monthLabel = (mk: string): string => {
    const [y, m] = mk.split('-');
    return `${y}年${Number(m)}月`;
};

// ---------------------------------------------------------------------------
// 架電の記録（callDates）
// ---------------------------------------------------------------------------

type CallEntry = { date?: string; type?: string; staff?: string } | string;

/** callDates は JSON 文字列で入っている（配列のこともある） */
export const callsOf = (row: Row): CallEntry[] => {
    const raw = row.callDates;
    if (Array.isArray(raw)) return raw as CallEntry[];
    if (typeof raw !== 'string' || raw.trim() === '') return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as CallEntry[]) : [];
    } catch {
        return [];
    }
};

/** 架電の種類（callType）。⚠️ type が無い・知らない値は「架電」 */
const callType = (c: CallEntry): 'call' | 'line' | 'mail' => {
    const t = typeof c === 'object' && c !== null ? str(c.type) : '';
    return t === 'line' || t === 'mail' ? t : 'call';
};

/** 架電の日（callDay） */
const callDay = (c: CallEntry): string => (typeof c === 'object' && c !== null ? str(c.date) : str(c)).slice(0, 10);

// ---------------------------------------------------------------------------
// 反響の KPI（leadKpi / buyKpi）。⚠️ 受信月コホート。架電数だけはその月に行った架電（📞のみ）
// ---------------------------------------------------------------------------

const recvMonth = (l: Row): string => {
    const mk = str(l.receivedDate).slice(0, 7);
    return /^\d{4}-\d{2}$/.test(mk) ? mk : '';
};

const LEAD_AFTER_CONNECT = ['通電済', '訪問査定予定', '訪問査定済', '査定書提出', '媒介受託'];
const LEAD_AFTER_VISIT = ['訪問査定済', '査定書提出', '媒介受託'];
const LEAD_AFTER_PROPOSAL = ['査定書提出', '媒介受託'];

export type LeadKpi = { leads: number; calls: number; connects: number; visits: number; props: number; wins: number };
export type BuyKpi = { leads: number; calls: number; connects: number; views: number; offers: number; wins: number };

const countCallsIn = (rows: Row[], mk: string): number =>
    rows.reduce((a, l) => a + callsOf(l).filter((c) => callDay(c).slice(0, 7) === mk && callType(c) === 'call').length, 0);

export const leadKpi = (leads: Row[], mk: string): LeadKpi => {
    const ls = leads.filter((l) => recvMonth(l) === mk);
    const phase = (l: Row) => str(l.phase);
    return {
        leads: ls.length,
        calls: countCallsIn(leads, mk),
        connects: ls.filter((l) => str(l.connectDate) !== '' || LEAD_AFTER_CONNECT.includes(phase(l))).length,
        visits: ls.filter((l) => str(l.visitDate) !== '' || LEAD_AFTER_VISIT.includes(phase(l))).length,
        props: ls.filter((l) => LEAD_AFTER_PROPOSAL.includes(phase(l))).length,
        wins: ls.filter((l) => phase(l) === '媒介受託').length,
    };
};

export const buyKpi = (buyLeads: Row[], mk: string): BuyKpi => {
    const ls = buyLeads.filter((l) => recvMonth(l) === mk);
    const after = (l: Row, ps: string[]) => ps.includes(str(l.phase));
    return {
        leads: ls.length,
        calls: countCallsIn(buyLeads, mk),
        connects: ls.filter((l) => str(l.connectDate) !== '' || after(l, ['通電済', '内見予約', '内見済', '購入申込', '成約'])).length,
        views: ls.filter((l) => str(l.viewDate) !== '' || after(l, ['内見済', '購入申込', '成約'])).length,
        offers: ls.filter((l) => after(l, ['購入申込', '成約'])).length,
        wins: ls.filter((l) => str(l.phase) === '成約').length,
    };
};

/** その月に受信した反響の反響費用（srcCost / portalCost の合計） */
export const leadCost = (rows: Row[], mk: string, costs: Record<string, number> | undefined, key: 'source' | 'portal'): number =>
    rows.filter((l) => recvMonth(l) === mk).reduce((a, l) => a + num(costs?.[str(l[key])]), 0);

// ---------------------------------------------------------------------------
// 商談案件の売上（dealFee / dealShares / dealSumByStaffMonth）
// ---------------------------------------------------------------------------

/** 確定とみなす商談のフェーズ（CONFIRMED） */
export const CONFIRMED = ['契約済', '契約予定', '決済完了'];

/** 標準の仲介手数料（stdFee）。800万円以下は30万円、それ超は 3%＋6万円 */
const stdFee = (price: number): number => (!price || price <= 0 ? 0 : price <= 8_000_000 ? 300_000 : Math.round(price * 0.03 + 60_000));

/** 仲介手数料（dealFee）。手入力のときはその値 */
const dealFee = (d: Row): number => (num(d.feeManual) ? num(d.fee) : stdFee(num(d.price)));
const dealReform = (d: Row): number => Math.max(0, Math.round(num(d.reformPrice)));
const dealReformGp = (d: Row): number => Math.round(num(d.reformGp));
/** 売上計上額＝仲介手数料＋リフォーム粗利（dealSales） */
const dealSales = (d: Row): number => dealFee(d) + dealReformGp(d);

type Share = { name: string; ratio: number; cnt: number };

/**
 * 主担当と共同担当の按分（dealShares）。
 * 共同担当なし・割合0・同一人物 → 主担当100%・1件／主担当なし → 共同担当100%・1件／両方 → 売上は割合、件数は0.5件ずつ
 */
const dealShares = (d: Row): Share[] => {
    const main = str(d.staff).trim();
    const sub = str(d.subStaff).trim();
    const r = Math.min(100, Math.max(0, num(d.subRatio)));
    if (!sub || r <= 0 || sub === main) return main ? [{ name: main, ratio: 1, cnt: 1 }] : [];
    if (!main) return [{ name: sub, ratio: 1, cnt: 1 }];
    return [{ name: main, ratio: (100 - r) / 100, cnt: 0.5 }, { name: sub, ratio: r / 100, cnt: 0.5 }];
};

export type StaffMonth = Record<string, Record<string, number>>;

/** 担当者 × 契約月の集計（dealSumByStaffMonth）。⚠️ 契約日のない案件・失注は数えない */
const sumByStaffMonth = (deals: Row[], pick: (d: Row) => number): StaffMonth => {
    const out: StaffMonth = {};
    for (const d of deals) {
        const cd = str(d.contractDate);
        if (!cd || str(d.phase) === '失注') continue;
        const mk = cd.slice(0, 7);
        const v = pick(d);
        for (const sh of dealShares(d)) {
            const row = (out[sh.name] = out[sh.name] ?? {});
            row[mk] = (row[mk] ?? 0) + Math.round(v * sh.ratio);
        }
    }
    return out;
};

export const salesByStaffMonth = (deals: Row[]) => sumByStaffMonth(deals, dealSales);
export const feeByStaffMonth = (deals: Row[]) => sumByStaffMonth(deals, dealFee);
export const reformByStaffMonth = (deals: Row[]) => sumByStaffMonth(deals, dealReform);
export const reformGpByStaffMonth = (deals: Row[]) => sumByStaffMonth(deals, dealReformGp);

/** 契約件数（dealCountByStaffMonth）。⚠️ 共同担当ありは0.5件ずつ */
export const dealCountByStaffMonth = (deals: Row[]): StaffMonth => {
    const out: StaffMonth = {};
    for (const d of deals) {
        const cd = str(d.contractDate);
        if (!cd || str(d.phase) === '失注') continue;
        const mk = cd.slice(0, 7);
        for (const sh of dealShares(d)) {
            const row = (out[sh.name] = out[sh.name] ?? {});
            row[mk] = (row[mk] ?? 0) + sh.cnt;
        }
    }
    return out;
};

/** 媒介獲得数（ledgerCountBy。契約日の月で数える）。⚠️ 台帳の担当は略称なので名前に直す */
export const ledgerCountByStaffMonth = (ledger: Row[], abbrToName: (ab: string) => string): StaffMonth => {
    const out: StaffMonth = {};
    for (const l of ledger) {
        const cd = str(l.contractDate);
        if (!cd) continue;
        const mk = cd.slice(0, 7);
        const k = abbrToName(str(l.staff));
        const row = (out[k] = out[k] ?? {});
        row[mk] = (row[mk] ?? 0) + 1;
    }
    return out;
};

export const sumRow = (row: Record<string, number> | undefined, mks: string[]): number =>
    mks.reduce((a, mk) => a + (row?.[mk] ?? 0), 0);

/** 0.5件の表示（fmtCnt） */
export const fmtCnt = (v: number): string => {
    const r = Math.round((Number(v) || 0) * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

// ---------------------------------------------------------------------------
// 架電実績（callStats）。⚠️ 実日付で本日・今週（月曜はじまり）・今月を数える。s/b は📞のみ
// ---------------------------------------------------------------------------

export type CallCell = { s: number; b: number; line: number; mail: number };
export type CallStats = { out: Record<string, { day: CallCell; week: CallCell; month: CallCell }>; today: string; wFrom: string };

const callCell = (): CallCell => ({ s: 0, b: 0, line: 0, mail: 0 });

const weekStart = (ds: string): string => {
    const d = new Date(`${ds}T00:00:00`);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return todayStr(d);
};

export const callStats = (leads: Row[], buyLeads: Row[], now = new Date()): CallStats => {
    const today = todayStr(now);
    const wFrom = weekStart(today);
    const mFrom = `${today.slice(0, 7)}-01`;
    const out: CallStats['out'] = {};
    const bump = (nm: string, bucket: 'day' | 'week' | 'month', kind: 's' | 'b', tp: 'call' | 'line' | 'mail') => {
        const o = (out[nm] = out[nm] ?? { day: callCell(), week: callCell(), month: callCell() });
        if (tp === 'call') o[bucket][kind]++;
        else o[bucket][tp]++;
    };
    const scan = (rows: Row[], kind: 's' | 'b') => {
        for (const l of rows) {
            const nm = str(l.staff) || '（未割当）';
            for (const c of callsOf(l)) {
                const d = callDay(c);
                const tp = callType(c);
                if (d === today) bump(nm, 'day', kind, tp);
                if (d >= wFrom && d <= today) bump(nm, 'week', kind, tp);
                if (d >= mFrom && d <= today) bump(nm, 'month', kind, tp);
            }
        }
    };
    scan(leads, 's');
    scan(buyLeads, 'b');
    return { out, today, wFrom };
};

export const emptyCallCell = callCell;

// ---------------------------------------------------------------------------
// 朝礼用アラート（直近14日の新規）
// ---------------------------------------------------------------------------

export const ALERT_DAYS = 14;

/** 商談リストへの登録日（dealRegDate）。旧データは接触日・契約日で代用 */
export const dealRegDate = (d: Row): string => str(d.createdAt || d.contactDate || d.contractDate).slice(0, 10);

export const alertWindow = (now = new Date()): { from: string; to: string } => {
    const to = todayStr(now);
    return { from: addDays(to, -(ALERT_DAYS - 1)), to };
};

export const inWindow = (ds: string, w: { from: string; to: string }): boolean => {
    const v = ds.slice(0, 10);
    return !!v && v >= w.from && v <= w.to;
};

/** 「本日」「3日前」 */
export const daysAgoLabel = (ds: string, today: string): string => {
    const n = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${ds.slice(0, 10)}T00:00:00`).getTime()) / 86_400_000);
    return n <= 0 ? '本日' : `${n}日前`;
};

// ---------------------------------------------------------------------------
// 表示
// ---------------------------------------------------------------------------

/** '¥1,234,567'（fmtYen）。値が無ければ ― */
export const fmtYen = (v: number | null | undefined): string =>
    v === null || v === undefined || Number.isNaN(v) ? '―' : `¥${Math.round(v).toLocaleString()}`;

/** 0 のときは ―（fmtYen0） */
export const fmtYen0 = (v: number): string => (v > 0 ? fmtYen(v) : '―');

/** '12.3%'（pct）。分母0などは ― */
export const pct = (v: number | null): string => (v === null || !Number.isFinite(v) ? '―' : `${(v * 100).toFixed(1)}%`);

```

## backend/scripts/sql/2026-10-28_brokerage_listings_reform.sql
```
-- =====================================================================
-- v2.2.222 brokerage_listings に、本番の不動産企画係アプリ（V14.11〜）で増えた商談の項目を足す
--
--   reformPrice … リフォーム受注額（円）。売上には含めない参考値
--   reformGp    … リフォーム粗利（円）。売上計上額＝仲介手数料＋リフォーム粗利
--   reformNote  … リフォームの内容・備考
--   createdAt   … 商談リストへの登録日（YYYY-MM-DD）。朝礼用アラートの「直近14日の新規商談」に使う
--
-- ⚠️ 実行環境: ① レンタルサーバー（phpMyAdmin）。⚠️ 何度流しても同じ（IF NOT EXISTS）
-- ⚠️ 既存の行は NULL のまま（今の DB の商談には入っていない。切り替えの日に本番アプリから取り込む）
-- =====================================================================
ALTER TABLE brokerage_listings
  ADD COLUMN IF NOT EXISTS `reformPrice` BIGINT NULL COMMENT 'リフォーム受注額（円・参考値）' AFTER `delivery`,
  ADD COLUMN IF NOT EXISTS `reformGp` BIGINT NULL COMMENT 'リフォーム粗利（円）' AFTER `reformPrice`,
  ADD COLUMN IF NOT EXISTS `reformNote` TEXT NULL COMMENT 'リフォームの内容・備考' AFTER `reformGp`,
  ADD COLUMN IF NOT EXISTS `createdAt` VARCHAR(32) NULL COMMENT '商談リストへの登録日（YYYY-MM-DD）' AFTER `reformNote`;

```

## backend/scripts/guide/articles/common/screen-240.md
```
---
title: チームサマリー（不動産企画係）
section: 画面の使い方
sort: 240
summary: 不動産企画係の、今日やること・歩留まり・年間予算の進捗・担当者別の月次KPI・架電実績・朝礼用アラート。
---
不動産企画係の画面の最初のページです。事業を選ぶ画面で「不動産企画係」を押すと開きます（[[不動産企画係の画面（入口と権限）]]）。

## 対象月
左上で月を選びます。選べるのは**今期の12か月**です（期首月は設定の値。いまは6月はじまり）。

## 上から順に
- **営業司令塔**：次回アクションの期日超過・本日・未設定、停滞、ホットな反響。「開く」でその反響を直せます
- **歩留まりファネル**：対象月に受信した売り反響・買い反響が、どこまで進んだか
- **年間予算進捗**：期首から対象月までの**売上計上額の累計**を、担当者の年間予算の合計で割ったもの。経過月数に比べて遅れていれば赤、先行していれば緑です
- **月次KPIサマリー**：担当者ごとの今月目標・今月見込の売上・達成率・契約件数・媒介獲得・未決の案件など
- **架電実績**：担当者ごとの本日・今週（月曜はじまり）・今月の架電の数（売り・買い）
- **一括査定KPI・買い反響KPI**：対象月に受信した反響の通電率・査定率・受託率・単価など
- **朝礼用アラート**：直近14日に商談リストへ登録された案件と、新しく獲得した媒介。14日を過ぎると自動で外れます

## 売上の数え方
- **売上計上額 ＝ 仲介手数料 ＋ リフォーム粗利**。リフォームの受注額は売上に入れず、参考として出します
- 商談案件の**契約日の月**で数えます。失注した案件は数えません
- 仲介手数料は、手数料を手で入れた案件はその金額、それ以外は売買価格から計算します（800万円以下は30万円、それより上は価格の3％＋6万円）
- 共同担当がいる案件は、売上は割合で分け、件数は0.5件ずつ数えます
- 契約率は、失注を除いた案件のうち、契約済・契約予定・決済完了の割合です

> 注意：担当者・年間予算・今月目標・媒介受託の目標は設定の値です。設定画面は次の版で追加します。それまでは、以前のアプリで入れた値がそのまま使われます。

> 要確認：切り替えまでは以前のアプリと並べて見比べてください。数字が違うときは、どの月・どの担当者かを開発に知らせてください。

```

# 変更（差分）
```diff
diff --git a/backend-express/src/features/realty/index.ts b/backend-express/src/features/realty/index.ts
index 3b8ab5fd..4a16bfb8 100644
--- a/backend-express/src/features/realty/index.ts
+++ b/backend-express/src/features/realty/index.ts
@@ -62,10 +62,15 @@ export const runPlannerLead = async (): Promise<Result> => {
   return ok({ lead, staff });
 };
 
-/** 移植元: plannerAction/planner_summary.php。⚠️ settings が無くても空のオブジェクトを返す */
+/**
+ * 移植元: plannerAction/planner_summary.php。⚠️ settings が無くても空のオブジェクトを返す。
+ * ⚠️ v2.2.222: チームサマリーの売上・媒介獲得・朝礼用アラートのため、商談案件（deals）と媒介台帳（ledger）も返す。
+ */
 export const runPlannerSummary = async (): Promise<Result> => {
-  const [lead, staff, state] = await Promise.all([
+  const [lead, deals, ledger, staff, state] = await Promise.all([
     query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind IN ('leads', 'buyLeads')"),
+    query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind = 'deals'"),
+    query<DynamicRow>("SELECT * FROM brokerage_listings WHERE kind = 'ledger'"),
     realtyStaffList(),
     query<DynamicRow>("SELECT `data` FROM app_state WHERE `key` = 'settings' LIMIT 1"),
   ]);
@@ -78,7 +83,7 @@ export const runPlannerSummary = async (): Promise<Result> => {
     settings = {};
   }
   // ⚠️ PHP の json_decode(…, true) は空のオブジェクトを [] にする。画面は Object として読むので {} で返す
-  return ok({ lead, staff, settings: Array.isArray(settings) && settings.length === 0 ? {} : settings });
+  return ok({ lead, deals, ledger, staff, settings: Array.isArray(settings) && settings.length === 0 ? {} : settings });
 };
 
 // ---------------------------------------------------------------------------
@@ -117,6 +122,8 @@ const ALLOWED_COLUMNS = [
   'expiry', 'expiryFix', 'reinsDate', 'priceRevDate', 'lastReportDate',
   'type', 'priority', 'dealId', 'dealNo', 'ledgerId', 'ledgerNo', 'extId',
   'subStaff', 'subRatio', 'coBroker', 'delivery',
+  // ⚠️ v2.2.222: 本番アプリ（V14.11〜）で増えた商談のリフォーム受注と、商談リストの登録日
+  'reformPrice', 'reformGp', 'reformNote', 'createdAt',
   'reason', 'timing', 'endReason', 'callDates', 'nextDate', 'nextNote',
   'receivedDate', 'connectDate', 'visitDate', 'viewDate', 'baikaiDate',
   'contactDate', 'contractDate', 'settleDate', 'followDate',
diff --git a/backend/src/handlers/brokerAction/broker_update.php b/backend/src/handlers/brokerAction/broker_update.php
index 34617cb1..25acca3f 100644
--- a/backend/src/handlers/brokerAction/broker_update.php
+++ b/backend/src/handlers/brokerAction/broker_update.php
@@ -26,6 +26,8 @@ $allowedColumns = [
     // 商談
     'type', 'priority', 'dealId', 'dealNo', 'ledgerId', 'ledgerNo', 'extId',
     'subStaff', 'subRatio', 'coBroker', 'delivery',
+    // ⚠️ v2.2.222: 本番アプリで増えた商談のリフォーム受注と登録日（② の ALLOWED_COLUMNS と同じ）
+    'reformPrice', 'reformGp', 'reformNote', 'createdAt',
     // リード（追客）
     'reason', 'timing', 'endReason', 'callDates', 'nextDate', 'nextNote',
     'receivedDate', 'connectDate', 'visitDate', 'viewDate', 'baikaiDate',
diff --git a/backend/src/handlers/plannerAction/planner_summary.php b/backend/src/handlers/plannerAction/planner_summary.php
index a0eb4a54..cbd59b2e 100644
--- a/backend/src/handlers/plannerAction/planner_summary.php
+++ b/backend/src/handlers/plannerAction/planner_summary.php
@@ -6,6 +6,14 @@ $stmt_lead = $pdo->prepare($sql_lead);
 $stmt_lead->execute();
 $response_lead = $stmt_lead->fetchAll(PDO::FETCH_ASSOC);
 
+// ⚠️ v2.2.222: チームサマリーの売上・媒介獲得・朝礼用アラートのため、商談案件と媒介台帳も返す（② の features/realty と同じ）
+$stmt_deals = $pdo->prepare("SELECT * FROM brokerage_listings WHERE kind = 'deals'");
+$stmt_deals->execute();
+$response_deals = $stmt_deals->fetchAll(PDO::FETCH_ASSOC);
+$stmt_ledger = $pdo->prepare("SELECT * FROM brokerage_listings WHERE kind = 'ledger'");
+$stmt_ledger->execute();
+$response_ledger = $stmt_ledger->fetchAll(PDO::FETCH_ASSOC);
+
 
 // スタッフ情報
 $sql_staff = "SELECT * FROM staff_list WHERE shop = '不動産企画係';";
@@ -31,6 +39,8 @@ if (!is_array($response_settings)) {
 
 $result = [
     "lead" => $response_lead,
+    "deals" => $response_deals,
+    "ledger" => $response_ledger,
     "staff" => $response_staff,
     "settings" => $response_settings
 ];
diff --git a/frontend/src/components/realty/common/LeadHeader.tsx b/frontend/src/components/realty/common/LeadHeader.tsx
index 6d9df83d..5b6c949e 100644
--- a/frontend/src/components/realty/common/LeadHeader.tsx
+++ b/frontend/src/components/realty/common/LeadHeader.tsx
@@ -19,6 +19,13 @@ type Props = {
         overdue: number;
         missing: number;
     };
+    /**
+     * 月の選択肢に「全期間」を出すか（既定 true）。
+     * ⚠️ v2.2.222: チームサマリーは年間予算の累計・月次KPIを月ごとに出すので「全期間」を出さない。
+     */
+    allowAllPeriod?: boolean;
+    /** 月の後ろに付ける文言（既定「 受信分」）。⚠️ チームサマリーは契約月の集計も含むので付けない */
+    monthSuffix?: string;
 };
 
 // ==========================================
@@ -95,6 +102,8 @@ const LeadHeader: React.FC<Props> = ({
     isAdding,
     headerLabel,
     nextActionAlert,
+    allowAllPeriod = true,
+    monthSuffix = ' 受信分',
 }) => {
     const hasAlert = !!nextActionAlert && (nextActionAlert.overdue > 0 || nextActionAlert.missing > 0);
     return (
@@ -113,10 +122,10 @@ const LeadHeader: React.FC<Props> = ({
                         value={selectedMonth}
                         onChange={(e) => setSelectedMonth(e.target.value)}
                     >
-                        <option value="">全期間</option>
+                        {allowAllPeriod && <option value="">全期間</option>}
                         {availableMonths.map(m => {
                             const [y, mon] = m.split('-');
-                            return <option key={m} value={m}>{`${y}年${Number(mon)}月 受信分`}</option>;
+                            return <option key={m} value={m}>{`${y}年${Number(mon)}月${monthSuffix}`}</option>;
                         })}
                     </select>
                 </div>
diff --git a/frontend/src/components/realty/summary/Summary.tsx b/frontend/src/components/realty/summary/Summary.tsx
index c3283c28..cf71b095 100644
--- a/frontend/src/components/realty/summary/Summary.tsx
+++ b/frontend/src/components/realty/summary/Summary.tsx
@@ -6,7 +6,14 @@ import { removeSpaces, formatDate } from './summaryUtiles'; // パスは環境
 import AuthContext from '../../../context/AuthContext';
 // 💡 追加: タスク一覧の「開く」から顧客情報を編集する
 import LeadEdit, { LeadCategory } from '../common/LeadEdit';
-import { saveBrokerageRecord, recordFieldChanges } from '../common/leadUtiles';
+import { saveBrokerageRecord, recordFieldChanges, isSoftDeleted } from '../common/leadUtiles';
+// ⚠️ v2.2.222: 年間予算進捗・月次KPI・架電実績・朝礼用アラートは本番アプリの集計をそのまま写した kpi.ts で出す
+import {
+    ALERT_DAYS, CONFIRMED, alertWindow, callStats, daysAgoLabel, dealCountByStaffMonth, dealRegDate,
+    emptyCallCell, feeByStaffMonth, fiscalMonths, fmtCnt, fmtYen, fmtYen0, inWindow, ledgerCountByStaffMonth,
+    monthLabel, pct, reformByStaffMonth, reformGpByStaffMonth, salesByStaffMonth, sumRow, todayStr,
+} from './kpi';
+import type { Row, Settings } from './kpi';
 
 // ==========================================
 // 💡 型定義 (推論ベース)
@@ -77,12 +84,8 @@ const isToday = (nextDate: string | null) => {
 };
 const isNotNext = (nextDate: string | null) => !nextDate || nextDate.startsWith('0000');
 
-// 💡 アプリ全体設定（planner_summary.php が app_state.settings をそのまま返す）
-type AppSettings = {
-    srcCosts?: Record<string, number>;      // 売り反響元ごとの単価（円/件）
-    portalCosts?: Record<string, number>;   // 買いポータルごとの単価（円/件）
-    staff?: { name?: string; baikaiTarget?: number }[];
-};
+// 💡 アプリ全体設定（planner_summary が app_state.settings をそのまま返す）。⚠️ v2.2.222 から kpi.ts の Settings
+type AppSettings = Settings;
 
 // 架電履歴。DBには JSON 文字列で入っているので配列に戻してから数える
 type CallEntry = { date?: string | null; type?: string | null; staff?: string | null };
@@ -183,11 +186,14 @@ const Summary = () => {
 
     const [leads, setLeads] = useState<SummaryLead[]>([]); // 売り反響
     const [buyLeads, setBuyLeads] = useState<SummaryLead[]>([]); // 買い反響
-    const [deals, setDeals] = useState<any[]>([]); // 商談案件 (今回はanyで仮置き)
+    // ⚠️ v2.2.222: 商談案件と媒介台帳（planner:summary が返すようにした）。⚠️ 削除済み（show_dashboard=0）は除いて持つ
+    const [deals, setDeals] = useState<Row[]>([]);
+    const [ledger, setLedger] = useState<Row[]>([]);
 
     const [staffList, setStaffList] = useState<string[]>([]);
     const [settings, setSettings] = useState<AppSettings>({});
-    const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');
+    // ⚠️ v2.2.222: 既定は今月（以前は 2026-07 で固定だった）
+    const [selectedMonth, setSelectedMonth] = useState<string>(() => todayStr().slice(0, 7));
 
     // 💡 顧客情報編集モーダル（LeadSell / LeadBuy と同じ LeadEdit を共用する）
     const [isEditModalOpen, setIsEditModalOpen] = useState(false);
@@ -210,13 +216,13 @@ const Summary = () => {
                     // 歩留まりファネルの「買い」が全て0・「売り」が買いを混ぜて数えていた。
                     // ここで kind で振り分ける。
                     if (response.data.lead) {
-                        const allLeads: SummaryLead[] = response.data.lead;
+                        // ⚠️ v2.2.222: 削除済み（show_dashboard=0）は数えない（売り反響・買い反響の画面と同じ）
+                        const allLeads: SummaryLead[] = (response.data.lead as SummaryLead[]).filter(l => !isSoftDeleted(l as unknown as Row));
                         setLeads(allLeads.filter(l => l.kind !== 'buyLeads'));
                         setBuyLeads(allLeads.filter(l => l.kind === 'buyLeads'));
                     }
-                    // 将来 API が分けて返すようになった場合はそちらを優先する
-                    if (response.data.buyLeads) setBuyLeads(response.data.buyLeads);
-                    if (response.data.deals) setDeals(response.data.deals);
+                    setDeals(((response.data.deals ?? []) as Row[]).filter(d => !isSoftDeleted(d)));
+                    setLedger(((response.data.ledger ?? []) as Row[]).filter(l => !isSoftDeleted(l)));
                     if (response.data.staff) {
                         setStaffList(response.data.staff.filter((st: any) => st.period === String(thisYear)).map((st: any) => st.name));
                     }
@@ -394,34 +400,106 @@ const Summary = () => {
     // ==========================================
     // 💡 4. ヘッダー用データ
     // ==========================================
-    // 全てのリードから受信月のリストを抽出
-    const availableMonths = useMemo(() => {
-        const allLeads = [...leads, ...buyLeads];
-        const months = allLeads.map(l => {
-            if (!l.receivedDate || l.receivedDate.startsWith('0000')) return '';
-            return l.receivedDate.slice(0, 7); // "YYYY-MM"
-        }).filter(Boolean);
-        return Array.from(new Set(months)).sort((a, b) => b.localeCompare(a));
-    }, [leads, buyLeads]);
+    /**
+     * 対象月の選択肢。⚠️ v2.2.222: 本番アプリと同じく「今期の12か月」（設定の期首月から）。
+     *   年間予算の進捗は期首から対象月までの累計なので、期をまたぐ月は選ばせない。
+     */
+    const fyMonths = useMemo(() => fiscalMonths(settings.fiscalStart), [settings.fiscalStart]);
+    const availableMonths = useMemo(() => [...fyMonths].reverse(), [fyMonths]);
+    // 期首月が届いたら、今期に無い月（初期値の今月が期外のときなど）を期首月へ寄せる
+    useEffect(() => {
+        if (settings.fiscalStart && !fyMonths.includes(selectedMonth)) setSelectedMonth(fyMonths[0]);
+    }, [fyMonths, settings.fiscalStart, selectedMonth]);
 
     const headerLabel = { title: 'チームサマリー', describe: '本日のタスク、追客予定、月次KPI、架電実績' };
 
-    // 📊 月次KPIサマリーデータ
-    const kpiSummaryData = useMemo(() => [
-        { staff: '時任聡一朗', target: 3000000, expected: 3240000, achieve: 108.0, dealsTotal: 13, contractMonth: 6, contractRate: 84.6, baikaiMonth: 6, pending: 2, annualProg: 20.8 },
-        { staff: '宮城智一', target: 2500000, expected: 393000, achieve: 15.7, dealsTotal: 5, contractMonth: 1, contractRate: 80.0, baikaiMonth: 1, pending: 1, annualProg: 11.0 },
-        { staff: '永田倫也', target: 2500000, expected: 0, achieve: 0.0, dealsTotal: 7, contractMonth: 0, contractRate: 57.1, baikaiMonth: 1, pending: 3, annualProg: 5.0 },
-        { staff: '岡崎真夕', target: 1500000, expected: 1980000, achieve: 132.0, dealsTotal: 7, contractMonth: 3, contractRate: 85.7, baikaiMonth: 1, pending: 1, annualProg: 11.0 },
-    ], []);
-
-    // 📞 架電実績データ
-    const callStatsData = useMemo(() => [
-        { staff: '時任聡一朗', todayS: 2, todayB: 0, weekS: 4, weekB: 0, monthS: 9, monthB: 6 },
-        { staff: '宮城智一', todayS: 0, todayB: 0, weekS: 0, weekB: 0, monthS: 7, monthB: 0 },
-        { staff: '永田倫也', todayS: 0, todayB: 0, weekS: 0, weekB: 0, monthS: 5, monthB: 6 },
-        { staff: '岡崎真夕', todayS: 0, todayB: 0, weekS: 0, weekB: 0, monthS: 4, monthB: 5 },
-        { staff: '（未割当）', todayS: 7, todayB: 0, weekS: 7, weekB: 0, monthS: 26, monthB: 0 },
-    ], []);
+    /**
+     * 📊 年間予算進捗・月次KPIサマリー（v2.2.222。本番アプリの renderDash と同じ集計）。
+     *   売上計上額＝仲介手数料＋リフォーム粗利。商談案件の契約日ベース・共同担当は按分。
+     *   担当者と目標・予算は設定（app_state.settings.staff）。
+     */
+    const kpi = useMemo(() => {
+        const tm = selectedMonth;
+        const staffSettings = (settings.staff ?? []).filter(st => st.name);
+        const names = staffSettings.map(st => String(st.name));
+        const cumMks = fyMonths.includes(tm) ? fyMonths.slice(0, fyMonths.indexOf(tm) + 1) : [tm];
+
+        const salesAll = salesByStaffMonth(deals);
+        const feeAll = feeByStaffMonth(deals);
+        const rfAll = reformByStaffMonth(deals);
+        const rgAll = reformGpByStaffMonth(deals);
+        const cntAll = dealCountByStaffMonth(deals);
+        // ⚠️ 媒介台帳の担当は略称で入っている
+        const abbrToName = (ab: string) => staffSettings.find(st => st.abbr === ab)?.name ?? ab;
+        const bCnt = ledgerCountByStaffMonth(ledger, abbrToName);
+
+        const totalBudget = staffSettings.reduce((a, st) => a + (Number(st.budget) || 0), 0);
+        const sumCum = (all: Record<string, Record<string, number>>) => names.reduce((a, n) => a + sumRow(all[n], cumMks), 0);
+        const cum = sumCum(salesAll);
+        const prog = totalBudget ? cum / totalBudget : 0;
+        const elapsed = cumMks.length;
+
+        const rows = staffSettings.map(st => {
+            const n = String(st.name);
+            const dAll = deals.filter(d => (d.staff === n || d.subStaff === n) && d.phase !== '失注');
+            const dCon = dAll.filter(d => CONFIRMED.includes(String(d.phase ?? '')));
+            return {
+                name: n,
+                goal: Number(st.monthlyGoal) || 0,
+                budget: Number(st.budget) || 0,
+                sales: salesAll[n]?.[tm] ?? 0,
+                fee: feeAll[n]?.[tm] ?? 0,
+                reformGp: rgAll[n]?.[tm] ?? 0,
+                reform: rfAll[n]?.[tm] ?? 0,
+                deals: dAll.length,
+                confirmed: dCon.length,
+                contracts: cntAll[n]?.[tm] ?? 0,
+                baikai: bCnt[n]?.[tm] ?? 0,
+                pending: dAll.length - dCon.length,
+                cumSales: sumRow(salesAll[n], cumMks),
+            };
+        });
+        const total = rows.reduce((t, r) => ({
+            goal: t.goal + r.goal, sales: t.sales + r.sales, fee: t.fee + r.fee, reformGp: t.reformGp + r.reformGp,
+            reform: t.reform + r.reform, deals: t.deals + r.deals, contracts: t.contracts + r.contracts,
+            baikai: t.baikai + r.baikai, pending: t.pending + r.pending,
+        }), { goal: 0, sales: 0, fee: 0, reformGp: 0, reform: 0, deals: 0, contracts: 0, baikai: 0, pending: 0 });
+
+        return {
+            rows, total, totalBudget, cum, prog, elapsed, paceGap: prog - elapsed / 12,
+            cumFee: sumCum(feeAll), cumRf: sumCum(rfAll), cumRg: sumCum(rgAll),
+            fromMonth: cumMks[0], hasStaff: staffSettings.length > 0,
+        };
+    }, [deals, ledger, settings.staff, selectedMonth, fyMonths]);
+
+    /** 📞 架電実績（v2.2.222。本番アプリの callStats と同じ。実日付で本日・今週・今月） */
+    const calls = useMemo(() => {
+        const cs = callStats(leads as unknown as Row[], buyLeads as unknown as Row[]);
+        const names = (settings.staff ?? []).map(st => st.name).filter((n): n is string => !!n);
+        const all = [...names, ...Object.keys(cs.out).filter(n => !names.includes(n))];
+        const team = { day: emptyCallCell(), week: emptyCallCell(), month: emptyCallCell() };
+        const rows = all.map(n => {
+            const o = cs.out[n] ?? { day: emptyCallCell(), week: emptyCallCell(), month: emptyCallCell() };
+            (['day', 'week', 'month'] as const).forEach(b => {
+                team[b].s += o[b].s; team[b].b += o[b].b; team[b].line += o[b].line; team[b].mail += o[b].mail;
+            });
+            return { name: n, ...o };
+        });
+        return { rows, team, today: cs.today, wFrom: cs.wFrom };
+    }, [leads, buyLeads, settings.staff]);
+
+    /** 🆕 朝礼用アラート（v2.2.222）。直近14日に商談リストへ登録した案件・新規の媒介獲得 */
+    const alerts = useMemo(() => {
+        const w = alertWindow();
+        const staffSettings = settings.staff ?? [];
+        const abbrToName = (ab: string) => staffSettings.find(st => st.abbr === ab)?.name ?? ab;
+        const newDeals = deals.filter(d => inWindow(dealRegDate(d), w))
+            .sort((a, b) => dealRegDate(b).localeCompare(dealRegDate(a)));
+        const newLedger = ledger.filter(l => inWindow(String(l.contractDate ?? ''), w))
+            .sort((a, b) => String(b.contractDate).localeCompare(String(a.contractDate)));
+        return { w, newDeals, newLedger, abbrToName };
+    }, [deals, ledger, settings.staff]);
+    const [showAlerts, setShowAlerts] = useState(true);
 
     // ==========================================
     // 💡 6. 反響KPIサマリー（元HTML版 V12 の leadKpi / buyKpi と同じ定義）
@@ -489,6 +567,8 @@ const Summary = () => {
                 handleAddClick={() => { }}
                 isAdding={false}
                 headerLabel={headerLabel}
+                allowAllPeriod={false}
+                monthSuffix=""
             />
 
             {!isLoading && (
@@ -691,26 +771,43 @@ const Summary = () => {
                     </div>
 
                     {/* ==========================================
-                        🎯 3. 年間予算進捗 (今回はモック値)
+                        🎯 3. 年間予算進捗（v2.2.222 から実データ。期首〜対象月の売上計上額の累計 ÷ 担当者の年間予算の合計）
                     ========================================== */}
                     <div style={s.card}>
                         <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
-                            <strong style={{ fontSize: '16px', color: '#343a40' }}>🎯 年間予算進捗 12.5%</strong>
-                            <span style={{ fontSize: '11px', color: '#6c757d' }}>累計 ¥14,262,000 ／ 予算 ¥114,000,000</span>
-                            <span style={s.badge('#dc3545')}>⚠ ▼4.2% 遅れ（経過 2/12ヶ月）</span>
+                            <strong style={{ fontSize: '16px', color: '#343a40' }}>🎯 年間予算進捗 {pct(kpi.totalBudget ? kpi.prog : null)}</strong>
+                            <span style={{ fontSize: '11px', color: '#6c757d' }}>累計 {fmtYen(kpi.cum)} ／ 予算 {fmtYen(kpi.totalBudget)}</span>
+                            {kpi.totalBudget > 0 && (
+                                <span style={s.badge(kpi.paceGap < 0 ? '#dc3545' : '#198754')}>
+                                    {kpi.paceGap < 0
+                                        ? `⚠ ▼${(Math.abs(kpi.paceGap) * 100).toFixed(1)}% 遅れ`
+                                        : `▲${(kpi.paceGap * 100).toFixed(1)}% 先行`}（経過 {kpi.elapsed}/12ヶ月）
+                                </span>
+                            )}
                         </div>
                         <div style={{ height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', marginTop: '12px', overflow: 'hidden' }}>
-                            <div style={{ width: '12.5%', height: '100%', backgroundColor: '#198754' }}></div>
+                            <div style={{ width: `${Math.min(100, kpi.prog * 100)}%`, height: '100%', backgroundColor: kpi.paceGap < 0 ? '#dc3545' : '#198754' }}></div>
+                        </div>
+                        <div style={{ fontSize: '11px', color: '#495057', marginTop: '8px' }}>
+                            内訳（{monthLabel(kpi.fromMonth)}〜{monthLabel(selectedMonth)}累計）：仲介手数料 <b>{fmtYen(kpi.cumFee)}</b> ＋ リフォーム粗利 <b>{fmtYen(kpi.cumRg)}</b> ＝ 売上計上額 <b>{fmtYen(kpi.cum)}</b>
+                            <span style={{ color: '#6c757d', marginLeft: '6px' }}>
+                                ※リフォームは受注額ではなく粗利を売上に計上します（受注額 {fmtYen0(kpi.cumRf)}・粗利率 {kpi.cumRf ? pct(kpi.cumRg / kpi.cumRf) : '―'} は参考値）
+                            </span>
                         </div>
+                        {!kpi.hasStaff && (
+                            <div style={{ fontSize: '11px', color: '#dc3545', marginTop: '6px' }}>担当者と予算が設定されていません（設定画面は次の版で追加します）。</div>
+                        )}
                     </div>
 
                     {/* ==========================================
-                        📊 4. 月次KPIサマリー
+                        📊 4. 月次KPIサマリー（v2.2.222 から実データ。本番アプリと同じ列）
                     ========================================== */}
                     <div style={s.card}>
                         <div style={s.cardTitle}>
-                            月次KPIサマリー（{selectedMonth.replace('-', '年')}月）
-                            <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>緑背景＝自動集計。今月目標は設定で編集できます。</span>
+                            月次KPIサマリー（{monthLabel(selectedMonth)}）
+                            <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>
+                                灰色＝自動集計。<b>売上計上額＝仲介手数料＋リフォーム粗利</b>（リフォーム受注額は参考値）。商談案件の契約日ベース・共同担当は按分。
+                            </span>
                         </div>
                         <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                             <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
@@ -720,6 +817,9 @@ const Summary = () => {
                                         <th style={s.th}>今月目標<br/>売上(円)</th>
                                         <th style={s.th}>今月見込<br/>売上(円)</th>
                                         <th style={s.th}>達成率</th>
+                                        <th style={s.th}>うち仲介<br/>手数料(円)</th>
+                                        <th style={s.th}>うちリフォーム<br/>粗利(円)</th>
+                                        <th style={s.th}>リフォーム<br/>受注額(円)<br/><span style={{ fontWeight: 'normal' }}>※参考</span></th>
                                         <th style={s.th}>案件数<br/>(累計)</th>
                                         <th style={s.th}>今月<br/>契約件数</th>
                                         <th style={s.th}>契約率</th>
@@ -729,35 +829,41 @@ const Summary = () => {
                                     </tr>
                                 </thead>
                                 <tbody>
-                                    {kpiSummaryData.map((k, idx) => (
-                                        <tr key={idx} style={{ backgroundColor: '#fff' }}>
-                                            <td style={{ ...s.td, textAlign: 'left', fontWeight: 'bold', color: '#343a40' }}>{k.staff}</td>
-                                            {/* warn-cell に相当する部分を薄いオレンジ背景で表現 */}
-                                            <td style={{ ...s.td, backgroundColor: '#fff8f1', color: '#fd7e14', fontWeight: 'bold' }}>{formatYen(k.target)}</td>
-                                            {/* auto に相当する部分を薄いグレー背景で表現 */}
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>{formatYen(k.expected)}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.achieve.toFixed(1)}%</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.dealsTotal}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.contractMonth}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.contractRate.toFixed(1)}%</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.baikaiMonth}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.pending}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{k.annualProg.toFixed(1)}%</td>
+                                    {kpi.rows.length === 0 && (
+                                        <tr><td colSpan={13} style={{ ...s.td, textAlign: 'center', color: '#6c757d' }}>担当者が設定されていません</td></tr>
+                                    )}
+                                    {kpi.rows.map(r => (
+                                        <tr key={r.name} style={{ backgroundColor: '#fff' }}>
+                                            <td style={{ ...s.td, textAlign: 'left', fontWeight: 'bold', color: '#343a40' }}>{r.name}</td>
+                                            {/* 目標は設定で入れる値（薄いオレンジ）。それ以外は自動集計（薄い灰色） */}
+                                            <td style={{ ...s.td, backgroundColor: '#fff8f1', color: '#fd7e14', fontWeight: 'bold' }}>{fmtYen(r.goal)}</td>
+                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa', fontWeight: 'bold' }}>{fmtYen(r.sales)}</td>
+                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{r.goal ? pct(r.sales / r.goal) : '―'}</td>
+                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{fmtYen(r.fee)}</td>
+                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{fmtYen0(r.reformGp)}</td>
+                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{fmtYen0(r.reform)}</td>
+                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{r.deals}</td>
+                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{fmtCnt(r.contracts)}</td>
+                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{r.deals ? pct(r.confirmed / r.deals) : '―'}</td>
+                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{r.baikai}</td>
+                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{r.pending}</td>
+                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{r.budget ? pct(r.cumSales / r.budget) : '―'}</td>
                                         </tr>
                                     ))}
                                     <tr style={{ backgroundColor: '#f1f3f5' }}>
                                         <td style={{ ...s.td, textAlign: 'left', fontWeight: 'bold' }}>チーム合計</td>
-                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{formatYen(kpiSummaryData.reduce((acc, cur) => acc + cur.target, 0))}</td>
-                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{formatYen(kpiSummaryData.reduce((acc, cur) => acc + cur.expected, 0))}</td>
-                                        <td style={{ ...s.td, fontWeight: 'bold' }}>
-                                            {calcRate(kpiSummaryData.reduce((acc, cur) => acc + cur.expected, 0), kpiSummaryData.reduce((acc, cur) => acc + cur.target, 0))}
-                                        </td>
-                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpiSummaryData.reduce((acc, cur) => acc + cur.dealsTotal, 0)}</td>
-                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpiSummaryData.reduce((acc, cur) => acc + cur.contractMonth, 0)}</td>
+                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{fmtYen(kpi.total.goal)}</td>
+                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{fmtYen(kpi.total.sales)}</td>
+                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpi.total.goal ? pct(kpi.total.sales / kpi.total.goal) : '―'}</td>
+                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{fmtYen(kpi.total.fee)}</td>
+                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{fmtYen0(kpi.total.reformGp)}</td>
+                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{fmtYen0(kpi.total.reform)}</td>
+                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpi.total.deals}</td>
+                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{fmtCnt(kpi.total.contracts)}</td>
                                         <td style={{ ...s.td, fontWeight: 'bold' }}>―</td>
-                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpiSummaryData.reduce((acc, cur) => acc + cur.baikaiMonth, 0)}</td>
-                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpiSummaryData.reduce((acc, cur) => acc + cur.pending, 0)}</td>
-                                        <td style={{ ...s.td, fontWeight: 'bold' }}>12.5%</td>
+                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpi.total.baikai}</td>
+                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpi.total.pending}</td>
+                                        <td style={{ ...s.td, fontWeight: 'bold' }}>{kpi.totalBudget ? pct(kpi.cum / kpi.totalBudget) : '―'}</td>
                                     </tr>
                                 </tbody>
                             </table>
@@ -771,7 +877,7 @@ const Summary = () => {
                         <div style={s.cardTitle}>
                             架電実績（担当者別・日次／週次／月次）
                             <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>
-                                数値は📞架電のみ。本日={formatDate(new Date())}
+                                📨売り反響・🏠買い反響の記録から自動集計。数値は📞架電のみ（💬LINE・✉️メールは表の下）。本日={formatDate(calls.today)}／今週={formatDate(calls.wFrom)}〜
                             </span>
                         </div>
                         <div style={{ overflowX: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
@@ -785,37 +891,36 @@ const Summary = () => {
                                     </tr>
                                 </thead>
                                 <tbody>
-                                    {callStatsData.map((c, idx) => (
-                                        <tr key={idx} style={{ backgroundColor: '#fff' }}>
-                                            <td style={{ ...s.td, textAlign: 'left' }}>{c.staff}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c.todayS}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c.todayB}</td>
-                                            <td style={{ ...s.td, fontWeight: 'bold', color: '#0d6efd' }}>{c.todayS + c.todayB}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c.weekS}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c.weekB}</td>
-                                            <td style={{ ...s.td, fontWeight: 'bold', color: '#0d6efd' }}>{c.weekS + c.weekB}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c.monthS}</td>
-                                            <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c.monthB}</td>
-                                            <td style={{ ...s.td, fontWeight: 'bold', color: '#0d6efd' }}>{c.monthS + c.monthB}</td>
+                                    {calls.rows.length === 0 && (
+                                        <tr><td colSpan={10} style={{ ...s.td, textAlign: 'center', color: '#6c757d' }}>架電の記録がありません</td></tr>
+                                    )}
+                                    {calls.rows.map(c => (
+                                        <tr key={c.name} style={{ backgroundColor: '#fff' }}>
+                                            <td style={{ ...s.td, textAlign: 'left' }}>{c.name}</td>
+                                            {(['day', 'week', 'month'] as const).map(b => (
+                                                <React.Fragment key={b}>
+                                                    <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c[b].s}</td>
+                                                    <td style={{ ...s.td, backgroundColor: '#f8f9fa' }}>{c[b].b}</td>
+                                                    <td style={{ ...s.td, fontWeight: 'bold', color: '#0d6efd' }}>{c[b].s + c[b].b}</td>
+                                                </React.Fragment>
+                                            ))}
                                         </tr>
                                     ))}
                                     <tr style={{ backgroundColor: '#f1f3f5' }}>
                                         <td style={{ ...s.td, textAlign: 'left', fontWeight: 'bold' }}>チーム合計</td>
-                                        <td style={s.td}>{callStatsData.reduce((a, c) => a + c.todayS, 0)}</td>
-                                        <td style={s.td}>{callStatsData.reduce((a, c) => a + c.todayB, 0)}</td>
-                                        <td style={{...s.td, fontWeight: 'bold', color: '#0d6efd'}}>{callStatsData.reduce((a, c) => a + c.todayS + c.todayB, 0)}</td>
-                                        <td style={s.td}>{callStatsData.reduce((a, c) => a + c.weekS, 0)}</td>
-                                        <td style={s.td}>{callStatsData.reduce((a, c) => a + c.weekB, 0)}</td>
-                                        <td style={{...s.td, fontWeight: 'bold', color: '#0d6efd'}}>{callStatsData.reduce((a, c) => a + c.weekS + c.weekB, 0)}</td>
-                                        <td style={s.td}>{callStatsData.reduce((a, c) => a + c.monthS, 0)}</td>
-                                        <td style={s.td}>{callStatsData.reduce((a, c) => a + c.monthB, 0)}</td>
-                                        <td style={{...s.td, fontWeight: 'bold', color: '#0d6efd'}}>{callStatsData.reduce((a, c) => a + c.monthS + c.monthB, 0)}</td>
+                                        {(['day', 'week', 'month'] as const).map(b => (
+                                            <React.Fragment key={b}>
+                                                <td style={s.td}>{calls.team[b].s}</td>
+                                                <td style={s.td}>{calls.team[b].b}</td>
+                                                <td style={{ ...s.td, fontWeight: 'bold', color: '#0d6efd' }}>{calls.team[b].s + calls.team[b].b}</td>
+                                            </React.Fragment>
+                                        ))}
                                     </tr>
                                 </tbody>
                             </table>
                         </div>
                         <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '8px' }}>
-                            チーム内訳（架電以外）：本日 💬1件・✉️0件 ／ 今週 💬1件・✉️0件 ／ 今月 💬2件・✉️6件
+                            チーム内訳（架電以外）：本日 💬{calls.team.day.line}件・✉️{calls.team.day.mail}件 ／ 今週 💬{calls.team.week.line}件・✉️{calls.team.week.mail}件 ／ 今月 💬{calls.team.month.line}件・✉️{calls.team.month.mail}件
                         </div>
                     </div>
 
@@ -890,6 +995,72 @@ const Summary = () => {
                         </div>
                     </div>
 
+                    {/* ==========================================
+                        🆕 7. 朝礼用アラート（v2.2.222。本番アプリと同じく直近14日の新規だけ。14日を過ぎると自動で外れる）
+                    ========================================== */}
+                    <div style={s.card}>
+                        <div style={{ ...s.cardTitle, display: 'flex', alignItems: 'center' }}>
+                            朝礼用アラート
+                            <span style={{ fontSize: '10px', color: '#6c757d', fontWeight: 'normal', marginLeft: '8px' }}>
+                                直近{ALERT_DAYS}日間（{formatDate(alerts.w.from)}〜{formatDate(alerts.w.to)}）の新規のみ表示
+                            </span>
+                            <button type="button" onClick={() => setShowAlerts(v => !v)}
+                                style={{ marginLeft: 'auto', fontSize: '10px', padding: '2px 8px', border: '1px solid #ced4da', backgroundColor: '#fff', borderRadius: '4px', cursor: 'pointer' }}>
+                                {showAlerts ? '▲ 非表示にする' : '▼ 表示する'}
+                            </button>
+                        </div>
+                        <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '4px 0' }}>
+                            🆕 直近{ALERT_DAYS}日の新規商談案件 <span style={s.badge(alerts.newDeals.length ? '#22405c' : '#adb5bd')}>{alerts.newDeals.length}件</span>
+                        </div>
+                        {showAlerts && (alerts.newDeals.length === 0
+                            ? <div style={{ fontSize: '11px', color: '#6c757d', marginBottom: '8px' }}>該当なし（直近{ALERT_DAYS}日に登録された商談案件はありません）</div>
+                            : (
+                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
+                                    <thead><tr>{['登録日', '担当', '種別', '物件名', '顧客名', '価格', '進捗'].map(h => <th key={h} style={{ ...s.th, textAlign: 'left' }}>{h}</th>)}</tr></thead>
+                                    <tbody>
+                                        {alerts.newDeals.map(d => (
+                                            <tr key={String(d.id)}>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{formatDate(dealRegDate(d))}<span style={{ fontSize: '10px', color: '#6c757d' }}>（{daysAgoLabel(dealRegDate(d), alerts.w.to)}）</span></td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{d.staff ? String(d.staff) : <span style={s.badge('#dc3545')}>未割当</span>}</td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(d.type ?? '')}</td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(d.property ?? '')}</td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(d.customer ?? '')}</td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{d.price ? fmtYen(Number(d.price)) : '―'}</td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(d.phase ?? '')}</td>
+                                            </tr>
+                                        ))}
+                                    </tbody>
+                                </table>
+                            ))}
+                        <div style={{ fontSize: '12px', fontWeight: 'bold', margin: '4px 0' }}>
+                            📝 直近{ALERT_DAYS}日の新規媒介獲得 <span style={s.badge(alerts.newLedger.length ? '#22405c' : '#adb5bd')}>{alerts.newLedger.length}件</span>
+                        </div>
+                        {showAlerts && (alerts.newLedger.length === 0
+                            ? <div style={{ fontSize: '11px', color: '#6c757d' }}>該当なし（直近{ALERT_DAYS}日に獲得した媒介はありません）</div>
+                            : (
+                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
+                                    <thead><tr>{['契約日', '担当', '反響元', '売主名', '所在地', '媒介種別', '売出価格'].map(h => <th key={h} style={{ ...s.th, textAlign: 'left' }}>{h}</th>)}</tr></thead>
+                                    <tbody>
+                                        {alerts.newLedger.map(l => (
+                                            <tr key={String(l.id)}>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{formatDate(String(l.contractDate ?? ''))}<span style={{ fontSize: '10px', color: '#6c757d' }}>（{daysAgoLabel(String(l.contractDate ?? ''), alerts.w.to)}）</span></td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{alerts.abbrToName(String(l.staff ?? ''))}</td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(l.source ?? '')}</td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(l.seller ?? '')}</td>
+                                                {/* ⚠️ 本番アプリと同じく addr2 の URL は表示しない */}
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{`${String(l.addr1 ?? '')}${l.addr2 ? ' ' + String(l.addr2).replace(/https?:\/\/\S*/g, '').trim() : ''}`}</td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{String(l.baikaiType ?? '')}</td>
+                                                <td style={{ ...s.td, textAlign: 'left' }}>{l.price ? fmtYen(Number(l.price)) : '―'}</td>
+                                            </tr>
+                                        ))}
+                                    </tbody>
+                                </table>
+                            ))}
+                        <div style={{ fontSize: '10px', color: '#6c757d', marginTop: '8px' }}>
+                            ※ 買取再販の期限アラートと営業司令塔の詳細は、買取再販・商談案件の移植のときに足します。
+                        </div>
+                    </div>
+
                 </div>
             )}
 
diff --git a/frontend/src/utils/version.ts b/frontend/src/utils/version.ts
index 5932af59..ce7a3c47 100644
--- a/frontend/src/utils/version.ts
+++ b/frontend/src/utils/version.ts
@@ -1 +1 @@
-export const newVersion = '2.2.221';
+export const newVersion = '2.2.222';
```
