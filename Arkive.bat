@echo off
title Arkive - Modern Archive Manager
cd /d "%~dp0apps\desktop"
echo ========================================================
echo   Arkive - High-Performance Archive Manager
echo ========================================================
echo.
echo Launching native desktop window...
call npx.cmd electron .
