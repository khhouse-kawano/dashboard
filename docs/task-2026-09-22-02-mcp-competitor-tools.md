# MCP サーバーに競合分析とレポート保存の道具を足す（v2.2.142）

⚠️ 指示:

> Docker起動済み
> 残りの処理を済ませてMCPサーバーもローカルに実装できるよう準備を

> ついでにv2.2.142に変更を

⚠️ ⚠️ **v2.2.141 で ② に口を用意しただけだった部分**（`deploy-v2.2.141.md` 手順7）を、
⚠️ **実際に Claude Desktop から呼べるところまで仕上げた。**

---

## ⚠️ どこまでが v2.2.141 で、どこからが v2.2.142 か

| | 版 | 状態 |
|---|---|---|
| ② の `/analysis/competitor`・`/analysis/report` | v2.2.141 | ⚠️ 口だけ出来ていた |
| 画面（他社動向 → Claudeによる競合分析） | v2.2.141 | 出来ていた |
| ⚠️ **MCP サーバーの道具** | ⚠️ **v2.2.142** | ⚠️ **今回** |

⚠️ ⚠️ **サーバー（①②）の変更は今回は無い。**
⚠️ 触ったのは ⚠️ **利用者のPCで動く MCP サーバー**と、⚠️ **版の表示**だけである。

---

## ⚠️ 触ったファイル

| ディレクトリ | ファイル | 種別 |
|---|---|---|
| `mcp-server/src/` | ⚠️ **`index.ts`** | ⚠️ **道具を5本追加**（`send` も追加） |
| 同上 | ⚠️ **`apiClient.ts`** | ⚠️ **`postJson()` を追加** |
| `mcp-server/` | `README.md` | ⚠️ 道具の一覧とレポートの作り方を追記 |
| `mcp-server/scripts/` | `はじめにお読みください.txt` | ⚠️⚠️ **「集計値だけ」という記述を直した**（後述） |
| `frontend/src/utils/` | `version.ts` | `2.2.141` → ⚠️ **`2.2.142`** |
| `backend/scripts/sql/` | ⚠️ **`2026-09-22_update_log_2.2.142.sql`** | ⚠️ **新規** |
| `docs/` | `deploy-v2.2.141.md` | ⚠️ 手順7 を「v2.2.142 で実施」に直した |

---

## ⚠️ 1. 追加した道具（5本）

| 道具 | 呼ぶ先 | 用途 |
|---|---|---|
| ⚠️ **`get_competitor_deals`** | `GET /analysis/competitor` | ⚠️ **顧客1件ごとのデータ**（伏字済み） |
| `get_report_spec` | `GET /analysis/report/spec` | ⚠️ HTML の書き方 |
| ⚠️ **`save_analysis_report`** | ⚠️ **`POST /analysis/report`** | ⚠️ **HTML の保存** |
| `list_analysis_reports` | `GET /analysis/report` | 一覧（本文なし） |
| `get_analysis_report` | `GET /analysis/report/:no` | 1件（本文つき） |

⚠️ これで ⚠️ **既存の4本と合わせて9本**になった。

### ⚠️ 流れ

```
Claude Desktop（⚠️ 各自のアカウント）
  「競合との勝敗を分析して、HTMLのレポートにして保存して」
    ↓ get_competitor_deals   … ⚠️ 顧客1件ごと（⚠️ 個人情報は伏字）
    ↓ get_report_spec        … ⚠️ 体裁の決まり
    ↓ （⚠️ ここで推論。⚠️⚠️ **費用は各自のアカウント**）
    ↓ save_analysis_report   … 保存
ダッシュボード → 他社動向 → Claudeによる競合分析
```

---

## ⚠️ 2. description に書いたこと（⚠️ **ここが実装の中身**）

⚠️⚠️ **Claude Desktop には画面の文脈が無い。**
⚠️ `description` が ⚠️ **Claude が読む唯一の説明**なので、ここに書いていないことは守られない。

