@echo off
title Configuracion Sistema de Ventas
chcp 65001 >nul
cd /d "%~dp0"
echo Iniciando asistente...
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0configurar.ps1"
if errorlevel 1 pause
