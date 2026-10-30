[CmdletBinding()]
param(
    [string[]]$Apps,
    [string]$Root,
    [switch]$ServerOnly,
    [switch]$EnableUnsigned,
    [switch]$ReplaceExisting
)
$ErrorActionPreference = 'Stop'
$repository = 'salehghotbani/adobe-mcp-suite'
if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') {
    throw 'Use the Windows x64 bundle on an x64 system. Windows ARM64 is not packaged.'
}
$release = Invoke-RestMethod "https://api.github.com/repos/$repository/releases/latest" -Headers @{ 'User-Agent' = 'adobe-mcp-installer' }
if ($release.draft -or $release.prerelease -or $release.tag_name -notmatch '^v\d+\.\d+\.\d+$') { throw 'No valid stable release was found.' }
$name = "adobe-mcp-suite-$($release.tag_name)-windows-x64.zip"
$asset = @($release.assets | Where-Object name -EQ $name)
$sums = @($release.assets | Where-Object name -EQ 'SHA256SUMS')
$baseUrl = "https://github.com/$repository/releases/download/$($release.tag_name)/"
if ($asset.Count -ne 1 -or $sums.Count -ne 1 -or $asset[0].browser_download_url -ne "$baseUrl$name" -or $sums[0].browser_download_url -ne "${baseUrl}SHA256SUMS") { throw 'Release assets are incomplete or invalid.' }
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('adobe-mcp-install-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporary | Out-Null
try {
    $checksumPath = Join-Path $temporary 'SHA256SUMS'
    Invoke-WebRequest "${baseUrl}SHA256SUMS" -OutFile $checksumPath -UseBasicParsing
    $checksumText = Get-Content -LiteralPath $checksumPath -Raw -Encoding UTF8
    $checksumLines = @($checksumText -split '\r?\n' | Where-Object { $_ -match ('^[a-fA-F0-9]{64}\s+\*?' + [regex]::Escape($name) + '$') })
    if ($checksumLines.Count -ne 1) { throw 'Missing or ambiguous checksum.' }
    $expected = ($checksumLines[0] -split '\s+')[0].ToLowerInvariant()
    if ($asset[0].digest -and $asset[0].digest -ne "sha256:$expected") { throw 'GitHub asset digest does not match SHA256SUMS.' }
    $archive = Join-Path $temporary 'bundle.zip'
    Invoke-WebRequest "$baseUrl$name" -OutFile $archive -UseBasicParsing
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Downloaded archive checksum mismatch.' }
    $bundle = Join-Path $temporary 'bundle'
    Expand-Archive -LiteralPath $archive -DestinationPath $bundle
    $arguments = @((Join-Path $bundle 'app/bin/adobe-mcp.mjs'), 'install')
    if ($Apps) { $arguments += @('--apps', ($Apps -join ',')) }
    if ($Root) { $arguments += @('--root', $Root) }
    if ($ServerOnly) { $arguments += '--server-only' }
    if ($EnableUnsigned) { $arguments += '--enable-unsigned' }
    if ($ReplaceExisting) { $arguments += '--replace-existing' }
    & (Join-Path $bundle 'runtime/node.exe') @arguments
    if ($LASTEXITCODE -ne 0) { throw "Installer exited with code $LASTEXITCODE." }
} finally {
    $resolvedTemporary = [IO.Path]::GetFullPath($temporary)
    $temporaryParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolvedTemporary.StartsWith($temporaryParent, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolvedTemporary) -notlike 'adobe-mcp-install-*') { throw 'Unsafe temporary cleanup path.' }
    Remove-Item -LiteralPath $resolvedTemporary -Recurse -Force
}
