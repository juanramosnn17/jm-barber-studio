# =====================================================================
# Restablece la contraseña de root del MySQL local (procedimiento oficial
# "--init-file" de MySQL). No borra datos. Requiere PowerShell como administrador.
# La nueva contraseña la escribes tú; no se muestra ni se guarda: el archivo
# temporal con la instrucción se borra al terminar.
# =====================================================================
$ErrorActionPreference = "Stop"
$serviceName = "MySQL2610"

$svc = Get-CimInstance Win32_Service -Filter "Name='$serviceName'"
if (-not $svc) { throw "No existe el servicio $serviceName." }
# Ruta de mysqld.exe y del my.ini, tomadas de la configuración del servicio
$mysqld = [regex]::Match($svc.PathName, '^"([^"]+mysqld\.exe)"').Groups[1].Value
$ini    = [regex]::Match($svc.PathName, '--defaults-file="([^"]+)"').Groups[1].Value
if (-not (Test-Path $mysqld) -or -not (Test-Path $ini)) { throw "No se encontró mysqld.exe o my.ini." }

$p1 = Read-Host "Nueva contraseña para root" -AsSecureString
$p2 = Read-Host "Repite la nueva contraseña" -AsSecureString
$plain1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p1))
$plain2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p2))
if ($plain1 -ne $plain2) { throw "Las contraseñas no coinciden. No se cambió nada." }
if ($plain1.Length -lt 8) { throw "Usa al menos 8 caracteres. No se cambió nada." }
$escaped = $plain1.Replace("\", "\\").Replace("'", "''")

$init = Join-Path $env:ProgramData "mysql-reset-root.sql"
try {
  Write-Host "1/4 Deteniendo MySQL..."
  Stop-Service $serviceName -Force
  Set-Content -Path $init -Value "ALTER USER 'root'@'localhost' IDENTIFIED BY '$escaped';" -Encoding ascii

  Write-Host "2/4 Aplicando la nueva contraseña..."
  $proc = Start-Process -FilePath $mysqld -ArgumentList "--defaults-file=`"$ini`"", "--init-file=`"$init`"" -PassThru -WindowStyle Hidden
  Start-Sleep -Seconds 15
  Write-Host "3/4 Cerrando el arranque temporal..."
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
  Start-Sleep -Seconds 3
} finally {
  Remove-Item $init -Force -ErrorAction SilentlyContinue
  $plain1 = $null; $plain2 = $null; $escaped = $null
}

Write-Host "4/4 Encendiendo MySQL normalmente..."
Start-Service $serviceName
Write-Host "Listo. La contraseña de root fue restablecida y MySQL está en: $((Get-Service $serviceName).Status)"
Read-Host "Presiona Enter para cerrar esta ventana"
