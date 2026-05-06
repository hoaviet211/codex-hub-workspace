@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
chcp 65001 > nul

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%lco-chat.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

endlocal & exit /b %EXIT_CODE%
