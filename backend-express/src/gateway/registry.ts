import { runMenu } from '../features/menu';
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
