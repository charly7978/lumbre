$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

trap {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Presiona Enter para cerrar"
    exit 1
}

$folder = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $folder

Write-Host ""
Write-Host "=============================================="
Write-Host "  CONFIGURACION ASISTIDA - SISTEMA DE VENTAS"
Write-Host "=============================================="
Write-Host ""
Write-Host "Si ya pegaste un token de Airtable en un chat,"
Write-Host "revocalo primero. No compartas el token nuevo."
Write-Host ""

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "No encontre Node.js instalado." -ForegroundColor Yellow
    Write-Host "Se va a abrir la pagina de descarga. Instala la version LTS,"
    Write-Host "cerra esta ventana y volve a ejecutar CONFIGURAR.cmd."
    Start-Process "https://nodejs.org/en/download"
    Read-Host "Presiona Enter para cerrar"
    exit 1
}

Write-Host "Paso 1: crear el token de Airtable."
Write-Host "Se va a abrir Airtable en el navegador."
Write-Host "Crea un token nuevo con estos permisos:"
Write-Host "  - data.records:read"
Write-Host "  - data.records:write"
Write-Host "  - schema.bases:read"
Write-Host "  - schema.bases:write"
Write-Host "En Access, elegi All current and future bases o el workspace donde estan tus bases."
Write-Host "Copia el token cuando Airtable lo muestre."
Write-Host ""
Start-Process "https://airtable.com/create/tokens"

$secure = Read-Host "Pega el token nuevo (no se va a mostrar)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
$token = $token.Trim()

if (-not $token.StartsWith("pat")) {
    Write-Host "El token no empieza con pat. Revisalo y volve a ejecutar." -ForegroundColor Red
    Read-Host "Presiona Enter para cerrar"
    exit 1
}

Write-Host ""
Write-Host "Paso 2: buscar tu base."
Write-Host "El asistente va a listar las bases de tu cuenta."
Write-Host "Si tenes una sola, la usa automaticamente."
Write-Host "Si tenes varias, elegi el numero."
Write-Host "Si no tenes ninguna, crea una en Airtable: + Create > Build an app on your own."
Write-Host ""
Start-Process "https://airtable.com/"

$env:AIRTABLE_TOKEN = $token
Remove-Item Env:AIRTABLE_BASE_ID -ErrorAction SilentlyContinue
Remove-Item Env:AIRTABLE_WORKSPACE_ID -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Buscando la base y creando las tablas..."
Write-Host ""

node airtable_setup.mjs
$exitCode = $LASTEXITCODE

Remove-Item Env:AIRTABLE_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:AIRTABLE_BASE_ID -ErrorAction SilentlyContinue

Write-Host ""
if ($exitCode -ne 0) {
    Write-Host "Hubo un error. Copia el texto de arriba y mandalo." -ForegroundColor Red
    Read-Host "Presiona Enter para cerrar"
    exit $exitCode
}

Write-Host "Listo. Las tablas y los archivos LISTO-*.blueprint.json fueron creados." -ForegroundColor Green
Write-Host ""
Write-Host "Ahora:"
Write-Host "1. Completa la tabla Config en Airtable."
Write-Host "2. Carga tu primer producto en la tabla Productos."
Write-Host "3. Importa los LISTO-*.blueprint.json en Make."
Write-Host ""
Read-Host "Presiona Enter para cerrar"
