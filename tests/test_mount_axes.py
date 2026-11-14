"""Two-stroke mount calibration tests; no telescope or camera required."""

import pytest

from evf.config.manager import ConfigManager
from evf.engine.frame_buffer import LatestFrame
from evf.engine.pointing import PointingState
from evf.engine.state import EngineState, StateMachine
from evf.solver.thread import SolverThread


def calibration(tmp_path):
    config = ConfigManager(config_dir=tmp_path)
    state = StateMachine()
    state.transition(EngineState.SYNC)
    state.transition(EngineState.SYNC_CONFIRM)
    state.transition(EngineState.CALIBRATE)
    thread = SolverThread(None, LatestFrame(), PointingState(), state, config)
    return thread, state, config


def settle(thread, ra, dec):
    # The first solve registers a move; the second starts the steady timer.
    assert not thread._check_calibration(ra, dec, 0.0)
    assert not thread._check_calibration(ra, dec, 0.0)
    thread._cal_stable_since -= 2.0
    return thread._check_calibration(ra, dec, 0.0)


def test_up_then_right_calibration_persists_axes(tmp_path):
    thread, state, config = calibration(tmp_path)
    assert not settle(thread, 0.0, 1.0)
    assert state.state is EngineState.CALIBRATE
    assert thread.calibration_status == {"phase": "right", "error": None}
    assert config.mount_axes is None

    assert settle(thread, 1.0, 1.0)
    assert state.state is EngineState.WARMING_UP
    assert config.mount_axes is not None
    assert config.mount_axes["up"] == pytest.approx([0.0, 1.0], abs=0.01)
    assert config.mount_axes["right"] == pytest.approx([-1.0, 0.0], abs=0.01)

    reloaded = ConfigManager(config_dir=tmp_path)
    assert reloaded.mount_axes == config.mount_axes


def test_parallel_right_stroke_is_rejected_and_can_be_retried(tmp_path):
    thread, state, config = calibration(tmp_path)
    assert not settle(thread, 0.0, 1.0)
    assert not settle(thread, 0.0, 2.0)
    assert state.state is EngineState.CALIBRATE
    assert config.mount_axes is None
    assert "perpendicular" in thread.calibration_status["error"]

    assert settle(thread, 1.0, 2.0)
    assert state.state is EngineState.WARMING_UP
    assert thread.calibration_status["error"] is None
    assert config.mount_axes is not None


def test_skip_without_axes_does_not_pretend_to_offer_push_directions(tmp_path):
    thread, state, config = calibration(tmp_path)
    thread.skip_calibrate()
    assert thread._check_calibration(0.0, 0.0, 0.0)
    assert state.state is EngineState.WARMING_UP
    assert config.mount_axes is None


def test_corrupt_mount_axes_do_not_load_as_valid(tmp_path):
    config = ConfigManager(config_dir=tmp_path)
    config.mount_axes = {"up": [1.0, 0.0], "right": [1.0, 0.0]}
    assert config.mount_axes is None
    config.mount_axes = {"up": [0.0, 1.0], "right": [float("nan"), 0.0]}
    assert config.mount_axes is None
