import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../errors/AppError';
import { requireAnalysisApiKey } from '../middlewares/apiKeyAuth';
import { analysisIpRateLimit, analysisKeyRateLimit } from '../middlewares/analysisRateLimit';
import { requireApiToken } from '../middlewares/auth';
import type { ErasedRoute, Feature, HttpMethod, RouteKey } from './feature';
import type { AuthMode, RouteContext } from './route';

/**
 * features を Express の Router に組み立てる。
 *
 * 各機能ファイルが宣言した内容から、
 *   URL の割り当て → 認証 → 入力バリデーション → 実行 → レスポンス整形
 * までを自動で行うため、機能追加時にルーターやコントローラを書く必要がない。
 */

const ROUTE_KEY_PATTERN = /^(GET|POST|PUT|PATCH|DELETE) (\/\S*)$/;

interface ParsedRouteKey {
  method: HttpMethod;
  path: string;
}

const parseRouteKey = (key: string): ParsedRouteKey => {
  const matched = ROUTE_KEY_PATTERN.exec(key);
  if (matched === null) {
    throw new Error(
      `ルート定義のキーが不正です: "${key}"　'GET /' や 'PATCH /:id' の形式で書いてください。`
    );
  }
  return { method: matched[1] as HttpMethod, path: matched[2] };
};

/**
 * 静的パスをパスパラメータより先に登録するための並べ替え。
 *
 * Express は登録順に照合するため、'/:no' を先に登録すると
 * '/latest' へのリクエストまで '/:no' が拾ってしまう。
 * 定義の順序に関係なく正しく動くよう、ここで吸収する。
 */
const countSegmentsWithParam = (path: string): number =>
  path.split('/').filter((segment) => segment.startsWith(':')).length;

const sortRouteKeys = (keys: string[]): string[] =>
  [...keys].sort((a, b) => {
    const pathA = parseRouteKey(a).path;
    const pathB = parseRouteKey(b).path;
    return countSegmentsWithParam(pathA) - countSegmentsWithParam(pathB);
  });

/** zod の検証結果を、そのまま JSON にできる形に落とす */
const toIssueList = (error: z.ZodError): Array<{ field: string; message: string }> =>
  error.issues.map((issue) => ({
    field: issue.path.length === 0 ? '(root)' : issue.path.join('.'),
    message: issue.message,
  }));

/** スキーマが指定されていれば検証し、なければ undefined を返す */
const validate = (
  schema: z.ZodType | undefined,
  value: unknown,
  source: 'params' | 'query' | 'body'
): unknown => {
  if (schema === undefined) return undefined;

  const result = schema.safeParse(value);
  if (!result.success) {
    throw AppError.badRequest('入力内容に誤りがあります', {
      source,
      issues: toIssueList(result.error),
    });
  }
  return result.data;
};

/** 1本のルート定義を Express のハンドラに変換する */
const toRequestHandler = (definition: ErasedRoute): RequestHandler => {
  return async (req, res) => {
    const ctx: RouteContext = {
      staff: req.staff,
      requestId: req.requestId,
      req,
      res,
    };

    const args = {
      params: validate(definition.params, req.params, 'params'),
      query: validate(definition.query, req.query, 'query'),
      body: validate(definition.body, req.body, 'body'),
      ctx,
    };

    const result = await definition.handler(args);

    // ハンドラが自分でレスポンスを送った場合（ファイルダウンロード等）は何もしない
    if (res.headersSent) return;

    if (result === undefined || result === null) {
      res.status(definition.status ?? 204).end();
      return;
    }

    res.status(definition.status ?? 200).json(result);
  };
};

export interface RouteSummary {
  feature: string;
  method: HttpMethod;
  path: string;
  /** false は認証なし。認証が要る場合は方式名を出す（'staff' / 'analysisKey'） */
  auth: false | AuthMode;
  summary: string;
}

/** ルート定義の auth 指定を、一覧に出す表記へ正規化する */
const toAuthSummary = (auth: ErasedRoute['auth']): false | AuthMode => {
  if (auth === undefined || auth === false) return false;
  return auth === true ? 'staff' : auth;
};

export interface BuiltRouter {
  router: Router;
  routes: RouteSummary[];
}

/** features 一覧から Router と、ルート一覧（自己ドキュメント用）を作る */
export const buildFeatureRouter = (features: Feature[]): BuiltRouter => {
  const router = Router();
  const routes: RouteSummary[] = [];
  const seen = new Set<string>();

  for (const feature of features) {
    const featureRouter = Router();
    const keys = sortRouteKeys(Object.keys(feature.routes));

    for (const key of keys) {
      const { method, path } = parseRouteKey(key);
      const definition = feature.routes[key as RouteKey];

      const fullPath = `${feature.basePath}${path === '/' ? '' : path}`;
      const signature = `${method} ${fullPath}`;
      if (seen.has(signature)) {
        throw new Error(`ルートが重複しています: ${signature}`);
      }
      seen.add(signature);

      // 認証方式ごとに前段のミドルウェアを差し替える。
      // true は 'staff'（ブラウザ向け）の別名として扱う。
      const middlewares: RequestHandler[] = [];
      if (definition.auth === true || definition.auth === 'staff') {
        middlewares.push(requireApiToken);
      } else if (definition.auth === 'analysisKey') {
        // 認証前にIPで粗く、認証後にキーで細かく制限する。この順序に意味がある
        middlewares.push(analysisIpRateLimit, requireAnalysisApiKey, analysisKeyRateLimit);
      }

      // Express 5 は async ハンドラ内の例外も errorHandler へ自動で流す
      const expressMethod = method.toLowerCase() as Lowercase<HttpMethod>;
      featureRouter[expressMethod](path, ...middlewares, toRequestHandler(definition));

      routes.push({
        feature: feature.name,
        method,
        path: `/api/v1${fullPath}`,
        auth: toAuthSummary(definition.auth),
        summary: definition.summary,
      });
    }

    router.use(feature.basePath, featureRouter);
  }

  return { router, routes };
};
