import {
  runAmbassadorInsert,
  runAmbassadorList,
  runAmbassadorUpdate,
  runInquiryAmbassadorList,
  runInquiryAmbassadorSync,
  runInquiryAmbassadorUpdate,
} from '../features/ambassador';
import { runAmbassadorInquiry } from '../features/ambassador/inquiry';
import { runAmbassadorMaster } from '../features/ambassador/master';
import {
  runInquiryIntroductoryList,
  runInquiryIntroductorySync,
  runInquiryIntroductoryUpdate,
} from '../features/introductory';
import { runEventReservation } from '../features/event/reservation';
import { runEventCheckin } from '../features/event/checkin';
import type { CallStatusCategory } from '../features/callStatusList';
import { runCallStatusList } from '../features/callStatusList';
import { runFamilyInfoShow, runFamilyInfoUpdate } from '../features/familyInfo';
import { runEventSummary, runEventSummaryDetail } from '../features/eventSummary';
import {
  runEventBudgetOptions,
  runEventBudgetSave,
  runEventBudgetUpdate,
} from '../features/eventBudget';
import { runList } from '../features/list';
import { runShopTrend } from '../features/shopTrend';
import { runCustomerTrend } from '../features/customerTrend';
import {
  runListBlack,
  runListInsert,
  runListShopChange,
  runListStaffChange,
  runListTag,
} from '../features/list/save';
import { runRank } from '../features/rank';
import {
  runContractExpectedUpdate,
  runInterviewLogShow,
  runInterviewLogUpdate,
} from '../features/interviewLog';
import {
  runFundingPlanDelete,
  runFundingPlanGet,
  runFundingPlanSave,
} from '../features/fundingPlan';
import { runChangeCompanyAchievement, runCompany } from '../features/company';
import { runListEvent } from '../features/list/event';
import { runHeader } from '../features/header';
import type { InformationCategory } from '../features/information';
import { runInformationInit } from '../features/information';
import type { SaveCategory } from '../features/information/save';
import {
  runInformationCustomerInfo,
  runInformationLog,
  runInformationUpdateCallLog,
  runInformationUpdateInterviewLog,
} from '../features/information/save';
import { runKpiAnalysisGet, runKpiAnalysisList } from '../features/kpi/history';
import { runKpiFilterMaster } from '../features/kpi/master';
import {
  runKSnap,
  runKSnapCustomer,
  runKSnapCustomerUpdate,
  runKSnapEdit,
  runKSnapLoad,
  runKSnapLogin,
  runKSnapPublic,
  runKSnapShow,
} from '../features/ksnap';
import { runMenu } from '../features/menu';
import { runPropertySuumo } from '../features/property';
import { runShopList } from '../features/shopList';
import { runUpdateLog } from '../features/updateLog';
import type { GatewayEntry, GatewayKey } from './types';
import { gatewayKey } from './types';

/**
 * Express へ移植済みのエンドポイント一覧。
 *
 * ここに登録されたものは Express が処理し、無いものは ① レンタルサーバーの
 * PHP へそのまま転送される（phpFallback.ts）。
 *
 * ⚠️ この方式の要点は「1機能ずつ移せる」こと。
 *   186個すべてを移し終わるまで切り替えを待つ必要がない。
 *   1つ移植 → 差分比較 → 問題なければ登録、を繰り返す。
 *
 * ─────────────────────────────────────────────
 * 登録の書き方
 *
 *   register({
 *     request: 'menu',
 *     summary: 'メニューの件数バッジ',
 *     phpSource: 'backend/src/handlers/menu.php',
 *     auth: 'staff',
 *     handler: async (ctx) => runMenu(),
 *   });
 *
 *   roll / category で分岐するものは、その値ごとに1件ずつ登録する。
 *   ⚠️ 「roll を省略したら全部にマッチ」のようなワイルドカードは用意しない。
 *     どれが移植済みでどれが未移植かが曖昧になり、
 *     未移植のものが誤って Express に流れる事故が起きるため。
 * ─────────────────────────────────────────────
 */

const entries = new Map<GatewayKey, GatewayEntry>();

export interface RegisterInput extends GatewayEntry {
  request: string;
  /** 省略時は空文字（roll を使わないエンドポイント） */
  roll?: string;
  /** 省略時は空文字（category を使わないエンドポイント） */
  category?: string;
}

/** エンドポイントを1件登録する */
export const register = (input: RegisterInput): void => {
  const key = gatewayKey(input.request, input.roll ?? '', input.category ?? '');

  if (entries.has(key)) {
    // 同じキーを二重登録すると、どちらが動いているか分からなくなる
    throw new Error(`ゲートウェイのキーが重複しています: ${key}`);
  }

  entries.set(key, {
    summary: input.summary,
    phpSource: input.phpSource,
    auth: input.auth,
    handler: input.handler,
  });
};

/** 移植済みかどうかを引く。未登録なら undefined（＝PHPへ転送する） */
export const findEntry = (
  request: string,
  roll: string,
  category: string
): GatewayEntry | undefined => entries.get(gatewayKey(request, roll, category));

/** 登録済みの一覧。起動ログと /api/gateway/_routes で使う */
export const listEntries = (): { key: GatewayKey; entry: GatewayEntry }[] =>
  [...entries.entries()]
    .map(([key, entry]) => ({ key, entry }))
    .sort((a, b) => a.key.localeCompare(b.key));

export const entryCount = (): number => entries.size;

// ---------------------------------------------------------------------------
// 移植済みエンドポイントの登録
//
// ⚠️ ここに登録されていないものは PHP へ転送される。
//   移植したら1件ずつ足していく。問題が起きたら該当の register() を
//   コメントアウトして再デプロイすれば、即座に PHP に戻る。
// ---------------------------------------------------------------------------

/**
 * メニューの通知バッジ。
 *
 * ⚠️ auth: 'none' にしている理由
 *   移植元の menu.php は認証を一切行っていない。
 *   'staff' にすると Express 側だけが厳しくなり、
 *   PHP では動いていた状態から挙動が変わる。
 *   認証強化は移行と分けて、全エンドポイントに対して一括で行う。
 *   （GATEWAY_REQUIRE_AUTH で切り替えられるようにしてある）
 */
