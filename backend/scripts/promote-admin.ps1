# =====================================================================
# Promueve a ADMIN una cuenta YA registrada en la API (tarea 4.6).
# El registro público siempre crea CLIENTE; el primer admin se crea así.
#
# Uso (desde la carpeta backend):
#   powershell -ExecutionPolicy Bypass -File scripts\promote-admin.ps1 -Email tu-correo@ejemplo.com
#   (opcional) -Database jm_barber_test
#
# Usa DB_USER y DB_PASSWORD de backend\.env; la contraseña no se muestra ni se guarda.
# =====================================================================
param(
    [Parameter(Mandatory = $true)][string]$Email,
    [string]$Database = "jm_barber"
)

$ErrorActionPreference = "Stop"

# Solo correos y nombres de base con caracteres seguros (evita inyección SQL en el comando)
$Email = $Email.Trim().ToLower()
if ($Email -notmatch '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$') { throw "Correo no válido: $Email" }
if ($Database -notmatch '^[A-Za-z0-9_]+$') { throw "Nombre de base no válido: $Database" }

$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envFile)) { throw "No existe backend\.env (copia .env.example y complétalo)." }
$vars = @{}
Get-Content $envFile | Where-Object { $_ -match '^\s*[^#][^=]*=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2
    $vars[$k.Trim()] = $v.Trim()
}

$mysql = Get-ChildItem "C:\Program Files\MySQL" -Recurse -Filter mysql.exe -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
if (-not $mysql) { throw "No se encontró mysql.exe en C:\Program Files\MySQL." }

$sql = "UPDATE users SET role = 'ADMIN' WHERE email = '$Email'; SELECT ROW_COUNT();"
$env:MYSQL_PWD = $vars['DB_PASSWORD']
try {
    $changed = & $mysql -u $vars['DB_USER'] $Database -N -e $sql
} finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

if ([int]$changed -ge 1) {
    Write-Host "Listo: $Email ahora es ADMIN en $Database. El cambio aplica en su siguiente petición."
} else {
    $exists = $null
    $env:MYSQL_PWD = $vars['DB_PASSWORD']
    try { $exists = & $mysql -u $vars['DB_USER'] $Database -N -e "SELECT role FROM users WHERE email = '$Email';" }
    finally { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
    if ($exists) { Write-Host "$Email ya era $exists; no hubo cambios." }
    else { throw "No hay ninguna cuenta con el correo $Email. Regístrate primero en la app." }
}
