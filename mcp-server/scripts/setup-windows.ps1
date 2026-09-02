#Requires -Version 5.1
<#
.SYNOPSIS
  分析API用の MCPサーバーを、このPCの Claude Desktop に登録する。

.DESCRIPTION
  利用者のPCで1回だけ実行する。以下を行う。

    1. Node.js 20以上があるか確認する
    2. dist/ と package.json を %LOCALAPPDATA%\khg-analysis-mcp へ複製する
    3. 依存パッケージを取得する（初回のみ）
    4. APIキーを対話的に受け取る（画面には表示されない）
    5. claude_desktop_config.json に khg-analysis を追記する

  ⚠️ APIキーはスクリプトに埋め込まない。1人1キーであり、配布物に平文で
     残すと「漏洩時にその人の分だけ止める」という設計が崩れるため。

  ⚠️ 既存の claude_desktop_config.json は上書きせず追記する。
     他のMCPサーバーを登録済みでも壊さない。実行前に自動でバックアップを取る。

.PARAMETER InstallDir
  MCPサーバーの設置先。既定は %LOCALAPPDATA%\khg-analysis-mcp。

.PARAMETER ApiUrl
  分析APIのベースURL。通常は変更しない。

.EXAMPLE
  # mcp-server\scripts\ に移動して実行する
  powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1

.NOTES
  管理者権限は不要。ログインユーザーの領域にしか書き込まない。
#>
[CmdletBinding()]
param(
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'khg-analysis-mcp'),
    [string]$ApiUrl     = 'https://api.khg-marketing.info'
)

$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "== $Message" -ForegroundColor Cyan
}

function Write-Note {
    param([string]$Message)
    Write-Host "   $Message" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "分析API MCPサーバー セットアップ" -ForegroundColor White
Write-Host "--------------------------------------------------"

# ---------------------------------------------------------------------------
# 1. Node.js の確認
#
# MCPサーバーは Claude Desktop が子プロセスとして起動する Node.js アプリ。
# PATH に node が無いと、Claude Desktop 側では「ツールが出てこない」という
# 分かりにくい症状になるため、ここで確実に落とす。
# ---------------------------------------------------------------------------
Write-Step "1/5 Node.js を確認"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCmd) {
    Write-Host ""
    Write-Host "Node.js が見つかりません。" -ForegroundColor Red
    Write-Host "以下のいずれかで導入してから、もう一度このスクリプトを実行してください。"
    Write-Host ""
    Write-Host "  winget install OpenJS.NodeJS.LTS"
    Write-Host "  または https://nodejs.org/ から LTS 版をインストール"
    Write-Host ""
    Write-Host "⚠ インストール後は PowerShell を開き直してください（PATH の反映に必要）。"
    exit 1
}

$nodeVersionRaw = (& node --version).Trim()
$nodeMajor = [int](($nodeVersionRaw.TrimStart('v')).Split('.')[0])

if ($nodeMajor -lt 20) {
    Write-Host ""
    Write-Host "Node.js $nodeVersionRaw は古すぎます（20以上が必要）。" -ForegroundColor Red
    Write-Host "  winget upgrade OpenJS.NodeJS.LTS"
    exit 1
}

Write-Note "Node.js $nodeVersionRaw ($($nodeCmd.Source))"

# ---------------------------------------------------------------------------
# 2. ビルド成果物を設置先へ複製
#
# リポジトリを直接参照させない。利用者がリポジトリを移動・削除しても
# Claude Desktop から使い続けられるようにするため。
# ---------------------------------------------------------------------------
Write-Step "2/5 ファイルを配置"

$sourceRoot = Split-Path -Parent $PSScriptRoot
$sourceDist = Join-Path $sourceRoot 'dist'
$sourcePkg  = Join-Path $sourceRoot 'package.json'

