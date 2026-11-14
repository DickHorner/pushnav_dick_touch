"""Tests for automatic plate-solve stall diagnostics."""

import logging
import threading
import time

from evf.config.manager import ConfigManager
from evf.engine.frame_buffer import LatestFrame
from evf.engine.goto_target import GotoTarget
from evf.engine.pointing import PointingState
from evf.engine.state import EngineState, StateMachine
from evf.solver.thread import SolverThread
from evf.webserver.server import WebServer


def _make_webserver(tmp_path):
    state = StateMachine()
    pointing = PointingState()
    frames = LatestFrame()
    server = WebServer(
        pointing, state, GotoTarget(), ConfigManager(config_dir=tmp_path),
        frame_buffer=frames,
        solver_failures=lambda: 3,
        solver_activity=lambda: (True, 109.0),
    )
    return server, state, pointing, frames


def test_solver_health_logs_frame_and_thread_activity(tmp_path, caplog):
    server, state, _, frames = _make_webserver(tmp_path)
    state._state = EngineState.WARMING_UP
    frames.set(b"jpeg", 109.0, 42)

    with caplog.at_level(logging.WARNING, logger="evf.webserver.server"):
        server._log_solver_health(100.0)
        server._log_solver_health(109.9)
        assert not caplog.records

        server._log_solver_health(111.0)
        assert len(caplog.records) == 1
        message = caplog.records[0].message
        assert "No valid plate solve for 11.0s" in message
        assert "solver_alive=True" in message
        assert "last_attempt_start_age=2.0s" in message
        assert "last_success_age=never" in message
        assert "frame_age=2.0s frame_id=42" in message
        assert "consecutive_failures=3" in message

        server._log_solver_health(112.0)
        assert len(caplog.records) == 1
        server._log_solver_health(141.0)
        assert len(caplog.records) == 2


def test_solver_health_resets_on_success_and_tracking_stop(tmp_path, caplog):
    server, state, pointing, _ = _make_webserver(tmp_path)
    state._state = EngineState.TRACKING

    with caplog.at_level(logging.WARNING, logger="evf.webserver.server"):
        server._log_solver_health(100.0)
        pointing._last_success_timestamp = 108.0
        server._log_solver_health(111.0)
        assert not caplog.records

        server._log_solver_health(119.0)
        assert len(caplog.records) == 1

        state._state = EngineState.SETUP
        server._log_solver_health(120.0)
        state._state = EngineState.TRACKING
        server._log_solver_health(130.0)
        server._log_solver_health(139.0)
        assert len(caplog.records) == 1
        server._log_solver_health(141.0)
        assert len(caplog.records) == 2


def test_solver_health_reports_dead_thread_and_missing_frames(tmp_path, caplog):
    server, state, _, _ = _make_webserver(tmp_path)
    server._solver_activity = lambda: (False, 0.0)
    state._state = EngineState.TRACKING

    with caplog.at_level(logging.WARNING, logger="evf.webserver.server"):
        server._log_solver_health(100.0)
        server._log_solver_health(111.0)

    message = caplog.records[0].message
    assert "solver_alive=False" in message
    assert "last_attempt_start_age=never" in message
    assert "frame_age=never frame_id=0" in message


class _RejectingSolver:
    def __init__(self):
        self.attempted = threading.Event()

    def solve_frame(self, _jpeg):
        self.attempted.set()
        return {"RA": None}

    @staticmethod
    def is_valid(_result, **_kwargs):
        return False


def test_solver_thread_records_attempt_start(tmp_path):
    solver = _RejectingSolver()
    frames = LatestFrame()
    state = StateMachine()
    state.transition(EngineState.SYNC)
    state.transition(EngineState.SYNC_CONFIRM)
    frames.set(b"jpeg", time.monotonic(), 1)
    thread = SolverThread(
        solver, frames, PointingState(), state, ConfigManager(config_dir=tmp_path),
    )
    assert not thread.running
    assert thread.last_attempt_timestamp == 0.0

    thread.start()
    try:
        assert solver.attempted.wait(timeout=2.0)
        assert thread.running
        assert thread.last_attempt_timestamp > 0.0
    finally:
        thread.stop()
    assert not thread.running
