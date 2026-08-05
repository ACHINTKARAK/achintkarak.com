param(
    [Parameter(Position = 0)]
    [ValidateSet("help", "setup", "new", "build", "preview", "check", "status")]
    [string]$Action = "help",

    [string]$Month,
    [string]$Slug
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
