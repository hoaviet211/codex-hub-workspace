param(
    [ValidateSet("propose-memory")]
    [string]$Mode = "propose-memory",

    [Parameter(Mandatory = $true)]
    [string]$WorkspaceId,

    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [string]$SessionId = "",

    [Parameter(Mandatory = $true)]
    [string]$Source,

    [string]$Model = "gemma4:e4b",

    [string]$OllamaUrl = "http://localhost:11434",

    [int]$GenerateTimeoutSec = 45,

    [string]$OutputFolder = "workspace/artifacts/memory-candidates",

    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Initialize-Utf8Console {
    try { & cmd /c chcp 65001 > $null } catch { }
    $utf8 = [System.Text.UTF8Encoding]::new($false)
    [Console]::InputEncoding = $utf8
    [Console]::OutputEncoding = $utf8
    $global:OutputEncoding = $utf8
}

function Resolve-RepoRoot {
    $scriptPath = $PSCommandPath
    if (-not $scriptPath) { $scriptPath = $MyInvocation.PSCommandPath }
    if (-not $scriptPath) { throw "Cannot resolve script path." }
    return [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $scriptPath) ".."))
}

function New-FallbackResult {
    param(
        [string]$Reason,
        [string]$Impact,
        [string]$Fallback
    )

    return [ordered]@{
        candidates = @()
        conflicts = @()
        staleItems = @()
        suggestedActions = @(
            "Model unavailable: $Reason",
            "Impact: $Impact",
            "Fallback: $Fallback"
        )
    }
}

function Test-OllamaModel {
    param(
        [string]$BaseUrl,
        [string]$ModelName
    )

    try {
        $tags = Invoke-RestMethod -Method Get -Uri "$BaseUrl/api/tags" -TimeoutSec 5
    } catch {
        return @{
            Ok = $false
            Reason = "Ollama API is unreachable at $BaseUrl. $($_.Exception.Message)"
        }
    }

    $available = @($tags.models | ForEach-Object { $_.name })
    if ($available -notcontains $ModelName) {
        return @{
            Ok = $false
            Reason = "Model '$ModelName' is not available. Available models: $($available -join ', ')"
        }
    }

    return @{ Ok = $true; Reason = "" }
}

function Get-JsonFromText {
    param([string]$Text)

    $trimmed = $Text.Trim()
    if ($trimmed.StartsWith('```')) {
        $trimmed = $trimmed -replace '^```(?:json)?\s*', ''
        $trimmed = $trimmed -replace '\s*```$', ''
    }
    return $trimmed.Trim()
}

function Assert-CuratorResult {
    param([object]$Result)

    $topLevelProperties = @("candidates", "conflicts", "staleItems", "suggestedActions")
    foreach ($property in $topLevelProperties) {
        if (-not ($Result.PSObject.Properties.Name -contains $property)) {
            throw "Invalid curator output: missing top-level property '$property'."
        }
    }

    $validTypes = @("user_preference", "project_decision", "failure_pattern", "reusable_workflow", "source_summary")
    $validActions = @("create", "update", "merge", "ignore")
    $validDestinations = @("memory-service", "obsidian", "AGENTS.md", "config.yaml", "workflows", "ignore")

    foreach ($candidate in @($Result.candidates)) {
        $candidateProperties = @("type", "scope", "title", "summary", "evidence", "confidence", "action", "conflictsWith", "suggestedDestination")
        foreach ($property in $candidateProperties) {
            if (-not ($candidate.PSObject.Properties.Name -contains $property)) {
                throw "Invalid candidate: missing property '$property'."
            }
        }

        if ($validTypes -notcontains [string]$candidate.type) { throw "Invalid candidate type: $($candidate.type)" }
        if ($validActions -notcontains [string]$candidate.action) { throw "Invalid candidate action: $($candidate.action)" }
        if ($validDestinations -notcontains [string]$candidate.suggestedDestination) { throw "Invalid suggestedDestination: $($candidate.suggestedDestination)" }
        if (-not $candidate.scope.workspaceId -or -not $candidate.scope.projectId) { throw "Invalid candidate scope: workspaceId and projectId are required." }
        if ([double]$candidate.confidence -lt 0 -or [double]$candidate.confidence -gt 1) { throw "Invalid confidence for '$($candidate.title)'." }
        if ([string]$candidate.action -ne "ignore" -and @($candidate.evidence).Count -eq 0) { throw "Candidate '$($candidate.title)' has no evidence." }
    }
}

