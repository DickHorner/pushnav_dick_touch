"""Tests for private BAfK packages; no copyrighted atlas data in fixtures."""

import io
import json
from zipfile import ZIP_DEFLATED, ZipFile

import pytest

from evf.webserver import bafk


def package(entries=None, image_name="images/p004-00.jpg", pdf=b"%PDF-1.6"):
    if entries is None:
        entries = [
            {
                "id": f"p004-{i:02d}", "name": name, "constellation": "And",
                "ra_deg": 10.684, "dec_deg": 41.269, "aperture": '4"',
                "filter": "--", "type": "Gx", "page": 4,
                "description": "Local observation text", "images": ["p004-00.jpg"],
            }
            for i, name in enumerate(("M 31", "M 32"))
        ]
    buffer = io.BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr("catalog.json", json.dumps(entries))
        archive.writestr("atlas.pdf", pdf)
        archive.writestr(image_name, b"pretend jpeg")
    return buffer.getvalue()


@pytest.fixture(autouse=True)
def small_catalog(monkeypatch):
    monkeypatch.setattr(bafk, "EXPECTED_OBJECTS", 2)
    monkeypatch.setattr(bafk, "EXPECTED_IMAGES", 1)


def test_import_and_read(tmp_path):
    destination = tmp_path / "bafk"
    assert bafk.import_bafk_package(package(), destination) == {"objects": 2, "images": 1}
    assert [row["name"] for row in bafk.read_bafk_catalog(destination)] == ["M 31", "M 32"]
    assert (destination / "images" / "p004-00.jpg").read_bytes() == b"pretend jpeg"
    assert (destination / "atlas.pdf").read_bytes().startswith(b"%PDF")


def test_invalid_archive_preserves_previous_import(tmp_path):
    destination = tmp_path / "bafk"
    bafk.import_bafk_package(package(), destination)
    with pytest.raises(ValueError, match="ZIP"):
        bafk.import_bafk_package(b"broken", destination)
    assert len(bafk.read_bafk_catalog(destination)) == 2


def test_zip_path_traversal_is_rejected(tmp_path):
    with pytest.raises(ValueError, match="contents are invalid"):
        bafk.import_bafk_package(package(image_name="images/../../secret.jpg"), tmp_path / "bafk")
    assert not (tmp_path / "secret.jpg").exists()


def test_invalid_coordinates_are_rejected(tmp_path):
    with ZipFile(io.BytesIO(package())) as archive:
        invalid = json.loads(archive.read("catalog.json"))
    invalid[0]["ra_deg"] = 999
    with pytest.raises(ValueError, match="coordinates"):
        bafk.import_bafk_package(package(entries=invalid), tmp_path / "bafk")


def test_empty_catalog(tmp_path):
    assert bafk.read_bafk_catalog(tmp_path / "bafk") == []
