# -*- coding: utf-8 -*-
import asyncio
import io
import json
import sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import httpx
from playwright.async_api import async_playwright

from ai_live_host import _SOLICITATION_BAN_RE
from jukebox_service import HalayJukeboxService
from tiktok_bridge import HalayLiveBridge

ART_DIR = Path(r"C:\Users\pc\.gemini\antigravity\brain\47617e3f-4006-4cf7-8a85-0491c3457aa2")
SHOT_PATH = ART_DIR / "v39_multilang_dj_verified.png"


async def verify_unit_logic() -> dict:
    emitted = []

    async def cap(payload):
        emitted.append(payload)

    jukebox = HalayJukeboxService(cap)
    bridge = HalayLiveBridge(cap)
    bridge._save_active_room_state = lambda: None
    await bridge.reset_state()
    bridge._save_active_room_state = lambda: None
    bridge.user_cmd_cooldowns.clear()
    bridge.jukebox_request_fn = jukebox.request_by_query

    # 1. Free user stays gated unless open_multilang_dj is enabled
    u_free = {"uid": "u_free_ru", "nickname": "FreeIvan", "avatar": ""}
    await bridge.process_chat(u_free, "!трек")
    locked_pkts = [e for e in emitted if e.get("type") == "dj_locked" and (e.get("user") or {}).get("uid") == "u_free_ru"]
    free_blocked = len(locked_pkts) == 1

    # 2. VIP Russian user sends bare !трек -> resolves & plays Russian track
    u_ru = {"uid": "u_vip_ru", "nickname": "IvanRU", "avatar": ""}
    bridge.dancer_vip.add("u_vip_ru")
    await bridge.process_chat(u_ru, "!трек")
    play_ru_bare = [e for e in emitted if e.get("type") == "jukebox_play" and e.get("requested_by") == "IvanRU"]

    # 3. VIP Russian user sends !трек Калинка -> searches/caches Kalinka or falls back cleanly
    bridge.user_cmd_cooldowns.pop("u_vip_ru", None)
    await bridge.process_chat(u_ru, "!трек Калинка")
    play_ru_query = [e for e in emitted if e.get("type") == "jukebox_play" and e.get("requested_by") == "IvanRU"]

    # 4. VIP English & Arabic commands
    u_en = {"uid": "u_vip_en", "nickname": "AlexEN", "avatar": ""}
    bridge.dancer_vip.add("u_vip_en")
    await bridge.process_chat(u_en, "!song Balkan")
    play_en = [e for e in emitted if e.get("type") == "jukebox_play" and e.get("requested_by") == "AlexEN"]

    u_ar = {"uid": "u_vip_ar", "nickname": "TariqAR", "avatar": ""}
    bridge.dancer_vip.add("u_vip_ar")
    await bridge.process_chat(u_ar, "!أغنية")
    play_ar = [e for e in emitted if e.get("type") == "jukebox_play" and e.get("requested_by") == "TariqAR"]

    # 5. Send chat anti-ban scrubber + bot_chat_reply event
    await bridge.send_chat_message("Merhaba dostlar hediye veya jeton yok, sadece müzik ve dans!")
    bot_pkts = [e for e in emitted if e.get("type") == "bot_chat_reply"]
    last_bot_txt = bot_pkts[-1]["text"] if bot_pkts else ""
    scrub_ok = bool(last_bot_txt) and not _SOLICITATION_BAN_RE.search(last_bot_txt)

    return {
        "free_dj_blocked": free_blocked,
        "ru_bare_played": len(play_ru_bare) >= 1,
        "ru_bare_title": (play_ru_bare[-1].get("current") or {}).get("title") if play_ru_bare else "",
        "ru_query_played": len(play_ru_query) >= 2,
        "ru_query_title": (play_ru_query[-1].get("current") or {}).get("title") if play_ru_query else "",
        "en_played": len(play_en) >= 1,
        "ar_played": len(play_ar) >= 1,
        "bot_chat_scrub_ok": scrub_ok,
        "bot_chat_text": last_bot_txt,
    }


