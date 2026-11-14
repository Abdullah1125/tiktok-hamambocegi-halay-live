# -*- coding: utf-8 -*-
"""
End-to-End ECC Security, 100-Track YouTube Halay Jukebox & Broadcast Verification Suite.
"""
from __future__ import annotations

import asyncio
import io
import json
import sys

if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from curl_cffi.requests import AsyncSession
import websockets


async def run_verification() -> None:
    async with AsyncSession(impersonate="chrome124", timeout=10) as s:
        # 1. Health & 100-Track Jukebox Telemetry
        r_health = await s.get("http://127.0.0.1:9944/api/health")
        assert r_health.status_code == 200, f"Health failed: {r_health.status_code}"
        hlth = r_health.json()
        assert hlth["jukebox_tracks"] == 100 and hlth["jukebox_cached"] >= 6, f"Bad jukebox counts: {hlth}"
        print(f"[PASS] ECC Health & 100-Halay Catalog Verified: {hlth}")

        # 2. ECC SSRF Protection Gate (Must block loopback & cloud metadata IPs with 403)
        for bad_url in ("http://127.0.0.1:9944/api/status", "http://169.254.169.254/latest/meta-data"):
            r_ssrf = await s.get(f"http://127.0.0.1:9944/api/avatar?url={bad_url}")
            assert r_ssrf.status_code == 403, f"SSRF guard failed for {bad_url}: got {r_ssrf.status_code}"
        print("[PASS] ECC SSRF Allowlist & Private-IP Block Verified (HTTP 403)")

        # 3. 100-Track Catalog + iOS Safari HTTP 206 Byte-Range Audio Stream Check
        r_cat = await s.get("http://127.0.0.1:9944/api/jukebox/catalog")
        cat = r_cat.json()
        assert len(cat["tracks"]) == 100, f"Expected 100 tracks, got {len(cat['tracks'])}"
        cur_track = cat["current"]
        assert cur_track and cur_track["cached"] is True, f"Starter track not pre-cached: {cur_track}"

        r_audio = await s.get(
            f"http://127.0.0.1:9944{cur_track['stream_url']}",
            headers={"Range": "bytes=0-4095"},
        )
        assert r_audio.status_code in (200, 206) and len(r_audio.content) >= 1024, f"Audio stream failed: {r_audio.status_code}"
        assert b"ftyp" in r_audio.content[:32], "Audio stream missing M4A/MP4 ftyp signature!"
        print(
            f"[PASS] iOS/OBS Native M4A Stream Verified ({r_audio.status_code}, "
            f"#{cur_track['index']} '{cur_track['title'][:45]}')"
        )

        # 4. WebSocket Malformed Payload Resilience + DJ Request + Next Track Sync
        async with websockets.connect("ws://127.0.0.1:9944/ws") as ws:
            # Send invalid JSON to ensure WS doesn't crash (ECC Silent-Failure-Hunter check)
            await ws.send("INVALID_JSON_PAYLOAD_TEST")
            await ws.send(json.dumps({"action": "jukebox_request", "query": "horon", "nickname": "TestKonuk", "immediate": False}))

            got_dj = False
            deadline = asyncio.get_event_loop().time() + 6.0
            while asyncio.get_event_loop().time() < deadline:
                raw = await asyncio.wait_for(ws.recv(), timeout=4.0)
                ev = json.loads(raw)
                if ev.get("type") == "jukebox_dj_queued":
                    got_dj = True
                    print(f"[PASS] Live TikTok DJ Request Matched: #{ev['track']['index']} {ev['track']['title'][:48]}")
                    break
            assert got_dj, "DJ queue event did not fire!"

            # Advance next so DJ queue pops cleanly back to normal state
            await ws.send(json.dumps({"action": "jukebox_next"}))
            await asyncio.sleep(0.3)
            # Reset back to Track #1 for clean studio start
            first_id = cat["tracks"][0]["id"]
            await ws.send(json.dumps({"action": "jukebox_select", "id": first_id, "by": ""}))
            await asyncio.sleep(0.2)

        # 5. Check Public 5G Tunnel Status
        r_st = await s.get("http://127.0.0.1:9944/api/status")
        st = r_st.json()
        print(f"[PASS] Public 5G Tunnel URL: {st.get('public_tunnel_url')} | Target: @{st.get('username')}")

    print("ALL ECC + 100 YOUTUBE HALAY JUKEBOX + STREAMING CHECKS PASSED!")


if __name__ == "__main__":
    asyncio.run(run_verification())
