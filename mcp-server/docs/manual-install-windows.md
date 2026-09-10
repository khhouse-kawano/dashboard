# 分析MCPサーバー 手作業での移行手順（Windows / PowerShell）

`セットアップ.cmd` が動かない環境向けの手順。VS Code は使わない。

対象は **利用者のPC**。管理者権限は不要（ログインユーザーの領域にしか書き込まない）。

```
Claude Desktop ─(stdio)→ このMCPサーバー ─(HTTPS)→ ② VPS の分析API ─(SSH)→ 本番DB
```

---

## 全体像

| 誰が | どこで | やること |
|---|---|---|
| あなた（開発者） | 自分のPC | ビルドして配布用フォルダを作る |
| あなた（開発者） | ② VPS | 利用者専用のAPIキーを発行する |
| 利用者 | 利用者のPC | Node.js を入れ、ファイルを置き、設定を書く |

⚠️ **APIキーは1人1本。** 使い回すと、漏れたときに全員分を止めることになり、
監査ログでも誰の操作か分からなくなる。

---

## A. 【あなたのPC（PowerShell）】配布用フォルダを作る

```powershell
cd C:\Users\shinji-kawano\react\dashboard\mcp-server
npm install
npm run build
```

⚠️ `dist\index.js` ができていることを確認する。

```powershell
Test-Path .\dist\index.js
```

`True` が返ればよい。

配布に必要なのは次の3つだけ。

```powershell
$out = "$env:USERPROFILE\Desktop\khg-analysis-mcp"
New-Item -ItemType Directory -Force -Path $out | Out-Null
Copy-Item -Path .\dist -Destination $out -Recurse -Force
Copy-Item -Path .\package.json -Destination $out -Force
Copy-Item -Path .\package-lock.json -Destination $out -Force
Get-ChildItem $out
```

⚠️ **`node_modules` は入れない。** 利用者のPCで `npm install` させる
（OSやNodeのバージョンでネイティブ依存が変わる可能性があるため）。

⚠️ **`src` も `.env` 系も入れない。** 実行に不要であり、
配布物を増やすほど「どれが本物か」が分からなくなる。

zip にする。

```powershell
Compress-Archive -Path $out -DestinationPath "$env:USERPROFILE\Desktop\khg-analysis-mcp.zip" -Force
```

---

## B. 【② VPS】APIキーを発行する

対象者の `staff.id` を調べる。⚠️ **`brand = 'Master'` のスタッフにしか発行できない**
（CLIが権限を検証して弾く）。

【① レンタルサーバー】phpMyAdmin:

```sql
SELECT id, name, brand FROM staff WHERE brand = 'Master' ORDER BY id;
```

【② VPS で実行】:

```bash
dcp exec express-api node dist/cli/issueAnalysisKey.js --staff-id <ID> --label "<氏名> のPC" --days 365
```

⚠️ **`--days` を必ず指定する。** 省略すると無期限になり、退職者のキーが永久に残る。

⚠️⚠️ **キーは発行時にしか表示されない。** DBにはSHA-256ハッシュしか残らないので、
控え忘れたら再発行するしかない（DBが漏れても復元できない設計であり、正しい挙動）。

⚠️ 渡し方はパスワード管理ツール。**チャットやメールに貼らない。**

---

## C. 【利用者のPC】Node.js を入れる

Node 20 以降が必要。

1. https://nodejs.org/ から **LTS版** をダウンロードしてインストール
2. インストール後、**PowerShell を開き直す**（PATH が反映されない）

確認:

```powershell
node -v
```

⚠️ `v20.` 以上であること。`node : 用語 'node' は…認識されません` と出る場合は
PATH が通っていない。PowerShell を閉じて開き直す（それでも駄目ならサインアウト）。

---

## D. 【利用者のPC】ファイルを置く

### 置く場所

```
C:\Users\<ユーザー名>\AppData\Local\khg-analysis-mcp\
├── dist\
│   └── index.js
├── package.json
├── package-lock.json
└── node_modules\      ← 手順Eで作られる
```

⚠️ **`Documents` や `Desktop` に置かない。** 利用者がフォルダを整理したときに
移動・削除され、Claude Desktop から「ツールが出てこない」状態になる。
`AppData\Local` は普段目に入らないので事故が起きにくい。

⚠️ **OneDrive の同期対象に置かない。** `Documents` が OneDrive 配下だと
同期の一時ファイルで実行が不安定になる。

