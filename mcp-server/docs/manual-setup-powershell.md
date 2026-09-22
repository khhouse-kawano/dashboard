# 分析MCP セットアップ手順（PowerShell・1コマンドずつ）

⚠️⚠️ **`セットアップ.cmd` は使わない。**
⚠️ 2026-09-22、⚠️ **別のPCへ移行したときにまったく動かなかった**ため、
⚠️ ⚠️ **すべて利用者の手で、1コマンドずつ実行する形にした。**

⚠️ ⚠️ **複数行をまとめて貼らないこと。** ⚠️ 想定外の動きをする。
⚠️ **1行ずつ貼って Enter、出た結果を確かめてから次へ進む。**

---

## ⚠️ 事前に

| 要るもの | |
|---|---|
| Node.js 20 以上 | ⚠️ 入っていなければ https://nodejs.org/ の LTS |
| ⚠️ **展開済みのフォルダ** | ⚠️ `khg-analysis-mcp-offline.zip` を展開したもの（⚠️ **`node_modules` 入り**） |
| APIキー | ⚠️ `khg_kpi_` で始まる文字列 |

⚠️⚠️ **PowerShell は「Windows PowerShell」を1つだけ開き、最後まで同じ窓で行う。**
⚠️ ⚠️ **窓を閉じると、途中で作った `$dir` などが消える。**

⚠️ 開き方: スタートメニューで `powershell` と入力 → **Windows PowerShell**

---

## 手順1　Node.js を確かめる

```powershell
node -v
```

⚠️ **`v20.x` 以上**が出ればよい。
⚠️ ⚠️ **「認識されていません」なら Node.js を入れるところから。**

---

## 手順2　展開したフォルダの場所を控える

⚠️ エクスプローラーで展開したフォルダ（中に `dist` と `node_modules` があるもの）を開き、
⚠️ **アドレス欄をクリックしてパスをコピー**する。

⚠️ ⚠️ **下の `ここに貼る` を、そのパスに置き換えて**実行する。

```powershell
$src = "ここに貼る"
```

⚠️ 例: `$src = "C:\Users\user\Documents\khg-analysis-mcp-offline\khg-analysis-mcp-offline"`

---

## 手順3　中身があるか確かめる

```powershell
Test-Path "$src\dist\index.js"
```

⚠️ **`True`** が出ること。

```powershell
Test-Path "$src\node_modules\zod\package.json"
```

⚠️ ⚠️ **`True`** が出ること。
⚠️ **`False` なら展開したフォルダが1つ深い（または浅い）**。手順2からやり直す。

---

## 手順4　設置先を決める

```powershell
$dir = "$env:LOCALAPPDATA\khg-analysis-mcp"
```

```powershell
New-Item -ItemType Directory -Force -Path $dir
```

⚠️ フォルダの情報が表示される（既にあってもよい）。

---

## 手順5　ファイルを設置する

```powershell
Copy-Item "$src\*" $dir -Recurse -Force
```

⚠️ 何も表示されなければ成功。

```powershell
Test-Path "$dir\dist\index.js"
```

```powershell
Test-Path "$dir\node_modules\zod\package.json"
```

⚠️ ⚠️ **両方 `True`** になること。

---

## 手順6　APIキーを入れる

⚠️⚠️ **`*` の部分を、渡されたAPIキーに置き換えて**実行する。

```powershell
$key = "khg_kpi_********************************"
```

⚠️ ⚠️ **画面には出ないが、この窓の中にだけ入っている。**

```powershell
$key.Length
```

⚠️ **51 前後の数字**が出ること（⚠️ **0 や 8 なら貼れていない**）。

---

## ⚠️ 手順7　キーとネットワークを確かめる

⚠️⚠️ **ここが通らなければ、この先は何をしても動かない。**

