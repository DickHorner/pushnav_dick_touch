"""J2000 sight lines for solar-system observing, using the existing PyERFA dependency.

Planet positions are light-time corrected geocentric vectors. With a configured
observing location, the observer's terrestrial position is removed as well
(essential for the Moon's parallax). These are approximate astrometric positions,
not high-precision apparent ephemerides.
"""

from datetime import datetime, timezone
import math

import erfa
import numpy as np


# The Earth is represented for completeness, but is not a pointing target.
BODIES = (
    ("mercury", "Merkur", 1),
    ("venus", "Venus", 2),
    ("earth", "Erde", None),
    ("mars", "Mars", 4),
    ("jupiter", "Jupiter", 5),
    ("saturn", "Saturn", 6),
    ("uranus", "Uranus", 7),
    ("neptune", "Neptun", 8),
    ("moon", "Mond", None),
)
_AU_METRES = 149597870700.0
_LIGHT_AU_PER_DAY = 173.1446326846693


def solar_system_positions(
    at: datetime, location: tuple[float, float] | None,
) -> list[dict]:
    """Return J2000 RA/Dec degrees at UTC time and optional (lat, lon)."""
    if at.tzinfo is None:
        raise ValueError("Observation time must have a timezone")
    at = at.astimezone(timezone.utc)
    if not 1900 <= at.year <= 2100:
        raise ValueError("Observation year must be between 1900 and 2100")

    utc1, utc2 = erfa.dtf2d(
        "UTC", at.year, at.month, at.day, at.hour, at.minute,
        at.second + at.microsecond / 1_000_000,
    )
    tt1, tt2 = erfa.taitt(*erfa.utctai(utc1, utc2))
    earth, _ = erfa.epv00(tt1, tt2)
    earth_position = earth["p"]

    observer = np.zeros(3)
    if location is not None:
        lat, lon = location
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError("Invalid observer location")
        terrestrial = erfa.gd2gc(1, math.radians(lon), math.radians(lat), 0.0)
        terrestrial_to_celestial = erfa.c2t06a(
            tt1, tt2, utc1, utc2, 0.0, 0.0,
        ).T
        observer = terrestrial_to_celestial @ terrestrial / _AU_METRES

    result: list[dict] = []
    for identifier, name, planet_number in BODIES:
        if identifier == "earth":
            result.append({
                "id": identifier, "name": name, "ra_deg": None,
                "dec_deg": None, "topocentric": False,
            })
            continue
        if identifier == "moon":
            vector = erfa.moon98(tt1, tt2)["p"] - observer
        else:
            # The planet's light left before the observation time.
            vector = erfa.plan94(tt1, tt2, planet_number)["p"] - earth_position - observer
            for _ in range(2):
                light_time = np.linalg.norm(vector) / _LIGHT_AU_PER_DAY
                vector = (
                    erfa.plan94(tt1, tt2 - light_time, planet_number)["p"]
                    - earth_position - observer
                )
        radius = float(np.linalg.norm(vector))
        ra = math.degrees(math.atan2(vector[1], vector[0])) % 360
        dec = math.degrees(math.asin(float(vector[2]) / radius))
        result.append({
            "id": identifier, "name": name, "ra_deg": ra,
            "dec_deg": dec, "topocentric": location is not None,
        })
    return result
