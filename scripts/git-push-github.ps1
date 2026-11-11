$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Invoke-GitCredentialFill {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "git"
  $psi.Arguments = "credential fill"
  $psi.WorkingDirectory = $root
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false
  foreach ($k in [Environment]::GetEnvironmentVariables("Process").Keys) {
    if ($k -notmatch "^(GIT_ASKPASS|GIT_TERMINAL_PROMPT|GCM_INTERACTIVE)$") {
      $psi.Environment[$k] = [Environment]::GetEnvironmentVariable($k)
    }
  }
  $psi.Environment["GIT_TERMINAL_PROMPT"] = "1"
  $psi.Environment["GCM_INTERACTIVE"] = "always"
  $p = [Diagnostics.Process]::Start($psi)
  $p.StandardInput.Write(@"
protocol=https
host=github.com


"@)
  $p.StandardInput.Close()
  $out = $p.StandardOutput.ReadToEnd()
  $err = $p.StandardError.ReadToEnd()
  if (-not $p.WaitForExit(120000)) {
    $p.Kill()
    throw "git credential fill timed out"
  }
  if ($p.ExitCode -ne 0) { throw "git credential fill failed: $err" }
  $user = ($out -split "`n" | Where-Object { $_ -match "^username=" } | Select-Object -First 1) -replace "^username=", ""
  $pass = ($out -split "`n" | Where-Object { $_ -match "^password=" } | Select-Object -First 1) -replace "^password=", ""
  if (-not $user -or -not $pass) { throw "Missing GitHub credentials" }
  return @{ User = $user.Trim(); Token = $pass.Trim() }
}

$cred = Invoke-GitCredentialFill
$header = "AUTHORIZATION: basic " + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("x-access-token:$($cred.Token)"))
& git -c credential.helper= -c "http.extraheader=$header" push -u origin master
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Output "Pushed to https://github.com/$($cred.User)/IZER"
