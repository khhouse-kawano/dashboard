import type { Request, Response } from 'express';
import type { z } from 'zod';
import type { AuthenticatedStaff } from '../types/staff';

/**
 * ルート定義の型と、それを書くためのヘルパー `route()`。
 *
 * ここが「型推論の入口」で、route() にスキーマを渡すと
 * handler の引数（params / query / body）の型が自動で決まる。
 */

/** ハンドラに渡される実行コンテキスト */
export interface RouteContext {
  /** 認証済みスタッフ。`auth: true` のルートでは必ず入っている */
  staff: AuthenticatedStaff | undefined;
  /** 1リクエストに1つ振られるID。ログとエラーレスポンスの両方に載る */
  requestId: string;
  /** 逃げ道。ファイルアップロードなど特殊な処理でのみ使う */
  req: Request;
  res: Response;
}

/** スキーマ未指定のときは `undefined` 型になる */
type Infer<T> = T extends z.ZodType ? z.infer<T> : undefined;

export interface RouteHandlerArgs<TParams, TQuery, TBody> {
  /** URL のパスパラメータ（例: /customers/:id の :id） */
  params: TParams;
  /** クエリ文字列。値は必ず文字列で届くので z.coerce.* を使う */
  query: TQuery;
  /** リクエストボディ（POST / PUT / PATCH） */
  body: TBody;
  ctx: RouteContext;
}

/**
 * 認証方式。
 *
 * 'staff'       … ブラウザ向け。staff.api_token を Token ヘッダで受ける（`auth: true` と同じ）
 * 'analysisKey' … 機械向け。analysis_api_key を Authorization: Bearer で受ける。
 *                 Claude Desktop の MCP サーバーのような外部クライアント用で、
 *                 有効期限と失効を持つ点が staff.api_token と違う。
 */
export type AuthMode = 'staff' | 'analysisKey';

export interface RouteDefinition<
  TParams extends z.ZodType | undefined = undefined,
  TQuery extends z.ZodType | undefined = undefined,
  TBody extends z.ZodType | undefined = undefined,
> {
  /** 何をするルートか。必須。GET /api/v1/_routes の一覧に出る */
  summary: string;
  /**
   * 認証を要求する。true は 'staff'（ブラウザ向け）と同じ。
   * 外部クライアント向けのルートでは 'analysisKey' を指定する。
   */
  auth?: boolean | AuthMode;
  params?: TParams;
  query?: TQuery;
  body?: TBody;
  /** 成功時のHTTPステータス。省略時は 200（新規作成なら 201 を指定する） */
  status?: number;
  handler: (
    args: RouteHandlerArgs<Infer<TParams>, Infer<TQuery>, Infer<TBody>>
  ) => Promise<unknown>;
}

/**
 * ルートを1本定義する。
 *
 * @example
 * 'GET /:id': route({
 *   summary: '顧客を1件取得',
 *   auth: true,
 *   params: z.object({ id: z.coerce.number().int() }),
 *   handler: async ({ params }) => findCustomer(params.id), // params.id は number
 * })
 */
export const route = <
  TParams extends z.ZodType | undefined = undefined,
  TQuery extends z.ZodType | undefined = undefined,
  TBody extends z.ZodType | undefined = undefined,
>(
  definition: RouteDefinition<TParams, TQuery, TBody>
): RouteDefinition<TParams, TQuery, TBody> => definition;
