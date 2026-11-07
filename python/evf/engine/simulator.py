"""Synthetic camera and telescope pointing for hardware-free UI debugging."""

import io
import logging
import math
import random
import threading
import time

from PIL import Image, ImageDraw

from evf.engine.frame_buffer import LatestFrame
from evf.engine.pointing import PointingState
from evf.engine.state import EngineState, StateMachine

logger = logging.getLogger(__name__)


class SimulatedTelescope:
    """Feed the normal camera/pointing buffers without starting a real solver."""

    _INTERVAL = 0.1  # Match the MJPEG/WebSocket cadence (10 Hz).
    _WIDTH = 1280
    _HEIGHT = 720
    _FOV_H = 8.86
    _START_RA = 79.1723  # Capella, also used by the existing DebugPanel.
    _START_DEC = 45.998

    def __init__(
        self,
        frame_buffer: LatestFrame,
        pointing: PointingState,
        state_machine: StateMachine,
    ) -> None:
        self._frame_buffer = frame_buffer
        self._pointing = pointing
        self._state_machine = state_machine
        self._ra = self._START_RA
        self._dec = self._START_DEC
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        rng = random.Random(42)
        self._stars = [
            (rng.randrange(self._WIDTH), rng.randrange(self._HEIGHT),
             rng.choice((1, 1, 1, 2, 3)), rng.randrange(100, 255))
            for _ in range(220)
        ]
        self._jpeg = self._render_frame(self._ra, self._dec, live=False)
        self._jpeg_live = self._render_frame(self._ra, self._dec, live=True)

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self) -> None:
        """Enter TRACKING via the existing state machine, skipping real sync."""
        self._state_machine.transition(EngineState.SYNC)
        self._state_machine.transition(EngineState.SYNC_CONFIRM)
        self._state_machine.transition(EngineState.WARMING_UP)
        self._state_machine.transition(EngineState.TRACKING)
        self._pointing.update(self._ra, self._dec, 0.0, 0, 0.0)
        self._frame_buffer.set(self._jpeg, time.monotonic(), 1)
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run, name="simulator", daemon=True,
        )
        self._thread.start()
        logger.info("Simulator started (no camera or plate solver)")

    def move(self, delta_ra_deg: float, delta_dec_deg: float) -> None:
        """Move the synthetic scope in J2000 RA/Dec degrees."""
        if (
            not math.isfinite(delta_ra_deg)
            or not math.isfinite(delta_dec_deg)
            or abs(delta_ra_deg) > 360.0
            or abs(delta_dec_deg) > 180.0
        ):
            raise ValueError("Invalid simulated movement")
        with self._lock:
            self._ra = (self._ra + delta_ra_deg) % 360.0
            self._dec = max(-90.0, min(90.0, self._dec + delta_dec_deg))
            self._jpeg = self._render_frame(self._ra, self._dec, live=False)
            self._jpeg_live = self._render_frame(self._ra, self._dec, live=True)
            logger.info("Simulator pointing RA=%.3f Dec=%.3f", self._ra, self._dec)

    def _run(self) -> None:
        frame_id = 1
        while not self._stop.wait(self._INTERVAL):
            with self._lock:
                ra, dec = self._ra, self._dec
                jpeg = self._jpeg_live if (frame_id // 5) % 2 else self._jpeg
            now = time.monotonic()
            self._pointing.update(ra, dec, 0.0, 0, 0.0)
            frame_id += 1
            self._frame_buffer.set(jpeg, now, frame_id)

    def _render_frame(self, ra: float, dec: float, *, live: bool) -> bytes:
        """Render a repeatable moving star pattern; not a real sky catalog."""
        image = Image.new("RGB", (self._WIDTH, self._HEIGHT), (5, 7, 16))
        draw = ImageDraw.Draw(image)
        pixels_per_degree = self._WIDTH / self._FOV_H
        shift_x = round((ra - self._START_RA) * pixels_per_degree)
        shift_y = round((dec - self._START_DEC) * pixels_per_degree)
        for x, y, radius, brightness in self._stars:
            px = (x + shift_x) % self._WIDTH
            py = (y + shift_y) % self._HEIGHT
            draw.ellipse(
                (px - radius, py - radius, px + radius, py + radius),
                fill=(brightness, brightness, min(255, brightness + 12)),
            )
        draw.text(
            (16, 16),
            f"SIMULATED CAMERA - NO PLATE SOLVING | RA {ra:.2f}  Dec {dec:+.2f}",
            fill=(255, 190, 90),
        )
        draw.ellipse(
            (1240, 16, 1258, 34),
            fill=(90, 255, 90) if live else (30, 65, 30),
        )
        output = io.BytesIO()
        image.save(output, format="JPEG", quality=85)
        return output.getvalue()

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=1.0)
            self._thread = None
