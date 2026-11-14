@echo off
chcp 65001 >nul
title Divalar Halay A.S - OBS Studio Ultra HD (1080x1920 60FPS)
cd /d "%~dp0"

set "PY_CMD=python.exe"
if exist "%~dp0.venv\Scripts\python.exe" set "PY_CMD=%~dp0.venv\Scripts\python.exe"

echo [1/2] Halay 3D Canli Sunucu (Port 9944) kontrol ediliyor...
netstat -ano | findstr ":9944 " | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo [+] Sunucu baslatiliyor...
    start "HalayLiveServer" /D "%~dp0" %PY_CMD% server.py
    ping 127.0.0.1 -n 4 >nul
)
if exist "%APPDATA%\obs-studio\.sentinel" rmdir /S /Q "%APPDATA%\obs-studio\.sentinel" >nul 2>&1
echo [2/2] OBS Studio baslatiliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'C:\Program Files\obs-studio\bin\64bit\obs64.exe' -WorkingDirectory 'C:\Program Files\obs-studio\bin\64bit' -ArgumentList '--disable-shutdown-check'"
if errorlevel 1 (
    echo [!] OBS baslatilamadi veya yonetici onayi iptal edildi.
    pause
    exit /b 1
)
echo [OK] OBS Studio acildi!
ping 127.0.0.1 -n 3 >nul
exit /b 0
