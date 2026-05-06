param(
    [Parameter(Mandatory = $true)]
    [string]$SkillName,

    [Parameter(Mandatory = $true)]
    [string]$WorkspaceId,

    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $true)]
    [string]$SessionId,

    [Parameter(Mandatory = $true)]
    [string]$Query,

    [string]$TaskId = "",
    [string]$Root = ".",
    [string]$Output = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    param([string]$BasePath)
    [System.IO.Path]::GetFullPath($BasePath)
}

function Read-TextFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
    }
    Get-Content -LiteralPath $Path -Raw
}

function Format-MemoryItems {
    param([object[]]$Items)

    if (-not $Items -or $Items.Count -eq 0) {
        return @("- None")
    }

    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($item in $Items) {
        $text = ($item.text -replace '\s+', ' ').Trim()
        if ($text.Length -gt 180) {
            $text = $text.Substring(0, 177) + "..."
        }
        [void]$lines.Add("- [$($item.kind)] $($item.title): $text")
    }

    return $lines
}

$rootPath = Get-RepoRoot -BasePath $Root
$skillPath = Join-Path $rootPath ".codex/skills/$SkillName/SKILL.md"
if (-not (Test-Path -LiteralPath $skillPath -PathType Leaf)) {
    throw "Skill not found: $skillPath"
}

$memoryJson = $null
$memoryError = $null
$memoryLimit = 8
$databaseUrl = $env:DATABASE_URL

if ($databaseUrl) {
    try {
        Push-Location (Join-Path $rootPath "memory-service")
        $cliOutput = & npm run cli -- retrieve --database-url $databaseUrl --workspace $WorkspaceId --project $ProjectId --session $SessionId --query $Query --limit $memoryLimit 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "memory-service retrieval failed with exit code $LASTEXITCODE"
        }
        $memoryJson = ($cliOutput | Out-String).Trim()
    }
    catch {
        $memoryError = $_.Exception.Message
    }
    finally {
        Pop-Location
    }
}
else {
    $memoryError = "DATABASE_URL is not set"
}

$memoryLines = New-Object System.Collections.Generic.List[string]
[void]$memoryLines.Add("## Retrieved Memory")
[void]$memoryLines.Add("")
[void]$memoryLines.Add("- Workspace: $WorkspaceId")
[void]$memoryLines.Add("- Project: $ProjectId")
[void]$memoryLines.Add("- Session: $SessionId")
[void]$memoryLines.Add("- Query: $Query")

if ($memoryJson) {
    $retrieved = $memoryJson | ConvertFrom-Json
    [void]$memoryLines.Add("")
    foreach ($line in (Format-MemoryItems -Items $retrieved.items)) {
        [void]$memoryLines.Add($line)
    }
}
else {
    $fallbackMemory = Read-TextFile -Path (Join-Path $rootPath "workspace/memory.md")
    [void]$memoryLines.Add("- Retrieval note: $memoryError")
    if ($fallbackMemory) {
        [void]$memoryLines.Add('- Source: `workspace/memory.md`')
        [void]$memoryLines.Add("")
        [void]$memoryLines.Add('```markdown')
        foreach ($line in ($fallbackMemory.TrimEnd() -split "`r?`n")) {
            [void]$memoryLines.Add($line)
        }
        [void]$memoryLines.Add('```')
    }
    else {
        [void]$memoryLines.Add("- No fallback memory available.")
    }
}

$skillText = (Read-TextFile -Path $skillPath).TrimEnd()

$promptLines = New-Object System.Collections.Generic.List[string]
[void]$promptLines.Add("# Memory-Aware Skill Packet")
[void]$promptLines.Add("")
[void]$promptLines.Add("## Scope")
[void]$promptLines.Add("")
[void]$promptLines.Add("- Skill: $SkillName")
[void]$promptLines.Add("- Workspace: $WorkspaceId")
[void]$promptLines.Add("- Project: $ProjectId")
[void]$promptLines.Add("- Session: $SessionId")
[void]$promptLines.Add("- Task: $(if ($TaskId) { $TaskId } else { 'n/a' })")
[void]$promptLines.Add("")
[void]$promptLines.Add("## Query")
[void]$promptLines.Add("")
[void]$promptLines.Add($Query)
[void]$promptLines.Add("")
foreach ($line in $memoryLines) {
    [void]$promptLines.Add($line)
}
[void]$promptLines.Add("")
[void]$promptLines.Add("## Skill Instructions")
[void]$promptLines.Add("")
[void]$promptLines.Add('```markdown')
foreach ($line in ($skillText -split "`r?`n")) {
    [void]$promptLines.Add($line)
}
[void]$promptLines.Add('```')

$prompt = [string]::Join([Environment]::NewLine, $promptLines)

if ([string]::IsNullOrWhiteSpace($Output)) {
    Write-Output $prompt
}
else {
    $outputPath = [System.IO.Path]::GetFullPath((Join-Path $rootPath $Output))
    $outputDirectory = Split-Path -Parent $outputPath
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($outputPath, $prompt, [System.Text.UTF8Encoding]::new($false))
    Write-Output $outputPath
}
