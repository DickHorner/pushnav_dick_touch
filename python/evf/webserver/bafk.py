"""Private BAfK catalog storage. Imported atlas content stays on the user's machine."""

import io
import json
import math
import re
import shutil
import tempfile
from pathlib import Path
from zipfile import BadZipFile, ZipFile

EXPECTED_OBJECTS = 1443
EXPECTED_IMAGES = 829
MAX_UNPACKED_SIZE = 40 * 1024 * 1024
IMAGE_NAME = re.compile(r"p\d{3}-\d{2}\.(?:jpg|png)\Z")
ENTRY_ID = re.compile(r"p\d{3}-\d{2}\Z")


def _validate_catalog(data: bytes, images: set[str]) -> list[dict]:
    try:
        entries = json.loads(data)
    except (ValueError, UnicodeDecodeError) as exc:
        raise ValueError("BAfK catalog JSON is invalid") from exc
    if not isinstance(entries, list) or len(entries) != EXPECTED_OBJECTS:
        raise ValueError(f"BAfK catalog must contain {EXPECTED_OBJECTS} entries")
    identifiers: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("BAfK catalog contains an invalid entry")
        identifier = entry.get("id")
        if not isinstance(identifier, str) or not ENTRY_ID.fullmatch(identifier) or identifier in identifiers:
            raise ValueError("BAfK catalog contains an invalid or repeated ID")
        identifiers.add(identifier)
        if any(
            not isinstance(entry.get(field), str) or len(entry[field]) > limit
            for field, limit in (
                ("name", 100), ("constellation", 3), ("aperture", 12),
                ("filter", 12), ("type", 8), ("description", 5000),
            )
        ):
            raise ValueError(f"BAfK catalog contains invalid text for {identifier}")
        if not entry["name"] or not re.fullmatch(r"[A-Z][A-Za-z]{2}", entry["constellation"]):
            raise ValueError(f"BAfK catalog contains invalid object name for {identifier}")
        ra, dec = entry.get("ra_deg"), entry.get("dec_deg")
        if any(type(x) not in (float, int) or not math.isfinite(x) for x in (ra, dec)):
            raise ValueError(f"BAfK catalog contains invalid coordinates for {identifier}")
        if not (0 <= ra < 360 and -90 <= dec <= 90):
            raise ValueError(f"BAfK catalog contains out-of-range coordinates for {identifier}")
        page = entry.get("page")
        if type(page) is not int or page < 4 or page > 99 or identifier[:4] != f"p{page:03d}":
            raise ValueError(f"BAfK catalog contains invalid page for {identifier}")
        pictures = entry.get("images")
        if not isinstance(pictures, list) or len(pictures) > 4 or any(
            not isinstance(name, str) or name not in images for name in pictures
        ):
            raise ValueError(f"BAfK catalog contains invalid picture references for {identifier}")
    return entries


def import_bafk_package(package: bytes, destination: Path) -> dict:
    """Validate ZIP members and swap the private catalog after successful extraction."""
    if not package.startswith(b"PK"):
        raise ValueError("Choose the locally generated BAfK ZIP package")
    try:
        with ZipFile(io.BytesIO(package)) as archive:
            members = archive.infolist()
            names = [member.filename for member in members]
            if len(names) != len(set(names)) or len(names) != EXPECTED_IMAGES + 2:
                raise ValueError("BAfK package has missing or repeated files")
            images = {name[7:] for name in names if name.startswith("images/")}
            if (
                "catalog.json" not in names or "atlas.pdf" not in names
                or len(images) != EXPECTED_IMAGES
                or any(not IMAGE_NAME.fullmatch(name) for name in images)
                or sum(member.file_size for member in members) > MAX_UNPACKED_SIZE
                or any(member.file_size > 16 * 1024 * 1024 for member in members)
            ):
                raise ValueError("BAfK package contents are invalid")
            if any(name not in {"catalog.json", "atlas.pdf"} and not name.startswith("images/") for name in names):
                raise ValueError("Unexpected BAfK package file")
            if archive.read("atlas.pdf")[:5] != b"%PDF-":
                raise ValueError("BAfK package does not contain a PDF")
            entries = _validate_catalog(archive.read("catalog.json"), images)
            destination.parent.mkdir(parents=True, exist_ok=True)
            staging = Path(tempfile.mkdtemp(prefix=".bafk-import-", dir=destination.parent))
            try:
                (staging / "images").mkdir()
                for name in names:
                    if name in {"catalog.json", "atlas.pdf"}:
                        target = staging / name
                    else:
                        target = staging / "images" / name[7:]
                    target.write_bytes(archive.read(name))
                backup = destination.with_name(destination.name + ".previous")
                if backup.exists():
                    shutil.rmtree(backup)
                if destination.exists():
                    destination.rename(backup)
                try:
                    staging.rename(destination)
                except OSError:
                    if backup.exists():
                        backup.rename(destination)
                    raise
                if backup.exists():
                    shutil.rmtree(backup)
                return {"objects": len(entries), "images": len(images)}
            finally:
                if staging.exists():
                    shutil.rmtree(staging)
    except BadZipFile as exc:
        raise ValueError("BAfK package is not a valid ZIP archive") from exc


def read_bafk_catalog(destination: Path) -> list[dict]:
    catalog = destination / "catalog.json"
    return json.loads(catalog.read_text(encoding="utf-8")) if catalog.exists() else []
