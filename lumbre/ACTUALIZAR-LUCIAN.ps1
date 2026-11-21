# Actualizador único de LUCIAN. No modifica datos, fotos ni credenciales.
$ErrorActionPreference = 'Stop'
$target = Split-Path -Parent $MyInvocation.MyCommand.Path
$temporary = Join-Path $env:TEMP ('lucian-update-' + [guid]::NewGuid().ToString('N'))
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $env:LOCALAPPDATA ('LUCIAN\code-backups\' + $stamp)
$folders = @('lib','public','tools','prompts')
$files = @('server.mjs','package.json','INICIAR-LUCIAN.cmd','ACTUALIZAR-LUCIAN.ps1','ACTUALIZAR-LUCIAN.cmd')
Write-Host ''
Write-Host 'LUCIAN - ACTUALIZACION DE CODIGO (rama main)' -ForegroundColor Cyan
Write-Host ('Carpeta de trabajo: ' + $target)
Write-Host 'data, media, configuraciones, credenciales y cloudflared.exe se conservan.'
try {
  $targetServer = Join-Path $target 'server.mjs'
  $running = @(Get-CimInstance Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains($targetServer)
  })
  if ($running.Count -gt 0) {
    throw 'LUCIAN está abierto. Cerrá primero la ventana del servidor e iniciá de nuevo este actualizador.'
  }
  New-Item -Path $temporary -ItemType Directory -Force | Out-Null
  New-Item -Path $backup -ItemType Directory -Force | Out-Null
  $archive = Join-Path $temporary 'main.zip'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Write-Host 'Descargando código oficial de charly7978/lumbre/main...'
  Invoke-WebRequest -Uri 'https://github.com/charly7978/lumbre/archive/refs/heads/main.zip' -OutFile $archive -UseBasicParsing -TimeoutSec 180
  Expand-Archive -LiteralPath $archive -DestinationPath $temporary -Force
  $source = Join-Path $temporary 'lumbre-main\lumbre'
  if (!(Test-Path (Join-Path $source 'server.mjs'))) { throw 'La descarga no contiene lumbre/server.mjs. No se aplicó nada.' }
  # Validar el código NUEVO ANTES de reemplazar una instalación que hoy funciona.
  if (!(Get-Command node -ErrorAction SilentlyContinue)) { throw 'Falta Node.js: no se puede verificar la actualización.' }
  if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Falta npm: no se puede verificar la actualización.' }
  Write-Host 'Validando sintaxis de los módulos descargados antes de tocar LUCIAN...'
  Push-Location $source
  try {
    & npm.cmd run check
    if ($LASTEXITCODE -ne 0) {
      throw 'La nueva versión no superó la comprobación de código. La instalación existente no se modificó.'
    }
  } finally { Pop-Location }
  Write-Host ('Guardando respaldo anterior en: ' + $backup)
  foreach ($dir in $folders) {
    $existing = Join-Path $target $dir
    if (Test-Path $existing) { Copy-Item -LiteralPath $existing -Destination (Join-Path $backup $dir) -Recurse -Force }
  }
  foreach ($file in $files) {
    $existing = Join-Path $target $file
    if (Test-Path $existing) { Copy-Item -LiteralPath $existing -Destination (Join-Path $backup $file) -Force }
  }
  Write-Host 'Aplicando la nueva versión sin duplicar módulos...'
  foreach ($dir in $folders) {
    $newDir = Join-Path $source $dir
    $destDir = Join-Path $target $dir
    if (!(Test-Path $newDir)) { throw ('Falta directorio crítico: ' + $dir) }
    New-Item -Path $destDir -ItemType Directory -Force | Out-Null
    & robocopy.exe $newDir $destDir /MIR /R:2 /W:1 /NFL /NDL /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw ('No se pudo sincronizar directorio ' + $dir) }
  }
  foreach ($file in $files) {
    $newFile = Join-Path $source $file
    if (Test-Path $newFile) { Copy-Item -LiteralPath $newFile -Destination (Join-Path $target $file) -Force }
  }
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($node) {
    Push-Location $target
    try {
      & node --check server.mjs
      if ($LASTEXITCODE -ne 0) { throw 'Falló la comprobación de sintaxis de server.mjs.' }
      & node --check lib/notify.mjs
      if ($LASTEXITCODE -ne 0) { throw 'Falló la comprobación de sintaxis de notify.mjs.' }
      & node --check public/app.js
      if ($LASTEXITCODE -ne 0) { throw 'Falló la comprobación de sintaxis de app.js.' }
    } finally { Pop-Location }
  }
  Write-Host ''
  Write-Host 'Actualización aplicada. Tu carpeta data no fue modificada.' -ForegroundColor Green
  Write-Host 'Reiniciá LUCIAN con INICIAR-LUCIAN.cmd.'
} catch {
  Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'El respaldo del código previo está disponible en:' -ForegroundColor Yellow
  Write-Host $backup
  Write-Host 'No se borraron los datos de productos, conversaciones ni claves.'
  exit 1
} finally {
  if (Test-Path $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue }
}
