$ErrorActionPreference = 'Stop'
$testDirectory = Join-Path ([IO.Path]::GetTempPath()) ('adobe-mcp-bootstrap-test-' + [guid]::NewGuid().ToString('N'))
$runtimePath = (Get-Command node).Source
$archiveBytes = [Text.Encoding]::UTF8.GetBytes('synthetic release archive')
$hashProvider = [Security.Cryptography.SHA256]::Create()
try { $archiveHash = ([BitConverter]::ToString($hashProvider.ComputeHash($archiveBytes))).Replace('-', '').ToLowerInvariant() }
finally { $hashProvider.Dispose() }
$assetName = 'adobe-mcp-suite-v1.2.3-windows-x64.zip'
$downloadBase = 'https://github.com/salehghotbani/adobe-mcp-suite/releases/download/v1.2.3/'
New-Item -ItemType Directory -Path $testDirectory | Out-Null

# Simulate GitHub's application/octet-stream checksum response without network access.
function Invoke-RestMethod {
    param($Uri, $Headers)
    return [pscustomobject]@{
        tag_name = 'v1.2.3'; draft = $false; prerelease = $false
        assets = @(
            [pscustomobject]@{ name = $assetName; browser_download_url = "$downloadBase$assetName"; digest = "sha256:$archiveHash" },
            [pscustomobject]@{ name = 'SHA256SUMS'; browser_download_url = "${downloadBase}SHA256SUMS" }
        )
    }
}
function Invoke-WebRequest {
    param($Uri, [string]$OutFile, [switch]$UseBasicParsing)
    if ($Uri -eq "${downloadBase}SHA256SUMS") { $bytes = [Text.Encoding]::UTF8.GetBytes("$archiveHash  $assetName`n") }
    elseif ($Uri -eq "$downloadBase$assetName") { $bytes = $archiveBytes }
    else { throw 'Unexpected download URL.' }
    if ($OutFile) { [IO.File]::WriteAllBytes($OutFile, $bytes) }
    else { return [pscustomobject]@{ Content = $bytes } }
}
function Expand-Archive {
    param([string]$LiteralPath, [string]$DestinationPath)
    if ((Get-FileHash -LiteralPath $LiteralPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $archiveHash) { throw 'Unexpected archive contents.' }
    New-Item -ItemType Directory -Path (Join-Path $DestinationPath 'runtime'), (Join-Path $DestinationPath 'app/bin') -Force | Out-Null
    Copy-Item -LiteralPath $runtimePath -Destination (Join-Path $DestinationPath 'runtime/node.exe')
    [IO.File]::WriteAllText((Join-Path $DestinationPath 'app/bin/adobe-mcp.mjs'), 'console.log(JSON.stringify(process.argv.slice(2)));')
}
try {
    $installationHome = Join-Path $testDirectory 'home with spaces'
    $arguments = & (Join-Path $PSScriptRoot '../../install.ps1') -Apps photoshop,illustrator -Root $installationHome -ServerOnly | ConvertFrom-Json
    $expected = @('install', '--apps', 'photoshop,illustrator', '--root', $installationHome, '--server-only')
    if (($arguments | ConvertTo-Json -Compress) -ne ($expected | ConvertTo-Json -Compress)) { throw 'The bootstrap did not forward the requested selection and root.' }
    Write-Output 'PowerShell binary checksum download and argument forwarding passed.'
} finally {
    $resolvedTestDirectory = [IO.Path]::GetFullPath($testDirectory)
    $temporaryParent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if (-not $resolvedTestDirectory.StartsWith($temporaryParent, [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolvedTestDirectory) -notlike 'adobe-mcp-bootstrap-test-*') { throw 'Unsafe temporary cleanup path.' }
    Remove-Item -LiteralPath $resolvedTestDirectory -Recurse -Force
}
