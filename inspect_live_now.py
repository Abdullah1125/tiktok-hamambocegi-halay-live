import asyncio
import base64
import io
import json
import os
import sys

import httpx
from playwright.async_api import async_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

SHOT_PATH = (
    r"C:\Users\pc\.gemini\antigravity\brain\47617e3f-4006-4cf7-8a85-0491c3457aa2\v42_live_stream_inspect.png"
)


async def main():
    async with httpx.AsyncClient(timeout=10.0) as client:
        st = (await client.get("http://127.0.0.1:9944/api/status")).json()
    print(
        "API_STATUS:",
        json.dumps(
            {
                "connected": st.get("connected"),
                "watching": st.get("watching"),
                "username": st.get("username"),
                "room_id": st.get("room_id"),
                "viewer_count": st.get("viewer_count"),
                "seat_count": st.get("seat_count"),
                "max_seats": st.get("max_seats"),
                "queue_count": st.get("queue_count"),
                "total_likes": st.get("total_likes"),
                "total_comments": st.get("total_comments"),
                "total_gifts": st.get("total_gifts"),
                "halaybasi": (st.get("halaybasi") or {}).get("nickname"),
                "gelin": (st.get("gelin") or {}).get("nickname"),
                "damat": (st.get("damat") or {}).get("nickname"),
                "lang_scores": st.get("lang_scores"),
                "note": st.get("note"),
            },
            ensure_ascii=False,
        ),
    )

    page_errors = []
    console_errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--enable-webgl", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"],
        )
        ctx = await browser.new_context(viewport={"width": 540, "height": 960}, device_scale_factor=2)
        page = await ctx.new_page()
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

        await page.goto("http://127.0.0.1:9944/?obs=1&mode=916&dikey=1", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_function(
            "() => Boolean(document.getElementById('halay-cinema-hud') && window.__halayTopDock)",
            timeout=25000,
        )
        await asyncio.sleep(3.5)

        snap = await page.evaluate(
            """() => ({
                sdkSrc: (Array.from(document.querySelectorAll('script[src]')).find(s => s.src.includes('local_sdk.js')) || {}).src || '',
                goalPill: document.getElementById('htd-goal-pill')?.textContent || '',
                roundPill: document.getElementById('ch-round-pill')?.textContent || '',
                audioTxt: document.getElementById('ch-audio-txt')?.textContent || '',
                subLine: document.querySelector('#halay-dj-subtitle #djs-line')?.textContent || '',
                dancersOnCanvas: window.halay?.line?.dancers?.length || 0,
                seatCount: window.__halayTopDock?.seatCount || 0,
                maxSeats: window.__halayTopDock?.maxSeats || 0,
                queueCount: window.__halayTopDock?.queueCount || 0,
            })"""
        )
        snap["page_errors"] = page_errors
        snap["console_errors"] = console_errors[:5]
        print("LIVE_HUD_SNAP:", json.dumps(snap, ensure_ascii=False))

        await page.evaluate("() => { if (window.halay?.engine?.stop) window.halay.engine.stop(); }")
        await asyncio.sleep(0.25)
        cdp = await ctx.new_cdp_session(page)
        shot = await cdp.send("Page.captureScreenshot", {"format": "png"})
        with open(SHOT_PATH, "wb") as f:
            f.write(base64.b64decode(shot["data"]))
        print(f"SHOT_SAVED: {SHOT_PATH} ({os.path.getsize(SHOT_PATH)} bytes)")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
