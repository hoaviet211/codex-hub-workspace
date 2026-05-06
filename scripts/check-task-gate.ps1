param(
    [string]$TaskPath,
    [string]$Project,
    [ValidateSet("Express", "Standard", "Rigorous")]
    [string]$Mode = "Standard",
    [switch]$WarnOnly
)

$ErrorActionPreference = "Stop"

function Resolve-HubRoot {
    $current = (Get-Location).Path
    while ($current) {
        $hasAgents = Test-Path -LiteralPath (Join-Path $current "AGENTS.md") -PathType Leaf
        $hasWorkspace = Test-Path -LiteralPath (Join-Path $current "workspace") -PathType Container
        if ($hasAgents -and $hasWorkspace) {
            return $current
        }
        $parent = Split-Path -Path $current -Parent
        if ($parent -eq $current) { break }
        $current = $parent
    }
    throw "Cannot locate Codex Hub root from current directory."
}

function Get-LatestTask {
    param([string]$Root, [string]$ProjectName)

    $tasksPath = Join-Path $Root "workspace\tasks"
    if (-not (Test-Path -LiteralPath $tasksPath -PathType Container)) {
        return $null
    }

    $tasks = Get-ChildItem -LiteralPath $tasksPath -File -Filter "*.md" |
        Where-Object {
            if ([string]::IsNullOrWhiteSpace($ProjectName)) { return $true }
            $content = Get-Content -LiteralPath $_.FullName -Raw
            return $content -match [regex]::Escape($ProjectName)
        } |
        Sort-Object LastWriteTime -Descending

    return $tasks | Select-Object -First 1
}

function Test-Section {
    param([string]$Content, [string]$Heading)
    return $Content -match "(?m)^##\s+$([regex]::Escape($Heading))\s*$"
}

$hubRoot = Resolve-HubRoot

if ([string]::IsNullOrWhiteSpace($TaskPath)) {
    $task = Get-LatestTask -Root $hubRoot -ProjectName $Project
    if ($null -eq $task) {
        $message = "FAIL task-gate: no task file found under workspace/tasks."
        if ($WarnOnly) { Write-Warning $message; exit 0 }
        Write-Error $message
        exit 2
    }
    $TaskPath = $task.FullName
}

$resolvedTask = Resolve-Path -LiteralPath $TaskPath -ErrorAction Stop
$content = Get-Content -LiteralPath $resolvedTask.Path -Raw

$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

foreach ($section in @("Muc Tieu", "Pham Vi", "Acceptance Criteria", "Safety Gate Check", "Progress", "Next Step")) {
    if (-not (Test-Section -Content $content -Heading $section)) {
        $failures.Add("missing section: $section")
    }
}

if ($Mode -in @("Standard", "Rigorous")) {
    if ($content -notmatch "(?m)^-\s+\[[ xX]\]\s+AC\d+:") {
        $failures.Add("missing numbered AC checklist items")
    }
    if ($content -match "PROCESS EXCEPTION|Backfill note|hoi cuu") {
        $warnings.Add("task contains backfill/process-exception wording; do not treat AC as pre-approved")
    }
}

if ($content -notmatch "\*\*Mode da chon\*\*:\s*(Express|Standard|Rigorous)") {
    $failures.Add("missing '**Mode da chon**: Express|Standard|Rigorous'")
}

if ($content -match "(?m)^-\s+\[x\]\s+Implementation done" -and
    $content -match "(?m)^-\s+\[ \]\s+Verification pass") {
    $warnings.Add("implementation marked done while verification is still open")
}

$result = [ordered]@{
    status = if ($failures.Count -eq 0) { "pass" } else { "fail" }
    mode = $Mode
    task = $resolvedTask.Path
    failures = @($failures)
    warnings = @($warnings)
}

$result | ConvertTo-Json -Depth 4

if ($failures.Count -gt 0 -and -not $WarnOnly) {
    exit 2
}

exit 0