| 道具 | ⚠️ 特に書いた注意 |
|---|---|
| `get_competitor_deals` | ⚠️ **これだけ集計値ではなく生の行**／⚠️ **truncated のとき勝率を語らない**／⚠️ **`own_group` は自社なので競合に数えない**／⚠️ **`****` の中身を推測しない**／⚠️ `months` を広げない |
| `get_report_spec` | ⚠️ **書き始める前に必ず1度呼ぶ** |
| `save_analysis_report` | ⚠️⚠️ **利用者が「保存して」と言うまで保存しない**（⚠️ 全社が見る画面に出るため）／⚠️ **上書きではなく毎回1件増える** |
| `get_analysis_report` | ⚠️ **本文は60KB前後**。⚠️ 一覧で足りるなら呼ばない |

---

## ⚠️ 3. 直した記述（⚠️ **利用者向けの案内**）

⚠️ `mcp-server/scripts/はじめにお読みください.txt` に、こう書いてあった。

> ・返ってくるのは集計された数値だけです。
>   お客様の氏名・連絡先・住所は含まれません。

⚠️⚠️ **今回の `get_competitor_deals` で、これが正しくなくなった。**
⚠️ 返るのは ⚠️ **商談1件ごとの記録**である（⚠️ 個人情報は取り除いてある）。

⚠️ ⚠️ **案内が実態より安全側に読めるまま残るのがいちばん危ない**ので、書き直した。

---

## ⚠️ 4. 追加した関数（全文）

### ⚠️ 4-1. `mcp-server/src/apiClient.ts` に追加した `postJson()`

⚠️ ⚠️ **既存の `getJson()` には手を入れていない。**
⚠️ 送る本文が60KB前後になるため、⚠️ **別の関数として足した。**

```ts
/**
 * 分析APIのPOSTを叩く。いまはレポート（HTML）の保存だけが使う。
 *
 * ⚠️ GETと分けてあるのは、送る本文が大きいため。
 *   レポート1件は60KB前後になるので、タイムアウトを別に取れるようにしてある。
 */
export const postJson = async (
  config: Config,
  path: string,
  payload: unknown
): Promise<unknown> => {
  const url = new URL(`${config.baseUrl}/api/v1/analysis/${path}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(
        `分析APIが JSON 以外を返しました（HTTP ${response.status}）: ${text.slice(0, 300)}`
      );
    }

    if (!response.ok) {
      const apiError = (body as ApiErrorBody).error;
      const detail =
        apiError?.details === undefined ? '' : `\n詳細: ${JSON.stringify(apiError.details)}`;
      const message = `${apiError?.message ?? text.slice(0, 300)}${detail}`;

      if (response.status === 401) {
        throw new Error(
          `認証に失敗しました: ${message}。APIキーが失効している可能性があります。管理者に再発行を依頼してください。`
        );
      }
      // 413 相当（HTMLが大きすぎる）は本文に上限が書いてあるので、そのまま渡す
      throw new Error(`分析APIがエラーを返しました（HTTP ${response.status}）: ${message}`);
    }

    return body;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `分析APIの応答が ${config.timeoutMs / 1000} 秒以内に返りませんでした。HTMLが大きすぎないか確認してください。`
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};
```

### ⚠️ 4-2. `mcp-server/src/index.ts` に追加した `send()`

⚠️ 既存の `call()`（GET用）と同じく、⚠️ **例外を必ずツールエラーに変換する。**

```ts
/** 保存系の実行部。GETと同じく例外をツールエラーに変換する */
const send = async (path: string, payload: unknown) => {
  try {
    return asToolResult(await postJson(config, path, payload));
  } catch (error) {
    return asToolError(error);
  }
};
```

### ⚠️ 4-3. `mcp-server/src/index.ts` に追加した道具5本（全文）

```ts
// ---------------------------------------------------------------------------
// 5. 競合分析（顧客1件ごと）
// ---------------------------------------------------------------------------

