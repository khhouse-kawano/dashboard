<#
    分析MCPサーバーがつながらないときの確認スクリプト。

    ⚠️ 何も変更しない。読み取って表示するだけ。
    ⚠️⚠️ **APIキーの値は絶対に表示しない。** 有無と文字数だけを出す。
      ⚠️ 利用者はこの結果をそのまま管理者へ送るため、
        1文字でも出すと、チャットやメールにキーが残ってしまう。

    使い方:
      利用者に PowerShell へ貼り付けてもらい、出た内容を全部送ってもらう。
#>

$ErrorActionPreference = 'Continue'
Write-Host "=== 分析MCP 確認 ===" -ForegroundColor Cyan
Write-Host ("日時: " + (Get-Date -Format 'yyyy-MM-dd HH:mm'))

# --- 1. Node.js -------------------------------------------------------------
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($node) {
    Write-Host ("[1] Node.js: OK  " + (& node -v) + "  $node")
} else {
    Write-Host "[1] Node.js: ⚠️ 見つかりません（これが原因です）" -ForegroundColor Red
}

# --- 2. 設定ファイル --------------------------------------------------------
# ⚠️⚠️ **Microsoft Store 版は場所が違う。**
#   ⚠️ Store 版（MSIX）は ⚠️ **アプリから見えるフォルダが差し替えられている**ため、
#     ⚠️ ⚠️ **%APPDATA%\Claude に書いてもアプリからは見えない。**
#   ⚠️ 2026-09-22、⚠️ **これが「開発者設定に出てこない」の原因だった。**
#   ⚠️ `Get-AppxPackage` は数分かかることがあるので使わない。
#     ⚠️ **フォルダの有無で判定する**（同じことが分かり、一瞬で済む）。
$pkg = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Packages') -Filter 'Claude_*' -Directory -ErrorAction SilentlyContinue |
    Select-Object -First 1
if ($pkg) {
    $claudeDir = Join-Path $pkg.FullName 'LocalCache\Roaming\Claude'
    Write-Host "[2] 版: Microsoft Store 版" -ForegroundColor Yellow
} else {
    $claudeDir = Join-Path $env:APPDATA 'Claude'
    Write-Host "[2] 版: 公式サイト版"
}
Write-Host ("    設定の場所: " + $claudeDir)
$configPath = Join-Path $claudeDir 'claude_desktop_config.json'
if (-not (Test-Path $configPath)) {
    Write-Host "[2] 設定ファイル: ⚠️ ありません -> $configPath" -ForegroundColor Red
    return
}
Write-Host ("[2] 設定ファイル: あり  " + (Get-Item $configPath).LastWriteTime)

$config = $null
try {
    $config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
    # ⚠️ ここで落ちると Claude Desktop 側も MCP を1つも読み込まない。
    #   「開発者設定に何も出ない」ときの典型的な原因。
    Write-Host "[2] ⚠️ 設定ファイルのJSONが壊れています（これが原因です）" -ForegroundColor Red
    Write-Host ("    " + $_.Exception.Message)
    return
}

$entry = $null
if ($config.mcpServers) { $entry = $config.mcpServers.'khg-analysis' }
if (-not $entry) {
    Write-Host "[3] khg-analysis の登録: ⚠️ ありません（セットアップが完了していません）" -ForegroundColor Red
    Write-Host ("    登録されているMCP: " + (($config.mcpServers.PSObject.Properties.Name) -join ', '))
    return
}

Write-Host ("[3] khg-analysis の登録: あり")
Write-Host ("    command : " + $entry.command)
Write-Host ("    args    : " + ($entry.args -join ' '))

# --- 3. 本体ファイル --------------------------------------------------------
$indexPath = $entry.args | Select-Object -First 1
$installDir = if ($indexPath) { Split-Path (Split-Path $indexPath -Parent) -Parent } else { $null }

if ($indexPath -and (Test-Path $indexPath)) {
    Write-Host ("[4] index.js: あり  更新 " + (Get-Item $indexPath).LastWriteTime)
} else {
    Write-Host "[4] index.js: ⚠️ ありません（args の場所にファイルがない）" -ForegroundColor Red
}

