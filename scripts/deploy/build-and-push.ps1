# =============================================================
# build-and-push.ps1 — versión PowerShell del pipeline.
# Funciona en Windows 10/11 con Docker Desktop instalado.
#
# Uso:
#   .\scripts\deploy\build-and-push.ps1
#   .\scripts\deploy\build-and-push.ps1 -Config .\scripts\deploy\accounts.json
#
# Variables de entorno requeridas: una por cada cuenta del JSON,
# nombrada según el campo `passwordEnv`.
#   $env:DOCKER_PASSWORD_MAIN = "..."
#   $env:DOCKER_PASSWORD_ACME = "..."
# =============================================================
[CmdletBinding()]
param(
    [string] $Config = "scripts\deploy\accounts.json"
)

$ErrorActionPreference = "Stop"

# Ir a la raíz del repo
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

if (-not (Test-Path $Config)) {
    Write-Host "✗ Config no encontrada: $Config" -ForegroundColor Red
    Write-Host "  Copiá scripts\deploy\accounts.example.json y completalo." -ForegroundColor Yellow
    exit 1
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "✗ Docker no está en el PATH. Instalá Docker Desktop." -ForegroundColor Red
    exit 1
}

$cfg = Get-Content $Config -Raw | ConvertFrom-Json

if ($cfg.registries.Count -eq 0) {
    Write-Host "✗ No hay registries configurados." -ForegroundColor Red
    exit 1
}

$imageName = $cfg.image
$imageTag  = $cfg.tag
$gitSha    = (& git rev-parse --short HEAD 2>$null)
if (-not $gitSha) { $gitSha = "nogit" }

$localTag = "${imageName}:${imageTag}"

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Build local: $localTag  (git: $gitSha)"                  -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan

# Buildx setup
$null = docker buildx inspect default 2>$null
if ($LASTEXITCODE -ne 0) {
    docker buildx create --use --name smsgw-builder | Out-Null
}

Write-Host "→ docker buildx build (linux/amd64) ..." -ForegroundColor Yellow
docker buildx build `
    --platform linux/amd64 `
    --tag $localTag `
    --tag "${imageName}:${gitSha}" `
    --load `
    .
if ($LASTEXITCODE -ne 0) { throw "Build falló" }
Write-Host "✓ build OK" -ForegroundColor Green

# Push a cada registry
foreach ($r in $cfg.registries) {
    $pwdVal = [Environment]::GetEnvironmentVariable($r.passwordEnv)
    if (-not $pwdVal) {
        Write-Host "─── [$($r.name)] SKIP — variable $($r.passwordEnv) no seteada ───" -ForegroundColor DarkYellow
        continue
    }

    Write-Host ""
    Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Cyan
    Write-Host " [$($r.name)] Push → $($r.registry)/$($r.repo)"            -ForegroundColor Cyan
    Write-Host "─────────────────────────────────────────────────────────" -ForegroundColor Cyan

    $pwdVal | docker login $r.registry --username $r.username --password-stdin
    if ($LASTEXITCODE -ne 0) { throw "Login falló para $($r.name)" }

    $remoteLatest = "$($r.registry)/$($r.repo):$imageTag"
    $remoteSha    = "$($r.registry)/$($r.repo):$gitSha"

    docker tag $localTag $remoteLatest
    docker tag $localTag $remoteSha

    Write-Host "→ push $remoteLatest" -ForegroundColor Yellow
    docker push $remoteLatest
    if ($LASTEXITCODE -ne 0) { throw "Push falló: $remoteLatest" }

    Write-Host "→ push $remoteSha" -ForegroundColor Yellow
    docker push $remoteSha
    if ($LASTEXITCODE -ne 0) { throw "Push falló: $remoteSha" }

    docker logout $r.registry | Out-Null
    Write-Host "✓ [$($r.name)] OK" -ForegroundColor Green
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " Listo. Imágenes pusheadas con tags: $imageTag, $gitSha"  -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Green
