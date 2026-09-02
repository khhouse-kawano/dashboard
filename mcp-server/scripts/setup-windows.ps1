#Requires -Version 5.1
<#
.SYNOPSIS
  分析API用の MCPサーバーを、このPCの Claude Desktop に登録する。

.DESCRIPTION
  利用者のPCで1回だけ実行する。通常は同じフォルダの「セットアップ.cmd」を
  ダブルクリックして起動する（利用者に PowerShell を開かせないため）。

  行うこと:
    1. Node.js 20以上があるか確認する
    2. dist/ と package.json を %LOCALAPPDATA%\khg-analysis-mcp へ複製する
    3. 依存パッケージを取得する（初回のみ）
    4. APIキーを入力ダイアログで受け取る（画面には伏せ字で表示）
    5. claude_desktop_config.json に khg-analysis を追記する
    6. Claude Desktop を再起動する（同意を得てから）

  ⚠️ APIキーはスクリプトに埋め込まない。1人1キーであり、配布物に平文で
     残すと「漏洩時にその人の分だけ止める」という設計が崩れるため。

  ⚠️ 既存の claude_desktop_config.json は上書きせず追記する。
     他のMCPサーバーを登録済みでも壊さない。実行前に自動でバックアップを取る。

.PARAMETER InstallDir
  MCPサーバーの設置先。既定は %LOCALAPPDATA%\khg-analysis-mcp。

.PARAMETER ApiUrl
  分析APIのベースURL。通常は変更しない。

.PARAMETER NoRestart
  Claude Desktop の再起動を行わない。

.NOTES
  管理者権限は不要。ログインユーザーの領域にしか書き込まない。
#>
[CmdletBinding()]
param(
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'khg-analysis-mcp'),
    [string]$ApiUrl     = 'https://api.khg-marketing.info',
    [switch]$NoRestart
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# GUI の準備
#
# 利用者はコンソールを使わない前提。入力も結果通知もダイアログで行う。
# GUI が使えない環境（リモートセッション等）ではコンソールに退避する。
# ---------------------------------------------------------------------------
$script:GuiAvailable = $false
try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $script:GuiAvailable = $true
} catch {
    $script:GuiAvailable = $false
}

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "== $Message" -ForegroundColor Cyan
}

function Write-Note {
    param([string]$Message)
    Write-Host "   $Message" -ForegroundColor DarkGray
}

<#
  エラーをダイアログで見せてから終了する。
  ⚠️ コンソールに出すだけだと、ダブルクリック起動では読まずに閉じられる。
