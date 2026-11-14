import asyncio
import io
import json
import os
import re
import shutil
import sys
import tempfile

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SDK_PATH = r"c:\Users\pc\Documents\projelerim\Tikoyun_Unpacked\halay_web\local_sdk.js"
HTML_PATH = r"c:\Users\pc\Documents\projelerim\Tikoyun_Unpacked\halay_web\index_local.html"
STATE_PATH = os.path.join(BASE_DIR, "logs", "active_room_state.json")
SCREENSHOT_PATH = (
    r"C:\Users\pc\.gemini\antigravity\brain\47617e3f-4006-4cf7-8a85-0491c3457aa2\v41_live_hud_verified.png"
)

import ai_live_host
from tiktok_bridge import HalayLiveBridge
import verify_v38_shield


async def verify_v41_backend():
    print("\n=== [V41 Step 1] Language Detection & Bridge Economy Tests ===")
    lang_cases = {
        "me": "en",
        "meeee": "en",
        "girl": "en",
        "boy": "en",
        "yo": "es",
        "novia": "es",
    }
    lang_results = {}
    for txt, expected in lang_cases.items():
        got = ai_live_host.detect_message_language(txt)
        lang_results[txt] = got
        assert got == expected, f"detect_message_language({txt!r}) -> {got!r}, expected {expected!r}"
    print("LANG_DETECT_OK:", json.dumps(lang_results, ensure_ascii=False))

    events = []

    async def capture_bcast(msg):
        events.append(msg)

    bridge = HalayLiveBridge(capture_bcast)
    bridge._save_active_room_state = lambda: None
    await bridge.reset_state()
    bridge._save_active_room_state = lambda: None

    # 1. 1-coin Gül gift must NOT auto-join and must NOT assign VIP role
    events.clear()
    await bridge.process_gift(
        {"uid": "u_rose", "nickname": "RoseSpam", "avatar": ""},
        "Gül",
        1,
        gift_id=5655,
        diamond_unit=1,
    )
    rose_evts = [e for e in events if e.get("type") == "gift"]
    rose_role = rose_evts[0].get("vip_role", "") if rose_evts else ""
    assert "u_rose" not in bridge.joined_uids, f"1-coin gift unexpectedly joined: {rose_evts}"
    assert rose_role == "", f"1-coin gift got vip_role: {rose_evts}"

    # 2. Free join words: meeee, yo, Мен
    await bridge.process_chat({"uid": "u_me", "nickname": "MeUser", "avatar": ""}, "meeee")
    await bridge.process_chat({"uid": "u_yo", "nickname": "YoUser", "avatar": ""}, "yo")
    await bridge.process_chat({"uid": "u_ru", "nickname": "RuUser", "avatar": ""}, "Мен")
    for uid in ("u_me", "u_yo", "u_ru"):
        assert uid in bridge.joined_uids, f"Free join keyword missed for {uid}"

    # 3. Chat request for bride/groom must NOT grant role & must emit bride_groom_locked
    events.clear()
    await bridge.process_chat({"uid": "u_want_bg", "nickname": "BgTry", "avatar": ""}, "novia")
    assert bridge.gelin_user is None, "Chat 'novia' unexpectedly granted gelin role!"
    locked_evts = [e for e in events if e.get("type") == "bride_groom_locked"]
    assert locked_evts, "Expected bride_groom_locked broadcast on 'novia' chat!"

    # 4. Bride auction: "gelin" chat sets team='gelin', then 199 coin gift claims Bride and bumps bride_min -> 224
    await bridge.process_chat({"uid": "u_bride1", "nickname": "BrideQueen", "avatar": ""}, "gelin")
    await bridge.process_gift(
        {"uid": "u_bride1", "nickname": "BrideQueen", "avatar": ""},
        "Taç",
        199,
        gift_id=5502,
        diamond_unit=199,
    )
    assert bridge.gelin_user and bridge.gelin_user["uid"] == "u_bride1", f"Bride1 failed takeover: {events[-2:]}"
    rs1 = bridge.get_round_state()
    assert rs1["bride_min"] == 224, f"Expected bride_min=224, got {rs1['bride_min']}"

    # 5. Second challenger sending 199 coins must NOT overwrite Bride (needs >= 224)
    await bridge.process_chat({"uid": "u_bride2", "nickname": "BrideTwo", "avatar": ""}, "gelin")
    await bridge.process_gift(
        {"uid": "u_bride2", "nickname": "BrideTwo", "avatar": ""},
        "Taç",
        199,
        gift_id=5502,
        diamond_unit=199,
    )
    assert bridge.gelin_user["uid"] == "u_bride1", "199 gift illegally overtook 224 threshold!"

    # 6. Challenger sending 230 coins DOES take Bride and bumps bride_min -> 255
    await bridge.process_chat({"uid": "u_bride3", "nickname": "BrideThree", "avatar": ""}, "gelin")
    await bridge.process_gift(
        {"uid": "u_bride3", "nickname": "BrideThree", "avatar": ""},
        "Aslan Kalbi",
        230,
        gift_id=5900,
        diamond_unit=230,
    )
    assert bridge.gelin_user["uid"] == "u_bride3", "230 gift failed to take over Bride!"
    rs2 = bridge.get_round_state()
    assert rs2["bride_min"] == 255, f"Expected bride_min=255, got {rs2['bride_min']}"

    # 7. Groom signature gift (99) takes open seat (groom_min stays >=199), then 200 coin challenger bumps groom_min -> 225
    await bridge.process_chat({"uid": "u_groom1", "nickname": "GroomKing", "avatar": ""}, "damat")
    await bridge.process_gift(
        {"uid": "u_groom1", "nickname": "GroomKing", "avatar": ""},
        "Küçük Taç",
        99,
        gift_id=6097,
        diamond_unit=99,
    )
    assert bridge.damat_user and bridge.damat_user["uid"] == "u_groom1", "Groom signature gift failed!"
    rs3 = bridge.get_round_state()
    assert rs3["groom_min"] == 199, f"Expected groom_min=199 after open-seat 99 takeover, got {rs3['groom_min']}"
    await bridge.process_chat({"uid": "u_groom2", "nickname": "GroomTwo", "avatar": ""}, "damat")
    await bridge.process_gift(
        {"uid": "u_groom2", "nickname": "GroomTwo", "avatar": ""},
        "Taç",
        200,
        gift_id=5502,
        diamond_unit=200,
    )
    assert bridge.damat_user["uid"] == "u_groom2", "200 gift failed to overtake Groom!"
    rs3 = bridge.get_round_state()
    assert rs3["groom_min"] == 225, f"Expected groom_min=225 after 200 takeover, got {rs3['groom_min']}"

    print(
        "BRIDGE_V41_OK:",
        json.dumps(
            {
                "rose_joined": "u_rose" in bridge.joined_uids,
                "free_joined": ["u_me", "u_yo", "u_ru"],
                "locked_events": len(locked_evts),
                "bride_winner": bridge.gelin_user["uid"],
                "bride_min": rs2["bride_min"],
                "groom_winner": bridge.damat_user["uid"],
                "groom_min": rs3["groom_min"],
            },
            ensure_ascii=False,
        ),
    )


