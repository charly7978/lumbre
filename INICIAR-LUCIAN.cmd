@echo off
setlocal
title Lucian - inicio local
pushd "%~dp0lumbre" 2>nul
if errorlevel 1 (
  echo No se encontro la carpeta lumbre junto al iniciador.
  pause
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
