# Achint Karak — Photo Journal

**Moments that didn't ask to be photographed.**

A long-term personal photo journal, published at **https://achintkarak.com**. Each album is a restrained, seven-photograph sequence. The site is intentionally simple: static HTML generated from Jinja templates, with minimal JavaScript and no application framework.

## Start here

- [Publishing a new album](docs/PUBLISHING.md) — a practical Windows/PowerShell checklist.
- [Project structure and conventions](docs/ARCHITECTURE.md) — what belongs where and which files are generated.
- [Recovery and rollback](docs/RECOVERY.md) — restore a previous release without rewriting Git history.
- [Image descriptions and captions](tools/IMAGE_DESCRIPTIONS.md) — accessible alt text versus visible journal notes.
- [Consent-based analytics](analytics/README.md) — implementation and privacy considerations.

## Local development (Windows)

```powershell
cd C:\Achint-Website\achintkarak.github.io
.\journal.ps1 setup       # once per machine
.\journal.ps1 check       # validate and regenerate pages
.\journal.ps1 preview     # opens a local server at http://localhost:8000
```

Use `Ctrl+C` to stop the preview. If PowerShell blocks the script, use `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` for that terminal session.

## Repository map

```text
journal/YYYY-MM/album-slug/   Published albums: seven numbered web-ready images,
                               description.txt, captions.json, optional alt.json
tools/build.py                Authoritative site generator
tools/templates/              Jinja templates (edit these, not generated pages)
tools/examples/               Blank metadata examples
journal.ps1                   Windows helper for new/build/preview/check
site.js, styles.css           Public interaction and presentation
analytics/                    Optional, consent-gated analytics
docs/                         Publishing, architecture and recovery guidance
index.html, about/, privacy/  Published pages (some generated, some maintained)
CNAME, robots.txt, sitemap.xml Domain and discovery files
```

**Why generated files are committed:** GitHub Pages serves the repository root. Until that deployment model is deliberately migrated, the output HTML, `journal/journal.json`, and `sitemap.xml` are part of the published site and must be committed after each build.

## Working principles

- Keep published album URLs stable; do not casually rename or move their folders.
- Publish **exactly seven** photographs per album; retain your RAWs and full-resolution originals outside this public repository.
- Keep image exports web-sized (normally around 2048px on the long edge), in sRGB.
- Make changes locally, run `.\journal.ps1 check`, review the generated files, then commit and push.
- Tag a known-good `main` release before meaningful deployments. No force pushes for rollbacks.
- The journal is a photographic record, not a marketing portfolio. Keep interfaces and dependencies restrained.

This repository contains the public website and web-ready photographs, **not** a backup of original camera files.
