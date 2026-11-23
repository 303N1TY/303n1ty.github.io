# Headless screenshots of the site, no dependencies (uses installed Chrome/Edge).
# Loads index.html?shot  -> no boot screen, no motion, all reveal content shown.
#
#   powershell -File tools/shot.ps1                      # 1440x900 fold -> shots/top-1440.png
#   powershell -File tools/shot.ps1 -Hash about -Width 500 -Height 900
#   powershell -File tools/shot.ps1 -All                 # every section, desktop + mobile
param(
  [int]$Width = 1440,
  [int]$Height = 900,
  [string]$Hash = "top",
  [ValidateSet("en", "fr")][string]$Lang = "en",
  [switch]$All
)
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$shots = Join-Path $root "shots"
New-Item -ItemType Directory -Force $shots | Out-Null

$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw "No Chrome/Edge found" }
$base = "file:///" + ((Join-Path $root "index.html") -replace "\\", "/") + "?shot&lang=$Lang"

function Take([string]$hash, [int]$w, [int]$h) {
  $file = Join-Path $shots "$hash-$w.png"
  & $browser --headless=new --allow-file-access-from-files --disable-gpu --hide-scrollbars --no-first-run `
    "--user-data-dir=$env:TEMP\shot-profile" "--window-size=$w,$h" `
    --virtual-time-budget=4000 "--screenshot=$file" "$base#$hash" 2>&1 | Out-Null
  Write-Output $file
}

if ($All) {
  $sections = Select-String -Path (Join-Path $root "index.html") -Pattern '<section[^>]*id="([^"]+)"' |
    ForEach-Object { $_.Matches[0].Groups[1].Value }
  foreach ($s in $sections) { Take $s 1440 900; Take $s 500 900 }
} else {
  Take $Hash $Width $Height
}
