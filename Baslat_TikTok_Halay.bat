@echo off
chcp 65001 >nul
title Divalar Halay A.S - Yerel Canli Studyo (Port 9944)
cd /d "%~dp0"

echo ==============================================================
echo   Divalar Halay A.S - Yerel Canli Yayin Sunucusu Baslatiliyor...
echo   TikTok LIVE Studio / OBS Kaynagi : http://127.0.0.1:9944/?obs=1
echo   Kontrol Paneli                   : http://127.0.0.1:9944/ai_panel.html
echo ==============================================================

set "PY_CMD="
if exist "%~dp0.venv\Scripts\python.exe" (
    set "PY_CMD=%~dp0.venv\Scripts\python.exe"
) else if exist "%LocalAppData%\Programs\Python\Python312\python.exe" (
    set "PY_CMD=%LocalAppData%\Programs\Python\Python312\python.exe"
) else (
    py -3.12 --version >nul 2>&1
    if not errorlevel 1 (
        set "PY_CMD=py -3.12"
    ) else (
        set "PY_CMD=python.exe"
    )
)

start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:9944/?obs=1"
%PY_CMD% server.py
pause
