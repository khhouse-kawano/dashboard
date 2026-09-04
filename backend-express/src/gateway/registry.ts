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
import type { CallStatusCategory } from '../features/callStatusList';
import { runCallStatusList } from '../features/callStatusList';
import { runHeader } from '../features/header';
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
 * アンバサダー画面の店舗・担当営業マスタ。
 *
 * ⚠️ 既存の shop_list（show_flag = 1）とは**対象が違う**（report_flag = 1）。
 *   流用すると report_flag = 1 / show_flag = 0 の店舗が選択肢から消える。
 *   詳細は features/ambassador/master.ts を参照。
 */
register({
  request: 'ambassador_master',
  summary: 'アンバサダー画面の店舗（report_flag=1）と営業職（category=1）のマスタ',
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
  summary: '【書き込み】反響の担当店舗・担当営業を更新する（同期前のみ）',
  phpSource: '(Express のみ。PHPハンドラは無い)',
  auth: 'staff',
  handler: async (ctx) => {
    const result = await runInquiryAmbassadorUpdate(ctx.body);
    if (result.httpStatus !== 200) ctx.res.status(result.httpStatus);
    return result.body;
  },
});

/**
 * 反響を顧客として取り込む。master_data へ INSERT する。
 *
 * トランザクションで囲んでおり、既に sync = 1 の行は拒否する。
 * 連打や古い画面からのリクエストで顧客が二重に作られないようにするため。
 */
register({
  request: 'inquiry_ambassador',
  roll: 'sync',
  summary: '【書き込み】反響を master_data へ取り込み、sync を 1 にする',
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