server.registerTool(
  'get_competitor_deals',
  {
    title: '競合との勝敗（顧客1件ごと）',
    description:
      '競合の記録がある商談を、顧客1件ごとに返す。契約（win）と失注（lost）の両方が入っており、' +
      '他社名・失注理由・面談メモ・予算帯・土地の有無が付いている。' +
      '\n\n「どの会社に負けているか」「なぜ負けたのか」「勝ちパターンは何か」' +
      'といった、集計値では答えられない質問に使う。' +
      '\n\n⚠️ 他のツールと違い、これだけは集計値ではなく生の行を返す。' +
      '行数が多いので、months を必要以上に広げないこと（既定の12ヶ月で足りることが多い）。' +
      '\n\n⚠️ 応答の meta にある「データ品質の注意点」を必ず読むこと。' +
      'とくに counts.truncated が true のときは全件ではないため、' +
      'ここから勝率を出して全社の実力値として語ってはならない。' +
      '\n\n⚠️ own_group は国分ハウジンググループ自身の社名で、競合ではない。勝敗に数えないこと。' +
      '\n\n⚠️ memo の **** は伏字（個人情報）である。中身を推測しないこと。',
    inputSchema: z.object({
      division: z
        .enum(['order', 'kaeru'])
        .optional()
        .describe('order = 注文事業（既定） / kaeru = 建売分譲事業'),
      months: z
        .number()
        .int()
        .min(1)
        .max(36)
        .optional()
        .describe('さかのぼる月数。既定は12。24を超えると古すぎて打ち手に使えない'),
    }),
  },
  async (args) =>
    call('competitor', {
      division: args.division,
      months: args.months === undefined ? undefined : String(args.months),
    })
);

// ---------------------------------------------------------------------------
// 6. レポート（HTML）
// ---------------------------------------------------------------------------

server.registerTool(
  'get_report_spec',
  {
    title: 'レポートHTMLの書き方',
    description:
      '分析レポートを HTML で書くときの決まり（1ファイル完結・外部読み込み禁止・必ず書くこと・' +
      '書いてはいけないこと）と、保存のしかたを返す。' +
      '\n\n⚠️ 「HTMLで出力して」「レポートにまとめて」と言われたら、書き始める前に必ず1度呼ぶこと。' +
      'ここで体裁をそろえておかないと、過去の分析と読み比べられなくなる。',
    inputSchema: z.object({}),
  },
  async () => call('report/spec', {})
);

server.registerTool(
  'save_analysis_report',
  {
    title: 'レポート（HTML）を保存する',
    description:
      '書き上げた分析レポートの HTML をダッシュボードに保存する。保存すると' +
      '「他社動向 → Claudeによる競合分析」から誰でも開けるようになる。' +
      '\n\n⚠️ 呼ぶ前に get_report_spec を読むこと。体裁の決まりがある。' +
      '\n\n⚠️ 上書きではなく毎回1件増える。作り直すたびに古い版も残る。' +
      '\n\n⚠️ 利用者が「保存して」と言っていないのに勝手に保存しないこと。' +
      '全社が見る画面に出るため。',
    inputSchema: z.object({
      title: z.string().describe('一覧に出す見出し。例: 競合別 勝因・敗因分析（2026年5月期）'),
      html: z.string().describe('HTMLの全文。1ファイルで完結していること'),
      category: z.string().optional().describe("分析の種類。いまは 'competitor' のみ（既定）"),
      division: z
        .enum(['order', 'kaeru', ''])
        .optional()
        .describe("'order' = 注文事業 / 'kaeru' = 建売分譲事業 / '' = 全社"),
      period: z.string().optional().describe('分析の対象期間。例: 2025/06〜2026/05'),
      dataAsOf: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式')
        .optional()
        .describe(
          'データを取得した日。⚠️ 画面に常時表示され、読む人が最新だと誤解しないための表示に使う'
        ),
    }),
  },
  async (args) =>
    send('report', {
      title: args.title,
      html: args.html,
      category: args.category,
      division: args.division,
      period: args.period,
      dataAsOf: args.dataAsOf,
    })
);

