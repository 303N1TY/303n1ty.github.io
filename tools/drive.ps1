# Scripted browser checks over the Chrome DevTools Protocol, no dependencies.
# Covers what shot.ps1 can't: real scrolling, hover, clicks, timed animation frames, console errors.
#
#   powershell -File tools/drive.ps1 -Steps "wait 2500; shot boot; scroll 1400; wait 900; shot manifesto"
#   powershell -File tools/drive.ps1 -Query "lang=fr" -Width 500 -Steps "wait 3000; shot fr-mobile"
#
# Steps (separated by ';'):
#   wait <ms>                 sleep
#   shot <name>               screenshot -> shots/drive/<name>.png
#   frames <name> <n> <ms>    n screenshots, one every <ms> -> <name>-0.png, <name>-1.png …
#   scroll <y>                smooth-scroll to y (through Lenis when present), or 'scroll #id'
#   jump <y|#id>              instant scroll
#   move <x> <y>              pointer move (fires real pointer/mouse events)
#   sweep <x1> <y1> <x2> <y2> <ms>   pointer drag-free sweep from A to B over <ms>
#   click <x> <y> | click <css selector>
#   key <Key>                 key press (e.g. Escape, Enter, /, a)
#   type <text>               insert text
#   eval <js>                 run JS in the page, result printed
# Console messages and uncaught errors are written to shots/drive/console.txt and echoed.
param(
  [string]$Steps = "wait 2500; shot page",
  [int]$Width = 1440,
  [int]$Height = 900,
  [string]$Query = "",
  [string]$Page = "index.html",
  [switch]$KeepProfile
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root "shots\drive"
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $out -Filter *.png | Remove-Item -Force

$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw "No Chrome/Edge found" }

$port = 9333
$profileDir = Join-Path $env:TEMP "drive-profile"
if (-not $KeepProfile -and (Test-Path $profileDir)) { Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue }
$url = "file:///" + ((Join-Path $root $Page) -replace "\\", "/")
if ($Query) { $url += "?" + $Query }

$proc = Start-Process $browser -PassThru -ArgumentList @(
  "--headless=new", "--remote-debugging-port=$port", "--remote-allow-origins=*",
  "--allow-file-access-from-files", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  "--autoplay-policy=no-user-gesture-required", "--user-data-dir=$profileDir", "--window-size=$Width,$Height", "about:blank"
)

