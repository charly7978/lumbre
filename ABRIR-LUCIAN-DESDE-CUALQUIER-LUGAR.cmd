@echo off
title LUCIAN - ACCESO DESDE CUALQUIER LUGAR
cd /d "%~dp0lumbre"
set LUCIAN_PORT=4321
set LUCIAN_HOST=127.0.0.1

echo.
echo  ============================================================
echo   LUCIAN - ACCESO DESDE CUALQUIER LUGAR
echo  ============================================================
echo.
echo  No toques nada. Espera un momento...
echo.

where node >nul 2>nul
if errorlevel 1 goto SINNODE
if not exist "cloudflared.exe" goto SINTUNNEL

rem --- Arrancar Lucian en una ventana aparte (minimizada) ---
start "LUCIAN-SERVIDOR" /MIN cmd /c "node server.mjs"

rem --- Esperar a que Lucian este listo ---
echo  Encendiendo el sistema...
timeout /t 6 >nul

rem --- Limpiar archivos viejos ---
if exist "tunnel.log" del "tunnel.log" /f /q
if exist "url.txt" del "url.txt" /f /q

rem --- Arrancar el tunel de Cloudflare ---
echo  Abriendo la conexion segura...
start "LUCIAN-TUNEL" /MIN cmd /c "cloudflared.exe tunnel --url http://localhost:4321 > tunnel.log 2>&1"

rem --- Esperar a que aparezca la direccion publica ---
set INTENTOS=0
:ESPERAR
set /a INTENTOS+=1
if %INTENTOS% GTR 40 goto SINURL
set "URL="
powershell -NoProfile -Command "$t=Get-Content tunnel.log -Raw -ErrorAction SilentlyContinue; if($t -match 'https://[a-z0-9-]+\.trycloudflare\.com'){Write-Output $matches[0]}" > url.txt 2>nul
set /p URL=<url.txt
if defined URL goto MOSTRAR
timeout /t 2 >nul
goto ESPERAR

:MOSTRAR
cls
echo.
echo  ============================================================
echo.
echo    LUCIAN YA ESTA LISTO
echo.
echo    Esta es la direccion para abrir Lucian desde cualquier lugar:
echo.
echo           %URL%
echo.
echo    Copia esa direccion (seleccionala y ctrl+C) y mandala
echo    por WhatsApp a quien tenga que ver el sistema.
echo.
echo    IMPORTANTE: NO cierres esta ventana ni apagues la PC
echo    mientras alguien este usando Lucian.
echo.
echo  ============================================================
echo.
pause
exit /b 0

:SINNODE
echo  ERROR: No se encontro Node.js.
echo  Instalalo desde https://nodejs.org y volve a abrir este archivo.
echo.
pause
exit /b 1

:SINTUNNEL
echo  ERROR: No se encontro cloudflared.exe en la carpeta lumbre.
echo.
pause
exit /b 1

:SINURL
echo  No se pudo obtener la direccion publica.
echo  Revisa si hay conexion a internet y volve a abrir el archivo.
echo.
pause
exit /b 1
