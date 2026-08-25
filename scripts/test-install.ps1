$ErrorActionPreference = "Stop"
$ClientDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ClientDir

$setup = Get-ChildItem .\dist -Filter "Rodnik Setup *.exe" -ErrorAction Stop | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (!$setup) { throw "Rodnik installer not found in dist" }
Write-Host "Running $($setup.FullName)..."
Start-Process -FilePath $setup.FullName -Wait
Start-Sleep -Seconds 3

$apps = Get-ChildItem "$env:LOCALAPPDATA\Programs" -Recurse -Filter "Rodnik.exe" -ErrorAction SilentlyContinue
if (!$apps) { throw "Rodnik.exe was not found under LOCALAPPDATA\Programs after installation" }
$apps | Select-Object FullName,@{Name="Version";Expression={$_.VersionInfo.FileVersion}} | Format-Table -AutoSize

$desktop = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Rodnik.lnk'
if (Test-Path $desktop) { Write-Host "Desktop shortcut: OK ($desktop)" } else { Write-Warning "Desktop shortcut was not found" }
