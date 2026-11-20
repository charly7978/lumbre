@echo off
setlocal
title Lucian - tunel fijo protegido
pushd "%~dp0" 2>nul
if errorlevel 1 (
  echo No se pudo abrir la carpeta de Lucian.
  pause
  exit /b 1
)
set "DOMINIO="
if exist "DOMINIO.txt" set /p DOMINIO=<"DOMINIO.txt"
if "%DOMINIO%"=="" (
  echo Configura DOMINIO.txt con el dominio publico real.
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
where cloudflared >nul 2>nul
if errorlevel 1 (
  if not exist "cloudflared.exe" (
    echo Instala cloudflared desde su pagina oficial.
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
set "LUCIAN_PUBLIC_HOST=%DOMINIO%"
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
start "LUCIAN-SERVIDOR" cmd /k "node server.mjs"
timeout /t 4 /nobreak >nul
start "LUCIAN-TUNEL-FIJO" cmd /k ""%CLOUDFLARED%" tunnel run lucian"
echo.
echo Direccion: https://%DOMINIO%
echo Se exigira la clave de acceso mostrada en LUCIAN-SERVIDOR.
echo No incluyas claves en enlaces, mensajes ni archivos publicos.
pause
popd
