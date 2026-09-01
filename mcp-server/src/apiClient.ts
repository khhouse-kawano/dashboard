/**
 * 分析API（VPS上の Express）を叩く薄いクライアント。
 *
 * MCPサーバーはマネージャーのPC上で動き、ここからHTTPSでVPSに問い合わせる。
 * 認証情報はこのプロセスの環境変数にしか無く、Claude Desktop からは見えない。
 */

/** 設定。起動時に環境変数から読み、欠けていればその場で落とす */
export interface Config {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export const loadConfig = (): Config => {
  const baseUrl = process.env.KHG_ANALYSIS_API_URL ?? 'https://api.khg-marketing.info';
  const apiKey = process.env.KHG_ANALYSIS_API_KEY;

  if (apiKey === undefined || apiKey.trim() === '') {
    // ⚠️ ここで落とすのは意図的。
    //   キーが無いまま起動すると、Claude Desktop 上では「ツールが常に失敗する」
    //   という分かりにくい症状になる。起動時に落とせば設定ファイルの
    //   書き間違いだとすぐ気づける。
    throw new Error(
      '環境変数 KHG_ANALYSIS_API_KEY が設定されていません。' +
        'claude_desktop_config.json の env に、発行されたAPIキーを設定してください。'
    );
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    apiKey: apiKey.trim(),
    // 重い集計は数十秒かかることがある。既定のfetchは無制限に待つため明示的に切る
    timeoutMs: Number(process.env.KHG_ANALYSIS_TIMEOUT_MS ?? 120_000),
  };
};

/** APIのエラーレスポンス。Express の errorHandler が返す形 */
interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

/**
 * 分析APIのGETを叩く。
 *
 * ⚠️ エラーの本文をそのまま Claude に返すこと。
 *   「指定できるのは month / store / …」のようにAPIが理由を日本語で返すため、
 *   Claude はそれを読んで自分でパラメータを直せる。
 *   ここで握りつぶして「失敗しました」に変えると、その手がかりが消える。
 */
export const getJson = async (
  config: Config,
  path: string,
  params: Record<string, string | undefined>
): Promise<unknown> => {
  const url = new URL(`${config.baseUrl}/api/v1/analysis/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      // TLS終端のプロキシがHTMLのエラーページを返す場合などに備える
      throw new Error(
        `分析APIが JSON 以外を返しました（HTTP ${response.status}）: ${text.slice(0, 300)}`
      );
    }

    if (!response.ok) {
      const apiError = (body as ApiErrorBody).error;

      // ⚠️ details まで含めて返すこと。
      //   バリデーションエラーの details には「指定できるのは month / store / …」という
      //   正しい選択肢が入っている。message だけだと「入力内容に誤りがあります」しか
      //   伝わらず、Claude は何を直せばよいのか分からないまま同じ失敗を繰り返す。
      const detail =
        apiError?.details === undefined ? '' : `\n詳細: ${JSON.stringify(apiError.details)}`;
      const message = `${apiError?.message ?? text.slice(0, 300)}${detail}`;

      if (response.status === 401) {
        throw new Error(
          `認証に失敗しました: ${message}。APIキーが失効している、または有効期限切れの可能性があります。管理者に再発行を依頼してください。`
        );
      }
      if (response.status === 429) {
        throw new Error(`${message}（レート制限）`);
      }
      // 400 は「軸の指定が違う」など、呼び出し側で直せる内容。理由をそのまま渡す
      throw new Error(`分析APIがエラーを返しました（HTTP ${response.status}）: ${message}`);
    }

    return body;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `分析APIの応答が ${config.timeoutMs / 1000} 秒以内に返りませんでした。集計の軸を減らすか期間を絞ってください。`
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