Initialize-Utf8Console

if (-not $DryRun) {
    throw "This prototype is dry-run only. Re-run with -DryRun. It never writes memory-service."
}

$repoRoot = Resolve-RepoRoot
$sourcePath = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $Source))
if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "Source file not found: $sourcePath"
}

$sourceText = Get-Content -LiteralPath $sourcePath -Raw
if ([string]::IsNullOrWhiteSpace($sourceText)) {
    throw "Source file is empty: $sourcePath"
}

$modelCheck = Test-OllamaModel -BaseUrl $OllamaUrl -ModelName $Model
if (-not $modelCheck.Ok) {
    $result = New-FallbackResult -Reason $modelCheck.Reason -Impact "No memory candidates were generated." -Fallback "Start Ollama, pull '$Model', then rerun this script. You can still curate manually from the source artifact."
} else {
    $sourceForPrompt = $sourceText
    if ($sourceForPrompt.Length -gt 16000) {
        $sourceForPrompt = $sourceForPrompt.Substring(0, 16000)
    }

    $sessionValue = if ([string]::IsNullOrWhiteSpace($SessionId)) { "null" } else { $SessionId }
    $promptLines = @(
        "You are Gemma4 acting only as a Codex Hub memory curator and context compressor.",
        "",
        "Return valid JSON only. Do not use markdown fences. Do not propose shell commands. Do not mutate files. Do not write official memory.",
        "",
        "Scope:",
        "- workspaceId: $WorkspaceId",
        "- projectId: $ProjectId",
        "- sessionId: $sessionValue",
        "- source: $Source",
        "",
        "Classify useful knowledge into candidates. Use evidence from the source. Preserve workspaceId -> projectId -> sessionId.",
        "",
        "Required JSON shape:",
        "{",
        '  "candidates": [',
        "    {",
        '      "type": "user_preference | project_decision | failure_pattern | reusable_workflow | source_summary",',
        '      "scope": {',
        '        "workspaceId": "string",',
        '        "projectId": "string",',
        '        "sessionId": "string|null"',
        "      },",
        '      "title": "string",',
        '      "summary": "string",',
        '      "evidence": ["string"],',
        '      "confidence": 0.0,',
        '      "action": "create | update | merge | ignore",',
        '      "conflictsWith": [],',
        '      "suggestedDestination": "memory-service | obsidian | AGENTS.md | config.yaml | workflows | ignore"',
        "    }",
        "  ],",
        '  "conflicts": [],',
        '  "staleItems": [],',
        '  "suggestedActions": []',
        "}",
        "",
        "Source:",
        "---",
        $sourceForPrompt,
        "---"
    )
    $prompt = [string]::Join([Environment]::NewLine, $promptLines)

    $body = @{
        model = $Model
        prompt = $prompt
        stream = $false
        format = "json"
        options = @{
            temperature = 0.2
        }
    } | ConvertTo-Json -Depth 8

    try {
        $response = Invoke-RestMethod -Method Post -Uri "$OllamaUrl/api/generate" -Body $body -ContentType "application/json" -TimeoutSec $GenerateTimeoutSec
        $jsonText = Get-JsonFromText -Text ([string]$response.response)
        $result = $jsonText | ConvertFrom-Json
        Assert-CuratorResult -Result $result
    } catch {
        $result = New-FallbackResult -Reason "Gemma output failed validation. $($_.Exception.Message)" -Impact "No model-generated candidates should be trusted from this run." -Fallback "Rerun after simplifying the source or curate manually using the skill contract."
    }
}

$outputRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $OutputFolder))
if (-not (Test-Path -LiteralPath $outputRoot)) {
    New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
}

$safeSourceName = [System.IO.Path]::GetFileNameWithoutExtension($Source) -replace '[^a-zA-Z0-9._-]', '-'
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputPath = Join-Path $outputRoot "$timestamp-$safeSourceName.candidates.json"

$envelope = [ordered]@{
    mode = $Mode
    dryRun = $true
    canonicalMemoryWritten = $false
    source = $Source
    workspaceId = $WorkspaceId
    projectId = $ProjectId
    sessionId = $(if ([string]::IsNullOrWhiteSpace($SessionId)) { $null } else { $SessionId })
    model = $Model
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    result = $result
}

$json = $envelope | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($outputPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Output $outputPath
