Add-Type -AssemblyName System.Drawing
$ico1 = [System.Drawing.Icon]::ExtractAssociatedIcon('C:\Users\korla\Desktop\IEM_JADE\node_modules\electron\dist\electron.exe')
$b1 = $ico1.ToBitmap()
$b1.Save('C:\Users\korla\.gemini\antigravity\brain\63454dd2-458f-4f2b-9c65-5d77a2d470d5\extracted_node_electron_icon.png')

$ico2 = [System.Drawing.Icon]::ExtractAssociatedIcon('C:\Users\korla\Desktop\IEM_JADE\release\win-unpacked\IZER.exe')
$b2 = $ico2.ToBitmap()
$b2.Save('C:\Users\korla\.gemini\antigravity\brain\63454dd2-458f-4f2b-9c65-5d77a2d470d5\extracted_izer_exe_icon.png')

Write-Host "Both icons extracted!"
