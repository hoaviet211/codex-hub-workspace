param(
    [Parameter(Position = 0)]
    [string]$Message,
    [switch]$Chat,
    [Alias('p')]
    [switch]$Pipeline,
    [Alias('t')]
    [string]$Tier,
    [Alias('k')]
    [string]$Keywords,
    [Alias('m')]
    [string]$Mode,
    [switch]$DryRun,
    [Alias('h')]
    [switch]$Help,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CliArgs
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Initialize-Utf8Console {
    try {
        & cmd /c chcp 65001 > $null
    } catch {
        # Best effort only
    }

    $utf8 = [System.Text.UTF8Encoding]::new($false)
    [Console]::InputEncoding = $utf8
    [Console]::OutputEncoding = $utf8
    $global:OutputEncoding = $utf8
}

function Show-Usage {
    Write-Host @"
lco-msg - send a fast message to LCO from any folder

Usage:
  lco-msg "<message>" [--pipeline] [--tier 1|2|3] [--keywords "..."] [--mode fast|safe|deep] [--dry-run]
  lco-msg --chat [--dry-run]

Examples:
  lco-msg "fix login bug"
  lco-msg "implement checkout flow" --pipeline
  lco-msg "refactor auth" --pipeline --tier 2 --keywords auth,session --mode safe
  lco-msg --chat
  lco-msg --help

Behavior:
  - Default mode: runs `lco task "<message>"`.
  - Pipeline mode: runs `compose -> scan -> split -> handoff`.
  - Chat mode: continuous loop using task flow until you type /exit.
  - If 'lco' is not in PATH, falls back to 'node orchestrator/dist/cli/index.js'.
"@
}

function Fail {
    param(
        [string]$Message,
        [int]$Code = 1
    )
    Write-Error $Message
    exit $Code
}

function Resolve-RepoRoot {
    $scriptPath = $PSCommandPath
    if (-not $scriptPath) {
        $scriptPath = $MyInvocation.PSCommandPath
    }
    if (-not $scriptPath) {
        Fail "Cannot resolve script path."
    }
    return [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $scriptPath) ".."))
}

function Resolve-LcoInvoker {
    param([string]$RepoRoot)

    $lcoCmd = Get-Command lco -ErrorAction SilentlyContinue
    if ($lcoCmd) {
        return @{
            Kind = "lco"
        }
    }

    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Fail "Cannot find `lco` in PATH, and `node` is not installed. Install Node.js 18+ or add `lco` to PATH."
    }

    $fallbackCli = Join-Path $RepoRoot "orchestrator/dist/cli/index.js"
    if (-not (Test-Path -LiteralPath $fallbackCli -PathType Leaf)) {
        Fail "Cannot find LCO CLI at `orchestrator/dist/cli/index.js`. Run: cd orchestrator; npm install; npm run build"
    }

    return @{
        Kind = "node"
        CliPath = $fallbackCli
    }
}

function Invoke-Lco {
    param(
        [hashtable]$Invoker,
        [string[]]$Arguments
    )

    if ($Invoker.Kind -eq "lco") {
        & lco @Arguments | Out-Host
        if ($null -ne $LASTEXITCODE) { return $LASTEXITCODE }
        return $(if ($?) { 0 } else { 1 })
    }

    & node $Invoker.CliPath @Arguments | Out-Host
    if ($null -ne $LASTEXITCODE) { return $LASTEXITCODE }
    return $(if ($?) { 0 } else { 1 })
}

