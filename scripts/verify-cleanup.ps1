param(
    [string]$Repo = "C:\Achint-Website\achintkarak.github.io"
)

$ErrorActionPreference = "Stop"

$Repo = (Resolve-Path $Repo).Path
$Report = "C:\Achint-Website\cleanup-verification.txt"

$candidates = @(
    @{ Path = "styles.css.20260805"; Counterpart = "styles.css" },
    @{ Path = "tools\build.py.backup"; Counterpart = "tools\build.py" },
    @{ Path = "tools\build.py.before-pycountry-20260805-131608"; Counterpart = "tools\build.py" },
    @{ Path = "tools\build.backup.py"; Counterpart = "tools\build.py" },
    @{ Path = "tools\templates\home.html.backup"; Counterpart = "tools\templates\home.html" },
    @{ Path = "tools\templates\album copy.html"; Counterpart = "tools\templates\album.html" },
    @{ Path = "journal-debug.zip"; Counterpart = $null },
    @{ Path = "journal-debug"; Counterpart = $null },
    @{ Path = "website-files.old.legacy"; Counterpart = $null },
    @{ Path = "cleanup-audit.txt"; Counterpart = $null }
)

$textExtensions = @(
    ".py", ".html", ".css", ".js", ".json", ".txt", ".md",
    ".yml", ".yaml", ".toml", ".ps1", ".xml"
)

function Get-RelativePath([string]$FullPath) {
    return $FullPath.Substring($Repo.Length + 1)
}

function Get-TrackedStatus([string]$RelativePath) {
    $normalized = $RelativePath.Replace("\", "/")
    $tracked = @(git -C $Repo ls-files -- "$normalized")

    if ($tracked.Count -gt 0) {
        return "YES"
    }

    return "NO"
}

function Get-References([string]$CandidateRelativePath) {
    $candidateFull = Join-Path $Repo $CandidateRelativePath
    $candidateName = Split-Path $CandidateRelativePath -Leaf
    $searchTerms = @($CandidateRelativePath, $CandidateRelativePath.Replace("\", "/"), $candidateName) |
        Select-Object -Unique

    $references = New-Object System.Collections.Generic.List[string]

    Get-ChildItem -Path $Repo -Recurse -Force -File |
        Where-Object {
            $_.FullName -notmatch '\\(\.git|\.venv)(\\|$)' -and
            $_.FullName -ne $candidateFull -and
            $_.FullName -ne $Report -and
            $_.Name -notin @("cleanup-audit.txt", "cleanup-verification.txt") -and
            $textExtensions -contains $_.Extension.ToLowerInvariant()
        } |
        ForEach-Object {
            $file = $_

            foreach ($term in $searchTerms) {
                $matches = @(Select-String -Path $file.FullName -SimpleMatch -Pattern $term -ErrorAction SilentlyContinue)

                foreach ($match in $matches) {
                    $relativeSource = Get-RelativePath $file.FullName
                    $references.Add("$relativeSource`:$($match.LineNumber): $($match.Line.Trim())")
                }
            }
        }

    return @($references | Select-Object -Unique)
}

function Get-DirectorySummary([string]$Path) {
    $files = @(Get-ChildItem -Path $Path -Recurse -Force -File)
    $totalBytes = ($files | Measure-Object -Property Length -Sum).Sum

    if ($null -eq $totalBytes) {
        $totalBytes = 0
    }

    return @{
        FileCount = $files.Count
        TotalBytes = [int64]$totalBytes
    }
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("PHOTO JOURNAL CLEANUP VERIFICATION")
$lines.Add("Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$lines.Add("Repository: $Repo")
$lines.Add("")

foreach ($candidate in $candidates) {
    $relativePath = $candidate.Path
    $fullPath = Join-Path $Repo $relativePath

    $lines.Add("============================================================")
    $lines.Add("CANDIDATE: $relativePath")

    if (-not (Test-Path -LiteralPath $fullPath)) {
        $lines.Add("Exists: NO")
        $lines.Add("")
        continue
    }

    $item = Get-Item -LiteralPath $fullPath -Force
    $lines.Add("Exists: YES")
    if ($item.PSIsContainer) {
        $itemType = "Directory"
    }
    else {
        $itemType = "File"
    }

    $lines.Add("Type: $itemType")
    $lines.Add("Tracked by Git: $(Get-TrackedStatus $relativePath)")
    $lines.Add("Last modified: $($item.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))")

    if ($item.PSIsContainer) {
        $summary = Get-DirectorySummary $fullPath
        $lines.Add("Files inside: $($summary.FileCount)")
        $lines.Add("Total size: $($summary.TotalBytes) bytes")
    }
    else {
        $lines.Add("Size: $($item.Length) bytes")
        $lines.Add("SHA256: $((Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash)")
    }

    $counterpart = $candidate.Counterpart

    if ($counterpart) {
        $counterpartFull = Join-Path $Repo $counterpart
        $lines.Add("Current counterpart: $counterpart")

        if (Test-Path -LiteralPath $counterpartFull -PathType Leaf) {
            $candidateHash = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash
            $counterpartHash = (Get-FileHash -LiteralPath $counterpartFull -Algorithm SHA256).Hash
            $same = $candidateHash -eq $counterpartHash
            $lines.Add("Identical to current counterpart: $same")
            $lines.Add("Current counterpart SHA256: $counterpartHash")
        }
        else {
            $lines.Add("Current counterpart exists: NO")
        }
    }

    $references = @(Get-References $relativePath)
    $lines.Add("References from other active text/code files: $($references.Count)")

    foreach ($reference in $references) {
        $lines.Add("  $reference")
    }

    $lines.Add("")
}

$lines.Add("============================================================")
$lines.Add("RECENT EXTERNAL FULL BACKUPS")
$externalBackups = @(
    Get-ChildItem -Path "C:\Achint-Website" -Force |
        Where-Object {
            $_.FullName -ne $Repo -and
            $_.Name -match '(?i)(achintkarak.*backup|master-backup)'
        } |
        Sort-Object LastWriteTime -Descending
)

foreach ($backup in $externalBackups) {
    $lines.Add("$($backup.FullName) | $($backup.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))")
}

$lines | Set-Content -Path $Report -Encoding UTF8
Get-Content $Report

Write-Host ""
Write-Host "Verification report saved to:"
Write-Host $Report

