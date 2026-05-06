param(
    [datetime]$Date = (Get-Date),
    [string]$OutputPath,
    [switch]$Force
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

function Get-GitSummary {
    param([string]$RepoPath, [datetime]$Since, [datetime]$Until)

    if (-not (Test-Path -LiteralPath (Join-Path $RepoPath ".git"))) {
        return $null
    }

    $sinceText = $Since.ToString("yyyy-MM-dd HH:mm:ss")
    $untilText = $Until.ToString("yyyy-MM-dd HH:mm:ss")
    $commits = git -C $RepoPath log "--since=$sinceText" "--until=$untilText" --pretty=format:"%h`t%ad`t%s" --date=iso 2>$null
    if ([string]::IsNullOrWhiteSpace(($commits -join "`n"))) {
        return $null
    }

    $count = git -C $RepoPath rev-list --count "--since=$sinceText" "--until=$untilText" HEAD 2>$null
    $shortstat = git -C $RepoPath log "--since=$sinceText" "--until=$untilText" --shortstat --oneline 2>$null

    [pscustomobject]@{
        Path = $RepoPath
        Count = $count
        Commits = @($commits)
        Shortstat = @($shortstat)
    }
}

$hubRoot = Resolve-HubRoot
$day = $Date.Date
$nextDay = $day.AddDays(1)
$dateText = $day.ToString("yyyy-MM-dd")

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $hubRoot "workspace\artifacts\$dateText-daily-review.md"
}

if ((Test-Path -LiteralPath $OutputPath -PathType Leaf) -and -not $Force) {
    Write-Output $OutputPath
    Write-Warning "Daily review already exists. Use -Force to overwrite."
    exit 0
}

$repoCandidates = @($hubRoot)
$projectsPath = Join-Path $hubRoot "projects"
if (Test-Path -LiteralPath $projectsPath -PathType Container) {
    $repoCandidates += Get-ChildItem -LiteralPath $projectsPath -Directory | ForEach-Object { $_.FullName }
}
$memoryServicePath = Join-Path $hubRoot "memory-service"
if (Test-Path -LiteralPath $memoryServicePath -PathType Container) {
    $repoCandidates += $memoryServicePath
}

$summaries = foreach ($repo in ($repoCandidates | Sort-Object -Unique)) {
    Get-GitSummary -RepoPath $repo -Since $day -Until $nextDay
}
$summaries = @($summaries | Where-Object { $null -ne $_ })

$recentTasks = Get-ChildItem -LiteralPath (Join-Path $hubRoot "workspace\tasks") -File -Filter "*.md" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge $day -and $_.LastWriteTime -lt $nextDay } |
    Sort-Object LastWriteTime

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Daily Review: $dateText")
$lines.Add("")
$lines.Add("## Work Output")
$lines.Add("")
if ($summaries) {
    foreach ($summary in $summaries) {
        $relative = $summary.Path.Replace($hubRoot, ".")
        $lines.Add("- Repo: $relative")
        $lines.Add("  - Commits: $($summary.Count)")
        foreach ($commit in $summary.Commits) {
            $lines.Add("  - $commit")
        }
    }
} else {
    $lines.Add("- No git commits detected for this date.")
}
$lines.Add("")
$lines.Add("## Task / AC Trace")
$lines.Add("")
if ($recentTasks) {
    foreach ($task in $recentTasks) {
        $relativeTask = $task.FullName.Replace($hubRoot + "\", "")
        $lines.Add("- $relativeTask")
    }
} else {
    $lines.Add("- No task files updated for this date.")
}
$lines.Add("")
$lines.Add("## Verification")
$lines.Add("")
$lines.Add("- [ ] Build/lint/test evidence captured where applicable")
$lines.Add("- [ ] Browser/manual checks captured where applicable")
$lines.Add("- [ ] Open verification gaps listed")
$lines.Add("")
$lines.Add("## Process Gaps")
$lines.Add("")
$lines.Add("- [ ] Missing task/AC before implementation")
$lines.Add("- [ ] Missing verification evidence")
$lines.Add("- [ ] Missing handoff or next step")
$lines.Add("")
$lines.Add("## User Interaction Signals")
$lines.Add("")
$lines.Add("- Correction signals:")
$lines.Add("- Repeated asks:")
$lines.Add("- Preference changes:")
$lines.Add("")
$lines.Add("## Memory Candidates")
$lines.Add("")
$lines.Add("- [ ] No candidate needed")
$lines.Add("- [ ] Create candidate from durable behavior/process signal")
$lines.Add("")
$lines.Add("## Next Day Plan")
$lines.Add("")
$lines.Add("1. ")

New-Item -ItemType Directory -Force -Path (Split-Path -Path $OutputPath -Parent) | Out-Null
Set-Content -LiteralPath $OutputPath -Value ($lines -join "`r`n") -Encoding UTF8
Write-Output $OutputPath
