@echo off
title Lucian - compartir en red local
pushd "%~dp0" 2>nul
if errorlevel 1 (
  echo.
  echo No se pudo entrar a la carpeta de Lucian.
  echo Copia la carpeta a una ruta local, por ejemplo C:\Lucian.
  echo.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro Node.js. Instala Node 20 o superior desde https://nodejs.org
  echo.
  pause
  exit /b 1
)
echo.
echo ============================================================
echo  LUCIAN - MODO COMPARTIR EN RED LOCAL
echo ============================================================
echo.
echo  Buscando la IP de esta PC en la red...
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set IP=%%a
  goto :found
)
:found
set IP=%IP: =%
if "%IP%"=="" set IP=NO-ENCONTRADA
echo  Esta PC tiene la IP: %IP%
echo.
echo  En la OTRA PC, abrir el navegador y escribir:
echo.
echo      http://%IP%:4321
echo.
echo  (Si no funciona, fijate el puerto que muestra mas abajo,
echo   puede ser 4322, 4323, etc.)
echo.
echo  IMPORTANTE: ambas PCs deben estar en la MISMA red (WiFi/cable).
echo  IMPORTANTE: si no conecta, permitir Node.js en el Firewall de Windows.
echo.
echo ============================================================
echo.
set LUCIAN_HOST=0.0.0.0
node server.mjs
popd
echo.
echo Lucian se cerro. Presiona una tecla para salir.
pause