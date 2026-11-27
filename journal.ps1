param(
    [Parameter(Position = 0)]
    [ValidateSet("help", "setup", "new", "captions", "build", "preview", "check", "status")]
    [string]$Action = "help",

    [string]$Month,
    [string]$Slug,
    [switch]$All
)

$ErrorActionPreference = "Stop"

$Repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $Repo ".venv\Scripts\python.exe"
$BuildScript = Join-Path $Repo "tools\build.py"
$Requirements = Join-Path $Repo "requirements.txt"

Set-Location $Repo

function Show-Help {
    Write-Host ""
    Write-Host "Photo Journal helper"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  .\journal.ps1 setup"
    Write-Host "  .\journal.ps1 new -Month YYYY-MM -Slug place-country"
    Write-Host "  .\journal.ps1 captions -Month YYYY-MM -Slug place-country"
    Write-Host "  .\journal.ps1 captions -All     (prepare existing albums safely)"
    Write-Host "  .\journal.ps1 build"
    Write-Host "  .\journal.ps1 preview"
    Write-Host "  .\journal.ps1 check"
    Write-Host "  .\journal.ps1 status"
    Write-Host ""
}

function Require-Python {
    if (-not (Test-Path -LiteralPath $Python)) {
        throw "Virtual environment not found. Run: .\journal.ps1 setup"
    }
}

function Run-Build {
    Require-Python

    if (-not (Test-Path -LiteralPath $BuildScript)) {
        throw "Build script is missing: tools\build.py"
    }

    & $Python $BuildScript

    if ($LASTEXITCODE -ne 0) {
        throw "Website build failed."
    }
}


function Write-CaptionsJson {
    param(
        [string]$CaptionPath,
        [System.Collections.IDictionary]$Captions
    )

    $json = ConvertTo-Json -InputObject $Captions -Depth 3
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText(
        $CaptionPath,
        $json + [Environment]::NewLine,
        $utf8NoBom
    )
}

function Initialize-AlbumCaptions {
    param([string]$AlbumFolder)

    $captionPath = Join-Path $AlbumFolder "captions.json"
    if (Test-Path -LiteralPath $captionPath) {
        return $false
    }

    $captions = [ordered]@{}
    foreach ($number in 1..7) {
        $captions[[string]$number] = ""
    }
    Write-CaptionsJson -CaptionPath $captionPath -Captions $captions
    return $true
}