```powershell
curl.exe -s -o NUL -w "%{http_code}`n" -H "Authorization: Bearer $key" https://api.khg-marketing.info/api/v1/analysis/meta
```

| 出た数字 | 意味 |
|---|---|
| ⚠️ **200** | ⚠️ **正常。次へ** |
| ⚠️ 401 | ⚠️ **キーが違う／失効**（管理者へ） |
| ⚠️ 000 | ⚠️ **社内ネットワークから出られていない**（管理者へ） |

---

## ⚠️ 手順8　サーバー単体で動くか確かめる

```powershell
$env:KHG_ANALYSIS_API_KEY = $key
```

```powershell
node "$dir\dist\index.js"
```

⚠️ ⚠️ **`[khg-analysis] 起動しました。接続先: ...` と出たら成功。**
⚠️ **`Ctrl` + `C` で止める**（そのままだと待ち続ける）。

| 出たもの | 意味 |
|---|---|
| ⚠️ **起動しました** | ⚠️ **正常。次へ** |
| `ERR_MODULE_NOT_FOUND` | ⚠️ `node_modules` が無い（手順5へ戻る） |
| `KHG_ANALYSIS_API_KEY が設定されていません` | ⚠️ 手順6をやり直す |

---

## 手順9　設定ファイルの場所を用意する

```powershell
$cfg = "$env:APPDATA\Claude\claude_desktop_config.json"
```

```powershell
New-Item -ItemType Directory -Force -Path (Split-Path $cfg)
```

```powershell
Test-Path $cfg
```

⚠️ `True` なら ⚠️ **控えを取る**（`False` なら次の1行は飛ばす）。

```powershell
Copy-Item $cfg "$cfg.bak" -Force
```

---

## ⚠️ 手順10　他のMCPが入っていないか見る

```powershell
if (Test-Path $cfg) { (Get-Content $cfg -Raw | ConvertFrom-Json).mcpServers.PSObject.Properties.Name }
```

⚠️ ⚠️ **何も出ない、または `khg-analysis` だけなら、そのまま次へ。**
⚠️⚠️ **他の名前が出たら、ここで止めて管理者に連絡すること**（⚠️ **次の手順で消えてしまう**）。

---

## 手順11　設定を書く

```powershell
$entry = @{ command = "node"; args = @("$dir\dist\index.js"); env = @{ KHG_ANALYSIS_API_URL = "https://api.khg-marketing.info"; KHG_ANALYSIS_API_KEY = $key } }
```

```powershell
$json = @{ mcpServers = @{ "khg-analysis" = $entry } } | ConvertTo-Json -Depth 6
```

```powershell
[System.IO.File]::WriteAllText($cfg, $json, (New-Object System.Text.UTF8Encoding($false)))
```

⚠️ 何も表示されなければ成功。

⚠️ ⚠️ **BOM 無しの UTF-8 で書いている。** ⚠️ **`Out-File` や `>` を使うと BOM が付き、Claude Desktop が読めないことがある。**

---

## 手順12　書けたか確かめる

```powershell
(Get-Content $cfg -Raw | ConvertFrom-Json).mcpServers.'khg-analysis'.args
```

⚠️ ⚠️ **`...\khg-analysis-mcp\dist\index.js` が出ること。**

```powershell
(Get-Content $cfg -Raw | ConvertFrom-Json).mcpServers.'khg-analysis'.env.KHG_ANALYSIS_API_KEY.Length
```

⚠️ ⚠️ **手順6と同じ数字**が出ること。

---

## ⚠️ 手順13　Claude Desktop を完全に終了する

⚠️⚠️ **× では終了しない。** ⚠️ **常駐したままだと設定を読み直さない。**

```powershell
Get-Process -Name Claude -ErrorAction SilentlyContinue
```

⚠️ 何か出たら次を実行する（何も出なければ飛ばす）。

```powershell
Stop-Process -Name Claude -Force
```

```powershell
Get-Process -Name Claude -ErrorAction SilentlyContinue
```

⚠️ ⚠️ **今度は何も出ないこと。**

---

## 手順14　起動する

⚠️ **スタートメニューから Claude を開く。**
⚠️ ⚠️ **開いてから30秒ほど待つ**（MCPの起動に少しかかる）。

---

## 手順15　つながったか確かめる

```powershell
Get-ChildItem "$env:APPDATA\Claude\logs" | Select-Object Name, LastWriteTime
```

| 結果 | 意味 |
|---|---|
| ⚠️ **`mcp-server-khg-analysis.log` がある** | ⚠️ **設定は読めている。次へ** |
| ⚠️⚠️ **そのログが無い** | ⚠️ **設定ファイルを読んでいない**（下の「それでもだめなとき」） |

```powershell
Get-Content "$env:APPDATA\Claude\logs\mcp-server-khg-analysis.log" -Tail 20
```

⚠️ ⚠️ **`起動しました` が出ていれば成功。**

---

## 手順16　Claude Desktop で使ってみる

> 分析APIで使える集計軸と指標を教えて

⚠️ 一覧が返れば完了。

---

## ⚠️ それでもだめなとき

### ⚠️ ログのフォルダに何も出ない場合

⚠️⚠️ **Microsoft Store 版の Claude Desktop の可能性がある。**
⚠️ ⚠️ **Store 版は設定ファイルの場所が違い、ここに書いても読まれない。**

```powershell
Get-AppxPackage *Claude* | Select-Object Name, InstallLocation
```

⚠️ ⚠️ **何か出たら Store 版。** ⚠️ **一度アンインストールし、公式サイトの版を入れ直す。**

### 送ってもらうもの

```powershell
powershell -ExecutionPolicy Bypass -File "$dir\scripts\確認.ps1"
```

⚠️ ⚠️ **APIキーの値は表示されない**（文字数だけ）。⚠️ **出た内容をすべて管理者へ。**
