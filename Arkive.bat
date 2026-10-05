@echo off
setlocal
cd /d "%~dp0"

rem 1. Check for standalone unpacked executable
if exist "%~dp0apps\desktop\release\win-unpacked\Arkive.exe" (
    start "" "%~dp0apps\desktop\release\win-unpacked\Arkive.exe"
    exit /b 0
)

rem 2. Check for installed application
if exist "%LOCALAPPDATA%\Programs\Arkive\Arkive.exe" (
    start "" "%LOCALAPPDATA%\Programs\Arkive\Arkive.exe"
    exit /b 0
)

rem 3. Check for local node_modules electron runtime
if exist "%~dp0apps\desktop\node_modules\electron\dist\electron.exe" (
    cd /d "%~dp0apps\desktop"
    start "" "%~dp0apps\desktop\node_modules\electron\dist\electron.exe" .
    exit /b 0
)

rem 4. Fallback to npx
cd /d "%~dp0apps\desktop"
call npx.cmd electron .