#>
function Stop-WithError {
    param(
        [string]$Message,
        [string]$Detail = ''
    )

    $full = $Message
    if ($Detail -ne '') { $full = "$Message`r`n`r`n$Detail" }

    Write-Host ""
    Write-Host $Message -ForegroundColor Red
    if ($Detail -ne '') { Write-Host $Detail -ForegroundColor Red }

    if ($script:GuiAvailable) {
        [System.Windows.Forms.MessageBox]::Show(
            $full,
            'セットアップを中止しました',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    }
    exit 1
}

<#
  APIキーの入力ダイアログ。

  ⚠️ コンソールの Read-Host にしないのは、貼り付け（Ctrl+V）が確実に効き、
    「入力しても文字が出ないので固まったと思われる」事故を避けるため。
    伏せ字にしつつ、確認用に「表示」チェックを付ける。

  戻り値: 入力された文字列。キャンセル時は $null。
#>
function Read-ApiKeyDialog {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'APIキーの入力'
    $form.ClientSize = New-Object System.Drawing.Size(560, 212)
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true
    $form.Font = New-Object System.Drawing.Font('Meiryo UI', 9)

    $label = New-Object System.Windows.Forms.Label
    $label.Text = "開発者から受け取った APIキーを貼り付けてください。"
    $label.Location = New-Object System.Drawing.Point(20, 20)
    $label.Size = New-Object System.Drawing.Size(520, 22)
    $form.Controls.Add($label)

    $hint = New-Object System.Windows.Forms.Label
    $hint.Text = ("khg_kpi_ で始まる長い文字列です。枠の中をクリックしてから Ctrl+V。`r`n" +
                  "お手元に無い場合は「キャンセル」を押し、開発者にご依頼ください。")
    $hint.Location = New-Object System.Drawing.Point(20, 44)
    $hint.Size = New-Object System.Drawing.Size(520, 40)
    $hint.ForeColor = [System.Drawing.Color]::DimGray
    $form.Controls.Add($hint)

    $box = New-Object System.Windows.Forms.TextBox
    $box.Location = New-Object System.Drawing.Point(20, 92)
    $box.Size = New-Object System.Drawing.Size(520, 26)
    $box.UseSystemPasswordChar = $true
    $box.Font = New-Object System.Drawing.Font('Consolas', 10)
    $form.Controls.Add($box)

    $show = New-Object System.Windows.Forms.CheckBox
    $show.Text = '入力内容を表示する'
    $show.Location = New-Object System.Drawing.Point(20, 126)
    $show.Size = New-Object System.Drawing.Size(200, 24)
    $show.Add_CheckedChanged({ $box.UseSystemPasswordChar = -not $show.Checked })
    $form.Controls.Add($show)

    $ok = New-Object System.Windows.Forms.Button
    $ok.Text = 'OK'
    $ok.Location = New-Object System.Drawing.Point(360, 166)
    $ok.Size = New-Object System.Drawing.Size(85, 30)
    $ok.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.Controls.Add($ok)
    $form.AcceptButton = $ok

    $cancel = New-Object System.Windows.Forms.Button
    $cancel.Text = 'キャンセル'
    $cancel.Location = New-Object System.Drawing.Point(455, 166)
    $cancel.Size = New-Object System.Drawing.Size(85, 30)
    $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.Controls.Add($cancel)
    $form.CancelButton = $cancel

    $form.Add_Shown({ $form.Activate(); $box.Focus() })

    $result = $form.ShowDialog()
    $value = $box.Text
    $form.Dispose()

    if ($result -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
    return $value
}

<#
  Claude Desktop の実行ファイルを探す。
  起動中ならそのプロセスのパスが最も確実。
#>
function Find-ClaudeExecutable {
    $proc = Get-Process -Name 'Claude' -ErrorAction SilentlyContinue
    if ($null -ne $proc) {
        $withPath = $proc | Where-Object { $_.Path } | Select-Object -First 1
        if ($null -ne $withPath) { return $withPath.Path }
    }

    $candidates = @(
        (Join-Path $env:LOCALAPPDATA 'AnthropicClaude\claude.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Claude\Claude.exe')
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }

    $root = Join-Path $env:LOCALAPPDATA 'AnthropicClaude'
    if (Test-Path $root) {
        $found = Get-ChildItem -Path $root -Filter 'claude.exe' -Recurse -Depth 2 -ErrorAction SilentlyContinue |
                 Select-Object -First 1
        if ($null -ne $found) { return $found.FullName }
    }

    return $null
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
Write-Step "1/6 Node.js を確認"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCmd) {
    Stop-WithError `
        "Node.js がインストールされていません。" `
        ("先に Node.js（LTS版）を入れてから、もう一度このセットアップを実行してください。`r`n`r`n" +
         "  https://nodejs.org/  から LTS 版をダウンロードしてインストール`r`n`r`n" +
         "※ インストール後はPCを再起動するか、一度サインアウトしてください。")
}

$nodeVersionRaw = (& node --version).Trim()
$nodeMajor = [int](($nodeVersionRaw.TrimStart('v')).Split('.')[0])

if ($nodeMajor -lt 20) {
    Stop-WithError `
        "Node.js $nodeVersionRaw は古すぎます（20以上が必要です）。" `
        "https://nodejs.org/ から LTS 版を入れ直してください。"
}

Write-Note "Node.js $nodeVersionRaw ($($nodeCmd.Source))"

# ---------------------------------------------------------------------------
# 2. ビルド成果物を設置先へ複製
#
# 展開したzipを直接参照させない。利用者がフォルダを移動・削除しても
# Claude Desktop から使い続けられるようにするため。
# ---------------------------------------------------------------------------
Write-Step "2/6 ファイルを配置"

$sourceRoot = Split-Path -Parent $PSScriptRoot
$sourceDist = Join-Path $sourceRoot 'dist'
$sourcePkg  = Join-Path $sourceRoot 'package.json'

if (-not (Test-Path (Join-Path $sourceDist 'index.js'))) {
    Stop-WithError `
        "配布ファイルが不足しています（dist\index.js が見つかりません）。" `
        ("zipを展開した場所からそのまま実行しているか確認してください。`r`n" +
         "探した場所: $sourceDist")
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# 古い dist が残ると、削除されたはずのファイルが動き続ける可能性がある
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
Write-Step "3/6 必要な部品を確認"

$nodeModules = Join-Path $InstallDir 'node_modules'
if (Test-Path $nodeModules) {
    Write-Note "取得済み。スキップします"
} else {
    Write-Note "初回のみダウンロードします（1〜2分かかります）"
    Push-Location $InstallDir
    try {
        & npm install --omit=dev --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
            Pop-Location
            Stop-WithError `
                "必要な部品のダウンロードに失敗しました。" `
                "社内ネットワークの制限が原因のことがあります。開発者にご連絡ください。"
        }
    } finally {
        if ((Get-Location).Path -eq $InstallDir) { Pop-Location }
    }
}

# ---------------------------------------------------------------------------
# 4. APIキー
# ---------------------------------------------------------------------------
Write-Step "4/6 APIキーを設定"

$apiKey = $null

if ($script:GuiAvailable) {
    $apiKey = Read-ApiKeyDialog
    if ($null -eq $apiKey) {
        Write-Host ""
        Write-Host "キャンセルされました。設定は変更していません。" -ForegroundColor Yellow
        [System.Windows.Forms.MessageBox]::Show(
            ("セットアップを中断しました。設定は変更していません。`r`n`r`n" +
             "APIキーをお持ちでない場合は、開発者にご依頼ください。`r`n" +
             "受け取ったあと、もう一度「セットアップ.cmd」を実行してください。"),
            'セットアップを中断しました',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
        exit 1
    }
} else {
    # GUI が使えない環境向けの退避経路
    Write-Host ""
    Write-Host "   APIキー（khg_kpi_ で始まる文字列）を貼り付けて Enter を押してください。"
    Write-Host "   入力内容は画面に表示されません。"
    Write-Host "   お手元に無い場合は Ctrl+C で中断し、開発者にご依頼ください。"
    Write-Host ""
    $secureKey = Read-Host -Prompt "   APIキー" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    try {
        $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

$apiKey = $apiKey.Trim()

if (-not $apiKey.StartsWith('khg_kpi_')) {
    Stop-WithError `
        "APIキーの形式が違います。" `
        ("APIキーは khg_kpi_ で始まります。`r`n" +
         "コピーする範囲が正しいか、別の文字列を貼っていないか確認してください。`r`n`r`n" +
         "正しいキーが分からない場合は開発者にご依頼ください。")
}
if ($apiKey.Length -lt 40) {
    Stop-WithError `
        "APIキーが短すぎます（$($apiKey.Length)文字）。" `
        ("khg_kpi_ の後に43文字続きます。`r`n" +
         "途中で切れていないか、末尾までコピーできているか確認してください。`r`n`r`n" +
         "分からない場合は開発者にご依頼ください。")
}

Write-Note "形式を確認しました（$($apiKey.Substring(0,14))… / $($apiKey.Length)文字）"

# ---------------------------------------------------------------------------
# 5. claude_desktop_config.json へ追記
#
# ⚠️ 全体を書き換えない。既に登録済みの他のMCPサーバーを壊さないため、
#   読み込んで mcpServers.khg-analysis だけを差し替える。
# ---------------------------------------------------------------------------
Write-Step "5/6 Claude Desktop に登録"

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
            Stop-WithError `
                "Claude Desktop の設定ファイルが壊れています。" `
                ("$configPath`r`n`r`n" +
                 "$($_.Exception.Message)`r`n`r`n" +
                 "開発者にご連絡ください。バックアップは残してあります。")
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
# 6. Claude Desktop の再起動
#
# ⚠️ 設定ファイルは起動時にしか読まれない。ウィンドウの × では常駐が残るため、
#   利用者に任せると「反映されない」という問い合わせが必ず発生する。
#   同意を取ったうえでこちらで終了・起動する。
# ---------------------------------------------------------------------------
Write-Step "6/6 Claude Desktop を再起動"

$restarted = $false
$claudeExe = Find-ClaudeExecutable

if ($NoRestart) {
    Write-Note "-NoRestart が指定されたのでスキップします"
} elseif ($null -eq $claudeExe) {
    Write-Note "Claude Desktop の場所が特定できませんでした。手動で再起動してください"
} else {
    $doRestart = $true
    if ($script:GuiAvailable) {
        $answer = [System.Windows.Forms.MessageBox]::Show(
            ("設定を反映するため、Claude Desktop を再起動します。`r`n`r`n" +
             "開いている会話は保存されています。続行しますか？"),
            '再起動の確認',
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Question
        )
        $doRestart = ($answer -eq [System.Windows.Forms.DialogResult]::Yes)
    }

    if ($doRestart) {
        $running = Get-Process -Name 'Claude' -ErrorAction SilentlyContinue
        if ($null -ne $running) {
            Write-Note "終了しています…"
            Stop-Process -Name 'Claude' -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 3
        }
        Write-Note "起動しています…"
        Start-Process -FilePath $claudeExe
        $restarted = $true
    } else {
        Write-Note "再起動を見送りました"
    }
}

# ---------------------------------------------------------------------------
# 完了
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--------------------------------------------------"
Write-Host "設定が完了しました。" -ForegroundColor Green
Write-Host ""

$closing = "セットアップが完了しました。"
if ($restarted) {
    $closing += "`r`nClaude Desktop を再起動しました。"
} else {
    $closing += ("`r`n`r`n【重要】設定を反映するには Claude Desktop の再起動が必要です。`r`n" +
                 "画面右下のタスクトレイにある Claude のアイコンを右クリックして" +
                 "「終了」を選び、そのあと Claude Desktop を起動し直してください。`r`n" +
                 "※ ウィンドウの × で閉じるだけでは反映されません。")
}
$closing += ("`r`n`r`n動作確認：Claude Desktop で次のように聞いてください。`r`n`r`n" +
             "　　分析APIで使える集計軸と指標を教えて`r`n`r`n" +
             "集計軸と指標の一覧が返れば成功です。")

Write-Host $closing
Write-Host ""

if ($script:GuiAvailable) {
    [System.Windows.Forms.MessageBox]::Show(
        $closing,
        'セットアップ完了',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
}
