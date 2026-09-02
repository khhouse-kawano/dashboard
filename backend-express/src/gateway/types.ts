import type { Request, Response } from 'express';
import type { AuthenticatedStaff } from '../types/staff';

/**
 * PHP互換ゲートウェイの型定義。
 *
 * ─────────────────────────────────────────────
 * なぜ互換層が必要なのか
 *
 *   フロントエンドは全ての通信を「1つのURLへのPOST」で行っている。
 *
 *     apiClient.post('', { request: 'list', roll: 'tag', category: 'order', ... })
 *
 *   一方 Express の features/* は REST 形式（GET /api/v1/analysis/pivot 等）で、
 *   形式が違うためフロントからは呼べない。
 *
 *   「フロントエンドのコードは変更しない」という制約のもとで移行するには、
 *   Express 側が PHP と同じ形式を受ける入口を持つ必要がある。それがこれ。
 *
 * ─────────────────────────────────────────────
 * 業務ロジックはここに書かない
 *
 *   ゲートウェイは「振り分け」だけを担う。SQLや集計は features/* に置き、
 *   REST と ゲートウェイの両方から同じ関数を呼ぶ。
 *   こうしておけば、将来フロントを REST に移すときに
 *   ゲートウェイだけを捨てられる。
 * ─────────────────────────────────────────────
 */

/** フロントから届くリクエストボディ。PHP の $data と同じ形 */
export interface GatewayBody {
  /** 必須。PHP の handlers/<request>.php に対応する */
  request?: unknown;
  /** 第2階層の分岐。PHP の $roll */
  roll?: unknown;
  /** 第3階層の分岐。PHP の $category */
  category?: unknown;
  /** 上記以外の任意のパラメータ */
  [key: string]: unknown;
}

/** ハンドラに渡す実行コンテキスト */
export interface GatewayContext {
  /** リクエストボディ全体。PHP の $data に相当する */
  body: GatewayBody;
  /** request / roll / category を取り出したもの */
  request: string;
  roll: string;
  category: string;
  /** Token ヘッダの値。未送信なら空文字 */
  token: string;
  /**
   * 認証済みスタッフ。auth が 'none' のエントリでは null。
   * PHP の requireStaff() / requireMaster() が返す1行に相当する。
   */
  staff: AuthenticatedStaff | null;
  requestId: string;
  /** 逃げ道。ファイルアップロード等でのみ使う */
  req: Request;
  res: Response;
}

/**
 * ゲートウェイのハンドラ。
 *
 * 戻り値はそのまま JSON.stringify されてレスポンスになる。
 * ⚠️ PHP と同じ形（キー名・型）で返すこと。差分は scripts/compareBackends.ts で検出できる。
 */
export type GatewayHandler = (ctx: GatewayContext) => Promise<unknown>;

/**
 * 必要な認証レベル。
 *
 * ⚠️ 現状のPHPゲートウェイは Authorization ヘッダを読み込んでいるだけで
 *   検証していない（core/db.php の $authHeader は代入後どこからも参照されない）。
 *   認証を行っているのは requireStaff() を呼んでいる一部の新しいハンドラのみ。
 *
 *   つまり移植時に「PHPと完全に同じ挙動」を選ぶと、認証なしのまま
 *   顧客情報を返す口を Express 側にも作ることになる。
 *   ここを明示的に選べるようにしてある。
 *
 *   'none'   … 認証不要。移植元のPHPが認証していないもの
 *   'staff'  … Token ヘッダでスタッフを特定できることを要求する（PHP の requireStaff() 相当）
 *   'master' … さらに staff.brand === 'Master' を要求する（PHP の requireMaster() 相当）
 *
 * ⚠️ 'staff' / 'master' は GATEWAY_REQUIRE_AUTH に関係なく**常に検証する**。
 *   宣言したのに効かない状態が一番危険なため。
 *   GATEWAY_REQUIRE_AUTH は「'none' のエントリにも staff 認証を要求する」
 *   将来の一括強化スイッチとして使う。
 *
 * ⚠️ 移植元のPHPが認証していないものは必ず 'none' にすること。
 *   「せっかくだから厳しくする」をやると、これまで動いていた画面が突然 401 になる。
 */
export type GatewayAuth = 'none' | 'staff' | 'master';

/** 登録するエントリ1件 */
export interface GatewayEntry {
  /** 何をするものか。ルート一覧に出る */
  summary: string;
  /** 移植元のPHPファイル。対応を追えるようにしておく */
  phpSource: string;
  auth: GatewayAuth;
  handler: GatewayHandler;
}

/**
 * 登録キーの形式。
 *
 *   'menu'                    … request だけで一意なもの
 *   'list:tag'                … request:roll
 *   'list::order'             … request::category（roll なし）
 *   'database:gift:order'     … request:roll:category
 *
 * ⚠️ roll と category は片方だけ使われることがあるため、
 *   区切りを詰めずに '::' で空を表す。
 */
export type GatewayKey = string;

/** リクエストからキーを組み立てる。登録側・照合側で必ず同じ関数を使う */
export const gatewayKey = (request: string, roll: string, category: string): GatewayKey =>
  `${request}:${roll}:${category}`;
