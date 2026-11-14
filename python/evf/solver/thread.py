# Copyright (C) 2026 Arun Venkataswamy
#
# This file is part of PushNav.
#
# PushNav is free software: you can redistribute it and/or modify it
# under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# PushNav is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
# General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with PushNav. If not, see <https://www.gnu.org/licenses/>.

"""Solver thread — runs plate solving in a background thread.

Per SPEC_ARCHITECTURE.md §4.2 and impl0.md §Phase 6.
"""

import logging
import math
import threading
import time

from evf.config.manager import ConfigManager
from evf.engine.audio import AudioAlert
from evf.engine.frame_buffer import LatestFrame
from evf.engine.pointing import PointingState
from evf.engine.state import EngineState, InvalidTransitionError, StateMachine
from evf.engine.navigation import angular_separation, camera_motion_axis
from evf.solver.solver import PlateSolver
from evf.solver.sync import apply_body_frame_sync

logger = logging.getLogger(__name__)


class SolverThread:
    """Background thread that plate-solves frames from LatestFrame.

    Consumes the most recent frame, solves it, validates the result,
    and updates PointingState. Transitions WARMING_UP → TRACKING on
    first successful solve.
    """

    def __init__(
        self,
        solver: PlateSolver,
        frame_buffer: LatestFrame,
        pointing_state: PointingState,
        state_machine: StateMachine,
        config: ConfigManager,
        audio: AudioAlert | None = None,
    ) -> None:
        self._solver = solver
        self._frame_buffer = frame_buffer
        self._pointing = pointing_state
        self._state_machine = state_machine
        self._config = config
        self._audio = audio
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._consecutive_failures = 0
        self._last_attempt_timestamp = 0.0
        self._lock = threading.Lock()
        self._sync_d_body = None  # np.ndarray | None — body-frame sync vector
        # Calibration state
        self._cal_ref_ra: float = 0.0
        self._cal_ref_dec: float = 0.0
        self._cal_ref_roll: float = 0.0
        self._cal_skip = threading.Event()
        self._cal_prev_ra: float = 0.0
        self._cal_prev_dec: float = 0.0
        self._cal_stable_since: float = 0.0  # monotonic timestamp
        self._cal_phase = "up"
        self._cal_up_axis: tuple[float, float] | None = None
        self._cal_error: str | None = None

    def start(self) -> None:
        """Start tracking — transition to WARMING_UP and begin solving."""
        self._stop_event.clear()
        with self._lock:
            self._consecutive_failures = 0
            self._last_attempt_timestamp = 0.0
        if self._audio:
            self._audio.reset()
        self._state_machine.transition(EngineState.WARMING_UP)
        self._thread = threading.Thread(
            target=self._run, name="solver", daemon=True
        )
        self._thread.start()

    def stop(self, timeout: float = 5.0) -> None:
        """Stop tracking."""
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=timeout)
            self._thread = None

    @property
    def consecutive_failures(self) -> int:
        with self._lock:
            return self._consecutive_failures

    @property
    def running(self) -> bool:
        thread = self._thread
        return thread is not None and thread.is_alive()

    @property
    def last_attempt_timestamp(self) -> float:
        with self._lock:
            return self._last_attempt_timestamp

    def set_sync_d_body(self, d_body) -> None:
        """Set or clear the body-frame sync vector applied to solve results."""
        self._sync_d_body = d_body

    @property
    def calibration_status(self) -> dict:
        return {"phase": self._cal_phase, "error": self._cal_error}

    def start_calibrate(self, ref_ra: float, ref_dec: float, ref_roll: float) -> None:
        """Learn camera-frame mount-up and mount-right from two deliberate moves."""
        self._cal_ref_ra = ref_ra
        self._cal_ref_dec = ref_dec
        self._cal_ref_roll = ref_roll
        self._cal_skip.clear()
        self._cal_prev_ra = ref_ra
        self._cal_prev_dec = ref_dec
        self._cal_stable_since = 0.0
        self._cal_phase = "up"
        self._cal_up_axis = None
        self._cal_error = None
        self._config.mount_axes = None  # never reuse stale axes after a new sync
        self._stop_event.clear()
        with self._lock:
            self._consecutive_failures = 0
            self._last_attempt_timestamp = 0.0
        if self._audio:
            self._audio.reset()
        self._state_machine.transition(EngineState.CALIBRATE)
        self._thread = threading.Thread(
            target=self._run, name="solver", daemon=True
        )
        self._thread.start()

    def skip_calibrate(self) -> None:
        """Signal the calibration loop to skip and proceed to WARMING_UP."""
        self._cal_skip.set()

    _VALID_STATES = (EngineState.CALIBRATE, EngineState.WARMING_UP, EngineState.TRACKING)
    _AUDIO_FAIL_THRESHOLD = 3  # consecutive failures before audio alert
    _CALIBRATE_MIN_SEP = 0.5  # minimum angular separation (degrees) for calibration
    _CALIBRATE_MAX_SEP = 15.0  # reject oversized moves with poor tangent-plane geometry
    _CALIBRATE_STABLE_TOL = 0.05  # max frame-to-frame drift (degrees) to count as stable
    _CALIBRATE_STABLE_SECS = 1.0  # seconds of stability required before accepting

    def _check_calibration(self, ra: float, dec: float, roll: float) -> bool:
        """Record settled up/right strokes; enable physical guidance only after both."""
        if self._cal_skip.is_set():
            logger.info("Mount-axis calibration skipped; physical push arrows disabled")
            self._state_machine.transition(EngineState.WARMING_UP)
            return True

        sep = angular_separation(ra, dec, self._cal_ref_ra, self._cal_ref_dec)
        if sep > self._CALIBRATE_MAX_SEP:
            self._cal_error = "Movement too large; repeat this direction by 0.5° to 15°"
            self._cal_ref_ra, self._cal_ref_dec, self._cal_ref_roll = ra, dec, roll
            self._cal_prev_ra, self._cal_prev_dec = ra, dec
            self._cal_stable_since = 0.0
            return False
        if sep < self._CALIBRATE_MIN_SEP:
            self._cal_prev_ra, self._cal_prev_dec = ra, dec
            self._cal_stable_since = 0.0
            return False

        drift = angular_separation(ra, dec, self._cal_prev_ra, self._cal_prev_dec)
        self._cal_prev_ra, self._cal_prev_dec = ra, dec
        if drift > self._CALIBRATE_STABLE_TOL:
            self._cal_stable_since = 0.0
            return False

        now = time.monotonic()
        if self._cal_stable_since == 0.0:
            self._cal_stable_since = now
            return False
        if now - self._cal_stable_since < self._CALIBRATE_STABLE_SECS:
            return False

        axis = camera_motion_axis(
            self._cal_ref_ra, self._cal_ref_dec, self._cal_ref_roll, ra, dec,
        )
        if self._cal_phase == "up":
            self._cal_up_axis = axis
            self._cal_phase = "right"
            self._cal_error = None
            self._cal_ref_ra, self._cal_ref_dec, self._cal_ref_roll = ra, dec, roll
            self._cal_stable_since = 0.0
            logger.info("Mount-axis calibration: up learned; move scope right")
            return False

        up = self._cal_up_axis
        if up is None:
            raise RuntimeError("Right stroke received without an up calibration")
        dot = up[0] * axis[0] + up[1] * axis[1]
        if abs(dot) > 0.4:
            self._cal_error = "Right stroke was not perpendicular to up; try moving right again"
            self._cal_ref_ra, self._cal_ref_dec, self._cal_ref_roll = ra, dec, roll
            self._cal_stable_since = 0.0
            return False

        self._config.mount_axes = {"up": list(up), "right": list(axis)}
        self._config.finder_rotation = math.degrees(math.atan2(up[0], up[1])) % 360.0
        self._cal_error = None
        logger.info("Mount axes calibrated: up=%s right=%s", up, axis)
        self._state_machine.transition(EngineState.WARMING_UP)
        return True

    def _run(self) -> None:
        last_frame_id = -1
        first_success = True

        while not self._stop_event.is_set():
            # Exit if state is no longer appropriate (e.g. RECONNECTING, ERROR)
            if self._state_machine.state not in self._VALID_STATES:
                logger.info(
                    "State is %s — solver exiting",
                    self._state_machine.state.value,
                )
                return

            jpeg_bytes, _timestamp, frame_id = self._frame_buffer.get()
            if jpeg_bytes is None or frame_id == last_frame_id:
                time.sleep(0.01)
                continue

            last_frame_id = frame_id

            try:
                t_start = time.monotonic()
                with self._lock:
                    self._last_attempt_timestamp = t_start
                result = self._solver.solve_frame(jpeg_bytes)
                t_total = (time.monotonic() - t_start) * 1000
                logger.debug(
                    "Solve frame %d: %.0fms (extract=%.0fms solve=%.0fms)",
                    frame_id, t_total,
                    result.get("T_extract", 0),
                    result.get("T_solve", 0),
                )
            except Exception as exc:
                logger.error("Solve error: %s", exc)
                self._pointing.clear_centroids()
                with self._lock:
                    self._consecutive_failures += 1
                    new_count = self._consecutive_failures
                if self._audio and new_count == self._AUDIO_FAIL_THRESHOLD:
                    self._audio.on_failure_count_changed(new_count)
                continue

            if self._solver.is_valid(
                result,
                min_matches=self._config.min_matches,
                max_prob=self._config.max_prob,
            ):
                ra, dec = result["RA"], result["Dec"]

                # Calibration check (uses raw plate-solve, before body-frame sync)
                if self._state_machine.state == EngineState.CALIBRATE:
                    self._check_calibration(ra, dec, result["Roll"])

                if self._sync_d_body is not None:
                    ra, dec = apply_body_frame_sync(
                        self._sync_d_body, ra, dec, result["Roll"]
                    )
                self._pointing.update(
                    ra,
                    dec,
                    result["Roll"],
                    result["Matches"],
                    result["Prob"],
                    all_centroids=result.get("all_centroids"),
                    matched_centroids=result.get("matched_centroids"),
                    image_size=result.get("image_size"),
                )
                with self._lock:
                    was_failing = (
                        self._consecutive_failures >= self._AUDIO_FAIL_THRESHOLD
                    )
                    self._consecutive_failures = 0
                if self._audio and was_failing:
                    self._audio.on_failure_count_changed(0)
                if first_success and self._state_machine.state == EngineState.WARMING_UP:
                    try:
                        self._state_machine.transition(EngineState.TRACKING)
                    except InvalidTransitionError:
                        logger.info(
                            "Cannot transition to TRACKING — solver exiting"
                        )
                        return
                    first_success = False
                logger.debug(
                    "Solve: RA=%.3f Dec=%.3f M=%d P=%.4f",
                    result["RA"],
                    result["Dec"],
                    result["Matches"],
                    result["Prob"],
                )
            else:
                self._pointing.clear_centroids()
                with self._lock:
                    self._consecutive_failures += 1
                    new_count = self._consecutive_failures
                if self._audio and new_count == self._AUDIO_FAIL_THRESHOLD:
                    self._audio.on_failure_count_changed(new_count)
                if result.get("RA") is not None:
                    logger.debug(
                        "Solve rejected: M=%d P=%.4f",
                        result.get("Matches", 0),
                        result.get("Prob", 0),
                    )
