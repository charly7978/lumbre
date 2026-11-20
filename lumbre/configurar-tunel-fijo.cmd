@echo off
chcp 65001 >nul
title LUCIAN - Configurar dirección fija
cd /d "%~dp0"

cls
echo.
echo  ============================================================
echo   LUCIAN - DIRECCION FIJA (Cloudflare Tunnel)
echo  ============================================================
echo.
echo Este asistente crea una direccion que NO cambia nunca,
echo aunque apagues la PC: https://lucian.TU-DOMINIO.com
echo.
echo  NECESITAS:
echo   1) Una cuenta gratis en https://dash.cloudflare.com
echo   2) Un dominio agregado a Cloudflare (puede ser gratis
echo      con workers.dev o uno comprado).
echo.
echo  Si todavia no lo tenes, abrí https://dash.cloudflare.com
echo  y agregá tu dominio antes de continuar.
echo.
echo ------------------------------------------------------------
echo.
set /p DOMINIO="Escribí tu dominio (ej: lucian.tudominio.com): "
if "%DOMINIO%"=="" goto :SINDOMINIO

echo.
echo  Paso 1/3: Abriendo la pagina para que inicies sesion en Cloudflare...
start "" "https://dash.cloudflare.com/login"

echo.
echo  Paso 2/3: cuando ya iniciaste sesion, apreta cualquier tecla.
pause >nul

echo.
echo  Paso 3/3: Creando el tunel llamado "lucian"...
cloudflared.exe tunnel create lucian
if errorlevel 1 goto :ERRORCREAR

echo.
echo  ------------------------------------------------------------
echo   LISTO. El tunel "lucian" fue creado.
echo  ------------------------------------------------------------
echo.
echo  Ahora hay que hacer DOS cosas en la web de Cloudflare:
echo.
echo  1) En Cloudflare Dashboard ^> Zero Trust ^> Networks ^> Tunnels
echo     vas a ver el tunel "lucian". Copiá su ID (TUNNEL_ID).
echo.
echo  2) En la configuracion del tunel, pestaña "Public Hostname",
echo     agregá:
echo        Subdomain: lucian
echo        Domain: TU-DOMINIO.com
echo        Service:  HTTP   localhost:4321
echo.
echo  Despues volvé aca y ejecutá INICIAR-LUCIAN-FIJO.cmd
echo.
echo  Tu direccion va a ser: https://%DOMINIO%
echo.
echo ------------------------------------------------------------
>DOMINIO.txt echo %DOMINIO%
pause
exit /b 0

:SINDOMINIO
echo  No escribiste un dominio.Probá de nuevo.
pause
exit /b 1

:ERRORCREAR
echo  No se pudo crear el tunel.Revisá que hayas iniciado sesion en Cloudflare.
pause
exit /b 1
