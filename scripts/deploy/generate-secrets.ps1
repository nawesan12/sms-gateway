# Genera los secrets requeridos por el backend.
# Imprime al stdout listo para copiar a Render.
$ErrorActionPreference = "Stop"

if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
    Write-Host "✗ Falta openssl. Instalalo:" -ForegroundColor Red
    Write-Host "    choco install openssl  (con Chocolatey)" -ForegroundColor Yellow
    Write-Host "    o usalo desde Git Bash (viene incluido)"  -ForegroundColor Yellow
    exit 1
}

$tmp = New-Item -ItemType Directory -Path ([System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [guid]::NewGuid().ToString()))
try {
    & openssl genrsa -out "$tmp\p.pem"  2048 2>$null
    & openssl rsa    -in  "$tmp\p.pem" -pubout -out "$tmp\pub.pem" 2>$null

    $priv = [Convert]::ToBase64String((Get-Content "$tmp\p.pem"   -Raw -Encoding Byte))
    $pub  = [Convert]::ToBase64String((Get-Content "$tmp\pub.pem" -Raw -Encoding Byte))

    $rand = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($rand)
    $enc  = [Convert]::ToBase64String($rand)

    $tok = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($tok)
    $token = ($tok | ForEach-Object ToString x2) -join ''

    Write-Host "# ╭──────────────────────────────────────────────────────────╮"
    Write-Host "# │ Secrets generados · COPIALOS A RENDER (sync: false)      │"
    Write-Host "# ╰──────────────────────────────────────────────────────────╯"
    Write-Host "JWT_PRIVATE_KEY_B64=$priv"
    Write-Host "JWT_PUBLIC_KEY_B64=$pub"
    Write-Host "MASTER_ENCRYPTION_KEY_B64=$enc"
    Write-Host "ADMIN_BOOTSTRAP_TOKEN=$token"
}
finally {
    Remove-Item -Recurse -Force $tmp
}
