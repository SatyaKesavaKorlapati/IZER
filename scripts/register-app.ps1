$sh = New-Object -ComObject WScript.Shell
$lnkPath = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\IZER.lnk'
$lnk = $sh.CreateShortcut($lnkPath)
$target = $lnk.TargetPath
Write-Host "Start Menu Shortcut Target: $target"
Write-Host "Icon Location: $($lnk.IconLocation)"

$regPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\IZER.exe'
if (-not (Test-Path $regPath)) {
  New-Item -Path $regPath -Force | Out-Null
}
Set-ItemProperty -Path $regPath -Name '(Default)' -Value $target
Set-ItemProperty -Path $regPath -Name 'Path' -Value (Split-Path $target)

# Also check desktop shortcut
$desktopLnk = Join-Path ([System.Environment]::GetFolderPath('Desktop')) 'IZER.lnk'
Write-Host "Desktop shortcut exists: $(Test-Path $desktopLnk)"
Write-Host "Start menu shortcut exists: $(Test-Path $lnkPath)"
