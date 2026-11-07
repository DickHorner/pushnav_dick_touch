"""Simulated pointing API and payload; no camera or solver required."""

import threading
from unittest.mock import MagicMock

import pytest
from aiohttp import ClientSession

from evf.config.manager import ConfigManager
from evf.engine.frame_buffer import LatestFrame
from evf.engine.goto_target import GotoTarget
from evf.engine.pointing import PointingState
from evf.engine.state import StateMachine
from evf.webserver.server import WebServer


def _make_server(tmp_path, sim_mode, actions=None):
    cfg = ConfigManager(config_dir=tmp_path)
    cfg._data["webserver"]["port"] = 0
    server = WebServer(
        PointingState(), StateMachine(), GotoTarget(), cfg,
        frame_buffer=LatestFrame(), sim_mode=sim_mode, actions=actions,
    )
    server.start()
    for _ in range(30):
        if server._port is not None:
            break
        threading.Event().wait(0.05)
    return server


@pytest.mark.asyncio
async def test_sim_move_endpoint(tmp_path):
    actions = MagicMock()
    server = _make_server(tmp_path, True, actions)
    try:
        async with ClientSession() as session:
            async with session.post(
                f"http://127.0.0.1:{server._port}/api/dev/sim/move",
                json={"delta_ra_deg": 1.0, "delta_dec_deg": -0.5},
            ) as resp:
                assert resp.status == 204
        actions.sim_move.assert_called_once_with(1.0, -0.5)
    finally:
        server.stop()


@pytest.mark.asyncio
@pytest.mark.parametrize("body", [
    {"delta_ra_deg": 361, "delta_dec_deg": 0},
    {"delta_ra_deg": 0, "delta_dec_deg": "nan"},
    {"delta_ra_deg": 0},
    [],
])
async def test_sim_move_rejects_bad_input(tmp_path, body):
    actions = MagicMock()
    server = _make_server(tmp_path, True, actions)
    try:
        async with ClientSession() as session:
            async with session.post(
                f"http://127.0.0.1:{server._port}/api/dev/sim/move", json=body,
            ) as resp:
                assert resp.status == 400
        actions.sim_move.assert_not_called()
    finally:
        server.stop()


@pytest.mark.asyncio
async def test_sim_move_unavailable_in_real_mode(tmp_path):
    actions = MagicMock()
    server = _make_server(tmp_path, False, actions)
    try:
        async with ClientSession() as session:
            async with session.post(
                f"http://127.0.0.1:{server._port}/api/dev/sim/move",
                json={"delta_ra_deg": 1, "delta_dec_deg": 0},
            ) as resp:
                assert resp.status == 404
        actions.sim_move.assert_not_called()
    finally:
        server.stop()


def test_sim_payload_ignores_real_calibration(tmp_path):
    cfg = ConfigManager(config_dir=tmp_path)
    cfg.sync_d_body = [0.02, 0.01, 0.99]
    cfg.finder_rotation = 150.0
    pointing = PointingState()
    pointing.update(79.1723, 45.998, 0.0, 0, 0.0)
    server = WebServer(
        pointing, StateMachine(), GotoTarget(), cfg,
        frame_buffer=LatestFrame(), sim_mode=True,
    )
    payload = server._build_payload()
    assert payload["sim_mode"] is True
    assert payload["origin_x"] == 640
    assert payload["origin_y"] == 360
    assert payload["finder_rotation"] == 0
    assert payload["has_calibration"] is False
    assert payload["pointing"]["valid"] is True
