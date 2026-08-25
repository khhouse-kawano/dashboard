import type { z } from 'zod';
import type { RouteHandlerArgs } from './route';

/**
 * 「機能（feature）」＝ 1つのリソースに対する操作のまとまり。
 * 1ドメイン＝1ファイルで書き、features/index.ts に登録すれば
 * URL の割り当てもバリデーションも認証も自動で組み上がる。
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** `'GET /'` `'PATCH /:id'` のような形式のキー */
export type RouteKey = `${HttpMethod} /${string}`;

/**
 * 型引数を落としたルート表現（フレームワーク内部用）。
 *
 * 各ルートの入出力の型は route() を書いた時点で検証済みなので、
 * 登録・実行フェーズでは実行時に必要な情報だけを見ればよい。
 * handler の引数を any にしているのはこの型消去のためで、
 * このプロジェクトで any を意図的に使っている唯一の箇所。
 */
export interface ErasedRoute {
  summary: string;
  auth?: boolean;
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
  status?: number;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  handler: (args: RouteHandlerArgs<any, any, any>) => Promise<unknown>;
}

export interface Feature {
  /** 日本語の機能名。ルート一覧に出る */
  name: string;
  /** /api/v1 配下のベースパス。例: '/customers' */
  basePath: `/${string}`;
  routes: Record<RouteKey, ErasedRoute>;
}

/**
 * 機能を定義する。
 *
 * @example
 * export const customers = defineFeature({
 *   name: '顧客',
 *   basePath: '/customers',
 *   routes: {
 *     'GET /':    route({ summary: '一覧', ... }),
 *     'GET /:id': route({ summary: '1件取得', ... }),
 *   },
 * });
 */
export const defineFeature = (feature: Feature): Feature => feature;
