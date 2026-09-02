@echo off
rem ============================================================
rem  Analysis API MCP server - setup launcher
rem
rem  Double-click this file. It runs setup-windows.ps1 with the
rem  execution policy bypassed, so the user never has to open
rem  PowerShell or change any system setting.
rem
rem  NOTE: keep this file ASCII-only. A .cmd saved as UTF-8 can
rem  render Japanese as garbage depending on the console codepage;
rem  all Japanese messages are printed by the PowerShell script.
rem ============================================================

title Analysis API MCP - Setup

cd /d "%~dp0"

if not exist "%~dp0setup-windows.ps1" (
    echo.
    echo  setup-windows.ps1 not found next to this file.
    echo  Please extract the whole zip and run again.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows.ps1"

set "EXITCODE=%ERRORLEVEL%"

echo.
if not "%EXITCODE%"=="0" (
    echo  Setup did not finish. See the message above.
    echo.
)

pause
exit /b %EXITCODE%
