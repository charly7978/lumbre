@echo off
title Sistema de Ventas - No cerrar esta ventana
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js.
  echo Instalalo desde https://nodejs.org/en/download
  echo Cerra esta ventana y volve a abrir el acceso directo.
  pause
  exit /b 1
)
echo Iniciando Sistema de Ventas...
node server.mjs
pause
