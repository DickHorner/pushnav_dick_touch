"""Tests for /ws JSON payload schema."""

import json

import pytest

from evf.config.manager import ConfigManager
from evf.engine.frame_buffer import LatestFrame
from evf.engine.goto_target import GotoTarget
from evf.engine.pointing import PointingState
from evf.engine.state import StateMachine
from evf.webserver.server import WebServer


def test_payload_contains_new_fields(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    ws = WebServer(
        PointingState(), StateMachine(), GotoTarget(), ConfigManager(config_dir=tmp_path / "evf-config"),
        frame_buffer=LatestFrame(),
        camera_controls=lambda: [
            {"id": "exposure", "label": "Exposure", "min": 0, "max": 100, "step": 1, "value": 50, "unit": "ms"},
        ],
        sync_state=lambda: {
            "in_progress": False, "candidates": [], "selected_idx": None, "error": None,
        },
        activity=lambda: {
            "stellarium": {"active": False, "address": "localhost:10001"},
            "lx200":      {"active": False, "address": "0.0.0.0:4030"},
            "webserver":  {"url": "http://192.168.1.42:8765"},
            "audio_enabled": True,
        },
    )
    payload = ws._build_payload()
    # Existing fields still present
    assert "state" in payload
    assert "pointing" in payload
    # New fields
    assert "controls" in payload and isinstance(payload["controls"], list)
    assert "sync" in payload and "in_progress" in payload["sync"]
    assert "stellarium" in payload and "active" in payload["stellarium"]
    assert "lx200" in payload
    assert "webserver" in payload
    assert "audio_enabled" in payload
    assert "camera" in payload  # centroid arrays
    # Roundtrip JSON-serializable
    assert json.dumps(payload)


def test_payload_contains_location_field(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    cfg = ConfigManager(config_dir=tmp_path / "evf-config")
    ws = WebServer(
        PointingState(), StateMachine(), GotoTarget(), cfg,
        frame_buffer=LatestFrame(),
        location=lambda: {
            "latitude": 13.0878,
            "longitude": 80.2785,
            "source": "manual",
        },
    )
    payload = ws._build_payload()
    assert "location" in payload
    assert payload["location"]["source"] == "manual"
    assert payload["location"]["latitude"] == 13.0878


def test_push_arrow_uses_mount_axes_not_target_camera_pixel(tmp_path):
    cfg = ConfigManager(config_dir=tmp_path / "evf-config")
    cfg.mount_axes = {"right": [-1.0, 0.0], "up": [0.0, 1.0]}
    pointing = PointingState()
    pointing.update(0.0, 0.0, 0.0, 10, 0.01)
    target = GotoTarget()
    target.set(5.0, 0.0)  # celestial east = image left with roll=0
    ws = WebServer(pointing, StateMachine(), target, cfg)
    nav = ws._build_payload()["nav"]

    assert nav["pixel_x"] < 0
    assert nav["mount_right_deg"] > 0
    assert abs(nav["mount_up_deg"]) < 0.01
    assert nav["edge_angle_deg"] == pytest.approx(90.0, abs=0.1)
    assert "R" in nav["direction_text"]

    cfg.mount_axes = None
    uncalibrated = ws._build_payload()["nav"]
    assert uncalibrated["pixel_x"] < 0
    assert uncalibrated["edge_angle_deg"] is None
    assert uncalibrated["mount_right_deg"] is None
    assert uncalibrated["direction_text"] == "Mount axes not calibrated"


def test_previous_calibration_requires_saved_mount_axes(tmp_path):
    cfg = ConfigManager(config_dir=tmp_path / "evf-config")
    cfg.sync_d_body = [0.0, 0.0, 1.0]
    server = WebServer(PointingState(), StateMachine(), GotoTarget(), cfg)
    assert not server._build_payload()["has_calibration"]

    cfg.mount_axes = {"up": [0.0, 1.0], "right": [-1.0, 0.0]}
    assert server._build_payload()["has_calibration"]
