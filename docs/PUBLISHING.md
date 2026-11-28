# Publish a new album

This is the canonical procedure for the Windows working copy at `C:\Achint-Website\achintkarak.github.io`.

## 1. Start clean

```powershell
cd C:\Achint-Website\achintkarak.github.io
git status -sb
git switch main
git pull --ff-only origin main
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

**Stop if there are uncommitted changes.** Finish or save that work before switching branches or pulling. You should see `main` tracking `origin/main`.

If this is a fresh machine, run `.\journal.ps1 setup` once.

## 2. Create and fill the album

```powershell
.\journal.ps1 new -Month 2027-01 -Slug example-location
```

Replace the example month and slug with the actual location. This creates a folder, a description file and a seven-entry `captions.json`, and asks about captions. Leaving a caption blank is allowed.

```text
journal/YYYY-MM/album-slug/
├── 1.jpg ... 7.jpg          exactly seven photographs, in final narrative order
├── description.txt          short introductory album text
├── captions.json            seven optional, visible notes keyed "1" to "7"
├── alt.json                 optional factual, invisible image descriptions
├── home-image.txt           optional newest-album homepage fallback
└── share-image.txt          optional different sharing image
```

Existing albums may contain uppercase `.JPG`; the build preserves the extension on disk. Do not rename published image files without an explicit migration.

**Photos:** export to sRGB, roughly 2048px long edge; keep the RAW originals privately. Never place RAW files or full-resolution originals in the public repository.

**Captions:** one truthful, personal observation per photograph; maximum 180 characters. Blank captions produce no text. To edit later:

```powershell
.\journal.ps1 captions -Month 2027-01 -Slug example-location
```

**Alt text:** optional descriptions of what is *visibly* in the image (not editorial interpretation), maximum 300 characters; see [image-description guidance](../tools/IMAGE_DESCRIPTIONS.md).

When you first build the newest album interactively, the generator may ask which image to use as the homepage fallback and whether to use that image as the social sharing image.

## 3. Preview and review

```powershell
.\journal.ps1 preview
```

Open `http://localhost:8000`. Verify seven pictures and their order, all captions, the description, navigation, homepage discovery, archive placement, and both themes. Open the full-screen viewer and check swipe/keyboard navigation and neighbouring albums if enabled.

Test a narrow mobile viewport (320px and 390px) and desktop; check that controls do not overlap and photographs are never distorted. For the gallery, preserve the ability to close it and continue reading the scrolling album.

Press `Ctrl+C` to stop the preview.

## 4. Validate before committing

```powershell
.\journal.ps1 check
git diff --check
git status -sb
git diff --stat
```

`check` **regenerates** the HTML pages. Review all changes, including generated `index.html`, month/album pages, `journal/journal.json`, and `sitemap.xml`. Updated CSS/JS hash references in HTML are expected after stylesheet or script changes.

Do not hand-edit a generated `index.html` to fix a persistent problem: edit its template or source metadata and rebuild.

## 5. Preserve the last published release

Before pushing new content to `main`, record the current remote production version:

```powershell
git fetch origin
$tag = "backup-before-album-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
git tag $tag origin/main
git push origin $tag
Write-Host "Record this rollback tag: $tag"
```

Record the exact tag in OneNote. These tags protect committed website files; original RAWs need their own offline backups.

## 6. Commit, publish and verify

In GitHub Desktop, verify the correct repository and branch `main`, review the changed files, commit and **Push origin**. Alternatively:

```powershell
git add -A
git diff --cached --check
git diff --cached --stat
git commit -m "Publish January 2027 photo journal"
git push origin main
git status -sb
```

Replace the sample message with the actual album and date. **Do not force-push.**

After GitHub Pages finishes deploying, check `https://achintkarak.com` on desktop and mobile, including the first and last image, captions, navigation, and the homepage. If something fails, use [Recovery and rollback](RECOVERY.md).

## Changes beyond a normal album

For navigation, styles, JavaScript, the generator or the deployment system, prefer a short-lived feature branch and a pull request. Never overwrite the live `main` branch to resolve a build error.
