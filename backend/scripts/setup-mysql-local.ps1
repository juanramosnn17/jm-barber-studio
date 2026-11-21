# =====================================================================
# Crea las bases jm_barber y jm_barber_test y el usuario jm_app en el
# MySQL local (tarea 4.2). Lee la contraseña de la app desde backend/.env.
# MySQL pedirá la contraseña de root: escríbela tú; no se guarda en ningún lado.
#
# Uso (desde la carpeta backend):  powershell -ExecutionPolicy Bypass -File scripts\setup-mysql-local.ps1
# =====================================================================
$ErrorActionPreference = "Stop"
$backend = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $backend ".env"
if (-not (Test-Path $envFile)) { throw "No existe backend\.env (copia .env.example y complétalo)." }

$vars = @{}
Get-Content $envFile | Where-Object { $_ -match '^\s*([A-Z_]+)=(.*)$' } | ForEach-Object {
  $vars[$Matches[1]] = $Matches[2].Trim()
}
$user = $vars["DB_USER"]
$pass = $vars["DB_PASSWORD"]
if (-not $user -or -not $pass) { throw "Faltan DB_USER o DB_PASSWORD en backend\.env." }

$mysql = Get-ChildItem "C:\Program Files\MySQL" -Recurse -Filter mysql.exe -ErrorAction SilentlyContinue |
  Select-Object -First 1 -ExpandProperty FullName
if (-not $mysql) { throw "No se encontró mysql.exe en C:\Program Files\MySQL." }

$sql = @"
CREATE DATABASE IF NOT EXISTS jm_barber CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS jm_barber_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '$user'@'localhost' IDENTIFIED BY '$pass';
ALTER USER '$user'@'localhost' IDENTIFIED BY '$pass';
GRANT ALL PRIVILEGES ON jm_barber.* TO '$user'@'localhost';
GRANT ALL PRIVILEGES ON jm_barber_test.* TO '$user'@'localhost';
FLUSH PRIVILEGES;
SELECT 'Listo: bases jm_barber y jm_barber_test, usuario creado' AS resultado;
"@

# El SQL se envía por la entrada estándar (no por la línea de comandos), así la
# contraseña de la app no queda visible en la lista de procesos.
Write-Host "Se conectará a MySQL como root. Escribe la contraseña de root cuando la pida:"
$sql | & $mysql -u root -p
if ($LASTEXITCODE -ne 0) { throw "MySQL devolvió un error (código $LASTEXITCODE)." }
