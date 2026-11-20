@echo off
chcp 65001 >nul
title LUCIAN // ACCESO REMOTO
cd /d "%~dp0lumbre"
set LUCIAN_PORT=4321
set LUCIAN_HOST=0.0.0.0
color 0F

cls
powershell -NoProfile -Command "Write-Host ''; Write-Host '  _     ___  _   _  ___  _   _  ___  _   _  ___  ' -ForegroundColor Cyan; Write-Host ' | |   |_ _|| \ | |/ __|| \ | |/ __|| | | |/ __| ' -ForegroundColor Cyan; Write-Host ' | |__  | | |  \| |\__ \|  \| |\__ \| |_| |\__ \ ' -ForegroundColor Cyan; Write-Host ' |____||___||_|\__||___/|_|\__||___/ \___/ |___/ ' -ForegroundColor Cyan; Write-Host ''; Write-Host '  >>> SISTEMA DE VENTAS / ACCESO REMOTO <<<' -ForegroundColor Green; Write-Host '  --------------------------------------------------------' -ForegroundColor DarkGray; Write-Host ''"

where node >nul 2>nul
if errorlevel 1 goto SINNODE

rem --- Descargar cloudflared si no está ---
if not exist "cloudflared.exe" (
  echo  [1/5] Descargando el conector seguro ^(primera vez, 55 MB^)...
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue"; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe' -TimeoutSec 300"
  if not exist "cloudflared.exe" goto SINTUNNEL
) else (
  echo  [1/5] Conector seguro: listo
)

echo  [2/5] Encendiendo el nucleo del sistema...
start "LUCIAN-SERVIDOR" /MIN cmd /c "node server.mjs"
ping -n 7 127.0.0.1 >nul

echo  [3/5] Abriendo la conexion segura...
if exist "tunnel.log" del "tunnel.log" /f /q
if exist "url.txt" del "url.txt" /f /q
start "LUCIAN-TUNEL" /MIN cmd /c "cloudflared.exe tunnel --url http://localhost:4321 > tunnel.log 2>&1"
rem Guardia: si el tunel se cae, lo reconecta solo cada 30 s
start "LUCIAN-GUARDIA" /MIN cmd /c "vigilar-tunel.cmd"

echo  [4/5] Buscando la direccion publica...
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
echo  [5/5] Armando la direccion directa...
set "CLAVE="
if exist "access-key.txt" set /p CLAVE=<"access-key.txt"
set "URLFINAL=%URL%"
if not "%CLAVE%"=="" set "URLFINAL=%URL%?access=%CLAVE%"

set LUCIAN_URLFINAL=%URLFINAL%
cls
powershell -NoProfile -Command "$u=$env:LUCIAN_URLFINAL; Write-Host ''; Write-Host '  ================================================================' -ForegroundColor Cyan; Write-Host '                                                                ' -ForegroundColor Cyan; Write-Host '     [*] LUCIAN ESTA ONLINE' -ForegroundColor Green; Write-Host '                                                                ' -ForegroundColor Cyan; Write-Host '     TU DIRECCION PARA ABRIR EN EL CELULAR:' -ForegroundColor DarkCyan; Write-Host ''; Write-Host ('        ' + $u) -ForegroundColor Yellow; Write-Host ''; Write-Host '     Copia TODA esa direccion y mandala por WhatsApp.' -ForegroundColor White; Write-Host '     Al abrirla, entra directo. NO hay que escribir clave.' -ForegroundColor White; Write-Host ''; Write-Host '  [!] NO cierres esta ventana ni apagues la PC mientras' -ForegroundColor Red; Write-Host '      alguien use Lucian. Si se corta, la guardia reconecta.' -ForegroundColor Red; Write-Host '                                                                ' -ForegroundColor Cyan; Write-Host '  ================================================================' -ForegroundColor Cyan; Write-Host ''" 2>nul
set LUCIAN_URLFINAL=%URLFINAL%
echo DIRECCION PARA ABRIR LUCIAN EN EL CELULAR> "DIRECCION-LUCIAN.txt"
echo.>> "DIRECCION-LUCIAN.txt"
echo %URLFINAL%>> "DIRECCION-LUCIAN.txt"
echo.>> "DIRECCION-LUCIAN.txt"
echo Copia TODA esa direccion y mandala por WhatsApp.>> "DIRECCION-LUCIAN.txt"
echo Al abrirla entra directo, sin escribir clave.>> "DIRECCION-LUCIAN.txt"
echo NO cierres la ventana negra ni apagues la PC.>> "DIRECCION-LUCIAN.txt"
start notepad "DIRECCION-LUCIAN.txt"
echo.
echo  Manteniendo la conexion viva. Si se corta, se reconecta sola.
echo  NO cierres esta ventana.

:VIGILAR
ping -n 20 127.0.0.1 >nul
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | find /i "cloudflared.exe" >nul
if errorlevel 1 (
  echo  [%time%] Reconectando el tunel...
  if exist "tunnel.log" del "tunnel.log" /f /q
  start "LUCIAN-TUNEL" /MIN cmd /c "cloudflared.exe tunnel --url http://localhost:4321 > tunnel.log 2>&1"
  rem esperar a que aparezca la nueva direccion
  set INTENTOS=0
  :REESPERAR
  set /a INTENTOS+=1
  if %INTENTOS% GTR 20 goto VIGILAR
  set "NUEVAURL="
  if exist "url.txt" del "url.txt" /f /q
  powershell -NoProfile -Command "$t=Get-Content tunnel.log -Raw -ErrorAction SilentlyContinue; if($t -match 'https://[a-z0-9-]+\.trycloudflare\.com'){Write-Output $matches[0]}" > "url.txt" 2>nul
  set /p NUEVAURL=<"url.txt"
  if defined NUEVAURL (
    set "URL=%NUEVAURL%"
    set "URLFINAL=%NUEVAURL%?access=%CLAVE%"
    echo DIRECCION PARA ABRIR LUCIAN EN EL CELULAR> "DIRECCION-LUCIAN.txt"
    echo.>> "DIRECCION-LUCIAN.txt"
    echo %URLFINAL%>> "DIRECCION-LUCIAN.txt"
    echo.>> "DIRECCION-LUCIAN.txt"
    echo Copia TODA esa direccion y mandala por WhatsApp.>> "DIRECCION-LUCIAN.txt"
    echo Al abrirla entra directo, sin escribir clave.>> "DIRECCION-LUCIAN.txt"
    echo NO cierres la ventana negra ni apagues la PC.>> "DIRECCION-LUCIAN.txt"
    echo  [%time%] Tunel reconectado. Nueva direccion guardada.
  ) else (
    ping -n 3 127.0.0.1 >nul
    goto REESPERAR
  )
)
goto VIGILAR
exit /b 0

:SINNODE
powershell -NoProfile -Command "Write-Host '  [X] No se encontro Node.js. Instalalo desde https://nodejs.org' -ForegroundColor Red"
pause
exit /b 1

:SINTUNNEL
powershell -NoProfile -Command "Write-Host '  [X] No se pudo descargar cloudflared. Revisa la conexion a internet.' -ForegroundColor Red"
pause
exit /b 1

:SINURL
powershell -NoProfile -Command "Write-Host '  [X] No se pudo obtener la direccion. Revisa internet y proba de nuevo.' -ForegroundColor Red"
pause
exit /b 1
