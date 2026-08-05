#!/usr/bin/env python3
r"""
Achint Photo Journal — master static-site generator.

Normal publishing workflow:
1. Create journal/YYYY-MM/album-slug/
2. Add numbered images: 1.jpg ... 7.jpg
3. Add description.txt
4. Run:
   .\.venv\Scripts\python.exe .\tools\build.py

Source files:
- album folders, numbered images and description.txt
- journal/titles.json
- tools/templates/*
- styles.css
- site.js

Generated files:
- index.html
- about/index.html
- journal/journal.json
- journal/YYYY-MM/index.html
- journal/YYYY-MM/album-slug/index.html
- sitemap.xml

Ordering:
- Months use their YYYY-MM names, newest first.
- New albums within a month use the album folder creation time, newest first.
- The generated journal.json stores that timestamp automatically so ordering
  remains stable after later builds or repository clones.
- No manual dates, order files or numbered folder prefixes are required.

This script never modifies image files.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Tuple

import pycountry
from jinja2 import Environment, FileSystemLoader, select_autoescape


RE_MONTH = re.compile(r"^\d{4}-\d{2}$")
RE_IMAGE = re.compile(r"^(\d+)\.(jpg|jpeg|png|webp)$", re.IGNORECASE)
RE_CANONICAL_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

EXPECTED_IMAGE_COUNT = 7
LATEST_ALBUM_COUNT = 3
ORDER_SCHEMA_VERSION = 1
SITE_URL = "https://achintkarak.com"


# -----------------------------
# Data models
# -----------------------------
@dataclass(frozen=True)
class Album:
    month_id: str
    slug: str
    title: str
    description: str
    image_ext: str
    image_count: int
    rel_dir: Path
    created_timestamp: float

    @property
    def url(self) -> str:
        return f"/journal/{self.month_id}/{self.slug}/"

    @property
    def created_at(self) -> str:
        return datetime.fromtimestamp(
            self.created_timestamp,
            tz=timezone.utc,
        ).isoformat(timespec="seconds")


@dataclass(frozen=True)
class Month:
    id: str
    title: str
    rel_dir: Path
    albums: Tuple[Album, ...]


@dataclass(frozen=True)
class ArchiveYear:
    year: str
    months: Tuple[Month, ...]


# -----------------------------
# General helpers
# -----------------------------
def month_title(month_id: str) -> str:
    try:
        parsed = datetime.strptime(month_id, "%Y-%m")
    except ValueError as exc:
        raise ValueError(
            f"Invalid month folder '{month_id}'. Use YYYY-MM with a real month."
        ) from exc

    return parsed.strftime("%B %Y")


# These are aliases or constituent countries that ISO data alone does not
# expose in the short folder-name form used by the journal.
COUNTRY_TITLE_ALIASES: Dict[str, str] = {
    "england": "England",
    "northern-ireland": "Northern Ireland",
    "scotland": "Scotland",
    "turkey": "Türkiye",
    "turkiye": "Türkiye",
    "uae": "UAE",
    "uk": "UK",
    "usa": "USA",
    "wales": "Wales",
}


def title_slug(value: str) -> str:
    """
    Convert a country name into the same lowercase-hyphen format used by
    album folder names.

    Example:
        South Africa -> south-africa
        Türkiye      -> turkiye
    """
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")


def build_country_title_lookup() -> Dict[str, str]:
    """
    Build the country suffix lookup from pycountry's ISO 3166 data.

    For each country, accept its standard, common and official names when
    available. Prefer the common name for display, otherwise the ISO name.
    """
    lookup: Dict[str, str] = {}

    for country in pycountry.countries:
        display_title = getattr(country, "common_name", country.name)

        source_names = {
            country.name,
            getattr(country, "common_name", ""),
            getattr(country, "official_name", ""),
        }

        for source_name in source_names:
            if source_name:
                lookup[title_slug(source_name)] = display_title

    lookup.update(COUNTRY_TITLE_ALIASES)
    return lookup


COUNTRY_SUFFIX_TITLES = build_country_title_lookup()
COUNTRY_SUFFIXES = tuple(
    sorted(
        COUNTRY_SUFFIX_TITLES,
        key=lambda value: (value.count("-"), len(value)),
        reverse=True,
    )
)


def humanize_slug(slug: str) -> str:
    """
    Convert a hyphenated slug into readable title text.
    """
    words = slug.replace("_", "-").split("-")
    small_words = {"and", "or", "the", "of", "in", "on", "at", "to", "a"}
    output: List[str] = []

    for word in words:
        if not word:
            continue

        lowered = word.lower()

        if lowered in small_words and output:
            output.append(lowered)
        else:
            output.append(lowered[:1].upper() + lowered[1:])

    return " ".join(output)


def slug_to_title(slug: str) -> str:
    """
    Generate an automatic title from an album folder slug.

    A recognised country suffix receives the geographic comma:

        dublin-zoo-ireland       -> Dublin Zoo, Ireland
        cape-town-south-africa   -> Cape Town, South Africa
        lake-como-italy          -> Lake Como, Italy
        bodrum-turkiye           -> Bodrum, Türkiye

    A country-only slug remains unchanged:

        malta -> Malta

    journal/titles.json still takes precedence for editorial exceptions,
    such as:
        kilkee-lahinch-ireland -> Kilkee and Lahinch, Ireland
    """
    normalized = slug.strip().lower().replace("_", "-")

    for country_slug in COUNTRY_SUFFIXES:
        country_title = COUNTRY_SUFFIX_TITLES[country_slug]

        if normalized == country_slug:
            return country_title

        suffix = "-" + country_slug

        if normalized.endswith(suffix):
            place_slug = normalized[: -len(suffix)]

            if place_slug:
                return f"{humanize_slug(place_slug)}, {country_title}"

    return humanize_slug(normalized)


def warn_noncanonical_slug(month_id: str, slug: str) -> None:
    if RE_CANONICAL_SLUG.fullmatch(slug):
        return

    print(
        "⚠ Noncanonical album folder name: "
        f"journal/{month_id}/{slug}\n"
        "  Recommended format: lowercase-words-with-hyphens.\n"
        "  The build will continue, but spaces and capitals make fragile URLs."
    )


def asset_version(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Missing required asset: {path}")

    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return digest[:12]


def write_text_atomic(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(content, encoding="utf-8", newline="\n")
    temporary.replace(path)


# -----------------------------
# Titles and descriptions
# -----------------------------
def load_title_overrides(root: Path) -> Dict[str, str]:
    """
    Load optional titles from journal/titles.json.

    Backward-compatible keys:
      "album-slug": "Display title"

    More precise optional key:
      "2026-07/album-slug": "Display title"
    """
    titles_path = root / "journal" / "titles.json"

    if not titles_path.exists():
        return {}

    try:
        data = json.loads(titles_path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {titles_path}: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError(
            "journal/titles.json must contain a JSON object of key -> title"
        )

    cleaned: Dict[str, str] = {}

    for key, title in data.items():
        if not isinstance(key, str) or not isinstance(title, str):
            raise ValueError(
                "journal/titles.json must map string keys to string titles"
            )

        clean_key = key.strip()
        clean_title = title.strip()

        if not clean_key or not clean_title:
            raise ValueError(
                "journal/titles.json cannot contain empty keys or titles"
            )

        cleaned[clean_key] = clean_title

    return cleaned


def resolve_title(
    title_overrides: Mapping[str, str],
    month_id: str,
    slug: str,
) -> str:
    return title_overrides.get(
        f"{month_id}/{slug}",
        title_overrides.get(slug, slug_to_title(slug)),
    )


def load_or_prompt_description(
    album_dir: Path,
    root: Path,
    interactive: bool,
) -> str:
    description_path = album_dir / "description.txt"

    if description_path.exists():
        return description_path.read_text(encoding="utf-8").strip()

    relative_album = album_dir.relative_to(root)
    print(f"⚠ Missing description.txt: {relative_album}")

    if not interactive:
        print("  Non-interactive build: continuing with an empty description.")
        return ""

    description = input(
        "  Enter a one-line description now, or press Enter to skip: "
    ).strip()

    if description:
        description_path.write_text(
            description + "\n",
            encoding="utf-8",
            newline="\n",
        )
        print(f"  ✅ Wrote: {description_path.relative_to(root)}")
    else:
        print("  Continuing without a description.")

    return description


# -----------------------------
# Images
# -----------------------------
def find_numbered_images(album_dir: Path) -> Dict[int, str]:
    images: Dict[int, str] = {}

    for path in album_dir.iterdir():
        if not path.is_file():
            continue

        match = RE_IMAGE.fullmatch(path.name)
        if not match:
            continue

        number = int(match.group(1))

        if number in images:
            raise ValueError(
                f"Duplicate numbered image {number} in {album_dir}"
            )

        images[number] = path.suffix.lstrip(".")

    return images


def detect_images(album_dir: Path) -> Tuple[int, str]:
    images = find_numbered_images(album_dir)

    if not images:
        raise ValueError(f"No numbered images found in: {album_dir}")

    maximum = max(images)
    missing = [
        number
        for number in range(1, maximum + 1)
        if number not in images
    ]

    if missing:
        raise ValueError(
            f"Missing images {missing} in {album_dir}; "
            f"the sequence must be contiguous from 1 to {maximum}."
        )

    first_extension = images[1]
    mismatched = [
        number
        for number, extension in images.items()
        if extension.lower() != first_extension.lower()
    ]

    if mismatched:
        raise ValueError(
            f"Mixed image extensions in {album_dir}. "
            "Keep all numbered images on one extension. "
            f"Mismatches at: {mismatched}"
        )

    return maximum, first_extension


def confirm_image_count(
    album_dir: Path,
    root: Path,
    count: int,
    interactive: bool,
) -> None:
    if count == EXPECTED_IMAGE_COUNT:
        return

    relative_album = album_dir.relative_to(root)
    message = (
        f"⚠ Image count warning: {relative_album} has {count} numbered images. "
        f"The journal standard is exactly {EXPECTED_IMAGE_COUNT}."
    )
    print(message)

    if not interactive:
        raise ValueError(message)

    answer = input("  Continue anyway? [y/N]: ").strip().lower()
    if answer not in {"y", "yes"}:
        raise ValueError(f"Stopped. Fix the image count in {album_dir}")


# -----------------------------
# Homepage and sharing images
# -----------------------------
def image_filename(album: Album, number: int) -> str:
    return f"{number}.{album.image_ext}"


def parse_image_selection(
    value: str,
    album: Album,
    source_name: str,
) -> str:
    cleaned = value.strip().lower()

    if cleaned.isdigit():
        number = int(cleaned)
    else:
        match = RE_IMAGE.fullmatch(cleaned)

        if not match:
            raise ValueError(
                f"{source_name} must contain an image number or filename, "
                f"such as 4 or 4.{album.image_ext}."
            )

        number = int(match.group(1))
        extension = match.group(2).lower()

        if extension != album.image_ext.lower():
            raise ValueError(
                f"{source_name} refers to '.{extension}', but this album "
                f"uses '.{album.image_ext}'."
            )

    if number < 1 or number > album.image_count:
        raise ValueError(
            f"{source_name} must select an image from 1 to "
            f"{album.image_count}."
        )

    return image_filename(album, number)


def read_image_selection(
    album_dir: Path,
    album: Album,
    selection_name: str,
) -> str | None:
    selection_path = album_dir / selection_name

    if not selection_path.exists():
        return None

    return parse_image_selection(
        selection_path.read_text(encoding="utf-8-sig"),
        album,
        str(selection_path),
    )


def write_image_selection(
    selection_path: Path,
    filename: str,
) -> None:
    selection_path.write_text(
        filename + "\n",
        encoding="utf-8",
        newline="\n",
    )


def prompt_image_selection(
    album: Album,
    purpose: str,
    default_number: int = 1,
) -> str:
    while True:
        answer = input(
            f"  Choose {purpose} image [1-{album.image_count}] "
            f"(Enter = {default_number}): "
        ).strip()

        if not answer:
            answer = str(default_number)

        try:
            return parse_image_selection(
                answer,
                album,
                f"{purpose} selection",
            )
        except ValueError as exc:
            print(f"  {exc}")


def ensure_latest_image_choices(
    root: Path,
    album: Album,
    interactive: bool,
) -> Tuple[str, str]:
    album_dir = root / album.rel_dir
    home_path = album_dir / "home-image.txt"
    share_path = album_dir / "share-image.txt"

    home_image = read_image_selection(
        album_dir,
        album,
        "home-image.txt",
    )
    prompted_for_home = False

    if home_image is None:
        if interactive:
            print(f"\nNewest album: {album.title}")
            home_image = prompt_image_selection(
                album,
                "homepage",
            )
            write_image_selection(home_path, home_image)
            prompted_for_home = True
            print(
                "  ✅ Wrote: "
                f"{home_path.relative_to(root)} -> {home_image}"
            )
        else:
            home_image = image_filename(album, 1)
            print(
                "⚠ Missing home-image.txt for the newest album. "
                f"Using {home_image} for this non-interactive build."
            )

    share_image = read_image_selection(
        album_dir,
        album,
        "share-image.txt",
    )

    if share_image is not None:
        if share_image == home_image:
            share_path.unlink()
            share_image = home_image
            print(
                "  Removed redundant share-image.txt because it "
                "matched home-image.txt."
            )

        return home_image, share_image

    if prompted_for_home and interactive:
        answer = input(
            f"  Use {home_image} as the sharing image too? [Y/n]: "
        ).strip().lower()

        if answer in {"n", "no"}:
            share_image = prompt_image_selection(
                album,
                "sharing",
            )

            if share_image != home_image:
                write_image_selection(share_path, share_image)
                print(
                    "  ✅ Wrote: "
                    f"{share_path.relative_to(root)} -> {share_image}"
                )
            else:
                share_image = home_image
        else:
            share_image = home_image
    else:
        share_image = home_image

    return home_image, share_image


def resolve_album_share_image(
    root: Path,
    album: Album,
) -> str:
    album_dir = root / album.rel_dir

    share_image = read_image_selection(
        album_dir,
        album,
        "share-image.txt",
    )

    if share_image is not None:
        return share_image

    home_image = read_image_selection(
        album_dir,
        album,
        "home-image.txt",
    )

    if home_image is not None:
        return home_image

    return image_filename(album, 1)


def absolute_album_image_url(
    album: Album,
    filename: str,
) -> str:
    return f"{SITE_URL}{album.url}{filename}"


# -----------------------------
# Automatic stable album order
# -----------------------------
def parse_created_at(value: Any) -> float | None:
    if not isinstance(value, str) or not value.strip():
        return None

    try:
        return datetime.fromisoformat(
            value.replace("Z", "+00:00")
        ).timestamp()
    except ValueError:
        return None


def load_previous_created_times(
    root: Path,
) -> Dict[Tuple[str, str], float]:
    """
    Read automatically persisted ordering timestamps from journal.json.

    Old manifests without created_at remain valid; those albums simply use
    their current folder creation timestamp during this build.
    """
    manifest_path = root / "journal" / "journal.json"

    if not manifest_path.exists():
        return {}

    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        print(
            "⚠ Existing journal/journal.json could not be read. "
            "Folder timestamps will be used."
        )
        return {}

    output: Dict[Tuple[str, str], float] = {}

    for month in data.get("months", []):
        if not isinstance(month, dict):
            continue

        month_id = month.get("id")
        albums = month.get("albums", [])

        if not isinstance(month_id, str) or not isinstance(albums, list):
            continue

        for album in albums:
            if not isinstance(album, dict):
                continue

            slug = album.get("slug")
            timestamp = parse_created_at(album.get("created_at"))

            if isinstance(slug, str) and timestamp is not None:
                output[(month_id, slug)] = timestamp

    return output


def folder_created_timestamp(album_dir: Path) -> float:
    stat_result = album_dir.stat()

    if sys.platform == "win32":
        return stat_result.st_ctime

    return getattr(
        stat_result,
        "st_birthtime",
        stat_result.st_mtime,
    )


# -----------------------------
# Scanning
# -----------------------------
def scan_repo(
    root: Path,
    interactive: bool = True,
) -> Tuple[Tuple[Month, ...], Tuple[Album, ...]]:
    journal_dir = root / "journal"

    if not journal_dir.exists():
        raise FileNotFoundError(f"Missing folder: {journal_dir}")

    title_overrides = load_title_overrides(root)
    previous_created_times = load_previous_created_times(root)

    month_dirs = [
        path
        for path in journal_dir.iterdir()
        if path.is_dir() and RE_MONTH.fullmatch(path.name)
    ]
    month_dirs.sort(key=lambda path: path.name, reverse=True)

    months: List[Month] = []
    all_albums: List[Album] = []

    for month_dir in month_dirs:
        month_id = month_dir.name
        display_month = month_title(month_id)

        album_dirs = [
            path
            for path in month_dir.iterdir()
            if path.is_dir() and not path.name.startswith(".")
        ]

        album_records: List[Album] = []

        for album_dir in album_dirs:
            slug = album_dir.name
            warn_noncanonical_slug(month_id, slug)

            images = find_numbered_images(album_dir)

            if not images:
                visible_entries = [
                    path.name
                    for path in album_dir.iterdir()
                    if path.name not in {
                        "index.html",
                        "Thumbs.db",
                        ".DS_Store",
                    }
                ]

                if not visible_entries:
                    stale_index = album_dir / "index.html"
                    if stale_index.exists():
                        stale_index.unlink()
                        print(
                            "⚠ Removed stale generated page from empty folder: "
                            f"{stale_index.relative_to(root)}"
                        )
                    continue

                raise ValueError(
                    f"Album folder has no numbered images: "
                    f"{album_dir.relative_to(root)}\n"
                    f"Found instead: {', '.join(visible_entries)}"
                )

            image_count, image_extension = detect_images(album_dir)
            confirm_image_count(
                album_dir,
                root,
                image_count,
                interactive,
            )

            created_timestamp = previous_created_times.get(
                (month_id, slug),
                folder_created_timestamp(album_dir),
            )

            album_records.append(
                Album(
                    month_id=month_id,
                    slug=slug,
                    title=resolve_title(
                        title_overrides,
                        month_id,
                        slug,
                    ),
                    description=load_or_prompt_description(
                        album_dir,
                        root,
                        interactive,
                    ),
                    image_ext=image_extension,
                    image_count=image_count,
                    rel_dir=album_dir.relative_to(root),
                    created_timestamp=created_timestamp,
                )
            )

        album_records.sort(
            key=lambda album: (
                -album.created_timestamp,
                album.slug.lower(),
            )
        )

        if not album_records:
            stale_month_index = month_dir / "index.html"
            if stale_month_index.exists():
                stale_month_index.unlink()
                print(
                    "⚠ Removed stale generated month page: "
                    f"{stale_month_index.relative_to(root)}"
                )
            continue

        month = Month(
            id=month_id,
            title=display_month,
            rel_dir=month_dir.relative_to(root),
            albums=tuple(album_records),
        )

        months.append(month)
        all_albums.extend(album_records)

    return tuple(months), tuple(all_albums)


# -----------------------------
# Rendering helpers
# -----------------------------
def make_environment(root: Path) -> Environment:
    template_dir = root / "tools" / "templates"

    if not template_dir.exists():
        raise FileNotFoundError(
            f"Missing templates folder: {template_dir}"
        )

    return Environment(
        loader=FileSystemLoader(str(template_dir)),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def build_manifest(months: Sequence[Month]) -> Dict[str, Any]:
    return {
        "schema_version": ORDER_SCHEMA_VERSION,
        "months": [
            {
                "id": month.id,
                "title": month.title,
                "albums": [
                    {
                        "slug": album.slug,
                        "title": album.title,
                        "description": album.description,
                        "count": album.image_count,
                        "ext": album.image_ext,
                        "url": album.url,
                        "created_at": album.created_at,
                    }
                    for album in month.albums
                ],
            }
            for month in months
        ],
    }


def build_archive_months(
    months: Sequence[Month],
    latest_albums: Sequence[Album],
) -> Tuple[Month, ...]:
    latest_keys = {
        (album.month_id, album.slug)
        for album in latest_albums
    }

    archive_months: List[Month] = []

    for month in months:
        archived_albums = tuple(
            album
            for album in month.albums
            if (album.month_id, album.slug) not in latest_keys
        )

        if not archived_albums:
            continue

        archive_months.append(
            Month(
                id=month.id,
                title=month.title,
                rel_dir=month.rel_dir,
                albums=archived_albums,
            )
        )

    return tuple(archive_months)


def group_archive_years(
    archive_months: Sequence[Month],
) -> Tuple[ArchiveYear, ...]:
    grouped: Dict[str, List[Month]] = {}

    for month in archive_months:
        year = month.id.split("-", 1)[0]
        grouped.setdefault(year, []).append(month)

    return tuple(
        ArchiveYear(
            year=year,
            months=tuple(grouped[year]),
        )
        for year in sorted(grouped, reverse=True)
    )


def render_all(
    root: Path,
    interactive: bool = True,
) -> None:
    months, albums = scan_repo(
        root,
        interactive=interactive,
    )

    if not albums:
        raise ValueError("No valid albums were found.")

    environment = make_environment(root)

    css_version = asset_version(root / "styles.css")
    js_version = asset_version(root / "site.js")

    latest_albums = tuple(albums[:LATEST_ALBUM_COUNT])
    featured_album = latest_albums[0]
    home_image, featured_share_image = ensure_latest_image_choices(
        root,
        featured_album,
        interactive,
    )
    archive_months = build_archive_months(
        months,
        latest_albums,
    )
    archive_years = group_archive_years(archive_months)

    home_template = environment.get_template("home.html")
    month_template = environment.get_template("month.html")
    album_template = environment.get_template("album.html")
    about_template = environment.get_template("about.html")
    sitemap_template = environment.get_template("sitemap.xml")

    outputs: Dict[Path, str] = {}

    outputs[root / "journal" / "journal.json"] = json.dumps(
        build_manifest(months),
        indent=2,
        ensure_ascii=False,
    ) + "\n"

    outputs[root / "index.html"] = home_template.render(
        latest_albums=latest_albums,
        archive_years=archive_years,
        featured_album=featured_album,
        home_image=home_image,
        featured_share_image_url=absolute_album_image_url(
            featured_album,
            featured_share_image,
        ),
        site_url=SITE_URL,
        css_version=css_version,
        js_version=js_version,
    )

    outputs[root / "about" / "index.html"] = about_template.render(
        site_url=SITE_URL,
        css_version=css_version,
        js_version=js_version,
    )

    for month in months:
        outputs[root / month.rel_dir / "index.html"] = month_template.render(
            month=month,
            site_url=SITE_URL,
            css_version=css_version,
            js_version=js_version,
        )

    album_index = {
        (album.month_id, album.slug): index
        for index, album in enumerate(albums)
    }

    for album in albums:
        index = album_index[(album.month_id, album.slug)]

        older_album = (
            albums[index + 1]
            if index + 1 < len(albums)
            else None
        )
        newer_album = (
            albums[index - 1]
            if index > 0
            else None
        )

        album_month_title = month_title(album.month_id)
        share_image = resolve_album_share_image(root, album)
        canonical_url = f"{SITE_URL}{album.url}"
        meta_description = (
            album.description
            if album.description
            else (
                f"A quiet photographic sequence from {album.title}, "
                f"{album_month_title}. {album.image_count} photographs "
                "by Achint Karak."
            )
        )

        outputs[root / album.rel_dir / "index.html"] = album_template.render(
            album=album,
            month_title=album_month_title,
            prev_album=older_album,
            next_album=newer_album,
            canonical_url=canonical_url,
            share_image_url=absolute_album_image_url(
                album,
                share_image,
            ),
            meta_description=meta_description,
            css_version=css_version,
            js_version=js_version,
        )

    outputs[root / "sitemap.xml"] = sitemap_template.render(
        months=months,
        albums=albums,
    )

    # Nothing is written until all scanning and template rendering succeeds.
    for output_path, content in outputs.items():
        write_text_atomic(output_path, content)

    print("✅ Build complete")
    print(f"- Months: {len(months)}")
    print(f"- Albums: {len(albums)}")
    print(f"- Latest albums: {len(latest_albums)}")
    print(f"- CSS version: {css_version}")
    print(f"- JS version: {js_version}")
    print("- Latest order:")

    for position, album in enumerate(latest_albums, start=1):
        print(
            f"  {position}. {album.month_id}/{album.slug}"
        )

    print("- Month order:")

    for month in months:
        order = " | ".join(album.slug for album in month.albums)
        print(f"  {month.id}: {order}")

    print(
        "- Wrote: index.html, about/index.html, journal/journal.json, "
        "month pages, album pages and sitemap.xml"
    )


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build Achint Karak's static photo journal."
    )
    parser.add_argument(
        "--no-prompt",
        action="store_true",
        help=(
            "Disable description and image-count prompts. "
            "Validation failures stop the build."
        ),
    )
    return parser.parse_args()


def main() -> None:
    arguments = parse_arguments()
    root = Path(__file__).resolve().parents[1]

    interactive = (
        sys.stdin.isatty()
        and not arguments.no_prompt
    )

    render_all(
        root,
        interactive=interactive,
    )


if __name__ == "__main__":
    main()
