@echo off
title LUCIAN - Acceso desde cualquier lugar

rem --- Ruta fija a la carpeta real de Lucian ---
set "BASE=C:\Users\carlo.ROLITO\Downloads\Sistema-Ventas-Lamparas\lumbre\"
cd /d "%BASE%"

cls
echo.
echo  ============================================================
echo   LUCIAN - ACCESO DESDE CUALQUIER LUGAR
echo  ============================================================
echo.
echo  Preparando... no toques nada.
echo.

where node >nul 2>nul
if errorlevel 1 goto SINNODE

echo  Cerrando conexiones anteriores...
powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 4321 -State Listen -ErrorAction SilentlyContinue; foreach($p in $c){Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue}; Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*server.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Get-CimInstance Win32_Process -Filter \"name='cloudflared.exe'\" | Where-Object { $_.CommandLine -like '*--url*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
ping -n 4 127.0.0.1 >nul

if not exist "%BASE%cloudflared.exe" (
  echo  Descargando el conector ^(primera vez^)...
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%BASE%cloudflared.exe' -TimeoutSec 300"
)

rem --- Archivos auxiliares con rutas absolutas ---
> "%BASE%_lucian_start.cmd" echo @echo off
>> "%BASE%_lucian_start.cmd" echo cd /d "%BASE%"
>> "%BASE%_lucian_start.cmd" echo set "LUCIAN_DATA_DIR=%BASE%data"
>> "%BASE%_lucian_start.cmd" echo set "LUCIAN_HOST=0.0.0.0"
>> "%BASE%_lucian_start.cmd" echo set "LUCIAN_PORT=4321"
>> "%BASE%_lucian_start.cmd" echo set "LUCIAN_NO_OPEN=1"
>> "%BASE%_lucian_start.cmd" echo node "%BASE%server.mjs"

echo  [1/3] Encendiendo Lucian...
start "LUCIAN-SERVIDOR" /MIN "%BASE%_lucian_start.cmd"
ping -n 7 127.0.0.1 >nul

echo  [2/3] Abriendo la conexion...
if exist "%BASE%url.txt" del "%BASE%url.txt" /f /q
if exist "%BASE%tunnel.log" del "%BASE%tunnel.log" /f /q
start "LUCIAN-TUNEL" /MIN powershell -NoProfile -ExecutionPolicy Bypass -File "%BASE%_lucian_watch.ps1"

echo  [3/3] Buscando la direccion...
set INTENTOS=0
:ESPERAR
set /a INTENTOS+=1
if %INTENTOS% GTR 60 goto SINURL
set "URL="
if exist "%BASE%url.txt" (
  set /p URL=<"%BASE%url.txt"
)
if defined URL goto MOSTRAR
echo        esperando... (%INTENTOS%)
ping -n 3 127.0.0.1 >nul
goto ESPERAR

:MOSTRAR
cls
echo.
echo  ============================================================
echo.
echo    LUCIAN ESTA LISTO
echo.
echo    Esta es la direccion para el celular:
echo.
echo           %URL%
echo.
echo    Copiala y mandala por WhatsApp.
echo    Si se corta, se reconecta sola con otra direccion.
echo    Mirsiempre la direccion en DIRECCION-LUCIAN.txt
echo.
echo    NO cierres esta ventana ni apagues la PC.
echo.
echo  ============================================================
echo.
start notepad "%BASE%DIRECCION-LUCIAN.txt"
start "" "%URL%"

:VIGILAR
ping -n 30 127.0.0.1 >nul
set "ACTUAL="
if exist "%BASE%url.txt" set /p ACTUAL=<"%BASE%url.txt"
if not "%ACTUAL%"=="%URL%" (
  echo  La direccion cambio. Actualizando...
  set "URL=%ACTUAL%"
  start "" "%URL%"
)
goto VIGILAR

:SINNODE
echo  Falta Node.js. Instalalo desde https://nodejs.org
pause
exit /b 1

:SINURL
echo  No se pudo obtener la direccion. Revisa internet y proba de nuevo.
pause
exit /b 1
