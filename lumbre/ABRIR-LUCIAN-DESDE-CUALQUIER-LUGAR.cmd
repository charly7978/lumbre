@echo off
setlocal
title Lucian - acceso remoto protegido
pushd "%~dp0" 2>nul
if errorlevel 1 (
  echo No se pudo entrar a la carpeta de Lucian.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 20 o superior.
  pause
  popd
  exit /b 1
)
where cloudflared >nul 2>nul
if errorlevel 1 (
  if not exist "cloudflared.exe" (
    echo Instala cloudflared desde la pagina oficial de Cloudflare.
    echo No se descarga ni ejecuta software automaticamente.
    pause
    popd
    exit /b 1
  )
  set "CLOUDFLARED=%CD%\cloudflared.exe"
) else (
  set "CLOUDFLARED=cloudflared"
)
set "LUCIAN_HOST=127.0.0.1"
set "LUCIAN_PORT=4321"
set "LUCIAN_NO_OPEN=1"
set "LUCIAN_REQUIRE_AUTH=1"
rem Evitar que el tunel apunte por accidente a otro servicio en el puerto 4321.
powershell -NoProfile -Command "if (Get-NetTCPConnection -State Listen -LocalPort 4321 -ErrorAction SilentlyContinue) { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo El puerto 4321 ya esta ocupado. Cerra la instancia anterior de Lucian.
  echo No se abrira el tunel para evitar exponer otra aplicacion.
  pause
  popd
  exit /b 1
)
echo.
echo Iniciando Lucian y un tunel HTTPS.
echo La URL publica NO concede acceso sin la clave de esta PC.
echo No cierres las ventanas de Lucian ni de Cloudflare.
echo.
start "LUCIAN-SERVIDOR" cmd /k "node server.mjs"
timeout /t 4 /nobreak >nul
start "LUCIAN-TUNEL" cmd /k ""%CLOUDFLARED%" tunnel --url http://127.0.0.1:4321"
echo.
echo En LUCIAN-TUNEL aparecera la direccion https://...trycloudflare.com
echo Copiala al celular. Al abrirla, escribi la clave mostrada
echo en LUCIAN-SERVIDOR. Nunca compartas esa clave por URL.
echo.
pause
popd
