@echo off
title LUCIAN - Direccion fija
cd /d "%~dp0"
set LUCIAN_PORT=4321
set LUCIAN_HOST=0.0.0.0

cls
echo.
echo  ============================================================
echo   LUCIAN - DIRECCION FIJA
echo  ============================================================
echo.

set "DOMINIO="
if exist "DOMINIO.txt" set /p DOMINIO=<"DOMINIO.txt"
if "%DOMINIO%"=="" set "DOMINIO=lucian.tudominio.com"

where node >nul 2>nul
if errorlevel 1 goto SINNODE

echo  [1/3] Encendiendo el sistema...
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /i "node.exe" >nul
if errorlevel 1 start "LUCIAN-SERVIDOR" /MIN cmd /c "node server.mjs"
ping -n 6 127.0.0.1 >nul

echo  [2/3] Leyendo la clave de acceso...
set "CLAVE="
if exist "access-key.txt" set /p CLAVE=<"access-key.txt"

echo  [3/3] Levantando el tunel fijo...
taskkill /F /IM cloudflared.exe 2>nul
set "URLFINAL=https://%DOMINIO%"
if not "%CLAVE%"=="" set "URLFINAL=https://%DOMINIO%?access=%CLAVE%"
start "LUCIAN-TUNEL-FIJO" /MIN cmd /c "cloudflared.exe tunnel run lucian"

cls
echo.
echo  ============================================================
echo   [*] LUCIAN ESTA ONLINE CON DIRECCION FIJA
echo.
echo   Tu direccion (nunca cambia):
echo.
echo        %URLFINAL%
echo.
echo   Copiala y mandala por WhatsApp. Siempre es la misma.
echo.
echo   NO cierres esta ventana ni apagues la PC mientras
echo   alguien use Lucian.
echo  ============================================================
echo.
>DIRECCION-LUCIAN.txt echo DIRECCION FIJA DE LUCIAN
>>DIRECCION-LUCIAN.txt echo.
>>DIRECCION-LUCIAN.txt echo %URLFINAL%
>>DIRECCION-LUCIAN.txt echo.
>>DIRECCION-LUCIAN.txt echo Copia TODA esa direccion y mandala por WhatsApp.
>>DIRECCION-LUCIAN.txt echo Siempre es la misma direccion, aunque apagues la PC.
start notepad "DIRECCION-LUCIAN.txt"
pause
exit /b 0

:SINNODE
echo  [X] No se encontro Node.js. Instalalo desde https://nodejs.org
pause
exit /b 1
