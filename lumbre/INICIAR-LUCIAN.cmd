@echo off
title LUCIAN - Acceso desde cualquier lugar

rem --- Carpeta canónica (portátil, sin rutas personales fijas) ---
set "BASE=%~dp0"
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
powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 4321 -State Listen -ErrorAction SilentlyContinue; foreach($p in $c){Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue}; Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*server.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>&1
ping -n 4 127.0.0.1 >nul

if not exist "%BASE%cloudflared.exe" (
  echo  Descargando el conector ^(primera vez^)...
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile '%BASE%cloudflared.exe' -TimeoutSec 300"
)

rem --- Archivos auxiliares con rutas absolutas (evita servidores vacios) ---
> "%BASE%\_lucian_start.cmd" echo @echo off
>> "%BASE%\_lucian_start.cmd" echo cd /d "%BASE%"
>> "%BASE%\_lucian_start.cmd" echo set "LUCIAN_DATA_DIR=%BASE%data"
>> "%BASE%\_lucian_start.cmd" echo set "LUCIAN_HOST=0.0.0.0"
>> "%BASE%\_lucian_start.cmd" echo set "LUCIAN_PORT=4321"
>> "%BASE%\_lucian_start.cmd" echo set "LUCIAN_NO_OPEN=1"
>> "%BASE%\_lucian_start.cmd" echo node "%BASE%server.mjs"

> "%BASE%\_lucian_tunnel.cmd" echo @echo off
>> "%BASE%\_lucian_tunnel.cmd" echo cd /d "%BASE%"
>> "%BASE%\_lucian_tunnel.cmd" echo "%BASE%cloudflared.exe" tunnel --url http://localhost:4321 ^> "%BASE%tunnel.log" 2^>^&1

echo  [1/3] Encendiendo Lucian...
start "LUCIAN-SERVIDOR" /MIN "%BASE%_lucian_start.cmd"
ping -n 7 127.0.0.1 >nul

echo  [2/3] Abriendo la conexion...
if exist "%BASE%url.txt" del "%BASE%url.txt" /f /q
start "LUCIAN-TUNEL" /MIN "%BASE%_lucian_tunnel.cmd"

echo  [3/3] Buscando la direccion...
set INTENTOS=0
:ESPERAR
set /a INTENTOS+=1
if %INTENTOS% GTR 45 goto SINURL
set "URL="
if exist "%BASE%url.txt" del "%BASE%url.txt" /f /q
powershell -NoProfile -Command "$t=Get-Content '%BASE%tunnel.log' -Raw -ErrorAction SilentlyContinue; if($t -match 'https://[a-z0-9-]+\.trycloudflare\.com'){Write-Output $matches[0]}" > "%BASE%url.txt" 2>nul
set /p URL=<"%BASE%url.txt"
if defined URL goto MOSTRAR
echo        esperando... (%INTENTOS%)
ping -n 3 127.0.0.1 >nul
goto ESPERAR

:MOSTRAR
rem Acceso remoto autenticado con enlace privado; el servidor elimina la clave de la URL al entrar.
set "ACCESS_KEY="
if not exist "%BASE%access-key.txt" goto SINCLAVE
set /p ACCESS_KEY=<"%BASE%access-key.txt"
if not defined ACCESS_KEY goto SINCLAVE
set "PRIVATE_URL=%URL%/?access=%ACCESS_KEY%"
cls
echo.
echo  ============================================================
echo.
echo    LUCIAN ESTA LISTO
echo.
echo    Esta es la direccion para el celular:
echo.
echo           %PRIVATE_URL%
echo.
echo    Este enlace es privado: no lo compartas con terceros.
echo    Al abrirlo el acceso se valida automaticamente.
echo.
echo    NO cierres esta ventana ni apagues la PC.
echo.
echo  ============================================================
echo.
>"%BASE%DIRECCION-LUCIAN.txt" echo DIRECCION DE LUCIAN PARA EL CELULAR
>>"%BASE%DIRECCION-LUCIAN.txt" echo.
>>"%BASE%DIRECCION-LUCIAN.txt" echo %PRIVATE_URL%
>>"%BASE%DIRECCION-LUCIAN.txt" echo.
>>"%BASE%DIRECCION-LUCIAN.txt" echo ENLACE PRIVADO: no lo compartas.
>>"%BASE%DIRECCION-LUCIAN.txt" echo NO cierres la ventana negra ni apagues la PC.
start notepad "%BASE%DIRECCION-LUCIAN.txt"
start "" "%PRIVATE_URL%"

:VIGILAR
ping -n 20 127.0.0.1 >nul
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | find /i "cloudflared.exe" >nul
if errorlevel 1 (
  echo  Reconectando...
  if exist "%BASE%tunnel.log" del "%BASE%tunnel.log" /f /q
  start "LUCIAN-TUNEL" /MIN "%BASE%_lucian_tunnel.cmd"
)
goto VIGILAR

:SINCLAVE
echo  No se genero la clave de acceso. Verifica que haya iniciado server.mjs.
pause
exit /b 1

:SINNODE
echo  Falta Node.js. Instalalo desde https://nodejs.org
pause
exit /b 1

:SINURL
echo  No se pudo obtener la direccion. Revisa internet y proba de nuevo.
pause
exit /b 1
