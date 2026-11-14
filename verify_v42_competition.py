import asyncio
import base64
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SDK_PATH = r"c:\Users\pc\Documents\projelerim\Tikoyun_Unpacked\halay_web\local_sdk.js"
HTML_PATH = r"c:\Users\pc\Documents\projelerim\Tikoyun_Unpacked\halay_web\index_local.html"
STATE_PATH = os.path.join(BASE_DIR, "logs", "active_room_state.json")
SCREENSHOT_PATH = (
    r"C:\Users\pc\.gemini\antigravity\brain\47617e3f-4006-4cf7-8a85-0491c3457aa2\v42_live_hud_verified.png"
)

from tiktok_bridge import HalayLiveBridge


async def verify_v42_mechanics():
    print("\n=== [V42 Step 1] Seat Limit (24), Queue, AFK Drop, Room Exit & Front-Row Order ===")
    events = []

    async def capture_bcast(msg):
        events.append(msg)

    bridge = HalayLiveBridge(capture_bcast)
    bridge._save_active_room_state = lambda: None
    await bridge.reset_state()
    bridge._save_active_room_state = lambda: None

    # 1. Fill all 24 seats
    for i in range(24):
        await bridge.process_chat({"uid": f"u_{i}", "nickname": f"Dancer_{i}", "avatar": ""}, "KATIL")
    assert len(bridge.joined_users) == 24, f"Expected 24 seated, got {len(bridge.joined_users)}"
    assert bridge.get_round_state()["seat_count"] == 24

    # 2. 25th free user enters waiting queue instead of stage
    events.clear()
    await bridge.process_chat({"uid": "u_wait1", "nickname": "WaiterOne", "avatar": ""}, "KATIL")
    assert "u_wait1" not in bridge.joined_uids, "25th free user bypassed 24-seat cap!"
    assert "u_wait1" in bridge.waiting_uids, "25th free user missing from waiting_queue!"
    q_evts = [e for e in events if e.get("type") == "queue_status"]
    assert q_evts and q_evts[0]["queue_count"] == 1, f"Expected queue_status, got {q_evts}"

    # 3. VIP gift (5+ coins) skips queue by bumping lowest-score dancer
    events.clear()
    await bridge.process_gift(
        {"uid": "u_vip_skip", "nickname": "VipSkipper", "avatar": ""},
        "Kalp",
        5,
        gift_id=5660,
        diamond_unit=5,
    )
    assert "u_vip_skip" in bridge.joined_uids, "VIP 5-coin gifter failed to enter full stage!"
    assert len(bridge.joined_users) == 24, f"Stage exceeded 24 seats: {len(bridge.joined_users)}"
    bump_evts = [e for e in events if e.get("type") == "leave_halay" and e.get("reason") == "vip_bump"]
    assert bump_evts, "Expected vip_bump leave_halay event!"

    # 4. AFK stamina expiration removes dancer & auto-promotes u_wait1 from queue
    events.clear()
    afk_uid = next(u["uid"] for u in bridge.joined_users if u["uid"] != "u_vip_skip")
    bridge.dancer_until[afk_uid] = time.time() - 5.0
    removed_afk = await bridge.sweep_inactive_dancers()
    assert any(r["uid"] == afk_uid and r["reason"] == "afk" for r in removed_afk), f"AFK sweep missed: {removed_afk}"
    assert afk_uid not in bridge.joined_uids
    assert "u_wait1" in bridge.joined_uids, "u_wait1 was not promoted after AFK drop!"
    assert bridge.get_round_state()["queue_count"] == 0

    # 5. Room exit (missing from RoomUserSeqEvent ranks for >35s & no activity) removes dancer
    events.clear()
    now_t = time.time()
    left_uid = next(u["uid"] for u in bridge.joined_users if u["uid"] != "u_vip_skip")
    bridge._seen_in_ranks.add(left_uid)
    bridge._last_ranks_seen[left_uid] = now_t - 45.0
    bridge.last_active_ts[left_uid] = now_t - 45.0
    removed_left = await bridge.sweep_inactive_dancers(now_ts=now_t)
    assert any(r["uid"] == left_uid and r["reason"] == "left_room" for r in removed_left), f"Room exit missed: {removed_left}"
    assert left_uid not in bridge.joined_uids

    # 6. Front row vs Back row ordering (higher supporter score moves earlier in stage_order)
    low_uid = bridge.joined_users[-1]["uid"]
    high_uid = bridge.joined_users[-2]["uid"]
    bridge.add_supporter_points({"uid": low_uid, "nickname": "Low", "avatar": ""}, 1.0)
    bridge.add_supporter_points({"uid": high_uid, "nickname": "High", "avatar": ""}, 500.0)
    order = bridge.get_stage_order()
    assert order.index(high_uid) < order.index(low_uid), "Front-row priority sorting failed!"

    print(
        "BRIDGE_V42_OK:",
        json.dumps(
            {
                "seat_cap": len(bridge.joined_users),
                "vip_skip_ok": "u_vip_skip" in bridge.joined_uids,
                "afk_promoted_wait1": "u_wait1" in bridge.joined_uids,
                "left_room_removed": left_uid not in bridge.joined_uids,
                "front_row_idx": order.index(high_uid),
                "back_row_idx": order.index(low_uid),
            },
            ensure_ascii=False,
        ),
    )


