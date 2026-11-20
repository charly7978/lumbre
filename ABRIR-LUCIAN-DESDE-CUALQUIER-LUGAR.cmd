@echo off
setlocal
if not exist "%~dp0lumbre\ABRIR-LUCIAN-DESDE-CUALQUIER-LUGAR.cmd" (
  echo No se encontro el iniciador remoto en la carpeta lumbre.
  pause
  exit /b 1
)
call "%~dp0lumbre\ABRIR-LUCIAN-DESDE-CUALQUIER-LUGAR.cmd"
