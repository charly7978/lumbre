# Vigilancia del tunel rapido de Lucian.
# No se fija en si cloudflared.exe existe (hay un servicio del sistema que
# siempre esta), sino en si la direccion publica RESPONDE de verdad.
# Si no responde, levanta un tunel nuevo y actualiza los archivos.

$ErrorActionPreference = 'SilentlyContinue'
$base = $PSScriptRoot
$urlFile = Join-Path $base 'url.txt'
$logFile = Join-Path $base 'tunnel.log'
$dirFile = Join-Path $base 'DIRECCION-LUCIAN.txt'
$tunnelExe = Join-Path $base 'cloudflared.exe'

function Get-PublicUrl {
    $t = Get-Content $logFile -Raw -ErrorAction SilentlyContinue
    if ($t -match 'https://[a-z0-9-]+\.trycloudflare\.com') { return $matches[0] }
    return $null
}

function Test-Url {
    param([string]$u)
    if (-not $u) { return $false }
    try {
        $r = Invoke-WebRequest -Uri ($u + '/api/health') -TimeoutSec 8 -UseBasicParsing
        return ($r.StatusCode -eq 200)
    } catch { return $false }
}

function Write-UrlFiles {
    param([string]$u)
    Set-Content -Path $urlFile -Value $u -Encoding ascii
    @(
        'DIRECCION DE LUCIAN PARA EL CELULAR',
        '',
        $u,
        '',
        'Copia esa direccion y mandala por WhatsApp.',
        'Al abrirla entra directo, sin clave.',
        'NO cierres la ventana negra ni apagues la PC.'
    ) | Set-Content -Path $dirFile -Encoding UTF8
}

function Start-QuickTunnel {
    # Matar solo tuneles rapidos (los que llevan --url), NO el servicio del sistema.
    Get-CimInstance Win32_Process -Filter "name='cloudflared.exe'" |
        Where-Object { $_.CommandLine -like '*--url*' } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Remove-Item $logFile -Force -ErrorAction SilentlyContinue
    Start-Process -FilePath $tunnelExe `
        -ArgumentList 'tunnel','--url','http://localhost:4321' `
        -WorkingDirectory $base -WindowStyle Hidden `
        -RedirectStandardError $logFile | Out-Null
}

# Levantar el tunel si no hay uno funcionando
$url = Get-Content $urlFile -Raw -ErrorAction SilentlyContinue
$url = if ($url) { $url.Trim() } else { $null }
if (-not (Test-Url $url)) { Start-QuickTunnel }

# Esperar a que aparezca la direccion y escribirla enseguida.
for ($i = 0; $i -lt 30; $i++) {
    $u = Get-PublicUrl
    if ($u) {
        Write-UrlFiles $u
        break
    }
    Start-Sleep -Seconds 2
}

while ($true) {
    Start-Sleep -Seconds 20

    $url = Get-Content $urlFile -Raw -ErrorAction SilentlyContinue
    $url = if ($url) { $url.Trim() } else { $null }

    if (Test-Url $url) { continue }

    # No responde: reconectar
    Add-Content -Path (Join-Path $base 'vigilar.log') -Value "$([DateTime]::Now) - Direccion caida, reconectando..."
    Start-QuickTunnel

    # Esperar hasta 60 s a que aparezca la direccion nueva
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Seconds 3
        $newUrl = Get-PublicUrl
        if ($newUrl) {
            Write-UrlFiles $newUrl
            Add-Content -Path (Join-Path $base 'vigilar.log') -Value "$([DateTime]::Now) - Nueva direccion: $newUrl"
            break
        }
    }
}
