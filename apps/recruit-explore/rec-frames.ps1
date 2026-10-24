param(
  [Parameter(Mandatory=$true)][string]$BaseUrl,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [int]$N = 48,
  [int]$W = 1440,
  [int]$H = 900,
  [string]$Label = "frames"
)
# 逐帧截取滚动进度 t=0..1，产物 f000.png ... 供 ffmpeg 编码
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Get-ChildItem $OutDir -Filter "f*.png" -ErrorAction SilentlyContinue | Remove-Item -Force

$inv = [Globalization.CultureInfo]::InvariantCulture
$sw = [Diagnostics.Stopwatch]::StartNew()

for ($i = 0; $i -lt $N; $i++) {
  $t = $i / [double]($N - 1)
  $ts = $t.ToString("0.0000", $inv)
  $frame = Join-Path $OutDir ("f" + $i.ToString("000") + ".png")
  $url = "$BaseUrl" + "?t=" + $ts
  $argList = @(
    "--headless=new",
    "--disable-gpu",
    "--enable-unsafe-swiftshader",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=$env:TEMP\edge-frame-profile",
    "--window-size=$W,$H",
    "--virtual-time-budget=2600",
    "--screenshot=$frame",
    $url
  )
  $p = Start-Process -FilePath $edge -ArgumentList $argList -PassThru -Wait -WindowStyle Hidden
  if (-not (Test-Path $frame)) {
    Write-Output ("FAILED frame " + $i + " (edge exit " + $p.ExitCode + ")")
  }
  if (($i + 1) % 8 -eq 0) {
    Write-Output ("[$Label] " + ($i + 1) + "/" + $N + "  elapsed " + [int]$sw.Elapsed.TotalSeconds + "s")
  }
}

$frames = Get-ChildItem $OutDir -Filter "f*.png"
$total = ($frames | Measure-Object -Property Length -Sum).Sum
Write-Output ("[$Label] DONE " + $frames.Count + "/" + $N + " frames, " + [Math]::Round($total/1MB,2) + " MB, " + [int]$sw.Elapsed.TotalSeconds + "s")
