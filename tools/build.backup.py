#!/usr/bin/env python3
"""
Achint Photo Journal — Fully automated static generator.

You do ONE manual thing:
- Create album folders + drop images:
  journal/YYYY-MM/album-slug/1.jpg ... N.jpg   (or .JPG/.jpeg/.png/.webp)

Then run:
  .\.venv\Scripts\python.exe .\tools\build.py

This script scans folders and auto-generates/overwrites:
- /index.html
- /journal/journal.json
- /journal/YYYY-MM/index.html (month pages)
- /journal/YYYY-MM/album-slug/index.html (album pages)
- /sitemap.xml

Optional metadata:
- /journal/titles.json
  Maps album slug -> display title
  Example:
  {
    "cape-town-south-africa": "Cape Town, South Africa",
    "bodrum-turkiye": "Bodrum, Türkiye"
  }

It NEVER modifies image files.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple

from jinja2 import Environment, FileSystemLoader, select_autoescape


RE_MONTH = re.compile(r"^\d{4}-\d{2}$")
RE_IMAGE = re.compile(r"^(\d+)\.(jpg|jpeg|png|webp)$", re.IGNORECASE)


# -----------------------------
# Data models
# -----------------------------
@dataclass(frozen=True)
class Album:
    month_id: str           # "2026-01"
    slug: str               # "tenerife-spain"
    title: str              # "Tenerife, Spain" (from titles.json or auto from slug)
    description: str        # optional album description from description.txt
    image_ext: str          # "jpg" / "JPG" (preserve on disk)
    image_count: int        # 7
    rel_dir: Path           # journal/YYYY-MM/slug (relative to repo root)


    @property
    def url(self) -> str:
        return f"/journal/{self.month_id}/{self.slug}/"


@dataclass(frozen=True)
class Month:
    id: str                 # "2026-01"
    title: str              # "January 2026"
    rel_dir: Path           # journal/YYYY-MM (relative to repo root)
    albums: Tuple[Album, ...]


# -----------------------------
# Helpers
# -----------------------------
def month_title(month_id: str) -> str:
    dt = datetime.strptime(month_id, "%Y-%m")
    return dt.strftime("%B %Y")


def slug_to_title(slug: str) -> str:
    """
    Fallback title generator when no override exists in journal/titles.json.
    Example:
      dingle-ireland -> Dingle Ireland
    """
    words = slug.replace("_", "-").split("-")
    small = {"and", "or", "the", "of", "in", "on", "at", "to", "a"}
    out: List[str] = []

    for w in words:
        if not w:
            continue
        lw = w.lower()
        if lw in small:
            out.append(lw)
        else:
            out.append(lw[:1].upper() + lw[1:])

    if out:
        out[0] = out[0][:1].upper() + out[0][1:]

    return " ".join(out)


def load_title_overrides(root: Path) -> Dict[str, str]:
    """
    Loads optional title overrides from /journal/titles.json.
    Returns a mapping: slug -> display title
    """
    titles_path = root / "journal" / "titles.json"

    if not titles_path.exists():
        return {}

    data = json.loads(titles_path.read_text(encoding="utf-8"))

    if not isinstance(data, dict):
        raise ValueError("journal/titles.json must contain a JSON object of slug -> title")

    cleaned: Dict[str, str] = {}
    for slug, title in data.items():
        if not isinstance(slug, str) or not isinstance(title, str):
            raise ValueError("journal/titles.json must map string slug keys to string titles")
        cleaned[slug.strip()] = title.strip()

    return cleaned

def load_album_description(album_dir: Path) -> str:
    """
    Loads optional album description from description.txt inside the album folder.
    """
    desc_path = album_dir / "description.txt"
    if not desc_path.exists():
        return ""
    return desc_path.read_text(encoding="utf-8").strip()

def detect_images(album_dir: Path) -> Tuple[int, str]:
    """
    Detects contiguous image sequence 1..N and the extension (preserving case).
    Enforces:
    - At least one image
    - No gaps in numbering
    - Same extension for all numbered images
    """
    images: Dict[int, str] = {}

    for p in album_dir.iterdir():
        if not p.is_file():
            continue
        m = RE_IMAGE.match(p.name)
        if not m:
            continue
        idx = int(m.group(1))
        images[idx] = p.suffix.lstrip(".")  # preserve actual case from filesystem

    if not images:
        raise ValueError(f"No numbered images found in: {album_dir}")

    max_idx = max(images.keys())
    missing = [i for i in range(1, max_idx + 1) if i not in images]
    if missing:
        raise ValueError(f"Missing images {missing} in {album_dir} (need contiguous 1..{max_idx})")

    ext = images[1]
    mismatched = [i for i, e in images.items() if e.lower() != ext.lower()]
    if mismatched:
        raise ValueError(
            f"Mixed extensions in {album_dir}. Keep all numbered images the same extension. "
            f"Mismatches at: {mismatched}"
        )

    return max_idx, ext


def sort_album_slugs(slugs: List[str]) -> List[str]:
    """
    Fully automated ordering:
    - If you ever want story control later, name folders like:
        01-tenerife-spain, 02-la-laguna
      Then we sort by that numeric prefix.
    - Otherwise alphabetical.
    """
    def key(s: str):
        m = re.match(r"^(\d{2})-(.+)$", s)
        if m:
            return (0, int(m.group(1)), m.group(2))
        return (1, 999, s)

    return sorted(slugs, key=key)


# -----------------------------
# Scanning
# -----------------------------
def scan_repo(root: Path) -> Tuple[Tuple[Month, ...], Tuple[Album, ...]]:
    journal_dir = root / "journal"
    if not journal_dir.exists():
        raise FileNotFoundError(f"Missing folder: {journal_dir}")

    title_overrides = load_title_overrides(root)

    month_dirs = [p for p in journal_dir.iterdir() if p.is_dir() and RE_MONTH.match(p.name)]
    month_dirs.sort(key=lambda p: p.name, reverse=True)  # newest -> oldest

    months: List[Month] = []
    all_albums: List[Album] = []

    for mdir in month_dirs:
        mid = mdir.name

        slugs = [p.name for p in mdir.iterdir() if p.is_dir() and not p.name.startswith(".")]
        slugs = sort_album_slugs(slugs)

        albums: List[Album] = []
        for slug in slugs:
            adir = mdir / slug
            if not adir.is_dir():
                continue

            count, ext = detect_images(adir)
            
            title = title_overrides.get(slug, slug_to_title(slug))
            description = load_album_description(adir)

            alb = Album(
                month_id=mid,
                slug=slug,
                title=title,
                description=description,
                image_ext=ext,
                image_count=count,
                rel_dir=adir.relative_to(root),
            )
            albums.append(alb)
            all_albums.append(alb)

        months.append(Month(
            id=mid,
            title=month_title(mid),
            rel_dir=mdir.relative_to(root),
            albums=tuple(albums),
        ))

    return tuple(months), tuple(all_albums)


# -----------------------------
# Rendering
# -----------------------------
def make_env(root: Path) -> Environment:
    tmpl_dir = root / "tools" / "templates"
    if not tmpl_dir.exists():
        raise FileNotFoundError(f"Missing templates folder: {tmpl_dir}")

    return Environment(
        loader=FileSystemLoader(str(tmpl_dir)),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def build_manifest(months: Tuple[Month, ...]) -> Dict[str, Any]:
    return {
        "months": [
            {
                "id": m.id,
                "title": m.title,
                "albums": [
                    {
                        "slug": a.slug,
                        "title": a.title,
                        "count": a.image_count,
                        "ext": a.image_ext,
                    }
                    for a in m.albums
                ],
            }
            for m in months
        ]
    }


def render_all(root: Path) -> None:
    months, albums = scan_repo(root)
    env = make_env(root)

    # journal/journal.json
    manifest = build_manifest(months)
    write_text(root / "journal" / "journal.json", json.dumps(manifest, indent=2, ensure_ascii=False))

    # index.html (home)
    home_t = env.get_template("home.html")
    latest_albums = list(albums[:3])  # newest-first

    write_text(
        root / "index.html",
        home_t.render(
            months=months,
            latest_albums=latest_albums,
        ),
    )

    # month pages
    month_t = env.get_template("month.html")
    for m in months:
        write_text(root / m.rel_dir / "index.html", month_t.render(month=m))

    # album pages + prev/next across whole journal
    album_t = env.get_template("album.html")
    idx_map: Dict[Tuple[str, str], int] = {(a.month_id, a.slug): i for i, a in enumerate(albums)}

    for a in albums:
        i = idx_map[(a.month_id, a.slug)]
        prev_album = albums[i + 1] if i + 1 < len(albums) else None  # older
        next_album = albums[i - 1] if i - 1 >= 0 else None          # newer

        write_text(
            root / a.rel_dir / "index.html",
            album_t.render(
                album=a,
                month_title=month_title(a.month_id),
                prev_album=prev_album,
                next_album=next_album,
            ),
        )

    # sitemap.xml
    sitemap_t = env.get_template("sitemap.xml")
    write_text(root / "sitemap.xml", sitemap_t.render(months=months, albums=albums))

    print("✅ Build complete")
    print(f"- Months: {len(months)}")
    print(f"- Albums: {len(albums)}")
    print(f"- Wrote: index.html, journal/journal.json, month pages, album pages, sitemap.xml")


def main() -> None:
    root = Path(__file__).resolve().parents[1]  # repo root
    render_all(root)


if __name__ == "__main__":
    main()