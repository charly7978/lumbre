@echo off
setlocal
title Lucian - inicio local
pushd "%~dp0" 2>nul
if errorlevel 1 (
  echo No se pudo abrir la carpeta del sistema.
  pause
  exit /b 1
)
if not exist "server.mjs" (
  echo Falta server.mjs en esta carpeta.
  pause
  popd
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 20 o superior desde https://nodejs.org
  pause
  popd
  exit /b 1
)
node server.mjs
set "RC=%ERRORLEVEL%"
echo.
echo Lucian finalizo con codigo %RC%.
pause
popd
exit /b %RC%
