@echo off
title Lucian - sistema de ventas para lamparas de diseno
<<<<<<< HEAD
rem pushd soporta rutas compartidas (\\servidor\carpeta) que cd /d no maneja.
pushd "%~dp0" 2>nul
if errorlevel 1 (
  echo.
  echo No se pudo entrar a la carpeta de Lucian.
  echo Copia la carpeta "lucian" a una ruta local, por ejemplo C:\Lucian, y vuelve a intentar.
  echo Ruta intentada: %~dp0
  echo.
  pause
  exit /b 1
)
if not exist "server.mjs" (
  echo.
  echo No se encontro server.mjs en esta carpeta.
  echo Asegurate de abrir INICIAR-LUCIAN.cmd desde la carpeta "lucian" original.
  echo Carpeta actual: %CD%
  echo.
  pause
  exit /b 1
)
=======
cd /d "%~dp0lucian"
>>>>>>> 5b6030d9393a9bad5a7615677c7673632fc7ba63
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo No se encontro Node.js. Instala Node 20 o superior desde https://nodejs.org
  echo y vuelve a abrir este archivo.
  echo.
  pause
  exit /b 1
)
node server.mjs
<<<<<<< HEAD
popd
=======
>>>>>>> 5b6030d9393a9bad5a7615677c7673632fc7ba63
echo.
echo Lucian se cerro. Presiona una tecla para salir.
pause