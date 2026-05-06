param(
    [string]$Root = ".",
    [string]$Output = "",
    [ValidateSet("full", "code-only")]
    [string]$Mode = "full",
    [string[]]$Include = @(
        "*.ps1", "*.psm1", "*.psd1",
        "*.js", "*.jsx", "*.ts", "*.tsx",
        "*.json", "*.jsonc",
        "*.yaml", "*.yml",
        "*.toml", "*.ini", "*.env.example",
        "*.py", "*.rb", "*.go", "*.rs", "*.java", "*.kt", "*.cs",
        "*.php", "*.sh", "*.bash", "*.zsh",
        "*.sql",
        "*.md",
        "*.txt",
        "*.xml",
        "*.csv"
    ),
    [string[]]$ExcludeDirs = @(
        ".git", ".next", ".turbo", ".vercel",
        "node_modules", "dist", "build", "coverage",
        ".cache", ".idea", ".vscode", ".pytest_cache",
        ".parcel-cache", ".sass-cache",
        "workspace/artifacts"
    ),
    [string[]]$ExcludeFiles = @(
        "*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp", "*.svg", "*.ico",
        "*.pdf", "*.zip", "*.tar", "*.gz", "*.7z",
        "*.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
        "bun.lockb", "Cargo.lock", "poetry.lock", "Pipfile.lock",
        "*.min.js", "*.min.css", "*.map",
        "*.exe", "*.dll", "*.so", "*.dylib",
        "*context.md"
    ),
    [int]$MaxFileSizeKB = 256
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RelativePathCompat {
    param(
        [string]$BasePath,
        [string]$TargetPath
    )

    $baseFull = [System.IO.Path]::GetFullPath($BasePath)
    $targetFull = [System.IO.Path]::GetFullPath($TargetPath)

    $baseUri = [System.Uri]($baseFull.TrimEnd("\") + "\")
    $targetUri = [System.Uri]$targetFull
    $relativeUri = $baseUri.MakeRelativeUri($targetUri)
    return [System.Uri]::UnescapeDataString($relativeUri.ToString()) -replace "/", "\"
}

function Test-ExcludedDirectory {
    param(
        [string]$RelativePath,
        [string[]]$DirectoryPatterns
    )

    $normalized = ($RelativePath -replace "\\", "/").Trim("/")
    foreach ($pattern in $DirectoryPatterns) {
        $dir = ($pattern -replace "\\", "/").Trim("/")
        if (-not $dir) {
            continue
        }

        if (
            $normalized -eq $dir -or
            $normalized.StartsWith("$dir/") -or
            $normalized.Contains("/$dir/") -or
            $normalized.EndsWith("/$dir")
        ) {
            return $true
        }
    }

    return $false
}

function Get-CodeFenceLanguage {
    param([string]$Extension)

    $map = @{
        ".ps1"   = "powershell"
        ".psm1"  = "powershell"
        ".psd1"  = "powershell"
        ".js"    = "javascript"
        ".jsx"   = "jsx"
        ".ts"    = "typescript"
        ".tsx"   = "tsx"
        ".json"  = "json"
        ".jsonc" = "json"
        ".yaml"  = "yaml"
        ".yml"   = "yaml"
        ".toml"  = "toml"
        ".ini"   = "ini"
        ".py"    = "python"
        ".rb"    = "ruby"
        ".go"    = "go"
        ".rs"    = "rust"
        ".java"  = "java"
        ".kt"    = "kotlin"
        ".cs"    = "csharp"
        ".php"   = "php"
        ".sh"    = "bash"
        ".bash"  = "bash"
        ".zsh"   = "bash"
        ".sql"   = "sql"
        ".md"    = "markdown"
        ".txt"   = "text"
        ".xml"   = "xml"
        ".csv"   = "csv"
    }

    $normalized = $Extension.ToLowerInvariant()
    if ($map.ContainsKey($normalized)) {
        return $map[$normalized]
    }

    return "text"
}

$rootPath = [System.IO.Path]::GetFullPath($Root)
if (-not (Test-Path -LiteralPath $rootPath -PathType Container)) {
    throw "Root path does not exist or is not a directory: $rootPath"
}

if ([string]::IsNullOrWhiteSpace($Output)) {
    $timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
    $outputDir = Join-Path $rootPath "workspace/artifacts"
    $Output = Join-Path $outputDir "$timestamp-$Mode-context.md"
}

$outputPath = [System.IO.Path]::GetFullPath($Output)
$outputDirectory = Split-Path -Parent $outputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$files = Get-ChildItem -LiteralPath $rootPath -Recurse -File | Where-Object {
    $fullName = $_.FullName
    $relative = Get-RelativePathCompat -BasePath $rootPath -TargetPath $fullName

    if (Test-ExcludedDirectory -RelativePath $relative -DirectoryPatterns $ExcludeDirs) {
        return $false
    }

    foreach ($pattern in $ExcludeFiles) {
        if ($_.Name -like $pattern) {
            return $false
        }
    }

    $matchesInclude = $false
    foreach ($pattern in $Include) {
        if ($_.Name -like $pattern) {
            $matchesInclude = $true
            break
        }
    }

    if (-not $matchesInclude) {
        return $false
    }

    if ($Mode -eq "code-only") {
        $workspaceRelative = ($relative -replace "\\", "/")
        if (
            $workspaceRelative.StartsWith("workspace/") -or
            $workspaceRelative -eq "AGENTS.md" -or
            $workspaceRelative.StartsWith("workflows/")
        ) {
            return $false
        }
    }

    if (($relative -replace "\\", "/") -eq "workspace/artifacts/workspace-full-context.md") {
        return $false
    }

    return ($_.Length -le ($MaxFileSizeKB * 1KB))
} | Sort-Object FullName

$treeLines = @()
$treeLines += "."
foreach ($file in $files) {
    $relative = (Get-RelativePathCompat -BasePath $rootPath -TargetPath $file.FullName) -replace "\\", "/"
    $segments = $relative.Split("/")
    $indent = ""
    for ($i = 0; $i -lt ($segments.Length - 1); $i++) {
        $indent += "  "
        $treeLines += "$indent$($segments[$i])/"
    }
    $treeLines += "$indent  $($segments[-1])"
}

$builder = [System.Text.StringBuilder]::new()
[void]$builder.AppendLine("# Repository Context Export")
[void]$builder.AppendLine()
[void]$builder.AppendLine("- Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")")
[void]$builder.AppendLine(('- Root: `' + $rootPath + '`'))
[void]$builder.AppendLine(('- Mode: `' + $Mode + '`'))
[void]$builder.AppendLine("- File count: $($files.Count)")
[void]$builder.AppendLine("- Max file size: $MaxFileSizeKB KB")
[void]$builder.AppendLine()
[void]$builder.AppendLine("## Included Patterns")
[void]$builder.AppendLine()
foreach ($pattern in $Include) {
    [void]$builder.AppendLine(('- `' + $pattern + '`'))
}
[void]$builder.AppendLine()
[void]$builder.AppendLine("## Excluded Directories")
[void]$builder.AppendLine()
foreach ($pattern in $ExcludeDirs) {
    [void]$builder.AppendLine(('- `' + $pattern + '`'))
}
[void]$builder.AppendLine()
[void]$builder.AppendLine("## Tree")
[void]$builder.AppendLine()
[void]$builder.AppendLine('```text')
foreach ($line in $treeLines) {
    [void]$builder.AppendLine($line)
}
[void]$builder.AppendLine('```')
[void]$builder.AppendLine()
[void]$builder.AppendLine("## Files")
[void]$builder.AppendLine()

foreach ($file in $files) {
    $relative = (Get-RelativePathCompat -BasePath $rootPath -TargetPath $file.FullName) -replace "\\", "/"
    $extension = [System.IO.Path]::GetExtension($file.Name)
    $language = Get-CodeFenceLanguage -Extension $extension
    $content = Get-Content -LiteralPath $file.FullName -Raw

    [void]$builder.AppendLine("### $relative")
    [void]$builder.AppendLine()
    [void]$builder.AppendLine(('```' + $language))
    [void]$builder.AppendLine($content.TrimEnd())
    [void]$builder.AppendLine('```')
    [void]$builder.AppendLine()
}

[System.IO.File]::WriteAllText($outputPath, $builder.ToString(), [System.Text.UTF8Encoding]::new($false))
Write-Output $outputPath
