"""Hardware-free simulator: frame cadence, position changes, and validation."""

import io
import time

import pytest
from PIL import Image

from evf.engine.frame_buffer import LatestFrame
from evf.engine.pointing import PointingState
from evf.engine.simulator import SimulatedTelescope
from evf.engine.state import EngineState, StateMachine


def test_simulator_starts_tracking_and_streams_jpeg_without_solver():
    frames, pointing, states = LatestFrame(), PointingState(), StateMachine()
    sim = SimulatedTelescope(frames, pointing, states)
    sim.start()
    try:
        assert sim.running
        assert states.state is EngineState.TRACKING
        first, _, frame_id = frames.get()
        assert first.startswith(b"\xff\xd8")
        assert Image.open(io.BytesIO(first)).size == (1280, 720)
        assert pointing.read().valid
        assert pointing.read().matches == 0
        time.sleep(0.25)
        assert frames.get()[2] > frame_id
        assert time.monotonic() - pointing.read().last_success_timestamp < 0.3
    finally:
        sim.stop()
    assert not sim.running


def test_simulator_moves_pointing_and_camera_image():
    frames, pointing, states = LatestFrame(), PointingState(), StateMachine()
    sim = SimulatedTelescope(frames, pointing, states)
    sim.start()
    try:
        first = frames.get()[0]
        sim.move(1.0, -2.0)
        time.sleep(0.2)
        snap = pointing.read()
        assert snap.ra_j2000 == pytest.approx(80.1723)
        assert snap.dec_j2000 == pytest.approx(43.998)
        assert frames.get()[0] != first
        sim.move(360.0, 180.0)
        time.sleep(0.15)
        snap = pointing.read()
        assert snap.ra_j2000 == pytest.approx(80.1723)
        assert snap.dec_j2000 == 90.0
    finally:
        sim.stop()


@pytest.mark.parametrize("dra,ddec", [(float("nan"), 0), (0, float("inf")), (361, 0), (0, -181)])
def test_simulator_rejects_invalid_moves(dra, ddec):
    sim = SimulatedTelescope(LatestFrame(), PointingState(), StateMachine())
    with pytest.raises(ValueError, match="Invalid simulated movement"):
        sim.move(dra, ddec)