$log = New-Object System.Collections.Generic.List[string]
$ws = $null
try {
  $target = $null
  for ($i = 0; $i -lt 50 -and -not $target; $i++) {
    Start-Sleep -Milliseconds 200
    try { $target = (Invoke-RestMethod "http://127.0.0.1:$port/json/list") | Where-Object { $_.type -eq "page" } | Select-Object -First 1 } catch {}
  }
  if (-not $target) { throw "DevTools endpoint not reachable" }

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ws.Options.KeepAliveInterval = [TimeSpan]::Zero
  $ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, [Threading.CancellationToken]::None).Wait()
  $script:nextId = 0

  function Receive-Message {
    $buf = New-Object byte[] 1048576
    $ms = New-Object System.IO.MemoryStream
    do {
      $seg = New-Object System.ArraySegment[byte] -ArgumentList (, $buf)
      $r = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
      $ms.Write($buf, 0, $r.Count)
    } while (-not $r.EndOfMessage)
    $text = [Text.Encoding]::UTF8.GetString($ms.ToArray())
    return ($text | ConvertFrom-Json)
  }

  function Handle-Event($m) {
    switch ($m.method) {
      "Runtime.consoleAPICalled" {
        $args2 = ($m.params.args | ForEach-Object { if ($null -ne $_.value) { $_.value } else { $_.description } }) -join " "
        $log.Add("[console.$($m.params.type)] $args2")
      }
      "Runtime.exceptionThrown" {
        $d = $m.params.exceptionDetails
        $msg = if ($d.exception.description) { $d.exception.description } else { $d.text }
        $log.Add("[Uncaught] $msg ($($d.url):$($d.lineNumber))")
      }
      "Log.entryAdded" { if ($m.params.entry.level -in "error", "warning") { $log.Add("[$($m.params.entry.level)] $($m.params.entry.text) $($m.params.entry.url)") } }
    }
  }

  function Send-Cdp([string]$method, $params = @{}) {
    $script:nextId++
    $id = $script:nextId
    $json = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 10 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList (, $bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
    while ($true) {
      $m = Receive-Message
      if ($m.id -eq $id) {
        if ($m.error) { throw "$method failed: $($m.error.message)" }
        return $m.result
      }
      Handle-Event $m
    }
  }

  # Drain pending events while time passes (keeps console capture live during waits).
  function Wait-Ms([int]$ms) {
    $end = [DateTime]::Now.AddMilliseconds($ms)
    while ([DateTime]::Now -lt $end) {
      $left = [int]($end - [DateTime]::Now).TotalMilliseconds
      Start-Sleep -Milliseconds ([Math]::Min(50, [Math]::Max(1, $left)))
    }
    [void](Send-Cdp "Runtime.evaluate" @{ expression = "0" })
  }

  function Eval-Js([string]$js) {
    $r = Send-Cdp "Runtime.evaluate" @{ expression = $js; awaitPromise = $true; returnByValue = $true }
    if ($r.exceptionDetails) { $log.Add("[eval error] $($r.exceptionDetails.exception.description)") }
    return $r.result.value
  }

  function Take-Shot([string]$name) {
    $r = Send-Cdp "Page.captureScreenshot" @{ format = "png" }
    $file = Join-Path $out "$name.png"
    [IO.File]::WriteAllBytes($file, [Convert]::FromBase64String($r.data))
    Write-Output "shot  $file"
  }

  $script:mx = 0; $script:my = 0
  function Move-Pointer([double]$x, [double]$y) {
    [void](Send-Cdp "Input.dispatchMouseEvent" @{ type = "mouseMoved"; x = $x; y = $y; pointerType = "mouse" })
    $script:mx = $x; $script:my = $y
  }

  [void](Send-Cdp "Runtime.enable")
  [void](Send-Cdp "Log.enable")
  [void](Send-Cdp "Page.enable")
  [void](Send-Cdp "Emulation.setDeviceMetricsOverride" @{ width = $Width; height = $Height; deviceScaleFactor = 1; mobile = $false })
  [void](Send-Cdp "Page.navigate" @{ url = $url })
  Write-Output "open  $url ($Width x $Height)"

  foreach ($raw in ($Steps -split ";")) {
    $s = $raw.Trim()
    if (-not $s) { continue }
    $cmd, $rest = $s -split "\s+", 2
    $a = @(if ($rest) { $rest -split "\s+" })
    switch ($cmd) {
      "wait" { Wait-Ms ([int]$a[0]) }
      "shot" { Take-Shot $a[0] }
      "frames" { for ($k = 0; $k -lt [int]$a[1]; $k++) { Take-Shot "$($a[0])-$k"; Wait-Ms ([int]$a[2]) } }
      { $_ -in "scroll", "jump" } {
        $instant = if ($cmd -eq "jump") { "true" } else { "false" }
        $tgt = if ($rest -match "^#") { "document.querySelector('$rest')" } else { [int]$rest }
        [void](Eval-Js "(() => { const t = $tgt, i = $instant; if (window.__lenis) window.__lenis.scrollTo(t, { immediate: i }); else if (typeof t === 'number') scrollTo({ top: t, behavior: i ? 'instant' : 'smooth' }); else t.scrollIntoView({ behavior: i ? 'instant' : 'smooth' }); })()")
      }
      "move" { Move-Pointer ([double]$a[0]) ([double]$a[1]) }
      "sweep" {
        $n = [Math]::Max(2, [int]([int]$a[4] / 16))
        for ($k = 0; $k -le $n; $k++) {
          $t = $k / $n
          Move-Pointer ([double]$a[0] + ([double]$a[2] - [double]$a[0]) * $t) ([double]$a[1] + ([double]$a[3] - [double]$a[1]) * $t)
          Start-Sleep -Milliseconds 16
        }
      }
      "click" {
        if ($a.Count -ge 2 -and $a[0] -match "^-?\d") { $x = [double]$a[0]; $y = [double]$a[1] }
        else {
          $sel = $rest.Replace("'", "\'")
          $p = Eval-Js "(() => { const e = document.querySelector('$sel'); if (!e) return null; e.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()"
          if (-not $p) { $log.Add("[drive] click: no element for $rest"); continue }
          $x = $p[0]; $y = $p[1]
        }
        Move-Pointer $x $y
        foreach ($t in "mousePressed", "mouseReleased") {
          [void](Send-Cdp "Input.dispatchMouseEvent" @{ type = $t; x = $x; y = $y; button = "left"; clickCount = 1 })
        }
      }
      "key" {
        $k = $a[0]
        $text = if ($k.Length -eq 1) { $k } else { "" }
        $code = switch ($k) { "Escape" { 27 } "Enter" { 13 } "ArrowUp" { 38 } "ArrowDown" { 40 } "ArrowLeft" { 37 } "ArrowRight" { 39 } "Tab" { 9 } default { 0 } }
        [void](Send-Cdp "Input.dispatchKeyEvent" @{ type = "keyDown"; key = $k; text = $text; windowsVirtualKeyCode = $code })
        [void](Send-Cdp "Input.dispatchKeyEvent" @{ type = "keyUp"; key = $k; windowsVirtualKeyCode = $code })
      }
      "type" { [void](Send-Cdp "Input.insertText" @{ text = $rest }) }
      "eval" { Write-Output "eval  $rest => $(Eval-Js $rest | ConvertTo-Json -Compress -Depth 5)" }
      default { Write-Output "??    unknown step: $s" }
    }
  }
  Wait-Ms 100
}
finally {
  if ($ws) { try { $ws.Dispose() } catch {} }
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*drive-profile*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  $log | Set-Content -Encoding utf8 (Join-Path $out "console.txt")
  if ($log.Count) { Write-Output "--- console ($($log.Count))"; $log | Select-Object -First 40 | ForEach-Object { Write-Output $_ } }
  else { Write-Output "--- console: clean" }
}
