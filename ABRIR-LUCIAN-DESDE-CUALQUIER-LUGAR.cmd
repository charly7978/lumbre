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
echo  [5/5] Leyendo la clave de acceso...
set "CLAVE="
if exist "access-key.txt" set /p CLAVE=<"access-key.txt"
if "%CLAVE%"=="" set "CLAVE=(la clave aparece en la ventana negra LUCIAN-SERVIDOR)"
set LUCIAN_CLAVE=%CLAVE%

cls
powershell -NoProfile -Command "$u=Get-Content url.txt -Raw; $u=$u.Trim(); $k=$env:LUCIAN_CLAVE; Write-Host ''; Write-Host '  ================================================================' -ForegroundColor Cyan; Write-Host '                                                                ' -ForegroundColor Cyan; Write-Host '     [*] LUCIAN ESTA ONLINE' -ForegroundColor Green; Write-Host '                                                                ' -ForegroundColor Cyan; Write-Host '     TU DIRECCION PUBLICA:' -ForegroundColor DarkCyan; Write-Host ''; Write-Host ('        ' + $u) -ForegroundColor Yellow; Write-Host ''; Write-Host '     CLAVE DE ACCESO (pedila en la PC de origen):' -ForegroundColor DarkCyan; Write-Host ('        ' + $k) -ForegroundColor Magenta; Write-Host ''; Write-Host '     En la otra PC: abrir la direccion, pegar la clave' -ForegroundColor White; Write-Host '     y mandarme el texto que aparece.' -ForegroundColor White; Write-Host ''; Write-Host '  [!] NO cierres esta ventana mientras alguien use Lucian.' -ForegroundColor Red; Write-Host '                                                                ' -ForegroundColor Cyan; Write-Host '  ================================================================' -ForegroundColor Cyan; Write-Host ''"
echo DIRECCION PARA ABRIR LUCIAN DESDE CUALQUIER LUGAR> "DIRECCION-LUCIAN.txt"
echo.>> "DIRECCION-LUCIAN.txt"
echo %URL%>> "DIRECCION-LUCIAN.txt"
echo.>> "DIRECCION-LUCIAN.txt"
echo Clave de acceso: %CLAVE%>> "DIRECCION-LUCIAN.txt"
echo.>> "DIRECCION-LUCIAN.txt"
echo Copia esto y mandalo por WhatsApp.>> "DIRECCION-LUCIAN.txt"
echo NO cierres la ventana negra mientras alguien use Lucian.>> "DIRECCION-LUCIAN.txt"
start notepad "DIRECCION-LUCIAN.txt"
pause
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