$nm = if ($installDir) { Join-Path $installDir 'node_modules' } else { $null }
if ($nm -and (Test-Path $nm)) {
    Write-Host "[5] node_modules: あり"
} else {
    Write-Host "[5] node_modules: ⚠️ ありません（npm install が失敗しています）" -ForegroundColor Red
}

# --- 4. APIキー（⚠️ 値は出さない） ------------------------------------------
$key = $null
if ($entry.env) { $key = $entry.env.KHG_ANALYSIS_API_KEY }
if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Host "[6] APIキー: ⚠️ 未設定" -ForegroundColor Red
} else {
    Write-Host ("[6] APIキー: 設定あり（" + $key.Length + "文字）")
}
$url = $null
if ($entry.env) { $url = $entry.env.KHG_ANALYSIS_API_URL }
Write-Host ("    接続先: " + $(if ($url) { $url } else { '（既定）' }))

# --- 5. 実際に起動してみる --------------------------------------------------
# ⚠️ Claude Desktop と同じ経路（stdio + JSON-RPC）で確かめる。
#   ここが通れば、残るのは Claude Desktop 側の読み込みだけになる。
if ($node -and $indexPath -and (Test-Path $indexPath)) {
    Write-Host "[7] 起動してみます..."
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'node'
    $psi.Arguments = '"' + $indexPath + '"'
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    if ($key) { $psi.EnvironmentVariables['KHG_ANALYSIS_API_KEY'] = $key }
    if ($url) { $psi.EnvironmentVariables['KHG_ANALYSIS_API_URL'] = $url }

    $p = [System.Diagnostics.Process]::Start($psi)
    $p.StandardInput.WriteLine('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check","version":"0"}}}')
    $p.StandardInput.Flush()

    $line = $null
    $task = $p.StandardOutput.ReadLineAsync()
    if ($task.Wait(15000)) { $line = $task.Result }

    if ($line -and $line -match '"result"') {
        Write-Host "    ⇒ OK。サーバーは正常に起動します" -ForegroundColor Green
    } elseif ($line) {
        Write-Host ("    ⇒ ⚠️ 想定外の応答: " + $line.Substring(0, [Math]::Min(200, $line.Length))) -ForegroundColor Red
    } else {
        $err = $p.StandardError.ReadToEnd()
        Write-Host "    ⇒ ⚠️ 起動できませんでした" -ForegroundColor Red
        if ($err) { Write-Host ("    " + $err.Substring(0, [Math]::Min(400, $err.Length))) }
    }
    try { $p.Kill() } catch {}
}

# --- 6. Claude Desktop のログ -----------------------------------------------
# ⚠️ Claude Desktop が MCP の起動に失敗した理由はここにしか出ない。
# ⚠️ ログも設定ファイルと同じフォルダにある（Store 版なら Store 版の場所）
$logDir = Join-Path $claudeDir 'logs'
if (Test-Path $logDir) {
    $log = Get-ChildItem $logDir -Filter '*khg-analysis*' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($log) {
        Write-Host ("[8] ログ: " + $log.Name + "  " + $log.LastWriteTime)
        Get-Content $log.FullName -Tail 15 | ForEach-Object { Write-Host ("    " + $_) }
    } else {
        Write-Host "[8] ログ: ⚠️ khg-analysis のログがありません（Claude Desktop が起動を試していません）" -ForegroundColor Red
    }
} else {
    Write-Host "[8] ログ: フォルダがありません"
}

# --- 7. Claude Desktop が起動したままか --------------------------------------
# ⚠️⚠️ × では終了しない。常駐したままだと設定を読み直さない。
$running = Get-Process -Name 'Claude' -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "[9] Claude Desktop: 起動中（⚠️ 通知領域から「終了」して開き直してください）" -ForegroundColor Yellow
} else {
    Write-Host "[9] Claude Desktop: 起動していません"
}

Write-Host "=== ここまで。表示された内容をすべて管理者に送ってください ===" -ForegroundColor Cyan
