param(
  [ValidateSet('all','premiere-pro','photoshop','media-encoder','illustrator','indesign','after-effects','audition')]
  [string]$App = 'all',
  [switch]$EnableUnsigned,
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceRoot = Join-Path $projectRoot 'build\cep'
$extensionsRoot = Join-Path $env:APPDATA 'Adobe\CEP\extensions'
if (-not (Test-Path -LiteralPath $sourceRoot)) { throw 'Run npm run setup first.' }
$panels = Get-ChildItem -LiteralPath $sourceRoot -Directory | Where-Object { $_.Name -like 'com.adobemcp.*' -and ($App -eq 'all' -or $_.Name -eq "com.adobemcp.$App") }
if (-not $panels) { throw 'No prepared panel found.' }
New-Item -ItemType Directory -Path $extensionsRoot -Force | Out-Null
foreach ($panel in $panels) {
  $destination = [IO.Path]::GetFullPath((Join-Path $extensionsRoot $panel.Name))
  $allowedRoot = [IO.Path]::GetFullPath($extensionsRoot) + [IO.Path]::DirectorySeparatorChar
  if (-not $destination.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Extension destination is outside the CEP folder.' }
  if (Test-Path -LiteralPath $destination) {
    if (-not $Force) { throw "Panel exists: $destination. Use -Force to back it up and replace it." }
    $backup = $destination + '.backup-' + [guid]::NewGuid().ToString('N')
    Move-Item -LiteralPath $destination -Destination $backup
  }
  Copy-Item -LiteralPath $panel.FullName -Destination $destination -Recurse
  Write-Host "Installed $($panel.Name)"
}
if ($EnableUnsigned) {
  foreach ($version in 10,11,12) {
    $key = "HKCU:\Software\Adobe\CSXS.$version"
    New-Item -Path $key -Force | Out-Null
    New-ItemProperty -Path $key -Name PlayerDebugMode -Value '1' -PropertyType String -Force | Out-Null
  }
  Write-Host 'Enabled unsigned local development extensions for CEP 10, 11 and 12 in this user account.'
}
Write-Host 'Restart Adobe, then open Window > Extensions > Adobe MCP for the matching app.'
