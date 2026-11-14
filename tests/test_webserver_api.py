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

"""Tests for POST /api/* action endpoints."""

import io
import json
import threading
from zipfile import ZIP_DEFLATED, ZipFile
from unittest.mock import MagicMock

import pytest
from aiohttp import ClientSession

from evf.config.manager import ConfigManager
from evf.engine.frame_buffer import LatestFrame
from evf.engine.goto_target import GotoTarget
from evf.engine.pointing import PointingState
from evf.engine.state import StateMachine
from evf.webserver import bafk
from evf.webserver.server import WebServer


@pytest.fixture
def server_and_actions(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    cfg = ConfigManager(config_dir=tmp_path / "evf-config")
    cfg._data["webserver"]["port"] = 0  # ephemeral; bypasses validator
    actions = MagicMock()
    ws = WebServer(
        PointingState(), StateMachine(), GotoTarget(), cfg,
        frame_buffer=LatestFrame(),
        actions=actions,
    )
    ws.start()
    for _ in range(20):
        if ws._port is not None:
            break
        threading.Event().wait(0.05)
    yield ws, actions
    ws.stop()


@pytest.mark.asyncio
async def test_wizard_advance(server_and_actions):
    ws, actions = server_and_actions
    async with ClientSession() as s:
        async with s.post(f"http://127.0.0.1:{ws._port}/api/wizard/advance") as resp:
            assert resp.status == 204
    actions.step_advance.assert_called_once()


@pytest.mark.asyncio
async def test_sync_select_with_idx(server_and_actions):
    ws, actions = server_and_actions
    async with ClientSession() as s:
        async with s.post(f"http://127.0.0.1:{ws._port}/api/sync/select", json={"idx": 2}) as resp:
            assert resp.status == 204
    actions.set_sync_selected.assert_called_once_with(2)


@pytest.mark.asyncio
async def test_set_control(server_and_actions):
    ws, actions = server_and_actions
    async with ClientSession() as s:
        async with s.post(f"http://127.0.0.1:{ws._port}/api/control",
                          json={"name": "exposure", "value": 42}) as resp:
            assert resp.status == 204
    actions.set_control.assert_called_once_with("exposure", 42)


@pytest.mark.asyncio
async def test_goto_set_with_ra_dec(server_and_actions):
    ws, actions = server_and_actions
    async with ClientSession() as s:
        async with s.post(
            f"http://127.0.0.1:{ws._port}/api/goto/set",
            json={"ra_deg": 79.1723, "dec_deg": 45.998},
        ) as resp:
            assert resp.status == 204
    actions.set_goto_target.assert_called_once_with(79.1723, 45.998)


@pytest.mark.asyncio
async def test_settings_audio(server_and_actions):
    ws, actions = server_and_actions
    async with ClientSession() as s:
        async with s.post(f"http://127.0.0.1:{ws._port}/api/settings",
                          json={"audio_enabled": False}) as resp:
            assert resp.status == 204
    actions.set_audio_enabled.assert_called_once_with(False)


@pytest.mark.asyncio
async def test_settings_lx200_epoch(server_and_actions):
    ws, actions = server_and_actions
    async with ClientSession() as s:
        async with s.post(f"http://127.0.0.1:{ws._port}/api/settings",
                          json={"lx200_epoch": "j2000"}) as resp:
            assert resp.status == 204
    actions.set_lx200_epoch.assert_called_once_with("j2000")


@pytest.mark.asyncio
async def test_actions_none_returns_503(tmp_path, monkeypatch):
    """When no actions are wired, POST /api/* returns 503 instead of 500."""
    monkeypatch.setenv("HOME", str(tmp_path))
    cfg = ConfigManager(config_dir=tmp_path / "evf-config")
    cfg._data["webserver"]["port"] = 0
    ws = WebServer(
        PointingState(), StateMachine(), GotoTarget(), cfg,
        frame_buffer=LatestFrame(),
        # NOTE: no actions= passed
    )
    ws.start()
    try:
        for _ in range(20):
            if ws._port is not None:
                break
            threading.Event().wait(0.05)
        async with ClientSession() as s:
            async with s.post(f"http://127.0.0.1:{ws._port}/api/wizard/advance") as resp:
                assert resp.status == 503
    finally:
        ws.stop()


@pytest.mark.asyncio
async def test_settings_returns_500_when_first_setter_raises(server_and_actions):
    """When set_audio_enabled raises, the response is 500 and later setters are NOT called."""
    ws, actions = server_and_actions
    actions.set_audio_enabled.side_effect = RuntimeError("boom")
    async with ClientSession() as s:
        async with s.post(
            f"http://127.0.0.1:{ws._port}/api/settings",
            json={"audio_enabled": False, "min_matches": 10},
        ) as resp:
            assert resp.status == 500
    actions.set_audio_enabled.assert_called_once_with(False)
    actions.set_min_matches.assert_not_called()


@pytest.mark.asyncio
async def test_settings_location(server_and_actions):
    ws, actions = server_and_actions
    async with ClientSession() as s:
        async with s.post(
            f"http://127.0.0.1:{ws._port}/api/settings",
            json={"location": {"latitude": 13.0878, "longitude": 80.2785}},
        ) as resp:
            assert resp.status == 204
    actions.set_location.assert_called_once_with(13.0878, 80.2785)


@pytest.mark.asyncio
async def test_settings_location_clear(server_and_actions):
    ws, actions = server_and_actions
    async with ClientSession() as s:
        async with s.post(
            f"http://127.0.0.1:{ws._port}/api/settings",
            json={"location": None},
        ) as resp:
            assert resp.status == 204
    actions.set_location.assert_called_once_with(None, None)


@pytest.mark.asyncio
async def test_bafk_local_import_search_and_images(server_and_actions, monkeypatch):
    ws, _actions = server_and_actions
    monkeypatch.setattr(bafk, "EXPECTED_OBJECTS", 1)
    monkeypatch.setattr(bafk, "EXPECTED_IMAGES", 1)
    entry = {
        "id": "p004-00", "name": "M 31", "constellation": "And",
        "ra_deg": 10.684, "dec_deg": 41.269,
        "aperture": "FG", "filter": "--", "type": "Gx",
        "page": 4, "description": "Andromeda", "images": ["p004-00.jpg"],
    }
    data = io.BytesIO()
    with ZipFile(data, "w", ZIP_DEFLATED) as archive:
        archive.writestr("catalog.json", json.dumps([entry]))
        archive.writestr("atlas.pdf", b"%PDF-1.6")
        archive.writestr("images/p004-00.jpg", b"sample image")
    base = f"http://127.0.0.1:{ws._port}"
    async with ClientSession() as session:
        async with session.get(f"{base}/api/bafk") as response:
            assert response.status == 200
            assert await response.json() == []
        async with session.post(
            f"{base}/api/bafk/import", data=data.getvalue(),
            headers={"Content-Type": "application/zip"},
        ) as response:
            assert response.status == 200
            assert await response.json() == {"objects": 1, "images": 1}
        async with session.get(f"{base}/api/bafk") as response:
            assert response.status == 200
            assert (await response.json())[0]["name"] == "M 31"
        async with session.get(f"{base}/api/bafk/images/p004-00.jpg") as response:
            assert response.status == 200
            assert await response.read() == b"sample image"
        async with session.get(f"{base}/api/bafk/atlas") as response:
            assert response.status == 200
            assert (await response.read()).startswith(b"%PDF-")


@pytest.mark.asyncio
async def test_solar_system_search_and_goto(server_and_actions):
    ws, actions = server_and_actions
    ws._config.location = (52.5, 13.4)
    base = f"http://127.0.0.1:{ws._port}"
    async with ClientSession() as session:
        async with session.get(
            f"{base}/api/solar-system?at=2026-11-14T20:00:00Z",
        ) as response:
            assert response.status == 200
            objects = {entry["id"]: entry for entry in await response.json()}
            assert objects["saturn"]["ra_deg"] is not None
            assert objects["moon"]["topocentric"] is True

        async with session.post(
            f"{base}/api/goto/solar-system", json={"id": "saturn"},
        ) as response:
            assert response.status == 204
            ra, dec = actions.set_goto_target.call_args.args
            assert 0 <= ra < 360
            assert -90 <= dec <= 90

        async with session.post(
            f"{base}/api/goto/solar-system", json={"id": "earth"},
        ) as response:
            assert response.status == 400
            assert "not observable" in (await response.text()).lower()
        assert actions.set_goto_target.call_count == 1


@pytest.mark.asyncio
async def test_moon_requires_observing_location_and_invalid_time_rejected(server_and_actions):
    ws, actions = server_and_actions
    base = f"http://127.0.0.1:{ws._port}"
    async with ClientSession() as session:
        async with session.post(
            f"{base}/api/goto/solar-system", json={"id": "moon"},
        ) as response:
            assert response.status == 400
            assert "location" in (await response.text()).lower()
        async with session.get(
            f"{base}/api/solar-system?at=invalid",
        ) as response:
            assert response.status == 400
    actions.set_goto_target.assert_not_called()
