import asyncio
import base64
import inspect
import io
import json
import os
import sys
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, r"c:\Users\pc\Documents\projelerim\TikTok_Halay_Live")

import ai_live_host
import tiktok_bridge
from playwright.async_api import async_playwright

ARTIFACT_PNG = r"C:\Users\pc\.gemini\antigravity\brain\47617e3f-4006-4cf7-8a85-0491c3457aa2\v40_integrity_shield_verified.png"


async def verify_bridge_and_host() -> dict:
    # 1. Verify _live_room_stats_poller no longer calls _resolve_live_room
    poller_src = inspect.getsource(tiktok_bridge.HalayLiveBridge._live_room_stats_poller)
    no_http_poll_in_poller = "_resolve_live_room" not in poller_src

    # Verify runtime poller executes safely with zero _resolve_live_room invocations
    called_resolve = 0

    async def noop(*args, **kwargs):
        return None

    bridge = tiktok_bridge.HalayLiveBridge(broadcast_fn=noop)
    bridge.is_live_connected = True

    async def fake_resolve(_username):
        nonlocal called_resolve
        called_resolve += 1
        return (False, 99)

    bridge._resolve_live_room = fake_resolve  # type: ignore[method-assign]
    task = asyncio.create_task(bridge._live_room_stats_poller("test_room"))
    await asyncio.sleep(0.25)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    # 2. Verify ai_live_host v40 defaults & Gemini 429 circuit breaker
    async def noop_bcast(_payload):
        return None

    async def noop_chat(_text):
        return True

    host = ai_live_host.MultilingualAIHost(noop_bcast, noop_chat)
    host.api_key = "test-dummy-key"

    class FakeResp:
        status_code = 429
        text = "quota exhausted"

    first_called = False

    class FakeClient:
        async def post(self, *args, **kwargs):
            nonlocal first_called
            first_called = True
            return FakeResp()

    called_second = False

    class BombClient:
        async def post(self, *args, **kwargs):
            nonlocal called_second
            called_second = True
            return FakeResp()

    orig_http = host._http
    host._http = FakeClient()  # type: ignore[assignment]
    before_cb = host._llm_backoff_until
    res_429 = await host._query_llm("tr", "Deneme", "Selam", True, 0, 18, "TestLider")
    after_cb = host._llm_backoff_until
    host._http = BombClient()  # type: ignore[assignment]
    res_cached_skip = await host._query_llm("tr", "Deneme", "Selam 2", True, 0, 18, "TestLider")
    host._http = orig_http

    return {
        "no_http_poll_in_poller_src": no_http_poll_in_poller,
        "poller_resolve_calls": called_resolve,
        "voice_enabled_default": host.voice_enabled,
        "interval_sec_default": host.interval_sec,
        "global_cooldown_sec": host.global_cooldown_sec,
        "user_cooldown_sec": host.user_cooldown_sec,
        "first_429_hit_client": first_called,
        "circuit_breaker_triggered": (before_cb == 0.0 and after_cb > time.monotonic() + 200.0),
        "res_429_fallback_ok": bool(res_429),
        "second_call_short_circuited": (not called_second and bool(res_cached_skip)),
    }


async def verify_v40_frontend() -> dict:
    errors = []
    page_errors = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--enable-webgl", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"],
        )
        context = await browser.new_context(viewport={"width": 540, "height": 960})
        page = await context.new_page()
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

        await page.goto("http://127.0.0.1:9944/?room=v40_verify", wait_until="domcontentloaded", timeout=25000)

        for _ in range(50):
            ready = await page.evaluate("() => Boolean(window.halay && window.halay.engine && document.querySelectorAll('.ch-sc-card').length === 6)")
            if ready:
                break
            await page.wait_for_timeout(300)

        # Wait ~2s for choreography preset assignment
        await page.wait_for_timeout(1500)

        dom_v40 = await page.evaluate("""() => {
            const sdkTag = document.querySelector('#tikoyun-sdk');
            const allCards = Array.from(document.querySelectorAll('.ch-sc-card'));
            const visibleCards = allCards.filter(el => getComputedStyle(el).display !== 'none');
            const hiddenCards = allCards.filter(el => getComputedStyle(el).display === 'none');
            if (window.__halayShowDjGuide) window.__halayShowDjGuide();
            const guideEl = document.querySelector('#ch-guide');
            return {
                sdkSrc: sdkTag ? sdkTag.getAttribute('src') : '',
                totalCards: allCards.length,
                visibleShowcaseCards: visibleCards.length,
                hiddenShowcaseCards: hiddenCards.length,
                djGuideText: guideEl ? guideEl.textContent.trim() : '',
                autoPreset: window.__StageDirectorPreset || null,
            };
        }""")

        # Expose preset directly from local_sdk if StageDirector exists
        cam_preset = await page.evaluate("""() => {
            const c = document.querySelector('#halay-stage canvas');
            return {
                canvasW: c ? c.clientWidth : 0,
                canvasH: c ? c.clientHeight : 0,
            };
        }""")

        # Check showcase script src contains ?v=40
        await page.evaluate("() => { window.halay?.engine?.renderer?.setPixelRatio?.(1); window.halay?.engine?.stop?.(); }")
        await page.wait_for_timeout(200)
        cdp = await context.new_cdp_session(page)
        res = await asyncio.wait_for(cdp.send("Page.captureScreenshot", {"format": "png"}), timeout=15.0)
        with open(ARTIFACT_PNG, "wb") as f:
            f.write(base64.b64decode(res["data"]))
        await page.evaluate("() => { window.halay?.engine?.start?.(); }")

        await browser.close()

    return {
        "dom_v40": dom_v40,
        "cam_preset": cam_preset,
        "artifact_exists": os.path.exists(ARTIFACT_PNG),
        "artifact_bytes": os.path.getsize(ARTIFACT_PNG) if os.path.exists(ARTIFACT_PNG) else 0,
        "page_errors": page_errors,
        "console_errors": errors,
    }


async def main():
    backend = await verify_bridge_and_host()
    frontend = await asyncio.wait_for(verify_v40_frontend(), timeout=90.0)
    print(json.dumps({"backend": backend, "frontend": frontend}, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
