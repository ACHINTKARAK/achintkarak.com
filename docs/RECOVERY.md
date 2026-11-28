# Backup and rollback

Production: `main` in `ACHINTKARAK/achintkarak.com`. This repo publishes the GitHub Pages website at `https://achintkarak.com`.

## Before every significant release

From a clean production checkout:

```powershell
cd C:\Achint-Website\achintkarak.github.io
git status -sb
git fetch origin
$tag = "backup-before-album-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
git tag $tag origin/main
git push origin $tag
Write-Host $tag
```

Record the exact tag. It points to the **currently published commit** even if you have new unpublished local commits. Tags can be retrieved later with `git fetch --tags`.

## If a published release breaks

Prefer a **new rollback commit**, not a force push or history rewrite.

**1. Check your working copy.**

```powershell
cd C:\Achint-Website\achintkarak.github.io
git status -sb
```

Do not proceed if there are uncommitted changes: copy/save the work separately first. Select the clean `main` branch and synchronise:

```powershell
git switch main
git fetch --tags origin
git pull --ff-only origin main
```

**2. Choose the correct restore point.**

```powershell
git tag --list "backup-before-*"
git show --no-patch --oneline backup-before-album-YYYYMMDD-HHMMSS
```

Replace the example name with an actual tag. Verify the commit and date before restoring.

**3. Restore the tracked website state locally and review it.**

```powershell
$tag = "backup-before-album-YYYYMMDD-HHMMSS"
git restore --source $tag --staged --worktree -- .
git diff --cached --stat
git diff --cached --check
git status -sb
```

This changes tracked files to their state at the tag, including removal of files added later. It does **not** clean unknown/untracked local files, overwrite Git history or touch the live site yet. Carefully inspect the staged changes and look for unexpected removals. **Do not build over the restored files until you have reviewed the rollback**, since the current generator can regenerate newer pages.

**4. Publish the rollback as a normal commit.**

```powershell
git commit -m "Restore last known-good journal release"
git push origin main
git status -sb
```

Wait for GitHub Pages to deploy; verify the homepage, seven images, captions, navigation and both themes on the live site. Preserve the broken release's commit for investigation.

## Other situations

- Wrong caption or description: fix the source metadata, rebuild, validate and publish normally.
- Broken CSS or JS from the most recent commit: consider `git revert <commit-sha>` as a targeted rollback.
- Local project damaged but GitHub is healthy: restore/reclone from GitHub after saving any uncommitted work.
- Original RAWs or editing catalogs missing: restore from your **separate photo archive**; GitHub does not store them.

Never use `git push --force` to repair production. Old rollback tags are not a substitute for offsite backups of original work.
