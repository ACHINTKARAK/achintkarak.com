# Architecture and long-term conventions

## Design goals

This is a **static publication**, not a web application. Preserve readable content, stable URLs, fast photographs, accessible navigation, and as few moving parts as possible.

## Source and generated files

| Area | Role | Edit directly? |
| --- | --- | --- |
| `journal/YYYY-MM/album-slug/` | Seven web-ready numbered images and album metadata | **Yes** (except generated `index.html`) |
| `journal/journal.json` | Generated album manifest for navigation and homepage discovery | **No** |
| `tools/build.py` | Canonical Python/Jinja generator | **Yes, with tests** |
| `tools/templates/` | Canonical HTML templates | **Yes** |
| `tools/examples/` | Blank metadata examples | **Yes** |
| `journal.ps1` | PowerShell commands for album creation, preview and checks | **Yes** |
| `styles.css`, `site.js` | Public presentation, theme, discovery and optional gallery behaviour | **Yes** |
| `analytics/ga4-consent.js` | Consent-gated analytics | **Yes, carefully** |
| `index.html`, `about/index.html`, `journal/**/index.html`, `sitemap.xml` | Generated published pages | **No**; regenerate |
| `privacy/index.html` | Maintained privacy page | **Yes** |
| `CNAME`, `robots.txt`, domain verification file | Domain and search verification | **Do not move casually** |

The GitHub Pages site currently depends on files in the **repository root**. Do not move generated HTML into `dist/` or `docs/` without first changing and testing the Pages configuration. Do not relocate `CNAME` or the domain-verification HTML.

## Content invariants

- Exactly **seven** numbered images per published album.
- Folder names and image numbering determine public URLs; already published URLs are permanent.
- Distinguish author captions (`captions.json`, visible and optional) from factual alt text (`alt.json`, invisible and optional).
- The site generator is the **single authority** for pages and album order. Do not maintain a second competing generator.
- Images are public, web-sized exports. No RAWs, originals, source editing catalogs or sensitive files in Git.
- Keep design minimal, book-like and single-column, with a working scrolling experience even when JavaScript fails.
- Mobile and desktop must both support navigation and keyboard access. The gallery is an enhancement, not the only way to read the journal.
- Analytics must remain optional and consent-first. Do not introduce tracking in general-purpose page scripts without explicit review.

## Naming and code hygiene

- New album directories: `journal/YYYY-MM/location-country/` (lowercase, hyphenated).
- New photographs: `1.jpg` through `7.jpg`, consistently cased within that album.
- New development work: focused branches and small changes; preserve a reviewable history.
- Avoid dated copies of Python, CSS and templates **inside** the repository. Git history and rollback tags already keep previous versions.
- Avoid adding frameworks, build tools, CDNs, or client libraries for small features achievable with Python, CSS and vanilla JavaScript.
- Keep documentation current whenever a workflow or directory convention changes.

## Growth and preservation

The repository is a public **website**, not the master archive. Over years, repeated image revisions inflate Git history even after files are removed from the current tree. Export thoughtfully **before** committing; do not repeatedly recommit oversized images.

Maintain separate, verified backups of RAW files, editing catalogs, and full-size exports. GitHub rollback tags preserve Git-tracked site content, not uncommitted work, ignored files or external backups.

## Maintenance priorities

1. Keep the published site healthy and independently restorable.
2. Keep the single generator and its templates reliable.
3. Validate each new seven-photo album before deployment.
4. Remove obsolete experiments only after verifying they are unused; old versions remain in Git history.
5. Periodically review dependencies, public accessibility, site performance and security.