if (-not (Test-Path (Join-Path $sourceDist 'index.js'))) {
    Write-Host ""
    Write-Host "dist\index.js がありません。" -ForegroundColor Red
    Write-Host "配布元で先にビルドしてください:"
    Write-Host ""
    Write-Host "  cd $sourceRoot"
    Write-Host "  npm install"
    Write-Host "  npm run build"
    exit 1
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# 古い dist が残ると、削除されたファイルが動き続ける可能性がある
$targetDist = Join-Path $InstallDir 'dist'
if (Test-Path $targetDist) {
    Remove-Item -Path $targetDist -Recurse -Force
}

Copy-Item -Path $sourceDist -Destination $InstallDir -Recurse -Force
Copy-Item -Path $sourcePkg  -Destination $InstallDir -Force

Write-Note "配置先: $InstallDir"

# ---------------------------------------------------------------------------
# 3. 依存パッケージ
#
# @modelcontextprotocol/server と zod は実行時に必要。
# node_modules が既にあれば再取得しない（オフラインでも再実行できる）。
# ---------------------------------------------------------------------------
Write-Step "3/5 依存パッケージを確認"

$nodeModules = Join-Path $InstallDir 'node_modules'
if (Test-Path $nodeModules) {
    Write-Note "取得済み。スキップします"
} else {
    Write-Note "npm install を実行します（初回のみ。1〜2分かかります）"
    Push-Location $InstallDir
    try {
        & npm install --omit=dev --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            throw "npm install に失敗しました。ネットワーク接続を確認してください。"
        }
    } finally {
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# 4. APIキー
#
# -AsSecureString で受け取るため、貼り付けても画面には表示されず、
# PowerShell のコマンド履歴にも残らない。
# ---------------------------------------------------------------------------
Write-Step "4/5 APIキーを設定"

Write-Host ""
Write-Host "   管理者から受け取った APIキー（khg_kpi_ で始まる長い文字列）を"
Write-Host "   貼り付けて Enter を押してください。入力内容は画面に表示されません。"
Write-Host ""

$secureKey = Read-Host -Prompt "   APIキー" -AsSecureString

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

$apiKey = $apiKey.Trim()

if (-not $apiKey.StartsWith('khg_kpi_')) {
    Write-Host ""
    Write-Host "APIキーは khg_kpi_ で始まります。貼り付け内容を確認してください。" -ForegroundColor Red
    exit 1
}
if ($apiKey.Length -lt 40) {
    Write-Host ""
    Write-Host "APIキーが短すぎます（$($apiKey.Length)文字）。" -ForegroundColor Red
    Write-Host "khg_kpi_ の後に43文字続きます。途中で切れていないか確認してください。" -ForegroundColor Red
    exit 1
}

Write-Note "形式を確認しました（$($apiKey.Substring(0,14))… / $($apiKey.Length)文字）"

# ---------------------------------------------------------------------------
# 5. claude_desktop_config.json へ追記
#
# ⚠️ 全体を書き換えない。既に登録済みの他のMCPサーバーを壊さないため、
#   読み込んで mcpServers.khg-analysis だけを差し替える。
# ---------------------------------------------------------------------------
Write-Step "5/5 Claude Desktop に登録"

$configDir  = Join-Path $env:APPDATA 'Claude'
$configPath = Join-Path $configDir 'claude_desktop_config.json'

New-Item -ItemType Directory -Force -Path $configDir | Out-Null

$config = $null

if (Test-Path $configPath) {
    $backupPath = "$configPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item -Path $configPath -Destination $backupPath -Force
    Write-Note "バックアップ: $backupPath"

    $raw = Get-Content -Path $configPath -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) {
        $config = [pscustomobject]@{}
    } else {
        try {
            $config = $raw | ConvertFrom-Json
        } catch {
            Write-Host ""
            Write-Host "既存の claude_desktop_config.json が JSON として読めません。" -ForegroundColor Red
            Write-Host "  $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
            Write-Host "手で修正するか、バックアップを残したうえで削除してから再実行してください。"
            Write-Host "  $configPath"
            exit 1
        }
    }
} else {
    Write-Note "設定ファイルが無いので新規作成します"
    $config = [pscustomobject]@{}
}

if ($config.PSObject.Properties.Name -notcontains 'mcpServers') {
    $config | Add-Member -NotePropertyName 'mcpServers' -NotePropertyValue ([pscustomobject]@{})
}

$entry = [pscustomobject]@{
    command = 'node'
    args    = @( (Join-Path $InstallDir 'dist\index.js') )
    env     = [pscustomobject]@{
        KHG_ANALYSIS_API_URL = $ApiUrl
        KHG_ANALYSIS_API_KEY = $apiKey
    }
}

if ($config.mcpServers.PSObject.Properties.Name -contains 'khg-analysis') {
    Write-Note "既存の khg-analysis を更新します"
    $config.mcpServers.'khg-analysis' = $entry
} else {
    $config.mcpServers | Add-Member -NotePropertyName 'khg-analysis' -NotePropertyValue $entry
}

# ⚠️ BOM 付きで書くと Claude Desktop 側のJSONパーサーが失敗しうるため BOM なしで保存する。
#   Out-File / Set-Content は既定のエンコーディングが環境で変わるので使わない。
$json = $config | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))

# メモリ上のキーを残さない
$apiKey = $null
[System.GC]::Collect()

Write-Note "書き込み: $configPath"

# ---------------------------------------------------------------------------
# 完了
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--------------------------------------------------"
Write-Host "設定が完了しました。" -ForegroundColor Green
Write-Host ""

$claudeProcess = Get-Process -Name 'Claude' -ErrorAction SilentlyContinue
if ($null -ne $claudeProcess) {
    Write-Host "⚠ Claude Desktop が起動中です。" -ForegroundColor Yellow
    Write-Host "  設定ファイルは起動時にしか読まれません。" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "次の手順:"
Write-Host ""
Write-Host "  1. タスクトレイ（画面右下）の Claude アイコンを右クリック → 終了"
Write-Host "     ※ ウィンドウの × では常駐が残り、設定が反映されません"
Write-Host "  2. Claude Desktop を起動"
Write-Host "  3. チャットで次のように聞く:"
Write-Host ""
Write-Host "       分析APIで使える集計軸と指標を教えて" -ForegroundColor White
Write-Host ""
Write-Host "  集計軸と指標の一覧が返れば成功です。"
Write-Host "  「どのディレクトリですか」と聞かれた場合は接続できていません。"
Write-Host ""
Write-Host "うまくいかないときのログ:"
Write-Host "  $env:APPDATA\Claude\logs\mcp-server-khg-analysis.log"
Write-Host ""
