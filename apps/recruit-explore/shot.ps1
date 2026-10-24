param(
  [Parameter(Mandatory=$true)][string]$Url,
  [Parameter(Mandatory=$true)][string]$Out,
  [int]$W = 1440,
  [int]$H = 900
)
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (Test-Path $Out) { Remove-Item $Out -Force }
$argList = @(
  "--headless=new",
  "--disable-gpu",
  "--enable-unsafe-swiftshader",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--user-data-dir=$env:TEMP\edge-shot-profile",
  "--window-size=$W,$H",
  "--virtual-time-budget=3500",
  "--screenshot=$Out",
  $Url
)
$p = Start-Process -FilePath $edge -ArgumentList $argList -PassThru -Wait -WindowStyle Hidden
if (Test-Path $Out) {
  Write-Output ("OK " + (Get-Item $Out).Length + " bytes -> " + $Out)
} else {
  Write-Output ("MISSING -> " + $Out + " (edge exit " + $p.ExitCode + ")")
}
