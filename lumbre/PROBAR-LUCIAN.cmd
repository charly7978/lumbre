@echo off
setlocal
title Lucian - verificacion segura
pushd "%~dp0" 2>nul
if errorlevel 1 (
  echo ERROR: No se pudo abrir la carpeta de Lucian.
  pause
  exit /b 1
)
if not exist "package.json" (
  echo ERROR: Falta package.json en esta carpeta.
  pause
  popd
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Instala Node.js 20 o superior desde https://nodejs.org
  pause
  popd
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm no se encuentra en PATH.
  pause
  popd
  exit /b 1
)
echo.
echo ==============================================================
echo  VERIFICACION LOCAL DE LUCIAN
echo ==============================================================
echo.
echo Se ejecutaran pruebas locales sin enviar correos ni publicar
echo productos. No se necesita conectar Meta, Resend ni Telegram.
echo.
node --version
npm --version
echo.
call npm test
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo [OK] Las pruebas terminaron correctamente.
) else (
  echo [ERROR] Las pruebas fallaron con codigo %RC%.
  echo Copia el mensaje de error de esta ventana para diagnosticarlo.
)
echo.
echo Esta ventana permanecera abierta hasta que presiones una tecla.
pause
popd
exit /b %RC%