function Edit-AlbumCaptions {
    param([string]$AlbumFolder)

    $null = Initialize-AlbumCaptions -AlbumFolder $AlbumFolder
    $captionPath = Join-Path $AlbumFolder "captions.json"
    $existing = Get-Content -LiteralPath $captionPath -Raw -Encoding UTF8 |
        ConvertFrom-Json -ErrorAction Stop

    $updated = [ordered]@{}

    Write-Host ""
    Write-Host "One-line author captions for photographs 1 to 7."
    Write-Host "Enter a caption, or press Enter to keep the current value."
    Write-Host "Type /clear to remove an existing caption. Maximum 180 characters."
    Write-Host ""

    foreach ($number in 1..7) {
        $key = [string]$number
        $oldCaption = ""
        $property = $existing.PSObject.Properties[$key]
        if ($null -ne $property -and $null -ne $property.Value) {
            $oldCaption = [string]$property.Value
        }

        if ($oldCaption) {
            Write-Host ("  {0}. Current: {1}" -f $number, $oldCaption)
        }

        while ($true) {
            $answer = Read-Host ("  Photo {0} caption" -f $number)

            if ([string]::IsNullOrWhiteSpace($answer)) {
                $caption = $oldCaption
            }
            elseif ($answer.Trim() -eq "/clear") {
                $caption = ""
            }
            else {
                $caption = [regex]::Replace($answer.Trim(), '\s+', ' ')
            }

            if ($caption.Length -le 180) {
                break
            }

            Write-Host "  Keep each caption within 180 characters."
        }

        $updated[$key] = $caption
    }

    Write-CaptionsJson -CaptionPath $captionPath -Captions $updated

    $filled = @($updated.Values | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count
    Write-Host ""
    Write-Host ("Saved {0}/7 captions to {1}" -f $filled, $captionPath)
    Write-Host "Blank entries stay invisible on the website."
}

function Require-AlbumPath {
    param([string]$Month, [string]$Slug)

    if ([string]::IsNullOrWhiteSpace($Month) -or
        $Month -notmatch '^\d{4}-(0[1-9]|1[0-2])
    "help" {
        Show-Help
    }

    "setup" {
        if (-not (Test-Path -LiteralPath $Python)) {
            $launcher = $null

            if (Get-Command py -ErrorAction SilentlyContinue) {
                $launcher = "py"
                & py -3 -m venv ".venv"
            }
            elseif (Get-Command python -ErrorAction SilentlyContinue) {
                $launcher = "python"
                & python -m venv ".venv"
            }
            else {
                throw "Python was not found. Install Python 3.10 or newer first."
            }

            if ($LASTEXITCODE -ne 0) {
                throw "Could not create the virtual environment with $launcher."
            }
        }

        Require-Python

        & $Python -m pip install --upgrade pip

        if ($LASTEXITCODE -ne 0) {
            throw "Could not upgrade pip."
        }

        if (-not (Test-Path -LiteralPath $Requirements)) {
            throw "requirements.txt is missing."
        }

        & $Python -m pip install -r $Requirements

        if ($LASTEXITCODE -ne 0) {
            throw "Could not install project dependencies."
        }

        Write-Host ""
        Write-Host "Setup complete."
    }

    "new" {
        if ([string]::IsNullOrWhiteSpace($Month)) {
            throw "Month is required. Example: -Month 2026-09"
        }

        if ([string]::IsNullOrWhiteSpace($Slug)) {
            throw "Slug is required. Example: -Slug galway-ireland"
        }

        if ($Month -notmatch '^\d{4}-(0[1-9]|1[0-2])$') {
            throw "Month must use YYYY-MM format."
        }

        if ($Slug -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
            throw "Slug must use lowercase letters, numbers and hyphens only."
        }

        $albumFolder = Join-Path $Repo ("journal\" + $Month + "\" + $Slug)

        if (Test-Path -LiteralPath $albumFolder) {
            throw "Album folder already exists: $albumFolder"
        }

        New-Item -ItemType Directory -Path $albumFolder -Force | Out-Null

        $descriptionPath = Join-Path $albumFolder "description.txt"
        Set-Content -LiteralPath $descriptionPath -Value "" -Encoding UTF8

        Write-Host ""
        Write-Host "Album folder created:"
        Write-Host $albumFolder
        Write-Host ""
        Write-Host "Next:"
        Write-Host "  1. Copy exactly seven images into the folder."
        Write-Host "  2. Name them 1.jpg through 7.jpg."
        Write-Host "  3. Add the album text to description.txt."
        Write-Host "  4. Write or review the seven photograph captions (optional)."
        Write-Host "  5. Run: .\journal.ps1 build"
        Write-Host ""

        $null = Initialize-AlbumCaptions -AlbumFolder $albumFolder
        Edit-AlbumCaptions -AlbumFolder $albumFolder

        Start-Process explorer.exe $albumFolder
    }

    "captions" {
        if ($All) {
            Initialize-AllExistingAlbumCaptions
        }
        else {
            $albumFolder = Require-AlbumPath -Month $Month -Slug $Slug
            Edit-AlbumCaptions -AlbumFolder $albumFolder
        }
    }

    "build" {
        Run-Build
    }

    "preview" {
        Run-Build

        Write-Host ""
        Write-Host "Local preview:"
        Write-Host "http://localhost:8000"
        Write-Host ""
        Write-Host "Press Ctrl+C to stop the server."
        Write-Host ""

        & $Python -m http.server 8000
    }

    "check" {
        Require-Python

        & $Python -m py_compile $BuildScript

        if ($LASTEXITCODE -ne 0) {
            throw "Python syntax check failed."
        }

        Run-Build

        $required = @(
            "index.html",
            "about\index.html",
            "journal\journal.json",
            "sitemap.xml",
            "styles.css",
            "site.js",
            "requirements.txt"
        )

        foreach ($relativePath in $required) {
            $fullPath = Join-Path $Repo $relativePath

            if (-not (Test-Path -LiteralPath $fullPath)) {
                throw "Required generated or project file is missing: $relativePath"
            }
        }

        Write-Host ""
        Write-Host "Git whitespace check:"
        git diff --check

        if ($LASTEXITCODE -ne 0) {
            throw "Git found a whitespace error."
        }

        Write-Host ""
        Write-Host "Current Git status:"
        git status --short

        Write-Host ""
        Write-Host "Checks passed."
    }

    "status" {
        git status --short
    }
}
) {
        throw "Month is required in YYYY-MM format."
    }

    if ([string]::IsNullOrWhiteSpace($Slug) -or
        $Slug -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*
    "help" {
        Show-Help
    }

    "setup" {
        if (-not (Test-Path -LiteralPath $Python)) {
            $launcher = $null

            if (Get-Command py -ErrorAction SilentlyContinue) {
                $launcher = "py"
                & py -3 -m venv ".venv"
            }
            elseif (Get-Command python -ErrorAction SilentlyContinue) {
                $launcher = "python"
                & python -m venv ".venv"
            }
            else {
                throw "Python was not found. Install Python 3.10 or newer first."
            }

            if ($LASTEXITCODE -ne 0) {
                throw "Could not create the virtual environment with $launcher."
            }
        }

        Require-Python

        & $Python -m pip install --upgrade pip

        if ($LASTEXITCODE -ne 0) {
            throw "Could not upgrade pip."
        }

        if (-not (Test-Path -LiteralPath $Requirements)) {
            throw "requirements.txt is missing."
        }

        & $Python -m pip install -r $Requirements

        if ($LASTEXITCODE -ne 0) {
            throw "Could not install project dependencies."
        }

        Write-Host ""
        Write-Host "Setup complete."
    }

    "new" {
        if ([string]::IsNullOrWhiteSpace($Month)) {
            throw "Month is required. Example: -Month 2026-09"
        }

        if ([string]::IsNullOrWhiteSpace($Slug)) {
            throw "Slug is required. Example: -Slug galway-ireland"
        }

        if ($Month -notmatch '^\d{4}-(0[1-9]|1[0-2])$') {
            throw "Month must use YYYY-MM format."
        }

        if ($Slug -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
            throw "Slug must use lowercase letters, numbers and hyphens only."
        }

        $albumFolder = Join-Path $Repo ("journal\" + $Month + "\" + $Slug)

        if (Test-Path -LiteralPath $albumFolder) {
            throw "Album folder already exists: $albumFolder"
        }

        New-Item -ItemType Directory -Path $albumFolder -Force | Out-Null

        $descriptionPath = Join-Path $albumFolder "description.txt"
        Set-Content -LiteralPath $descriptionPath -Value "" -Encoding UTF8

        Write-Host ""
        Write-Host "Album folder created:"
        Write-Host $albumFolder
        Write-Host ""
        Write-Host "Next:"
        Write-Host "  1. Copy exactly seven images into the folder."
        Write-Host "  2. Name them 1.jpg through 7.jpg."
        Write-Host "  3. Add the album text to description.txt."
        Write-Host "  4. Run: .\journal.ps1 build"
        Write-Host ""

        Start-Process explorer.exe $albumFolder
    }

    "build" {
        Run-Build
    }

    "preview" {
        Run-Build

        Write-Host ""
        Write-Host "Local preview:"
        Write-Host "http://localhost:8000"
        Write-Host ""
        Write-Host "Press Ctrl+C to stop the server."
        Write-Host ""

        & $Python -m http.server 8000
    }

    "check" {
        Require-Python

        & $Python -m py_compile $BuildScript

        if ($LASTEXITCODE -ne 0) {
            throw "Python syntax check failed."
        }

        Run-Build

        $required = @(
            "index.html",
            "about\index.html",
            "journal\journal.json",
            "sitemap.xml",
            "styles.css",
            "site.js",
            "requirements.txt"
        )

        foreach ($relativePath in $required) {
            $fullPath = Join-Path $Repo $relativePath

            if (-not (Test-Path -LiteralPath $fullPath)) {
                throw "Required generated or project file is missing: $relativePath"
            }
        }

        Write-Host ""
        Write-Host "Git whitespace check:"
        git diff --check

        if ($LASTEXITCODE -ne 0) {
            throw "Git found a whitespace error."
        }

        Write-Host ""
        Write-Host "Current Git status:"
        git status --short

        Write-Host ""
        Write-Host "Checks passed."
    }

    "status" {
        git status --short
    }
}
) {
        throw "Slug is required in lowercase-words-with-hyphens format."
    }

    $albumFolder = Join-Path $Repo ("journal\" + $Month + "\" + $Slug)
    if (-not (Test-Path -LiteralPath $albumFolder -PathType Container)) {
        throw "Album folder not found: $albumFolder"
    }

    return $albumFolder
}

function Initialize-AllExistingAlbumCaptions {
    $manifestPath = Join-Path $Repo "journal\journal.json"
    if (-not (Test-Path -LiteralPath $manifestPath)) {
        throw "Missing journal/journal.json. Run .\journal.ps1 build first."
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 |
        ConvertFrom-Json -ErrorAction Stop

    $created = 0
    $retained = 0

    foreach ($month in $manifest.months) {
        foreach ($album in $month.albums) {
            $albumFolder = Join-Path $Repo (
                "journal\" + $month.id + "\" + $album.slug
            )

            if (-not (Test-Path -LiteralPath $albumFolder -PathType Container)) {
                continue
            }

            if (Initialize-AlbumCaptions -AlbumFolder $albumFolder) {
                Write-Host ("  Created: {0}/{1}/captions.json" -f $month.id, $album.slug)
                $created++
            }
            else {
                $retained++
            }
        }
    }

    Write-Host ""
    Write-Host ("Caption templates created: {0}. Existing files preserved: {1}." -f $created, $retained)
    Write-Host "Nothing was published. Use .\journal.ps1 captions -Month YYYY-MM -Slug album-slug to fill them in."
}

switch ($Action) {
    "help" {
        Show-Help
    }

    "setup" {
        if (-not (Test-Path -LiteralPath $Python)) {
            $launcher = $null

            if (Get-Command py -ErrorAction SilentlyContinue) {
                $launcher = "py"
                & py -3 -m venv ".venv"
            }
            elseif (Get-Command python -ErrorAction SilentlyContinue) {
                $launcher = "python"
                & python -m venv ".venv"
            }
            else {
                throw "Python was not found. Install Python 3.10 or newer first."
            }

            if ($LASTEXITCODE -ne 0) {
                throw "Could not create the virtual environment with $launcher."
            }
        }

        Require-Python

        & $Python -m pip install --upgrade pip

        if ($LASTEXITCODE -ne 0) {
            throw "Could not upgrade pip."
        }

        if (-not (Test-Path -LiteralPath $Requirements)) {
            throw "requirements.txt is missing."
        }

        & $Python -m pip install -r $Requirements

        if ($LASTEXITCODE -ne 0) {
            throw "Could not install project dependencies."
        }

        Write-Host ""
        Write-Host "Setup complete."
    }

    "new" {
        if ([string]::IsNullOrWhiteSpace($Month)) {
            throw "Month is required. Example: -Month 2026-09"
        }

        if ([string]::IsNullOrWhiteSpace($Slug)) {
            throw "Slug is required. Example: -Slug galway-ireland"
        }

        if ($Month -notmatch '^\d{4}-(0[1-9]|1[0-2])$') {
            throw "Month must use YYYY-MM format."
        }

        if ($Slug -notmatch '^[a-z0-9]+(?:-[a-z0-9]+)*$') {
            throw "Slug must use lowercase letters, numbers and hyphens only."
        }

        $albumFolder = Join-Path $Repo ("journal\" + $Month + "\" + $Slug)

        if (Test-Path -LiteralPath $albumFolder) {
            throw "Album folder already exists: $albumFolder"
        }

        New-Item -ItemType Directory -Path $albumFolder -Force | Out-Null

        $descriptionPath = Join-Path $albumFolder "description.txt"
        Set-Content -LiteralPath $descriptionPath -Value "" -Encoding UTF8

        Write-Host ""
        Write-Host "Album folder created:"
        Write-Host $albumFolder
        Write-Host ""
        Write-Host "Next:"
        Write-Host "  1. Copy exactly seven images into the folder."
        Write-Host "  2. Name them 1.jpg through 7.jpg."
        Write-Host "  3. Add the album text to description.txt."
        Write-Host "  4. Run: .\journal.ps1 build"
        Write-Host ""

        Start-Process explorer.exe $albumFolder
    }

    "build" {
        Run-Build
    }

    "preview" {
        Run-Build

        Write-Host ""
        Write-Host "Local preview:"
        Write-Host "http://localhost:8000"
        Write-Host ""
        Write-Host "Press Ctrl+C to stop the server."
        Write-Host ""

        & $Python -m http.server 8000
    }

    "check" {
        Require-Python

        & $Python -m py_compile $BuildScript

        if ($LASTEXITCODE -ne 0) {
            throw "Python syntax check failed."
        }

        Run-Build

        $required = @(
            "index.html",
            "about\index.html",
            "journal\journal.json",
            "sitemap.xml",
            "styles.css",
            "site.js",
            "requirements.txt"
        )

        foreach ($relativePath in $required) {
            $fullPath = Join-Path $Repo $relativePath

            if (-not (Test-Path -LiteralPath $fullPath)) {
                throw "Required generated or project file is missing: $relativePath"
            }
        }

        Write-Host ""
        Write-Host "Git whitespace check:"
        git diff --check

        if ($LASTEXITCODE -ne 0) {
            throw "Git found a whitespace error."
        }

        Write-Host ""
        Write-Host "Current Git status:"
        git status --short

        Write-Host ""
        Write-Host "Checks passed."
    }

    "status" {
        git status --short
    }
}
