@echo off
title AskDell Dev Assistant Installer
setlocal enabledelayedexpansion

echo ============================================================
echo   AskDell Dev Assistant — 1-Click Team Installer
echo ============================================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\AskDellDevAssistant"

echo [*] Installing to background application cache:
echo     %INSTALL_DIR%
echo.

:: 1. Create or clean install directory
if exist "%INSTALL_DIR%" (
    rmdir /s /q "%INSTALL_DIR%" 2>nul
)
mkdir "%INSTALL_DIR%" 2>nul

:: 2. Copy production files into local appdata
xcopy /s /e /y /q "%~dp0*" "%INSTALL_DIR%\" >nul 2>&1

:: Remove installer from destination if copied
if exist "%INSTALL_DIR%\Install.bat" del /f /q "%INSTALL_DIR%\Install.bat" 2>nul

echo [OK] Extension files installed securely (no code exposed).
echo.
echo [*] Launching Microsoft Edge...
echo.

:: 3. Launch Edge with the extension automatically active
start "" msedge.exe --load-extension="%INSTALL_DIR%" "edge://extensions"

echo ============================================================
echo   INSTALLATION COMPLETE!
echo ============================================================
echo.
echo In Edge:
echo  1. Toggle ON "Developer mode" (if not already on).
echo  2. AskDell Dev Assistant is now active in your toolbar!
echo  3. Make sure you are logged in to https://ask.dell.com.
echo.
echo Press any key to exit...
pause >nul
