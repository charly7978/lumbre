@echo off
chcp 65001 >nul
cd /d "%~dp0"
:LOOP
rem Si cloudflared no esta corriendo, levantarlo de nuevo
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | find /i "cloudflared.exe" >nul
if errorlevel 1 (
  echo [%date% %time%] Tunel caido, reconectando... >> vigilar.log
  if exist "tunnel.log" del "tunnel.log" /f /q
  if exist "url.txt" del "url.txt" /f /q
  start "LUCIAN-TUNEL" /MIN cmd /c "cloudflared.exe tunnel --url http://localhost:4321 > tunnel.log 2>&1"
)
rem Esperar 30 segundos antes de volver a revisar
ping -n 30 127.0.0.1 >nul
goto LOOP
