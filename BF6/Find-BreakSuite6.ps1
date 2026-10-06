$ErrorActionPreference = 'SilentlyContinue'

function Resolve-BreakSuitePath([string]$candidate) {
  if (-not $candidate) { return $null }
  $resolved = [Environment]::ExpandEnvironmentVariables($candidate.Trim('"'))
  if (Test-Path $resolved -PathType Leaf) { $resolved = Split-Path -Parent $resolved }
  if (Test-Path (Join-Path $resolved 'BreakSuite6.exe') -PathType Leaf) {
    return $resolved
  }
  return $null
}

# If BreakSuite6 is open, its executable path is the most reliable answer.
$running = Get-Process -Name 'BreakSuite6' | Select-Object -First 1
$found = if ($running) { Resolve-BreakSuitePath $running.Path }
if ($found) { Write-Output $found; exit 0 }

$common = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\BreakSuite6'),
  (Join-Path $env:LOCALAPPDATA 'Programs\breaksuite6'),
  (Join-Path $env:LOCALAPPDATA 'BreakSuite6'),
  (Join-Path $env:ProgramFiles 'BreakSuite6'),
  (Join-Path ${env:ProgramFiles(x86)} 'BreakSuite6')
)
foreach ($candidate in $common) {
  $found = Resolve-BreakSuitePath $candidate
  if ($found) { Write-Output $found; exit 0 }
}

# Installed builds normally register an InstallLocation or uninstall command.
$registryRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
foreach ($entry in Get-ItemProperty $registryRoots | Where-Object { $_.DisplayName -like '*BreakSuite6*' }) {
  $found = Resolve-BreakSuitePath $entry.InstallLocation
  if ($found) { Write-Output $found; exit 0 }
  if ($entry.UninstallString) {
    $exe = [regex]::Match($entry.UninstallString, '"([^"]+\.exe)"|([^\s]+\.exe)').Groups | Where-Object { $_.Value -like '*.exe' } | Select-Object -Last 1
    $found = if ($exe) { Resolve-BreakSuitePath (Split-Path -Parent $exe.Value.Trim('"')) }
    if ($found) { Write-Output $found; exit 0 }
  }
}

# Resolve desktop and Start Menu shortcuts without scanning the entire drive.
$shell = New-Object -ComObject WScript.Shell
$shortcutRoots = @(
  [Environment]::GetFolderPath('Desktop'),
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu'),
  (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu')
)
foreach ($root in $shortcutRoots) {
  foreach ($shortcutFile in Get-ChildItem $root -Filter '*BreakSuite6*.lnk' -Recurse) {
    $target = $shell.CreateShortcut($shortcutFile.FullName).TargetPath
    $found = Resolve-BreakSuitePath $target
    if ($found) { Write-Output $found; exit 0 }
  }
}

# Final bounded search for portable copies in the usual user-facing folders.
$searchRoots = @((Join-Path $env:LOCALAPPDATA 'Programs'), [Environment]::GetFolderPath('Desktop'))
foreach ($root in $searchRoots) {
  foreach ($exe in Get-ChildItem $root -Filter 'BreakSuite6.exe' -File -Recurse) {
    $found = Resolve-BreakSuitePath $exe.FullName
    if ($found) { Write-Output $found; exit 0 }
  }
}

exit 1
