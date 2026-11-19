@echo off
title Lumbre - sistema de ventas para lamparas de diseno
cd /d "%~dp0lumbre"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro Node.js. Instala Node 20 o superior desde https://nodejs.org
  echo y vuelve a abrir este archivo.
  echo.
  pause
  exit /b 1
)
node server.mjs
echo.
echo Lumbre se cerro. Presiona una tecla para salir.
pause