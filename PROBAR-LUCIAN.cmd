@echo off
setlocal
if not exist "%~dp0lumbre\PROBAR-LUCIAN.cmd" (
  echo ERROR: No se encontro lumbre\PROBAR-LUCIAN.cmd.
  pause
  exit /b 1
)
call "%~dp0lumbre\PROBAR-LUCIAN.cmd"
exit /b %ERRORLEVEL%