async def verify_v42_live_hud():
    print("\n=== [V42 Step 2] Static HUD_I18N + Live :9944 Playwright HUD & Screenshot ===")
    html = open(HTML_PATH, "r", encoding="utf-8").read()
    assert "/local_sdk.js?v=43" in html, "index_local.html missing /local_sdk.js?v=43"

    sdk_src = open(SDK_PATH, "r", encoding="utf-8").read()
    m_i18n = re.search(r"const HUD_I18N = (\{[\s\S]*?\n  \});", sdk_src)
    assert m_i18n, "HUD_I18N block not found in local_sdk.js"
    node_script = (
        "const i18n = " + m_i18n.group(1) + ";\n"
        "const langs = Object.keys(i18n);\n"
        "const badHeart = [];\n"
        "const missing1x = [];\n"
        "const missing24 = [];\n"
        "const missingQueueHints = [];\n"
        "for (const c of langs) {\n"
        "  const p = i18n[c] || {};\n"
        "  const blob = JSON.stringify(p);\n"
        "  if (c === 'en' && /\\bheart\\b/i.test(blob)) badHeart.push(c);\n"
        "  if (!blob.includes('1×')) missing1x.push(c);\n"
        "  if (!blob.includes('24')) missing24.push(c);\n"
        "  if (!p.afkDropHint || !p.leftRoomHint || !p.vipBumpHint || !p.queueWaitHint || !p.queueNextHint) missingQueueHints.push(c);\n"
        "}\n"
        "console.log(JSON.stringify({langs, badHeart, missing1x, missing24, missingQueueHints}));\n"
    )
    res_node = subprocess.run(["node", "-e", node_script], capture_output=True, text=True, encoding="utf-8", check=True)
    i18n_audit = json.loads(res_node.stdout.strip())
    print("HUD_I18N_V42_AUDIT:", json.dumps(i18n_audit, ensure_ascii=False))
    assert i18n_audit["badHeart"] == []
    assert i18n_audit["missing1x"] == []
    assert i18n_audit["missing24"] == [], f"Missing 24-seat rule in HUD_I18N: {i18n_audit['missing24']}"
    assert i18n_audit["missingQueueHints"] == [], f"Missing queue/afk hints: {i18n_audit['missingQueueHints']}"

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
            "() => Boolean(document.getElementById('halay-cinema-hud') && window.__halayTopDock && window.__halayShowDjGuide)",
            timeout=25000,
        )
        await asyncio.sleep(2.0)

        # Trigger spotlight explaining 24-seat limit & 90s energy/front-row race
        await page.evaluate("() => { window.__halayTopDock.showPeriodicDjGuide(false); }")
        await asyncio.sleep(0.35)

        hud_audit = await page.evaluate(
            """() => {
                const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src'));
                const sdkSrc = scripts.find(s => s && s.includes('local_sdk.js')) || '';
                const goalPill = document.getElementById('htd-goal-pill')?.textContent || '';
                const subLine = document.querySelector('#halay-dj-subtitle #djs-line')?.textContent || '';
                return { sdkSrc, goalPill, subLine };
            }"""
        )
        hud_audit["page_errors"] = page_errors
        print("HUD_V42_LIVE:", json.dumps(hud_audit, ensure_ascii=False))
        assert "/local_sdk.js?v=43" in hud_audit["sdkSrc"]
        assert "/24" in hud_audit["goalPill"], f"Goal pill missing /24 seat display: {hud_audit['goalPill']}"
        assert page_errors == [], f"Page errors: {page_errors}"

        await page.evaluate("() => { if (window.halay && window.halay.engine && window.halay.engine.stop) window.halay.engine.stop(); }")
        await asyncio.sleep(0.25)
        cdp = await context.new_cdp_session(page)
        shot = await cdp.send("Page.captureScreenshot", {"format": "png"})
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
        await verify_v42_mechanics()
        await verify_v42_live_hud()
        print("\nALL V42 CHECKS PASSED!")
    finally:
        if backup_path and os.path.exists(backup_path):
            shutil.copy2(backup_path, STATE_PATH)
            os.remove(backup_path)


if __name__ == "__main__":
    asyncio.run(main())