server.registerTool(
  'list_analysis_reports',
  {
    title: '保存済みレポートの一覧',
    description:
      'ダッシュボードに保存されている分析レポートの一覧を返す（本文は含まない）。' +
      '\n\n「前回はどう分析したか」「いつのデータで作ったか」を確かめるときに使う。' +
      '本文を読みたいときは get_analysis_report を呼ぶこと。',
    inputSchema: z.object({
      category: z.string().optional().describe("種類で絞る。例: competitor"),
    }),
  },
  async (args) => call('report', { category: args.category })
);

server.registerTool(
  'get_analysis_report',
  {
    title: '保存済みレポートを1件読む',
    description:
      '保存済みの分析レポートを本文（HTML）つきで1件返す。' +
      '\n\n⚠️ 本文は60KB前後ある。前回の内容を踏まえて書き直すときだけ呼ぶこと。' +
      '一覧を見たいだけなら list_analysis_reports で足りる。',
    inputSchema: z.object({
      no: z.number().int().positive().describe('レポート番号。list_analysis_reports で確認する'),
    }),
  },
  async (args) => call(`report/${args.no}`, {})
);
```

---

## ⚠️ 5. 動作確認（2026-09-22・ローカル）

⚠️ ⚠️ **MCP サーバーを stdio で実際に起動し、JSON-RPC を流して確かめた。**
⚠️ HTTP を叩いただけではなく、⚠️ **Claude Desktop と同じ経路**である。

| 確認 | 結果 |
|---|---|
| `tools/list` | ⚠️ **9本** すべて出た |
| `get_report_spec` | ⚠️ **OK**（1,483文字） |
| ⚠️ **`get_competitor_deals`**（order・3ヶ月） | ⚠️ **OK**。318件（勝ち76 / 負け242）・⚠️ **約15,000トークン** |
| `save_analysis_report` | ⚠️ **OK**（`no` が返る） |
| `list_analysis_reports` | ⚠️ **OK** |
| `get_analysis_report` | ⚠️ **OK**（本文つき） |
| `npm run build`（mcp-server） | ⚠️ **エラー0件** |

⚠️ 検証に使った API キーは ⚠️ **一時的に作り、確認後に削除した**。⚠️ **値はどこにも書き出していない。**
⚠️ テストで保存したレポートも ⚠️ **削除済み**。

⚠️ ⚠️ **Claude は一度も呼んでいない**（⚠️ 道具の疎通だけを見た。課金なし）。

---

## ⚠️ 6. 配り方（⚠️ **サーバーの作業ではない**）

⚠️⚠️ **MCP サーバーは利用者のPCで動く。** ⚠️ ①②のデプロイとは別である。

```powershell
cd C:\Users\shinji-kawano\react\dashboard\mcp-server
npm install
npm run build
```

⚠️ 既に配った人には ⚠️ **`dist` フォルダを差し替えてもらい、Claude Desktop を再起動**してもらう。
⚠️ ⚠️ **`claude_desktop_config.json` は書き換え不要**（接続先もキーも変わっていない）。

⚠️ ⚠️ **② に v2.2.141 が入っているのが前提。** ⚠️ 入っていないと `/analysis/competitor` が 404 になる。

---

## ⚠️ 未実施

- [ ] ⚠️ **Claude Desktop での実地確認**（⚠️ 実際に推論させてレポートを保存する）
- [ ] ⚠️ 保存したレポートが画面（他社動向 → Claudeによる競合分析）に出るか
- [ ] ⚠️ v2.2.141 のデプロイ（⚠️ **こちらが先**）

---

## ⚠️ 申し送り

| # | 内容 |
|---|---|
| 1 | ⚠️⚠️ **`get_competitor_deals` は生の行を返す唯一の道具**。⚠️ 監査ログ（`analysis_query_log`）で誰が引いたか必ず追えるようにしておくこと |
| 2 | ⚠️ 12ヶ月だと ⚠️ **約74,000トークン**。⚠️ 各自のアカウントの上限に当たる可能性がある |
| 3 | ⚠️ `consulting` 権限で全レスポンスを伏字にする件（⚠️ **まだ**） |
