Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $scriptDir ".."))
$runner = Join-Path $scriptDir "lco-msg.ps1"

if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) {
    Write-Error "Cannot find lco-msg script at: $runner"
    exit 1
}

Push-Location $repoRoot
try {
    & $runner --chat
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
