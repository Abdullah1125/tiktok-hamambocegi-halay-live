@echo off
chcp 65001 >nul
title Hamambocegi Halay Live - Ilk Kurulum ve Baslatma
cd /d "%~dp0"

if not exist "%~dp0.venv\Scripts\python.exe" (
    echo [1/3] Sanal ortam (.venv) olusturuluyor...
    py -3.12 -m venv .venv 2>nul || python -m venv .venv
)

echo [2/3] Bagimliliklar kuruluyor...
"%~dp0.venv\Scripts\python.exe" -m pip install --upgrade pip -q
"%~dp0.venv\Scripts\python.exe" -m pip install -r requirements.txt

echo [3/3] Sunucu baslatiliyor...
call "%~dp0Baslat_TikTok_Halay.bat"
