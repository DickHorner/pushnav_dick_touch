#!/usr/bin/env python3
"""Package a local BAfK July 2020 PDF for private PushNav import.

Usage: uv run --with pymupdf python scripts/build_bafk_package.py atlas.pdf bafk.zip
Neither the PDF nor extracted atlas data is added to the repository.
"""

import bisect
import json
import re
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import fitz

EXPECTED_ENTRIES = 1443  # 1,420 objects and 23 stellar associations
OBJECT_LINE = re.compile(
    r"^(.+?)\s{2,}(?:([A-Z][A-Za-z]{2})\s+)?"
    r"(\d{2}h\d{2}m\d{2}s)\s+([+-]\d{2}°\d{2}'\d{2}[\"'])"
)
RA_WORD = re.compile(r"\d{2}h\d{2}m\d{2}s")


def coordinates(ra: str, dec: str) -> tuple[float, float]:
    hours, minutes, seconds = map(int, re.findall(r"\d+", ra))
    degrees, arcmin, arcsec = map(int, re.findall(r"\d+", dec))
    return (
        15 * (hours + minutes / 60 + seconds / 3600),
        (-1 if dec.startswith("-") else 1) * (degrees + arcmin / 60 + arcsec / 3600),
    )


def column(words: list[tuple], y: float, left: float, right: float) -> str:
    return " ".join(
        word[4] for word in sorted(words, key=lambda word: word[0])
        if abs(word[1] - y) < 1.5 and left <= word[0] < right
    )


def extract_page(page: fitz.Page, pdf_page: int, archive: ZipFile) -> list[dict]:
    words = page.get_text("words")
    anchors = sorted((word[1], word[4]) for word in words if RA_WORD.fullmatch(word[4]))
    positions = [anchor[0] for anchor in anchors]
    lines = [
        match for line in page.get_text("text", sort=True).splitlines()
        if (match := OBJECT_LINE.match(line))
    ]
    if len(anchors) != len(lines):
        raise ValueError(f"Page {pdf_page}: parsed {len(lines)} of {len(anchors)} object rows")

    entries: list[dict] = []
    constellation: str | None = None
    for (y, anchor), match in zip(anchors, lines):
        name, current_constellation, ra, dec = match.groups()
        if anchor != ra:
            raise ValueError(f"Page {pdf_page}: object rows are out of order")
        constellation = current_constellation or constellation
        if constellation is None:
            raise ValueError(f"Page {pdf_page}: no constellation for {name}")
        ra_deg, dec_deg = coordinates(ra, dec)
        entries.append({
            "id": f"p{pdf_page:03d}-{len(entries):02d}",
            "name": name.strip(),
            "constellation": constellation,
            "ra_deg": ra_deg,
            "dec_deg": dec_deg,
            "aperture": column(words, y, 234, 261),
            "filter": column(words, y, 262, 284),
            "type": column(words, y, 284, 310),
            "page": pdf_page,
            "description": "",
            "images": [],
        })

    for index, entry in enumerate(entries):
        start = positions[index] + 9
        end = positions[index + 1] - 1 if index + 1 < len(entries) else 817
        if end > start:
            entry["description"] = " ".join(
                page.get_text("text", clip=fitz.Rect(18, start, 521, end), sort=True).split()
            )

    # The drawings/photographs occupy the rightmost column.
    image_number = 0
    for block in page.get_text("dict")["blocks"]:
        if block["type"] != 1:
            continue
        left, top, right, bottom = block["bbox"]
        if not (left > 485 and right < 585 and top < 818):
            continue
        index = bisect.bisect_right(positions, (top + bottom) / 2) - 1
        if index < 0:
            raise ValueError(f"Page {pdf_page}: illustration without object")
        extension = block.get("ext", "").lower()
        if extension not in {"jpeg", "png"}:
            raise ValueError(f"Page {pdf_page}: unexpected image format {extension}")
        suffix = "jpg" if extension == "jpeg" else "png"
        image = f"p{pdf_page:03d}-{image_number:02d}.{suffix}"
        archive.writestr(f"images/{image}", block["image"])
        entries[index]["images"].append(image)
        image_number += 1

    # Consecutive table rows can share an illustration and a description.
    for index in range(len(entries) - 2, -1, -1):
        if positions[index + 1] - positions[index] < 16:
            if not entries[index]["description"]:
                entries[index]["description"] = entries[index + 1]["description"]
            if not entries[index]["images"]:
                entries[index]["images"] = entries[index + 1]["images"].copy()
    return entries


def build_package(pdf_path: Path, output: Path) -> tuple[int, int]:
    with fitz.open(pdf_path) as document:
        if len(document) != 107 or "Beobachteratlas für Kurzentschlossene" not in document[0].get_text():
            raise ValueError("Only the July 2020 BAfK PDF is supported")
        entries: list[dict] = []
        with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
            for page_number in range(4, 100):
                entries.extend(extract_page(document[page_number - 1], page_number, archive))
            if len(entries) != EXPECTED_ENTRIES:
                raise ValueError(f"Expected {EXPECTED_ENTRIES} entries, found {len(entries)}")
            archive.writestr(
                "catalog.json", json.dumps(entries, ensure_ascii=False, separators=(",", ":")),
            )
            archive.write(pdf_path, "atlas.pdf")
            image_count = sum(name.startswith("images/") for name in archive.namelist())
        return len(entries), image_count


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("Usage: build_bafk_package.py BAfK_final_2020_07.pdf output.zip")
    target = Path(sys.argv[2])
    try:
        count, pictures = build_package(Path(sys.argv[1]), target)
    except (ValueError, OSError, fitz.FileDataError) as exc:
        target.unlink(missing_ok=True)
        sys.exit(f"BAfK import failed: {exc}")
    print(f"Packaged {count} entries and {pictures} illustrations into {target}")