register({
  request: 'menu',
  summary: 'メニューの通知バッジ用データ（未同期・キャンセル・失注・新着物件）',
  phpSource: 'backend/src/handlers/menu.php',
  auth: 'none',
  handler: async () => runMenu(),
});

/** ヘッダーの新着物件バッジ。件数だけを返す */
register({
  request: 'header',
  summary: 'ヘッダーの新着物件バッジ（直近3日の登録件数）',
  phpSource: 'backend/src/handlers/header.php',
  auth: 'none',
  handler: async () => runHeader(),
});

/**
 * 更新履歴と所属店舗。
 *
 * ⚠️ 名前に update が入っているが SELECT のみ。
 *   比較ツールで検証するときは --read-only-verified が必要。
 */
register({
  request: 'update_log',
  summary: '更新履歴と、ログイン中スタッフの所属店舗',
  phpSource: 'backend/src/handlers/update_log.php',
  auth: 'none',
  handler: async (ctx) => {
    // ⚠️ PHP は $data['userName'] ?? '' としている。
    //   未指定でも空文字で検索し、該当なし（shop: false）を返すのが正しい挙動。
    const userName = typeof ctx.body.userName === 'string' ? ctx.body.userName : '';
    return runUpdateLog(userName);
  },
});

/**
 * 架電状況一覧の初期データ。
 *
 * ⚠️ category ごとに1件ずつ登録する。ワイルドカードは用意していない。
 *   ここに無い category（想定外の値）は ① の PHP へ転送される。
 *   PHP は未知の値も master_data として扱うが、Express が黙って
 *   既定テーブルを返すより、既存の挙動に任せるほうが安全。
 *
 * ⚠️ category 空（未指定）も PHP の既定値に合わせて登録する。
 *   フロント（CallStatusList.tsx）は必ず値を送るが、
 *   PHP が受け付ける形は残しておく。
 */
const callStatusCategories: (CallStatusCategory | '')[] = ['', 'order', 'spec', 'used'];

for (const category of callStatusCategories) {
  register({
    request: 'callStatusList',
    category,
    summary: `架電状況一覧の初期データ（${category === '' ? '既定=注文' : category}）`,
    phpSource: 'backend/src/handlers/callStatusList.php',
    auth: 'none',
    handler: async () => runCallStatusList(category === '' ? undefined : category),
  });
}

/**
 * K-SNAP の顧客詳細（information/KSnap.tsx）。
 *
 * ⚠️ auth: 'none'。移植元の kSnap.php は認証していない。
 *   ⚠️ ただし顧客のパスワードと閲覧履歴を返すエンドポイントである。
 *     認証強化の対象として優先度が高い（GATEWAY_REQUIRE_AUTH の一括適用時に効く）。
 */
register({
  request: 'kSnap',
  summary: 'K-SNAP の顧客1件（パスワード・閲覧ログ・お気に入り）とスナップ写真の全件',
  phpSource: 'backend/src/handlers/kSnap.php',
  auth: 'none',
  handler: async (ctx) => runKSnap(ctx.body.id),
});

// ---------------------------------------------------------------------------
// Instagram 公式アンバサダー管理
//
// ⚠️⚠️ **Express のみで実装している。PHPハンドラは存在しない。**
//
//   ・差分比較（cli/compareBackends）は使えない（比較相手が無い）
//   ・② が落ちるとこの画面だけ動かなくなる（① にフォールバック先が無い）
//   ・⚠️ ② のDBユーザーに INSERT / UPDATE 権限が必要
//
// ⚠️ PHPハンドラが無いおかげで、**書き込み系を ① の転送許可リストに入れても安全**。
//   ① が自動フォールバックしても実行するPHPが無く、404 になるだけで
//   二重実行にならない。
//   （PHPハンドラがある request では二重実行になるため入れてはいけない）
//
// ⚠️ auth: 'staff'。新規の機能なので最初から認証を要求する。
//   移植ではないため「PHPが認証していない」という制約が無い。
// ---------------------------------------------------------------------------