### PowerShell で展開する

zip を受け取ったら（ここでは `ダウンロード` にあるとする）:

```powershell
$dest = "$env:LOCALAPPDATA\khg-analysis-mcp"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Expand-Archive -Path "$env:USERPROFILE\Downloads\khg-analysis-mcp.zip" -DestinationPath "$env:TEMP\khg-mcp-tmp" -Force
Copy-Item -Path "$env:TEMP\khg-mcp-tmp\khg-analysis-mcp\*" -Destination $dest -Recurse -Force
Remove-Item -Path "$env:TEMP\khg-mcp-tmp" -Recurse -Force
Get-ChildItem $dest
```

確認:

```powershell
Test-Path "$env:LOCALAPPDATA\khg-analysis-mcp\dist\index.js"
```

⚠️ `True` が返ること。`False` なら zip の階層がずれている。
`Get-ChildItem $env:TEMP\khg-mcp-tmp -Recurse` で構造を確認してからコピーし直す。

---

## E. 【利用者のPC】必要な部品を入れる

```powershell
cd "$env:LOCALAPPDATA\khg-analysis-mcp"
npm install --omit=dev --no-audit --no-fund
```

1〜2分かかる。⚠️ `--omit=dev` を付けること（TypeScript など開発用は不要）。

確認:

```powershell
Test-Path ".\node_modules\@modelcontextprotocol\server"
Test-Path ".\node_modules\zod"
```

⚠️ 両方 `True` であること。失敗する場合は社内ネットワークの制限が原因のことが多い。

---

## F. 【利用者のPC】起動できるか単体で試す

Claude Desktop に登録する前に、ここで確かめる。設定ミスの切り分けが楽になる。

```powershell
$env:KHG_ANALYSIS_API_KEY = "khg_kpi_（受け取ったキー）"
$env:KHG_ANALYSIS_API_URL = "https://api.khg-marketing.info"
node "$env:LOCALAPPDATA\khg-analysis-mcp\dist\index.js"
```

⚠️ **何も表示されずに止まって見えるのが正常。** MCPサーバーは標準入力からの
指示を待っているだけで、起動メッセージを出さない。

`Ctrl` + `C` で終了する。

| 出た表示 | 意味 |
|---|---|
| 何も出ずに待つ | ✅ 正常 |
| `KHG_ANALYSIS_API_KEY` に関するエラーで即終了 | キーが未設定。手順を見直す |
| `Cannot find module` | 手順E（`npm install`）が済んでいない |

⚠️ この `$env:` はそのPowerShellウィンドウの中だけの一時的な設定。
閉じれば消える。Claude Desktop 用の設定は次の手順Gで別に書く。

---

## G. 【利用者のPC】Claude Desktop に登録する

### 設定ファイルの場所

```
C:\Users\<ユーザー名>\AppData\Roaming\Claude\claude_desktop_config.json
```

PowerShell で開く:

```powershell
notepad "$env:APPDATA\Claude\claude_desktop_config.json"
```

⚠️ **ファイルが無い場合**は、フォルダを作ってから空のファイルを作る。

```powershell
New-Item -ItemType Directory -Force -Path "$env:APPDATA\Claude" | Out-Null
if (-not (Test-Path "$env:APPDATA\Claude\claude_desktop_config.json")) {
    '{}' | Out-File -FilePath "$env:APPDATA\Claude\claude_desktop_config.json" -Encoding utf8
}
notepad "$env:APPDATA\Claude\claude_desktop_config.json"
```

### バックアップを取る（⚠️ 既にファイルがある場合は必須）

```powershell
$cfg = "$env:APPDATA\Claude\claude_desktop_config.json"
Copy-Item $cfg "$cfg.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
```

### 書く内容

**中身が `{}` だけの場合**は、これを全部貼る。

```json
{
  "mcpServers": {
    "khg-analysis": {
      "command": "node",
      "args": ["C:\\Users\\<ユーザー名>\\AppData\\Local\\khg-analysis-mcp\\dist\\index.js"],
      "env": {
        "KHG_ANALYSIS_API_URL": "https://api.khg-marketing.info",
        "KHG_ANALYSIS_API_KEY": "khg_kpi_（受け取ったキー）"
      }
    }
  }
}
```