function Parse-Args {
    param([string[]]$ArgsToParse)

    if ($null -eq $ArgsToParse) {
        $ArgsToParse = @()
    }

    $result = [ordered]@{
        Help = $false
        Chat = $false
        Pipeline = $false
        Tier = "1"
        Keywords = $null
        Mode = $null
        DryRun = $false
        Message = $null
    }

    $messageParts = New-Object System.Collections.Generic.List[string]
    $i = 0
    while ($i -lt $ArgsToParse.Count) {
        $token = $ArgsToParse[$i]
        switch ($token) {
            "--help" { $result.Help = $true; $i++; continue }
            "-help" { $result.Help = $true; $i++; continue }
            "-h" { $result.Help = $true; $i++; continue }
            "--chat" { $result.Chat = $true; $i++; continue }
            "-chat" { $result.Chat = $true; $i++; continue }
            "--pipeline" { $result.Pipeline = $true; $i++; continue }
            "-pipeline" { $result.Pipeline = $true; $i++; continue }
            "-p" { $result.Pipeline = $true; $i++; continue }
            "--dry-run" { $result.DryRun = $true; $i++; continue }
            "-dry-run" { $result.DryRun = $true; $i++; continue }
            "--tier" {
                if ($i + 1 -ge $ArgsToParse.Count) { Fail "Missing value for --tier (use 1, 2, or 3)." }
                $result.Tier = $ArgsToParse[$i + 1]
                $i += 2
                continue
            }
            "-tier" {
                if ($i + 1 -ge $ArgsToParse.Count) { Fail "Missing value for -tier (use 1, 2, or 3)." }
                $result.Tier = $ArgsToParse[$i + 1]
                $i += 2
                continue
            }
            "-t" {
                if ($i + 1 -ge $ArgsToParse.Count) { Fail "Missing value for -t (use 1, 2, or 3)." }
                $result.Tier = $ArgsToParse[$i + 1]
                $i += 2
                continue
            }
            "--keywords" {
                if ($i + 1 -ge $ArgsToParse.Count) { Fail "Missing value for --keywords." }
                $result.Keywords = $ArgsToParse[$i + 1]
                $i += 2
                continue
            }
            "-keywords" {
                if ($i + 1 -ge $ArgsToParse.Count) { Fail "Missing value for -keywords." }
                $result.Keywords = $ArgsToParse[$i + 1]
                $i += 2
                continue
            }
            "-k" {
                if ($i + 1 -ge $ArgsToParse.Count) { Fail "Missing value for -k." }
                $result.Keywords = $ArgsToParse[$i + 1]
                $i += 2
                continue
            }
            "--mode" {
                if ($i + 1 -ge $ArgsToParse.Count) { Fail "Missing value for --mode (use fast, safe, or deep)." }
                $result.Mode = $ArgsToParse[$i + 1]
                $i += 2
                continue
            }
            "-mode" {
                if ($i + 1 -ge $ArgsToParse.Count) { Fail "Missing value for -mode (use fast, safe, or deep)." }
                $result.Mode = $ArgsToParse[$i + 1]
                $i += 2
                continue
            }
            "-m" {
                if ($i + 1 -ge $ArgsToParse.Count) { Fail "Missing value for -m (use fast, safe, or deep)." }
                $result.Mode = $ArgsToParse[$i + 1]
                $i += 2
                continue
            }
            default {
                [void]$messageParts.Add($token)
                $i++
            }
        }
    }

    if ($messageParts.Count -gt 0) {
        $result.Message = ($messageParts -join " ").Trim()
    }

    return $result
}

$parsedFromRest = Parse-Args -ArgsToParse $CliArgs
$parsed = [ordered]@{
    Help = ($Help.IsPresent -or $parsedFromRest.Help)
    Pipeline = ($Pipeline.IsPresent -or $parsedFromRest.Pipeline)
    Tier = $(if ($PSBoundParameters.ContainsKey("Tier")) { $Tier } else { $parsedFromRest.Tier })
    Keywords = $(if ($PSBoundParameters.ContainsKey("Keywords")) { $Keywords } else { $parsedFromRest.Keywords })
    Mode = $(if ($PSBoundParameters.ContainsKey("Mode")) { $Mode } else { $parsedFromRest.Mode })
    DryRun = ($DryRun.IsPresent -or $parsedFromRest.DryRun)
    Chat = ($Chat.IsPresent -or $parsedFromRest.Chat)
    Message = $(if (-not [string]::IsNullOrWhiteSpace($Message)) { $Message } else { $parsedFromRest.Message })
}

if (
    $parsed.Message -in @("--help", "-help", "-h") -and
    -not $parsed.Pipeline -and
    -not $parsed.DryRun -and
    [string]::IsNullOrWhiteSpace($parsed.Mode) -and
    [string]::IsNullOrWhiteSpace($parsed.Keywords)
) {
    $parsed.Help = $true
    $parsed.Message = $null
}

if (
    $parsed.Message -in @("--chat", "-chat") -and
    -not $parsed.Pipeline -and
    -not $parsed.DryRun -and
    [string]::IsNullOrWhiteSpace($parsed.Mode) -and
    [string]::IsNullOrWhiteSpace($parsed.Keywords)
) {
    $parsed.Chat = $true
    $parsed.Message = $null
}

if ($parsed.Help) {
    Show-Usage
    exit 0
}

Initialize-Utf8Console

if (-not $parsed.Chat -and [string]::IsNullOrWhiteSpace($parsed.Message)) {
    Show-Usage
    Fail "Message is required."
}

if ($parsed.Tier -notin @("1", "2", "3")) {
    Fail "Invalid --tier value: $($parsed.Tier). Use 1, 2, or 3."
}

if ($parsed.Mode -and ($parsed.Mode -notin @("fast", "safe", "deep"))) {
    Fail "Invalid --mode value: $($parsed.Mode). Use fast, safe, or deep."
}

if (($parsed.Tier -in @("2", "3")) -and [string]::IsNullOrWhiteSpace($parsed.Keywords)) {
    Fail "--keywords is required when --tier is 2 or 3."
}

$repoRoot = Resolve-RepoRoot
$invoker = Resolve-LcoInvoker -RepoRoot $repoRoot