register({
  request: 'ambassador_list',
  summary: 'アンバサダー台帳の一覧（反響数・未同期数を集計して付与）',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runAmbassadorList();
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

register({
  request: 'ambassador_list',
  roll: 'insert',
  summary: '【書き込み】アンバサダーの新規追加。採番した no を返す',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runAmbassadorInsert(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

register({
  request: 'ambassador_list',
  roll: 'update',
  summary: '【書き込み】アンバサダーの更新。送られた列だけを更新する',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runAmbassadorUpdate(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * 反響画面の店舗・担当営業マスタ。
 *
 * ⚠️ **アンバサダー専用ではない。** 紹介キャンペーン反響一覧も同じものを使う。
 *   request 名が `ambassador_master` なのは先にアンバサダーで作った経緯による。
 *   **条件を変えると3画面（台帳・アンバサダー反響・紹介反響）すべてに効く。**
 *
 * ⚠️ 2026-09-06 に店舗の条件を report_flag = 1 → show_flag = 1 へ変更した。
 *   選択肢が5件減り14件増える。詳細は features/ambassador/master.ts を参照。
 */
register({
  request: 'ambassador_master',
  summary: '反響画面の店舗（show_flag=1・division付き）と営業職（category=1）のマスタ',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runAmbassadorMaster();
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

register({
  request: 'inquiry_ambassador',
  summary: 'アンバサダー経由の反響一覧（台帳の氏名・アカウントを添える）',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runInquiryAmbassadorList();
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * 反響の担当店舗・担当営業を割り当てる。
 *
 * ⚠️ 更新できるのは shop / staff だけ。氏名や連絡先は顧客本人の入力であり、
 *   社内で書き換えると原本が失われる。
 * ⚠️ 同期済みの行は拒否される（features/ambassador/index.ts）。
 */
register({
  request: 'inquiry_ambassador',
  roll: 'update',
  summary: '【書き込み】反響の担当店舗・担当営業・事業区分を更新する（同期前のみ）',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runInquiryAmbassadorUpdate(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * 反響を顧客として取り込む。
 *
 * ⚠️ 同期先は事業区分で変わる（master_data / master_data_kaeru / master_data_resale）。
 *   分岐は features/inquirySync.ts にある。
 *
 * トランザクションで囲んでおり、既に sync = 1 の行は拒否する。
 * 連打や古い画面からのリクエストで顧客が二重に作られないようにするため。
 */
register({
  request: 'inquiry_ambassador',
  roll: 'sync',
  summary: '【書き込み】反響を顧客テーブル（事業区分で決まる）へ取り込み、sync を 1 にする',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runInquiryAmbassadorSync(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * 公開フォームからの反響受付。
 *
 * ⚠️⚠️ **このシステムで唯一の「認証なしの書き込み口」である。**
 *
 *   反響元: https://kh-house.jp/ambassador/?id=<ambassador_list.no>
 *   ブラウザからも curl からも、社外の誰でも叩ける。
 *
 * ⚠️ auth: 'none' は**意図的**である。フォームの利用者は顧客であり、
 *   スタッフのトークンを持たない。'staff' にすると反響が1件も届かなくなる。
 *
 * ⚠️ GATEWAY_REQUIRE_AUTH=true（'none' にも認証を要求する一括強化モード）を
 *   有効にすると、**このエンドポイントも 401 になり反響が止まる。**
 *   有効化するときは、ここを例外にする仕組みを先に入れること。
 *
 * ⚠️ 防御は3段。どれか1つでも外すと穴になる。
 *     1. middlewares/publicFormRateLimit.ts … IP単位の流量制限
 *     2. features/ambassador/inquiry.ts     … 全項目の検証・長さ制限
 *     3. CORS（app.ts）                      … kh-house.jp のみ許可
 *   ⚠️ ただし CORS はブラウザの仕組みであり、curl には効かない。
 *     防御として数えてはいけない。
 *
 * ⚠️ kh-house.jp は ② から見て別オリジン。本番の CORS_ORIGINS に
 *   https://kh-house.jp を追加しないとブラウザから送信できない。
 */
register({
  request: 'ambassador_inquiry',
  summary: '【書き込み・認証なし】公開フォーム（kh-house.jp）からの反響受付',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runAmbassadorInquiry(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

// ---------------------------------------------------------------------------
// お友達紹介キャンペーン
//
// ⚠️⚠️ **反響の受付だけは ① の PHP にある。**
//   受付:   request 'introductory'        → backend/src/handlers/introductory.php
//   画面:   request 'inquiry_introductory' → ここ（Express のみ）
//
//   受付を ① に置いているのは、GAS からの経路に ② を挟むと
//   ② が落ちている間の反響が失われるため（GAS は再送しない）。
//   ⚠️ request 名が似ているので取り違えないこと。
//
// ⚠️ 店舗・担当営業のマスタは `ambassador_master` を共用している。
//   専用のものは作っていない（条件が同じため）。
// ---------------------------------------------------------------------------

register({
  request: 'inquiry_introductory',
  summary: 'お友達紹介キャンペーンの反響一覧',
  phpSource: '(Express のみ。受付の introductory.php とは別物)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runInquiryIntroductoryList();
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * 反響の担当店舗・担当営業・事業区分を割り当てる。
 *
 * ⚠️ 更新できるのは shop / staff / division だけ。紹介者名や連絡先は
 *   メール本文から取り込んだ原本であり、社内で書き換えると原本が失われる。
 * ⚠️ 同期済みの行は拒否される（features/introductory/index.ts）。
 */
register({
  request: 'inquiry_introductory',
  roll: 'update',
  summary: '【書き込み】紹介反響の担当店舗・担当営業・事業区分を更新する（同期前のみ）',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runInquiryIntroductoryUpdate(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * 反響を顧客として取り込む。
 *
 * ⚠️ 同期先は事業区分で変わる（master_data / master_data_kaeru / master_data_resale）。
 * ⚠️ 顧客として作るのは**お友達（紹介された人）**であり、紹介者ではない。
 */
/**
 * イベント来場予約の公開受付。
 *
 * ⚠️⚠️ **認証なしの書き込み口**（ambassador_inquiry に次いで2つ目）。
 *
 *   予約元: https://kh-house.jp/festa/ （おうちづくりフェスタ2026 のLP）
 *   ブラウザからも curl からも、社外の誰でも叩ける。
 *
 * ⚠️ auth: 'none' は**意図的**である。予約するのは来場者であり、
 *   スタッフのトークンを持たない。'staff' にすると予約が1件も入らなくなる。
 *
 * ⚠️ GATEWAY_REQUIRE_AUTH=true（'none' にも認証を要求する一括強化モード）を
 *   有効にすると、**このエンドポイントも 401 になり予約が止まる。**
 *   ambassador_inquiry と同じ扱いで例外にすること。
 *
 * ⚠️ 保存先の event_db は既存イベントと共用。`title` はサーバー側の固定値であり、
 *   リクエストからは受け取らない（features/event/reservation.ts）。
 *
 * ⚠️ 流量制限は middlewares/publicFormRateLimit.ts の GUARDED_REQUESTS で行う。
 *   ここに登録しただけでは制限が掛からない。
 */
register({
  request: 'event_reservation',
  summary: '【書き込み・認証なし】おうちづくりフェスタ2026 のLPからの来場予約受付',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runEventReservation(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * イベント当日の受付（チェックイン・退場）。
 *
 * ⚠️⚠️ **認証なしの書き込み口**（3つ目）。しかも来場者の氏名を返す。
 *
 *   スタッフがスマホの標準カメラで来場者のQRを読むと
 *   https://kh-house.jp/festa/reservation/?id=... が開き、その画面から叩かれる。
 *   ダッシュボードからは使わない（スマホではヘッダーが表示されないため）。
 *
 * ⚠️ auth: 'none' だが**無防備ではない。** 合い言葉（EVENT_CHECKIN_PASSCODE）を
 *   検証するまで氏名を返さない。実装は features/event/checkin.ts。
 *
 * ⚠️ **合い言葉が未設定なら全て拒否される。** 素通しにはしていない。
 *   ② の .env.prod に設定しないと当日の受付ができない。
 *
 * ⚠️ 流量制限は失敗回数のみを数える専用の設定を使う
 *   （middlewares/publicFormRateLimit.ts）。フォームと同じ制限にすると
 *   1台のスマホで連続して受付したときに止まる。
 *
 * ⚠️⚠️ **roll ごとに1件ずつ登録すること。** ゲートウェイは request + roll の
 *   完全一致で引くため、登録の無い roll は「未移植」として ① へ転送されてしまう
 *   （① には対応するPHPが無いので 404 になり、当日の受付が動かない）。
 */
const eventCheckinHandler = async (
  ctx: { body: Record<string, unknown>; res: { status: (code: number) => unknown } }
): Promise<unknown> => {
  const result = await runEventCheckin(ctx.body);
  if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
  return result.body;
};

// roll 省略（＝照会）。⚠️ 記録はしない
register({
  request: 'event_checkin',
  summary: '【合い言葉】イベント受付：予約内容の照会（記録しない）',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'none',
  handler: eventCheckinHandler,
});

register({
  request: 'event_checkin',
  roll: 'lookup',
  summary: '【合い言葉】イベント受付：予約内容の照会（記録しない）',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'none',
  handler: eventCheckinHandler,
});

register({
  request: 'event_checkin',
  roll: 'checkin',
  summary: '【書き込み・合い言葉】イベント受付：来場時刻を記録する',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'none',
  handler: eventCheckinHandler,
});

register({
  request: 'event_checkin',
  roll: 'checkout',
  summary: '【書き込み・合い言葉】イベント受付：退場時刻を記録する',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'none',
  handler: eventCheckinHandler,
});

register({
  request: 'inquiry_introductory',
  roll: 'sync',
  summary: '【書き込み】紹介反響のお友達を顧客テーブルへ取り込み、sync を 1 にする',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runInquiryIntroductorySync(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

// ---------------------------------------------------------------------------
// K-SNAP（スナップ写真）
//
// ⚠️⚠️ 顧客向け（公開）とスタッフ向けが混在している。
//   認証を一括で強化するとき、**顧客向けを除外しないと公開ギャラリーが止まる**
//   （顧客はスタッフのトークンを持たない）。下の各コメントで区分を明記している。
//
// ⚠️ k-snap_update（画像アップロード）は登録していない。
//   画像の保存先が ① のファイルシステムであり、② から書き込めないため。
// ---------------------------------------------------------------------------

/** 顧客向け（公開）。⚠️ 認証を要求してはいけない */
register({
  request: 'k-snap_login',
  summary: '【公開】ギャラリーのログイン。パスワードから顧客IDを引く',
  phpSource: 'backend/src/handlers/k-snap_login.php',
  auth: 'none',
  handler: async (ctx) => runKSnapLogin(ctx.body.pass),
});

/** 顧客向け（公開）。⚠️ 認証を要求してはいけない */
register({
  request: 'k-snap',
  summary: '【公開】ギャラリー向けスナップ一覧（show_snap = 1・owner は暗号化）',
  phpSource: 'backend/src/handlers/k-snap.php',
  auth: 'none',
  handler: async () => runKSnapPublic(),
});

/** 顧客向け（公開）。⚠️ 認証を要求してはいけない */
register({
  request: 'k-snap_customer',
  summary: '【公開】ギャラリー用の顧客1件',
  phpSource: 'backend/src/handlers/k-snap_customer.php',
  auth: 'none',
  handler: async (ctx) => runKSnapCustomer(ctx.body.id),
});

/**
 * 顧客向け（公開）。⚠️ 認証を要求してはいけない。
 *
 * ⚠️⚠️ **書き込み系。① の expressProxyRequests() に追加してはいけない。**
 *   自動フォールバックで二重実行される。
 *   ここに登録しているのは、将来フロントを ② へ直接向けたときのため。
 */
register({
  request: 'k-snap_customer_update',
  summary: '【公開・書き込み】顧客の閲覧ログ・お気に入り・タグの記録',
  phpSource: 'backend/src/handlers/k-snap_customer_update.php',
  auth: 'none',
  handler: async (ctx) => {
    await runKSnapCustomerUpdate(ctx.body);
    // ⚠️ 移植元は何も出力しない。空文字を返して形を揃える
    ctx.res.type('application/json').send('');
    return undefined;
  },
});

/**
 * スタッフ向け。
 *
 * ⚠️ auth: 'none' にしているのは、移植元の k-snap_edit.php が
 *   認証していないため（PHPと挙動を揃える）。本来は認証すべき対象であり、
 *   一括強化の際は 'staff' に上げること。
 */
register({
  request: 'k-snap_edit',
  summary: '【スタッフ】スナップ一覧（全件・owner は平文）',
  phpSource: 'backend/src/handlers/k-snap_edit.php',
  auth: 'none',
  handler: async () => runKSnapEdit(),
});

/** スタッフ向け。⚠️ 上記と同じ理由で 'none'。一括強化の対象 */
register({
  request: 'k-snap_load',
  summary: '【スタッフ】編集画面の初期データ（スナップ1件＋オーナー名一覧）',
  phpSource: 'backend/src/handlers/k-snap_load.php',
  auth: 'none',
  handler: async (ctx) => runKSnapLoad(ctx.body.id),
});

/**
 * スタッフ向け。
 *
 * ⚠️⚠️ **書き込み系。① の expressProxyRequests() に追加してはいけない。**
 */
register({
  request: 'k-snap_show',
  summary: '【スタッフ・書き込み】写真の公開/非公開、営業名表示の切り替え',
  phpSource: 'backend/src/handlers/k-snap_show.php',
  auth: 'none',
  handler: async (ctx) => runKSnapShow(ctx.body),
});

/**
 * 店舗マスタ。
 *
 * ⚠️ auth: 'none'。移植元が認証していないため。
 *   ⚠️ ただし公開ギャラリー（顧客向け）も使っている。
 *     認証を一括強化するときに 'staff' へ上げると**公開ギャラリーが止まる**。
 *
 * ⚠️ 配列そのものを返す。`{ status, ... }` で包むと呼び出し側3箇所が壊れる。
 */
register({
  request: 'shop_list',
  summary: '店舗マスタ（show_flag = 1 のブランド・課・エリア・事業区分）',
  phpSource: 'backend/src/handlers/shop_list.php',
  auth: 'none',
  handler: async () => runShopList(),
});

/**
 * SUUMO の掲載順位（SuumoPropertySummary.tsx）。
 *
 * ⚠️ roll = 'suumo' だけを登録する。'list' / 'detail' は未移植なので
 *   ① へ転送される。ワイルドカードを作らない方針どおり。
 *
 * ⚠️ auth: 'none' にしている。移植元の property.php は認証していない。
 */
register({
  request: 'property',
  roll: 'suumo',
  summary: 'SUUMO の掲載順位データ（全期間）',
  phpSource: 'backend/src/handlers/propertyAction/property_suumo.php',
  auth: 'none',
  handler: async () => runPropertySuumo(),
});

// ---------------------------------------------------------------------------
// KPI分析（ClaudeAnalysis.tsx）— 参照系のみ
//
// ⚠️ auth: 'master' にしている。移植元がいずれも requireMaster() を呼んでおり、
//   経営数値と分析結果を返すため。'none' にすると認証なしで取得できてしまう。
//
// ⚠️ kpi_analyze（Claude API呼び出し＋INSERT）と kpi_analysis_delete（DELETE）は
//   移植していない。自動フォールバックがあるため、② で完了した直後に応答が
//   失われると ① でも実行され、**二重課金・履歴の二重INSERT**になる。
//   これらを移すには「フォールバック禁止」の仕組みが先に必要。
// ---------------------------------------------------------------------------

register({
  request: 'kpi_filter_master',
  summary: 'KPI分析の絞り込みマスタ（部門→課→店舗→スタッフ）',
  phpSource: 'backend/src/handlers/kpi_filter_master.php',
  auth: 'master',
  handler: async () => runKpiFilterMaster(),
});

register({
  request: 'kpi_analysis_list',
  summary: '保存済みKPI分析の一覧（本体JSONは含まない）',
  phpSource: 'backend/src/handlers/kpi_analysis_list.php',
  auth: 'master',
  handler: async (ctx) => {
    const result = await runKpiAnalysisList({
      limit: ctx.body.limit,
      offset: ctx.body.offset,
      division: ctx.body.division,
      type: ctx.body.type,
    });
    // 一覧は常に 200 だが、他と同じ書き方に揃えておく
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

register({
  request: 'kpi_analysis_get',
  summary: '保存済みKPI分析の1件取得（結果画面の復元用。課金は発生しない）',
  phpSource: 'backend/src/handlers/kpi_analysis_get.php',
  auth: 'master',
  handler: async (ctx) => {
    const result = await runKpiAnalysisGet(ctx.body.id);
    // ⚠️ PHP は 400 / 404 / 422 を出し分けている。同じコードを返す
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

// ---------------------------------------------------------------------------
// 顧客詳細モーダルの初期データ（InformationEdit / Kaeru / Resale）— 参照系のみ
//
// ⚠️⚠️ **roll 付きの書き込み系は絶対に登録しないこと。**
//
//   この request は ① に PHP ハンドラが**実在する**（information.php）。
//   ② への転送が失敗すると ① が自動フォールバックして同じ処理を実行するため、
//   書き込みを登録すると二重登録・二重更新になる。
//
//   登録してはいけない roll:
//     customer_info          … master_data の upsert（さらに multipart のため
//                              express_proxy.php が転送自体を拒否する）
//     update_call_log        … call_sheet の upsert
//     update_interview_log   … interview_sheet の upsert
//     log                    … master_data_log への INSERT（UNIQUE キーが無い）
//
//   これらを移すには「フロントを ② に直接向ける」段階へ進む必要がある
//   （express_proxy.php の冒頭コメントが想定している次フェーズ）。
//
// ⚠️ category ごとに1件ずつ登録する。ワイルドカードは用意していない。
//   ① の information.php は category に 'common' も許可しているが、
//   roll 無しの 'common'（information_common.php）は存在しないため登録しない。
// ---------------------------------------------------------------------------

const informationCategories: InformationCategory[] = ['order', 'spec', 'used'];

for (const category of informationCategories) {
  register({
    request: 'information',
    category,
    summary: `顧客詳細モーダルの初期データ（${category}）：マスタ＋顧客・架電・面談・競合PDF`,
    phpSource: `backend/src/handlers/informationAction/information_${category}.php`,
    auth: 'none',
    handler: async (ctx) => {
      // ⚠️ PHP は `$data['id'] ?? ''`。未指定でも空文字で処理を続け、
      //   マスタだけを返すのが正しい挙動。400 にしない
      const id = typeof ctx.body.id === 'string' ? ctx.body.id : '';
      return runInformationInit(category, id);
    },
  });
}

// ---------------------------------------------------------------------------
// 家族情報（FamilyInfo.tsx）
//
// ⚠️ 移植元は**旧API**（`/dashboard/api/` の demand 形式）で、
//   現行 backend/ にPHPハンドラが無い。アンバサダー／紹介キャンペーンと
//   同じ「Express のみ」の扱いになるため、書き込み（update）も登録してよい。
//   自動フォールバックしても ① に実行するPHPが無く、二重実行にならない。
//
// ⚠️ 逆に、この request に**PHPハンドラを作ってはいけない。**
//   作った瞬間に二重実行の危険が生まれる。
//
// ⚠️ ② が落ちると家族情報モーダルだけが動かなくなる（フォールバック先が無い）。
//
// ⚠️ auth: 'none'。旧APIは認証していなかった。'staff' に上げると
//   移行と同時に挙動が変わり、原因の切り分けが難しくなる。
//   認証強化は GATEWAY_REQUIRE_AUTH の一括適用で行う。
// ---------------------------------------------------------------------------

register({
  request: 'family_info',
  summary: '家族情報の1件取得（該当なしは false を返す）',
  phpSource: '(旧API demand: show_family_info。現行 backend/ にPHPハンドラは無い)',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runFamilyInfoShow(ctx.body.id);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

register({
  request: 'family_info',
  roll: 'update',
  summary: '【書き込み】家族情報の登録・更新（upsert）。保存後の行を返す',
  phpSource: '(旧API demand: update_family_info。現行 backend/ にPHPハンドラは無い)',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runFamilyInfoUpdate(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

// ---------------------------------------------------------------------------
// AIデジタル資金計画書（information/FundingPlan.tsx →
//                        frontend/public/funding-plan/index.html）
//
// ⚠️ 移植ではなく、最初から Express のみで実装した機能である。
//   ① に PHP ハンドラが無いため、① が自動フォールバックしても 404 に
//   なるだけで二重実行にならない。書き込み（save）も登録してよい。
//
// ⚠️ 逆に backend/src/handlers/funding_plan.php を**作ってはいけない。**
//   作った瞬間に二重実行の経路が生まれる。
//
// ⚠️⚠️ save は **master_data も更新する**（ヒアリングした数値7項目）。
//   顧客台帳を書き換える数少ないエンドポイントなので、
//   auth: 'staff' を外さないこと。
// ---------------------------------------------------------------------------

register({
  request: 'funding_plan',
  summary: '資金計画書の取得。未作成なら master_data と family_info から初期値を組み立てて返す',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runFundingPlanGet(ctx.body.id);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

register({
  request: 'funding_plan',
  roll: 'save',
  summary: '【書き込み】資金計画書の保存（upsert）。⚠️ master_data の数値7項目も更新する',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runFundingPlanSave(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * 資金計画書の削除。
 *
 * ⚠️ master_data には触らない。書き戻した数値は顧客台帳に残る
 *   （features/fundingPlan/index.ts のコメント参照）。
 */
register({
  request: 'funding_plan',
  roll: 'delete',
  summary: '【書き込み】資金計画書の削除。⚠️ master_data は変更しない',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runFundingPlanDelete(ctx.body.id);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

// ---------------------------------------------------------------------------
// 顧客詳細モーダルの保存系
//
// ⚠️⚠️ **これらは「フォールバック禁止」で運用する。**
//   ① にも同じ処理をする PHP が**残っている**ため、通常の許可リストに
//   入れると転送失敗時の自動フォールバックで二重登録になる。
//
//   ① 側では core/express_proxy.php の `expressProxyExclusive()` に登録し、
//   転送に失敗したら ① では実行せず 502 を返すようにした。
//
//   ⚠️ 代償: ② が落ちている間は保存ができない（502）。
//     参照系は従来どおりフォールバックするので画面は開ける。
//   ⚠️ 切り戻しは expressProxyExclusive() から該当行を消すだけ。
//     ① の PHP は消していない。
//
// ⚠️ auth: 'none'。移植元の information.php は認証していない。
//   ここだけ厳しくすると PHP で動いていた状態から挙動が変わる。
//   認証強化は GATEWAY_REQUIRE_AUTH の一括適用で行う。
//
// ⚠️⚠️ 競合PDFのアップロード（multipart）はここでは扱わない。
//   ファイルは ① の uploads/competitors/ に置いて ① の URL で配信している。
//   ② からは ① のファイルシステムへ書けないため、フロントが
//   「PDF は ① へ multipart」「顧客情報は JSON でゲートウェイへ」に
//   分けている。multipart は shouldProxyToExpress() が転送を拒否する。
// ---------------------------------------------------------------------------

const saveCategories: SaveCategory[] = ['order', 'spec', 'used'];

for (const category of saveCategories) {
  register({
    request: 'information',
    roll: 'customer_info',
    category,
    summary: `【書き込み・フォールバック禁止】顧客情報の保存（${category}）。⚠️ 競合PDFは含まない`,
    phpSource: 'backend/src/handlers/informationAction/customer_info.php',
    auth: 'none',
    handler: async (ctx) => {
      const result = await runInformationCustomerInfo(category, ctx.body);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });
}

register({
  request: 'information',
  roll: 'update_call_log',
  category: 'common',
  summary: '【書き込み・フォールバック禁止】架電記録の保存（call_sheet の upsert）',
  phpSource: 'backend/src/handlers/informationAction/information_update_call_log.php',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runInformationUpdateCallLog(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

register({
  request: 'information',
  roll: 'update_interview_log',
  category: 'common',
  summary: '【書き込み・フォールバック禁止】面談記録の保存（interview_sheet の upsert）',
  phpSource: 'backend/src/handlers/informationAction/information_update_interview_log.php',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runInformationUpdateInterviewLog(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * 変更履歴の追記。
 *
 * ⚠️⚠️ UNIQUE キーが無い純粋な INSERT。二重実行すれば2行できる。
 *   フォールバック禁止の仕組みが無いと移植できないものだった。
 */
register({
  request: 'information',
  roll: 'log',
  category: 'common',
  summary: '【書き込み・フォールバック禁止】変更履歴の追記（master_data_log）',
  phpSource: 'backend/src/handlers/informationAction/information_log.php',
  auth: 'none',
  handler: async (ctx) => {
    const result = await runInformationLog(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

// ---------------------------------------------------------------------------
// 集客サマリー（header/EventSummary.tsx）
//
// ⚠️ Express のみ。① に PHPハンドラが無いため、① が自動フォールバックしても
//   404 になるだけで二重実行にならない。
// ⚠️ 逆に backend/src/handlers/event_summary.php を**作ってはいけない。**
//
// ⚠️ 参照のみ。master_data / event_db / event_calendar / budget を読む。
// ---------------------------------------------------------------------------

register({
  request: 'event_summary',
  summary: 'イベントごとのファネル（反響〜契約）と広告費の集計',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async () => runEventSummary(),
});

/**
 * KPI をクリックしたときの顧客一覧。
 *
 * ⚠️ 表の件数と一覧の件数が食い違わないよう、判定に使う列は
 *   features/eventSummary.ts の KPI_SQL と共通にしている。
 */
register({
  request: 'event_summary',
  roll: 'detail',
  summary: 'イベントの1KPIに該当する顧客の一覧（顧客詳細を開く導線用）',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runEventSummaryDetail(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

// ---------------------------------------------------------------------------
// ランク管理（rank/RankOrder.tsx / RankKaeru.tsx / RankResale.tsx）
//
// ⚠️⚠️ **1つの request が参照と書き込みを兼ねる。** 分岐は runRank の中で行う
//   （rank.php と同じ）。roll では分かれていない。
//
// ⚠️ category ごとに1件ずつ登録する。ワイルドカードは無い。
//   ⚠️ category を送らない呼び出しがある（担当営業メモの保存）。
//     PHP の `?? 'order'` と同じ扱いにするため category: '' も登録する。
//
// ⚠️ ① の PHP ハンドラは実在する。書き込みのときだけ ① のフォールバックを
//   禁止している（express_proxy.php の rankRequestIsWrite）。
// ---------------------------------------------------------------------------

for (const category of ['', 'order', 'spec', 'used']) {
  register({
    request: 'rank',
    category,
    summary: `ランク管理（${category === '' ? '既定=order。担当営業メモの保存もここ' : category}）。参照とランク更新を兼ねる`,
    phpSource: 'backend/src/handlers/rank.php',
    auth: 'staff',
    handler: async (ctx) => {
      const result = await runRank(ctx.body);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });
}

// ---------------------------------------------------------------------------
// 商談ステップ（components/InterviewLog.tsx）
// ---------------------------------------------------------------------------

register({
  request: 'interviewLog',
  summary: '商談ステップの取得（interview_sheet と該当顧客）',
  phpSource: 'backend/src/handlers/interviewLog.php',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runInterviewLogShow(ctx.body.id);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * ⚠️⚠️ 書き込み。interview_sheet の upsert と master_data の KPI 更新を行う。
 *   ① に PHP ハンドラが実在するため、フォールバック禁止に登録している。
 */
register({
  request: 'interviewLog_update_interview',
  summary: '【書き込み・フォールバック禁止】商談ステップの保存と master_data のKPI更新',
  phpSource: 'backend/src/handlers/interviewLog_update_interview.php',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runInterviewLogUpdate(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * 契約見込み数の登録。
 * ⚠️ 書き込み。PHP ハンドラが実在するためフォールバック禁止に登録している。
 */
register({
  request: 'contract_ex_update',
  summary: '【書き込み・フォールバック禁止】契約見込み数の登録（contract_expected の upsert）',
  phpSource: 'backend/src/handlers/contract_ex_update.php',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runContractExpectedUpdate(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

// ---------------------------------------------------------------------------
// 集客イベントの広告費入力（header/EventBudget.tsx）
//
// ⚠️ Express のみ。① に PHP ハンドラは存在しない。
//   ⚠️ backend/src/handlers/event_budget.php を**作ってはいけない。**
//     budget には UNIQUE キーが無いため、二重実行で同じ行が2組できる。
// ---------------------------------------------------------------------------

register({
  request: 'event_budget',
  summary: '広告費入力の選択肢（report_flag=1 の店舗と集客イベント）',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runEventBudgetOptions();
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

register({
  request: 'event_budget',
  roll: 'save',
  summary: '【書き込み】広告費の登録（budget への INSERT。複数店舗は案分）',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runEventBudgetSave(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * 登録済みの広告費を1行だけ修正する。
 *
 * ⚠️⚠️ WHERE に medium = 'イベント' を必ず含める（features/eventBudget.ts 参照）。
 *   id だけで UPDATE すると、イベント以外の広告費（28,000件超）を
 *   画面から書き換えられてしまう。
 */
register({
  request: 'event_budget',
  roll: 'update',
  summary: '【書き込み】登録済みの広告費（medium=イベント）の1行を修正',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runEventBudgetUpdate(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

// ---------------------------------------------------------------------------
// 反響一覧（list/ListOrder.tsx / ListKaeru.tsx / ListResale.tsx）
//
// ⚠️ 参照のみ。① に PHP ハンドラが実在するのでフォールバックしてよい。
//
// ⚠️ roll 付きの list はすべて移植済み
//   （insert / black / tag / shop_change / staff_change / event）。
//   ⚠️⚠️ **ゲートウェイは request + roll + category の完全一致で引く。**
//     登録漏れがあると ② が「ループ検知」で 502 を返し、① にフォールバックする。
//     画面は動くが往復が無駄になり、① と ② の両方のログが汚れる。
//     2026-09-10 に roll = 'event' の登録漏れで実際に起きた。
// ---------------------------------------------------------------------------

for (const category of ['order', 'spec', 'used']) {
  register({
    request: 'list',
    category,
    summary: `反響一覧の初期データ（${category}）`,
    phpSource: `backend/src/handlers/listAction/list_${category}.php`,
    auth: 'staff',
    handler: async (ctx) => {
      const result = await runList(ctx.body.category);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });
}

// ---------------------------------------------------------------------------
// 反響一覧の書き込み
//
// ⚠️⚠️ **いずれも ① に PHP ハンドラが実在する。**
//   転送に失敗したまま ① で再実行されると二重に反映されるため、
//   backend/src/core/express_proxy.php の expressProxyExclusive() に
//   登録している。外すと二重実行の経路が戻る。
//
// ⚠️ category ごとに1件ずつ登録する。ワイルドカードは無い。
//   ⚠️ black は category を送らない（listUtils.ts の handleBlack）ので
//     category: '' で1件だけ登録する。
// ---------------------------------------------------------------------------

for (const category of ['order', 'spec', 'used']) {
  register({
    request: 'list',
    roll: 'shop_change',
    category,
    summary: `【書き込み・フォールバック禁止】担当店舗の変更（${category}）⚠️ used は category 列`,
    phpSource: 'backend/src/handlers/listAction/list_shop_change.php',
    auth: 'staff',
    handler: async (ctx) => {
      const result = await runListShopChange(ctx.body);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });

  register({
    request: 'list',
    roll: 'staff_change',
    category,
    summary: `【書き込み・フォールバック禁止】担当営業の変更（${category}）`,
    phpSource: 'backend/src/handlers/listAction/list_staff_change.php',
    auth: 'staff',
    handler: async (ctx) => {
      const result = await runListStaffChange(ctx.body);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });

  register({
    request: 'list',
    roll: 'tag',
    category,
    summary: `【書き込み・フォールバック禁止】顧客タグの ON・OFF（${category}）`,
    phpSource: 'backend/src/handlers/listAction/list_tag.php',
    auth: 'staff',
    handler: async (ctx) => {
      const result = await runListTag(ctx.body);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });

  register({
    request: 'list',
    roll: 'insert',
    category,
    summary: `【書き込み・フォールバック禁止】顧客台帳への取り込み（${category}）`,
    phpSource: 'backend/src/handlers/listAction/list_insert.php',
    auth: 'staff',
    handler: async (ctx) => {
      const result = await runListInsert(ctx.body);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });
}

/**
 * ブラックリストの登録・解除。
 *
 * ⚠️⚠️ **category ごとに登録すること。**
 *   2026-09-09 に category: '' で1件だけ登録して失敗した。
 *   listUtils.ts の handleBlack は **category を送っている**ため、
 *   category: '' では引けず ① へ転送されてしまう。
 *   ⚠️ さらに ① の list.php は roll で分岐する**前に** category を
 *     検証するので、category 無しでは 400「無効なカテゴリです」になる。
 *
 * ⚠️ 処理自体は category を使わない（black_list は事業共通）。
 *   引くためだけに3件登録する。
 */
for (const category of ['order', 'spec', 'used']) {
  register({
    request: 'list',
    roll: 'black',
    category,
    summary: `【書き込み・フォールバック禁止】ブラックリストの登録・解除（トグル。${category}）`,
    phpSource: 'backend/src/handlers/listAction/list_black.php',
    auth: 'staff',
    handler: async (ctx) => {
      const result = await runListBlack(ctx.body);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });
}

// ---------------------------------------------------------------------------
// 店舗別動向（shopTrend/ShopTrendOrder.tsx / ShopTrendKaeru.tsx / ShopTrendResale.tsx）
//
// ⚠️ 参照のみ。① に PHP ハンドラが実在するのでフォールバックしてよい。
// ⚠️ roll では分岐しない。category だけ。
//
// ⚠️⚠️ category を送らない呼び出しがある（ShopTrendOrder.tsx の
//   closeInformationEdit）。PHP の既定値 'order' に合わせるため
//   category: '' も登録する。登録しないと ① へ転送される。
// ---------------------------------------------------------------------------

for (const category of ['', 'order', 'spec', 'used']) {
  register({
    request: 'shopTrend',
    category,
    summary: `店舗別動向の初期データ（${category === '' ? '既定=order' : category}）`,
    phpSource: `backend/src/handlers/shopTrendAction/shopTrend_${category === '' ? 'order' : category}.php`,
    auth: 'staff',
    handler: async (ctx) => {
      const result = await runShopTrend(ctx.body.category);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });
}

// ---------------------------------------------------------------------------
// 販促媒体別動向（customerTrend/CustomerTrendOrder.tsx / CustomerTrendKaeru.tsx）
//
// ⚠️ 参照のみ。① に PHP ハンドラが実在するのでフォールバックしてよい。
// ⚠️ roll では分岐しない。category だけ。
//
// ⚠️⚠️ **`used` は登録しない。** ① の customerTrendAction/customerTrend_used.php が
//   存在せず、CustomerTrendResale.tsx も中身の無いプレースホルダのため、
//   そもそも動いていない経路である。登録すると壊れた経路を
//   「動いているように見せる」ことになる。
//
// ⚠️ category を送らない呼び出しに備えて '' も登録する（PHP の既定値 'order'）。
// ---------------------------------------------------------------------------

for (const category of ['', 'order', 'spec']) {
  register({
    request: 'customerTrend',
    category,
    summary: `販促媒体別動向の初期データ（${category === '' ? '既定=order' : category}）`,
    phpSource: `backend/src/handlers/customerTrendAction/customerTrend_${category === '' ? 'order' : category}.php`,
    auth: 'staff',
    handler: async (ctx) => {
      const result = await runCustomerTrend(ctx.body.category);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });
}

// ---------------------------------------------------------------------------
// 会社実績（company/Company.tsx）
//
// ⚠️ `company` は参照のみ。① に PHP ハンドラが実在するのでフォールバックしてよい。
// ⚠️⚠️ `change_company_achievement` は**書き込み**。① の PHP も残るため
//   フォールバック禁止（express_proxy.php の exclusive）に登録している。
//   両方で走ると company_achievement が二重に書かれる。
//
// ⚠️ どちらも roll / category では分岐しない。
// ---------------------------------------------------------------------------

register({
  request: 'company',
  summary: '会社実績の初期データ（担当営業・店舗・課・契約者3事業・契約目標）',
  phpSource: 'backend/src/handlers/company.php',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runCompany();
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

register({
  request: 'change_company_achievement',
  summary: '【書き込み・フォールバック禁止】契約目標の登録（company_achievement の upsert）',
  phpSource: 'backend/src/handlers/change_company_achievement.php',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runChangeCompanyAchievement(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

// ---------------------------------------------------------------------------
// 集客イベントの来場予約一覧（header/EventList.tsx）
//
// ⚠️⚠️ **1つの roll で参照と書き込みを兼ねる。** `function` で分かれる
//   （load = 参照 / update = 書き込み）。`rank` と同じ構造である。
//
// ⚠️ ① に PHP ハンドラが実在する（listAction/list_event.php）。
//   ⚠️⚠️ **フォールバック禁止には登録しない。**
//     update は単純な代入だけで冪等なので、① で再実行されても結果は同じ。
//     理由の詳細は features/list/event.ts のコメントを参照。
//
// ⚠️ category は AuthContext 由来で order / spec / used のいずれか。
//   ワイルドカードは無いので3件登録する。
//   ⚠️ 登録漏れがあると 2026-09-10 に起きた「ループ検知 502」が再発する。
// ---------------------------------------------------------------------------

for (const category of ['order', 'spec', 'used']) {
  register({
    request: 'list',
    roll: 'event',
    category,
    summary: `集客イベントの来場予約一覧（${category}）⚠️ function で参照と更新を兼ねる`,
    phpSource: 'backend/src/handlers/listAction/list_event.php',
    auth: 'staff',
    handler: async (ctx) => {
      const result = await runListEvent(ctx.body);
      if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
      return result.body;
    },
  });
}
