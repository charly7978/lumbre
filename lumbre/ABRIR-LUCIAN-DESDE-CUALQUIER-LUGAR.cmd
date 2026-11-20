@echo off
chcp 65001 >nul
title LUCIAN // ACCESO REMOTO
cd /d "%~dp0lumbre"
set LUCIAN_PORT=4321
set LUCIAN_HOST=127.0.0.1
color 0F

cls
powershell -NoProfile -Command "Write-Host ''; Write-Host '  _     ___  _   _  ___  _   _  ___  _   _  ___  ' -ForegroundColor Cyan; Write-Host ' | |   |_ _|| \ | |/ __|| \ | |/ __|| | | |/ __| ' -ForegroundColor Cyan; Write-Host ' | |__  | | |  \| |\__ \|  \| |\__ \| |_| |\__ \ ' -ForegroundColor Cyan; Write-Host ' |____||___||_|\__||___/|_|\__||___/ \___/ |___/ ' -ForegroundColor Cyan; Write-Host ''; Write-Host '  >>> SISTEMA DE VENTAS / ACCESO REMOTO <<<' -ForegroundColor Green; Write-Host '  --------------------------------------------------------' -ForegroundColor DarkGray; Write-Host ''"

where node >nul 2>nul
if errorlevel 1 goto SINNODE
if not exist "cloudflared.exe" goto SINTUNNEL

powershell -NoProfile -Command "Write-Host '  [1/3] Encendiendo el nucleo del sistema...' -ForegroundColor Yellow"
start "LUCIAN-SERVIDOR" /MIN cmd /c "node server.mjs"
ping -n 7 127.0.0.1 >nul

powershell -NoProfile -Command "Write-Host '  [2/3] Estableciendo tunel seguro...' -ForegroundColor Yellow"
if exist "tunnel.log" del "tunnel.log" /f /q
if exist "url.txt" del "url.txt" /f /q
start "LUCIAN-TUNEL" /MIN cmd /c "cloudflared.exe tunnel --url http://localhost:4321 > tunnel.log 2>&1"

powershell -NoProfile -Command "Write-Host '  [3/3] Sincronizando direccion publica...' -ForegroundColor Yellow"
set INTENTOS=0
:ESPERAR
set /a INTENTOS+=1
if %INTENTOS% GTR 45 goto SINURL
set "URL="
if exist "url.txt" del "url.txt" /f /q
powershell -NoProfile -Command "$t=Get-Content tunnel.log -Raw -ErrorAction SilentlyContinue; if($t -match 'https://[a-z0-9-]+\.trycloudflare\.com'){Write-Output $matches[0]}" > "url.txt" 2>nul
set /p URL=<"url.txt"
if defined URL goto MOSTRAR
powershell -NoProfile -Command "Write-Host ('       ... esperando senal ' + '.' * (%INTENTOS% %% 4)) -ForegroundColor DarkCyan"
ping -n 3 127.0.0.1 >nul
goto ESPERAR

:MOSTRAR
cls
powershell -NoProfile -Command "$u=Get-Content url.txt -Raw; $u=$u.Trim(); Write-Host ''; Write-Host '  ================================================================' -ForegroundColor Cyan; Write-Host '                                                                ' -ForegroundColor Cyan; Write-Host '     [*] LUCIAN ESTA ONLINE' -ForegroundColor Green; Write-Host '                                                                ' -ForegroundColor Cyan; Write-Host '     TU DIRECCION PUBLICA:' -ForegroundColor DarkCyan; Write-Host ''; Write-Host ('        ' + $u) -ForegroundColor Yellow; Write-Host ''; Write-Host '     Copia esa direccion y mandala por WhatsApp.' -ForegroundColor White; Write-Host '     Se abrio un Bloc de notas con el mismo texto.' -ForegroundColor DarkGray; Write-Host ''; Write-Host '  [!] NO cierres esta ventana mientras alguien use Lucian.' -ForegroundColor Magenta; Write-Host '                                                                ' -ForegroundColor Cyan; Write-Host '  ================================================================' -ForegroundColor Cyan; Write-Host ''"
echo DIRECCION PARA ABRIR LUCIAN DESDE CUALQUIER LUGAR> "DIRECCION-LUCIAN.txt"
echo.>> "DIRECCION-LUCIAN.txt"
echo %URL%>> "DIRECCION-LUCIAN.txt"
echo.>> "DIRECCION-LUCIAN.txt"
echo Copia esa direccion y mandala por WhatsApp.>> "DIRECCION-LUCIAN.txt"
echo NO cierres la ventana negra mientras alguien use Lucian.>> "DIRECCION-LUCIAN.txt"
start notepad "DIRECCION-LUCIAN.txt"
pause
exit /b 0

:SINNODE
powershell -NoProfile -Command "Write-Host '  [X] No se encontro Node.js. Instalalo desde https://nodejs.org' -ForegroundColor Red; Write-Host ''"
pause
exit /b 1

:SINTUNNEL
powershell -NoProfile -Command "Write-Host '  [X] No se encontro cloudflared.exe en la carpeta lumbre.' -ForegroundColor Red; Write-Host ''"
pause
exit /b 1

:SINURL
powershell -NoProfile -Command "Write-Host '  [X] No se pudo obtener la direccion. Revisa internet y proba de nuevo.' -ForegroundColor Red; Write-Host ''"
pause
exit /b 1
