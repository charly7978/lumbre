@echo off
setlocal
title Lucian - verificar instalacion
set "BASE=%~dp0"
if exist "%BASE%lumbre\package.json" if exist "%BASE%lumbre\tools\test-security.mjs" goto SUBCARPETA
if exist "%BASE%package.json" if exist "%BASE%tools\test-security.mjs" goto CARPETA_ACTUAL
if exist "%BASE%lumbre\lumbre\package.json" if exist "%BASE%lumbre\lumbre\tools\test-security.mjs" goto SUBCARPETA_DOBLE

echo.
echo ERROR: No encuentro la version corregida de Lucian en esta carpeta.
echo.
echo Debes DESCARGAR EL ZIP COMPLETO DE LA RAMA DE PRUEBA, no un .cmd suelto.
echo Abrir: https://github.com/charly7978/lumbre/tree/fix/lumbre-seguridad-envios-20261120
echo Luego: Code - Download ZIP - Extraer TODO.
echo.
echo En la carpeta correcta deben existir:
echo    lumbre\package.json
echo    lumbre\tools\test-security.mjs
echo.
echo Carpeta desde la que se intento iniciar:
echo    %BASE%
echo.
echo No se borro, movio ni altero ningun archivo.
pause
exit /b 1

:SUBCARPETA
set "BASE=%BASE%lumbre"
goto PRUEBA

:CARPETA_ACTUAL
goto PRUEBA

:SUBCARPETA_DOBLE
set "BASE=%BASE%lumbre\lumbre"
goto PRUEBA

:PRUEBA
pushd "%BASE%" 2>nul
if errorlevel 1 (
  echo ERROR: No pude ingresar en la carpeta de Lucian.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Falta Node.js 20 o superior: https://nodejs.org/
  pause
  popd
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: Falta npm, incluido normalmente con Node.js.
  pause
  popd
  exit /b 1
)
echo.
echo Ejecutando las pruebas de la version corregida.
echo No se enviaran correos ni se activaran campanas.
echo Carpeta: %CD%
echo.
call npm test
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo [OK] PRUEBAS APROBADAS.
) else (
  echo [ERROR] Hay pruebas fallidas. Codigo: %RC%.
)
echo.
echo La ventana quedara abierta para consultar el resultado.
pause
popd
exit /b %RC%
