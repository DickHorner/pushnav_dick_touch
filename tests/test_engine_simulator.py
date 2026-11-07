"""Engine simulation never starts a camera or solver."""

import time

import pytest

from evf.config.manager import ConfigManager
from evf.engine.engine import Engine
from evf.engine.state import EngineState


def test_engine_simulation_starts_tracking_without_hardware(tmp_path):
    engine = Engine(sim_mode=True, config=ConfigManager(config_dir=tmp_path))
    engine.startup_simulator()
    try:
        assert engine.dev_mode
        assert engine.camera_connected
        assert engine.state_machine.state is EngineState.TRACKING
        assert engine._subprocess_mgr is None
        assert engine._solver is None
        assert engine._solver_thread is None
        assert engine.retry_camera()
        engine.step_advance()
        assert engine.state_machine.state is EngineState.TRACKING
        engine.inject_sample("a")
        assert engine.sample_injector.active_name is None
        engine.sim_move(1.0, -1.0)
        time.sleep(0.15)
        snap = engine.pointing_state.read()
        assert snap.ra_j2000 == pytest.approx(80.1723)
        assert snap.dec_j2000 == pytest.approx(44.998)
    finally:
        engine._simulator.stop()


def test_engine_simulator_cannot_start_in_real_mode(tmp_path):
    engine = Engine(config=ConfigManager(config_dir=tmp_path))
    with pytest.raises(RuntimeError, match="Simulation mode is not enabled"):
        engine.startup_simulator()
    with pytest.raises(RuntimeError, match="Simulator is not running"):
        engine.sim_move(1, 0)
