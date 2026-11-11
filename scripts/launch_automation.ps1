Stop-Process -Name IZER -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$env:IZER_AUTOMATION = "1"
Start-Process (Join-Path $env:LOCALAPPDATA "Programs\IZER\IZER.exe")
Start-Sleep -Seconds 5
