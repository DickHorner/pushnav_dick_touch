"""Time-dependent planetary directions from the existing PyERFA dependency."""

from datetime import datetime, timedelta, timezone
import math

import pytest

from evf.engine.solar_system import solar_system_positions


EPOCH = datetime(2026, 11, 14, 20, 0, tzinfo=timezone.utc)


def by_id(at=EPOCH, location=None):
    return {entry["id"]: entry for entry in solar_system_positions(at, location)}


def test_all_planets_and_moon_have_valid_coordinates():
    entries = by_id()
    assert set(entries) == {
        "mercury", "venus", "earth", "mars", "jupiter", "saturn",
        "uranus", "neptune", "moon",
    }
    assert entries["earth"]["ra_deg"] is None
    assert entries["earth"]["dec_deg"] is None
    for name, entry in entries.items():
        if name == "earth":
            continue
        assert 0 <= entry["ra_deg"] < 360
        assert -90 <= entry["dec_deg"] <= 90
        assert entry["topocentric"] is False


def test_saturn_and_moon_move_with_observation_time():
    before = by_id()
    after = by_id(EPOCH + timedelta(days=3))
    assert abs(before["saturn"]["ra_deg"] - after["saturn"]["ra_deg"]) > 0.01
    assert abs(before["moon"]["dec_deg"] - after["moon"]["dec_deg"]) > 0.3


def test_moon_observer_parallax_is_not_ignored():
    geocentric = by_id()["moon"]
    berlin = by_id(location=(52.5, 13.4))["moon"]
    assert berlin["topocentric"] is True
    distance = math.hypot(
        (berlin["ra_deg"] - geocentric["ra_deg"])
        * math.cos(math.radians(geocentric["dec_deg"])),
        berlin["dec_deg"] - geocentric["dec_deg"],
    )
    assert 0.05 < distance < 1.2


def test_timezone_and_year_are_validated():
    with pytest.raises(ValueError, match="timezone"):
        solar_system_positions(datetime(2026, 11, 14), None)
    with pytest.raises(ValueError, match="year"):
        solar_system_positions(datetime(2200, 1, 1, tzinfo=timezone.utc), None)
    with pytest.raises(ValueError, match="location"):
        solar_system_positions(EPOCH, (95.0, 13.0))