async def verify_live_server_and_hud() -> dict:
    async with httpx.AsyncClient(timeout=25.0) as client:
        # Poll health
        for _ in range(15):
            try:
                r = await client.get("http://127.0.0.1:9944/api/ai/state")
                if r.status_code == 200:
                    break
            except Exception:
                await asyncio.sleep(0.5)

        st = (await client.get("http://127.0.0.1:9944/api/ai/state")).json()
        send_res = (await client.post(
            "http://127.0.0.1:9944/api/ai/send_chat",
            json={"text": "Hoş geldiniz! !istek veya !трек yazarak şarkı açabilirsiniz!", "lang": "tr", "speak": False},
        )).json()

        # Trigger Russian song request via HTTP endpoint
        dj_res = (await client.post(
            "http://127.0.0.1:9944/api/jukebox/request_multilang",
            json={"lang": "ru", "flag": "🇷🇺", "query": "Калинка", "nickname": "IvanRU"},
        )).json()

    page_errors = []
    console_errors = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--enable-webgl", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"],
        )
        ctx = await browser.new_context(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        page = await ctx.new_page()
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

        await page.goto("http://127.0.0.1:9944/?mode=916&dikey=1", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_function(
            "() => Boolean(document.getElementById('halay-cinema-hud') && window.__halayTopDock && window.__halayShowDjGuide)",
            timeout=25000,
        )
        await page.wait_for_timeout(1200)

        # Verify RU HUD language key + DJ banner + audio requester tag
        hud_checks = await page.evaluate(
            """() => {
              window.__halayLang.setDirectorMode('ru');
              window.__halayShowDjGuide();
              const djKeyRu = document.getElementById('ch-pl-dj-key')?.textContent || '';
              const audioTxt = document.getElementById('ch-audio-txt')?.textContent || '';
              const subText = document.getElementById('djs-line')?.textContent || '';
              const subOpen = document.getElementById('halay-dj-subtitle')?.classList.contains('is-open');

              window.__halayLang.setDirectorMode('en');
              const djKeyEn = document.getElementById('ch-pl-dj-key')?.textContent || '';

              window.__halayLang.setDirectorMode('ru');
              window.__halayShowDjGuide();
              window.halay?.engine?.renderer?.setPixelRatio?.(1);
              window.halay?.engine?.stop?.();
              return { djKeyRu, djKeyEn, audioTxt, subText, subOpen };
            }"""
        )

        # Also check /ai-panel renders cleanly with send_chat bar
        cdp = await ctx.new_cdp_session(page)
        shot = await cdp.send("Page.captureScreenshot", {"format": "png"})
        import base64
        SHOT_PATH.write_bytes(base64.b64decode(shot["data"]))

        await page.evaluate("() => window.halay?.engine?.start?.()")

        panel_page = await ctx.new_page()
        await panel_page.goto("http://127.0.0.1:9944/ai-panel", wait_until="domcontentloaded", timeout=20000)
        await panel_page.wait_for_timeout(600)
        panel_ok = await panel_page.evaluate(
            "() => Boolean(document.getElementById('manualChatInp') && document.getElementById('btnOpenDj') && document.getElementById('chatModeBadge'))"
        )
        await browser.close()

    return {
        "api_ai_state_ok": bool(st.get("ok")),
        "send_chat_ok": bool(send_res.get("ok")),
        "send_chat_text": send_res.get("text", ""),
        "dj_req_ok": bool(dj_res.get("ok")),
        "dj_current_title": ((dj_res.get("state") or {}).get("current") or {}).get("title", ""),
        "hud_checks": hud_checks,
        "panel_ok": panel_ok,
        "page_errors": page_errors,
        "console_errors": [c for c in console_errors if "404" not in c],
        "screenshot_bytes": SHOT_PATH.stat().st_size if SHOT_PATH.exists() else 0,
    }


async def main() -> None:
    unit = await verify_unit_logic()
    live = await verify_live_server_and_hud()
    out = {"unit": unit, "live": live}
    print(json.dumps(out, ensure_ascii=False, indent=2))
    assert unit["free_dj_blocked"], "free_dj_blocked failed"
    assert unit["ru_bare_played"], "ru_bare_played failed"
    assert unit["ru_query_played"], "ru_query_played failed"
    assert unit["en_played"], "en_played failed"
    assert unit["ar_played"], "ar_played failed"
    assert unit["bot_chat_scrub_ok"], "bot_chat_scrub_ok failed"
    assert live["api_ai_state_ok"], "api_ai_state_ok failed"
    assert live["send_chat_ok"], "send_chat_ok failed"
    assert live["dj_req_ok"], "dj_req_ok failed"
    assert live["panel_ok"], "panel_ok failed"
    assert '"!трек"' in live["hud_checks"]["djKeyRu"], f"djKeyRu bad: {live['hud_checks']}"
    assert '"!song"' in live["hud_checks"]["djKeyEn"], f"djKeyEn bad: {live['hud_checks']}"
    assert live["hud_checks"]["subOpen"], "dj subtitle banner not open"
    assert live["screenshot_bytes"] > 100000, "screenshot empty"
    assert not live["page_errors"], f"page_errors: {live['page_errors']}"


if __name__ == "__main__":
    asyncio.run(main())
