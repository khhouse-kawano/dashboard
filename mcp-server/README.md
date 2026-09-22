# 分析MCPサーバー

Claude Desktop から注文事業のKPI・歩留まりを日本語で問い合わせるための MCP サーバー。

```
Claude Desktop ─(stdio)→ このプロセス ─(HTTPS)→ VPS の分析API ─(SSH)→ 本番DB
```

マネージャーのPC上で動く **ローカルMCP（stdio）** です。

## なぜローカルMCPなのか

Claude Desktop のカスタムコネクタ（リモートMCP）は **OAuth が必須**で、静的な
Bearer トークンを設定するUIがありません。接続時に必ず OAuth の動的クライアント登録を
行うため、対応するには認可サーバーを別途用意する必要があります。

MCP仕様上も、stdio トランスポートはこの認可仕様の対象外で、認証情報は環境変数から
取得してよいと明記されています。5名で使う社内ツールに認可サーバーを建てるのは
釣り合わないため、stdio を選びました。

---

## セットアップ（マネージャーのPCで1回だけ）

### 1. Node.js を入れる

Node 20 以降が必要です。`node -v` で確認してください。

### 2. このディレクトリを配置してビルド

```bash
cd mcp-server
npm install
npm run build
```

### 3. Claude Desktop に登録

設定ファイルを開きます。

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

次の内容を追記します（`mcpServers` が既にあればその中に足す）。

```json
{
  "mcpServers": {
    "khg-analysis": {
      "command": "node",
      "args": ["C:\\path\\to\\dashboard\\mcp-server\\dist\\index.js"],
      "env": {
        "KHG_ANALYSIS_API_URL": "https://api.khg-marketing.info",
        "KHG_ANALYSIS_API_KEY": "khg_kpi_ここに発行されたキー"
      }
    }
  }
}
```

⚠️ `args` のパスは**絶対パス**で、Windows では `\` を `\\` と書きます。
⚠️ APIキーは1人1本です。使い回すと誰の操作か追えなくなり、1人分だけ止めることも
できなくなります。

登録後、Claude Desktop を再起動してください。

### 4. 動作確認

Claude Desktop で次のように聞いてみてください。

- 「注文事業の歩留まりを教えて」
- 「宮崎営業課の今年の契約率は？」
- 「媒体別で契約までの日数を比較して」
- 「追客漏れがありそうな店舗はある？」
- 「どの競合に負けている？ 敗因は？」
- 「競合との勝敗を分析して、HTMLのレポートにして保存して」

---

## 提供するツール

| ツール | 用途 |
|---|---|
| `list_analysis_dimensions` | 使える軸・指標の一覧とデータ品質の注意点。他のツールの前に必ず呼ばれる |
| `get_funnel` | 反響→通電→初回面談→第二面談→事前審査→契約 の件数と転換率 |
| `query_analysis_pivot` | 軸と指標を指定した汎用集計 |
| `get_unsynced_inquiries` | 追客漏れの可能性がある反響 |
| `get_competitor_deals` | 競合との勝敗（**顧客1件ごと**。個人情報は伏字） |
| `get_report_spec` | レポートHTMLの書き方と保存のしかた |
| `save_analysis_report` | 書き上げたHTMLをダッシュボードに保存する |
| `list_analysis_reports` | 保存済みレポートの一覧（本文なし） |
| `get_analysis_report` | 保存済みレポートを1件、本文つきで読む |

各ツールの `description` には、Claude が数字を読み違えないための注意書きを
日本語で入れてあります（「転換率の分母はすべて反響数」「直近3ヶ月は成果が
出揃っていない」「未同期リードを他の集計と足してはいけない」など）。

**この説明文が Claude の判断材料そのものです。** 集計の意味が変わる変更をしたときは、
必ず `src/index.ts` の `description` も直してください。

---

## 競合分析レポートの作り方（v2.2.141 で追加）

ダッシュボードの「他社動向 → Claudeによる競合分析」に出る HTML は、**ここから作ります**。

```
Claude Desktop で
  「競合との勝敗を分析して、HTMLのレポートにして保存して」
    ↓ get_competitor_deals     … 顧客1件ごとのデータ（個人情報は伏字）
    ↓ get_report_spec          … 体裁の決まり
    ↓ （Claudeが推論してHTMLを書く）
    ↓ save_analysis_report     … 保存
ダッシュボード → 他社動向 → Claudeによる競合分析 に出る
```

**推論は利用者自身の Claude アカウントで行われます。** 会社のAPIキーは使わないため、
ダッシュボード側に課金は発生しません。画面は保存済みのHTMLを出すだけです。

注意点:

- `get_competitor_deals` は**集計値ではなく生の行**を返す唯一のツールです。
  1回で 15,000 トークン前後（12ヶ月なら 70,000 前後）になります。`months` を必要以上に広げないこと。
- `save_analysis_report` は**上書きではなく毎回1件増えます**。全社が見る画面に出るため、
  利用者が「保存して」と言うまで保存しないよう description に書いてあります。
- 保存されたHTMLは画面で `sandbox="allow-scripts"` の iframe に閉じ込めて表示します。
  **サーバー側では中身を検査していません。**

---

## 環境変数

| 変数 | 既定値 | 説明 |
|---|---|---|
| `KHG_ANALYSIS_API_KEY` | （必須） | 発行されたAPIキー。未設定なら起動時に落ちる |
| `KHG_ANALYSIS_API_URL` | `https://api.khg-marketing.info` | 分析APIのURL。ローカル検証時は `http://localhost:3001` |
| `KHG_ANALYSIS_TIMEOUT_MS` | `120000` | 応答待ちの上限 |

キーが未設定のとき、あえて起動時に落としています。そのまま起動すると Claude Desktop 上では
「ツールが常に失敗する」という分かりにくい症状になり、設定ミスに気づきにくいためです。

---

## 開発

```bash
npm run dev        # tsx で直接実行
npm run typecheck  # 型検査のみ
```

ローカルのExpressに繋いで試すとき:

```bash
KHG_ANALYSIS_API_URL=http://localhost:3001 KHG_ANALYSIS_API_KEY=<キー> npm run dev
```

⚠️ **stdout に `console.log` を書かないこと。** MCP のJSON-RPCが流れる経路なので、
1行でも混ざるとパースが壊れ、Claude Desktop からは「サーバーが応答しない」ように
見えます。ログは `console.error`（stderr）に出してください。