async def verify_v41_live_hud():
    print("\n=== [V41 Step 2] Static HUD_I18N Audit + Live :9944 Playwright HUD & Spotlight Rotation ===")
    html = open(HTML_PATH, "r", encoding="utf-8").read()
    assert "/local_sdk.js?v=41" in html, "index_local.html missing /local_sdk.js?v=41"

    # Extract & audit HUD_I18N from local_sdk.js directly via Node
    import subprocess
    sdk_src = open(SDK_PATH, "r", encoding="utf-8").read()
    m_i18n = re.search(r"const HUD_I18N = (\{[\s\S]*?\n  \});", sdk_src)
    assert m_i18n, "HUD_I18N block not found in local_sdk.js"
    node_script = (
        "const i18n = " + m_i18n.group(1) + ";\n"
        "const langs = Object.keys(i18n);\n"
        "const badHeart = [];\n"
        "const missing1x = [];\n"
        "const missingSpotlights = [];\n"
        "const missingBgLock = [];\n"
        "for (const c of langs) {\n"
        "  const p = i18n[c] || {};\n"
        "  const blob = JSON.stringify(p);\n"
        "  if (c === 'en' && /\\bheart\\b/i.test(blob)) badHeart.push(c);\n"
        "  if (!blob.includes('1×')) missing1x.push(c);\n"
        "  if (!Array.isArray(p.spotlights) || p.spotlights.length < 6) missingSpotlights.push(c);\n"
        "  if (!p.bgLockHint) missingBgLock.push(c);\n"
        "}\n"
        "console.log(JSON.stringify({langs, badHeart, missing1x, missingSpotlights, missingBgLock}));\n"
    )
    res_node = subprocess.run(["node", "-e", node_script], capture_output=True, text=True, encoding="utf-8", check=True)
    i18n_audit = json.loads(res_node.stdout.strip())
    print("HUD_I18N_AUDIT:", json.dumps(i18n_audit, ensure_ascii=False))
    assert len(i18n_audit["langs"]) == 8, f"Expected 8 languages, got {i18n_audit['langs']}"
    assert i18n_audit["badHeart"] == [], f"EN still contains 'heart': {i18n_audit['badHeart']}"
    assert i18n_audit["missing1x"] == [], f"Missing 1× framing: {i18n_audit['missing1x']}"
    assert i18n_audit["missingSpotlights"] == [], f"Missing 6 spotlights: {i18n_audit['missingSpotlights']}"
    assert i18n_audit["missingBgLock"] == [], f"Missing bgLockHint: {i18n_audit['missingBgLock']}"

    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--enable-webgl", "--ignore-gpu-blocklist", "--mute-audio", "--no-sandbox"],
        )
        context = await browser.new_context(viewport={"width": 540, "height": 960}, device_scale_factor=2)
        page = await context.new_page()
        page_errors = []
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        await page.goto("http://127.0.0.1:9944/?obs=1&mode=916&dikey=1", wait_until="domcontentloaded", timeout=30000)

        await page.wait_for_function(
            "() => Boolean(document.getElementById('halay-cinema-hud') && window.__halayTopDock && window.__halayLang && window.__halayShowDjGuide)",
            timeout=25000,
        )
        await asyncio.sleep(2.0)

        hud_audit = await page.evaluate(
            """() => {
                const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src'));
                const sdkSrc = scripts.find(s => s && s.includes('local_sdk.js')) || '';
                const visibleShowcase = Array.from(document.querySelectorAll('#ch-showcase .ch-sc-card'))
                    .filter(el => {
                        const st = getComputedStyle(el);
                        return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
                    }).length;
                const totalShowcase = document.querySelectorAll('#ch-showcase .ch-sc-card').length;
                const dancers = (window.halay && window.halay.engine && Array.isArray(window.halay.engine.dancers))
                    ? window.halay.engine.dancers.length : -1;
                const wsEl = document.querySelector('#ws-status, [data-ws-status]');
                const wsStatus = (window.__halayWsReady ? 'ready' : (wsEl ? wsEl.textContent.trim() : 'unknown'));
                return {
                    sdkSrc,
                    visibleShowcase,
                    totalShowcase,
                    dancers,
                    wsStatus,
                    hudVisible: !!document.getElementById('halay-cinema-hud'),
                };
            }"""
        )
        hud_audit["page_errors"] = page_errors
        print("HUD_AUDIT:", json.dumps(hud_audit, ensure_ascii=False))
        assert "/local_sdk.js?v=41" in hud_audit["sdkSrc"], f"Unexpected sdkSrc: {hud_audit['sdkSrc']}"
        assert hud_audit["visibleShowcase"] == 3, f"Expected 3 compact showcase items, got {hud_audit['visibleShowcase']} (total={hud_audit['totalShowcase']})"
        assert page_errors == [], f"Page errors: {page_errors}"

        # Rotate spotlights 3 times cleanly
        spotlights_seen = []
        for idx in range(3):
            await page.evaluate("() => window.__halayTopDock.showPeriodicDjGuide(false)")
            await asyncio.sleep(0.35)
            snap = await page.evaluate(
                """() => ({
                    meta: (document.querySelector('#halay-dj-subtitle #djs-meta') || {}).textContent || '',
                    line: (document.querySelector('#halay-dj-subtitle #djs-line') || {}).textContent || '',
                })"""
            )
            spotlights_seen.append(snap)
        print("SPOTLIGHT_ROTATIONS:", json.dumps(spotlights_seen, ensure_ascii=False))
        distinct_lines = len({(s["meta"], s["line"]) for s in spotlights_seen})
        assert distinct_lines >= 2, f"Spotlights did not rotate: {spotlights_seen}"

        # Pause WebGL loop cleanly before screenshot to avoid timeout
        await page.evaluate("() => { if (window.halay && window.halay.engine && window.halay.engine.stop) window.halay.engine.stop(); }")
        await asyncio.sleep(0.25)
        cdp = await context.new_cdp_session(page)
        shot = await cdp.send("Page.captureScreenshot", {"format": "png"})
        import base64

        with open(SCREENSHOT_PATH, "wb") as f:
            f.write(base64.b64decode(shot["data"]))
        print(f"SCREENSHOT_SAVED: {SCREENSHOT_PATH} ({os.path.getsize(SCREENSHOT_PATH)} bytes)")
        await browser.close()


async def main():
    backup_path = None
    if os.path.exists(STATE_PATH):
        fd, backup_path = tempfile.mkstemp(prefix="room_state_bak_", suffix=".json")
        os.close(fd)
        shutil.copy2(STATE_PATH, backup_path)
    try:
        print("=== [V38 Regression] AI Host & Bridge Logic ===")
        await verify_v38_shield.verify_ai_host()
        await verify_v38_shield.verify_bridge_logic()
        await verify_v41_backend()
        await verify_v41_live_hud()
        print("\nALL V41 CHECKS PASSED!")
    finally:
        if backup_path and os.path.exists(backup_path):
            shutil.copy2(backup_path, STATE_PATH)
            os.remove(backup_path)


if __name__ == "__main__":
    asyncio.run(main())
