Get-Process | Where-Object { $_.ProcessName -match 'electron|IZER|chrome' } | Select-Object Id, ProcessName, MainWindowTitle, Path
