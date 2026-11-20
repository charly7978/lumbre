@echo off
title LUCIAN - Acceso desde cualquier lugar
cd /d "%~dp0lumbre"
set LUCIAN_PORT=4321
set LUCIAN_HOST=0.0.0.0

cls
echo.
echo  ============================================================
echo   LUCIAN - ACCESO DESDE CUALQUIER LUGAR
echo  ============================================================
echo.
echo  No toques nada. Espera un momento...
echo.

where node >nul 2>nul
if errorlevel 1 goto SINNODE

if not exist "cloudflared.exe" (
  echo  Descargando el conector (primera vez)...
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe' -TimeoutSec 300"
)

echo  [1/3] Encendiendo Lucian...
start "LUCIAN-SERVIDOR" /MIN cmd /c "node server.mjs"
ping -n 7 127.0.0.1 >nul

echo  [2/3] Abriendo la conexion...
if exist "tunnel.log" del "tunnel.log" /f /q
if exist "url.txt" del "url.txt" /f /q
start "LUCIAN-TUNEL" /MIN cmd /c "cloudflared.exe tunnel --url http://localhost:4321 > tunnel.log 2>&1"

echo  [3/3] Buscando la direccion...
set INTENTOS=0
:ESPERAR
set /a INTENTOS+=1
if %INTENTOS% GTR 45 goto SINURL
set "URL="
if exist "url.txt" del "url.txt" /f /q
powershell -NoProfile -Command "$t=Get-Content tunnel.log -Raw -ErrorAction SilentlyContinue; if($t -match 'https://[a-z0-9-]+\.trycloudflare\.com'){Write-Output $matches[0]}" > "url.txt" 2>nul
set /p URL=<"url.txt"
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
echo    Al abrirla, entra directo. Sin clave.
echo.
echo    NO cierres esta ventana ni apagues la PC.
echo.
echo  ============================================================
echo.
>DIRECCION-LUCIAN.txt echo DIRECCION DE LUCIAN PARA EL CELULAR
>>DIRECCION-LUCIAN.txt echo.
>>DIRECCION-LUCIAN.txt echo %URL%
>>DIRECCION-LUCIAN.txt echo.
>>DIRECCION-LUCIAN.txt echo Copia esa direccion y mandala por WhatsApp.
>>DIRECCION-LUCIAN.txt echo NO cierres la ventana negra ni apagues la PC.
start notepad "DIRECCION-LUCIAN.txt"

:VIGILAR
ping -n 20 127.0.0.1 >nul
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | find /i "cloudflared.exe" >nul
if errorlevel 1 (
  echo  Reconectando...
  if exist "tunnel.log" del "tunnel.log" /f /q
  start "LUCIAN-TUNEL" /MIN cmd /c "cloudflared.exe tunnel --url http://localhost:4321 > tunnel.log 2>&1"
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