**既に `mcpServers` がある場合**は、その中に `"khg-analysis": { ... }` を足す。
⚠️ 直前の項目の末尾に `,` を付け忘れないこと。

### ⚠️ 書き方で間違えやすい3点

| 誤り | 正しい |
|---|---|
| `"args": ["C:\Users\..."]` | `\` を2つ重ねる → `"C:\\Users\\..."` |
| `<ユーザー名>` のまま | 実際のユーザー名に置き換える |
| キーが `khg_kpi_` だけ | `khg_kpi_` の**後ろに43文字続く**。全体を貼る |

ユーザー名が分からないときは次で確認できる。

```powershell
echo $env:USERNAME
```

パスをそのまま作りたい場合は、これを実行して出力をコピーする。

```powershell
"$env:LOCALAPPDATA\khg-analysis-mcp\dist\index.js".Replace('\','\\')
```

### 保存

メモ帳で `Ctrl` + `S`。

⚠️ **文字コードは UTF-8 で保存する。** メモ帳の「名前を付けて保存」で
文字コードを変えてしまうと、Claude Desktop がJSONを読めなくなる。
上書き保存（`Ctrl` + `S`）なら元のままなので問題ない。

保存後、JSONとして壊れていないか確認する。

```powershell
Get-Content "$env:APPDATA\Claude\claude_desktop_config.json" -Raw | ConvertFrom-Json
```

⚠️ エラーが出なければOK。出た場合はカンマや括弧の対応が崩れている。

---

## H. 【利用者のPC】Claude Desktop を再起動する

⚠️⚠️ **ウィンドウの × では反映されない。** 設定ファイルは起動時にしか読まれず、
× では常駐が残る。

**確実な方法（PowerShell）:**

```powershell
Stop-Process -Name Claude -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
Start-Process "$env:LOCALAPPDATA\AnthropicClaude\claude.exe"
```

⚠️ パスが違う場合は次で探す。

```powershell
Get-ChildItem "$env:LOCALAPPDATA" -Filter claude.exe -Recurse -Depth 3 -ErrorAction SilentlyContinue | Select-Object FullName
```

**手作業でやる場合:**
画面右下のタスクトレイの Claude アイコンを右クリック →「終了」→ 改めて起動。

---

## I. 動作確認

Claude Desktop で次のように聞く。

```
分析APIで使える集計軸と指標を教えて
```

⚠️ **集計軸と指標の一覧が返れば成功。**

他にも試せる質問:

- 「注文事業の歩留まりを教えて」
- 「宮崎営業課の今年の契約率は？」
- 「追客漏れがありそうな店舗はある？」

---

## つまずいたとき

| 症状 | 原因 | 対処 |
|---|---|---|
| ツールが1つも出てこない | 設定ファイルのJSONが壊れている | 手順Gの `ConvertFrom-Json` で確認 |
| 同上 | Claude Desktop を × で閉じただけ | 手順Hでプロセスから終了させる |
| 同上 | `args` のパスが違う／`\` が1つ | 手順Gの `.Replace('\','\\')` で作り直す |
| 同上 | `node` が PATH に無い | PowerShell を開き直す。`node -v` で確認 |
| ツールが常に失敗する | APIキーが違う・失効している | 手順Fで単体起動して確認。それでも駄目なら再発行 |
| `Cannot find module` | `npm install` が未実行 | 手順E |
| 応答が返らない | ② VPS が停止している | 【②】`dcp ps` で caddy と express-api を確認 |

### ログの見方

Claude Desktop のMCPログはここにある。

```powershell
Get-ChildItem "$env:APPDATA\Claude\logs" | Sort-Object LastWriteTime -Descending | Select-Object -First 5
Get-Content "$env:APPDATA\Claude\logs\mcp-server-khg-analysis.log" -Tail 40
```

⚠️ MCPサーバーは stdout に JSON-RPC を流すため、ログは stderr に出している。
上のファイルに出ているのがその内容。

---

## 移行後の後片付け

⚠️ **前の人のPCで使わなくなったなら、そのキーを失効させる。**
放置すると、退職・異動後もそのPCから本番DBの集計が引ける状態が残る。

キーの一覧（【①】phpMyAdmin）:

```sql
SELECT id, staff_id, label, created_at, expires_at, revoked_at, last_used_at
  FROM analysis_api_key ORDER BY id;
```

失効:

```sql
UPDATE analysis_api_key SET revoked_at = NOW() WHERE id = <id>;
```
