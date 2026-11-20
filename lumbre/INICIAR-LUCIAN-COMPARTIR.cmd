@echo off
setlocal
title Lucian - compartir por LAN con clave
pushd "%~dp0" 2>nul
if errorlevel 1 (
  echo No se pudo abrir la carpeta de Lucian.
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
  echo Instala Node.js 20 o superior.
  pause
  popd
  exit /b 1
)
set "LUCIAN_HOST=0.0.0.0"
set "LUCIAN_PORT=4321"
set "LUCIAN_REQUIRE_AUTH=1"
set "LUCIAN_NO_OPEN=1"
echo.
echo Acceso solo desde tu red privada de confianza.
echo La clave de acceso aparecera en esta consola.
echo No abras el puerto 4321 en el router ni expongas HTTP a Internet.
echo.
node server.mjs
set "RC=%ERRORLEVEL%"
echo.
echo Lucian finalizo con codigo %RC%.
pause
popd
exit /b %RC%