Push-Location $repoRoot
try {
    if ($parsed.Chat) {
        Write-Host "[lco-msg] checking Ollama..."
        $pingExit = Invoke-Lco -Invoker $invoker -Arguments @("ping")
        if ($pingExit -ne 0) {
            Write-Error "Ollama is not running or model is unavailable. Start it with: ollama serve"
            exit 1
        }
        Write-Host "[lco-msg] chat mode ready. Type /exit to quit."
        while ($true) {
            $chatInput = Read-Host "you"
            if ([string]::IsNullOrWhiteSpace($chatInput)) {
                continue
            }
            if ($chatInput -eq "/exit") {
                Write-Host "[lco-msg] chat ended."
                exit 0
            }

            Write-Host "[lco-msg] running task flow..."
            $chatTaskArgs = @("task", $chatInput)
            if ($parsed.DryRun) {
                $chatTaskArgs += "--dry-run"
            }

            $chatExitCode = Invoke-Lco -Invoker $invoker -Arguments $chatTaskArgs
            if ($chatExitCode -ne 0) {
                Write-Host "`nHint: if Ollama is down, run `ollama serve` and ensure model `gemma4:e4b` is pulled."
            }
        }
    }

    if (-not $parsed.Pipeline) {
        Write-Host "[lco-msg] running task flow..."
        $taskArgs = @("task", $parsed.Message)
        if ($parsed.DryRun) {
            $taskArgs += "--dry-run"
        }
        $exitCode = Invoke-Lco -Invoker $invoker -Arguments $taskArgs
        if ($exitCode -ne 0) {
            Write-Host "`nHint: if Ollama is down, run `ollama serve` and ensure model `gemma4:e4b` is pulled."
            exit $exitCode
        }
        exit 0
    }

    if ($parsed.Mode) {
        Write-Host "[lco-msg] pre-plan mode: $($parsed.Mode)"
        $planArgs = @("plan", $parsed.Message, "--mode", $parsed.Mode)
        $planExit = Invoke-Lco -Invoker $invoker -Arguments $planArgs
        if ($planExit -ne 0) {
            Write-Host "`nHint: check LCO setup. You can skip this by removing --mode."
            exit $planExit
        }
    }

    Write-Host "[lco-msg] [1/4] compose"
    $composeArgs = @("compose", $parsed.Message)
    if ($parsed.DryRun) { $composeArgs += "--dry-run" }
    $composeExit = Invoke-Lco -Invoker $invoker -Arguments $composeArgs
    if ($composeExit -ne 0) {
        Write-Host "`nHint: if Ollama is down, run `ollama serve` and ensure model `gemma4:e4b` is pulled."
        exit $composeExit
    }

    Write-Host "[lco-msg] [2/4] scan (tier $($parsed.Tier))"
    $scanArgs = @("scan", "--tier", $parsed.Tier)
    if ($parsed.Keywords) { $scanArgs += @("--keywords", $parsed.Keywords) }
    if ($parsed.DryRun) { $scanArgs += "--dry-run" }
    $scanExit = Invoke-Lco -Invoker $invoker -Arguments $scanArgs
    if ($scanExit -ne 0) { exit $scanExit }

    Write-Host "[lco-msg] [3/4] split"
    $splitArgs = @("split")
    if ($parsed.DryRun) { $splitArgs += "--dry-run" }
    $splitExit = Invoke-Lco -Invoker $invoker -Arguments $splitArgs
    if ($splitExit -ne 0) { exit $splitExit }

    $planPath = Join-Path $repoRoot ".orchestrator/patches/plan.json"
    if (-not (Test-Path -LiteralPath $planPath -PathType Leaf)) {
        Fail "Missing patch plan at .orchestrator/patches/plan.json after split."
    }

    $planJson = Get-Content -LiteralPath $planPath -Raw | ConvertFrom-Json
    if (-not $planJson.patches -or $planJson.patches.Count -eq 0) {
        Fail "No patches found in .orchestrator/patches/plan.json."
    }

    $patchId = [string]$planJson.patches[0].patch_id
    if ([string]::IsNullOrWhiteSpace($patchId)) {
        Fail "Cannot resolve patch_id from plan.json."
    }

    Write-Host "[lco-msg] [4/4] handoff ($patchId)"
    $handoffArgs = @("handoff", $patchId)
    if ($parsed.DryRun) { $handoffArgs += "--dry-run" }
    $handoffExit = Invoke-Lco -Invoker $invoker -Arguments $handoffArgs
    if ($handoffExit -ne 0) { exit $handoffExit }

    if (-not $parsed.DryRun) {
        $handoffPath = Join-Path $repoRoot ".orchestrator/handoff/codex-prompt-$patchId.md"
        Write-Host ""
        Write-Host "Final handoff file: $handoffPath"
    }
} finally {
    Pop-Location
}
